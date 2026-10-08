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
    - The corpus figure is the scoring spec's definition, "the proportion of
      prescribed terminology terms that appear in the output": glossary-term
      occurrences matched / glossary-term occurrences in the sources, pooled
      over the corpus. An entry whose source contains no glossary term has
      nothing to adhere to and is EXCLUDED (per-entry None), never counted
      as a perfect 1.0.

      Until 2026-10-03 every such entry scored 1.0 and the corpus figure was
      the mean of the per-entry rates, so a run that matched 0 of 127 terms
      headlined "37.3% adherence" — the value contradicted its own counts
      (synthetic hospital + researcher personas, Round 3). An empty output
      for a source containing terms also scored 1.0; its terms now all miss.

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
                terminology_adherence: float 0.0–1.0, or None when there is
                    nothing to measure — no glossary configured, or no
                    glossary term occurs in this entry's source (the entry is
                    excluded from the corpus figure, not scored 1.0).
                    1.0 = all glossary terms in the source were translated.
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

        source = entry.get("source", "") or ""
        predicted = entry.get("predicted", "") or ""

        # Prepare text for matching. An EMPTY prediction is still checked:
        # every glossary term in its source is a miss (it used to score 1.0).
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

        # No glossary term in this source → nothing to adhere to: excluded
        # from the corpus figure (None), not a perfect 1.0.
        adherence = round(matches / total, 4) if total else None

        return {
            "terminology_adherence": adherence,
            "term_matches": matches,
            "term_total": total,
            "term_misses": misses,
        }

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Corpus-level terminology adherence.

        ``avg_terminology_adherence`` is THE published value (the key the
        metric registry names for the ``terminology_adherence`` column). It
        is the pooled proportion ``total_term_matches / total_term_total``
        over the entries whose source contains a glossary term — the spec's
        "proportion of prescribed terminology terms that appear in the
        output" — and None when no glossary term occurred anywhere (or no
        glossary was configured). The key keeps its historical name; since
        2026-10-03 its value is no longer a mean of per-entry rates (which
        counted every term-free entry as 1.0). The counts are reported
        beside it so the headline can always be checked against them.
        """
        scored = [r for r in entry_results if isinstance(r, dict)
                  and not r.get("error")]
        with_terms = [r for r in scored if (r.get("term_total") or 0) > 0]
        total_matches = sum(r.get("term_matches", 0) for r in with_terms)
        total_terms = sum(r.get("term_total", 0) for r in with_terms)

        # Count most-missed terms across the corpus
        miss_counts: dict[str, int] = {}
        for r in with_terms:
            for term in r.get("term_misses", []):
                miss_counts[term] = miss_counts.get(term, 0) + 1
        top_misses = sorted(miss_counts.items(), key=lambda x: x[1],
                            reverse=True)[:10]

        out = {
            "avg_terminology_adherence": (
                round(total_matches / total_terms, 4) if total_terms else None),
            "total_term_matches": total_matches,
            "total_term_total": total_terms,
            "total_term_misses": total_terms - total_matches,
            # Entries the figure is computed over / left out because their
            # source contains no glossary term (nothing to adhere to). With
            # no glossary at all nothing was left out — the metric is off.
            "entries_with_terms": len(with_terms),
            "entries_without_terms": (
                len(scored) - len(with_terms)
                if (self._glossary or with_terms) else 0),
            # 0 = no glossary configured (metric inactive) — tells "inactive"
            # apart from "glossary given, but no term occurs in any source".
            "glossary_size": len(self._glossary or {}),
            "most_missed_terms": [
                {"term": term, "miss_count": count}
                for term, count in top_misses
            ],
        }
        return out


def corpus_adherence(aggregate: dict | None) -> float | None:
    """The published terminology adherence of a plugin aggregate, read from
    its COUNTS when it has them (matched / total glossary-term occurrences),
    else its ``avg_terminology_adherence``.

    Reading the counts makes a report written before the 2026-10-03 fix —
    whose ``avg_terminology_adherence`` was a mean of per-entry rates with
    every term-free entry counted as 1.0 — publish and display the value its
    own counts support. None = nothing measured (no glossary, or no glossary
    term in any source).
    """
    if not isinstance(aggregate, dict) or aggregate.get("error"):
        return None
    total = aggregate.get("total_term_total")
    matches = aggregate.get("total_term_matches")
    if isinstance(total, int) and isinstance(matches, int):
        return round(matches / total, 4) if total > 0 else None
    value = aggregate.get("avg_terminology_adherence")
    return value if isinstance(value, (int, float)) else None


def adherence_label(aggregate: dict | None) -> str | None:
    """'0.0% (0 of 127 glossary terms matched; 41 entries had none)' — the
    headline with the counts it is computed from, or None when the plugin
    did not run. Shared by the run card and the test summary."""
    if not isinstance(aggregate, dict) or aggregate.get("error"):
        return None
    value = corpus_adherence(aggregate)
    total = aggregate.get("total_term_total") or 0
    matches = aggregate.get("total_term_matches") or 0
    without = aggregate.get("entries_without_terms")
    if value is None:
        if aggregate.get("glossary_size"):
            return "not measured — no glossary term occurs in any source"
        return "no glossary (inactive)"
    label = f"{value:.1%} ({matches} of {total} glossary terms matched"
    if without:
        label += (f"; {without} entr{'y' if without == 1 else 'ies'} "
                  "without a glossary term excluded")
    return label + ")"
