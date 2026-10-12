"""ci-scoring tests run against the REAL harness (monorepo sibling arena/,
resolved by nmt_forge._harness) — forge has no metric math of its own to test.
Bootstrap sizes are turned down for speed; defaults stay sacrebleu-matched.
"""

import pytest

from nmt_forge.errors import (
    PreregistrationMissing,
    ScoringError,
    SealedSetSpent,
)
from nmt_forge.guards import preregister
from nmt_forge.guards.ci_scoring import (
    compare,
    compare_on_eval_set,
    score,
    score_eval_set,
)
from tests.conftest import write_jsonl

REFS = [f"zin bel korma ten {i} pol nar sem" for i in range(16)]
GOOD = REFS  # perfect hypotheses
BAD = [f"totally unrelated words {i} here" for i in range(16)]


def test_score_always_carries_ci():
    report = score(GOOD, REFS, n_bootstrap=100)
    chrf = report.scores["chrf++"]
    assert chrf["score"] == pytest.approx(100.0, abs=0.1)
    assert chrf["ci_lower"] <= chrf["score"] <= chrf["ci_upper"]
    assert report.scores["exact_match"]["score"] == 1.0
    out = report.format()
    assert "[" in out and "95% CI" in out  # no bare-score rendering


def test_misalignment_refused():
    with pytest.raises(ScoringError, match="hypotheses"):
        score(GOOD[:3], REFS, n_bootstrap=50)


def test_unknown_metric_lists_all_lanes():
    with pytest.raises(ScoringError, match="neural lanes") as e:
        score(GOOD, REFS, metrics=("vibes",), n_bootstrap=50)
    assert "comet" in str(e.value)  # the error teaches what IS available
    # comet itself is a KNOWN lane now — absent extras report, never raise
    report = score(GOOD, REFS, metrics=("comet",), n_bootstrap=50)
    assert "comet" in report.notes or "comet" in report.scores


def test_compare_significant_winner():
    report = compare(GOOD, BAD, REFS, n_trials=100, n_bootstrap_ci=50,
                     labels=("clean", "garbage"))
    r = report.results["chrf++"]
    assert r["significant"] is True
    assert r["winner"] == "clean"
    assert "paired" in report.format()


def _register_test_set(ws, tmp_path, name="scored-test", role="test", n=12):
    rows = [{"source": f"src {i} tok", "reference": f"zin bel korma {i}"}
            for i in range(n)]
    p = write_jsonl(tmp_path / f"{name}.jsonl", rows)
    ws.registry.register(name, p, role)
    return [r["reference"] for r in rows]


def test_test_role_scoring_requires_prereg(ws, tmp_path):
    refs = _register_test_set(ws, tmp_path)
    with pytest.raises(PreregistrationMissing) as e:
        score_eval_set(ws, "scored-test", refs, n_bootstrap=50)
    assert "fix:" in str(e.value)
    # and the refusal left NO score-purpose read in the ledger
    assert ws.ledger.find("read", set="scored-test", purpose="score") == []


def test_prereg_then_score_then_check(ws, tmp_path):
    refs = _register_test_set(ws, tmp_path)
    preregister.new(
        ws, prereg_id="p1", eval_set="scored-test",
        predictions=[{"metric": "chrf++", "direction": "increase",
                      "baseline_score": 50.0, "margin": 5.0,
                      "rationale": "perfect decode should max the metric"}],
    )
    report = score_eval_set(ws, "scored-test", refs, n_bootstrap=50)
    assert report.eval_set == "scored-test"
    assert ws.ledger.find("score", set="scored-test")
    rows = preregister.check(preregister.load(ws, "p1"), report.scores)
    assert rows[0]["verdict"] == "held"


def test_dev_role_scores_without_prereg(ws, dev_set):
    refs = [r["reference"] for r in dev_set]
    report = score_eval_set(ws, "toy-dev", refs, n_bootstrap=50)
    assert report.scores["chrf++"]["score"] == pytest.approx(100.0, abs=0.1)


def test_sealed_set_spends_once(ws, tmp_path):
    refs = _register_test_set(ws, tmp_path, name="final", role="sealed")
    preregister.new(
        ws, prereg_id="pf", eval_set="final",
        predictions=[{"metric": "chrf++", "expect": ">= 90",
                      "rationale": "identity decode"}],
    )
    score_eval_set(ws, "final", refs, n_bootstrap=50)
    assert ws.ledger.sealed_spent("final")
    with pytest.raises(SealedSetSpent):
        score_eval_set(ws, "final", refs, n_bootstrap=50)
    # loud, reasoned override is possible and ledgered
    score_eval_set(ws, "final", refs, n_bootstrap=50,
                   override_respend="paper camera-ready re-run")
    assert ws.ledger.find("override", set="final")


def test_compare_table_refuses_without_prereg(ws, tmp_path):
    refs = _register_test_set(ws, tmp_path, name="ab-test")
    with pytest.raises(PreregistrationMissing):
        compare_on_eval_set(ws, "ab-test", refs, list(reversed(refs)),
                            n_trials=50, n_bootstrap_ci=50)
    preregister.new(
        ws, prereg_id="pab", eval_set="ab-test",
        predictions=[{"metric": "chrf++", "expect": "A beats B",
                      "rationale": "A is the identity decode"}],
    )
    report = compare_on_eval_set(
        ws, "ab-test", refs, [f"noise {i}" for i in range(len(refs))],
        labels=("A", "B"), n_trials=100, n_bootstrap_ci=50,
    )
    assert report.results["chrf++"]["winner"] == "A"


def test_hypothesis_count_mismatch_on_eval_set(ws, dev_set):
    with pytest.raises(ScoringError, match="rows"):
        score_eval_set(ws, "toy-dev", ["only one"], n_bootstrap=50)
