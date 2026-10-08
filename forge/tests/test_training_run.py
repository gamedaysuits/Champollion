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


def _cli(capsys, *argv):
    from nmt_forge.cli import main

    code = main(list(argv))
    out = capsys.readouterr()
    return code, out.out, out.err


def test_run_cli_last_line_is_run_exit_on_success_and_refusal(
        ws, dev_set, test_set, tmp_path, capsys):
    """Round 5: NEXT_STEPS.md (written by init) tells an agent to watch the
    log for `RUN EXIT`, but no code printed it — a finished run looked hung.
    """
    cfg = _setup(ws, tmp_path)
    code, out, _ = _cli(capsys, "--workspace", str(ws.root), "run", str(cfg))
    assert code == 0
    last = out.rstrip("\n").splitlines()[-1]
    assert last.startswith("RUN EXIT 0 (finished) — run 'e2e' finished")
    assert "next: nmt-forge export" in last

    # --json: stdout is the one JSON document; the line ends the stderr log
    code, out, err = _cli(capsys, "--workspace", str(ws.root), "run",
                          str(cfg), "--json")
    assert code == 0 and json.loads(out)["run"] == "e2e"
    assert err.rstrip("\n").splitlines()[-1].startswith("RUN EXIT 0")

    bad = _setup(ws, tmp_path / "b", dev_name="ghost-dev")
    code, out, err = _cli(capsys, "--workspace", str(ws.root), "run",
                          str(bad))
    assert code == 2
    last = out.rstrip("\n").splitlines()[-1]
    assert last.startswith("RUN EXIT 2 (refused) — refused: [dev-fence]")
    assert "[dev-fence]" in err          # the full refusal is still printed


def test_best_checkpoint_key_check_explains_tied_and_recomputed(tmp_path):
    """The Trainer's "missing keys" line for a Marian model: tied embeddings
    + sinusoidal positions are expected (one-line note); a truly missing
    weight is a loud warning."""
    torch = pytest.importorskip("torch")
    st = pytest.importorskip("safetensors.torch")
    from types import SimpleNamespace

    from nmt_forge.training.backends import best_checkpoint_key_check

    class Tiny(torch.nn.Module):
        _keys_to_ignore_on_save = ["pos.weight"]
        _keys_to_ignore_on_load_missing = [r"pos\.weight"]

        def __init__(self):
            super().__init__()
            self.shared = torch.nn.Embedding(5, 3)
            self.head = torch.nn.Linear(3, 5, bias=False)
            self.head.weight = self.shared.weight        # tied
            self.pos = torch.nn.Embedding(4, 3)
            self.other = torch.nn.Linear(3, 3)

    m = Tiny()
    ck = tmp_path / "checkpoint-1"
    ck.mkdir()
    st.save_file({"shared.weight": m.shared.weight.detach().clone(),
                  "other.weight": m.other.weight.detach().clone(),
                  "other.bias": m.other.bias.detach().clone()},
                 str(ck / "model.safetensors"))
    trainer = SimpleNamespace(model=m, state=SimpleNamespace(
        best_model_checkpoint=str(ck)))
    r = best_checkpoint_key_check(trainer)
    assert r["ok"] is True and r["tied"] == ["head.weight"]
    assert r["recomputed"] == ["pos.weight"]
    assert "nothing was lost" in r["message"]

    st.save_file({"shared.weight": m.shared.weight.detach().clone()},
                 str(ck / "model.safetensors"))
    r = best_checkpoint_key_check(trainer)
    assert r["ok"] is False and r["unexplained"] == ["other.bias",
                                                     "other.weight"]
    assert r["message"].startswith("[forge] WARNING")
