-- Migration 005: Create run_card_entries table for per-entry leaderboard data.
--
-- WHY: The run_cards table stores aggregate scores only. Per-entry data
-- (individual translations, per-entry chrF++, FST validity, etc.) was
-- previously lost after local report generation. This table enables:
--   1. Drill-down inspection of individual translations on the leaderboard
--   2. Cross-run entry comparison ("How did entry X score across all models?")
--   3. Failure analysis (filter entries by low chrF, FST failures, etc.)
--
-- DESIGN: Separate table (not embedded in run_card JSONB) because:
--   - Keeps run_cards lean (~5KB/row) for fast leaderboard queries
--   - Entries are indexable and queryable individually
--   - Cascade delete ensures cleanup when a run_card is removed
--   - plugin_metrics stays as JSONB since it varies by plugin set

CREATE TABLE IF NOT EXISTS run_card_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Foreign key to the parent run card
  run_card_id TEXT NOT NULL REFERENCES run_cards(id) ON DELETE CASCADE,

  -- Entry identification (from the corpus)
  entry_id TEXT NOT NULL,           -- e.g. "tatoeba_953265" or "0"
  source TEXT NOT NULL,             -- Source text (English, etc.)
  expected TEXT NOT NULL,           -- Gold-standard reference translation

  -- Translation output
  raw_predicted TEXT,               -- Raw model output before post-processing
  predicted TEXT,                   -- Final post-processed translation

  -- Corpus metadata (from the entry)
  segment TEXT DEFAULT '',          -- e.g. "gold_standard", "phase1_test"
  difficulty SMALLINT,              -- 1-5 difficulty rating
  domain TEXT DEFAULT '',           -- e.g. "legal", "health", "conversational"

  -- Per-entry scores
  exact_match BOOLEAN NOT NULL,
  chrf_score REAL,                  -- chrF++ score for this entry
  bleu_score REAL,                  -- BLEU score for this entry

  -- Performance metrics
  latency_s REAL,                   -- Time to translate this entry
  cost_usd REAL,                    -- API cost for this entry

  -- Tool usage
  tool_call_count SMALLINT DEFAULT 0,

  -- Error tracking
  error TEXT,                       -- Error message if translation failed

  -- Plugin metrics (variable structure — depends on which plugins ran)
  -- Contains per-entry results from FST, code-switching, hallucination, etc.
  plugin_metrics JSONB DEFAULT '{}',

  -- Ensure one entry per run per corpus entry
  UNIQUE(run_card_id, entry_id)
);

-- Index for the most common query: "show all entries for this run"
CREATE INDEX IF NOT EXISTS idx_rce_run_card ON run_card_entries(run_card_id);

-- Index for cross-run comparison: "how did this entry score across runs?"
CREATE INDEX IF NOT EXISTS idx_rce_entry_id ON run_card_entries(entry_id);

-- RLS: public read (anyone can inspect translations on the leaderboard)
ALTER TABLE run_card_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON run_card_entries
  FOR SELECT USING (true);

-- RLS: authenticated insert (must be logged in to publish results)
CREATE POLICY "Authenticated insert" ON run_card_entries
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS: authenticated update (for idempotent re-publishes)
CREATE POLICY "Authenticated update" ON run_card_entries
  FOR UPDATE USING (auth.uid() IS NOT NULL);
