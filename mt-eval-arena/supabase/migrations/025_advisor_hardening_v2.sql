-- Migration 025 — security-advisor hardening v2 (2026-06-14)
--
-- Consolidates and completes migration 020, which the live-prod advisor shows
-- did NOT fully land (ledger drift: 019/020/021 are absent from prod's
-- migration history). Brings prod to a clean security-advisor state regardless
-- of which earlier hardening was applied. Idempotent + branch-safe: every
-- statement only touches objects that exist, via regprocedure (handles all
-- overloads).
--
-- Fixes the current EXTERNAL security lints observed on prod 2026-06-14:
--   * 0028/0029 — public.rls_auto_enable() (SECURITY DEFINER) is EXECUTE-able
--     by anon/authenticated via /rest/v1/rpc/. It is an EVENT TRIGGER function
--     (auto-enables RLS on new public tables) and must never be API-callable.
--     Revoking EXECUTE does NOT stop it firing — event triggers are invoked by
--     the system, not through EXECUTE privilege.
--   * 0011 — role-mutable search_path on several functions, including the
--     integrity-critical reject_quarantined_datasets() and
--     validate_run_card_scores() (both created after 020, so 020 never pinned
--     them). Pin search_path = public.

-- 1. rls_auto_enable: revoke all API-facing EXECUTE.
DO $$
DECLARE sig text;
BEGIN
  FOR sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public', sig);
  END LOOP;
END $$;

-- 2. run_cards_audit_fn: trigger-only SECURITY DEFINER — keep it un-callable
--    (re-asserts 020's revoke in case 020 never landed).
DO $$
DECLARE sig text;
BEGIN
  FOR sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'run_cards_audit_fn'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public', sig);
  END LOOP;
END $$;

-- 3. Pin search_path on every flagged function (plus the ones 020 named, which
--    is harmlessly idempotent). Covers all overloads via regprocedure.
DO $$
DECLARE sig text;
BEGIN
  FOR sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_updated_at', 'update_datasets_modified',
        'get_source_licenses', 'get_attribution_for_language',
        'get_experts_for_language', 'get_languages_for_expert',
        'get_trading_card_index', 'get_trading_card_detail',
        'reject_quarantined_datasets', 'validate_run_card_scores'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', sig);
  END LOOP;
END $$;
