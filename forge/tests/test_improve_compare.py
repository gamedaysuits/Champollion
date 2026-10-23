"""The improve loop's round verdict (journey plan, Phase 2): a new round's
model is judged against the model in use on the same dev sentences, paired;
the test set is never read for it."""

import json
from pathlib import Path

import pytest

from nmt_forge.guards import ci_scoring
from nmt_forge.improve import compare as compare_mod
from nmt_forge.improve.compare import (IMPROVE_COMPARE, MIN_DECIDING, RoundError, compare_runs,
                                       detectable_difference, latest_verdict, verdict_text)
from nmt_forge.training.run import DEV_OUTPUTS, read_dev_outputs, run
from tests.conftest import write_jsonl
from tests.test_training_run import _setup


def _two_rounds(ws, tmp_path):
    cfg = _setup(ws, tmp_path)
    first = run(cfg)
    gold = tmp_path / "gold.jsonl"
    gold.write_text(gold.read_text() + json.dumps({"source": "the florp 77 sings", "target": "florpa77 zam"}) + "\n")
    second = run(cfg)
    return first, second


def test_every_run_keeps_its_dev_translations(ws, dev_set, tmp_path):
    cfg = _setup(ws, tmp_path)
    m = run(cfg)
    head, hyps = read_dev_outputs(Path(m["manifest_path"]).parent)
    assert head["dev_sha256"] == m["dev_set"]["sha256"]
    assert len(hyps) == head["n"] == m["dev_report"]["n"]


@pytest.fixture
def any_size(monkeypatch):
    """The verdict RULE on the 8-sentence toy dev set (the size floor is its own test)."""
    monkeypatch.setattr(compare_mod, "MIN_DECIDING", 1)


def test_under_50_dev_sentences_no_round_is_decided(ws, dev_set, tmp_path):
    # stress test 6, on G1's outputs: at 23 sentences even the interval-and-p
    # rule called near-equal models different 9 times in 100 and saw a real
    # +5.9 gain 21 times in 100; at 50, 4 and 96
    assert MIN_DECIDING == 50
    first, second = _two_rounds(ws, tmp_path)
    entry = ws.registry.get("toy-dev")
    refs = [json.loads(x)[entry["target_field"]] for x in Path(entry["path"]).read_text().splitlines() if x.strip()]
    run_dir = Path(second["manifest_path"]).parent
    head, _ = read_dev_outputs(run_dir)
    # even a new model that gets every dev sentence right
    (run_dir / DEV_OUTPUTS).write_text(json.dumps(head) + "\n" + "".join(json.dumps({"hyp": r}) + "\n" for r in refs))
    e = compare_runs(ws, first["manifest_path"], second["manifest_path"], n_trials=200, n_bootstrap=200)
    assert e["verdict"] == "too-few" and e["n"] == 8
    t = verdict_text(e)
    assert "too few dev sentences to tell: below 50" in t and "the speaker's marks decide" in t
    assert "put it to use" not in t


def test_the_same_model_twice_is_no_measurable_change(ws, dev_set, test_set, tmp_path, any_size):
    first, second = _two_rounds(ws, tmp_path)
    reads_before = len(ws.ledger.find("read", set="toy-test", purpose="score"))
    e = compare_runs(ws, first["manifest_path"], second["manifest_path"], n_trials=200, n_bootstrap=200)
    assert e["verdict"] == "no-change" and e["round"] == 1 and e["n"] == first["dev_report"]["n"]
    assert "no measurable change" in verdict_text(e)
    # judged on dev: the test set is not read for a round
    assert len(ws.ledger.find("read", set="toy-test", purpose="score")) == reads_before
    assert ws.ledger.find(IMPROVE_COMPARE)[-1]["new"] == second["run_name"]
    assert latest_verdict(ws, second["manifest_path"])["verdict"] == "no-change"


def test_a_model_that_gets_the_dev_sentences_right_is_better(ws, dev_set, tmp_path, any_size):
    first, second = _two_rounds(ws, tmp_path)
    # the new round's saved translations: the dev references themselves
    entry = ws.registry.get("toy-dev")
    refs = [json.loads(x)[entry["target_field"]] for x in Path(entry["path"]).read_text().splitlines() if x.strip()]
    run_dir = Path(second["manifest_path"]).parent
    head, _ = read_dev_outputs(run_dir)
    (run_dir / DEV_OUTPUTS).write_text(json.dumps(head) + "\n" + "".join(json.dumps({"hyp": r}) + "\n" for r in refs))
    e = compare_runs(ws, first["manifest_path"], second["manifest_path"], n_trials=200, n_bootstrap=200)
    assert e["verdict"] == "better" and e["score_new"] > e["score_in_use"] and e["ci"][0] > 0
    assert "put it to use" in verdict_text(e)


def test_runs_on_different_dev_sets_are_not_compared(ws, dev_set, tmp_path):
    first, second = _two_rounds(ws, tmp_path)
    m = json.loads(Path(second["manifest_path"]).read_text())
    m["dev_set"]["name"] = "another-dev"
    Path(second["manifest_path"]).write_text(json.dumps(m))
    with pytest.raises(RoundError, match="different dev sets"):
        compare_runs(ws, first["manifest_path"], second["manifest_path"])


def test_a_new_run_tuned_on_an_older_dev_set_is_trained_again(ws, dev_set, tmp_path):
    first, second = _two_rounds(ws, tmp_path)
    m = json.loads(Path(second["manifest_path"]).read_text())
    m["dev_set"]["sha256"] = "0" * 64
    Path(second["manifest_path"]).write_text(json.dumps(m))
    with pytest.raises(RoundError, match="changed after the new run was trained"):
        compare_runs(ws, first["manifest_path"], second["manifest_path"])


def test_a_new_run_without_saved_dev_translations_says_how_to_get_them(ws, dev_set, tmp_path):
    first, second = _two_rounds(ws, tmp_path)
    (Path(second["manifest_path"]).parent / DEV_OUTPUTS).unlink()
    with pytest.raises(RoundError, match="no saved dev translations"):
        compare_runs(ws, first["manifest_path"], second["manifest_path"])


def test_the_model_in_use_translates_the_dev_set_again_when_it_kept_none(ws, dev_set, tmp_path):
    first, second = _two_rounds(ws, tmp_path)
    (Path(first["manifest_path"]).parent / DEV_OUTPUTS).unlink()
    e = compare_runs(ws, first["manifest_path"], second["manifest_path"], n_trials=200, n_bootstrap=200)
    assert e["in_use_redecoded"] is True and e["n"] == len(dev_set)


def test_a_grown_dev_set_is_judged_whole(ws, dev_set, tmp_path):
    """The practice set grew between rounds: the new run is tuned on it as it
    is now, and the model in use translates all of it again — same sentences,
    row by row (FORGE_MACHINE_CRITIQUE finding 1)."""
    cfg = _setup(ws, tmp_path)
    first = run(cfg)
    grown = dev_set + [{"source": f"the dax {i} wakes up", "reference": f"daxko{i} wek"} for i in range(8, 20)]
    path = write_jsonl(tmp_path / "eval" / "toy-dev-r2.jsonl", grown)
    ws.registry.register("toy-dev", path, "dev", allow_rotate=True)
    second = run(cfg)
    e = compare_runs(ws, first["manifest_path"], second["manifest_path"], n_trials=200, n_bootstrap=200)
    assert e["n"] == 20 and e["in_use_redecoded"] is True
    assert second["dev_set"]["rows"] == 20 and first["dev_set"]["rows"] == 8


def test_better_needs_the_paired_test_too(ws, dev_set, tmp_path, monkeypatch, any_size):
    """An interval clear of zero with p = 0.2 is no measurable change: at small
    n the percentile interval alone calls equal models different too often."""
    first, second = _two_rounds(ws, tmp_path)
    real = ci_scoring.compare

    def lucky_interval(*a, **k):
        rep = real(*a, **k)
        rep.results["chrf++"].update(ci_lower=0.4, ci_upper=6.1, p_value=0.2, delta=3.0)
        return rep

    monkeypatch.setattr(ci_scoring, "compare", lucky_interval)
    e = compare_runs(ws, first["manifest_path"], second["manifest_path"], n_trials=200, n_bootstrap=200)
    assert e["verdict"] == "no-change"


def test_every_verdict_says_what_its_dev_set_can_see():
    # a 95% interval 11 points wide (23 sentences) sees ~7.9 points, 8 times in 10
    assert detectable_difference([-5.5, 5.5]) == 7.9
    assert detectable_difference(None) is None
    e = {"round": 2, "n": 23, "score_new": 41.0, "score_in_use": 40.4, "delta": 0.6, "ci": [-4.9, 6.1],
         "p_value": 0.8, "verdict": "no-change", "detectable": 7.9}
    t = verdict_text(e)
    assert "about 7.9 chrF++ points or more" in t and "bigger dev set" in t and "(0–100)" in t
    e.update(n=400, ci=[-0.6, 1.8], detectable=1.7)
    assert "bigger dev set" not in verdict_text(e)
