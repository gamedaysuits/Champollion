-- =============================================================================
-- Migration 047: shared_tasks — the multi-pair edition umbrella (gap G5)
-- =============================================================================
-- AmericasNLP-style shared tasks are MULTI-PAIR (one edition = Spanish → ~11
-- Indigenous languages) while contests (008/041/043) are per-pair, so an
-- edition today is N disconnected contests rows with nothing grouping them.
-- This migration adds the thin umbrella: a shared_tasks row names the edition
-- (name, organizer, cycle year) and carries the edition's POLICY DEFAULTS;
-- contests gain a nullable shared_task_id FK pointing at it.
--
-- DELIBERATELY THIN. The umbrella changes NO per-pair machinery: qualifiers
-- (042), intake lifecycle (043), authorization (038/039/040), and scoring all
-- keep operating per contest exactly as before. A shared_tasks row is a
-- grouping + defaults object:
--   * grouping — `mt-eval contest prepare --shared-task <id>` stamps the FK,
--     and the website renders one edition as one page grouping its per-pair
--     contests;
--   * defaults — default_authorization_model / default_intake_daily_limit are
--     COPIED onto each contest at prepare time (contest_prep.register_prepared
--     via the CLI's flag resolution). They are organizer conveniences, never
--     live gates: editing them later does NOT retroactively change any
--     existing contest — the enforcing policy lives on the contests columns
--     (043) and the frozen qualifier rows (042), as always.
--
-- CONTENT-FREE (L1). Names, an organizer label, a year, and two policy
-- defaults — no corpus/source/reference/text column exists or ever will.
--
-- SOVEREIGNTY NAMING: `organizer` is the shared task's own PUBLIC self-chosen
-- label (e.g. "AmericasNLP organizing committee") — it is NOT a custodian
-- naming; key custodians stay behind opaque custodian_group_id (037) and are
-- never named pre-consent (docs governance rule).
--
-- Mirrors the migration-033/022/042 idempotent + trigger style. DEV/STAGING
-- BRANCH ONLY — do NOT apply to production without the founder's explicit
-- go-ahead (CLAUDE.md).
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_contests_shared_task;
--   ALTER TABLE public.contests DROP COLUMN IF EXISTS shared_task_id;
--   DROP TRIGGER IF EXISTS shared_tasks_identity_guard ON public.shared_tasks;
--   DROP FUNCTION IF EXISTS public.reject_illegal_shared_task_mutation();
--   DROP TABLE IF EXISTS public.shared_tasks CASCADE;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: shared_tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_tasks (
    -- Identity
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shared_task_id   TEXT UNIQUE NOT NULL,   -- Stable public slug, e.g. 'americasnlp-2026' (one row per edition, not per series)

    -- What the edition IS
    name             TEXT NOT NULL,          -- Human-readable edition name, e.g. 'AmericasNLP 2026 Shared Task'
    organizer        TEXT NOT NULL,          -- The organizing body's own public label (never a key-custodian naming)
    year             INT NOT NULL
                     CHECK (year BETWEEN 2000 AND 9999),  -- Cycle year (an annual series = one row per year, like qualifier vYYYY rotation)
    description      TEXT NOT NULL DEFAULT '',

    -- Policy DEFAULTS for member contests — copied at `contest prepare` time,
    -- never read live. Same vocabulary + fail-closed default as contests.
    -- authorization_model (043).
    default_authorization_model TEXT NOT NULL DEFAULT 'per-submission'
                     CHECK (default_authorization_model IN ('per-submission', 'blanket', 'open')),
    default_intake_daily_limit  INT NOT NULL DEFAULT 5
                     CHECK (default_intake_daily_limit > 0),

    -- Display lifecycle (one-way): an archived edition keeps its history but
    -- stops advertising itself as the current cycle.
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'archived')),

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.shared_tasks IS
    'Multi-pair shared-task EDITION umbrella (one row = one edition-year, e.g. americasnlp-2026): groups N per-pair contests via contests.shared_task_id and carries the edition''s policy defaults. Thin by design — no per-pair machinery (qualifiers 042, intake 043, authorization 038-040) reads this table; defaults are copied onto contests at prepare time. Content-free. Migration 047.';

COMMENT ON COLUMN public.shared_tasks.shared_task_id IS
    'Stable public edition slug (e.g. americasnlp-2026). One row per edition-year, mirroring qualifier vYYYY rotation — next year''s cycle is a NEW row, never an edit.';

COMMENT ON COLUMN public.shared_tasks.organizer IS
    'The organizing body''s own public label. NOT a custodian naming — key custodians stay behind the opaque custodian_group_id (037) until consent.';

COMMENT ON COLUMN public.shared_tasks.default_authorization_model IS
    'Default authorization posture COPIED onto member contests at prepare time when the organizer does not pass --authorization-model explicitly. Fail-closed default per-submission (043 vocabulary). Editing it later never changes existing contests. Migration 047.';

COMMENT ON COLUMN public.shared_tasks.default_intake_daily_limit IS
    'Default per-submitter 24h intake throttle COPIED onto member contests at prepare time (043 intake_daily_limit). Editing it later never changes existing contests. Migration 047.';

COMMENT ON COLUMN public.shared_tasks.status IS
    'active | archived. One-way: archiving an edition is display lifecycle only — its contests, qualifiers, and published scores are untouched.';

-- ---------------------------------------------------------------------------
-- The FK on contests — the whole point of the umbrella. Nullable: standalone
-- contests keep working untouched; membership is opt-in at prepare time.
-- ---------------------------------------------------------------------------
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS shared_task_id TEXT
    REFERENCES public.shared_tasks (shared_task_id);

COMMENT ON COLUMN public.contests.shared_task_id IS
  'The multi-pair shared-task edition this contest belongs to (047), or NULL for a standalone contest. Stamped by `mt-eval contest prepare --shared-task`; grouping + display only — every gate stays per-contest.';

-- The website distiller / edition page queries member contests by umbrella.
CREATE INDEX IF NOT EXISTS idx_contests_shared_task
    ON public.contests (shared_task_id)
    WHERE shared_task_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Identity guard — an edition's identity (slug, year, creation time) is fixed
-- at creation; the next cycle is a NEW row (042 rotation posture). Labels,
-- description, and the copied-at-prepare-time defaults may be corrected in
-- place; status moves one-way active -> archived. Un-bypassable (service_role
-- does not bypass triggers).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_illegal_shared_task_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.shared_task_id IS DISTINCT FROM OLD.shared_task_id
     OR NEW.year         IS DISTINCT FROM OLD.year
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'SHARED TASK GUARD: edition % identity is immutable (shared_task_id/year/created_at cannot change — an annual series rotates by INSERTING next year''s row, like qualifier vYYYY rotation).',
      OLD.shared_task_id;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'active' AND NEW.status = 'archived' THEN
      NULL;  -- the cycle closed
    ELSE
      RAISE EXCEPTION
        'SHARED TASK GUARD: illegal status transition % -> % for edition % (allowed: active->archived only).',
        OLD.status, NEW.status, OLD.shared_task_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_illegal_shared_task_mutation() IS
    'Freezes a shared-task edition''s identity (slug/year/created_at) and enforces one-way active->archived; labels and prepare-time defaults stay editable. Un-bypassable (service_role does not bypass triggers). Migration 047.';

DROP TRIGGER IF EXISTS shared_tasks_identity_guard ON public.shared_tasks;
CREATE TRIGGER shared_tasks_identity_guard
    BEFORE UPDATE ON public.shared_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_illegal_shared_task_mutation();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- Fully public read (an edition IS a public announcement: who runs it, which
-- year, under what default posture). No anon/authenticated WRITE policy:
-- editions are registered by the organizer tooling via service_role, exactly
-- like qualifiers (042) and sealed_sets (037).
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_tasks_anon_read ON public.shared_tasks;
CREATE POLICY shared_tasks_anon_read
    ON public.shared_tasks
    FOR SELECT
    TO anon, authenticated
    USING (true);
