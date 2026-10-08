-- =============================================================================
-- Migration 045: the T2 method-submission door — participant-created
--                authorization requests (Phase B, method-execution lane)
-- =============================================================================
-- Phase B (airgap method-execution appliance) of the sovereign contest
-- pipeline. In the Phase-A hypotheses lane, authorization_requests rows are
-- created by the ORGANIZER NODE (service_role) after an intake row clears the
-- qualifier. The T2 lane inverts the entry point: a participant packages a
-- runnable METHOD bundle (`mt-eval contest submit-method`,
-- arena/mt_eval_harness/method_bundle.py) and proposes its execution by
-- creating the 038 request row THEMSELVES — method_sha is now the sha of a
-- real method tarball, so the request fingerprint is truly method-bound
-- (sandbox-evaluation-spec.md §2; the fingerprint recipe is unchanged from
-- 038: method_sha \n corpus_id \n corpus_version \n 'scores-only' \n
-- node_measurement).
--
-- WHAT THIS MIGRATION ADDS (all on existing tables — no new table):
--   1. An authenticated INSERT policy on authorization_requests, bound the
--      043 way: requested_by = the JWT email, born 'pending', emit pinned
--      'scores-only', decided_at empty. Participants can PROPOSE; only the
--      custodian path (service_role + the 038 one-way trigger) can decide.
--   2. An admission trigger (043 admission-check style): the target sealed
--      set must exist and be active, and a rolling 24h per-requester
--      rate limit throttles request spam toward custodians
--      (sealed_sets.request_daily_limit — a DATA column, default 5, mirroring
--      contests.intake_daily_limit's precedent).
--   3. A pending-dedup partial unique index: one live (sealed_set_id,
--      fingerprint) proposal at a time — byte-identical resubmission while
--      the first is undecided is refused by the DB, not by app courtesy.
--
-- WHAT IT DOES NOT ADD (honest deferrals, Phase B plan):
--   * No new audit event types — 040's closed vocabulary is untouched. The
--     node appends the standard request_created/…/grant_used sequence when it
--     first acknowledges a participant-created request; airgap transport
--     metadata rides in the `detail` JSON of those existing events.
--   * No attestation: node_measurement stays the organizer-advertised,
--     self-reported node id (Wave-2 work).
--   * No TSS custody change: approval remains `mt-eval node approve`
--     (single-custodian Wave 1, honestly labeled).
--
-- CONTENT-FREE. Nothing here carries corpus or method content — the method
-- bundle bytes live in the private contest-intake bucket (044, same
-- own-email-folder RLS) or travel by sneakernet (`--bundle-out`).
--
-- Mirrors the migration-038/043 idempotent + trigger style. DEV/STAGING
-- BRANCH ONLY — do NOT apply to production without the founder's explicit
-- go-ahead (CLAUDE.md).
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS authorization_requests_propose_own ON public.authorization_requests;
--   DROP TRIGGER IF EXISTS authorization_requests_admission_guard ON public.authorization_requests;
--   DROP FUNCTION IF EXISTS public.authorization_request_admission_check();
--   DROP INDEX IF EXISTS idx_auth_requests_pending_dedup;
--   ALTER TABLE public.sealed_sets DROP COLUMN IF EXISTS request_daily_limit;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Policy data: per-set request throttle (mirrors contests.intake_daily_limit).
-- The limit is DATA — an organizer can raise it per sealed set; the default is
-- deliberately small because every custodian notification has a human cost.
-- ---------------------------------------------------------------------------
ALTER TABLE public.sealed_sets
  ADD COLUMN IF NOT EXISTS request_daily_limit INT NOT NULL DEFAULT 5
    CHECK (request_daily_limit > 0);

COMMENT ON COLUMN public.sealed_sets.request_daily_limit IS
  'Max authorization requests per requester per rolling 24h against this sealed set (anti custodian-spam throttle for the T2 method lane, enforced by authorization_request_admission_check beneath every client). Migration 045.';

-- ---------------------------------------------------------------------------
-- Pending-dedup: one live proposal per (sealed set, fingerprint). A decided
-- (authorized/denied/expired) request does not block a fresh proposal — e.g.
-- resubmitting the same method after a denial is a new custodian decision.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_requests_pending_dedup
    ON public.authorization_requests (sealed_set_id, fingerprint)
    WHERE state = 'pending';

-- ---------------------------------------------------------------------------
-- Admission guard (BEFORE INSERT) — the door checks, beneath every client
-- (service_role bypasses RLS but NOT this trigger). Applies to the Phase-A
-- node-created hypotheses-lane requests too; their volume is already bounded
-- by contests.intake_daily_limit on the SAME default, so the two throttles
-- agree by construction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.authorization_request_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_limit  int;
  v_count  int;
BEGIN
  SELECT s.status, s.request_daily_limit
    INTO v_status, v_limit
  FROM public.sealed_sets s
  WHERE s.sealed_set_id = NEW.sealed_set_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION
      'REQUEST GUARD: sealed set % is not registered.', NEW.sealed_set_id;
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION
      'REQUEST GUARD: sealed set % is ''%'' (not active) — no new evaluation may be proposed against it.',
      NEW.sealed_set_id, v_status;
  END IF;

  -- A request is born pending and undecided; decisions belong to the
  -- custodian path (038 one-way trigger governs everything after birth).
  IF NEW.state <> 'pending' THEN
    RAISE EXCEPTION
      'REQUEST GUARD: a request must be born ''pending'' (got ''%'') — authorization decisions are the custodians'' to make.',
      NEW.state;
  END IF;
  IF NEW.decided_at IS NOT NULL THEN
    RAISE EXCEPTION
      'REQUEST GUARD: decided_at cannot be set at proposal time.';
  END IF;

  -- Rolling 24h per-requester throttle (custodian attention is a cost).
  IF NEW.requested_by IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.authorization_requests r
    WHERE r.sealed_set_id = NEW.sealed_set_id
      AND r.requested_by  = NEW.requested_by
      AND r.created_at    > NOW() - INTERVAL '24 hours';

    IF v_count >= v_limit THEN
      RAISE EXCEPTION
        'REQUEST GUARD: % has reached the % requests / 24h limit for sealed set % (sealed_sets.request_daily_limit).',
        NEW.requested_by, v_limit, NEW.sealed_set_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.authorization_request_admission_check() IS
    'Proposal door checks beneath every client: sealed set exists + active, request born pending/undecided, rolling 24h per-requester rate limit (sealed_sets.request_daily_limit). Un-bypassable (service_role does not bypass triggers). Migration 045.';

DROP TRIGGER IF EXISTS authorization_requests_admission_guard ON public.authorization_requests;
CREATE TRIGGER authorization_requests_admission_guard
    BEFORE INSERT ON public.authorization_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.authorization_request_admission_check();

-- ---------------------------------------------------------------------------
-- Row-Level Security: the participant proposal door.
-- 038 already grants anon SELECT (the queue is public evidence) and reserves
-- every UPDATE to service_role. This policy opens INSERT to authenticated
-- participants, identity-bound the 043 way. The 038 CHECK constraints pin
-- emit='scores-only' and the state vocabulary; the trigger above pins
-- born-pending; this policy pins WHO: you propose as yourself.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS authorization_requests_propose_own ON public.authorization_requests;
CREATE POLICY authorization_requests_propose_own
    ON public.authorization_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
      requested_by = current_setting('request.jwt.claims', true)::json->>'email'
      AND state = 'pending'
      AND emit  = 'scores-only'
    );
