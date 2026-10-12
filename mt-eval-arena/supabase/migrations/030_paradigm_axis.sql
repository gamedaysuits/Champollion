-- Migration 030: paradigm axis (method taxonomy — rule-based vs neural vs llm…)
--
-- WHAT. Adds the THIRD, orthogonal method-taxonomy axis to run_cards:
--   paradigm TEXT — the algorithmic paradigm a method uses, independent of
--     both method_class (HOW it translates: raw-llm / coached-llm / pipeline /
--     custom-plugin / api / human) and dependency_class (WHAT it needs:
--     S/O/A1/A2/X). Recommended value set:
--         rule-based | statistical | neural-nmt | llm | hybrid | human | unknown
--     (METHOD_TAXONOMY_GUIDE §A; canonical: the Paradigms table in the Method
--      Interface spec, arena/website/docs/specifications/methods.md).
--     Nullable — NULL reads as "unknown". Populated on publish from
--     method_card.paradigm (publish._extract_method_taxonomy).
--   + a partial index mirroring idx_run_cards_method_class.
--
-- WHY. method_class is LLM-centric: a rule-based Apertium system and Google
-- Translate both land in pipeline/api, so "rule-based vs neural" was invisible.
-- The paradigm axis makes that comparison first-class and filterable on the
-- leaderboard (en→crk rule-based vs neural-nmt vs llm, side by side).
--
-- ENUM is enforced APP-SIDE (config.VALID_PARADIGMS), NOT by a DB CHECK —
-- mirrors method_class (also free-text in the DB) and keeps the value set
-- cheap to evolve before cards lock it in. The leaderboard only surfaces the
-- column once it exists AND carries values, so this migration is safe to apply
-- independently of (and ahead of) any client deploy.
--
-- APPLIED TO PRODUCTION 2026-06-16 (project "champollion",
-- ref sjdomynysdljkbemupqa) per the founder's explicit directive — overriding
-- the usual dev-only convention (CLAUDE.md). Verified: column (text), partial
-- index, and comment all present; listing + paradigm-filter queries return 200.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_run_cards_paradigm;
--   ALTER TABLE run_cards DROP COLUMN IF EXISTS paradigm;

ALTER TABLE run_cards
  ADD COLUMN IF NOT EXISTS paradigm TEXT;

COMMENT ON COLUMN run_cards.paradigm IS
  'MT paradigm axis (rule-based, statistical, neural-nmt, llm, hybrid, human, unknown), orthogonal to method_class and dependency_class. Nullable (NULL = unknown). Populated on publish from method_card.paradigm. Enum enforced app-side (config.VALID_PARADIGMS), not by a DB CHECK.';

-- Partial index mirrors idx_run_cards_method_class — supports the leaderboard
-- paradigm filter + distinct-value fetch without scanning NULL rows.
CREATE INDEX IF NOT EXISTS idx_run_cards_paradigm
  ON run_cards (paradigm) WHERE paradigm IS NOT NULL;
