-- Migration 004: Add missing CI columns that publish.py already sends.
-- Without these, any publish with FST or composite CIs would cause
-- a PostgREST 400 error ("Could not find column").
--
-- Columns added:
--   fst_ci_lower         — 95% CI lower bound for FST acceptance rate
--   fst_ci_upper         — 95% CI upper bound for FST acceptance rate
--   composite_ci_lower   — 95% CI lower bound for composite score
--   composite_ci_upper   — 95% CI upper bound for composite score

ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS fst_ci_lower REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS fst_ci_upper REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS composite_ci_lower REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS composite_ci_upper REAL;

COMMENT ON COLUMN run_cards.fst_ci_lower IS '95% CI lower bound for FST acceptance rate.';
COMMENT ON COLUMN run_cards.fst_ci_upper IS '95% CI upper bound for FST acceptance rate.';
COMMENT ON COLUMN run_cards.composite_ci_lower IS '95% CI lower bound for composite score.';
COMMENT ON COLUMN run_cards.composite_ci_upper IS '95% CI upper bound for composite score.';
