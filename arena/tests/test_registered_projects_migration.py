"""Migration 079 — registered projects ("Join a project", founder 2026-10-12).

Offline SQL-text + parse-tree assertions in the test_registration_door_migration
style: 079 must parse under the real PostgreSQL grammar and carry the
structural guarantees the helper door depends on —

  * the public face (projects) holds no email: the owner lives in a private
    table only a definer trigger writes (no user may claim a project);
  * a project is born pending_review, and no owner policy can list it — the
    curator lists through service_role, beneath un-bypassable triggers;
  * an edit of what the public sees goes back through review; a decline says why;
  * offers are private to the helper and the owner; the helper may only
    withdraw, the owner may only accept or decline; an offer is immutable;
  * the offered-files bucket is private, upload only into your own folder of a
    listed project, read by the helper or the owner, no UPDATE/DELETE;
  * content-free columns, dev-only header, rollback, idempotency.

(The plpgsql bodies are checked by the local-stack run: reset.sh + sanity.)
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pglast = pytest.importorskip("pglast", reason="pip install pglast to validate migration SQL")

MIGRATION = (Path(__file__).resolve().parents[2] / "mt-eval-arena" / "supabase" / "migrations"
             / "079_registered_projects.sql")


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.exists(), f"migration missing: {MIGRATION}"
    return MIGRATION.read_text()


def _table(sql: str, name: str) -> str:
    m = re.search(rf"CREATE TABLE IF NOT EXISTS public\.{name} \((.*?)\n\);", sql, re.S)
    assert m, f"no CREATE TABLE for {name}"
    return m.group(1)


def _policy(sql: str, name: str) -> str:
    m = re.search(rf"CREATE POLICY {name} ON (.*?);\n", sql, re.S)
    assert m, f"no policy {name}"
    return m.group(1)


def test_parses_under_postgres_grammar(sql):
    stmts = pglast.parse_sql(sql)
    kinds = [type(s.stmt).__name__ for s in stmts]
    assert kinds.count("CreateStmt") == 4
    assert kinds.count("CreatePolicyStmt") >= 10


def test_dev_only_header_rollback_and_idempotency(sql):
    assert re.search(r"DEV/STAGING\s+BRANCH\s+ONLY", sql)
    assert "ROLLBACK:" in sql
    for t in ("projects", "project_owners", "project_asks", "project_offers"):
        assert f"CREATE TABLE IF NOT EXISTS public.{t}" in sql
        assert f"DROP TABLE IF EXISTS public.{t};" in sql          # in the rollback
    assert "ON CONFLICT (id) DO UPDATE SET public = false" in sql


def test_the_public_face_holds_no_email(sql):
    body = _table(sql, "projects")
    assert "created_by" not in body and "email" not in body
    owners = _table(sql, "project_owners")
    assert "created_by  TEXT NOT NULL" in owners


def test_no_user_can_write_an_ownership_row(sql):
    """Only the definer trigger (and the curator) write project_owners."""
    assert not re.search(r"CREATE POLICY \w+ ON public\.project_owners\s+FOR (INSERT|UPDATE|DELETE|ALL)", sql)
    fn = re.search(r"CREATE OR REPLACE FUNCTION public\.project_bind_owner\(\)(.*?)\$\$;", sql, re.S).group(1)
    assert "SECURITY DEFINER" in fn and "SET search_path = public" in fn
    assert "REVOKE EXECUTE ON FUNCTION public.project_bind_owner() FROM PUBLIC, anon, authenticated;" in sql


def test_born_pending_review_and_owners_never_list(sql):
    assert "IF NEW.status IS DISTINCT FROM 'pending_review' THEN" in sql
    assert re.search(r"CREATE TRIGGER projects_admission_guard\s+BEFORE INSERT ON public\.projects", sql)
    reg = _policy(sql, "projects_register")
    assert "FOR INSERT TO authenticated" in reg and "status = 'pending_review'" in reg
    upd = _policy(sql, "projects_owner_update")
    assert "FOR UPDATE TO authenticated" in upd
    assert "status IN ('pending_review', 'closed')" in upd and "'listed'" not in upd


def test_review_transitions_and_decline_reason(sql):
    fn = re.search(r"FUNCTION public\.reject_illegal_project_transition\(\)(.*?)\$\$;", sql, re.S).group(1)
    assert "NEW.status = 'listed' AND OLD.status IN ('pending_review', 'paused')" in fn
    assert "needs a review_note that says why" in fn
    assert "closing is final" in fn
    assert "goes back through review" in fn                        # an edit unlists
    assert re.search(r"CREATE TRIGGER projects_transition_guard\s+BEFORE UPDATE ON public\.projects", sql)


def test_listed_projects_and_their_asks_are_public_nothing_else(sql):
    read = _policy(sql, "projects_read")
    assert "TO anon, authenticated" in read and "status = 'listed'" in read
    asks = _policy(sql, "project_asks_read")
    assert "p.status = 'listed'" in asks


def test_offers_are_private_and_one_way(sql):
    read = _policy(sql, "project_offers_read")
    assert "TO authenticated" in read and "anon" not in read
    helper = _policy(sql, "project_offers_helper_withdraw")
    assert "status = 'withdrawn'" in helper
    owner = _policy(sql, "project_offers_owner_decide")
    assert "status IN ('accepted', 'declined')" in owner
    fn = re.search(r"FUNCTION public\.reject_illegal_offer_transition\(\)(.*?)\$\$;", sql, re.S).group(1)
    assert "OLD.status <> 'offered'" in fn
    assert "is immutable once made" in fn
    adm = re.search(r"FUNCTION public\.project_offer_admission_check\(\)(.*?)\$\$;", sql, re.S).group(1)
    assert "is not listed" in adm and "storage_path must be" in adm


def test_offered_files_bucket_is_private_and_immutable(sql):
    up = re.search(r"CREATE POLICY project_offers_upload_own_folder ON storage\.objects(.*?);\n", sql, re.S).group(1)
    assert "FOR INSERT TO authenticated" in up
    assert "(storage.foldername(name))[2]" in up and "p.status = 'listed'" in up
    rd = re.search(r"CREATE POLICY project_offers_read_helper_or_owner ON storage\.objects(.*?);\n", sql, re.S).group(1)
    assert "FOR SELECT TO authenticated" in rd and "project_owners" in rd
    assert not re.search(r"ON storage\.objects\s+FOR (UPDATE|DELETE)", sql)


def test_content_free_columns(sql):
    """No column holds a sentence of anyone's data: descriptions, capped."""
    for t in ("projects", "project_asks", "project_offers"):
        body = _table(sql, t)
        assert not re.search(r"\b(source_text|target_text|sentence|reference|plaintext)\b", body), t
    assert "length(about) <= 1200" in sql and "length(trim(what)) BETWEEN 1 AND 600" in sql
