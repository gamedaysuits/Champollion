#!/usr/bin/env node
/**
 * Recovery from a bad version: `sync --force` and self-healing caches.
 *
 * THE ADOPTION FINDING THIS ENCODES (curtisforbes.com, upgrading to 0.3.0):
 *   Damage written by older pipelines never self-heals. A poisoned key's
 *   manifest hash matches the current source, so sync considers it settled
 *   forever — the gates that would refuse to WRITE the damage today never
 *   see it again. And the TM had cached the bad outputs, so a manual
 *   --force-keys pass served the poison right back until --no-tm.
 *
 * THE MODEL:
 *   - `sync --force` re-queues every source key (scope with --pair) — the
 *     whole-locale rebuild that previously required deleting the file.
 *   - TM hits are validated against the CURRENT gates before serving —
 *     at requeue time in the key-value lane (existing evict-on-gate-fail),
 *     and now at READ time in the content lanes (lookupTMValidated), so a
 *     cache entry stored before a gate existed cannot outlive it.
 *   - `integrity`/`verify` detect on-disk hollowed values and name the
 *     exact rebuild command, so upgraders find the damage before users do.
 *
 * Run: node --test test/force-and-heal.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { runSync } from '../lib/sync.js';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { output } from '../lib/output.js';
import {
  loadTM, saveTM, storeTM, lookupTM, lookupTMValidated, tmMethodKey,
} from '../lib/tm.js';
import { findHollowedValues } from '../lib/integrity.js';
import { checkContentPreservation } from '../lib/validate.js';
import { runContentSync } from '../lib/sync.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

// The production damage shape: source hollowed to punctuation + remnants.
const HOLLOW_SOURCE = 'low-resource nmt · tokenizers · nêhiyawêwin';
const HOLLOW_VALUE = '   ·   · êhiêi';

// -----------------------------------------------------------------
// lookupTMValidated
// -----------------------------------------------------------------
describe('lookupTMValidated — the cache cannot outlive the gate', () => {
  it('serves a valid hit, evicts and misses on an invalid one', () => {
    const tm = { _meta: { version: 1 } };
    storeTM(tm, 'Hello there', 'fr', 'llm', 'Bonjour à tous');
    storeTM(tm, HOLLOW_SOURCE, 'fr', 'llm', HOLLOW_VALUE);

    const isValid = (src, cached) => !checkContentPreservation(src, cached);

    assert.equal(
      lookupTMValidated(tm, 'Hello there', 'fr', 'llm', isValid),
      'Bonjour à tous',
      'clean entries serve normally',
    );
    assert.equal(
      lookupTMValidated(tm, HOLLOW_SOURCE, 'fr', 'llm', isValid),
      null,
      'a hit failing the current gate reports as a miss',
    );
    assert.equal(
      lookupTM(tm, HOLLOW_SOURCE, 'fr', 'llm'),
      null,
      'and the poisoned entry is EVICTED — not re-served next lookup',
    );
  });
});

// -----------------------------------------------------------------
// findHollowedValues — on-disk damage detection
// -----------------------------------------------------------------
describe('findHollowedValues', () => {
  it('finds the production damage shape on disk', () => {
    const findings = findHollowedValues(
      { tagline: HOLLOW_SOURCE, ok: 'Getting started' },
      { tagline: HOLLOW_VALUE, ok: '入门' },
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].key, 'tagline');
  });

  it('never flags terse CJK, echoes, or no-translate keys', () => {
    const noTranslate = { active: true, matches: (k) => k === 'brand' };
    const findings = findHollowedValues(
      { zh: 'Frequently asked questions', echo: 'Champollion CLI Reference', brand: 'A long brand sentence here' },
      { zh: '常见问题', echo: 'Champollion CLI Reference', brand: 'A l  ' },
      noTranslate,
    );
    assert.deepEqual(findings, []);
  });
});

// -----------------------------------------------------------------
// sync --force + healing, hermetic (stubbed fetch, google-translate)
// -----------------------------------------------------------------
describe('sync --force — whole-locale rebuild that heals a poisoned cache', () => {
  let dir;
  let localesDir;
  let originalFetch;
  let savedGoogleKey;
  let savedOpenRouterKey;
  let requestedTexts;
  let origWrite;

  const EN = { greeting: 'Hello there', tagline: HOLLOW_SOURCE, title: 'The archive' };
  const GOOD = {
    'Hello there': 'Bonjour à tous',
    [HOLLOW_SOURCE]: 'tal vasi nomu · outil · langue',
    'The archive': 'Les archives',
  };

  const readLocale = (code) => JSON.parse(fs.readFileSync(path.join(localesDir, `${code}.json`), 'utf-8'));

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-force-'));
    localesDir = path.join(dir, 'locales');
    fs.mkdirSync(localesDir);
    fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify(EN, null, 2));
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './locales',
      defaultMethod: 'google-translate', languages: ['fr', 'de'],
    }, null, 2));

    savedGoogleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    savedOpenRouterKey = process.env.OPENROUTER_API_KEY;
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-key';
    delete process.env.OPENROUTER_API_KEY;

    requestedTexts = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      requestedTexts.push(...body.q);
      return {
        ok: true, status: 200,
        json: async () => ({
          data: { translations: body.q.map(t => ({ translatedText: GOOD[t] ?? `${body.target}(${t})` })) },
        }),
      };
    };

    output.setMode('quiet');
    origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.stdout.write = origWrite;
    output.setMode('default');
    if (savedGoogleKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = savedGoogleKey;
    if (savedOpenRouterKey !== undefined) process.env.OPENROUTER_API_KEY = savedOpenRouterKey;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('re-queues every key, and --pair scopes the rebuild', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(requestedTexts.length, 6, 'baseline: 3 keys × 2 locales');

    // A settled project syncs to zero work…
    requestedTexts = [];
    const settled = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(settled.totalProcessed, 0);

    // …but --force --pair rebuilds exactly the scoped locale. The TM would
    // serve these free, so bypass it to observe the requeue reach the API.
    requestedTexts = [];
    const forced = await runSync({ cwd: dir, cliArgs: { 'no-verify': true, force: true, pair: 'en:fr', 'no-tm': true } });
    assert.equal(forced.totalProcessed, 3, 'every key of the scoped pair re-queued');
    assert.deepEqual([...requestedTexts].sort(), Object.keys(GOOD).sort().map(k => k), );
    assert.equal(requestedTexts.length, 3, 'de untouched — --pair scopes the rebuild');
  });

  it('heals a poisoned key-value TM through --force alone — no --no-tm needed', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });

    // Poison the state the way an old version did: hollowed value on disk
    // AND cached in the TM, manifest already settled.
    const fr = readLocale('fr');
    fr.tagline = HOLLOW_VALUE;
    fs.writeFileSync(path.join(localesDir, 'fr.json'), JSON.stringify(fr, null, 2));
    const tm = loadTM(dir);
    // The TM key is the FULL method key (method|model|register|coaching) —
    // derive it from the same resolved pair the sync will use, or the seeded
    // poison lands under a key the pipeline never reads.
    const pairMethodKey = tmMethodKey(resolvePairs(resolveConfig({}, dir)).get('en:fr'));
    storeTM(tm, HOLLOW_SOURCE, 'fr', pairMethodKey, HOLLOW_VALUE);
    saveTM(dir, tm);

    // A plain sync does NOT touch it — the manifest says settled. This is
    // the "old damage never self-heals" finding, pinned.
    requestedTexts = [];
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(readLocale('fr').tagline, HOLLOW_VALUE, 'plain sync leaves old damage in place');

    // --force requeues; the poisoned TM hit fails the CURRENT gate, is
    // evicted, and the key is re-billed — the fresh value lands.
    requestedTexts = [];
    const healed = await runSync({ cwd: dir, cliArgs: { 'no-verify': true, force: true, pair: 'en:fr' } });
    assert.equal(readLocale('fr').tagline, GOOD[HOLLOW_SOURCE], 'rebuild replaced the damage');
    assert.ok(requestedTexts.includes(HOLLOW_SOURCE), 'the poisoned key was re-billed, not cache-served');
    assert.equal(healed.totalFailed, 0);
    assert.equal(
      lookupTM(loadTM(dir), HOLLOW_SOURCE, 'fr', pairMethodKey),
      GOOD[HOLLOW_SOURCE],
      'the TM now holds the good value',
    );
  });

  it('the cost estimate prices the full rebuild, so --max-cost can cap it', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    const capped = await runSync({
      cwd: dir,
      cliArgs: { 'no-verify': true, force: true, 'no-tm': true, 'max-cost': '0' },
    });
    assert.equal(capped.maxCostAborted, true, 'a forced rebuild must not sneak under a $0 cap');
  });
});

// -----------------------------------------------------------------
// Content lane: poisoned cache entries are evicted at read time
// -----------------------------------------------------------------
describe('content lane — TM hits are validated before serving', () => {
  let dir;
  let originalFetch;
  let savedKeys = {};
  let origWrite;
  let requested;

  const FM_SOURCE = 'A guide to low-resource machine translation';
  const PAIR = {
    source: 'en', target: 'fr', method: 'google-translate', name: 'French',
    register: 'Standard.', batchSize: 30,
  };
  const pairs = () => new Map([['en:fr', PAIR]]);
  // Seeds must live under the SAME full method key the lane computes.
  const PAIR_TM_KEY = tmMethodKey(PAIR);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-cheal-'));
    // Hugo convention: guide.md is the source; the target is guide.fr.md
    // beside it (file-suffix, not locale directories).
    fs.mkdirSync(path.join(dir, 'content'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'content', 'guide.md'),
      `---\ntitle: ${FM_SOURCE}\n---\n\nBody text stays put.\n`);

    for (const k of ['GOOGLE_TRANSLATE_API_KEY', 'OPENROUTER_API_KEY']) savedKeys[k] = process.env[k];
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-key';
    delete process.env.OPENROUTER_API_KEY;

    requested = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      requested.push(...body.q);
      return {
        ok: true, status: 200,
        json: async () => ({
          data: { translations: body.q.map(t => ({ translatedText: `FR(${t})` })) },
        }),
      };
    };

    output.setMode('quiet');
    origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.stdout.write = origWrite;
    output.setMode('default');
    for (const [k, v] of Object.entries(savedKeys)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('a hollowed cached front-matter value is evicted and re-billed, not re-served', async () => {
    // Seed the TM the way a gateless pipeline left it: hollowed title cached.
    const tm = loadTM(dir);
    storeTM(tm, FM_SOURCE, 'fr', PAIR_TM_KEY, '   -   ');
    saveTM(dir, tm);

    await runContentSync({
      contentDir: path.join(dir, 'content'),
      sourceLocale: 'en',
      pairs: pairs(),
      translatableFields: null,
      apiKey: null,
      dryRun: false,
      cwd: dir,
    });

    assert.ok(requested.includes(FM_SOURCE), 'poisoned hit re-billed instead of served');
    const written = fs.readFileSync(path.join(dir, 'content', 'guide.fr.md'), 'utf-8');
    assert.match(written, /FR\(A guide to low-resource machine translation\)/, 'fresh translation written');
    assert.equal(
      lookupTM(loadTM(dir), FM_SOURCE, 'fr', PAIR_TM_KEY),
      `FR(${FM_SOURCE})`,
      'the cache now holds the good value',
    );
  });

  it('a clean cached value still serves free — validation must not tax the healthy path', async () => {
    const tm = loadTM(dir);
    storeTM(tm, FM_SOURCE, 'fr', PAIR_TM_KEY, 'Un guide de la traduction automatique');
    storeTM(tm, 'Body text stays put.', 'fr', PAIR_TM_KEY, 'Le corps du texte reste.');
    saveTM(dir, tm);

    await runContentSync({
      contentDir: path.join(dir, 'content'),
      sourceLocale: 'en',
      pairs: pairs(),
      translatableFields: null,
      apiKey: null,
      dryRun: false,
      cwd: dir,
    });

    assert.deepEqual(requested, [], 'fully cached file makes zero API calls');
    const written = fs.readFileSync(path.join(dir, 'content', 'guide.fr.md'), 'utf-8');
    assert.match(written, /Un guide de la traduction automatique/);
  });
});

// -----------------------------------------------------------------
// integrity CLI: on-disk hollowed values fail the build, naming the fix
// -----------------------------------------------------------------
describe('integrity — old hollowed damage is found and the rebuild named', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-hollow-int-'));
    fs.mkdirSync(path.join(dir, 'locales'));
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'),
      JSON.stringify({ tagline: HOLLOW_SOURCE, greeting: 'Hello there' }, null, 2));
    fs.writeFileSync(path.join(dir, 'locales', 'fr.json'),
      JSON.stringify({ tagline: HOLLOW_VALUE, greeting: 'Bonjour à tous' }, null, 2));
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './locales', languages: ['fr'],
    }, null, 2));
  });

  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const runCLI = (args) => {
    try {
      const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
        cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { stdout, status: 0 };
    } catch (err) {
      return { stdout: err.stdout || '', status: err.status ?? 1 };
    }
  };

  it('exits 1 on a hollowed value and prints the rebuild command', () => {
    const res = runCLI(['integrity']);
    assert.equal(res.status, 1);
    assert.match(res.stdout, /HOLLOWED VALUES/);
    assert.match(res.stdout, /--force/);
  });

  it('goes green once the value is repaired — not vacuous', () => {
    const fr = { tagline: 'tal vasi nomu · outil · langue', greeting: 'Bonjour à tous' };
    fs.writeFileSync(path.join(dir, 'locales', 'fr.json'), JSON.stringify(fr, null, 2));
    const res = runCLI(['integrity']);
    assert.equal(res.status, 0, res.stdout);
  });
});
