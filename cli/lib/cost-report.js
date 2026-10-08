/**
 * cost-report.js — Pre-sync cost estimation display
 *
 * Extracted from sync.js to reduce god-module complexity.
 * This module is purely informational — it reads locale files,
 * estimates translation costs via the pairs API, and prints a
 * formatted table using the output controller. No side effects
 * on sync state.
 *
 * Called once at the start of runSync for EVERY engine — it used to
 * early-return unless OPENROUTER_API_KEY was set, which silently hid
 * the preview from google-translate/deepl/gemini/… users who never
 * touch OpenRouter. Each method implements estimateCost() (or honestly
 * returns null = "unknown", never $0), so the key gate was wrong.
 *
 * The structured estimate is RETURNED to the caller so that:
 *   - sync.js can enforce the --max-cost cap BEFORE any API call
 *     (unknown ≠ free: an unknowable estimate under a cap aborts), and
 *   - the estimate reaches the --json summary (output.raw table lines
 *     are invisible in --json mode by design).
 *
 * The estimate is TM-AWARE: keys the Translation Memory already covers are
 * pure cache hits in the real pipeline (translate-pair.js partitions before
 * any API call), so they are reported as tmHits and priced at $0 — pricing
 * them as fresh calls made --max-cost abort nearly-free re-runs.
 *
 * Also home to abortForMaxCost() and the shared printCostTable() renderer,
 * used by both the standard path (sync.js) and the Docusaurus path
 * (docusaurus-sync.js) — sync.js imports docusaurus-sync.js, so shared
 * cap machinery must live below both.
 *
 * Failures stay non-blocking when no cap is set — they log a warning,
 * return null, and the sync continues.
 */

import fs from 'node:fs';
import path from 'node:path';
import { flattenKeys } from './flatten.js';
import { diffLocale } from './diff.js';
import { readLocaleFile } from './format.js';
import { expectedForTarget, keysForNamespace, readLocaleFlat } from './locale-layout.js';
import { mapSourceKeysToTarget } from './plurals.js';
import { contentKeyUnits } from './config.js';
import { formatPerMillion } from './methods/openrouter-pricing.js';
import { countPendingContentTranslations } from './content-sync.js';
import { loadTM, lookupTM, partitionByTM, tmMethodKey, findModelSwitchStrandedEntries, reusableFromEarlierModels, carriedFromModel } from './tm.js';
import { tmTextFor } from './tm-evict.js';
import { compileNoTranslate } from './no-translate.js';
import { tmKeysForPair, tmHoldsValue } from './fallback.js';
import { output } from './output.js';
import { planQueue, createEditClassifier } from './locale-state.js';
import { planGapRedo } from './plural-gap-redo.js';

/**
 * Say what a model switch means for this run.
 *
 * By default (model carry-over, see lib/tm.js) translations made under the
 * previous model are reused at no cost — the operator should KNOW that, both
 * because it is a saving and because it is a choice they can reverse. With
 * --fresh-on-model-change the same entries are deliberately bypassed, and
 * the run will re-translate (and bill) that text — say so before spending.
 * Returns the report so callers can carry it into the --json summary.
 *
 * `served` (target → { earlierModel: count }, from the cost estimate's
 * options.collect) limits the carry-over notice to what THIS run reuses: a
 * plain sync after a model switch that queues nothing reads nothing from the
 * cache, and repeating "N cached translations will be reused" on every such
 * run was noise (Round 5, Next.js persona). `champollion status` carries the
 * standing fact (the files hold an earlier model's text). Without `served`
 * the notice counts every cached translation of the current source.
 *
 * @param {object} tm - Loaded TM
 * @param {Iterable<object>} pairConfigs - Resolved pair configs
 * @param {{ fresh?: boolean, redoAll?: boolean, sourceTexts?: Iterable<string>|null,
 *   served?: Object<string, Object<string, number>>|null }} [options]
 * @returns {ReturnType<typeof findModelSwitchStrandedEntries>}
 */
/** "1 translation" / "10 translations". */
const translationsWord = (n) => `${n} translation${n === 1 ? '' : 's'}`;

/**
 * What a count of translations across target languages is made of, in plain
 * units: "5 strings × 2 languages", "5 strings in fr", "3 in fr, 5 in de".
 * The notices summed every locale's count and called the total "source
 * string(s)" — 10 for a 5-key en.json with two targets (Round 12, Next.js
 * persona).
 *
 * @param {Array<{ target: string, n: number }>} perTarget
 * @returns {string}
 */
export function translationsBreakdown(perTarget) {
  const rows = perTarget.filter(p => p.n > 0);
  const strings = (n) => `${n} string${n === 1 ? '' : 's'}`;
  if (rows.length === 1) return `${strings(rows[0].n)} in ${rows[0].target}`;
  if (rows.length > 1 && rows.every(p => p.n === rows[0].n)) return `${strings(rows[0].n)} × ${rows.length} languages`;
  return rows.map(p => `${p.n} in ${p.target}`).join(', ');
}

export function warnModelSwitchStrandedTM(tm, pairConfigs, { fresh = false, redoAll = false, sourceTexts = null, served = null } = {}) {
  // Iterated twice (the report, then each row's own pair) — an iterator
  // (Map#values()) would be empty the second time.
  const pcs = [...pairConfigs];
  // sourceTexts: count only translations of strings the project still has
  // (an entry for an edited or deleted string is never reused).
  const report = findModelSwitchStrandedEntries(tm, pcs, { sourceTexts });
  // With `served`, what the run reuses is said even when the report is
  // empty (see below).
  if (report.length === 0 && !served) return report;
  // One count for the total and its breakdown (Round 11, Next.js persona:
  // "12 cached translation(s)" above per-model counts adding up to 30 — the
  // total summed each locale's FIRST earlier model, the lines listed every
  // model's holdings, and a string two models translated counted twice).
  // Each string of the current source that only an earlier model translated
  // counts once, under the model whose translation carry-over would reuse
  // (lib/tm.js reusableFromEarlierModels); a project whose Markdown shares
  // the cache counts cache entries instead, and says so.
  const reusable = (r) => reusableFromEarlierModels(tm, pcs.find(pc => pc.target === r.target) || { target: r.target }, r.stranded, { sourceTexts });
  const sayCounts = (rows, verb) => {
    const counted = rows.map(r => ({ r, u: reusable(r) })).filter(x => x.u.total > 0);
    const total = counted.reduce((n, x) => n + x.u.total, 0);
    const unit = counted.some(x => x.u.unit === 'entries') ? 'entries' : 'strings';
    const perTarget = counted.map(x => ({ target: x.r.target, n: x.u.total }));
    // Counted in translations — one per string per language — and said so.
    const what = unit === 'strings'
      ? `${translationsWord(total)} only an earlier model wrote (${translationsBreakdown(perTarget)})`
      : `${translationsWord(total)} cached from earlier models (counted per cache entry, so a string two earlier models `
        + `translated counts twice: ${perTarget.map(p => `${p.n} in ${p.target}`).join(', ')})`;
    const lines = counted.map(({ r, u }) => `  ${r.target}: now ${r.currentModel || '(none)'}; ${u.total} ${verb} ${u.byModel.map(x => `${x.model || '(none)'} (${x.count})`).join(', ')}`);
    return { total, what, lines };
  };
  if (fresh) {
    const { total, what, lines } = sayCounts(report, 'from');
    if (total === 0) return report;
    // "Billed" read wrong above a "$0 (local)" estimate (Round 6, Next.js
    // persona): what happens is that the text is sent to the model again, at
    // the method's price — which the estimate below states.
    const price = 'at the method\'s price (the estimate below; $0 API cost for a model on this machine)';
    output.warn(redoAll
      ? `Model changed: re-translating everything with the new model (--redo all --fresh-on-model-change); ${what} will not be reused — that text is sent to the model again, ${price}.`
      : `Model changed: --fresh-on-model-change set, so ${what} will NOT be reused — but only text this run translates anyway (new or changed keys) is sent to the model again, ${price}. To re-translate ALL of it with the new model, add --redo all.`);
    for (const l of lines) output.warn(l);
    return report;
  }
  if (served) {
    // Only what this run actually serves from an earlier model's cache —
    // counted from what the estimate found, for EVERY locale it serves one
    // in, not only the locales the stranded-entries report names. That report
    // stays silent once a switch is complete (or when the new model holds more
    // entries than the old), so a string reverted to text only the earlier
    // model had translated was served as a free cache hit with no word that
    // the text was that model's — the real sync and `status` said it
    // afterwards (Round 13, Next.js persona; the Translation Memory page
    // promises it before the estimate).
    const every = findModelSwitchStrandedEntries(tm, pcs, { sourceTexts, every: true });
    for (const pc of pcs) {
      const byModel = served[pc.target] || {};
      if (Object.values(byModel).reduce((a, b) => a + b, 0) === 0 || report.some(r => r.target === pc.target)) continue;
      const row = every.find(r => r.target === pc.target) || {
        target: pc.target, currentModel: tmMethodKey(pc).split('|')[1] || '', current: 0,
        stranded: Object.entries(byModel).map(([model, count]) => ({ model, count })),
      };
      report.push(row);
    }
    const lines = [];
    const perTarget = [];
    let total = 0;
    for (const r of report) {
      const byModel = served[r.target] || {};
      const n = Object.values(byModel).reduce((a, b) => a + b, 0);
      r.servedThisRun = n;
      if (n === 0) continue;
      total += n;
      perTarget.push({ target: r.target, n });
      const from = Object.entries(byModel).sort((a, b) => b[1] - a[1]).map(([m, c]) => `${m} (${c})`).join(', ');
      lines.push(`  ${r.target}: now ${r.currentModel || '(none)'}; reusing translations from ${from}`);
    }
    if (total === 0) return report;
    output.info(`Model changed: ${translationsWord(total)} this run needs (${translationsBreakdown(perTarget)}) `
      + `${total === 1 ? 'is' : 'are'} served from the previous model's cached translations, at no cost. To have the new model translate them instead: --redo all --fresh-on-model-change (it sends what an earlier model translated; what the new model already translated comes from the cache).`);
    for (const l of lines) output.info(l);
    return report;
  }
  const { total, what, lines } = sayCounts(report, 'from');
  if (total === 0) return report;
  output.info(`Model changed: ${what} will be reused at no cost. To have the new model translate them instead: --redo all --fresh-on-model-change (it sends what an earlier model translated; what the new model already translated comes from the cache).`);
  for (const l of lines) output.info(l);
  return report;
}

/**
 * Parse and validate a --max-cost flag value.
 *
 * Accepts any finite number >= 0 (a cap of 0 means "only proceed if the
 * estimate is $0"). Rejects NaN, negatives, and empty values loudly —
 * a silently-ignored malformed cap would defeat the entire fail-safe.
 *
 * @param {string|undefined|null} raw - Raw flag value (undefined = flag not set)
 * @returns {number|null} Parsed cap in USD, or null when the flag is not set
 */
export function parseMaxCost(raw) {
  if (raw === undefined || raw === null || raw === false) return null;
  const val = Number.parseFloat(String(raw));
  if (!Number.isFinite(val) || val < 0 || String(raw).trim() === '') {
    throw new Error(`--max-cost must be a non-negative number in USD (got "${raw}").`);
  }
  return val;
}

/**
 * @typedef {object} CostEstimateSummary
 * @property {string} currency - Always 'USD'
 * @property {Array<{pair: string, method: string, keys: number, tmHits: number, estimatedCost: number|null, source: string}>} pairs
 *   Per-pair key-value estimates. `keys` counts only the keys that will
 *   actually reach the API (TM misses) — the count the estimate prices.
 *   `tmHits` counts keys the Translation Memory already covers ($0).
 *   null estimatedCost = unknown, never $0.
 * @property {number} keyCost - Sum of KNOWN per-pair key-value estimates
 * @property {{ files: number, pendingTranslations: number, estimatedCost: number|null,
 *   costWithoutTM: number|null, rough: true }|null} content
 *   Rough content-file estimate when content is pending, else null.
 *   estimatedCost prices only TM misses (what the run bills, and what
 *   --max-cost compares); costWithoutTM prices every pending character, to
 *   show what the cache saves.
 * @property {number|null} totalEstimatedCost - keyCost + content cost; null
 *   when any part is unknown (never a partial sum passed off as the total)
 * @property {number} knownEstimatedCost - The priced part only
 * @property {boolean} hasUnknownCosts - True when ANY pair or the content
 *   estimate is unknown. Consumers enforcing --max-cost must treat this as
 *   over-cap (unknown ≠ free).
 * @property {{ reason: string, pairs: string[] }} [unknownCost] - Why the
 *   total is null (present only when hasUnknownCosts)
 */

/** "Estimated cost: ~$0.0068, --max-cost cap: $0.0010." — one wording for the gate and the dry run. */
function capLine(maxCost, estimatedCost) {
  const estimateStr = estimatedCost !== null ? `~$${estimatedCost.toFixed(4)}` : 'unknown';
  return `Estimated cost: ${estimateStr}, --max-cost cap: $${maxCost.toFixed(4)}.`;
}

/**
 * The --max-cost verdict on an estimate: would a real run stop at the cap,
 * and why. The ONE rule both the gate (real runs) and the dry-run report use
 * — a dry run never stops, but it must say what the real run would do
 * (Round 5, Next.js persona: `sync --dry --max-cost 0.001` over a ~$0.0068
 * estimate exited 0 and said nothing about the cap).
 *
 * Unknown is not free: a failed estimate or a pair with no published price
 * stops a capped run.
 *
 * @param {number} maxCost - The cap in USD
 * @param {CostEstimateSummary|null} costEstimate
 * @returns {{ cap: number, estimatedCost: number|null, wouldStop: boolean, reason: string|null }}
 */
export function maxCostVerdict(maxCost, costEstimate) {
  if (!costEstimate) {
    return { cap: maxCost, estimatedCost: null, wouldStop: true,
      reason: 'Cost estimation failed, so --max-cost cannot be enforced (unknown is not free).' };
  }
  if (costEstimate.hasUnknownCosts) {
    const named = unpricedGroups(costEstimate.pairs || [], costEstimate.content || null)
      .map(g => `${g.subject} (${g.pairs.join(', ')})`).join('; ');
    return { cap: maxCost, estimatedCost: null, wouldStop: true,
      reason: `Some pairs have unknown pricing${named ? ` — no price for ${named}` : ''}, so the total cost cannot be bounded (unknown is not free).` };
  }
  if (costEstimate.totalEstimatedCost > maxCost) {
    return { cap: maxCost, estimatedCost: costEstimate.totalEstimatedCost, wouldStop: true,
      reason: 'Estimated translation cost exceeds the --max-cost cap.' };
  }
  return { cap: maxCost, estimatedCost: costEstimate.totalEstimatedCost, wouldStop: false, reason: null };
}

/**
 * A dry run's --max-cost report: what the real run would do at the cap.
 * Returned, not printed: the caller says `message` ONCE, at the end of the
 * run beside the preflight verdict (at `level`), and carries the rest in the
 * --json summary (`maxCost: { cap, estimatedCost, wouldStop, exitCode }`).
 * It used to be printed here AND again at the end — the same warning twice,
 * --quiet included (Round 11, Next.js persona).
 * The dry run itself still exits 0 — a preview never fails.
 *
 * @param {number} maxCost
 * @param {CostEstimateSummary|null} costEstimate
 * @param {{ stopsEarlier?: string|null }} [options] - why the real run would
 *   stop BEFORE the cap is checked (the preflight), in words; the report then
 *   says so instead of "a real run would go ahead"
 * @returns {{ cap: number, estimatedCost: number|null, wouldStop: boolean, reason: string|null, exitCode: number|null,
 *   stopsEarlier?: string, message: string, level: 'warn'|'info' }}
 */
export function reportDryRunMaxCost(maxCost, costEstimate, { stopsEarlier = null } = {}) {
  const v = maxCostVerdict(maxCost, costEstimate);
  // The preflight runs before the cap is checked: a run that would stop there
  // (a missing key, a model server that does not answer) never reaches the
  // cap, so "a real run would go ahead" was false beside the preflight's
  // "the real sync would STOP" (Round 9, Next.js persona).
  if (stopsEarlier) {
    const message = (v.wouldStop
      ? `--max-cost: the estimate is over the cap (${v.reason.replace(/\.$/, '')}), but the run would stop earlier, before the cap is checked, and exit 1: ${stopsEarlier}. ${capLine(maxCost, v.estimatedCost)}`
      : `--max-cost: the estimate is under the cap, but the run would stop earlier and exit 1: ${stopsEarlier}. ${capLine(maxCost, v.estimatedCost)}`)
      + ` ${dryRunCiHint('preflight.ready')}`;
    return { ...v, exitCode: 1, stopsEarlier, message, level: 'warn' };
  }
  const message = v.wouldStop
    ? `A real run would stop at the --max-cost cap before any API call and exit 2: ${v.reason} ${capLine(maxCost, v.estimatedCost)} ${dryRunCiHint('maxCost.wouldStop')}`
    : `--max-cost: the estimate is within the cap — a real run would go ahead. ${capLine(maxCost, v.estimatedCost)}`;
  return { ...v, exitCode: v.wouldStop ? 2 : null, message, level: v.wouldStop ? 'warn' : 'info' };
}

/** The CI guide's dry-run check: a step that fails the job when the real run would not go through. */
export const CI_CHECK_DOC = 'https://champollion.dev/docs/guides/ci-cd#check-before-sync';

/**
 * How to make a CI step fail on what a dry run predicts. A dry run exits 0
 * on purpose (Round 11), so `sync --dry --max-cost` "warned and passed" and
 * could not gate a step on its own (Round 14, Next.js persona): the warning
 * now names the --json field to read, and the guide's step that reads it.
 *
 * @param {string} field - The summary field that says it ('maxCost.wouldStop', 'preflight.ready', …)
 * @returns {string}
 */
export function dryRunCiHint(field) {
  const fields = field === 'realRun.exitCode' ? '`realRun.exitCode`' : `\`${field}\` or \`realRun.exitCode\``;
  return `This dry run exits 0 (a preview): to fail a CI step on it, read ${fields} `
    + `from \`champollion sync --dry --json\` — the CI guide's check step does, and prints the reason: ${CI_CHECK_DOC}`;
}

/**
 * Why a real run would stop at the preflight, in one clause for the dry run's
 * --max-cost line: each reason once, with the pairs it applies to
 * ("No OpenRouter API key (OPENROUTER_API_KEY) for en:de, en:fr"). null when
 * the preflight would pass.
 *
 * @param {Array<{ pair: string, reason: string }>} failures - resolveRuntime's preflightFailures
 * @returns {string|null}
 */
export function preflightStopReason(failures) {
  if (!Array.isArray(failures) || failures.length === 0) return null;
  const byReason = new Map();
  for (const f of failures) {
    const reason = String(f.reason).replace(/[.;\s]+$/, '');
    if (!byReason.has(reason)) byReason.set(reason, []);
    byReason.get(reason).push(f.pair);
  }
  return [...byReason].map(([reason, pairs]) => `${reason} for ${pairs.join(', ')}`).join('; ');
}

/**
 * Build the --max-cost abort: print the estimate-vs-cap verdict, emit a
 * structured summary (--json consumers get {error} instead of regexing
 * log lines), and return the result object commands/sync.js maps to exit
 * code 2. Nothing has been spent when this runs — it fires BEFORE any
 * translation API call.
 *
 * Lives here (not sync.js) so the Docusaurus path can enforce the same
 * cap without importing sync.js (which imports docusaurus-sync.js).
 *
 * @param {number} maxCost - The user's cap in USD
 * @param {number|null} estimatedCost - Known estimate, or null when unknowable
 * @param {string} reason - Human-readable explanation of the abort
 * @returns {object} runSync result with maxCostAborted set
 */
export function abortForMaxCost(maxCost, estimatedCost, reason) {
  const message = `${reason} ${capLine(maxCost, estimatedCost)} Aborting before any API call.`;
  output.error(message);
  output.summary({
    command: 'sync',
    aborted: 'max-cost',
    error: message,
    estimatedCost,
    maxCost,
  });
  return {
    maxCostAborted: true,
    estimatedCost,
    maxCost,
    totalProcessed: 0,
    totalFailed: 0,
    failedPairs: [],
    verifyErrors: 0,
    verifyWarnings: 0,
  };
}

/**
 * Price per-pair content characters through each pair's own estimateCost().
 * Characters become key-equivalents (lib/config.js contentKeyUnits): exact
 * for char-priced providers; measured, still conservative, for token-priced
 * LLMs, which pay the prompt once per page rather than per 25-char slice. A pair with 0 chars is a
 * KNOWN $0 and never consults estimateCost — an unknown-pricing null there
 * would wrongly abort a free run under --max-cost.
 *
 * @param {Map<object, number>} charsByPair - pairConfig → source chars
 * @param {Array<[string, object]>} pairEntries
 * @param {(keys: number, pairConfig: object) => Promise<{estimatedCost: number|null}>} estimateCost
 * @returns {Promise<{ cost: number, unknown: boolean }>}
 */
export async function priceContentChars(charsByPair, pairEntries, estimateCost) {
  let cost = 0;
  let unknown = false;
  // The pairs with no price, and why (the method's note), so the table names
  // them instead of "some methods have unknown pricing".
  const unpriced = [];
  // The rates what was priced was priced at (each once).
  const rates = [];
  for (const [pairKey, pairConfig] of pairEntries) {
    const chars = charsByPair.get(pairConfig);
    if (!chars) continue;
    // eslint-disable-next-line no-await-in-loop — sequential is fine for cost queries (cached)
    const estimate = await estimateCost(contentKeyUnits(chars, pairConfig), pairConfig);
    if (estimate.estimatedCost !== null) {
      cost += estimate.estimatedCost;
      if (estimate.rate) rates.push(estimate.rate);
    } else {
      unknown = true;
      unpriced.push({
        pair: pairKey, method: pairConfig.method || 'llm',
        ...(estimate.model && { model: estimate.model }), ...(estimate.note && { note: estimate.note }),
      });
    }
  }
  return { cost, unknown, unpriced, rates: uniqueRates(rates) };
}

/** A rate's identity: the same model priced from the same list is one rate. */
const rateId = (r) => JSON.stringify([r.model, r.unit, r.inputPerMillion, r.outputPerMillion, r.perMillionChars, r.from, r.tokensPerKey?.input]);

/**
 * Each rate once, in the order first seen.
 *
 * @param {object[]} rates
 * @returns {object[]}
 */
function uniqueRates(rates) {
  const seen = new Map();
  for (const r of rates) if (r && !seen.has(rateId(r))) seen.set(rateId(r), r);
  return [...seen.values()];
}

/**
 * Every rate an estimate priced something at: the pairs' and the content's.
 *
 * @param {CostEstimateSummary['pairs']} costEstimates
 * @param {CostEstimateSummary['content']} content
 * @returns {object[]}
 */
export function ratesUsed(costEstimates, content) {
  return uniqueRates([
    ...costEstimates.filter(e => e.keys > 0 && e.rate).map(e => e.rate),
    ...(content?.rates || []),
  ]);
}

/** "2026-10-04 14:02 UTC" from an ISO time (null → null). */
function utcMinute(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * One rate in words: the price per million units, and where it came from.
 *
 * @param {object} r - A method estimate's `rate`
 * @returns {string}
 */
function describeRate(r) {
  const price = r.unit === 'char'
    ? `$${formatPerMillion(r.perMillionChars)} per 1M characters`
    : `$${formatPerMillion(r.inputPerMillion)} input / $${formatPerMillion(r.outputPerMillion)} output per 1M tokens`;
  let where;
  if (r.from === 'openrouter-price-list') {
    const when = utcMinute(r.fetchedAt);
    where = `OpenRouter's price list${r.proxyFor ? ` (a stand-in for ${r.proxyFor}'s own price)` : ''}, ${when ? `read ${when}` : 'read this run'}`;
  } else if (r.from === 'pinned-table') {
    const why = {
      off: 'the live price draw is off', 'no-price': 'OpenRouter\'s list has no price for it', 'not-listed': 'not on OpenRouter\'s list',
    }[r.liveDraw] || 'OpenRouter\'s list could not be read';
    where = `a copy kept in champollion${r.verified ? `, checked ${r.verified}` : ', never checked'} (${why})`;
  } else if (r.from === 'published-rate') {
    where = `the provider's published price${r.verified ? `, as checked ${r.verified}` : ''}`;
  } else {
    where = r.from || 'unknown source';
  }
  return `${r.model} ${price} — ${where}`;
}

/**
 * The table's rate line: each rate used, where it came from and when, and
 * what the estimate assumes per key — one line; --json carries the detail
 * (`costEstimate.rates`, each pair's `rate`). Null when nothing was priced
 * at a rate (all from the cache, a model on this machine, no price).
 *
 * @param {object[]} rates
 * @returns {string|null}
 */
export function rateLine(rates) {
  if (!rates || rates.length === 0) return null;
  const tokens = rates.filter(r => r.unit === 'token');
  const chars = rates.filter(r => r.unit === 'char');
  const assumed = [
    ...new Set(tokens.map(r => `~${r.tokensPerKey.input} input + ~${r.tokensPerKey.output} output tokens`)),
    ...new Set(chars.map(r => `~${r.charsPerKey} characters`)),
  ].join(' or ');
  return `  ${rates.length > 1 ? 'Rates' : 'Rate'}: ${rates.map(describeRate).join('; ')}. `
    + `An estimate: ${assumed} per key assumed — the bill depends on the real lengths (--json has the detail).`;
}

/**
 * What has no price in an estimate, grouped by what it is: a model (the
 * method looked its price up and found none — its note says why: not in the
 * provider's list, listed without a price, or no list) or a method with no
 * published price at all (a self-hosted endpoint elsewhere). The table's
 * Total line names these; it used to say "no method in this run has
 * published pricing" for a mistyped model slug too (Round 11, Next.js
 * persona).
 *
 * @param {CostEstimateSummary['pairs']} costEstimates
 * @param {CostEstimateSummary['content']} content
 * @returns {Array<{ subject: string, pairs: string[], note: string|null }>}
 */
export function unpricedGroups(costEstimates, content) {
  const items = [
    ...costEstimates.filter(e => e.estimatedCost === null),
    ...(content?.estimatedCost === null && Array.isArray(content.unpriced) ? content.unpriced : []),
  ];
  const groups = new Map();
  for (const e of items) {
    const subject = e.model ? `model ${e.model}` : `the ${e.method || 'llm'} method`;
    const note = e.note || null;
    const id = `${subject}\x00${note}`;
    if (!groups.has(id)) groups.set(id, { subject, pairs: [], note });
    const g = groups.get(id);
    if (!g.pairs.includes(e.pair)) g.pairs.push(e.pair);
  }
  return [...groups.values()];
}

/**
 * The structured estimate both sync paths return (and --json carries).
 *
 * totalEstimatedCost is null whenever any part is unknown: a number there
 * read as the whole bill — 0 for a run whose only method had no price
 * (Round 3, Next.js persona), while the docs promise unknown is never shown
 * as $0. knownEstimatedCost keeps the priced part; unknownCost says why the
 * total is missing (which pairs, and their methods' own notes).
 *
 * @returns {CostEstimateSummary}
 */
export function summarizeEstimate(costEstimates, content, knownTotal, hasUnknownCosts) {
  const unknownPairs = costEstimates.filter(e => e.estimatedCost === null);
  return {
    currency: 'USD',
    pairs: costEstimates,
    keyCost: content && content.estimatedCost !== null
      ? knownTotal - content.estimatedCost
      : knownTotal,
    content,
    totalEstimatedCost: hasUnknownCosts ? null : knownTotal,
    knownEstimatedCost: knownTotal,
    // Every rate something was priced at: per 1M tokens (or characters),
    // the list it came from and when it was read (or the date of the copy).
    rates: ratesUsed(costEstimates, content),
    hasUnknownCosts,
    ...(hasUnknownCosts && {
      unknownCost: {
        reason: unknownPairs.length > 0
          ? 'no published price for: ' + unknownPairs.map(e => `${e.pair} (${e.method}${e.source ? `, ${e.source}` : ''})`).join(', ')
          : 'the content-file estimate has no published price',
        pairs: unknownPairs.map(e => e.pair),
        // What has no price and why, in words (the table's lines).
        notes: unpricedGroups(costEstimates, content),
      },
    }),
  };
}

/**
 * Print the formatted estimate table shared by the standard and Docusaurus
 * sync paths. Pure display — takes an already-computed CostEstimateSummary
 * shape and writes it through the output controller.
 *
 * @param {CostEstimateSummary['pairs']} costEstimates - Per-pair rows
 * @param {CostEstimateSummary['content']} content - Content-file line, or null
 * @param {number} totalEstimatedCost - Sum of known estimates
 * @param {boolean} hasUnknownCosts - Whether any estimate is unknown
 */
export function printCostTable(costEstimates, content, totalEstimatedCost, hasUnknownCosts) {
  const hasContentLine = content !== null && content.pendingTranslations > 0;
  if (costEstimates.length === 0 && !hasContentLine) return;

  // raw, not info: the table body below is raw, so in --json mode an info
  // header emitted as its own NDJSON event with no data behind it — a
  // dangling "Estimated translation cost:" line agents had to ignore. The
  // structured estimate rides the end-of-run summary (`costEstimate`); the
  // human table stays header-and-body together in default mode.
  output.raw('Estimated translation cost:');
  output.raw('');

  if (costEstimates.length > 0) {
    // Column headers. "Keys" is what will reach the API (and what the
    // estimate prices); "TM hits" is served from cache at $0.
    const maxPair = Math.max(4, ...costEstimates.map(e => e.pair.length));
    const maxMethod = Math.max(6, ...costEstimates.map(e => e.method.length));

    output.raw(`  ${'Pair'.padEnd(maxPair)}  ${'Method'.padEnd(maxMethod)}  ${'Keys'.padStart(6)}  ${'TM hits'.padStart(7)}  ${'Est. Cost'.padStart(10)}`);
    output.raw(`  ${'─'.repeat(maxPair)}  ${'─'.repeat(maxMethod)}  ${'─'.repeat(6)}  ${'─'.repeat(7)}  ${'─'.repeat(10)}`);

    for (const e of costEstimates) {
      // A model on this machine: no API bill, said plainly (not "~$0.0000",
      // which reads like a rounding of a real price). Nothing to send — all
      // of it from the cache, or held back — is free, said so (Round 4,
      // Django persona: a redo served from the cache showed "~$0.0000").
      const costStr = e.local && e.estimatedCost === 0 ? '$0 (local)'
        : e.keys === 0 && e.estimatedCost === 0 ? (e.tmHits > 0 ? 'free (cache)' : '$0 (nothing sent)')
          : e.estimatedCost !== null ? `~$${e.estimatedCost.toFixed(4)}` : 'unknown';
      output.raw(`  ${e.pair.padEnd(maxPair)}  ${e.method.padEnd(maxMethod)}  ${String(e.keys).padStart(6)}  ${String(e.tmHits ?? 0).padStart(7)}  ${costStr.padStart(10)}`);
    }
  }

  if (hasContentLine) {
    const contentCostStr = content.estimatedCost !== null
      ? `~$${content.estimatedCost.toFixed(4)}`
      : 'unknown';
    output.raw(
      `  Content files: ${content.pendingTranslations} pending translation(s) ` +
      `across ${content.files} source file(s)  ${contentCostStr} (rough estimate)`
    );
    // What the Translation Memory is worth on this run: the same work priced
    // as if nothing were cached. Shown so the gate's figure is legible — the
    // cap is compared against the TM-discounted number above, never this one.
    if (typeof content.costWithoutTM === 'number' && content.estimatedCost !== null
        && content.costWithoutTM > content.estimatedCost) {
      output.raw(
        `  Without the Translation Memory this content would cost ~$${content.costWithoutTM.toFixed(4)}; ` +
        `cached text saves ~$${(content.costWithoutTM - content.estimatedCost).toFixed(4)}.`
      );
    }
  }

  // Nothing priced at all (every row "unknown" — e.g. a local model): say
  // unknown, never "~$0.0000+", which reads as free.
  const anyKnown = costEstimates.some((e) => e.estimatedCost !== null)
    || Boolean(content && content.estimatedCost !== null && content.estimatedCost !== undefined);
  const allLocal = costEstimates.length > 0 && costEstimates.every(e => e.local || e.estimatedCost === 0)
    && costEstimates.some(e => e.local) && !hasContentLine;
  // Nothing goes to any method: every queued key comes from the cache (or is held back).
  const nothingSent = costEstimates.length > 0 && costEstimates.every(e => e.keys === 0)
    && (!hasContentLine || content.estimatedCost === 0) && !hasUnknownCosts;
  // What has no price, named: a model (with why on the line below) or a
  // method with no published price — never blamed on "the method" when it
  // is the model name that is unknown (Round 11, Next.js persona).
  const unpriced = hasUnknownCosts ? unpricedGroups(costEstimates, content) : [];
  const named = unpriced.map(g => `${g.subject} (${g.pairs.join(', ')})`).join('; ');
  const totalStr = nothingSent
    ? (costEstimates.some(e => e.tmHits > 0) ? 'free — everything queued is served from the cache' : '$0 — nothing is sent')
    : hasUnknownCosts && !anyKnown
    ? (named ? `unknown — no price for ${named}` : 'unknown — no price for what this run sends')
    : hasUnknownCosts
      ? `~$${totalEstimatedCost.toFixed(4)}+ — plus ${named || 'what has no price'}, which ${unpriced.length > 1 ? 'have' : 'has'} no price`
      : allLocal
        ? '$0 API cost (runs on this machine; your own hardware and power are not counted)'
        : `~$${totalEstimatedCost.toFixed(4)}`;
  output.raw(`\n  Total: ${totalStr}`);
  for (const g of unpriced) {
    if (g.note) output.raw(`  ${g.pairs.join(', ')}: ${g.note}`);
  }
  const held = costEstimates.reduce((n, e) => n + (e.held || 0), 0);
  if (held > 0) {
    output.raw(`  ${held} queued key(s) are held back — refused before by the same method, so not sent (not billed); the sync names them.`);
  }
  // The rate behind the figure, its source and date — one line (Round 14,
  // Next.js persona: the hosted-model estimate gave no rate, source or date).
  const rates = rateLine(ratesUsed(costEstimates, content));
  output.raw(rates || '  Note: Estimates are approximate. Actual cost depends on string length and model pricing.');
  output.raw('');
}

/**
 * Estimate and display translation costs for all pairs that have keys to translate.
 *
 * @param {Array<[string, object]>} pairEntries - Sorted pair graph entries [pairKey, pairConfig]
 * @param {object} sourceFlat - Flattened source locale key-value map
 * @param {object} config - Resolved project config (needs localesDir, fallbackPrefix, forceKeys, contentDir, inputLocale)
 * @param {string} format - Detected format ('json', 'toml', 'yaml')
 * @param {string} ext - File extension for the format (e.g. '.json')
 * @param {string[]} changedKeys - Keys whose source content changed since last sync
 * @param {object} [options]
 * @param {string} [options.cwd] - Project root (content lock file lookup)
 * @param {object} [options.tm] - Loaded Translation Memory (from tm.js loadTM).
 *   Pass the SAME object the run will use so the estimate partitions exactly
 *   like translate-pair.js does. When omitted, the TM is loaded from cwd.
 *   Callers running --no-tm must pass their empty TM object so everything
 *   prices as a miss.
 * @param {object} [options.noTranslate] - Compiled no-translate matcher from
 *   lib/no-translate.js. Pass the SAME instance the run will use so exempt
 *   keys are excluded from the bill by the same decision that excludes them
 *   from translation. Derived from config when omitted.
 * @param {import('./locale-layout.js').LocaleLayout} [options.layout] - The
 *   run's locale layout. With `options.units` the estimate walks every
 *   source file × target file exactly like sync does (namespaces, real
 *   extensions, i18next plural expansion); without them it prices the
 *   single legacy file `<localesDir>/<code><ext>` from the positional args.
 * @param {import('./locale-layout.js').SourceUnit[]} [options.units] - The
 *   run's source units, each with `changedKeys` in its own key space.
 * @param {import('./locale-state.js').LockState} [options.lockState] - The
 *   per-locale record: with it the estimate applies the run's own plan
 *   (lib/locale-state.js planQueue) — pending redo keys are priced as sent,
 *   keys held back (refused before) and hand edits a bulk redo keeps are not.
 * @param {{ named?: string[], bulk?: boolean, fresh?: boolean }} [options.redo]
 * @param {object} [options.collect] - Filled per pair key (pairs with queued
 *   keys) with `{ target, pairConfig, sendTexts, carriedFrom }`: the cached
 *   texts of the keys the run would send, and `{ model: count }` of queued
 *   keys it would serve from an earlier model's translations (carry-over).
 *   Never part of the returned (JSON) estimate.
 * @param {object} [options.collectContent] - Filled per target locale with
 *   `{ pendingTranslations, billedChars }` of its pending Markdown (billedChars:
 *   what the cache does not hold — what is sent). Never part of the estimate.
 * @param {(ctx: { content: object|null }) => void} [options.beforeTable] - Called
 *   once the estimate is computed (options.collect filled), before the table
 *   is printed: what must be said before the figure
 * @returns {Promise<CostEstimateSummary|null>} Structured estimate, or null
 *   when estimation itself failed (callers with --max-cost must fail safe)
 */
export async function printCostEstimate(pairEntries, sourceFlat, config, format, ext, changedKeys, options = {}) {
  const { cwd = process.cwd() } = options;

  try {
    // No-translate keys are never sent to a backend, so they must never be
    // priced. Sharing the caller's compiled matcher (rather than re-deriving
    // one here) is what makes "not billed" a property of the same decision
    // that makes it "not translated" — the two cannot drift apart.
    const noTranslate = options.noTranslate || compileNoTranslate(config);
    const { estimateCost } = await import('./pairs.js');
    // TM partition mirror: diff.toProcess includes keys whose translations
    // the TM already holds (recurring "untranslated" brand-name keys, a
    // reverted source string, …). The real pipeline serves those from cache
    // at $0 — pricing them as fresh API calls made --max-cost abort runs
    // that were nearly free. Pure hash lookups; no network.
    const tm = options.tm || loadTM(cwd);
    const costEstimates = [];
    let totalEstimatedCost = 0;
    let hasUnknownCosts = false;

    // The units to price: the run's own (one per source file, any layout),
    // or — for callers that predate layouts — the one flat file the
    // positional arguments describe.
    const units = options.units || [{
      ns: '', flat: sourceFlat, changedKeys, pluralGroups: new Map(), legacy: true,
    }];
    const layout = options.layout || { namespaced: false };
    const legacyFile = (code) => {
      const p = path.join(config.localesDir, `${code}${ext}`);
      return { path: p, format, rel: `${code}${ext}` };
    };

    for (const [pairKey, pairConfig] of pairEntries) {
      const code = pairConfig.target;
      const tmKey = tmMethodKey(pairConfig);
      // With a fallback: values it produced are cached under its own key.
      // They confirm echoes, and the sync serves them before asking the
      // primary — so they are free here too (lib/fallback.js).
      const tmKeys = tmKeysForPair(pairConfig);
      let stringKeyCount = 0;
      let missCount = 0;
      // Keys held back (refused before by this method): queued, not sent, $0.
      let heldCount = 0;
      // Source text already priced for this locale in an EARLIER file: the
      // run translates files of one locale in sequence, so the second file
      // gets that text from the TM for free. Mirror that, don't bill twice.
      const pricedTexts = new Set();
      // What the caller may want beyond the totals (options.collect): the
      // texts this run would send, and the keys it would serve from an
      // earlier model's translations (model carry-over), per earlier model.
      const sendTexts = [];
      const carriedFrom = {};

      for (const unit of units) {
        const { flat: expectedFlat, expansion } = unit.legacy
          ? { flat: unit.flat, expansion: null }
          : expectedForTarget(unit, config.inputLocale || 'en', code);
        let targetFlat = {};
        let targetFile = null;
        if (unit.legacy) {
          const f = legacyFile(code);
          if (fs.existsSync(f.path)) {
            const data = readLocaleFile(f.path, f.format);
            targetFlat = f.format === 'json' ? flattenKeys(data) : { ...data };
          }
        } else {
          const f = layout.fileFor(code, unit.ns);
          if (fs.existsSync(f.path)) { targetFlat = readLocaleFlat(f); targetFile = f; }
        }

        // Same confirmed-echo suppression the sync's diff applies, so the
        // estimate prices exactly the keys the run will actually queue —
        // including the run's plan over the per-locale record (pending
        // keys, held-back keys, kept hand edits; lib/locale-state.js).
        const localeState = options.lockState && !unit.legacy ? options.lockState.peek(code) : null;
        const lockKeyOf = (k) => (layout.namespaced ? `${unit.ns}::${k}` : k);
        const pendingKeys = new Set(localeState
          ? keysForNamespace(layout, Object.keys(localeState.pending), unit.ns).filter(k => typeof expectedFlat[k] === 'string')
          : []);
        // Plural messages a model left incomplete, asked again this run —
        // the sync's own plan (lib/plural-gap-redo.js), priced as sends.
        const gapKeys = localeState && targetFile
          ? planGapRedo({
            file: targetFile, expected: expectedFlat, targetFlat, locale: code, localeState, lockKeyOf, pairConfig,
            all: !!options.redo?.gaps,
          }).keys
          : [];
        const forceKeys = [...new Set([
          ...mapSourceKeysToTarget(keysForNamespace(layout, config.forceKeys, unit.ns), expansion),
          ...pendingKeys,
          ...gapKeys,
        ])];
        const unitChanged = mapSourceKeysToTarget(unit.changedKeys || [], expansion);
        const diff = diffLocale(
          expectedFlat, targetFlat, config.fallbackPrefix, forceKeys, unitChanged,
          (key, sourceValue) => tmHoldsValue(tm, tmTextFor(key, sourceValue, expansion), code, tmKeys, sourceValue),
          noTranslate.active ? noTranslate.matches : null
        );
        let queued = diff.toProcess;
        let bypass = new Set();
        let notSent = new Set();
        if (localeState) {
          const redo = options.redo || {};
          const plan = planQueue({
            diff, sourceFlat: expectedFlat, targetFlat, lockKeyOf, localeState,
            named: new Set(mapSourceKeysToTarget(keysForNamespace(layout, redo.named || [], unit.ns), expansion)),
            bulk: !!redo.bulk, pending: pendingKeys, fresh: !!redo.fresh, pairConfig,
            classify: createEditClassifier({ tm, locale: code, written: localeState.written, expansion }),
            fallbackPrefix: config.fallbackPrefix,
            redoGaps: redo.gaps ? new Set(gapKeys) : null,
          });
          queued = plan.toProcess;
          // Pending keys and plural gaps asked again bypass the cache.
          bypass = new Set([...plan.pendingAll, ...gapKeys.filter(k => plan.toProcess.includes(k))]);
          notSent = new Set([...plan.held, ...plan.heldFromPrimary]);
        }
        const stringKeys = queued.filter(k => typeof expectedFlat[k] === 'string');
        if (stringKeys.length === 0) continue;

        // Same partition translate-pair.js performs: full method key
        // (method|model|register|coaching), keyed per target locale, on the
        // text each key is CACHED under — a gettext msgctxt is folded in
        // (lib/tm-evict.js), so "Open" (verb) and "Open" (adjective) are two
        // cache entries and two billed strings, exactly as the run sees them.
        const cachedText = {};
        // A borrowed i18next plural form has its own entry (tmTextFor).
        for (const k of stringKeys) cachedText[k] = tmTextFor(k, expectedFlat[k], expansion);
        let { misses } = partitionByTM(tm, cachedText, stringKeys, code, tmKey);
        if (tmKeys.length > 1) {
          misses = misses.filter(k => lookupTM(tm, cachedText[k], code, tmKeys[1]) === null);
        }
        // Pending keys bypass the cache (the model is asked again); keys held
        // back are never sent to the method, so they cost nothing.
        const missSet = new Set(misses);
        heldCount += stringKeys.filter(k => notSent.has(k) && (missSet.has(k) || bypass.has(k))).length;
        misses = stringKeys.filter(k => (missSet.has(k) || bypass.has(k)) && !notSent.has(k));
        for (const k of misses) sendTexts.push(cachedText[k]);
        for (const k of stringKeys) {
          if (missSet.has(k) || bypass.has(k)) continue;
          const model = carriedFromModel(tm, cachedText[k], code, tmKey);
          if (model !== null) carriedFrom[model] = (carriedFrom[model] || 0) + 1;
        }
        stringKeyCount += stringKeys.length;
        for (const k of misses) {
          if (pricedTexts.has(cachedText[k])) continue;
          missCount++;
        }
        // Texts first priced in THIS file still cost here (one batch sends
        // duplicates as separate keys); only later files reuse them.
        for (const k of misses) pricedTexts.add(cachedText[k]);
      }
      if (stringKeyCount === 0) continue;
      const tmHits = stringKeyCount - missCount - heldCount;
      if (options.collect) options.collect[pairKey] = { target: code, pairConfig, sendTexts, carriedFrom };

      if (missCount > 0) {
        // eslint-disable-next-line no-await-in-loop — sequential is fine for cost queries (cached)
        const estimate = await estimateCost(missCount, pairConfig, { cwd });

        if (estimate.estimatedCost !== null) {
          totalEstimatedCost += estimate.estimatedCost;
        } else {
          hasUnknownCosts = true;
        }

        costEstimates.push({
          pair: pairKey,
          method: pairConfig.method || 'llm',
          keys: missCount,
          tmHits,
          ...(heldCount > 0 && { held: heldCount }),
          estimatedCost: estimate.estimatedCost,
          source: estimate.source,
          // A model on this machine: $0 API cost, and why (lib/methods/http-utils.js).
          ...(estimate.local && { local: true }),
          ...(estimate.note && { note: estimate.note }),
          // The rate it was priced at: per 1M tokens (or characters), where
          // the figure came from and when (printCostTable says it in a line).
          ...(estimate.rate && { rate: estimate.rate }),
          // No price: the model it was looked up under, so the table can name it.
          ...(estimate.estimatedCost === null && estimate.model && { model: estimate.model }),
        });
      } else {
        // Fully TM-covered: zero API calls, so the cost is a KNOWN $0 even
        // when the method itself has unknown pricing — this must not trip
        // hasUnknownCosts. (Quality-gate feedback retries can still spend,
        // but they always could and are outside every estimate here.)
        costEstimates.push({
          pair: pairKey,
          method: pairConfig.method || 'llm',
          keys: 0,
          tmHits,
          ...(heldCount > 0 && { held: heldCount }),
          estimatedCost: 0,
          source: tmHits > 0 ? 'translation-memory' : 'nothing-to-send',
        });
      }
    }

    // ── Content files (Hugo Markdown) ─────────────────────────────
    // Counts only the (file × pair) translations the sync would actually
    // run (hash-manifest skip logic), then prices what each one BILLS: the
    // front-matter fields and body blocks the TM does not already hold —
    // the same ladder runContentSync runs (lib/content-estimate.js). The
    // character → cost step stays rough (see priceContentChars), but the
    // TM discount is exact, so --max-cost compares against what the run
    // will pay rather than the whole file (dogfood 2026-08-28, finding 1).
    let content = null;
    if (config.contentDir) {
      const pending = countPendingContentTranslations(
        config.contentDir, config.inputLocale || 'en', pairEntries, cwd,
        {
          tm, translatableFields: config.translatableFields,
          fileScope: options.fileScope || null, forceContent: !!options.forceContent,
          fresh: !!options.redo?.fresh,
        }
      );
      if (pending.pendingTranslations > 0) {
        const billedByPair = new Map();
        const roughByPair = new Map();
        for (const [, pairConfig] of pairEntries) {
          const perTarget = pending.byTarget[pairConfig.target];
          if (!perTarget || perTarget.pendingTranslations === 0) continue;
          // What the caller may want per target (options.collectContent):
          // whether this run sends Markdown to the pair's method at all.
          if (options.collectContent) {
            options.collectContent[pairConfig.target] = {
              pendingTranslations: perTarget.pendingTranslations, billedChars: perTarget.billedChars,
            };
          }
          billedByPair.set(pairConfig, perTarget.billedChars);
          roughByPair.set(pairConfig, perTarget.pendingSourceChars);
        }
        const billed = await priceContentChars(billedByPair, pairEntries, estimateCost);
        const rough = await priceContentChars(roughByPair, pairEntries, estimateCost);
        content = {
          files: pending.sourceFileCount,
          pendingTranslations: pending.pendingTranslations,
          estimatedCost: billed.unknown ? null : billed.cost,
          costWithoutTM: rough.unknown ? null : rough.cost,
          rough: true,
          // Which pairs have no price, and why (printCostTable names them).
          ...(billed.unknown && { unpriced: billed.unpriced }),
          // The rates the billed part was priced at.
          ...(billed.rates.length > 0 && { rates: billed.rates }),
        };
        if (billed.unknown) hasUnknownCosts = true;
        else totalEstimatedCost += billed.cost;
      } else {
        content = {
          files: pending.sourceFileCount, pendingTranslations: 0,
          estimatedCost: 0, costWithoutTM: 0, rough: true,
        };
      }
    }

    // ── Display ────────────────────────────────────────────────────
    // What the caller must say BEFORE the figure (options.beforeTable): the
    // model carry-over notice — translations reused from the previous model
    // are part of why the cost is what it is (Round 7, Next.js persona: the
    // table said "TM hits 1, free (cache)" and the reuse was named after it).
    if (typeof options.beforeTable === 'function') options.beforeTable({ content });
    printCostTable(costEstimates, content, totalEstimatedCost, hasUnknownCosts);

    return summarizeEstimate(costEstimates, content, totalEstimatedCost, hasUnknownCosts);
  } catch (costError) {
    // Cost estimation is non-blocking when no cap is set — log and continue.
    // Callers enforcing --max-cost must treat the null return as unknown.
    output.warn(`Cost estimation failed: ${costError.message}`);
    return null;
  }
}
