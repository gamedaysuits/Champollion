/**
 * tc-index round-trip helpers — the Supabase trading_card_index →
 * data/tc-index.json reconstruction mapping, plus the taxonomy heal/guard
 * lane shared by the `ensure-tc-index` build step and the graph generator.
 *
 * CommonJS on purpose: consumed by BOTH the ESM build script
 * (scripts/build-data-from-supabase.mjs, via Node's CJS interop) and the
 * CommonJS Docusaurus plugin (plugins/shared-data/generateGraphJson.js).
 *
 * Why the taxonomy lane exists (latent hero bug, found 2026-07-19): the
 * upload mapping (mt-eval-arena/scripts/upload-trading-cards.mjs)
 * historically never sent isoType/modality/isoScope/macrolanguage — the
 * table had no such columns before migration 056 — so a DB-reconstructed
 * tc-index.json carried NO taxonomy, and the homepage graph generator
 * silently baked its living/at-risk stats to 0 (living = isoType 'L';
 * at-risk rides on living). healTaxonomyFromCards() joins the fields back
 * from the language-card SSOT; assertTcIndexTaxonomy() refuses to let a
 * taxonomy-less index reach any consumer.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');

/**
 * Index-entry taxonomy fields ⇄ trading_card_index columns (migration 056),
 * in the staging build's field order (build-trading-card-data.mjs).
 */
const TAXONOMY_FIELDS = [
  ['modality', 'modality'],
  ['isoType', 'iso_type'],
  ['isoScope', 'iso_scope'],
  ['macrolanguage', 'macrolanguage'],
];

/**
 * Inverse of the camelCase→snake_case upload mapping in
 * mt-eval-arena/scripts/upload-trading-cards.mjs — keep in sync (the
 * cli/test/tc-index-taxonomy.test.js contract test pins the taxonomy
 * fields on both sides).
 */
function indexRowToEntry(row) {
  return {
    code: row.code,
    name: row.name,
    nativeName: row.native_name,
    family: row.family,
    genus: row.genus,
    macroarea: row.macroarea,
    isIsolate: row.is_isolate || false,
    // Taxonomy badging (columns since migration 056) — null, not undefined,
    // when the row predates the migration, so the heal lane and consumers
    // see a stable shape.
    modality: row.modality ?? null,
    isoType: row.iso_type ?? null,
    isoScope: row.iso_scope ?? null,
    macrolanguage: row.macrolanguage ?? null,
    speakers: row.speakers,
    speakerCount: row.speaker_count || 0,
    script: row.script,
    scriptName: row.script_name,
    scripts: row.scripts || [],
    // No 'ltr' default: the column is NULL where no cited script/direction
    // exists, and manufacturing a direction in DATA is how 953 reconstructed
    // rows came to disagree with the staged truth. Consumers that need a
    // rendering fallback apply it at render time.
    dir: row.dir ?? null,
    // Resolution identity (columns since migration 032) — dropped here for
    // months, which is why Atlas search never saw aliases on the
    // reconstruction path.
    aliases: row.aliases || [],
    iso639_1: row.iso639_1 ?? null,
    // A badge whose source is 'default' is the tc build's retired
    // unassessed-guess lane ('thriving' stamped with no AES evidence). The
    // runtime loader already drops it (languageLoader.transformIndexRow),
    // but this reconstruction feeds the BUILD-TIME graph generator too —
    // without the same guard a stale Supabase snapshot paints unassessed
    // (incl. ancient/extinct) languages as thriving in graph.json.
    vitalityBadge: row.vitality_badge?.source === 'default' ? null : (row.vitality_badge || {}),
    rarity: row.rarity || {},
    rarityOrder: row.rarity_order || 0,
    digitalToolkit: row.digital_toolkit || {},
    abilities: row.abilities || [],
    stats: row.stats || null,
    pipelineLabel: row.pipeline_label,
    pipelineEmoji: row.pipeline_emoji,
    factCount: row.fact_count || 0,
    sourceCount: row.source_count || 0,
    hasVocabulary: row.has_vocabulary || false,
    hasTypology: row.has_typology || false,
    hasPhonology: row.has_phonology || false,
    hasNearest: row.has_nearest || false,
    hasNaturalPair: row.has_natural_pair || false,
    hasCultural: row.has_cultural || false,
    hasConflicts: row.has_conflicts || false,
    dialectCount: row.dialect_count,
    regions: row.regions || [],
    ancestry: row.ancestry || [],
    glottocode: row.glottocode,
    culturalAphorism: row.cultural_aphorism,
    narrative: null,
  };
}

/**
 * Fill round-trip-dropped taxonomy fields from the language-card SSOT
 * (cli/shared/language-cards/*.json), read through the ONE JS card adapter
 * — normalizeCard in cli/lib/cards/reader.js. Post-atlas-cutover raw cards
 * carry `isoLanguageType: "Living"` (word, no `isoType` at all) and
 * `isoScope: "Individual"|"Macrolanguage"` (word); a bare JSON.parse copy
 * would leave isoType unfilled (assertTcIndexTaxonomy then hard-throws the
 * build) or fill isoScope with the word, which
 * cli/website/src/utils/taxonomy.js tests against the LETTER ('M') and so
 * silently loses every macrolanguage hub. The adapter bridges isoType from
 * the isoLanguageType initial and offers isoScopeInitial (the letter)
 * alongside the word; old-shape cards already carry the letter and pass
 * through unchanged.
 *
 * Async because reader.js is ESM and this file is CJS (engines >= 20.11 —
 * no sync require(esm)); the adapter comes in via dynamic import.
 *
 * Fill-only: a value already on the entry (a real migration-056 column
 * value) is never overridden. Mutates entries in place.
 *
 * @param {Array<object>} entries - camelCase index entries
 * @param {string} cardsDir - path to cli/shared/language-cards
 * @returns {Promise<{healedEntries: number, filledFields: number}>}
 */
async function healTaxonomyFromCards(entries, cardsDir) {
  const { normalizeCard } = await import(
    pathToFileURL(path.resolve(__dirname, '../../../lib/cards/reader.js')).href
  );

  const byCode = new Map();
  for (const file of fs.readdirSync(cardsDir)) {
    if (!file.endsWith('.json') || file === 'language-tree.json') continue;
    let card;
    try {
      card = normalizeCard(
        JSON.parse(fs.readFileSync(path.join(cardsDir, file), 'utf-8')),
      );
    } catch {
      continue; // unparseable/unnormalizable card — the card linter owns that problem
    }
    byCode.set(card.code || file.replace('.json', ''), card);
  }

  // What the tc-index contract takes from a NORMALIZED card, per taxonomy
  // field. isoType is the adapter's bridge (isoLanguageType "Living" → 'L');
  // isoScope must be the LETTER ('I'/'M') — normalizeCard deliberately does
  // not rewrite the word, it offers isoScopeInitial alongside it, and it
  // derives isoScopeInitial from old-shape letter values too, so
  // isoScopeInitial covers both shapes (the ?? is a belt for cards where
  // isoScope is not a string at all).
  const CARD_TAXONOMY_VALUE = {
    modality: (card) => card.modality,
    isoType: (card) => card.isoType,
    isoScope: (card) => card.isoScopeInitial ?? card.isoScope,
    macrolanguage: (card) => card.macrolanguage,
  };

  let healedEntries = 0;
  let filledFields = 0;
  for (const entry of entries) {
    const card = byCode.get(entry.code);
    if (!card) continue;
    let touched = false;
    for (const [field] of TAXONOMY_FIELDS) {
      const value = CARD_TAXONOMY_VALUE[field](card);
      if (entry[field] == null && value != null) {
        entry[field] = value;
        filledFields += 1;
        touched = true;
      }
    }
    if (touched) healedEntries += 1;
  }
  return { healedEntries, filledFields };
}

/**
 * Refuse an index whose entries ALL lack isoType — the signature of a
 * schema-drifted Supabase round-trip (pre-056 columns, never-backfilled
 * rows, and no card SSOT to heal from). Baking such an index would
 * silently zero the homepage living/at-risk hero stats. All but a handful
 * of real catalog entries carry isoType, so a single surviving value
 * passes; an empty index is a different failure with its own visibility
 * and passes too.
 *
 * @param {Array<object>} entries - camelCase index entries
 * @param {string} [sourceLabel] - where the entries came from (error text)
 */
function assertTcIndexTaxonomy(entries, sourceLabel = 'tc-index.json') {
  if (!Array.isArray(entries) || entries.length === 0) return;
  if (entries.some((e) => e && e.isoType != null)) return;
  throw new Error(
    `[tc-index] ${sourceLabel}: ${entries.length} entries and NONE carries ` +
      'isoType — a schema-drifted Supabase round-trip (the trading_card_index ' +
      'taxonomy columns of migration 056 are absent or were never backfilled). ' +
      'Consuming this index would silently zero the homepage living/at-risk ' +
      'stats. Fix: apply mt-eval-arena/supabase/migrations/' +
      '056_trading_card_index_taxonomy_fields.sql and re-run ' +
      'mt-eval-arena/scripts/upload-trading-cards.mjs, or rebuild in a ' +
      'checkout where cli/shared/language-cards/ is present so the taxonomy ' +
      'heals from the card SSOT — then refresh with ' +
      '`npm run ensure-tc-index -- --force`.',
  );
}

module.exports = {
  TAXONOMY_FIELDS,
  indexRowToEntry,
  healTaxonomyFromCards,
  assertTcIndexTaxonomy,
};
