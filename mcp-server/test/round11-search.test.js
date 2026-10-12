/**
 * Round 11 synthetic personas, search_languages (2026-10-04).
 *
 *   3.  researcher: "North Sami" offered only North Fali (fll, distance 2);
 *       Northern Sami (sme, distance 3) was not listed. sme's card names it
 *       "Northern Sami" (ISO 639-3 + LinguaMeta) and records no "North Sami"
 *       or "North Saami" — so no alias is invented. Instead, in the fuzzy
 *       pass a query word may BEGIN a longer word of a name ("north" of
 *       "northern"): it costs no edit, needs at least one other word close in
 *       its own right, ranks after a name matched as typed at the same
 *       distance, and the line says which word began which.
 *       Alternate names (ISO 639-3) reach matching through the adapter in
 *       every index source that carries them. The npm bundle's name-only
 *       manifest did not carry them (pinned as a todo in Round 11); since
 *       Round 12 it carries every name a card records — other registries'
 *       names, endonyms, alternate names — each with its source, and a
 *       name-only result found through one says which and cites it.
 *  16.  hospital: since Round 10 a location the card cannot cite is hidden, and
 *       in an npm install every Ayta candidate for "Atya" read "where: not
 *       shown" — the published card projection, uploaded before it carried
 *       per-field sources (0cc42e0c5), cites none. Each such line now links
 *       the language's Glottolog record by the glottocode its card carries (a
 *       pointer to the source, not a claim) and says the per-field sources
 *       arrive with the tables' next upload — only where that is the reason.
 *
 * Published-projection fixtures are built by the CLI's own reader
 * (buildCardFromRemote) from the REAL monorepo cards, shaped as rows uploaded
 * before 0cc42e0c5 (no _fieldSources) and after it (with them). No network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  findLanguages, loadLanguageIndex, materializeLean, formatSearchAnswer,
  glottologRecordUrl, publishedCarriesFieldSources, uncitedReason, WORD_START_MIN,
  manifestSearchNames, normalizeForMatch,
} from '../src/tools/languages.js';
import { getLanguage, formatLanguage } from '../src/tools/language-card.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = path.resolve(__dirname, '../../cli');
const CARDS = path.join(CLI, 'shared/language-cards');
const BUNDLE = path.join(CLI, 'shared/cards-fallback.json');
const reader = await import(pathToFileURL(path.join(CLI, 'lib/cards/reader.js')).href);
const { buildCardFromRemote } = await import(pathToFileURL(path.join(CLI, 'lib/cards/remote.js')).href);
const { foldForSearch } = await import(pathToFileURL(path.join(CLI, 'lib/cards/search-names.js')).href);

const NPM = { repoDir: '/nonexistent/repo-cards', fallbackFile: BUNDLE };
const loaded = new Map();
const load = (opts = {}) => {
  const k = JSON.stringify(opts);
  if (!loaded.has(k)) loaded.set(k, loadLanguageIndex(opts));
  return loaded.get(k);
};

/** The result line for a code, and the indented line under it. */
function block(text, code) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${code}  `));
  return i < 0 ? null : { head: lines[i], detail: lines[i + 1]?.startsWith('     ') ? lines[i + 1].trim() : null };
}

// -- 3. North Sami ---------------------------------------------------------------

describe('3. "North Sami" / "North Saami" / "Northern Sami" find Northern Sami (sme)', () => {
  for (const [label, opts] of [['monorepo corpus', {}], ['npm bundle', NPM]]) {
    it(`${label}: "North Sami" → sme first, on its cited name, the word-start said on the line`, async () => {
      const index = await load(opts);
      const found = findLanguages(index, 'North Sami', 10);
      assert.equal(found.match, 'fuzzy');
      assert.equal(found.results[0].code, 'sme', found.results.map((l) => l.code).join(','));
      assert.deepEqual(found.fuzzy[0].starts, [{ query: 'north', word: 'northern' }]);
      assert.equal(found.fuzzy[0].distance, 0);
      assert.ok(found.results.some((l) => l.code === 'fll'), 'North Fali is still offered, after it');
      const text = formatSearchAnswer(found, 'North Sami');
      assert.match(block(text, 'sme').head,
        /← "Northern Sami" — "north" begins its word "northern"; the other word at distance 0$/);
      assert.match(text, /a query word that only begins a longer word of the name \("north" of "northern"\) counts no edit/);
    });

    it(`${label}: "North Saami" → sme first (one edit on "saami")`, async () => {
      const found = findLanguages(await load(opts), 'North Saami', 10);
      assert.equal(found.results[0].code, 'sme', found.results.map((l) => l.code).join(','));
      assert.equal(found.fuzzy[0].distance, 1);
      assert.match(block(formatSearchAnswer(found, 'North Saami'), 'sme').head,
        /"north" begins its word "northern"; the other word at distance 1$/);
    });

    it(`${label}: "Northern Sami" is still an exact match`, async () => {
      const found = findLanguages(await load(opts), 'Northern Sami', 10);
      assert.equal(found.match, 'exact');
      assert.equal(found.results[0].code, 'sme');
    });
  }

  it('the evidence is the name the card cites — no alias is invented', async () => {
    const sme = (await load()).find((l) => l.code === 'sme');
    assert.equal(sme.name, 'Northern Sami');
    assert.ok(sme.names.some((n) => n.text === 'Northern Sami' && /^iso639-3-/.test(n.source)),
      'ISO 639-3 names it Northern Sami');
    const every = [sme.name, sme.endonym, ...sme.aliases, ...sme.names.map((n) => n.text)].map((s) => s.toLowerCase());
    assert.ok(!every.includes('north sami') && !every.includes('north saami'),
      'the card records neither spelling as a name; none is added');
  });

  const FIX = [
    { code: 'aaa', name: 'Northern Testlanq', aliases: [] },
    { code: 'bbb', name: 'North Testlanx', aliases: [] },
    { code: 'ccc', name: 'Northern Testlang', aliases: [] },
    { code: 'crk', name: 'Plains Cree', aliases: [] },
  ];

  it('at equal edits a name matched as typed outranks a word only begun', () => {
    // "North Testlanz": bbb is one edit as typed; aaa is one edit + "north" begun.
    const r = findLanguages(FIX, 'North Testlanz', 10);
    assert.deepEqual(r.fuzzy.slice(0, 2).map((h) => [h.lang.code, h.distance, h.starts.length]),
      [['bbb', 1, 0], ['aaa', 1, 1]]);
  });

  it('fewer edits outrank a word begun: "North Testlang" → ccc (0 edits) before bbb (1 edit as typed)', () => {
    const r = findLanguages(FIX, 'North Testlang', 10);
    assert.equal(r.fuzzy[0].lang.code, 'ccc');
    assert.deepEqual(r.fuzzy[0].starts, [{ query: 'north', word: 'northern' }]);
    assert.equal(r.fuzzy[1].lang.code, 'bbb');
  });

  it('a word begun is never the only evidence: every query word only begun matches nothing', () => {
    const r = findLanguages([{ code: 'ccc', name: 'Northern Testlang', aliases: [] }], 'Nort Testl', 10);
    assert.ok(!r.results.some((l) => l.code === 'ccc'), JSON.stringify(r.fuzzy));
  });

  it(`a word under ${WORD_START_MIN} letters never stands for a longer one`, () => {
    const r = findLanguages([{ code: 'ccc', name: 'Northern Testlang', aliases: [] }], 'Nor Testlang', 10);
    assert.ok(!(r.fuzzy ?? []).some((h) => h.starts?.length), JSON.stringify(r.fuzzy));
  });

  it('a single word never takes the word-start path (the substring tiers already cover it)', () => {
    const r = findLanguages([{ code: 'ccc', name: 'Northern Testlang', aliases: [] }], 'Northe', 10);
    assert.ok(!(r.fuzzy ?? []).some((h) => h.starts?.length));
  });

  it('matches the search made before keep their distance and order', () => {
    const r = findLanguages(FIX, 'Plians Cree', 10);
    assert.equal(r.results[0].code, 'crk');
    assert.equal(r.fuzzy[0].distance, 0.5);
    assert.deepEqual(r.fuzzy[0].starts, []);
    assert.doesNotMatch(formatSearchAnswer(r, 'Plians Cree'), /begins its word|only begins/);
  });
});

// -- 3. alternate names reach matching through the adapter -------------------------

describe('3. alternate names (ISO 639-3) are searchable in every index source that carries them', () => {
  it('monorepo corpus: "Montagnais" → moe (Innu), the name shown with its source', async () => {
    const found = findLanguages(await load(), 'Montagnais', 10);
    assert.equal(found.match, 'exact');
    assert.equal(found.results[0].code, 'moe');
    assert.match(block(formatSearchAnswer(found, 'Montagnais'), 'moe').detail,
      /also called: Montagnais \[iso639-3-\d+\]/);
  });

  it('npm bundle, a bundled card: "Dene Suline" → chp (Chipewyan), cited', async () => {
    const found = findLanguages(await load(NPM), 'Dene Suline', 10);
    assert.equal(found.match, 'exact');
    assert.equal(found.results[0].code, 'chp');
    assert.match(block(formatSearchAnswer(found, 'Dene Suline'), 'chp').detail,
      /also called: Dene Suline \[iso639-3-\d+\]/);
  });

  it('npm bundle, a name-only entry: "Montagnais" → moe, how it matched said and cited', async () => {
    const found = findLanguages(await load(NPM), 'Montagnais', 10);
    assert.equal(found.match, 'exact');
    assert.equal(found.results[0]?.code, 'moe');
    assert.ok(found.results[0].lean, 'premise: moe is name-only in the bundle');
    assert.match(block(formatSearchAnswer(found, 'Montagnais'), 'moe').head,
      /^moe {2}Innu {2}— name-only entry .*← matched its alternate name "Montagnais" \[iso639-3-\d+\]$/);
  });

  it('npm bundle, a name-only entry: an endonym ("innu-aimun") and another registry\'s name ("Musar"), cited', async () => {
    let found = findLanguages(await load(NPM), 'Innu Aimun', 10);
    assert.equal(found.results[0]?.code, 'moe');
    assert.match(block(formatSearchAnswer(found, 'Innu Aimun'), 'moe').head,
      /← matched its endonym "innu-aimun" \[linguameta-[0-9a-f]+, wikidata-[0-9a-z]+\]$/,
      'two sources record that spelling; both are cited');
    found = findLanguages(await load(NPM), 'Musar', 10);
    assert.equal(found.results[0]?.code, 'mmi');
    assert.match(block(formatSearchAnswer(found, 'Musar'), 'mmi').head,
      /← matched its name in another registry "Musar" \[linguameta-[0-9a-f]+\]$/);
  });

  it('npm bundle, a misspelt alternate name: the fuzzy line cites the name it is close to', async () => {
    const found = findLanguages(await load(NPM), 'Montagnai', 10);
    assert.equal(found.match, 'fuzzy');
    assert.equal(found.results[0]?.code, 'moe');
    assert.match(block(formatSearchAnswer(found, 'Montagnai'), 'moe').head,
      /← "Montagnais" \(alternate name \[iso639-3-\d+\]\), distance 1$/);
  });

  it('the bundle finds moe by each recorded name the repo corpus finds it by', async () => {
    for (const q of ['Montagnais', 'innu-aimun', 'Innu Aimun', 'Innu']) {
      const repo = findLanguages(await load(), q, 10).results.map((l) => l.code);
      const npm = findLanguages(await load(NPM), q, 10).results.map((l) => l.code);
      assert.ok(repo.includes('moe') && npm.includes('moe'), `${q}: repo ${repo} / npm ${npm}`);
    }
  });

  it('manifest search names: decoded per field with every source; an old bundle or a bad ref adds nothing', () => {
    const refs = [['alternateNames', 'iso-x'], ['endonym', 'lm-x'], ['endonym', 'wd-x'], ['name', 'lm-x']];
    assert.deepEqual(manifestSearchNames({ n: 'Innu', s: [['innu-aimun', 1, 2], ['Montagnais', 0], ['Musar', 3, 0]] }, refs), [
      { text: 'innu-aimun', field: 'endonym', source: 'lm-x, wd-x' },
      { text: 'Montagnais', field: 'alternate', source: 'iso-x' },
      { text: 'Musar', field: 'name', source: 'lm-x' },
      { text: 'Musar', field: 'alternate', source: 'iso-x' },
    ]);
    assert.deepEqual(manifestSearchNames({ n: 'Innu' }, refs), [], 'a bundle built before search names');
    assert.deepEqual(manifestSearchNames({ s: [['X', 9], ['', 0], [7, 0]] }, refs), [], 'an unknown ref is skipped, never guessed');
    assert.deepEqual(manifestSearchNames({ s: [['X', 0]] }, undefined), []);
  });

  it('the CLI folds names for the manifest exactly as this search compares them', () => {
    for (const s of ['Èdè Yorùbá', "Ta'Izzi-Adeni Arabic", 'innu-aimun', 'Innu Aimun', 'ᓀᐦᐃᔭᐍᐏᐣ', 'Kwéyòl',
      '  Mag-antsi   Ayta ', 'Alaba-K’abeena', 'بَلوچِي', 'Ghɔmálá’', '', null, 42]) {
      assert.equal(foldForSearch(s), normalizeForMatch(s), JSON.stringify(s));
    }
  });

  it('a published card fills them in: shown with their source when the row carries it, withheld (and said) when not', async () => {
    const found = findLanguages(await load(NPM), 'Hember Avu', 10);
    assert.ok(found.results[0]?.lean && found.results[0].code === 'mmi', 'premise: mmi is name-only in the bundle');
    for (const stamps of [true, false]) {
      const { pkg } = packaged({ mmi: publishedCard('mmi', { stamps }) });
      const text = formatSearchAnswer(found, 'Hember Avu', await materializeLean(found.results, { champollion: pkg }));
      const d = block(text, 'mmi').detail;
      if (stamps) assert.match(d, /also called: Amben, Musar \[iso639-3-\d+\]/);
      else {
        assert.match(d, /other names: 2 recorded, not shown — the published card projection carries no per-field source for it \(see the note below\)/);
        assert.doesNotMatch(d, /Amben|Musar/);
      }
    }
  });
});

// -- 16. Ayta: compared at the source ------------------------------------------------

const AYTA = ['abc', 'abp', 'ays', 'ayt', 'blx', 'sgb'];

/** A repo card as the CLI's remote reader rebuilds it from published rows. */
function publishedCard(code, { stamps, fieldSources, glottocode, formality = null } = {}) {
  const card = reader.normalizeCard(reader.readCard(code, { dir: CARDS }));
  const indexRow = {
    code,
    name: card.name,
    native_name: card.nativeName ?? null,
    glottocode: glottocode !== undefined ? glottocode : card.glottocode ?? null,
    macroarea: card.macroarea ?? null,
    is_isolate: card.isIsolate === true,
    script: card.script ?? null,
    dir: 'ltr',
    updated_at: '2026-09-27T09:08:54.144+00:00',
  };
  const detail = {
    glottocode: indexRow.glottocode,
    classification: card.classification,
    speakerEstimates: card.speakerEstimates,
    countries: card.countries,
    regions: (card.countries ?? []).map((c) => ({ country: c })),
    coordinates: card.coordinates ?? null,
    alternateNames: Array.isArray(card.alternateNames) ? card.alternateNames : [],
    formality,
    // Rows uploaded from 2026-10-04 on carry the card's per-field citations.
    ...(stamps ? { _fieldSources: fieldSources ?? card._fieldSources } : {}),
  };
  return buildCardFromRemote(indexRow, { code, detail, updated_at: indexRow.updated_at });
}

/** A packaged-mode champollion double: the real adapter, scripted cards. */
function packaged(cards) {
  return {
    pkg: {
      ...reader,
      getCardSourceInfo: () => ({ mode: 'packaged' }),
      resolveCode: (c) => c,
      prefetchLanguageCards: async (codes) => ({
        fetched: codes.filter((c) => cards[c]), missing: codes.filter((c) => !cards[c]), failed: [], skipped: [],
      }),
      getLanguageCard: (c) => cards[c] ?? null,
    },
  };
}

async function atya(cards) {
  const found = findLanguages(await load(NPM), 'Atya', 10);
  assert.ok(AYTA.every((c) => found.results.find((l) => l.code === c)?.lean),
    'premise: in the bundle the six Ayta languages are name-only');
  const { pkg } = packaged(cards);
  return formatSearchAnswer(found, 'Atya', await materializeLean(found.results, { champollion: pkg }));
}

const repoGlottocode = (code) => reader.readCard(code, { dir: CARDS }).glottocode;

describe('16. the six Ayta candidates for "Atya" can be compared at the source', () => {
  it('rows uploaded before per-field sources: no uncited location, a Glottolog record per line, and why', async () => {
    const text = await atya(Object.fromEntries(AYTA.map((c) => [c, publishedCard(c, { stamps: false })])));
    const urls = new Set();
    for (const code of AYTA) {
      const d = block(text, code).detail;
      assert.ok(d, `${code} has no detail line\n${text}`);
      assert.doesNotMatch(d, /Philippines|°N|°E|macroarea/, `${code}: an uncited location is never displayed`);
      assert.match(d, /^where: not shown — the published card projection carries no per-field source for it \(see the note below\); an uncited location is never displayed/);
      const g = repoGlottocode(code);
      assert.match(g, /^[a-z0-9]{4}\d{4}$/, `premise: ${code}'s card carries a glottocode`);
      assert.ok(d.endsWith(`· Glottolog record (glottocode ${g}): https://glottolog.org/resource/languoid/id/${g}`), d);
      urls.add(g);
    }
    assert.equal(urls.size, AYTA.length, 'six different records to compare');
    assert.match(text, /6 names are equally close \(distance 0\.5\)\. nothing cited here tells them apart \(their locations carry no per-field source in the published card projection, so they are not shown\); each line links the language's Glottolog record by its glottocode, to compare them at the source/);
    assert.match(text, /rows uploaded before those tables carried per-field sources do not have them \(they arrive with the tables' next upload\)/);
  });

  it('rows uploaded with per-field sources: cited locations, no pointer needed, no "next upload" claim', async () => {
    const text = await atya(Object.fromEntries(AYTA.map((c) => [c, publishedCard(c, { stamps: true })])));
    for (const code of AYTA) {
      const d = block(text, code).detail;
      assert.match(d, /^where: Philippines \(PH\), \d+\.\d{2}°N \d+\.\d{2}°E \[glottolog-v5\.3\]; macroarea Papunesia \[glottolog-cldf-v5\.3\]/);
      assert.doesNotMatch(d, /not shown|glottolog\.org/);
    }
    assert.match(text, /Where each is spoken \(the indented lines\) tells them apart/);
    assert.doesNotMatch(text, /next upload/);
  });

  it('only the reader\'s own derived stamp (registers from formality) still counts as not carried', () => {
    const card = publishedCard('abc', { stamps: false, formality: { system: 'T-V', source: 'test-wals' } });
    assert.deepEqual(Object.keys(card._fieldSources), ['registers'], 'premise: remote.js adds its registers note');
    assert.equal(publishedCarriesFieldSources(card), false);
    assert.equal(publishedCarriesFieldSources(publishedCard('abc', { stamps: true })), true);
  });

  it('a row that carries stamps but none for the location says the card states none — not "next upload"', async () => {
    const card = publishedCard('abc', { stamps: true, fieldSources: { name: ['iso639-3-x'] } });
    const found = findLanguages(await load(NPM), 'Ambala Ayta', 10);
    const { pkg } = packaged({ abc: card });
    const text = formatSearchAnswer(found, 'Ambala Ayta', await materializeLean(found.results, { champollion: pkg }));
    const d = block(text, 'abc').detail;
    assert.match(d, /^where: not shown — the published card states no source for it; an uncited location is never displayed · Glottolog record \(glottocode amba1267\)/);
    assert.doesNotMatch(text, /next upload/);
  });

  it('no glottocode, no link — nothing is made up', async () => {
    const card = publishedCard('abc', { stamps: false, glottocode: null });
    const found = findLanguages(await load(NPM), 'Ambala Ayta', 10);
    const { pkg } = packaged({ abc: card });
    const d = block(formatSearchAnswer(found, 'Ambala Ayta', await materializeLean(found.results, { champollion: pkg })), 'abc').detail;
    assert.match(d, /^where: not shown/);
    assert.doesNotMatch(d, /glottolog\.org|Glottolog record/);
  });

  it('glottologRecordUrl links only a well-formed glottocode', () => {
    assert.equal(glottologRecordUrl('amba1267'), 'https://glottolog.org/resource/languoid/id/amba1267');
    for (const bad of [null, undefined, '', 'abc', 'PH', 'amba126', 'AMBA1267', 'amba1267/../x', 42, { value: 'amba1267' }]) {
      assert.equal(glottologRecordUrl(bad), null, String(bad));
    }
  });

  it('uncitedReason gives the upload reason only for a published row that lacks per-field sources', () => {
    assert.equal(uncitedReason({ tier: 'repo' }), 'this card states no source for it');
    assert.equal(uncitedReason({ tier: 'published', publishedStamps: true }), 'the published card states no source for it');
    assert.match(uncitedReason({ tier: 'published', publishedStamps: false }, 'them'),
      /^the published card projection carries no per-field source for them \(its rows were uploaded before champollion\.dev's card tables carried per-field sources; those arrive with the tables' next upload\)$/);
  });

  it('monorepo corpus: unchanged — cited locations, no pointer', async () => {
    const found = findLanguages(await load(), 'Atya', 10);
    const text = formatSearchAnswer(found, 'Atya', await materializeLean(found.results));
    for (const code of AYTA) {
      const d = block(text, code).detail;
      assert.match(d, /\[glottolog-v5\.3\]/);
      assert.doesNotMatch(d, /not shown|glottolog\.org/);
    }
  });
});

describe('16. get_language says the same, with the same pointer', () => {
  const pkgFor = (card) => ({
    ...reader,
    getCardSourceInfo: () => ({ mode: 'packaged' }),
    resolveCode: (c) => c,
    prefetchLanguageCards: async (codes) => ({ fetched: codes, missing: [], failed: [], skipped: [] }),
    getLanguageCard: () => card,
  });

  it('a row uploaded before per-field sources: not shown, why, and Glottolog\'s record', async () => {
    const text = formatLanguage(await getLanguage('abp', { champollion: pkgFor(publishedCard('abp', { stamps: false })) }));
    assert.doesNotMatch(text, /Where: macroarea|countries PH/);
    assert.match(text, /Where: location facts not shown — the published card projection carries no per-field source for them \(its rows were uploaded before champollion\.dev's card tables carried per-field sources; those arrive with the tables' next upload\); an uncited location is never displayed\. Glottolog's record \(glottocode aben1249\): https:\/\/glottolog\.org\/resource\/languoid\/id\/aben1249/);
  });

  it('a row uploaded with them: every location fact cited, no pointer', async () => {
    const text = formatLanguage(await getLanguage('abp', { champollion: pkgFor(publishedCard('abp', { stamps: true })) }));
    assert.match(text, /Where: macroarea Papunesia \[glottolog-cldf-v5\.3\]; countries PH \[glottolog-v5\.3\]/);
    assert.doesNotMatch(text, /not shown|glottolog\.org\/resource/);
  });
});
