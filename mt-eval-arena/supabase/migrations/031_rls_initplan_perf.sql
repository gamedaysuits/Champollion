-- ==========================================================================
-- Migration 031 — RLS init-plan performance hardening (scale readiness)
--
-- Supabase performance advisor (lint 0003, auth_rls_initplan) flagged 7 RLS
-- policies that call auth.<fn>() / current_setting() *per row*, which is
-- suboptimal at scale. The fix is to wrap each such call in a scalar
-- subselect — `(select auth.uid())`, `(select current_setting(...))` — so the
-- planner evaluates it ONCE per query (an initplan) instead of once per row.
--
-- This changes ONLY the evaluation strategy. Every policy's authorization
-- logic, role, command, and shape is preserved byte-for-byte from the live
-- production definitions (verified 2026-06-16). The two `true` read policies
-- (run_cards / run_card_entries "Public read") are untouched — they call no
-- auth function.
--
-- Idempotent (DROP POLICY IF EXISTS + CREATE). Safe on prod and fresh branches;
-- recreates each flagged policy's final state regardless of prior history
-- (e.g. run_cards insert already carries 027's owner_uid binding).
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ==========================================================================

-- run_cards: authenticated insert (trust + owner binding preserved) -----------
DROP POLICY IF EXISTS "Authenticated users can insert" ON run_cards;
CREATE POLICY "Authenticated users can insert" ON run_cards
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL)
    AND (trust = 'unverified'::text)
    AND (id IS NOT NULL)
    AND (length(id) > 10)
    AND (owner_uid = (SELECT auth.uid()))
  );

-- run_card_entries: owner insert ---------------------------------------------
DROP POLICY IF EXISTS "Owner insert" ON run_card_entries;
CREATE POLICY "Owner insert" ON run_card_entries
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL)
    AND (EXISTS (
      SELECT 1 FROM run_cards rc
      WHERE ((rc.id = run_card_entries.run_card_id) AND (rc.owner_uid = (SELECT auth.uid())))
    ))
  );

-- contests: authenticated create ---------------------------------------------
DROP POLICY IF EXISTS "Authenticated create contests" ON contests;
CREATE POLICY "Authenticated create contests" ON contests
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- contests: read public and private ------------------------------------------
DROP POLICY IF EXISTS "Read public and private contests" ON contests;
CREATE POLICY "Read public and private contests" ON contests
  AS PERMISSIVE FOR SELECT TO public
  USING (
    (visibility = ANY (ARRAY['public'::text, 'private'::text]))
    OR ((SELECT auth.uid()) IS NOT NULL)
  );

-- contests: owner update ------------------------------------------------------
DROP POLICY IF EXISTS "Owner update contests" ON contests;
CREATE POLICY "Owner update contests" ON contests
  AS PERMISSIVE FOR UPDATE TO public
  USING (
    created_by = (((SELECT current_setting('request.jwt.claims'::text, true))::json) ->> 'email'::text)
  );

-- contest_submissions: authenticated submit ----------------------------------
DROP POLICY IF EXISTS "Authenticated submit" ON contest_submissions;
CREATE POLICY "Authenticated submit" ON contest_submissions
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- contest_submissions: read own or public ------------------------------------
DROP POLICY IF EXISTS "Read own or public submissions" ON contest_submissions;
CREATE POLICY "Read own or public submissions" ON contest_submissions
  AS PERMISSIVE FOR SELECT TO public
  USING (
    (EXISTS (
      SELECT 1 FROM contests c
      WHERE ((c.id = contest_submissions.contest_id) AND (c.visibility = 'public'::text))
    ))
    OR (submitted_by = (((SELECT current_setting('request.jwt.claims'::text, true))::json) ->> 'email'::text))
    OR (EXISTS (
      SELECT 1 FROM contests c
      WHERE ((c.id = contest_submissions.contest_id)
        AND (c.created_by = (((SELECT current_setting('request.jwt.claims'::text, true))::json) ->> 'email'::text)))
    ))
  );
