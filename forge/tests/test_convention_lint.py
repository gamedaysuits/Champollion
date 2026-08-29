import pytest

from nmt_forge.errors import ConventionError
from nmt_forge.guards.convention_lint import (
    ConventionSpec,
    assert_single_convention,
    lint,
    mixed_convention_rate,
)

CIRC = ConventionSpec("circumflex", chars="âêîôûÂÊÎÔÛ")
MACR = ConventionSpec("macron", chars="āēīōūĀĒĪŌŪ")
SPECS = [CIRC, MACR]


def test_single_convention_corpus_passes():
    texts = ["nikî-nipân", "ê-wâpamât", "plain ascii row"]
    report = assert_single_convention(texts, SPECS)
    assert report.counts["circumflex"] == 2
    assert report.counts["macron"] == 0
    assert report.dominant == "circumflex"


def test_mixed_within_one_text_refused():
    # the measured pathology: conventions mixed INSIDE one sentence
    texts = ["nikî-nipān"]  # î (circumflex) + ā (macron)
    assert mixed_convention_rate(texts, SPECS) == 1.0
    with pytest.raises(ConventionError) as e:
        assert_single_convention(texts, SPECS)
    assert "canonicalize" in str(e.value)


def test_corpus_level_mixing_refused():
    # the deliberate-augmentation mistake: each row is clean, corpus is not
    texts = ["nikî-nipân", "nikī-nipān"]
    assert mixed_convention_rate(texts, SPECS) == 0.0  # no row mixes
    with pytest.raises(ConventionError, match="across rows"):
        assert_single_convention(texts, SPECS)


def test_tolerance_is_explicit():
    texts = ["nikî-nipân"] * 99 + ["nikî-nipān"]
    report = lint(texts, SPECS)
    assert len(report.mixed_indices) == 1
    # 1% mixed passes a 2% tolerance but corpus-mixing check still applies —
    # the mixed row is the only macron carrier, so counts show both
    with pytest.raises(ConventionError):
        assert_single_convention(texts, SPECS, max_mixed_fraction=0.02)


def test_pattern_spec():
    spaced = ConventionSpec("spaced-preverb", pattern=r"\bê \w")
    assert spaced.present_in("ê wâpamât")
    assert not spaced.present_in("ê-wâpamât")


def test_spec_needs_chars_or_pattern():
    with pytest.raises(ValueError):
        ConventionSpec("empty")


def test_report_manifest_is_content_free():
    texts = ["nikî-nipân secretword"]
    m = lint(texts, SPECS).to_manifest()
    import json

    assert "secretword" not in json.dumps(m)
