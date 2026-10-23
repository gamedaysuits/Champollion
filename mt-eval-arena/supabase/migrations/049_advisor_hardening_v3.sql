-- =============================================================================
-- 049_advisor_hardening_v3 — close the two advisor findings from the
-- 2026-07-12 pre-launch audit (docs/TOOLING_AUDIT_2026-07-12.md TA-05 + TA-09).
--
-- 1. TA-05 (security WARN): public.get_services_for_pair (034) has a mutable
--    search_path. 034 was applied to prod AFTER 048_function_execute_hardening
--    (ledger: 20260711143242 vs 20260711140918), so it missed the hardening
--    pass. Pin it exactly as 048 pinned every other function.
--
-- 2. TA-09 (performance WARN x5): the door policies added by 042–046 call
--    current_setting('request.jwt.claims', …) directly, which Postgres
--    re-evaluates per row. 031_rls_initplan_perf converted every older policy
--    to the (SELECT …) initplan form; these five were written after 031 and
--    reintroduced the pattern. Recreate them with identical predicates, JWT
--    reads wrapped in scalar subselects. No semantic change: same roles, same
--    checks, same rows pass.
--
-- Rollback:
--   ALTER FUNCTION public.get_services_for_pair(TEXT, TEXT) RESET search_path;
--   Re-run the CREATE POLICY blocks from 043 (contest_intake_submit/read),
--   045 (authorization_requests_propose_own), and 046
--   (sealed_sets_register_own, qualifiers_register_own).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pin get_services_for_pair (the one function 048 could not have seen)
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.get_services_for_pair(TEXT, TEXT)
  SET search_path = public;

-- ---------------------------------------------------------------------------
-- 2. Door policies → initplan form ((SELECT …) evaluates once per statement)
-- ---------------------------------------------------------------------------

-- 045: propose an authorization request (scores-only emit, born pending)
DROP POLICY IF EXISTS authorization_requests_propose_own ON public.authorization_requests;
CREATE POLICY authorization_requests_propose_own
    ON public.authorization_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
      requested_by = (SELECT current_setting('request.jwt.claims', true)::json->>'email')
      AND state = 'pending'
      AND emit  = 'scores-only'
    );

-- 046: self-serve sealed-set registration (born quarantined + safe-state)
DROP POLICY IF EXISTS sealed_sets_register_own ON public.sealed_sets;
CREATE POLICY sealed_sets_register_own
    ON public.sealed_sets
    FOR INSERT
    TO authenticated
    WITH CHECK (
      created_by = (SELECT current_setting('request.jwt.claims', true)::json->>'email')
      AND quarantined = true
      AND status IN ('planned', 'active')
    );

-- 046: self-serve qualifier registration (ownership EXISTS preserved verbatim)
DROP POLICY IF EXISTS qualifiers_register_own ON public.qualifiers;
CREATE POLICY qualifiers_register_own
    ON public.qualifiers
    FOR INSERT
    TO authenticated
    WITH CHECK (
      created_by = (SELECT current_setting('request.jwt.claims', true)::json->>'email')
      AND status = 'active'
      -- You may only gate a sealed set YOU registered: the node resolves the
      -- active qualifier per set, so the gate is security-load-bearing.
      -- Curator-registered sets (created_by NULL) stay curator-gated.
      AND (
        sealed_set_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.sealed_sets s
          WHERE s.sealed_set_id = qualifiers.sealed_set_id
            AND s.created_by = (SELECT current_setting('request.jwt.claims', true)::json->>'email')
        )
      )
    );

-- 043: contest submission intake (identity-bound insert)
DROP POLICY IF EXISTS contest_intake_submit ON public.contest_intake;
CREATE POLICY contest_intake_submit
    ON public.contest_intake
    FOR INSERT
    TO authenticated
    WITH CHECK (
      submitted_by = (SELECT current_setting('request.jwt.claims', true)::json->>'email')
    );

-- 043: intake visibility (public contests, own rows, or organizer)
DROP POLICY IF EXISTS contest_intake_read ON public.contest_intake;
CREATE POLICY contest_intake_read
    ON public.contest_intake
    FOR SELECT
    TO anon, authenticated
    USING (
      -- Public contests: submission lifecycles are public (scores publish anyway)
      EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = contest_intake.contest_id
          AND c.visibility = 'public'
      )
      -- Otherwise: your own submissions…
      OR submitted_by = (SELECT current_setting('request.jwt.claims', true)::json->>'email')
      -- …or you are the contest creator (the organizer).
      OR EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = contest_intake.contest_id
          AND c.created_by = (SELECT current_setting('request.jwt.claims', true)::json->>'email')
      )
    );
