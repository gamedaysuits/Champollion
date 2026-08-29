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
    MODEL_REGISTRY,
    format_registry_table,
    load_method_card,
)
from mt_eval_harness.method_loader import MethodLoadError


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
    import json

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
        epilog=(
            "SUBCOMMANDS:\n"
            "  run              Execute a translation run (default)\n"
            "  queue            Run the top of the community compute queue\n"
            "  test             Analyze a completed run log\n"
            "  publish          Submit a TestReport to the leaderboard\n"
            "  compare          Compare multiple run logs\n"
            "  dashboard        Generate interactive HTML dashboard\n"
            "  list             List available models, prompts, datasets\n"
            "  corpora          List eval corpora for a language pair (X→Y)\n"
            "  recommend        Method guidance for a pair — availability + cited evidence\n"
            "  setup            Install optional dependencies (COMET, FST)\n"
            "  export           Package a TestReport as a champollion method plugin\n"
            "  export-config    Generate a champollion.config.json snippet from a TestReport\n"
            "  generate-plugin  Alias for 'export'\n"
            "  card               Pretty-print a human-readable run card\n"
            "  contest          Manage evaluation contests (prepare, register, create,\n"
            "                   submit, submit-hypotheses, status, list)\n"
            "  node             Organizer scoring node: serve, list, approve, deny\n"
            "  shared-task      Multi-pair edition umbrella: create, list\n"
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
    card_p.add_argument("log_paths", nargs="+", help="Run log JSON file(s) to render")

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
        "--skip-fst",
        action="store_true",
        help="Skip FST quality gate. Runs eval without morphological validation "
             "even if an FST is available for the target language. Use in CI or "
             "when FST install is not possible.",
    )

    # --- COMPARE command ---
    cmp_p = sub.add_parser(
        "compare", help="Compare multiple run logs",
        parents=[global_parser],
    )
    cmp_p.add_argument("log_paths", nargs="+", help="Paths to RunLog JSON files")
    cmp_p.add_argument(
        "-o", "--output",
        help="Output path for comparison report",
    )
    cmp_p.add_argument(
        "--significance",
        action="store_true",
        help="Run paired significance tests between runs "
             "(approximate randomization, matching SacreBLEU's default)",
    )
    cmp_p.add_argument(
        "--n-bootstrap",
        type=int,
        default=1000,
        help="Number of resampling iterations (AR trials / bootstrap resamples) "
             "for significance testing. Default: 1000",
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

    # --- CORPORA command ---
    # "What corpora exist for pair X→Y?" — queryable, structured, and shared
    # with the guided run selector. Friendly for humans (table) and agents
    # (--json), and never interactive.
    corpora_p = sub.add_parser(
        "corpora",
        help="List eval corpora available for a language pair (X→Y)",
        description=(
            "List the eval corpora available for a source→target language "
            "pair, with size, contamination risk, domain, license, gated "
            "status, and provider. Use --json for machine-readable output."
        ),
    )
    corpora_p.add_argument(
        "--source", "--source-code", dest="source",
        help="ISO 639-3 source language code (e.g. 'eng').",
    )
    corpora_p.add_argument(
        "--target", "--target-code", dest="target",
        help="ISO 639-3 target language code (e.g. 'tel').",
    )
    corpora_p.add_argument(
        "--list-sources",
        action="store_true",
        help="List the source languages that have runnable corpora and exit.",
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
    recommend_p.add_argument(
        "source", help="ISO 639-3 source language code (e.g. 'eng').",
    )
    recommend_p.add_argument(
        "target", help="ISO 639-3 target language code (e.g. 'yor').",
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
        help="If the coaching/system prompt embeds source+reference pairs of "
             "a restricted (NC / held-out / quarantined) corpus, publish with "
             "the prompt text replaced by a marker instead of refusing. The "
             "prompt's sha256 provenance is kept; the full text stays in the "
             "local RunLog.",
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
        help="Manage evaluation contests (create, submit, list)",
    )
    contest_sub = contest_p.add_subparsers(
        dest="contest_command",
        help="Contest subcommand",
    )

    # contest create
    cc = contest_sub.add_parser("create", help="Create a new evaluation contest")
    cc.add_argument("--name", required=True, help="Contest name (e.g. 'EN→CRK Open')")
    cc.add_argument(
        "--corpus", required=True,
        help="Corpus file or dataset ID to evaluate against",
    )
    cc.add_argument(
        "--language-pair", required=True,
        help="Language pair (e.g. 'en>crk', 'es>que')",
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

    # contest prepare — the organizer's one command: split, seal, register
    cp = contest_sub.add_parser(
        "prepare",
        help="Split a master corpus into T0 public qualifier / T1 blind test / "
             "optional T2 fully-secret, seal the secret parts at rest, and "
             "register the contest — champollion.dev/docs/network/sovereignty/"
             "run-a-sovereign-contest",
    )
    cp.add_argument("--corpus", required=True,
                    help="Master corpus file (harness JSON/JSONL/TSV). Stays local.")
    cp.add_argument("--slug", required=True,
                    help="Short contest slug used in corpus/qualifier ids")
    cp.add_argument("--name", required=True, help="Human-readable contest name")
    cp.add_argument("--pair", required=True,
                    help="ISO 639-3 pair, e.g. 'eng>crk'")
    cp.add_argument("--dev-size", type=int, required=True,
                    help="Entries in the public dev set (the qualifier)")
    cp.add_argument("--blind-size", type=int, required=True,
                    help="Entries in the blind test set (source released, refs withheld)")
    cp.add_argument("--secret-size", type=int, default=0,
                    help="Entries in the optional T2 fully-secret set (default 0)")
    cp.add_argument("--seed", type=int, required=True,
                    help="Split seed — REQUIRED so the split is deterministic and auditable")
    cp.add_argument("--qualifier-threshold", type=float, required=True,
                    help="Composite score (0-100) a submission must clear on the "
                         "dev set before the blind set is scored. REQUIRED — "
                         "thresholds are contest data, never a code default.")
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
    cp.add_argument("--license", default="CC-BY-4.0",
                    help="License for the RELEASED files (dev set + blind source)")
    cp.add_argument("--year", type=int,
                    help="Qualifier vintage year (default: current year)")
    cp.add_argument("--out", required=True,
                    help="Output dir (public/ = releasable, local/ = organizer-only)")
    cp.add_argument("--visibility", choices=["public", "private", "team"],
                    default="public")
    cp.add_argument("--use-context", choices=["commercial", "non-commercial"],
                    default="non-commercial")
    cp.add_argument("--description", default="")
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
                    default="public")
    cr.add_argument("--use-context", choices=["commercial", "non-commercial"],
                    default="non-commercial")
    cr.add_argument("--description", default="")
    cr.add_argument("--closed-intake", action="store_true",
                    help="Register with intake_open=false (open it later)")

    # contest submit
    cs = contest_sub.add_parser("submit", help="Submit a run to a contest")
    cs.add_argument(
        "--contest", required=True,
        help="Contest slug (e.g. 'en-crk-open-2026')",
    )
    cs.add_argument(
        "--run", required=True,
        help="Path to TestReport JSON or a run_card_id",
    )
    cs.add_argument("--team", help="Team attribution")
    cs.add_argument("--notes", default="", help="Submission notes")

    # contest submit-hypotheses — the participant front door
    csh = contest_sub.add_parser(
        "submit-hypotheses",
        help="Submit your system's translations to an organizer-scored "
             "contest: local dev self-score → qualifier verdict → upload",
    )
    csh.add_argument("contest_id", help="Contest slug")
    csh.add_argument("--test", required=True,
                     help="Your hypotheses for the BLIND test source "
                          "(one per line, or id-keyed JSON)")
    csh.add_argument("--dev", required=True,
                     help="Your hypotheses for the PUBLIC dev set (the "
                          "qualifier evidence)")
    csh.add_argument("--dev-corpus", required=True,
                     help="The released public dev corpus file (source+refs) "
                          "— used for the instant local self-score")
    csh.add_argument("--system", required=True,
                     help="Your system's name (participant-claimed, shown on "
                          "the run card)")
    csh.add_argument("--method-class", required=True,
                     choices=["raw-llm", "coached-llm", "pipeline",
                              "custom-plugin", "api", "human"],
                     help="Claimed method class (method-card vocabulary)")
    csh.add_argument("--paradigm",
                     choices=["rule-based", "statistical", "neural-nmt",
                              "llm", "hybrid", "human", "unknown"],
                     help="Claimed paradigm (default: unknown)")
    csh.add_argument("--description", default="",
                     help="One-line system description")
    csh.add_argument("--team", help="Team attribution")
    csh.add_argument("--notes", default="", help="Submission notes")

    # contest submit-method — the T2 method-execution lane (Phase B)
    csm = contest_sub.add_parser(
        "submit-method",
        help="Propose a RUNNABLE method bundle for execution against a "
             "contest's fully-secret set (T2): static pre-flight → "
             "deterministic tarball → authorization request "
             "(sandbox-evaluation-spec §2; gated on a published T1 record)",
    )
    csm.add_argument("contest_id", help="Contest slug")
    csm.add_argument("--method-dir", required=True,
                     help="Directory with your method's code/weights/config "
                          "(packed as method/ in the bundle)")
    csm.add_argument("--dockerfile", required=True,
                     help="Dockerfile that builds WITHOUT network access "
                          "(all dependencies vendored — spec §3.3)")
    csm.add_argument("--name", required=True, help="Method name")
    csm.add_argument("--version", required=True, help="Method version")
    csm.add_argument("--entrypoint", required=True,
                     help="Entry point inside the bundle, e.g. "
                          "method/translate.py (stdin sources → stdout "
                          "translations, spec §2.2)")
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
                          "(arena/legal/method-submission-agreement.md)")
    csm.add_argument("--node-id", required=True,
                     help="The ORGANIZER-ADVERTISED scoring node id — the "
                          "request fingerprint binds your method to it")
    csm.add_argument("--corpus-version", default="v1",
                     help="Sealed corpus version (organizer-advertised; "
                          "default v1)")
    csm.add_argument("--secret-set",
                     help="Sealed set id (auto-resolved from the contest "
                          "when unambiguous; required with --offline)")
    csm.add_argument("--pair",
                     help="Language pair like 'eng>crk' (only for --offline; "
                          "online it comes from the contest)")
    csm.add_argument("--bundle-out",
                     help="Also write a sneakernet exchange dir for "
                          "true-airgap contests (mt-eval node import-bundle)")
    csm.add_argument("--offline", action="store_true",
                     help="No network at all: package + --bundle-out only")

    # contest submit-model — the DECLARATIVE-MODEL lane (Lane A, default)
    csmo = contest_sub.add_parser(
        "submit-model",
        help="Propose a DECLARATIVE neural-MT model (safetensors weights + "
             "declarative tokenizer + config) against a contest's secret set. "
             "No Dockerfile, no code: the organizer runs the weights in its "
             "own trusted engine, so the submission is validated code-free "
             "(model_runner.py). The safer, preferred lane for standard NMT.",
    )
    csmo.add_argument("contest_id", help="Contest slug")
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
    csmo.add_argument("--pair", help="Language pair like 'eng>crk' (--offline)")
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

    # contest method-status — poll a T2 proposal
    cms = contest_sub.add_parser(
        "method-status",
        help="Show a method proposal's authorization state + audit trail",
    )
    cms.add_argument("request_id", help="authreq-… id")

    # contest status — poll your submissions
    cst = contest_sub.add_parser(
        "status", help="Show submission lifecycle(s) for an intake id or a contest",
    )
    cst.add_argument("id", help="intake-… id or a contest slug")

    # contest list
    cl = contest_sub.add_parser("list", help="List active contests")
    cl.add_argument(
        "--status", choices=["open", "closed", "all"], default="open",
        help="Filter by status. Default: open",
    )
    cl.add_argument(
        "--language-pair",
        help="Filter by language pair (e.g. 'en>crk')",
    )

    # contest submissions (view submissions for a contest)
    csub = contest_sub.add_parser(
        "submissions", help="List submissions for a contest",
    )
    csub.add_argument("contest_id", help="Contest slug")

    # --- NODE command — the ORGANIZER'S self-hosted scoring node -----------
    node_p = sub.add_parser(
        "node",
        help="Organizer scoring node: poll intake, gate on the public "
             "qualifier, authorize per contest policy, score against "
             "organizer-held secret refs, publish scores-only — "
             "champollion.dev/docs/network/sovereignty/sovereign-eval-node",
    )
    node_sub = node_p.add_subparsers(dest="node_command", help="Node subcommand")

    ns = node_sub.add_parser("serve", help="Run the polling scoring daemon")
    ns.add_argument("--config", help="Node config path (default ~/.mt-eval/node.json)")
    ns.add_argument("--once", action="store_true",
                    help="One poll pass then exit (cron/test mode)")

    nl = node_sub.add_parser("list", help="Show the intake queue this node serves")
    nl.add_argument("--config", help="Node config path")
    nl.add_argument("--contest", help="Limit to one contest slug")

    na = node_sub.add_parser(
        "approve", help="Custodian: authorize a pending scoring request")
    na.add_argument("request_id", help="authreq-… id (see `mt-eval node list`)")
    na.add_argument("--actor", required=True,
                    help="Who is approving (recorded in the audit chain)")
    na.add_argument("--config", help="Node config path")

    nd = node_sub.add_parser(
        "deny", help="Custodian: deny a pending scoring request")
    nd.add_argument("request_id", help="authreq-… id")
    nd.add_argument("--actor", required=True,
                    help="Who is denying (recorded in the audit chain)")
    nd.add_argument("--reason", required=True,
                    help="Why (relayed to the participant; custodians may "
                         "still simply refuse — community control)")
    nd.add_argument("--config", help="Node config path")

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
                          "via `node export-scores`)")
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
        help="CONNECTED side of a true-airgap contest: export authorized "
             "method requests to the exchange dir, verify + publish "
             "returning signed score bundles")
    nr.add_argument("exchange_dir", help="The exchange medium's directory")
    nr.add_argument("--config", help="Node config path")

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
    ci.add_argument("--m", type=int, default=3, help="Quorum size (default 3)")
    ci.add_argument("--n", type=int, default=5, help="Share count (default 5)")
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

    nb = node_sub.add_parser(
        "bundle", help="Build the offline install bundle on an ONLINE "
                       "machine (wheels + pinned artifacts + sha256 "
                       "manifest), or --verify it on the node")
    nb.add_argument("--out", help="Bundle directory to build")
    nb.add_argument("--include", action="append", default=[],
                    help="Extra artifact file/dir to bundle (repeatable)")
    nb.add_argument("--verify", metavar="DIR",
                    help="Verify an existing bundle instead of building")

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
        "ledger", help="Inspect the node's hash-chained local authorization "
                       "ledger: verify replays the whole chain; head prints "
                       "the anchorable tip (the value signed into every "
                       "score manifest)")
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
        help="Register a shared-task edition (organizer; dev branch + "
             "service key), then attach each per-pair contest with "
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

    return parser


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
        help=f"Model short name, full OpenRouter ID, or comma-separated list "
             f"for parallel multi-model runs. Default: {DEFAULT_MODEL}. "
             f"Shortcuts: {', '.join(sorted(MODEL_REGISTRY.keys()))}. "
             f"With `--method local-model`, pass a Hugging Face id "
             f"(facebook/nllb-200-distilled-600M) or a CTranslate2 model "
             f"directory here to run it locally.",
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
             "— Ollama (default http://localhost:11434/v1), vLLM, LM Studio, "
             "Groq, Together — via --base-url / OPENAI_API_BASE.",
    )
    parser.add_argument(
        "--base-url",
        default=None,
        help="Override the provider's API endpoint (OpenAI-compatible base_url, "
             "e.g. http://localhost:11434/v1 for Ollama, "
             "https://api.groq.com/openai/v1 for Groq). Applies to --provider "
             "openai/local. Precedence: flag > OPENAI_API_BASE env > default.",
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
        help="Also compute the FUSE-style comparator (reported, NOT in the "
             "composite; an untrained reimplementation of the AmericasNLP-2025 "
             "FUSE approach). Needs the `fuse` extra: "
             "pip install 'mt-eval[fuse]'. Off by default — LaBSE is heavy.",
    )

    # MetricX-24 (opt-in; neural, lower-is-better, reported separately)
    parser.add_argument(
        "--metricx",
        action="store_true",
        help="Also compute MetricX-24 (Google, Apache-2.0) — the WMT24 Metrics "
             "shared-task winner and the metric WMT24++/TranslateGemma report "
             "against. A LOWER-IS-BETTER neural error metric (0–25), reported "
             "separately, NEVER in the composite. Needs the `metricx` extra "
             "(pip install 'mt-eval[metricx]' plus the model code: "
             "pip install git+https://github.com/google-research/metricx). "
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
        help="Path to coaching prompt text file. The full text is recorded "
             "in the run card for reproducibility, and the run's condition "
             "is labelled 'coached' unless --prompt is set explicitly.",
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
             "Enables writing style consistency metrics (informational, "
             "not in composite score). See docs for format.",
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
             "unregistered corpora publish scores only). Requires sign-in.",
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
    parser.add_argument(
        "--target-code",
        help="ISO target language code for MT systems (e.g. 'fr'). Overrides the "
             "code auto-detected from the corpus language_pair.",
    )

    # FST retry
    parser.add_argument(
        "--fst-retries",
        type=int,
        default=0,
        help="Number of times to retry translations that fail FST validation. "
             "Default: 0 (score-only, no retry). Works with the default LLM method "
             "only — custom method plugins handle their own retries.",
    )

    # Champollion config interop
    parser.add_argument(
        "--champollion-config",
        help="Path to champollion.config.json. Enables --prompt champollion "
             "with production-identical register, gender guidance, and promptContext.",
    )
    parser.add_argument(
        "--champollion-cards-dir",
        help="Path to language-cards directory (default: auto-detect from "
             "monorepo layout or node_modules/champollion/).",
    )
    parser.add_argument(
        "--target-lang-code",
        default="",
        help="BCP-47 language code for target language (e.g., 'fr', 'de', 'crk'). "
             "Required when using --champollion-config.",
    )
    parser.add_argument(
        "--skip-fst",
        action="store_true",
        help="Skip FST quality gate. Runs eval without morphological validation "
             "even if an FST is available for the target language.",
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
        auto_publish=getattr(args, "publish", False),
        method_path=_method_path,
        mt_method=_mt_method,
        source_code=getattr(args, "source_code", "") or "",
        target_code=getattr(args, "target_code", "") or "",
        champollion_config_path=args.champollion_config if hasattr(args, "champollion_config") else None,
        champollion_cards_dir=args.champollion_cards_dir if hasattr(args, "champollion_cards_dir") else None,
        target_lang_code=args.target_lang_code if hasattr(args, "target_lang_code") else "",
        contamination_attestation=attestation,
        nc_terms_acknowledgment=nc_acknowledgment,
    )


def cmd_list(what: str, live: bool = False):
    """Handle the 'list' subcommand."""
    if what == "models":
        print("\nAvailable models (registry shortcuts):")
        for short, full in sorted(MODEL_REGISTRY.items()):
            default = " (default)" if short == DEFAULT_MODEL else ""
            print(f"  {short:25s} → {full}{default}")
        print("\n  You can also pass any full OpenRouter model ID directly.")

        if live:
            cmd_list_live()

    elif what == "prompts":
        print("\nPrompt options:")
        print("  naive    Minimal translation instruction (default)")
        print("  custom   Load from a .txt file (DEPRECATED — use --coaching-file)")
        print("  champollion  Production-identical prompt from champollion.config.json")
        print("           (requires --champollion-config and --target-lang-code)")
        print("\n  Coaching prompts (recommended):")
        print("    --coaching-file path.txt   Load coaching prompt from file")
        print("    --coaching 'text'          Inline coaching text (short prompts)")
        print("\n  The full coaching text is recorded in the run card for reproducibility,")
        print("  and the run's condition is labelled 'coached' automatically (override")
        print("  with an explicit --prompt).")

    elif what == "datasets":
        print(format_registry_table())


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

    source = getattr(args, "source", None)
    target = getattr(args, "target", None)

    # Partial input → guide the caller (and stay machine-readable in --json).
    if source and not target:
        targets = corpora_browse.available_targets_for_source(source)
        if want_json:
            print(_json.dumps(
                {"source": source, "targets": targets}, ensure_ascii=False))
        else:
            print(f"\n  Targets available from {corpora_browse.lang_name(source)}"
                  f" ({len(targets)}):")
            print("  " + (", ".join(targets) if targets else "(none)"))
            print("\n  Then: mt-eval corpora --source "
                  f"{source} --target <code>\n")
        return 0

    if not source or not target:
        msg = ("mt-eval corpora needs --source and --target ISO codes "
               "(e.g. --source eng --target tel), or --list-sources.")
        if want_json:
            print(_json.dumps({"error": "missing-args", "message": msg}))
        else:
            print(f"  {msg}", file=sys.stderr)
        return 2

    infos = corpora_browse.list_corpora_for_pair(source, target)
    if want_json:
        print(_json.dumps({
            "source": source,
            "target": target,
            "count": len(infos),
            "corpora": corpora_browse.corpora_to_json(infos),
        }, ensure_ascii=False, indent=2))
    else:
        print(corpora_browse.format_corpora_table(infos, source, target))
    return 0


def cmd_list_live():
    """Fetch and display live model catalog from OpenRouter.

    Queries the OpenRouter /api/v1/models endpoint and displays
    all available models with their pricing. Requires an API key
    (via OPENROUTER_API_KEY env var or .env file).
    """
    import asyncio

    try:
        import aiohttp
    except ImportError:
        print("\n  aiohttp is required for live model listing.")
        print("  Install: pip install aiohttp")
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

def _prompt_publish(report_path) -> None:
    """Offer to publish a report to the arena leaderboard.

    Only prompts in interactive mode (TTY stdin). In non-interactive
    environments (piped stdin, CI), silently skips with a hint.
    """
    report_path = Path(report_path)
    if not report_path.exists():
        return

    if not sys.stdin.isatty():
        # Non-interactive — just print the command for reference
        print(f"  → To publish: mt-eval publish {report_path.name} --prod")
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
            print(f"  ✗ Publish failed: {e}")
            print(f"  → Retry with: mt-eval publish {report_path.name} --prod")


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


def main():
    """CLI entry point."""
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "list":
        try:
            cmd_list(args.what, live=getattr(args, "live", False))
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
        payload = recommend(
            args.source, args.target, use_context=args.use_context,
        )
        if args.json:
            print(_json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            print(render_text(payload))
        return

    if args.command == "card":
        from mt_eval_harness.run_card import render_run_card
        for filepath in args.log_paths:
            path = Path(filepath)
            # Passing the report file instead of the run log used to silently
            # produce no output (a bare `continue` + exit 0). Auto-resolve the
            # sibling run log when it exists; otherwise print a clear hint
            # rather than exiting silently.
            if path.name.endswith("_report.json"):
                sibling = path.with_name(
                    path.name[: -len("_report.json")] + ".json"
                )
                if sibling.exists():
                    path = sibling
                else:
                    print(
                        f"  ✗ '{filepath}' is a report file, not a run log. "
                        f"Pass the run log (e.g. '{sibling.name}') instead.",
                        file=sys.stderr,
                    )
                    continue
            if not path.exists():
                print(f"  ✗ File not found: {filepath}", file=sys.stderr)
                continue
            # Validate the run log is parseable before rendering, so a
            # truncated/partial file fails with a one-line error, not a raw
            # JSONDecodeError traceback.
            load_runlog(path)
            print(render_run_card(path))
        return

    if args.command == "test":
        from mt_eval_harness.tester import run_test
        from mt_eval_harness.plugin_discovery import discover_metric_plugins

        # Load the run log to detect target language for plugin auto-discovery.
        # load_runlog fails cleanly (one line + exit 1) on a missing/truncated
        # file instead of dumping a raw JSONDecodeError traceback.
        log_path = Path(args.log_path)
        log_data = load_runlog(log_path)
        metric_plugins = discover_metric_plugins(
            log_data.get("config", {}),
            skip_fst=getattr(args, "skip_fst", False),
            method_dir=log_data.get("config", {}).get("method_path"),
        )

        run_test(
            args.log_path,
            args.output,
            metric_plugins=metric_plugins or None,
            compute_ci=not getattr(args, "no_ci", False),
            n_bootstrap_ci=getattr(args, "n_bootstrap_ci", 1000),
        )

        # Auto-print the run card after scoring
        report_path = log_path.with_name(log_path.stem + "_report.json")
        try:
            from mt_eval_harness.run_card import render_run_card
            print(render_run_card(log_path, report_path))
        except Exception as e:
            logger.warning("Failed to render run card: %s", e)

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
            create_contest, submit_to_contest,
            list_contests, list_submissions,
            resolve_run_card_id,
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
                create_contest(
                    name=args.name,
                    corpus_id=args.corpus,
                    language_pair=args.language_pair,  # --language-pair is required (no hardcoded default)
                    visibility=args.visibility,
                    teams=teams,
                    description=getattr(args, "description", ""),
                    use_context=getattr(args, "use_context", "non-commercial"),
                )
            elif args.contest_command == "prepare":
                from mt_eval_harness.contest_prep import (
                    prepare_contest, register_prepared,
                )
                src, sep, tgt = args.pair.partition(">")
                if not sep or not src or not tgt:
                    raise ValueError(
                        f"--pair must look like 'eng>crk' (got {args.pair!r})")
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
                    seed=args.seed,
                    qualifier_threshold=args.qualifier_threshold,
                    authorization_model=authorization_model,
                    intake_daily_limit=intake_daily_limit,
                    shared_task_id=args.shared_task,
                    custodian_group_id=getattr(args, "custodian_group", None),
                    threshold_pubkey=getattr(args, "threshold_pubkey", None),
                    plaintext_refs=args.plaintext_refs,
                    license_id=args.license,
                    year=args.year,
                    out_dir=args.out,
                )
                print(f"\n  Prepared contest artifacts under {args.out}")
                print(f"    public/  → release these (dev+refs, blind source)")
                print(f"    local/   → NEVER leaves this machine "
                      f"(sealed refs, manifest)")
                print(f"    Qualifier: {manifest['qualifier']['qualifier_id']} "
                      f"@ {manifest['qualifier']['threshold']}")
                if args.no_register:
                    print("\n  --no-register: nothing was written to Supabase. "
                          "Re-run without it (dev branch + "
                          "MT_EVAL_SUPABASE_SERVICE_KEY) to register the "
                          "qualifier, sealed set(s), and contest — or "
                          "register with your own sign-in, no service key: "
                          "mt-eval contest register --manifest "
                          f"{manifest['manifest_path']}")
                elif args.self_serve:
                    from mt_eval_harness.contest_prep import (
                        register_prepared_self_serve,
                    )
                    register_prepared_self_serve(
                        manifest,
                        visibility=args.visibility,
                        use_context=args.use_context,
                        description=args.description,
                        open_intake=not args.closed_intake,
                    )
                else:
                    register_prepared(
                        manifest,
                        visibility=args.visibility,
                        use_context=args.use_context,
                        description=args.description,
                        open_intake=not args.closed_intake,
                    )
            elif args.contest_command == "register":
                import json
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
                register_prepared_self_serve(
                    manifest,
                    visibility=args.visibility,
                    use_context=args.use_context,
                    description=getattr(args, "description", ""),
                    open_intake=not args.closed_intake,
                )
            elif args.contest_command == "submit":
                run_card_id = resolve_run_card_id(args.run)
                submit_to_contest(
                    contest_id=args.contest,
                    run_card_id=run_card_id,
                    team=getattr(args, "team", None),
                    notes=getattr(args, "notes", ""),
                )
            elif args.contest_command == "submit-hypotheses":
                from mt_eval_harness.contest_intake import submit_hypotheses
                submit_hypotheses(
                    contest_id=args.contest_id,
                    test_hyp_path=args.test,
                    dev_hyp_path=args.dev,
                    dev_corpus_path=args.dev_corpus,
                    system_label=args.system,
                    method_class=args.method_class,
                    paradigm=getattr(args, "paradigm", None),
                    description=getattr(args, "description", ""),
                    team=getattr(args, "team", None),
                    notes=getattr(args, "notes", ""),
                )
            elif args.contest_command == "submit-method":
                from mt_eval_harness.method_bundle import submit_method
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
                    corpus_version=args.corpus_version,
                    secret_set_id=getattr(args, "secret_set", None),
                    language_pair=getattr(args, "pair", None),
                    bundle_out=getattr(args, "bundle_out", None),
                    offline=args.offline,
                )
            elif args.contest_command == "submit-model":
                from mt_eval_harness.model_bundle import submit_model
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
            else:
                # No subcommand — show usage
                print("Usage: mt-eval contest {prepare,create,submit,"
                      "submit-hypotheses,status,list,submissions}")
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
            else:
                print("Usage: mt-eval shared-task {create,list}")
                print("Run 'mt-eval shared-task --help' for details.")
        except (ValueError, RuntimeError) as exc:
            print(f"\n  ✗ {exc}", file=sys.stderr)
            sys.exit(1)
        return

    if args.command == "node":
        from mt_eval_harness import contest_node
        try:
            if args.node_command == "serve":
                contest_node.serve(getattr(args, "config", None),
                                   once=getattr(args, "once", False))
            elif args.node_command == "list":
                contest_node.list_queue(getattr(args, "config", None),
                                        contest_id=getattr(args, "contest", None))
            elif args.node_command == "approve":
                contest_node.approve(args.request_id, actor=args.actor,
                                     config_path=getattr(args, "config", None))
            elif args.node_command == "deny":
                contest_node.deny(args.request_id, actor=args.actor,
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
                                         include=tuple(args.include or ()))
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
                if not path:
                    from mt_eval_harness.contest_node import load_node_config
                    cfg = load_node_config(getattr(args, "config", None))
                    path = (Path((cfg.get("airgap") or {}).get(
                        "state_dir",
                        Path.home() / ".mt-eval" / "airgap")).expanduser()
                        / "authorization-ledger.jsonl")
                ledger = LocalLedger(path)
                if args.ledger_action == "head":
                    print(ledger.head())
                else:
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
                print("Usage: mt-eval node {serve,list,approve,deny,"
                      "run-method,import-bundle,export-scores,relay,\n"
                      "                     ceremony,seal,keygen,"
                      "sign-manifest,verify-manifest,bundle,manifest,"
                      "egress-check}")
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
        )
        return

    if args.command == "compare":
        from mt_eval_harness.compare import run_compare
        run_compare(
            args.log_paths,
            args.output,
            significance=getattr(args, "significance", False),
            n_bootstrap=getattr(args, "n_bootstrap", 1000),
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

    # Non-commercial terms gate: an NC (CC-BY-NC / -NC-SA) corpus needs an
    # explicit acknowledgment (guided prompt, inline prompt, or --accept-nc-terms)
    # before it runs. Positive-NC-only, so permissive runs are unaffected.
    if args.command in ("run", None):
        _enforce_nc_terms_gate(args, config)

    # Auto-set --prompt champollion when --champollion-config is provided
    # and no explicit --prompt was given by the user.
    if config.champollion_config_path and config.prompt_version == "naive":
        config.prompt_version = "champollion"

    # --- "Test What You Ship" mode ---
    # When --champollion-config is provided, import ALL production config
    # as defaults (model, temperature, batchSize, coaching). Explicit CLI
    # flags still override. This ensures eval uses the same settings as
    # production unless the user says otherwise.
    if config.champollion_config_path and config.target_lang_code:
        from mt_eval_harness.champollion_config import load_champollion_config
        rc = load_champollion_config(
            config.champollion_config_path,
            config.target_lang_code,
            cards_dir=config.champollion_cards_dir,
        )

        imported_fields = []

        # Import model if user didn't explicitly set --model
        # (argparse default is DEFAULT_MODEL)
        if config.model == DEFAULT_MODEL and rc.model:
            config.model = rc.model
            imported_fields.append(f"model={rc.model}")

        # Import temperature if user didn't explicitly set --temperature
        # (argparse default is 0.0 for deterministic scoring)
        if config.temperature == 0.0 and rc.temperature is not None:
            config.temperature = rc.temperature
            imported_fields.append(f"temperature={rc.temperature}")
        elif rc.temperature is not None and rc.temperature != config.temperature:
            # User explicitly set a different temperature — warn about divergence
            print(
                f"  ℹ Production temperature={rc.temperature}, "
                f"harness using temperature={config.temperature}. "
                f"Pass --temperature {rc.temperature} for production-identical output."
            )

        # Import batch_size if user didn't explicitly set --batch-size
        if config.batch_size == DEFAULT_BATCH_SIZE and rc.batch_size:
            config.batch_size = rc.batch_size
            imported_fields.append(f"batchSize={rc.batch_size}")

        # Import coaching prompt if user didn't provide one
        if not config.coaching_file and rc.coaching_prompt:
            config.coaching_file = rc.coaching_file
            imported_fields.append("coachingFile")

        if imported_fields:
            print(f"  ℹ Imported from champollion.config.json: {', '.join(imported_fields)}")

    # Register the ChampollionPromptProvider when champollion config is active
    prompt_providers = None
    if config.champollion_config_path:
        from mt_eval_harness.plugins.champollion_prompts import ChampollionPromptProvider
        prompt_providers = [ChampollionPromptProvider()]

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
                from mt_eval_harness.config import MODEL_REGISTRY, fuzzy_resolve_model
                from dataclasses import replace

                model_slugs = [m.strip() for m in model_str.split(",") if m.strip()]
                configs = []
                for slug in model_slugs:
                    # Resolve short names through the registry, then fuzzy match
                    resolved = MODEL_REGISTRY.get(slug, slug)
                    if "/" not in resolved and slug not in MODEL_REGISTRY:
                        fuzzy = fuzzy_resolve_model(slug)
                        if fuzzy:
                            print(f"  ℹ Resolved '{slug}' → '{fuzzy}' (fuzzy match)")
                            resolved = fuzzy
                        else:
                            print(f"  ERROR: Unknown model '{slug}'. "
                                  f"Available shortcuts: {', '.join(sorted(MODEL_REGISTRY.keys()))}. "
                                  f"Or pass a full OpenRouter model ID (e.g. 'anthropic/claude-sonnet-4').")
                            sys.exit(1)
                    model_config = replace(config, model=resolved)
                    configs.append(model_config)

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
