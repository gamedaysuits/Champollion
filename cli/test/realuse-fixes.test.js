#!/usr/bin/env node
/**
 * Real-use bug-fix regression suite.
 *
 * Covers the round of fixes for issues that only surface in real use:
 *   1. `sync --json` (verification runs by default) must emit ONLY JSON.
 *   2. Docusaurus verify must actually validate (was a false-green no-op).
 *   5. No [OK] summary on failure; 401-vs-429 setup help.
 *   6. doctor reads config.defaultMethod (not the non-existent config.method).
 *   7. `sync --dry` reports the keys it WOULD process (not 0).
 *   8. register-corpus local-only guard is not symlink-bypassable.
 *   9. Help examples quote `--pair "src>tgt"` so the shell doesn't eat `>`.
 *
 * Run: node test/realuse-fixes.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';

import { output } from '../lib/output.js';
import { runSync, formatSyncSummary } from '../lib/sync.js';
import { LLMMethod } from '../lib/methods/llm.js';
import {
  recordTranslationError,
  resetTranslationError,
  classifyTranslationError,
} from '../lib/methods/translation-error.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');
const SSOT_DIR = path.join(import.meta.dirname, '..', 'shared', 'corpora-cards');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champ-realuse-'));
}
function rm(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Run the real CLI binary; capture stdout/stderr/exit regardless of code. */
function runCLI(args, cwd) {
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
      cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', status: err.status ?? 1 };
  }
}

/** Assert every non-empty line of `text` is valid JSON (the jq contract). */
function assertAllLinesJSON(text, where) {
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    assert.doesNotThrow(
      () => JSON.parse(line),
      `${where}: non-JSON line leaked into json-mode output: ${JSON.stringify(line)}`
    );
  }
}

// =================================================================
// 1. `verify --json` (the default-sync verification path) emits only JSON
// =================================================================
describe('issue #1 — verify --json output is pure JSON (jq-parseable)', () => {
  let dir;
  beforeEach(() => { dir = tmp(); fs.mkdirSync(path.join(dir, 'locales')); });
  afterEach(() => rm(dir));

  it('clean pass: stdout is a single parseable JSON object, exit 0', () => {
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ greeting: 'Hello' }));
    fs.writeFileSync(path.join(dir, 'locales', 'fr.json'), JSON.stringify({ greeting: 'Bonjour' }));

    const { stdout, stderr, status } = runCLI(['verify', '--json'], dir);
    assert.equal(status, 0, `expected pass; stderr=${stderr}`);
    assertAllLinesJSON(stdout, 'stdout');
    assertAllLinesJSON(stderr, 'stderr');
    // No decorative separators leaked into the machine stream.
    assert.ok(!stdout.includes('──'), 'decorative separator must not appear in json stdout');
  });

  it('real jq parses the json-mode stdout', () => {
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ greeting: 'Hello' }));
    fs.writeFileSync(path.join(dir, 'locales', 'fr.json'), JSON.stringify({ greeting: 'Bonjour' }));
    // `jq .` exits non-zero if any input line is not valid JSON.
    const cmd = `${JSON.stringify(process.execPath)} ${JSON.stringify(CLI_PATH)} verify --json | jq .`;
    assert.doesNotThrow(
      () => execSync(cmd, { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] }),
      'champollion verify --json | jq should succeed'
    );
  });

  it('failure case: findings are reported, every line is still JSON, exit 1', () => {
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ greeting: 'Hello', farewell: 'Bye' }));
    fs.writeFileSync(path.join(dir, 'locales', 'fr.json'), JSON.stringify({ greeting: 'Bonjour' }));

    const { stdout, stderr, status } = runCLI(['verify', '--json'], dir);
    assert.equal(status, 1, 'missing key must fail the gate');
    assertAllLinesJSON(stdout, 'stdout');
    assertAllLinesJSON(stderr, 'stderr');
    assert.ok(/missing key/i.test(stderr), 'should report the missing key');
  });
});

// =================================================================
// 2. Docusaurus verify actually validates (was a false-green no-op)
// =================================================================
describe('issue #2 — Docusaurus verify resolves the i18n layout', () => {
  let dir;
  beforeEach(() => { dir = tmp(); });
  afterEach(() => rm(dir));

  function writeDocusaurus(frMessages) {
    fs.writeFileSync(path.join(dir, 'docusaurus.config.js'), 'module.exports = {};');
    fs.mkdirSync(path.join(dir, 'i18n', 'en'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'i18n', 'fr'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'i18n', 'en', 'code.json'),
      JSON.stringify({ greeting: { message: 'Hello' }, farewell: { message: 'Bye' } }, null, 2)
    );
    fs.writeFileSync(path.join(dir, 'i18n', 'fr', 'code.json'), JSON.stringify(frMessages, null, 2));
  }

  it('fails (exit 1) when a target message is missing — not a silent exit 0', () => {
    writeDocusaurus({ greeting: { message: 'Bonjour' } }); // farewell missing
    const { status, stderr } = runCLI(['verify'], dir);
    assert.equal(status, 1, 'missing Docusaurus message must fail the gate');
    assert.ok(/farewell|missing key/i.test(stderr), `should name the gap; got: ${stderr}`);
  });

  it('passes (exit 0) when all messages are translated', () => {
    writeDocusaurus({ greeting: { message: 'Bonjour' }, farewell: { message: 'Au revoir' } });
    const { status, stderr } = runCLI(['verify'], dir);
    assert.equal(status, 0, `expected clean pass; stderr=${stderr}`);
  });
});

// =================================================================
// 5a. No [OK] summary when keys failed
// =================================================================
describe('issue #5a — sync summary never reports [OK] on failure', () => {
  it('totalFailed > 0 → ok:false', () => {
    const s = formatSyncSummary(false, 10, 3);
    assert.equal(s.ok, false);
    assert.ok(/failed/i.test(s.message));
  });
  it('clean run → ok:true', () => {
    assert.equal(formatSyncSummary(false, 10, 0).ok, true);
  });
  it('dry-run framing carries through', () => {
    assert.ok(formatSyncSummary(true, 5, 0).message.startsWith('Would have processed'));
  });
});

// =================================================================
// 5b. getSetupHelp distinguishes 401 (bad key) from 429 (quota)
// =================================================================
describe('issue #5b — setup help branches 401 vs 429', () => {
  let prevKey;
  beforeEach(() => {
    prevKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'sk-test'; // force the "key set but failed" branch
    resetTranslationError();
  });
  afterEach(() => {
    if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = prevKey;
    resetTranslationError();
  });

  it('classifyTranslationError maps statuses', () => {
    assert.equal(classifyTranslationError(401), 'auth');
    assert.equal(classifyTranslationError(403), 'auth');
    assert.equal(classifyTranslationError(429), 'quota');
    assert.equal(classifyTranslationError(503), 'server');
    assert.equal(classifyTranslationError(418), 'unknown');
  });

  it('401 → blames the key, not billing', () => {
    recordTranslationError(401);
    const help = new LLMMethod().getSetupHelp().join('\n');
    assert.ok(/401/.test(help));
    assert.ok(/invalid|rejected|key value/i.test(help));
    assert.ok(!/quota\/billing/i.test(help), 'must not tell the user to check billing for a bad key');
  });

  it('429 → points at quota/billing', () => {
    recordTranslationError(429);
    const help = new LLMMethod().getSetupHelp().join('\n');
    assert.ok(/429|quota/i.test(help));
    assert.ok(/quota\/billing/i.test(help));
  });

  it('no recorded error → unchanged generic guidance', () => {
    const help = new LLMMethod().getSetupHelp().join('\n');
    assert.ok(/translation failed\. Check your OpenRouter dashboard for quota\/billing\./.test(help));
  });
});

// =================================================================
// 6. doctor reads config.defaultMethod
// =================================================================
describe('issue #6 — doctor config uses defaultMethod', () => {
  let dir;
  beforeEach(() => { dir = tmp(); });
  afterEach(() => rm(dir));

  it('reports the configured defaultMethod instead of warning', () => {
    fs.writeFileSync(path.join(dir, 'champollion.config.json'),
      JSON.stringify({ inputLocale: 'en', languages: ['fr'], defaultMethod: 'deepl' }, null, 2));
    const { stdout } = runCLI(['doctor', 'config'], dir);
    assert.ok(stdout.includes('deepl'), `should show the method; got: ${stdout}`);
    assert.ok(!/No default method configured/.test(stdout), 'must not warn on a correct config');
  });

  it('treats a config with no method as the documented llm default (no warning)', () => {
    // This mirrors what `champollion init` writes — no method/defaultMethod key.
    fs.writeFileSync(path.join(dir, 'champollion.config.json'),
      JSON.stringify({ inputLocale: 'en', languages: ['fr'] }, null, 2));
    const { stdout } = runCLI(['doctor', 'config'], dir);
    assert.ok(!/No default method configured/.test(stdout), 'init output must not trip the warning');
  });
});

// =================================================================
// 7. sync --dry reports the keys it WOULD process
// =================================================================
describe('issue #7 — dry-run counts pending keys', () => {
  let dir, prevKey, origLog, lines;
  beforeEach(() => {
    dir = tmp();
    fs.mkdirSync(path.join(dir, 'locales'));
    // Keep cost-estimate offline/quiet during the test.
    prevKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });
  afterEach(() => {
    if (origLog) console.log = origLog;
    output.setMode('default');
    if (prevKey !== undefined) process.env.OPENROUTER_API_KEY = prevKey;
    rm(dir);
  });

  it('summary.totalProcessed equals the missing-key count (not 0)', async () => {
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'),
      JSON.stringify({ a: 'A', b: 'B', c: 'C' }));
    fs.writeFileSync(path.join(dir, 'locales', 'fr.json'), JSON.stringify({}));

    lines = [];
    origLog = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    output.setMode('json');
    try {
      await runSync({ dryRun: true, cwd: dir, cliArgs: {} });
    } finally {
      console.log = origLog; origLog = null;
      output.setMode('default');
    }

    const summary = lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .find(o => o && o.level === 'summary');
    assert.ok(summary, 'a json summary line should be emitted');
    assert.equal(summary.dryRun, true);
    assert.equal(summary.totalProcessed, 3, 'dry-run must report keys it WOULD process');
  });
});

// =================================================================
// 8. register-corpus local-only guard is not symlink-bypassable
// =================================================================
describe('issue #8 — local-only guard resolves symlinks', () => {
  let dir;
  beforeEach(() => { dir = tmp(); });
  afterEach(() => rm(dir));

  const baseFlags = [
    'register-corpus', '--yes', '--tier', 'local-only',
    '--name', 'Test set', '--pair', 'eng-crk',
    '--license', 'cc-by-4.0', '--size', '10', '--domain', 'news',
  ];

  it('rejects an --out symlink that points into the tracked SSOT', () => {
    const link = path.join(dir, 'sneaky');
    fs.symlinkSync(SSOT_DIR, link, 'dir');
    const { status, stderr } = runCLI([...baseFlags, '--out', link], dir);
    assert.equal(status, 1, 'a symlink into the SSOT must be rejected');
    assert.ok(/must not be written/i.test(stderr), `should explain the rejection; got: ${stderr}`);
  });

  it('still allows a normal local --out directory', () => {
    const outDir = path.join(dir, 'mycards');
    const { status } = runCLI([...baseFlags, '--out', outDir], dir);
    assert.equal(status, 0, 'a normal --out must still work');
    const files = fs.existsSync(outDir) ? fs.readdirSync(outDir) : [];
    assert.ok(files.some(f => f.endsWith('.json')), 'card should be written locally');
  });
});

// =================================================================
// 9. Help examples quote the language pair
// =================================================================
describe('issue #9 — help quotes --pair so the shell does not eat `>`', () => {
  let dir;
  beforeEach(() => { dir = tmp(); });
  afterEach(() => rm(dir));

  it('register-corpus --help shows a quoted pair, never a bare --pair eng>crk', () => {
    const { stdout } = runCLI(['register-corpus', '--help'], dir);
    assert.ok(/--pair "eng>crk"|--pair "eng-crk"|--pair eng-crk/.test(stdout),
      'examples should use a shell-safe pair form');
    assert.ok(!/--pair eng>crk(?!")/.test(stdout), 'no unquoted --pair eng>crk');
  });
});
