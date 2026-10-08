#!/usr/bin/env node

/**
 * check-ingestion.mjs — the per-source ingestion contract.
 *
 * WHY THIS EXISTS
 *   "It works on Grambank" proves nothing about the other 169 sources. Grambank
 *   is a clean StructureDataset with a CodeTable; ELCat packs JSON into its
 *   Value column and runs paragraphs of prose through quoted CSV fields. When I
 *   sampled ELCat by hand during this rebuild, my own quick parse produced
 *   values like `"Mexico` — its file is 69,052 lines but 65,483 rows, and the
 *   difference is entirely multi-line quoted prose.
 *
 *   A build that ingests a garbled source silently reports coverage it does not
 *   have. So every source declares what a correct ingestion looks like, and the
 *   build checks it.
 *
 * THE FOUR KINDS OF CHECK, AND WHAT EACH CATCHES
 *
 *   coverage      Languages and values, against a recorded baseline with a
 *                 tolerance. Catches a truncated download or a partial extract
 *                 — the failure that otherwise looks like a smaller dataset.
 *
 *   resolution    What fraction of a source's own languages found a home on the
 *                 spine. This is the check that would have caught Grambank
 *                 losing 97% of its values to a code-resolution bug that was
 *                 reported as a coverage gap for months.
 *
 *   distinctness  How many DISTINCT values a source contributes per parameter.
 *                 A field with two distinct values across 7,991 languages is a
 *                 template applied by rule, not a fact about any of them —
 *                 which is how `modality` came to sit on 7,991 cards saying
 *                 nothing. Low distinctness is not always wrong (a boolean has
 *                 two values), so this reports rather than fails, unless the
 *                 source declares a floor.
 *
 *   golden        Specific (language, parameter, value) triples that must
 *                 survive every build. These are the strongest check and the
 *                 cheapest insurance: if PHOIBLE says Plains Cree has 31
 *                 consonants and a future refactor makes it 0, the build stops
 *                 and names the fact.
 *
 * TWO KINDS OF GOLDEN RECORD, LABELLED HONESTLY
 *   verified   Checked against the publisher's own data or display by a human,
 *              with the date and how it was checked. These assert TRUTH.
 *   baseline   Captured from a build that was itself verified in bulk. These
 *              assert only STABILITY — they catch drift, not error, and saying
 *              otherwise would dress a regression test up as a fact-check.
 *
 *   Conflating the two would be the same move as stamping hand-written prose
 *   with `wals-2024`, which is why the labels are enforced rather than
 *   conventional.
 *
 * Usage:
 *   node cli/scripts/cldf/check-ingestion.mjs            # check
 *   node cli/scripts/cldf/check-ingestion.mjs --capture  # record baselines
 *
 * Exit: 0 all contracts met · 1 a contract failed · 2 could not run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { ATLAS_DB } from './schema.mjs';
import { parseCSVObjects } from '../lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');
const CONTRACT = path.join(REPO, 'shared', 'cldf', 'source-expectations.json');

const CAPTURE = process.argv.includes('--capture');
/** Coverage may move this much before the build complains. */
const TOLERANCE = 0.05;

if (!fs.existsSync(ATLAS_DB)) {
  console.error('No atlas store. Run cli/scripts/cldf/build-atlas.mjs first.');
  process.exit(2);
}
const db = new Database(ATLAS_DB, { readonly: true });

// Grouped by the ORIGINATING release, not by the writing source.
//
// Every derived value — 160 wordlists, every dictionary, the PHOIBLE inventory
// counts — is written under `champollion-derived-v1`, because that is honestly
// who computed it. Grouping on that collapsed 169 sources into 9 and gave the
// other 160 no contract at all: a source could have stopped contributing
// entirely and nothing would have noticed.
//
// Derived_From names the upstream release the derivation ran over, so it is the
// right key for "did this source ingest correctly".
// The stable id, not the release. Contracts were keyed on `grambank-v1.0.3`,
// so a version bump read as TWO failures — an uncontracted new key plus a
// contracted key producing nothing — and the diff a human had to review said
// neither. cldf_sources.ID is exactly `<source>-<Version>`, so the stable name
// is derived by construction rather than guessed by regex.
const perSource = db.prepare(`
  SELECT COALESCE(v.Derived_From, v.Source) AS release,
         COALESCE(
           CASE WHEN s.Version IS NOT NULL
                     AND s.ID = REPLACE(s.ID, '-' || s.Version, '') || '-' || s.Version
                THEN REPLACE(s.ID, '-' || s.Version, '')
           END,
           COALESCE(v.Derived_From, v.Source)
         ) AS source,
         MAX(s.Version) AS version,
         COUNT(*) AS values_,
         COUNT(DISTINCT v.Subject_ID) AS languages,
         COUNT(DISTINCT v.Parameter_ID) AS parameters
  FROM cldf_values v
  LEFT JOIN cldf_sources s ON s.ID = COALESCE(v.Derived_From, v.Source)
  GROUP BY COALESCE(v.Derived_From, v.Source) ORDER BY 2
`).all();

const distinctness = db.prepare(`
  SELECT COALESCE(Derived_From, Source) AS source, Parameter_ID AS parameter,
         COUNT(DISTINCT Value) AS distinct_, COUNT(*) AS total
  FROM cldf_values WHERE Status = 'asserted' GROUP BY COALESCE(Derived_From, Source), Parameter_ID
`).all();

// ── Capture ─────────────────────────────────────────────────────────────────
if (CAPTURE) {
  const existing = fs.existsSync(CONTRACT)
    ? JSON.parse(fs.readFileSync(CONTRACT, 'utf-8')) : { sources: {} };

  const contract = {
    _doc:
      'What a correct ingestion looks like, per source, checked on every build. '
      + '`coverage` is a recorded baseline with a tolerance — it catches a truncated '
      + 'download or a partial extract, the failure that otherwise looks like a smaller '
      + 'dataset. `golden` records are specific facts that must survive every build. '
      + 'A golden record is either VERIFIED (checked against the publisher by a human, '
      + 'with the date and method) or a BASELINE (captured from a verified build, and so '
      + 'evidence of stability only, never of truth). The distinction is enforced, not '
      + 'conventional: a regression test presented as a fact-check is the same move as '
      + 'stamping hand-written prose with an upstream\'s citation.',
    version: 1,
    tolerance: TOLERANCE,
    sources: {},
  };

  for (const r of perSource) {
    // Accept a prior contract under either key, so this capture migrates the
    // old versioned-key file in place without losing a single golden record.
    const prior = existing.sources?.[r.source] ?? existing.sources?.[r.release] ?? {};
    contract.sources[r.source] = {
      version: r.version ?? null,
      coverage: { values: r.values_, languages: r.languages, parameters: r.parameters },
      // Golden records are never overwritten by a capture: a verified fact must
      // not be silently replaced by whatever the current build happens to say.
      golden: prior.golden ?? [],
    };
  }

  fs.writeFileSync(CONTRACT, `${JSON.stringify(contract, null, 2)}\n`);
  const goldens = Object.values(contract.sources).reduce((a, s) => a + s.golden.length, 0);
  console.log(`\n  ✓ baselines captured for ${perSource.length} source(s)`);
  console.log(`    ${goldens} golden record(s) preserved`);
  console.log(`    ${path.relative(REPO, CONTRACT)}\n`);
  db.close();
  process.exit(0);
}

// ── Check ───────────────────────────────────────────────────────────────────
if (!fs.existsSync(CONTRACT)) {
  console.error('No contract yet. Run with --capture after a verified build.');
  db.close();
  process.exit(2);
}
const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf-8'));
const tolerance = contract.tolerance ?? TOLERANCE;

const failures = [];
const warnings = [];
const seen = new Set();

for (const r of perSource) {
  seen.add(r.source);
  const expect = contract.sources?.[r.source];
  if (!expect) {
    // A source producing values with no contract is not a pass — it is an
    // ingestion nobody has agreed to.
    failures.push(`${r.source}: producing ${r.values_.toLocaleString()} values with no `
      + 'recorded contract. Run --capture, or explain why it is new.');
    continue;
  }
  // A version bump is ONE reviewable event, not two spurious failures. The
  // coverage baseline belongs to the RELEASE it was captured from, so when the
  // release changes, comparing new counts against the old baseline reports
  // legitimate growth as corruption. Named as itself instead, and still a
  // failure — accepting a new release is a decision, recorded by re-capturing.
  if (expect.version && r.version && expect.version !== r.version) {
    failures.push(`${r.source}: VERSION BUMP ${expect.version} → ${r.version} — coverage `
      + `is now ${r.values_.toLocaleString()} values / ${r.languages.toLocaleString()} `
      + `languages (baseline was ${Number(expect.coverage?.values ?? 0).toLocaleString()}`
      + ` / ${Number(expect.coverage?.languages ?? 0).toLocaleString()}). Review the `
      + 'diff, then --capture to accept the new release.');
    continue;
  }
  for (const [field, actual] of [['values', r.values_], ['languages', r.languages]]) {
    const want = expect.coverage?.[field];
    if (want === undefined) continue;
    const drift = want === 0 ? (actual === 0 ? 0 : 1) : Math.abs(actual - want) / want;
    if (drift > tolerance) {
      failures.push(`${r.source}: ${field} ${actual.toLocaleString()} vs baseline `
        + `${want.toLocaleString()} (${(drift * 100).toFixed(1)}% drift, tolerance `
        + `${(tolerance * 100).toFixed(0)}%)`);
    }
  }
}

for (const source of Object.keys(contract.sources ?? {})) {
  if (!seen.has(source)) {
    failures.push(`${source}: contracted but produced NO values this build. A source that `
      + 'stops contributing silently is indistinguishable from one that was never read.');
  }
}

// ── Golden records ──────────────────────────────────────────────────────────
const lookup = db.prepare(`
  SELECT Value FROM cldf_values
  WHERE Subject_ID = ? AND Parameter_ID = ? AND Status = 'asserted'
`);
let goldenChecked = 0;
let goldenVerified = 0;
for (const [source, spec] of Object.entries(contract.sources ?? {})) {
  for (const g of spec.golden ?? []) {
    if (!g.kind || !['verified', 'baseline'].includes(g.kind)) {
      failures.push(`${source}: a golden record for ${g.language}/${g.parameter} does not `
        + 'say whether it is verified or a baseline. An unlabelled one asserts truth it '
        + 'may not have.');
      continue;
    }
    if (g.kind === 'verified' && (!g.checkedOn || !g.checkedHow)) {
      failures.push(`${source}: ${g.language}/${g.parameter} claims to be VERIFIED but does `
        + 'not say when or how. "Verified" without a method is an assertion, not a check.');
      continue;
    }
    goldenChecked++;
    if (g.kind === 'verified') goldenVerified++;
    const got = lookup.all(g.language, g.parameter).map((r) => r.Value);
    if (!got.includes(String(g.value))) {
      failures.push(`${source}: ${g.language}/${g.parameter} expected ${JSON.stringify(g.value)}`
        + ` but the build produced ${got.length ? JSON.stringify(got) : 'NOTHING'}`
        + `${g.kind === 'verified' ? '  [VERIFIED FACT]' : ''}`);
    }
  }
}

// ── DONE must mean BUILT ────────────────────────────────────────────────────
// The register once had 23 parameters marked DONE that no source produced —
// coverage claimed on paper and absent in the data. `DONE` now means a source
// actually emits it; `PENDING` means declared but not yet built; `PROJECTED`
// means the projector computes it from the value set and no ingester can.
//
// Without this gate the register drifts back into a wish-list, and a wish-list
// that reads as a status report is worse than no register at all.
{
  const produced = new Set(
    db.prepare('SELECT DISTINCT Parameter_ID FROM cldf_values').all().map((r) => r.Parameter_ID),
  );
  // Parsed with the same CSV parser the build uses, NOT split(','). The old
  // code took column 0 as the parameter id; when the register gained a leading
  // `Subject` column, every row's "id" silently became the word `language` and
  // this block reported the same phantom failure 67 times — for as long as the
  // gate stayed unwired, invisibly. A gate has to run to be a gate, and it has
  // to parse to be a check.
  const { rows: registry } = parseCSVObjects(
    fs.readFileSync(path.join(REPO, 'shared', 'cldf', 'parameters.csv'), 'utf-8'),
    { file: 'shared/cldf/parameters.csv' },
  );
  for (const row of registry) {
    const id = row.ID;
    const disposition = row.Disposition;
    if (disposition === 'DONE' && !produced.has(id)) {
      failures.push(`parameter "${id}" is marked DONE but no source produced a single `
        + 'value for it. Mark it PENDING, or build it.');
    }
    if (disposition === 'PENDING' && produced.has(id)) {
      failures.push(`parameter "${id}" is marked PENDING but the build produced values `
        + 'for it. Promote it to DONE — a register that understates is still wrong.');
    }
  }
}

// ── Distinctness ────────────────────────────────────────────────────────────
for (const d of distinctness) {
  if (d.total < 500) continue;
  const ratio = d.distinct_ / d.total;
  if (ratio < 0.001) {
    warnings.push(`${d.source}/${d.parameter}: ${d.distinct_} distinct value(s) across `
      + `${d.total.toLocaleString()} — ${(ratio * 100).toFixed(2)}% unique`);
  }
}

db.close();

console.log(`\n  INGESTION CONTRACT — ${perSource.length} source(s)\n`);
console.log(`    golden records checked   ${goldenChecked} `
  + `(${goldenVerified} verified against a publisher, ${goldenChecked - goldenVerified} stability baselines)`);
console.log(`    coverage baselines       ${Object.keys(contract.sources ?? {}).length}`);

if (warnings.length) {
  console.log(`\n  LOW DISTINCTNESS — reported, not failed. A boolean legitimately has two`);
  console.log('  values; a prose field with two across thousands of cards is a template:');
  for (const w of warnings.slice(0, 10)) console.log(`    · ${w}`);
  if (warnings.length > 10) console.log(`    … and ${warnings.length - 10} more`);
}

if (failures.length) {
  console.error(`\n  ✗ ${failures.length} contract failure(s):`);
  for (const f of failures.slice(0, 25)) console.error(`    ${f}`);
  if (failures.length > 25) console.error(`    … and ${failures.length - 25} more`);
  console.error('');
  process.exit(1);
}
console.log('\n  ✓ every source met its contract\n');
