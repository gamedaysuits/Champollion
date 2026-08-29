-- Migration 048 — SECURITY DEFINER function EXECUTE hardening (2026-07-11)
--
-- The prod security advisor (post-035–047 apply, 2026-07-11) flagged that
-- claim_auth_grant / auth_grant_is_valid (039) and notify_regenerate_queue
-- (036) are EXECUTE-able by anon/authenticated via /rest/v1/rpc/. The 039
-- header intends the grant functions to be service-role/trigger lane only,
-- and notify_regenerate_queue is a trigger function that must never be
-- API-callable. Root cause: Supabase's default privileges grant EXECUTE to
-- anon/authenticated DIRECTLY at function creation, and 039's
-- `REVOKE ... FROM PUBLIC` removes only the implicit PUBLIC grant — the
-- direct role grants survive. (Same class as migration 025's rls_auto_enable
-- fix; same remedy.)
--
-- Practical exposure was narrow (a caller needs a valid grant_id + matching
-- fingerprint, neither anon-readable), but the API surface should match the
-- stated intent beneath every client.
--
-- Idempotent + branch-safe: regprocedure loop touches only functions that
-- exist, covering all overloads (the 025 pattern).
--
-- ROLLBACK: GRANT EXECUTE back to the roles (not recommended).

DO $$
DECLARE sig text;
BEGIN
  FOR sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'claim_auth_grant',
        'auth_grant_is_valid',
        'notify_regenerate_queue'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public', sig);
  END LOOP;
END $$;
