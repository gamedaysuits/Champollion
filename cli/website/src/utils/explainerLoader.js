/**
 * explainerLoader — lazy fetchers for the language-card explanation layer.
 *
 * Two datasets, emitted once at the build root by plugins/shared-data
 * (never locale-prefixed, same pattern as /data/languages.json):
 *
 *   /data/explainers/tc-features.json — 571 typological feature explainers.
 *     Join contract: propertyIndex["<fact.source>|<property>"] → feature id,
 *     then features[id].values[rawCode].label for the human-readable value.
 *
 *   /data/explainers/glossary.json — 133 plain-language linguistic terms
 *     (term, also[], plain, mt_relevance, example?, citations[], related[]).
 *     Localized copies (glossary.<locale>.json, champollion-translated and
 *     merged over the SSOT by plugins/shared-data) sit beside it; pass the
 *     current locale to loadGlossary() to get one, with English fallback.
 *
 * Module-level promise caches mirror languageLoader.js: the data is immutable
 * for the lifetime of the page, and a failed fetch clears the cache so the
 * next call can retry. Both loaders resolve to null on failure — callers
 * treat null as "explanation layer unavailable" and degrade gracefully.
 */

let _tcFeaturesPromise = null;
const _glossaryPromises = new Map(); // locale key → promise

/** Fetch a /data/explainers file with the shared cache/retry pattern. */
function fetchExplainer(file, cacheGet, cacheSet) {
  const cached = cacheGet();
  if (cached) return cached;

  const promise = (async () => {
    try {
      // Absolute path on purpose: emitted once at the build root and shared
      // by every locale build.
      const response = await fetch(`/data/explainers/${file}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error(`[explainerLoader] Failed to load ${file}:`, err);
      cacheSet(null); // allow a retry on the next call
      return null;
    }
  })();

  cacheSet(promise);
  return promise;
}

/**
 * Load the typological feature explainers.
 * @returns {Promise<{_meta: object, features: object, propertyIndex: object}|null>}
 */
export function loadTcFeatures() {
  return fetchExplainer(
    'tc-features.json',
    () => _tcFeaturesPromise,
    (v) => { _tcFeaturesPromise = v; },
  );
}

/**
 * Load the plain-language glossary, localized when possible.
 *
 * Pass the current Docusaurus locale (useDocusaurusContext().i18n
 * .currentLocale). For 'en' — or when no localized artifact exists / the
 * fetch fails — the English SSOT copy is returned instead (per-field
 * English fallback already happened at merge time, so a localized file is
 * always structurally complete). Localized entries keep the canonical
 * English `term` (anchors + glossify matching) and carry the translated
 * name in `termDisplay`.
 *
 * @param {string} [locale] — current locale; omitted/invalid → English
 * @returns {Promise<{_meta: object, terms: Array}|null>}
 */
export function loadGlossary(locale) {
  const key =
    typeof locale === 'string' && locale !== 'en' && /^[a-z0-9-]{2,10}$/i.test(locale)
      ? locale
      : 'en';

  const cached = _glossaryPromises.get(key);
  if (cached) return cached;

  const promise = (async () => {
    if (key !== 'en') {
      try {
        const response = await fetch(`/data/explainers/glossary.${key}.json`);
        if (response.ok) return await response.json();
        // Missing localized artifact (e.g. translations not yet synced) —
        // fall through to the English copy.
      } catch (err) {
        console.error(`[explainerLoader] Failed to load glossary.${key}.json:`, err);
      }
    }
    try {
      const response = await fetch('/data/explainers/glossary.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('[explainerLoader] Failed to load glossary.json:', err);
      _glossaryPromises.delete(key); // allow a retry on the next call
      return null;
    }
  })();

  _glossaryPromises.set(key, promise);
  return promise;
}

/**
 * Resolve a typology fact to its feature explainer via the join contract:
 * propertyIndex["<fact.source>|<property>"] → features[id].
 *
 * @param {object|null} tcFeatures — result of loadTcFeatures()
 * @param {string} source — the fact's source id (e.g. "wals", "grambank-1.0.3")
 * @param {string} property — the fact's property name
 * @returns {object|null} feature explainer record, or null on miss
 */
export function findFeatureExplainer(tcFeatures, source, property) {
  if (!tcFeatures?.propertyIndex || !source || !property) return null;
  const idx = tcFeatures.propertyIndex;
  // The explainer index keys sources canonically (wals, grambank-1.0.3, apics,
  // card), but facts carry raw/variant source ids (e.g. 'champollion-derived',
  // 'grambank'). Try the raw id, then a few safe normalizations so a fact whose
  // explainer EXISTS is never missed on a naming technicality.
  const s = String(source).toLowerCase();
  const variants = [source, s];
  if (s.startsWith('grambank')) variants.push('grambank-1.0.3', 'grambank');
  if (s.startsWith('champollion')) variants.push('card');
  if (s.startsWith('wals')) variants.push('wals');
  if (s.startsWith('apics')) variants.push('apics');
  for (const v of variants) {
    const id = idx[`${v}|${property}`];
    if (id) return tcFeatures.features?.[id] || null;
  }
  return null;
}

/**
 * Resolve a fact's raw value code to the explainer's {label, plain} entry.
 * @returns {{label: string, plain: string}|null}
 */
const _valueIndexCache = new WeakMap();

export function findFeatureValue(feature, rawValue) {
  if (!feature?.values || rawValue == null) return null;
  const key = String(rawValue);
  // 1. Direct hit — the values map is keyed by the numeric code ("1","6",…).
  if (feature.values[key]) return feature.values[key];
  // 2. Reverse hit — the DB usually stores the DECODED label string, not the
  // code (e.g. value="No dominant order", not "6"), so a direct lookup misses.
  // Build (once, memoized) a label/plain → entry index so the value's own
  // plain-language gloss can surface. This is what made the per-value gloss
  // reach zero rows before.
  let idx = _valueIndexCache.get(feature);
  if (!idx) {
    idx = new Map();
    for (const v of Object.values(feature.values)) {
      if (v && typeof v === 'object') {
        if (v.label) idx.set(String(v.label).toLowerCase(), v);
        if (v.plain && v.plain !== v.label) idx.set(String(v.plain).toLowerCase(), v);
      }
    }
    _valueIndexCache.set(feature, idx);
  }
  return idx.get(key.toLowerCase()) || null;
}

/**
 * URL-safe anchor slug for a glossary term.
 * "noun incorporation" → "noun-incorporation". Anchors on /glossary are
 * `term-<slug>` — use termAnchor() for the full id.
 */
export function termSlug(term) {
  return String(term)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Full anchor id for a glossary term ("term-noun-incorporation"). */
export function termAnchor(term) {
  return `term-${termSlug(term)}`;
}
