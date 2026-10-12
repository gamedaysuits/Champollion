"""Migration 061 — reputation-weighted auditing (B3) schema freeze.

Offline text assertions over 061_contributor_reputation.sql: the contributors +
contributor_audit_log tables, their CHECK vocabularies, the PUBLIC-READ /
service-role-write RLS posture (no client write policy), and the replay-clean
EXECUTE hygiene on the read helper. Mirrors test_launch_hardening_migrations.py.

Also freezes the two invariants B3 must NOT break:
  · the trust enum stays {unverified, verified, disqualified} (021);
  · queue_top still serves the board VERIFIED-only (059).
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "mt-eval-arena" / "supabase" / "migrations"
SQL = MIGRATIONS / "061_contributor_reputation.sql"


def _read(path: Path) -> str:
    assert path.exists(), f"missing file: {path}"
    return path.read_text(encoding="utf-8")


class TestContributorsTable:
    def test_migration_exists_and_is_next_number(self):
        assert SQL.exists(), "061 reputation migration is missing"
        assert int(SQL.name[:3]) == 61

    def test_contributors_table_and_columns(self):
        sql = _read(SQL)
        assert "create table if not exists public.contributors" in sql
        for col in ("contributor_id", "reputation", "status", "clean_audits",
                    "total_audits", "corroborations", "caught_fraud_count",
                    "verified_runs", "first_seen_at", "updated_at"):
            assert col in sql, f"contributors missing column {col}"

    def test_contributor_id_is_text_pk(self):
        # TEXT (not uuid) so a future 'key:<fp>' pseudonym slots in with no
        # migration; the canonical form today is 'uid:<owner_uid>'.
        sql = _read(SQL)
        assert re.search(r"contributor_id\s+text primary key", sql)

    def test_reputation_nonnegative_and_status_vocabulary(self):
        sql = _read(SQL)
        assert "check (reputation >= 0)" in sql
        assert "check (status in ('provisional','established','burned'))" in sql

    def test_reputation_defaults_to_zero_provisional(self):
        sql = _read(SQL)
        assert "reputation" in sql and "not null default 0" in sql
        assert "default 'provisional'" in sql


class TestAuditLog:
    def test_audit_log_table_and_columns(self):
        sql = _read(SQL)
        assert "create table if not exists public.contributor_audit_log" in sql
        for col in ("contributor_id", "run_card_id", "layer", "outcome",
                    "reputation_delta", "reputation_after", "detail", "created_at"):
            assert col in sql, f"contributor_audit_log missing column {col}"

    def test_layer_and_outcome_vocabularies(self):
        sql = _read(SQL)
        assert "check (layer in ('L0','L2','L3'))" in sql
        assert ("check (outcome in ('pass','fail','corroborated',"
                "'disagreement','burn','reaudit'))") in sql

    def test_audit_log_has_no_fk_so_it_outlives_a_board_wipe(self):
        # The retraction trail must survive DELETE FROM run_cards, so run_card_id
        # is a bare text column (the 017 run_cards_audit durability doctrine).
        sql = _read(SQL)
        assert "references public.run_cards" not in sql.lower()
        assert "references run_cards" not in sql.lower()


class TestRlsPosture:
    def test_both_tables_enable_rls(self):
        sql = _read(SQL)
        assert "alter table public.contributors           enable row level security" in sql \
            or "alter table public.contributors enable row level security" in sql
        assert "contributor_audit_log  enable row level security" in sql \
            or "contributor_audit_log enable row level security" in sql

    def test_public_read_policies_present(self):
        sql = _read(SQL)
        assert "contributors_public_read" in sql
        assert "contributor_audit_log_public_read" in sql
        assert sql.count("for select using (true)") >= 2

    def test_no_client_write_policy(self):
        # Only the service-role verifier writes (service_role bypasses RLS); a
        # client INSERT/UPDATE policy would let anyone forge reputation.
        sql = _read(SQL).lower()
        assert "for insert" not in sql
        assert "for update" not in sql
        assert "for all" not in sql


class TestReadHelperHygiene:
    def test_reputation_helper_is_security_invoker_with_search_path(self):
        sql = _read(SQL)
        assert "function public.contributor_reputation(p_contributor_id text)" in sql
        assert "security invoker" in sql
        assert "set search_path = public" in sql

    def test_execute_grant_is_replay_clean(self):
        # Drop the default PUBLIC grant, then grant only the API roles — so a
        # from-scratch replay never leaves a broad PUBLIC EXECUTE (058/DB2).
        sql = _read(SQL)
        assert ("revoke execute on function public.contributor_reputation(text) "
                "from public") in sql
        assert ("grant  execute on function public.contributor_reputation(text) "
                "to anon, authenticated") in sql \
            or ("grant execute on function public.contributor_reputation(text) "
                "to anon, authenticated") in sql

    def test_idempotent_shape(self):
        sql = _read(SQL)
        assert "create table if not exists" in sql
        assert "drop policy if exists" in sql
        assert "create or replace function" in sql


class TestDoesNotBreakExistingInvariants:
    def test_trust_enum_unchanged_by_061(self):
        # 061 must not touch the run_cards trust CHECK (021 owns it).
        sql = _read(SQL)
        assert "run_cards_trust_check" not in sql
        assert "alter table run_cards" not in sql.lower()
        assert "alter table public.run_cards" not in sql.lower()

    def test_queue_top_still_serves_verified_only(self):
        # The served-board gate (059) stays VERIFIED-only — B3 adds a reputation
        # dimension alongside it, it does not relax the coverage filter.
        q = _read(MIGRATIONS / "059_queue_items.sql")
        assert "rc.trust      = 'verified'" in q or "rc.trust = 'verified'" in q
        # And 061 does not redefine queue_top.
        assert "function public.queue_top" not in _read(SQL)

    def test_no_existing_trigger_dropped(self):
        sql = _read(SQL).lower()
        for trig in ("run_cards_quarantine_guard", "run_cards_score_integrity",
                     "run_cards_sha_parity_guard", "run_card_entries_content_guard"):
            assert f"drop trigger if exists {trig}" not in sql
