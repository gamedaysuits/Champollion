/**
 * supabaseRuns.js — build-time, read-only access to the Arena scoreboard
 * (Supabase `run_cards` / `run_card_entries` / `datasets`) for the homepage
 * data generators.
 *
 * WHY: the homepage hero (field.json) and language map (graph.json) build
 * from the DB — the system of record, filled by people running the harness
 * (queue or solo) — NEVER from local harness run logs. See
 * the data-source design rule: the DB is the system of record.
 *
 * The anon key is public (RLS makes it read-only) and is the same one the
 * leaderboard embeds (cli/website/src/pages/leaderboard.js). Override with
 * SUPABASE_URL / SUPABASE_ANON_KEY to point at a dev/staging branch.
 *
 * Gating note: callers join `datasets` and apply the license/segment/
 * quarantine gate in JS (clear + unit-testable; avoids PostgREST embedded-
 * filter quirks). `run_card_entries` is anon-readable in full, so the gate
 * is what keeps NC (EdTeKLA) and held-out/gold-standard sentence text off
 * the public homepage — see gateEligibleRuns() in generateFieldJson.js.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

/**
 * Paged GET against a PostgREST table (Range pagination, same as the
 * leaderboard). Returns all rows. Throws on a non-2xx response so the
 * caller can fall back to the committed snapshot rather than ship bad data.
 */
async function fetchAll(table, query = '', pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
    const resp = await fetch(url, {
      headers: {...HEADERS, Range: `${offset}-${offset + pageSize - 1}`},
    });
    if (!resp.ok) {
      throw new Error(
        `Supabase ${table} ${resp.status}: ${(await resp.text()).slice(0, 200)}`,
      );
    }
    const page = await resp.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/**
 * Distinct benchmarked language pairs ("src>tgt") for the graph's "lit"
 * coverage set — a language is lit if it appears (either side) in any
 * non-disqualified run. No text is exposed, so no license gate here.
 * @returns {Promise<Set<string>>}
 */
async function fetchBenchmarkedPairs() {
  const rows = await fetchAll(
    'run_cards',
    'select=language_pair&trust=neq.disqualified&language_pair=not.is.null',
  );
  return new Set(rows.map((r) => r.language_pair).filter(Boolean));
}

/**
 * All non-disqualified run_cards that have a composite score, plus the
 * (small) datasets table. The caller joins on dataset_id and applies the
 * license/segment/quarantine gate in JS.
 * @returns {Promise<{runs: object[], datasets: object[]}>}
 */
async function fetchRunsAndDatasets() {
  const [runs, datasets] = await Promise.all([
    fetchAll(
      'run_cards',
      'select=id,model_slug,language_pair,condition,composite_score,' +
        'chrf_plus_plus,dataset_id,run_timestamp,submitted_at,trust' +
        '&trust=neq.disqualified&composite_score=not.is.null',
    ),
    fetchAll(
      'datasets',
      'select=id,name,language_pair,source_language,target_language,' +
        'license,segment,quarantined,source',
    ),
  ]);
  return {runs, datasets};
}

/**
 * Per-entry rows (sentence text + per-entry chrF++) for one run, for the
 * hero flows. run_card_entries is anon-readable; the caller has already
 * gated the run by license/segment, so these are publish-safe sentences.
 * @returns {Promise<object[]>}
 */
async function fetchRunEntries(runCardId) {
  return fetchAll(
    'run_card_entries',
    'select=entry_id,source,predicted,expected,chrf_score' +
      `&run_card_id=eq.${encodeURIComponent(runCardId)}`,
  );
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  fetchBenchmarkedPairs,
  fetchRunsAndDatasets,
  fetchRunEntries,
};
