"""``nmt-forge run config.json`` — one command, reproducible, fenced.

The runner is where the guards stop being a library and become the default:

1. config → hash (the run's identity, threaded through fence + manifests);
2. dev comes ONLY through the dev-fence (guard #2) — no dev, no training;
3. the mix builder runs every data guard (leak-audit, tags, exposure math,
   strata, conventions, do_not_train);
4. generation-headroom is checked against the fenced dev refs BEFORE any
   training compute is spent (guard #11);
5. checkpoint selection happens on the fenced dev, by loss or by a dev
   GENERATION metric via the harness (CIs included);
6. a curriculum is a sequence of stages (synthetic-pretrain →
   real-finetune), each with its own mix + manifest, each initializing from
   the previous stage's SELECTED checkpoint;
7. the run manifest records: raw config + hash, git commit, package
   versions, every data guard manifest, per-stage selection reports, and
   the final dev report (with CIs). Runs are comparable or they are noise.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from ..guards import ci_scoring
from ..guards.dev_fence import DevFence
from ..plugins import load_plugins
from ..registry import _looks_synthetic
from ..workspace import Workspace
from .backends import make_backend
from .config import RunConfig
from .mix import build_mix
from .schedule import explain_stop, plan_schedule
from .selection import check_generation_headroom, select_checkpoint


def _git_commit(near: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=near, capture_output=True,
            text=True, timeout=10,
        )
        return out.stdout.strip() if out.returncode == 0 else "not-a-git-repo"
    except Exception:
        return "unknown"


def run(config_path: str | Path, *, pack=None) -> dict:
    cfg = RunConfig.from_file(config_path)
    ch = cfg.hash()
    ws = Workspace(cfg.workspace)
    run_dir = ws.runs_dir / f"{cfg.run_name}-{ch[:8]}"
    run_dir.mkdir(parents=True, exist_ok=True)

    canonicalizer = pack.canonicalize if pack is not None else None
    conventions = pack.conventions() if pack is not None else None
    # target-validity gate: a pack's validate_target wins; else mix.validator
    # is resolved inside build_mix from its 'module:attr' spec
    validator = getattr(pack, "validate_target", None) if pack is not None else None

    # human-facing live monitor (founder spec): opens even when an agent is
    # driving; read-only + a loud stop. Off for the dummy backend (tests) and
    # under NMT_FORGE_NO_MONITOR=1.
    from ..monitor import RunMonitor, monitor_enabled

    monitor = None
    if cfg.model.get("backend") != "dummy" and monitor_enabled():
        try:      # stable, bookmarkable port first; any free port otherwise
            monitor = RunMonitor(run_dir, cfg.run_name, ch, port=8377)
        except OSError:
            monitor = RunMonitor(run_dir, cfg.run_name, ch)

    # -- the fence: dev or nothing (its refusal carries the what/why/fix) -----
    fence = DevFence(ws, canonicalizer=canonicalizer)
    dev_raw = fence.require_dev(cfg.dev, config_hash=ch)
    dev_entry = ws.registry.get(cfg.dev)
    dev_rows = [
        {"source": str(r.get(dev_entry["source_field"], "")),
         "target": str(r.get(dev_entry["target_field"], ""))}
        for r in dev_raw
    ]

    backend = make_backend(cfg.model)
    plugins = tuple(load_plugins(cfg.selection.plugins))
    target_lang = (cfg.language or {}).get("target", "")
    if cfg.selection.auto_plugins:
        if not target_lang:
            from ..errors import ConfigError

            raise ConfigError(
                "selection.auto_plugins needs config.language.target (the "
                "harness discovers plugins BY language) — `nmt-forge init "
                "<code>` writes the language block for you"
            )
        from ..plugins import discover_plugins_for_language

        plugins = plugins + tuple(
            discover_plugins_for_language(target_lang, skip_fst=True))

    # decode-time feedback hook (e.g. crk FST validity tie-break): resolved
    # once, applied to EVERY decode below — checkpoint selection and the
    # final dev report — so checkpoints are chosen under the decoding regime
    # actually deployed
    decode_hook = None
    if cfg.decode.hook:
        from importlib import import_module

        module, _, attr = cfg.decode.hook.partition(":")
        decode_hook = getattr(import_module(module), attr)
    decode_extra = ({"decode_hook": decode_hook,
                     "num_beams": cfg.decode.num_beams}
                    if decode_hook else {})

    # -- headroom before any compute (guard #11) ----------------------------------
    headroom = check_generation_headroom(
        [r["target"] for r in dev_rows],
        cfg.decode.max_new_tokens,
        backend.token_len,
        headroom_factor=cfg.decode.headroom_factor,
    )

    stages = cfg.curriculum or [{"name": "train"}]
    stage_manifests = []
    prev_selected = None
    selection = None
    for i, stage in enumerate(stages):
        name = stage.get("name", f"stage{i + 1}")
        stage_dir = run_dir / name
        stage_dir.mkdir(exist_ok=True)
        mix = build_mix(cfg, ws, canonicalizer=canonicalizer,
                        conventions=conventions, validator=validator,
                        stage_overrides=stage)

        # schedule-sanity: derive the early-stop floor from THIS stage's mix
        # — never a user-supplied magic number (the half-epoch-death guard)
        gold_in_mix = sum(1 for r in mix.rows
                          if not r.get("synthetic")
                          and not str(r.get("source", "")).startswith("<"))
        schedule = plan_schedule(
            gold_rows=gold_in_mix,
            synth_rows=len(mix.rows) - gold_in_mix,
            dev_is_real=not any(_looks_synthetic(r) for r in dev_raw),
            batch_size=cfg.model.get("batch_size", 4),
            grad_accum=cfg.model.get("grad_accum", 4),
            epochs=cfg.model.get("epochs", 3),
            regime=cfg.regime,
        )
        print(f"[schedule-sanity] {name}: regime={schedule.regime} "
              f"({schedule.regime_source}), floor={schedule.floor_steps:,} "
              f"of {schedule.planned_steps:,} planned steps", flush=True)
        if monitor is not None:
            monitor.emit("stage", name=name,
                         floor_steps=schedule.floor_steps,
                         planned_steps=schedule.planned_steps)

        params = dict(stage.get("model", {}))
        params.setdefault("floor_steps", schedule.floor_steps)
        params.setdefault("patience", schedule.patience)
        params.setdefault("eval_steps", schedule.eval_steps)
        if monitor is not None:
            params["_monitor"] = monitor
        if prev_selected is not None:
            params["init_from"] = prev_selected.path
            if prev_selected.dev_loss is not None:
                # curriculum-continuity gate: the next stage must START near
                # the checkpoint it continues, or the init is broken
                params["_prev_dev_loss"] = prev_selected.dev_loss
        result = backend.train(mix.rows, dev_rows, params, stage_dir)
        if monitor is not None and monitor.stop_requested():
            monitor.emit("done", status="aborted",
                         text="run ABORTED by human via the monitor panel")
            from ..errors import ForgeError

            raise ForgeError(
                "run aborted: a HUMAN pressed stop on the monitor panel\n"
                "  why: the stop button is the panel's one control — it kills "
                "the run at the next step boundary; partial checkpoints "
                f"remain under {stage_dir}\n"
                "  fix: nothing to fix — relaunch `nmt-forge run` when ready"
            )
        stop_explanation = explain_stop(schedule, result.stop_event,
                                        result.history)
        if stop_explanation:
            print(f"[schedule-sanity] {stop_explanation}", flush=True)
        selection = select_checkpoint(
            result,
            metric_spec=cfg.selection.metric,
            backend=backend,
            dev_rows=dev_rows,
            decode_params={"max_new_tokens": cfg.decode.max_new_tokens,
                           **cfg.model, **decode_extra},
            plugins=plugins,
            target_lang=target_lang,
            top_k=cfg.selection.top_k,
        )
        prev_selected = selection.selected
        stage_manifests.append({
            "stage": name,
            "mix": mix.manifest,
            "schedule": schedule.to_manifest(),
            "stop_event": result.stop_event,
            "stop_explanation": stop_explanation,
            "selection": selection.to_manifest(),
            "checkpoints": [
                {"id": c.id, "step": c.step, "dev_loss": c.dev_loss}
                for c in result.checkpoints
            ],
        })

    # -- final dev report, CIs mandatory ------------------------------------------
    dev_hyps = backend.decode(
        prev_selected, [r["source"] for r in dev_rows],
        {"max_new_tokens": cfg.decode.max_new_tokens, **cfg.model,
         **decode_extra},
    )
    dev_report = ci_scoring.score(
        dev_hyps, [r["target"] for r in dev_rows],
        [r["source"] for r in dev_rows],
        plugins=plugins, target_lang=target_lang,
    )

    manifest = {
        "run_name": cfg.run_name,
        "config_hash": ch,
        "config": cfg.raw,
        "git_commit": _git_commit(Path(config_path).resolve().parent),
        "python": sys.version.split()[0],
        "backend": backend.backend_id,
        "dev_set": {"name": cfg.dev, "sha256": dev_entry["sha256"],
                    "rows": len(dev_rows)},
        "headroom": headroom,
        "stages": stage_manifests,
        "selected_checkpoint": prev_selected.id,
        "selected_path": prev_selected.path,
        "dev_report": dev_report.to_manifest(),
        "note": "dev-selected under the fence; test/sealed scoring goes "
                "through `nmt-forge score` (prereg-gated).",
    }
    manifest["manifest_path"] = str(run_dir / "run-manifest.json")
    (run_dir / "run-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    # the plain-language account (acceptance criterion 4): what trained,
    # what the guards did, what the numbers mean
    from ..reporting import render_run_report

    report_path = run_dir / "run-report.md"
    report_path.write_text(render_run_report(manifest), encoding="utf-8")
    manifest["report_path"] = str(report_path)
    if monitor is not None:
        monitor.emit("done", status="done",
                     text=f"run complete — selected {prev_selected.id}; "
                          f"manifest: {manifest['manifest_path']}")
    return manifest


def run_cli(args) -> int:
    manifest = run(args.config)
    print(json.dumps({
        "run": manifest["run_name"],
        "config_hash": manifest["config_hash"],
        "selected_checkpoint": manifest["selected_checkpoint"],
        "manifest": manifest["manifest_path"],
    }, indent=2))
    print()
    print("dev report (95% CIs — there is no bare-score rendering):")
    report = ci_scoring.ScoreReport(
        n=manifest["dev_report"]["n"],
        scores=manifest["dev_report"]["scores"],
        eval_set=manifest["dev_set"]["name"],
    )
    print(report.format())
    return 0
