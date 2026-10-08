"""
CLI Entry Point — Command-line interface for the mt-eval harness.

Provides a clean CLI that maps arguments to RunConfig fields.
Every config parameter is exposed as a CLI flag.

The 'export' subcommand packages completed evaluations as champollion
method plugins (method.json + coaching data).

┌──────────────────────────────────────────────────────────────┐
│  DEFAULT BEHAVIOR — The harness is "fast by default":           │
│    batch_size=25, max_tokens=32768, concurrency=8, cache=on    │
│                                                                │
│  For multi-model runs, pass comma-separated models:            │
│    mt-eval run --corpus data.json -m model1,model2,model3      │
│  All models run in parallel via asyncio.gather.                │
└──────────────────────────────────────────────────────────────┘

Usage examples:
    # Basic run with optimal defaults (batch=25, cache=on, tokens=32k)
    mt-eval run --corpus data/corpus.json

    # Multi-model parallel run
    mt-eval run --corpus data/corpus.json -m gemini-3.1-pro,claude-opus-4.7,gpt-5.5

    # Gold standard segment only
    mt-eval run --corpus data/corpus.json --dataset gold_standard

    # Specific entries only
    mt-eval run --corpus data/corpus.json --ids 0,1,2,3,4

    # Dry run to validate config
    mt-eval run --corpus data/corpus.json --dry-run

    # Run the test harness on a completed run
    mt-eval test logs/run_20260509_*.json

    # Compare two runs
    mt-eval compare log1.json log2.json

    # Generate dashboard HTML
    mt-eval dashboard logs/run_*.json

    # List available models or datasets
    mt-eval list models
    mt-eval list datasets

    # Export a TestReport as a champollion method plugin
    mt-eval export --report eval/logs/report.json --name crk-v1 --type llm-coached --locales crk

    # List models with live OpenRouter catalog
    mt-eval list models --live
"""

import argparse
import asyncio
import contextlib
import io
import json
import os
import sys
from pathlib import Path

from mt_eval_harness.config import (
    RunConfig,
    DEFAULT_MODEL,
    DEFAULT_BATCH_SIZE,
    DEFAULT_MAX_TOKENS,
    DEFAULT_CONCURRENCY,
    DEFAULT_CACHE_DIR,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_MAX_TOOL_ROUNDS,
    RETIRED_MODEL_ALIASES,
    exact_model_refusal,
    load_method_card,
)
from mt_eval_harness.method_loader import MethodLoadError
from mt_eval_harness.contest_policy import (
    CONTEST_ID_HELP,
    DEFAULT_RESULTS_VISIBILITY,
    SUBMISSION_TERMS_URL,
)
from mt_eval_harness.transmission_policy import SHOW_TEXT_HELP as _SHOW_TEXT_HELP


def load_runlog(path) -> dict:
    """Load a run-log / report JSON file, failing cleanly on bad input.

    A truncated, partial, or otherwise malformed JSON file (or a missing
    one) used to surface as a raw ``JSONDecodeError`` / ``FileNotFoundError``
    traceback in ``test``, ``card``, and ``dashboard``. ``export`` already
    fails with a one-line message + exit 1; this helper gives the other
    commands the same behavior.

    Args:
        path: Path (str or Path) to a run-log or report JSON file.

    Returns:
        The parsed JSON as a dict.

    Exits:
        Prints a one-line error to stderr and calls ``sys.exit(1)`` if the
        file is missing or does not contain valid JSON.
    """
    p = Path(path)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"  ✗ File not found: {p}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(
            f"  ✗ Not a valid JSON run log: {p} ({e.msg} at line {e.lineno})",
            file=sys.stderr,
        )
        sys.exit(1)


def build_global_parser() -> argparse.ArgumentParser:
    """Shared parent parser for flags that must work in ANY position.

    ``--json`` and ``--non-interactive`` used to be defined only on the run
    parser, so ``mt-eval test log.json --json`` (flag AFTER the subcommand)
    died with argparse exit 2 + a usage wall, and ``mt-eval --json run`` (flag
    BEFORE the subcommand) silently reset ``json`` to False when the subparser
    parsed. Defining them once on a parent parser attached to BOTH the main
    parser and every subparser makes them position-independent.

    The defaults are ``argparse.SUPPRESS`` so a value set at the top level is
    never clobbered by the subparser's pass (and vice versa). All readers use
    ``getattr(args, "json"/"non_interactive", False)``, so an unset attribute
    safely reads as False.
    """
    gp = argparse.ArgumentParser(add_help=False)
    gp.add_argument(
        "--non-interactive",
        action="store_true",
        default=argparse.SUPPRESS,
        help="Never enter the guided selector, even on a TTY. Fail with a "
             "clear error if a corpus wasn't given. For scripts/agents.",
    )
    gp.add_argument(
        "--json",
        action="store_true",
        default=argparse.SUPPRESS,
        help="Emit machine-readable JSON for structured output and errors "
             "(for agents / CI). Suppresses the guided interactive selector.",
    )
    return gp


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser with all harness options."""
    global_parser = build_global_parser()
    parser = argparse.ArgumentParser(
        prog="mt-eval",
        parents=[global_parser],
        description="MT Eval Harness — Execute and evaluate translation experiments",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        # FINDING (measured 2026-09-07 on the air-gap guest's Python 3.12.3,
        # which is what Ubuntu 24.04 — the sovereign node's own OS — ships).
        # argparse classifies EVERY --token in argv against THIS parser before
        # it hands the tail to a subcommand, so a subcommand flag that is a
        # prefix of any of this parser's ~60 global options dies as "ambiguous
        # option" before the subparser ever sees it. Three SHIPPED commands
        # were broken that way and worked only on a newer Python:
        #   mt-eval list datasets --source eng   (--source-file/-field/-code)
        #   mt-eval corpora --source … --target … (same)
        #   mt-eval contest rank <id> --metric …  (--metricx/--metricx-model)
        #   mt-eval node ceremony init --m 3      (--model/--max-tokens/…)
        # Turning abbreviation off makes every flag mean the same thing on
        # every Python — the property a tool that has to run unchanged on a
        # dark node years from now needs. The cost is that main-level
        # abbreviations (`--mod` for `--model`) now fail loudly instead of
        # silently depending on the interpreter.
        allow_abbrev=False,
        epilog=(
            "SUBCOMMANDS:\n"
            "  run              Execute a translation run (default)\n"
            "  queue            Run the top of the community compute queue\n"
            "  test             Analyze a completed run log\n"
            "  publish          Submit a TestReport to the leaderboard\n"
            "  compare          Compare two or more runs (reports or run logs)\n"
            "  dashboard        Generate interactive HTML dashboard\n"
            "  list             List available models, prompts, datasets\n"
            "  corpora          List eval corpora for a language pair (X→Y)\n"
            "  recommend        Method guidance for a pair — availability + cited evidence\n"
            "  setup            Install optional dependencies (COMET, FST)\n"
            "  export           Package a TestReport as a champollion method plugin\n"
            "  export-config    Generate a champollion.config.json snippet from a TestReport\n"
            "  generate-plugin  Alias for 'export'\n"
            "  card               Pretty-print a human-readable run card\n"
            "  contest          Sovereign contests (prepare, register, create, qualify,\n"
            "                   submit-model, submit-method, rank, close)\n"
            "  node             Organizer scoring node: serve, list, approve, deny\n"
            "  shared-task      Multi-pair edition umbrella: create, list, report\n"
            "  logout           Remove stored auth credentials\n"
        ),
    )

    from mt_eval_harness import __version__
    parser.add_argument(
        "--version", action="version", version=f"%(prog)s {__version__}",
        help="Show the harness version and exit.",
    )

    sub = parser.add_subparsers(dest="command", help="Subcommand")

    # --- CARD command ---
    card_p = sub.add_parser(
        "card", help="Pretty-print a human-readable run card",
        parents=[global_parser],
    )
    card_p.add_argument(
        "log_paths", nargs="+",
        help="Run log JSON file(s) to render. Each one's report is found "
             "beside it (<log>_report.json) or where `mt-eval test -o` "
             "recorded it in the log; a report file is read with the run log "
             "it records. A run with no report shows NOT SCORED and why.")
    card_p.add_argument(
        "--report", metavar="PATH",
        help="The report to show for the ONE run log given (a report "
             "written with `mt-eval test -o` before the log recorded its "
             "path). It must be that run's report.")

    # --- RUN command ---
    run_p = sub.add_parser(
        "run", help="Execute a translation run",
        parents=[global_parser],
    )
    _add_run_args(run_p)

    # Default command (no subcommand = run)
    _add_run_args(parser)

    # --- TEST command ---
    test_p = sub.add_parser(
        "test", help="Analyze a completed run log",
        parents=[global_parser],
    )
    test_p.add_argument("log_path", help="Path to RunLog JSON file")
    test_p.add_argument(
        "-o", "--output",
        help="Output path for test report (default: alongside log file)",
    )
    test_p.add_argument(
        "--no-ci",
        action="store_true",
        help="Skip bootstrap confidence interval computation (faster)",
    )
    test_p.add_argument(
        "--n-bootstrap-ci",
        type=int,
        default=1000,
        help="Number of bootstrap iterations for CIs. Default: 1000 "
             "(matches SacreBLEU/WMT convention). Higher = more precise but slower.",
    )
    test_p.add_argument(
        "--glossary",
        help="Evaluation glossary for terminology adherence (JSON; see "
             "`mt-eval run --help`). Overrides the glossary recorded on the run.",
    )
    test_p.add_argument(
        "--skip-fst",
        action="store_true",
        help="Score without FST acceptance, even if an FST is available for "
             "the target language (marked not computed). Use in CI or when "
             "the FST cannot be installed.",
    )
    test_p.add_argument(
        "--skip-eval-standard",
        action="store_true",
        help="Score without the language card's eval-standard metrics when "
             "their package is not installed (marked not computed); the "
             "harness never installs it — the error names the pip install.",
    )

    # --- COMPARE command ---
    cmp_p = sub.add_parser(
        "compare", help="Compare two or more runs",
        parents=[global_parser],
    )
    cmp_p.add_argument(
        "log_paths", nargs="+", metavar="report",
        help="Run reports (*_report.json, what `mt-eval run` writes beside "
             "its run log) or run logs (run_*.json — the sibling "
             "_report.json is used). The first is run A, the second B, …",
    )
    cmp_p.add_argument(
        "-o", "--output",
        help="Where to write the comparison JSON (an existing file there is "
             "replaced, and the output says so). Default: "
             "comparison-<hash>.json — the hash of the compared runs' ids, so "
             "another comparison never overwrites it — beside the reports "
             "when they share a folder, else in comparisons/ in their nearest "
             "common folder (never one run's own folder; the path is "
             "printed).",
    )
    cmp_p.add_argument(
        "--significance",
        action="store_true",
        help="Decide which run is better: a paired significance test on "
             "corpus chrF++ (the scoring standard's primary metric; it alone "
             "decides), with BLEU/spBLEU/TER/COMET tested beside it and "
             "diagnostics apart — every pair, each named by its run-table "
             "letters; each Δ comes with its 95%% CI. Without it, compare "
             "shows the numbers and makes no decision",
    )
    # The paired tests significance.py implements (the package __init__
    # already imports it); the first is the default.
    from mt_eval_harness.significance import SIGNIFICANCE_METHODS
    cmp_p.add_argument(
        "--method",
        choices=SIGNIFICANCE_METHODS,
        default=SIGNIFICANCE_METHODS[0],
        help="The paired test --significance runs: approximate_randomization "
             "(default; a true two-sided significance level, SacreBLEU's "
             "default) or paired_bootstrap (Koehn 2004 sign-flip heuristic — "
             "conservative/biased, for comparison with older papers)",
    )
    cmp_p.add_argument(
        "--n-bootstrap",
        type=int,
        default=1000,
        help="Number of resampling iterations (AR trials / bootstrap resamples) "
             "for significance testing. Default: 1000",
    )
    cmp_p.add_argument(
        "--show-text", action="store_true",
        help=_SHOW_TEXT_HELP,
    )

    # --- DASHBOARD command ---
    dash_p = sub.add_parser(
        "dashboard", help="Generate interactive HTML dashboard",
        parents=[global_parser],
    )
    dash_p.add_argument("log_paths", nargs="+", help="Paths to RunLog JSON files or directories")
    dash_p.add_argument(
        "-o", "--output",
        default="dashboard_output.html",
        help="Output HTML file path",
    )
    dash_p.add_argument(
        "--watch",
        action="store_true",
        help="Watch directory for new/changed reports and auto-regenerate",
    )
    dash_p.add_argument(
        "--interval",
        type=float,
        default=5.0,
        help="Watch polling interval in seconds. Default: 5",
    )

    # --- LIST command ---
    list_p = sub.add_parser("list", help="List available models, prompts, datasets")
    list_p.add_argument(
        "what",
        choices=["models", "prompts", "datasets"],
        help="What to list",
    )
    list_p.add_argument(
        "--live",
        action="store_true",
        help="Fetch live model catalog from OpenRouter (requires API key)",
    )
    # `list datasets` filters + paging. The registry holds thousands of
    # corpora; the default view is a bounded, honest page (quarantined
    # entries hidden and COUNTED, availability derived from what the harness
    # can actually do), not a 5,000-line dump that labels everything private.
    list_p.add_argument(
        "--source", "--source-code", dest="source",
        help="datasets only: ISO 639-3 source language code filter (e.g. 'eng').",
    )
    list_p.add_argument(
        "--target", "--target-code", dest="target",
        help="datasets only: ISO 639-3 target language code filter (e.g. 'yor').",
    )
    list_p.add_argument(
        "--family",
        help="datasets only: benchmark family filter (registry_source, e.g. 'flores').",
    )
    list_p.add_argument(
        "--include-quarantined",
        action="store_true",
        help="datasets only: also list quarantined entries (catalogued, never runnable).",
    )
    list_p.add_argument(
        "--limit", type=int, default=60,
        help="datasets only: rows to show (default 60). See --all.",
    )
    list_p.add_argument(
        "--all",
        action="store_true",
        help="datasets only: show every matching row (no paging).",
    )
    list_p.add_argument(
        "--json",
        action="store_true",
        help="datasets only: emit machine-readable JSON instead of a table.",
    )

    # --- CORPORA command ---
    # "What corpora exist for pair X→Y?" — queryable, structured, and shared
    # with the guided run selector. Friendly for humans (table) and agents
    # (--json), and never interactive.
    corpora_p = sub.add_parser(
        "corpora",
        help="List eval corpora for a language pair (X→Y), or for one side",
        description=(
            "List the eval corpora available for a source→target language "
            "pair — or for one side of it (--target alone: every corpus into "
            "that language; --source alone: every corpus out of it) — with "
            "size, contamination risk, domain, license, gated status, and "
            "provider. Use --json for machine-readable output."
        ),
    )
    corpora_p.add_argument(
        "--source", "--source-code", dest="source",
        help="ISO 639-3 source language code (e.g. 'eng'). Alone, lists "
             "every corpus out of it (any target).",
    )
    corpora_p.add_argument(
        "--target", "--target-code", dest="target",
        help="ISO 639-3 target language code (e.g. 'tel'). Alone, lists "
             "every corpus into it (any source).",
    )
    corpora_p.add_argument(
        "--list-sources",
        action="store_true",
        help="List the source languages that have runnable corpora and exit.",
    )
    corpora_p.add_argument(
        "--include-quarantined",
        action="store_true",
        help=(
            "Also list quarantined corpora for the pair (catalogued, never "
            "runnable) with their quarantine reasons. Hidden by default, but "
            "always counted so an empty pair explains itself."
        ),
    )
    corpora_p.add_argument(
        "--with-fst",
        action="store_true",
        help="Only corpora whose target language has an FST this harness "
             "pins (installable with `mt-eval setup --lang <code>`, or a "
             "manual install), each with whether that FST is installed "
             "here. Works with --source/--target or alone (every pair). "
             "Downloads nothing.",
    )
    corpora_p.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON instead of a human table.",
    )

    # --- RECOMMEND command ---
    # "What method should I use for pair X→Y?" — the routing evidence
    # surface (master-plan E4): dispatchable methods with live availability,
    # cited published evidence (relative-only, provenance on every row), and
    # honest no-evidence states. Offline: reads only shared/ artifacts.
    recommend_p = sub.add_parser(
        "recommend",
        help="Method guidance for a language pair — availability + cited evidence",
        description=(
            "Show, for one source→target pair: every dispatchable method "
            "with its live availability (API key present? license lane?), "
            "the published evidence indexed for the pair (cited, never "
            "reproduced; relative-comparison-only), and which evidenced "
            "models are actually runnable here. Honest by construction: no "
            "evidence means it says so and points at runnable corpora "
            "instead of guessing. Use --json for machine-readable output."
        ),
    )
    # The pair is accepted positionally (`recommend eng yor`, the original
    # form) AND as --source/--target (the form `corpora` and `list datasets`
    # take) — users move between the three commands and typed the flag form
    # here only to be told "unrecognized arguments". Both spellings resolve
    # to the same pair in _resolve_recommend_pair(); giving both forms with
    # different codes is an error, never a silent pick.
    recommend_p.add_argument(
        "source_pos", nargs="?", metavar="source",
        help="ISO 639-3 source language code (e.g. 'eng'). "
             "Same as --source.",
    )
    recommend_p.add_argument(
        "target_pos", nargs="?", metavar="target",
        help="ISO 639-3 target language code (e.g. 'yor'). "
             "Same as --target.",
    )
    recommend_p.add_argument(
        "--source", "--source-code", dest="source_opt", metavar="CODE",
        help="ISO 639-3 source language code (alternative to the positional).",
    )
    recommend_p.add_argument(
        "--target", "--target-code", dest="target_opt", metavar="CODE",
        help="ISO 639-3 target language code (alternative to the positional).",
    )
    recommend_p.add_argument(
        "--use", dest="use_context",
        choices=["non-commercial", "commercial"],
        default="non-commercial",
        help="License lane for the guidance (commercial is STRICT: methods "
             "without a commercial-ready license are excluded with reasons).",
    )
    recommend_p.add_argument(
        "--json", action="store_true",
        help="Emit the machine-readable payload instead of the human view.",
    )

    # --- QUEUE command ---
    queue_p = sub.add_parser(
        "queue",
        help="Run the top of the community compute queue with your own key",
        description=(
            "Execute open items from the public queue "
            "(champollion.dev/queue.json), which is ranked by expected "
            "chain value — mesh improvement per estimated dollar. Items "
            "run in queue order; the plan and estimated spend are shown "
            "and confirmed before anything is executed. Results are "
            "auto-published after each run (pass --no-publish to skip)."
        ),
    )
    from mt_eval_harness.queue_runner import add_queue_arguments
    add_queue_arguments(queue_p)

    # --- PUBLISH command ---
    pub_p = sub.add_parser(
        "publish",
        help="Submit a TestReport to the leaderboard",
    )
    pub_p.add_argument(
        "report_path",
        nargs="?",
        default=None,
        help="Path to a TestReport JSON file (output of 'mt-eval test'). "
             "Omit when using --republish-dir.",
    )
    pub_p.add_argument(
        "--republish-dir",
        metavar="DIR",
        default=None,
        help="Publish EVERY *_report.json under DIR (recursive, oldest "
             "first) — the one-command recovery for a queue batch whose "
             "auto-publishes hit the anonymous rate limit. Already-published "
             "runs are skipped (read-only pre-flight, no rate-limit cost); "
             "publishing stops honestly when the intake's window is "
             "exhausted and reports what remains. No per-report prompts.",
    )
    pub_p.add_argument(
        "--method-card",
        help="Path to a method card JSON file to attach to the submission",
    )
    pub_p.add_argument(
        "-y", "--yes",
        action="store_true",
        help="Skip confirmation prompt (required for scripted/batch publishing)",
    )
    pub_p.add_argument(
        "--scores-only", "--private",
        dest="scores_only",
        action="store_true",
        help="Publish ONLY aggregate scores + corpus sha256/size (owner-attested, "
             "self-reported). Never uploads the source/reference text — use this for "
             "your own or private/confidential corpora.",
    )
    pub_p.add_argument(
        "--publish-entries",
        dest="publish_entries",
        action="store_true",
        help="Force-upload per-entry corpus content for an UNREGISTERED corpus you "
             "hold redistribution rights to. Has no effect on NC / no-deriv / "
             "held-out / quarantined corpora (their content is never exposed).",
    )
    pub_p.add_argument(
        "--redact-coaching",
        action="store_true",
        help="Publish with the coaching/system prompt text replaced by a "
             "marker (also the way past a refusal when the prompt embeds "
             "source+reference pairs of a restricted corpus). The prompt's "
             "sha256 provenance is kept; the full text stays in the local "
             "RunLog. A local-only corpus's coached prompt is redacted by "
             "default.",
    )
    pub_p.add_argument(
        "--dry-run",
        action="store_true",
        help="Assemble and PRINT the run-card payload without writing to the "
             "leaderboard (no auth, no network). Preview a publish safely.",
    )
    pub_p.add_argument(
        "--prod", "--yes-prod",
        dest="yes_prod",
        action="store_true",
        help="Explicitly authorize a write to the PRODUCTION leaderboard. Without "
             "this (or MT_EVAL_ALLOW_PROD=1) a real prod publish is refused — "
             "preview with --dry-run first.",
    )
    pub_p.add_argument(
        "--anonymous",
        action="store_true",
        help="Publish WITHOUT signing in — no account needed; the leaderboard "
             "shows submitter 'anonymous'. Goes through the anonymous intake "
             "(rate-limited per IP; same integrity gates). Sign in only if "
             "you want your name on the board.",
    )

    # --- CONTEST command ---
    contest_p = sub.add_parser(
        "contest",
        help="Sovereign contests: qualify locally, submit a model or method, "
             "rank, close",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=(
            "A CONTEST IS SOVEREIGN HOSTING (the rule since 2026-09-06). An "
            "entry is not a file of translations and not a link to a score "
            "you published yourself: it is a MODEL (weights, `submit-model`) "
            "or a METHOD (code, `submit-method`) handed to the organizer's "
            "own air-gapped node, which executes it against a sealed set "
            "that never leaves that machine and publishes the score it "
            "measured itself.\n\n"
            "The open leaderboard is a different thing and still works the "
            "old way: `mt-eval publish` puts a self-reported card on the "
            "public board, indexed by corpus × pair direction. That is not a "
            "contest and carries no prize."),
        epilog=(
            "THE FLOW (participant, then organizer):\n"
            "  1. contest qualify      self-score the PUBLIC dev set → a "
            "receipt (the admission gate)\n"
            "  2. contest validate     rehearse the node's own checks on "
            "your bundle, offline\n"
            "  3. contest submit-model / submit-method\n"
            "                          hand over the entry; declare track, "
            "parameters, licence,\n"
            "                          primary/contrastive — and accept the "
            "prize terms if any\n"
            "  4. node approve         the organizer authorizes the run "
            "(custodian gate)\n"
            "  5. node serve           the node re-runs your qualifier, "
            "executes the entry on the\n"
            "                          sealed set, and publishes (or defers) "
            "the card it measured\n"
            "  6. contest rank         provisional ranking with tie groups; "
            "contest close freezes it\n\n"
            "RETIRED 2026-09-06: `contest submit` — "
            "linking a self-reported card.\n"
            "RETIRED 2026-09-06: `contest submit-hypotheses` — uploading translations.\n"
            "Neither is a contest entry path any more; both were deleted "
            "rather than left as a trap\n"
            "that fails halfway.\n"),
    )
    contest_sub = contest_p.add_subparsers(
        dest="contest_command",
        help="Contest subcommand",
    )

    def _prize_flags(p):
        """Declare the contest's PRIZE TERM (founder ruling R1-trinary).

        The participant-facing term is ONE choice of three — pass to holders /
        retain IP / release open — not a matrix an organizer fills in. Two of
        the three offer one narrow override each; the derived detail
        (retention, rights, host use, release) follows from the choice and is
        never typed by hand. No term declared = no prize.
        """
        from mt_eval_harness.contest_policy import (
            PRIZE_DISPOSITIONS, PRIZE_RELEASE_LICENSE_ANY,
        )
        g = p.add_mutually_exclusive_group()
        g.add_argument(
            "--prize-disposition", choices=list(PRIZE_DISPOSITIONS),
            help="Declare this contest's prize terms as ONE choice of three. "
                 "pass_to_holders: the method passes to the sovereign "
                 "benchmark holders — they score it and keep it, regardless of "
                 "who wins. "
                 "retain_ip: you keep ownership of your method — the host "
                 "scores it and keeps at most a sealed copy for audit. "
                 "release_open: you keep ownership but must publish the method "
                 "under an open licence — that release is the prize condition. "
                 "The chosen term is printed in plain language with its "
                 "SHA-256 before anything is written; that hash is what "
                 "entrants pass to --accept-terms. A contest with NO declared "
                 "term has no prize — that is the default and it is not a "
                 "lesser contest")
        g.add_argument(
            "--prize-terms", metavar="JSON-FILE",
            help="Declare the same thing from a JSON file: "
                 '{"disposition": "pass_to_holders"|"retain_ip"|'
                 '"release_open"} plus only the overrides that disposition '
                 "allows. Mutually exclusive with --prize-disposition, and "
                 "checked the same way, so a term the chosen option does not "
                 "offer is refused here, at declaration time, not at ranking "
                 "time")
        p.add_argument(
            "--prize-retention",
            choices=["retain_sealed_audit", "delete_after_scoring"],
            help="retain_ip ONLY: what the host keeps. Default "
                 "retain_sealed_audit (a sealed copy, for audit and "
                 "reproduction of this result); delete_after_scoring destroys "
                 "the artifact once it has been scored. Refused on any other "
                 "option — what the host keeps follows from the term")
        p.add_argument(
            "--prize-release-timing",
            choices=["required_before_scores", "required_before_prize",
                     "required_after_prize"],
            help="release_open ONLY: when the public release falls due. "
                 "Default required_before_prize; required_before_scores holds "
                 "the entrant's scores until they publish; "
                 "required_after_prize falls due AFTER payout and is therefore "
                 "not one of the checks made before paying")
        p.add_argument(
            "--prize-release-license", metavar="SPDX",
            help=f"release_open ONLY: the licence the entrant must publish "
                 f"under — an SPDX identifier (Apache-2.0, MIT, "
                 f"AGPL-3.0-or-later) or {PRIZE_RELEASE_LICENSE_ANY} for any "
                 f"OSI-approved licence (the default)")
        p.add_argument(
            "--prize-terms-url", metavar="URL",
            help="Optional on any option: an https:// link to the host's own "
                 "written terms, shown to entrants alongside the declared "
                 "term and covered by its hash")

    def _publication_flags(p):
        """The two publication PROMISES `contest create` already carries, on
        the two organizer doors that also create a contest (prepare/register).
        Same vocabulary, same freeze: migration 074 locks both the moment the
        contest has entries."""
        p.add_argument(
            "--results-visibility",
            choices=["immediate", "hidden_until_close"],
            default=DEFAULT_RESULTS_VISIBILITY,
            help="When scored cards become visible. hidden_until_close "
                 "(default): every card is withheld (contest_deferred_results) "
                 "and published by `contest close` before the ranking "
                 "freezes — no feedback from the sealed set while the contest "
                 "runs, so nobody can tune against it. immediate: each card "
                 "publishes as the node finishes it (a live board). A "
                 "PROMISE: frozen once the contest has entries (migration 074)")
        p.add_argument(
            "--anonymize-until-close", action="store_true",
            help="Pseudonymise entrants in the ORGANIZER'S ranking artifacts "
                 "while the contest is open (revealed by `contest close`). "
                 "This does NOT anonymise the public board — a published run "
                 "card shows whatever run_cards shows. Default: off. A "
                 "PROMISE: frozen once the contest has entries (migration 074)")

    # contest create
    cc = contest_sub.add_parser("create", help="Create a new evaluation contest")
    cc.add_argument("--name", required=True, help="Contest name (e.g. 'EN→CRK Open')")
    cc.add_argument("--slug", default=None,
                    help="The contest id: lowercase letters, digits and "
                         "hyphens. Entrants pass it to `contest qualify` / "
                         "`submit-method`. Default: derived from --name "
                         "(printed when the contest is created)")
    cc.add_argument(
        "--corpus", required=True,
        help="Corpus file or dataset ID to evaluate against",
    )
    cc.add_argument(
        "--language-pair", required=True, type=_pair_arg,
        help="Language pair: 'eng>crk' (quoted — an unquoted > is a shell "
             "redirect), eng-crk, or 'eng→crk'; stored as eng>crk",
    )
    cc.add_argument(
        "--visibility", choices=["public", "private", "team"],
        default="public",
        help="Access mode. public: anyone; private: visible but scores hidden; "
             "team: invite-only. Default: public",
    )
    cc.add_argument(
        "--use-context", choices=["commercial", "non-commercial"],
        default="non-commercial",
        help="Whether this contest/prize is a commercial or non-commercial use "
             "(migration 035). A non-commercial contest MAY use NonCommercial "
             "(CC-BY-NC) datasets; a commercial contest may NOT. Quarantined "
             "corpora are never eligible in either lane. Default: non-commercial",
    )
    cc.add_argument(
        "--teams",
        help="Comma-separated team slugs (required for --visibility team)",
    )
    cc.add_argument(
        "--description", default="",
        help="Human-readable contest description",
    )
    cc.add_argument(
        "--primary-metric", default="chrf_plus_plus",
        help="Metric `contest rank`/`close` rank on, recorded as "
             "metadata.primary_metric: chrf_plus_plus (default; the scoring "
             "standard's headline) or another rankable metric — "
             "chrf_plain | bleu | spbleu | ter | comet_score | "
             "exact_match_rate (`chrf` means plain chrF). The retired "
             "composite is refused for a new contest. Frozen once any "
             "entry exists (migration 072). "
             "Tiebreaks: chrF++ → BLEU → COMET → earliest submission.",
    )
    cc.add_argument("--test-size", type=int, default=None,
                    help="Segments in the test the contest ranks on — stated "
                         "with its minimum detectable effect as the frozen "
                         "metadata.declared_power (power.py)")
    cc.add_argument("--power-pilot", nargs=2, default=None,
                    metavar=("REPORT_A", "REPORT_B"),
                    help="Two TestReports of two systems on the PUBLIC dev "
                         "set (e.g. the official baselines): their paired "
                         "outputs fit the effect parameters behind the "
                         "declared minimum detectable effect (metadata."
                         "declared_power). Without it only BLEU gets an MDE "
                         "(the labelled published prior); other metrics state "
                         "the test size and say why no MDE is given")
    cc.add_argument("--metric-model", default=None,
                    help="The neural model a model-scored primary metric "
                         "(comet_score) uses, e.g. Unbabel/wmt22-comet-da. "
                         "Required for those; recorded with the harness "
                         "version as the frozen metadata.metric_signature.")
    cc.add_argument(
        "--results-visibility", choices=["immediate", "hidden_until_close"],
        default=DEFAULT_RESULTS_VISIBILITY,
        help="When scored cards become visible. hidden_until_close "
             "(default): every card is withheld (contest_deferred_results) "
             "and published by `contest close` before the ranking freezes — "
             "no feedback from the sealed set while the contest runs, so "
             "nobody can tune against it. immediate: each card publishes as "
             "the node finishes it (a live board). A PROMISE: frozen once the "
             "contest has entries (migration 074).",
    )
    cc.add_argument(
        "--anonymize-until-close", action="store_true",
        help="Pseudonymise entrants in the ORGANIZER'S ranking artifacts "
             "while the contest is open (revealed by `contest close`). This "
             "does NOT anonymise the public board — a published run card "
             "shows whatever run_cards shows. Use --results-visibility "
             "hidden_until_close to actually hide results.",
    )
    _prize_flags(cc)

    # contest prepare — the organizer's one command: split, seal, register
    cp = contest_sub.add_parser(
        "prepare",
        help="Split a master corpus into the PUBLIC dev set (the qualifier "
             "entrants self-score on), the SEALED secret set your node "
             "executes handed-over entries against, and an optional second "
             "sealed holdout; seal them at rest and register the contest — "
             "champollion.dev/docs/network/sovereignty/run-a-sovereign-contest",
    )
    cp.add_argument("--corpus", required=True,
                    help="Master corpus file (harness JSON/JSONL/TSV). Stays local.")
    cp.add_argument("--slug", required=True,
                    help="The contest id: lowercase letters, digits and "
                         "hyphens (e.g. 'eng-crk-open-2026'). It is the id "
                         "entrants pass to `contest qualify` / "
                         "`submit-method`, the key of the node's config, and "
                         "part of every sealed-set and qualifier id")
    cp.add_argument("--name", required=True, help="Human-readable contest name")
    cp.add_argument("--pair", required=True, type=_pair_arg,
                    help="ISO 639-3 pair: 'eng>crk' (quoted — an unquoted > "
                         "is a shell redirect), eng-crk, or 'eng→crk'")
    cp.add_argument("--dev-size", type=int, required=True,
                    help="Entries in the public dev set (the qualifier)")
    cp.add_argument("--blind-size", type=int, default=0,
                    help="Entries in the OPTIONAL blind set (source released, "
                         "refs withheld). Default 0: since 2026-09-06 the blind "
                         "tier is no longer a contest entry path; it survives "
                         "only as an organizer diagnostic round.")
    cp.add_argument("--secret-size", type=int, default=0,
                    help="Entries in the T2 fully-secret set the node executes "
                         "handed-over methods against — the contest's own "
                         "corpus under R2 (default 0)")
    cp.add_argument("--sealed-holdout-size", type=int, default=0,
                    help="Entries in a SECOND sealed holdout split (default 0: "
                         "none). Sealed like the secret set, registered as its "
                         "own sealed set, named on the contest as "
                         "metadata.sealed_holdout_set_id, executed inside the "
                         "SAME authorized run, and always withheld until the "
                         "contest closes. Needs --secret-size.")
    cp.add_argument("--test-suite", action="append", default=[],
                    metavar="CORPUS-CARD-ID[=PATH]",
                    help="Declare a THIRD-PARTY public diagnostic suite every "
                         "entry is also run on (repeatable). Must be a "
                         "registered, non-quarantined, sha-pinned public "
                         "corpus card for this contest's pair, and never one "
                         "of the contest's own splits. Recorded as "
                         "metadata.test_suites and frozen once entries exist; "
                         "reported, never ranked. Prepare warns, with counts, "
                         "when a sealed row also appears in a suite (or in "
                         "the released dev set); =PATH names your local copy "
                         "of the suite for that check (its sha256 must match "
                         "the pin), else a copy already on this machine is "
                         "used (prepare downloads nothing) and a suite with "
                         "no local copy is reported as unchecked.")
    cp.add_argument("--seed", type=int, required=True,
                    help="Split seed — REQUIRED so the split is deterministic and auditable")
    cp.add_argument("--qualifier-threshold", type=float, required=True,
                    help="The score a method must reach on the public dev set "
                         "before your node runs it on the sealed set (and the "
                         "sealed holdout, if any). On the 0-100 chrF++ "
                         "scale: the qualifier score is corpus chrF++ "
                         "(sacreBLEU, word_order=2) on the dev set — the "
                         "scoring standard's headline, nothing blended in. "
                         "REQUIRED — thresholds are contest data, never a "
                         "code default.")
    cp.add_argument("--authorization-model",
                    choices=["per-submission", "blanket", "open"],
                    default=None,
                    help="Authorization posture: per-submission (custodian approves each "
                         "scoring; DEFAULT, fail-closed), blanket (qualifier pass "
                         "auto-authorizes, full audit trail), open (direct). "
                         "Unset + --shared-task: the edition's default applies")
    cp.add_argument("--intake-daily-limit", type=int, default=None,
                    help="Max submissions per participant per 24h (anti-probing; "
                         "default 5, or the edition's default with --shared-task)")
    cp.add_argument("--shared-task",
                    help="Attach this per-pair contest to a multi-pair "
                         "shared-task edition (`mt-eval shared-task create`), "
                         "e.g. 'americasnlp-2026'. Grouping + policy defaults "
                         "only — every gate stays per-contest (migration 046)")
    cp.add_argument("--custodian-group",
                    help="OPAQUE custodian group id (never a real org name "
                         "pre-consent). Required unless --plaintext-refs.")
    cp.add_argument("--threshold-pubkey",
                    help="Sealing public key (file/base64; `champollion "
                         "seal-corpus keygen`). Required unless --plaintext-refs.")
    cp.add_argument("--plaintext-refs", action="store_true",
                    help="Keep refs unencrypted on disk (refused for "
                         "per-submission authorization — see runbook)")
    cp.add_argument("--license", default=None,
                    help="REQUIRED. Licence the RELEASED files (dev set + "
                         "blind source) are offered under, as the rights-"
                         "holder grants it (SPDX id, e.g. CC-BY-4.0, "
                         "CC-BY-NC-4.0, or LicenseRef-<terms>). Never "
                         "defaulted: it gates every entrant's run")
    cp.add_argument("--do-not-train", choices=["true", "false"],
                    default=None,
                    help="The training term the RELEASED files state "
                         "(dataset.do_not_train). Read from the master's own "
                         "card first; use this when the card does not say. "
                         "It can tighten the master's term, never loosen it")
    cp.add_argument("--year", type=int,
                    help="Qualifier vintage year (default: current year)")
    cp.add_argument("--out", required=True,
                    help="Output dir (public/ = releasable, local/ = "
                         "organizer-only; run logs and caches go to runs/)")
    cp.add_argument("--visibility", choices=["public", "private", "team"],
                    default=None,
                    help="Who can see the contest. Default: public. Not frozen "
                         "by the database (no mt-eval command changes it "
                         "after registration)")
    cp.add_argument("--use-context", choices=["commercial", "non-commercial"],
                    default=None,
                    help="The use the contest is for; the corpus licence must "
                         "allow it. Default: non-commercial. FIXED AT "
                         "REGISTRATION: part of the contest's identity, which "
                         "the database never lets change (migration 072)")
    cp.add_argument("--description", default=None,
                    help="Public description of the contest. Default: none")
    cp.add_argument("--no-register", action="store_true",
                    help="Write artifacts only; print the registration plan "
                         "instead of touching Supabase")
    cp.add_argument("--closed-intake", action="store_true",
                    help="Register with intake_open=false (open it later)")
    cp.add_argument("--self-serve", action="store_true",
                    help="Register with YOUR OWN sign-in instead of the "
                         "service key (migration 046 — shared-task organizer "
                         "onboarding). Rows are identity-bound to your JWT "
                         "email; no MT_EVAL_SUPABASE_SERVICE_KEY needed.")
    cp.add_argument("--primary-metric", default=None,
                    help="Metric `contest rank`/`close` rank on "
                         "(metadata.primary_metric): chrf_plus_plus "
                         "(default; the scoring standard's headline) or "
                         "another rankable metric — chrf_plain | bleu | "
                         "spbleu | ter | comet_score | exact_match_rate. The "
                         "retired composite is refused for a new contest. "
                         "Frozen "
                         "once the contest has its first entry (migration "
                         "072)")
    cp.add_argument("--power-pilot", nargs=2, default=None,
                    metavar=("REPORT_A", "REPORT_B"),
                    help="Two TestReports of two systems on the PUBLIC dev "
                         "set (e.g. the official baselines): their paired "
                         "outputs fit the effect parameters behind the "
                         "declared minimum detectable effect (metadata."
                         "declared_power). Without it only BLEU gets an MDE "
                         "(the labelled published prior); other metrics state "
                         "the test size and say why no MDE is given")
    cp.add_argument("--metric-model", default=None,
                    help="The neural model a model-scored primary metric "
                         "(comet_score) uses, e.g. Unbabel/wmt22-comet-da. "
                         "Required for those; recorded with the harness "
                         "version as the frozen metadata.metric_signature.")
    _publication_flags(cp)
    _prize_flags(cp)
    # Unset = "not given": prepare prints each registration term as given or
    # default, and when it freezes (contest_prep.registration_term_lines) —
    # it recorded use_context=non-commercial and visibility=public without a
    # word (synthetic researcher, Round 12). The defaults themselves are
    # contest_prep.REGISTRATION_DEFAULTS.
    cp.set_defaults(visibility=None, use_context=None, description=None,
                    primary_metric=None, results_visibility=None)

    # contest register — the standalone self-serve door (046): register a
    # previously prepared contest (prepare --no-register) with the
    # organizer's own sign-in. No service key.
    cr = contest_sub.add_parser(
        "register",
        help="Self-serve: register a prepared contest (sealed set(s) + "
             "qualifier + contest row) with your own sign-in — no service "
             "key (migration 046) — champollion.dev/docs/network/sovereignty/"
             "run-a-sovereign-contest",
    )
    cr.add_argument("--manifest", required=True,
                    help="local/manifest.json written by `contest prepare` "
                         "(organizer-local; the manifest never leaves your "
                         "machine — registration sends only content-free "
                         "ids/digests/thresholds)")
    cr.add_argument("--visibility", choices=["public", "private", "team"],
                    default="public",
                    help="Who can see the contest. Not given: what `contest "
                         "prepare` recorded in the manifest, else public. Not "
                         "frozen by the database")
    cr.add_argument("--use-context", choices=["commercial", "non-commercial"],
                    default="non-commercial",
                    help="The use the contest is for. Not given: what "
                         "`contest prepare` recorded, else non-commercial. "
                         "FIXED AT REGISTRATION (migration 072: part of the "
                         "contest's identity)")
    cr.add_argument("--description", default="",
                    help="Public description. Not given: what `contest "
                         "prepare` recorded, else none")
    cr.add_argument("--closed-intake", action="store_true",
                    help="Register with intake_open=false (open it later)")
    cr.add_argument("--primary-metric", default="chrf_plus_plus",
                    help="Metric `contest rank`/`close` rank on "
                         "(metadata.primary_metric): chrf_plus_plus "
                         "(default; the scoring standard's headline) or "
                         "another rankable metric — chrf_plain | bleu | "
                         "spbleu | ter | comet_score | exact_match_rate. The "
                         "retired composite is refused for a new contest.")
    cr.add_argument("--power-pilot", nargs=2, default=None,
                    metavar=("REPORT_A", "REPORT_B"),
                    help="Two TestReports of two systems on the PUBLIC dev "
                         "set (e.g. the official baselines): their paired "
                         "outputs fit the effect parameters behind the "
                         "declared minimum detectable effect (metadata."
                         "declared_power). Without it only BLEU gets an MDE "
                         "(the labelled published prior); other metrics state "
                         "the test size and say why no MDE is given")
    cr.add_argument("--metric-model", default=None,
                    help="The neural model a model-scored primary metric "
                         "(comet_score) uses, e.g. Unbabel/wmt22-comet-da. "
                         "Required for those; recorded with the harness "
                         "version as the frozen metadata.metric_signature.")
    _publication_flags(cr)
    _prize_flags(cr)
    # Unset = "not given": `contest register` then applies what `contest
    # prepare --no-register` recorded in the manifest's registration block
    # (contest_prep.resolve_registration_choices), else the usual default.
    cr.set_defaults(visibility=None, use_context=None, description=None,
                    closed_intake=None, primary_metric=None,
                    results_visibility=None, anonymize_until_close=None)

    # contest qualify — the PUBLIC admission gate (self-scored, offline).
    # Founder ruling 2026-09-06 (R2): a contest is entered by handing a METHOD
    # to the sovereign node (submit-model / submit-method). Uploading
    # translations is retired as an entry path; the dev-set self-score it used
    # to carry lives on here as the receipt those two lanes require.
    cq = contest_sub.add_parser(
        "qualify",
        help="Self-score your system on a contest's PUBLIC dev set and write "
             "the qualifier receipt that submit-model/submit-method require",
        description=(
            "The qualifier score is corpus chrF++ (sacreBLEU, word_order=2) "
            "on the 0-100 scale — the scoring standard's headline, with "
            "nothing blended in. The organizer's node computes the same "
            "number when it re-runs your method. "
            "qualify reads the contest's qualifier id and threshold from the "
            "contest database; with --offline-qualifier-id and "
            "--offline-threshold (both published with the dev release) it "
            "touches no network at all."),
    )
    cq.add_argument("contest_id", help=CONTEST_ID_HELP)
    cq.add_argument("--dev", required=True,
                    help="Your translations of the PUBLIC dev set: one per "
                         "line in corpus order, id-keyed JSON, or the run "
                         "log `mt-eval run --corpus <dev corpus>` wrote (or "
                         "its _report.json) as it is — read by entry id, and "
                         "checked to be a run on this dev corpus")
    cq.add_argument("--dev-corpus", required=True,
                    help="The released public dev corpus file (source+refs) "
                         "— its dataset.corpus_id must BE the qualifier's")
    cq.add_argument("--system", required=True,
                    help="Your system's name. Recorded on the receipt, and "
                         "the receipt is kept per contest AND system, so "
                         "qualifying a second system never replaces the "
                         "first; re-qualifying the same system keeps the "
                         "previous receipt under history/. `submit-method` / "
                         "`submit-model --system` pick it")
    cq.add_argument("--method-class", required=True,
                    choices=["raw-llm", "coached-llm", "pipeline",
                             "custom-plugin", "api", "human"],
                    help="Claimed method class (method-card vocabulary)")
    cq.add_argument("--paradigm",
                    choices=["rule-based", "statistical", "neural-nmt",
                             "llm", "hybrid", "human", "unknown"],
                    help="Claimed paradigm (default: unknown)")
    cq.add_argument("--receipt-dir",
                    help="Where to write the receipt (default "
                         "~/.mt-eval/qualifier/<contest-id>/"
                         "<system>-<hash>.json)")
    cq.add_argument("--offline-threshold", type=float,
                    help="Fully offline: the organizer-published threshold, "
                         "on the 0-100 chrF++ qualifier scale "
                         "(with --offline-qualifier-id; no network at all)")
    cq.add_argument("--offline-qualifier-id",
                    help="Fully offline: the organizer-published qualifier id "
                         "(required with --offline-threshold)")

    # contest validate — the PARTICIPANT-RUN pre-flight (practice 5). Runs,
    # offline, exactly the checks the organizer's node runs first.
    cv = contest_sub.add_parser(
        "validate",
        help="Pre-flight your entry OFFLINE: run the node's static checks on "
             "a bundle (or model dir) and, with --dev, the dev-set alignment "
             "and self-score. A rehearsal — the node re-executes",
        description=(
            "Run, locally and offline, exactly the checks the organizer's "
            "node runs FIRST: the lane's static checks (Lane B sandbox or "
            "Lane A declarative), and — with --dev/--dev-corpus — that your "
            "dev hypotheses line up with the released dev corpus plus the "
            "self-score, checked against the qualifier receipt submit-method "
            "/ submit-model will use (validate writes no receipt — `contest "
            "qualify` does). This is a REHEARSAL: the node re-executes "
            "your bundle itself and re-runs the qualifier on its own copy of "
            "the dev set, and its measurement is the one that gates. Exit 0 "
            "means zero BLOCK findings — never that the run will score."),
    )
    cv.add_argument("path",
                    help="The bundle .tar.gz your submit command wrote, a "
                         "bundle directory (one containing manifest.json), or "
                         "a source directory with --manifest")
    cv.add_argument("--lane", choices=["method", "model"],
                    help="Force the lane (default: inferred — a Dockerfile is "
                         "Lane B, manifest.model.weightsFile is Lane A)")
    cv.add_argument("--manifest",
                    help="Pack a SOURCE directory with this manifest.json "
                         "first, so what is checked is byte-for-byte what "
                         "would be submitted")
    cv.add_argument("--method-dir", default="method",
                    help="Lane B, with --manifest: the code directory inside "
                         "the source dir (default: method)")
    cv.add_argument("--dockerfile", default="Dockerfile",
                    help="Lane B, with --manifest: the Dockerfile inside the "
                         "source dir (default: Dockerfile)")
    cv.add_argument("--secret-set",
                    help="The sealed set id the bundle targets — checked "
                         "against the manifest's declared corpus id")
    cv.add_argument("--contest",
                    help="Contest id — the --slug given to `contest prepare` "
                         "(required with --dev; your receipt is looked up "
                         "under it)")
    cv.add_argument("--dev",
                    help="Your translations of the PUBLIC dev set (one per "
                         "line, id-keyed JSON, or an `mt-eval run` run log "
                         "of the dev corpus) — turns on the qualifier "
                         "rehearsal (alignment + self-score)")
    cv.add_argument("--dev-corpus",
                    help="The released public dev corpus file (source+refs)")
    cv.add_argument("--system",
                    help="The system your qualifier receipt was written for "
                         "(`contest qualify --system`). A packed bundle "
                         "carries the receipt it was packaged with, and that "
                         "is the one checked (validate finds it on this "
                         "machine and names its system; a --system naming "
                         "another receipt is a warning). For a source "
                         "directory packed here with --manifest: the receipt "
                         "submit will embed (default: the one named like the "
                         "manifest's method, else the contest's only "
                         "receipt)")
    cv.add_argument("--method-class",
                    choices=["raw-llm", "coached-llm", "pipeline",
                             "custom-plugin", "api", "human"],
                    help="Method class for the self-score (default: the "
                         "manifest's)")
    cv.add_argument("--paradigm",
                    choices=["rule-based", "statistical", "neural-nmt",
                             "llm", "hybrid", "human", "unknown"],
                    help="Paradigm for the self-score (default: the manifest's)")
    cv.add_argument("--offline-qualifier-id",
                    help="The organizer-published qualifier id (default: the "
                         "one the bundle's own receipt names)")
    cv.add_argument("--offline-threshold", type=float,
                    help="The organizer-published threshold, on the 0-100 "
                         "chrF++ qualifier scale (default: the one the "
                         "bundle's own receipt names)")
    cv.add_argument("--receipt-dir",
                    help="Where your qualifier receipts are (default "
                         "~/.mt-eval/qualifier/<contest-id>/"
                         "<system>-<hash>.json — one per system). Read "
                         "only: validate writes no receipt")
    cv.add_argument("--json", action="store_true",
                    help="Machine-readable result on stdout (findings, "
                         "counts, ok) — banners go to stderr")

    # contest submit-method — the T2 method-execution lane (Phase B)
    csm = contest_sub.add_parser(
        "submit-method",
        help="Lane B — hand a RUNNABLE method bundle (code) to the "
             "organizer's air-gapped node for execution against the "
             "contest's sealed set: static pre-flight → deterministic "
             "tarball → authorization request (sandbox-evaluation-spec §2). "
             "Admission is your PASSING `contest qualify` receipt on the "
             "public dev set, which the node re-executes on its own copy "
             "before any grant is minted",
        description=(
            "Every submission needs: --method-dir, --dockerfile, --name, "
            "--version, --entrypoint, --method-class, --developer, --node-id, "
            "--agree, a passing `mt-eval contest qualify` receipt, and the "
            "declarations --track and --parameter-count. With "
            "--parameter-count above 0 also --weights-license and one of "
            "--weights-public/--weights-private; a method with no trained "
            "weights passes --parameter-count 0 and neither. --track "
            "constrained also needs --training-data-file. --offline also "
            "needs --bundle-out, --secret-set, --pair, --developer-email, "
            "--offline-qualifier-id and --offline-threshold. A contest that "
            "declares prize terms needs --accept-terms; one that sets "
            "require_description needs --description-file."),
    )
    csm.add_argument("contest_id", help=CONTEST_ID_HELP)
    csm.add_argument("--method-dir", required=True,
                     help="Directory with your method's code/weights/config. "
                          "Packed as method/ in the bundle and mounted "
                          "read-only at /method on the node, so "
                          "<method-dir>/translate.py runs as "
                          "/method/translate.py")
    csm.add_argument("--dockerfile", required=True,
                     help="Dockerfile that builds WITHOUT network access "
                          "(all dependencies vendored — spec §3.3)")
    csm.add_argument("--name", required=True, help="Method name")
    csm.add_argument("--version", required=True, help="Method version")
    csm.add_argument("--entrypoint", required=True,
                     help="The script the node runs (stdin sources → stdout "
                          "translations, spec §2.2), as its path inside "
                          "--method-dir, e.g. translate.py for "
                          "<method-dir>/translate.py. Its bundle path "
                          "(method/translate.py) is accepted too; an "
                          "ambiguous name is refused with both readings")
    csm.add_argument("--method-class", required=True,
                     choices=["raw-llm", "coached-llm", "pipeline",
                              "custom-plugin", "api", "human"],
                     help="Method class (method-card vocabulary; "
                          "execution-verified in this lane)")
    csm.add_argument("--paradigm",
                     choices=["rule-based", "statistical", "neural-nmt",
                              "llm", "hybrid", "human", "unknown"],
                     help="Paradigm (default: unknown)")
    csm.add_argument("--description", default="",
                     help="One-line method description")
    csm.add_argument("--developer", required=True,
                     help="Developer name (manifest.developer.name)")
    csm.add_argument("--developer-email",
                     help="Only for --offline; online it must match your "
                          "login identity")
    csm.add_argument("--affiliation", default="", help="Affiliation")
    csm.add_argument("--agree", action="store_true",
                     help="REQUIRED: you have read and agree to the "
                          "method-submission terms framework "
                          f"({SUBMISSION_TERMS_URL})")
    csm.add_argument("--node-id", required=True,
                     help="The ORGANIZER-ADVERTISED scoring node id — the "
                          "request fingerprint binds your method to it")
    csm.add_argument("--corpus-version", default="v1",
                     help="Sealed corpus version (organizer-advertised; "
                          "default v1)")
    csm.add_argument("--secret-set",
                     help="Sealed set id (auto-resolved from the contest "
                          "when unambiguous; required with --offline)")
    csm.add_argument("--pair", type=_pair_arg,
                     help="Language pair: 'eng>crk' (quoted — an unquoted > "
                          "is a shell redirect) or eng-crk (only for "
                          "--offline; online it comes from the contest)")
    csm.add_argument("--bundle-out",
                     help="Also write a sneakernet exchange dir for "
                          "true-airgap contests (mt-eval node import-bundle)")
    csm.add_argument("--offline", action="store_true",
                     help="No network at all: package + --bundle-out only")
    # --- Declared requirements (manifest.requirements). The node refuses a
    # bundle that asks for more than its configured sandbox caps, so a method
    # that needs almost nothing must be able to SAY so. The defaults are what
    # the shipped `node init` template allows (contest_declarations.
    # DEFAULT_REQUIREMENTS, read from that template), so a default-packaged
    # bundle runs on a default-configured node — they used to be 8/10/120
    # against the template's 4/4/30 (Round 3 researcher persona, 2026-10-03).
    from mt_eval_harness.contest_declarations import (
        DEFAULT_REQUIREMENTS as _REQ,
    )
    csm.add_argument("--ram-gb", type=int, default=_REQ["ramGB"],
                     help=f"RAM your method needs, GB (default {_REQ['ramGB']}"
                          f", what the shipped `node init` template allows). "
                          f"The node refuses a bundle that exceeds its "
                          f"sandbox.max_ram_gb — if the organizer's node "
                          f"allows more and your method needs it, say so here")
    csm.add_argument("--disk-gb", type=int, default=_REQ["diskGB"],
                     help=f"Scratch disk your method needs, GB (default "
                          f"{_REQ['diskGB']}, the template's "
                          f"sandbox.max_tmp_gb)")
    csm.add_argument("--max-runtime-minutes", type=int,
                     default=_REQ["maxRuntimeMinutes"],
                     help=f"Wall-clock budget your method needs, minutes "
                          f"(default {_REQ['maxRuntimeMinutes']}, the "
                          f"template's sandbox.max_runtime_minutes); the node "
                          f"refuses more than its sandbox.max_runtime_minutes")
    csm.add_argument("--gpu", action="store_true",
                     help="Declare that the method needs a GPU. A node "
                          "without one refuses the bundle rather than running "
                          "it slowly and calling the result a score")
    csm.add_argument("--gpu-memory-gb", type=int, default=0,
                     help="GPU memory the method needs, GB (with --gpu)")
    # --- Entry declarations (contract C2). Recorded on the submission and
    # shown in every ranking artifact. The node cross-checks parameterCount
    # for Lane A (submit-model) against the safetensors header; the rest are
    # declarations recorded on the submission, not measurements.
    csm.add_argument("--track", required=True,
                     choices=["constrained", "unconstrained"],
                     help="REQUIRED declaration: 'constrained' = trained only "
                          "on the data the organizer declared allowed (needs "
                          "--training-data-file); 'unconstrained' = anything. "
                          "Ranked in separate partitions. Recorded as your "
                          "claim — there is no default and nothing infers it "
                          "for you")
    csm.add_argument("--parameter-count", required=True, type=int,
                     help="REQUIRED declaration: total trainable parameters of "
                          "the system you are entering. In this code lane it "
                          "is recorded as your claim (nothing can check it). "
                          "In the Lane A model lane the count is the one the "
                          "weights FILE stores — the sum of tensor sizes in "
                          "the safetensors header — which can differ from a "
                          "count taken in torch (tied weights stored once, "
                          "tables not saved). Pass 0 for a method with no "
                          "trained weights (rule-based, dictionary, FST): it "
                          "then declares no weights licence or openness. A "
                          "method that prompts an LLM counts the parameters "
                          "of every model the bundle runs, the LLM included "
                          "(with the LLM's licence as --weights-license); "
                          "one calling a hosted LLM cannot enter (no network "
                          "on the node)")
    csm.add_argument("--weights-license",
                     help="REQUIRED when --parameter-count is above 0: the "
                          "licence of the weights your method uses — an SPDX "
                          "id (Apache-2.0, CC-BY-NC-4.0, …) or a LicenseRef-… "
                          "name. Recorded as your claim; it is what a prize "
                          "or reuse conversation starts from. Leave it out "
                          "with --parameter-count 0 (no weights)")
    csm_weights = csm.add_mutually_exclusive_group()
    csm_weights.add_argument(
        "--weights-public", dest="weights_public", action="store_true",
        help="One of --weights-public/--weights-private is REQUIRED when "
             "--parameter-count is above 0: the weights are publicly "
             "downloadable. Recorded as your claim")
    csm_weights.add_argument(
        "--weights-private", dest="weights_public", action="store_false",
        help="The weights are not public. Recorded as your claim")
    csm.set_defaults(weights_public=None)
    csm.add_argument("--training-data-file",
                     help="Path to a plain-text list of the corpora you "
                          "trained on (≤2000 chars). REQUIRED with --track "
                          "constrained — the track claim means nothing without "
                          "the data list it is a claim about")
    csm_primary = csm.add_mutually_exclusive_group()
    csm_primary.add_argument(
        "--primary", dest="is_primary", action="store_true", default=True,
        help="This is your team's PRIMARY entry (default). Exactly one primary "
             "per team is ranked for the win")
    csm_primary.add_argument(
        "--contrastive", dest="is_primary", action="store_false",
        help="This is a contrastive entry: scored and reported in its own "
             "section, never a winner")
    csm.add_argument("--description-file",
                     help="Path to your system description (≤4000 chars) — how "
                          "the system was built, in your own words. REQUIRED "
                          "when the contest sets require_description")
    csm.add_argument("--method-release-url",
                     help="Optional https:// URL where the method is publicly "
                          "released. Public information recorded on the "
                          "submission; it is never a condition of ranking")
    csm.add_argument("--accept-terms", metavar="SHA256",
                     help="Accept this contest's declared PRIZE TERMS by their "
                          "SHA-256 hash. REQUIRED when the contest declares "
                          "any: the contest declares ONE of three options — "
                          "pass to holders, retain IP, or release open — "
                          "which settles who keeps the method and whether "
                          "you must publish it, "
                          "so nothing is assumed on your behalf. Run without "
                          "it once and the terms are printed in plain language "
                          "with the hash to pass back. Your acceptance is "
                          "packed into the bundle and covered by method_sha, "
                          "and the organizer's node refuses a bundle that "
                          "accepted anything else")
    csm.add_argument("--receipt-dir",
                     help="Where to read the qualifier receipt from "
                          "(default ~/.mt-eval/qualifier/<contest-id>/, one "
                          "receipt per system). A PASSING receipt "
                          "from `mt-eval contest qualify` is required; the "
                          "node re-executes your bundle on the same public dev "
                          "set and denies on a miss")
    csm.add_argument("--system",
                     help="Which system's qualifier receipt this submission "
                          "uses: the name given to `contest qualify "
                          "--system`. Default: the receipt for --name, else "
                          "the contest's only receipt; several and none "
                          "matching is refused with the list")
    csm.add_argument("--offline-threshold", type=float,
                     help="REQUIRED with --offline: the qualifier threshold "
                          "the organizer published, on the 0-100 chrF++ "
                          "qualifier scale (offline there is nothing to look "
                          "it up against)")
    csm.add_argument("--offline-qualifier-id",
                     help="REQUIRED with --offline: the qualifier id the "
                          "organizer published; it must match your receipt")

    # contest submit-model — the DECLARATIVE-MODEL lane (Lane A, default)
    csmo = contest_sub.add_parser(
        "submit-model",
        help="Propose a DECLARATIVE neural-MT model (safetensors weights + "
             "declarative tokenizer + config) against a contest's secret set. "
             "No Dockerfile, no code: the organizer runs the weights in its "
             "own trusted engine, so the submission is validated code-free "
             "(model_runner.py). The safer, preferred lane for standard NMT.",
    )
    csmo.add_argument("contest_id", help=CONTEST_ID_HELP)
    csmo.add_argument("--model-dir", required=True,
                      help="Directory with config.json + model.safetensors + "
                           "tokenizer files at its ROOT (from_pretrained shape)")
    csmo.add_argument("--name", required=True, help="Model name")
    csmo.add_argument("--version", required=True, help="Model version")
    csmo.add_argument("--architecture", required=True,
                      help="The model architecture (any architecture the "
                           "organizer's engine implements natively — e.g. "
                           "MarianMTModel, M2M100ForConditionalGeneration, "
                           "MBart/T5/Pegasus/… — hosts are PERMISSIVE by "
                           "default; a careful host may pin an allowlist)")
    csmo.add_argument("--method-class", required=True,
                      choices=["raw-llm", "coached-llm", "pipeline",
                               "custom-plugin", "api", "human"],
                      help="Method class (method-card vocabulary)")
    csmo.add_argument("--paradigm", default="neural-nmt",
                      choices=["neural-nmt"],
                      help="Only neural-nmt runs declaratively (default)")
    csmo.add_argument("--description", default="",
                      help="One-line model description")
    csmo.add_argument("--developer", required=True, help="Developer name")
    csmo.add_argument("--developer-email",
                      help="Only for --offline; online it must match your login")
    csmo.add_argument("--affiliation", default="", help="Affiliation")
    csmo.add_argument("--agree", action="store_true",
                      help="REQUIRED: you agree to the method-submission terms")
    csmo.add_argument("--node-id", required=True,
                      help="The ORGANIZER-ADVERTISED scoring node id")
    csmo.add_argument("--corpus-version", default="v1",
                      help="Sealed corpus version (default v1)")
    csmo.add_argument("--secret-set",
                      help="Sealed set id (required with --offline)")
    csmo.add_argument("--pair", type=_pair_arg,
                      help="Language pair: 'eng>crk' (quoted — an unquoted "
                           "> is a shell redirect) or eng-crk (--offline)")
    csmo.add_argument("--weights-file", default="model.safetensors",
                      help="Weights filename in the bundle (default "
                           "model.safetensors; MUST be safetensors)")
    csmo.add_argument("--config-file", default="config.json",
                      help="Config filename (default config.json)")
    csmo.add_argument("--src-lang-token",
                      help="Tokenizer source language code (NLLB/M2M-style)")
    csmo.add_argument("--tgt-lang-token",
                      help="Tokenizer target language code (forced BOS)")
    csmo.add_argument("--bundle-out",
                      help="Also write a sneakernet exchange dir")
    csmo.add_argument("--offline", action="store_true",
                      help="No network at all: package + --bundle-out only")
    # --- Entry declarations (contract C2). Recorded on the submission and
    # shown in every ranking artifact. In THIS lane the node cross-checks
    # parameterCount against the safetensors header; the rest are declarations
    # recorded on the submission, not measurements.
    csmo.add_argument("--track", required=True,
                      choices=["constrained", "unconstrained"],
                      help="REQUIRED declaration: 'constrained' = trained only "
                           "on the data the organizer declared allowed; "
                           "'unconstrained' = anything. Ranked in separate "
                           "partitions. Recorded as your claim — there is no "
                           "default and nothing infers it for you")
    csmo.add_argument("--parameter-count", required=True, type=int,
                      help="REQUIRED declaration: total parameters of the "
                           "submitted model, COUNTED THE WAY THE WEIGHTS FILE "
                           "STORES THEM — the sum of tensor sizes in the "
                           "safetensors header (--weights-file). THIS lane "
                           "checks it: a claim off by more than 1%% is "
                           "refused before upload and again on the node. "
                           "A count taken in torch (sum(p.numel() …)) can "
                           "differ: a tied or shared weight is stored once, "
                           "and a table the model rebuilds at load (e.g. "
                           "sinusoidal positions) may not be saved. A refusal "
                           "prints the file's count — declare that")
    csmo.add_argument("--weights-license", required=True,
                      help="REQUIRED declaration: the licence of these weights "
                           "— an SPDX id (Apache-2.0, CC-BY-NC-4.0, …) or a "
                           "LicenseRef-… name. Recorded as your claim")
    csmo_weights = csmo.add_mutually_exclusive_group(required=True)
    csmo_weights.add_argument(
        "--weights-public", dest="weights_public", action="store_true",
        help="REQUIRED (with --weights-private): the weights are publicly "
             "downloadable. Recorded as your claim")
    csmo_weights.add_argument(
        "--weights-private", dest="weights_public", action="store_false",
        help="The weights are not public. Recorded as your claim")
    csmo.add_argument("--training-data-file",
                      help="Path to a plain-text list of the corpora you "
                           "trained on (≤2000 chars). REQUIRED with --track "
                           "constrained — the track claim means nothing "
                           "without the data list it is a claim about")
    csmo_primary = csmo.add_mutually_exclusive_group()
    csmo_primary.add_argument(
        "--primary", dest="is_primary", action="store_true", default=True,
        help="This is your team's PRIMARY entry (default). Exactly one primary "
             "per team is ranked for the win")
    csmo_primary.add_argument(
        "--contrastive", dest="is_primary", action="store_false",
        help="This is a contrastive entry: scored and reported in its own "
             "section, never a winner")
    csmo.add_argument("--description-file",
                      help="Path to your system description (≤4000 chars) — "
                           "how the model was built, in your own words. "
                           "REQUIRED when the contest sets require_description")
    csmo.add_argument("--method-release-url",
                      help="Optional https:// URL where the model is publicly "
                           "released. Public information recorded on the "
                           "submission; it is never a condition of ranking")
    csmo.add_argument("--accept-terms", metavar="SHA256",
                      help="Accept this contest's declared PRIZE TERMS by "
                           "their SHA-256 hash. REQUIRED when the contest "
                           "declares any: the contest declares ONE of three "
                           "options — pass to holders, retain IP, or release "
                           "open — which settles who keeps the model and "
                           "whether you must publish it, so nothing is "
                           "assumed on your behalf. "
                           "Run without it once and the terms are printed in "
                           "plain language with the hash to pass back. Your "
                           "acceptance is packed into the bundle and covered "
                           "by method_sha, and the organizer's node refuses a "
                           "bundle that accepted anything else")
    csmo.add_argument("--receipt-dir",
                      help="Where to read the qualifier receipt from "
                           "(default ~/.mt-eval/qualifier/<contest-id>/, one "
                           "receipt per system). A PASSING receipt "
                           "from `mt-eval contest qualify` is required; the "
                           "node re-executes your model on the same public dev "
                           "set and denies on a miss")
    csmo.add_argument("--system",
                      help="Which system's qualifier receipt this submission "
                           "uses: the name given to `contest qualify "
                           "--system`. Default: the receipt for --name, else "
                           "the contest's only receipt; several and none "
                           "matching is refused with the list")
    csmo.add_argument("--offline-threshold", type=float,
                      help="REQUIRED with --offline: the qualifier threshold "
                           "the organizer published, on the 0-100 chrF++ "
                           "qualifier scale (offline there is nothing to "
                           "look it up against)")
    csmo.add_argument("--offline-qualifier-id",
                      help="REQUIRED with --offline: the qualifier id the "
                           "organizer published; it must match your receipt")

    # contest method-status — poll a T2 proposal
    cms = contest_sub.add_parser(
        "method-status",
        help="Show a method proposal's authorization state + audit trail",
    )
    cms.add_argument("request_id", help="authreq-… id")

    # contest status — poll your submissions
    cst = contest_sub.add_parser(
        "status",
        help="Show entry lifecycle(s) for a method request or a whole contest",
    )
    cst.add_argument("id", help="authreq-… id or a contest id (the --slug "
                                "given to `contest prepare`)")

    # contest list
    cl = contest_sub.add_parser("list", help="List active contests")
    cl.add_argument(
        "--status", choices=["open", "closed", "all"], default="open",
        help="Filter by status. Default: open",
    )
    cl.add_argument(
        "--language-pair", type=_pair_arg,
        help="Filter by language pair: 'eng>crk' (quoted) or eng-crk",
    )

    # contest submissions (view submissions for a contest)
    csub = contest_sub.add_parser(
        "submissions", help="List submissions for a contest",
    )
    csub.add_argument("contest_id", help=CONTEST_ID_HELP)

    # --- The competition half: intake toggles, rank, close, export ---------
    # Lifecycle: open → closed → archived, one-way (migration 072). Ranking
    # SSOT: mt_eval_harness/contest_rank.py. Verified-only by default.
    coi = contest_sub.add_parser(
        "open-intake",
        help="Open ENTRY intake on a contest you own "
             "(contests.intake_open=true via your own sign-in; the admission "
             "triggers read it beneath every client, so submit-model / "
             "submit-method are admitted while it is true)",
    )
    coi.add_argument("contest_id", help=CONTEST_ID_HELP)

    cci = contest_sub.add_parser(
        "close-intake",
        help="Stop accepting NEW entries without closing the contest — "
             "further submit-model / submit-method proposals are refused at "
             "the door; entries already accepted keep flowing through the "
             "organizer's node (authorize → execute → publish) and "
             "rank/close still work",
    )
    cci.add_argument("contest_id", help=CONTEST_ID_HELP)

    def _verdict_flags(p):
        p.add_argument("--node-verdicts", default=None,
                       help="Signed verdicts file from `mt-eval node verdicts` "
                            "(a SEALED contest's paired tests, computed on the "
                            "organizer node over the sealed references). Used "
                            "as rung-1 evidence for adjacent pairs; refused "
                            "unless it verifies and matches this contest's "
                            "metric and frozen tie policy")
        p.add_argument("--verify-key", default=None,
                       help="The node's score-sign PUBLIC key (.pub.json) that "
                            "--node-verdicts must verify against")

    def _tie_flags(p):
        p.add_argument("--include-unverified", action="store_true",
                       help="Rank trust=unverified (self-reported) cards too. "
                            "Default is VERIFIED-ONLY (the public rules "
                            "promise it); hidden cards are counted in a "
                            "banner and the choice is recorded as trust_policy")
        # Every tie flag defaults to None so the contest's OWN frozen policy
        # (contests.metadata, migration 074) governs. A flag may only TIGHTEN a
        # frozen promise — a smaller --alpha, more --n-resamples; loosening it,
        # or changing the test or the seed, is a refusal naming both values.
        p.add_argument("--tie-test", choices=["ar", "bootstrap"], default=None,
                       help="Per-segment paired test for adjacent pairs: ar = "
                            "approximate randomization (Riezler & Maxwell "
                            "2005); bootstrap = Koehn 2004 sign-flip (a "
                            "conservative heuristic, not a true ASL). Used "
                            "only when BOTH cards carry complete "
                            "run_card_entries. Default: the contest's frozen "
                            "metadata.tie_test, else ar — a frozen test cannot "
                            "be replaced from the command line")
        p.add_argument("--n-resamples", type=int, default=None,
                       help="Resampling trials for the paired test. Default: "
                            "the contest's frozen metadata.n_resamples, else "
                            "1000 (only MORE resamples may be requested "
                            "against a frozen policy)")
        p.add_argument("--alpha", type=float, default=None,
                       help="Significance level. Default: the contest's frozen "
                            "metadata.alpha, else 0.05 (only a SMALLER alpha "
                            "may be requested against a frozen policy)")
        p.add_argument("--seed", type=int, default=None,
                       help="RNG seed for the paired test. Default: the "
                            "contest's frozen metadata.seed, else 12345 (a "
                            "frozen seed is the reproducibility promise and "
                            "cannot be changed here)")
        p.add_argument("--no-segments", action="store_true",
                       help="Skip run_card_entries entirely: ties fall to "
                            "CI overlap → point equality (what sealed "
                            "contests get anyway)")

    def _view_flags(p):
        """Which slice of the contest the ranking covers (rank/export).

        The vocabularies come from contest_policy — the same tuples migration
        074 writes into the database as CHECK constraints — so a phase or a
        track can never be spelled one way here and another way there.
        """
        from mt_eval_harness.contest_policy import PHASE_NAMES, TRACKS
        p.add_argument("--phase", choices=list(PHASE_NAMES) + ["all"],
                       default=None,
                       help="Which contest phase to rank. Default: the "
                            "'evaluation' phase when the contest's entries "
                            "declare phases at all, every entry otherwise. A "
                            "'practice' ranking is a rehearsal and is labelled "
                            "not-freezable")
        p.add_argument("--track", choices=list(TRACKS), default=None,
                       help="Show only this entry track. Tracks are ALWAYS "
                            "ranked separately (a constrained system is never "
                            "ranked against an unconstrained one); this only "
                            "narrows the view, and the filtered entries are "
                            "listed under exclusions with the reason")
        p.add_argument("--include-contrastive", action="store_true",
                       help="Also print the contrastive section (entries a "
                            "team submitted as NOT their primary). Contrastive "
                            "entries are always present in --json/CSV; they "
                            "are never ranked against primaries and never win")

    crk = contest_sub.add_parser(
        "rank",
        help="Provisional ranking of a contest's entries: primary metric "
             "(--metric | metadata.primary_metric | chrF++), best first in "
             "its own direction → chrF++ → "
             "BLEU → COMET → earliest submission; adjacent pairs tested "
             "(per-segment AR → CI overlap → point equality) and non-"
             "significant pairs share a rank (1,1,3). Read-only; never "
             "prompts for a login",
    )
    crk.add_argument("contest_id", help=CONTEST_ID_HELP)
    crk.add_argument("--metric",
                     help="Override the ranking metric for THIS view: "
                          "any rankable registry metric (`chrf` = plain chrF) "
                          "(the recorded metadata.primary_metric is what "
                          "`close` freezes)")
    _tie_flags(crk)
    _verdict_flags(crk)
    _view_flags(crk)
    crk.add_argument("--reveal-identities", action="store_true",
                     help="Show declared identities on a contest that promised "
                          "metadata.anonymize_until_close. Permitted only when "
                          "you OWN the contest AND it is already closed (the "
                          "promise expires at close) — otherwise pass "
                          "--i-am-the-organizer to assert standing, which is "
                          "recorded in identity_policy.source. Email-shaped "
                          "values are masked either way")
    crk.add_argument("--i-am-the-organizer", action="store_true",
                     help="Assert organizer standing for --reveal-identities "
                          "on a contest that is still open (the harness cannot "
                          "verify this from outside the database, so it is "
                          "recorded rather than trusted silently)")
    crk.add_argument("--json", action="store_true",
                     help="Emit the ranking as JSON on stdout (banners go "
                          "to stderr) — the same shape `close` freezes and "
                          "`export` emits")

    ccl = contest_sub.add_parser(
        "close",
        help="Close a contest you own and FREEZE its ranking (one-way: open "
             "→ closed; intake shuts). Ranks on the RECORDED primary metric "
             "only, refuses while intake work is in flight (--force), shows "
             "the table and asks before writing metadata.final_ranking",
    )
    ccl.add_argument("contest_id", help=CONTEST_ID_HELP)
    _verdict_flags(ccl)
    ccl.add_argument("--force", action="store_true",
                     help="Close even with intake submissions still in flight "
                          "(they stay listed under pending_intake, unranked)")
    ccl.add_argument("--yes", "-y", action="store_true",
                     help="Skip the confirmation prompt (scripted closes)")
    # The anonymity promise is "anonymize UNTIL CLOSE", so a close reveals by
    # default — but both directions are spelled out, because a frozen ranking
    # is the permanent record of who entered.
    ccl.add_argument("--reveal-identities", dest="reveal_identities",
                     action="store_true", default=None,
                     help="Freeze the ranking with declared identities (the "
                          "default: metadata.anonymize_until_close promises "
                          "anonymity UNTIL close, and this is the close). "
                          "Email-shaped values stay masked either way")
    ccl.add_argument("--no-reveal-identities", dest="reveal_identities",
                     action="store_false",
                     help="Freeze the ranking with pseudonyms instead of "
                          "declared identities — the entrants stay unnamed in "
                          "the permanent record")
    _tie_flags(ccl)

    # Vocabulary SSOT for the export view flags — the same tuples migration
    # 074 writes into the database as CHECK constraints.
    from mt_eval_harness import contest_policy
    cex = contest_sub.add_parser(
        "export",
        help="Export a contest's ranking: the FROZEN metadata.final_ranking "
             "snapshot for a closed contest (verbatim), or a live ranking "
             "labelled provisional for an open one",
    )
    cex.add_argument("contest_id", help=CONTEST_ID_HELP)
    cex.add_argument("--format", choices=["json", "csv"], default="json",
                     help="json (the full ranking dict) or csv (one row per "
                          "entry: the main set, then the contrastive section, "
                          "then other sets — with rank_min/rank_max, "
                          "is_primary, track, phase, prize_eligible and the "
                          "byline as submitter_label_or_pseudonym). Default json")
    cex.add_argument("--out", help="Write to this path instead of stdout")
    cex.add_argument("--metric",
                     help="Open contests only: rank the provisional export "
                          "on this metric")
    cex.add_argument("--include-unverified", action="store_true",
                     help="Open contests only: include self-reported cards "
                          "in the provisional export")
    cex.add_argument("--no-segments", action="store_true",
                     help="Open contests only: skip per-segment evidence")
    cex.add_argument("--phase", choices=list(contest_policy.PHASE_NAMES) + ["all"],
                     default=None,
                     help="Open contests only: which phase the provisional "
                          "export covers (default: 'evaluation' when entries "
                          "declare phases, every entry otherwise)")
    cex.add_argument("--track", choices=list(contest_policy.TRACKS), default=None,
                     help="Open contests only: export a single entry track "
                          "(tracks are ranked separately regardless)")

    chd = contest_sub.add_parser(
        "select-for-human-eval",
        help="Allocate a human-evaluation BUDGET over a closed contest's "
             "frozen ranking: the top-N primary entries per declared track, "
             "keeping a tie group whole when the budget line falls inside it "
             "(so the selection may exceed the budget — both numbers are "
             "reported). Records NO judgment: ratings are the Speaker "
             "Validation lane, which does not exist yet",
    )
    chd.add_argument("contest_id", help=CONTEST_ID_HELP)
    chd.add_argument("--budget", type=int, required=True,
                     help="How many systems per track the human campaign can "
                          "afford (≥ 1)")
    chd.add_argument("--no-keep-tie-groups", action="store_true",
                     help="Cut hard at the budget even when that splits a tie "
                          "group the significance test could not separate "
                          "(default: keep the group whole and report the "
                          "overrun)")
    chd.add_argument("--json", action="store_true",
                     help="Emit the selection as JSON on stdout")
    chd.add_argument("--write", action="store_true",
                     help="Write it to contests.metadata.human_eval_selection "
                          "(owner only; allowed only after close — the "
                          "migration 074 guard enforces the same rule)")

    # --- NODE command — the ORGANIZER'S self-hosted scoring node -----------
    node_p = sub.add_parser(
        "node",
        help="Organizer scoring node: poll intake, gate on the public "
             "qualifier, authorize per contest policy, score against "
             "organizer-held secret refs, publish scores-only — "
             "champollion.dev/docs/network/sovereignty/sovereign-eval-node",
    )
    node_sub = node_p.add_subparsers(dest="node_command", help="Node subcommand")

    nin = node_sub.add_parser(
        "init",
        help="Write a starter node.json to fill in — every key a scoring "
             "node reads, including the public qualifier gate")
    nin.add_argument("--config",
                     help="Where to write it (default ~/.mt-eval/node.json)")
    nin.add_argument("--print", action="store_true", dest="print_only",
                     help="Print the template instead of writing a file")
    nin.add_argument("--force", action="store_true",
                     help="Replace an existing file at that path")
    nin.add_argument("--from-contest", metavar="DIR_OR_MANIFEST",
                     help="Fill the contest's values from what `contest "
                          "prepare` wrote: its --out directory or "
                          "<out>/local/manifest.json (sets, artifacts, "
                          "qualifier, dev corpus, language pair, test "
                          "suites). node_id, cards_dir, signing_key and key "
                          "files stay <...> for you to fill")
    nin.add_argument("--contest-id",
                     help="With --from-contest: the contest id entrants use "
                          "(default: the manifest's contest id — the --slug "
                          "given to `contest prepare`)")

    ns = node_sub.add_parser("serve", help="Run the polling scoring daemon")
    ns.add_argument("--config", help="Node config path (default ~/.mt-eval/node.json)")
    ns.add_argument("--once", action="store_true",
                    help="One poll pass then exit (cron/test mode)")

    nl = node_sub.add_parser("list", help="Show the intake queue this node serves")
    nl.add_argument("--config", help="Node config path")
    nl.add_argument("--offline", action="store_true",
                    help="AIR-GAPPED node: list what `node import-bundle` "
                         "staged here — status, whether a custodian has "
                         "approved it, and the next command — from the "
                         "node's own state and ledger (no database, no "
                         "service key)")
    nl.add_argument("--contest", help="Limit to one contest id (the --slug "
                                      "given to `contest prepare`)")

    na = node_sub.add_parser(
        "approve", help="Custodian: authorize a pending scoring request")
    na.add_argument("request_id", help="authreq-… id (see `mt-eval node list`)")
    na.add_argument("--actor", required=True,
                    help="Who is approving (recorded in the audit chain)")
    na.add_argument("--config", help="Node config path")
    na.add_argument("--offline", action="store_true",
                    help="AIR-GAPPED node: record the approval of an "
                         "imported proposal HERE — a vote + authorization in "
                         "the node's hash-chained local ledger and a decision "
                         "record signed with node.json's signing_key. "
                         "Refused until the node's own checks have passed "
                         "for the request (`node run-method <id> --offline` "
                         "on the pending proposal re-executes the entrant's "
                         "qualifier on the public dev set and checks a "
                         "container runtime for a code entry). `node "
                         "run-method --offline` requires the approval before "
                         "anything sealed opens. No database, no service key")

    nd = node_sub.add_parser(
        "deny", help="Custodian: deny a pending scoring request")
    nd.add_argument("request_id", help="authreq-… id")
    nd.add_argument("--actor", required=True,
                    help="Who is denying (recorded in the audit chain)")
    nd.add_argument("--reason", required=True,
                    help="Why (relayed to the participant; custodians may "
                         "still simply refuse — community control)")
    nd.add_argument("--config", help="Node config path")
    nd.add_argument("--offline", action="store_true",
                    help="AIR-GAPPED node: record the denial HERE (local "
                         "ledger + signed record); the request is staged "
                         "rejected and `node export-scores` carries the "
                         "signed refusal back")

    # --- Phase B: the T2 method-execution lane ------------------------------
    nrm = node_sub.add_parser(
        "run-method",
        help="Execute one authorized T2 method request in the sandbox "
             "(--network=none) and publish scores-only "
             "(sandbox-evaluation-spec §3/§6–§9)")
    nrm.add_argument("request_id", help="authreq-… id (see `mt-eval node list`)")
    nrm.add_argument("--offline", action="store_true",
                     help="AIRGAPPED mode: run a request staged by "
                          "`node import-bundle` (no Supabase; scores go out "
                          "via `node export-scores`). On an entrant's pending "
                          "proposal no custodian has decided yet, it runs "
                          "only the node's checks (qualifier re-execution on "
                          "the public dev set; container runtime for a code "
                          "entry), records them, and stops for `node approve "
                          "--offline`")
    nrm.add_argument("--share", action="append", dest="shares", default=None,
                     metavar="SHARE.json",
                     help="Custodian key-share file (repeat for the quorum). "
                          "M-of-N ceremony shares unseal the corpus in "
                          "executor memory; without a quorum the run is "
                          "refused AND logged (offline mode)")
    nrm.add_argument("--assert-airgap", action="store_true",
                     help="Refuse to run unless the egress self-check "
                          "proves no route out (set on the real node; also "
                          "node.json airgap.assert_airgap)")
    nrm.add_argument("--config", help="Node config path")

    nib = node_sub.add_parser(
        "import-bundle",
        help="AIRGAPPED node: stage exported method requests from an "
             "exchange directory (digest-verify + static checks now)")
    nib.add_argument("exchange_dir", help="The exchange medium's directory")
    nib.add_argument("--config", help="Node config path")

    nes = node_sub.add_parser(
        "export-scores",
        help="AIRGAPPED node: write signed scores-only bundles for every "
             "completed run into an exchange directory")
    nes.add_argument("exchange_dir", help="The exchange medium's directory")
    nes.add_argument("--config", help="Node config path")

    nr = node_sub.add_parser(
        "relay",
        help="CONNECTED side of a true-airgap contest: verify + publish the "
             "signed score bundles the medium carries back, then export "
             "authorized method requests to it (that order — the done-marker "
             "the first half writes is what keeps a scored request's method "
             "tarball off the return drive)")
    nr.add_argument("exchange_dir", help="The exchange medium's directory")
    nr.add_argument("--config", help="Node config path")

    _stage_request_help = (
        "ORGANIZER side, NO database: stage a local method bundle as "
        "an AUTHORIZED exchange request (the relay's export shape) "
        "for `node import-bundle` — pre-validated exactly as import "
        "would, fingerprint bound to node.json's node_id. Scores come "
        "back manifest-verifiable, never relay-publishable (no "
        "authorization_requests row exists)")
    nsr = node_sub.add_parser(
        "stage-request", help=_stage_request_help,
        description=_stage_request_help)
    nsr.add_argument("bundle", help="Method bundle tarball (.tar.gz) built "
                                    "by `mt-eval contest submit-method`")
    nsr.add_argument("--contest", required=True,
                     help="Contest id (the --slug given to `contest "
                          "prepare`) — must be served by node.json")
    nsr.add_argument("--out", required=True, metavar="EXCHANGE_DIR",
                     help="Exchange directory to write requests/<id>/ into")
    nsr.add_argument("--requested-by", required=True, metavar="EMAIL",
                     help="Identity the request row records (the relay "
                          "export carries the JWT email; staging must say "
                          "it explicitly)")
    nsr.add_argument("--corpus-version", default="v1",
                     help="Sealed corpus version bound into the "
                          "fingerprint (default v1)")
    nsr.add_argument("--secret-set", metavar="ID",
                     help="Sealed set id (default: node.json contests[…]"
                          ".secret_set_id; a mismatch is refused)")
    nsr.add_argument("--request-id", metavar="ID",
                     help="Request id (default: a fresh authreq-…; an "
                          "existing requests/<id> is never overwritten)")
    nsr.add_argument("--config", help="Node config path (its node_id is "
                                      "what the fingerprint binds to)")

    # --- Threshold custody: the key ceremony (M-of-N community shares) -----
    ncer = node_sub.add_parser(
        "ceremony",
        help="Key ceremony for a sealed set: generate + split the set key "
             "M-of-N on the offline node, distribute shares, verify by test "
             "reconstruction, restore only into executor memory "
             "— champollion.dev/docs/network/sovereignty/sovereign-eval-node")
    cer_sub = ncer.add_subparsers(dest="ceremony_command",
                                  help="Ceremony step")
    ci = cer_sub.add_parser(
        "init", help="Generate the set key, split M-of-N, write the public "
                     "ceremony record + share files; the key itself is "
                     "zeroed in the same call and never persists")
    ci.add_argument("--dir", required=True, help="Ceremony directory to create")
    ci.add_argument("--set", required=True, dest="set_id",
                    help="Sealed-set/card id the key will seal")
    ci.add_argument("--group", required=True,
                    help="Custodian group id (recorded on the card)")
    # `--m` and `--n` read like the M-of-N they set, so they stay as aliases.
    # They used to die as "ambiguous option" on the node's own Python 3.12 —
    # not because of anything here, but because the MAIN parser resolved them
    # against --model/--max-tokens/… first. That is fixed at the root
    # (allow_abbrev=False in build_parser), and both spellings now behave
    # identically on every Python. tests/test_cli.py::TestOptionAbbreviation
    # holds the line.
    ci.add_argument("--quorum", "--m", type=int, default=3, dest="m",
                    help="Quorum size M — how many custodians must present a "
                         "share to open the set (default 3). `--m` is an "
                         "accepted alias")
    ci.add_argument("--shares", "--n", type=int, default=5, dest="n",
                    help="Share count N — how many custodian shares the key "
                         "is split into (default 5). `--n` is an accepted "
                         "alias")
    ci.add_argument("--custodian", action="append", dest="custodians",
                    help="Custodian name (repeat n times; defaults to "
                         "custodian-1..n)")
    csh = cer_sub.add_parser(
        "share", help="List/emit custodian shares from the ceremony dir; "
                      "copy one to a token with --custodian + --dest; wipe "
                      "the originals once distribution is verified")
    csh.add_argument("--dir", required=True, help="Ceremony directory")
    csh.add_argument("--custodian", help="Which custodian's share to emit")
    csh.add_argument("--dest", help="Copy the share (+ printable .txt) here")
    csh.add_argument("--qr", action="store_true",
                     help="Also render a QR (needs the optional 'qrcode' "
                          "package)")
    csh.add_argument("--all-shares-i-understand", dest="all_shares",
                     action="store_true",
                     help="Emit/render EVERY share at once (defeats M-of-N — "
                          "only for a single-holder recovery you accept the "
                          "risk of). Normally emit one share per --custodian.")
    csh.add_argument("--wipe-originals", action="store_true",
                     help="Overwrite-then-delete the ceremony dir's share "
                          "files (after distribution + verify)")
    cv = cer_sub.add_parser(
        "verify", help="Test reconstruction from ≥M shares against the "
                       "ceremony record — nothing is persisted")
    cv.add_argument("--dir", required=True, help="Ceremony directory (or "
                                                 "ceremony.json)")
    cv.add_argument("--share", action="append", dest="shares", required=True,
                    help="Share file (repeat ≥M times)")
    cr = cer_sub.add_parser(
        "restore", help="Quorum-reconstruction drill: rebuild the key in "
                        "locked memory, check the commitment, zero it — "
                        "proves the quorum works without persisting anything")
    cr.add_argument("--share", action="append", dest="shares", required=True,
                    help="Share file (repeat ≥M times)")
    cr.add_argument("--expect-key-id", help="Expected key id (e.g. from the "
                                            "sealed artifact or ceremony "
                                            "record)")
    cr.add_argument("--i-understand-this-assembles-the-key", dest="ack_assemble",
                    action="store_true",
                    help="Required acknowledgement: `restore` reconstructs the "
                         "REAL set key in memory (unlike a sealed run, which "
                         "does it inside the executor and consumes a grant). "
                         "This standalone drill is unlogged — only run it "
                         "during a ceremony sitting.")

    nseal = node_sub.add_parser(
        "seal", help="Seal a corpus to a ceremony's public key: ciphertext "
                     "artifact + content-free card block; the platform "
                     "stores ciphertext + metadata, never plaintext (M1)")
    nseal.add_argument("--corpus", required=True, help="Plaintext corpus file")
    nseal.add_argument("--pubkey", required=True,
                       help="Ceremony record / pub.json / base64 SPKI DER")
    nseal.add_argument("--card-id", required=True, help="Sealed-set card id")
    nseal.add_argument("--group", required=True, help="Custodian group id")
    nseal.add_argument("--out-dir", default=".",
                       help="Where the artifact + card block are written")
    nseal.add_argument("--key-scheme",
                       help="Custody scheme label (defaults to the pubkey "
                            "file's keyScheme, e.g. shamir-gf256-3-of-5)")

    nkg = node_sub.add_parser(
        "keygen", help="Generate the node's Ed25519 score-signing keypair "
                       "(same file format as `champollion seal-corpus "
                       "sign-keygen`; publish the .pub.json)")
    nkg.add_argument("--out", default=".", help="Output directory")

    nsm = node_sub.add_parser(
        "sign-manifest", help="Detached-sign a score manifest (or any "
                              "payload file) with the node's signing key")
    nsm.add_argument("payload", help="File to sign (exact bytes)")
    nsm.add_argument("--privkey", required=True,
                     help="score-sign .key.json (or base64 PKCS8 DER)")
    nsm.add_argument("--sig-out", help="Signature path (default "
                                       "<payload>.sig.json)")

    nvm = node_sub.add_parser(
        "verify-manifest", help="Verify a signed score manifest with the "
                                "node's PUBLISHED public key — anyone can "
                                "run this")
    nvm.add_argument("payload", help="The manifest file")
    nvm.add_argument("--sig", help="Signature file (default "
                                   "<payload>.sig.json)")
    nvm.add_argument("--pubkey", required=True,
                     help="The node's published .pub.json (or base64 DER)")

    nvd = node_sub.add_parser(
        "verdicts",
        help="Paired significance for a SEALED contest, computed HERE over "
             "the sealed references: every pair of the contest's scored "
             "entries, exported as signed verdicts only (p-value, delta, CI, "
             "segment count — no text). Feed the file to `contest close "
             "--node-verdicts`")
    nvd.add_argument("--contest", required=True,
                     help="Contest id (the --slug given to `contest prepare`)")
    nvd.add_argument("--out", required=True, help="Verdicts file to write "
                                                  "(signature: <out>.sig.json)")
    nvd.add_argument("--config", help="Node config path")
    nvd.add_argument("--signing-key", default=None,
                     help="The node's score-sign .key.json (default: "
                          "node.json signing_key)")
    nvd.add_argument("--metric", default=None,
                     help="Default: the contest's recorded primary_metric "
                          "(required on an air-gapped node)")
    nvd.add_argument("--tie-test", choices=["ar", "bootstrap"], default=None)
    nvd.add_argument("--alpha", type=float, default=None)
    nvd.add_argument("--n-resamples", type=int, default=None)
    nvd.add_argument("--seed", type=int, default=None)

    nb = node_sub.add_parser(
        "bundle", help="Build the offline install bundle on an ONLINE "
                       "machine (wheels + pinned artifacts + sha256 "
                       "manifest), or --verify it on the node")
    nb.add_argument("--out", help="Bundle directory to build")
    nb.add_argument("--include", action="append", default=[],
                    help="Extra artifact file/dir to bundle (repeatable)")
    nb.add_argument("--verify", metavar="DIR",
                    help="Verify an existing bundle instead of building")
    nb.add_argument("--wheel", metavar="PATH",
                    help="Bundle this mt-eval-harness wheel instead of the "
                         "installed release (e.g. a release candidate). "
                         "Default: your source checkout if you run from one, "
                         "else the installed version from the package index.")

    nm = node_sub.add_parser(
        "manifest", help="IN/OUT drive manifests: write before a crossing, "
                         "verify after (transfer discipline, node spec §3)")
    nm.add_argument("manifest_action", choices=["write", "verify"],
                    help="write or verify")
    nm.add_argument("drive_dir", help="The drive's mount/directory")
    nm.add_argument("--direction", choices=["in", "out"],
                    help="IN (toward the node) or OUT (scores only) — "
                         "required for write")
    nm.add_argument("--note", help="Free-text crossing note")
    nm.add_argument("--config", help="Node config path (for the node id)")

    nec = node_sub.add_parser(
        "egress-check", help="Point-in-time proof this machine has no "
                             "route out (route table + TCP probes + DNS); "
                             "the executor runs the same check before a "
                             "sealed run when assert_airgap is set")
    nec.add_argument("--json", action="store_true", dest="as_json",
                     help="Print the full report as JSON")

    nldg = node_sub.add_parser(
        "ledger", help="Check the node: verify loads node.json (refusing the "
                       "first leftover <...> value or declared file that is "
                       "not on this machine), prints what it checked, then "
                       "replays the hash-chained local authorization ledger; "
                       "head prints the ledger's anchorable tip (the value "
                       "signed into every score manifest)")
    nldg.add_argument("ledger_action", choices=["verify", "head"],
                      help="verify or head")
    nldg.add_argument("--path", help="Ledger file (default: the node "
                                     "config's airgap state_dir + "
                                     "authorization-ledger.jsonl)")
    nldg.add_argument("--config", help="Node config path")

    # --- SHARED-TASK command — the multi-pair edition umbrella (046) --------
    st_p = sub.add_parser(
        "shared-task",
        help="Multi-pair shared-task edition umbrella: one row groups the N "
             "per-pair contests of an AmericasNLP-style edition and carries "
             "its policy defaults — champollion.dev/docs/network/sovereignty/"
             "run-a-sovereign-contest. Grouping "
             "+ defaults only — every gate stays per-contest",
    )
    st_sub = st_p.add_subparsers(dest="shared_task_command",
                                 help="Shared-task subcommand")

    stc = st_sub.add_parser(
        "create",
        help="Register a shared-task edition (organizer; needs the contest "
             "database's service-role key, MT_EVAL_SUPABASE_SERVICE_KEY), "
             "then attach each per-pair contest with "
             "`mt-eval contest prepare … --shared-task <id>`")
    stc.add_argument("--id", required=True,
                     help="Stable edition slug, e.g. 'americasnlp-2026'. One "
                          "row per edition-YEAR — next year's cycle is a new "
                          "row, never an edit (046 identity guard)")
    stc.add_argument("--name", required=True,
                     help="Human-readable edition name")
    stc.add_argument("--organizer", required=True,
                     help="The organizing body's own public label (NEVER a "
                          "key-custodian naming — custodians stay behind the "
                          "opaque custodian group id)")
    stc.add_argument("--year", type=int, required=True, help="Cycle year")
    stc.add_argument("--authorization-model",
                     choices=["per-submission", "blanket", "open"],
                     default="per-submission",
                     help="DEFAULT authorization posture copied onto member contests "
                          "at prepare time (explicit prepare flags win). "
                          "Default: per-submission (fail-closed)")
    stc.add_argument("--intake-daily-limit", type=int, default=5,
                     help="DEFAULT per-submitter 24h throttle copied onto "
                          "member contests at prepare time (default 5)")
    stc.add_argument("--description", default="",
                     help="One-paragraph public edition description")

    stl = st_sub.add_parser("list", help="List shared-task editions")
    stl.add_argument("--year", type=int, help="Limit to one cycle year")
    stl.add_argument("--all", action="store_true",
                     help="Include archived editions")

    str_ = st_sub.add_parser(
        "report",
        help="Write the edition's Findings-style Markdown report from FROZEN "
             "ranking snapshots only (every member contest must be closed) — "
             "per-pair rankings with rank ranges and tie evidence, how ties "
             "were decided, exclusions, execution facts (reported, never "
             "ranked) and the participants' own system descriptions verbatim")
    str_.add_argument("edition", help="Shared-task edition slug, "
                                      "e.g. 'americasnlp-2026'")
    str_.add_argument("--out", required=True, metavar="DIR",
                      help="Directory to write <edition>-findings.md into "
                           "(created if missing)")
    str_.add_argument("--set-url", metavar="URL",
                      help="After writing, record where the report is "
                           "published: PATCHes shared_tasks.report_url + "
                           "report_generated_at (https only), which is what "
                           "the public shared-tasks page links to")

    # --- LOGOUT command ---
    sub.add_parser(
        "logout",
        help="Remove stored authentication credentials",
    )

    # --- SETUP command ---
    setup_p = sub.add_parser(
        "setup",
        help="Install optional dependencies (COMET neural metric, FST runtime)",
    )
    setup_p.add_argument(
        "--all",
        action="store_true",
        help="Install all optional dependencies without prompts",
    )
    setup_p.add_argument(
        "--comet",
        action="store_true",
        help="Install COMET neural metric (unbabel-comet)",
    )
    setup_p.add_argument(
        "--fst",
        action="store_true",
        help="Install FST runtime (pyhfst) for morphological validation",
    )
    setup_p.add_argument(
        "--status",
        action="store_true",
        help="Show what's currently installed",
    )
    setup_p.add_argument(
        "--lang",
        metavar="CODE",
        help="Install eval pack for a specific language (e.g., --lang crk, --lang sme)",
    )

    # --- EXPORT command ---
    export_p = sub.add_parser(
        "export",
        help="Package a TestReport as a champollion method plugin",
    )
    _add_export_args(export_p)

    # --- GENERATE-PLUGIN alias (maps to export) ---
    gp_p = sub.add_parser(
        "generate-plugin",
        help="Alias for 'export' — package a TestReport as a champollion method plugin",
    )
    _add_export_args(gp_p)

    # --- EXPORT-CONFIG command ---
    ec_p = sub.add_parser(
        "export-config",
        help="Generate a champollion.config.json snippet from a TestReport",
    )
    ec_p.add_argument(
        "--report",
        required=True,
        help="Path to a TestReport JSON file (output of 'mt-eval test')",
    )
    ec_p.add_argument(
        "--target-lang-code",
        required=True,
        help="BCP-47 language code (e.g., 'crk', 'fr')",
    )
    ec_p.add_argument(
        "-o", "--output",
        help="Output file path (default: stdout)",
    )

    _share_global_flags(parser, global_parser)
    return parser


def _share_global_flags(parser: argparse.ArgumentParser,
                        global_parser: argparse.ArgumentParser) -> None:
    """Every subcommand, at every depth, accepts the global flags and never
    abbreviates.

    ``--non-interactive`` / ``--json`` reached only the seven subcommands
    built with ``parents=[global_parser]``: ``mt-eval setup --non-interactive
    --lang sme`` died with argparse's usage wall while ``run`` and ``test``
    listed the flag as their own (synthetic researcher, Round 8). Walking the
    finished tree here covers every subparser — today's and any added later —
    without 55 hand-copied ``parents=``. A subcommand that defines its own
    ``--json`` keeps it (its own meaning wins).

    The flags are added to each subparser, never to the main parser's option
    table, so the main parser's ``allow_abbrev=False`` (the Python 3.12 trap
    — see build_parser) is untouched; inside a subcommand abbreviation keeps
    its documented behaviour (TestOptionAbbreviation).
    """
    for action in parser._actions:
        if not isinstance(action, argparse._SubParsersAction):
            continue
        seen: set[int] = set()
        for sub in action.choices.values():
            if id(sub) in seen:        # an alias maps to the same parser
                continue
            seen.add(id(sub))
            for flag in global_parser._actions:
                if not flag.option_strings or any(
                        o in sub._option_string_actions
                        for o in flag.option_strings):
                    continue
                sub.add_argument(*flag.option_strings, dest=flag.dest,
                                 action="store_true",
                                 default=argparse.SUPPRESS, help=flag.help)
            _share_global_flags(sub, global_parser)


def _pair_arg(text: str) -> str:
    """argparse ``type=`` for every language-pair argument: 'eng>crk',
    eng-crk and 'eng→crk' are all accepted and stored as eng>crk
    (pair_notation)."""
    from mt_eval_harness.pair_notation import argparse_pair
    return argparse_pair(text)


class _StoreModel(argparse.Action):
    """``-m/--model`` that also records it was GIVEN (``args.model_given``).

    The default model is the harness's own LLM; a method plugin run must know
    whether the user actually handed it a model — including one that happens
    to equal the default — because that model is passed to the plugin
    (config.method_model) and recorded on its run card and fingerprint."""

    def __call__(self, parser, namespace, values, option_string=None):
        setattr(namespace, self.dest, values)
        setattr(namespace, "model_given", True)


def _add_run_args(parser: argparse.ArgumentParser):
    """Add run-specific arguments to a parser."""
    # Corpus (required for run)
    parser.add_argument(
        "--corpus",
        help="Path to corpus file (.json, .jsonl, or .tsv). "
             "For parallel text files (FLORES+, WMT, NTREX), use "
             "--source-file and --reference-file instead.",
    )
    parser.add_argument(
        "--source-file",
        help="Path to source text file (one sentence per line). "
             "Use with --reference-file for parallel text corpora.",
    )
    parser.add_argument(
        "--reference-file",
        help="Path to reference text file (aligned by line number). "
             "Use with --source-file for parallel text corpora.",
    )

    # Dataset
    parser.add_argument(
        "-d", "--dataset",
        default="all",
        help="Dataset filter. Options: 'all', segment name, ID range ('0-61'), "
             "or single ID. Default: all",
    )
    parser.add_argument(
        "--ids",
        help="Comma-separated entry IDs to evaluate (overrides --dataset)",
    )

    # Source/target fields
    parser.add_argument(
        "--source-field",
        default="source",
        help="Field name for source text in corpus. Default: source",
    )
    parser.add_argument(
        "--target-field",
        default="reference",
        help="Field name for reference translation in corpus. Default: reference",
    )

    # Language pair — used in prompts and run cards
    parser.add_argument(
        "--source-lang",
        default="",
        help="Source language name (auto-detected from config if empty)",
    )
    parser.add_argument(
        "--target-lang",
        default="",
        help="Target language name (used in prompt). e.g. 'Plains Cree (nêhiyawêwin, SRO)'",
    )

    # Model
    parser.add_argument(
        "-m", "--model",
        default=DEFAULT_MODEL,
        action=_StoreModel,
        help=f"Exact model slug — the full OpenRouter id "
             f"(google/gemini-3.1-pro-preview), or a direct provider's own "
             f"exact name — or a comma-separated list of them for parallel "
             f"multi-model runs. Default: {DEFAULT_MODEL}. No aliases and "
             f"no floating ids (~vendor/…, …-latest): they are refused, "
             f"naming the slug to write. "
             f"With `--method local-model`, pass a Hugging Face id "
             f"(facebook/nllb-200-distilled-600M) or a transformers or "
             f"CTranslate2 model directory here to run it locally — "
             f"required: local-model has no default model, and the run "
             f"records the model that loaded (a directory with a sha256 "
             f"over its files). With `--method <plugin "
             f"dir>`, the model is handed to the plugin as "
             f"config.method_model, in the plugin's own naming, and recorded "
             f"on the run card and in its fingerprint.",
    )
    parser.add_argument(
        "--allow-model-pair-mismatch",
        action="store_true",
        help="With `--method local-model`: run an OPUS-MT pair model whose id "
             "names another language pair than the corpus's (opus-mt-en-fi "
             "on an eng>sme corpus, as a related-language baseline). Refused "
             "without this flag, because a pair model writes its own target "
             "language; the run card records the mismatch.",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=DEFAULT_MAX_TOKENS,
        help=f"Max tokens per API call. Default: {DEFAULT_MAX_TOKENS} "
             f"(generous headroom — translation outputs are short, "
             f"unused tokens cost nothing).",
    )

    # API provider
    parser.add_argument(
        "--provider",
        default="openrouter",
        choices=["openrouter", "openai", "anthropic", "gemini", "local", "openai-compatible"],
        help="LLM API provider. 'openrouter' (default) proxies any model. "
             "Direct providers call vendor APIs without a proxy. 'local' "
             "(alias 'openai-compatible') targets an OpenAI-compatible endpoint "
             "— Ollama, vLLM, LM Studio, llama.cpp, Groq, Together. It finds "
             "its server at, most specific first: --base-url, the "
             "LOCAL_API_BASE env var, OPENAI_API_BASE, OPENAI_BASE_URL, then "
             "Ollama's default http://localhost:11434/v1.",
    )
    parser.add_argument(
        "--base-url",
        default=None,
        help="Override the provider's API endpoint (OpenAI-compatible base_url, "
             "e.g. http://localhost:11434/v1 for Ollama, "
             "https://api.groq.com/openai/v1 for Groq). Applies to --provider "
             "openai/local. Precedence: flag > env (--provider local: "
             "LOCAL_API_BASE, then OPENAI_API_BASE / OPENAI_BASE_URL; "
             "--provider openai: OPENAI_API_BASE) > default.",
    )

    # Tools
    parser.add_argument(
        "--tools",
        action="store_true",
        help="Enable tool-calling (batch_size auto-overrides to 1)",
    )
    parser.add_argument(
        "--tools-list",
        help="Comma-separated tool names (requires --tools)",
    )
    parser.add_argument(
        "--max-tool-rounds",
        type=int,
        default=DEFAULT_MAX_TOOL_ROUNDS,
        help=f"Max tool-calling rounds per entry. Default: {DEFAULT_MAX_TOOL_ROUNDS}",
    )

    # Post-hooks
    parser.add_argument(
        "--hooks",
        help="Comma-separated post-translation hook names to apply",
    )

    # Caching
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable caching (re-run all entries). NOT recommended.",
    )
    parser.add_argument(
        "--cache-dir",
        default=DEFAULT_CACHE_DIR,
        help=f"Cache directory. Default: {DEFAULT_CACHE_DIR}",
    )

    # FUSE-style comparator (opt-in)
    parser.add_argument(
        "--fuse",
        action="store_true",
        help="Also compute the FUSE-style comparator (reported separately, "
             "never in the chrF++ headline; an untrained reimplementation of the AmericasNLP-2025 "
             "FUSE approach). Needs the `fuse` extra: "
             "python3 -m pip install 'mt-eval-harness[fuse]'. Off by default — LaBSE is heavy.",
    )

    # MetricX-24 (opt-in; neural, lower-is-better, reported separately)
    parser.add_argument(
        "--metricx",
        action="store_true",
        help="Also compute MetricX-24 (Google, Apache-2.0) — the WMT24 Metrics "
             "shared-task winner and the metric WMT24++/TranslateGemma report "
             "against. A LOWER-IS-BETTER neural error metric (0–25), reported "
             "separately, NEVER in the chrF++ headline. Needs the `metricx` extra "
             "(python3 -m pip install 'mt-eval-harness[metricx]' plus the model code: "
             "python3 -m pip install git+https://github.com/google-research/metricx). "
             "Off by default — the mT5 backbone is heavy.",
    )
    parser.add_argument(
        "--metricx-model",
        default=None,
        help="Override the MetricX checkpoint (default: "
             "google/metricx-24-hybrid-large-v2p6). Pass an xl/xxl checkpoint for "
             "higher correlation, or a google/metricx-25-* checkpoint for the "
             "newer generation.",
    )

    # Batching
    parser.add_argument(
        "-b", "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Entries per API call. Default: {DEFAULT_BATCH_SIZE} "
             f"(25× fewer API calls than batch_size=1). "
             f"Auto-overrides to 1 when --tools is set.",
    )

    # Concurrency
    parser.add_argument(
        "-c", "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        help=f"Parallel API calls per model. Default: {DEFAULT_CONCURRENCY}. "
             f"For multi-model parallelism, pass multiple models with -m.",
    )

    # Prompt / Coaching
    # Coaching prompts are free text — the full text is recorded in the
    # run card for reproducibility. There are no named prompt versions.
    parser.add_argument(
        "-p", "--prompt",
        default="naive",
        help="System prompt version. Built-in: naive, custom. "
             "Use --coaching-file for custom coaching prompts. Default: naive",
    )
    parser.add_argument(
        "--coaching-file",
        help="Path to a coaching file — Markdown, plain text or JSON; its "
             "full text is sent verbatim as the system prompt. Without "
             "--glossary, a JSON file's \"dictionary\" object ({\"source "
             "term\": \"translation\" or [\"accepted\", \"forms\"]}) is "
             "also the glossary terminology adherence is scored against (the "
             "scoring spec's coached-vocabulary rule). The text is "
             "recorded in the run card for reproducibility, and the run's "
             "condition is labelled 'coached' unless --prompt is set "
             "explicitly.",
    )
    parser.add_argument(
        "--glossary",
        help="Evaluation glossary for terminology adherence: a JSON file, "
             "{\"source term\": \"translation\" or [\"accepted\", "
             "\"forms\"]} (or an object with that under \"dictionary\"). "
             "A scoring input only — never sent to the model. Give every run "
             "you compare the same file, so their terminology scores mean "
             "the same thing. Takes precedence over a coaching file's "
             "dictionary.",
    )
    parser.add_argument(
        "--coaching",
        help="Inline coaching text (for short prompts). Mutually exclusive "
             "with --coaching-file.",
    )
    parser.add_argument(
        "--custom-prompt",
        help=argparse.SUPPRESS,  # DEPRECATED: hidden, use --coaching-file
    )

    # Writing style
    parser.add_argument(
        "--style-profile",
        help="Path to a style profile JSON for brand voice analysis. "
             "Enables writing style consistency metrics (a diagnostic, "
             "never in the headline). See docs for format.",
    )

    # Output
    parser.add_argument(
        "-o", "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory for RunLog. Default: {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument(
        "-n", "--name",
        help="Human-readable run name (appended to run ID)",
    )

    # Misc
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature. Default: 0.0 (deterministic)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate config without making API calls",
    )
    parser.add_argument(
        "--max-cost",
        type=float,
        default=None,
        metavar="USD",
        help="Abort before translation starts if the pre-spend cost estimate "
             "exceeds this cap (USD). An UNKNOWN estimate (un-priceable "
             "model, MT engine, method plugin) also aborts — unknown ≠ free. "
             "Default: no cap.",
    )
    parser.add_argument(
        "-y", "--yes",
        action="store_true",
        help="Skip confirmation prompts (e.g. accept the upstream data "
             "license when a missing corpus is fetched from source). "
             "Required for non-interactive/CI runs that trigger a fetch.",
    )
    parser.add_argument(
        "--publish",
        action="store_true",
        help="After a successful run, publish the scored report to the "
             "leaderboard without prompting — the one-step equivalent of "
             "running, then `mt-eval publish <report>`. Honors the same "
             "content-safety gating as `mt-eval publish` (NC / held-out / "
             "unregistered corpora publish scores only). Requires sign-in "
             "(or --anonymous), and --prod for the live leaderboard.",
    )
    parser.add_argument(
        "--prod", "--yes-prod",
        dest="publish_prod",
        action="store_true",
        help="With --publish: explicitly authorize the write to the PRODUCTION "
             "leaderboard (same switch as `mt-eval publish --prod`; or set "
             "MT_EVAL_ALLOW_PROD=1). Without it a prod publish is refused.",
    )
    parser.add_argument(
        "--anonymous",
        dest="publish_anonymous",
        action="store_true",
        help="With --publish: publish without signing in (submitter shown as "
             "'anonymous'; rate-limited per IP; same integrity gates).",
    )

    # --- Dataset selection UX (guided + agent modes) ---
    parser.add_argument(
        "--attest-no-training",
        action="store_true",
        help="Record a contamination self-attestation: that the method/model "
             "under evaluation was NOT trained on this corpus. The guided "
             "(interactive) run asks for this; agents/scripts pass this flag.",
    )
    parser.add_argument(
        "--allow-data-collection",
        action="store_true",
        help="Lift the privacy-preserving transmission default for an "
             "UNREGISTERED corpus you hold the rights to. By default any "
             "corpus without a redistribution-cleared license is routed only "
             "through no-train channels (OpenRouter provider routing pinned "
             "to data_collection=deny). Has no effect on registered "
             "restricted corpora (NC / held-out / quarantined) — their "
             "channel rule can never be lifted.",
    )
    parser.add_argument(
        "--attest-local-transport",
        action="store_true",
        help="For a consent-required or sealed corpus run through an "
             "EXTERNAL method plugin: attest that the method's transport is "
             "fully local (nothing reaches a remote model API). Recorded in "
             "the RunLog. Without this, such runs refuse — remote "
             "evaluation of consent-required corpora needs the "
             "rights-holder's recorded permission "
             "— champollion.dev/docs/network/sovereignty/data-sovereignty.",
    )
    parser.add_argument(
        "--accept-terms",
        action="store_true",
        help="Acknowledge a gated dataset's terms non-interactively (you have "
             "accepted them upstream and set the token, e.g. HF_TOKEN). The "
             "fetch still fails honestly if the token is missing or terms "
             "aren't accepted on your account.",
    )
    parser.add_argument(
        "--accept-nc-terms",
        action="store_true",
        help="Acknowledge a NON-COMMERCIAL (CC-BY-NC / -NC-SA) corpus's terms: "
             "that you will use it (and the results) for non-commercial / "
             "research purposes only and will not redistribute its content. "
             "Required to run against an NC corpus. The guided (interactive) run "
             "asks for this; agents/scripts pass this flag. Distinct from "
             "--accept-terms (which covers gated-dataset access).",
    )
    # --non-interactive and --json are global flags (build_global_parser),
    # inherited via parents=[global_parser] on both the top-level parser and
    # the run subparser, so they work in any position. Do NOT redefine them
    # here — a duplicate dest would raise an argparse conflict.

    # Method card
    parser.add_argument(
        "--method-card",
        help="Path to a method card JSON file (see docs/method-card-spec.md). "
             "Embeds the method description in the run card for leaderboard display.",
    )

    # Method: a self-contained MT system name OR a plugin-dir path
    parser.add_argument(
        "--method",
        help="A self-contained MT system name (google-translate, deepl, "
             "microsoft-translator, libretranslate) OR a path to a method plugin "
             "directory (method.json + Python module). When set, the harness "
             "delegates translation to it; model, prompt, batch size, and tool "
             "flags are ignored.",
    )
    # ISO codes for MT systems (auto-detected from corpus metadata if omitted)
    parser.add_argument(
        "--source-code",
        help="ISO source language code for MT systems (e.g. 'en'). Overrides the "
             "code auto-detected from the corpus language_pair.",
    )
    # The target's CODE has one documented spelling, --target-lang-code
    # (declared below); --target-code is its alias. The two used to be two
    # flags with two fields (an MT-engine override and an interop/eval-pack
    # field), and `champollion network register-corpus` printed the one the
    # docs never use (Round 12, hospital persona).

    # FST retry
    parser.add_argument(
        "--fst-retries",
        type=int,
        default=0,
        help="Number of times to retry translations that fail FST validation. "
             "Default: 0 (score-only, no retry). Works with the default LLM method "
             "only — custom method plugins handle their own retries.",
    )

    # Retired in 0.2.0 (champollion_config.RETIRED_MESSAGE and
    # CARDS_DIR_RETIRED_MESSAGE). Still parsed — hidden — so an old command
    # line gets the retirement reason and its replacement from
    # RunConfig.validate(), not "unrecognized arguments".
    parser.add_argument("--champollion-config", help=argparse.SUPPRESS)
    parser.add_argument("--champollion-cards-dir", help=argparse.SUPPRESS)
    parser.add_argument(
        "--target-lang-code", "--target-code",
        dest="target_lang_code",
        default="",
        help="The target language's code (BCP-47 / ISO 639, e.g. 'fr', 'de', "
             "'crk'). It overrides the code the corpus declares: the prompt "
             "names the language from its card, the eval standard (FST, "
             "metrics) is chosen for it, and MT systems are sent it. "
             "--target-code is an alias.",
    )
    parser.add_argument(
        "--target-script",
        default="",
        metavar="ISO15924",
        help="The script the translations must be written in, as an ISO "
             "15924 code (e.g. Latn, Cans) — one the target's language card "
             "lists. The harness's prompt asks for it (appended to a "
             "coaching file's text too). For a language written in more than "
             "one script, use the script your references are in; without it "
             "the model picks. Not for an MT engine or method plugin (they "
             "get no prompt).",
    )
    parser.add_argument(
        "--skip-fst",
        action="store_true",
        help="Score without FST acceptance, even if an FST is available for "
             "the target language; the run card marks it not computed. "
             "Without this flag a missing FST stops the run before "
             "translation and names the command that installs it "
             "(`mt-eval setup --lang <code>`) — run installs nothing.",
    )
    parser.add_argument(
        "--skip-eval-standard",
        action="store_true",
        help="Score without the language card's eval-standard metrics (an "
             "external package, e.g. the Plains Cree standard); the run card "
             "marks them not computed. Without this flag a missing package "
             "stops the run before translation and names the pip install "
             "the card declares — run installs nothing.",
    )


def args_to_config(args) -> RunConfig:
    """Convert parsed CLI args to a RunConfig."""
    entry_ids = None
    if hasattr(args, "ids") and args.ids:
        # Corpus ids are ints in some corpora (EdTeKLA) and strings in
        # others (Tatoeba: 'tatoeba_2289') — accept both. The loader
        # matches string-normalized, so the int/str distinction here is
        # cosmetic.
        entry_ids = [
            int(x.strip()) if x.strip().lstrip("-").isdigit() else x.strip()
            for x in args.ids.split(",")
        ]

    tools_list = None
    if hasattr(args, "tools_list") and args.tools_list:
        tools_list = [t.strip() for t in args.tools_list.split(",")]

    post_hooks = []
    if hasattr(args, "hooks") and args.hooks:
        post_hooks = [h.strip() for h in args.hooks.split(",")]

    # Resolve coaching file path.
    # --coaching-file is the modern flag; --custom-prompt is the deprecated alias.
    # If both are provided, --coaching-file wins.
    coaching_file = getattr(args, "coaching_file", None)
    custom_prompt = getattr(args, "custom_prompt", None)
    if coaching_file is None and custom_prompt is not None:
        # Backward compat: treat --custom-prompt as --coaching-file
        coaching_file = custom_prompt

    # If --coaching (inline text) is provided, write it to a temp file
    # so it flows through the same coaching_file path.
    coaching_inline = getattr(args, "coaching", None)
    if coaching_inline and coaching_file is None:
        import tempfile
        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, prefix="coaching_"
        )
        tmp.write(coaching_inline)
        tmp.close()
        coaching_file = tmp.name
        # The temp path is how the runner reads it, never what a card names:
        # the published coachingFile says "inline coaching" (coaching_label).
        coaching_label_value = "inline coaching"
    else:
        coaching_label_value = None

    # A bad --glossary or --style-profile must fail now, not at auto-score
    # after the run is paid for (or, for the profile, never — it used to be
    # a printed warning and a run scored without it).
    if getattr(args, "glossary", None):
        from mt_eval_harness.plugin_discovery import run_glossary
        run_glossary({"glossary_file": args.glossary})
    if getattr(args, "style_profile", None):
        from mt_eval_harness.plugin_discovery import load_style_profile
        load_style_profile({"style_profile": args.style_profile})

    # Condition label: coaching replaces the naive system prompt at runtime
    # (runner.load_system_prompt gives coaching_file precedence), so a run
    # with coaching but the default -p would otherwise be recorded — and
    # published — as condition "naive". Relabel it "coached" unless the user
    # explicitly chose a prompt version.
    prompt_version = args.prompt if hasattr(args, "prompt") else "naive"
    if coaching_file and prompt_version == "naive":
        prompt_version = "coached"

    # --method may name a self-contained MT system (google-translate, deepl,
    # microsoft-translator, libretranslate) OR be a plugin-dir PATH. Resolve a
    # registered name to mt_method; otherwise treat it as a plugin path. Kept
    # distinct so a name and a path can't collide.
    from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
    _method_arg = getattr(args, "method", None)
    _mt_name = _method_arg.strip().lower() if _method_arg else ""
    _looks_like_path = bool(_method_arg) and (
        os.sep in _method_arg
        or "/" in _method_arg
        or _method_arg.startswith((".", "~"))
        or Path(_method_arg).is_dir()
    )
    if _mt_name in MT_METHOD_REGISTRY:
        _mt_method, _method_path = _mt_name, None
    elif _looks_like_path:
        # Path-shaped → a plugin-directory PATH; defer to load_method(), which
        # validates existence later. (A not-yet-existing path is intentionally
        # deferred, not rejected here.)
        _mt_method, _method_path = "", _method_arg
    elif _method_arg:
        # A bare NAME that is neither a registered MT system nor a path — almost
        # certainly a typo (e.g. `google_translate` vs `google-translate`). Fail
        # with a clean, CAUGHT error listing the available systems instead of
        # deferring to a raw MethodLoadError traceback (which also breaks --json).
        available = ", ".join(sorted(MT_METHOD_REGISTRY.keys()))
        raise ValueError(
            f"Unknown --method '{_method_arg}'. It is not a registered MT "
            f"system and not a plugin-directory path. "
            f"Available systems: {available}. "
            f"Or pass a path to a method plugin directory (containing method.json)."
        )
    else:
        _mt_method, _method_path = "", _method_arg

    # Contamination self-attestation. The guided flow attaches a pre-built
    # record (args._attestation); the agent/flag path builds one from
    # --attest-no-training. Both funnel through the same builder so the run
    # log records an identical shape.
    attestation = getattr(args, "_attestation", None)
    if attestation is None and getattr(args, "attest_no_training", False):
        from mt_eval_harness.interactive import make_attestation
        attestation = make_attestation(
            getattr(args, "corpus", None),
            attested=True,
            via=getattr(args, "_attest_via", "flag"),
        )

    # Non-commercial terms acknowledgment. The guided flow attaches a pre-built
    # record (args._nc_acknowledgment); the agent/flag path builds one from
    # --accept-nc-terms once the corpus is confirmed NC. The run-time gate in
    # main() enforces that an NC corpus has one (interactive prompt or fail-loud).
    nc_acknowledgment = getattr(args, "_nc_acknowledgment", None)

    return RunConfig(
        dataset=args.dataset,
        entry_ids=entry_ids,
        corpus_path=args.corpus if hasattr(args, "corpus") else None,
        source_file=args.source_file if hasattr(args, "source_file") else None,
        reference_file=args.reference_file if hasattr(args, "reference_file") else None,
        source_field=args.source_field if hasattr(args, "source_field") else "source",
        target_field=args.target_field if hasattr(args, "target_field") else "reference",
        source_lang=args.source_lang if hasattr(args, "source_lang") else "English",
        target_lang=args.target_lang if hasattr(args, "target_lang") else "",
        model=args.model,
        max_tokens=args.max_tokens,
        provider=getattr(args, "provider", "openrouter"),
        base_url=getattr(args, "base_url", None),
        allow_data_collection=getattr(args, "allow_data_collection", False),
        attest_local_transport=getattr(args, "attest_local_transport", False),
        tools_enabled=args.tools if hasattr(args, "tools") else False,
        compute_fuse=getattr(args, "fuse", False),
        compute_metricx=getattr(args, "metricx", False),
        metricx_model=getattr(args, "metricx_model", None),
        tools_list=tools_list,
        max_tool_rounds=args.max_tool_rounds if hasattr(args, "max_tool_rounds") else DEFAULT_MAX_TOOL_ROUNDS,
        cache_enabled=not (args.no_cache if hasattr(args, "no_cache") else False),
        cache_dir=args.cache_dir if hasattr(args, "cache_dir") else DEFAULT_CACHE_DIR,
        batch_size=args.batch_size if hasattr(args, "batch_size") else DEFAULT_BATCH_SIZE,
        concurrency=args.concurrency if hasattr(args, "concurrency") else DEFAULT_CONCURRENCY,
        prompt_version=prompt_version,
        custom_prompt_path=custom_prompt,  # Legacy field
        coaching_file=coaching_file,
        coaching_label=coaching_label_value,
        glossary_file=getattr(args, "glossary", None),
        style_profile=getattr(args, "style_profile", None),
        post_hooks=post_hooks,
        fst_retries=getattr(args, "fst_retries", 0),
        output_dir=args.output_dir if hasattr(args, "output_dir") else DEFAULT_OUTPUT_DIR,
        run_name=args.name if hasattr(args, "name") else None,
        temperature=args.temperature if hasattr(args, "temperature") else 0.0,
        dry_run=args.dry_run if hasattr(args, "dry_run") else False,
        max_cost=getattr(args, "max_cost", None),
        # --json: the runner suppresses the human run card / publish prompt so
        # the only thing on stdout is the JSON summary emitted by the CLI.
        json_mode=getattr(args, "json", False),
        # --accept-terms (acknowledging a gated dataset's terms) also satisfies
        # the fetch-from-source license gate, so an agent's gated-corpus run is
        # `--corpus X --attest-no-training --accept-terms` (+ the token) — no
        # separate --yes needed.
        assume_yes=getattr(args, "yes", False) or getattr(args, "accept_terms", False),
        # Score without a metric whose tools are not installed — marked not
        # computed on the card (run never installs packages: `mt-eval setup`).
        skip_fst=bool(getattr(args, "skip_fst", False)),
        skip_eval_standard=bool(getattr(args, "skip_eval_standard", False)),
        auto_publish=getattr(args, "publish", False),
        publish_prod=getattr(args, "publish_prod", False),
        publish_anonymous=getattr(args, "publish_anonymous", False),
        method_path=_method_path,
        # -m handed to a method plugin, or to an engine that runs a model it
        # is given (local-model) — only when it was actually given; the
        # runner keeps it as config.method_model. An engine used to get
        # nothing here, so `--method local-model -m ./my-model` ran another
        # model (Round 10).
        method_model=(args.model if ((_method_path or _mt_method)
                                     and getattr(args, "model_given", False))
                      else ""),
        allow_model_pair_mismatch=bool(
            getattr(args, "allow_model_pair_mismatch", False)),
        mt_method=_mt_method,
        source_code=getattr(args, "source_code", "") or "",
        # One flag, both fields: --target-lang-code (alias --target-code)
        # is the code MT systems are sent and the one the eval standard is
        # chosen for.
        target_code=getattr(args, "target_lang_code", "") or "",
        target_script=getattr(args, "target_script", "") or "",
        champollion_config_path=args.champollion_config if hasattr(args, "champollion_config") else None,
        champollion_cards_dir=args.champollion_cards_dir if hasattr(args, "champollion_cards_dir") else None,
        target_lang_code=args.target_lang_code if hasattr(args, "target_lang_code") else "",
        contamination_attestation=attestation,
        nc_terms_acknowledgment=nc_acknowledgment,
    )


def cmd_list(
    what: str,
    live: bool = False,
    *,
    source: str | None = None,
    target: str | None = None,
    family: str | None = None,
    include_quarantined: bool = False,
    limit: int | None = 60,
    show_all: bool = False,
    as_json: bool = False,
) -> int:
    """Handle the 'list' subcommand. Returns an exit code."""
    if what == "datasets":
        import json as _json
        from mt_eval_harness import corpora_browse

        if family:
            families = corpora_browse.known_families()
            if family not in families:
                msg = (f"unknown family '{family}'. Known families: "
                       + ", ".join(families))
                if as_json:
                    print(_json.dumps({"error": "unknown-family", "message": msg,
                                       "families": families}))
                else:
                    print(f"  {msg}", file=sys.stderr)
                return 2
        infos, hidden = corpora_browse.list_all_corpora(
            source=source, target=target, family=family,
            include_quarantined=include_quarantined)
        filters = {"source": source, "target": target, "family": family,
                   "include_quarantined": include_quarantined or None}
        if as_json:
            shown = infos if show_all else infos[: (limit or 0) or None]
            print(_json.dumps({
                "count": len(infos),
                "shown": len(shown),
                "hidden_quarantined": hidden,
                "filters": {k: v for k, v in filters.items() if v},
                "datasets": corpora_browse.corpora_to_json(shown),
            }, ensure_ascii=False, indent=2))
        else:
            print(corpora_browse.format_datasets_table(
                infos, total=len(infos), hidden_quarantined=hidden,
                limit=None if show_all else limit, filters=filters))
        return 0

    if what == "models":
        print(f"\nDefault model: {DEFAULT_MODEL}")
        print("\n  Models are named by their exact slug — the full OpenRouter id")
        print("  (vendor/model), or a direct provider's own exact name. Short")
        print("  aliases and floating ids (~vendor/…, …-latest) are refused.")
        print("  Retired short names, and the slug each used to stand for:")
        for short, full in sorted(RETIRED_MODEL_ALIASES.items()):
            print(f"    {short:23s} → write {full}")
        print("\n  The live OpenRouter list: mt-eval list models --live, "
              "or https://openrouter.ai/models")

        if live:
            cmd_list_live()

    elif what == "prompts":
        print("\nPrompt options:")
        print("  naive    Minimal translation instruction (default)")
        print("  custom   Load from a .txt file (DEPRECATED — use --coaching-file)")
        print("\n  Coaching prompts (recommended):")
        print("    --coaching-file path.txt   Load coaching prompt from file")
        print("    --coaching 'text'          Inline coaching text (short prompts)")
        print("\n  The full coaching text is recorded in the run card for reproducibility,")
        print("  and the run's condition is labelled 'coached' automatically (override")
        print("  with an explicit --prompt).")

    return 0


def cmd_corpora(args) -> int:
    """Handle the 'corpora' subcommand — corpora for a pair, table or JSON.

    Never interactive. Emits structured JSON with --json (including
    machine-readable errors), a human table otherwise. Returns an exit code.
    """
    import json as _json
    from mt_eval_harness import corpora_browse

    want_json = getattr(args, "json", False)

    # --list-sources: enumerate source languages with runnable corpora.
    if getattr(args, "list_sources", False):
        sources = corpora_browse.available_source_langs()
        if want_json:
            print(_json.dumps({"sources": sources}, ensure_ascii=False))
        else:
            print(f"\n  {len(sources)} source languages with runnable corpora:")
            print("  " + ", ".join(sources))
            print("\n  Then: mt-eval corpora --source <code> --target <code>\n")
        return 0

    source = (getattr(args, "source", None) or "").strip() or None
    target = (getattr(args, "target", None) or "").strip() or None
    want_fst = bool(getattr(args, "with_fst", False))

    if not source and not target and not want_fst:
        msg = ("mt-eval corpora needs --source and/or --target ISO codes "
               "(e.g. --source eng --target tel, or just --target sme), "
               "--with-fst (every pair whose target has a pinned FST), or "
               "--list-sources.")
        if want_json:
            print(_json.dumps({"error": "missing-args", "message": msg}))
        else:
            print(f"  {msg}", file=sys.stderr)
        return 2

    # Either side works on its own: --target sme lists every corpus into
    # sme, from any source (it used to refuse without --source, although the
    # MCP list_corpora tool accepts a target alone — synthetic researcher,
    # Round 6); --source eng lists every corpus out of eng, and still names
    # its targets (the guide it used to print instead).
    include_q = getattr(args, "include_quarantined", False)
    if source or target:
        infos = corpora_browse.list_corpora_for_pair(
            source, target, include_quarantined=include_q)
        # Quarantined entries are hidden by default but ALWAYS counted, so a
        # catalogued-but-held pair (eng→crk today) never reads as
        # "unsupported".
        hidden = ([] if include_q
                  else corpora_browse.quarantined_for_pair(source, target))
    else:   # --with-fst alone: every pair, filtered below
        infos, _ = corpora_browse.list_all_corpora(
            include_quarantined=include_q)
        hidden = ([] if include_q else
                  [i for i in corpora_browse.list_all_corpora(
                      include_quarantined=True)[0] if i.get("quarantine")])
    if want_fst:
        # Only targets with an FST the harness pins, each row saying whether
        # that FST is installed here (Round 8: the researcher checked one
        # language at a time).
        infos = corpora_browse.with_fst(infos)
        hidden = corpora_browse.with_fst(hidden)
    targets = held_only = None
    if source and not target and not want_fst:
        targets = corpora_browse.available_targets_for_source(source)
        held_only = corpora_browse.quarantined_only_targets_for_source(source)
    if want_json:
        doc = {
            "source": source,
            "target": target,
            "with_fst": want_fst,
            "count": len(infos),
            "hidden_quarantined": len(hidden),
            "hidden_quarantined_ids": [h["id"] for h in hidden],
            "corpora": corpora_browse.corpora_to_json(infos),
        }
        if targets is not None:
            doc["targets"] = targets
            doc["quarantined_only_targets"] = held_only
        print(_json.dumps(doc, ensure_ascii=False, indent=2))
    else:
        print(corpora_browse.format_corpora_table(
            infos, source, target, hidden=hidden, with_fst_note=want_fst))
        if targets is not None:
            print(f"  Targets available from "
                  f"{corpora_browse.lang_name(source)} ({len(targets)}): "
                  + (", ".join(targets) if targets else "(none)"))
            if held_only:
                print(f"  Catalogued but quarantined only (never runnable; "
                      f"see --include-quarantined): {', '.join(held_only)}")
            print(f"  Narrow it: mt-eval corpora --source {source} "
                  f"--target <code>\n")
    return 0


def cmd_list_live():
    """Fetch and display live model catalog from OpenRouter.

    Queries the OpenRouter /api/v1/models endpoint and displays
    all available models with their pricing. Requires an API key
    (via OPENROUTER_API_KEY env var or .env file).
    """

    try:
        import aiohttp
    except ImportError:
        print("\n  aiohttp is required for live model listing.")
        print("  Install: python3 -m pip install aiohttp")
        return

    from mt_eval_harness.api import load_api_key, OPENROUTER_MODELS_URL

    try:
        api_key = load_api_key()
    except RuntimeError as e:
        print(f"\n  Cannot fetch live models: {e}")
        return

    async def _fetch():
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(
                OPENROUTER_MODELS_URL,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status != 200:
                    print(f"\n  OpenRouter API returned {resp.status}")
                    return
                data = await resp.json()
                models = data.get("data", [])

                # Filter to text-capable models, sort by ID
                text_models = [
                    m for m in models
                    if "text" in str(m.get("architecture", {}).get("modality", ""))
                    or "chat" in str(m.get("architecture", {}).get("modality", ""))
                    or not m.get("architecture", {}).get("modality")  # Permissive fallback
                ]
                text_models.sort(key=lambda m: m.get("id", ""))

                print(f"\n  Live catalog — {len(text_models)} models available on OpenRouter:")
                print(f"  {'Model ID':55s} {'Input $/1M':>10s} {'Output $/1M':>11s}")
                print(f"  {'-'*55} {'-'*10} {'-'*11}")

                for m in text_models:
                    mid = m.get("id", "?")
                    pricing = m.get("pricing", {})
                    try:
                        inp = float(pricing.get("prompt", "0")) * 1_000_000
                        out = float(pricing.get("completion", "0")) * 1_000_000
                        print(f"  {mid:55s} ${inp:>8.2f} ${out:>9.2f}")
                    except (ValueError, TypeError):
                        print(f"  {mid:55s} {'?':>10s} {'?':>11s}")

                print(f"\n  Pass any model ID above with: mt-eval run -m <model-id>")

    asyncio.run(_fetch())


def _add_export_args(parser: argparse.ArgumentParser):
    """Add export-specific arguments to the export subcommand parser."""
    # Required
    parser.add_argument(
        "--report",
        required=True,
        help="Path to TestReport JSON file (from 'mt-eval test')",
    )
    parser.add_argument(
        "--name",
        required=True,
        help="Plugin name in kebab-case (e.g., 'crk-coached-v1')",
    )
    parser.add_argument(
        "--type",
        required=True,
        choices=["llm", "llm-coached", "api", "google-translate"],
        help="Method type (must match champollion's valid types)",
    )
    parser.add_argument(
        "--locales",
        required=True,
        help="Comma-separated target locale codes (e.g., 'crk' or 'fr,de,es')",
    )

    # Optional
    parser.add_argument(
        "--description",
        default="",
        help="Human-readable plugin description",
    )
    parser.add_argument(
        "--author",
        default="",
        help="Plugin author (e.g., 'Your Name or Org')",
    )
    parser.add_argument(
        "--register",
        default="",
        help="Target language register/tone (e.g., 'Standard written register')",
    )
    parser.add_argument(
        "--coaching-dir",
        help="Path to coaching data directory to bundle (e.g., '.champollion/coaching')",
    )
    parser.add_argument(
        "-o", "--output-dir",
        default=".",
        help="Output directory for the plugin. Default: current directory",
    )
    parser.add_argument(
        "--version",
        dest="plugin_version",
        default="1.0.0",
        help="Semver version string. Default: '1.0.0'",
    )
    parser.add_argument(
        "--commercial-ready",
        action="store_true",
        help=(
            "Mark this plugin as licensed and cleared for publishing. "
            "Default: false (license-unclear). Set when the method's "
            "resources have been verified for commercial distribution."
        ),
    )


def cmd_export(args):
    """Handle the 'export' subcommand."""
    from mt_eval_harness.exporter import ExportConfig, export_plugin

    locales = [l.strip() for l in args.locales.split(",")]

    config = ExportConfig(
        name=args.name,
        method_type=args.type,
        locales=locales,
        version=args.plugin_version,
        description=args.description,
        author=args.author,
        register=args.register,
        coaching_dir=args.coaching_dir,
        output_dir=args.output_dir,
        commercial_ready=args.commercial_ready,
    )

    try:
        export_plugin(args.report, config)
    except (FileNotFoundError, ValueError) as e:
        print(f"ERROR: {e}")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Publish prompt — shared by run and test commands
# ---------------------------------------------------------------------------

def _publish_scope(report_path: Path) -> tuple[bool, str | None]:
    """What `mt-eval publish` would do with this report, decided by publish's
    own rules: ``(publishable, note)``.

    ``publishable`` is False when the leaderboard refuses scores on the corpus
    (a quarantined dataset — migration 022 rejects it beneath every client),
    so no publish command is suggested. ``note`` says when the corpus TEXT
    stays behind (a steward's local-only mark, a sealed / NC / unregistered
    corpus): publishing then uploads the scores only. Best-effort — if the
    run card cannot be assembled here, publish itself will say why.
    """
    try:
        from mt_eval_harness.publish import (
            _entry_content_publishable, _is_local_only,
            _lookup_registry_entry, assemble_run_card,
        )
        with contextlib.redirect_stdout(io.StringIO()):
            run_card, _uuid, _fp = assemble_run_card(report_path)
        dataset_id = (run_card.get("dataset") or {}).get("id") or ""
        entry = _lookup_registry_entry(dataset_id)
    except Exception:
        return True, None
    if entry and entry.get("quarantine"):
        why = entry.get("quarantine_reason") or "quarantined"
        return False, (f"corpus '{dataset_id}' is quarantined ({why}) — the "
                       "leaderboard refuses scores on it, so there is nothing "
                       "to publish")
    allowed, reason = _entry_content_publishable(
        entry, scores_only=False, override=False,
        local_only=_is_local_only(run_card))
    if allowed:
        return True, None
    return True, f"publishing uploads scores only — {reason}"


def _publish_hint(report_path: Path) -> list[str]:
    """The lines that tell a user how to publish THIS report.

    The path is the report's real path (the old hint printed the bare file
    name, so copying it from any other directory than -o's failed), quoted
    for the shell, and the first step is a dry run — the preview of exactly
    what would be uploaded — never a straight --prod write.
    """
    import shlex
    publishable, note = _publish_scope(report_path)
    lines = []
    if note:
        lines.append(f"  ℹ {note}.")
    if publishable:
        quoted = shlex.quote(str(report_path))
        lines.append(f"  → To publish: preview first with "
                     f"`mt-eval publish {quoted} --dry-run`,")
        lines.append(f"    then `mt-eval publish {quoted} --prod`.")
    return lines


def _prompt_publish(report_path) -> None:
    """Offer to publish a report to the arena leaderboard.

    Only prompts in interactive mode (TTY stdin). In non-interactive
    environments (piped stdin, CI), skips with a hint: the real report path,
    a dry run first, and what stays local (or no hint at all when the
    leaderboard would refuse the corpus).
    """
    report_path = Path(report_path)
    if not report_path.exists():
        return

    if not sys.stdin.isatty():
        # Non-interactive — just print the commands for reference
        for line in _publish_hint(report_path):
            print(line)
        return

    publishable, note = _publish_scope(report_path)
    if note:
        print(f"\n  ℹ {note}.")
    if not publishable:
        return

    print()
    try:
        answer = input("  → Publish this run to the arena? [y/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return

    if answer in ("y", "yes"):
        try:
            from mt_eval_harness.publish import publish_to_supabase
            publish_to_supabase(str(report_path), auto_confirm=True, yes_prod=True)
        except Exception as e:
            import shlex
            print(f"  ✗ Publish failed: {e}")
            print(f"  → Retry with: mt-eval publish "
                  f"{shlex.quote(str(report_path))} --prod")


def _enforce_nc_terms_gate(args, config) -> None:
    """Require an explicit non-commercial-terms acknowledgment before running
    against a NonCommercial (CC-BY-NC / -NC-SA) corpus.

    Positive-NC-only and fail-OPEN on uncertainty: a corpus whose license can't
    be confirmed NC (CC-BY, unstated, a raw path with no provenance) is never
    blocked here — so existing permissive runs are untouched. The acknowledgment
    is satisfied by the guided flow, the --accept-nc-terms flag, or an inline
    prompt; agents / CI / --json fail loud with a machine-readable error.

    Mutates ``config.nc_terms_acknowledgment`` when it records one. Calls
    ``sys.exit`` when the run must not proceed.
    """
    corpus = getattr(config, "corpus_path", None)
    if not corpus or config.nc_terms_acknowledgment is not None:
        return  # parallel-text / no corpus, or already acknowledged (guided path)

    from mt_eval_harness.license_use import (
        NC_TERMS_STATEMENT,
        is_non_commercial,
        make_nc_acknowledgment,
        resolve_corpus_license,
    )
    license_str, _ = resolve_corpus_license(corpus)
    if not is_non_commercial(license_str):
        return  # not known to be NC → no acknowledgment required

    # Acknowledged non-interactively (agent/script path).
    if getattr(args, "accept_nc_terms", False):
        config.nc_terms_acknowledgment = make_nc_acknowledgment(
            corpus, license_str, via="flag")
        return

    interactive = (
        not getattr(args, "json", False)
        and not getattr(args, "non_interactive", False)
        and sys.stdin.isatty() and sys.stdout.isatty()
    )
    if interactive:
        from mt_eval_harness.interactive import prompt_confirm, _Aborted
        print(f"\n  '{corpus}' is NON-COMMERCIAL / research-only "
              f"(license: {license_str}).\n  {NC_TERMS_STATEMENT}")
        try:
            ok = prompt_confirm(
                "Do you acknowledge these non-commercial terms?", default=False)
        except _Aborted:
            ok = False
        if not ok:
            print("\n  Acknowledgment declined — not running. Pass "
                  "--accept-nc-terms to acknowledge non-interactively.")
            sys.exit(0)
        config.nc_terms_acknowledgment = make_nc_acknowledgment(
            corpus, license_str, via="prompt")
        return

    # Agent / CI / piped / --json: fail loud, never silently run.
    msg = (
        f"Corpus '{corpus}' is NON-COMMERCIAL / research-only "
        f"(license: {license_str}). Re-run with --accept-nc-terms to acknowledge "
        f"you will use it (and the results) for non-commercial / research "
        f"purposes only and will not redistribute its content."
    )
    if getattr(args, "json", False):
        import json as _json
        print(_json.dumps(
            {"error": "nc-terms-required", "message": msg, "license": license_str},
            ensure_ascii=False))
    else:
        print(f"\n  ✗ {msg}")
    sys.exit(2)


def _run_json_summary(run_logs: list, multi: bool) -> dict:
    """Build the machine-readable success summary for ``mt-eval run --json``.

    Pure (no I/O): takes the run_log dict(s) returned by execute_run /
    execute_multi_run and returns a JSON-serializable summary carrying the
    run id, corpus, and scores. A single run is flattened to the top level;
    multi-model runs nest one entry per model under ``runs``. Dry-runs and
    per-model errors are reported honestly rather than dropped.
    """
    runs = []
    for rl in run_logs:
        if not rl:
            # execute_multi_run can yield None / {} for a model that died on a
            # terminal error — report it honestly rather than as a silent "ok".
            runs.append({"status": "error", "error": "no run log (run failed)"})
            continue
        if rl.get("error"):
            runs.append({
                "status": "error",
                "model": rl.get("model_id"),
                "error": rl.get("error"),
            })
        elif rl.get("dry_run"):
            runs.append({
                "status": "ok",
                "dry_run": True,
                "entry_count": rl.get("entry_count"),
                # Pre-spend estimate — null = UNKNOWN (un-priceable), NOT $0.
                "est_cost_usd": rl.get("est_cost_usd"),
                "est_basis": rl.get("est_basis"),
                # Contamination lane — HIGH = relative-comparison-only.
                "contamination": rl.get("contamination"),
                "relative_only": rl.get("relative_only", False),
                "lane": rl.get("lane"),
                # What the run would be instructed with / scored against
                # (path or null), and the eval-pack check the real run makes
                # — {status, missing, setup_command, …} (config.eval_pack_json).
                "coaching_file": rl.get("coaching_file"),
                "glossary_file": rl.get("glossary_file"),
                "eval_pack": rl.get("eval_pack"),
            })
        else:
            s = rl.get("_summary", {})
            runs.append({
                "status": "ok",
                "run_id": rl.get("run_id") or s.get("run_id"),
                "model": s.get("model") or rl.get("config", {}).get("model"),
                "corpus": s.get("corpus"),
                "entry_count": s.get("entry_count"),
                "scores": s.get("scores", {}),
                # Contamination lane — HIGH-contamination scores are valid for
                # relative comparison only, never absolute quality.
                "contamination": s.get("contamination"),
                "relative_only": s.get("relative_only", False),
                "lane": s.get("lane"),
                "report_path": s.get("report_path"),
                "run_log_path": s.get("run_log_path"),
                **({"read_logs": s["read_logs"]} if s.get("read_logs") else {}),
            })

    all_ok = bool(runs) and all(r["status"] == "ok" for r in runs)
    payload = {"command": "run", "status": "ok" if all_ok else "partial"}
    if multi:
        payload["runs"] = runs
    elif runs:
        # Flatten the single run into the top level for one-shot parsing.
        payload.update(runs[0])
    return payload


def _emit_run_json_summary(args, run_logs: list, multi: bool) -> None:
    """Print the run summary as a single JSON line when --json is set.

    Mirrors the error path (which already prints one JSON object): on SUCCESS
    the run used to emit nothing parseable, so an agent had to scrape the
    human run card. Now success and failure both end with a JSON line.
    """
    if not getattr(args, "json", False):
        return
    import json as _json
    print(_json.dumps(_run_json_summary(run_logs, multi), ensure_ascii=False))


def _absolute_pilots(pilots) -> list | None:
    """--power-pilot report paths made absolute, so a manifest written by
    `contest prepare --no-register` still finds them when `contest register`
    runs from another directory (they were recorded as typed)."""
    if not pilots:
        return None
    return [str(Path(p).expanduser().resolve()) for p in pilots]


def _power_preview(manifest: dict, primary_metric: str | None,
                   pilots) -> str:
    """The sealed test's declared power as one labelled line
    (power.declared_power_line) — or why it could not be computed. Shown at
    prepare and before registration; registration freezes the same value."""
    from mt_eval_harness.contest_prep import _declared_power
    from mt_eval_harness.power import declared_power_line
    try:
        return declared_power_line(
            _declared_power(manifest, primary_metric, pilots))
    except (ValueError, OSError, KeyError) as exc:
        return (f"Sealed-test power: ✗ not computed — {exc}. Registration "
                f"refuses the same --power-pilot; fix it before registering.")


def _prize_terms_from_args(args) -> dict | None:
    """Resolve the prize flags into the DECLARED terms, or ``None``.

    ``None`` is the default and an honest one: founder ruling R1 says a
    contest with no declared prize terms simply has no prize, and nothing is
    implied on the entrants' behalf. When a term IS declared it is printed in
    plain language — the option first, its derived detail after — with the
    SHA-256 entrants will pass to ``--accept-terms``, BEFORE the contest row is
    written, so the organizer sees exactly what they are about to promise
    while it is still cheap to change (migration 074 freezes the terms the
    moment the contest has entries).

    What is returned is the DECLARED spelling (the disposition plus only the
    overrides it allows) — the shape migration 074 accepts into
    ``contests.metadata.prize_terms``. The derived detail is recomputed on
    every read from the one key that was chosen, never stored twice.
    """
    disposition = getattr(args, "prize_disposition", None)
    terms_file = getattr(args, "prize_terms", None)
    overrides = {
        "--prize-retention": ("retention",
                              getattr(args, "prize_retention", None)),
        "--prize-release-timing": ("release",
                                   getattr(args, "prize_release_timing", None)),
        "--prize-release-license": (
            "release_license", getattr(args, "prize_release_license", None)),
        "--prize-terms-url": ("community_terms_url",
                              getattr(args, "prize_terms_url", None)),
    }
    given = {flag: (key, value) for flag, (key, value) in overrides.items()
             if value is not None}
    if not disposition and not terms_file:
        if given:
            raise ValueError(
                f"{', '.join(sorted(given))} was passed without "
                f"--prize-disposition. An override is a narrowing of a "
                f"declared term, not a term of its own: declare the option "
                f"first (--prize-disposition pass_to_holders | retain_ip | "
                f"release_open).")
        return None
    import json as _json
    from mt_eval_harness.contest_prize_terms import (
        declared_prize_terms, describe, terms_sha256,
    )
    if terms_file:
        if given:
            raise ValueError(
                f"--prize-terms {terms_file} declares the whole term, so "
                f"{', '.join(sorted(given))} cannot also be passed. Put the "
                f"override in the file, or drop the file and use "
                f"--prize-disposition.")
        path = Path(terms_file).expanduser()
        if not path.exists():
            raise ValueError(
                f"--prize-terms {terms_file} does not exist. It is a JSON "
                f'file declaring {{"disposition": "pass_to_holders" | '
                f'"retain_ip" | "release_open"}} (plus only the overrides '
                f"that option allows); or use --prize-disposition.")
        try:
            raw = _json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise ValueError(
                f"--prize-terms {terms_file} is not readable JSON: {exc}"
            ) from exc
        source = str(path)
    else:
        raw = {"disposition": disposition}
        for key, value in given.values():
            raw[key] = value
        source = f"--prize-disposition {disposition}"
    terms = declared_prize_terms(raw)
    digest = terms_sha256(terms)
    print()
    print(describe(terms))
    print()
    print(f"  Prize terms from {source}")
    print(f"  terms_sha256: {digest}")
    print(f"  Entrants accept these by passing --accept-terms {digest} to "
          f"`contest submit-model` / `contest submit-method`.")
    print()
    return terms


def _record_prize_terms(contest_id: str, terms: dict | None, *,
                        self_serve: bool) -> None:
    """Record declared prize terms on a PREPARED contest's metadata.

    ``contest create`` writes them at creation (``metadata_extra``). The
    prepare/register doors go through ``contest_prep``, whose registrars take
    the two publication promises but not the prize dial, so the terms are
    merged in the same way, through the same read-then-PATCH helper the
    registrars use for the holdout and the test suites — a JSONB PATCH
    replaces the column, so the merge has to happen client-side over a fresh
    read. Written immediately after registration, while the contest still has
    no entries and migration 074 has not frozen the terms yet. A failure here
    is loud: an organizer must never believe they promised terms the database
    never recorded.
    """
    if terms is None:
        return
    from mt_eval_harness.contest_prep import _write_contest_metadata
    if self_serve:
        from mt_eval_harness.auth import get_session
        from mt_eval_harness.contest import _api_request
        session = get_session()

        def request(method, path, **kwargs):
            return _api_request(method, path, session=session, **kwargs)
    else:
        from mt_eval_harness.sovereign_service import service_request
        request = service_request
    _write_contest_metadata(contest_id, {"prize_terms": terms},
                            request=request)
    print(f"     Prize terms recorded on contest {contest_id} "
          f"(frozen once it has entries).")


def _resolve_recommend_pair(args) -> tuple[str, str]:
    """The (source, target) pair for `recommend`, from either spelling.

    Positional (`recommend eng yor`) and flag (`--source eng --target yor`)
    forms are equivalent and may be mixed. Raises ValueError with a one-line,
    user-facing message when a code is missing or the two forms disagree.
    """
    pair = []
    for side in ("source", "target"):
        pos = getattr(args, f"{side}_pos", None)
        opt = getattr(args, f"{side}_opt", None)
        if pos and opt and pos != opt:
            raise ValueError(
                f"{side} given twice with different codes "
                f"('{pos}' positionally, '{opt}' via --{side}) — pass one."
            )
        code = opt or pos
        if not code:
            raise ValueError(
                f"missing the {side} language — use "
                "`mt-eval recommend <source> <target>` or "
                "`mt-eval recommend --source <code> --target <code>`."
            )
        pair.append(code)
    return pair[0], pair[1]


def main():
    """CLI entry point."""
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "list":
        try:
            code = cmd_list(
                args.what, live=getattr(args, "live", False),
                source=getattr(args, "source", None),
                target=getattr(args, "target", None),
                family=getattr(args, "family", None),
                include_quarantined=getattr(args, "include_quarantined", False),
                limit=getattr(args, "limit", 60),
                show_all=getattr(args, "all", False),
                as_json=getattr(args, "json", False),
            )
            if code:
                sys.exit(code)
        except FileNotFoundError as exc:
            # A missing dataset registry (bundled copy absent AND offline) is
            # a user-facing condition — one clean line, not a traceback. The
            # load_registry message already carries the where-it-looked hint.
            print(f"✗ {exc}", file=sys.stderr)
            sys.exit(1)
        return

    if args.command == "corpora":
        sys.exit(cmd_corpora(args))

    if args.command == "recommend":
        import json as _json

        from mt_eval_harness.recommend import recommend, render_text
        try:
            src, tgt = _resolve_recommend_pair(args)
        except ValueError as exc:
            print(f"mt-eval recommend: error: {exc}", file=sys.stderr)
            sys.exit(2)
        payload = recommend(src, tgt, use_context=args.use_context)
        if args.json:
            print(_json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            print(render_text(payload))
        return

    if args.command == "card":
        from mt_eval_harness.run_card import (
            ReportPairingError,
            card_inputs,
            render_run_card,
        )
        explicit = getattr(args, "report", None)
        if explicit and len(args.log_paths) != 1:
            print("  ✗ --report names the report of ONE run log — pass "
                  "exactly one run log with it.", file=sys.stderr)
            sys.exit(2)
        if explicit and not Path(explicit).expanduser().is_file():
            print(f"  ✗ --report {explicit}: no such file.", file=sys.stderr)
            sys.exit(1)
        failed = False
        for filepath in args.log_paths:
            path = Path(filepath)
            if not path.exists():
                print(f"  ✗ File not found: {filepath}", file=sys.stderr)
                failed = True
                continue
            # Validate the file is parseable before rendering, so a
            # truncated/partial file fails with a one-line error, not a raw
            # JSONDecodeError traceback.
            load_runlog(path)
            try:
                # A report (any name — `test -o` may have called it
                # anything) is read with the run log it records; a run log's
                # report is found beside it or where `test -o` recorded it.
                log, report = card_inputs(path)
                print(render_run_card(log, explicit or report))
            except ReportPairingError as exc:
                print(f"  ✗ {exc}", file=sys.stderr)
                failed = True
        if failed:
            sys.exit(1)
        return

    if args.command == "test":
        from mt_eval_harness.tester import run_test
        from mt_eval_harness.plugin_discovery import discover_metric_plugins

        # Load the run log to detect target language for plugin auto-discovery.
        # load_runlog fails cleanly (one line + exit 1) on a missing/truncated
        # file instead of dumping a raw JSONDecodeError traceback.
        log_path = Path(args.log_path)
        log_data = load_runlog(log_path)
        _test_config = dict(log_data.get("config", {}))
        if getattr(args, "glossary", None):
            _test_config["glossary_file"] = args.glossary
        metric_plugins = discover_metric_plugins(
            _test_config,
            skip_fst=getattr(args, "skip_fst", False),
            method_dir=log_data.get("config", {}).get("method_path"),
            exclude_fst=(getattr(args, "skip_fst", False) or None),
            skip_eval_standard=(getattr(args, "skip_eval_standard", False)
                                or None),
        )

        run_test(
            args.log_path,
            args.output,
            metric_plugins=metric_plugins or None,
            compute_ci=not getattr(args, "no_ci", False),
            n_bootstrap_ci=getattr(args, "n_bootstrap_ci", 1000),
            glossary_file=getattr(args, "glossary", None),
        )

        # Auto-print the run card after scoring — of the report just written
        # (-o, or beside the log). It used to read the default path whatever
        # -o said, and printed "chrF++ 0.0 / BLEU 0.0" (Round 9 researcher).
        from mt_eval_harness.run_card import default_report_path
        report_path = (Path(args.output) if args.output
                       else default_report_path(log_path))
        try:
            from mt_eval_harness.run_card import render_run_card
            print(render_run_card(log_path, report_path))
        except Exception as e:
            # (There is no module logger here — this line used to raise
            # NameError inside its own error handler.)
            print(f"  ⚠ Failed to render run card: {e}", file=sys.stderr)

        # Offer to publish to the arena (interactive only)
        _prompt_publish(report_path)
        return

    if args.command == "queue":
        from mt_eval_harness.queue_runner import run_from_args
        sys.exit(run_from_args(args))

    if args.command == "publish":
        from mt_eval_harness.publish import (
            AnonymousRateLimitError,
            publish_to_supabase,
            republish_directory,
        )
        republish_dir = getattr(args, "republish_dir", None)
        if republish_dir and args.report_path:
            print("Pass either one report path or --republish-dir, not both.",
                  file=sys.stderr)
            sys.exit(2)
        if not republish_dir and not args.report_path:
            print("Pass a report path, or --republish-dir DIR to publish "
                  "every report under a directory.", file=sys.stderr)
            sys.exit(2)
        if republish_dir:
            if getattr(args, "method_card", None):
                print("--method-card attaches ONE card to ONE report — it "
                      "cannot apply to a whole --republish-dir batch.",
                      file=sys.stderr)
                sys.exit(2)
            summary = republish_directory(
                republish_dir,
                anonymous=getattr(args, "anonymous", False),
                yes_prod=getattr(args, "yes_prod", False),
                scores_only=getattr(args, "scores_only", False),
                publish_entries_override=getattr(args, "publish_entries",
                                                 False),
                dry_run=getattr(args, "dry_run", False),
                redact_coaching=getattr(args, "redact_coaching", False),
            )
            # 0 only when nothing remains unpublished; deferred/failed → 1 so
            # cron callers can tell "done" from "re-run me later".
            sys.exit(0 if not summary["failed"] and not summary["deferred"]
                     else 1)
        # A mistyped or bare-filename path used to escape as a raw
        # FileNotFoundError traceback from deep inside publish.
        if not Path(args.report_path).is_file():
            print(f"mt-eval publish: error: no report file at "
                  f"'{args.report_path}' (pass the *_report.json that "
                  f"`mt-eval run` / `mt-eval test` wrote; the run prints its "
                  f"path).", file=sys.stderr)
            sys.exit(1)
        try:
            publish_to_supabase(
                args.report_path,
                method_card_path=getattr(args, "method_card", None),
                auto_confirm=getattr(args, "yes", False),
                scores_only=getattr(args, "scores_only", False),
                publish_entries_override=getattr(args, "publish_entries",
                                                 False),
                dry_run=getattr(args, "dry_run", False),
                yes_prod=getattr(args, "yes_prod", False),
                anonymous=getattr(args, "anonymous", False),
                redact_coaching=getattr(args, "redact_coaching", False),
            )
        except AnonymousRateLimitError as exc:
            # The intake's per-IP/global window is closed for hours — exit
            # honestly with the recovery path instead of a traceback.
            print(f"\n  ✗ Anonymous publish rate-limited: {exc}")
            print(f"    Your report is saved at: {args.report_path}")
            print(f"    Publish later with: mt-eval publish "
                  f"{args.report_path} --anonymous --prod")
            print(f"    (or sign in for attributed, unlimited publishing: "
                  f"mt-eval publish {args.report_path} --prod)")
            sys.exit(1)
        return

    if args.command == "contest":
        from mt_eval_harness.contest import (
            create_contest,
            list_contests, list_submissions,
        )

        # Expected refusals (corpus ineligible for the use_context, quarantined
        # corpus, invalid visibility, closed contest, missing run_id, Supabase
        # errors) are user-facing conditions — render them as a clean one-line
        # error, never a raw Python traceback.
        try:
            if args.contest_command == "create":
                teams = None
                if getattr(args, "teams", None):
                    teams = [t.strip() for t in args.teams.split(",")]
                # Prize terms are declared, printed and hashed BEFORE the row
                # is written. R1: a prize exists only on a SOVEREIGN (sealed)
                # contest, so terms over a corpus with no sealed_sets
                # registration are refused here rather than written and then
                # refused later by `contest rank`.
                prize_terms = _prize_terms_from_args(args)
                metadata_extra = None
                if prize_terms is not None:
                    from mt_eval_harness.contest import (
                        sealed_set_registration,
                    )
                    if sealed_set_registration(args.corpus) is None:
                        raise ValueError(
                            f"--prize-disposition/--prize-terms declares a prize "
                            f"on a contest over {args.corpus!r}, which has no "
                            f"sealed_sets registration — that is a STANDARD "
                            f"contest over a public corpus. Since 2026-09-06 "
                            f"prizes exist only on sovereign "
                            f"contests, where the entry is executed by the "
                            f"organizer's air-gapped node on a sealed set. "
                            f"Prepare one with `mt-eval contest prepare` "
                            f"(--secret-size), or create this contest without "
                            f"prize terms.")
                    metadata_extra = {"prize_terms": prize_terms}
                declared_power = None
                if getattr(args, "test_size", None):
                    from mt_eval_harness.contest_rank import (
                        DEFAULT_PRIMARY_METRIC, canonical_metric,
                    )
                    from mt_eval_harness.power import declare_test_power
                    declared_power = declare_test_power(
                        args.test_size,
                        canonical_metric(getattr(args, "primary_metric", None)
                                         or DEFAULT_PRIMARY_METRIC),
                        pilot_reports=getattr(args, "power_pilot", None))
                elif getattr(args, "power_pilot", None):
                    raise ValueError("--power-pilot needs --test-size (the "
                                     "size of the test the pilot's effect "
                                     "parameters are applied to)")
                create_contest(
                    declared_power=declared_power,
                    name=args.name,
                    contest_id=getattr(args, "slug", None),
                    corpus_id=args.corpus,
                    language_pair=args.language_pair,  # --language-pair is required (no hardcoded default)
                    visibility=args.visibility,
                    teams=teams,
                    description=getattr(args, "description", ""),
                    use_context=getattr(args, "use_context", "non-commercial"),
                    primary_metric=getattr(args, "primary_metric", None),
                    metric_model=getattr(args, "metric_model", None),
                    results_visibility=getattr(
                        args, "results_visibility", DEFAULT_RESULTS_VISIBILITY),
                    anonymize_until_close=bool(
                        getattr(args, "anonymize_until_close", False)),
                    metadata_extra=metadata_extra,
                )
            elif args.contest_command == "prepare":
                from mt_eval_harness.contest_prep import (
                    LICENSE_REQUIRED_MESSAGE, ContestPrepError,
                    prepare_contest, register_prepared,
                )
                # A retired ranking metric (the composite) is refused BEFORE
                # any dev/sealed file is prepared, not after (scoring
                # standard/1; rankable_metrics.refuse_retired_for_new is
                # applied again when the choices are recorded).
                if getattr(args, "primary_metric", None):
                    from mt_eval_harness.contest_rank import canonical_metric
                    from mt_eval_harness.rankable_metrics import (
                        refuse_retired_for_new)
                    refuse_retired_for_new(canonical_metric(args.primary_metric))
                # argparse already normalized --pair (_pair_arg): eng-crk and
                # 'eng→crk' arrive as eng>crk.
                src, sep, tgt = args.pair.partition(">")
                if not sep or not src or not tgt:
                    raise ValueError(
                        f"--pair must look like 'eng>crk' or eng-crk "
                        f"(got {args.pair!r})")
                # Before any network read or prompt: no licence is chosen on
                # the rights-holder's behalf (prepare_contest checks it too).
                if not (args.license or "").strip():
                    raise ContestPrepError(LICENSE_REQUIRED_MESSAGE)
                # Declared prize terms are shown and hashed BEFORE any file is
                # written, so a contradiction is caught while nothing exists
                # yet. A prepared contest is registered over its SEALED secret
                # set, so R1's sovereign-lane condition holds by construction.
                prize_terms = _prize_terms_from_args(args)
                # Edition attach (046): resolve the umbrella row up front so
                # its policy defaults can fill any flags left unset — explicit
                # flags always win. --no-register stays fully offline, so the
                # edition id is recorded unresolved and the FK validates it at
                # registration time instead.
                edition = None
                if args.shared_task and not args.no_register:
                    from mt_eval_harness.shared_task import fetch_shared_task
                    edition = fetch_shared_task(args.shared_task)
                authorization_model = (
                    args.authorization_model
                    or (edition or {}).get("default_authorization_model")
                    or "per-submission")
                intake_daily_limit = (
                    args.intake_daily_limit
                    if args.intake_daily_limit is not None
                    else int((edition or {}).get("default_intake_daily_limit")
                             or 5))
                if args.shared_task and args.no_register:
                    print(f"  --no-register: shared task {args.shared_task!r} "
                          f"recorded WITHOUT validation and its policy "
                          f"defaults were not fetched (offline) — explicit "
                          f"flags / global defaults apply; registration "
                          f"validates the edition.")
                manifest = prepare_contest(
                    master_corpus_path=args.corpus,
                    slug=args.slug,
                    name=args.name,
                    source_lang=src.strip(),
                    target_lang=tgt.strip(),
                    dev_size=args.dev_size,
                    blind_size=args.blind_size,
                    secret_size=args.secret_size,
                    holdout_size=args.sealed_holdout_size,
                    test_suites=getattr(args, "test_suite", []) or [],
                    seed=args.seed,
                    qualifier_threshold=args.qualifier_threshold,
                    authorization_model=authorization_model,
                    intake_daily_limit=intake_daily_limit,
                    shared_task_id=args.shared_task,
                    custodian_group_id=getattr(args, "custodian_group", None),
                    threshold_pubkey=getattr(args, "threshold_pubkey", None),
                    plaintext_refs=args.plaintext_refs,
                    license_id=args.license,
                    do_not_train=(None if args.do_not_train is None
                                  else args.do_not_train == "true"),
                    year=args.year,
                    out_dir=args.out,
                )
                from mt_eval_harness.contest_prep import release_terms_lines
                from mt_eval_harness.release_folder import MARKER, runs_dir_for
                print(f"\n  Prepared contest artifacts under {args.out}")
                print(f"    public/  → release these (dev+refs, blind source); "
                      f"marked releasable ({MARKER})")
                print(f"    local/   → NEVER leaves this machine "
                      f"(sealed refs, manifest)")
                print(f"    runs/    → where run logs and caches of runs on "
                      f"the dev set go ({runs_dir_for(Path(manifest['releasable_dir']))}); "
                      f"mt-eval refuses to write them into public/")
                _split = manifest.get("split") or {}
                if _split.get("multi_row_groups"):
                    print(f"    Split: {_split['method']} — "
                          f"{_split['rows_in_multi_row_groups']} rows share a "
                          f"source or reference with another row "
                          f"({_split['multi_row_groups']} groups); each group "
                          f"landed whole in one split, so no sealed row "
                          f"repeats a released one")
                for _line in release_terms_lines(manifest["release_terms"]):
                    print(_line)
                from mt_eval_harness.qualifier_gate import threshold_phrase
                from mt_eval_harness.contest_prep import contest_id_of
                print(f"    Contest id: {contest_id_of(manifest)} — entrants "
                      f"pass this to `contest qualify` / `submit-method`; "
                      f"announce it with the dev release")
                print(f"    Qualifier: {manifest['qualifier']['qualifier_id']} "
                      f"@ {threshold_phrase(manifest['qualifier']['threshold'])}")
                # The sealed test's minimum detectable effect, HERE where the
                # organizer decides sizes — with or without --no-register (it
                # used to be computed only by a signed-in registration).
                _power_pilot = _absolute_pilots(
                    getattr(args, "power_pilot", None))
                print("    " + _power_preview(
                    manifest, getattr(args, "primary_metric", None),
                    _power_pilot))
                # The registration flags given here are RECORDED in the
                # organizer-local manifest, whichever door registers: with
                # --no-register, `contest register` applies them (they used
                # to vanish — a --results-visibility typed at prepare time was
                # not what the contest later promised); registering now, they
                # record what was registered — the prize terms among them,
                # which `node init --from-contest` turns into node.json's
                # prize_terms_sha256 (it had nothing to read it from).
                from mt_eval_harness.contest_prep import (
                    REGISTRATION_DEFAULTS, record_registration_choices,
                    registration_term_lines,
                )
                _given_terms = {
                    "visibility": args.visibility,
                    "use_context": args.use_context,
                    "description": args.description,
                    "open_intake": (False if args.closed_intake else None),
                    "primary_metric": getattr(args, "primary_metric", None),
                    "metric_model": getattr(args, "metric_model", None),
                    "results_visibility": args.results_visibility,
                    "anonymize_until_close": (
                        True if args.anonymize_until_close else None),
                    "prize_terms": prize_terms,
                    # absolute: register may run from another directory
                    "power_pilot": _power_pilot,
                }
                block = record_registration_choices(manifest, {
                    k: (v if v is not None else REGISTRATION_DEFAULTS[k])
                    for k, v in _given_terms.items()})
                # Every term as given or default, and when it freezes —
                # BEFORE anything is registered (Round 12 researcher).
                for _line in registration_term_lines(
                        block, {k for k, v in _given_terms.items()
                                if v is not None},
                        registered=not args.no_register):
                    print(_line)
                if args.no_register:
                    print("\n  --no-register: nothing was written to the "
                          "contest database. Register the qualifier, sealed "
                          "set(s) and contest with your own sign-in (no "
                          "service key): mt-eval contest register --manifest "
                          f"{manifest['manifest_path']} — or, if you operate "
                          "the contest database, re-run without "
                          "--no-register with MT_EVAL_SUPABASE_SERVICE_KEY "
                          "set to its service-role key.")
                    print("    The terms above are recorded in the manifest "
                          "for registration (`contest register` applies them "
                          "unless you pass its own flags).")
                    # What registration would send, row by row — built by the
                    # same functions `contest register` sends with, so this is
                    # the payload, not a description of it.
                    from mt_eval_harness.contest_prep import (
                        format_registration_plan, registration_plan,
                    )
                    print(format_registration_plan(
                        registration_plan(manifest, block)))
                elif args.self_serve:
                    from mt_eval_harness.contest_prep import (
                        register_prepared_self_serve,
                    )
                    record = register_prepared_self_serve(
                        manifest,
                        visibility=block["visibility"],
                        use_context=block["use_context"],
                        description=block["description"],
                        open_intake=block["open_intake"],
                        primary_metric=block["primary_metric"],
                        metric_model=block["metric_model"],
                        power_pilot=getattr(args, "power_pilot", None),
                        results_visibility=block["results_visibility"],
                        anonymize_until_close=bool(
                            block["anonymize_until_close"]),
                    )
                    _record_prize_terms(record["id"], prize_terms,
                                        self_serve=True)
                else:
                    record = register_prepared(
                        manifest,
                        visibility=block["visibility"],
                        use_context=block["use_context"],
                        description=block["description"],
                        open_intake=block["open_intake"],
                        primary_metric=block["primary_metric"],
                        metric_model=block["metric_model"],
                        power_pilot=getattr(args, "power_pilot", None),
                        results_visibility=block["results_visibility"],
                        anonymize_until_close=bool(
                            block["anonymize_until_close"]),
                    )
                    _record_prize_terms(record["id"], prize_terms,
                                        self_serve=False)
            elif args.contest_command == "register":
                from mt_eval_harness.contest_prep import (
                    register_prepared_self_serve,
                )
                manifest_path = Path(args.manifest)
                if not manifest_path.exists():
                    raise ValueError(
                        f"--manifest {args.manifest} does not exist — it is "
                        f"the local/manifest.json written by "
                        f"`mt-eval contest prepare` (organizer-local).")
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                manifest.setdefault("manifest_path", str(manifest_path))
                # Register's flags default to None (set_defaults below the
                # parser) so a flag NOT given falls back to what `contest
                # prepare --no-register` recorded, never to a silent default.
                from mt_eval_harness.contest_prep import (
                    resolve_registration_choices,
                )
                reg, reg_notes = resolve_registration_choices(manifest, {
                    "visibility": args.visibility,
                    "use_context": args.use_context,
                    "description": args.description,
                    "open_intake": (False if args.closed_intake else None),
                    "primary_metric": getattr(args, "primary_metric", None),
                    "metric_model": getattr(args, "metric_model", None),
                    "results_visibility": args.results_visibility,
                    "anonymize_until_close": (
                        True if args.anonymize_until_close else None),
                    "prize_terms": _prize_terms_from_args(args),
                    "power_pilot": getattr(args, "power_pilot", None),
                })
                for note in reg_notes:
                    print(f"  • {note}")
                # What will be frozen as declared_power, before sign-in.
                print("  " + _power_preview(manifest, reg["primary_metric"],
                                            reg["power_pilot"]))
                record = register_prepared_self_serve(
                    manifest,
                    visibility=reg["visibility"],
                    use_context=reg["use_context"],
                    description=reg["description"],
                    open_intake=reg["open_intake"],
                    primary_metric=reg["primary_metric"],
                    metric_model=reg["metric_model"],
                    power_pilot=reg["power_pilot"],
                    results_visibility=reg["results_visibility"],
                    anonymize_until_close=bool(reg["anonymize_until_close"]),
                )
                _record_prize_terms(record["id"], reg["prize_terms"],
                                    self_serve=True)
                # The manifest records what was registered (a register flag
                # may have replaced a value prepare recorded), so `node init
                # --from-contest` fills node.json from the contest as it is —
                # prize terms included.
                from mt_eval_harness.contest_prep import (
                    record_registration_choices,
                )
                record_registration_choices(manifest, reg)
            elif args.contest_command == "qualify":
                from mt_eval_harness.contest_qualify import qualify
                offline_qualifier = None
                if args.offline_threshold is not None or \
                        args.offline_qualifier_id:
                    if args.offline_threshold is None or \
                            not args.offline_qualifier_id:
                        raise ValueError(
                            "--offline-threshold and --offline-qualifier-id "
                            "go together: offline, BOTH qualifier facts come "
                            "from the organizer's release (nothing is "
                            "guessed).")
                    dev_meta = json.loads(
                        Path(args.dev_corpus).read_text(encoding="utf-8"))
                    dataset_meta = dev_meta.get("dataset") or {}
                    offline_qualifier = {
                        "qualifier_id": args.offline_qualifier_id,
                        "threshold": args.offline_threshold,
                        "corpus_card_id": dataset_meta.get("corpus_id"),
                    }
                    pair = dataset_meta.get("language_pair")
                    if isinstance(pair, dict) and pair.get("source"):
                        offline_qualifier["language_pair"] = (
                            f"{pair['source']}>{pair.get('target', '')}")
                qualify(
                    args.contest_id,
                    dev_hyp_path=args.dev,
                    dev_corpus_path=args.dev_corpus,
                    system_label=args.system,
                    method_class=args.method_class,
                    paradigm=getattr(args, "paradigm", None),
                    receipt_dir=getattr(args, "receipt_dir", None),
                    offline_qualifier=offline_qualifier,
                )
            elif args.contest_command == "validate":
                from mt_eval_harness.contest_validate import (
                    ValidateError, format_report, validate,
                )
                if (args.offline_threshold is None) != \
                        (not args.offline_qualifier_id):
                    raise ValidateError(
                        "--offline-threshold and --offline-qualifier-id go "
                        "together: both come from the organizer's release, "
                        "and neither is guessed. Pass both, or neither and "
                        "let the bundle's own receipt supply them.")
                # --json means stdout is PURE JSON: the qualifier leg prints
                # its own human banner, so it goes to stderr instead.
                banner = (contextlib.redirect_stdout(sys.stderr) if args.json
                          else contextlib.nullcontext())
                with banner:
                    result = validate(
                        args.path,
                        lane=getattr(args, "lane", None),
                        manifest_path=getattr(args, "manifest", None),
                        method_dir=args.method_dir,
                        dockerfile=args.dockerfile,
                        expected_corpus_id=getattr(args, "secret_set", None),
                        contest_id=getattr(args, "contest", None),
                        dev_hyp_path=getattr(args, "dev", None),
                        dev_corpus_path=getattr(args, "dev_corpus", None),
                        system_label=getattr(args, "system", None),
                        method_class=getattr(args, "method_class", None),
                        paradigm=getattr(args, "paradigm", None),
                        qualifier_id=getattr(args, "offline_qualifier_id", None),
                        threshold=getattr(args, "offline_threshold", None),
                        receipt_dir=getattr(args, "receipt_dir", None),
                    )
                if args.json:
                    print(json.dumps(result, ensure_ascii=False, indent=2))
                else:
                    print(format_report(result))
                if not result["ok"]:
                    sys.exit(1)
            elif args.contest_command == "submit-method":
                from mt_eval_harness.method_bundle import (
                    MethodBundleError,
                    submit_method,
                )
                if args.track == "constrained" and not args.training_data_file:
                    raise MethodBundleError(
                        "--track constrained requires --training-data-file: "
                        "the constrained claim is a claim ABOUT a list of "
                        "training data, so the list is part of the claim. "
                        "(A method trained on nothing says so in the file, "
                        "e.g. 'none — rule-based'.)")
                # The weights pair is a claim about weights: required when
                # the method has trainable parameters, not applicable at 0.
                if args.parameter_count and args.parameter_count > 0 and (
                        not args.weights_license
                        or args.weights_public is None):
                    missing = [f for f, ok in (
                        ("--weights-license", bool(args.weights_license)),
                        ("--weights-public or --weights-private",
                         args.weights_public is not None)) if not ok]
                    raise MethodBundleError(
                        f"--parameter-count {args.parameter_count} declares "
                        f"trained weights, so it also needs "
                        f"{' and '.join(missing)}. A method with no trained "
                        f"weights (rule-based, dictionary, FST) declares "
                        f"--parameter-count 0 and neither.")
                training_data = ""
                if args.training_data_file:
                    training_data = Path(args.training_data_file).read_text(
                        encoding="utf-8")
                submission_description = ""
                if args.description_file:
                    submission_description = Path(
                        args.description_file).read_text(encoding="utf-8")
                submit_method(
                    contest_id=args.contest_id,
                    method_dir=args.method_dir,
                    dockerfile=args.dockerfile,
                    method_name=args.name,
                    method_version=args.version,
                    entrypoint=args.entrypoint,
                    method_class=args.method_class,
                    paradigm=getattr(args, "paradigm", None),
                    description=getattr(args, "description", ""),
                    developer_name=args.developer,
                    developer_email=getattr(args, "developer_email", None),
                    affiliation=getattr(args, "affiliation", ""),
                    agree=args.agree,
                    node_id=args.node_id,
                    track=args.track,
                    parameter_count=args.parameter_count,
                    weights_license=args.weights_license,
                    weights_public=args.weights_public,
                    training_data=training_data,
                    is_primary=args.is_primary,
                    submission_description=submission_description,
                    method_release_url=getattr(
                        args, "method_release_url", None),
                    accept_terms=getattr(args, "accept_terms", None),
                    receipt_dir=getattr(args, "receipt_dir", None),
                    system=getattr(args, "system", None),
                    offline_threshold=getattr(args, "offline_threshold", None),
                    offline_qualifier_id=getattr(
                        args, "offline_qualifier_id", None),
                    corpus_version=args.corpus_version,
                    secret_set_id=getattr(args, "secret_set", None),
                    language_pair=getattr(args, "pair", None),
                    bundle_out=getattr(args, "bundle_out", None),
                    offline=args.offline,
                    gpu=args.gpu,
                    gpu_memory_gb=args.gpu_memory_gb,
                    ram_gb=args.ram_gb,
                    disk_gb=args.disk_gb,
                    max_runtime_minutes=args.max_runtime_minutes,
                )
            elif args.contest_command == "submit-model":
                from mt_eval_harness.model_bundle import (
                    ModelBundleError,
                    submit_model,
                )
                if args.track == "constrained" and not args.training_data_file:
                    raise ModelBundleError(
                        "--track constrained requires --training-data-file: "
                        "the constrained claim is a claim ABOUT a list of "
                        "training data, so the list is part of the claim.")
                training_data = ""
                if args.training_data_file:
                    training_data = Path(args.training_data_file).read_text(
                        encoding="utf-8")
                submission_description = ""
                if args.description_file:
                    submission_description = Path(
                        args.description_file).read_text(encoding="utf-8")
                submit_model(
                    contest_id=args.contest_id,
                    model_dir=args.model_dir,
                    method_name=args.name,
                    method_version=args.version,
                    method_class=args.method_class,
                    architecture=args.architecture,
                    paradigm=getattr(args, "paradigm", "neural-nmt"),
                    description=getattr(args, "description", ""),
                    developer_name=args.developer,
                    developer_email=getattr(args, "developer_email", None),
                    affiliation=getattr(args, "affiliation", ""),
                    agree=args.agree,
                    node_id=args.node_id,
                    corpus_version=args.corpus_version,
                    secret_set_id=getattr(args, "secret_set", None),
                    weights_file=getattr(args, "weights_file",
                                         "model.safetensors"),
                    config_file=getattr(args, "config_file", "config.json"),
                    src_lang_token=getattr(args, "src_lang_token", None),
                    tgt_lang_token=getattr(args, "tgt_lang_token", None),
                    track=args.track,
                    parameter_count=args.parameter_count,
                    weights_license=args.weights_license,
                    weights_public=args.weights_public,
                    training_data=training_data,
                    is_primary=args.is_primary,
                    submission_description=submission_description,
                    method_release_url=getattr(
                        args, "method_release_url", None),
                    accept_terms=getattr(args, "accept_terms", None),
                    receipt_dir=getattr(args, "receipt_dir", None),
                    system=getattr(args, "system", None),
                    offline_threshold=getattr(args, "offline_threshold", None),
                    offline_qualifier_id=getattr(
                        args, "offline_qualifier_id", None),
                    language_pair=getattr(args, "pair", None),
                    bundle_out=getattr(args, "bundle_out", None),
                    offline=args.offline,
                )
            elif args.contest_command == "method-status":
                from mt_eval_harness.method_bundle import method_status
                method_status(args.request_id)
            elif args.contest_command == "status":
                from mt_eval_harness.contest_intake import contest_status
                contest_status(args.id)
            elif args.contest_command == "list":
                list_contests(
                    status=getattr(args, "status", "open"),
                    language_pair=getattr(args, "language_pair", None),
                )
            elif args.contest_command == "submissions":
                list_submissions(args.contest_id)
            elif args.contest_command == "open-intake":
                from mt_eval_harness.contest import set_intake
                set_intake(args.contest_id, True)
            elif args.contest_command == "close-intake":
                from mt_eval_harness.contest import set_intake
                set_intake(args.contest_id, False)
            elif args.contest_command == "rank":
                from mt_eval_harness.auth import get_cached_session
                from mt_eval_harness.contest_rank import (
                    build_ranking, check_reveal_permitted, fetch_contest,
                    format_ranking_table,
                )
                # Read-only: a cached session widens visibility (private
                # contests, the organizer's own requests) but a missing one
                # never prompts — `rank --json` must be scriptable.
                session = get_cached_session()
                contest_row = fetch_contest(args.contest_id, session=session)
                if args.reveal_identities:
                    # Standing is checked BEFORE anything is rendered: an
                    # anonymity promise that can be lifted by whoever runs the
                    # command is not a promise.
                    check_reveal_permitted(
                        contest_row, session,
                        i_am_the_organizer=args.i_am_the_organizer)
                ranking = build_ranking(
                    args.contest_id,
                    metric=args.metric,
                    include_unverified=args.include_unverified,
                    tie_test=args.tie_test,
                    n_resamples=args.n_resamples,
                    alpha=args.alpha,
                    seed=args.seed,
                    use_segments=not args.no_segments,
                    phase=args.phase,
                    track=args.track,
                    reveal_identities=args.reveal_identities,
                    session=session,
                    contest=contest_row,
                    banner_stream=sys.stderr,
                    node_verdicts=args.node_verdicts,
                    verify_key=args.verify_key,
                )
                if args.json:
                    print(json.dumps(ranking, indent=2, ensure_ascii=False))
                else:
                    if not args.include_contrastive and ranking.get("contrastive"):
                        n = len(ranking["contrastive"])
                        held = ranking.pop("contrastive")
                        print(format_ranking_table(ranking))
                        ranking["contrastive"] = held
                        print(f"  ({n} contrastive entr"
                              f"{'y is' if n == 1 else 'ies are'} not shown — "
                              f"--include-contrastive lists them; they are "
                              f"always present in --json and in the CSV "
                              f"export)")
                    else:
                        print(format_ranking_table(ranking))
            elif args.contest_command == "close":
                from mt_eval_harness.contest import close_contest
                close_kwargs = dict(
                    include_unverified=args.include_unverified,
                    force=args.force,
                    auto_confirm=args.yes,
                    tie_test=args.tie_test,
                    n_resamples=args.n_resamples,
                    alpha=args.alpha,
                    seed=args.seed,
                    use_segments=not args.no_segments,
                    node_verdicts=args.node_verdicts,
                    verify_key=args.verify_key,
                )
                # Passed by keyword ONLY when the operator said which way they
                # want it; with neither flag given, close_contest's own
                # documented default governs (a close reveals, because
                # anonymize_until_close promises anonymity *until close*).
                if args.reveal_identities is not None:
                    close_kwargs["reveal_identities"] = args.reveal_identities
                close_contest(args.contest_id, **close_kwargs)
            elif args.contest_command == "export":
                import csv
                from mt_eval_harness.auth import get_cached_session
                from mt_eval_harness.contest_rank import (
                    export_contest, ranking_to_csv_rows,
                )
                ranking = export_contest(
                    args.contest_id,
                    session=get_cached_session(),
                    include_unverified=args.include_unverified,
                    metric=args.metric,
                    use_segments=not args.no_segments,
                    phase=args.phase,
                    track=args.track,
                )
                if args.format == "csv":
                    rows = ranking_to_csv_rows(ranking)
                    if args.out:
                        with open(args.out, "w", newline="", encoding="utf-8") as fh:
                            csv.writer(fh).writerows(rows)
                    else:
                        csv.writer(sys.stdout).writerows(rows)
                else:
                    text = json.dumps(ranking, indent=2, ensure_ascii=False)
                    if args.out:
                        Path(args.out).write_text(text + "\n", encoding="utf-8")
                    else:
                        print(text)
                state = ("FROZEN (closed "
                         f"{ranking.get('closed_at')})" if ranking.get("frozen")
                         else "PROVISIONAL (contest still open)")
                print(f"  Exported {args.contest_id} ranking [{state}] "
                      f"as {args.format}"
                      f"{' → ' + args.out if args.out else ''}",
                      file=sys.stderr)
            elif args.contest_command == "select-for-human-eval":
                from mt_eval_harness.auth import get_cached_session
                from mt_eval_harness.contest_rank import export_contest
                from mt_eval_harness.human_eval import (
                    format_selection, select_for_human_eval, write_selection,
                )
                # The frozen snapshot for a closed contest, verbatim; a live
                # provisional ranking for an open one (which --write then
                # refuses, naming the reason).
                ranking = export_contest(args.contest_id,
                                         session=get_cached_session())
                selection = select_for_human_eval(
                    ranking,
                    budget=args.budget,
                    keep_tie_groups=not args.no_keep_tie_groups,
                )
                if args.json:
                    print(json.dumps(selection, indent=2, ensure_ascii=False))
                else:
                    print(format_selection(selection))
                if args.write:
                    write_selection(args.contest_id, selection)
                    print(f"  ✅ Wrote metadata.human_eval_selection on "
                          f"{args.contest_id} "
                          f"({selection['selected_count']} system(s) selected, "
                          f"budget {selection['budget']} per track).",
                          file=sys.stderr)
                    print(f"     {selection['note']}", file=sys.stderr)
                else:
                    print("  (not written — pass --write to record it on the "
                          "closed contest)", file=sys.stderr)
            else:
                # No subcommand — show usage
                print("Usage: mt-eval contest {prepare,create,register,"
                      "qualify,validate,submit-method,submit-model,"
                      "method-status,status,list,submissions,open-intake,"
                      "close-intake,rank,close,export,select-for-human-eval}")
                print("Run 'mt-eval contest --help' for details.")
        except (ValueError, RuntimeError, FileNotFoundError, KeyError) as exc:
            # KeyError carries its message quoted — unwrap for a clean line.
            msg = exc.args[0] if isinstance(exc, KeyError) and exc.args else exc
            print(f"\n  ✗ {msg}", file=sys.stderr)
            sys.exit(1)
        return

    if args.command == "shared-task":
        from mt_eval_harness.shared_task import (
            create_shared_task, list_shared_tasks,
        )
        try:
            if args.shared_task_command == "create":
                row = create_shared_task(
                    shared_task_id=args.id,
                    name=args.name,
                    organizer=args.organizer,
                    year=args.year,
                    default_authorization_model=args.authorization_model,
                    default_intake_daily_limit=args.intake_daily_limit,
                    description=args.description,
                )
                print(f"\n  ✅ Shared task {row.get('shared_task_id', args.id)} "
                      f"registered — {row.get('organizer', args.organizer)}, "
                      f"cycle {row.get('year', args.year)} "
                      f"(defaults: {args.authorization_model}, "
                      f"{args.intake_daily_limit}/day)")
                print(f"     Attach each per-pair contest with: "
                      f"mt-eval contest prepare … --shared-task {args.id}")
            elif args.shared_task_command == "list":
                rows = list_shared_tasks(
                    year=getattr(args, "year", None),
                    include_archived=getattr(args, "all", False))
                if not rows:
                    print("  No shared-task editions registered "
                          "(create one with `mt-eval shared-task create`).")
                for r in rows:
                    print(f"  {r['shared_task_id']:<28} {r['year']}  "
                          f"{r['status']:<9} {r['name']} — {r['organizer']} "
                          f"(defaults: {r['default_authorization_model']}, "
                          f"{r['default_intake_daily_limit']}/day)")
            elif args.shared_task_command == "report":
                from mt_eval_harness.shared_task import (
                    report_edition, set_report_url,
                )
                path = report_edition(args.edition, out_dir=args.out)
                print(f"\n  ✅ Edition report written from frozen snapshots: "
                      f"{path}")
                if args.set_url:
                    row = set_report_url(args.edition, args.set_url)
                    print(f"     Report URL recorded: "
                          f"{row.get('report_url', args.set_url)} "
                          f"(generated {row.get('report_generated_at', '?')}) "
                          f"— the public shared-tasks page links to it.")
                else:
                    print("     Publish it, then record the link with "
                          "--set-url <https://…> so the public shared-tasks "
                          "page can offer it.")
            else:
                print("Usage: mt-eval shared-task {create,list,report}")
                print("Run 'mt-eval shared-task --help' for details.")
        except (ValueError, RuntimeError) as exc:
            print(f"\n  ✗ {exc}", file=sys.stderr)
            sys.exit(1)
        return

    if args.command == "node":
        from mt_eval_harness import contest_node
        try:
            if args.node_command == "init":
                text, notes = None, []
                if getattr(args, "from_contest", None):
                    text, notes = contest_node.node_config_from_contest(
                        args.from_contest, contest_id=args.contest_id)
                elif getattr(args, "contest_id", None):
                    raise ValueError("--contest-id goes with --from-contest.")
                if args.print_only:
                    print(text if text is not None
                          else contest_node.node_template_text(), end="")
                    for note in notes:
                        print(f"  note: {note}", file=sys.stderr)
                else:
                    written = contest_node.init_node_config(
                        args.config, force=args.force, text=text)
                    print(f"  ✓ Wrote a starter node config to {written}"
                          + (f" (filled from {args.from_contest})"
                             if text is not None else ""))
                    for note in notes:
                        print(f"    • {note}")
                    print("    Next: replace every <...> value still there"
                          + ("" if text is not None else
                             " (the contest's values are in `contest "
                             "prepare`'s <out>/local/manifest.json — or "
                             "re-run with --from-contest <out>)")
                          + ", then check it with `mt-eval node ledger verify"
                          + (f" --config {written}" if args.config else "")
                          + "` — it names the first value still wrong.")
            elif args.node_command == "serve":
                contest_node.serve(getattr(args, "config", None),
                                   once=getattr(args, "once", False))
            elif args.node_command == "list":
                if getattr(args, "offline", False):
                    from mt_eval_harness.airgap_transport import list_offline
                    list_offline(getattr(args, "config", None),
                                 contest_id=getattr(args, "contest", None))
                else:
                    contest_node.list_queue(
                        getattr(args, "config", None),
                        contest_id=getattr(args, "contest", None))
            elif args.node_command == "approve":
                if getattr(args, "offline", False):
                    from mt_eval_harness.airgap_transport import decide_offline
                    decide_offline(args.request_id, decision="approve",
                                   actor=args.actor,
                                   config_path=getattr(args, "config", None))
                else:
                    contest_node.approve(
                        args.request_id, actor=args.actor,
                        config_path=getattr(args, "config", None))
            elif args.node_command == "deny":
                if getattr(args, "offline", False):
                    from mt_eval_harness.airgap_transport import decide_offline
                    decide_offline(args.request_id, decision="deny",
                                   actor=args.actor, reason=args.reason,
                                   config_path=getattr(args, "config", None))
                else:
                    contest_node.deny(
                        args.request_id, actor=args.actor,
                        reason=args.reason,
                        config_path=getattr(args, "config", None))
            elif args.node_command == "run-method":
                if getattr(args, "offline", False):
                    from mt_eval_harness.airgap_transport import run_imported
                    run_imported(args.request_id,
                                 config_path=getattr(args, "config", None),
                                 share_paths=getattr(args, "shares", None),
                                 assert_airgap=(True if getattr(
                                     args, "assert_airgap", False) else None))
                else:
                    if getattr(args, "shares", None):
                        print("  ✗ --share is the OFFLINE threshold lane "
                              "(custodian shares are presented at the "
                              "air-gapped node) — add --offline.",
                              file=sys.stderr)
                        sys.exit(1)
                    from mt_eval_harness.sandbox_runner import (
                        run_method_request,
                    )
                    run_method_request(
                        args.request_id,
                        config_path=getattr(args, "config", None))
            elif args.node_command == "import-bundle":
                from mt_eval_harness.airgap_transport import import_bundle
                import_bundle(args.exchange_dir,
                              config_path=getattr(args, "config", None))
            elif args.node_command == "export-scores":
                from mt_eval_harness.airgap_transport import export_scores
                export_scores(args.exchange_dir,
                              config_path=getattr(args, "config", None))
            elif args.node_command == "relay":
                from mt_eval_harness.airgap_transport import relay
                relay(args.exchange_dir,
                      config_path=getattr(args, "config", None))
            elif args.node_command == "stage-request":
                from mt_eval_harness.airgap_transport import stage_request
                stage_request(
                    args.bundle, contest_id=args.contest,
                    requested_by=args.requested_by, exchange_dir=args.out,
                    corpus_version=args.corpus_version,
                    secret_set_id=getattr(args, "secret_set", None),
                    request_id=getattr(args, "request_id", None),
                    config_path=getattr(args, "config", None))
            elif args.node_command == "ceremony":
                from mt_eval_harness.sovereign import ceremony as cer
                cmd = getattr(args, "ceremony_command", None)
                if cmd == "init":
                    cer.init_ceremony(
                        args.dir, sealed_set_id=args.set_id,
                        custodian_group_id=args.group, m=args.m, n=args.n,
                        custodians=getattr(args, "custodians", None))
                elif cmd == "share":
                    if getattr(args, "wipe_originals", False):
                        cer.wipe_share_originals(args.dir)
                    else:
                        cer.emit_share(
                            args.dir,
                            custodian=getattr(args, "custodian", None),
                            dest=getattr(args, "dest", None),
                            qr=getattr(args, "qr", False),
                            allow_all_shares=getattr(args, "all_shares",
                                                     False))
                elif cmd == "verify":
                    result = cer.verify_ceremony(args.dir, args.shares)
                    if not result["ok"]:
                        sys.exit(1)
                elif cmd == "restore":
                    if not getattr(args, "ack_assemble", False):
                        print(
                            "  ✗ refusing: `ceremony restore` assembles the "
                            "REAL set key in this process's memory and is NOT "
                            "ledger-logged (unlike a sealed run). Re-run with "
                            "--i-understand-this-assembles-the-key, and only "
                            "during a ceremony sitting. To open a sealed set "
                            "for evaluation, use `run-method --offline "
                            "--share …` (quorum-gated, logged).")
                        sys.exit(1)
                    print("  ⚠ assembling the set key in memory (standalone "
                          "drill, unlogged) …")
                    buf = cer.restore_key(
                        args.shares,
                        expected_key_id=getattr(args, "expect_key_id", None))
                    key_len = len(buf)
                    mem = ("locked" if buf.locked
                           else "UNLOCKED (mlock unavailable)")
                    buf.close()
                    print(f"  ✅ quorum restore drill: {len(args.shares)} "
                          f"share(s) reconstructed the {key_len}-byte set "
                          f"key in {mem} memory; commitment check passed; "
                          f"the key was zeroed. Nothing was persisted — a "
                          f"real run does this inside the executor "
                          f"(run-method --offline --share …).")
                else:
                    print("Usage: mt-eval node ceremony "
                          "{init,share,verify,restore}")
            elif args.node_command == "seal":
                from mt_eval_harness.sovereign.threshold_seal import (
                    seal_corpus_to_artifact,
                )
                seal_corpus_to_artifact(
                    args.corpus, args.pubkey, card_id=args.card_id,
                    custodian_group_id=args.group, out_dir=args.out_dir,
                    key_scheme=getattr(args, "key_scheme", None))
            elif args.node_command == "keygen":
                import json as _json

                from mt_eval_harness.sovereign.threshold_seal import (
                    SIGN_SCHEME,
                    generate_signing_keypair,
                )
                pair = generate_signing_keypair()
                out = Path(args.out).expanduser()
                out.mkdir(parents=True, exist_ok=True)
                note = (f"{SIGN_SCHEME}: a SINGLE Ed25519 node signing key. "
                        f"It authenticates one scoring node's exported "
                        f"score manifests; it is NOT M-of-N steward "
                        f"custody.")
                pub = out / f"score-sign-{pair['keyId']}.pub.json"
                priv = out / f"score-sign-{pair['keyId']}.key.json"
                pub.write_text(_json.dumps({
                    "keyId": pair["keyId"], "keyScheme": SIGN_SCHEME,
                    "publicKeyDerB64": pair["publicKeyDerB64"],
                    "_note": note}, indent=2) + "\n", encoding="utf-8")
                priv.write_text(_json.dumps({
                    "keyId": pair["keyId"], "keyScheme": SIGN_SCHEME,
                    "privateKeyDerB64": pair["privateKeyDerB64"],
                    "_note": note + " Keep this file on the AIRGAPPED node "
                                    "only."}, indent=2) + "\n",
                    encoding="utf-8")
                priv.chmod(0o600)
                print(f"  Key id:      {pair['keyId']}")
                print(f"  Scheme:      {SIGN_SCHEME}")
                print(f"  Public key:  {pub}  (publish this)")
                print(f"  Private key: {priv}  (mode 600 — airgapped node "
                      f"only)")
            elif args.node_command == "sign-manifest":
                from mt_eval_harness.sovereign.score_manifest import (
                    sign_manifest_file,
                )
                sign_manifest_file(args.payload, args.privkey,
                                   sig_out=getattr(args, "sig_out", None))
            elif args.node_command == "verdicts":
                from mt_eval_harness.contest_verdicts import run_node_verdicts
                run_node_verdicts(
                    args.contest, config_path=args.config, out=args.out,
                    signing_key=args.signing_key, metric=args.metric,
                    tie_test=args.tie_test, alpha=args.alpha,
                    n_resamples=args.n_resamples, seed=args.seed)
            elif args.node_command == "verify-manifest":
                from mt_eval_harness.sovereign.score_manifest import (
                    verify_manifest_file,
                )
                sig = getattr(args, "sig", None) or (args.payload
                                                     + ".sig.json")
                report = verify_manifest_file(args.payload, sig, args.pubkey)
                if not report["ok"]:
                    sys.exit(1)
            elif args.node_command == "bundle":
                from mt_eval_harness.sovereign.airgap_ops import (
                    build_offline_bundle,
                    verify_bundle,
                )
                if getattr(args, "verify", None):
                    report = verify_bundle(args.verify)
                    if not report["ok"]:
                        sys.exit(1)
                elif getattr(args, "out", None):
                    build_offline_bundle(args.out,
                                         include=tuple(args.include or ()),
                                         wheel=getattr(args, "wheel", None))
                else:
                    print("Usage: mt-eval node bundle --out DIR "
                          "[--include PATH …]   (online machine)\n"
                          "       mt-eval node bundle --verify DIR"
                          "            (on the node)")
            elif args.node_command == "manifest":
                from mt_eval_harness.sovereign.airgap_ops import (
                    verify_drive_manifest,
                    write_drive_manifest,
                )
                if args.manifest_action == "write":
                    if not getattr(args, "direction", None):
                        print("  ✗ --direction in|out is required for "
                              "write.", file=sys.stderr)
                        sys.exit(1)
                    node_id = "unconfigured-node"
                    try:
                        from mt_eval_harness.contest_node import (
                            load_node_config,
                        )
                        node_id = load_node_config(
                            getattr(args, "config", None))["node_id"]
                    except Exception:
                        pass  # a drive manifest is still evidence unconfigured
                    write_drive_manifest(args.drive_dir,
                                         direction=args.direction,
                                         node_id=node_id,
                                         note=getattr(args, "note", None))
                else:
                    report = verify_drive_manifest(args.drive_dir)
                    if not report["ok"]:
                        sys.exit(1)
            elif args.node_command == "ledger":
                from mt_eval_harness.sovereign.local_ledger import LocalLedger
                path = getattr(args, "path", None)
                cfg = None
                if not path or getattr(args, "config", None):
                    from mt_eval_harness.contest_node import load_node_config
                    cfg = load_node_config(getattr(args, "config", None))
                if not path:
                    path = (Path((cfg.get("airgap") or {}).get(
                        "state_dir",
                        Path.home() / ".mt-eval" / "airgap")).expanduser()
                        / "authorization-ledger.jsonl")
                ledger = LocalLedger(path)
                if args.ledger_action == "head":
                    print(ledger.head())
                else:
                    # `verify` is the documented check of a filled-in
                    # node.json: say what was checked, not only the chain
                    # (synthetic researcher persona, Round 2: it printed
                    # "chain verifies: 0 entries" and nothing else).
                    if cfg is not None:
                        from mt_eval_harness.contest_node import (
                            check_node_config,
                        )
                        checked = check_node_config(cfg)
                        where = getattr(args, "config", None) or \
                            "~/.mt-eval/node.json"
                        print(f"  ✅ config {where} loads and every declared "
                              f"file is present:")
                        for line in checked:
                            print(f"     {line}")
                    else:
                        print("  (config not checked: --path names a ledger "
                              "file directly; add --config to check one)")
                    report = ledger.verify_chain()
                    if report["ok"]:
                        print(f"  ✅ chain verifies: {report['entries']} "
                              f"entr{'y' if report['entries'] == 1 else 'ies'}"
                              f", head {ledger.head()[:16]}…")
                    else:
                        print(f"  ✗ CHAIN BROKEN at entry "
                              f"{report['first_bad']}: {report['reason']}")
                        sys.exit(1)
            elif args.node_command == "egress-check":
                import json as _json

                from mt_eval_harness.sovereign.airgap_ops import egress_check
                report = egress_check()
                if getattr(args, "as_json", False):
                    print(_json.dumps(report, indent=2))
                else:
                    verdict = ("✅ no route out detected"
                               if report["airgapped"]
                               else "✗ NOT air-gapped")
                    print(f"  {verdict}  (route: {report['default_route']}, "
                          f"probes: "
                          f"{sum(p['connected'] for p in report['probes'])}"
                          f"/{len(report['probes'])} connected, DNS: "
                          f"{report['dns_resolved']})")
                    print(f"  {report['honest_note']}")
                if not report["airgapped"]:
                    sys.exit(1)
            else:
                print("Usage: mt-eval node {init,serve,list,approve,deny,"
                      "run-method,import-bundle,export-scores,relay,\n"
                      "                     stage-request,ceremony,seal,"
                      "keygen,sign-manifest,verify-manifest,bundle,"
                      "manifest,egress-check,ledger}")
                print("Run 'mt-eval node --help' for details.")
        except KeyboardInterrupt:
            print("\n  Node stopped.")
        except (ValueError, RuntimeError, FileNotFoundError) as exc:
            print(f"\n  ✗ {exc}", file=sys.stderr)
            sys.exit(1)
        return

    if args.command == "logout":
        from mt_eval_harness.auth import logout
        logout()
        return

    if args.command == "setup":
        from mt_eval_harness.setup_wizard import run_setup
        run_setup(
            install_all=getattr(args, "all", False),
            comet_only=getattr(args, "comet", False),
            fst_only=getattr(args, "fst", False),
            lang_code=getattr(args, "lang", None),
            status_only=getattr(args, "status", False),
            non_interactive=bool(getattr(args, "non_interactive", False)
                                 or getattr(args, "json", False)),
        )
        return

    if args.command == "compare":
        from mt_eval_harness.compare import run_compare
        run_compare(
            args.log_paths,
            args.output,
            significance=getattr(args, "significance", False),
            n_bootstrap=getattr(args, "n_bootstrap", 1000),
            show_text=getattr(args, "show_text", False),
            method=getattr(args, "method", None) or "approximate_randomization",
        )
        return

    if args.command == "dashboard":
        if getattr(args, "watch", False):
            # Watch mode — poll directory and regenerate on changes
            from mt_eval_harness.watch import watch
            # For watch mode, use first path as directory
            watch(args.log_paths[0], args.output, args.interval)
            return

        from mt_eval_harness.dashboard import load_reports, generate
        # A malformed/truncated report passed to the one-shot dashboard used to
        # dump a raw JSONDecodeError traceback. Fail cleanly like test/card.
        # (Watch mode keeps its own skip-and-continue resilience.)
        import json as _json
        try:
            reports = load_reports(args.log_paths)
        except _json.JSONDecodeError as e:
            print(
                f"  ✗ Not a valid JSON report: {e.msg} at line {e.lineno}",
                file=sys.stderr,
            )
            sys.exit(1)
        if not reports:
            print("No report files found.")
            sys.exit(1)
        out = generate(reports, args.output)
        print(f"  Dashboard written to: {out}")
        print(f"  Open in browser: file://{os.path.abspath(out)}")
        return

    if args.command in ("export", "generate-plugin"):
        cmd_export(args)
        return

    if args.command == "export-config":
        from mt_eval_harness.config_exporter import cmd_export_config
        cmd_export_config(args)
        return

    # Default: run

    # --- Guided interactive dataset selection ---
    # When a human runs `mt-eval run` (or bare `mt-eval`) with no corpus on a
    # real terminal, walk them through pair → corpus → contamination
    # attestation → (gated terms/token). This NEVER triggers in a
    # non-TTY / CI / piped / --json / --non-interactive context (see
    # should_run_guided), so agents and scripts never hang waiting for input.
    if args.command in ("run", None):
        from mt_eval_harness.interactive import should_run_guided, run_guided
        if should_run_guided(args):
            if not run_guided(args):
                sys.exit(0)

    # args_to_config validates a few flags eagerly (e.g. an unknown --method
    # name that is neither a registered MT system nor a plugin directory). A
    # ValueError here is an expected user error, so render it as a clean
    # one-liner (and valid JSON under --json) rather than a raw traceback.
    try:
        config = args_to_config(args)
    except ValueError as exc:
        if getattr(args, "json", False):
            import json as _json
            print(_json.dumps({
                "error": "bad-args",
                "message": str(exc),
            }, ensure_ascii=False))
        else:
            print(f"\n  ✗ {exc}", file=sys.stderr)
        sys.exit(1)

    # Tool-calling needs a ToolProvider registered programmatically
    # (mt_eval_harness.plugins.tools.ToolProvider); nothing ships one in
    # plain CLI runs, so fail here with instructions instead of a
    # ValueError traceback deep in strategy resolution.
    if getattr(config, "tools_enabled", False) and args.command == "run":
        sys.exit(
            "  --tools requires a ToolProvider plugin registered via the "
            "programmatic API\n  (execute_run(..., tool_provider=...)); the "
            "CLI ships none yet. Use --method\n  <plugin-dir> for method "
            "plugins, or run without --tools."
        )

    if not config.corpus_path and not (config.source_file and config.reference_file):
        if getattr(args, "json", False):
            import json as _json
            print(_json.dumps({
                "error": "no-corpus",
                "message": (
                    "--corpus or (--source-file + --reference-file) is "
                    "required. Discover corpora with: mt-eval corpora "
                    "--source <code> --target <code> --json"
                ),
            }))
            sys.exit(2)
        print("ERROR: --corpus or (--source-file + --reference-file) is required.")
        print("  Usage: mt-eval run --corpus <id|path>                       (JSON/JSONL/TSV)")
        print("         mt-eval run --source-file <src> --reference-file <ref> (parallel text)")
        print("  Tip:   run `mt-eval run` with no corpus on a terminal for a guided picker,")
        print("         or `mt-eval corpora --source <code> --target <code>` to list options.")
        sys.exit(1)

    # Run logs, reports and the translation cache never land in the folder
    # `contest prepare` marked releasable (Round 13: a baseline on the
    # released dev set wrote them into public/results/, shipped with it).
    from mt_eval_harness.release_folder import refusal as _release_refusal
    for _flag, _dir in (("--output-dir", config.output_dir),
                        ("--cache-dir", config.cache_dir
                         if config.cache_enabled else None)):
        _why = _release_refusal(_dir, flag=_flag) if _dir else None
        if _why:
            if getattr(args, "json", False):
                import json as _json
                print(_json.dumps({"error": "releasable-folder",
                                   "message": _why}, ensure_ascii=False))
            else:
                print(f"\n  ✗ {_why}", file=sys.stderr)
            sys.exit(2)

    # Non-commercial terms gate: an NC (CC-BY-NC / -NC-SA) corpus needs an
    # explicit acknowledgment (guided prompt, inline prompt, or --accept-nc-terms)
    # before it runs. Positive-NC-only, so permissive runs are unaffected.
    if args.command in ("run", None):
        _enforce_nc_terms_gate(args, config)

    # The retired champollion-config lane is refused in RunConfig.validate()
    # (above); no prompt provider is registered here any more.
    prompt_providers = None

    # --- Multi-model support ---
    # Detect comma-separated models and fan out to execute_multi_run()
    # so each model gets its own aiohttp session and rate-limit semaphore.
    #
    # Under --json, the human-readable output (banner, progress, run card,
    # publish prompt) is redirected into a buffer so the ONLY thing on stdout
    # is the single JSON summary line emitted after the run. The redirect wraps
    # just the run; the error handlers below print their JSON to the real
    # stdout (it's already restored by the time they run).
    json_mode = getattr(args, "json", False)
    _human = io.StringIO()
    _silence = contextlib.redirect_stdout(_human) if json_mode else contextlib.nullcontext()
    try:
        with _silence:
            model_str = config.model
            if "," in model_str:
                from mt_eval_harness.runner import execute_multi_run
                from dataclasses import replace

                model_slugs = [m.strip() for m in model_str.split(",") if m.strip()]
                configs = []
                is_plugin = bool(config.method_path) and not config.mt_method
                from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
                engine_takes_model = bool(config.mt_method) and getattr(
                    MT_METHOD_REGISTRY.get(config.mt_method), "takes_model",
                    False)
                for slug in model_slugs:
                    if engine_takes_model:
                        # One engine run per model (`--method local-model
                        # -m a,b`): each run is handed its own model, as
                        # given — a Hugging Face id or a directory, never an
                        # LLM shortcut. All of "a,b" used to reach each run.
                        configs.append(replace(config, model=slug,
                                               method_model=slug))
                        continue
                    if is_plugin:
                        # One plugin run per model handed to it — in the
                        # plugin's own naming, exactly as given.
                        configs.append(replace(config, model=slug,
                                               method_model=slug))
                        continue
                    # Exact slugs only (founder ruling 2026-10-05): every
                    # model is checked BEFORE any run starts, so one retired
                    # alias or floating id never leaves the others half-spent.
                    # (An MT engine that runs its own model says -m is unused.)
                    refusal = None if config.mt_method else exact_model_refusal(
                        slug, openrouter=config.provider == "openrouter")
                    if refusal:
                        print(f"  ERROR: {refusal}")
                        sys.exit(1)
                    configs.append(replace(config, model=slug))

                print(f"\n  Multi-model run: {len(configs)} models")
                for c in configs:
                    print(f"    • {c.model} → {c.model_id}")

                run_logs = asyncio.run(
                    execute_multi_run(configs, prompt_providers=prompt_providers))
                multi = True
            else:
                from mt_eval_harness.runner import execute_run
                run_logs = [asyncio.run(
                    execute_run(config, prompt_providers=prompt_providers))]
                multi = False
        # stdout is restored here — emit the machine-readable summary (a no-op
        # unless --json was passed).
        _emit_run_json_summary(args, run_logs, multi=multi)

    except (RuntimeError, ValueError, MethodLoadError) as exc:
        # Clean exit for expected failures: auth errors (401/402/403),
        # missing corpora/builders, invalid model IDs, and a malformed method
        # plugin (MethodLoadError) — which would otherwise escape as a raw
        # traceback and break JSON consumers under --json.
        # No traceback — just the error message and a hint.
        sys.stdout.flush()
        if json_mode:
            import json as _json
            # Preserve the typed gated-download kind when present, so an agent
            # can branch on no-token vs gated-terms vs network.
            print(_json.dumps({
                "error": getattr(exc, "kind", "run-failed"),
                "message": str(exc),
            }, ensure_ascii=False))
            sys.exit(1)
        print(f"\n  ✗ {exc}")
        sys.exit(1)
    except SystemExit:
        # A pre-flight gate inside the run aborted (bad field names, no matching
        # --ids, unresolved target_lang, unknown model). Under --json the human
        # message was redirected into the buffer; surface it as a JSON error so
        # an agent sees why instead of a silent non-zero exit.
        if json_mode:
            import json as _json
            errs = [ln.strip() for ln in _human.getvalue().splitlines()
                    if "ERROR" in ln or "❌" in ln]
            print(_json.dumps({
                "error": "run-aborted",
                "message": " ".join(errs) or "run aborted before completion.",
            }, ensure_ascii=False))
        raise
    except KeyboardInterrupt:
        print("\n  Cancelled.")
        sys.exit(130)


if __name__ == "__main__":
    main()


def generate_plugin():
    """Standalone entry point for the 'generate-plugin' command.

    Injects 'generate-plugin' as the subcommand so users can invoke
    this as a bare shell command: `generate-plugin --report ...`
    instead of `mt-eval generate-plugin --report ...`.
    """
    sys.argv = ["mt-eval", "generate-plugin"] + sys.argv[1:]
    main()
