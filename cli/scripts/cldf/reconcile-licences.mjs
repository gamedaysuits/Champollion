#!/usr/bin/env node

/**
 * reconcile-licences.mjs — the SNAPSHOT and the dataset's own descriptor,
 * compared.
 *
 * WHY TWO PLACES DISAGREE AT ALL
 *   A SNAPSHOT records what the FETCHER learned, usually from Zenodo's record
 *   metadata. A CLDF descriptor records what the DEPOSITOR wrote inside the
 *   dataset. They are two statements by two parties about the same rights, and
 *   they are not always the same statement.
 *
 *   Across 203 pinned sources: 186 agree, 3 disagree, 3 have a licence only in
 *   the descriptor, and 1 has neither. The three disagreements are not
 *   cosmetic:
 *
 *     nts             SNAPSHOT CC-BY-NC-ND-2.0 · descriptor CC-BY-NC-2.0
 *                     One says no-derivatives and one does not. That is the
 *                     difference between a source we may build on and one whose
 *                     values must never enter the store.
 *     doreco          SNAPSHOT CC0-1.0 · descriptor CC-BY
 *                     CC0 waives attribution; CC-BY requires it. Taking CC0
 *                     would mean failing to credit a large collaborative corpus.
 *     normansinitic   SNAPSHOT CC-BY-4.0 · descriptor Apache 2.0
 *                     Different licence families entirely.
 *
 * HOW A DISAGREEMENT IS RESOLVED, AND WHY NOT THE USUAL WAY
 *   Everywhere else in this atlas, when sources disagree we keep both and
 *   refuse to pick a winner. A LICENCE is the one place that would be
 *   irresponsible: "two parties disagree about whether we may redistribute
 *   this" is not a fact to display, it is a risk to avoid.
 *
 *   So the MOST RESTRICTIVE reading governs until a human resolves it, both
 *   readings are recorded, and the source is flagged as unresolved. Being
 *   conservative costs us one dataset; being wrong costs the project its
 *   standing with the people whose work it indexes.
 *
 * Usage:
 *   node cli/scripts/cldf/reconcile-licences.mjs           # report
 *   node cli/scripts/cldf/reconcile-licences.mjs --write   # apply + record
 *   node cli/scripts/cldf/reconcile-licences.mjs --check   # CI gate
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');
const DATA = path.join(REPO, 'cli', 'data');
const REGISTER = path.join(REPO, 'shared', 'cldf', 'licence-reconciliation.json');

const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');

/** Normalise a licence URL or loose string to an SPDX-ish identifier. */
export function normaliseLicence(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const cc = s.match(/creativecommons\.org\/licenses\/([a-z-]+)\/([0-9.]+)/i);
  if (cc) return `CC-${cc[1].toUpperCase()}-${cc[2]}`;
  if (/creativecommons\.org\/publicdomain\/zero\/1\.0/i.test(s)) return 'CC0-1.0';
  if (/opensource\.org\/licenses\/GPL-3\.0/i.test(s) || /^GPL[- ]?3/i.test(s)) return 'GPL-3.0';
  if (/opensource\.org\/licenses\/Apache-2\.0/i.test(s) || /^Apache[- ]?2/i.test(s)) return 'Apache-2.0';
  return s;
}

/**
 * How restrictive a licence is, for choosing the safe reading. Higher wins.
 * This is a RANKING FOR SAFETY, not a claim about which licence is "better".
 */
function restrictiveness(l) {
  if (!l) return 100;                       // unknown is the most restrictive of all
  if (/^LicenseRef-/i.test(l)) return 90;   // bespoke: no permission may be inferred
  if (/-ND/i.test(l)) return 80;            // no derivatives
  if (/-NC/i.test(l)) return 60;            // non-commercial
  if (/-SA/i.test(l)) return 40;            // share-alike
  // Apache and GPL carry NOTICE and copyleft obligations a bare CC-BY does not.
  if (/^(Apache|GPL|LGPL|MPL)/i.test(l)) return 30;
  // CC-BY requires ATTRIBUTION; CC0 waives everything. So CC-BY is the more
  // restrictive of the two, and an earlier version of this function ranked them
  // equal — which resolved DoReCo to CC0 and would have had us publish a large
  // collaborative corpus without crediting it.
  if (/^CC-?BY/i.test(l)) return 20;
  if (/^CC0/i.test(l)) return 5;
  return 30;
}

const rows = [];
for (const name of fs.readdirSync(DATA).sort()) {
  const dir = path.join(DATA, name);
  const snapPath = path.join(dir, 'SNAPSHOT.json');
  if (!fs.existsSync(snapPath)) continue;

  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
  const descriptorFile = fs.readdirSync(dir).find((f) => f.endsWith('-metadata.json'));
  let descriptor = null;
  if (descriptorFile) {
    try {
      descriptor = JSON.parse(fs.readFileSync(path.join(dir, descriptorFile), 'utf-8'))['dc:license'] ?? null;
    } catch { descriptor = null; }
  }

  const fromSnapshot = normaliseLicence(snap.license ?? snap.licence);
  const fromDescriptor = normaliseLicence(descriptor);
  let state;
  if (!fromSnapshot && !fromDescriptor) state = 'unestablished';
  else if (!fromSnapshot) state = 'descriptor-only';
  else if (!fromDescriptor) state = 'snapshot-only';
  else if (fromSnapshot === fromDescriptor) state = 'agree';
  else state = 'disagree';

  rows.push({ name, fromSnapshot, fromDescriptor, state, snapPath });
}

const by = (s) => rows.filter((r) => r.state === s);
const disagree = by('disagree');
const descriptorOnly = by('descriptor-only');
const unestablished = by('unestablished');

console.log(`\n  ${rows.length} pinned source(s)\n`);
console.log(`    agree            ${String(by('agree').length).padStart(4)}`);
console.log(`    snapshot only    ${String(by('snapshot-only').length).padStart(4)}  (no licence in the descriptor)`);
console.log(`    descriptor only  ${String(descriptorOnly.length).padStart(4)}  (SNAPSHOT was null)`);
console.log(`    DISAGREE         ${String(disagree.length).padStart(4)}`);
console.log(`    unestablished    ${String(unestablished.length).padStart(4)}`);

if (disagree.length) {
  console.log('\n  DISAGREEMENTS — the safe reading governs until a human resolves each:');
  for (const r of disagree) {
    const safe = restrictiveness(r.fromSnapshot) >= restrictiveness(r.fromDescriptor)
      ? r.fromSnapshot : r.fromDescriptor;
    console.log(`    ${r.name.padEnd(20)} snapshot=${String(r.fromSnapshot).padEnd(18)}`
      + `descriptor=${String(r.fromDescriptor).padEnd(18)}→ ${safe}`);
  }
}
if (descriptorOnly.length) {
  console.log('\n  LICENCE ONLY IN THE DESCRIPTOR — the fetcher missed it:');
  for (const r of descriptorOnly) console.log(`    ${r.name.padEnd(20)} ${r.fromDescriptor}`);
}
if (unestablished.length) {
  console.log('\n  UNESTABLISHED — cannot ship, and no permission may be inferred:');
  for (const r of unestablished) console.log(`    ${r.name}`);
}

if (CHECK) {
  const register = fs.existsSync(REGISTER)
    ? JSON.parse(fs.readFileSync(REGISTER, 'utf-8')) : { entries: {} };
  const unrecorded = [...disagree, ...unestablished]
    .filter((r) => !register.entries?.[r.name]);
  if (unrecorded.length) {
    console.error(`\n  ✗ ${unrecorded.length} licence question(s) not recorded in `
      + `shared/cldf/licence-reconciliation.json: ${unrecorded.map((r) => r.name).join(', ')}`);
    console.error('    An open licence question that nobody has written down is one');
    console.error('    somebody will answer by assuming.');
    process.exit(1);
  }
  console.log('\n  ✓ every licence question is recorded\n');
  process.exit(0);
}

if (!WRITE) {
  console.log('\n  Re-run with --write to apply the safe reading and record the evidence.\n');
  process.exit(0);
}

// ── Apply ───────────────────────────────────────────────────────────────────
// MERGE, never rebuild. Once a SNAPSHOT has been corrected the source stops
// looking like a question, so a register regenerated from the current state
// would quietly forget that there ever was one. The first run of this script
// did exactly that: it recorded seven questions, and the second run — after its
// own corrections had landed — wrote a register containing three, dropping
// petersonsouthasia's unestablished licence altogether.
//
// An open licence question that nobody has written down is one somebody will
// eventually answer by assuming.
const existing = fs.existsSync(REGISTER)
  ? JSON.parse(fs.readFileSync(REGISTER, 'utf-8')) : { entries: {} };
const register = { _doc: '', version: 1, entries: { ...(existing.entries ?? {}) } };
register._doc =
  'Licence questions found by comparing each SNAPSHOT against the dataset\'s own CLDF '
  + 'descriptor. Where the two disagree the MOST RESTRICTIVE reading governs — a licence '
  + 'is the one place this atlas does not keep both answers and let the reader decide, '
  + 'because "two parties disagree about whether we may redistribute this" is a risk to '
  + 'avoid rather than a fact to display. Every entry here is UNRESOLVED and awaits a '
  + 'human: resolving one means reading the deposit, not choosing.';

let applied = 0;
for (const r of [...disagree, ...descriptorOnly, ...unestablished]) {
  const snap = JSON.parse(fs.readFileSync(r.snapPath, 'utf-8'));

  if (r.state === 'descriptor-only') {
    snap.license = r.fromDescriptor;
    snap.licenceEvidence = `Read from the dataset's own CLDF descriptor (dc:license). The `
      + 'fetcher recorded none, which is why this was backfilled rather than guessed.';
    register.entries[r.name] = {
      question: 'The SNAPSHOT had no licence; the descriptor did.',
      snapshot: null,
      descriptor: r.fromDescriptor,
      applied: r.fromDescriptor,
      resolved: true,
      note: 'Not a conflict — a gap the fetcher left, filled from the depositor\'s own statement.',
    };
  } else if (r.state === 'unestablished') {
    snap.license = `LicenseRef-Unestablished-${r.name}`;
    snap.licenceEvidence = 'Neither the SNAPSHOT nor the CLDF descriptor states a licence. '
      + 'Zenodo records it as "other-open", which says the deposit is open without saying '
      + 'on what terms. No permission is inferred from that.';
    register.entries[r.name] = {
      question: 'No licence stated anywhere we can see.',
      snapshot: null,
      descriptor: null,
      applied: `LicenseRef-Unestablished-${r.name}`,
      resolved: false,
      note: 'Ingested as metadata only. Resolving this means reading the deposit or asking '
        + 'the depositor — not picking something plausible.',
    };
  } else {
    const safe = restrictiveness(r.fromSnapshot) >= restrictiveness(r.fromDescriptor)
      ? r.fromSnapshot : r.fromDescriptor;
    snap.license = safe;
    snap.licenceEvidence = `The SNAPSHOT recorded ${r.fromSnapshot} and the dataset's own `
      + `CLDF descriptor records ${r.fromDescriptor}. The more restrictive of the two `
      + `(${safe}) governs until a human resolves it.`;
    register.entries[r.name] = {
      question: 'The SNAPSHOT and the descriptor state different licences.',
      snapshot: r.fromSnapshot,
      descriptor: r.fromDescriptor,
      applied: safe,
      resolved: false,
      note: 'The safe reading, not the true one. Resolving it means reading the deposit.',
    };
  }

  fs.writeFileSync(r.snapPath, `${JSON.stringify(snap, null, 2)}\n`);
  applied++;
}

register.entries = Object.fromEntries(
  Object.entries(register.entries).sort(([a], [b]) => a.localeCompare(b)),
);
fs.mkdirSync(path.dirname(REGISTER), { recursive: true });
fs.writeFileSync(REGISTER, `${JSON.stringify(register, null, 2)}\n`);

const open = Object.values(register.entries).filter((e) => !e.resolved).length;
console.log(`\n  ✓ ${applied} SNAPSHOT(s) updated · ${Object.keys(register.entries).length} recorded`);
console.log(`    ${open} remain OPEN and need a human`);
console.log(`    ${path.relative(REPO, REGISTER)}\n`);
