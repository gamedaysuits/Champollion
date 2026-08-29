"""
MetricPlugin Protocol — Register custom evaluation metrics.

The test harness ships with generic metrics (exact match, chrF++, BLEU).
Language-specific metrics (morphological validation, linting, semantic
overlap) are registered as MetricPlugin instances by the consuming project.

Example:
    class MorphologyMetric:
        name = "morphology"

        def compute(self, entry: dict) -> dict:
            predicted = entry.get("predicted", "")
            words = predicted.split()
            valid = sum(1 for w in words if my_analyzer.check(w))
            return {
                "morph_total_words": len(words),
                "morph_valid_words": valid,
                "morph_validity_rate": valid / max(len(words), 1),
            }

        def aggregate(self, entry_results: list[dict]) -> dict:
            rates = [r["morph_validity_rate"] for r in entry_results]
            return {"avg_morph_validity": sum(rates) / max(len(rates), 1)}
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class MetricPlugin(Protocol):
    """Protocol for pluggable evaluation metrics.

    Each plugin computes per-entry metrics and optionally aggregates
    them into corpus-level summaries.
    """

    name: str
    """Unique identifier for this metric (e.g. 'morphology')."""

    def compute(self, entry: dict) -> dict:
        """Compute metrics for a single entry.

        Args:
            entry: Dict containing at minimum:
                - 'source': str — the source text (normalized by pipeline)
                - 'expected': str — the reference translation
                - 'predicted': str — the model's translation
                Any additional fields from the corpus entry are also present.

        Returns:
            Dict of metric_name -> value pairs. These are merged into
            the per-entry results in the TestReport.
        """
        ...

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Compute corpus-level aggregates from per-entry results.

        Args:
            entry_results: List of dicts returned by compute() across
                all entries in the corpus.

        Returns:
            Dict of aggregate_metric_name -> value pairs. These are
            merged into the 'overall' section of the TestReport.

        Default implementation returns an empty dict (per-entry only).
        """
        ...
