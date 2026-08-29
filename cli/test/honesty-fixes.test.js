#!/usr/bin/env node
/**
 * Cold-run honesty-trap regression suite (2026-07-12 developer simulation).
 *
 * Three fixes where the CLI silently did something different from what the
 * user asked:
 *
 *   1. `sync --pair en:fr` was parsed but never read — every configured
 *      locale was estimated/translated (a 5× spend for a user who asked for
 *      one pair). Now: the pair graph is filtered before preflight, and an
 *      unknown or malformed --pair value fails loud (same behavior class as
 *      an unknown flag), never a silent no-op.
 *
 *   2. `doctor` checked process.env only, reporting "OPENROUTER_API_KEY not
 *      set — LLM methods unavailable" while the engine happily read the key
 *      from .env.local — the very file the CLI's own missing-key box tells
 *      users to use. Now: doctor resolves every key via getEnvOrFileVar
 *      (process.env → .env.local → .env), same chain as the engine.
 *
 *   3. `audit` printed "All locale files are fully translated." (exit 0)
 *      when configured target locale files didn't exist — a CI gate wired
 *      per the README passed with zero translation done. Now: a missing
 *      configured locale file counts every source key as untranslated and
 *      audit exits 1; `verify` errors on the same hole.
 *
 * Run: node test/honesty-fixes.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

import { output } from '../lib/output.js';
import { resolvePairs, filterPairGraph } from '../lib/pairs.js';
import { run as runDoctor } from '../lib/commands/doctor.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champ-honesty-'));
}
function rm(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Run the real CLI binary; capture stdout/stderr/exit regardless of code. */
function runCLI(args, cwd, envOverride = {}) {
  const env = { ...process.env, ...envOverride };
  for (const [k, v] of Object.entries(envOverride)) {
    if (v === undefined) delete env[k];
  }
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
      cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], env,
    });
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', status: err.status ?? 1 };
  }
}

/** Parse NDJSON stdout and return the {level:'summary'} object (or null). */
function jsonSummary(stdout) {
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    if (obj.level === 'summary') return obj;
  }
  return null;
}

/** A four-locale project where only fr.json exists (fully translated). */
function writeMostlyMissingProject(dir) {
  fs.mkdirSync(path.join(dir, 'locales'));
  fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
    inputLocale: 'en',
    languages: ['fr', 'de', 'ja', 'pt'],
    defaultMethod: 'google-translate',
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'locales', 'en.json'),
    JSON.stringify({ greeting: 'Hello', farewell: 'Goodbye' }, null, 2));
  fs.writeFileSync(path.join(dir, 'locales', 'fr.json'),
    JSON.stringify({ greeting: 'Bonjour', farewell: 'Au revoir' }, null, 2));
}

// =================================================================
// 1. sync --pair — per-pair filtering, fail-loud on unknown pairs
// =================================================================

describe('honesty #1 — filterPairGraph (unit)', () => {
  function graph() {
    return resolvePairs({
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      resolvedLanguages: {
        'fr': { name: 'French' },
        'de': { name: 'German' },
        'pt-BR': { name: 'Brazilian Portuguese' },
      },
    });
  }

  it('selects a single canonical colon pair', () => {
    const filtered = filterPairGraph('en:fr', graph());
    assert.deepEqual([...filtered.keys()], ['en:fr']);
    assert.equal(filtered.get('en:fr').target, 'fr');
  });

  it('accepts a comma-separated list', () => {
    const filtered = filterPairGraph('en:fr, en:de', graph());
    assert.deepEqual([...filtered.keys()].sort(), ['en:de', 'en:fr']);
  });

  it('accepts the docs hyphen shorthand (en-fr → en:fr)', () => {
    const filtered = filterPairGraph('en-fr', graph());
    assert.deepEqual([...filtered.keys()], ['en:fr']);
  });

  it('resolves hyphen shorthand against hyphenated locale codes (en-pt-BR)', () => {
    const filtered = filterPairGraph('en-pt-BR', graph());
    assert.deepEqual([...filtered.keys()], ['en:pt-BR']);
  });

  it('accepts the leaderboard ">" separator', () => {
    const filtered = filterPairGraph('en>de', graph());
    assert.deepEqual([...filtered.keys()], ['en:de']);
  });

  it('throws loud on an unconfigured pair, listing configured pairs', () => {
    assert.throws(
      () => filterPairGraph('en:xx', graph()),
      (err) => {
        assert.match(err.message, /UNKNOWN PAIR/);
        assert.match(err.message, /en:xx/);
        assert.match(err.message, /en:de, en:fr, en:pt-BR/, 'must list the configured pairs');
        return true;
      }
    );
  });

  it('throws loud on a bare locale code (no pair separator)', () => {
    assert.throws(
      () => filterPairGraph('fr', graph()),
      /source:target/,
    );
  });

  it('never returns an empty selection for a non-empty flag', () => {
    // The money-trap inverse: filtering must select what was asked or throw —
    // silently syncing zero pairs is as dishonest as syncing all of them.
    const filtered = filterPairGraph('en:de', graph());
    assert.equal(filtered.size, 1);
  });
});

describe('honesty #1 — sync --pair (CLI e2e)', () => {
  let dir;
  beforeEach(() => {
    dir = tmp();
    fs.mkdirSync(path.join(dir, 'locales'));
    // google-translate: static documented pricing → the dry-run cost estimate
    // stays fully offline (no OpenRouter pricing fetch).
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      inputLocale: 'en',
      languages: ['fr', 'de', 'ja'],
      defaultMethod: 'google-translate',
    }, null, 2));
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'),
      JSON.stringify({ greeting: 'Hello', farewell: 'Goodbye' }, null, 2));
  });
  afterEach(() => rm(dir));

  it('--pair en:fr restricts the run to that pair (dry-run summary shows 1 locale)', () => {
    const { stdout, stderr, status } = runCLI(['sync', '--dry', '--json', '--pair', 'en:fr'], dir);
    assert.equal(status, 0, `expected clean dry-run; stderr=${stderr}`);
    const summary = jsonSummary(stdout);
    assert.ok(summary, 'sync --json must emit a summary object');
    assert.equal(summary.locales.length, 1, 'only the requested pair may be processed');
    assert.equal(summary.locales[0].pair, 'en:fr');
    // 2 source keys, fr.json absent → both keys pending for fr and ONLY fr.
    assert.equal(summary.totalProcessed, 2);
  });

  it('--pair with the docs hyphen form (en-fr) works end-to-end', () => {
    const { stdout, stderr, status } = runCLI(['sync', '--dry', '--json', '--pair', 'en-fr'], dir);
    assert.equal(status, 0, `expected clean dry-run; stderr=${stderr}`);
    const summary = jsonSummary(stdout);
    assert.equal(summary.locales.length, 1);
    assert.equal(summary.locales[0].pair, 'en:fr');
  });

  it('--pair naming an unconfigured pair fails loud with the configured list', () => {
    const { status, stderr } = runCLI(['sync', '--dry', '--pair', 'en:xx'], dir);
    assert.notEqual(status, 0, 'an unknown pair must not exit 0');
    assert.match(stderr, /UNKNOWN PAIR/);
    assert.match(stderr, /en:de, en:fr, en:ja/, 'error must list configured pairs');
  });

  it('--pair filters audit mode too', () => {
    // fr.json fully translated; de/ja missing. Auditing only en:fr must pass.
    fs.writeFileSync(path.join(dir, 'locales', 'fr.json'),
      JSON.stringify({ greeting: 'Bonjour', farewell: 'Au revoir' }, null, 2));
    const { status, stderr } = runCLI(['audit', '--pair', 'en:fr'], dir);
    assert.equal(status, 0, `audit scoped to a complete pair must pass; stderr=${stderr}`);
  });
});

// =================================================================
// 2. doctor reads API keys the way the engine does (.env.local/.env)
// =================================================================

describe('honesty #2 — doctor resolves keys via getEnvOrFileVar', () => {
  let dir, prevKey, origFetch, origLog, logLines;

  beforeEach(() => {
    dir = tmp();
    prevKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    // Keep the OpenRouter reachability probe offline and instant.
    origFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('offline (test)'); };
    origLog = console.log;
    logLines = [];
    console.log = (...args) => { logLines.push(args.join(' ')); };
  });

  afterEach(() => {
    console.log = origLog;
    globalThis.fetch = origFetch;
    output.setMode('default');
    if (prevKey !== undefined) process.env.OPENROUTER_API_KEY = prevKey;
    else delete process.env.OPENROUTER_API_KEY;
    rm(dir);
  });

  async function doctorMethodsResults(cwd) {
    const code = await runDoctor({ _: ['doctor', 'methods'], json: true }, cwd);
    const doc = JSON.parse(logLines.join('\n'));
    return { code, results: doc.results };
  }

  it('passes when the key lives only in .env.local (the engine-visible surface)', async () => {
    fs.writeFileSync(path.join(dir, '.env.local'), 'OPENROUTER_API_KEY=sk-or-v1-test-not-real\n');
    const { results } = await doctorMethodsResults(dir);
    const check = results.find(r => r.label === 'OpenRouter API key');
    assert.ok(check, 'doctor must report the OpenRouter key check');
    assert.equal(check.status, 'pass',
      `key in .env.local must not be reported missing; got ${JSON.stringify(check)}`);
    assert.match(check.detail, /\.env/, 'detail should say where the key was found');
  });

  it('passes when the key lives only in .env', async () => {
    fs.writeFileSync(path.join(dir, '.env'), 'OPENROUTER_API_KEY=sk-or-v1-test-not-real\n');
    const { results } = await doctorMethodsResults(dir);
    const check = results.find(r => r.label === 'OpenRouter API key');
    assert.equal(check.status, 'pass');
  });

  it('still warns when the key is nowhere, and says what was checked', async () => {
    const { results } = await doctorMethodsResults(dir);
    const check = results.find(r => r.label === 'OpenRouter API key');
    assert.equal(check.status, 'warn', 'a truly missing key must still warn');
    assert.match(check.detail, /\.env\.local/, 'warning must say .env files were checked too');
  });

  it('direct-provider keys (ANTHROPIC_API_KEY) are also read from .env.local', async () => {
    // The direct-provider loaders resolve via getEnvOrFileVar (direct-llm.js
    // _resolveApiKey) — doctor must agree with them, not with process.env.
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      fs.writeFileSync(path.join(dir, '.env.local'), 'ANTHROPIC_API_KEY=sk-ant-test-not-real\n');
      const { results } = await doctorMethodsResults(dir);
      const check = results.find(r => r.label === 'Anthropic');
      assert.ok(check, 'Anthropic key in .env.local must be reported as set');
      assert.equal(check.status, 'pass');
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});

// =================================================================
// 3. audit / verify fail loud when configured locale files are absent
// =================================================================

describe('honesty #3 — audit fails loud on missing configured locale files', () => {
  let dir;
  beforeEach(() => { dir = tmp(); writeMostlyMissingProject(dir); });
  afterEach(() => rm(dir));

  it('exits 1 and names the missing files (4-of-5-missing sim scenario)', () => {
    const { stdout, stderr, status } = runCLI(['audit'], dir);
    assert.equal(status, 1, 'audit must fail when configured locale files are absent');
    assert.ok(!stdout.includes('All locale files are fully translated'),
      'the false-green message must not appear');
    for (const f of ['de.json', 'ja.json', 'pt.json']) {
      assert.match(stderr, new RegExp(`${f}.*locale file missing`),
        `missing ${f} must be reported loudly`);
    }
    assert.match(stdout, /3 locale file\(s\) missing/);
  });

  it('--json summary carries missingLocales and counts their keys as untranslated', () => {
    const { stdout, status } = runCLI(['audit', '--json'], dir);
    assert.equal(status, 1);
    const summary = jsonSummary(stdout);
    assert.deepEqual(summary.missingLocales.sort(), ['de.json', 'ja.json', 'pt.json']);
    // 3 missing locales × 2 source keys — a missing file is 100% untranslated.
    assert.equal(summary.untranslatedCount, 6);
    const de = summary.locales.find(l => l.locale === 'de');
    assert.equal(de.missing, true);
    assert.equal(de.untranslatedCount, 2);
  });

  it('still passes (exit 0) when every configured locale file exists and is translated', () => {
    fs.writeFileSync(path.join(dir, 'locales', 'de.json'),
      JSON.stringify({ greeting: 'Hallo', farewell: 'Tschüss' }));
    fs.writeFileSync(path.join(dir, 'locales', 'ja.json'),
      JSON.stringify({ greeting: 'こんにちは', farewell: 'さようなら' }));
    fs.writeFileSync(path.join(dir, 'locales', 'pt.json'),
      JSON.stringify({ greeting: 'Olá', farewell: 'Adeus' }));
    const { stdout, stderr, status } = runCLI(['audit'], dir);
    assert.equal(status, 0, `complete project must pass; stderr=${stderr}`);
    assert.ok(stdout.includes('All locale files are fully translated'));
  });
});

describe('honesty #3 — verify errors on missing configured locale files', () => {
  let dir;
  beforeEach(() => { dir = tmp(); writeMostlyMissingProject(dir); });
  afterEach(() => rm(dir));

  it('exits 1 with a [VERIFY] error per missing configured locale', () => {
    const { stderr, status } = runCLI(['verify'], dir);
    assert.equal(status, 1, 'verify must fail when configured locale files are absent');
    for (const locale of ['de', 'ja', 'pt']) {
      assert.match(stderr, new RegExp(`\\[VERIFY\\] ${locale}: locale file missing`));
    }
  });

  it('passes once the configured files exist and are translated', () => {
    fs.writeFileSync(path.join(dir, 'locales', 'de.json'),
      JSON.stringify({ greeting: 'Hallo', farewell: 'Tschüss' }));
    fs.writeFileSync(path.join(dir, 'locales', 'ja.json'),
      JSON.stringify({ greeting: 'こんにちは', farewell: 'さようなら' }));
    fs.writeFileSync(path.join(dir, 'locales', 'pt.json'),
      JSON.stringify({ greeting: 'Olá', farewell: 'Adeus' }));
    const { stderr, status } = runCLI(['verify'], dir);
    assert.equal(status, 0, `complete project must verify clean; stderr=${stderr}`);
  });

  it('projects with no configured languages (auto-detect) are unaffected', () => {
    // No config file → nothing promised → dir-derived behavior unchanged.
    const bare = tmp();
    try {
      fs.mkdirSync(path.join(bare, 'locales'));
      fs.writeFileSync(path.join(bare, 'locales', 'en.json'), JSON.stringify({ a: 'A' }));
      const { status } = runCLI(['verify'], bare);
      assert.equal(status, 0);
    } finally {
      rm(bare);
    }
  });
});
