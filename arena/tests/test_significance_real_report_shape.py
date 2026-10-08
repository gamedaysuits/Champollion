"""Significance + CIs on reports shaped exactly as tester.py writes them.

Regression (synthetic researcher, 2026-10-03): `mt-eval compare --significance`
on two English→Northern Sami runs measured at 4.4% vs 29.7% FST validity
printed `giellalt_fst_validity.*` as 0.00 vs 0.00, p=1.000. The tests read
per-entry keys that no plugin writes ("fst_validity", and the AGGREGATE key
names looked up on each entry), and their fixtures used the same invented
keys, so everything passed. These fixtures come from the real plugin's
compute() — if the keys drift apart again, these fail.

Also covered: corpus_ter is tested and the retired composite is not
(scoring standard/1 — chrF++ first, as the primary), TER's direction (lower
is better), and a plugin key with no per-segment values is reported as not
tested instead of 0 vs 0.
"""

from __future__ import annotations

import random

import pytest

from mt_eval_harness import significance as sig
from mt_eval_harness.confidence import compute_all_cis
from mt_eval_harness.plugins.giellalt_fst import GiellaLTFSTMetric


class _StubAnalyzer:
    """A tagged analyzer over a fixed vocabulary (what a GiellaLT FST returns)."""

    def __init__(self, vocab):
        self.vocab = set(vocab)

    def lookup(self, word):
        return [(f"{word}+N+Sg", 0.0)] if word in self.vocab else []


VOCAB = [f"good{i}" for i in range(20)]


def _metric():
    m = GiellaLTFSTMetric(lang_code="sme", fst_dir="/nonexistent")
    m._analyzer = _StubAnalyzer(VOCAB)
    return m


def _report(valid_share: float, n: int = 60, seed: int = 0) -> dict:
    """A TestReport whose predictions are FST-valid at about ``valid_share``."""
    rng = random.Random(seed)
    metric = _metric()
    entries = []
    for i in range(n):
        ref = " ".join(rng.choice(VOCAB) for _ in range(4))
        words = [rng.choice(VOCAB) if rng.random() < valid_share else f"bad{i}x{j}"
                 for j in range(4)]
        pred = " ".join(words)
        entry = {"id": i, "source": f"src {i}", "expected": ref, "predicted": pred,
                 "exact_match": pred == ref, "error": None}
        entry["plugin_metrics"] = {metric.name: metric.compute(entry)}
        entries.append(entry)
    agg = metric.aggregate([e["plugin_metrics"][metric.name] for e in entries])
    return {"entries": entries, "overall": {"plugin_metrics": {metric.name: agg}}}


def _by_name(results):
    return {r.metric_name: r for r in results}


def test_fst_validity_is_tested_on_its_real_per_entry_values():
    a, b = _report(0.05, seed=1), _report(0.30, seed=2)
    agg_a = a["overall"]["plugin_metrics"]["giellalt_fst_validity"]
    agg_b = b["overall"]["plugin_metrics"]["giellalt_fst_validity"]
    res = _by_name(sig.run_significance_tests(a, b, n_bootstrap=200))

    r = res["giellalt_fst_validity.avg_fst_validity"]
    # The resampled metric reproduces the headline aggregate exactly …
    assert r.system_a_score == pytest.approx(agg_a["avg_fst_validity"], abs=1e-4)
    assert r.system_b_score == pytest.approx(agg_b["avg_fst_validity"], abs=1e-4)
    # … which is NOT the 0.00 vs 0.00, p=1.000 the bug printed.
    assert r.system_a_score < r.system_b_score
    assert r.significant and r.winner == "B"
    micro = res["giellalt_fst_validity.corpus_validity_rate"]
    assert micro.system_a_score == pytest.approx(agg_a["corpus_validity_rate"], abs=1e-4)


def test_fst_acceptance_rate_reads_the_key_the_plugin_writes():
    a = _report(0.30, seed=3)
    expected = a["overall"]["plugin_metrics"]["giellalt_fst_validity"]["avg_fst_validity"]
    assert sig.fst_acceptance_rate(a["entries"]) == pytest.approx(expected)
    assert expected > 0


def test_count_keys_are_not_tested_as_metrics():
    a, b = _report(0.05, seed=1), _report(0.30, seed=2)
    names = {r.metric_name for r in sig.run_significance_tests(a, b, n_bootstrap=50)}
    for count_key in ("total_words_checked", "total_valid_words",
                      "morph_covered_words", "morph_analyzable_words"):
        assert f"giellalt_fst_validity.{count_key}" not in names


def test_ter_is_tested_and_the_retired_composite_is_not():
    # Scoring standard/1: chrF++ is tested FIRST (the primary — it decides),
    # TER beside it (secondary); the weighted composite is retired, so the
    # battery tests no composite under either name it had.
    a, b = _report(0.05, seed=1), _report(0.30, seed=2)
    results = sig.run_significance_tests(a, b, n_bootstrap=200)
    res = _by_name(results)
    assert results[0].metric_name == "corpus_chrf"
    assert results[0].role == "primary"
    assert res["corpus_ter"].role == "secondary"
    assert "segment_composite" not in res and "composite_score" not in res
    # FST acceptance is still tested — as a diagnostic, never deciding.
    fst = res["giellalt_fst_validity.avg_fst_validity"]
    assert fst.role == "diagnostic"
    assert fst.system_b_score > fst.system_a_score


def test_legacy_composite_function_still_reads_fst():
    # composite_score is LEGACY (old cards' CIs are re-derived with it): it
    # still sees the FST data (fst-coverage profile), so B's far higher FST
    # validity moves it.
    a, b = _report(0.05, seed=1), _report(0.30, seed=2)
    assert sig.composite_score(b["entries"]) > sig.composite_score(a["entries"])


def test_ter_winner_is_the_lower_edit_rate():
    refs = [f"w{i} x y z" for i in range(30)]
    a = [{"id": i, "expected": r, "predicted": r} for i, r in enumerate(refs)]
    b = [{"id": i, "expected": r, "predicted": "q q q q"} for i, r in enumerate(refs)]
    res = sig.paired_approximate_randomization(a, b, sig.corpus_ter, n_trials=200,
                                               n_bootstrap_ci=200)
    assert res.delta < 0          # A has the lower TER …
    assert res.winner == "A"      # … so A wins.


def test_composite_fast_path_equals_string_path():
    a, b = _report(0.05, seed=4)["entries"], _report(0.30, seed=5)["entries"]
    b[3]["error"] = "timeout"     # an errored entry drops out of the composite
    assert sig.composite_score.segment_stats is not None
    stats, included, scorer = sig.composite_score.segment_stats(a)
    assert scorer(stats.sum(axis=0)) == pytest.approx(sig.composite_score(a), abs=1e-12)

    def plain(entries):
        return sig.composite_score(entries)
    fast = sig.paired_approximate_randomization(a, b, sig.composite_score,
                                                n_trials=100, n_bootstrap_ci=100, seed=9)
    slow = sig.paired_approximate_randomization(a, b, plain,
                                                n_trials=100, n_bootstrap_ci=100, seed=9)
    assert fast.p_value == slow.p_value
    assert fast.delta == pytest.approx(slow.delta, abs=1e-9)
    assert fast.ci_lower == pytest.approx(slow.ci_lower, abs=1e-9)
    assert fast.ci_upper == pytest.approx(slow.ci_upper, abs=1e-9)


def test_plugin_key_without_per_segment_values_is_reported_not_zeroed(capsys):
    a, b = _report(0.05, seed=1), _report(0.30, seed=2)
    for rep, val in ((a, 0.2), (b, 0.7)):
        rep["overall"]["plugin_metrics"]["someplugin"] = {"corpus_only_rate": val}
    names = {r.metric_name for r in sig.run_significance_tests(a, b, n_bootstrap=50)}
    assert "someplugin.corpus_only_rate" not in names
    assert "someplugin.corpus_only_rate" in capsys.readouterr().out


def test_avg_aggregate_is_tested_from_its_per_entry_value():
    a, b = _report(0.05, seed=1), _report(0.30, seed=2)
    for rep, rate in ((a, 0.0), (b, 0.5)):
        for e in rep["entries"]:
            e["plugin_metrics"]["code_switching"] = {"code_switching_rate": rate}
        rep["overall"]["plugin_metrics"]["code_switching"] = {
            "avg_code_switching_rate": rate}
    res = _by_name(sig.run_significance_tests(a, b, n_bootstrap=100))
    r = res["code_switching.avg_code_switching_rate"]
    assert (r.system_a_score, r.system_b_score) == (0.0, 0.5)


def test_fst_confidence_interval_is_computed_from_real_entries():
    cis = compute_all_cis(_report(0.30, seed=6)["entries"], n_bootstrap=100)
    assert "fst_acceptance_rate" in cis
    assert cis["fst_acceptance_rate"]["score"] > 0


def _not_computed_report(seed: int) -> dict:
    """A report scored where the FST analyzer is not installed: every entry's
    FST result is an empty dict and the aggregate is an ``error`` note — the
    shape tester.py writes since a missing FST stopped stopping the run."""
    rng = random.Random(seed)
    entries = []
    for i in range(40):
        ref = " ".join(rng.choice(VOCAB) for _ in range(4))
        pred = " ".join(rng.choice(VOCAB) for _ in range(4))
        entries.append({"id": i, "source": f"src {i}", "expected": ref,
                        "predicted": pred, "exact_match": pred == ref,
                        "error": None,
                        "plugin_metrics": {"giellalt_fst_validity": {}}})
    note = {"error": "not computed: the FST analyzer is not installed"}
    return {"entries": entries,
            "overall": {"plugin_metrics": {"giellalt_fst_validity": note}}}


def test_fst_not_computed_does_not_crash_significance():
    """Regression (synthetic school, crk, 2026-10-04): `compare --significance`
    raised KeyError: 'fst_validity_rate' on every fresh install, because the
    empty per-entry results counted as analyzed."""
    from mt_eval_harness.plugins.giellalt_fst import corpus_rates
    assert corpus_rates([{}, {}]) == {}
    a, b = _not_computed_report(1), _not_computed_report(2)
    res = _by_name(sig.run_significance_tests(a, b, n_bootstrap=50))
    assert "corpus_chrf" in res
    assert not any(name.startswith("giellalt_fst_validity.") for name in res)
