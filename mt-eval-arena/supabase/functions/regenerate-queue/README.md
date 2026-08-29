# `regenerate-queue` — server-side queue/mesh regeneration

This edge function keeps the public network artifacts fresh as runs arrive,
replacing the deleted **"Regenerate queue + mesh" GitHub Action**. Instead of a
nightly CI job committing big JSON files to git, the artifacts are **generated
and served** — the full `queue.json` lives in Supabase Storage (Vercel serves
it through a rewrite), and this function refreshes it whenever `run_cards`
change.

## What it does (the delta refresh)

On each invocation it:

1. Loads the base **`queue.json`** + **`mesh.json`** from the Storage bucket
   (bootstraps from the live site the first time the bucket is empty).
2. Reads the public **`run_cards`** board — coverage combos + scored results.
3. **Drops** queue items whose `(corpus × model × condition)` is now on the
   board (completed work falls off — two contributors never redo the same item).
4. Rebuilds **`queue-preview.json`** from the trimmed queue.
5. **Folds** the latest results into the mesh edges (status → `measured`,
   `best_chrf`, time-ordered `runs`) and appends any newly-registered pairs from
   the served `registry.json`, so the map fleshes out as runs arrive.
6. Uploads all three back to Storage.

What it deliberately **does not** do: re-derive the ecv-v3 **ranking** or the
reliability bridges. That heavier regeneration needs the cost manifest + the
language cards, so it stays in
[`arena/scripts/generate_sweep_queue.py`](../../../../arena/scripts/generate_sweep_queue.py)
— run it periodically / when corpora change. This function keeps the served
files fresh **between** those structural regens.

> **SSOT.** The drop/fold rules mirror the Python pure helpers
> (`item_is_covered` / `drop_completed_items` / `fold_results_into_mesh` /
> `build_queue_preview` / `select_preview_items`), which are unit-tested in
> [`arena/tests/test_queue_refresh.py`](../../../../arena/tests/test_queue_refresh.py)
> + `test_queue_remedies.py`. The TS twins live in [`lib.ts`](./lib.ts) and
> are pinned by [`lib_test.ts`](./lib_test.ts) (`deno test lib_test.ts`).
> Change them together.

## Prod scale: the streaming redesign (v5, 2026-07-12)

**History.** Measured on the prod project 2026-07-12: the served
`queue.json` is **58.5 MB** (`registry.json` 10.8 MB). v4 did a
whole-document `JSON.parse`; a many-small-objects file balloons
several-fold in V8, so it exhausted the Deno isolate's 256 MB memory and
died with **HTTP 546 `WORKER_RESOURCE_LIMIT`** (~11 s in) before its first
upload — loud and side-effect-free (bucket verified untouched). No version
before v5 ever completed on prod: v1/v2 hit the honest no-base-queue 500
(the site didn't serve JSON yet), v4 the 546 above.

**The redesign.** v5 never parses the full document. A byte-level,
string-aware bracket-depth scanner ([`lib.ts`](./lib.ts)
`TopLevelObjectScanner`) streams the `items` array one element at a time:
each item is `JSON.parse`d alone (small, transient), dropped if its
`(corpus × model × condition)` is on the board, and re-emitted
**byte-verbatim** into segment buffers when kept. `registry.json` is
stream-projected down to the four per-dataset fields the mesh fold needs.
Peak memory is ~2× the kept-items bytes (segments + assembled upload
body), independent of item count. Drop/fold/preview semantics are
unchanged from v4.

**Measured evidence (real 58.5 MB artifact, 83,708 items, Deno 2.9.2):**

- peak live memory (V8 heap + external buffers) **133 MB** vs the 256 MB
  isolate limit — completes under a deliberately tight
  `--max-old-space-size=160` cap;
- **~0.5 s** total compute (filter 0.4 s + registry projection/fold 0.1 s);
- **parity:** output `items` region byte-identical to
  `generate_sweep_queue.py --refresh` on the same base + board fixture;
  preview/mesh value-equal (the only representational difference: JS
  canonicalizes integer-valued floats like `1.0` → `1` in the re-serialized
  metadata/mesh — JSON-value-equal, and `_write_json_if_changed`'s masked
  compare treats them as equal, so no churn);
- **idempotent:** re-running on its own output drops 0 and leaves the
  items region byte-stable.

Repro locally (Deno 2.9.2; artifacts downloaded to a scratch dir, NEVER
committed):

```bash
deno check index.ts lib.ts && deno test lib_test.ts

deno run --allow-read --allow-write --v8-flags=--max-old-space-size=160 \
  dev/parity_harness.ts --queue /scratch/queue.json \
  --registry /scratch/registry.json --mesh /scratch/mesh.json \
  --board /scratch/board.json --outdir /scratch/out
# board.json: {"coverage": ["token|model_short|condition", …],
#              "results": [{"token","strength","submitted_at"}, …]}
```

> **Status (2026-07-12): v5 IS deployed on prod — the 546 is gone, but the
> smoke test is not green yet.** Measured on prod: v5 streamed the full
> 58.5 MB base and ran the whole pipeline in 5.8 s (v4 died at 546 in 11 s),
> then the final Storage upload was rejected with **HTTP 413 Payload too
> large** — the PROJECT-global upload size limit (default 50 MB) is below
> the artifact size. The failure is side-effect-free (bucket verified still
> empty; queue-preview/mesh uploads never ran). Remaining fix is one
> dashboard setting, no code: **Project Settings → Storage → upload file
> size limit → ≥ 200 MB**, then re-run the smoke test below and expect
> `{"ok":true,…}`. Until that smoke test is green, the operating refresh
> lane remains the portable Python fallback (last section) on a schedule.

## One-time setup

### 1. Create the artifact bucket

A **public** bucket named `network-artifacts` (override with the
`ARTIFACT_BUCKET` env var):

```bash
supabase storage create network-artifacts --public
# or: Dashboard → Storage → New bucket → name "network-artifacts", Public ✅
```

### 2. Seed the base artifacts

The function does a *delta* — it needs a base to refresh. Produce the full,
ranked artifacts once and upload them to the bucket:

```bash
cd arena
python3 scripts/generate_sweep_queue.py            # writes cli/website/static/{queue,queue-preview,mesh,registry}.json

# upload the four files to the bucket root:
for f in queue.json queue-preview.json mesh.json registry.json; do
  supabase storage cp "../cli/website/static/$f" "ss:///network-artifacts/$f"
done
```

Re-run this whenever you add corpora or re-tune the ranking — it refreshes the
base the function then keeps current.

### 3. Configure authorization (v6, audit 2026-07-18 M2 — REQUIRED)

`verify_jwt=true` is satisfied by the **public anon key**, so it is not a
gate: before v6, any anon-key holder could loop this heavy refresh
(cost amplification). The handler therefore requires a shared secret and
refuses to run without one (503 unconfigured, 401 mismatch):

```bash
# One random value, TWO homes (they must match):
SECRET=$(openssl rand -hex 32)

# a. the function's own env:
supabase secrets set REGEN_SHARED_SECRET="$SECRET"

# b. Vault, for the migration-036/055 pg_net trigger path:
#    (SQL editor / db query)
select vault.create_secret('<the same value>', 'regenerate_queue_secret');
```

Optional: `REGEN_MIN_INTERVAL_SECONDS` (default `60`) — the debounce window.
Invocations inside the window return `{ok:true, skipped:"debounce"}` without
running; the claim is an atomic conditional UPDATE on the single-row
`regen_state` table (migration 055), so bursts coalesce and concurrent
invocations never double-run.

### 4. Deploy the function

```bash
supabase functions deploy regenerate-queue
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically. Optional overrides (set with
`supabase secrets set KEY=value`): `ARTIFACT_BUCKET`, `SITE_BASE_URL`,
`PREVIEW_TOP_N`, `REGEN_MIN_INTERVAL_SECONDS`.

Smoke-test it:

```bash
curl -i -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/regenerate-queue" \
  -H "Authorization: Bearer <ANON_OR_SERVICE_KEY>" \
  -H "x-regen-secret: <REGEN_SHARED_SECRET>" \
  -d '{"source":"manual"}'
# → {"ok":true,"dropped":N,"remaining":M,"results_on_board":K,"measured_edges":E,...}
#   (a second call within REGEN_MIN_INTERVAL_SECONDS → {"ok":true,"skipped":"debounce",…};
#    without the x-regen-secret header → 401)
```

## Triggering it (pick one)

### A. `run_cards` trigger via pg_net (recommended — true event-driven)

Apply [`../../migrations/036_regenerate_queue_trigger.sql`](../../migrations/036_regenerate_queue_trigger.sql)
**and** [`../../migrations/055_regenerate_queue_auth.sql`](../../migrations/055_regenerate_queue_auth.sql)
**to the dev branch first, then prod after review** (Supabase rule: no prod
writes without an explicit go-ahead). They store the function URL + token +
shared secret in Vault (`regenerate_queue_url` / `regenerate_queue_token` /
`regenerate_queue_secret`) and add a statement-level `AFTER INSERT/UPDATE`
trigger on `run_cards` that fire-and-forgets a call to this function with
the `x-regen-secret` header. Publishing is never blocked — `net.http_post`
queues and returns immediately.

### B. Dashboard Database Webhook (no SQL)

Dashboard → Database → Webhooks → *Create* → table `run_cards`, events
`INSERT`, type *Supabase Edge Function* → `regenerate-queue`. Equivalent to A
without writing the migration — but the webhook must be configured to send
the `x-regen-secret` header (HTTP headers section), or every call is 401.

### C. Scheduled (cron) — debounce / heartbeat

Schedule a periodic call instead of (or alongside) the trigger — coalesces
bursts and also catches new corpora that no `run_cards` insert would surface:

- Supabase **Scheduled Functions** (Dashboard → Edge Functions → Schedules),
  e.g. every 10 minutes — configure the schedule to send the
  `x-regen-secret` header, **or**
- the commented `pg_cron` block at the bottom of migration **055** (the 036
  template updated with the secret header).

The function is idempotent and debounced, so firing it often is harmless.

## Serving the full `queue.json` from Storage (not git)

The full work-list is large and regenerated constantly — it must **not** live in
git. Keep only the small, slim **`queue-preview.json`** committed (the website
pages fetch the preview; the harness fetches the full file). Serve the full file
from the bucket via a Vercel rewrite so the public URL the harness already uses
(`champollion.dev/queue.json`, the run_queue one-liner's default) keeps working
unchanged.

In `cli/website/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/queue.json",
      "destination": "https://<PROJECT_REF>.supabase.co/storage/v1/object/public/network-artifacts/queue.json" },
    { "source": "/mesh.json",
      "destination": "https://<PROJECT_REF>.supabase.co/storage/v1/object/public/network-artifacts/mesh.json" }
  ]
}
```

`queue-preview.json` can either stay the committed static copy (a safe
build-time fallback) or be rewritten to the bucket the same way to always show
the freshest preview. Vercel's elastic edge handles the bandwidth; Storage is
the origin of truth.

> Once the rewrite is live, **remove the giant `queue.json` (and `mesh.json`) from
> git** — they are generated artifacts, not source. Keep `queue-preview.json`
> and `registry.json` committed.

## Why NOT Git LFS for the queue

It's tempting to keep `queue.json` in the repo via Git LFS now that it's tens of
MB. **Don't.** The queue is a *frequently regenerated artifact*, not source:

- **History bloat.** LFS stores every version. A file that's rewritten on every
  publish would accumulate thousands of multi-MB blobs, and **LFS objects are
  never garbage-collected from history** — the repo (and every clone) grows
  without bound.
- **Bandwidth + cost.** GitHub LFS bandwidth/storage is metered and quota-capped;
  a hot artifact burns through it fast, and a contributor who clones pays to pull
  blobs they'll never use.
- **It solves the wrong problem.** LFS exists to *version* large binaries you
  need to track. This file is derived output — it should be **generated and
  served**, never versioned. The generate-and-serve approach here (Storage +
  Vercel rewrite, slim preview in git) is the correct pattern.

So: **slim `queue-preview.json` in git; full `queue.json` generated and served
from Storage; no LFS.**

## Portable fallback (no edge function)

The same delta is implemented in Python and can run from cron or a laptop —
useful for local testing or if you'd rather not deploy the function:

```bash
cd arena
python3 scripts/generate_sweep_queue.py --refresh \
  --output ../cli/website/static/queue.json
# drops completed items + folds results into the existing
# queue.json / queue-preview.json / mesh.json, no re-ranking.
```

Upload the three refreshed files to the bucket afterward (step 2's `cp` loop).
This is the SSOT the edge function mirrors.
