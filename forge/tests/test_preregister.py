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
    assert "fix:" in msg and "preregister.new" in msg


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
        ([{"metric": "m", "rationale": "x", "direction": "sideways"}], "direction"),
        ([{"metric": "m", "rationale": "x"}], "expect"),
    ]
    for preds, match in fail_cases:
        with pytest.raises(PreregistrationInvalid, match=match):
            preregister._validate_predictions(preds)
    preregister._validate_predictions(
        [{"metric": "m", "rationale": "x", "expect": "goes up"}])
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
