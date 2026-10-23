"""The shipped examples load: an example nobody runs rots silently.

`examples/method_plugin_passthrough` carried `"class": "example"`, which is
not a method class, so `mt-eval run --method examples/method_plugin_passthrough`
refused with MethodLoadError — the wiring example for the plugin interface
did not wire (found 2026-10-10).
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace

from mt_eval_harness.method_loader import load_method

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"


def test_the_passthrough_example_loads_and_translates():
    method = load_method(str(EXAMPLES / "method_plugin_passthrough"))
    card = method.method_card()
    assert card["class"] == "custom-plugin"
    out = asyncio.run(method.translate(
        [{"id": "1", "source": "a wug sings"}],
        config=SimpleNamespace(source_field="source")))
    assert out[0]["predicted"] == "a wug sings"
