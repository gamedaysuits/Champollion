"""How an improve round trains (program plan A4, FORGE_MACHINE_CRITIQUE
finding 4): on from the model in use — a few passes over all the data, half
the rate — or from the start when that is the honest move; the full settings
come back when it is."""

import json

from nmt_forge.improve.round_plan import CONTINUE_EPOCHS, FULL_EVERY, ROUND_PLAN, plan_round
from nmt_forge.training.config import RunConfig

FULL = {"backend": "hf-seq2seq", "base": "google/byt5-small", "lr": 3e-4, "epochs": 20, "batch_size": 8}


def _cfg(tmp_path, ws, model=None):
    p = tmp_path / "config.json"
    p.write_text(json.dumps({"run_name": "r", "workspace": str(ws.root),
                             "data": {"gold": ["data/split/train-r1.jsonl"], "dev": "project-dev"},
                             "model": dict(model or FULL), "decode": {"max_new_tokens": 320}}))
    return p


def _in_use(tmp_path, model=None):
    m = tmp_path / "use" / "run-manifest.json"
    m.parent.mkdir(parents=True, exist_ok=True)
    m.write_text(json.dumps({"config": {"model": dict(model or FULL)}}))
    d = tmp_path / "export" / "r-1" / "model"
    d.mkdir(parents=True, exist_ok=True)
    return {"run": "r-1", "model_dir": str(d), "manifest": str(m)}


def test_no_model_in_use_trains_from_the_start(ws, tmp_path):
    p = _cfg(tmp_path, ws)
    plan = plan_round(ws, p, in_use={})
    assert plan["mode"] == "full" and plan["why"] == "no model is in use yet"
    assert json.loads(p.read_text())["model"] == FULL


def test_a_round_continues_from_the_model_in_use_then_trains_anew_every_fourth(ws, tmp_path):
    p = _cfg(tmp_path, ws)
    use = _in_use(tmp_path)
    for k in range(FULL_EVERY - 1):
        plan = plan_round(ws, p, in_use=use)
        cfg = json.loads(p.read_text())
        assert plan["mode"] == "continue", (k, plan)
        assert cfg["model"]["init_from"] == use["model_dir"] and cfg["model"]["epochs"] == CONTINUE_EPOCHS
        assert cfg["model"]["lr"] == FULL["lr"] / 2 and cfg["model_full"] == FULL
        RunConfig.from_file(p)                       # forge reads it (model_full is a known key)
    plan = plan_round(ws, p, in_use=use)
    cfg = json.loads(p.read_text())
    assert plan["mode"] == "full" and f"every {FULL_EVERY}th round" in plan["why"]
    assert cfg["model"] == FULL and "model_full" not in cfg
    assert [e["mode"] for e in ws.ledger.find(ROUND_PLAN)] == ["continue"] * (FULL_EVERY - 1) + ["full"]


def test_a_changed_model_and_the_tiny_model_train_from_the_start(ws, tmp_path):
    p = _cfg(tmp_path, ws)
    plan = plan_round(ws, p, in_use=_in_use(tmp_path, {"backend": "hf-scratch", "base": None}))
    assert plan["mode"] == "full" and "model was changed" in plan["why"]
    tiny = {"backend": "hf-scratch", "vocab_size": 4000, "epochs": 30}
    p2 = _cfg(tmp_path / "t", ws, tiny) if (tmp_path / "t").mkdir() is None else None
    plan = plan_round(ws, p2, in_use=_in_use(tmp_path / "t", tiny))
    assert plan["mode"] == "full" and "learns its vocabulary" in plan["why"]
