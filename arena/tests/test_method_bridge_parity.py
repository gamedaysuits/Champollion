"""Cross-runtime parity guard for the method-plugin loaders.

cli/lib/bridge/method_bridge.py is a hand-synced reimplementation of
mt_eval_harness.method_loader — it inlines the loader so a CLI user need not pip
install the harness. The two are kept in step only by a comment. This test, with
its CLI-side twin (cli/test/method-bridge-parity.test.js), points BOTH loaders at
one shared fixture plugin (cli/test/fixtures/method-plugin-parity) and asserts
each loads it and runs a translate round-trip.

The fixture's method.json carries exactly the fields both loaders require (name,
entry_point). Adding a required field to only one loader's
_REQUIRED_MANIFEST_FIELDS makes that side fail to load the fixture while the
other still passes — surfacing the drift.

Skips cleanly in a standalone pip install where the monorepo cli/ tree isn't
present — the fixture is a monorepo dev/CI guard, not a runtime dependency.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from mt_eval_harness import method_loader


def _fixture_dir() -> Path | None:
    """Walk up from this test file to find the shared fixture plugin dir."""
    here = Path(__file__).resolve()
    for ancestor in here.parents:
        candidate = ancestor / "cli" / "test" / "fixtures" / "method-plugin-parity"
        if candidate.is_dir():
            return candidate
    return None


def _require_fixture() -> Path:
    fixture = _fixture_dir()
    if fixture is None:
        pytest.skip(
            "cli/test/fixtures/method-plugin-parity not present "
            "(standalone install without the monorepo cli/ tree)"
        )
    return fixture


class _StubConfig:
    """Minimal RunConfig stand-in: the harness reads source_field off config."""

    source_field = "source"


def test_harness_loader_loads_shared_fixture():
    """method_loader.load_method accepts the shared fixture plugin."""
    fixture = _require_fixture()
    method = method_loader.load_method(fixture)
    assert hasattr(method, "translate") and callable(method.translate)


def test_harness_loader_translate_round_trip():
    """The loaded fixture translates (passthrough) through the harness path."""
    fixture = _require_fixture()
    method = method_loader.load_method(fixture)
    entries = [{"id": 0, "source": "Hello"}, {"id": 1, "source": "Goodbye"}]
    results = asyncio.run(method.translate(entries, _StubConfig()))
    assert [r["id"] for r in results] == [0, 1]
    assert [r["predicted"] for r in results] == ["Hello", "Goodbye"]
