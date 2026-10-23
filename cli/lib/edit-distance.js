/**
 * edit-distance.js — one bounded Levenshtein distance for every "did you
 * mean" list: keys named for a redo that match nothing (lib/named-keys.js)
 * and a model name the price list does not have
 * (lib/methods/openrouter-pricing.js). No imports, so any module can use it
 * without an import cycle.
 */

/**
 * Levenshtein distance, stopping early above `max`.
 *
 * @param {string} a
 * @param {string} b
 * @param {number} max - Distances above this are not computed exactly
 * @returns {number} The distance, or max + 1 when it is above max
 */
export function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
