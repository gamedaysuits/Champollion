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
 * Scoring standard/1 (founder, 2026-10-04: "we want scoring to be industry
 * standard"): chrF++ with its 95% CI is the headline and the default sort;
 * BLEU, spBLEU, TER and COMET are shown beside it, never blended; exact match
 * and FST acceptance are DIAGNOSTICS, shown apart; no quality tier is ever
 * printed. A card without run_card.scores.scoring_standard is legacy, and
 * only a legacy card's stored composite appears — as "legacy composite
 * (retired)".
 *
 * Sovereignty note: these tools expose only the scored AGGREGATE columns
 * (chrF++ and its CI, BLEU, spBLEU, TER, COMET, diagnostics, cost, trust) plus the run_card metadata
 * card — the same fields the public leaderboard already serves. Per-entry
 * sentence text lives in the separately license/quarantine-gated
 * run_card_entries table and is never read here.
 */

import { count, plural } from './plural.js';

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
  'language_pair', 'trust',
  // Headline + the other standard metrics (spBLEU has no column: it lives in
  // the run_card JSONB and is extracted as text).
  'chrf_plus_plus', 'chrf_ci_lower', 'chrf_ci_upper',
  'corpus_bleu', 'spbleu:run_card->scores->>spbleu', 'ter', 'comet_score',
  // Diagnostics, shown apart.
  'exact_match_rate', 'fst_acceptance_rate',
  // Read only so a LEGACY card can show it as "legacy composite (retired)".
  'composite_score',
  'scoring_standard:run_card->scores->>scoring_standard',
  'total_cost_usd', 'cost_per_entry_usd', 'run_timestamp', 'submitted_at',
  'contamination:run_card->>contamination',
].join(',');

/** The standard a run card declares; a card without it is legacy. */
export const SCORING_STANDARD = 'standard/1';

/** The only wording under which a stored composite may appear. */
export const LEGACY_COMPOSITE_LABEL = 'legacy composite (retired)';

/** Display names for the sort keys (and the contest metric ids). */
export const SORT_LABEL = {
  chrf: 'chrF++',
  bleu: 'BLEU',
  ter: 'TER (lower is better)',
  comet: 'COMET',
  cost: 'cost',
  date: 'date',
  composite: LEGACY_COMPOSITE_LABEL,
};

/** A finite number or null (JSON-extracted values arrive as text). */
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The headline, as the field writes it: "chrF++ 47.5 [45.9, 49.0]". The
 * interval appears only when both bounds are known.
 */
export function formatChrf(score, ci) {
  const s = num(score);
  if (s == null) return 'chrF++ —';
  return Array.isArray(ci) && ci.length === 2
    ? `chrF++ ${s.toFixed(1)} [${ci[0].toFixed(1)}, ${ci[1].toFixed(1)}]`
    : `chrF++ ${s.toFixed(1)}`;
}

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
 * chrF++ is the default. `composite` is kept only so an old call keeps
 * working: it orders by the retired legacy composite, which standard/1 cards
 * do not carry (they sort last).
 */
export const DEFAULT_SORT = 'chrf';
export const RESULTS_SORT = {
  chrf: { column: 'chrf_plus_plus', dir: 'desc' },
  bleu: { column: 'corpus_bleu', dir: 'desc' },
  ter: { column: 'ter', dir: 'asc' },
  comet: { column: 'comet_score', dir: 'desc' },
  cost: { column: 'cost_per_entry_usd', dir: 'asc' },
  date: { column: 'run_timestamp', dir: 'desc' },
  composite: { column: 'composite_score', dir: 'desc' },
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
  sort = DEFAULT_SORT,
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

  const { column, dir } = RESULTS_SORT[sort] || RESULTS_SORT[DEFAULT_SORT];
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
    // Headline (chrF++ with its 95% CI) and the standard metrics beside it.
    chrf: row.chrf_plus_plus ?? null,
    chrf_ci: num(row.chrf_ci_lower) != null && num(row.chrf_ci_upper) != null
      ? [num(row.chrf_ci_lower), num(row.chrf_ci_upper)] : null,
    bleu: row.corpus_bleu ?? null,
    spbleu: num(row.spbleu),
    ter: row.ter ?? null,
    comet: row.comet_score ?? null,
    // Diagnostics: apart, never a headline.
    diagnostics: {
      exact_match: row.exact_match_rate ?? null,
      fst_acceptance: row.fst_acceptance_rate ?? null,
    },
    // standard/1 cards declare it; only a LEGACY card's stored composite is
    // carried, under its retired name. No quality tier.
    scoring_standard: row.scoring_standard || null,
    legacy_composite: row.scoring_standard ? null : num(row.composite_score),
    trust: TRUST_DISPLAY[row.trust] || 'self-benchmarked',
    author: row.submitter || 'anonymous',
    dataset: row.dataset_id || null,
    // null = the harness could not price the run (a local model, an MT
    // engine, an unpriced provider) — UNKNOWN, never $0.
    cost_usd: row.total_cost_usd ?? null,
    cost_label: row.total_cost_usd == null ? 'unknown' : `$${Number(row.total_cost_usd).toFixed(4)}`,
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
export function formatResults(rows, { sort = DEFAULT_SORT } = {}) {
  if (!rows || rows.length === 0) {
    return [
      'No scored results on the public leaderboard yet.',
      '',
      'The board holds only results someone chose to publish. A benchmark never',
      'publishes by itself: run_benchmark keeps its scores on your machine unless',
      'you pass publish: true (with the publish_ack it asks for), and a finished',
      'report goes on the board only through publish_report (or `mt-eval publish`',
      'in a terminal) — preview_publish (read-only) shows exactly what would go public first.',
      'To help fill it: list_queue shows what is pending; run_benchmark scores an',
      'item.',
      '',
      'Leaderboard: https://champollion.dev/leaderboard',
    ].join('\n');
  }

  const fmt = (v, d = 3) => (v == null ? '—' : Number(v).toFixed(d));
  const lines = rows.map((r, i) => {
    // The other standard metrics, only those the run reported.
    const beside = [
      r.bleu != null && `BLEU ${fmt(r.bleu, 1)}`,
      r.spbleu != null && `spBLEU ${fmt(r.spbleu, 1)}`,
      r.ter != null && `TER ${fmt(r.ter, 1)}`,
      r.comet != null && `COMET ${fmt(r.comet, 3)}`,
    ].filter(Boolean).join(' · ');
    const d = r.diagnostics || {};
    const diag = [
      d.exact_match != null && `EM ${fmt(d.exact_match, 2)}`,
      d.fst_acceptance != null && `FST ${fmt(d.fst_acceptance, 2)}`,
    ].filter(Boolean).join(' ');
    const legacy = r.legacy_composite != null ? `  ${LEGACY_COMPOSITE_LABEL} ${fmt(r.legacy_composite)}` : '';
    const arrow = r.pair.includes('>') ? r.pair.replace('>', '→') : r.pair;
    // Mark relative-only rows so the score is never read as absolute quality.
    const lane = r.relative_only
      ? `  ⚠ relative-only${r.contamination ? ` (${r.contamination})` : ' (grade unknown)'}`
      : '';
    // The id closes the loop with get_run_card, whose not-found error
    // points agents back here for valid ids.
    const idTag = r.id != null ? `  id ${r.id}` : '';
    return (
      `#${i + 1}  ${arrow}  ${formatChrf(r.chrf, r.chrf_ci)}${beside ? `  ${beside}` : ''}  `
      + `${r.model.split('/').pop()}  [${r.condition}]  ${r.trust}  by ${r.author}  `
      + `cost ${r.cost_label ?? (r.cost_usd == null ? 'unknown' : `$${Number(r.cost_usd).toFixed(4)}`)}`
      + `${diag ? `  diagnostics: ${diag}` : ''}${legacy}${idTag}${lane}`
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
      `⚠ This list mixes ${count(absCount, 'absolute-quality row')} and ${relCount} `
      + `relative-comparison-only ${plural(relCount, 'row')} (marked above). Do NOT rank them against `
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

  const unknownCost = rows.filter((r) => r.cost_usd == null).length;
  if (unknownCost > 0) {
    laneNotes.push(
      '',
      `${count(unknownCost, 'row')} ${plural(unknownCost, 'has', 'have')} cost "unknown" — the harness could not price ${plural(unknownCost, 'it', 'them')} `
      + '(a local model, an MT engine, an unpriced provider). Unknown is not $0'
      + (sort === 'cost' ? `; ${plural(unknownCost, 'it sorts', 'they sort')} LAST by cost, never first.` : '.'),
    );
  }

  const standardNote = [
    '',
    `Scoring ${SCORING_STANDARD}: chrF++ with its 95% bootstrap CI is the headline and the ranking metric `
    + '(rows whose intervals overlap are not distinguishable); BLEU, spBLEU, TER and COMET are shown beside it, '
    + 'never blended; diagnostics (EM = exact match, FST = FST acceptance) explain a score and never rank. '
    + 'No quality labels are read off automatic scores.',
  ];
  if (sort === 'composite') {
    standardNote.push(
      `Sorted by the ${LEGACY_COMPOSITE_LABEL}: only cards scored before ${SCORING_STANDARD} carry one; `
      + 'every newer card sorts last. It is not a ranking of quality — sort by chrf.',
    );
  }

  return [
    `Top ${count(rows.length, 'scored result')} by ${SORT_LABEL[sort] ?? sort}:`,
    '',
    ...lines,
    ...laneNotes,
    ...standardNote,
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

/** Deep copy of `v` without any `quality_tier` key (retired; see below). */
function withoutTierFields(v) {
  if (Array.isArray(v)) return v.map(withoutTierFields);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === 'quality_tier') continue;
      out[k] = withoutTierFields(x);
    }
    return out;
  }
  return v;
}

/**
 * Text for get_run_card: the headline first (chrF++ with its CI, scoring
 * standard/1), then the card. A legacy card's composite is named as the
 * legacy composite (retired). The retired quality-tier field is left out of
 * the printout — no score surface prints a tier label — and the note says so,
 * so nothing is silently hidden; every other field is the card as stored.
 */
export function formatRunCard(card) {
  const ci = num(card.chrf_ci_lower) != null && num(card.chrf_ci_upper) != null
    ? [num(card.chrf_ci_lower), num(card.chrf_ci_upper)] : null;
  const standard = card.run_card?.scores?.scoring_standard || null;
  const lines = [`Headline (scoring ${SCORING_STANDARD}): ${formatChrf(card.chrf_plus_plus, ci)}`];
  if (standard) {
    lines.push(`Scored under ${standard}; primary metric ${card.run_card.scores.primary_metric || 'chrf_plus_plus'}.`);
  } else {
    const c = num(card.composite_score);
    lines.push(
      `Legacy card (scored before ${SCORING_STANDARD})`
      + (c != null ? `: its composite_score ${c.toFixed(3)} is the ${LEGACY_COMPOSITE_LABEL} — for the record only, not a ranking or a quality label.` : '.'),
    );
  }
  // Only a card that actually stored a tier gets the note (standard/1 cards
  // carry quality_tier: null — dropping a null hides nothing).
  const hasTier = (function stored(v) {
    if (Array.isArray(v)) return v.some(stored);
    if (v && typeof v === 'object') {
      return Object.entries(v).some(([k, x]) => (k === 'quality_tier' ? x != null : stored(x)));
    }
    return false;
  })(card);
  if (hasTier) {
    lines.push('The retired quality-tier field is omitted below (tiers read off automatic scores are retired).');
  }
  return `${lines.join('\n')}\n\n${JSON.stringify(withoutTierFields(card), null, 2)}`;
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
    'chrf_plus_plus,chrf_ci_lower,chrf_ci_upper,corpus_bleu,ter,comet_score,' +
    'composite_score,dataset_id,run_timestamp,total_cost_usd,run_card';
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
