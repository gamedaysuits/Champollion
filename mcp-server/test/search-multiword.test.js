/**
 * search_languages: a query of several words that no name matches as a whole
 * is matched part by part.
 *
 * The finding (2026-10): "Plains Cree" found crk and "nêhiyawêwin" found cre —
 * but "Plains Cree nêhiyawêwin", the way a speaker names the language, found
 * nothing. The whole string is still tried first (exact, prefix, substring,
 * then the closest names); only when that finds nothing are its parts
 * matched: a recorded name all of whose words are in the query counts as one
 * match ("Plains Cree", never two loose words), candidates rank by how many
 * query words such names cover, and equal candidates are listed, never picked.
 *
 * Pinned on a fixture and on the REAL indexes (monorepo cards and the npm
 * bundle's manifest), read through the one adapter — no network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findLanguages, formatSearchAnswer, loadLanguageIndex, materializeLean } from '../src/tools/languages.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BUNDLE = path.resolve(__dirname, '../../cli/shared/cards-fallback.json');

const FIXTURE = [
  { code: 'cre', name: 'Cree', aliases: ['cr'], names: [{ text: 'nēhiyawēwin', field: 'endonym', source: 'src-w' }] },
  { code: 'crk', name: 'Plains Cree', endonym: 'ᓀᐦᐃᔭᐍᐏᐣ', aliases: [] },
  { code: 'csw', name: 'Swampy Cree', aliases: [] },
  { code: 'apk', name: 'Plains Apache', aliases: [] },
  { code: 'yor', name: 'Yoruba', endonym: 'Èdè Yorùbá', aliases: ['yo'] },
  { code: 'ibo', name: 'Igbo', aliases: ['ig'] },
];

describe('search by parts (fixture)', () => {
  it('a whole multi-word name in the query outranks one-word names and shared words', () => {
    const r = findLanguages(FIXTURE, 'Plains Cree nêhiyawêwin');
    assert.equal(r.match, 'partial');
    assert.deepEqual(r.results.map((l) => l.code), ['crk', 'cre', 'csw', 'apk']);
    assert.deepEqual(r.partial[0].matched.map((m) => m.text), ['Plains Cree'], '"Plains Cree" is ONE match');
    assert.equal(r.partial[0].covered, 2);
    assert.deepEqual(r.partial[1].matched.map((m) => m.text), ['Cree', 'nēhiyawēwin']);
    assert.deepEqual(r.partial[2].words, ['cree'], 'Swampy Cree only shares a word');
  });

  it('word order, case and diacritics are folded as the whole-string search folds them', () => {
    for (const q of ['nehiyawewin plains cree', 'NÊHIYAWÊWIN, Plains-Cree', 'cree plains nēhiyawēwin']) {
      assert.equal(findLanguages(FIXTURE, q).results[0].code, 'crk', q);
    }
  });

  it('a junk word does not hide a real name', () => {
    assert.equal(findLanguages(FIXTURE, 'Yoruba xyzzy').results[0].code, 'yor');
    assert.equal(findLanguages(FIXTURE, 'xyzzy Swampy Cree').results[0].code, 'csw');
    assert.equal(findLanguages(FIXTURE, 'qqqq xyzzy').match, 'none', 'nothing matching any part is still "none"');
  });

  it('the whole string still wins: names, codes, typos and single words answer as before', () => {
    assert.deepEqual([findLanguages(FIXTURE, 'Plains Cree').match, findLanguages(FIXTURE, 'Plains Cree').results[0].code], ['exact', 'crk']);
    assert.equal(findLanguages(FIXTURE, 'crk').match, 'exact');
    assert.equal(findLanguages(FIXTURE, 'Plians Cree').match, 'fuzzy', 'a typo of a whole name is still the closest name');
    assert.equal(findLanguages(FIXTURE, 'Plians Cree').results[0].code, 'crk');
    assert.equal(findLanguages(FIXTURE, 'xyzzy').match, 'none', 'one word never goes part by part');
  });

  it('equal candidates are listed, and the answer says so — never one picked', () => {
    const r = findLanguages(FIXTURE, 'Yoruba Igbo');
    assert.equal(r.match, 'partial');
    assert.deepEqual(r.results.map((l) => l.code).sort(), ['ibo', 'yor']);
    const text = formatSearchAnswer(r, 'Yoruba Igbo');
    assert.match(text, /^No language matches "Yoruba Igbo" as a whole/);
    assert.match(text, /2 languages match it equally\. get_language on each shows what its card cites; confirm the right one with the user\./);
    // Codes count like names.
    const codes = findLanguages(FIXTURE, 'yo ig');
    assert.deepEqual(codes.results.map((l) => l.code).sort(), ['ibo', 'yor']);
    assert.match(formatSearchAnswer(codes, 'yo ig'), /"yo" \(code\)/);
  });

  it('each line says what it matched: the name, a recorded name with its source, or a shared word', () => {
    const r = findLanguages(FIXTURE, 'Plains Cree nêhiyawêwin');
    const text = formatSearchAnswer(r, 'Plains Cree nêhiyawêwin');
    assert.match(text, /^crk {2}Plains Cree .*← "Plains Cree" — 2 of 3 words$/m);
    assert.match(text, /^cre {2}Cree .*← "Cree" \+ "nēhiyawēwin" \(endonym \[src-w\]\) — 2 of 3 words$/m);
    assert.match(text, /^csw {2}Swampy Cree .*← shares the word "cree" — 1 of 3 words$/m);
    assert.doesNotMatch(text, /match it equally/, 'crk is not tied with cre: its whole name covers two words');
  });
});

describe('search by parts (the real indexes)', () => {
  // Each index is loaded once for its tests (a load reads 8,685 cards).
  const loaded = new Map();
  const load = (opts) => {
    const k = JSON.stringify(opts);
    if (!loaded.has(k)) loaded.set(k, loadLanguageIndex(opts));
    return loaded.get(k);
  };
  for (const [label, opts] of [
    ['monorepo corpus', {}],
    ['npm bundle manifest', { repoDir: '/nonexistent/repo-cards', fallbackFile: BUNDLE }],
  ]) {
    it(`${label}: "Plains Cree nêhiyawêwin" → crk first, then cre with its endonym and members`, async () => {
      const index = await load(opts);
      const found = findLanguages(index, 'Plains Cree nêhiyawêwin', 10);
      assert.equal(found.match, 'partial');
      assert.deepEqual(found.results.slice(0, 2).map((l) => l.code), ['crk', 'cre']);
      const text = formatSearchAnswer(found, 'Plains Cree nêhiyawêwin', await materializeLean(found.results));
      const first = text.split('\n').find((l) => /^[a-z0-9]{3,8} {2}/.test(l));
      // Round 8: crk's own card records the endonym only as ᓀᐦᐃᔭᐍᐏᐣ; the
      // registered Cree converter's SRO reading covers the third word — and
      // the line says that spelling is champollion's derivation.
      assert.match(first, /^crk {2}Plains Cree .*← "Plains Cree" \+ "nêhiyawêwin" \(the SRO \(Standard Roman Orthography\) form of the card's Cree Syllabics endonym ᓀᐦᐃᔭᐍᐏᐣ, by champollion's script converter; no source on this card records this spelling \[champollion-derived from wikidata-[0-9a-z]+\]\) — 3 of 3 words$/);
      assert.match(text, /^cre {2}Cree .*"nēhiyawēwin" \(endonym \[wikidata-[0-9a-z]+\]\)/m);
      assert.match(text, /member languages: .*crk Plains Cree/);
    });

    it(`${label}: "nehiyawewin plains cree" (folded, reordered) → crk`, async () => {
      const index = await load(opts);
      assert.equal(findLanguages(index, 'nehiyawewin plains cree', 10).results[0].code, 'crk');
    });

    it(`${label}: a junk word beside a real name still finds the language`, async () => {
      const index = await load(opts);
      assert.equal(findLanguages(index, 'Yoruba xyzzy', 10).results[0].code, 'yor');
      assert.equal(findLanguages(index, 'Plains Cree qwxz', 10).results[0].code, 'crk');
    });

    it(`${label}: each part alone answers as before (the whole string wins)`, async () => {
      const index = await load(opts);
      const plains = findLanguages(index, 'Plains Cree', 10);
      assert.equal(plains.match, 'exact');
      assert.equal(plains.results[0].code, 'crk');
      const endonym = findLanguages(index, 'nêhiyawêwin', 10);
      assert.equal(endonym.match, 'exact');
      assert.equal(endonym.results[0].code, 'cre');
    });
  }

  it('a word hundreds of names share is reported as a tie that size — never one picked', async () => {
    const index = await load({});
    const found = findLanguages(index, 'xyzzy language', 3);
    assert.equal(found.match, 'partial');
    assert.ok(found.partialTied > 100, `premise: "language" is a word of many names (${found.partialTied})`);
    const text = formatSearchAnswer(found, 'xyzzy language', await materializeLean(found.results));
    assert.match(text, new RegExp(`${found.partialTied} languages match it equally \\(the first 3 are shown; a more specific query narrows them\\)`));
  });
});
