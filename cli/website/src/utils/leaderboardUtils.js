/**
 * Leaderboard data utilities — pure functions extracted from leaderboard.js
 * for independent testability.
 *
 * These handle query building, row mapping, and display formatting
 * for the server-side leaderboard data layer.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PAGE_SIZE = 100;

// Map our sort keys to Supabase column names
export const SORT_KEY_TO_COLUMN = {
  composite: "composite_score",
  chrF: "chrf_plus_plus",
  exactMatch: "exact_match_rate",
  fstAcceptance: "fst_acceptance_rate",
  equivalentMatch: "equivalent_match_rate",
  semanticScore: "semantic_score",
  bleu: "corpus_bleu",
  comet: "comet_score",
  ter: "ter",
  method: "condition",
  model: "model_slug",
  author: "submitter",
  date: "run_timestamp",
  pair: "language_pair",
  costEntry: "cost_per_entry_usd",
  latency: "avg_latency_seconds",
};

// Trust vocabulary — maps the DB's trust values to display keys. SSOT: the DB
// enforces trust ∈ {unverified, verified, disqualified} (migration 021). Every
// CLI submission is 'unverified' (the RLS INSERT policy forces it): its scores
// are SELF-REPORTED and not independently re-scored, so it must never be shown
// as verified. 'verified' is set only by the server-side re-scoring verifier
// (service_role). 'disqualified' is filtered from ranked views.
// 'community-validated' is deliberately absent: it is not a run_cards.trust
// value (unearnable there) — it is pair-level speaker evidence (bilingual
// speakers, community protocol), so it never arrives from the DB column.
// Keep in sync with DB_TRUST_TO_DISPLAY / TRUST_META in pages/leaderboard.js —
// that copy additionally carries legacy display-key passthroughs (including
// 'community-validated') for pre-021 rows that stored display keys.
export const DB_TRUST_TO_DISPLAY = {
  unverified: "self-benchmarked",
  verified: "gds-verified",
  disqualified: "disqualified",
};

// ---------------------------------------------------------------------------
// Query Building
// ---------------------------------------------------------------------------

/**
 * Build a Supabase REST query URL from the current filter + sort state.
 *
 * Pushes ALL filtering to the server so we never fetch more than PAGE_SIZE
 * rows. Text search uses Supabase `or` + `ilike` across searchable columns.
 *
 * @param {Object} params - Filter/sort state
 * @param {string} params.supabaseUrl - Supabase project URL
 * @param {string} params.listingSelect - Comma-separated column list
 * @param {string} params.srcFilter - Source language ISO code or "any"
 * @param {string} params.tgtFilter - Target language ISO code or "any"
 * @param {string} params.modelFilter - Model slug or "any"
 * @param {string} params.tierFilter - Quality tier or "any"
 * @param {string} params.trustFilter - Trust display name or "any"
 * @param {string} params.methodClassFilter - Method class or "any"
 * @param {string} params.paradigmFilter - Paradigm or "any"
 * @param {boolean} [params.paradigmAvailable] - Whether the paradigm column
 *   exists in the target DB (migration 030). When false the paradigm filter
 *   and search term are omitted so the query never 400s on older databases.
 * @param {string} params.searchQuery - Text search query
 * @param {string} params.activeCondition - Condition group key
 * @param {string} params.sortKey - Sort metric/column key
 * @param {string} params.sortDir - "asc" or "desc"
 * @param {Array} [params.conditionGroups] - Condition group definitions
 * @returns {string} Full Supabase REST URL
 */
export function buildListingUrl({
  supabaseUrl, listingSelect, srcFilter, tgtFilter, modelFilter,
  tierFilter, trustFilter, methodClassFilter, paradigmFilter,
  paradigmAvailable = false, searchQuery, activeCondition, sortKey,
  sortDir, conditionGroups = [],
}) {
  const params = new URLSearchParams();
  params.set("select", listingSelect);
  params.set("trust", "neq.disqualified");

  // Language pair filter — Supabase stores "eng>tha" format
  if (srcFilter !== "any" && tgtFilter !== "any") {
    params.set("language_pair", `eq.${srcFilter}>${tgtFilter}`);
  } else if (srcFilter !== "any") {
    params.set("language_pair", `like.${srcFilter}>%`);
  } else if (tgtFilter !== "any") {
    params.set("language_pair", `like.%>${tgtFilter}`);
  }

  // Model filter
  if (modelFilter !== "any") {
    params.set("model_slug", `eq.${modelFilter}`);
  }

  // Tier filter
  if (tierFilter !== "any") {
    params.set("quality_tier", `eq.${tierFilter}`);
  }

  // Method class filter — the run_cards.method_class column always exists.
  if (methodClassFilter && methodClassFilter !== "any") {
    params.set("method_class", `eq.${methodClassFilter}`);
  }

  // Paradigm filter — only applied when the paradigm column is present in the
  // target DB (migration 030). Gating avoids 400-ing the whole listing query
  // against a database that predates the column.
  if (paradigmAvailable && paradigmFilter && paradigmFilter !== "any") {
    params.set("paradigm", `eq.${paradigmFilter}`);
  }

  // Trust filter — intentionally overwrites the neq.disqualified guard
  // via URLSearchParams.set(). When filtering to a specific trust level,
  // the exclusive filter is sufficient since "disqualified" is never
  // offered in the dropdown (fetchDistinct already excludes it).
  if (trustFilter !== "any") {
    const dbTrust = Object.entries(DB_TRUST_TO_DISPLAY)
      .find(([, display]) => display === trustFilter)?.[0] || trustFilter;
    params.set("trust", `eq.${dbTrust}`);
  }

  // Condition filter (skip for "all" and "best")
  if (activeCondition !== "all" && activeCondition !== "best") {
    const group = conditionGroups.find((g) => g.key === activeCondition);
    if (group && group.isPrefix) {
      params.set("condition", `like.${activeCondition}%`);
    } else {
      params.set("condition", `eq.${activeCondition}`);
    }
  }

  // Text search — sanitize to prevent query injection. paradigm joins the
  // searchable columns only when the column exists (see paradigmAvailable).
  if (searchQuery) {
    const q = searchQuery.replace(/[%_,().]/g, "");
    if (q.length > 0) {
      const cols = ["model_slug", "submitter", "condition", "language_pair", "method_class"];
      if (paradigmAvailable) cols.push("paradigm");
      params.set("or", `(${cols.map((c) => `${c}.ilike.*${q}*`).join(",")})`);
    }
  }

  // Sort
  const sortCol = SORT_KEY_TO_COLUMN[sortKey] || "composite_score";
  const sortDirection = sortDir === "asc" ? "asc" : "desc";
  params.set("order", `${sortCol}.${sortDirection}.nullslast`);

  return `${supabaseUrl}/rest/v1/run_cards?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Row Mapping
// ---------------------------------------------------------------------------

/**
 * Map a raw Supabase row to the internal entry shape (without run_card).
 * run_card fields are null until lazy-loaded on expand.
 */
export function mapRow(row) {
  const lp = (row.language_pair || "?").trim().toLowerCase();
  const [lpSrc, lpTgt] = lp.includes(">") ? lp.split(">") : [lp, ""];
  return {
    id: row.id,
    method: row.condition?.includes("+") ? `fst-gate-${row.condition}` : `prompt-${row.condition}`,
    model: row.model_slug,
    condition: row.condition,
    pair: lp,
    src: (lpSrc || "?").trim(),
    tgt: (lpTgt || "?").trim(),
    dataset: row.dataset_id,
    metrics: {
      composite: row.composite_score,
      chrF: row.chrf_plus_plus,
      exactMatch: row.exact_match_rate,
      fstAcceptance: row.fst_acceptance_rate,
      equivalentMatch: row.equivalent_match_rate,
      semanticScore: row.semantic_score,
      bleu: row.corpus_bleu,
      comet: row.comet_score,
      ter: row.ter,
    },
    qualityTier: row.quality_tier,
    cost_per_entry_usd: row.cost_per_entry_usd,
    cost_adjusted_score: null,
    avg_latency_seconds: row.avg_latency_seconds,
    author: row.submitter,
    trust: DB_TRUST_TO_DISPLAY[row.trust] || "self-benchmarked",
    harnessVersion: row.harness_version,
    runCardHash: row.id,
    corpusSize: row.corpus_size,
    date: row.run_timestamp?.split("T")[0] || row.submitted_at?.split("T")[0],
    cost_usd: row.total_cost_usd,
    elapsed_seconds: row.elapsed_seconds,
    methodClass: row.method_class,
    paradigm: row.paradigm ?? null,
    // Contamination grade extracted from the run_card JSONB in the listing
    // query (LISTING_SELECT: contamination:run_card->>contamination). Available
    // at filter time — unlike _runCard, which is null until expand — so the
    // contamination lane gate can fall back to a run's own stamped grade when
    // the dataset row is missing from prod. Keep in sync with mapRow in
    // src/pages/leaderboard.js.
    runCardContamination: row.contamination ?? null,
    _runCard: null,
    methodCard: null,
  };
}

// ---------------------------------------------------------------------------
// Display Formatting
// ---------------------------------------------------------------------------

/**
 * Format a language pair string "eng>zul" into display names using the
 * language map. Falls back to uppercase ISO codes.
 */
export function formatPair(pair, langMap) {
  if (!pair || pair === "?") return "—";
  const [src, tgt] = pair.includes(">") ? pair.split(">") : [pair, ""];
  const srcName = langMap?.get(src?.trim()) || (src || "").toUpperCase();
  const tgtName = langMap?.get(tgt?.trim()) || (tgt || "").toUpperCase();
  return tgt ? `${srcName} → ${tgtName}` : srcName;
}

/**
 * Format a metric value for display.
 */
export function formatMetric(value, suffix = "") {
  if (value == null) return "—";
  if (suffix === "%") return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(3);
}

/**
 * Format a cost value for display.
 */
export function formatCost(usd) {
  if (usd == null) return "—";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

/**
 * Format a date string for display.
 */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return dateStr;
}

/**
 * Sanitize a search query for use in Supabase ilike filters.
 * Strips characters that could inject into PostgREST query syntax.
 */
export function sanitizeSearch(query) {
  return query.replace(/[%_,().]/g, "");
}
