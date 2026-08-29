-- =============================================================================
-- Migration 038: authorization_requests — the pending-authorization queue state
-- =============================================================================
-- Wave 1 (data backbone) of the zero-knowledge sovereign-eval PoC.
-- Implements the DATA half of the sovereign multisig plan M2 / Part 5 Phase 2: any
-- access to (or benchmark run against) a sealed set is NOT executed inline — it
-- enters a `pending` state and waits for an M-of-N custodian decision. This
-- migration records the request; migration 039 records the time-boxed,
-- single-use grant that an authorized request can mint; migration 040 records
-- the tamper-evident audit trail. The real threshold signing is Wave 2 — at the
-- data layer here, the guarantee is that a request carries an immutable
-- fingerprint and can only move pending -> {authorized, denied, expired} along
-- a one-way state machine.
--
-- THE FINGERPRINT (the sovereign multisig plan, M2 step 3 — a grant is "bound to the
-- specific request fingerprint"). The fingerprint is computed by the
-- application (arena/mt_eval_harness/queue_runner.py compute_request_fingerprint)
-- as the SHA-256 hex of the newline-joined tuple:
--     method_tarball_sha \n corpus_id \n corpus_version \n 'scores-only' \n node_measurement
-- and STORED here. A grant (039) is valid only for a request with this exact
-- fingerprint, so a grant minted for one (method, sealed corpus version, node)
-- cannot be replayed against another. The component fields are also stored
-- individually (method_sha / corpus_version / node_measurement) so an inspector
-- can recompute and verify the fingerprint.
--
-- SCORES-ONLY (M5). `emit` is pinned to 'scores-only' (CHECK) — the only thing
-- that may ever leave a sealed evaluation is a score, never per-entry text. This
-- is belt-and-suspenders with the L3 publish gate and the migration-033 trigger.
--
-- CONTENT-FREE. Like sealed_sets, this table has NO source/reference/expected/
-- plaintext column — it describes a request, it does not carry corpus content.
--
-- Mirrors the migration-033/022 idempotent + trigger style. CREATE ... IF NOT
-- EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS. DEV/STAGING BRANCH ONLY — do
-- NOT apply to production without the founder's explicit go-ahead (CLAUDE.md).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS authorization_requests_transition_guard ON public.authorization_requests;
--   DROP FUNCTION IF EXISTS public.reject_illegal_request_transition();
--   DROP TABLE IF EXISTS public.authorization_requests CASCADE;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: authorization_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.authorization_requests (
    -- Identity
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id        TEXT UNIQUE NOT NULL,          -- Stable public id (e.g. 'authreq-<uuid>')

    -- Target sealed set (FK to the content-free registry, migration 037)
    sealed_set_id     TEXT NOT NULL
                      REFERENCES public.sealed_sets (sealed_set_id),

    -- Queue state — the pending-authorization state machine (M2 step 1)
    state             TEXT NOT NULL DEFAULT 'pending'
                      CHECK (state IN ('pending', 'authorized', 'denied', 'expired')),

    -- Request fingerprint + its components (M2 step 3; recomputable)
    fingerprint       TEXT NOT NULL,                 -- SHA-256 hex of (method_sha \n corpus_id \n corpus_version \n 'scores-only' \n node_measurement)
    method_sha        TEXT NOT NULL,                 -- SHA-256 of the submitted method tarball (a fingerprint input)
    corpus_id         TEXT NOT NULL,                 -- The sealed corpus id being targeted (a fingerprint input)
    corpus_version    TEXT NOT NULL,                 -- The sealed corpus VERSION (a fingerprint input; anti-replay across versions)
    node_measurement  TEXT NOT NULL,                 -- Enclave/eval-node measurement (a fingerprint input; binds to the attested context)
    emit              TEXT NOT NULL DEFAULT 'scores-only'
                      CHECK (emit = 'scores-only'),  -- M5: only scores ever leave a sealed run

    -- M-of-N parameters (documentary; the votes/threshold live in the audit log
    -- 040 and the real threshold signing is Wave 2)
    threshold         TEXT DEFAULT '3 of 5',          -- e.g. '3 of 5' (cf. stewardship.threshold)

    -- Provenance
    requested_by      TEXT,                          -- Who PROPOSED the run (platform identity). Proposing != authorizing (M4).
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    decided_at        TIMESTAMPTZ                     -- When the request left 'pending' (set by the app on transition)
);

COMMENT ON TABLE public.authorization_requests IS
    'The pending-authorization queue state for sealed-set evaluation (the sovereign multisig plan, M2). A request enters ''pending'' and moves one-way to authorized/denied/expired; an immutable fingerprint binds any minted grant (039) to exactly this (method, sealed corpus version, node). Content-free. Wave 1.';

COMMENT ON COLUMN public.authorization_requests.fingerprint IS
    'SHA-256 hex of (method_sha \n corpus_id \n corpus_version \n ''scores-only'' \n node_measurement). Computed by queue_runner.compute_request_fingerprint and recomputable from the component columns. A grant (039) is target-bound to this exact value.';

COMMENT ON COLUMN public.authorization_requests.emit IS
    'Pinned to scores-only (M5): the only output that may leave a sealed evaluation is a score. Belt-and-suspenders with the L3 publish gate + migration-033 content trigger.';

COMMENT ON COLUMN public.authorization_requests.state IS
    'pending -> {authorized, denied, expired}; authorized -> expired. Terminal states (denied/expired) and authorized->pending are rejected by reject_illegal_request_transition(). The fingerprint/method/corpus/node fields are frozen after creation.';

-- ---------------------------------------------------------------------------
-- Indexes — the worker scans pending requests for a sealed set; inspectors look
-- up by fingerprint.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_auth_requests_set_state
    ON public.authorization_requests (sealed_set_id, state);

CREATE INDEX IF NOT EXISTS idx_auth_requests_fingerprint
    ON public.authorization_requests (fingerprint);

-- ---------------------------------------------------------------------------
-- Transition guard — the one-way state machine + immutable request terms.
-- Mirrors the migration-033 reject-trigger pattern (a BEFORE trigger that
-- RAISES on an illegal mutation). This is what makes "a single party cannot
-- quietly flip a denied request to authorized" a data-layer property: even
-- service_role (which bypasses RLS) does NOT bypass triggers.
-- ---------------------------------------------------------------------------
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
    ELSIF OLD.state = 'authorized' AND NEW.state = 'expired' THEN
      NULL;  -- an authorized request may lapse
    ELSE
      RAISE EXCEPTION
        'AUTH REQUEST GUARD: illegal state transition % -> % for request % (allowed: pending->authorized/denied/expired, authorized->expired).',
        OLD.state, NEW.state, OLD.request_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_illegal_request_transition() IS
    'Enforces the one-way authorization_requests state machine and freezes the fingerprint/method/corpus/version/node/sealed_set/emit terms after creation. Un-bypassable (service_role does not bypass triggers). the sovereign multisig plan M2/M4.';

DROP TRIGGER IF EXISTS authorization_requests_transition_guard ON public.authorization_requests;
CREATE TRIGGER authorization_requests_transition_guard
    BEFORE UPDATE ON public.authorization_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_illegal_request_transition();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- Community-inspectable (content-free): anon may READ the request log — what
-- was proposed, against which sealed set, and its state. NO anon/authenticated
-- WRITE policy: requests are enqueued by the platform via service_role (which
-- bypasses RLS), and state transitions go through the guard above.
-- ---------------------------------------------------------------------------
ALTER TABLE public.authorization_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authorization_requests_anon_read ON public.authorization_requests;
CREATE POLICY authorization_requests_anon_read
    ON public.authorization_requests
    FOR SELECT
    TO anon, authenticated
    USING (true);
