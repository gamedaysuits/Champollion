-- 053_contest_use_context_guard.sql
--
-- THE HOLE (launch-readiness audit 2026-07-18, M3). The use_context
-- (commercial | non-commercial) eligibility rule — founder doctrine
-- 2026-06-19, migration 035 — was enforced ONLY in client code
-- (license_use.contest_dataset_eligible, called by contest.py
-- create_contest). A client that skips that gate could create a COMMERCIAL
-- contest over a NonCommercial dataset and rank NC-licensed work in a
-- commercial lane — exactly the license breach the doctrine forbids.
--
-- THIS MIGRATION mirrors the client gate at the database layer, the
-- 041 contest_corpus_guard way: a BEFORE INSERT OR UPDATE trigger on
-- contests that re-checks whenever the (corpus_id, use_context, lane)
-- pairing changes. 041 itself is NOT modified (its header's promise), and
-- migration 022's quarantine doctrine is untouched — quarantine already
-- blocks BOTH lanes via 041.
--
-- SSOT MIRROR. is_license_commercial_safe() below is the SQL twin of
-- license_use.is_commercial_safe() (itself the Python mirror of
-- cli/lib/license-gate.mjs isPermissiveSpdx). Kept token-for-token faithful,
-- including evaluation ORDER (the -SA check runs before the CC-BY prefix
-- test, so CC-BY-SA is refused) and the no-trim, uppercase comparison.
-- tests/test_contest_hardening_migrations.py freezes the parity so the
-- three mirrors cannot drift.
--
-- THE RULE (contest_dataset_eligible, mirrored exactly):
--   · lane='sealed'            → not this guard's lane (041 + the 038/039
--                                authorization machinery own it).
--   · use_context='non-commercial' → the SAFE lane: permissive, NC, SA, ND,
--                                own/unregistered corpora all rank; only
--                                quarantine blocks (enforced in 041).
--   · use_context='commercial' → STRICT, fail-safe: the corpus must be a
--                                REGISTERED dataset whose license is
--                                commercial-safe. Unregistered → license
--                                unknown → refused. NC / SA / ND / copyleft /
--                                unstated / mixed / proprietary → refused.
--
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). DEV/STAGING
-- BRANCH ONLY without the founder's explicit go-ahead (CLAUDE.md); applied
-- to prod 2026-07-18 under the founder's launch-hardening authorization.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS contests_use_context_guard ON public.contests;
--   DROP FUNCTION IF EXISTS public.contest_use_context_guard();
--   DROP FUNCTION IF EXISTS public.is_license_commercial_safe(text);

-- ---------------------------------------------------------------------------
-- License classifier — SQL twin of license_use.is_commercial_safe().
-- True ONLY for a permissive, commercial-safe license (attribution at most).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_license_commercial_safe(license_str text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s    text;
  pref text;
BEGIN
  IF license_str IS NULL OR license_str = '' THEN
    RETURN false;
  END IF;
  -- Python: str(license_str).upper() — uppercased, NOT trimmed (faithful).
  s := upper(license_str);

  -- (1) NC / ShareAlike / NoDerivatives markers → never commercial-safe.
  IF strpos(s, '-NC') > 0 OR strpos(s, '-SA') > 0 OR strpos(s, '-ND') > 0 THEN
    RETURN false;
  END IF;

  -- (2) Copyleft.
  IF strpos(s, 'GPL') > 0 THEN
    RETURN false;
  END IF;

  -- (3) Unconfirmed / unstated / mixed / restricted terms (fail-safe).
  FOREACH pref IN ARRAY ARRAY[
    'UNCONFIRMED', 'UNSTATED', 'NO-PUBLIC', 'MIXED', 'SIL-TERMS',
    'PROPRIETARY', 'RESTRICTED'
  ] LOOP
    IF strpos(s, pref) > 0 THEN
      RETURN false;
    END IF;
  END LOOP;

  -- (4) Bare "CC" = unspecified version → unsafe.
  IF s = 'CC' THEN
    RETURN false;
  END IF;

  -- (5) Permissive family prefixes (Python startswith → position 1).
  FOREACH pref IN ARRAY ARRAY[
    'CC-BY', 'CC0', 'APACHE', 'UNICODE', 'BSD', 'MIT',
    'PUBLIC DOMAIN', 'PUBLICDOMAIN', 'PD-'
  ] LOOP
    IF strpos(s, pref) = 1 THEN
      RETURN true;
    END IF;
  END LOOP;

  -- (6) Known Champollion LicenseRef families.
  FOREACH pref IN ARRAY ARRAY[
    'LICENSEREF-CHAMPOLLION-OWN', 'LICENSEREF-PUBLICDOMAIN',
    'LICENSEREF-FACTUALDATA', 'LICENSEREF-IANA'
  ] LOOP
    IF strpos(s, pref) = 1 THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.is_license_commercial_safe(text) IS
  'True only for a permissive, commercial-safe license (attribution at most). SQL twin of license_use.is_commercial_safe / license-gate.mjs isPermissiveSpdx — token lists and evaluation order frozen by tests/test_contest_hardening_migrations.py. NC/SA/ND/copyleft/unstated/mixed/proprietary/bare-CC → false. Migration 053.';

-- ---------------------------------------------------------------------------
-- The trigger — the DB layer of contest_dataset_eligible's use-context rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_use_context_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d_found   boolean := false;
  d_license text;
BEGIN
  -- Re-check only when the (corpus, use_context, lane) pairing changes —
  -- the 041 posture: lifecycle updates (closing, archiving) are never
  -- blocked by eligibility rules.
  IF TG_OP = 'UPDATE'
     AND NEW.corpus_id   IS NOT DISTINCT FROM OLD.corpus_id
     AND NEW.use_context IS NOT DISTINCT FROM OLD.use_context
     AND NEW.lane        IS NOT DISTINCT FROM OLD.lane THEN
    RETURN NEW;
  END IF;

  -- The sealed lane is governed by 041 + the 038/039 authorization path;
  -- the non-commercial lane is the safe lane (only quarantine blocks, and
  -- 041 enforces that in both lanes).
  IF NEW.lane = 'sealed' OR NEW.use_context <> 'commercial' THEN
    RETURN NEW;
  END IF;

  -- Commercial lane: STRICT, fail-safe (contest_dataset_eligible mirror).
  SELECT true, d.license INTO d_found, d_license
  FROM public.datasets d
  WHERE d.id = NEW.corpus_id;

  IF NOT COALESCE(d_found, false) THEN
    RAISE EXCEPTION
      'USE-CONTEXT GUARD: contest % is use_context=''commercial'' but corpus % is not a registered dataset — its license is unknown, and unknown is fail-safe restricted in the commercial lane (license_use doctrine 2026-06-19). Register the dataset with a commercial-safe license, or create the contest as non-commercial.',
      NEW.id, NEW.corpus_id;
  END IF;

  IF NOT is_license_commercial_safe(d_license) THEN
    RAISE EXCEPTION
      'USE-CONTEXT GUARD: contest % is use_context=''commercial'' but corpus % carries license ''%'' — NonCommercial / ShareAlike / NoDerivatives / copyleft / unstated / restricted licenses never rank in a commercial lane (founder doctrine 2026-06-19; migration 035). A non-commercial contest MAY use this corpus.',
      NEW.id, NEW.corpus_id, COALESCE(d_license, '<null>');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_use_context_guard() IS
  'DB layer of the use_context eligibility rule (migration 053, audit 2026-07-18 M3): a commercial contest requires a REGISTERED dataset with a commercial-safe license (is_license_commercial_safe); the non-commercial lane is unaffected (only quarantine blocks there, via 041). Mirrors license_use.contest_dataset_eligible; 041''s contest_corpus_guard is untouched. Un-bypassable (service_role does not bypass triggers).';

DROP TRIGGER IF EXISTS contests_use_context_guard ON public.contests;
CREATE TRIGGER contests_use_context_guard
  BEFORE INSERT OR UPDATE ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_use_context_guard();
