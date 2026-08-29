"""
SSOT guard: the harness's standalone model-alias fallback must EXACTLY mirror
shared/model-aliases.json.

shared/model-aliases.json is the single source of truth for the convenience
model aliases shared by BOTH tools (the CLI reads it in cli/lib/models.js; the
harness in config._load_model_aliases). For a standalone `pip install` with no
monorepo `shared/` dir, config.py falls back to a HARDCODED copy of those
aliases. That hand-maintained mirror drifts silently the moment someone edits
the shared file and forgets the fallback — and then a pip-installed harness
resolves an alias differently than the monorepo and the CLI (an interop break,
and a fail-honest violation: the harness would quietly map `gemini-pro` to a
stale slug). This test makes that drift a hard failure.

A previous superset fallback (17 invented entries) silently diverged and
shipped slugs the SSOT never declared — exactly the regression this pins.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness import config


def _shared_aliases() -> dict[str, str] | None:
    """Read shared/model-aliases.json (the SSOT), stripping non-alias keys.

    Returns None when the file isn't present (a standalone checkout without the
    monorepo `shared/` dir) — the drift test is meaningless there and skips.
    """
    here = Path(config.__file__).resolve()
    for ancestor in [here, *here.parents]:
        candidate = ancestor / "shared" / "model-aliases.json"
        if candidate.is_file():
            data = json.loads(candidate.read_text(encoding="utf-8"))
            return {k: v for k, v in data.items() if not k.startswith("_")}
    return None


def test_standalone_fallback_mirrors_shared_ssot(monkeypatch, tmp_path):
    """config.py's hardcoded fallback == shared/model-aliases.json, exactly."""
    src = _shared_aliases()
    if src is None:
        pytest.skip("shared/model-aliases.json not present (standalone checkout)")

    # Force the standalone fallback branch: point the package dir at a location
    # with no `shared/` ancestor, so the walk-up finds nothing and returns the
    # hardcoded dict.
    monkeypatch.setattr(config, "_PACKAGE_DIR", tmp_path)
    fallback = config._load_model_aliases()

    assert fallback == src, (
        "The standalone model-alias fallback in config._load_model_aliases has "
        "DRIFTED from shared/model-aliases.json (the SSOT). A pip-installed "
        "harness would resolve aliases differently than the CLI/monorepo. "
        "Update the fallback dict to match the shared file exactly.\n"
        f"  fallback: {fallback}\n  shared:   {src}"
    )


def test_monorepo_loads_aliases_from_shared_file():
    """In the monorepo, aliases come from the shared file (not the fallback)."""
    src = _shared_aliases()
    if src is None:
        pytest.skip("shared/model-aliases.json not present")
    assert config._load_model_aliases() == src
