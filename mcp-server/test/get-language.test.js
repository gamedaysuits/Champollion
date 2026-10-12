/**
 * get_language — the cited card, resolved the way the CLI resolves it.
 *
 * Two layers:
 *   - the REAL monorepo card for crk (repo mode, through the installed
 *     champollion package's own registry), so a card-shape change breaks
 *     this suite the day it lands — the lesson of the "[object Object]"
 *     weeks;
 *   - an injected champollion double for packaged mode, so the bundled →
 *     cache → fetched ladder, the fetch failure, and the not-found path are
 *     pinned without network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getLanguage, formatLanguage, summarizeCard } from '../src/tools/language-card.js';
import { loadLanguageIndex } from '../src/tools/languages.js';

/** A remote-projection card (the shape buildCardFromRemote produces). */
const REMOTE_ABP = {
  code: 'abp',
  name: 'Abellen Ayta',
  nativeName: null,
  iso639_3: 'abp',
  glottocode: 'aben1249',
  macroarea: 'Papunesia',
  isoType: 'L',
  scripts: [{ name: 'Latn', source: 'linguameta-x' }],
  dir: 'ltr',
  classification: {
    family: 'Austronesian',
    familyAttributions: [{ value: 'Austronesian', source: 'glottolog-v5.3' }],
    ancestry: ['Austronesian', 'Malayo-Polynesian', 'Sambalic'],
  },
  vitality: { unescoStatus: 'vulnerable', assessedBy: 'elcat-v2024.1' },
  speakerEstimates: [
    { count: '1000-9999', source: 'elcat-v2024.1', note: '(SIL) [Date Of Info: 2008]' },
    { count: 3000, source: 'linguameta-x' },
  ],
  methodSupport: {},
  countries: ['PH'],
  _remote: { source: 'supabase', updatedAt: '2026-09-27T09:08:54Z' },
};

function packagedDouble({ prefetch = 'fetched', card = REMOTE_ABP } = {}) {
  const calls = { prefetch: 0, sync: 0 };
  return {
    calls,
    pkg: {
      getCardSourceInfo: () => ({ mode: 'packaged' }),
      resolveCode: (c) => (c === 'ayta' ? 'abp' : c),
      prefetchLanguageCards: async (codes) => {
        calls.prefetch += 1;
        const r = { fetched: [], missing: [], failed: [], skipped: [] };
        r[prefetch].push(...codes);
        return r;
      },
      getLanguageCard: (c) => {
        calls.sync += 1;
        return prefetch === 'failed' || prefetch === 'missing' ? null : (c === card.code ? card : null);
      },
      normalizeCard: (c) => c,
    },
  };
}

const INDEX = [
  { code: 'abp', name: 'Abellen Ayta', aliases: [], lean: true },
  { code: 'abc', name: 'Ambala Ayta', aliases: [], lean: true },
  { code: 'crk', name: 'Plains Cree', aliases: [], lean: false },
];

describe('get_language — packaged mode (injected champollion)', () => {
  it('fetches a long-tail card through the CLI\'s ASYNC prefetch and says so', async () => {
    const { pkg, calls } = packagedDouble();
    const r = await getLanguage('abp', { champollion: pkg, index: INDEX });
    assert.equal(r.status, 'ok');
    assert.equal(r.tier, 'remote');
    assert.equal(calls.prefetch, 1, 'the async prefetch ran (never the blocking child-process fetch first)');
    const text = formatLanguage(r);
    assert.match(text, /fetched just now from champollion\.dev's published card tables/);
    assert.match(text, /Family: Austronesian \[glottolog-v5\.3\]/);
    assert.match(text, /1000-9999 \(?.*\[elcat-v2024\.1\]/);
    assert.match(text, /sources differ/);
    assert.match(text, /not in the PUBLISHED card projection/, 'absence is qualified by tier');
    assert.doesNotMatch(text, /\[object Object\]/);
    assert.doesNotMatch(text, /undefined/);
  });

  it('a cached card reads as the cache tier', async () => {
    const { pkg } = packagedDouble({ prefetch: 'skipped' });
    const r = await getLanguage('abp', { champollion: pkg, index: INDEX });
    assert.equal(r.tier, 'cache');
  });

  it('a network failure is an actionable fetch-failed, not "no such language"', async () => {
    const { pkg } = packagedDouble({ prefetch: 'failed' });
    const r = await getLanguage('abp', { champollion: pkg, index: INDEX });
    assert.equal(r.status, 'fetch-failed');
    assert.match(r.note, /Retry/);
  });

  it('a misspelled name returns the closest codes', async () => {
    const { pkg } = packagedDouble();
    const r = await getLanguage('Atya', { champollion: pkg, index: INDEX });
    assert.equal(r.status, 'not-found');
    assert.ok(r.suggestions.some((s) => s.code === 'abp'));
    assert.match(r.note, /Closest names/);
  });

  it('an exact name resolves to its code', async () => {
    const { pkg } = packagedDouble();
    const r = await getLanguage('Abellen Ayta', { champollion: pkg, index: INDEX });
    assert.equal(r.status, 'ok');
    assert.match(r.resolvedFrom, /name "Abellen Ayta" → abp/);
  });

  it('a missing champollion package is an install instruction', async () => {
    const r = await getLanguage('crk', { champollion: null });
    assert.equal(r.status, 'unavailable');
    assert.match(r.note, /npm install champollion|champollion-mcp-server/);
  });
});

describe('summarizeCard — never zip, never elect', () => {
  it('keeps scripts and scriptNames apart (they are sorted independently)', () => {
    const s = summarizeCard({ code: 'crk', name: 'Plains Cree', scripts: ['Cans', 'Latn'], scriptNames: ['Latin', 'Unified Canadian Aboriginal Syllabics'] });
    const text = formatLanguage({ status: 'ok', summary: s, tierNote: 't', absenceNote: 'a' });
    assert.match(text, /Scripts: Cans, Latn \(names: Latin, Unified Canadian Aboriginal Syllabics\)/);
    assert.doesNotMatch(text, /Cans \(Latin\)/);
  });

  it('lists every family claim when taxonomies disagree', () => {
    const s = summarizeCard({
      code: 'x', name: 'X',
      classification: { family: { agreement: 'conflicting', values: [{ value: 'Atlantic-Congo', source: 'glottolog' }, { value: 'Niger-Congo', source: 'wals' }] } },
    });
    assert.deepEqual(s.family.map((f) => f.value), ['Atlantic-Congo', 'Niger-Congo']);
    const text = formatLanguage({ status: 'ok', summary: s, tierNote: 't', absenceNote: 'a' });
    assert.match(text, /taxonomies differ/);
  });
});

describe('get_language — the real monorepo card (repo mode)', () => {
  it('crk: cited speakers, endangerment, FSTs, and no raw envelopes', async (t) => {
    const index = await loadLanguageIndex();
    const r = await getLanguage('crk', { index });
    if (r.status === 'unavailable') { t.skip('champollion package not resolvable here'); return; }
    assert.equal(r.status, 'ok');
    const text = formatLanguage(r);
    assert.match(text, /# Plains Cree \(crk\)/);
    assert.match(text, /FSTs \/ morphological analyzers/);
    assert.match(text, /\[elcat-v2024\.1\]/);
    assert.doesNotMatch(text, /\[object Object\]/);
    assert.doesNotMatch(text, /"agreement"/, 'no attribution envelope leaks as JSON');
  });

  it('uppercase codes and 2-letter aliases resolve like the CLI', async (t) => {
    const index = await loadLanguageIndex();
    const upper = await getLanguage('CRK', { index });
    if (upper.status === 'unavailable') { t.skip('champollion package not resolvable here'); return; }
    assert.equal(upper.code, 'crk');
    const fr = await getLanguage('fr', { index });
    assert.equal(fr.code, 'fra');
  });
});

describe('catalogued by name, no published card', () => {
  it('get_language says so; language_overview still answers', async () => {
    const { pkg } = packagedDouble({ prefetch: 'missing' });
    const r = await getLanguage('abc', { champollion: pkg, index: INDEX });
    assert.equal(r.status, 'not-found');
    assert.match(r.note, /in the catalogue by name, but champollion\.dev publishes no card/);
    const { languageOverview, formatOverview } = await import('../src/tools/overview.js');
    const o = await languageOverview({ code: 'abc' }, {
      champollion: pkg, index: INDEX,
      corpora: async () => ({ items: [], total: 0, hiddenQuarantined: 0, source: 'test' }),
      results: async () => [],
      contests: async () => ({ contests: [], total: 0 }),
      recommend: null,
    });
    assert.equal(o.status, 'ok');
    const text = formatOverview(o);
    assert.match(text, /# Ambala Ayta \(abc\)/);
    assert.match(text, /catalogued by name only/);
    assert.match(text, /NEXT STEPS/);
  });
});
