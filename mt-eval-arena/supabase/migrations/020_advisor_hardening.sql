-- ==========================================================================
-- Migration 020 — Supabase security-advisor hardening (2026-06-11 branch audit)
--
-- 1. run_cards_audit_fn is SECURITY DEFINER and was callable via
--    /rest/v1/rpc/ by anon and authenticated roles. It is a trigger
--    function only — revoke all API-facing EXECUTE.
-- 2. Six SQL functions had a role-mutable search_path (advisor lint 0011).
--    Pin them to public.
--
-- Idempotent.
-- ==========================================================================

REVOKE EXECUTE ON FUNCTION public.run_cards_audit_fn() FROM anon, authenticated, public;

ALTER FUNCTION public.get_source_licenses() SET search_path = public;
ALTER FUNCTION public.get_attribution_for_language(TEXT) SET search_path = public;
ALTER FUNCTION public.get_experts_for_language(TEXT) SET search_path = public;
ALTER FUNCTION public.get_languages_for_expert(TEXT) SET search_path = public;
ALTER FUNCTION public.update_datasets_modified() SET search_path = public;
ALTER FUNCTION public.get_trading_card_index() SET search_path = public;
