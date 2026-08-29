#!/usr/bin/env node

/**
 * derive-morphological-synthesis.mjs
 * ────────────────────────────────────────────────────────────────
 * Populates `typologicalProfile.morphologicalSynthesis` (forge/
 * DESIGN.md §7 card-schema addition #4): a Champollion-DERIVED
 * synthesis-degree enum — analytic | synthetic | polysynthetic —
 * the "does this language reward FST-driven morphological handling"
 * signal for training/synthesis orchestration.
 *
 * Derived STRICTLY from cited signals already on the card (no new
 * upstream data enters the card):
 *
 *   S1  WALS 22A inflectional-synthesis value ("N–M categories per
 *       word") carried verbatim in encyclopedic.typology.verbSynthesis
 *       and/or linguisticChallenges.morphologicalComplexity.
 *       Bucketing (documented cut-points on the WALS 22A scale):
 *         0–1 categories/word → analytic evidence
 *         2–7 categories/word → synthetic evidence
 *         8+  categories/word → polysynthetic evidence
 *   S2  Explicit, cited polysynthesis prose: the
 *       linguisticChallenges.polysynthesis challenge, or a
 *       non-negated "polysynthetic/polysynthesis" statement in
 *       linguisticChallenges / encyclopedic.typology prose values
 *       → polysynthetic evidence
 *   S3  WALS 26A "Little affixation"
 *       (typologicalProfile.inflectionalStrategy or
 *       encyclopedic.typology.affixType) → analytic evidence
 *
 * COMBINATION (conservative, index-not-arbiter):
 *   • analytic evidence CONFLICTS with synthetic/polysynthetic
 *     evidence → write NOTHING (the card's sources disagree; the
 *     card keeps showing both, we do not adjudicate);
 *   • the two S1 carriers disagreeing with each other → NOTHING;
 *   • polysynthetic > synthetic when both present (polysynthesis IS
 *     the high end of synthesis — consistent, not conflicting);
 *   • no signal → NOTHING. Absence means unknown, never a default.
 *
 * PROVENANCE (CLAUDE.md derived-values doctrine; lint R6 pattern):
 *   _fieldSources['typologicalProfile.morphologicalSynthesis'] =
 *     'derived:on-card-typology (<the signals that fired>)'
 *   — never a bare upstream name. The WALS/Grambank assertions the
 *   derivation reads remain independently cited where they live.
 *   No dataSources change (nothing external enters the card).
 *
 * IDEMPOTENCY / OWNERSHIP: pure function of the on-card signals,
 * recomputed wholesale; when signals no longer support a value the
 * field (and its stamp) are removed.
 *
 * Usage:
 *   node scripts/derive-morphological-synthesis.mjs              # all cards
 *   node scripts/derive-morphological-synthesis.mjs --dry-run    # preview
 *   node scripts/derive-morphological-synthesis.mjs --lang crk   # single card
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const STAMP_KEY = 'typologicalProfile.morphologicalSynthesis';

const CATEGORIES_RE = /(\d+)(?:\s*[-–]\s*(\d+))?\s*categor/i;
const POLY_RE = /polysynthe/i;
const POLY_NEGATED_RE = /\b(?:not|non|never|no)[\s-]{0,3}polysynthe|non-?polysynthe/i;

/** Bucket a WALS 22A categories-per-word string. Returns null when unparseable. */
function bucket22A(text) {
  const m = typeof text === 'string' ? text.match(CATEGORIES_RE) : null;
  if (!m) return null;
  const hi = m[2] !== undefined ? parseInt(m[2], 10) : parseInt(m[1], 10);
  if (!Number.isFinite(hi)) return null;
  if (hi <= 1) return { bucket: 'analytic', label: m[0].trim() };
  if (hi <= 7) return { bucket: 'synthetic', label: m[0].trim() };
  return { bucket: 'polysynthetic', label: m[0].trim() };
}

/** String prose values of an object, skipping meta keys (_sources, …). */
function proseValues(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj)
    .filter(([k, v]) => !k.startsWith('_') && typeof v === 'string')
    .map(([k, v]) => [k, v]);
}

/**
 * Evaluate the signals for one card.
 * Returns { value, stamp } — value null when signals are absent or conflict.
 */
function deriveSynthesis(card) {
  const tp = card.typologicalProfile;
  const lc = card.linguisticChallenges;
  const encTyp =
    card.encyclopedic && typeof card.encyclopedic === 'object' && !Array.isArray(card.encyclopedic)
      ? card.encyclopedic.typology : null;

  const polyParts = [];
  const synthParts = [];
  const analParts = [];

  // ── S1: WALS 22A categories-per-word (both carriers must agree) ──
  const s1 = [];
  const vs = encTyp && typeof encTyp === 'object' ? encTyp.verbSynthesis : null;
  const vsBucket = bucket22A(vs);
  if (vsBucket) s1.push({ ...vsBucket, field: 'encyclopedic.typology.verbSynthesis' });
  const mc = lc && typeof lc === 'object' ? lc.morphologicalComplexity : null;
  const mcBucket = bucket22A(mc);
  if (mcBucket) s1.push({ ...mcBucket, field: 'linguisticChallenges.morphologicalComplexity' });
  if (s1.length === 2 && s1[0].bucket !== s1[1].bucket) {
    return { value: null, conflict: 'wals-22a-carriers-disagree' };
  }
  for (const sig of s1) {
    const part = `WALS 22A ${sig.label}/word: ${sig.field}`;
    if (sig.bucket === 'analytic') analParts.push(part);
    else if (sig.bucket === 'synthetic') synthParts.push(part);
    else polyParts.push(part);
  }

  // ── S2: explicit, cited polysynthesis prose ──
  const proseBlobs = [
    ...proseValues(lc).map(([k, v]) => [`linguisticChallenges.${k}`, v]),
    ...proseValues(encTyp).map(([k, v]) => [`encyclopedic.typology.${k}`, v]),
  ];
  for (const [field, text] of proseBlobs) {
    if (POLY_RE.test(text) && !POLY_NEGATED_RE.test(text)) {
      polyParts.push(`polysynthesis prose: ${field}`);
      break; // one cited assertion is enough — keep the stamp short
    }
  }

  // ── S3: WALS 26A "Little affixation" ──
  if (tp && typeof tp === 'object' && tp.inflectionalStrategy === 'Little affixation') {
    analParts.push('WALS 26A Little affixation: typologicalProfile.inflectionalStrategy');
  } else if (encTyp && typeof encTyp === 'object' && encTyp.affixType === 'Little affixation') {
    analParts.push('WALS 26A Little affixation: encyclopedic.typology.affixType');
  }

  const polyEv = polyParts.length > 0;
  const synthEv = synthParts.length > 0;
  const analEv = analParts.length > 0;

  if ((polyEv || synthEv) && analEv) {
    return { value: null, conflict: 'analytic-vs-synthetic-signals' };
  }
  if (polyEv) {
    return { value: 'polysynthetic', stamp: `derived:on-card-typology (${polyParts.join('; ')})` };
  }
  if (synthEv) {
    return { value: 'synthetic', stamp: `derived:on-card-typology (${synthParts.join('; ')})` };
  }
  if (analEv) {
    return { value: 'analytic', stamp: `derived:on-card-typology (${analParts.join('; ')})` };
  }
  return { value: null };
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Morphological Synthesis Derivation → typologicalProfile.morphologicalSynthesis');
  console.log('  Signals: WALS 22A categories/word + WALS 26A Little affixation + cited polysynthesis prose');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  let cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');
  if (SINGLE_LANG) {
    const target = `${SINGLE_LANG}.json`;
    if (!cardFiles.includes(target)) {
      console.error(`\nERROR: Card not found: ${target}`);
      process.exit(1);
    }
    cardFiles = [target];
  }

  let processed = 0;
  let modified = 0;
  const byValue = { analytic: 0, synthetic: 0, polysynthetic: 0 };
  let conflicts = 0;
  let removed = 0;

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }
    processed++;

    const { value, stamp, conflict } = deriveSynthesis(card);
    if (conflict) conflicts++;

    const before = JSON.stringify(card);

    if (value) {
      if (!card.typologicalProfile || typeof card.typologicalProfile !== 'object' || Array.isArray(card.typologicalProfile)) {
        card.typologicalProfile = {};
      }
      card.typologicalProfile.morphologicalSynthesis = value;
      if (!card._fieldSources) card._fieldSources = {};
      card._fieldSources[STAMP_KEY] = stamp;
      byValue[value]++;
    } else {
      // Ownership: signals absent or conflicting → the field must not exist.
      const tp = card.typologicalProfile;
      if (tp && typeof tp === 'object' && !Array.isArray(tp) && 'morphologicalSynthesis' in tp) {
        delete tp.morphologicalSynthesis;
        if (Object.keys(tp).length === 0) delete card.typologicalProfile;
        removed++;
      }
      if (card._fieldSources && STAMP_KEY in card._fieldSources) {
        delete card._fieldSources[STAMP_KEY];
      }
    }

    if (JSON.stringify(card) !== before) {
      modified++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  const total = byValue.analytic + byValue.synthetic + byValue.polysynthetic;
  console.log('  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards processed:           ${processed.toLocaleString()}`);
  console.log(`  Cards with a value:        ${total.toLocaleString()}`);
  console.log(`    analytic:                ${byValue.analytic.toLocaleString()}`);
  console.log(`    synthetic:               ${byValue.synthetic.toLocaleString()}`);
  console.log(`    polysynthetic:           ${byValue.polysynthetic.toLocaleString()}`);
  console.log(`  Cards modified this run:   ${modified.toLocaleString()}`);
  console.log(`  Conflicting signals (skipped, surfaced not adjudicated): ${conflicts.toLocaleString()}`);
  console.log(`  Stale values removed:      ${removed.toLocaleString()}`);
  if (DRY_RUN) console.log('\n  ℹ  DRY RUN — no files were modified');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
