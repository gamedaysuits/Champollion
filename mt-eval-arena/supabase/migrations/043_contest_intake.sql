-- =============================================================================
-- Migration 043: contest_intake — the hypotheses-submission queue + policy
-- =============================================================================
-- Phase A (organizer scoring node) of the sovereign contest pipeline.
-- contest_submissions (008) requires an ALREADY-PUBLISHED run card — it cannot
-- receive a raw participant upload. This migration adds the missing intake
-- half: a participant submits a bundle of dev-set + test-set HYPOTHESES (their
-- own system's translations — participant-owned artifacts, NOT corpus content),
-- the row here records digests + lifecycle, and the ORGANIZER'S OWN NODE
-- (arena/mt_eval_harness/contest_node.py) polls, gates on the public qualifier
-- (042), authorizes per the contest's authorization_model (038/039/040), scores
-- against refs that exist ONLY on the organizer's machine, and publishes a
-- scores-only run card.
--
-- CONTENT-FREE (L1). This table stores DIGESTS + lifecycle only. There is no
-- hypotheses/source/reference/expected/text column and never will be. The
-- hypothesis bytes live in the private `contest-intake` storage bucket (044);
-- the secret references never leave the organizer's machine at all.
--
-- POLICY COLUMNS (on contests). authorization_model is the per-contest authorization
-- posture (founder decision 2026-07-07; vocabulary from corpora-card
-- stewardship.authorizationModel):
--   'per-submission' (DEFAULT, fail-closed) — a custodian approves EACH
--       secret-set scoring via `mt-eval node approve` (038 request stays
--       pending until then);
--   'blanket'  — clearing the public qualifier auto-authorizes the 038 request
--       under recorded policy (AmericasNLP-style; every scoring still leaves
--       the full request/grant/audit trail);
--   'open'     — scored directly, no authorization ceremony (public-refs
--       contests only; refuse for sealed sets at the app layer).
-- intake_open defaults FALSE (an organizer must explicitly open the door) and
-- intake_daily_limit throttles reference-probing (see ANTI-GAMING below).
--
-- LIFECYCLE — one-way state machine in the 038 style (un-bypassable trigger):
--   received -> {qualifier_checked, rejected}
--   qualifier_checked -> {pending_authorization, scoring, rejected}
--   pending_authorization -> {scoring, rejected}
--   scoring -> {scored, rejected}
--   scored -> {published, rejected}
--   published, rejected = terminal.
-- Identity/digest columns are frozen after insert, so a bundle can never be
-- swapped out from under its lifecycle row.
--
-- ANTI-GAMING. Every scored submission leaks a little reference signal (an
-- aggregate score is a slow oracle over the secret set). Data-layer
-- mitigations here: UNIQUE(contest_id, test_hyp_sha256) — a byte-identical
-- bundle is never scored twice; a per-submitter daily rate limit
-- (contests.intake_daily_limit) enforced by trigger beneath every client.
-- The honest residual limit is documented in docs/ORGANIZER_NODE_RUNBOOK.md:
-- T1 cannot stop a determined adversary extracting signal across many distinct
-- submissions — the T2 method-execution lane is the real answer.
--
-- RETENTION: intake bundles are retained INDEFINITELY (founder decision
-- 2026-07-07) as the artifact audit trail; digests here make every retained
-- bundle integrity-checkable forever.
--
-- Mirrors the migration-033/022/038 idempotent + trigger style. DEV/STAGING
-- BRANCH ONLY — do NOT apply to production without the founder's explicit
-- go-ahead (CLAUDE.md).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS contest_intake_transition_guard ON public.contest_intake;
--   DROP FUNCTION IF EXISTS public.reject_illegal_intake_transition();
--   DROP TRIGGER IF EXISTS contest_intake_admission_guard ON public.contest_intake;
--   DROP FUNCTION IF EXISTS public.contest_intake_admission_check();
--   DROP TABLE IF EXISTS public.contest_intake CASCADE;
--   ALTER TABLE public.contests DROP COLUMN IF EXISTS authorization_model;
--   ALTER TABLE public.contests DROP COLUMN IF EXISTS intake_daily_limit;
--   ALTER TABLE public.contests DROP COLUMN IF EXISTS intake_open;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Policy columns on contests (needed by the admission trigger below).
-- ---------------------------------------------------------------------------
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS authorization_model TEXT NOT NULL DEFAULT 'per-submission'
    CHECK (authorization_model IN ('per-submission', 'blanket', 'open'));

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS intake_daily_limit INT NOT NULL DEFAULT 5
    CHECK (intake_daily_limit > 0);

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS intake_open BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contests.authorization_model IS
  'Authorization posture for scoring against this contest''s secret set (corpora-card stewardship.authorizationModel vocabulary): per-submission (DEFAULT, fail-closed — custodian approves each scoring), blanket (qualifier pass auto-authorizes, full 038/039/040 trail still recorded), open (direct scoring; public-refs contests only). Migration 043.';

COMMENT ON COLUMN public.contests.intake_daily_limit IS
  'Max hypotheses submissions per submitter per rolling 24h (anti reference-probing throttle, enforced by contest_intake_admission_check beneath every client). Migration 043.';

COMMENT ON COLUMN public.contests.intake_open IS
  'FALSE by default: hypotheses intake is closed until the organizer explicitly opens it. Enforced by contest_intake_admission_check. Migration 043.';

-- ---------------------------------------------------------------------------
-- Table: contest_intake
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contest_intake (
    -- Identity
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    intake_id        TEXT UNIQUE NOT NULL,             -- Stable public id, 'intake-<uuid>'
    contest_id       TEXT NOT NULL
                     REFERENCES public.contests (id),

    -- Attribution (frozen after insert)
    submitted_by     TEXT NOT NULL,                    -- submitter email (from OAuth JWT; RLS-bound on insert)
    team             TEXT,
    notes            TEXT DEFAULT '',

    -- Bundle integrity — DIGESTS ONLY, never content. Bytes live in the
    -- private contest-intake bucket (044) at storage_path.
    dev_hyp_sha256   TEXT NOT NULL,                    -- SHA-256 of the dev-set hypotheses file (the qualifier evidence)
    test_hyp_sha256  TEXT NOT NULL,                    -- SHA-256 of the test-set hypotheses file (what gets scored on the secret refs)
    storage_path     TEXT NOT NULL,                    -- Object path in the contest-intake bucket

    -- Lifecycle (one-way; see header)
    status           TEXT NOT NULL DEFAULT 'received'
                     CHECK (status IN ('received', 'qualifier_checked',
                                       'pending_authorization', 'scoring',
                                       'scored', 'published', 'rejected')),

    -- Written back by the organizer node as it advances the row
    qualifier_id             TEXT,                     -- Which qualifier round (042) gated this submission
    qualifier_score          NUMERIC,                  -- The node's OWN re-score of the dev hypotheses (the gate evidence)
    authorization_request_id TEXT,                     -- The 038 request this scoring entered (per-submission/blanket)
    run_card_id              TEXT,                     -- The published scores-only run card (terminal evidence)
    reject_reason            TEXT,                     -- Honest, specific reason on ANY rejection — never a silent drop

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Dedup: a byte-identical test-hypotheses file is never scored twice for
    -- the same contest (anti replay/probing).
    CONSTRAINT contest_intake_dedup UNIQUE (contest_id, test_hyp_sha256)
);

COMMENT ON TABLE public.contest_intake IS
    'Hypotheses-submission intake for organizer-scored contests: digests + one-way lifecycle only (received -> qualifier_checked -> [pending_authorization ->] scoring -> scored -> published, any -> rejected). Hypothesis bytes live in the private contest-intake bucket; secret references never leave the organizer''s machine. Content-free. Migration 043.';

COMMENT ON COLUMN public.contest_intake.qualifier_score IS
    'The organizer node''s OWN deterministic re-score of the submitted dev-set hypotheses against the public dev refs — the qualifier-gate evidence (isEligibleForSealedRun / qualifier_gate.py). Participant self-scores are advisory; this value is what gates.';

COMMENT ON COLUMN public.contest_intake.reject_reason IS
    'Set on EVERY transition to rejected — the participant always sees why (sha mismatch, below threshold, custodian denial, scoring failure). No silent drops (CLAUDE.md build-for-prod rule).';

-- ---------------------------------------------------------------------------
-- Indexes — the node polls (contest_id, status); participants poll intake_id
-- (already UNIQUE) and their own history.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contest_intake_poll
    ON public.contest_intake (contest_id, status);

CREATE INDEX IF NOT EXISTS idx_contest_intake_submitter
    ON public.contest_intake (submitted_by, created_at);

-- ---------------------------------------------------------------------------
-- Admission guard (BEFORE INSERT) — the door checks, beneath every client:
-- the contest must exist, be open, have intake open, and the submitter must be
-- inside the rolling 24h rate limit. A fresh row is born 'received' with no
-- node-written fields.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_intake_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status      text;
  v_intake_open boolean;
  v_limit       int;
  v_count       int;
BEGIN
  SELECT c.status, c.intake_open, c.intake_daily_limit
    INTO v_status, v_intake_open, v_limit
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION
      'INTAKE GUARD: contest % does not exist.', NEW.contest_id;
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION
      'INTAKE GUARD: contest % is ''%'' (not open) — submissions are not being accepted.',
      NEW.contest_id, v_status;
  END IF;
  IF NOT v_intake_open THEN
    RAISE EXCEPTION
      'INTAKE GUARD: contest % has not opened hypotheses intake (intake_open=false) — the organizer must open intake first.',
      NEW.contest_id;
  END IF;

  -- Rolling 24h per-submitter rate limit (anti reference-probing).
  SELECT COUNT(*) INTO v_count
  FROM public.contest_intake ci
  WHERE ci.contest_id   = NEW.contest_id
    AND ci.submitted_by = NEW.submitted_by
    AND ci.created_at   > NOW() - INTERVAL '24 hours';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION
      'INTAKE GUARD: % has reached the % submissions / 24h limit for contest % — every scored submission leaks reference signal, so intake is throttled (contests.intake_daily_limit).',
      NEW.submitted_by, v_limit, NEW.contest_id;
  END IF;

  -- A submission is born at the start of its lifecycle with no node-written
  -- evidence fields — those are the organizer node's to set.
  IF NEW.status <> 'received' THEN
    RAISE EXCEPTION
      'INTAKE GUARD: a submission must be born ''received'' (got ''%'') — lifecycle transitions belong to the organizer node.',
      NEW.status;
  END IF;
  IF NEW.qualifier_score IS NOT NULL
     OR NEW.authorization_request_id IS NOT NULL
     OR NEW.run_card_id IS NOT NULL THEN
    RAISE EXCEPTION
      'INTAKE GUARD: qualifier_score/authorization_request_id/run_card_id are node-written evidence fields — they cannot be set at submission time.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_intake_admission_check() IS
    'Intake door checks beneath every client: contest open + intake_open + rolling 24h per-submitter rate limit + born-received with no node-written evidence. Un-bypassable (service_role does not bypass triggers). Migration 043.';

DROP TRIGGER IF EXISTS contest_intake_admission_guard ON public.contest_intake;
CREATE TRIGGER contest_intake_admission_guard
    BEFORE INSERT ON public.contest_intake
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_intake_admission_check();

-- ---------------------------------------------------------------------------
-- Transition guard (BEFORE UPDATE) — the one-way lifecycle + frozen identity.
-- Mirrors 038: even service_role cannot rewind a state or swap a bundle's
-- digests out from under its row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_illegal_intake_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Identity + bundle digests are frozen at submission.
  IF NEW.intake_id        IS DISTINCT FROM OLD.intake_id
     OR NEW.contest_id      IS DISTINCT FROM OLD.contest_id
     OR NEW.submitted_by    IS DISTINCT FROM OLD.submitted_by
     OR NEW.dev_hyp_sha256  IS DISTINCT FROM OLD.dev_hyp_sha256
     OR NEW.test_hyp_sha256 IS DISTINCT FROM OLD.test_hyp_sha256
     OR NEW.storage_path    IS DISTINCT FROM OLD.storage_path
     OR NEW.created_at      IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'INTAKE GUARD: submission % identity is immutable (intake_id/contest/submitter/digests/storage_path cannot change after submission).',
      OLD.intake_id;
  END IF;

  -- One-way lifecycle.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'rejected' AND OLD.status NOT IN ('published', 'rejected') THEN
      -- Any non-terminal state may be rejected — but never silently.
      IF NEW.reject_reason IS NULL OR length(trim(NEW.reject_reason)) = 0 THEN
        RAISE EXCEPTION
          'INTAKE GUARD: rejecting submission % requires a non-empty reject_reason — no silent drops.',
          OLD.intake_id;
      END IF;
    ELSIF OLD.status = 'received'              AND NEW.status = 'qualifier_checked' THEN NULL;
    ELSIF OLD.status = 'qualifier_checked'     AND NEW.status IN ('pending_authorization', 'scoring') THEN NULL;
    ELSIF OLD.status = 'pending_authorization' AND NEW.status = 'scoring' THEN NULL;
    ELSIF OLD.status = 'scoring'               AND NEW.status = 'scored' THEN NULL;
    ELSIF OLD.status = 'scored'                AND NEW.status = 'published' THEN NULL;
    ELSE
      RAISE EXCEPTION
        'INTAKE GUARD: illegal lifecycle transition % -> % for submission % (one-way: received -> qualifier_checked -> [pending_authorization ->] scoring -> scored -> published; any non-terminal -> rejected with a reason).',
        OLD.status, NEW.status, OLD.intake_id;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_illegal_intake_transition() IS
    'One-way contest_intake lifecycle + frozen submission identity + rejected-requires-reason. Un-bypassable (service_role does not bypass triggers) — a daemon bug cannot rewind or silently drop a submission. Migration 043.';

DROP TRIGGER IF EXISTS contest_intake_transition_guard ON public.contest_intake;
CREATE TRIGGER contest_intake_transition_guard
    BEFORE UPDATE ON public.contest_intake
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_illegal_intake_transition();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- INSERT: any authenticated participant, but submitted_by is BOUND to the JWT
-- email — you submit as yourself. UPDATE: no anon/authenticated policy — every
-- lifecycle transition is the organizer node's (service_role, which bypasses
-- RLS but NOT the triggers above). SELECT mirrors the 008 privacy model: your
-- own rows always; all rows for public contests; the contest creator sees all.
-- ---------------------------------------------------------------------------
ALTER TABLE public.contest_intake ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_intake_submit ON public.contest_intake;
CREATE POLICY contest_intake_submit
    ON public.contest_intake
    FOR INSERT
    TO authenticated
    WITH CHECK (
      submitted_by = current_setting('request.jwt.claims', true)::json->>'email'
    );

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
      OR submitted_by = current_setting('request.jwt.claims', true)::json->>'email'
      -- …or you are the contest creator (the organizer).
      OR EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = contest_intake.contest_id
          AND c.created_by = current_setting('request.jwt.claims', true)::json->>'email'
      )
    );
