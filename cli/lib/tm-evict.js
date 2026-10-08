/**
 * Translation Memory eviction for DAMAGED values, and the TM text of a key.
 *
 * THE FINDING (next-intl synthetic user, 2026-10): an ICU plural came back
 * with mangled keywords, passed the gate of its day, was written AND stored
 * in the TM. `verify` caught it — and `sync --force-keys Home.items` then
 * re-served the same broken text from the TM for $0. Only --no-tm fixed it.
 *
 * WHICH ENTRY. Since model carry-over (lib/tm.js), a lookup that misses the
 * current model falls back to the same text under ANOTHER model. Evicting
 * the current method key alone therefore leaves the entry that actually
 * served; the next lookup finds it again. So eviction removes every entry
 * for (source text, locale) — under any method key — whose cached text IS
 * the damaged value.
 *
 * NEVER A HAND-WRITTEN VALUE. Equality with a cached translation is the
 * proof that the pipeline produced the value on disk (the same proof the
 * i18next plural cleanup uses). A value someone wrote by hand has no TM
 * entry equal to it, so nothing is evicted for it — and the file itself is
 * never touched here.
 */

import { cacheKey, evictTM, storeTM } from './tm.js';

/** gettext's msgctxt/msgid separator (lib/po.js). */
const CONTEXT_SEPARATOR = '\u0004';

/** Separates a borrowed plural form from the text it is cached with (never in UI text). */
const PLURAL_FORM_MARK = '\u0005';

/**
 * The text a key's translation is cached under. Normally the source text;
 * for a gettext entry with a context (key `msgctxt\u0004msgid`) the context
 * is folded in — "Open" the verb and "Open" the adjective must not share a
 * cache entry, or the second is served the first's translation.
 *
 * A BORROWED plural form (an i18next key translated from another
 * category's source text — French `count_many` from English `count_other`,
 * lib/plurals.js `borrowed`) folds its form in the same way: the two keys
 * send the same source text, but the model is asked for different forms
 * ("2 recettes" / "1 000 000 de recettes"). Sharing one entry, the second
 * answer replaced the first, and a redo wrote one form into both keys
 * (Round 6, i18next persona). The form it borrows FROM keeps the plain
 * entry, so caches written before this stay valid for it. gettext
 * (msgid_plural) and ARB/ICU plurals are ONE message per key — nothing is
 * borrowed there.
 *
 * @param {string} key
 * @param {string} sourceValue
 * @param {string|null} [pluralForm] - The borrowed form ("many"), or null
 * @returns {string}
 */
function tmSourceText(key, sourceValue, pluralForm = null) {
  if (typeof key !== 'string' || typeof sourceValue !== 'string') return sourceValue;
  const i = key.indexOf(CONTEXT_SEPARATOR);
  const base = i < 0 ? sourceValue : `${key.slice(0, i)}${CONTEXT_SEPARATOR}${sourceValue}`;
  return pluralForm ? `${PLURAL_FORM_MARK}${pluralForm}${PLURAL_FORM_MARK}${base}` : base;
}

/**
 * tmSourceText for a TARGET key of an expanded file (lib/plurals.js
 * expandPluralsForLocale): a borrowed plural form gets its own identity.
 *
 * @param {string} key - Target key
 * @param {string} sourceValue - The source text it is translated from
 * @param {object|null} expansion - expectedForTarget(...).expansion
 * @returns {string}
 */
function tmTextFor(key, sourceValue, expansion) {
  return tmSourceText(key, sourceValue, expansion?.borrowed?.[key] || null);
}

/**
 * The texts whose cache entries PROVE the pipeline produced a value for this
 * key: tmTextFor, and — for a borrowed plural form — the plain text too,
 * which is where every version before this one cached it (shared with the
 * form it borrows from). For proofs only ("is this value Champollion's?"),
 * never for serving: the plain entry is the other form's translation.
 *
 * @returns {string[]}
 */
function tmProofTextsFor(key, sourceValue, expansion) {
  const own = tmTextFor(key, sourceValue, expansion);
  const plain = tmSourceText(key, sourceValue);
  return own === plain ? [own] : [own, plain];
}

/**
 * An evictor over one TM object. The per-locale method-key index is built
 * once (a TM can hold 70k entries; a verify run may evict many values).
 *
 * @param {object} tm - TM object (mutated)
 * @returns {{ evictProducing: (sourceText: string, locale: string, value: string,
 *   extraMethodKeys?: string[]) => number }}
 */
function createTMEvictor(tm) {
  let index = null;
  const methodKeysFor = (locale) => {
    if (!index) {
      index = new Map();
      for (const [k, entry] of Object.entries(tm)) {
        if (k === '_meta' || !entry || typeof entry.l !== 'string' || typeof entry.m !== 'string') continue;
        if (!index.has(entry.l)) index.set(entry.l, new Set());
        index.get(entry.l).add(entry.m);
      }
    }
    return index.get(locale) || new Set();
  };

  return {
    /**
     * Evict every entry for (sourceText, locale) whose cached text is `value`.
     *
     * @returns {number} Entries removed
     */
    evictProducing(sourceText, locale, value, extraMethodKeys = []) {
      if (!tm || typeof sourceText !== 'string' || typeof value !== 'string') return 0;
      let removed = 0;
      for (const m of new Set([...methodKeysFor(locale), ...extraMethodKeys])) {
        const entry = tm[cacheKey(sourceText, locale, m)];
        if (entry && entry.t === value && evictTM(tm, sourceText, locale, m)) removed++;
      }
      return removed;
    },
  };
}

/**
 * Repair a cache written before borrowed plural forms had their own entry.
 *
 * Then, French `count_many` and `count_other` (both translated from the
 * English `count_other` text) shared ONE entry, holding whichever answer was
 * stored last — the `_many` text when the model returned the keys in that
 * order. Served to `count_other` by a redo, it wrote "2 de recettes". The
 * files tell which it holds: when the entry's text is what the borrowed key
 * holds on disk, and the other key holds something else, the entry is the
 * borrowed form's translation. It moves to the borrowed form's own entry
 * (that answer was paid for), and the shared entry is removed, so the form
 * it borrows from is translated again the next time it is queued instead of
 * being served the wrong form. An entry that matches the other key's value
 * (or neither) is left as it is: it stays valid for that key, and the
 * borrowed form has no entry until it is translated once more.
 *
 * @param {object} tm - TM object (mutated)
 * @param {{ expansion: object|null, targetFlat: object, locale: string }} p
 * @returns {string[]} Borrowed keys whose translation was moved
 */
function splitSharedPluralEntries(tm, { expansion, targetFlat, locale }) {
  const moved = new Set();
  if (!tm || !expansion?.borrowed || !targetFlat) return [];
  let methodKeys = null;
  for (const [b, form] of Object.entries(expansion.borrowed)) {
    const s = expansion.origin?.[b];
    // The target must have the form it borrows from, un-borrowed.
    if (!s || expansion.origin[s] !== s || expansion.borrowed[s]) continue;
    const src = expansion.flat?.[b];
    const vb = targetFlat[b];
    const vs = targetFlat[s];
    if (typeof src !== 'string' || typeof vb !== 'string' || typeof vs !== 'string' || vb === vs) continue;
    if (!methodKeys) {
      methodKeys = new Set();
      for (const [k, entry] of Object.entries(tm)) {
        if (k !== '_meta' && entry && entry.l === locale && typeof entry.m === 'string') methodKeys.add(entry.m);
      }
    }
    const plain = tmSourceText(b, src);
    const own = tmSourceText(b, src, form);
    for (const mk of methodKeys) {
      const entry = tm[cacheKey(plain, locale, mk)];
      if (!entry || entry.t !== vb) continue;
      if (!tm[cacheKey(own, locale, mk)]) storeTM(tm, own, locale, mk, entry.t);
      evictTM(tm, plain, locale, mk);
      moved.add(b);
    }
  }
  return [...moved];
}

export { tmSourceText, tmTextFor, tmProofTextsFor, splitSharedPluralEntries, createTMEvictor, CONTEXT_SEPARATOR, PLURAL_FORM_MARK };
