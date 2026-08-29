#!/usr/bin/env node

/**
 * check-datasets-doc-parity.mjs — public datasets doc ↔ dataset registry parity.
 *
 * WHY THIS EXISTS
 *   cli/website/docs/network/leaderboard/datasets.md hand-maintains the
 *   per-family license table (family → dataset count → license → lane) plus
 *   the EDTeKLA and FLORES+ reference sections. The machine source of truth
 *   for all of it is arena/datasets/registry.json. Nothing enforced parity, so
 *   the public license story could silently drift from what the harness
 *   actually enforces — the exact failure the 2026-07-19 license audit
 *   flagged. This check makes the doc a VERIFIED projection of the registry.
 *
 * WHAT IT CHECKS
 *   1. Family table (| Family | Datasets | … | License | Lane |):
 *      - every doc row maps to known registry_source keys (FAMILY_MAP below);
 *      - per-row dataset count == registry count for those sources;
 *      - per-row license == the registry's license set for those sources
 *        (normalized: "CC BY-NC-SA 4.0" ≡ "CC-BY-NC-SA-4.0"; multiple
 *        licenses in one cell are "+"-separated);
 *      - lane sanity: NC / LicenseRef licenses must sit in a research /
 *        non-commercial / quarantined lane, permissive ones in an open lane;
 *      - every registry family (except the FLORES reference, handled in 3)
 *        appears in the table — a new corpus family cannot land undocumented.
 *   2. EDTeKLA section: its License row matches the registry's EdTeKLA
 *      ("prize") family license.
 *   3. FLORES+ section: pair count, per-pair entry count, and License row
 *      match the registry's flores family.
 *   4. Prose sweeps (opportunistic — checked wherever the phrasing occurs,
 *      absence is not an error): "registry total of/to N", "across N corpus
 *      families", "~N fetch-from-source" (±100 tolerance for the approx).
 *
 * MAINTENANCE
 *   A new corpus family needs BOTH a doc-table row and a FAMILY_MAP entry
 *   here (the map is keyed by the doc's family label, normalized). A renamed
 *   doc label trips the check on purpose — update the map deliberately.
 *
 * EXIT CODES (mirrors cli/website/scripts/build-llms-full.mjs so the gate
 * can tell drift from tooling failure):
 *   0 = parity holds
 *   3 = MISMATCH / required doc structure missing (real drift — hard-block)
 *   1 = checker could not run (missing input files, crash) — environmental
 *
 * Invoked by scripts/champollion_sync_gate.sh (pre-push chain); also
 * runnable standalone: node cli/scripts/check-datasets-doc-parity.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOC_PATH = path.resolve(
  __dirname, '..', 'website', 'docs', 'network', 'leaderboard', 'datasets.md',
);
const REGISTRY_PATH = path.resolve(
  __dirname, '..', '..', 'arena', 'datasets', 'registry.json',
);

// The FLORES+ reference dataset is documented in its own section (checked
// there), deliberately NOT a family-table row.
const FLORES_SOURCE = 'flores';

// doc family label → registry_source keys. Keys are matched after
// normLabel(), so punctuation/dash/spacing changes don't break the mapping —
// but a real rename does, deliberately.
const FAMILY_MAP_RAW = {
  'TICO-19': ['tico19'],
  'IN22 (Conv + Gen)': ['in22'],
  'Tatoeba': ['tatoeba'],
  'GlobalVoices': ['globalvoices'],
  'SMOL (doc + sent)': ['smol'],
  'WMT newstest / General (2014–2025 blind sets)': [
    'wmt14', 'wmt15', 'wmt16', 'wmt17', 'wmt18', 'wmt19',
    'wmt20', 'wmt21', 'wmt22', 'wmt23', 'wmt24', 'wmt25',
  ],
  'ALT': ['alt'],
  'Turkic-x-WMT': ['turkicxwmt'],
  'WMT24++': ['wmt24pp'],
  'MAFAND-MT': ['mafand'],
  'NusaX': ['nusax'],
  'NusaTranslation': ['nusatranslation'],
  'LoResMT (2020 + 2021)': ['loresmt2020', 'loresmt2021'],
  'AmericasNLP 2021': ['americasnlp2021'],
  'Gamayun': ['gamayun'],
  'NICT-SAP': ['nictsap'],
  'EDTeKLA / prize': ['prize'],
  'BSD': ['bsd'],
  'MENYO-20k': ['menyo20k'],
};

/** Label → lookup key: lowercase, alphanumerics only. */
function normLabel(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** License string → canonical form: "CC BY-NC-SA 4.0" ≡ "CC-BY-NC-SA-4.0". */
function normLicense(s) {
  return s.toLowerCase().replace(/[^a-z0-9.]+/g, '');
}

/** Strip markdown decoration from a table cell: links → text, `code`, **bold**. */
function cleanCell(s) {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim();
}

function parseCount(s) {
  const m = /(\d[\d,]*)/.exec(s);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}

/**
 * True when the cell (canonicalized) names EVERY registry license for the
 * family. The reference sections (EDTeKLA, FLORES+) legitimately annotate
 * their License cells — link text, LicenseRef ids in backticks, sovereignty
 * notes, carve-out statements — so the contract there is containment of the
 * canonical license id, not cell equality. The family TABLE keeps strict
 * set-equality; it is the load-bearing lane.
 */
function cellNamesLicenses(cell, licenses) {
  const canon = normLicense(cleanCell(cell));
  return [...licenses].every((l) => canon.includes(normLicense(l)));
}

const FAMILY_MAP = new Map();
for (const [label, sources] of Object.entries(FAMILY_MAP_RAW)) {
  const key = normLabel(label);
  if (FAMILY_MAP.has(key)) {
    console.error(`FATAL: FAMILY_MAP labels collide after normalization: "${label}"`);
    process.exit(1);
  }
  FAMILY_MAP.set(key, {label, sources});
}

// ---------------------------------------------------------------------------
// Load inputs (missing = environmental, exit 1 — the gate degrades to a warn)
// ---------------------------------------------------------------------------

let doc;
let registry;
try {
  doc = fs.readFileSync(DOC_PATH, 'utf-8');
} catch (err) {
  console.error(`could not read datasets doc at ${DOC_PATH}: ${err.message}`);
  process.exit(1);
}
try {
  registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
} catch (err) {
  console.error(`could not read dataset registry at ${REGISTRY_PATH}: ${err.message}`);
  process.exit(1);
}
if (!Array.isArray(registry.datasets) || registry.datasets.length === 0) {
  console.error(`registry at ${REGISTRY_PATH} has no datasets[] — refusing to verify parity against nothing`);
  process.exit(1);
}

// Group the registry by family (registry_source).
const registryFamilies = new Map(); // source → {count, licenses:Set, sizes:Set}
for (const d of registry.datasets) {
  const src = d.registry_source;
  if (!src) {
    console.error(`registry dataset ${d.id} has no registry_source — cannot be checked against the doc`);
    process.exit(1);
  }
  if (!registryFamilies.has(src)) {
    registryFamilies.set(src, {count: 0, licenses: new Set(), sizes: new Set()});
  }
  const fam = registryFamilies.get(src);
  fam.count += 1;
  fam.licenses.add(String(d.license || ''));
  fam.sizes.add(d.size);
}
const registryTotal = registry.datasets.length;
const floresFam = registryFamilies.get(FLORES_SOURCE) || null;
const nonFloresTotal = registryTotal - (floresFam ? floresFam.count : 0);

const problems = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => problems.push(msg);

// ---------------------------------------------------------------------------
// 1. Family table
// ---------------------------------------------------------------------------

const docLines = doc.split('\n');
const headerIdx = docLines.findIndex((l) => /^\|\s*Family\s*\|\s*Datasets\s*\|/.test(l));
if (headerIdx === -1) {
  bad('family table header (| Family | Datasets | … |) not found — the doc structure changed; update this checker WITH the doc');
} else {
  const rows = [];
  for (let i = headerIdx + 2; i < docLines.length && docLines[i].startsWith('|'); i++) {
    const cells = docLines[i].split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) {
      bad(`family table row has ${cells.length} cells (expected 5): ${docLines[i]}`);
      continue;
    }
    rows.push({
      label: cleanCell(cells[0]),
      count: parseCount(cells[1]),
      license: cleanCell(cells[3]),
      lane: cleanCell(cells[4]),
      raw: docLines[i],
    });
  }
  if (rows.length < 15) {
    bad(`family table parsed only ${rows.length} rows — structure drift; expected the full family catalogue`);
  }

  const claimedSources = new Set();
  for (const row of rows) {
    const mapped = FAMILY_MAP.get(normLabel(row.label));
    if (!mapped) {
      bad(`doc family "${row.label}" is not in FAMILY_MAP — new/renamed family; update cli/scripts/check-datasets-doc-parity.mjs deliberately`);
      continue;
    }
    let regCount = 0;
    const regLicenses = new Set();
    for (const src of mapped.sources) {
      claimedSources.add(src);
      const fam = registryFamilies.get(src);
      if (!fam) {
        bad(`doc family "${row.label}" maps to registry_source "${src}", which has no datasets in the registry`);
        continue;
      }
      regCount += fam.count;
      for (const lic of fam.licenses) regLicenses.add(lic);
    }
    if (row.count !== regCount) {
      bad(`"${row.label}": doc says ${row.count} datasets, registry has ${regCount}`);
    }
    const docLicenses = new Set(
      row.license.split(/\s*\+\s*/).map(normLicense).filter(Boolean),
    );
    const regCanon = new Set([...regLicenses].map(normLicense));
    const sameLicenses =
      docLicenses.size === regCanon.size && [...docLicenses].every((l) => regCanon.has(l));
    if (!sameLicenses) {
      bad(`"${row.label}": doc license "${row.license}" ≠ registry license(s) [${[...regLicenses].join(', ')}]`);
    }
    // Lane sanity: restricted licenses must not be presented as an open lane.
    const restricted = [...regCanon].some((l) => /nc|licenseref/.test(l));
    if (restricted && !/research|non-commercial|quarantin/i.test(row.lane)) {
      bad(`"${row.label}": license [${[...regLicenses].join(', ')}] is restricted but the doc lane reads "${row.lane}"`);
    }
    if (!restricted && !/^open\b/i.test(row.lane)) {
      bad(`"${row.label}": license [${[...regLicenses].join(', ')}] is permissive but the doc lane reads "${row.lane}" (expected an open lane)`);
    }
  }

  // Coverage: every registry family must be claimed by a doc row (FLORES has
  // its own section below).
  for (const [src, fam] of registryFamilies) {
    if (src === FLORES_SOURCE) continue;
    if (!claimedSources.has(src)) {
      bad(`registry family "${src}" (${fam.count} datasets, ${[...fam.licenses].join(', ')}) has no row in the doc's family table`);
    }
  }
  if (problems.length === 0) {
    ok(`family table: ${rows.length} rows match ${claimedSources.size} registry families (counts + licenses + lanes)`);
  }
}

// ---------------------------------------------------------------------------
// 2. EDTeKLA reference section
// ---------------------------------------------------------------------------

const edteklaStart = doc.indexOf('### EDTeKLA Development Set v1');
if (edteklaStart === -1) {
  bad('EDTeKLA section (### EDTeKLA Development Set v1) not found');
} else {
  const sectionEnd = doc.indexOf('\n## ', edteklaStart);
  const section = doc.slice(edteklaStart, sectionEnd === -1 ? undefined : sectionEnd);
  const licRow = /\|\s*\*\*License\*\*\s*\|([^|]+)\|/.exec(section);
  const prizeFam = registryFamilies.get('prize');
  if (!licRow) {
    bad('EDTeKLA section has no | **License** | row');
  } else if (!prizeFam) {
    bad('registry has no "prize" (EdTeKLA) family to check the EDTeKLA section against');
  } else if (!cellNamesLicenses(licRow[1], prizeFam.licenses)) {
    bad(`EDTeKLA section License row does not name the registry license(s) [${[...prizeFam.licenses].join(', ')}]: "${cleanCell(licRow[1])}"`);
  } else if (!/non-commercial/i.test(licRow[1])) {
    bad('EDTeKLA section License row no longer states the non-commercial carve-out');
  } else {
    ok('EDTeKLA section license matches the registry (and states the NC carve-out)');
  }
}

// ---------------------------------------------------------------------------
// 3. FLORES+ reference section
// ---------------------------------------------------------------------------

const floresStart = doc.indexOf('## FLORES+ Devtest');
if (floresStart === -1) {
  bad('FLORES+ section (## FLORES+ Devtest) not found');
} else if (!floresFam) {
  bad(`registry has no "${FLORES_SOURCE}" family to check the FLORES+ section against`);
} else {
  const sectionEnd = doc.indexOf('\n## ', floresStart + 4);
  const section = doc.slice(floresStart, sectionEnd === -1 ? undefined : sectionEnd);
  const pairsRow = /\|\s*\*\*Language pairs\*\*\s*\|([^|]+)\|/.exec(section);
  const entryRow = /\|\s*\*\*Entry count\*\*\s*\|([^|]+)\|/.exec(section);
  const licRow = /\|\s*\*\*License\*\*\s*\|([^|]+)\|/.exec(section);
  if (!pairsRow || !entryRow || !licRow) {
    bad('FLORES+ section is missing a **Language pairs** / **Entry count** / **License** row');
  } else {
    const docPairs = parseCount(pairsRow[1]);
    if (docPairs !== floresFam.count) {
      bad(`FLORES+ pairs: doc says ${docPairs}, registry has ${floresFam.count}`);
    }
    const docEntries = parseCount(entryRow[1]);
    const regSizes = [...floresFam.sizes];
    if (!(regSizes.length === 1 && regSizes[0] === docEntries)) {
      bad(`FLORES+ entry count: doc says ${docEntries} per pair, registry sizes are [${regSizes.join(', ')}]`);
    }
    const licOk = cellNamesLicenses(licRow[1], floresFam.licenses);
    if (!licOk) {
      bad(`FLORES+ License row does not name the registry license(s) [${[...floresFam.licenses].join(', ')}]: "${cleanCell(licRow[1])}"`);
    }
    if (docPairs === floresFam.count && regSizes.length === 1 && regSizes[0] === docEntries && licOk) {
      ok(`FLORES+ section matches the registry (${floresFam.count} pairs × ${docEntries} sentences, ${[...floresFam.licenses].join(', ')})`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Prose sweeps — opportunistic: zero matches is fine (wording is the
// doc's business), but every match must be numerically right.
// ---------------------------------------------------------------------------

let proseChecked = 0;
for (const m of doc.matchAll(/registry total (?:of|to)\s+\*{0,2}([\d,]+)/g)) {
  proseChecked++;
  const n = parseInt(m[1].replace(/,/g, ''), 10);
  if (n !== registryTotal) {
    bad(`prose says "registry total ${m[1]}" but the registry has ${registryTotal} datasets`);
  }
}
for (const m of doc.matchAll(/across (\d+) corpus\s+famil/g)) {
  proseChecked++;
  const n = parseInt(m[1], 10);
  const familyCount = Object.keys(FAMILY_MAP_RAW).length;
  if (n !== familyCount) {
    bad(`prose says "across ${n} corpus families" but the family table/map has ${familyCount}`);
  }
}
for (const m of doc.matchAll(/~([\d,]+) fetch-from-source/g)) {
  proseChecked++;
  const n = parseInt(m[1].replace(/,/g, ''), 10);
  if (Math.abs(n - nonFloresTotal) > 100) {
    bad(`prose says "~${m[1]} fetch-from-source" but the non-FLORES registry count is ${nonFloresTotal} (allowed drift ±100)`);
  }
}
if (proseChecked > 0 && problems.length === 0) {
  ok(`${proseChecked} prose figure(s) consistent with the registry (total ${registryTotal})`);
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

if (problems.length > 0) {
  console.error(`\n✗ datasets doc ↔ registry PARITY FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nFix cli/website/docs/network/leaderboard/datasets.md to match arena/datasets/registry.json');
  console.error('(or, for a new/renamed family, update FAMILY_MAP in cli/scripts/check-datasets-doc-parity.mjs).');
  process.exit(3);
}
console.log(`✓ datasets doc matches arena/datasets/registry.json (${registryTotal} datasets, ${registryFamilies.size} registry families)`);
