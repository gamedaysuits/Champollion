import pytest

from nmt_forge.errors import CitationError, CoverageError
from nmt_forge.guards.coverage_map import (
    ChecklistItem,
    assert_no_missing_required,
    coverage,
    coverage_of_corpus,
)

CHECKLIST = [
    ChecklistItem("tense", "tensed indicative", "Toygrammar 2020 §3", required=True),
    ChecklistItem("imperative", "commands", "Toygrammar 2020 §7", required=True),
    ChecklistItem("question", "yes/no questions", "Toygrammar 2020 §5"),
]

KIND_PHEN = {
    "tensed_present": ("tense",),
    "tensed_past": ("tense",),
    "imperative": ("imperative",),
    "question": ("question",),
}


def test_checklist_item_requires_citation():
    with pytest.raises(CitationError, match="citation"):
        ChecklistItem("x", "thing", "  ")


def test_zero_coverage_required_item_refused():
    counts = {"tensed_present": 500_000, "tensed_past": 400_000}
    report = coverage(counts, KIND_PHEN, CHECKLIST)
    assert report.missing == ["imperative", "question"]
    assert report.missing_required == ["imperative"]
    with pytest.raises(CoverageError) as e:
        assert_no_missing_required(report)
    msg = str(e.value)
    # the refusal names the phenomenon AND its grammar citation
    assert "imperative" in msg and "Toygrammar 2020 §7" in msg
    assert "1M pairs" in msg or "million" in msg or "no imperatives" in msg


def test_volume_does_not_hide_the_gap():
    # 1M pairs, 2 shapes: entropy near 1 bit, top share ~0.56 — measurable
    counts = {"tensed_present": 560_000, "tensed_past": 440_000}
    report = coverage(counts, KIND_PHEN, CHECKLIST)
    assert report.top_kind_share == pytest.approx(0.56, abs=0.01)
    assert report.kind_entropy < 1.1


def test_full_coverage_passes():
    counts = {k: 10 for k in KIND_PHEN}
    report = coverage(counts, KIND_PHEN, CHECKLIST)
    assert report.missing == []
    assert_no_missing_required(report)


def test_unknown_phenomenon_refused():
    with pytest.raises(CoverageError, match="unknown phenomena"):
        coverage({"weird": 5}, {"weird": ("not_in_checklist",)}, CHECKLIST)


def test_unmapped_kinds_surface():
    counts = {"tensed_present": 5, "mystery_kind": 7}
    report = coverage(counts, KIND_PHEN, CHECKLIST)
    assert report.unmapped_kinds == ["mystery_kind"]


def test_coverage_of_corpus_reads_kind_field():
    rows = [{"kind": "imperative"}] * 3 + [{"kind": "question"}] * 2
    report = coverage_of_corpus(rows, KIND_PHEN, CHECKLIST)
    assert report.per_item["imperative"] == 3
    assert report.per_item["question"] == 2
