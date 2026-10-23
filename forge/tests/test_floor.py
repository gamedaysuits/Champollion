"""`nmt-forge floor <dictionary>`: the number a trained model has to beat.

Word-for-word lookup (the eval harness's lexicon engine) on the registered
dev set, scored by the same code as a run's dev report; recorded content-
free; `status` puts it beside every run's dev score and warns when a run
does not beat it. Invented vocabulary only.
"""

from __future__ import annotations

import json

import pytest

from nmt_forge.advisor import _floor_warnings, _run_floor, _run_line, snapshot
from nmt_forge.errors import ForgeError
from nmt_forge.floor import FLOOR_EVENT, beats_floor, floor_text, measure_floor


def _dictionary(tmp_path, body="dax\tdaxko\nsleeps now\tpel sun\n", side=None):
    p = tmp_path / "words.tsv"
    p.write_text(body, encoding="utf-8")
    if side is not None:
        (tmp_path / "words.tsv.champollion.json").write_text(json.dumps(side))
    return p


def test_the_floor_is_measured_on_dev_and_recorded_without_a_word(ws, dev_set, tmp_path):
    rec = measure_floor(ws, [str(_dictionary(tmp_path))])
    assert rec["dev_set"] == "toy-dev" and rec["n"] == 8
    # "the dax 3 sleeps now": dax + "sleeps now" found, "the" and "3" not
    assert rec["coverage"] == {"source_words": 40, "found": 24, "share": 0.6}
    s = rec["scores"]["chrf++"]
    assert 0 < s["score"] < 100 and s["ci_lower"] <= s["score"] <= s["ci_upper"]
    events = ws.ledger.find(FLOOR_EVENT)
    assert len(events) == 1
    written = json.dumps(events) + (ws.root / "floors" / "toy-dev.json").read_text()
    for word in ("daxko", "pel sun", "sleeps"):
        assert word not in written, "content-free: never a word"
    assert "dictionary floor on dev set toy-dev" in floor_text(rec)


def test_the_command_prints_it_and_json_carries_it(ws, dev_set, tmp_path, capsys):
    from nmt_forge.cli import main

    d = str(_dictionary(tmp_path))
    assert main(["--workspace", str(ws.root), "floor", d]) == 0
    out = capsys.readouterr().out
    assert "dictionary floor on dev set toy-dev" in out and "beats this" in out
    assert main(["--workspace", str(ws.root), "floor", d, "--json"]) == 0
    doc = json.loads(capsys.readouterr().out)
    assert doc["dev_set"] == "toy-dev" and doc["coverage"]["found"] == 24


def test_no_dev_set_says_how_to_make_one(ws, tmp_path):
    with pytest.raises(ForgeError, match="nmt-forge split"):
        measure_floor(ws, [str(_dictionary(tmp_path))])


def test_a_dictionary_for_another_pair_is_refused(ws, dev_set, tmp_path):
    (ws.root.parent / "config.json").write_text(json.dumps(
        {"language": {"source": "eng", "target": "sme"}}))
    d = _dictionary(tmp_path, side={"pair": {"source": "sme", "target": "eng"}})
    with pytest.raises(ForgeError, match="looks up one direction"):
        measure_floor(ws, [str(d)])


def test_beating_the_floor_needs_the_intervals_apart():
    floor = {"score": 30.0, "ci": [25.0, 35.0]}
    assert beats_floor({"score": 50.0, "ci": [40.0, 60.0]}, floor) is True
    assert beats_floor({"score": 38.0, "ci": [33.0, 43.0]}, floor) is False
    assert beats_floor({"score": 20.0, "ci": [15.0, 25.0]}, floor) is False
    assert beats_floor(None, floor) is None


def test_status_puts_it_beside_each_run_and_warns(ws, dev_set, tmp_path):
    measure_floor(ws, [str(_dictionary(tmp_path))])
    floors = snapshot(ws)["floors"]
    assert "toy-dev" in floors
    f = floors["toy-dev"]["scores"]["chrf++"]
    weak = {"run": "r1", "dev_set": "toy-dev", "selected_checkpoint": "c",
            "dev_score": {"metric": "chrf++", "score": f["score"],
                          "ci": [f["ci_lower"], f["ci_upper"]]}}
    weak["floor"] = _run_floor(weak, floors)
    assert weak["floor"]["beats"] is False
    assert "does NOT beat it" in _run_line(weak)
    (w,) = _floor_warnings({"runs": [weak]})
    assert "does not beat the dictionary floor" in w
    strong = dict(weak, run="r2", dev_score={"metric": "chrf++", "score": 99.0,
                                             "ci": [98.0, 99.5]})
    strong["floor"] = _run_floor(strong, floors)
    assert strong["floor"]["beats"] is True
    assert _floor_warnings({"runs": [strong]}) == []
    # a run selected on another metric is not compared
    other = dict(weak, dev_score={"metric": "bleu", "score": 1.0, "ci": None})
    assert _run_floor(other, floors) is None
