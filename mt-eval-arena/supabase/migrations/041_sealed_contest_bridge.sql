-- =============================================================================
-- Migration 041: sealed_contest_bridge — the explicit 'sealed' contest lane
-- =============================================================================
-- Wave 1.5 of the zero-knowledge sovereign-eval PoC: the bridge between the
-- contest machinery (008/035) and the sealed-set data backbone (037–040).
--
-- WHY. Before this migration, contests and sealed sets were structurally
-- mutually exclusive: a sealed set is quarantined by default (037, on the
-- migration-022 doctrine), and contest eligibility hard-blocks quarantined
-- corpora in every lane (035 + license_use.contest_dataset_eligible). So a
-- community that registered a sealed sovereign held-out set could never run a
-- contest against it — the exact self-serve path the sovereignty docs promise.
-- This migration carves out ONE explicit, narrow lane that resolves that,
-- without loosening anything else.
--
-- THE SEALED LANE (data-driven flag + un-bypassable trigger; never a parallel
-- approach — the proven 022/033/037 pattern):
--   - contests gains a `lane` column: 'standard' (default) | 'sealed'.
--   - A lane='sealed' contest is eligible IFF its corpus_id IS a registered,
--     ACTIVE public.sealed_sets row (037). No sealed_sets registration, no
--     sealed contest — fail-closed.
--   - A lane='standard' contest REFUSES a sealed set (it must use the sealed
--     lane) and REFUSES any quarantined dataset (unchanged doctrine).
--
-- NO ACCESS IS GRANTED HERE (M2/M4). A sealed contest row conveys ZERO access
-- to the sealed corpus. It is an announcement — a name, a prize frame, a
-- language pair. EVERY run against the sealed set still enters the
-- authorization path: a pending authorization_request (038), an M-of-N
-- custodian decision, a single-use time-boxed fingerprint-bound grant (039),
-- and the append-only audit trail (040). The contest defers execution to that
-- machinery; it does not shortcut it. There is no column, function, or policy
-- in this migration that touches ciphertext, keys, or grants.
--
-- MIGRATION 022 IS NOT WEAKENED. reject_quarantined_datasets() and the
-- run_cards_quarantine_guard trigger are NOT modified, redefined, or dropped
-- here. Ordinary quarantined datasets (the improper EdTeKLA slices and anything
-- an admin flags) remain ineligible to publish AND ineligible for contests in
-- BOTH lanes. The sealed lane is not a quarantine bypass: it applies only to a
-- corpus with a sealed_sets registration, i.e. one whose custody, digest, and
-- qualifier are already on the record.
--
-- CONTENT-FREE (L1). This migration creates no table and adds no column that
-- could carry corpus content — `lane` is an enum-like TEXT flag.
--
-- IDEMPOTENT (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF
-- EXISTS). DEV/STAGING BRANCH ONLY — do NOT apply to the production main
-- project without the founder's explicit go-ahead (CLAUDE.md).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS contests_corpus_guard ON public.contests;
--   DROP FUNCTION IF EXISTS public.contest_corpus_guard();
--   ALTER TABLE public.contests DROP COLUMN IF EXISTS lane;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Column: contests.lane — 'standard' (default) | 'sealed'
-- ---------------------------------------------------------------------------
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS lane TEXT NOT NULL DEFAULT 'standard'
    CHECK (lane IN ('standard', 'sealed'));

COMMENT ON COLUMN public.contests.lane IS
  'standard | sealed. A sealed contest is eligible ONLY over a registered, active sealed_sets entry (migration 037) and grants no access: every run still passes the 038 pending-request -> M-of-N -> 039 grant path, audited by 040. A standard contest refuses sealed sets and quarantined datasets. Migration 041.';

-- ---------------------------------------------------------------------------
-- Eligibility guard — the data-layer form of the contest eligibility check
-- (client-side mirror: arena/mt_eval_harness/contest.py create_contest).
-- Mirrors the migration-022/033 reject-trigger pattern: a BEFORE trigger that
-- RAISES, so the rule holds beneath every client and key (service_role does
-- not bypass triggers).
--
--   lane='sealed'   -> corpus_id MUST be a registered, ACTIVE sealed_sets row.
--                      Fail-closed: no registration, or a planned/retired set,
--                      is rejected. Execution then defers to 038/039/040.
--   lane='standard' -> corpus_id must NOT be a sealed set (use the sealed
--                      lane), must NOT be a quarantined dataset (022 doctrine),
--                      and must NOT match the known-improper slice-id backstop
--                      (the same regex as migration 022's run_cards guard, so
--                      the two guards never drift apart on the known-bad ids).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_corpus_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sealed_status text;
  v_quarantined   boolean;
BEGIN
  -- Re-check only when the corpus/lane pairing changes. A later lifecycle
  -- update (e.g. closing or archiving a contest whose corpus was quarantined
  -- AFTER creation) must not be blocked by the eligibility rules — the
  -- quarantine still bites where it matters (run_cards, migration 022).
  IF TG_OP = 'UPDATE'
     AND NEW.corpus_id IS NOT DISTINCT FROM OLD.corpus_id
     AND NEW.lane      IS NOT DISTINCT FROM OLD.lane THEN
    RETURN NEW;
  END IF;

  SELECT s.status INTO v_sealed_status
  FROM public.sealed_sets s
  WHERE s.sealed_set_id = NEW.corpus_id;

  IF NEW.lane = 'sealed' THEN
    -- Fail-closed: a sealed contest REQUIRES an existing sealed_sets
    -- registration (037). The registration is what puts the custodian group,
    -- ciphertext digest, and public qualifier on the record — without it there
    -- is nothing for the 038/039 authorization machinery to gate.
    IF v_sealed_status IS NULL THEN
      RAISE EXCEPTION
        'SEALED CONTEST GUARD: contest % names corpus % but no sealed_sets registration exists — a sealed contest requires a registered sealed set (migration 037; register the set before the contest).',
        NEW.id, NEW.corpus_id;
    END IF;
    IF v_sealed_status <> 'active' THEN
      RAISE EXCEPTION
        'SEALED CONTEST GUARD: sealed set % is ''%'' (not active) — a sealed contest may only run against an active sealed set.',
        NEW.corpus_id, v_sealed_status;
    END IF;
    -- Eligible. NOTE: this authorizes the CONTEST to exist, not any run —
    -- every evaluation against the sealed set still requires a pending
    -- authorization_request (038) and a custodian-minted grant (039).
    RETURN NEW;
  END IF;

  -- lane = 'standard' -------------------------------------------------------
  -- A sealed set never backs a standard contest: the sealed lane (and its
  -- authorization machinery) is the only door.
  IF v_sealed_status IS NOT NULL THEN
    RAISE EXCEPTION
      'CONTEST GUARD: corpus % is a registered sealed set — it may only back a lane=''sealed'' contest, whose every run passes the custodian authorization path (migrations 038/039).',
      NEW.corpus_id;
  END IF;

  -- Quarantine always wins (migration 022 doctrine, unchanged): a quarantined
  -- dataset never backs a contest in any lane.
  SELECT d.quarantined INTO v_quarantined
  FROM public.datasets d
  WHERE d.id = NEW.corpus_id;

  IF COALESCE(v_quarantined, false) THEN
    RAISE EXCEPTION
      'CONTEST GUARD: corpus % is flagged quarantined and never backs a contest in any lane (see datasets.quarantine_reason; migration 022 doctrine).',
      NEW.corpus_id;
  END IF;

  -- Backstop: the known-improper slice ids, byte-identical to migration 022's
  -- regex, so an unregistered known-bad id cannot slip into a contest either.
  IF NEW.corpus_id ~* '(-quarantined|sample[-_]?62|phase1[-_]?test|dev[-_]?124|crk[-_]?master)' THEN
    RAISE EXCEPTION
      'CONTEST GUARD: corpus % matches a known-improper subset id (founder order 2026-06-13) — never eligible for a contest.',
      NEW.corpus_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_corpus_guard() IS
  'Contest eligibility at the data layer (migration 041): a sealed contest requires a registered ACTIVE sealed_sets row and defers every run to the 038/039 authorization path; a standard contest refuses sealed sets, quarantined datasets, and the migration-022 known-improper slice ids. Does NOT modify reject_quarantined_datasets() — migration 022''s run_cards guard is untouched. Un-bypassable (service_role does not bypass triggers).';

DROP TRIGGER IF EXISTS contests_corpus_guard ON public.contests;
CREATE TRIGGER contests_corpus_guard
  BEFORE INSERT OR UPDATE ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_corpus_guard();
