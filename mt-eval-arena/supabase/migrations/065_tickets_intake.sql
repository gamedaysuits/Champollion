-- Migration 065 — tickets intake lane (founder direction 2026-07-20)
--
-- "We welcome good objections and people should be able to provide tickets
--  through this chatbot like takedown requests, and I should get those at
--  info@champollion.dev."
--
-- THE LANE. A new edge function (functions/submit-ticket, verify_jwt=false)
-- accepts one contact/objection/takedown message from an unauthenticated
-- visitor (the site docent's ticket form, or any client), validates it
-- strictly (functions/submit-ticket/lib.ts), rate-limits per IP, inserts the
-- row with the SERVICE ROLE, and emails info@champollion.dev. The DB row is
-- the durable record of record; the email is a notification. Email failure
-- MUST NOT lose the ticket — the row persists either way (see the function).
--
-- WHY A DEDICATED TABLE (not run_cards / not a generic log): tickets carry
-- free-text visitor content and an optional reply-to address — PII-adjacent,
-- never rankable, never public. It gets the same deny-all RLS treatment as
-- anon_intake_log (migration 050) and audit_log: service-role only.
--
-- PRIVACY:
--   · The client IP is NEVER stored — only a salted SHA-256 hash (ip_hash),
--     used solely for the per-IP rate-limit window. Same discipline as 050.
--   · contact_email is OPTIONAL. A visitor may file a ticket anonymously; if
--     they do, there is simply no way to reply, and that is their choice.
--   · message is visitor free text. Nothing here is ever surfaced publicly or
--     joined to the leaderboard.
--
-- RATE LIMITING: the function counts rows in THIS table by ip_hash over a
-- sliding window (default 3/hour/IP) plus a global daily cap (default 100/day).
-- No separate ledger is needed — every accepted ticket is a row here already,
-- and the (ip_hash, created_at) index makes the window count cheap.
--
-- MODERATION / TAKEDOWN EXECUTION: this table is the intake, not the action.
-- Acting on a takedown (e.g. purging an anonymous run card, pulling a citation,
-- correcting a card field) happens through the existing lanes — see
-- docs/TICKETS.md for the recipes. Closing a ticket is a service-role UPDATE
-- of status/notes.
--
-- Idempotent; safe on prod and fresh branches. DO NOT apply to prod without
-- the founder's explicit go-ahead (Supabase rule). Apply to the dev/staging
-- branch first.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS tickets;

-- 1. The tickets table.
CREATE TABLE IF NOT EXISTS tickets (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- classification chosen by the sender (drives triage + email urgency)
    kind          TEXT NOT NULL DEFAULT 'question'
                  CHECK (kind IN ('takedown', 'objection', 'correction', 'question', 'other')),
    -- the site locale the ticket was filed from (e.g. 'fil'); free-form, short
    locale        TEXT CHECK (locale IS NULL OR char_length(locale) <= 12),
    -- the page the sender was on, if the client supplied it
    page_url      TEXT CHECK (page_url IS NULL OR char_length(page_url) <= 2048),
    -- the visitor's message; the one required piece of content
    message       TEXT NOT NULL
                  CHECK (char_length(message) BETWEEN 1 AND 8000),
    -- OPTIONAL reply-to; NULL = filed anonymously (no way to reply, by choice)
    contact_email TEXT CHECK (contact_email IS NULL OR char_length(contact_email) <= 320),
    -- salted SHA-256 of the client IP; the raw IP is NEVER stored
    ip_hash       TEXT NOT NULL,
    -- how it arrived (docent form, direct API, …); display/triage only
    source        TEXT NOT NULL DEFAULT 'docent-form'
                  CHECK (char_length(source) <= 40),
    -- triage state
    status        TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'ack', 'closed')),
    -- whether the notification email was sent (false = row saved, email failed
    -- — the founder still has the ticket; see the daily digest recipe)
    emailed       BOOLEAN NOT NULL DEFAULT FALSE,
    -- staff-only triage notes
    notes         TEXT
);

COMMENT ON TABLE tickets IS
    'Visitor contact / objection / takedown intake (submit-ticket edge function, founder direction 2026-07-20). The durable record of record; the email to info@champollion.dev is a notification. ip_hash is a salted SHA-256 — raw IPs are never stored. contact_email is optional. Service-role only (RLS deny-all). Never public, never rankable.';

-- 2. Indexes: the per-IP rate-limit window + global daily window + triage view.
CREATE INDEX IF NOT EXISTS idx_tickets_ip_time
    ON tickets (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_time
    ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_kind
    ON tickets (status, kind, created_at DESC);

-- 3. RLS — deny-all below service_role (the 017 / 050 pattern). RLS enabled +
--    no anon/authenticated policies = deny. The explicit service_role policy
--    documents intent (service_role bypasses RLS anyway).
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_service_role_only" ON tickets;
CREATE POLICY "tickets_service_role_only" ON tickets
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- 4. Retention is a governance choice, not automated here: takedown/objection
--    tickets are a legal + relational record and should NOT be silently purged.
--    Closed 'question' tickets can be pruned ad hoc if desired:
--    DELETE FROM tickets WHERE kind = 'question' AND status = 'closed'
--      AND created_at < now() - interval '180 days';
