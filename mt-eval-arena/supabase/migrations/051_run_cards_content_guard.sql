-- 051_run_cards_content_guard.sql
--
-- THE HOLE (launch-readiness audit 2026-07-18, H1). Migration 033 closed the
-- corpus-content leak on run_card_entries — but the world-readable
-- run_cards.run_card JSONB (hist/001 "Public read" USING (true)) had NO
-- content guard at all. The submit-run intake caps the request at 10 MB and
-- the authed lane accepts any JSONB, so a submitter could launder restricted
-- corpus text (EdTeKLA, Wolvengrey, held-out references) onto the public
-- board inside the run_card blob — bypassing 033 entirely and breaching the
-- never-host-content doctrine (docs/DATA_BOUNDARIES.md).
--
-- THIS MIGRATION makes the aggregate card content-safe at the database
-- layer, beneath every client and key (service_role bypasses RLS, not
-- triggers). It REUSES migration 033's resolution + license logic
-- (is_license_redistributable + the dataset_id -> datasets join) and adds
-- the second lever the audit named: strict AGGREGATE-ONLY SHAPE validation.
--
-- THE RULE. A legitimate run_card (publish.py assemble_run_card) is an
-- AGGREGATE document: config scalars, score/total blocks, per-bucket
-- aggregate dicts (by_difficulty / by_domain / by_segment), provenance
-- hashes, availability maps. It contains NO per-entry source/reference/
-- prediction text — entries travel in run_card_entries, where 033 rules.
-- The one legitimately long text field is `system_prompt_used` (the full
-- system/coaching prompt, pipeline.py provenance — the submitter's OWN
-- method artifact, the 043 "participant-owned artifact" class).
--
-- Enforcement, resolved via the run's datasets row (033's resolution):
--
--   EVERY row (cleared or not):
--     · run_card must be a JSON object (never array/scalar);
--     · serialized run_card ≤ 1 MB (RUN_CARD_MAX_BYTES_ANY — no legitimate
--       aggregate card approaches this; the 10 MB intake cap is for entries);
--     · plain-text COLUMNS are capped too (affirmation, corpus_attribution,
--       …) so the guard cannot be sidestepped by stuffing a neighboring
--       world-readable column.
--
--   NOT redistribution-cleared (unregistered dataset, or a registered one
--   whose license fails is_license_redistributable — NC / ND / proprietary /
--   unknown; 033's fail-safe posture):
--     · serialized run_card ≤ 256 KB;
--     · every string leaf ≤ 2,000 chars — EXCEPT the top-level
--       `system_prompt_used`, capped at 64 KB (method artifact, see above);
--     · object keys ≤ 128 chars (content cannot hide in key names);
--     · arrays ≤ 512 elements, and any OBJECT inside an ARRAY may not carry
--       a string value > 500 chars — the shape of an entries dump
--       ([{source, expected, predicted, …}, …]) is rejected outright;
--     · nesting depth ≤ 32.
--
--   Redistribution-cleared (registered + permissive license): only the
--   every-row checks apply. The corpus content is publishable through 033's
--   entry lane anyway, so shape-policing the aggregate adds nothing there.
--
-- HONEST RESIDUAL (documented, not hidden): shape validation cannot
-- semantically detect corpus text. A determined submitter can still place
-- ~2 KB fragments in string fields or up to 64 KB in their own prompt field
-- of a non-cleared run. What this guard removes is the BULK channel (a
-- corpus-shaped or corpus-sized payload); the remaining trickle is bounded
-- by the intake rate caps (migration 050: 5/IP/hour, 200/day), lands
-- attributed to a visible board row, and is purgeable through the 017 audit
-- lane. The T2-style full answer (server-side content scanning) is not a
-- SQL-trigger-sized problem.
--
-- SERVICE_ROLE / VERIFIER / CI. verifier.py only PATCHes `trust` (the guard
-- re-checks the unchanged card and passes); the publish/seed lanes emit
-- assemble_run_card output, which satisfies the shape rules by construction
-- (the one long field is exactly the exempted system_prompt_used).
--
-- Depends on: 033 (is_license_redistributable). Idempotent (CREATE OR
-- REPLACE + DROP TRIGGER IF EXISTS). The prod board is 0 rows (2026-07-18
-- audit), so no backfill concern; a re-run on a populated branch only
-- rejects FUTURE violating writes.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS run_cards_content_guard ON run_cards;
--   DROP FUNCTION IF EXISTS run_cards_content_guard_check();
--   DROP FUNCTION IF EXISTS run_card_shape_violation(jsonb, text, int);

-- ---------------------------------------------------------------------------
-- Recursive shape walker. Returns NULL when the subtree satisfies the strict
-- aggregate-only shape, else a human-readable description of the FIRST
-- violation (path included) for the trigger's exception message.
-- Caps (mirrored in tests/test_run_card_content_guard_migration.py):
--   leaf strings ≤ 2000 · system_prompt_used ≤ 65536 · keys ≤ 128
--   arrays ≤ 512 · strings in array-objects ≤ 500 · depth ≤ 32
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION run_card_shape_violation(
  elem     jsonb,
  path     text DEFAULT '$',
  depth    int  DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  k        text;
  v        jsonb;
  i        int;
  n        int;
  sub      text;
  in_array boolean;
BEGIN
  IF depth > 32 THEN
    RETURN format('nesting depth > 32 at %s', path);
  END IF;

  CASE jsonb_typeof(elem)
    WHEN 'string' THEN
      -- Leaf caps are enforced by the CALLER (it knows the key + array
      -- context); a bare string reaching here is a top-level scalar card,
      -- rejected earlier. Defensive cap only:
      IF length(elem #>> '{}') > 65536 THEN
        RETURN format('string of % chars at %s exceeds the 65536 hard cap',
                      length(elem #>> '{}'), path);
      END IF;
      RETURN NULL;

    WHEN 'object' THEN
      FOR k, v IN SELECT * FROM jsonb_each(elem) LOOP
        IF length(k) > 128 THEN
          RETURN format('object key of %s chars at %s exceeds 128', length(k), path);
        END IF;
        IF jsonb_typeof(v) = 'string' THEN
          -- The one exempted long-text field: the submitter's own prompt,
          -- top-level only (path '$'), capped at 64 KB.
          IF path = '$' AND k = 'system_prompt_used' THEN
            IF length(v #>> '{}') > 65536 THEN
              RETURN format('system_prompt_used is %s chars (cap 65536)',
                            length(v #>> '{}'));
            END IF;
          ELSIF length(v #>> '{}') > 2000 THEN
            RETURN format('string of %s chars at %s.%s exceeds 2000 '
                          '(aggregate cards carry aggregates, not text blocks)',
                          length(v #>> '{}'), path, k);
          END IF;
        ELSE
          sub := run_card_shape_violation(v, path || '.' || k, depth + 1);
          IF sub IS NOT NULL THEN
            RETURN sub;
          END IF;
        END IF;
      END LOOP;
      RETURN NULL;

    WHEN 'array' THEN
      n := jsonb_array_length(elem);
      IF n > 512 THEN
        RETURN format('array of %s elements at %s exceeds 512', n, path);
      END IF;
      FOR i IN 0 .. n - 1 LOOP
        v := elem -> i;
        IF jsonb_typeof(v) = 'string' THEN
          IF length(v #>> '{}') > 2000 THEN
            RETURN format('string of %s chars at %s[%s] exceeds 2000',
                          length(v #>> '{}'), path, i);
          END IF;
        ELSIF jsonb_typeof(v) = 'object' THEN
          -- An object INSIDE an array is the shape of an entries dump —
          -- its string values are capped hard at 500 chars.
          FOR k, v IN SELECT * FROM jsonb_each(elem -> i) LOOP
            IF jsonb_typeof(v) = 'string' AND length(v #>> '{}') > 500 THEN
              RETURN format('string of %s chars at %s[%s].%s exceeds 500 — '
                            'arrays of text-bearing objects are the shape of '
                            'a per-entry dump, which belongs in '
                            'run_card_entries under the 033 guard',
                            length(v #>> '{}'), path, i, k);
            END IF;
            IF jsonb_typeof(v) IN ('object', 'array') THEN
              sub := run_card_shape_violation(
                v, format('%s[%s].%s', path, i, k), depth + 2);
              IF sub IS NOT NULL THEN
                RETURN sub;
              END IF;
            END IF;
          END LOOP;
        ELSE
          sub := run_card_shape_violation(v, format('%s[%s]', path, i), depth + 1);
          IF sub IS NOT NULL THEN
            RETURN sub;
          END IF;
        END IF;
      END LOOP;
      RETURN NULL;

    ELSE
      -- number / boolean / null — always fine.
      RETURN NULL;
  END CASE;
END;
$$;

COMMENT ON FUNCTION run_card_shape_violation(jsonb, text, int) IS
  'Strict aggregate-only shape check for run_cards.run_card (migration 051): string leaves ≤ 2000 chars (system_prompt_used ≤ 64 KB, top level only), keys ≤ 128, arrays ≤ 512, strings inside array-objects ≤ 500 (the per-entry-dump shape), depth ≤ 32. NULL = compliant, else the first violation with its path.';

-- ---------------------------------------------------------------------------
-- The trigger — content guard for the world-readable aggregate card.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION run_cards_content_guard_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  card_bytes bigint;
  d_found    boolean := false;
  d_license  text;
  cleared    boolean := false;
  violation  text;
  col        text[];
BEGIN
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
    IF length(COALESCE(to_jsonb(NEW) ->> col[1], '')) > col[2]::int THEN
      RAISE EXCEPTION
        'RUN CARD CONTENT GUARD: column % is % chars (cap %) — text columns carry labels, not text blocks.',
        col[1], length(to_jsonb(NEW) ->> col[1]), col[2];
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
  'Content guard for the world-readable run_cards row (migration 051, audit 2026-07-18 H1): text-column caps + run_card must be an object ≤ 1 MB for every row; for corpora that are not redistribution-cleared (033 resolution + is_license_redistributable), the card must additionally satisfy the strict aggregate-only shape (run_card_shape_violation, ≤ 256 KB). Un-bypassable — service_role does not bypass triggers.';

DROP TRIGGER IF EXISTS run_cards_content_guard ON run_cards;
CREATE TRIGGER run_cards_content_guard
  BEFORE INSERT OR UPDATE ON run_cards
  FOR EACH ROW
  EXECUTE FUNCTION run_cards_content_guard_check();
