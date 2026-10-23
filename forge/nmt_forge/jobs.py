"""Bounded, detached jobs with a stall watchdog.

The founder's rule (2026-09-06, after a gated decode hung 4 h 51 m unnoticed):
every step in a chain is bounded and watched. Training used to be the one step
an agent could not take — `nmt-forge run` held a terminal for minutes to hours
and nothing noticed if it hung. A job here runs detached (its own session, so
it outlives the agent's tool call), writes its logs and a final ``exit.json``,
and is watched by a small supervisor that stops it when it:

  - shows no sign of life (no heartbeat, no log growth) in its first
    ``startup_s`` seconds,
  - stalls: no progress for ``max(stall_s, 30 × the median seconds per
    step)`` — slow is fine, stuck is not,
  - passes its ``deadline_s``, or
  - is stopped by hand (``nmt-forge jobs stop <name>``).

Stopping escalates gently: the run's STOP_REQUESTED flag first (training halts
at the next step boundary), then SIGTERM after 60 s, then SIGKILL after 10 s
more. Every outcome is written down — ``exit.json`` (atomically) and the
workspace ledger (``job-start`` / ``job-exit``) — never inferred later.

Files: ``<workspace>/jobs/<name>/{job.json, heartbeat.json, stdout.log,
stderr.log, supervisor.log, exit.json, STOP}``. Logs are content-free by
forge's own discipline (forge never prints a withheld sentence); this module
never prints a log line, only where the logs are.

POSIX only (macOS, Linux, WSL): detached sessions and process groups.
"""

from __future__ import annotations

import json
import os
import signal
import statistics
import subprocess
import sys
import time
from pathlib import Path

from .errors import ForgeError
from .monitor import STOP_BASENAME
from .training import heartbeat
from .runlock import _START_SLACK_S, _process_start

POLL_S = 2.0
STOP_GRACE_S = 60.0
TERM_GRACE_S = 10.0


def _seconds(name: str, default: float) -> float:
    """A timing constant, overridable by NMT_FORGE_JOBS_<NAME> (tests run the
    real escalation in seconds, not minutes)."""
    try:
        return float(os.environ.get(f"NMT_FORGE_JOBS_{name}", default))
    except ValueError:
        return default


DEFAULT_STARTUP_S = 15 * 60
DEFAULT_STALL_S = 10 * 60
STALL_STEP_FACTOR = 30
DEFAULT_DEADLINE_S = 24 * 3600
OUTCOMES = ("finished", "refused", "crashed", "stalled", "deadline", "interrupted")


def jobs_root(ws) -> Path:
    return Path(ws.root) / "jobs"


def _write_atomic(path: Path, doc: dict) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def _read(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


# -- one training at a time on this computer -----------------------------------
# A workspace's run lock keeps two runs of ONE project apart; two projects on
# one machine trained at once, each slowing the other and both at risk of
# running out of memory (FORGE_MACHINE_CRITIQUE finding 13). Training jobs
# queue machine-wide, first come first served: a supervisor waits its turn
# before it starts its child, and says whom it waits behind.
MAX_QUEUE_S = 24 * 3600


def machine_dir() -> Path:
    """This computer's forge state shared by every project (the train queue)."""
    return Path(os.environ.get("NMT_FORGE_MACHINE_DIR") or (Path.home() / ".nmt-forge" / "machine"))


def _queue() -> list[tuple[Path, dict]]:
    """The live entries of the machine's train queue, oldest first; entries
    whose supervisor is gone (or whose pid now belongs to another process)
    are removed as they are found."""
    out = []
    for f in sorted((machine_dir() / "train-queue").glob("*.json")):
        rec = _read(f) or {}
        pid = rec.get("pid")
        now = _process_start(pid) if pid else None
        gone = not _alive(pid) or (rec.get("started") is not None and now is not None
                                    and abs(now - float(rec["started"])) > _START_SLACK_S)
        if gone:
            f.unlink(missing_ok=True)
            continue
        out.append((f, rec))
    return out


def _reused(d: Path, pid: int | None) -> bool:
    """Does ``pid`` now belong to another process than the job's supervisor
    (a reboot, then a reused number)? False when it cannot be told."""
    rec = _read(d / "supervisor.json") or {}
    if not pid or rec.get("pid") != pid or rec.get("started") is None:
        return False
    now = _process_start(pid)
    return now is not None and abs(now - float(rec["started"])) > _START_SLACK_S


def start_job(ws, kind: str, argv: list[str], *, name: str | None = None,
              cwd: str | None = None, deadline_s: float | None = None,
              stall_s: float | None = None, startup_s: float | None = None,
              health_url: str | None = None,
              env_extra: dict | None = None) -> dict:
    """Start ``argv`` as a detached, supervised job; returns its status.

    ``None`` takes a bound's default; ``0`` means the bound does not apply
    (a server is idle by design: no stall rule, no deadline). With
    ``health_url`` the job counts as started only once that URL answers 200
    (a server that never answers is stopped after ``startup_s``).
    Refuses on Windows (no POSIX sessions) and when a job of this name
    exists. The supervisor is ``python -m nmt_forge.jobs supervise <dir>``.
    """
    if os.name == "nt":
        raise ForgeError(
            "detached jobs need a POSIX system (macOS, Linux, or WSL on Windows)\n"
            "  fix: run the command in a terminal instead (without --detach)")
    name = name or f"{kind}-{time.strftime('%Y%m%d-%H%M%S')}"
    d = jobs_root(ws) / name
    if d.exists():
        raise ForgeError(f"a job named {name!r} already exists ({d})\n"
                         "  fix: `nmt-forge jobs` lists jobs; pick another --job-name")
    d.mkdir(parents=True)
    spec = {
        "name": name, "kind": kind, "argv": list(argv),
        "cwd": str(Path(cwd or os.getcwd()).resolve()),
        "workspace": str(Path(ws.root).resolve()),
        "deadline_s": float(DEFAULT_DEADLINE_S if deadline_s is None else deadline_s),
        "stall_s": float(DEFAULT_STALL_S if stall_s is None else stall_s),
        "startup_s": float(DEFAULT_STARTUP_S if startup_s is None else startup_s),
        "health_url": health_url,
        "env": dict(env_extra or {}),
        "created": time.time(),
    }
    _write_atomic(d / "job.json", spec)
    log = open(d / "supervisor.log", "ab")
    sup = subprocess.Popen(
        [sys.executable, "-m", "nmt_forge.jobs", "supervise", str(d)],
        cwd=spec["cwd"], stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
        start_new_session=True, close_fds=True, env=dict(os.environ))
    log.close()
    (d / "supervisor.pid").write_text(str(sup.pid))
    # the supervisor's own start time: after a reboot its pid may belong to
    # another process, and a bare pid probe would call the job running
    # forever, blocking the rails (FORGE_MACHINE_CRITIQUE finding 11)
    _write_atomic(d / "supervisor.json", {"pid": sup.pid, "started": _process_start(sup.pid)})
    ws.ledger.append("job-start", job=name, kind=kind,
                     deadline_s=spec["deadline_s"], stall_s=spec["stall_s"],
                     startup_s=spec["startup_s"])
    return job_status(d)


def stop_job(ws, name: str) -> dict:
    """Ask a running job to stop (the supervisor escalates); returns status."""
    d = jobs_root(ws) / name
    if not (d / "job.json").exists():
        raise ForgeError(f"no job named {name!r}\n  fix: `nmt-forge jobs` lists them")
    st = job_status(d)
    if st["state"] != "running":
        return st
    (d / "STOP").write_text("stop\n")
    return job_status(d)


def _progress(d: Path, spec: dict) -> dict | None:
    hb = heartbeat.read(d / "heartbeat.json")
    if not hb:
        return None
    out = {"stage": hb.get("stage"), "step": hb.get("step"),
           "max_steps": hb.get("max_steps"),
           "beat_age_s": round(time.time() - float(hb.get("t", 0)), 1)}
    steps = _read(d / "steps.json") or {}
    per = steps.get("median_step_s")
    if per and hb.get("step") is not None and hb.get("max_steps"):
        out["eta_s"] = round(per * max(0, int(hb["max_steps"]) - int(hb["step"])))
    return out


def job_status(d: Path) -> dict:
    """A job's state, read from its files (never from memory)."""
    d = Path(d)
    spec = _read(d / "job.json") or {}
    ex = _read(d / "exit.json")
    sup_pid = None
    try:
        sup_pid = int((d / "supervisor.pid").read_text().strip())
    except (OSError, ValueError):
        pass
    if ex:
        state = ex.get("outcome", "crashed")
    elif _alive(sup_pid) and not _reused(d, sup_pid):
        state = "running"
    else:
        state = "lost"      # the supervisor died without writing exit.json
    # waiting its turn in the machine's train queue: alive, not yet started
    queued = _read(d / "queued.json") if state == "running" and not (d / "child.pid").exists() else None
    return {
        "name": spec.get("name", d.name), "kind": spec.get("kind"),
        "state": state, "created": spec.get("created"),
        "ended": (ex or {}).get("ended"), "reason": (ex or {}).get("reason"),
        "exit_code": (ex or {}).get("exit_code"),
        "progress": _progress(d, spec) if state == "running" else None,
        "health_url": spec.get("health_url"),
        "queued_behind": queued,
        "healthy": (d / "healthy.json").exists() if spec.get("health_url") else None,
        "bounds": {k: spec.get(k) for k in ("startup_s", "stall_s", "deadline_s")},
        "logs": {k: str(d / f"{k}.log") for k in ("stdout", "stderr")},
        "dir": str(d),
    }


def list_jobs(ws) -> list[dict]:
    root = jobs_root(ws)
    if not root.is_dir():
        return []
    out = [job_status(d) for d in root.iterdir() if (d / "job.json").exists()]
    return sorted(out, key=lambda j: j.get("created") or 0)


# -- the supervisor (runs detached) -------------------------------------------

def _wait_turn(d: Path, spec: dict) -> tuple[str, str] | None:
    """A training job waits its turn in the machine's queue: None when it may
    start; (outcome, reason) when it ended while waiting."""
    q = machine_dir() / "train-queue"
    q.mkdir(parents=True, exist_ok=True)
    me = q / f"{time.time():.6f}-{os.getpid()}.json"
    _write_atomic(me, {"pid": os.getpid(), "started": _process_start(os.getpid()), "job": spec["name"],
                       "workspace": spec.get("workspace"), "dir": str(d)})
    spec["_queue_entry"] = str(me)
    since = time.time()
    while True:
        live = _queue()
        head = live[0] if live else None
        if head is None or head[0] == me:
            (d / "queued.json").unlink(missing_ok=True)
            return None
        _write_atomic(d / "queued.json", {"job": head[1].get("job"), "workspace": head[1].get("workspace"),
                                          "since": since})
        if (d / "STOP").exists():
            return "interrupted", "stopped by hand while it waited its turn (nmt-forge jobs stop)"
        if time.time() - since > MAX_QUEUE_S:
            return "deadline", (f"waited {MAX_QUEUE_S / 3600:g} h for another training on this computer "
                                f"({head[1].get('job')}) to finish")
        time.sleep(_seconds("POLL_S", POLL_S))


def supervise(d: str | Path) -> int:
    d = Path(d)
    spec = json.loads((d / "job.json").read_text(encoding="utf-8"))
    try:
        return _supervise(d, spec)
    finally:
        if spec.get("_queue_entry"):
            Path(spec["_queue_entry"]).unlink(missing_ok=True)


def _supervise(d: Path, spec: dict) -> int:
    if spec.get("kind") == "train":
        ended = _wait_turn(d, spec)
        if ended:
            _write_atomic(d / "exit.json", {"outcome": ended[0], "reason": ended[1], "exit_code": None,
                                            "ended": time.time(), "duration_s": 0, "last_heartbeat": None})
            return 0
    hb_path = d / "heartbeat.json"
    env = dict(os.environ, **spec.get("env", {}))
    env[heartbeat.ENV] = str(hb_path)
    out = open(d / "stdout.log", "ab")
    err = open(d / "stderr.log", "ab")
    child = subprocess.Popen(spec["argv"], cwd=spec["cwd"], env=env,
                             stdin=subprocess.DEVNULL, stdout=out, stderr=err,
                             start_new_session=True)
    (d / "child.pid").write_text(str(child.pid))
    start = time.time()
    started = False
    last_progress = start
    last_beat_t = 0.0
    last_log_size = 0
    samples: list[tuple[int, float]] = []
    outcome = reason = None

    def logs_size() -> int:
        return sum((d / f).stat().st_size for f in ("stdout.log", "stderr.log")
                   if (d / f).exists())

    while True:
        rc = child.poll()
        if rc is not None:
            break
        now = time.time()
        hb = heartbeat.read(hb_path)
        if hb and float(hb.get("t", 0)) > last_beat_t:
            last_beat_t = float(hb["t"])
            last_progress = now
            started = True
            if isinstance(hb.get("step"), int):
                samples.append((hb["step"], last_beat_t))
                samples = samples[-50:]
                per = [(t2 - t1) / (s2 - s1) for (s1, t1), (s2, t2)
                       in zip(samples, samples[1:]) if s2 > s1]
                if per:
                    _write_atomic(d / "steps.json",
                                  {"median_step_s": statistics.median(per)})
        size = logs_size()
        if size != last_log_size:
            last_log_size = size
            last_progress = now
            if not spec.get("health_url"):
                started = True
        if spec.get("health_url") and not started and _healthy(spec["health_url"], pid=child.pid):
            started = True
            _write_atomic(d / "healthy.json", {"t": now, "url": spec["health_url"]})
        if (d / "STOP").exists():
            outcome, reason = "interrupted", "stopped by hand (nmt-forge jobs stop)"
        elif not (d / "job.json").exists():
            # the job's folder went away (its workspace deleted): nobody can
            # stop it by name any more, so it stops itself rather than leave
            # a server holding its port with no record (2026-10-18 walk)
            outcome, reason = "interrupted", "its job folder was removed"
        elif spec["deadline_s"] and now - start > spec["deadline_s"]:
            outcome, reason = "deadline", f"past its deadline of {spec['deadline_s'] / 3600:g} h"
        elif not started and now - start > spec["startup_s"]:
            outcome, reason = "stalled", (
                f"no answer at {spec['health_url']} within {spec['startup_s']:g} s"
                if spec.get("health_url") else
                f"no sign of life in its first {spec['startup_s'] / 60:g} min")
        else:
            steps = _read(d / "steps.json") or {}
            allowed = max(spec["stall_s"],
                          STALL_STEP_FACTOR * float(steps.get("median_step_s") or 0))
            if spec["stall_s"] and started and now - last_progress > allowed:
                outcome, reason = "stalled", (f"no progress for {allowed / 60:.0f} min "
                                              "(no heartbeat, no log output)")
        if outcome:
            rc = _escalate(child, heartbeat.read(hb_path))
            break
        time.sleep(_seconds("POLL_S", POLL_S))

    out.close()
    err.close()
    if outcome is None:
        outcome = "finished" if rc == 0 else "refused" if rc == 2 else "crashed"
        reason = {"finished": None, "refused": "the command refused (see stderr.log)",
                  "crashed": f"exited with code {rc} (see stderr.log)"}[outcome]
    ended = time.time()
    if not d.exists():          # the folder went away: the child is stopped; nothing left to record in
        return 0
    _write_atomic(d / "exit.json", {
        "outcome": outcome, "reason": reason, "exit_code": rc,
        "ended": ended, "duration_s": round(ended - start, 1),
        "last_heartbeat": heartbeat.read(hb_path),
    })
    try:
        from .ledger import Ledger

        Ledger(Path(spec["workspace"]) / "ledger.jsonl").append(
            "job-exit", job=spec["name"], kind=spec["kind"], outcome=outcome,
            reason=reason, exit_code=rc, duration_s=round(ended - start, 1))
    except Exception as exc:   # exit.json already says it; say this too
        print(f"[jobs] could not append job-exit to the ledger: {exc}", flush=True)
    return 0


def _healthy(url: str, pid: int | None = None) -> bool:
    """True when ``url`` answers 200 within 2 s — and, given ``pid``, when an
    answer that names its process (forge's /health says its pid) names THAT
    one: another forge server already on the port must not count as this
    job's (2026-10-12). An answer that names no process is taken as it is;
    `serve --detach` refuses a port that already answers before it starts."""
    import urllib.request

    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            if r.status != 200:
                return False
            if pid is None:
                return True
            try:
                doc = json.loads(r.read().decode("utf-8", "replace"))
            except Exception:
                return True
            said = doc.get("pid") if isinstance(doc, dict) else None
            return said is None or said == pid
    except Exception:
        return False


def _escalate(child: subprocess.Popen, hb: dict | None) -> int | None:
    """STOP flag → wait → SIGTERM → wait → SIGKILL. Returns the exit code."""
    run_dir = (hb or {}).get("run_dir")
    if run_dir:
        try:
            (Path(run_dir) / STOP_BASENAME).write_text("stop\n")
        except OSError:
            pass
        if _wait(child, _seconds("STOP_GRACE_S", STOP_GRACE_S)) is not None:
            return child.returncode
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        return child.poll()
    if _wait(child, _seconds("TERM_GRACE_S", TERM_GRACE_S)) is not None:
        return child.returncode
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    return child.wait()


def _wait(child: subprocess.Popen, seconds: float):
    end = time.time() + seconds
    while time.time() < end:
        if child.poll() is not None:
            return child.returncode
        time.sleep(0.5)
    return None


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if len(argv) == 2 and argv[0] == "supervise":
        return supervise(argv[1])
    print("usage: python -m nmt_forge.jobs supervise <job dir>", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
