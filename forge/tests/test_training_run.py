import json

import pytest

from nmt_forge.errors import DevFenceError
from nmt_forge.training.run import run
from tests.conftest import write_jsonl


def _setup(ws, tmp_path, *, dev_name="toy-dev", curriculum=None,
           gold_rows=None, upweight=2):
    gold_rows = gold_rows or [
        {"source": f"the florp {i} sings", "target": f"florpa{i} zam"}
        for i in range(6)
    ]
    gold = write_jsonl(tmp_path / "gold.jsonl", gold_rows)
    synth = write_jsonl(tmp_path / "synth.jsonl", [
        {"source": f"made up {i}", "target": f"mkup{i}", "kind": f"k{i % 4}",
         "synthetic": True} for i in range(20)
    ])
    raw = {
        "run_name": "e2e",
        "workspace": str(ws.root),
        "data": {"gold": [str(gold)], "dev": dev_name,
                 "synthetic": [{"path": str(synth), "tag": "<synth>"}]},
        "mix": {"gold_upweight": upweight, "kind_cap": 0.3},
        "model": {"backend": "dummy"},
        "selection": {"metric": "loss"},
        "decode": {"max_new_tokens": 64},
    }
    if curriculum:
        raw["curriculum"] = curriculum
    cfg_path = tmp_path / "config.json"
    cfg_path.write_text(json.dumps(raw))
    return cfg_path


def test_run_refuses_without_registered_dev(ws, tmp_path):
    cfg = _setup(ws, tmp_path, dev_name="ghost-dev")
    with pytest.raises(DevFenceError):
        run(cfg)


def test_end_to_end_run_manifest(ws, dev_set, test_set, tmp_path):
    cfg = _setup(ws, tmp_path)
    manifest = run(cfg)
    assert manifest["selected_checkpoint"] == "ckpt-2"  # min scripted loss
    assert manifest["config_hash"]
    # the exposure math is in the stage mix manifest
    g = manifest["stages"][0]["mix"]["gold"]
    assert g["upweight"] == 2 and g["effective_exposure_per_unique_sentence"] == 2.0
    # dev report carries CIs
    chrf = manifest["dev_report"]["scores"]["chrf++"]
    assert chrf["ci_lower"] <= chrf["score"] <= chrf["ci_upper"]
    # headroom recorded
    assert manifest["headroom"]["max_new_tokens"] == 64
    # manifest written to the run dir
    on_disk = json.loads((ws.runs_dir / f"e2e-{manifest['config_hash'][:8]}"
                          / "run-manifest.json").read_text())
    assert on_disk["run_name"] == "e2e"
    # the fence's read is in the ledger, bound to this config
    reads = ws.ledger.find("read", set="toy-dev", purpose="dev-selection")
    assert reads and reads[-1]["config_hash"] == manifest["config_hash"]


def test_curriculum_chains_selected_checkpoints(ws, dev_set, tmp_path):
    cfg = _setup(ws, tmp_path, curriculum=[
        {"name": "pretrain", "gold_upweight": 1},
        {"name": "finetune", "synthetic": [], "gold_upweight": 5},
    ])
    manifest = run(cfg)
    assert [s["stage"] for s in manifest["stages"]] == ["pretrain", "finetune"]
    # stage overrides applied per stage
    assert manifest["stages"][0]["mix"]["gold"]["upweight"] == 1
    assert manifest["stages"][1]["mix"]["gold"]["upweight"] == 5
    assert manifest["stages"][1]["mix"]["synthetic"] == []


def test_curriculum_stage2_inits_from_stage1_selection(ws, dev_set, tmp_path):
    # observe backend params: the runner must pass init_from on stage 2
    from nmt_forge.training import backends as B

    captured = []
    orig = B.DummyBackend.train

    def spy(self, train_rows, dev_rows, params, run_dir):
        captured.append(dict(params))
        return orig(self, train_rows, dev_rows, params, run_dir)

    B.DummyBackend.train = spy
    try:
        cfg = _setup(ws, tmp_path, curriculum=[
            {"name": "pretrain"}, {"name": "finetune", "synthetic": []},
        ])
        run(cfg)
    finally:
        B.DummyBackend.train = orig
    assert "init_from" not in captured[0]
    assert captured[1]["init_from"].endswith("ckpt-2")
