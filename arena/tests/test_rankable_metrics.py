"""Tests for rankable_metrics — the registry-driven contest metric table."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness import __version__ as HARNESS_VERSION
from mt_eval_harness import rankable_metrics as rm
from mt_eval_harness.metric_manifest import metric_manifest_path
from mt_eval_harness.significance import corpus_chrf_plain
from mt_eval_harness.tester import analyze_run_log

BUNDLED = Path(rm.__file__).parent / "data" / "metric-registry.json"


def test_bundled_registry_is_byte_identical_to_shared():
    shared = metric_manifest_path()
    if shared is None:
        pytest.skip("shared/metric-registry.json not found (standalone install)")
    assert BUNDLED.read_bytes() == shared.read_bytes(), (
        "mt_eval_harness/data/metric-registry.json has drifted from "
        "shared/metric-registry.json — copy the shared file over it")


def test_every_ranking_block_is_in_the_table_and_nothing_else():
    registry = json.loads(BUNDLED.read_text(encoding="utf-8"))
    ranked = {m for m, e in registry["entries"].items() if e.get("ranking")}
    assert set(rm.RANKABLE_METRICS) == ranked


def test_segment_functions_match_registry_segment_level():
    for mid, spec in rm.RANKABLE_METRICS.items():
        assert (spec["segment_fn"] is not None) is (mid in rm.SEGMENT_FUNCTIONS)


def test_table_refuses_segment_level_without_a_function():
    registry = {"entries": {"made_up": {
        "direction": "higher", "display_name": "X", "scale": "0-1",
        "db_column": None, "verifier_reproducible": True,
        "ranking": {"rounding": 2, "ci_columns": None, "segment_level": True,
                    "signature": {"kind": "harness"}}}}}
    with pytest.raises(rm.RankableMetricsError, match="segment function is missing"):
        rm._build_table(registry)


def test_table_refuses_a_neutral_direction():
    registry = {"entries": {"length_ratio": {
        "direction": "neutral", "display_name": "L", "scale": "0-inf",
        "db_column": None, "verifier_reproducible": True,
        "ranking": {"rounding": 2, "ci_columns": None, "segment_level": False,
                    "signature": {"kind": "harness"}}}}}
    with pytest.raises(rm.RankableMetricsError, match="direction higher\\|lower"):
        rm._build_table(registry)


def test_missing_bundled_registry_is_a_hard_error(monkeypatch):
    monkeypatch.setattr(rm, "REGISTRY_RESOURCE", "data/does-not-exist.json")
    with pytest.raises(rm.RankableMetricsError, match="missing from this install"):
        rm.load_bundled_registry()


def test_chrf_plain_segment_function_matches_sacrebleu():
    entries = [{"expected": "the cat sat", "predicted": "the cat sat down"},
               {"expected": "a dog", "predicted": "a dog"}]
    metric = rm.sacrebleu_metric("chrf_plain")
    direct = metric.corpus_score(["the cat sat down", "a dog"],
                                 [["the cat sat", "a dog"]]).score
    assert corpus_chrf_plain(entries) == pytest.approx(direct)


def _score_run(tmp_path: Path) -> dict:
    run_log = {
        "run_id": "sig",
        "config": {"target_lang": "French"},
        "results": [
            {"id": 0, "source": "Hello.", "expected": "Bonjour.",
             "predicted": "Bonjour.", "error": None},
            {"id": 1, "source": "Thanks.", "expected": "Merci.",
             "predicted": "Merci bien.", "error": None},
        ],
    }
    return analyze_run_log(run_log, output_path=tmp_path / "report.json",
                           compute_ci=False)


@pytest.mark.parametrize("metric_id", sorted(
    m for m, s in rm.RANKABLE_METRICS.items() if s["signature"]["kind"] == "sacrebleu"
    and m != "spbleu"))
def test_expected_signature_is_what_scoring_records(metric_id, tmp_path):
    """The promise a contest freezes equals the signature a real run records."""
    report = _score_run(tmp_path)
    key = rm.RANKABLE_METRICS[metric_id]["signature"]["key"]
    recorded = report["overall"]["sacrebleu_signatures"][key]
    assert rm.expected_signature(metric_id) == recorded


def test_recorded_signature_reads_each_kind():
    card = {
        "harness_version": "0.2.0",
        "sacrebleu_signatures": {"chrf": "nrefs:1|nw:2|version:2.6.0"},
        "comet_model": "Unbabel/wmt22-comet-da",
    }
    assert rm.recorded_signature(card, "chrf_plus_plus") == "nrefs:1|nw:2|version:2.6.0"
    assert rm.recorded_signature(card, "chrf_plain") is None
    assert rm.recorded_signature(card, "comet_score") == "Unbabel/wmt22-comet-da|harness:0.2.0"
    assert rm.recorded_signature(card, "composite") == "harness:0.2.0"
    assert rm.recorded_signature({}, "composite") is None


def test_model_signature_needs_the_model():
    with pytest.raises(ValueError, match="neural model"):
        rm.expected_signature("comet_score")
    assert rm.expected_signature("comet_score", model_id="m") == f"m|harness:{HARNESS_VERSION}"
    assert rm.expected_signature("composite") == f"harness:{HARNESS_VERSION}"


# ---------------------------------------------------------------------------
# Scoring standard/1 (2026-10-04): the composite is retired for NEW contests.
# ---------------------------------------------------------------------------

def test_only_the_composite_is_retired_and_it_keeps_its_table_row():
    retired = {m for m, s in rm.RANKABLE_METRICS.items() if s["retired"]}
    assert retired == {"composite"}
    # Retired for new contests, still in the table: a contest that promised
    # it keeps ranking (and keeps passing migration 076's guard).
    assert "composite" in rm.RANKABLE_METRICS
    assert "standard/1" in rm.retired_reason("composite")
    # Every standard metric (and the exact-match diagnostic) stays choosable.
    for mid in ("chrf_plus_plus", "chrf_plain", "bleu", "spbleu", "ter",
                "comet_score", "exact_match_rate"):
        rm.refuse_retired_for_new(mid)


def test_a_new_contest_choosing_the_composite_is_refused_with_the_reason():
    from mt_eval_harness.contest import computation_promise
    from mt_eval_harness.scoring import RETIRED_NOTE
    with pytest.raises(ValueError,
                       match="retired as a contest ranking metric") as exc:
        computation_promise("composite", None)
    assert RETIRED_NOTE in str(exc.value)
    assert "chrf_plus_plus (the default)" in str(exc.value)
    # The alias is refused the same way.
    with pytest.raises(ValueError, match="retired"):
        computation_promise("composite_score", None)


def test_prepare_refuses_to_record_the_composite_for_registration():
    from mt_eval_harness.contest_prep import record_registration_choices
    with pytest.raises(ValueError, match="retired"):
        record_registration_choices({}, {"primary_metric": "composite"})
    block = record_registration_choices({}, {"primary_metric": "bleu"})
    assert block["primary_metric"] == "bleu"


def test_a_new_contest_defaults_to_chrf_plus_plus():
    from mt_eval_harness.contest import computation_promise
    from mt_eval_harness.contest_prep import REGISTRATION_DEFAULTS
    from mt_eval_harness.contest_rank import DEFAULT_PRIMARY_METRIC
    from mt_eval_harness.scoring import PRIMARY_METRIC
    metric, signature, _harness = computation_promise(None, None)
    assert metric == PRIMARY_METRIC == DEFAULT_PRIMARY_METRIC == "chrf_plus_plus"
    assert "nw:2" in signature          # chrF++, word_order=2
    assert REGISTRATION_DEFAULTS["primary_metric"] == "chrf_plus_plus"
