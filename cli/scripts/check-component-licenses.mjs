#!/usr/bin/env node

/**
 * check-component-licenses.mjs — every licensed component must be DECLARED,
 * and the declarations must agree with the code.
 *
 * WHY THIS EXISTS
 *   `forge/` is AGPL-3.0-or-later, 86 tracked files, and approved for the
 *   public squash — and until the 2026-08-01 audit it appeared in NONE of the
 *   three places that claim to enumerate this repo's licensing: the component
 *   table in docs/LICENSING.md, the pointer table in the root LICENSE, and the
 *   open-source-set table in docs/DATA_BOUNDARIES.md. An undeclared AGPL
 *   component sitting beside Apache-2.0 ones is exactly the error LICENSING.md's
 *   own 2026-06-18 correction #1 fixed for `arena/`. Hand-maintained tables
 *   fall behind the tree and never say so.
 *
 *   So this DISCOVERS components from git rather than reading a list: a new
 *   component reds the check until it is declared. It cannot fall behind.
 *
 * WHAT IT CHECKS
 *   1. Discovery — every tracked pyproject.toml / package.json that declares a
 *      license, and every tracked component LICENSE file, is a component.
 *   2. Declaration — each discovered component appears in all three tables.
 *   3. Agreement — the SPDX in each table equals the one the code declares.
 *   4. Packaging conflict — no component's declared license differs from the
 *      distribution that packs it (catches corpora_builder, declared Apache-2.0
 *      while shipping inside the AGPL `mt-eval` wheel).
 *   5. AGPL boundary (CLAUDE.md) — no Apache-2.0 component IMPORTS an AGPL one.
 *      Subprocess invocation is explicitly fine ("invoked as separate tools");
 *      an import is not.
 *
 * EXIT CODES (same contract as check-datasets-doc-parity.mjs, so
 * scripts/champollion_sync_gate.sh treats them identically):
 *   0 = declarations agree   3 = drift (hard-block)   1 = could not run
 */

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const problems = [];
const notes = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => problems.push(m);

const read = (p) => {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; }
};

function tracked() {
  try {
    return execFileSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20})
      .split('\n').filter(Boolean);
  } catch (e) {
    console.error(`check-component-licenses: git ls-files failed — ${e.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 1. Discovery
// ---------------------------------------------------------------------------

// Components whose licensing is genuinely out of scope for the three tables:
// vendored third-party assets that carry their own upstream notices, and the
// website's own package manifest (part of cli/, not a separate component).
const NOT_A_COMPONENT = [
  /^cli\/website\//,
  /^node_modules\//,
  /\/node_modules\//,
  /^docs\/brand\//,          // a one-off build tool for a business card
  /^\.github\//,
  // Upstream datasets' OWN licence files, tracked as licence EVIDENCE
  // (cli/scripts/build-license-evidence.mjs reads them to resolve e.g.
  // segbo = CC-BY-SA-4.0). They are third-party grants, not Champollion
  // components, and demanding they appear in our component tables would be a
  // category error — the tables enumerate what WE license to others.
  /^cli\/data\//,
];

const isComponent = (p) => !NOT_A_COMPONENT.some((re) => re.test(p));

/**
 * Derive an SPDX id from a LICENSE file's header.
 *
 * Needed because a component can be licensed by a LICENSE file alone, with no
 * manifest to declare it — `shared/` is exactly that, and a manifest-only
 * discovery pass silently missed it. Missing a component is the same failure
 * this checker exists to prevent, so discovery has to cover both ways a
 * component can be licensed.
 *
 * Fingerprints the first few lines rather than hashing the whole text, so an
 * edited copyright line does not red the gate.
 */
function spdxFromLicenseText(text) {
  const head = text.split('\n').slice(0, 12).join('\n');
  if (/PolyForm Noncommercial License 1\.0\.0/i.test(head)) {
    return 'PolyForm-Noncommercial-1.0.0';
  }
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(head)) return 'AGPL-3.0-or-later';
  if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(head)) return 'LGPL-3.0-only';
  if (/GNU GENERAL PUBLIC LICENSE/i.test(head)) return 'GPL-3.0-only';
  if (/Apache License/i.test(head)) return 'Apache-2.0';
  if (/^MIT License/im.test(head)) return 'MIT';
  if (/Interim License|use by permission only/i.test(head)) {
    return 'LicenseRef-Champollion-Interim-Permission-Required';
  }
  if (/All Rights Reserved/i.test(head) && /No licence is granted|No license is granted/i.test(text)) {
    return 'LicenseRef-Champollion-Proprietary';
  }
  return null;
}

function discover() {
  const files = tracked().filter(isComponent);
  const comps = new Map(); // dir -> {dir, spdx, declaredIn[]}

  // A manifest SPDX is authoritative over one fingerprinted from LICENSE text:
  // the header of the AGPL cannot distinguish -only from -or-later, so treating
  // the two as equals would manufacture a conflict on every AGPL component.
  // A disagreement between two MANIFESTS is a real defect and still reported.
  const add = (dir, spdx, where, authoritative) => {
    const key = dir === '' ? '.' : dir;
    const c = comps.get(key) || {dir: key, spdx: null, spdxFrom: null, declaredIn: []};
    if (spdx) {
      if (!c.spdx) { c.spdx = spdx; c.spdxFrom = {where, authoritative}; }
      else if (c.spdx !== spdx) {
        if (authoritative && !c.spdxFrom.authoritative) {
          c.spdx = spdx; c.spdxFrom = {where, authoritative};      // manifest wins
        } else if (authoritative && c.spdxFrom.authoritative) {
          bad(`${key}: two manifests disagree — "${c.spdx}" (${c.spdxFrom.where}) `
            + `vs "${spdx}" (${where})`);
        }
        // else: LICENSE-derived value differs from an authoritative manifest —
        // expected for AGPL -only/-or-later; keep the manifest's.
      }
    }
    c.declaredIn.push(where);
    comps.set(key, c);
  };

  for (const f of files) {
    const base = path.basename(f);
    const dir = path.dirname(f) === '.' ? '' : path.dirname(f);

    if (base === 'pyproject.toml') {
      const text = read(f) || '';
      const m = /^\s*license\s*=\s*["']([^"']+)["']/m.exec(text);
      if (m) add(dir, m[1].trim(), f, true);
    } else if (base === 'package.json') {
      const text = read(f);
      if (!text) continue;
      let json;
      try { json = JSON.parse(text); } catch { continue; }
      if (typeof json.license === 'string' && json.license.trim()) {
        add(dir, json.license.trim(), f, true);
      }
    } else if (base === 'LICENSE' && dir !== '') {
      // A component may be licensed by its LICENSE file alone, with no
      // manifest — `shared/` is. The manifest SPDX wins when both exist
      // (it is more precise: a LICENSE header cannot distinguish
      // AGPL-3.0-only from -or-later).
      const spdx = spdxFromLicenseText(read(f) || '');
      if (spdx) add(dir, spdx, f, false);
      else bad(`${f}: could not identify the license from its header — `
        + `add a fingerprint to spdxFromLicenseText()`);
    }
  }
  // The root LICENSE is the pointer table itself, not a component declaration.
  comps.delete('.');
  return [...comps.values()].sort((a, b) => a.dir.localeCompare(b.dir));
}

// ---------------------------------------------------------------------------
// 2 + 3. Declaration and agreement across the three tables
// ---------------------------------------------------------------------------

const TABLES = [
  {id: 'docs/LICENSING.md', text: read('docs/LICENSING.md')},
  {id: 'LICENSE', text: read('LICENSE')},
  {id: 'docs/DATA_BOUNDARIES.md', text: read('docs/DATA_BOUNDARIES.md')},
];

for (const t of TABLES) {
  if (t.text === null) {
    console.error(`check-component-licenses: ${t.id} unreadable — cannot verify`);
    process.exit(1);
  }
}

// SPDX ids that the prose spells out rather than quoting verbatim. Matching on
// a distinctive substring keeps the check from demanding machine-speak in a
// document written for humans.
const SPDX_PROSE = {
  'AGPL-3.0-or-later': [/AGPL-3\.0-or-later/i, /Affero General Public License v3\.0 or later/i],
  'Apache-2.0': [/Apache-2\.0/i, /Apache License, Version 2\.0/i],
  'MIT': [/\bMIT\b/],
  'LicenseRef-Champollion-Interim-Permission-Required':
    [/LicenseRef-Champollion-Interim-Permission-Required/i, /use by permission only/i],
  'LicenseRef-Champollion-Proprietary':
    [/LicenseRef-Champollion-Proprietary/i, /PROPRIETARY/i, /all rights reserved/i],
};

function mentions(text, needle) {
  return text.includes(needle);
}

function spdxNearby(text, dir, spdx) {
  // Find the paragraph/row mentioning the component and check the SPDX there,
  // rather than anywhere in the file — otherwise any component would "match"
  // because Apache-2.0 appears a dozen times.
  const idx = [];
  let from = 0;
  while (true) {
    const i = text.indexOf(dir, from);
    if (i === -1) break;
    idx.push(i);
    from = i + dir.length;
  }
  const pats = SPDX_PROSE[spdx] || [new RegExp(spdx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')];
  return idx.some((i) => {
    const window = text.slice(i, i + 900);
    return pats.some((re) => re.test(window));
  });
}

const components = discover();
if (components.length === 0) {
  console.error('check-component-licenses: discovered no components — discovery is broken');
  process.exit(1);
}

for (const c of components) {
  const dirRef = `${c.dir}/`;
  for (const t of TABLES) {
    if (!mentions(t.text, dirRef)) {
      bad(`${t.id}: component \`${c.dir}\` (${c.spdx}) is NOT declared — `
        + `discovered from ${c.declaredIn[0]}`);
      continue;
    }
    if (c.spdx && !spdxNearby(t.text, dirRef, c.spdx)) {
      bad(`${t.id}: \`${c.dir}\` is declared but its license does not read as `
        + `"${c.spdx}" near the mention (the code says ${c.spdx})`);
    }
  }
}
if (!problems.length) ok(`${components.length} component(s) declared in all three tables with matching SPDX`);

// ---------------------------------------------------------------------------
// 4. Packaging conflict — a sub-package shipped inside a differently-licensed
//    distribution. Apache-2.0 → AGPL is one-way compatible, so this is a
//    DECLARATION defect rather than a violation; it must still be visible.
// ---------------------------------------------------------------------------

const arenaPy = read('arena/pyproject.toml') || '';
const whereM = /where\s*=\s*\[([^\]]*)\]/.exec(arenaPy);
if (whereM) {
  const where = [...whereM[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
    .filter((w) => w !== '.');
  const arenaSpdx = (/^\s*license\s*=\s*["']([^"']+)["']/m.exec(arenaPy) || [])[1];
  for (const sub of where) {
    const subDir = path.posix.join('arena', sub);
    const subComp = components.find((c) => c.dir === subDir);
    if (subComp && arenaSpdx && subComp.spdx !== arenaSpdx) {
      notes.push(`\`${subDir}\` declares ${subComp.spdx} but is packaged into the `
        + `${arenaSpdx} arena distribution — declaration defect, founder ruling needed`);
      if (!mentions(TABLES[0].text, subDir)) {
        bad(`docs/LICENSING.md does not record the \`${subDir}\` packaging conflict`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. AGPL boundary (CLAUDE.md): AGPL must never be bundled into or linked from
//    the proprietary/permissive CLI paths. Subprocess invocation is allowed.
// ---------------------------------------------------------------------------

const AGPL_DIRS = components.filter((c) => /AGPL/i.test(c.spdx || '')).map((c) => c.dir);
const PERMISSIVE_DIRS = components
  .filter((c) => /^(Apache-2\.0|MIT|BSD)/i.test(c.spdx || ''))
  .map((c) => c.dir);

const SRC_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py']);
const importRe = (dir) => new RegExp(
  String.raw`(?:^|\s)(?:import\s[^\n;]*?from\s*|import\s*|require\s*\(\s*|from\s+)` +
  String.raw`['"]([^'"]*\/)?${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/`, 'm');

if (AGPL_DIRS.length && PERMISSIVE_DIRS.length) {
  const files = tracked().filter(isComponent)
    .filter((f) => SRC_EXT.has(path.extname(f)))
    .filter((f) => PERMISSIVE_DIRS.some((d) => f.startsWith(`${d}/`)));
  let crossings = 0;
  for (const f of files) {
    const text = read(f);
    if (!text) continue;
    for (const agpl of AGPL_DIRS) {
      if (importRe(agpl).test(text)) {
        const owner = PERMISSIVE_DIRS.find((d) => f.startsWith(`${d}/`));
        bad(`AGPL BOUNDARY: ${f} (in ${owner}, permissive) imports from \`${agpl}/\` `
          + `(AGPL). CLAUDE.md: AGPL components are invoked as separate tools, never linked.`);
        crossings++;
      }
    }
  }
  if (!crossings) {
    ok(`AGPL boundary clean — no permissive component imports ${AGPL_DIRS.map((d) => `${d}/`).join(', ')}`);
  }
}

// ---------------------------------------------------------------------------

for (const n of notes) console.log(`  · ${n}`);

if (problems.length) {
  console.error('\n✗ component-license declarations are out of sync:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nDeclare every licensed component in all three tables:');
  console.error('  docs/LICENSING.md (component table), LICENSE (pointer table),');
  console.error('  docs/DATA_BOUNDARIES.md (open-source-set table).');
  process.exit(3);
}
console.log('✓ component licenses declared and consistent');
