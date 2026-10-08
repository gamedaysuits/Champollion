-- ---------------------------------------------------------------------------
-- Migration 075: authorization_requests gains a terminal 'completed' state.
--
-- WHY. Migration 038 gave the request queue a one-way state machine that ends
-- at authorized: a request that has been scored, relayed and published stays
-- 'authorized' forever. Wave 2 recorded the consequence as "the deferred PK is
-- the done-marker" — done-ness lived anywhere but on the request row.
--
-- For the air-gap lane (B3) that anywhere is a FILE ON THE REMOVABLE MEDIUM.
-- `airgap_transport.export_requests` selects state='authorized' and skips a
-- request only when the exchange directory already holds its request folder or
-- the scores/<id>/.relayed.json done-marker its import half wrote. Both live on
-- the drive. So a relay pass run against a FRESH medium — a drive lost,
-- reformatted, or simply a second one — re-exports a request whose scores were
-- published days ago, writing a participant's method tarball back onto
-- removable media for nothing. The 2026-09-07 sovereign rehearsal measured the
-- same waste one drive over (see docs/SOVEREIGN_SMOKE_2026-09-07.md); ordering
-- the relay's two halves fixed the single-medium case and could not fix this
-- one, because the medium is not the source of truth. This migration moves
-- done-ness onto the row, where a fresh drive cannot forget it.
--
-- WHAT 'completed' MEANS, exactly: this authorized request's result has been
-- RECORDED — published to run_cards, or withheld into contest_deferred_results
-- for a contest close. It does NOT mean "the method ran". A run that failed or
-- was refused by the scoring node records nothing and leaves the request
-- authorized, because that work can legitimately be carried again; the spec
-- §9.4 posture (a crashed run needs a fresh proposal, not a re-run of a spent
-- grant) is unchanged and is enforced by the single-use grant, not by this
-- state.
--
-- SAFETY. Purely additive: one more allowed value and one more allowed edge.
-- No existing row changes, no backfill (an already-relayed request stays
-- 'authorized' and is still protected by its spent single-use grant and by its
-- medium's marker — this closes the gap going forward rather than rewriting
-- history it cannot verify). Nothing may leave 'completed': it is terminal in
-- the same sense as 'denied'.
--
-- Rollback (only meaningful before any row reaches 'completed'):
--   UPDATE public.authorization_requests SET state = 'authorized'
--     WHERE state = 'completed';                      -- guard blocks this;
--     -- drop the trigger first, then restore the 038 function + constraint:
--   ALTER TABLE public.authorization_requests DROP CONSTRAINT authorization_requests_state_check;
--   ALTER TABLE public.authorization_requests ADD CONSTRAINT authorization_requests_state_check
--       CHECK (state IN ('pending', 'authorized', 'denied', 'expired'));
--   -- then re-apply migration 038's reject_illegal_request_transition().
-- ---------------------------------------------------------------------------

BEGIN;

-- 1. Widen the allowed set. The constraint is named in 038 by Postgres's
--    default (<table>_<column>_check); drop-and-recreate keeps that name.
ALTER TABLE public.authorization_requests
    DROP CONSTRAINT IF EXISTS authorization_requests_state_check;

ALTER TABLE public.authorization_requests
    ADD CONSTRAINT authorization_requests_state_check
    CHECK (state IN ('pending', 'authorized', 'denied', 'expired', 'completed'));

COMMENT ON COLUMN public.authorization_requests.state IS
    'pending -> {authorized, denied, expired}; authorized -> {expired, completed}. '
    'completed (075) means the result was RECORDED — published to run_cards or '
    'withheld to contest_deferred_results — and is what stops a relay from '
    're-exporting the request onto a fresh exchange medium. It does NOT mean the '
    'method ran: a failed or refused run records nothing and stays authorized. '
    'Terminal states (denied/expired/completed) and any backward edge are '
    'rejected by reject_illegal_request_transition(). The fingerprint/method/'
    'corpus/node fields are frozen after creation.';

-- 2. Teach the one-way guard the new edge. Replaces the 074 body; every other
--    rule (frozen request terms, terminal states, no backward edges, and 074's
--    closed decision record) is carried over verbatim so this migration is
--    readable as a whole function rather than a diff. (The first draft of this
--    migration was written from 038's body and would have dropped 074's
--    decided_at block; corrected before it was applied anywhere, 2026-09-28.)
CREATE OR REPLACE FUNCTION public.reject_illegal_request_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Request terms are frozen at creation — the fingerprint and every input
  -- that produced it is immutable, so a grant can never be re-bound by editing
  -- the request out from under it.
  IF NEW.fingerprint     IS DISTINCT FROM OLD.fingerprint
     OR NEW.method_sha       IS DISTINCT FROM OLD.method_sha
     OR NEW.corpus_id        IS DISTINCT FROM OLD.corpus_id
     OR NEW.corpus_version   IS DISTINCT FROM OLD.corpus_version
     OR NEW.node_measurement IS DISTINCT FROM OLD.node_measurement
     OR NEW.sealed_set_id    IS DISTINCT FROM OLD.sealed_set_id
     OR NEW.emit             IS DISTINCT FROM OLD.emit THEN
    RAISE EXCEPTION
      'AUTH REQUEST GUARD: request % terms are immutable (fingerprint/method/corpus/version/node/sealed_set/emit cannot change after creation).',
      OLD.request_id;
  END IF;

  -- One-way state machine.
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF OLD.state = 'pending' AND NEW.state IN ('authorized', 'denied', 'expired') THEN
      NULL;  -- allowed
    ELSIF OLD.state = 'authorized' AND NEW.state IN ('expired', 'completed') THEN
      NULL;  -- an authorized request may lapse, or have its result recorded (075)
    ELSE
      RAISE EXCEPTION
        'AUTH REQUEST GUARD: illegal state transition % -> % for request % (allowed: pending->authorized/denied/expired, authorized->expired/completed).',
        OLD.state, NEW.state, OLD.request_id;
    END IF;
  END IF;

  -- 074: once the custodians have DECIDED, the record of the decision is
  -- closed. execution_diagnostics is the single exception — the node reports
  -- counts-only diagnostics back against an already-decided request — and the
  -- state may still move under the machine above (authorized -> expired, or
  -- -> completed once the result is recorded, 075).
  IF OLD.decided_at IS NOT NULL THEN
    IF NEW.request_id   IS DISTINCT FROM OLD.request_id
       OR NEW.threshold    IS DISTINCT FROM OLD.threshold
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION
        'AUTH REQUEST GUARD: request % is decided (%) — only execution_diagnostics may still be written; the decision record is closed.',
        OLD.request_id, OLD.decided_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_illegal_request_transition() IS
    'Enforces the one-way authorization_requests state machine (075: authorized->completed, terminal), freezes the fingerprint/method/corpus/version/node/sealed_set/emit terms after creation, and closes the decision record once decided (074; execution_diagnostics excepted). Un-bypassable (service_role does not bypass triggers). the sovereign multisig plan M2/M4.';

-- The 038 trigger already points at this function by name; recreated here so a
-- database that somehow lost it comes back consistent.
DROP TRIGGER IF EXISTS authorization_requests_transition_guard ON public.authorization_requests;
CREATE TRIGGER authorization_requests_transition_guard
    BEFORE UPDATE ON public.authorization_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_illegal_request_transition();

COMMIT;
