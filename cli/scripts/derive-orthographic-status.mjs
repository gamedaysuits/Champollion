#!/usr/bin/env node

/**
 * derive-orthographic-status.mjs
 * ────────────────────────────────────────────────────────────────
 * Derives `orthographicStatus` from existing card data + LinguaMeta.
 *
 * Currently 0% populated (all 8,028 cards have null). This script
 * infers the status by combining multiple signals:
 *
 *   1. CLDR coverage + LinguaMeta `cldr_official_status`
 *      → Official/Regional official = 'standardized'
 *      → De facto official = 'de-facto-standard'
 *
 *   2. LinguaMeta `writing_systems` populated (with CLDR=true)
 *      → 'has-orthography' (known writing system in CLDR)
 *
 *   3. Card has `script` + `keyboardSupport`
 *      → 'has-orthography' (keyboard implies some standardization)
 *
 *   4. Card has `script` but no CLDR/keyboard
 *      → 'developing' (script assigned but not standardized)
 *
 *   5. Card has no `script`
 *      → 'unwritten' (no known script)
 *
 * Values: standardized | de-facto-standard | has-orthography |
 *         developing | unwritten
 *
 * This field is ALWAYS overwritten because it's derived — it's
 * a computed synthesis of other fields, not curated data.
 *
 * Idempotent: produces the same result on repeated runs.
 *
 * Usage:
 *   node scripts/derive-orthographic-status.mjs              # all cards
 *   node scripts/derive-orthographic-status.mjs --dry-run    # preview
 *   node scripts/derive-orthographic-status.mjs --lang crk   # single card
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(CLI_ROOT, 'data');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();


// ═══════════════════════════════════════════════════════════════
//  LinguaMeta Loader — CLDR status + writing system data
//  We only need three columns from the TSV for this script:
//    - iso_639_3_code: for matching to cards
//    - cldr_official_status: to determine standardization level
//    - writing_systems: to confirm orthography exists
// ═══════════════════════════════════════════════════════════════

function loadLinguaMetaCLDR() {
  const tsvPath = path.join(DATA_DIR, 'linguameta', 'linguameta.tsv');
  if (!fs.existsSync(tsvPath)) {
    console.log('  ⚠️  LinguaMeta data not found — CLDR enrichment will be limited');
    return new Map();
  }

  const content = fs.readFileSync(tsvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split('\t');

  // Find column indices
  const isoCol = headers.indexOf('iso_639_3_code');
  const cldrCol = headers.indexOf('cldr_official_status');
  const wsCol = headers.indexOf('writing_systems');

  if (isoCol === -1) {
    console.log('  ⚠️  LinguaMeta TSV missing iso_639_3_code column — skipping');
    return new Map();
  }

  const data = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const iso = (cols[isoCol] || '').trim();
    if (!iso) continue;

    // Parse the CLDR official status string
    // Format examples from actual data (mixed case!):
    //   "Official [ZA]"              — capital O
    //   "De facto official [CH]"     — lowercase o
    //   "Regional official [IN]"     — lowercase o
    //   "De facto official [MX], Official [BO], ..."
    //   "" (empty)
    const cldrRaw = cldrCol !== -1 ? (cols[cldrCol] || '').trim() : '';
    const writingSystems = wsCol !== -1 ? (cols[wsCol] || '').trim() : '';

    // Split comma-separated entries and classify each one.
    // Priority: "Official" > "Regional official" > "De facto official"
    // A language that is "Official" anywhere is standardized,
    // even if it's also "De facto official" in other countries.
    let cldrStatus = null;
    if (cldrRaw) {
      const entries = cldrRaw.split(',').map(e => e.trim().toLowerCase());
      let hasOfficial = false;
      let hasRegionalOfficial = false;
      let hasDeFacto = false;

      for (const entry of entries) {
        // Strip the country code bracket: "official [za]" → "official"
        const statusPart = entry.replace(/\s*\[.*?\]\s*/g, '').trim();

        if (statusPart === 'official') {
          hasOfficial = true;
        } else if (statusPart === 'regional official') {
          hasRegionalOfficial = true;
        } else if (statusPart === 'de facto official') {
          hasDeFacto = true;
        }
      }

      // Highest wins: Official/Regional → standardized, De facto only → de-facto
      if (hasOfficial || hasRegionalOfficial) {
        cldrStatus = 'official';
      } else if (hasDeFacto) {
        cldrStatus = 'de-facto';
      }
    }

    data.set(iso, {
      cldrStatus,        // 'official' | 'de-facto' | null
      hasWritingSystems: writingSystems.length > 0,
    });
  }

  const withStatus = [...data.values()].filter(d => d.cldrStatus).length;
  console.log(`  LinguaMeta CLDR: ${data.size.toLocaleString()} entries, ${withStatus} with official status`);
  return data;
}


// ═══════════════════════════════════════════════════════════════
//  Derivation Logic
//  Combines card fields + LinguaMeta data to determine the
//  orthographic status. Ordered by confidence (highest first).
// ═══════════════════════════════════════════════════════════════

/**
 * Derives orthographicStatus from card data + LinguaMeta CLDR info.
 *
 * Decision cascade:
 *   1. CLDR official → standardized
 *   2. CLDR de-facto → de-facto-standard
 *   3. CLDR coverage + writing systems → has-orthography
 *   4. script + keyboard → has-orthography
 *   5. script only → developing
 *   6. no script → unwritten
 */
function deriveOrthographicStatus(card, lmData) {
  const hasCldr = card.databaseCoverage?.cldr === true;
  const hasScript = card.script !== null && card.script !== undefined;
  const hasKeyboard = card.keyboardSupport !== null && card.keyboardSupport !== undefined;

  // ── Rule 1+2: CLDR coverage with LinguaMeta official status ──
  // If the language is in CLDR, check what level of officialdom it has
  if (hasCldr && lmData) {
    if (lmData.cldrStatus === 'official') {
      return 'standardized';
    }
    if (lmData.cldrStatus === 'de-facto') {
      return 'de-facto-standard';
    }

    // CLDR has it, and LinguaMeta confirms a writing system exists,
    // but no official status recorded → still has an orthography
    if (lmData.hasWritingSystems) {
      return 'has-orthography';
    }
  }

  // ── Rule 3: Script + keyboard support ──
  // A keyboard implies someone formalized the script enough for input.
  // That's stronger than just having a script code assigned.
  if (hasScript && hasKeyboard) {
    return 'has-orthography';
  }

  // ── Rule 4: Script exists but no keyboard/CLDR ──
  // The language has a known script (from Wikidata, LinguaMeta, etc.)
  // but no evidence of standardized tooling yet.
  if (hasScript) {
    return 'developing';
  }

  // ── Rule 5: No script at all ──
  // No script assignment found from any source — likely unwritten
  return 'unwritten';
}


// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Orthographic Status Derivation');
  console.log('  Sources: card.databaseCoverage.cldr + LinguaMeta CLDR');
  console.log('           + card.script + card.keyboardSupport');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN (no files written)' : 'LIVE'));
  if (SINGLE_LANG) console.log('  Target: ' + SINGLE_LANG);
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Loading data sources...');
  const linguaMetaCLDR = loadLinguaMetaCLDR();

  // ── Select cards to process ──
  let cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  if (SINGLE_LANG) {
    const target = `${SINGLE_LANG}.json`;
    if (!cardFiles.includes(target)) {
      console.error(`\n  ❌ Card not found: ${target}`);
      process.exit(1);
    }
    cardFiles = [target];
  }

  // ── Stats tracking ──
  let totalCards = 0;
  let totalModified = 0;
  const distribution = {
    'standardized': 0,
    'de-facto-standard': 0,
    'has-orthography': 0,
    'developing': 0,
    'unwritten': 0,
  };
  const samplesByStatus = {
    'standardized': [],
    'de-facto-standard': [],
    'has-orthography': [],
    'developing': [],
    'unwritten': [],
  };
  const MAX_SAMPLES = 3; // Show a few examples per status

  for (const filename of cardFiles) {
    totalCards++;
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }

    const iso = card.iso639_3 || card.code;
    if (!iso) continue;

    const lmData = linguaMetaCLDR.get(iso) || null;

    // Derive the orthographic status
    const status = deriveOrthographicStatus(card, lmData);

    // Always overwrite — this is a derived field, not curated data
    const oldStatus = card.orthographicStatus;
    card.orthographicStatus = status;

    // Source attribution — list all inputs used in derivation
    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources.orthographicStatus = 'derived:cldr+script+keyboard';

    // Track distribution
    distribution[status]++;

    // Collect samples for preview
    if (samplesByStatus[status].length < MAX_SAMPLES) {
      samplesByStatus[status].push({
        code: iso,
        name: card.name,
        oldStatus,
      });
    }

    // Only write if the value actually changed
    if (oldStatus !== status) {
      totalModified++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  // ── Report ──
  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Total cards scanned:  ${totalCards.toLocaleString()}`);
  console.log(`  Cards modified:       ${totalModified.toLocaleString()}`);

  console.log('\n  DISTRIBUTION:');
  console.log('  ─────────────────────────────────────');
  const statusLabels = {
    'standardized': 'Standardized       ',
    'de-facto-standard': 'De facto standard   ',
    'has-orthography': 'Has orthography     ',
    'developing': 'Developing          ',
    'unwritten': 'Unwritten           ',
  };
  for (const [status, label] of Object.entries(statusLabels)) {
    const count = distribution[status];
    const pct = totalCards > 0 ? ((count / totalCards) * 100).toFixed(1) : '0.0';
    const bar = '█'.repeat(Math.round(count / totalCards * 40));
    console.log(`  ${label} ${count.toLocaleString().padStart(6)}  (${pct.padStart(5)}%)  ${bar}`);
  }

  // Show samples for each status
  console.log('\n  SAMPLES:');
  console.log('  ─────────────────────────────────────');
  for (const [status, samples] of Object.entries(samplesByStatus)) {
    if (samples.length === 0) continue;
    console.log(`  [${status}]`);
    for (const s of samples) {
      console.log(`    ${s.code}  ${s.name}`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
