-- 033_run_card_entries_content_guard.sql
--
-- THE HOLE (2026-06-19 audit). The per-entry corpus-content exposure gate
-- (NC / ND license, sealed held_out/gold_standard segment, quarantined dataset,
-- unregistered-default) lived ONLY in the harness publish path
-- (mt_eval_harness/publish.py `_entry_content_publishable`). The docstring there
-- claimed "the DB triggers are the backstop", but run_card_entries had ZERO
-- triggers and world-readable, world-writable (authenticated INSERT) source +
-- expected columns. So any authenticated user — a free GitHub/Google account —
-- could bypass the Python gate entirely with a direct PostgREST insert of
-- EdTeKLA / Wolvengrey / NC / held-out TEXT onto a run_card they own
-- (migration 027 only binds entries to the owner, not to a publishable corpus).
-- That re-opens the exact corpus-CONTENT leak path the gate exists to close.
--
-- THIS MIGRATION makes the gate real at the database layer. A BEFORE INSERT OR
-- UPDATE trigger on run_card_entries mirrors `_entry_content_publishable`
-- (publish.py ~314-349) and its license classifier `_license_is_redistributable`
-- (publish.py ~280-311), beneath every client and key. The aggregate run_card
-- still publishes regardless (this trigger is ONLY on run_card_entries) — exactly
-- as the Python gate intends: "publish verifiable results without exposing the
-- corpus data."
--
-- RESOLUTION. The entry's corpus is resolved by joining the parent run_card:
--   run_card_entries.run_card_id -> run_cards.dataset_id -> datasets d.
-- An entry's CONTENT is REJECTED when, for the resolved datasets row d:
--   (a) d.quarantined is true; OR
--   (b) NEW.segment IN ('held_out','gold_standard') (sealed); OR
--   (c) d.license is not redistribution-cleared (NULL/empty, or NC/ND/
--       proprietary/restricted/etc., or lacking any permissive family prefix).
-- FAIL-SAFE: if NO datasets row resolves (unregistered / ad-hoc corpus), the
-- content's redistribution status is unknown -> REJECT. This is intentionally
-- STRICTER than the Python client, which lets `--publish-entries` override an
-- unregistered corpus on the caller's word. At the DB we cannot trust that word,
-- and (since migration 024) `datasets` is curator-only (service_role): a
-- legitimately redistributable corpus is REGISTERED first, then its content may
-- be posted. Unregistered runs still publish their aggregate run_card (scores +
-- corpus sha + size) — they are simply scores-only, never content-exposing.
--
-- SERVICE_ROLE / VERIFIER / CI. service_role bypasses RLS but NOT triggers, so
-- this guard also covers curator/CI inserts. That is safe for the legitimate
-- paths:
--   • verifier.py only READS run_card_entries (re-score) — it never inserts.
--   • the publish / seed-sweep path (publish.py `_publish_entries`) only inserts
--     entries for corpora that already pass the Python gate, i.e. REGISTERED +
--     redistribution-cleared license + open segment. Those resolve to a datasets
--     row whose license the uploader (sync_datasets_to_prod.py) copied from the
--     registry and whose NC corpora were excluded outright, so this trigger's
--     "registered + non-quarantined + open-segment + redistributable-license ->
--     ALLOW" branch is exactly that path. Real seed corpora carry per-entry
--     segments 'development'/'devtest'/'test' — never the sealed values.
--
-- The license classifier and trigger function are kept byte-for-byte faithful to
-- the publish.py token lists; tests/test_content_guard_migration.py asserts that
-- parity so the two cannot drift.
--
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). The board is freshly
-- wiped (0 run_card_entries on prod), so no backfill is needed; a re-run on a
-- populated branch only rejects FUTURE non-publishable inserts.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS run_card_entries_content_guard ON run_card_entries;
--   DROP FUNCTION IF EXISTS reject_nonpublishable_entry_content();
--   DROP FUNCTION IF EXISTS is_license_redistributable(text);

-- 0. Defensive: the join column. run_cards.dataset_id has existed since the base
--    schema (historical/001_create_run_cards.sql: `dataset_id text not null`) and
--    is already read by triggers 022/026 — this ADD is a no-op on prod, present
--    only so the migration is self-contained on a fresh branch.
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS dataset_id text;

-- ---------------------------------------------------------------------------
-- License classifier — mirrors mt_eval_harness/publish.py
-- `_license_is_redistributable` and its token lists
-- (_NONREDISTRIBUTABLE_LICENSE_TOKENS / _SUBSTRINGS,
--  _REDISTRIBUTABLE_LICENSE_PREFIXES, publish.py ~280-311).
--
-- True ONLY when a corpus's CONTENT is cleared for public redistribution.
-- Conservative by design: NULL/empty -> false; NC/ND/proprietary/restricted ->
-- false even if a permissive-looking prefix is also present (e.g. CC-BY-NC-SA
-- -> false, caught by the standalone 'nc' token); otherwise cleared only when a
-- redistributable license family substring is present.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_license_redistributable(license_str text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  low    text;
  toks   text;   -- non-alphanumeric runs -> single spaces, space-padded (token test)
  sub    text;
  pref   text;
BEGIN
  IF license_str IS NULL OR btrim(license_str) = '' THEN
    RETURN false;
  END IF;
  low := lower(btrim(license_str));

  -- (1) NC / ND / proprietary / restricted substrings -> never redistributable.
  FOREACH sub IN ARRAY ARRAY[
    'noncommercial', 'non-commercial', 'noderiv', 'no-deriv',
    'noderivatives', 'proprietary', 'restricted', 'wolvengrey',
    'all rights reserved'
  ] LOOP
    IF strpos(low, sub) > 0 THEN
      RETURN false;
    END IF;
  END LOOP;

  -- (2) Standalone 'nc' / 'nd' tokens (Python: split on [^a-z0-9]+).
  toks := ' ' || regexp_replace(low, '[^a-z0-9]+', ' ', 'g') || ' ';
  IF strpos(toks, ' nc ') > 0 OR strpos(toks, ' nd ') > 0 THEN
    RETURN false;
  END IF;

  -- (3) Cleared only when a redistributable license family appears. (Python's
  --     `low.startswith(p) or p in low` reduces to substring containment.)
  FOREACH pref IN ARRAY ARRAY[
    'cc-by', 'cc0', 'cc-zero', 'public domain', 'publicdomain', 'pd-',
    'mit', 'apache', 'bsd', 'odc-by', 'odbl', 'gpl', 'lgpl', 'mpl',
    'unlicense'
  ] LOOP
    IF strpos(low, pref) > 0 THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION is_license_redistributable(text) IS
  'True only when a corpus license is cleared for public redistribution. Mirrors mt_eval_harness/publish.py _license_is_redistributable (token lists kept in parity by tests/test_content_guard_migration.py). NULL/empty/NC/ND/proprietary/restricted -> false.';

-- ---------------------------------------------------------------------------
-- Trigger — the un-bypassable per-entry corpus-content gate. Mirrors
-- mt_eval_harness/publish.py `_entry_content_publishable` (publish.py ~314-349).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_nonpublishable_entry_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d_id      text;
  d_found   boolean := false;
  d_quar    boolean;
  d_license text;
BEGIN
  -- Resolve the entry's corpus via the parent run card. (The FK
  -- run_card_entries.run_card_id -> run_cards(id) guarantees rc exists; in the
  -- publish flow the run_card is inserted before its entries, same transaction.)
  SELECT rc.dataset_id INTO d_id
  FROM run_cards rc
  WHERE rc.id = NEW.run_card_id;

  IF d_id IS NOT NULL THEN
    SELECT true, d.quarantined, d.license
      INTO d_found, d_quar, d_license
    FROM datasets d
    WHERE d.id = d_id;
  END IF;

  -- FAIL-SAFE: no registered datasets row -> redistribution status unknown ->
  -- REJECT. Registered, redistribution-cleared corpora are the ONLY content
  -- that may be exposed (curator-owned registry, migration 024). The aggregate
  -- run_card still publishes; this only blocks raw source/expected text.
  IF NOT COALESCE(d_found, false) THEN
    RAISE EXCEPTION
      'CORPUS CONTENT GUARD: run_card % resolves to no registered datasets row (dataset_id=%) — per-entry corpus content may only be published for a registered, redistribution-cleared corpus (fail-safe; the run card still publishes as scores-only).',
      NEW.run_card_id, COALESCE(d_id, '<null>');
  END IF;

  -- (a) quarantined dataset (datasets.quarantined; SSOT, migration 022).
  IF COALESCE(d_quar, false) THEN
    RAISE EXCEPTION
      'CORPUS CONTENT GUARD: dataset % is quarantined — per-entry corpus content withheld (see datasets.quarantine_reason).',
      d_id;
  END IF;

  -- (b) sealed segment — held_out / gold_standard text is never exposed.
  IF lower(btrim(COALESCE(NEW.segment, ''))) IN ('held_out', 'gold_standard') THEN
    RAISE EXCEPTION
      'CORPUS CONTENT GUARD: segment ''%'' is sealed (held_out/gold_standard) — per-entry corpus content withheld.',
      NEW.segment;
  END IF;

  -- (c) license must be redistribution-cleared.
  IF NOT is_license_redistributable(d_license) THEN
    RAISE EXCEPTION
      'CORPUS CONTENT GUARD: dataset % license ''%'' is not redistribution-cleared (non-commercial / no-deriv / restricted / unknown) — per-entry corpus content withheld.',
      d_id, COALESCE(d_license, '<null>');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION reject_nonpublishable_entry_content() IS
  'Un-bypassable per-entry corpus-content gate on run_card_entries. Mirrors publish.py _entry_content_publishable: rejects quarantined / held_out / gold_standard / non-redistributable-license / unregistered (fail-safe) corpus content. The aggregate run_card publishes regardless. Audit 2026-06-19.';

DROP TRIGGER IF EXISTS run_card_entries_content_guard ON run_card_entries;
CREATE TRIGGER run_card_entries_content_guard
  BEFORE INSERT OR UPDATE ON run_card_entries
  FOR EACH ROW
  EXECUTE FUNCTION reject_nonpublishable_entry_content();
