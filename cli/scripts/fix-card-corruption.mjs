#!/usr/bin/env node

/**
 * fix-card-corruption.mjs
 * ────────────────────────────────────────────────────────────────
 * Pattern-targeted repairs for the corruption classes found by
 * scripts/audit-card-data-quality.mjs (see docs/CARD_DATA_QUALITY_AUDIT.md).
 *
 * ⚠️  EXECUTION ORDER: do NOT run while a decontamination cycle holds
 *     the cards/DB. This script is prepared-but-not-executed; run it
 *     only AFTER the in-flight decontamination completes, then re-run
 *     the audit to verify zero findings.
 *
 * DEFAULT IS --dry-run. Pass --apply to write changes.
 *
 * Fix classes (all card-side; DB-side companion SQL is at the bottom
 * of this header for the decontamination owner to apply):
 *
 *   F1 url-in-nativeName      nativeName matching a URL / wikidata
 *                             blank-node genid URI → null, and the
 *                             stale `wikidata-P1705` _fieldSources
 *                             stamp is removed. (bsa, xce)
 *
 *   F2 mojibake-alt-names     UTF-8-read-as-Latin-1 mojibake in
 *                             alternateNames[] → re-decode
 *                             (latin1 bytes → utf8). If the repaired
 *                             string already exists in the array
 *                             (case-insensitive), the corrupt element
 *                             is dropped instead. (cjm, djj — the
 *                             mojibake is verbatim in upstream ELCat
 *                             languages.csv, so re-ingest would
 *                             reintroduce it without this guard)
 *
 *   F3 unsplit-alt-names      a semicolon-joined "all names" string
 *                             stored as a single alternateNames[]
 *                             element, duplicating names that already
 *                             exist individually → element removed.
 *                             Only removed when EVERY split part is
 *                             already covered by another element /
 *                             card.name / card.nativeName, so no
 *                             information is lost. (~2,379 cards)
 *
 *   F4 placeholder-strings    display-field values that are literal
 *                             placeholders ("TBD", "unknown", "null",
 *                             "undefined", "N/A", "TODO…", or the
 *                             field's own name) → null. (0 today;
 *                             kept as a guard for future runs)
 *
 *   F5 empty-string-to-null   "" in display-critical fields
 *                             (name/nativeName/script/macroarea) →
 *                             null for schema consistency. (0 today)
 *
 * Provenance stamping plan (applied per repaired card):
 *   - every repair appends an entry to card._dataQualityFixes:
 *       { rule, field, before, after, at, by: 'fix-card-corruption.mjs' }
 *     `before` is truncated to 200 chars. This mirrors the
 *     _decontaminated convention already used on 628 cards.
 *   - when F1 nulls nativeName, _fieldSources.nativeName is deleted
 *     (a null field must not carry a source claim).
 *   - dataSources is NOT touched: other fields may still legitimately
 *     cite the same source.
 *
 * DB-side companion (for the decontamination owner — NOT run here):
 *   -- the two corrupt facts mirroring F1:
 *   --   DELETE FROM facts WHERE property='nativeName'
 *   --     AND value LIKE '%/.well-known/genid/%';
 *   -- (2 rows as of 2026-06-11: bsa id 5902653, xce)
 *
 * Usage:
 *   node scripts/fix-card-corruption.mjs              # dry-run (default)
 *   node scripts/fix-card-corruption.mjs --apply      # write changes
 *   node scripts/fix-card-corruption.mjs --lang bsa   # single card
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');

const APPLY = process.argv.includes('--apply');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Shared pattern definitions (kept in sync with the audit) ───
const RE_URL = /^(https?|ftp):\/\/\S+/i;
const RE_GENID = /\.well-known\/genid\//i;
const RE_MOJIBAKE = /(Ã[ -¿]|â€[™œ“”˜¦]|Ã‚|ï¿½)/;
const RE_REPLACEMENT = /�/;
// 'na'/'none' deliberately absent — "Na" (nbt) and "None" (alt name of
// Noon, snf) are genuine language names.
const PLACEHOLDERS = new Set([
  'tbd', 'todo', 'unknown', 'null', 'undefined', 'n/a',
  'tba', 'fixme', 'xxx', 'placeholder', '???', '-', '--',
]);
const RE_TODO_PREFIX = /^TODO[:\s]/;
const DISPLAY_CRITICAL = ['name', 'nativeName', 'script', 'macroarea'];

// ─── Repair helpers ─────────────────────────────────────────────

/**
 * Attempt to repair UTF-8-read-as-Latin-1 mojibake by re-encoding.
 * "NdjÃ©bbana" → bytes [4E 64 6A C3 A9 ...] → utf8 "Ndjébbana".
 * Returns null when the round-trip is not a clean repair (introduces
 * replacement chars, or doesn't change anything).
 */
export function repairMojibake(s) {
  try {
    const repaired = Buffer.from(s, 'latin1').toString('utf8');
    if (repaired === s) return null;
    if (RE_REPLACEMENT.test(repaired)) return null;
    if (RE_MOJIBAKE.test(repaired)) return null; // still garbled
    return repaired;
  } catch {
    return null;
  }
}

/**
 * True when a semicolon-joined alternateNames element is fully
 * redundant: every split part already exists elsewhere on the card.
 */
export function isRedundantJoinedElement(element, card, allNamesLower) {
  if (!element.includes('; ')) return false;
  const parts = element.split(';').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every(p => {
    if (allNamesLower.has(p.toLowerCase())) return true;
    // A mojibake part is covered when its repaired form is covered —
    // the corrupt spelling only ever existed inside the relic (or as a
    // duplicate F2 already dropped), so no information is lost.
    if (RE_MOJIBAKE.test(p)) {
      const repaired = repairMojibake(p);
      if (repaired && allNamesLower.has(repaired.toLowerCase())) return true;
    }
    return false;
  });
}

function isPlaceholder(v, fieldName) {
  const lower = v.trim().toLowerCase();
  return PLACEHOLDERS.has(lower)
    || RE_TODO_PREFIX.test(v.trim())
    || lower === fieldName.toLowerCase();
}

// ═══════════════════════════════════════════════════════════════
//  Exported linter rules — to be added to buildRules() in
//  lint-language-cards.mjs LATER (after the decontamination cycle;
//  do not edit the linter while it's in flight). Shape matches the
//  linter's { id, severity, describe, check } convention.
// ═══════════════════════════════════════════════════════════════

/** Human-text fields that must never contain a URL. */
const TEXT_FIELDS_NO_URL = [
  'name', 'nativeName', 'endonym', 'arealContext', 'notes',
];

export const ruleNoUrlInTextFields = {
  id: 'no-url-in-text-fields',
  severity: 'error',
  describe: 'Human-text fields (name, nativeName, …) must not contain URLs or wikidata genid URIs',
  check: (card) => {
    for (const f of TEXT_FIELDS_NO_URL) {
      const v = card[f];
      if (typeof v === 'string' && (RE_URL.test(v) || RE_GENID.test(v))) {
        return `${f} is URL-shaped: ${v.slice(0, 80)}`;
      }
    }
    const alt = Array.isArray(card.alternateNames) ? card.alternateNames : [];
    for (let i = 0; i < alt.length; i++) {
      if (typeof alt[i] === 'string' && (RE_URL.test(alt[i]) || RE_GENID.test(alt[i]))) {
        return `alternateNames[${i}] is URL-shaped: ${alt[i].slice(0, 80)}`;
      }
    }
    return null;
  },
};

export const ruleNoPlaceholderStrings = {
  id: 'no-placeholder-strings',
  severity: 'error',
  describe: 'Display fields must not hold placeholder strings (TBD/unknown/null/undefined/N/A/TODO/field-name echo)',
  check: (card) => {
    for (const f of [...DISPLAY_CRITICAL, 'arealContext', 'notes']) {
      const v = card[f];
      if (typeof v === 'string' && v.length > 0 && isPlaceholder(v, f)) {
        return `${f} holds placeholder string ${JSON.stringify(v)}`;
      }
    }
    return null;
  },
};

// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════

function stamp(card, rule, field, before, after) {
  if (!Array.isArray(card._dataQualityFixes)) card._dataQualityFixes = [];
  card._dataQualityFixes.push({
    rule, field,
    before: typeof before === 'string' ? before.slice(0, 200) : before,
    after,
    at: new Date().toISOString(),
    by: 'fix-card-corruption.mjs',
  });
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Card Corruption Repair');
  console.log('  Mode: ' + (APPLY ? 'APPLY (writing changes)' : 'DRY RUN (default — pass --apply to write)'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const files = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json')
    .filter(f => !SINGLE_LANG || f === `${SINGLE_LANG}.json`)
    .sort();

  const tally = { F1: 0, F2: 0, F3: 0, F4: 0, F5: 0 };
  let cardsModified = 0;

  for (const file of files) {
    const filePath = path.join(CARDS_DIR, file);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      console.error(`  ⚠ unparseable, skipping: ${file}`);
      continue;
    }
    const code = card.code || file.replace(/\.json$/, '');
    let modified = false;

    // ── F1: URL / genid in nativeName ────────────────────────
    if (typeof card.nativeName === 'string'
        && (RE_URL.test(card.nativeName) || RE_GENID.test(card.nativeName))) {
      console.log(`  [F1] ${code}: nativeName → null   (was: ${card.nativeName.slice(0, 80)})`);
      stamp(card, 'url-in-nativeName', 'nativeName', card.nativeName, null);
      card.nativeName = null;
      if (card._fieldSources && card._fieldSources.nativeName) {
        delete card._fieldSources.nativeName;
      }
      tally.F1++; modified = true;
    }

    // ── F2 + F3: alternateNames repairs ──────────────────────
    if (Array.isArray(card.alternateNames) && card.alternateNames.length > 0) {
      const alt = card.alternateNames;

      // F2: mojibake decode (element-wise)
      for (let i = 0; i < alt.length; i++) {
        const v = alt[i];
        if (typeof v !== 'string' || !RE_MOJIBAKE.test(v)) continue;
        const repaired = repairMojibake(v);
        const others = alt.filter((_, j) => j !== i)
          .map(x => String(x).toLowerCase());
        if (repaired && others.includes(repaired.toLowerCase())) {
          console.log(`  [F2] ${code}: drop alternateNames[${i}] (mojibake dup of existing "${repaired}")`);
          stamp(card, 'mojibake-alt-name-duplicate', `alternateNames[${i}]`, v, null);
          alt.splice(i, 1); i--;
        } else if (repaired) {
          console.log(`  [F2] ${code}: alternateNames[${i}] "${v}" → "${repaired}"`);
          stamp(card, 'mojibake-alt-name-decoded', `alternateNames[${i}]`, v, repaired);
          alt[i] = repaired;
        } else {
          console.log(`  [F2] ${code}: alternateNames[${i}] mojibake NOT auto-repairable, leaving for manual review: "${v.slice(0, 60)}"`);
          continue;
        }
        tally.F2++; modified = true;
      }

      // F3: redundant semicolon-joined element
      const allNamesLower = new Set(
        [card.name, card.nativeName,
          ...alt.filter(x => typeof x === 'string' && !x.includes('; '))]
          .filter(Boolean).map(x => String(x).toLowerCase()),
      );
      for (let i = 0; i < alt.length; i++) {
        const v = alt[i];
        if (typeof v !== 'string') continue;
        if (isRedundantJoinedElement(v, card, allNamesLower)) {
          if (tally.F3 < 10) {
            console.log(`  [F3] ${code}: drop redundant joined alternateNames[${i}]: "${v.slice(0, 70)}"`);
          }
          stamp(card, 'unsplit-alt-names-relic', `alternateNames[${i}]`, v, null);
          alt.splice(i, 1); i--;
          tally.F3++; modified = true;
        }
      }
    }

    // ── F4: placeholder strings in display fields ────────────
    for (const f of DISPLAY_CRITICAL) {
      const v = card[f];
      if (typeof v === 'string' && v.length > 0 && isPlaceholder(v, f)) {
        console.log(`  [F4] ${code}: ${f} placeholder "${v}" → null`);
        stamp(card, 'placeholder-string', f, v, null);
        card[f] = null;
        if (card._fieldSources && card._fieldSources[f]) delete card._fieldSources[f];
        tally.F4++; modified = true;
      }
    }

    // ── F5: empty string → null ──────────────────────────────
    for (const f of DISPLAY_CRITICAL) {
      if (card[f] === '') {
        console.log(`  [F5] ${code}: ${f} "" → null`);
        stamp(card, 'empty-string-to-null', f, '', null);
        card[f] = null;
        tally.F5++; modified = true;
      }
    }

    if (modified) {
      cardsModified++;
      if (APPLY) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  console.log('\n  RESULTS' + (APPLY ? '' : ' (dry run — nothing written)'));
  console.log('  ─────────────────────────────────────');
  console.log(`  F1 url-in-nativeName:      ${tally.F1}`);
  console.log(`  F2 mojibake-alt-names:     ${tally.F2}`);
  console.log(`  F3 unsplit-alt-names:      ${tally.F3}`);
  console.log(`  F4 placeholder-strings:    ${tally.F4}`);
  console.log(`  F5 empty-string-to-null:   ${tally.F5}`);
  console.log(`  Cards modified:            ${cardsModified}`);
  console.log('\n  Verify afterwards with: node scripts/audit-card-data-quality.mjs --ci');
}

// Only run when executed directly (the linter rules above are importable).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
