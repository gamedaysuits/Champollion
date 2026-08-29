/**
 * Bounded concurrency utilities — zero-dependency.
 *
 * WHY: The content sync pipeline makes hundreds of sequential API calls
 * (32 files × 12 locales = 384 translations). Parallelizing the inner
 * locale loop with a concurrency cap of 4-6 gives ~5-6x speedup without
 * overwhelming the API's rate limits.
 *
 * This module provides a `pMap` function similar to the popular `p-map`
 * npm package, but with zero dependencies — consistent with champollion's
 * zero-dependency policy.
 *
 * WORKER POOL PATTERN:
 *   Instead of launching all tasks and throttling with a semaphore,
 *   we spawn exactly `concurrency` worker coroutines that pull from
 *   a shared index. This naturally limits in-flight work and avoids
 *   the thundering-herd problem on completion.
 *
 * USAGE:
 *   import { pMap } from './concurrent.js';
 *
 *   // Translate all locales for a file, max 6 at a time
 *   await pMap(pairEntries, async ([, pairConfig]) => {
 *     await translateFile(sourcePath, pairConfig);
 *   }, { concurrency: 6 });
 */

/**
 * Map over an iterable with bounded concurrency.
 *
 * Executes `fn` for each item, but never more than `concurrency`
 * invocations run simultaneously. Results are returned in the same
 * order as the input items (not completion order).
 *
 * Errors in individual items are collected but do NOT abort other
 * in-flight work. After all items complete, the first error (if any)
 * is thrown. For content sync, the caller wraps each item in its own
 * try/catch, so errors are handled per-item rather than here.
 *
 * @param {Array} items - Items to iterate over
 * @param {Function} fn - Async function (item, index) => result
 * @param {object} [options]
 * @param {number} [options.concurrency=6] - Max simultaneous executions
 * @returns {Promise<Array>} Results in input order
 */
async function pMap(items, fn, { concurrency = 6 } = {}) {
  // Validate concurrency: a value < 1 (0, negative, NaN) would spawn zero
  // workers via Math.min below, silently process nothing, and return a
  // hole-filled array — the caller would "succeed" having written nothing.
  // Reject loudly instead.
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new Error(`pMap: concurrency must be a finite integer >= 1 (got ${concurrency})`);
  }

  const results = new Array(items.length);
  let nextIndex = 0;
  // Collect per-item errors WITHOUT aborting siblings — this honors the
  // docstring's per-item-isolation contract. An exception in one item used to
  // reject the whole Promise.all and discard every already-computed sibling
  // result (e.g. already-paid translations for other locales). We now finish
  // every item and rethrow the first error afterward.
  let firstError = null;

  async function worker() {
    while (nextIndex < items.length) {
      // Claim the next index atomically (single-threaded JS — no race)
      const i = nextIndex++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        if (firstError === null) firstError = err;
      }
    }
  }

  // Spawn exactly `concurrency` workers (or fewer if items < concurrency)
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  if (firstError !== null) throw firstError;

  return results;
}

export { pMap };
