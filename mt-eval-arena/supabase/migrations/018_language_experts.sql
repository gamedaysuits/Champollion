-- =============================================================================
-- Migration 018: Create Language Experts Table
-- =============================================================================
-- Queryable index of the researchers, institutions, and projects behind the
-- resources each language card cites — the WHO-to-contact layer for
-- collaboration outreach.
--
-- 100% fact-based: every row is derived from data already in the language
-- card files (a cited resource, an FST maintainer, a corpus publisher) by
-- cli/scripts/derive-experts.mjs, and carries a `source` column naming the
-- card field/resource it was derived from. Nothing is invented.
--
-- Pipeline:
--   cli/shared/language-cards/*.json (experts[], SSOT)
--     → build-trading-card-data.mjs  → data/staging/tc-experts.json
--       → upload-trading-cards.mjs   → THIS TABLE
--
-- NOTE ON NUMBERING: migrations 015–017 did not exist when this file was
-- created (014 was the highest); 018 was reserved for the experts index by
-- agreement with concurrent work streams. If 015–017 never materialize, the
-- gap is harmless — Supabase applies migrations by filename order.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Table: language_experts
-- ---------------------------------------------------------------------------
-- One row per (language, expert, role). language_code matches the `code`
-- column of trading_card_index / the language card filename. It is
-- deliberately NOT a hard foreign key: the card files include codes (regional
-- variants like 'fra-CA', genus/family cards) that may not have a row in
-- trading_card_index, and the two tables are uploaded independently.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS language_experts (
    -- Identity
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    language_code   TEXT NOT NULL,                  -- References-style to trading_card_index.code / card filename

    -- Who
    name            TEXT NOT NULL,                  -- Person, institution, or project name
    type            TEXT NOT NULL                   -- Kind of contact
                    CHECK (type IN ('researcher', 'institution', 'community_org', 'project')),
    affiliation     TEXT,                           -- Host institution, if stated in repo data
    role            TEXT NOT NULL,                  -- e.g. 'FST maintainer', 'dictionary author', 'corpus publisher'

    -- Where
    url             TEXT,                           -- Public homepage / project URL
    orcid           TEXT,                           -- ORCID iD for individual researchers

    -- Provenance (required — fact-traceability)
    source          TEXT NOT NULL,                  -- Card field/resource the entry was derived from

    -- Housekeeping
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Natural key for idempotent upserts from the pipeline
    UNIQUE (language_code, name, role)
);

COMMENT ON TABLE language_experts IS
    'Fact-based index of researchers/institutions/projects behind each language card''s cited resources. Derived by cli/scripts/derive-experts.mjs; every row cites its card-field provenance in `source`.';

COMMENT ON COLUMN language_experts.source IS
    'Which language-card field/resource this entry was derived from (e.g. ''resources.fsts[...].install.repo=giellalt/lang-crk''). Required — no row exists without repo-data provenance.';


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Card detail lookups filter by language; outreach queries filter by
-- name/type (e.g. "every language GiellaLT maintains an FST for").
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_language_experts_code
    ON language_experts (language_code);

CREATE INDEX IF NOT EXISTS idx_language_experts_name
    ON language_experts (name);

CREATE INDEX IF NOT EXISTS idx_language_experts_type
    ON language_experts (type);


-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- Public-read, service-role-write. Anonymous users can SELECT but cannot
-- INSERT, UPDATE, or DELETE. Only the service_role key (used by the data
-- pipeline) bypasses RLS to perform writes.
-- ---------------------------------------------------------------------------
ALTER TABLE language_experts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on language_experts"
    ON language_experts
    FOR SELECT
    TO anon
    USING (true);


-- ---------------------------------------------------------------------------
-- RPC Function: get_experts_for_language(lang_code TEXT)
-- ---------------------------------------------------------------------------
-- Returns all expert/institution contacts derived for one language card,
-- institutions and researchers first, then projects.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_experts_for_language(lang_code TEXT)
RETURNS TABLE (
    name            TEXT,
    type            TEXT,
    affiliation     TEXT,
    role            TEXT,
    url             TEXT,
    orcid           TEXT,
    source          TEXT
)
LANGUAGE sql
STABLE                     -- read-only, safe for caching
SECURITY INVOKER           -- respects RLS of the calling role
AS $$
    SELECT
        le.name,
        le.type,
        le.affiliation,
        le.role,
        le.url,
        le.orcid,
        le.source
    FROM language_experts le
    WHERE le.language_code = lang_code
    ORDER BY
        CASE le.type
            WHEN 'researcher'    THEN 1
            WHEN 'institution'   THEN 2
            WHEN 'community_org' THEN 3
            ELSE 4
        END,
        le.name;
$$;

COMMENT ON FUNCTION get_experts_for_language(TEXT) IS
    'Returns every expert/institution contact derived for a language card, researchers and institutions first.';


-- ---------------------------------------------------------------------------
-- RPC Function: get_languages_for_expert(expert_name TEXT)
-- ---------------------------------------------------------------------------
-- Reverse lookup for outreach planning: every language a given expert,
-- institution, or project is connected to, with the role and provenance.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_languages_for_expert(expert_name TEXT)
RETURNS TABLE (
    language_code   TEXT,
    role            TEXT,
    source          TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        le.language_code,
        le.role,
        le.source
    FROM language_experts le
    WHERE le.name = expert_name
    ORDER BY le.language_code;
$$;

COMMENT ON FUNCTION get_languages_for_expert(TEXT) IS
    'Reverse lookup: every language connected to a given expert/institution/project name, with role and card-field provenance.';
