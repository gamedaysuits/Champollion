"""
Loader for the shared method/provider registry SSOT (shared/method-registry.json).

This is the single source of truth, shared with the JS CLI, for which
translation METHODS (MT engines) and LLM PROVIDERS exist and their declarative
metadata (env vars, method_class, paradigm, license, cost, locale maps).

Mirrors ``config._load_retired_model_aliases``: walk up from this package to find the
monorepo ``shared/`` directory. Unlike the retired-name table there is NO embedded
standalone fallback — the manifest is purely a dev/CI SSOT-drift guard
(consumed by the parity tests), and a standalone pip install simply has no
manifest to check against (callers treat a missing manifest as "skip the
parity check", never as an error). The runtime registries
(methods/registry.py, providers/registry.py) do NOT hard-depend on this file,
so standalone installs keep working.
"""

from __future__ import annotations

import json
from pathlib import Path

_PACKAGE_DIR = Path(__file__).resolve().parent


BUNDLED_MANIFEST = _PACKAGE_DIR / "data" / "method-registry.json"


def manifest_path() -> Path | None:
    """Return the path to the method registry, or None if not found.

    Walks up from this package looking for the monorepo ``shared/`` dir;
    in an installed wheel, falls back to the copy bundled at
    ``mt_eval_harness/data/method-registry.json`` (kept byte-identical by
    tests/test_bundled_shared.py). Without it, a pip install's ``mt-eval
    recommend`` listed no methods at all and run cards lost the provider's
    registry metadata.
    """
    check = _PACKAGE_DIR
    for _ in range(6):
        candidate = check / "shared" / "method-registry.json"
        if candidate.exists():
            return candidate
        check = check.parent
    return BUNDLED_MANIFEST if BUNDLED_MANIFEST.exists() else None


def load_method_manifest() -> dict | None:
    """Load and return the parsed manifest dict, or None if not found.

    Raises ValueError if the file exists but is malformed (fail loud — a
    corrupt SSOT must never silently pass the parity guard).
    """
    path = manifest_path()
    if path is None:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed method-registry SSOT at {path}: {exc}") from exc


def manifest_entries(kind: str | None = None) -> dict[str, dict]:
    """Return manifest entries, optionally filtered to one ``kind``.

    Returns {} if the manifest isn't found (standalone install).
    """
    manifest = load_method_manifest()
    if not manifest:
        return {}
    entries = manifest.get("entries", {})
    if kind is None:
        return dict(entries)
    return {name: e for name, e in entries.items() if e.get("kind") == kind}


def manifest_names(kind: str | None = None) -> set[str]:
    """Return the set of entry names, optionally filtered to one ``kind``."""
    return set(manifest_entries(kind).keys())
