/**
 * i18next plural keys — give every target locale exactly ITS plural forms.
 *
 * THE PROBLEM: i18next (v21+, "JSON v4") stores plurals as sibling keys with
 * a CLDR category suffix:
 *
 *   en.json  { "item_one": "{{count}} item", "item_other": "{{count}} items" }
 *
 * English has two categories (one, other). French and Spanish have three
 * (one, many, other); Japanese has one (other); Arabic has six. A sync that
 * mirrors the SOURCE's keys writes `item_one`/`item_other` into every
 * locale: French silently loses its `many` form (i18next falls back to the
 * key for 1 000 000), and Japanese carries a `_one` it never selects.
 *
 * THE RULE (applied per target locale, json key-value files only):
 *   - The target's categories come from CLDR via
 *     Intl.PluralRules(target).resolvedOptions().pluralCategories — no
 *     hardcoded language table.
 *   - Each target category is translated from the source's `_other` form,
 *     except `_one` (from the source's `_one`) and `_zero` (from the
 *     source's `_zero` when it has one — i18next looks `key_zero` up for
 *     count 0 in EVERY language, so a source that defines it keeps it).
 *   - Source categories the target does not use are not created. If an
 *     earlier sync wrote one, sync removes it only when the Translation
 *     Memory proves the pipeline produced that value; a hand-written value
 *     is kept (and reported as an extra key).
 *   - Ordinal groups (`key_ordinal_one`, …) use Intl.PluralRules with
 *     type 'ordinal'.
 *   - A locale CLDR has no plural rules for (Intl falls back to another
 *     locale) keeps the source's categories, and the caller says so —
 *     guessing a category set for a language CLDR does not describe would
 *     be inventing grammar.
 *
 * DETECTION is deliberately strict, because a false positive invents keys:
 * a group needs an `_other` key plus at least one other category, OR — for
 * a source language whose only category is `other` (ja, zh, ko) — an
 * `_other` value that interpolates {{count}}. A lone `gender_other: "Other"`
 * is an ordinary key.
 *
 * Everything here is pure: callers (sync, the cost estimate, verify,
 * integrity) pass the source map in and get the per-target expected map out,
 * so all of them judge a target by the same keys.
 */

const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const SUFFIX_RE = /^(.+?)(_ordinal)?_(zero|one|two|few|many|other)$/;

/** Normalize a locale code for Intl (pt_BR → pt-BR). */
function intlTag(code) {
  return String(code).replace(/_/g, '-');
}

/**
 * CLDR plural categories for a locale, or null when CLDR (as shipped in
 * this runtime's Intl) has no rules for it.
 *
 * @param {string} code - Locale code
 * @param {'cardinal'|'ordinal'} [type='cardinal']
 * @returns {string[]|null}
 */
function pluralCategoriesFor(code, type = 'cardinal') {
  const tag = intlTag(code);
  try {
    if (Intl.PluralRules.supportedLocalesOf([tag]).length === 0) return null;
    return new Intl.PluralRules(tag, { type }).resolvedOptions().pluralCategories;
  } catch {
    // RangeError: not a well-formed BCP 47 tag — no CLDR rules either.
    return null;
  }
}

/**
 * Find i18next plural groups in a flat source map.
 *
 * @param {object} sourceFlat - Flat key → value map of ONE source file
 * @param {string} sourceLocale - Source locale code
 * @returns {Map<string, { base: string, ordinal: boolean, keys: Object<string, string> }>}
 *   groupId → group; `keys` maps category → source key
 */
function findPluralGroups(sourceFlat, sourceLocale) {
  const candidates = new Map();
  for (const [key, value] of Object.entries(sourceFlat)) {
    if (typeof value !== 'string') continue;
    const m = SUFFIX_RE.exec(key);
    if (!m) continue;
    const ordinal = !!m[2];
    const id = `${m[1]}\u0000${ordinal ? 'ordinal' : 'cardinal'}`;
    if (!candidates.has(id)) candidates.set(id, { base: m[1], ordinal, keys: {} });
    candidates.get(id).keys[m[3]] = key;
  }

  const groups = new Map();
  for (const [id, group] of candidates) {
    const cats = Object.keys(group.keys);
    if (!cats.includes('other')) continue;
    if (cats.length >= 2) { groups.set(id, group); continue; }
    // Single-category source languages (ja/zh/ko…) write only `_other`.
    const sourceCats = pluralCategoriesFor(sourceLocale, group.ordinal ? 'ordinal' : 'cardinal');
    const otherValue = sourceFlat[group.keys.other];
    if (sourceCats && sourceCats.length === 1 && sourceCats[0] === 'other'
        && /\{\{\s*count\b/.test(otherValue)) {
      groups.set(id, group);
    }
  }
  return groups;
}

/**
 * A few integers that select `category` in `code` — prompt context so the
 * model writes, e.g., French `many` as the form for 1 000 000.
 */
function sampleCounts(code, category, type) {
  let rules;
  try { rules = new Intl.PluralRules(intlTag(code), { type }); } catch { return []; }
  const out = [];
  for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 11, 12, 21, 22, 100, 101, 1000000]) {
    if (rules.select(n) === category) out.push(n);
    if (out.length === 3) break;
  }
  return out;
}

/**
 * Build the map a target locale is expected to contain for one source file.
 *
 * @param {object} sourceFlat - Flat source map (one file)
 * @param {string} sourceLocale
 * @param {string} targetLocale
 * @param {Map} [groups] - Precomputed findPluralGroups() result
 * @returns {null | {
 *   flat: object,                       // expected target keys → SOURCE text to translate
 *   origin: Object<string, string>,     // target key → source key it is translated from
 *   descriptions: Object<string, string>, // prompt context for generated categories
 *   unused: string[],                   // source plural keys this target does not use
 *   borrowed: Object<string, string>,   // target key → its plural form, for a key
 *                                       //   translated from ANOTHER category's source
 *                                       //   (French `_many` from `_other`): "many",
 *                                       //   "ordinal-few" — its own cache identity
 *                                       //   (lib/tm-evict.js tmTextFor)
 *   groups: number,
 *   unknownLocale: boolean,             // CLDR has no rules → source categories kept
 * }} null when the file has no plural groups (callers keep the source map as is)
 */
function expandPluralsForLocale(sourceFlat, sourceLocale, targetLocale, groups = null) {
  const found = groups || findPluralGroups(sourceFlat, sourceLocale);
  if (found.size === 0) return null;

  const groupOfKey = new Map();
  for (const [id, group] of found) {
    for (const key of Object.values(group.keys)) groupOfKey.set(key, id);
  }

  const flat = {};
  const origin = {};
  const descriptions = {};
  const unused = [];
  const borrowed = {};
  const emitted = new Set();
  let unknownLocale = false;

  for (const [key, value] of Object.entries(sourceFlat)) {
    const id = groupOfKey.get(key);
    if (id === undefined) { flat[key] = value; continue; }
    if (emitted.has(id)) continue;
    emitted.add(id);

    const group = found.get(id);
    const type = group.ordinal ? 'ordinal' : 'cardinal';
    const sourceCats = Object.keys(group.keys);
    let targetCats = pluralCategoriesFor(targetLocale, type);
    // No CLDR rules for this locale: mirror the source's forms one-to-one
    // (the pre-plural-aware behaviour), and let the caller report it.
    const mirror = !targetCats;
    if (mirror) {
      unknownLocale = true;
      targetCats = CATEGORIES.filter(c => sourceCats.includes(c));
    } else if (group.keys.zero && !targetCats.includes('zero')) {
      // i18next resolves key_zero for count 0 in every language.
      targetCats = ['zero', ...targetCats];
    }

    const prefix = `${group.base}${group.ordinal ? '_ordinal' : ''}_`;
    for (const cat of CATEGORIES.filter(c => targetCats.includes(c))) {
      const fromCat = mirror || ((cat === 'one' || cat === 'zero') && group.keys[cat]) ? cat : 'other';
      const fromKey = group.keys[fromCat];
      const targetKey = `${prefix}${cat}`;
      flat[targetKey] = sourceFlat[fromKey];
      origin[targetKey] = fromKey;
      if (fromCat !== cat) {
        // Same source text as the key it borrows from, a different form:
        // cached on its own (Round 6, i18next persona — `_many` and `_other`
        // shared one entry, and a redo wrote the `_many` text into both).
        borrowed[targetKey] = group.ordinal ? `ordinal-${cat}` : cat;
        const samples = sampleCounts(targetLocale, cat, type);
        descriptions[targetKey] = `${group.ordinal ? 'Ordinal' : 'Plural'} form "${cat}" (CLDR) of this message`
          + (samples.length > 0 ? `, used for counts such as ${samples.join(', ')}` : '')
          + '. Translate the plural text into that grammatical form.';
      }
    }
    for (const cat of sourceCats) {
      if (!targetCats.includes(cat)) unused.push(group.keys[cat]);
    }
  }

  return { flat, origin, descriptions, unused, borrowed, groups: found.size, unknownLocale };
}

/**
 * Map source-key lists (changed keys, forced keys) into the target key
 * space: a generated key is changed/forced when the source key it is
 * translated from is.
 *
 * @param {string[]} sourceKeys
 * @param {ReturnType<typeof expandPluralsForLocale>} expansion
 * @returns {string[]}
 */
function mapSourceKeysToTarget(sourceKeys, expansion) {
  if (!expansion || !sourceKeys || sourceKeys.length === 0) return sourceKeys || [];
  const set = new Set(sourceKeys);
  const out = new Set(sourceKeys.filter(k => Object.prototype.hasOwnProperty.call(expansion.flat, k)));
  for (const [targetKey, fromKey] of Object.entries(expansion.origin)) {
    if (set.has(fromKey) || set.has(targetKey)) out.add(targetKey);
  }
  return [...out];
}

/**
 * The source key a target key's value was translated from (identity for
 * ordinary keys). Used to restore manifest hashes for failed keys.
 *
 * @param {string} targetKey
 * @param {ReturnType<typeof expandPluralsForLocale>} expansion
 * @returns {string}
 */
function originKey(targetKey, expansion) {
  return (expansion && expansion.origin[targetKey]) || targetKey;
}

/**
 * What each target's CLDR plural forms change from the source's, in words,
 * for the run's own targets: "es, fr add _many; ja keeps only _other; de: as
 * en". Read from Intl.PluralRules (CLDR) at run time — the line used to say
 * "e.g. French adds _many" whatever the project's languages, and the docs
 * named French where Spanish gains the same form (Round 13, i18next persona).
 *
 * @param {string} sourceLocale
 * @param {string[]} targets
 * @param {'cardinal'|'ordinal'} [type='cardinal']
 * @returns {string} '' when nothing can be said (no CLDR rules for the source)
 */
function describePluralFormChanges(sourceLocale, targets, type = 'cardinal') {
  const src = pluralCategoriesFor(sourceLocale, type);
  if (!src) return '';
  const order = (cats) => CATEGORIES.filter(c => cats.includes(c)).map(c => `_${c}`).join(', ');
  // One phrase per kind of change, the targets that share it named together.
  const groups = new Map();
  for (const code of [...new Set(targets)].sort()) {
    const cats = pluralCategoriesFor(code, type);
    let kind;
    if (!cats) kind = { id: 'none' };
    else {
      const added = cats.filter(c => !src.includes(c));
      const dropped = src.filter(c => !cats.includes(c));
      if (added.length === 0 && dropped.length === 0) kind = { id: 'same' };
      else if (cats.length === 1) kind = { id: `only ${cats[0]}`, only: cats[0] };
      else kind = { id: `+${order(added)} -${order(dropped)}`, added: order(added), dropped: order(dropped) };
    }
    if (!groups.has(kind.id)) groups.set(kind.id, { kind, codes: [] });
    groups.get(kind.id).codes.push(code);
  }
  return [...groups.values()].map(({ kind, codes }) => {
    const one = codes.length === 1;
    const who = codes.join(', ');
    if (kind.id === 'none') return `${who}: no CLDR rules (the source's forms are kept)`;
    if (kind.id === 'same') return `${who}: the same forms as ${sourceLocale}`;
    if (kind.only) return `${who} ${one ? 'keeps' : 'keep'} only _${kind.only}`;
    return `${who} ${[
      kind.added && `${one ? 'adds' : 'add'} ${kind.added}`,
      kind.dropped && `${one ? 'drops' : 'drop'} ${kind.dropped}`,
    ].filter(Boolean).join(' and ')}`;
  }).join('; ');
}

/**
 * Keys a target file holds for an i18next plural form its language does not
 * have (Spanish `count_two`, from a source with `count_one`/`count_other`):
 * i18next never selects them. `_zero` is never one (i18next uses it for 0 in
 * every language), and a key the source file itself defines is left to the
 * rule above (removed when the cache proves sync wrote it). ONE rule for
 * what `verify` warns about and what `sync --prune plural-extras` removes —
 * nothing else is ever removed by it (Round 13, i18next persona: verify said
 * "delete them" and offered no way to but by hand).
 *
 * @param {{ flat: object, pluralGroups?: Map }} unit - A source unit (lib/locale-layout.js)
 * @param {object} targetFlat - The target file's flat map
 * @param {string} locale
 * @returns {Array<{ key: string, category: string, cats: string[] }>}
 */
function pluralExtraKeys(unit, targetFlat, locale) {
  const out = [];
  if (!unit?.pluralGroups || unit.pluralGroups.size === 0 || !targetFlat) return out;
  const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
  for (const group of unit.pluralGroups.values()) {
    const cats = pluralCategoriesFor(locale, group.ordinal ? 'ordinal' : 'cardinal');
    if (!cats) continue;
    for (const c of CATEGORIES) {
      if (c === 'zero' || cats.includes(c)) continue;
      const key = `${group.base}${group.ordinal ? '_ordinal' : ''}_${c}`;
      if (has(targetFlat, key) && !has(unit.flat, key)) out.push({ key, category: c, cats });
    }
  }
  return out;
}

export {
  pluralCategoriesFor,
  findPluralGroups,
  expandPluralsForLocale,
  mapSourceKeysToTarget,
  originKey,
  describePluralFormChanges,
  pluralExtraKeys,
};
