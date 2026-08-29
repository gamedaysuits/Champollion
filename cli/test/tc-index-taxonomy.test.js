/**
 * tc-index taxonomy round-trip — regression for the 2026-07-19 latent
 * display bug: the Supabase reconstruction of data/tc-index.json
 * (`ensure-tc-index` → scripts/build-data-from-supabase.mjs --index-only)
 * dropped isoType/modality/isoScope/macrolanguage because the upload
 * mapping never sent them and the table had no such columns (migrations
 * 012/032). The homepage graph generator derives living/at-risk hero
 * stats from isoType, so any build that consumed a round-tripped index
 * silently baked atRisk=0 (true value ~4,100) and monolith
 * coveredLiving=0 into the hero.
 *
 * Guards pinned here:
 *   1. indexRowToEntry maps the migration-056 taxonomy columns (and
 *      defaults them to null on pre-056 rows — stable shape).
 *   2. healTaxonomyFromCards fills round-trip-dropped fields from the
 *      language-card SSOT, fill-only (never overrides DB values), reading
 *      cards through the ONE JS adapter (normalizeCard) so atlas-shape
 *      cards (isoLanguageType "Living", isoScope "Individual") heal to the
 *      letters the consumers test ('L', 'I'/'M').
 *   3. assertTcIndexTaxonomy fails loud on an all-null-taxonomy index.
 *   4. buildCardFromRemote falls back to the index-row taxonomy columns
 *      when the detail blob lacks them.
 *   5. Wiring (source contract): the upload script sends the columns, the
 *      ensure script heals + asserts, the graph generator asserts, and
 *      migration 056 declares the columns — deleting any side of the
 *      round-trip breaks this suite, not the homepage.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TAXONOMY_FIELDS,
  indexRowToEntry,
  healTaxonomyFromCards,
  assertTcIndexTaxonomy,
} from '../website/scripts/lib/tc-index-remote.js';
import { buildCardFromRemote } from '../lib/cards/remote.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');

/** A realistic post-056 index row (crk-shaped). */
const CRK_ROW = {
  code: 'crk',
  name: 'Plains Cree',
  native_name: 'nêhiyawêwin',
  family: 'Algic',
  is_isolate: false,
  speaker_count: 27500,
  vitality_badge: { level: 'endangered', label: 'Endangered' },
  iso_type: 'L',
  modality: 'spoken',
  iso_scope: 'I',
  macrolanguage: 'cre',
};

describe('tc-index taxonomy: indexRowToEntry mapping', () => {
  it('maps the migration-056 taxonomy columns to camelCase entry fields', () => {
    const entry = indexRowToEntry(CRK_ROW);
    assert.equal(entry.isoType, 'L');
    assert.equal(entry.modality, 'spoken');
    assert.equal(entry.isoScope, 'I');
    assert.equal(entry.macrolanguage, 'cre');
  });

  it('defaults taxonomy to null (not undefined) on pre-056 rows', () => {
    const entry = indexRowToEntry({ code: 'crk', name: 'Plains Cree' });
    for (const [field] of TAXONOMY_FIELDS) {
      assert.ok(Object.hasOwn(entry, field), `entry is missing the ${field} key`);
      assert.strictEqual(entry[field], null, `${field} should default to null`);
    }
  });

  it('keeps the pre-existing round-trip fields intact', () => {
    const entry = indexRowToEntry(CRK_ROW);
    assert.equal(entry.code, 'crk');
    assert.equal(entry.nativeName, 'nêhiyawêwin');
    assert.equal(entry.speakerCount, 27500);
    assert.deepEqual(entry.vitalityBadge, { level: 'endangered', label: 'Endangered' });
    assert.strictEqual(entry.narrative, null);
  });
});

describe('tc-index taxonomy: healTaxonomyFromCards (language-card SSOT)', () => {
  let cardsDir;

  before(() => {
    cardsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-taxonomy-cards-'));
    const write = (name, obj) =>
      fs.writeFileSync(path.join(cardsDir, name), JSON.stringify(obj));
    write('aaa.json', { code: 'aaa', isoType: 'L', modality: 'spoken', isoScope: 'I' });
    write('bbb.json', { code: 'bbb', isoType: 'E', macrolanguage: 'mac' });
    write('ccc.json', { code: 'ccc', name: 'No Taxonomy Here' });
    // Atlas-shape cards (post-cutover): the registry WORD in
    // isoLanguageType/isoScope, no isoType field at all. Healing must run
    // them through the card adapter (normalizeCard) so the tc-index carries
    // the LETTERS — src/utils/taxonomy.js tests isoScope === 'M', and the
    // graph generator counts living languages via isoType === 'L'.
    write('ddd.json', {
      code: 'ddd', isoLanguageType: 'Living', isoScope: 'Individual', modality: 'spoken',
    });
    write('eee.json', { code: 'eee', isoLanguageType: 'Living', isoScope: 'Macrolanguage' });
    // An attributed field (post-cutover `name` envelope) must not derail heal.
    write('fff.json', {
      code: 'fff',
      name: { agreement: 'unanimous', values: [{ value: 'Xish', source: 'glottolog-v5.0' }] },
      isoLanguageType: 'Living',
      isoScope: 'Individual',
    });
    // The one non-card JSON file the cards dir carries — must be skipped.
    write('language-tree.json', { code: 'aaa', isoType: 'C' });
    fs.writeFileSync(path.join(cardsDir, 'broken.json'), '{not json');
  });

  after(() => {
    fs.rmSync(cardsDir, { recursive: true, force: true });
  });

  it('fills round-trip-dropped fields and reports counts', async () => {
    const entries = [
      indexRowToEntry({ code: 'aaa', name: 'A' }),
      indexRowToEntry({ code: 'bbb', name: 'B' }),
    ];
    const { healedEntries, filledFields } = await healTaxonomyFromCards(entries, cardsDir);
    assert.equal(healedEntries, 2);
    assert.equal(filledFields, 5); // aaa: isoType+modality+isoScope · bbb: isoType+macrolanguage
    assert.equal(entries[0].isoType, 'L');
    assert.equal(entries[0].modality, 'spoken');
    assert.equal(entries[0].isoScope, 'I');
    // language-tree.json's conflicting isoType 'C' must not have won.
    assert.notEqual(entries[0].isoType, 'C');
    assert.equal(entries[1].isoType, 'E');
    assert.equal(entries[1].macrolanguage, 'mac');
  });

  it('is fill-only: a DB-provided value is never overridden', async () => {
    const entries = [indexRowToEntry({ code: 'bbb', name: 'B', iso_type: 'H' })];
    await healTaxonomyFromCards(entries, cardsDir);
    assert.equal(entries[0].isoType, 'H', 'card value must not override the DB column');
    assert.equal(entries[0].macrolanguage, 'mac', 'null fields still heal');
  });

  it('leaves entries alone when the card has no taxonomy or does not exist', async () => {
    const entries = [
      indexRowToEntry({ code: 'ccc', name: 'C' }),
      indexRowToEntry({ code: 'zzz', name: 'Z' }),
    ];
    const { healedEntries, filledFields } = await healTaxonomyFromCards(entries, cardsDir);
    assert.equal(healedEntries, 0);
    assert.equal(filledFields, 0);
    assert.strictEqual(entries[0].isoType, null);
    assert.strictEqual(entries[1].isoType, null);
  });

  it('bridges atlas-shape cards: word isoLanguageType/isoScope heal to the letters', async () => {
    const entries = [
      indexRowToEntry({ code: 'ddd', name: 'D' }),
      indexRowToEntry({ code: 'eee', name: 'E' }),
    ];
    const { healedEntries, filledFields } = await healTaxonomyFromCards(entries, cardsDir);
    assert.equal(healedEntries, 2);
    assert.equal(filledFields, 5); // ddd: isoType+isoScope+modality · eee: isoType+isoScope
    assert.equal(entries[0].isoType, 'L', 'isoLanguageType "Living" must bridge to isoType "L"');
    assert.equal(entries[0].isoScope, 'I', '"Individual" must heal to the LETTER the consumers test');
    assert.equal(entries[0].modality, 'spoken');
    assert.equal(entries[1].isoType, 'L');
    assert.equal(
      entries[1].isoScope,
      'M',
      '"Macrolanguage" must heal to "M" — taxonomy.js tests isoScope === "M", ' +
        'so the word silently loses every macrolanguage hub',
    );
  });

  it('does not choke on attribution-envelope fields (post-cutover name shape)', async () => {
    const entries = [indexRowToEntry({ code: 'fff', name: 'F' })];
    const { healedEntries } = await healTaxonomyFromCards(entries, cardsDir);
    assert.equal(healedEntries, 1);
    assert.equal(entries[0].isoType, 'L');
    assert.equal(entries[0].isoScope, 'I');
  });
});

describe('tc-index taxonomy: assertTcIndexTaxonomy guard', () => {
  it('throws on a non-empty index where no entry carries isoType', () => {
    const drifted = [indexRowToEntry({ code: 'aaa' }), indexRowToEntry({ code: 'bbb' })];
    assert.throws(
      () => assertTcIndexTaxonomy(drifted, 'unit-test'),
      /056_trading_card_index_taxonomy_fields/,
      'the error must name the migration that fixes the drift',
    );
  });

  it('passes when at least one entry carries isoType', () => {
    const ok = [indexRowToEntry({ code: 'aaa' }), indexRowToEntry(CRK_ROW)];
    assert.doesNotThrow(() => assertTcIndexTaxonomy(ok));
  });

  it('passes on an empty index (a different failure with its own visibility)', () => {
    assert.doesNotThrow(() => assertTcIndexTaxonomy([]));
  });
});

describe('tc-index taxonomy: buildCardFromRemote index-row fallback', () => {
  it('carries taxonomy from the index row when there is no detail blob', () => {
    const card = buildCardFromRemote(CRK_ROW, null);
    assert.equal(card.isoType, 'L');
    assert.equal(card.modality, 'spoken');
    assert.equal(card.isoScope, 'I');
    assert.equal(card.macrolanguage, 'cre');
  });

  it('prefers the detail blob values when both are present', () => {
    const card = buildCardFromRemote(CRK_ROW, {
      detail: { isoType: 'E', macrolanguage: 'xxx' },
    });
    assert.equal(card.isoType, 'E');
    assert.equal(card.macrolanguage, 'xxx');
    assert.equal(card.modality, 'spoken', 'index value survives where detail is silent');
  });
});

describe('tc-index taxonomy: round-trip wiring (source contract)', () => {
  const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');

  it('upload-trading-cards.mjs sends all four taxonomy columns', () => {
    const src = read('mt-eval-arena/scripts/upload-trading-cards.mjs');
    for (const [entryField, column] of TAXONOMY_FIELDS) {
      const mapping = new RegExp(`${column}:\\s*e\\.${entryField}`);
      assert.match(
        src,
        mapping,
        `upload index mapping must send ${column} from e.${entryField} — ` +
          'dropping it re-opens the atRisk=0 hero bug',
      );
    }
  });

  it('upload-trading-cards.mjs preflights the migration-056 columns', () => {
    assert.match(read('mt-eval-arena/scripts/upload-trading-cards.mjs'), /iso_type/);
    assert.match(
      read('mt-eval-arena/scripts/upload-trading-cards.mjs'),
      /056_trading_card_index_taxonomy_fields/,
    );
  });

  it('migration 056 declares all four columns on trading_card_index', () => {
    const sql = read(
      'mt-eval-arena/supabase/migrations/056_trading_card_index_taxonomy_fields.sql',
    );
    for (const [, column] of TAXONOMY_FIELDS) {
      assert.match(
        sql,
        new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${column}`),
        `migration 056 must add the ${column} column`,
      );
    }
  });

  it('the staging builder emits the taxonomy fields on index entries', () => {
    // Post-cutover the builder reads them off the NORMALIZED card (the one
    // adapter), not a separate taxonomy loader — `card.isoScopeInitial`
    // satisfies the isoScope match by prefix, which is exactly the letter
    // the column means.
    const src = read('mt-eval-arena/scripts/build-trading-card-data.mjs');
    for (const [entryField] of TAXONOMY_FIELDS) {
      assert.match(src, new RegExp(`${entryField}:\\s*card\\.${entryField}`));
    }
  });

  it('the ensure script heals from the card SSOT and refuses drifted output', () => {
    const src = read('cli/website/scripts/build-data-from-supabase.mjs');
    assert.match(src, /healTaxonomyFromCards\(/);
    assert.match(src, /assertTcIndexTaxonomy\(/);
  });

  it('the graph generator refuses a taxonomy-less tc-index.json', () => {
    const src = read('cli/website/plugins/shared-data/generateGraphJson.js');
    assert.match(src, /assertTcIndexTaxonomy\(/);
  });
});
