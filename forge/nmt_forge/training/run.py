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
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

from ..errors import ForgeError
from ..guards import ci_scoring
from ..guards.dev_fence import DevFence
from ..plugins import load_plugins
from ..privacy import merge_marks
from ..registry import _looks_synthetic
from ..workspace import Workspace
from .backends import make_backend
from .config import RunConfig
from .mix import build_mix
from .schedule import explain_stop, plan_schedule
from .decode_cap import cap_params
from .selection import check_generation_headroom, select_checkpoint
from . import heartbeat
from ..monitor import STOP_BASENAME


def _git_commit(near: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=near, capture_output=True,
            text=True, timeout=10,
        )
        return out.stdout.strip() if out.returncode == 0 else "not-a-git-repo"
    except Exception:
        return "unknown"


def _dev_floor(ws: Workspace, dev_name: str) -> dict | None:
    """The dictionary floor measured on this dev set, if any ({score, ci})
    — the line the monitor draws under the dev score."""
    try:
        from ..advisor import _floors
        from ..floor import floor_score

        return floor_score(_floors(ws).get(dev_name))
    except Exception:            # the panel is a view; never fail a run over it
        return None


DEV_OUTPUTS = "dev-outputs.jsonl"


def _write_dev_outputs(run_dir: Path, hyps: list[str], dev_sha256: str) -> None:
    """The selected checkpoint's translation of every dev row, in dev order,
    under the dev file's sha — what `compare-runs` pairs two rounds on."""
    with (run_dir / DEV_OUTPUTS).open("w", encoding="utf-8") as fh:
        fh.write(json.dumps({"dev_sha256": dev_sha256, "n": len(hyps)}) + "\n")
        for h in hyps:
            fh.write(json.dumps({"hyp": h}, ensure_ascii=False) + "\n")


def read_dev_outputs(run_dir: str | Path) -> tuple[dict, list[str]]:
    """(header, hyps) of a run's saved dev translations; ({}, []) if none."""
    p = Path(run_dir) / DEV_OUTPUTS
    if not p.is_file():
        return {}, []
    lines = [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]
    return (lines[0], [x["hyp"] for x in lines[1:]]) if lines else ({}, [])


def decode_with_run(manifest: dict, sources: list[str]) -> list[str]:
    """The run's selected checkpoint translates ``sources`` with the decode
    settings it was trained with — how a round's verdict pairs the model in
    use with a newer one on a practice set that has grown since the model in
    use was trained (``improve.compare``). Raises ForgeError when the run kept
    no checkpoint to decode."""
    from importlib import import_module

    from ..errors import ForgeError
    from .backends import Checkpoint

    path = manifest.get("selected_path")
    if manifest.get("model_removed"):
        gone = manifest["model_removed"]
        raise ForgeError(
            f"run {manifest.get('run_name', '?')}'s model was removed by {gone.get('by', 'nmt-forge tidy')} "
            f"on {gone.get('at', '?')} to free disk space — its record stays, its weights do not\n"
            "  why: tidy removes the models of earlier rounds nothing uses\n"
            "  fix: compare against a model that is still here, or train that round again")
    if not path or not manifest.get("config"):
        raise ForgeError(
            f"run {manifest.get('run_name', '?')} kept no selected checkpoint to translate with\n"
            "  why: its manifest names no selected_path (or carries no config)\n"
            "  fix: train that round again with this forge")
    cfg = RunConfig.from_dict(manifest["config"])
    extra = {}
    if cfg.decode.hook:
        module, _, attr = cfg.decode.hook.partition(":")
        extra = {"decode_hook": getattr(import_module(module), attr),
                 "num_beams": cfg.decode.num_beams}
    backend = make_backend(cfg.model)
    selected = Checkpoint(id=str(manifest.get("selected_checkpoint")), step=0, path=path)
    return backend.decode(selected, list(sources),
                          {**cap_params(cfg.decode), **cfg.model,
                           "num_beams": cfg.decode.num_beams, **extra})


def run_identity(cfg: RunConfig, ws: Workspace) -> dict:
    """What a run IS: its config, the bytes of every file it trains on, the
    dev set that fences it and the checkpoint it starts from — hashed.

    Until 2026-10 a run's folder was named by its config alone, so training
    the same config on a GROWN corpus (the improve loop's every round)
    overwrote the earlier run and inherited its judged prediction. Now a
    round with new data is a new run; the same config on the same data is
    the same run, and training it again is refused (see run())."""
    import hashlib

    from ..advisor import config_training_files
    from ..registry import sha256_file

    files = {}
    for f in config_training_files(cfg):
        q = Path(f)
        if not q.is_absolute():
            q = q if q.exists() else ws.root.parent / q
        files[str(f)] = sha256_file(q) if q.is_file() else "missing"
    try:
        dev_sha = ws.registry.get(cfg.dev).get("sha256")
    except Exception:            # an unregistered dev set: the fence refuses it next
        dev_sha = None
    starts = [cfg.model.get("init_from")] + [((s or {}).get("model") or {}).get("init_from")
                                              for s in (cfg.curriculum or [])]
    record = {"config_hash": cfg.hash(), "training_files": files, "dev": cfg.dev,
              "dev_sha256": dev_sha, "init_from": [s for s in starts if s]}
    record["id"] = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
    return record


def prune_checkpoints(run_dir: Path, selected: str | None, *, keep: str = "selected") -> dict:
    """Remove every ``checkpoint-*`` folder of a FINISHED run but the selected
    one (every stage's): {"removed": n, "bytes": freed, "kept": id}. ``keep``
    "all" (the model block's ``keep_checkpoints``) keeps them, said so."""
    from ..disk import dir_bytes

    if keep == "all":
        return {"removed": 0, "bytes": 0, "kept": "all (keep_checkpoints: all)"}
    if keep != "selected":
        raise ForgeError(f'model.keep_checkpoints is "selected" or "all", not {keep!r}')
    sel = Path(selected).resolve() if selected else None
    removed, freed = 0, 0
    for d in sorted(Path(run_dir).rglob("checkpoint-*")):
        if not d.is_dir() or (sel is not None and (d.resolve() == sel or d.resolve() in sel.parents)):
            continue
        size = dir_bytes(d)
        shutil.rmtree(d, ignore_errors=True)
        if not d.exists():
            removed += 1
            freed += size
    return {"removed": removed, "bytes": freed, "kept": Path(selected).name if selected else None}


def interrupted_checkpoint(run_dir: Path) -> dict | None:
    """The last checkpoint an interrupted run saved (no manifest: it never
    finished), with its step and the run's planned steps; None when there is
    nothing to resume from."""
    run_dir = Path(run_dir)
    if not run_dir.is_dir() or (run_dir / "run-manifest.json").is_file():
        return None
    ckpts = []
    for d in run_dir.glob("checkpoint-*"):
        try:
            step = int(d.name.split("-", 1)[1])
        except ValueError:
            continue
        if (d / "config.json").is_file():
            ckpts.append((step, d))
    if not ckpts:
        return None
    step, d = max(ckpts)
    planned = None
    try:
        planned = int(json.loads((d / "trainer_state.json").read_text(encoding="utf-8")).get("max_steps") or 0) or None
    except (OSError, ValueError):
        pass
    return {"path": str(d), "step": step, "of": planned}


def run(config_path: str | Path, *, pack=None, resume: bool = False, disk_check: bool = True) -> dict:
    cfg = RunConfig.from_file(config_path)
    ch = cfg.hash()
    ws = Workspace(cfg.workspace)
    identity = run_identity(cfg, ws)
    run_dir = ws.runs_dir / f"{cfg.run_name}-{identity['id'][:8]}"
    resumed = None
    if resume:
        # a warm restart after a power cut or a stop: the interrupted run's
        # last weights, a fresh optimizer, the epochs it had left — a new run
        # (its own folder: the start point is part of what a run is) that
        # says where it resumed from (FORGE_MACHINE_CRITIQUE finding 11)
        from ..errors import ForgeError

        ck = interrupted_checkpoint(run_dir)
        if ck is None:
            raise ForgeError(
                f"nothing to resume: {run_dir} holds no checkpoint of an unfinished run\n"
                "  why: a run is resumed from the last checkpoint it saved before it was cut off\n"
                "  fix: train it from the start: nmt-forge run " + str(config_path))
        epochs = float(cfg.model.get("epochs", 3))
        left = max(1, math.ceil(epochs * (1 - ck["step"] / ck["of"]))) if ck["of"] else max(1, math.ceil(epochs / 2))
        raw = json.loads(json.dumps(cfg.raw))
        raw["model"] = {**raw.get("model", {}), "init_from": ck["path"], "epochs": left}
        cfg = RunConfig.from_dict(raw)
        ch = cfg.hash()
        identity = run_identity(cfg, ws)
        resumed = {"run_dir": str(run_dir), "checkpoint": Path(ck["path"]).name, "step": ck["step"],
                   "of": ck["of"], "epochs_left": left}
        run_dir = ws.runs_dir / f"{cfg.run_name}-{identity['id'][:8]}"
    if (run_dir / "run-manifest.json").is_file():
        from ..errors import ForgeError

        raise ForgeError(
            f"this run already exists: {run_dir} — same config, same training "
            "files, same dev set\n"
            "  why: training it again would only repeat it, and writing over "
            "it would lose the run (and the prediction judged against it) — "
            "the improve loop's rounds each add data, so each is a new run\n"
            "  fix: add or change the training data, or change the config; to "
            "repeat this exact run on purpose, move its folder aside first")
    # room on the disk for what this run will write, before anything is
    # written (disk.check_room; 2026-10-13: a full disk killed a run mid-save)
    from ..disk import check_room

    room = check_room(ws, cfg.model, ws.runs_dir) if disk_check else {"skipped": "--skip-disk-check"}
    # one run per workspace at a time: taken BEFORE anything is written, held
    # until this function exits by any path (status reads it — see runlock)
    from ..runlock import run_lock

    with run_lock(ws, run_name=cfg.run_name, run_dir=run_dir,
                  config_hash=ch, config_path=config_path):
        return _run_locked(cfg, ch, ws, run_dir, config_path, pack=pack, identity=identity, resumed=resumed,
                           room=room)


def _run_locked(cfg: RunConfig, ch: str, ws: Workspace, run_dir: Path,
                config_path: str | Path, *, pack=None, identity: dict | None = None,
                resumed: dict | None = None, room: dict | None = None) -> dict:
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
    # the id mt-eval knows the dev file by (its card, envelope or sidecar);
    # `name` stays forge's registry name. Resolved BEFORE training: an
    # unreadable steward sidecar refuses here, not after the compute.
    dev_ident = ws.registry.identity(cfg.dev)
    # what this run is training, for the person watching (founder 2026-10-13:
    # "I should be able to tell what we're running"): written NOW, so a panel
    # attached mid-run reads it too — names, counts and averages, never a
    # sentence (run_facts). The trainer adds its length-limit counts through
    # note_facts. A view: it never fails the run.
    from ..run_facts import add_facts, describe_run, write_facts

    def note_facts(**more) -> None:
        try:
            add_facts(run_dir, **more)
        except OSError as e:
            print(f"[run-facts] not updated: {e}", flush=True)
        if monitor is not None:
            monitor.emit("facts", **more)

    try:
        facts = describe_run(cfg, dev_entry=dev_entry,
                             roots=[Path.cwd(), Path(config_path).resolve().parent, ws.root.parent])
        write_facts(run_dir, facts)
        if monitor is not None:
            monitor.emit("facts", **facts)
    except Exception as e:
        print(f"[run-facts] not written: {e}", flush=True)
    dev_rows = [
        {"source": str(r.get(dev_entry["source_field"], "")),
         "target": str(r.get(dev_entry["target_field"], ""))}
        for r in dev_raw
    ]
    # ... and no training row may BE a dev row (Round 12 hospital persona:
    # the twin-free corpus, written before the split, held rows the split
    # then put in dev; the leak audit counts dev hits as non-fatal, so the
    # run trained on them and said nothing). preflight's dev-fence gate runs
    # this same check on the same files.
    from ..advisor import config_training_files, dev_overlap_fix

    train_dev_overlap = fence.require_disjoint_training(
        cfg.dev, dev_raw, config_training_files(cfg),
        source_field=dev_entry["source_field"],
        target_field=dev_entry["target_field"],
        fix_for=lambda f: dev_overlap_fix(ws, f, cfg.dev))

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
        sources=[r["source"] for r in dev_rows],
        length_ratio=cfg.decode.length_ratio,
        length_margin=cfg.decode.length_margin,
    )

    stages = cfg.curriculum or [{"name": "train"}]
    stage_manifests = []
    prev_selected = None
    selection = None
    for i, stage in enumerate(stages):
        name = stage.get("name", f"stage{i + 1}")
        stage_dir = run_dir / name
        stage_dir.mkdir(exist_ok=True)
        heartbeat.beat("mix", force=True, run_dir=str(stage_dir), stage_name=name)
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
        params = dict(stage.get("model", {}))
        # derived schedule values fill in ONLY what neither the stage nor the
        # config's model block set — a user's model.eval_steps/patience must
        # never be silently overridden by the derived default
        for key, derived in (("floor_steps", schedule.floor_steps),
                             ("patience", schedule.patience),
                             ("eval_steps", schedule.eval_steps)):
            if key not in params and key not in cfg.model:
                params[key] = derived
        if monitor is not None:
            params["_monitor"] = monitor
        params["_facts"] = note_facts
        scored =cfg.selection.metric == "generation:chrf++" and cfg.model.get("backend") != "dummy"
        if scored:
            # the trainer scores the dev translations at each evaluation and
            # stops / keeps its best by that score (backends.train)
            params["_dev_score_metric"] = "chrf++"
            if "eval_steps" not in stage.get("model", {}) and "eval_steps" not in cfg.model:
                # a check costs seconds, so check about once an epoch — between
                # 10 and 40 checks a run — and the progress line has points
                per_epoch = max(1, schedule.steps_per_epoch)
                params["eval_steps"] = max(1, math.ceil(schedule.planned_steps / 40),
                                           min(per_epoch, math.ceil(schedule.planned_steps / 10)))
        if monitor is not None:
            monitor.emit("stage", name=name,
                         floor_steps=schedule.floor_steps,
                         planned_steps=schedule.planned_steps,
                         eval_steps=params.get("eval_steps", cfg.model.get("eval_steps")),
                         patience=params.get("patience", cfg.model.get("patience")),
                         scored=scored,
                         score_rows=(min(len(dev_rows), int(cfg.model.get("eval_rows_max", 400)))
                                     if scored else None))
            floor_rec = _dev_floor(ws, cfg.dev)
            if floor_rec:
                monitor.emit("floor", **floor_rec)
        if prev_selected is not None:
            params["init_from"] = prev_selected.path
            if prev_selected.dev_loss is not None:
                # curriculum-continuity gate: the next stage must START near
                # the checkpoint it continues, or the init is broken
                params["_prev_dev_loss"] = prev_selected.dev_loss
        result = backend.train(mix.rows, dev_rows, params, stage_dir)
        if (stage_dir / STOP_BASENAME).exists() and not (
                monitor is not None and monitor.stop_requested()):
            # the job supervisor's stop (nmt_forge.jobs: stalled, past its
            # deadline, or `nmt-forge jobs stop`) — never a finished run
            from ..errors import ForgeError

            raise ForgeError(
                "run stopped: its job was told to stop (stalled, past its "
                "deadline, or stopped by hand)\n"
                "  why: a stopped run's checkpoints are not a selected model\n"
                f"  fix: `nmt-forge jobs` says why; partial checkpoints remain "
                f"under {stage_dir}; relaunch `nmt-forge run` when ready")
        heartbeat.beat("select", force=True, run_dir=str(stage_dir))
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
            decode_params={**cap_params(cfg.decode),
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
            "backend_info": result.backend_info,
            "selection": selection.to_manifest(),
            "checkpoints": [
                {"id": c.id, "step": c.step, "dev_loss": c.dev_loss,
                 **({"dev_score": c.dev_score} if c.dev_score is not None else {})}
                for c in result.checkpoints
            ],
        })

    # -- final dev report, CIs mandatory ------------------------------------------
    # the selected model's dev translations as it will be used: with the
    # config's beams (selection above ranked checkpoints greedily)
    dev_hyps = backend.decode(
        prev_selected, [r["source"] for r in dev_rows],
        {**cap_params(cfg.decode), **cfg.model,
         "num_beams": cfg.decode.num_beams, **decode_extra},
    )
    dev_report = ci_scoring.score(
        dev_hyps, [r["target"] for r in dev_rows],
        [r["source"] for r in dev_rows],
        plugins=plugins, target_lang=target_lang,
    )
    # the selected model's dev translations, kept with the run, row by row: a
    # later round is judged against this one on the SAME sentences (paired —
    # `nmt-forge compare-runs`). Local to the run folder, never printed.
    _write_dev_outputs(run_dir, dev_hyps, dev_entry["sha256"])
    cut = getattr(backend, "last_decode", None) or {}
    dev_decode = {"n": len(dev_hyps), "inputs_cut": len(cut.get("inputs_cut") or []),
                  "outputs_at_cap": len(cut.get("outputs_at_cap") or [])}
    # a dev score at the ceiling with a collapsed CI: selection had nothing
    # to choose between (Round 6 hospital persona: 100.00 [100, 100], no
    # warning) — recorded in the manifest so status/report/export say it too
    saturation = ci_scoring.dev_saturation(
        dev_report.scores, n=dev_report.n,
        selection=(selection.to_manifest() if selection is not None
                   else None))
    if saturation:
        # the advice names a near-dupe re-split only where it can work: on a
        # corpus whose templates chain into one group it cannot (Round 7)
        check = _carve_check(cfg, dev_rows)
        if check is not None:
            saturation = ci_scoring.dev_saturation(
                dev_report.scores, n=dev_report.n,
                selection=(selection.to_manifest() if selection is not None
                           else None), carve_check=check)
    for line in ci_scoring.render_dev_saturation(saturation,
                                                 prefix="[dev-saturation] "):
        print(line, flush=True)

    # only the selected checkpoint is ever read again (export copies it; the
    # next round starts from the model in use; compare re-decodes it): the
    # others go now. A ByT5-small run kept 4 at ~1.4 GB each and every improve
    # round added another 5.6 GB until the disk filled (2026-10-13)
    pruned = prune_checkpoints(run_dir, prev_selected.path,
                               keep=str(cfg.model.get("keep_checkpoints", "selected")))

    manifest = {
        "run_name": cfg.run_name,
        "config_hash": ch,
        # what makes this run this run (config + data bytes + dev + start) —
        # its folder is named by it
        **({"run_identity": identity} if identity else {}),
        "config": cfg.raw,
        **({"resumed_from": resumed} if resumed else {}),
        "git_commit": _git_commit(Path(config_path).resolve().parent),
        "python": sys.version.split()[0],
        "backend": backend.backend_id,
        "dev_set": {"name": cfg.dev, "sha256": dev_entry["sha256"],
                    "rows": len(dev_rows),
                    "dataset_id": dev_ident["dataset_id"],
                    "dataset_id_source": dev_ident["dataset_id_source"],
                    # every training file checked: no row of it IS a dev
                    # row (Round 12) — {file: 0}
                    "training_overlap": train_dev_overlap},
        "headroom": headroom,
        "stages": stage_manifests,
        "selected_checkpoint": prev_selected.id,
        "selected_path": prev_selected.path,
        # the checkpoints removed once the selected one was chosen (count, bytes)
        "checkpoints_pruned": pruned,
        # the disk check before training: free, estimated need (or skipped)
        **({"disk_room": room} if room else {}),
        # every stage's training files' terms, joined strictly: what the
        # model writes is held to them (export → forge-model.json → serve)
        "trained_on": {"terms": merge_marks(*(
            s["mix"].get("training_terms") or {} for s in stage_manifests)),
            "recorded": "when the model was trained"},
        "dev_report": dev_report.to_manifest(),
        "dev_saturation": saturation,
        # what the length limits cut: training rows (counted before training)
        # and the final dev decode — counts only, never a sentence
        "length_limits": {**((stage_manifests[-1].get("backend_info") or {}).get("length_limits") or {}),
                          "dev_decode": dev_decode},
        "note": "dev-selected under the fence; test/sealed scoring goes "
                "through `nmt-forge score` (prereg-gated).",
    }
    manifest["manifest_path"] = str(run_dir / "run-manifest.json")
    # written whole or not at all: a power cut mid-write must not leave a
    # half manifest that reads as a finished run (critique finding 11)
    tmp = run_dir / "run-manifest.json.tmp"
    tmp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, run_dir / "run-manifest.json")
    # the plain-language account (acceptance criterion 4): what trained,
    # what the guards did, what the numbers mean
    from ..reporting import render_run_report

    report_path = run_dir / "run-report.md"
    heartbeat.beat("report", force=True, run_dir=str(run_dir))
    report_path.write_text(render_run_report(manifest), encoding="utf-8")
    manifest["report_path"] = str(report_path)
    if monitor is not None:
        monitor.emit("done", status="done",
                     text=f"run complete — selected {prev_selected.id}; "
                          f"manifest: {manifest['manifest_path']}")
    return manifest


def _carve_check(cfg: RunConfig, dev_rows: list[dict]) -> dict | None:
    """``ci_scoring.near_dupe_carve_check`` of what a re-split would carve:
    the gold training files plus the dev rows. None when it cannot be made
    (the advice then stays generic — this check never blocks a run)."""
    from ..errors import ForgeError
    from ..registry import load_rows

    try:
        rows: list[dict] = []
        for f in cfg.gold:
            rows += [{"source": str(r.get("source", "")),
                      "target": str(r.get("target", r.get("reference", "")))}
                     for r in load_rows(f)]
        return ci_scoring.near_dupe_carve_check(rows + dev_rows,
                                                target_field="target")
    except (ForgeError, OSError, KeyError, ValueError):
        return None


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
    for line in ci_scoring.render_dev_saturation(
            manifest.get("dev_saturation")):
        print(line)
    return 0
