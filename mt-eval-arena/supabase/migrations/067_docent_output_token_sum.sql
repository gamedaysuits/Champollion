-- Migration 067 — docent daily-token-budget accessor (bugfix, 2026-07-26)
--
-- WHY THIS EXISTS. docent-chat's global daily token budget needs the sum of
-- output_tokens over the last 24h. The function originally asked PostgREST for
-- it with the aggregate syntax:
--
--     GET /rest/v1/docent_usage?created_at=gte.<iso>&select=output_tokens.sum()
--
-- but aggregate functions are DISABLED on this project (PostgREST returns
-- `PGRST123 "Use of aggregate functions is not allowed"` — the default since
-- PostgREST 12, a DoS guard). sumOutputTokens() therefore threw on EVERY
-- request, and the handler's fail-closed branch turned that into a blanket
--
--     503 {"error":"the guide is briefly unavailable …"}
--
-- i.e. the docent was hard-down for every visitor, with a message that reads
-- like a transient blip. Caught by calling the deployed prod endpoint.
--
-- THE FIX. Do the sum in the database behind a narrow, service-role-only
-- function, instead of relying on an optional PostgREST feature (and instead of
-- enabling project-wide aggregates, which would loosen a DoS guard for every
-- table just to serve one counter).
--
-- SECURITY. SECURITY INVOKER — the caller's own privileges apply, so this adds
-- no new read path to docent_usage. Only service_role may EXECUTE it, and only
-- service_role can read the table anyway (066 is RLS deny-all). search_path is
-- pinned (advisor 0011 function_search_path_mutable).
--
-- Returns a scalar count, never row content — it cannot leak a conversation
-- (docent_usage holds no conversation content in the first place; see 066).
--
-- Idempotent. ROLLBACK:
--   DROP FUNCTION IF EXISTS docent_output_tokens_since(TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION docent_output_tokens_since(since TIMESTAMPTZ)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(output_tokens), 0)::BIGINT
  FROM docent_usage
  WHERE created_at >= since;
$$;

COMMENT ON FUNCTION docent_output_tokens_since(TIMESTAMPTZ) IS
    'Sum of docent_usage.output_tokens since a timestamp — the input to docent-chat''s global daily token budget. Exists because PostgREST aggregate syntax is disabled on this project (PGRST123), which otherwise made every docent request fail closed with a 503. SECURITY INVOKER, service_role EXECUTE only; returns a scalar, never row content.';

-- Deny-by-default: only the service role (the edge function) may call it.
REVOKE ALL ON FUNCTION docent_output_tokens_since(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION docent_output_tokens_since(TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION docent_output_tokens_since(TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION docent_output_tokens_since(TIMESTAMPTZ) TO service_role;
