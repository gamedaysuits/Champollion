# Database Schema — Single Source of Truth

> [!IMPORTANT]
> This document is the **canonical reference** for the Champollion Supabase schema.
> All migration files, publish.py code, and leaderboard queries must conform to this spec.
> When in doubt, this document wins — **within the range it actually covers.**
>
> **Covers migrations 001–080 (080 drafted, not applied).** Production
> (`sjdomynysdljkbemupqa`) is current through **079**; 070 and 079 were applied
> there on 2026-10-12. **080 is drafted and applied to no Supabase project** —
> it waits on the founder's go-ahead, so every 080 change below is written as
> a change that has not happened yet. 058–067 were written up 2026-08-01.
> 068–080 were written up **2026-10-13** (updated 2026-10-13), read from the
> SQL files themselves; they were not re-verified against prod.
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
> **Documents migrations 001–080 (080 drafted, not applied)** in
> `mt-eval-arena/supabase/migrations/` (the canonical migration directory).
> The 068–080 tables and changed objects have their own sections below
> ("Tables added by migrations 068–080", "Objects CHANGED by migrations
> 068–080") and their defects continue the ledger at D16.
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
| `mt-eval-arena/supabase/migrations/` | **CANONICAL** — all new migrations go here (on disk: `001`–`080`; on prod: `001`–`079`; documented below: `001`–`080`, 080 drafted, not applied) | ✅ Active |
| `arena/migrations/` | Mirror of 001–011 only (kept for old references) | 🏛️ Historical reference |
| `001_create_run_cards.sql` (historical, dashboard-applied) | Original base table | 🏛️ Historical reference |
| `cli/supabase/migrations/` | Legacy CLI migrations (dashboard-applied) | 🏛️ Historical reference |

### Migration Application Order

The full schema is the result of applying these in order:

```
1. 001_create_run_cards.sql — historical base-table migration (dashboard-applied)
2. cli/supabase/migrations/20260528023253_*.sql             (added 6 columns)
3. cli/supabase/migrations/20260528024953_*.sql             (added 4 columns, created datasets)
4. mt-eval-arena/supabase/migrations/001–079_*.sql          (prod; 080 drafted, not applied — see the index below)
```

### Migration Index (001–080)

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
| 068 | **Redistributable-license match anchored** (fix): `is_license_redistributable(text)` (033) redefined so the permissive-family test is `strpos(low, pref) = 1` — a prefix match, Python's `startswith` — instead of 033's `> 0` (substring). The substring test failed open: `mit` occurs inside "limited" and "permitted", so a restrictive grant such as "Limited Use License" cleared corpus text for public upload. `'the unlicense'` joins the prefix list so The Unlicense still clears once anchored. The Python twin (`publish.py _license_is_redistributable`) was fixed the same day; parity is pinned by `arena/tests/test_content_guard_migration.py`. Both callers — the 033 entry guard and the 051/063 run-card guard — pick it up by name. **On prod by 2026-08-28** (exact apply date not recorded in the migrations README) |
| 069 | **`trading_card_vocabulary`** — the vocabulary explorer's own table, split out of `trading_card_detail.detail` (vocabulary was 70–95 % of each detail blob; the split shrinks the blobs by ~75 % and lets the site fetch one code's forms on demand). `code` PK → `trading_card_index(code)` ON DELETE CASCADE, `items`/`sources` JSONB, `total_forms`, `asjp_only`. RLS: anon SELECT only. **Applied to prod 2026-08-18** (SSOT cutover gate 1) |
| 070 | **Quarantine backstop moved from code to data** (founder direction 2026-08-19: nothing language-specific lives in code): new `quarantined_id_patterns` (one row per blocked id shape; public-read, service-role write), seeded with 064's four alternatives verbatim. `reject_quarantined_datasets()` (022) and `contest_corpus_guard()` (041) now test the id with `~*` against the table's rows instead of a regex literal compiled into each body — the two twins read the same rows and can no longer drift. Day-one behaviour is identical to 064. A new incident in any language is now an INSERT, not a migration. **Applied to prod 2026-10-12**; until then 064's literal held |
| 071 | **`queue_items` vocabularies widened** (founder decisions 2026-08-27): the `condition` CHECK gains `engine` (non-LLM MT services in the public queue; reverses the 2026-07-19 llm-only lane), and the `rank_mode` CHECK gains `edv` (expected-decision-value ordering; `map_value` becomes the generic rank-value column). Both CHECKs are dropped and re-added under their 059 auto-generated names. `queue_top`/`queue_pairs` unchanged. The engine lane took the table from ~9,815 rows to 211,082. **On prod by 2026-08-28** |
| 072 | **Contests lifecycle guard** (contest beta 2026-09-06): `contests_lifecycle_guard` BEFORE INSERT OR UPDATE trigger on `contests` — the data-layer floor beneath the competition half (`mt-eval contest rank / close / export`, `mt_eval_harness/contest_rank.py`). Identity freeze (`id`, `corpus_id`, `language_pair`, `lane`, `use_context`, `created_by`, `created_at`; `shared_task_id` attaches once), one-way `open → closed → archived`, a close REQUIRES `metadata.final_ranking` to be a JSON object and FORCES `intake_open=false` + server-stamps `metadata.closed_at`, the frozen result (`final_ranking`/`closed_at`/`closed_by`) is immutable after close and intake can never reopen, `metadata.primary_metric` is vocabulary-checked (`chrf_plus_plus \| bleu \| comet_score \| composite`) and frozen once any `contest_submissions`/`contest_intake` row exists, and no result keys may exist at INSERT. Trigger-only — no columns, no rows touched. **Applied to prod 2026-09-07**, just before 074 (`mt-eval-arena/supabase/migrations/README.md`); the CLI enforces the same rules client-side as well |
| 073 | **`queue_pairs` covering index + PUBLIC EXECUTE revoke** (live smoke 2026-09-06, SMK-02 and D4): `idx_queue_items_mode_pair_cover ON (rank_mode, language_pair) INCLUDE (est_cost_usd, corpus_id, model, condition)`; `REVOKE EXECUTE … FROM PUBLIC`, then `GRANT EXECUTE … TO anon, authenticated, service_role` on `queue_top(text, integer, integer)` and `queue_pairs(text)`; `ANALYZE public.queue_items`. Plain `CREATE INDEX` (not `CONCURRENTLY`), so it blocks writes for the seconds it takes. **Applied to prod 2026-09-06**: `queue_pairs('map')` went from 3,413 ms to 759 ms server-side (D14); D4 closed |
| 074 | **Contest entries, phases and promises** (sovereign-contest practices, 2026-09-06). The data layer under "a contest is sovereign hosting; an entry is a method handed to the air-gapped node". (a) `contest_submissions` gains the entry declarations — `is_primary` (one primary per `(contest_id, COALESCE(team, submitted_by))`, partial unique index `idx_cs_one_primary`), `track` (`constrained \| unconstrained`), `description` (≤ 4000), `method_release_url` (http/https, ≤ 2048), `constraints` JSONB, `submitter_label` (the DISPLAY name — never the email; the node was writing participants' JWT emails into world-readable `run_cards.submitter` for want of this column), `authorization_request_id` → `authorization_requests(request_id)`, and a server-DERIVED `phase`. (b) New `contest_phases` (windows + per-phase caps) with `contest_phases_guard` (non-overlap; no edit/delete once a window has started or the contest has entries) and `contest_active_phase(contest_id, at)`. (c) `authorization_request_admission_check()` (045) rewritten: a phased contest requires an OPEN phase (`REQUEST GUARD: no open phase …` — this is what a deadline IS under R2) and applies that phase's `max_submissions_per_day` / `max_submissions` per requester per contest; an un-phased contest falls back to `sealed_sets.request_daily_limit` unchanged. (d) `contest_submission_admission_check()` (052) rewritten: same 24/24h constant, plus the phase derived from the authorization request's `created_at`, refusing a disagreeing client-supplied phase; a companion `contest_submissions_entry_freeze` BEFORE UPDATE trigger stops an UPDATE walking past that derivation. (e) `contest_lifecycle_guard()` (072) rewritten keeping everything it did, plus twelve PROMISE keys vocabulary-checked at write time and frozen once the contest has entries, and `human_eval_selection` as the only metadata key writable after close. (f) New `contest_deferred_results` (withheld scored cards; `run_card_row` immutable, `published_run_card_id` set-once). (g) `authorization_requests.execution_diagnostics` JSONB (counts-only) + the 038 guard adjusted so it is the one column writable after a decision. (h) `shared_tasks.report_url` / `report_generated_at`, exempt from the 047 identity freeze. (i) `tickets.kind` gains `flag` and `tickets.subject_run_card_id` (uuid shape, **no FK** — a flag must survive the row it names). Python SSOT: `mt_eval_harness/contest_policy.py`, parity-tested by `arena/tests/test_contest_entries_migration.py`. Validated 2026-09-06 on the local Supabase stack (001 → 074 from nothing, `sanity.sql` green, 36 psql probes) and **applied to prod 2026-09-07** (`mt-eval-arena/supabase/migrations/README.md`) |
| 075 | **`authorization_requests` gains a terminal `completed` state**, reachable only from `authorized`. The `authorization_requests_state_check` CHECK is dropped and re-added with the fifth value (same name); `reject_illegal_request_transition()` is re-issued from 074's body with one more edge, `authorized → completed`. `completed` means the result was RECORDED — published to `run_cards` or withheld into `contest_deferred_results` — not that the method ran: a failed or refused run records nothing and stays `authorized`. It moves done-ness from a marker file on the air-gap exchange medium onto the row, so a relay pass against a fresh drive no longer re-exports a finished request. Additive, no backfill, wrapped in `BEGIN … COMMIT`. **Applied to prod 2026-09-28** |
| 076 | **`rankable_metrics` + computation promises** (founder ruling 2026-09-27: the ranking metric is contest configuration). New `rankable_metrics` table (public-read, service-role write) seeded with the 8 `shared/metric-registry.json` entries that carry a `ranking` block. `contest_lifecycle_guard()` re-issued from 074's text with three changes: `primary_metric` must name a row of the table (072/074 allowed four fixed ids); `metric_signature`, `harness_version` and `declared_power` join the frozen PROMISE keys (fifteen in all); the two strings must be non-empty and `declared_power` must be an object with an integer `n_segments ≥ 1`. **Applied to prod 2026-09-28** |
| 077 | **Scoring standard/1 beneath every client** (founder ruling 2026-10-04: the composite is retired). `rankable_metrics` gains `retired_at` + `retired_reason` (paired by CHECK `rankable_metrics_retired_pair`); `composite` is marked retired and relabelled "Legacy composite (retired)". `qualifiers.metric` defaults to `chrf_plus_plus` (042: `composite`). New `retired_metric_guard()` on two triggers — `contests_retired_metric_guard` and `qualifiers_retired_metric_guard` — refuses a retired metric as a NEW contest `metadata.primary_metric` or a NEW qualifier `metric`; rows that already recorded it keep it. 076's guard is not re-issued. **Applied to prod 2026-10-05** (the migrations README row does not record this yet) |
| 078 | **Comment-only**: re-issues `COMMENT ON TABLE public.shared_tasks` and `COMMENT ON COLUMN public.shared_tasks.shared_task_id` with the fictional example slug `example-task-2026`. 047's text named a real shared task's future edition, and PostgREST serves catalog comments in its API description. No table, column, policy or function changes. **Applied to prod 2026-10-12** (ledger `20261012091829`) |
| 079 | **Registered projects ("Join a project")**: four tables — `projects` (the public face; no email), `project_owners` (private; written only by a SECURITY DEFINER trigger at birth), `project_asks`, `project_offers` (a helper's file offer, private to the helper and the owner) — five guard/trigger functions, 11 table policies, and the private `project-offers` storage bucket with 2 storage policies (upload into your own folder; read by helper or owner; no UPDATE or DELETE). A project is born `pending_review`; owners edit (back to review) or close; the curator lists, pauses or declines (with a reason) through service_role. Offers move `offered → accepted \| declined \| withdrawn`, once. On prod a helper is keyed by their **JWT email** in `project_offers.submitted_by` and in the storage path, and a withdrawn or declined offer only flips `status` — the file stays in the bucket. **Applied to prod 2026-10-12** |
| 080 | **Join a project: a helper is never known by email — DRAFTED, NOT APPLIED ANYWHERE** (waits on the founder's go-ahead; exercised only on a local PostgreSQL 16 stand-in). Would make `project_offers.submitted_by` the helper's auth user id (the JWT `sub`), set by a new BEFORE INSERT trigger from the caller's own token; re-key the helper half of the offer and storage policies, and the storage folder, by that id; and add two storage DELETE policies (the helper removes a withdrawn, declined or never-offered file in their own folder; the owner removes a declined offer's file). It refuses to apply while any offer row is still keyed by an email |

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

> **068–079 on production, in apply order:** 069 on 2026-08-18; 068 and 071
> by 2026-08-28; 073 on 2026-09-06; 072 then 074 on 2026-09-07; 075 and 076 on
> 2026-09-28; 077 on 2026-10-05; 078, 070 and 079 on 2026-10-12. **070 sat
> out of file order for about 7 weeks** — 071–077 were applied while it was
> absent, and 064's compiled literal did its job in the meantime. Like 061/062,
> ledger order and file order differ here. **080 is applied nowhere.**

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
| `run_cards_quarantine_guard` | 022 (+ 064, 070) | `run_cards` | Any run against a dataset with `datasets.quarantined = true`, plus the id-shape backstop for unregistered known-improper slice ids. Since **070** the shapes are rows of `quarantined_id_patterns`, matched with `~*`, not a literal in the function body |
| `run_cards_score_integrity` | 023 | `run_cards` | Out-of-range metrics ([0,1] rates, [0,100] chrF++/COMET), inverted CIs, non-positive `corpus_size`, vacuous runs (`overall.evaluated <= 0`), unknown `quality_tier` |
| `run_cards_sha_parity_guard` | 026 | `run_cards` | A run whose claimed corpus sha (`run_card->dataset->sha256`) ≠ the curator-pinned `datasets.sha256` (skips silently when either sha is absent — those runs never verify/rank) |
| `run_card_entries_content_guard` | 033 (+ 068) | `run_card_entries` | Per-entry corpus CONTENT for quarantined datasets, sealed segments (`held_out`/`gold_standard`), non-redistribution-cleared licenses, or **unregistered corpora (fail-safe)**. Mirrors `publish.py _entry_content_publishable`; parity asserted by `arena/tests/test_content_guard_migration.py`. Since **068** the license test is an anchored prefix match (a string clears only if it STARTS WITH a permissive family) |
| `run_cards_regenerate_queue` | 036 | `run_cards` | Nothing — AFTER-statement fire-and-forget pg_net POST to the `regenerate-queue` edge function on INSERT / UPDATE OF trust (no-op until the Vault secrets exist) |
| `authorization_requests_transition_guard` | 038 + 074 + 075 | `authorization_requests` | Any edit to a request's frozen terms; any state transition outside `pending → {authorized, denied, expired}` and `authorized → {expired, completed}` (`completed` added by **075**; `denied`/`expired`/`completed` are terminal). **074**: once `decided_at` is set, `request_id`/`threshold`/`requested_by`/`created_at` are frozen too (but see D17) |
| `contests_corpus_guard` | 041 (+ 064, 070) | `contests` | A `lane='sealed'` contest whose `corpus_id` is not a registered **active** `sealed_sets` row (fail-closed); a `lane='standard'` contest naming a sealed set, a quarantined dataset, or a known-improper slice id (since **070**: any id matching a row of `quarantined_id_patterns` — the same rows the 022 guard reads). Does NOT modify the 022 `run_cards` guard |
| `auth_grants_bind_guard` | 039 | `auth_grants` | A grant minted for a non-existent or non-`authorized` request; fingerprint/sealed-set mismatch vs the request; born-expired or born-used grants; any edit to frozen grant terms; un-using a used grant |
| `authorization_audit_log_chain` | 040 | `authorization_audit_log` | Nothing — BEFORE INSERT computes `prev_hash`/`row_hash` (advisory-locked linear chain; client-supplied hashes are overwritten) |
| `authorization_audit_log_immutable` | 040 | `authorization_audit_log` | **Every** UPDATE and DELETE — the log is strictly append-only |
| `qualifiers_terms_guard` | 042 | `qualifiers` | Any edit to a qualifier's frozen terms (id/corpus/sealed-set/threshold/metric/year); any status change other than one-way `active → frozen` |
| `contest_intake_admission_guard` | 043 | `contest_intake` | An intake for a closed contest or one with `intake_open = false`; submissions past the rolling-24h `intake_daily_limit`; any born-state other than `received` |
| `contest_intake_transition_guard` | 043 | `contest_intake` | Any edit to an intake's frozen identity/digests; lifecycle transitions outside the one-way state machine; a `rejected` row without a `reject_reason` |
| `authorization_requests_admission_guard` | 045 + 074 | `authorization_requests` | A request against an inactive sealed set; born non-pending/decided requests; requests past the rolling-24h `request_daily_limit`. **074**: when the sealed set belongs to an open, phase-declaring contest, a request outside every window (`REQUEST GUARD: no open phase …`) and requests past that phase's `max_submissions_per_day` / `max_submissions` |
| `sealed_sets_admission_guard` | 046 | `sealed_sets` | A self-serve registration born un-quarantined or outside `planned`/`active`; more than 24 registrations per creator per 24h |
| `qualifiers_admission_guard` | 046 | `qualifiers` | A qualifier born non-`active`, gating a nonexistent/retired sealed set, or past the per-creator throttle |
| `shared_tasks_identity_guard` | 047 | `shared_tasks` | Any edit to a shared task's frozen slug/year/created_at; any status change other than one-way `active → archived` |
| `run_cards_content_guard` | 051 | `run_cards` | Oversized text columns; a non-object or > 1 MB `run_card`; and, for corpora that are NOT redistribution-cleared (unregistered / NC / ND / unknown — 033's fail-safe resolution), any `run_card` violating the strict aggregate-only shape (> 256 KB, string leaves > 2 k chars except top-level `system_prompt_used` ≤ 64 KB, arrays > 512, text-bearing array-objects — the per-entry-dump shape) |
| `contests_admission_guard` | 052 | `contests` | A contest born non-`open` or with an empty `created_by`; more than 24 creations per creator per rolling 24h. Server-stamps `created_at` |
| `contest_submissions_admission_guard` | 052 + 074 | `contest_submissions` | An empty `submitted_by`; more than 24 submissions per (submitter, contest) per rolling 24h. Server-stamps `submitted_at`. **074**: derives `phase` from the named authorization request's `created_at` and refuses a disagreeing client-supplied `phase` |
| `contests_use_context_guard` | 053 | `contests` | A `use_context='commercial'` standard-lane contest over an unregistered dataset (license unknown → fail-safe) or one whose license is not commercial-safe (NC / SA / ND / copyleft / unstated / restricted). Sealed + non-commercial lanes pass through (041 owns those rules) |
| `contests_lifecycle_guard` | 072 + 074 + 076 | `contests` | Any edit to a contest's frozen identity (`id`/`corpus_id`/`language_pair`/`lane`/`use_context`/`created_by`/`created_at`; `shared_task_id` re-pointed or detached); any status change other than one-way `open → closed → archived`; a close without a `metadata.final_ranking` object; any edit to `final_ranking`/`closed_at`/`closed_by` or an `intake_open=true` after close; a `metadata.primary_metric` that is not a row of `rankable_metrics` (**076**; 072/074 allowed only `chrf_plus_plus \| bleu \| comet_score \| composite`) or that changes once entries exist; a malformed or changed PROMISE key (fifteen since 076); any metadata change after close except `human_eval_selection`; result keys at INSERT. Forces `intake_open=false` and server-stamps `metadata.closed_at` on close. **On prod since 2026-09-07; 076's body on prod since 2026-09-28** — full rules under "Objects CHANGED by migrations 068–080" |
| `contests_retired_metric_guard` | 077 | `contests` | A NEW `metadata.primary_metric` (INSERT, or an UPDATE that changes it) naming a `rankable_metrics` row with `retired_at` set (`composite` today). A contest that already recorded it keeps it. **On prod since 2026-10-05** |
| `qualifiers_retired_metric_guard` | 077 | `qualifiers` | A NEW `metric` naming a retired `rankable_metrics` row. **On prod since 2026-10-05** |
| `projects_admission_guard` | 079 | `projects` | A project born in any status but `pending_review`; `listed_at` or `review_note` set at birth; more than 5 registrations per JWT email per rolling 24 h (counted in `project_owners`; skipped when the token has no email — D19). **On prod since 2026-10-12** |
| `projects_bind_owner` | 079 | `projects` | Nothing — AFTER INSERT, SECURITY DEFINER: writes the `project_owners` row (`created_by` = the JWT email) in the same transaction. No email → no owner row. **On prod since 2026-10-12** |
| `projects_transition_guard` | 079 | `projects` | Any edit to `id`/`slug`/`source_code`/`target_code`/`created_at`; any UPDATE of a `closed` project; status moves outside: any → `closed`, `listed`/`paused`/`declined` → `pending_review`, `pending_review`/`paused` → `listed`, `pending_review` → `declined` (needs a `review_note`), `listed` → `paused`; a public-text edit that leaves the project `listed` or `paused`. Stamps `listed_at` (first listing only) and `updated_at`. **On prod since 2026-10-12** |
| `project_offers_admission_guard` | 079 (080 re-issues, drafted) | `project_offers` | An offer born in any status but `offered` or with a `decline_reason`; an offer to a project that is not `listed`; a named ask that is not an open ask of that project; a `storage_path` other than `<slug>/<submitted_by>/<offer_id>/<file_name>`; more than 24 offers per `submitted_by` per rolling 24 h. **On prod since 2026-10-12** |
| `project_offers_transition_guard` | 079 | `project_offers` | Any edit to an offer's identity, file or terms (everything but `status`, `decline_reason`, `updated_at`); status moves other than `offered → accepted \| declined \| withdrawn`, once; a `decline_reason` change without a status change. **On prod since 2026-10-12** |
| `project_offers_aa_set_helper` | 080 (**drafted, not applied**) | `project_offers` | Nothing — BEFORE INSERT, would overwrite `submitted_by` with the JWT `sub` (the auth user id) whenever the claim is present, before the admission guard runs (name order). **Not on any database yet** |
| `contest_phases_guard` | 074 | `contest_phases` | A window overlapping another window of the same contest; any UPDATE or DELETE of a window that has already started, or of any window of a contest that already has entries. Server-stamps `created_at`. INSERT is checked for overlap only (D23). **On prod since 2026-09-07** |
| `contest_submissions_entry_freeze` | 074 | `contest_submissions` | Any UPDATE of what the SERVER said about an entry — `contest_id`/`run_card_id`/`submitted_by`/`submitted_at`, the bound `authorization_request_id`, or the derived `phase`. Participant-authored declarations (`description`, `track`, `constraints`, `submitter_label`, `is_primary`) stay editable. **On prod since 2026-09-07** |
| `contest_deferred_results_guard` | 074 | `contest_deferred_results` | Any edit to a withheld card's identity or its `run_card_row`; clearing or re-pointing `published_run_card_id` once set. **On prod since 2026-09-07** |
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
| `composite_score` | REAL | YES | — | `publish.py` | **Retired 2026-10-04 (scoring standard/1): NULL on every new card.** Historical rows keep their 0.0–1.0 weighted composite ("legacy composite (retired)"; formula kept in `mt_eval_harness/scoring.py` for verifying them). The headline is `chrf_plus_plus` + `chrf_ci_lower`/`chrf_ci_upper` |
| `quality_tier` | TEXT | YES | — | `publish.py` | **Retired 2026-10-04: NULL on every new card** (no quality labels on automatic scores). Historical rows keep their label — trigger-enforced vocabulary: `baseline/emerging/functional/deployable/fluent/unscored` |
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
| `composite_ci_lower` / `composite_ci_upper` | REAL | YES | — | `publish.py` | Legacy composite CI — NULL on every new card (retired 2026-10-04) |
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
| `run_card_entries_content_guard` | BEFORE INSERT/UPDATE | Un-bypassable corpus-content gate (migration 033). Resolves the entry's corpus via `run_card_id → run_cards.dataset_id → datasets`, then rejects the insert when the dataset is quarantined, `segment` is `held_out`/`gold_standard`, the dataset license is not redistribution-cleared (`is_license_redistributable()` — an anchored prefix match since migration 068), or **no datasets row resolves** (fail-safe — stricter than the Python client). Mirrors `publish.py _entry_content_publishable`; `service_role` bypasses RLS but **not** triggers, so this also covers curator/CI inserts. The aggregate run_card still publishes (scores-only) |

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
| `metadata` | JSONB | YES | `'{}'` | The competition half's contest DATA (written by `mt_eval_harness/contest.py`, guarded by migration 072). Documented keys: **`primary_metric`** — the metric `contest rank`/`close` rank on. Since **076** it must name a row of `rankable_metrics` (8 seeded; 072/074 allowed only `chrf_plus_plus \| bleu \| comet_score \| composite`); since **077** a retired metric (`composite`) is refused as a NEW choice, while a contest that already recorded it keeps it. Written at create, frozen by 072 once any entry exists; **`final_ranking`** — the frozen ranking dict written by `contest close` (the `contest_rank.build_ranking` shape: `metric`, `metric_source`, `tiebreak_order`, `trust_policy`, `ranking_method{tie_test,n_resamples,alpha,seed,evidence_used,note}`, `entries[]` with `rank`/`tie_group`/`tie_evidence`, `unscored`, `excluded`, `other_sets`, `pending_intake`, `rejected_intake`, `frozen=true`); **`closed_at`** — server-stamped by 072 on the close transition (the client also writes it for pre-072 databases); **`closed_by`** — the closing owner's JWT email. **Migration 074 adds the PROMISE keys** — vocabulary-checked at write time and FROZEN once the contest has entries (a `contest_submissions` row, a `contest_intake` row, or an `authorization_requests` row against any of the contest's sealed sets): **`tie_test`** (`ar \| bootstrap`), **`alpha`** (number in (0,1)), **`n_resamples`** (integer ≥ 1), **`seed`**, **`require_description`** (bool), **`prize_terms`** (object; under R1 its condition is handover of the method to the host), **`test_suites`** (array of `{suite_id, corpus_card_id, publisher, url, sha256}` with a 64-hex sha), **`anonymize_until_close`** (bool), **`results_visibility`** (`immediate \| hidden_until_close`), **`allowed_tracks`** (⊆ `constrained \| unconstrained`), **`open_weight_only`** (bool), **`sealed_holdout_set_id`** (a registered `sealed_sets` id). **Migration 076 adds three more**, frozen the same way — **`metric_signature`** and **`harness_version`** (non-empty strings: the exact computation promised, e.g. a sacreBLEU signature or a neural model id, and the harness version that scores entries; recorded by `mt-eval contest create`) and **`declared_power`** (an object with an integer `n_segments ≥ 1`: what the significance test can resolve, stated before the contest opens) — fifteen frozen keys in all. `prize_terms` is validated in detail (disposition and its overrides) — see "Objects CHANGED by migrations 068–080". After close, **`human_eval_selection`** is the ONLY metadata key that may still change (the selection is drawn FROM the frozen ranking). Python SSOT for these vocabularies: `mt_eval_harness/contest_policy.py`. Every other key is free-form; the website reads only fixed columns |
| `created_at` | TIMESTAMPTZ | YES | `now()` | DB; **server-stamped** on INSERT by the 052 admission trigger (throttle-window integrity); frozen thereafter (072) |

### Triggers

| Trigger | Timing | Effect |
|---------|--------|--------|
| `contests_corpus_guard` | BEFORE INSERT/UPDATE | Contest eligibility at the data layer (migration 041): `lane='sealed'` requires a registered **active** `sealed_sets` row (fail-closed — no registration or a planned/retired set rejects); `lane='standard'` rejects sealed sets, quarantined datasets (022 doctrine, unchanged), and the migration-022 known-improper slice-id regex (byte-identical backstop). Re-checks only when `corpus_id`/`lane` change, so lifecycle updates (close/archive) are never blocked. `service_role` does not bypass triggers |
| `contests_admission_guard` | BEFORE INSERT | Born `'open'` with a non-empty `created_by`; server-stamps `created_at`; rolling-24h per-creator birth throttle (constant 24 — the 046 rationale). Migration 052 |
| `contests_use_context_guard` | BEFORE INSERT/UPDATE | The use-context eligibility rule at the data layer (migration 053): a `use_context='commercial'` standard-lane contest requires a registered dataset with a commercial-safe license (`is_license_commercial_safe`); unregistered → fail-safe refusal. Sealed + non-commercial lanes pass through. Re-checks only when `corpus_id`/`use_context`/`lane` change |
| `contests_lifecycle_guard` | BEFORE INSERT/UPDATE | Lifecycle discipline (migration 072): identity freeze (`id`/`corpus_id`/`language_pair`/`lane`/`use_context`/`created_by`/`created_at`; `shared_task_id` attaches once); one-way `open → closed → archived`; a close REQUIRES `metadata.final_ranking` (object), FORCES `intake_open=false`, server-stamps `metadata.closed_at`; `final_ranking`/`closed_at`/`closed_by` immutable and intake pinned shut after close; `metadata.primary_metric` vocabulary-checked and frozen once any `contest_submissions`/`contest_intake` row exists; no result keys at INSERT or while open. **074 rewrote the same function**, keeping all of that and adding: the twelve PROMISE keys above, vocabulary-checked at write time and frozen once the contest has entries (entries now also count an `authorization_requests` row against the contest's sealed sets — under R2 the request IS the entry), and `human_eval_selection` as the only metadata key writable after close. **076 rewrote it again**: `primary_metric` is checked against the `rankable_metrics` table, and `metric_signature`/`harness_version`/`declared_power` join the frozen keys (fifteen). Client mirror: `contest.py` `set_intake` / `close_contest`. **On prod since 2026-09-07; 076's body on prod since 2026-09-28** |
| `contests_retired_metric_guard` | BEFORE INSERT / UPDATE OF metadata | `retired_metric_guard()` (migration 077): refuses a NEW `metadata.primary_metric` that names a retired `rankable_metrics` row — `RETIRED METRIC GUARD: '%' is retired for new contests (%). Choose chrf_plus_plus (the default) or another open metric: %.` An unchanged recorded value passes. **On prod since 2026-10-05** |

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
| `is_primary` | BOOLEAN | NOT NULL | `true` | 074 — THE entry a team stands behind. Contrastive entries are `false` and are ranked in their own section, never as winners |
| `track` | TEXT | NOT NULL | `'unconstrained'` | 074 — `constrained \| unconstrained`, the resource track the entry DECLARES. Defaults to the looser value: an undeclared entry is never silently promoted into the stricter track |
| `description` | TEXT | YES | — | 074 — the participant's system description (≤ 4000 chars). `metadata.require_description` makes its absence an EXCLUSION from the ranking, never a silent drop |
| `method_release_url` | TEXT | YES | — | 074 — optional public pointer to the released method (http/https, ≤ 2048). Public information, **never** the prize gate: under R1 the condition is HANDOVER of the method to the sovereign host |
| `constraints` | JSONB | NOT NULL | `'{}'` | 074 — the declared constraints object (`track`, `parameterCount`, `weightsLicense`, `weightsPublic`, `trainingData`). Declarations, not measurements |
| `submitter_label` | TEXT | YES | — | 074 — the participant's chosen DISPLAY name (≤ 200). **Never the email**; `submitted_by` keeps the identity |
| `authorization_request_id` | TEXT | YES | — | 074 — FK to `authorization_requests.request_id`: the authorized, node-executed run this entry came from (the R2 entry path). NULL for legacy rows from the retired self-reported lanes |
| `phase` | TEXT | YES | — | 074 — `practice \| evaluation \| post-evaluation`, **DERIVED by the server** from the authorization request's `created_at` against the contest's windows. NULL when the contest declares no phases; a disagreeing client-supplied value is refused |

Constraints: `UNIQUE (contest_id, run_card_id)`.
Indexes: `idx_cs_contest`, `idx_cs_run_card`,
`idx_cs_submitter (contest_id, submitted_by, submitted_at)` (052),
`idx_cs_one_primary` (074, UNIQUE on `(contest_id, COALESCE(team, submitted_by))
WHERE is_primary` — one primary per team),
`idx_cs_auth_request` (074).

Triggers: `contest_submissions_admission_guard` (052 + 074, BEFORE INSERT) —
non-empty `submitted_by`, server-stamped `submitted_at`, rolling-24h
per-(submitter, contest) throttle (constant 24), and the phase derived from
the named authorization request (refusing a disagreeing claim);
`contest_submissions_entry_freeze` (074, BEFORE UPDATE) — the identity
columns, the bound `authorization_request_id` and the derived `phase` cannot
be rewritten by a later UPDATE.

RLS: "Read own or public submissions" (public contest, own submission, or
contest creator); `contest_submissions_submit_own` (052, replaced the unbound
"Authenticated submit") — INSERT for authenticated only when `submitted_by` =
the JWT email AND the target contest is `open` and visible-for-submission
(public/private: any authenticated submitter — the 008 privacy model hides
private *scores*, not the door; team: creator-only, fail-closed, until team
membership exists as a JWT claim).

---

## Table: `contest_phases` (074)

The phase windows of a sovereign contest, and what "the deadline" means. A
contest that declares phases is deadline-enforced at the METHOD door: an
authorization request outside every window is refused by the database
(`REQUEST GUARD: no open phase …`), which under R2 — where an entry IS an
authorized, node-executed run — is exactly what a submission deadline is.

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| `id` | BIGINT PK | identity |
| `contest_id` | TEXT NOT NULL | FK → `contests(id)` ON DELETE CASCADE |
| `name` | TEXT NOT NULL | CHECK `practice \| evaluation \| post-evaluation` (SSOT `contest_policy.PHASE_NAMES`) |
| `starts_at` / `ends_at` | TIMESTAMPTZ NOT NULL | CHECK `ends_at > starts_at`; the window is half-open `[starts_at, ends_at)` |
| `max_submissions` | INT | NULL = uncapped. Authorized runs per requester per contest for the WHOLE window |
| `max_submissions_per_day` | INT | NULL = uncapped. Rolling-24h cap inside the window; replaces `sealed_sets.request_daily_limit` for phased contests |
| `created_at` | TIMESTAMPTZ NOT NULL | server-stamped by the guard |

Constraints: `UNIQUE (contest_id, name)`. Index: `idx_contest_phases_window`.

Trigger `contest_phases_guard` (BEFORE INSERT/UPDATE/DELETE): windows never
overlap within a contest; a window that has STARTED, and every window of a
contest that already has entries, can be neither edited nor deleted — a
deadline that can be moved after the fact is not a deadline. INSERT is
checked for overlap only: a new window may start in the past, or be added
after entries exist (D23).

Helper functions: `contest_active_phase(contest_id, at DEFAULT now())`
→ the covering `contest_phases` row or NULL; `contest_sealed_set_ids(contest_id)`
→ `corpus_id` plus `metadata.sealed_holdout_set_id`;
`contest_for_sealed_set(sealed_set_id)` → the open, phase-declaring contest that
owns a sealed set (NULL = the un-phased 045 fallback path; RAISES when two open
phased contests target the same set, because which window governs would
otherwise be a coin toss).

RLS: public SELECT (the schedule is an announcement); INSERT for the contest
owner (`contests.created_by` = the JWT email); no anon writes.

---

## Table: `contest_deferred_results` (074)

Scored run cards WITHHELD under `contests.metadata.results_visibility =
hidden_until_close` (and every holdout-split result, always). The row is
written when the sealed run finishes and published verbatim by
`mt-eval contest close` before the ranking is frozen — so "no feedback at
submission time" costs a participant a wait, never a run.

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| `request_id` | TEXT PK | the `authorization_requests` row whose run produced this card |
| `contest_id` | TEXT NOT NULL | FK → `contests(id)` |
| `sealed_set_id` | TEXT NOT NULL | which sealed set was scored |
| `role` | TEXT NOT NULL | CHECK `main \| holdout` (SSOT `contest_policy.DEFERRED_ROLES`). A holdout result is ALWAYS deferred, whatever `results_visibility` says |
| `run_card_row` | JSONB NOT NULL | the aggregate scores-only `run_cards` row, held verbatim. **Immutable after insert** |
| `deferred_at` | TIMESTAMPTZ | DEFAULT `now()` |
| `published_run_card_id` | TEXT | set ONCE at close; never cleared, never re-pointed |
| `published_at` | TIMESTAMPTZ | |

Index: `idx_deferred_unpublished` (partial on `contest_id`, `WHERE published_run_card_id IS NULL`).
`request_id` and `sealed_set_id` carry no foreign key (D26).
Trigger: `contest_deferred_results_guard` (BEFORE UPDATE) — freezes
`request_id`/`contest_id`/`sealed_set_id`/`role`/`deferred_at` and
`run_card_row`; `published_run_card_id` is set once. Messages begin
`DEFERRED RESULT GUARD:`.
RLS: **no anon policy**; SELECT for the contest owner (`created_by` = the JWT
email); `service_role` writes.

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

Since migration **069** the vocabulary no longer rides in `detail`: it lives
in `trading_card_vocabulary` (see "Tables added by migrations 068–080"). A
database without 069 still carries it inline.

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
| `state` | TEXT NOT NULL DEFAULT 'pending' | CHECK `authorization_requests_state_check`: `('pending', 'authorized', 'denied', 'expired', 'completed')` — `completed` added by **075**: the result was RECORDED (published to `run_cards` or withheld in `contest_deferred_results`), not merely run |
| `fingerprint` | TEXT NOT NULL | SHA-256 of `(method_sha \n corpus_id \n corpus_version \n 'scores-only' \n node_measurement)` — computed by `queue_runner.compute_request_fingerprint`, recomputable from the component columns |
| `method_sha` / `corpus_id` / `corpus_version` / `node_measurement` | TEXT NOT NULL | The fingerprint inputs, stored individually for inspection |
| `emit` | TEXT NOT NULL DEFAULT 'scores-only' | CHECK `(emit = 'scores-only')` — only scores ever leave a sealed run |
| `threshold` | TEXT DEFAULT '3 of 5' | Documentary M-of-N parameters |
| `requested_by` | TEXT | Proposer (proposing ≠ authorizing) |
| `created_at` / `decided_at` | TIMESTAMPTZ | |
| `execution_diagnostics` | JSONB | **074** — COUNTS-ONLY diagnostics from the node's attempt at this request (stage reached, counts, timings, exit codes): the honest substitute for "review before unblinding", since outputs never leave the node but a participant may still be told WHY a run failed. Never per-entry text |

Trigger: `authorization_requests_transition_guard` (BEFORE UPDATE) — freezes
fingerprint/method/corpus/version/node/sealed_set/emit after creation; allows
only `pending → {authorized, denied, expired}` and `authorized → expired`.
**074** additionally closes the decision record: once `decided_at` is set,
`execution_diagnostics` is the ONE column that may still be written (plus a
lapse to `expired` under the same state machine). **075** adds the terminal
edge `authorized → completed`; nothing leaves `completed`. The live body is
075's (see "Objects CHANGED by migrations 068–080"; `decided_at` itself is
not frozen — D17).

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
| `rank_mode` | TEXT | NOT NULL | — | ranker | Which ordering set this row's priority. **CHECK** `(rank_mode IN ('map','ecv','edv'))` — `edv` (expected-decision-value) added by **071** |
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
| `condition` | TEXT | NOT NULL | — | ranker | = `run_cards.condition`. **CHECK** `(condition IN ('naive','coached','engine'))` — `engine` (non-LLM MT services: the generator's `ENGINE_CONDITION` sentinel) added by **071** |
| `est_cost_usd` | NUMERIC | YES | — | ranker | `queue_pairs()` reports the per-pair `min()` |
| `est_basis` | TEXT | YES | — | ranker | How the estimate was derived |
| `run_command` | TEXT | YES | — | ranker | Copy-pasteable `mt-eval run …` |
| `map_value` | NUMERIC | YES | — | ranker | The generic rank value since **071**: `map_value` for `map` rows, `edv_value` for `edv` rows (the row's `rank_mode` says which); NULL in ecv. Full derivations stay in `diagnostics` |
| `diagnostics` | JSONB | NOT NULL | `'{}'::jsonb` | ranker | Every non-column field — full ecv/map re-derivability inputs plus served extras (e.g. a restricted corpus's `transmission` block), so nothing is lost against `queue.json` |
| `generation_id` | TEXT | NOT NULL | — | ranker | Stamps one full ranker run; the swap key |
| `generated_at` | TIMESTAMPTZ | NOT NULL | `now()` | DB | |

#### Constraints

```sql
PRIMARY KEY (id)                                            -- queue_items_pkey
CHECK (condition IN ('naive','coached','engine'))           -- queue_items_condition_check (059; widened by 071)
CHECK (rank_mode IN ('map','ecv','edv'))                    -- queue_items_rank_mode_check (059; widened by 071)
```

071 drops and re-adds both CHECKs under the names PostgreSQL generated for
059's inline constraints, so the names are unchanged.

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
idx_queue_items_mode_pair_cover ON (rank_mode, language_pair)        -- 073: queue_pairs' group key
                                INCLUDE (est_cost_usd, corpus_id, model, condition)
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
`EXECUTE` granted to `anon, authenticated` (059); **073** revoked the default
PUBLIC grant and re-granted `anon, authenticated, service_role` (D4 closed). Consumers:
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

**Community flagging (`kind='flag'`, migration 074).** The same door also
carries flags against published results. A reader who believes a leaderboard
run card is wrong — contaminated corpus, a metric that does not match its
label, a misattributed method — files a flag naming that card in
`subject_run_card_id`. Contest entries and ordinary board rows are flagged
alike; both are run cards.

Three properties make this a report rather than a vote:

- **No count is ever public.** Not on the row, not in the run card, not in any
  API response. A visible tally would be worth gaming, and a result's standing
  has to rest on evidence rather than on how many people objected. RLS
  (deny-all below `service_role`) is what enforces it: nothing can read this
  table to build a count in the first place.
- **The only visible outcome is one column.** An upheld flag ends as
  `run_cards.trust = 'disqualified'` (021's vocabulary), for a cause that was
  added to the public submission rules **by a dated edit first** — so a flag
  can never produce a secret or retroactive rule. The card is not deleted (the
  no-retractions rule); a delisted run stays visible, marked.
- **The subject is never verified at intake.** `submit-ticket` holds the
  service role and deliberately does not read `run_cards`, so a flag against an
  id that does not exist — or no longer exists — is accepted and triaged. That
  is also why the column carries **no foreign key**: a flag has to survive the
  row it names, including a card removed by the very takedown the flag asked
  for.

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
| `kind` | TEXT | NOT NULL | `'question'` | edge fn | Sender's classification; drives triage + email urgency. **CHECK** `(kind IN ('takedown','objection','correction','question','flag','other'))` — `flag` added by **074** (the community flagging lane). Python SSOT `mt_eval_harness/contest_policy.TICKET_KINDS`; the Deno half is `functions/submit-ticket/lib.ts` |
| `locale` | TEXT | YES | — | edge fn | Site locale filed from (e.g. `'fil'`). **CHECK** `(locale IS NULL OR char_length(locale) <= 12)` |
| `page_url` | TEXT | YES | — | edge fn | Page the sender was on, if supplied. **CHECK** `(page_url IS NULL OR char_length(page_url) <= 2048)` |
| `message` | TEXT | NOT NULL | — | edge fn | The one required piece of content. **CHECK** `(char_length(message) BETWEEN 1 AND 8000)` |
| `contact_email` | TEXT | YES | — | edge fn | OPTIONAL reply-to; NULL = filed anonymously. **CHECK** `(contact_email IS NULL OR char_length(contact_email) <= 320)` (RFC 5321 max) |
| `ip_hash` | TEXT | NOT NULL | — | edge fn | Salted SHA-256 of the client IP; **the raw IP is never stored** |
| `source` | TEXT | NOT NULL | `'docent-form'` | edge fn | How it arrived; display/triage only. **CHECK** `(char_length(source) <= 40)` |
| `status` | TEXT | NOT NULL | `'new'` | staff | **CHECK** `(status IN ('new','ack','closed'))` |
| `emailed` | BOOLEAN | NOT NULL | `FALSE` | edge fn | `false` = row saved but the notification failed — the founder still has the ticket |
| `notes` | TEXT | YES | — | staff | Staff-only triage notes |
| `subject_run_card_id` | TEXT | YES | — | edge fn | **074** — the run card a `kind='flag'` ticket is about. **CHECK** `(subject_run_card_id IS NULL OR subject_run_card_id ~ '^[0-9a-f-]{36}$')`. Deliberately **no foreign key**: a flag must survive the row it names, including a card removed by the very takedown the flag asked for. Indexed by `idx_tickets_subject_run_card` (partial). No public count is ever surfaced; an upheld flag shows up only as `run_cards.trust='disqualified'`, with the cause added to the public rules by dated edit first |

#### Constraints

```sql
PRIMARY KEY (id)                                                     -- tickets_pkey
CHECK (kind IN ('takedown','objection','correction',
                'question','flag','other'))                          -- tickets_kind_check (074)
CHECK (status IN ('new','ack','closed'))                             -- tickets_status_check
CHECK (char_length(message) >= 1 AND char_length(message) <= 8000)   -- tickets_message_check
CHECK (contact_email IS NULL OR char_length(contact_email) <= 320)   -- tickets_contact_email_check
CHECK (page_url IS NULL OR char_length(page_url) <= 2048)            -- tickets_page_url_check
CHECK (locale IS NULL OR char_length(locale) <= 12)                  -- tickets_locale_check
CHECK (char_length(source) <= 40)                                    -- tickets_source_check
CHECK (subject_run_card_id IS NULL
       OR subject_run_card_id ~ '^[0-9a-f-]{36}$')                   -- 074; no FK, by design
```

The `kind` vocabulary is a four-way SSOT — this CHECK, `TICKET_KINDS` in
`functions/submit-ticket/lib.ts`, the ticket-type picker in the site's docent
client, and `mt_eval_harness.contest_policy.TICKET_KINDS` — held together by
`arena/tests/test_ticket_kinds_parity.py`, which reads all four. The
`subject_run_card_id` shape rule is spelled identically in the CHECK, the edge
function and the browser client, and that too is parity-tested.

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
idx_tickets_subject_run_card ON (subject_run_card_id)      -- 074; partial:
                                                           -- WHERE NOT NULL
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

## Tables added by migrations 068–080

068–080 add nine tables. Seven are here: `trading_card_vocabulary` (069),
`quarantined_id_patterns` (070), `rankable_metrics` (076, extended by 077),
and the four registered-project tables `projects`, `project_owners`,
`project_asks`, `project_offers` (079), plus the private `project-offers`
storage bucket (079). The other two, `contest_phases` and
`contest_deferred_results` (074), are documented above, next to `contests`. 080 adds no table; what it would change is at the
end of the `project_offers` part, marked **drafted, not applied**.

### Table: `trading_card_vocabulary` (069)

The vocabulary explorer's own table. Vocabulary was 70–95 % of every
`trading_card_detail.detail` blob — 2.4 MB of one 2.5 MB payload, and about
500 MB of detail staging in all, uploaded in 50-row batches because of
statement timeouts. Splitting it out shrinks the detail blobs by about 75 %
and lets the site fetch one code's forms when the vocabulary panel opens.
Nothing is truncated; every item stays reachable.

Provenance: each `items[]` entry carries the pinned release id from the atlas
forms sidecar (the retired legacy store had NULL release pins). Only forms
whose pinned license permits redistribution are staged — the ingest withholds
the rest at the source — and `sources[]` carries each license.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `code` | TEXT | NOT NULL | — | **PRIMARY KEY**; FK → `trading_card_index(code)` ON DELETE CASCADE |
| `items` | JSONB | NOT NULL | — | `[{concept, gloss, form, source, displayType, …}]` |
| `total_forms` | INTEGER | NOT NULL | — | |
| `sources` | JSONB | NOT NULL | — | `[{id, dataset, license, url, displayType, …}]` |
| `asjp_only` | BOOLEAN | NOT NULL | `false` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | No maintaining trigger |

Indexes: the primary key only. No triggers.

RLS: enabled; one policy, `"Allow anonymous read access on
trading_card_vocabulary"` — SELECT `TO anon USING (true)`. No write policy
(service_role writes). Like 012's two trading-card tables, the policy names
`anon` only, so a signed-in (`authenticated`) session reads no rows; the site
reads with the anon key. The policy is created without `DROP POLICY IF
EXISTS`, so re-running 069 fails (D27).

Writers and readers: `mt-eval-arena/scripts/upload-trading-cards.mjs`
(preflights the table and exits if it is missing);
`cli/website/scripts/build-data-from-supabase.mjs` (pages through it into
`tc-vocab/`, and warns rather than fails on a pre-069 database).

### Table: `quarantined_id_patterns` (070)

The improper-subset backstop as data (founder direction 2026-08-19: nothing
language-specific lives in code). Before 070 the four 2026-06-13 incident
shapes were a regex literal compiled into two function bodies (022 and 041,
anchored by 064) that had to stay byte-identical. One alternative named a
language, and a new incident in any language needed a prod migration. Now each
blocked shape is a row, and both guards read the same rows.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `pattern` | TEXT | NOT NULL | — | **PRIMARY KEY**. A PostgreSQL regex (ARE), matched case-insensitively with `~*` against the whole id. Unanchored: a row matches anywhere in the id unless it carries its own lookahead or anchor (D6) |
| `reason` | TEXT | NOT NULL | — | Why this shape may never rank |
| `recorded_by` | TEXT | NOT NULL | — | Who recorded it (founder/steward lane) |
| `recorded_at` | TIMESTAMPTZ | NOT NULL | `now()` | |

Seed — 4 rows, `recorded_by = 'founder 2026-06-13'`, `ON CONFLICT (pattern)
DO NOTHING` — 064's alternation split verbatim, one shape per row:

```
sample[-_]?62(?![0-9])
phase1[-_]?test
dev[-_]?124(?![0-9])
crk[-_]?master(?![-_]?[0-9])
```

RLS: enabled; `quarantined_id_patterns_public_read` — SELECT `USING (true)`
for every role. No write policy: service-role only. The read policy is
load-bearing. Both guards are SECURITY INVOKER and read the table under the
caller's role; without the policy, 054's event trigger would leave the table
deny-all and both guards would silently stop blocking.

Indexes: the primary key only. Each guard call tests every row with a regex
(4 rows today).

Posture: an empty table means "no shape backstop", not "block everything";
`datasets.quarantined` stays the primary, data-driven mechanism. Adding or
removing a shape is a service-role INSERT or DELETE and takes effect on the
next write — no migration. Nothing validates a row (D18).

Rollback (from the file): re-run 064, which restores both compiled literals;
the table can then be dropped on its own.

### Table: `rankable_metrics` (076 + 077)

The metrics a contest may rank on, as data (076; founder ruling 2026-09-27:
"contests should be able to rank on any metric whatsoever, that's a contest
config question"). It replaces the four ids hard-coded in 072/074's guard and
in `contest_rank.PRIMARY_METRICS`. Making another registered metric rankable
is an INSERT here plus a `ranking` block in `shared/metric-registry.json`,
never a new guard. Read by `contest_lifecycle_guard()` (076) and
`retired_metric_guard()` (077).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `metric_id` | TEXT | NOT NULL | — | **PRIMARY KEY**. **CHECK** `(metric_id ~ '^[a-z0-9][a-z0-9_]*$')` |
| `display_name` | TEXT | NOT NULL | — | |
| `direction` | TEXT | NOT NULL | — | **CHECK** `(direction IN ('higher','lower'))` |
| `recorded_by` | TEXT | NOT NULL | — | |
| `recorded_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `retired_at` | TIMESTAMPTZ | YES | — | **077**. When the metric was retired for NEW contests and qualifiers; NULL = open |
| `retired_reason` | TEXT | YES | — | **077**. Why, and what to choose instead — quoted verbatim in the refusal |

Constraint (077):

```sql
CHECK ((retired_at IS NULL) = (retired_reason IS NULL)
       AND (retired_reason IS NULL OR btrim(retired_reason) <> ''))  -- rankable_metrics_retired_pair
```

Seed (076; 8 rows, `recorded_by = 'shared/metric-registry.json ranking block'`,
`ON CONFLICT (metric_id) DO NOTHING`):

| `metric_id` | `display_name` | `direction` |
|-------------|----------------|-------------|
| `exact_match_rate` | Exact Match | higher |
| `chrf_plus_plus` | chrF++ | higher |
| `bleu` | BLEU | higher |
| `ter` | Translation Edit Rate | lower |
| `comet_score` | COMET / AfriCOMET | higher |
| `spbleu` | spBLEU (FLORES-200) | higher |
| `chrf_plain` | Plain chrF (word_order=0) | higher |
| `composite` | Composite Score (experimental) → **077**: "Legacy composite (retired)", `retired_at = 2026-10-04T00:00:00Z` | higher |

RLS: enabled; `rankable_metrics_public_read` — SELECT `USING (true)` for
every role. No write policy (service-role only). As with 070, the policy is
load-bearing: the guards read the table under the writer's role.

Retiring a metric is data: `UPDATE public.rankable_metrics SET retired_at =
now(), retired_reason = '…' WHERE metric_id = '…'`, plus a `retired` reason on
its registry ranking block. A retired row is never deleted (077's column
comment) — by convention only (D24).

Parity tests: `arena/tests/test_rankable_metrics_migration.py` (the seed equals
`rankable_metrics.RANKABLE_METRICS`) and
`arena/tests/test_retired_metrics_migration.py` (retired rows equal the
registry's `ranking.retired`).

### Registered projects (079; 080 drafted): `projects`, `project_owners`, `project_asks`, `project_offers`

"Join a project" (founder, 2026-10-12). A family, school or language office
building a translator on the rails registers a project: a language pair with
task parameters, and an owner. After a short review a curator lists it.
Helpers browse the list, see what the project asks for, and offer files
(sentences, a word list, a method). The owner accepts or declines each offer.
The tables hold descriptions and offer metadata, length-capped; an offered
file itself sits in the private `project-offers` bucket.

Who may do what follows the house split. Guard triggers bind everyone,
service_role included, to the legal transitions; no trigger checks the
caller's role. RLS decides who may make which move. The curator works through
service_role, which bypasses RLS but not the triggers.

All five 079 functions pin `SET search_path = public`. Only
`project_bind_owner()` is SECURITY DEFINER.

#### Table: `projects` (079)

The public face of a project. **No email in any column**: the owner's identity
lives in `project_owners`.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | BIGINT | NOT NULL | identity | **PRIMARY KEY**; frozen |
| `slug` | TEXT | NOT NULL | — | UNIQUE. **CHECK** `^[a-z0-9][a-z0-9-]{1,62}$` (2–63 chars); frozen |
| `display_name` | TEXT | NOT NULL | — | Trimmed length 1–80 chars |
| `owner_display` | TEXT | NOT NULL | — | The owner's name as shown; trimmed 1–80 chars |
| `source_code` | TEXT | NOT NULL | — | **CHECK** `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`; frozen |
| `source_name` | TEXT | YES | — | The language as its people name it; trimmed 1–80 chars |
| `target_code` | TEXT | NOT NULL | — | As `source_code`; frozen |
| `target_name` | TEXT | YES | — | As `source_name` |
| `purpose` | TEXT | NOT NULL | — | Task parameter; trimmed 1–300 chars |
| `domain` | TEXT | YES | — | Task parameter; trimmed 1–80 chars |
| `register` | TEXT | YES | — | Task parameter; trimmed 1–80 chars |
| `about` | TEXT | YES | — | ≤ 1,200 chars |
| `status` | TEXT | NOT NULL | `'pending_review'` | **CHECK** `pending_review \| listed \| declined \| paused \| closed` |
| `review_note` | TEXT | YES | — | ≤ 600 chars. The curator's note; required for a decline. Not protected after birth (D20) |
| `listed_at` | TIMESTAMPTZ | YES | — | Stamped on the FIRST listing and kept through pause and re-listing. Not protected after birth (D20) |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Frozen |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Stamped by the transition guard on every UPDATE |

Constraints:

```sql
CONSTRAINT projects_private_use_named CHECK (
    (source_code !~ '^q[a-t][a-z]$' OR source_name IS NOT NULL)
    AND (target_code !~ '^q[a-t][a-z]$' OR target_name IS NOT NULL))
    -- a private-use code (qaa–qtz) must carry its name
CONSTRAINT projects_pair_distinct CHECK (source_code <> target_code
    OR coalesce(source_name, '') <> coalesce(target_name, ''))
    -- two varieties under one code are allowed only when their names differ
```

Index: `idx_projects_status ON (status, listed_at)`.

Triggers:

| Trigger | Timing | Effect |
|---------|--------|--------|
| `projects_admission_guard` | BEFORE INSERT | `project_admission_check()`. Born `pending_review` — else `PROJECT GUARD: a project is born pending_review (got %) — it is listed only after review.` `listed_at` and `review_note` must be NULL — else `PROJECT GUARD: listed_at and review_note are the curator's, never set at registration.` At most 5 registrations per JWT email per rolling 24 h, counted in `project_owners` — else `PROJECT GUARD: % has registered % projects in the last 24 hours (limit %) — try again tomorrow.` The throttle is skipped when the token carries no email (the curator lane; also D19) |
| `projects_bind_owner` | AFTER INSERT | `project_bind_owner()`, **SECURITY DEFINER**: inserts `project_owners (project_id, created_by = JWT email)`. No email → no owner row, until the curator writes one. EXECUTE revoked from PUBLIC, anon, authenticated, so it is trigger-only — the only writer of `project_owners` besides service_role |
| `projects_transition_guard` | BEFORE UPDATE | `reject_illegal_project_transition()` — see below |

`reject_illegal_project_transition()`:

- Identity is frozen (`id`, `slug`, `source_code`, `target_code`,
  `created_at`): `PROJECT GUARD: project % identity is immutable (slug and
  pair are fixed at registration — register a new project for another pair).`
- Closing is final; any UPDATE of a `closed` row: `PROJECT GUARD: project %
  is closed — closing is final.`
- Legal status moves: any → `closed`; `listed` / `paused` / `declined` →
  `pending_review`; `pending_review` / `paused` → `listed` (sets `listed_at =
  coalesce(OLD.listed_at, now())`); `pending_review` → `declined` (requires a
  non-blank `review_note`: `PROJECT GUARD: declining % needs a review_note that
  says why — no silent refusals.`); `listed` → `paused`. Anything else:
  `PROJECT GUARD: illegal transition % -> % for project % (…)`.
- An edit of the public text (`display_name`, `owner_display`, `source_name`,
  `target_name`, `purpose`, `domain`, `register`, `about`) is refused while
  the NEW status is `listed` or `paused`: `PROJECT GUARD: an edit of project %
  goes back through review — set status pending_review with the edit.`
- Stamps `updated_at = now()`.

RLS (enabled):

| Policy | Operation | Rule |
|--------|-----------|------|
| `projects_read` | SELECT, anon + authenticated | `status = 'listed'` OR the caller owns it (a `project_owners` row with `created_by` = the JWT email) |
| `projects_register` | INSERT, authenticated | `WITH CHECK (status = 'pending_review')`. No identity term: the triggers bind the owner (D19) |
| `projects_owner_update` | UPDATE, authenticated | USING the caller owns it; WITH CHECK new `status IN ('pending_review','closed')` AND still owned. An owner can edit (which sends a listed project back to review) or close — never list, pause or decline |
| *(no DELETE policy)* | — | — |

#### Table: `project_owners` (079)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `project_id` | BIGINT | NOT NULL | — | **PRIMARY KEY** (one owner per project); FK → `projects(id)` ON DELETE CASCADE |
| `created_by` | TEXT | NOT NULL | — | The owner's JWT email. 080 leaves owners keyed by email |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | The throttle window key |

Index: `idx_project_owners_creator ON (created_by, created_at)`.

Writers: `project_bind_owner()` and service_role only. RLS:
`project_owners_read_own` — SELECT `TO authenticated USING (created_by =
JWT email)`. No INSERT, UPDATE or DELETE policy, so no user can claim a
project the curator created.

#### Table: `project_asks` (079)

What a project asks helpers for. A description, never data.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | BIGINT | NOT NULL | identity | **PRIMARY KEY** |
| `project_id` | BIGINT | NOT NULL | — | FK → `projects(id)` ON DELETE CASCADE |
| `kind` | TEXT | NOT NULL | — | **CHECK** `sentences \| word-list \| method` (review and compute are a later phase) |
| `what` | TEXT | NOT NULL | — | Trimmed 1–600 chars |
| `how_many` | INT | YES | — | **CHECK** `> 0` |
| `terms` | TEXT | YES | — | ≤ 600 chars |
| `status` | TEXT | NOT NULL | `'open'` | **CHECK** `open \| closed` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | No maintaining trigger (D26) |

Index: `idx_project_asks_project ON (project_id, status)`. No triggers: an
ask's text can be edited after offers name it.

RLS (enabled): `project_asks_read` — SELECT, anon + authenticated: the
project is `listed`, OR the caller owns it. `project_asks_owner_write` —
INSERT, authenticated, owner only. `project_asks_owner_update` — UPDATE,
authenticated, owner only (USING and WITH CHECK). No DELETE policy.

#### Table: `project_offers` — as on production (079)

A helper's offer of one file to a listed project. Private to the helper and
the project's owner.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | BIGINT | NOT NULL | identity | **PRIMARY KEY** |
| `offer_id` | TEXT | NOT NULL | — | UNIQUE. **CHECK** `^[a-z0-9-]{8,64}$` |
| `project_id` | BIGINT | NOT NULL | — | FK → `projects(id)` ON DELETE CASCADE |
| `ask_id` | BIGINT | YES | — | FK → `project_asks(id)` ON DELETE SET NULL. Not indexed (D26) |
| `submitted_by` | TEXT | NOT NULL | — | **On prod: the helper's JWT email** (the INSERT policy binds it). 080 (drafted) would make it the JWT `sub` |
| `helper_display` | TEXT | NOT NULL | — | The helper's name as shown; trimmed 1–80 chars |
| `note` | TEXT | YES | — | ≤ 1,200 chars |
| `terms` | TEXT | NOT NULL | — | The helper's terms for the file; trimmed 1–600 chars |
| `file_name` | TEXT | NOT NULL | — | **CHECK** `^[A-Za-z0-9._-]{1,120}$` |
| `storage_path` | TEXT | NOT NULL | — | Must equal `<project slug>/<submitted_by>/<offer_id>/<file_name>` (admission guard) |
| `sha256` | TEXT | NOT NULL | — | **CHECK** 64 lowercase hex. Declared by the client, not verified |
| `bytes` | BIGINT | NOT NULL | — | **CHECK** `1 … 52,428,800` (50 MiB). Declared by the client, not the stored size (D21) |
| `status` | TEXT | NOT NULL | `'offered'` | **CHECK** `offered \| accepted \| declined \| withdrawn` |
| `decline_reason` | TEXT | YES | — | ≤ 600 chars. Not required for a decline |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Stamped by the transition guard |

Indexes: `idx_project_offers_project ON (project_id, status)`,
`idx_project_offers_helper ON (submitted_by, created_at)`.

Triggers:

| Trigger | Timing | Effect |
|---------|--------|--------|
| `project_offers_admission_guard` | BEFORE INSERT | `project_offer_admission_check()`. Born `offered` with no `decline_reason` — else `OFFER GUARD: an offer is born 'offered' (got %).` The project must be `listed` — else `OFFER GUARD: project % is not listed (%), so it takes no offers.` A named ask must be an open ask of that project — else `OFFER GUARD: ask % is not an open ask of project %.` `storage_path` must equal `<slug>/<submitted_by>/<offer_id>/<file_name>` — else (079) `OFFER GUARD: storage_path must be <project slug>/<your email>/<offer id>/<file name> (got %).` At most 24 offers per `submitted_by` per rolling 24 h — else (079) `OFFER GUARD: % has made % offers in the last 24 hours (limit %).` (the message prints the identity) |
| `project_offers_transition_guard` | BEFORE UPDATE | `reject_illegal_offer_transition()`. Every column but `status`, `decline_reason` and `updated_at` is frozen — `OFFER GUARD: offer % is immutable once made (who, what file, on what terms).` Status moves only `offered → accepted \| declined \| withdrawn`, once — `OFFER GUARD: illegal transition % -> % for offer % (offered -> accepted \| declined \| withdrawn, once).` `decline_reason` may change only together with a status change — `OFFER GUARD: a decline reason is written with the decline, not after.` Stamps `updated_at` |

RLS on production (079):

| Policy | Operation | Rule |
|--------|-----------|------|
| `project_offers_submit` | INSERT, authenticated | `submitted_by` = JWT email |
| `project_offers_read` | SELECT, authenticated | `submitted_by` = JWT email, OR the caller owns the project |
| `project_offers_helper_withdraw` | UPDATE, authenticated | USING `submitted_by` = JWT email; WITH CHECK `status = 'withdrawn'` AND `submitted_by` = JWT email |
| `project_offers_owner_decide` | UPDATE, authenticated | USING the caller owns the project; WITH CHECK `status IN ('accepted','declined')` AND still owned |
| *(no DELETE policy)* | — | — |

**What this means on production today:** the project's owner reads the
helper's email in `submitted_by` and inside `storage_path`. Withdrawing or
declining an offer only flips `status`. The file stays in the bucket, and
nobody but service_role can remove it.

#### Storage: the `project-offers` bucket (079)

`storage.buckets` row `id = name = 'project-offers'`, `public = false` (`ON
CONFLICT (id) DO UPDATE SET public = false`). No `file_size_limit` and no
`allowed_mime_types` are set. Object path on production: `<project
slug>/<helper email>/<offer id>/<file name>`. The 044 pattern.

| Policy (`storage.objects`) | Operation | Rule |
|--------|-----------|------|
| `project_offers_upload_own_folder` | INSERT, authenticated | `bucket_id = 'project-offers'` AND path segment 2 = JWT email AND segment 1 is the slug of a `listed` project |
| `project_offers_read_helper_or_owner` | SELECT, authenticated | the bucket AND (segment 2 = JWT email OR the caller owns the project whose slug is segment 1) |
| *(no UPDATE or DELETE policy)* | — | An offered file is immutable and cannot be removed through the API |

An upload is not tied to an offer row: a file can sit in a helper's folder
with no offer naming it, and the owner can read it (D21).

#### What 080 would change — DRAFTED, NOT APPLIED ANYWHERE

`080_project_offers_no_email.sql` waits on the founder's go-ahead. It has
been exercised only on a local PostgreSQL 16 stand-in (migrations README).
**Nothing in this part is true on any Supabase project yet.** Read against
the SQL, the description below matches the README row for 080.

1. **Precondition.** A `DO` block refuses to apply while any
   `project_offers.submitted_by` contains `@`:
   `080: project_offers holds offers keyed by an email — move them by hand
   before applying`. It checks offer rows, not storage objects (D22).
2. **The helper is their account id.** New function
   `project_offer_set_helper()` (plpgsql, invoker, `search_path = public`) on
   new trigger `project_offers_aa_set_helper`, BEFORE INSERT: when the JWT
   carries a non-empty `sub` (the auth user id, a random UUID), it overwrites
   `NEW.submitted_by` with it — a client cannot write another's id. It fires
   before `project_offers_admission_guard` because triggers fire in name order
   (`_aa_` sorts before `_admission_`), and RLS `WITH CHECK` runs after BEFORE
   triggers, so the policy sees the overwritten value. With no `sub` (a
   service-role call without a user token) the client's value stays.
   `COMMENT ON COLUMN project_offers.submitted_by` is re-issued to say so.
3. **Admission check re-issued** with the same rules; the messages no longer
   print the identity (`<project slug>/<your account id>/<offer id>/<file
   name>`; `OFFER GUARD: you have made % offers in the last 24 hours (limit
   %).`).
4. **Offer RLS re-keyed for the helper.** `project_offers_submit`,
   `project_offers_read` (helper half) and `project_offers_helper_withdraw`
   are re-created with `submitted_by = JWT sub`. The owner half of
   `project_offers_read` and `project_offers_owner_decide` are unchanged —
   owners stay keyed by email in `project_owners`.
5. **Storage folder by account id.** `project_offers_upload_own_folder` and
   the helper half of `project_offers_read_helper_or_owner` are re-created
   with segment 2 = JWT `sub`. The owner's read stays: slug plus owner email.
6. **Two DELETE policies on `storage.objects`.** Files are removed through
   the storage API (`mt-eval project withdraw | decline`, and a refused
   offer's upload), never by a SQL DELETE, which would orphan the blob.
   - `project_offers_helper_remove` — the helper deletes an object in their
     own folder unless an offer row with that `storage_path` has status
     `offered` or `accepted`. That covers withdrawn offers, declined offers,
     and uploads whose offer row was never written.
   - `project_offers_owner_remove_declined` — the project's owner deletes the
     object of a `declined` offer to their project.
   An accepted file stays (the stored copy is the record of what was offered);
   a standing `offered` file stays until it is withdrawn or decided.

080 does not touch `projects`, `project_owners`, `project_asks`, the
transition guards, or `project_offers_owner_decide`.

---

## Objects CHANGED by migrations 068–080

### 068 — `is_license_redistributable(text)`, anchored

`RETURNS boolean`, plpgsql, **IMMUTABLE**, SECURITY INVOKER, `SET
search_path = public`. Three steps on `low = lower(btrim(license_str))`
(NULL or blank → false):

1. A non-redistributable substring (`noncommercial`, `non-commercial`,
   `noderiv`, `no-deriv`, `noderivatives`, `proprietary`, `restricted`, a
   no-redistribute dictionary's name, `all rights reserved`) → false.
2. A standalone `nc` or `nd` token (splitting on `[^a-z0-9]+`) → false.
3. True only when `low` STARTS WITH a permissive family: `cc-by`, `cc0`,
   `cc-zero`, `public domain`, `publicdomain`, `pd-`, `mit`, `apache`, `bsd`,
   `odc-by`, `odbl`, `gpl`, `lgpl`, `mpl`, `unlicense`, `the unlicense`.

The change from 033 is step 3: `strpos(low, pref) = 1` instead of `> 0`, and
the added `the unlicense` prefix. `COMMENT ON FUNCTION` is re-issued. Both
callers pick it up by name: `reject_nonpublishable_entry_content()` (033) and
`run_cards_content_guard_check()` (051/063). It also changes what clears in
ways the header does not mention (D28). EXECUTE is as 033 left it (the
PostgreSQL default, PUBLIC).

### 070 — the two backstops read `quarantined_id_patterns`

`reject_quarantined_datasets()` (022) and `public.contest_corpus_guard()`
(041) are re-issued with 064's bodies, unchanged except the backstop branch,
which becomes:

```sql
IF NEW.dataset_id IS NOT NULL AND EXISTS (            -- run_cards guard
     SELECT 1 FROM public.quarantined_id_patterns p
      WHERE NEW.dataset_id ~* p.pattern) THEN …
IF NEW.corpus_id IS NOT NULL AND EXISTS (             -- contest guard, standard lane
     SELECT 1 FROM public.quarantined_id_patterns p
      WHERE NEW.corpus_id ~* p.pattern) THEN …
```

The messages are unchanged: `QUARANTINED DATASET PATTERN: % matches a
known-improper subset id (founder order 2026-06-13).` and `CONTEST GUARD:
corpus % matches a known-improper subset id (founder order 2026-06-13) —
never eligible for a contest.` Both keep `SET search_path = public` (E9); no
trigger is dropped or recreated. Both `COMMENT ON FUNCTION` texts are
re-issued.

Ledger consequences: D6 (lookahead-bounded, not anchored) now describes the
seeded rows; D7 (`-quarantined` dropped) can be closed by an INSERT; the two
twins can no longer drift. New risk: D18.

### 071 — `queue_items` CHECKs

```sql
alter table public.queue_items drop constraint if exists queue_items_condition_check;
alter table public.queue_items add  constraint queue_items_condition_check
  check (condition in ('naive', 'coached', 'engine'));
alter table public.queue_items drop constraint if exists queue_items_rank_mode_check;
alter table public.queue_items add  constraint queue_items_rank_mode_check
  check (rank_mode in ('map', 'ecv', 'edv'));
```

No other change. D1 (the primary key omits `rank_mode`) now spans three modes.

### 073 — `queue_pairs` covering index and EXECUTE

See the `queue_items` indexes and the `queue_top` note above. The index
carries `COMMENT ON INDEX`. Rollback drops the index only; the grants stay,
because PUBLIC EXECUTE was the defect.

### 072 → 074 → 076 — `contest_lifecycle_guard()` as it stands on production

072 created it; 074 and 076 each replaced the whole body. The live body is
076's. Trigger `contests_lifecycle_guard`, BEFORE INSERT OR UPDATE ON
`contests`, FOR EACH ROW; plpgsql, invoker, `SET search_path = public`. Every
message begins `CONTEST LIFECYCLE GUARD:`. In evaluation order:

1. **`primary_metric`** (INSERT and UPDATE, whenever the key is present): a
   JSON string naming a row of `rankable_metrics`. Refusals: `metadata.primary_metric
   must be a string naming a rankable metric (%), got %.` and `metadata.primary_metric
   '%' is not rankable — allowed: % (public.rankable_metrics, seeded from
   shared/metric-registry.json).` The printed list is every row, retired ones
   included (D24).
2. **Computation promises (076):** `metric_signature` and `harness_version`,
   when present, are non-empty strings (`metadata.% must be a non-empty string
   (the promised computation), got %.`); `declared_power`, when present, is an
   object whose `n_segments` is a JSON number matching `^[1-9][0-9]*$`.
3. **Promise vocabularies (074), checked at write time:**
   `results_visibility` ∈ `immediate | hidden_until_close`; `tie_test` ∈
   `ar | bootstrap`; `alpha` a number with 0 < alpha < 1; `n_resamples` an
   integer ≥ 1; `allowed_tracks` an array of `constrained | unconstrained`;
   `open_weight_only`, `anonymize_until_close`, `require_description`
   booleans; `test_suites` an array of objects, each with string `suite_id`,
   `corpus_card_id`, `publisher`, `url`, `sha256`, the last 64 lowercase hex;
   `sealed_holdout_set_id` a string naming a registered `sealed_sets` row.
4. **`prize_terms` (074, unchanged by 076)** — the prize disposition (founder
   ruling 2026-09-07, one choice of three). An object; its keys are exactly
   `disposition`, `retention`, `release`, `release_license`,
   `community_terms_url` (any other key is refused; prize money belongs in
   `metadata.prize`). `disposition` is required: `pass_to_holders |
   retain_ip | release_open`. `rights` and `host_use` are refused because they
   are derived from the disposition. The retired `release_required_before_scores`
   and `preset` keys are refused with their replacement named. `retention` is
   allowed only under `retain_ip` (`retain_sealed_audit |
   delete_after_scoring`); `release` only under `release_open`
   (`required_before_scores | required_before_prize | required_after_prize`);
   `release_license` (non-blank string, an SPDX id or `any_osi`) is required
   exactly under `release_open` and refused otherwise; `community_terms_url`
   must be an `https://` URL with no whitespace.
5. **INSERT:** born `open` and without `final_ranking` / `closed_at` /
   `closed_by`.
6. **Identity freeze (UPDATE):** `id`, `corpus_id`, `language_pair`, `lane`,
   `use_context`, `created_by`, `created_at`; `shared_task_id` attaches once.
7. **Frozen once the contest has entries:** `primary_metric` and the fifteen
   PROMISE keys — `tie_test`, `alpha`, `n_resamples`, `seed`,
   `require_description`, `prize_terms`, `test_suites`,
   `anonymize_until_close`, `results_visibility`, `allowed_tracks`,
   `open_weight_only`, `sealed_holdout_set_id` (074) and `metric_signature`,
   `harness_version`, `declared_power` (076). "Entries" is the R2 definition:
   a `contest_submissions` row, a `contest_intake` row, or an
   `authorization_requests` row against any of `contest_sealed_set_ids(id)`.
8. **One-way lifecycle:** `open → closed → archived`. A close requires
   `metadata.final_ranking` to be a JSON object, forces `intake_open = false`
   and server-stamps `metadata.closed_at = now()`.
9. **After close:** intake cannot reopen; `final_ranking` / `closed_at` /
   `closed_by` are immutable; the whole `metadata` is frozen except
   `human_eval_selection`.
10. **While open:** no result keys except in the closing UPDATE itself.

Python twins: `contest_policy.FROZEN_PROMISE_KEYS`, `POST_CLOSE_KEYS`,
`PRIZE_*`; `rankable_metrics.RANKABLE_METRICS`. Parity tests:
`arena/tests/test_contest_lifecycle_migration.py`,
`test_contest_entries_migration.py`, `test_rankable_metrics_migration.py`.
076's applied body is md5-identical to the file (migrations README).

### 074 → 075 — `reject_illegal_request_transition()` as it stands on production

Trigger `authorization_requests_transition_guard`, BEFORE UPDATE; plpgsql,
invoker, `SET search_path = public`. 075 re-issues 074's body with one more
edge and recreates the trigger by name.

1. Terms frozen after creation: `fingerprint`, `method_sha`, `corpus_id`,
   `corpus_version`, `node_measurement`, `sealed_set_id`, `emit` — `AUTH
   REQUEST GUARD: request % terms are immutable (fingerprint/method/corpus/version/node/sealed_set/emit
   cannot change after creation).`
2. State machine: `pending → authorized | denied | expired`; `authorized →
   expired | completed`. Anything else — `AUTH REQUEST GUARD: illegal state
   transition % -> % for request % (allowed:
   pending->authorized/denied/expired, authorized->expired/completed).`
   `denied`, `expired` and `completed` are terminal.
3. Once `OLD.decided_at` is set: `request_id`, `threshold`, `requested_by`,
   `created_at` are frozen — `AUTH REQUEST GUARD: request % is decided (%) —
   only execution_diagnostics may still be written; the decision record is
   closed.` `decided_at` itself is not in that list (D17).

075 also replaces `COMMENT ON COLUMN authorization_requests.state` and wraps
everything in `BEGIN … COMMIT`. Its first draft was written from 038's body
and would have dropped step 3; that was corrected before it was applied
anywhere, and `arena/tests/test_request_guard_migrations.py` now requires the
LAST definition of the guard to carry every rule. Prod body md5-identical to
the file (migrations README).

### 077 — `retired_metric_guard()` and the qualifier default

`retired_metric_guard()`: plpgsql, invoker, `SET search_path = public`. Bound
twice:

```sql
CREATE TRIGGER contests_retired_metric_guard
  BEFORE INSERT OR UPDATE OF metadata ON public.contests
  FOR EACH ROW EXECUTE FUNCTION public.retired_metric_guard();
CREATE TRIGGER qualifiers_retired_metric_guard
  BEFORE INSERT OR UPDATE OF metric ON public.qualifiers
  FOR EACH ROW EXECUTE FUNCTION public.retired_metric_guard();
```

It reads `metadata ->> 'primary_metric'` (contests) or `metric`
(qualifiers). It returns when the value is NULL, or unchanged on UPDATE. It
refuses when the value names a `rankable_metrics` row with `retired_at` set:
`RETIRED METRIC GUARD: '%' is retired for new % (%). Choose chrf_plus_plus
(the default) or another open metric: %.` — printing the table name, the
stored reason and the open metrics. A value that is not in `rankable_metrics`
passes this guard: 076's guard refuses it on contests, and `qualifiers.metric`
has no vocabulary check at all.

On `qualifiers` the "re-pointed" case never succeeds anyway: the 042/046
terms guard freezes `metric` after insert. A change to a retired metric gets
this guard's message (it fires first, by name); any other change gets the
terms guard's.

Also in 077: `ALTER TABLE public.qualifiers ALTER COLUMN metric SET DEFAULT
'chrf_plus_plus'` (042: `'composite'`), the two `rankable_metrics` columns
and their CHECK, the `composite` retirement UPDATE (guarded by `retired_at IS
NULL`, so re-running is a no-op), and re-issued comments on `qualifiers`,
`qualifiers.metric` and `qualifiers.threshold`. 076's lifecycle guard is not
re-issued.

### 078 — `shared_tasks` catalog comments

`COMMENT ON TABLE public.shared_tasks` and `COMMENT ON COLUMN
public.shared_tasks.shared_task_id` re-issued with the fictional example slug
`example-task-2026`. No other object changes. The file's header still says it
is applied nowhere; the README records it on prod (D27).

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
| `reject_quarantined_datasets()` | 022 (re-issued 064, 070) | trigger-only | — |
| `validate_run_card_scores()` | 023 | trigger-only | — |
| `reject_corpus_sha_mismatch()` | 026 | trigger-only | — |
| `is_license_redistributable(text)` | 033 (anchored by 068) | IMMUTABLE helper | (used by the 033 and 051/063 content guards; PUBLIC EXECUTE, the default) |
| `reject_nonpublishable_entry_content()` | 033 | trigger-only | — |
| `notify_regenerate_queue()` | 036 | DEFINER (trigger-only; reads Vault) | — |
| `reject_illegal_request_transition()` | 038 (re-issued 074, 075) | trigger-only | — |
| `auth_grant_bind_check()` | 039 | trigger-only | — |
| `claim_auth_grant(text, text, text)` · `auth_grant_is_valid(text, text)` | 039 | DEFINER | **service_role only** |
| `authorization_audit_chain()` · `reject_audit_log_mutation()` | 040 | trigger-only | — |
| `authorization_audit_head()` | 040 | STABLE | anon, authenticated, service_role |
| `contest_corpus_guard()` | 041 (re-issued 064, 070) | trigger-only | — |
| `reject_illegal_qualifier_mutation()` | 042 (replaced by 046) | trigger-only | — |
| `contest_intake_admission_check()` · `reject_illegal_intake_transition()` | 043 | trigger-only | — |
| `authorization_request_admission_check()` | 045 (re-issued 074) | trigger-only | — |
| `sealed_set_admission_check()` · `qualifier_admission_check()` | 046 | trigger-only | — |
| `reject_illegal_shared_task_mutation()` | 047 (re-issued 074) | trigger-only | — |
| `run_card_shape_violation(jsonb, text, int)` | 051 | IMMUTABLE helper | (used by the run-card content guard) |
| `run_cards_content_guard_check()` | 051 | trigger-only | — |
| `contest_admission_check()` · `contest_submission_admission_check()` | 052 (the second re-issued 074) | trigger-only | — |
| `is_license_commercial_safe(text)` | 053 | IMMUTABLE helper | (used by the use-context guard) |
| `contest_use_context_guard()` | 053 | trigger-only | — |
| `rls_auto_enable()` | 054 (verbatim commit of the prod object) | DEFINER (event-trigger-only; EXECUTE revoked, 025) | — |
| `queue_top(text, int, int)` | 059 | INVOKER, STABLE | anon, authenticated, service_role (PUBLIC revoked by 073) |
| `queue_pairs(text)` | 062 | INVOKER, STABLE | anon, authenticated, service_role (PUBLIC revoked by 073) |
| `contributor_reputation(text)` | 061 | INVOKER, STABLE | anon, authenticated (PUBLIC revoked) |
| `docent_output_tokens_since(timestamptz)` | 067 | INVOKER, STABLE | **service_role only** |
| `contest_lifecycle_guard()` | 072 (re-issued 074, 076) | trigger-only | — |
| `contest_sealed_set_ids(text)` | 074 | INVOKER, STABLE, SQL | PUBLIC (default; RPC-callable — D25) |
| `contest_for_sealed_set(text)` | 074 | INVOKER, STABLE, plpgsql | PUBLIC (default; RPC-callable — D25) |
| `contest_active_phase(text, timestamptz DEFAULT now())` | 074 | INVOKER, STABLE, SQL; returns a `contest_phases` row | PUBLIC (default; RPC-callable — D25) |
| `contest_phase_guard()` · `contest_submission_entry_freeze()` · `contest_deferred_result_guard()` | 074 | trigger-only | — |
| `retired_metric_guard()` | 077 | trigger-only (two triggers) | — |
| `project_admission_check()` · `reject_illegal_project_transition()` · `project_offer_admission_check()` · `reject_illegal_offer_transition()` | 079 (`project_offer_admission_check` re-issued by 080, drafted) | trigger-only | — |
| `project_bind_owner()` | 079 | **DEFINER** (trigger-only) | nobody (EXECUTE revoked from PUBLIC, anon, authenticated) |
| `project_offer_set_helper()` | 080 — **drafted, not applied** | trigger-only | — |

Advisor hardening (020/025): all API-reachable SECURITY DEFINER trigger/event
functions have EXECUTE revoked from anon/authenticated/public, and every
function above has `search_path` pinned to `public`. Migration **048** extends
this to `claim_auth_grant` / `auth_grant_is_valid` (039) and
`notify_regenerate_queue` (036) — those are **no longer API-callable** by
anon/authenticated/public (service_role/trigger paths only). Every function
added or re-issued by 068–080 pins `search_path = public`; of them only
`project_bind_owner()` (079) is SECURITY DEFINER, and its EXECUTE is
revoked. 074's three non-trigger helpers keep the default PUBLIC EXECUTE
(D25).

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
| `metric` | TEXT | NOT NULL DEFAULT `'chrf_plus_plus'` since **077** (042: `'composite'`); a retired `rankable_metrics` metric is refused for a new row (077). No vocabulary CHECK |
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
`qualifiers_admission_guard` (046) · `qualifiers_retired_metric_guard`
(077, BEFORE INSERT OR UPDATE OF metric).
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
| `report_url` | TEXT | **074** — where the edition's findings report is published (http/https, ≤ 2048). Written by `mt-eval shared-task report`; a display pointer, never a gate |
| `report_generated_at` | TIMESTAMPTZ | **074** — when the report behind `report_url` was generated from the frozen per-contest rankings |

Trigger: `shared_tasks_identity_guard`. RLS: enabled;
`shared_tasks_anon_read` SELECT to anon+authenticated. The guard freezes
slug/year/created_at ONLY, so the two 074 report columns are editable in
place — 074 restates the function with that exemption written into it.

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

## Defects, surprises and honest residuals (058–067 write-up, 2026-08-01; 068–080 write-up, 2026-10-13)

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

### Live re-verification (2026-09-06, read-only smoke over the anon key)

- **D1 re-verified:** `queue_top('ecv')` and `queue_top('edv')` return 0 rows
  silently; prod holds 211,082 `queue_items` rows, all `rank_mode='map'`.
- **D2 re-verified:** newest `queue_items.generated_at` is 2026-08-27 — the
  ordering was 9 days old on the day of the check.
- **D4 re-verified:** `queue_top` and `queue_pairs` still carry `=X/postgres`
  (PUBLIC EXECUTE). Migration 073 revokes it and re-grants the three roles.
- **D9 answered:** `docent_usage` and `tickets` are still empty on prod; the
  write-phase of the smoke (a ticket + one docent question) is the test.
- **TA-06 closed:** prod `datasets` = 5,537 = registry 5,601 − 64 restricted
  (the 5,308 figure in the 2026-07-12 audit was old drift, since synced).

### D13 — EdTeKLA has no `datasets` rows on prod, so 022 cannot refuse it (SMK-01, live)

The prod dataset sync deliberately skips every EdTeKLA card (its
`is_restricted` carve-out), so the `datasets` table carries no
`eval-eng-crk-edtekla-*` row at all — not even a metadata-only row flagged
`quarantined=true`. Migration 022's data-driven branch keys on that flag and
the 064 backstop regex matches only the four improper crk slice ids, so an
anonymous `submit-run` whose `dataset_id` is the EdTeKLA dev set would be
**accepted** by the database (033/051 still block any per-entry text; only the
aggregate score row would land). Meanwhile the registry marks the id
quarantined and the harness refuses it client-side — the database and the
registry disagree, and the database is the layer meant to hold beneath every
client. Two honest resolutions, both metadata-only (id, license, reason —
exactly what `champollion.dev/registry.json` already publishes; never corpus
content): sync the rows with `quarantined=true` so 022 can refuse, or record
the gap and rely on the client gate.

**Resolved 2026-09-06 (founder-approved).** `sync_datasets_to_prod.py` now
carries every restricted-and-quarantined registry entry as a metadata-only
row (`sha256` NULL, `quarantined` forced true, `metadata` narrowed to
`registry_source/contamination/attribution` — no `path`, no builder recipe),
so a hand-inserted row is no longer deleted by the next `--apply`. The two
EdTeKLA rows were upserted from the script's own row builder; prod `datasets`
= 5,539 = registry 5,601 − 62 restricted-and-unquarantined; the sync dry run
is a no-op. The boundary sentence lives in `docs`-side data-boundary doctrine:
content never, the label always.

### D14 — `queue_pairs()` exceeds the anon statement timeout at 211k rows (SMK-02, live)

Measured 2026-09-06: `select * from queue_pairs('map')` runs 3,413 ms
(63,590 buffers, 38,378 read from disk — a sequential scan of the wide
`queue_items` heap grouped by `language_pair`). The anon role's
`statement_timeout` is 3 s, so every anonymous caller — the `/contribute`
strip, the MCP server's live open count, `mt-eval queue` — gets
`500 {"code":"57014","message":"canceling statement due to statement timeout"}`
and falls back to the generation-time count in `queue-preview.json` (see D2).
The function was written against 9,815 rows (062); the 2026-08-27 lane-both
decision (071) took the table to 211k. Migration 073 adds a covering index
`(rank_mode, language_pair) INCLUDE (est_cost_usd, corpus_id, model,
condition)` so the aggregate can run from the index, and closes D4 in the
same file.

**Applied to prod 2026-09-06 (founder-approved).** Measured after: 759 ms
server-side (was 3,413 ms; buffers read from disk 38,378 → 2,721), and the
anonymous RPC over PostgREST answers HTTP 200 in ~0.4 s (was 500/57014 after
3 s). `queue_top`/`queue_pairs` no longer carry `=X/postgres` — **D4 closed.**

### D15 — `queue_pairs()` returns 3,620 rows but PostgREST serves 1,000, so "open items" was under-counted 3× (SMK-03, live)

Found the moment D14 stopped masking it. `queue_pairs('map')` returns one
row per open pair — 3,620 rows on 2026-09-06 — and PostgREST's default
`max-rows` cap hands an un-paging client the first 1,000. Both consumers
summed whatever they received: the website's queue strip
(`cli/website/src/utils/liveQueue.js::fetchQueuePairs`) and the MCP server's
live open count (`mcp-server/src/tools/queue.js::ensureCache`). Measured:
first 1,000 rows sum to **69,695**; all 3,620 sum to **211,082**, the true
open total. (An earlier note that "69.7k for the map lane vs 211k all-lane is
correct" was this truncation, not a lane difference.) Fix: page the RPC with
`Range` headers until a short page (client-side, no DDL) — or, cleaner, a
one-row `queue_open_count(p_rank_mode)` RPC that cannot be capped (a future
migration).

### 068–080 write-up (2026-10-13; read from the SQL, not re-verified against prod)

Ordered by consequence. "Live" means the migration is on prod (068–079);
"drafted" means 080, which is applied nowhere. Earlier entries this write-up
touches: **D1** now spans three modes (071 added `edv`; the key is still `id`
alone). **D4** was closed by 073. **D6** now describes the seeded rows of
`quarantined_id_patterns`, and **D7** can be closed by one INSERT (070).

### D16 — An entry can name ANY authorization request, so its "server-derived" phase is chosen by the client (integrity, live since 2026-09-07)

`contest_submission_admission_check()`
(`074_contest_entries_phases_and_promises.sql:557-585`) derives `phase` from
the `created_at` of whatever `authorization_request_id` the entry names. It
checks only that the request has a `created_at`. It does not check that the
request's `requested_by` is the submitter, that its `sealed_set_id` is one of
`contest_sealed_set_ids(contest_id)`, or that its state is `authorized` or
`completed`; the 052 INSERT policy checks only `submitted_by` and the target
contest. `authorization_requests` is public-read, so request ids are easy to
find. A participant can cite someone else's request, a pending or denied one,
or one from another contest — and pick the phase by picking the request.
`contest_submissions_entry_freeze` then freezes that choice. The index
`idx_cs_auth_request` is not UNIQUE, so one request can back several entries.
A non-existent id raises `SUBMISSION GUARD: authorization request % has no
created_at …` (the BEFORE trigger runs before the FK check), which misnames
the error. Fix: in the admission check, require the request to exist, belong
to the submitter, target one of the contest's sealed sets, and be
`authorized` or `completed`; consider a partial UNIQUE index.

### D17 — After a decision, `decided_at` itself is still writable, so the "closed decision record" can be reopened (integrity, service-role only, live since 2026-09-07)

**Status (2026-10-13): fixed in draft 082** — `decided_at` and `id` are frozen once set, and the first move out of `pending` is dated when the caller did not date it. Not applied anywhere yet.

`reject_illegal_request_transition()` (074:1216-1225, restated in
`075_authorization_requests_completed.sql:114-123`) freezes `request_id`,
`threshold`, `requested_by` and `created_at` once `OLD.decided_at` is set. It
does not freeze `decided_at`. An UPDATE may rewrite it, or set it to NULL —
after which the block no longer runs, because it keys on `OLD.decided_at`.
The refusal says "only execution_diagnostics may still be written", which
overstates the code: `decided_at` and `id` may also change, and `state` may
still move under the machine. Nor does anything require `decided_at` when
`state` leaves `pending`: an `authorized` row with `decided_at` NULL never
gets the closed-record protection. `authorization_requests` has no public
UPDATE policy, so only service_role can do any of this. Fix: freeze
`decided_at` (and `id`) once set, and stamp or require it on the first move
out of `pending`.

### D18 — `quarantined_id_patterns` rows are unvalidated regexes run inside two publish guards (availability, live since 2026-10-12)

**Status (2026-10-13): fixed in draft 082** — a pattern is tried once when written; an empty one, or one Postgres cannot compile, is refused. Not applied anywhere yet.

`070_quarantine_patterns_to_data.sql:54-59` has no CHECK and no validation
trigger. Both guards test `~* p.pattern` for every row — on every `run_cards`
INSERT and UPDATE (070:111-118) and on every standard-lane contest insert or
corpus/lane change (070:198-205). A row that is not a valid regex (an
unbalanced parenthesis) makes every such statement fail with `invalid regular
expression`: publishing stops, and so do the verifier's `trust` updates. A
row such as `.` blocks every id. Both are one service-role INSERT away. Fix: a
BEFORE INSERT/UPDATE trigger that test-compiles the pattern and refuses one
that matches a short sample of known-good ids.

### D19 — A registered project can be born with no owner and no throttle (correctness, live since 2026-10-12)

**Status (2026-10-13): fixed in draft 081** — registration needs an account with a non-empty email (the curator is not bound); not applied anywhere yet.

`projects_register` (`079_registered_projects.sql:420-422`) checks only
`status = 'pending_review'`. The owner binding (`project_bind_owner`,
079:178-182) and the 5-per-24 h throttle (079:144-152) both run only when the
JWT carries an `email` claim. An authenticated session without one registers
a project that has no owner row and is not throttled; nobody but the curator
can then edit it, close it or read its offers. The header says "Every
self-registered project is born with exactly one owner, so no one can claim an
ownerless row" (079:20-23) — true only when the claim is present. If a
sign-in method issues an empty-string email claim, every such account would
share the owner identity `''` and read each other's projects and offers.
Which sign-in methods are enabled on this project was not checked. Fix: add
`AND (jwt ->> 'email') <> ''` (non-null) to the policy's WITH CHECK.

### D20 — The owner's UPDATE path writes curator fields, and "after an edit" is not checked (correctness, live since 2026-10-12)

**Status (2026-10-13): fixed in draft 081** for the curator fields (`review_note`, `listed_at` are the curator's alone). The return to review without an edit is kept on purpose: the owner policy allows only `pending_review` or `closed`, so it is the owner's one way to take a listed project off the list. Not applied anywhere yet.

The admission check refuses `listed_at` and `review_note` at INSERT because
they are "the curator's" (079:141-142). Neither the transition guard
(079:200-251) nor `projects_owner_update` (079:425-436) protects them after
that. An owner can overwrite the curator's decline reason, and can set
`listed_at` while the project waits for review; the listing keeps an existing
value (`coalesce(OLD.listed_at, NOW())`, 079:224), so an owner-chosen date —
past or future — becomes the listing date that `idx_projects_status (status,
listed_at)` orders by. Separately, the guard allows `listed | paused |
declined → pending_review` with no edit at all (079:222), while its message
says "any open -> pending_review after an edit" (079:232): an owner can send
a paused or declined project back to the review queue unchanged, as often as
they like. Fix: freeze `listed_at` outside the listing transition and
`review_note` outside a curator status move.

### D21 — The `project-offers` bucket: the owner reads files nobody offered, and the 50 MiB cap is only declared (privacy and resource, live since 2026-10-12)

**Status (2026-10-13): fixed in draft 081** — the owner reads a file only while its offer is offered or accepted, or declined (so they can remove it); the bucket gets `file_size_limit` 50 MiB. Not applied anywhere yet.

`project_offers_read_helper_or_owner` (079:529-540; 080:135-147 keeps the
owner half) lets the project's owner read every object under the project's
slug, whether or not an offer row names it. Upload (079:518-525) is not tied
to an offer row. So a file a helper uploaded but never offered, or one whose
offer was withdrawn, is readable by the owner — and under 079 it can never be
removed through the API. The bucket is created with no `file_size_limit` and
no `allowed_mime_types` (079:512-514). The 52,428,800-byte (50 MiB) cap is a
CHECK on the client-declared `project_offers.bytes` (079:297), not on the
stored object, and `sha256` is declared, not verified. (044's `contest-intake`
bucket has the same no-limit shape.) Fix: limit the owner's read to paths
named by an `offered`, `accepted` or `declined` offer row, and set
`file_size_limit` on the bucket.

### D22 — 080's precondition checks offer rows, not storage objects; and nothing keeps an email out of `submitted_by` (privacy, drafted)

**Status (2026-10-13): fixed in draft 080** — the safety check also refuses files in email-named folders, and a CHECK (`project_offers_submitted_by_not_email`) keeps an email out of `submitted_by` for every writer.

080's `DO` block (`080_project_offers_no_email.sql:23-28`) refuses only when
a `project_offers.submitted_by` contains `@`. A 079-era object whose folder
(path segment 2) is an email but which has no offer row is not checked. After
080 the helper could no longer read or delete it (their folder becomes their
`sub`), while the owner still reads it — email in the path — through the
unchanged slug-based owner read. Also, `project_offer_set_helper()` overwrites
`submitted_by` only when a `sub` claim is present (080:45-47): a service-role
insert keeps whatever it is given, and no CHECK refuses an `@`. Fix before
applying: extend the precondition to `storage.objects` in bucket
`project-offers` whose second path segment contains `@`, and add `CHECK
(submitted_by !~ '@')`.

### D23 — Phase windows can be added after the fact (integrity, live since 2026-09-07)

**Status (2026-10-13): founder ruling "refuse both". Fixed in draft 083:**
- on INSERT, a window must start in the future;
- no new window once the contest has entries.

Checked locally; not on prod yet (with 081 and 082).

`contest_phase_guard()` (074:316-370) freezes a window once it has started,
and every window once the contest has entries — but only on UPDATE and DELETE
(074:327-343). INSERT is checked for overlap only. Through
`contest_phases_owner_insert` (074:391-402) an owner can add a window that
starts in the past, or add a missing phase name after entries exist (one row
per name, so only the absent ones); the policy does not look at
`contests.status`. A new window that covers now re-opens the method door in
`authorization_request_admission_check`. The table comment (074:219-220)
says "a deadline that can be moved after the fact is not a deadline". Fix: on
INSERT, refuse `starts_at <= now()` and refuse once the contest has entries —
or, if adding a later phase is intended, say so in the comment.

### D24 — `rankable_metrics` rows must never be deleted, but nothing stops it (availability, live since 2026-09-28)

**Status (2026-10-13): fixed in draft 082** for the DELETE (refused, with the retire command). The refusal text listing a retired metric as allowed is left (cosmetic: 077's guard refuses it for a new contest). Not applied anywhere yet.

076's guard checks `primary_metric` against the table on every INSERT and on
every UPDATE of a contest that carries the key (`076_rankable_metrics_and_computation_promises.sql:119-133`),
not only when it changes. If a service-role DELETE removes a row, every later
UPDATE of a contest that recorded that metric — its close included — fails
with `… is not rankable`. 077's column comment says a retired row "is never
deleted" (`077_retired_metrics_and_chrf_qualifier_default.sql:55`);
there is no FK (the value lives in JSONB) and no guard. Also, 076's refusal
lists every row as "allowed", including the retired `composite`, which 077
then refuses for a new contest. Fix: a BEFORE DELETE trigger that refuses
(retire instead), and `WHERE retired_at IS NULL` in 076's message list.

### D25 — 074's three helper functions skip the EXECUTE hygiene (advisor hygiene, live since 2026-09-07; the D4 class)

`contest_sealed_set_ids(text)`, `contest_for_sealed_set(text)` and
`contest_active_phase(text, timestamptz)` (074:234, 257, 292) are created with
no REVOKE, so they keep PostgreSQL's default PUBLIC EXECUTE and anon can call
them over PostgREST as RPCs. Not an escalation: all three are SECURITY INVOKER
and read only tables the caller can already read. Same fix as D4: one
REVOKE/GRANT pair each.

### D26 — Missing indexes, foreign keys and a maintaining trigger on the new tables (performance and integrity, minor, live)

- `project_offers.ask_id` (079:289) has no index; the `ON DELETE SET NULL`
  from `project_asks` scans `project_offers`.
- `contest_deferred_results.contest_id` (074:1079) is indexed only partially
  (`idx_deferred_unpublished … WHERE published_run_card_id IS NULL`,
  074:1098-1100); a `contests` delete and the owner-read policy filter on all
  rows.
- `contest_deferred_results.request_id` and `sealed_set_id` (074:1078-1080)
  carry no FK, though the table comment calls `request_id` "the
  authorization_requests row". `deferred_at` is client-settable at INSERT; the
  guard freezes it only afterwards.
- `project_asks.updated_at` (079:274) has no maintaining trigger (the D5
  shape); `projects` and `project_offers` stamp theirs in their guards.

### D27 — Comments that contradict the code or the migrations README (doc drift)

- `080_project_offers_no_email.sql:20` says "Applied 2026-10-?? — see
  migrations/README.md"; the README says "Drafted, applied nowhere." The
  README is right.
- `078_shared_tasks_example_comments.sql:10-11` says "NOT applied anywhere
  yet"; the README records it on prod 2026-10-12 (ledger `20261012091829`).
  The header was true when written.
- `068_fix_license_redistributable_anchor.sql:19-20` says everything except
  the one comparison is byte-identical to 033; line 62 also adds
  `'the unlicense'` to the prefix list.
- `076_rankable_metrics_and_computation_promises.sql:35-36` speaks of "the
  two promise keys"; 076 adds three (`metric_signature`, `harness_version`,
  `declared_power`, 076:91-92).
- `069_create_trading_card_vocabulary.sql:30-34` creates its policy without
  `DROP POLICY IF EXISTS`, so re-running 069 fails with "policy already
  exists" — the migrations README (lines 11-12) calls every migration safely
  re-runnable.

### D28 — 068 also narrows what clears, beyond the "limited"/"permitted" fix (surprise, fail-closed, live)

With an anchored prefix, a license string clears only if it starts with a
listed family. `AGPL-3.0` used to clear through the `gpl` substring and no
longer does (`agpl` is not in the list); neither does a label-prefixed string
such as `License: MIT` or `SPDX: CC-BY-4.0`. All of these now fail closed: the
033 guard refuses their per-entry content, and their run cards get 051's
strict aggregate-only shape. The Python twin behaves the same
(`arena/mt_eval_harness/publish.py:564-591`), so parity holds. Recorded so a
refused AGPL corpus is not misread as a bug.

### D29 — Two private buckets now hold files people upload (doctrine question, live)

Design Principle 7 says content never lives here. That holds for tables, not
for storage: `contest-intake` (044) holds hypothesis bundles, and
`project-offers` (079) holds files helpers offer to a project — sentences,
word lists, methods (079:24-34). 079's header calls itself "CONTENT-FREE" in
the sense that no column holds a sentence (079:45-48). Whether
helper-offered files fall under the hosting rule of the data-boundaries
doctrine is a founder question; this entry records only that they are stored
in this project's Supabase storage.

---

## Design Principles

1. **Denormalize for query speed**: Core metrics are top-level REAL columns (not buried in JSONB) so the leaderboard can `ORDER BY chrf_plus_plus DESC` without function calls (the headline since the scoring standard, 2026-10-04; `composite_score` is retired and NULL on new cards).

2. **JSONB as source of truth**: The `run_card` JSONB blob contains everything. Top-level columns are denormalized copies for SQL ergonomics. If they disagree, JSONB wins.

3. **Immutable submissions**: Run cards cannot be updated or deleted via the API. Only admins (service_role key) can moderate, and the 017 audit trail preserves every prior row. Sovereign-eval decisions go further: the 040 log is append-only for *everyone*, service_role included.

4. **Trust escalation is admin-only**: CLI always inserts `trust = 'unverified'`. Promotion to `'verified'` happens via the server-side verifier (`mt_eval_harness/verifier.py`, service_role) which re-scores against the sha-pinned canonical corpus; demotion to `'disqualified'` is admin moderation.

5. **Organic metadata, curated registry**: `publish.py` treats the datasets upsert as non-fatal secondary metadata, but since migration 024 the `datasets` table itself is **curator-owned** (service_role writes only) — its `sha256` pins and `quarantined` flags are trusted inputs to the 026/022/033 guards.

6. **RLS gates the API; triggers gate everyone**: All INSERT policies require an authenticated uid (and owner binding since 027). But every integrity/sovereignty invariant that matters — quarantine, score ranges, sha parity, corpus-content exposure, authorization state machines, audit immutability — is ALSO a trigger, because `service_role` bypasses RLS and *nothing* bypasses triggers.

7. **Content never lives here**: Corpus content is fetch-from-source. The only text columns that can carry corpus sentences (`run_card_entries.source`/`expected`) sit behind the 033 guard (registered + non-quarantined + open-segment + redistribution-cleared license, else reject). The sovereign-eval tables (037–040) are content-free by construction and test-asserted. Storage is the exception to watch: two private buckets (`contest-intake`, 044; `project-offers`, 079) hold files people upload — see D29.
