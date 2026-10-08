-- 054_rls_auto_enable.sql
--
-- THE GAP (launch-readiness audit 2026-07-18, L1). The rls_auto_enable()
-- safety net — an event trigger that force-enables Row Level Security on
-- every new public table the moment it is created — existed ONLY on the
-- production project, created by hand via the dashboard SQL editor. It was
-- in no migration file, so a rebuild, a fresh dev branch, or a disaster
-- recovery would silently come up WITHOUT the net that guarantees "a table
-- with no policies is deny-all, never world-writable".
--
-- THIS MIGRATION commits the production DDL VERBATIM (retrieved 2026-07-18
-- via pg_get_functiondef / pg_event_trigger on the live project;
-- launch-hardening session). The function body is transcribed exactly — no
-- edits, no improvements — so the committed artifact IS the prod object.
--
-- WHAT IT DOES. On every CREATE TABLE / CREATE TABLE AS / SELECT INTO in
-- the `public` schema, the trigger runs ALTER TABLE … ENABLE ROW LEVEL
-- SECURITY on the new table and logs the action. RLS-enabled + no policies
-- = deny-all below service_role (the 017/050 posture) — so a migration that
-- forgets its RLS section fails SAFE (deny) instead of OPEN (public).
-- Failures are logged, never raised: the net must not break DDL replay.
--
-- Idempotent (CREATE OR REPLACE + conditional event-trigger creation; a
-- re-run on prod, where `ensure_rls` already exists, is a no-op). CREATE
-- EVENT TRIGGER requires the `postgres` role — true for the SQL editor,
-- `supabase db push`, and the management-API query lane alike.
--
-- ROLLBACK:
--   DROP EVENT TRIGGER IF EXISTS ensure_rls;
--   DROP FUNCTION IF EXISTS public.rls_auto_enable();

-- ---------------------------------------------------------------------------
-- The function — VERBATIM from production (do not edit; see header).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.rls_auto_enable() IS
  'Safety net: force-enables RLS on every new public table (deny-all until policies are written). Created on prod via the dashboard; committed verbatim as migration 054 (audit 2026-07-18 L1) so rebuilds keep the net.';

-- ---------------------------------------------------------------------------
-- The event trigger (CREATE EVENT TRIGGER has no IF NOT EXISTS).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    CREATE EVENT TRIGGER ensure_rls
      ON ddl_command_end
      WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      EXECUTE FUNCTION public.rls_auto_enable();
  END IF;
END;
$$;
