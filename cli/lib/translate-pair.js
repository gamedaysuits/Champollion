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
 * ICU MESSAGES get prompt guidance (keep the syntax; the target language's
 * CLDR plural categories) and the gate's structure check (lib/validate.js).
 * A TM hit that fails the gate is evicted where it actually lives — with
 * model carry-over that can be another model's entry (lib/tm-evict.js).
 *
 * KEYS THE MODEL MUST NOT SEE. gettext keys are msgids — sentences, some
 * with newlines, some carrying a msgctxt behind a U+0004. A model asked to
 * "keep the keys exactly as-is" reliably mangles those, so such keys travel
 * under short aliases and are mapped back; ordinary dotted keys are sent as
 * they are (their names are prompt context).
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

import { translateBatch, getMethod } from './translate.js';
import { validateTranslations, logGateFailures, sharedOutputReason, sharedOutputItems } from './validate.js';
import { partitionByTM, storeTM, tmMethodKey, lookupTM, servingMethodKey } from './tm.js';
import { tmSourceText, createTMEvictor } from './tm-evict.js';
import { icuGuidance, pluralGaps, describeCategories } from './icu-structure.js';
import { output } from './output.js';
import { captureRequests } from './methods/request-capture.js';
import { refusalCategory, notePrimaryReason } from './refusal-category.js';

/** A key the model should not be shown: control characters, or a whole paragraph. */
function needsAlias(key) {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f]/.test(key) || key.length > 120;
}

/**
 * Accepted plural messages that lack CLDR categories the target uses
 * (lib/icu-structure.js pluralGaps), keyed by key.
 *
 * @param {object} values - key → accepted translation
 * @param {object} sourceFlat
 * @param {string} targetCode
 * @returns {Object<string, { everyday: string[], rare: string[], type: string }>}
 */
function pluralGapsOf(values, sourceFlat, targetCode, slots = null) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof sourceFlat[k] !== 'string' || !sourceFlat[k].includes('{') || typeof v !== 'string') continue;
    const gaps = pluralGaps(sourceFlat[k], v, targetCode, slots);
    if (gaps.length === 0) continue;
    out[k] = {
      everyday: [...new Set(gaps.flatMap(g => g.everyday))],
      rare: [...new Set(gaps.flatMap(g => g.rare))],
      type: gaps[0].type,
    };
  }
  return out;
}

/**
 * translateBatch, with unpromptable keys (see header) sent under aliases
 * and mapped back. Descriptions follow their keys.
 */
async function translateBatchAliased(keys, sourceFlat, pairConfig, options) {
  if (!keys.some(needsAlias)) return translateBatch(keys, sourceFlat, pairConfig, options);
  const taken = new Set(keys);
  const toAlias = new Map();
  const fromAlias = new Map();
  let n = 0;
  for (const key of keys) {
    if (!needsAlias(key)) continue;
    let alias;
    do { alias = `msg_${++n}`; } while (taken.has(alias) || Object.prototype.hasOwnProperty.call(sourceFlat, alias));
    toAlias.set(key, alias);
    fromAlias.set(alias, key);
  }
  const aliasedKeys = keys.map(k => toAlias.get(k) ?? k);
  const aliasedSource = { ...sourceFlat };
  for (const [key, alias] of toAlias) aliasedSource[alias] = sourceFlat[key];
  let descriptions = options.descriptions;
  if (descriptions) {
    descriptions = { ...descriptions };
    for (const [key, alias] of toAlias) {
      if (descriptions[key] !== undefined) descriptions[alias] = descriptions[key];
    }
  }
  const result = await translateBatch(aliasedKeys, aliasedSource, pairConfig, { ...options, descriptions });
  if (!result) return result;
  const out = {};
  for (const [k, v] of Object.entries(result)) out[fromAlias.get(k) ?? k] = v;
  return out;
}

/**
 * The per-key notes the method is given: the caller's (Docusaurus
 * descriptions, i18next plural forms, ARB descriptions, gettext msgctxt and
 * `#.` comments) plus, for an ICU plural/select message, what is syntax and
 * which plural categories the target uses. ONE builder for the real call and
 * for `sync --dry --show-prompt`, so the preview is what is sent.
 *
 * @returns {object|null}
 */
function buildPromptDescriptions(stringKeys, sourceFlat, pairConfig, targetCode, descriptions) {
  let promptDescriptions = descriptions || null;
  let ownCopy = false;
  for (const k of stringKeys) {
    const guidance = icuGuidance(sourceFlat[k], targetCode, pairConfig.name || targetCode);
    if (!guidance) continue;
    if (!ownCopy) { promptDescriptions = { ...(descriptions || {}) }; ownCopy = true; }
    promptDescriptions[k] = promptDescriptions[k] ? `${promptDescriptions[k]} — ${guidance}` : guidance;
  }
  return promptDescriptions;
}

/**
 * The options translateBatch gets — shared by the real call and the preview.
 * `cwd` is the PROJECT directory: methods read their key (.env, .env.local),
 * endpoint, coaching and glossary from it. Without it they fell back to
 * process.cwd(), which is the project only when the caller runs there (the
 * MCP server had to swap process.cwd() for the call).
 */
function buildBatchOptions(pairConfig, apiKey, promptDescriptions, onProgress = null, cwd = null) {
  return {
    apiKey,
    ...(cwd && { cwd }),
    model: pairConfig.model,
    batchSize: pairConfig.batchSize,
    onProgress,
    // Docusaurus passes descriptions for disambiguation context
    ...(promptDescriptions && { descriptions: promptDescriptions }),
  };
}

/**
 * The exact request(s) the pair's method would send for these keys — built
 * by the method's own code and handed over at its transport, never sent
 * (lib/methods/request-capture.js). Nothing is read from or written to the
 * cache: this shows the request a cache miss produces.
 *
 * @param {string[]} stringKeys
 * @param {object} sourceFlat
 * @param {object} pairConfig
 * @param {{ apiKey?: string|null, targetCode: string, descriptions?: object|null }} options
 * @returns {Promise<{ supported: boolean, requests: Array<{ url: string, method: string, headers: object, body: unknown }> }>}
 */
export async function previewRequests(stringKeys, sourceFlat, pairConfig, { apiKey = null, targetCode, descriptions = null, cwd = null } = {}) {
  const method = getMethod(pairConfig.method || 'llm', pairConfig);
  if (!method.supportsRequestPreview) return { supported: false, requests: [] };
  const promptDescriptions = buildPromptDescriptions(stringKeys, sourceFlat, pairConfig, targetCode, descriptions);
  const batchOptions = buildBatchOptions(pairConfig, apiKey, promptDescriptions, null, cwd);
  const requests = await captureRequests(() => translateBatchAliased(stringKeys, sourceFlat, pairConfig, batchOptions));
  return { supported: true, requests };
}

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
 * @param {string} [options.cwd] - The project directory: where the method reads
 *   its key (.env / .env.local), endpoint, coaching and glossary. Omitted:
 *   process.cwd()
 * @param {Function} [options.onProgress] - Progress callback: (completed, total) => void
 * @param {Object<string, string>} [options.pluralForms] - Borrowed i18next
 *   plural forms (lib/plurals.js `borrowed`): key → form; each is cached
 *   under its own identity (lib/tm-evict.js tmSourceText)
 * @param {Set<string>} [options.noSendKeys] - Keys the method must NOT be
 *   asked for (lib/locale-state.js: refused before). The cache still serves
 *   them; what it does not hold comes back in `heldKeys`, unsent and unbilled.
 * @param {import('./validate.js').SharedOutputIndex} [options.sharedOutputs] -
 *   The locale's different-inputs-same-output index (accepted values are added)
 * @returns {Promise<TranslateResult>}
 *
 * @typedef {object} TranslateResult
 * @property {object|null} translated - Validated translations, or null if all failed
 * @property {number} tmHitCount - Number of keys served from TM cache
 * @property {Array} failures - Quality gate failures (for caller logging)
 * @property {boolean} apiCalled - Whether the API was actually invoked
 * @property {boolean} apiReturnedNull - Whether the API was called but returned null
 * @property {number} sentCount - Keys sent to the method (TM misses) — what the
 *   run asks a model/API for, as opposed to tmHitCount served from the cache
 * @property {number} retriedCount - Keys sent a second time with the gate's feedback
 * @property {Object<string, { everyday: string[], rare: string[], type: string }>} pluralGaps -
 *   Accepted plural messages that lack CLDR categories the target uses
 *   (lib/icu-structure.js pluralGaps), keyed by key — the caller reports them
 * @property {string[]} sentKeys - Keys sent to the method (TM misses not held back)
 * @property {string[]} answeredKeys - Accepted keys whose value is the method's
 *   own answer this run (not served from the cache)
 * @property {string[]} heldKeys - noSendKeys the cache did not hold: not sent, not translated
 * @property {string[]} refusedKeys - Final failures the METHOD produced (it was
 *   asked and the gate refused its answer) — what a refusal record remembers
 */
export async function translateAndValidate(stringKeys, sourceFlat, pairConfig, pairKey, options) {
  const { apiKey, tm, targetCode, descriptions } = options;
  const method = pairConfig.method || 'llm';
  const noSend = options.noSendKeys instanceof Set ? options.noSendKeys : new Set();
  const sharedOutputs = options.sharedOutputs || null;

  // TM entries are keyed on the FULL method key (method|model|register|coaching),
  // not the bare method name: switching model, register, or coaching must be a
  // cache miss, never a silent re-serve of old-style translations. See tm.js.
  const tmKey = tmMethodKey(pairConfig);

  // The text each key is cached under: its source text, with a gettext
  // msgctxt folded in (lib/tm-evict.js) so two contexts never share an entry.
  // A borrowed i18next plural form (options.pluralForms: key → form) is
  // cached under its own text, apart from the form it borrows from.
  const pluralForms = options.pluralForms || null;
  const tmText = {};
  for (const k of stringKeys) {
    if (typeof sourceFlat[k] === 'string') tmText[k] = tmSourceText(k, sourceFlat[k], pluralForms?.[k] || null);
  }
  const evictor = createTMEvictor(tm);

  const promptDescriptions = buildPromptDescriptions(stringKeys, sourceFlat, pairConfig, targetCode, descriptions);

  // Step 1: TM partition — serve cached hits, identify API misses
  const { hits: tmHits, misses: tmMisses } = partitionByTM(
    tm, tmText, stringKeys, targetCode, tmKey
  );

  const tmHitCount = Object.keys(tmHits).length;
  if (tmHitCount > 0) {
    output.info(`[TM] ${tmHitCount} key(s) served from cache`);
  }
  // The entry each hit was served from (exact, or another model's).
  const tmHitBy = {};
  for (const k of Object.keys(tmHits)) tmHitBy[k] = servingMethodKey(tm, tmText[k], targetCode, tmKey) || tmKey;

  // Start with TM hits as the base
  const translated = { ...tmHits };
  let apiCalled = false;
  let apiReturnedNull = false;

  // Provenance: keys whose current value came from the API this run.
  // Only these are eligible for TM storage after validation, and only
  // non-API (TM-served) failures need cache eviction.
  const apiKeys = new Set();

  const batchOptions = buildBatchOptions(pairConfig, apiKey, promptDescriptions, options.onProgress || null, options.cwd || null);

  // Step 2: API call for misses — except keys held back (refused before by
  // this method; lib/locale-state.js). They stay untranslated, unbilled.
  const toSend = tmMisses.filter(k => !noSend.has(k));
  const heldKeys = tmMisses.filter(k => noSend.has(k));
  let sentCount = 0;
  let retriedCount = 0;
  // Keys whose current value the METHOD produced (initial call or retry).
  const askedKeys = new Set();
  if (toSend.length > 0) {
    sentCount = toSend.length;
    output.progress(`     Translating ${toSend.length} key(s) to ${pairConfig.name} (${method})...`);

    const apiResult = await translateBatchAliased(toSend, sourceFlat, pairConfig, batchOptions);
    apiCalled = true;

    if (apiResult) {
      Object.assign(translated, apiResult);
      for (const k of Object.keys(apiResult)) { apiKeys.add(k); askedKeys.add(k); }
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

  // Different inputs, same output (lib/validate.js SharedOutputIndex): one
  // text answering 3+ different source strings — a memorized sentence. A
  // soft failure: the retry asks again, then the fallback; never accepted
  // silently. Checked against what this locale accepted earlier in the run.
  // Counted over EVERY answer the method gave (`pool`), not only the ones
  // that passed the other checks: a third copy refused for a lost
  // placeholder is still a third copy, and its two siblings must not pass
  // (Round 5, hospital persona). ICU branches count one by one
  // (validate.js sharedOutputItems). Only keys in `vals` are failed.
  const sharedFailure = (vals, pool = vals) => {
    if (!sharedOutputs) return [];
    const items = Object.entries(pool)
      .flatMap(([k, v]) => (typeof v === 'string' && typeof sourceFlat[k] === 'string' ? sharedOutputItems(k, sourceFlat[k], v) : []));
    const out = [];
    for (const [k, group] of sharedOutputs.suspects(items)) {
      if (!(k in vals)) continue;
      out.push({ key: k, reason: sharedOutputReason(group), value: vals[k], sharedOutput: true });
    }
    return out;
  };
  for (const f of sharedFailure(validated, translated)) {
    delete validated[f.key];
    failures.push(f);
  }

  // A TM-served short Latin-script value was already settled as a name by
  // an earlier run (that is how it got into the TM). Re-asking would evict
  // it and re-bill the same answer on every sync — accept it as confirmed.
  // Same for a TM-served plural message without some plural forms: it was
  // accepted (after one corrective ask) by the run that cached it. Serving
  // it is free; re-asking would bill every sync. It is still reported
  // (pluralGaps below), with the command that asks again.
  failures = failures.filter((f) => {
    if ((f.nameOrLabel || f.pluralGap) && f.key in tmHits && !apiKeys.has(f.key)) {
      validated[f.key] = translated[f.key];
      return false;
    }
    return true;
  });

  // A method that reads no per-key instructions (a machine translation
  // engine) cannot be told which plural forms to add: asking again would
  // bill the same answer. Accept the message as it is; it is reported.
  const takesInstructions = (() => {
    try { return getMethod(method, pairConfig).acceptsKeyInstructions === true; } catch { return false; }
  })();
  if (!takesInstructions) {
    failures = failures.filter((f) => {
      if (f.pluralGap) { validated[f.key] = translated[f.key]; return false; }
      return true;
    });
  }

  // Step 3a: Evict poisoned TM entries. A TM-served value that fails the
  // gate would otherwise be re-served (and re-fail) on every future sync
  // without the API ever being consulted again. Evicted where it LIVES: a
  // model-carry-over hit is another model's entry (lib/tm-evict.js).
  for (const f of failures) {
    if (f.key in tmHits && !apiKeys.has(f.key) && typeof tmText[f.key] === 'string') {
      evictor.evictProducing(tmText[f.key], targetCode, tmHits[f.key], [tmKey]);
    }
  }
  // A held-back key whose cached value the gate refused is not sent either:
  // it is held, not retried (a paid call is exactly what holding back stops).
  failures = failures.filter((f) => {
    if (noSend.has(f.key) && !apiKeys.has(f.key)) { heldKeys.push(f.key); return false; }
    return true;
  });

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
  // Keys whose ONLY problem was a missing plural form: if the retry does not
  // improve on them (no answer, or one refused for something else), their
  // first answer stands — see below.
  const pluralGapKeys = new Set(failures.filter(f => f.pluralGap).map(f => f.key));
  if (failures.length > 0) {
    const retryKeys = failures
      .map(f => f.key)
      .filter(k => typeof sourceFlat[k] === 'string' && !noSend.has(k));

    // What the second ask can carry. An LLM method reads the gate's
    // feedback; a machine-translation engine or an `api` endpoint gets the
    // same text again (the api contract carries the source text — and the
    // feedback only when the endpoint declares "acceptsInstructions": true).
    // An endpoint that declares it follows no instructions (a trained NMT
    // model) would answer the same: it is not asked again — its first
    // answers are judged as a second answer would be (a name kept as written
    // is accepted), and the rest go to the fallback (Round 4 school persona).
    const declaredDeaf = pairConfig.acceptsInstructions === false;
    // Why each key was refused, under the line that says it was — the line
    // alone said "rejected 1 key(s)" and nothing about why (Round 5, Django
    // persona). A key that passes on the second ask is never in the final
    // [GATE] block, so this is the only place its reason is printed.
    const reasonLines = () => {
      const byKey = new Map(failures.filter(f => retryKeys.includes(f.key)).map(f => [f.key, f.reason]));
      const shown = [...byKey].slice(0, 10).map(([k, r]) => `       - ${k}: ${r}`);
      if (byKey.size > 10) shown.push(`       … and ${byKey.size - 10} more`);
      for (const line of shown) output.progress(line);
    };
    if (retryKeys.length > 0 && declaredDeaf) {
      output.progress(`     ${pairKey}: quality gate rejected ${retryKeys.length} key(s) — not asked again: `
        + `${method === 'api' ? 'the endpoint' : method} declares it does not follow instructions, so it would return the same text`
        + `${pairConfig.fallback ? ' (the fallback gets them)' : ''}.`);
      reasonLines();
      const firstAnswers = {};
      for (const k of retryKeys) if (typeof translated[k] === 'string') firstAnswers[k] = translated[k];
      const second = validateTranslations(firstAnswers, sourceFlat, pairConfig, { acceptLatinNames: true, acceptPluralGaps: true });
      const shared = new Set(failures.filter(f => f.sharedOutput).map(f => f.key));
      for (const [k, v] of Object.entries(second.validated)) {
        if (shared.has(k)) continue;
        validated[k] = v;
      }
      const passed = new Set(Object.keys(validated));
      failures = failures.filter(f => !passed.has(f.key));
    } else if (retryKeys.length > 0) {
      const how = takesInstructions
        ? 'retrying with feedback'
        : method === 'api'
          ? 'asking once more (the endpoint may ignore feedback: the api request carries it only when the pair declares "acceptsInstructions": true)'
          : `asking once more (${method} takes no instructions, so it gets the same text again)`;
      output.progress(`     ${pairKey}: quality gate rejected ${retryKeys.length} key(s) — ${how}...`);
      reasonLines();

      const feedbackDescriptions = { ...(promptDescriptions || {}) };
      for (const f of failures) {
        const rejected = String(f.value ?? '').slice(0, 60);
        const base = feedbackDescriptions[f.key] ? `${feedbackDescriptions[f.key]} — ` : '';
        feedbackDescriptions[f.key] = f.sharedOutput
          ? `${base}RETRY: a previous attempt returned the same text ("${rejected}") for several different source strings. `
            + `Translate THIS string into ${pairConfig.name} — its own meaning, not a sentence you used elsewhere.`
          : f.nameOrLabel
          // A short value kept in Latin script: maybe a name, maybe a label
          // the model skipped. Ask once, plainly; if it answers the same
          // again, the retry validation below accepts it as a name.
          ? `${base}RETRY: a previous attempt kept this in Latin script ("${rejected}"). ` +
            `If it is a descriptive label or phrase, translate it into ${pairConfig.name}. ` +
            'Only if it is a proper name (a person, company, product or brand) return it exactly as written.'
          : f.pluralGap
            // A plural message without forms the language needs: name them,
            // with the counts that select each, and ask for the whole message.
            ? `${base}RETRY: the previous translation had no ${f.pluralGap.missing.map(c => `"${c}"`).join(', ')} `
              + `branch. ${pairConfig.name} uses ${describeCategories(targetCode, f.pluralGap.missing, f.pluralGap.type)}. `
              + 'Return the whole message again with a branch for each of these forms, keeping every other branch and "other".'
            : `${base}RETRY: a previous attempt ("${rejected}") was rejected by the quality gate: ${f.reason}. ` +
              `Provide a complete, self-contained ${pairConfig.name} translation of this exact string.`;
      }

      retriedCount = retryKeys.length;
      const retryResult = await translateBatchAliased(retryKeys, sourceFlat, pairConfig, {
        ...batchOptions,
        onProgress: null, // avoid double-counting progress
        descriptions: feedbackDescriptions,
      });
      apiCalled = true;

      if (retryResult) {
        // Only keys the method actually answered count as refused by it.
        for (const k of Object.keys(retryResult)) askedKeys.add(k);
        // acceptLatinNames: a value the model keeps in Latin script after
        // being asked once is a name by its own account — accept and cache it.
        // acceptPluralGaps: asked once for the missing forms; a second answer
        // without them is accepted and reported, never asked a third time.
        const retryValidation = validateTranslations(retryResult, sourceFlat, pairConfig,
          { acceptLatinNames: true, acceptPluralGaps: true });
        // The second answer is held to the shared-output rule too (against
        // what was accepted so far): the same memorized sentence again stays
        // refused.
        for (const f of sharedFailure({ ...retryValidation.validated }, retryResult)) {
          delete retryValidation.validated[f.key];
          retryValidation.failures.push(f);
        }
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

  // A plural message the retry did not improve on (no answer, or one the
  // gate refused for another reason) keeps its first answer: it passed every
  // check except the missing forms, and it was paid for. Reported below.
  failures = failures.filter((f) => {
    if (pluralGapKeys.has(f.key) && typeof translated[f.key] === 'string' && apiKeys.has(f.key)) {
      validated[f.key] = translated[f.key];
      return false;
    }
    return true;
  });

  if (failures.length > 0) {
    logGateFailures(failures, pairKey);
  }

  // Every accepted plural message that lacks forms the target uses — the
  // caller says so (and a gettext catalog marks the repeated forms).
  const gapsByKey = pluralGapsOf(validated, sourceFlat, targetCode, pairConfig.pluralSlots || null);

  // Step 4: TM store — only gate-validated values that came from the API.
  // TM hits are already cached; unvalidated output must never enter the TM.
  for (const [k, v] of Object.entries(validated)) {
    if (apiKeys.has(k) && typeof v === 'string' && typeof tmText[k] === 'string') {
      storeTM(tm, tmText[k], targetCode, tmKey, v);
    }
  }
  // Which method key produced each accepted value: this pair's on a fresh
  // answer, the serving entry's on a cache hit (another model's, for a
  // model carry-over). The lock records it (lib/locale-state.js `by`), so
  // `status` names the model that wrote a value instead of guessing from
  // identical cache entries (Round 6, Next.js persona).
  const producedBy = {};
  for (const k of Object.keys(validated)) {
    producedBy[k] = apiKeys.has(k) ? tmKey : (tmHitBy[k] || tmKey);
  }
  if (sharedOutputs) {
    sharedOutputs.add(Object.entries(validated)
      .flatMap(([k, v]) => (typeof v === 'string' && typeof sourceFlat[k] === 'string' ? sharedOutputItems(k, sourceFlat[k], v) : [])));
  }

  return {
    translated: Object.keys(validated).length > 0 ? validated : null,
    tmHitCount,
    failures,
    apiCalled,
    apiReturnedNull,
    sentCount,
    retriedCount,
    pluralGaps: gapsByKey,
    producedBy,
    // Accepted values that are the method's own answer THIS run (not a
    // cache hit): with options.pluralForms, a borrowed plural form here was
    // asked for under its own identity — the lock records that (sync).
    answeredKeys: Object.keys(validated).filter(k => apiKeys.has(k)),
    sentKeys: toSend,
    heldKeys: [...new Set(heldKeys)].filter(k => !(k in validated)),
    refusedKeys: failures.filter(f => askedKeys.has(f.key) && f.value !== undefined).map(f => f.key),
  };
}

/**
 * translateAndValidate with the pair's FALLBACK method (lib/fallback.js).
 *
 * The ladder, per key:
 *   1. the pair's own TM entry (served by translateAndValidate, gate-checked);
 *   2. the fallback's TM entry — text the fallback translated on an earlier
 *      run is reused (gate-checked; a failing entry is evicted), so the
 *      primary is not re-asked, and re-billed, for it on every re-run;
 *   3. the pair's own method (with its one corrective retry);
 *   4. for every key 3 left untranslated — gate-refused, or missing from the
 *      response — ONE pass through the fallback's method, through the SAME
 *      quality gate (with its own corrective retry). Accepted values are
 *      cached under the fallback's own TM key.
 *
 * A key both methods fail stays failed exactly as without a fallback: the
 * caller leaves it untranslated and keeps its lock entry, and verify lists it.
 *
 * A primary that returned nothing at all is exactly when a fallback helps:
 * the fallback still runs, and that the primary failed wholesale is said
 * out loud. `skipPrimary` sends everything the pair's own cache does not
 * hold straight to the fallback (the primary already returned nothing for an
 * earlier file of this locale; its cached translations are still good).
 *
 * --max-cost: the fallback batch is priced (its cache misses only) before it
 * runs; `budget` refuses it when the run's committed spend plus this batch
 * would pass the cap, or when the fallback has no price (lib/fallback.js
 * createFallbackBudget). A refused batch leaves the keys failed.
 *
 * Without `pairConfig.fallback` this IS translateAndValidate (plus a null
 * `fallback` report).
 *
 * @param {string[]} stringKeys
 * @param {object} sourceFlat
 * @param {object} pairConfig - Resolved pair (lib/pairs.js); `fallback` optional
 * @param {string} pairKey
 * @param {object} options - translateAndValidate options, plus:
 * @param {boolean} [options.skipPrimary=false]
 * @param {object|null} [options.budget=null] - createFallbackBudget()
 * @param {Set<string>} [options.noSendPrimary] - Keys the pair's own method
 *   refused before (lib/locale-state.js): its cache is consulted, it is not
 *   asked; with a fallback, they go to the fallback.
 * @param {Set<string>} [options.noSendFallback] - Keys the fallback refused before
 * @returns {Promise<TranslateResult & { fallback: import('./fallback.js').FallbackReport|null,
 *   refusedBy: Object<string, string[]> }>} refusedBy: key → the method keys
 *   whose answer the gate refused this run
 */
export async function translateWithFallback(stringKeys, sourceFlat, pairConfig, pairKey, options) {
  const {
    skipPrimary = false, budget = null, noSendPrimary = new Set(), noSendFallback = new Set(), ...pipeline
  } = options;
  const fb = pairConfig.fallback || null;
  if (!fb) {
    const result = await translateAndValidate(stringKeys, sourceFlat, pairConfig, pairKey, { ...pipeline, noSendKeys: noSendPrimary });
    const primaryKey = tmMethodKey(pairConfig);
    const refusedBy = {};
    for (const k of result.refusedKeys || []) refusedBy[k] = [primaryKey];
    return { ...result, fallback: null, refusedBy };
  }

  const { tm, targetCode } = pipeline;
  const sharedOutputs = pipeline.sharedOutputs || null;
  const isString = (k) => typeof sourceFlat[k] === 'string';
  const textOf = (k) => tmSourceText(k, sourceFlat[k], pipeline.pluralForms?.[k] || null);
  const primaryKey = tmMethodKey(pairConfig);
  const fallbackKey = tmMethodKey(fb);
  const report = {
    method: fb.method,
    model: fb.model || null,
    attempted: 0,
    accepted: 0,
    cached: 0,
    primaryFailedWholesale: skipPrimary,
    skipped: null,
    // The primary's own accepted answers this run, and why the keys sent to
    // the fallback were not its (lib/fallback.js warnFallbackMajority).
    primaryAccepted: 0,
    primaryReasons: {},
  };

  // A cache read outside translateAndValidate: entries for `keys` under
  // `tmKey`, gate-checked against `cfg` like any TM hit (a short Latin value
  // already settled as a name stays accepted); a failing entry is evicted.
  const servedBy = {};
  const serveCached = (keys, cfg, tmKey) => {
    const candidates = {};
    for (const k of keys) {
      const cached = lookupTM(tm, textOf(k), targetCode, tmKey);
      if (cached !== null) candidates[k] = cached;
    }
    const served = {};
    for (const k of Object.keys(candidates)) servedBy[k] = servingMethodKey(tm, textOf(k), targetCode, tmKey) || tmKey;
    if (Object.keys(candidates).length === 0) return served;
    const { validated, failures } = validateTranslations(candidates, sourceFlat, cfg);
    Object.assign(served, validated);
    const evictor = createTMEvictor(tm);
    for (const f of failures) {
      if (f.nameOrLabel || f.pluralGap) { served[f.key] = candidates[f.key]; continue; }
      evictor.evictProducing(textOf(f.key), targetCode, candidates[f.key], [tmKey]);
    }
    // A cache read is held to the shared-output rule too: entries another
    // tool cached one text at a time (the MCP translate tool, an earlier
    // run) used to be written straight from this cache, three different
    // clinical prompts as one sentence (Round 5, hospital persona). A
    // suspect entry is evicted, so the key goes on to the gated methods.
    if (sharedOutputs) {
      const items = Object.entries(candidates).flatMap(([k, v]) => sharedOutputItems(k, sourceFlat[k], v));
      const suspects = sharedOutputs.suspects(items);
      for (const k of suspects.keys()) {
        if (!(k in served)) continue;
        evictor.evictProducing(textOf(k), targetCode, served[k], [tmKey]);
        delete served[k];
      }
      sharedOutputs.add(Object.entries(served).flatMap(([k, v]) => sharedOutputItems(k, sourceFlat[k], v)));
    }
    return served;
  };

  // Step 2 of the ladder: the fallback's cache, for keys the pair's own
  // cache does not hold. (With the primary known to be down, its own cache
  // is still good: those hits are served, and only the rest go on.)
  const fromCache = {};
  let primaryCacheHits = {};
  if (skipPrimary) {
    primaryCacheHits = serveCached(stringKeys.filter(isString), pairConfig, primaryKey);
  } else {
    const notInOwnCache = stringKeys.filter(k => isString(k) && lookupTM(tm, textOf(k), targetCode, primaryKey) === null);
    // (A key the fallback refused before is still served from its cache
    // here when it holds a valid entry — holding back stops calls, not reads.)
    Object.assign(fromCache, serveCached(notInOwnCache, fb, fallbackKey));
    report.cached = Object.keys(fromCache).length;
    if (report.cached > 0) output.info(`[TM] ${report.cached} key(s) served from the fallback's cache (${fb.method})`);
  }

  // Step 3: the pair's own method, for everything else.
  const primaryKeys = skipPrimary ? [] : stringKeys.filter(k => !(k in fromCache));
  let primary = {
    translated: null,
    producedBy: {},
    tmHitCount: Object.keys(primaryCacheHits).length,
    failures: [],
    apiCalled: false,
    apiReturnedNull: false,
    sentCount: 0,
    retriedCount: 0,
    pluralGaps: {},
    heldKeys: [],
    refusedKeys: [],
  };
  if (primaryKeys.length > 0) {
    primary = await translateAndValidate(primaryKeys, sourceFlat, pairConfig, pairKey, { ...pipeline, noSendKeys: noSendPrimary });
  }
  const translated = { ...primaryCacheHits, ...fromCache, ...(primary.translated || {}) };
  const notTranslated = (skipPrimary ? stringKeys : primaryKeys).filter(k => isString(k) && !(k in translated));
  // Refused before by the fallback too: neither method is asked.
  const heldBoth = notTranslated.filter(k => noSendFallback.has(k) && (skipPrimary || noSendPrimary.has(k)));
  const toFallback = notTranslated.filter(k => !heldBoth.includes(k));
  if (!skipPrimary && primary.apiReturnedNull && !primary.translated) report.primaryFailedWholesale = true;

  const done = (fallbackResult = null) => {
    const merged = { ...translated, ...(fallbackResult?.translated || {}) };
    const fbFailures = (fallbackResult?.failures || []).filter(f => !(f.key in merged));
    const fbFailed = new Set(fbFailures.map(f => f.key));
    const failures = [
      ...primary.failures.filter(f => !(f.key in merged) && !fbFailed.has(f.key)),
      ...fbFailures,
    ];
    // Who refused what this run (the lock remembers it per key).
    const refusedBy = {};
    for (const k of primary.refusedKeys || []) if (!(k in merged)) refusedBy[k] = [primaryKey];
    for (const k of fallbackResult?.refusedKeys || []) {
      if (!(k in merged)) refusedBy[k] = [...(refusedBy[k] || []), fallbackKey];
    }
    // Not sent anywhere: refused before by every method that could be asked.
    const heldKeys = [...new Set([...heldBoth, ...(fallbackResult?.heldKeys || [])])].filter(k => !(k in merged));
    // Which method key produced each value (the cache entry, or the method asked).
    const producedBy = {};
    for (const k of Object.keys(merged)) {
      producedBy[k] = fallbackResult?.producedBy?.[k] || primary.producedBy?.[k] || servedBy[k] || primaryKey;
    }
    // The method's own answers this run (the fallback's replace the primary's).
    const fbAnswered = new Set(fallbackResult?.answeredKeys || []);
    const fbTranslated = fallbackResult?.translated || {};
    // What the fallback produced (its answers and its cache): named in the
    // [FALLBACK] line (lib/fallback.js printFallbackReport).
    report.produced = Object.keys(merged).filter(k => producedBy[k] === fallbackKey);
    // The pair's own method's answers that were kept (not its cache hits).
    report.primaryAccepted = (primary.answeredKeys || []).filter(k => k in merged && !(k in fbTranslated)).length;
    const answeredKeys = [
      ...(primary.answeredKeys || []).filter(k => k in merged && !(k in fbTranslated)),
      ...[...fbAnswered].filter(k => k in merged),
    ];
    return {
      producedBy,
      answeredKeys,
      translated: Object.keys(merged).length > 0 ? merged : null,
      tmHitCount: primary.tmHitCount + report.cached + (fallbackResult?.tmHitCount || 0),
      failures,
      apiCalled: primary.apiCalled || !!fallbackResult?.apiCalled,
      apiReturnedNull: skipPrimary || primary.apiReturnedNull,
      sentCount: (primary.sentCount || 0) + (fallbackResult?.sentCount || 0),
      retriedCount: (primary.retriedCount || 0) + (fallbackResult?.retriedCount || 0),
      pluralGaps: pluralGapsOf(merged, sourceFlat, targetCode, pairConfig.pluralSlots || null),
      fallbackReturnedNull: !!fallbackResult?.apiReturnedNull && !fallbackResult?.translated,
      fallback: report,
      sentKeys: [...(primary.sentKeys || []), ...(fallbackResult?.sentKeys || [])],
      heldKeys,
      refusedKeys: Object.keys(refusedBy),
      refusedBy,
    };
  };

  if (toFallback.length === 0) return done();

  if (report.primaryFailedWholesale) {
    output.warn(
      `${pairKey}: the primary method (${pairConfig.method}) returned no results`
      + `${skipPrimary ? ' for an earlier file of this locale' : ''} — sending ${toFallback.length} key(s) `
      + `to the fallback (${fb.method}).`
    );
  }

  // --max-cost: price what the fallback will actually send (its cache misses).
  if (budget) {
    const texts = {};
    for (const k of toFallback) texts[k] = textOf(k);
    const { misses } = partitionByTM(tm, texts, toFallback, targetCode, fallbackKey);
    const verdict = await budget.approve(misses.length, fb);
    if (!verdict.ok) {
      report.skipped = { reason: verdict.reason, items: [...toFallback] };
      return done();
    }
  }

  report.attempted = toFallback.length;
  // Why each key goes to the fallback, counted: the gate's refusal of the
  // primary's answer, no answer, or a refusal on an earlier sync.
  const primaryFailure = new Map();
  for (const f of primary.failures || []) if (!primaryFailure.has(f.key)) primaryFailure.set(f.key, f);
  for (const k of toFallback) {
    const f = primaryFailure.get(k);
    notePrimaryReason(report, f
      ? refusalCategory(f.reason, { sharedOutput: !!f.sharedOutput, memorized: !!f.memorized })
      : refusalCategory(null, { heldBefore: !skipPrimary && noSendPrimary.has(k), noAnswer: true }));
  }
  const fallbackResult = await translateAndValidate(
    toFallback, sourceFlat, fb, `${pairKey} (fallback: ${fb.method})`,
    { ...pipeline, onProgress: null, noSendKeys: noSendFallback },
  );
  const result = done(fallbackResult);
  report.accepted = toFallback.filter(k => result.translated && k in result.translated).length;
  return result;
}
