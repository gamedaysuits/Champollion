#!/usr/bin/env node

/**
 * derive-orthographies.mjs
 * ────────────────────────────────────────────────────────────────
 * Populates the top-level `orthographies[]` field (forge/DESIGN.md
 * §7 card-schema addition #3): structured writing-convention entries
 * restructured from data already on the card —
 *
 *   • one entry per valid `scripts[]` entry (same order), carrying
 *     that entry's own source;
 *   • `scheme` extracted from the script entry's name ONLY via a
 *     tiny allowlist of named orthographic schemes the sources
 *     themselves spell out (currently just 'SRO' — "Latin (SRO)" on
 *     the Cree cards). Parentheticals are otherwise qualifiers
 *     ("Eastern", "romanization") and are never promoted;
 *   • `canonicalForMt: true` derived for sole-script cards whose
 *     orthographicStatus is a written status (the only orthography
 *     on the card is trivially its working form). Multi-script cards
 *     get NO canonicalForMt unless curated — the crk case proves the
 *     `primary` display flag is not the MT-canonical signal (Cans is
 *     primary, SRO/Latn is the working script);
 *   • convention details (scheme / longVowelMarking / canonicalForMt
 *     overrides) merged from the cited curated register
 *     shared/curated-orthography-conventions.json (data-over-code).
 *
 * Optional keys are OMITTED when unknown — never guessed (index, not
 * arbiter). Everything here is capability/property structure; no
 * measured scores (lint R3/R4 safe by construction).
 *
 * IDEMPOTENCY / OWNERSHIP:
 *   `orthographies` is a pure function of scripts[] +
 *   orthographicStatus + the curated register, recomputed wholesale
 *   on every run. Cards without scripts[] get (and keep) no field.
 *
 * PROVENANCE:
 *   _fieldSources['orthographies'] =
 *     'derived:scripts+orthographic-status (conventions: curated-orthography-conventions.json)'
 *   Per-entry `source` is the scripts[] entry's own source id, or the
 *   curated register's cited source for curated keys. No new external
 *   source enters the card, so dataSources is left untouched.
 *
 * Usage:
 *   node scripts/derive-orthographies.mjs              # all cards
 *   node scripts/derive-orthographies.mjs --dry-run    # preview
 *   node scripts/derive-orthographies.mjs --lang crk   # single card
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const CONVENTIONS_PATH = path.join(CLI_ROOT, 'shared', 'curated-orthography-conventions.json');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const FIELD_SOURCE_STAMP =
  'derived:scripts+orthographic-status (conventions: curated-orthography-conventions.json)';

const SCRIPT_CODE_RE = /^[A-Z][a-z]{3}$/;

/**
 * Named orthographic schemes that script-name parentheticals may assert
 * (e.g. linguameta's "Latin (SRO)" on crk/cwd/csw/crm). Everything else in
 * parentheses is a qualifier, not a scheme — never promoted.
 */
const SCHEME_ALLOWLIST = new Set(['SRO']);

/** Written statuses — the sole-script canonicalForMt derivation requires one. */
const WRITTEN_STATUSES = new Set([
  'standardized', 'de-facto-standard', 'has-orthography', 'developing',
]);

function loadConventions() {
  if (!fs.existsSync(CONVENTIONS_PATH)) {
    console.error(`  ❌ Missing ${path.relative(CLI_ROOT, CONVENTIONS_PATH)} — curated conventions register not found`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(CONVENTIONS_PATH, 'utf-8'));
  return data.conventions || {};
}

/** Derive the orthographies[] array for one card, or null when it has none. */
function deriveOrthographies(card, conventionsByLang) {
  const scripts = card.scripts;
  if (!Array.isArray(scripts) || scripts.length === 0) return null;

  const valid = scripts.filter(
    s => s && typeof s === 'object' && typeof s.code === 'string' && SCRIPT_CODE_RE.test(s.code)
  );
  if (valid.length === 0) return null;

  const status = card.orthographicStatus;
  const soleScriptCanonical = valid.length === 1 && WRITTEN_STATUSES.has(status);
  const curated = conventionsByLang[card.code] || null;

  const out = [];
  const seen = new Set();
  for (const s of valid) {
    if (seen.has(s.code)) continue; // scripts[] duplicates collapse to one entry
    seen.add(s.code);

    const entry = { script: s.code };

    // scheme from the source's own name, allowlisted named schemes only
    const paren = typeof s.name === 'string' ? s.name.match(/\(([^)]+)\)/) : null;
    if (paren && SCHEME_ALLOWLIST.has(paren[1].trim())) {
      entry.scheme = paren[1].trim();
    }

    if (soleScriptCanonical) entry.canonicalForMt = true;

    entry.source =
      (typeof s.source === 'string' && s.source) ||
      (typeof card._fieldSources?.scripts === 'string' && card._fieldSources.scripts) ||
      'derived:scripts';

    // Curated conventions override/extend (cited in the register itself)
    const conv = curated ? curated[s.code] : null;
    if (conv && typeof conv === 'object') {
      if (typeof conv.scheme === 'string') entry.scheme = conv.scheme;
      if (typeof conv.longVowelMarking === 'string') entry.longVowelMarking = conv.longVowelMarking;
      if (typeof conv.canonicalForMt === 'boolean') entry.canonicalForMt = conv.canonicalForMt;
      if (typeof conv.source === 'string' && conv.source) entry.source = conv.source;
    }

    out.push(entry);
  }

  return out.length > 0 ? out : null;
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Orthographies Derivation → orthographies[]');
  console.log('  Inputs: scripts[] + orthographicStatus + curated conventions');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const conventionsByLang = loadConventions();

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
  let withField = 0;
  let withScheme = 0;
  let withCanonical = 0;
  let curatedApplied = 0;
  let unwrittenWithScripts = 0; // status says unwritten but scripts[] asserts entries

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }
    processed++;

    const derived = deriveOrthographies(card, conventionsByLang);
    const before = JSON.stringify(card);

    if (derived) {
      card.orthographies = derived;
      if (!card._fieldSources) card._fieldSources = {};
      card._fieldSources.orthographies = FIELD_SOURCE_STAMP;

      withField++;
      if (derived.some(e => 'scheme' in e)) withScheme++;
      if (derived.some(e => e.canonicalForMt === true)) withCanonical++;
      if (conventionsByLang[card.code]) curatedApplied++;
      if (card.orthographicStatus === 'unwritten') unwrittenWithScripts++;
    } else if ('orthographies' in card) {
      // Ownership: no derivable entries → the generator removes its field.
      delete card.orthographies;
      if (card._fieldSources && 'orthographies' in card._fieldSources) {
        delete card._fieldSources.orthographies;
      }
    }

    if (JSON.stringify(card) !== before) {
      modified++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  console.log('  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards processed:            ${processed.toLocaleString()}`);
  console.log(`  Cards with orthographies[]: ${withField.toLocaleString()}`);
  console.log(`  Cards modified this run:    ${modified.toLocaleString()}`);
  console.log(`  … with a named scheme:      ${withScheme.toLocaleString()}`);
  console.log(`  … with canonicalForMt:      ${withCanonical.toLocaleString()}`);
  console.log(`  … curated conventions used: ${curatedApplied.toLocaleString()}`);
  console.log(`  ⚠ unwritten-status cards whose scripts[] still asserts entries (kept, faithful): ${unwrittenWithScripts.toLocaleString()}`);
  if (DRY_RUN) console.log('\n  ℹ  DRY RUN — no files were modified');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
