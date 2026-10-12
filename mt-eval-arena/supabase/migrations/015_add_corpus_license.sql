-- ==========================================================================
-- Migration 015: Add corpus license passthrough columns to run_cards
--
-- Every published run now carries the license and attribution of the
-- corpus it was evaluated on (line-level license tracking — see
-- docs/LICENSING.md). publish.py resolves these from
-- arena/datasets/registry.json at assembly time and denormalizes them
-- onto the row so the leaderboard can display/filter license obligations
-- without digging into the run_card JSONB blob.
--
-- Both columns are NULLABLE by design: runs against ad-hoc corpora
-- (--corpus path/to/file.json) or datasets missing from the registry
-- publish with NULLs and a CLI warning — license tracking must never
-- block a publish.
--
-- ROLLBACK:
--   ALTER TABLE run_cards DROP COLUMN IF EXISTS corpus_license;
--   ALTER TABLE run_cards DROP COLUMN IF EXISTS corpus_attribution;
-- ==========================================================================

ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS corpus_license TEXT;
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS corpus_attribution TEXT;

COMMENT ON COLUMN run_cards.corpus_license IS
    'SPDX-ish license of the evaluation corpus (from arena/datasets/registry.json). NULL for unregistered datasets.';
COMMENT ON COLUMN run_cards.corpus_attribution IS
    'Required attribution string for the evaluation corpus. NULL for unregistered datasets.';
