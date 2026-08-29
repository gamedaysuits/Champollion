-- Migration 010: Add style_consistency_rate column to run_cards.
--
-- WHY: The writing style metric (SCORING_SPEC §2.5) computes
-- style_consistency_rate — an informational metric measuring register
-- consistency. It is NOT part of the composite score but is useful
-- for leaderboard filtering (enterprise users want methods that match
-- their brand voice).

ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS style_consistency_rate REAL;
