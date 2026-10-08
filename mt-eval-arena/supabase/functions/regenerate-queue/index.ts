// regenerate-queue — server-side delta refresh of the public network artifacts.
//
// Replaces the deleted "Regenerate queue + mesh" GitHub Action. Triggered when
// run_cards change (a Postgres trigger via pg_net, and/or a pg_cron debounce —
// see ../../migrations/036_regenerate_queue_trigger.sql) and/or the dashboard
// Scheduled Functions. On each run it does the cheap, input-light DELTA over
// the already-served artifacts:
//
//   1. read the public run_cards board (coverage combos + scored results),
//   2. STREAM the base queue.json (from the artifact Storage bucket,
//      bootstrapping from the live site the first time) through a byte-level
//      scanner — each item is parsed alone and DROPPED when its
//      (corpus x model x condition) is now on the board; survivors' raw
//      bytes pass through verbatim (the full document is NEVER JSON.parsed:
//      at 58.5 MB it exhausts the 256 MB isolate — measured HTTP 546,
//      2026-07-12; see ./lib.ts and README),
//   3. rebuild queue-preview.json from the trimmed queue,
//   4. FOLD the latest results into the mesh edges (status/best_chrf/runs)
//      and append any newly-registered pairs from the served registry.json
//      (stream-projected down to the four fields the fold needs),
//   5. upload all three back to Storage, where the site serves them from.
//
// What it deliberately does NOT do: re-derive the ecv-v3 RANKING or the
// reliability bridges. That heavier, input-heavy regeneration (it needs the
// cost manifest + language cards) stays in arena/scripts/generate_sweep_queue.py
// — run periodically / on new corpora. This function keeps the served files
// fresh between those structural regens.
//
// SSOT: the drop/fold/preview rules mirror generate_sweep_queue.py's pure
// helpers (item_is_covered / drop_completed_items / fold_results_into_mesh /
// build_queue_preview / select_preview_items), which are unit-tested in
// arena/tests/test_queue_refresh.py + test_queue_remedies.py. The TS twins
// live in ./lib.ts (deno test ./lib_test.ts pins them, and
// ./dev/parity_harness.ts replays the full pipeline against a real-size
// artifact for byte-level comparison with the Python --refresh lane).
// Change them together.
//
// PREVIEW POLICY CONTRACT: the preview's top-N selection (per-source-hub cap
// + constructed-language exclusion, 2026-07-12 remedies #3/#4) is driven by
// queue.metadata.preview_policy — { source_cap, exclude_constructed,
// constructed_language_codes } — which the FULL generator derives from the
// language cards (Glottolog arti1236 bucket) over the languages actually in
// the queue. This function has no card access, so the policy must travel in
// the data; language sets are never hardcoded here (SSOT rule). A base queue
// with no preview_policy block gets the pre-policy plain top-N slice.
//
// Deploy + schedule: see ./README.md.

// deno-lint-ignore-file no-explicit-any

import {
  assembleQueueBody,
  buildPreviewFromScan,
  buildTokenPair,
  filterQueueStream,
  foldResultsIntoMesh,
  modelShort,
  normCond,
  projectRegistryStream,
  secretsMatch,
} from "./lib.ts";

// ---- env -----------------------------------------------------------------
// Supabase injects SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
// into every edge function. The rest are optional overrides.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ANON_KEY;
// Public bucket the site serves the full queue.json from (created once; see
// README). queue-preview.json + mesh.json are written here too.
const BUCKET = Deno.env.get("ARTIFACT_BUCKET") ?? "network-artifacts";
// Live site — used to bootstrap the base artifacts the first time the bucket
// is empty, and to read the served registry.json.
const SITE = (Deno.env.get("SITE_BASE_URL") ?? "https://champollion.dev")
  .replace(/\/+$/, "");
const PREVIEW_TOP_N = Number(Deno.env.get("PREVIEW_TOP_N") ?? "25");
const FETCH_PAGE_SIZE = 1000;
// Authorization + debounce (audit 2026-07-18, M2). verify_jwt is satisfied
// by the PUBLIC anon key, so the shared secret below is the real gate; the
// debounce coalesces trigger bursts and bounds cost amplification. The same
// value must live in Vault as `regenerate_queue_secret` (migration 055) so
// the run_cards pg_net trigger can call us.
const REGEN_SECRET = Deno.env.get("REGEN_SHARED_SECRET") ?? "";
const MIN_INTERVAL_S = Number(Deno.env.get("REGEN_MIN_INTERVAL_SECONDS") ?? "60");

// ---- I/O -----------------------------------------------------------------

async function fetchBoard(): Promise<{ coverage: Set<string>; results: any[] }> {
  const coverage = new Set<string>();
  const results: any[] = [];
  let offset = 0;
  // Read the WHOLE board, paged by primary key (stable under concurrent inserts).
  for (;;) {
    const url = `${SUPABASE_URL}/rest/v1/run_cards` +
      `?select=dataset_id,model_slug,condition,chrf_plus_plus,submitted_at` +
      `&trust=neq.disqualified&order=id.asc&limit=${FETCH_PAGE_SIZE}&offset=${offset}`;
    const resp = await fetch(url, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!resp.ok) throw new Error(`run_cards read ${resp.status}: ${await resp.text()}`);
    const page = await resp.json();
    for (const row of page) {
      const ds = (row.dataset_id ?? "").trim().toLowerCase();
      const ms = modelShort(row.model_slug ?? "");
      const cond = normCond(row.condition ?? "");
      coverage.add(`${ds}|${ms}|${cond}`);
      const chrf = row.chrf_plus_plus;
      if (chrf != null && chrf >= 0 && chrf <= 100 && row.submitted_at) {
        results.push({ token: ds, strength: chrf / 100, submitted_at: row.submitted_at });
      }
    }
    if (page.length < FETCH_PAGE_SIZE) break;
    offset += FETCH_PAGE_SIZE;
  }
  return { coverage, results };
}

/** Open a Storage object as a byte stream. 404/400 → null (no artifact). */
async function storageGetStream(
  path: string,
): Promise<ReadableStream<Uint8Array> | null> {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const resp = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (resp.status === 404 || resp.status === 400) {
    await resp.body?.cancel();
    return null;
  }
  if (!resp.ok || !resp.body) {
    throw new Error(`storage download ${path} ${resp.status}`);
  }
  return resp.body;
}

/** Open a served site artifact as a byte stream. The site can answer 200
 * with HTML (e.g. the pre-launch gate page) — a non-JSON content type means
 * no artifact here, so the caller falls through to the honest error paths. */
async function siteGetStream(
  name: string,
): Promise<ReadableStream<Uint8Array> | null> {
  const resp = await fetch(`${SITE}/${name}`);
  if (!resp.ok || !resp.body) {
    await resp.body?.cancel();
    return null;
  }
  const ctype = resp.headers.get("content-type") ?? "";
  if (!ctype.includes("json")) {
    await resp.body.cancel();
    return null;
  }
  return resp.body;
}

async function storageDownload(path: string): Promise<any | null> {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const resp = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (resp.status === 404 || resp.status === 400) return null;
  if (!resp.ok) throw new Error(`storage download ${path} ${resp.status}`);
  return await resp.json();
}

async function fetchSite(name: string): Promise<any | null> {
  const resp = await fetch(`${SITE}/${name}`);
  if (!resp.ok) return null;
  try {
    return await resp.json();
  } catch {
    // The site can answer 200 with HTML (e.g. the pre-launch gate page).
    // Not JSON -> no artifact here; fall through to the honest error paths.
    return null;
  }
}

async function storageUpload(
  path: string,
  body: Uint8Array<ArrayBuffer> | string,
): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Cache-Control": "max-age=60",
      "x-upsert": "true",
    },
    body,
  });
  if (!resp.ok) throw new Error(`storage upload ${path} ${resp.status}: ${await resp.text()}`);
}

// ---- handler -------------------------------------------------------------

async function regenerate(): Promise<any> {
  // The board first: its coverage set drives the per-item drop test while
  // the base queue streams through.
  const { coverage, results } = await fetchBoard();

  // Base queue: prefer the bucket (our own previous output); bootstrap from
  // the live site the first time the bucket is empty. Streamed, never
  // JSON.parsed whole (58.5 MB at prod scale vs the 256 MB isolate).
  const queueStream = (await storageGetStream("queue.json")) ??
    (await siteGetStream("queue.json"));
  if (!queueStream) {
    throw new Error(
      "no base queue.json in the bucket or on the site — seed it with " +
        "`generate_sweep_queue.py` (see README) before refreshing.",
    );
  }
  const scan = await filterQueueStream(queueStream, coverage);

  const metaRaw = scan.capturedRaw.get("metadata");
  const metadata = metaRaw
    ? JSON.parse(new TextDecoder().decode(metaRaw))
    : {};
  metadata.open_items = scan.keptCount;
  metadata.refreshed_at = new Date().toISOString();

  // Preview selection re-scans the kept bytes (a few dozen item parses, not
  // the whole array); the byte total comes from the assembled body so the
  // preview's "Download full queue (NN MB)" link is always honest.
  const queueBody = assembleQueueBody(scan, JSON.stringify(metadata));
  const preview = buildPreviewFromScan(
    scan,
    metadata,
    queueBody.length,
    PREVIEW_TOP_N,
  );
  // Release the kept-bytes segments before the uploads (the assembled body
  // is the only large buffer still needed).
  scan.keptSegments.length = 0;

  await storageUpload("queue.json", queueBody);
  await storageUpload(
    "queue-preview.json",
    JSON.stringify(preview) + "\n",
  );

  const mesh = (await storageDownload("mesh.json")) ??
    (await fetchSite("mesh.json")) ?? { nodes: [], edges: [] };
  // registry.json is served alongside queue.json — the SSOT for edge
  // list/sizes. Stream-projected: only id/path/language_pair/size survive.
  const registryStream = await siteGetStream("registry.json");
  const registry = registryStream
    ? await projectRegistryStream(registryStream)
    : { datasets: [] };
  foldResultsIntoMesh(mesh, results, buildTokenPair(registry), registry);
  await storageUpload("mesh.json", JSON.stringify(mesh) + "\n");

  return {
    ok: true,
    dropped: scan.beforeCount - scan.keptCount,
    remaining: scan.keptCount,
    results_on_board: results.length,
    measured_edges: mesh.measured_edges,
    refreshed_at: metadata.refreshed_at,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Claim the debounce window with an ATOMIC conditional UPDATE on the
 * single-row regen_state table (migration 055): the row is taken only when
 * last_started_at is older than the minimum interval, so a burst of trigger
 * firings runs the refresh once. If the table is missing (migration not yet
 * applied) the debounce fails OPEN with a loud log — the shared secret above
 * is the security boundary; this is cost smoothing, not authorization. */
async function claimDebounce(source: string): Promise<
  { claimed: boolean; retry_after_seconds?: number }
> {
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - MIN_INTERVAL_S * 1000).toISOString();
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/regen_state?id=eq.1&last_started_at=lt.${
        encodeURIComponent(cutoffIso)
      }`,
      {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          last_started_at: nowIso,
          last_source: source,
          updated_at: nowIso,
        }),
      },
    );
    if (!resp.ok) {
      console.error(
        `regen_state debounce claim failed (${resp.status}) — is migration ` +
          `055 applied? Proceeding without debounce (auth already passed).`,
        (await resp.text()).slice(0, 300),
      );
      return { claimed: true };
    }
    const rows = await resp.json();
    if (Array.isArray(rows) && rows.length > 0) return { claimed: true };
    return { claimed: false, retry_after_seconds: MIN_INTERVAL_S };
  } catch (err) {
    console.error("regen_state debounce claim errored — proceeding:", err);
    return { claimed: true };
  }
}

Deno.serve(async (req: Request) => {
  try {
    // ---- authorization (M2): the anon key satisfies verify_jwt, so the
    // shared secret is the real gate. Unconfigured → fail closed, loudly.
    if (!REGEN_SECRET) {
      return json(503, {
        ok: false,
        error: "REGEN_SHARED_SECRET is not configured — set it with " +
          "`supabase secrets set REGEN_SHARED_SECRET=…` and mirror the same " +
          "value in Vault as regenerate_queue_secret (migration 055). " +
          "Refusing to run without authorization.",
      });
    }
    if (!secretsMatch(req.headers.get("x-regen-secret") ?? "", REGEN_SECRET)) {
      return json(401, {
        ok: false,
        error: "missing or invalid x-regen-secret header",
      });
    }

    // Optional {source} tag from the caller (trigger / cron / manual).
    let source = "manual";
    try {
      const body = await req.json();
      if (body && typeof body.source === "string") {
        source = body.source.slice(0, 64);
      }
    } catch {
      // empty or non-JSON body — fine, keep "manual".
    }

    // ---- debounce (M2): coalesce bursts; one refresh per window.
    const claim = await claimDebounce(source);
    if (!claim.claimed) {
      return json(200, {
        ok: true,
        skipped: "debounce",
        min_interval_seconds: MIN_INTERVAL_S,
        retry_after_seconds: claim.retry_after_seconds,
      });
    }

    const summary = await regenerate();
    return json(200, summary);
  } catch (err) {
    console.error("regenerate-queue failed:", err);
    return json(500, { ok: false, error: String(err) });
  }
});
