"""A method-plugin run records which code and which model produced it.

Regression (synthetic researcher, 2026-10-03): a `--method <dir>` plugin run
published with fingerprint method_version / method_sha256 null and
method_config.model set to the plugin's own id — the model the plugin
actually called ("stub-1") appeared nowhere. Now the run log carries
provenance.method_plugin (declared version, sha256 over method.json + the
plugin's .py files, models called) and the run card fills those fields.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from pathlib import Path

from mt_eval_harness.config import RunConfig
from mt_eval_harness.method_loader import models_called, plugin_provenance
from mt_eval_harness.publish import assemble_run_card
from mt_eval_harness.runner import execute_run

PLUGIN_SRC = '''
class StubMethod:
    def __init__(self, manifest=None, method_dir=None):
        pass

    @property
    def name(self):
        return "stub-plugin"

    def method_card(self):
        return {"name": "Stub", "method_id": "stub-plugin", "class": "pipeline",
                "paradigm": "llm"}

    async def translate(self, entries, config):
        return [{"id": e["id"], "predicted": e["source"].upper(), "latency_s": 0.0,
                 "usage": {"prompt_tokens": 1, "completion_tokens": 1},
                 "error": None, "tool_calls": [], "tool_call_count": 0,
                 "metadata": {"model": "stub-1"}} for e in entries]
'''


def _plugin(tmp_path: Path, **manifest_extra) -> Path:
    d = tmp_path / "stubplug"
    d.mkdir()
    (d / "method.json").write_text(json.dumps({
        "name": "Stub", "method_id": "stub-plugin", "class": "pipeline",
        "entry_point": "stub:StubMethod", **manifest_extra}))
    (d / "stub.py").write_text(PLUGIN_SRC)
    return d


def _run(tmp_path: Path, plugin_dir: Path):
    corpus = tmp_path / "corpus.json"
    corpus.write_text(json.dumps({
        "dataset": {"language_pair": {"source": "eng", "target": "fra"}},
        "entries": [{"id": str(i), "source": f"hello {i}", "reference": f"bonjour {i}"}
                    for i in range(4)]}))
    cfg = RunConfig(method_path=str(plugin_dir), corpus_path=str(corpus),
                    target_lang="French", output_dir=str(tmp_path / "out"),
                    cache_dir=str(tmp_path / "cache"), dataset="all")
    log = asyncio.run(execute_run(cfg))
    report = next((tmp_path / "out").glob("*_report.json"))
    card, _id, _fp = assemble_run_card(report)
    return log, card


def test_plugin_run_card_names_version_code_hash_and_model(tmp_path):
    plugin = _plugin(tmp_path, version="0.3.0")
    log, card = _run(tmp_path, plugin)

    mp = log["provenance"]["method_plugin"]
    assert mp["version"] == "0.3.0"
    assert mp["files"] == ["method.json", "stub.py"]
    assert mp["models_called"] == ["stub-1"] and mp["models_basis"] == "observed"

    comps = card["fingerprint"]["components"]
    assert comps["method_version"] == "0.3.0"
    assert comps["method_sha256"] == mp["sha256"]
    assert card["method_config"]["model"] == "stub-1"
    assert card["model_slug"] == "stub-plugin"   # the leaderboard identity is the method


def test_code_hash_is_reproducible_with_sha256sum(tmp_path):
    plugin = _plugin(tmp_path, version="1")
    lines = "".join(
        f"{hashlib.sha256((plugin / f).read_bytes()).hexdigest()}  {f}\n"
        for f in ("method.json", "stub.py"))
    assert plugin_provenance(plugin)["sha256"] == hashlib.sha256(lines.encode()).hexdigest()
    # Editing the code changes the hash.
    before = plugin_provenance(plugin)["sha256"]
    (plugin / "stub.py").write_text(PLUGIN_SRC + "\n# changed\n")
    assert plugin_provenance(plugin)["sha256"] != before


def test_undeclared_version_stays_null_never_guessed(tmp_path):
    assert plugin_provenance(_plugin(tmp_path))["version"] is None


def test_declared_model_is_used_only_when_none_was_observed():
    assert models_called([{"metadata": {}}], {"model": "m-card"}) == (["m-card"], "declared")
    assert models_called([], None, {"model": "m-manifest"}) == (["m-manifest"], "declared")
    assert models_called([{"metadata": {"model": "x"}}], {"model": "m-card"}) == (["x"], "observed")
    assert models_called([{"metadata": {}}], None) == ([], None)
