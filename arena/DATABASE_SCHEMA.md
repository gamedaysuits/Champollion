# Database Schema — Single Source of Truth

> [!IMPORTANT]
> This document is the **canonical reference** for the Champollion Supabase schema.
> All migration files, publish.py code, and leaderboard queries must conform to this spec.
> When in doubt, this document wins — **within the range it actually covers.**
>
> **Covers migrations 001–067** — the full set applied to production
> (`sjdomynysdljkbemupqa`). 058–067 were written up 2026-08-01, closing the
> coverage gap this banner used to describe.
>
> Two things that gap note got wrong, corrected here because they are the kind
> of error that outlives the note: **062 adds no table** (`queue_pairs` is a
> set-returning FUNCTION), and **061's table is `contributors`**, not
> `contributor_reputation` — that name belongs to the badge RPC over it. The
> nine objects 058–067 actually add are five tables (`queue_items`,
> `contributors`, `contributor_audit_log`, `tickets`, `docent_usage`), three
> RPCs (`queue_top`, `queue_pairs`, `contributor_reputation`) and one
> service-role accessor (`docent_output_tokens_since`).
>
> **Documents migrations 001–067** in
> `mt-eval-arena/supabase/migrations/` (the canonical migration directory).
> The 2026-07-07 revision covered 001–041; the organizer/registration lane
> (042–048) is folded in below — see "Migrations 042–048" for the delta detail.
> Migration **049** (`049_advisor_hardening_v3.sql`, 2026-07-12) is a
> function/policy hardening pass only — pins `get_services_for_pair`'s
> `search_path` (missed earlier because 034 was applied to prod AFTER 048) and
> converts five 042–046 door policies to the initplan form (same class as 031).
> **050–055** (2026-07-18/19) are the anonymous-intake lane + the
> launch-readiness-audit hardening set (audit §1: H1 run-card content guard,
> M1 contest identity binding, M3 use-context guard, L1 `rls_auto_enable`
> committed, M2 regenerate-queue authorization) — see "Migrations 050–055"
> below for the delta detail.
> This document is **hand-maintained** (there is no generator script): whoever
> adds a migration updates this file in the same change.

## Schema Locations (History)

The schema has historically been defined across three directories. This caused
conflicting table definitions and column mismatches. Going forward:

| Location | Role | Status |
|----------|------|--------|
| `mt-eval-arena/supabase/migrations/` | **CANONICAL** — all new migrations go here (on disk and on prod: `001`–`067`; documented below: `001`–`067`) | ✅ Active |
| `arena/migrations/` | Mirror of 001–011 only (kept for old references) | 🏛️ Historical reference |
| `001_create_run_cards.sql` (historical, dashboard-applied) | Original base table | 🏛️ Historical reference |
| `cli/supabase/migrations/` | Legacy CLI migrations (dashboard-applied) | 🏛️ Historical reference |

### Migration Application Order

The full schema is the result of applying these in order:

```
1. 001_create_run_cards.sql — historical base-table migration (dashboard-applied)
2. cli/supabase/migrations/20260528023253_*.sql             (added 6 columns)
3. cli/supabase/migrations/20260528024953_*.sql             (added 4 columns, created datasets)
4. mt-eval-arena/supabase/migrations/001–067_*.sql          (see the index below)
```

### Migration Index (001–067)

| # | What it did |
|---|-------------|
| 001–004 | COMET/BLEU + CI columns on `run_cards` |
| 005 | `run_card_entries` (per-entry drill-down) |
| 006–007 | Full metric + token-efficiency columns |
| 008 | `contests` + `contest_submissions` |
| 009–011 | `datasets` create + reconciliation (+ `updated_at` trigger) |
| 010 | `style_consistency_rate` |
| 012 | `trading_card_index` + `trading_card_detail` (+ `get_trading_card_index()` RPC) |
| 013–014 | `source_licenses` (+ RPCs) · `trading_card_detail.licenses` |
| 015 | `run_cards.corpus_license` / `corpus_attribution` passthrough |
| 016 | `datasets` RLS: anon blocked from held-out/gold-standard metadata |
| 017 | `run_cards_audit` + audit trigger |
| 018 | `language_experts` (+ RPCs) |
| 019 | `run_cards` INSERT parity: authenticated-only + `trust='unverified'`; drops the spoofable owner-update policy |
| 020 | Advisor hardening v1 (revoke trigger-fn EXECUTE, pin `search_path`) |
| 021 | Trust vocabulary alignment (`unverified`/`verified`/`disqualified`) |
| 022 | **Quarantine guard**: `datasets.quarantined` flag + `run_cards` trigger |
| 023 | **Score-integrity trigger**: range checks, vacuous-run rejection, tier vocabulary |
| 024 | Write-surface lockdown: `datasets` curator-only, `run_card_entries` INSERT-only |
| 025 | Advisor hardening v2 (covers 019–023 functions; `rls_auto_enable` revoke) |
| 026 | **SHA-parity guard**: run's claimed corpus sha must equal the curator-pinned `datasets.sha256` |
| 027 | **Owner binding**: `run_cards.owner_uid` (server-set) + entries bound to the run's owner |
| 028 | `qe_score` / `has_references` (no-reference profile) + range CHECK |
| 029 | `morphological_accuracy` / `morph_coverage` + range CHECKs |
| 030 | `paradigm` axis (method taxonomy, third axis) |
| 031 | RLS init-plan performance (auth calls wrapped in scalar subselects; logic unchanged) |
| 032 | `trading_card_index.aliases` / `iso639_1` (pure-dynamic card resolution) |
| 033 | **Per-entry corpus-content guard** trigger on `run_card_entries` |
| 034 | `translation_services` (human-services v0 discovery registry + RPC) |
| 035 | `contests.use_context` (commercial vs non-commercial lane) |
| 036 | **Regenerate-queue trigger** (pg_net → `regenerate-queue` edge function; Vault-configured) |
| 037 | `sealed_sets` — content-free registry of sealed sovereign corpora |
| 038 | `authorization_requests` + one-way **transition guard** |
| 039 | `auth_grants` + **bind guard** + `claim_auth_grant()` (single-use, time-boxed) |
| 040 | `authorization_audit_log` — append-only, hash-chained audit trail |
| 041 | **Sealed-contest bridge**: `contests.lane` (`standard`/`sealed`) + `contests_corpus_guard` eligibility trigger |
| 042 | `qualifiers` — public-qualifier rounds table + terms-freeze guard |
| 043 | `contest_intake` + `contests.authorization_model`/`intake_daily_limit`/`intake_open` (secret-test-corpus intake lane) |
| 044 | `contest-intake` private storage bucket + own-folder RLS policies (no schema change) |
| 045 | `sealed_sets.request_daily_limit` + `authorization_requests` self-serve INSERT policy, pending-dedup index, admission guard |
| 046 | **Organizer registration door**: `created_by` on `sealed_sets`/`qualifiers` + identity-bound INSERT policies, born-safe-state admission guards, 24/24h throttle |
| 047 | `shared_tasks` (edition umbrella) + `contests.shared_task_id` FK + identity guard |
| 048 | Function EXECUTE hardening: revokes on `claim_auth_grant`/`auth_grant_is_valid` (039) + `notify_regenerate_queue` (036) (no schema change) |
| 049 | Advisor hardening v3: `search_path` pin on `get_services_for_pair` (034 landed on prod after 048) + initplan conversion of five 042–046 door policies (no schema change) |
| 050 | **Anonymous intake**: `anon_intake_log` (rate-limit ledger, RLS deny-all) for the `submit-run` edge function — service-role inserts with `submitter='anonymous'`, `owner_uid=NULL`, `trust='unverified'`; all integrity triggers (022/023/026/033/036/051) stay in force |
| 051 | **Run-card content guard** (audit H1): BEFORE INSERT/UPDATE trigger on `run_cards` — text-column caps + `run_card` must be a JSON object ≤ 1 MB for every row; corpora that are not redistribution-cleared (033's resolution + `is_license_redistributable`) additionally get the strict aggregate-only shape (`run_card_shape_violation`: leaves ≤ 2 k chars, top-level `system_prompt_used` ≤ 64 KB, keys ≤ 128, arrays ≤ 512, strings in array-objects ≤ 500, ≤ 256 KB total) |
| 052 | **Contest identity binding** (audit M1): `contests`/`contest_submissions` INSERT policies bind `created_by`/`submitted_by` to the **JWT email** (043/045/046 pattern) and check the target contest (open + visibility; team ⇒ creator-only, fail-closed); admission triggers add born-`open`, server-stamped timestamps, and rolling-24h birth throttles (constant 24) |
| 053 | **Use-context guard** (audit M3): `contests_use_context_guard` trigger — a `use_context='commercial'` standard-lane contest requires a REGISTERED dataset with a commercial-safe license (`is_license_commercial_safe`, the SQL twin of `license_use.is_commercial_safe`); non-commercial lane unchanged (quarantine already blocks via 041) |
| 054 | **`rls_auto_enable` committed** (audit L1): the prod-only dashboard-created event trigger (`ensure_rls` — force-enables RLS on every new public table) transcribed VERBATIM so rebuilds keep the safety net |
| 055 | **Regenerate-queue authorization** (audit M2): `regen_state` single-row debounce table (service-role only) + `notify_regenerate_queue()` replaced verbatim-plus-secret — sends Vault secret `regenerate_queue_secret` as `x-regen-secret`, which the hardened edge function now requires in-handler (the anon key satisfies verify_jwt, so the shared secret is the real gate) |
| 056 | **`trading_card_index` taxonomy columns**: `iso_type`, `modality`, `iso_scope`, `macrolanguage` (SSOT: language cards) + `get_trading_card_index()` recreated to return them (search_path re-pinned). Closes the tc-index round-trip loss that baked the homepage living/at-risk stats to 0 (2026-07-19 latent hero bug); the uploader now preflights `iso_type` and refuses pre-056 databases. **Prod (2026-07-19, ledger `20260719050451`); rows backfilled same day server-side from the detail blobs (7,918/7,927 carry `iso_type` — L 7,077 · E 602 · H 215 · C 24, exactly the card SSOT)** |
| 057 | **RLS init-plan advisor conformance v2**: rewrites the JWT-email extraction in the five 037/038/042/044-era policies (`authorization_requests_propose_own`, `sealed_sets_register_own`, `qualifiers_register_own`, `contest_intake_submit`, `contest_intake_read`) to the 008/019/043/052 house wrap form. Semantics unchanged (InitPlan either way) — clears the five standing `auth_rls_initplan` advisor WARNs the linter raised on the equivalent-but-unrecognized wrap shape. **Prod (2026-07-19); advisor board verified zero WARNs after apply** |
| 058 | **`rls_auto_enable` EXECUTE re-revoke** (audit DB2): 025's revoke is a DO-block that no-ops when the function is absent, so on a LINEAR replay it runs long before **054** first CREATEs `rls_auto_enable()` — and 054's fresh create restores PostgreSQL's default PUBLIC EXECUTE with nothing left to re-revoke it. Re-applies the revoke AFTER 054 (same `oid::regprocedure` FOR-loop as 025 §1), so the "zero advisor warnings" guarantee is replay-stable instead of an accident of prod's apply order. No-op on prod; the event trigger still fires — event triggers are invoked by the system on DDL, not through EXECUTE privilege |
| 059 | **DB-as-queue** (B1): `queue_items` (ranked candidate work, upserted by the Python ranker `arena/scripts/generate_sweep_queue.py`, which remains the ranking AUTHORITY) + the `queue_top(p_rank_mode, p_limit, p_offset)` RPC, which returns an ordered page and live-excludes every `(corpus_id, model, condition)` already covered by a **`trust='verified'`** run — unverified/pending work never suppresses queue work. Public-read, service-role write. 059's own header scopes the follow-on carefully — the 7–58 MB static `queue.json` blob and the hand-rolled edge streaming scanner that worked around the 256 MB isolate **can** retire once consumers migrate to the RPC. Neither has: `filterQueueStream` is still live in `regenerate-queue/index.ts`, and `queue-preview.json` is still shipped |
| 060 | `queue_items.source_length` INT → **NUMERIC**: the column carries the registry richness `mean_source_chars` — a FRACTIONAL mean (e.g. `19.0`) — which 059's `int` rejected outright (`invalid input syntax for type integer: "19.0"`). Widened so the DB row equals the served `queue.json` value exactly (the parity contract). Safe: the table was still empty |
| 061 | **Reputation-weighted auditing** (B3, L1): `contributors` — one reputation ledger row per stable identity (`contributor_id` = `'uid:<owner_uid>'` today, `'key:<fp>'` reserved for a future pseudonymous scheme, so both fit the same table and the same math with no migration) — plus `contributor_audit_log`, the append-only public audit/retraction trail, and the `contributor_reputation(text)` badge RPC. Reputation is earned ONLY by hard-to-fake signals (a clean L2 re-run, or L3 corroboration), never by an L0 pass alone, so minting fresh identities buys nothing. Both tables public-read (transparency is the point), service-role write. Purely ADDITIVE — 022/023/026/033/051 and `queue_top`'s verified-only serving are all untouched |
| 062 | **`queue_pairs(rank_mode)` RPC** (B1) — per-language-pair aggregation `{pair, src, tgt, item_count, min_cost}` over `queue_items`, carrying `queue_top`'s `NOT EXISTS … trust='verified'` coverage filter **verbatim**, so the leaderboard's "N benchmarks waiting" strip and `/contribute`'s open-item total (`SUM(item_count)`) drop the instant a verified run covers a pair's last open combo. Read-only, SECURITY INVOKER; **adds no table** |
| 063 | **Run-card content-guard perf hoist** (launch review 2026-07-20, DB6): `run_cards_content_guard_check()` replaced with a body that serializes the row into a local `card_json` **once**, instead of re-running `to_jsonb(NEW)` for each of 13 text-column checks — NEW carries the up-to-1 MB `run_card`, so an ordinary publish (and every verifier `trust` PATCH, which re-runs the whole BEFORE trigger) re-serialized the entire row ~13×. Behaviour is byte-identical to 051 in every observable respect; `run_card_shape_violation()` is untouched (051 remains its only definition) and the `run_cards_content_guard` trigger stays bound by name — deliberately NOT recreated. `SET search_path = public` is re-pinned, because a bare `CREATE OR REPLACE` would silently drop 051's pin and reintroduce advisor lint 0011 |
| 064 | **Quarantine backstop ANCHORED** (launch review 2026-07-20, DB7 + E9): the known-improper-slice regex shared byte-identically by `reject_quarantined_datasets()` (022) and `contest_corpus_guard()` (041) was an UNANCHORED substring blocklist, so legitimate future ids collided with the incident-specific crk slices — `crk-master-2026`, `dev-1240`, `sample-620`, and anything containing the literal `-quarantined` were permanently unpublishable AND contest-ineligible, with no `datasets` row to unflag because they were never quarantined. Both twins now carry `(sample[-_]?62(?![0-9])\|phase1[-_]?test\|dev[-_]?124(?![0-9])\|crk[-_]?master(?![-_]?[0-9]))`; the bare `-quarantined` alternative is REMOVED (the two seeded incident ids are still caught by their `phase1-test` / `dev-124` markers, and `datasets.quarantined` remains the PRIMARY, data-driven mechanism). Negative lookaheads compile identically in the PostgreSQL ARE engine and Python `re`, so the DB-less migration-text tests keep the one literal a true single source. E9: 022's `search_path` pin — added later by 025 via `ALTER FUNCTION`, and droppable by a bare replace — is written into the definition |
| 065 | **Tickets intake** (founder direction 2026-07-20): `tickets` behind the `submit-ticket` edge function (verify_jwt=false) — one visitor contact / objection / **takedown** message, validated strictly, rate-limited per IP, inserted with the service role, and emailed to info@champollion.dev. The DB row is the durable **record of record**; the email is a notification, and an email failure must never lose the ticket. A dedicated table rather than a generic log because tickets carry free-text visitor content and an optional reply-to address — PII-adjacent, never rankable, never public — so it gets `anon_intake_log`'s deny-all RLS treatment |
| 066 | **Docent usage ledger** (founder direction 2026-07-20): `docent_usage` — one COUNTERS-ONLY row per docent answer (FAQ short-circuits log `faq_hit=true` with zero tokens). Drives the per-IP hourly window and a GLOBAL DAILY TOKEN BUDGET that DEGRADES `docent-chat` to FAQ-only mode when crossed, so the visitor is told the guide is resting rather than handed a silent 500 or the founder a surprise bill. **No conversation content is ever stored** (founder decision 2026-07-20: the docent logs counts, not transcripts); raw IPs never stored. Deny-all RLS below service_role |
| 067 | **`docent_output_tokens_since(timestamptz)`** (bugfix 2026-07-26): the docent asked PostgREST for its 24 h output-token sum with `select=output_tokens.sum()`, but aggregate functions are DISABLED on this project (`PGRST123`, PostgREST's default-since-12 DoS guard) — so the sum threw on EVERY request and the handler's fail-closed branch turned that into a blanket `503 {"error":"the guide is briefly unavailable …"}`. The docent was hard-down for every visitor, behind a message that reads like a transient blip; caught by calling the deployed prod endpoint. The sum now happens in the database behind a narrow SECURITY INVOKER function with EXECUTE granted to **service_role only** — rather than enabling project-wide aggregates and loosening a DoS guard on every table to serve one counter. Returns a scalar, never row content |

> [!NOTE]
> **Applied-state note (2026-07-12).** Migrations through 035 were applied to
> production over the launch-hardening period (030 applied to prod 2026-06-16 by
> explicit founder directive). Migrations 036–048 — the contest/organizer lane —
> were applied to production and guard-verified during the 2026-07-11 go-live
> integration (036's Vault secrets + the `regenerate-queue` edge function are
> live on prod). The 034 human-services lane's sovereignty rollout decision remains
> with the founder. **050–055 were applied to production 2026-07-19** under
> the founder's launch-hardening authorization, together with the `submit-run`
> deploy (verify_jwt=false) and the hardened `regenerate-queue` deploy.
> **056 and 057 were applied to production 2026-07-19** (founder-directed;
> canonical ledger names). The 056 taxonomy columns were backfilled the same
> day server-side from the `trading_card_detail` blobs (same staging build,
> provably identical values); future full uploads re-stamp them via the
> extended `upload-trading-cards.mjs` mapping, which preflights `iso_type`
> and refuses databases missing the migration. The website's
> `ensure-tc-index` card-SSOT heal remains as defense-in-depth.
> Never apply anything to the production project without the
> founder's explicit go-ahead (root `CLAUDE.md`).

> **058–064 were applied to production 2026-07-19/20** and **065–067 on
> 2026-07-26**, all under explicit founder authorization, alongside the
> `submit-ticket` and `docent-chat` edge-function deploys. Note the ledger
> order: **062 was applied before 061** (`20260720044230` vs `20260720045102`).
> That is harmless — 062 only creates a function over 059's table and has no
> dependency on 061 — but a strict file-order replay and the prod ledger differ
> here, so do not use ledger order to infer dependency order.
> Never apply anything to the production project without the founder's explicit
> go-ahead (root `CLAUDE.md`).

> [!CAUTION]
> The `datasets` table was created by CLI migration `20260528024953` with one schema,
> then arena migration `009` attempted to CREATE the same table with a different schema.
> Since `CREATE TABLE IF NOT EXISTS` is used, **whichever ran first wins**.
> The canonical schema is defined below; `011_reconcile_datasets.sql` reconciles them.

---

## Cross-Cutting Integrity Guards (the un-bypassable layer)

Triggers fire beneath **every** client and key — `service_role` bypasses RLS but
**not** triggers. These are the data-layer floor of the project's integrity and
sovereignty commitments:

| Guard | Migration | Table | What it rejects |
|-------|-----------|-------|-----------------|
| `run_cards_audit_trigger` | 017 | `run_cards` | Nothing — records every UPDATE/DELETE's prior row into `run_cards_audit` |
| `run_cards_quarantine_guard` | 022 | `run_cards` | Any run against a dataset with `datasets.quarantined = true`, plus a regex backstop for the known-improper crk slice ids |
| `run_cards_score_integrity` | 023 | `run_cards` | Out-of-range metrics ([0,1] rates, [0,100] chrF++/COMET), inverted CIs, non-positive `corpus_size`, vacuous runs (`overall.evaluated <= 0`), unknown `quality_tier` |
| `run_cards_sha_parity_guard` | 026 | `run_cards` | A run whose claimed corpus sha (`run_card->dataset->sha256`) ≠ the curator-pinned `datasets.sha256` (skips silently when either sha is absent — those runs never verify/rank) |
| `run_card_entries_content_guard` | 033 | `run_card_entries` | Per-entry corpus CONTENT for quarantined datasets, sealed segments (`held_out`/`gold_standard`), non-redistribution-cleared licenses, or **unregistered corpora (fail-safe)**. Mirrors `publish.py _entry_content_publishable`; parity asserted by `arena/tests/test_content_guard_migration.py` |
| `run_cards_regenerate_queue` | 036 | `run_cards` | Nothing — AFTER-statement fire-and-forget pg_net POST to the `regenerate-queue` edge function on INSERT / UPDATE OF trust (no-op until the Vault secrets exist) |
| `authorization_requests_transition_guard` | 038 | `authorization_requests` | Any edit to a request's frozen terms; any state transition outside `pending → {authorized, denied, expired}` and `authorized → expired` |
| `contests_corpus_guard` | 041 | `contests` | A `lane='sealed'` contest whose `corpus_id` is not a registered **active** `sealed_sets` row (fail-closed); a `lane='standard'` contest naming a sealed set, a quarantined dataset, or a migration-022 known-improper slice id. Does NOT modify the 022 `run_cards` guard |
| `auth_grants_bind_guard` | 039 | `auth_grants` | A grant minted for a non-existent or non-`authorized` request; fingerprint/sealed-set mismatch vs the request; born-expired or born-used grants; any edit to frozen grant terms; un-using a used grant |
| `authorization_audit_log_chain` | 040 | `authorization_audit_log` | Nothing — BEFORE INSERT computes `prev_hash`/`row_hash` (advisory-locked linear chain; client-supplied hashes are overwritten) |
| `authorization_audit_log_immutable` | 040 | `authorization_audit_log` | **Every** UPDATE and DELETE — the log is strictly append-only |
| `qualifiers_terms_guard` | 042 | `qualifiers` | Any edit to a qualifier's frozen terms (id/corpus/sealed-set/threshold/metric/year); any status change other than one-way `active → frozen` |
| `contest_intake_admission_guard` | 043 | `contest_intake` | An intake for a closed contest or one with `intake_open = false`; submissions past the rolling-24h `intake_daily_limit`; any born-state other than `received` |
| `contest_intake_transition_guard` | 043 | `contest_intake` | Any edit to an intake's frozen identity/digests; lifecycle transitions outside the one-way state machine; a `rejected` row without a `reject_reason` |
| `authorization_requests_admission_guard` | 045 | `authorization_requests` | A request against an inactive sealed set; born non-pending/decided requests; requests past the rolling-24h `request_daily_limit` |
| `sealed_sets_admission_guard` | 046 | `sealed_sets` | A self-serve registration born un-quarantined or outside `planned`/`active`; more than 24 registrations per creator per 24h |
| `qualifiers_admission_guard` | 046 | `qualifiers` | A qualifier born non-`active`, gating a nonexistent/retired sealed set, or past the per-creator throttle |
| `shared_tasks_identity_guard` | 047 | `shared_tasks` | Any edit to a shared task's frozen slug/year/created_at; any status change other than one-way `active → archived` |
| `run_cards_content_guard` | 051 | `run_cards` | Oversized text columns; a non-object or > 1 MB `run_card`; and, for corpora that are NOT redistribution-cleared (unregistered / NC / ND / unknown — 033's fail-safe resolution), any `run_card` violating the strict aggregate-only shape (> 256 KB, string leaves > 2 k chars except top-level `system_prompt_used` ≤ 64 KB, arrays > 512, text-bearing array-objects — the per-entry-dump shape) |
| `contests_admission_guard` | 052 | `contests` | A contest born non-`open` or with an empty `created_by`; more than 24 creations per creator per rolling 24h. Server-stamps `created_at` |
| `contest_submissions_admission_guard` | 052 | `contest_submissions` | An empty `submitted_by`; more than 24 submissions per (submitter, contest) per rolling 24h. Server-stamps `submitted_at` |
| `contests_use_context_guard` | 053 | `contests` | A `use_context='commercial'` standard-lane contest over an unregistered dataset (license unknown → fail-safe) or one whose license is not commercial-safe (NC / SA / ND / copyleft / unstated / restricted). Sealed + non-commercial lanes pass through (041 owns those rules) |
| `ensure_rls` (event trigger) | 054 | *(schema-wide)* | Nothing — force-enables RLS on every new `public` table at CREATE (deny-all until policies are written); dashboard-created on prod, committed verbatim by 054 |
| `set_datasets_updated_at` | 011 | `datasets` | Nothing — maintains `updated_at` |

---

## Table: `run_cards`

The primary leaderboard table. Each row is one benchmark submission.

### Columns

| Column | Type | Nullable | Default | Source | Notes |
|--------|------|----------|---------|--------|-------|
| `id` | TEXT | NOT NULL | — | `publish.py` | SHA-256 hash, PRIMARY KEY |
| `submitter` | TEXT | NOT NULL | — | `publish.py` | Email from OAuth session, or `'anonymous'` via the submit-run intake (display only — NOT an authorization identity; see `owner_uid`) |
| `owner_uid` | UUID | YES | `auth.uid()` | DB default | **Server-set inserting identity** (migration 027). NULL for service_role inserts (verifier/CI/anonymous intake, no JWT). The RLS insert policy requires `owner_uid = auth.uid()`. `owner_uid IS NULL AND submitter='anonymous'` marks the anonymous lane (050) |
| `affirmation` | TEXT | NOT NULL | — | `publish.py` | Auto-generated attestation |
| `submitted_at` | TIMESTAMPTZ | NOT NULL | `now()` | DB default | Auto-set on insert |
| `trust` | TEXT | NOT NULL | `'unverified'` | `publish.py` | **CHECK**: `('unverified', 'verified', 'disqualified')` (vocabulary aligned by migration 021) |
| `model_slug` | TEXT | NOT NULL | — | `publish.py` | e.g. `"anthropic/claude-3.5-sonnet"` |
| `condition` | TEXT | NOT NULL | — | `publish.py` | e.g. `"en>crk+coaching"` |
| `dataset_id` | TEXT | NOT NULL | — | `publish.py` | FK-like ref to `datasets.id` |
| `language_pair` | TEXT | NOT NULL | — | `publish.py` | e.g. `"en>crk"` |
| `harness_version` | TEXT | NOT NULL | — | `publish.py` | Semver string |
| `chrf_plus_plus` | REAL | YES | — | `publish.py` | 0–100 scale (trigger-checked, migration 023) |
| `exact_match_rate` | REAL | YES | — | `publish.py` | 0–1 rate (trigger-checked) |
| `fst_acceptance_rate` | REAL | YES | — | `publish.py` | 0–1 rate (trigger-checked) |
| `equivalent_match_rate` | REAL | YES | — | `publish.py` | 0–1 rate (trigger-checked) |
| `semantic_score` | REAL | YES | — | `publish.py` | 0.0–1.0 |
| `composite_score` | REAL | YES | — | `publish.py` | 0.0–1.0 weighted composite (formula SSOT: `mt_eval_harness/scoring.py`) |
| `quality_tier` | TEXT | YES | — | `publish.py` | Tier label — trigger-enforced vocabulary: `baseline/emerging/functional/deployable/fluent/unscored` |
| `total_cost_usd` | REAL | YES | — | `publish.py` | Total API cost |
| `cost_per_entry_usd` | REAL | YES | — | `publish.py` | Per-entry cost |
| `elapsed_seconds` | REAL | YES | — | `publish.py` | Total wall time |
| `avg_latency_seconds` | REAL | YES | — | `publish.py` | Mean per-entry latency |
| `median_latency_seconds` | REAL | YES | — | `publish.py` | Median per-entry latency |
| `p95_latency_seconds` | REAL | YES | — | `publish.py` | 95th percentile latency |
| `corpus_size` | INTEGER | YES | — | `publish.py` | Number of entries evaluated (trigger: must be > 0) |
| `run_card` | JSONB | NOT NULL | — | `publish.py` | Complete run card (source of truth) |
| `fingerprint_hash` | TEXT | NOT NULL | — | `publish.py` | Method+config identity hash |
| `api_provider` | TEXT | YES | `'openrouter'` | `publish.py` | e.g. `"openrouter"` |
| `run_timestamp` | TIMESTAMPTZ | YES | — | `publish.py` | When the run was executed |
| `batch_size` | INTEGER | YES | `25` | `publish.py` | API batch size |
| `temperature` | REAL | YES | `0` | `publish.py` | Sampling temperature |
| `max_tokens` | INTEGER | YES | — | `publish.py` | Max completion tokens |
| `comet_score` | FLOAT8 | YES | — | `publish.py` | COMET metric, 0–100 (trigger-checked) |
| `corpus_bleu` | FLOAT8 | YES | — | `publish.py` | Corpus-level BLEU |
| `chrf_ci_lower` / `chrf_ci_upper` | FLOAT8 | YES | — | `publish.py` | chrF++ 95% CI (trigger: lower ≤ upper) |
| `exact_match_ci_lower` / `exact_match_ci_upper` | FLOAT8 | YES | — | `publish.py` | Exact-match CI |
| `fst_ci_lower` / `fst_ci_upper` | REAL | YES | — | `publish.py` | FST acceptance CI |
| `composite_ci_lower` / `composite_ci_upper` | REAL | YES | — | `publish.py` | Composite CI |
| `ter` | REAL | YES | — | `publish.py` | Translation Edit Rate |
| `length_ratio` | REAL | YES | — | `publish.py` | Avg predicted/reference length |
| `tokens_per_second` | REAL | YES | — | `publish.py` | Throughput metric |
| `entries_per_minute` | REAL | YES | — | `publish.py` | Throughput metric |
| `cost_per_source_char` | REAL | YES | — | `publish.py` | Cost normalized by source length |
| `tokens_per_entry` | REAL | YES | — | `publish.py` | Avg tokens per corpus entry |
| `cost_per_1k_tokens` | REAL | YES | — | `publish.py` | Cost per 1000 tokens |
| `code_switching_rate` | REAL | YES | — | `publish.py` | 0.0–1.0, lower is better (trigger-checked) |
| `hallucination_rate` | REAL | YES | — | `publish.py` | 0.0–1.0, lower is better (trigger-checked) |
| `terminology_adherence` | REAL | YES | — | `publish.py` | 0.0–1.0, higher is better |
| `style_consistency_rate` | REAL | YES | — | `publish.py` | 0.0–1.0, informational only (migration 010; trigger-checked) |
| `qe_score` | REAL | YES | — | `publish.py` | Reference-free QE score, 0–1 (migration 028; CHECK `run_cards_qe_score_range`); verifier-re-derived |
| `has_references` | BOOLEAN | YES | `TRUE` | `publish.py` | False ⇒ scored under the reference-free `no-reference` profile (migration 028) |
| `morphological_accuracy` | REAL | YES | — | `publish.py` | FST-derived, lemma-matched inflection accuracy, 0–1 (migration 029; CHECK); ADVISORY until dropped from `scoring.INACTIVE_METRICS` |
| `morph_coverage` | REAL | YES | — | `publish.py` | Fraction of analyzable words lemma-matched, 0–1 (migration 029; CHECK); disclosed so a sparse score is never hidden |
| `method_class` | TEXT | YES | — | `publish.py` | Method class from the method card (raw-llm, coached-llm, pipeline, custom-plugin, api, human). NULL for harness-native runs |
| `paradigm` | TEXT | YES | — | `publish.py` | MT paradigm axis (rule-based, statistical, neural-nmt, llm, hybrid, human, unknown), orthogonal to `method_class` and dependency class (migration 030). Enum enforced app-side (`config.VALID_PARADIGMS`) |
| `corpus_license` | TEXT | YES | — | `publish.py` | Corpus SPDX-ish license from `arena/datasets/registry.json` (migration 015); NULL for unregistered datasets |
| `corpus_attribution` | TEXT | YES | — | `publish.py` | Corpus attribution string (migration 015); NULL for unregistered datasets |

### Constraints

```sql
PRIMARY KEY (id)
CHECK (trust IN ('unverified', 'verified', 'disqualified'))          -- run_cards_trust_check (021)
CHECK (qe_score IS NULL OR (qe_score >= 0 AND qe_score <= 1))        -- run_cards_qe_score_range (028)
CHECK (morphological_accuracy IS NULL OR (... BETWEEN 0 AND 1))      -- run_cards_morphological_accuracy_range (029)
CHECK (morph_coverage IS NULL OR (... BETWEEN 0 AND 1))              -- run_cards_morph_coverage_range (029)
```

### Triggers

| Trigger | Timing | Effect |
|---------|--------|--------|
| `run_cards_quarantine_guard` | BEFORE INSERT/UPDATE | Rejects quarantined datasets (`datasets.quarantined` flag + improper-slice regex backstop). Migration 022 |
| `run_cards_score_integrity` | BEFORE INSERT/UPDATE | Range-checks every metric, rejects vacuous runs and unknown tiers. Does NOT recompute the composite (that stays in `scoring.py` + the publish gate). Migration 023 |
| `run_cards_sha_parity_guard` | BEFORE INSERT/UPDATE | Claimed corpus sha must equal the curator-pinned `datasets.sha256`; silently skips unregistered/unpinned corpora. Migration 026 |
| `run_cards_audit_trigger` | AFTER UPDATE/DELETE | Preserves the prior row in `run_cards_audit` (SECURITY DEFINER fn). Migration 017 |
| `run_cards_regenerate_queue` | AFTER INSERT / UPDATE OF trust, FOR EACH STATEMENT | Fire-and-forget pg_net POST to the `regenerate-queue` edge function; no-op until Vault secrets `regenerate_queue_url`/`regenerate_queue_token` are set; sends the `x-regen-secret` header from Vault secret `regenerate_queue_secret` (055) so the hardened function admits it. Migrations 036 + 055 |
| `run_cards_content_guard` | BEFORE INSERT/UPDATE | Content guard for the world-readable aggregate row (audit H1): text-column caps; `run_card` must be a JSON object ≤ 1 MB; non-redistribution-cleared corpora additionally get the strict aggregate-only JSONB shape (see the guards table above). Migration 051 |

### RLS Policies

| Policy | Operation | Rule | Rationale |
|--------|-----------|------|-----------|
| Public read | SELECT | `USING (true)` | Leaderboard is public |
| Authenticated insert | INSERT | `WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND trust = 'unverified' AND id IS NOT NULL AND length(id) > 10 AND owner_uid = (SELECT auth.uid()))` | Migrations 019 → 027 → 031. Anonymous insert was removed; trust elevation is service-role-only; the caller cannot claim another user's uid |
| No update/delete | — | — | Submissions are immutable; admins use service_role (and the 017 audit trail records any change) |

### Indexes

```sql
idx_run_cards_leaderboard             ON (dataset_id, chrf_plus_plus DESC NULLS LAST)
idx_run_cards_model                   ON (model_slug, dataset_id)
idx_run_cards_fingerprint             ON (fingerprint_hash)
idx_run_cards_comet_score             ON (comet_score DESC NULLS LAST)
idx_run_cards_composite               ON (composite_score DESC NULLS LAST)
idx_run_cards_qe_score                ON (qe_score DESC NULLS LAST)                 -- 028
idx_run_cards_morphological_accuracy  ON (morphological_accuracy DESC NULLS LAST)  -- 029
idx_run_cards_method_class            ON (method_class) WHERE method_class IS NOT NULL
idx_run_cards_paradigm                ON (paradigm)     WHERE paradigm IS NOT NULL  -- 030
```

---

## Table: `run_card_entries`

Per-entry results for each run. Denormalized LYSS verdicts enable SQL filtering.

### Columns

| Column | Type | Nullable | Default | Source |
|--------|------|----------|---------|--------|
| `id` | BIGINT | NOT NULL | identity | DB |
| `run_card_id` | TEXT | NOT NULL | — | FK to `run_cards.id` ON DELETE CASCADE |
| `entry_id` | TEXT | NOT NULL | — | Corpus entry ID |
| `source` | TEXT | NOT NULL | — | Source text (**content-guarded — see trigger**) |
| `expected` | TEXT | NOT NULL | — | Reference translation (**content-guarded**) |
| `raw_predicted` | TEXT | YES | — | Raw model output (pre-processing) |
| `predicted` | TEXT | YES | — | Final predicted translation |
| `segment` | TEXT | YES | `''` | Corpus segment |
| `difficulty` | SMALLINT | YES | — | Difficulty tier (1–5) |
| `domain` | TEXT | YES | `''` | Content domain |
| `exact_match` | BOOLEAN | NOT NULL | — | Exact string match |
| `chrf_score` | REAL | YES | — | Per-entry chrF++ |
| `bleu_score` | REAL | YES | — | Per-entry BLEU |
| `latency_s` | REAL | YES | — | Per-entry response time |
| `cost_usd` | REAL | YES | — | Per-entry API cost |
| `tool_call_count` | SMALLINT | YES | `0` | Tool calls used |
| `error` | TEXT | YES | — | Error message if failed |
| `plugin_metrics` | JSONB | YES | `'{}'` | Full plugin results blob |
| `fst_valid` | BOOLEAN | YES | — | FST accepted? |
| `equivalent_match` | BOOLEAN | YES | — | Structural equivalence? |
| `semantic_verdict` | TEXT | YES | — | VALID/MISMATCH/UNKNOWN/ERROR |
| `code_switching_detected` | BOOLEAN | YES | — | Source leakage? |
| `hallucination_detected` | BOOLEAN | YES | — | Fabricated content? |

### Constraints

```sql
UNIQUE (run_card_id, entry_id)
FOREIGN KEY (run_card_id) REFERENCES run_cards(id) ON DELETE CASCADE
```

### Triggers

| Trigger | Timing | Effect |
|---------|--------|--------|
| `run_card_entries_content_guard` | BEFORE INSERT/UPDATE | Un-bypassable corpus-content gate (migration 033). Resolves the entry's corpus via `run_card_id → run_cards.dataset_id → datasets`, then rejects the insert when the dataset is quarantined, `segment` is `held_out`/`gold_standard`, the dataset license is not redistribution-cleared (`is_license_redistributable()`), or **no datasets row resolves** (fail-safe — stricter than the Python client). Mirrors `publish.py _entry_content_publishable`; `service_role` bypasses RLS but **not** triggers, so this also covers curator/CI inserts. The aggregate run_card still publishes (scores-only) |

### RLS Policies

| Policy | Operation | Rule |
|--------|-----------|------|
| Public read | SELECT | `USING (true)` |
| Owner insert | INSERT | `WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND parent run_card owned by auth.uid())` (migrations 027/031; INSERT-only since 024 dropped the open UPDATE) |

### Indexes

| Name | Columns | Type |
|------|---------|------|
| `idx_rce_run_card` | `run_card_id` | B-tree |
| `idx_rce_entry_id` | `entry_id` | B-tree |
| `idx_rce_fst_valid` | `fst_valid` | Partial (WHERE fst_valid IS NOT NULL) |
| `idx_rce_semantic` | `semantic_verdict` | Partial (WHERE semantic_verdict IS NOT NULL) |
| `idx_rce_code_switching` | `code_switching_detected` | Partial (WHERE = TRUE) |
| `idx_rce_hallucination` | `hallucination_detected` | Partial (WHERE = TRUE) |

---

## Table: `datasets`

Corpus **metadata** registry (never corpus content). Curator-owned since
migration 024: all writes go through service_role; the registry SSOT is
`arena/datasets/registry.json`, synced by the upload pipeline.

### Columns (after reconciliation, 011 + 022)

| Column | Type | Nullable | Default | Origin |
|--------|------|----------|---------|--------|
| `id` | TEXT | NOT NULL | — | PK (CLI) |
| `name` | TEXT | NOT NULL | — | CLI |
| `version` | TEXT | YES | — | CLI (relaxed by 011) |
| `source_language` | TEXT | NOT NULL | — | CLI |
| `target_language` | TEXT | NOT NULL | — | CLI |
| `language_pair` | TEXT | NOT NULL | — | CLI |
| `entry_count` | INTEGER | YES | — | CLI |
| `sha256` | TEXT | YES | — | CLI — **the trusted corpus pin** enforced by the 026 sha-parity guard |
| `domain` | TEXT | YES | — | CLI (scalar, original) |
| `segment` | TEXT | NOT NULL | `'development'` | CLI — CHECK `(development, diagnostic, gold_standard, held_out)` |
| `license` | TEXT | YES | — | CLI — read by the 033 content guard (`is_license_redistributable`) |
| `source` | TEXT | YES | — | CLI (attribution) |
| `notes` | TEXT | YES | — | CLI |
| `created_at` | TIMESTAMPTZ | YES | `now()` | CLI |
| `difficulty_min` / `difficulty_max` | INTEGER | YES | — | Arena (011) |
| `domains` | TEXT[] | YES | `'{}'` | Arena (011) |
| `segments` | TEXT[] | YES | `'{}'` | Arena (011) |
| `updated_at` | TIMESTAMPTZ | YES | `now()` | Arena (011; maintained by `set_datasets_updated_at` trigger) |
| `metadata` | JSONB | YES | `'{}'` | Arena (011) |
| `quarantined` | BOOLEAN | NOT NULL | `false` | **Migration 022** — the SSOT quarantine flag. Flagging/unflagging is a plain service-role UPDATE; the 022 trigger enforces it beneath every client |
| `quarantine_reason` | TEXT | YES | — | **Migration 022** — human-readable reason (e.g. the improper EdTeKLA-subset order of 2026-06-13) |

### RLS Policies

| Policy | Operation | Rule |
|--------|-----------|------|
| Anon read (public segments) | SELECT | `TO anon USING (segment IS NULL OR segment NOT IN ('held_out', 'gold_standard'))` (016) |
| Authenticated read | SELECT | `TO authenticated USING (true)` (016) |
| *(no write policies)* | — | **Curator-only writes** (service_role bypasses RLS). Migration 024 dropped `datasets_auth_write` — an authenticated user must not be able to re-point `sha256`, un-quarantine a slice, or expose a sealed segment |

> [!NOTE]
> Migration `016` replaced the original blanket public-read policy: anonymous
> visitors can no longer enumerate metadata (entry counts, sha256 hashes) of
> held-out or gold-standard corpora — a sha256 of a small corpus is an oracle
> for contamination probing.

---

## Table: `run_cards_audit`

Audit trail for run card mutations (migration `017`). Run cards are immutable
via the public API; any UPDATE/DELETE (admin moderation via service_role, or a
future policy mistake) preserves the prior row here so tampering is detectable
and reversible.

| Column | Type | Nullable | Default | Source |
|--------|------|----------|---------|--------|
| `id` | BIGINT | NOT NULL | identity | DB |
| `run_card_id` | TEXT | NOT NULL | — | Trigger (`OLD.id`) |
| `action` | TEXT | NOT NULL | — | Trigger (`TG_OP`) — **CHECK**: `('UPDATE', 'DELETE')` |
| `changed_at` | TIMESTAMPTZ | NOT NULL | `now()` | DB |
| `old_row` | JSONB | NOT NULL | — | Trigger (`to_jsonb(OLD)`) — complete prior row |

Trigger: `run_cards_audit_trigger` (AFTER UPDATE OR DELETE ON run_cards →
`run_cards_audit_fn()`, SECURITY DEFINER; API-facing EXECUTE revoked by 020/025).
Index: `idx_run_cards_audit_run_card ON (run_card_id)`.

RLS: service-role SELECT only; **no anon/authenticated policies** (RLS enabled +
no policy = deny) — the audit log is invisible to the public API.

---

## Table: `anon_intake_log`

Rate-limit ledger for the anonymous intake lane (migration `050`, applied to
prod 2026-07-19 with the `submit-run` deploy). The `submit-run` edge function
(verify_jwt=false) counts rows here to enforce a per-IP sliding hour window
(default 5 cards) plus a global daily cap (default 200), then logs each
successfully published anonymous card. **Privacy:** only a salted SHA-256 of
the client IP is stored, never the raw IP. The IP itself is derived from the
LAST public `X-Forwarded-For` hop (or the connection peer) — never the
client-spoofable leftmost hop (audit 2026-07-18 H2;
`functions/submit-run/lib.ts clientIpFrom`).

| Column | Type | Nullable | Default | Source |
|--------|------|----------|---------|--------|
| `id` | BIGINT | NOT NULL | identity | DB |
| `ip_hash` | TEXT | NOT NULL | — | edge function (salted SHA-256) |
| `run_card_id` | TEXT | NOT NULL | — | edge function |
| `submitted_at` | TIMESTAMPTZ | NOT NULL | `now()` | DB |

Indexes: `idx_anon_intake_ip_time ON (ip_hash, submitted_at DESC)`,
`idx_anon_intake_time ON (submitted_at DESC)`.

RLS: enabled, **no anon/authenticated policies** (deny-all; the 017 pattern) —
service-role only. Anonymous run_cards rows insert with
`submitter='anonymous'`, `owner_uid=NULL`, `trust='unverified'`; every
integrity trigger (022 quarantine, 023 score ranges, 026 sha parity, 033
content guard, 036 queue refresh, 051 run-card content guard) fires
unchanged. Moderation: anonymous rows are purgeable via the service-role
lane, captured by `run_cards_audit` (017).

---

## Table: `regen_state`

Single-row debounce state for the `regenerate-queue` edge function (migration
`055`, audit M2). The function claims a run with an **atomic conditional
UPDATE** (`… WHERE id = 1 AND last_started_at < now() - min_interval`), so a
burst of `run_cards` trigger firings coalesces into one refresh and
concurrent invocations cannot double-run.

| Column | Type | Nullable | Default | Source |
|--------|------|----------|---------|--------|
| `id` | SMALLINT | NOT NULL | `1` | PK; `CHECK (id = 1)` — the table is one row by construction |
| `last_started_at` | TIMESTAMPTZ | NOT NULL | epoch | edge function (the debounce claim) |
| `last_source` | TEXT | YES | — | edge function (`run_cards_trigger` / `cron_heartbeat` / `manual`) |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | edge function |

RLS: enabled, service-role only (the 050 deny-all posture). The function's
in-handler authorization is a shared secret: `x-regen-secret` header ==
`REGEN_SHARED_SECRET` function secret == Vault `regenerate_queue_secret`
(unconfigured → 503, wrong → 401; the anon key satisfying verify_jwt is NOT
enough — that was the M2 hole).

---

## Table: `contests`

Contest infrastructure for competitive evaluation.

| Column | Type | Nullable | Default | Source |
|--------|------|----------|---------|--------|
| `id` | TEXT | NOT NULL | — | PK (slug) |
| `name` | TEXT | NOT NULL | — | `contest.py` |
| `description` | TEXT | YES | `''` | `contest.py` |
| `corpus_id` | TEXT | NOT NULL | — | `contest.py` |
| `language_pair` | TEXT | NOT NULL | — | `contest.py` |
| `visibility` | TEXT | NOT NULL | `'public'` | CHECK `('public', 'private', 'team')` |
| `teams` | TEXT[] | YES | `'{}'` | `contest.py` |
| `created_by` | TEXT | NOT NULL | — | `contest.py` — the **JWT email**, and since migration 052 the INSERT policy *verifies* it against the claim (before 052 any string was accepted; this doc's old "(from auth)" label overstated it) |
| `status` | TEXT | NOT NULL | `'open'` | CHECK `('open', 'closed', 'archived')`; born `'open'` (052 admission trigger) |
| `use_context` | TEXT | NOT NULL | `'non-commercial'` | **Migration 035** — CHECK `('commercial', 'non-commercial')`. Combined with a dataset's license (`is_usage_allowed` — JS: `cli/lib/license-gate.mjs`; Python: `mt_eval_harness/license_use.py`) to compute dataset eligibility: a commercial contest may NOT rank NonCommercial datasets; a non-commercial contest may. **Quarantine always wins** (migration 022) regardless of lane |
| `lane` | TEXT | NOT NULL | `'standard'` | **Migration 041** — CHECK `('standard', 'sealed')`. A sealed contest is eligible ONLY over a registered **active** `sealed_sets` row (037) and conveys ZERO corpus access: every run still passes the 038 pending-request → M-of-N → 039 grant path, audited by 040. A standard contest refuses sealed sets and quarantined datasets. Enforced by the `contests_corpus_guard` trigger (client-side mirror: `mt_eval_harness/contest.py create_contest`) |
| `metadata` | JSONB | YES | `'{}'` | *unused* |
| `created_at` | TIMESTAMPTZ | YES | `now()` | DB; **server-stamped** on INSERT by the 052 admission trigger (throttle-window integrity) |

### Triggers

| Trigger | Timing | Effect |
|---------|--------|--------|
| `contests_corpus_guard` | BEFORE INSERT/UPDATE | Contest eligibility at the data layer (migration 041): `lane='sealed'` requires a registered **active** `sealed_sets` row (fail-closed — no registration or a planned/retired set rejects); `lane='standard'` rejects sealed sets, quarantined datasets (022 doctrine, unchanged), and the migration-022 known-improper slice-id regex (byte-identical backstop). Re-checks only when `corpus_id`/`lane` change, so lifecycle updates (close/archive) are never blocked. `service_role` does not bypass triggers |
| `contests_admission_guard` | BEFORE INSERT | Born `'open'` with a non-empty `created_by`; server-stamps `created_at`; rolling-24h per-creator birth throttle (constant 24 — the 046 rationale). Migration 052 |
| `contests_use_context_guard` | BEFORE INSERT/UPDATE | The use-context eligibility rule at the data layer (migration 053): a `use_context='commercial'` standard-lane contest requires a registered dataset with a commercial-safe license (`is_license_commercial_safe`); unregistered → fail-safe refusal. Sealed + non-commercial lanes pass through. Re-checks only when `corpus_id`/`use_context`/`lane` change |

### RLS Policies (031 → 052)

| Policy | Operation | Rule |
|--------|-----------|------|
| Read public and private contests | SELECT | `USING (visibility IN ('public','private') OR (SELECT auth.uid()) IS NOT NULL)` |
| `contests_create_own` | INSERT (authenticated) | `WITH CHECK (created_by = jwt claims ->> 'email')` — identity-bound the 043/045/046 way (migration 052; replaced the unbound "Authenticated create contests") |
| Owner update contests | UPDATE | `USING (created_by = jwt claims ->> 'email')` |

Indexes: `idx_contests_status`, `idx_contests_language_pair`,
`idx_contests_creator (created_by, created_at)` (052, throttle lookup).

---

## Table: `contest_submissions`

Links run cards to contests.

| Column | Type | Nullable | Default | Source |
|--------|------|----------|---------|--------|
| `id` | BIGINT | NOT NULL | identity | DB |
| `contest_id` | TEXT | NOT NULL | — | FK to `contests.id` ON DELETE CASCADE |
| `run_card_id` | TEXT | NOT NULL | — | FK to `run_cards.id` ON DELETE CASCADE |
| `submitted_by` | TEXT | NOT NULL | — | `contest.py` — the **JWT email**, verified by the 052 INSERT policy (before 052 any string was accepted) |
| `team` | TEXT | YES | — | `contest.py` |
| `notes` | TEXT | YES | `''` | `contest.py` |
| `submitted_at` | TIMESTAMPTZ | YES | `now()` | DB; **server-stamped** on INSERT by the 052 admission trigger |

Constraints: `UNIQUE (contest_id, run_card_id)`.
Indexes: `idx_cs_contest`, `idx_cs_run_card`,
`idx_cs_submitter (contest_id, submitted_by, submitted_at)` (052).

Triggers: `contest_submissions_admission_guard` (052, BEFORE INSERT) —
non-empty `submitted_by`, server-stamped `submitted_at`, rolling-24h
per-(submitter, contest) throttle (constant 24).

RLS: "Read own or public submissions" (public contest, own submission, or
contest creator); `contest_submissions_submit_own` (052, replaced the unbound
"Authenticated submit") — INSERT for authenticated only when `submitted_by` =
the JWT email AND the target contest is `open` and visible-for-submission
(public/private: any authenticated submitter — the 008 privacy model hides
private *scores*, not the door; team: creator-only, fail-closed, until team
membership exists as a JWT claim).

---

## Table: `trading_card_index`

Compact per-language rows (~8,000) for the language card grid, loaded in bulk on
page init (migration 012, extended by 032 and 056). One row per ISO 639-3 code.

Key columns (see migration 012 for the full commented DDL):

| Group | Columns |
|-------|---------|
| Identity | `code` (PK, ISO 639-3), `name`, `native_name`, `glottocode` |
| Resolution (032) | `aliases` JSONB (alternate codes — ISO 639-1/legacy/regional; used by the pure-dynamic harness/CLI loaders), `iso639_1` TEXT (NULL ⇒ fail-honest, no 639-1 provider call) |
| Taxonomy (056) | `iso_type` (ISO 639-3 L/E/A/H/C/S — the homepage living/at-risk stats read `'L'` off the round-tripped index), `modality` (spoken \| signed), `iso_scope` (I/M/S — 'M' = macrolanguage hub card), `macrolanguage` (containing hub code). SSOT: language cards |
| Classification | `family`, `genus`, `macroarea`, `is_isolate` |
| Speakers | `speakers` (display string), `speaker_count` BIGINT |
| Script | `script`, `script_name`, `scripts` JSONB, `dir` |
| Card mechanics | `vitality_badge`, `rarity`, `rarity_order`, `challenge_rating`, `digital_toolkit`, `abilities`, `stats` (JSONB) |
| Pipeline | `pipeline_label`, `pipeline_emoji` |
| Content flags | `fact_count`, `source_count`, `has_vocabulary/typology/phonology/nearest/natural_pair/cultural/conflicts`, `dialect_count` |
| Geography | `regions`, `ancestry` (JSONB) |
| Flavour | `cultural_aphorism` |
| Housekeeping | `updated_at` |

Indexes: `idx_tci_family`, `idx_tci_vitality` (GIN), `idx_tci_rarity_order`,
`idx_tci_speaker_count`, `idx_tci_macroarea`, `idx_tci_fact_count`.

RLS: anon SELECT `USING (true)`; writes service_role-only (data pipeline).

RPC: `get_trading_card_index()` — grid-display columns only (omits heavyweight
blobs); STABLE, SECURITY INVOKER, `search_path` pinned. Recreated by 056 to
also return the four taxonomy columns (the Atlas grid's runtime chips).

---

## Table: `trading_card_detail`

Full JSONB detail per language, loaded on-demand per card modal (migration 012,
extended by 014).

| Column | Type | Notes |
|--------|------|-------|
| `code` | TEXT PK | FK → `trading_card_index(code)` ON DELETE CASCADE |
| `detail` | JSONB NOT NULL | Full structured detail blob |
| `licenses` | JSONB | **Migration 014** — pre-joined license metadata per contributing source (built from `source_licenses` at pipeline build time) |
| `fact_count` / `source_count` | INTEGER | Display counts |
| `updated_at` | TIMESTAMPTZ | Default `NOW()` |

RLS: anon SELECT `USING (true)`; writes service_role-only.

---

## Table: `source_licenses`

Registry of dataset licenses and attribution requirements for every ingested
data source (migration 013). One row per source (e.g. `glottolog-5.0`).

| Column | Type | Notes |
|--------|------|-------|
| `source` | TEXT PK | Matches `facts.source` / provenance key |
| `license_spdx`, `license_url`, `attribution` | TEXT | License terms + required credit |
| `allows_redistribution` | BOOLEAN DEFAULT TRUE | |
| `requires_attribution` | BOOLEAN DEFAULT TRUE | |
| `requires_sharealike` | BOOLEAN DEFAULT FALSE | |
| `non_commercial_only` | BOOLEAN DEFAULT FALSE | |
| `dataset_url`, `dataset_version`, `notes` | TEXT | Provenance |
| `registered_at` | TIMESTAMPTZ | Default `NOW()` |

RLS: anon SELECT `USING (true)`; writes service_role-only.

RPCs: `get_source_licenses()` (all records, ordered) and
`get_attribution_for_language(lang_code)` (joins a card's provenance sources to
their license records, ordered by fact count). Both STABLE, SECURITY INVOKER.

---

## Table: `language_experts`

Fact-based index of the researchers/institutions/projects behind each language
card's cited resources (migration 018). Derived by
`cli/scripts/derive-experts.mjs`; **every row carries card-field provenance**
(`source` column, NOT NULL) — nothing is invented.

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT PK | identity |
| `language_code` | TEXT NOT NULL | Soft ref to `trading_card_index.code` (deliberately no hard FK) |
| `name` | TEXT NOT NULL | Person / institution / project |
| `type` | TEXT NOT NULL | CHECK `('researcher', 'institution', 'community_org', 'project')` |
| `affiliation` | TEXT | If stated in repo data |
| `role` | TEXT NOT NULL | e.g. 'FST maintainer' |
| `url`, `orcid` | TEXT | Public links |
| `source` | TEXT NOT NULL | Card field/resource the entry was derived from |
| `updated_at` | TIMESTAMPTZ | Default `NOW()` |

Constraints: `UNIQUE (language_code, name, role)`.
Indexes: `idx_language_experts_code`, `_name`, `_type`.
RLS: anon SELECT `USING (true)`; writes service_role-only.
RPCs: `get_experts_for_language(lang_code)`, `get_languages_for_expert(expert_name)`.

---

## Table: `translation_services`

v0 "discovery" registry of **opt-in** human translation providers, keyed by
language pair — the human-method floor for pairs with no reliable MT
(migration 034). Dispatch/tickets/payments are NOT built.

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT PK | identity |
| `service_id` | TEXT UNIQUE NOT NULL | Stable public id, curator-assigned |
| `display_name` | TEXT NOT NULL | Provider's **consented** public name |
| `provider_type` | TEXT | CHECK `('community_org', 'agency', 'individual')` |
| `source_lang` / `target_lang` | TEXT NOT NULL | ISO 639-3 |
| `variety` | TEXT | Script/dialect qualifier (e.g. 'SRO') |
| `dispatch_channel` | TEXT | CHECK `('email', 'webhook', 'api')` |
| `contact` | TEXT NOT NULL | **PII** — never returned by the public RPC, never in the in-git SSOT |
| `turnaround_days` | INT · `rate_per_word` NUMERIC · `domains` TEXT[] | Terms |
| `sovereignty_flags` | JSONB · `nc_terms` TEXT | Community-set data-handling / usage terms |
| `consent_attested` | BOOLEAN NOT NULL DEFAULT false | **Consent gate** — public read requires true |
| `status` | TEXT NOT NULL DEFAULT 'pending' | CHECK `('pending', 'approved', 'suspended')` |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

Constraints: `UNIQUE (service_id, source_lang, target_lang, variety)`.
Indexes: `idx_translation_services_pair`, `_status`.

RLS: anon SELECT **only** `status = 'approved' AND consent_attested = true`;
**no** anon/authenticated write policy (curator-owned, migration-024 precedent).

RPC: `get_services_for_pair(src, tgt)` — non-PII columns only; SECURITY INVOKER;
re-asserts the consent+approval gate in its WHERE clause (defense in depth);
community providers ordered first.

---

## Table: `sealed_sets`

**Content-free** registry of sealed (encrypted-at-rest) sovereign held-out
corpora — Wave 1 of the zero-knowledge sovereign-eval backbone (migration 037).

> [!IMPORTANT]
> This table has NO source / reference / expected / plaintext / ciphertext
> column and never will. It stores a **digest of the ciphertext**, not the
> ciphertext and not one sentence of the corpus. The ciphertext lives in a
> dedicated encrypted object store — off-git, off this DB.
> `arena/tests/test_sovereign_authorization_migrations.py` asserts no content
> column exists.

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT PK | identity |
| `sealed_set_id` | TEXT UNIQUE NOT NULL | Stable public id, e.g. `sealed-eng-crk-v1` |
| `ciphertext_digest` | TEXT NOT NULL | SHA-256 of the encrypted blob — the hash is public, the data is not |
| `cipher` / `key_scheme` | TEXT | Scheme labels (e.g. 'age-x25519', 'FROST-3-of-5') |
| `custodian_group_id` | TEXT NOT NULL | **Opaque** multisig custodian-group id — never a public nation/org name before consent |
| `current_qualifier_id` | TEXT | Public-qualifier round a method must clear first — backed by the `qualifiers` table since migration 042 (see the 042–048 section) |
| `source_lang` / `target_lang` / `language_pair` / `variety` | TEXT | ISO 639-3 codes (not content) |
| `quarantined` | BOOLEAN NOT NULL DEFAULT **true** | Sealed sets never rank AS A DATASET (migration 022) even while their scores publish |
| `quarantine_reason` | TEXT | Defaulted explanation |
| `status` | TEXT NOT NULL DEFAULT 'active' | CHECK `('active', 'planned', 'retired')` |
| `sealed_at` / `created_at` | TIMESTAMPTZ | |

Indexes: `idx_sealed_sets_pair`, `idx_sealed_sets_custodian`.
RLS: anon+authenticated SELECT `USING (true)` (existence/digest/pair are public
by design); **no** public write policy (curator-owned).

---

## Table: `authorization_requests`

The pending-authorization queue for sealed-set evaluation (migration 038): any
access to a sealed set enters `pending` and waits for an M-of-N custodian
decision. The real threshold signing is Wave 2; the data layer already
guarantees an immutable fingerprint and a one-way state machine.

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT PK | identity |
| `request_id` | TEXT UNIQUE NOT NULL | e.g. `authreq-<uuid>` |
| `sealed_set_id` | TEXT NOT NULL | FK → `sealed_sets(sealed_set_id)` |
| `state` | TEXT NOT NULL DEFAULT 'pending' | CHECK `('pending', 'authorized', 'denied', 'expired')` |
| `fingerprint` | TEXT NOT NULL | SHA-256 of `(method_sha \n corpus_id \n corpus_version \n 'scores-only' \n node_measurement)` — computed by `queue_runner.compute_request_fingerprint`, recomputable from the component columns |
| `method_sha` / `corpus_id` / `corpus_version` / `node_measurement` | TEXT NOT NULL | The fingerprint inputs, stored individually for inspection |
| `emit` | TEXT NOT NULL DEFAULT 'scores-only' | CHECK `(emit = 'scores-only')` — only scores ever leave a sealed run |
| `threshold` | TEXT DEFAULT '3 of 5' | Documentary M-of-N parameters |
| `requested_by` | TEXT | Proposer (proposing ≠ authorizing) |
| `created_at` / `decided_at` | TIMESTAMPTZ | |

Trigger: `authorization_requests_transition_guard` (BEFORE UPDATE) — freezes
fingerprint/method/corpus/version/node/sealed_set/emit after creation; allows
only `pending → {authorized, denied, expired}` and `authorized → expired`.

Indexes: `idx_auth_requests_set_state`, `idx_auth_requests_fingerprint`.
RLS: anon+authenticated SELECT `USING (true)` (community-inspectable,
content-free); **no** public write policy.

---

## Table: `auth_grants`

Single-use, time-boxed, fingerprint-bound grants minted only for an
**authorized** request (migration 039).

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT PK | identity |
| `grant_id` | TEXT UNIQUE NOT NULL | The single-use credential id |
| `request_id` | TEXT NOT NULL | FK → `authorization_requests(request_id)` |
| `sealed_set_id` | TEXT NOT NULL | FK → `sealed_sets(sealed_set_id)` |
| `fingerprint` | TEXT NOT NULL | Must equal the request's (trigger-enforced) |
| `expires_at` | TIMESTAMPTZ NOT NULL | CHECK `expires_at > created_at`; trigger also blocks born-expired |
| `used` | BOOLEAN NOT NULL DEFAULT false | Flipped atomically by `claim_auth_grant()`; one-way |
| `used_at` / `used_by` | TIMESTAMPTZ / TEXT | CHECK `used = (used_at IS NOT NULL)` |
| `created_at` | TIMESTAMPTZ NOT NULL | |

Trigger: `auth_grants_bind_guard` (BEFORE INSERT/UPDATE) — INSERT requires an
existing, `authorized` request with matching fingerprint + sealed set, future
expiry, born-unused; UPDATE freezes all terms and forbids `used` true→false.

Functions (SECURITY DEFINER, **EXECUTE granted to service_role only**):
- `claim_auth_grant(p_grant_id, p_fingerprint, p_node)` — atomic single-use
  consume: one UPDATE that asserts unused + unexpired + fingerprint-match;
  a second claim / expired / mismatch returns no row.
- `auth_grant_is_valid(p_grant_id, p_fingerprint)` — read-only validity probe.

Indexes: `idx_auth_grants_request`, `idx_auth_grants_open` (partial, `used = false`).
RLS: enabled with **no** anon/authenticated policies at all — a grant is a
capability, not inspectable history; the public sees grants only through the
040 audit log events.

---

## Table: `authorization_audit_log`

Append-only, hash-chained, community-inspectable record of every sealed-set
authorization decision and use — and every blocked single-party attempt
(migration 040).

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT PK | identity — the chain order |
| `event_type` | TEXT NOT NULL | CHECK: `request_created`, `vote_cast`, `request_authorized`, `request_denied`, `request_expired`, `grant_minted`, `grant_used`, `grant_expired`, `single_party_attempt_blocked` |
| `sealed_set_id` / `request_id` / `grant_id` / `actor` / `fingerprint` | TEXT | All nullable; `actor` is an opaque custodian id / 'platform' / node id — never a public name |
| `detail` | JSONB | Structured, **content-free** event metadata |
| `prev_hash` | TEXT NOT NULL | row_hash of the preceding row (genesis = 64 zeros) |
| `row_hash` | TEXT NOT NULL | `sha256(prev_hash \| event_type \| sealed_set_id \| request_id \| grant_id \| actor \| fingerprint \| detail::text \| created_at[UTC µs])` — core PostgreSQL `sha256()`, no extension |
| `created_at` | TIMESTAMPTZ NOT NULL | |

Triggers:
- `authorization_audit_log_chain` (BEFORE INSERT) — computes `prev_hash`/`row_hash`
  (client-supplied values are overwritten); a transaction-level advisory lock
  serializes appends so the chain is strictly linear.
- `authorization_audit_log_immutable` (BEFORE UPDATE OR DELETE) — RAISES on any
  mutation; the log is strictly append-only beneath every client and key.

Function: `authorization_audit_head()` — returns the current chain head
(publishable/anchorable so silent edits are detectable). EXECUTE granted to
anon, authenticated, service_role.

Indexes: `idx_auth_audit_set`, `idx_auth_audit_request`.
RLS: anon+authenticated SELECT `USING (true)`; no public write policy.

---

## Tables added by migrations 058–067

### Table: `queue_items`

The DB-as-queue storage layer (migration `059`, `source_length` widened by
`060`). One row per **ranked candidate benchmark** — a `(corpus, model,
condition)` combo the ranker thinks is worth running — materialized by
`arena/scripts/generate_sweep_queue.py`, which remains the ranking **authority**
(the DB stores the ranking; it does not compute it).

The table exists because the queue used to be a 7–58 MB static `queue.json`
blob: too big to `JSON.parse` in the 256 MB edge isolate (a hand-rolled
streaming scanner worked around it), and frozen between manual Python regens —
the edge function folded new results into the mesh but never re-ranked, so
items already covered kept showing and map-value connectivity classes went
stale. What 059 makes live is the **coverage filter**, served by `queue_top()`.

Each row is a strict SUPERSET of the served `queue.json` item: every served
scalar field is a first-class column (byte-identical to `slim_published_item`),
and the re-derivability fields go to `diagnostics`.

#### Columns

| Column | Type | Nullable | Default | Source | Notes |
|--------|------|----------|---------|--------|-------|
| `id` | TEXT | NOT NULL | — | ranker | **PRIMARY KEY**. Served item id, `corpus_id__model__condition` (model slug `/`→`_`). **Does not include `rank_mode`** — see the defect note below |
| `rank_mode` | TEXT | NOT NULL | — | ranker | Which ordering set this row's priority. **CHECK** `(rank_mode IN ('map','ecv'))` |
| `priority` | INTEGER | NOT NULL | — | ranker | 1-based rank **within `rank_mode`** |
| `language_pair` | TEXT | NOT NULL | — | ranker | e.g. `"en>crk"`; `queue_pairs()` splits it on `'>'` |
| `source_language` | TEXT | YES | — | ranker | |
| `target_language` | TEXT | YES | — | ranker | |
| `corpus_id` | TEXT | NOT NULL | — | ranker | = `datasets.id` / `run_cards.dataset_id` (join key, verified against the live board 2026-07-20) |
| `corpus_license` | TEXT | YES | — | ranker | |
| `entry_count` | INTEGER | YES | — | ranker | |
| `contamination` | TEXT | YES | — | ranker | |
| `domain` | TEXT | YES | — | ranker | |
| `source_length` | NUMERIC | YES | — | ranker | Registry richness `mean_source_chars` — a **fractional mean**, not a count. Typed `int` by 059, widened by **060** |
| `model` | TEXT | NOT NULL | — | ranker | = `run_cards.model_slug` |
| `condition` | TEXT | NOT NULL | — | ranker | = `run_cards.condition`. **CHECK** `(condition IN ('naive','coached'))` |
| `est_cost_usd` | NUMERIC | YES | — | ranker | `queue_pairs()` reports the per-pair `min()` |
| `est_basis` | TEXT | YES | — | ranker | How the estimate was derived |
| `run_command` | TEXT | YES | — | ranker | Copy-pasteable `mt-eval run …` |
| `map_value` | NUMERIC | YES | — | ranker | The ordering currency in map mode; NULL in ecv |
| `diagnostics` | JSONB | NOT NULL | `'{}'::jsonb` | ranker | Every non-column field — full ecv/map re-derivability inputs plus served extras (e.g. a restricted corpus's `transmission` block), so nothing is lost against `queue.json` |
| `generation_id` | TEXT | NOT NULL | — | ranker | Stamps one full ranker run; the swap key |
| `generated_at` | TIMESTAMPTZ | NOT NULL | `now()` | DB | |

#### Constraints

```sql
PRIMARY KEY (id)                                            -- queue_items_pkey
CHECK (condition IN ('naive','coached'))                    -- queue_items_condition_check
CHECK (rank_mode IN ('map','ecv'))                          -- queue_items_rank_mode_check
```

No foreign keys. `corpus_id` is a soft ref to `datasets.id` and `model` /
`condition` are soft refs to `run_cards` columns — deliberately, so a ranked
candidate can name a corpus/model combination that has no board row yet (which
is the entire point of a queue).

#### RLS Policies

| Policy | Operation | Rule | Rationale |
|--------|-----------|------|-----------|
| `queue_items_public_read` | SELECT (PUBLIC) | `USING (true)` | The queue is public — anyone may see what work is open |
| *(no write policies)* | — | — | Only the ranker writes, as service_role, which bypasses RLS. 054's `ensure_rls` event trigger auto-enables RLS on every new public table, so without the explicit SELECT policy above the table would have been deny-all |

#### Indexes

```sql
queue_items_pkey                ON (id)                              -- UNIQUE
idx_queue_items_mode_priority   ON (rank_mode, priority)             -- queue_top's ordering
idx_queue_items_coverage        ON (corpus_id, model, condition)     -- the NOT EXISTS join
```

#### Write protocol (the atomic swap)

`upsert_queue_items()` POSTs the ranked rows with
`Prefer: resolution=merge-duplicates,return=minimal` (same ids overwrite in place, so there is
never an empty window), then issues a single
`DELETE /queue_items?generation_id=neq.<gen>` to sweep items that vanished from
the ranking. Service-role only.

#### RPC: `queue_top(p_rank_mode text = 'map', p_limit int = 25, p_offset int = 0)`

`RETURNS SETOF public.queue_items`, `LANGUAGE sql`, **STABLE**, **SECURITY
INVOKER**, `SET search_path = public`. Relies on the public-read policies on
`queue_items` and `run_cards`, so anon/authenticated callers see exactly what
they may see.

```sql
where qi.rank_mode = p_rank_mode
  and not exists (
    select 1 from public.run_cards rc
    where rc.dataset_id = qi.corpus_id
      and rc.model_slug = qi.model
      and rc.condition  = qi.condition
      and rc.trust      = 'verified'
  )
order by qi.priority
limit  greatest(0, least(coalesce(p_limit, 25), 500))   -- hard page-size cap
offset greatest(0, coalesce(p_offset, 0));
```

Only a **refereed** result marks a combo done: `trust='verified'`, never
`'unverified'`. Page size is hard-capped at 500 and floored at 0, so a hostile
or fat-fingered `p_limit` cannot be used to pull the whole table in one call.
`EXECUTE` granted to `anon, authenticated`. Consumers:
`mcp-server/src/tools/queue.js` (`CHAMPOLLION_QUEUE_SOURCE=db` by default, blob fallback),
`cli/website/src/utils/liveQueue.js`.

---

### Table: `contributors`

The L1 reputation ledger of the reputation-weighted auditing model (migration
`061`, B3). One row per **stable contributor identity**.

The model exists because the board must be *valid by construction* while
keeping distributed contribution worthwhile: contributors do the expensive work,
so the project must not re-run everything, and provenance ("this run came
through the harness") is not server-verifiable for self-hosted compute — the
open harness's key is in the user's hands, and the sovereign layer already says
a signature authenticates a machine, not honesty. Validity is therefore
**earned and self-correcting**, not attested. The four layers:

- **L0** — re-score submitted outputs against the sha-pinned reference
  (`verifier.py`). 100 % of runs, ~free.
- **L1** — this table.
- **L2** — re-run a SAMPLE to confirm the outputs are real; sampling
  = *f*(reputation ↓, stakes ↑, anomaly ↑). Outcomes land in
  `contributor_audit_log`.
- **L3** — corroboration: two INDEPENDENT contributors agreeing is free
  verification.

Pure policy core: `arena/mt_eval_harness/reputation.py` (constants
`ESTABLISHED_AT = 30`, `FULL_TRUST = 100`, `BASE_RATE = 0.25`,
`MIN_RATE = 0.05` — a fully trusted identity is still spot-audited, never at
rate 0). The service-role DB driver lives in `verifier.py`.

**Identity.** `contributor_id` is TEXT so a future pseudonymous-key scheme
slots into the same table and the same math with no migration; the canonical
Wave-1 form is `'uid:<run_cards.owner_uid>'` (OAuth), with `'key:<fp>'`
reserved. Anonymous submissions (migration 050: `owner_uid IS NULL`) carry **no
persistent reputation** — they are the provisional floor: always sampled, never
promoted on an L0 pass alone.

#### Columns

| Column | Type | Nullable | Default | Source | Notes |
|--------|------|----------|---------|--------|-------|
| `contributor_id` | TEXT | NOT NULL | — | verifier | **PRIMARY KEY**. `'uid:<owner_uid>'` today; `'key:<fp>'` reserved |
| `reputation` | INTEGER | NOT NULL | `0` | verifier | Earned ONLY by a clean L2 audit or L3 corroboration — never by an L0 pass (Sybil resistance). **CHECK** `(reputation >= 0)` |
| `status` | TEXT | NOT NULL | `'provisional'` | verifier | **CHECK** `(status IN ('provisional','established','burned'))` |
| `clean_audits` | INTEGER | NOT NULL | `0` | verifier | L2 audits passed |
| `total_audits` | INTEGER | NOT NULL | `0` | verifier | L2 audits attempted |
| `corroborations` | INTEGER | NOT NULL | `0` | verifier | L3 independent agreements |
| `caught_fraud_count` | INTEGER | NOT NULL | `0` | verifier | Times burned — a permanent scar |
| `verified_runs` | INTEGER | NOT NULL | `0` | verifier | Runs that reached `trust='verified'`. **Track record, not trust** — it does not feed reputation |
| `first_seen_at` | TIMESTAMPTZ | NOT NULL | `now()` | DB | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | verifier | **Application-maintained** — there is no `set_*_updated_at` trigger on this table (unlike `datasets`) |

#### Constraints

```sql
PRIMARY KEY (contributor_id)                                        -- contributors_pkey
CHECK (reputation >= 0)                                             -- contributors_reputation_check
CHECK (status IN ('provisional','established','burned'))            -- contributors_status_check
```

#### RLS Policies

| Policy | Operation | Rule | Rationale |
|--------|-----------|------|-----------|
| `contributors_public_read` | SELECT (PUBLIC) | `USING (true)` | The reputation record is the moat — transparency is the point |
| *(no write policies)* | — | — | Only the service-role verifier writes; service_role bypasses RLS |

#### Indexes

```sql
contributors_pkey  ON (contributor_id)   -- UNIQUE; the only index on this table
```

#### RPC: `contributor_reputation(p_contributor_id text)`

`RETURNS public.contributors`, `LANGUAGE sql`, **STABLE**, **SECURITY INVOKER**,
`SET search_path = public` — the public reputation badge. Same posture as
`queue_top`: it reads through the public-read policy, so callers see exactly
what the policy allows. EXECUTE is **revoked from PUBLIC** then granted to
`anon, authenticated` (the replay-clean pattern 058 established) — verified on
prod: the ACL carries no PUBLIC entry.

---

### Table: `contributor_audit_log`

The append-only public audit + retraction trail of the reputation model
(migration `061`). L0 re-score outcomes, L2 sampled re-runs, L3 corroborations,
and `burn` / history-`reaudit` events. A `burn` row (and the `reaudit` rows it
spawns) is **as public as a journal retraction** — that is what makes light
sampling of trusted contributors safe: cheating is expensive *in expectation*.

> [!IMPORTANT]
> This table has **no foreign keys, deliberately**. The trail must OUTLIVE a
> board wipe (`DELETE FROM run_cards`) and must be writable before a
> `contributors` row exists on a first audit — exactly the durability
> `run_cards_audit` (017) has.

#### Columns

| Column | Type | Nullable | Default | Source | Notes |
|--------|------|----------|---------|--------|-------|
| `id` | BIGINT | NOT NULL | identity | DB | `GENERATED ALWAYS AS IDENTITY`, PRIMARY KEY — the append order |
| `contributor_id` | TEXT | YES | — | verifier | **NULL for anonymous** submissions (`owner_uid IS NULL`); no FK |
| `run_card_id` | TEXT | NOT NULL | — | verifier | The run this outcome is about; no FK (survives a board wipe) |
| `layer` | TEXT | NOT NULL | — | verifier | **CHECK** `(layer IN ('L0','L2','L3'))` |
| `outcome` | TEXT | NOT NULL | — | verifier | **CHECK** `(outcome IN ('pass','fail','corroborated','disagreement','burn','reaudit'))` |
| `reputation_delta` | INTEGER | NOT NULL | `0` | verifier | Signed; may be negative (the CHECK is on `contributors.reputation`, not here) |
| `reputation_after` | INTEGER | YES | — | verifier | Post-event ledger value, for a readable trail |
| `detail` | JSONB | NOT NULL | `'{}'::jsonb` | verifier | Structured event metadata |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | DB | |

#### Constraints

```sql
PRIMARY KEY (id)                                                              -- contributor_audit_log_pkey
CHECK (layer IN ('L0','L2','L3'))                                             -- contributor_audit_log_layer_check
CHECK (outcome IN ('pass','fail','corroborated','disagreement','burn','reaudit'))
                                                                              -- contributor_audit_log_outcome_check
```

#### RLS Policies

| Policy | Operation | Rule | Rationale |
|--------|-----------|------|-----------|
| `contributor_audit_log_public_read` | SELECT (PUBLIC) | `USING (true)` | A retraction nobody can read is not a retraction |
| *(no write policies)* | — | — | Service-role verifier only |

#### Indexes

```sql
contributor_audit_log_pkey          ON (id)                            -- UNIQUE
idx_contributor_audit_contributor   ON (contributor_id, created_at DESC)
idx_contributor_audit_run           ON (run_card_id)
idx_contributor_audit_outcome       ON (outcome, created_at DESC)
```

> [!NOTE]
> "Append-only" here is a **convention plus the absence of a write policy**, not
> an enforced invariant. Unlike `authorization_audit_log` (040), which has an
> `authorization_audit_log_immutable` trigger that RAISEs on every UPDATE and
> DELETE beneath every client including service_role, `contributor_audit_log`
> has **no triggers at all** — a service-role UPDATE or DELETE succeeds
> silently, and there is no hash chain to make an edit detectable. If the trail
> is meant to carry the same weight as the 040 log ("as public as a journal
> retraction"), it wants the 040 immutability trigger.

---

### Table: `tickets`

Visitor contact / objection / **takedown** intake (migration `065`, founder
direction 2026-07-20: *"we welcome good objections and people should be able to
provide tickets through this chatbot like takedown requests, and I should get
those at info@champollion.dev"*).

The `submit-ticket` edge function (`verify_jwt=false`) accepts one message from
an unauthenticated visitor — the site docent's ticket form, or any client —
validates it strictly (`functions/submit-ticket/lib.ts`), rate-limits per IP,
inserts with the **service role**, and emails info@champollion.dev. The DB row
is the durable **record of record**; the email is a notification, and an email
failure must not lose the ticket (`emailed=false` is the flag for the digest
recipe).

A dedicated table rather than `run_cards` or a generic log because tickets carry
free-text visitor content and an optional reply-to address — PII-adjacent,
never rankable, never public. Same deny-all RLS treatment as `anon_intake_log`
(050) and `run_cards_audit` (017).

**Privacy.** The client IP is NEVER stored — only a salted SHA-256 (`ip_hash`),
used solely for the rate-limit window. `contact_email` is OPTIONAL: a visitor
may file anonymously, in which case there is simply no way to reply, and that is
their choice. Nothing here is ever surfaced publicly or joined to the
leaderboard.

#### Columns

| Column | Type | Nullable | Default | Source | Notes |
|--------|------|----------|---------|--------|-------|
| `id` | BIGINT | NOT NULL | identity | DB | `GENERATED ALWAYS AS IDENTITY`, PRIMARY KEY |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | DB | Rate-limit window key |
| `kind` | TEXT | NOT NULL | `'question'` | edge fn | Sender's classification; drives triage + email urgency. **CHECK** `(kind IN ('takedown','objection','correction','question','other'))` |
| `locale` | TEXT | YES | — | edge fn | Site locale filed from (e.g. `'fil'`). **CHECK** `(locale IS NULL OR char_length(locale) <= 12)` |
| `page_url` | TEXT | YES | — | edge fn | Page the sender was on, if supplied. **CHECK** `(page_url IS NULL OR char_length(page_url) <= 2048)` |
| `message` | TEXT | NOT NULL | — | edge fn | The one required piece of content. **CHECK** `(char_length(message) BETWEEN 1 AND 8000)` |
| `contact_email` | TEXT | YES | — | edge fn | OPTIONAL reply-to; NULL = filed anonymously. **CHECK** `(contact_email IS NULL OR char_length(contact_email) <= 320)` (RFC 5321 max) |
| `ip_hash` | TEXT | NOT NULL | — | edge fn | Salted SHA-256 of the client IP; **the raw IP is never stored** |
| `source` | TEXT | NOT NULL | `'docent-form'` | edge fn | How it arrived; display/triage only. **CHECK** `(char_length(source) <= 40)` |
| `status` | TEXT | NOT NULL | `'new'` | staff | **CHECK** `(status IN ('new','ack','closed'))` |
| `emailed` | BOOLEAN | NOT NULL | `FALSE` | edge fn | `false` = row saved but the notification failed — the founder still has the ticket |
| `notes` | TEXT | YES | — | staff | Staff-only triage notes |

#### Constraints

```sql
PRIMARY KEY (id)                                                     -- tickets_pkey
CHECK (kind IN ('takedown','objection','correction','question','other'))  -- tickets_kind_check
CHECK (status IN ('new','ack','closed'))                             -- tickets_status_check
CHECK (char_length(message) >= 1 AND char_length(message) <= 8000)   -- tickets_message_check
CHECK (contact_email IS NULL OR char_length(contact_email) <= 320)   -- tickets_contact_email_check
CHECK (page_url IS NULL OR char_length(page_url) <= 2048)            -- tickets_page_url_check
CHECK (locale IS NULL OR char_length(locale) <= 12)                  -- tickets_locale_check
CHECK (char_length(source) <= 40)                                    -- tickets_source_check
```

Every cap is mirrored in `functions/submit-ticket/lib.ts` (`MAX_MESSAGE_CHARS`
8 000, `MAX_EMAIL_CHARS` 320, `MAX_PAGE_URL_CHARS` 2048, `MAX_LOCALE_CHARS` 12,
`MAX_SOURCE_CHARS` 40, plus a 64 KB body cap the DB does not see) — the client
half fails politely, the CHECKs are the floor.

#### RLS Policies

| Policy | Operation | Rule | Rationale |
|--------|-----------|------|-----------|
| `tickets_service_role_only` | ALL, `TO service_role` | `USING (TRUE) WITH CHECK (TRUE)` | Documents intent; service_role bypasses RLS anyway |
| *(no anon/authenticated policies)* | — | — | RLS enabled + no policy = **deny** (the 017/050 pattern). Ticket content never reaches the public API |

#### Indexes

```sql
tickets_pkey            ON (id)                            -- UNIQUE
idx_tickets_ip_time     ON (ip_hash, created_at DESC)      -- per-IP rate window
idx_tickets_time        ON (created_at DESC)               -- global daily window
idx_tickets_status_kind ON (status, kind, created_at DESC) -- triage view
```

#### Rate limiting

No separate ledger: every accepted ticket is already a row here, so the function
counts rows by `ip_hash` over a sliding window (`DEFAULT_IP_HOURLY_CAP = 3`,
env `TICKET_IP_HOURLY_CAP`) plus a global daily cap
(`DEFAULT_GLOBAL_DAILY_CAP = 100`, env `TICKET_GLOBAL_DAILY_CAP`), and
`idx_tickets_ip_time` makes the window count cheap. The rate-limit key comes
from `clientIpFrom()` in `functions/submit-ticket/lib.ts`, which prefers
**`cf-connecting-ip`** — written by Cloudflare itself and overwriting anything
the caller supplied — before falling back to `x-forwarded-for`.

#### Retention

A governance choice, not automated: takedown/objection tickets are a legal and
relational record and are **not** silently purged. Closed `question` tickets can
be pruned ad hoc. Moderation/takedown *execution* happens through the existing
lanes — this table is the intake, not the action. Closing a ticket is a
service-role UPDATE of `status`/`notes`.

---

### Table: `docent_usage`

Spend + rate-limit ledger for the site docent (`docent-chat` edge function,
migration `066`). One row per model-backed answer; FAQ short-circuits are free
and are still logged, with `faq_hit=true` and zero tokens, for observability.

What it enables:

1. **Per-IP request rate limit** over a sliding hourly window — the
   `anon_intake_log` (050) / `tickets` (065) discipline.
2. **A global daily token budget.** When the last-24 h sum of `output_tokens`
   crosses the function's budget, `docent-chat` DEGRADES to FAQ-only mode
   (canned answers plus a pointer to the docs and the ticket form) instead of
   calling a model. Fail-loud by design: the visitor is told the live guide is
   resting, never handed a silent 500 or the founder a surprise bill.

> [!IMPORTANT]
> **NO conversation content is stored here — only counters** (founder decision
> 2026-07-20: the docent logs counts, not transcripts). `locale` and `model` are
> kept for cost attribution; nothing identifies a person or reproduces what they
> asked.

#### Columns

| Column | Type | Nullable | Default | Source | Notes |
|--------|------|----------|---------|--------|-------|
| `id` | BIGINT | NOT NULL | identity | DB | `GENERATED ALWAYS AS IDENTITY`, PRIMARY KEY |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | DB | Both window keys |
| `ip_hash` | TEXT | NOT NULL | — | edge fn | Salted SHA-256; **raw IP never stored** |
| `locale` | TEXT | YES | — | edge fn | **CHECK** `(locale IS NULL OR char_length(locale) <= 12)` |
| `model` | TEXT | YES | — | edge fn | Model id, for cost attribution. **CHECK** `(model IS NULL OR char_length(model) <= 80)` |
| `input_tokens` | INTEGER | NOT NULL | `0` | edge fn | **CHECK** `(input_tokens >= 0)` |
| `output_tokens` | INTEGER | NOT NULL | `0` | edge fn | The budget currency (see `docent_output_tokens_since`, 067). **CHECK** `(output_tokens >= 0)` |
| `faq_hit` | BOOLEAN | NOT NULL | `FALSE` | edge fn | `true` = free canned answer, no model call |

#### Constraints

```sql
PRIMARY KEY (id)                                            -- docent_usage_pkey
CHECK (input_tokens >= 0)                                   -- docent_usage_input_tokens_check
CHECK (output_tokens >= 0)                                  -- docent_usage_output_tokens_check
CHECK (locale IS NULL OR char_length(locale) <= 12)         -- docent_usage_locale_check
CHECK (model IS NULL OR char_length(model) <= 80)           -- docent_usage_model_check
```

#### RLS Policies

| Policy | Operation | Rule | Rationale |
|--------|-----------|------|-----------|
| `docent_usage_service_role_only` | ALL, `TO service_role` | `USING (TRUE) WITH CHECK (TRUE)` | Documents intent; service_role bypasses RLS anyway |
| *(no anon/authenticated policies)* | — | — | RLS enabled + no policy = **deny** (the 017/050 pattern) |

#### Indexes

```sql
docent_usage_pkey        ON (id)                          -- UNIQUE
idx_docent_usage_ip_time ON (ip_hash, created_at DESC)    -- per-IP hourly window
idx_docent_usage_time    ON (created_at DESC)             -- global daily token-sum window
```

#### Operating parameters (all env-tunable, `functions/docent-chat/`)

| Setting | Env | Default |
|---------|-----|---------|
| Per-IP hourly requests | `DOCENT_IP_HOURLY_CAP` | 40 |
| Global daily output tokens | `DOCENT_DAILY_TOKEN_BUDGET` | 500 000 |
| Max completion tokens | `DOCENT_MAX_TOKENS` | 800 |
| Retrieval top-k | `DOCENT_TOP_K` | 6 |
| Provider / model | `DOCENT_PROVIDER` / `DOCENT_MODEL` | `anthropic` / `claude-haiku-4-5` |
| IP hash salt | `DOCENT_IP_SALT` | `champollion-docent-v1` |

Rate-limit key: `clientIpFrom()` prefers **`cf-connecting-ip`** over
`x-forwarded-for` — the last-hop XFF value rotates on Supabase Edge, which makes
a naive per-IP limit inert.

#### Retention

48 h covers the widest window (the daily budget); purge ad hoc or via pg_cron.
Extra rows are harmless.

---

---

## Objects CHANGED by migrations 058–067

### 058 — `rls_auto_enable()` EXECUTE, made replay-stable

No schema change. Migration **025** revokes API-facing EXECUTE on
`public.rls_auto_enable()` so advisor lints 0028/0029 stay clear — but 025's
revoke is a DO-block that acts only **IF the function already exists**. On a
clean LINEAR replay of 001→057 (a fresh dev branch, or anyone rebuilding the
public repo's migrations) 025 runs long BEFORE **054** first creates
`rls_auto_enable()`, so the revoke no-ops; 054 then creates the function fresh,
with PostgreSQL's default PUBLIC EXECUTE grant, and nothing re-revokes it.

Net effect before 058: the "zero advisor warnings" guarantee held on the live
prod project (where 025 ran when the function already existed) and was **FALSE
on any from-scratch replay** — exactly what a public-repo consumer or a new
branch does.

058 re-applies the revoke AFTER 054, using 025 §1's proven
`oid::regprocedure::text` FOR-loop so it is a no-op when the function is absent
and never errors on a partial rebuild:

```sql
EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public', sig);
```

Idempotent, and a no-op on prod (already revoked there). **Revoking EXECUTE does
not stop the event trigger firing** — event triggers are invoked by the system
on DDL, not through EXECUTE privilege — so the RLS safety net is unaffected
(025's rationale, unchanged). Re-running 054 later is now safe, because
`CREATE OR REPLACE` **preserves** an existing function's ACL — the 025 hazard
was specifically that 054 created the object for the first time.

> **This corrects the migration's own wording.** 058's header
> (`058_rls_auto_enable_execute_revoke.sql:10-11`) says 054's `CREATE OR
> REPLACE` "restores PostgreSQL's default PUBLIC EXECUTE grant", without the
> first-create qualifier. PostgreSQL's actual behaviour is as stated above:
> `CREATE OR REPLACE` on an EXISTING function keeps its ACL. The migration is
> right about what happened on a linear replay and imprecise about why; this
> document follows the behaviour, not the comment.

Live state on prod (verified): `rls_auto_enable()` ACL is `postgres=X` +
`service_role=X` — no PUBLIC, anon, or authenticated entry.

Two details worth recording alongside the function-inventory row:

- `rls_auto_enable()` pins `search_path = pg_catalog` (not `public`, unlike
  every other pinned function in this schema) — correct for an event trigger
  that only touches catalog objects, but it is the one exception to the
  "`search_path` pinned to `public`" sentence under the function inventory.
- The event trigger **ENABLEs** RLS; it does not FORCE it, and its per-table
  work is wrapped in `EXCEPTION WHEN OTHERS THEN RAISE LOG` — so a table on
  which `ALTER TABLE … ENABLE ROW LEVEL SECURITY` fails is created **without**
  RLS and the only trace is a log line. The safety net fails **open**, quietly.

### 063 — `run_cards_content_guard_check()` perf hoist (DB6)

**Behaviour is identical to 051 in every observable respect**; only the
row-serialization cost changes. The trigger `run_cards_content_guard` (BEFORE
INSERT OR UPDATE ON `run_cards`, FOR EACH ROW) stays bound to the same function
name and is deliberately **not** dropped or recreated.

The cost 063 removes: `NEW` carries the up-to-1 MB `run_card` JSONB, and 051's
text-column cap loop walked 13 columns re-serializing the whole `NEW` row for
each one (plus once more inside the `RAISE` on a violation). So one ordinary
publish — and every verifier trust-update, which only PATCHes `trust` but still
re-runs the whole BEFORE trigger — re-serialized the entire ≤ 1 MB row ~13
times. During a fresh-board seed (hundreds of publishes in a burst) that is
hundreds of megabytes of redundant JSONB serialization for no added safety.

The fix: `card_json jsonb := to_jsonb(NEW)` computed once at the top and reused
for every column check. Everything else is unchanged — the text-column caps, the
"`run_card` must be a JSON object ≤ 1 048 576 bytes" checks, 033's
dataset-license resolution (`is_license_redistributable`), and the strict
aggregate-only shape validation (`run_card_shape_violation`, ≤ 262 144 bytes for
corpora that are not redistribution-cleared).

The 13 capped columns and their limits, verbatim from the guard:

| Column | Cap (chars) | | Column | Cap (chars) |
|--------|------|---|--------|------|
| `submitter` | 200 | | `harness_version` | 100 |
| `affirmation` | 4000 | | `fingerprint_hash` | 200 |
| `model_slug` | 300 | | `api_provider` | 100 |
| `condition` | 200 | | `method_class` | 100 |
| `dataset_id` | 300 | | `paradigm` | 100 |
| `language_pair` | 100 | | `corpus_license` | 300 |
| | | | `corpus_attribution` | 2000 |

> Why a new migration rather than an edit to 051: 051 is already applied to
> prod, and applied migrations are never edited in place. `SET search_path =
> public` is carried explicitly, because a bare `CREATE OR REPLACE` would
> silently drop 051's pin and reintroduce advisor lint 0011 (role-mutable
> `search_path`). **Rollback:** re-run 051 — its `CREATE OR REPLACE` restores
> the prior body, and the trigger binding is unaffected either way.

Verified on prod: the live `run_cards_content_guard_check()` body contains the
`card_json` hoist, and `search_path=public` is pinned.

The guards-table row for `run_cards_content_guard` should gain "; the whole-row
JSONB is serialized once per row (migration 063)".

### 064 — the improper-slice backstop, anchored (DB7 + E9)

A **correctness fix** to the regex backstop shared byte-identically by two
guards: `reject_quarantined_datasets()` (022, the `run_cards` publish guard) and
`public.contest_corpus_guard()` (041, the standard-lane contest guard). Neither
trigger is dropped or recreated; both stay bound by function name.

**The bug.** The backstop was an unanchored substring blocklist:

```
(-quarantined|sample[-_]?62|phase1[-_]?test|dev[-_]?124|crk[-_]?master)
```

It matched its needles ANYWHERE in an id, so legitimate FUTURE ids collided with
the incident-specific crk slices — `crk-master-2026` (a versioned future master
corpus), `dev-1240` / `dev-12400`, `sample-620`, and **any** id containing the
literal `-quarantined`. Because the guard fires on UPDATE as well as INSERT,
such an id was permanently unpublishable and contest-ineligible, with no
`datasets` row to unflag, since it was never quarantined in the first place.

**The fix** — anchor to the known-bad shapes rather than to substrings:

```
(sample[-_]?62(?![0-9])|phase1[-_]?test|dev[-_]?124(?![0-9])|crk[-_]?master(?![-_]?[0-9]))
```

- The bare `-quarantined` alternative is **removed**. Both seeded incident ids
  (`crk-phase1-test-90-quarantined`, `crk-edtekla-dev-124-quarantined`) are
  still caught by their `phase1-test` / `dev-124` markers, and both remain
  flagged in `datasets.quarantined` — the PRIMARY, data-driven mechanism.
  Nothing that was actually quarantined becomes publishable.
- The count markers gain a trailing non-digit lookahead: `dev-124` still
  matches, `dev-1240` no longer does; `sample-62` matches, `sample-620` does not.
- `crk[-_]?master(?![-_]?[0-9])` blocks `crk-master-corpus`, bare `crk-master`
  and `crk_master`, but ALLOWS a versioned `crk-master-2026` — a
  separator-then-digit suffix reads as a version, not the 2026-06-11 slice.

Negative lookaheads are supported identically by the PostgreSQL ARE engine (the
`~*` operator) and by Python's `re`, so the DB-less migration-text tests
(`arena/tests/test_quarantine_guard_migration.py`) extract this exact string and
compile it — the one literal stays a true single source across both.

**What is preserved (the sovereignty core).** The improper-subset RANKING BAN
still holds: the known-improper crk ids (62-sample / 90-phase1 / 124-subset /
`crk-master` proper) remain rejected on `run_cards` INSERT (022) and on
standard-lane contest creation (041). `datasets.quarantined` + its trigger
remain primary; this regex is only the unregistered-id backstop. The two
backstops stay **byte-identical to each other** (intentional twins).

**E9 — `search_path`.** `reject_quarantined_datasets()` was defined by 022
*without* a pin; 025 added one afterwards via `ALTER FUNCTION`. A bare `CREATE
OR REPLACE` would silently drop it and reintroduce advisor lint 0011, so 064
writes `SET search_path = public` into both definitions (041 already had it).

**Rollback:** re-run 022 + 025 (022 restores the unanchored body, 025 re-pins
`search_path`) and 041 (restores its unanchored twin).

Verified on prod: both live function bodies contain the lookaheads and neither
contains the bare `-quarantined` alternative; both are pinned to
`search_path=public`.

The two guards-table rows should now read "…plus the **anchored** regex backstop
for the known-improper crk slice ids (migration 064 — blocks the incident
slices, not versioned lookalikes like `crk-master-2026` / `dev-1240`)".

### 067 — `docent_output_tokens_since(since timestamptz)`

`RETURNS BIGINT`, `LANGUAGE sql`, **STABLE**, **SECURITY INVOKER**,
`SET search_path = public`:

```sql
SELECT COALESCE(SUM(output_tokens), 0)::BIGINT
FROM docent_usage
WHERE created_at >= since;
```

The input to `docent-chat`'s global daily token budget. It exists because
PostgREST aggregate syntax is disabled on this project (`PGRST123 "Use of
aggregate functions is not allowed"`, the default since PostgREST 12 — a DoS
guard), so `GET /rest/v1/docent_usage?…&select=output_tokens.sum()` threw on
every call and the handler's fail-closed branch turned it into a blanket
`503 {"error":"the guide is briefly unavailable …"}` — the docent hard-down for
every visitor, behind a message that reads like a transient blip. Caught by
calling the deployed prod endpoint, not by any test.

SECURITY INVOKER means the caller's own privileges apply, so this adds **no new
read path** to `docent_usage`; and only service_role can read the table anyway
(066 is RLS deny-all). Deny-by-default EXECUTE:

```sql
REVOKE ALL ON FUNCTION docent_output_tokens_since(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION docent_output_tokens_since(TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION docent_output_tokens_since(TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION docent_output_tokens_since(TIMESTAMPTZ) TO service_role;
```

Verified on prod: the ACL is `postgres=X` + `service_role=X` only. Returns a
scalar, never row content — and `docent_usage` holds no conversation content in
the first place (066).

The alternative — enabling project-wide aggregates — was rejected because it
would loosen a DoS guard for **every** table to serve one counter.

---

## Standalone Functions (inventory)

| Function | Migration | Security | Callable by |
|----------|-----------|----------|-------------|
| `get_trading_card_index()` | 012 | INVOKER, STABLE | public API |
| `get_source_licenses()` · `get_attribution_for_language(text)` | 013 | INVOKER, STABLE | public API |
| `get_experts_for_language(text)` · `get_languages_for_expert(text)` | 018 | INVOKER, STABLE | public API |
| `get_services_for_pair(text, text)` | 034 | INVOKER, STABLE | anon, authenticated |
| `run_cards_audit_fn()` | 017 | DEFINER (trigger-only) | nobody (EXECUTE revoked, 020/025) |
| `update_datasets_modified()` | 011 | trigger-only | — |
| `reject_quarantined_datasets()` | 022 | trigger-only | — |
| `validate_run_card_scores()` | 023 | trigger-only | — |
| `reject_corpus_sha_mismatch()` | 026 | trigger-only | — |
| `is_license_redistributable(text)` | 033 | IMMUTABLE helper | (used by the content guard) |
| `reject_nonpublishable_entry_content()` | 033 | trigger-only | — |
| `notify_regenerate_queue()` | 036 | DEFINER (trigger-only; reads Vault) | — |
| `reject_illegal_request_transition()` | 038 | trigger-only | — |
| `auth_grant_bind_check()` | 039 | trigger-only | — |
| `claim_auth_grant(text, text, text)` · `auth_grant_is_valid(text, text)` | 039 | DEFINER | **service_role only** |
| `authorization_audit_chain()` · `reject_audit_log_mutation()` | 040 | trigger-only | — |
| `authorization_audit_head()` | 040 | STABLE | anon, authenticated, service_role |
| `contest_corpus_guard()` | 041 | trigger-only | — |
| `reject_illegal_qualifier_mutation()` | 042 (replaced by 046) | trigger-only | — |
| `contest_intake_admission_check()` · `reject_illegal_intake_transition()` | 043 | trigger-only | — |
| `authorization_request_admission_check()` | 045 | trigger-only | — |
| `sealed_set_admission_check()` · `qualifier_admission_check()` | 046 | trigger-only | — |
| `reject_illegal_shared_task_mutation()` | 047 | trigger-only | — |
| `run_card_shape_violation(jsonb, text, int)` | 051 | IMMUTABLE helper | (used by the run-card content guard) |
| `run_cards_content_guard_check()` | 051 | trigger-only | — |
| `contest_admission_check()` · `contest_submission_admission_check()` | 052 | trigger-only | — |
| `is_license_commercial_safe(text)` | 053 | IMMUTABLE helper | (used by the use-context guard) |
| `contest_use_context_guard()` | 053 | trigger-only | — |
| `rls_auto_enable()` | 054 (verbatim commit of the prod object) | DEFINER (event-trigger-only; EXECUTE revoked, 025) | — |
| `queue_top(text, int, int)` | 059 | INVOKER, STABLE | anon, authenticated *(+ residual PUBLIC — see defects)* |
| `queue_pairs(text)` | 062 | INVOKER, STABLE | anon, authenticated *(+ residual PUBLIC — see defects)* |
| `contributor_reputation(text)` | 061 | INVOKER, STABLE | anon, authenticated (PUBLIC revoked) |
| `docent_output_tokens_since(timestamptz)` | 067 | INVOKER, STABLE | **service_role only** |

Advisor hardening (020/025): all API-reachable SECURITY DEFINER trigger/event
functions have EXECUTE revoked from anon/authenticated/public, and every
function above has `search_path` pinned to `public`. Migration **048** extends
this to `claim_auth_grant` / `auth_grant_is_valid` (039) and
`notify_regenerate_queue` (036) — those are **no longer API-callable** by
anon/authenticated/public (service_role/trigger paths only).

---

## Migrations 042–048 — Organizer / Registration Lane (2026-07-11)

The self-serve organizer lane: qualifier rounds, contest intake, and the
registration door. All new tables use `id BIGINT GENERATED ALWAYS AS IDENTITY
PRIMARY KEY`; all guards are triggers (nothing bypasses them, including
`service_role`).

### Table: `qualifiers` (042)

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| `qualifier_id` | TEXT | UNIQUE NOT NULL |
| `corpus_card_id` | TEXT | NOT NULL |
| `sealed_set_id` | TEXT | NULL — FK → `sealed_sets.sealed_set_id` |
| `threshold` | NUMERIC | NOT NULL, CHECK > 0 (**0–100 qualifier scale**, vs the 0–1 composite — see the scale note in `contest.py`) |
| `metric` | TEXT | NOT NULL DEFAULT `'composite'` |
| `year` | INT | NOT NULL, CHECK 2000–9999 |
| `status` | TEXT | NOT NULL DEFAULT `'active'`, CHECK `active|frozen` |
| `created_by` | TEXT | NULL = curator/service lane (added by 046; frozen after insert) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Indexes: `idx_qualifiers_one_active_per_set` (partial UNIQUE on `sealed_set_id`
WHERE `status='active' AND sealed_set_id IS NOT NULL`) ·
`idx_qualifiers_corpus` (`corpus_card_id`) · `idx_qualifiers_creator`
(`created_by`,`created_at`, 046).
Triggers: `qualifiers_terms_guard` (042; freeze terms, one-way `active→frozen`;
046 replaces the function to also freeze `created_by`) ·
`qualifiers_admission_guard` (046).
RLS: anon/authenticated SELECT; 046 adds identity-bound INSERT
(`qualifiers_register_own`: `created_by` = JWT email, born `active`, may only
gate a sealed set the same identity registered).

### Table: `contest_intake` (043) + `contests` additions

`contests` gains: `authorization_model` TEXT NOT NULL DEFAULT `'per-submission'`
(CHECK `per-submission|blanket|open`) · `intake_daily_limit` INT NOT NULL
DEFAULT 5 (CHECK > 0) · `intake_open` BOOLEAN NOT NULL DEFAULT false ·
`shared_task_id` TEXT NULL FK → `shared_tasks` (047, indexed WHERE NOT NULL).

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| `intake_id` | TEXT | UNIQUE NOT NULL |
| `contest_id` | TEXT | NOT NULL, FK → `contests.id` |
| `submitted_by` | TEXT | NOT NULL (RLS-bound to JWT email) |
| `team` / `notes` | TEXT | `notes` DEFAULT `''` |
| `dev_hyp_sha256` / `test_hyp_sha256` | TEXT | NOT NULL — method-bound fingerprints, frozen after insert |
| `storage_path` | TEXT | NOT NULL — path in the `contest-intake` bucket |
| `status` | TEXT | NOT NULL DEFAULT `'received'`, CHECK `received|qualifier_checked|pending_authorization|scoring|scored|published|rejected` (one-way lifecycle) |
| `qualifier_id` / `qualifier_score` | TEXT / NUMERIC | Qualifier gate results |
| `authorization_request_id` / `run_card_id` / `reject_reason` | TEXT | Lifecycle bookkeeping; `rejected` requires a reason |
| `created_at` / `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Constraint: `contest_intake_dedup` UNIQUE(`contest_id`,`test_hyp_sha256`).
Indexes: `idx_contest_intake_poll` (`contest_id`,`status`) ·
`idx_contest_intake_submitter` (`submitted_by`,`created_at`).
Triggers: `contest_intake_admission_guard` · `contest_intake_transition_guard`.
RLS: INSERT `contest_intake_submit` (`submitted_by` = JWT email); SELECT
`contest_intake_read` (public contest OR own rows OR contest creator).

### Storage (044)

Private bucket `contest-intake` (`public=false`). `storage.objects` policies
`contest_intake_upload_own_folder` (INSERT) and
`contest_intake_read_own_folder` (SELECT) require path segment 2 = JWT email.
**No UPDATE/DELETE policies** — bundles are immutable and retained.

### Self-serve authorization requests (045)

`sealed_sets` gains `request_daily_limit` INT NOT NULL DEFAULT 5 (CHECK > 0).
`authorization_requests` gains: partial UNIQUE
`idx_auth_requests_pending_dedup` (`sealed_set_id`,`fingerprint` WHERE
`state='pending'`) · `authorization_requests_admission_guard` · RLS INSERT
`authorization_requests_propose_own` (`requested_by` = JWT email, born
`pending`, `emit='scores-only'`).

### Registration door (046)

`created_by` TEXT NULL added to **both** `sealed_sets` and `qualifiers`
(NULL = curator/service lane; frozen after insert). Identity-bound INSERT
policies (`sealed_sets_register_own`: born `quarantined=true`, status
`planned|active`) + born-safe-state admission guards + a 24-registrations/24h
per-creator throttle. Creator indexes on both tables.

### Table: `shared_tasks` (047)

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| `shared_task_id` | TEXT | UNIQUE NOT NULL (slug frozen after insert) |
| `name` / `organizer` | TEXT | NOT NULL |
| `year` | INT | NOT NULL, CHECK 2000–9999 (frozen) |
| `description` | TEXT | NOT NULL DEFAULT `''` |
| `default_authorization_model` | TEXT | NOT NULL DEFAULT `'per-submission'`, CHECK `per-submission|blanket|open` — edition defaults fill unset contest flags |
| `default_intake_daily_limit` | INT | NOT NULL DEFAULT 5, CHECK > 0 |
| `status` | TEXT | NOT NULL DEFAULT `'active'`, CHECK `active|archived` (one-way) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() (frozen) |

Trigger: `shared_tasks_identity_guard`. RLS: enabled;
`shared_tasks_anon_read` SELECT to anon+authenticated.

### Function hardening (048)

No schema change. `REVOKE EXECUTE` on `claim_auth_grant`,
`auth_grant_is_valid` (039) and `notify_regenerate_queue` (036) from
anon/authenticated/public — same advisor class as migration 025.

---

## Migrations 050–055 — Anonymous Lane + Launch Hardening (2026-07-18/19)

The anonymous-intake lane (050, staged 2026-07-13) plus the fixes for the
launch-readiness audit's §1 DB findings (docs/LAUNCH_READINESS_AUDIT_2026-07-18.md),
applied to prod 2026-07-19 under the founder's authorization:

- **050 `anon_intake_log`** — the rate-limit ledger behind the `submit-run`
  edge function (verify_jwt=false; service-role inserts as
  `submitter='anonymous'`, `owner_uid=NULL`, `trust='unverified'`). See the
  table section above and `functions/submit-run/README.md`.
- **051 run-card content guard (H1)** — closes the world-readable
  `run_cards.run_card` JSONB content hole with 033's license resolution +
  strict aggregate-only shape validation. Honest residual documented in the
  migration header: shape rules remove the BULK laundering channel; small
  fragments remain possible, bounded by rate caps + the 017 moderation lane.
- **052 contest identity binding (M1)** — JWT-email-bound INSERT policies +
  admission triggers (born-open, server timestamps, 24/24h throttles) on
  `contests`/`contest_submissions`. Client half: `contest.py` now always
  stamps the email (the old display-name default could never pass the
  owner-update policy anyway).
- **053 use-context guard (M3)** — `is_license_commercial_safe()` (SQL twin
  of `license_use.is_commercial_safe`, parity frozen by
  `arena/tests/test_launch_hardening_migrations.py`) + trigger: NC/unknown
  licenses never rank in a commercial lane.
- **054 `rls_auto_enable` (L1)** — the prod-only event trigger committed
  verbatim; rebuilds keep the RLS safety net.
- **055 regenerate-queue authorization (M2)** — `regen_state` debounce table
  + the 036 notifier extended with the Vault `regenerate_queue_secret`
  header; the edge function now requires `x-regen-secret` in-handler and
  debounces via an atomic conditional UPDATE. Paired H2 fix in
  `functions/submit-run/lib.ts`: the per-IP rate-limit key is the last
  PUBLIC `X-Forwarded-For` hop / connection peer, never the spoofable
  leftmost hop.

Offline drift-freezes: `arena/tests/test_run_card_content_guard_migration.py`
and `arena/tests/test_launch_hardening_migrations.py`.

---

## Defects, surprises and honest residuals (058–067 write-up, 2026-08-01)

Ordered by consequence. Each was verified against prod unless marked otherwise.

### D1 — `queue_items` PK omits `rank_mode`, so the table can hold only ONE mode at a time (correctness, live)

`id` is `corpus_id__model__condition` and is the sole PRIMARY KEY, but
`rank_mode` (`'map'`|`'ecv'`) is a separate column and the same combo is a valid
candidate in **both** orderings. Two independent mechanisms then make the modes
mutually exclusive:

1. The ranker upserts with `Prefer: resolution=merge-duplicates`, so a second
   mode's row for the same `id` **overwrites** the first rather than coexisting.
2. `upsert_queue_items()` finishes each run with
   `DELETE /queue_items?generation_id=neq.<gen>` — a **table-wide** sweep, not
   scoped to `rank_mode`. Running the ranker in `ecv` mode therefore deletes
   every `map` row, and vice versa.

Live confirmation on prod: 9 817 rows, **all** `rank_mode='map'`, one
`generation_id`; `queue_top('map', 500, 0)` returns a full page while
`queue_top('ecv', 500, 0)` returns **0 rows**. Because both
`queue_top`/`queue_pairs` default to `'map'`, an `ecv` caller gets a silent
empty page rather than a loud error — the fail-quiet shape this project
otherwise refuses. Fix is a schema change: `PRIMARY KEY (rank_mode, id)` (or a
UNIQUE on the pair), plus scoping the generation sweep to the mode being
written.

### D2 — `queue_items` on prod has not been regenerated since the day it was created (operational, live)

All 9 817 rows carry a single `generation_id` with `generated_at` between
`2026-07-19 19:20` and `19:21` UTC — 12+ days stale as of 2026-08-01. Worth
stating plainly in the doc, because 059's stated motive is "the ordering is
never stale against the board": what 059 actually made live is the **coverage
exclusion** (`NOT EXISTS … trust='verified'`, evaluated per query). The
**ordering** is still frozen at the last manual `generate_sweep_queue.py` run,
exactly as with the old blob. The migration header slightly oversells this and
the doc should not repeat the claim unqualified.

### D3 — `contributor_audit_log` is "append-only" by convention only (integrity)

See the note in that table's section. No immutability trigger, no hash chain —
unlike `authorization_audit_log` (040), which has both and is append-only
beneath service_role. A retraction trail that a service-role key can silently
rewrite does not carry the weight the migration comment claims for it ("as
public as a journal retraction").

### D4 — 059 and 062 skip the EXECUTE hygiene that 058, 061 and 067 apply (advisor hygiene, live)

`queue_top` and `queue_pairs` were created with a bare `GRANT EXECUTE … TO anon,
authenticated` and **no preceding `REVOKE … FROM PUBLIC`**, so PostgreSQL's
default PUBLIC EXECUTE grant survives. Confirmed on prod — both ACLs carry the
`=X/postgres` (PUBLIC) entry, while `contributor_reputation` (061, which does
revoke) and `docent_output_tokens_since` (067) do not.

This is **not** a privilege escalation: both functions are SECURITY INVOKER over
public-read tables, so PUBLIC gains nothing anon does not already have. It is a
deviation from the replay-clean standard 058 established three days earlier, and
the sort of thing that shows up on a future advisor sweep. One line each fixes
it.

*(For calibration: the pre-existing trigger/helper functions
`reject_quarantined_datasets`, `contest_corpus_guard`,
`run_cards_content_guard_check` and `run_card_shape_violation` also carry a
PUBLIC EXECUTE entry on prod — they are not SECURITY DEFINER, so this is noise
rather than exposure, but the inventory's blanket "EXECUTE revoked from
anon/authenticated/public" sentence overstates the current state.)*

### D5 — `contributors.updated_at` has no maintaining trigger (correctness, minor)

The column is `NOT NULL DEFAULT now()`, but there is no `set_*_updated_at`
trigger on the table (verified: the five new tables carry no triggers at all),
unlike `datasets`, which has `set_datasets_updated_at` (011). Every write path
must remember to stamp it; the verifier currently does, but a future writer that
forgets leaves a row whose `updated_at` is its creation time forever. Either add
the trigger or document the column as application-maintained (this draft does
the latter).

### D6 — 064's regex is lookahead-bounded, not truly anchored (surprise, minor)

The migration calls the new pattern "ANCHORED", but it is still an unanchored
substring match with a trailing negative lookahead — there is no `^`/`$`. Two
consequences:

- Only a **digit**-leading suffix escapes the `crk-master` needle:
  `crk-master-2026` is allowed, but `crk-master-v2` is still blocked
  (`[-_]?[0-9]` fails on `v`). The versioning tolerance is narrower than the
  header implies.
- `sample-62k` (i.e. 62 000 samples) is still blocked, because the lookahead
  guards only against more digits, not against other suffixes.

Both are acceptable for a backstop, but the doc should say "lookahead-bounded"
rather than repeat "anchored".

### D7 — dropping the `-quarantined` alternative narrows the backstop for *future* ids (honest residual)

The two seeded incident ids are still caught by their other markers, as the
migration says. But `-quarantined` was also a **naming convention**: a future
unregistered slice named `foo-quarantined`, following the same convention, is no
longer caught by the backstop and relies entirely on someone having set
`datasets.quarantined`. That is defensible — the flag *is* the primary mechanism
— but it is a real narrowing and the migration header only accounts for the two
existing ids.

### D8 — `ensure_rls` fails open and silently (pre-existing, surfaced by 058)

`rls_auto_enable()` wraps its per-table `ALTER TABLE … ENABLE ROW LEVEL
SECURITY` in `EXCEPTION WHEN OTHERS THEN RAISE LOG`, and it *enables* rather
than *forces* RLS. A table for which the ALTER fails is created **without** RLS
and the only evidence is a log line nobody reads. Since 058's whole subject is
keeping this safety net intact across replays, the doc should state what the net
does and does not guarantee.

### D9 — `docent_usage` and `tickets` are both empty on prod (verify, not yet a defect)

Both tables hold **0 rows**, though the docent lane went live 2026-07-26.
`tickets` at 0 is unremarkable (nobody has filed one). `docent_usage` at 0 is
worth checking, because the usage insert is deliberately non-fatal
(`console.error("docent_usage log failed:", err); // never fatal`) — so a
persistently failing insert is indistinguishable from no traffic, and an empty
ledger means `docent_output_tokens_since()` always returns 0 and the daily
budget can never engage. Either confirm zero traffic from the function logs, or
this is a silent-failure bug in the logging path. **Not** something to assert in
the schema doc; flagging it for the owning lane.

### D10 — `run_cards.condition` example in the existing doc contradicts 059's join key (doc drift)

The `run_cards` column table documents `condition` as *e.g.
`"en>crk+coaching"`*, but 059's `queue_items.condition` is `CHECK (condition IN
('naive','coached'))` and joins directly to `run_cards.condition`. Live prod
`run_cards` contains only `condition='naive'` — so the **migration is right and
the existing doc's example is stale**. Left uncorrected, a reader would conclude
the 059/062 coverage filter can never match. Fix the 001–057 row while landing
this.

### D11 — table-level grants are wide open on every new table (context, not new)

`anon` and `authenticated` hold `SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES, TRIGGER` on all five new tables. This is the Supabase project-wide
default — `run_cards` carries the identical grant set — and RLS is what actually
denies writes (no INSERT/UPDATE/DELETE policy exists on any of them). Recorded
only so a future reader does not mistake it for something 059–066 introduced.
The one privilege RLS does **not** govern is `TRUNCATE`; it is unreachable
through PostgREST (no HTTP verb maps to it), so this is a posture note, not a
live hole.

### D12 — `arena/DATABASE_SCHEMA.md` ships in the public squash but cites internal `docs/` paths (process)

The file already references `docs/LAUNCH_READINESS_AUDIT_2026-07-18.md`, and
the migration headers of **061** (`:10`) and **065** (`:36`) cite
`docs/TRUST_MODEL_REPUTATION.md` and `docs/TICKETS.md`. 066 carries no such
reference.

**The third one is not a comment, and it is the one that matters.** 063 puts an
internal wiki path inside a live `RAISE EXCEPTION` string
(`063_run_cards_content_guard_perf.sql:115`):

```
… corpus content is never hosted here (docs/DATA_BOUNDARIES.md).
```

That message is emitted to **any publisher who trips the content guard** — an
external contributor, over the public API — not merely to someone reading the
migration file. It points them at a document that does not exist in anything
they can see. Everything else in D12 is a citation in a comment; this is an
internal path in production output.

Fixing it means a NEW migration replacing the function body (the 063 file is
already applied to prod; editing an applied migration changes nothing that is
running). That is a founder-authorized prod write, so it is flagged here rather
than done. The user-facing half of the message should name the public page,
`champollion.dev/docs/network/sovereignty/data-sovereignty`.

---

## Design Principles

1. **Denormalize for query speed**: Core metrics are top-level REAL columns (not buried in JSONB) so the leaderboard can `ORDER BY composite_score DESC` without function calls.

2. **JSONB as source of truth**: The `run_card` JSONB blob contains everything. Top-level columns are denormalized copies for SQL ergonomics. If they disagree, JSONB wins.

3. **Immutable submissions**: Run cards cannot be updated or deleted via the API. Only admins (service_role key) can moderate, and the 017 audit trail preserves every prior row. Sovereign-eval decisions go further: the 040 log is append-only for *everyone*, service_role included.

4. **Trust escalation is admin-only**: CLI always inserts `trust = 'unverified'`. Promotion to `'verified'` happens via the server-side verifier (`mt_eval_harness/verifier.py`, service_role) which re-scores against the sha-pinned canonical corpus; demotion to `'disqualified'` is admin moderation.

5. **Organic metadata, curated registry**: `publish.py` treats the datasets upsert as non-fatal secondary metadata, but since migration 024 the `datasets` table itself is **curator-owned** (service_role writes only) — its `sha256` pins and `quarantined` flags are trusted inputs to the 026/022/033 guards.

6. **RLS gates the API; triggers gate everyone**: All INSERT policies require an authenticated uid (and owner binding since 027). But every integrity/sovereignty invariant that matters — quarantine, score ranges, sha parity, corpus-content exposure, authorization state machines, audit immutability — is ALSO a trigger, because `service_role` bypasses RLS and *nothing* bypasses triggers.

7. **Content never lives here**: Corpus content is fetch-from-source. The only text columns that can carry corpus sentences (`run_card_entries.source`/`expected`) sit behind the 033 guard (registered + non-quarantined + open-segment + redistribution-cleared license, else reject). The sovereign-eval tables (037–040) are content-free by construction and test-asserted.
