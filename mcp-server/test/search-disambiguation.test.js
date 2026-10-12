/**
 * search_languages: same-named languages must be tell-apart-able.
 *
 * The Round-1 S2 persona ("an Atya phrasebook for the hospital") searched
 * "Atya" and got six Ayta languages (abc, abp, ays, ayt, blx, sgb) tied at the
 * same distance with nothing to choose between them by — in the npm install,
 * six bare names. Each result now carries where the language is spoken
 * (countries, Glottolog's point, macroarea) and its other names, every fact
 * with the source the card stamps on it; in an npm install the name-only
 * results are filled in from their published cards first.
 *
 * Pinned on the REAL monorepo cards (read through the one adapter), and on a
 * packaged-mode double whose cards are those same real cards reshaped as the
 * published projection (no per-field stamps) — no network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  findLanguages, loadLanguageIndex, materializeLean, formatSearchAnswer, renderAttributed,
} from '../src/tools/languages.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = path.resolve(__dirname, '../../cli');
const BUNDLE = path.join(CLI, 'shared/cards-fallback.json');
const reader = await import(pathToFileURL(path.join(CLI, 'lib/cards/reader.js')).href);

const AYTA = ['abc', 'abp', 'ays', 'ayt', 'blx', 'sgb'];
const POINT = /\d+\.\d{2}°[NS] \d+\.\d{2}°[EW]/;

/** The indented `where:` line printed under each result, by code. */
function whereLines(text) {
  const out = new Map();
  const lines = text.split('\n');
  lines.forEach((l, i) => {
    const m = /^([a-z]{3})  /.exec(l);
    if (m && lines[i + 1]?.startsWith('     where:')) out.set(m[1], lines[i + 1].trim());
  });
  return out;
}

/** A real repo card, reshaped as the published projection: no _fieldSources. */
function publishedShape(code) {
  const card = reader.normalizeCard(reader.readCard(code, { dir: path.join(CLI, 'shared/language-cards') }));
  delete card._fieldSources;
  card._remote = { source: 'supabase', updatedAt: '2026-10-01T00:00:00Z' };
  return card;
}

/** A packaged-mode champollion double: the real adapter, scripted prefetch. */
function packaged({ outcome = () => 'fetched', delayMs = 0 } = {}) {
  const calls = { prefetch: [], get: [] };
  const cards = new Map();
  return {
    calls,
    pkg: {
      ...reader,
      getCardSourceInfo: () => ({ mode: 'packaged' }),
      prefetchLanguageCards: async (codes) => {
        calls.prefetch.push(...codes);
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        const r = { fetched: [], missing: [], failed: [], skipped: [] };
        for (const c of codes) {
          const o = outcome(c);
          r[o].push(c);
          if (o === 'fetched') cards.set(c, publishedShape(c));
        }
        return r;
      },
      getLanguageCard: (c) => {
        calls.get.push(c);
        return cards.get(c) ?? null;
      },
    },
  };
}

describe('search_languages — the six Ayta languages can be told apart', () => {
  it('monorepo corpus: every Ayta result says where it is spoken, with sources, and the points differ', async () => {
    const index = await loadLanguageIndex();
    const found = findLanguages(index, 'Atya', 10);
    const text = formatSearchAnswer(found, 'Atya', await materializeLean(found.results));
    const where = whereLines(text);
    for (const code of AYTA) {
      const w = where.get(code);
      assert.ok(w, `${code} has no where: line\n${text}`);
      assert.match(w, /Philippines \(PH\)/, `${code}: country`);
      assert.match(w, POINT, `${code}: Glottolog's point`);
      assert.match(w, /macroarea Papunesia/, `${code}: macroarea`);
      assert.match(w, /\[glottolog-v5\.3\]/, `${code}: the country/point carry the card's own source stamp`);
      assert.doesNotMatch(w, /source not stated/, `${code}: a repo card stamps every location fact`);
    }
    const points = AYTA.map((c) => where.get(c).match(POINT)[0]);
    assert.equal(new Set(points).size, AYTA.length, `the six points must distinguish them: ${points.join(' | ')}`);
    assert.match(text, /6 names are equally close \(distance 0\.5\)/);
  });

  it('npm bundle: the six name-only results are filled in from their published cards', async () => {
    const index = await loadLanguageIndex({ repoDir: '/nonexistent/repo-cards', fallbackFile: BUNDLE });
    const found = findLanguages(index, 'Atya', 10);
    assert.ok(AYTA.every((c) => found.results.find((l) => l.code === c)?.lean),
      'premise: in the bundle the Ayta languages are name-only');
    const { pkg, calls } = packaged();
    const filled = await materializeLean(found.results, { champollion: pkg });
    const text = formatSearchAnswer(found, 'Atya', filled);
    const where = whereLines(text);
    for (const code of AYTA) {
      assert.ok(calls.prefetch.includes(code), `${code} was not prefetched (async, never the sync fetch)`);
      const w = where.get(code);
      assert.ok(w, `${code} has no where: line\n${text}`);
      // The published projection drops the per-field stamps the card has.
      // Round 10 (hospital): every displayed fact cites its source, so an
      // uncited location is NOT shown — the line says why, never borrows a
      // source, and never calls the card itself unsourced (Round 5).
      assert.doesNotMatch(w, /Philippines|°N|°E|macroarea/, `${code}: an uncited location is never displayed`);
      assert.match(w, /^where: not shown — the published card projection carries no per-field source for it/);
      assert.doesNotMatch(w, /source not stated/);
    }
    assert.doesNotMatch(text, /name-only entry/);
    assert.match(text, /published card tables/);
    // the tie header does not claim the (hidden) lines tell them apart
    assert.match(text, /6 names are equally close \(distance 0\.5\)\. nothing cited here tells them apart/);
    assert.doesNotMatch(text, /tells them apart;|the indented lines/);
  });

  it('a published card that carries its stamps is attributed through the adapter', async () => {
    const index = await loadLanguageIndex({ repoDir: '/nonexistent/repo-cards', fallbackFile: BUNDLE });
    const found = findLanguages(index, 'Ambala Ayta', 10);
    const { pkg } = packaged();
    const stamped = reader.normalizeCard(reader.readCard('abc', { dir: path.join(CLI, 'shared/language-cards') }));
    stamped._remote = { source: 'supabase', updatedAt: '2026-10-03T00:00:00Z' };
    pkg.prefetchLanguageCards = async (codes) => ({ fetched: codes, missing: [], failed: [], skipped: [] });
    pkg.getLanguageCard = () => stamped;
    const text = formatSearchAnswer(found, 'Ambala Ayta', await materializeLean(found.results, { champollion: pkg }));
    const w = whereLines(text).get('abc');
    assert.match(w, /Philippines \(PH\), 14\.82°N 120\.28°E \[glottolog-v5\.3\]; macroarea Papunesia \[glottolog-cldf-v5\.3\]/);
    assert.doesNotMatch(w, /not carried|not stated/);
  });

  it('a card that cannot be fetched stays a name, and the line says why', async () => {
    const index = await loadLanguageIndex({ repoDir: '/nonexistent/repo-cards', fallbackFile: BUNDLE });
    const found = findLanguages(index, 'Atya', 10);
    const outcomes = { abc: 'failed', abp: 'missing' };
    const { pkg, calls } = packaged({ outcome: (c) => outcomes[c] ?? 'fetched' });
    const text = formatSearchAnswer(found, 'Atya', await materializeLean(found.results, { champollion: pkg }));
    assert.match(text, /abc {2}Ambala Ayta {2}— name-only entry .*fetching its card from champollion\.dev failed/);
    assert.match(text, /abp {2}Abellen Ayta {2}— name-only entry .*publishes no card for it yet/);
    assert.ok(!calls.get.includes('abc') && !calls.get.includes('abp'),
      'a failed or missing card is never read synchronously (that read could block on a fetch)');
    assert.ok(whereLines(text).get('sgb'), 'the others are still filled in');
  });

  it('a slow fetch does not hold the answer past the budget', async () => {
    const index = await loadLanguageIndex({ repoDir: '/nonexistent/repo-cards', fallbackFile: BUNDLE });
    const found = findLanguages(index, 'Atya', 10);
    const { pkg, calls } = packaged({ delayMs: 500 });
    const t0 = Date.now();
    const filled = await materializeLean(found.results, { champollion: pkg, budgetMs: 50 });
    assert.ok(Date.now() - t0 < 400, 'returned at the budget, not when the fetch finished');
    assert.equal(calls.get.length, 0, 'an unsettled card is never read');
    assert.match(formatSearchAnswer(found, 'Atya', filled), /did not arrive within/);
  });

  it('repo index: nothing to fill in, no package needed', async () => {
    const filled = await materializeLean([{ code: 'abp', name: 'Abellen Ayta', lean: false }], { champollion: null });
    assert.equal(filled.upgraded.size, 0);
    assert.equal(filled.unresolved.size, 0);
  });
});

describe('location facts keep a dispute a dispute', () => {
  it('conflicting country claims are each shown with their source — none elected', async () => {
    const card = {
      code: 'zzx',
      name: 'Testing Language',
      countries: {
        agreement: 'conflicting',
        values: [{ value: ['PH'], source: 'src-a' }, { value: ['PH', 'MY'], source: 'src-b' }],
      },
      coordinates: { lat: 15.4131, lng: 120.2 },
      macroarea: 'Papunesia',
      alternateNames: ['One', 'Two', 'Three', 'Four', 'Five', 'zzx'],
      _fieldSources: { 'coordinates.lat': ['src-a'], 'coordinates.lng': ['src-a'], macroarea: ['src-c'], alternateNames: ['iso639-3-x'] },
    };
    const { pkg } = packaged();
    pkg.getCardSourceInfo = () => ({ mode: 'repo' });
    pkg.getLanguageCard = () => card;
    const filled = await materializeLean([{ code: 'zzx', name: 'Testing Language', lean: true }], { champollion: pkg });
    const found = { match: 'exact', results: [{ code: 'zzx', name: 'Testing Language', lean: true }], fuzzy: [] };
    const text = formatSearchAnswer(found, 'zzx', filled);
    assert.match(text, /Philippines \(PH\), 15\.41°N 120\.20°E \[src-a\]/);
    assert.match(text, /Philippines \(PH\), Malaysia \(MY\) \[src-b\]/);
    assert.match(text, /macroarea Papunesia \[src-c\]/);
    assert.match(text, /sources differ; every claim shown/);
    assert.match(text, /also called: One, Two, Three, Four \[iso639-3-x\] \(\+1 more\)/,
      'alternate names are capped, the code is not a name');
  });

  it('a source the value itself carries counts as stated (older card shape)', async () => {
    const card = { code: 'zzy', name: 'Other Testing Language',
      coordinates: { lat: 7.15, lng: 3.67, source: 'glottolog-5.3' } };
    const { pkg } = packaged();
    pkg.getCardSourceInfo = () => ({ mode: 'repo' });
    pkg.getLanguageCard = () => card;
    const filled = await materializeLean([{ code: 'zzy', name: 'Other Testing Language', lean: true }], { champollion: pkg });
    const found = { match: 'exact', results: [{ code: 'zzy', name: 'Other Testing Language', lean: true }], fuzzy: [] };
    assert.match(formatSearchAnswer(found, 'zzy', filled), /7\.15°N 3\.67°E \[glottolog-5\.3\]/);
  });

  it('renderAttributed groups by source and never invents one', () => {
    assert.equal(
      renderAttributed([{ text: 'A', sources: ['s1'] }, { text: 'B', sources: [] }, { text: 'C', sources: ['s1'] }]),
      'A, C [s1]; B [source not stated on this card]',
    );
  });
});


describe('search_languages finds a language by every name its card records', () => {
  // Round 5 school persona: nêhiyawêwin — the community's own name — found
  // nothing, with or without its accents. The Cree macrolanguage's card
  // records it (Wikidata, label language cr) as a second endonym; Plains
  // Cree's own card records only ᓀᐦᐃᔭᐍᐏᐣ. So the search lands on cre first,
  // says which recorded name it matched, and names crk among cre's members
  // (from crk's own ISO 639-3 macrolanguage link). crk itself follows on the
  // converter's reading of ᓀᐦᐃᔭᐍᐏᐣ, labelled as champollion's derivation —
  // never as a name a source gives it (Round 8; the describe block below).
  for (const q of ['nêhiyawêwin', 'nehiyawewin', 'Nēhiyawēwin', 'NEHIYAWEWIN']) {
    it(`"${q}" (diacritics and case folded) → cre, naming crk Plains Cree`, async () => {
      const index = await loadLanguageIndex();
      const found = findLanguages(index, q, 10);
      assert.equal(found.match, 'exact');
      assert.equal(found.results[0].code, 'cre');
      const text = formatSearchAnswer(found, q, await materializeLean(found.results));
      assert.match(text, /^cre {2}Cree .*← matched its endonym "nēhiyawēwin" \[wikidata-[0-9a-z]+\]/m);
      assert.match(text, /macrolanguage — member languages: .*crk Plains Cree.*\[iso639-3-\d+\]/);
    });
  }

  it('the npm bundle answers the same (cre and crk are bundled cards)', async () => {
    const index = await loadLanguageIndex({ repoDir: '/nonexistent/repo-cards', fallbackFile: BUNDLE });
    const found = findLanguages(index, 'nehiyawewin', 10);
    assert.equal(found.results[0]?.code, 'cre');
    assert.match(formatSearchAnswer(found, 'nehiyawewin'), /crk Plains Cree/);
  });

  it("another registry's name is searchable and labelled as such", async () => {
    const dir = (await import('node:fs')).mkdtempSync(path.join((await import('node:os')).tmpdir(), 'cards-'));
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path.join(dir, 'zzq.json'), JSON.stringify({
      code: 'zzq',
      name: { agreement: 'conflicting', values: [{ value: 'Testlang', source: 'iso-x' }, { value: 'Tèstish', source: 'glotto-y' }] },
    }));
    const index = await loadLanguageIndex({ cardsDir: dir });
    const found = findLanguages(index, 'testish', 10);
    assert.equal(found.results[0]?.code, 'zzq');
    assert.match(formatSearchAnswer(found, 'testish'), /← matched its name in another registry "Tèstish" \[glotto-y\]/);
  });
});

const { mkdtempSync, writeFileSync } = await import('node:fs');
const { tmpdir } = await import('node:os');

describe('search_languages also matches a recorded name in its converter-read form, labelled as derived', () => {
  // Round 8 school persona: nêhiyawêwin found cre and listed crk, but never
  // found crk itself — crk's card records the endonym only in Cree Syllabics
  // (ᓀᐦᐃᔭᐍᐏᐣ). The CLI registers a Cree Syllabics ⇄ SRO converter for crk;
  // the search now also matches the SRO form it reads that name as, after
  // the recorded-name matches, and every line built on it says the spelling
  // is champollion's derivation from the cited endonym.
  const DERIVED = /← matched "nêhiyawêwin" — the SRO \(Standard Roman Orthography\) form of the card's Cree Syllabics endonym ᓀᐦᐃᔭᐍᐏᐣ, by champollion's script converter; no source on this card records this spelling \[champollion-derived from wikidata-[0-9a-z]+\]/;
  const loaded = new Map();
  const load = (opts) => {
    const k = JSON.stringify(opts);
    if (!loaded.has(k)) loaded.set(k, loadLanguageIndex(opts));
    return loaded.get(k);
  };
  const cardsDir = (cards) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cards-derived-'));
    for (const c of cards) writeFileSync(path.join(dir, `${c.code}.json`), JSON.stringify(c));
    return dir;
  };
  const endonyms = (...vals) => ({ agreement: vals.length > 1 ? 'multiple-variants' : 'single',
    values: vals.map(([value, source]) => ({ value, source })) });

  for (const [label, opts] of [
    ['monorepo corpus', {}],
    ['npm bundle', { repoDir: '/nonexistent/repo-cards', fallbackFile: BUNDLE }],
  ]) {
    for (const q of ['nêhiyawêwin', 'nehiyawewin', 'NEHIYAWEWIN', 'Nēhiyawēwin']) {
      it(`${label}: "${q}" finds crk itself, after cre, on the derived SRO form`, async () => {
        const index = await load(opts);
        const found = findLanguages(index, q, 10);
        assert.equal(found.match, 'exact');
        assert.deepEqual(found.results.slice(0, 2).map((l) => l.code), ['cre', 'crk'],
          'a name a source records outranks champollion\'s reading');
        const text = formatSearchAnswer(found, q, await materializeLean(found.results));
        const crkLine = text.split('\n').find((l) => l.startsWith('crk  '));
        assert.match(crkLine, DERIVED);
        assert.match(text, /^cre {2}Cree .*← matched its endonym "nēhiyawēwin" \[wikidata-[0-9a-z]+\]/m,
          'cre still answers on the endonym its card records');
      });
    }
  }

  it('the derived form is kept apart from the recorded names (never stored as a source\'s claim)', async () => {
    const crk = (await load({})).find((l) => l.code === 'crk');
    assert.equal(crk.derivedNames.length, 1);
    assert.deepEqual(
      { text: crk.derivedNames[0].text, from: crk.derivedNames[0].from, field: crk.derivedNames[0].fromField },
      { text: 'nêhiyawêwin', from: 'ᓀᐦᐃᔭᐍᐏᐣ', field: 'endonym' },
    );
    assert.match(crk.derivedNames[0].fromSource, /^wikidata-/);
    assert.ok(!crk.names.some((n) => n.text === 'nêhiyawêwin'), 'not among the recorded names');
    assert.ok(!crk.aliases.includes('nêhiyawêwin'), 'not an alternate name');
  });

  it('a typo of the derived form is a fuzzy match that still says it is derived', async () => {
    const found = findLanguages(await load({}), 'nehiyawewn', 10);
    assert.equal(found.match, 'fuzzy');
    const text = formatSearchAnswer(found, 'nehiyawewn');
    assert.match(text, /^crk {2}Plains Cree .*← "nêhiyawêwin" \(the SRO \(Standard Roman Orthography\) form of the card's Cree Syllabics endonym ᓀᐦᐃᔭᐍᐏᐣ, by champollion's script converter; .*\[champollion-derived from wikidata-[0-9a-z]+\]\), distance 1$/m);
  });

  it('generic over the CLI registry: the converter the card names (scriptConverter) is the one used', async () => {
    // A test language whose card names the Serbian Latin ⇄ Cyrillic converter:
    // no code in this server knows either the language or the script pair.
    const dir = cardsDir([{ code: 'zzq', name: 'Testlang', scriptConverter: 'sr',
      endonym: endonyms(['тестски', 'src-e']) }]);
    const index = await loadLanguageIndex({ cardsDir: dir });
    const entry = index.find((l) => l.code === 'zzq');
    assert.deepEqual(entry.derivedNames.map((d) => d.text), ['testski']);
    const found = findLanguages(index, 'testski', 10);
    assert.equal(found.results[0]?.code, 'zzq');
    assert.match(formatSearchAnswer(found, 'testski'),
      /← matched "testski" — the Latin form of the card's Cyrillic endonym тестски, by champollion's script converter; no source on this card records this spelling \[champollion-derived from src-e\]/);
  });

  it('nothing is derived without a registered converter, from a partial reading, or for a spelling already recorded', async () => {
    const dir = cardsDir([
      // Syllabics, but no converter is registered for this language.
      { code: 'zzs', name: 'Unconverted', endonym: endonyms(['ᓀᐦᐃᔭᐍᐏᐣ', 'src-a']) },
      // crk's converter: ᐎ is not a Plains Cree syllable, so "ᐊᔨᒧᐎᓐ" reads
      // only partly — dropped; ᓀᐦᐃᔭᐍᐏᐣ reads wholly — kept.
      { code: 'crk', name: 'Plains Cree', endonym: endonyms(['ᓀᐦᐃᔭᐍᐏᐣ', 'src-b'], ['ᐊᔨᒧᐎᓐ', 'src-c']) },
      // The SRO spelling is already recorded: the recorded one is the evidence.
      { code: 'zzr', name: 'Recorded', scriptConverter: 'crk',
        endonym: endonyms(['ᓀᐦᐃᔭᐍᐏᐣ', 'src-d'], ['nêhiyawêwin', 'src-e']) },
    ]);
    const index = await loadLanguageIndex({ cardsDir: dir });
    const by = Object.fromEntries(index.map((l) => [l.code, l]));
    assert.deepEqual(by.zzs.derivedNames, []);
    assert.deepEqual(by.crk.derivedNames.map((d) => [d.text, d.from, d.fromSource]), [['nêhiyawêwin', 'ᓀᐦᐃᔭᐍᐏᐣ', 'src-b']]);
    assert.deepEqual(by.zzr.derivedNames, []);
    const text = formatSearchAnswer(findLanguages(index, 'nehiyawewin', 10), 'nehiyawewin');
    assert.match(text, /^zzr {2}Recorded .*← matched its endonym "nêhiyawêwin" \[src-e\]$/m);
    assert.match(text, /^crk {2}Plains Cree .*\[champollion-derived from src-b\]$/m);
    assert.doesNotMatch(text, /^zzs /m);
  });
});
