"""Disk room: forge never fills the computer it runs on.

2026-10-13: a ByT5-small run kept 4 checkpoints at ~1.4 GB each, every improve
round added another 5.6 GB, nothing ever removed an old round's model, and the
disk filled — one training job died mid-save and the whole computer slowed.
Three answers:
  - a finished run keeps only its selected checkpoint (training.run.prune_checkpoints);
  - a run is refused before it starts when the disk cannot hold what it will
    write (``check_room``), with what ``nmt-forge tidy`` would free;
  - ``nmt-forge tidy`` removes the models of earlier rounds that nothing uses —
    never the model in use, the newest run, or the model the one in use
    replaced (the blind check drafts with it) — after listing them, and only
    with ``--yes``. A tidied run keeps its manifest and dev translations (the
    record); only its model weights go.
"""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from .errors import GuardrailViolation
from .workspace import Workspace

GB = 1024 ** 3
#: Never start training with less than this free, whatever the estimate.
FLOOR_BYTES = 2 * GB
#: Room kept beyond the estimate (the final dev decode, logs, an export).
MARGIN_BYTES = 1 * GB
#: Status says so when free space falls below this, or tidy would free more.
WARN_FREE_BYTES = 10 * GB
WARN_RECLAIM_BYTES = 5 * GB
TIDY_EVENT = "tidy"
_WEIGHTS = (".safetensors", ".bin", ".pt", ".ckpt")


class DiskRoomError(GuardrailViolation):
    guard = "disk-room"


def gb(n: int | None) -> str:
    return "unknown" if n is None else f"{n / GB:.1f} GB"


def dir_bytes(path: str | Path) -> int:
    total = 0
    for f in Path(path).rglob("*"):
        try:
            if f.is_file() and not f.is_symlink():
                total += f.stat().st_size
        except OSError:
            continue
    return total


def free_bytes(path: str | Path) -> int:
    """Free bytes on the disk holding ``path`` (its nearest existing folder)."""
    p = Path(path).resolve()
    while not p.exists() and p != p.parent:
        p = p.parent
    return shutil.disk_usage(p).free


def _weights_bytes(folder: Path) -> int:
    return sum(f.stat().st_size for f in folder.rglob("*")
               if f.is_file() and f.suffix in _WEIGHTS and not f.is_symlink())


def checkpoint_estimate(ws: Workspace, model: dict) -> int | None:
    """Bytes one checkpoint of this model takes: a finished run of the same
    base in this workspace (its kept checkpoint), else the base's own weights
    (a local folder, or the Hugging Face cache), else None (unknown)."""
    base = str(model.get("base") or "")
    for m in sorted(ws.runs_dir.glob("*/run-manifest.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            rec = json.loads(m.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        sel = rec.get("selected_path")
        if (rec.get("config") or {}).get("model", {}).get("base") == base and sel and Path(sel).is_dir():
            return dir_bytes(sel)
    if base and Path(base).expanduser().is_dir():
        return _weights_bytes(Path(base).expanduser()) or None
    if "/" in base:
        hub = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface")) / "hub"
        snap = hub / ("models--" + base.replace("/", "--")) / "snapshots"
        if snap.is_dir():
            sizes = [_weights_bytes(s) for s in snap.iterdir() if s.is_dir()]
            return (max(sizes) or None) if sizes else None
    return None


def check_room(ws: Workspace, model: dict, where: str | Path) -> dict:
    """Refuse a training run the disk cannot hold. Returns what was checked."""
    free = free_bytes(where)
    one = checkpoint_estimate(ws, model)
    kept = int(model.get("save_total_limit", 4))
    need = (one * kept if one else 0) + MARGIN_BYTES
    need = max(need, FLOOR_BYTES)
    rec = {"free_bytes": free, "checkpoint_bytes": one, "checkpoints_at_once": kept, "need_bytes": need}
    if free < need:
        plan = plan_tidy(ws)
        tidy = (f" `nmt-forge tidy` lists {gb(plan['bytes'])} it can free here (the models of earlier rounds "
                "nothing uses); `nmt-forge tidy --yes` frees it." if plan["bytes"] else "")
        raise DiskRoomError(
            f"this computer has {gb(free)} free; training this model needs about {gb(need)}"
            + (f" ({kept} checkpoints of about {gb(one)} each while it trains, and room to finish)" if one else
               " (at least that much must stay free whatever the model)"),
            why="a disk that fills mid-training loses the run as it saves, and slows the whole computer",
            fix=("free space first." + tidy + " Or move other files off this disk. If the estimate is wrong, "
                 "`nmt-forge run … --skip-disk-check` starts anyway (recorded in the run)."))
    return rec


def _in_use_and_kept(ws: Workspace, s: dict | None = None) -> tuple[set[str], dict]:
    """Manifests tidy never touches: the model in use, the newest run, the one
    the model in use replaced. Returns (resolved manifest paths, why each)."""
    from .advisor import _in_use_export, snapshot
    from .improve.draft import replaced_by_in_use
    from .improve.wishlist import newest_run

    keep: dict[str, str] = {}
    s = s if s is not None else snapshot(ws)
    servable = [e for e in s.get("exports", []) if e.get("dir") and e.get("model_included", True)]
    use = _in_use_export(s, servable)
    if use and use.get("manifest"):
        keep[str(Path(use["manifest"]).resolve())] = "the model in use"
    try:
        keep.setdefault(str(Path(newest_run(ws)).resolve()), "the newest run")
    except Exception:
        pass
    try:
        prev = replaced_by_in_use(ws)
        if prev and prev.get("manifest_path"):
            keep.setdefault(str(Path(prev["manifest_path"]).resolve()), "the model the one in use replaced")
    except Exception:
        pass
    return set(keep), keep


def plan_tidy(ws: Workspace, s: dict | None = None) -> dict:
    """What ``nmt-forge tidy`` would remove: {"runs": [{run, path, bytes}], "bytes",
    "kept": {manifest: why}}. Counts only; nothing is touched. ``s``: a status
    snapshot already made (advisor), so it is not made twice."""
    keep, why = _in_use_and_kept(ws, s)
    runs = []
    for m in sorted(ws.runs_dir.glob("*/run-manifest.json")):
        if str(m.resolve()) in keep:
            continue
        try:
            rec = json.loads(m.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        sel = rec.get("selected_path")
        if not sel or not Path(sel).is_dir() or rec.get("model_removed"):
            continue
        runs.append({"run": rec.get("run_name"), "manifest": str(m), "path": sel, "bytes": dir_bytes(sel)})
    return {"runs": runs, "bytes": sum(r["bytes"] for r in runs),
            "kept": {Path(k).parent.name: v for k, v in why.items()}}


def apply_tidy(ws: Workspace, plan: dict | None = None) -> dict:
    """Remove the planned runs' model weights; each manifest records it."""
    plan = plan or plan_tidy(ws)
    done, freed = [], 0
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for r in plan["runs"]:
        shutil.rmtree(r["path"], ignore_errors=True)
        if Path(r["path"]).exists():
            continue
        m = Path(r["manifest"])
        rec = json.loads(m.read_text(encoding="utf-8"))
        rec["model_removed"] = {"at": now, "by": "nmt-forge tidy", "bytes": r["bytes"],
                                "why": "a model of an earlier round nothing used; its record is kept"}
        tmp = m.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(rec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(tmp, m)
        done.append(r["run"])
        freed += r["bytes"]
    event = {"runs": len(done), "bytes": freed}
    ws.ledger.append(TIDY_EVENT, **event)
    return {**event, "removed": done}


def disk_warning(ws: Workspace, s: dict | None = None) -> str | None:
    """A status line when the disk is getting full or old models could go."""
    try:
        free = free_bytes(ws.root)
        plan = plan_tidy(ws, s)
    except Exception:
        return None
    if free >= WARN_FREE_BYTES and plan["bytes"] < WARN_RECLAIM_BYTES:
        return None
    msg = f"this computer has {gb(free)} free"
    if plan["bytes"]:
        msg += (f"; the models of {len(plan['runs'])} earlier round(s) nothing uses take {gb(plan['bytes'])} — "
                "`nmt-forge tidy` lists them, `nmt-forge tidy --yes` frees the space (the model in use, the "
                "newest and the one it replaced are kept)")
    return msg
