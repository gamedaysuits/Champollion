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
import { EST_CHARS_PER_KEY } from './config.js';
import { countPendingContentTranslations } from './content-sync.js';
import { loadTM, lookupTM, partitionByTM, tmMethodKey } from './tm.js';
import { compileNoTranslate } from './no-translate.js';
import { output } from './output.js';

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
 * @property {{ files: number, pendingTranslations: number, estimatedCost: number|null, rough: true }|null} content
 *   Rough content-file estimate when contentDir is configured, else null
 * @property {number} totalEstimatedCost - keyCost + known content cost
 * @property {boolean} hasUnknownCosts - True when ANY pair or the content
 *   estimate is unknown. Consumers enforcing --max-cost must treat this as
 *   over-cap (unknown ≠ free).
 */

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
  const estimateStr = estimatedCost !== null ? `~$${estimatedCost.toFixed(4)}` : 'unknown';
  const message = `${reason} Estimated cost: ${estimateStr}, --max-cost cap: $${maxCost.toFixed(4)}. ` +
    'Aborting before any API call.';
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
      const costStr = e.estimatedCost !== null ? `~$${e.estimatedCost.toFixed(4)}` : 'unknown';
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
  }

  const totalStr = hasUnknownCosts
    ? `~$${totalEstimatedCost.toFixed(4)}+ (some methods have unknown pricing)`
    : `~$${totalEstimatedCost.toFixed(4)}`;
  output.raw(`\n  Total: ${totalStr}`);
  output.raw('  Note: Estimates are approximate. Actual cost depends on string length and model pricing.');
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

    for (const [pairKey, pairConfig] of pairEntries) {
      const code = pairConfig.target;
      const filename = `${code}${ext}`;
      const filePath = path.join(config.localesDir, filename);

      let targetFlat = {};
      if (fs.existsSync(filePath)) {
        const data = readLocaleFile(filePath, format);
        targetFlat = format === 'json' ? flattenKeys(data) : { ...data };
      }

      // Same confirmed-echo suppression the sync's diff applies, so the
      // estimate prices exactly the keys the run will actually queue.
      const tmKey = tmMethodKey(pairConfig);
      const diff = diffLocale(
        sourceFlat, targetFlat, config.fallbackPrefix, config.forceKeys, changedKeys,
        (key, sourceValue) => lookupTM(tm, sourceValue, code, tmKey) === sourceValue,
        noTranslate.active ? noTranslate.matches : null
      );
      const stringKeys = diff.toProcess.filter(k => typeof sourceFlat[k] === 'string');
      if (stringKeys.length === 0) continue;

      // Same partition translate-pair.js performs: full method key
      // (method|model|register|coaching), keyed per target locale.
      const { misses } = partitionByTM(tm, sourceFlat, stringKeys, code, tmKey);
      const tmHits = stringKeys.length - misses.length;

      if (misses.length > 0) {
        // eslint-disable-next-line no-await-in-loop — sequential is fine for cost queries (cached)
        const estimate = await estimateCost(misses.length, pairConfig);

        if (estimate.estimatedCost !== null) {
          totalEstimatedCost += estimate.estimatedCost;
        } else {
          hasUnknownCosts = true;
        }

        costEstimates.push({
          pair: pairKey,
          method: pairConfig.method || 'llm',
          keys: misses.length,
          tmHits,
          estimatedCost: estimate.estimatedCost,
          source: estimate.source,
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
          estimatedCost: 0,
          source: 'translation-memory',
        });
      }
    }

    // ── Content files (Hugo Markdown) — ROUGH estimate ─────────────
    // Counts only the (file × pair) translations the sync would actually
    // run (hash-manifest skip logic), then prices each pair's pending
    // source characters as EST_CHARS_PER_KEY-char key-equivalents through
    // the pair's own estimateCost(). Exact for char-priced providers
    // (google/deepl/…: key-equivalents × 25 chars = the real characters);
    // deliberately CONSERVATIVE for token-priced LLM models, where each
    // 25-char slice is priced as if it paid full per-key prompt overhead.
    // NOT TM-partitioned (unlike the key-value table above): content-sync
    // caches whole bodies/front-matter fields in the TM, but mirroring that
    // here would mean parsing every pending file — kept rough instead.
    // Rough by design — fail-safe overestimates rather than under.
    let content = null;
    if (config.contentDir) {
      const pending = countPendingContentTranslations(
        config.contentDir, config.inputLocale || 'en', pairEntries, cwd
      );
      let contentCost = 0;
      let contentUnknown = false;
      if (pending.pendingTranslations > 0) {
        for (const [, pairConfig] of pairEntries) {
          const perTarget = pending.byTarget[pairConfig.target];
          if (!perTarget || perTarget.pendingTranslations === 0) continue;
          const keyEquivalents = Math.ceil(perTarget.pendingSourceChars / EST_CHARS_PER_KEY);
          // eslint-disable-next-line no-await-in-loop — sequential is fine for cost queries (cached)
          const estimate = await estimateCost(keyEquivalents, pairConfig);
          if (estimate.estimatedCost !== null) {
            contentCost += estimate.estimatedCost;
          } else {
            contentUnknown = true;
          }
        }
      }
      content = {
        files: pending.sourceFileCount,
        pendingTranslations: pending.pendingTranslations,
        estimatedCost: contentUnknown ? null : contentCost,
        rough: true,
      };
      if (contentUnknown) {
        hasUnknownCosts = true;
      } else {
        totalEstimatedCost += contentCost;
      }
    }

    // ── Display ────────────────────────────────────────────────────
    printCostTable(costEstimates, content, totalEstimatedCost, hasUnknownCosts);

    return {
      currency: 'USD',
      pairs: costEstimates,
      keyCost: content && content.estimatedCost !== null
        ? totalEstimatedCost - content.estimatedCost
        : totalEstimatedCost,
      content,
      totalEstimatedCost,
      hasUnknownCosts,
    };
  } catch (costError) {
    // Cost estimation is non-blocking when no cap is set — log and continue.
    // Callers enforcing --max-cost must treat the null return as unknown.
    output.warn(`Cost estimation failed: ${costError.message}`);
    return null;
  }
}
