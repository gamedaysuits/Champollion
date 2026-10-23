#!/usr/bin/env node

/**
 * diff-projected-cards.mjs — compare a shadow build against the live corpus.
 *
 * WHY THIS IS NOT OPTIONAL
 *   Replacing 8,685 cards (as of the 2026.8.0 atlas release) with build output is only safe if every
 *   difference has been LOOKED AT. The first bulk fetch in this same phase is
 *   the argument: it wrote 85 sources whose snapshots did not describe the
 *   files beside them, and only an independent check caught it. A diff that
 *   nobody classifies is a diff that hides its own regressions.
 *
 * THE THREE VERDICTS
 *   INTENDED FIX   the projection is right and the live card was wrong
 *   INTENDED DROP  the field leaves deliberately — no source supports it, or a
 *                  founder decision removed it
 *   REGRESSION     the live card had something real and the projection lost it
 *
 *   Only the third blocks cutover. This program cannot assign the verdicts —
 *   that takes judgement about each field — but it can classify the SHAPE of
 *   every difference so the judgement is made against evidence rather than a
 *   wall of JSON.
 *
 * NOT-YET-PROJECTED IS NOT A REGRESSION
 *   The spec currently covers the spine only. A live field with no spec entry
 *   is reported separately as `unprojected` — work remaining, not data lost.
 *   Conflating the two would either hide real regressions in noise or make the
 *   diff look catastrophic when it is merely incomplete.
 *
 * Usage:
 *   node cli/scripts/diff-projected-cards.mjs --projected build/cards-projected
 *   node cli/scripts/diff-projected-cards.mjs --projected build/cards-projected --field genus
 *   node cli/scripts/diff-projected-cards.mjs --projected build/cards-projected --json
 *
 * Exit: 0 no value conflicts · 1 conflicts to classify · 2 could not run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const LIVE = path.join(REPO, 'cli', 'shared', 'language-cards');

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const PROJECTED = flag('projected');
const ONLY_FIELD = flag('field');
const JSON_OUT = argv.includes('--json');

if (!PROJECTED) {
  console.error('ERROR: --projected <dir> is required.');
  process.exit(2);
}
const projDir = path.isAbsolute(PROJECTED) ? PROJECTED : path.join(REPO, PROJECTED);
if (!fs.existsSync(projDir)) {
  console.error(`ERROR: ${projDir} not found. Run project-cards.mjs first.`);
  process.exit(2);
}

const spec = JSON.parse(fs.readFileSync(path.join(REPO, 'shared', 'card-field-spec.json'), 'utf-8'));
const SPEC_FIELDS = new Set(Object.keys(spec.fields));
const BOOKKEEPING = new Set(['_generated', '_fieldSources', '_migration', '_decontaminated',
  '_dataQualityFixes', '_proseDecontaminated', '_toneGapReworded']);

/**
 * "Absent" covers three spellings, and treating them as different would bury
 * the real conflicts under tens of thousands of non-differences.
 *
 * The live corpus writes an explicit `null` (and sometimes `[]` or `{}`) where
 * it has nothing; the projection OMITS the field instead. That is a deliberate
 * improvement — an omitted field says "no source asserts this", where a null
 * says "some process considered this and produced nothing", and only one of
 * those is true. But it is a change of REPRESENTATION, not of content, and it
 * applies to essentially every card. Counting it as 15,000 dropped values would
 * make the diff useless for finding actual loss.
 *
 * Recorded once, in the report, rather than once per card.
 */
const isAbsent = (v) => v === undefined || v === null
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const same = (a, b) => (isAbsent(a) && isAbsent(b))
  || JSON.stringify(a) === JSON.stringify(b);

const stats = {
  projectedCards: 0, liveCards: 0, onlyInProjection: [], onlyInLive: [],
  identical: 0, conflicts: [], added: [], unprojectedFields: {},
};

const projFiles = fs.readdirSync(projDir).filter((f) => f.endsWith('.json'));
const liveFiles = new Set(fs.readdirSync(LIVE).filter((f) => f.endsWith('.json')
  && f !== 'language-tree.json'));
stats.projectedCards = projFiles.length;
stats.liveCards = liveFiles.size;

for (const file of projFiles) {
  const code = file.replace(/\.json$/, '');
  const proj = JSON.parse(fs.readFileSync(path.join(projDir, file), 'utf-8'));
  if (!liveFiles.has(file)) { stats.onlyInProjection.push(code); continue; }
  const live = JSON.parse(fs.readFileSync(path.join(LIVE, file), 'utf-8'));

  for (const field of SPEC_FIELDS) {
    if (ONLY_FIELD && field !== ONLY_FIELD && !field.includes(ONLY_FIELD)) continue;
    const p = proj[field];
    const l = live[field];
    if (p === undefined && l === undefined) continue;
    if (same(p, l)) { stats.identical++; continue; }

    if (isAbsent(l) && !isAbsent(p)) {
      stats.added.push({ code, field, projected: p });
    } else if (isAbsent(p) && !isAbsent(l)) {
      // The projection dropped something the live card had. This is the
      // category that MUST be individually justified before cutover.
      stats.conflicts.push({ code, field, kind: 'dropped', live: l, projected: null });
    } else if (typeof p === 'object' && typeof l === 'object'
               && !Array.isArray(p) && !Array.isArray(l) && p && l) {
      for (const k of new Set([...Object.keys(p), ...Object.keys(l)])) {
        if (same(p[k], l[k])) { stats.identical++; continue; }
        // A sub-field the build ADDS is not a conflict, for the same reason a
        // top-level one is not: nothing was lost. Counting it as one buried the
        // real losses under 8,529 rows of a newly-introduced field.
        if (isAbsent(l[k]) && !isAbsent(p[k])) {
          stats.added.push({ code, field: `${field}.${k}`, projected: p[k] });
          continue;
        }
        stats.conflicts.push({
          code, field: `${field}.${k}`,
          kind: isAbsent(p[k]) ? 'dropped' : 'changed',
          live: l[k] ?? null, projected: p[k] ?? null,
        });
      }
    } else {
      stats.conflicts.push({ code, field, kind: 'changed', live: l, projected: p });
    }
  }

  // Live fields the spec does not yet define — remaining work, not loss.
  for (const k of Object.keys(live)) {
    if (SPEC_FIELDS.has(k) || BOOKKEEPING.has(k)) continue;
    stats.unprojectedFields[k] = (stats.unprojectedFields[k] ?? 0) + 1;
  }
}
for (const file of liveFiles) {
  if (!projFiles.includes(file)) stats.onlyInLive.push(file.replace(/\.json$/, ''));
}

if (JSON_OUT) {
  console.log(JSON.stringify(stats, null, 2));
  process.exitCode = stats.conflicts.length ? 1 : 0;
} else {
  console.log(`\n  SHADOW DIFF — ${stats.projectedCards.toLocaleString()} projected `
    + `vs ${stats.liveCards.toLocaleString()} live\n`);
  console.log(`    fields identical        : ${stats.identical.toLocaleString()}`);
  console.log(`    fields ADDED by build   : ${stats.added.length.toLocaleString()}`);
  console.log(`    CONFLICTS to classify   : ${stats.conflicts.length.toLocaleString()}`);
  console.log(`    only in projection      : ${stats.onlyInProjection.length.toLocaleString()}`);
  console.log(`    only in live corpus     : ${stats.onlyInLive.length.toLocaleString()}`);

  const byField = {};
  for (const c of stats.conflicts) {
    byField[c.field] ??= { changed: 0, dropped: 0, added: 0, sample: null };
    byField[c.field][c.kind]++;
    byField[c.field].sample ??= c;
  }
  if (Object.keys(byField).length) {
    console.log('\n  CONFLICTS BY FIELD — each needs a verdict before cutover:\n');
    for (const [field, b] of Object.entries(byField)
      .sort((a, b2) => (b2[1].changed + b2[1].dropped + b2[1].added)
        - (a[1].changed + a[1].dropped + a[1].added))) {
      const total = b.changed + b.dropped + b.added;
      console.log(`    ${field.padEnd(34)} ${String(total).padStart(6)}  `
        + `(changed ${b.changed}, dropped ${b.dropped}, added ${b.added})`);
      const s = b.sample;
      console.log(`      e.g. ${s.code}: live ${JSON.stringify(s.live).slice(0, 60)}`
        + ` → projected ${JSON.stringify(s.projected).slice(0, 60)}`);
    }
  }

  const un = Object.entries(stats.unprojectedFields).sort((a, b) => b[1] - a[1]);
  if (un.length) {
    console.log(`\n  ${un.length} live field(s) the spec does not define yet — `
      + 'REMAINING WORK, not loss:');
    console.log(`      ${un.slice(0, 14).map(([k, n]) => `${k} (${n})`).join(', ')}`
      + `${un.length > 14 ? ' …' : ''}`);
  }

  if (stats.onlyInLive.length) {
    console.log(`\n  ${stats.onlyInLive.length} live card(s) the projection does not produce.`);
    console.log('    Either the spine does not carry the code, or no pinned source');
    console.log(`    asserts anything about it: ${stats.onlyInLive.slice(0, 8).join(', ')}`
      + `${stats.onlyInLive.length > 8 ? ' …' : ''}`);
  }
  console.log('');
  process.exitCode = stats.conflicts.length ? 1 : 0;
}
