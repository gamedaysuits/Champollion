-- Migration 003: Add quality-affecting run parameters to run_cards
--
-- Context: batch_size, temperature, and max_tokens materially affect
-- translation quality but were previously buried in the run_card JSON blob.
-- Adding them as top-level columns enables leaderboard filtering, sorting,
-- and comparability checks (e.g. "show only batch_size=1 runs").
--
-- These fields were also added to the fingerprint hash (publish.py) so
-- that runs with different batch_size/tools_enabled get distinct identities.
--
-- Columns added:
--   batch_size    — Number of sentences per API call (1 = single, >1 = batched)
--   temperature   — Effective sampling temperature used (0.0 = deterministic)
--   max_tokens    — Max tokens per API response (may truncate output)

-- Quality-affecting parameter columns
ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS temperature REAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_tokens INTEGER;

-- Column comments for documentation
COMMENT ON COLUMN run_cards.batch_size IS 'Number of sentences sent per API call. batch_size=1 means one sentence per call (gold standard). batch_size>1 sends a numbered list, which can affect quality.';
COMMENT ON COLUMN run_cards.temperature IS 'Effective sampling temperature. 0.0 = deterministic. Higher values increase randomness.';
COMMENT ON COLUMN run_cards.max_tokens IS 'Maximum tokens allowed per API response. May cause output truncation if too low.';

-- Backfill existing rows from the run_card JSON blob.
-- This updates rows that were published before this migration.
UPDATE run_cards
  SET batch_size = (run_card->>'batch_size')::integer
  WHERE run_card->>'batch_size' IS NOT NULL
    AND batch_size IS NULL;

UPDATE run_cards
  SET temperature = (run_card->>'temperature')::real
  WHERE run_card->>'temperature' IS NOT NULL
    AND temperature IS NULL;
