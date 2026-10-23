"""Contamination-lane policy tests.

The lane policy is the SSOT for "can this score be read as absolute quality, or
only as a relative comparison?" HIGH and MEDIUM corpora (FLORES+ et al. and
anything possibly in models' training data) are relative-comparison-only; ONLY
a positively-LOW corpus is rankable on absolute quality, and the gate FAILS SAFE
— an absent/None/unrecognized grade is relative-only, never absolute. These
tests pin the policy and the run-card stamping so a regression can't silently
let a HIGH/MEDIUM/ungraded corpus into the absolute-quality lane.
"""

from mt_eval_harness import contamination as contam


def test_normalize_grade_canonicalizes_and_drops_none():
    assert contam.normalize_grade("high") == "HIGH"
    assert contam.normalize_grade("  High ") == "HIGH"
    assert contam.normalize_grade("LOW") == "LOW"
    assert contam.normalize_grade("NONE") is None
    assert contam.normalize_grade("") is None
    assert contam.normalize_grade(None) is None


def test_is_relative_only_high_medium_and_failsafe():
    # HIGH and MEDIUM are both relative-only.
    assert contam.is_relative_only("HIGH") is True
    assert contam.is_relative_only("high") is True
    assert contam.is_relative_only("MEDIUM") is True
    assert contam.is_relative_only("medium") is True
    # Only a positively-LOW grade is absolute-rankable.
    assert contam.is_relative_only("LOW") is False
    assert contam.is_relative_only("low") is False
    # FAIL SAFE: absent / NONE / unrecognized grades are relative-only, never
    # absolute — a missing or misspelled grade can't slip into the absolute lane.
    assert contam.is_relative_only(None) is True
    assert contam.is_relative_only("NONE") is True
    assert contam.is_relative_only("") is True
    assert contam.is_relative_only("bogus-grade") is True


def test_relative_only_grades_set_is_high_and_medium():
    # The policy SSOT: HIGH and MEDIUM are the named relative-only grades, and
    # LOW is the sole absolute-rankable grade.
    assert contam.RELATIVE_ONLY_GRADES == frozenset({"HIGH", "MEDIUM"})
    assert contam.ABSOLUTE_RANKABLE_GRADES == frozenset({"LOW"})


def test_lane_for_grade():
    assert contam.lane_for_grade("HIGH") == contam.LANE_RELATIVE_ONLY
    assert contam.lane_for_grade("MEDIUM") == contam.LANE_RELATIVE_ONLY
    assert contam.lane_for_grade("LOW") == contam.LANE_ABSOLUTE
    # FAIL SAFE: unknown / None grade routes to relative-only, NOT absolute.
    assert contam.lane_for_grade(None) == contam.LANE_RELATIVE_ONLY
    assert contam.lane_for_grade("bogus-grade") == contam.LANE_RELATIVE_ONLY


def test_relative_only_notice_empty_only_for_low():
    # Only a positively-LOW (absolute-rankable) corpus gets no relative-only
    # notice. An ungraded/None corpus is now relative-only, so it DOES warn.
    assert contam.relative_only_notice("LOW") == ""
    ungraded = contam.relative_only_notice(None)
    assert ungraded != ""
    assert "relative" in ungraded.lower()
    for grade in ("HIGH", "MEDIUM"):
        notice = contam.relative_only_notice(grade, "eval-flores-devtest-v1-fao-que")
        assert "relative" in notice.lower()
        assert "eval-flores-devtest-v1-fao-que" in notice
        assert grade in notice


def test_grade_for_dataset_unknown_is_none():
    # Never raises; unknown / unregistered → None. None is NOT "rankable": the
    # lane gate (is_relative_only) fails safe and treats it as relative-only.
    assert contam.grade_for_dataset("does-not-exist-xyz") is None
    assert contam.grade_for_dataset("") is None
    assert contam.grade_for_dataset(None) is None
    assert contam.is_relative_only(contam.grade_for_dataset("does-not-exist-xyz")) is True


def test_grade_for_dataset_reads_registry_flores():
    # The promoted FLORES+ fao→quy pair is the canonical HIGH-contamination
    # corpus. If it is registered (runnable lane), it must read back HIGH.
    grade = contam.grade_for_dataset("eval-flores-devtest-v1-fao-que")
    # When present in the registry it MUST be HIGH; when absent (e.g. registry
    # not yet rebuilt) the lookup returns None rather than raising.
    assert grade in (None, "HIGH")
