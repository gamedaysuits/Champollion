#!/usr/bin/env node

/**
 * audit-fact-provenance.mjs
 * ─────────────────────────────────────────────────────────────────
 * Standing PROVENANCE-INTEGRITY audit for the atlas (cli/data/atlas.db).
 *
 * Retargeted 2026-08-18 (champollion.db retirement B7). The legacy facts
 * table this audit was written for is retired; much of what it policed is
 * now enforced STRUCTURALLY by the atlas schema:
 *   - cldf_values.Source is a NOT NULL foreign key into cldf_sources
 *     (a value cannot cite a source the store does not know),
 *   - Created_By is NOT NULL (every value names its writer),
 *   - Derived_From is a real column (lineage is data, not a prose note).
 *
 * What remains is exactly what the schema cannot enforce:
 *
 *   (a) DERIVED-MISATTRIBUTED / missing lineage — a champollion-derived value
 *       whose Derived_From is absent: a derivation that cannot name its basis.
 *   (b) DERIVED-MISATTRIBUTED / upstream-labeled derivation — a value whose
 *       Source is an upstream release but whose Created_By is a declared
 *       derivation/aggregation script. Values may be faithful, but the
 *       provenance label is wrong: derived values must carry the
 *       champollion-derived source, never a dataset name. (The canonical
 *       legacy instance: source='grambank-1.0.3', property='wordOrder'.)
 *   (c) COUNTERFEIT / card-stamp orphan — a `_fieldSources` stamp on a
 *       language card naming a source absent from cldf_sources. The card
 *       corpus is projected FROM the atlas, so a stamp the store cannot
 *       identify is an attribution nothing can verify.
 *
 * Read-only — never writes to the database or the cards.
 *
 * Usage:
 *   node cli/scripts/audit-fact-provenance.mjs
 *   node cli/scripts/audit-fact-provenance.mjs --json > audit.json
 *
 * Exit codes:
 *   0  no counterfeit-attributed and no derived-misattributed values
 *   1  counterfeit OR derived-misattributed values found (CI should fail)
 *   2  audit could not run (atlas DB / cards missing etc.)
 *
 * @see docs/FACT_PROVENANCE_AUDIT.md   (history: the legacy facts-table sweep)
 * @see cli/scripts/cldf/build-atlas.mjs
 * ─────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');           // cli/
const DATA = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA, 'atlas.db');
const CARDS_DIR = path.join(ROOT, 'shared', 'language-cards');

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');

if (!fs.existsSync(DB_PATH)) {
  console.error(`ERROR: atlas database not found at ${DB_PATH}`);
  console.error('       Build it with: node cli/scripts/cldf/build-atlas.mjs');
  process.exit(2);
}
if (!fs.existsSync(CARDS_DIR)) {
  console.error(`ERROR: language-cards dir not found at ${CARDS_DIR}`);
  process.exit(2);
}

// Creators that mark a value as an explicit derivation/aggregation product.
// Atlas Created_By values are handler paths (cldf/ingest-*.mjs); the two
// derivation lanes are the aggregate handler and the derive-* handlers.
const DERIVED_CREATOR_RE = /(^|\/)(ingest-aggregate|derive-[^/]*)\.mjs$/;
// The internal derivation source id family (champollion-derived-v1, …).
const DERIVED_SOURCE_RE = /^champollion-derived/;
// Repo-curated sources: we are the upstream, so a derivation writer is fine.
const CURATED_SOURCE_RE = /^curated:/;

const db = new Database(DB_PATH, { readonly: true });

const BUCKETS = ['LEGITIMATE', 'DERIVED-MISATTRIBUTED', 'COUNTERFEIT', 'AMBIGUOUS'];
const totals = Object.fromEntries(BUCKETS.map(b => [b, { pairs: 0, facts: 0 }]));
const findings = []; // every non-LEGITIMATE pair

function record(bucket, entry) {
  totals[bucket].pairs++;
  totals[bucket].facts += entry.facts;
  findings.push({ bucket, ...entry });
}

// ---------------------------------------------------------------------------
// (a) champollion-derived values missing Derived_From
// ---------------------------------------------------------------------------
const missingLineage = db.prepare(`
  SELECT Source AS source, Parameter_ID AS property, Created_By AS creators,
         COUNT(*) AS n
  FROM cldf_values
  WHERE Source LIKE 'champollion-derived%'
    AND (Derived_From IS NULL OR TRIM(Derived_From) = '')
  GROUP BY Source, Parameter_ID, Created_By
`).all();
for (const row of missingLineage) {
  record('DERIVED-MISATTRIBUTED', {
    source: row.source, property: row.property, facts: row.n,
    creators: row.creators,
    note: 'champollion-derived value with NO Derived_From — a derivation that '
      + 'cannot name its basis. Fix the writing handler to record lineage.',
  });
}

// ---------------------------------------------------------------------------
// (b) upstream-sourced values written by a derivation/aggregation script
// ---------------------------------------------------------------------------
const pairs = db.prepare(`
  SELECT Source AS source, Parameter_ID AS property, Created_By AS creators,
         COUNT(*) AS n
  FROM cldf_values
  GROUP BY Source, Parameter_ID, Created_By
`).all();
let totalValues = 0;
for (const p of pairs) {
  totalValues += p.n;
  if (DERIVED_SOURCE_RE.test(p.source) || CURATED_SOURCE_RE.test(p.source)) continue;
  if (DERIVED_CREATOR_RE.test(p.creators || '')) {
    record('DERIVED-MISATTRIBUTED', {
      source: p.source, property: p.property, facts: p.n, creators: p.creators,
      note: `written by derivation script '${p.creators}' but attributed to `
        + `upstream '${p.source}' — must carry the champollion-derived source `
        + 'with Derived_From naming the upstream',
    });
  } else {
    totals.LEGITIMATE.pairs++;
    totals.LEGITIMATE.facts += p.n;
  }
}
// (a)-rows are champollion-derived and were skipped by the loop above; count
// the clean champollion-derived/curated pairs as legitimate.
for (const p of pairs) {
  if (!(DERIVED_SOURCE_RE.test(p.source) || CURATED_SOURCE_RE.test(p.source))) continue;
  const flagged = missingLineage.some(m =>
    m.source === p.source && m.property === p.property && m.creators === p.creators);
  if (!flagged) {
    totals.LEGITIMATE.pairs++;
    totals.LEGITIMATE.facts += p.n;
  }
}

// ---------------------------------------------------------------------------
// (c) card `_fieldSources` stamps naming sources absent from cldf_sources
// ---------------------------------------------------------------------------
// The stamp vocabulary equals the atlas source-id vocabulary (the projector
// writes cldf_sources.ID onto the cards), plus the `derived:`-prefixed and
// internal stamps, whose components after the prefix are recipe inputs, not
// source ids. A stamp outside both vocabularies is an attribution the store
// cannot verify.
const sourceIds = new Set(db.prepare('SELECT ID FROM cldf_sources').all().map(r => r.ID));
const INTERNAL_STAMP_RE = /^(derived([:\-]|$)|champollion-derived|curated:|manual-curation|corpora-cards|template-generated|not-populated)/;

const stampCards = new Map(); // stamp -> {cards: Set, fields: Set}
const collect = (stamp, code, field) => {
  if (typeof stamp !== 'string' || !stamp.trim()) return;
  const s = stamp.trim();
  if (!stampCards.has(s)) stampCards.set(s, { cards: new Set(), fields: new Set() });
  const e = stampCards.get(s);
  e.cards.add(code);
  e.fields.add(field);
};
let scanned = 0, parseErrors = 0;
for (const file of fs.readdirSync(CARDS_DIR)) {
  if (!file.endsWith('.json') || file === 'language-tree.json') continue;
  let card;
  try {
    card = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, file), 'utf8'));
  } catch { parseErrors++; continue; }
  scanned++;
  const code = card.code || file.replace(/\.json$/, '');
  const fsMap = card._fieldSources;
  if (!fsMap || typeof fsMap !== 'object') continue;
  for (const [field, v] of Object.entries(fsMap)) {
    if (typeof v === 'string') collect(v, code, field);
    else if (Array.isArray(v)) for (const s of v) collect(s, code, field);
    else if (v && typeof v === 'object') for (const s of Object.values(v)) collect(s, code, field);
  }
}

const orphanStamps = [];
for (const [stamp, e] of stampCards) {
  if (INTERNAL_STAMP_RE.test(stamp)) continue;
  if (sourceIds.has(stamp)) continue;
  orphanStamps.push({ stamp, cards: e.cards.size, fields: [...e.fields].slice(0, 8) });
  record('COUNTERFEIT', {
    source: stamp, property: [...e.fields].slice(0, 5).join(','), facts: e.cards.size,
    creators: 'card-projection',
    note: `card _fieldSources stamp '${stamp}' names a source absent from `
      + `cldf_sources (${e.cards.size} cards) — an attribution the store `
      + 'cannot verify. Fix the projector or the ingest handler and rebuild.',
  });
}

db.close();

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
if (JSON_OUT) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    db: 'cli/data/atlas.db',
    totalFacts: totalValues,
    cardsScanned: scanned,
    cardParseErrors: parseErrors,
    distinctStamps: stampCards.size,
    totals,
    findings,
    // Retired with the legacy store: stale-code repair was a property of the
    // legacy CSV ingest lane; atlas categorical values join cldf_codes at
    // ingest. Kept as an empty list so downstream parsers need no branch.
    staleBySource: [],
  }, null, 2));
} else {
  console.log(`\n${'═'.repeat(66)}`);
  console.log('  FACT PROVENANCE AUDIT — atlas provenance-integrity sweep');
  console.log(`  DB: ${path.relative(process.cwd(), DB_PATH)}   values: ${totalValues.toLocaleString()}   cards: ${scanned.toLocaleString()}`);
  console.log(`${'═'.repeat(66)}\n`);

  console.log('  BUCKET TOTALS (pairs = distinct source×parameter×creator / stamp):');
  for (const b of BUCKETS) {
    console.log(`    ${b.padEnd(24)} ${String(totals[b].pairs).padStart(6)} pairs ${totals[b].facts.toLocaleString().padStart(12)} facts`);
  }

  for (const bucket of ['COUNTERFEIT', 'DERIVED-MISATTRIBUTED', 'AMBIGUOUS']) {
    const rows = findings.filter(f => f.bucket === bucket).sort((a, b) => b.facts - a.facts);
    if (!rows.length) continue;
    console.log(`\n  ${bucket} (${rows.length} pairs):`);
    for (const f of rows.slice(0, 40)) {
      console.log(`    ${String(f.facts).padStart(7)}  ${f.source} :: ${String(f.property).slice(0, 70)}`);
      console.log(`             ${f.note}`);
    }
    if (rows.length > 40) console.log(`    … and ${rows.length - 40} more (use --json)`);
  }

  if (!findings.length) {
    console.log('\n  ✅ Clean: every derived value carries lineage, no upstream label on a');
    console.log('     derivation, every card stamp resolves to a cldf_sources row.');
  }
  console.log();
}

// Gate contract (unchanged from the legacy sweep, tightened 2026-07-07):
// DERIVED-MISATTRIBUTED is a provenance-integrity failure just like
// COUNTERFEIT — a Champollion derivation carrying an upstream dataset's name
// misrepresents that dataset. Remediate at the ingest handler / projector
// and rebuild the atlas (never hand-edit values or cards).
process.exit(
  (totals.COUNTERFEIT.facts > 0 || totals['DERIVED-MISATTRIBUTED'].facts > 0) ? 1 : 0
);
