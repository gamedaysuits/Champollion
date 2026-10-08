#!/usr/bin/env node

/**
 * audit-field-disposition.mjs — no card field may disappear by accident.
 *
 * THE RISK THIS EXISTS FOR
 *   The projector builds exactly what the spec defines and nothing else. That
 *   is the property that makes cards rebuildable — and it is also a loaded gun:
 *   a field the spec has not yet reached simply VANISHES at cutover, with no
 *   error, no warning, and 8,669 cards quietly the poorer.
 *
 *   `shared/card-field-disposition.json` is the answer: one entry per field the
 *   live corpus carries, each with a decision. This gate checks that the
 *   register and reality agree, in both directions.
 *
 * WHAT IT CHECKS
 *   1. Every field on a live card has a disposition. An unregistered field is a
 *      field nobody has decided about.
 *   2. Every field marked DONE is actually projected. A DONE that is not built
 *      is the most dangerous entry in the file: it looks handled and is not.
 *   3. Every field NOT marked DONE is genuinely absent from the projection —
 *      otherwise the register is describing a build that no longer exists.
 *   4. Nothing is registered that the live corpus does not have, so the file
 *      cannot rot into a list of fields nobody remembers.
 *
 * WHY IT BLOCKS CUTOVER
 *   Cutover replaces 8,685 cards (as of the 2026.8.0 atlas release) with build output. The only
 *   defensible basis for that is that every difference was looked at. This gate
 *   plus the shadow diff are what "looked at" means.
 *
 * Usage:
 *   node cli/scripts/audit-field-disposition.mjs
 *   node cli/scripts/audit-field-disposition.mjs --json
 *
 * Exit: 0 every field decided and consistent · 1 gaps · 2 could not run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const LIVE = path.join(REPO, 'cli', 'shared', 'language-cards');
// The atlas build's own output. This used to read build/cards-projected —
// written by project-cards.mjs, the RETIRED pipeline — so after cutover the
// audit was grading the new corpus against a stale artefact of the old one and
// reporting every field the new build produces as "DONE but absent".
const PROJECTED = path.join(REPO, 'build', 'atlas', 'cards-language');
// The cutover ships languages AND locales, so the audit must weigh both — or a
// field only locale cards carry reads as "decided but never built".
const PROJECTED_LOCALE = path.join(REPO, 'build', 'atlas', 'cards-locale');
const REGISTER = path.join(REPO, 'shared', 'card-field-disposition.json');
const SPEC = path.join(REPO, 'shared', 'card-field-spec.json');
const JSON_OUT = process.argv.includes('--json');

for (const p of [REGISTER, SPEC]) {
  if (!fs.existsSync(p)) { console.error(`ERROR: ${p} not found`); process.exit(2); }
}
const register = JSON.parse(fs.readFileSync(REGISTER, 'utf-8')).fields;
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf-8')).fields;

const BOOKKEEPING = new Set(['_generated', '_fieldSources', '_card', '_migration',
  '_decontaminated', '_dataQualityFixes', '_proseDecontaminated', '_toneGapReworded']);

/** Top-level field names carried by a directory of cards. */
function fieldsIn(dir, limit = 0) {
  if (!fs.existsSync(dir)) return new Map();
  const counts = new Map();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'language-tree.json');
  for (const file of (limit ? files.slice(0, limit) : files)) {
    let c;
    try { c = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')); } catch { continue; }
    for (const [k, v] of Object.entries(c)) {
      if (BOOKKEEPING.has(k)) continue;
      if (v === null || v === undefined) continue;
      if (Array.isArray(v) && !v.length) continue;
      if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return counts;
}

const live = fieldsIn(LIVE);
const projected = fieldsIn(PROJECTED);
for (const [field, n] of fieldsIn(PROJECTED_LOCALE)) {
  projected.set(field, (projected.get(field) ?? 0) + n);
}

const problems = [];

// 1. Undecided live fields.
for (const [field, n] of live) {
  if (!register[field]) {
    problems.push({
      kind: 'UNDECIDED', field, cards: n,
      why: 'on live cards, absent from the disposition register. It would vanish '
        + 'at cutover with nobody having decided that.',
    });
  }
}

// 2. DONE but not built — the most dangerous state, because it reads as handled.
for (const [field, e] of Object.entries(register)) {
  if (e.status !== 'DONE') continue;
  const builtAs = spec[field] ? field : null;
  if (!builtAs && !projected.has(field)) {
    // A DONE field may be projected under a DIFFERENT name (that is often the
    // point of the decision), so require the register to SAY so.
    if (!/projected as|folded into|merged|superseded|same concept/i.test(e.why ?? '')) {
      problems.push({
        kind: 'DONE-BUT-ABSENT', field, cards: e.liveCards ?? live.get(field) ?? 0,
        why: 'marked DONE but neither in the spec nor in the projection, and its '
          + 'note does not say which field replaced it.',
      });
    }
  }
}

// 3. Not DONE but built anyway — the register is describing a stale build.
for (const [field, e] of Object.entries(register)) {
  // PROJECTED — built by the projector itself rather than ingested from a
  // source, so it is expected in the projection and has no parameter row.
  if (e.status === 'DONE' || e.status === 'RUNTIME' || e.status === 'PROJECTED') continue;
  if (projected.has(field)) {
    problems.push({
      kind: 'BUILT-BUT-NOT-DONE', field, cards: projected.get(field),
      why: `registered as ${e.status} but the projection produces it. The register `
        + 'is out of date with the build.',
    });
  }
}

// 4. Registered fields the live corpus does not have.
for (const [field, e] of Object.entries(register)) {
  if (live.has(field) || projected.has(field)) continue;
  if (e.status === 'DONE' || e.status === 'DROP' || e.status === 'RUNTIME'
      || e.status === 'PROJECTED') continue;
  problems.push({
    kind: 'PHANTOM', field, cards: 0,
    why: 'registered but present on no card, live or projected. Either it was '
      + 'already removed or the entry was speculative.',
  });
}

const byStatus = {};
for (const e of Object.values(register)) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;

const result = {
  liveFields: live.size,
  projectedFields: projected.size,
  registered: Object.keys(register).length,
  byStatus,
  remaining: Object.entries(register)
    .filter(([, e]) => !['DONE', 'DROP', 'RUNTIME', 'PROJECTED'].includes(e.status))
    .map(([f, e]) => ({ field: f, status: e.status, cards: e.liveCards ?? live.get(f) ?? 0 }))
    .sort((a, b) => b.cards - a.cards),
  problems,
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n  FIELD DISPOSITION — ${live.size} live fields, `
    + `${projected.size} projected, ${Object.keys(register).length} registered\n`);
  for (const [s, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s.padEnd(9)} ${String(n).padStart(3)}`);
  }

  if (result.remaining.length) {
    console.log(`\n  ${result.remaining.length} field(s) still to build, by reach:\n`);
    for (const r of result.remaining) {
      console.log(`    ${String(r.cards).padStart(5)} cards  ${r.field.padEnd(24)} ${r.status}`);
    }
  }

  if (problems.length) {
    console.log(`\n  ✗ ${problems.length} inconsistenc(ies) between the register and reality:\n`);
    for (const p of problems.slice(0, 25)) {
      console.log(`    [${p.kind}] ${p.field} (${p.cards} cards)`);
      console.log(`        ${p.why}`);
    }
    if (problems.length > 25) console.log(`    … and ${problems.length - 25} more`);
  } else {
    console.log('\n  ✓ Register and reality agree. Every live field has a decision,');
    console.log('    every DONE is built, and nothing is built that is not decided.');
  }
  console.log('');
}

process.exitCode = problems.length ? 1 : 0;
