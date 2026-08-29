/**
 * JSON flattening and unflattening utilities.
 *
 * WHY: Locale files use nested JSON structures like:
 *   { "pages": { "about": { "title": "About" } } }
 *
 * But for diffing, translating, and comparing across files we need
 * flat dot-notation paths:
 *   { "pages.about.title": "About" }
 *
 * These utilities convert between the two formats losslessly.
 */

/**
 * Flatten a nested object into dot-notation keys.
 * Only leaf values (strings, numbers, booleans, null, arrays) are included.
 *
 * @param {object} obj - Nested object to flatten
 * @param {string} prefix - Current key path (used in recursion)
 * @returns {object} Flat key→value map
 */
function flattenKeys(obj, prefix = '') {
  const keys = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(keys, flattenKeys(value, fullKey));
    } else {
      keys[fullKey] = value;
    }
  }
  return keys;
}

/**
 * Set a value in a nested object using a dot-notation path.
 * Creates intermediate objects as needed.
 *
 * @param {object} obj - Target nested object
 * @param {string} dotPath - Dot-notation path like "pages.about.title"
 * @param {*} value - Value to set
 */
function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

export { flattenKeys, setNestedValue };
