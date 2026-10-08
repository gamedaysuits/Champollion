-- =============================================================================
-- Migration 012: Create Trading Card Tables
-- =============================================================================
-- Two-table design for the language trading card system:
--   1. trading_card_index  — compact rows for the card grid (loaded on page init)
--   2. trading_card_detail — full JSONB detail loaded on-demand per card modal
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Table 1: trading_card_index
-- ---------------------------------------------------------------------------
-- One row per language (~8,000 rows). Contains all the fields needed to
-- render the card grid without touching the heavyweight detail blob.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trading_card_index (
    -- Identity
    code                TEXT PRIMARY KEY,               -- ISO 639-3 code
    name                TEXT NOT NULL,                   -- English name
    native_name         TEXT,                            -- Endonym
    glottocode          TEXT,                            -- Glottolog code

    -- Classification
    family              TEXT,                            -- Language family (e.g. 'Indo-European')
    genus               TEXT,                            -- Genus within family
    macroarea           TEXT,                            -- Geographic macroarea
    is_isolate          BOOLEAN DEFAULT FALSE,           -- Language isolate flag

    -- Speaker data
    speakers            TEXT,                            -- Pre-formatted display string (e.g. '1.2M', '< 100')
    speaker_count       BIGINT DEFAULT 0,                -- Numeric value for sorting

    -- Script / writing system
    script              TEXT,                            -- Primary script name (shorthand)
    script_name         TEXT,                            -- Full script display name
    scripts             JSONB,                           -- Array of {name, source}
    dir                 TEXT DEFAULT 'ltr',              -- Text direction ('ltr' | 'rtl' | 'ttb')

    -- Card game mechanics
    vitality_badge      JSONB NOT NULL,                  -- {level, label, source, emoji}
    rarity              JSONB NOT NULL,                  -- {tier, emoji, label, color}
    rarity_order        INTEGER DEFAULT 0,               -- Numeric tier for sorting
    challenge_rating    JSONB NOT NULL,                  -- {score, tooltip, sources, ...components}
    digital_toolkit     JSONB NOT NULL,                  -- {count, pips: [bool x5], items: [...]}
    abilities           JSONB DEFAULT '[]'::jsonb,       -- Array of {id, name, description}
    stats               JSONB,                           -- Pre-computed stat block (mirrors challenge_rating)

    -- Pipeline readiness
    pipeline_label      TEXT,                            -- Pipeline readiness label
    pipeline_emoji      TEXT,                            -- Pipeline readiness emoji

    -- Content availability flags
    fact_count          INTEGER DEFAULT 0,               -- Total facts for display
    source_count        INTEGER DEFAULT 0,               -- Total unique sources
    has_vocabulary      BOOLEAN DEFAULT FALSE,
    has_typology        BOOLEAN DEFAULT FALSE,
    has_phonology       BOOLEAN DEFAULT FALSE,
    has_nearest         BOOLEAN DEFAULT FALSE,
    has_natural_pair    BOOLEAN DEFAULT FALSE,
    has_cultural        BOOLEAN DEFAULT FALSE,
    has_conflicts       BOOLEAN DEFAULT FALSE,
    dialect_count       INTEGER,                         -- Number of known dialects

    -- Geography & lineage
    regions             JSONB DEFAULT '[]'::jsonb,       -- Array of region objects
    ancestry            JSONB DEFAULT '[]'::jsonb,       -- Classification ancestry path

    -- Flavour
    cultural_aphorism   TEXT,                            -- Display aphorism / proverb

    -- Housekeeping
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE trading_card_index IS
    'Compact per-language rows for the trading card grid. Loaded in bulk on page init.';


-- ---------------------------------------------------------------------------
-- Table 2: trading_card_detail
-- ---------------------------------------------------------------------------
-- One row per language. The full factual record (vocabulary, typology,
-- phonology, cultural notes, etc.) loaded on-demand when a card modal opens.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trading_card_detail (
    code            TEXT PRIMARY KEY
                    REFERENCES trading_card_index(code) ON DELETE CASCADE,
    detail          JSONB NOT NULL,                     -- Full structured detail blob
    fact_count      INTEGER,                            -- Fact count for display
    source_count    INTEGER,                            -- Unique source count
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE trading_card_detail IS
    'Full JSONB detail per language, loaded on-demand when a card modal is opened.';


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Targeted indexes for the most common filter / sort patterns on the grid.
-- GIN index on vitality_badge supports containment queries (@>).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tci_family
    ON trading_card_index (family);

CREATE INDEX IF NOT EXISTS idx_tci_vitality
    ON trading_card_index USING GIN (vitality_badge);

CREATE INDEX IF NOT EXISTS idx_tci_rarity_order
    ON trading_card_index (rarity_order DESC);

CREATE INDEX IF NOT EXISTS idx_tci_speaker_count
    ON trading_card_index (speaker_count DESC);

CREATE INDEX IF NOT EXISTS idx_tci_macroarea
    ON trading_card_index (macroarea);

CREATE INDEX IF NOT EXISTS idx_tci_fact_count
    ON trading_card_index (fact_count DESC);


-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- Both tables are public-read, service-role-write. Anonymous users can SELECT
-- but cannot INSERT, UPDATE, or DELETE. Only the service_role key (used by
-- the data pipeline) bypasses RLS to perform writes.
-- ---------------------------------------------------------------------------

-- trading_card_index
ALTER TABLE trading_card_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on trading_card_index"
    ON trading_card_index
    FOR SELECT
    TO anon
    USING (true);

-- trading_card_detail
ALTER TABLE trading_card_detail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on trading_card_detail"
    ON trading_card_detail
    FOR SELECT
    TO anon
    USING (true);


-- ---------------------------------------------------------------------------
-- RPC Function: get_trading_card_index()
-- ---------------------------------------------------------------------------
-- Returns only the grid-display columns, deliberately excluding heavyweight
-- JSONB blobs that aren't needed until a card modal is opened. This keeps
-- the initial page-load payload lean.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_trading_card_index()
RETURNS TABLE (
    code                TEXT,
    name                TEXT,
    native_name         TEXT,
    family              TEXT,
    genus               TEXT,
    macroarea           TEXT,
    is_isolate          BOOLEAN,
    speakers            TEXT,
    speaker_count       BIGINT,
    script              TEXT,
    dir                 TEXT,
    vitality_badge      JSONB,
    rarity              JSONB,
    rarity_order        INTEGER,
    challenge_rating    JSONB,
    digital_toolkit     JSONB,
    abilities           JSONB,
    pipeline_label      TEXT,
    pipeline_emoji      TEXT,
    fact_count          INTEGER,
    source_count        INTEGER,
    has_vocabulary      BOOLEAN,
    has_typology        BOOLEAN,
    has_phonology       BOOLEAN,
    has_nearest         BOOLEAN,
    has_natural_pair    BOOLEAN,
    has_cultural        BOOLEAN,
    has_conflicts       BOOLEAN,
    dialect_count       INTEGER,
    script_name         TEXT,
    regions             JSONB,
    ancestry            JSONB,
    glottocode          TEXT,
    cultural_aphorism   TEXT
)
LANGUAGE sql
STABLE                     -- read-only, safe for caching
SECURITY INVOKER           -- respects RLS of the calling role
AS $$
    SELECT
        t.code,
        t.name,
        t.native_name,
        t.family,
        t.genus,
        t.macroarea,
        t.is_isolate,
        t.speakers,
        t.speaker_count,
        t.script,
        t.dir,
        t.vitality_badge,
        t.rarity,
        t.rarity_order,
        t.challenge_rating,
        t.digital_toolkit,
        t.abilities,
        t.pipeline_label,
        t.pipeline_emoji,
        t.fact_count,
        t.source_count,
        t.has_vocabulary,
        t.has_typology,
        t.has_phonology,
        t.has_nearest,
        t.has_natural_pair,
        t.has_cultural,
        t.has_conflicts,
        t.dialect_count,
        t.script_name,
        t.regions,
        t.ancestry,
        t.glottocode,
        t.cultural_aphorism
    FROM trading_card_index t;
$$;

COMMENT ON FUNCTION get_trading_card_index() IS
    'Returns grid-display columns from trading_card_index, omitting stats and updated_at to keep the payload lean.';
