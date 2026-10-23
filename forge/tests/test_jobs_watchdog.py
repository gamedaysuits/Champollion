"""Bounded detached jobs: every outcome is reached, written down, never inferred.

Real processes, real supervisor (python -m nmt_forge.jobs), real escalation —
with the timing constants shrunk through NMT_FORGE_JOBS_* so the suite runs in
seconds. Founder rule 2026-09-06: every step bounded, with a stall watchdog.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import pytest

from nmt_forge import jobs
from nmt_forge.workspace import Workspace

pytestmark = pytest.mark.skipif(os.name == "nt", reason="POSIX jobs")

FAST = {"NMT_FORGE_JOBS_POLL_S": "0.2", "NMT_FORGE_JOBS_STOP_GRACE_S": "1",
        "NMT_FORGE_JOBS_TERM_GRACE_S": "1"}


@pytest.fixture
def ws(tmp_path, monkeypatch):
    for k, v in FAST.items():
        monkeypatch.setenv(k, v)
    # the supervisor is `python -m nmt_forge.jobs`: it must import this forge
    here = str(Path(jobs.__file__).resolve().parents[1])
    monkeypatch.setenv("PYTHONPATH", os.pathsep.join(
        [here] + ([os.environ["PYTHONPATH"]] if os.environ.get("PYTHONPATH") else [])))
    return Workspace(tmp_path / ".forge")


def py(code: str) -> list[str]:
    return [sys.executable, "-c", code]


BEAT = ("import json,os,time,pathlib;"
        "p=pathlib.Path(os.environ['NMT_FORGE_HEARTBEAT']);"
        "beat=lambda s,**k: p.write_text(json.dumps({'stage':'train','step':s,'max_steps':100,'t':time.time(),**k}));")


def wait_exit(ws, name, timeout=30.0) -> dict:
    d = jobs.jobs_root(ws) / name
    end = time.time() + timeout
    while time.time() < end:
        if (d / "exit.json").exists():
            return json.loads((d / "exit.json").read_text())
        time.sleep(0.1)
    raise AssertionError(f"job {name} did not finish in {timeout}s: {jobs.job_status(d)}")


def test_a_job_that_finishes_is_written_down(ws):
    jobs.start_job(ws, "train", py("print('done')"), name="ok")
    ex = wait_exit(ws, "ok")
    assert ex["outcome"] == "finished" and ex["exit_code"] == 0
    events = [e["event"] for e in ws.ledger.entries()]
    assert events.count("job-start") == 1 and events.count("job-exit") == 1
    assert ws.ledger.verify_chain() == 2
    assert jobs.job_status(jobs.jobs_root(ws) / "ok")["state"] == "finished"


def test_a_refusal_is_not_a_crash(ws):
    jobs.start_job(ws, "train", py("import sys; sys.exit(2)"), name="r")
    assert wait_exit(ws, "r")["outcome"] == "refused"
    jobs.start_job(ws, "train", py("import sys; sys.exit(3)"), name="c")
    assert wait_exit(ws, "c")["outcome"] == "crashed"


def test_no_sign_of_life_at_startup_is_stalled(ws):
    jobs.start_job(ws, "train", py("import time; time.sleep(60)"), name="mute", startup_s=1)
    ex = wait_exit(ws, "mute")
    assert ex["outcome"] == "stalled" and "no sign of life" in ex["reason"]


def test_progress_that_stops_is_stalled(ws):
    jobs.start_job(ws, "train", py(BEAT + "beat(1); time.sleep(60)"), name="stuck",
                   startup_s=5, stall_s=1)
    ex = wait_exit(ws, "stuck")
    assert ex["outcome"] == "stalled" and "no progress" in ex["reason"]
    assert ex["last_heartbeat"]["step"] == 1


def test_a_job_past_its_deadline_is_stopped_even_while_alive(ws):
    jobs.start_job(ws, "train", py(BEAT + "i=0\nwhile True:\n i+=1; beat(i); time.sleep(0.1)"),
                   name="long", deadline_s=1, stall_s=30)
    assert wait_exit(ws, "long")["outcome"] == "deadline"


def test_the_gentle_stop_comes_first(ws, tmp_path):
    """The STOP flag in the run's folder is tried before any signal: a run that
    honors it exits on its own (here with forge's refusal code)."""
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    code = (BEAT + f"rd=r'{run_dir}'\nbeat(1, run_dir=rd)\n"
            "while not pathlib.Path(rd,'STOP_REQUESTED').exists(): time.sleep(0.05)\n"
            "raise SystemExit(2)")
    jobs.start_job(ws, "train", py(code), name="gentle", startup_s=5, stall_s=1)
    ex = wait_exit(ws, "gentle")
    assert ex["outcome"] == "stalled" and ex["exit_code"] == 2


def test_stop_by_hand(ws):
    jobs.start_job(ws, "train", py(BEAT + "i=0\nwhile True:\n i+=1; beat(i); time.sleep(0.1)"),
                   name="hand", stall_s=30)
    time.sleep(0.5)
    assert jobs.stop_job(ws, "hand")["state"] == "running"
    ex = wait_exit(ws, "hand")
    assert ex["outcome"] == "interrupted"


def test_a_job_whose_folder_is_removed_stops_its_process(ws, tmp_path):
    # a walk deleted its project right after `jobs stop` (which only asks):
    # the supervisor never saw STOP, and the server held its port with no
    # record left to stop it by (2026-10-18). Now it stops itself.
    pidfile = tmp_path / "child.pid"
    jobs.start_job(ws, "serve", py(BEAT + f"import os; open({str(pidfile)!r},'w').write(str(os.getpid()))\n"
                                   "i=0\nwhile True:\n i+=1; beat(i); time.sleep(0.1)"),
                   name="orphan", stall_s=30)
    end = time.time() + 10
    while not pidfile.exists() and time.time() < end:
        time.sleep(0.1)
    pid = int(pidfile.read_text())
    import shutil
    shutil.rmtree(jobs.jobs_root(ws) / "orphan")
    end = time.time() + 15
    while time.time() < end:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            break
        time.sleep(0.2)
    else:
        os.kill(pid, 9)
        raise AssertionError("the job's process outlived its removed folder")


def test_two_projects_train_one_at_a_time(ws, tmp_path):
    """FORGE_MACHINE_CRITIQUE finding 13: another project's training on this
    computer waits its turn — said in its status — and starts when the first
    ends; first come, first served."""
    other = Workspace(tmp_path / "other" / ".forge")
    first = jobs.start_job(ws, "train", py(BEAT + "beat(1); time.sleep(2.5); beat(2)"), name="first",
                           stall_s=30)
    time.sleep(0.8)                                     # the first takes its turn
    jobs.start_job(other, "train", py(BEAT + "beat(1)"), name="second", stall_s=30)
    time.sleep(1.0)
    st = jobs.job_status(jobs.jobs_root(other) / "second")
    assert st["state"] == "running" and st["queued_behind"]["job"] == "first"
    assert not (jobs.jobs_root(other) / "second" / "child.pid").exists(), "not started while it waits"
    assert wait_exit(ws, "first")["outcome"] == "finished"
    assert wait_exit(other, "second")["outcome"] == "finished"
    assert not list((jobs.machine_dir() / "train-queue").glob("*.json")), "the queue empties"
    assert first["state"] == "running"


def test_status_says_whom_a_queued_training_waits_behind(ws, tmp_path):
    from nmt_forge.advisor import next_action

    other = Workspace(tmp_path / "other" / ".forge")
    jobs.start_job(other, "train", py(BEAT + "beat(1); time.sleep(3)"), name="theirs", stall_s=30)
    time.sleep(0.8)
    jobs.start_job(ws, "train", py(BEAT + "beat(1)"), name="ours", stall_s=30)
    time.sleep(0.8)
    a = next_action(ws)
    assert a.state == "training" and "queued behind another training on this computer (theirs)" in a.why
    wait_exit(other, "theirs")
    wait_exit(ws, "ours")


def test_a_job_stopped_while_it_waits_never_starts(ws, tmp_path):
    other = Workspace(tmp_path / "other" / ".forge")
    jobs.start_job(ws, "train", py(BEAT + "beat(1); time.sleep(3)"), name="busy", stall_s=30)
    time.sleep(0.8)
    jobs.start_job(other, "train", py(BEAT + "beat(1)"), name="waiting", stall_s=30)
    time.sleep(0.8)
    jobs.stop_job(other, "waiting")
    ex = wait_exit(other, "waiting")
    assert ex["outcome"] == "interrupted" and "while it waited its turn" in ex["reason"]
    assert not (jobs.jobs_root(other) / "waiting" / "child.pid").exists()
    wait_exit(ws, "busy")


def test_a_pid_reused_after_a_reboot_is_not_the_job(ws, tmp_path):
    """FORGE_MACHINE_CRITIQUE finding 11: after a power cut the supervisor's
    number may belong to another process; a bare pid probe called the job
    running forever. Its recorded start time tells them apart."""
    from nmt_forge.runlock import _process_start

    d = tmp_path / "job"
    d.mkdir()
    (d / "job.json").write_text(json.dumps({"name": "old", "kind": "train", "created": 1000.0}))
    (d / "supervisor.pid").write_text(str(os.getpid()))             # alive — but which process?
    (d / "supervisor.json").write_text(json.dumps({"pid": os.getpid(), "started": 1000.0}))
    assert jobs.job_status(d)["state"] == "lost"
    (d / "supervisor.json").write_text(json.dumps({"pid": os.getpid(), "started": _process_start(os.getpid())}))
    assert jobs.job_status(d)["state"] == "running"
    (d / "supervisor.json").unlink()                                 # a job from before: as before
    assert jobs.job_status(d)["state"] == "running"


def test_running_status_reports_progress_without_log_content(ws):
    jobs.start_job(ws, "train", py(BEAT + "print('SECRET LOG LINE', flush=True)\n"
                                   "i=0\nwhile True:\n i+=1; beat(i); time.sleep(0.05)"),
                   name="live", stall_s=30)
    time.sleep(1.5)
    st = jobs.job_status(jobs.jobs_root(ws) / "live")
    assert st["state"] == "running"
    assert st["progress"]["stage"] == "train" and st["progress"]["step"] >= 1
    assert "SECRET" not in json.dumps(st)
    jobs.stop_job(ws, "live")
    wait_exit(ws, "live")


def test_run_detach_trains_in_the_background_and_beats(tmp_path, monkeypatch, dev_set, ws):
    """`nmt-forge run config.json --detach` returns at once; the job runs the
    real training (dummy backend), heartbeats through its stages, and ends
    'finished' with the run's manifest on disk."""
    from nmt_forge.cli import main
    from tests.test_training_run import _setup

    cfg = _setup(ws, tmp_path)
    monkeypatch.chdir(tmp_path)
    code = main(["--workspace", str(ws.root), "run", str(cfg), "--detach",
                 "--job-name", "bg", "--json"])
    assert code == 0
    ex = wait_exit(ws, "bg", timeout=60)
    assert ex["outcome"] == "finished", (jobs.jobs_root(ws) / "bg" / "stderr.log").read_text()
    assert ex["last_heartbeat"]["stage"] == "report"
    assert list(ws.runs_dir.glob("e2e-*/run-manifest.json"))
    assert main(["--workspace", str(ws.root), "jobs", "--json"]) == 0


def test_a_starting_training_job_is_training_before_it_takes_the_lock(ws, tmp_path, monkeypatch, capsys):
    """A real model's run imports torch for seconds before it takes the run
    lock. The rails walk (a real cpu-tiny model) asked status in that window,
    was told 'ready to train', confirmed, and `run --detach` refused: 'a
    training run is already in progress'. The job is the run from its start."""
    from nmt_forge.advisor import next_action
    from nmt_forge.cli import main
    from tests.test_training_run import _setup

    cfg = _setup(ws, tmp_path)
    jobs.start_job(ws, "train", py("import time; time.sleep(30)"), name="early", startup_s=60)
    try:
        advice = next_action(ws)
        assert advice.state == "training", advice
        assert "early" in advice.why and "Do NOT start another run" in advice.why
        monkeypatch.chdir(tmp_path)
        code = main(["--workspace", str(ws.root), "run", str(cfg), "--detach", "--job-name", "second"])
        assert code != 0
        assert "already in progress: background job 'early' (starting)" in capsys.readouterr().err
        assert not (jobs.jobs_root(ws) / "second").exists(), "no second job was started"
    finally:
        jobs.stop_job(ws, "early")
        wait_exit(ws, "early")


def test_a_stalled_training_job_is_said_in_every_status(ws):
    from nmt_forge.advisor import next_action

    jobs.start_job(ws, "train", py("import time; time.sleep(60)"), name="night", startup_s=1)
    wait_exit(ws, "night")
    advice = next_action(ws)
    assert any("the last training job (night) ended stalled" in w for w in advice.warnings)


def test_a_refused_training_run_comes_before_ready_to_train(ws, monkeypatch):
    """Journey simulator, 2026-10-11: `run --detach` launched, the run refused
    in its first seconds (exit 2), and status said "ready to train" again —
    three refused runs in a row. The refusal, in its own words, leads now."""
    from nmt_forge import advisor

    jobs.start_job(ws, "train", py("import sys; print('refused: the training extra is missing', file=sys.stderr); "
                                   "sys.exit(2)"), name="first", startup_s=60)
    assert wait_exit(ws, "first")["outcome"] == "refused"
    monkeypatch.setattr(advisor, "_ladder", lambda ws_, s: advisor.Advice(
        state="ready-to-train", command="nmt-forge run config.json --detach", why="evals are registered"))
    a = advisor.next_action(ws)
    assert a.state == "ready-to-train"
    assert a.why.startswith("the last training run (job first) ended refused: refused: the training extra is missing"
                            " — fix that first"), a.why
    assert a.why.endswith("Once it is fixed: evals are registered")
    assert any("ended refused" in b for b in a.blockers)
    assert any("it said: refused: the training extra is missing" in w for w in a.warnings)


def _free_port() -> int:
    import socket

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_a_server_job_starts_when_health_answers_and_never_stalls(ws, tmp_path):
    """A server is idle by design: no stall rule, no deadline — it counts as
    started once its health URL answers, and runs until stopped."""
    port = _free_port()
    (tmp_path / "health").write_text("ok")
    jobs.start_job(ws, "serve", [sys.executable, "-m", "http.server", str(port),
                                 "--bind", "127.0.0.1", "--directory", str(tmp_path)],
                   name="srv", stall_s=0, deadline_s=0, startup_s=30,
                   health_url=f"http://127.0.0.1:{port}/health")
    d = jobs.jobs_root(ws) / "srv"
    end = time.time() + 20
    while time.time() < end and not jobs.job_status(d)["healthy"]:
        time.sleep(0.2)
    st = jobs.job_status(d)
    assert st["state"] == "running" and st["healthy"] is True
    time.sleep(1.5)                       # idle is fine: still running
    assert jobs.job_status(d)["state"] == "running"
    jobs.stop_job(ws, "srv")
    assert wait_exit(ws, "srv")["outcome"] == "interrupted"


def test_jobs_stop_wait_returns_only_once_the_server_has_exited(ws, tmp_path):
    """`jobs stop --wait` (the improve loop's promotion runs it before serving
    the better model on the same port): back only when the job has exited."""
    import argparse

    from nmt_forge.cli import cmd_jobs

    port = _free_port()
    (tmp_path / "health").write_text("ok")
    jobs.start_job(ws, "serve", [sys.executable, "-m", "http.server", str(port),
                                 "--bind", "127.0.0.1", "--directory", str(tmp_path)],
                   name="old", stall_s=0, deadline_s=0, startup_s=30,
                   health_url=f"http://127.0.0.1:{port}/health")
    d = jobs.jobs_root(ws) / "old"
    end = time.time() + 20
    while time.time() < end and not jobs.job_status(d)["healthy"]:
        time.sleep(0.2)
    out = cmd_jobs(argparse.Namespace(action="stop", name="old", wait=30, workspace=str(ws.root)))
    assert out.payload["state"] != "running", out.payload
    assert jobs.job_status(d)["state"] != "running"


def test_a_server_that_never_answers_is_stopped(ws):
    port = _free_port()
    jobs.start_job(ws, "serve", py("import time; print('starting', flush=True); time.sleep(60)"),
                   name="deaf", stall_s=0, deadline_s=0, startup_s=1,
                   health_url=f"http://127.0.0.1:{port}/health")
    ex = wait_exit(ws, "deaf")
    assert ex["outcome"] == "stalled" and "no answer at" in ex["reason"]


def test_a_name_is_never_reused(ws):
    jobs.start_job(ws, "train", py("pass"), name="once")
    wait_exit(ws, "once")
    with pytest.raises(Exception, match="already exists"):
        jobs.start_job(ws, "train", py("pass"), name="once")
