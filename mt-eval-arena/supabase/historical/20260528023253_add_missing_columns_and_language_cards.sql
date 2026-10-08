-- ==========================================================================
-- Migration: 20260528023253 — Add missing run_cards columns
--
-- Adds columns to run_cards that publish.py sends but the original
-- table lacked: equivalent_match_rate, semantic_score, composite_score,
-- quality_tier, cost_per_entry_usd, avg_latency_seconds.
--
-- NOTE: This migration originally also created a language_cards table.
-- That table was dropped in migration 20260528024953 because language
-- cards are file-based (lib/data/language-cards/*.json), loaded at
-- build time, and should not be in Supabase. The CREATE TABLE has
-- been removed from this file to keep history clean.
-- ==========================================================================

ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS equivalent_match_rate REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS semantic_score REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS composite_score REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS quality_tier TEXT;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS cost_per_entry_usd REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS avg_latency_seconds REAL;

CREATE INDEX IF NOT EXISTS idx_run_cards_composite
    ON run_cards (composite_score DESC NULLS LAST);
