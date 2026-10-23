"""method/1: one method.json, one reading, in both runtimes. The harness
reader (mt_eval_harness/framework/method.py) is held to the SAME vectors as
the CLI's (cli/test/framework-method.test.js)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness.framework.method import (
    read_method, read_method_document, slug_id)

ROOT = Path(__file__).resolve().parents[2]
VECTORS = ROOT / "shared" / "test-fixtures" / "framework" / "method-vectors.json"
BUNDLED = Path(__file__).resolve().parents[1] / "mt_eval_harness" / "data" / "schemas" / "framework"


def test_every_vector_reads_exactly_as_expected():
    if not VECTORS.is_file():
        pytest.skip("monorepo shared/ absent (standalone install)")
    cases = json.loads(VECTORS.read_text(encoding="utf-8"))["cases"]
    assert len(cases) >= 20, "the vector set shrank"
    for c in cases:
        r = read_method_document(c["doc"])
        got = {"version": r["version"], "shape": r["shape"], "errors": r["errors"],
               "warnings": r["warnings"]}
        if r["version"] == 0:
            assert r["data"]["x-v0"] == c["doc"], f"{c['name']}: x-v0 keeps the original"
            got["view"] = {k: v for k, v in r["data"].items() if k != "x-v0"}
        assert got == c["expect"], c["name"]


@pytest.mark.parametrize("name", ["method.v1.schema.json", "method.v0-map.json"])
def test_bundled_copy_matches_shared(name):
    shared = ROOT / "shared" / "schemas" / "framework" / name
    if not shared.is_file():
        pytest.skip("monorepo shared/ absent (standalone install)")
    assert (BUNDLED / name).read_bytes() == shared.read_bytes(), (
        f"mt_eval_harness/data/schemas/framework/{name} has drifted from "
        f"shared/schemas/framework/{name} — copy it.")


def test_reading_a_file(tmp_path):
    f = tmp_path / "method.json"
    f.write_text(json.dumps({"$schema": "https://champollion.dev/schemas/method/1.json",
                             "id": "w", "name": "W", "kind": "lexicon",
                             "dictionary": "words.tsv"}))
    r = read_method(f)
    assert r["version"] == 1 and r["errors"] == [] and r["dir"] == str(tmp_path)
    f.write_text("{not json")
    assert read_method(f)["errors"] == ["$: not readable as JSON (JSONDecodeError)"]
    assert read_method(tmp_path / "gone.json")["errors"] == ["gone.json: no such file"]


def test_slug_id():
    assert slug_id("CRK Decomp-Recomp Pipeline") == "crk-decomp-recomp-pipeline"
    assert slug_id("¿?") == "method"


def test_check_project_lists_method_files_like_the_js_twin(tmp_path):
    from mt_eval_harness.framework import check_project

    def w(rel, obj):
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(obj))
    w("methods/words/method.json", {
        "$schema": "https://champollion.dev/schemas/method/1.json", "id": "words",
        "name": "Words", "kind": "lexicon"})
    w(".champollion/methods/old/method.json",
      {"name": "old", "type": "deepl", "version": "1.0.0", "locales": ["fr"]})
    r = check_project(tmp_path)
    assert [m["file"] for m in r["methods"]] == [
        ".champollion/methods/old/method.json", "methods/words/method.json"]
    old, words = r["methods"]
    assert old["version"] == 0 and old["errors"] == [] and old["shape"] == "cli-plugin"
    assert words["errors"] == ["$: kind lexicon must name its dictionary"]
    assert r["ok"] is False and "data" not in words


def _plugin_dir(tmp_path, doc):
    import shutil

    d = tmp_path / "plugin"
    shutil.copytree(Path(__file__).resolve().parents[1] / "examples"
                    / "method_plugin_passthrough", d)
    (d / "method.json").write_text(json.dumps(doc))
    return d


def test_the_harness_loads_a_method_1_python_plugin(tmp_path):
    import asyncio
    from types import SimpleNamespace

    from mt_eval_harness.method_loader import load_manifest, load_method

    d = _plugin_dir(tmp_path, {
        "$schema": "https://champollion.dev/schemas/method/1.json",
        "id": "example-passthrough-v1", "name": "Passthrough", "kind": "python",
        "entry_point": "passthrough:PassthroughMethod",
        "card": {"class": "custom-plugin", "paradigm": "rule-based"},
        "pairs": [{"source": "eng", "target": "qaa"}], "dependency_class": "S"})
    m = load_manifest(d)
    assert m["entry_point"] == "passthrough:PassthroughMethod"
    assert m["supported_pairs"] == ["eng>qaa"] and m["dependency_class"] == "S"
    method = load_method(d)
    out = asyncio.run(method.translate([{"id": "1", "source": "a wug"}],
                                       SimpleNamespace(source_field="source")))
    assert out[0]["predicted"] == "a wug"
    # the run is labelled with its id, not its folder's name
    from mt_eval_harness.config import RunConfig

    assert RunConfig(method_path=str(d)).method_id == "example-passthrough-v1"
    legacy = tmp_path / "legacy"
    legacy.mkdir()
    (legacy / "method.json").write_text(json.dumps({"method_id": "old-style-v1", "name": "Old", "class": "nope"}))
    assert RunConfig(method_path=str(legacy)).method_id == "old-style-v1"
    (legacy / "method.json").write_text("{not json")
    assert RunConfig(method_path=str(legacy)).method_id == "legacy"


def test_other_kinds_are_refused_with_how_they_run(tmp_path):
    from mt_eval_harness.method_loader import MethodLoadError, load_method

    d = _plugin_dir(tmp_path, {
        "$schema": "https://champollion.dev/schemas/method/1.json",
        "id": "words", "name": "Words", "kind": "lexicon", "dictionary": "w.tsv"})
    with pytest.raises(MethodLoadError, match="--method lexicon -m"):
        load_method(d)
    (d / "method.json").write_text(json.dumps({
        "$schema": "https://champollion.dev/schemas/method/1.json",
        "id": "x", "name": "X", "kind": "python"}))
    with pytest.raises(MethodLoadError, match="kind python must name its entry_point"):
        load_method(d)
