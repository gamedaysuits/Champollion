"""Migration 045 — the T2 method-submission door (Phase B).

Offline SQL-text + parse-tree assertions in the test_contest_intake_migrations
style: 045 must parse under the real PostgreSQL grammar and carry the
structural guarantees the method lane depends on — the identity-bound
participant INSERT policy (born pending, emit pinned, requested_by = JWT
email), the admission trigger (active sealed set, born-pending/undecided,
per-requester daily rate limit AS DATA), the pending-dedup partial unique
index, idempotency, and the dev-only/rollback headers. No new table: the
content-free invariant is that 045 creates NO CREATE TABLE at all.
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
    / "045_method_submission_door.sql"
)


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.exists(), f"migration missing: {MIGRATION}"
    return MIGRATION.read_text()


def test_parses_under_postgres_grammar(sql):
    stmts = pglast.parse_sql(sql)
    assert len(stmts) >= 5


def test_creates_no_new_table(sql):
    """045 only opens a door on EXISTING content-free tables."""
    kinds = {type(raw.stmt).__name__ for raw in pglast.parse_sql(sql)}
    assert "CreateStmt" not in kinds


def test_dev_only_header_and_rollback(sql):
    assert re.search(r"DEV/STAGING\s+(?:--\s*)?BRANCH\s+ONLY", sql)
    assert "ROLLBACK:" in sql
    assert "DROP POLICY IF EXISTS authorization_requests_propose_own" in sql


def test_rate_limit_is_data_not_code(sql):
    """The throttle lives in a COLUMN with a CHECK — adjustable per set."""
    assert re.search(
        r"ALTER TABLE public\.sealed_sets\s+ADD COLUMN IF NOT EXISTS "
        r"request_daily_limit INT NOT NULL DEFAULT 5", sql)
    assert re.search(r"CHECK \(request_daily_limit > 0\)", sql)
    # ...and the trigger reads it (never a literal in the guard body).
    guard = sql.split(
        "CREATE OR REPLACE FUNCTION "
        "public.authorization_request_admission_check")[1]
    guard = guard.split("COMMENT ON FUNCTION")[0]
    assert "request_daily_limit" in guard
    assert "INTERVAL '24 hours'" in guard


def test_pending_dedup_partial_unique_index(sql):
    m = re.search(
        r"CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_requests_pending_dedup"
        r"\s+ON public\.authorization_requests \(sealed_set_id, fingerprint\)"
        r"\s+WHERE state = 'pending'", sql)
    assert m, "pending-dedup partial unique index missing or reshaped"


def test_admission_trigger_guards(sql):
    assert "CREATE OR REPLACE FUNCTION public.authorization_request_admission_check()" in sql
    assert re.search(
        r"CREATE TRIGGER authorization_requests_admission_guard\s+"
        r"BEFORE INSERT ON public\.authorization_requests", sql)
    # Born pending, undecided; sealed set must exist and be active.
    for needle in (
        "must be born ''pending''",
        "decided_at cannot be set at proposal time",
        "is not registered",
        "not active",
    ):
        assert needle in sql, f"admission guard lost its {needle!r} refusal"


def test_insert_policy_is_identity_bound(sql):
    policy = sql.split("authorization_requests_propose_own")[-1]
    assert "FOR INSERT" in policy
    assert "TO authenticated" in policy
    assert re.search(
        r"requested_by = current_setting\('request\.jwt\.claims', "
        r"true\)::json->>'email'", policy)
    assert "state = 'pending'" in policy
    assert "emit  = 'scores-only'" in policy or \
        "emit = 'scores-only'" in policy


def test_idempotent_forms(sql):
    assert "ADD COLUMN IF NOT EXISTS" in sql
    assert "CREATE UNIQUE INDEX IF NOT EXISTS" in sql
    assert "CREATE OR REPLACE FUNCTION" in sql
    assert "DROP TRIGGER IF EXISTS" in sql
    assert "DROP POLICY IF EXISTS" in sql
