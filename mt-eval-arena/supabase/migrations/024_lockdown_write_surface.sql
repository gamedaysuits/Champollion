-- Migration 024 — lock down the write surface (post-launch-audit, 2026-06-14)
--
-- Live-prod audit (2026-06-14) found two write paths broader than intended,
-- both reachable by any *authenticated* user (a free GitHub/Google account):
--
--   1. `datasets` had `datasets_auth_write` = FOR ALL to `authenticated`.
--      A logged-in user could UPDATE datasets.sha256 (defeating the corpus
--      sha-binding integrity check — re-point a dataset id at an easy/leaked
--      corpus), set `quarantined = false` (un-quarantine an improper slice),
--      or change `segment` to expose held_out/gold_standard. The corpus
--      registry must be curator-owned: writes go through service_role
--      (build_registry + the upload pipeline), never the public API.
--
--      Safe to remove: the harness publish path treats the datasets upsert as
--      non-fatal secondary metadata (publish.py ~1616, "Dataset upsert
--      skipped") — the run_card (primary) still publishes. Reads are
--      unchanged (datasets_anon_read_public_segments +
--      datasets_authenticated_read both remain).
--
--   2. `run_card_entries` allowed UPDATE by any authenticated user, so one
--      user could rewrite another user's per-entry drill-down rows. Entries
--      are evidence — INSERT-only, like run_cards. The paired publish.py
--      change switches entry upserts to ignore-duplicates so idempotent
--      re-publish no longer needs an UPDATE policy.
--
-- Idempotent. service_role bypasses RLS, so curator/CI writes are unaffected.

-- 1. datasets — curator-only writes (service_role). Drop the broad write
--    policy and any earlier-named variants (branch safety). SELECT policies
--    are left intact.
DROP POLICY IF EXISTS datasets_auth_write                ON datasets;
DROP POLICY IF EXISTS datasets_authenticated_write       ON datasets;
DROP POLICY IF EXISTS "Authenticated can write datasets" ON datasets;

-- 2. run_card_entries — INSERT-only for authenticated; drop the open UPDATE.
--    (INSERT + public SELECT policies remain.)
DROP POLICY IF EXISTS "Authenticated update"               ON run_card_entries;
DROP POLICY IF EXISTS run_card_entries_authenticated_update ON run_card_entries;
