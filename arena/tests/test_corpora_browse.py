"""Tests for mt_eval_harness.corpora_browse — corpus discovery for a pair.

Exercises against a synthetic registry (no network) plus the bundled registry,
covering normalization, the gated-metadata surfacing, sort order, quarantine
exclusion, and both the table and JSON renderings.
"""

from __future__ import annotations

import json

import pytest

from mt_eval_harness import corpora_browse


# ---------------------------------------------------------------------------
# Synthetic registry fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def registry_file(tmp_path):
    reg = {
        "registry_version": "3.0.0",
        "datasets": [
            {
                "id": "eval-in22-conv-v1-eng-tel",
                "name": "IN22-Conv eng→tel",
                "language_pair": {"source": "eng", "target": "tel"},
                "size": 1503, "domain": "conversational",
                "license": "CC-BY-4.0", "source": "AI4Bharat",
                "access": "fetch-from-source", "do_not_train": True,
                "segment": "development", "contamination": "LOW",
                "gated": True,
                "terms_url": "https://huggingface.co/datasets/ai4bharat/IN22-Conv",
                "token_env": "HF_TOKEN",
                "source_export": {"builder": "in22-parallel"},
            },
            {
                "id": "eval-eng-tel-tatoeba-dev-v1",
                "name": "Tatoeba eng→tel",
                "language_pair": {"source": "eng", "target": "tel"},
                "size": 200, "domain": "mixed", "license": "CC-BY-2.0",
                "source": "Tatoeba", "access": "fetch-from-source",
                "do_not_train": True, "segment": "development",
                "contamination": "NONE",
            },
            {
                "id": "eval-quar-eng-tel",
                "name": "Quarantined eng→tel",
                "language_pair": {"source": "eng", "target": "tel"},
                "size": 50, "segment": "development", "quarantine": True,
            },
            {
                "id": "other-eng-fra",
                "language_pair": {"source": "eng", "target": "fra"},
                "size": 100, "segment": "development",
            },
        ],
    }
    p = tmp_path / "registry.json"
    p.write_text(json.dumps(reg), encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# list_corpora_for_pair
# ---------------------------------------------------------------------------

def test_filters_to_exact_pair(registry_file):
    infos = corpora_browse.list_corpora_for_pair(
        "eng", "tel", registry_path=registry_file)
    ids = {i["id"] for i in infos}
    assert ids == {"eval-in22-conv-v1-eng-tel", "eval-eng-tel-tatoeba-dev-v1"}
    # The fra pair and the quarantined entry are excluded.
    assert "other-eng-fra" not in ids
    assert "eval-quar-eng-tel" not in ids


def test_quarantined_included_on_request(registry_file):
    infos = corpora_browse.list_corpora_for_pair(
        "eng", "tel", registry_path=registry_file, include_quarantined=True)
    assert "eval-quar-eng-tel" in {i["id"] for i in infos}


def test_sort_lowest_contamination_first(registry_file):
    infos = corpora_browse.list_corpora_for_pair(
        "eng", "tel", registry_path=registry_file)
    # NONE (tatoeba) sorts before LOW (in22).
    assert infos[0]["id"] == "eval-eng-tel-tatoeba-dev-v1"
    assert infos[0]["contamination"] == "NONE"


def test_gated_metadata_surfaced(registry_file):
    infos = corpora_browse.list_corpora_for_pair(
        "eng", "tel", registry_path=registry_file)
    gated = next(i for i in infos if i["id"] == "eval-in22-conv-v1-eng-tel")
    assert gated["gated"] is True
    assert gated["terms_url"].endswith("IN22-Conv")
    assert gated["token_env"] == "HF_TOKEN"
    assert gated["builder"] == "in22-parallel"
    # Non-gated entry exposes no terms/token.
    plain = next(i for i in infos if i["id"] == "eval-eng-tel-tatoeba-dev-v1")
    assert plain["gated"] is False
    assert plain["terms_url"] is None
    assert plain["token_env"] is None


def test_gated_from_source_export_only(tmp_path):
    """gated/terms/token read from source_export when not at top level."""
    reg = {"registry_version": "3.0.0", "datasets": [{
        "id": "x", "language_pair": {"source": "eng", "target": "tel"},
        "segment": "development",
        "source_export": {
            "builder": "in22-parallel", "gated": True,
            "terms_url": "https://hf/x", "token_env": "HF_TOKEN"},
    }]}
    p = tmp_path / "r.json"
    p.write_text(json.dumps(reg), encoding="utf-8")
    info = corpora_browse.list_corpora_for_pair("eng", "tel", registry_path=p)[0]
    assert info["gated"] is True
    assert info["terms_url"] == "https://hf/x"


def test_empty_for_unknown_pair(registry_file):
    assert corpora_browse.list_corpora_for_pair(
        "zzz", "qqq", registry_path=registry_file) == []


# ---------------------------------------------------------------------------
# available_* helpers
# ---------------------------------------------------------------------------

def test_available_source_langs(registry_file):
    srcs = corpora_browse.available_source_langs(registry_path=registry_file)
    assert "eng" in srcs


def test_available_targets_for_source(registry_file):
    tgts = corpora_browse.available_targets_for_source(
        "eng", registry_path=registry_file)
    assert "tel" in tgts and "fra" in tgts


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def test_table_lists_gated_instructions(registry_file):
    infos = corpora_browse.list_corpora_for_pair(
        "eng", "tel", registry_path=registry_file)
    table = corpora_browse.format_corpora_table(infos, "eng", "tel")
    assert "eval-in22-conv-v1-eng-tel" in table
    assert "Gated corpora need accept-terms" in table
    assert "IN22-Conv" in table


def test_table_empty_message():
    table = corpora_browse.format_corpora_table([], "eng", "qqq")
    assert "none found" in table


def test_corpora_to_json_roundtrips(registry_file):
    infos = corpora_browse.list_corpora_for_pair(
        "eng", "tel", registry_path=registry_file)
    blob = corpora_browse.corpora_to_json(infos)
    # JSON-serializable, stable shape.
    s = json.dumps(blob)
    assert "eval-in22-conv-v1-eng-tel" in s


# ---------------------------------------------------------------------------
# Bundled registry — the real IN22 gated entries
# ---------------------------------------------------------------------------

def test_bundled_registry_has_gated_in22():
    infos = corpora_browse.list_corpora_for_pair("eng", "tel")
    gated = [i for i in infos if i["id"].startswith("eval-in22")]
    assert gated, "expected IN22 eng→tel corpora in the bundled registry"
    assert all(i["gated"] for i in gated)
    assert all(i["token_env"] == "HF_TOKEN" for i in gated)
