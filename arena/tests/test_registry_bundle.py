"""Bundled-registry integrity guard (TA-01).

The wheel ships ``mt_eval_harness/data/registry.json`` — a copy of the
tracked SSOT ``arena/datasets/registry.json`` — as the offline fallback in
``config.load_registry`` (step 3). Both ``scripts/build_registry.py`` and
the ``setup.py`` build hooks write the SAME bytes; a divergent bundled copy
means an installed harness answers dataset queries from a stale registry.

The bundled copy is gitignored (generated), so a clean checkout legitimately
lacks it — that case skips instead of failing.
"""

from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
SSOT_REGISTRY = ARENA_ROOT / "datasets" / "registry.json"
BUNDLED_REGISTRY = ARENA_ROOT / "mt_eval_harness" / "data" / "registry.json"


def test_bundled_registry_matches_ssot():
    if not BUNDLED_REGISTRY.is_file():
        pytest.skip("bundled registry not built in this checkout")
    assert SSOT_REGISTRY.is_file(), (
        "arena/datasets/registry.json (the tracked SSOT) is missing while a "
        "bundled copy exists — this tree is inconsistent."
    )
    assert BUNDLED_REGISTRY.read_bytes() == SSOT_REGISTRY.read_bytes(), (
        "mt_eval_harness/data/registry.json diverges from the SSOT "
        "arena/datasets/registry.json. Regenerate it: "
        "python arena/scripts/build_registry.py"
    )
