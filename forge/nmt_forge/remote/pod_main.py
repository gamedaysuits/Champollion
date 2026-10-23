"""What runs on the rented machine: forge's own ``run`` on the bundle the
local side sent (``lifecycle.build_bundle``). It builds a workspace that
knows only the dev set, writes the config with the bundle's paths, trains,
and writes ``done.json`` ({ok, run_dir, selected_path} or {ok: false,
error}). Progress goes to ``heartbeat.json`` (forge's own heartbeat), which
the local side reads over SSH. No test set is here: the dev fence and the
leak audit against the test sets ran on the people's computer, on the same
files, before anything was sent.

  python3 -m nmt_forge.remote.pod_main <job dir>
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path


def _write(path: Path, doc: dict) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(doc), encoding="utf-8")
    os.replace(tmp, path)


def main(job_dir: str) -> int:
    job = Path(job_dir).resolve()
    done = job / "done.json"
    try:
        spec = json.loads((job / "job.json").read_text(encoding="utf-8"))
        os.environ["NMT_FORGE_NO_MONITOR"] = "1"
        os.environ["NMT_FORGE_HEARTBEAT"] = str(job / "heartbeat.json")
        # the harness SENT with this forge, never one the machine happens to
        # have installed: they release together (the bundle's src/arena holds
        # only mt_eval_harness, so nothing else on the path is shadowed)
        shipped = job / "src" / "arena"
        if str(shipped) not in sys.path:
            sys.path.insert(0, str(shipped))
        sys.modules.pop("mt_eval_harness", None)
        from nmt_forge import _harness

        loaded = Path(_harness.load_harness().__file__).resolve()
        if shipped.resolve() not in loaded.parents:
            raise RuntimeError(f"the harness loaded from {loaded}, not the one sent with this forge ({shipped})")
        from nmt_forge.training.run import run
        from nmt_forge.workspace import Workspace

        ws = Workspace(job / "ws")
        dev = spec["dev"]
        ws.registry.register(dev["name"], job / dev["file"], "dev", source_field=dev["source_field"],
                             target_field=dev["target_field"])
        raw = spec["config"]
        raw["workspace"] = str(ws.root)
        data = raw.setdefault("data", {})
        data["gold"] = [str(job / g) for g in data.get("gold") or []]
        data["synthetic"] = [{**lane, "path": str(job / lane["path"])} for lane in data.get("synthetic") or []]
        data["dev"] = dev["name"]
        cfg_path = job / "config.json"
        cfg_path.write_text(json.dumps(raw, indent=2), encoding="utf-8")
        manifest = run(cfg_path)
        if spec.get("return_dtype") == "bf16":
            # half the size to send back: the chosen weights saved in bf16
            # (for decoding only; the run's record says so)
            import torch
            from transformers import AutoModelForSeq2SeqLM

            sel = Path(manifest["selected_path"])
            m = AutoModelForSeq2SeqLM.from_pretrained(sel, torch_dtype=torch.float32)
            m.to(torch.bfloat16).save_pretrained(sel, safe_serialization=True)
            for old in sel.glob("pytorch_model*.bin"):
                old.unlink()
        made = sorted(ws.runs_dir.glob("*/run-manifest.json"), key=lambda p: p.stat().st_mtime)
        _write(done, {"ok": True, "run_dir": str(made[-1].parent), "selected_path": manifest["selected_path"]})
        return 0
    except BaseException as e:                       # noqa: BLE001 — the local side must always learn the end
        _write(done, {"ok": False, "error": f"{type(e).__name__}: {e}"[:2000],
                      "trace": traceback.format_exc()[-4000:]})
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1]))
