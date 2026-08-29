"""nmt-forge CLI — thin argparse layer over the library.

Every command is a guard's library call plus printing; refusals surface as
the guard's what/why/fix message and a nonzero exit. Corpus text never
appears in command output (content-free discipline).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .errors import ForgeError
from .registry import load_rows
from .workspace import Workspace


def _ws(args) -> Workspace:
    return Workspace(args.workspace)


def _load_hyps(path: str) -> list[str]:
    p = Path(path)
    if p.suffix == ".jsonl":
        rows = load_rows(p)
        for field in ("predicted", "hypothesis"):
            if all(field in r for r in rows):
                return [str(r[field]) for r in rows]
        raise ForgeError(
            f"{p}: .jsonl hypotheses need a uniform 'predicted' or "
            "'hypothesis' field; or pass plain text (one line per row)"
        )
    return p.read_text(encoding="utf-8").splitlines()


def _print(obj) -> None:
    print(json.dumps(obj, indent=2, ensure_ascii=False))


# -- commands -----------------------------------------------------------------

def cmd_registry_add(args) -> int:
    ws = _ws(args)
    entry = ws.registry.register(
        args.name, args.path, args.role,
        source_field=args.source_field, target_field=args.target_field,
        note=args.note, allow_rotate=args.allow_rotate,
    )
    _print({args.name: entry})
    return 0


def cmd_registry_list(args) -> int:
    ws = _ws(args)
    data = {n: ws.registry.get(n) for n in ws.registry.names()}
    _print(data)
    return 0


def cmd_registry_add_harness(args) -> int:
    from .harness_data import register_harness_dataset

    ws = _ws(args)
    summary = register_harness_dataset(ws, args.dataset_id, args.role,
                                       assume_yes=args.yes)
    _print(summary)
    return 0


def cmd_split(args) -> int:
    from .guards.split_guard import group_split, write_split

    rows = load_rows(args.corpus)
    split = group_split(
        rows, test_size=args.test, dev_size=args.dev, seed=args.seed,
        source_field=args.source_field, target_field=args.target_field,
    )
    paths = write_split(split, args.out)
    if args.register:
        ws = _ws(args)
        for side, role in (("test", "test"), ("dev", "dev")):
            if side in paths:
                ws.registry.register(f"{args.register}-{side}", paths[side], role,
                                     source_field=args.source_field,
                                     target_field=args.target_field)
    _print(split.manifest)
    return 0


def cmd_verify_split(args) -> int:
    from .guards.split_guard import verify_disjoint

    sides = {Path(p).stem: load_rows(p) for p in args.sides}
    verify_disjoint(sides, source_field=args.source_field,
                    target_field=args.target_field)
    print(f"OK: {', '.join(sides)} are group-disjoint "
          "(0 shared canonical source/target keys)")
    return 0


def cmd_leak_audit(args) -> int:
    from .guards.leak_audit import assert_clean, clean, leak_audit

    ws = _ws(args)
    if args.clean_to:
        survivors, report = clean(
            args.corpus, ws, manifest_path=args.manifest,
            target_field=args.target_field or None,
        )
        out = Path(args.clean_to)
        out.write_text(
            "\n".join(json.dumps(r, ensure_ascii=False) for r in survivors) + "\n",
            encoding="utf-8",
        )
        _print(report.to_manifest())
        return 0
    fn = assert_clean if args.strict else leak_audit
    report = fn(args.corpus, ws, target_field=args.target_field or None)
    _print(report.to_manifest())
    return 0


def cmd_sample(args) -> int:
    from .guards.sample_strata import stratified_sample

    rows = load_rows(args.corpus)
    sample, manifest = stratified_sample(
        rows, args.n, cap_fraction=args.cap, key=args.key, seed=args.seed
    )
    Path(args.out).write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in sample) + "\n",
        encoding="utf-8",
    )
    _print(manifest)
    return 0


def cmd_ledger_show(args) -> int:
    ws = _ws(args)
    if args.set:
        _print(ws.ledger.spend_report(args.set))
    else:
        for e in ws.ledger.entries():
            print(json.dumps(e, ensure_ascii=False))
    return 0


def cmd_ledger_verify(args) -> int:
    ws = _ws(args)
    n = ws.ledger.verify_chain()
    print(f"OK: hash chain intact over {n} entries")
    return 0


def cmd_prereg_new(args) -> int:
    from .guards import preregister

    ws = _ws(args)
    predictions = json.loads(Path(args.predictions).read_text(encoding="utf-8"))
    path = preregister.new(
        ws, prereg_id=args.id, eval_set=args.eval_set,
        predictions=predictions, author=args.author,
        config_hash=args.config_hash, consequences=args.consequences,
        allow_after_reads=args.allow_after_reads,
    )
    print(f"preregistered → {path}")
    if args.allow_after_reads:
        print("(allow-after-reads override LEDGERED: this eval set has prior "
              "scored reads — these predictions are deltas against known "
              "baselines, not blind predictions)")
    return 0


def cmd_prereg_check(args) -> int:
    from .guards import preregister

    ws = _ws(args)
    prereg = preregister.load(ws, args.id)
    scores = json.loads(Path(args.results).read_text(encoding="utf-8"))
    if "scores" in scores:
        scores = scores["scores"]
    _print(preregister.check(prereg, scores))
    return 0


def _cli_plugins(args) -> tuple:
    from .plugins import discover_plugins_for_language, load_plugins

    plugins = tuple(load_plugins(args.plugin))
    if getattr(args, "card_plugins", None):
        plugins = plugins + tuple(discover_plugins_for_language(
            args.card_plugins, skip_fst=True))
    return plugins


def _load_hyp_rows(path: str):
    """Hypotheses preserving ids when the file carries them (battery join)."""
    p = Path(path)
    if p.suffix == ".jsonl":
        rows = load_rows(p)
        if all("id" in r for r in rows):
            return rows
        return _load_hyps(path)
    return _load_hyps(path)


def _load_attr(spec: str):
    from importlib import import_module

    module, _, attr = str(spec).partition(":")
    if not module or not attr:
        raise ForgeError(f"{spec!r} must look like 'package.module:attr'")
    return getattr(import_module(module), attr)


def cmd_score_config(args) -> int:
    """The config-driven battery: config.eval names the registered battery,
    the grouping field, the referee plugins, the boundary canonicalizer, and
    the preregistration — one file expresses the whole eval."""
    from .guards.ci_scoring import score_battery
    from .plugins import discover_plugins_for_language, load_plugins
    from .reporting import render_battery_report
    from .training.config import RunConfig

    cfg = RunConfig.from_file(args.config)
    ev = cfg.eval_battery
    if not ev:
        raise ForgeError(
            f"{args.config}: no eval block — add "
            '"eval": {"battery": "<registered set>", …} to the config'
        )
    ws = Workspace(cfg.workspace)
    plugins = tuple(load_plugins(ev.get("plugins", [])))
    if ev.get("card_plugins"):
        plugins += tuple(discover_plugins_for_language(
            ev["card_plugins"], skip_fst=True))
    conventions = _load_attr(ev["conventions"]) if ev.get("conventions") else None
    canonicalizer = (_load_attr(ev["canonicalizer"])
                     if ev.get("canonicalizer") else None)
    report = score_battery(
        ws, ev["battery"], _load_hyp_rows(args.hyps),
        by=ev.get("by", "register"),
        metrics=tuple(ev.get("metrics", ["chrf++"])),
        plugins=plugins,
        conventions=conventions,
        canonicalizer=canonicalizer,
        target_lang=(cfg.language or {}).get("target", ""),
        n_bootstrap=int(ev.get("n_bootstrap", 1000)),
        seed=int(ev.get("seed", 12345)),
        config_hash=cfg.hash(),
        override_respend=args.override_respend,
    )
    print(report.format())
    out_base = Path(args.hyps).with_suffix("")
    manifest_path = Path(args.json_out) if args.json_out else \
        out_base.with_name(out_base.name + "-battery.json")
    manifest_path.write_text(
        json.dumps(report.to_manifest(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8")
    report_md = manifest_path.with_suffix(".md")
    report_md.write_text(render_battery_report(report.to_manifest()),
                         encoding="utf-8")
    print(f"\nwrote {manifest_path} and {report_md}")
    return 0


def cmd_score(args) -> int:
    if getattr(args, "config", None):
        return cmd_score_config(args)
    from .guards.ci_scoring import DEFAULT_METRICS, score_eval_set

    if not args.eval_set:
        raise ForgeError("pass --eval-set (or --config with an eval block)")
    ws = _ws(args)
    hyps = _load_hyps(args.hyps)
    metrics = tuple(args.metric) if args.metric else DEFAULT_METRICS
    report = score_eval_set(
        ws, args.eval_set, hyps, config_hash=args.config_hash,
        metrics=metrics, plugins=_cli_plugins(args),
        target_lang=args.target_lang,
        override_respend=args.override_respend,
    )
    print(report.format())
    if args.json_out:
        Path(args.json_out).write_text(
            json.dumps(report.to_manifest(), indent=2) + "\n", encoding="utf-8"
        )
    return 0


def cmd_compare(args) -> int:
    from .guards.ci_scoring import compare_on_eval_set

    ws = _ws(args)
    metrics = tuple(args.metric) if args.metric else ("chrf++",)
    report = compare_on_eval_set(
        ws, args.eval_set, _load_hyps(args.hyps_a), _load_hyps(args.hyps_b),
        labels=(args.label_a, args.label_b), config_hash=args.config_hash,
        metrics=metrics, plugins=_cli_plugins(args),
        target_lang=args.target_lang,
        override_respend=args.override_respend,
    )
    print(report.format())
    return 0


def cmd_discover(args) -> int:
    from .cards import discover, format_report

    report = discover(args.code, cards_path=args.cards_dir,
                      check_registry=not args.no_registry)
    if args.json:
        from dataclasses import asdict

        _print(asdict(report))
    else:
        print(format_report(report))
    return 0


def cmd_init(args) -> int:
    from .scaffold import init_project

    summary = init_project(args.code, args.dir, pair=args.pair,
                           cards_path=args.cards_dir)
    _print(summary)
    return 0


def cmd_synth(args) -> int:
    from .synthesis.run import synthesize_cli

    return synthesize_cli(args)


def cmd_run(args) -> int:
    from .training.run import run_cli

    return run_cli(args)


def cmd_evaluate(args) -> int:
    from .training.evaluate import evaluate_cli

    return evaluate_cli(args)


def cmd_monitor(args) -> int:
    from .monitor import monitor_cli

    return monitor_cli(args)


def cmd_report(args) -> int:
    from .reporting import render

    print(render(args.manifest))
    return 0


def cmd_status(args) -> int:
    from .advisor import next_action, render_status, snapshot

    ws = _ws(args)
    if args.json:
        _print({"snapshot": snapshot(ws),
                "advice": next_action(ws).to_json()})
    else:
        print(render_status(ws))
    return 0


def cmd_preflight(args) -> int:
    from .advisor import preflight, render_preflight

    ws = _ws(args)
    gates = preflight(ws, args.target)
    if args.json:
        _print([g.to_json() for g in gates])
    else:
        print(render_preflight(ws, args.target))
    return 0 if all(g.ok for g in gates) else 2


def cmd_lint(args) -> int:
    import json as _json

    from .guards.battery_lint import lint_battery, render_diagnosis

    manifest = _json.loads(Path(args.manifest).read_text())
    run_manifest = (_json.loads(Path(args.run_manifest).read_text())
                    if args.run_manifest else None)
    findings = lint_battery(manifest, run_manifest=run_manifest)
    if args.json:
        _print([f.to_json() for f in findings])
    else:
        print(render_diagnosis(findings))
    return 0


# -- parser -------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="nmt-forge",
        description="NMT training suite with guardrails: group-disjoint splits, "
                    "dev fencing, leak audits, CIs by default, preregistration.",
    )
    ap.add_argument("--workspace", default=".forge",
                    help="workspace directory (default ./.forge)")
    sub = ap.add_subparsers(dest="command", required=True)

    p = sub.add_parser("discover",
                       help="what does this language have? (reads the SSOT "
                            "language card; absence = unknown, never zero)")
    p.add_argument("code", help="ISO 639-3 code (e.g. crk, fra, nav, arb)")
    p.add_argument("--cards-dir", default=None,
                   help=f"language-cards directory (default: $CHAMPOLLION_CARDS_DIR "
                        "or monorepo walk-up)")
    p.add_argument("--json", action="store_true")
    p.add_argument("--no-registry", action="store_true",
                   help="skip the mt-eval registry cross-check of eval datasets")
    p.set_defaults(func=cmd_discover)

    p = sub.add_parser("init",
                       help="scaffold a project from a language card: "
                            "workspace + starter config + NEXT_STEPS.md")
    p.add_argument("code", help="ISO 639-3 code of the TARGET language")
    p.add_argument("--dir", default=".", help="project directory (default .)")
    p.add_argument("--pair", default=None,
                   help="language pair as SRC-TGT (default eng-<code>)")
    p.add_argument("--cards-dir", default=None)
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("status",
                       help="where am I? state table + THE next command "
                            "(agents: call this first, use --json)")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("preflight",
                       help="will <command> refuse? every gate it will hit, "
                            "with fixes (exit 2 if any gate fails)")
    p.add_argument("target", help="command to preflight: run|score|split|"
                                  "prereg|leak-audit")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_preflight)

    p = sub.add_parser("lint",
                       help="diagnose a battery manifest: weak registers → "
                            "likeliest cause → the lever to pull next")
    p.add_argument("manifest", help="battery manifest json "
                                    "(guard: ci-scoring/battery)")
    p.add_argument("--run-manifest", default=None,
                   help="run manifest for schedule/transfer-plateau signals")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_lint)

    p = sub.add_parser("registry", help="eval-set registry")
    rsub = p.add_subparsers(dest="registry_command", required=True)
    pa = rsub.add_parser("add", help="register an eval file (dev|test|sealed)")
    pa.add_argument("name")
    pa.add_argument("path")
    pa.add_argument("--role", dest="role", required=True,
                    choices=("dev", "test", "sealed"))
    pa.add_argument("--source-field", default="source")
    pa.add_argument("--target-field", default=None)
    pa.add_argument("--note", default="")
    pa.add_argument("--allow-rotate", action="store_true")
    pa.set_defaults(func=cmd_registry_add)
    pl = rsub.add_parser("list")
    pl.set_defaults(func=cmd_registry_list)
    ph = rsub.add_parser("add-harness",
                         help="materialize an mt-eval registry dataset "
                              "(fetch-from-source) and register it as an "
                              "eval set — contamination flags stamped; "
                              "quarantined sets refused; do_not_train means "
                              "it can never enter a training mix")
    ph.add_argument("dataset_id")
    ph.add_argument("--role", default="test", choices=("dev", "test", "sealed"))
    ph.add_argument("--yes", action="store_true",
                    help="accept the harness's fetch prompts non-interactively")
    ph.set_defaults(func=cmd_registry_add_harness)

    p = sub.add_parser("split", help="group-disjoint train/dev/test carve")
    p.add_argument("corpus")
    p.add_argument("--test", type=int, required=True)
    p.add_argument("--dev", type=int, default=0)
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--source-field", default="source")
    p.add_argument("--target-field", default="target")
    p.add_argument("--register", default=None, metavar="PREFIX",
                   help="also register PREFIX-test / PREFIX-dev in the workspace")
    p.set_defaults(func=cmd_split)

    p = sub.add_parser("verify-split", help="zero-overlap check on existing files")
    p.add_argument("sides", nargs="+", help="train/dev/test files (any subset)")
    p.add_argument("--source-field", default="source")
    p.add_argument("--target-field", default="target")
    p.set_defaults(func=cmd_verify_split)

    p = sub.add_parser("leak-audit", help="screen a corpus vs registered evals")
    p.add_argument("corpus")
    p.add_argument("--strict", action="store_true",
                   help="hard-fail on test/sealed hits")
    p.add_argument("--clean-to", default=None,
                   help="write surviving rows here instead of failing")
    p.add_argument("--manifest", default=None)
    p.add_argument("--target-field", default=None)
    p.set_defaults(func=cmd_leak_audit)

    p = sub.add_parser("sample", help="per-kind capped reservoir sample")
    p.add_argument("corpus")
    p.add_argument("--n", type=int, required=True)
    p.add_argument("--cap", type=float, default=0.15)
    p.add_argument("--key", default="kind")
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_sample)

    p = sub.add_parser("ledger", help="eval-ledger inspection")
    lsub = p.add_subparsers(dest="ledger_command", required=True)
    ps = lsub.add_parser("show")
    ps.add_argument("--set", default=None, help="spend report for one set")
    ps.set_defaults(func=cmd_ledger_show)
    pv = lsub.add_parser("verify")
    pv.set_defaults(func=cmd_ledger_verify)

    p = sub.add_parser("prereg", help="preregistration")
    psub = p.add_subparsers(dest="prereg_command", required=True)
    pn = psub.add_parser("new")
    pn.add_argument("id")
    pn.add_argument("--eval-set", required=True)
    pn.add_argument("--predictions", required=True,
                    help="JSON file: a list of prediction objects")
    pn.add_argument("--author", default="")
    pn.add_argument("--config-hash", default=None)
    pn.add_argument("--consequences", default="")
    pn.add_argument("--allow-after-reads", action="store_true",
                    help="preregister a NEW experiment on an eval set that "
                         "already has scored reads (delta-predictions "
                         "against known baselines). The override is "
                         "ledgered — never silent.")
    pn.set_defaults(func=cmd_prereg_new)
    pc = psub.add_parser("check")
    pc.add_argument("id")
    pc.add_argument("--results", required=True,
                    help="a ScoreReport manifest JSON")
    pc.set_defaults(func=cmd_prereg_check)

    p = sub.add_parser("score", help="score hypotheses on a registered set (CIs always)")
    p.add_argument("--eval-set", default=None)
    p.add_argument("--config", default=None,
                   help="run-config path: drives the battery from its eval "
                        "block (registered battery, grouping, plugins, "
                        "canonicalizer, prereg binding) — one file, whole eval")
    p.add_argument("--hyps", required=True)
    p.add_argument("--config-hash", default=None)
    p.add_argument("--metric", action="append", default=[],
                   help="lane to score (repeatable): chrf++, bleu, "
                        "exact_match, comet, comet-qe, metricx "
                        "(default: chrf++/bleu/exact_match)")
    p.add_argument("--target-lang", default="",
                   help="ISO 639-3 target code — resolves the right neural "
                        "metric model and its low-resource warning")
    p.add_argument("--plugin", action="append", default=[],
                   help="LYSS-protocol metric plugin, 'module.path:ClassName' "
                        "(repeatable); its numeric aggregates become CI'd lanes")
    p.add_argument("--card-plugins", default=None, metavar="CODE",
                   help="run the harness's plugin discovery for this language "
                        "(card evalMetrics + FST validity + behavioral linters)")
    p.add_argument("--override-respend", default=None)
    p.add_argument("--json-out", default=None)
    p.set_defaults(func=cmd_score)

    p = sub.add_parser("compare", help="A/B on a registered set (prereg-gated)")
    p.add_argument("--eval-set", required=True)
    p.add_argument("--hyps-a", required=True)
    p.add_argument("--hyps-b", required=True)
    p.add_argument("--label-a", default="A")
    p.add_argument("--label-b", default="B")
    p.add_argument("--config-hash", default=None)
    p.add_argument("--metric", action="append", default=[],
                   help="lane to compare (repeatable; default chrf++) — "
                        "incl. comet/comet-qe/metricx")
    p.add_argument("--target-lang", default="")
    p.add_argument("--plugin", action="append", default=[],
                   help="LYSS-protocol metric plugin (repeatable)")
    p.add_argument("--card-plugins", default=None, metavar="CODE",
                   help="harness plugin discovery for this language")
    p.add_argument("--override-respend", default=None)
    p.set_defaults(func=cmd_compare)

    p = sub.add_parser("synth", help="run a language pack's synthesis")
    p.add_argument("pack",
                   help="a 'module.path:get_pack' spec (e.g. "
                        "nmt_forge_crk.pack:get_pack) or an installed pack's "
                        "entry-point name (e.g. crk)")
    p.add_argument("--out", required=True)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--limit", type=int, default=None)
    p.set_defaults(func=cmd_synth)

    p = sub.add_parser("run", help="single-command reproducible training run")
    p.add_argument("config")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("evaluate",
                       help="close the loop: decode the config's battery with "
                            "the run's SELECTED checkpoint, score it (CIs, "
                            "prereg-gated) and auto-diagnose — no manual decode")
    p.add_argument("run_manifest",
                   help="run-manifest.json written by `nmt-forge run`")
    p.add_argument("--config", default=None,
                   help="run-config path (defaults to the config embedded in "
                        "the run manifest); must carry an eval block")
    p.add_argument("--out-hyps", default=None,
                   help="where to write decoded battery hypotheses "
                        "(default: alongside the run manifest)")
    p.set_defaults(func=cmd_evaluate)

    p = sub.add_parser("monitor",
                       help="attach the human-facing GUI to a running (or "
                            "finished) run dir: loss curves + floor + a loud "
                            "stop button; read-only otherwise (new runs open "
                            "it automatically)")
    p.add_argument("run_dir", help="the run directory under <ws>/runs/")
    p.add_argument("--pid", type=int, default=None,
                   help="training process id — lets the stop button actually "
                        "kill an attached run")
    p.add_argument("--log", default=None,
                   help="the trainer's stdout log — makes the panel live "
                        "from minute one (loss every logging step + rate/ETA) "
                        "instead of waiting for the first checkpoint dump")
    p.add_argument("--port", type=int, default=8377)
    p.add_argument("--no-browser", action="store_true")
    p.set_defaults(func=cmd_monitor)

    p = sub.add_parser("report",
                       help="re-render the plain-language report from a run "
                            "or battery manifest")
    p.add_argument("manifest")
    p.set_defaults(func=cmd_report)

    return ap


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except ForgeError as e:
        print(str(e), file=sys.stderr)
        return 2
    except OSError as e:
        print(f"file error: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
