"""Tests for corpus loading and segment auto-detection.

Key behaviors validated:
    - load_corpus reads from default 'source'/'target' fields
    - load_corpus works with custom field names via config overrides
    - Segment auto-detection discovers segment names from corpus
    - Dataset filtering works: 'all', segment name, ID range, single ID
    - Explicit entry_ids override dataset filter
    - Missing corpus raises FileNotFoundError
    - Unknown dataset filter raises ValueError
"""

import json

import pytest

from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import load_corpus


class TestCorpusLoading:
    """Verify corpus loading with default and custom field names."""

    def test_loads_all_entries(self, sample_corpus):
        config = RunConfig(corpus_path=sample_corpus, dataset="all")
        corpus, _ = load_corpus(config)
        assert len(corpus) == 5

    def test_default_fields_readable(self, sample_corpus):
        """Entries should have 'source' and 'target' fields by default."""
        config = RunConfig(corpus_path=sample_corpus)
        corpus, _ = load_corpus(config)
        assert corpus[0]["source"] == "Hello."
        assert corpus[0]["target"] == "Bonjour."

    def test_custom_fields(self, custom_field_corpus):
        """Custom field names should work with source_field override."""
        config = RunConfig(
            corpus_path=custom_field_corpus,
            source_field="english",
            target_field="cree_sro",
        )
        corpus, _ = load_corpus(config)
        assert len(corpus) == 2
        # Entries have the custom field names
        assert corpus[0]["english"] == "Hello."
        assert corpus[0]["cree_sro"] == "tânisi."

    def test_missing_corpus_raises(self, tmp_path):
        config = RunConfig(corpus_path=str(tmp_path / "nonexistent.json"))
        with pytest.raises(FileNotFoundError):
            load_corpus(config)

    def test_no_corpus_path_raises(self):
        config = RunConfig(corpus_path=None)
        with pytest.raises(FileNotFoundError, match="No corpus specified"):
            load_corpus(config)


class TestSegmentAutoDetection:
    """Verify segment names are auto-detected from corpus data."""

    def test_auto_detects_segments(self, sample_corpus, capsys):
        """When segment_names is empty, segments should be auto-detected."""
        config = RunConfig(
            corpus_path=sample_corpus,
            segment_names=[],  # Trigger auto-detection
        )
        corpus, _ = load_corpus(config)
        captured = capsys.readouterr()
        assert "Auto-detected segments" in captured.out
        assert "basic" in captured.out

    def test_filter_by_detected_segment(self, sample_corpus):
        """Should be able to filter by auto-detected segment name."""
        config = RunConfig(
            corpus_path=sample_corpus,
            dataset="basic",
            segment_names=[],  # Auto-detect
        )
        corpus, _ = load_corpus(config)
        assert len(corpus) == 2
        assert all(e["segment"] == "basic" for e in corpus)

    def test_explicit_segments_skip_detection(self, sample_corpus, capsys):
        """When segment_names is explicitly provided, skip auto-detection."""
        config = RunConfig(
            corpus_path=sample_corpus,
            segment_names=["basic", "intermediate"],
        )
        load_corpus(config)  # returns tuple; we only care about side-effects
        captured = capsys.readouterr()
        assert "Auto-detected" not in captured.out


class TestDatasetFiltering:
    """Verify dataset filter modes work correctly."""

    def test_filter_all(self, sample_corpus):
        config = RunConfig(corpus_path=sample_corpus, dataset="all")
        corpus, _ = load_corpus(config)
        assert len(corpus) == 5

    def test_filter_by_segment(self, sample_corpus):
        config = RunConfig(
            corpus_path=sample_corpus,
            dataset="intermediate",
            segment_names=[],  # Auto-detect
        )
        corpus, _ = load_corpus(config)
        assert len(corpus) == 2
        assert all(e["segment"] == "intermediate" for e in corpus)

    def test_filter_by_id_range(self, sample_corpus):
        config = RunConfig(corpus_path=sample_corpus, dataset="1-3")
        corpus, _ = load_corpus(config)
        assert len(corpus) == 3
        assert [e["id"] for e in corpus] == [1, 2, 3]

    def test_filter_by_single_id(self, sample_corpus):
        config = RunConfig(corpus_path=sample_corpus, dataset="2")
        corpus, _ = load_corpus(config)
        assert len(corpus) == 1
        assert corpus[0]["id"] == 2

    def test_explicit_entry_ids(self, sample_corpus):
        config = RunConfig(corpus_path=sample_corpus, entry_ids=[0, 4])
        corpus, _ = load_corpus(config)
        assert len(corpus) == 2
        assert {e["id"] for e in corpus} == {0, 4}

    def test_unknown_dataset_raises(self, sample_corpus):
        config = RunConfig(corpus_path=sample_corpus, dataset="nonexistent")
        with pytest.raises(ValueError, match="Unknown dataset filter"):
            load_corpus(config)
