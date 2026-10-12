/**
 * name-rules.js — the ONE wording every translation prompt uses for names.
 *
 * The old rule ("proper nouns, product names, and technical terms … role
 * descriptions … should stay in English") let models keep short descriptive
 * labels in English: on the 2026-08-28 dogfood run "Translation CLI" and
 * "Evaluation harness" came back verbatim in Arabic and Thai and failed
 * verification. Names stay; descriptions get translated; a project can
 * declare its real names (config.protectedTerms) so the model never has to
 * guess.
 */

/**
 * Prompt rule lines about names, each starting with "- ".
 *
 * @param {string[]} [protectedTerms] - config.protectedTerms
 * @returns {string} Newline-joined rule lines (no trailing newline)
 */
export function nameRules(protectedTerms = []) {
  const terms = (protectedTerms || []).filter(t => typeof t === 'string' && t.trim());
  const lines = [
    '- Proper names (people, companies, products, places) stay exactly as written.',
  ];
  if (terms.length > 0) {
    lines.push(`- Keep these exactly as written wherever they appear: ${terms.map(t => JSON.stringify(t)).join(', ')}.`);
  }
  lines.push(
    '- Descriptive labels and phrases are NOT names, even when short or capitalized (e.g. "Translation CLI", "Evaluation harness", "Getting Started") — translate them.',
    '- Widely used technical acronyms (API, URL, JSON, CLI) may stay as written inside a translated phrase.',
  );
  return lines.join('\n');
}
