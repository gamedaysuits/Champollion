/**
 * The bundled manifest's search names (Round 12).
 *
 * An npm install knows ~7,500 languages only by their manifest entry. That
 * entry carried the displayed name and code aliases, so an install could not
 * find Innu (moe) by "Montagnais" — the alternate name ISO 639-3 records — nor
 * languages by their endonyms or by another registry's name. The manifest now
 * carries every such name, deduplicated as search compares names, each with
 * the field and source that record it (lib/cards/search-names.js).
 *
 * Reads the committed bundle and the real cards through the adapter; no
 * network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCard, attributions } from '../lib/cards/reader.js';
import {
  foldForSearch, searchNameClaims, encodeSearchNames, decodeSearchNames, buildRefTable,
} from '../lib/cards/search-names.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS = path.join(CLI_ROOT, 'shared', 'language-cards');
const bundle = JSON.parse(fs.readFileSync(path.join(CLI_ROOT, 'shared', 'cards-fallback.json'), 'utf-8'));
const hasCards = fs.existsSync(CARDS);

describe('manifest search names: the committed bundle', () => {
  it('moe (name-only) carries "Montagnais", cited to ISO 639-3 as an alternate name', () => {
    assert.equal(bundle.cards.moe, undefined, 'premise: moe has no bundled card');
    const names = decodeSearchNames(bundle.manifest.moe, bundle.nameRefs);
    const m = names.find((n) => n.text === 'Montagnais');
    assert.ok(m, JSON.stringify(names));
    assert.deepEqual(m.fields.map((f) => f.field), ['alternateNames']);
    assert.match(m.fields[0].sources.join(), /^iso639-3-\d+$/);
    const endo = names.find((n) => n.text === 'innu-aimun');
    assert.deepEqual(endo?.fields.map((f) => f.field), ['endonym']);
    assert.equal(endo.fields[0].sources.length, 2, 'both sources that spell it so are cited');
  });

  it('the format is described in _meta and every ref resolves to a [field, source] pair', () => {
    const meta = bundle._meta.searchNames;
    assert.equal(meta.field, 's');
    assert.deepEqual(meta.fields, ['name', 'endonym', 'alternateNames']);
    assert.ok(Array.isArray(bundle.nameRefs) && bundle.nameRefs.length > 0);
    for (const pair of bundle.nameRefs) {
      assert.ok(meta.fields.includes(pair[0]), JSON.stringify(pair));
      assert.equal(typeof pair[1], 'string', `every kept name is cited: ${JSON.stringify(pair)}`);
    }
    let names = 0;
    let languages = 0;
    for (const entry of Object.values(bundle.manifest)) {
      if (!entry.s) continue;
      languages += 1;
      for (const [text, ...refs] of entry.s) {
        names += 1;
        assert.equal(typeof text, 'string');
        assert.ok(refs.length > 0 && refs.every((r) => Number.isInteger(r) && bundle.nameRefs[r]), text);
      }
    }
    assert.equal(names, meta.names);
    assert.equal(languages, meta.languages);
    assert.ok(languages > 1500, `search names reach the long tail (${languages} languages)`);
  });

  it('only name-only languages carry them: never a bundled card, never a locale', () => {
    for (const [code, entry] of Object.entries(bundle.manifest)) {
      if (!entry.s) continue;
      assert.equal(bundle.cards[code], undefined, `${code} has a bundled card; its names are on it`);
      assert.ok(!code.includes('-'), `${code} is a locale, not a language`);
    }
  });

  it('deduplicated as search compares names: none folds to the displayed name, a code alias, or another kept name', () => {
    for (const [code, entry] of Object.entries(bundle.manifest)) {
      if (!entry.s) continue;
      const reached = new Set([entry.n, ...(entry.a ?? [])].map(foldForSearch));
      const kept = new Set();
      for (const [text] of entry.s) {
        const k = foldForSearch(text);
        assert.ok(k && !reached.has(k), `${code}: "${text}" is already reached by n/a`);
        assert.ok(!kept.has(k), `${code}: "${text}" folds like another kept name`);
        kept.add(k);
      }
    }
  });

  it('every kept name is what the cited source records, spelt exactly so', { skip: !hasCards }, () => {
    let checked = 0;
    for (const [code, entry] of Object.entries(bundle.manifest)) {
      if (!entry.s) continue;
      const raw = readCard(code, { dir: CARDS });
      assert.ok(raw, code);
      const claims = searchNameClaims(raw);
      for (const { text, fields } of decodeSearchNames(entry, bundle.nameRefs)) {
        for (const { field, sources } of fields) {
          for (const source of sources) {
            assert.ok(claims.some((c) => c.text === text && c.field === field && c.source === source),
              `${code}: "${text}" is not recorded by ${source} in ${field}`);
            checked += 1;
          }
        }
      }
    }
    assert.ok(checked > 2000, `checked ${checked} citations`);
  });
});

describe('manifest search names: the encoder', () => {
  it('reads the name and endonym envelopes and the stamped alternateNames, each with its source', () => {
    const raw = readCard('moe', { dir: CARDS }) ?? {
      name: { agreement: 'unanimous', consensus: 'Innu', values: [{ value: 'Innu', source: 'iso' }] },
      endonym: { agreement: 'single', consensus: 'innu-aimun', values: [{ value: 'innu-aimun', source: 'lm' }] },
      alternateNames: ['Montagnais'],
      _fieldSources: { alternateNames: ['iso'] },
    };
    const claims = searchNameClaims(raw);
    const nameSources = attributions(raw.name).map((c) => c.source);
    assert.ok(claims.filter((c) => c.field === 'name').every((c) => nameSources.includes(c.source)));
    assert.ok(claims.some((c) => c.field === 'alternateNames' && c.text === 'Montagnais'
      && raw._fieldSources.alternateNames.includes(c.source)));
    assert.ok(claims.some((c) => c.field === 'endonym' && c.text === 'innu-aimun'));
  });

  it('a code-like alternate name is not a name; an unstamped flat name keeps a null source', () => {
    const claims = searchNameClaims({ name: 'Testing', alternateNames: ['tst', 'Ata'] });
    assert.deepEqual(claims, [
      { text: 'Testing', field: 'name', source: null },
      { text: 'Ata', field: 'alternateNames', source: null },
    ]);
  });

  it('keeps one spelling per folded name, cited only to the sources that spell it so', () => {
    const claims = [
      { text: 'Kwéyòl', field: 'endonym', source: 'lm' },
      { text: 'kweyol', field: 'endonym', source: 'wd' },
      { text: 'Patwa', field: 'endonym', source: 'wd' },
      { text: 'Saint Lucian Creole', field: 'name', source: 'iso' },
      { text: 'Kwéyòl', field: 'alternateNames', source: 'iso' },
    ];
    const refs = buildRefTable(claims);
    const s = encodeSearchNames(claims, { exclude: ['Saint Lucian Creole', 'acf'], ref: refs.ref });
    assert.deepEqual(decodeSearchNames({ s }, refs.table), [
      { text: 'Kwéyòl', fields: [{ field: 'endonym', sources: ['lm'] }, { field: 'alternateNames', sources: ['iso'] }] },
      { text: 'Patwa', fields: [{ field: 'endonym', sources: ['wd'] }] },
    ]);
  });

  it('the ref table is sorted and refuses a pair it was not built from', () => {
    const refs = buildRefTable([{ field: 'name', source: 'b' }, { field: 'endonym', source: 'a' }]);
    assert.deepEqual(refs.table, [['endonym', 'a'], ['name', 'b']]);
    assert.throws(() => refs.ref('alternateNames', 'c'), /no name ref/);
  });
});
