"""
Terminology Adherence Checker — MetricPlugin for the test harness.

Checks whether domain-specific terms from a glossary are correctly translated.
This is especially important for technical, medical, legal, and cultural
terminology where specific translations have been established by community
consensus or industry convention.

Design:
    - Constructor takes an optional glossary mapping source terms to acceptable
      target translations.
    - If no glossary is provided, returns None for the metric (unavailable).
    - For each glossary term found in the source text, checks if any acceptable
      translation appears in the predicted output.
    - Returns terminology_adherence on 0.0–1.0 scale (higher = better).

Dependencies: Python stdlib only (re).

Source: SCORING_SPEC.md §4.3 — weighted 0.05 in both Profile A and B.
"""

from __future__ import annotations

import re


class TerminologyPlugin:
    """MetricPlugin that checks glossary term translation consistency.

    Constructor args:
        glossary: Dict mapping source terms (case-insensitive) to lists of
            acceptable target translations. Example::

                {
                    "user": ["utilisateur", "utilisatrice"],
                    "settings": ["paramètres", "réglages"],
                    "Plains Cree": ["nêhiyawêwin"],
                }

            If None or empty, the plugin reports null metrics (metric is
            unavailable and will not affect the composite score).

        case_sensitive: If True, glossary matching is case-sensitive.
            Default: False (case-insensitive matching).
    """

    name = "terminology"

    def __init__(
        self,
        glossary: dict[str, list[str]] | None = None,
        case_sensitive: bool = False,
    ):
        self.case_sensitive = case_sensitive

        if glossary:
            if case_sensitive:
                self._glossary = {k: v for k, v in glossary.items()}
            else:
                # Normalize keys and values for case-insensitive matching
                self._glossary = {
                    k.lower(): [t.lower() for t in v]
                    for k, v in glossary.items()
                }
        else:
            self._glossary = None

    def compute(self, entry: dict) -> dict:
        """Compute terminology adherence for a single entry.

        Returns:
            Dict with:
                terminology_adherence: float 0.0–1.0 or None if no glossary.
                    1.0 = all glossary terms correctly translated (perfect).
                    None = glossary not configured (metric unavailable).
                term_matches: int — count of correctly translated terms
                term_total: int — total glossary terms found in source
                term_misses: list[str] — source terms not found in output
        """
        if self._glossary is None:
            return {
                "terminology_adherence": None,
                "term_matches": 0,
                "term_total": 0,
                "term_misses": [],
            }

        source = entry.get("source", "")
        predicted = entry.get("predicted", "")

        if not source or not predicted:
            return {
                "terminology_adherence": 1.0,  # No terms to violate
                "term_matches": 0,
                "term_total": 0,
                "term_misses": [],
            }

        # Prepare text for matching
        if self.case_sensitive:
            source_text = source
            pred_text = predicted
        else:
            source_text = source.lower()
            pred_text = predicted.lower()

        # Find glossary terms present in the source
        matches = 0
        total = 0
        misses: list[str] = []

        for source_term, target_translations in self._glossary.items():
            # Check if this glossary term appears in the source
            # Use word boundary matching to avoid partial matches
            pattern = re.compile(
                r"\b" + re.escape(source_term) + r"\b",
                flags=0 if self.case_sensitive else re.IGNORECASE,
            )
            if not pattern.search(source_text):
                continue  # Term not in this source sentence

            total += 1

            # Check if any acceptable translation appears in the output
            found = False
            for translation in target_translations:
                if translation in pred_text:
                    found = True
                    break

            if found:
                matches += 1
            else:
                misses.append(source_term)

        # Compute adherence rate
        if total == 0:
            adherence = 1.0  # No glossary terms in source → nothing to violate
        else:
            adherence = matches / total

        return {
            "terminology_adherence": round(adherence, 4),
            "term_matches": matches,
            "term_total": total,
            "term_misses": misses,
        }

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Compute corpus-level terminology adherence aggregates.

        Only aggregates entries where the metric was available (not None).

        Returns:
            Dict with average adherence, total matches/misses, and
            most-missed terms.
        """
        # Filter to entries with available metrics
        available = [
            r for r in entry_results
            if r.get("terminology_adherence") is not None
        ]

        if not available:
            return {
                "avg_terminology_adherence": None,
                "total_term_matches": 0,
                "total_term_total": 0,
                "total_term_misses": 0,
            }

        total_entries = len(available)
        rates = [r["terminology_adherence"] for r in available]
        total_matches = sum(r.get("term_matches", 0) for r in available)
        total_terms = sum(r.get("term_total", 0) for r in available)

        # Count most-missed terms across the corpus
        miss_counts: dict[str, int] = {}
        for r in available:
            for term in r.get("term_misses", []):
                miss_counts[term] = miss_counts.get(term, 0) + 1

        # Top 10 most-missed terms
        top_misses = sorted(miss_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "avg_terminology_adherence": round(sum(rates) / total_entries, 4),
            "total_term_matches": total_matches,
            "total_term_total": total_terms,
            "total_term_misses": total_terms - total_matches,
            "corpus_term_adherence": round(
                total_matches / total_terms, 4
            ) if total_terms > 0 else None,
            "most_missed_terms": [
                {"term": term, "miss_count": count}
                for term, count in top_misses
            ],
        }
