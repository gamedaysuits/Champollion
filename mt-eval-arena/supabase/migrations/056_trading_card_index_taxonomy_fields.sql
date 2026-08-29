-- =============================================================================
-- Migration 056: trading_card_index taxonomy badging columns
-- =============================================================================
-- WHAT
--   Adds the four language-taxonomy fields to the compact index row, and to
--   the get_trading_card_index() RPC:
--
--     iso_type      TEXT — ISO 639-3 Language_Type: L/E/A/H/C/S
--     modality      TEXT — 'spoken' | 'signed'
--     iso_scope     TEXT — 'I' individual | 'M' macrolanguage hub | 'S' special
--     macrolanguage TEXT — containing macrolanguage code for member cards
--
-- WHY
--   The staged build output (build-trading-card-data.mjs) has carried these
--   fields per index entry since the taxonomy lane landed, and every consumer
--   was already written for them — but the table had no such columns, so the
--   upload mapping (upload-trading-cards.mjs) silently dropped them:
--
--   - cli/website/scripts/build-data-from-supabase.mjs --index-only (the
--     website's `ensure-tc-index` prestart/prebuild step) reconstructs
--     data/tc-index.json from THIS TABLE ALONE, and the homepage graph
--     generator (plugins/shared-data/generateGraphJson.js) derives its
--     living/at-risk hero stats from that file (living = isoType 'L';
--     at-risk = living AND vitality level shifting/endangered/critical/
--     dormant). A round-tripped index without iso_type silently baked
--     atRisk = 0 (true value ~4,100) and monolith coveredLiving = 0 into
--     any git-connected/fresh-clone build.
--   - The Atlas grid's runtime loader (src/utils/languageLoader.js,
--     transformIndexRow) already maps iso_type / modality / iso_scope /
--     macrolanguage nullish-safely, and the taxonomy chips (src/utils/
--     taxonomy.js) degrade to absent on a stale index — these columns light
--     them on the primary RPC path.
--
--   SSOT: cli/shared/language-cards/*.json (the fields are stamped onto the
--   cards by cli/scripts/derive-taxonomy-fields.mjs), projected into staging
--   by mt-eval-arena/scripts/build-trading-card-data.mjs and uploaded by
--   upload-trading-cards.mjs — which now PREFLIGHTS iso_type and refuses to
--   upsert until this migration is applied, so the fields can never be
--   silently dropped again.
--
--   Additive + idempotent: existing rows backfill on the next full upload.
--
--   The RPC's RETURNS TABLE gains the four columns, so it must be DROPped
--   and recreated (CREATE OR REPLACE cannot change a function's return
--   type). Recreation resets function attributes: search_path is re-pinned
--   below (the 020/025 hardening), and Supabase's default privileges
--   re-grant EXECUTE to anon/authenticated at creation — which is the
--   intent for this public-read grid RPC (unlike the 048 trigger-lane
--   functions). Apply the file as one run so the drop/recreate is atomic.
--
-- ROLLBACK
--   ALTER TABLE trading_card_index DROP COLUMN IF EXISTS iso_type,
--     DROP COLUMN IF EXISTS modality, DROP COLUMN IF EXISTS iso_scope,
--     DROP COLUMN IF EXISTS macrolanguage;
--   then recreate get_trading_card_index() from migration 012 and re-pin
--   search_path. Clients degrade gracefully either way — the runtime
--   transform and the website reconstruction are nullish-safe.
-- =============================================================================

ALTER TABLE trading_card_index
    ADD COLUMN IF NOT EXISTS iso_type      TEXT,
    ADD COLUMN IF NOT EXISTS modality      TEXT,
    ADD COLUMN IF NOT EXISTS iso_scope     TEXT,
    ADD COLUMN IF NOT EXISTS macrolanguage TEXT;

COMMENT ON COLUMN trading_card_index.iso_type IS
    'ISO 639-3 Language_Type from the language card: L living, E extinct, A ancient, '
    'H historical, C constructed, S special. Drives the homepage living/at-risk stats '
    '(living = ''L'') and the spelled-out type chip on the Atlas grid.';
COMMENT ON COLUMN trading_card_index.modality IS
    'Language modality from the language card: spoken | signed. Signed cards get the '
    '"Signed language" badge with the not-yet-served framing.';
COMMENT ON COLUMN trading_card_index.iso_scope IS
    'ISO 639-3 scope from the language card: I individual, M macrolanguage (hub cards '
    'render as "language group", never benchmark targets), S special.';
COMMENT ON COLUMN trading_card_index.macrolanguage IS
    'Containing macrolanguage code (e.g. crk -> cre) from the language card, or NULL. '
    'Member cards link up to their macrolanguage hub with it.';


-- ---------------------------------------------------------------------------
-- RPC: get_trading_card_index() — migration 012's shape + the four taxonomy
-- columns appended at the end. Still omits heavyweight blobs (stats,
-- updated_at) to keep the initial grid payload lean.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_trading_card_index();

CREATE FUNCTION get_trading_card_index()
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
    cultural_aphorism   TEXT,
    iso_type            TEXT,
    modality            TEXT,
    iso_scope           TEXT,
    macrolanguage       TEXT
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
        t.cultural_aphorism,
        t.iso_type,
        t.modality,
        t.iso_scope,
        t.macrolanguage
    FROM trading_card_index t;
$$;

-- Recreation resets attributes — re-pin search_path (020/025 hardening).
ALTER FUNCTION public.get_trading_card_index() SET search_path = public;

COMMENT ON FUNCTION get_trading_card_index() IS
    'Returns grid-display columns from trading_card_index (incl. the 056 taxonomy '
    'columns), omitting stats and updated_at to keep the payload lean.';
