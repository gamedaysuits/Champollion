-- ===========================================================================
-- Migration 077 — scoring standard/1 beneath every client
-- ===========================================================================
-- Scoring standard/1 (founder ruling 2026-10-04) retired the weighted
-- composite: runs rank on corpus chrF++ with its 95% bootstrap CI; BLEU,
-- spBLEU, TER and COMET are reported beside it, never blended. The harness,
-- CLI and MCP server already refuse a composite for anything NEW
-- (rankable_metrics.refuse_retired_for_new, qualifier_gate.QUALIFIER_METRIC).
-- This migration puts the same two rules in the database, so a client that
-- skips them (an old CLI, a direct PostgREST call, the service role) still
-- cannot create new work on the retired metric:
--
--   1. public.qualifiers.metric defaults to 'chrf_plus_plus' (042 defaulted
--      to 'composite').
--   2. public.rankable_metrics gains retired_at + retired_reason; composite
--      is marked retired. A NEW contest (INSERT, or an UPDATE that changes
--      metadata.primary_metric) and a NEW or re-pointed qualifier may not
--      name a retired metric. A contest or qualifier that already recorded
--      it keeps it: 076's row stays, so contest_lifecycle_guard() still
--      accepts it and old results stay interpretable.
--
-- The guard is a SEPARATE trigger: 076's contest_lifecycle_guard() is not
-- re-issued, so everything 072/074/076 enforce is untouched.
--
-- Retiring another metric later is data, not code:
--   UPDATE public.rankable_metrics
--      SET retired_at = now(), retired_reason = '<why, and what to use>'
--    WHERE metric_id = '<id>';
-- (and a `retired` reason on its registry ranking block —
-- arena/tests/test_retired_metrics_migration.py holds the two together).
--
-- Rollback:
--   DROP TRIGGER IF EXISTS contests_retired_metric_guard ON public.contests;
--   DROP TRIGGER IF EXISTS qualifiers_retired_metric_guard ON public.qualifiers;
--   DROP FUNCTION IF EXISTS public.retired_metric_guard();
--   ALTER TABLE public.qualifiers ALTER COLUMN metric SET DEFAULT 'composite';
--   ALTER TABLE public.rankable_metrics
--     DROP CONSTRAINT IF EXISTS rankable_metrics_retired_pair,
--     DROP COLUMN IF EXISTS retired_reason, DROP COLUMN IF EXISTS retired_at;
-- ===========================================================================

-- ---- 1. retirement is a column on the vocabulary table -------------------
ALTER TABLE public.rankable_metrics
  ADD COLUMN IF NOT EXISTS retired_at     timestamptz,
  ADD COLUMN IF NOT EXISTS retired_reason text;

ALTER TABLE public.rankable_metrics
  DROP CONSTRAINT IF EXISTS rankable_metrics_retired_pair;
ALTER TABLE public.rankable_metrics
  ADD CONSTRAINT rankable_metrics_retired_pair
  CHECK ((retired_at IS NULL) = (retired_reason IS NULL) AND
         (retired_reason IS NULL OR btrim(retired_reason) <> ''));

COMMENT ON COLUMN public.rankable_metrics.retired_at IS
  'When the metric was retired for NEW contests and qualifiers (migration 077). NULL = open. A retired row is never deleted: a contest that already recorded it keeps ranking on it.';
COMMENT ON COLUMN public.rankable_metrics.retired_reason IS
  'Why it was retired and what to choose instead — quoted verbatim in the refusal (migration 077). Mirrors the ranking.retired reason in shared/metric-registry.json.';

UPDATE public.rankable_metrics
   SET display_name   = 'Legacy composite (retired)',
       retired_at     = '2026-10-04T00:00:00Z',
       retired_reason = 'scoring standard/1 (2026-10-04) retired the weighted composite: a NEW contest ranks on corpus chrF++ (the default) or another standard metric. A contest that already recorded primary_metric=composite still ranks on it, labelled legacy composite (retired).'
 WHERE metric_id = 'composite'
   AND retired_at IS NULL;

-- ---- 2. qualifiers default to the standard's headline metric -------------
ALTER TABLE public.qualifiers ALTER COLUMN metric SET DEFAULT 'chrf_plus_plus';

COMMENT ON COLUMN public.qualifiers.metric IS
  'Which score the threshold applies to. Default chrf_plus_plus on its native 0-100 scale (scoring standard/1, migration 077; 042 defaulted to composite). A retired metric (public.rankable_metrics.retired_at) is refused for a new or re-pointed qualifier; a row that already recorded one keeps it (qualifier_gate.resolve_qualifier_metric).';
COMMENT ON COLUMN public.qualifiers.threshold IS
  'Clearance threshold on `metric` (chrF++ 0-100 by default since migration 077). REQUIRED and calibrated per contest at registration — never a silent DB default.';
COMMENT ON TABLE public.qualifiers IS
  'The public qualifier rounds paired to sealed sets: a method must clear the qualifier threshold (on metric, chrF++ by default since migration 077) before a sealed-set run may be proposed (cli/lib/sealed-qualifier.mjs isEligibleForSealedRun; Python mirror qualifier_gate.py). Thresholds are data, never code. Rotation is freeze-and-insert (vYYYY). Content-free. Migration 042.';

-- ---- 3. the refusal, beneath every client --------------------------------
CREATE OR REPLACE FUNCTION public.retired_metric_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_metric text;
  v_old    text;
  v_reason text;
  v_open   text;
BEGIN
  IF TG_TABLE_NAME = 'contests' THEN
    v_metric := NEW.metadata ->> 'primary_metric';
    IF TG_OP = 'UPDATE' THEN
      v_old := OLD.metadata ->> 'primary_metric';
    END IF;
  ELSE
    v_metric := NEW.metric;
    IF TG_OP = 'UPDATE' THEN
      v_old := OLD.metric;
    END IF;
  END IF;

  -- Only a NEW choice is checked: an unchanged recorded metric keeps its promise.
  IF v_metric IS NULL OR (TG_OP = 'UPDATE' AND v_old IS NOT DISTINCT FROM v_metric) THEN
    RETURN NEW;
  END IF;

  SELECT r.retired_reason INTO v_reason
    FROM public.rankable_metrics r
   WHERE r.metric_id = v_metric AND r.retired_at IS NOT NULL;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT string_agg(metric_id, ' | ' ORDER BY metric_id) INTO v_open
    FROM public.rankable_metrics WHERE retired_at IS NULL;
  RAISE EXCEPTION
    'RETIRED METRIC GUARD: ''%'' is retired for new % (%). Choose chrf_plus_plus (the default) or another open metric: %.',
    v_metric,
    CASE WHEN TG_TABLE_NAME = 'contests' THEN 'contests' ELSE 'qualifiers' END,
    v_reason, coalesce(v_open, 'none registered');
END;
$$;

COMMENT ON FUNCTION public.retired_metric_guard() IS
  'Migration 077: refuses a retired metric (public.rankable_metrics.retired_at) as a NEW contest metadata.primary_metric or a NEW qualifiers.metric — on INSERT, or an UPDATE that changes the value. Rows that already recorded it are untouched. Un-bypassable (service_role does not bypass triggers).';

DROP TRIGGER IF EXISTS contests_retired_metric_guard ON public.contests;
CREATE TRIGGER contests_retired_metric_guard
  BEFORE INSERT OR UPDATE OF metadata ON public.contests
  FOR EACH ROW EXECUTE FUNCTION public.retired_metric_guard();

DROP TRIGGER IF EXISTS qualifiers_retired_metric_guard ON public.qualifiers;
CREATE TRIGGER qualifiers_retired_metric_guard
  BEFORE INSERT OR UPDATE OF metric ON public.qualifiers
  FOR EACH ROW EXECUTE FUNCTION public.retired_metric_guard();
