"""Heartbeats: a running job says it is alive, and how far along.

The founder's rule (2026-09-06, after a gated decode hung 4 h 51 m unnoticed):
every step in a chain is bounded and has a stall watchdog. A job started by
:mod:`nmt_forge.jobs` gets ``NMT_FORGE_HEARTBEAT=<path>`` in its environment;
training writes a small JSON document there at every stage boundary and, at
most every few seconds, on every step — so the supervisor can tell "slow" from
"stuck" and stop a stuck job instead of waiting forever.

Outside a job (``NMT_FORGE_HEARTBEAT`` unset) every call is a no-op. A beat
that cannot be written is reported ONCE on stderr — the supervisor will then
see the job as stalled, which is the honest reading of a job that cannot
report.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

ENV = "NMT_FORGE_HEARTBEAT"
#: per-step beats are throttled to one per this many seconds
MIN_INTERVAL_S = 2.0

_last = {"t": 0.0, "warned": False}


def path() -> Path | None:
    p = os.environ.get(ENV, "").strip()
    return Path(p) if p else None


def beat(stage: str, step: int | None = None, max_steps: int | None = None,
         *, force: bool = False, **extra) -> None:
    """Record that the job is alive at ``stage`` (and ``step`` of
    ``max_steps``). Throttled unless ``force`` (stage boundaries force)."""
    target = path()
    if target is None:
        return
    now = time.time()
    if not force and now - _last["t"] < MIN_INTERVAL_S:
        return
    doc = {"pid": os.getpid(), "stage": stage, "step": step,
           "max_steps": max_steps, "t": now, **extra}
    tmp = target.with_name(target.name + ".tmp")
    try:
        tmp.write_text(json.dumps(doc), encoding="utf-8")
        os.replace(tmp, target)
        _last["t"] = now
    except OSError as exc:
        if not _last["warned"]:
            _last["warned"] = True
            print(f"[heartbeat] could not write {target} ({exc}) — the job "
                  "supervisor will see this job as stalled", file=sys.stderr,
                  flush=True)


def read(p: str | Path) -> dict | None:
    """The last heartbeat at ``p``, or None."""
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
