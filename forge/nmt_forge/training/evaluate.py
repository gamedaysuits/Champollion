"""``nmt-forge evaluate <run-manifest> --config <config>`` — close the loop.

Dogfooding e15-v7 surfaced a real seam: ``nmt-forge run`` stops at
train + checkpoint-selection, but the thing a novice actually wants — a
scored, diagnosed battery — needed a hand-symlinked checkpoint and a
hand-run decoder (crk ``experiments/e15_fst_factory/fst_decode.py``). That
manual handoff is exactly where a weak agent gets lost.

``evaluate`` does the handoff:

1. read the run manifest → the SELECTED checkpoint (id + path) + backend;
2. load the registered battery's SOURCE texts (inputs, not answers — no
   ledger spend, no prereg gate here);
3. decode with the run's backend (pluggable, same protocol as training);
4. hand the hypotheses to ``score_battery`` — which IS prereg-gated and
   ledgered, scores per register with CIs, and auto-appends the battery-lint
   Diagnosis.

Decode is backend-pluggable exactly like training: the manifest records the
backend id, ``make_backend(cfg.model)`` rebuilds it, and the selected
checkpoint's path is loaded. The DummyBackend makes the whole loop testable
without a GPU.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from importlib import import_module
from pathlib import Path

from ..errors import ForgeError
from ..registry import load_rows
from ..workspace import Workspace
from .backends import Checkpoint, make_backend
from .config import RunConfig


def _load_attr(spec: str):
    module, _, attr = str(spec).partition(":")
    if not module or not attr:
        raise ForgeError(f"{spec!r} must look like 'package.module:attr'")
    return getattr(import_module(module), attr)


def evaluate(run_manifest_path: str | Path, *, config_path: str | Path | None = None,
             out_hyps: str | Path | None = None,
             harness_out: str | Path | None = None,
             glossary: str | Path | None = None,
             command: str = "evaluate",
             prereg_id: str | None = None):
    """Decode the config's battery with the run's selected checkpoint, score it.

    ``prereg_id`` names the preregistration this run is judged against
    (``--prereg``); without it the gate picks the only valid one, the one
    this run's first read was bound to, or the one pinned to its config —
    and refuses when that is ambiguous (``preregister.require_prereg``).

    ``harness_out`` (a directory) additionally writes the result as an
    mt-eval RunLog + TestReport — built by the HARNESS's own
    ``build_run_log``/``analyze_run_log`` from the rows of this same gated
    read (no second read of the set, no second prereg/ledger event) — so
    ``mt-eval compare``/``mt-eval export`` work on a forge model. Those files
    carry the eval set's text (sources + references): they are written ONLY
    where you point, never into the content-free workspace by default.
    The TestReport is scored with the metric plugins ``mt-eval run`` loads
    for the target language (``harness_bridge.discover_report_plugins``,
    discovered BEFORE the read so a referee that cannot load refuses first);
    ``glossary`` (or ``eval.glossary``) turns terminology adherence on, and
    whatever the report does not carry is returned as ``harness_metrics``.

    Every file written here carries the eval set's text or the model's
    outputs on it; when the set is marked (local-only, sealed segment, a
    declared licence) each gets a ``.champollion.json`` sidecar with the
    same terms (``privacy.carry_mark``), so the copies stay protected
    wherever they go. ``command`` names the forge command in the sidecar.

    Returns the BatteryReport plus the paths written (hyps, manifest, md,
    harness_runlog/harness_report/harness_metrics when requested, and
    ``sidecars``/``mark`` when the set carries terms).
    """
    from ..guards.ci_scoring import score_battery
    from ..plugins import discover_plugins_for_language, load_plugins
    from ..reporting import render_battery_report

    rmpath = Path(run_manifest_path)
    try:
        run_manifest = json.loads(rmpath.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ForgeError(f"{rmpath}: not valid JSON ({e})") from e
    if "selected_checkpoint" not in run_manifest:
        raise ForgeError(
            f"{rmpath}: not a run manifest (no selected_checkpoint) — pass the "
            "run-manifest.json written by `nmt-forge run`"
        )

    # the config carries the eval block; prefer an explicit --config, else the
    # config embedded in the run manifest (so a bare manifest still evaluates)
    if config_path is not None:
        cfg = RunConfig.from_file(config_path)
    elif run_manifest.get("config"):
        cfg = RunConfig.from_dict(run_manifest["config"])
    else:
        raise ForgeError(
            f"{rmpath} has no embedded config — pass --config <config.json> "
            "with the eval block"
        )
    ev = cfg.eval_battery
    if not ev:
        raise ForgeError(
            "no eval block — add an \"eval\": {\"battery\": \"<registered "
            "set>\", …} block to the config so evaluate knows what to decode"
        )

    ws = Workspace(cfg.workspace)
    entry = ws.registry.get(ev["battery"])
    from ..privacy import carried_mark, carry_mark

    from ..harness_bridge import _given_dataset_id

    identity = ws.registry.identity(ev["battery"])
    # the terms every file written below must carry (the file's own and the
    # harness's derived-file mark, one shape) — read first, so an
    # unreadable sidecar refuses before anything is decoded or spent
    mark = carried_mark(entry["path"],
                        dataset_id=_given_dataset_id(identity))
    discovered = None
    if harness_out is not None:
        from ..harness_bridge import discover_report_plugins

        # the metric battery `mt-eval run` would load — before the gated
        # read, so a referee the harness cannot load refuses first
        discovered = discover_report_plugins(
            cfg, entry, identity=identity,
            glossary=glossary or ev.get("glossary"))
    # SOURCES only: decode inputs are not answers, so reading them here is not
    # a scored read — the ledger spend + prereg gate happen inside score_battery
    brows = load_rows(Path(entry["path"]))
    src_f = entry["source_field"]
    sources = [str(r.get(src_f, "")) for r in brows]

    backend = make_backend(cfg.model)
    selected = Checkpoint(
        id=str(run_manifest["selected_checkpoint"]), step=0,
        path=run_manifest.get("selected_path"))
    if selected.path is None:
        raise ForgeError(
            f"{rmpath}: selected_path is missing — the checkpoint to decode is "
            "unknown; re-run `nmt-forge run` to produce a complete manifest"
        )
    decode_extra = {}
    if cfg.decode.hook:
        decode_extra = {"decode_hook": _load_attr(cfg.decode.hook),
                        "num_beams": cfg.decode.num_beams}
    # the decode's wall-clock: the mt-eval RunLog's elapsed time and latency
    decode_started = datetime.now(timezone.utc).isoformat()
    t0 = time.monotonic()
    hyps = backend.decode(
        selected, sources,
        {"max_new_tokens": cfg.decode.max_new_tokens, **cfg.model,
         **decode_extra})
    decode_seconds = time.monotonic() - t0

    # preserve ids so the battery join is by id, not by position — when the
    # set HAS ids. A set carved by `nmt-forge split` has none: then the join
    # is positional (same file, same order — decoded right here), and the
    # hyps file records the row number instead. (Before 2026-10, id-less
    # sets were keyed by row index and the join refused every row.)
    has_ids = bool(brows) and all("id" in r for r in brows)
    hyp_rows = [({"id": r["id"]} if has_ids else {"row": i})
                | {"predicted": h}
                for i, (r, h) in enumerate(zip(brows, hyps))]
    hyps_path = Path(out_hyps) if out_hyps else \
        rmpath.with_name(rmpath.stem + "-battery-hyps.jsonl")
    hyps_path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in hyp_rows) + "\n",
        encoding="utf-8")
    written = [hyps_path]
    carry_mark(entry["path"], written, command=command, mark=mark)

    plugins = tuple(load_plugins(ev.get("plugins", [])))
    if ev.get("card_plugins"):
        plugins += tuple(discover_plugins_for_language(
            ev["card_plugins"], skip_fst=True))
    conventions = _load_attr(ev["conventions"]) if ev.get("conventions") else None
    canonicalizer = (_load_attr(ev["canonicalizer"])
                     if ev.get("canonicalizer") else None)

    report = score_battery(
        ws, ev["battery"], hyp_rows if has_ids else list(hyps),
        by=ev.get("by", "register"),
        metrics=tuple(ev.get("metrics", ["chrf++"])),
        plugins=plugins,
        conventions=conventions,
        canonicalizer=canonicalizer,
        target_lang=(cfg.language or {}).get("target", ""),
        n_bootstrap=int(ev.get("n_bootstrap", 1000)),
        seed=int(ev.get("seed", 12345)),
        config_hash=cfg.hash(),
        near_dupe_corpus=ev.get("near_dupe_corpus"),
        keep_entries=harness_out is not None,
        prereg_id=prereg_id,
    )
    manifest = report.to_manifest()
    manifest_path = hyps_path.with_name(hyps_path.stem + "-battery.json")
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8")
    md_path = manifest_path.with_suffix(".md")
    md_path.write_text(render_battery_report(manifest), encoding="utf-8")
    written += [manifest_path, md_path]

    paths = {"hyps": str(hyps_path), "manifest": str(manifest_path),
             "report_md": str(md_path)}
    if harness_out is not None:
        from ..guards.ci_scoring import near_twin_summary
        from ..harness_bridge import write_harness_report

        paths.update(write_harness_report(
            report.entries, out_dir=harness_out, run_manifest=run_manifest,
            run_manifest_path=rmpath, cfg=cfg, battery=ev["battery"],
            battery_entry=entry, near_twin=near_twin_summary(manifest),
            identity={"set": ev["battery"], "dataset_id": report.dataset_id,
                      "dataset_id_source": report.dataset_id_source},
            discovered=discovered, decode_seconds=decode_seconds,
            decode_started=decode_started))
        written += [Path(paths["harness_runlog"]),
                    Path(paths["harness_report"]),
                    Path(harness_out) / "analysis.log"]
        # the battery report names the TestReport of this same read and
        # carries what the harness says qualifies the scores (verbatim), so
        # its Diagnosis (battery-lint) and `nmt-forge lint` relay it
        # (Round 13: a near-constant output no forge surface mentioned)
        import os

        manifest["harness_report"] = {
            "path": Path(os.path.relpath(paths["harness_report"],
                                         manifest_path.parent)).as_posix(),
            "score_caveats": paths.get("harness_score_caveats"),
            # the standard/1 headline of that TestReport (corpus chrF++,
            # CI, signature) — what lint and the report quote with it
            "headline": paths.get("harness_headline")}
        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
        md_path.write_text(render_battery_report(manifest), encoding="utf-8")
    carried = carry_mark(entry["path"], written, command=command, mark=mark)
    if carried:
        paths["mark"] = carried["mark"]
        paths["sidecars"] = carried["sidecars"]
    return report, paths


def evaluate_cli(args) -> int:
    report, paths = evaluate(
        args.run_manifest, config_path=args.config, out_hyps=args.out_hyps,
        harness_out=getattr(args, "harness_out", None),
        glossary=getattr(args, "glossary", None))
    print(report.format())
    print(f"\nwrote {paths['hyps']}, {paths['manifest']} and "
          f"{paths['report_md']}")
    if paths.get("harness_report"):
        print(f"mt-eval RunLog + TestReport: {paths['harness_runlog']} · "
              f"{paths['harness_report']}")
    print("\n(the battery report ends with a Diagnosis & Recommendations "
          "section — read it, then run `nmt-forge lint` for --json findings)")
    return 0
