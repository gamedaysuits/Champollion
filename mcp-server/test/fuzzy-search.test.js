/**
 * search_languages 0.2.0 — exact first, then the closest names.
 *
 * The synthetic-user finding: the founder's own word for an Aeta/Ayta
 * language, "Atya", matched nothing — a dead end on the first call. These
 * tests pin the fallback on the REAL index (both the monorepo corpus and the
 * npm bundle's manifest) as well as on a fixture.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  editDistance, normalizeForMatch, findLanguages, searchLanguages, loadLanguageIndex,
  TRANSPOSITION_COST,
} from '../src/tools/languages.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BUNDLE = path.resolve(__dirname, '../../cli/shared/cards-fallback.json');

const FIXTURE = [
  { code: 'abp', name: 'Abellen Ayta', aliases: [] },
  { code: 'atp', name: 'Pudtol Atta', aliases: [] },
  { code: 'stj', name: 'Matya Samo', aliases: [] },
  { code: 'crk', name: 'Plains Cree', endonym: 'ᓀᐦᐃᔭᐍᐏᐣ', aliases: ['nêhiyawêwin'] },
  { code: 'csw', name: 'Swampy Cree', aliases: [] },
  { code: 'mus', name: 'Creek', aliases: [] },
  { code: 'yor', name: 'Yoruba', endonym: 'Èdè Yorùbá', aliases: ['yo'] },
];

describe('editDistance (restricted Damerau-Levenshtein)', () => {
  it('prices a swapped pair at half an edit', () => {
    assert.equal(editDistance('atya', 'ayta'), TRANSPOSITION_COST);
    assert.equal(editDistance('atya', 'atta'), 1);
    assert.equal(editDistance('kitten', 'sitting'), 3);
    assert.equal(editDistance('same', 'same'), 0);
  });
  it('gives up early past the budget', () => {
    assert.equal(editDistance('abcdef', 'uvwxyz', 2), Infinity);
    assert.equal(editDistance('a', 'abcd', 1), Infinity);
  });
});

describe('normalizeForMatch', () => {
  it('folds case, accents and punctuation', () => {
    assert.equal(normalizeForMatch('Èdè Yorùbá'), 'ede yoruba');
    assert.equal(normalizeForMatch('Mag-antsi Ayta'), 'mag antsi ayta');
    assert.equal(normalizeForMatch('nêhiyawêwin'), 'nehiyawewin');
  });
});

describe('findLanguages (fixture)', () => {
  it('exact hits never trigger the fuzzy pass', () => {
    const r = findLanguages(FIXTURE, 'crk');
    assert.equal(r.match, 'exact');
    assert.equal(r.results[0].code, 'crk');
  });

  it('a whole word outranks a prefix ("Cree" → Plains Cree before Creek)', () => {
    const codes = searchLanguages(FIXTURE, 'Cree').map((l) => l.code);
    assert.ok(codes.indexOf('crk') < codes.indexOf('mus'), codes.join(','));
  });

  it('accent-insensitive: "nehiyawewin" finds the alternate name', () => {
    assert.equal(findLanguages(FIXTURE, 'nehiyawewin').results[0].code, 'crk');
  });

  it('"Atya" — a substring only inside another word — falls through to the closest names', () => {
    const r = findLanguages(FIXTURE, 'Atya');
    assert.equal(r.match, 'fuzzy');
    assert.equal(r.fuzzy[0].lang.code, 'abp', 'the swapped-pair match ranks first');
    assert.equal(r.fuzzy[0].distance, TRANSPOSITION_COST);
    assert.ok(r.results.some((l) => l.code === 'stj'), 'the in-word substring hit is kept, not dropped');
  });

  it('a 3-letter non-code gets no fuzzy pass (codes are too dense)', () => {
    assert.equal(findLanguages(FIXTURE, 'qqq').match, 'none');
  });

  it('multi-word typos match word by word', () => {
    const r = findLanguages(FIXTURE, 'Plians Cree');
    assert.equal(r.match, 'fuzzy');
    assert.equal(r.results[0].code, 'crk');
  });
});

describe('findLanguages (the real indexes)', () => {
  for (const [label, opts] of [
    ['monorepo corpus', {}],
    ['npm bundle manifest', { repoDir: '/nonexistent/repo-cards', fallbackFile: BUNDLE }],
  ]) {
    it(`${label}: "Atya" surfaces the Ayta languages first`, async () => {
      const index = await loadLanguageIndex(opts);
      const r = findLanguages(index, 'Atya', 10);
      assert.equal(r.match, 'fuzzy');
      const first = r.results.slice(0, 6).map((l) => l.name);
      assert.ok(first.length === 6 && first.every((n) => /Ayta/.test(n)),
        `expected six Ayta languages first, got ${first.join(', ')}`);
    });

    it(`${label}: "Cree" surfaces crk and its relatives`, async () => {
      const index = await loadLanguageIndex(opts);
      const codes = findLanguages(index, 'Cree', 10).results.map((l) => l.code);
      for (const c of ['crk', 'cre', 'csw', 'cwd']) assert.ok(codes.includes(c), `${c} missing: ${codes}`);
    });

    it(`${label}: codes still resolve exactly`, async () => {
      const index = await loadLanguageIndex(opts);
      assert.equal(findLanguages(index, 'abp').results[0].code, 'abp');
    });
  }
});
