"""Tests for migrations 037–040 — the zero-knowledge sovereign-eval data backbone.

Wave 1 of the sovereign multisig PoC (the sovereign multisig plan,
arena/docs/sandbox-evaluation-spec.md). Four migrations land the data layer:

  037_sealed_sets.sql            — content-free registry of sealed corpora
  038_authorization_requests.sql — the pending-authorization queue state
  039_auth_grants.sql            — single-use, time-boxed, fingerprint-bound grant
  040_authorization_audit_log.sql— append-only, hash-chained audit trail

Two layers of coverage, mirroring tests/test_content_guard_migration.py:

1. OFFLINE (always run): every migration must PARSE under the real PostgreSQL
   grammar (pglast), and carry the structural guarantees the plan requires —
   the content-free invariant (no source/reference/plaintext column on any
   sealed table), the audit-log append-only immutability trigger, the hash
   chain, and the grant's single-use / expiry / fingerprint-binding clauses.

2. LIVE DB (gated on MT_EVAL_TEST_DB_URL + psycopg, migrations applied to a
   dev/staging branch — NEVER prod): assert the DB itself enforces grant
   single-use + expiry + fingerprint-binding, no-grant-without-authorization,
   and audit-log UPDATE/DELETE rejection. Skipped when no DB is configured.

DEV/STAGING ONLY. None of this touches prod; apply 037–040 to a
dev branch only (see the migration headers + README).
"""

from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

pglast = pytest.importorskip(
    "pglast", reason="pip install pglast to validate migration SQL"
)

MIG_DIR = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
)

SEALED = MIG_DIR / "037_sealed_sets.sql"
REQUESTS = MIG_DIR / "038_authorization_requests.sql"
GRANTS = MIG_DIR / "039_auth_grants.sql"
AUDIT = MIG_DIR / "040_authorization_audit_log.sql"

ALL_MIGRATIONS = [SEALED, REQUESTS, GRANTS, AUDIT]

# Column names that would hold corpus CONTENT. The sealed tables must carry NONE
# of these — only metadata (digests, ids, language CODES, flags). `source_lang`
# / `target_lang` (codes) and `ciphertext_digest` (a hash, not the ciphertext)
# are explicitly allowed; anything ending in `_text` is forbidden.
_FORBIDDEN_CONTENT_COLUMNS = {
    "source", "reference", "expected", "target", "plaintext", "cleartext",
    "content", "sentence", "translation", "ciphertext", "corpus_text",
    "source_text", "reference_text", "hypothesis", "candidate", "gold",
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
        # The standing rule: never silently land these on prod.
        assert "rollback" in sql
        assert ("dev" in sql and "prod" in sql)


# ---------------------------------------------------------------------------
# THE content-free invariant (L1). No sealed table may carry a content column.
# This is the executable form of the VERIFY grep "no source/reference content
# columns on the sealed tables".
# ---------------------------------------------------------------------------

class TestContentFree:
    @pytest.mark.parametrize("path", ALL_MIGRATIONS, ids=lambda p: p.name)
    def test_no_content_columns(self, path):
        tables = _table_columns(_sql(path))
        assert tables, f"no CREATE TABLE found in {path.name}"
        for table, cols in tables.items():
            for col in cols:
                low = col.lower()
                assert low not in _FORBIDDEN_CONTENT_COLUMNS, (
                    f"{path.name}: {table}.{col} looks like a corpus-content "
                    f"column — sealed tables must be content-free")
                assert not low.endswith("_text"), (
                    f"{path.name}: {table}.{col} ends in _text — sealed tables "
                    f"must be content-free")

    def test_digest_present_but_no_raw_ciphertext_or_plaintext(self):
        cols = _table_columns(_sql(SEALED))["sealed_sets"]
        assert "ciphertext_digest" in cols          # a hash is allowed
        assert "ciphertext" not in cols              # the blob itself is NOT stored
        assert "plaintext" not in cols


# ---------------------------------------------------------------------------
# 037 sealed_sets — content-free metadata + quarantine-by-default.
# ---------------------------------------------------------------------------

class TestSealedSets:
    def test_required_metadata_columns(self):
        cols = _table_columns(_sql(SEALED))["sealed_sets"]
        for c in ("sealed_set_id", "ciphertext_digest", "custodian_group_id",
                  "current_qualifier_id", "language_pair"):
            assert c in cols, c

    def test_quarantined_defaults_true(self):
        sql = _sql(SEALED)
        assert re.search(r"quarantined\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+true",
                         sql, re.IGNORECASE)

    def test_rls_enabled_no_write_policy(self):
        sql = _sql(SEALED)
        assert "ENABLE ROW LEVEL SECURITY" in sql
        # A read policy exists; no INSERT/UPDATE/ALL write policy is granted.
        assert "FOR SELECT" in sql
        assert not re.search(r"CREATE POLICY[^;]*FOR (INSERT|UPDATE|ALL)",
                             sql, re.IGNORECASE | re.DOTALL)


# ---------------------------------------------------------------------------
# 038 authorization_requests — the pending-authorization state machine.
# ---------------------------------------------------------------------------

class TestAuthorizationRequests:
    def test_state_vocabulary(self):
        sql = _sql(REQUESTS)
        m = re.search(r"state\s+TEXT[^,]*CHECK\s*\(state\s+IN\s*\(([^)]*)\)",
                      sql, re.IGNORECASE | re.DOTALL)
        assert m, "state CHECK not found"
        states = set(re.findall(r"'([^']+)'", m.group(1)))
        assert states == {"pending", "authorized", "denied", "expired"}

    def test_default_state_is_pending(self):
        assert re.search(r"state\s+TEXT\s+NOT NULL\s+DEFAULT\s+'pending'",
                         _sql(REQUESTS), re.IGNORECASE)

    def test_fingerprint_and_components_and_created_at(self):
        cols = _table_columns(_sql(REQUESTS))["authorization_requests"]
        for c in ("fingerprint", "method_sha", "corpus_id", "corpus_version",
                  "node_measurement", "created_at"):
            assert c in cols, c

    def test_emit_pinned_scores_only(self):
        assert re.search(r"emit\s+TEXT[^,]*CHECK\s*\(emit\s*=\s*'scores-only'\)",
                         _sql(REQUESTS), re.IGNORECASE)

    def test_one_way_transition_guard(self):
        sql = _sql(REQUESTS)
        # A BEFORE UPDATE trigger that RAISES on an illegal transition / term edit.
        assert "BEFORE UPDATE ON public.authorization_requests" in sql
        assert "reject_illegal_request_transition" in sql
        assert sql.count("RAISE EXCEPTION") >= 2

    def test_fk_to_sealed_sets(self):
        assert re.search(r"REFERENCES\s+public\.sealed_sets\s*\(sealed_set_id\)",
                         _sql(REQUESTS))


# ---------------------------------------------------------------------------
# 039 auth_grants — single-use, time-boxed, fingerprint-bound.
# ---------------------------------------------------------------------------

class TestAuthGrants:
    def test_columns(self):
        cols = _table_columns(_sql(GRANTS))["auth_grants"]
        for c in ("grant_id", "request_id", "sealed_set_id", "fingerprint",
                  "expires_at", "used"):
            assert c in cols, c

    def test_used_defaults_false(self):
        assert re.search(r"used\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+false",
                         _sql(GRANTS), re.IGNORECASE)

    def test_expiry_in_future_constraint(self):
        assert re.search(r"CHECK\s*\(expires_at\s*>\s*created_at\)",
                         _sql(GRANTS), re.IGNORECASE)

    def test_claim_is_single_use_expiry_and_fingerprint_bound(self):
        """claim_auth_grant flips used true in the SAME update that asserts
        unused + unexpired + fingerprint-match — the three data-layer guarantees."""
        sql = _sql(GRANTS)
        m = re.search(r"CREATE OR REPLACE FUNCTION public\.claim_auth_grant.*?\$\$(.*?)\$\$",
                      sql, re.IGNORECASE | re.DOTALL)
        assert m, "claim_auth_grant body not found"
        body = m.group(1)
        assert re.search(r"SET[\s\S]*used\s*=\s*true", body)        # consumes
        assert re.search(r"used\s*=\s*false", body)                  # single-use guard
        assert re.search(r"expires_at\s*>\s*NOW\(\)", body, re.IGNORECASE)  # time-box
        assert re.search(r"fingerprint\s*=\s*p_fingerprint", body)   # target binding

    def test_no_grant_without_authorization(self):
        """The bind trigger refuses a grant unless the request is 'authorized'
        with a matching fingerprint — the data-layer 'no grant without M-of-N'."""
        sql = _sql(GRANTS)
        assert "auth_grant_bind_check" in sql
        assert "BEFORE INSERT OR UPDATE ON public.auth_grants" in sql
        assert re.search(r"<>\s*'authorized'", sql) or "not authorized" in sql.lower()
        # Un-using a consumed grant is rejected (single-use is one-way).
        assert re.search(r"OLD\.used\s+AND\s+NOT\s+NEW\.used", sql)

    def test_claim_is_service_role_only(self):
        sql = _sql(GRANTS)
        assert re.search(r"REVOKE ALL ON FUNCTION public\.claim_auth_grant.*FROM PUBLIC",
                         sql, re.DOTALL)
        assert re.search(r"GRANT EXECUTE ON FUNCTION public\.claim_auth_grant.*TO service_role",
                         sql, re.DOTALL)
        # No anon/authenticated read or write policy on the capability table.
        assert "ENABLE ROW LEVEL SECURITY" in sql
        assert "TO anon" not in sql


# ---------------------------------------------------------------------------
# 040 authorization_audit_log — append-only, hash-chained.
# ---------------------------------------------------------------------------

class TestAuditLog:
    def test_hash_chain_columns(self):
        cols = _table_columns(_sql(AUDIT))["authorization_audit_log"]
        assert "prev_hash" in cols
        assert "row_hash" in cols

    def test_append_only_immutability_trigger(self):
        """A BEFORE UPDATE OR DELETE trigger that RAISES — mirrors migration 033."""
        sql = _sql(AUDIT)
        assert "BEFORE UPDATE OR DELETE ON public.authorization_audit_log" in sql
        assert "reject_audit_log_mutation" in sql
        m = re.search(
            r"CREATE OR REPLACE FUNCTION public\.reject_audit_log_mutation.*?\$\$(.*?)\$\$",
            sql, re.IGNORECASE | re.DOTALL)
        assert m and "RAISE EXCEPTION" in m.group(1)
        assert "append-only" in sql.lower()

    def test_hash_chain_trigger_uses_core_sha256(self):
        sql = _sql(AUDIT)
        assert "BEFORE INSERT ON public.authorization_audit_log" in sql
        assert "authorization_audit_chain" in sql
        # Core PostgreSQL sha256(bytea) — no pgcrypto/extension dependency.
        assert "sha256(convert_to(" in sql
        assert "CREATE EXTENSION" not in sql
        # prev_hash is set from the prior row's row_hash (the chain link).
        assert "NEW.prev_hash" in sql and "row_hash" in sql

    def test_publishable_head_digest(self):
        sql = _sql(AUDIT)
        assert "authorization_audit_head" in sql
        assert re.search(r"GRANT EXECUTE ON FUNCTION public\.authorization_audit_head.*TO anon",
                         sql, re.DOTALL)

    def test_community_inspectable_read(self):
        sql = _sql(AUDIT)
        assert "ENABLE ROW LEVEL SECURITY" in sql
        assert "FOR SELECT" in sql and "TO anon" in sql


# ---------------------------------------------------------------------------
# Live DB — gated on MT_EVAL_TEST_DB_URL + psycopg, migrations 037–040 applied
# to a dev/staging branch. Proves the DATABASE enforces the guarantees, not just
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
    reason="set MT_EVAL_TEST_DB_URL (dev/staging branch, 037–040 applied) + "
           "install psycopg to run live sovereign-eval data-layer tests",
)


@_live_db
class TestSovereignDataLayerLiveDB:
    """One rolled-back transaction; nothing persists on the branch."""

    @pytest.fixture(autouse=True)
    def _tx(self):
        conn = _LIVE
        cur = conn.cursor()
        self.conn, self.cur = conn, cur
        sfx = uuid.uuid4().hex[:10]
        self.set_id = f"sealed-{sfx}"
        self.req_auth = f"authreq-auth-{sfx}"
        self.req_pending = f"authreq-pending-{sfx}"
        self.fp = uuid.uuid4().hex  # any stable fingerprint value for the test
        self._seed()
        yield
        conn.rollback()

    def _seed(self):
        self.cur.execute(
            "INSERT INTO sealed_sets (sealed_set_id, ciphertext_digest,"
            " custodian_group_id, source_lang, target_lang, language_pair)"
            " VALUES (%s,%s,%s,%s,%s,%s)",
            (self.set_id, "deadbeef", "grp-test", "eng", "crk", "eng>crk"),
        )
        # An AUTHORIZED request (eligible to mint a grant) ...
        self.cur.execute(
            "INSERT INTO authorization_requests (request_id, sealed_set_id,"
            " state, fingerprint, method_sha, corpus_id, corpus_version,"
            " node_measurement) VALUES (%s,%s,'authorized',%s,%s,%s,%s,%s)",
            (self.req_auth, self.set_id, self.fp, "msha", self.set_id, "v1",
             "node-x"),
        )
        # ... and a still-PENDING request (must NOT be able to mint a grant).
        self.cur.execute(
            "INSERT INTO authorization_requests (request_id, sealed_set_id,"
            " state, fingerprint, method_sha, corpus_id, corpus_version,"
            " node_measurement) VALUES (%s,%s,'pending',%s,%s,%s,%s,%s)",
            (self.req_pending, self.set_id, self.fp, "msha", self.set_id, "v1",
             "node-x"),
        )

    def _mint_grant(self, grant_id, request_id, fingerprint, expires_at):
        self.cur.execute(
            "INSERT INTO auth_grants (grant_id, request_id, sealed_set_id,"
            " fingerprint, expires_at) VALUES (%s,%s,%s,%s,%s)",
            (grant_id, request_id, self.set_id, fingerprint, expires_at),
        )

    def _raises(self, fn):
        self.cur.execute("SAVEPOINT sp")
        try:
            fn()
        except Exception as exc:  # noqa: BLE001 — any DB error == guard fired
            self.cur.execute("ROLLBACK TO SAVEPOINT sp")
            return str(exc)
        self.cur.execute("ROLLBACK TO SAVEPOINT sp")
        pytest.fail("expected the database to reject this operation")

    def test_no_grant_for_pending_request(self):
        future = datetime.now(timezone.utc) + timedelta(hours=1)
        msg = self._raises(
            lambda: self._mint_grant(f"g-{uuid.uuid4().hex[:8]}",
                                     self.req_pending, self.fp, future))
        assert "GUARD" in msg.upper()

    def test_grant_fingerprint_binding(self):
        future = datetime.now(timezone.utc) + timedelta(hours=1)
        msg = self._raises(
            lambda: self._mint_grant(f"g-{uuid.uuid4().hex[:8]}",
                                     self.req_auth, "WRONG", future))
        assert "GUARD" in msg.upper()

    def test_grant_single_use(self):
        gid = f"g-{uuid.uuid4().hex[:8]}"
        future = datetime.now(timezone.utc) + timedelta(hours=1)
        self._mint_grant(gid, self.req_auth, self.fp, future)
        self.cur.execute("SELECT grant_id FROM claim_auth_grant(%s,%s,%s)",
                         (gid, self.fp, "node-x"))
        assert self.cur.fetchall(), "first claim should succeed"
        self.cur.execute("SELECT grant_id FROM claim_auth_grant(%s,%s,%s)",
                         (gid, self.fp, "node-x"))
        assert not self.cur.fetchall(), "second claim must return no row"

    def test_grant_fingerprint_mismatch_claim_refused(self):
        gid = f"g-{uuid.uuid4().hex[:8]}"
        future = datetime.now(timezone.utc) + timedelta(hours=1)
        self._mint_grant(gid, self.req_auth, self.fp, future)
        self.cur.execute("SELECT grant_id FROM claim_auth_grant(%s,%s,%s)",
                         (gid, "WRONG", "node-x"))
        assert not self.cur.fetchall()

    def test_audit_log_is_append_only(self):
        self.cur.execute(
            "INSERT INTO authorization_audit_log (event_type, sealed_set_id,"
            " request_id) VALUES ('request_created',%s,%s) RETURNING id",
            (self.set_id, self.req_auth),
        )
        rid = self.cur.fetchone()[0]
        upd = self._raises(
            lambda: self.cur.execute(
                "UPDATE authorization_audit_log SET actor='x' WHERE id=%s",
                (rid,)))
        assert "APPEND-ONLY" in upd.upper()
        dele = self._raises(
            lambda: self.cur.execute(
                "DELETE FROM authorization_audit_log WHERE id=%s", (rid,)))
        assert "APPEND-ONLY" in dele.upper()

    def test_audit_log_hash_chains(self):
        self.cur.execute(
            "INSERT INTO authorization_audit_log (event_type, sealed_set_id)"
            " VALUES ('request_created',%s) RETURNING row_hash", (self.set_id,))
        h1 = self.cur.fetchone()[0]
        self.cur.execute(
            "INSERT INTO authorization_audit_log (event_type, sealed_set_id)"
            " VALUES ('grant_minted',%s) RETURNING prev_hash, row_hash",
            (self.set_id,))
        prev2, h2 = self.cur.fetchone()
        assert prev2 == h1, "row 2 must chain to row 1's row_hash"
        assert h2 and h2 != h1
        self.cur.execute("SELECT authorization_audit_head()")
        assert self.cur.fetchone()[0] == h2
