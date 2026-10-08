"""
Loader for the shared metric-identity registry SSOT (shared/metric-registry.json).

This is the single source of truth for METRIC IDENTITY — the mapping from each
canonical metric id (the run-card scores key) to its Python MetricPlugin name,
its language-card evalMetrics key, and its denormalized run_cards DB column.

Mirrors ``method_manifest`` exactly: walk up from this package to find the
monorepo ``shared/`` directory. There is NO embedded standalone fallback — the
manifest is purely a dev/CI SSOT-drift guard (consumed by
tests/test_metric_registry_ssot.py). A standalone pip install simply has no
manifest to check against, and callers treat a missing manifest as "skip the
check", never as an error. The runtime (scoring.py, publish.py) does NOT
hard-depend on this file.
"""

from __future__ import annotations

import json
from pathlib import Path

_PACKAGE_DIR = Path(__file__).resolve().parent


def metric_manifest_path() -> Path | None:
    """Return the path to shared/metric-registry.json, or None if not found.

    Walks up from this package looking for the monorepo ``shared/`` dir.
    Returns None in a standalone install where ``shared/`` isn't present.
    """
    check = _PACKAGE_DIR
    for _ in range(6):
        candidate = check / "shared" / "metric-registry.json"
        if candidate.exists():
            return candidate
        check = check.parent
    return None


def load_metric_manifest() -> dict | None:
    """Load and return the parsed manifest dict, or None if not found.

    Raises ValueError if the file exists but is malformed (fail loud — a
    corrupt SSOT must never silently pass the parity guard).
    """
    path = metric_manifest_path()
    if path is None:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed metric-registry SSOT at {path}: {exc}") from exc


def metric_entries() -> dict[str, dict]:
    """Return the manifest's entries dict, or {} if the manifest isn't found."""
    manifest = load_metric_manifest()
    if not manifest:
        return {}
    return dict(manifest.get("entries", {}))


def metric_ids() -> set[str]:
    """Return the set of canonical metric ids declared in the manifest."""
    return set(metric_entries().keys())


def by_plugin_name() -> dict[str, str]:
    """Map each declared plugin_name -> its canonical metric id.

    Only entries that name a plugin are included. A plugin that computes more
    than one canonical metric (e.g. giellalt_fst_validity → fst_acceptance_rate
    AND morphological_accuracy) appears once per metric here is impossible (dict
    keyed by plugin name), so the LAST such metric wins; callers that need the
    full set should iterate metric_entries() instead. Used only by the parity
    test's informational cross-check.
    """
    out: dict[str, str] = {}
    for metric_id, entry in metric_entries().items():
        pn = entry.get("plugin_name")
        if pn:
            out[pn] = metric_id
    return out


def db_columns() -> set[str]:
    """Return the set of non-null db_column values declared in the manifest."""
    return {
        e["db_column"]
        for e in metric_entries().values()
        if e.get("db_column")
    }
