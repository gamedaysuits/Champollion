-- Migration 066 — docent usage ledger (founder direction 2026-07-20)
--
-- The site docent (docent-chat edge function) is a grounded, cost-metered
-- guide. This table is its spend + rate-limit ledger. It records ONE row per
-- model-backed answer (FAQ short-circuit answers are free and are logged with
-- faq_hit=true and zero tokens for observability).
--
-- WHAT IT ENABLES
--   1. Per-IP request rate limit (a sliding hourly window) — same discipline as
--      anon_intake_log (050) / tickets (065).
--   2. A GLOBAL DAILY TOKEN BUDGET. When the last-24h sum of output tokens
--      crosses the function's budget, docent-chat DEGRADES to FAQ-only mode
--      (serves canned answers + points to the docs / ticket form) instead of
--      calling a model. This is fail-loud by design: the visitor is told the
--      live guide is resting, never given a silent 500 or a surprise bill.
--
-- PRIVACY: the raw client IP is NEVER stored — only a salted SHA-256 (ip_hash).
-- NO conversation content is stored here — only counters. (Founder decision
-- 2026-07-20: the docent logs counts, not transcripts.) A `locale` and the
-- model id are kept for cost attribution; nothing that identifies a person or
-- reproduces what they asked.
--
-- Service-role only (RLS deny-all, the 017/050 pattern).
--
-- Idempotent; safe on prod and fresh branches. DO NOT apply to prod without the
-- founder's explicit go-ahead. Apply to dev/staging first.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS docent_usage;

CREATE TABLE IF NOT EXISTS docent_usage (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_hash       TEXT NOT NULL,                 -- salted SHA-256; raw IP never stored
    locale        TEXT CHECK (locale IS NULL OR char_length(locale) <= 12),
    model         TEXT CHECK (model IS NULL OR char_length(model) <= 80),
    input_tokens  INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    faq_hit       BOOLEAN NOT NULL DEFAULT FALSE -- true = free canned answer, no model call
);

COMMENT ON TABLE docent_usage IS
    'Spend + rate-limit ledger for the site docent (docent-chat edge function). One row per answer. Counters only — NO conversation content is ever stored. ip_hash is a salted SHA-256 (raw IPs never stored). Drives the per-IP hourly cap and the global daily token budget (which degrades the docent to FAQ-only when crossed). Service-role only (RLS deny-all).';

-- windowed counting: per-IP hourly + global daily (token sum) windows
CREATE INDEX IF NOT EXISTS idx_docent_usage_ip_time
    ON docent_usage (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docent_usage_time
    ON docent_usage (created_at DESC);

ALTER TABLE docent_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docent_usage_service_role_only" ON docent_usage;
CREATE POLICY "docent_usage_service_role_only" ON docent_usage
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- Retention: 48h of history covers the widest window (daily budget). Purge ad
-- hoc or via pg_cron; extra rows are harmless.
--   DELETE FROM docent_usage WHERE created_at < now() - interval '7 days';
