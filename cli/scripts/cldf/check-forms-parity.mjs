/**
 * check-forms-parity.mjs — per-source accounting of the lexical carry-over.
 *
 * The legacy store (cli/data/champollion.db) holds 3,124,734 facts with
 * domain='lexical' across 189 sources — all unpinned (source_release_id NULL
 * on every row). The atlas carry-over is a RE-INGEST from pinned releases,
 * not a copy, so the row counts will not match — and every delta must be
 * EXPLAINED, per source, rather than waved at:
 *
 *   alias            legacy name ≠ atlas dataset key for the same bytes
 *   not-forms        legacy rows that were never forms (derived aggregates,
 *                    concept-catalog metadata, colexification stats)
 *   junk             the 1-row dictionaria-* tail
 *   license-withheld pinned but not redistributable — counts ship, forms don't
 *   not-pinned       no atlas source yet (the orphan re-pin backlog)
 *   dedupe/off-spine counted difference for sources present on both sides
 *
 * Run while champollion.db still exists; archive the report as a fixture —
 * it is the evidence that retirement lost nothing silently.
 *
 * Usage: node cli/scripts/cldf/check-forms-parity.mjs [--json out.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { ATLAS_DB } from './schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEGACY_DB = path.join(__dirname, '..', '..', 'data', 'champollion.db');

/** Legacy source key → atlas dataset key, where the names differ for the same upstream. */
const ALIASES = new Map([
  ['numeralbank', 'channumerals'],
  // 'sabor'→'seabor' was REMOVED 2026-08-18: they are different datasets, not a
  // rename. sabor = Miller & List 2023 "Borrowing in South American Languages"
  // (lexibank/sabor, 10.5281/zenodo.7591335); seabor = List & Forkel 2021
  // borrowing detection in SEA languages (lexibank/seabor). sabor is now pinned
  // under its own name, so legacy sabor rows match directly.
]);

/** Legacy "lexical" rows that were never per-form data. */
const NOT_FORMS = new Map([
  ['champollion-derived', 'derived aggregates (swadeshConceptsCovered, asjpVarieties, '
    + 'colexifyingForms, conceptsDocumented) — superseded by atlas lexicalResource + CLICS params'],
  ['clics3', 'per-language colexification stats — carried as atlas parameters, not forms'],
  ['concepticon', 'concept-catalog metadata — the mapping reference itself, not language forms'],
  ['panlex', 'panlexExpressionFileSize rows — HuggingFace mirror file sizes per language, '
    + 'resource-extent metadata that was mis-filed as lexical; never forms'],
]);

function datasetKey(sourceId) {
  // -v1.1rc, -v2013.1, -v1.0: a version suffix may carry trailing letters
  // (release candidates), so [\d.]+ alone missed datsemshift-v1.1rc and
  // reported its 52k carried forms as not-pinned.
  return sourceId.replace(/-v\d[\w.]*$/i, '').replace(/-[0-9a-f]{12}$/i, '');
}

const jsonOut = (() => {
  const i = process.argv.indexOf('--json');
  return i > -1 ? process.argv[i + 1] : null;
})();

if (!fs.existsSync(LEGACY_DB)) {
  console.error(`legacy store not found at ${LEGACY_DB} — nothing to compare against. `
    + 'If it has already been retired, this checker\'s archived report is the record.');
  process.exit(1);
}
if (!fs.existsSync(ATLAS_DB)) {
  console.error(`atlas store not found at ${ATLAS_DB} — build it first.`);
  process.exit(1);
}

const legacy = new Database(LEGACY_DB, { readonly: true });
const atlas = new Database(ATLAS_DB, { readonly: true });

const legacyBySource = new Map(legacy.prepare(
  "SELECT source, COUNT(*) AS n FROM facts WHERE domain='lexical' GROUP BY source",
).all().map((r) => [r.source, r.n]));

const atlasBySource = new Map(atlas.prepare(
  'SELECT Source, COUNT(*) AS n FROM cldf_forms GROUP BY Source',
).all().map((r) => [datasetKey(r.Source), { pinned: r.Source, n: r.n }]));

const withheld = new Set(atlas.prepare(`
  SELECT ID FROM cldf_sources WHERE Redistributable = 0
`).all().map((r) => datasetKey(r.ID)));
const pinnedSources = new Set(atlas.prepare('SELECT ID FROM cldf_sources')
  .all().map((r) => datasetKey(r.ID)));

const report = { generatedAt: new Date().toISOString(), sources: [], totals: {} };
let carried = 0; let explained = 0; let unexplainedSources = 0;

for (const [legacySource, legacyN] of [...legacyBySource].sort((a, b) => b[1] - a[1])) {
  const key = ALIASES.get(legacySource) ?? legacySource;
  const atlasRow = atlasBySource.get(key);
  const row = { legacySource, atlasKey: key, legacyRows: legacyN, atlasForms: atlasRow?.n ?? 0 };

  if (NOT_FORMS.has(legacySource)) {
    row.disposition = 'not-forms';
    row.explanation = NOT_FORMS.get(legacySource);
    explained += legacyN;
  } else if (legacyN <= 2 && legacySource.startsWith('dictionaria')) {
    row.disposition = 'junk';
    row.explanation = 'single-row dictionaria tail — dropped with this justification';
    explained += legacyN;
  } else if (atlasRow) {
    row.disposition = 'carried';
    row.pinnedRelease = atlasRow.pinned;
    if (ALIASES.has(legacySource)) row.explanation = `alias of ${key}`;
    carried += atlasRow.n;
    explained += legacyN;
  } else if (withheld.has(key)) {
    row.disposition = 'license-withheld';
    row.explanation = 'pinned, counts carried, forms not redistributable under the pinned license';
    explained += legacyN;
  } else if (pinnedSources.has(key)) {
    row.disposition = 'pinned-no-forms';
    row.explanation = 'atlas pins this source but no forms were written — investigate '
      + '(wrong module? handler skipped?)';
    unexplainedSources++;
  } else {
    // A source can be pinned ON DISK yet absent from cldf_sources: a
    // no-derivatives license makes the build skip it as metadata-only before
    // registerSource ever runs (luangthongkumkaren, CC-BY-NC-ND). That is a
    // license outcome, not a re-pin backlog item.
    const snapPath = path.join(__dirname, '..', '..', 'data', key, 'SNAPSHOT.json');
    let ndOnDisk = null;
    if (fs.existsSync(snapPath)) {
      try {
        const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
        const lic = snap.license ?? snap.licence ?? '';
        if (/(-ND-|-ND$|NoDerivat)/i.test(lic)) ndOnDisk = lic;
      } catch { /* unreadable snapshot — fall through to not-pinned */ }
    }
    if (ndOnDisk) {
      row.disposition = 'license-withheld';
      row.explanation = `pinned on disk but ${ndOnDisk} forbids derivatives — never ingested, `
        + 'forms never carried; a rights-holder decision, not a backlog item';
      explained += legacyN;
    } else {
      row.disposition = 'not-pinned';
      row.explanation = 'no atlas source — orphan re-pin backlog (fetch + SNAPSHOT needed)';
      unexplainedSources++;
    }
  }
  report.sources.push(row);
}

// Atlas-only sources: forms from datasets the legacy store never ingested.
for (const [key, { pinned, n }] of atlasBySource) {
  const legacyKey = [...ALIASES].find(([, v]) => v === key)?.[0] ?? key;
  if (!legacyBySource.has(legacyKey) && !legacyBySource.has(key)) {
    report.sources.push({
      legacySource: null, atlasKey: key, pinnedRelease: pinned,
      legacyRows: 0, atlasForms: n,
      disposition: 'atlas-only', explanation: 'new coverage the legacy store never had',
    });
    carried += n;
  }
}

const legacyTotal = [...legacyBySource.values()].reduce((a, b) => a + b, 0);
report.totals = {
  legacyLexicalRows: legacyTotal,
  atlasForms: [...atlasBySource.values()].reduce((a, r) => a + r.n, 0),
  carriedForms: carried,
  legacyRowsExplained: explained,
  legacyRowsUnexplained: legacyTotal - explained,
  sourcesNeedingAction: unexplainedSources,
};

const byDisposition = {};
for (const s of report.sources) {
  byDisposition[s.disposition] = (byDisposition[s.disposition] ?? 0) + 1;
}
report.totals.sourcesByDisposition = byDisposition;

const n = (x) => x.toLocaleString('en-US');
console.log(`legacy lexical rows: ${n(legacyTotal)} across ${legacyBySource.size} sources`);
console.log(`atlas forms:         ${n(report.totals.atlasForms)}`);
console.log(`dispositions: ${Object.entries(byDisposition)
  .map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`legacy rows explained: ${n(explained)} / ${n(legacyTotal)} `
  + `(${Math.round((explained / legacyTotal) * 100)}%)`);
if (unexplainedSources) {
  console.log(`\n${unexplainedSources} source(s) need action:`);
  for (const s of report.sources) {
    if (s.disposition === 'not-pinned' || s.disposition === 'pinned-no-forms') {
      console.log(`  ${(s.legacySource ?? s.atlasKey).padEnd(28)} ${n(s.legacyRows).padStart(9)} `
        + `rows  ${s.disposition}`);
    }
  }
}

if (jsonOut) {
  fs.writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nreport → ${jsonOut}`);
}

legacy.close();
atlas.close();
process.exit(report.totals.legacyRowsUnexplained > 0 ? 2 : 0);
