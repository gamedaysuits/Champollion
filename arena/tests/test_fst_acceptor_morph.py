"""An acceptor-only FST measures acceptance, never morphological accuracy.

Regression (synthetic researcher, 2026-10-03): `mt-eval setup --lang sme`
installs the Divvun spell-checker ACCEPTOR (pin format divvun-macos-pkg) as
analyser.hfstol. It answers yes/no and echoes the word back with no lemma or
tags, so the lemma-matched morphological_accuracy collapsed into word overlap
(every covered word "correct") and was published as morphological accuracy.
Now the pin declares it (install.kind = "acceptor", data) and the metric also
detects it (no analysis ever carries a tag); either way the morph rates are
None with the reason stated, FST acceptance is still reported, and the
composite re-normalizes instead of counting a 0.
"""

from __future__ import annotations

import json
from pathlib import Path

from mt_eval_harness import language_cards as lc
from mt_eval_harness.plugins import fst_installer
from mt_eval_harness.plugins.giellalt_fst import GiellaLTFSTMetric
from mt_eval_harness.publish import _build_metric_availability
from mt_eval_harness.scoring import compute_composite_score


class _Acceptor:
    """What a speller acceptor's lookup returns: the word itself, no tags."""

    def __init__(self, vocab):
        self.vocab = set(vocab)

    def lookup(self, word):
        return [(word, 0.0)] if word in self.vocab else []


class _Analyzer:
    def __init__(self, vocab):
        self.vocab = set(vocab)

    def lookup(self, word):
        return [(f"{word}+N+Sg", 0.0)] if word in self.vocab else []


def _metric(transducer, fst_dir="/nonexistent"):
    m = GiellaLTFSTMetric(lang_code="sme", fst_dir=Path(fst_dir))
    m._analyzer = transducer
    return m


ROWS = [("mun lean dás", "mun lean dás"), ("son lea doppe xx", "son lea dás")]


def _aggregate(metric):
    return metric.aggregate([metric.compute({"predicted": p, "expected": r})
                             for p, r in ROWS])


VOCAB = ["mun", "lean", "dás", "son", "lea", "doppe"]


def test_detected_acceptor_withholds_morph_but_keeps_acceptance():
    agg = _aggregate(_metric(_Acceptor(VOCAB)))
    assert agg["morphological_accuracy"] is None
    assert agg["morph_coverage"] is None
    assert "no tagged analysis" in agg["morph_unavailable_reason"]
    # The acceptor still accepts/rejects words: 6 of the 7 predicted words.
    assert agg["total_valid_words"] == 6 and agg["total_words_checked"] == 7
    assert agg["avg_fst_validity"] > 0


def test_declared_acceptor_pin_withholds_morph(tmp_path):
    (tmp_path / "provenance.json").write_text(json.dumps({"kind": "acceptor"}))
    # Even a transducer that happened to return tags is not trusted for
    # morphology when its pin says it is an acceptor.
    agg = _aggregate(_metric(_Analyzer(VOCAB), fst_dir=tmp_path))
    assert agg["morphological_accuracy"] is None
    assert "kind 'acceptor'" in agg["morph_unavailable_reason"]
    assert agg["fst_version_info"]["fst_kind"] == "acceptor"


def test_a_real_analyzer_still_measures_morphology():
    agg = _aggregate(_metric(_Analyzer(VOCAB)))
    assert agg["morphological_accuracy"] == 1.0
    assert agg["morph_coverage"] is not None
    assert "morph_unavailable_reason" not in agg


def test_the_divvun_speller_pins_declare_kind_acceptor():
    lc.reset_state()
    for code in lc.fst_pinned_codes():
        info = lc.get_fst_install_info(code)
        if info["format"] == "divvun-macos-pkg":
            assert info.get("kind") == "acceptor", code
    assert lc.get_fst_install_info("sme")["kind"] == "acceptor"
    assert "kind" not in lc.get_fst_install_info("crk")


def test_installer_records_the_declared_kind(tmp_path, monkeypatch):
    monkeypatch.setattr(lc, "get_name", lambda code: code)
    fst_installer._write_provenance(
        tmp_path, "sme", {"repo": "giellalt/lang-sme", "format": "divvun-macos-pkg",
                          "kind": "acceptor"}, "0" * 64)
    assert json.loads((tmp_path / "provenance.json").read_text())["kind"] == "acceptor"
    fst_installer._write_provenance(
        tmp_path, "crk", {"repo": "giellalt/lang-crk", "format": "legacy-zip"}, "0" * 64)
    assert json.loads((tmp_path / "provenance.json").read_text())["kind"] is None


def test_run_card_states_why_morph_is_missing():
    agg = _aggregate(_metric(_Acceptor(VOCAB)))
    avail = _build_metric_availability(
        scores={}, plugin_metrics={"giellalt_fst_validity": agg}, has_fst=True,
        morph_accuracy=agg["morphological_accuracy"],
        morph_coverage=agg["morph_coverage"], morph_floor=0.25,
        has_glossary=False, has_references=True, metricx_requested=False)
    assert avail["morphological_accuracy"].startswith("unavailable: ")
    assert "acceptor" in avail["morphological_accuracy"]
    assert "fst_acceptance_rate" not in avail     # acceptance WAS measured


def test_composite_renormalizes_over_a_missing_morph_value():
    base = {"chrf_plus_plus": 40.0, "exact_match_rate": 0.1,
            "fst_acceptance_rate": 0.3}
    with_none = compute_composite_score({**base, "morphological_accuracy": None},
                                        profile="fst-coverage")
    without = compute_composite_score(base, profile="fst-coverage")
    with_zero = compute_composite_score({**base, "morphological_accuracy": 0.0},
                                        profile="fst-coverage")
    assert with_none == without and with_none != with_zero
