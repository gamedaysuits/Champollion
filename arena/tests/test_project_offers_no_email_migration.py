"""Migration 080 — a helper in Join a project is never known by email (docs
review 2026-10-12, #2 and #24). Offline parse-tree and text checks; the
behaviour is checked on a throwaway PostgreSQL by
mt-eval-arena/supabase-local/plain-pg/check_080.sh."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pglast = pytest.importorskip("pglast", reason="pip install pglast to validate migration SQL")

MIGRATION = (Path(__file__).resolve().parents[2] / "mt-eval-arena" / "supabase" / "migrations"
             / "080_project_offers_no_email.sql")


@pytest.fixture(scope="module")
def sql() -> str:
    return MIGRATION.read_text()


def test_it_parses(sql):
    pglast.parse_sql(sql)


def test_helpers_are_keyed_by_account_id_never_email(sql):
    # every helper-side check reads the JWT sub; the owner side (project_owners) is unchanged
    for policy in ("project_offers_submit", "project_offers_helper_withdraw", "project_offers_upload_own_folder",
                   "project_offers_helper_remove"):
        body = sql.split(f"CREATE POLICY {policy}", 1)[1].split(";", 1)[0]
        assert "->> 'sub'" in body, policy
        assert "submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')" not in body
    assert "NEW.submitted_by := v_sub" in sql, "the trigger sets the helper from their own token"
    assert re.search(r"CREATE TRIGGER project_offers_aa_set_helper\s+BEFORE INSERT", sql)


def test_files_can_be_removed_only_when_the_offer_no_longer_stands(sql):
    helper = sql.split("CREATE POLICY project_offers_helper_remove", 1)[1].split(";", 1)[0]
    assert "FOR DELETE" in helper and "status IN ('offered', 'accepted')" in helper and "NOT EXISTS" in helper
    owner = sql.split("CREATE POLICY project_offers_owner_remove_declined", 1)[1].split(";", 1)[0]
    assert "FOR DELETE" in owner and "f.status = 'declined'" in owner


def test_it_refuses_to_run_over_offers_keyed_by_email(sql):
    assert "submitted_by LIKE '%@%'" in sql and "RAISE EXCEPTION '080:" in sql
