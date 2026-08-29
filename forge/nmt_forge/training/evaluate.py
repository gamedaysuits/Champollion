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
             out_hyps: str | Path | None = None):
    """Decode the config's battery with the run's selected checkpoint, score it.

    Returns the BatteryReport plus the paths written (hyps, manifest, md).
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
    hyps = backend.decode(
        selected, sources,
        {"max_new_tokens": cfg.decode.max_new_tokens, **cfg.model,
         **decode_extra})

    # preserve ids so the battery join is by id, not by position
    hyp_rows = [{"id": r.get("id", i), "predicted": h}
                for i, (r, h) in enumerate(zip(brows, hyps))]
    hyps_path = Path(out_hyps) if out_hyps else \
        rmpath.with_name(rmpath.stem + "-battery-hyps.jsonl")
    hyps_path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in hyp_rows) + "\n",
        encoding="utf-8")

    plugins = tuple(load_plugins(ev.get("plugins", [])))
    if ev.get("card_plugins"):
        plugins += tuple(discover_plugins_for_language(
            ev["card_plugins"], skip_fst=True))
    conventions = _load_attr(ev["conventions"]) if ev.get("conventions") else None
    canonicalizer = (_load_attr(ev["canonicalizer"])
                     if ev.get("canonicalizer") else None)

    report = score_battery(
        ws, ev["battery"], hyp_rows,
        by=ev.get("by", "register"),
        metrics=tuple(ev.get("metrics", ["chrf++"])),
        plugins=plugins,
        conventions=conventions,
        canonicalizer=canonicalizer,
        target_lang=(cfg.language or {}).get("target", ""),
        n_bootstrap=int(ev.get("n_bootstrap", 1000)),
        seed=int(ev.get("seed", 12345)),
        config_hash=cfg.hash(),
    )
    manifest = report.to_manifest()
    manifest_path = hyps_path.with_name(hyps_path.stem + "-battery.json")
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8")
    md_path = manifest_path.with_suffix(".md")
    md_path.write_text(render_battery_report(manifest), encoding="utf-8")

    return report, {"hyps": str(hyps_path), "manifest": str(manifest_path),
                    "report_md": str(md_path)}


def evaluate_cli(args) -> int:
    report, paths = evaluate(
        args.run_manifest, config_path=args.config, out_hyps=args.out_hyps)
    print(report.format())
    print(f"\nwrote {paths['hyps']}, {paths['manifest']} and "
          f"{paths['report_md']}")
    print("\n(the battery report ends with a Diagnosis & Recommendations "
          "section — read it, then run `nmt-forge lint` for --json findings)")
    return 0
