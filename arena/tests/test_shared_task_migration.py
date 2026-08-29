"""Tests for migration 047 — the multi-pair shared-task edition umbrella.

Gap G5 of the shared-task hosting work: AmericasNLP-style tasks are multi-pair
(one edition = source → many targets) while contests are per-pair, so an
edition used to be N disconnected contests. 047 adds the THIN umbrella:

  047_shared_tasks.sql — shared_tasks (name, organizer, cycle year, policy
                         defaults) + contests.shared_task_id FK + index

Two layers of coverage, mirroring tests/test_contest_intake_migrations.py:

1. OFFLINE (always run): the migration must PARSE under the real PostgreSQL
   grammar (pglast) and carry the structural guarantees the umbrella needs —
   content-free (names/labels/year/defaults, never corpus text), fail-closed
   default_authorization_model, identity freeze + one-way active->archived,
   read-only RLS, and — the G5 promise — NO change to any per-pair machinery
   (the only ALTER TABLE target is contests, and only to add the FK).

2. LIVE DB (gated on MT_EVAL_TEST_DB_URL + psycopg): assert the DB itself
   enforces the identity freeze, the one-way archive, and the FK. Skips when
   no DB is configured AND when 047 has not been applied to the branch yet
   (the table-presence probe), so the suite stays green pre-application.

DEV/STAGING ONLY. Apply 047 to a dev branch only (see the migration header).
"""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

import pytest

pglast = pytest.importorskip(
    "pglast", reason="pip install pglast to validate migration SQL"
)

MIG_DIR = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
)

SHARED_TASKS = MIG_DIR / "047_shared_tasks.sql"

# Same content-column blocklist as the intake-migration suite: the umbrella is
# names + a year + two policy defaults, never corpus or submission content.
_FORBIDDEN_CONTENT_COLUMNS = {
    "source", "reference", "expected", "target", "plaintext", "cleartext",
    "content", "sentence", "translation", "ciphertext", "corpus_text",
    "source_text", "reference_text", "hypothesis", "hypotheses", "candidate",
    "gold", "predicted",
}


def _sql() -> str:
    assert SHARED_TASKS.exists(), f"migration missing: {SHARED_TASKS}"
    return SHARED_TASKS.read_text()


def _parse(sql: str):
    return [raw.stmt for raw in pglast.parse_sql(sql)]


# ---------------------------------------------------------------------------
# Valid PostgreSQL, self-describing, dev-branch-only.
# ---------------------------------------------------------------------------

class TestMigrationParses:
    def test_parses_under_postgres_grammar(self):
        assert len(pglast.parse_sql(_sql())) > 0

    def test_dev_branch_only_and_rollback_documented(self):
        sql = _sql().lower()
        assert "rollback" in sql
        assert ("dev" in sql and "prod" in sql)


# ---------------------------------------------------------------------------
# The thin-umbrella promise: shared_tasks is the ONLY new table, and the only
# ALTER TABLE target is contests (the FK). No per-pair machinery is touched.
# ---------------------------------------------------------------------------

class TestThinUmbrella:
    def test_only_new_table_is_shared_tasks(self):
        created = [s.relation.relname for s in _parse(_sql())
                   if type(s).__name__ == "CreateStmt"]
        assert created == ["shared_tasks"]

    def test_only_altered_table_is_contests(self):
        altered = {s.relation.relname for s in _parse(_sql())
                   if type(s).__name__ == "AlterTableStmt"}
        # RLS-enable on shared_tasks also parses as an AlterTableStmt.
        assert altered <= {"contests", "shared_tasks"}

    def test_no_per_pair_machinery_mentioned_as_ddl_target(self):
        sql = _sql()
        for table in ("qualifiers", "contest_intake", "sealed_sets",
                      "authorization_requests", "auth_grants",
                      "authorization_audit_log", "run_cards", "datasets"):
            assert not re.search(
                rf"(ALTER|CREATE)\s+TABLE[^;]*\b{table}\b", sql,
                re.IGNORECASE), (
                f"047 must not touch {table} — the umbrella changes no "
                f"per-pair machinery (G5)")


# ---------------------------------------------------------------------------
# Content-free (L1) + required shape.
# ---------------------------------------------------------------------------

class TestSharedTasksTable:
    def _columns(self) -> list[str]:
        for s in _parse(_sql()):
            if type(s).__name__ == "CreateStmt" and \
                    s.relation.relname == "shared_tasks":
                return [e.colname for e in (s.tableElts or ())
                        if type(e).__name__ == "ColumnDef"]
        pytest.fail("no CREATE TABLE shared_tasks found")

    def test_no_content_columns(self):
        for col in self._columns():
            low = col.lower()
            assert low not in _FORBIDDEN_CONTENT_COLUMNS, (
                f"shared_tasks.{col} looks like a content column — the "
                f"umbrella is names + year + policy defaults only")
            assert not low.endswith("_text")

    def test_required_columns(self):
        cols = self._columns()
        for c in ("shared_task_id", "name", "organizer", "year",
                  "description", "default_authorization_model",
                  "default_intake_daily_limit", "status"):
            assert c in cols, c

    def test_slug_unique_and_year_bounded(self):
        sql = _sql()
        assert re.search(r"shared_task_id\s+TEXT\s+UNIQUE\s+NOT NULL", sql)
        assert re.search(r"CHECK\s*\(year\s+BETWEEN\s+2000\s+AND\s+9999\)",
                         sql, re.IGNORECASE)

    def test_policy_defaults_failclosed(self):
        sql = _sql()
        m = re.search(
            r"default_authorization_model\s+TEXT\s+NOT NULL\s+DEFAULT\s+"
            r"'per-submission'\s*CHECK\s*\(default_authorization_model\s+IN"
            r"\s*\(([^)]*)\)",
            sql, re.IGNORECASE | re.DOTALL)
        assert m, "default_authorization_model must default per-submission"
        assert set(re.findall(r"'([^']+)'", m.group(1))) == \
            {"per-submission", "blanket", "open"}
        assert re.search(r"default_intake_daily_limit\s+INT\s+NOT NULL\s+"
                         r"DEFAULT\s+\d+", sql, re.IGNORECASE)
        assert re.search(r"CHECK\s*\(default_intake_daily_limit\s*>\s*0\)",
                         sql, re.IGNORECASE)

    def test_status_vocabulary_and_default(self):
        sql = _sql()
        m = re.search(r"status\s+TEXT\s+NOT NULL\s+DEFAULT\s+'active'\s*"
                      r"CHECK\s*\(status\s+IN\s*\(([^)]*)\)",
                      sql, re.IGNORECASE | re.DOTALL)
        assert m
        assert set(re.findall(r"'([^']+)'", m.group(1))) == \
            {"active", "archived"}


# ---------------------------------------------------------------------------
# The FK on contests — nullable membership, indexed for the edition page.
# ---------------------------------------------------------------------------

class TestContestsFk:
    def test_fk_added_idempotently(self):
        stmt = re.search(
            r"ALTER TABLE public\.contests\s+ADD COLUMN IF NOT EXISTS\s+"
            r"shared_task_id[^;]*;",
            _sql(), re.IGNORECASE | re.DOTALL)
        assert stmt, "047 must add contests.shared_task_id idempotently"
        assert re.search(
            r"TEXT\s+REFERENCES\s+public\.shared_tasks\s*\(shared_task_id\)",
            stmt.group(0), re.IGNORECASE | re.DOTALL)
        # Nullable by design — standalone contests keep working untouched.
        assert "NOT NULL" not in stmt.group(0).upper()

    def test_partial_index_for_the_edition_page(self):
        assert re.search(
            r"CREATE INDEX IF NOT EXISTS idx_contests_shared_task\s+"
            r"ON public\.contests\s*\(shared_task_id\)\s*"
            r"WHERE shared_task_id IS NOT NULL",
            _sql(), re.IGNORECASE | re.DOTALL)


# ---------------------------------------------------------------------------
# Identity guard + read-only RLS.
# ---------------------------------------------------------------------------

class TestGuardsAndRls:
    def test_identity_freeze_and_one_way_archive(self):
        sql = _sql()
        assert "reject_illegal_shared_task_mutation" in sql
        assert "BEFORE UPDATE ON public.shared_tasks" in sql
        body = re.search(
            r"CREATE OR REPLACE FUNCTION "
            r"public\.reject_illegal_shared_task_mutation.*?\$\$(.*?)\$\$",
            sql, re.IGNORECASE | re.DOTALL).group(1)
        for col in ("shared_task_id", "year", "created_at"):
            assert re.search(rf"NEW\.{col}\s+IS DISTINCT FROM\s+OLD\.{col}",
                             body), col
        assert re.search(
            r"OLD\.status\s*=\s*'active'\s+AND\s+NEW\.status\s*=\s*'archived'",
            body)

    def test_readonly_rls(self):
        sql = _sql()
        assert "ENABLE ROW LEVEL SECURITY" in sql
        assert "FOR SELECT" in sql
        # Registration is organizer tooling via service_role — no client write.
        assert not re.search(r"CREATE POLICY[^;]*FOR (INSERT|UPDATE|ALL)",
                             sql, re.IGNORECASE | re.DOTALL)


# ---------------------------------------------------------------------------
# Live DB — gated on MT_EVAL_TEST_DB_URL + psycopg + 047 actually applied
# (probed, so the suite stays green on branches where 047 is still pending).
# ---------------------------------------------------------------------------

def _connect():
    dsn = os.environ.get("MT_EVAL_TEST_DB_URL")
    if not dsn:
        return None
    try:
        import psycopg  # type: ignore
        return psycopg.connect(dsn, autocommit=False)
    except ImportError:
        pass
    try:
        import psycopg2  # type: ignore
        return psycopg2.connect(dsn)
    except ImportError:
        return None


_LIVE = _connect()
_live_db = pytest.mark.skipif(
    _LIVE is None,
    reason="set MT_EVAL_TEST_DB_URL (dev/staging branch) + install psycopg "
           "to run live shared-task data-layer tests",
)


def _table_exists(conn) -> bool:
    cur = conn.cursor()
    cur.execute("SELECT to_regclass('public.shared_tasks') IS NOT NULL")
    return bool(cur.fetchone()[0])


@_live_db
class TestSharedTasksLiveDB:
    """One rolled-back transaction; nothing persists on the branch."""

    @pytest.fixture(autouse=True)
    def _tx(self):
        conn = _LIVE
        if not _table_exists(conn):
            conn.rollback()
            pytest.skip("migration 047 not applied to this branch yet")
        cur = conn.cursor()
        self.conn, self.cur = conn, cur
        sfx = uuid.uuid4().hex[:10]
        self.edition_id = f"test-edition-{sfx}"
        self.cur.execute(
            "INSERT INTO shared_tasks (shared_task_id, name, organizer, year)"
            " VALUES (%s,%s,%s,%s)",
            (self.edition_id, "Live umbrella test", "Test Organizing Body",
             2026),
        )
        yield
        conn.rollback()

    def _raises(self, fn):
        self.cur.execute("SAVEPOINT sp")
        try:
            fn()
        except Exception as exc:  # noqa: BLE001 — any DB error == guard fired
            self.cur.execute("ROLLBACK TO SAVEPOINT sp")
            return str(exc)
        self.cur.execute("ROLLBACK TO SAVEPOINT sp")
        pytest.fail("expected the database to reject this operation")

    def test_duplicate_slug_refused(self):
        msg = self._raises(lambda: self.cur.execute(
            "INSERT INTO shared_tasks (shared_task_id, name, organizer, year)"
            " VALUES (%s,%s,%s,%s)",
            (self.edition_id, "Dup", "Dup", 2026)))
        assert "duplicate" in msg.lower() or "unique" in msg.lower()

    def test_identity_frozen(self):
        msg = self._raises(lambda: self.cur.execute(
            "UPDATE shared_tasks SET year=2027 WHERE shared_task_id=%s",
            (self.edition_id,)))
        assert "immutable" in msg.lower()

    def test_archive_is_one_way(self):
        self.cur.execute(
            "UPDATE shared_tasks SET status='archived' WHERE shared_task_id=%s",
            (self.edition_id,))
        msg = self._raises(lambda: self.cur.execute(
            "UPDATE shared_tasks SET status='active' WHERE shared_task_id=%s",
            (self.edition_id,)))
        assert "GUARD" in msg.upper()

    def test_contest_fk_enforced_and_attach_works(self):
        sfx = uuid.uuid4().hex[:8]
        msg = self._raises(lambda: self.cur.execute(
            "INSERT INTO contests (id, name, corpus_id, language_pair,"
            " created_by, shared_task_id) VALUES (%s,%s,%s,%s,%s,%s)",
            (f"test-c-{sfx}", "Bad edition", "c", "qaa>qab",
             "org@example.test", "no-such-edition")))
        assert "foreign key" in msg.lower() or "violates" in msg.lower()
        self.cur.execute(
            "INSERT INTO contests (id, name, corpus_id, language_pair,"
            " created_by, shared_task_id) VALUES (%s,%s,%s,%s,%s,%s)"
            " RETURNING shared_task_id",
            (f"test-c-{sfx}", "Good edition", "c", "qaa>qab",
             "org@example.test", self.edition_id))
        assert self.cur.fetchone()[0] == self.edition_id
