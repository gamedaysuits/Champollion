"""The fail-honest metric contract — the core of this refactor.

When the FST, the spaCy model, or gloss data is missing, CrkSemanticMetric must
return available=False + a reason and NEVER fabricate a verdict.
"""

from __future__ import annotations

from types import SimpleNamespace

from champollion_lyss.crk import metrics as M
from champollion_lyss.crk import semantic_validator as sv
from champollion_lyss.crk import fst_adapter as fa


def _se(predicted="bbb", expected="aaa"):
    return {"english": "x", "predicted": predicted, "expected": expected}


def test_semantic_unavailable_when_fst_missing(monkeypatch):
    monkeypatch.setattr(fa.FSTAnalyzer, "is_available", lambda self: False)
    out = M.CrkSemanticMetric().compute(_se())
    assert out["available"] is False
    assert out["semantic_verdict"] is None
    assert "FST" in out["reason"]


def test_semantic_unavailable_when_spacy_model_missing(monkeypatch):
    monkeypatch.setattr(fa.FSTAnalyzer, "is_available", lambda self: True)

    def boom():
        raise ImportError("no spaCy model")

    monkeypatch.setattr(sv, "load_nlp", boom)
    out = M.CrkSemanticMetric().compute(_se())
    assert out["available"] is False
    assert out["semantic_verdict"] is None
    assert "spaCy" in out["reason"] or "spacy" in out["reason"].lower()


def test_semantic_withheld_when_gloss_unavailable(monkeypatch, fake_nlp):
    monkeypatch.setattr(fa.FSTAnalyzer, "is_available", lambda self: True)
    monkeypatch.setattr(sv, "load_nlp", lambda: fake_nlp)
    # Gloss branch ran (pair_verdicts non-empty) but glosses couldn't be served.
    monkeypatch.setattr(
        sv, "load_gloss_map",
        lambda: SimpleNamespace(unavailable_reason="itwêwina API unavailable (OSError)"),
    )
    monkeypatch.setattr(
        sv, "validate_entry",
        lambda e, g, gl, n: SimpleNamespace(verdict="WRONG", pair_verdicts=[1]),
    )
    out = M.CrkSemanticMetric().compute(_se())
    assert out["available"] is False
    assert out["semantic_verdict"] is None
    assert "gloss" in out["reason"]


def test_semantic_happy_path_returns_real_verdict(monkeypatch, fake_nlp):
    monkeypatch.setattr(fa.FSTAnalyzer, "is_available", lambda self: True)
    monkeypatch.setattr(sv, "load_nlp", lambda: fake_nlp)
    monkeypatch.setattr(
        sv, "load_gloss_map", lambda: SimpleNamespace(unavailable_reason=None)
    )
    monkeypatch.setattr(
        sv, "validate_entry",
        lambda e, g, gl, n: SimpleNamespace(verdict="VALID", pair_verdicts=[1]),
    )
    out = M.CrkSemanticMetric().compute(_se())
    assert out == {"semantic_verdict": "VALID", "available": True}


def test_semantic_fast_paths_need_no_resources():
    m = M.CrkSemanticMetric()
    assert m.compute(_se(predicted="", expected="atim")) == {
        "semantic_verdict": "NO_OUTPUT", "available": True,
    }
    assert m.compute(_se(predicted="atim", expected="atim")) == {
        "semantic_verdict": "EXACT_MATCH", "available": True,
    }


def test_aggregate_excludes_unavailable_from_counts():
    agg = M.CrkSemanticMetric().aggregate([
        {"semantic_verdict": "VALID", "available": True},
        {"semantic_verdict": None, "available": False, "reason": "no fst"},
        {"semantic_verdict": "WRONG", "available": True},
    ])
    assert agg["semantic_verdict_counts"] == {"VALID": 1, "WRONG": 1}
    assert agg["scored_count"] == 2
    assert agg["unavailable_count"] == 1
    assert agg["available"] is True


def test_aggregate_all_unavailable_reports_metric_unavailable():
    agg = M.CrkSemanticMetric().aggregate(
        [{"semantic_verdict": None, "available": False, "reason": "no fst"}]
    )
    assert agg["available"] is False
    assert agg["semantic_verdict_counts"] == {}
    assert agg["scored_count"] == 0


def test_linter_reports_fst_availability(monkeypatch):
    monkeypatch.setattr(fa.FSTAnalyzer, "is_available", lambda self: False)
    m = M.CrkLinterMetric()
    out = m.compute({"predicted": "atim", "expected": "atim mîcisow"})
    assert out["fst_available"] is False
    agg = m.aggregate([out])
    assert agg["synonym_detection_available"] is False
