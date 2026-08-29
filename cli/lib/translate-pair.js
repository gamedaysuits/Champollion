/**
 * translate-pair.js — Shared translation pipeline for a single pair
 *
 * Encapsulates the common sequence used by both the standard sync path
 * and the Docusaurus sync path:
 *
 *   1. TM partition: split keys into cached hits and API misses
 *   2. API call: translate the misses via translateBatch
 *   3. Quality gate: validate translations (hallucination, script, length)
 *      — TM hits that fail are evicted so the poison cannot be re-served
 *      — gate failures get ONE feedback retry (the rejection reason is
 *        injected into the prompt; a blind retry at temperature 0 would
 *        return byte-identical output)
 *   4. TM store: cache only gate-validated API translations
 *
 * ORDER MATTERS: the TM must only ever hold gate-validated values. An
 * earlier version stored API output before validation; one degenerate
 * response (e.g. "for translating" → "吗") then poisoned the cache — every
 * later sync served it, failed the gate, and never consulted the API again.
 *
 * Callers get back a structured result and handle their own control flow
 * (fallback decisions, error messages, script conversion, etc.) because
 * those details differ between sync paths.
 */

import { translateBatch } from './translate.js';
import { validateTranslations, logGateFailures } from './validate.js';
import { partitionByTM, storeTM, evictTM, tmMethodKey } from './tm.js';
import { output } from './output.js';

/**
 * Translate a set of string keys through the TM + API + quality gate pipeline.
 *
 * @param {string[]} stringKeys - Keys to translate (must be string-valued in sourceFlat)
 * @param {object} sourceFlat - Full flattened source locale map
 * @param {object} pairConfig - Pair configuration (target, method, model, batchSize, etc.)
 * @param {string} pairKey - Human-readable pair identifier for logging (e.g. "en→fr")
 * @param {object} options
 * @param {string} options.apiKey - API key for translation provider
 * @param {object} options.tm - Translation Memory object (mutable — entries are stored in-place)
 * @param {string} options.targetCode - Target language code
 * @param {object} [options.descriptions] - Optional key descriptions (Docusaurus format)
 * @param {Function} [options.onProgress] - Progress callback: (completed, total) => void
 * @returns {Promise<TranslateResult>}
 *
 * @typedef {object} TranslateResult
 * @property {object|null} translated - Validated translations, or null if all failed
 * @property {number} tmHitCount - Number of keys served from TM cache
 * @property {Array} failures - Quality gate failures (for caller logging)
 * @property {boolean} apiCalled - Whether the API was actually invoked
 * @property {boolean} apiReturnedNull - Whether the API was called but returned null
 */
export async function translateAndValidate(stringKeys, sourceFlat, pairConfig, pairKey, options) {
  const { apiKey, tm, targetCode, descriptions } = options;
  const method = pairConfig.method || 'llm';

  // TM entries are keyed on the FULL method key (method|model|register|coaching),
  // not the bare method name: switching model, register, or coaching must be a
  // cache miss, never a silent re-serve of old-style translations. See tm.js.
  const tmKey = tmMethodKey(pairConfig);

  // Step 1: TM partition — serve cached hits, identify API misses
  const { hits: tmHits, misses: tmMisses } = partitionByTM(
    tm, sourceFlat, stringKeys, targetCode, tmKey
  );

  const tmHitCount = Object.keys(tmHits).length;
  if (tmHitCount > 0) {
    output.info(`[TM] ${tmHitCount} key(s) served from cache`);
  }

  // Start with TM hits as the base
  const translated = { ...tmHits };
  let apiCalled = false;
  let apiReturnedNull = false;

  // Provenance: keys whose current value came from the API this run.
  // Only these are eligible for TM storage after validation, and only
  // non-API (TM-served) failures need cache eviction.
  const apiKeys = new Set();

  const batchOptions = {
    apiKey,
    model: pairConfig.model,
    batchSize: pairConfig.batchSize,
    onProgress: options.onProgress || null,
  };

  // Docusaurus passes descriptions for disambiguation context
  if (descriptions) {
    batchOptions.descriptions = descriptions;
  }

  // Step 2: API call for misses
  if (tmMisses.length > 0) {
    output.progress(`     Translating ${tmMisses.length} key(s) to ${pairConfig.name} (${method})...`);

    const apiResult = await translateBatch(tmMisses, sourceFlat, pairConfig, batchOptions);
    apiCalled = true;

    if (apiResult) {
      Object.assign(translated, apiResult);
      for (const k of Object.keys(apiResult)) apiKeys.add(k);
    } else {
      apiReturnedNull = true;
    }
  }

  // Step 3: Quality gate — validate translations before accepting
  let validated = {};
  let failures = [];
  if (Object.keys(translated).length > 0) {
    const result = validateTranslations(translated, sourceFlat, pairConfig);
    validated = result.validated;
    failures = result.failures;
  }

  // Step 3a: Evict poisoned TM entries. A TM-served value that fails the
  // gate would otherwise be re-served (and re-fail) on every future sync
  // without the API ever being consulted again.
  for (const f of failures) {
    if (f.key in tmHits && !apiKeys.has(f.key) && typeof sourceFlat[f.key] === 'string') {
      evictTM(tm, sourceFlat[f.key], targetCode, tmKey);
    }
  }

  // Step 3b: Feedback retry — one corrective round for gate failures.
  // The rejection reason is injected as per-key context so the prompt
  // actually changes; without it, a temperature-0 retry is a no-op.
  //
  // NOT gated on `apiKey`: that is the OpenRouter key, and the retry runs
  // through the pair's OWN method — google-translate/deepl/direct providers
  // carry their own credentials. The old `&& apiKey` guard silently skipped
  // the corrective round for every direct provider, which meant a TM entry
  // evicted by the gate (step 3a) was only re-billed on the NEXT sync — a
  // two-pass heal nobody asked for. A method that genuinely cannot run
  // returns null here and the failures simply stand.
  if (failures.length > 0) {
    const retryKeys = failures
      .map(f => f.key)
      .filter(k => typeof sourceFlat[k] === 'string');

    if (retryKeys.length > 0) {
      output.progress(`     Quality gate rejected ${retryKeys.length} key(s) — retrying with feedback...`);

      const feedbackDescriptions = { ...(descriptions || {}) };
      for (const f of failures) {
        const rejected = String(f.value ?? '').slice(0, 60);
        const base = feedbackDescriptions[f.key] ? `${feedbackDescriptions[f.key]} — ` : '';
        feedbackDescriptions[f.key] =
          `${base}RETRY: a previous attempt ("${rejected}") was rejected by the quality gate: ${f.reason}. ` +
          `Provide a complete, self-contained ${pairConfig.name} translation of this exact string.`;
      }

      const retryResult = await translateBatch(retryKeys, sourceFlat, pairConfig, {
        ...batchOptions,
        onProgress: null, // avoid double-counting progress
        descriptions: feedbackDescriptions,
      });
      apiCalled = true;

      if (retryResult) {
        const retryValidation = validateTranslations(retryResult, sourceFlat, pairConfig);
        Object.assign(validated, retryValidation.validated);
        for (const k of Object.keys(retryValidation.validated)) apiKeys.add(k);

        // Keys that passed on retry are no longer failures; keys the retry
        // produced a fresh (still failing) value for get the newer record.
        const passed = new Set(Object.keys(retryValidation.validated));
        const retryFailureByKey = new Map(retryValidation.failures.map(f => [f.key, f]));
        failures = failures
          .filter(f => !passed.has(f.key))
          .map(f => retryFailureByKey.get(f.key) || f);
      }
    }
  }

  if (failures.length > 0) {
    logGateFailures(failures, pairKey);
  }

  // Step 4: TM store — only gate-validated values that came from the API.
  // TM hits are already cached; unvalidated output must never enter the TM.
  for (const [k, v] of Object.entries(validated)) {
    if (apiKeys.has(k) && typeof v === 'string' && typeof sourceFlat[k] === 'string') {
      storeTM(tm, sourceFlat[k], targetCode, tmKey, v);
    }
  }

  return {
    translated: Object.keys(validated).length > 0 ? validated : null,
    tmHitCount,
    failures,
    apiCalled,
    apiReturnedNull,
  };
}
