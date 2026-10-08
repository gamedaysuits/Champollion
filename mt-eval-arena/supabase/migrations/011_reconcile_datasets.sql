-- ==========================================================================
-- Migration 011: Reconcile datasets table schema
--
-- PROBLEM: The datasets table was created by CLI migration 20260528024953
-- with one schema. Arena migration 009 attempted to CREATE TABLE with a
-- different schema, but IF NOT EXISTS made it a no-op. publish.py was
-- updated to write columns that only exist in the arena schema (never
-- applied). This migration adds the arena-specific columns to the live
-- CLI-created table.
--
-- WHAT THIS DOES:
--   1. Adds arena-specific columns (difficulty_min/max, domains, segments,
--      updated_at, metadata) to the existing CLI-created datasets table.
--   2. Relaxes version NOT NULL → nullable (publish.py doesn't always know
--      the version, and organic upserts shouldn't fail on missing metadata).
--   3. Adds an UPDATE trigger for updated_at.
--   4. Does NOT drop CLI-only columns (domain, segment, source, notes) —
--      they hold existing data from the seed row.
--
-- WHY: Establish a single canonical datasets schema that both the CLI
-- leaderboard and the arena publish system can work with.
--
-- ROLLBACK:
--   ALTER TABLE datasets DROP COLUMN IF EXISTS difficulty_min;
--   ALTER TABLE datasets DROP COLUMN IF EXISTS difficulty_max;
--   ALTER TABLE datasets DROP COLUMN IF EXISTS domains;
--   ALTER TABLE datasets DROP COLUMN IF EXISTS segments;
--   ALTER TABLE datasets DROP COLUMN IF EXISTS updated_at;
--   ALTER TABLE datasets DROP COLUMN IF EXISTS metadata;
--   ALTER TABLE datasets ALTER COLUMN version SET NOT NULL;
-- ==========================================================================

-- 1. Add arena-specific columns to the existing table
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS difficulty_min INTEGER;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS difficulty_max INTEGER;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS domains TEXT[] DEFAULT '{}';
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS segments TEXT[] DEFAULT '{}';
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Relax version constraint — organic upserts may not always have it
ALTER TABLE datasets ALTER COLUMN version DROP NOT NULL;

-- 3. Auto-update updated_at on any row modification
CREATE OR REPLACE FUNCTION update_datasets_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Use IF NOT EXISTS pattern via DO block (CREATE TRIGGER lacks IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_datasets_updated_at'
  ) THEN
    CREATE TRIGGER set_datasets_updated_at
      BEFORE UPDATE ON datasets
      FOR EACH ROW
      EXECUTE FUNCTION update_datasets_modified();
  END IF;
END;
$$;
