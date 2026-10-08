#!/usr/bin/env node

/**
 * derive-speaker-vitality-bridge.mjs
 * ─────────────────────────────────────────────────────────────────
 * Bridges data that exists on cards but in the wrong place for the
 * trading card display. Specifically:
 *
 * 1. Reconciles vitality.speakerCount against speakerEstimates[] and
 *    stamps the count's own provenance (vitality.speakerCountSource).
 *    Champollion is an INDEX, not an arbiter: speakerEstimates[] keeps
 *    EVERY source's number (the spread is shown), and the single
 *    displayed vitality.speakerCount must be a CITED value —
 *      • equal to one speakerEstimates[] entry → source = that entry's
 *        source;
 *      • a deliberate curated/blended figure that no single estimate
 *        supports (e.g. crk's 20,000) → source = 'champollion-derived'
 *        with a "[derived from <upstreams>]" note. NEVER a bare upstream
 *        name whose own estimate disagrees with the number.
 *    vitality.source is left untouched — it sources the vitality STATUS
 *    block (UNESCO/EGIDS/ELCat), not the speaker count.
 *
 * 2. Derives vitality.trend from ELCat speaker trends text
 *    (Display reads vitality.trend; we have elcatSpeakerTrends)
 *
 * 3. Builds scripts[] array from script string + scriptConverter
 *    (Display reads card.scripts[]; we have card.script string)
 *
 * These are pure derivations — no external data, just reshaping
 * what's already on the cards to make it display-compatible.
 *
 * Usage:
 *   node scripts/derive-speaker-vitality-bridge.mjs
 *   node scripts/derive-speaker-vitality-bridge.mjs --dry-run
 *   node scripts/derive-speaker-vitality-bridge.mjs --lang hye
 * ─────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const langIdx = args.indexOf('--lang');
const SINGLE_LANG = langIdx !== -1 ? args[langIdx + 1] : null;

// ── Script code to name mapping ─────────────────────────────────
// ISO 15924 script codes to human-readable names
const SCRIPT_NAMES = {
  Latn: 'Latin', Cyrl: 'Cyrillic', Arab: 'Arabic', Deva: 'Devanagari',
  Hans: 'Simplified Chinese', Hant: 'Traditional Chinese', Hang: 'Hangul',
  Kore: 'Korean', Jpan: 'Japanese', Thai: 'Thai', Hebr: 'Hebrew',
  Grek: 'Greek', Beng: 'Bengali', Gujr: 'Gujarati', Guru: 'Gurmukhi',
  Knda: 'Kannada', Mlym: 'Malayalam', Orya: 'Odia', Sinh: 'Sinhala',
  Taml: 'Tamil', Telu: 'Telugu', Geor: 'Georgian', Armn: 'Armenian',
  Ethi: 'Ethiopic', Tibt: 'Tibetan', Mymr: 'Myanmar', Khmr: 'Khmer',
  Lao: 'Lao', Cans: 'Canadian Syllabics', Cher: 'Cherokee',
  Mong: 'Mongolian', Syrc: 'Syriac', Nkoo: 'N\'Ko', Tfng: 'Tifinagh',
  Vaii: 'Vai', Bamu: 'Bamum', Osge: 'Osage', Talu: 'New Tai Lue',
  Tavt: 'Tai Viet', Java: 'Javanese', Bali: 'Balinese', Sund: 'Sundanese',
  Bugi: 'Buginese', Lana: 'Tai Tham', Mand: 'Mandaic',
};

// ── Trend derivation from ELCat text ─────────────────────────────
function deriveTrend(card) {
  const elcatTrends = card.vitality?.elcatSpeakerTrends || '';
  const elcatTransmission = card.vitality?.elcatTransmission || '';
  const combined = (elcatTrends + ' ' + elcatTransmission).toLowerCase();

  // Clear growth signals
  if (combined.includes('increasing') || combined.includes('growing') ||
      combined.includes('revitalization') || combined.includes('resurgence') ||
      combined.includes('growing rapidly')) {
    return 'growing';
  }

  // Clear decline signals
  if (combined.includes('decreasing') || combined.includes('declining') ||
      combined.includes('diminishing') ||
      combined.includes('shrinking') || combined.includes('fewer') ||
      combined.includes('no longer') || combined.includes('only a few') ||
      combined.includes('no children') || combined.includes('all elderly') ||
      combined.includes('no speakers')) {
    return 'declining';
  }

  // Stability signals
  if (combined.includes('stable') || combined.includes('maintained') ||
      combined.includes('nearly all') || combined.includes('majority')) {
    return 'stable';
  }

  // No inference from severity: a status is a LEVEL, not a direction —
  // endangered languages with active revitalization are rising, and the
  // old severity→'declining' fallback made that structurally invisible
  // (founder-flagged 2026-07-14). Trend comes from trend EVIDENCE only.
  return null; // Genuinely unknown
}

// ── Main ──────────────────────────────────────────────────────────
const cardsDir = path.join(ROOT, 'shared/language-cards');
let files = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json'));
if (SINGLE_LANG) files = files.filter(f => f === `${SINGLE_LANG}.json`);

let processed = 0;
let speakerBridged = 0, speakerCited = 0, speakerDerived = 0, trendDerived = 0, scriptsBuilt = 0;

for (const file of files) {
  const filePath = path.join(cardsDir, file);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  processed++;
  let changed = false;
  // Provenance to stamp for vitality.speakerCount, decided below.
  let speakerCountFieldSource = null;

  // 1. Reconcile speaker count against speakerEstimates[] and cite it.
  //    NOTE: no `!card.vitality.speakerCount` guard — legacy/pre-seeded
  //    values (e.g. crk's 20,000) MUST be reconciled, not skipped.
  const validEntries = Array.isArray(card.speakerEstimates)
    ? card.speakerEstimates.filter(e => typeof e.count === 'number' && e.count > 0)
    : [];
  const current0 = card.vitality?.speakerCount;
  // A curated human-readable range ('~50M', '20K-25K') is a deliberate
  // display value — leave it untouched, exactly as the old guard did.
  const curatedStringCount = typeof current0 === 'string' && current0.trim() !== '';
  if (validEntries.length > 0 && !curatedStringCount) {
    if (!card.vitality) card.vitality = {};
    const current = card.vitality.speakerCount;

    let chosenCount, chosenSource, fieldSource;
    if (typeof current === 'number' && current > 0) {
      // A pre-seeded value exists — reconcile it rather than overwrite.
      const match = validEntries.find(e => e.count === current);
      if (match) {
        // The displayed number IS one of the cited estimates: name it.
        chosenCount = current;
        chosenSource = match.source;
        fieldSource = match.source;
        speakerCited++;
      } else {
        // A deliberate curated/blended figure no single estimate backs.
        // Keep the number; cite it honestly as champollion-derived.
        const upstreams = [...new Set(validEntries.map(e => e.source).filter(Boolean))].join('+');
        chosenCount = current;
        chosenSource = 'champollion-derived';
        fieldSource = upstreams ? `champollion-derived [from ${upstreams}]` : 'champollion-derived';
        speakerDerived++;
      }
    } else {
      // No pre-seeded value: surface the highest cited estimate, named.
      const best = validEntries.reduce((max, e) => e.count > max.count ? e : max, validEntries[0]);
      chosenCount = best.count;
      chosenSource = best.source;
      fieldSource = best.source;
      speakerBridged++;
    }

    if (card.vitality.speakerCount !== chosenCount ||
        card.vitality.speakerCountSource !== chosenSource) {
      card.vitality.speakerCount = chosenCount;
      card.vitality.speakerCountSource = chosenSource;
      changed = true;
    }
    speakerCountFieldSource = fieldSource;
  }

  // 2. Derive vitality.trend from ELCat data
  if (card.vitality && !card.vitality.trend) {
    const trend = deriveTrend(card);
    if (trend) {
      card.vitality.trend = trend;
      trendDerived++;
      changed = true;
    }
  }

  // 3. Build scripts[] array from script string
  if (card.script && (!card.scripts || card.scripts.length === 0)) {
    const scriptCodes = card.script.split(/[,+\/]/).map(s => s.trim()).filter(Boolean);
    const scriptsArray = scriptCodes.map((code, i) => ({
      code: code,
      name: SCRIPT_NAMES[code] || code,
      primary: i === 0,
    }));

    if (scriptsArray.length > 0) {
      card.scripts = scriptsArray;
      scriptsBuilt++;
      changed = true;
    }
  }

  if (changed) {
    if (!card._fieldSources) card._fieldSources = {};
    if (card.vitality?.speakerCount !== undefined && speakerCountFieldSource) {
      // Name the count's actual source (an estimate's source, or
      // 'champollion-derived [from …]') — not the generic placeholder.
      card._fieldSources['vitality.speakerCount'] = speakerCountFieldSource;
    }
    if (card.vitality?.trend) {
      card._fieldSources['vitality.trend'] = 'derived:elcat+unesco';
    }
    if (card.scripts) {
      card._fieldSources.scripts = 'derived:script';
    }

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n');
    }
  }
}

console.log(`
  RESULTS:
  ─────────────────────────────────────
  Cards processed:             ${processed.toLocaleString().padStart(6)}
  Speaker counts bridged (new):${speakerBridged.toLocaleString().padStart(6)}
  Speaker counts cited (=est): ${speakerCited.toLocaleString().padStart(6)}
  Speaker counts champ-derived:${speakerDerived.toLocaleString().padStart(6)}
  Vitality trends derived:     ${trendDerived.toLocaleString().padStart(6)}
  Scripts arrays built:        ${scriptsBuilt.toLocaleString().padStart(6)}
${'═'.repeat(55)}
`);
