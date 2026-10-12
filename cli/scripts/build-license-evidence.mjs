#!/usr/bin/env node

/**
 * build-license-evidence.mjs — resolve every source's licence FROM EVIDENCE.
 *
 * WHY THIS EXISTS
 *   The register was 3.6% verified. 212 of 333 entries were written by
 *   populate-licenses.mjs::toSpdx(), which fabricated versions, dropped ND
 *   clauses, shipped raw strings as SPDX ids, and granted redistribution by
 *   default. Worse, none of the evidence was in git — zero upstream LICENSE
 *   files, zero CLDF metadata tracked — so no claim could be re-derived from
 *   the repository by anyone, including us.
 *
 *   This script gathers what the upstreams actually say, records it, and
 *   resolves a verdict with the reasoning attached. Its output
 *   (shared/license-evidence.json) is TRACKED: it is the evidence chain.
 *
 * THE THREE EVIDENCE SOURCES, in priority order
 *   1. ZENODO record        — the depositor's own machine-readable declaration,
 *                             with a DOI version pin and file checksums.
 *   2. Local LICENSE file   — the licence text the dataset ships with itself.
 *   3. CLDF `dc:license`    — the string in the dataset's metadata.
 *
 * WHEN THEY DISAGREE we do not silently pick one. Champollion's own doctrine
 * for language data is "when sources disagree, show ALL of them attributed" —
 * the same rule applies to licences, with one addition: for a licence the
 * operative verdict must be the MOST RESTRICTIVE reading, because acting on the
 * permissive one is the error that costs someone a breach. Both readings are
 * recorded and the conflict is flagged for a human.
 *
 * ANYTHING UNRESOLVED IS `UNVERIFIED` — a first-class state that quarantines
 * the claim (founder ruling 2026-08-01), never a guess.
 *
 * USAGE
 *   node cli/scripts/build-license-evidence.mjs           # build + write
 *   node cli/scripts/build-license-evidence.mjs --check   # verify current
 *
 * Exit: 0 ok · 1 could not run · 3 stale (with --check)
 *
 * @see cli/scripts/harvest-zenodo-cldf.mjs
 * @see cli/lib/license-identify.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identifyLicense, deriveFlags } from '../lib/license-identify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const REPO = path.join(CLI_ROOT, '..');
const DATA = path.join(CLI_ROOT, 'data');
const ZENODO = path.join(DATA, 'zenodo-harvest', 'records.json');
const REGISTER = path.join(REPO, 'shared', 'licenses.json');
const OUT = path.join(REPO, 'shared', 'license-evidence.json');

const CHECK = process.argv.includes('--check');

/**
 * Restrictiveness rank — higher wins a conflict.
 *
 * Not a moral ordering, a SAFETY ordering: when two upstream statements
 * disagree, the one that grants less is the one we can act on without needing
 * a permission nobody gave us.
 */
function restrictiveness(spdx) {
  if (!spdx) return -1;
  const f = deriveFlags(spdx);
  return (f.noDerivatives ? 8 : 0) + (f.nonCommercial ? 4 : 0)
    + (f.sharealike ? 2 : 0) + (f.attribution ? 1 : 0);
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

/** Every `*-metadata.json` under cli/data, keyed by dataset directory. */
function collectCldf() {
  const out = new Map();
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('-metadata.json')) {
        const rel = path.relative(DATA, p);
        const key = rel.split(path.sep)[0];
        if (!out.has(key)) {
          const meta = readJson(p);
          if (meta) {
            out.set(key, {
              raw: meta['dc:license'] ?? null,
              file: path.relative(REPO, p),
              citation: meta['dc:bibliographicCitation'] ?? null,
              accessUrl: meta['dcat:accessURL'] ?? meta['dc:identifier'] ?? null,
              version: meta['dc:version'] ?? null,
            });
          }
        }
      }
    }
  };
  walk(DATA);
  return out;
}

/** Upstream LICENSE/COPYING files the dataset ships with itself. */
function collectLicenseFiles() {
  const out = new Map();
  let dirs;
  try { dirs = fs.readdirSync(DATA, { withFileTypes: true }); } catch { return out; }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    for (const name of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'COPYING', 'COPYING.txt']) {
      const p = path.join(DATA, d.name, name);
      if (fs.existsSync(p)) {
        let text;
        try { text = fs.readFileSync(p, 'utf-8'); } catch { continue; }
        out.set(d.name, { text: text.slice(0, 4000), file: path.relative(REPO, p) });
        break;
      }
    }
  }
  return out;
}

function build() {
  const zenodo = readJson(ZENODO);
  if (!zenodo) {
    console.error(`build-license-evidence: ${path.relative(REPO, ZENODO)} missing — `
      + 'run cli/scripts/harvest-zenodo-cldf.mjs first');
    return null;
  }
  const register = readJson(REGISTER)?.sources ?? {};
  const cldf = collectCldf();
  const licenseFiles = collectLicenseFiles();

  const keys = new Set([
    ...Object.keys(zenodo.sources ?? {}),
    ...cldf.keys(), ...licenseFiles.keys(), ...Object.keys(register),
  ]);

  const sources = {};
  const stats = {
    resolved: 0, unverified: 0, conflicts: 0,
    byBasis: {}, disagreesWithRegister: 0,
  };

  for (const key of [...keys].sort()) {
    const evidence = [];

    const z = zenodo.sources?.[key];
    if (z) {
      evidence.push({
        origin: 'zenodo',
        spdx: z.license.spdx,
        rawId: z.license.zenodoId,
        needsReview: z.license.needsReview,
        doi: z.doi, conceptDoi: z.conceptDoi, version: z.version,
        recordUrl: z.recordUrl,
        checksums: (z.files ?? []).map((f) => `${f.key}=${f.checksum}`),
      });
    }

    const lf = licenseFiles.get(key);
    if (lf) {
      const r = identifyLicense(lf.text);
      evidence.push({ origin: 'license-file', spdx: r.spdx, reason: r.reason, file: lf.file });
    }

    const c = cldf.get(key);
    if (c) {
      const r = identifyLicense(c.raw);
      evidence.push({
        origin: 'cldf-metadata', spdx: r.spdx, reason: r.reason,
        rawString: typeof c.raw === 'string' ? c.raw : (c.raw ? JSON.stringify(c.raw) : null),
        file: c.file,
      });
    }

    const withSpdx = evidence.filter((e) => e.spdx);
    const distinct = [...new Set(withSpdx.map((e) => e.spdx))];

    let resolved = null;
    let basis = null;
    let conflict = null;

    if (withSpdx.length === 0) {
      basis = 'no-evidence';
    } else if (distinct.length === 1) {
      resolved = distinct[0];
      basis = withSpdx.map((e) => e.origin).join('+');
    } else {
      // Disagreement between upstream statements. Record it, act on the most
      // restrictive, and flag it — never resolve a licence conflict silently.
      const ranked = [...withSpdx].sort((a, b) => restrictiveness(b.spdx) - restrictiveness(a.spdx));
      resolved = ranked[0].spdx;
      // Say which rule actually decided it. When two readings are equally
      // restrictive (CC-BY vs Apache both grant-with-attribution), nothing was
      // "most restrictive" — evidence priority broke the tie, and calling that
      // a restrictiveness decision would misdescribe the reasoning to whoever
      // reviews it next.
      const tied = restrictiveness(ranked[0].spdx) === restrictiveness(ranked[1]?.spdx);
      basis = tied
        ? `conflict-equal-restrictiveness-priority(${ranked[0].origin})`
        : `conflict-most-restrictive(${ranked[0].origin})`;
      conflict = {
        readings: withSpdx.map((e) => ({ origin: e.origin, spdx: e.spdx })),
        resolvedTo: resolved,
        decidedBy: tied ? 'evidence-priority (equally restrictive)' : 'most-restrictive',
        note: 'Upstream statements disagree. Every reading is recorded; the '
          + 'operative verdict is the most restrictive one, or — when they are '
          + 'equally restrictive — the highest-priority evidence source. '
          + 'Needs human adjudication either way.',
      };
      stats.conflicts += 1;
    }

    const flags = deriveFlags(resolved);
    const registerSpdx = register[key]?.license_spdx ?? null;
    const disagrees = resolved !== null && registerSpdx !== null && resolved !== registerSpdx;
    if (disagrees) stats.disagreesWithRegister += 1;
    if (resolved) stats.resolved += 1; else stats.unverified += 1;
    stats.byBasis[basis] = (stats.byBasis[basis] ?? 0) + 1;

    sources[key] = {
      resolved: {
        spdx: resolved,
        status: resolved ? 'verified' : 'UNVERIFIED',
        basis,
        flags,
      },
      conflict,
      register: { spdx: registerSpdx, disagrees },
      evidence,
    };
  }

  return {
    _generated: {
      by: 'cli/scripts/build-license-evidence.mjs',
      note: 'THE LICENCE EVIDENCE CHAIN. Every verdict here is derived from a '
        + 'recorded upstream statement — a Zenodo deposit, a shipped LICENSE '
        + 'file, or CLDF metadata — never from pattern-matching a string. '
        + 'A source with no identifiable statement is UNVERIFIED, which '
        + 'quarantines its claims rather than guessing a permissive answer. '
        + 'Tracked on purpose: this is what makes a licence claim checkable by '
        + 'someone who is not us. Do not hand-edit — re-run the builder.',
      priority: ['zenodo', 'license-file', 'cldf-metadata'],
      counts: { sources: Object.keys(sources).length, ...stats },
    },
    sources,
  };
}

function main() {
  const doc = build();
  if (!doc) return 1;
  const text = JSON.stringify(doc, null, 2) + '\n';
  const c = doc._generated.counts;

  console.log(`\n  LICENCE EVIDENCE — ${c.sources} source(s)\n`);
  console.log(`    resolved from evidence : ${c.resolved}`);
  console.log(`    UNVERIFIED             : ${c.unverified}`);
  console.log(`    upstream conflicts     : ${c.conflicts}`);
  console.log(`    disagree with register : ${c.disagreesWithRegister}`);
  console.log('\n    by basis:');
  for (const [b, n] of Object.entries(c.byBasis).sort((a, b2) => b2[1] - a[1])) {
    console.log(`      ${String(b).padEnd(34)} ${n}`);
  }

  const disagreements = Object.entries(doc.sources)
    .filter(([, v]) => v.register.disagrees)
    .sort(([a], [b]) => a.localeCompare(b));
  if (disagreements.length) {
    console.log(`\n  ✗ ${disagreements.length} source(s) where EVIDENCE disagrees with shared/licenses.json:`);
    for (const [k, v] of disagreements) {
      console.log(`      ${k.padEnd(28)} register=${String(v.register.spdx).padEnd(18)} evidence=${v.resolved.spdx}  [${v.resolved.basis}]`);
    }
  }
  const conflicts = Object.entries(doc.sources).filter(([, v]) => v.conflict);
  if (conflicts.length) {
    console.log(`\n  ⚠ ${conflicts.length} source(s) where UPSTREAMS disagree with each other:`);
    for (const [k, v] of conflicts) {
      const r = v.conflict.readings.map((x) => `${x.origin}=${x.spdx}`).join(' vs ');
      console.log(`      ${k.padEnd(28)} ${r}  → ${v.conflict.resolvedTo}`);
    }
  }

  if (CHECK) {
    if (!fs.existsSync(OUT)) {
      console.error('\nshared/license-evidence.json missing — run the builder');
      return 3;
    }
    const onDisk = JSON.parse(fs.readFileSync(OUT, 'utf-8'));
    if (JSON.stringify(onDisk.sources) !== JSON.stringify(doc.sources)) {
      console.error('\n✗ shared/license-evidence.json is STALE — re-run the builder');
      return 3;
    }
    console.log('\n✓ licence evidence is current');
    return 0;
  }

  fs.writeFileSync(OUT, text);
  console.log(`\nwrote ${path.relative(REPO, OUT)}`);
  return 0;
}

process.exitCode = main();
