/**
 * Cache staleness check — invalidates cached cards whose per-language
 * updated_at moved upstream.
 *
 * Called by bin/cli.js before command dispatch (packaged installs
 * only), at most once per REFRESH_TTL_HOURS, and exported through
 * index.js for programmatic consumers. One cheap query asks the index
 * for rows changed since the last check; matching cache entries are
 * deleted and refetched lazily on next use.
 *
 * Two timestamps in _state.json, deliberately distinct:
 *   lastRefreshCheckAt — client clock; only drives the TTL gate
 *   updatedCursor      — server-derived (max updated_at seen); drives
 *                        the `updated_at=gt.…` query, so client/server
 *                        clock skew can never skip an update
 *
 * Never throws: a CLI run must not fail because the network did.
 */

import { OFFLINE, hasLocalCardsDir, REFRESH_TTL_HOURS } from './env.js';
import { fetchIndexRows, fetchJson, SUPABASE_URL, SUPABASE_ANON_KEY } from './remote.js';
import {
  readState,
  writeState,
  inBackoff,
  noteNetworkFailure,
  clearBackoff,
  readCachedCard,
  removeCachedCard,
  listCachedCodes,
  clearTombstones,
} from './cache.js';

/** Server-side max updated_at — skew-free cursor initialization. */
async function fetchServerCursor(timeoutMs) {
  const params = new URLSearchParams({
    select: 'updated_at',
    order: 'updated_at.desc',
    limit: '1',
  });
  const rows = await fetchJson(
    `${SUPABASE_URL}/rest/v1/trading_card_index?${params}`,
    { timeoutMs },
  );
  return rows[0]?.updated_at || null;
}

/**
 * Check for upstream card updates and drop stale cache entries.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.force] - ignore TTL and backoff gates
 * @param {number} [opts.timeoutMs] - per-request budget (keep small in
 *   the CLI hot path; a slow network must not stall commands)
 * @returns {Promise<{skipped?: string, checked?: number, invalidated?: number, error?: string}>}
 */
export async function maybeRefreshCardCache({ force = false, timeoutMs = 4000 } = {}) {
  if (hasLocalCardsDir()) return { skipped: 'repo-mode' };
  if (OFFLINE) return { skipped: 'offline' };

  const state = readState();
  if (!force) {
    const last = state.lastRefreshCheckAt ? Date.parse(state.lastRefreshCheckAt) : 0;
    if (Date.now() - last < REFRESH_TTL_HOURS * 3600 * 1000) return { skipped: 'fresh' };
    if (inBackoff(state)) return { skipped: 'backoff' };
  }

  try {
    // First run: establish the server-time cursor and stop. There is
    // nothing cached from before this moment to invalidate.
    if (!state.updatedCursor) {
      const cursor = (await fetchServerCursor(timeoutMs)) || new Date().toISOString();
      clearBackoff();
      writeState({ lastRefreshCheckAt: new Date().toISOString(), updatedCursor: cursor });
      return { checked: 0, invalidated: 0 };
    }

    const changed = await fetchIndexRows({
      select: 'code,updated_at',
      since: state.updatedCursor,
      timeoutMs,
    });

    let invalidated = 0;
    let cursor = state.updatedCursor;
    if (changed.length > 0) {
      const cached = new Set(listCachedCodes());
      for (const row of changed) {
        if (row.updated_at && row.updated_at > cursor) cursor = row.updated_at;
        if (!cached.has(row.code)) continue;
        const entry = readCachedCard(row.code);
        if (!entry || !entry.updatedAt || entry.updatedAt < row.updated_at) {
          removeCachedCard(row.code);
          invalidated++;
        }
      }
      // A language that appeared (or reappeared) upstream is no longer
      // missing — let the next lookup fetch it.
      clearTombstones(changed.map(r => r.code));
    }

    clearBackoff();
    writeState({ lastRefreshCheckAt: new Date().toISOString(), updatedCursor: cursor });
    return { checked: changed.length, invalidated };
  } catch (err) {
    noteNetworkFailure();
    return { error: err?.message || String(err) };
  }
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
