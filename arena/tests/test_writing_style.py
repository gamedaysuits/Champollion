"""
Tests for mt_eval_harness.plugins.writing_style — writing style consistency metric.

Tests cover:
  - Formality score computation
  - Register detection
  - Sentence length ratio
  - Style profile integration (prohibited/required terms)
  - Aggregate metrics
  - Edge cases (empty strings, no register target)
"""

import pytest

from mt_eval_harness.plugins.writing_style import (
    WritingStyleMetric,
    StyleProfile,
    _avg_sentence_length,
    _sentence_count,
)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

class TestSentenceCount:
    """Sentence splitting edge cases."""

    def test_single_sentence(self):
        assert _sentence_count("Hello world.") == 1

    def test_multiple_sentences(self):
        assert _sentence_count("Hello world. How are you?") == 2

    def test_empty_string(self):
        assert _sentence_count("") == 0

    def test_no_punctuation(self):
        # Text without sentence-ending punctuation is treated as 1 sentence
        assert _sentence_count("Hello world") == 1

    def test_exclamation(self):
        assert _sentence_count("Wow! Amazing!") == 2


class TestAvgSentenceLength:
    """Average words per sentence."""

    def test_single_sentence(self):
        assert _avg_sentence_length("The cat sat on the mat.") == pytest.approx(6.0)

    def test_empty(self):
        assert _avg_sentence_length("") == 0.0

    def test_multi_sentence(self):
        # "Hello world. How are you doing today?" → 2 words + 5 words / 2 sentences
        result = _avg_sentence_length("Hello world. How are you doing today?")
        assert result == pytest.approx(3.5)


class TestFormalityScore:
    """Formality scoring based on lexical markers."""

    def _make_metric(self):
        """Create an English-language metric with formality markers loaded."""
        return WritingStyleMetric(target_lang="eng")

    def test_formal_text(self):
        metric = self._make_metric()
        text = "Therefore, we respectfully request your attendance."
        score = metric._formality_score(text)
        assert score > 0.5, f"Formal text scored {score}, expected > 0.5"

    def test_informal_text(self):
        metric = self._make_metric()
        text = "Hey dude, wanna grab lunch? Yeah, that's cool."
        score = metric._formality_score(text)
        assert score < 0.5, f"Informal text scored {score}, expected < 0.5"

    def test_neutral_text(self):
        metric = self._make_metric()
        text = "The weather is nice today."
        score = metric._formality_score(text)
        assert score == pytest.approx(0.5), "Neutral text should score 0.5"

    def test_contractions_are_informal(self):
        metric = self._make_metric()
        text = "I can't believe it's already Friday"
        score = metric._formality_score(text)
        assert score < 0.5, f"Text with contractions scored {score}"


class TestDetectRegister:
    """Register detection from text."""

    def _make_metric(self):
        return WritingStyleMetric(target_lang="eng")

    def test_formal_detection(self):
        metric = self._make_metric()
        assert metric._detect_register("Furthermore, we herein acknowledge") == "formal"

    def test_informal_detection(self):
        metric = self._make_metric()
        assert metric._detect_register("Hey, gonna grab some food, ok?") == "informal"

    def test_neutral_detection(self):
        metric = self._make_metric()
        assert metric._detect_register("The temperature is 72 degrees.") == "neutral"


# ---------------------------------------------------------------------------
# MetricPlugin compute()
# ---------------------------------------------------------------------------

class TestWritingStyleCompute:
    """Per-entry metric computation."""

    def test_basic_output(self):
        """compute() returns all expected keys."""
        metric = WritingStyleMetric(target_lang="eng")
        result = metric.compute({
            "predicted": "This is a translation.",
            "expected": "This is a reference.",
        })
        assert "style_register_match" in result
        assert "style_sentence_length_ratio" in result
        assert "style_formality_score" in result
        assert "style_verdict" in result
        assert "style_predicted_register" in result

    def test_no_register_target_is_undetermined(self):
        """Without corpus register or style profile, verdict is UNDETERMINED."""
        metric = WritingStyleMetric()
        result = metric.compute({
            "predicted": "Test output.",
            "expected": "Test reference.",
        })
        assert result["style_verdict"] == "UNDETERMINED"
        assert result["style_register_match"] is True  # No target = no mismatch

    def test_matching_formal_register(self):
        """Formal output matching formal corpus register → FORMAL_MATCH."""
        metric = WritingStyleMetric(target_lang="eng")
        result = metric.compute({
            "predicted": "Furthermore, we therefore respectfully acknowledge the following.",
            "expected": "Reference text.",
            "register": "formal",
        })
        assert result["style_verdict"] == "FORMAL_MATCH"
        assert result["style_register_match"] is True

    def test_mismatched_register(self):
        """Informal output against formal target → REGISTER_MISMATCH."""
        metric = WritingStyleMetric(target_lang="eng")
        result = metric.compute({
            "predicted": "Hey dude, wanna grab lunch? yeah ok cool",
            "expected": "Reference text.",
            "register": "formal",
        })
        assert result["style_verdict"] == "REGISTER_MISMATCH"
        assert result["style_register_match"] is False

    def test_sentence_length_ratio_similar(self):
        """Similar sentence lengths → ratio near 1.0."""
        metric = WritingStyleMetric()
        result = metric.compute({
            "predicted": "The cat sat on the mat.",
            "expected": "A dog ran in the park.",
        })
        ratio = result["style_sentence_length_ratio"]
        assert 0.8 <= ratio <= 1.2, f"Expected near 1.0, got {ratio}"

    def test_sentence_length_ratio_divergent(self):
        """Very different sentence lengths → high ratio."""
        metric = WritingStyleMetric()
        result = metric.compute({
            "predicted": "The cat sat on the mat and then it "
                         "walked across the room to the window.",
            "expected": "Short.",
        })
        ratio = result["style_sentence_length_ratio"]
        assert ratio > 1.5, f"Expected divergent ratio > 1.5, got {ratio}"

    def test_empty_predicted(self):
        """Empty predicted text doesn't crash."""
        metric = WritingStyleMetric()
        result = metric.compute({
            "predicted": "",
            "expected": "Some reference.",
        })
        assert result["style_formality_score"] is None  # No markers loaded without target_lang

    def test_empty_expected(self):
        """Empty reference text doesn't crash."""
        metric = WritingStyleMetric()
        result = metric.compute({
            "predicted": "Some output.",
            "expected": "",
        })
        assert isinstance(result["style_sentence_length_ratio"], float)


# ---------------------------------------------------------------------------
# Style profile integration
# ---------------------------------------------------------------------------

class TestStyleProfile:
    """Tests with explicit style profile configuration."""

    def test_profile_overrides_corpus_register(self):
        """Style profile target_register takes priority over corpus metadata."""
        profile = StyleProfile(target_register="informal")
        metric = WritingStyleMetric(style_profile=profile)
        result = metric.compute({
            "predicted": "Hey, what's up?",
            "expected": "Reference.",
            "register": "formal",  # Corpus says formal, profile says informal
        })
        # Profile wins — output is informal matching profile
        assert result["style_target_register"] == "informal"

    def test_prohibited_terms(self):
        """Prohibited terms are detected in output."""
        profile = StyleProfile(prohibited_terms=["gonna", "wanna"])
        metric = WritingStyleMetric(style_profile=profile)
        result = metric.compute({
            "predicted": "I'm gonna go now.",
            "expected": "Reference.",
        })
        assert "gonna" in result["style_prohibited_terms_found"]

    def test_required_terms_missing(self):
        """Required terms missing from output are flagged."""
        profile = StyleProfile(required_terms=["please", "kindly"])
        metric = WritingStyleMetric(style_profile=profile)
        result = metric.compute({
            "predicted": "Give me the report.",
            "expected": "Reference.",
        })
        assert "please" in result["style_required_terms_missing"]
        assert "kindly" in result["style_required_terms_missing"]

    def test_required_terms_present(self):
        """Required terms present in output → empty missing list."""
        profile = StyleProfile(required_terms=["please"])
        metric = WritingStyleMetric(style_profile=profile)
        result = metric.compute({
            "predicted": "Please review the document.",
            "expected": "Reference.",
        })
        assert result["style_required_terms_missing"] == []

    def test_from_dict(self):
        """StyleProfile.from_dict() handles all fields."""
        data = {
            "target_register": "formal",
            "max_sentence_length": 20,
            "prohibited_terms": ["yo", "dude"],
            "required_terms": ["sincerely"],
            "formality_level": "vous",
        }
        profile = StyleProfile.from_dict(data)
        assert profile.target_register == "formal"
        assert profile.max_sentence_length == 20
        assert "yo" in profile.prohibited_terms
        assert "sincerely" in profile.required_terms


# ---------------------------------------------------------------------------
# Aggregate metrics
# ---------------------------------------------------------------------------

class TestWritingStyleAggregate:
    """Corpus-level aggregation."""

    def test_all_match(self):
        """100% match → consistency rate = 1.0."""
        metric = WritingStyleMetric()
        results = [
            {"style_register_match": True, "style_sentence_length_ratio": 1.0,
             "style_formality_score": 0.7, "style_predicted_register": "formal"},
            {"style_register_match": True, "style_sentence_length_ratio": 0.9,
             "style_formality_score": 0.6, "style_predicted_register": "formal"},
        ]
        agg = metric.aggregate(results)
        assert agg["style_consistency_rate"] == pytest.approx(1.0)

    def test_partial_match(self):
        """50% match → consistency rate = 0.5."""
        metric = WritingStyleMetric()
        results = [
            {"style_register_match": True, "style_sentence_length_ratio": 1.0,
             "style_formality_score": 0.8, "style_predicted_register": "formal"},
            {"style_register_match": False, "style_sentence_length_ratio": 1.5,
             "style_formality_score": 0.2, "style_predicted_register": "informal"},
        ]
        agg = metric.aggregate(results)
        assert agg["style_consistency_rate"] == pytest.approx(0.5)

    def test_register_distribution(self):
        """Aggregate includes register distribution counts."""
        metric = WritingStyleMetric()
        results = [
            {"style_register_match": True, "style_sentence_length_ratio": 1.0,
             "style_formality_score": 0.5, "style_predicted_register": "formal"},
            {"style_register_match": True, "style_sentence_length_ratio": 1.0,
             "style_formality_score": 0.5, "style_predicted_register": "informal"},
            {"style_register_match": True, "style_sentence_length_ratio": 1.0,
             "style_formality_score": 0.5, "style_predicted_register": "formal"},
        ]
        agg = metric.aggregate(results)
        assert agg["style_register_distribution"]["formal"] == 2
        assert agg["style_register_distribution"]["informal"] == 1

    def test_empty_results(self):
        """Empty results return zeros."""
        metric = WritingStyleMetric()
        agg = metric.aggregate([])
        assert agg["style_consistency_rate"] == 0.0
