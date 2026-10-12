/**
 * The project's coaching file (.champollion/coaching/<locale>.json) and its
 * glossary — read in ONE place for every method that uses them.
 *
 * THE FILE:
 *   {
 *     "grammar_rules": ["French adjectives agree in gender and number…"],
 *     "dictionary":    { "dashboard": "tableau de bord" },
 *     "style_notes":   "Prefer active voice."
 *   }
 *
 * WHO READS WHAT:
 *   - "dictionary" is the project's GLOSSARY. Every LLM method is told the
 *     glossary terms a batch contains (lib/methods/llm.js buildUserMessage),
 *     DeepL sends it as a glossary, and sync checks every method's output
 *     against it.
 *   - "grammar_rules" and "style_notes" are COACHING, read by the
 *     llm-coached method only (on any provider). The plain LLM methods
 *     (llm, openai, anthropic, gemini, local) build the same prompt as each
 *     other, so a pair gets the same instructions whichever of them runs it.
 *
 * WHY A MODULE OF ITS OWN: lib/methods/llm.js needs the glossary helpers and
 * lib/methods/llm-coached.js imports llm.js — keeping these here avoids an
 * import cycle. llm-coached.js re-exports them (the public names are unchanged).
 */

import fs from 'node:fs';
import path from 'node:path';
import { output } from '../output.js';

/**
 * Default coaching data directory, relative to project root.
 */
const DEFAULT_COACHING_DIR = '.champollion/coaching';

/**
 * Load coaching data for a locale from a JSON file, with caching.
 *
 * @param {string} coachingDir - Path to coaching data directory
 * @param {string} locale - Target locale code (e.g., 'fr', 'crk')
 * @param {Map} cache - Cache map to store loaded data (avoids re-reading files)
 * @returns {object|null} Coaching data { grammar_rules, dictionary, style_notes }, or null
 */
function loadCoachingData(coachingDir, locale, cache) {
  if (!locale) return null;

  const cacheKey = `${coachingDir}:${locale}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const filePath = path.join(coachingDir, `${locale}.json`);

  if (!fs.existsSync(filePath)) {
    cache.set(cacheKey, null);
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    // Validate required structure — normalize missing fields to safe defaults
    const coaching = {
      grammar_rules: Array.isArray(data.grammar_rules) ? data.grammar_rules : [],
      dictionary: (data.dictionary && typeof data.dictionary === 'object') ? data.dictionary : {},
      style_notes: typeof data.style_notes === 'string' ? data.style_notes : '',
    };

    cache.set(cacheKey, coaching);
    return coaching;
  } catch (err) {
    output.warn(`Failed to load coaching data: ${filePath}`);
    output.warn(err.message);
    cache.set(cacheKey, null);
    return null;
  }
}

/**
 * The project glossary for a pair: the term → translation map the pair is
 * told about and checked against. sync loads it once for every pair
 * (pairConfig.glossary, null when there is none); a caller that did not (a
 * library user, `serve`) gets it from the coaching file in `cwd`.
 *
 * @param {object} pairConfig
 * @param {{ cwd?: string }} [options]
 * @param {Map} [cache] - loadCoachingData cache
 * @returns {Object<string, string>|null}
 */
function projectGlossary(pairConfig, options = {}, cache = new Map()) {
  // Set by sync (null = the project has none for this locale).
  if (pairConfig && Object.prototype.hasOwnProperty.call(pairConfig, 'glossary')) {
    const g = pairConfig.glossary;
    return g && typeof g === 'object' && Object.keys(g).length > 0 ? g : null;
  }
  const target = pairConfig && (pairConfig.target || pairConfig.locale);
  if (!target) return null;
  const data = loadCoachingData(path.join(options.cwd || process.cwd(), DEFAULT_COACHING_DIR), target, cache);
  return data && Object.keys(data.dictionary).length > 0 ? data.dictionary : null;
}

/**
 * Scan source values for dictionary term matches.
 *
 * Case-insensitive substring matching of each term against the batch's
 * source values (the dictionary is usually small).
 *
 * @param {object} toTranslate - Key-value map to scan
 * @param {object} dictionary - Term → translation map
 * @returns {Array<{ term: string, translation: string }>} Matched hints
 */
function findDictionaryMatches(toTranslate, dictionary) {
  if (!dictionary || Object.keys(dictionary).length === 0) return [];

  const matches = [];
  const seen = new Set();
  const values = Object.values(toTranslate).join(' ').toLowerCase();

  for (const [term, translation] of Object.entries(dictionary)) {
    if (seen.has(term)) continue;
    if (values.includes(term.toLowerCase())) {
      matches.push({ term, translation });
      seen.add(term);
    }
  }

  return matches;
}

/**
 * The REQUIRED TERMINOLOGY block for a batch: the glossary terms its source
 * values contain ('' when none).
 *
 * @param {object} toTranslate - Key-value map of the batch
 * @param {Object<string, string>|null} glossary
 * @returns {string}
 */
function terminologyBlock(toTranslate, glossary) {
  const hints = findDictionaryMatches(toTranslate, glossary);
  if (hints.length === 0) return '';
  return 'REQUIRED TERMINOLOGY (use these exact translations):\n'
    + hints.map(h => `  • "${h.term}" → "${h.translation}"`).join('\n')
    + '\n\n';
}

export {
  DEFAULT_COACHING_DIR,
  loadCoachingData,
  projectGlossary,
  findDictionaryMatches,
  terminologyBlock,
};
