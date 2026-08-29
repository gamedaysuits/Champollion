"""A harness-protocol MetricPlugin test double, LYSS-shaped.

Mirrors champollion_lyss.crk.metrics.CrkLinterMetric's contract: per-entry
verdicts, an aggregate with a numeric rate + metadata dicts, and an
importable ``module:Class`` address (used by config/CLI plugin-loading
tests). Equivalence rule: exact match, or differing only by ā↔â (the
long-vowel convention class).
"""

_MACRON = str.maketrans("āēīōū", "âêîôû")


class FakeLint:
    name = "fake_lint"
    compute_calls = 0  # class-level: tests assert compute() ran once per entry

    def compute(self, entry: dict) -> dict:
        type(self).compute_calls += 1
        predicted = (entry.get("predicted") or "").strip()
        expected = (entry.get("expected") or "").strip()
        if predicted == expected:
            return {"verdict": "EXACT", "equivalent": True, "classes": []}
        if predicted.translate(_MACRON) == expected.translate(_MACRON):
            return {"verdict": "EQUIVALENT", "equivalent": True,
                    "classes": ["LONG_VOWEL_MACRON"]}
        return {"verdict": "MISS", "equivalent": False, "classes": []}

    def aggregate(self, entry_results: list[dict]) -> dict:
        total = len(entry_results)
        counts: dict[str, int] = {}
        for r in entry_results:
            for c in r.get("classes", []):
                counts[c] = counts.get(c, 0) + 1
        return {
            "display_name": "Fake LYSS Linter",
            "equivalent_match_rate": (
                sum(1 for r in entry_results if r["equivalent"]) / total
                if total else 0.0
            ),
            "variant_class_counts": counts,
            "scored_count": total,
        }


class AlwaysUnavailable:
    """Fail-honest double: prerequisites missing → no numbers, a reason."""

    name = "unavailable_metric"

    def compute(self, entry: dict) -> dict:
        return {"available": False}

    def aggregate(self, entry_results: list[dict]) -> dict:
        return {"available": False,
                "reason": "FST not installed — run `mt-eval setup --lang crk`"}
