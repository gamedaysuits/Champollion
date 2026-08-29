/**
 * cost-report.test.js — honest cost preview + --max-cost cap + --batch-size flag.
 *
 * Covers the token-economy contract:
 *
 *   1. printCostEstimate runs WITHOUT an OPENROUTER_API_KEY — every engine
 *      gets a preview driven by its own estimateCost(). Methods that can't
 *      know their price report "unknown" (null), never $0.
 *   2. Content files appear in the estimate when contentDir is configured,
 *      counted from the same pending-work logic the real sync uses (a
 *      fully-synced tree estimates $0 content, so --max-cost can't falsely
 *      abort a no-op re-run) and clearly marked rough.
 *   3. --max-cost aborts BEFORE any API call (exit code 2) when the
 *      estimate exceeds the cap OR is unknowable — unknown ≠ free. Dry-runs
 *      are exempt (they make no API calls; the preview must stay reachable).
 *   4. --batch-size is a real registered flag (typos used to be silently
 *      swallowed and config.js's cliArgs.batchSize read was dead code),
 *      validated as a positive integer.
 *
 * Hermetic: pairs use google-translate (static pricing, no network) and the
 * plugin 'api' method (honest null pricing); globalThis.fetch is stubbed to
 * fail loudly in the runSync tests to PROVE no API call happens.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

import { printCostEstimate, parseMaxCost } from '../lib/cost-report.js';
import { resolveConfig } from '../lib/config.js';
import { runSync } from '../lib/sync.js';
import { computeExitCode } from '../lib/commands/sync.js';
import { loadTM, saveTM, storeTM, tmMethodKey } from '../lib/tm.js';
import { output } from '../lib/output.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-cost-'));
}

/** Build a minimal pair entry the way resolvePairs would. */
function pairEntry(target, method, extra = {}) {
  return [`en:${target}`, {
    source: 'en',
    target,
    method,
    model: null,
    batchSize: 30,
    name: target,
    register: 'Professional.',
    ...extra,
  }];
}

/** Minimal config object for printCostEstimate. */
function costConfig(dir, extra = {}) {
  return {
    localesDir: dir,
    fallbackPrefix: '[EN] ',
    forceKeys: [],
    contentDir: null,
    inputLocale: 'en',
    ...extra,
  };
}

// =================================================================
// parseMaxCost — flag validation
// =================================================================
describe('parseMaxCost', () => {
  it('returns null when the flag is not set', () => {
    assert.equal(parseMaxCost(undefined), null);
    assert.equal(parseMaxCost(null), null);
  });

  it('parses valid USD amounts (including 0 = "only if free")', () => {
    assert.equal(parseMaxCost('0.50'), 0.5);
    assert.equal(parseMaxCost('2'), 2);
    assert.equal(parseMaxCost('0'), 0);
  });

  it('throws loudly on malformed caps — a silently-ignored cap defeats the fail-safe', () => {
    assert.throws(() => parseMaxCost('abc'), /--max-cost must be a non-negative number/);
    assert.throws(() => parseMaxCost('-1'), /--max-cost must be a non-negative number/);
    assert.throws(() => parseMaxCost(''), /--max-cost must be a non-negative number/);
  });
});

// =================================================================
// printCostEstimate — every engine, no OpenRouter key gate
// =================================================================
describe('printCostEstimate (honest preview)', () => {
  let dir;
  let savedKey;

  beforeEach(() => {
    dir = makeTempDir();
    // The old code early-returned without this key — these tests run keyless
    // on purpose to prove the gate is gone.
    savedKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (savedKey !== undefined) process.env.OPENROUTER_API_KEY = savedKey;
  });

  function writeLocales(sourceKeys, targetKeys = {}) {
    fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify(sourceKeys));
    fs.writeFileSync(path.join(dir, 'fr.json'), JSON.stringify(targetKeys));
  }

  it('estimates google-translate pairs without any OPENROUTER_API_KEY', async () => {
    writeLocales({ a: 'Hello', b: 'World', c: 'Goodbye' });
    const sourceFlat = { a: 'Hello', b: 'World', c: 'Goodbye' };

    const estimate = await printCostEstimate(
      [pairEntry('fr', 'google-translate')],
      sourceFlat, costConfig(dir), 'json', '.json', [], { cwd: dir }
    );

    assert.ok(estimate, 'estimate must be returned, not gated on the OpenRouter key');
    assert.equal(estimate.pairs.length, 1);
    assert.equal(estimate.pairs[0].keys, 3);
    assert.ok(estimate.pairs[0].estimatedCost > 0, 'google has real documented pricing');
    assert.equal(estimate.hasUnknownCosts, false);
    assert.ok(estimate.totalEstimatedCost > 0);
    assert.equal(estimate.currency, 'USD');
  });

  it('reports unknown (null) for methods without pricing — never $0', async () => {
    writeLocales({ a: 'Hello' });
    const sourceFlat = { a: 'Hello' };

    const estimate = await printCostEstimate(
      [pairEntry('fr', 'api')],
      sourceFlat, costConfig(dir), 'json', '.json', [], { cwd: dir }
    );

    assert.ok(estimate);
    assert.equal(estimate.pairs.length, 1);
    assert.equal(estimate.pairs[0].estimatedCost, null, 'unknown must be null, not 0');
    assert.equal(estimate.hasUnknownCosts, true);
  });

  it('includes a rough content-files estimate when contentDir is configured', async () => {
    writeLocales({ a: 'Hello' });
    const contentDir = path.join(dir, 'content');
    fs.mkdirSync(path.join(contentDir, 'posts'), { recursive: true });
    fs.writeFileSync(
      path.join(contentDir, 'posts', 'hello.md'),
      '---\ntitle: Hi\n---\nSome body text for the estimate.\n'
    );

    const estimate = await printCostEstimate(
      [pairEntry('fr', 'google-translate')],
      { a: 'Hello' }, costConfig(dir, { contentDir }), 'json', '.json', [], { cwd: dir }
    );

    assert.ok(estimate.content, 'content line must be present when contentDir is set');
    assert.equal(estimate.content.rough, true, 'content estimate must be marked rough');
    assert.equal(estimate.content.files, 1);
    assert.equal(estimate.content.pendingTranslations, 1);
    assert.ok(estimate.content.estimatedCost > 0);
    assert.ok(
      estimate.totalEstimatedCost > estimate.keyCost,
      'content cost must be part of the total'
    );
  });

  it('counts only PENDING content work — an already-translated tree adds $0', async () => {
    writeLocales({ a: 'Hello' });
    const contentDir = path.join(dir, 'content');
    fs.mkdirSync(path.join(contentDir, 'posts'), { recursive: true });
    const srcPath = path.join(contentDir, 'posts', 'hello.md');
    fs.writeFileSync(srcPath, '---\ntitle: Hi\n---\nBody.\n');
    // Simulate a completed sync: target exists + manifest hash recorded.
    fs.writeFileSync(path.join(contentDir, 'posts', 'hello.fr.md'), '---\ntitle: Salut\n---\nCorps.\n');
    const crypto = await import('node:crypto');
    const hash = crypto.createHash('sha256').update(fs.readFileSync(srcPath, 'utf-8'), 'utf-8').digest('hex');
    fs.writeFileSync(
      path.join(dir, '.champollion-content.lock'),
      JSON.stringify({ 'posts/hello.md:fr': hash })
    );

    const estimate = await printCostEstimate(
      [pairEntry('fr', 'google-translate')],
      { a: 'Hello' }, costConfig(dir, { contentDir }), 'json', '.json', [], { cwd: dir }
    );

    assert.equal(estimate.content.pendingTranslations, 0, 'synced files must not be re-counted');
    assert.equal(estimate.content.estimatedCost, 0, 'no pending work → no content cost');
  });
});

// =================================================================
// printCostEstimate — TM-aware partition (2026-07-11 audit fix):
// keys the Translation Memory already covers are $0 cache hits in the
// real pipeline, so pricing them as fresh API calls made --max-cost
// abort nearly-free runs (recurring "untranslated" brand-name keys).
// =================================================================
describe('printCostEstimate (TM-aware partition)', () => {
  let dir;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** Seed the on-disk TM at `dir` with translations for the given pair. */
  function seedTM(pairConfig, entries) {
    const tm = loadTM(dir);
    const tmKey = tmMethodKey(pairConfig);
    for (const [sourceValue, translation] of entries) {
      storeTM(tm, sourceValue, pairConfig.target, tmKey, translation);
    }
    saveTM(dir, tm);
  }

  it('prices only TM misses — hits are reported separately at $0', async () => {
    const sourceFlat = { a: 'Alpha string', b: 'Beta string', c: 'Gamma string' };
    fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify(sourceFlat));
    fs.writeFileSync(path.join(dir, 'fr.json'), '{}');

    const [pairKey, pairConfig] = pairEntry('fr', 'google-translate');
    seedTM(pairConfig, [['Alpha string', 'Chaîne alpha'], ['Beta string', 'Chaîne bêta']]);

    const estimate = await printCostEstimate(
      [[pairKey, pairConfig]],
      sourceFlat, costConfig(dir), 'json', '.json', [], { cwd: dir }
    );

    assert.ok(estimate);
    assert.equal(estimate.pairs.length, 1);
    assert.equal(estimate.pairs[0].keys, 1, 'only the TM miss is billable');
    assert.equal(estimate.pairs[0].tmHits, 2, 'cached keys must be reported as TM hits');
    assert.ok(estimate.pairs[0].estimatedCost > 0, 'the one miss still costs money');

    // Control: the same tree with no TM must price all 3 keys.
    fs.rmSync(path.join(dir, '.champollion'), { recursive: true, force: true });
    const cold = await printCostEstimate(
      [[pairKey, pairConfig]],
      sourceFlat, costConfig(dir), 'json', '.json', [], { cwd: dir }
    );
    assert.equal(cold.pairs[0].keys, 3);
    assert.equal(cold.pairs[0].tmHits, 0);
    assert.ok(
      cold.pairs[0].estimatedCost > estimate.pairs[0].estimatedCost,
      'a cold TM must estimate strictly more than a warm one'
    );
  });

  it('a fully TM-covered pair is a KNOWN $0 — even on an unknown-pricing method', async () => {
    const sourceFlat = { a: 'Hello there' };
    fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify(sourceFlat));
    fs.writeFileSync(path.join(dir, 'fr.json'), '{}');

    // 'api' honestly reports null pricing — but zero API calls cost a
    // known $0 regardless, so this must NOT trip hasUnknownCosts (the
    // exact false-abort the audit flagged).
    const [pairKey, pairConfig] = pairEntry('fr', 'api');
    seedTM(pairConfig, [['Hello there', 'Bonjour à tous']]);

    const estimate = await printCostEstimate(
      [[pairKey, pairConfig]],
      sourceFlat, costConfig(dir), 'json', '.json', [], { cwd: dir }
    );

    assert.ok(estimate);
    assert.equal(estimate.pairs[0].keys, 0);
    assert.equal(estimate.pairs[0].tmHits, 1);
    assert.equal(estimate.pairs[0].estimatedCost, 0, 'fully cached = known $0, not unknown');
    assert.equal(estimate.pairs[0].source, 'translation-memory');
    assert.equal(estimate.hasUnknownCosts, false);
    assert.equal(estimate.totalEstimatedCost, 0);
  });

  it('respects a caller-provided tm object over the on-disk TM', async () => {
    const sourceFlat = { a: 'Hello there' };
    fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify(sourceFlat));
    fs.writeFileSync(path.join(dir, 'fr.json'), '{}');

    const [pairKey, pairConfig] = pairEntry('fr', 'google-translate');
    // On-disk TM has the key cached…
    seedTM(pairConfig, [['Hello there', 'Bonjour à tous']]);

    // …but the caller passes an EMPTY tm (what --no-tm does): everything
    // must price as a miss, mirroring the run that will ignore the cache.
    const estimate = await printCostEstimate(
      [[pairKey, pairConfig]],
      sourceFlat, costConfig(dir), 'json', '.json', [],
      { cwd: dir, tm: { _meta: { version: 1 } } }
    );

    assert.equal(estimate.pairs[0].keys, 1, '--no-tm estimates must ignore the disk TM');
    assert.equal(estimate.pairs[0].tmHits, 0);
  });
});

// =================================================================
// --max-cost — the pre-run spend cap (fail-safe: unknown ≠ free)
// =================================================================
describe('runSync --max-cost cap', () => {
  let dir;
  let savedGoogleKey;
  let savedOpenRouterKey;
  let originalFetch;
  let fetchCalls;

  beforeEach(() => {
    dir = makeTempDir();
    fs.mkdirSync(path.join(dir, 'locales'));
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ greeting: 'Hello world' }));
    fs.writeFileSync(path.join(dir, 'locales', 'fr.json'), '{}');

    savedGoogleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    savedOpenRouterKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';

    // PROOF that the abort happens before any API call: any fetch is a failure.
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      fetchCalls.push(String(url));
      throw new Error(`unexpected network call: ${url}`);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (savedGoogleKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = savedGoogleKey;
    if (savedOpenRouterKey !== undefined) process.env.OPENROUTER_API_KEY = savedOpenRouterKey;
    fs.rmSync(dir, { recursive: true, force: true });
    output.setMode('default');
  });

  it('aborts before any API call when the estimate exceeds the cap', async () => {
    const result = await runSync({
      cwd: dir,
      cliArgs: { dir: path.join(dir, 'locales'), method: 'google-translate', 'max-cost': '0.0000001' },
    });

    assert.equal(result.maxCostAborted, true);
    assert.ok(result.estimatedCost > 0, 'the abort must report the known estimate');
    assert.equal(result.maxCost, 0.0000001);
    assert.equal(result.totalProcessed, 0);
    assert.deepEqual(fetchCalls, [], 'NO API call may happen before the abort');
    assert.equal(computeExitCode(result), 2, 'a --max-cost abort maps to exit code 2');
  });

  it('aborts when the estimate is unknown — unknown is not free', async () => {
    const result = await runSync({
      cwd: dir,
      cliArgs: { dir: path.join(dir, 'locales'), method: 'api', 'max-cost': '100' },
    });

    assert.equal(result.maxCostAborted, true, 'an unknowable estimate under a cap must abort');
    assert.equal(result.estimatedCost, null);
    assert.deepEqual(fetchCalls, [], 'NO API call may happen before the abort');
    assert.equal(computeExitCode(result), 2);
  });

  it('does not abort a dry-run (no API calls to cap) and still reports the estimate', async () => {
    const result = await runSync({
      dryRun: true,
      cwd: dir,
      cliArgs: { dir: path.join(dir, 'locales'), method: 'google-translate', 'max-cost': '0.0000001' },
    });

    assert.ok(!result.maxCostAborted, 'dry-run must stay reachable under a cap');
    assert.equal(result.totalProcessed, 1, 'dry-run still reports pending work');
  });

  it('emits the cost estimate in the --json summary', async () => {
    const lines = [];
    const origLog = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    output.setMode('json');
    try {
      await runSync({
        dryRun: true,
        cwd: dir,
        cliArgs: { dir: path.join(dir, 'locales'), method: 'google-translate', json: true },
      });
    } finally {
      console.log = origLog;
      output.setMode('default');
    }

    const summary = lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .find(o => o && o.level === 'summary');
    assert.ok(summary, 'a summary object must be emitted');
    assert.ok(summary.costEstimate, 'the structured estimate must ride the --json summary');
    assert.equal(summary.costEstimate.currency, 'USD');
    assert.ok(summary.costEstimate.pairs.length >= 1);
    assert.ok(summary.costEstimate.pairs[0].estimatedCost > 0);
  });

  it('computeExitCode: maxCostAborted maps to 2 even with zero counts', () => {
    assert.equal(computeExitCode({ maxCostAborted: true, totalProcessed: 0, totalFailed: 0 }), 2);
  });

  it('recurring brand-name keys (untranslated-identical) are TM hits — a $0 cap proceeds API-free', async () => {
    // The 2026-07-11 audit scenario: a brand name translates to itself, so
    // diffLocale re-flags it as "untranslated" on EVERY sync. The estimate
    // used to price it as a fresh API call and abort a run that the TM
    // makes free.
    fs.writeFileSync(
      path.join(dir, 'locales', 'en.json'),
      JSON.stringify({ brand: 'Champollion Translate' })
    );

    // Run 1 (no cap): real pipeline. The mock echoes the brand back —
    // the quality gate accepts short-ASCII echoes — and the TM stores it.
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      const q = Array.isArray(body.q) ? body.q : [body.q];
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { translations: q.map(v => ({ translatedText: v })) } }),
      };
    };
    const first = await runSync({
      cwd: dir,
      cliArgs: { dir: path.join(dir, 'locales'), method: 'google-translate', 'no-verify': true },
    });
    assert.ok(!first.maxCostAborted);
    const frPath = path.join(dir, 'locales', 'fr.json');
    assert.equal(
      JSON.parse(fs.readFileSync(frPath, 'utf-8')).brand,
      'Champollion Translate',
      'run 1 must land the echoed brand translation'
    );

    // Run 2: the key re-flags as untranslated-identical, but it is a TM
    // hit — a $0 cap must let the run proceed with ZERO network calls.
    fetchCalls = [];
    globalThis.fetch = async (url) => {
      fetchCalls.push(String(url));
      throw new Error(`unexpected network call: ${url}`);
    };
    const second = await runSync({
      cwd: dir,
      cliArgs: { dir: path.join(dir, 'locales'), method: 'google-translate', 'max-cost': '0', 'no-verify': true },
    });
    assert.ok(!second.maxCostAborted, 'TM-covered work must clear a $0 cap');
    assert.deepEqual(fetchCalls, [], 'everything must be served from the TM');
  });
});

// =================================================================
// --max-cost on the Docusaurus path — used to abort unconditionally
// ("no estimator" ≠ free); now estimated (TM-aware) and enforced.
// =================================================================
describe('runSync --max-cost on the Docusaurus path', () => {
  let dir;
  let savedGoogleKey;
  let savedOpenRouterKey;
  let originalFetch;
  let fetchCalls;
  let origLog, origWarn, origErr, origWrite;

  beforeEach(() => {
    dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'docusaurus.config.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3,
      sourceLocale: 'en',
      localesDir: './i18n',
      pairs: { 'en:fr': { method: 'google-translate' } },
    }));
    fs.mkdirSync(path.join(dir, 'i18n', 'en'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'i18n', 'en', 'code.json'), JSON.stringify({
      'theme.title': { message: 'My Documentation Site', description: 'The site title' },
      'theme.tagline': { message: 'Docs for everyone', description: 'The tagline' },
    }));

    savedGoogleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    savedOpenRouterKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';

    // PROOF that a cap abort happens before any API call: any fetch fails.
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      fetchCalls.push(String(url));
      throw new Error(`unexpected network call: ${url}`);
    };

    // The Docusaurus path narrates via output.raw → console.log; silence it.
    origLog = console.log;
    origWarn = console.warn;
    origErr = console.error;
    origWrite = process.stdout.write;
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    process.stdout.write = () => true;
  });

  afterEach(() => {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
    process.stdout.write = origWrite;
    globalThis.fetch = originalFetch;
    if (savedGoogleKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = savedGoogleKey;
    if (savedOpenRouterKey !== undefined) process.env.OPENROUTER_API_KEY = savedOpenRouterKey;
    fs.rmSync(dir, { recursive: true, force: true });
    output.setMode('default');
  });

  function writeDocs() {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'docs', 'intro.md'),
      '---\ntitle: Introduction\n---\n# Welcome\n\nThe introduction body for the estimate.\n'
    );
  }

  it('estimates for real and aborts before any API call when over the cap', async () => {
    writeDocs();
    const result = await runSync({
      cwd: dir,
      cliArgs: { 'max-cost': '0.0000001' },
    });

    assert.equal(result.maxCostAborted, true);
    assert.ok(
      result.estimatedCost > 0,
      'the abort must carry a REAL estimate — the old path aborted with estimate=null unconditionally'
    );
    assert.deepEqual(fetchCalls, [], 'NO API call may happen before the abort');
    assert.ok(!fs.existsSync(path.join(dir, 'i18n', 'fr', 'code.json')), 'nothing may be written');
    assert.equal(computeExitCode(result), 2);
  });

  it('a cap abort with --force-content leaves the content lock intact', async () => {
    writeDocs();
    const lockPath = path.join(dir, '.champollion-content.lock');
    fs.writeFileSync(lockPath, JSON.stringify({ 'docusaurus:docs/intro.md:fr': 'somehash' }) + '\n');

    const result = await runSync({
      cwd: dir,
      cliArgs: { 'force-content': true, 'max-cost': '0.0000001' },
    });

    assert.equal(result.maxCostAborted, true);
    assert.ok(
      fs.existsSync(lockPath),
      'the lock must survive a cost abort — deleting it first would queue a full re-translation as a side effect'
    );
  });

  it('does not abort a dry-run (no API calls to cap)', async () => {
    const result = await runSync({
      cwd: dir,
      dryRun: true,
      cliArgs: { dry: true, 'max-cost': '0.0000001' },
    });

    assert.ok(!(result && result.maxCostAborted), 'dry-run must stay reachable under a cap');
    assert.deepEqual(fetchCalls, []);
  });

  it('TM-covered Docusaurus JSON keys clear a $0 cap and rebuild from cache, API-free', async () => {
    // Run 1 (no cap): populate the TM through the real pipeline.
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      const q = Array.isArray(body.q) ? body.q : [body.q];
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { translations: q.map(v => ({ translatedText: `FR ${v}` })) } }),
      };
    };
    await runSync({ cwd: dir, cliArgs: {} });
    const frCode = path.join(dir, 'i18n', 'fr', 'code.json');
    assert.ok(fs.existsSync(frCode), 'run 1 must write fr/code.json');

    // Wipe the target tree — every key re-flags as missing, but the TM
    // still covers all of them.
    fs.rmSync(path.join(dir, 'i18n', 'fr'), { recursive: true, force: true });

    // Run 2: a $0 cap must pass and the tree must rebuild from the TM.
    fetchCalls = [];
    globalThis.fetch = async (url) => {
      fetchCalls.push(String(url));
      throw new Error(`unexpected network call: ${url}`);
    };
    const second = await runSync({ cwd: dir, cliArgs: { 'max-cost': '0' } });

    assert.ok(!(second && second.maxCostAborted), 'TM-covered Docusaurus work must clear a $0 cap');
    assert.deepEqual(fetchCalls, [], 'everything must be served from the TM');
    assert.ok(fs.existsSync(frCode), 'fr/code.json rebuilt from the TM');
    const fr = JSON.parse(fs.readFileSync(frCode, 'utf-8'));
    assert.equal(fr['theme.title'].message, 'FR My Documentation Site');
  });
});

// =================================================================
// --batch-size — registered flag, validated, wired to config
// =================================================================
describe('--batch-size flag', () => {
  it('resolveConfig honors --batch-size (kebab from CLI) and batchSize (camelCase programmatic)', () => {
    const dir = makeTempDir();
    try {
      assert.equal(resolveConfig({ 'batch-size': '10' }, dir).batchSize, 10);
      assert.equal(resolveConfig({ batchSize: '15' }, dir).batchSize, 15);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects non-positive and non-numeric batch sizes loudly', () => {
    const dir = makeTempDir();
    try {
      assert.throws(() => resolveConfig({ 'batch-size': '0' }, dir), /--batch-size must be a positive integer/);
      assert.throws(() => resolveConfig({ 'batch-size': '-5' }, dir), /--batch-size must be a positive integer/);
      assert.throws(() => resolveConfig({ 'batch-size': 'abc' }, dir), /--batch-size must be a positive integer/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the real CLI accepts --batch-size and --max-cost (no "Unknown option")', () => {
    const dir = makeTempDir();
    try {
      // en.json only — no targets, so the command returns before any
      // translation work. We only assert flag REGISTRATION here.
      fs.mkdirSync(path.join(dir, 'locales'));
      fs.writeFileSync(path.join(dir, 'locales', 'en.json'), '{"a":"A"}');

      let res;
      try {
        const stdout = execFileSync(
          process.execPath,
          [CLI_PATH, 'sync', '--dry', '--batch-size', '10', '--max-cost', '0.5', '--dir', path.join(dir, 'locales')],
          { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        res = { stdout, stderr: '', status: 0 };
      } catch (err) {
        res = { stdout: err.stdout || '', stderr: err.stderr || '', status: err.status || 1 };
      }

      assert.equal(res.status, 0, `expected clean exit, got ${res.status}: ${res.stderr}`);
      assert.ok(!`${res.stdout}${res.stderr}`.includes('Unknown option'), 'both flags must be registered');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
