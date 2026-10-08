-- ==========================================================================
-- Migration: 20260528024953 — Drop language_cards, add run_cards columns,
--                              create datasets table
--
-- 1. Drops language_cards (should never have been in Supabase — language
--    cards are file-based, loaded at build time by webpack require.context)
-- 2. Adds SCORING_SPEC §9.1 columns to run_cards
-- 3. Creates datasets table (metadata-only registry of evaluation corpora,
--    replaces hardcoded DATASETS const in leaderboard.js)
-- 4. Seeds the one existing dataset
-- ==========================================================================

-- 1. Drop language_cards
DROP TABLE IF EXISTS language_cards;

-- 2. Add missing run_cards columns (SCORING_SPEC §9.1)
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS cost_per_1k_tokens REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS median_latency_seconds REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS p95_latency_seconds REAL;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS method_class TEXT;

CREATE INDEX IF NOT EXISTS idx_run_cards_method_class
    ON run_cards (method_class) WHERE method_class IS NOT NULL;

-- 3. Create datasets table (metadata only — no corpus content)
CREATE TABLE datasets (
    id              TEXT PRIMARY KEY,     -- e.g., 'edtekla-dev-v1'
    version         TEXT NOT NULL,        -- semver
    name            TEXT NOT NULL,        -- human display name
    language_pair   TEXT NOT NULL,        -- e.g., 'en>crk'
    source_language TEXT NOT NULL,
    target_language TEXT NOT NULL,
    domain          TEXT,                 -- 'educational', 'conversational', etc.
    license         TEXT,                 -- SPDX identifier
    entry_count     INT,
    segment         TEXT NOT NULL DEFAULT 'development'
                    CHECK (segment IN ('development', 'diagnostic', 'gold_standard', 'held_out')),
    source          TEXT,                 -- attribution
    notes           TEXT,
    sha256          TEXT,                 -- content hash for integrity
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "datasets_public_read" ON datasets FOR SELECT USING (TRUE);
CREATE POLICY "datasets_auth_write" ON datasets
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_datasets_language_pair
    ON datasets (language_pair);

-- 4. Seed the existing dataset
INSERT INTO datasets (id, version, name, language_pair, source_language, target_language,
                      domain, license, entry_count, segment, source, notes)
VALUES (
    'edtekla-dev-v1',
    '1.0.0',
    'EDTeKLA Development Set v1',
    'en>crk', 'en', 'crk',
    'educational',
    'CC-BY-NC-SA-4.0',
    436,  -- WHY: Full EDTeKLA dev corpus (486 total - 50 held-out = 436 dev). Old value 124 was a stale early-dev subset.
    'development',
    'EDTeKLA project, University of Alberta',
    '436-entry textbook dev corpus (from 486 total: 436 dev + 50 held-out). DO NOT TRAIN.'
) ON CONFLICT (id) DO NOTHING;
