/**
 * String classification — shared heuristics for detecting non-translatable strings.
 *
 * WHY THIS EXISTS: Both lint.js (shouldFlagString) and autofix.js (shouldFixText)
 * need to distinguish user-facing text from code artifacts (identifiers, URLs,
 * numbers, etc.). They previously maintained independent regex sets that were
 * ~70% identical, creating a drift risk. This module provides the shared core
 * that both call, plus lint-specific extensions.
 *
 * DESIGN: Conservative by default. When in doubt, return false (= "this looks
 * like code, don't flag/fix it"). False negatives (missing a hardcoded string)
 * are cheaper than false positives (wrapping a CSS class name in t()).
 */

/**
 * Check if a string is clearly non-translatable (code artifact, not user-facing text).
 *
 * Returns true if the string should be EXCLUDED from translation detection.
 * This is the shared core used by both lint and autofix.
 *
 * @param {string} text - The string to classify
 * @param {number} minLength - Minimum length to consider (strings shorter than this are excluded)
 * @returns {boolean} true if the string is non-translatable (should be skipped)
 */
function isNonTranslatableString(text, minLength = 2) {
  const t = text.trim();
  if (t.length < minLength) return true;
  if (!t) return true;

  // Pure punctuation/symbols
  if (/^[\s\p{P}\p{S}]+$/u.test(t)) return true;
  // Pure numbers (with currency symbols)
  if (/^[\d.,\-+%$€£¥]+$/.test(t)) return true;
  // camelCase identifier (starts with lowercase letter, $, or _)
  if (/^[a-z_$][a-zA-Z0-9_$]*$/.test(t)) return true;
  // SCREAMING_SNAKE_CASE constant
  if (/^[A-Z][A-Z0-9_]+$/.test(t)) return true;
  // Dot-notation path (e.g., "hero.title", "pages.about.description")
  if (/^[\w]+(?:\.[\w]+)+$/.test(t)) return true;
  // URLs
  if (/^https?:\/\//.test(t)) return true;
  // Template expressions (e.g., {{ .Title }})
  if (/^\{\{.*\}\}$/.test(t)) return true;
  // Hex colors (e.g., #ff0000, #333)
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return true;

  return false;
}

/**
 * Additional lint-specific checks for non-translatable strings.
 *
 * These extend the shared core with patterns that are relevant for
 * source code scanning (lint/flag) but not for autofix wrapping.
 * Lint scans broader file types and sees more code artifacts.
 *
 * @param {string} text - The string to classify
 * @returns {boolean} true if the string is non-translatable (should be skipped)
 */
function isNonTranslatableLintExtended(text) {
  const t = text.trim();

  // File paths (e.g., ./components/Header, /images/logo.png)
  if (/^\.?\/[\w\-./]/.test(t)) return true;
  // Email addresses
  if (/^\S+@\S+\.\S+$/.test(t)) return true;
  // HTML entities (e.g., &amp;, &nbsp;)
  if (/^&\w+;$/.test(t)) return true;
  // Single HTML tag names (e.g., div, span, img — short lowercase words)
  if (/^[a-z][a-z0-9]*$/i.test(t) && t.length <= 5) return true;

  // --- TypeScript type signatures ---
  // Fragments like "Promise", "string[]", "React.FC", "void", "null"
  if (/^(?:Promise|string|number|boolean|void|null|undefined|any|never|unknown|object|bigint|symbol)(?:\[\]|<.*>)?$/.test(t)) return true;
  // Patterns like "}: Promise<void>" or "): string" (type annotation fragments)
  if (/^[)}\]]+\s*[:,]?\s*\w/.test(t)) return true;
  // Generic type syntax: "Record<string, any>", "Array<number>"
  if (/^[A-Z]\w*<[^>]+>$/.test(t)) return true;
  // Type union/intersection fragments: "string | null", "Foo & Bar"
  if (/^\w+(?:\s*[|&]\s*\w+)+$/.test(t)) return true;

  return false;
}

export { isNonTranslatableString, isNonTranslatableLintExtended };
