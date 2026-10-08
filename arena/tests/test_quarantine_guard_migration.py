"""Tests for migration 022 — the quarantine / improper-subset guard.

WHY THIS EXISTS (2026-07-18 gate meta-audit finding P4-H1): the quarantine
trigger enforces one of the TWO hard constraints that survived the 2026-06-13
board wipe — "improper easy slices (62-sample / 90-phase1 / 124-subset /
crk-master) may NEVER rank". Before this file, that guard had NO failing-capable
test in the default (DB-less) suite: the only behavioral coverage was the
live-DB path gated on MT_EVAL_TEST_DB_URL (skipped in CI/local), and neutering
migration 022's `RAISE EXCEPTION` — turning the guard into a pass-everything
no-op — produced ZERO test failures. This closes that gap without a live DB.

Two layers, both ALWAYS run:

1. STRUCTURAL — the guard is a BEFORE INSERT OR UPDATE **trigger** on run_cards
   bound to a function that RAISEs. This is precisely the "enforced even under
   service_role" property: PostgreSQL triggers fire for EVERY role, whereas the
   service_role key BYPASSES row-level-security policies. Implementing the guard
   as a trigger (not an RLS policy) is what makes it un-bypassable by the
   service_role client the harness/edge functions use. A mutation that deletes
   the RAISE, detaches the trigger, or demotes it to an RLS policy trips here.

2. BEHAVIORAL (DB-less) — the known-improper-slice regex backstop is extracted
   from the migration and executed in Python: it MUST match every known-bad id
   and MUST NOT match the legitimate full-protocol EdTeKLA datasets. Weakening
   the pattern (dropping crk-master, etc.) trips here. This tests the actual
   pattern-matching LOGIC, not just that the SQL mentions it.
"""
import os
import re
import uuid
from pathlib import Path

import pytest

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
    / "022_quarantine_corpus_guard.sql"
)


def _sql() -> str:
    assert MIGRATION.exists(), f"migration missing: {MIGRATION}"
    return MIGRATION.read_text()


# --- Layer 1: structural (service_role-integrity) --------------------------

def test_guard_is_a_trigger_not_an_rls_policy():
    """A trigger fires for ALL roles; service_role bypasses RLS but NOT triggers.
    The quarantine guard MUST be a trigger so the service_role client cannot
    bypass it."""
    sql = _sql()
    assert re.search(
        r"CREATE\s+TRIGGER\s+\w+\s+BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+run_cards",
        sql, re.IGNORECASE,
    ), "quarantine guard must be a BEFORE INSERT OR UPDATE trigger on run_cards"
    # It must NOT have been quietly reimplemented as an RLS policy (service_role
    # would bypass that). No CREATE POLICY should be the enforcement mechanism here.
    assert "CREATE POLICY" not in sql.upper(), (
        "the quarantine guard must be a trigger, not an RLS policy (service_role bypasses RLS)"
    )


def test_trigger_bound_to_a_raising_function():
    sql = _sql()
    m = re.search(r"EXECUTE\s+FUNCTION\s+(\w+)\s*\(\s*\)", sql, re.IGNORECASE)
    assert m, "trigger must be bound to a function via EXECUTE FUNCTION"
    fn = m.group(1)
    # The bound function must be defined and must RAISE (not silently RETURN NEW).
    body = re.search(
        rf"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+{re.escape(fn)}\s*\(\).*?\$\$(.*?)\$\$",
        sql, re.IGNORECASE | re.DOTALL,
    )
    assert body, f"trigger function {fn} not defined in this migration"
    fn_body = body.group(1)
    # Two RAISE branches: the datasets.quarantined flag AND the bad-slice regex.
    assert fn_body.upper().count("RAISE EXCEPTION") >= 2, (
        f"{fn} must RAISE for both the quarantined flag and the improper-slice pattern "
        f"(found {fn_body.upper().count('RAISE EXCEPTION')})"
    )
    # The data-driven primary check must consult datasets.quarantined.
    assert re.search(r"quarantined", fn_body, re.IGNORECASE), \
        "trigger must check the datasets.quarantined flag"


# --- Layer 2: behavioral, DB-less (the bad-slice regex actually works) ------

def _extract_slice_regex() -> re.Pattern:
    """Pull the `NEW.dataset_id ~* '...'` backstop pattern out of the migration
    and compile it (case-insensitive, matching the SQL `~*` operator)."""
    sql = _sql()
    m = re.search(r"dataset_id\s*~\*\s*'([^']+)'", sql)
    assert m, "could not find the ~* improper-slice regex in migration 022"
    return re.compile(m.group(1), re.IGNORECASE)


KNOWN_IMPROPER = [
    "crk-phase1-test-90-quarantined",
    "crk-edtekla-dev-124-quarantined",
    "crk-master-corpus",
    "crk-sample-62",
    "eng-crk-sample62-dev",
    "crk_phase1_test",
    "eng-crk-dev124",
    "crk_master",
    "anything-quarantined",
]

# The FULL EdTeKLA protocol + ordinary corpora rank normally — must NOT match.
LEGITIMATE = [
    "eval-eng-crk-edtekla-dev-v1",       # full 436-entry dev
    "eval-eng-crk-edtekla-test-v1",      # 50 held-out
    "eval-eng-ilo-tatoeba-dev-v1",
    "eval-spa-que-flores-devtest-v1",
    "crk-edtekla-full-protocol",
]


def test_regex_matches_every_known_improper_slice():
    rx = _extract_slice_regex()
    for did in KNOWN_IMPROPER:
        assert rx.search(did), f"improper slice id must be caught by the backstop: {did!r}"


def test_regex_does_not_reject_legitimate_full_protocol_corpora():
    rx = _extract_slice_regex()
    for did in LEGITIMATE:
        assert not rx.search(did), (
            f"a legitimate full-protocol corpus must rank normally, not be quarantined: {did!r}"
        )


def test_flagged_slice_ids_are_seeded_quarantined():
    """The three named incident-family ids are UPDATE'd quarantined=true."""
    sql = _sql()
    seed = re.search(r"UPDATE\s+datasets\s+SET\s+quarantined\s*=\s*true.*?WHERE\s+id\s+IN\s*\((.*?)\)",
                     sql, re.IGNORECASE | re.DOTALL)
    assert seed, "migration must seed the known-improper ids as quarantined=true"
    for did in ("crk-phase1-test-90-quarantined", "crk-edtekla-dev-124-quarantined", "crk-master-corpus"):
        assert did in seed.group(1), f"{did} must be seeded quarantined"


# ---------------------------------------------------------------------------
# Migration 064 — ANCHORED backstop (DB7 + E9, launch review 2026-07-20).
# ---------------------------------------------------------------------------
# 022's (and 041's twin) backstop was an UNANCHORED substring blocklist: it
# blocked its needles ANYWHERE in an id, so legit FUTURE ids collided with the
# incident-specific crk slices (crk-master-2026, dev-1240, sample-620, anything
# merely containing '-quarantined'). 064 CREATE OR REPLACEs BOTH twin functions
# (reject_quarantined_datasets + public.contest_corpus_guard) with an anchored
# regex, byte-identical to each other, re-pinning search_path (E9). The known-
# improper slices STAY blocked; versioned lookalikes are now allowed.

MIGRATION_064 = MIGRATION.parent / "064_quarantine_guard_anchor.sql"


def _064_sql() -> str:
    assert MIGRATION_064.exists(), f"missing DB7 migration: {MIGRATION_064}"
    return MIGRATION_064.read_text(encoding="utf-8")


def _extract_anchored_regexes() -> list:
    """Both live backstops from 064, keyed on their column context so header
    doc-comment prose can never be mistaken for a live pattern."""
    sql = _064_sql()
    return re.findall(r"NEW\.(?:dataset_id|corpus_id)\s*~\*\s*'([^']+)'", sql)


# Every known-improper slice MUST stay blocked (the sovereignty core). This is
# KNOWN_IMPROPER minus 'anything-quarantined': the anchored regex intentionally
# no longer blocks a bare '-quarantined' substring, and the two real seeded ids
# ending in '-quarantined' are still caught by their phase1-test / dev-124
# markers (and by the primary datasets.quarantined flag).
ANCHORED_STILL_BLOCK = [d for d in KNOWN_IMPROPER if d != "anything-quarantined"]

# Legit lookalikes the OLD regex wrongly blocked and 064 now ALLOWS. Includes
# the full-protocol corpora plus the DB7-named versioned ids.
ANCHORED_NOW_ALLOW = LEGITIMATE + [
    "crk-master-2026",   # a versioned future crk master corpus (DB7)
    "dev-1240",          # dev id whose number merely starts with 124 (DB7)
    "dev-12400",
    "sample-620",        # a different sample count than the 62-slice
    "anything-quarantined",  # bare '-quarantined' no longer blocks
]


def test_064_replaces_both_twins_with_search_path_pin():
    """Both functions are CREATE OR REPLACE'd, and BOTH keep the search_path pin
    (E9: 022's function had no pin of its own; 025 added it — a bare replace
    would drop it and reintroduce advisor lint 0011)."""
    sql = _064_sql()
    assert "CREATE OR REPLACE FUNCTION reject_quarantined_datasets()" in sql
    assert "CREATE OR REPLACE FUNCTION public.contest_corpus_guard()" in sql
    # Each replaced function carries its own SET search_path = public.
    assert sql.count("SET search_path = public") >= 2, (
        "both replaced twins must keep SET search_path = public (E9)"
    )
    # And it must not silently drop or recreate the triggers.
    assert "DROP TRIGGER" not in sql.upper()


def test_064_backstops_are_byte_identical_anchored_twins():
    rxs = _extract_anchored_regexes()
    assert len(rxs) == 2, f"expected 2 live backstops in 064, found {len(rxs)}"
    assert rxs[0] == rxs[1], "the two backstops must stay byte-identical twins"
    anchored = rxs[0]
    # Anchored, not the old unanchored blocklist: it uses lookahead boundaries
    # and no longer carries the bare '-quarantined' alternative.
    assert "(?!" in anchored, "the anchored regex must use lookahead boundaries"
    assert "-quarantined" not in anchored, (
        "the bare '-quarantined' substring alternative must be gone (DB7)"
    )


def test_064_regex_still_blocks_every_known_improper_slice():
    """DO-NOT-BREAK: the improper-subset ranking ban still holds."""
    rx = re.compile(_extract_anchored_regexes()[0], re.IGNORECASE)
    for did in ANCHORED_STILL_BLOCK:
        assert rx.search(did), (
            f"known-improper slice id must STILL be caught by the anchored backstop: {did!r}"
        )


def test_064_regex_now_allows_legit_lookalikes():
    """The DB7 fix: versioned / longer-number lookalikes are no longer blocked."""
    rx = re.compile(_extract_anchored_regexes()[0], re.IGNORECASE)
    for did in ANCHORED_NOW_ALLOW:
        assert not rx.search(did), (
            f"a legit lookalike must rank normally, not be quarantined: {did!r}"
        )


def test_064_primary_quarantine_flag_mechanism_is_preserved():
    """The regex is only the backstop; the data-driven datasets.quarantined flag
    remains the primary check in the replaced run_cards guard."""
    sql = _064_sql()
    # reject_quarantined_datasets still consults the flag and RAISEs on it.
    assert "d.quarantined" in sql
    assert sql.upper().count("RAISE EXCEPTION") >= 2, (
        "the run_cards guard must still RAISE for both the flag and the pattern"
    )


# ---------------------------------------------------------------------------
# Layer 3: LIVE DB — the trigger is enforced by PostgreSQL itself, EVEN for a
# service_role/superuser connection. Gated on MT_EVAL_TEST_DB_URL + a psycopg
# driver (skipped otherwise); mirrors the proven live-DB fixture in
# test_content_guard_migration.py. The connection is direct (service_role /
# superuser) and therefore BYPASSES row-level security — so a rejection here
# proves the TRIGGER (which service_role does NOT bypass), not an RLS policy, is
# the backstop. Migration 033's live test seeds a quarantined dataset but never
# puts a run_card on it (that would trip 022); THIS class is the missing coverage
# that actually inserts onto the quarantined dataset and asserts 022 rejects it.
#
# VERIFIED LIVE 2026-07-18 against the acl-staging dev branch (022 applied) over a
# privileged RLS-bypassing connection: run_cards on a quarantined dataset and on
# 'crk-master-corpus' were both rejected with a QUARANTINED-DATASET error, a clean
# registered dataset was allowed, and the tx rolled back clean (0 leftover rows).
# Production main was not touched.
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
class TestQuarantineGuardLiveDB:
    """Behavioral proof that migration 022 rejects quarantined / improper-slice
    run_cards even over a service_role (RLS-bypassing) connection. One shared
    transaction, rolled back in teardown — nothing persists on the branch."""

    @pytest.fixture(autouse=True)
    def _tx(self):
        conn = _LIVE
        self.conn, self.cur = conn, conn.cursor()
        sfx = uuid.uuid4().hex[:10]
        self.clean_ds = f"gtst-clean-{sfx}"        # registered, not quarantined
        self.quar_ds = f"gtst-quar-{sfx}"          # registered + quarantined=true
        # A clean base dataset + a quarantined one to insert run_cards against.
        self._dataset(self.clean_ds, quarantined=False)
        self._dataset(self.quar_ds, quarantined=True)
        yield
        conn.rollback()

    def _dataset(self, did, *, quarantined):
        self.cur.execute(
            "INSERT INTO datasets (id, name, source_language, target_language,"
            " language_pair, license, quarantined) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (did, "quarantine guard test", "English", "French", "en>fr",
             "CC-BY-4.0", quarantined),
        )

    def _insert_run_card(self, cid, dataset_id):
        self.cur.execute(
            "INSERT INTO run_cards (id, submitter, affirmation, model_slug,"
            " condition, dataset_id, language_pair, harness_version, run_card,"
            " fingerprint_hash, trust) VALUES"
            " (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s)",
            (cid, "t", "t", "m", "naive", dataset_id, "en>fr", "0.1.0",
             "{}", "fp", "unverified"),
        )

    def _rejected(self, cid, dataset_id):
        """Try the insert inside a savepoint; return the error string if the
        trigger fired, else None (the insert unexpectedly succeeded)."""
        self.cur.execute("SAVEPOINT sp")
        try:
            self._insert_run_card(cid, dataset_id)
        except Exception as exc:  # any DB error == the BEFORE-INSERT trigger raised
            self.cur.execute("ROLLBACK TO SAVEPOINT sp")
            return str(exc)
        self.cur.execute("ROLLBACK TO SAVEPOINT sp")
        return None

    def test_quarantined_dataset_run_card_is_rejected(self):
        err = self._rejected(f"gtst-card-quar-{uuid.uuid4().hex[:8]}", self.quar_ds)
        assert err is not None, (
            "a run_card on a quarantined dataset must be rejected by the 022 trigger, "
            "even for a service_role connection"
        )
        assert "QUARANTIN" in err.upper()

    def test_improper_slice_id_is_rejected_by_the_regex_backstop(self):
        # An UNREGISTERED id (no datasets row) that matches the bad-slice pattern
        # must still be rejected by the regex backstop branch.
        err = self._rejected(f"gtst-card-bad-{uuid.uuid4().hex[:8]}", "crk-master-corpus")
        assert err is not None, "an improper-slice dataset id must be rejected by the regex backstop"
        assert "QUARANTIN" in err.upper()

    def test_clean_registered_dataset_run_card_is_allowed(self):
        # The guard must not over-block: a normal registered corpus ranks.
        err = self._rejected(f"gtst-card-ok-{uuid.uuid4().hex[:8]}", self.clean_ds)
        assert err is None, f"a clean registered dataset must be allowed, got: {err}"


# ---------------------------------------------------------------------------
# Migration 070 — the backstop moves from CODE to DATA.
# ---------------------------------------------------------------------------
# 022/041/064 compiled the 2026-06-13 incident shapes into two function bodies
# that had to stay byte-identical to each other, and one alternative named a
# language — the last language-named artifact in the database. 070 puts the
# shapes in public.quarantined_id_patterns and has both guards read the table.
# Behaviour must be IDENTICAL on day one: same blocks, same allows.

MIGRATION_070 = MIGRATION.parent / "070_quarantine_patterns_to_data.sql"


def _070_sql() -> str:
    assert MIGRATION_070.exists(), f"missing migration: {MIGRATION_070}"
    return MIGRATION_070.read_text(encoding="utf-8")


def _seeded_patterns() -> list:
    """The regex shapes 070 seeds into quarantined_id_patterns."""
    sql = _070_sql()
    block = re.search(
        r"INSERT\s+INTO\s+public\.quarantined_id_patterns\s*\([^)]*\)\s*VALUES(.*?)ON\s+CONFLICT",
        sql, re.IGNORECASE | re.DOTALL)
    assert block, "070 must seed quarantined_id_patterns"
    # The first quoted string of each row tuple is the pattern.
    return [m.group(1) for m in re.finditer(r"\(\s*'([^']+)'", block.group(1))]


def test_070_seeds_exactly_064s_alternatives():
    """Seeded verbatim — the migration is a mechanism change, not a policy one."""
    alternation = _extract_anchored_regexes()[0]
    assert alternation.startswith("(") and alternation.endswith(")")
    assert sorted(_seeded_patterns()) == sorted(alternation[1:-1].split("|"))


def test_070_patterns_block_every_known_improper_slice():
    pats = [re.compile(p, re.IGNORECASE) for p in _seeded_patterns()]
    for did in ANCHORED_STILL_BLOCK:
        assert any(rx.search(did) for rx in pats), \
            f"improper slice must stay blocked under the data-driven backstop: {did!r}"


def test_070_patterns_still_allow_every_legitimate_lookalike():
    pats = [re.compile(p, re.IGNORECASE) for p in _seeded_patterns()]
    for did in ANCHORED_NOW_ALLOW:
        assert not any(rx.search(did) for rx in pats), \
            f"legitimate id must stay eligible: {did!r}"


def test_070_removes_the_compiled_literal_from_both_bodies():
    """No id pattern may be compiled into a trigger body any more."""
    sql = _070_sql()
    live = re.findall(r"NEW\.(?:dataset_id|corpus_id)\s*~\*\s*'([^']+)'", sql)
    assert live == [], f"070 must not compile patterns into a body; found {live}"
    # Both guards read the table instead.
    assert sql.count("FROM public.quarantined_id_patterns p") == 2


def test_070_keeps_the_guards_un_bypassable_and_search_path_pinned():
    sql = _070_sql()
    assert "CREATE OR REPLACE FUNCTION reject_quarantined_datasets()" in sql
    assert "CREATE OR REPLACE FUNCTION public.contest_corpus_guard()" in sql
    # E9: a bare replace would silently drop the search_path pin (advisor 0011).
    assert sql.count("SET search_path = public") >= 2
    # Triggers stay bound; nothing is dropped or demoted to an RLS policy.
    assert "DROP TRIGGER" not in sql.upper()


def test_070_gives_the_new_table_an_explicit_read_policy():
    """Migration 054 auto-enables RLS on new tables. Without a SELECT policy
    the table is deny-all and BOTH guards silently stop blocking anything."""
    sql = _070_sql()
    assert re.search(
        r"ALTER\s+TABLE\s+public\.quarantined_id_patterns\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
        sql, re.IGNORECASE)
    assert re.search(
        r"CREATE\s+POLICY\s+\w+\s+ON\s+public\.quarantined_id_patterns\s+FOR\s+SELECT",
        sql, re.IGNORECASE)


def test_070_preserves_every_exception_message_from_064():
    """The bodies are taken verbatim; only the pattern condition changes."""
    old, new = _064_sql(), _070_sql()
    for msg in re.findall(r"'((?:SEALED |STANDARD )?CONTEST GUARD:[^']*|QUARANTINED DATASET:[^']*)'", old):
        assert msg in new, f"064 message lost in 070: {msg[:60]!r}"
