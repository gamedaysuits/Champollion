"""Live training monitor — a local GUI that opens for the HUMAN even when an
agent is driving forge entirely through CLI/MCP.

Design (founder-specified, 2026-07-14): the panel is deliberately read-only.
Training is agent-driven; a human watching it gets the loss curves, the
schedule floor, the event feed — and exactly ONE control: a loud, two-step
"stop training" that kills the run. Anything else, they ask the agent.

2026-10-11 (founder: "we want what going down, when, what counts as
progress"): the panel leads with the DEV SCORE — the dev translations' chrF++
at every check, the line that decides which checkpoint is kept — with the
dictionary floor beside it, a plain-words summary (best so far, still
improving or not, above the floor or not, when the next check comes), the
losses second, and a "how to read this" guide plus an ⓘ explanation on every
line. With little data the dev loss rises while the translations improve;
the panel says so rather than letting the loss look like failure.

2026-10-13 (founder: "I should be able to tell what we're running"): under
the run name, one line says what is training — languages, model, training
pairs (corpus, licence), practice (dev) set size — and "About this run" gives
the corpus's character. ``state["facts"]`` comes from ``run_facts`` (live:
``emit("facts", ...)``; attached: the run's ``run-facts.json``, or rebuilt
from its config for an older run). Names, counts and averages only — never a
sentence.

2026-10-14 (founder: "more aesthetic and professional … more full of good
information about the run, zoomable charts"; critique:
docs/FORGE_DASHBOARD_CRITIQUE_2026-10-14.md): the panel is a run dashboard in
the site's brand (DESIGN.md ink/paper neutrals, scholarly teal; light and
dark), with zoomable charts — dev chrF++, train/dev loss, learning rate,
gradient norm, seconds per step, memory — a shared crosshair, smoothing and a
log scale, and what forge knows that a tracker cannot: where the run runs
(this computer = sovereign; a RunPod run = semi-sovereign, with its cost
against the cap), what the guardrails did (practice-set reads by purpose,
test-set reads, the leak audit), the checkpoints and, once done, the final
selection with its 95% intervals; plus a runs view comparing the
workspace's runs. All of it is read from files forge already writes (the
trainer's state, the checkpoint folders, the workspace ledger and registry,
the manifest) by cheap polling; the charts, zoom and smoothing run in the
browser. The page is three static files in ``panel/`` inlined into ONE
document — no CDN, no fonts, no network.

2026-10-14, second pass (founder: "hover-over information tooltips are always
preferred to dull, unjustified, unorganized text dumps … a graphic HUD that
organizes thoughts and data specifically for NMT dev"): the page reads in the
order of the three questions. **Run health** first — one reading per question
(dev score, training loss, overfit check, gradients, memory, heartbeat, and the
cost on a rented machine), each ok / watch / alert by a stated rule, never by
colour alone (circle, triangle, square), each with its trend; the same readings
are ``health_*`` fields and a ``health`` list in ``/hud.json``. The score chart
marks new bests (filled) against checks that were not (hollow), the best to
beat, the **patience window** (where it stops if no check beats the best:
``stop_by_patience_step``), and the checkpoints still on disk; the checks are a
table beside the loss chart (hovering a row marks that step on every chart).
Learning rate, gradient norm, speed and memory are small multiples on one step
axis. The runs view answers "which run is better" with each run's final score
and its 95% range (a dot-and-range plot), small multiples of the curves, and
steps or passes along the bottom. A semi-sovereign run is visible while it
trains: the remote lane copies the machine's heartbeat and a numbers-only copy
of its trainer state into the run folder every 30 s (``REMOTE_PROGRESS``), so
the panel shows its steps, curves, pace, time left and what waiting will cost.
JSON is browser-safe: a loss that is not a number is sent as null (and the
health reading says "not a number").

Two modes:

* **Live** — ``RunMonitor`` is created by ``nmt-forge run`` (non-dummy
  backends), serves the panel from a background thread, receives loss points
  via ``emit()`` from a trainer callback, enriches them every 15 s from the
  run folder, and exposes ``stop_requested()`` which the callback polls; a
  human stop ends training at the next step boundary and the run aborts
  loudly (recorded, nonzero exit).
* **Attach** — ``nmt-forge monitor <run-dir> [--pid N]`` watches an ALREADY
  RUNNING run by polling the HF trainer's ``checkpoint-*/trainer_state.json``
  dumps (every eval-save), serving the same panel; its stop button SIGTERMs
  the given pid (and only that pid).

No dependencies beyond the stdlib. Disable auto-open (e.g. in CI) with
``NMT_FORGE_NO_MONITOR=1``. Widen the runs view beyond the workspace with
``NMT_FORGE_MONITOR_RUNS`` (run-folder globs, separated by the OS path
separator).
"""

from __future__ import annotations

import glob as _glob
import json
import math
import os
import re
import signal
import sys
import threading
import time
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

STOP_BASENAME = "STOP_REQUESTED"
RUNS_ENV = "NMT_FORGE_MONITOR_RUNS"
ENRICH_SECONDS = 15.0            # live mode: how often the run folder is re-read
_GB = 2 ** 30


def monitor_enabled() -> bool:
    return os.environ.get("NMT_FORGE_NO_MONITOR", "") != "1"


# -- the page (three static files beside this module, inlined into one) ----------

PANEL_DIR = Path(__file__).with_name("panel")

_FALLBACK_HTML = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>nmt-forge · training panel</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;
background:#101312;color:#e8eae8}code{font-family:ui-monospace,monospace}</style></head><body>
<h1>Training panel</h1><p>The panel's page files (<code>nmt_forge/panel/</code>) could not be read, so only
the raw data is served: <a href="/status" style="color:#3fc1c0">/status</a>. Training is not affected.
This panel is read-only by design — talk to the agent. Stop training: THIS KILLS THE TRAINING RUN
(POST /stop).</p></body></html>"""


def panel_html() -> str:
    """The panel as one document: panel.html with panel.css and panel.js
    inlined (no external asset, works offline). Never raises: a broken
    install serves a minimal page and the data endpoints keep working."""
    try:
        html = (PANEL_DIR / "panel.html").read_text(encoding="utf-8")
        css = (PANEL_DIR / "panel.css").read_text(encoding="utf-8")
        js = (PANEL_DIR / "panel.js").read_text(encoding="utf-8")
    except OSError:
        return _FALLBACK_HTML
    return (html.replace("/*__PANEL_CSS__*/", css)
                .replace("/*__PANEL_JS__*/", js.replace("</script", "<\\/script")))


PANEL_HTML = panel_html()


# -- small, safe readers (cheap; cached by modification time; never raise) -------

_JSON_CACHE: dict[str, tuple[tuple, object]] = {}
_JSON_CACHE_MAX = 256


def _read_json_cached(path: Path):
    """``json.load`` of ``path``, re-parsed only when it changes; None when it
    cannot be read."""
    try:
        st = path.stat()
    except OSError:
        return None
    key = (st.st_mtime_ns, st.st_size)
    hit = _JSON_CACHE.get(str(path))
    if hit and hit[0] == key:
        return hit[1]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if len(_JSON_CACHE) >= _JSON_CACHE_MAX:
        _JSON_CACHE.clear()
    _JSON_CACHE[str(path)] = (key, data)
    return data


_LEDGER_CACHE: dict[str, tuple[tuple, list]] = {}


def _ledger_entries(ws_root: Path | None) -> list[dict]:
    """The workspace ledger's entries (hash-chained JSON lines), re-read only
    when the file changes. Counts, names, hashes and paths — never text."""
    if ws_root is None:
        return []
    path = ws_root / "ledger.jsonl"
    try:
        st = path.stat()
    except OSError:
        return []
    key = (st.st_mtime_ns, st.st_size)
    hit = _LEDGER_CACHE.get(str(path))
    if hit and hit[0] == key:
        return hit[1]
    out = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                if isinstance(e, dict):
                    out.append(e)
    except OSError:
        return []
    _LEDGER_CACHE[str(path)] = (key, out)
    return out


def _ts(value) -> float | None:
    """An ISO timestamp (the ledger's, run-facts' ``started``) as epoch seconds."""
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def _workspace_root(run_dir: Path) -> Path | None:
    """``<workspace>/runs/<run>`` → ``<workspace>`` (where the ledger, the
    registry and the run lock live), or None for a folder outside one."""
    try:
        parent = run_dir.resolve().parent
    except OSError:
        return None
    if parent.name != "runs":
        return None
    ws = parent.parent
    if any((ws / n).exists() for n in ("ledger.jsonl", "eval-registry.json", "run.lock")):
        return ws
    return None


_CKPT = re.compile(r"checkpoint-(\d+)$")


def _checkpoint_dirs(run_dir: Path) -> list[Path]:
    """Checkpoint folders under the run folder (stage folders one level down)."""
    out = []
    for pattern in ("checkpoint-*", "*/checkpoint-*"):
        try:
            out += [p for p in run_dir.glob(pattern) if p.is_dir() and _CKPT.search(p.name)]
        except OSError:
            continue
    return out


def _dir_bytes(d: Path) -> int:
    total = 0
    try:
        for p in d.iterdir():
            try:
                if p.is_file():
                    total += p.stat().st_size
            except OSError:
                continue
    except OSError:
        pass
    return total


# -- memory: the trainer process's physical footprint ------------------------------

_LIBPROC = None


def _footprint_gb(pid: int | None) -> float | None:
    """Memory the process holds, in GB: on macOS its physical footprint (on
    Apple silicon this includes what the GPU uses — the resident size does
    not, and reads ~0.4 GB for a run holding 17 GB); on Linux its resident
    size. None when it cannot be read. A 0.02 ms call; never raises."""
    global _LIBPROC
    if not pid:
        return None
    try:
        if sys.platform == "darwin":
            import ctypes

            class _RUsage(ctypes.Structure):          # rusage_info_v0 (libproc.h)
                _fields_ = [("uuid", ctypes.c_uint8 * 16)] + [(n, ctypes.c_uint64) for n in (
                    "user", "system", "pkg_idle", "interrupt", "pageins", "wired", "resident",
                    "phys_footprint", "start", "exit")]

            if _LIBPROC is None:
                _LIBPROC = ctypes.CDLL("/usr/lib/libSystem.B.dylib")
            buf = _RUsage()
            if _LIBPROC.proc_pid_rusage(int(pid), 0, ctypes.byref(buf)) != 0:
                return None
            return round(buf.phys_footprint / _GB, 2)
        if sys.platform.startswith("linux"):
            with open(f"/proc/{int(pid)}/status", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        return round(int(line.split()[1]) * 1024 / _GB, 2)
    except Exception:
        return None
    return None


def _total_memory_gb() -> float | None:
    try:
        return round(os.sysconf("SC_PHYS_PAGES") * os.sysconf("SC_PAGE_SIZE") / _GB, 1)
    except (ValueError, OSError, AttributeError):
        return None


_PARAMS_CACHE: dict[str, tuple[tuple, int | None]] = {}


def _safetensors_params(path: Path) -> int | None:
    """How many numbers (parameters) a ``.safetensors`` file holds — read
    from its JSON header alone (the first bytes), never the weights."""
    try:
        st = path.stat()
        key = (st.st_mtime_ns, st.st_size)
        hit = _PARAMS_CACHE.get(str(path))
        if hit and hit[0] == key:
            return hit[1]
        with open(path, "rb") as f:
            n = int.from_bytes(f.read(8), "little")
            if not 0 < n < 64 * 2 ** 20:
                return None
            header = json.loads(f.read(n))
        total = 0
        for name, t in header.items():
            if name == "__metadata__" or not isinstance(t, dict):
                continue
            count = 1
            for d in t.get("shape") or []:
                count *= int(d)
            total += count
        _PARAMS_CACHE[str(path)] = (key, total)
        return total
    except (OSError, ValueError, TypeError):
        return None


def _parameters_trained(ckpt_dir: Path | None) -> dict | None:
    """What a checkpoint saved: a LoRA run saves only its adapter (the
    parameters it trains); a full fine-tune saves every weight. Counted from
    the files' headers (shared weights are stored once)."""
    if ckpt_dir is None:
        return None
    adapter = sorted(ckpt_dir.glob("adapter_model*.safetensors"))
    files = adapter or sorted(ckpt_dir.glob("model*.safetensors"))
    if not files:
        return None
    counts = [_safetensors_params(p) for p in files]
    if any(c is None for c in counts):
        return None
    return {"count": sum(counts), "kind": "adapter" if adapter else "all"}


# -- what the run folder, the workspace and the manifest say ------------------------

def _trainer_view(doc: dict | None) -> dict:
    """The HF trainer state as the panel's plan/progress block and its
    learning-rate and gradient-norm series ([step, value] pairs)."""
    if not isinstance(doc, dict):
        return {}
    trainer = {"global_step": doc.get("global_step"), "max_steps": doc.get("max_steps"),
               "epoch": doc.get("epoch"), "num_train_epochs": doc.get("num_train_epochs"),
               "best_step": doc.get("best_global_step"), "eval_steps": doc.get("eval_steps"),
               "logging_steps": doc.get("logging_steps"), "save_steps": doc.get("save_steps"),
               "train_batch_size": doc.get("train_batch_size")}
    for cb in (doc.get("stateful_callbacks") or {}).values():
        if not isinstance(cb, dict):
            continue
        args, attrs = cb.get("args") or {}, cb.get("attributes") or {}
        if args.get("early_stopping_patience"):
            trainer["patience"] = args["early_stopping_patience"]
            if isinstance(attrs.get("early_stopping_patience_counter"), int):
                trainer["patience_used"] = attrs["early_stopping_patience_counter"]
    lr, grad, eval_secs = [], [], []
    for e in doc.get("log_history") or []:
        if not isinstance(e, dict) or "step" not in e:
            continue
        step = int(e["step"])
        if isinstance(e.get("learning_rate"), (int, float)):
            lr.append([step, float(e["learning_rate"])])
        if isinstance(e.get("grad_norm"), (int, float)):
            grad.append([step, float(e["grad_norm"])])
        if isinstance(e.get("eval_runtime"), (int, float)):
            eval_secs.append([step, round(float(e["eval_runtime"]), 1)])
    return {"trainer": {k: v for k, v in trainer.items() if v is not None},
            "series": {"lr": lr, "grad_norm": grad, "check_seconds": eval_secs}}


def _checkpoints_view(run_dir: Path, times: dict) -> list[dict]:
    """Checkpoint folders on disk: name, stage, step, bytes, when saved.
    ``times`` (step → save time) keeps the save times of checkpoints the
    trainer has since deleted, for the pace."""
    out = []
    for d in _checkpoint_dirs(run_dir):
        step = int(_CKPT.search(d.name).group(1))
        try:
            saved = (d / "trainer_state.json").stat().st_mtime
        except OSError:
            try:
                saved = d.stat().st_mtime
            except OSError:
                continue
        times.setdefault(step, saved)
        out.append({"name": d.name, "stage": d.parent.name if d.parent != run_dir else "",
                    "step": step, "bytes": _dir_bytes(d), "saved": round(saved, 1)})
    out.sort(key=lambda c: (c["saved"], c["step"]))
    return out


def _pace_from_saves(times: dict) -> list[list]:
    """Seconds per step between consecutive checkpoint saves ([step, s]).
    Each interval includes one check of the dev score."""
    pts = sorted(times.items())
    out = []
    for (s0, t0), (s1, t1) in zip(pts, pts[1:]):
        if s1 > s0 and t1 > t0:
            out.append([s1, round((t1 - t0) / (s1 - s0), 3)])
    return out


def _since_run_start(entries: list[dict], start: float | None) -> list[dict]:
    if start is None:
        return []
    return [e for e in entries if (_ts(e.get("ts")) or 0) >= start - 60]


# -- a run on a rented machine: its progress, copied here while it trains ----------------
#: forge's remote lane (remote/lifecycle.py) reads the machine's heartbeat every 30 s; it
#: writes what it read here, and a copy of the newest trainer state (numbers only), so the
#: panel shows a semi-sovereign run's progress and curves while it trains — not only once the
#: model comes back. Both are removed when the run folder comes back from the machine.
REMOTE_PROGRESS = "remote-progress.json"
REMOTE_MIRROR = "remote-progress"
_TS_KEYS = ("global_step", "max_steps", "epoch", "num_train_epochs", "eval_steps", "logging_steps", "save_steps",
            "train_batch_size", "best_global_step", "best_metric")
_LOG_KEY = re.compile(r"(step|epoch|loss|grad_norm|learning_rate|eval_[a-z0-9_+]+)$")


def _number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def write_remote_progress(run_dir: Path, *, heartbeat: dict, changed: float | None, polled: float,
                          usd: float | None = None) -> None:
    """The remote lane's latest reading of the machine (stage, step of steps, when its heartbeat
    last moved — on THIS computer's clock), atomically. Numbers and a stage name only."""
    hb = heartbeat if isinstance(heartbeat, dict) else {}
    doc = {"schema": "nmt-forge.remote-progress/1", "polled": round(polled, 1),
           "changed": round(changed, 1) if _number(changed) else None,
           "stage": str(hb.get("stage") or "")[:60] or None,
           "step": hb.get("step") if _number(hb.get("step")) else None,
           "max_steps": hb.get("max_steps") if _number(hb.get("max_steps")) else None,
           "usd_estimated": round(usd, 2) if _number(usd) else None}
    tmp = Path(run_dir) / (REMOTE_PROGRESS + ".tmp")
    tmp.write_text(json.dumps(doc), encoding="utf-8")
    os.replace(tmp, Path(run_dir) / REMOTE_PROGRESS)


def mirror_trainer_state(run_dir: Path, text: str, *, max_bytes: int = 20 * 2 ** 20) -> bool:
    """Keep a copy of the machine's newest ``trainer_state.json`` — only the plan and the
    numeric log (loss, learning rate, gradient norm, the checks' scores), whatever else the
    file holds — under ``<run>/remote-progress/``. False when it is not a trainer state."""
    if not text or len(text) > max_bytes:
        return False
    try:
        doc = json.loads(text)
    except ValueError:
        return False
    if not isinstance(doc, dict) or not _number(doc.get("global_step")):
        return False
    out = {k: doc[k] for k in _TS_KEYS if _number(doc.get(k))}
    cbs = {}
    for name, cb in (doc.get("stateful_callbacks") or {}).items():
        if not isinstance(cb, dict):
            continue
        args = {k: v for k, v in (cb.get("args") or {}).items()
                if k.startswith("early_stopping") and _number(v)}
        attrs = {k: v for k, v in (cb.get("attributes") or {}).items()
                 if k.startswith("early_stopping") and _number(v)}
        if args or attrs:
            cbs[re.sub(r"[^A-Za-z0-9_]", "", str(name))[:60] or "callback"] = {"args": args, "attributes": attrs}
    if cbs:
        out["stateful_callbacks"] = cbs
    out["log_history"] = [{k: v for k, v in e.items() if _LOG_KEY.match(str(k)) and _number(v)}
                          for e in doc.get("log_history") or [] if isinstance(e, dict) and _number(e.get("step"))]
    folder = Path(run_dir) / REMOTE_MIRROR
    folder.mkdir(exist_ok=True)
    tmp = folder / "trainer_state.json.tmp"
    tmp.write_text(json.dumps(out), encoding="utf-8")
    os.replace(tmp, folder / "trainer_state.json")
    return True


def clear_remote_progress(run_dir: Path) -> None:
    """The run folder came back: the copies are superseded by the real thing."""
    import shutil

    try:
        (Path(run_dir) / REMOTE_PROGRESS).unlink(missing_ok=True)
    except OSError:
        pass
    shutil.rmtree(Path(run_dir) / REMOTE_MIRROR, ignore_errors=True)


def _where_view(run_dir: Path, entries: list[dict], manifest: dict | None, now: float) -> dict:
    """Where the run trains: this computer (sovereign), or a rented machine
    through forge's remote lane (semi-sovereign: ledger remote-start/-end, or
    the manifest's ``remote`` block). Cost so far is an estimate: hours since
    the start times the hourly price — the remote lane's own arithmetic."""
    name = run_dir.name
    start = end = None
    for e in entries:
        if e.get("run") != name:
            continue
        if e.get("event") == "remote-start":
            start, end = e, None
        elif e.get("event") == "remote-end":
            end = e
    remote = (manifest or {}).get("remote") if isinstance(manifest, dict) else None
    if start is None and not isinstance(remote, dict):
        return {"kind": "local", "sovereignty": "sovereign"}
    w = {"kind": "remote", "sovereignty": "semi-sovereign"}
    src = start or {}
    for k in ("provider", "cloud", "gpu", "usd_per_hour", "cap_usd", "countries", "datacenters"):
        if src.get(k) is not None:
            w[k] = src[k]
    if src.get("files"):
        w["files_sent"] = [{"file": f.get("file"), "role": f.get("role"),
                            "fingerprint": str(f.get("sha256") or "")[:12]}
                           for f in src["files"] if isinstance(f, dict)]
    t0 = _ts(src.get("ts"))
    if t0:
        w["started"] = t0
    if isinstance(remote, dict):
        for k in ("provider", "gpu", "usd_per_hour", "cap_usd", "datacenter", "hours", "usd",
                  "outcome", "stop_reason"):
            if remote.get(k) is not None:
                w[k] = remote[k]
        w["test_sets_sent"] = bool(remote.get("test_sets_sent"))
        w["ended"] = True
    elif end is not None:
        w.update({"ended": True, "outcome": end.get("outcome"), "stop_reason": end.get("reason"),
                  "hours": end.get("hours"), "usd": end.get("usd_estimated")})
    elif t0 and isinstance(w.get("usd_per_hour"), (int, float)):
        hours = max(0.0, (now - t0) / 3600)
        w.update({"hours": round(hours, 3), "usd": round(hours * w["usd_per_hour"], 2),
                  "usd_is_estimate": True, "ended": False})
    if w.get("ended") is not True:
        prog = _read_json_cached(run_dir / REMOTE_PROGRESS)
        if isinstance(prog, dict):
            w["ended"] = False
            w["progress"] = {k: prog.get(k) for k in ("stage", "step", "max_steps", "changed", "polled")}
            if _number(prog.get("usd_estimated")):          # the remote lane's own figure: the machine's start
                w["usd"] = prog["usd_estimated"]             # time and its actual price
    return w


def _guardrails_view(ws_root: Path | None, entries: list[dict], facts: dict,
                     manifest: dict | None, start: float | None) -> dict:
    """What forge protected: the practice (dev) set's reads by purpose, the
    test/sealed sets' reads since the run started (none, by design), the
    preregistrations, and — once the run is done — the leak audit's counts.
    Names, counts and short fingerprints; never a sentence."""
    g: dict = {}
    registry = (_read_json_cached(ws_root / "eval-registry.json") or {}) if ws_root else {}
    sets = registry.get("sets") if isinstance(registry, dict) else None
    sets = sets if isinstance(sets, dict) else {}
    dev_name = ((facts or {}).get("dev") or {}).get("name")
    since = _since_run_start(entries, start)

    def reads(name, pool):
        out: dict = {}
        for e in pool:
            if e.get("event") == "read" and e.get("set") == name:
                p = str(e.get("purpose") or "read")
                out[p] = out.get(p, 0) + 1
        return out

    for name, entry in sets.items():
        if not isinstance(entry, dict):
            continue
        role = entry.get("role")
        item = {"name": name, "role": role}
        if isinstance(entry.get("rows"), int):
            item["rows"] = entry["rows"]
        if entry.get("sha256"):
            item["fingerprint"] = str(entry["sha256"])[:12]
        if role == "dev":
            item["reads"] = reads(name, entries)
            item["reads_since_start"] = reads(name, since)
            if name == dev_name or "dev" not in g:
                g["dev"] = item
        elif role in ("test", "sealed"):
            item["reads_since_start"] = sum(reads(name, since).values()) if start else None
            item["spent"] = any(e.get("event") == "sealed-spend" and e.get("set") == name for e in entries)
            g.setdefault("tests", []).append(item)
    if ws_root is not None:
        try:
            g["preregistrations"] = len([p for p in (ws_root / "preregistrations").iterdir() if p.is_file()])
        except OSError:
            pass
    g["registry_found"] = bool(sets)
    if isinstance(manifest, dict):
        leaks: dict = {}
        for stage in manifest.get("stages") or []:
            gold = ((stage or {}).get("mix") or {}).get("gold") or {}
            for audit in (gold.get("leak_audits") or {}).values():
                for set_name, per in ((audit or {}).get("per_set") or {}).items():
                    if not isinstance(per, dict):
                        continue
                    acc = leaks.setdefault(set_name, {"role": per.get("role"), "exact_source": 0,
                                                      "exact_target": 0, "near_dupe": 0})
                    for k in ("exact_source", "exact_target", "near_dupe"):
                        if isinstance(per.get(k), int):
                            acc[k] += per[k]
        if leaks:
            g["leak_audit"] = leaks
        overlap = ((manifest.get("dev_set") or {}).get("training_overlap") or {})
        if isinstance(overlap, dict) and overlap:
            g["dev_training_overlap"] = sum(v for v in overlap.values() if isinstance(v, int))
    return g


def _final_view(manifest: dict | None) -> dict | None:
    """Once the run is done: which checkpoint was kept, each finalist's chrF++
    on the WHOLE dev set with its 95% interval, and why training stopped."""
    if not isinstance(manifest, dict):
        return None
    f: dict = {"selected": manifest.get("selected_checkpoint")}
    stages = [s for s in manifest.get("stages") or [] if isinstance(s, dict)]
    last = stages[-1] if stages else {}
    sel = last.get("selection") or {}
    if sel.get("selected_step") is not None:
        f["selected_step"] = sel["selected_step"]
    finals = []
    for c in sel.get("per_checkpoint") or []:
        if not isinstance(c, dict):
            continue
        m = _CKPT.search(str(c.get("id", "")))
        item = {"id": c.get("id"), "step": int(m.group(1)) if m else None, "dev_loss": c.get("dev_loss")}
        if isinstance(c.get("chrf++"), (int, float)):
            item["chrf"] = c["chrf++"]
        if isinstance(c.get("ci"), list) and len(c["ci"]) == 2:
            item["ci"] = c["ci"]
        finals.append(item)
    if finals:
        f["finalists"] = finals
    rep = ((manifest.get("dev_report") or {}).get("scores") or {}).get("chrf++")
    if isinstance(rep, dict) and isinstance(rep.get("score"), (int, float)):
        f["dev_chrf"] = {"score": rep["score"], "ci": [rep.get("ci_lower"), rep.get("ci_upper")],
                         "n": (manifest.get("dev_report") or {}).get("n")}
    if last.get("stop_explanation"):
        f["stop_explanation"] = str(last["stop_explanation"]).split("\n")[0][:400]
    info = last.get("backend_info") or {}
    for k in ("device", "trainable_parameters", "gpu_memory"):
        if info.get(k) is not None:
            f[k] = info[k]
    sched = last.get("schedule") or {}
    for k in ("steps_per_epoch", "planned_steps", "floor_steps", "regime"):
        if sched.get(k) is not None:
            f.setdefault("schedule", {})[k] = sched[k]
    return f


def _lock_pid(ws_root: Path | None, run_dir: Path) -> int | None:
    """The trainer's pid from the workspace run lock — for READING its memory
    only (the stop button signals nothing but an explicit ``--pid``)."""
    if ws_root is None:
        return None
    lock = _read_json_cached(ws_root / "run.lock")
    if not isinstance(lock, dict):
        return None
    try:
        if Path(str(lock.get("run_dir", ""))).resolve() != run_dir.resolve():
            return None
    except OSError:
        return None
    pid = lock.get("pid")
    return pid if isinstance(pid, int) and pid > 0 else None


class _Enricher:
    """Everything the panel shows beyond the loss points, read from the run
    folder, its workspace and (once written) its manifest. One instance per
    panel; ``collect()`` is cheap and never raises."""

    def __init__(self, run_dir: Path, *, memory_pid: int | None = None, live: bool = False):
        self.run_dir = Path(run_dir)
        self.ws_root = _workspace_root(self.run_dir)
        self.memory_pid = memory_pid
        self.live = live
        self.save_times: dict[int, float] = {}
        self.memory: list[list] = []          # [step, GB, epoch seconds]
        self.total_gb = _total_memory_gb()

    def collect(self, *, step: int | None, facts: dict, now: float | None = None) -> dict:
        now = now or time.time()
        out: dict = {}
        try:
            newest = _newest_trainer_state(self.run_dir)
            tv = _trainer_view(newest)
            out.update(tv)
            ckpts = _checkpoints_view(self.run_dir, self.save_times)
            out["checkpoints"] = ckpts
            if ckpts:
                newest_dir = max(_checkpoint_dirs(self.run_dir),
                                 key=lambda d: int(_CKPT.search(d.name).group(1)), default=None)
                params = _parameters_trained(newest_dir)
                if params:
                    out["parameters"] = params
            manifest = _read_json_cached(self.run_dir / "run-manifest.json")
            entries = _ledger_entries(self.ws_root)
            start = _ts((facts or {}).get("started"))
            if start is None and self.ws_root is not None:
                lock = _read_json_cached(self.ws_root / "run.lock")
                if isinstance(lock, dict) and isinstance(lock.get("created"), (int, float)):
                    start = float(lock["created"])
            out["where"] = _where_view(self.run_dir, entries, manifest, now)
            out["guardrails"] = _guardrails_view(self.ws_root, entries, facts, manifest, start)
            final = _final_view(manifest)
            if final:
                out["final"] = final
            pid = self.memory_pid if self.memory_pid else _lock_pid(self.ws_root, self.run_dir)
            gb = _footprint_gb(pid)
            cur = step if step is not None else (tv.get("trainer") or {}).get("global_step")
            if gb is not None and cur is not None:
                if self.memory and self.memory[-1][0] == cur:
                    self.memory[-1] = [cur, gb, round(now, 1)]
                else:
                    self.memory.append([cur, gb, round(now, 1)])
                del self.memory[:-2000]
            machine = {"memory_total_gb": self.total_gb, "memory_source": (
                "this process" if self.live else "--pid" if self.memory_pid else "run lock" if pid else None),
                "platform": sys.platform}
            if self.memory:
                machine["memory_now_gb"] = self.memory[-1][1]
                machine["memory_peak_gb"] = max(m[1] for m in self.memory)
            out["machine"] = {k: v for k, v in machine.items() if v is not None}
            out.setdefault("series", {})["memory_gb"] = [m[:2] for m in self.memory]
            if not self.live:
                out["series"]["save_pace"] = _pace_from_saves(self.save_times)
            if self.ws_root is not None:
                out["workspace"] = str(self.ws_root)
        except Exception as e:                 # a view: never the reason a panel or a run fails
            out["enrich_error"] = f"{type(e).__name__}: {e}"[:300]
        return out


# -- the runs view: the workspace's runs side by side -------------------------------

_RUNS_CACHE: dict[str, tuple[float, list]] = {}


def _run_dirs(roots: list[str]) -> list[Path]:
    seen, out = set(), []
    for root in roots:
        try:
            if any(ch in root for ch in "*?["):
                cands = [Path(p) for p in _glob.glob(os.path.expanduser(root))]
            else:
                cands = [p for p in Path(os.path.expanduser(root)).iterdir()]
        except OSError:
            continue
        for p in cands:
            try:
                if not p.is_dir():
                    continue
                key = str(p.resolve())
            except OSError:
                continue
            if key in seen:
                continue
            if (p / "run-manifest.json").exists() or (p / "run-facts.json").exists() or _checkpoint_dirs(p):
                seen.add(key)
                out.append(p)
    try:
        out.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    except OSError:
        pass
    return out[:40]


def _run_summary(run_dir: Path, now: float) -> dict:
    from .run_facts import read_facts

    facts = read_facts(run_dir) or {}
    ws_root = _workspace_root(run_dir)
    manifest = _read_json_cached(run_dir / "run-manifest.json")
    newest = _newest_trainer_state(run_dir)
    tv = _trainer_view(newest).get("trainer") or {}
    curve = []
    for e in (newest or {}).get("log_history") or []:
        if isinstance(e, dict) and isinstance(e.get("eval_chrf"), (int, float)):
            curve.append([int(e.get("step", 0)), round(float(e["eval_chrf"]), 2)])
    entries = _ledger_entries(ws_root)
    where = _where_view(run_dir, entries, manifest, now)
    status = "done" if isinstance(manifest, dict) else None
    if status is None:
        if where.get("kind") == "remote":
            status = "training" if where.get("ended") is False else "stopped"
        else:
            pid = _lock_pid(ws_root, run_dir)
            status = "training" if pid and _pid_alive(pid) else "stopped"
    s = {"name": run_dir.name, "status": status, "where": where.get("sovereignty"),
         "provider": where.get("provider"), "usd": where.get("usd"),
         "label": facts.get("label"), "model": (facts.get("model") or {}).get("name"),
         "pairs": (facts.get("training") or {}).get("pairs"),
         "languages": facts.get("languages"), "started": _ts(facts.get("started")),
         "dev_set": (facts.get("dev") or {}).get("name"), "dev_pairs": (facts.get("dev") or {}).get("sentences"),
         "step": tv.get("global_step"), "planned": tv.get("max_steps"),
         "epochs": tv.get("num_train_epochs"), "curve": curve}
    prog = where.get("progress") or {}
    if s["step"] is None and _number(prog.get("step")):        # a rented machine's run, before its first checkpoint
        s["step"], s["planned"] = prog["step"], prog.get("max_steps") if _number(prog.get("max_steps")) else None
    if curve:
        best = max(curve, key=lambda p: p[1])
        s["best"] = {"step": best[0], "score": best[1]}
    final = _final_view(manifest)
    if final and final.get("dev_chrf"):
        s["final"] = final["dev_chrf"]
        s["selected"] = final.get("selected")
    try:
        s["updated"] = max(p.stat().st_mtime for p in [run_dir, *_checkpoint_dirs(run_dir)])
    except (OSError, ValueError):
        pass
    return {k: v for k, v in s.items() if v is not None}


def runs_overview(run_dir: Path, *, ttl: float = 20.0) -> dict:
    """The runs beside this one (its workspace's ``runs/`` folder, plus any
    ``NMT_FORGE_MONITOR_RUNS`` globs): status, where, model, pairs, best and
    final dev chrF++, steps — and each run's dev-score curve. Cached ``ttl``
    seconds; never raises."""
    roots = [str(Path(run_dir).resolve().parent)]
    extra = os.environ.get(RUNS_ENV, "").strip()
    if extra:
        roots += [r for r in extra.split(os.pathsep) if r.strip()]
    key = "|".join(roots)
    now = time.time()
    hit = _RUNS_CACHE.get(key)
    if hit and now - hit[0] < ttl:
        return {"runs": hit[1], "roots": roots, "current": Path(run_dir).name, "cached": True}
    runs = []
    for d in _run_dirs(roots):
        try:
            runs.append(_run_summary(d, now))
        except Exception as e:
            runs.append({"name": d.name, "error": f"{type(e).__name__}"})
    _RUNS_CACHE[key] = (now, runs)
    return {"runs": runs, "roots": roots, "current": Path(run_dir).name}


# -- the HUD: every key value as a labelled field (humans and agents read the same) --

HUD_SCHEMA = "nmt-forge.hud/1"

#: What each field (or group of fields) is, why it matters for building a
#: translator, and how to read it — the panel's tooltips, and the same words
#: for an agent reading /hud.json?help=1. Plain words; no third parties.
HELP: dict[str, dict[str, str]] = {
    "status": {"title": "Status",
               "what": "What the training is doing now: starting, training, done or stopped.",
               "why": "Says whether the numbers on this panel are still moving.",
               "read": "Training: a new check of the dev score comes every few hundred steps. Done: the best "
                       "checkpoint has been chosen. Stopped: the run ended early; the log says why."},
    "data_age": {"title": "Last new data",
                 "what": "Time since the panel last saw new training numbers, and whether the training process "
                         "is still running.",
                 "why": "A run that goes quiet for much longer than usual may be stuck.",
                 "read": "Attached without the training log, new numbers arrive only with each saved "
                         "checkpoint — once per check."},
    "source_language": {"title": "Source language",
                        "what": "The language the translator reads.",
                        "why": "A translator is built for one direction; this is its input.",
                        "read": "The name the project gave, with its language code."},
    "target_language": {"title": "Target language",
                        "what": "The language the translator writes.",
                        "why": "Every score on this panel measures how well it writes this language.",
                        "read": "A code from qaa to qtz is a placeholder the project chose, not a registered "
                                "language."},
    "model": {"title": "Model",
              "what": "The model being trained: the starting model (base) and the forge preset it matches.",
              "why": "The base decides what the translator knows before it sees your pairs. A bigger base can "
                     "learn more but needs more memory and time.",
              "read": "A byte model reads text one byte at a time, so it copes with any writing system "
                      "and with words it has never seen."},
    "parameters_trained": {"title": "Parameters trained",
                           "what": "How many numbers inside the model this training changes, counted from the "
                                   "latest saved checkpoint.",
                           "why": "More trained numbers can learn more from your pairs, but need more memory "
                                  "and more pairs to avoid memorising them.",
                           "read": "'all weights': a full fine-tune. 'adapter': a small add-on is trained and "
                                   "the base stays fixed. M = million."},
    "training_pairs": {"title": "Training pairs",
                       "what": "Sentence pairs the model learns from: a sentence and its translation.",
                       "why": "The biggest lever on quality. Doubling the pairs usually lifts the dev score more "
                              "than any setting does.",
                       "read": "Counted in the training files as given, before forge repeats or caps any. "
                               "Pairs a program generated are counted apart."},
    "pair_length": {"title": "Pair length",
                    "what": "How long a typical training sentence is, in words (counted between spaces), on each "
                            "side: mean and median.",
                    "why": "Long sentences are harder to learn and slower to train; very short ones teach words "
                           "but little grammar.",
                    "read": "Source → target. The target's bytes matter for a byte model: it reads one byte at a "
                            "time, and a syllabics letter takes three."},
    "too_long": {"title": "Cut by the length limit",
                 "what": "Training sentences longer than the model reads at once (its limit, in tokens).",
                 "why": "The part past the limit is cut off: the model never learns how those sentences end.",
                 "read": "Under 1% is fine. Several percent means the limit is low for this corpus — ask the "
                         "agent."},
    "dev_pairs": {"title": "Dev pairs",
                  "what": "Practice (dev) pairs: set aside from training and never studied.",
                  "why": "At each check the model translates them and is scored against the real translations. "
                         "They tell real progress from memorising.",
                  "read": "More dev pairs give a steadier score. Under about 100, two checks a few points apart "
                          "may not really differ. 'Read per check' is how many a quick check translates."},
    "terms": {"title": "Corpus and licence",
              "what": "Where the training pairs come from, and the terms they were shared under.",
              "why": "The terms travel with the model: a model trained on non-commercial data is "
                     "non-commercial too.",
              "read": "As recorded beside the training files, or given by the job that started the run."},
    "where": {"title": "Where it runs",
              "what": "Which computer trains the model.",
              "why": "Sovereignty. On this computer the sentences never leave it. On a rented machine "
                     "(semi-sovereign) the training sentences go there — each file only with the people's typed "
                     "yes — and the test sentences never do.",
              "read": "Sovereign: this computer. Semi-sovereign: a rented machine, wiped and shut down at the "
                      "end; its cost against the cap is shown."},
    "cost": {"title": "Cost",
             "what": "Money spent on the rented machine so far, against the cap set for this run (US dollars).",
             "why": "The machine is shut down when the cap is reached; the best checkpoint so far is kept.",
             "read": "While it runs this is an estimate: hours since the start × the hourly price. The final "
                     "figure is recorded when it ends."},
    "steps": {"title": "Steps",
              "what": "Training steps done, out of the steps planned. Each step learns from one batch of pairs.",
              "why": "How far through its plan the run is. It can stop sooner when the dev score stops "
                     "improving.",
              "read": "Planned steps = passes × training pairs ÷ pairs per step."},
    "passes": {"title": "Passes (epochs)",
               "what": "How many times the model has gone through all the training pairs.",
               "why": "Too few passes and it has not learned; too many and it starts memorising — the dev score "
                      "shows which.",
               "read": "Done / planned. A fraction is part-way through a pass."},
    "effective_batch": {"title": "Pairs per step",
                        "what": "Training pairs the model learns from in one step.",
                        "why": "Bigger steps are steadier but need more memory, or several smaller batches "
                               "added together.",
                        "read": "Pairs loaded at once × batches added together before each update."},
    "checks": {"title": "Checks",
               "what": "Checks of the dev score: at each one the model translates the dev pairs and is scored.",
               "why": "Checks are how forge keeps the best model and knows when to stop.",
               "read": "Done / planned, and how many steps apart. In the strip each cell is one check; the teal "
                       "cell is the best so far."},
    "check_at_step": {"title": "Check at step",
                      "what": "The dev score (chrF++, 0–100) of each check, and the step it was taken at.",
                      "why": "This is the progress line: the model kept at the end is the best of these, "
                             "re-scored on all the dev pairs.",
                      "read": "Higher is better. A change of a point or two between checks can be noise."},
    "dev_score_best": {"title": "Best dev score",
                       "what": "The highest dev score so far — chrF++, 0 to 100 — and the check it came from.",
                       "why": "It decides which checkpoint is kept.",
                       "read": "chrF++ counts letters and words its translations share with the real ones; it "
                               "does not measure meaning. A translation can score 40 and still say the wrong "
                               "thing — a fluent speaker is the real judge. On the ring: the dark tick is the "
                               "dictionary floor, the small marks inside are the earlier checks, the dark arc "
                               "outside is the final score's 95% range."},
    "dev_score_latest": {"title": "Latest check",
                         "what": "The most recent check's dev score (chrF++), and how much it moved since the "
                                 "check before (points).",
                         "why": "Shows whether training is still adding anything.",
                         "read": "Plus is better. Several small or negative changes in a row mean it is "
                                 "levelling off."},
    "dictionary_floor": {"title": "Dictionary floor",
                         "what": "What looking each word up in the word list scores on the same dev pairs "
                                 "(chrF++), with its 95% range.",
                         "why": "A trained model is worth using only where it beats this.",
                         "read": "Above the floor: the model adds something a word list cannot. Not measured "
                                 "for every run."},
    "verdict": {"title": "Trend",
                "what": "What the checks say so far, in two words.",
                "why": "The quick answer to 'is it still getting better?'.",
                "read": "Improving: the latest check is the best. Levelling off: no new best for a check or "
                        "more. Stopping: it has used its patience."},
    "patience": {"title": "Patience used",
                 "what": "Checks in a row without a new best, out of how many forge allows before it stops.",
                 "why": "Stopping when the score stops improving saves time and avoids memorising. The best "
                        "checkpoint is kept either way.",
                 "read": "Each filled dot is a check without a new best; a new best empties them. It never "
                         "stops before the earliest-stop step."},
    "earliest_stop": {"title": "Earliest stop",
                      "what": "The step before which training may not stop, however the checks look.",
                      "why": "Early checks on little data are noisy; stopping on them would waste the run.",
                      "read": "Drawn as a dashed line on the charts."},
    "eta": {"title": "Time left",
            "what": "Time until the last planned step at the recent pace, and the clock time it would end.",
            "why": "Plan around it — a run often stops sooner, when the dev score levels off.",
            "read": "Recent pace = seconds per step over the last few measurements, including the time checks "
                    "take."},
    "next_check": {"title": "Next check",
                   "what": "The step of the next check, and about how long until it.",
                   "why": "The next chance for a new best.",
                   "read": "Checks come every so many steps; their timing follows the recent pace."},
    "speed": {"title": "Speed",
              "what": "Seconds per training step.",
              "why": "The time cost of the run; a sudden jump spots a slowdown.",
              "read": "Steady is good. A jump usually means the computer is busy with something else or short of "
                      "memory."},
    "memory": {"title": "Memory",
               "what": "Memory the training process holds now (GB), its highest so far, and the limit.",
               "why": "If training needs more memory than the computer has, everything slows down. forge caps "
                      "the graphics share so the computer stays usable.",
               "read": "On a Mac with Apple silicon this includes what the graphics processor uses. Under about "
                       "80% of the limit is comfortable."},
    "learning_rate": {"title": "Learning rate",
                      "what": "How far each update moves the model's numbers: the peak, the warm-up, and the "
                              "value now.",
                      "why": "Too high and training jumps around; too low and it barely learns. forge warms it "
                             "up from zero, then lowers it steadily to zero at the last planned step.",
                      "read": "The chart's dashed line is the plan; the solid line is what the trainer used."},
    "grad_norm": {"title": "Gradient norm",
                  "what": "How hard the training pairs push on the model at each step — the size of the update "
                          "before it is limited.",
                  "why": "Spikes are single unsettled steps; a line that climbs and stays high means training "
                         "is unstable.",
                  "read": "Steady or slowly falling is healthy."},
    "loss_chart": {"title": "Is it learning? — loss",
                   "what": "How wrong the model is per token, lower is better: on the training pairs (grey) and "
                           "on the dev pairs it never studies (teal).",
                   "why": "Training loss shows it is learning; dev loss shows whether that carries over to "
                          "pairs it has not seen.",
                   "read": "What should go down, and when: the train loss drops fast in the first minutes, then "
                           "flattens. With a few thousand pairs or fewer the dev loss often rises after a few "
                           "checks while the dev score still improves — that alone is not a problem; watch the "
                           "dev score."},
    "score_chart": {"title": "Is it getting better? — dev score",
                    "what": "The dev score (chrF++, 0–100) at every check, with the dictionary floor.",
                    "why": "This is the line that decides which model is kept.",
                    "read": "What counts as progress: new bests, and a best above the dictionary floor. A flat "
                            "line for several checks means this model has learned what it can from these pairs "
                            "— more pairs (especially ones covering words the dev pairs use) or a different "
                            "model are the next steps. Ask the agent which."},
    "checkpoints": {"title": "Checkpoints",
                    "what": "Saved copies of the model, made at checks. forge keeps the latest few and the "
                            "best.",
                    "why": "The model you will use is one of these.",
                    "read": "What happens next: when training stops, the best few are re-scored on all dev pairs "
                            "with the final settings, and the best is kept. Only then is the test set scored — "
                            "once."},
    "final_dev_score": {"title": "Final dev score",
                        "what": "The kept model's chrF++ on all the dev pairs with the final settings, and its "
                                "95% range.",
                        "why": "The honest number for this model. Two models whose ranges overlap may not "
                               "really differ.",
                        "read": "The test set is scored only after this — once, by design."},
    "dev_reads": {"title": "Dev pair reads",
                  "what": "Every time the dev pairs were opened, and why — from the workspace's tamper-evident "
                          "ledger.",
                  "why": "The dev pairs may guide training (choosing checkpoints) but must never be used up "
                         "silently.",
                  "read": "Purposes: choosing checkpoints, the leak audit, scoring."},
    "test_reads": {"title": "Test set reads",
                   "what": "Times a test set was opened since this run started.",
                   "why": "The test set must stay unseen until the model is final, or its score stops meaning "
                          "anything.",
                   "read": "0 during training: forge refuses to let training read it."},
    "leak_audit": {"title": "Leak audit",
                   "what": "Training pairs that also appear in a dev or test set (exact matches), counted before "
                           "training.",
                   "why": "A model scored on sentences it trained on looks better than it is.",
                   "read": "0 is the goal. Shown once the run is done; counts only."},
    "preregistrations": {"title": "Predictions written down",
                         "what": "Predictions the people wrote down before training.",
                         "why": "Writing the expected score first keeps everyone honest about what counts as "
                                "success.",
                         "read": "The test score is compared with the prediction once the model is final."},
    "settings": {"title": "Training setup",
                 "what": "The settings this run trains with, from its config.",
                 "why": "Two runs are comparable only when you know what differed.",
                 "read": "Change them by asking the agent; the panel only shows them."},
    "stop": {"title": "Stop training",
             "what": "Ends this training run at the next step. The panel's only control.",
             "why": "For when a run must end now — it is using the computer someone needs, or it is clearly "
                    "wrong.",
             "read": "Two steps: a warning follows. Anything gentler (score the current checkpoint, change a "
                     "setting) — ask the agent."},
    "smoothing": {"title": "Smoothing",
                  "what": "Averages each noisy line (train loss, gradient norm) with the points before it.",
                  "why": "Step-to-step noise hides the trend; smoothing shows it. The raw line stays faint "
                         "behind.",
                  "read": "0 shows the raw values; higher is smoother but lags behind sudden changes."},
    "log_scale": {"title": "Log scale",
                  "what": "Draws the loss and the gradient norm on a scale where each step up is ten times "
                          "more.",
                  "why": "The first minutes' large values otherwise squash the rest of training into a flat "
                         "line.",
                  "read": "Equal distances mean equal ratios: 1 → 2 is as far as 5 → 10."},
    "runs_chart": {"title": "Dev score of each run",
                   "what": "The dev score (chrF++, 0–100) at each check, for every run in this workspace.",
                   "why": "Which run is better: the line that ends highest, if their dev pairs are the same.",
                   "read": "Point at a row in the table to pick out its line. Runs scored on different dev "
                           "pairs cannot be compared this way."},
    "runs_table": {"title": "Runs",
                   "what": "Every run beside this one: status, where it ran, model, training pairs, dev set, steps, "
                           "best check, and the final dev score with its 95% range.",
                   "why": "To see what changed between runs and which one to keep.",
                   "read": "Two final scores whose ranges overlap may not really differ."},
    "runs_forest": {"title": "Which run is better?",
                    "what": "Each run's final dev score (chrF++) as a dot with its 95% range as a bar; a hollow ring "
                            "is the best quick check of a run that has no final score yet.",
                    "why": "A higher dot is not enough: two runs are only clearly different when their bars do "
                           "not overlap.",
                    "read": "The shaded band is the top run's range. A run whose bar reaches into it may be just as "
                            "good. Runs scored on a different dev set are greyed out: they cannot be compared."},
    "runs_multiples": {"title": "Each run's dev score",
                       "what": "One small chart per run: its dev score (chrF++) at each check, on the same scales, "
                               "with the other runs faint behind it.",
                       "why": "Shapes are easier to compare side by side than piled on one chart: which run rose "
                              "fastest, which flattened, which stopped early.",
                       "read": "The dot is the run's best check; the bar is its final score with the 95% range. "
                               "Click a chart to pick that run out everywhere."},
    "runs_x": {"title": "Steps or passes",
               "what": "What the runs charts measure along the bottom: training steps, or passes through each run's "
                       "own training pairs.",
               "why": "A run with 400 pairs takes far fewer steps per pass than one with 6,400; by passes, runs of "
                      "different sizes line up.",
               "read": "Passes = steps ÷ (the run's planned steps ÷ its planned passes). A run that recorded no plan "
                       "is left out of the passes view."},
    "health": {"title": "Run health",
               "what": "Quick readings of the run, each ok, watch or alert: the dev score, the training loss, the "
                       "overfit check, the gradients, the memory and the heartbeat (plus the cost on a rented "
                       "machine).",
               "why": "The first question about any run: is it going well? These answer it at a glance; the "
                      "charts below say why.",
               "read": "A filled dot is ok, a triangle is worth watching, a square needs attention. Each reading "
                       "explains itself when you point at it. None of them stops the run — only you or the agent "
                       "can."},
    "health_score": {"title": "Dev score",
                     "what": "Whether the checks are still finding a better model: a new best, or how many checks "
                             "in a row have not.",
                     "why": "The dev score decides which model is kept; when it stops rising, more training of "
                            "this model on these pairs adds little.",
                     "read": "Ok: the latest check is the best. Watch: no new best for a check or more, or the "
                             "patience is used up. The sparkline is every check so far."},
    "health_learning": {"title": "Training loss",
                        "what": "Whether the loss on the training pairs is still falling: the recent stretch "
                                "against the stretch before it.",
                        "why": "A falling training loss means the model is learning from the pairs. A rising "
                               "one, or one that is not a number, means training has gone wrong.",
                        "read": "Ok: falling, or level (normal late in a run). Watch: rising by more than 5%. "
                                "Alert: rising by half or more, or not a number. The sparkline is the smoothed "
                                "loss."},
    "health_overfit": {"title": "Overfit check",
                       "what": "Whether the model is starting to memorise its training pairs: the dev loss rising "
                               "from its lowest while the dev score stops improving.",
                       "why": "A memorising model keeps getting better on its own pairs and worse on new ones; "
                              "that is when training should stop.",
                       "read": "With a few thousand pairs or fewer the dev loss often rises while the dev score "
                               "still improves — that alone is ok. Watch: dev loss up and no new best for two "
                               "checks. The sparkline is the dev loss at each check."},
    "health_stability": {"title": "Gradients",
                         "what": "Whether the update sizes (gradient norm) are steady: spikes in the recent "
                                 "steps, or a level that keeps climbing.",
                         "why": "Unsteady updates mean training is jumping around instead of learning; a run "
                                "can recover from a single spike, not from a climb.",
                         "read": "Ok: steady. Watch: three or more recent spikes over five times the usual size, "
                                 "or a recent level three times the usual. Alert: not a number. The sparkline is "
                                 "the smoothed gradient norm."},
    "health_memory": {"title": "Memory",
                      "what": "Memory the training holds, as a share of the limit.",
                      "why": "Past the limit everything on the computer slows down, and training can fail.",
                      "read": "Ok: under 80%. Watch: 80–95%. Alert: over 95%. Unknown when the panel cannot see "
                              "the training process. The sparkline runs from 0 to the limit."},
    "health_freshness": {"title": "Heartbeat",
                         "what": "How long since new numbers arrived, against how often they usually do — and "
                                 "whether the training process is still running.",
                         "why": "A stuck run looks exactly like a slow one until you compare the wait with the "
                                "usual pace.",
                         "read": "Ok: on time. Watch: over 1.5 times the usual wait. Alert: over 3 times, or the "
                                 "process is gone. Attached without the training log, numbers arrive with each "
                                 "saved checkpoint; a run on a rented machine reports every 30 seconds. The "
                                 "sparkline is the pace, in seconds per step."},
    "health_cost": {"title": "Cost",
                    "what": "Money spent on the rented machine so far, as a share of the cap.",
                    "why": "At the cap the machine is shut down; near it, forge asks training there to stop and "
                           "keep its best checkpoint.",
                    "read": "Ok: under 70% of the cap. Watch: 70–90%. Alert: over 90%. Only for a run on a rented "
                            "machine. The bar is the cost against the cap; the dashed mark is 70%."},
    "stop_reason": {"title": "Why it ended",
                    "what": "Why training stopped, as the run's own record says it: patience used up, the planned "
                            "steps done, the time budget, or a stop.",
                    "why": "A run that stopped on patience has learned what it can from these pairs; one that hit "
                           "the time budget may still have been improving.",
                    "read": "Ended at = the last training step."},
    "patience_stop": {"title": "Stops by patience",
                      "what": "The step at which training stops if no check beats the best so far: the best "
                              "check's step plus the patience in checks, never before the earliest stop.",
                      "why": "The answer to 'when will it stop?'. A new best moves it later.",
                      "read": "Shaded on the dev-score chart. 'Planned end' when the patience would run past the "
                              "last planned step."},
    "recent_gain": {"title": "Recent gain",
                    "what": "The average change in the dev score per check over the last three checks (chrF++ "
                            "points).",
                    "why": "Whether waiting is worth it: a gain under about a point per check is usually within "
                           "noise.",
                    "read": "Plus is better. Compare it with the time a check takes (Next check)."},
}


# -- run health: one reading per question, ok / watch / alert (None: cannot tell) --------

_RANK = {"ok": 0, "watch": 1, "alert": 2}


def _finite(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def _median(vals: list) -> float | None:
    v = sorted(x for x in vals if _finite(x))
    if not v:
        return None
    n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def _health_learning(train: list) -> tuple:
    """The training loss: the recent stretch against the one before it."""
    if any(not _finite(v) for _, v in train[-20:]) and train:
        return "alert", "not a number"
    vals = [v for _, v in train if _finite(v)]
    if len(vals) < 20:
        return None, "too few points yet"
    n = max(10, len(vals) // 10)
    prev, recent = _median(vals[-2 * n:-n]), _median(vals[-n:])
    if not prev or prev <= 0:
        return None, "—"
    r = recent / prev
    pct = f"{(r - 1) * 100:+.0f}%".replace("-", "\u2212")
    if r >= 1.5:
        return "alert", f"rising fast · {pct}"
    if r > 1.05:
        return "watch", f"rising · {pct}"
    if r < 0.99:
        return "ok", f"falling · {pct}"
    return "ok", "level"


def _health_overfit(checks: list, since_best: int, by_score: bool) -> tuple:
    """The dev loss against its lowest, read with the dev score (founder 2026-10-11: with little
    data the dev loss rises while the translations improve — that alone is not a problem)."""
    dl = [(c["n"], c["dev_loss"]) for c in checks if _finite(c.get("dev_loss"))]
    if any(c.get("dev_loss") is not None and not _finite(c.get("dev_loss")) for c in checks[-3:]):
        return "alert", "dev loss not a number"
    if len(dl) < 3:
        return None, "after three checks"
    low_n, low = min(dl, key=lambda x: x[1])
    last_n, last = dl[-1]
    rising = last > low * 1.05 and last_n - low_n >= 2
    if not rising:
        return "ok", "at its lowest" if last_n == low_n else "near its lowest"
    if by_score and since_best == 0:
        return "ok", "loss up, score rising"
    if since_best >= 2:
        return "watch", "loss up, no new best"
    return "ok", "loss up — watch the score"


def _health_stability(grad: list) -> tuple:
    """The gradient norm: recent spikes, or a recent level well above the usual."""
    if any(not _finite(v) for _, v in grad[-20:]) and grad:
        return "alert", "not a number"
    vals = [v for _, v in grad if _finite(v)]
    if len(vals) < 20:
        return None, "too few points yet"
    settled = vals[len(vals) // 10:]                 # past the first tenth (the warm-up's large values)
    usual = _median(settled)
    if not usual:
        return None, "—"
    n = max(10, len(settled) // 10)
    recent = settled[-n:]
    spikes = sum(1 for v in recent if v > 5 * usual)
    level = (_median(recent) or 0) / usual
    if level > 3:
        return "watch", f"climbing · ×{level:.1f}"
    if spikes >= 3:
        return "watch", f"{spikes} spikes recently"
    return "ok", "steady"


def _share_state(share, watch: float, alert: float) -> str | None:
    if share is None:
        return None
    return "alert" if share > alert else "watch" if share >= watch else "ok"


def _num(x, d: int = 0) -> str:
    return f"{x:,.{d}f}"


def _dur(seconds) -> str:
    if not isinstance(seconds, (int, float)) or seconds < 0:
        return "—"
    s = int(round(seconds))
    if s < 60:
        return f"{s} s"
    m = s // 60
    if m < 60:
        return f"{m} min"
    h, m = divmod(m, 60)
    if h < 48:
        return f"{h} h {m:02d} min"
    return f"{h // 24} d {h % 24} h"


_SUP = str.maketrans("-0123456789", "⁻⁰¹²³⁴⁵⁶⁷⁸⁹")


def _sci(x) -> str:
    if not isinstance(x, (int, float)):
        return "—"
    if x == 0:
        return "0"
    m, e = f"{x:.2e}".split("e")
    return f"{float(m):.2g} × 10{str(int(e)).translate(_SUP)}"


def _iso(ts) -> str | None:
    if not isinstance(ts, (int, float)):
        return None
    return datetime.fromtimestamp(ts).astimezone().isoformat(timespec="seconds")


def _median_recent(series, n: int = 3) -> float | None:
    vals = [v for _, v in (series or [])[-n:] if isinstance(v, (int, float)) and v > 0]
    if not vals:
        return None
    vals.sort()
    return vals[len(vals) // 2]


def hud_document(state: dict, *, now: float | None = None, with_help: bool = False) -> dict:
    """Every key value of the run as one labelled field — ``{label, value,
    unit, display, help}`` under a stable name — plus the list of checks.
    The panel renders its tiles from this document and marks each element
    with ``data-field``; an agent reads the same fields here. Unknown values
    are ``null`` (shown as —), never 0. Never raises over a missing piece."""
    now = now or time.time()
    s = state
    facts = s.get("facts") or {}
    tr = s.get("trainer") or {}
    series = s.get("series") or {}
    settings = facts.get("settings") or {}
    fields: dict[str, dict] = {}

    def F(name, label, value, unit=None, display=None, help_key=None):
        if display is None:
            if value is None:
                display = "—"
            elif isinstance(value, bool):
                display = "yes" if value else "no"
            elif isinstance(value, int):
                display = _num(value)
            elif isinstance(value, float):
                display = _num(value, 1)
            else:
                display = str(value)
        fields[name] = {"label": label, "value": value, "unit": unit, "display": display,
                        "help": help_key or name}

    # -- the run ---------------------------------------------------------------
    status = s.get("status") or "starting"
    F("run_status", "Status", status, display=status, help_key="status")
    F("run_name", "Run", s.get("run_name"), help_key="status")
    F("run_label", "Label", facts.get("label"), help_key="status")
    F("config_hash", "Config", (s.get("config_hash") or "")[:12] or None, help_key="settings")
    F("stage", "Stage", s.get("stage") or None, help_key="status")
    started = _ts(facts.get("started"))
    F("started_at", "Started", _iso(started), display=(
        datetime.fromtimestamp(started).strftime("%H:%M") if started else "—"), help_key="status")
    F("elapsed_s", "Running for", round(now - started) if started else None, "s",
      display=_dur(now - started) if started else "—", help_key="status")
    upd = s.get("updated")
    F("data_age_s", "Last new data", round(max(0.0, now - upd)) if upd else None, "s",
      display=(_dur(max(0.0, now - upd)) + " ago") if upd else "—", help_key="data_age")
    F("process_alive", "Process", s.get("alive"), display={True: "running", False: "gone"}.get(
        s.get("alive"), "—"), help_key="data_age")

    # -- languages, model, data --------------------------------------------------
    lang = facts.get("languages") or {}
    F("source_language", "Source language", lang.get("from"), help_key="source_language")
    tgt = lang.get("to")
    F("target_language", "Target language", tgt,
      display=(f"{tgt} ({lang['to_code']})" if tgt and lang.get("to_code") else (tgt or "—")),
      help_key="target_language")
    model = facts.get("model") or {}
    F("model_name", "Model", model.get("name"), help_key="model")
    F("model_base", "Base model", model.get("base"), help_key="model")
    F("model_preset", "Preset", model.get("preset"), help_key="model")
    F("model_backend", "Trainer", model.get("backend"), help_key="model")
    params = s.get("parameters") or {}
    pc = params.get("count")
    F("parameters_trained", "Parameters trained", pc, "parameters",
      display=(f"{pc / 1e6:,.1f} M" if pc else "—"), help_key="parameters_trained")
    F("parameters_trained_kind", "Trained", params.get("kind"),
      display={"all": "all weights", "adapter": "adapter only"}.get(params.get("kind"), "—"),
      help_key="parameters_trained")
    t = facts.get("training") or {}
    F("training_pairs", "Training pairs", t.get("pairs"), "pairs", help_key="training_pairs")
    gen = sum(int(e.get("pairs") or 0) for e in t.get("generated") or [] if isinstance(e, dict)) or None
    F("generated_pairs", "Generated pairs", gen, "pairs", help_key="training_pairs")
    files = t.get("files") or []
    corpus = t.get("corpus") or " + ".join(sorted({str(e["corpus"]) for e in files if e.get("corpus")})) or None
    licence = t.get("licence") or " + ".join(sorted({str(e["licence"]) for e in files if e.get("licence")})) or None
    F("training_corpus", "Corpus", corpus, help_key="terms")
    F("training_licence", "Licence", licence, help_key="terms")
    aw, mw = t.get("avg_words") or {}, t.get("median_words") or {}
    F("source_words_mean", "Source length (mean)", aw.get("source"), "words", help_key="pair_length")
    F("target_words_mean", "Target length (mean)", aw.get("target"), "words", help_key="pair_length")
    F("source_words_median", "Source length (median)", mw.get("source"), "words", help_key="pair_length")
    F("target_words_median", "Target length (median)", mw.get("target"), "words", help_key="pair_length")
    F("target_bytes_mean", "Target bytes (mean)", t.get("avg_target_bytes"), "bytes", help_key="pair_length")
    L = facts.get("length_limits") or {}
    cut = L.get("target_cut") if isinstance(L.get("target_cut"), int) else None
    rows = L.get("rows") if isinstance(L.get("rows"), int) and L.get("rows") else None
    share = (100 * cut / rows) if cut is not None and rows else None
    F("too_long_pairs", "Cut by the length limit", cut, "pairs",
      display=(f"{_num(cut)} ({'under 0.1' if 0 < share < 0.1 else f'{share:.1f}'}%)" if share is not None else "—"),
      help_key="too_long")
    F("length_limit_tokens", "Length limit", L.get("max_tgt"), "tokens", help_key="too_long")
    dev = facts.get("dev") or {}
    F("dev_pairs", "Dev pairs", dev.get("sentences"), "pairs", help_key="dev_pairs")
    F("dev_set", "Dev set", dev.get("name"), help_key="dev_pairs")
    F("check_rows", "Read per check", s.get("score_rows"), "pairs", help_key="dev_pairs")

    # -- progress -------------------------------------------------------------------
    pts = s.get("points") or []
    done = s.get("live_step") or tr.get("global_step") or (pts[-1]["step"] if pts else None)
    planned = s.get("planned_steps") or tr.get("max_steps")
    F("steps_done", "Steps done", done, "steps", help_key="steps")
    F("steps_planned", "Steps planned", planned, "steps", help_key="steps")
    F("progress_pct", "Progress", round(100 * done / planned, 1) if done and planned else None, "%",
      display=(f"{100 * done / planned:.0f}%" if done and planned else "—"), help_key="steps")
    epochs_planned = tr.get("num_train_epochs") or facts.get("epochs")
    spe = (planned / epochs_planned) if planned and epochs_planned else None
    ep_done = round(done / spe, 2) if done and spe else tr.get("epoch")
    F("epochs_done", "Passes done", ep_done, "passes",
      display=(f"{ep_done:,.1f}" if isinstance(ep_done, (int, float)) else "—"), help_key="passes")
    F("epochs_planned", "Passes planned", epochs_planned, "passes", help_key="passes")
    bs = tr.get("train_batch_size") or settings.get("batch_size")
    ga = settings.get("grad_accum")
    eff = settings.get("effective_batch") or (bs * ga if bs and ga else None)
    F("effective_batch", "Pairs per step", eff, "pairs",
      display=(f"{eff} ({bs} × {ga})" if eff and bs and ga else (str(eff) if eff else "—")),
      help_key="effective_batch")
    every = s.get("eval_steps") or tr.get("eval_steps")
    # a check = an evaluation on the dev pairs: its dev score (chrF++) when the run scores
    # translations, else only its dev loss (a run that keeps its checkpoint by loss)
    by_step: dict = {}
    for p in pts:
        if "dev_score" in p or "dev_loss" in p:
            c = by_step.setdefault(p["step"], {"step": p["step"], "dev_score": None, "dev_loss": None})
            if isinstance(p.get("dev_score"), (int, float)):
                c["dev_score"] = round(float(p["dev_score"]), 2)
            if isinstance(p.get("dev_loss"), (int, float)):
                c["dev_loss"] = round(float(p["dev_loss"]), 4)
    checks = [by_step[k] for k in sorted(by_step)]
    secs_at = dict((st, v) for st, v in series.get("check_seconds") or [])
    by_score = any(c["dev_score"] is not None for c in checks)
    measure = "dev_score" if by_score else "dev_loss"
    best_c = None
    for i, c in enumerate(checks, 1):
        c["n"], c["seconds"] = i, secs_at.get(c["step"])
        v = c[measure]
        if v is None:
            c["new_best"] = False
            continue
        c["new_best"] = best_c is None or (v > best_c[measure] if by_score else v < best_c[measure])
        if c["new_best"]:
            best_c = c
    for c in checks:
        c["best"] = c is best_c
    scored = [c for c in checks if c["dev_score"] is not None]
    best = best_c if by_score else None
    F("checks_done", "Checks done", len(checks) if checks or done else None, "checks", help_key="checks")
    checks_planned = int(planned // every) if planned and every else None
    F("checks_planned", "Checks planned", checks_planned, "checks", help_key="checks")
    F("check_every_steps", "A check every", every, "steps", help_key="checks")
    rate = _median_recent(series.get("sec_per_step")) or s.get("sec_per_it")
    F("sec_per_step", "Speed", round(rate, 3) if rate else None, "s/step",
      display=(f"{rate:.1f} s/step" if rate and rate >= 1 else f"{rate:.2f} s/step" if rate else "—"),
      help_key="speed")
    running = status in ("training", "starting")
    nxt = (done - done % every + every) if running and done is not None and every else None
    if nxt is not None and planned and nxt > planned:
        nxt = None
    F("next_check_step", "Next check at", nxt, "step",
      display=(f"step {_num(nxt)}" if nxt else "—"), help_key="next_check")
    # the step counts are as old as the newest data (attached without the log: the newest
    # checkpoint); the time since then has already been spent on the steps that follow
    lag = max(0.0, now - s["updated"]) if running and isinstance(s.get("updated"), (int, float)) else 0.0
    nci = max(0.0, (nxt - done) * rate - lag) if nxt and rate else None
    F("next_check_in_s", "Next check in", round(nci) if nci is not None else None, "s",
      display=("due now" if nci == 0 else _dur(nci)) if nci is not None else "—", help_key="next_check")
    eta = max(0.0, (planned - done) * rate - lag) if running and rate and planned and done is not None else None
    F("eta_s", "Time left", round(eta) if eta is not None else None, "s",
      display=_dur(eta) if eta is not None else "—", help_key="eta")
    F("finish_at", "Would end at", _iso(now + eta) if eta is not None else None,
      display=(datetime.fromtimestamp(now + eta).strftime("%a %H:%M") if eta is not None else "—"),
      help_key="eta")
    F("earliest_stop_step", "Earliest stop", s.get("floor_steps") or None, "step",
      display=(f"step {_num(s['floor_steps'])}" if s.get("floor_steps") else "none"), help_key="earliest_stop")

    # -- the score ------------------------------------------------------------------
    latest = scored[-1] if scored else None
    prev = scored[-2] if len(scored) > 1 else None
    F("dev_score_latest", "Latest check", latest["dev_score"] if latest else None, "chrF++",
      display=(f"{latest['dev_score']:.1f}" if latest else "—"), help_key="dev_score_latest")
    F("dev_score_latest_step", "Latest check at", latest["step"] if latest else None, "step",
      display=(f"step {_num(latest['step'])}" if latest else "—"), help_key="check_at_step")
    ch = round(latest["dev_score"] - prev["dev_score"], 2) if latest and prev else None
    F("dev_score_change", "Change", ch, "chrF++ points",
      display=(f"{ch:+.1f}".replace("-", "\u2212") if ch is not None else "—"), help_key="dev_score_latest")
    F("dev_score_best", "Best dev score", best["dev_score"] if best else None, "chrF++",
      display=(f"{best['dev_score']:.1f}" if best else "—"), help_key="dev_score_best")
    F("dev_score_best_step", "Best at", best["step"] if best else None, "step",
      display=(f"step {_num(best['step'])}" if best else "—"), help_key="dev_score_best")
    F("dev_score_best_check", "Best check", best["n"] if best else None, "check",
      display=(f"check {best['n']} of {len(checks)}" if best else "—"), help_key="dev_score_best")
    floor = (s.get("floor") or {}).get("score")
    fci = (s.get("floor") or {}).get("ci")
    F("dictionary_floor", "Dictionary floor", floor, "chrF++",
      display=(f"{floor:.1f}" if isinstance(floor, (int, float)) else "—"), help_key="dictionary_floor")
    F("dictionary_floor_ci", "Floor 95% range", fci if isinstance(fci, list) else None, "chrF++",
      display=(f"95% {fci[0]:.1f}–{fci[1]:.1f}" if isinstance(fci, list) and len(fci) == 2
               and all(isinstance(v, (int, float)) for v in fci) else "—"), help_key="dictionary_floor")
    above = (best["dev_score"] > floor) if best and isinstance(floor, (int, float)) else None
    F("above_floor", "Above the floor", above, help_key="dictionary_floor")
    since = sum(1 for c in checks if best_c and c["n"] > best_c["n"])
    patience = s.get("patience") or tr.get("patience") or settings.get("patience")
    used = tr.get("patience_used") if isinstance(tr.get("patience_used"), int) else (since if checks else None)
    F("patience_used", "Patience used", used, "checks", display=(
        f"{used} of {patience}" if used is not None and patience else (str(used) if used is not None else "—")),
      help_key="patience")
    F("patience_limit", "Patience", patience, "checks", help_key="patience")
    if status == "done":
        verdict, vlabel = "done", "Done"
    elif status in ("stopped", "aborted"):
        verdict, vlabel = "stopped", "Stopped"
    elif not checks:
        verdict, vlabel = "warming_up", "Before the first check"
    elif since == 0:
        verdict, vlabel = "improving", "Improving"
    elif patience and since >= patience:
        verdict, vlabel = "stopping", "Stopping — patience used"
    else:
        verdict, vlabel = "levelling_off", f"Levelling off — {since} without a new best"
    F("verdict", "Trend", verdict, display=vlabel, help_key="verdict")
    lastt = next((p["train_loss"] for p in reversed(pts) if "train_loss" in p), None)
    lastd = next((p["dev_loss"] for p in reversed(pts) if "dev_loss" in p), None)
    F("train_loss_latest", "Train loss", round(lastt, 3) if isinstance(lastt, (int, float)) else None, "loss",
      display=(f"{lastt:.2f}" if isinstance(lastt, (int, float)) else "—"), help_key="loss_chart")
    F("dev_loss_latest", "Dev loss", round(lastd, 3) if isinstance(lastd, (int, float)) else None, "loss",
      display=(f"{lastd:.2f}" if isinstance(lastd, (int, float)) else "—"), help_key="loss_chart")
    lr_now = (series.get("lr") or [[None, None]])[-1][1]
    F("learning_rate_now", "Learning rate now", lr_now, "per step", display=_sci(lr_now), help_key="learning_rate")
    F("learning_rate_peak", "Peak learning rate", settings.get("lr"), "per step",
      display=_sci(settings.get("lr")), help_key="learning_rate")
    wr = settings.get("warmup_ratio")
    F("warmup_steps", "Warm-up", round(wr * planned) if isinstance(wr, (int, float)) and planned else None,
      "steps", display=(f"{_num(round(wr * planned))} steps ({wr * 100:.0f}%)"
                        if isinstance(wr, (int, float)) and planned else "—"), help_key="learning_rate")
    gn = (series.get("grad_norm") or [[None, None]])[-1][1]
    F("grad_norm_latest", "Gradient norm", round(gn, 2) if isinstance(gn, (int, float)) else None,
      display=(f"{gn:.2f}" if isinstance(gn, (int, float)) else "—"), help_key="grad_norm")
    final = s.get("final") or {}
    fd = final.get("dev_chrf") or {}
    ci = fd.get("ci") if isinstance(fd.get("ci"), list) else None
    F("final_dev_score", "Final dev score", fd.get("score"), "chrF++",
      display=(f"{fd['score']:.1f}" if isinstance(fd.get("score"), (int, float)) else "—"),
      help_key="final_dev_score")
    F("final_dev_score_ci", "95% range", ci, "chrF++",
      display=(f"95% {ci[0]:.1f}–{ci[1]:.1f}" if ci and all(isinstance(v, (int, float)) for v in ci) else "—"),
      help_key="final_dev_score")
    F("kept_checkpoint", "Kept", final.get("selected"), help_key="checkpoints")
    F("stop_reason", "Why it ended", final.get("stop_explanation") or None, help_key="stop_reason")

    # -- the machine, where, cost ----------------------------------------------------
    mach = s.get("machine") or {}
    gpu = final.get("gpu_memory") if isinstance(final.get("gpu_memory"), dict) else {}
    limit, limit_kind = (gpu.get("cap_gb"), "forge's graphics-memory cap") if gpu.get("cap_gb") else (
        mach.get("memory_total_gb"), "this computer's memory")
    F("memory_used_gb", "Memory used", mach.get("memory_now_gb"), "GB",
      display=(f"{mach['memory_now_gb']:.1f} GB" if mach.get("memory_now_gb") is not None else "—"),
      help_key="memory")
    F("memory_peak_gb", "Highest", mach.get("memory_peak_gb"), "GB",
      display=(f"{mach['memory_peak_gb']:.1f} GB" if mach.get("memory_peak_gb") is not None else "—"),
      help_key="memory")
    F("memory_limit_gb", "Limit", limit, "GB", display=(f"{limit:.0f} GB" if limit else "—"), help_key="memory")
    F("memory_limit_kind", "Limit is", limit_kind if limit else None, help_key="memory")
    if settings.get("mps_memory_fraction") is not None:
        F("memory_cap_setting", "Graphics cap", settings["mps_memory_fraction"], "× recommended",
          display=f"{settings['mps_memory_fraction']:g} × recommended", help_key="memory")
    w = s.get("where") or {"kind": "local", "sovereignty": "sovereign"}
    F("sovereignty", "Where it runs", w.get("sovereignty"), help_key="where")
    if w.get("kind") == "remote":
        dc = w.get("datacenter") or ", ".join(w.get("datacenters") or []) or None
        provider = {"runpod": "RunPod"}.get(str(w.get("provider") or ""), w.get("provider"))
        F("where_detail", "Machine", " · ".join(str(x) for x in (provider, w.get("gpu"), dc) if x) or None,
          help_key="where")
        F("cost_usd", "Cost so far", w.get("usd"), "USD",
          display=(f"${w['usd']:.2f}" if isinstance(w.get("usd"), (int, float)) else "—"), help_key="cost")
        F("cost_cap_usd", "Cap", w.get("cap_usd"), "USD",
          display=(f"${w['cap_usd']:.2f}" if isinstance(w.get("cap_usd"), (int, float)) else "—"), help_key="cost")
        F("cost_per_hour_usd", "Price", w.get("usd_per_hour"), "USD/h",
          display=(f"${w['usd_per_hour']:.2f}/h" if isinstance(w.get("usd_per_hour"), (int, float)) else "—"),
          help_key="cost")
        # what waiting costs: the estimate so far plus the time left at the hourly price
        proj = (w["usd"] + eta / 3600 * w["usd_per_hour"]) if w.get("ended") is False and eta is not None \
            and _finite(w.get("usd")) and _finite(w.get("usd_per_hour")) else None
        F("cost_projected_usd", "Cost at the planned end", round(proj, 2) if proj is not None else None, "USD",
          display=(f"→ ${proj:.2f}" if proj is not None else "—"), help_key="cost")
    else:
        F("where_detail", "Machine", "this computer", help_key="where")

    # -- guardrails, checkpoints --------------------------------------------------------
    g = s.get("guardrails") or {}
    dv = g.get("dev") or {}
    reads = dv.get("reads") or {}
    F("dev_reads", "Dev pair reads", sum(reads.values()) if dv else None, "reads",
      display=(", ".join(f"{n} {p.replace('-', ' ')}" for p, n in sorted(reads.items())) or "none")
      if dv else "—", help_key="dev_reads")
    tests = g.get("tests") or []
    tr_since = [x.get("reads_since_start") for x in tests if isinstance(x.get("reads_since_start"), int)]
    F("test_sets", "Test sets", len(tests) if g.get("registry_found") else None, "sets", help_key="test_reads")
    F("test_reads_since_start", "Test reads", sum(tr_since) if tr_since else (0 if g.get("registry_found") and
                                                                              not tests else None), "reads",
      help_key="test_reads")
    la = g.get("leak_audit") or {}
    hits = sum(v.get("exact_source", 0) + v.get("exact_target", 0) for v in la.values()) if la else None
    F("leak_exact_matches", "Leak audit", hits, "pairs",
      display=(f"{hits} exact" if hits is not None else "after the run"), help_key="leak_audit")
    F("preregistrations", "Predictions", g.get("preregistrations"), "written", help_key="preregistrations")
    ck = s.get("checkpoints") or []
    F("checkpoints_on_disk", "On disk", len(ck) if ck else None, "checkpoints", help_key="checkpoints")
    F("checkpoints_gb", "Disk used", round(sum(c.get("bytes", 0) for c in ck) / _GB, 2) if ck else None, "GB",
      display=(f"{sum(c.get('bytes', 0) for c in ck) / _GB:.1f} GB" if ck else "—"), help_key="checkpoints")
    bstep = tr.get("best_step") or (best["step"] if best else None)
    bname = next((c["name"] for c in ck if c["step"] == bstep), None) if bstep else None
    F("best_checkpoint", "Best during training", bname or (f"checkpoint-{bstep}" if bstep else None), help_key="checkpoints")

    # -- when it stops, and whether waiting pays -------------------------------------------
    stop_at = None
    if running and best_c and patience and every:
        stop_at = best_c["step"] + patience * every
        fs = s.get("floor_steps")
        if isinstance(fs, int) and fs > stop_at:          # never before the earliest stop: the first check after it
            stop_at = -(-fs // every) * every
    past_end = bool(stop_at and planned and stop_at > planned)
    F("stop_by_patience_step", "Stops by patience at", stop_at, "step",
      display=("past the end" if past_end else f"step {_num(stop_at)}") if stop_at else "—",
      help_key="patience_stop")
    spi = max(0.0, (stop_at - done) * rate - lag) if stop_at and not past_end and rate and done is not None else None
    F("stop_by_patience_in_s", "Stops by patience in", round(spi) if spi is not None else None, "s",
      display=_dur(spi) if spi is not None else "—", help_key="patience_stop")
    tail = [c["dev_score"] for c in scored[-4:]]
    gain = round((tail[-1] - tail[0]) / (len(tail) - 1), 2) if len(tail) >= 2 else None
    F("dev_score_recent_gain", "Recent gain", gain, "chrF++ points per check",
      display=(f"{gain:+.1f}/check".replace("-", "\u2212") if gain is not None else "—"), help_key="recent_gain")

    # -- run health: one reading per question (ok / watch / alert; None = cannot tell yet) ---
    health = []

    def H(key, label, state, text):
        health.append({"key": key, "field": f"health_{key}", "label": label, "state": state, "text": text})
        F(f"health_{key}", label, state, display=text, help_key=f"health_{key}")

    if verdict == "improving":
        hs = ("ok", "new best")
    elif verdict == "levelling_off":
        hs = ("watch", f"{since} without a new best")
    elif verdict == "stopping":
        hs = ("watch", "patience used up")
    elif verdict == "done":
        hs = ("ok", "done")
    elif verdict == "stopped":
        hs = ("watch", "stopped")
    else:
        hs = (None, "before the first check")
    H("score", "Dev score" if by_score or not checks else "Dev loss", *hs)
    train_pts = [(p["step"], p["train_loss"]) for p in pts if "train_loss" in p]
    H("learning", "Training loss", *_health_learning(train_pts))
    H("overfit", "Overfit check", *_health_overfit(checks, since, by_score))
    H("stability", "Gradients", *_health_stability(series.get("grad_norm") or []))
    used_gb = mach.get("memory_now_gb")
    share = (used_gb / limit) if _finite(used_gb) and _finite(limit) and limit > 0 else None
    remote_live = w.get("kind") == "remote" and w.get("ended") is False
    H("memory", "Memory", _share_state(share, 0.8, 0.95),
      f"{share * 100:.0f}% of {limit:.0f} GB" if share is not None else (
          "not read remotely" if remote_live else "read while it trains" if status in ("done", "stopped", "aborted")
          else "not readable"))
    upd = s.get("updated")
    age = max(0.0, now - upd) if isinstance(upd, (int, float)) else None
    if remote_live:
        expected = 90.0                                  # the remote lane reads the machine every 30 s
    elif s.get("live_step") is not None or s.get("mode") == "live":
        expected = max(30.0, (tr.get("logging_steps") or 50) * rate) if rate else 120.0
    else:                                                # attached without the log: one update per checkpoint
        expected = max(60.0, every * rate) if every and rate else None
    if status == "done":
        hf = ("ok", "finished")
    elif status in ("stopped", "aborted"):
        hf = ("watch", "stopped")
    elif s.get("alive") is False:
        hf = ("alert", "process gone")
    elif age is None:
        hf = (None, "waiting for the rented machine" if remote_live else "waiting for numbers")
    elif expected is None:
        hf = (None, f"{_dur(age)} ago")
    else:
        hf = ("ok" if age <= 1.5 * expected else "watch" if age <= 3 * expected else "alert", f"{_dur(age)} ago")
    H("freshness", "Heartbeat", *hf)
    F("heartbeat_expected_s", "Usually every", round(expected) if expected and status in ("training", "starting") else None,
      "s", display=(f"every ~{_dur(expected)}" if expected and status in ("training", "starting") else "—"),
      help_key="health_freshness")
    usd, cap = w.get("usd"), w.get("cap_usd")
    cshare = (usd / cap) if _finite(usd) and _finite(cap) and cap > 0 else None
    H("cost", "Cost", _share_state(cshare, 0.7, 0.9) if w.get("kind") == "remote" else None,
      f"${usd:.2f} of ${cap:.2f}" if cshare is not None else ("not rented" if w.get("kind") != "remote" else "—"))
    known = [h["state"] for h in health if h["state"]]
    worst = max(known, key=lambda x: _RANK[x]) if known else None
    nw, na = known.count("watch"), known.count("alert")
    F("health_overall", "Run health", worst, display=(
        "all ok" if worst == "ok" else " · ".join(x for x in (f"{nw} to watch" if nw else "",
                                                          f"{na} alert{'s' if na != 1 else ''}" if na else "") if x))
      if worst else "—", help_key="health")

    doc = {"schema": HUD_SCHEMA, "generated_at": _iso(now), "version": s.get("version"),
           "mode": s.get("mode"), "stop_available": bool(s.get("can_stop", s.get("mode") == "live")),
           "fields": fields, "checks": checks, "checks_measure": measure if checks else None,
           "checkpoints": [{k: c.get(k) for k in ("name", "stage", "step", "bytes")} for c in ck],
           "finalists": final.get("finalists") or [], "where": w,
           "settings": settings, "health": health}
    if with_help:
        doc["help"] = HELP
    return doc


# -- the server ---------------------------------------------------------------------

def _json_safe(o):
    if isinstance(o, float):
        return o if math.isfinite(o) else None
    if isinstance(o, dict):
        return {k: _json_safe(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_json_safe(v) for v in o]
    return o


def _dumps(obj) -> bytes:
    """JSON a browser can parse: a loss that is not a number (the run that most needs the
    panel) is sent as null — Python's NaN/Infinity are not JSON, and one would blank the page.
    The HUD's health readings see the raw values and say "not a number"."""
    try:
        return json.dumps(obj, allow_nan=False, default=str).encode()
    except ValueError:
        return json.dumps(_json_safe(obj), default=str).encode()


class RunMonitor:
    """Serves the panel; collects points; carries the human stop flag."""

    def __init__(self, run_dir: str | Path, run_name: str, config_hash: str,
                 *, port: int = 0, open_browser: bool = True,
                 stop_pid: int | None = None, enrich: bool | None = None,
                 memory_pid: int | None = None):
        self.run_dir = Path(run_dir)
        self._lock = threading.Lock()
        self._state = {
            "run_name": run_name,
            "config_hash": config_hash,
            "status": "starting",       # starting|training|done|aborted|stopped
            "stage": "",
            "floor_steps": None,
            "planned_steps": None,
            "points": [],               # {step, train_loss?, dev_loss?, dev_score?}
            "floor": None,              # {score, ci} — the dictionary floor on this dev set
            "eval_steps": None,         # a check every this many steps
            "patience": None,           # checks without a new best before it stops
            "scored": None,             # True: the dev translations are scored at each check
            "score_rows": None,         # how many dev rows the in-training score reads
            "events": [],               # {t, text}
            "stop_requested": False,
            # what the run is training — names, counts, averages; never a
            # sentence (run_facts.describe_run; empty until known)
            "facts": {},
            # 2026-10-14 dashboard: [step, value] series beside the points, and
            # what the run folder / workspace / manifest say (the _Enricher)
            "series": {"lr": [], "grad_norm": [], "sec_per_step": [], "memory_gb": []},
            "mode": "live" if stop_pid is None and enrich is not False else "attach",
            "version": 0,               # bumped on every change: /status?v=N answers "same"
            "updated": None,            # epoch seconds of the last new training data
            "started_panel": time.time(),
        }
        self._stop_pid = stop_pid
        self._rate_last: tuple[float, int] | None = None
        live = enrich if enrich is not None else True
        self._enricher = _Enricher(self.run_dir, memory_pid=memory_pid or (os.getpid() if live else None),
                                   live=live)
        monitor = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):   # keep the training log clean
                pass

            def _send(self, code, body: bytes, ctype: str):
                self.send_response(code)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                path, _, query = self.path.partition("?")
                if path == "/status":
                    m = re.search(r"(?:^|&)v=(\d+)", query)
                    with monitor._lock:
                        v = monitor._state["version"]
                        if m and int(m.group(1)) == v:
                            body = _dumps({"version": v, "same": True, "now": time.time()})
                        else:
                            body = _dumps({**monitor._state, "now": time.time()})
                    self._send(200, body, "application/json")
                elif path == "/hud.json":
                    m = re.search(r"(?:^|&)v=(\d+)", query)
                    with monitor._lock:
                        v = monitor._state["version"]
                        if m and int(m.group(1)) == v:
                            doc = {"version": v, "same": True}
                        else:
                            doc = hud_document(monitor._state, with_help="help=1" in query)
                    self._send(200, _dumps(doc), "application/json")
                elif path == "/runs":
                    try:
                        body = _dumps(runs_overview(monitor.run_dir))
                    except Exception as e:
                        body = json.dumps({"runs": [], "error": type(e).__name__}).encode()
                    self._send(200, body, "application/json")
                elif path in ("/", "/index.html"):
                    self._send(200, PANEL_HTML.encode(), "text/html; charset=utf-8")
                else:
                    self._send(404, b"{}", "application/json")

            def do_POST(self):
                if self.path.startswith("/stop"):
                    monitor.request_stop()
                    self._send(200, b'{"ok": true}', "application/json")
                else:
                    self._send(404, b"{}", "application/json")

        self._server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        self._server.daemon_threads = True
        self.port = self._server.server_address[1]
        self._thread = threading.Thread(target=self._server.serve_forever,
                                        daemon=True)
        self._thread.start()
        self._closed = threading.Event()
        if live:                          # live mode: the run folder, re-read every 15 s
            threading.Thread(target=self._enrich_loop, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.port}"
        print(f"[monitor] live panel: {self.url} "
              "(read-only for humans; stop button only)", flush=True)
        if open_browser and monitor_enabled():
            try:
                webbrowser.open(self.url)
            except Exception:
                pass                      # headless is fine; URL is printed

    # -- state intake ---------------------------------------------------------

    def _touch(self, data_changed: bool = True) -> None:
        """Under the lock: a change the page should fetch."""
        self._state["version"] += 1
        if data_changed:
            self._state["updated"] = time.time()

    def emit(self, kind: str, **data) -> None:
        with self._lock:
            s = self._state
            if kind == "train_loss":
                s["points"].append({"step": data["step"],
                                    "train_loss": data["loss"]})
                s["status"] = "training"
            elif kind == "dev_loss":
                s["points"].append({"step": data["step"],
                                    "dev_loss": data["loss"]})
            elif kind == "dev_score":
                prev = [p["dev_score"] for p in s["points"] if "dev_score" in p]
                s["points"].append({"step": data["step"],
                                    "dev_score": data["score"]})
                new_best = not prev or data["score"] > max(prev)
                s["events"].append({"t": time.strftime("%H:%M:%S"), "text": (
                    f"check at step {data['step']:,}: dev score {data['score']:.1f}"
                    + (" — new best ★" if new_best else
                       f" (best so far {max(prev):.1f})"))})
            elif kind == "floor":
                s["floor"] = {"score": data.get("score"), "ci": data.get("ci")}
            elif kind == "facts":
                s["facts"] = {**s["facts"], **data}
            elif kind == "rate":
                s["sec_per_it"] = data.get("sec_per_it")
                s["live_step"] = data.get("step")
                # the pace between two reports (the rate itself is the run's average)
                step, t = data.get("step"), time.monotonic()
                if isinstance(step, int):
                    if self._rate_last and step > self._rate_last[1]:
                        s["series"]["sec_per_step"].append(
                            [step, round((t - self._rate_last[0]) / (step - self._rate_last[1]), 3)])
                        del s["series"]["sec_per_step"][:-5000]
                    self._rate_last = (t, step)
            elif kind == "stage":
                s["stage"] = data["name"]
                s["floor_steps"] = data.get("floor_steps")
                s["planned_steps"] = data.get("planned_steps")
                for k in ("eval_steps", "patience", "scored", "score_rows"):
                    if data.get(k) is not None:
                        s[k] = data[k]
                planned, every = data.get("planned_steps"), data.get("eval_steps")
                s["events"].append({"t": time.strftime("%H:%M:%S"), "text": (
                    f"training '{data['name']}' started: {planned or '?'} steps planned"
                    + (f", a check every {every:,} steps" if every else "")
                    + (f"; it may stop after {data['patience']} checks without a new best"
                       if data.get("patience") else "")
                    + (f", never before step {data['floor_steps']:,}"
                       if data.get("floor_steps") else ""))})
            elif kind == "done":
                s["status"] = data.get("status", "done")
                s["events"].append({"t": time.strftime("%H:%M:%S"),
                                    "text": data.get("text", "run complete")})
            else:
                s["events"].append({"t": time.strftime("%H:%M:%S"),
                                    "text": str(data.get("text", kind))})
            self._touch(kind in ("train_loss", "dev_loss", "dev_score", "rate"))
        if kind == "done":
            self.refresh()

    # -- enrichment (the run folder, workspace, manifest) ---------------------

    def refresh(self) -> None:
        """Re-read what the run folder says (cheap; never raises)."""
        with self._lock:
            step = self._state.get("live_step")
            if step is None and self._state["points"]:
                step = self._state["points"][-1]["step"]
            facts = dict(self._state["facts"])
        extra = self._enricher.collect(step=step, facts=facts)
        with self._lock:
            self._apply(extra)

    def _apply(self, extra: dict) -> None:
        """Under the lock: merge an _Enricher result into the state."""
        s = self._state
        before = json.dumps({k: s.get(k) for k in ("trainer", "checkpoints", "where", "guardrails",
                                                     "final", "machine", "parameters")},
                            sort_keys=True, default=str)
        series = extra.pop("series", {}) or {}
        for k, v in extra.items():
            s[k] = v
        for k, v in series.items():
            if k == "sec_per_step" and not v:
                continue
            if v or k not in s["series"]:
                s["series"][k] = v
        after = json.dumps({k: s.get(k) for k in ("trainer", "checkpoints", "where", "guardrails",
                                                    "final", "machine", "parameters")},
                           sort_keys=True, default=str)
        if before != after or series:
            self._touch(False)

    def _enrich_loop(self) -> None:
        while not self._closed.wait(ENRICH_SECONDS):
            try:
                self.refresh()
            except Exception:
                pass

    # -- the one human control ------------------------------------------------

    def request_stop(self) -> None:
        with self._lock:
            self._state["stop_requested"] = True
            self._state["events"].append(
                {"t": time.strftime("%H:%M:%S"),
                 "text": "⛔ HUMAN STOP requested from the panel"})
            self._touch(False)
        try:                              # cross-process breadcrumb
            (self.run_dir / STOP_BASENAME).write_text("stop\n")
        except OSError:
            pass
        if self._stop_pid:                # attach mode: kill the trainer
            try:
                os.kill(self._stop_pid, signal.SIGTERM)
            except OSError as e:
                self.emit("event", text=f"stop signal failed: {e}")

    def stop_requested(self) -> bool:
        with self._lock:
            if self._state["stop_requested"]:
                return True
        return (self.run_dir / STOP_BASENAME).exists()

    def shutdown(self) -> None:
        self._closed.set()
        self._server.shutdown()
        self._server.server_close()


# -- attach mode ---------------------------------------------------------------

_TQDM_STEP = re.compile(r"(\d+)/(\d+) \[")
_TQDM_RATE = re.compile(r"([\d.]+)(s/it|it/s)")
_LOSS_DICT = re.compile(r"\{'loss': ([\d.]+)")
_EVAL_DICT = re.compile(r"'eval_loss': ([\d.]+)")
_LOG_DICT = re.compile(r"\{'loss': [^{}]*\}")
_LOG_FIELD = re.compile(r"'(learning_rate|grad_norm)': '?([-+\d.eE]+)'?")


def _parse_train_log(log_path: Path, tail_bytes: int = 262_144) -> dict:
    """Live signal from the trainer's stdout BEFORE any checkpoint exists.

    HF prints a tqdm stream (``809/12774 [1:19:30<34:38, 10.41s/it]``) and a
    ``{'loss': …}`` dict every logging step — but the dict carries no global
    step, so each loss is paired with the nearest step fragment printed
    before it. Reads only the file tail; safe to call every poll. Beside the
    points: the learning rate and gradient norm of each logged step, and the
    pace (seconds per step) at each tqdm refresh — numbers only."""
    try:
        with open(log_path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - tail_bytes))
            text = f.read().decode("utf-8", "replace")
    except OSError:
        return {}
    steps = [(m.start(), int(m.group(1)), int(m.group(2)))
             for m in _TQDM_STEP.finditer(text)]
    if not steps:
        return {}

    def step_before(pos: int) -> int:
        best = steps[0][1]
        for s_pos, s, _ in steps:
            if s_pos > pos:
                break
            best = s
        return best

    points = []
    for m in _LOSS_DICT.finditer(text):
        points.append({"step": step_before(m.start()),
                       "train_loss": float(m.group(1))})
    for m in _EVAL_DICT.finditer(text):
        points.append({"step": step_before(m.start()),
                       "dev_loss": float(m.group(1))})
    # dedupe (a loss line can be re-printed across tqdm refreshes)
    seen, uniq = set(), []
    for p in points:
        key = tuple(sorted(p.items()))
        if key not in seen:
            seen.add(key)
            uniq.append(p)
    uniq.sort(key=lambda p: p["step"])
    lr, grad = {}, {}
    for m in _LOG_DICT.finditer(text):
        step = step_before(m.start())
        for f in _LOG_FIELD.finditer(m.group(0)):
            try:
                (lr if f.group(1) == "learning_rate" else grad)[step] = float(f.group(2))
            except ValueError:
                continue
    last_rate, rates = None, {}
    for m in _TQDM_RATE.finditer(text):
        val, unit = float(m.group(1)), m.group(2)
        last_rate = val if unit == "s/it" else (1.0 / val if val else None)
        if last_rate:
            rates[step_before(m.start())] = round(last_rate, 3)
    return {"points": uniq, "step": steps[-1][1], "planned": steps[-1][2],
            "sec_per_it": last_rate,
            "lr": sorted([k, v] for k, v in lr.items()),
            "grad_norm": sorted([k, v] for k, v in grad.items()),
            "rates": sorted([k, v] for k, v in rates.items())}


def _pid_alive(pid: int | None) -> bool | None:
    if not pid:
        return None
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _trainer_plan(run_dir: Path) -> dict:
    """What the newest HF ``trainer_state.json`` says of the run's plan:
    {eval_steps, planned_steps, patience} (whichever it records). An attached
    panel has no set_plan() call, and without these it said "one every 0
    steps" and could not say when the run ends (2026-10-13)."""
    newest = _newest_trainer_state(run_dir)
    if not newest:
        return {}
    plan = {"eval_steps": newest.get("eval_steps"), "planned_steps": newest.get("max_steps")}
    for cb in (newest.get("stateful_callbacks") or {}).values():
        p = (cb.get("args") or {}).get("early_stopping_patience") if isinstance(cb, dict) else None
        if p:
            plan["patience"] = p
    return {k: v for k, v in plan.items() if v}


def _newest_trainer_state(run_dir: Path) -> dict | None:
    """The trainer state with the highest global step under run_dir (each
    file parsed once per change)."""
    newest, newest_step = None, -1
    try:
        found = list(Path(run_dir).rglob("trainer_state.json"))
    except OSError:
        return None
    for ts in found:
        data = _read_json_cached(ts)
        if not isinstance(data, dict):
            continue
        try:
            step = int(data.get("global_step", 0))
        except (TypeError, ValueError):
            continue
        if step > newest_step:
            newest, newest_step = data, step
    return newest


def _harvest_trainer_state(run_dir: Path) -> list[dict]:
    """Points from the newest HF ``trainer_state.json`` under run_dir.

    Each checkpoint dump carries the FULL log_history to that step, so the
    newest file is the whole curve (train loss every logging step, eval loss
    every eval step)."""
    newest = _newest_trainer_state(run_dir)
    if not newest:
        return []
    points = []
    for entry in newest.get("log_history", []):
        step = int(entry.get("step", 0))
        if "loss" in entry:
            points.append({"step": step, "train_loss": entry["loss"]})
        if "eval_loss" in entry:
            points.append({"step": step, "dev_loss": entry["eval_loss"]})
        if "eval_chrf" in entry:
            points.append({"step": step, "dev_score": entry["eval_chrf"]})
    return points


def watch(run_dir: str | Path, *, pid: int | None = None, port: int = 8377,
          open_browser: bool = True, poll_seconds: float = 10.0,
          max_polls: int | None = None,
          log_path: str | Path | None = None) -> RunMonitor:
    """Attach to a running (or finished) run directory and serve the panel.

    ``log_path`` (the trainer's stdout log) makes the panel live from minute
    one — loss points every logging step plus step/rate/ETA — instead of
    waiting for the first checkpoint dump. ``pid`` is the ONLY process the
    stop button signals; without it the panel reads the trainer's memory from
    the workspace run lock and its stop button signals nothing."""
    run_dir = Path(run_dir)
    name = run_dir.name
    manifest = run_dir / "run-manifest.json"
    config_hash = ""
    if manifest.is_file():
        try:
            config_hash = json.loads(manifest.read_text()).get("config_hash", "")
        except (OSError, json.JSONDecodeError):
            pass
    ws_root = _workspace_root(run_dir)
    if not config_hash and ws_root is not None:
        lock = _read_json_cached(ws_root / "run.lock")
        if isinstance(lock, dict) and lock.get("config_hash") and _lock_pid(ws_root, run_dir):
            config_hash = str(lock["config_hash"])
    try:
        mon = RunMonitor(run_dir, name, config_hash, port=port,
                         open_browser=open_browser, stop_pid=pid, enrich=False, memory_pid=pid)
    except OSError:                      # port taken → any free port
        mon = RunMonitor(run_dir, name, config_hash, port=0,
                         open_browser=open_browser, stop_pid=pid, enrich=False, memory_pid=pid)
    with mon._lock:
        mon._state["mode"] = "attach"
        mon._state["can_stop"] = bool(pid)
        mon._state["run_dir"] = str(run_dir)
    mon.emit("event", text=f"attached to {name} "
             f"(pid {pid or 'not given — the stop button can signal nothing'}; reading every "
             f"{poll_seconds:.0f}s" + (f"; live-tailing {Path(log_path).name}" if log_path else "") + ")")
    # what the run is training: the run-facts.json the run wrote when it
    # started; a run an earlier forge started wrote none — rebuilt once from
    # its config (run lock or manifest). Re-read every poll: the trainer adds
    # its length-limit counts once it has made them.
    from .run_facts import read_facts, recover_facts

    if read_facts(run_dir) is None:
        recovered = recover_facts(run_dir)
        if recovered:
            mon.emit("facts", **recovered)

    def poll_loop():
        polls = 0
        last_rate_report = 0.0
        last_sig = None
        remote_pace: list[list] = []        # [step, s/step] between two readings of a rented machine
        last_prog: list = []
        while max_polls is None or polls < max_polls:
            polls += 1
            try:
                ckpt_points = _harvest_trainer_state(run_dir)
                log = _parse_train_log(Path(log_path)) if log_path else {}
                # checkpoint dumps are authoritative; log fills the gaps between
                points = ckpt_points or []
                have = {(p["step"], "train_loss" in p) for p in points}
                for p in log.get("points", []):
                    if (p["step"], "train_loss" in p) not in have:
                        points.append(p)
                points.sort(key=lambda p: p["step"])
                alive = _pid_alive(pid)
                plan = _trainer_plan(run_dir)
                facts = read_facts(run_dir)
                with mon._lock:
                    facts_now = facts or mon._state["facts"]
                    step_now = log.get("step") or (points[-1]["step"] if points else None)
                extra = mon._enricher.collect(step=step_now, facts=facts_now)
                sig = (len(points), points[-1] if points else None, log.get("step"),
                       ((extra.get("where") or {}).get("progress") or {}).get("changed"))
                with mon._lock:
                    if facts:
                        mon._state["facts"] = facts
                    if points:
                        mon._state["points"] = points
                        mon._state["status"] = "training"
                    for k, v in plan.items():          # set_plan() is the live run's; this, an attached one's
                        if not mon._state.get(k):
                            mon._state[k] = v
                    if log.get("planned"):
                        mon._state["planned_steps"] = (mon._state["planned_steps"]
                                                       or log["planned"])
                        mon._state["live_step"] = log.get("step")
                        mon._state["sec_per_it"] = log.get("sec_per_it")
                    series = extra.setdefault("series", {})
                    if log.get("rates"):
                        series["sec_per_step"] = log["rates"]
                    elif series.get("save_pace"):
                        series["sec_per_step"] = series["save_pace"]
                    for k in ("lr", "grad_norm"):
                        if not series.get(k) and log.get(k):
                            series[k] = log[k]
                    where = extra.get("where") or {}
                    if where.get("kind") == "remote" and where.get("ended") is False \
                            and mon._state["status"] == "starting":
                        mon._state["status"] = "training"       # training on the rented machine
                    prog = where.get("progress") if where.get("ended") is False else None
                    if isinstance(prog, dict):                  # the remote lane's 30-s reading of the machine
                        st_, ch_ = prog.get("step"), prog.get("changed")
                        if _number(st_) and _number(ch_) and (not last_prog or st_ != last_prog[0]):
                            if last_prog and st_ > last_prog[0] and ch_ > last_prog[1]:
                                remote_pace.append([int(st_), round((ch_ - last_prog[1]) / (st_ - last_prog[0]), 3)])
                                del remote_pace[:-500]
                            last_prog[:] = [st_, ch_]
                        if remote_pace and not series.get("sec_per_step"):
                            series["sec_per_step"] = list(remote_pace)
                        if _number(prog.get("step")):
                            mon._state["live_step"] = int(prog["step"])
                        if _number(prog.get("max_steps")) and prog["max_steps"] > 0:
                            mon._state["planned_steps"] = int(prog["max_steps"])
                        if prog.get("stage"):
                            mon._state["stage"] = f"remote: {prog['stage']}"
                    if alive is False and not manifest.is_file():
                        mon._state["status"] = "stopped"
                    if manifest.is_file():
                        mon._state["status"] = "done"
                    mon._state["alive"] = alive if pid else (
                        _pid_alive(_lock_pid(ws_root, run_dir)) if _lock_pid(ws_root, run_dir) else None)
                    mon._apply(extra)
                    if sig != last_sig:
                        mon._touch(bool(points))
                        last_sig = sig
                    if not log_path and mon._enricher.save_times and not isinstance(prog, dict):
                        # attached without the log: the newest numbers are as old as the newest checkpoint
                        mon._state["updated"] = max(mon._enricher.save_times.values())
                    if isinstance(prog, dict) and _number(prog.get("changed")):
                        # a rented machine's numbers are as old as its heartbeat's last move
                        mon._state["updated"] = float(prog["changed"])
                rate = log.get("sec_per_it")
                if rate and abs(rate - last_rate_report) > max(2.0, last_rate_report):
                    remaining = (log["planned"] - log["step"]) * rate
                    mon.emit("event", text=f"step {log['step']:,}/{log['planned']:,}"
                             f" at {rate:.1f}s/it — ~{remaining / 3600:.1f}h left "
                             "at this rate")
                    last_rate_report = rate
            except Exception as e:          # the panel never dies of a half-written file
                mon.emit("event", text=f"panel read error (retrying): {type(e).__name__}")
                alive = _pid_alive(pid)
            if manifest.is_file():
                mon.emit("done", text="run manifest present — training done")
                break
            if alive is False:
                mon.emit("done", status="stopped",
                         text="training process is gone and no manifest was "
                              "written — the run died or was killed")
                break
            time.sleep(poll_seconds)

    threading.Thread(target=poll_loop, daemon=True).start()
    return mon


def monitor_cli(args) -> int:
    mon = watch(args.run_dir, pid=args.pid, port=args.port,
                open_browser=not args.no_browser, log_path=args.log)
    print(f"[monitor] watching {args.run_dir} — Ctrl-C to detach "
          "(training keeps running)", flush=True)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        mon.shutdown()
        return 0
