"""
Cross-language interop SSOT guard: the harness's plugin-manifest validation
constants must match the CLI's.

A method plugin EXPORTED by the harness (exporter.py) is validated by the CLI
(cli/lib/plugins.js) when installed. If the harness's accepted `type` enum or
required-field list drifts from the CLI's, a plugin the CLI accepts is rejected
by the harness exporter (or vice versa) — a silent npm↔pip interop break. This
test parses the JS source and pins the Python constants to it.

(History: exporter.py's VALID_METHOD_TYPES was stale at 4 entries while the JS
had grown to 10 — the 6 MT/provider types deepl/microsoft-translator/
libretranslate/openai/anthropic/gemini were missing, so the harness could not
export those plugin types. This guard makes that class of drift loud.)
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from mt_eval_harness import exporter


def _find_plugins_js() -> Path | None:
    here = Path(__file__).resolve()
    for ancestor in here.parents:
        candidate = ancestor / "cli" / "lib" / "plugins.js"
        if candidate.is_file():
            return candidate
    return None


def _js_string_array(js_text: str, const_name: str) -> list[str] | None:
    """Extract a `const <name> = [ '...', ... ]` string array from JS source."""
    m = re.search(re.escape(const_name) + r"\s*=\s*\[(.*?)\]", js_text, re.S)
    if not m:
        return None
    return re.findall(r"""['"]([^'"]+)['"]""", m.group(1))


def test_plugin_valid_types_match_cli_js():
    pj = _find_plugins_js()
    if pj is None:
        pytest.skip("cli/lib/plugins.js not present (standalone harness checkout)")
    js_types = _js_string_array(pj.read_text(encoding="utf-8"), "VALID_TYPES")
    assert js_types, "Could not parse VALID_TYPES from cli/lib/plugins.js"
    assert exporter.VALID_METHOD_TYPES == js_types, (
        "exporter.py VALID_METHOD_TYPES has DRIFTED from cli/lib/plugins.js "
        "VALID_TYPES — a plugin valid in the CLI would be rejected by the "
        "harness exporter (or vice versa). Sync the Python list to the JS.\n"
        f"  python: {exporter.VALID_METHOD_TYPES}\n  js:     {js_types}"
    )


def test_plugin_required_fields_match_cli_js():
    pj = _find_plugins_js()
    if pj is None:
        pytest.skip("cli/lib/plugins.js not present")
    js_req = _js_string_array(pj.read_text(encoding="utf-8"), "REQUIRED_FIELDS")
    assert js_req, "Could not parse REQUIRED_FIELDS from cli/lib/plugins.js"
    assert exporter.REQUIRED_MANIFEST_FIELDS == js_req, (
        "exporter.py REQUIRED_MANIFEST_FIELDS drifted from plugins.js "
        f"REQUIRED_FIELDS.\n  python: {exporter.REQUIRED_MANIFEST_FIELDS}\n"
        f"  js:     {js_req}"
    )


def test_plugin_name_pattern_matches_cli_js():
    pj = _find_plugins_js()
    if pj is None:
        pytest.skip("cli/lib/plugins.js not present")
    js = pj.read_text(encoding="utf-8")
    # Both sides enforce kebab-case: /^[a-z0-9][a-z0-9-]*$/
    assert "^[a-z0-9][a-z0-9-]*$" in js, "CLI kebab pattern not found in plugins.js"
    assert exporter.KEBAB_CASE_RE.pattern == "^[a-z0-9][a-z0-9-]*$"
