#!/usr/bin/env node

/**
 * reword-family-tone-gaps.mjs
 * ─────────────────────────────────────────────────────────────────
 * Rewords the family-level-trait tone PRIORS into honest DATA-GAP notes.
 *
 * The decontamination (decontaminate-grambank-prose.mjs) correctly removed the
 * Grambank-misread and PHOIBLE-contradicting tone prose. What remained were two
 * legitimate kinds of tone claim:
 *   • direct coding of THIS language — PHOIBLE isTonal===true, or "(WALS: …)".
 *     These are VERIFIED facts and are LEFT ALONE.
 *   • a family-level typological PRIOR — "Member of <family> family — most
 *     languages in this family are tonal … (Source: family-level trait,
 *     Dryer & Haspelmath 2013)". This is an INFERENCE about the language, not a
 *     verified coding of it.
 *
 * Design call: represent the prior as an explicit DATA GAP, not as
 * an asserted feature — "tone not yet verified for THIS language; its family is
 * characteristically tonal; primary confirmation needed." This is faithful
 * (champollion-derived prior, never wearing D&H's name for a language-level
 * claim they did not make) and on-message for the corpora-building ask: the gap
 * is the invitation.
 *
 * Targets: linguisticChallenges.tone that cites "family-level trait" AND is not
 * directly confirmed (phonologicalInventory.isTonal !== true). Idempotent.
 *
 * Usage:
 *   node cli/scripts/reword-family-tone-gaps.mjs --dry-run
 *   node cli/scripts/reword-family-tone-gaps.mjs
 * ─────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.resolve(__dirname, '..', 'shared', 'language-cards');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const langIdx = args.indexOf('--lang');
const SINGLE_LANG = langIdx !== -1 ? args[langIdx + 1] : null;

const GAP_MARKER = 'Tone not yet verified';

/** A family-level-trait tone prior (not a direct PHOIBLE/WALS coding). */
function isFamilyTraitPrior(card) {
  const t = card.linguisticChallenges?.tone;
  if (typeof t !== 'string') return false;
  if (t.startsWith(GAP_MARKER)) return false;           // already reworded
  if (card.phonologicalInventory?.isTonal === true) return false; // directly confirmed
  return /family-level trait/i.test(t);
}

/** Pull the family name out of the prior prose, or fall back. */
function familyOf(card) {
  const t = card.linguisticChallenges?.tone || '';
  const m = t.match(/Member of ([^—-]+?) family/i);
  if (m) return m[1].trim();
  const fam = card.classification?.family || card.family;
  return typeof fam === 'string' && fam.trim() ? fam.trim() : null;
}

function gapNote(family) {
  const fam = family ? `Its family (${family}) is characteristically tonal` : 'Its language family is characteristically tonal';
  return `${GAP_MARKER} for this language. ${fam} (family-level typology, Dryer & Haspelmath 2013), but no primary PHOIBLE or WALS tone coding exists for this language yet — a data gap, not a confirmed feature.`;
}

const cardFiles = fs.readdirSync(CARDS_DIR, { withFileTypes: true })
  .filter(e => e.isFile() && e.name.endsWith('.json') && e.name !== 'language-tree.json')
  .map(e => e.name)
  .filter(name => !SINGLE_LANG || name === `${SINGLE_LANG}.json`);

console.log(`\n${'═'.repeat(60)}`);
console.log(`  FAMILY-LEVEL TONE PRIOR → HONEST DATA-GAP NOTE`);
console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🔧 LIVE RUN'}`);
console.log(`  Scanning ${cardFiles.length} card files...`);
console.log(`${'═'.repeat(60)}\n`);

const timestamp = new Date().toISOString();
let reworded = 0;
let noFamily = 0;

for (const filename of cardFiles) {
  const filePath = path.join(CARDS_DIR, filename);
  let card;
  try {
    card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`  ❌ Error reading ${filename}: ${err.message}`);
    continue;
  }
  if (!isFamilyTraitPrior(card)) continue;

  const family = familyOf(card);
  if (!family) noFamily++;
  card.linguisticChallenges.tone = gapNote(family);

  // Provenance: a labeled Champollion derivation, never D&H's name for a
  // language-level claim. _fieldSources is array-shaped for linguisticChallenges.
  if (!card._fieldSources) card._fieldSources = {};
  card._fieldSources['linguisticChallenges.tone'] = 'champollion-derived [family-level prior; Dryer & Haspelmath 2013]';

  card._toneGapReworded = {
    timestamp,
    reason: 'Family-level tonality is a prior about the family, not a verified coding of this language. Reframed as an explicit data gap per the index-not-arbiter principle; the family prior is retained, attributed as a Champollion derivation.',
    script: 'reword-family-tone-gaps.mjs',
  };

  reworded++;
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf8');
  }
}

console.log(`  Cards reworded to a data-gap note: ${reworded.toLocaleString().padStart(7)}`);
console.log(`  (of which family name unresolved): ${noFamily.toLocaleString().padStart(7)}`);
console.log(`\n${'═'.repeat(60)}\n`);
if (DRY_RUN) console.log('  ℹ️  DRY RUN — no files modified.\n');
