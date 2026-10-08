-- ==========================================================================
-- Migration 019 — run_cards INSERT/UPDATE policy parity + trust hardening
--
-- Context (2026-06-11 audit): prod carries a dashboard-applied patch
-- ("fix_run_cards_insert_rls", version 20260607172331) that replaced the
-- original anonymous-insert policy with authenticated-only insert, plus an
-- owner-update policy ("Users can update their own submissions"). Neither
-- was reflected in the repo migration files. This migration:
--   1. Codifies prod's authenticated-only insert and owner-update policies.
--   2. RESTORES the trust='unverified' WITH CHECK that the prod patch
--      dropped — without it, any authenticated user could insert rows
--      pre-marked 'verified'. Trust elevation must remain service-role-only.
--   3. DROPS prod's "Users can update their own submissions" policy WITHOUT
--      replacement. Supabase advisor flags it as an ERROR: it matches
--      `submitter` against auth.jwt user_metadata (preferred_username /
--      full_name), which END USERS CAN EDIT — any signed-in user could
--      impersonate another submitter and mutate their rows. Submissions are
--      immutable by design (DATABASE_SCHEMA.md); moderation is service-role
--      via the dashboard, and migration 017's audit trail records any change.
--
-- Idempotent; safe on both prod (tightens insert, removes vulnerable update
-- path) and fresh branches.
-- ==========================================================================

DROP POLICY IF EXISTS "Anonymous insert access" ON run_cards;
DROP POLICY IF EXISTS "Authenticated users can insert" ON run_cards;
CREATE POLICY "Authenticated users can insert" ON run_cards
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND trust = 'unverified'
    AND id IS NOT NULL
    AND length(id) > 10
  );

DROP POLICY IF EXISTS "Users can update their own submissions" ON run_cards;
