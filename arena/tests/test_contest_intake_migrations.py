"""Tests for migrations 042–044 — the organizer-node contest intake backbone.

Phase A of the sovereign contest scoring node (docs/ORGANIZER_NODE_RUNBOOK.md).
Three migrations land the data layer:

  042_qualifiers.sql             — the public dev-set gate paired to a sealed set
  043_contest_intake.sql         — hypotheses-submission queue + contest policy
  044_contest_intake_storage.sql — private bucket for participant bundles

Two layers of coverage, mirroring tests/test_sovereign_authorization_migrations.py:

1. OFFLINE (always run): every migration must PARSE under the real PostgreSQL
   grammar (pglast) and carry the structural guarantees Phase A requires — the
   content-free invariant (digests only, never hypotheses/reference text), the
   one-way intake lifecycle, frozen submission identity, rejected-requires-
   reason, the qualifier terms freeze + one-active-per-set invariant, the
   fail-closed authorization_model default, and the immutable private bucket.

2. LIVE DB (gated on MT_EVAL_TEST_DB_URL + psycopg, migrations applied to a
   dev/staging branch — NEVER prod): assert the DB itself enforces the intake
   lifecycle, the rate limit, and dedup. Skipped when no DB is configured.

DEV/STAGING ONLY. Apply 042–044 to a dev branch only (see migration headers).
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

QUALIFIERS = MIG_DIR / "042_qualifiers.sql"
INTAKE = MIG_DIR / "043_contest_intake.sql"
STORAGE = MIG_DIR / "044_contest_intake_storage.sql"

ALL_MIGRATIONS = [QUALIFIERS, INTAKE, STORAGE]

# Column names that would hold corpus or submission CONTENT. The intake tables
# must carry NONE of these — digests (`*_sha256`), ids, paths, and lifecycle
# only. The hypothesis BYTES live in the private storage bucket; the secret
# REFERENCES never leave the organizer's machine at all.
_FORBIDDEN_CONTENT_COLUMNS = {
    "source", "reference", "expected", "target", "plaintext", "cleartext",
    "content", "sentence", "translation", "ciphertext", "corpus_text",
    "source_text", "reference_text", "hypothesis", "hypotheses", "candidate",
    "gold", "predicted",
}


def _sql(path: Path) -> str:
    assert path.exists(), f"migration missing: {path}"
    return path.read_text()


def _table_columns(sql: str) -> dict[str, list[str]]:
    """Map {table_name: [column_name, ...]} for every CREATE TABLE in `sql`,
    via the pglast parse tree (not a regex) — so this reflects the real DDL."""
    out: dict[str, list[str]] = {}
    for raw in pglast.parse_sql(sql):
        stmt = raw.stmt
        if type(stmt).__name__ != "CreateStmt":
            continue
        relname = stmt.relation.relname
        cols: list[str] = []
        for elt in (stmt.tableElts or ()):
            if type(elt).__name__ == "ColumnDef" and getattr(elt, "colname", None):
                cols.append(elt.colname)
        out[relname] = cols
    return out


# ---------------------------------------------------------------------------
# Every migration is valid PostgreSQL and self-describing.
# ---------------------------------------------------------------------------

class TestMigrationsParse:
    @pytest.mark.parametrize("path", ALL_MIGRATIONS, ids=lambda p: p.name)
    def test_parses_under_postgres_grammar(self, path):
        stmts = pglast.parse_sql(_sql(path))
        assert len(stmts) > 0

    @pytest.mark.parametrize("path", ALL_MIGRATIONS, ids=lambda p: p.name)
    def test_dev_branch_only_and_rollback_documented(self, path):
        sql = _sql(path).lower()
        assert "rollback" in sql
        assert ("dev" in sql and "prod" in sql)


# ---------------------------------------------------------------------------
# Content-free invariant (L1): digests + lifecycle only, never text.
# ---------------------------------------------------------------------------

class TestContentFree:
    @pytest.mark.parametrize("path", [QUALIFIERS, INTAKE], ids=lambda p: p.name)
    def test_no_content_columns(self, path):
        tables = _table_columns(_sql(path))
        assert tables, f"no CREATE TABLE found in {path.name}"
        for table, cols in tables.items():
            for col in cols:
                low = col.lower()
                assert low not in _FORBIDDEN_CONTENT_COLUMNS, (
                    f"{path.name}: {table}.{col} looks like a content column — "
                    f"intake tables are digests + lifecycle only")
                assert not low.endswith("_text"), (
                    f"{path.name}: {table}.{col} ends in _text — intake tables "
                    f"must be content-free")

    def test_intake_stores_digests_not_bytes(self):
        cols = _table_columns(_sql(INTAKE))["contest_intake"]
        assert "dev_hyp_sha256" in cols
        assert "test_hyp_sha256" in cols
        assert "storage_path" in cols          # a POINTER to the private bucket
        # No column could plausibly carry the bundle itself.
        assert not any("blob" in c or "bytes" in c or "data" == c for c in cols)


# ---------------------------------------------------------------------------
# 042 qualifiers — the threshold is data; rotation is freeze-and-insert.
# ---------------------------------------------------------------------------

class TestQualifiers:
    def test_required_columns(self):
        cols = _table_columns(_sql(QUALIFIERS))["qualifiers"]
        for c in ("qualifier_id", "corpus_card_id", "sealed_set_id",
                  "threshold", "metric", "year", "status"):
            assert c in cols, c

    def test_threshold_required_and_positive_no_value_default(self):
        sql = _sql(QUALIFIERS)
        assert re.search(r"threshold\s+NUMERIC\s+NOT NULL", sql, re.IGNORECASE)
        assert re.search(r"CHECK\s*\(threshold\s*>\s*0\)", sql, re.IGNORECASE)
        # The threshold is calibrated per contest — the DB must never invent one.
        assert not re.search(r"threshold\s+NUMERIC[^,]*DEFAULT\s+\d",
                             sql, re.IGNORECASE)

    def test_status_vocabulary_and_default(self):
        sql = _sql(QUALIFIERS)
        m = re.search(r"status\s+TEXT[^,]*CHECK\s*\(status\s+IN\s*\(([^)]*)\)",
                      sql, re.IGNORECASE | re.DOTALL)
        assert m
        assert set(re.findall(r"'([^']+)'", m.group(1))) == {"active", "frozen"}
        assert re.search(r"status\s+TEXT\s+NOT NULL\s+DEFAULT\s+'active'",
                         sql, re.IGNORECASE)

    def test_one_active_qualifier_per_sealed_set(self):
        sql = _sql(QUALIFIERS)
        assert re.search(
            r"CREATE UNIQUE INDEX[^;]*ON public\.qualifiers\s*\(sealed_set_id\)"
            r"[^;]*WHERE[^;]*status\s*=\s*'active'",
            sql, re.IGNORECASE | re.DOTALL)

    def test_terms_freeze_and_one_way_status(self):
        sql = _sql(QUALIFIERS)
        assert "BEFORE UPDATE ON public.qualifiers" in sql
        assert "reject_illegal_qualifier_mutation" in sql
        # Threshold is among the frozen terms (no mid-contest rug pulls).
        assert re.search(r"NEW\.threshold\s+IS DISTINCT FROM\s+OLD\.threshold", sql)
        # active -> frozen is the only status move.
        assert re.search(r"OLD\.status\s*=\s*'active'\s+AND\s+NEW\.status\s*=\s*'frozen'",
                         sql)

    def test_fk_to_sealed_sets_and_readonly_rls(self):
        sql = _sql(QUALIFIERS)
        assert re.search(r"REFERENCES\s+public\.sealed_sets\s*\(sealed_set_id\)", sql)
        assert "ENABLE ROW LEVEL SECURITY" in sql
        assert "FOR SELECT" in sql
        assert not re.search(r"CREATE POLICY[^;]*FOR (INSERT|UPDATE|ALL)",
                             sql, re.IGNORECASE | re.DOTALL)


# ---------------------------------------------------------------------------
# 043 contest_intake — policy columns + one-way lifecycle + anti-gaming.
# ---------------------------------------------------------------------------

class TestContestPolicy:
    def test_authorization_model_vocabulary_and_failclosed_default(self):
        sql = _sql(INTAKE)
        m = re.search(
            r"authorization_model\s+TEXT\s+NOT NULL\s+DEFAULT\s+'per-submission'\s*"
            r"CHECK\s*\(authorization_model\s+IN\s*\(([^)]*)\)",
            sql, re.IGNORECASE | re.DOTALL)
        assert m, "authorization_model must default to per-submission (fail-closed)"
        assert set(re.findall(r"'([^']+)'", m.group(1))) == \
            {"per-submission", "blanket", "open"}

    def test_intake_closed_by_default_with_positive_rate_limit(self):
        sql = _sql(INTAKE)
        assert re.search(r"intake_open\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+false",
                         sql, re.IGNORECASE)
        assert re.search(r"intake_daily_limit\s+INT\s+NOT NULL\s+DEFAULT\s+\d+",
                         sql, re.IGNORECASE)
        assert re.search(r"CHECK\s*\(intake_daily_limit\s*>\s*0\)",
                         sql, re.IGNORECASE)


class TestContestIntakeLifecycle:
    def test_status_vocabulary(self):
        sql = _sql(INTAKE)
        m = re.search(r"status\s+TEXT\s+NOT NULL\s+DEFAULT\s+'received'\s*"
                      r"CHECK\s*\(status\s+IN\s*\(([^)]*)\)",
                      sql, re.IGNORECASE | re.DOTALL)
        assert m
        assert set(re.findall(r"'([^']+)'", m.group(1))) == {
            "received", "qualifier_checked", "pending_authorization",
            "scoring", "scored", "published", "rejected"}

    def test_dedup_unique_on_test_hypotheses_sha(self):
        assert re.search(r"UNIQUE\s*\(contest_id,\s*test_hyp_sha256\)",
                         _sql(INTAKE), re.IGNORECASE)

    def test_admission_guard_checks_open_and_rate_limit(self):
        sql = _sql(INTAKE)
        assert "contest_intake_admission_check" in sql
        assert re.search(r"BEFORE INSERT ON public\.contest_intake", sql)
        body = re.search(
            r"CREATE OR REPLACE FUNCTION public\.contest_intake_admission_check.*?\$\$(.*?)\$\$",
            sql, re.IGNORECASE | re.DOTALL).group(1)
        assert "intake_open" in body
        assert "intake_daily_limit" in body
        assert re.search(r"INTERVAL\s+'24 hours'", body, re.IGNORECASE)
        # Born received, with no node-written evidence fields.
        assert re.search(r"NEW\.status\s*<>\s*'received'", body)
        assert "run_card_id" in body

    def test_transition_guard_one_way_and_frozen_identity(self):
        sql = _sql(INTAKE)
        assert "reject_illegal_intake_transition" in sql
        assert re.search(r"BEFORE UPDATE ON public\.contest_intake", sql)
        body = re.search(
            r"CREATE OR REPLACE FUNCTION public\.reject_illegal_intake_transition.*?\$\$(.*?)\$\$",
            sql, re.IGNORECASE | re.DOTALL).group(1)
        # Frozen identity: digests + storage path can never be swapped.
        for col in ("dev_hyp_sha256", "test_hyp_sha256", "storage_path",
                    "submitted_by", "contest_id"):
            assert re.search(rf"NEW\.{col}\s+IS DISTINCT FROM\s+OLD\.{col}", body), col
        # The forward path exists and terminal states are terminal.
        assert re.search(r"'received'\s+AND\s+NEW\.status\s*=\s*'qualifier_checked'", body)
        assert re.search(r"'scored'\s+AND\s+NEW\.status\s*=\s*'published'", body)
        assert "NOT IN ('published', 'rejected')" in body

    def test_rejection_requires_reason(self):
        body = re.search(
            r"CREATE OR REPLACE FUNCTION public\.reject_illegal_intake_transition.*?\$\$(.*?)\$\$",
            _sql(INTAKE), re.IGNORECASE | re.DOTALL).group(1)
        assert re.search(r"reject_reason\s+IS NULL", body)
        assert "silent" in body.lower()  # the no-silent-drops rule, stated

    def test_rls_insert_bound_to_jwt_no_client_update(self):
        sql = _sql(INTAKE)
        assert "ENABLE ROW LEVEL SECURITY" in sql
        m = re.search(r"CREATE POLICY contest_intake_submit.*?WITH CHECK\s*\((.*?)\);",
                      sql, re.IGNORECASE | re.DOTALL)
        assert m and "submitted_by" in m.group(1) and "email" in m.group(1)
        # Lifecycle transitions belong to the organizer node (service_role):
        # no anon/authenticated UPDATE policy exists.
        assert not re.search(r"CREATE POLICY[^;]*FOR UPDATE",
                             sql, re.IGNORECASE | re.DOTALL)


# ---------------------------------------------------------------------------
# 044 storage — private bucket, own-folder only, immutable + retained.
# ---------------------------------------------------------------------------

class TestIntakeStorage:
    def test_bucket_is_private_and_stays_private_on_rerun(self):
        sql = _sql(STORAGE)
        assert re.search(r"INSERT INTO storage\.buckets[^;]*false", sql,
                         re.IGNORECASE | re.DOTALL)
        # Idempotent re-run must never flip the bucket public.
        assert re.search(r"ON CONFLICT\s*\(id\)\s*DO UPDATE SET public\s*=\s*false",
                         sql, re.IGNORECASE)

    def test_own_folder_upload_and_read_only(self):
        sql = _sql(STORAGE)
        for policy in ("contest_intake_upload_own_folder",
                       "contest_intake_read_own_folder"):
            assert policy in sql
        # Both policies bind the second path segment to the JWT email.
        assert sql.count("storage.foldername(name))[2]") >= 2
        assert "email" in sql

    def test_immutable_no_update_or_delete_policies(self):
        sql = _sql(STORAGE)
        assert not re.search(r"CREATE POLICY[^;]*FOR (UPDATE|DELETE)",
                             sql, re.IGNORECASE | re.DOTALL)
        # Retention is a recorded decision, not an accident.
        assert "retained" in sql.lower()


# ---------------------------------------------------------------------------
# Live DB — gated on MT_EVAL_TEST_DB_URL + psycopg, migrations 037–044 applied
# to a dev/staging branch. Proves the DATABASE enforces the lifecycle, not just
# that the SQL is shaped right. Skipped otherwise.
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
    reason="set MT_EVAL_TEST_DB_URL (dev/staging branch, 037–044 applied) + "
           "install psycopg to run live contest-intake data-layer tests",
)


@_live_db
class TestContestIntakeLiveDB:
    """One rolled-back transaction; nothing persists on the branch."""

    @pytest.fixture(autouse=True)
    def _tx(self):
        conn = _LIVE
        cur = conn.cursor()
        self.conn, self.cur = conn, cur
        sfx = uuid.uuid4().hex[:10]
        self.contest_id = f"test-intake-{sfx}"
        self.corpus_id = f"test-corpus-{sfx}"
        self._seed()
        yield
        conn.rollback()

    def _seed(self):
        self.cur.execute(
            "INSERT INTO contests (id, name, corpus_id, language_pair,"
            " created_by, intake_open, intake_daily_limit)"
            " VALUES (%s,%s,%s,%s,%s,true,2)",
            (self.contest_id, "Intake live test", self.corpus_id,
             "eng>xxx", "organizer@example.test"),
        )

    def _submit(self, sfx=None, test_sha=None):
        sfx = sfx or uuid.uuid4().hex[:8]
        self.cur.execute(
            "INSERT INTO contest_intake (intake_id, contest_id, submitted_by,"
            " dev_hyp_sha256, test_hyp_sha256, storage_path)"
            " VALUES (%s,%s,%s,%s,%s,%s) RETURNING intake_id",
            (f"intake-{sfx}", self.contest_id, "participant@example.test",
             f"dev{sfx}", test_sha or f"test{sfx}",
             f"{self.contest_id}/participant@example.test/intake-{sfx}.tar.gz"),
        )
        return self.cur.fetchone()[0]

    def _raises(self, fn):
        self.cur.execute("SAVEPOINT sp")
        try:
            fn()
        except Exception as exc:  # noqa: BLE001 — any DB error == guard fired
            self.cur.execute("ROLLBACK TO SAVEPOINT sp")
            return str(exc)
        self.cur.execute("ROLLBACK TO SAVEPOINT sp")
        pytest.fail("expected the database to reject this operation")

    def test_lifecycle_forward_only(self):
        iid = self._submit()
        self.cur.execute(
            "UPDATE contest_intake SET status='qualifier_checked',"
            " qualifier_score=42 WHERE intake_id=%s", (iid,))
        # Rewinding is rejected.
        msg = self._raises(lambda: self.cur.execute(
            "UPDATE contest_intake SET status='received' WHERE intake_id=%s",
            (iid,)))
        assert "GUARD" in msg.upper()

    def test_rejection_requires_reason(self):
        iid = self._submit()
        msg = self._raises(lambda: self.cur.execute(
            "UPDATE contest_intake SET status='rejected' WHERE intake_id=%s",
            (iid,)))
        assert "reject_reason" in msg

    def test_digests_frozen(self):
        iid = self._submit()
        msg = self._raises(lambda: self.cur.execute(
            "UPDATE contest_intake SET test_hyp_sha256='swapped'"
            " WHERE intake_id=%s", (iid,)))
        assert "immutable" in msg.lower()

    def test_dedup_identical_test_hypotheses(self):
        self._submit(test_sha="same-bytes")
        msg = self._raises(lambda: self._submit(test_sha="same-bytes"))
        assert "duplicate" in msg.lower() or "dedup" in msg.lower()

    def test_daily_rate_limit(self):
        self._submit()
        self._submit()  # limit seeded as 2
        msg = self._raises(lambda: self._submit())
        assert "limit" in msg.lower()

    def test_intake_closed_contest_refused(self):
        self.cur.execute("UPDATE contests SET intake_open=false WHERE id=%s",
                         (self.contest_id,))
        msg = self._raises(lambda: self._submit())
        assert "intake" in msg.lower()
