-- Migration 002: Add metric and provider columns to run_cards
--
-- Context: v2.0.0 harness added COMET scoring, bootstrap confidence intervals,
-- corpus BLEU, and the groundwork for multi-provider support. publish.py sends
-- these fields but the table lacks the columns.
--
-- Columns added:
--   corpus_bleu           — BLEU score (0–100)
--   comet_score           — COMET neural metric score (~0.0–1.0, nullable if unbabel-comet not installed)
--   chrf_ci_lower         — 95% CI lower bound for chrF++
--   chrf_ci_upper         — 95% CI upper bound for chrF++
--   exact_match_ci_lower  — 95% CI lower bound for exact match rate
--   exact_match_ci_upper  — 95% CI upper bound for exact match rate
--   api_provider          — API provider used: openrouter, openai, anthropic, gemini

-- Metric columns
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS corpus_bleu REAL,
  ADD COLUMN IF NOT EXISTS comet_score REAL;

-- Bootstrap confidence interval columns (percentile bootstrap, n=1000, alpha=0.05)
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS chrf_ci_lower REAL,
  ADD COLUMN IF NOT EXISTS chrf_ci_upper REAL,
  ADD COLUMN IF NOT EXISTS exact_match_ci_lower REAL,
  ADD COLUMN IF NOT EXISTS exact_match_ci_upper REAL;

-- Provider tracking (defaults to 'openrouter' for backward compat)
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS api_provider TEXT DEFAULT 'openrouter';

-- Column comments for documentation
COMMENT ON COLUMN run_cards.corpus_bleu IS 'Corpus-level BLEU score (0–100). SacreBLEU implementation.';
COMMENT ON COLUMN run_cards.comet_score IS 'COMET neural MT metric score. Nullable — requires unbabel-comet optional dependency.';
COMMENT ON COLUMN run_cards.chrf_ci_lower IS '95% CI lower bound for chrF++ (percentile bootstrap, n=1000).';
COMMENT ON COLUMN run_cards.chrf_ci_upper IS '95% CI upper bound for chrF++ (percentile bootstrap, n=1000).';
COMMENT ON COLUMN run_cards.exact_match_ci_lower IS '95% CI lower bound for exact match rate (percentile bootstrap, n=1000).';
COMMENT ON COLUMN run_cards.exact_match_ci_upper IS '95% CI upper bound for exact match rate (percentile bootstrap, n=1000).';
COMMENT ON COLUMN run_cards.api_provider IS 'API provider used for the run: openrouter, openai, anthropic, gemini.';

-- Ensure RLS policy allows authenticated users to write the new columns.
-- The existing INSERT/UPDATE policies should cover this since they grant
-- column-level access implicitly, but verify after running.
