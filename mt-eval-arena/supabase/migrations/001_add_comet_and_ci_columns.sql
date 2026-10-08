-- ============================================================================
-- Migration 001: Add COMET score, BLEU, and confidence interval columns
-- ============================================================================
--
-- WHAT: Extends the `run_cards` leaderboard table with new metric columns
-- from mt-eval-harness v2.1:
--   - COMET neural metric score (from unbabel-comet)
--   - corpus BLEU score (was computed but not stored)
--   - Bootstrap 95% confidence intervals for chrF++ and exact match rate
--
-- WHY:
--   - COMET is the primary automatic metric for system-level MT evaluation
--     since WMT 2022. Storing it enables neural-metric-based ranking.
--   - BLEU was already computed in TestReports but not persisted to Supabase.
--   - Confidence intervals (CIs) enable the leaderboard to show statistical
--     uncertainty, preventing false precision in rankings.
--
-- BACKWARD COMPATIBILITY:
--   - All new columns are NULLABLE — existing rows are unaffected.
--   - The publish.py module populates these fields when available and
--     sends NULL when not (e.g., COMET=NULL if unbabel-comet isn't installed).
--   - The full run_card JSONB column already captures everything; these
--     top-level columns enable efficient filtering and sorting.
--
-- METHODOLOGY NOTES (see confidence.py module docstring for full justification):
--   - CIs use percentile bootstrap resampling (Koehn 2004, SacreBLEU convention)
--   - n_bootstrap = 1000 (SacreBLEU/WMT default)
--   - seed = 12345 (SacreBLEU default for reproducibility)
--   - alpha = 0.05 → 95% confidence intervals
--
-- APPLY:
--   Run this migration against your Supabase project via the SQL Editor
--   or the Supabase CLI:
--     supabase db push --db-url <your-db-url>
--
-- ROLLBACK:
--   ALTER TABLE run_cards
--     DROP COLUMN IF EXISTS comet_score,
--     DROP COLUMN IF EXISTS corpus_bleu,
--     DROP COLUMN IF EXISTS chrf_ci_lower,
--     DROP COLUMN IF EXISTS chrf_ci_upper,
--     DROP COLUMN IF EXISTS exact_match_ci_lower,
--     DROP COLUMN IF EXISTS exact_match_ci_upper;
-- ============================================================================

-- COMET score: neural quality estimation metric (0.0–1.0 scale).
-- NULL if unbabel-comet was not installed when the evaluation ran.
-- Model: Unbabel/wmt22-comet-da (WMT 2022 winning reference-based model).
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS comet_score FLOAT8;

COMMENT ON COLUMN run_cards.comet_score IS
  'COMET neural metric score (0.0–1.0). Model: Unbabel/wmt22-comet-da. '
  'NULL if unbabel-comet was not installed. See metrics_comet.py.';

-- Corpus BLEU score: was computed but previously not stored as a top-level column.
-- Uses sacrebleu default tokenization (international tokenizer).
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS corpus_bleu FLOAT8;

COMMENT ON COLUMN run_cards.corpus_bleu IS
  'SacreBLEU corpus BLEU score. Computed by tester.py.';

-- chrF++ confidence interval bounds (95% bootstrap CI).
-- Enables the leaderboard to display uncertainty ranges.
-- Example: chrF++ = 42.96 [40.1 – 45.8]
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS chrf_ci_lower FLOAT8;

ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS chrf_ci_upper FLOAT8;

COMMENT ON COLUMN run_cards.chrf_ci_lower IS
  'Lower bound of 95% bootstrap CI for chrF++ (n=1000, seed=12345).';
COMMENT ON COLUMN run_cards.chrf_ci_upper IS
  'Upper bound of 95% bootstrap CI for chrF++ (n=1000, seed=12345).';

-- Exact match rate confidence interval bounds (95% bootstrap CI).
-- Values are 0.0–1.0 (matching the rate field, NOT percentage).
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS exact_match_ci_lower FLOAT8;

ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS exact_match_ci_upper FLOAT8;

COMMENT ON COLUMN run_cards.exact_match_ci_lower IS
  'Lower bound of 95% bootstrap CI for exact match rate (0.0–1.0).';
COMMENT ON COLUMN run_cards.exact_match_ci_upper IS
  'Upper bound of 95% bootstrap CI for exact match rate (0.0–1.0).';

-- ============================================================================
-- Indexes: Enable efficient leaderboard sorting and filtering by COMET.
-- ============================================================================

-- Index for sorting the leaderboard by COMET score (descending, NULLs last).
-- This is the most common leaderboard sort after chrF++ and exact match.
CREATE INDEX IF NOT EXISTS idx_run_cards_comet_score
  ON run_cards (comet_score DESC NULLS LAST);
