-- 072_contests_lifecycle_guard.sql
--
-- THE HOLE (contest beta 2026-09-06). The contests row has always carried a
-- lifecycle (`status` open|closed|archived, migration 008) and, since 043, an
-- intake door (`intake_open`), but NOTHING enforced how they move:
--
--   · the 008/031 "Owner update contests" RLS policy admits ANY column change
--     by the owner — a closed contest could be re-opened, its corpus_id,
--     language_pair, lane or use_context rewritten under the entries already
--     ranked against it, and `created_by` (the identity every later policy
--     compares) swapped after the fact;
--   · a contest could be marked `closed` with no result of record, and a
--     recorded result could be edited afterwards — the competition half
--     shipping with this migration (`mt-eval contest rank / close / export`,
--     arena/mt_eval_harness/contest_rank.py) freezes the ranking into
--     `metadata.final_ranking` at close, which only means something if the
--     database refuses to let it drift;
--   · `metadata.primary_metric` (the metric the ranking is built on) was free
--     text with no vocabulary and no freeze — an organizer could change the
--     ranking rule after seeing the entries.
--
-- THIS MIGRATION adds ONE BEFORE INSERT OR UPDATE trigger,
-- `contests_lifecycle_guard`, in the 038/043/047 identity-freeze + one-way
-- state-machine style:
--
--   1. IDENTITY FREEZE (UPDATE): id, corpus_id, language_pair, lane,
--      use_context, created_by, created_at never change. `shared_task_id`
--      attaches ONCE (NULL → value); it is never detached or re-pointed.
--      (041/053 already skip their eligibility re-checks when corpus/lane are
--      unchanged; with this freeze they can never change at all.)
--   2. ONE-WAY LIFECYCLE: open → closed → archived. No re-opening, no skipping
--      straight to archived, no INSERT born anywhere but 'open' (052 already
--      enforces the birth state; restated here so the rule reads in one place).
--   3. CLOSE REQUIRES A RESULT: the transition to 'closed' REQUIRES
--      `metadata.final_ranking` to be a JSON object; the trigger FORCES
--      `intake_open = false` and SERVER-STAMPS `metadata.closed_at = now()`
--      (a client-supplied closed_at is overwritten). `closed_by` stays
--      client-supplied (the CLI writes the JWT email; a service-role close has
--      no email claim to read).
--   4. FROZEN RESULT: after close, `metadata.final_ranking`, `closed_at` and
--      `closed_by` are immutable and `intake_open` can never become true again.
--   5. PRIMARY METRIC: `metadata.primary_metric`, when present, must be one of
--      chrf_plus_plus | bleu | comet_score | composite — the rankable subset of
--      the canonical ids in shared/metric-registry.json (contest_rank.
--      PRIMARY_METRICS; tests/test_contest_lifecycle_migration.py asserts the
--      two vocabularies match). It is FROZEN once any contest_submissions or
--      contest_intake row exists for the contest: the ranking rule cannot be
--      changed after entries are in.
--   6. NO RESULT KEYS AT INSERT: a contest is born without final_ranking /
--      closed_at / closed_by, and while open none of them may be written
--      except through the close transition itself.
--
-- Everything else in `metadata` stays free-form (the website reads only
-- fixed columns — cli/website/src/utils/contestLoader.js — so adding keys is
-- safe). service_role bypasses RLS but NOT this trigger (the 043 posture).
--
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). DEV/LOCAL ONLY:
-- apply to a dev branch or the local stack; production application needs the
-- founder's explicit go-ahead (CLAUDE.md). Until it is applied on prod, the
-- CLI performs the same checks client-side (contest.py close_contest /
-- set_intake) — but only the trigger holds beneath every client and key.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS contests_lifecycle_guard ON public.contests;
--   DROP FUNCTION IF EXISTS public.contest_lifecycle_guard();
--   -- No columns or rows are touched by this migration; metadata keys written
--   -- by the CLI (primary_metric / final_ranking / closed_at / closed_by)
--   -- remain as plain JSONB data after rollback.

-- ---------------------------------------------------------------------------
-- The guard.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_metric      text;
  v_has_entries boolean;
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

  -- ---- 5. primary_metric frozen once entries exist ------------------------
  IF (NEW.metadata ->> 'primary_metric') IS DISTINCT FROM (OLD.metadata ->> 'primary_metric') THEN
    SELECT EXISTS (SELECT 1 FROM public.contest_submissions cs WHERE cs.contest_id = OLD.id)
           OR EXISTS (SELECT 1 FROM public.contest_intake ci WHERE ci.contest_id = OLD.id)
      INTO v_has_entries;
    IF v_has_entries THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: contest % already has entries — metadata.primary_metric (''%'' → ''%'') is frozen; the ranking rule cannot change after submissions are in.',
        OLD.id, OLD.metadata ->> 'primary_metric', NEW.metadata ->> 'primary_metric';
    END IF;
  END IF;

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
    'Contest lifecycle discipline beneath every client and key (migration 072): identity freeze (id/corpus_id/language_pair/lane/use_context/created_by/created_at; shared_task_id attaches once), one-way open -> closed -> archived, close REQUIRES metadata.final_ranking (object) and forces intake_open=false + server-stamps metadata.closed_at, result immutable after close, metadata.primary_metric vocabulary-checked (chrf_plus_plus|bleu|comet_score|composite) and frozen once entries exist, no result keys at INSERT. Un-bypassable (service_role does not bypass triggers).';

DROP TRIGGER IF EXISTS contests_lifecycle_guard ON public.contests;
CREATE TRIGGER contests_lifecycle_guard
    BEFORE INSERT OR UPDATE ON public.contests
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_lifecycle_guard();
