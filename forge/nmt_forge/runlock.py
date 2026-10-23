"""One training run per workspace at a time — the run lock.

A run in progress left nothing reliable behind for ``status`` to read: its
run directory has no manifest until the very end, exactly like a run that
crashed. So ``nmt-forge status`` reported ``ready-to-train`` in the middle of
a run and handed an agent the command that starts a SECOND training (a
synthetic hospital user, 2026-10; the e13 dogfood note's row 32 is the same
failure from a chain script: two trainings writing one directory).

``nmt-forge run`` now writes ``<workspace>/run.lock`` before it touches
anything — the owner's pid, host, process start time, run name and run
directory — and removes it when it exits, however it exits. While the lock
is held:

- ``nmt-forge run`` refuses to start (what/why/fix, naming the holder);
- ``nmt-forge status`` reports ``training`` — wait — and never a command
  that starts a run;
- ``nmt-forge preflight run`` fails its ``no-run-in-progress`` gate.

A lock whose process is gone (killed with SIGKILL, power cut, a crash the
``finally`` never saw) is STALE: status says so, and the next ``run`` clears
it and proceeds. A pid that was reused by an unrelated process is detected
by its start time: a process that started AFTER the lock was written cannot
be the one that wrote it. A lock written on ANOTHER host cannot be checked
from here, so it is treated as held — the refusal says which host, and how
to clear it by hand when that run is known to be over.

Never a process-name grep (dogfood rows 14 and 31: name matches caught the
watcher shells and missed the renamed job).
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

from .errors import ForgeError
from .workspace import Workspace

LOCK_NAME = "run.lock"
# `ps` reports start times to the second; the lock is written after the
# process starts, so allow for rounding before calling a pid "reused"
_START_SLACK_S = 2.0


def lock_path(ws: Workspace) -> Path:
    return ws.root / LOCK_NAME


def _process_start(pid: int) -> float | None:
    """Epoch start time of ``pid`` via ``ps -o lstart=`` (macOS and Linux),
    or None when it can't be read."""
    try:
        out = subprocess.run(
            ["ps", "-o", "lstart=", "-p", str(pid)], capture_output=True,
            text=True, timeout=5, env={**os.environ, "LC_ALL": "C"})
    except (OSError, subprocess.SubprocessError):
        return None
    text = " ".join(out.stdout.split())
    if out.returncode != 0 or not text:
        return None
    try:
        return time.mktime(time.strptime(text, "%a %b %d %H:%M:%S %Y"))
    except ValueError:
        return None


def _pid_state(pid: int, created: float | None) -> str:
    """'alive' | 'dead' | 'reused' | 'unknown' for a lock's pid on THIS
    host."""
    if os.name == "nt":       # os.kill(pid, 0) is not a probe on Windows
        return "unknown"
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return "dead"
    except PermissionError:
        pass                  # exists, owned by someone else
    except OSError:
        return "unknown"
    started = _process_start(pid)
    if started is not None and created is not None \
            and started > created + _START_SLACK_S:
        return "reused"
    return "alive"


def read_lock(ws: Workspace) -> dict | None:
    """The lock record plus a ``state`` verdict, or None when no lock file.

    ``state``: ``held`` (a live run owns it), ``stale`` (its process is
    gone or its pid now belongs to another process), ``unverifiable``
    (written on another host, or this OS can't probe the pid — treated as
    held), ``corrupt`` (unreadable — treated as stale: it names no owner).
    """
    path = lock_path(ws)
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    except OSError as e:
        return {"state": "corrupt", "path": str(path), "error": str(e),
                "_raw": None}
    return _judge(raw, path)


def _judge(raw: str, path: Path) -> dict:
    try:
        rec = json.loads(raw)
        pid = int(rec["pid"])
    except (ValueError, KeyError, TypeError):
        return {"state": "corrupt", "path": str(path), "_raw": raw,
                "why": "the lock file is unreadable"}
    rec["path"] = str(path)
    rec["_raw"] = raw
    if rec.get("host") and rec["host"] != socket.gethostname():
        rec["state"] = "unverifiable"
        rec["why"] = f"written on host {rec['host']!r}, not this one"
        return rec
    pid_state = _pid_state(pid, rec.get("created"))
    rec["state"] = {"alive": "held", "dead": "stale", "reused": "stale",
                    "unknown": "unverifiable"}[pid_state]
    if pid_state == "dead":
        rec["why"] = f"process {pid} is gone"
    elif pid_state == "reused":
        rec["why"] = (f"pid {pid} now belongs to a process that started after "
                      "the lock was written")
    elif pid_state == "unknown":
        rec["why"] = "this system cannot check whether the process is alive"
    return rec


def public(rec: dict | None) -> dict | None:
    """A lock record without its internals (for status/--json)."""
    if rec is None:
        return None
    return {k: v for k, v in rec.items() if k not in ("_raw", "token")}


def active_run(ws: Workspace) -> dict | None:
    """The lock record when a run is (or may be) in progress — ``held`` or
    ``unverifiable`` — else None."""
    rec = read_lock(ws)
    if rec and rec["state"] in ("held", "unverifiable"):
        return rec
    return None


def describe(rec: dict) -> str:
    started = rec.get("created")
    when = (time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(started))
            if isinstance(started, (int, float)) else "unknown time")
    return (f"run {rec.get('run_name', '?')!r} (pid {rec.get('pid', '?')}"
            + (f" on {rec['host']}" if rec.get("host") else "")
            + f", started {when})")


def _refusal(rec: dict) -> ForgeError:
    held = rec["state"] == "held"
    text = (f"another training run is in progress in this workspace: "
            f"{describe(rec)}\n"
            "  why: two runs at once fight for the same CPU/GPU and memory, "
            "and two runs of one config write the SAME run directory — "
            "neither result could be trusted\n"
            "  fix: wait for it to finish (`nmt-forge status` says when"
            + (f"; its checkpoints are under {rec['run_dir']}"
               if rec.get("run_dir") else "") + ")")
    if not held:
        text += (f". Forge cannot verify that run from here "
                 f"({rec.get('why', 'unverifiable')}): if you KNOW it has "
                 f"ended, delete {rec['path']} and start again")
    return ForgeError(text)


def _create(path: Path, record: dict) -> None:
    """Create the lock with its full content in one atomic step, or raise
    FileExistsError. Written to a private temp file and hard-linked into
    place, so no reader ever sees a half-written (empty) lock and mistakes
    it for a corrupt, clearable one. Filesystems without hard links fall
    back to an exclusive create."""
    tmp = path.with_name(f".{path.name}.{record['token']}")
    tmp.write_text(json.dumps(record), encoding="utf-8")
    try:
        os.link(tmp, path)
    except FileExistsError:
        raise
    except OSError:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(record, fh)
    finally:
        try:
            tmp.unlink()
        except OSError:
            pass


@contextmanager
def run_lock(ws: Workspace, *, run_name: str, run_dir: str | Path,
             config_hash: str, config_path: str | Path):
    """Hold the workspace's run lock for the duration of a run.

    Atomic create (see :func:`_create`): of two runs started at the same
    instant, exactly one gets the lock. A stale lock is removed — only if it
    is still the same stale record — and the create retried. Released in
    ``finally`` only while the file is still ours."""
    path = lock_path(ws)
    token = uuid.uuid4().hex
    record = {
        "pid": os.getpid(), "host": socket.gethostname(),
        "created": time.time(), "token": token, "run_name": run_name,
        "run_dir": str(run_dir), "config_hash": config_hash,
        "config": str(Path(config_path).resolve()),
    }
    cleared = None
    for _attempt in range(3):
        try:
            _create(path, record)
        except FileExistsError:
            rec = read_lock(ws)
            if rec is None:
                continue                  # released between open and read
            if rec["state"] in ("held", "unverifiable"):
                raise _refusal(rec) from None
            # stale/corrupt: remove it — but only if it is STILL the record
            # judged stale (another run may have replaced it meanwhile)
            try:
                if path.read_text(encoding="utf-8") == rec.get("_raw"):
                    path.unlink()
            except FileNotFoundError:
                pass
            cleared = rec
            continue
        break
    else:
        raise ForgeError(
            f"could not take the run lock {path} — another run kept "
            "replacing it\n"
            "  fix: `nmt-forge status` shows whether a run is in progress; "
            "start this run once it reports no run")
    if cleared is not None:
        print(f"[run-lock] cleared a stale lock ({cleared.get('why') or cleared['state']}) "
              f"left by {describe(cleared)}", flush=True)
    try:
        yield record
    finally:
        try:
            current = json.loads(path.read_text(encoding="utf-8"))
            if current.get("token") == token:
                path.unlink()
        except (OSError, ValueError):
            pass
