"""Forge does not fill the disk (2026-10-13: a ByT5-small run kept 4 checkpoints
at ~1.4 GB each, every improve round added another 5.6 GB, and the computer's
disk filled while two training jobs ran)."""

import json

import pytest

from nmt_forge.errors import ForgeError
from nmt_forge.training.run import prune_checkpoints, run
from tests.test_training_run import _setup


def _ckpt(root, rel, mb=1):
    d = root / rel
    d.mkdir(parents=True)
    (d / "model.safetensors").write_bytes(b"\0" * (mb * 1024 * 1024))
    (d / "config.json").write_text("{}")
    return d


def test_a_finished_run_keeps_only_its_selected_checkpoint(tmp_path):
    run_dir = tmp_path / "run"
    keep = _ckpt(run_dir, "train/checkpoint-400")
    for rel in ("train/checkpoint-200", "train/checkpoint-600", "stage1/checkpoint-100"):
        _ckpt(run_dir, rel)
    (run_dir / "dev-outputs.jsonl").write_text("{}\n")
    r = prune_checkpoints(run_dir, str(keep))
    assert r["removed"] == 3 and r["bytes"] >= 3 * 1024 * 1024 and r["kept"] == "checkpoint-400"
    assert keep.is_dir() and (run_dir / "dev-outputs.jsonl").is_file()
    assert sorted(p.name for p in run_dir.rglob("checkpoint-*")) == ["checkpoint-400"]


def test_keep_all_is_a_choice_and_anything_else_is_refused(tmp_path):
    run_dir = tmp_path / "run"
    keep = _ckpt(run_dir, "train/checkpoint-400")
    _ckpt(run_dir, "train/checkpoint-200")
    assert prune_checkpoints(run_dir, str(keep), keep="all")["removed"] == 0
    assert len(list(run_dir.rglob("checkpoint-*"))) == 2
    with pytest.raises(ForgeError, match="keep_checkpoints"):
        prune_checkpoints(run_dir, str(keep), keep="some")


def test_a_bad_keep_checkpoints_is_refused_before_training(ws, tmp_path):
    """Docs review 2026-10-13: found only at the run's end, it failed a whole
    finished run before its manifest was written."""
    from nmt_forge.training.config import ConfigError, RunConfig

    cfg = _setup(ws, tmp_path)
    raw = json.loads(cfg.read_text())
    raw["model"]["keep_checkpoints"] = "some"
    cfg.write_text(json.dumps(raw))
    with pytest.raises(ConfigError, match="keep_checkpoints"):
        RunConfig.from_dict(raw)
    with pytest.raises(ConfigError, match="keep_checkpoints"):
        run(cfg)
    assert not list(ws.runs_dir.glob("*/run-manifest.json")), "no run started"


def _finished_run(ws, name, mb=1, base="google/byt5-small"):
    run_dir = ws.runs_dir / name
    sel = _ckpt(run_dir, "train/checkpoint-100", mb=mb)
    (run_dir / "run-manifest.json").write_text(json.dumps({
        "run_name": name, "selected_path": str(sel), "config": {"model": {"base": base}}}))
    return run_dir


def test_a_run_the_disk_cannot_hold_is_refused_before_it_starts(ws, monkeypatch):
    from nmt_forge import disk

    _finished_run(ws, "r1", mb=3)                            # one checkpoint of this model: 3 MB
    monkeypatch.setattr(disk, "GB", 1024 * 1024)             # count in MB for the test
    monkeypatch.setattr(disk, "MARGIN_BYTES", 1024 * 1024)
    monkeypatch.setattr(disk, "FLOOR_BYTES", 2 * 1024 * 1024)
    monkeypatch.setattr(disk, "free_bytes", lambda p: 10 * 1024 * 1024)
    with pytest.raises(disk.DiskRoomError, match=r"needs about 13\.0 GB \(4 checkpoints of about 3\.0 GB") as e:
        disk.check_room(ws, {"base": "google/byt5-small", "save_total_limit": 4}, ws.runs_dir)
    assert "--skip-disk-check" in str(e.value)
    monkeypatch.setattr(disk, "free_bytes", lambda p: 20 * 1024 * 1024)
    rec = disk.check_room(ws, {"base": "google/byt5-small", "save_total_limit": 4}, ws.runs_dir)
    assert rec["need_bytes"] == pytest.approx(13 * 1024 * 1024, rel=1e-4)   # + the checkpoint's small files
    assert rec["checkpoint_bytes"] == pytest.approx(3 * 1024 * 1024, rel=1e-4)


def test_tidy_lists_then_removes_only_models_nothing_uses(ws, monkeypatch):
    from nmt_forge import disk

    runs = {n: _finished_run(ws, n) for n in ("r1", "r2", "r3", "r4")}
    kept = {str((runs[n] / "run-manifest.json").resolve()): why
            for n, why in (("r3", "the model in use"), ("r4", "the newest run"))}
    monkeypatch.setattr(disk, "_in_use_and_kept", lambda ws_, s=None: (set(kept), kept))
    plan = disk.plan_tidy(ws)
    assert sorted(r["run"] for r in plan["runs"]) == ["r1", "r2"] and plan["bytes"] >= 2 * 1024 * 1024
    assert (runs["r1"] / "train" / "checkpoint-100").is_dir(), "planning touches nothing"
    done = disk.apply_tidy(ws, plan)
    assert done["runs"] == 2 and sorted(done["removed"]) == ["r1", "r2"]
    for n in ("r1", "r2"):
        rec = json.loads((runs[n] / "run-manifest.json").read_text())
        assert rec["model_removed"]["by"] == "nmt-forge tidy"
        assert not (runs[n] / "train" / "checkpoint-100").exists()
    for n in ("r3", "r4"):
        assert (runs[n] / "train" / "checkpoint-100").is_dir()
    assert ws.ledger.find(disk.TIDY_EVENT)[-1]["runs"] == 2
    assert disk.plan_tidy(ws)["runs"] == [], "a tidied run is not planned again"


def test_a_tidied_runs_model_cannot_translate_and_says_why(ws):
    from nmt_forge.training.run import decode_with_run

    with pytest.raises(ForgeError, match="removed by nmt-forge tidy"):
        decode_with_run({"run_name": "r1", "selected_path": "/gone", "config": {},
                         "model_removed": {"by": "nmt-forge tidy", "at": "2026-10-13"}}, ["x"])


def test_status_warns_when_the_disk_is_getting_full(ws, monkeypatch):
    from nmt_forge import disk

    monkeypatch.setattr(disk, "free_bytes", lambda p: 3 * disk.GB)
    monkeypatch.setattr(disk, "plan_tidy", lambda ws_, s=None: {"runs": [{"run": "r1"}], "bytes": 6 * disk.GB,
                                                                  "kept": {}})
    w = disk.disk_warning(ws)
    assert w.startswith("this computer has 3.0 GB free") and "`nmt-forge tidy --yes`" in w
    monkeypatch.setattr(disk, "free_bytes", lambda p: 50 * disk.GB)
    monkeypatch.setattr(disk, "plan_tidy", lambda ws_, s=None: {"runs": [], "bytes": 0, "kept": {}})
    assert disk.disk_warning(ws) is None


def test_the_run_manifest_says_what_was_pruned(ws, dev_set, tmp_path):
    cfg = _setup(ws, tmp_path)
    m = run(cfg)
    with open(m["manifest_path"], encoding="utf-8") as fh:
        rec = json.load(fh)
    assert rec["checkpoints_pruned"]["removed"] == 0      # the stand-in backend writes no checkpoint folders
    assert "kept" in rec["checkpoints_pruned"]
