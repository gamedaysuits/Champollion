/**
 * Dynamic card loading — packaged-mode fallback bundle, per-user
 * cache, Supabase fetch + reconstruction, and staleness refresh.
 *
 * The card registry reads its environment at import time, so this
 * file sets the overrides FIRST and then dynamic-imports the modules
 * under test (node --test runs each test file in its own process, so
 * this never leaks into other test files).
 *
 * Network calls go to a mock Supabase running in a SEPARATE process
 * (test/fixtures/mock-supabase-server.mjs): the registry's
 * synchronous fetch path blocks this process with execFileSync, so an
 * in-process mock would deadlock. These tests never touch the real
 * project.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const REAL_CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const FALLBACK_FILE = path.join(CLI_ROOT, 'shared', 'cards-fallback.json');

// ── Environment overrides (before any lib/cards import) ───────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-card-fetch-'));
const CACHE_DIR = path.join(TMP, 'cache');
const MISSING_CARDS_DIR = path.join(TMP, 'no-cards-here'); // never created

process.env.CHAMPOLLION_CARDS_DIR = MISSING_CARDS_DIR;
process.env.CHAMPOLLION_CARDS_CACHE_DIR = CACHE_DIR;
process.env.CHAMPOLLION_SUPABASE_ANON_KEY = 'test-key';
// CHAMPOLLION_SUPABASE_URL is set once the mock server reports its port.

// ── Mock Supabase control plane ────────────────────────────────────

let mockProc;
let mockBase;

async function mockSet(code, { index, detail }) {
  const res = await fetch(`${mockBase}/__mock/rows`, {
    method: 'POST',
    body: JSON.stringify({ code, index, detail }),
  });
  assert.equal(res.status, 200);
}

async function mockFail(fail500) {
  const res = await fetch(`${mockBase}/__mock/fail`, {
    method: 'POST',
    body: JSON.stringify({ fail500 }),
  });
  assert.equal(res.status, 200);
}

async function mockRequestCount() {
  const res = await fetch(`${mockBase}/__mock/requests`);
  return (await res.json()).length;
}

function makeIndexRow(code, overrides = {}) {
  return {
    code,
    name: `Testlang ${code}`,
    native_name: null,
    family: 'Testic',
    genus: 'Test',
    macroarea: 'Papunesia',
    is_isolate: false,
    speakers: '1K',
    speaker_count: 1000,
    script: 'Latn',
    script_name: 'Latin',
    scripts: [{ name: 'Latin', source: 'test' }],
    dir: 'ltr',
    dialect_count: null,
    regions: [],
    ancestry: [],
    glottocode: null,
    cultural_aphorism: null,
    updated_at: '2026-06-12T00:00:00.000+00:00',
    ...overrides,
  };
}

function makeDetailRow(code, detailOverrides = {}, updatedAt = '2026-06-12T00:00:00.000+00:00') {
  return {
    code,
    updated_at: updatedAt,
    detail: {
      classification: { family: 'Testic', ancestry: ['Testic'] },
      formality: { system: 'T-V', source: 'test-wals', description: 'test' },
      methodSupport: { llm: true },
      countries: ['NZ'],
      coordinates: { lat: 0, lng: 0 },
      glottocode: null,
      ...detailOverrides,
    },
  };
}

let registers; // lazy-imported module under test

before(async () => {
  mockProc = spawn(
    process.execPath,
    [path.join(__dirname, 'fixtures', 'mock-supabase-server.mjs')],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const port = await new Promise((resolve, reject) => {
    let buf = '';
    mockProc.stdout.on('data', chunk => {
      buf += chunk;
      const line = buf.split('\n')[0];
      if (line) resolve(line.trim());
    });
    mockProc.on('error', reject);
    mockProc.on('exit', code => reject(new Error(`mock server exited early (${code})`)));
  });
  mockBase = `http://127.0.0.1:${port}`;
  process.env.CHAMPOLLION_SUPABASE_URL = mockBase;
  registers = await import('../lib/registers.js');
});

after(() => {
  mockProc?.kill();
  fs.rmSync(TMP, { recursive: true, force: true });
});

// ── The bundled fallback artifact ──────────────────────────────────

describe('cards-fallback.json (bundled artifact)', () => {
  const bundle = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8'));

  it('contains core cards, parents, and a full manifest', () => {
    assert.ok(bundle._meta.coreCount >= 150, 'core set should cover ISO 639-1 languages');
    assert.ok(bundle._meta.parentCount >= 30, 'all genera ship');
    assert.ok(bundle._meta.manifestCount > 7000, 'manifest covers the catalogue');
  });

  it('bundles the i18n majors, flagship languages, and conlangs', () => {
    for (const code of ['eng', 'fra', 'deu', 'jpn', 'cmn', 'crk', 'srp', 'x-pirate', 'fra-CA']) {
      assert.ok(bundle.cards[code], `expected ${code} in bundled cards`);
    }
  });

  it('resolves every bundled extends target locally', () => {
    for (const card of Object.values(bundle.cards)) {
      if (card.extends) {
        assert.ok(
          bundle.parents[card.extends] || bundle.cards[card.extends],
          `${card.code} extends ${card.extends} which is not bundled`,
        );
      }
    }
  });

  it('manifest entries carry names and aliases', () => {
    assert.equal(bundle.manifest.fra.a.includes('fr'), true);
    assert.ok(bundle.manifest.aaa.n, 'long-tail languages have names in the manifest');
  });

  it('is fresh relative to shared/language-cards/ (CI gate)', { skip: !fs.existsSync(REAL_CARDS_DIR) }, () => {
    const result = spawnSync(
      process.execPath,
      [path.join(CLI_ROOT, 'scripts', 'build-cards-fallback.mjs'), '--check'],
      { encoding: 'utf-8' },
    );
    assert.equal(result.status, 0, `stale fallback bundle:\n${result.stderr}`);
  });
});

// ── Packaged-mode registry (bundle + manifest) ─────────────────────

describe('packaged-mode registry', () => {
  it('loads in packaged mode with the bundled core set', () => {
    const info = registers.getCardSourceInfo();
    assert.equal(info.mode, 'packaged');
    assert.ok(info.loadedCards >= 150);
    assert.ok(info.manifestEntries > 7000);
  });

  it('serves bundled cards offline, each card standing on its own', () => {
    const crk = registers.getLanguageCard('crk');
    assert.equal(crk.name, 'Plains Cree');
    assert.equal(crk.script, 'Cans');
    // No inheritance to resolve: the atlas projects every value onto the card
    // that asserts it, so nothing is fetched from a parent at read time.
    assert.equal(crk.extends, undefined, 'a bundled card resolves without a parent chain');
  });

  it('keeps the politeness FACT, our LABEL, and a METHOD capability apart', () => {
    // This used to assert `crk.formality` truthy, inherited from a
    // genus-cree hub card. That hub asserted, in uncited prose, a formality
    // system for a language whose two cited sources BOTH say it has no
    // politeness distinction — config contradicting fact, and invisible
    // because the card showed only the config.
    //
    // Three distinct things wore the name "formality". They are now separate,
    // and this test holds them apart:
    //
    //   1. THE FACT — does the language grammaticalise politeness? Cited to
    //      Grambank GB415 / WALS 45A, lives on the card.
    //   2. OUR LABEL AND PROMPTS — "T-V", "keigo", and the text we send an
    //      LLM. Authored by us, no source asserts it, lives in
    //      shared/catalogue/register-presets.json and never on a card.
    //   3. A METHOD CAPABILITY — whether DeepL accepts a formality argument
    //      for this language. A property of the SERVICE, keyed by
    //      (method, language), and read from method coverage.
    const deu = registers.getLanguageCard('deu');
    assert.ok(deu.politenessDistinction, 'the fact is on the card, cited');
    assert.equal(deu.formality?.system, 'T-V', 'our label comes from the preset config');

    const crk = registers.getLanguageCard('crk');
    assert.ok(crk.politenessDistinction, 'the fact is on the card here too');
    const crkValues = (crk.politenessDistinction.values ?? []).map((v) => v.value);
    assert.ok(crkValues.some((v) => /^(0|No politeness)/.test(String(v))),
      'both sources record no politeness distinction for Plains Cree');
    assert.equal(crk.formality ?? null, null,
      'no register system is invented for a language the sources say has none');

    // The capability is the method's, and it is answered per method.
    const deuSupport = deu.methodSupport?.deepl;
    if (deuSupport) {
      assert.equal(typeof deuSupport.formality, 'boolean',
        'DeepL formality support is a method capability, stated as such');
    }
  });

  it('resolves aliases and manifest-only codes', () => {
    assert.equal(registers.resolveCode('fr'), 'fra');
    assert.equal(registers.resolveCode('de-AT'), 'deu');
    // not bundled, known via manifest:
    assert.equal(registers.resolveCode('aaa'), 'aaa');
  });

  it('rejects path-traversal-shaped codes without fetching', () => {
    assert.equal(registers.getLanguageCard('../../etc/passwd'), null);
    assert.equal(registers.getLanguageCard('a/b'), null);
  });
});

// ── Remote fetch, cache, reconstruction ────────────────────────────

describe('remote fetch + cache', () => {
  it('fetches a missing card synchronously, reconstructs it, and caches it', async () => {
    await mockSet('aaa', {
      index: makeIndexRow('aaa', { name: 'Ghotuo', macroarea: 'Africa' }),
      detail: makeDetailRow('aaa'),
    });

    const card = registers.getLanguageCard('aaa');
    assert.ok(card, 'sync fetch returned a card');
    assert.equal(card.name, 'Ghotuo');
    assert.equal(card.macroarea, 'Africa');
    assert.equal(card.code, 'aaa');
    assert.deepEqual(card.methodSupport, { llm: true });

    // registers derived from formality, same templates as the card build
    assert.ok(card.registers.formal);
    assert.ok(card.registers.informal);
    assert.match(card.registers.formal.source, /derived-from-formality \(test-wals\)/);
    assert.equal(registers.getRegister('aaa', 'informal'), card.registers.informal.prompt);

    // provenance marker + cache entry on disk
    assert.equal(card._remote.source, 'supabase');
    const entry = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'aaa.json'), 'utf-8'));
    assert.equal(entry.code, 'aaa');
    assert.equal(entry.card.name, 'Ghotuo');
    assert.equal(entry.updatedAt, '2026-06-12T00:00:00.000+00:00');
  });

  it('counts cached cards in getAllLanguageCodes (no manifest fetch storm)', () => {
    const codes = registers.getAllLanguageCodes();
    assert.ok(codes.includes('aaa'), 'cached card listed');
    assert.ok(codes.includes('eng'), 'bundled card listed');

    // The invariant is "list what this install HAS, never what the catalogue
    // KNOWS OF" — enumerating the manifest would claim ~16k cards we would
    // then have to fetch one by one.
    //
    // This used to be spelled `codes.length < 1000`, a stand-in for that
    // invariant which quietly stopped testing it: the bundle grew from 322
    // core cards to 1,157 when locale deltas were added, so the number broke
    // while the property it stood for still held. Asserted directly now, so
    // the bundle can grow without the test lying in either direction.
    const info = registers.getCardSourceInfo();
    assert.ok(codes.length < info.manifestEntries,
      'the listing is the cards we hold, not the whole catalogue');
    assert.ok(!codes.includes('aab'),
      'a code known only from the manifest is not listed as one we hold');
  });

  it('tombstones codes prod does not have (one attempt per process)', async () => {
    const before = await mockRequestCount();
    assert.equal(registers.getLanguageCard('zzj'), null); // valid-shaped, not in mock
    const afterFirst = await mockRequestCount();
    assert.ok(afterFirst > before, 'first lookup hits the network');
    assert.equal(registers.getLanguageCard('zzj'), null);
    assert.equal(await mockRequestCount(), afterFirst, 'second lookup is memoized');

    const state = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, '_state.json'), 'utf-8'));
    assert.ok(state.missing.zzj, 'tombstone persisted for other processes');
  });

  it('prefetchLanguageCards warms the cache in batch', async () => {
    await mockSet('aab', { index: makeIndexRow('aab'), detail: makeDetailRow('aab') });
    await mockSet('aac', { index: makeIndexRow('aac'), detail: makeDetailRow('aac') });

    const result = await registers.prefetchLanguageCards(['aab', 'aac', 'aaa', 'zzz-not-real']);
    assert.deepEqual(result.fetched.sort(), ['aab', 'aac']);
    assert.ok(result.skipped.includes('aaa'), 'already-cached codes are skipped');
    assert.ok(fs.existsSync(path.join(CACHE_DIR, 'aab.json')));
    assert.equal(registers.getLanguageCard('aab').name, 'Testlang aab');
  });

  it('records a network-failure backoff instead of throwing', async () => {
    await mockFail(true);
    try {
      assert.equal(registers.getLanguageCard('aad'), null);
      const state = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, '_state.json'), 'utf-8'));
      assert.ok(state.backoffUntil, 'backoff stamp written');
      assert.ok(Date.parse(state.backoffUntil) > Date.now());
    } finally {
      await mockFail(false);
    }
  });
});

// ── Reconstruction unit behavior ───────────────────────────────────

describe('buildCardFromRemote', () => {
  it('maps index + detail onto card fields and derives registers', async () => {
    const { buildCardFromRemote } = await import('../lib/cards/remote.js');
    const card = buildCardFromRemote(
      makeIndexRow('xyz', { native_name: 'Xyzish', dir: 'rtl' }),
      makeDetailRow('xyz', { formality: { system: 'none', source: 'grambank-GB415' } }),
      { aliases: ['xy'] },
    );
    assert.equal(card.nativeName, 'Xyzish');
    assert.equal(card.dir, 'rtl');
    assert.deepEqual(card.aliases, ['xy']);
    assert.equal(card.rules, null, 'rules stay null — never fabricated');
    assert.equal(card.gender, null);
    assert.ok(card.registers.standard, "'none' system derives the standard register");
    assert.equal(card.formality.default, 'standard');
  });

  it('survives a missing detail row (index-only reconstruction)', async () => {
    const { buildCardFromRemote } = await import('../lib/cards/remote.js');
    const card = buildCardFromRemote(makeIndexRow('xyy'), null);
    assert.equal(card.name, 'Testlang xyy');
    assert.equal(card.registers, null);
    assert.equal(card.formality, undefined);
  });
});

// ── Staleness refresh ──────────────────────────────────────────────

describe('maybeRefreshCardCache', () => {
  it('initializes the server-time cursor on first run', async () => {
    const { maybeRefreshCardCache } = await import('../lib/cards/refresh.js');
    const result = await maybeRefreshCardCache({ force: true });
    assert.deepEqual(result, { checked: 0, invalidated: 0 });
    const state = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, '_state.json'), 'utf-8'));
    assert.ok(state.updatedCursor, 'cursor initialized from server max updated_at');
  });

  it('invalidates cached entries whose upstream updated_at moved', async () => {
    const { maybeRefreshCardCache } = await import('../lib/cards/refresh.js');

    // aab gets updated upstream after it was cached
    const newer = '2026-06-13T09:00:00.000+00:00';
    await mockSet('aab', {
      index: makeIndexRow('aab', { updated_at: newer }),
      detail: makeDetailRow('aab', {}, newer),
    });

    assert.ok(fs.existsSync(path.join(CACHE_DIR, 'aab.json')), 'precondition: aab cached');
    const result = await maybeRefreshCardCache({ force: true });
    assert.ok(result.checked >= 1, `expected changed rows, got ${JSON.stringify(result)}`);
    assert.equal(result.invalidated, 1, 'exactly the stale aab entry dropped');
    assert.ok(!fs.existsSync(path.join(CACHE_DIR, 'aab.json')), 'stale entry deleted');
    assert.ok(fs.existsSync(path.join(CACHE_DIR, 'aaa.json')), 'fresh entries kept');

    const state = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, '_state.json'), 'utf-8'));
    assert.equal(state.updatedCursor, newer, 'cursor advanced to max server updated_at');
    assert.ok(!state.missing.aab, 'tombstones cleared for changed codes');
  });

  it('is TTL-gated outside of force mode', async () => {
    const { maybeRefreshCardCache } = await import('../lib/cards/refresh.js');
    const result = await maybeRefreshCardCache();
    assert.equal(result.skipped, 'fresh');
  });
});

// ── Fresh-process scenarios (subprocess) ───────────────────────────

describe('packaged mode across processes', () => {
  const subEnv = (extra = {}) => ({
    ...process.env,
    CHAMPOLLION_CARDS_DIR: MISSING_CARDS_DIR,
    CHAMPOLLION_CARDS_CACHE_DIR: CACHE_DIR,
    ...extra,
  });

  const run = (snippet, extra) =>
    execFileSync(process.execPath, ['--input-type=module', '-e', snippet], {
      encoding: 'utf-8',
      cwd: CLI_ROOT,
      env: subEnv(extra),
    });

  it('serves previously cached cards offline in a new process', () => {
    const out = run(`
      import { getLanguageCard, getCardSourceInfo } from './lib/registers.js';
      const card = getLanguageCard('aaa');
      console.log(JSON.stringify({ mode: getCardSourceInfo().mode, name: card?.name }));
    `, { CHAMPOLLION_OFFLINE: '1' });
    assert.deepEqual(JSON.parse(out.trim()), { mode: 'packaged', name: 'Ghotuo' });
  });

  it('returns null for uncached long-tail codes when offline (no hang, no crash)', () => {
    const out = run(`
      import { getLanguageCard, getRegister } from './lib/registers.js';
      console.log(JSON.stringify({
        missing: getLanguageCard('abq'),
        register: getRegister('abq'),
      }));
    `, { CHAMPOLLION_OFFLINE: '1' });
    assert.deepEqual(JSON.parse(out.trim()), { missing: null, register: 'Professional register.' });
  });
});
