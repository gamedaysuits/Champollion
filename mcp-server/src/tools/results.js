/**
 * Results tools — read the public Champollion leaderboard (scored run_cards).
 *
 * This is the read side that closes the contribute → run → see-impact loop:
 * an agent can run_benchmark (which spends real API credits) and then query
 * what it scored, or browse what the community has already benchmarked.
 *
 * Public read path: the SAME Supabase project + anon key the public
 * leaderboard embeds (cli/website/src/pages/leaderboard.js). The anon key is
 * public and RLS makes run_cards read-only — there is no secret here. Override
 * with CHAMPOLLION_SUPABASE_URL / CHAMPOLLION_SUPABASE_ANON_KEY to point at a
 * dev/staging branch (CHAMPOLLION_-prefixed so an unrelated SUPABASE_URL in
 * the user's environment can't accidentally repoint the MCP server).
 *
 * Sovereignty note: these tools expose only the scored AGGREGATE columns
 * (composite, chrF++, BLEU, COMET, cost, trust) plus the run_card metadata
 * card — the same fields the public leaderboard already serves. Per-entry
 * sentence text lives in the separately license/quarantine-gated
 * run_card_entries table and is never read here.
 */

const SUPABASE_URL =
  process.env.CHAMPOLLION_SUPABASE_URL ||
  'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.CHAMPOLLION_SUPABASE_ANON_KEY ||
  'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

const SB_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
};

/**
 * Scored aggregate columns only — mirrors leaderboard.js LISTING_SELECT,
 * trimmed to what an agent needs. NO per-entry sentence text.
 *
 * `contamination:run_card->>contamination` extracts the grade publish.py stamps
 * into the run_card JSONB (there is no top-level column). Without it an agent
 * gets no contamination signal at all and could co-rank a relative-only
 * (HIGH/FLORES) corpus against absolute-quality corpora as if they were equal.
 */
export const RESULTS_SELECT = [
  'id', 'submitter', 'model_slug', 'condition', 'dataset_id',
  'language_pair', 'composite_score', 'quality_tier', 'trust',
  'chrf_plus_plus', 'corpus_bleu', 'comet_score', 'ter',
  'total_cost_usd', 'cost_per_entry_usd', 'run_timestamp', 'submitted_at',
  'contamination:run_card->>contamination',
].join(',');

// ---------------------------------------------------------------------------
// Contamination lane — FAIL SAFE. Self-contained mirror of the website's
// cli/website/src/utils/contaminationBadge.js (mcp-server is a separate npm
// package, so it can't import it) and the SSOT lane policy in
// arena/mt_eval_harness/contamination.py.
//
// Policy: a corpus is RELATIVE-COMPARISON-ONLY (its scores rank methods against
// each other on THAT corpus, never as absolute quality) when its contamination
// grade is HIGH or MEDIUM, OR when the grade is unknown/unset. Only a positively
// LOW grade is rankable on absolute quality. Defaulting unknown to the absolute
// lane is the "fails open" bug this guards against: a prod-missing or ungraded
// HIGH corpus must never be co-ranked as trustworthy absolute quality.
// ---------------------------------------------------------------------------

export const LANE_ABSOLUTE = 'absolute-quality';
export const LANE_RELATIVE_ONLY = 'relative-comparison-only';

/** Grades that force a corpus into the relative-only lane. Mirrors
 *  contamination.RELATIVE_ONLY_GRADES (HIGH + MEDIUM). */
const RELATIVE_ONLY_GRADES = new Set(['HIGH', 'MEDIUM']);

/** Upper-case a contamination grade; map empty / "NONE" to null (unknown). */
export function normalizeContamination(grade) {
  if (grade == null) return null;
  const g = String(grade).trim().toUpperCase();
  if (!g || g === 'NONE') return null;
  return g;
}

/**
 * Lane gate — FAIL SAFE. True ⇒ relative-comparison-only (must NOT be co-ranked
 * with absolute-quality corpora). Known HIGH/MEDIUM or UNKNOWN → true; only a
 * positively LOW grade → false. Mirrors isRelativeOnlyLane in the website util.
 *
 * @param {string|null|undefined} grade  run_card->>contamination for the row
 * @returns {boolean}
 */
export function isRelativeOnlyLane(grade) {
  const g = normalizeContamination(grade);
  if (g == null) return true; // fail safe: unknown contamination → relative-only
  return RELATIVE_ONLY_GRADES.has(g);
}

/**
 * Sort key → (PostgREST column, direction). Higher-is-better metrics sort
 * descending; TER, cost, and "lowest" sort ascending; date sorts newest-first.
 */
export const RESULTS_SORT = {
  composite: { column: 'composite_score', dir: 'desc' },
  chrf: { column: 'chrf_plus_plus', dir: 'desc' },
  bleu: { column: 'corpus_bleu', dir: 'desc' },
  comet: { column: 'comet_score', dir: 'desc' },
  ter: { column: 'ter', dir: 'asc' },
  cost: { column: 'cost_per_entry_usd', dir: 'asc' },
  date: { column: 'run_timestamp', dir: 'desc' },
};

/**
 * Trust vocabulary — maps the DB trust enum to display keys. Mirrors
 * DB_TRUST_TO_DISPLAY in cli/website (kept in sync; the website is a separate
 * package so we can't import it). Every CLI submission is 'unverified'
 * (self-reported); 'verified' is set only by the server-side re-scoring
 * verifier; 'disqualified' is filtered from ranked views.
 */
export const TRUST_DISPLAY = {
  unverified: 'self-benchmarked',
  verified: 'champollion-verified',
  disqualified: 'disqualified',
};

/**
 * Strip characters significant to PostgREST filter syntax so a user-supplied
 * value can't inject extra filters. Returns null for empty/blank input.
 *
 * @param {string|null|undefined} s
 * @returns {string|null}
 */
export function sanitize(s) {
  if (s == null) return null;
  const cleaned = String(s).replace(/[%,()*]/g, '').trim();
  return cleaned.length ? cleaned : null;
}

/**
 * Build the PostgREST URL for a leaderboard listing query.
 *
 * Mirrors buildListingUrl in cli/website/src/utils/leaderboardUtils.js:
 * server-side filtering + `trust=neq.disqualified` so disqualified runs never
 * surface, ordered by the chosen metric with nulls last.
 *
 * @param {object} params
 * @param {string} [params.supabaseUrl]       Override Supabase project URL.
 * @param {string} [params.select]            Comma-separated column list.
 * @param {string} [params.source_language]   Source ISO 639-3 code (or null).
 * @param {string} [params.target_language]   Target ISO 639-3 code (or null).
 * @param {string} [params.model]             Model slug substring (ilike).
 * @param {string} [params.sort]              Sort key (see RESULTS_SORT).
 * @param {number} [params.limit]             Max rows (default 20).
 * @returns {string}                          Full PostgREST URL.
 */
export function buildResultsUrl({
  supabaseUrl = SUPABASE_URL,
  select = RESULTS_SELECT,
  source_language = null,
  target_language = null,
  model = null,
  sort = 'composite',
  limit = 20,
} = {}) {
  const params = new URLSearchParams();
  params.set('select', select);
  params.set('trust', 'neq.disqualified');

  // Language pair — Supabase stores "src>tgt" lowercase ISO 639-3.
  const src = sanitize(source_language)?.toLowerCase();
  const tgt = sanitize(target_language)?.toLowerCase();
  if (src && tgt) {
    params.set('language_pair', `eq.${src}>${tgt}`);
  } else if (src) {
    params.set('language_pair', `like.${src}>%`);
  } else if (tgt) {
    params.set('language_pair', `like.%>${tgt}`);
  }

  // Model — case-insensitive substring match (agents pass "haiku", not the
  // full slug). ilike treats * as the wildcard.
  const m = sanitize(model);
  if (m) params.set('model_slug', `ilike.*${m}*`);

  const { column, dir } = RESULTS_SORT[sort] || RESULTS_SORT.composite;
  params.set('order', `${column}.${dir}.nullslast`);
  params.set('limit', String(limit));

  return `${supabaseUrl}/rest/v1/run_cards?${params.toString()}`;
}

/**
 * Map a raw run_cards row to the compact scored shape the tool returns.
 *
 * @param {object} row  PostgREST row
 * @returns {object}    Compact result entry
 */
export function mapResultRow(row) {
  const pair = (row.language_pair || '?').trim().toLowerCase();
  const contamination = normalizeContamination(row.contamination);
  const relativeOnly = isRelativeOnlyLane(row.contamination);
  return {
    id: row.id,
    model: row.model_slug || '?',
    pair,
    condition: row.condition || '?',
    composite: row.composite_score ?? null,
    chrf: row.chrf_plus_plus ?? null,
    bleu: row.corpus_bleu ?? null,
    comet: row.comet_score ?? null,
    ter: row.ter ?? null,
    qualityTier: row.quality_tier ?? null,
    trust: TRUST_DISPLAY[row.trust] || 'self-benchmarked',
    author: row.submitter || 'anonymous',
    dataset: row.dataset_id || null,
    cost_usd: row.total_cost_usd ?? null,
    date: (row.run_timestamp || row.submitted_at || '').slice(0, 10) || null,
    // Contamination lane (FAIL SAFE). `relative_only` rows are NOT comparable
    // on absolute quality against absolute-lane rows — only against each other
    // on the same corpus. An agent that ignores this would co-rank a corpus
    // that's in models' training data (or whose grade is unknown) as if it
    // measured real quality.
    contamination: contamination, // normalized grade, or null when unknown
    relative_only: relativeOnly,
    score_lane: relativeOnly ? LANE_RELATIVE_ONLY : LANE_ABSOLUTE,
  };
}

/**
 * Format mapped result rows as a concise, agent-readable block.
 *
 * @param {object[]} rows           Mapped rows (from mapResultRow)
 * @param {object}   [opts]
 * @param {string}   [opts.sort]    Sort key used (for the header line)
 * @returns {string}
 */
export function formatResults(rows, { sort = 'composite' } = {}) {
  if (!rows || rows.length === 0) {
    return [
      'No scored results on the public leaderboard yet.',
      '',
      'The board is filled by people running benchmarks from the queue.',
      'Use list_queue to see what is pending, then run_benchmark to score an',
      'item — your run publishes here with your attribution.',
      '',
      'Leaderboard: https://champollion.dev/leaderboard',
    ].join('\n');
  }

  const fmt = (v, d = 3) => (v == null ? '—' : Number(v).toFixed(d));
  const lines = rows.map((r, i) => {
    const arrow = r.pair.includes('>') ? r.pair.replace('>', '→') : r.pair;
    // Mark relative-only rows so the score is never read as absolute quality.
    const lane = r.relative_only
      ? `  ⚠ relative-only${r.contamination ? ` (${r.contamination})` : ' (grade unknown)'}`
      : '';
    // The id closes the loop with get_run_card, whose not-found error
    // points agents back here for valid ids.
    const idTag = r.id != null ? `  id ${r.id}` : '';
    return (
      `#${i + 1}  ${arrow}  composite ${fmt(r.composite)}  chrF++ ${fmt(r.chrf, 1)}  `
      + `${r.model.split('/').pop()}  [${r.condition}]  ${r.trust}  by ${r.author}${idTag}${lane}`
    );
  });

  // Lane-mixing guard: relative-only and absolute-quality scores are NOT
  // comparable across lanes — only within the same corpus. Warn loudly when a
  // single ranked list spans both lanes, or when every row is relative-only.
  const relCount = rows.filter((r) => r.relative_only).length;
  const absCount = rows.length - relCount;
  const laneNotes = [];
  if (relCount > 0 && absCount > 0) {
    laneNotes.push(
      '',
      `⚠ This list mixes ${absCount} absolute-quality row(s) and ${relCount} `
      + 'relative-comparison-only row(s) (marked above). Do NOT rank them against '
      + 'each other: a relative-only corpus (HIGH/MEDIUM contamination, FLORES, or '
      + 'an unknown grade) is in models\' training data — its score is valid only '
      + 'for comparing methods on THAT corpus, not as absolute quality.',
    );
  } else if (relCount > 0 && absCount === 0) {
    laneNotes.push(
      '',
      '⚠ Every row above is relative-comparison-only (HIGH/MEDIUM contamination, '
      + 'FLORES, or unknown grade). These scores compare methods on the same '
      + 'corpus — they are NOT absolute quality and must not be ranked against '
      + 'other corpora.',
    );
  }

  return [
    `Top ${rows.length} scored result(s) by ${sort}:`,
    '',
    ...lines,
    ...laneNotes,
    '',
    'Full leaderboard: https://champollion.dev/leaderboard',
  ].join('\n');
}

/**
 * Fetch scored leaderboard results from the public Supabase endpoint.
 *
 * @param {object} [params]  Same shape as buildResultsUrl params.
 * @returns {Promise<object[]>}  Mapped result rows.
 */
export async function fetchResults(params = {}) {
  const url = buildResultsUrl(params);
  const resp = await fetch(url, {
    headers: SB_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    throw new Error(
      `Leaderboard fetch failed: HTTP ${resp.status} ${(await resp.text()).slice(0, 120)}`,
    );
  }
  const rows = await resp.json();
  return rows.map(mapResultRow);
}

/**
 * Fetch the full run card (scores + method/config metadata) for one run id.
 * Returns the same `run_card` JSON the public leaderboard serves on expand;
 * no sentence text is read. Returns null if no run matches.
 *
 * @param {string} id                 run_cards.id
 * @param {object} [opts]
 * @param {string} [opts.supabaseUrl] Override Supabase project URL.
 * @returns {Promise<object|null>}
 */
export async function fetchRunCard(id, { supabaseUrl = SUPABASE_URL } = {}) {
  const safe = sanitize(id);
  if (!safe) return null;
  const select =
    'id,model_slug,language_pair,condition,trust,submitter,' +
    'composite_score,chrf_plus_plus,dataset_id,run_timestamp,run_card';
  const url =
    `${supabaseUrl}/rest/v1/run_cards?select=${select}` +
    `&trust=neq.disqualified&id=eq.${encodeURIComponent(safe)}&limit=1`;
  const resp = await fetch(url, {
    headers: SB_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    throw new Error(`Run-card fetch failed: HTTP ${resp.status}`);
  }
  const rows = await resp.json();
  return rows[0] || null;
}
