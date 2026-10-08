"""Metric reliability: the family lookup and the family list must agree.

Round-3 synthetic researcher, eng→sme (Northern Sami): the reliability surface
listed Uralic as a family WITH WMT human-judgment evidence, then said no
evidence covered sme "directly or via its family". Root cause: the lookup
only matched the index's WMT-judged languages and never resolved the target's
family at all — the "via its family" clause described a check that was never
made. sme's card classifies it as Uralic (Glottolog and WALS agree), and the
index rolls up Uralic from three judged targets (et, fi, liv), so the honest
answer is the Uralic roll-up with the transfer caveat.

The family comes from the language card through the adapter (attributions()),
never a bare read; a disagreement between card sources stays visible, and two
sources naming two different evidenced families is never resolved by picking.
"""

from __future__ import annotations

import pytest

from mt_eval_harness.recommend import (
    catalogue_path,
    card_family_claims,
    metric_reliability_evidence,
    recommend,
    render_text,
)

RELIABILITY = {
    "languages": {
        "fi": {"iso639_3": "fin", "family": "Uralic", "genus": "Finnic"},
        "xh": {"iso639_3": "xho", "family": "Niger-Congo", "genus": "Bantu"},
        "ta": {"iso639_3": "tam", "family": "Dravidian", "genus": "Southern Dravidian"},
    },
    "families": {
        "Uralic": {"n_pairs": 1, "metrics": {
            "chrf_plus_plus": {"sys": {"n_pairs": 1, "pearson_weighted_mean": 0.91}},
            "bleu": {"sys": {"n_pairs": 1, "pearson_weighted_mean": 0.85}},
        }},
        "Niger-Congo": {"n_pairs": 1, "metrics": {
            "comet_score": {"sys": {"n_pairs": 1, "pearson_weighted_mean": 0.7}},
        }},
        "Dravidian": {"n_pairs": 1, "metrics": {
            "bleu": {"sys": {"n_pairs": 1, "pearson_weighted_mean": 0.6}},
        }},
    },
    "cells": [{"pair": "en-fi", "tgt": "fi", "preferred": True}],
    "license_lane": {"commercial_ok": False},
}


def _claims(*pairs):
    return lambda code: ([{"value": v, "source": s} for v, s in pairs], None)


def test_unjudged_language_in_an_evidenced_family_gets_the_family_rollup():
    section, notes = metric_reliability_evidence(
        "sme", RELIABILITY,
        family_claims=_claims(("Uralic", "glottolog-v5.3"), ("Uralic", "wals-v2020.5")))
    assert section is not None, notes
    assert section["target_family"] == "Uralic"
    assert section["target_code"] is None
    assert section["exact_pairs_measured"] == []
    assert [m["metric"] for m in section["family_metrics"]] == ["chrf_plus_plus", "bleu"]
    assert section["family_basis"]["matched_sources"] == ["glottolog-v5.3", "wals-v2020.5"]
    # The transfer caveat and the basis are said, the contradiction is not.
    assert any("assumption, not a measurement" in n for n in notes)
    assert any("glottolog-v5.3" in n and "Uralic" in n for n in notes)
    assert not any("UNMEASURED" in n for n in notes)


def test_disputed_family_shows_every_source_and_rests_on_the_matching_one():
    section, notes = metric_reliability_evidence(
        "yor", RELIABILITY,
        family_claims=_claims(("Atlantic-Congo", "glottolog-v5.3"),
                              ("Niger-Congo", "wals-v2020.5")))
    assert section["target_family"] == "Niger-Congo"
    assert section["family_basis"]["matched_sources"] == ["wals-v2020.5"]
    dispute = next(n for n in notes if "disagree" in n)
    assert "Atlantic-Congo (glottolog-v5.3)" in dispute
    assert "Niger-Congo (wals-v2020.5)" in dispute


def test_sources_naming_two_evidenced_families_are_never_resolved_by_picking():
    section, notes = metric_reliability_evidence(
        "zzz", RELIABILITY,
        family_claims=_claims(("Uralic", "src-a"), ("Dravidian", "src-b")))
    assert section is None
    assert any("UNMEASURED" in n and "does not pick" in n for n in notes)


def test_family_without_evidence_says_so_and_names_the_family():
    section, notes = metric_reliability_evidence(
        "crk", RELIABILITY,
        family_claims=_claims(("Algic", "glottolog-v5.3"), ("Algic", "wals-v2020.5")))
    assert section is None
    (note,) = notes
    assert "UNMEASURED" in note
    assert "directly or via its family" in note
    assert "Algic (glottolog-v5.3, wals-v2020.5)" in note


def test_unresolvable_family_never_claims_the_family_was_checked():
    section, notes = metric_reliability_evidence(
        "xyz", RELIABILITY,
        family_claims=lambda code: ([], f"no language card for '{code}'"))
    assert section is None
    (note,) = notes
    assert "UNMEASURED" in note
    assert "could not be checked" in note and "no language card" in note
    assert "via its family" not in note


def test_directly_judged_language_does_not_consult_the_card():
    def boom(code):
        raise AssertionError("a judged target must not need its card")
    section, notes = metric_reliability_evidence("fin", RELIABILITY, family_claims=boom)
    assert section["target_code"] == "fi" and section["exact_pairs_measured"] == ["en-fi"]
    assert "family_basis" not in section


# --- The real tracked index + the real card corpus (the reported case) -------

def _real_index():
    import json
    p = catalogue_path("metric-reliability.json")
    if p is None:
        pytest.skip("metric-reliability.json not in this install")
    return json.loads(p.read_text(encoding="utf-8"))


def test_card_adapter_reads_sme_family_with_its_sources():
    claims, problem = card_family_claims("sme")
    if problem and "unavailable" in problem:
        pytest.skip(problem)
    assert problem is None
    assert {c["value"] for c in claims} == {"Uralic"}
    assert all(c["source"] for c in claims)


def test_real_index_sme_agrees_with_the_evidenced_family_list():
    """The reported contradiction, on the real data: Uralic is listed as an
    evidenced family, and sme (Uralic per its card) now gets that roll-up."""
    index = _real_index()
    claims, problem = card_family_claims("sme")
    if problem and "unavailable" in problem:
        pytest.skip(problem)
    assert "Uralic" in index["families"]
    section, notes = metric_reliability_evidence("sme", index)
    assert section is not None, notes
    assert section["target_family"] == "Uralic"
    assert section["exact_pairs_measured"] == []
    assert any("assumption, not a measurement" in n for n in notes)

    text = render_text(recommend("eng", "sme", env={}, curated={}, bulk={},
                                 reliability=index))
    assert "Metric trust for the target (family: Uralic" in text
    assert "family per the target's language card: Uralic" in text
    assert "UNMEASURED" not in text.split("Metric trust", 1)[1]
