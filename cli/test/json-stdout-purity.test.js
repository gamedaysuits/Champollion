#!/usr/bin/env node
/**
 * Regression: --json stdout must stay pure NDJSON when a direct-API MT method
 * actually translates keys.
 *
 * THE BUG: Google/DeepL/Microsoft/LibreTranslate each wrote a raw batch-success
 * indicator ("  ✓ <Provider> batch N (...)") straight to stdout via
 * process.stdout.write, bypassing the json-aware output module. In --json mode
 * that landed a non-JSON line in the otherwise-pure-NDJSON stdout stream, so
 * `champollion sync --json | jq` failed with "Invalid numeric literal" on the
 * ✓ line. The fix routes those writes through output.progress(), which is
 * suppressed in quiet AND json modes.
 *
 * This test drives each method's real translate() through a stubbed global.fetch
 * in json mode and asserts (a) every stdout line is JSON.parse-able and (b) the
 * raw banner never appears — while default mode still prints the human line.
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { output } from '../lib/output.js';
import { GoogleTranslateMethod } from '../lib/methods/google-translate.js';
import { DeepLMethod } from '../lib/methods/deepl.js';
import { MicrosoftTranslatorMethod } from '../lib/methods/microsoft-translator.js';
import { LibreTranslateMethod } from '../lib/methods/libretranslate.js';

import { run as runAudit } from '../lib/commands/audit.js';
import { run as runStatus } from '../lib/commands/status.js';
import { run as runLintCmd } from '../lib/commands/lint.js';
import { run as runIntegrity } from '../lib/commands/integrity.js';
import { run as runTm } from '../lib/commands/tm.js';
import { run as runModels } from '../lib/commands/models.js';
import { run as runDoctor } from '../lib/commands/doctor.js';
import { run as runXliff } from '../lib/commands/xliff.js';

const realWrite = process.stdout.write.bind(process.stdout);
const realFetch = global.fetch;

// Run `fn` with stdout captured into a string. Restores the real stdout
// immediately so the test runner's own TAP output is never swallowed.
async function withCapturedStdout(fn) {
  let captured = '';
  process.stdout.write = (chunk) => { captured += chunk; return true; };
  try {
    await fn();
  } finally {
    process.stdout.write = realWrite;
  }
  return captured;
}

// Fake fetch returning a translated payload in each provider's response shape.
function fakeFetch(shape) {
  return async (_url, opts) => ({
    ok: true,
    status: 200,
    async text() { return ''; },
    async json() { return shape(JSON.parse(opts.body)); },
  });
}

const KEYS = ['greeting', 'farewell'];
const SOURCE = { greeting: 'Hello', farewell: 'Goodbye' };
const PAIR = { target: 'fr', source: 'en' };

const CASES = [
  {
    name: 'google-translate',
    make: () => new GoogleTranslateMethod(),
    opts: { googleApiKey: 'fake-key' },
    fetch: fakeFetch((b) => ({ data: { translations: b.q.map((t) => ({ translatedText: `${t}_fr` })) } })),
    banner: '✓ Google batch',
  },
  {
    name: 'deepl',
    make: () => new DeepLMethod(),
    opts: { deeplApiKey: 'fake-key' },
    fetch: fakeFetch((b) => ({ translations: b.text.map((t) => ({ text: `${t}_fr` })) })),
    banner: '✓ DeepL batch',
  },
  {
    name: 'microsoft-translator',
    make: () => new MicrosoftTranslatorMethod(),
    opts: { microsoftApiKey: 'fake-key', microsoftRegion: 'global' },
    fetch: fakeFetch((b) => b.map((seg) => ({ translations: [{ text: `${seg.Text}_fr` }] }))),
    banner: '✓ Microsoft batch',
  },
  {
    name: 'libretranslate',
    make: () => new LibreTranslateMethod(),
    opts: { libretranslateApiKey: 'fake-key', libretranslateApiUrl: 'https://libretranslate.example/translate' },
    fetch: fakeFetch((b) => ({ translatedText: (Array.isArray(b.q) ? b.q : [b.q]).map((t) => `${t}_fr`) })),
    banner: '✓ LibreTranslate batch',
  },
];

describe('--json stdout purity (MT method batch indicators)', () => {
  afterEach(() => {
    // Restore module-global singletons mutated by these tests.
    output.setMode('default');
    global.fetch = realFetch;
    process.stdout.write = realWrite;
  });

  for (const c of CASES) {
    it(`${c.name}: --json mode emits only valid JSON lines while translating`, async () => {
      global.fetch = c.fetch;
      output.setMode('json');

      let result;
      const captured = await withCapturedStdout(async () => {
        result = await c.make().translate([...KEYS], { ...SOURCE }, { ...PAIR }, c.opts);
      });

      // The method must actually have translated — otherwise the raw-write code
      // path was never reached and the test would pass vacuously.
      assert.ok(result && Object.keys(result).length === KEYS.length,
        `${c.name} did not translate (stub mismatch) — got ${JSON.stringify(result)}`);

      // Every non-empty stdout line must be JSON.parse-able — this is exactly
      // what `champollion sync --json | jq` requires.
      for (const line of captured.split('\n').filter((l) => l.trim().length > 0)) {
        assert.doesNotThrow(() => JSON.parse(line),
          `${c.name} leaked a non-JSON line into --json stdout: ${JSON.stringify(line)}`);
      }

      // And specifically the raw batch banner must not appear.
      assert.ok(!captured.includes(c.banner),
        `${c.name} leaked the raw "${c.banner}" banner into --json stdout`);
    });

    it(`${c.name}: default mode still prints the human progress line`, async () => {
      global.fetch = c.fetch;
      output.setMode('default');

      const captured = await withCapturedStdout(async () => {
        await c.make().translate([...KEYS], { ...SOURCE }, { ...PAIR }, c.opts);
      });

      assert.ok(captured.includes(c.banner),
        `${c.name} no longer prints "${c.banner}" in default mode (regression)`);
    });
  }
});

// =================================================================
// --json on the formerly-gap commands (audit, status, lint, integrity,
// tm, models, doctor, xliff)
//
// Contract: with json:true NOTHING non-JSON reaches stdout — every
// non-empty line must JSON.parse (NDJSON for audit; a single document
// for the rest). Default mode must still print human output.
// =================================================================
describe('--json stdout purity (command surfaces)', () => {
  let proj;

  before(() => {
    proj = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-json-purity-'));
    fs.writeFileSync(path.join(proj, 'champollion.config.json'), JSON.stringify({
      version: 3,
      inputLocale: 'en',
      localesDir: './locales',
      languages: ['fr'],
      model: 'openai/gpt-4o-mini',
      format: 'json',
    }), 'utf-8');
    fs.mkdirSync(path.join(proj, 'locales'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'locales', 'en.json'), JSON.stringify({
      greeting: 'Hello there',
      farewell: 'Goodbye now',
      brand: 'Champollion',
    }), 'utf-8');
    // fr has an [EN] fallback (audit finds work) and a placeholder echo.
    fs.writeFileSync(path.join(proj, 'locales', 'fr.json'), JSON.stringify({
      greeting: '[EN] Hello there',
      farewell: 'Au revoir',
      brand: 'Champollion',
    }), 'utf-8');
    // A source file with a hardcoded string for lint.
    fs.mkdirSync(path.join(proj, 'src'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'src', 'App.jsx'),
      'export default function App() {\n  return <div>Hello hardcoded world</div>;\n}\n', 'utf-8');
  });

  after(() => {
    fs.rmSync(proj, { recursive: true, force: true });
  });

  afterEach(() => {
    output.setMode('default');
    process.stdout.write = realWrite;
  });

  // NDJSON commands (audit): every non-empty LINE must parse on its own.
  // Single-document commands: stdout as a whole must be exactly one JSON
  // document (pretty-printed is fine — that is what `| jq` consumes).
  // Either way, nothing non-JSON may reach stdout.
  function assertPureJson(name, captured, mode) {
    const lines = captured.split('\n').filter((l) => l.trim().length > 0);
    assert.ok(lines.length > 0, `${name} --json produced no stdout at all`);
    if (mode === 'ndjson') {
      for (const line of lines) {
        assert.doesNotThrow(() => JSON.parse(line),
          `${name} leaked a non-JSON line into --json stdout: ${JSON.stringify(line)}`);
      }
      return lines.map((l) => JSON.parse(l));
    }
    let doc;
    assert.doesNotThrow(() => { doc = JSON.parse(captured); },
      `${name} --json stdout is not a single JSON document:\n${captured}`);
    return doc;
  }

  // Each case: run(args, cwd), a jq-style assertion on the json output,
  // and a human marker the default mode must still print.
  const COMMAND_CASES = [
    {
      name: 'audit',
      run: (args) => runAudit(args, proj),
      args: { _: ['audit'] },
      mode: 'ndjson',
      expectExit: (code) => code === 1, // one [EN] fallback → parity gate fires
      checkJson: (objs) => {
        const summary = objs.find((o) => o.level === 'summary');
        assert.ok(summary, 'audit --json must emit a summary object');
        assert.equal(summary.command, 'audit');
        assert.equal(summary.untranslatedCount, 1);
        const fr = summary.locales.find((l) => l.locale === 'fr');
        assert.deepEqual(fr.untranslatedKeys, ['greeting']);
      },
      humanMarker: 'greeting',
    },
    {
      name: 'status',
      run: (args) => runStatus(args, proj),
      args: { _: ['status'] },
      expectExit: (code) => code === 0,
      checkJson: (doc) => {
        assert.equal(doc.command, 'status');
        assert.equal(doc.pairs.length, 1);
        assert.equal(doc.pairs[0].target, 'fr');
      },
      humanMarker: 'Translation Status',
    },
    {
      name: 'lint',
      run: (args) => runLintCmd(args, proj),
      args: { _: ['lint'], src: './src' },
      expectExit: (code) => code === 0 || code === 1,
      checkJson: (doc) => {
        assert.equal(doc.command, 'lint');
        assert.ok(doc.count >= 1, 'lint must find the hardcoded string');
        assert.ok(doc.findings.some((f) => f.text.includes('Hello hardcoded world')));
        assert.ok(doc.findings.every((f) => f.file && f.line && f.text));
      },
      humanMarker: 'Coverage Report',
    },
    {
      name: 'integrity',
      run: (args) => runIntegrity(args, proj),
      args: { _: ['integrity'], 'warn-only': true },
      expectExit: (code) => code === 0,
      checkJson: (doc) => {
        assert.equal(doc.command, 'integrity');
        assert.ok(Array.isArray(doc.locales));
        assert.ok(doc.locales.some((l) => l.locale === 'fr'));
        assert.equal(typeof doc.totalIssues, 'number');
      },
      humanMarker: 'Locale File Audit',
    },
    {
      name: 'tm',
      run: (args) => runTm(args, proj),
      args: { _: ['tm', 'stats'] },
      expectExit: (code) => code === 0,
      checkJson: (doc) => {
        assert.equal(doc.command, 'tm');
        assert.equal(doc.action, 'stats');
        assert.equal(typeof doc.total, 'number');
      },
      humanMarker: 'Translation Memory',
    },
    {
      name: 'models',
      run: (args) => runModels(args, proj),
      args: { _: ['models'] }, // no --method: offline provider listing
      expectExit: (code) => code === 0,
      checkJson: (doc) => {
        assert.equal(doc.command, 'models');
        assert.ok(Array.isArray(doc.providers) && doc.providers.length > 0);
      },
      humanMarker: 'Available providers',
    },
    {
      name: 'doctor',
      run: (args) => runDoctor(args, proj),
      args: { _: ['doctor', 'config'] }, // offline subcommand
      expectExit: (code) => code === 0 || code === 1,
      checkJson: (doc) => {
        assert.equal(doc.command, 'doctor');
        assert.ok(Array.isArray(doc.results) && doc.results.length > 0);
        assert.equal(typeof doc.failed, 'number');
      },
      humanMarker: 'System Health Check',
    },
    {
      name: 'xliff',
      run: (args) => runXliff(args, proj),
      args: { _: ['xliff', 'export'], locale: 'fr' },
      expectExit: (code) => code === 0,
      checkJson: (doc) => {
        assert.equal(doc.command, 'xliff');
        assert.equal(doc.action, 'export');
        assert.equal(doc.locale, 'fr');
        assert.ok(doc.exported >= 1);
      },
      humanMarker: 'Exported XLIFF',
    },
  ];

  for (const c of COMMAND_CASES) {
    it(`${c.name}: --json mode emits only JSON lines on stdout`, async () => {
      let code;
      const captured = await withCapturedStdout(async () => {
        code = await c.run({ ...c.args, json: true });
      });
      assert.ok(c.expectExit(code), `${c.name} --json unexpected exit code ${code}`);
      const parsed = assertPureJson(c.name, captured, c.mode || 'single');
      c.checkJson(parsed);
    });

    it(`${c.name}: default mode still prints human output`, async () => {
      output.setMode('default');
      let code;
      const captured = await withCapturedStdout(async () => {
        code = await c.run({ ...c.args });
      });
      assert.ok(c.expectExit(code), `${c.name} default unexpected exit code ${code}`);
      assert.ok(captured.includes(c.humanMarker),
        `${c.name} default mode lost its human output (expected "${c.humanMarker}"):\n${captured}`);
    });
  }
});
