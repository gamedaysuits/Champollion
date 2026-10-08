-- 023_run_cards_score_integrity.sql
-- Pre-launch audit 2026-06-13, blocking #2: the leaderboard accepted
-- client-computed scores with NO server-side validation — a hand-edited
-- report could publish chrf_plus_plus=99.9 / composite=0.99 and the DB took
-- it. This trigger is the un-bypassable floor: it rejects any run whose
-- metrics are out of range or whose run is vacuous, beneath every client
-- and key.
--
-- DESIGN NOTE (SSOT): the composite formula, weight tables, and tier
-- boundaries live ONLY in mt_eval_harness/scoring.py
-- ("No other module should define weights, tiers, or composite logic.").
-- Re-implementing the weighted/renormalized composite in plpgsql would
-- duplicate that logic and drift. So this trigger does NOT recompute the
-- composite — it enforces the invariants SQL CAN own without duplication
-- (ranges + non-vacuous + tier vocabulary). Composite-vs-components
-- CONSISTENCY (catching an in-range fabricated composite) is enforced in
-- the mandatory publish gate via the canonical scoring.py
-- (lint_run_reports.py --assemble; see migration-paired publish change,
-- audit blocking #3). Residual: a future edge function could move that
-- recompute fully server-side for total un-bypassability.

CREATE OR REPLACE FUNCTION validate_run_card_scores()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  evaluated int;
BEGIN
  -- Rate/probability metrics must be in [0,1].
  PERFORM 1;
  IF NEW.composite_score      IS NOT NULL AND (NEW.composite_score      < 0 OR NEW.composite_score      > 1)    THEN RAISE EXCEPTION 'composite_score % out of range [0,1]', NEW.composite_score; END IF;
  IF NEW.exact_match_rate     IS NOT NULL AND (NEW.exact_match_rate     < 0 OR NEW.exact_match_rate     > 1)    THEN RAISE EXCEPTION 'exact_match_rate % out of range [0,1]', NEW.exact_match_rate; END IF;
  IF NEW.fst_acceptance_rate  IS NOT NULL AND (NEW.fst_acceptance_rate  < 0 OR NEW.fst_acceptance_rate  > 1)    THEN RAISE EXCEPTION 'fst_acceptance_rate % out of range [0,1]', NEW.fst_acceptance_rate; END IF;
  IF NEW.equivalent_match_rate IS NOT NULL AND (NEW.equivalent_match_rate < 0 OR NEW.equivalent_match_rate > 1) THEN RAISE EXCEPTION 'equivalent_match_rate % out of range [0,1]', NEW.equivalent_match_rate; END IF;
  IF NEW.semantic_score       IS NOT NULL AND (NEW.semantic_score       < 0 OR NEW.semantic_score       > 1)    THEN RAISE EXCEPTION 'semantic_score % out of range [0,1]', NEW.semantic_score; END IF;
  IF NEW.code_switching_rate  IS NOT NULL AND (NEW.code_switching_rate  < 0 OR NEW.code_switching_rate  > 1)    THEN RAISE EXCEPTION 'code_switching_rate % out of range [0,1]', NEW.code_switching_rate; END IF;
  IF NEW.hallucination_rate   IS NOT NULL AND (NEW.hallucination_rate   < 0 OR NEW.hallucination_rate   > 1)    THEN RAISE EXCEPTION 'hallucination_rate % out of range [0,1]', NEW.hallucination_rate; END IF;
  IF NEW.style_consistency_rate IS NOT NULL AND (NEW.style_consistency_rate < 0 OR NEW.style_consistency_rate > 1) THEN RAISE EXCEPTION 'style_consistency_rate % out of range [0,1]', NEW.style_consistency_rate; END IF;

  -- chrF++ and COMET are 0–100 scale.
  IF NEW.chrf_plus_plus IS NOT NULL AND (NEW.chrf_plus_plus < 0 OR NEW.chrf_plus_plus > 100) THEN RAISE EXCEPTION 'chrf_plus_plus % out of range [0,100]', NEW.chrf_plus_plus; END IF;
  IF NEW.comet_score    IS NOT NULL AND (NEW.comet_score    < 0 OR NEW.comet_score    > 100) THEN RAISE EXCEPTION 'comet_score % out of range [0,100]', NEW.comet_score; END IF;

  -- chrF CI ordering sanity.
  IF NEW.chrf_ci_lower IS NOT NULL AND NEW.chrf_ci_upper IS NOT NULL
     AND NEW.chrf_ci_lower > NEW.chrf_ci_upper THEN
    RAISE EXCEPTION 'chrf_ci_lower % > chrf_ci_upper %', NEW.chrf_ci_lower, NEW.chrf_ci_upper;
  END IF;

  -- corpus_size must be positive.
  IF NEW.corpus_size IS NOT NULL AND NEW.corpus_size <= 0 THEN
    RAISE EXCEPTION 'corpus_size % must be > 0', NEW.corpus_size;
  END IF;

  -- Non-vacuous: the run must have actually evaluated entries. Vacuous
  -- runs (all errors, e.g. an invalid model id) were a real incident
  -- (omt-1600, 404/404). overall.evaluated lives in the run_card JSONB.
  IF NEW.run_card IS NOT NULL THEN
    evaluated := COALESCE((NEW.run_card #>> '{overall,evaluated}')::int,
                          (NEW.run_card #>> '{overall,total_entries}')::int,
                          NULL);
    IF evaluated IS NOT NULL AND evaluated <= 0 THEN
      RAISE EXCEPTION 'vacuous run: overall.evaluated = % (no entries scored)', evaluated;
    END IF;
  END IF;

  -- Tier vocabulary (scoring.py classify_quality_tier output set).
  IF NEW.quality_tier IS NOT NULL
     AND NEW.quality_tier NOT IN ('baseline','emerging','functional','deployable','fluent','unscored') THEN
    RAISE EXCEPTION 'quality_tier % not in the canonical vocabulary', NEW.quality_tier;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS run_cards_score_integrity ON run_cards;
CREATE TRIGGER run_cards_score_integrity
  BEFORE INSERT OR UPDATE ON run_cards
  FOR EACH ROW
  EXECUTE FUNCTION validate_run_card_scores();

COMMENT ON FUNCTION validate_run_card_scores() IS
  'Range-checks all metric columns, blocks vacuous runs, enforces tier vocabulary. Composite-vs-components consistency is enforced in the publish gate via canonical scoring.py (SSOT). Pre-launch audit 2026-06-13 blocking #2.';
