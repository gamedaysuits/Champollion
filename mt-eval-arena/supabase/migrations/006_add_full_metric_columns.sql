-- Migration 006: Add full metric columns for behavioral metrics, throughput,
-- and per-entry LYSS verdicts.
--
-- WHY: The "record everything" mandate requires that ALL computed metrics
-- are persisted in the database, not just aggregates. Previously, behavioral
-- metrics (code_switching_rate, hallucination_rate, terminology_adherence)
-- were computed and fed into the composite score but never stored — making
-- retroactive rescoring and post-facto analysis impossible.
--
-- This migration adds:
--   1. Behavioral metric columns on run_cards (aggregate rates)
--   2. Surface metric columns (TER, length_ratio)
--   3. Throughput columns (tokens_per_second, entries_per_minute, cost_per_source_char)
--   4. Per-entry LYSS verdict columns on run_card_entries (denormalized from plugin_metrics)
--
-- DESIGN: Denormalized LYSS verdicts on run_card_entries enable SQL-level
-- filtering ("show me all entries where FST rejected the translation")
-- without parsing the plugin_metrics JSONB blob.

-- =========================================================================
-- run_cards: Behavioral metrics (§2.4 of scoring spec)
-- =========================================================================

-- Code-switching rate: fraction of entries containing source-language tokens
-- in the target translation (0.0–1.0, lower is better)
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS code_switching_rate REAL;

-- Hallucination rate: fraction of entries containing fabricated content
-- not present in source or reference (0.0–1.0, lower is better)
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS hallucination_rate REAL;

-- Terminology adherence: fraction of required glossary terms correctly used
-- (0.0–1.0, higher is better; NULL if no glossary configured)
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS terminology_adherence REAL;

COMMENT ON COLUMN run_cards.code_switching_rate IS 'Fraction of entries with source-language leakage in translation (0–1). Lower is better.';
COMMENT ON COLUMN run_cards.hallucination_rate IS 'Fraction of entries with hallucinated content (0–1). Lower is better.';
COMMENT ON COLUMN run_cards.terminology_adherence IS 'Fraction of glossary terms correctly used (0–1). Higher is better. NULL if no glossary.';

-- =========================================================================
-- run_cards: Surface metrics
-- =========================================================================

-- Translation Edit Rate: edit distance between predicted and reference,
-- normalized by reference length (0–∞, lower is better)
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS ter REAL;

-- Length ratio: avg(len(predicted) / len(reference)), ideal = 1.0
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS length_ratio REAL;

COMMENT ON COLUMN run_cards.ter IS 'Translation Edit Rate (0–∞). Lower is better.';
COMMENT ON COLUMN run_cards.length_ratio IS 'Average predicted/reference length ratio. Ideal = 1.0.';

-- =========================================================================
-- run_cards: Throughput & cost metrics (§3.6 / §7 of scoring spec)
-- =========================================================================

ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS tokens_per_second REAL,
  ADD COLUMN IF NOT EXISTS entries_per_minute REAL,
  ADD COLUMN IF NOT EXISTS cost_per_source_char REAL;

COMMENT ON COLUMN run_cards.tokens_per_second IS 'Total tokens processed / elapsed seconds. Higher is better.';
COMMENT ON COLUMN run_cards.entries_per_minute IS 'Entries translated per minute. Higher is better.';
COMMENT ON COLUMN run_cards.cost_per_source_char IS 'USD per source character. Comparable across languages.';

-- =========================================================================
-- run_card_entries: Per-entry LYSS verdicts (denormalized from plugin_metrics)
-- =========================================================================
-- These columns duplicate data that's already in the plugin_metrics JSONB
-- blob, but having them as proper columns enables SQL-level filtering and
-- indexing without JSONB path queries.

-- FST validity: did the GiellaLT FST accept the predicted translation?
ALTER TABLE run_card_entries
  ADD COLUMN IF NOT EXISTS fst_valid BOOLEAN;

-- Equivalence match: did the CRK linter confirm structural equivalence?
ALTER TABLE run_card_entries
  ADD COLUMN IF NOT EXISTS equivalent_match BOOLEAN;

-- Semantic verdict: outcome of the LYSS-sem dictionary-gloss-overlap check
-- Values: "VALID", "MISMATCH", "UNKNOWN", "ERROR", NULL
ALTER TABLE run_card_entries
  ADD COLUMN IF NOT EXISTS semantic_verdict TEXT;

-- Code-switching: was source-language leakage detected in this entry?
ALTER TABLE run_card_entries
  ADD COLUMN IF NOT EXISTS code_switching_detected BOOLEAN;

-- Hallucination: was fabricated content detected in this entry?
ALTER TABLE run_card_entries
  ADD COLUMN IF NOT EXISTS hallucination_detected BOOLEAN;

COMMENT ON COLUMN run_card_entries.fst_valid IS 'GiellaLT FST accepted the predicted translation. LYSS-fst verdict.';
COMMENT ON COLUMN run_card_entries.equivalent_match IS 'CRK linter confirmed structural equivalence. LYSS-eq verdict.';
COMMENT ON COLUMN run_card_entries.semantic_verdict IS 'LYSS-sem verdict: VALID, MISMATCH, UNKNOWN, ERROR, or NULL.';
COMMENT ON COLUMN run_card_entries.code_switching_detected IS 'Source-language token detected in predicted translation.';
COMMENT ON COLUMN run_card_entries.hallucination_detected IS 'Fabricated content detected in predicted translation.';

-- =========================================================================
-- Indexes for failure analysis queries
-- =========================================================================

-- "Show me all entries where the FST rejected the translation"
CREATE INDEX IF NOT EXISTS idx_rce_fst_valid
  ON run_card_entries(fst_valid)
  WHERE fst_valid IS NOT NULL;

-- "Show me all semantic mismatches"
CREATE INDEX IF NOT EXISTS idx_rce_semantic
  ON run_card_entries(semantic_verdict)
  WHERE semantic_verdict IS NOT NULL;

-- "Show me all code-switching failures"
CREATE INDEX IF NOT EXISTS idx_rce_code_switching
  ON run_card_entries(code_switching_detected)
  WHERE code_switching_detected = TRUE;

-- "Show me all hallucination failures"
CREATE INDEX IF NOT EXISTS idx_rce_hallucination
  ON run_card_entries(hallucination_detected)
  WHERE hallucination_detected = TRUE;
