"""Tests for migration 077 — scoring standard/1 beneath every client.

077 marks retired ranking metrics in ``public.rankable_metrics`` and refuses
them for NEW contests and qualifiers, and moves the qualifier default from
the composite to chrF++. These tests hold the SQL to the registry's
``ranking.retired`` reasons and to the harness's qualifier metric. The
behavioural checks (10 psql scenarios on Postgres 16) are recorded in the
migration index.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pglast = pytest.importorskip("pglast")

from mt_eval_harness.qualifier_gate import QUALIFIER_METRIC  # noqa: E402
from mt_eval_harness.rankable_metrics import RANKABLE_METRICS  # noqa: E402
from mt_eval_harness.scoring import PRIMARY_METRIC  # noqa: E402

MIG_DIR = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
)
MIGRATION = MIG_DIR / "077_retired_metrics_and_chrf_qualifier_default.sql"


def _sql() -> str:
    assert MIGRATION.exists(), f"migration missing: {MIGRATION}"
    return MIGRATION.read_text(encoding="utf-8")


def test_number_is_unique_and_follows_076():
    numbers = sorted(int(p.name[:3]) for p in MIG_DIR.glob("[0-9][0-9][0-9]_*.sql"))
    assert numbers.count(77) == 1
    assert 76 in numbers


def test_parses_as_postgres():
    pglast.parse_sql(_sql())


def test_retires_exactly_the_registry_retired_metrics_with_their_reasons():
    retired_sql = dict(re.findall(
        r"retired_reason = '((?:[^']|'')*)'\s+WHERE metric_id = '([a-z0-9_]+)'",
        _sql()))
    retired_sql = {mid: reason.replace("''", "'") for reason, mid in retired_sql.items()}
    retired_registry = {mid: spec["retired"] for mid, spec in RANKABLE_METRICS.items()
                        if spec.get("retired")}
    assert retired_sql == retired_registry


def test_relabels_retired_rows_with_the_registry_label():
    for mid, spec in RANKABLE_METRICS.items():
        if spec.get("retired"):
            assert f"display_name   = '{spec['label']}'" in _sql()


def test_qualifier_default_is_the_harness_qualifier_metric():
    assert QUALIFIER_METRIC == PRIMARY_METRIC
    assert f"ALTER COLUMN metric SET DEFAULT '{QUALIFIER_METRIC}'" in _sql()


def test_guard_checks_only_new_choices_and_reads_the_table():
    sql = _sql()
    assert "TG_OP = 'UPDATE' AND v_old IS NOT DISTINCT FROM v_metric" in sql
    assert "FROM public.rankable_metrics r" in sql
    assert "BEFORE INSERT OR UPDATE OF metadata ON public.contests" in sql
    assert "BEFORE INSERT OR UPDATE OF metric ON public.qualifiers" in sql


def test_lifecycle_guard_is_not_reissued():
    assert "FUNCTION public.contest_lifecycle_guard" not in _sql()
