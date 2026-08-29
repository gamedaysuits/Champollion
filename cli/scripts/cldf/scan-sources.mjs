#!/usr/bin/env node

/**
 * scan-sources.mjs — what is on disk, what the manifest declares, and the gap.
 *
 * WHY THE GAP MUST BE VISIBLE
 *   203 sources are fetched and pinned. A source the manifest does not mention
 *   contributes nothing to the atlas — which is a perfectly good decision, and
 *   an appalling accident. The difference between the two is whether anybody
 *   can see it, so this prints the gap and `--write` closes it by DECLARING
 *   entries in the tracked manifest rather than by inferring them at build time.
 *
 *   Generated, not typed: hand-transcribing 152 entries produces exactly the
 *   drift this rebuild exists to remove. What is generated is the DRAFT; the
 *   manifest is reviewed and committed like any other decision.
 *
 * WHAT IT REFUSES TO DRAFT
 *   - No-derivatives sources. Their values must never be ingested, so they are
 *     marked metadataOnly with the licence as the reason.
 *   - Sources with no recorded licence. We do not guess on a rights-holder's
 *     behalf, and a source whose terms we cannot establish does not ship.
 *   - Modules with no handler. A StructureDataset needs a parameterMap somebody
 *     has thought about; drafting an empty one would look like coverage.
 *
 * Usage:
 *   node cli/scripts/cldf/scan-sources.mjs          # report
 *   node cli/scripts/cldf/scan-sources.mjs --write  # draft the safe entries
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moduleOf } from './ingest-structure.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');
const DATA = path.join(REPO, 'cli', 'data');
const MANIFEST = path.join(REPO, 'shared', 'cldf', 'source-manifest.json');

const NO_DERIVATIVES = /(-ND-|-ND$|NoDerivat)/i;
/**
 * A licence we could not establish from the SNAPSHOT, the dataset's own CLDF
 * descriptor, or the Zenodo record. Zenodo's "other-open" says a deposit is open
 * without saying on what terms, and no permission may be inferred from that.
 */
const UNESTABLISHED = /^LicenseRef-Unestablished/i;
/** Modules we can draft an entry for without a human deciding what it means. */
const AUTO_DRAFTABLE = new Set(['Wordlist', 'Dictionary']);

const WRITE = process.argv.includes('--write');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));

const rows = [];
for (const name of fs.readdirSync(DATA).sort()) {
  const dir = path.join(DATA, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (!fs.existsSync(path.join(dir, 'SNAPSHOT.json'))) continue;

  const snap = JSON.parse(fs.readFileSync(path.join(dir, 'SNAPSHOT.json'), 'utf-8'));
  const license = snap.license ?? snap.licence ?? null;
  let module = null;
  try { module = moduleOf(dir); } catch { module = null; }

  rows.push({
    name,
    module,
    license,
    declared: Boolean(manifest.sources[name]),
    noDerivatives: license ? NO_DERIVATIVES.test(license) : false,
  });
}

const declared = rows.filter((r) => r.declared);
const undeclared = rows.filter((r) => !r.declared);

console.log(`\n  ${rows.length} pinned source(s) on disk · ${declared.length} declared in the manifest\n`);

const byModule = {};
for (const r of undeclared) {
  const k = r.module ?? '(no CLDF descriptor)';
  (byModule[k] ??= []).push(r);
}
console.log('  UNDECLARED, by module:');
for (const [m, list] of Object.entries(byModule).sort((a, b) => b[1].length - a[1].length)) {
  const nd = list.filter((r) => r.noDerivatives).length;
  const noLicense = list.filter((r) => !r.license).length;
  console.log(`    ${String(list.length).padStart(4)}  ${m.padEnd(24)}`
    + `${AUTO_DRAFTABLE.has(m) ? 'draftable' : 'needs a human'}`
    + `${nd ? `  · ${nd} no-derivatives` : ''}`
    + `${noLicense ? `  · ${noLicense} NO RECORDED LICENCE` : ''}`);
}

const blocked = rows.filter((r) => r.noDerivatives);
if (blocked.length) {
  console.log('\n  NO-DERIVATIVES — values must never be ingested, metadata only:');
  for (const r of blocked) console.log(`    ${r.name.padEnd(24)} ${r.license}`);
}

const unlicensed = rows.filter((r) => !r.license);
if (unlicensed.length) {
  console.log('\n  NO RECORDED LICENCE — cannot ship until resolved:');
  for (const r of unlicensed) console.log(`    ${r.name}`);
}

if (!WRITE) {
  console.log('\n  Re-run with --write to draft entries for the draftable modules.\n');
  process.exit(0);
}

let drafted = 0;
let skippedNd = 0;
let skippedUnlicensed = 0;
for (const r of undeclared) {
  if (!r.license) { skippedUnlicensed++; continue; }
  if (r.noDerivatives || UNESTABLISHED.test(r.license)) {
    manifest.sources[r.name] = {
      module: r.module,
      license: r.license,
      contributes: 'nothing — metadata only',
      metadataOnly: true,
      metadataOnlyReason: r.noDerivatives
        ? `${r.license} forbids derivative distribution. Values are never ingested and no `
          + 'count is computed over them; the resource is recorded as existing, with its '
          + 'DOI and coverage, which is a fact about a published dataset rather than a '
          + 'derivative of its content.'
        : 'No licence could be established from the SNAPSHOT, the CLDF descriptor, or the '
          + 'Zenodo record. Nothing is ingested, because no permission is inferred from '
          + 'silence. See shared/cldf/licence-reconciliation.json.',
    };
    skippedNd++;
    continue;
  }
  if (!AUTO_DRAFTABLE.has(r.module)) continue;

  manifest.sources[r.name] = {
    module: r.module,
    handler: 'lexical',
    license: r.license,
    contributes: 'lexical resource existence and coverage',
    note: 'Existence and coverage only. A wordlist says how a language expresses a '
      + 'concept; it is not evidence of typology, and nothing typological is derived '
      + 'from it.',
  };
  drafted++;
}

// Deterministic key order so the file does not churn.
manifest.sources = Object.fromEntries(
  Object.entries(manifest.sources).sort(([a], [b]) => a.localeCompare(b)),
);
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`\n  ✓ drafted ${drafted} wordlist/dictionary entr(ies)`);
console.log(`    ${skippedNd} marked metadataOnly (no-derivatives)`);
console.log(`    ${skippedUnlicensed} skipped — no recorded licence`);
console.log(`    ${Object.keys(manifest.sources).length} sources now declared\n`);
console.log('  These are DRAFTS in a tracked file. Review before committing.\n');
