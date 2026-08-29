-- 070_quarantine_patterns_to_data.sql
--
-- Move the improper-subset backstop from CODE to DATA (founder direction
-- 2026-08-19: nothing language-specific lives in code).
--
-- WHAT WAS WRONG. Migrations 022/041/064 compiled the 2026-06-13 incident's
-- shapes into the trigger bodies themselves:
--
--   the dataset id was regex-matched, inline in the body, against an
--   alternation of four incident shapes: the 62-sample slice, the phase-1
--   test slice, the 124-entry dev subset, and the unsplit master corpus.
--
-- One of those alternatives names a language. It was the last language-named
-- artifact in the database. This repo's rule is that language-specific sets
-- live in data, never in code — and that has to hold in SQL too, or it is not
-- a rule. The incident ids themselves are data ABOUT four bad artifacts; a row
-- may name them, a function body may not.
--
-- It was also operationally wrong: a new incident in ANY language needed a
-- prod migration, because the blocklist lived in two function bodies that had
-- to stay byte-identical to each other. That is a migration for an INSERT.
--
-- THE FIX. public.quarantined_id_patterns holds one row per blocked shape with
-- its reason and who recorded it. Both twin guards consult the table. The two
-- function bodies below are otherwise taken VERBATIM from 064 — every branch,
-- message string, and search_path pin is unchanged — and the four shapes are
-- seeded exactly as 064 spelled them. Behaviour on day one is identical:
-- every known-improper slice stays blocked, every versioned lookalike 064
-- fixed (crk-master-2026, dev-1240, sample-620) stays allowed.
--
-- WHAT IS PRESERVED (the sovereignty core — DO NOT BREAK):
--   · The improper-subset RANKING BAN holds, on identical patterns.
--   · datasets.quarantined stays the PRIMARY, data-driven mechanism; this
--     table is still only the unregistered-id backstop.
--   · Both guards stay TRIGGERS (service_role bypasses RLS, never triggers).
--   · Both keep SET search_path = public (E9, migrations 025/064).
--   · No trigger is dropped or recreated — CREATE OR REPLACE FUNCTION keeps
--     each existing trigger bound to the same function name.
--
-- FAIL-SAFE POSTURE. An empty pattern table means "no shape backstop", not
-- "block everything": datasets.quarantined still rejects every registered
-- quarantined set. That is the posture the backstop always had — a net under
-- the primary check, never the primary check.
--
-- Idempotent. Prod-apply is founder-gated (CLAUDE.md); rehearse on the
-- Supabase dev branch first (standing rule).
--
-- ROLLBACK: re-run 064 (restores both compiled-literal twins verbatim); the
-- table can then be dropped independently.

-- ---------------------------------------------------------------------------
-- The data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quarantined_id_patterns (
  pattern     text PRIMARY KEY,            -- POSIX regex, matched with ~* (case-insensitive)
  reason      text NOT NULL,               -- why this shape may never rank
  recorded_by text NOT NULL,               -- who recorded it (founder/steward lane)
  recorded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quarantined_id_patterns IS
  'Improper-subset id shapes that may never rank (migration 070). The BACKSTOP under datasets.quarantined, for ids that arrive unregistered. Data, not code: a new incident in any language is an INSERT, not a migration. Consulted by reject_quarantined_datasets() and contest_corpus_guard().';

-- Migration 054's event trigger auto-enables RLS on new tables, so WITHOUT an
-- explicit SELECT policy this table is deny-all — and both guards would
-- silently stop blocking anything. Public-read (the blocklist is not secret;
-- publishing it is how a contributor understands a rejection), service-role write.
ALTER TABLE public.quarantined_id_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quarantined_id_patterns_public_read ON public.quarantined_id_patterns;
CREATE POLICY quarantined_id_patterns_public_read
  ON public.quarantined_id_patterns FOR SELECT USING (true);

-- Seed: the four 2026-06-13 shapes, VERBATIM from 064's anchored alternation.
INSERT INTO public.quarantined_id_patterns (pattern, reason, recorded_by) VALUES
  ('sample[-_]?62(?![0-9])',
   'The 62-sample easy slice (board wipe 2026-06-13) — an improper subset that may never rank. Anchored so other counts (sample-620) are unaffected.',
   'founder 2026-06-13'),
  ('phase1[-_]?test',
   'The 90-entry phase-1 test slice (board wipe 2026-06-13) — an improper subset that may never rank.',
   'founder 2026-06-13'),
  ('dev[-_]?124(?![0-9])',
   'The 124-entry dev subset (board wipe 2026-06-13) — an improper subset that may never rank. Anchored so dev-1240 is unaffected.',
   'founder 2026-06-13'),
  ('crk[-_]?master(?![-_]?[0-9])',
   'The unsplit master corpus from the 2026-06-13 board wipe — an improper set that may never rank as an eval corpus. Anchored so a versioned crk-master-2026 is unaffected. Named here as DATA about one bad artifact, not as a rule about a language.',
   'founder 2026-06-13')
ON CONFLICT (pattern) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 022's run_cards publish guard — 064's body, patterns read from the table.
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
  -- Backstop: known-improper slice ids that may arrive unregistered. The
  -- SHAPES are rows in quarantined_id_patterns (migration 070) rather than a
  -- literal compiled into this body, so a new incident in any language is an
  -- INSERT and not a migration. Seeded verbatim from 064's anchored regex.
  IF NEW.dataset_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.quarantined_id_patterns p
        WHERE NEW.dataset_id ~* p.pattern
     ) THEN
    RAISE EXCEPTION
      'QUARANTINED DATASET PATTERN: % matches a known-improper subset id (founder order 2026-06-13).',
      NEW.dataset_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION reject_quarantined_datasets() IS
  'Rejects publication of datasets flagged quarantined (datasets.quarantined) or matching a shape in quarantined_id_patterns (migration 070 — the blocklist is DATA; nothing language-specific lives in this body). Any PUBLIC dataset run under its proper protocol ranks normally. Founder doctrine 2026-06-13.';

-- ---------------------------------------------------------------------------
-- 041's standard-lane contest guard — the same substitution, same twin rows.
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

  -- Backstop: the known-improper slice SHAPES, read from
  -- quarantined_id_patterns (migration 070) — the same rows the run_cards
  -- guard consults, so the twins can no longer drift apart by editing one
  -- literal and not the other.
  IF NEW.corpus_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.quarantined_id_patterns p
        WHERE NEW.corpus_id ~* p.pattern
     ) THEN
    RAISE EXCEPTION
      'CONTEST GUARD: corpus % matches a known-improper subset id (founder order 2026-06-13) — never eligible for a contest.',
      NEW.corpus_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_corpus_guard() IS
  'Contest eligibility at the data layer (migration 041; backstop moved to data in migration 070): a sealed contest requires a registered ACTIVE sealed_sets row and defers every run to the 038/039 authorization path; a standard contest refuses sealed sets, quarantined datasets, and any id matching quarantined_id_patterns — the SAME ROWS the run_cards guard reads, so the twins can no longer drift. Un-bypassable (service_role does not bypass triggers).';
