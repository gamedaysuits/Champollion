-- =============================================================================
-- Migration 034: Human Translation Services — v0 "discovery" registry
-- =============================================================================
-- The async "human method" floor for low-resource pairs where no machine
-- translation is reliable (docs/HUMAN_SERVICES_HUB.md). v0 is read-only
-- DISCOVERY: a public, opt-in registry of human translation providers
-- (community language offices, LRL agencies, individual certified translators)
-- keyed by language pair, surfaced per-pair on the site beside the Arena's
-- per-pair confidence display. Dispatch (v1), tickets (v2), and payments (v3)
-- are NOT in this migration.
--
-- Modeled on migration 018 (language_experts: public-read, service-role-write,
-- a get_*_for_* RPC) and the migration 024 write-surface lockdown (the public
-- API gets NO write path; curator/admin writes go through service_role only).
--
-- SOVEREIGNTY (community consent; see the internal governance doc): a provider is listed only with its
-- explicit consent. The public read path is gated on BOTH consent_attested AND
-- an admin status='approved' — at the RLS layer AND again inside the RPC
-- (defense in depth). No community/org is ever named as a custodian without
-- confirmation; seed/registry rows use "community key custodians (in
-- confirmation)" framing until consent lands.
--
-- PII: the provider `contact` (an email/endpoint that may be a personal
-- address) is the only PII column. It is REQUIRED for dispatch (v1) but is
-- never returned by the public RPC, and is never carried in the in-git SSOT
-- (shared/human-services.json) — it is supplied to the uploader out-of-band.
--
-- NUMBERING: 033 is reserved for the corpus-content-exposure-gate trigger;
-- this registry is 034 to avoid the collision. Supabase applies migrations by
-- filename order, so the gap is harmless if 033 lands later.
--
-- DO NOT APPLY TO PROD without founder review + sovereignty sign-off on the registry
-- model (docs/HUMAN_SERVICES_HUB.md §"Decisions needed before building").
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Table: translation_services
-- ---------------------------------------------------------------------------
-- One row per offered (service, pair, variety). source_lang/target_lang are
-- ISO 639-3 (e.g. eng>crk Plains Cree SRO — never conflated with crm Moose
-- Cree); `variety` carries the script/dialect qualifier when it matters.
--
-- v0 modeling note: `service_id` is globally UNIQUE (one offering row per
-- service id in the discovery slice). The composite UNIQUE on
-- (service_id, source_lang, target_lang, variety) is the natural key for the
-- multi-pair future (a service offering several pairs); it is retained as the
-- forward-compatible upsert key and is subsumed by the global unique today.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.translation_services (
    -- Identity
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_id        TEXT UNIQUE NOT NULL,           -- Stable public id (kebab-case), curator-assigned

    -- Who
    display_name      TEXT NOT NULL,                  -- Provider's consented public name
    provider_type     TEXT                            -- Kind of provider
                      CHECK (provider_type IN ('community_org', 'agency', 'individual')),

    -- What pair (ISO 639-3 + optional variety)
    source_lang       TEXT NOT NULL,                  -- ISO 639-3 source
    target_lang       TEXT NOT NULL,                  -- ISO 639-3 target
    variety           TEXT,                           -- Script/dialect qualifier (e.g. 'SRO', 'Latn')

    -- How a request reaches them (the async dispatch channel; v1)
    dispatch_channel  TEXT                            -- How a request is delivered
                      CHECK (dispatch_channel IN ('email', 'webhook', 'api')),
    contact           TEXT NOT NULL,                  -- PII: address/endpoint — NEVER returned by the public RPC

    -- Terms
    turnaround_days   INT,                            -- Typical turnaround, in days
    rate_per_word     NUMERIC,                        -- Rate per source word (provider currency, off-platform)
    domains           TEXT[],                         -- Subject domains served (e.g. {legal, health, education})

    -- Sovereignty + licensing (community-set terms; cf. EdTeKLA/NC carve-outs)
    sovereignty_flags JSONB,                          -- Data-handling constraints, off-community processing, attribution
    nc_terms          TEXT,                           -- Non-commercial / community-set usage terms, if any

    -- Governance gates (the public read path requires BOTH)
    consent_attested  BOOLEAN NOT NULL DEFAULT false, -- Provider has explicitly consented to be listed
    status            TEXT NOT NULL DEFAULT 'pending' -- Admin moderation state (v0 intake is out-of-band)
                      CHECK (status IN ('pending', 'approved', 'suspended')),

    -- Housekeeping
    created_at        TIMESTAMPTZ DEFAULT NOW(),

    -- Forward-compatible natural key (multi-pair services); see modeling note
    UNIQUE (service_id, source_lang, target_lang, variety)
);

COMMENT ON TABLE public.translation_services IS
    'v0 discovery registry of opt-in human translation providers, keyed by language pair — the "human method" floor for pairs with no reliable MT (docs/HUMAN_SERVICES_HUB.md). Public read is gated on consent_attested AND status=approved; writes are service-role-only.';

COMMENT ON COLUMN public.translation_services.contact IS
    'PII: provider dispatch address/endpoint (v1). NEVER returned by get_services_for_pair and NEVER carried in the in-git SSOT (shared/human-services.json); supplied to the uploader out-of-band.';

COMMENT ON COLUMN public.translation_services.consent_attested IS
    'Consent gate: the provider has explicitly consented to be listed publicly. Public read requires this true (RLS + RPC).';

COMMENT ON COLUMN public.translation_services.status IS
    'Admin moderation state. v0 intake is admin-approval out-of-band (no anon self-INSERT). Public read requires status=approved.';


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Per-pair lookup (the website affordance + the RPC) filters by pair;
-- moderation queues filter by status.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_translation_services_pair
    ON public.translation_services (source_lang, target_lang);

CREATE INDEX IF NOT EXISTS idx_translation_services_status
    ON public.translation_services (status);


-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- Public read is gated to consented + approved rows ONLY. There is NO anon
-- (or authenticated) write policy — writes go through service_role, which
-- bypasses RLS (the migration 024 lockdown precedent: the public API never
-- gets a write surface for a curator-owned table). v0 intake is admin-approval
-- out-of-band; anon self-INSERT is deliberately NOT built.
-- ---------------------------------------------------------------------------
ALTER TABLE public.translation_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS translation_services_anon_read_consented ON public.translation_services;
CREATE POLICY translation_services_anon_read_consented
    ON public.translation_services
    FOR SELECT
    TO anon
    USING (status = 'approved' AND consent_attested = true);


-- ---------------------------------------------------------------------------
-- RPC Function: get_services_for_pair(src TEXT, tgt TEXT)
-- ---------------------------------------------------------------------------
-- Returns the PUBLIC (non-PII) columns of every approved + consented service
-- covering a pair. SECURITY INVOKER so the anon RLS policy above still applies;
-- the WHERE clause re-asserts the consent + approval gate (defense in depth).
-- `contact` (PII) is intentionally NOT in the return set — dispatch happens via
-- the CLI's signed channel in v1, not the public web read path.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_services_for_pair(src TEXT, tgt TEXT)
RETURNS TABLE (
    service_id        TEXT,
    display_name      TEXT,
    provider_type     TEXT,
    source_lang       TEXT,
    target_lang       TEXT,
    variety           TEXT,
    dispatch_channel  TEXT,
    turnaround_days   INT,
    rate_per_word     NUMERIC,
    domains           TEXT[],
    sovereignty_flags JSONB,
    nc_terms          TEXT,
    status            TEXT
)
LANGUAGE sql
STABLE                     -- read-only, safe for caching
SECURITY INVOKER           -- respects the anon RLS policy of the caller
AS $$
    SELECT
        ts.service_id,
        ts.display_name,
        ts.provider_type,
        ts.source_lang,
        ts.target_lang,
        ts.variety,
        ts.dispatch_channel,
        ts.turnaround_days,
        ts.rate_per_word,
        ts.domains,
        ts.sovereignty_flags,
        ts.nc_terms,
        ts.status
    FROM public.translation_services ts
    WHERE ts.source_lang = src
      AND ts.target_lang = tgt
      AND ts.status = 'approved'
      AND ts.consent_attested = true
    ORDER BY
        -- Community providers first (the sovereignty-aligned default), then by speed
        CASE ts.provider_type
            WHEN 'community_org' THEN 1
            WHEN 'individual'    THEN 2
            WHEN 'agency'        THEN 3
            ELSE 4
        END,
        ts.turnaround_days NULLS LAST,
        ts.display_name;
$$;

COMMENT ON FUNCTION public.get_services_for_pair(TEXT, TEXT) IS
    'Public, non-PII per-pair lookup of approved + consented human translation services. SECURITY INVOKER (anon RLS applies); the WHERE clause re-asserts the consent + approval gate. Never returns the contact (PII) column.';

-- Expose the RPC to the public web roles (PostgREST). Reads still pass through
-- the anon RLS policy above; this only makes the function callable.
GRANT EXECUTE ON FUNCTION public.get_services_for_pair(TEXT, TEXT) TO anon, authenticated;
