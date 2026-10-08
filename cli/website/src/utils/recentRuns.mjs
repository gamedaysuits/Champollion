/**
 * recentRuns — pure formatting for the homepage "Latest network runs"
 * strip (RecentRunsStrip). Kept free of React/DOM so cli/test can unit-test
 * it under node --test (same pattern as arcStrength.mjs).
 *
 * A strip chip shows: pair (names when known) · model · chrF++ · date.
 * Scores are the leaderboard's automated proxy scores — the strip links to
 * /leaderboard, which carries the full disclaimer; nothing here re-scores
 * or re-labels a run.
 */

/** How many rows the strip requests (and the marquee can hold). */
export const RECENT_RUNS_LIMIT = 24;

/** Below this many rows a marquee loop looks broken — render static. */
export const MARQUEE_MIN_ROWS = 10;

/** REST query for the newest runs, chronological by submission time. */
export function recentRunsUrl(supabaseUrl, limit = RECENT_RUNS_LIMIT) {
  const cols = [
    'language_pair',
    'model_slug',
    'condition',
    'chrf_plus_plus',
    'submitted_at',
  ].join(',');
  return (
    `${supabaseUrl}/rest/v1/run_cards` +
    `?select=${cols}` +
    `&trust=neq.disqualified` +
    `&order=submitted_at.desc` +
    `&limit=${limit}`
  );
}

/** "anthropic/claude-haiku-4.5" → "claude-haiku-4.5"; engines pass through. */
export function shortModel(slug) {
  if (typeof slug !== 'string' || !slug) return '?';
  const i = slug.indexOf('/');
  return i >= 0 ? slug.slice(i + 1) : slug;
}

/** "eng>pam" + name map → "English → Kapampangan" (codes when unknown).
 * Accepts either a plain object or a Map (loadLanguageNameMap returns a
 * Map — indexing a Map with [] silently yields undefined). */
export function pairLabel(pair, nameMap) {
  if (typeof pair !== 'string' || !pair.includes('>')) return pair || '?';
  const [src, tgt] = pair.split('>');
  const name = (code) => {
    if (!nameMap) return code;
    if (typeof nameMap.get === 'function') return nameMap.get(code) || code;
    return nameMap[code] || code;
  };
  return `${name(src)} → ${name(tgt)}`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Short UTC date label: "Jul 19", with the year appended ("Jul 19 2025")
 * when it differs from `now`'s year. Deterministic — no locale formatting.
 */
export function dateLabel(isoTimestamp, now = new Date()) {
  const d = new Date(isoTimestamp);
  if (!isoTimestamp || Number.isNaN(d.getTime())) return '';
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return d.getUTCFullYear() === now.getUTCFullYear()
    ? base
    : `${base} ${d.getUTCFullYear()}`;
}

/** chrF++ to one decimal; em dash when the run carries no score. */
export function scoreLabel(chrf) {
  return typeof chrf === 'number' && Number.isFinite(chrf)
    ? `chrF++ ${chrf.toFixed(1)}`
    : '—';
}

/**
 * One run_cards row → the chip's display strings (null for an unusable
 * row, so the strip can drop it instead of rendering a blank chip).
 */
export function formatRunChip(row, nameMap, now = new Date()) {
  if (!row || typeof row.language_pair !== 'string') return null;
  return {
    pair: row.language_pair,
    pairLabel: pairLabel(row.language_pair, nameMap),
    model: shortModel(row.model_slug),
    score: scoreLabel(row.chrf_plus_plus),
    date: dateLabel(row.submitted_at, now),
  };
}
