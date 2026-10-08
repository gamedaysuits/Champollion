-- =============================================================================
-- Migration 013: Create Source Licenses Table
-- =============================================================================
-- Registry of dataset licenses and attribution requirements for every data
-- source ingested into the Champollion knowledge base. Used to power the
-- attribution / licensing panel on the trading card detail modal.
--
-- The source_licenses.source column matches the `source` field in the SQLite
-- facts table and the `provenance.sources[].name` key in the trading card
-- detail JSONB.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Table: source_licenses
-- ---------------------------------------------------------------------------
-- One row per data source (e.g. 'glottolog-5.0', 'wals', 'phoible').
-- Tracks the license terms, attribution requirements, and redistribution
-- flags needed for legal compliance and user-facing credit.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_licenses (
    -- Identity
    source                  TEXT PRIMARY KEY,               -- Matches facts.source / provenance key
    license_spdx            TEXT,                           -- SPDX identifier (e.g. 'CC-BY-4.0')
    license_url             TEXT,                           -- URL to the full license text
    attribution             TEXT,                           -- Required attribution string

    -- Rights flags
    allows_redistribution   BOOLEAN DEFAULT TRUE,           -- Can we redistribute derived data?
    requires_attribution    BOOLEAN DEFAULT TRUE,           -- Must we credit the source?
    requires_sharealike     BOOLEAN DEFAULT FALSE,          -- Must derivatives use same license?
    non_commercial_only     BOOLEAN DEFAULT FALSE,          -- Restricted to non-commercial use?

    -- Provenance
    dataset_url             TEXT,                           -- URL to the upstream dataset
    dataset_version         TEXT,                           -- Version string (e.g. '5.0', '2024.1')
    notes                   TEXT,                           -- Free-text notes on license nuances

    -- Housekeeping
    registered_at           TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE source_licenses IS
    'Registry of dataset licenses and attribution requirements for every ingested data source.';


-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- Public-read, service-role-write. Anonymous users can SELECT but cannot
-- INSERT, UPDATE, or DELETE. Only the service_role key (used by the data
-- pipeline) bypasses RLS to perform writes.
-- ---------------------------------------------------------------------------
ALTER TABLE source_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on source_licenses"
    ON source_licenses
    FOR SELECT
    TO anon
    USING (true);


-- ---------------------------------------------------------------------------
-- RPC Function: get_source_licenses()
-- ---------------------------------------------------------------------------
-- Returns all license records. Used by the admin dashboard and the
-- attribution panel to display a complete list of data sources and their
-- licensing terms.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_source_licenses()
RETURNS TABLE (
    source                  TEXT,
    license_spdx            TEXT,
    license_url             TEXT,
    attribution             TEXT,
    allows_redistribution   BOOLEAN,
    requires_attribution    BOOLEAN,
    requires_sharealike     BOOLEAN,
    non_commercial_only     BOOLEAN,
    dataset_url             TEXT,
    dataset_version         TEXT,
    notes                   TEXT,
    registered_at           TIMESTAMPTZ
)
LANGUAGE sql
STABLE                     -- read-only, safe for caching
SECURITY INVOKER           -- respects RLS of the calling role
AS $$
    SELECT
        sl.source,
        sl.license_spdx,
        sl.license_url,
        sl.attribution,
        sl.allows_redistribution,
        sl.requires_attribution,
        sl.requires_sharealike,
        sl.non_commercial_only,
        sl.dataset_url,
        sl.dataset_version,
        sl.notes,
        sl.registered_at
    FROM source_licenses sl
    ORDER BY sl.source;
$$;

COMMENT ON FUNCTION get_source_licenses() IS
    'Returns all source license records, ordered alphabetically by source name.';


-- ---------------------------------------------------------------------------
-- RPC Function: get_attribution_for_language(lang_code TEXT)
-- ---------------------------------------------------------------------------
-- Extracts the distinct source names from a language's trading_card_detail
-- provenance JSONB, then joins to source_licenses to return full license
-- metadata for every source that contributed data to that language's card.
--
-- The trading_card_detail.detail JSONB stores provenance at:
--   detail -> 'provenance' -> 'sources' (array of {name, factCount, url})
--
-- Returns one row per source that has a matching license record.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_attribution_for_language(lang_code TEXT)
RETURNS TABLE (
    source                  TEXT,
    license_spdx            TEXT,
    license_url             TEXT,
    attribution             TEXT,
    allows_redistribution   BOOLEAN,
    requires_attribution    BOOLEAN,
    requires_sharealike     BOOLEAN,
    non_commercial_only     BOOLEAN,
    dataset_url             TEXT,
    dataset_version         TEXT,
    notes                   TEXT,
    fact_count              INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    -- Unnest the provenance.sources array from the detail JSONB,
    -- then left-join to source_licenses for full license metadata.
    -- fact_count comes from the provenance entry so the caller knows
    -- how much data each source contributed for this language.
    SELECT
        sl.source,
        sl.license_spdx,
        sl.license_url,
        sl.attribution,
        sl.allows_redistribution,
        sl.requires_attribution,
        sl.requires_sharealike,
        sl.non_commercial_only,
        sl.dataset_url,
        sl.dataset_version,
        sl.notes,
        (ps.value ->> 'factCount')::INTEGER AS fact_count
    FROM trading_card_detail tcd
    CROSS JOIN LATERAL jsonb_array_elements(tcd.detail -> 'provenance' -> 'sources') AS ps(value)
    INNER JOIN source_licenses sl
        ON sl.source = (ps.value ->> 'name')
    WHERE tcd.code = lang_code
    ORDER BY (ps.value ->> 'factCount')::INTEGER DESC NULLS LAST;
$$;

COMMENT ON FUNCTION get_attribution_for_language(TEXT) IS
    'Returns license metadata for every data source that contributed facts to a given language card, ordered by fact count descending.';
