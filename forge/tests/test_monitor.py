"""RunMonitor — the human-facing panel behind agent-driven training.

Pins the contract: /status serves the emitted state, POST /stop trips the
stop flag (and the cross-process breadcrumb file), the panel copy carries the
loud warning + the talk-to-the-agent notice, and attach mode reconstructs the
loss curve from HF trainer_state.json dumps. No browser is opened in tests
(NMT_FORGE_NO_MONITOR=1)."""

import json
import urllib.request

import pytest

from nmt_forge.monitor import (PANEL_HTML, STOP_BASENAME, RunMonitor,
                               _harvest_trainer_state, watch)


@pytest.fixture(autouse=True)
def no_browser(monkeypatch):
    monkeypatch.setenv("NMT_FORGE_NO_MONITOR", "1")


def _get(url):
    with urllib.request.urlopen(url, timeout=5) as r:
        return r.read()


def test_status_serves_emitted_state(tmp_path):
    mon = RunMonitor(tmp_path, "toy-run", "abc123", open_browser=False)
    try:
        mon.emit("stage", name="pretrain", floor_steps=100, planned_steps=400)
        mon.emit("train_loss", step=50, loss=3.5)
        mon.emit("dev_loss", step=100, loss=3.2)
        s = json.loads(_get(f"{mon.url}/status"))
        assert s["run_name"] == "toy-run" and s["stage"] == "pretrain"
        assert s["floor_steps"] == 100 and s["planned_steps"] == 400
        assert {"step": 50, "train_loss": 3.5} in s["points"]
        assert {"step": 100, "dev_loss": 3.2} in s["points"]
        assert s["status"] == "training"
    finally:
        mon.shutdown()


def test_stop_roundtrip_sets_flag_and_breadcrumb(tmp_path):
    mon = RunMonitor(tmp_path, "toy-run", "abc123", open_browser=False)
    try:
        assert not mon.stop_requested()
        req = urllib.request.Request(f"{mon.url}/stop", method="POST")
        with urllib.request.urlopen(req, timeout=5) as r:
            assert json.loads(r.read())["ok"] is True
        assert mon.stop_requested()
        assert (tmp_path / STOP_BASENAME).exists()
        s = json.loads(_get(f"{mon.url}/status"))
        assert s["stop_requested"] is True
    finally:
        mon.shutdown()


def test_panel_carries_warning_and_agent_notice(tmp_path):
    mon = RunMonitor(tmp_path, "toy-run", "abc123", open_browser=False)
    try:
        html = _get(mon.url).decode()
        assert "THIS KILLS THE TRAINING RUN" in html
        assert "read-only by design" in html
        assert "talk to the agent" in html
        assert "Stop training" in html
        assert "early-stop floor" in html
    finally:
        mon.shutdown()


def test_harvest_reads_newest_trainer_state(tmp_path):
    # two checkpoint dumps; the newer carries the full history
    old = tmp_path / "stage" / "checkpoint-100"
    new = tmp_path / "stage" / "checkpoint-200"
    for d in (old, new):
        d.mkdir(parents=True)
    old.joinpath("trainer_state.json").write_text(json.dumps(
        {"global_step": 100,
         "log_history": [{"step": 100, "loss": 3.4}]}))
    new.joinpath("trainer_state.json").write_text(json.dumps(
        {"global_step": 200,
         "log_history": [{"step": 100, "loss": 3.4},
                         {"step": 100, "eval_loss": 3.6},
                         {"step": 200, "loss": 3.1}]}))
    pts = _harvest_trainer_state(tmp_path)
    assert {"step": 100, "train_loss": 3.4} in pts
    assert {"step": 100, "dev_loss": 3.6} in pts
    assert {"step": 200, "train_loss": 3.1} in pts


def test_watch_attach_mode_feeds_points(tmp_path):
    d = tmp_path / "train" / "checkpoint-50"
    d.mkdir(parents=True)
    d.joinpath("trainer_state.json").write_text(json.dumps(
        {"global_step": 50, "log_history": [{"step": 50, "loss": 2.2}]}))
    mon = watch(tmp_path, port=0, open_browser=False, poll_seconds=0.05,
                max_polls=3)
    try:
        import time

        deadline = time.time() + 3
        pts = []
        while time.time() < deadline and not pts:
            pts = json.loads(_get(f"{mon.url}/status"))["points"]
            time.sleep(0.05)
        assert {"step": 50, "train_loss": 2.2} in pts
    finally:
        mon.shutdown()


def test_run_with_dummy_backend_has_no_monitor(ws, dev_set, tmp_path):
    # tests + CI never open a panel: dummy backend keeps the monitor off
    import json as _json

    from nmt_forge.training.run import run

    gold = tmp_path / "gold.jsonl"
    gold.write_text("\n".join(_json.dumps(
        {"source": f"g {i}", "target": f"t {i}"}) for i in range(4)) + "\n")
    cfg = tmp_path / "c.json"
    cfg.write_text(_json.dumps({
        "run_name": "m", "workspace": str(ws.root),
        "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "model": {"backend": "dummy"}, "selection": {"metric": "loss"},
    }))
    manifest = run(cfg)                    # would hang/open a port otherwise
    assert manifest["selected_checkpoint"]


def test_parse_train_log_steps_rate_and_losses(tmp_path):
    from nmt_forge.monitor import _parse_train_log

    log = tmp_path / "run.log"
    log.write_text(
        "  2%|▏| 200/12774 [20:00<20:00,  6.10s/it]"
        "{'loss': 3.41, 'learning_rate': 0.0002, 'epoch': 0.02}"
        "  3%|▎| 400/12774 [40:00<19:00,  7.25s/it]"
        "{'loss': 3.12, 'epoch': 0.03}"
        "{'eval_loss': 3.9, 'epoch': 0.03}"
        "  4%|▍| 429/12774 [42:00<18:00,  7.25s/it]")
    r = _parse_train_log(log)
    assert r["step"] == 429 and r["planned"] == 12774
    assert r["sec_per_it"] == 7.25
    assert {"step": 200, "train_loss": 3.41} in r["points"]
    assert {"step": 400, "train_loss": 3.12} in r["points"]
    assert {"step": 400, "dev_loss": 3.9} in r["points"]


def test_parse_train_log_handles_it_per_s_and_missing_file(tmp_path):
    from nmt_forge.monitor import _parse_train_log

    assert _parse_train_log(tmp_path / "nope.log") == {}
    log = tmp_path / "fast.log"
    log.write_text(" 50%|█| 100/200 [00:30<00:30,  4.00it/s]")
    r = _parse_train_log(log)
    assert r["sec_per_it"] == 0.25
