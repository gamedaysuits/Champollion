-- Sanity assertions after `supabase db reset` on the local stack.
-- Every DO block RAISEs on failure, so psql -v ON_ERROR_STOP=1 exits non-zero
-- at the first broken invariant and names it.
\set ON_ERROR_STOP on

-- 1. Every migration file applied (001 … 074 = 74 rows; keep in step with the dir).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM supabase_migrations.schema_migrations;
  IF n < 74 THEN RAISE EXCEPTION 'schema_migrations has % rows, expected >= 74', n; END IF;
END $$;

-- 2. The tables the sealed/contest/queue/intake lanes depend on.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'run_cards','run_card_entries','datasets','contests','contest_submissions',
    'sealed_sets','authorization_requests','auth_grants','authorization_audit_log',
    'qualifiers','contest_intake','shared_tasks','queue_items','tickets','docent_usage',
    'anon_intake_log','contributors',
    -- 074: the sovereign-contest entry layer
    'contest_phases','contest_deferred_results']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION 'missing table public.%', t; END IF;
  END LOOP;
END $$;

-- 3. Functions/RPCs.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['claim_auth_grant','queue_top','queue_pairs','authorization_audit_head',
                           'contest_corpus_guard','contest_intake_admission_check',
                           -- 074
                           'contest_active_phase','contest_phase_guard',
                           'contest_sealed_set_ids','contest_for_sealed_set',
                           'contest_deferred_result_guard','contest_lifecycle_guard']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                   WHERE n.nspname='public' AND p.proname=f)
    THEN RAISE EXCEPTION 'missing function public.%', f; END IF;
  END LOOP;
END $$;

-- 4. Storage bucket for hypotheses intake (migration 044), private.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='contest-intake' AND public=false)
  THEN RAISE EXCEPTION 'storage bucket contest-intake missing or public'; END IF;
END $$;

-- 5. Event trigger from 054 (needs superuser at apply time).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname LIKE '%rls%')
  THEN RAISE EXCEPTION 'rls auto-enable event trigger (054) missing'; END IF;
END $$;

-- 6. Runtime dependencies of the regenerate-queue trigger (036/055): pg_net + vault.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net')
  THEN RAISE EXCEPTION 'extension pg_net missing (036 creates it; check the reset log)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='vault')
  THEN RAISE EXCEPTION 'schema vault missing — every run_cards INSERT will error in notify_regenerate_queue (055); run apply_migrations.sh --prereqs'; END IF;
END $$;

-- 7. The 022 quarantine trigger and the 064 anchored regex are wired on run_cards.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.run_cards'::regclass AND NOT tgisinternal AND tgname ILIKE '%quarantine%')
  THEN RAISE EXCEPTION 'quarantine guard trigger missing on run_cards'; END IF;
END $$;

-- 8. Migration 074: the sovereign-contest entry layer landed in full.
--    Columns, the phase trigger, the deferred-result guard, and the extended
--    ticket-kind vocabulary — asserted by name so a partially-applied 074 is a
--    FINDING rather than a mystery at probe time.
DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY[
    'is_primary','track','description','method_release_url','constraints',
    'submitter_label','authorization_request_id','phase']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='contest_submissions'
                     AND column_name=c)
    THEN RAISE EXCEPTION 'migration 074: contest_submissions.% missing', c; END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='authorization_requests'
                   AND column_name='execution_diagnostics')
  THEN RAISE EXCEPTION 'migration 074: authorization_requests.execution_diagnostics missing'; END IF;

  FOREACH c IN ARRAY ARRAY['report_url','report_generated_at'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='shared_tasks' AND column_name=c)
    THEN RAISE EXCEPTION 'migration 074: shared_tasks.% missing', c; END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='tickets'
                   AND column_name='subject_run_card_id')
  THEN RAISE EXCEPTION 'migration 074: tickets.subject_run_card_id missing'; END IF;

  -- The flagging kind must be admitted by the CHECK (065 + 074 vocabulary).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.tickets'::regclass AND conname='tickets_kind_check'
      AND pg_get_constraintdef(oid) LIKE '%''flag''%')
  THEN RAISE EXCEPTION 'migration 074: tickets_kind_check does not admit kind=''flag'''; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid='public.contest_phases'::regclass AND NOT tgisinternal
                   AND tgname='contest_phases_guard')
  THEN RAISE EXCEPTION 'migration 074: contest_phases_guard trigger missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid='public.contest_deferred_results'::regclass AND NOT tgisinternal
                   AND tgname='contest_deferred_results_guard')
  THEN RAISE EXCEPTION 'migration 074: contest_deferred_results_guard trigger missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE schemaname='public' AND indexname='idx_cs_one_primary')
  THEN RAISE EXCEPTION 'migration 074: idx_cs_one_primary (one primary per team) missing'; END IF;
END $$;

SELECT 'sanity: all assertions passed' AS result;
