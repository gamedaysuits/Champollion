-- 058_rls_auto_enable_execute_revoke.sql
--
-- Fix a fresh-REPLAY hazard in the advisor-hardening chain (DB2 / audit 2026-07-20).
--
-- Migration 025 (advisor_hardening_v2) revokes API-facing EXECUTE on
-- public.rls_auto_enable() so advisor lints 0028/0029 stay clear. But 025's
-- revoke is a DO-block that only acts IF the function already exists — and on a
-- clean LINEAR replay of 001→057 (a fresh dev branch, or anyone rebuilding the
-- public repo's migrations), 025 runs long BEFORE migration 054 first CREATEs
-- rls_auto_enable(). So the 025 revoke no-ops, then 054's `CREATE OR REPLACE`
-- restores PostgreSQL's default PUBLIC EXECUTE grant, and nothing re-revokes it.
--
-- Net effect: the "zero advisor warnings" guarantee holds on the live prod
-- project (where 025 ran when the function already existed) but is FALSE on any
-- from-scratch replay — exactly what a public-repo consumer or a new branch does.
--
-- This migration re-applies the revoke AFTER 054, so the guarantee is
-- replay-stable. It is a no-op on prod (the grant is already revoked there) and
-- idempotent (safe to re-run). Revoking EXECUTE does NOT stop the event trigger
-- firing — event triggers are invoked by the system on DDL, not through EXECUTE
-- privilege — so the RLS safety net is unaffected (same rationale as 025).

-- Same proven pattern as migration 025 §1 (oid::regprocedure::text in a FOR
-- loop): a no-op when the function is absent, so it never errors on a partial
-- rebuild.
DO $$
DECLARE sig text;
BEGIN
  FOR sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public', sig);
    RAISE LOG '058: re-revoked API-facing EXECUTE on % (replay-stable)', sig;
  END LOOP;
END $$;
