-- =============================================================================
-- Migration 042: qualifiers — the public dev-set gate paired to a sealed set
-- =============================================================================
-- Phase A (organizer scoring node) of the sovereign contest pipeline.
-- Makes sealed_sets.current_qualifier_id REAL: before this migration it was a
-- lone documentary TEXT column with no table behind it, no threshold, and no
-- gating logic anywhere. This table is the DB half of the qualifier rule whose
-- logic SSOT is cli/lib/sealed-qualifier.mjs (isEligibleForSealedRun) with the
-- Python mirror arena/mt_eval_harness/qualifier_gate.py (parity-tested):
--
--   A method must clear a DISJOINT, fully PUBLIC twin of the sealed set — the
--   qualifier — before a run against the sealed set may even be proposed. The
--   threshold is DATA (this table + the corpora card), never code:
--   DEFAULT_QUALIFIER_THRESHOLD in sealed-qualifier.mjs is a caller-supplied
--   floor placeholder; every real qualifier row carries its own calibrated
--   threshold (contest prepare REQUIRES --qualifier-threshold, no silent
--   default — CLAUDE.md data-over-code rule).
--
-- ROTATION (sealed-qualifier.mjs rotateQualifier): qualifiers rotate yearly
-- (vYYYY). Rotation = FREEZE the active row + INSERT a fresh active row. A
-- frozen qualifier is retained immutable for history so old results stay
-- interpretable; hence the terms-freeze trigger below and the partial unique
-- index guaranteeing at most ONE active qualifier per sealed set.
--
-- CONTENT-FREE (L1). No source/reference/expected/plaintext column — this row
-- names a PUBLIC corpus card by id and carries a numeric threshold. The
-- qualifier corpus itself is public-tier by definition (gateQualifier admits
-- only redistribution-cleared licenses) and lives behind the ordinary
-- fetch-from-source card machinery, never in this DB.
--
-- Mirrors the migration-033/022/038 idempotent + trigger style. DEV/STAGING
-- BRANCH ONLY — do NOT apply to production without the founder's explicit
-- go-ahead (CLAUDE.md).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS qualifiers_terms_guard ON public.qualifiers;
--   DROP FUNCTION IF EXISTS public.reject_illegal_qualifier_mutation();
--   DROP TABLE IF EXISTS public.qualifiers CASCADE;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: qualifiers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qualifiers (
    -- Identity
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    qualifier_id     TEXT UNIQUE NOT NULL,   -- Stable public id, shape eval-<src>-<tgt>-<slug>-qualifier-vYYYY (sealed-qualifier.mjs buildQualifierId)

    -- What the qualifier IS (a public corpus card) and what it GATES (a sealed set)
    corpus_card_id   TEXT NOT NULL,          -- The PUBLIC dev corpora-card id participants score against (cli/shared/corpora-cards)
    sealed_set_id    TEXT
                     REFERENCES public.sealed_sets (sealed_set_id),  -- The sealed set this qualifier gates (NULL = registered ahead of its sealed set)

    -- The gate itself — DATA, never code (CLAUDE.md SSOT rule)
    threshold        NUMERIC NOT NULL,       -- Clearance threshold on `metric`; calibrated per contest, required at registration
    metric           TEXT NOT NULL DEFAULT 'composite',  -- Which score the threshold applies to (scoring.py composite by default)

    -- Rotation (vYYYY — sealed-qualifier.mjs qualifierVersionTag)
    year             INT NOT NULL
                     CHECK (year BETWEEN 2000 AND 9999),
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'frozen')),  -- rotate = freeze + insert fresh active

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT qualifiers_threshold_positive CHECK (threshold > 0)
);

COMMENT ON TABLE public.qualifiers IS
    'The public qualifier rounds paired to sealed sets: a method must clear qualifier threshold (on metric, usually the composite) before a sealed-set run may be proposed (cli/lib/sealed-qualifier.mjs isEligibleForSealedRun; Python mirror qualifier_gate.py). Thresholds are data, never code. Rotation is freeze-and-insert (vYYYY). Content-free. Migration 042.';

COMMENT ON COLUMN public.qualifiers.threshold IS
    'Clearance threshold on `metric` (composite 0-100 scale by default). REQUIRED and calibrated per contest at registration — DEFAULT_QUALIFIER_THRESHOLD in sealed-qualifier.mjs is a caller-side floor placeholder, never a silent DB default.';

COMMENT ON COLUMN public.qualifiers.status IS
    'active | frozen. One-way: rotation freezes the active row and inserts a fresh vYYYY row (sealed-qualifier.mjs rotateQualifier). Frozen rows are immutable history so old results stay interpretable.';

-- ---------------------------------------------------------------------------
-- Indexes — the node resolves the active qualifier for a sealed set; one
-- active qualifier per sealed set is a hard invariant (partial unique).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_qualifiers_one_active_per_set
    ON public.qualifiers (sealed_set_id)
    WHERE status = 'active' AND sealed_set_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qualifiers_corpus
    ON public.qualifiers (corpus_card_id);

-- ---------------------------------------------------------------------------
-- Terms guard — frozen means frozen. Mirrors the 038 immutability pattern:
-- a qualifier's terms (id, corpus, sealed set, threshold, metric, year) are
-- fixed at creation — an organizer cannot quietly lower a threshold mid-contest
-- or re-point a qualifier at a different corpus; status moves one-way
-- active -> frozen. Un-bypassable (service_role does not bypass triggers).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_illegal_qualifier_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.qualifier_id     IS DISTINCT FROM OLD.qualifier_id
     OR NEW.corpus_card_id IS DISTINCT FROM OLD.corpus_card_id
     OR NEW.sealed_set_id  IS DISTINCT FROM OLD.sealed_set_id
     OR NEW.threshold      IS DISTINCT FROM OLD.threshold
     OR NEW.metric         IS DISTINCT FROM OLD.metric
     OR NEW.year           IS DISTINCT FROM OLD.year THEN
    RAISE EXCEPTION
      'QUALIFIER GUARD: qualifier % terms are immutable (id/corpus/sealed_set/threshold/metric/year cannot change after creation — rotate to a new vYYYY row instead).',
      OLD.qualifier_id;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'active' AND NEW.status = 'frozen' THEN
      NULL;  -- rotation freezes the old round
    ELSE
      RAISE EXCEPTION
        'QUALIFIER GUARD: illegal status transition % -> % for qualifier % (allowed: active->frozen only; a frozen qualifier is immutable history).',
        OLD.status, NEW.status, OLD.qualifier_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_illegal_qualifier_mutation() IS
    'Freezes a qualifier''s terms after creation (no mid-contest threshold edits; rotate instead) and enforces one-way active->frozen. Un-bypassable (service_role does not bypass triggers). Migration 042.';

DROP TRIGGER IF EXISTS qualifiers_terms_guard ON public.qualifiers;
CREATE TRIGGER qualifiers_terms_guard
    BEFORE UPDATE ON public.qualifiers
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_illegal_qualifier_mutation();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- Fully public read (a qualifier IS the public half of the posture: anyone may
-- see what gate applies, at what threshold, and whether it is stale). No anon/
-- authenticated WRITE policy: registration goes through contest prepare via
-- service_role, exactly like sealed_sets (037).
-- ---------------------------------------------------------------------------
ALTER TABLE public.qualifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qualifiers_anon_read ON public.qualifiers;
CREATE POLICY qualifiers_anon_read
    ON public.qualifiers
    FOR SELECT
    TO anon, authenticated
    USING (true);
