"""
Plugin Exporter — Package a TestReport as a champollion method plugin.

Takes a completed TestReport JSON (from tester.py) and writes a method
folder the champollion CLI installs: ``method.json`` as method/1 (the one
method document every tool reads — ``shared/schemas/framework/
method.v1.schema.json``) with the run's measured chrF++ as evidence, plus
the coaching the method is sent.

Design decisions:
    - DATA ONLY — the output never contains Python code, harness config,
      API keys, or internal prompt templates. It is strictly configuration,
      coaching content, and measured evidence.
    - TestReport as input (not RunLog) — the TestReport has the computed
      metrics the evidence needs. The RunLog is raw results; the TestReport
      is the analyzed summary.
    - Coaching travels INSIDE the method folder. ``--coaching-dir`` bundles
      the folder of per-locale coaching (``coaching/<locale>.json``,
      method/1 ``coaching.dir``); a coached run's own coaching file is
      bundled as ``prompt/<name>`` (``coaching.file``) — a path on the
      exporting machine would not exist where the plugin is installed. Each
      file's steward sidecar is copied with it, so its holders' terms travel
      (the CLI refuses to send local-only coaching to a hosted model). The
      harness never generates coaching data — it only evaluates methods that
      use it.
    - Checked before anything is written — the document is read through the
      shared method reader (``framework.method``), the same verdict
      ``champollion validate`` gives.
    - ZERO DEPENDENCIES — uses only stdlib (json, pathlib, shutil, re).

Until 2026-10-10 this wrote the older CLI plugin manifest (read today as
method/0), whose bundled coaching folder the CLI never read and whose
coaching file was a path on the exporting machine.
"""

from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mt_eval_harness import __version__


# ---------------------------------------------------------------------------
# Constants — mirroring champollion's lib/plugins.js validation
# ---------------------------------------------------------------------------

# These mirror champollion's REQUIRED_FIELDS and VALID_TYPES in
# cli/lib/plugins.js. A plugin exported by the harness must validate under the
# CLI, so these MUST match the JS list exactly (a cross-language npm↔pip interop
# SSOT). Order kept identical to the JS for an easy diff. The match is guarded
# by tests/test_plugin_type_interop_ssot.py, which parses the JS and fails on
# drift (this list was previously stale — missing the 6 MT/provider types).

REQUIRED_MANIFEST_FIELDS = ["name", "type", "version", "locales"]

VALID_METHOD_TYPES = [
    "llm", "llm-coached", "api", "google-translate", "deepl",
    "microsoft-translator", "libretranslate", "openai", "anthropic", "gemini", "local",
]

# Regex for kebab-case name validation (matches champollion's /^[a-z0-9][a-z0-9-]*$/)
KEBAB_CASE_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")

METHOD_SCHEMA_ID = "https://champollion.dev/schemas/method/1.json"

#: --type → method/1 kind (and the field that names what it runs)
# a type that names its provider: "local" is a model on this computer, and the
# method ships through it (cli/lib/plugins.js reads provider local as type local)
_LLM_PROVIDERS = ("openai", "anthropic", "gemini", "local")
_MT_ENGINES = ("google-translate", "deepl", "microsoft-translator", "libretranslate")


# ---------------------------------------------------------------------------
# Export configuration
# ---------------------------------------------------------------------------

@dataclass
class ExportConfig:
    """Configuration for exporting a TestReport as a champollion method plugin.

    Required fields:
        name:        Plugin name in kebab-case (e.g., 'crk-coached-v1')
        method_type: One of champollion's valid types ('llm', 'llm-coached', etc.)
        locales:     List of target locale codes this method covers

    Optional fields with sensible defaults:
        version:          Semver version string
        description:      Human-readable description
        author:           Who developed/tested this method
        register:         Target language register/tone
        coaching_dir:     Path to coaching data to bundle into the plugin
        output_dir:       Where to write the plugin directory
        commercial_ready: Set True when the method's licensing has been
                          verified and the plugin is cleared for publishing.
                          Defaults to False (license-unclear).
        provenance_resources: Explicit licensing info for bundled resources
    """

    # --- Required ---
    name: str
    method_type: str
    locales: list[str]

    # --- Optional with defaults ---
    version: str = "1.0.0"
    description: str = ""
    author: str = ""
    register: str = ""
    coaching_dir: str | None = None
    output_dir: str = "."
    commercial_ready: bool = False

    # Provenance resources — list of dicts with 'name', 'license', 'type'
    # If empty, a safe default is generated based on method_type and coaching_dir
    provenance_resources: list[dict[str, str]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Core export logic
# ---------------------------------------------------------------------------

def export_plugin(
    report_path: str | Path,
    export_config: ExportConfig,
) -> Path:
    """Export a TestReport as a champollion method plugin (method/1).

    Args:
        report_path: Path to the TestReport JSON file (from tester.py).
        export_config: Configuration controlling the plugin output.

    Returns:
        Path to the created plugin directory.

    Raises:
        FileNotFoundError: If the report file doesn't exist.
        ValueError: If the export config or report data is invalid.
    """
    report_path = Path(report_path)
    if not report_path.exists():
        raise FileNotFoundError(f"TestReport not found: {report_path}")

    # --- Load and validate the report ---
    report = json.loads(report_path.read_text(encoding="utf-8"))
    _validate_report(report)
    if not KEBAB_CASE_RE.match(export_config.name or ""):
        raise ValueError(f'Invalid name "{export_config.name}" — use kebab-case '
                         '(e.g., "french-formal-v1")')
    if export_config.method_type not in VALID_METHOD_TYPES:
        raise ValueError(f'Invalid type "{export_config.method_type}" — must be one of: '
                         f"{', '.join(VALID_METHOD_TYPES)}")

    # --- What coaching travels with it (decided before anything is written) ---
    coaching_locales = _coaching_locales(export_config.coaching_dir, export_config.locales)
    prompt_src = _run_coaching_file(report, export_config)

    # --- Build the document, and check it as every tool will read it ---
    manifest = _build_manifest(
        report, export_config,
        coaching_dir="coaching" if coaching_locales else None,
        coaching_file=f"prompt/{prompt_src.name}" if prompt_src else None)
    errors = _check_method(manifest)
    if errors:
        raise ValueError(
            "The method.json would not be a valid method/1 document:\n"
            + "\n".join(f"  - {e}" for e in errors)
        )

    # --- Write the plugin directory ---
    plugin_dir = Path(export_config.output_dir) / export_config.name
    plugin_dir.mkdir(parents=True, exist_ok=True)

    coaching_bundled = False
    if coaching_locales:
        coaching_bundled = _copy_coaching_data(
            export_config.coaching_dir, plugin_dir, coaching_locales)
    if prompt_src:
        _copy_with_terms(prompt_src, plugin_dir / "prompt" / prompt_src.name)

    manifest_path = plugin_dir / "method.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # --- Print summary ---
    _print_summary(manifest, plugin_dir, coaching_bundled, report_path)

    return plugin_dir


# ---------------------------------------------------------------------------
# Manifest construction
# ---------------------------------------------------------------------------

def _run_codes(report: dict) -> tuple[str, str]:
    """(source, target) language codes the run recorded ('' when not)."""
    cfg = report.get("config", {}) or {}
    return (str(cfg.get("source_code") or ""),
            str(cfg.get("target_code") or cfg.get("target_lang_code") or ""))


def _evidence(report: dict) -> list[dict]:
    """The run's headline as method/1 evidence — numbers only: the dataset,
    the pair, chrF++ with its 95% CI, n, the date and the run id."""
    overall = report.get("overall", {}) or {}
    chrf = overall.get("corpus_chrf")
    if not isinstance(chrf, (int, float)):
        return []
    cfg = report.get("config", {}) or {}
    try:
        from mt_eval_harness.publish import _load_corpus_self_meta, _resolve_dataset_id
        dataset = _resolve_dataset_id(cfg, _load_corpus_self_meta(cfg))
    except Exception:          # no corpus file here: name it by the run's own record
        dataset = ""
    dataset = dataset or Path(str(cfg.get("corpus_path") or "")).stem or "unknown"
    item: dict[str, Any] = {"dataset": dataset, "metric": "chrF++", "score": chrf}
    source, target = _run_codes(report)
    if target:
        item["pair"] = {**({"source": source} if source else {}), "target": target}
    ci = (overall.get("confidence_intervals") or {}).get("corpus_chrf") or {}
    if isinstance(ci.get("ci_lower"), (int, float)) and isinstance(ci.get("ci_upper"), (int, float)):
        item["ci"] = [ci["ci_lower"], ci["ci_upper"]]
    if isinstance(overall.get("total_entries"), int):
        item["n"] = overall["total_entries"]
    if cfg.get("timestamp_start"):
        item["date"] = str(cfg["timestamp_start"])
    if report.get("run_id"):
        item["run"] = str(report["run_id"])
    gates = overall.get("gates")
    if isinstance(gates, dict) and gates.get("chain_id"):
        # the headline is of what the gates let through (founder, 2026-10-10)
        item["x-gated"] = {"chain": gates["chain_id"], "fingerprint": gates.get("fingerprint"),
                           "refusal_rate": gates.get("refusal_rate")}
    return [item]


def _build_manifest(report: dict, config: ExportConfig, *,
                    coaching_dir: str | None = None,
                    coaching_file: str | None = None) -> dict:
    """The method/1 document for a TestReport and ExportConfig.

    ``coaching_dir`` / ``coaching_file``: what :func:`export_plugin` bundles
    into the plugin folder (paths relative to it)."""
    report_config = report.get("config", {}) or {}
    overall = report.get("overall", {}) or {}
    mtype = config.method_type

    doc: dict[str, Any] = {"$schema": METHOD_SCHEMA_ID, "id": config.name, "name": config.name,
                           "version": config.version,
                           "description": config.description
                           or f"Exported from mt-eval v{__version__}"}
    if config.author:
        doc["author"] = config.author

    # --- How it runs ---
    if mtype in ("llm", "llm-coached") or mtype in _LLM_PROVIDERS:
        doc["kind"] = "llm-coached" if mtype == "llm-coached" else "llm"
        # who carried the text when it was measured, always: a method measured
        # on a local model must not ship through a hosted one because its
        # provider was left out (docs review 2026-10-12 — the CLI then used
        # OpenRouter by default)
        recorded = str(report_config.get("provider") or "").strip()
        if mtype in _LLM_PROVIDERS:
            doc["provider"] = mtype
        elif recorded and recorded not in ("method-plugin",):
            doc["provider"] = recorded
        if report_config.get("model"):
            doc["model"] = report_config["model"]
        decode: dict[str, Any] = {}
        if isinstance(report_config.get("temperature"), (int, float)):
            decode["temperature"] = report_config["temperature"]
        if isinstance(report_config.get("batch_size"), int) and report_config["batch_size"] > 0:
            decode["batch_size"] = report_config["batch_size"]
        if decode:
            doc["decode"] = decode
    elif mtype in _MT_ENGINES:
        doc["kind"], doc["engine"] = "mt-api", mtype
    else:   # "api": a server's method — its endpoint is not in a TestReport
        raise ValueError(
            'type "api" is a method reached through its server, and a TestReport does '
            "not know the server's address — `champollion serve --emit-manifest` writes "
            "that method.json (kind service)")
    if doc["kind"] == "llm-coached":
        coaching: dict[str, Any] = {}
        if coaching_file:
            coaching["file"] = coaching_file
        if coaching_dir:
            coaching["dir"] = coaching_dir
        if coaching:
            doc["coaching"] = coaching

    # --- What it translates, and what was measured ---
    source, _target = _run_codes(report)
    doc["pairs"] = [{**({"source": source} if source else {}), "target": loc}
                    for loc in config.locales]
    evidence = _evidence(report)
    if evidence:
        doc["evidence"] = evidence

    # --- Provenance and the card ---
    prov = _build_provenance(config)
    doc["provenance"] = {"resources": prov["resources"], "flags": prov["flags"]}
    doc["card"] = {"commercial_ready": prov["commercialReady"]}
    doc["written_by"] = f"mt-eval export (mt-eval-harness {__version__})"

    # Nothing the older manifest carried is lost: the run's method config
    # (register included) and every metric it reported, per locale.
    doc["x-method-config"] = {
        "model": report_config.get("model", ""),
        "temperature": report_config.get("temperature"),
        "batchSize": report_config.get("batch_size") or None,
        "register": config.register or None,
        "coachingFile": report_config.get("coaching_label") or report_config.get("coaching_file"),
    }
    benchmarks = {}
    for locale in config.locales:
        bench: dict[str, Any] = {
            "date": report_config.get("timestamp_start", datetime.now(timezone.utc).isoformat()),
            "corpus_size": overall.get("total_entries", 0),
            "exact_match_rate": overall.get("exact_match_rate", 0.0),
            "model": report_config.get("model", ""),
            "harness_version": __version__,
        }
        for key in ("corpus_chrf", "corpus_bleu"):
            if key in overall:
                bench[key] = overall[key]
        for plugin_name, plugin_data in (overall.get("plugin_metrics") or {}).items():
            if isinstance(plugin_data, dict):
                for metric_key, metric_value in plugin_data.items():
                    bench[f"{plugin_name}.{metric_key}"] = metric_value
        benchmarks[locale] = bench
    doc["x-benchmarks"] = benchmarks
    return doc


def _build_provenance(config: ExportConfig) -> dict:
    """Build the provenance block.

    Defaults to commercialReady=false with a 'license-unclear' flag.
    Plugins can bundle anything — coaching data, FST gate configs,
    decomposition pipelines — and the licensing status of those resources
    is not something the exporter can determine automatically.

    When commercial_ready is explicitly set to True, the flag is cleared.
    This signals that someone has verified the method's licensing and the
    plugin is cleared for publishing (to an API or as an installable plugin).
    """
    resources = config.provenance_resources or []

    # Default: license-unclear, not commercially ready.
    # Explicit opt-in: cleared for commercial use, no flags.
    if config.commercial_ready:
        return {
            "resources": resources,
            "commercialReady": True,
            "flags": [],
        }

    return {
        "resources": resources,
        "commercialReady": False,
        "flags": ["license-unclear"],
    }


# ---------------------------------------------------------------------------
# Coaching data handling
# ---------------------------------------------------------------------------

def _coaching_locales(source_dir: str | None, locales: list[str]) -> list[str]:
    """The declared locales whose coaching file is in ``source_dir`` (said
    for each one missing)."""
    if not source_dir:
        return []
    source = Path(source_dir)
    if not source.is_dir():
        print(f"  WARNING: Coaching directory not found: {source}")
        return []
    found = []
    for locale in locales:
        if (source / f"{locale}.json").is_file():
            found.append(locale)
        else:
            print(f"  WARNING: No coaching file for locale '{locale}' at {source / f'{locale}.json'}")
    if not found:
        print(f"  WARNING: No coaching files found for locales {locales}")
    return found


def _run_coaching_file(report: dict, config: ExportConfig) -> Path | None:
    """The coached run's own coaching file, when it is on this machine (it is
    bundled as prompt/<name>); said when it is not."""
    if config.method_type != "llm-coached":
        return None
    given = (report.get("config", {}) or {}).get("coaching_file")
    if not given:
        return None
    path = Path(str(given)).expanduser()
    if path.is_file():
        return path
    print(f"  WARNING: the run was coached with {given}, which is not on this machine — "
          "the plugin carries no coaching prompt (add one as coaching.file by hand)")
    return None


def _copy_with_terms(src: Path, dst: Path) -> None:
    """Copy a file and its steward sidecar (its holders' terms travel)."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    side = Path(str(src) + ".champollion.json")
    if side.is_file():
        shutil.copy2(side, Path(str(dst) + ".champollion.json"))


def _copy_coaching_data(
    source_dir: str,
    plugin_dir: Path,
    locales: list[str],
) -> bool:
    """Copy coaching data files into the plugin bundle.

    Only copies files matching the declared locales (e.g., crk.json for
    locales=["crk"]). This prevents accidentally bundling coaching data
    for locales not covered by this plugin. Each file's steward sidecar
    travels with it.

    Returns True if any coaching files were copied.
    """
    source = Path(source_dir)
    if not source.is_dir():
        print(f"  WARNING: Coaching directory not found: {source}")
        return False

    target = plugin_dir / "coaching"
    target.mkdir(parents=True, exist_ok=True)

    copied = 0
    for locale in locales:
        locale_file = source / f"{locale}.json"
        if locale_file.exists():
            _copy_with_terms(locale_file, target / f"{locale}.json")
            copied += 1
        else:
            print(f"  WARNING: No coaching file for locale '{locale}' at {locale_file}")

    if copied == 0:
        # Clean up the empty coaching directory
        target.rmdir()
        print(f"  WARNING: No coaching files found for locales {locales}")
        return False

    return True


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_report(report: dict) -> None:
    """Validate that the input is a TestReport (not a RunLog or other JSON).

    TestReports have an 'overall' key with computed metrics.
    RunLogs have a 'results' key with raw translations.
    """
    if "overall" not in report:
        if "results" in report:
            raise ValueError(
                "This looks like a RunLog, not a TestReport. "
                "Run 'mt-eval test <runlog>' first to generate a TestReport, "
                "then export the report."
            )
        raise ValueError(
            "Input JSON doesn't look like a TestReport — "
            "missing 'overall' key with computed metrics."
        )


def _check_method(doc: dict) -> list[str]:
    """Errors for the method/1 document, from the shared method reader — the
    verdict `champollion validate` gives the same file."""
    from mt_eval_harness.framework.method import read_method_document

    read = read_method_document(doc)
    if read["version"] != 1:
        return read["errors"] or ["not read as method/1"]
    return read["errors"]


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def _print_summary(
    manifest: dict,
    plugin_dir: Path,
    coaching_bundled: bool,
    source_report: Path,
) -> None:
    """Print a human-readable summary of the export."""
    print(f"\n{'=' * 60}")
    print("CHAMPOLLION PLUGIN EXPORT")
    print("=" * 60)

    print(f"\n  Plugin:       {manifest['id']}  (method/1, kind {manifest['kind']})")
    print(f"  Version:      {manifest.get('version', '')}")
    print(f"  Pairs:        {', '.join((p.get('source', '*') + '→' + p['target']) for p in manifest.get('pairs', []))}")
    print(f"  Description:  {manifest.get('description', '')}")

    for ev in manifest.get("evidence", []):
        ci = ev.get("ci")
        print(f"\n  Measured:     {ev['metric']} {ev['score']:.1f}"
              + (f" (95% CI {ci[0]:.1f}–{ci[1]:.1f})" if ci else "")
              + f" on {ev['dataset']}" + (f", n={ev['n']}" if "n" in ev else "")
              + (f" — gated by {ev['x-gated']['chain']}" if ev.get("x-gated") else ""))

    if manifest.get("card", {}).get("commercial_ready"):
        print("\n  Commercial:   Yes (cleared for publishing)")
    else:
        print("\n  Commercial:   No (license-unclear — check with provider)")
    if manifest.get("provenance", {}).get("resources"):
        print(f"  Resources:    {len(manifest['provenance']['resources'])} declared")
    coaching = manifest.get("coaching") or {}
    if coaching_bundled:
        print(f"  Coaching:     Bundled in {plugin_dir / 'coaching'} (used for its pairs)")
    if coaching.get("file"):
        print(f"  Coaching:     the run's prompt, bundled as {coaching['file']}")
    if not coaching:
        print("  Coaching:     None bundled")

    print(f"\n  Source:        {source_report}")
    print(f"  Output:        {plugin_dir}")

    print("\n  To install in a champollion project:")
    print(f"    npx champollion plugin install {plugin_dir}")
    print("  Then reference in champollion.config.json:")
    print(f'    "methodPlugin": "{manifest["id"]}"')

    print("=" * 60)
