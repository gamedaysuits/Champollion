# Database Migrations

SQL migrations for the Supabase-hosted MT Eval Arena database.

> **Canonical location**: This directory (`mt-eval-arena/supabase/migrations/`) is the
> single active migration directory. All new migrations go here.

## Overview

Each migration is a standalone SQL file that can be run via the Supabase SQL Editor
or `supabase db push`. Migrations are **idempotent** — they use `IF NOT EXISTS`
guards and can be safely re-run.

## Schema History

The schema is the result of three phases:

### Phase 1: Base table (applied via Supabase Dashboard)

The `run_cards` table was created manually via the Supabase SQL Editor before
any migration system existed. The original DDL is preserved at:

`mt-eval-arena/supabase/historical/001_create_run_cards.sql`

### Phase 2: CLI migrations (applied via `supabase db push`)

Two timestamped migrations (now archived in `historical/`) added columns and
created the `datasets` table. These are **already applied** to the live DB.

| File | Effect |
|------|--------|
| `20260528023253_add_missing_columns_and_language_cards.sql` | Added 6 columns to `run_cards` |
| `20260528024953_drop_language_cards_add_datasets.sql` | Added 4 columns, created `datasets` table |

### Phase 3: Arena migrations (this directory)

All new migrations go here. **This is the only active migration directory.**

## Migration Order

| # | File | Purpose |
|---|------|---------|
| 001 | `001_add_comet_and_ci_columns.sql` | COMET score, corpus BLEU, chrF++/exact-match CI columns |
| 002 | `002_add_metric_columns.sql` | Additional metric and CI columns, API provider |
| 003 | `003_add_quality_params.sql` | Method config columns (batch_size, temperature, max_tokens) |
| 004 | `004_add_missing_ci_columns.sql` | FST and composite CI columns |
| 005 | `005_create_run_card_entries.sql` | Per-entry results table (`run_card_entries`) |
| 006 | `006_add_full_metric_columns.sql` | Behavioral metrics, throughput, LYSS verdict columns |
| 007 | `007_add_token_efficiency_columns.sql` | Token efficiency columns (tokens_per_entry, cost_per_1k_tokens) |
| 008 | `008_create_contests.sql` | Contest infrastructure (contests + contest_submissions) |
| 009 | `009_create_datasets.sql` | ~~Datasets table~~ **SUPERSEDED** by 011 (was no-op due to CLI migration) |
| 010 | `010_add_style_column.sql` | Writing style consistency rate column on run_cards |
| 011 | `011_reconcile_datasets.sql` | Reconciles CLI and arena datasets schemas, adds missing columns |
| 012 | `012_create_trading_cards.sql` | Trading card tables (index + detail) with RLS and RPC function |
| 013 | `013_create_source_licenses.sql` | Source license registry with RLS and attribution RPC functions |
| 014 | `014_add_license_to_detail.sql` | License pass-through on trading card detail |
| 015 | `015_add_corpus_license.sql` | Corpus license/attribution passthrough columns on `run_cards` |
| 016 | `016_datasets_rls.sql` | Restricts anon reads of `datasets` rows with held-out/gold-standard segments |
| 017 | `017_run_cards_audit.sql` | Audit table + trigger preserving prior rows on `run_cards` UPDATE/DELETE |
| 018 | `018_language_experts.sql` | Experts & institutions index (`language_experts`) with RLS and lookup RPCs |
| 019 | `019_run_cards_insert_parity.sql` | Authenticated-only `run_cards` insert with trust='unverified' check; drops spoofable owner-update policy |
| 020 | `020_advisor_hardening.sql` | Security-advisor hardening: revokes API EXECUTE on audit trigger fn, pins `search_path` on six functions |
| 021 | `021_run_cards_trust_vocabulary.sql` | Aligns `run_cards.trust` vocabulary (unverified/verified/disqualified); remaps legacy rows, swaps CHECK |
| 022 | `022_quarantine_corpus_guard.sql` | Adds `datasets.quarantined` flag + trigger rejecting quarantined-dataset publishes (improper crk slices) |
| 023 | `023_run_cards_score_integrity.sql` | Trigger validating metric ranges, non-vacuous runs, and tier vocabulary on `run_cards` |
| 024 | `024_lockdown_write_surface.sql` | Locks write surface: curator-only (`service_role`) `datasets` writes, INSERT-only `run_card_entries` |
| 025 | `025_advisor_hardening_v2.sql` | Security-advisor hardening v2: revokes API EXECUTE on event-trigger/audit fns, pins integrity-trigger `search_path` |
| 026 | `026_sha_parity_guard.sql` | Trigger binding a run's claimed corpus sha to the curator-owned `datasets.sha256` |
| 027 | `027_entry_owner_binding.sql` | Adds server-set `run_cards.owner_uid`; binds `run_card_entries` inserts to the parent run's owner |
| 028 | `028_qe_score_columns.sql` | Reference-free QE columns (`qe_score`, `has_references`) with [0,1] range check and index |
| 029 | `029_morphological_accuracy_columns.sql` | FST `morphological_accuracy` + `morph_coverage` columns with [0,1] range checks (fst-coverage profile) |
| 030 | `030_paradigm_axis.sql` | `run_cards.paradigm` column + partial index — the orthogonal method-taxonomy axis (rule-based/neural-nmt/llm/…) for leaderboard filtering |
| 031 | `031_rls_initplan_perf.sql` | RLS init-plan performance: wraps `auth.*()` calls in scalar subqueries so they evaluate once per query (advisor WARN cleanup) |
| 032 | `032_trading_card_index_resolution_fields.sql` | Adds resolution fields to `trading_card_index` for card lookup/rendering |
| 033 | `033_run_card_entries_content_guard.sql` | Trigger on `run_card_entries` mirroring publish.py's per-entry content gate: rejects quarantined / held_out / gold_standard / non-redistributable-license / unregistered (fail-safe) corpus CONTENT inserts. The aggregate run_card still publishes |
| 034 | `034_translation_services.sql` | Human translation-services v0 discovery registry (public-read gated on consent+approval, service-role writes, `get_services_for_pair` RPC). **Dev-only; not on prod** (awaits sovereignty sign-off) |
| 035 | `035_contest_use_context.sql` | Adds `contests.use_context` (commercial \| non-commercial); dataset eligibility is computed from it + license via `is_usage_allowed`. **Prod (2026-07-11)** |
| 036 | `036_regenerate_queue_trigger.sql` | `pg_net` trigger notifying the `regenerate-queue` edge function on `run_cards` changes (delta-refresh of queue.json/mesh.json). **Prod (2026-07-11; Vault secrets + edge function live)** |
| 037 | `037_sealed_sets.sql` | **Sovereign-eval Wave 1.** Content-free registry of sealed (encrypted-at-rest) held-out corpora: ciphertext **digest** only, custodian-group id, public-qualifier id, language pair; `quarantined` true by default (reuses migration 022). NO source/reference/plaintext column. **Prod (2026-07-11)** |
| 038 | `038_authorization_requests.sql` | **Sovereign-eval Wave 1.** The `pending-authorization` queue state: request `state` (pending/authorized/denied/expired), immutable request fingerprint + components, `emit` pinned `scores-only`; one-way transition guard trigger. FK → `sealed_sets`. **Prod (2026-07-11)** |
| 039 | `039_auth_grants.sql` | **Sovereign-eval Wave 1.** Single-use, time-boxed, fingerprint-bound grants. `auth_grant_bind_check` trigger (no grant without an *authorized* request; frozen terms; one-way single-use) + atomic `claim_auth_grant()` (service-role only). **Prod (2026-07-11)** |
| 040 | `040_authorization_audit_log.sql` | **Sovereign-eval Wave 1.** Append-only, hash-chained audit trail (core `sha256`, no pgcrypto): BEFORE INSERT chain trigger + BEFORE UPDATE/DELETE reject trigger (mirrors 033); publishable head digest via `authorization_audit_head()`; community-inspectable read. **Prod (2026-07-11)** |
| 041 | `041_sealed_contest_bridge.sql` | **Sovereign-eval Wave 1.5.** `contests.lane` (standard \| sealed) + `contest_corpus_guard()` trigger: a sealed contest requires a registered ACTIVE `sealed_sets` row (fail-closed) and grants ZERO access (every run still passes 038→039→040); a standard contest refuses sealed sets, quarantined datasets, and the 022 known-improper-slice regex. **Prod (2026-07-11)** |
| 042 | `042_qualifiers.sql` | **Phase A (organizer node).** `qualifiers` table making `sealed_sets.current_qualifier_id` real: per-round `threshold` + `metric` (data, never code), vYYYY rotation via freeze-and-insert, one-active-per-set partial unique, terms-freeze trigger. Logic SSOT: `cli/lib/sealed-qualifier.mjs` ↔ `qualifier_gate.py`. **Prod (2026-07-11)** |
| 043 | `043_contest_intake.sql` | **Phase A (organizer node).** `contest_intake` hypotheses-submission queue (digests + one-way lifecycle only, NO content columns; bytes live in the 044 bucket) + admission trigger (contest open, `intake_open`, rolling-24h `intake_daily_limit`) + transition guard (frozen identity, rejected-requires-reason) + `contests.authorization_model` (per-submission \| blanket \| open, fail-closed default). **Prod (2026-07-11)** |
| 044 | `044_contest_intake_storage.sql` | **Phase A (organizer node).** Private `contest-intake` storage bucket: own-folder-only authenticated upload/read (path `contest-intake/<contest>/<email>/…`), NO update/delete policies — bundles immutable + retained indefinitely (founder 2026-07-07). Secret refs never touch it. **Prod (2026-07-11)** |
| 045 | `045_method_submission_door.sql` | **Phase B (method lane).** The T2 proposal door on EXISTING tables (no new table): identity-bound authenticated INSERT on `authorization_requests` (born pending, `requested_by` = JWT email, `emit` pinned scores-only), admission trigger (active sealed set, born-pending/undecided, rolling-24h `sealed_sets.request_daily_limit` — data, not code), pending-dedup partial unique on (set, fingerprint). `method_sha` is now a real method-tarball hash (`mt-eval contest submit-method`). **Prod (2026-07-11)** |
| 046 | `046_organizer_registration_door.sql` | **G3 (shared-task onboarding).** The organizer self-serve registration door on EXISTING tables (no new table): identity-bound authenticated INSERT on `sealed_sets` + `qualifiers` (`created_by` = JWT email; born quarantined/planned-or-active; qualifier born active + may only gate a sealed set the SAME identity registered), admission triggers beneath every client (birth states + rolling-24h per-creator throttle, curator NULL lane exempt), 042 terms guard extended to freeze `created_by`. INSERT-only — rotation/retirement stay curator-lane. `mt-eval contest register` / `contest prepare --self-serve`. **Prod (2026-07-11)** |
| 047 | `047_shared_tasks.sql` | **Shared-task edition umbrella (G5).** `shared_tasks` — one row per multi-pair edition-year (name, organizer, cycle year, prepare-time policy defaults) + nullable `contests.shared_task_id` FK + partial index. Identity-freeze trigger (slug/year/created_at immutable; one-way active→archived), read-only RLS, service-role registration (`mt-eval shared-task create`, attach via `contest prepare --shared-task`). Thin by design: NO per-pair machinery reads it. **Prod (2026-07-11)** |
| 048 | `048_function_execute_hardening.sql` | **Advisor hardening v3.** REVOKE EXECUTE on `claim_auth_grant` / `auth_grant_is_valid` (039) and `notify_regenerate_queue` (036) from anon/authenticated/public — same class as migration 025; service-role/trigger paths only. **Prod (2026-07-11)** |
| 049 | `049_advisor_hardening_v3.sql` | **Advisor hardening follow-up (2026-07-12).** Pins `get_services_for_pair` `search_path` (missed by the earlier passes because 034 landed on prod AFTER 048) and converts five 042–046 door policies to the initplan (`(select auth.*())`) form (same class as 031). **Prod (2026-07-12)** |
| 050 | `050_anonymous_intake.sql` | **Anonymous intake lane (founder directive 2026-07-13).** `anon_intake_log` rate-limit ledger (salted ip-hash only, RLS deny-all/service-role) for the `submit-run` edge function (verify_jwt=false): anonymous rows insert as `submitter='anonymous'`, `owner_uid=NULL`, `trust='unverified'`; every integrity trigger stays in force. **Prod (2026-07-19)** |
| 051 | `051_run_cards_content_guard.sql` | **Run-card content guard (audit 2026-07-18, H1).** BEFORE INSERT/UPDATE trigger on `run_cards`: text-column caps + `run_card` must be a JSON object ≤ 1 MB; corpora that are NOT redistribution-cleared (033's resolution + `is_license_redistributable`, unchanged SSOT) additionally get strict aggregate-only shape validation (`run_card_shape_violation` — leaves ≤ 2 k, top-level `system_prompt_used` ≤ 64 KB, arrays ≤ 512, no text-bearing array-objects, ≤ 256 KB). Closes the world-readable JSONB laundering hole 033 left open on the aggregate row. **Prod (2026-07-19)** |
| 052 | `052_contest_identity_binding.sql` | **Contest identity binding (audit M1).** `contests`/`contest_submissions` INSERT policies bind `created_by`/`submitted_by` to the JWT email (043/045/046 pattern; replaces the unbound 008/031 policies) and check the target contest (open + visibility; team ⇒ creator-only fail-closed); admission triggers pin born-`open`, server-stamp `created_at`/`submitted_at`, and add rolling-24h birth throttles (constant 24, the 046 rationale). Client half: `contest.py` always stamps the email. **Prod (2026-07-19)** |
| 053 | `053_contest_use_context_guard.sql` | **Use-context guard (audit M3).** `is_license_commercial_safe()` (SQL twin of `license_use.is_commercial_safe`, token parity frozen by `arena/tests/test_launch_hardening_migrations.py`) + `contests_use_context_guard` trigger: a `use_context='commercial'` standard-lane contest requires a REGISTERED, commercial-safe-licensed dataset (unregistered/NC/SA/ND/copyleft/unstated → fail-safe refusal). 041 untouched. **Prod (2026-07-19)** |
| 054 | `054_rls_auto_enable.sql` | **RLS safety net committed (audit L1).** The dashboard-created prod event trigger `ensure_rls` + `public.rls_auto_enable()` (force-enables RLS on every new public table) transcribed VERBATIM from prod so rebuilds/branches keep the net. Idempotent; no-op on prod. **Prod (already live; recorded 2026-07-19)** |
| 055 | `055_regenerate_queue_auth.sql` | **Regenerate-queue authorization (audit M2).** `regen_state` single-row debounce table (service-role only; atomic conditional-UPDATE claim) + `notify_regenerate_queue()` replaced verbatim-plus-secret: sends Vault `regenerate_queue_secret` as `x-regen-secret`, which the hardened edge function requires in-handler (`REGEN_SHARED_SECRET`; the anon key satisfying verify_jwt was the hole). **Prod (2026-07-19)** |
| 056 | `056_trading_card_index_taxonomy_fields.sql` | **Taxonomy badging columns on `trading_card_index`** (`iso_type`, `modality`, `iso_scope`, `macrolanguage`; SSOT: `cli/shared/language-cards`) + `get_trading_card_index()` DROPped/recreated to return them (search_path re-pinned per 020/025; anon EXECUTE re-granted by Supabase defaults, intended for this public-read RPC). Closes the tc-index round-trip loss that silently zeroed the homepage living/at-risk stats; `upload-trading-cards.mjs` now preflights `iso_type` and refuses pre-056 databases. Regression suite: `cli/test/tc-index-taxonomy.test.js`. **Prod (2026-07-19, ledger `20260719050451`); rows backfilled same day server-side from the detail blobs** |
| 057 | `057_rls_initplan_perf_v2.sql` | **RLS init-plan advisor conformance v2.** Rewrites the JWT-email extraction in five 037/038/042/044-era policies (`authorization_requests_propose_own`, `sealed_sets_register_own`, `qualifiers_register_own`, `contest_intake_submit`, `contest_intake_read`) to the 008/019/043/052 house wrap form (`(((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')`). Semantics unchanged — the old form was already InitPlan-once, but the Supabase 0003 linter only recognizes the bare-call wrap; this clears the five standing `auth_rls_initplan` WARNs. **Prod (2026-07-19); advisor board zero WARNs after apply** |

> [!CAUTION]
> **Applied state (2026-07-12):** migrations **035–048 are LIVE on the
> production main project** — applied and guard-verified during the 2026-07-11
> go-live integration (036's Vault secrets + the `regenerate-queue` edge
> function are live). **034's schema is now on prod too** (applied 2026-07-11,
> AFTER 048 — see the ledger mapping below); the founder's sovereignty sign-off still
> gates *seeding/activating* the human-services lane, not the schema.
> 037–041 are Wave 1/1.5 of the
> zero-knowledge sovereign-eval PoC (the sovereign multisig plan,
> Part 5 Phase 2/3); 042–044 are Phase A of the organizer scoring node, 045 is
> Phase B's method-submission door, 046 is the organizer self-serve
> registration door (G3), 047 the shared-task edition umbrella (G5), and 048
> the function-EXECUTE hardening pass (`docs/ORGANIZER_NODE_RUNBOOK.md`).
> Apply in numeric order (037 → … → 048; the FKs require it), and never apply
> anything new to production without the founder's explicit go-ahead (root
> `CLAUDE.md`). Validate offline first with
> `python3 -m pytest arena/tests/test_sovereign_authorization_migrations.py
> arena/tests/test_contest_intake_migrations.py
> arena/tests/test_method_submission_migration.py
> arena/tests/test_registration_door_migration.py`.

## How to Apply

### Via Supabase SQL Editor (recommended)

1. Open the Supabase project dashboard
2. Navigate to SQL Editor
3. Paste the migration SQL
4. Run

### Via CLI

```bash
supabase db push
```

## Rollback

Each migration file includes rollback instructions in its header comments.
Rollbacks are manual — there is no automated rollback mechanism.

## Adding New Migrations

1. Check `DATABASE_SCHEMA.md` first — your column may already exist
2. Create a new file: `NNN_description.sql`
3. Include a header comment explaining WHAT, WHY, and ROLLBACK
4. Use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` for idempotency
5. Update `DATABASE_SCHEMA.md` with the new column(s)
6. Test on a branch database before applying to production

> [!IMPORTANT]
> **Never** add migrations to `arena/migrations/`, `cli/supabase/migrations/`,
> or `crk-translate/eval/supabase/`. Those are historical/copies only.
> All new SQL goes in this directory (`mt-eval-arena/supabase/migrations/`).

## Prod ledger mapping (audited 2026-07-12)

The prod `supabase_migrations.schema_migrations` ledger does **not** match the
canonical file names for pre-035 history — the early migrations were applied
by hand under ad-hoc names. The schema itself was **verified functionally on
prod 2026-07-12** (objects present and behaving); only the ledger *names*
diverge. **Future migrations must be applied with their canonical
`NNN_description` names** so the ledger and this directory stay 1:1 from here
on.

| Canonical file(s) | Prod ledger entry / entries | Notes |
|---|---|---|
| 001 / 002 / 009 era | `20260528023253_add_missing_columns_and_language_cards` + `20260528024953_drop_language_cards_add_datasets` | The timestamped CLI pair covers the 001/002/009-era columns and the `datasets` table. |
| 003–018 | Mostly 1:1 by description | 005 appears as `create_run_card_entries`. |
| 019 | `fix_contest_update_rls`, `fix_run_card_entries_rls`, `fix_run_cards_insert_rls` | Three ad-hoc `fix_*_rls` entries ≈ 019's coverage. |
| 020, 021 | **No ledger entries** | Objects verified present on prod (021's `run_cards_trust_check` CHECK constraint confirmed 2026-07-12). |
| 022, 023 | By name, without numbers | e.g. `quarantine_corpus_guard`, `run_cards_score_integrity`. |
| 024–026 | `p0_relaunch_hardening_024_025_026` | Applied as one bundle. |
| 027–033 | 1:1 | 032/033 under unnumbered names. |
| 034 | `20260711143242` | Applied **LAST** — after 048 — which is why 049 exists (048's hardening pass predates 034's objects on prod). |
| 035–048 | 1:1, canonical names | The 2026-07-11 go-live lane. |
| 049 | `049_advisor_hardening_v3` | Applied 2026-07-12, canonical name. |
| 050–055 | 1:1, canonical names | The 2026-07-19 anonymous-lane + launch-hardening set (founder-authorized; docs/LAUNCH_READINESS_AUDIT_2026-07-18.md §1). 054 records the DDL of the already-live dashboard-created `ensure_rls` event trigger — applying it on prod is a no-op. |

Plainly: **ledger ≠ file names for pre-035 history.** Do not "repair" the old
ledger rows; the record above is the mapping. Apply everything new under its
canonical name.
