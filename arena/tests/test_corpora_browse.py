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
                "registry_source": "in22",
            },
            {
                "id": "eval-eng-tel-tatoeba-dev-v1",
                "name": "Tatoeba eng→tel",
                "language_pair": {"source": "eng", "target": "tel"},
                "size": 200, "domain": "mixed", "license": "CC-BY-2.0",
                "source": "Tatoeba", "access": "fetch-from-source",
                "do_not_train": True, "segment": "development",
                "contamination": "NONE",
                "source_export": {"builder": "tatoeba-challenge"},
                "registry_source": "tatoeba",
            },
            {
                "id": "eval-quar-eng-tel",
                "name": "Quarantined eng→tel",
                "language_pair": {"source": "eng", "target": "tel"},
                "size": 50, "segment": "development", "quarantine": True,
                "quarantine_reason": "license HELD pending rights-holder reply",
                "registry_source": "nusatranslation",
            },
            {
                "id": "eval-nobuilder-eng-tel",
                "name": "Catalogued, no builder",
                "language_pair": {"source": "eng", "target": "tel"},
                "size": 10, "segment": "development",
                "access": "fetch-from-source", "registry_source": "wmt25",
            },
            {
                "id": "eval-local-eng-tel-v1",
                "name": "Local eng→tel",
                "language_pair": {"source": "eng", "target": "tel"},
                "size": 5, "segment": "development", "access": "local",
                "path": "curated/local-eng-tel.json",
                "registry_source": "tatoeba",
            },
            {
                "id": "other-eng-fra",
                "language_pair": {"source": "eng", "target": "fra"},
                "size": 100, "segment": "development",
                "registry_source": "globalvoices",
            },
            {
                "id": "held-only-eng-crk",
                "language_pair": {"source": "eng", "target": "crk"},
                "size": 436, "segment": "development", "quarantine": True,
                "quarantine_reason": "non-commercial lane",
                "registry_source": "prize",
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
    assert ids == {"eval-in22-conv-v1-eng-tel", "eval-eng-tel-tatoeba-dev-v1",
                   "eval-nobuilder-eng-tel", "eval-local-eng-tel-v1"}
    # The fra pair and the quarantined entry are excluded.
    assert "other-eng-fra" not in ids
    assert "eval-quar-eng-tel" not in ids


# ---------------------------------------------------------------------------
# availability — derived from what the harness can actually DO with an entry
# ---------------------------------------------------------------------------

def _by_id(infos):
    return {i["id"]: i for i in infos}


def test_availability_vocabulary(registry_file, monkeypatch):
    monkeypatch.delenv("MT_EVAL_DATA_ROOT", raising=False)
    infos, hidden = corpora_browse.list_all_corpora(
        registry_file, source="eng", target="tel", include_quarantined=True)
    by = _by_id(infos)
    assert hidden == 0
    assert by["eval-in22-conv-v1-eng-tel"]["availability"] == "gated"
    assert by["eval-eng-tel-tatoeba-dev-v1"]["availability"] == "fetch"
    assert by["eval-quar-eng-tel"]["availability"] == "quarantined"
    assert by["eval-nobuilder-eng-tel"]["availability"] == "unbuildable"
    # Declared in-repo but the file is nowhere on this machine.
    assert by["eval-local-eng-tel-v1"]["availability"] == "local-missing"
    assert all(i["availability"] in corpora_browse.AVAILABILITY_VALUES
               for i in infos)


def test_availability_local_present_via_data_root(registry_file, tmp_path, monkeypatch):
    root = tmp_path / "data-root"
    (root / "curated").mkdir(parents=True)
    (root / "curated" / "local-eng-tel.json").write_text("[]", encoding="utf-8")
    monkeypatch.setenv("MT_EVAL_DATA_ROOT", str(root))
    infos, _ = corpora_browse.list_all_corpora(registry_file, source="eng", target="tel")
    assert _by_id(infos)["eval-local-eng-tel-v1"]["availability"] == "local"


def test_normalize_carries_family_and_reason(registry_file):
    infos, _ = corpora_browse.list_all_corpora(
        registry_file, include_quarantined=True)
    by = _by_id(infos)
    assert by["eval-in22-conv-v1-eng-tel"]["family"] == "in22"
    assert by["eval-quar-eng-tel"]["quarantine_reason"].startswith("license HELD")
    # Non-quarantined entries never carry a reason.
    assert by["eval-in22-conv-v1-eng-tel"]["quarantine_reason"] is None


# ---------------------------------------------------------------------------
# list_all_corpora — the `mt-eval list datasets` query
# ---------------------------------------------------------------------------

def test_list_all_hides_and_counts_quarantined(registry_file):
    infos, hidden = corpora_browse.list_all_corpora(registry_file)
    ids = {i["id"] for i in infos}
    assert "eval-quar-eng-tel" not in ids and "held-only-eng-crk" not in ids
    assert hidden == 2
    infos, hidden = corpora_browse.list_all_corpora(
        registry_file, include_quarantined=True)
    assert hidden == 0
    assert {"eval-quar-eng-tel", "held-only-eng-crk"} <= {i["id"] for i in infos}


def test_list_all_filters(registry_file):
    infos, hidden = corpora_browse.list_all_corpora(registry_file, family="tatoeba")
    assert {i["id"] for i in infos} == {"eval-eng-tel-tatoeba-dev-v1",
                                        "eval-local-eng-tel-v1"}
    infos, hidden = corpora_browse.list_all_corpora(
        registry_file, source="eng", target="crk")
    assert infos == [] and hidden == 1
    infos, _ = corpora_browse.list_all_corpora(registry_file, source="eng")
    # Stable (source, target, id) order.
    assert [i["id"] for i in infos] == sorted(
        (i["id"] for i in infos),
        key=lambda x: next((i["source"], i["target"], i["id"]) for i in infos if i["id"] == x))


def test_known_families(registry_file):
    assert corpora_browse.known_families(registry_file) == [
        "globalvoices", "in22", "nusatranslation", "prize", "tatoeba", "wmt25"]


def test_quarantined_for_pair(registry_file):
    held = corpora_browse.quarantined_for_pair("eng", "crk", registry_path=registry_file)
    assert [h["id"] for h in held] == ["held-only-eng-crk"]
    assert held[0]["quarantine_reason"] == "non-commercial lane"
    assert corpora_browse.quarantined_for_pair("eng", "fra", registry_path=registry_file) == []


def test_quarantined_only_targets_for_source(registry_file):
    # crk exists ONLY as a quarantined entry; tel has runnable entries too.
    assert corpora_browse.quarantined_only_targets_for_source(
        "eng", registry_path=registry_file) == ["crk"]
    assert "crk" not in corpora_browse.available_targets_for_source(
        "eng", registry_path=registry_file)


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


def test_table_empty_but_catalogued_explains_itself(registry_file):
    """A pair whose entries are all quarantined must say so, with reasons."""
    hidden = corpora_browse.quarantined_for_pair("eng", "crk", registry_path=registry_file)
    table = corpora_browse.format_corpora_table([], "eng", "crk", hidden=hidden)
    assert "none found" not in table
    assert "none runnable" in table
    assert "1 quarantined entry hidden" in table
    assert "held-only-eng-crk" in table
    assert "non-commercial lane" in table
    assert "--include-quarantined" in table


def test_table_marks_included_quarantined_rows(registry_file):
    infos = corpora_browse.list_corpora_for_pair(
        "eng", "tel", registry_path=registry_file, include_quarantined=True)
    table = corpora_browse.format_corpora_table(infos, "eng", "tel")
    q_rows = [l for l in table.splitlines() if l.lstrip().startswith("Q")
              and "eval-quar-eng-tel" in l]
    assert q_rows, "quarantined row must carry the Q marker"
    assert "Q = quarantined (catalogued, never runnable)" in table
    assert "license HELD" in table


def test_table_footer_counts_hidden(registry_file):
    infos = corpora_browse.list_corpora_for_pair("eng", "tel", registry_path=registry_file)
    hidden = corpora_browse.quarantined_for_pair("eng", "tel", registry_path=registry_file)
    table = corpora_browse.format_corpora_table(infos, "eng", "tel", hidden=hidden)
    assert "1 quarantined entry hidden (--include-quarantined to list them)" in table


# ---------------------------------------------------------------------------
# format_datasets_table — the `mt-eval list datasets` rendering
# ---------------------------------------------------------------------------

def test_datasets_table_is_honest_and_bounded(registry_file):
    infos, hidden = corpora_browse.list_all_corpora(registry_file)
    table = corpora_browse.format_datasets_table(
        infos, total=len(infos), hidden_quarantined=hidden, limit=2)
    # The old formatter labelled every public corpus "(blank) = private".
    assert "private" not in table
    assert f"{len(infos)} listed" in table
    assert "2 quarantined hidden; --include-quarantined" in table
    rows = [l for l in table.splitlines() if l.startswith("  eval-") or l.startswith("  other-")]
    assert len(rows) == 2
    assert f"Showing 1–2 of {len(infos)}" in table
    assert "fetch = rebuilt on demand" in table


def test_datasets_table_long_ids_not_truncated(tmp_path):
    long_id = "eval-" + "x" * 41  # 46 chars — the longest id in the real registry
    reg = {"registry_version": "3.0.0", "datasets": [{
        "id": long_id, "language_pair": {"source": "eng", "target": "tel"},
        "segment": "development", "access": "fetch-from-source",
        "source_export": {"builder": "b"}, "registry_source": "in22",
        "size": 12345, "license": "CC-BY-4.0"}]}
    p = tmp_path / "r.json"
    p.write_text(json.dumps(reg), encoding="utf-8")
    infos, hidden = corpora_browse.list_all_corpora(p)
    table = corpora_browse.format_datasets_table(
        infos, total=1, hidden_quarantined=hidden, limit=None)
    assert long_id in table
    assert "12,345" in table
    assert "Showing 1 of 1" in table


def test_datasets_table_empty_registry():
    assert corpora_browse.format_datasets_table(
        [], total=0, hidden_quarantined=0) == "  No datasets registered."


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
