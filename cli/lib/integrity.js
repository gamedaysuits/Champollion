/**
 * Integrity linter — catches translation defects that silently break UI.
 *
 * THREE CLASSES OF DEFECT:
 *
 * 1. FORMAT LEAKS: ICU placeholders ({name}, {count, plural, ...}) that
 *    the translator mangled or dropped. Detected by comparing placeholder
 *    tokens between source and target.
 *
 * 2. ENCODING ISSUES: BOM markers, non-UTF-8 sequences, invisible
 *    directional marks (LRM/RLM/ZWJ/ZWNJ) where they shouldn't be.
 *
 * 3. STRUCTURAL PARITY: Target file has extra keys the source doesn't,
 *    or values that are clearly just the source value copy-pasted (same
 *    string in a different locale file = untranslated).
 *
 * Zero external dependencies. All string-based analysis.
 */

import fs from 'node:fs';
import path from 'node:path';
import { isICUString, parseICU, getRequiredPluralCategories } from './icu.js';
import { checkContentPreservation } from './validate.js';

// -----------------------------------------------------------------
// Placeholder extraction
// -----------------------------------------------------------------

/**
 * Extract ICU-style placeholders from a string.
 *
 * Handles:
 *   - Simple: {name}, {count}
 *   - Nested ICU: {count, plural, one {# item} other {# items}}
 *   - React-intl: <bold>text</bold>
 *
 * @param {string} text - Translation string
 * @returns {string[]} Sorted array of placeholder tokens
 */
function extractPlaceholders(text) {
  if (typeof text !== 'string') return [];

  const placeholders = new Set();

  // Simple ICU placeholders: {name}, {count}
  // Match top-level braces only (not nested plurals)
  const simplePattern = /\{(\w+)(?:[,}])/g;
  let match;
  while ((match = simplePattern.exec(text)) !== null) {
    placeholders.add(match[1]);
  }

  // React-intl XML tags: <bold>, </bold>, <link>, </link>
  const xmlPattern = /<\/?(\w+)>/g;
  while ((match = xmlPattern.exec(text)) !== null) {
    placeholders.add(`<${match[1]}>`);
  }

  return [...placeholders].sort();
}

/**
 * Compare placeholders between source and target strings.
 *
 * @param {string} sourceValue - Source locale value
 * @param {string} targetValue - Target locale value
 * @returns {{ missing: string[], extra: string[] }} Placeholder differences
 */
function comparePlaceholders(sourceValue, targetValue) {
  const sourcePH = extractPlaceholders(sourceValue);
  const targetPH = extractPlaceholders(targetValue);

  const missing = sourcePH.filter(p => !targetPH.includes(p));
  const extra = targetPH.filter(p => !sourcePH.includes(p));

  return { missing, extra };
}

// -----------------------------------------------------------------
// Encoding checks
// -----------------------------------------------------------------

/**
 * Invisible Unicode characters that cause silent UI bugs.
 *
 * Each entry has:
 *   - name: Human-readable name
 *   - regex: Detection pattern
 *   - severity: 'error' (likely bug) or 'warning' (suspicious but maybe intentional)
 */
const INVISIBLE_CHARS = [
  { name: 'BOM (Byte Order Mark)', regex: /\uFEFF/, severity: 'error' },
  { name: 'Zero-Width Space (ZWSP)', regex: /\u200B/, severity: 'warning' },
  { name: 'Zero-Width Non-Joiner (ZWNJ)', regex: /\u200C/, severity: 'warning' },
  { name: 'Zero-Width Joiner (ZWJ)', regex: /\u200D/, severity: 'warning' },
  { name: 'Left-to-Right Mark (LRM)', regex: /\u200E/, severity: 'warning' },
  { name: 'Right-to-Left Mark (RLM)', regex: /\u200F/, severity: 'warning' },
  { name: 'Left-to-Right Override', regex: /\u202D/, severity: 'error' },
  { name: 'Right-to-Left Override', regex: /\u202E/, severity: 'error' },
  { name: 'Pop Directional Formatting', regex: /\u202C/, severity: 'warning' },
  { name: 'Object Replacement Character', regex: /\uFFFC/, severity: 'error' },
  { name: 'Replacement Character (encoding error)', regex: /\uFFFD/, severity: 'error' },
];

/**
 * Characters to escape when PRINTING a value in a report.
 *
 * Broader than INVISIBLE_CHARS above, which decides what counts as a
 * DEFECT; this set only decides what is unreadable on a terminal. A report
 * that prints a raw ZWSP shows two identical-looking lines and reads as a
 * broken tool.
 */
const INVISIBLE_FOR_DISPLAY = new RegExp(
  // Invisible format characters, plus the BMP Private Use Area — PUA renders
  // as blank or tofu in a terminal, so a report that prints it raw is
  // unreadable in exactly the cases (pIqaD/Tengwar/Kryptonian damage) where
  // reading it matters most.
  '[\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u206A-\\u206F\\uE000-\\uF8FF\\uFFFC\\uFFFD]',
  'g',
);

/**
 * Check a string value for invisible/problematic Unicode characters.
 *
 * @param {string} value - String to check
 * @returns {{ name: string, severity: string }[]} Array of detected issues
 */
function checkEncoding(value) {
  if (typeof value !== 'string') return [];

  const issues = [];
  for (const check of INVISIBLE_CHARS) {
    if (check.regex.test(value)) {
      issues.push({ name: check.name, severity: check.severity });
    }
  }
  return issues;
}

/**
 * Check if a file has a UTF-8 BOM at the start.
 *
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if BOM is present
 */
function hasBOM(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.length >= 3 &&
    buffer[0] === 0xEF &&
    buffer[1] === 0xBB &&
    buffer[2] === 0xBF;
}

// -----------------------------------------------------------------
// Cross-locale parity
// -----------------------------------------------------------------

/**
 * Check for untranslated values (target value === source value).
 *
 * Returns keys where the target is an exact copy of the source,
 * excluding keys that look like they SHOULD be the same (brand names,
 * URLs, format strings, numbers).
 *
 * @param {object} sourceFlat - Flattened source locale
 * @param {object} targetFlat - Flattened target locale
 * @param {string} targetLang - Target language code (for RTL direction checks)
 * @param {import('./no-translate.js').NoTranslateMatcher} [noTranslate] -
 *   Compiled no-translate matcher. Keys it claims are SUPPOSED to be
 *   identical — flagging them as untranslated would turn a correct sync into
 *   a failing `champollion integrity` and back the user into the same corner
 *   the quality gate did.
 * @param {((key: string, sourceValue: string) => boolean)|null} [isConfirmedEcho] -
 *   The SAME predicate the sync diff uses (lib/diff.js): true when the
 *   Translation Memory records that the pipeline itself produced this exact
 *   source-equal value and the gate approved it. Without it, integrity
 *   flagged thousands of settled echoes on a project sync reports as fully
 *   synced — two tools reading the same file and disagreeing about it. What
 *   remains flagged here is exactly what sync would requeue.
 * @returns {string[]} Keys with identical source/target values
 */
function findUntranslatedCopies(sourceFlat, targetFlat, targetLang, noTranslate = null, isConfirmedEcho = null) {
  const copies = [];

  for (const [key, sourceVal] of Object.entries(sourceFlat)) {
    const targetVal = targetFlat[key];
    if (targetVal === undefined) continue;
    if (typeof sourceVal !== 'string' || typeof targetVal !== 'string') continue;

    // Skip if values are different — it's translated
    if (sourceVal !== targetVal) continue;

    // Skip values that are EXPECTED to be the same across locales
    if (isLocaleInvariant(sourceVal)) continue;

    // Skip keys the project declared no-translate — identical is correct.
    if (noTranslate && noTranslate.matches(key, sourceVal)) continue;

    // Skip echoes the TM confirms as pipeline-produced and gate-approved.
    if (isConfirmedEcho && isConfirmedEcho(key, sourceVal)) continue;

    copies.push(key);
  }

  return copies;
}

/**
 * Find no-translate keys whose target has DRIFTED from the source.
 *
 * The inverse of findUntranslatedCopies, and the check that would have caught
 * the production incident this feature exists for: 48 URL values across 13
 * locales that a model bent just enough to clear the source-echo gate —
 * fabricated fragments, stray trailing characters, an invisible U+200E in
 * Arabic and U+200B in Hindi that broke the links outright.
 *
 * For a declared no-translate key there is exactly one correct target value,
 * so any difference is a defect. `champollion sync` repairs it by copying the
 * source verbatim.
 *
 * @param {object} sourceFlat - Flattened source locale
 * @param {object} targetFlat - Flattened target locale
 * @param {import('./no-translate.js').NoTranslateMatcher} [noTranslate] - Compiled matcher
 * @returns {Array<{ key: string, expected: string, actual: string, reason: string }>}
 */
function findNoTranslateDrift(sourceFlat, targetFlat, noTranslate = null) {
  if (!noTranslate || !noTranslate.active) return [];

  const drift = [];
  for (const [key, sourceVal] of Object.entries(sourceFlat)) {
    if (typeof sourceVal !== 'string') continue;
    const targetVal = targetFlat[key];
    // A key absent from the target is a missing-key finding, reported by the
    // callers' own parity checks — not drift.
    if (targetVal === undefined) continue;
    if (targetVal === sourceVal) continue;
    if (!noTranslate.matches(key, sourceVal)) continue;

    drift.push({
      key,
      expected: sourceVal,
      actual: typeof targetVal === 'string' ? targetVal : String(targetVal),
      reason: noTranslate.reason(key, sourceVal),
    });
  }
  return drift;
}

/**
 * Check if a value is expected to be the same across all locales.
 *
 * Brand names, URLs, format patterns, single-word identifiers,
 * numeric values, etc.
 *
 * @param {string} value - The value to check
 * @returns {boolean} True if the value should NOT be flagged as untranslated
 */
function isLocaleInvariant(value) {
  const v = value.trim();
  if (v.length === 0) return true;

  // URLs
  if (/^https?:\/\//.test(v)) return true;
  // Email addresses
  if (/^\S+@\S+\.\S+$/.test(v)) return true;
  // Pure numbers (with optional formatting)
  if (/^[\d.,\-+%$€£¥]+$/.test(v)) return true;
  // Single word under 4 characters (likely a code or abbreviation)
  if (/^\w{1,3}$/.test(v)) return true;
  // Pure placeholder string: {name}
  if (/^\{[\w,.\s]+\}$/.test(v)) return true;
  // Format patterns: YYYY-MM-DD, HH:mm:ss
  if (/^[YMDHhmsSzZ\-/:.\s]+$/.test(v)) return true;
  // Known brand names that shouldn't be translated
  // (Keeping this minimal — better to flag false positives than miss real copies)
  if (/^(GitHub|Google|Facebook|Twitter|LinkedIn|YouTube|Instagram|WhatsApp|Stripe|PayPal|Apple|Microsoft)$/.test(v)) return true;

  return false;
}

/**
 * Find values ON DISK that are their source hollowed of its letters.
 *
 * The translation-time gate (validate.js check 5) stops NEW hollowing, but
 * values written by an older pipeline never re-enter the gate: their manifest
 * hashes match the current source, so sync considers them settled forever.
 * Upgraders discovered this the hard way — `"   ·   · êhiêi"`-class damage
 * survived the fix that would have refused to write it.
 *
 * Same two-signal rule as the gate (see checkContentPreservation for why a
 * bare density threshold is unshippable — legitimate CJK sits at the same
 * retention as the bug): low letter retention AND the value is the source
 * with characters deleted. Values identical to their source are the echo
 * checks' business; no-translate keys are the drift check's.
 *
 * The fix is re-translation, which no offline tool can do — so the finding
 * names the sync invocation that does.
 *
 * @param {object} sourceFlat - Flattened source locale
 * @param {object} targetFlat - Flattened target locale
 * @param {import('./no-translate.js').NoTranslateMatcher} [noTranslate] - Compiled matcher
 * @returns {Array<{ key: string, actual: string, reason: string }>}
 */
function findHollowedValues(sourceFlat, targetFlat, noTranslate = null) {
  const findings = [];
  for (const [key, sourceVal] of Object.entries(sourceFlat)) {
    const targetVal = targetFlat[key];
    if (typeof sourceVal !== 'string' || typeof targetVal !== 'string') continue;
    if (sourceVal === targetVal) continue;
    if (noTranslate && noTranslate.matches(key, sourceVal)) continue;
    const hollowed = checkContentPreservation(sourceVal, targetVal);
    if (hollowed) {
      findings.push({ key, actual: targetVal, reason: hollowed.reason });
    }
  }
  return findings;
}

/**
 * Find Private Use Area codepoints where script conversion is switched OFF.
 *
 * PUA renders as nothing without a purpose-built font, and Champollion only
 * ever writes it deliberately — through an opted-in script converter (pIqaD,
 * Tengwar, Kryptonian). When the locale's script resolution says conversion
 * is off, any PUA in the file is damage: either output from the pre-0.3.0
 * unconditional converter, or corruption from elsewhere. Both mean blank
 * strings on the page. `champollion repair-script` restores the romanization.
 *
 * Only runs when the caller passes a resolution for a PUA-capable converter
 * locale — for every other locale PUA is out of scope here (checkEncoding
 * covers the general invisible-character classes).
 *
 * @param {object} targetFlat - Flattened target locale
 * @param {{converts: boolean, locale: string}|null} scriptExpectation -
 *   Caller-computed: does this locale's resolution apply a PUA converter?
 * @returns {Array<{ key: string, actual: string, reason: string }>}
 */
function findUnexpectedPua(targetFlat, scriptExpectation = null) {
  if (!scriptExpectation || scriptExpectation.converts) return [];

  const PUA = /[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u;
  const findings = [];
  for (const [key, value] of Object.entries(targetFlat)) {
    if (typeof value !== 'string' || !PUA.test(value)) continue;
    findings.push({
      key,
      actual: value,
      reason:
        `Private Use Area codepoints, but script conversion is not enabled for ${scriptExpectation.locale} `
        + '— this text renders blank without a PUA font. Run `champollion repair-script` to restore the romanization.',
    });
  }
  return findings;
}

/**
 * Find keys present in target but NOT in source (orphaned keys).
 *
 * @param {object} sourceFlat - Flattened source locale
 * @param {object} targetFlat - Flattened target locale
 * @returns {string[]} Keys only in target
 */
function findOrphanedKeys(sourceFlat, targetFlat) {
  return Object.keys(targetFlat).filter(k => !(k in sourceFlat));
}

// -----------------------------------------------------------------
// ICU plural category validation
// -----------------------------------------------------------------

/**
 * Check whether ICU plural strings have the correct categories for the target locale.
 *
 * WHY: Arabic requires {zero, one, two, few, many, other} but if the LLM only
 * produces {one, other}, the runtime silently falls back to 'other' for all
 * other quantities — producing wrong text for 0, 2, 3-10, 11-99, etc.
 *
 * This function:
 *   1. Scans source values for ICU plural patterns
 *   2. Parses the corresponding target values
 *   3. Compares their plural categories against what CLDR requires
 *   4. Reports missing categories as warnings
 *
 * Only triggers on keys where the SOURCE value is an ICU plural string.
 * If the source doesn't use ICU plurals, we don't check (the target shouldn't
 * be expected to add plural forms the source doesn't have).
 *
 * @param {object} sourceFlat - Flattened source locale
 * @param {object} targetFlat - Flattened target locale
 * @param {string} targetLang - Target locale code
 * @returns {Array<{ key: string, missing: string[], extra: string[] }>}
 */
function checkPluralCategories(sourceFlat, targetFlat, targetLang) {
  const issues = [];
  const requiredCategories = getRequiredPluralCategories(targetLang);

  for (const [key, sourceVal] of Object.entries(sourceFlat)) {
    if (typeof sourceVal !== 'string') continue;

    // Only check if the source value contains an ICU plural pattern
    if (!isICUString(sourceVal)) continue;

    const sourceAST = parseICU(sourceVal);
    const hasPluralNode = sourceAST.some(n => n.type === 'plural');
    if (!hasPluralNode) continue;

    // Now check the target's plural categories
    const targetVal = targetFlat[key];
    if (typeof targetVal !== 'string' || !isICUString(targetVal)) continue;

    const targetAST = parseICU(targetVal);
    const targetPluralNode = targetAST.find(n => n.type === 'plural');
    if (!targetPluralNode || !targetPluralNode.options) continue;

    const targetCategories = Object.keys(targetPluralNode.options);

    // Find missing required categories (ignoring exact-match like =0, =1)
    const missing = requiredCategories.filter(cat =>
      !targetCategories.includes(cat) &&
      !cat.startsWith('=')
    );

    // Find unexpected categories (not in CLDR for this locale)
    // Exclude exact-match categories (=0, =1) which are always valid
    const extra = targetCategories.filter(cat =>
      !requiredCategories.includes(cat) &&
      !cat.startsWith('=')
    );

    if (missing.length > 0 || extra.length > 0) {
      issues.push({ key, missing, extra });
    }
  }

  return issues;
}

// -----------------------------------------------------------------
// Full integrity audit
// -----------------------------------------------------------------

/**
 * Run a full integrity audit on a locale pair.
 *
 * @param {object} sourceFlat - Flattened source locale
 * @param {object} targetFlat - Flattened target locale
 * @param {string} targetLang - Target language code
 * @param {object} [options]
 * @param {string} [options.sourceFile] - Path to the source file (for BOM reporting)
 * @param {string} [options.targetFile] - Path to the target file (for BOM reporting)
 * @param {import('./no-translate.js').NoTranslateMatcher} [options.noTranslate] -
 *   Compiled no-translate matcher. Its keys are exempted from the
 *   untranslated-copies check and checked for drift instead.
 * @returns {{ placeholderIssues: object[], encodingIssues: object[], copies: string[], orphans: string[], noTranslateDrift: object[], bomFiles: string[] }}
 */
function auditLocalePair(sourceFlat, targetFlat, targetLang, options = {}) {
  const placeholderIssues = [];
  const encodingIssues = [];

  for (const [key, sourceVal] of Object.entries(sourceFlat)) {
    const targetVal = targetFlat[key];
    if (targetVal === undefined) continue;

    // Check placeholder preservation
    if (typeof sourceVal === 'string' && typeof targetVal === 'string') {
      const { missing, extra } = comparePlaceholders(sourceVal, targetVal);
      if (missing.length > 0 || extra.length > 0) {
        placeholderIssues.push({ key, missing, extra, sourceVal, targetVal });
      }
    }

    // Check encoding in target values
    if (typeof targetVal === 'string') {
      const issues = checkEncoding(targetVal);
      if (issues.length > 0) {
        encodingIssues.push({ key, value: targetVal, issues });
      }
    }
  }

  const noTranslate = options.noTranslate || null;
  const copies = findUntranslatedCopies(
    sourceFlat, targetFlat, targetLang, noTranslate, options.isConfirmedEcho || null,
  );
  const noTranslateDrift = findNoTranslateDrift(sourceFlat, targetFlat, noTranslate);
  const unexpectedPua = findUnexpectedPua(targetFlat, options.scriptExpectation || null);
  const hollowedValues = findHollowedValues(sourceFlat, targetFlat, noTranslate);
  const orphans = findOrphanedKeys(sourceFlat, targetFlat);
  const pluralIssues = checkPluralCategories(sourceFlat, targetFlat, targetLang);

  // File-level BOM check. When the caller passes file paths, REPORT a UTF-8
  // BOM as an issue rather than letting it silently corrupt the first key /
  // crash a downstream JSON.parse. Guarded so a vanished file can't throw.
  const bomFiles = [];
  for (const file of [options.sourceFile, options.targetFile]) {
    try {
      if (file && fs.existsSync(file) && hasBOM(file)) bomFiles.push(file);
    } catch { /* unreadable file — not an integrity finding */ }
  }

  return { placeholderIssues, encodingIssues, copies, orphans, noTranslateDrift, unexpectedPua, hollowedValues, pluralIssues, bomFiles };
}

/**
 * Render a value for a terminal report with invisible characters made visible.
 *
 * Printing a raw ZWSP or LRM produces two lines that look byte-identical and
 * a reader who concludes the tool is broken. The whole class of corruption
 * this reports is invisible by nature, so it has to be escaped to be read.
 *
 * @param {string} value - Value to display
 * @returns {string} JSON-quoted value with invisible characters as \uXXXX
 */
function visualize(value) {
  const escaped = String(value).replace(
    INVISIBLE_FOR_DISPLAY,
    ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  return JSON.stringify(escaped);
}

/**
 * Format an integrity audit result as a console report.
 *
 * @param {string} targetLang - Target language code
 * @param {object} audit - Result from auditLocalePair
 * @returns {string} Formatted report
 */
function formatIntegrityReport(targetLang, audit) {
  const lines = [];
  const { placeholderIssues, encodingIssues, copies, orphans } = audit;

  const bomFiles = audit.bomFiles || [];
  const drift = audit.noTranslateDrift || [];
  const unexpectedPua = audit.unexpectedPua || [];
  const hollowedValues = audit.hollowedValues || [];
  const totalIssues = placeholderIssues.length + encodingIssues.length +
    copies.length + orphans.length + (audit.pluralIssues?.length || 0) +
    bomFiles.length + drift.length + unexpectedPua.length + hollowedValues.length;

  lines.push(`\n  Integrity Audit: ${targetLang}`);
  lines.push(`  ${'─'.repeat(40)}`);

  if (totalIssues === 0) {
    lines.push('  [OK] All checks passed — no issues found');
    lines.push('');
    return lines.join('\n');
  }

  // Placeholder issues
  if (placeholderIssues.length > 0) {
    lines.push(`\n  PLACEHOLDER ISSUES (${placeholderIssues.length})`);
    for (const issue of placeholderIssues.slice(0, 10)) {
      lines.push(`  ├── ${issue.key}`);
      if (issue.missing.length > 0) {
        lines.push(`  │   Missing: ${issue.missing.join(', ')}`);
      }
      if (issue.extra.length > 0) {
        lines.push(`  │   Extra: ${issue.extra.join(', ')}`);
      }
    }
    if (placeholderIssues.length > 10) {
      lines.push(`  └── ... and ${placeholderIssues.length - 10} more`);
    }
  }

  // Encoding issues
  if (encodingIssues.length > 0) {
    lines.push(`\n  [WARN] ENCODING ISSUES (${encodingIssues.length})`);
    for (const issue of encodingIssues.slice(0, 10)) {
      const names = issue.issues.map(i => i.name).join(', ');
      lines.push(`  ├── ${issue.key}: ${names}`);
    }
    if (encodingIssues.length > 10) {
      lines.push(`  └── ... and ${encodingIssues.length - 10} more`);
    }
  }

  // Untranslated copies
  if (copies.length > 0) {
    lines.push(`\n  [WARN] UNTRANSLATED COPIES (${copies.length})`);
    lines.push('  └── These keys have identical source/target values:');
    for (const key of copies.slice(0, 10)) {
      lines.push(`      ${key}`);
    }
    if (copies.length > 10) {
      lines.push(`      ... and ${copies.length - 10} more`);
    }
  }

  // No-translate drift — a declared-verbatim key that isn't verbatim
  if (drift.length > 0) {
    lines.push(`\n  NO-TRANSLATE DRIFT (${drift.length})`);
    lines.push('  └── These keys must match the source byte-for-byte. Run `champollion sync` to repair:');
    for (const d of drift.slice(0, 10)) {
      lines.push(`      ${d.key}  [${d.reason}]`);
      lines.push(`        expected: ${visualize(d.expected)}`);
      lines.push(`        actual:   ${visualize(d.actual)}`);
    }
    if (drift.length > 10) {
      lines.push(`      ... and ${drift.length - 10} more`);
    }
  }

  // Unexpected PUA — unrenderable script conversion where none was asked for
  if (unexpectedPua.length > 0) {
    lines.push(`\n  UNEXPECTED PUA (${unexpectedPua.length})`);
    lines.push('  └── Private Use Area codepoints with script conversion OFF — renders blank');
    lines.push('      without a PUA font. Run `champollion repair-script` to restore romanization:');
    for (const p of unexpectedPua.slice(0, 10)) {
      lines.push(`      ${p.key}: ${visualize(p.actual)}`);
    }
    if (unexpectedPua.length > 10) {
      lines.push(`      ... and ${unexpectedPua.length - 10} more`);
    }
  }

  // Hollowed values — old damage the translation-time gate never saw
  if (hollowedValues.length > 0) {
    lines.push(`\n  HOLLOWED VALUES (${hollowedValues.length})`)
    lines.push('  └── The source with its letters deleted — damage from an older pipeline.');
    lines.push('      Re-translate: `champollion sync --force-keys <key>` (or `--pair <pair> --force`):');
    for (const h of hollowedValues.slice(0, 10)) {
      lines.push(`      ${h.key}: ${visualize(h.actual)}`);
    }
    if (hollowedValues.length > 10) {
      lines.push(`      ... and ${hollowedValues.length - 10} more`);
    }
  }

  // Orphaned keys
  if (orphans.length > 0) {
    lines.push(`\n  [WARN] ORPHANED KEYS (${orphans.length})`);
    lines.push('  └── Keys in target not present in source:');
    for (const key of orphans.slice(0, 10)) {
      lines.push(`      ${key}`);
    }
    if (orphans.length > 10) {
      lines.push(`      ... and ${orphans.length - 10} more`);
    }
  }

  // BOM (file encoding) issues
  if (bomFiles.length > 0) {
    lines.push(`\n  [WARN] BYTE ORDER MARK (${bomFiles.length})`);
    lines.push('  └── These files start with a UTF-8 BOM (strip it):');
    for (const file of bomFiles) {
      lines.push(`      ${file}`);
    }
  }

  // Plural category issues
  if (audit.pluralIssues && audit.pluralIssues.length > 0) {
    lines.push(`\n  [WARN] PLURAL CATEGORY ISSUES (${audit.pluralIssues.length})`);
    for (const issue of audit.pluralIssues.slice(0, 10)) {
      lines.push(`  ├── ${issue.key}`);
      if (issue.missing.length > 0) {
        lines.push(`  │   Missing categories: ${issue.missing.join(', ')}`);
      }
      if (issue.extra.length > 0) {
        lines.push(`  │   Unexpected categories: ${issue.extra.join(', ')}`);
      }
    }
    if (audit.pluralIssues.length > 10) {
      lines.push(`  └── ... and ${audit.pluralIssues.length - 10} more`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export {
  extractPlaceholders,
  comparePlaceholders,
  checkEncoding,
  hasBOM,
  findUntranslatedCopies,
  findNoTranslateDrift,
  findUnexpectedPua,
  findHollowedValues,
  isLocaleInvariant,
  findOrphanedKeys,
  checkPluralCategories,
  auditLocalePair,
  formatIntegrityReport,
  visualize,
  INVISIBLE_CHARS,
};
