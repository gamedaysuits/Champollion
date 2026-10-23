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

/** An i18next plural key: `<base>[_ordinal]_<category>` (lib/plurals.js). */
const PLURAL_KEY_RE = /^(.+?)(_ordinal)?_(zero|one|two|few|many|other)$/;
/** CLDR's order of the plural categories. */
const PLURAL_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * Put `key` into `obj`. An existing key keeps its place. A NEW plural form
 * (`count_many`) goes beside its siblings (`count_one`, `count_other`, same
 * base, cardinal or ordinal alike) in CLDR order — before the first sibling
 * whose category comes after it, else after the last sibling — and nothing
 * else in the object moves. Any other new key goes at the end, as before.
 *
 * WHY: `verify`'s repair for a missing `count_many` appended it after
 * `count_other`, so French and Spanish files ordered their plural keys
 * differently (Round 10, i18next persona). A fresh file is written in the
 * expansion's CLDR order; a restored form now lands where it would have been.
 *
 * Works on a nested object's level (the leaf name) and on a flat map
 * (`cart.count_many` — the base includes the dotted path).
 *
 * @param {object} obj
 * @param {string} key
 * @param {*} value
 */
function assignInOrder(obj, key, value) {
  if (Object.prototype.hasOwnProperty.call(obj, key)) { obj[key] = value; return; }
  const m = PLURAL_KEY_RE.exec(key);
  if (!m) { obj[key] = value; return; }
  const rank = PLURAL_ORDER.indexOf(m[3]);
  const keys = Object.keys(obj);
  let at = -1; // insert before keys[at]
  let lastSibling = -1;
  for (let i = 0; i < keys.length; i++) {
    const s = PLURAL_KEY_RE.exec(keys[i]);
    if (!s || s[1] !== m[1] || !!s[2] !== !!m[2]) continue;
    if (PLURAL_ORDER.indexOf(s[3]) > rank) { at = i; break; }
    lastSibling = i;
  }
  if (at < 0 && lastSibling < 0) { obj[key] = value; return; }
  const insertAt = at >= 0 ? at : lastSibling + 1;
  if (insertAt >= keys.length) { obj[key] = value; return; }
  const entries = Object.entries(obj);
  entries.splice(insertAt, 0, [key, value]);
  for (const k of keys) delete obj[k];
  for (const [k, v] of entries) obj[k] = v;
}

/**
 * Set a value in a nested object using a dot-notation path.
 * Creates intermediate objects as needed. A new plural form is placed among
 * its siblings in CLDR order (assignInOrder); other new keys go at the end.
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
  assignInOrder(current, parts[parts.length - 1], value);
}

/**
 * Delete a dot-notation path from a nested object. Parents are left in
 * place (they usually hold sibling keys); a parent left EMPTY by the delete
 * is removed too, so no `{}` husk is written back to the locale file.
 *
 * @param {object} obj - Target nested object
 * @param {string} dotPath - Dot-notation path like "cart.item_one"
 * @returns {boolean} True when a value was removed
 */
function deleteNestedValue(obj, dotPath) {
  const parts = dotPath.split('.');
  const chain = [obj];
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = current[parts[i]];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) return false;
    chain.push(next);
    current = next;
  }
  const leaf = parts[parts.length - 1];
  if (!Object.prototype.hasOwnProperty.call(current, leaf)) return false;
  delete current[leaf];
  for (let i = chain.length - 1; i > 0; i--) {
    if (Object.keys(chain[i]).length > 0) break;
    delete chain[i - 1][parts[i - 1]];
  }
  return true;
}

export { flattenKeys, setNestedValue, deleteNestedValue, assignInOrder };
