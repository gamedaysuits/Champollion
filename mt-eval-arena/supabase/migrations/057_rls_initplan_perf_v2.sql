-- =============================================================================
-- Migration 057: RLS init-plan advisor conformance v2 (sovereign/intake lane)
-- =============================================================================
-- WHAT
--   Rewrites the JWT-email extraction in five RLS policies from the
--   037/038/042/044-era form
--
--     ( SELECT ((current_setting('request.jwt.claims', true))::json ->> 'email') )
--
--   to the 008/019/043/052 house form the rest of the schema uses
--
--     ((( SELECT current_setting('request.jwt.claims', true) ))::json ->> 'email')
--
--   on: authorization_requests_propose_own, sealed_sets_register_own,
--   qualifiers_register_own, contest_intake_submit, contest_intake_read.
--
-- WHY
--   Both forms evaluate current_setting() ONCE per statement (the scalar
--   subquery is an InitPlan either way) — this is an ADVISOR-CONFORMANCE and
--   consistency fix, not a real per-row-re-evaluation bug. The Supabase
--   database linter (0003_auth_rls_initplan) only recognizes the wrap when
--   the subselect's immediate body is the bare current_setting()/auth.*()
--   call; wrapping the whole json-extraction inside the subselect is
--   semantically identical but gets flagged WARN. Normalizing to the house
--   form clears the five standing WARNs so the advisor board reads clean,
--   and makes every JWT-email policy in the schema textually uniform.
--
--   Semantics are UNCHANGED — the expressions below are transcriptions of
--   the live policy definitions (pg_policies, 2026-07-19) with only the
--   wrap shape moved. Guard triggers and all other policy conditions are
--   untouched.
--
-- ROLLBACK
--   Re-apply the previous expressions (semantically identical; see the
--   2026-07-19 pg_policies capture in the migration PR / session log), or
--   simply leave in place — behavior is the same either way.
-- =============================================================================

ALTER POLICY authorization_requests_propose_own ON authorization_requests
  WITH CHECK (
    (requested_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    AND (state = 'pending')
    AND (emit = 'scores-only')
  );

ALTER POLICY sealed_sets_register_own ON sealed_sets
  WITH CHECK (
    (created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    AND (quarantined = true)
    AND (status = ANY (ARRAY['planned'::text, 'active'::text]))
  );

ALTER POLICY qualifiers_register_own ON qualifiers
  WITH CHECK (
    (created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    AND (status = 'active')
    AND (
      (sealed_set_id IS NULL)
      OR (EXISTS (
        SELECT 1 FROM sealed_sets s
        WHERE s.sealed_set_id = qualifiers.sealed_set_id
          AND s.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')
      ))
    )
  );

ALTER POLICY contest_intake_submit ON contest_intake
  WITH CHECK (
    submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')
  );

ALTER POLICY contest_intake_read ON contest_intake
  USING (
    (EXISTS (
      SELECT 1 FROM contests c
      WHERE c.id = contest_intake.contest_id AND c.visibility = 'public'
    ))
    OR (submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    OR (EXISTS (
      SELECT 1 FROM contests c
      WHERE c.id = contest_intake.contest_id
        AND c.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')
    ))
  );
