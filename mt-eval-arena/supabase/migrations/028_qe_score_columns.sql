-- Migration 028: reference-free QE columns (P4 — no-reference scoring profile)
--
-- Adds:
--   qe_score        — reference-free Quality Estimation score (~0.0–1.0, nullable;
--                     requires unbabel-comet + a QE model, e.g. AfriCOMET-QE).
--                     Scored under the `no-reference` profile (SCORING_SPEC §4.3).
--   has_references  — whether the run had gold references (False → the run was
--                     scored under the reference-free `no-reference` profile).
--
-- The server-side verifier RE-DERIVES qe_score (verifier.recompute_corpus_qe) from
-- source + MT and refuses to grant trust='verified' to a qe_score it cannot
-- reproduce — so the column needs the same [0,1] range integrity as the other
-- score columns (migration 023). Apply on the DEV branch before running the
-- verifier on QE-reporting runs.

ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS qe_score REAL,
  ADD COLUMN IF NOT EXISTS has_references BOOLEAN DEFAULT TRUE;

-- Range integrity (mirror migration 023): qe_score is a 0–1 quality score.
ALTER TABLE run_cards
  DROP CONSTRAINT IF EXISTS run_cards_qe_score_range;
ALTER TABLE run_cards
  ADD CONSTRAINT run_cards_qe_score_range
  CHECK (qe_score IS NULL OR (qe_score >= 0 AND qe_score <= 1));

COMMENT ON COLUMN run_cards.qe_score IS
  'Reference-free QE score (~0.0-1.0). Nullable — requires unbabel-comet + a QE model (e.g. AfriCOMET-QE). Scored under the no-reference profile; verifier-re-derived.';
COMMENT ON COLUMN run_cards.has_references IS
  'Whether the run had gold references. False => scored under the reference-free no-reference profile.';

CREATE INDEX IF NOT EXISTS idx_run_cards_qe_score
  ON run_cards (qe_score DESC NULLS LAST);
