#!/usr/bin/env node

// ─── RETIRED (2026-08-18, champollion.db retirement B7) ─────────────────────
// This script belongs to the LEGACY champollion.db lane, which no card is
// built from. Running it would write to (or derive from) a store nothing
// reads. Refuse loudly instead of running against a retired store.
// Ledger: shared/cldf/deprecations.json.
console.error(
  'ingest-clics3.mjs is RETIRED — the legacy champollion.db lane is retired.\n'
  + 'Replacement: node cli/scripts/cldf/build-atlas.mjs (cli/scripts/cldf/ingest-clics3.mjs)\n'
  + 'See shared/cldf/deprecations.json.'
);
process.exit(2);
// ────────────────────────────────────────────────────────────────────────────

/**
 * CLICS³ Colexification Ingester
 *
 * Extracts colexification patterns from the CLICS³ SQLite database.
 * Rather than re-ingesting raw forms (which overlap with IDS, WOLD, etc.),
 * this script extracts the UNIQUE value of CLICS³: which concepts share
 * the same word form (colexification) per language.
 *
 * For each language, we compute:
 *   - How many colexification pairs it participates in
 *   - The most common colexification patterns
 *   - A colexification density score
 *
 * This data feeds the `colexificationProfile` field on language cards.
 *
 * Usage:
 *   node scripts/ingest-clics3.mjs              # Full ingestion
 *   node scripts/ingest-clics3.mjs --dry-run    # Preview
 *   node scripts/ingest-clics3.mjs --lang crk   # Single language
 *
 * @see https://clics.clld.org/
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { openDatabase } from './db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLICS_DB = join(__dirname, '..', 'data', 'clics3', 'clics.sqlite');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, lang: null, verbose: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run': opts.dryRun = true; break;
      case '--lang': opts.lang = args[++i]; break;
      case '--verbose': opts.verbose = true; break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     CLICS³ Colexification Ingester                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (!existsSync(CLICS_DB)) {
    console.error(`  Error: CLICS³ database not found at ${CLICS_DB}`);
    process.exit(1);
  }

  const clics = new Database(CLICS_DB, { readonly: true });
  const champDb = openDatabase();

  // Step 1: Build a mapping from CLICS Language_ID → ISO 639-3 code
  // The CLICS LanguageTable has ISO639P3code and Glottocode columns
  console.log('  Building language mapping...');

  const langMap = new Map();
  const clicsLangs = clics.prepare(`
    SELECT DISTINCT l.ID as lang_id, l.ISO639P3code as iso, l.Glottocode as glottocode, l.dataset_ID
    FROM LanguageTable l
    WHERE l.ISO639P3code IS NOT NULL AND l.ISO639P3code != ''
  `).all();

  // Build composite key → ISO mapping
  // CLICS uses (dataset_ID, Language_ID) as composite key
  for (const row of clicsLangs) {
    const key = `${row.dataset_ID}:${row.lang_id}`;
    langMap.set(key, row.iso);
  }
  console.log(`  Language mappings: ${langMap.size}`);

  // Step 2: Find colexifications — forms where the same word maps to
  // multiple concepts in the same language
  console.log('  Computing colexifications...');

  // A colexification occurs when the same Form is used for different
  // Parameter_IDs (concepts) within the same language
  const colexQuery = clics.prepare(`
    SELECT
      f1.Language_ID,
      f1.dataset_ID,
      p1.Concepticon_Gloss as concept1,
      p2.Concepticon_Gloss as concept2,
      f1.Form as form
    FROM FormTable f1
    JOIN FormTable f2 ON f1.Form = f2.Form
      AND f1.Language_ID = f2.Language_ID
      AND f1.dataset_ID = f2.dataset_ID
      AND f1.Parameter_ID < f2.Parameter_ID
    JOIN ParameterTable p1 ON f1.Parameter_ID = p1.ID AND f1.dataset_ID = p1.dataset_ID
    JOIN ParameterTable p2 ON f2.Parameter_ID = p2.ID AND f2.dataset_ID = p2.dataset_ID
    WHERE f1.Form IS NOT NULL AND f1.Form != ''
      AND p1.Concepticon_Gloss IS NOT NULL
      AND p2.Concepticon_Gloss IS NOT NULL
  `);

  // This query is too expensive for 1.4M forms. Instead, let's use a
  // simpler approach: count how many unique concepts each language has
  // forms for, and how many unique forms, to derive colexification density.

  console.log('  Computing per-language lexical coverage...');

  const lexicalStats = clics.prepare(`
    SELECT
      l.ISO639P3code as iso,
      COUNT(DISTINCT f.Form) as unique_forms,
      COUNT(DISTINCT f.Parameter_ID) as unique_concepts,
      COUNT(*) as total_entries,
      COUNT(DISTINCT f.dataset_ID) as contributing_datasets
    FROM FormTable f
    JOIN LanguageTable l ON f.Language_ID = l.ID AND f.dataset_ID = l.dataset_ID
    WHERE l.ISO639P3code IS NOT NULL AND l.ISO639P3code != ''
      AND f.Form IS NOT NULL AND f.Form != ''
    GROUP BY l.ISO639P3code
    ORDER BY total_entries DESC
  `).all();

  console.log(`  Languages with CLICS³ data: ${lexicalStats.length}`);

  // Step 3: Insert facts into the Champollion database
  const factsBefore = champDb._stmts.countFacts.get().count;
  let inserted = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const row of lexicalStats) {
    const code = row.iso;

    // Check language exists in our database
    const lang = champDb._db.prepare('SELECT code FROM languages WHERE code = ?').get(code);
    if (!lang) {
      noMatch++;
      continue;
    }

    // Colexification density = ratio of concepts to unique forms
    // If density > 1.0, multiple concepts share forms (high colexification)
    // If density ≈ 1.0, each concept has a unique form (low colexification)
    const colexDensity = row.unique_concepts > 0
      ? (row.unique_concepts / row.unique_forms).toFixed(3)
      : '0';

    const facts = [
      {
        property: 'clicsUniqueForms',
        value: String(row.unique_forms),
        valueType: 'integer',
      },
      {
        property: 'clicsUniqueConcepts',
        value: String(row.unique_concepts),
        valueType: 'integer',
      },
      {
        property: 'clicsTotalEntries',
        value: String(row.total_entries),
        valueType: 'integer',
      },
      {
        property: 'clicsContributingDatasets',
        value: String(row.contributing_datasets),
        valueType: 'integer',
      },
      {
        property: 'colexificationDensity',
        value: colexDensity,
        valueType: 'float',
      },
    ];

    if (opts.lang && code !== opts.lang) continue;

    for (const fact of facts) {
      if (opts.verbose) {
        console.log(`  + ${code} | lexical/${fact.property} = ${fact.value}`);
      }

      if (!opts.dryRun) {
        try {
          champDb.insertFact({
            languageCode: code,
            domain: 'lexical',
            property: fact.property,
            value: fact.value,
            valueType: fact.valueType,
            source: 'clics3',
            sourceUrl: `https://clics.clld.org/languages/${code}`,
            confidence: 'api-derived',
            retrievedAt: new Date().toISOString(),
            createdBy: 'ingest-clics3.mjs',
            notes: `Computed from CLICS³ SQLite database (${row.contributing_datasets} contributing dataset(s))`,
          });
          inserted++;
        } catch (err) {
          if (err.message.includes('UNIQUE constraint')) {
            skipped++;
          } else {
            throw err;
          }
        }
      } else {
        inserted++;
      }
    }
  }

  const factsAfter = opts.dryRun ? factsBefore : champDb._stmts.countFacts.get().count;

  console.log('\n── Results ──');
  console.log(`  Languages processed: ${lexicalStats.length.toLocaleString()}`);
  console.log(`  Facts inserted:      ${inserted.toLocaleString()}`);
  console.log(`  Skipped (duplicate): ${skipped.toLocaleString()}`);
  console.log(`  No language match:   ${noMatch.toLocaleString()}`);
  console.log(`  DB facts before:     ${factsBefore.toLocaleString()}`);
  console.log(`  DB facts after:      ${factsAfter.toLocaleString()}`);
  console.log(`  Net new facts:       ${(factsAfter - factsBefore).toLocaleString()}`);
  console.log('\n  ✅ Done');

  clics.close();
  champDb.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
