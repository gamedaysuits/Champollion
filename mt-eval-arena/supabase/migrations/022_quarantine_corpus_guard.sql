-- 022_quarantine_corpus_guard.sql  (v2 — corrected per founder 2026-06-13)
--
-- DOCTRINE: benchmarks are posted against ANY public dataset — EdTeKLA's
-- full protocol (436-entry dev + 50 held-out) included. What can never
-- rank again are IMPROPER datasets: the small easy slices that produced
-- inflated scores (62-sample / 90-phase1 / 124-subset / crk-master), and
-- anything an admin flags in the future.
--
-- Mechanism (data-driven, SSOT): a `quarantined` flag on the datasets
-- table is the source of truth; the trigger enforces it beneath every
-- client and key. A regex backstop catches the known-bad slice ids even
-- when no datasets row exists. Flagging or unflagging a dataset is a
-- plain UPDATE on datasets (admin/service role) — no code change needed.

ALTER TABLE datasets ADD COLUMN IF NOT EXISTS quarantined boolean NOT NULL DEFAULT false;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS quarantine_reason text;

-- Known-improper crk slices (the 2026-06-11 incident family). The FULL
-- EdTeKLA protocol datasets are deliberately NOT flagged.
UPDATE datasets
   SET quarantined = true,
       quarantine_reason = 'Improper subset of the EdTeKLA protocol (full = 436 dev + 50 held-out); produced inflated scores 2026-06-11. Founder order 2026-06-13.'
 WHERE id IN (
   'crk-phase1-test-90-quarantined',
   'crk-edtekla-dev-124-quarantined',
   'crk-master-corpus'
 );

CREATE OR REPLACE FUNCTION reject_quarantined_datasets()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Primary: the datasets.quarantined flag (data-driven).
  IF NEW.dataset_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM datasets d
        WHERE d.id = NEW.dataset_id AND d.quarantined
     ) THEN
    RAISE EXCEPTION
      'QUARANTINED DATASET: % is flagged quarantined and may not be published (see datasets.quarantine_reason).',
      NEW.dataset_id;
  END IF;
  -- Backstop: known-improper slice ids that may arrive unregistered.
  IF NEW.dataset_id ~* '(-quarantined|sample[-_]?62|phase1[-_]?test|dev[-_]?124|crk[-_]?master)' THEN
    RAISE EXCEPTION
      'QUARANTINED DATASET PATTERN: % matches a known-improper subset id (founder order 2026-06-13).',
      NEW.dataset_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS run_cards_quarantine_guard ON run_cards;
CREATE TRIGGER run_cards_quarantine_guard
  BEFORE INSERT OR UPDATE ON run_cards
  FOR EACH ROW
  EXECUTE FUNCTION reject_quarantined_datasets();

COMMENT ON FUNCTION reject_quarantined_datasets() IS
  'Rejects publication of datasets flagged quarantined (datasets.quarantined) or matching known-improper subset ids. Any PUBLIC dataset run under its proper protocol ranks normally. Founder doctrine 2026-06-13.';
