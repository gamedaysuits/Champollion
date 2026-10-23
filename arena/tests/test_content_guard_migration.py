"""Tests for migration 033 — run_card_entries corpus-content guard.

The per-entry corpus-content exposure gate lived only in the harness publish
path (publish.py ``_entry_content_publishable``); run_card_entries had no DB
trigger, so any authenticated user could bypass it with a direct PostgREST
insert of NC / held-out / EdTeKLA text. Migration
``033_run_card_entries_content_guard.sql`` adds the missing DB backstop.

Two layers of coverage live here:

1. OFFLINE (always run): the migration's SQL license-classifier token lists must
   stay byte-for-byte in parity with publish.py's constants, and the trigger
   must contain the four rejection branches (fail-safe / quarantine / sealed
   segment / non-redistributable license). These freeze the SQL <-> Python
   mirror so the two cannot silently drift.

2. LIVE DB (gated on ``MT_EVAL_TEST_DB_URL`` + a psycopg driver): connect to a
   branch DB with migrations applied and assert the trigger actually rejects
   NC / held_out / quarantined / unknown-license entry inserts and permits a
   registered redistributable one. Skipped when no DB is configured.

----------------------------------------------------------------------------
MANUAL VERIFICATION SQL (run against a dev/staging branch — NEVER prod without
explicit maintainer go-ahead). Each block should RAISE EXCEPTION except the
last, which should INSERT 1 row. Wrap in a transaction and ROLLBACK.

    BEGIN;

    -- A registered, redistribution-cleared corpus + a run card on it.
    INSERT INTO datasets (id, name, source_language, target_language,
                          language_pair, license, quarantined)
      VALUES ('gtst-ccby', 'guard ccby', 'English', 'French', 'en>fr',
              'CC-BY-4.0', false);
    INSERT INTO run_cards (id, submitter, affirmation, model_slug, condition,
                           dataset_id, language_pair, harness_version,
                           run_card, fingerprint_hash, trust)
      VALUES ('gtst-card-ccby-0001', 't', 't', 'm', 'naive', 'gtst-ccby',
              'en>fr', '0.1.0', '{}'::jsonb, 'fp', 'unverified');

    -- (b) sealed segment on an otherwise-clear corpus -> REJECT.
    INSERT INTO run_card_entries (run_card_id, entry_id, source, expected,
                                  exact_match, segment)
      VALUES ('gtst-card-ccby-0001', 'e1', 's', 'x', false, 'held_out');  -- FAILS

    -- (c) NC corpus -> REJECT.
    INSERT INTO datasets (id, name, source_language, target_language,
                          language_pair, license, quarantined)
      VALUES ('gtst-nc', 'guard nc', 'English', 'Cree', 'en>crk',
              'CC-BY-NC-SA-4.0', false);
    INSERT INTO run_cards (id, submitter, affirmation, model_slug, condition,
                           dataset_id, language_pair, harness_version,
                           run_card, fingerprint_hash, trust)
      VALUES ('gtst-card-nc-0001', 't', 't', 'm', 'naive', 'gtst-nc',
              'en>crk', '0.1.0', '{}'::jsonb, 'fp', 'unverified');
    INSERT INTO run_card_entries (run_card_id, entry_id, source, expected,
                                  exact_match, segment)
      VALUES ('gtst-card-nc-0001', 'e1', 's', 'x', false, 'test');        -- FAILS

    -- fail-safe: run card whose dataset_id resolves to no datasets row -> REJECT.
    INSERT INTO run_cards (id, submitter, affirmation, model_slug, condition,
                           dataset_id, language_pair, harness_version,
                           run_card, fingerprint_hash, trust)
      VALUES ('gtst-card-unreg-0001', 't', 't', 'm', 'naive',
              'gtst-not-registered', 'en>fr', '0.1.0', '{}'::jsonb, 'fp',
              'unverified');
    INSERT INTO run_card_entries (run_card_id, entry_id, source, expected,
                                  exact_match, segment)
      VALUES ('gtst-card-unreg-0001', 'e1', 's', 'x', false, 'test');     -- FAILS

    -- ALLOW: registered, redistributable, open segment -> 1 row.
    INSERT INTO run_card_entries (run_card_id, entry_id, source, expected,
                                  exact_match, segment)
      VALUES ('gtst-card-ccby-0001', 'e1', 's', 'x', false, 'test');      -- OK

    ROLLBACK;
----------------------------------------------------------------------------
"""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

import pytest

from mt_eval_harness.publish import (
    _NONREDISTRIBUTABLE_LICENSE_SUBSTRINGS,
    _NONREDISTRIBUTABLE_LICENSE_TOKENS,
    _REDISTRIBUTABLE_LICENSE_PREFIXES,
    _license_is_redistributable,
)

_MIGRATIONS_DIR = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
)
MIGRATION = _MIGRATIONS_DIR / "033_run_card_entries_content_guard.sql"
# 068 redefines is_license_redistributable with an ANCHORED prefix match
# (strpos = 1 ≡ startswith); 033's substring version was a fail-open ('mit'
# inside 'limited'). The classifier-parity tests below run against the
# CURRENT definition, i.e. 068; the trigger-structure tests stay on 033.
MIGRATION_CLASSIFIER = _MIGRATIONS_DIR / "068_fix_license_redistributable_anchor.sql"


# ---------------------------------------------------------------------------
# Offline: the SQL <-> Python mirror cannot drift.
# ---------------------------------------------------------------------------

def _sql() -> str:
    assert MIGRATION.exists(), f"migration missing: {MIGRATION}"
    return MIGRATION.read_text()


def _sql_classifier() -> str:
    """The migration holding the CURRENT is_license_redistributable definition."""
    assert MIGRATION_CLASSIFIER.exists(), (
        f"migration missing: {MIGRATION_CLASSIFIER}"
    )
    return MIGRATION_CLASSIFIER.read_text()


def _array_literals(sql: str, foreach_var: str) -> list[str]:
    """Extract the quoted strings from `FOREACH <var> IN ARRAY ARRAY[ ... ]`."""
    m = re.search(
        rf"FOREACH\s+{foreach_var}\s+IN\s+ARRAY\s+ARRAY\[(.*?)\]",
        sql, re.DOTALL,
    )
    assert m, f"could not find ARRAY block for FOREACH {foreach_var}"
    return re.findall(r"'([^']*)'", m.group(1))


class TestMigrationFileWellFormed:
    def test_file_exists_and_nonempty(self):
        assert MIGRATION.stat().st_size > 0

    def test_creates_trigger_on_run_card_entries(self):
        sql = _sql()
        assert "CREATE TRIGGER run_card_entries_content_guard" in sql
        assert "BEFORE INSERT OR UPDATE ON run_card_entries" in sql
        assert "FOR EACH ROW" in sql

    def test_resolves_dataset_via_parent_run_card(self):
        sql = _sql()
        # Joins run_cards rc on NEW.run_card_id to read rc.dataset_id, then the
        # datasets row.
        assert re.search(r"FROM\s+run_cards\s+rc", sql)
        assert "rc.id = NEW.run_card_id" in sql
        assert re.search(r"FROM\s+datasets\s+d", sql)

    def test_has_four_rejection_branches(self):
        sql = _sql()
        # There must be a RAISE for: fail-safe (no datasets row), quarantine,
        # sealed segment, and non-redistributable license.
        assert sql.count("RAISE EXCEPTION") >= 4
        assert "fail-safe" in sql.lower()
        assert "quarantined" in sql
        assert "held_out" in sql and "gold_standard" in sql
        assert "is_license_redistributable" in sql

    def test_segment_check_reads_new_segment(self):
        sql = _sql()
        assert "NEW.segment" in sql

    def test_idempotent_guards_present(self):
        sql = _sql()
        assert "CREATE OR REPLACE FUNCTION" in sql
        assert "DROP TRIGGER IF EXISTS run_card_entries_content_guard" in sql
        assert "ADD COLUMN IF NOT EXISTS dataset_id" in sql


class TestLicenseTokenParity:
    """The SQL classifier's token lists must equal publish.py's constants."""

    # List parity is pinned against the CURRENT classifier definition (068).
    # 033 is historical — its lists are frozen as-applied and are NOT required
    # to track future Python changes (068 superseded its function).
    def test_nonredistributable_substrings_match(self):
        sub = _array_literals(_sql_classifier(), "sub")
        assert sub == list(_NONREDISTRIBUTABLE_LICENSE_SUBSTRINGS)

    def test_redistributable_prefixes_match(self):
        pref = _array_literals(_sql_classifier(), "pref")
        assert pref == list(_REDISTRIBUTABLE_LICENSE_PREFIXES)

    @pytest.mark.parametrize("sql_text", [_sql, _sql_classifier], ids=["033", "068"])
    def test_standalone_nc_nd_tokens_present(self, sql_text):
        sql = sql_text()
        for tok in _NONREDISTRIBUTABLE_LICENSE_TOKENS:
            assert f"' {tok} '" in sql, tok

    def test_068_prefix_match_is_anchored(self):
        """068 must compare with strpos(...) = 1 (startswith), never > 0."""
        sql = _sql_classifier()
        assert "strpos(low, pref) = 1" in sql
        assert "strpos(low, pref) > 0" not in sql


def _redistributable_via_sql_lists(license_str: str | None) -> bool:
    """Re-implement the CURRENT migration's classifier (068) using the lists
    EXTRACTED from the SQL file (not publish.py). If this disagrees with
    publish.py over the battery below, the SQL's lists are wrong/incomplete.

    The prefix arm is startswith — anchored, mirroring 068's
    ``strpos(low, pref) = 1``. (033's ``> 0`` substring version was a
    fail-open: 'mit' inside 'limited'/'permitted'.)
    """
    sql = _sql_classifier()
    subs = _array_literals(sql, "sub")
    prefs = _array_literals(sql, "pref")
    if not license_str or not license_str.strip():
        return False
    low = license_str.strip().lower()
    if any(s in low for s in subs):
        return False
    toks = set(re.split(r"[^a-z0-9]+", low))
    if toks & set(_NONREDISTRIBUTABLE_LICENSE_TOKENS):
        return False
    return any(low.startswith(p) for p in prefs)


class TestSqlClassifierMatchesPython:
    BATTERY = [
        "CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "cc0", "Public Domain",
        "MIT", "Apache-2.0", "BSD-3-Clause", "ODC-BY-1.0", "ODbL-1.0",
        "GPL-3.0", "LGPL-2.1", "MPL-2.0", "The Unlicense",
        "CC-BY-NC-SA-4.0", "CC-BY-NC-4.0", "CC-BY-ND-4.0", "CC BY NC",
        "proprietary", "Wolvengrey (permission pending)", "All Rights Reserved",
        "restricted-use", "noncommercial", "no-derivatives",
        None, "", "some-unrecognized-license", "unknown",
        # Adversarial: permissive family names as MID-STRING substrings. These
        # are the shapes the 033-era substring match fail-opened on ('mit'
        # inside 'li*mit*ed'/'per*mit*ted'). All must classify False.
        "Limited Use License", "limited use license",
        "Usage permitted for research only", "LicenseRef-Custom-Limited",
        "Redistribution prohibited (see agreement)", "academic use only",
    ]

    @pytest.mark.parametrize("lic", BATTERY)
    def test_parity(self, lic):
        assert _redistributable_via_sql_lists(lic) == _license_is_redistributable(lic), lic


class TestClassifierIntendedSemantics:
    """Pin INTENDED behavior, not implementation agreement — parity alone
    would pass with both sides wrong together (as they were pre-068)."""

    FAIL_CLOSED = [
        "Limited Use License", "limited use license",
        "Usage permitted for research only", "LicenseRef-Custom-Limited",
        "Evaluation only license", "Bespoke agreement",
        "CC-BY-NC-SA-4.0", None, "", "unknown",
    ]
    CLEARED = [
        "CC-BY-4.0", "cc0", "MIT", "Apache-2.0", "BSD-3-Clause",
        "GPL-3.0", "Public Domain", "The Unlicense",
    ]

    @pytest.mark.parametrize("lic", FAIL_CLOSED)
    def test_restrictive_or_unknown_is_withheld(self, lic):
        assert _license_is_redistributable(lic) is False, lic
        assert _redistributable_via_sql_lists(lic) is False, lic

    @pytest.mark.parametrize("lic", CLEARED)
    def test_known_permissive_families_clear(self, lic):
        assert _license_is_redistributable(lic) is True, lic
        assert _redistributable_via_sql_lists(lic) is True, lic


# ---------------------------------------------------------------------------
# Live DB: gated on MT_EVAL_TEST_DB_URL + a psycopg driver. Skipped otherwise.
# Uses a direct (service_role/superuser) connection that bypasses RLS — proving
# the TRIGGER (which service_role does NOT bypass) is the real backstop.
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
    reason="set MT_EVAL_TEST_DB_URL (dev/staging branch) and install psycopg to run live-DB guard tests",
)


@_live_db
class TestContentGuardLiveDB:
    """Assert migration 033's trigger is enforced by the database itself.

    The whole class shares ONE transaction that is rolled back in teardown, so
    nothing persists on the branch.
    """

    @pytest.fixture(autouse=True)
    def _tx(self):
        conn = _LIVE
        cur = conn.cursor()
        self.conn, self.cur = conn, cur
        sfx = uuid.uuid4().hex[:10]
        self.ccby = f"gtst-ccby-{sfx}"
        self.nc = f"gtst-nc-{sfx}"
        self.quar = f"gtst-quar-{sfx}"
        self.card_ccby = f"gtst-card-ccby-{sfx}"
        self.card_nc = f"gtst-card-nc-{sfx}"
        self.card_unreg = f"gtst-card-unreg-{sfx}"
        self._seed()
        yield
        conn.rollback()

    def _dataset(self, did, license_str, quarantined):
        self.cur.execute(
            "INSERT INTO datasets (id, name, source_language, target_language,"
            " language_pair, license, quarantined) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (did, "guard test", "English", "French", "en>fr", license_str, quarantined),
        )

    def _run_card(self, cid, dataset_id):
        self.cur.execute(
            "INSERT INTO run_cards (id, submitter, affirmation, model_slug,"
            " condition, dataset_id, language_pair, harness_version, run_card,"
            " fingerprint_hash, trust) VALUES"
            " (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s)",
            (cid, "t", "t", "m", "naive", dataset_id, "en>fr", "0.1.0",
             "{}", "fp", "unverified"),
        )

    def _seed(self):
        self._dataset(self.ccby, "CC-BY-4.0", False)
        self._dataset(self.nc, "CC-BY-NC-SA-4.0", False)
        self._dataset(self.quar, "CC-BY-4.0", True)
        self._run_card(self.card_ccby, self.ccby)
        self._run_card(self.card_nc, self.nc)
        # Unregistered: dataset_id points to no datasets row. (NB: an id that
        # avoids migration 022's bad-slice regex so the run_card insert itself
        # is not rejected upstream.)
        self._run_card(self.card_unreg, f"gtst-not-registered-{self.card_unreg}")

    def _insert_entry(self, card_id, segment):
        self.cur.execute(
            "INSERT INTO run_card_entries (run_card_id, entry_id, source,"
            " expected, exact_match, segment) VALUES (%s,%s,%s,%s,%s,%s)",
            (card_id, "e1", "hello", "bonjour", False, segment),
        )

    def _rejected(self, card_id, segment):
        self.cur.execute("SAVEPOINT sp")
        try:
            self._insert_entry(card_id, segment)
        except Exception as exc:  # noqa: BLE001 — any DB error == trigger fired
            self.cur.execute("ROLLBACK TO SAVEPOINT sp")
            return str(exc)
        self.cur.execute("ROLLBACK TO SAVEPOINT sp")
        pytest.fail(f"expected rejection for card={card_id} segment={segment}")

    def test_nc_license_entry_rejected(self):
        assert "GUARD" in self._rejected(self.card_nc, "test").upper()

    def test_held_out_segment_rejected(self):
        assert "GUARD" in self._rejected(self.card_ccby, "held_out").upper()

    def test_gold_standard_segment_rejected(self):
        assert "GUARD" in self._rejected(self.card_ccby, "gold_standard").upper()

    def test_unregistered_corpus_failsafe_rejected(self):
        assert "GUARD" in self._rejected(self.card_unreg, "test").upper()

    def test_redistributable_entry_permitted(self):
        self.cur.execute("SAVEPOINT sp")
        self._insert_entry(self.card_ccby, "test")  # must NOT raise
        self.cur.execute(
            "SELECT count(*) FROM run_card_entries WHERE run_card_id=%s",
            (self.card_ccby,),
        )
        assert self.cur.fetchone()[0] == 1
        self.cur.execute("ROLLBACK TO SAVEPOINT sp")
