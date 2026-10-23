"""Migration 046 — the organizer self-serve registration door (gap G3).

Offline SQL-text + parse-tree assertions in the test_method_submission_migration
style: 046 must parse under the real PostgreSQL grammar and carry the
structural guarantees the self-serve lane depends on — identity-bound
INSERT policies on sealed_sets and qualifiers (created_by = JWT email, birth
states pinned, qualifier ownership EXISTS check), admission triggers beneath
every client (born quarantined / born planned-or-active; born active /
no-retired-set; rolling 24h per-creator throttle with the curator NULL lane
exempt), the 042 terms guard extended to freeze created_by, idempotency, and
the dev-only/rollback headers. No new table, no UPDATE/DELETE door: the
content-free invariant and the one-way lifecycles of 037/042 are untouched.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pglast = pytest.importorskip(
    "pglast", reason="pip install pglast to validate migration SQL"
)

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
    / "046_organizer_registration_door.sql"
)


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.exists(), f"migration missing: {MIGRATION}"
    return MIGRATION.read_text()


def test_parses_under_postgres_grammar(sql):
    stmts = pglast.parse_sql(sql)
    assert len(stmts) >= 10


def test_creates_no_new_table(sql):
    """046 only opens a door on EXISTING content-free tables (037/042)."""
    kinds = {type(raw.stmt).__name__ for raw in pglast.parse_sql(sql)}
    assert "CreateStmt" not in kinds


def test_adds_no_content_column(sql):
    """The only new columns are created_by (an email — the 043 submitted_by
    precedent), never corpus text."""
    added = re.findall(r"ADD COLUMN IF NOT EXISTS (\w+)", sql)
    assert added == ["created_by", "created_by"]


def test_dev_only_header_and_rollback(sql):
    assert re.search(r"DEV/STAGING\s+(?:--\s*)?BRANCH\s+ONLY", sql)
    assert "ROLLBACK:" in sql
    assert "DROP POLICY IF EXISTS sealed_sets_register_own" in sql
    assert "DROP POLICY IF EXISTS qualifiers_register_own" in sql


def test_creator_columns_on_both_tables(sql):
    assert re.search(
        r"ALTER TABLE public\.sealed_sets\s+"
        r"ADD COLUMN IF NOT EXISTS created_by TEXT", sql)
    assert re.search(
        r"ALTER TABLE public\.qualifiers\s+"
        r"ADD COLUMN IF NOT EXISTS created_by TEXT", sql)


def test_admission_triggers_before_insert(sql):
    assert re.search(
        r"CREATE TRIGGER sealed_sets_admission_guard\s+"
        r"BEFORE INSERT ON public\.sealed_sets", sql)
    assert re.search(
        r"CREATE TRIGGER qualifiers_admission_guard\s+"
        r"BEFORE INSERT ON public\.qualifiers", sql)


def test_sealed_set_born_in_safe_state(sql):
    """Born quarantined (the 022/037 leaderboard floor) and never born
    retired — pinned in the trigger, beneath every client."""
    guard = sql.split(
        "CREATE OR REPLACE FUNCTION public.sealed_set_admission_check")[1]
    guard = guard.split("COMMENT ON FUNCTION")[0]
    assert "IF NOT NEW.quarantined THEN" in guard
    assert "must be born quarantined" in guard
    assert "NEW.status NOT IN ('planned', 'active')" in guard


def test_qualifier_born_in_safe_state(sql):
    """Born active (frozen = rotation history, never insertable) and the
    gated sealed set must exist and not be retired."""
    guard = sql.split(
        "CREATE OR REPLACE FUNCTION public.qualifier_admission_check")[1]
    guard = guard.split("COMMENT ON FUNCTION")[0]
    assert "must be born ''active''" in guard
    assert "is not registered" in guard
    assert "is retired" in guard


def test_rate_limited_both_doors_curator_lane_exempt(sql):
    """Rolling 24h per-creator throttle in BOTH guards. The limit is a named
    constant (a registration has no parent row to carry policy data — the
    header states this honestly against the 043/045 data-column precedent);
    the curator lane (created_by NULL) is exempt, the 045 shape."""
    assert "RATE LIMIT AS A CONSTANT" in sql
    for fn in ("sealed_set_admission_check", "qualifier_admission_check"):
        guard = sql.split(
            f"CREATE OR REPLACE FUNCTION public.{fn}")[1]
        guard = guard.split("COMMENT ON FUNCTION")[0]
        assert "v_limit CONSTANT int := 24" in guard
        assert "INTERVAL '24 hours'" in guard
        assert "IF NEW.created_by IS NOT NULL THEN" in guard


def test_insert_policies_identity_bound(sql):
    for policy in ("sealed_sets_register_own", "qualifiers_register_own"):
        body = sql.split(f"CREATE POLICY {policy}")[1].split(";")[0]
        assert "FOR INSERT" in body
        assert "TO authenticated" in body
        assert re.search(
            r"created_by = current_setting\('request\.jwt\.claims', "
            r"true\)::json->>'email'", body)


def test_sealed_set_policy_pins_birth_state(sql):
    body = sql.split("CREATE POLICY sealed_sets_register_own")[1].split(";")[0]
    assert "quarantined = true" in body
    assert "status IN ('planned', 'active')" in body


def test_qualifier_policy_ownership_check(sql):
    """A qualifier may only gate a sealed set the SAME identity registered —
    the node resolves the active qualifier per set, so the gate is
    security-load-bearing. Curator sets (created_by NULL) stay curator-gated
    because NULL never equals the JWT email."""
    body = sql.split("CREATE POLICY qualifiers_register_own")[1].split(";")[0]
    assert "status = 'active'" in body
    assert "sealed_set_id IS NULL" in body
    assert re.search(
        r"EXISTS \(\s*SELECT 1 FROM public\.sealed_sets s\s+"
        r"WHERE s\.sealed_set_id = qualifiers\.sealed_set_id\s+"
        r"AND s\.created_by = current_setting\('request\.jwt\.claims', "
        r"true\)::json->>'email'", body)


def test_042_terms_guard_extended_freezes_created_by(sql):
    """created_by joins the frozen-at-creation qualifier terms (no
    reattribution, not even by service_role) while the one-way
    active -> frozen rotation is preserved verbatim."""
    guard = sql.split(
        "CREATE OR REPLACE FUNCTION public.reject_illegal_qualifier_mutation")[1]
    guard = guard.split("COMMENT ON FUNCTION")[0]
    assert "NEW.created_by     IS DISTINCT FROM OLD.created_by" in guard
    assert "OLD.status = 'active' AND NEW.status = 'frozen'" in guard
    assert "active->frozen only" in guard


def test_insert_only_no_update_or_delete_door(sql):
    """One-way lifecycle preserved: the door is INSERT-only. Rotation,
    retirement, and un-quarantining remain curator/service acts."""
    assert "FOR UPDATE" not in sql
    assert "FOR DELETE" not in sql


def test_idempotent_forms(sql):
    assert "ADD COLUMN IF NOT EXISTS" in sql
    assert "CREATE INDEX IF NOT EXISTS" in sql
    assert "CREATE OR REPLACE FUNCTION" in sql
    assert "DROP TRIGGER IF EXISTS" in sql
    assert "DROP POLICY IF EXISTS" in sql
