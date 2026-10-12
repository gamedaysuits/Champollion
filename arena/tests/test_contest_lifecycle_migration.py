"""Tests for migration 072 — the contests lifecycle guard.

The competition half of contests (`mt-eval contest rank / close / export`,
mt_eval_harness/contest_rank.py) freezes a ranking into
``contests.metadata.final_ranking`` at close. That is only a result of record
if the database refuses to let the row drift afterwards — which is what 072's
``contests_lifecycle_guard`` trigger does: identity freeze, one-way lifecycle,
close-requires-a-result, frozen result, primary-metric vocabulary + freeze.

OFFLINE (always run): the migration must PARSE under the real PostgreSQL
grammar (pglast) and carry each structural guarantee as text — mirroring
tests/test_contest_intake_migrations.py. The metric vocabulary the trigger
enforces must equal ``contest_rank.METRIC_VOCABULARY`` — the two are a single
rule written twice (SQL + Python), and this test is what keeps them one.

DEV/LOCAL ONLY. 072 is not applied to production until the founder says so
(see the migration header); the CLI performs the same checks client-side
meanwhile.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pglast = pytest.importorskip(
    "pglast", reason="pip install pglast to validate migration SQL"
)

from mt_eval_harness.contest_rank import METRIC_VOCABULARY  # noqa: E402

MIG_DIR = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
)
GUARD = MIG_DIR / "072_contests_lifecycle_guard.sql"


def _sql() -> str:
    assert GUARD.exists(), f"migration missing: {GUARD}"
    return GUARD.read_text()


def _stmt_types(sql: str) -> list[str]:
    return [type(raw.stmt).__name__ for raw in pglast.parse_sql(sql)]


class TestMigrationParses:
    def test_parses_under_postgres_grammar(self):
        assert len(pglast.parse_sql(_sql())) > 0

    def test_continues_the_migration_sequence(self):
        """072 is unique and follows 071 (concurrent lanes may add 073+)."""
        numbers = sorted(int(p.name[:3]) for p in MIG_DIR.glob("[0-9][0-9][0-9]_*.sql"))
        assert numbers.count(72) == 1, "migration number 072 must be unique"
        assert 71 in numbers, "072 must follow 071 in the canonical sequence"

    def test_header_documents_hole_migration_rollback_and_dev_only(self):
        sql = _sql()
        low = sql.lower()
        assert "the hole" in low
        assert "this migration" in low
        assert "rollback" in low
        assert "dev" in low and "prod" in low
        assert "DROP TRIGGER IF EXISTS contests_lifecycle_guard ON public.contests;" in sql
        assert "DROP FUNCTION IF EXISTS public.contest_lifecycle_guard();" in sql

    def test_trigger_only_no_ddl_on_tables(self):
        """072 adds discipline, not columns: no CREATE/ALTER TABLE."""
        types = _stmt_types(_sql())
        assert "CreateStmt" not in types
        assert "AlterTableStmt" not in types
        assert "CreateFunctionStmt" in types
        assert "CreateTrigStmt" in types
        assert "CommentStmt" in types


class TestGuardShape:
    def test_names_and_binding(self):
        sql = _sql()
        assert "CREATE OR REPLACE FUNCTION public.contest_lifecycle_guard()" in sql
        assert "SET search_path = public" in sql
        assert re.search(r"CREATE TRIGGER contests_lifecycle_guard\s+BEFORE INSERT OR UPDATE ON public\.contests\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.contest_lifecycle_guard\(\);", sql)

    def test_idempotent(self):
        sql = _sql()
        assert "CREATE OR REPLACE FUNCTION" in sql
        assert "DROP TRIGGER IF EXISTS contests_lifecycle_guard" in sql

    def test_identity_freeze_columns(self):
        sql = _sql()
        for col in ("id", "corpus_id", "language_pair", "lane", "use_context",
                    "created_by", "created_at"):
            assert re.search(rf"NEW\.{col}\s+IS DISTINCT FROM OLD\.{col}", sql), col

    def test_shared_task_attaches_once(self):
        sql = _sql()
        assert "OLD.shared_task_id IS NOT NULL" in sql
        assert "NEW.shared_task_id IS DISTINCT FROM OLD.shared_task_id" in sql

    def test_one_way_lifecycle(self):
        sql = _sql()
        assert "(OLD.status = 'open'   AND NEW.status = 'closed')" in sql
        assert "(OLD.status = 'closed' AND NEW.status = 'archived')" in sql
        assert "illegal status transition" in sql
        # birth state restated on INSERT
        assert "NEW.status <> 'open'" in sql

    def test_close_requires_final_ranking_object_and_forces_intake_closed(self):
        sql = _sql()
        assert "jsonb_typeof(NEW.metadata -> 'final_ranking') IS DISTINCT FROM 'object'" in sql
        assert "NEW.intake_open := false;" in sql
        # server-stamped close time
        assert "jsonb_build_object('closed_at', now())" in sql

    def test_frozen_result_after_close(self):
        sql = _sql()
        assert "OLD.status IN ('closed', 'archived')" in sql
        assert "(NEW.metadata -> 'final_ranking') IS DISTINCT FROM (OLD.metadata -> 'final_ranking')" in sql
        assert "(NEW.metadata -> 'closed_at')  IS DISTINCT FROM (OLD.metadata -> 'closed_at')" in sql
        assert "(NEW.metadata -> 'closed_by')  IS DISTINCT FROM (OLD.metadata -> 'closed_by')" in sql
        assert "intake cannot reopen after close" in sql

    def test_no_result_keys_at_insert_or_while_open(self):
        sql = _sql()
        assert "TG_OP = 'INSERT'" in sql
        assert sql.count("NEW.metadata ? 'final_ranking'") >= 2   # INSERT + open-UPDATE
        assert "OLD.status = 'open' AND NEW.status = 'open'" in sql

    def test_primary_metric_frozen_once_entries_exist(self):
        sql = _sql()
        assert "public.contest_submissions cs WHERE cs.contest_id = OLD.id" in sql
        assert "public.contest_intake ci WHERE ci.contest_id = OLD.id" in sql
        assert "metadata.primary_metric" in sql and "frozen" in sql

    def test_comment_states_the_rules(self):
        sql = _sql()
        m = re.search(r"COMMENT ON FUNCTION public\.contest_lifecycle_guard\(\) IS\s+'(.+?)';", sql, re.S)
        assert m, "function comment missing"
        text = m.group(1)
        for needle in ("identity freeze", "open -> closed -> archived",
                       "final_ranking", "primary_metric", "Migration 072".lower()
                       if False else "migration 072"):
            assert needle in text.lower(), needle


# 072 hard-coded the four metrics rankable in 2026-09; migration 076 moved the
# vocabulary into the rankable_metrics table (tests/test_rankable_metrics_migration.py
# holds the live parity). 072's list is history: pinned here, and still rankable.
VOCABULARY_072 = {"chrf_plus_plus", "bleu", "comet_score", "composite"}


class TestMetricVocabularyParity:
    def test_sql_vocabulary_is_the_recorded_072_set(self):
        sql = _sql()
        m = re.search(r"v_metric NOT IN \(([^)]*)\)", sql)
        assert m, "vocabulary check not found"
        sql_vocab = {s.strip().strip("'") for s in m.group(1).split(",")}
        assert sql_vocab == VOCABULARY_072

    def test_every_072_metric_is_still_rankable(self):
        assert VOCABULARY_072 <= set(METRIC_VOCABULARY)

    def test_error_message_lists_the_same_vocabulary(self):
        sql = _sql()
        assert "chrf_plus_plus | bleu | comet_score | composite" in sql
