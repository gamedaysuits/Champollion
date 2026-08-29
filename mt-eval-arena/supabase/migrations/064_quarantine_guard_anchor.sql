-- 064_quarantine_guard_anchor.sql
--
-- CORRECTNESS FIX (launch review 2026-07-20, finding DB7 + E9) for the
-- known-improper-slice REGEX BACKSTOP shared, byte-identical, by two guards:
--   * migration 022  reject_quarantined_datasets()  — run_cards publish guard
--   * migration 041  public.contest_corpus_guard()  — standard-lane contest guard
--
-- THE BUG. The backstop was the UNANCHORED substring blocklist
--   (-quarantined | sample[-_]?62 | phase1[-_]?test | dev[-_]?124 | crk[-_]?master)
-- It matches its needles ANYWHERE in an id,
-- so legitimate FUTURE ids collide with the incident-specific crk slices:
--   · 'crk-master-2026'   (a versioned future crk master corpus) → blocked by 'crk[-_]?master'
--   · 'dev-1240', 'dev-12400' (any dev id whose number merely STARTS with 124) → blocked by 'dev[-_]?124'
--   · 'sample-620'        (a different sample count) → blocked by 'sample[-_]?62'
--   · ANY id containing the literal '-quarantined' → blocked outright
-- Because the guard also fires on UPDATE, such an id is permanently
-- unpublishable and contest-ineligible — with no datasets row to unflag,
-- since it was never quarantined in the first place.
--
-- THE FIX — ANCHOR to the known-bad shapes, not to substrings:
--   (sample[-_]?62(?![0-9])|phase1[-_]?test|dev[-_]?124(?![0-9])|crk[-_]?master(?![-_]?[0-9]))
--   · the bare '-quarantined' alternative is REMOVED — the two seeded incident
--     ids (crk-phase1-test-90-quarantined / crk-edtekla-dev-124-quarantined)
--     are still caught by their phase1-test / dev-124 markers AND remain flagged
--     in datasets.quarantined (the PRIMARY, data-driven mechanism); nothing that
--     was actually quarantined becomes publishable.
--   · the count markers gain a trailing non-digit lookahead: 'dev-124' still
--     matches, 'dev-1240' no longer does; 'sample-62' matches, 'sample-620' does not.
--   · 'crk[-_]?master(?![-_]?[0-9])' blocks the improper 'crk-master-corpus' /
--     bare 'crk-master' / 'crk_master', but ALLOWS a versioned 'crk-master-2026'
--     (a separator-then-digit suffix reads as a version, not the 2026-06-11 slice).
-- Negative-lookahead constraints (?!...) are supported identically by the
-- PostgreSQL ARE engine (the ~* operator) and by Python's `re` module (the
-- DB-less migration-text tests extract this exact string and compile it), so
-- the one literal stays a true single source across both.
--
-- WHAT IS PRESERVED (the sovereignty core — DO NOT BREAK):
--   · The improper-subset RANKING BAN still holds. The known-improper crk ids
--     (62-sample / 90-phase1 / 124-subset / crk-master proper) remain rejected
--     on run_cards INSERT (022) and on standard-lane contest creation (041).
--   · The datasets.quarantined flag + trigger remain the PRIMARY mechanism;
--     this regex is only the unregistered-id backstop. Both functions keep their
--     flag/sealed/quarantine checks unchanged — only the backstop string moves.
--   · The two backstops stay BYTE-IDENTICAL to each other (intentional twins).
--
-- E9 — SEARCH_PATH. reject_quarantined_datasets() was originally defined by 022
-- WITHOUT a search_path pin; migration 025 pinned it afterwards via ALTER
-- FUNCTION. A bare CREATE OR REPLACE would SILENTLY DROP that pin and
-- reintroduce advisor lint 0011 (role-mutable search_path). Both functions
-- below therefore carry `SET search_path = public` explicitly — 041 already had
-- it; 022's replacement now matches.
--
-- WHY A NEW MIGRATION: 022, 025, and 041 are already applied to prod; applied
-- migrations are never edited in place. CREATE OR REPLACE FUNCTION keeps each
-- existing trigger (run_cards_quarantine_guard on run_cards; contests_corpus_guard
-- on contests) bound to the same function name — the triggers are NOT dropped or
-- recreated here.
--
-- Idempotent (CREATE OR REPLACE). Prod-apply is founder-gated (CLAUDE.md).
--
-- ROLLBACK: re-run migrations 022 + 025 (022 restores the unanchored body, 025
-- re-pins search_path) and 041 (restores its unanchored twin).

-- ---------------------------------------------------------------------------
-- 022's run_cards publish guard — anchored backstop, search_path re-pinned.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_quarantined_datasets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Primary: the datasets.quarantined flag (data-driven).
  IF NEW.dataset_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM datasets d
        WHERE d.id = NEW.dataset_id AND d.quarantined
     ) THEN
    RAISE EXCEPTION
      'QUARANTINED DATASET: % is flagged quarantined and may not be published (see datasets.quarantine_reason).',
      NEW.dataset_id;
  END IF;
  -- Backstop: known-improper slice ids that may arrive unregistered. ANCHORED
  -- (migration 064) so it catches the incident-specific shapes but not legit
  -- lookalikes (crk-master-2026, dev-1240). Byte-identical to 041's twin.
  IF NEW.dataset_id ~* '(sample[-_]?62(?![0-9])|phase1[-_]?test|dev[-_]?124(?![0-9])|crk[-_]?master(?![-_]?[0-9]))' THEN
    RAISE EXCEPTION
      'QUARANTINED DATASET PATTERN: % matches a known-improper subset id (founder order 2026-06-13).',
      NEW.dataset_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION reject_quarantined_datasets() IS
  'Rejects publication of datasets flagged quarantined (datasets.quarantined) or matching the ANCHORED known-improper subset backstop (migration 064: blocks the crk 62-sample/90-phase1/124-subset/crk-master slices, not versioned lookalikes like crk-master-2026 / dev-1240). Any PUBLIC dataset run under its proper protocol ranks normally. Founder doctrine 2026-06-13.';

-- ---------------------------------------------------------------------------
-- 041's standard-lane contest guard — same anchored backstop (byte-identical
-- regex), everything else unchanged (already carried SET search_path = public).
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
  -- ANCHORED regex (both replaced together in migration 064), so an unregistered
  -- known-bad id cannot slip into a contest either — while versioned lookalikes
  -- (crk-master-2026, dev-1240) stay eligible.
  IF NEW.corpus_id ~* '(sample[-_]?62(?![0-9])|phase1[-_]?test|dev[-_]?124(?![0-9])|crk[-_]?master(?![-_]?[0-9]))' THEN
    RAISE EXCEPTION
      'CONTEST GUARD: corpus % matches a known-improper subset id (founder order 2026-06-13) — never eligible for a contest.',
      NEW.corpus_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_corpus_guard() IS
  'Contest eligibility at the data layer (migration 041; anchored backstop migration 064): a sealed contest requires a registered ACTIVE sealed_sets row and defers every run to the 038/039 authorization path; a standard contest refuses sealed sets, quarantined datasets, and the ANCHORED known-improper slice ids (byte-identical twin of reject_quarantined_datasets(); blocks the crk slices, not crk-master-2026 / dev-1240). Does NOT modify reject_quarantined_datasets()''s trigger. Un-bypassable (service_role does not bypass triggers).';
