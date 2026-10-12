#!/usr/bin/env node

/**
 * audit-card-data-quality.mjs
 * ────────────────────────────────────────────────────────────────
 * READ-ONLY data-quality sweep over all language cards.
 * Never writes to cards or the DB — safe to run any time,
 * including while a decontamination cycle holds the DB.
 *
 * Corruption classes scanned (per string value in human-text fields):
 *   url-in-text         URL-shaped value where a name/prose belongs
 *                       (incl. wikidata blank-node "genid" URIs — the BSA case)
 *   wikidata-entity     bare Q-ids (Q12345) or wikidata entity URLs as display values
 *   encoding-garbage    U+FFFD replacement chars, classic UTF-8→Latin-1 mojibake
 *                       sequences (Ã©, â€™, â€œ …), HTML entities in plain text
 *   stringified-object  "[object Object]", JSON-looking {...}/[...] strings
 *   empty-vs-null       "" (empty string) in display-critical fields that are
 *                       null everywhere else — schema inconsistency
 *   placeholder         value === its own field name, or "TBD"/"unknown"/"null"/
 *                       "undefined"/"N/A"/"TODO…" as a string
 *
 * Output: counts by field × pattern, worst-50 concrete examples with codes.
 *
 * Usage:
 *   node scripts/audit-card-data-quality.mjs            # human report
 *   node scripts/audit-card-data-quality.mjs --json     # machine-readable
 *   node scripts/audit-card-data-quality.mjs --ci       # exit 1 if any finding
 *                                                       # (CI gate)
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');

const JSON_OUT = process.argv.includes('--json');
const CI_MODE = process.argv.includes('--ci');

// ── Field classification ─────────────────────────────────────────
// Human-text fields: a URL or placeholder here is always corruption.
// Paths use dot notation; [] means "each element of the array".
const HUMAN_TEXT_PATHS = [
  'name',
  'nativeName',
  'endonym',                      // future-proof: not in spec yet
  'alternateNames[]',
  'aliases[]',
  'culturalAphorism',
  'culturalAphorism.text',
  'culturalAphorism.translation',
  'arealContext',
  'notes',
  'encyclopedic.wikidataDescription',
  'encyclopedic.intro',
  'encyclopedic.summary',
  'encyclopedic.phonology',
  'encyclopedic.typology',
  'encyclopedic.family',
  'encyclopedic.demographics',
  'encyclopedic.classification',
  'encyclopedic.dialects',
  'encyclopedic.history',
  'encyclopedic.resources',
  'vitality.notes',
  'linguisticChallenges[]',
];

// Display-critical fields where "" vs null inconsistency matters.
const DISPLAY_CRITICAL = ['name', 'nativeName', 'endonym', 'script', 'macroarea'];

// Fields where URLs are legitimate — never flagged.
const URL_OK = /(url|link|href|source_url|citation)$/i;

// ── Pattern detectors ────────────────────────────────────────────
const RE_URL = /^(https?|ftp):\/\/\S+/i;
const RE_URL_EMBEDDED = /(https?):\/\/[^\s"']+/i;
const RE_WIKIDATA_QID = /^Q\d{1,10}$/;
const RE_WIKIDATA_ENTITY_URL = /wikidata\.org\/(entity|wiki|\.well-known)/i;
const RE_GENID = /\.well-known\/genid\//i;
const RE_REPLACEMENT = /�/;
// Classic UTF-8-read-as-Latin-1 mojibake bigrams/trigrams
const RE_MOJIBAKE = /(Ã[-¿©¨«ª¯®­¬±°³²µ´·¶¹¸»º½¼¿¾]|â€[™œ“”˜¦]|Ã‚|Ã¢â|å�|ï¿½|Â[°£¥§©«®])/;
const RE_HTML_ENTITY = /&(#\d{2,6}|#x[0-9a-fA-F]{2,5}|amp|lt|gt|quot|apos|nbsp|eacute|egrave|agrave|ccedil|ntilde|uuml|ouml|auml|szlig);/;
const RE_JSONISH = /^\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*$/;
// NOTE: 'na' and 'none' are deliberately absent — "Na" (nbt) and "None"
// (alt name of Noon, snf) are genuine language names. Only unambiguous
// placeholder tokens belong here.
const PLACEHOLDERS = new Set([
  'tbd', 'todo', 'unknown', 'null', 'undefined', 'n/a',
  'tba', 'fixme', 'xxx', 'placeholder', '???', '-', '--',
]);
const RE_TODO_PREFIX = /^TODO[:\s]/;

/** Classify a single string value found at a human-text path. */
function classify(value, fieldName) {
  const findings = [];
  const v = value;

  if (RE_URL.test(v) || RE_GENID.test(v)) {
    findings.push('url-in-text');
  } else if (RE_URL_EMBEDDED.test(v) && v.length < 200) {
    // embedded URL inside short display text (long prose may cite URLs legitimately)
    findings.push('url-in-text');
  }

  if (RE_WIKIDATA_QID.test(v.trim()) || RE_WIKIDATA_ENTITY_URL.test(v)) {
    findings.push('wikidata-entity');
  }

  if (RE_REPLACEMENT.test(v)) findings.push('encoding-garbage:replacement-char');
  else if (RE_MOJIBAKE.test(v)) findings.push('encoding-garbage:mojibake');
  else if (RE_HTML_ENTITY.test(v)) findings.push('encoding-garbage:html-entity');

  if (v === '[object Object]' || /\[object Object\]/.test(v)) {
    findings.push('stringified-object');
  } else if (RE_JSONISH.test(v) && /":|':/.test(v)) {
    findings.push('stringified-object');
  }

  const lower = v.trim().toLowerCase();
  if (PLACEHOLDERS.has(lower) || RE_TODO_PREFIX.test(v.trim())) {
    findings.push('placeholder');
  }
  if (lower === fieldName.toLowerCase()) {
    findings.push('placeholder:field-name-echo');
  }

  return findings;
}

/** Resolve a dot/[] path against a card; yields [resolvedPath, value] pairs. */
function* resolvePath(obj, pathSpec) {
  const parts = pathSpec.split('.');
  function* walk(node, idx, trail) {
    if (node == null) return;
    if (idx === parts.length) {
      yield [trail, node];
      return;
    }
    let part = parts[idx];
    const isArray = part.endsWith('[]');
    if (isArray) part = part.slice(0, -2);
    const next = node[part];
    if (next === undefined) return;
    if (isArray) {
      if (Array.isArray(next)) {
        for (let i = 0; i < next.length; i++) {
          yield* walk(next[i], idx + 1, `${trail ? trail + '.' : ''}${part}[${i}]`);
        }
      }
    } else {
      yield* walk(next, idx + 1, `${trail ? trail + '.' : ''}${part}`);
    }
  }
  yield* walk(obj, 0, '');
}

// ── Main sweep ───────────────────────────────────────────────────
function main() {
  const files = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json')
    .sort();

  // counts[field][pattern] = n
  const counts = {};
  const examples = []; // { code, field, pattern, value, fieldSource }
  const emptyStringHits = [];
  let parsed = 0, parseErrors = 0;

  for (const file of files) {
    let card;
    try {
      card = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, file), 'utf-8'));
      parsed++;
    } catch {
      parseErrors++;
      continue;
    }
    const code = card.code || file.replace(/\.json$/, '');

    for (const spec of HUMAN_TEXT_PATHS) {
      for (const [resolved, value] of resolvePath(card, spec)) {
        if (typeof value !== 'string') {
          // Non-string in a text field: object/array leaked into a string slot
          if (value !== null && typeof value === 'object'
              && (spec === 'name' || spec === 'nativeName' || spec === 'notes')) {
            record(counts, examples, code, resolved, 'stringified-object',
              JSON.stringify(value).slice(0, 120), fieldSourceFor(card, spec));
          }
          continue;
        }
        if (URL_OK.test(resolved)) continue;
        const fieldName = resolved.split('.').pop().replace(/\[\d+\]$/, '');
        for (const pattern of classify(value, fieldName)) {
          record(counts, examples, code, resolved, pattern, value, fieldSourceFor(card, spec));
        }
      }
    }

    // (e) empty-string-vs-null in display-critical fields
    for (const f of DISPLAY_CRITICAL) {
      if (Object.prototype.hasOwnProperty.call(card, f) && card[f] === '') {
        emptyStringHits.push({ code, field: f });
        record(counts, examples, code, f, 'empty-string', '""', fieldSourceFor(card, f));
      }
    }
  }

  // ── Report ─────────────────────────────────────────────────────
  const totalFindings = examples.length;
  const byPattern = {};
  for (const ex of examples) byPattern[ex.pattern] = (byPattern[ex.pattern] || 0) + 1;

  // Worst-50: prioritize hard corruption over placeholders
  const SEVERITY = {
    'url-in-text': 0, 'wikidata-entity': 1, 'stringified-object': 2,
    'encoding-garbage:replacement-char': 3, 'encoding-garbage:mojibake': 4,
    'encoding-garbage:html-entity': 5, 'empty-string': 6,
    'placeholder:field-name-echo': 7, 'placeholder': 8,
  };
  const worst = [...examples]
    .sort((a, b) => (SEVERITY[a.pattern] ?? 9) - (SEVERITY[b.pattern] ?? 9))
    .slice(0, 50);

  if (JSON_OUT) {
    console.log(JSON.stringify({
      scanned: parsed, parseErrors, totalFindings, byPattern,
      byFieldPattern: counts, worst50: worst,
    }, null, 2));
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Card Data Quality Audit (read-only)');
    console.log(`  Cards scanned: ${parsed}   parse errors: ${parseErrors}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total findings: ${totalFindings}\n`);
    console.log('── By pattern ──');
    for (const [p, n] of Object.entries(byPattern).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(6)}  ${p}`);
    }
    console.log('\n── By field × pattern ──');
    for (const [field, pats] of Object.entries(counts).sort()) {
      for (const [p, n] of Object.entries(pats)) {
        console.log(`  ${String(n).padStart(6)}  ${field}  ×  ${p}`);
      }
    }
    console.log('\n── Worst 50 examples ──');
    for (const ex of worst) {
      console.log(`  [${ex.code}] ${ex.field} (${ex.pattern})${ex.fieldSource ? ' src=' + ex.fieldSource : ''}`);
      console.log(`      ${String(ex.value).slice(0, 140)}`);
    }
  }

  if (CI_MODE && totalFindings > 0) process.exit(1);
}

function record(counts, examples, code, field, pattern, value, fieldSource) {
  // normalize array indices for the field × pattern matrix
  const fieldKey = field.replace(/\[\d+\]/g, '[]');
  counts[fieldKey] = counts[fieldKey] || {};
  counts[fieldKey][pattern] = (counts[fieldKey][pattern] || 0) + 1;
  examples.push({ code, field, pattern, value, fieldSource });
}

function fieldSourceFor(card, spec) {
  const top = spec.split('.')[0].replace(/\[\]$/, '');
  const fs_ = card._fieldSources;
  if (!fs_) return null;
  const v = fs_[top];
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.join(',');
  if (v && typeof v === 'object') return JSON.stringify(v);
  return null;
}

main();
