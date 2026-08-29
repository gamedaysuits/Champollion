-- 052_contest_identity_binding.sql
--
-- THE HOLE (launch-readiness audit 2026-07-18, M1). The migration-008 INSERT
-- policies on contests / contest_submissions (preserved verbatim through the
-- 031 initplan rewrite) checked only `auth.uid() IS NOT NULL`:
--
--   · created_by / submitted_by were NEVER bound to the JWT — any signed-in
--     account could create a contest or submission attributed to ANY string
--     (impersonation; DATABASE_SCHEMA.md's "(from auth)" claim was doc drift);
--   · contest_submissions ignored the target contest entirely — spam could be
--     inserted into closed contests, and into team contests by non-members;
--   · neither table had a birth throttle, unlike every later door
--     (043 intake, 045 proposals, 046 registrations).
--
-- THIS MIGRATION binds identity exactly the 043/045/046 way and adds the
-- missing admission rails:
--
--   1. INSERT policies (authenticated lane) bind created_by / submitted_by to
--      the JWT EMAIL — you create and submit as yourself. This also fixes the
--      latent 008 bug contest.py's own docstring documents: "Owner update
--      contests" always compared created_by against the email, so a contest
--      created under a display name could never be updated by its owner.
--      (Client fix ships with this migration: contest.py now always stamps
--      the email.)
--   2. The submissions policy checks the TARGET CONTEST: it must exist, be
--      status='open', and be visible-for-submission — public and private
--      contests accept any authenticated submitter (the 008 privacy model:
--      private hides SCORES, not the door); a team contest accepts only its
--      creator until team membership exists as a JWT claim (fail-closed —
--      the 008 header's "checked in the Python layer" was no check at all).
--   3. Admission triggers (043/045/046 style, beneath every client and key):
--      contests are born status='open' with a non-empty created_by;
--      timestamps are SERVER-STAMPED (a client-supplied created_at /
--      submitted_at could otherwise backdate out of the throttle window);
--      rolling 24h birth throttles — 24 contests / creator / 24h (the 046
--      registration-door constant and rationale: roots of the object graph
--      carry the limit as a documented constant) and 24 submissions /
--      submitter / contest / 24h (bounds link-spam; the hypotheses lane has
--      its own tighter 043 throttle).
--
-- SERVICE/CURATOR LANE. service_role bypasses the RLS policies (unchanged —
-- the organizer node and curator scripts keep working) but NOT the admission
-- triggers: born-open, server timestamps, and the throttles hold beneath
-- every key, the 043 posture.
--
-- Idempotent (DROP POLICY/TRIGGER IF EXISTS + CREATE OR REPLACE). DEV/STAGING
-- BRANCH ONLY without the founder's explicit go-ahead (CLAUDE.md); applied to
-- prod 2026-07-18 under the founder's launch-hardening authorization.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS contests_admission_guard ON public.contests;
--   DROP FUNCTION IF EXISTS public.contest_admission_check();
--   DROP TRIGGER IF EXISTS contest_submissions_admission_guard ON public.contest_submissions;
--   DROP FUNCTION IF EXISTS public.contest_submission_admission_check();
--   DROP POLICY IF EXISTS contests_create_own ON public.contests;
--   DROP POLICY IF EXISTS contest_submissions_submit_own ON public.contest_submissions;
--   -- then re-apply 031 to restore the previous (unbound) INSERT policies.

-- ---------------------------------------------------------------------------
-- Indexes for the rolling-24h throttle lookups (043/045/046 precedent).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contests_creator
    ON public.contests (created_by, created_at);

CREATE INDEX IF NOT EXISTS idx_cs_submitter
    ON public.contest_submissions (contest_id, submitted_by, submitted_at);

-- ---------------------------------------------------------------------------
-- Admission guard: contests (BEFORE INSERT).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  -- Births per creator per rolling 24h. A named constant (the 046 rationale:
  -- a contest is a root object with no parent row to carry policy data),
  -- sized to an AmericasNLP-scale multi-pair edition in one sitting while
  -- still bounding registry spam.
  v_limit CONSTANT int := 24;
  v_count int;
BEGIN
  IF NEW.created_by IS NULL OR btrim(NEW.created_by) = '' THEN
    RAISE EXCEPTION
      'CONTEST GUARD: created_by must be a non-empty identity (the JWT email for the self-serve lane).';
  END IF;

  -- Born at the start of its lifecycle: 'open'. closed/archived are
  -- lifecycle END states — history cannot be inserted (the 043/046 posture).
  IF NEW.status <> 'open' THEN
    RAISE EXCEPTION
      'CONTEST GUARD: a contest must be born ''open'' (got ''%'') — closed/archived are lifecycle end-states, reached by the owner-update lane.',
      NEW.status;
  END IF;

  -- Server-stamped birth time: the throttle below counts created_at, so a
  -- client-supplied timestamp could otherwise backdate out of the window.
  NEW.created_at := now();

  SELECT COUNT(*) INTO v_count
  FROM public.contests c
  WHERE c.created_by = NEW.created_by
    AND c.created_at > NOW() - INTERVAL '24 hours';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION
      'CONTEST GUARD: % has reached the % contest creations / 24h limit — contests are public surface; creation is throttled against spam.',
      NEW.created_by, v_limit;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_admission_check() IS
    'Contest birth door beneath every client and key: non-empty created_by, born ''open'', server-stamped created_at, rolling 24h per-creator throttle (constant 24, the 046 registration-door rationale). Un-bypassable (service_role does not bypass triggers). Migration 052.';

DROP TRIGGER IF EXISTS contests_admission_guard ON public.contests;
CREATE TRIGGER contests_admission_guard
    BEFORE INSERT ON public.contests
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_admission_check();

-- ---------------------------------------------------------------------------
-- Admission guard: contest_submissions (BEFORE INSERT).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_submission_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_limit CONSTANT int := 24;  -- links / submitter / contest / rolling 24h
  v_count int;
BEGIN
  IF NEW.submitted_by IS NULL OR btrim(NEW.submitted_by) = '' THEN
    RAISE EXCEPTION
      'SUBMISSION GUARD: submitted_by must be a non-empty identity (the JWT email for the self-serve lane).';
  END IF;

  -- Server-stamped submission time (throttle integrity, as above).
  NEW.submitted_at := now();

  SELECT COUNT(*) INTO v_count
  FROM public.contest_submissions cs
  WHERE cs.contest_id   = NEW.contest_id
    AND cs.submitted_by = NEW.submitted_by
    AND cs.submitted_at > NOW() - INTERVAL '24 hours';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION
      'SUBMISSION GUARD: % has reached the % submissions / 24h limit for contest % — submission links are throttled against spam (the hypotheses lane has its own 043 intake_daily_limit).',
      NEW.submitted_by, v_limit, NEW.contest_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_submission_admission_check() IS
    'Submission birth door beneath every client and key: non-empty submitted_by, server-stamped submitted_at, rolling 24h per-(submitter, contest) throttle (constant 24). Un-bypassable (service_role does not bypass triggers). Migration 052.';

DROP TRIGGER IF EXISTS contest_submissions_admission_guard ON public.contest_submissions;
CREATE TRIGGER contest_submissions_admission_guard
    BEFORE INSERT ON public.contest_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_submission_admission_check();

-- ---------------------------------------------------------------------------
-- Row-Level Security: identity-bound INSERT doors (the 043/045/046 shape,
-- with 031's initplan discipline — auth calls wrapped in scalar subselects).
-- ---------------------------------------------------------------------------

-- contests: replace the unbound 008/031 policy.
DROP POLICY IF EXISTS "Authenticated create contests" ON public.contests;
DROP POLICY IF EXISTS contests_create_own ON public.contests;
CREATE POLICY contests_create_own
    ON public.contests
    FOR INSERT
    TO authenticated
    WITH CHECK (
      created_by = ((SELECT current_setting('request.jwt.claims', true))::json ->> 'email')
    );

-- contest_submissions: replace the unbound 008/031 policy; the door now
-- checks the TARGET CONTEST too.
DROP POLICY IF EXISTS "Authenticated submit" ON public.contest_submissions;
DROP POLICY IF EXISTS contest_submissions_submit_own ON public.contest_submissions;
CREATE POLICY contest_submissions_submit_own
    ON public.contest_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
      submitted_by = ((SELECT current_setting('request.jwt.claims', true))::json ->> 'email')
      AND EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = contest_submissions.contest_id
          AND c.status = 'open'
          AND (
            -- public + private accept any authenticated submitter (the 008
            -- privacy model hides private SCORES, not the submission door)…
            c.visibility IN ('public', 'private')
            -- …team contests accept only their creator until team membership
            -- exists as a JWT claim (fail-closed; the organizer/service lane
            -- bypasses RLS for node-published team results).
            OR (
              c.visibility = 'team'
              AND c.created_by = ((SELECT current_setting('request.jwt.claims', true))::json ->> 'email')
            )
          )
      )
    );
