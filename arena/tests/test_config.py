"""Tests for RunConfig defaults and validation.

Validates that the config module enforces language-agnostic defaults:
    - source_field defaults to 'source' (not 'english')
    - target_field defaults to 'target' (not 'cree_sro')
    - segment_names defaults to empty list (auto-detected from corpus)
    - max_tokens defaults to a reasonable general-purpose value
"""

import json

import pytest

from mt_eval_harness.config import (
    RunConfig,
    VALID_PARADIGMS,
    DEFAULT_PARADIGM,
    validate_method_card,
    load_method_card,
)


class TestRunConfigDefaults:
    """Verify defaults enforce language-agnostic behavior."""

    def test_source_field_default_is_source(self):
        """The source_field must default to 'source', not 'english'."""
        config = RunConfig()
        assert config.source_field == "source"

    def test_target_field_default_is_reference(self):
        """The target_field must default to 'reference', not any language-specific name."""
        config = RunConfig()
        assert config.target_field == "reference"

    def test_segment_names_default_empty(self):
        """Segment names should default to empty list for auto-detection."""
        config = RunConfig()
        assert config.segment_names == []

    def test_max_tokens_reasonable(self):
        """max_tokens should be a general-purpose value, not Cree-specific 13680."""
        config = RunConfig()
        assert config.max_tokens == 32768

    def test_dataset_default_all(self):
        config = RunConfig()
        assert config.dataset == "all"

    def test_batch_size_default_25(self):
        config = RunConfig()
        assert config.batch_size == 25


class TestRunConfigOverrides:
    """Verify that custom field names work for non-default corpora."""

    def test_custom_source_field(self):
        config = RunConfig(source_field="english")
        assert config.source_field == "english"

    def test_custom_target_field(self):
        config = RunConfig(target_field="cree_sro")
        assert config.target_field == "cree_sro"

    def test_custom_segment_names(self):
        names = ["gold_standard", "textbook_sample"]
        config = RunConfig(segment_names=names)
        assert config.segment_names == names

    def test_custom_max_tokens(self):
        config = RunConfig(max_tokens=13680)
        assert config.max_tokens == 13680


class TestCoachedPromptVersion:
    """'coached' is the auto-derived condition for coaching runs."""

    def test_coached_is_a_valid_builtin_version(self):
        config = RunConfig(prompt_version="coached", coaching_file="c.txt")
        errors = config.validate()
        assert not any("Unknown prompt_version" in e for e in errors)

    def test_coached_requires_a_coaching_source(self):
        config = RunConfig(prompt_version="coached")
        errors = config.validate()
        assert any("prompt_version='coached'" in e for e in errors)

    def test_coached_accepts_legacy_custom_prompt_path(self):
        config = RunConfig(prompt_version="coached", custom_prompt_path="p.txt")
        errors = config.validate()
        assert not any("prompt_version='coached'" in e for e in errors)


class TestMethodCardParadigm:
    """The paradigm axis is an optional, validated, orthogonal method-card field."""

    def _card(self, **over) -> dict:
        card = {"method_id": "m1", "name": "M1", "class": "pipeline"}
        card.update(over)
        return card

    def test_recommended_paradigms_are_present(self):
        # Guard the canonical value set against accidental edits.
        assert {
            "rule-based", "statistical", "neural-nmt",
            "llm", "hybrid", "human", "unknown",
        } <= VALID_PARADIGMS
        assert DEFAULT_PARADIGM == "unknown"

    def test_valid_paradigm_passes(self):
        assert validate_method_card(self._card(paradigm="rule-based")) == []

    def test_invalid_paradigm_is_reported(self):
        errors = validate_method_card(self._card(paradigm="quantum"))
        assert any("Invalid paradigm 'quantum'" in e for e in errors)

    def test_absent_paradigm_is_not_an_error(self):
        # Back-compat: a card with no paradigm must still validate (the axis
        # is additive). class is the only enum that's effectively required.
        assert validate_method_card(self._card()) == []

    def test_paradigm_does_not_mask_class_errors(self):
        errors = validate_method_card(self._card(**{"class": "bogus"}, paradigm="llm"))
        assert any("Invalid class 'bogus'" in e for e in errors)

    def test_load_defaults_absent_paradigm_to_unknown(self, tmp_path, caplog):
        path = tmp_path / "mc.json"
        path.write_text(json.dumps(self._card()), encoding="utf-8")
        card = load_method_card(path)
        assert card["paradigm"] == DEFAULT_PARADIGM
        # warns (does not fail) so the author knows it's uncategorized.
        assert any("paradigm" in r.message.lower() for r in caplog.records)

    def test_load_preserves_declared_paradigm(self, tmp_path):
        path = tmp_path / "mc.json"
        path.write_text(
            json.dumps(self._card(paradigm="neural-nmt")), encoding="utf-8"
        )
        assert load_method_card(path)["paradigm"] == "neural-nmt"

    def test_load_rejects_invalid_paradigm(self, tmp_path):
        path = tmp_path / "mc.json"
        path.write_text(
            json.dumps(self._card(paradigm="nope")), encoding="utf-8"
        )
        with pytest.raises(ValueError, match="Invalid paradigm"):
            load_method_card(path)
