"""The run lock — status must see a run in progress, and a second run must
refuse (synthetic hospital user, 2026-10: `forge_status` mid-run said
ready-to-train and handed back `nmt-forge run config.json`)."""

import json
import os
import socket
import subprocess
import sys
import time

import pytest

from nmt_forge.advisor import next_action, preflight, render_status, snapshot
from nmt_forge.errors import ForgeError
from nmt_forge.runlock import lock_path, read_lock
from nmt_forge.training import backends
from nmt_forge.training.run import run
from tests.test_training_run import _setup

pytestmark = pytest.mark.skipif(os.name == "nt",
                                reason="pid probing is POSIX-only")


def _write_lock(ws, pid, *, created=None, host=None, run_name="other"):
    lock_path(ws).write_text(json.dumps({
        "pid": pid, "host": host or socket.gethostname(),
        "created": time.time() if created is None else created,
        "token": "t", "run_name": run_name,
        "run_dir": str(ws.runs_dir / f"{run_name}-abc")}))


def _dead_pid() -> int:
    proc = subprocess.Popen([sys.executable, "-c", "pass"])
    proc.wait()
    return proc.pid


def _ready_ws(ws, tmp_path):
    rows = [{"source": f"see the tozer {i} clearly",
             "reference": f"tozka{i} miv rel"} for i in range(6)]
    (tmp_path / "t.jsonl").write_text(
        "\n".join(json.dumps(r) for r in rows) + "\n")
    ws.registry.register("toy-test", tmp_path / "t.jsonl", "test")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set": "toy-test"}))


def test_status_mid_run_says_wait_and_never_starts_a_run(ws, dev_set, tmp_path,
                                                         monkeypatch):
    # end to end: what status says WHILE `run` is training
    _ready_ws(ws, tmp_path)
    seen = {}
    real_train = backends.DummyBackend.train

    def spying_train(self, *a, **kw):
        seen["advice"] = next_action(ws)
        seen["snapshot"] = snapshot(ws)
        seen["preflight"] = preflight(ws, "run", tmp_path / "config.json")
        return real_train(self, *a, **kw)

    monkeypatch.setattr(backends.DummyBackend, "train", spying_train)
    cfg = _setup(ws, tmp_path)
    run(cfg)

    advice = seen["advice"]
    assert advice.state == "training"
    assert "nmt-forge run" not in advice.command
    assert advice.command == "nmt-forge status"
    assert "WAIT" in advice.why and "Do NOT start another run" in advice.why
    assert seen["snapshot"]["active_run"]["pid"] == os.getpid()
    gate = next(g for g in seen["preflight"] if g.name == "no-run-in-progress")
    assert not gate.ok
    # and once the run is over the lock is gone and status moves on
    assert read_lock(ws) is None
    assert next_action(ws).state == "ready-to-score"


def test_second_run_refuses_while_the_lock_is_held(ws, dev_set, tmp_path):
    _write_lock(ws, os.getppid())        # a live process that is not us
    cfg = _setup(ws, tmp_path)
    with pytest.raises(ForgeError, match="another training run is in progress"):
        run(cfg)
    assert lock_path(ws).is_file()       # never removes someone else's lock
    assert not list(ws.runs_dir.iterdir())   # refused before writing anything


def test_stale_lock_is_cleared_and_the_run_proceeds(ws, dev_set, tmp_path,
                                                    capsys):
    _write_lock(ws, _dead_pid())
    assert read_lock(ws)["state"] == "stale"
    assert next_action(ws).state != "training"
    assert "stale run lock" in render_status(ws)
    manifest = run(_setup(ws, tmp_path))
    assert manifest["selected_checkpoint"]
    assert "cleared a stale lock" in capsys.readouterr().out
    assert read_lock(ws) is None


def test_a_reused_pid_is_not_a_live_run(ws):
    # the pid is alive, but its process started long after the lock was
    # written — it cannot be the run that wrote it
    _write_lock(ws, os.getppid(), created=1_000_000.0)
    assert read_lock(ws)["state"] == "stale"


def test_lock_from_another_host_is_held_and_says_how_to_clear(ws, dev_set,
                                                              tmp_path):
    _write_lock(ws, 4242, host="some-other-machine")
    assert next_action(ws).state == "training"
    with pytest.raises(ForgeError, match="delete .*run.lock"):
        run(_setup(ws, tmp_path))


def test_lock_released_when_the_run_fails(ws, tmp_path):
    cfg = _setup(ws, tmp_path, dev_name="ghost-dev")     # fence refuses
    with pytest.raises(ForgeError):
        run(cfg)
    assert read_lock(ws) is None


def test_status_json_carries_the_training_state(ws, tmp_path, capsys):
    from nmt_forge.cli import main

    _write_lock(ws, os.getppid())
    code = main(["--workspace", str(ws.root), "status", "--json"])
    out = json.loads(capsys.readouterr().out)
    assert code == 0
    assert out["advice"]["state"] == "training"
    assert out["advice"]["next_command"] == "nmt-forge status"
    assert out["snapshot"]["active_run"]["run_name"] == "other"
    assert "token" not in out["snapshot"]["active_run"]
