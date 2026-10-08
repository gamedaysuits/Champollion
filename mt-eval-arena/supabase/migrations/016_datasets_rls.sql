-- ==========================================================================
-- Migration 016: Restrict anonymous reads of held-out dataset metadata
--
-- PROBLEM: The datasets table (created by CLI migration 20260528024953,
-- reconciled by arena migration 011) had a blanket public-read policy:
--
--   CREATE POLICY "datasets_public_read" ON datasets FOR SELECT USING (TRUE);
--
-- The table is metadata-only (no corpus content), but rows where
-- segment IN ('held_out', 'gold_standard') describe secret evaluation
-- corpora — entry counts, sha256 content hashes, and notes that should
-- not be enumerable by anonymous leaderboard visitors (a sha256 of a
-- small corpus is an oracle for contamination probing).
--
-- WHAT THIS DOES:
--   1. Ensures RLS is enabled on datasets (idempotent).
--   2. Replaces the blanket public-read policy with:
--      - anon: can SELECT only non-held-out segments (development,
--        diagnostic, or NULL segment) — existing public reads preserved.
--      - authenticated: full SELECT (unchanged behavior for signed-in
--        harness users).
--   3. service_role is unaffected — it bypasses RLS entirely.
--
-- The segment column is TEXT NOT NULL DEFAULT 'development' with
-- CHECK (segment IN ('development', 'diagnostic', 'gold_standard',
-- 'held_out')) per the CLI migration; the NULL guard below is
-- belt-and-braces in case the constraint is ever relaxed.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS "datasets_anon_read_public_segments" ON datasets;
--   DROP POLICY IF EXISTS "datasets_authenticated_read" ON datasets;
--   CREATE POLICY "datasets_public_read" ON datasets FOR SELECT USING (TRUE);
-- ==========================================================================

-- 1. Enable RLS (no-op if already enabled)
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;

-- 2. Drop the blanket public-read policy (idempotent)
DROP POLICY IF EXISTS "datasets_public_read" ON datasets;

-- 3. Anonymous read — public segments only
DROP POLICY IF EXISTS "datasets_anon_read_public_segments" ON datasets;
CREATE POLICY "datasets_anon_read_public_segments" ON datasets
    FOR SELECT
    TO anon
    USING (segment IS NULL OR segment NOT IN ('held_out', 'gold_standard'));

-- 4. Authenticated read — unrestricted (matches pre-016 behavior for
--    signed-in users; the write policy "datasets_auth_write" from the
--    CLI migration is untouched)
DROP POLICY IF EXISTS "datasets_authenticated_read" ON datasets;
CREATE POLICY "datasets_authenticated_read" ON datasets
    FOR SELECT
    TO authenticated
    USING (TRUE);
