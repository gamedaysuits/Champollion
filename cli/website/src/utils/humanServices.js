/**
 * humanServices.js — per-pair human translation services data layer.
 *
 * The "human method" floor (docs/HUMAN_SERVICES_HUB.md): for low-resource
 * pairs with no reliable machine translation, the honest move is to surface
 * the human services that cover the pair. This reads the public, consent-gated
 * registry via the get_services_for_pair RPC (migration 034).
 *
 * Pure functions + an injectable-fetch RPC call, so the React component stays
 * thin and the data handling is unit-testable without a DOM. The registry SSOT
 * is shared/human-services.json (mirrors the model-aliases.json dual-runtime
 * pattern); the website only ever reads the approved + consented projection.
 */

// The RPC returns only the public (non-PII) columns; `contact` is never exposed.
export const RPC_PATH = "/rest/v1/rpc/get_services_for_pair";

/** Build the PostgREST RPC endpoint URL. */
export function buildRpcUrl(supabaseUrl) {
  return `${supabaseUrl}${RPC_PATH}`;
}

/** Headers for an anon PostgREST call (RLS still gates the rows). */
export function rpcHeaders(anonKey) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Provider-type → display badge. community_org carries the sovereignty-aligned
 * "community" badge; others get a plain type label. Unknown/absent → null.
 */
export function providerBadge(providerType) {
  switch (providerType) {
    case "community_org":
      return { label: "community", kind: "community" };
    case "agency":
      return { label: "agency", kind: "agency" };
    case "individual":
      return { label: "individual", kind: "individual" };
    default:
      return null;
  }
}

/** "~5 days" / "~1 day" / null. */
export function formatTurnaround(days) {
  if (days == null || Number.isNaN(days)) return null;
  return `~${days} day${days === 1 ? "" : "s"}`;
}

/** "$0.30/word" / null. */
export function formatRate(ratePerWord) {
  if (ratePerWord == null || Number.isNaN(ratePerWord)) return null;
  return `$${Number(ratePerWord).toFixed(2)}/word`;
}

/** Normalize a raw RPC row into the shape the component renders. */
export function normalizeService(row) {
  return {
    serviceId: row.service_id,
    displayName: row.display_name || row.service_id || "Unnamed service",
    providerType: row.provider_type || null,
    badge: providerBadge(row.provider_type),
    variety: row.variety || null,
    turnaround: formatTurnaround(row.turnaround_days),
    rate: formatRate(row.rate_per_word),
    domains: Array.isArray(row.domains) ? row.domains : [],
    ncTerms: row.nc_terms || null,
    sovereigntyFlags: row.sovereignty_flags || null,
  };
}

/**
 * Call get_services_for_pair for one pair. Returns an array of normalized
 * services (possibly empty).
 *
 * A 404 ("RPC not found") is treated as an EMPTY registry, not an error: before
 * migration 034 is applied — and any time the RPC is briefly unavailable —
 * PostgREST returns 404 for the missing function. Returning [] here lets the
 * caller render the honest "no human services listed … register one" empty
 * state instead of a hidden panel.
 *
 * Any other non-OK status (5xx, auth) is a genuine failure → throws, so the
 * caller can hide the panel rather than show a misleading empty state. A
 * network-level failure rejects the underlying fetch and propagates the same
 * way. This keeps "registry reachable, 0 rows" and "registry not deployed yet"
 * indistinguishable to the UI (both → empty state) while real breakage stays
 * hidden.
 *
 * @param {object} opts
 * @param {string} opts.supabaseUrl
 * @param {string} opts.anonKey
 * @param {string} opts.src - ISO 639-3 source code
 * @param {string} opts.tgt - ISO 639-3 target code
 * @param {function} [opts.fetchImpl] - injectable fetch (defaults to global fetch)
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<Array>}
 */
export async function fetchServicesForPair({
  supabaseUrl,
  anonKey,
  src,
  tgt,
  fetchImpl,
  signal,
}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!doFetch) throw new Error("no fetch implementation available");

  const res = await doFetch(buildRpcUrl(supabaseUrl), {
    method: "POST",
    headers: rpcHeaders(anonKey),
    body: JSON.stringify({ src, tgt }),
    signal,
  });

  if (!res.ok) {
    // RPC not deployed / briefly unavailable → empty registry, not an error.
    if (res.status === 404) return [];
    throw new Error(`get_services_for_pair failed: ${res.status}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeService);
}
