"""Tests for cache.py — ResultCache isolation and integrity.

Key behaviors validated:
    - Cache provides None on miss
    - Cache returns exact stored result on hit
    - Different configs produce isolated caches (no cross-contamination)
    - Cache respects enabled/disabled flag
"""

import json
import tempfile
from pathlib import Path

import pytest

from mt_eval_harness.cache import ResultCache
from mt_eval_harness.config import RunConfig


class TestCacheBasics:
    """Verify fundamental cache get/put behavior."""

    def test_miss_returns_none(self, tmp_path):
        config = RunConfig(cache_dir=str(tmp_path / "cache"))
        cache = ResultCache(config)
        assert cache.get("never seen this") is None

    def test_hit_returns_stored(self, tmp_path):
        config = RunConfig(cache_dir=str(tmp_path / "cache"))
        cache = ResultCache(config)
        result = {"id": 0, "predicted": "Bonjour.", "latency_s": 0.5}
        cache.put("Hello.", result)
        retrieved = cache.get("Hello.")
        assert retrieved is not None
        assert retrieved["predicted"] == "Bonjour."

    def test_different_inputs_isolated(self, tmp_path):
        config = RunConfig(cache_dir=str(tmp_path / "cache"))
        cache = ResultCache(config)
        cache.put("Hello.", {"predicted": "Bonjour."})
        cache.put("Goodbye.", {"predicted": "Au revoir."})
        assert cache.get("Hello.")["predicted"] == "Bonjour."
        assert cache.get("Goodbye.")["predicted"] == "Au revoir."


class TestCacheIsolation:
    """Verify different configs produce separate cache namespaces."""

    def test_different_models_isolated(self, tmp_path):
        """Changing the model should not reuse cached results."""
        cache_dir = str(tmp_path / "cache")
        config_a = RunConfig(cache_dir=cache_dir, model="gemini-3.1-pro")
        config_b = RunConfig(cache_dir=cache_dir, model="claude-4-sonnet")

        cache_a = ResultCache(config_a)
        cache_a.put("Hello.", {"predicted": "Bonjour from gemini."})

        cache_b = ResultCache(config_b)
        # Different model should NOT see gemini's cached result
        assert cache_b.get("Hello.") is None

    def test_same_config_shares_cache(self, tmp_path):
        """Same config should reuse cached results."""
        cache_dir = str(tmp_path / "cache")
        config = RunConfig(cache_dir=cache_dir, model="gemini-3.1-pro")

        cache_1 = ResultCache(config)
        cache_1.put("Hello.", {"predicted": "Bonjour."})

        cache_2 = ResultCache(config)
        assert cache_2.get("Hello.") is not None


class TestCacheDisabled:
    """Verify cache respects the enabled flag."""

    def test_disabled_cache_always_misses(self, tmp_path):
        config = RunConfig(
            cache_dir=str(tmp_path / "cache"),
            cache_enabled=False,
        )
        cache = ResultCache(config)
        cache.put("Hello.", {"predicted": "Bonjour."})
        assert cache.get("Hello.") is None
