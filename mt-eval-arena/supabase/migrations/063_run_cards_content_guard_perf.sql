-- 063_run_cards_content_guard_perf.sql
--
-- PERF-ONLY replacement of migration 051's run_cards_content_guard_check()
-- (launch review 2026-07-20, finding DB6). Behavior is IDENTICAL to 051 in
-- every observable respect; only the row-serialization cost changes.
--
-- THE COST. 051's trigger fires BEFORE INSERT OR UPDATE on run_cards, and
-- NEW carries the up-to-1 MB `run_card` JSONB. The text-column cap loop
-- walks 13 columns and, for EACH, re-serialized the whole NEW row afresh
-- (plus once more inside the RAISE on a violation). So a single ordinary publish — and
-- every verifier trust-update, which only PATCHes `trust` but still re-runs
-- the whole BEFORE trigger — re-serialized the entire ≤1 MB row ~13 times.
-- During the fresh-board seed (hundreds of publishes in a burst) that is
-- hundreds of megabytes of redundant JSONB serialization for no added safety.
--
-- THE FIX. The whole-row JSONB is hoisted to a single local `card_json`
-- computed ONCE at the top of the function and reused for every column check.
-- The one remaining call is that single hoist assignment. Nothing
-- else moves: the text-column caps, the "run_card must be a JSON object
-- ≤ 1 MB" checks, the 033 dataset-license resolution, and the strict
-- aggregate-only shape validation (run_card_shape_violation, ≤ 256 KB for
-- corpora that are not redistribution-cleared) are byte-identical in effect
-- to 051. run_card_shape_violation() itself is UNTOUCHED (051 remains its
-- only definition).
--
-- WHY A NEW MIGRATION (not an edit to 051): 051 is already applied to prod;
-- applied migrations are never edited in place. CREATE OR REPLACE FUNCTION
-- keeps the existing `run_cards_content_guard` trigger bound to the same
-- function name — the trigger is NOT dropped or recreated here.
--
-- SEARCH_PATH. 051 pinned `SET search_path = public` on this function; a bare
-- CREATE OR REPLACE would silently drop that pin and reintroduce advisor lint
-- 0011 (role-mutable search_path). The pin is preserved below.
--
-- Idempotent (CREATE OR REPLACE). Prod-apply is founder-gated (CLAUDE.md).
--
-- ROLLBACK: re-run migration 051 (its CREATE OR REPLACE restores the prior
-- body); the trigger binding is unaffected either way.

CREATE OR REPLACE FUNCTION run_cards_content_guard_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  card_json  jsonb;        -- whole-row JSONB, computed ONCE (DB6, was ~13x/row)
  card_bytes bigint;
  d_found    boolean := false;
  d_license  text;
  cleared    boolean := false;
  violation  text;
  col        text[];
BEGIN
  -- Serialize the row a single time; the ≤ 1 MB run_card lives inside NEW, so
  -- re-serializing per column (as 051 did) was the dominant per-publish cost.
  card_json := to_jsonb(NEW);

  -- ---- plain text columns (every row) — the guard must not be
  -- sidestepped by stuffing a neighboring world-readable column.
  FOREACH col SLICE 1 IN ARRAY ARRAY[
    ['submitter',          '200'],
    ['affirmation',        '4000'],
    ['model_slug',         '300'],
    ['condition',          '200'],
    ['dataset_id',         '300'],
    ['language_pair',      '100'],
    ['harness_version',    '100'],
    ['fingerprint_hash',   '200'],
    ['api_provider',       '100'],
    ['method_class',       '100'],
    ['paradigm',           '100'],
    ['corpus_license',     '300'],
    ['corpus_attribution', '2000']
  ] LOOP
    IF length(COALESCE(card_json ->> col[1], '')) > col[2]::int THEN
      RAISE EXCEPTION
        'RUN CARD CONTENT GUARD: column % is % chars (cap %) — text columns carry labels, not text blocks.',
        col[1], length(card_json ->> col[1]), col[2];
    END IF;
  END LOOP;

  IF NEW.run_card IS NULL THEN
    RETURN NEW;
  END IF;

  -- ---- every row: an aggregate card is a JSON object, bounded.
  IF jsonb_typeof(NEW.run_card) <> 'object' THEN
    RAISE EXCEPTION
      'RUN CARD CONTENT GUARD: run_card must be a JSON object (got %).',
      jsonb_typeof(NEW.run_card);
  END IF;

  card_bytes := length(NEW.run_card::text);
  IF card_bytes > 1048576 THEN
    RAISE EXCEPTION
      'RUN CARD CONTENT GUARD: run_card is % bytes (cap 1048576) — no aggregate card is this large; per-entry data belongs in run_card_entries (guarded by migration 033).',
      card_bytes;
  END IF;

  -- ---- 033''s resolution: is this run''s corpus redistribution-cleared?
  IF NEW.dataset_id IS NOT NULL THEN
    SELECT true, d.license INTO d_found, d_license
    FROM datasets d
    WHERE d.id = NEW.dataset_id;
  END IF;
  cleared := COALESCE(d_found, false)
             AND is_license_redistributable(d_license);

  IF NOT cleared THEN
    -- Fail-safe posture (033): unregistered or non-redistributable corpus →
    -- the card must be strictly aggregate-shaped. The run still publishes;
    -- only a content-shaped/content-sized blob is refused.
    IF card_bytes > 262144 THEN
      RAISE EXCEPTION
        'RUN CARD CONTENT GUARD: run_card is % bytes (cap 262144 for a corpus that is not redistribution-cleared) — aggregate cards are small; corpus content is never hosted here (docs/DATA_BOUNDARIES.md).',
        card_bytes;
    END IF;

    violation := run_card_shape_violation(NEW.run_card);
    IF violation IS NOT NULL THEN
      RAISE EXCEPTION
        'RUN CARD CONTENT GUARD: % — dataset % is not redistribution-cleared (unregistered, or NC/ND/proprietary/unknown license), so its run_card must stay strictly aggregate-only. Scores still publish; corpus content never does (migration 033 doctrine).',
        violation, COALESCE(NEW.dataset_id, '<null>');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION run_cards_content_guard_check() IS
  'Content guard for the world-readable run_cards row (migration 051, audit 2026-07-18 H1; perf hoist migration 063, review 2026-07-20 DB6): text-column caps + run_card must be an object ≤ 1 MB for every row; for corpora that are not redistribution-cleared (033 resolution + is_license_redistributable), the card must additionally satisfy the strict aggregate-only shape (run_card_shape_violation, ≤ 256 KB). The whole-row JSONB is serialized once per row. Un-bypassable — service_role does not bypass triggers.';

-- The run_cards_content_guard trigger (BEFORE INSERT OR UPDATE, FOR EACH ROW,
-- migration 051) stays bound to this function by name; CREATE OR REPLACE above
-- does not detach it, so it is intentionally NOT re-created here.
