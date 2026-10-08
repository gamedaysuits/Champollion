import pytest

from nmt_forge.errors import PreregistrationInvalid, PreregistrationMissing
from nmt_forge.guards import preregister
from tests.conftest import write_jsonl

PREDS = [{"metric": "chrf++", "direction": "increase", "margin": 2.0,
          "baseline_score": 40.0, "rationale": "vocabulary recovery"}]


def test_new_and_require_happy_path(ws, test_set):
    path = preregister.new(ws, prereg_id="p1", eval_set="toy-test",
                           predictions=PREDS, author="founder")
    assert path.exists()
    doc = preregister.require_prereg(ws, "toy-test")
    assert doc["id"] == "p1"
    assert ws.ledger.find("prereg", prereg_id="p1")


def test_missing_prereg_refusal_names_the_fix(ws, test_set):
    with pytest.raises(PreregistrationMissing) as e:
        preregister.require_prereg(ws, "toy-test")
    msg = str(e.value)
    assert "fix:" in msg and "nmt-forge prereg new" in msg


def test_postdiction_refused_at_creation(ws, test_set):
    # someone read the set for scoring (bypassing the sanctioned scorer),
    # THEN tries to preregister — that's a postdiction
    ws.registry.open_eval("toy-test", "score", config_hash="c1")
    with pytest.raises(PreregistrationInvalid, match="postdiction"):
        preregister.new(ws, prereg_id="late", eval_set="toy-test",
                        predictions=PREDS, config_hash="c1")


def test_postdiction_override_still_fails_ordering_gate(ws, test_set):
    ws.registry.open_eval("toy-test", "score", config_hash="c1")
    preregister.new(ws, prereg_id="late", eval_set="toy-test",
                    predictions=PREDS, config_hash="c1", allow_after_reads=True)
    assert ws.ledger.find("override", kind="prereg-after-reads")
    # the ordering gate is independent: prereg event AFTER the first score
    # read is still not a valid prereg for the table
    with pytest.raises(PreregistrationInvalid, match="AFTER"):
        preregister.require_prereg(ws, "toy-test", config_hash="c1")


def test_audit_reads_do_not_poison_ordering(ws, test_set):
    ws.registry.open_eval("toy-test", "audit")      # leak-audit style read
    ws.registry.open_eval("toy-test", "inspect")
    preregister.new(ws, prereg_id="p1", eval_set="toy-test", predictions=PREDS)
    assert preregister.require_prereg(ws, "toy-test")["id"] == "p1"


def test_prereg_binds_content_hash(ws, test_set, tmp_path):
    preregister.new(ws, prereg_id="p1", eval_set="toy-test", predictions=PREDS)
    # the set rotates to new content → old prereg no longer applies
    rows = [{"source": f"brand new {i}", "reference": f"new{i}"} for i in range(6)]
    p2 = write_jsonl(tmp_path / "v2.jsonl", rows)
    ws.registry.register("toy-test", p2, "test", allow_rotate=True)
    with pytest.raises(PreregistrationMissing):
        preregister.require_prereg(ws, "toy-test")


def test_prediction_validation():
    pass_cases = []
    fail_cases = [
        ([], "at least one"),
        ([{"metric": "chrf++"}], "rationale"),
        ([{"rationale": "x"}], "metric"),
        ([{"metric": "chrf++", "rationale": "x", "direction": "sideways"}],
         "direction"),
        ([{"metric": "chrf++", "rationale": "x"}], "expect"),
        # a lane nobody scores could never be verdicted — refused, with names
        ([{"metric": "chrF", "rationale": "x", "expect": "up"}], "not a lane"),
        # the unedited template is a rubber stamp
        ([{"metric": "chrf++", "rationale": "REPLACE: why", "expect": "x"}],
         "REPLACE"),
        ([{"metric": "chrf++", "rationale": "x", "direction": "increase",
           "baseline_score": "20"}], "must be a number"),
        (["chrf++ goes up"], "not an object"),
    ]
    for preds, match in fail_cases:
        with pytest.raises(PreregistrationInvalid, match=match):
            preregister._validate_predictions(preds)
    preregister._validate_predictions(
        [{"metric": "chrf++", "rationale": "x", "expect": "goes up"}])
    # plugin lanes ("plugin:key") only exist at score time — accepted
    preregister._validate_predictions(
        [{"metric": "crk_linter:equivalent_match_rate", "rationale": "x",
          "expect": "up"}])
    preregister._validate_predictions(PREDS)
    assert pass_cases == []  # silence the linter


def test_duplicate_id_refused(ws, test_set):
    preregister.new(ws, prereg_id="p1", eval_set="toy-test", predictions=PREDS)
    with pytest.raises(PreregistrationInvalid, match="already exists"):
        preregister.new(ws, prereg_id="p1", eval_set="toy-test", predictions=PREDS)


def test_check_verdicts():
    prereg = {"predictions": [
        {"metric": "chrf++", "direction": "increase", "margin": 2.0,
         "baseline_score": 40.0, "rationale": "r"},
        {"metric": "bleu", "direction": "no_change", "margin": 1.0,
         "baseline_score": 20.0, "rationale": "r"},
        {"metric": "exact_match", "expect": "stays above 0.5", "rationale": "r"},
    ]}
    scores = {"chrf++": {"score": 44.0}, "bleu": {"score": 25.0},
              "exact_match": {"score": 0.6}}
    rows = preregister.check(prereg, scores)
    assert [r["verdict"] for r in rows] == ["held", "failed", "manual"]
    assert rows[0]["delta"] == 4.0


# -- reading results: what `export` writes (synthetic users, 2026-10) -----------

PREREG2 = {"id": "first-run", "eval_set": {"name": "project-test"},
           "predictions": [
               {"metric": "chrf++", "direction": "increase",
                "baseline_score": 3.6, "margin": 5.0, "subset": "overall",
                "rationale": "r"},
               {"metric": "chrf++", "expect": "between 10 and 45",
                "rationale": "r"},
               {"metric": "chrf++", "direction": "increase",
                "baseline_score": 3.6, "subset": "strict", "rationale": "r"},
               {"metric": "bleu", "direction": "increase",
                "baseline_score": 1.0, "rationale": "r"}]}

BATTERY = {"guard": "ci-scoring/battery", "eval_set": "project-test",
           "by": "register", "n": 200,
           "groups": {"all": {"n": 200, "scores": {"chrf++": {
               "score": 67.08, "ci_lower": 65.93, "ci_upper": 68.30}}}},
           "strict_groups": {}, "near_dupe": {"flagged": 200, "params": {
               "jaccard_threshold": 0.6}},
           "weighted": {"chrf++": 67.08, "note": "weighted mean"},
           "notes": {}}


def test_check_reads_an_export_battery_manifest_by_subset():
    """`prereg check` on export's battery file printed 'observed None →
    manual' for EVERY prediction: the battery has groups, not top-level
    scores. Now each prediction reads its own subset, and anything the
    results cannot answer says why."""
    rows = preregister.check(PREREG2,
                             subsets=preregister.scores_by_subset(BATTERY))
    assert [r["verdict"] for r in rows] == ["held", "manual", "manual",
                                            "manual"]
    assert rows[0]["observed"] == 67.08
    assert rows[0]["observed_ci"] == [65.93, 68.30]
    assert "free-text" in rows[1]["note"]
    assert "subset 'strict' is not in these results" in rows[2]["note"]
    assert "'bleu' was not scored" in rows[3]["note"]


def test_check_reads_the_harness_testreport_and_multi_group_batteries():
    report = {"config": {"dataset_id": "project-test"},
              "overall": {"corpus_chrf": 67.08, "corpus_bleu": 46.04,
                          "exact_match_rate": 0.01,
                          "confidence_intervals": {"corpus_chrf": {
                              "score": 67.0804, "ci_lower": 65.93,
                              "ci_upper": 68.3}}}}
    subsets = preregister.scores_by_subset(report)
    assert subsets["overall"]["chrf++"]["score"] == 67.0804
    assert subsets["overall"]["bleu"]["score"] == 46.04
    assert preregister.results_eval_set(report) == "project-test"
    multi = dict(BATTERY, groups={
        "a": {"n": 100, "scores": {"chrf++": {"score": 60.0}}},
        "b": {"n": 100, "scores": {"chrf++": {"score": 70.0}}}},
        weighted={"chrf++": 65.0},
        strict_overall={"n": 50, "scores": {"chrf++": {"score": 20.0}}})
    subsets = preregister.scores_by_subset(multi)
    assert subsets["overall"]["chrf++"]["score"] == 65.0
    assert subsets["strict"]["chrf++"]["score"] == 20.0
    assert subsets["a"]["chrf++"]["score"] == 60.0


def test_load_results_follows_an_export_dir_and_refuses_the_unknown(tmp_path):
    import json

    exp = tmp_path / "export"
    (exp / "eval").mkdir(parents=True)
    (exp / "eval" / "battery-hyps-battery.json").write_text(json.dumps(BATTERY))
    (exp / "forge-model.json").write_text(json.dumps({
        "format": "nmt-forge-model/1",
        "test_report": {"battery_manifest": "eval/battery-hyps-battery.json"}}))
    doc, path = preregister.load_results(exp)
    assert doc["guard"] == "ci-scoring/battery"
    assert path.name == "battery-hyps-battery.json"
    (tmp_path / "config.json").write_text(json.dumps({"run_name": "x"}))
    with pytest.raises(ValueError, match="export directory"):
        preregister.load_results(tmp_path / "config.json")
    with pytest.raises(ValueError, match="without forge-model.json"):
        preregister.load_results(tmp_path)
