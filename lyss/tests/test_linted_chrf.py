"""CrkLintedChrF — chrF++ saturated by linter rulings, de-noised otherwise."""

from __future__ import annotations

import pytest

sacrebleu = pytest.importorskip("sacrebleu")

from champollion_lyss.crk.linter import _normalize_orthographic
from champollion_lyss.crk.metrics import CrkLintedChrF


@pytest.fixture()
def metric():
    m = CrkLintedChrF()
    assert m._chrf is not None
    return m


def test_equivalent_word_order_scores_100(metric):
    r = metric.compute({
        "expected": "ôtênâhk anohc kî takohtêwak",
        "predicted": "anohc ôtênâhk kî-takohtêwak",
    })
    assert r["lint_verdict"] == "EQUIVALENT"
    assert r["linted_chrf"] == 100.0
    assert r["raw_chrf"] < 100.0  # the correction is visible


def test_macron_convention_scores_100(metric):
    r = metric.compute({"expected": "nâpêw", "predicted": "nāpêw"})
    assert r["linted_chrf"] == 100.0


def test_miss_scores_normalized_chrf_not_100(metric):
    exp, got = "nikî-wâpamâw", "nikî-kîmôtamawâw"
    r = metric.compute({"expected": exp, "predicted": got})
    assert r["lint_verdict"] == "MISS"
    assert r["linted_chrf"] < 100.0
    want = metric._chrf.sentence_score(
        _normalize_orthographic(got), [_normalize_orthographic(exp)]
    ).score
    assert r["linted_chrf"] == pytest.approx(want)


def test_miss_with_convention_noise_scores_above_raw(metric):
    # Reference in spaced-preverb textbook style, wrong verb in hypothesis:
    # normalization removes the convention noise, the real error remains.
    r = metric.compute({
        "expected": "kî kimiwan otâkosîhk",
        "predicted": "kî-sôhkiyowêw otâkosîhk",
    })
    assert r["lint_verdict"] == "MISS"
    assert 0.0 < r["linted_chrf"] < 100.0
    assert r["linted_chrf"] >= r["raw_chrf"]


def test_no_output_scores_zero(metric):
    r = metric.compute({"expected": "nâpêw", "predicted": ""})
    assert r["available"] is True
    assert r["linted_chrf"] == 0.0
    assert r["lint_verdict"] == "NO_OUTPUT"


def test_fail_honest_without_sacrebleu():
    m = CrkLintedChrF()
    m._chrf = None
    r = m.compute({"expected": "nâpêw", "predicted": "nâpêw"})
    assert r["available"] is False and r["linted_chrf"] is None
    agg = m.aggregate([r])
    assert agg["available"] is False


def test_aggregate_means(metric):
    a = metric.compute({"expected": "nâpêw", "predicted": "nāpêw"})       # 100
    b = metric.compute({"expected": "nâpêw", "predicted": ""})            # 0
    agg = metric.aggregate([a, b])
    assert agg["available"] is True
    assert agg["linted_chrf_mean"] == pytest.approx(50.0)
    assert agg["scored_count"] == 2
