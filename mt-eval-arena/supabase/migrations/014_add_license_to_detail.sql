-- =============================================================================
-- Migration 014: Add Licenses Column to Trading Card Detail
-- =============================================================================
-- Adds a `licenses` JSONB column to trading_card_detail so the card detail
-- modal can render attribution / licensing information without a separate
-- RPC round-trip.
--
-- The data pipeline populates this column at build time by joining each
-- card's provenance sources against the source_licenses table. Structure:
--
--   licenses: [
--     {
--       source: "glottolog-5.0",
--       license_spdx: "CC-BY-4.0",
--       license_url: "https://...",
--       attribution: "Hammarström et al. (2024)",
--       requires_attribution: true,
--       dataset_url: "https://glottolog.org",
--       fact_count: 42
--     },
--     ...
--   ]
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Add column
-- ---------------------------------------------------------------------------
ALTER TABLE trading_card_detail
    ADD COLUMN IF NOT EXISTS licenses JSONB DEFAULT NULL;

COMMENT ON COLUMN trading_card_detail.licenses IS
    'Pre-joined license metadata for every data source that contributed to this card. Populated at build time from source_licenses.';
