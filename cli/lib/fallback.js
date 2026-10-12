/**
 * fallback.js — the per-pair fallback method: shared machinery for every lane.
 *
 * A pair may name a second method (`"fallback": { "method": … }`, resolved by
 * lib/pairs.js resolveFallbackForPair into a full pair config). The pair's own
 * method runs first; what it could not translate safely — keys the quality
 * gate refused or that came back empty, Markdown blocks it dropped or damaged,
 * front-matter fields it hollowed — goes to the fallback ONCE, through the
 * same gate. What the fallback translates is cached under its own TM key, so
 * the cache always says which method produced a value. What both fail stays
 * failed exactly as without a fallback ('[EN] ' remains the content lanes'
 * last resort).
 *
 * The TM ladder, everywhere: the pair's cache → the fallback's cache → the
 * pair's method → the fallback's method. Text the fallback already paid for
 * is reused, not re-sent to the primary on every re-run (re-ask the primary
 * with --fresh or --retranslate).
 *
 * This module holds what the key-value, Hugo-content and Docusaurus lanes
 * share: the --max-cost guard for fallback batches, the per-pair tally and its
 * [FALLBACK] report line, and the content-lane helpers (front-matter fields,
 * Markdown blocks, whole pages). The key-value pipeline itself is
 * translateWithFallback in lib/translate-pair.js.
 */

import { estimateCost } from './pairs.js';
import { lookupTM, lookupTMValidated, tmMethodKey } from './tm.js';
import { createTMEvictor } from './tm-evict.js';
import { translatableBlockSources } from './content-estimate.js';
import { checkContentPreservation, contentGateFault, sharedOutputReason, isKeepAsWrittenFault } from './validate.js';
import { restoreBlocks, hasOrphanedPlaceholders, PLACEHOLDER_PREFIX, PLACEHOLDER_SUFFIX } from './content.js';
import { contentKeyUnits } from './config.js';
import { output } from './output.js';
import { refusalCategory, notePrimaryReason } from './refusal-category.js';

export { refusalCategory, notePrimaryReason };

// ── TM keys ──────────────────────────────────────────────────────────

/**
 * The TM method keys whose entries a pair's output may have come from: its
 * own, then its fallback's. Echo confirmation (lib/diff.js) and verify must
 * consult both — a value the fallback produced is cached under the fallback.
 *
 * @param {object} pairConfig
 * @returns {string[]}
 */
export function tmKeysForPair(pairConfig) {
  const keys = [tmMethodKey(pairConfig)];
  if (pairConfig?.fallback) keys.push(tmMethodKey(pairConfig.fallback));
  return keys;
}

/**
 * True when the TM holds `value` for `text` under any of `tmKeys` — the
 * "the pipeline produced this" proof the echo checks need.
 *
 * @param {object} tm
 * @param {string} text - Source text as cached (tmSourceText)
 * @param {string} locale
 * @param {string[]} tmKeys - From tmKeysForPair
 * @param {string} value
 * @returns {boolean}
 */
export function tmHoldsValue(tm, text, locale, tmKeys, value) {
  return tmKeys.some(k => lookupTM(tm, text, locale, k) === value);
}

// ── Cost guard ───────────────────────────────────────────────────────

/**
 * The --max-cost guard for fallback batches.
 *
 * The pre-run estimate cannot know which keys or blocks the primary will
 * fail, so fallback spend is not in it. Each fallback batch is priced just
 * before it runs, with the same estimator the run's estimate used
 * (pairs.js estimateCost → the method's own estimateCost). Under a cap, a
 * batch runs only if the spend already committed — the pre-run estimate the
 * cap admitted, plus every fallback batch approved so far — plus this one
 * stays within the cap. An unpriced fallback is refused: unknown is not
 * free, the same rule the pre-run gate applies to the primary.
 *
 * Concurrency: approvals from parallel locales await the estimate, then
 * check-and-commit synchronously, so two batches cannot both slip under the
 * cap.
 *
 * @param {{ maxCost?: number|null, committed?: number }} [opts]
 * @returns {{ maxCost: number|null, readonly committed: number,
 *   approve: (units: number, fallbackConfig: object) => Promise<{ ok: boolean, estimate: number|null, reason?: string }> }}
 */
export function createFallbackBudget({ maxCost = null, committed = 0, cwd = null } = {}) {
  let spent = Number.isFinite(committed) ? committed : 0;
  return {
    maxCost,
    get committed() { return spent; },
    async approve(units, fallbackConfig) {
      if (maxCost === null || units <= 0) return { ok: true, estimate: null };
      // cwd: the project, where a local fallback's endpoint may be set (.env).
      const estimate = await estimateCost(units, fallbackConfig, cwd ? { cwd } : {});
      const cost = estimate?.estimatedCost ?? null;
      if (cost === null) {
        return {
          ok: false,
          estimate: null,
          reason: `its cost cannot be estimated (${estimate?.source || 'unknown pricing'}) and --max-cost is set — unknown is not free`,
        };
      }
      if (spent + cost > maxCost) {
        return {
          ok: false,
          estimate: cost,
          reason: `~$${cost.toFixed(4)} on top of the ~$${spent.toFixed(4)} already committed would pass --max-cost $${maxCost.toFixed(4)}`,
        };
      }
      spent += cost;
      return { ok: true, estimate: cost };
    },
  };
}

/**
 * Key-equivalents for a run of source characters — the unit the content
 * lanes' estimates price (lib/cost-report.js priceContentChars).
 *
 * @param {number} chars
 * @returns {number}
 */
export function charsToKeyUnits(chars, pairConfig = {}) {
  return contentKeyUnits(chars, pairConfig);
}

// ── Reporting ────────────────────────────────────────────────────────

/**
 * A per-call fallback report (one file, one batch). Callers add these into
 * a per-pair tally (addToTally) and print one [FALLBACK] line per pair.
 *
 * @param {object} fallbackConfig
 * @returns {FallbackReport}
 *
 * @typedef {object} FallbackReport
 * @property {string} method - The fallback's method
 * @property {string|null} model
 * @property {number} attempted - Units the primary failed and the fallback was asked to translate
 * @property {number} accepted - Of those, how many the fallback translated and the gate accepted
 * @property {number} cached - Units served from the fallback's cache (the primary was not re-asked)
 * @property {boolean} primaryFailedWholesale - The primary returned nothing at all
 * @property {{ reason: string, items: string[] }|null} skipped - Set when the
 *   fallback did not run (--max-cost); items are the keys/segments left failing
 * @property {number} primaryAccepted - Units the pair's OWN method answered
 *   this run and the gate accepted (cache hits not counted) — with
 *   `accepted`, the run's fresh translations for the pair
 * @property {Object<string, number>} primaryReasons - Why the units sent to
 *   the fallback were not the primary's: a refusal in a few words
 *   (refusalCategory) → how many
 */
export function newFallbackReport(fallbackConfig) {
  return {
    method: fallbackConfig.method,
    model: fallbackConfig.model || null,
    attempted: 0,
    accepted: 0,
    cached: 0,
    primaryFailedWholesale: false,
    skipped: null,
    // What the fallback produced (keys, or pages for the content lanes) —
    // named in the [FALLBACK] line, so its output is findable in the files.
    produced: [],
    primaryAccepted: 0,
    primaryReasons: {},
  };
}

/**
 * Above this share of a run's fresh translations for a pair, the fallback
 * wrote most of it, and sync says so in one warning (warnFallbackMajority) —
 * and `status` beside the share of the files it holds. A fallback is the
 * second opinion for what the pair's method cannot translate safely; when it
 * writes most of the output, what ships is the fallback's work (Round 11,
 * school persona: every app string and 5 of 7 newsletter segments came from
 * the weakest method measured, and nothing said so in context).
 */
export const FALLBACK_MAJORITY_SHARE = 0.5;


/**
 * Fold one call's report into a pair's running tally (mutates `tally`).
 *
 * @param {FallbackReport} tally
 * @param {FallbackReport|null} report
 * @returns {FallbackReport}
 */
export function addToTally(tally, report) {
  if (!report) return tally;
  tally.attempted += report.attempted;
  tally.accepted += report.accepted;
  tally.cached += report.cached;
  tally.primaryAccepted = (tally.primaryAccepted || 0) + (report.primaryAccepted || 0);
  for (const [why, n] of Object.entries(report.primaryReasons || {})) {
    tally.primaryReasons = tally.primaryReasons || {};
    tally.primaryReasons[why] = (tally.primaryReasons[why] || 0) + n;
  }
  if (Array.isArray(report.produced) && report.produced.length > 0) {
    tally.produced = tally.produced || [];
    for (const k of report.produced) if (!tally.produced.includes(k)) tally.produced.push(k);
  }
  if (report.primaryFailedWholesale) tally.primaryFailedWholesale = true;
  if (report.skipped) {
    tally.skipped = tally.skipped || { reason: report.skipped.reason, items: [] };
    tally.skipped.items.push(...report.skipped.items);
  }
  return tally;
}

/**
 * The machine-readable form of a tally (the --json summary's per-locale
 * `fallback` object).
 *
 * @param {FallbackReport} tally
 * @returns {object}
 */
export function fallbackSummary(tally) {
  return {
    method: tally.method,
    model: tally.model,
    attempted: tally.attempted,
    accepted: tally.accepted,
    failed: tally.attempted - tally.accepted,
    cached: tally.cached,
    // The pair's own method's accepted answers this run (with `accepted`:
    // this run's fresh translations), and why the rest went to the fallback.
    primaryAccepted: tally.primaryAccepted || 0,
    ...(tally.primaryReasons && Object.keys(tally.primaryReasons).length > 0 && { primaryReasons: { ...tally.primaryReasons } }),
    primaryFailedWholesale: tally.primaryFailedWholesale,
    // Keys (or pages) whose text the fallback produced this run.
    ...(Array.isArray(tally.produced) && tally.produced.length > 0 && { produced: [...tally.produced] }),
    ...(tally.skipped && { skipped: { reason: tally.skipped.reason, items: [...tally.skipped.items] } }),
  };
}

/**
 * Print a pair's [FALLBACK] line(s). Silent when the fallback had nothing
 * to do — a pair whose own method translated everything says nothing here.
 *
 *   [FALLBACK] en:crk — 6 key(s) the primary (api) could not translate
 *   safely → translated by llm-coached (4 accepted, 2 still failing)
 *
 * @param {string} pairKey
 * @param {string} primaryMethod
 * @param {FallbackReport} tally
 * @param {{ unit?: string }} [opts] - "key(s)" or "content segment(s)"
 */
export function printFallbackReport(pairKey, primaryMethod, tally, { unit = 'key(s)', producedLabel = 'keys' } = {}) {
  if (!tally) return;
  const still = tally.attempted - tally.accepted;
  // Which ones: the files do not say what the fallback wrote (Round 8 school
  // + hospital personas), so the line names them, and status counts them.
  const produced = Array.isArray(tally.produced) ? tally.produced : [];
  const named = produced.length > 0
    ? ` — ${producedLabel}: ${produced.slice(0, 8).join(', ')}${produced.length > 8 ? `, +${produced.length - 8} more` : ''}`
      + ' (`champollion status` counts what each locale holds from the fallback)'
    : '';
  if (tally.skipped) {
    const items = tally.skipped.items;
    const shown = items.slice(0, 10).join(', ') + (items.length > 10 ? `, +${items.length - 10} more` : '');
    output.warn(
      `[FALLBACK] ${pairKey} — ${items.length} ${unit} the primary (${primaryMethod}) could not translate safely; `
      + `the fallback (${tally.method}) was skipped: ${tally.skipped.reason}. Still untranslated: ${shown}`
    );
  }
  if (tally.attempted > 0) {
    const line = `[FALLBACK] ${pairKey} — ${tally.attempted} ${unit} the primary (${primaryMethod}) could not `
      + `translate safely → translated by ${tally.method} (${tally.accepted} accepted, ${still} still failing)`
      + (tally.cached > 0 ? `; ${tally.cached} more served from its cache` : '')
      + named;
    if (still > 0) output.warn(line);
    else output.info(line);
  } else if (tally.cached > 0) {
    output.info(
      `[FALLBACK] ${pairKey} — ${tally.cached} ${unit} served from the fallback's cache (${tally.method}); `
      + `the primary (${primaryMethod}) was not asked again${named}`
    );
  }
}

/**
 * When the fallback wrote most of a run's fresh translations for a pair
 * (more than FALLBACK_MAJORITY_SHARE of them — the primary's accepted
 * answers plus the fallback's), say it once, plainly: how many of how many,
 * by which method and model, why the primary's answers were not used
 * (counted), and what to consider. Silent otherwise, and for a run that
 * translated nothing fresh (everything from the cache: `status` carries the
 * standing share of the files).
 *
 * @param {string} pairKey
 * @param {string} primaryMethod
 * @param {FallbackReport} tally
 * @param {{ unit?: string }} [opts] - "key(s)" or "content segment(s)"
 * @returns {{ fromFallback: number, translated: number, share: number }|null} what was said (null: nothing)
 */
export function warnFallbackMajority(pairKey, primaryMethod, tally, { unit = 'key(s)' } = {}) {
  if (!tally) return null;
  const fromFallback = tally.accepted || 0;
  const translated = (tally.primaryAccepted || 0) + fromFallback;
  if (translated === 0 || fromFallback / translated <= FALLBACK_MAJORITY_SHARE) return null;
  const who = `${tally.method}${tally.model ? `, model ${tally.model}` : ''}`;
  const reasons = Object.entries(tally.primaryReasons || {}).sort((a, b) => b[1] - a[1])
    .map(([why, n]) => `${why} (${n})`).join('; ');
  output.warn(
    `[FALLBACK] ${pairKey} — most of this run's translations came from the fallback: ${fromFallback} of ${translated} ${unit} `
    + `were written by ${who}, not by the pair's method (${primaryMethod})`
    + (reasons ? `. Why ${primaryMethod}'s answers were not used, for the ${tally.attempted} ${unit} sent to the fallback: ${reasons}` : '')
    + `. What ships is the fallback's work. Consider: ${primaryMethod} may not suit these strings; check what was written `
    + '(`champollion verify` checks structure — a speaker checks meaning); or a stronger fallback ("fallback" in the pair\'s "pairs" entry).',
  );
  return { fromFallback, translated, share: fromFallback / translated };
}

// ── Content lanes ────────────────────────────────────────────────────

/**
 * Read-time validation shared by every content TM read (see lookupTMValidated):
 * the gate a fresh answer passes (lib/validate.js contentGateFault), so a
 * cached block the gate refuses today — a heading turned into a sentence,
 * cached before the lane checked length — is evicted, not served.
 */
const passesGate = (pairConfig) => (src, cached) => !contentGateFault(src, cached, pairConfig);

/**
 * TM ladder for one content segment (a block, a whole body): the pair's own
 * cache, then its fallback's. Each read is validated; a failing entry is
 * evicted and reported as a miss.
 *
 * @returns {{ text: string, fromFallback: boolean }|null}
 */
export function lookupContentTM(tm, source, code, pairConfig, { countCarry = true, gate = true } = {}) {
  // gate false: a look for the repeat check, which names what it refuses —
  // the gate still applies when the entry is served.
  const check = (cfg) => (gate ? passesGate(cfg) : () => true);
  const own = lookupTMValidated(tm, source, code, tmMethodKey(pairConfig), check(pairConfig), { countCarry });
  if (own !== null) return { text: own, fromFallback: false };
  if (!pairConfig.fallback) return null;
  const fb = lookupTMValidated(tm, source, code, tmMethodKey(pairConfig.fallback), check(pairConfig.fallback), { countCarry });
  return fb !== null ? { text: fb, fromFallback: true } : null;
}

// ── Cached content and the repeat check ──────────────────────────────

/**
 * Items through the locale's different-inputs-same-output index; a suspect
 * is evicted where it lives — every entry, under the pair's or its
 * fallback's key, that holds that text for that source (lib/tm-evict.js).
 *
 * @param {Array<{ key: string, source: string, value: string }>} items
 * @returns {Set<string>} Keys refused (and evicted)
 */
function refuseRepeatedCached(items, { sharedOutputs, tm, code, pairConfig }) {
  const refused = new Set();
  if (items.length === 0) return refused;
  const suspects = sharedOutputs.suspects(items);
  if (suspects.size === 0) return refused;
  const evictor = createTMEvictor(tm);
  const keys = tmKeysForPair(pairConfig);
  for (const it of items) {
    if (!suspects.has(it.key)) continue;
    refused.add(it.key);
    evictor.evictProducing(it.source, code, it.value, keys);
  }
  return refused;
}

/**
 * A page's cached content — its front-matter fields, its blocks, its whole
 * body — through the repeat check (lib/validate.js SharedOutputIndex) in ONE
 * batch, before the lane serves any of it: the way a key-value file's cached
 * keys are checked together (lib/translate-pair.js). Cache hits used to skip
 * the check: one memorized sentence cached for three different paragraphs
 * was re-served by every sync, and only `verify` caught it on disk.
 *
 * A repeat is evicted where it lives, so the lane's own cache lookups miss
 * it and it is translated again with the misses — through the same check.
 * A whole-body entry holding a repeated block is evicted too (the body is
 * then translated block by block, where only the repeats are asked again).
 * What passes is recorded in the index, so later answers are compared with
 * it. Keys are named as `verify` and the fresh path name them:
 * "<label> front matter:<field>" and "<label>#<n>" (n = place among the
 * page's translatable blocks). A whole body whose block count differs from
 * its source's cannot be compared block by block (verify skips it too).
 *
 * @param {object} p
 * @param {string} p.label - "content:<file>"
 * @param {Record<string, string>} p.fields - field → source text: the fields the lane looks up
 * @param {string} p.body - Source body ('' = none)
 * @param {Set<number>} [p.skipBlocks] - Block places the lane does not serve from the cache (kept by hand)
 * @param {boolean} [p.wholeBody=true] - false when the lane does not serve a whole-body hit
 * @param {object} p.tm
 * @param {string} p.code - Target locale
 * @param {object} p.pairConfig
 * @param {import('./validate.js').SharedOutputIndex|null} p.sharedOutputs
 * @returns {string[]} What was refused, for the lane's warning ("title", "paragraph 2")
 */
export function refuseRepeatedCachedPage({
  label, fields = {}, body = '', skipBlocks = new Set(), wholeBody = true, tm, code, pairConfig, sharedOutputs,
}) {
  if (!sharedOutputs || !tm) return [];
  // A look, not a serve: a carried (other-model) hit is counted when served.
  const peek = (source) => lookupContentTM(tm, source, code, pairConfig, { countCarry: false, gate: false });
  const items = [];
  for (const [field, source] of Object.entries(fields)) {
    if (typeof source !== 'string') continue;
    const hit = peek(source);
    if (hit) items.push({ key: `${label} front matter:${field}`, source, value: hit.text, name: field });
  }
  const sources = typeof body === 'string' && body.trim() ? translatableBlockSources(body) : [];
  const blockKeys = new Set();
  sources.forEach((source, i) => {
    if (skipBlocks.has(i)) return;
    const hit = peek(source);
    if (!hit) return;
    items.push({ key: `${label}#${i + 1}`, source, value: hit.text, name: `paragraph ${i + 1}` });
    blockKeys.add(`${label}#${i + 1}`);
  });
  let whole = null;
  const wholeKeys = [];
  if (wholeBody && sources.length > 0) {
    const hit = peek(body);
    const outs = hit ? translatableBlockSources(hit.text) : [];
    if (hit && outs.length === sources.length) {
      whole = hit;
      sources.forEach((source, i) => {
        const key = `${label}#${i + 1}`;
        wholeKeys.push(key);
        // The block's own entry, when there is one, speaks for it.
        if (!blockKeys.has(key)) items.push({ key, source, value: outs[i], name: `paragraph ${i + 1}` });
      });
    }
  }
  const ctx = { sharedOutputs, tm, code, pairConfig };
  const refused = refuseRepeatedCached(items, ctx);
  if (whole && wholeKeys.some(k => refused.has(k))) {
    createTMEvictor(tm).evictProducing(body, code, whole.text, tmKeysForPair(pairConfig));
  }
  sharedOutputs.add(items.filter(it => !refused.has(it.key)));
  return items.filter(it => refused.has(it.key)).map(it => it.name);
}

/**
 * Serve front-matter fields the pair's own cache missed from its fallback's
 * cache (validated). No-op without a fallback.
 *
 * @param {object} tm
 * @param {Record<string,string>} fields - field → source text
 * @param {string[]} misses - Fields the pair's own cache did not hold
 * @param {string} code
 * @param {object} pairConfig
 * @returns {{ hits: Record<string,string>, misses: string[] }}
 */
export function serveFieldsFromFallbackCache(tm, fields, misses, code, pairConfig) {
  if (!pairConfig.fallback || misses.length === 0) return { hits: {}, misses };
  const fbKey = tmMethodKey(pairConfig.fallback);
  const hits = {};
  const rest = [];
  for (const field of misses) {
    const cached = lookupTMValidated(tm, fields[field], code, fbKey, passesGate(pairConfig.fallback));
    if (cached !== null) hits[field] = cached;
    else rest.push(field);
  }
  return { hits, misses: rest };
}

/**
 * Translate the front-matter fields the TM did not hold: the pair's method,
 * then — for every field it returned nothing for or hollowed — its fallback.
 *
 * NOTHING IS CACHED HERE. The lanes promise "nothing was written or cached"
 * when a field fails, so the TM stores come back in `stores` and the caller
 * commits them only once no field is left failing.
 *
 * Without a fallback this behaves exactly as the lanes always did: a null
 * response is `noResults`, the first hollowed field is reported, a field
 * missing from the response is left as it was.
 *
 * @param {object} p
 * @param {Record<string,string>} p.fields - field → source text
 * @param {string[]} p.misses - Fields to translate
 * @param {object} p.pairConfig
 * @param {(fields: string[], config: object) => Promise<object|null>} p.translate
 *   - The lane's translateBatch call for a given pair config
 * @param {object|null} [p.budget] - createFallbackBudget(); null = no cap
 * @param {Set<string>} [p.fallbackOnly] - Fields the pair's method refused
 *   before (lib/content-refusals.js): not sent to it, only to the fallback
 * @returns {Promise<{ translated: Record<string,string>, stores: Array<{text: string, value: string, tmKey: string}>,
 *   hollowed: Array<{field: string, reason: string, value: string, fallbackReason?: string}>,
 *   noResults: boolean, report: FallbackReport|null, refusedBy: Record<string, string[]> }>}
 *   refusedBy: field → the method keys whose answer the gate refused, for the
 *   fields left untranslated (the lane remembers them)
 */
export async function translateFieldsWithFallback({
  fields, misses, pairConfig, translate, budget = null, sharedOutputs = null, label = 'front matter',
  fallbackOnly = new Set(),
}) {
  const fb = pairConfig.fallback || null;
  const primaryKey = tmMethodKey(pairConfig);
  const translated = {};
  const stores = [];
  /** @type {Map<string, {reason: string|null, value?: string}>} field → why it failed */
  const failed = new Map();
  const fieldKey = (field) => `${label}:${field}`;
  // A field answered with the text the model gave for other source strings
  // (lib/validate.js SharedOutputIndex) is refused like a hollowed one.
  const sharedCheck = (candidates) => {
    if (!sharedOutputs || candidates.length === 0) return new Map();
    const suspects = sharedOutputs.suspects(candidates.map(([field, value]) => ({ key: fieldKey(field), source: fields[field], value })));
    return new Map(candidates.filter(([field]) => suspects.has(fieldKey(field)))
      .map(([field]) => [field, sharedOutputReason(suspects.get(fieldKey(field)))]));
  };
  const remember = (pairs) => {
    if (sharedOutputs) sharedOutputs.add(pairs.map(([field, value]) => ({ key: fieldKey(field), source: fields[field], value })));
  };

  // Fields the pair's method refused before go to the fallback only.
  const primaryAsked = fb ? misses.filter(f => !fallbackOnly.has(f)) : misses;
  const out = primaryAsked.length > 0 ? await translate(primaryAsked, pairConfig) : {};
  for (const field of misses) if (!primaryAsked.includes(field)) failed.set(field, { reason: null, fallbackOnly: true });
  if (out) {
    const passing = [];
    for (const field of primaryAsked) {
      const value = out[field];
      if (typeof value !== 'string') {
        // Missing from the response: left untranslated, as always — unless
        // there is a fallback to ask.
        if (fb) failed.set(field, { reason: null });
        continue;
      }
      const refused = contentGateFault(fields[field], value, pairConfig);
      if (refused) {
        failed.set(field, { reason: refused, value });
        continue;
      }
      passing.push([field, value]);
    }
    const shared = sharedCheck(passing);
    for (const [field, value] of passing) {
      if (shared.has(field)) { failed.set(field, { reason: shared.get(field), value, sharedOutput: true }); continue; }
      translated[field] = value;
      stores.push({ text: fields[field], value, tmKey: primaryKey });
    }
    remember(passing.filter(([field]) => !shared.has(field)));

    // Refused: asked once more, with the reason (the key-value lane's
    // feedback retry, and retryRefusedBlocks for blocks). A keep-as-written
    // refusal answered the same way twice is taken at its word.
    const refusedFields = [...failed].filter(([, f]) => f.reason && !f.fallbackOnly).map(([field]) => field);
    if (refusedFields.length > 0) {
      const descriptions = {};
      for (const field of refusedFields) {
        const f = failed.get(field);
        descriptions[field] = `RETRY: a previous translation ("${String(f.value ?? '').slice(0, 60)}") was refused by an automatic quality check: ${f.reason}. `
          + `Translate this ${field} into ${pairConfig.name || pairConfig.target}. If it is correct exactly as written — a name, title, acronym or code — return it unchanged.`;
      }
      const chars = refusedFields.reduce((n, f) => n + fields[f].length, 0);
      const deaf = pairConfig.acceptsInstructions === false;
      const verdict = deaf ? { ok: false } : budget ? await budget.approve(charsToKeyUnits(chars, pairConfig), pairConfig) : { ok: true };
      // Declared deaf: not asked again; its first answer is judged as a second one.
      let again = deaf ? Object.fromEntries(refusedFields.map(f => [f, failed.get(f).value])) : null;
      if (verdict.ok) {
        try { again = await translate(refusedFields, pairConfig, { descriptions }); } catch { again = null; }
      }
      const againPassing = [];
      for (const field of refusedFields) {
        const value = again?.[field];
        if (typeof value !== 'string') continue;
        const f = failed.get(field);
        const fault = contentGateFault(fields[field], value, pairConfig);
        const insisted = isKeepAsWrittenFault(fault) && isKeepAsWrittenFault(f.reason)
          && [f.value, fields[field]].some(v => sameAnswer(v, value));
        if (!fault || insisted) againPassing.push([field, value]);
        else f.reason = `${f.reason}; asked again with that reason: ${fault}`;
      }
      const againShared = sharedCheck(againPassing);
      for (const [field, value] of againPassing) {
        if (againShared.has(field)) continue;
        translated[field] = value;
        stores.push({ text: fields[field], value, tmKey: primaryKey });
        failed.delete(field);
      }
      remember(againPassing.filter(([field]) => !againShared.has(field)));
    }
  } else if (fb) {
    for (const field of primaryAsked) failed.set(field, { reason: null });
  }

  // With a fallback, a report even when nothing goes to it: the primary's
  // accepted fields count toward the run's share (warnFallbackMajority).
  let report = fb ? newFallbackReport(fb) : null;
  if (report) report.primaryAccepted = Object.keys(translated).length;
  let fallbackOut = null;
  if (fb && failed.size > 0) {
    report.primaryFailedWholesale = !out;
    const asked = [...failed.keys()];
    for (const field of asked) {
      const f = failed.get(field);
      notePrimaryReason(report, refusalCategory(f.reason, { sharedOutput: !!f.sharedOutput, heldBefore: !!f.fallbackOnly, noAnswer: !f.reason }));
    }
    const chars = asked.reduce((n, f) => n + fields[f].length, 0);
    const verdict = budget ? await budget.approve(charsToKeyUnits(chars, fb), fb) : { ok: true };
    if (!verdict.ok) {
      report.skipped = { reason: verdict.reason, items: asked.map(f => `front matter "${f}"`) };
    } else {
      report.attempted = asked.length;
      fallbackOut = await translate(asked, fb);
      const fbKey = tmMethodKey(fb);
      const fbPassing = [];
      for (const field of asked) {
        const value = fallbackOut?.[field];
        if (typeof value !== 'string') continue;
        const refused = contentGateFault(fields[field], value, fb);
        if (refused) {
          failed.get(field).fallbackReason = refused;
          if (failed.get(field).fallbackOnly) failed.get(field).value = value;
          continue;
        }
        fbPassing.push([field, value]);
      }
      const fbShared = sharedCheck(fbPassing);
      for (const [field, value] of fbPassing) {
        if (fbShared.has(field)) {
          failed.get(field).fallbackReason = fbShared.get(field);
          if (failed.get(field).fallbackOnly) failed.get(field).value = value;
          continue;
        }
        translated[field] = value;
        stores.push({ text: fields[field], value, tmKey: fbKey });
        failed.delete(field);
        report.accepted++;
      }
      remember(fbPassing.filter(([field]) => !fbShared.has(field)));
    }
  }

  // A field still hollowed (by the primary, and by the fallback when there
  // is one) fails the file, as always; the caller names the first. A field
  // only the fallback was asked for fails it when the fallback's answer is
  // refused too.
  const hollowed = [];
  const refusedBy = {};
  const fbKey = fb ? tmMethodKey(fb) : null;
  for (const [field, f] of failed) {
    const methods = [...(f.reason ? [primaryKey] : []), ...(f.fallbackReason ? [fbKey] : [])];
    if (methods.length > 0) refusedBy[field] = methods;
    if (f.reason || (f.fallbackOnly && f.fallbackReason)) {
      hollowed.push({
        field, reason: f.reason || `refused before: the gate refused ${pairConfig.method}'s translation of it on an earlier sync`, value: f.value,
        ...(f.sharedOutput && { sharedOutput: true }),
        ...(f.fallbackReason && { fallbackReason: f.fallbackReason }),
      });
    }
  }

  return {
    translated,
    stores,
    hollowed,
    noResults: !out && Object.keys(translated).length === 0,
    report,
    refusedBy,
  };
}

/** ⟦PROTECTED_N⟧ tokens in a protected text. */
function protectedTokens(text) {
  const re = new RegExp(`${PLACEHOLDER_PREFIX}\\d+${PLACEHOLDER_SUFFIX}`, 'g');
  return text.match(re) || [];
}

/**
 * Why a translated Markdown block cannot be used, or null. The same gates
 * the lanes apply to a whole body — orphaned placeholders, lost content —
 * applied per block so the failing block (not the whole file) goes to the
 * fallback, plus a check the whole-body gate cannot make: every protected
 * element of the source block (code, link target, shortcode, HTML) must
 * still be there.
 *
 * Used only for pairs with a fallback: without one there is no second
 * method to route a block to, and the whole-body gates decide as before.
 *
 * @param {string} protectedSource - The block as sent (placeholders in)
 * @param {string} protectedOut - The model's block (placeholders in)
 * @param {string} restoredOut - protectedOut with placeholders restored
 * @param {string} restoredSource - The block's source text, restored
 * @returns {string|null}
 */
export function blockFault(protectedSource, protectedOut, restoredOut, restoredSource, pairConfig = {}) {
  if (hasOrphanedPlaceholders(restoredOut)) return 'a protected element was damaged';
  const dropped = protectedTokens(protectedSource).filter(t => !protectedOut.includes(t));
  if (dropped.length > 0) return `${dropped.length} protected element(s) (code, link, markup) missing`;
  // The key-value gate's checks, per block (lib/validate.js contentGateFault):
  // hollowing, echo, length inflation, truncation, repetition, script.
  return contentGateFault(restoredSource, restoredOut, pairConfig);
}

/**
 * The same answer, give or take spacing and closing punctuation: a citation
 * kept as written once with its final "." and once without was refused as a
 * changed answer (dogfood 2026-10-06, a Thai reference) — the model had said
 * "keep it" twice.
 */
function sameAnswer(a, b) {
  const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().replace(/[.,;:!?。、]+$/u, '');
  return norm(a) === norm(b);
}

/**
 * Ask the pair's method once more for the blocks the gate refused, telling it
 * why. WHY: a refusal used to be final for the run, and the block was left in
 * the source language — while a good share of refusals are the model keeping
 * text that is correct as written (a name heading, a citation, a table of
 * codes), which no fixed rule can tell from a missed translation (dogfood
 * 2026-10-05: 0.5% of 40,352 accepted blocks of champollion.dev). Told the
 * reason, the model either translates it or returns it unchanged again — and
 * a keep-as-written refusal (isKeepAsWrittenFault) answered the same way
 * twice is taken at its word, as the key-value lane takes a name. Every other
 * fault must clear the gate outright. One ask per block, alone (not in the
 * page's batch), never a loop; under --max-cost it is billed like any other
 * call (budget.approve).
 *
 * @param {object} p
 * @param {number[]} p.idx - Indices (into `missed`) the gate refused
 * @param {string[]} p.texts - The protected block texts
 * @param {Array<{source: string}>} p.missed
 * @param {Map<string,string>} p.blocks - protectBlocks() map
 * @param {object} p.pairConfig
 * @param {Function} p.runBatch
 * @param {Map<number,string>} p.firstOut - The refused (restored) answers
 * @param {Map<number,string>} p.reasons - Why each was refused; a block asked
 *   again and refused again gets the second reason appended
 * @param {object|null} [p.budget]
 * @returns {Promise<Map<number,string>>} index → accepted (restored) answer
 */
async function retryRefusedBlocks({ idx, texts, missed, blocks, pairConfig, runBatch, firstOut, reasons, answers = null, budget = null }) {
  const accepted = new Map();
  if (idx.length === 0) return accepted;
  // An endpoint that declares it follows no instructions (a trained NMT
  // model) would answer the same: not asked again — its first answers are
  // judged as second answers are (the key-value lane's rule).
  if (pairConfig.acceptsInstructions === false) {
    for (const i of idx) if (isKeepAsWrittenFault(reasons.get(i))) accepted.set(i, firstOut.get(i));
    return accepted;
  }
  if (budget) {
    const chars = idx.reduce((n, i) => n + missed[i].source.length, 0);
    const verdict = await budget.approve(charsToKeyUnits(chars, pairConfig), pairConfig);
    if (!verdict.ok) return accepted;
  }
  const retryNotes = new Map(idx.map(i => [texts[i], reasons.get(i)]));
  // Each block alone: away from the page's other segments, the model has one
  // thing to do (and one reason to read). Refusals are rare, so the extra
  // requests cost next to nothing; at most 4 at a time.
  const answers1 = new Map();
  let next = 0;
  const worker = async () => {
    while (next < idx.length) {
      const i = idx[next++];
      try {
        const res = await runBatch([texts[i]], { ...pairConfig, retryNotes });
        if (res && !(res.fellBack || []).includes(0) && typeof res.blocks[0] === 'string') answers1.set(i, res.blocks[0]);
      } catch { /* no second answer for this block */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, idx.length) }, worker));
  idx.forEach((i) => {
    if (!answers1.has(i)) return;
    const protectedOut = answers1.get(i);
    const restored = restoreBlocks(protectedOut, blocks);
    const fault = blockFault(texts[i], protectedOut, restored, missed[i].source, pairConfig);
    const insisted = isKeepAsWrittenFault(fault) && isKeepAsWrittenFault(reasons.get(i))
      && [firstOut.get(i), missed[i].source].some(v => sameAnswer(v, restored));
    if (!fault || insisted) accepted.set(i, restored);
    else {
      reasons.set(i, `${reasons.get(i)}; asked again with that reason: ${fault}`);
      if (answers) answers.set(i, restored);
    }
  });
  return accepted;
}

/**
 * Translate the Markdown blocks the TM ladder did not hold: one batch through
 * the pair's method, then one batch through its fallback for every block the
 * primary dropped or damaged. A block both fail is written as
 * its source text, unmarked (never cached; the caller records the refusal,
 * does not advance the file's lock, and reports it). A refused block is first
 * asked again once, with the reason (retryRefusedBlocks).
 *
 * Without a fallback this is exactly the lanes' old block path: the primary's
 * output stands, its dropped blocks carry the prefix, and a structural
 * failure (no response, duplicate markers) throws.
 *
 * With a fallback, a structural primary failure sends every block to the
 * fallback; only when the fallback ALSO produces nothing does the primary's
 * error fail the file. When --max-cost skips the fallback, the primary's
 * output stands exactly as it would without one.
 *
 * @param {object} p
 * @param {Array<{seg: {text: string}, source: string}>} p.missed - Blocks to translate
 * @param {Map<string,string>} p.blocks - protectBlocks() placeholder map
 * @param {object} p.pairConfig
 * @param {(texts: string[], config: object) => Promise<{blocks: string[], fellBack: number[]}>} p.runBatch
 *   - The lane's translateBlockBatchResilient call for a given pair config
 * @param {string} p.fallbackPrefix
 * @param {object|null} [p.budget]
 * @param {import('./validate.js').SharedOutputIndex|null} [p.sharedOutputs] - The
 *   locale's different-inputs-same-output index: a block answered with the
 *   text the model gave for other source strings is refused like a damaged
 *   one (the fallback gets it; without one, the source text stands)
 * @param {string} [p.label] - Names the blocks in that index ("posts/a.md")
 * @param {Set<number>} [p.fallbackOnly] - Indices (into `missed`) of blocks the
 *   pair's method refused before (lib/content-refusals.js): not sent to it,
 *   only to the fallback (the source text stands when the fallback does not translate them)
 * @returns {Promise<{ outs: string[], stores: Array<{source: string, translation: string, tmKey: string}>,
 *   fellBack: number[], fromFallback: number, report: FallbackReport|null, sharedOutput: number[],
 *   refused: Array<{ i: number, block: number, reason: string }>, refusedBy: string[][] }>} refused: blocks written as the
 *   source text because the gate refused them (block = place among the page's blocks, from 1);
 *   refusedBy[i]: the method keys whose answer for block i the gate refused, for blocks left in the source language
 *   (empty for the rest) — the lane remembers them
 */
export async function translateBlocksWithFallback({
  missed, blocks, pairConfig, runBatch, fallbackPrefix, budget = null, sharedOutputs = null, label = 'block',
  fallbackOnly = new Set(),
}) {
  const texts = missed.map(r => r.seg.text);
  const primaryKey = tmMethodKey(pairConfig);
  const fb = pairConfig.fallback || null;
  // Whose answers the gate refused, per block (the primary's, the fallback's).
  const primaryRefused = new Set();
  const fallbackRefused = new Set();
  const refusedByOf = (fellBack) => {
    const fell = new Set(fellBack);
    return texts.map((_, i) => (fell.has(i)
      ? [...(primaryRefused.has(i) ? [primaryKey] : []), ...(fallbackRefused.has(i) ? [tmMethodKey(fb)] : [])]
      : []));
  };
  // Named by the block's place among the page's translatable blocks (as
  // verify and the cached-block check name it), not its place in `missed`.
  const blockKey = (i) => `${label}#${(Number.isInteger(missed[i].pos) ? missed[i].pos : i) + 1}`;
  // Blocks whose output repeats what the model answered for other sources.
  const sharedFault = (candidates) => {
    if (!sharedOutputs) return new Set();
    const suspects = sharedOutputs.suspects(candidates.map(({ i, out }) => ({ key: blockKey(i), source: missed[i].source, value: out })));
    return new Set(candidates.filter(({ i }) => suspects.has(blockKey(i))).map(({ i }) => i));
  };
  const remember = (accepted) => {
    if (sharedOutputs) sharedOutputs.add(accepted.map(({ i, out }) => ({ key: blockKey(i), source: missed[i].source, value: out })));
  };
  // Why the gate refused a block (index → reason), for the lane's warning.
  const refusedReason = new Map();
  // The last answer the gate refused, per block — kept for the refusal log
  // (.champollion/refused.jsonl), so "why was this refused?" can be read off
  // what the model actually said instead of asked again.
  const refusedAnswer = new Map();
  /** Blocks left as their source text because the gate refused them. */
  const refusedList = (fellBack) => fellBack.filter(i => refusedReason.has(i))
    .map(i => ({ i, block: (Number.isInteger(missed[i].pos) ? missed[i].pos : i) + 1, reason: refusedReason.get(i), answer: refusedAnswer.get(i) ?? null }));

  if (!fb) {
    const { blocks: translatedBlocks, fellBack } = await runBatch(texts, pairConfig);
    const fellSet = new Set(fellBack);
    const outs = translatedBlocks.map(t => restoreBlocks(t, blocks));
    // The key-value gate's checks, per block: a short heading turned into a
    // sentence is refused here as an app key is (Round 7, school persona).
    for (let i = 0; i < outs.length; i++) {
      if (fellSet.has(i)) continue;
      const fault = contentGateFault(missed[i].source, outs[i], pairConfig);
      if (fault) { refusedReason.set(i, fault); refusedAnswer.set(i, outs[i]); }
    }
    const shared = sharedFault(outs.map((out, i) => ({ i, out })).filter(({ i }) => !fellSet.has(i) && !refusedReason.has(i)));
    for (const i of shared) refusedReason.set(i, 'the same text the model gave for other, different source strings');
    // Refused: asked once more, with the reason.
    const again = await retryRefusedBlocks({
      idx: [...refusedReason.keys()], texts, missed, blocks, pairConfig, runBatch,
      firstOut: new Map([...refusedReason.keys()].map(i => [i, outs[i]])), reasons: refusedReason, answers: refusedAnswer, budget,
    });
    const againShared = sharedFault([...again].map(([i, out]) => ({ i, out })));
    for (const [i, out] of again) {
      if (againShared.has(i)) continue;
      outs[i] = out;
      refusedReason.delete(i);
      shared.delete(i);
    }
    // A memorized answer is reported as one (sharedOutput), not as a refusal.
    for (const i of shared) refusedReason.delete(i);
    const stores = [];
    const accepted = [];
    outs.forEach((out, i) => {
      if (shared.has(i) || refusedReason.has(i)) {
        // Refused twice: the source text stands, never cached.
        outs[i] = missed[i].source;
        fellBack.push(i);
        primaryRefused.add(i);
        return;
      }
      if (!fellSet.has(i)) {
        stores.push({ source: missed[i].source, translation: out, tmKey: primaryKey });
        accepted.push({ i, out });
      }
    });
    remember(accepted);
    return {
      outs, stores, fellBack, fromFallback: 0, report: null, sharedOutput: [...shared], refused: refusedList(fellBack),
      refusedBy: refusedByOf(fellBack),
    };
  }

  // Blocks the pair's method refused before are not sent to it again.
  const primaryIdx = texts.map((_, i) => i).filter(i => !fallbackOnly.has(i));
  let primary = null;
  let primaryError = null;
  try {
    if (primaryIdx.length === texts.length) {
      primary = await runBatch(texts, pairConfig);
    } else if (primaryIdx.length > 0) {
      // Back to the page's own block indices.
      const res = await runBatch(primaryIdx.map(i => texts[i]), pairConfig);
      const all = new Array(texts.length);
      primaryIdx.forEach((i, j) => { all[i] = res.blocks[j]; });
      primary = { blocks: all, fellBack: res.fellBack.map(j => primaryIdx[j]) };
    } else {
      primary = { blocks: new Array(texts.length), fellBack: [] };
    }
  } catch (err) {
    primaryError = err;
  }

  const outs = new Array(texts.length);
  const stores = [];
  const failed = [];
  const primaryFell = new Set(primary ? primary.fellBack : []);
  const sharedIdx = new Set();
  if (primary) {
    const good = [];
    for (let i = 0; i < texts.length; i++) {
      if (primaryFell.has(i) || fallbackOnly.has(i)) { failed.push(i); continue; }
      const restored = restoreBlocks(primary.blocks[i], blocks);
      const fault = blockFault(texts[i], primary.blocks[i], restored, missed[i].source, pairConfig);
      if (fault) {
        refusedReason.set(i, fault);
        refusedAnswer.set(i, restored);
        primaryRefused.add(i);
        failed.push(i);
        continue;
      }
      good.push({ i, out: restored });
    }
    const shared = sharedFault(good);
    for (const { i, out } of good) {
      if (shared.has(i)) { failed.push(i); sharedIdx.add(i); primaryRefused.add(i); continue; }
      outs[i] = out;
      stores.push({ source: missed[i].source, translation: out, tmKey: primaryKey });
    }
    remember(good.filter(({ i }) => !shared.has(i)));
    // Refused (not dropped, not held before): asked once more, with the reason.
    const firstOut = new Map();
    for (const i of failed) {
      if (sharedIdx.has(i)) refusedReason.set(i, 'the same text the model gave for other, different source strings');
      if (refusedReason.has(i)) firstOut.set(i, restoreBlocks(primary.blocks[i], blocks));
    }
    const again = await retryRefusedBlocks({
      idx: [...firstOut.keys()], texts, missed, blocks, pairConfig, runBatch, firstOut, reasons: refusedReason, answers: refusedAnswer, budget,
    });
    const againShared = sharedFault([...again].map(([i, out]) => ({ i, out })));
    const recovered = new Set();
    for (const [i, out] of again) {
      if (againShared.has(i)) continue;
      outs[i] = out;
      stores.push({ source: missed[i].source, translation: out, tmKey: primaryKey });
      refusedReason.delete(i);
      sharedIdx.delete(i);
      primaryRefused.delete(i);
      recovered.add(i);
    }
    remember([...again].filter(([i]) => recovered.has(i)).map(([i, out]) => ({ i, out })));
    if (recovered.size > 0) failed.splice(0, failed.length, ...failed.filter(i => !recovered.has(i)));
    for (const i of sharedIdx) refusedReason.delete(i);
  } else {
    for (let i = 0; i < texts.length; i++) failed.push(i);
  }

  const report = newFallbackReport(fb);
  report.primaryFailedWholesale = !primary;
  // The primary's accepted blocks, and why the rest go to the fallback
  // (lib/fallback.js warnFallbackMajority).
  report.primaryAccepted = outs.filter(o => o !== undefined).length;
  for (const i of failed) {
    notePrimaryReason(report, refusalCategory(refusedReason.get(i) || null, {
      sharedOutput: sharedIdx.has(i), heldBefore: fallbackOnly.has(i), noAnswer: !refusedReason.has(i) && !sharedIdx.has(i),
    }));
  }
  const fellBack = [];
  failed.sort((a, b) => a - b);
  if (failed.length === 0) return { outs, stores, fellBack, fromFallback: 0, report, sharedOutput: [], refused: [], refusedBy: refusedByOf([]) };

  const chars = failed.reduce((n, i) => n + missed[i].source.length, 0);
  const verdict = budget ? await budget.approve(charsToKeyUnits(chars, fb), fb) : { ok: true };
  if (!verdict.ok) {
    report.skipped = { reason: verdict.reason, items: failed.map(i => `block ${i + 1} of ${texts.length}`) };
    if (primaryError) throw primaryError;
    // The primary's own output stands, exactly as without a fallback —
    // except a block refused as a repeated (memorized) answer, and a block
    // only the fallback was to be asked for (the primary had no answer).
    for (const i of failed) {
      if (sharedIdx.has(i) || primaryFell.has(i) || refusedReason.has(i) || fallbackOnly.has(i)) {
        outs[i] = sharedIdx.has(i) || refusedReason.has(i) || fallbackOnly.has(i)
          ? missed[i].source : restoreBlocks(primary.blocks[i], blocks);
        fellBack.push(i);
        continue;
      }
      outs[i] = restoreBlocks(primary.blocks[i], blocks);
      stores.push({ source: missed[i].source, translation: outs[i], tmKey: primaryKey });
    }
    return {
      outs, stores, fellBack, fromFallback: 0, report, sharedOutput: [...sharedIdx], refused: refusedList(fellBack),
      refusedBy: refusedByOf(fellBack),
    };
  }

  report.attempted = failed.length;
  let second = null;
  try {
    second = await runBatch(failed.map(i => texts[i]), fb);
  } catch (err) {
    if (primaryError) {
      primaryError.message += ` (the fallback, ${fb.method}, failed too: ${err.message})`;
      throw primaryError;
    }
  }
  if (!second && primaryError) throw primaryError;

  const fbKey = tmMethodKey(fb);
  const secondFell = new Set(second ? second.fellBack : []);
  let fromFallback = 0;
  const fbGood = [];
  failed.forEach((i, j) => {
    if (second && !secondFell.has(j)) {
      const restored = restoreBlocks(second.blocks[j], blocks);
      const fbFault = blockFault(texts[i], second.blocks[j], restored, missed[i].source, fb);
      if (!fbFault) fbGood.push({ i, out: restored });
      else {
        refusedReason.set(i, refusedReason.has(i) ? `${refusedReason.get(i)}; the fallback's answer: ${fbFault}` : `the fallback's answer: ${fbFault}`);
        refusedAnswer.set(i, restored);
        fallbackRefused.add(i);
      }
    }
  });
  const fbShared = sharedFault(fbGood);
  for (const i of fbShared) fallbackRefused.add(i);
  const fbAccepted = new Map(fbGood.filter(({ i }) => !fbShared.has(i)).map(({ i, out }) => [i, out]));
  remember([...fbAccepted].map(([i, out]) => ({ i, out })));
  for (const i of failed) {
    if (fbAccepted.has(i)) {
      outs[i] = fbAccepted.get(i);
      stores.push({ source: missed[i].source, translation: outs[i], tmKey: fbKey });
      report.accepted++;
      fromFallback++;
      continue;
    }
    // Both methods failed this block: the source text stands.
    outs[i] = missed[i].source;
    fellBack.push(i);
  }
  return {
    outs, stores, fellBack, fromFallback, report, sharedOutput: [...sharedIdx].filter(i => !fbAccepted.has(i)),
    refused: refusedList(fellBack),
    refusedBy: refusedByOf(fellBack),
  };
}

/**
 * Whole-page ('page' segmentation) translation with a fallback. The pair's
 * method first; when it returns nothing, damages a placeholder or hollows
 * the body, the fallback translates the whole page once. Returns null for
 * `body` when both fail — the caller then fails the file exactly as it does
 * without a fallback (its whole-body checks name the reason).
 *
 * Only called for pairs WITH a fallback; the lanes keep their own page path
 * otherwise.
 *
 * @param {object} p
 * @param {string} p.body - Source body (restored)
 * @param {Map<string,string>} p.blocks - protectBlocks() map
 * @param {object} p.pairConfig
 * @param {(config: object) => Promise<string|null>} p.runPage - One page call for a config
 * @param {object|null} [p.budget]
 * @param {boolean} [p.fallbackOnly] - The pair's method refused this page
 *   before (lib/content-refusals.js): it is not asked, only the fallback is
 * @returns {Promise<{ body: string|null, primaryBody: string|null, tmKey: string|null, report: FallbackReport,
 *   refusedBy: string[] }>} refusedBy: the method keys whose page the whole-body checks refused this run
 */
export async function translatePageWithFallback({ body, blocks, pairConfig, runPage, budget = null, fallbackOnly = false }) {
  const fb = pairConfig.fallback;
  const report = newFallbackReport(fb);
  const fault = (restored) => hasOrphanedPlaceholders(restored) || !!checkContentPreservation(body, restored);
  const refusedBy = [];

  let primaryBody = null;
  if (!fallbackOnly) {
    const first = await runPage(pairConfig);
    primaryBody = first ? restoreBlocks(first, blocks) : null;
    if (primaryBody !== null && !fault(primaryBody)) {
      report.primaryAccepted = 1;
      return { body: primaryBody, primaryBody, tmKey: tmMethodKey(pairConfig), report, refusedBy };
    }
    if (primaryBody !== null) refusedBy.push(tmMethodKey(pairConfig));
    report.primaryFailedWholesale = first === null;
  }
  // Why the page goes to the fallback (warnFallbackMajority).
  notePrimaryReason(report, fallbackOnly
    ? refusalCategory(null, { heldBefore: true })
    : refusalCategory(primaryBody === null ? null : 'content lost or changed', { noAnswer: primaryBody === null }));

  const verdict = budget ? await budget.approve(charsToKeyUnits(body.length, fb), fb) : { ok: true };
  if (!verdict.ok) {
    report.skipped = { reason: verdict.reason, items: ['the page body'] };
    return { body: null, primaryBody, tmKey: null, report, refusedBy };
  }
  report.attempted = 1;
  const second = await runPage(fb);
  const fallbackBody = second ? restoreBlocks(second, blocks) : null;
  if (fallbackBody !== null && !fault(fallbackBody)) {
    report.accepted = 1;
    return { body: fallbackBody, primaryBody, tmKey: tmMethodKey(fb), report, refusedBy };
  }
  if (fallbackBody !== null) refusedBy.push(tmMethodKey(fb));
  return { body: null, primaryBody, tmKey: null, report, refusedBy };
}
