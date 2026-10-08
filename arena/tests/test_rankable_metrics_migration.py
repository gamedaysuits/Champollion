"""Tests for migration 076 — rankable metrics as data, computation promises frozen.

076 moves the contest ranking vocabulary into ``public.rankable_metrics``
(seeded from the registry's ``ranking`` entries) and re-issues 074's
``contest_lifecycle_guard()`` with ``metric_signature`` and ``harness_version``
added to the frozen PROMISE keys. These tests hold the SQL and the Python
twins (``rankable_metrics.RANKABLE_METRICS``, ``contest_policy.
FROZEN_PROMISE_KEYS``) to one vocabulary, and hold the re-issued guard to
074's body plus exactly the documented changes. The behavioural checks (12
psql scenarios on Postgres 16) are recorded in the migration index.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pglast = pytest.importorskip("pglast")

from mt_eval_harness.contest_policy import FROZEN_PROMISE_KEYS  # noqa: E402
from mt_eval_harness.rankable_metrics import RANKABLE_METRICS  # noqa: E402

MIG_DIR = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
)
MIGRATION = MIG_DIR / "076_rankable_metrics_and_computation_promises.sql"
M074 = MIG_DIR / "074_contest_entries_phases_and_promises.sql"
GUARD_START = "CREATE OR REPLACE FUNCTION public.contest_lifecycle_guard()"
GUARD_END = "EXECUTE FUNCTION public.contest_lifecycle_guard();"


def _sql() -> str:
    assert MIGRATION.exists(), f"migration missing: {MIGRATION}"
    return MIGRATION.read_text(encoding="utf-8")


def _guard(text: str) -> str:
    start = text.index(GUARD_START)
    end = text.index(GUARD_END, start) + len(GUARD_END)
    return text[start:end]


def test_number_is_unique_and_follows_075():
    numbers = sorted(int(p.name[:3]) for p in MIG_DIR.glob("[0-9][0-9][0-9]_*.sql"))
    assert numbers.count(76) == 1
    assert 75 in numbers


def test_parses_as_postgres():
    pglast.parse_sql(_sql())


#: Display names 076 seeded before scoring standard/1 retired the metric. The
#: registry now names a retired metric as retired; the database row keeps the
#: seeded name until a migration renames it (076 is applied to prod and is
#: never edited). The metric id and direction must still match.
_SEEDED_BEFORE_RETIREMENT = {"composite": "Composite Score (experimental)"}


def test_seed_is_the_registry_ranking_set():
    rows = re.findall(r"\(\s*'([a-z0-9_]+)',\s*'((?:[^']|'')*)',\s*'(higher|lower)',", _sql())
    seeded = {mid: (name.replace("''", "'"), direction) for mid, name, direction in rows}
    assert seeded == {
        mid: (_SEEDED_BEFORE_RETIREMENT[mid] if spec.get("retired")
              else spec["label"], spec["direction"])
        for mid, spec in RANKABLE_METRICS.items()}


def test_a_retired_metric_keeps_its_seeded_row():
    """Retiring a metric for NEW contests never removes it from the table:
    a contest that promised it must keep passing contest_lifecycle_guard()."""
    retired = {mid for mid, spec in RANKABLE_METRICS.items() if spec.get("retired")}
    assert retired == set(_SEEDED_BEFORE_RETIREMENT)
    for mid in retired:
        assert f"('{mid}', " in _sql()


def test_frozen_promise_keys_match_python():
    m = re.search(r"v_frozen_promise_keys CONSTANT text\[\] := ARRAY\[(.+?)\];", _sql(), re.S)
    assert m
    keys = tuple(k.strip().strip("'") for k in m.group(1).split(",") if k.strip())
    assert keys == FROZEN_PROMISE_KEYS


def test_vocabulary_is_read_from_the_table_not_hard_coded():
    guard = _guard(_sql())
    assert "v_metric NOT IN" not in guard
    assert "FROM public.rankable_metrics r WHERE r.metric_id = v_metric" in guard


def test_table_is_public_read_so_the_guard_is_not_deny_all():
    sql = _sql()
    assert "ALTER TABLE public.rankable_metrics ENABLE ROW LEVEL SECURITY" in sql
    assert re.search(r"CREATE POLICY rankable_metrics_public_read\s+ON public\.rankable_metrics "
                     r"FOR SELECT USING \(true\)", sql)


def test_guard_is_074s_body_plus_exactly_the_documented_changes():
    """Everything 072/074 enforce survives: the only differences from 074's
    guard are the metric check, the two promise keys and the comment."""
    old = _guard(M074.read_text(encoding="utf-8")).splitlines()
    new = _guard(_sql()).splitlines()
    removed = [line for line in old if line not in new]
    added = [line for line in new if line not in old]
    removed_text = "\n".join(removed)
    # Only the hard-coded vocabulary, its error texts, the key array's last
    # line and the COMMENT may go.
    assert "v_metric NOT IN ('chrf_plus_plus', 'bleu', 'comet_score', 'composite')" in removed_text
    for line in removed:
        assert any(token in line for token in (
            "primary_metric", "v_metric NOT IN", "sealed_holdout_set_id'];",
            "Contest lifecycle discipline",
            "NEW.metadata -> 'primary_metric';", "v_metric;",
        )), f"076 dropped a line 074 enforced: {line!r}"
    added_text = "\n".join(added)
    assert "'declared_power'];" in added_text
    assert "must be a non-empty string (the promised computation)" in added_text
