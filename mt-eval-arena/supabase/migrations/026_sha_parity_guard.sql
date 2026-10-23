-- Migration 026 — un-bypassable corpus sha-binding (2026-06-14)
--
-- verify_corpus_integrity() (publish.py) already refuses to publish a run whose
-- corpus sha != the registry pin — but that gate is CLIENT-SIDE and a
-- hand-crafted client can skip it. This trigger enforces the same invariant
-- beneath every client and key: a run_card's claimed corpus sha
-- (run_card->dataset->sha256) must equal the curator-owned datasets.sha256 for
-- its dataset_id. With datasets writable only by service_role (migration 024),
-- datasets.sha256 is a trusted pin (141/141 populated on prod), so the
-- "ran an easy/leaked corpus, claimed the registered one" attack becomes
-- impossible for any registered dataset.
--
-- Skips silently when the dataset is unregistered or either sha is absent
-- (nothing to compare) — those runs stay unverifiable and never rank. The
-- server-side re-score verifier (mt_eval_harness/verifier.py) is the companion
-- defense that catches fabricated SCORES; this catches a swapped CORPUS.
-- Idempotent.

CREATE OR REPLACE FUNCTION reject_corpus_sha_mismatch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  registry_sha text;
  run_sha text;
BEGIN
  IF NEW.dataset_id IS NULL OR NEW.run_card IS NULL THEN
    RETURN NEW;
  END IF;

  run_sha := NULLIF(NEW.run_card #>> '{dataset,sha256}', '');
  IF run_sha IS NULL THEN
    RETURN NEW;  -- run claims no corpus sha → nothing to bind against
  END IF;

  SELECT NULLIF(d.sha256, '') INTO registry_sha
  FROM datasets d WHERE d.id = NEW.dataset_id;
  IF registry_sha IS NULL THEN
    RETURN NEW;  -- unregistered / unpinned dataset → cannot enforce here
  END IF;

  IF run_sha <> registry_sha THEN
    RAISE EXCEPTION
      'CORPUS SHA MISMATCH for dataset %: run reports % but the registered corpus is % — the evaluated corpus is not the registered one.',
      NEW.dataset_id, left(run_sha, 12) || '…', left(registry_sha, 12) || '…';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS run_cards_sha_parity_guard ON run_cards;
CREATE TRIGGER run_cards_sha_parity_guard
  BEFORE INSERT OR UPDATE ON run_cards
  FOR EACH ROW
  EXECUTE FUNCTION reject_corpus_sha_mismatch();
