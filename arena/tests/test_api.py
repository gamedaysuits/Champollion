"""Tests for api.py -- load_api_key() and clean_response().

Key behaviors validated:
    - load_api_key() reads from env var first, then .env.local, then .env
    - load_api_key() raises RuntimeError when no key found
    - clean_response() does NOT strip trailing periods (data integrity)
    - clean_response() returns first line by default (no reasoning filter)
    - clean_response() filters reasoning lines ONLY with explicit patterns
    - clean_response() accepts custom reasoning_patterns parameter
"""

import os
from unittest.mock import patch

import pytest

from mt_eval_harness.api import clean_response, load_api_key, ENGLISH_REASONING_PATTERNS


# ---------------------------------------------------------------------------
# load_api_key tests
# ---------------------------------------------------------------------------

class TestLoadApiKey:
    """Verify API key loading respects the priority chain."""

    def test_loads_from_env_var(self):
        """Environment variable should take precedence."""
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-123"}):
            assert load_api_key() == "sk-test-123"

    def test_raises_when_no_key(self, tmp_path, monkeypatch):
        """Should raise RuntimeError with clear message when key is missing."""
        # Clear the env var so load_api_key doesn't find it there
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        # Patch dotenv.find_dotenv to return empty string (no .env file)
        with patch("dotenv.find_dotenv", return_value=""):
            with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY not found"):
                load_api_key()

    def test_env_var_overrides_file(self, tmp_path):
        """Env var should win even if .env.local exists."""
        env_file = tmp_path / ".env.local"
        env_file.write_text("OPENROUTER_API_KEY=sk-from-file")
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-from-env"}):
            assert load_api_key() == "sk-from-env"


# ---------------------------------------------------------------------------
# clean_response tests
# ---------------------------------------------------------------------------

class TestCleanResponse:
    """Verify response cleaning is language-agnostic and non-destructive."""

    def test_empty_string(self):
        assert clean_response("") == ""

    def test_single_line_passthrough(self):
        """Single-line responses should pass through unchanged."""
        assert clean_response("Bonjour") == "Bonjour"

    def test_preserves_trailing_period(self):
        """Trailing periods are legitimate data — must NOT be stripped.

        This was a data-corruption bug identified in the roast.
        Sentences like 'niwâpahtên atim.' would lose their final period,
        causing false negatives on exact-match comparisons.
        """
        assert clean_response("niwâpahtên atim.") == "niwâpahtên atim."

    def test_preserves_trailing_period_multichar(self):
        """Verify period preservation in longer content."""
        assert clean_response("This is a sentence.") == "This is a sentence."

    def test_strips_markdown_bold(self):
        """Markdown bold wrapping should be removed."""
        assert clean_response("**Bonjour**") == "Bonjour"

    def test_strips_quotes(self):
        assert clean_response('"Bonjour"') == "Bonjour"

    def test_strips_backticks(self):
        assert clean_response("`Bonjour`") == "Bonjour"

    def test_multiline_default_returns_first_line(self):
        """P0 Fix: Default behavior returns first line — no implicit filtering.

        The old behavior silently filtered lines matching English reasoning
        patterns, which caused data corruption for Latin-script target
        languages (e.g., stripping 'the ' from legitimate translations).
        """
        content = "Let me translate this.\nBonjour."
        assert clean_response(content) == "Let me translate this."

    def test_multiline_with_english_patterns_skips_reasoning(self):
        """With ENGLISH_REASONING_PATTERNS, reasoning lines ARE filtered."""
        content = "Let me translate this.\nBonjour."
        assert clean_response(content, reasoning_patterns=ENGLISH_REASONING_PATTERNS) == "Bonjour."

    def test_multiline_all_reasoning_returns_last(self):
        """With patterns: if all lines look like reasoning, return last line."""
        content = "Let me think about this.\nFirst, I need to consider...\nThe answer is complex."
        result = clean_response(content, reasoning_patterns=ENGLISH_REASONING_PATTERNS)
        assert result == "The answer is complex."

    def test_custom_reasoning_patterns(self):
        """Users should be able to inject custom reasoning patterns."""
        content = "NOTA: esto es una nota.\nBonjour."
        # Default patterns won't catch "NOTA:"
        assert clean_response(content) == "NOTA: esto es una nota."
        # Custom patterns should
        assert clean_response(content, reasoning_patterns=["nota:"]) == "Bonjour."

    def test_empty_reasoning_patterns_disables_filtering(self):
        """Passing empty list should disable all reasoning filtering."""
        content = "Let me translate this.\nBonjour."
        # With empty patterns, no lines are filtered — first line wins
        assert clean_response(content, reasoning_patterns=[]) == "Let me translate this."

    def test_non_latin_script_passthrough(self):
        """Non-Latin scripts should never be mistaken for reasoning."""
        assert clean_response("こんにちは") == "こんにちは"

    def test_syllabics_passthrough(self):
        """Cree syllabics should pass through untouched."""
        assert clean_response("ᑖᓂᓯ") == "ᑖᓂᓯ"
