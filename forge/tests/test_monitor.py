"""RunMonitor — the human-facing panel behind agent-driven training.

Pins the contract: /status serves the emitted state, POST /stop trips the
stop flag (and the cross-process breadcrumb file), the panel copy carries the
loud warning + the talk-to-the-agent notice, and attach mode reconstructs the
loss curve from HF trainer_state.json dumps. No browser is opened in tests
(NMT_FORGE_NO_MONITOR=1)."""

import json
import urllib.request
from pathlib import Path

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
        assert "Read-only by design" in html
        assert "talk to the agent" in html
        assert "Stop training" in html
        assert "earliest stop" in html
        for phrase in ("Is it getting better?", "Is it learning?", "dictionary floor", "dev score"):
            assert phrase in html, phrase
        # founder (2026-10-11): what goes down, when, what counts as progress — since the
        # 2026-10-14 HUD these explanations are the charts' tooltips (no walls of text)
        help_ = json.loads(_get(f"{mon.url}/hud.json?help=1"))["help"]
        assert "What should go down, and when" in help_["loss_chart"]["read"]
        assert "What counts as progress" in help_["score_chart"]["read"]
    finally:
        mon.shutdown()


def test_dev_score_points_floor_and_new_best_events(tmp_path):
    mon = RunMonitor(tmp_path, "toy-run", "abc123", open_browser=False)
    try:
        mon.emit("stage", name="train", floor_steps=0, planned_steps=600, eval_steps=60,
                 patience=6, scored=True, score_rows=200)
        mon.emit("floor", score=4.2, ci=[3.1, 5.0])
        mon.emit("dev_score", step=60, score=3.0)
        mon.emit("dev_score", step=120, score=7.5)
        mon.emit("dev_score", step=180, score=6.0)
        mon.emit("rate", step=200, sec_per_it=0.25)
        s = json.loads(_get(mon.url + "/status"))
        assert [p["dev_score"] for p in s["points"] if "dev_score" in p] == [3.0, 7.5, 6.0]
        assert s["floor"]["score"] == 4.2 and s["eval_steps"] == 60 and s["patience"] == 6
        assert s["sec_per_it"] == 0.25 and s["live_step"] == 200
        texts = [e["text"] for e in s["events"]]
        assert any("a check every 60 steps" in t for t in texts)
        assert any("dev score 7.5 — new best" in t for t in texts)
        assert any("dev score 6.0 (best so far 7.5)" in t for t in texts)
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


def test_an_attached_panel_reads_the_plan_from_the_trainer_state(tmp_path):
    """2026-10-13: attached to the Klingon ladder, the panel said "one every 0
    steps" — the plan comes from set_plan() in a live run only. The trainer
    state records it: the check interval, the planned steps, the patience."""
    d = tmp_path / "train" / "checkpoint-400"
    d.mkdir(parents=True)
    d.joinpath("trainer_state.json").write_text(json.dumps(
        {"global_step": 400, "eval_steps": 400, "max_steps": 8000,
         "stateful_callbacks": {"FlooredEarlyStopping": {"args": {"early_stopping_patience": 6}}},
         "log_history": [{"step": 400, "eval_chrf": 12.5}]}))
    mon = watch(tmp_path, port=0, open_browser=False, poll_seconds=0.05, max_polls=3)
    try:
        import time

        deadline = time.time() + 3
        s = {}
        while time.time() < deadline and not s.get("eval_steps"):
            s = json.loads(_get(f"{mon.url}/status"))
            time.sleep(0.05)
        assert (s["eval_steps"], s["planned_steps"], s["patience"]) == (400, 8000, 6)
        assert {"step": 400, "dev_score": 12.5} in s["points"]
    finally:
        mon.shutdown()
    assert "one every ${(every||0)" not in PANEL_HTML, "no \"one every 0 steps\" when the interval is unknown"


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


# -- what the run is training (founder 2026-10-13: "I should be able to tell
# what we're running") — run-facts.json, the header line, "About this run" ----

# a sentence planted in the training data: it must never reach /status, the
# facts file or anything the panel is fed (names, counts, averages only)
PLANTED = "the zorbleflax quivers beneath seventeen marmalade lanterns"


def _wait_status(url, ready, timeout=3.0):
    import time

    deadline = time.time() + timeout
    s = {}
    while time.time() < deadline:
        s = json.loads(_get(f"{url}/status"))
        if ready(s):
            break
        time.sleep(0.05)
    return s


def _gold(tmp_path, n=6):
    path = tmp_path / "data" / "gold.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = [{"source": PLANTED, "target": "zorb flax quivo"}] + [
        {"source": f"g {i} wug", "target": f"t {i}"} for i in range(n - 1)]
    path.write_text("".join(json.dumps(r) + "\n" for r in rows))
    return path, rows


def _config(tmp_path, ws, gold, **model):
    cfg = tmp_path / "c.json"
    cfg.write_text(json.dumps({
        "run_name": "m", "workspace": str(ws.root),
        "language": {"source": "eng", "target": "tlh", "target_name": "Klingon"},
        "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "model": {"backend": "dummy", "epochs": 20, **model}, "selection": {"metric": "loss"},
    }))
    return cfg


def test_live_facts_reach_status_and_the_panel(tmp_path):
    mon = RunMonitor(tmp_path, "toy-run", "abc123", open_browser=False)
    try:
        mon.emit("facts", run_name="toy-run", languages={"from": "eng", "to": "Klingon", "to_code": "tlh"},
                 model={"name": "byt5-small"}, training={"pairs": 6400, "files": [{"file": "train.jsonl", "pairs": 6400}]},
                 dev={"name": "calib-dev", "sentences": 501}, epochs=20)
        mon.emit("facts", length_limits={"rows": 6400, "target_cut": 3, "source_cut": 0,
                                         "max_src": 320, "max_tgt": 320})
        s = json.loads(_get(f"{mon.url}/status"))
        assert s["facts"]["training"]["pairs"] == 6400 and s["facts"]["dev"]["sentences"] == 501
        assert s["facts"]["epochs"] == 20 and s["facts"]["length_limits"]["target_cut"] == 3   # merged, not replaced
        # the HUD: each fact a labelled field, the same name in /hud.json and on the page
        f = json.loads(_get(f"{mon.url}/hud.json"))["fields"]
        assert (f["training_pairs"]["value"], f["training_pairs"]["unit"]) == (6400, "pairs")
        assert (f["dev_pairs"]["value"], f["epochs_planned"]["value"]) == (501, 20)
        assert f["target_language"]["display"] == "Klingon (tlh)" and f["model_name"]["value"] == "byt5-small"
        assert f["too_long_pairs"]["value"] == 3 and f["too_long_pairs"]["display"] == "3 (under 0.1%)"
        html = _get(mon.url).decode()
        for name in ("source_language", "target_language", "training_pairs", "dev_pairs", "source_words_mean",
                     "too_long_pairs", "epochs_planned", "parameters_trained", "memory_used_gb", "sovereignty"):
            assert f'data-field="{name}"' in html, name
    finally:
        mon.shutdown()


def test_run_writes_its_facts_at_start_and_feeds_a_live_panel(ws, dev_set, tmp_path, monkeypatch):
    """Live mode: run() describes the run before training (run-facts.json),
    hands the same facts to the panel, and the trainer's length-limit counts
    follow — with the job's label from NMT_FORGE_RUN_FACTS."""
    import importlib

    import nmt_forge.monitor as monitor_mod
    from nmt_forge.run_facts import FACTS_BASENAME
    from nmt_forge.training.backends import DummyBackend

    run_mod = importlib.import_module("nmt_forge.training.run")
    emitted, seen_at_train = [], {}

    class FakeMonitor:                     # no server, no port 8377 in a test
        def __init__(self, run_dir, *a, **k):
            self.run_dir = run_dir

        def emit(self, kind, **data):
            emitted.append((kind, data))

        def stop_requested(self):
            return False

    class Trainer(DummyBackend):
        def train(self, train_rows, dev_rows, params, run_dir):
            facts_file = Path(run_dir).parent / FACTS_BASENAME
            seen_at_train["exists"] = facts_file.is_file()      # written BEFORE training
            params["_facts"](length_limits={"rows": len(train_rows), "source_cut": 0,
                                            "target_cut": 1, "max_src": 320, "max_tgt": 320})
            return super().train(train_rows, dev_rows, params, run_dir)

    monkeypatch.delenv("NMT_FORGE_NO_MONITOR")
    monkeypatch.setattr(monitor_mod, "RunMonitor", FakeMonitor)
    monkeypatch.setattr(run_mod, "make_backend", lambda cfg: Trainer())
    monkeypatch.setenv("NMT_FORGE_RUN_FACTS", json.dumps(
        {"label": "calibration ladder: 6 of 6–12 pairs, seed 1", "corpus": "toybank", "licence": "CC0",
         "bogus": "x"}))
    gold, rows = _gold(tmp_path)
    # a non-dummy backend name opens the panel; the trainer stays the test double
    manifest = run_mod.run(_config(tmp_path, ws, gold, backend="hf-seq2seq"), disk_check=False)
    run_dir = Path(manifest["manifest_path"]).parent
    facts = json.loads((run_dir / FACTS_BASENAME).read_text())
    assert seen_at_train["exists"]
    assert facts["languages"] == {"from": "eng", "to": "Klingon", "to_code": "tlh"}
    assert facts["training"]["pairs"] == 6 and facts["training"]["files"] == [{"file": "gold.jsonl", "pairs": 6}]
    assert facts["training"]["avg_words"]["source"] == round(
        sum(len(r["source"].split()) for r in rows) / 6, 1)
    assert facts["training"]["avg_target_chars"] == round(sum(len(r["target"]) for r in rows) / 6, 1)
    assert (facts["training"]["corpus"], facts["training"]["licence"]) == ("toybank", "CC0")
    assert facts["dev"] == {"name": "toy-dev", "sentences": 8} and facts["epochs"] == 20
    assert facts["label"].startswith("calibration ladder") and "bogus" not in json.dumps(facts)
    assert facts["given"] == ["corpus", "label", "licence"]
    assert facts["length_limits"]["target_cut"] == 1 and facts["started"]
    fed = [d for kind, d in emitted if kind == "facts"]
    assert fed[0]["training"]["pairs"] == 6 and fed[-1] == {"length_limits": facts["length_limits"]}
    everything = json.dumps(emitted) + json.dumps(facts)
    assert PLANTED not in everything and "zorbleflax" not in everything


def test_an_attached_panel_reads_run_facts_beside_the_trainer_state(tmp_path):
    from nmt_forge.run_facts import write_facts

    facts = {"version": 1, "run_name": "byt5-small", "label": "calibration ladder: 6,400 of 400–12,800 pairs, seed 1",
             "languages": {"from": "English", "to": "Klingon", "to_code": "tlh"},
             "training": {"pairs": 6400, "files": [{"file": "train.jsonl", "pairs": 6400}],
                          "avg_words": {"source": 6.2, "target": 4.9}, "avg_target_chars": 31.4},
             "dev": {"name": "calib-dev", "sentences": 501}, "epochs": 20}
    write_facts(tmp_path, facts)
    d = tmp_path / "train" / "checkpoint-400"
    d.mkdir(parents=True)
    d.joinpath("trainer_state.json").write_text(json.dumps(
        {"global_step": 400, "eval_steps": 400, "max_steps": 8000,
         "log_history": [{"step": 400, "eval_chrf": 12.5}]}))
    mon = watch(tmp_path, port=0, open_browser=False, poll_seconds=0.05, max_polls=3)
    try:
        s = _wait_status(mon.url, lambda s: s["facts"] and s["points"])
        assert s["facts"] == facts
        assert {"step": 400, "dev_score": 12.5} in s["points"]
    finally:
        mon.shutdown()


def test_status_never_carries_a_sentence_of_the_training_data(ws, dev_set, tmp_path):
    """A finished dummy run, attached: the panel says how many pairs and how
    long they are — and not one word of them."""
    from nmt_forge.training.run import run

    gold, _ = _gold(tmp_path)
    manifest = run(_config(tmp_path, ws, gold))
    run_dir = Path(manifest["manifest_path"]).parent
    mon = watch(run_dir, port=0, open_browser=False, poll_seconds=0.05, max_polls=2)
    try:
        s = _wait_status(mon.url, lambda s: s["facts"])
        assert s["facts"]["training"]["pairs"] == 6
        body = _get(f"{mon.url}/status").decode()
        assert PLANTED not in body and "zorbleflax" not in body and "marmalade" not in body
    finally:
        mon.shutdown()


def test_an_attached_panel_rebuilds_the_facts_of_a_run_an_earlier_forge_started(tmp_path, dev_set, ws):
    """The Klingon ladder's jobs run a frozen forge that writes no
    run-facts.json: attached, the panel rebuilds them from the config the
    workspace's run lock names — started at the lock's time."""
    import time as _time

    gold, _ = _gold(tmp_path)
    cfg = _config(tmp_path, ws, gold, backend="hf-seq2seq", base="google/byt5-small")
    run_dir = ws.runs_dir / "m-0123abcd"
    (run_dir / "train").mkdir(parents=True)
    created = _time.time() - 600
    (ws.root / "run.lock").write_text(json.dumps(
        {"pid": 1, "created": created, "run_name": "m", "run_dir": str(run_dir), "config": str(cfg)}))
    mon = watch(run_dir, port=0, open_browser=False, poll_seconds=0.05, max_polls=2)
    try:
        s = _wait_status(mon.url, lambda s: s["facts"])
        f = s["facts"]
        assert f["model"] == {"name": "byt5-small", "base": "google/byt5-small", "backend": "hf-seq2seq",
                              "preset": "byt5-small"}
        assert f["training"]["pairs"] == 6 and f["dev"]["sentences"] == 8 and f["epochs"] == 20
        assert f["started"].startswith(_time.strftime("%Y-%m-%d", _time.localtime(created)))
        assert "given" not in f and "label" not in f
        assert not (run_dir / "run-facts.json").exists()          # a view: it writes nothing into the run
    finally:
        mon.shutdown()


def test_missing_facts_are_left_out_never_zero_or_empty(tmp_path, ws, dev_set):
    """No language block, no epochs, a training file that cannot be read, a
    dev entry without a row count: those facts are absent — the panel never
    says 0 or "undefined" (eb0d4d400's "one every 0 steps")."""
    from nmt_forge.run_facts import describe_run
    from nmt_forge.training.config import RunConfig

    cfg = RunConfig.from_dict({"run_name": "m", "data": {"gold": [str(tmp_path / "missing.jsonl")], "dev": "toy-dev"},
                               "model": {"backend": "dummy"}})
    facts = describe_run(cfg, dev_entry={"path": "x"}, environ={})
    assert set(facts) == {"version", "run_name", "started", "model", "dev"}
    assert facts["model"] == {"name": "dummy", "backend": "dummy"} and facts["dev"] == {"name": "toy-dev"}

    def walk(v):
        if isinstance(v, dict):
            for x in v.values():
                walk(x)
        else:
            assert v not in (None, "", 0, [], {}), facts
    walk(facts)
    # a private-use code names no language: never shown beside the name
    cfg = RunConfig.from_dict({"run_name": "m", "data": {"dev": "toy-dev"}, "model": {"backend": "dummy"},
                               "language": {"source": "eng", "target": "qaa", "target_name": "tlh (calibration)"}})
    assert describe_run(cfg, environ={})["languages"] == {"from": "eng", "to": "tlh (calibration)"}


def test_given_facts_take_only_their_keys(capsys):
    from nmt_forge.run_facts import GIVEN_ENV, given_facts

    assert given_facts({}) == {}
    assert given_facts({GIVEN_ENV: "not json"}) == {}
    assert "not a JSON object" in capsys.readouterr().out
    got = given_facts({GIVEN_ENV: json.dumps({"label": "  rung\n 3 ", "corpus": "", "licence": True,
                                              "target_code": "tlh", "sentence": PLANTED})})
    assert got == {"label": "rung 3", "target_code": "tlh"}
    assert "sentence ignored" in capsys.readouterr().out
    assert len(given_facts({GIVEN_ENV: json.dumps({"label": "x" * 1000})})["label"]) == 200


# -- the 2026-10-14 dashboard (docs/FORGE_DASHBOARD_CRITIQUE_2026-10-14.md): a HUD of labelled
# fields (/hud.json + data-field), tooltips for every explanation, zoomable charts fed by
# /status series, where the run runs, the guardrails, checkpoints, and a runs view ---------

import os
import re
import struct
import sys
import time as _t


def _trainer_state(d, step, *, max_steps=800, every=200, chrf=(10.0, 18.0, 17.5, 21.0), patience_used=0):
    hist = []
    for s in range(10, step + 1, 10):
        hist.append({"step": s, "loss": 5.0 - s / 400, "learning_rate": 3e-4 * (1 - s / max_steps),
                     "grad_norm": 2.0 + (s % 30) / 10, "epoch": s / 200})
        if s % every == 0:
            k = s // every - 1
            hist.append({"step": s, "eval_loss": 3.0 - k * 0.1, "eval_chrf": chrf[k % len(chrf)],
                         "eval_runtime": 12.5, "epoch": s / 200})
    d.mkdir(parents=True, exist_ok=True)
    (d / "trainer_state.json").write_text(json.dumps({
        "global_step": step, "max_steps": max_steps, "eval_steps": every, "num_train_epochs": 4, "epoch": step / 200,
        "train_batch_size": 8, "best_global_step": every * 2, "logging_steps": 10,
        "stateful_callbacks": {"FlooredEarlyStopping": {"args": {"early_stopping_patience": 3},
                                                        "attributes": {"early_stopping_patience_counter": patience_used}}},
        "log_history": hist}))


def _iso(t):
    return _t.strftime("%Y-%m-%dT%H:%M:%S+00:00", _t.gmtime(t))


def _workspace(root, run="m-0001", *, ledger=(), lock_pid=None):
    """A forge workspace as a run leaves it: registry (a dev and a test set), ledger,
    a preregistration, run-facts (and a run lock naming ``lock_pid``)."""
    from nmt_forge.run_facts import write_facts

    ws = root / ".forge"
    run_dir = ws / "runs" / run
    run_dir.mkdir(parents=True)
    (ws / "eval-registry.json").write_text(json.dumps({"sets": {
        "toy-dev": {"role": "dev", "rows": 40, "sha256": "ab" * 32},
        "toy-test": {"role": "test", "rows": 50, "sha256": "cd" * 32}}}))
    now = _t.time()
    events = [{"ts": _iso(now - 600), "event": "register", "set": "toy-dev", "role": "dev"},
              {"ts": _iso(now - 500), "event": "read", "set": "toy-dev", "role": "dev", "purpose": "dev-selection"},
              {"ts": _iso(now - 499), "event": "read", "set": "toy-dev", "role": "dev", "purpose": "audit"},
              {"ts": _iso(now - 900), "event": "read", "set": "toy-test", "role": "test", "purpose": "score"},
              *ledger]
    (ws / "ledger.jsonl").write_text("".join(json.dumps(e) + "\n" for e in events))
    (ws / "preregistrations").mkdir()
    (ws / "preregistrations" / "p1.json").write_text("{}")
    if lock_pid:
        (ws / "run.lock").write_text(json.dumps({"pid": lock_pid, "created": now - 550, "run_dir": str(run_dir),
                                                 "config_hash": "feedbeef00112233"}))
    write_facts(run_dir, {"version": 1, "run_name": "m", "started": _iso(now - 550),
                          "languages": {"from": "English", "to": "Klingon", "to_code": "tlh"},
                          "model": {"name": "byt5-small", "preset": "byt5-small"},
                          "training": {"pairs": 1600, "avg_words": {"source": 6.0, "target": 5.0},
                                       "median_words": {"source": 6.0, "target": 4.5}},
                          "dev": {"name": "toy-dev", "sentences": 40}, "epochs": 4,
                          "settings": {"batch_size": 8, "grad_accum": 2, "effective_batch": 16, "lr": 3e-4,
                                       "warmup_ratio": 0.05}})
    return ws, run_dir


def _wait_hud(url, ready, timeout=4.0):
    deadline = _t.time() + timeout
    doc = {}
    while _t.time() < deadline:
        doc = json.loads(_get(f"{url}/hud.json"))
        if ready(doc):
            break
        _t.sleep(0.05)
    return doc


def test_panel_is_one_offline_document_with_its_assets_inlined():
    from nmt_forge.monitor import PANEL_DIR, panel_html

    html = panel_html()
    assert html == PANEL_HTML
    assert "/*__PANEL_CSS__*/" not in html and "/*__PANEL_JS__*/" not in html
    assert "function chartData0" in html and ".topbar {" in html          # the script and the styles, inline
    assert (PANEL_DIR / "panel.html").is_file()
    # no network: no external script, stylesheet, font or import
    for banned in ("<script src", "<link", "@import", "fonts.googleapis", "https://"):
        assert banned not in html, banned
    # the site palette (DESIGN.md scholarly teal, ink and paper), never the rejected cyan/gold
    for hexv in ("#0f766e", "#3fc1c0", "#101312", "#f7f6f2"):
        assert hexv in html.lower(), hexv
    for hexv in ("#4dd8ff", "#ffcf4d"):
        assert hexv not in html.lower(), hexv


def test_every_tooltip_key_has_plain_help_and_names_no_third_party():
    from nmt_forge.monitor import HELP, hud_document

    keys = set(re.findall(r'data-help="([a-z_]+)"', PANEL_HTML))
    keys |= set(re.findall(r"dataset\.help = '([a-z_]+)'", PANEL_HTML))
    keys |= {f["help"] for f in hud_document({"facts": {}}, now=_t.time())["fields"].values()}
    assert keys and not keys - set(HELP), keys - set(HELP)
    for k, h in HELP.items():
        assert set(h) == {"title", "what", "why", "read"} and all(h.values()), k
        text = " ".join(h.values())
        for name in ("TensorBoard", "Weights", "MLflow", "Comet", "Google", "Meta", "Hugging", "OpenAI",
                     "RunPod", "AmericasNLP", "WMT", "ByT5", "NLLB"):
            assert name not in text, (k, name)


def test_every_labelled_element_is_a_hud_field():
    from nmt_forge.monitor import hud_document

    names = set(re.findall(r'data-field="([a-z_0-9.]+)"', PANEL_HTML))
    fields = set(hud_document({"facts": {}, "where": {"kind": "remote", "sovereignty": "semi-sovereign"}},
                              now=_t.time())["fields"])
    assert names and not names - fields, names - fields
    for need in ("source_language", "target_language", "model_name", "parameters_trained", "training_pairs",
                 "source_words_mean", "target_words_median", "dev_pairs", "checks_done", "checks_planned",
                 "check_every_steps", "steps_done", "steps_planned", "dev_score_latest_step", "dev_score_best",
                 "patience_used", "eta_s", "memory_used_gb", "memory_limit_gb", "sovereignty", "cost_usd",
                 "cost_cap_usd"):
        assert need in fields, need


def test_hud_fields_have_units_and_unknown_is_null_never_zero():
    from nmt_forge.monitor import hud_document

    doc = hud_document({"facts": {}, "points": []}, now=_t.time())
    assert doc["schema"] == "nmt-forge.hud/1"
    f = doc["fields"]
    for name in ("training_pairs", "dev_score_best", "steps_done", "eta_s", "memory_used_gb", "patience_used"):
        assert f[name]["value"] is None and f[name]["display"] == "—", (name, f[name])
    assert f["training_pairs"]["unit"] == "pairs" and f["dev_score_best"]["unit"] == "chrF++"
    assert f["eta_s"]["unit"] == "s" and f["memory_used_gb"]["unit"] == "GB"
    for name, v in f.items():
        assert set(v) == {"label", "value", "unit", "display", "help"}, name


def test_attached_hud_reads_the_trainer_state_checkpoints_ledger_and_lock(tmp_path):
    """The run folder as forge leaves it mid-run: two checkpoints, the workspace ledger and
    registry, the run lock — the HUD says progress, checks, patience, pace, guardrails."""
    ws, run_dir = _workspace(tmp_path, lock_pid=os.getpid())
    for step in (400, 600):
        _trainer_state(run_dir / "train" / f"checkpoint-{step}", step, patience_used=1 if step == 600 else 0)
    t0 = _t.time() - 300
    os.utime(run_dir / "train" / "checkpoint-400" / "trainer_state.json", (t0, t0))
    os.utime(run_dir / "train" / "checkpoint-600" / "trainer_state.json", (t0 + 200, t0 + 200))
    header = json.dumps({"w1": {"dtype": "F32", "shape": [300, 1000], "data_offsets": [0, 0]},
                         "w2": {"dtype": "F32", "shape": [1000], "data_offsets": [0, 0]},
                         "__metadata__": {"format": "pt"}}).encode()
    (run_dir / "train" / "checkpoint-600" / "model.safetensors").write_bytes(struct.pack("<Q", len(header)) + header)
    mon = watch(run_dir, port=0, open_browser=False, poll_seconds=0.05, max_polls=2)
    try:
        doc = _wait_hud(mon.url, lambda d: d["fields"]["checks_done"]["value"]
                        and d["fields"]["dev_reads"]["value"] is not None)
        f = doc["fields"]
        assert (f["steps_done"]["value"], f["steps_planned"]["value"], f["progress_pct"]["value"]) == (600, 800, 75.0)
        assert (f["checks_done"]["value"], f["checks_planned"]["value"], f["check_every_steps"]["value"]) == (3, 4, 200)
        assert [c["dev_score"] for c in doc["checks"]] == [10.0, 18.0, 17.5]
        assert [c["best"] for c in doc["checks"]] == [False, True, False] and doc["checks_measure"] == "dev_score"
        assert (f["dev_score_best"]["value"], f["dev_score_best_step"]["value"]) == (18.0, 400)
        assert f["dev_score_latest"]["value"] == 17.5 and f["dev_score_change"]["value"] == -0.5
        assert f["patience_used"]["display"] == "1 of 3" and f["verdict"]["value"] == "levelling_off"
        assert f["effective_batch"]["value"] == 16 and f["epochs_planned"]["value"] == 4
        # pace from the two checkpoints' save times: 200 s for 200 steps
        assert abs(f["sec_per_step"]["value"] - 1.0) < 0.05 and f["eta_s"]["value"] is not None
        assert f["parameters_trained"]["value"] == 301000 and f["parameters_trained_kind"]["value"] == "all"
        assert f["checkpoints_on_disk"]["value"] == 2 and f["best_checkpoint"]["value"] == "checkpoint-400"
        # the guardrails: dev reads by purpose; the test read BEFORE this run started does not count
        assert f["dev_reads"]["value"] == 2 and f["dev_reads"]["display"] == "1 audit, 1 dev selection"
        assert (f["test_sets"]["value"], f["test_reads_since_start"]["value"]) == (1, 0)
        assert f["preregistrations"]["value"] == 1
        assert f["sovereignty"]["value"] == "sovereign" and f["where_detail"]["value"] == "this computer"
        assert f["config_hash"]["value"] == "feedbeef0011"
        if sys.platform == "darwin" or sys.platform.startswith("linux"):
            assert f["memory_used_gb"]["value"] > 0             # the run lock's pid: this test process
        assert doc["stop_available"] is False                   # no --pid: the button signals nothing
        s = json.loads(_get(f"{mon.url}/status"))
        assert len(s["series"]["lr"]) == 60 and len(s["series"]["grad_norm"]) == 60
        assert len(s["series"]["sec_per_step"]) == 1 and abs(s["series"]["sec_per_step"][0][1] - 1.0) < 0.05
        assert [c["step"] for c in s["checkpoints"]] == [400, 600]
    finally:
        mon.shutdown()


def test_status_and_hud_answer_same_when_nothing_changed(tmp_path):
    mon = RunMonitor(tmp_path, "toy-run", "abc123", open_browser=False, enrich=False)
    try:
        v = json.loads(_get(f"{mon.url}/status"))["version"]
        same = json.loads(_get(f"{mon.url}/status?v={v}"))
        assert same["same"] is True and same["version"] == v and "points" not in same
        mon.emit("train_loss", step=10, loss=2.0)
        s = json.loads(_get(f"{mon.url}/status?v={v}"))
        assert s["version"] > v and s["points"] == [{"step": 10, "train_loss": 2.0}]
        assert json.loads(_get(f"{mon.url}/hud.json?v={s['version']}"))["same"] is True
    finally:
        mon.shutdown()


def test_live_rate_reports_become_a_seconds_per_step_series(tmp_path):
    mon = RunMonitor(tmp_path, "toy-run", "abc123", open_browser=False, enrich=False)
    try:
        mon.emit("rate", step=10, sec_per_it=0.5)
        _t.sleep(0.05)
        mon.emit("rate", step=20, sec_per_it=0.5)
        sps = json.loads(_get(f"{mon.url}/status"))["series"]["sec_per_step"]
        assert len(sps) == 1 and sps[0][0] == 20 and 0.003 < sps[0][1] < 1.0
    finally:
        mon.shutdown()


def test_a_remote_run_is_semi_sovereign_with_its_cost_against_the_cap(tmp_path):
    from nmt_forge.monitor import _where_view

    now = _t.time()
    start = {"ts": _iso(now - 1800), "event": "remote-start", "sovereignty": "semi-sovereign",
             "provider": "runpod", "gpu": "NVIDIA A40", "usd_per_hour": 0.6, "cap_usd": 1.0,
             "datacenters": ["CA-MTL-1"], "run": "m-0001",
             "files": [{"file": "train.jsonl", "sha256": "ef" * 32, "role": "train"}]}
    ws, run_dir = _workspace(tmp_path, ledger=[start])
    mon = watch(run_dir, port=0, open_browser=False, poll_seconds=0.05, max_polls=2)
    try:
        doc = _wait_hud(mon.url, lambda d: d["fields"]["sovereignty"]["value"] == "semi-sovereign")
        fl = doc["fields"]
        assert fl["where_detail"]["value"] == "RunPod · NVIDIA A40 · CA-MTL-1"
        assert abs(fl["cost_usd"]["value"] - 0.30) < 0.02 and fl["cost_cap_usd"]["value"] == 1.0
        assert doc["where"]["files_sent"] == [{"file": "train.jsonl", "role": "train", "fingerprint": "ef" * 6}]
        assert fl["run_status"]["value"] == "training"                 # training on the rented machine
        assert fl["data_age_s"]["value"] is None                       # nothing has come back yet
    finally:
        mon.shutdown()
    # ended: the remote-end record's figures, not an estimate
    end = {"ts": start["ts"], "event": "remote-end", "run": "m-0001", "outcome": "trained", "hours": 0.5,
           "usd_estimated": 0.31}
    w = _where_view(run_dir, [start, end], None, now)
    assert w["ended"] is True and w["usd"] == 0.31 and w["outcome"] == "trained"


def test_a_finished_run_shows_the_kept_checkpoint_with_its_interval(tmp_path):
    ws, run_dir = _workspace(tmp_path)
    _trainer_state(run_dir / "train" / "checkpoint-800", 800)
    (run_dir / "run-manifest.json").write_text(json.dumps({
        "config_hash": "0123456789abcdef", "selected_checkpoint": "checkpoint-400",
        "stages": [{"selection": {"selected_step": 400, "per_checkpoint": [
            {"id": "checkpoint-400", "dev_loss": 2.9, "chrf++": 17.2, "ci": [15.0, 19.4]},
            {"id": "checkpoint-800", "dev_loss": 2.7, "chrf++": 16.0, "ci": [13.8, 18.1]}]},
            "stop_explanation": "early stopping fired at step 800.\nmore",
            "mix": {"gold": {"leak_audits": {"x": {"per_set": {"toy-dev": {"role": "dev", "exact_source": 1,
                                                                         "exact_target": 0, "near_dupe": 2}}}}}}}],
        "dev_report": {"n": 40, "scores": {"chrf++": {"score": 17.2, "ci_lower": 15.0, "ci_upper": 19.4}}}}))
    mon = watch(run_dir, port=0, open_browser=False, poll_seconds=0.05, max_polls=2)
    try:
        doc = _wait_hud(mon.url, lambda d: d["fields"]["final_dev_score"]["value"] is not None)
        f = doc["fields"]
        assert (f["final_dev_score"]["value"], f["final_dev_score_ci"]["display"]) == (17.2, "95% 15.0–19.4")
        assert f["kept_checkpoint"]["value"] == "checkpoint-400" and f["run_status"]["value"] == "done"
        assert [(x["step"], x["ci"]) for x in doc["finalists"]] == [(400, [15.0, 19.4]), (800, [13.8, 18.1])]
        assert f["leak_exact_matches"]["value"] == 1
        assert f["eta_s"]["value"] is None and f["next_check_step"]["value"] is None
    finally:
        mon.shutdown()


def test_checks_of_a_run_that_keeps_its_checkpoint_by_loss(tmp_path):
    """No dev score during training: the checks are the dev-loss evaluations, the best is
    the lowest loss — never an empty strip that says 'no check yet' on a finished run."""
    from nmt_forge.monitor import hud_document

    pts = [{"step": 100, "dev_loss": 5.3}, {"step": 200, "dev_loss": 5.1}, {"step": 300, "dev_loss": 5.4}]
    doc = hud_document({"points": pts, "facts": {}, "status": "training", "patience": 6}, now=_t.time())
    assert doc["checks_measure"] == "dev_loss" and [c["best"] for c in doc["checks"]] == [False, True, False]
    assert doc["fields"]["checks_done"]["value"] == 3 and doc["fields"]["dev_score_best"]["value"] is None
    assert doc["fields"]["patience_used"]["display"] == "1 of 6"


def test_runs_view_lists_the_workspace_runs_with_their_curves(tmp_path, monkeypatch):
    ws, run_dir = _workspace(tmp_path)
    _trainer_state(run_dir / "train" / "checkpoint-600", 600)
    other = ws / "runs" / "m-0002"
    _trainer_state(other / "train" / "checkpoint-400", 400, chrf=(30.0, 33.0))
    (other / "run-manifest.json").write_text(json.dumps({"selected_checkpoint": "checkpoint-400", "stages": [],
                                                         "dev_report": {"scores": {"chrf++": {
                                                             "score": 32.5, "ci_lower": 30.1, "ci_upper": 34.9}}}}))
    extra = tmp_path / "elsewhere" / ".forge" / "runs" / "m-0003"
    _trainer_state(extra / "train" / "checkpoint-200", 200)
    monkeypatch.setenv("NMT_FORGE_MONITOR_RUNS", str(tmp_path / "elsewhere" / ".forge" / "runs" / "*"))
    mon = RunMonitor(run_dir, "m-0001", "", open_browser=False, enrich=False)
    try:
        r = json.loads(_get(f"{mon.url}/runs"))
        by = {x["name"]: x for x in r["runs"]}
        assert set(by) == {"m-0001", "m-0002", "m-0003"} and r["current"] == "m-0001"
        assert by["m-0001"]["curve"] == [[200, 10.0], [400, 18.0], [600, 17.5]]
        assert by["m-0001"]["best"] == {"step": 400, "score": 18.0} and by["m-0001"]["pairs"] == 1600
        assert by["m-0002"]["status"] == "done" and by["m-0002"]["final"]["ci"] == [30.1, 34.9]
        assert by["m-0003"]["where"] == "sovereign"
    finally:
        mon.shutdown()


def test_the_dashboard_endpoints_never_carry_a_sentence_of_the_training_data(ws, dev_set, tmp_path):
    """A finished dummy run, attached: /hud.json, /status, /runs and the page say counts,
    names and numbers — not one word of the pairs."""
    from nmt_forge.training.run import run

    gold, _ = _gold(tmp_path)
    manifest = run(_config(tmp_path, ws, gold))
    run_dir = Path(manifest["manifest_path"]).parent
    mon = watch(run_dir, port=0, open_browser=False, poll_seconds=0.05, max_polls=2)
    try:
        _wait_status(mon.url, lambda s: s["facts"])
        for path in ("/hud.json?help=1", "/status", "/runs", "/"):
            body = _get(f"{mon.url}{path}").decode()
            assert PLANTED not in body and "zorbleflax" not in body and "marmalade" not in body, path
        assert json.loads(_get(f"{mon.url}/hud.json"))["fields"]["training_pairs"]["value"] == 6
    finally:
        mon.shutdown()


def test_live_panel_enriches_from_its_run_folder_and_reads_its_own_memory(tmp_path):
    run_dir = tmp_path / "runs" / "m-live"
    _trainer_state(run_dir / "train" / "checkpoint-200", 200)
    mon = RunMonitor(run_dir, "m-live", "abc", open_browser=False)       # live: enrichment on
    try:
        mon.emit("train_loss", step=200, loss=1.5)
        mon.refresh()
        s = json.loads(_get(f"{mon.url}/status"))
        assert s["mode"] == "live" and len(s["series"]["lr"]) == 20 and s["trainer"]["max_steps"] == 800
        assert s["checkpoints"][0]["step"] == 200
        if sys.platform == "darwin" or sys.platform.startswith("linux"):
            assert s["machine"]["memory_now_gb"] > 0 and s["machine"]["memory_source"] == "this process"
    finally:
        mon.shutdown()


def test_parse_train_log_also_reads_learning_rate_gradient_and_pace(tmp_path):
    from nmt_forge.monitor import _parse_train_log

    log = tmp_path / "run.log"
    log.write_text(
        "  2%|▏| 200/1000 [20:00<20:00,  6.10s/it]"
        "{'loss': 3.41, 'grad_norm': 5.5, 'learning_rate': 0.0002, 'epoch': 0.02}"
        "  3%|▎| 400/1000 [40:00<19:00,  7.25s/it]"
        "{'loss': 3.12, 'grad_norm': '4.25', 'learning_rate': '1.5e-04', 'epoch': '0.03'}")
    r = _parse_train_log(log)
    assert r["lr"] == [[200, 0.0002], [400, 0.00015]] and r["grad_norm"] == [[200, 5.5], [400, 4.25]]
    assert r["rates"] == [[200, 6.1], [400, 7.25]]


def test_run_facts_carry_settings_median_lengths_and_preset(tmp_path):
    from nmt_forge.run_facts import describe_run
    from nmt_forge.training.config import RunConfig

    gold = tmp_path / "g.jsonl"
    gold.write_text("".join(json.dumps({"source": "a b c", "target": t}) + "\n" for t in ("x", "x y", "x y z w")))
    cfg = RunConfig.from_dict({"run_name": "m", "data": {"gold": [str(gold)], "dev": "d"},
                               "model": {"backend": "hf-seq2seq", "base": "google/byt5-small", "batch_size": 8,
                                         "grad_accum": 2, "lr": 3e-4, "warmup_ratio": 0.05, "patience": 6},
                               "selection": {"metric": "generation:chrf++"}})
    f = describe_run(cfg, environ={})
    assert f["model"]["preset"] == "byt5-small"
    assert f["training"]["median_words"] == {"source": 3.0, "target": 2.0}
    assert f["settings"] == {"batch_size": 8, "grad_accum": 2, "effective_batch": 16, "lr": 3e-4,
                             "warmup_ratio": 0.05, "patience": 6, "selection_metric": "generation:chrf++"}
    lowmem = RunConfig.from_dict({"run_name": "m", "data": {"dev": "d"},
                                  "model": {"backend": "hf-seq2seq", "base": "google/byt5-small",
                                            "optim": "adafactor", "gradient_checkpointing": True}})
    assert describe_run(lowmem, environ={})["model"]["preset"] == "byt5-small-lowmem"
    custom = RunConfig.from_dict({"run_name": "m", "data": {"dev": "d"},
                                  "model": {"backend": "hf-seq2seq", "base": "someone/other-model"}})
    assert describe_run(custom, environ={})["model"]["preset"] == "cpu-finetune"


# -- 2026-10-14 second pass: run health, the patience stop, NaN-safe JSON, remote progress, contrast ----

def _health(doc):
    return {h["key"]: (h["state"], h["text"]) for h in doc["health"]}


def _train(n, f):
    return [{"step": 10 * i, "train_loss": f(i)} for i in range(1, n + 1)]


def test_health_readings_answer_is_it_going_well():
    """One reading per question, each ok / watch / alert (None = cannot tell yet), mirrored as
    labelled fields; the summary is the worst of them."""
    from nmt_forge.monitor import hud_document

    now = _t.time()
    falling = _train(60, lambda i: 5.0 - i / 20)
    checks = [{"step": 200 * k, "dev_score": 10.0 + 3 * k, "dev_loss": 3.0 - 0.1 * k} for k in range(1, 5)]
    state = {"facts": {}, "status": "training", "patience": 6, "eval_steps": 200, "planned_steps": 2000,
             "points": falling + checks, "updated": now - 30, "live_step": 800, "mode": "live",
             "series": {"grad_norm": [[10 * i, 2.0 + (i % 3) / 10] for i in range(1, 80)], "sec_per_step": [[800, 0.5]]},
             "machine": {"memory_now_gb": 6.0, "memory_total_gb": 24.0}}
    doc = hud_document(state, now=now)
    h = _health(doc)
    assert h["score"] == ("ok", "new best") and h["learning"][0] == "ok" and h["learning"][1].startswith("falling")
    assert h["overfit"][0] == "ok" and h["stability"] == ("ok", "steady")
    assert h["memory"] == ("ok", "25% of 24 GB") and h["freshness"][0] == "ok" and h["cost"][0] is None
    f = doc["fields"]
    assert f["health_overall"]["value"] == "ok" and f["health_overall"]["display"] == "all ok"
    for k in ("score", "learning", "overfit", "stability", "memory", "freshness", "cost"):
        assert f[f"health_{k}"]["help"] == f"health_{k}"

    # a rising loss, a memorising model, a spiking update, memory near the limit, a quiet process
    rising = _train(60, lambda i: 2.0 * 1.06 ** i)          # +79% over the last stretch
    stale = [{"step": 200 * k, "dev_score": s, "dev_loss": dl}
             for k, s, dl in ((1, 20.0, 2.0), (2, 25.0, 1.9), (3, 24.0, 2.2), (4, 23.5, 2.4))]
    spiky = [[10 * i, 2.0] for i in range(1, 80)] + [[800 + i, 40.0] for i in range(3)]
    bad = {**state, "points": rising + stale, "series": {**state["series"], "grad_norm": spiky},
           "machine": {"memory_now_gb": 23.5, "memory_total_gb": 24.0}, "updated": now - 3600}
    doc = hud_document(bad, now=now)
    h = _health(doc)
    assert h["learning"][0] == "alert" and "rising" in h["learning"][1]
    assert h["overfit"] == ("watch", "loss up, no new best") and h["score"] == ("watch", "2 without a new best")
    assert h["stability"] == ("watch", "3 spikes recently") and h["memory"][0] == "alert"
    assert h["freshness"][0] == "alert"                  # an hour without news; it usually takes a minute
    assert doc["fields"]["health_overall"]["display"] == "3 to watch · 3 alerts"
    # with little data the dev loss rises while the score improves: that alone is fine
    lifting = [{"step": 200 * k, "dev_score": 10.0 * k, "dev_loss": 2.0 + 0.2 * k} for k in range(1, 5)]
    assert _health(hud_document({**state, "points": falling + lifting}, now=now))["overfit"] == ("ok", "loss up, score rising")


def test_a_loss_that_is_not_a_number_is_an_alert_and_never_blanks_the_page(tmp_path):
    from nmt_forge.monitor import hud_document

    nan = float("nan")
    pts = _train(30, lambda i: 3.0) + [{"step": 400, "train_loss": nan}]
    assert _health(hud_document({"facts": {}, "status": "training", "points": pts}, now=_t.time()))["learning"] \
        == ("alert", "not a number")
    mon = RunMonitor(tmp_path, "toy-run", "abc123", open_browser=False, enrich=False)
    try:
        mon.emit("train_loss", step=10, loss=nan)
        mon.emit("dev_score", step=20, score=float("inf"))

        def strict(text):                     # what a browser's JSON.parse accepts: no NaN, no Infinity
            return json.loads(text, parse_constant=lambda c: (_ for _ in ()).throw(ValueError(c)))

        s = strict(_get(f"{mon.url}/status").decode())
        assert s["points"][0]["train_loss"] is None and s["points"][1]["dev_score"] is None
        doc = strict(_get(f"{mon.url}/hud.json").decode())
        assert doc["fields"]["health_learning"]["value"] in (None, "alert")
    finally:
        mon.shutdown()


def test_the_patience_stop_and_the_recent_gain():
    """When it stops if no check beats the best (never before the earliest stop), and whether
    waiting pays: the average change over the last three checks."""
    from nmt_forge.monitor import hud_document

    now = _t.time()
    pts = [{"step": 400 * k, "dev_score": s} for k, s in ((1, 10.0), (2, 20.0), (3, 19.0), (4, 21.5), (5, 21.0))]
    base = {"facts": {}, "status": "training", "patience": 3, "eval_steps": 400, "planned_steps": 8000,
            "points": pts, "live_step": 2000, "updated": now, "series": {"sec_per_step": [[2000, 2.0]]}}
    f = hud_document(base, now=now)["fields"]
    assert f["stop_by_patience_step"]["value"] == 1600 + 3 * 400 and f["stop_by_patience_step"]["display"] == "step 2,800"
    assert f["stop_by_patience_in_s"]["value"] == 800 * 2
    assert f["dev_score_recent_gain"]["value"] == round((21.0 - 20.0) / 3, 2)
    assert f["dev_score_recent_gain"]["display"] == "+0.3/check"
    assert f["dev_score_change"]["display"] == "−0.5"          # a real minus sign, not a hyphen
    floored = hud_document({**base, "floor_steps": 5000}, now=now)["fields"]
    assert floored["stop_by_patience_step"]["value"] == 5200            # the first check after the earliest stop
    late = hud_document({**base, "planned_steps": 2400}, now=now)["fields"]
    assert late["stop_by_patience_step"]["display"] == "past the end" and late["stop_by_patience_in_s"]["value"] is None
    done = hud_document({**base, "status": "done"}, now=now)["fields"]
    assert done["stop_by_patience_step"]["value"] is None


def test_remote_progress_is_copied_as_numbers_only_and_the_panel_shows_it(tmp_path):
    """The remote lane's 30-s reading of a rented machine: its trainer state (plan + numeric log,
    nothing else) and its heartbeat — so a semi-sovereign run shows steps, curves, pace, time
    left and what waiting will cost while it trains. Removed when the run comes back."""
    from nmt_forge.monitor import (REMOTE_MIRROR, REMOTE_PROGRESS, clear_remote_progress, mirror_trainer_state,
                                   write_remote_progress)

    now = _t.time()
    start = {"ts": _iso(now - 1800), "event": "remote-start", "sovereignty": "semi-sovereign",
             "provider": "runpod", "gpu": "NVIDIA A40", "usd_per_hour": 0.6, "cap_usd": 1.0,
             "datacenters": ["CA-MTL-1"], "run": "m-0001", "files": []}
    ws, run_dir = _workspace(tmp_path, ledger=[start])
    hist = [{"step": s, "loss": 4.0 - s / 100, "learning_rate": 1e-4, "grad_norm": 2.5, "epoch": s / 25,
             "note": "a sentence that must never be copied"} for s in range(5, 105, 5)]
    hist += [{"step": 50, "eval_chrf": 12.5, "eval_loss": 2.5}, {"step": 100, "eval_chrf": 15.0, "eval_loss": 2.4}]
    src = {"global_step": 100, "max_steps": 500, "eval_steps": 50, "num_train_epochs": 20, "train_batch_size": 8,
           "trial_name": "never copied", "log_history": hist,
           "stateful_callbacks": {"FlooredEarlyStopping": {"args": {"early_stopping_patience": 6, "note": "x"},
                                                           "attributes": {"early_stopping_patience_counter": 0}}}}
    assert not mirror_trainer_state(run_dir, "not json") and not mirror_trainer_state(run_dir, json.dumps({"x": 1}))
    assert mirror_trainer_state(run_dir, json.dumps(src))
    copy = (run_dir / REMOTE_MIRROR / "trainer_state.json").read_text()
    assert "sentence" not in copy and "never copied" not in copy and '"note"' not in copy
    assert json.loads(copy)["global_step"] == 100 and len(json.loads(copy)["log_history"]) == 22
    write_remote_progress(run_dir, heartbeat={"stage": "train", "step": 120, "max_steps": 500}, changed=now - 40,
                          polled=now - 5, usd=0.3)
    mon = watch(run_dir, port=0, open_browser=False, poll_seconds=0.05, max_polls=6)
    try:
        doc = _wait_hud(mon.url, lambda d: d["fields"]["steps_done"]["value"] == 120)
        f = doc["fields"]
        assert f["sovereignty"]["value"] == "semi-sovereign" and f["run_status"]["value"] == "training"
        assert f["steps_planned"]["value"] == 500 and f["checks_done"]["value"] == 2
        assert f["dev_score_best"]["value"] == 15.0 and f["cost_usd"]["value"] == 0.3
        assert 30 <= f["data_age_s"]["value"] <= 90                     # as old as the heartbeat's last move
        assert doc["where"]["progress"]["stage"] == "train"
        # a second reading: the pace, the time left and what waiting will cost
        write_remote_progress(run_dir, heartbeat={"stage": "train", "step": 140, "max_steps": 500}, changed=now - 0.0,
                              polled=now, usd=0.31)
        doc = _wait_hud(mon.url, lambda d: d["fields"]["sec_per_step"]["value"] is not None)
        f = doc["fields"]
        assert abs(f["sec_per_step"]["value"] - 2.0) < 0.05 and f["eta_s"]["value"] is not None
        assert f["cost_projected_usd"]["value"] > 0.31 and f["cost_projected_usd"]["display"].startswith("→ $")
        assert _health(doc)["cost"][0] == "ok"
    finally:
        mon.shutdown()
    clear_remote_progress(run_dir)
    assert not (run_dir / REMOTE_PROGRESS).exists() and not (run_dir / REMOTE_MIRROR).exists()


def test_runs_view_carries_each_runs_dev_set(tmp_path):
    from nmt_forge.monitor import runs_overview

    ws, run_dir = _workspace(tmp_path)
    _trainer_state(run_dir / "train" / "checkpoint-400", 400)
    r = next(x for x in runs_overview(run_dir, ttl=0)["runs"] if x["name"] == run_dir.name)
    assert r["dev_set"] == "toy-dev" and r["dev_pairs"] == 40 and r["epochs"] == 4 and r["planned"] == 800


def _tokens(css: str, block_start: str) -> dict:
    i = css.index(block_start)
    body = css[i:css.index("}", i)]
    return dict(re.findall(r"--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", body))


def _contrast(a: str, b: str) -> float:
    def lum(h):
        r, g, b_ = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
        f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4   # noqa: E731
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b_)
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def test_text_colours_meet_aa_contrast_on_every_surface_in_both_themes():
    """Text tokens (ink, secondary, muted, faint, accent, the warning and the alert) are at least
    4.5:1 on the page and both card surfaces — light and dark. Decoration (--deco) is exempt."""
    from nmt_forge.monitor import PANEL_DIR

    css = (PANEL_DIR / "panel.css").read_text()
    for start in (":root {", ':root[data-theme="dark"] {'):
        t = _tokens(css, start)
        for fg in ("ink", "ink-2", "muted", "faint", "accent", "warn", "crit"):
            for bg in ("page", "surface", "surface-2"):
                assert _contrast(t[fg], t[bg]) >= 4.5, (start, fg, bg, round(_contrast(t[fg], t[bg]), 2))
    # the automatic dark theme is the same palette as the chosen one
    auto = css[css.index("@media (prefers-color-scheme: dark)"):css.index(':root[data-theme="dark"] {')]
    assert _tokens(auto, ":root:not") == _tokens(css, ':root[data-theme="dark"] {')


def test_the_hud_reads_in_the_order_of_the_three_questions():
    """Is it going well (health) → is it getting better (score) → when does it end (progress) →
    why (charts) → what protects it (guardrails); health states never by colour alone."""
    names = ['class="strip', 'class="health', 'id="c-score"', 'class="panel progress"', 'id="c-loss"',
             'id="checktable"', 'class="vitals"', 'Guardrails']
    pos = [PANEL_HTML.index(n) for n in names]
    assert pos == sorted(pos), names
    for k in ("score", "learning", "overfit", "stability", "memory", "freshness", "cost"):
        assert f'data-lamp="{k}"' in PANEL_HTML and f'data-help="health_{k}"' in PANEL_HTML
    for shape in (".shape.ok", ".shape.watch", ".shape.alert", "clip-path: polygon"):
        assert shape in PANEL_HTML
    assert 'aria-live="polite"' in PANEL_HTML and 'id="forest"' in PANEL_HTML and 'id="multiples"' in PANEL_HTML
