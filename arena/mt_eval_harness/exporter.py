"""
Plugin Exporter — Package a TestReport as an champollion method plugin.

Takes a completed TestReport JSON (from tester.py) and produces the
method.json + coaching/ directory structure that champollion expects.

Design decisions:
    - DATA ONLY — the output never contains Python code, harness config,
      API keys, or internal prompt templates. It is strictly configuration,
      coaching content, and benchmark results.
    - TestReport as input (not RunLog) — the TestReport has the computed
      metrics that the benchmarks block needs. The RunLog is raw results;
      the TestReport is the analyzed summary.
    - Coaching data is OPT-IN — user points to a coaching directory; the
      exporter copies it into the plugin bundle. The harness never generates
      coaching data — it only evaluates methods that use it.
    - Validates before write — runs the same structural checks champollion uses
      (required fields, valid types, kebab-case name) before writing.
    - ZERO DEPENDENCIES — uses only stdlib (json, pathlib, shutil, re).
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
    "microsoft-translator", "libretranslate", "openai", "anthropic", "gemini",
]

# Regex for kebab-case name validation (matches champollion's /^[a-z0-9][a-z0-9-]*$/)
KEBAB_CASE_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


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
    """Export a TestReport as a champollion method plugin.

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

    # --- Build the manifest ---
    manifest = _build_manifest(report, export_config)

    # --- Validate the manifest against champollion's contract ---
    errors = _validate_manifest(manifest)
    if errors:
        raise ValueError(
            f"Generated manifest would fail champollion validation:\n"
            + "\n".join(f"  - {e}" for e in errors)
        )

    # --- Write the plugin directory ---
    plugin_dir = Path(export_config.output_dir) / export_config.name
    plugin_dir.mkdir(parents=True, exist_ok=True)

    # Write method.json
    manifest_path = plugin_dir / "method.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Copy coaching data if provided
    coaching_bundled = False
    if export_config.coaching_dir:
        coaching_bundled = _copy_coaching_data(
            export_config.coaching_dir,
            plugin_dir,
            export_config.locales,
        )

    # --- Print summary ---
    _print_summary(manifest, plugin_dir, coaching_bundled, report_path)

    return plugin_dir


# ---------------------------------------------------------------------------
# Manifest construction
# ---------------------------------------------------------------------------

def _build_manifest(report: dict, config: ExportConfig) -> dict:
    """Build the method.json manifest from a TestReport and ExportConfig.

    Maps harness-internal field names to champollion's expected schema.
    """
    report_config = report.get("config", {})
    overall = report.get("overall", {})

    # --- Config block — canonical MethodConfig shape ---
    # All fields are always present. Unused values are null.
    # This shape is identical across: champollion.config.json, method.json,
    # leaderboard publish, leaderboard install, and export-config output.
    method_config: dict[str, Any] = {
        "model": report_config.get("model", ""),
        "temperature": report_config.get("temperature") if report_config.get("temperature") is not None else None,
        "batchSize": report_config.get("batch_size") if report_config.get("batch_size") else None,
        "register": config.register or None,
        "coachingFile": report_config.get("coaching_file", None),
        "coachingPrompt": None,  # Resolved at runtime from coachingFile — not stored
        "promptContext": None,  # Resolved from champollion config at runtime
        "qualityTier": None,  # Set after scoring
    }

    # --- Benchmarks block (per-locale metrics from the test analysis) ---
    benchmarks = {}
    for locale in config.locales:
        benchmark_entry: dict[str, Any] = {
            "date": report_config.get("timestamp_start", datetime.now(timezone.utc).isoformat()),
            "corpus_size": overall.get("total_entries", 0),
            "exact_match_rate": overall.get("exact_match_rate", 0.0),
            "model": report_config.get("model", ""),
            "harness_version": __version__,
        }

        # Standard metrics — include if present
        if "corpus_chrf" in overall:
            benchmark_entry["corpus_chrf"] = overall["corpus_chrf"]
        if "corpus_bleu" in overall:
            benchmark_entry["corpus_bleu"] = overall["corpus_bleu"]

        # Plugin metrics — include ALL available metrics from the harness.
        # Champollion ignores unknown fields, but they're useful for display
        # in `champollion status` and for future champollion metric support.
        plugin_metrics = overall.get("plugin_metrics", {})
        for plugin_name, plugin_data in plugin_metrics.items():
            if isinstance(plugin_data, dict):
                for metric_key, metric_value in plugin_data.items():
                    # Prefix with plugin name to avoid collisions
                    # e.g., "morphology.avg_validity_rate"
                    qualified_key = f"{plugin_name}.{metric_key}"
                    benchmark_entry[qualified_key] = metric_value

        benchmarks[locale] = benchmark_entry

    # --- Provenance block ---
    provenance = _build_provenance(config)

    # --- Assemble the manifest ---
    manifest: dict[str, Any] = {
        "name": config.name,
        "type": config.method_type,
        "version": config.version,
        "description": config.description or f"Exported from mt-eval v{__version__}",
        "author": config.author,
        "config": method_config,
        "locales": config.locales,
        "benchmarks": benchmarks,
        "provenance": provenance,
    }

    # Only add coaching.dir if coaching data is being bundled
    if config.coaching_dir:
        manifest["coaching"] = {"dir": "coaching"}

    return manifest


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

def _copy_coaching_data(
    source_dir: str,
    plugin_dir: Path,
    locales: list[str],
) -> bool:
    """Copy coaching data files into the plugin bundle.

    Only copies files matching the declared locales (e.g., crk.json for
    locales=["crk"]). This prevents accidentally bundling coaching data
    for locales not covered by this plugin.

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
            shutil.copy2(locale_file, target / f"{locale}.json")
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


def _validate_manifest(manifest: dict) -> list[str]:
    """Validate a manifest against champollion's contract.

    Mirrors the checks in champollion's lib/plugins.js validateManifest().
    This ensures the exported plugin will pass champollion's validation
    without the harness needing to import champollion.
    """
    errors = []

    # Required fields
    for field_name in REQUIRED_MANIFEST_FIELDS:
        if not manifest.get(field_name):
            errors.append(f'Missing required field: "{field_name}"')

    # Valid type
    if manifest.get("type") and manifest["type"] not in VALID_METHOD_TYPES:
        errors.append(
            f'Invalid type "{manifest["type"]}" — '
            f"must be one of: {', '.join(VALID_METHOD_TYPES)}"
        )

    # Locales is an array
    if manifest.get("locales") and not isinstance(manifest["locales"], list):
        errors.append('"locales" must be an array of locale codes')

    # Name format (kebab-case)
    if manifest.get("name") and not KEBAB_CASE_RE.match(manifest["name"]):
        errors.append(
            f'Invalid name "{manifest["name"]}" — '
            'use kebab-case (e.g., "french-formal-v1")'
        )

    # API plugins must have an endpoint
    if manifest.get("type") == "api" and not manifest.get("endpoint"):
        errors.append('API plugins must include an "endpoint" URL')

    # Benchmarks validation
    if manifest.get("benchmarks") and not isinstance(manifest["benchmarks"], dict):
        errors.append('"benchmarks" must be an object keyed by locale code')

    return errors


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

    print(f"\n  Plugin:       {manifest['name']}")
    print(f"  Type:         {manifest['type']}")
    print(f"  Version:      {manifest['version']}")
    print(f"  Locales:      {', '.join(manifest['locales'])}")
    print(f"  Description:  {manifest.get('description', '')}")

    # Benchmark summary
    for locale, bench in manifest.get("benchmarks", {}).items():
        print(f"\n  [{locale}] Benchmarks:")
        print(f"    Corpus size:      {bench.get('corpus_size', '?')}")
        print(f"    Exact match:      {bench.get('exact_match_rate', 0):.1%}")
        if "corpus_chrf" in bench:
            print(f"    chrF++:           {bench['corpus_chrf']:.1f}")
        if "corpus_bleu" in bench:
            print(f"    BLEU:             {bench['corpus_bleu']:.1f}")

        # Show plugin metrics if present
        plugin_keys = [k for k in bench if "." in k]
        if plugin_keys:
            print(f"    Plugin metrics:")
            for pk in plugin_keys:
                val = bench[pk]
                if isinstance(val, float) and val <= 1.0:
                    print(f"      {pk}: {val:.4f}")
                else:
                    print(f"      {pk}: {val}")

    # Provenance
    prov = manifest.get("provenance", {})
    if prov.get("commercialReady"):
        print(f"\n  Commercial:   Yes (cleared for publishing)")
    else:
        print(f"\n  Commercial:   No (license-unclear — check with provider)")
    if prov.get("resources"):
        print(f"  Resources:    {len(prov['resources'])} declared")
    # Coaching
    if coaching_bundled:
        print(f"  Coaching:     Bundled in {plugin_dir / 'coaching'}")
    else:
        print(f"  Coaching:     None bundled")

    print(f"\n  Source:        {source_report}")
    print(f"  Output:        {plugin_dir}")

    # Install instructions
    print(f"\n  To install in a champollion project:")
    print(f"    cp -r {plugin_dir} <project>/.champollion/methods/")
    print(f"  Then reference in champollion.config.json:")
    print(f'    "methodPlugin": "{manifest["name"]}"')

    print("=" * 60)
