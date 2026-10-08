-- ==========================================================================
-- Migration 017: Audit trail for run_cards mutations
--
-- Run cards are immutable by policy (DATABASE_SCHEMA.md design principle
-- 3): the public API allows INSERT only, and moderation happens via the
-- service_role key. This migration adds defense-in-depth — any UPDATE or
-- DELETE on run_cards (admin moderation, dashboard edits, or a future
-- policy mistake) now preserves the prior row in run_cards_audit, so
-- score tampering is detectable and reversible.
--
-- WHAT THIS DOES:
--   1. Creates run_cards_audit (id, run_card_id, action, changed_at,
--      old_row JSONB).
--   2. Adds an AFTER UPDATE OR DELETE trigger on run_cards that writes
--      the OLD row as JSONB.
--   3. Enables RLS with a service-role-only read policy; no anon or
--      authenticated policies exist, so the audit log is invisible to
--      the public API. Writes happen only via the trigger (which runs
--      with definer privileges), never directly.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS run_cards_audit_trigger ON run_cards;
--   DROP FUNCTION IF EXISTS run_cards_audit_fn();
--   DROP TABLE IF EXISTS run_cards_audit;
-- ==========================================================================

-- 1. Audit table
CREATE TABLE IF NOT EXISTS run_cards_audit (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_card_id  TEXT NOT NULL,                  -- run_cards.id of the mutated row
    action       TEXT NOT NULL
                 CHECK (action IN ('UPDATE', 'DELETE')),
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    old_row      JSONB NOT NULL                  -- complete prior row
);

COMMENT ON TABLE run_cards_audit IS
    'Prior versions of mutated run_cards rows. Written by trigger on UPDATE/DELETE; service-role read only.';

CREATE INDEX IF NOT EXISTS idx_run_cards_audit_run_card
    ON run_cards_audit (run_card_id);

-- 2. Trigger function — capture the OLD row
--    SECURITY DEFINER so the audit insert succeeds regardless of the
--    privileges of the role performing the UPDATE/DELETE.
CREATE OR REPLACE FUNCTION run_cards_audit_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO run_cards_audit (run_card_id, action, old_row)
    VALUES (OLD.id, TG_OP, to_jsonb(OLD));
    RETURN OLD;
END;
$$;

-- Use IF NOT EXISTS pattern via DO block (CREATE TRIGGER lacks IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'run_cards_audit_trigger'
  ) THEN
    CREATE TRIGGER run_cards_audit_trigger
      AFTER UPDATE OR DELETE ON run_cards
      FOR EACH ROW
      EXECUTE FUNCTION run_cards_audit_fn();
  END IF;
END;
$$;

-- 3. Row-Level Security — service_role only
--    service_role bypasses RLS, so the explicit policy below is
--    documentation of intent; the load-bearing fact is that NO anon or
--    authenticated policies exist (RLS enabled + no policy = deny).
ALTER TABLE run_cards_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "run_cards_audit_service_role_read" ON run_cards_audit;
CREATE POLICY "run_cards_audit_service_role_read" ON run_cards_audit
    FOR SELECT
    TO service_role
    USING (TRUE);
