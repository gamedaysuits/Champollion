-- Migration 035: Contest use_context flag (commercial | non-commercial).
--
-- WHY (founder doctrine 2026-06-19): "prize", "API", and "commercial" are
-- ORTHOGONAL attributes, not one restricted bucket. A NonCommercial dataset
-- (CC-BY-NC / CC-BY-NC-SA) gates COMMERCIAL use + redistribution SPECIFICALLY —
-- it does NOT gate non-commercial use. So a non-commercial prize (an
-- open-source-solution prize, or a corporation funding a prize for private /
-- internal use) MAY rank runs on an NC dataset; a commercial / for-profit /
-- API-served contest may NOT.
--
-- DATA MODEL: a contest carries a single use_context flag. Dataset eligibility
-- for that contest is then COMPUTED from the flag + the dataset's license:
--
--     eligible(contest, dataset) =
--         NOT dataset.quarantined                         -- EdTeKLA / sovereignty floor
--         AND is_usage_allowed(dataset.license,           -- the use-based gate
--                              use_context = contest.use_context,
--                              redistribution = false)
--
--   * use_context='non-commercial' → permissive AND NonCommercial datasets rank.
--   * use_context='commercial'     → only commercial-safe (permissive) datasets;
--                                     NC / unstated / mixed are blocked (fail-safe).
--
-- The use-based gate lives in code as the SSOT, mirrored across runtimes:
--   - JS:     cli/lib/license-gate.mjs            → isUsageAllowed()
--   - Python: arena/mt_eval_harness/license_use.py → is_usage_allowed()
--                                                   → contest_dataset_eligible()
--
-- QUARANTINE ALWAYS WINS. EdTeKLA + crk sovereignty corpora stay
-- hard-quarantined a layer above this (datasets.quarantined flag + migration
-- 022's reject_quarantined_datasets() trigger on run_cards) and never rank in
-- ANY lane — commercial or not. This migration does NOT loosen that; the
-- use_context nuance applies only to GENERAL NC sets (MAFAND, ELCat, …).
--
-- The contest UI is not built yet — this migration records the data model so
-- the column exists when it is. Default is the safe lane (non-commercial).
-- NOTE: dev/staging only without the founder's explicit go-ahead (CLAUDE.md).

ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS use_context TEXT NOT NULL DEFAULT 'non-commercial'
    CHECK (use_context IN ('commercial', 'non-commercial'));

COMMENT ON COLUMN contests.use_context IS
  'commercial | non-commercial. Combined with a dataset''s license (via '
  'is_usage_allowed) to compute eligibility: a commercial contest may NOT rank '
  'NonCommercial datasets; a non-commercial contest may. Orthogonal to '
  'quarantine, which always blocks (migration 022).';
