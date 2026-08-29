/**
 * Post-translation terminology enforcement — warns when dictionary terms
 * were prompted but not used in the LLM output.
 *
 * WHY THIS EXISTS:
 *   The coached method (llm-coached.js) injects a dictionary into the LLM
 *   prompt: "REQUIRED TERMINOLOGY: dashboard → tableau de bord". But the LLM
 *   is free to ignore it. Without verification, a user who carefully built
 *   a dictionary has no way to know if their terms were actually applied.
 *
 * HOW IT WORKS:
 *   After translation, this module scans each translated value to check
 *   whether expected dictionary terms appear. If a source value contains
 *   a dictionary source term (e.g., "dashboard") AND the translated value
 *   does NOT contain the required translation (e.g., "tableau de bord"),
 *   a violation is recorded.
 *
 *   Matching is case-insensitive substring search — the LLM might inflect
 *   the term ("tableaux de bord" for plural), so exact match would be too
 *   strict. Violations are warnings, not blocking errors.
 *
 * USAGE:
 *   import { verifyTerminology } from './terminology.js';
 *
 *   const { violations } = verifyTerminology(translations, sourceFlat, dictionary);
 *   if (violations.length > 0) {
 *     console.warn(`[TERM] ${violations.length} term(s) may not have been applied`);
 *   }
 */

/**
 * Check whether required dictionary terms were used in translations.
 *
 * For each translated value:
 *   1. Find which dictionary source terms appear in the corresponding source value
 *   2. For each matching term, check if the required translation appears in the output
 *   3. Record violations where the term was expected but not found
 *
 * @param {object} translations - key → translated value (LLM output)
 * @param {object} sourceFlat - key → source value (English)
 * @param {object} dictionary - source term → required translation
 *   e.g., { "dashboard": "tableau de bord", "sign in": "se connecter" }
 * @returns {{ violations: Array<{ key: string, term: string, expected: string, got: string }> }}
 */
function verifyTerminology(translations, sourceFlat, dictionary) {
  const violations = [];

  // Fast path: nothing to check
  if (!dictionary || typeof dictionary !== 'object' || Object.keys(dictionary).length === 0) {
    return { violations };
  }

  // Pre-lowercase dictionary entries for case-insensitive matching
  const terms = Object.entries(dictionary).map(([src, tgt]) => ({
    source: src,
    sourceLower: src.toLowerCase(),
    expected: tgt,
    expectedLower: tgt.toLowerCase(),
  }));

  for (const [key, translated] of Object.entries(translations)) {
    // Skip non-string values (defense-in-depth)
    if (typeof translated !== 'string') continue;

    const source = sourceFlat[key];
    if (typeof source !== 'string') continue;

    const sourceLower = source.toLowerCase();
    const translatedLower = translated.toLowerCase();

    for (const term of terms) {
      // Step 1: Does the source value contain this dictionary source term?
      if (!sourceLower.includes(term.sourceLower)) continue;

      // Step 2: Does the translated value contain the required translation?
      if (translatedLower.includes(term.expectedLower)) continue;

      // Violation: term was expected but not found
      violations.push({
        key,
        term: term.source,
        expected: term.expected,
        got: translated.length > 100 ? translated.slice(0, 100) + '…' : translated,
      });
    }
  }

  return { violations };
}

/**
 * Log terminology violations in a structured, actionable format.
 *
 * Designed to sit alongside the existing [GATE] log output from validate.js.
 * Violations are warnings — they don't block the translation from being written.
 *
 * @param {Array<{ key: string, term: string, expected: string, got: string }>} violations
 * @param {string} pairKey - e.g., "en:fr"
 */
function logTermViolations(violations, pairKey) {
  if (violations.length === 0) return;

  console.error(`\n     [TERM] ${pairKey}: ${violations.length} dictionary term(s) may not have been applied:`);
  for (const { key, term, expected, got } of violations) {
    console.error(`            ⚠ "${key}": expected "${expected}" for term "${term}"`);
    console.error(`              → got "${got}"`);
  }
  console.error('');
}

export { verifyTerminology, logTermViolations };
