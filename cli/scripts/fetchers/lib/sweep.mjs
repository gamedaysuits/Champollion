/**
 * sweep.mjs — long multi-request fetches that resume, degrade honestly, and
 * do not punish the server for our mistakes.
 *
 * WHY THIS EXISTS, CONCRETELY
 *   The OPUS index needs one request per corpus: 1,215 requests, about forty
 *   minutes. The first version threw away the entire run if any single request
 *   failed, on the correct principle that a partial index pinned as complete
 *   would assert that corpora do not exist. But "fail loud" was implemented as
 *   "fail entirely", which has three bad consequences:
 *
 *     1. One dropped request at corpus 301 discards 300 successful ones, and
 *        the retry re-asks for all 301 again.
 *     2. Changing ONE FIELD in the output re-fetches all 1,215 records that
 *        were already on disk and unchanged.
 *     3. Doing that three times in a day got us ECONNRESET from a university
 *        server, which is not a bug to route around. It is the server saying
 *        no, and it was right to.
 *
 * THE DISTINCTION THAT MAKES DEGRADATION HONEST
 *   Refusing to pin anything is not the only alternative to pretending a
 *   partial sweep is complete. A third option is to pin what we have AND say
 *   exactly what is missing, so no consumer can mistake a gap for an absence:
 *
 *     complete    every item answered            → pin normally
 *     partial     some failed, each NAMED        → pin, with the gap declared
 *                                                  in the snapshot
 *     too thin    below the caller's floor       → refuse; this is a fetch
 *                                                  failure, not a small dataset
 *
 *   The caller sets the floor, because only it knows what fraction is
 *   meaningful. What is NOT optional is naming the failures: a partial sweep
 *   that does not list what it missed is the thing this whole rebuild exists
 *   to prevent.
 *
 * RESUME IS THE POINT
 *   Progress is journalled to disk as it goes. A re-run reads the journal,
 *   skips what already succeeded, and asks only for what is missing — so a
 *   blocked sweep is picked up rather than restarted, and a field change costs
 *   one pass over local data instead of another thousand requests. The journal
 *   is keyed by item, so it stays valid across code changes to the extraction.
 *
 * BACKING OFF IS NOT OPTIONAL
 *   On a connection reset or a 429 the delay escalates for the REST OF THE
 *   SWEEP, not just the retry. A server that has started refusing us is not
 *   helped by continuing at the same rate and hoping.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT } from './fetch-lib.mjs';

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Signals that the server is refusing, not that one request went wrong. */
const REFUSAL = /ECONNRESET|429|503|rate.?limit|too many requests/i;

function journalPath(dir) {
  return path.join(DATA_ROOT, dir, '.sweep-progress.json');
}

/** @returns {{done: Record<string, unknown>, failed: Record<string, string>}} */
export function readJournal(dir) {
  try {
    return JSON.parse(fs.readFileSync(journalPath(dir), 'utf-8'));
  } catch {
    return { done: {}, failed: {} };
  }
}

export function clearJournal(dir) {
  try { fs.unlinkSync(journalPath(dir)); } catch { /* already gone */ }
}

/**
 * Run `fn` over `items`, resuming from any previous run.
 *
 * @param {object} spec
 * @param {string}   spec.dir        data directory, for the journal
 * @param {string[]} spec.items      item keys, stable across runs
 * @param {(item: string) => Promise<unknown>} spec.fn
 * @param {number}   [spec.delayMs]  polite gap between requests
 * @param {number}   [spec.attempts] retries per item before giving up on it
 * @param {number}   [spec.minComplete] fraction that must succeed, else throw
 * @param {(p: {i: number, n: number, failed: number}) => void} [spec.onProgress]
 * @returns {Promise<{results: Record<string, unknown>, failed: Record<string, string>,
 *                    complete: boolean, resumedFrom: number}>}
 */
export async function sweep({
  dir, items, fn,
  delayMs = 150, attempts = 4, minComplete = 0.95, onProgress,
}) {
  const journal = readJournal(dir);
  const results = { ...journal.done };
  const failed = {};
  const resumedFrom = Object.keys(results).length;

  fs.mkdirSync(path.join(DATA_ROOT, dir), { recursive: true });
  // Every item, not only new ones — an item that failed last time is retried,
  // because the reason was usually the server and not the item.
  const todo = items.filter((k) => !(k in results));

  // Escalates on refusal and never comes back down within a run. A server that
  // has started refusing us is not helped by us continuing at the same rate.
  let delay = delayMs;
  let flush = 0;

  for (const [i, item] of todo.entries()) {
    let lastError = null;
    for (let a = 0; a < attempts; a++) {
      try {
        results[item] = await fn(item);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (REFUSAL.test(String(err?.message ?? err))) {
          delay = Math.min(5_000, delay * 4);
        }
        await sleep(Math.min(30_000, 1000 * 2 ** a));
      }
    }
    // Recorded and skipped, NOT fatal. The name is kept so the snapshot can
    // say which items are missing rather than merely how many.
    if (lastError) failed[item] = String(lastError?.message ?? lastError).slice(0, 200);

    // Journalled periodically so a kill -9 costs at most this many requests.
    if (++flush >= 25 || i === todo.length - 1) {
      flush = 0;
      fs.writeFileSync(journalPath(dir), JSON.stringify({ done: results, failed }));
    }
    onProgress?.({ i: i + 1, n: todo.length, failed: Object.keys(failed).length });
    await sleep(delay);
  }

  const got = items.filter((k) => k in results).length;
  const ratio = items.length ? got / items.length : 0;
  if (ratio < minComplete) {
    // Below the floor this is not a small dataset, it is a failed fetch, and
    // the journal is deliberately kept so the next run resumes instead of
    // starting the whole thing again.
    throw new Error(
      `swept ${got} of ${items.length} (${(ratio * 100).toFixed(1)}%), below the `
      + `${(minComplete * 100).toFixed(0)}% floor. Progress is journalled — re-run to `
      + `resume from here rather than restarting. First failures: `
      + `${Object.entries(failed).slice(0, 3).map(([k, v]) => `${k} (${v})`).join('; ')}`,
    );
  }

  return {
    results, failed, complete: !Object.keys(failed).length, resumedFrom,
  };
}
