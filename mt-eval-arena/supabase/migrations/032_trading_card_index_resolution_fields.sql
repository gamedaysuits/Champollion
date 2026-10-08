-- =============================================================================
-- Migration 032: trading_card_index resolution-identity fields
-- =============================================================================
-- The pure-dynamic card loaders (the `pip install mt-eval-harness` harness and
-- the `npm install champollion` CLI) reconstruct language cards from Supabase
-- and FAIL LOUD when it is unreachable — they ship no bundled card copy. To
-- resolve a code/alias/name to a card WITHOUT fetching every heavyweight
-- trading_card_detail blob, the harness fetches the compact index once and
-- builds its code→/alias→/name→ lookup tables from it. That requires the
-- resolution identity to live on the index row.
--
--   aliases   — alternate codes (ISO 639-1, legacy, regional) so e.g.
--               resolve_code('fr') → 'fra' matches the CLI's semantics.
--   iso639_1  — the 2-letter code; SSOT field an MT adapter reads to call a
--               provider that speaks 639-1 (DeepL/Google), fail-honest (no
--               call) when null (e.g. crk has no 639-1 code).
--
-- SSOT: cli/shared/language-cards/*.json (extends-merged), projected by
-- mt-eval-arena/scripts/build-trading-card-data.mjs and uploaded by
-- upload-trading-cards.mjs. Additive + idempotent: existing rows backfill on
-- the next upload. The get_trading_card_index() RPC (migration 012) is
-- unchanged — the website grid does not need these; the harness queries the
-- table directly with an explicit select list.
-- =============================================================================

ALTER TABLE trading_card_index
    ADD COLUMN IF NOT EXISTS aliases  JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS iso639_1 TEXT;

COMMENT ON COLUMN trading_card_index.aliases IS
    'Alternate codes (ISO 639-1, legacy, regional) from the language card. '
    'Used by the pure-dynamic harness/CLI loaders to build alias→code resolution.';
COMMENT ON COLUMN trading_card_index.iso639_1 IS
    'ISO 639-1 two-letter code from the language card, or NULL when none exists. '
    'MT adapters read this to call 639-1 providers; NULL means fail-honest (no call).';
