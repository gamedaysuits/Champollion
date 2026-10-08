/**
 * refresh.mjs — bring pins up to date before a build, politely.
 *
 * ONE COMMAND, WHICH IS THE POINT
 *   `build-atlas.mjs --fetch` refreshes stale sources and then builds, so
 *   "cards from source" is one thing you run rather than a sequence you have to
 *   remember. Without it the build is only as current as whenever somebody last
 *   ran a fetcher by hand, and nothing says which sources those were.
 *
 * STALE IS DECLARED, NOT GUESSED
 *   A fetcher says how often its upstream is worth re-asking, via
 *   `manifest.refreshDays`. That is a property of the SOURCE, not of the build:
 *   ISO 639-3 changes once a year, HuggingFace changes hourly, and a single
 *   global interval would either hammer the stable ones or let the volatile
 *   ones rot. The default is deliberately conservative.
 *
 * WHY IT REFUSES TO REFETCH EVERYTHING BY DEFAULT
 *   OPUS is 1,215 requests and about forty minutes. Refetching it three times
 *   in one day to change a single output field earned an ECONNRESET from a
 *   university server, which was the correct response to what we were doing. So
 *   `--fetch` refreshes only what is actually stale, `--fetch-all` is the
 *   explicit override, and a source that is fresh is reported as skipped rather
 *   than silently passed over — "nothing needed doing" and "nothing happened"
 *   must not look the same.
 *
 * A FAILED REFRESH IS NOT A FAILED BUILD
 *   An upstream being down is not a reason to lose a build that could run
 *   perfectly well from the pins already on disk. A refresh failure is
 *   reported, named, and the build continues on the existing pin — which is
 *   still verified, still cited, and still honest about its retrieval date.
 *   What is NOT allowed is proceeding quietly: the source and the reason come
 *   back so the caller can print them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');
const FETCHERS = path.join(__dirname, '..', 'fetchers');
const DATA = path.join(REPO, 'cli', 'data');

/**
 * How long a pin may go unrefreshed before `--fetch` re-asks. Conservative on
 * purpose: re-asking too often costs somebody else's bandwidth, and a pin is
 * dated so an old one is honest rather than wrong.
 */
const DEFAULT_REFRESH_DAYS = 30;

const daysSince = (iso) => {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
};

/**
 * Refresh pins that are stale.
 *
 * @param {{ all?: boolean, only?: string[], now?: () => number }} opts
 * @returns {Promise<{refreshed: string[], skipped: Array<{source: string, ageDays: number}>,
 *                    failed: Array<{source: string, why: string}>}>}
 */
export async function refreshSources({ all = false, only = null } = {}) {
  const refreshed = [];
  const skipped = [];
  const failed = [];

  for (const file of fs.readdirSync(FETCHERS).sort()) {
    if (!file.endsWith('.mjs')) continue;
    let mod;
    try {
      mod = await import(pathToFileURL(path.join(FETCHERS, file)).href);
    } catch (err) {
      failed.push({ source: file, why: `will not import: ${err.message}` });
      continue;
    }
    if (!mod.source || typeof mod.fetchSource !== 'function') continue;
    if (only && !only.includes(mod.source)) continue;

    // cldf-zenodo pins per dataset and refuses to fetch 2.3 GB without being
    // told which — a deliberate guard, not a defect. Refreshing it is its own
    // deliberate act, never a side effect of building.
    if (!mod.dir) {
      skipped.push({ source: mod.source, ageDays: null, why: 'multi-dataset; refresh explicitly' });
      continue;
    }

    const snapPath = path.join(DATA, mod.dir, 'SNAPSHOT.json');
    let age = Infinity;
    if (fs.existsSync(snapPath)) {
      try {
        age = daysSince(JSON.parse(fs.readFileSync(snapPath, 'utf-8')).fetchedAt);
      } catch { age = Infinity; }
    }
    const maxAge = mod.manifest?.refreshDays ?? DEFAULT_REFRESH_DAYS;

    if (!all && age < maxAge) {
      // Named, not silently passed over. "Nothing needed doing" and "nothing
      // happened" are different facts and a build should be able to say which.
      skipped.push({ source: mod.source, ageDays: Math.round(age) });
      continue;
    }

    try {
      await mod.fetchSource({ refetch: true });
      refreshed.push(mod.source);
    } catch (err) {
      // An upstream being down does not invalidate the pin already on disk.
      // That pin is still verified, still cited, and still honest about when it
      // was retrieved — so the build goes on and this comes back to be printed.
      failed.push({ source: mod.source, why: err.message.slice(0, 200) });
    }
  }

  return { refreshed, skipped, failed };
}
