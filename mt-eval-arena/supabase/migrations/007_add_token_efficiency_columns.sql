-- Migration 007: Add token efficiency columns to run_cards.
--
-- WHY: SCORING_SPEC §6.1 and §6.2 define tokens_per_entry and
-- cost_per_1k_tokens as standard cost metrics. publish.py now computes
-- them, but the DB lacked the columns to store them.
--
-- tokens_per_entry:  avg tokens consumed per corpus entry (prompt + completion)
-- cost_per_1k_tokens: cost normalized by token volume (comparable across providers)

ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS tokens_per_entry REAL,
  ADD COLUMN IF NOT EXISTS cost_per_1k_tokens REAL;
