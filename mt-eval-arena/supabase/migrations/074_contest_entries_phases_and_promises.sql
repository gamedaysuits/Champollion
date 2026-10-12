-- 074_contest_entries_phases_and_promises.sql
--
-- THE HOLE (sovereign-contest practices review, 2026-09-06). Under the
-- founder's 2026-09-06 rulings a CONTEST means sovereign hosting: an entry is
-- a METHOD handed to the organizer's air-gapped node (Lane A weights / Lane B
-- code), executed there against a sealed set; the open leaderboard (corpus ×
-- direction) is not a contest. Fifteen shared-task practices were reviewed
-- against that model and the database could not hold any of them:
--
--   · NO DEADLINES. A shared task runs in phases (practice / evaluation /
--     post-evaluation) with per-phase caps. Nothing in the schema knew what a
--     phase was, so "the evaluation window closed" was a sentence on a web
--     page, not a rule. Under R2 the door that matters is the METHOD door —
--     authorization_requests (045) — and its only throttle was a flat
--     sealed_sets.request_daily_limit that never expires.
--   · NO PRIMARY / CONTRASTIVE, NO TRACKS. contest_submissions (008) carried
--     id / contest_id / run_card_id / submitted_by / submitted_at / team /
--     notes. A team could not say which of its entries is THE entry, and a
--     constrained-track claim had nowhere to live — so "constrained" would
--     have had to be believed rather than recorded.
--   · IDENTITY LEAK. The node writes the participant's JWT EMAIL into
--     world-readable run_cards.submitter because contest_submissions had no
--     display-name column to write instead.
--   · PROMISES WERE SETTINGS. contests.metadata is free-form apart from 072's
--     four reserved keys. Every participant-facing promise an organizer might
--     write there — the significance test, alpha, the seed, "results hidden
--     until close", "descriptions required", the prize terms, the declared
--     third-party test suites, the allowed tracks — could be edited AFTER the
--     entries were in. A promise that can be rewritten after the fact is a
--     setting.
--   · NO WAY TO WITHHOLD A SCORE. "No feedback at submission time" needs an
--     honest place to park a scored card until close. There was none, so the
--     only implementations available were "publish anyway" or "throw the
--     score away" — one breaks the promise, the other loses the run.
--   · NO EXECUTION DIAGNOSTICS. A denied or crashed sealed run could report
--     nothing back to the participant, because authorization_requests had no
--     column for counts-only diagnostics (outputs never leave the node).
--   · NO EDITION REPORT POINTER, NO FLAG KIND. shared_tasks (047) could not
--     record where its findings report lives, and tickets.kind (065) had no
--     'flag' value and no way to name the run card being flagged.
--
-- THIS MIGRATION closes those in ONE file, in the 043/045/052/072 house style
-- (identity freeze + one-way state + admission triggers beneath every client
-- and key; service_role bypasses RLS but NOT triggers):
--
--   1. contest_submissions grows the entry declarations: is_primary (one
--      primary per team, partial UNIQUE index), track (constrained |
--      unconstrained), description, method_release_url, constraints JSONB,
--      submitter_label (the DISPLAY name — never the email), a nullable FK to
--      the authorization_requests row the entry came from, and phase.
--   2. contest_phases — the windows themselves, with a non-overlap +
--      no-rewrite-after-the-fact guard and contest_active_phase().
--   3. authorization_request_admission_check() (045) is rewritten: when the
--      request's sealed set belongs to a contest that declares phases, the
--      request must fall inside an open phase ("REQUEST GUARD: no open phase")
--      and obeys that phase's max_submissions_per_day (rolling 24h) and
--      max_submissions (whole window) per requester. A contest without phases
--      falls back to sealed_sets.request_daily_limit exactly as before. Every
--      045 check and message prefix is preserved.
--   4. contest_submission_admission_check() (052) is rewritten: same 24/24h
--      constant, plus phase DERIVATION — when the entry names its
--      authorization request, the phase is computed from that request's
--      created_at against the contest's windows, and a client-supplied phase
--      that disagrees is refused. The phase is recorded by the server, not
--      claimed by the client — and a second BEFORE UPDATE trigger
--      (contest_submissions_entry_freeze) keeps it that way, because the 052
--      door is INSERT-only and the local-stack probe walked straight past the
--      derivation with a plain UPDATE.
--   5. contest_lifecycle_guard() (072) is rewritten keeping everything it
--      does, plus the PROMISE keys: twelve metadata keys are vocabulary-
--      checked at write time and FROZEN the moment the contest has entries
--      (a contest_submissions row, a contest_intake row, or an
--      authorization_requests row against any of the contest's sealed sets);
--      after close, human_eval_selection is the ONLY metadata key that may
--      still change.
--   6. contest_deferred_results — the honest parking place for a scored card
--      under results_visibility='hidden_until_close'. The run-card row is
--      immutable after insert and the published id is set once and never
--      cleared, so "withheld" is a recorded state, not a lost run.
--   7. authorization_requests.execution_diagnostics JSONB (counts-only; no
--      text ever) + the 038 one-way guard adjusted so this is the ONE column
--      that may still be written after the request is decided.
--   8. shared_tasks.report_url / report_generated_at, exempt from the 047
--      identity guard (which freezes slug/year/created_at only).
--   9. tickets.kind gains 'flag' and tickets gains subject_run_card_id (uuid
--      shape check, NO foreign key — a flag must survive the row it names).
--
-- PYTHON SSOT. Every closed vocabulary here is written twice: once in this
-- file, once in arena/mt_eval_harness/contest_policy.py.
-- arena/tests/test_contest_entries_migration.py parses this SQL and asserts
-- the two agree, exactly as tests/test_contest_lifecycle_migration.py does for
-- 072's metric vocabulary.
--
-- CONTENT-FREE. Nothing added here carries corpus content: descriptions and
-- constraints are participant-authored metadata about their own method,
-- run_card_row is an aggregate scores-only card (the 033/051 content guards
-- still govern what may be published from it), and execution_diagnostics is
-- counts only.
--
-- Idempotent throughout (CREATE TABLE / COLUMN / INDEX IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP TRIGGER/POLICY/CONSTRAINT IF EXISTS).
--
-- DEV/LOCAL ONLY. Validated on the local Supabase stack
-- (mt-eval-arena/supabase-local/reset.sh, 001 → 074 from nothing); do NOT
-- apply to production without the founder's explicit go-ahead (CLAUDE.md).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS contest_deferred_results_guard ON public.contest_deferred_results;
--   DROP FUNCTION IF EXISTS public.contest_deferred_result_guard();
--   DROP TABLE IF EXISTS public.contest_deferred_results CASCADE;
--   DROP TRIGGER IF EXISTS contest_phases_guard ON public.contest_phases;
--   DROP FUNCTION IF EXISTS public.contest_phase_guard();
--   DROP FUNCTION IF EXISTS public.contest_active_phase(text, timestamptz);
--   DROP TABLE IF EXISTS public.contest_phases CASCADE;
--   DROP FUNCTION IF EXISTS public.contest_for_sealed_set(text);
--   DROP FUNCTION IF EXISTS public.contest_sealed_set_ids(text);
--   DROP TRIGGER IF EXISTS contest_submissions_entry_freeze ON public.contest_submissions;
--   DROP FUNCTION IF EXISTS public.contest_submission_entry_freeze();
--   DROP INDEX IF EXISTS idx_cs_one_primary;
--   DROP INDEX IF EXISTS idx_cs_auth_request;
--   DROP INDEX IF EXISTS idx_tickets_subject_run_card;
--   ALTER TABLE public.contest_submissions
--     DROP COLUMN IF EXISTS is_primary, DROP COLUMN IF EXISTS track,
--     DROP COLUMN IF EXISTS description, DROP COLUMN IF EXISTS method_release_url,
--     DROP COLUMN IF EXISTS constraints, DROP COLUMN IF EXISTS submitter_label,
--     DROP COLUMN IF EXISTS authorization_request_id, DROP COLUMN IF EXISTS phase;
--   ALTER TABLE public.authorization_requests DROP COLUMN IF EXISTS execution_diagnostics;
--   ALTER TABLE public.shared_tasks
--     DROP COLUMN IF EXISTS report_url, DROP COLUMN IF EXISTS report_generated_at;
--   ALTER TABLE public.tickets DROP COLUMN IF EXISTS subject_run_card_id;
--   ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_kind_check;
--   ALTER TABLE public.tickets ADD CONSTRAINT tickets_kind_check
--     CHECK (kind IN ('takedown', 'objection', 'correction', 'question', 'other'));
--   -- then re-apply 038, 045, 052 and 072 to restore their guard functions.

-- ===========================================================================
-- 1. contest_submissions — the entry declarations.
-- ===========================================================================
ALTER TABLE public.contest_submissions
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.contest_submissions
  ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'unconstrained'
    CHECK (track IN ('constrained', 'unconstrained'));

ALTER TABLE public.contest_submissions
  ADD COLUMN IF NOT EXISTS description TEXT
    CHECK (description IS NULL OR char_length(description) <= 4000);

ALTER TABLE public.contest_submissions
  ADD COLUMN IF NOT EXISTS method_release_url TEXT
    CHECK (method_release_url IS NULL
           OR (method_release_url ~ '^https?://'
               AND char_length(method_release_url) <= 2048));

ALTER TABLE public.contest_submissions
  ADD COLUMN IF NOT EXISTS constraints JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.contest_submissions
  ADD COLUMN IF NOT EXISTS submitter_label TEXT
    CHECK (submitter_label IS NULL OR char_length(submitter_label) <= 200);

ALTER TABLE public.contest_submissions
  ADD COLUMN IF NOT EXISTS authorization_request_id TEXT
    REFERENCES public.authorization_requests (request_id);

ALTER TABLE public.contest_submissions
  ADD COLUMN IF NOT EXISTS phase TEXT
    CHECK (phase IS NULL
           OR phase IN ('practice', 'evaluation', 'post-evaluation'));

COMMENT ON COLUMN public.contest_submissions.is_primary IS
  'True for THE entry a team stands behind; contrastive entries are false. One primary per (contest_id, COALESCE(team, submitted_by)) — enforced by the partial unique index idx_cs_one_primary. Defaults true: a lone entry is its own primary. Migration 074.';
COMMENT ON COLUMN public.contest_submissions.track IS
  'constrained | unconstrained — the resource track the entry DECLARES (arena/mt_eval_harness/contest_policy.py TRACKS). Defaults unconstrained: an undeclared entry is never silently promoted into the stricter track. Migration 074.';
COMMENT ON COLUMN public.contest_submissions.description IS
  'The participant''s system description (<= 4000 chars). metadata.require_description makes its absence an exclusion from the ranking, never a silent drop. Migration 074.';
COMMENT ON COLUMN public.contest_submissions.method_release_url IS
  'OPTIONAL public pointer to the released method (http/https, <= 2048 chars). Under founder ruling R1 the PRIZE condition is HANDOVER of the method to the sovereign host (authorization_requests.method_sha), executed air-gapped — this URL is public information, never the gate. Migration 074.';
COMMENT ON COLUMN public.contest_submissions.constraints IS
  'The entry''s declared constraints object (track, parameterCount, weightsLicense, weightsPublic, trainingData) as validated by mt_eval_harness/contest_declarations.py. Declarations, not measurements. Migration 074.';
COMMENT ON COLUMN public.contest_submissions.submitter_label IS
  'The participant''s chosen DISPLAY name for rankings and cards. Never the email — submitted_by keeps the identity, this is what is shown. Migration 074.';
COMMENT ON COLUMN public.contest_submissions.authorization_request_id IS
  'The authorization_requests row (038/045) whose authorized, node-executed run produced this entry — the R2 entry path. NULL for legacy rows from the retired self-reported lanes. Migration 074.';
COMMENT ON COLUMN public.contest_submissions.phase IS
  'practice | evaluation | post-evaluation — DERIVED by contest_submission_admission_check from the authorization request''s created_at against the contest''s phase windows. NULL when the contest declares no phases. A client-supplied value that disagrees is refused. Migration 074.';

-- One primary per team (or, teamless, per submitter) per contest.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_one_primary
    ON public.contest_submissions (contest_id, COALESCE(team, submitted_by))
    WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_cs_auth_request
    ON public.contest_submissions (authorization_request_id)
    WHERE authorization_request_id IS NOT NULL;

-- ===========================================================================
-- 2. contest_phases — the windows, and what "the deadline" means.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.contest_phases (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contest_id      TEXT NOT NULL REFERENCES public.contests (id) ON DELETE CASCADE,
    name            TEXT NOT NULL
                    CHECK (name IN ('practice', 'evaluation', 'post-evaluation')),
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    -- Caps are NULL = uncapped. They are enforced at the METHOD door
    -- (authorization_request_admission_check), which under R2 is the entry
    -- door: an entry IS an authorized, node-executed run.
    max_submissions         INT CHECK (max_submissions IS NULL OR max_submissions > 0),
    max_submissions_per_day INT CHECK (max_submissions_per_day IS NULL OR max_submissions_per_day > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT contest_phases_window_ordered CHECK (ends_at > starts_at),
    CONSTRAINT contest_phases_one_per_name UNIQUE (contest_id, name)
);

COMMENT ON TABLE public.contest_phases IS
    'The phase windows of a sovereign contest (practice | evaluation | post-evaluation) and their per-phase caps. Windows never overlap within a contest; a window that has started can no longer be edited or deleted, and neither can any window once the contest has entries — a deadline that can be moved after the fact is not a deadline. Enforced at the method door by authorization_request_admission_check (045/074). Migration 074.';
COMMENT ON COLUMN public.contest_phases.max_submissions IS
    'Cap on authorized runs per requester per contest for the WHOLE window (NULL = uncapped). Migration 074.';
COMMENT ON COLUMN public.contest_phases.max_submissions_per_day IS
    'Cap on authorized runs per requester per contest over a rolling 24h inside the window (NULL = uncapped). Replaces sealed_sets.request_daily_limit for phased contests. Migration 074.';

CREATE INDEX IF NOT EXISTS idx_contest_phases_window
    ON public.contest_phases (contest_id, starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- Which contest owns a sealed set, and which sealed sets a contest owns.
-- contests.corpus_id IS the contest's sealed set; metadata.sealed_holdout_set_id
-- is the optional second (held-out) split declared at prepare time.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_sealed_set_ids(p_contest_id text)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT DISTINCT s FROM (
      SELECT c.corpus_id AS s FROM public.contests c WHERE c.id = p_contest_id
      UNION ALL
      SELECT c.metadata ->> 'sealed_holdout_set_id' FROM public.contests c WHERE c.id = p_contest_id
    ) t
    WHERE s IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.contest_sealed_set_ids(text) IS
    'The sealed sets a contest evaluates against: contests.corpus_id plus the optional metadata.sealed_holdout_set_id. Used by the entries test in contest_lifecycle_guard and the phase caps in authorization_request_admission_check. Migration 074.';

-- Resolve the OPEN, PHASE-DECLARING contest that a sealed set belongs to.
-- Returns NULL when no such contest exists (the un-phased fallback path).
-- Ambiguity is a FINDING, not a coin toss: if two open phased contests target
-- the same sealed set, which window governs is genuinely undefined.
CREATE OR REPLACE FUNCTION public.contest_for_sealed_set(p_sealed_set_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_ids text[];
BEGIN
  SELECT ARRAY(
    SELECT c.id
    FROM public.contests c
    WHERE (c.corpus_id = p_sealed_set_id
           OR c.metadata ->> 'sealed_holdout_set_id' = p_sealed_set_id)
      AND c.status = 'open'
      AND EXISTS (SELECT 1 FROM public.contest_phases p WHERE p.contest_id = c.id)
    ORDER BY c.created_at DESC, c.id
  ) INTO v_ids;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  IF array_length(v_ids, 1) > 1 THEN
    RAISE EXCEPTION
      'REQUEST GUARD: sealed set % is targeted by % open phased contests (%) — which phase window governs is ambiguous; close or re-point one before proposing.',
      p_sealed_set_id, array_length(v_ids, 1), array_to_string(v_ids, ', ');
  END IF;
  RETURN v_ids[1];
END;
$$;

COMMENT ON FUNCTION public.contest_for_sealed_set(text) IS
    'The open, phase-declaring contest a sealed set belongs to (via contests.corpus_id or metadata.sealed_holdout_set_id), or NULL when none — the signal authorization_request_admission_check uses to choose phase enforcement over the flat sealed_sets.request_daily_limit. Raises when two open phased contests target the same set. Migration 074.';

-- The active window at a point in time (default: now).
CREATE OR REPLACE FUNCTION public.contest_active_phase(
    p_contest_id text,
    p_at timestamptz DEFAULT now())
RETURNS public.contest_phases
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.*
  FROM public.contest_phases p
  WHERE p.contest_id = p_contest_id
    AND p_at >= p.starts_at
    AND p_at <  p.ends_at
  ORDER BY p.starts_at
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.contest_active_phase(text, timestamptz) IS
    'The contest_phases row covering p_at (half-open [starts_at, ends_at)), or NULL when the contest is between/outside its windows — which is what "the deadline has passed" means at the method door. Migration 074.';

-- ---------------------------------------------------------------------------
-- Phase guard: non-overlap, and no rewriting a window after it has started or
-- after the contest has entries.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_phase_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_has_entries boolean;
  v_overlap     text;
BEGIN
  -- UPDATE / DELETE: a window that has started, or any window of a contest
  -- that already has entries, is frozen.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.starts_at <= now() THEN
      RAISE EXCEPTION
        'PHASE GUARD: phase ''%'' of contest % started at % — a window that has opened is never edited or deleted (participants planned against it).',
        OLD.name, OLD.contest_id, OLD.starts_at;
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.contest_submissions cs WHERE cs.contest_id = OLD.contest_id)
           OR EXISTS (SELECT 1 FROM public.authorization_requests ar
                      WHERE ar.sealed_set_id = ANY (public.contest_sealed_set_ids(OLD.contest_id)))
      INTO v_has_entries;
    IF v_has_entries THEN
      RAISE EXCEPTION
        'PHASE GUARD: contest % already has entries — its phase windows are frozen (deadlines cannot move once methods have been proposed).',
        OLD.contest_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- INSERT / UPDATE: windows within one contest never overlap.
  SELECT p.name INTO v_overlap
  FROM public.contest_phases p
  WHERE p.contest_id = NEW.contest_id
    AND p.id IS DISTINCT FROM NEW.id
    AND tstzrange(p.starts_at, p.ends_at, '[)')
        && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  LIMIT 1;

  IF v_overlap IS NOT NULL THEN
    RAISE EXCEPTION
      'PHASE GUARD: phase ''%'' (% → %) of contest % overlaps phase ''%'' — contest phases are consecutive, never simultaneous.',
      NEW.name, NEW.starts_at, NEW.ends_at, NEW.contest_id, v_overlap;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_phase_guard() IS
    'Phase-window discipline beneath every client and key: windows never overlap within a contest; a started window, and every window of a contest that already has entries, can be neither edited nor deleted; created_at is server-stamped. Un-bypassable (service_role does not bypass triggers). Migration 074.';

DROP TRIGGER IF EXISTS contest_phases_guard ON public.contest_phases;
CREATE TRIGGER contest_phases_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.contest_phases
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_phase_guard();

-- RLS: the schedule is a public announcement; only the contest owner writes it.
ALTER TABLE public.contest_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_phases_public_read ON public.contest_phases;
CREATE POLICY contest_phases_public_read
    ON public.contest_phases
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS contest_phases_owner_insert ON public.contest_phases;
CREATE POLICY contest_phases_owner_insert
    ON public.contest_phases
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = contest_phases.contest_id
          AND c.created_by = ((SELECT current_setting('request.jwt.claims', true))::json ->> 'email')
      )
    );

-- ===========================================================================
-- 3. The METHOD door (045 rewrite): phases are the deadline.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.authorization_request_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status     text;
  v_limit      int;
  v_count      int;
  v_contest_id text;
  v_phase      public.contest_phases;
  v_sets       text[];
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

  -- ---- 074: phase enforcement, when a contest declares phases -------------
  v_contest_id := public.contest_for_sealed_set(NEW.sealed_set_id);

  IF v_contest_id IS NOT NULL THEN
    v_phase := public.contest_active_phase(v_contest_id, now());

    IF v_phase.name IS NULL THEN
      RAISE EXCEPTION
        'REQUEST GUARD: no open phase for contest % at % — the submission window is closed (contest_phases).',
        v_contest_id, now();
    END IF;

    IF NEW.requested_by IS NOT NULL THEN
      v_sets := public.contest_sealed_set_ids(v_contest_id);

      IF v_phase.max_submissions_per_day IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM public.authorization_requests r
        WHERE r.sealed_set_id = ANY (v_sets)
          AND r.requested_by  = NEW.requested_by
          AND r.created_at    > NOW() - INTERVAL '24 hours';

        IF v_count >= v_phase.max_submissions_per_day THEN
          RAISE EXCEPTION
            'REQUEST GUARD: % has reached the % requests / 24h limit for contest % in phase ''%'' (contest_phases.max_submissions_per_day).',
            NEW.requested_by, v_phase.max_submissions_per_day, v_contest_id, v_phase.name;
        END IF;
      END IF;

      IF v_phase.max_submissions IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM public.authorization_requests r
        WHERE r.sealed_set_id = ANY (v_sets)
          AND r.requested_by  = NEW.requested_by
          AND r.created_at   >= v_phase.starts_at
          AND r.created_at   <  v_phase.ends_at;

        IF v_count >= v_phase.max_submissions THEN
          RAISE EXCEPTION
            'REQUEST GUARD: % has reached the % requests allowed for contest % across the whole ''%'' phase (contest_phases.max_submissions).',
            NEW.requested_by, v_phase.max_submissions, v_contest_id, v_phase.name;
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- ---- Un-phased contests: the 045 flat throttle, exactly as before -------
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
    'Proposal door checks beneath every client: sealed set exists + active, request born pending/undecided, and the throttle — a phase-declaring contest (074) requires an OPEN phase and applies contest_phases.max_submissions_per_day (rolling 24h) and max_submissions (whole window) per requester per contest; otherwise the flat sealed_sets.request_daily_limit (045) applies unchanged. Un-bypassable (service_role does not bypass triggers). Migrations 045 + 074.';

DROP TRIGGER IF EXISTS authorization_requests_admission_guard ON public.authorization_requests;
CREATE TRIGGER authorization_requests_admission_guard
    BEFORE INSERT ON public.authorization_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.authorization_request_admission_check();

-- ===========================================================================
-- 4. The submission-link door (052 rewrite): the phase is derived, not claimed.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.contest_submission_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_limit CONSTANT int := 24;  -- links / submitter / contest / rolling 24h
  v_count int;
  v_req_created_at timestamptz;
  v_derived_phase  text;
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

  -- ---- 074: derive the phase from the authorized run's proposal time ------
  IF NEW.authorization_request_id IS NOT NULL THEN
    SELECT r.created_at INTO v_req_created_at
    FROM public.authorization_requests r
    WHERE r.request_id = NEW.authorization_request_id;

    IF v_req_created_at IS NULL THEN
      RAISE EXCEPTION
        'SUBMISSION GUARD: authorization request % has no created_at — the phase of this entry cannot be established.',
        NEW.authorization_request_id;
    END IF;

    SELECT p.name INTO v_derived_phase
    FROM public.contest_phases p
    WHERE p.contest_id = NEW.contest_id
      AND v_req_created_at >= p.starts_at
      AND v_req_created_at <  p.ends_at
    ORDER BY p.starts_at
    LIMIT 1;

    IF NEW.phase IS DISTINCT FROM v_derived_phase AND NEW.phase IS NOT NULL THEN
      RAISE EXCEPTION
        'SUBMISSION GUARD: entry claims phase ''%'' but authorization request % was proposed at %, which falls in % — the phase is recorded by the server, not claimed by the client.',
        NEW.phase, NEW.authorization_request_id, v_req_created_at,
        COALESCE('phase ''' || v_derived_phase || '''', 'no declared phase window');
    END IF;

    NEW.phase := v_derived_phase;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_submission_admission_check() IS
    'Submission birth door beneath every client and key: non-empty submitted_by, server-stamped submitted_at, rolling 24h per-(submitter, contest) throttle (constant 24, migration 052), and — when the entry names its authorization request — the phase DERIVED from that request''s created_at against the contest''s windows, refusing any disagreeing client-supplied phase (074). Un-bypassable (service_role does not bypass triggers). Migrations 052 + 074.';

DROP TRIGGER IF EXISTS contest_submissions_admission_guard ON public.contest_submissions;
CREATE TRIGGER contest_submissions_admission_guard
    BEFORE INSERT ON public.contest_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_submission_admission_check();

-- ---------------------------------------------------------------------------
-- FINDING (local-stack probe P13, 2026-09-06). The 052 door is BEFORE INSERT
-- only, so an UPDATE walked straight past the derivation above: a client could
-- insert an entry, let the server stamp phase='evaluation', and then simply
-- UPDATE it to 'practice'. A rule any UPDATE bypasses is not a rule. This
-- second trigger freezes the fields that are the SERVER's to say — the entry's
-- identity, its authorized run, and the derived phase. The participant-authored
-- declarations (description, track, constraints, submitter_label, is_primary)
-- stay correctable in place; is_primary keeps its own floor in the partial
-- unique index.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_submission_entry_freeze()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.contest_id   IS DISTINCT FROM OLD.contest_id
     OR NEW.run_card_id  IS DISTINCT FROM OLD.run_card_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION
      'SUBMISSION GUARD: entry % identity is frozen (contest_id/run_card_id/submitted_by/submitted_at) — withdraw the entry and submit a new one instead.',
      OLD.id;
  END IF;

  IF NEW.authorization_request_id IS DISTINCT FROM OLD.authorization_request_id THEN
    RAISE EXCEPTION
      'SUBMISSION GUARD: entry % is bound to authorization request % — the authorized run behind an entry is never swapped.',
      OLD.id, COALESCE(OLD.authorization_request_id, '(none)');
  END IF;

  IF NEW.phase IS DISTINCT FROM OLD.phase THEN
    RAISE EXCEPTION
      'SUBMISSION GUARD: entry % has phase % — the phase is recorded by the server from the authorization request''s time, not claimed by the client, and never edited afterwards.',
      OLD.id, COALESCE(OLD.phase, '(none)');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_submission_entry_freeze() IS
    'Freezes what the SERVER said about an entry: contest_id/run_card_id/submitted_by/submitted_at, the bound authorization_request_id, and the derived phase. Participant-authored declarations stay editable. Closes the UPDATE bypass of the INSERT-time phase derivation found by the 074 local-stack probe. Un-bypassable (service_role does not bypass triggers). Migration 074.';

DROP TRIGGER IF EXISTS contest_submissions_entry_freeze ON public.contest_submissions;
CREATE TRIGGER contest_submissions_entry_freeze
    BEFORE UPDATE ON public.contest_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_submission_entry_freeze();

-- ===========================================================================
-- 5. The lifecycle guard (072 rewrite): promises are frozen once entries exist.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.contest_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  -- The participant-facing PROMISES. Frozen the moment the contest has
  -- entries. (Python twin: contest_policy.FROZEN_PROMISE_KEYS.)
  v_frozen_promise_keys CONSTANT text[] := ARRAY[
    'tie_test', 'alpha', 'n_resamples', 'seed', 'require_description',
    'prize_terms', 'test_suites', 'anonymize_until_close',
    'results_visibility', 'allowed_tracks', 'open_weight_only',
    'sealed_holdout_set_id'];
  -- The only metadata key that may still change after close.
  -- (Python twin: contest_policy.POST_CLOSE_KEYS.)
  v_post_close_keys CONSTANT text[] := ARRAY['human_eval_selection'];

  v_metric      text;
  v_has_entries boolean;
  v_key         text;
  v_visibility  text;
  v_tie_test    text;
  v_alpha       numeric;
  v_resamples   numeric;
  v_track       jsonb;
  v_suite       jsonb;
  v_suite_key   text;
  v_holdout     text;
  v_prize       jsonb;
  v_prize_key   text;
  v_disposition text;
  v_old_md      jsonb;
  v_new_md      jsonb;
BEGIN
  -- ---- 5. primary_metric vocabulary (INSERT and UPDATE) -------------------
  IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'primary_metric' THEN
    IF jsonb_typeof(NEW.metadata -> 'primary_metric') <> 'string' THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: metadata.primary_metric must be a string naming a rankable metric (chrf_plus_plus | bleu | comet_score | composite), got %.',
        NEW.metadata -> 'primary_metric';
    END IF;
    v_metric := NEW.metadata ->> 'primary_metric';
    IF v_metric NOT IN ('chrf_plus_plus', 'bleu', 'comet_score', 'composite') THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: metadata.primary_metric ''%'' is not rankable — allowed: chrf_plus_plus | bleu | comet_score | composite (canonical ids of shared/metric-registry.json).',
        v_metric;
    END IF;
  END IF;

  -- ---- 074: promise-key vocabularies, checked at WRITE time ---------------
  IF NEW.metadata IS NOT NULL THEN

    IF NEW.metadata ? 'results_visibility' THEN
      v_visibility := NEW.metadata ->> 'results_visibility';
      IF jsonb_typeof(NEW.metadata -> 'results_visibility') <> 'string'
         OR v_visibility NOT IN ('immediate', 'hidden_until_close') THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.results_visibility must be one of immediate | hidden_until_close, got %.',
          NEW.metadata -> 'results_visibility';
      END IF;
    END IF;

    IF NEW.metadata ? 'tie_test' THEN
      v_tie_test := NEW.metadata ->> 'tie_test';
      IF jsonb_typeof(NEW.metadata -> 'tie_test') <> 'string'
         OR v_tie_test NOT IN ('ar', 'bootstrap') THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.tie_test must be one of ar | bootstrap (the significance tests contest_rank implements), got %.',
          NEW.metadata -> 'tie_test';
      END IF;
    END IF;

    IF NEW.metadata ? 'alpha' THEN
      IF jsonb_typeof(NEW.metadata -> 'alpha') <> 'number' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.alpha must be a number strictly between 0 and 1, got %.',
          NEW.metadata -> 'alpha';
      END IF;
      v_alpha := (NEW.metadata ->> 'alpha')::numeric;
      IF NOT (v_alpha > 0 AND v_alpha < 1) THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.alpha must be strictly between 0 and 1, got %.',
          v_alpha;
      END IF;
    END IF;

    IF NEW.metadata ? 'n_resamples' THEN
      IF jsonb_typeof(NEW.metadata -> 'n_resamples') <> 'number' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.n_resamples must be an integer >= 1, got %.',
          NEW.metadata -> 'n_resamples';
      END IF;
      v_resamples := (NEW.metadata ->> 'n_resamples')::numeric;
      IF v_resamples < 1 OR v_resamples <> trunc(v_resamples) THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.n_resamples must be an integer >= 1, got %.',
          v_resamples;
      END IF;
    END IF;

    IF NEW.metadata ? 'allowed_tracks' THEN
      IF jsonb_typeof(NEW.metadata -> 'allowed_tracks') <> 'array' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.allowed_tracks must be an array of tracks (constrained | unconstrained), got %.',
          NEW.metadata -> 'allowed_tracks';
      END IF;
      FOR v_track IN SELECT jsonb_array_elements(NEW.metadata -> 'allowed_tracks') LOOP
        IF jsonb_typeof(v_track) <> 'string'
           OR (v_track #>> '{}') NOT IN ('constrained', 'unconstrained') THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.allowed_tracks entry % is not a track — allowed: constrained | unconstrained.',
            v_track;
        END IF;
      END LOOP;
    END IF;

    FOREACH v_key IN ARRAY ARRAY['open_weight_only', 'anonymize_until_close', 'require_description'] LOOP
      IF NEW.metadata ? v_key AND jsonb_typeof(NEW.metadata -> v_key) <> 'boolean' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.% must be a boolean, got %.',
          v_key, NEW.metadata -> v_key;
      END IF;
    END LOOP;

    IF NEW.metadata ? 'test_suites' THEN
      IF jsonb_typeof(NEW.metadata -> 'test_suites') <> 'array' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.test_suites must be an array of declared diagnostic suites, got %.',
          NEW.metadata -> 'test_suites';
      END IF;
      FOR v_suite IN SELECT jsonb_array_elements(NEW.metadata -> 'test_suites') LOOP
        IF jsonb_typeof(v_suite) <> 'object' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.test_suites entry % is not an object — each suite declares suite_id, corpus_card_id, publisher, url, sha256.',
            v_suite;
        END IF;
        FOREACH v_suite_key IN ARRAY ARRAY['suite_id', 'corpus_card_id', 'publisher', 'url', 'sha256'] LOOP
          IF jsonb_typeof(v_suite -> v_suite_key) IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION
              'CONTEST LIFECYCLE GUARD: metadata.test_suites entry % is missing string key ''%'' — a declared suite is pinned by suite_id, corpus_card_id, publisher, url and sha256.',
              v_suite, v_suite_key;
          END IF;
        END LOOP;
        IF (v_suite ->> 'sha256') !~ '^[0-9a-f]{64}$' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.test_suites entry ''%'' has sha256 ''%'' — a declared suite is pinned by a 64-hex SHA-256 of the exact bytes.',
            v_suite ->> 'suite_id', v_suite ->> 'sha256';
        END IF;
      END LOOP;
    END IF;

    IF NEW.metadata ? 'sealed_holdout_set_id' THEN
      IF jsonb_typeof(NEW.metadata -> 'sealed_holdout_set_id') <> 'string' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.sealed_holdout_set_id must be a registered sealed_sets id (string), got %.',
          NEW.metadata -> 'sealed_holdout_set_id';
      END IF;
      v_holdout := NEW.metadata ->> 'sealed_holdout_set_id';
      IF NOT EXISTS (SELECT 1 FROM public.sealed_sets s WHERE s.sealed_set_id = v_holdout) THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.sealed_holdout_set_id ''%'' is not a registered sealed set (sealed_sets).',
          v_holdout;
      END IF;
    END IF;

    -- metadata.prize_terms — the PRIZE DISPOSITION (founder ruling
    -- 2026-09-07: "I think it should be kinda trinary: 'pass to holders' /
    -- 'retain IP' / 'release open' options"). The headline, participant-facing
    -- term of a prized contest is ONE choice out of three. retention / rights
    -- / host_use / release are DERIVED from that choice
    -- (contest_policy.PRIZE_DISPOSITION_DERIVED); rights and host_use are
    -- never written here at all, and retention / release only as the one
    -- narrow override their disposition offers. The EXECUTION mode is fixed
    -- (the entry is handed to the host's air-gapped node to be scored); the
    -- disposition says what happens to it AFTERWARDS. Vocabulary twin:
    -- contest_policy.PRIZE_* + contest_prize_terms.parse_prize_terms.
    IF NEW.metadata ? 'prize_terms' THEN
      IF jsonb_typeof(NEW.metadata -> 'prize_terms') <> 'object' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms must be an object declaring disposition — one of pass_to_holders | retain_ip | release_open, got %.',
          NEW.metadata -> 'prize_terms';
      END IF;
      v_prize := NEW.metadata -> 'prize_terms';

      IF v_prize ? 'release_required_before_scores' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.release_required_before_scores is RETIRED (founder ruling 2026-09-07 — the prize term is one choice of three). Declare disposition = pass_to_holders | retain_ip | release_open; ''release_open'' is the option that requires publication.';
      END IF;

      IF v_prize ? 'preset' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.preset is RETIRED — the named presets open / audit / community / strict were retired on 2026-09-07. Declare disposition = pass_to_holders | retain_ip | release_open.';
      END IF;

      IF v_prize ? 'rights' OR v_prize ? 'host_use' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.rights and host_use are DERIVED from disposition and are never declared — a hand-written copy of a derived value is a second source of truth waiting to disagree with the first. Declare disposition (pass_to_holders | retain_ip | release_open); the only overrides are retention (retain_ip only: retain_sealed_audit | delete_after_scoring) and release + release_license (release_open only), plus community_terms_url.';
      END IF;

      FOR v_prize_key IN SELECT jsonb_object_keys(v_prize) LOOP
        IF v_prize_key NOT IN ('disposition', 'retention', 'release', 'release_license', 'community_terms_url') THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms has unknown key ''%'' — the declarable keys are exactly disposition, retention, release, release_license, community_terms_url. Prize money is declared in metadata.prize, never inside the terms.',
            v_prize_key;
        END IF;
      END LOOP;

      IF (v_prize -> 'disposition') #>> '{}' IS NULL
         OR jsonb_typeof(v_prize -> 'disposition') <> 'string'
         OR (v_prize ->> 'disposition') NOT IN ('pass_to_holders', 'retain_ip', 'release_open') THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.disposition must be one of pass_to_holders | retain_ip | release_open, got %.',
          v_prize -> 'disposition';
      END IF;
      v_disposition := v_prize ->> 'disposition';

      -- retention: the one override 'retain_ip' offers, and nobody else.
      IF v_prize ? 'retention' THEN
        IF v_disposition <> 'retain_ip' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms.retention is not an override disposition ''%'' allows — what the host keeps follows from the disposition. Only ''retain_ip'' may set it (retain_sealed_audit | delete_after_scoring).',
            v_disposition;
        END IF;
        IF jsonb_typeof(v_prize -> 'retention') <> 'string'
           OR (v_prize ->> 'retention') NOT IN ('retain_sealed_audit', 'delete_after_scoring') THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms.retention must be one of retain_sealed_audit | delete_after_scoring (the values disposition ''retain_ip'' allows), got %.',
            v_prize -> 'retention';
        END IF;
      END IF;

      -- release: the timing override 'release_open' offers, and nobody else.
      IF v_prize ? 'release' THEN
        IF v_disposition <> 'release_open' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms.release is not an override disposition ''%'' allows — only ''release_open'' requires a public release, and only it may say when (required_before_scores | required_before_prize | required_after_prize).',
            v_disposition;
        END IF;
        IF jsonb_typeof(v_prize -> 'release') <> 'string'
           OR (v_prize ->> 'release') NOT IN ('required_before_scores', 'required_before_prize', 'required_after_prize') THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms.release must be one of required_before_scores | required_before_prize | required_after_prize (the values disposition ''release_open'' allows), got %.',
            v_prize -> 'release';
        END IF;
      END IF;

      -- release_license: required exactly under 'release_open', and forbidden
      -- otherwise (a licence for a release nobody has to make is a term about
      -- nothing).
      IF v_disposition = 'release_open' THEN
        IF jsonb_typeof(v_prize -> 'release_license') IS DISTINCT FROM 'string'
           OR btrim(v_prize ->> 'release_license') = '' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: disposition ''release_open'' requires release_license — an SPDX identifier or ''any_osi''. "Publish it" without saying under what terms is not a term.';
        END IF;
      ELSIF v_prize ? 'release_license' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.release_license is declared but disposition is ''%'' — only ''release_open'' requires a public release, so drop the licence or choose that option.',
          v_disposition;
      END IF;

      IF v_prize ? 'community_terms_url'
         AND (jsonb_typeof(v_prize -> 'community_terms_url') <> 'string'
              OR (v_prize ->> 'community_terms_url') !~ '^https://[^[:space:]]+$') THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.community_terms_url must be an https:// URL, got %.',
          v_prize -> 'community_terms_url';
      END IF;
    END IF;
  END IF;

  -- ---- INSERT: born open, born without a result ---------------------------
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: a contest is born ''open'' (got ''%'') — closed/archived are reached only through the one-way lifecycle.',
        NEW.status;
    END IF;
    IF NEW.metadata IS NOT NULL
       AND (NEW.metadata ? 'final_ranking'
            OR NEW.metadata ? 'closed_at'
            OR NEW.metadata ? 'closed_by') THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: a contest is born without a result — metadata.final_ranking / closed_at / closed_by are written only by the close transition.';
    END IF;
    RETURN NEW;
  END IF;

  -- ---- 1. identity freeze (UPDATE) ----------------------------------------
  IF NEW.id            IS DISTINCT FROM OLD.id
     OR NEW.corpus_id     IS DISTINCT FROM OLD.corpus_id
     OR NEW.language_pair IS DISTINCT FROM OLD.language_pair
     OR NEW.lane          IS DISTINCT FROM OLD.lane
     OR NEW.use_context   IS DISTINCT FROM OLD.use_context
     OR NEW.created_by    IS DISTINCT FROM OLD.created_by
     OR NEW.created_at    IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'CONTEST LIFECYCLE GUARD: contest % identity is frozen (id, corpus_id, language_pair, lane, use_context, created_by, created_at) — entries were ranked against these terms; create a new contest instead.',
      OLD.id;
  END IF;

  IF OLD.shared_task_id IS NOT NULL
     AND NEW.shared_task_id IS DISTINCT FROM OLD.shared_task_id THEN
    RAISE EXCEPTION
      'CONTEST LIFECYCLE GUARD: contest % is attached to shared task ''%'' — an edition attachment is made once and never detached or re-pointed.',
      OLD.id, OLD.shared_task_id;
  END IF;

  -- ---- 5./074. primary_metric + the promise keys, frozen once entries -----
  -- "Entries" is the R2 definition: a linked submission, an intake row, OR an
  -- authorization request against any of the contest's sealed sets — because
  -- under R2 the request IS the entry.
  IF (NEW.metadata ->> 'primary_metric') IS DISTINCT FROM (OLD.metadata ->> 'primary_metric') THEN
    SELECT EXISTS (SELECT 1 FROM public.contest_submissions cs WHERE cs.contest_id = OLD.id)
           OR EXISTS (SELECT 1 FROM public.contest_intake ci WHERE ci.contest_id = OLD.id)
           OR EXISTS (SELECT 1 FROM public.authorization_requests ar
                      WHERE ar.sealed_set_id = ANY (public.contest_sealed_set_ids(OLD.id)))
      INTO v_has_entries;
    IF v_has_entries THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: contest % already has entries — metadata.primary_metric (''%'' → ''%'') is frozen; the ranking rule cannot change after submissions are in.',
        OLD.id, OLD.metadata ->> 'primary_metric', NEW.metadata ->> 'primary_metric';
    END IF;
  END IF;

  FOREACH v_key IN ARRAY v_frozen_promise_keys LOOP
    IF (NEW.metadata -> v_key) IS DISTINCT FROM (OLD.metadata -> v_key) THEN
      IF v_has_entries IS NULL THEN
        SELECT EXISTS (SELECT 1 FROM public.contest_submissions cs WHERE cs.contest_id = OLD.id)
               OR EXISTS (SELECT 1 FROM public.contest_intake ci WHERE ci.contest_id = OLD.id)
               OR EXISTS (SELECT 1 FROM public.authorization_requests ar
                          WHERE ar.sealed_set_id = ANY (public.contest_sealed_set_ids(OLD.id)))
          INTO v_has_entries;
      END IF;
      IF v_has_entries THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: contest % already has entries — metadata.% is a PROMISE to participants and is frozen (a term that can be rewritten after entries are in is a setting, not a promise).',
          OLD.id, v_key;
      END IF;
    END IF;
  END LOOP;

  -- ---- 2./3. one-way lifecycle + close requires a result ------------------
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (   (OLD.status = 'open'   AND NEW.status = 'closed')
            OR (OLD.status = 'closed' AND NEW.status = 'archived')) THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: illegal status transition % -> % on contest % — the lifecycle is one-way: open -> closed -> archived (no re-opening, no skipping).',
        OLD.status, NEW.status, OLD.id;
    END IF;

    IF NEW.status = 'closed' THEN
      IF NEW.metadata IS NULL
         OR jsonb_typeof(NEW.metadata -> 'final_ranking') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: closing contest % requires metadata.final_ranking to be a JSON object (the frozen ranking `mt-eval contest close` writes) — a contest never closes without a result of record.',
          OLD.id;
      END IF;
      -- Intake shuts with the contest; the close time is the server's.
      NEW.intake_open := false;
      NEW.metadata := NEW.metadata || jsonb_build_object('closed_at', now());
    END IF;
  END IF;

  -- ---- 4. frozen result + intake pinned shut after close ------------------
  IF OLD.status IN ('closed', 'archived') THEN
    IF NEW.intake_open THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: contest % is % — intake cannot reopen after close.',
        OLD.id, OLD.status;
    END IF;
    IF (NEW.metadata -> 'final_ranking') IS DISTINCT FROM (OLD.metadata -> 'final_ranking')
       OR (NEW.metadata -> 'closed_at')  IS DISTINCT FROM (OLD.metadata -> 'closed_at')
       OR (NEW.metadata -> 'closed_by')  IS DISTINCT FROM (OLD.metadata -> 'closed_by') THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: contest % is % — metadata.final_ranking / closed_at / closed_by are the result of record and immutable.',
        OLD.id, OLD.status;
    END IF;

    -- 074: after close the whole metadata object is the result of record.
    -- human_eval_selection is the ONE key that may still be written, because
    -- the selection is drawn FROM the frozen ranking and so necessarily lands
    -- after the close.
    v_old_md := COALESCE(OLD.metadata, '{}'::jsonb);
    v_new_md := COALESCE(NEW.metadata, '{}'::jsonb);
    FOREACH v_key IN ARRAY v_post_close_keys LOOP
      v_old_md := v_old_md - v_key;
      v_new_md := v_new_md - v_key;
    END LOOP;
    IF v_new_md IS DISTINCT FROM v_old_md THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: contest % is % — its metadata is the result of record; human_eval_selection is the only key that may still change after close.',
        OLD.id, OLD.status;
    END IF;
  END IF;

  -- ---- 6. no result keys while open, except through the close itself -----
  IF OLD.status = 'open' AND NEW.status = 'open'
     AND NEW.metadata IS NOT NULL
     AND (NEW.metadata ? 'final_ranking'
          OR NEW.metadata ? 'closed_at'
          OR NEW.metadata ? 'closed_by') THEN
    RAISE EXCEPTION
      'CONTEST LIFECYCLE GUARD: contest % is open — metadata.final_ranking / closed_at / closed_by are written only by the close transition (status open -> closed in the same update).',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_lifecycle_guard() IS
    'Contest lifecycle discipline beneath every client and key (migrations 072 + 074): identity freeze (id/corpus_id/language_pair/lane/use_context/created_by/created_at; shared_task_id attaches once), one-way open -> closed -> archived, close REQUIRES metadata.final_ranking (object) and forces intake_open=false + server-stamps metadata.closed_at, result immutable after close, metadata.primary_metric vocabulary-checked (chrf_plus_plus|bleu|comet_score|composite), no result keys at INSERT — PLUS the 074 promise layer: tie_test/alpha/n_resamples/seed/require_description/prize_terms/test_suites/anonymize_until_close/results_visibility/allowed_tracks/open_weight_only/sealed_holdout_set_id are vocabulary-checked at write time and frozen once the contest has entries (submission, intake, or an authorization request against its sealed sets), and after close human_eval_selection is the only metadata key that may change. prize_terms carries the PRIZE DISPOSITION (founder ruling 2026-09-07, trinary): the execution mode is fixed (entries are handed to the host air-gapped node to be scored), and the participant-facing term is exactly one disposition (pass_to_holders|retain_ip|release_open), from which retention (delete_after_scoring|retain_sealed_audit|retain), rights (participant_retains_all|license_to_host|assignment_to_host), host_use (evaluation_only|non_commercial|any) and release (not_required|required_before_scores|required_before_prize|required_after_prize) are DERIVED. rights and host_use are refused as explicit keys; retention is an override only retain_ip offers (retain_sealed_audit|delete_after_scoring) and release only release_open (required_before_scores|required_before_prize|required_after_prize), release_license is required exactly under release_open, community_terms_url is optional on any disposition, unknown keys are refused, and the retired release_required_before_scores switch and preset key are each named with their replacement. Un-bypassable (service_role does not bypass triggers).';

DROP TRIGGER IF EXISTS contests_lifecycle_guard ON public.contests;
CREATE TRIGGER contests_lifecycle_guard
    BEFORE INSERT OR UPDATE ON public.contests
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_lifecycle_guard();

-- ===========================================================================
-- 6. contest_deferred_results — withheld is a state, not a lost run.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.contest_deferred_results (
    request_id             TEXT PRIMARY KEY,
    contest_id             TEXT NOT NULL REFERENCES public.contests (id),
    sealed_set_id          TEXT NOT NULL,
    role                   TEXT NOT NULL
                           CHECK (role IN ('main', 'holdout')),
    -- The assembled, scores-only run-card row exactly as it WOULD have been
    -- published. Immutable after insert (the guard below).
    run_card_row           JSONB NOT NULL,
    deferred_at            TIMESTAMPTZ DEFAULT now(),
    published_run_card_id  TEXT,
    published_at           TIMESTAMPTZ
);

COMMENT ON TABLE public.contest_deferred_results IS
    'Scored run cards withheld under contests.metadata.results_visibility = hidden_until_close (and every holdout-split result, always). The row is written when the sealed run finishes and published verbatim by `mt-eval contest close` before the ranking is frozen — so "no feedback at submission time" costs a participant a wait, never a run. run_card_row is immutable; published_run_card_id is set once and never cleared. Migration 074.';
COMMENT ON COLUMN public.contest_deferred_results.role IS
    'main | holdout — which sealed split produced this card (contest_policy.DEFERRED_ROLES). A holdout result is ALWAYS deferred to close, whatever results_visibility says.';
COMMENT ON COLUMN public.contest_deferred_results.run_card_row IS
    'The aggregate scores-only run_cards row this evaluation produced, held verbatim. Immutable after insert — a withheld score is a recorded score, not an editable draft.';

CREATE INDEX IF NOT EXISTS idx_deferred_unpublished
    ON public.contest_deferred_results (contest_id)
    WHERE published_run_card_id IS NULL;

CREATE OR REPLACE FUNCTION public.contest_deferred_result_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.request_id    IS DISTINCT FROM OLD.request_id
     OR NEW.contest_id    IS DISTINCT FROM OLD.contest_id
     OR NEW.sealed_set_id IS DISTINCT FROM OLD.sealed_set_id
     OR NEW.role          IS DISTINCT FROM OLD.role
     OR NEW.deferred_at   IS DISTINCT FROM OLD.deferred_at THEN
    RAISE EXCEPTION
      'DEFERRED RESULT GUARD: deferred result % identity is frozen (request_id/contest_id/sealed_set_id/role/deferred_at).',
      OLD.request_id;
  END IF;

  IF NEW.run_card_row IS DISTINCT FROM OLD.run_card_row THEN
    RAISE EXCEPTION
      'DEFERRED RESULT GUARD: the run card held for request % is immutable — a withheld score is a recorded score, not an editable draft.',
      OLD.request_id;
  END IF;

  IF OLD.published_run_card_id IS NOT NULL
     AND NEW.published_run_card_id IS DISTINCT FROM OLD.published_run_card_id THEN
    RAISE EXCEPTION
      'DEFERRED RESULT GUARD: deferred result % was already published as run card % — the publication pointer is set once and never cleared or re-pointed.',
      OLD.request_id, OLD.published_run_card_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_deferred_result_guard() IS
    'Freezes a deferred result''s identity and its held run_card_row, and makes published_run_card_id set-once (never cleared, never re-pointed). Un-bypassable (service_role does not bypass triggers). Migration 074.';

DROP TRIGGER IF EXISTS contest_deferred_results_guard ON public.contest_deferred_results;
CREATE TRIGGER contest_deferred_results_guard
    BEFORE UPDATE ON public.contest_deferred_results
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_deferred_result_guard();

-- RLS: NO anon policy. The contest owner may look at what is being withheld
-- for their own contest; writes are the node's (service_role).
ALTER TABLE public.contest_deferred_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_deferred_results_owner_read ON public.contest_deferred_results;
CREATE POLICY contest_deferred_results_owner_read
    ON public.contest_deferred_results
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = contest_deferred_results.contest_id
          AND c.created_by = ((SELECT current_setting('request.jwt.claims', true))::json ->> 'email')
      )
    );

DROP POLICY IF EXISTS contest_deferred_results_service_write ON public.contest_deferred_results;
CREATE POLICY contest_deferred_results_service_write
    ON public.contest_deferred_results
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===========================================================================
-- 7. authorization_requests.execution_diagnostics + the 038 guard adjustment.
-- ===========================================================================
ALTER TABLE public.authorization_requests
  ADD COLUMN IF NOT EXISTS execution_diagnostics JSONB;

COMMENT ON COLUMN public.authorization_requests.execution_diagnostics IS
    'COUNTS-ONLY diagnostics from the node''s attempt at this request (stage reached, counts, timings, exit codes) — the honest substitute for "review before unblinding": outputs never leave the node, but a participant may be told WHY a run failed. Never per-entry text. The ONE column writable after the request is decided (074).';

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

  -- 074: once the custodians have DECIDED, the record of the decision is
  -- closed. execution_diagnostics is the single exception — the node reports
  -- counts-only diagnostics back against an already-decided request — and the
  -- state may still lapse (authorized -> expired) under the machine above.
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
    'Enforces the one-way authorization_requests state machine and freezes the fingerprint/method/corpus/version/node/sealed_set/emit terms after creation; after decided_at the decision record is closed except for execution_diagnostics (074) and a lapse to expired. Un-bypassable (service_role does not bypass triggers). Migrations 038 + 074.';

DROP TRIGGER IF EXISTS authorization_requests_transition_guard ON public.authorization_requests;
CREATE TRIGGER authorization_requests_transition_guard
    BEFORE UPDATE ON public.authorization_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_illegal_request_transition();

-- ===========================================================================
-- 8. shared_tasks: where the edition's findings report lives.
-- ===========================================================================
ALTER TABLE public.shared_tasks
  ADD COLUMN IF NOT EXISTS report_url TEXT
    CHECK (report_url IS NULL
           OR (report_url ~ '^https?://' AND char_length(report_url) <= 2048));

ALTER TABLE public.shared_tasks
  ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.shared_tasks.report_url IS
    'Where this edition''s findings report is published (http/https). Written by `mt-eval shared-task report`; a display pointer, never a gate. Exempt from the 047 identity freeze. Migration 074.';
COMMENT ON COLUMN public.shared_tasks.report_generated_at IS
    'When the findings report behind report_url was generated from the frozen per-contest rankings. Exempt from the 047 identity freeze. Migration 074.';

-- The 047 guard freezes ONLY shared_task_id / year / created_at, so the two
-- new columns are writable by construction. Replaced verbatim-plus-comment so
-- the exemption is stated where the rule lives, not only in a migration header.
CREATE OR REPLACE FUNCTION public.reject_illegal_shared_task_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Identity only. Labels, descriptions, the prepare-time defaults, and (074)
  -- report_url / report_generated_at are all freely correctable in place.
  IF NEW.shared_task_id IS DISTINCT FROM OLD.shared_task_id
     OR NEW.year         IS DISTINCT FROM OLD.year
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'SHARED TASK GUARD: edition % identity is immutable (shared_task_id/year/created_at cannot change — an annual series rotates by INSERTING next year''s row, like qualifier vYYYY rotation).',
      OLD.shared_task_id;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'active' AND NEW.status = 'archived' THEN
      NULL;  -- the cycle closed
    ELSE
      RAISE EXCEPTION
        'SHARED TASK GUARD: illegal status transition % -> % for edition % (allowed: active->archived only).',
        OLD.status, NEW.status, OLD.shared_task_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_illegal_shared_task_mutation() IS
    'Freezes a shared-task edition''s identity (slug/year/created_at) and enforces one-way active->archived; labels, prepare-time defaults and the 074 report_url / report_generated_at pointers stay editable. Un-bypassable (service_role does not bypass triggers). Migrations 047 + 074.';

DROP TRIGGER IF EXISTS shared_tasks_identity_guard ON public.shared_tasks;
CREATE TRIGGER shared_tasks_identity_guard
    BEFORE UPDATE ON public.shared_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_illegal_shared_task_mutation();

-- ===========================================================================
-- 9. tickets: the community flagging kind.
-- ===========================================================================
-- No public count is ever surfaced from this table (RLS stays deny-all below
-- service_role) — a flag is an inbox item, not a score. An upheld flag shows
-- up only as run_cards.trust = 'disqualified', with the cause added to the
-- public rules by dated edit FIRST.
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_kind_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_kind_check
    CHECK (kind IN ('takedown', 'objection', 'correction', 'question', 'flag', 'other'));

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS subject_run_card_id TEXT
    CHECK (subject_run_card_id IS NULL
           OR subject_run_card_id ~ '^[0-9a-f-]{36}$');

COMMENT ON COLUMN public.tickets.subject_run_card_id IS
    'The run card a kind=''flag'' ticket is about (uuid5 shape). Deliberately NO foreign key: a flag must survive the row it names — including a card removed by the very takedown the flag asked for. Migration 074.';

CREATE INDEX IF NOT EXISTS idx_tickets_subject_run_card
    ON public.tickets (subject_run_card_id)
    WHERE subject_run_card_id IS NOT NULL;
