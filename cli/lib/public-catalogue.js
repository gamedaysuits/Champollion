/**
 * The public corpus catalogue, read without a key: the `datasets` table the
 * harness and the leaderboard resolve corpora against (anon SELECT, public
 * segments only — mt-eval-arena/supabase/migrations/016_datasets_rls.sql),
 * through the same read-only REST path the CLI already uses for language
 * cards (lib/cards/remote.js fetchJson, lib/cards/env.js endpoint + key).
 *
 * Used by `network register-corpus` on an npm install, which ships no
 * corpora cards: a private / local-only / sealed registration of a file that
 * is a byte-identical copy of a public benchmark must not be graded
 * "Contamination: NONE" just because the comparison was never made (Round 9,
 * researcher persona).
 *
 * PRIVACY: the file's sha256 never leaves the machine. The catalogue's
 * (id, sha256) pairs are downloaded and compared HERE; only a matching
 * PUBLIC id is then looked up for its name and licence.
 *
 * Fail-soft: offline (CHAMPOLLION_OFFLINE=1), unreachable, or an answer that
 * is not the expected shape → `{ ok: false, why }`, never a guess. The caller
 * then records the comparison as not made.
 */

import { fetchJson } from './cards/remote.js';
import { SUPABASE_URL, OFFLINE } from './cards/env.js';

/** PostgREST caps a response at 1000 rows on Supabase. */
const PAGE = 1000;
/** A bound on the whole read: a catalogue far larger than this is not this table. */
const MAX_PAGES = 50;

/**
 * Look for public corpora whose built file has one of these sha256s.
 *
 * @param {string[]} sha256s - lower-case hex digests of the local files
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: true, compared: number, hits: Map<string, { id: string, name: string, license: string|null }> }
 *   | { ok: false, why: string }>}
 *   compared: how many public corpora were compared against; hits: sha256 → corpus
 */
export async function findPublicCorporaBySha(sha256s, { timeoutMs = 8000 } = {}) {
  if (OFFLINE) return { ok: false, why: 'offline (CHAMPOLLION_OFFLINE=1)' };
  const wanted = new Set(sha256s.map(s => String(s).toLowerCase()));
  const found = new Map(); // sha → id
  let compared = 0;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        select: 'id,sha256', sha256: 'not.is.null', order: 'id.asc', limit: String(PAGE), offset: String(page * PAGE),
      });
      // eslint-disable-next-line no-await-in-loop — pages in order; one at a time is polite to the endpoint
      const rows = await fetchJson(`${SUPABASE_URL}/rest/v1/datasets?${params}`, { timeoutMs, retries: 1 });
      if (!Array.isArray(rows)) return { ok: false, why: 'the public catalogue answered in an unexpected shape' };
      for (const r of rows) {
        if (!r || typeof r.sha256 !== 'string') continue;
        compared++;
        const sha = r.sha256.toLowerCase();
        if (wanted.has(sha) && !found.has(sha)) found.set(sha, String(r.id));
      }
      if (rows.length < PAGE) break;
    }
    const hits = new Map();
    for (const [sha, id] of found) {
      const params = new URLSearchParams({ select: 'id,name,license', id: `eq.${id}`, limit: '1' });
      // eslint-disable-next-line no-await-in-loop — at most one lookup per local file
      const [row] = await fetchJson(`${SUPABASE_URL}/rest/v1/datasets?${params}`, { timeoutMs, retries: 1 });
      hits.set(sha, { id, name: row?.name || id, license: row?.license || null });
    }
    if (compared === 0) return { ok: false, why: 'the public catalogue listed no corpus checksums' };
    return { ok: true, compared, hits };
  } catch (err) {
    const reason = err?.status ? `HTTP ${err.status}` : (err?.name === 'TimeoutError' ? 'no answer in time' : (err?.cause?.code || err?.message || 'unreachable'));
    return { ok: false, why: `the public catalogue could not be read (${reason})` };
  }
}
