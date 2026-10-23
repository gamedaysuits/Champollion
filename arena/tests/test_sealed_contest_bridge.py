"""Tests for migration 041 + contest.py — the sealed-contest bridge.

Before the bridge, contests and sealed sets were mutually exclusive: sealed
sets are quarantined by default (migration 037) and contest eligibility
hard-blocks quarantined corpora in every lane (migration 035 +
license_use.contest_dataset_eligible). Migration 041 carves out ONE explicit
'sealed' lane: a contest whose corpus_id references a registered, active
sealed_sets row is eligible, and execution defers entirely to the 038/039
custodian authorization path (audited by 040). Nothing else loosens —
migration 022's quarantine guard is untouched.

Two layers of coverage, mirroring tests/test_sovereign_authorization_migrations.py:

1. OFFLINE (always run): migration 041 must PARSE under the real PostgreSQL
   grammar (pglast) and carry the structural guarantees — the lane column and
   its vocabulary, the fail-closed sealed-registration requirement, the
   standard-lane refusals (sealed set / quarantined / known-improper backstop),
   NO redefinition of migration 022's reject_quarantined_datasets(), and no
   content columns. Plus the contest.py client mirror: sealed contest requires
   a sealed_sets registration; anything else quarantined still refuses.

2. LIVE DB (gated on MT_EVAL_TEST_DB_URL + psycopg, migrations 037–041 applied
   to a dev/staging branch — NEVER prod): assert the DATABASE enforces the lane
   rules beneath every client. Skipped when no DB is configured.

DEV/STAGING ONLY. None of this touches prod; apply 041 to a dev branch only
(see the migration header + README).
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

BRIDGE = MIG_DIR / "041_sealed_contest_bridge.sql"
QUARANTINE = MIG_DIR / "022_quarantine_corpus_guard.sql"

# Migration 022's known-improper slice backstop — 041 must carry it VERBATIM so
# the two guards never drift apart on the known-bad ids.
_022_BACKSTOP = r"(-quarantined|sample[-_]?62|phase1[-_]?test|dev[-_]?124|crk[-_]?master)"


def _sql(path: Path) -> str:
    assert path.exists(), f"migration missing: {path}"
    return path.read_text()


# ---------------------------------------------------------------------------
# The migration is valid PostgreSQL and self-describing.
# ---------------------------------------------------------------------------

class TestMigrationParses:
    def test_parses_under_postgres_grammar(self):
        stmts = pglast.parse_sql(_sql(BRIDGE))
        assert len(stmts) > 0

    def test_dev_branch_only_and_rollback_documented(self):
        sql = _sql(BRIDGE).lower()
        assert "rollback" in sql
        assert ("dev" in sql and "prod" in sql)

    def test_idempotent_ddl(self):
        sql = _sql(BRIDGE)
        assert "ADD COLUMN IF NOT EXISTS" in sql
        assert "CREATE OR REPLACE FUNCTION" in sql
        assert "DROP TRIGGER IF EXISTS" in sql


# ---------------------------------------------------------------------------
# The lane column — explicit, defaulted safe, closed vocabulary.
# ---------------------------------------------------------------------------

class TestLaneColumn:
    def test_lane_defaults_standard(self):
        assert re.search(
            r"lane\s+TEXT\s+NOT NULL\s+DEFAULT\s+'standard'",
            _sql(BRIDGE), re.IGNORECASE)

    def test_lane_vocabulary_is_standard_or_sealed(self):
        m = re.search(r"CHECK\s*\(lane\s+IN\s*\(([^)]*)\)",
                      _sql(BRIDGE), re.IGNORECASE)
        assert m, "lane CHECK not found"
        lanes = set(re.findall(r"'([^']+)'", m.group(1)))
        assert lanes == {"standard", "sealed"}

    def test_no_content_columns_introduced(self):
        """041 adds a flag column and a trigger — never a table or content."""
        for raw in pglast.parse_sql(_sql(BRIDGE)):
            assert type(raw.stmt).__name__ != "CreateStmt", (
                "041 must not create tables")


# ---------------------------------------------------------------------------
# The guard — sealed lane fail-closed; standard lane refusals; 022 untouched.
# ---------------------------------------------------------------------------

class TestContestCorpusGuard:
    def test_trigger_wired_before_insert_or_update(self):
        sql = _sql(BRIDGE)
        assert "contest_corpus_guard" in sql
        assert "BEFORE INSERT OR UPDATE ON public.contests" in sql

    def test_sealed_lane_requires_registered_active_sealed_set(self):
        """Fail-closed: no sealed_sets row → RAISE; non-active row → RAISE."""
        sql = _sql(BRIDGE)
        assert "FROM public.sealed_sets" in sql
        assert re.search(r"IF\s+v_sealed_status\s+IS\s+NULL\s+THEN", sql)
        assert re.search(r"<>\s*'active'", sql)
        # At least: missing registration, non-active, sealed-in-standard,
        # quarantined, and the backstop each RAISE.
        assert sql.count("RAISE EXCEPTION") >= 5

    def test_sealed_contest_defers_to_authorization_path(self):
        """The carve-out is an eligibility rule, not an access grant — the
        migration must say (and do) nothing that touches grants or keys, and
        must name the 038/039 deferral."""
        sql = _sql(BRIDGE)
        assert "038" in sql and "039" in sql
        for forbidden in ("claim_auth_grant", "auth_grants", "INSERT INTO"):
            assert forbidden not in sql, (
                f"041 must not touch the grant machinery ({forbidden})")

    def test_standard_lane_refuses_sealed_sets(self):
        sql = _sql(BRIDGE)
        assert re.search(
            r"IF\s+v_sealed_status\s+IS\s+NOT\s+NULL\s+THEN", sql), (
            "standard lane must refuse a registered sealed set")

    def test_standard_lane_refuses_quarantined_datasets(self):
        sql = _sql(BRIDGE)
        assert re.search(r"FROM\s+public\.datasets", sql)
        assert re.search(r"d\.quarantined", sql)

    def test_backstop_regex_matches_022_verbatim(self):
        """The known-improper slice-id regex must be byte-identical to 022's,
        and 022 must actually still contain it (no silent drift)."""
        assert _022_BACKSTOP in _sql(BRIDGE)
        assert _022_BACKSTOP in _sql(QUARANTINE)

    def test_migration_022_guard_is_not_weakened(self):
        """041 must NOT redefine, drop, or re-trigger 022's machinery — the
        run_cards quarantine guard stays exactly as migration 022 wrote it.
        Checked on the pglast parse tree (comments may NAME 022's objects; the
        DDL must never TOUCH them)."""
        for raw in pglast.parse_sql(_sql(BRIDGE)):
            stmt = raw.stmt
            kind = type(stmt).__name__
            if kind == "CreateFunctionStmt":
                names = [n.sval for n in stmt.funcname]
                assert "reject_quarantined_datasets" not in names
            elif kind == "CreateTrigStmt":
                assert stmt.relation.relname != "run_cards"
                assert stmt.trigname != "run_cards_quarantine_guard"
            elif kind == "DropStmt":
                flat = str(stmt.objects)
                assert "reject_quarantined_datasets" not in flat
                assert "run_cards_quarantine_guard" not in flat
        # And 022 itself still carries its trigger (belt-and-suspenders).
        q = _sql(QUARANTINE)
        assert "reject_quarantined_datasets" in q
        assert "run_cards_quarantine_guard" in q


# ---------------------------------------------------------------------------
# contest.py — the client-side mirror. All offline: every network-touching
# collaborator is monkeypatched.
# ---------------------------------------------------------------------------

@pytest.fixture()
def contest_mod(monkeypatch):
    import mt_eval_harness.contest as contest
    import mt_eval_harness.auth as auth
    import mt_eval_harness.license_use as license_use

    # Never talk to Supabase / the auth flow in these tests. The fake session
    # carries an email claim: create_contest binds the JWT email (052).
    monkeypatch.setattr(
        contest, "get_session",
        lambda: {"access_token": "t", "user": {"email": "tester@example.org"}})
    monkeypatch.setattr(
        auth, "get_submitter_email", lambda session: "tester@example.org")
    monkeypatch.setattr(
        contest, "_api_request",
        lambda *a, **k: pytest.fail("unexpected API call"), raising=True)
    # Standard-lane license plumbing: permissive, unquarantined by default.
    monkeypatch.setattr(
        license_use, "resolve_corpus_license", lambda cid: ("CC-BY-4.0", cid))
    monkeypatch.setattr(
        license_use, "corpus_is_quarantined", lambda cid: False)
    return contest


def _created(monkeypatch, contest_mod, captured):
    """Route the final POST into `captured` instead of the network."""
    def fake_api(method, path, data=None, params=None, session=None):
        assert method == "POST" and path == "contests"
        captured.update(data)
        return [dict(data)]
    monkeypatch.setattr(contest_mod, "_api_request", fake_api)


class TestCreateContestSealedLane:
    def test_invalid_lane_rejected(self, contest_mod):
        with pytest.raises(ValueError, match="Invalid lane"):
            contest_mod.create_contest(
                "X", "some-corpus", "en>crk", lane="airgapped")

    def test_sealed_contest_requires_registration_fail_closed(
            self, contest_mod, monkeypatch):
        monkeypatch.setattr(
            contest_mod, "sealed_set_registration", lambda cid: None)
        with pytest.raises(ValueError, match="no sealed_sets registration"):
            contest_mod.create_contest(
                "Sealed", "sealed-eng-crk-v1", "en>crk", lane="sealed")

    def test_sealed_contest_requires_active_status(
            self, contest_mod, monkeypatch):
        monkeypatch.setattr(
            contest_mod, "sealed_set_registration",
            lambda cid: {"sealed_set_id": cid, "status": "retired"})
        with pytest.raises(ValueError, match="not active"):
            contest_mod.create_contest(
                "Sealed", "sealed-eng-crk-v1", "en>crk", lane="sealed")

    def test_sealed_contest_registry_error_is_fatal(
            self, contest_mod, monkeypatch):
        """Fail-closed: if the registry cannot be read, no sealed contest."""
        def boom(cid):
            raise RuntimeError("Supabase API error (503)")
        monkeypatch.setattr(contest_mod, "sealed_set_registration", boom)
        with pytest.raises(RuntimeError):
            contest_mod.create_contest(
                "Sealed", "sealed-eng-crk-v1", "en>crk", lane="sealed")

    def test_sealed_contest_created_with_lane_recorded(
            self, contest_mod, monkeypatch):
        monkeypatch.setattr(
            contest_mod, "sealed_set_registration",
            lambda cid: {"sealed_set_id": cid, "status": "active"})
        captured: dict = {}
        _created(monkeypatch, contest_mod, captured)
        record = contest_mod.create_contest(
            "Sealed EN→CRK", "sealed-eng-crk-v1", "en>crk", lane="sealed")
        assert record["lane"] == "sealed"
        assert captured["corpus_id"] == "sealed-eng-crk-v1"
        assert captured["lane"] == "sealed"

    def test_lane_auto_resolves_to_sealed_for_registered_set(
            self, contest_mod, monkeypatch):
        """The self-serve path: no lane flag anywhere — a registered sealed
        set is recognized and routed into the sealed lane automatically."""
        monkeypatch.setattr(
            contest_mod, "sealed_set_registration",
            lambda cid: {"sealed_set_id": cid, "status": "active"})
        captured: dict = {}
        _created(monkeypatch, contest_mod, captured)
        contest_mod.create_contest(
            "Sealed EN→CRK", "sealed-eng-crk-v1", "en>crk")
        assert captured["lane"] == "sealed"

    def test_lane_auto_resolves_to_standard_for_ordinary_corpus(
            self, contest_mod, monkeypatch):
        monkeypatch.setattr(
            contest_mod, "sealed_set_registration", lambda cid: None)
        captured: dict = {}
        _created(monkeypatch, contest_mod, captured)
        contest_mod.create_contest("Open", "tatoeba-en-fr", "en>fr")
        assert "lane" not in captured  # standard omits the column (pre-041 DBs)


class TestCreateContestStandardLaneStillRefuses:
    def test_quarantined_corpus_still_refused(self, contest_mod, monkeypatch):
        import mt_eval_harness.license_use as license_use
        monkeypatch.setattr(
            contest_mod, "sealed_set_registration", lambda cid: None)
        monkeypatch.setattr(
            license_use, "corpus_is_quarantined", lambda cid: True)
        with pytest.raises(ValueError, match="quarantined"):
            contest_mod.create_contest("Q", "crk-master-corpus", "en>crk")

    def test_sealed_set_refused_in_standard_lane(
            self, contest_mod, monkeypatch):
        monkeypatch.setattr(
            contest_mod, "sealed_set_registration",
            lambda cid: {"sealed_set_id": cid, "status": "active"})
        with pytest.raises(ValueError, match="sealed"):
            contest_mod.create_contest(
                "Std", "sealed-eng-crk-v1", "en>crk", lane="standard")

    def test_unreachable_registry_does_not_break_ordinary_contests(
            self, contest_mod, monkeypatch):
        """Databases that predate migration 037 have no sealed_sets table —
        ordinary contest creation must keep working (the DB guard is the
        backstop where the registry exists)."""
        def boom(cid):
            raise RuntimeError("Supabase API error (404): relation missing")
        monkeypatch.setattr(contest_mod, "sealed_set_registration", boom)
        captured: dict = {}
        _created(monkeypatch, contest_mod, captured)
        record = contest_mod.create_contest("Open", "tatoeba-en-fr", "en>fr")
        assert record["corpus_id"] == "tatoeba-en-fr"
        # A standard contest omits the lane key so pre-041 databases accept it.
        assert "lane" not in captured

    def test_nc_corpus_still_blocked_from_commercial_lane(
            self, contest_mod, monkeypatch):
        import mt_eval_harness.license_use as license_use
        monkeypatch.setattr(
            contest_mod, "sealed_set_registration", lambda cid: None)
        monkeypatch.setattr(
            license_use, "resolve_corpus_license",
            lambda cid: ("CC-BY-NC-SA-4.0", cid))
        with pytest.raises(ValueError, match="not\\s+eligible"):
            contest_mod.create_contest(
                "C", "edtekla-full", "en>crk", use_context="commercial")


# ---------------------------------------------------------------------------
# Live DB — gated on MT_EVAL_TEST_DB_URL + psycopg, migrations 037–041 applied
# to a dev/staging branch. Proves the DATABASE enforces the lane rules, not
# just that the SQL is shaped right. Skipped otherwise.
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
    reason="set MT_EVAL_TEST_DB_URL (dev/staging branch, 037–041 applied) + "
           "install psycopg to run live sealed-contest-bridge tests",
)


@_live_db
class TestSealedContestBridgeLiveDB:
    """One rolled-back transaction; nothing persists on the branch."""

    @pytest.fixture(autouse=True)
    def _tx(self):
        conn = _LIVE
        cur = conn.cursor()
        self.conn, self.cur = conn, cur
        sfx = uuid.uuid4().hex[:10]
        self.sealed_id = f"sealed-{sfx}"
        self.quarantined_id = f"ds-quar-{sfx}"
        self._seed()
        yield
        conn.rollback()

    def _seed(self):
        self.cur.execute(
            "INSERT INTO sealed_sets (sealed_set_id, ciphertext_digest,"
            " custodian_group_id, source_lang, target_lang, language_pair)"
            " VALUES (%s,%s,%s,%s,%s,%s)",
            (self.sealed_id, "deadbeef", "grp-test", "eng", "crk", "eng>crk"),
        )
        self.cur.execute(
            "INSERT INTO datasets (id, quarantined, quarantine_reason)"
            " VALUES (%s, true, 'bridge test')",
            (self.quarantined_id,),
        )

    def _insert_contest(self, contest_id, corpus_id, lane):
        self.cur.execute(
            "INSERT INTO contests (id, name, corpus_id, language_pair,"
            " created_by, lane) VALUES (%s,%s,%s,%s,%s,%s)",
            (contest_id, contest_id, corpus_id, "en>crk", "tester", lane),
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

    def test_sealed_contest_over_registered_set_is_accepted(self):
        cid = f"c-sealed-{uuid.uuid4().hex[:8]}"
        self._insert_contest(cid, self.sealed_id, "sealed")
        self.cur.execute("SELECT lane FROM contests WHERE id=%s", (cid,))
        assert self.cur.fetchone()[0] == "sealed"

    def test_sealed_contest_without_registration_is_rejected(self):
        msg = self._raises(
            lambda: self._insert_contest(
                f"c-{uuid.uuid4().hex[:8]}", "never-registered", "sealed"))
        assert "GUARD" in msg.upper()

    def test_standard_contest_over_sealed_set_is_rejected(self):
        msg = self._raises(
            lambda: self._insert_contest(
                f"c-{uuid.uuid4().hex[:8]}", self.sealed_id, "standard"))
        assert "GUARD" in msg.upper()

    def test_standard_contest_over_quarantined_dataset_is_rejected(self):
        msg = self._raises(
            lambda: self._insert_contest(
                f"c-{uuid.uuid4().hex[:8]}", self.quarantined_id, "standard"))
        assert "GUARD" in msg.upper()

    def test_backstop_blocks_known_improper_ids_even_unregistered(self):
        msg = self._raises(
            lambda: self._insert_contest(
                f"c-{uuid.uuid4().hex[:8]}", "crk-master-corpus", "standard"))
        assert "GUARD" in msg.upper()
