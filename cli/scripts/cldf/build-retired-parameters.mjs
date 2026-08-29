#!/usr/bin/env node

/**
 * build-retired-parameters.mjs — carry the field-disposition decisions into the
 * CLDF decision layer, verbatim.
 *
 * WHY THIS EXISTS AS A SCRIPT AND NOT AS TYPING
 *   `shared/card-field-disposition.json` records, for every field that will NOT
 *   be projected, the measured reason it was retired — distinct-value counts,
 *   a missing producer, a manufactured claim. Those reasons are evidence and
 *   must survive the move to CLDF unchanged. Re-typing them is how a "0.0%
 *   unique" becomes an "almost no variation", and then a judgement call.
 *
 *   So the retirement register is GENERATED from the decisions, and the
 *   generator is the only thing that writes it.
 *
 * WHAT IT ADDS
 *   The six curated-lane fields. They were DONE under the old spec because a
 *   curated file fed them — but that file is
 *   `shared/curated-facts/language-facts.json`, stamped
 *   `_migratedFrom: cli/shared/language-cards/`: the previous corpus read back
 *   in as though it were a source. Retiring them here is the decision that
 *   makes the archive real rather than nominal.
 *
 * Usage:
 *   node cli/scripts/cldf/build-retired-parameters.mjs [--check]
 *
 * Exit: 0 ok · 1 --check found the file out of date
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeCSV } from '../lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');
const DISPOSITION = path.join(REPO, 'shared', 'card-field-disposition.json');
const OUT = path.join(REPO, 'shared', 'cldf', 'retired-parameters.csv');

/**
 * The six fields fed by the migrated curated file. Each carries the reason it
 * is retired NOW, which is not the reason the old register recorded — the old
 * register thought they had a source.
 */
const CURATED_LANE_RETIREMENTS = {
  experts: 'RETIRED 2026-08-04 with the curated lane. 1,854 entries whose values are '
    + 'ARCHIVES, not people — {"name":"PARADISEC","type":"institution"} recorded as an '
    + 'expert. A category error, not a thin fact.',
  nativeNameVerdict: 'RETIRED 2026-08-04 with the curated lane. 1,378 endonym '
    + 'adjudications with no citation, authored by "champollion-curation", which is not '
    + 'a person. Replaced by the `nativeName` parameter sourced from Wikidata P1705.',
  culturalAphorism: 'RETIRED 2026-08-04 with the curated lane. 92 proverbs with no '
    + 'attribution, flagged for consent review and never cleared. Cultural expression '
    + 'needs a named holder and enthusiastic consent, not an editorial stamp.',
  history: 'RETIRED 2026-08-04 with the curated lane. Uncited prose migrated out of the '
    + 'previous corpus.',
  notes: 'RETIRED 2026-08-04 with the curated lane. Uncited prose migrated out of the '
    + 'previous corpus.',
  codeSwitching: 'RETIRED 2026-08-04 with the curated lane. Three cards of good but '
    + 'uncited content. Worth re-sourcing; not worth asserting unsourced.',
};

const CURATED_SOURCE = 'shared/curated-facts/language-facts.json (archived 2026-08-04)';

const disposition = JSON.parse(fs.readFileSync(DISPOSITION, 'utf-8'));
const fields = disposition.fields ?? disposition;

const rows = [['ID', 'Card_Field', 'Disposition', 'Retired_Reason', 'Former_Source']];

for (const [name, entry] of Object.entries(fields)) {
  // DONE and PARTIAL are built from a source. PROJECTED is built too — by the
  // projector rather than an ingester — so it belongs in the retirement
  // register no more than DONE does. Listing it would have recorded two live
  // fields (`locale`, `localeScoped`) as retired, which is the precise
  // inversion this register exists to prevent: a future agent reading it would
  // delete something the build still produces.
  if (entry.status === 'DONE' || entry.status === 'PARTIAL'
      || entry.status === 'PROJECTED') continue;
  rows.push([name, name, entry.status, entry.why ?? '', '']);
}

for (const [name, why] of Object.entries(CURATED_LANE_RETIREMENTS)) {
  if (rows.some((r) => r[0] === name)) {
    throw new Error(
      `${name} is retired twice — once by the disposition register and once by the `
      + 'curated-lane list. One reason per retirement, or the register stops being '
      + 'evidence.',
    );
  }
  rows.push([name, name, 'DROP', why, CURATED_SOURCE]);
}

// Deterministic order so the file does not churn between runs.
const header = rows[0];
const body = rows.slice(1).sort((a, b) => a[0].localeCompare(b[0]));
const csv = serializeCSV([header, ...body]);

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
  if (current !== csv) {
    console.error('retired-parameters.csv is out of date with the disposition register.');
    console.error('Run: node cli/scripts/cldf/build-retired-parameters.mjs');
    process.exit(1);
  }
  console.log(`  ✓ retired-parameters.csv matches the register (${body.length} retirements)`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, csv);

const byStatus = body.reduce((a, r) => { a[r[2]] = (a[r[2]] ?? 0) + 1; return a; }, {});
console.log(`\n  ✓ shared/cldf/retired-parameters.csv — ${body.length} retirements`);
for (const [s, n] of Object.entries(byStatus).sort()) {
  console.log(`      ${String(n).padStart(3)} ${s}`);
}
console.log('    Every reason carried verbatim from the disposition register.\n');
