"""Drafts from the newer model for a blind review sheet (program plan A2,
FORGE_MACHINE_CRITIQUE finding 2)."""

import json
from pathlib import Path

from nmt_forge.improve import draft as draft_mod
from nmt_forge.improve.draft import DRAFT_NEWER, draft_newer
from nmt_forge.training.run import run
from tests.test_training_run import _setup


def test_the_newer_model_drafts_the_lines_it_is_given(ws, dev_set, tmp_path, monkeypatch):
    cfg = _setup(ws, tmp_path)
    first = run(cfg)
    gold = tmp_path / "gold.jsonl"
    gold.write_text(gold.read_text() + json.dumps({"source": "the florp 77 sings", "target": "florpa77 zam"}) + "\n")
    second = run(cfg)
    monkeypatch.setattr(draft_mod, "newer_than_in_use",
                        lambda ws_: (json.loads(Path(first["manifest_path"]).read_text()) | {"manifest_path": first["manifest_path"]},
                                     json.loads(Path(second["manifest_path"]).read_text()) | {"manifest_path": second["manifest_path"]}))
    lines = tmp_path / "lines.txt"
    lines.write_text("we ate fish\nthe dog sleeps\n")
    out = tmp_path / "drafts.jsonl"
    r = draft_newer(ws, lines, out)
    assert r["n"] == 2 and r["newer"] == second["run_name"]
    rows = [json.loads(x) for x in out.read_text().splitlines()]
    assert [x["row"] for x in rows] == [0, 1] and all(x["draft"] for x in rows)
    ev = ws.ledger.find(DRAFT_NEWER)[-1]
    assert ev["n"] == 2 and "we ate" not in json.dumps(ev), "counts only"


def test_no_newer_model_drafts_nothing(ws, tmp_path, monkeypatch):
    monkeypatch.setattr(draft_mod, "newer_than_in_use", lambda ws_: ({"run_name": "r1"}, None))
    lines = tmp_path / "lines.txt"
    lines.write_text("a\n")
    r = draft_newer(ws, lines, tmp_path / "out.jsonl")
    assert r["n"] == 0 and r["other"] is None and r["newer"] is None and r["relation"] is None
    assert r["in_use"] == "r1"


def _m(result):
    return json.loads(Path(result["manifest_path"]).read_text()) | {"manifest_path": result["manifest_path"]}


def test_after_a_promotion_the_replaced_model_drafts_the_blind_half(ws, dev_set, tmp_path, monkeypatch):
    # stress test 12 (2026-10-13): with no newer model, the speaker checks the
    # promoted model against the one it replaced, on the same visit
    cfg = _setup(ws, tmp_path)
    first = run(cfg)
    gold = tmp_path / "gold.jsonl"
    gold.write_text(gold.read_text() + json.dumps({"source": "the florp 77 sings", "target": "florpa77 zam"}) + "\n")
    second = run(cfg)
    monkeypatch.setattr(draft_mod, "newer_than_in_use", lambda ws_: (_m(second), None))
    monkeypatch.setattr(draft_mod, "replaced_by_in_use", lambda ws_: _m(first))
    lines = tmp_path / "lines.txt"
    lines.write_text("we ate fish\n")
    r = draft_newer(ws, lines, tmp_path / "drafts.jsonl")
    assert r["relation"] == "replaced" and r["other"] == first["run_name"] and r["newer"] is None
    assert r["in_use"] == second["run_name"] and r["n"] == 1
    # each model's training pairs: the in-use one trained on one pair more
    assert r["in_use_pairs"] == r["other_pairs"] + 1


def test_the_replaced_model_is_the_previous_choice_never_a_re_export_of_the_same_run(tmp_path, monkeypatch):
    for name in ("a", "b"):
        d = tmp_path / name
        d.mkdir()
        (d / "run-manifest.json").write_text(json.dumps({"run_name": name, "stages": []}))
    exports = [{"dir": str(tmp_path / "xa"), "model_dir": str(tmp_path / "xa/model"),
                "manifest": str(tmp_path / "a/run-manifest.json")},
               {"dir": str(tmp_path / "xb"), "model_dir": str(tmp_path / "xb/model"),
                "manifest": str(tmp_path / "b/run-manifest.json")},
               {"dir": str(tmp_path / "xb2"), "model_dir": str(tmp_path / "xb2/model"),
                "manifest": str(tmp_path / "b/run-manifest.json")}]
    snap = {"chosen": [exports[0]["model_dir"], exports[2]["model_dir"], exports[1]["model_dir"]], "served": []}
    monkeypatch.setattr(draft_mod, "_in_use", lambda ws_: (snap, exports, exports[1]))
    assert draft_mod.replaced_by_in_use(None)["run_name"] == "a"
    monkeypatch.setattr(draft_mod, "_in_use", lambda ws_: ({"chosen": [], "served": [exports[1]["model_dir"]]},
                                                         exports, exports[1]))
    assert draft_mod.replaced_by_in_use(None) is None


def test_training_pairs_reads_the_mix():
    assert draft_mod.training_pairs({"stages": [{"mix": {"gold": {"rows": 40}}},
                                                {"mix": {"gold": {"rows": 1200}}}]}) == 1200
    assert draft_mod.training_pairs({"stages": []}) is None and draft_mod.training_pairs(None) is None
