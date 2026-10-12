/**
 * ICU MessageFormat parser — zero-dependency.
 *
 * WHY THIS EXISTS:
 *   ICU MessageFormat strings like:
 *     "{count, plural, one {# document} other {# documents}}"
 *     "{gender, select, male {He} female {She} other {They}} liked this"
 *   contain structured syntax that LLMs routinely mangle. They:
 *     1. Translate the keywords (plural → pluriel, select → sélectionner)
 *     2. Reorder/drop plural categories
 *     3. Break nesting by mismatching braces
 *     4. Invent categories that don't exist in the target language
 *
 *   This parser extracts only the translatable leaf text, shields the
 *   ICU syntax, sends just the text to the LLM, then reassembles the
 *   result with the original syntax intact.
 *
 * WHAT THIS HANDLES:
 *   - Simple arguments: "Hello, {name}!"
 *   - Plural:  "{count, plural, one {# item} other {# items}}"
 *   - Select:  "{gender, select, male {He} female {She} other {They}}"
 *   - Nested:  "{count, plural, one {He has # cat} other {He has # cats}}"
 *   - Deeply nested select-in-plural and plural-in-select
 *   - Escaped braces ('' in ICU = literal quote)
 *
 * WHAT THIS DOES NOT HANDLE:
 *   - selectordinal (treated as plural — same structure)
 *   - Skeleton date/number formats ({0, date, ::yMMMd}) — passed through
 *   - The full ICU spec edge cases (we handle 99% of what i18n frameworks use)
 *
 * ARCHITECTURE:
 *   1. isICUString(str) — fast heuristic check
 *   2. parseICU(str) — recursive descent parser → AST
 *   3. extractTranslatableSegments(ast) — leaf text with path addresses
 *   4. reassembleICU(ast, translatedSegments) — rebuild from translations
 *   5. getRequiredPluralCategories(locale) — from language card data
 *
 * ZERO DEPENDENCIES. Pure string processing.
 */

import { getLanguageCard } from './registers.js';

// -----------------------------------------------------------------
// Quick detection — does a string contain ICU MessageFormat syntax?
// -----------------------------------------------------------------

/**
 * Fast heuristic to detect whether a string contains ICU MessageFormat syntax.
 *
 * Checks for patterns like:
 *   {name}           — simple argument
 *   {count, plural,  — plural/select/selectordinal
 *   {gender, select, — select
 *
 * Does NOT parse the string — just checks if it's worth parsing.
 * False positives are acceptable (parser will handle them gracefully).
 * False negatives are unacceptable (we'd mangle unparsed ICU strings).
 *
 * @param {string} str - String to check
 * @returns {boolean} True if the string likely contains ICU MessageFormat
 */
function isICUString(str) {
  if (typeof str !== 'string') return false;

  // Must contain at least one brace pair
  if (!str.includes('{') || !str.includes('}')) return false;

  // Check for structured ICU patterns: {arg, type, ...}
  // This catches plural, select, selectordinal
  if (/\{\s*\w+\s*,\s*(?:plural|select|selectordinal)\s*,/i.test(str)) {
    return true;
  }

  // Check for simple arguments: {name}, {count}, {0}
  // These are ICU if they have alphanumeric content between braces
  if (/\{\s*\w+\s*\}/.test(str)) {
    return true;
  }

  return false;
}

// -----------------------------------------------------------------
// AST node types
// -----------------------------------------------------------------

/**
 * @typedef {'text'|'argument'|'plural'|'select'} ICUNodeType
 */

/**
 * @typedef {object} ICUNode
 * @property {ICUNodeType} type - Node type
 * @property {string} [value] - Text content (for 'text' nodes)
 * @property {string} [name] - Argument name (for 'argument', 'plural', 'select')
 * @property {string} [style] - Argument style/format (for 'argument' with format)
 * @property {Object<string, ICUNode[]>} [options] - Category → child nodes (for 'plural', 'select')
 * @property {number} [offset] - Offset value for plural (rare, but supported)
 */

// -----------------------------------------------------------------
// Parser — recursive descent
// -----------------------------------------------------------------

/**
 * Parse an ICU MessageFormat string into an AST.
 *
 * The parser handles nested structures by recursively descending
 * when it encounters a { character inside a plural/select option.
 *
 * BRACE BALANCING: The key challenge is matching braces correctly
 * when options themselves contain { } for nested ICU or even for
 * the # (number) placeholder in plural forms. We track brace depth
 * and only close a category when we return to the original depth.
 *
 * @param {string} str - ICU MessageFormat string
 * @returns {ICUNode[]} AST (array of nodes at the top level)
 */
function parseICU(str) {
  if (typeof str !== 'string') return [{ type: 'text', value: '' }];

  const result = [];
  let pos = 0;

  /**
   * Parse a sequence of nodes until we hit the end of the string
   * or a closing brace at our nesting level.
   */
  function parseNodes(stopAtBrace = false) {
    const nodes = [];
    let textStart = pos;

    while (pos < str.length) {
      const ch = str[pos];

      if (ch === '}' && stopAtBrace) {
        // Flush any accumulated text
        if (pos > textStart) {
          nodes.push({ type: 'text', value: str.slice(textStart, pos) });
        }
        return nodes;
      }

      if (ch === '{') {
        // Flush text before this brace
        if (pos > textStart) {
          nodes.push({ type: 'text', value: str.slice(textStart, pos) });
        }

        pos++; // skip {
        const node = parseArgument();
        nodes.push(node);
        textStart = pos;
        continue;
      }

      // ICU escape: two single quotes = literal quote
      if (ch === "'" && pos + 1 < str.length && str[pos + 1] === "'") {
        pos += 2;
        continue;
      }

      pos++;
    }

    // Flush remaining text
    if (pos > textStart) {
      nodes.push({ type: 'text', value: str.slice(textStart, pos) });
    }

    return nodes;
  }

  /**
   * Parse the content inside { } — could be a simple argument,
   * plural, select, or selectordinal.
   */
  function parseArgument() {
    skipWhitespace();

    // Read the argument name (e.g., "count", "gender", "name")
    const name = readIdentifier();
    skipWhitespace();

    // Simple argument: {name} — no comma, just close
    if (pos >= str.length || str[pos] === '}') {
      pos++; // skip }
      return { type: 'argument', name };
    }

    // Should be a comma for typed arguments
    if (str[pos] !== ',') {
      // Malformed — treat as simple argument, skip to closing brace
      skipToClosingBrace();
      return { type: 'argument', name };
    }
    pos++; // skip comma
    skipWhitespace();

    // Read the type keyword (plural, select, selectordinal, number, date, etc.)
    const typeKeyword = readIdentifier().toLowerCase();
    skipWhitespace();

    // For plural/select/selectordinal, parse the options
    if (typeKeyword === 'plural' || typeKeyword === 'select' || typeKeyword === 'selectordinal') {
      if (str[pos] === ',') {
        pos++; // skip comma
        skipWhitespace();
      }

      const options = parseOptions();

      // Skip closing }
      if (pos < str.length && str[pos] === '}') {
        pos++;
      }

      return {
        type: typeKeyword === 'select' ? 'select' : 'plural',
        name,
        options,
      };
    }

    // For other types (number, date, time) — skip to closing brace
    // These are formatting-only, no translatable content inside
    const startPos = pos;
    skipToClosingBrace();
    const style = str.slice(startPos, pos - 1).trim() || undefined;
    return { type: 'argument', name, style };
  }

  /**
   * Parse plural/select options: "=0 {no items} one {# item} other {# items}"
   */
  function parseOptions() {
    const options = {};

    while (pos < str.length && str[pos] !== '}') {
      skipWhitespace();
      if (pos >= str.length || str[pos] === '}') break;

      // Handle "offset:N" for plural
      if (str.slice(pos, pos + 7) === 'offset:') {
        pos += 7;
        // Read the number
        while (pos < str.length && /\d/.test(str[pos])) pos++;
        skipWhitespace();
        continue;
      }

      // Read category name: "one", "other", "=0", "male", "female", etc.
      const category = readCategory();
      skipWhitespace();

      // Expect { to start the option body
      if (pos < str.length && str[pos] === '{') {
        pos++; // skip {

        // Recursively parse the content inside this option
        const children = parseNodes(true);

        // pos should now be at }, skip it
        if (pos < str.length && str[pos] === '}') {
          pos++;
        }

        options[category] = children;
      } else {
        // Malformed — skip to next category or end
        break;
      }

      skipWhitespace();
    }

    return options;
  }

  /**
   * Read an identifier (alphanumeric + underscore).
   */
  function readIdentifier() {
    const start = pos;
    while (pos < str.length && /[\w]/.test(str[pos])) {
      pos++;
    }
    return str.slice(start, pos);
  }

  /**
   * Read a category name (can include = prefix for exact match, e.g., "=0").
   */
  function readCategory() {
    const start = pos;
    // Categories can be: one, other, =0, =1, male, female, etc.
    if (str[pos] === '=') pos++;
    while (pos < str.length && /[\w-]/.test(str[pos])) {
      pos++;
    }
    return str.slice(start, pos);
  }

  /**
   * Skip whitespace (spaces, tabs, newlines).
   */
  function skipWhitespace() {
    while (pos < str.length && /\s/.test(str[pos])) {
      pos++;
    }
  }

  /**
   * Skip to the matching closing brace, handling nesting.
   */
  function skipToClosingBrace() {
    let depth = 1;
    while (pos < str.length && depth > 0) {
      if (str[pos] === '{') depth++;
      else if (str[pos] === '}') depth--;
      pos++;
    }
  }

  return parseNodes(false);
}

// -----------------------------------------------------------------
// Segment extraction — pull out translatable leaf text
// -----------------------------------------------------------------

/**
 * Extract translatable text segments from an ICU AST.
 *
 * Returns an array of segments, each with:
 *   - text: the translatable string
 *   - path: a dot-separated path like "plural.one.0" or "select.male.1"
 *     used to put translations back in the right place
 *
 * WHAT'S TRANSLATABLE:
 *   - Text nodes inside plural/select options → yes
 *   - Top-level text nodes (before/after/between arguments) → yes
 *   - Argument names ({name}, {count}) → no (these are code references)
 *   - ICU keywords (plural, select, one, other) → no
 *   - The # symbol in plural options → no (it's a number placeholder)
 *
 * @param {ICUNode[]} ast - Parsed AST
 * @param {string} [pathPrefix=''] - Path prefix for nested calls
 * @returns {Array<{text: string, path: string}>}
 */
function extractTranslatableSegments(ast, pathPrefix = '') {
  const segments = [];

  for (let i = 0; i < ast.length; i++) {
    const node = ast[i];
    const nodePath = pathPrefix ? `${pathPrefix}.${i}` : `${i}`;

    if (node.type === 'text') {
      // Only include non-trivial text (not just whitespace or #)
      const stripped = node.value.replace(/#/g, '').trim();
      if (stripped.length > 0) {
        segments.push({ text: node.value, path: nodePath });
      }
    } else if (node.type === 'plural' || node.type === 'select') {
      // Recurse into each option
      if (node.options) {
        for (const [category, children] of Object.entries(node.options)) {
          const catPath = `${nodePath}.${node.type}.${category}`;
          const childSegments = extractTranslatableSegments(children, catPath);
          segments.push(...childSegments);
        }
      }
    }
    // 'argument' nodes are not translatable — they're variable references
  }

  return segments;
}

// -----------------------------------------------------------------
// Reassembly — put translated text back into ICU structure
// -----------------------------------------------------------------

/**
 * Reassemble an ICU string from an AST with translated segments.
 *
 * @param {ICUNode[]} ast - Original parsed AST
 * @param {Map<string, string>} translatedMap - path → translated text
 * @param {string} [pathPrefix=''] - Path prefix for nested calls
 * @returns {string} Reassembled ICU MessageFormat string
 */
function reassembleICU(ast, translatedMap, pathPrefix = '') {
  let result = '';

  for (let i = 0; i < ast.length; i++) {
    const node = ast[i];
    const nodePath = pathPrefix ? `${pathPrefix}.${i}` : `${i}`;

    if (node.type === 'text') {
      // Use translated version if available, otherwise keep original
      const translated = translatedMap.get(nodePath);
      result += translated !== undefined ? translated : node.value;
    } else if (node.type === 'argument') {
      // Reconstruct: {name} or {name, style}
      result += `{${node.name}`;
      if (node.style) {
        result += `, ${node.style}`;
      }
      result += '}';
    } else if (node.type === 'plural' || node.type === 'select') {
      const typeKeyword = node.type === 'select' ? 'select' : 'plural';
      result += `{${node.name}, ${typeKeyword},`;

      if (node.options) {
        for (const [category, children] of Object.entries(node.options)) {
          const catPath = `${nodePath}.${node.type}.${category}`;
          const reassembled = reassembleICU(children, translatedMap, catPath);
          result += ` ${category} {${reassembled}}`;
        }
      }

      result += '}';
    }
  }

  return result;
}

// -----------------------------------------------------------------
// Plural category resolution — from language card data
// -----------------------------------------------------------------

/**
 * Get the required CLDR plural categories for a locale.
 *
 * Reads from the language card's `rules.plurals.categories` field,
 * which was populated during the v5 refactor from CLDR data.
 *
 * Falls back to ['other'] if no card exists or the card has no plural
 * rules defined (e.g., conlangs). This is correct because every language
 * has at least the 'other' category.
 *
 * @param {string} locale - Locale code (e.g., 'fr', 'ar', 'ja')
 * @returns {string[]} Required plural categories (e.g., ['one', 'other'] for French)
 */
function getRequiredPluralCategories(locale) {
  const card = getLanguageCard(locale);
  // `pluralCategories` — CLDR's own cardinal categories, projected onto the
  // card as a sourced fact. Previously this lived at rules.plurals.categories
  // inside a config-shaped block, which is why it looked like something we had
  // authored. It never was: the ten distinct sets are CLDR's, verbatim.
  const categories = card?.pluralCategories;

  // Cards with defined categories → use them
  if (Array.isArray(categories) && categories.length > 0) {
    return categories;
  }

  // No card or no plural rules → every language has at least 'other'
  return ['other'];
}

// -----------------------------------------------------------------
// Exports
// -----------------------------------------------------------------

export {
  isICUString,
  parseICU,
  extractTranslatableSegments,
  reassembleICU,
  getRequiredPluralCategories,
};
