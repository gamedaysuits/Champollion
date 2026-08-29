-- Migration 029: FST morphological_accuracy columns (P5 — fst-coverage profile)
--
-- Adds:
--   morphological_accuracy — FST-derived, lemma-matched inflection accuracy
--                            (0.0–1.0, nullable). For each analyzable predicted
--                            word the harness finds a reference word sharing its
--                            LEMMA and checks whether the inflection (feature tags)
--                            matches. Deterministic (the card-pinned GiellaLT FST is
--                            ground truth, not a model guess).
--   morph_coverage         — fraction of analyzable predicted words that lemma-
--                            matched a reference word (0.0–1.0, nullable). Disclosed
--                            so a sparse score is never hidden; morphological_accuracy
--                            only enters the composite when coverage ≥ the floor
--                            (mt_eval_harness.plugins.giellalt_fst.MORPH_COVERAGE_FLOOR).
--
-- TRUST. The server-side verifier RE-DERIVES morphological_accuracy
-- (verifier.recompute_corpus_morph) by re-running the SAME card-pinned FST against
-- the canonical, sha-pinned references, and refuses to grant trust='verified' to a
-- morph score it cannot reproduce — so the column needs the same [0,1] range
-- integrity as the other score columns (migration 023).
--
-- ACTIVATION (do these together — see the coupled-activation note in publish.py):
--   1. apply THIS migration on the DEV branch (so the verifier can READ + range-
--      check the reported value), BEFORE running the verifier on morph-reporting
--      runs;
--   2. drop "morphological_accuracy" from scoring.INACTIVE_METRICS (it carries a
--      declared 0.15 weight in the fst-coverage profile, SCORING_SPEC §4.3);
--   3. the verifier then enforces reproduction (verifier.py already SELECTs the
--      column and gates on it).
-- Until step 2, morphological_accuracy is ADVISORY: recorded here + on the run card
-- for transparency, but NOT in the live composite.

ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS morphological_accuracy REAL,
  ADD COLUMN IF NOT EXISTS morph_coverage REAL;

-- Range integrity (mirror migration 023): both are 0–1 fractions.
ALTER TABLE run_cards
  DROP CONSTRAINT IF EXISTS run_cards_morphological_accuracy_range;
ALTER TABLE run_cards
  ADD CONSTRAINT run_cards_morphological_accuracy_range
  CHECK (morphological_accuracy IS NULL
         OR (morphological_accuracy >= 0 AND morphological_accuracy <= 1));

ALTER TABLE run_cards
  DROP CONSTRAINT IF EXISTS run_cards_morph_coverage_range;
ALTER TABLE run_cards
  ADD CONSTRAINT run_cards_morph_coverage_range
  CHECK (morph_coverage IS NULL
         OR (morph_coverage >= 0 AND morph_coverage <= 1));

COMMENT ON COLUMN run_cards.morphological_accuracy IS
  'FST-derived, lemma-matched inflection accuracy (0.0-1.0). Nullable — requires a card-pinned GiellaLT FST. Declared 0.15 weight in the fst-coverage profile; ADVISORY until activated (dropped from scoring.INACTIVE_METRICS). Verifier-re-derived against the canonical corpus.';
COMMENT ON COLUMN run_cards.morph_coverage IS
  'Fraction of analyzable predicted words lemma-matched to the reference (0.0-1.0). morphological_accuracy enters the composite only when coverage >= MORPH_COVERAGE_FLOOR; disclosed so a sparse score is never hidden.';

CREATE INDEX IF NOT EXISTS idx_run_cards_morphological_accuracy
  ON run_cards (morphological_accuracy DESC NULLS LAST);
