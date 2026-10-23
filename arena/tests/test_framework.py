"""The harness's reader of the framework documents (project/1, set/1) is held
to the SAME vectors as the CLI's (cli/test/framework.test.js): one document,
one verdict, in both runtimes. See mt_eval_harness/framework/."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness.framework import (
    PROJECT_FILE, SCHEMA_IDS, SIDECAR_SUFFIX, check_document, check_project,
    read_set)
from mt_eval_harness.framework.mini_schema import validate

ROOT = Path(__file__).resolve().parents[2]
VECTORS = ROOT / "shared" / "test-fixtures" / "framework" / "schema-vectors.json"
BUNDLED = Path(__file__).resolve().parents[1] / "mt_eval_harness" / "data" / "schemas" / "framework"


def test_every_vector_gives_exactly_the_expected_verdict():
    if not VECTORS.is_file():
        pytest.skip("monorepo shared/ absent (standalone install)")
    cases = json.loads(VECTORS.read_text(encoding="utf-8"))["cases"]
    assert len(cases) >= 15, "the vector set shrank"
    for c in cases:
        r = check_document(c["doc"], c["type"])
        got = {"version": r["version"], "errors": r["errors"],
               "warnings": r["warnings"]}
        assert got == c["expect"], c["name"]


@pytest.mark.parametrize("name", ["project.v1.schema.json", "set.v1.schema.json",
                                  "gate-chain.v1.schema.json", "deployment.v1.schema.json"])
def test_bundled_schema_matches_shared(name):
    shared = ROOT / "shared" / "schemas" / "framework" / name
    if not shared.is_file():
        pytest.skip("monorepo shared/ absent (standalone install)")
    assert (BUNDLED / name).read_bytes() == shared.read_bytes(), (
        f"mt_eval_harness/data/schemas/framework/{name} has drifted from "
        f"shared/schemas/framework/{name} — copy it.")


SCHEMA = {"type": "object", "additionalProperties": False,
          "properties": {"a": {"type": "string"}},
          "patternProperties": {"^x-": {"type": "string"}}}


def test_pattern_properties_match_the_js_twin():
    assert validate({"a": "k", "x-n": "v"}, SCHEMA)["errors"] == []
    assert validate({"x-n": 3}, SCHEMA)["errors"] == [
        "$.x-n: expected type string, got integer"]
    assert validate({"b": 1}, SCHEMA)["errors"] == ["$: unexpected property 'b'"]


def test_js_number_semantics_are_reproduced():
    # JSON 2.0 is the JS number 2: an integer, printed "2"
    assert validate(2.0, {"type": "integer"})["errors"] == []
    assert validate(-1.0, {"type": "integer", "minimum": 0})["errors"] == [
        "$: -1 < minimum 0"]
    # minLength counts UTF-16 code units, as JS string.length does
    assert validate("\U0001F600", {"type": "string", "minLength": 2})["errors"] == []


def _tmp_project(root: Path) -> Path:
    def w(rel, obj):
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(obj if isinstance(obj, str) else json.dumps(obj))
    w(PROJECT_FILE, {"$schema": SCHEMA_IDS["project"], "kind": "language",
                     "name": "eng-qaa", "pair": {"source": "eng", "target": "qaa"}})
    w("data/test/checked.tsv", "hello\tzub\n")
    w(f"data/test/checked.tsv{SIDECAR_SUFFIX}", {"transmission": "local-only", "note": "old"})
    w("data/parallel/pairs.tsv", "a\tb\n")
    w(f"data/parallel/pairs.tsv{SIDECAR_SUFFIX}",
      {"$schema": SCHEMA_IDS["set"], "role": "train", "terms": {"training": "nope"}})
    w(f"data/broken.tsv{SIDECAR_SUFFIX}", "{not json")
    w(f"node_modules/pkg/x.tsv{SIDECAR_SUFFIX}", {"anything": True})
    return root


def test_check_project_matches_the_js_twin(tmp_path):
    r = check_project(_tmp_project(tmp_path))
    assert r["ok"] is False
    assert r["project"]["errors"] == [] and r["project"]["version"] == 1
    assert [s["data_file"] for s in r["sets"]] == [
        "data/broken.tsv", "data/parallel/pairs.tsv", "data/test/checked.tsv"]
    broken, pairs, checked = r["sets"]
    assert broken["errors"] == [
        "$: not readable as JSON (JSONDecodeError) — fix the file; it states "
        "how this data may be used"]
    assert pairs["errors"] == [
        '$.terms.training: "nope" not in enum ["allowed","not-allowed"]']
    assert checked["version"] == 0 and len(checked["warnings"]) == 1
    assert "data" not in checked, "the report never carries sidecar values"


def test_no_project_file_is_still_checked(tmp_path):
    r = check_project(tmp_path)
    assert r["project"]["exists"] is False and r["ok"] is True and r["sets"] == []


def test_a_set_v1_sidecar_is_honoured_by_the_corpus_loader(tmp_path):
    """What `champollion data mark` writes (set/1: $schema, role, terms,
    written_by) is read by the harness's steward-sidecar path exactly as a
    set/0 mark: local-only is enforced, the new keys break nothing."""
    from mt_eval_harness import corpus_loader as cl

    data = tmp_path / "checked.tsv"
    data.write_text("Good night.\tzub nor\n", encoding="utf-8")
    (tmp_path / f"checked.tsv{SIDECAR_SUFFIX}").write_text(json.dumps({
        "$schema": SCHEMA_IDS["set"], "role": "test", "transmission": "local-only",
        "terms": {"training": "not-allowed", "owner": "the family"},
        "written_by": "champollion data mark"}), encoding="utf-8")
    assert cl.marked_local_only(str(data)) is True
    merged = cl.merge_steward_sidecar(str(data), {})
    assert merged.get("transmission") == "local-only"
    assert check_document(cl.read_steward_sidecar(str(data)), "set")["errors"] == []


def test_no_sidecar_is_not_an_error(tmp_path):
    r = read_set(tmp_path / "x.tsv")
    assert r["exists"] is False and r["errors"] == []
