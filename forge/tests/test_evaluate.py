"""`nmt-forge evaluate` — the decode→battery→diagnose seam.

Closes the loop the e15-v7 dogfood found open: run stops at train+select, and
evaluate must decode the registered battery with the SELECTED checkpoint,
score it (prereg-gated, CI'd) and auto-append the Diagnosis — with a pluggable
backend and zero manual steps.
"""

import json

import pytest

from nmt_forge.errors import ForgeError, PreregistrationMissing
from nmt_forge.guards import preregister
from nmt_forge.training.evaluate import evaluate
from nmt_forge.training.run import run
from tests.conftest import write_jsonl


def _battery(ws, tmp_path, *, prereg=True):
    rows = ([{"id": f"tb-{i}", "register": "textbook",
              "source": f"src tb {i}", "reference": f"nikî ref {i} tok"}
             for i in range(6)]
            + [{"id": f"gov-{i}", "register": "government",
                "source": f"src gov {i}", "reference": f"kîkway {i} pol"}
               for i in range(4)])
    p = write_jsonl(tmp_path / "battery.jsonl", rows)
    ws.registry.register("battery", p, "test")
    if prereg:
        preregister.new(ws, prereg_id="bat-p1", eval_set="battery",
                        predictions=[{"metric": "chrf++", "expect": "table",
                                      "rationale": "acceptance"}])
    return rows


def _config(ws, tmp_path, *, with_eval=True):
    gold = write_jsonl(tmp_path / "gold.jsonl", [
        {"source": f"the florp {i} sings", "target": f"florpa{i} zam"}
        for i in range(6)])
    raw = {
        "run_name": "e2e-eval",
        "workspace": str(ws.root),
        "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "model": {"backend": "dummy"},
        "selection": {"metric": "loss"},
        "decode": {"max_new_tokens": 64},
    }
    if with_eval:
        raw["eval"] = {"battery": "battery", "by": "register", "n_bootstrap": 50}
    cfg_path = tmp_path / "config.json"
    cfg_path.write_text(json.dumps(raw))
    return cfg_path


def test_evaluate_closes_the_loop(ws, dev_set, tmp_path):
    _battery(ws, tmp_path)
    cfg = _config(ws, tmp_path)
    manifest = run(cfg)
    report, paths = evaluate(manifest["manifest_path"], config_path=cfg)

    # scored per register, CIs present
    assert set(report.groups) == {"textbook", "government"}
    chrf = report.groups["textbook"].scores["chrf++"]
    assert chrf["ci_lower"] <= chrf["score"] <= chrf["ci_upper"]

    # all three artifacts written, hyps id-aligned to the battery
    hyp_rows = [json.loads(l) for l in
                open(paths["hyps"], encoding="utf-8").read().splitlines()]
    assert [r["id"] for r in hyp_rows] == [f"tb-{i}" for i in range(6)] + \
        [f"gov-{i}" for i in range(4)]
    assert all("predicted" in r for r in hyp_rows)

    # the md report carries the auto-appended Diagnosis section
    md = open(paths["report_md"], encoding="utf-8").read()
    assert "Battery report" in md and "Diagnosis & Recommendations" in md \
        or "no lint findings" in md


def test_evaluate_uses_embedded_config_when_none_passed(ws, dev_set, tmp_path):
    _battery(ws, tmp_path)
    cfg = _config(ws, tmp_path)
    manifest = run(cfg)
    # no --config: the eval block is read from the manifest's embedded config
    report, _ = evaluate(manifest["manifest_path"])
    assert report.n == 10


def test_evaluate_still_prereg_gated(ws, dev_set, tmp_path):
    _battery(ws, tmp_path, prereg=False)
    cfg = _config(ws, tmp_path)
    manifest = run(cfg)
    with pytest.raises(PreregistrationMissing):
        evaluate(manifest["manifest_path"], config_path=cfg)


def test_evaluate_refuses_config_without_eval_block(ws, dev_set, tmp_path):
    _battery(ws, tmp_path)
    cfg = _config(ws, tmp_path, with_eval=False)
    manifest = run(cfg)
    with pytest.raises(ForgeError, match="no eval block"):
        evaluate(manifest["manifest_path"], config_path=cfg)


def test_evaluate_refuses_non_run_manifest(ws, tmp_path):
    bad = tmp_path / "notarun.json"
    bad.write_text(json.dumps({"hello": "world"}))
    with pytest.raises(ForgeError, match="not a run manifest"):
        evaluate(bad)


def test_evaluate_backend_pluggable_decode_is_called(ws, dev_set, tmp_path):
    # the selected checkpoint's id + path reach the backend decode call
    from nmt_forge.training import backends as B

    _battery(ws, tmp_path)
    cfg = _config(ws, tmp_path)
    manifest = run(cfg)

    seen = {}
    orig = B.DummyBackend.decode

    def spy(self, checkpoint, sources, params):
        seen["ckpt_id"] = checkpoint.id
        seen["n_sources"] = len(sources)
        return orig(self, checkpoint, sources, params)

    B.DummyBackend.decode = spy
    try:
        evaluate(manifest["manifest_path"], config_path=cfg)
    finally:
        B.DummyBackend.decode = orig
    assert seen["ckpt_id"] == manifest["selected_checkpoint"]
    assert seen["n_sources"] == 10
