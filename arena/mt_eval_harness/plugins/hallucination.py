"""
Hallucination Rate Detector — MetricPlugin for the test harness.

Detects translation outputs that contain fabricated information not present
in the source text. Hallucinations in MT include:
    - Length inflation (output massively longer than input)
    - Repetitive/looping output (degenerate decoding)
    - Source echo (output is identical to input — no translation occurred)
    - Named entity fabrication (entities in output not in source)

Design:
    - All heuristics are deterministic and stdlib-only (re, collections).
    - Returns hallucination_rate on 0.0–1.0 scale (lower = better).
    - scoring.py inverts this: 0% hallucination → 1.0 (perfect).

Dependencies: Python stdlib only.

Source: SCORING_SPEC.md §4.3 — weighted 0.05 in both Profile A and B.
"""

# ---------------------------------------------------------------------------
# Design Justification & Validation Status
# ---------------------------------------------------------------------------
#
# VALIDATION STATUS: NOT HUMAN-VALIDATED
#
# These heuristics have NOT been validated against human hallucination
# judgments. They are engineering heuristics designed to catch gross
# failure modes observed in LLM MT output:
#
#   - Length inflation: NMT/LLM systems sometimes produce vastly longer
#     output than the source (degenerate beam search, repetitive padding).
#     Weight: 0.40 — highest because extreme length ratio is the cheapest
#     and most reliable hallucination signal (Raunak et al., 2021).
#
#   - Repetition: Looping decoder output ("the the the...") is a known
#     failure mode of autoregressive models. Weight: 0.30 — second highest
#     because n-gram repetition is unambiguous when present.
#
#   - Entity mismatch: Fabricated named entities are a hallucination type
#     documented in Guerreiro et al. (2023). Weight: 0.20 — lower because
#     our capitalization-based NER proxy has high false-positive rate,
#     especially for Cree (which has different capitalization conventions).
#
#   - Source echo: Model returns the source text unchanged — no translation
#     occurred. Weight: 0.10 — lowest because this is easily caught by
#     other metrics (exact_match_rate = 0, code_switching_rate ≈ 1.0).
#
# KNOWN LIMITATIONS:
#   - Cannot detect subtle semantic hallucinations (plausible but wrong
#     translations). This requires embedding-based methods (COMET-QE,
#     LABSE cross-lingual similarity) or LLM cross-checking.
#   - Entity mismatch uses capitalization as a proxy for NER — this will
#     miss hallucinated entities in non-Latin scripts and false-fire on
#     sentence-initial words.
#   - The 0.4/0.3/0.2/0.1 weights are engineering judgment, not empirically
#     derived. They should be recalibrated against labeled hallucination
#     data when available.
#
# UPGRADE PATH:
#   To add SOTA hallucination detection, implement a new plugin (e.g.,
#   EmbeddingHallucinationPlugin) that uses cross-lingual embeddings.
#   The MetricPlugin protocol supports multiple hallucination detectors
#   running in parallel — the scoring spec can be updated to prefer the
#   embedding-based detector when available.
#
# References:
#   - Raunak et al. (2021). "Curious Case of Hallucinations in NMT."
#   - Guerreiro et al. (2023). "Hallucinations in Large Multilingual
#     Translation Models." TACL.
# ---------------------------------------------------------------------------

from __future__ import annotations

import re
from collections import Counter

# Capitalization-based NER is a Latin-script proxy: it keys off ASCII uppercase
# letters. A source with none (Amharic, Arabic, Hindi, Chinese, Thai, … — the
# majority of the low-resource catalogue) has zero extractable "source entities"
# for a reason intrinsic to its script, not because it names nothing. See
# _entity_mismatch for why that distinction matters.
_LATIN_UPPER_RE = re.compile(r"[A-Z]")


# ---------------------------------------------------------------------------
# Detection heuristics
# ---------------------------------------------------------------------------

def _length_ratio(source: str, predicted: str) -> float:
    """Compute character-level length ratio.

    Returns a penalty score:
        0.0 if ratio is within normal bounds (0.5x–3.0x)
        Scales up to 1.0 for extreme inflation (>5x) or collapse (<0.2x)
    """
    src_len = len(source.strip())
    pred_len = len(predicted.strip())

    if src_len == 0:
        # Empty source — any non-trivial output is suspicious
        return 1.0 if pred_len > 10 else 0.0

    ratio = pred_len / src_len

    if 0.3 <= ratio <= 3.0:
        # Normal translation range — no penalty
        return 0.0
    elif ratio > 3.0:
        # Over-generation: linear penalty from 3x to 6x
        return min((ratio - 3.0) / 3.0, 1.0)
    else:
        # Under-generation: linear penalty from 0.3x to 0.0x
        return min((0.3 - ratio) / 0.3, 1.0)


def _repetition_score(predicted: str, n: int = 3) -> float:
    """Detect degenerate repetitive output.

    Computes the fraction of n-grams that are repeated. High repetition
    is a strong hallucination signal (looping decoder).

    Returns 0.0 (no repetition) to 1.0 (all n-grams repeated).
    """
    tokens = predicted.lower().split()
    if len(tokens) < n + 1:
        return 0.0

    ngrams: list[tuple[str, ...]] = []
    for i in range(len(tokens) - n + 1):
        ngrams.append(tuple(tokens[i : i + n]))

    if not ngrams:
        return 0.0

    counts = Counter(ngrams)
    repeated = sum(c - 1 for c in counts.values() if c > 1)
    total = len(ngrams)

    # Normalize: what fraction of n-gram slots are occupied by repeats?
    return min(repeated / total, 1.0) if total > 0 else 0.0


def _echo_detection(source: str, predicted: str) -> float:
    """Detect source echo — model returned the source text unchanged.

    Returns:
        1.0 if predicted is identical to source (no translation)
        0.5 if predicted is very similar to source (>80% character overlap)
        0.0 otherwise
    """
    src_norm = source.strip().lower()
    pred_norm = predicted.strip().lower()

    if not pred_norm:
        # Empty output is a different kind of failure, not hallucination
        return 0.0

    if src_norm == pred_norm:
        return 1.0

    # Character-level overlap check for near-echoes
    if not src_norm:
        return 0.0

    # Simple longest common subsequence ratio approximation
    # using set overlap (fast, not exact LCS but good enough)
    src_chars = Counter(src_norm)
    pred_chars = Counter(pred_norm)
    overlap = sum((src_chars & pred_chars).values())
    max_len = max(len(src_norm), len(pred_norm))

    if max_len == 0:
        return 0.0

    overlap_ratio = overlap / max_len
    if overlap_ratio > 0.85:
        return 0.5

    return 0.0


def _entity_mismatch(source: str, predicted: str) -> float:
    """Check if named entities in the output have no basis in the source.

    Extracts capitalized multi-letter sequences (rough NER) from both
    source and predicted. Entities in the prediction that don't appear
    in the source are potentially hallucinated.

    Returns 0.0–1.0 (fraction of predicted entities not in source).
    """
    # Skip when the SOURCE carries no Latin uppercase. Our entity proxy is
    # ASCII-capitalization-based, so a non-Latin source (Amharic, Arabic,
    # Hindi, Chinese, Thai, …) — or any all-lowercase source — extracts zero
    # source entities for a reason intrinsic to its script/casing, NOT because
    # it names nothing. Comparing a Latin-capitalized prediction against that
    # empty set would flag EVERY capitalized output word as fabricated
    # (entity_score → 1.0 → hallucination_rate ≥ 0.2 → falsely flagged),
    # contaminating run cards and the composite for the majority of languages.
    # The heuristic only has a valid basis for comparison when the source is
    # itself (at least partly) Latin-uppercase-bearing.
    if not _LATIN_UPPER_RE.search(source):
        return 0.0

    # Extract capitalized words (3+ chars) that are NOT at sentence start.
    # This is a rough heuristic — proper NER would require dependencies.
    entity_pattern = re.compile(r"\b[A-Z][a-zA-Z]{2,}\b")

    # Lowercase the first letter after a sentence boundary (or string start) so a
    # sentence-INITIAL capital (e.g. Spanish "Estamos") is not mistaken for a
    # fabricated proper-noun entity. Without this, a clean Latin-script
    # translation whose sentences start with a capital is flagged ~100%
    # hallucinated even at chrF++ 96 — the comment always claimed to exclude
    # these; now it actually does.
    def _strip_sentence_initial(text):
        return re.sub(
            r"(^|[.!?]['\"\)\]]?\s+)([A-Z])",
            lambda m: m.group(1) + m.group(2).lower(),
            text,
        )

    source_entities = set(e.lower() for e in entity_pattern.findall(_strip_sentence_initial(source)))
    pred_entities = set(e.lower() for e in entity_pattern.findall(_strip_sentence_initial(predicted)))

    if not pred_entities:
        return 0.0  # No entities to fabricate

    # Entities in prediction not present in source
    novel = pred_entities - source_entities
    if not novel:
        return 0.0

    return min(len(novel) / len(pred_entities), 1.0)


# ---------------------------------------------------------------------------
# Plugin class
# ---------------------------------------------------------------------------

class HallucinationPlugin:
    """MetricPlugin that detects hallucinated content in translation output.

    Combines four heuristic signals:
        - Length inflation (40% weight): output much longer than source
        - Repetition (30% weight): degenerate looping output
        - Entity mismatch (20% weight): fabricated named entities
        - Source echo (10% weight): model returned source unchanged

    Constructor args:
        length_weight: Weight for length inflation signal (default 0.4)
        repetition_weight: Weight for repetition signal (default 0.3)
        entity_weight: Weight for entity mismatch signal (default 0.2)
        echo_weight: Weight for source echo signal (default 0.1)
    """

    name = "hallucination"

    def __init__(
        self,
        length_weight: float = 0.4,
        repetition_weight: float = 0.3,
        entity_weight: float = 0.2,
        echo_weight: float = 0.1,
    ):
        self.length_weight = length_weight
        self.repetition_weight = repetition_weight
        self.entity_weight = entity_weight
        self.echo_weight = echo_weight

    def compute(self, entry: dict) -> dict:
        """Compute hallucination metrics for a single entry.

        Returns:
            Dict with:
                hallucination_rate: float 0.0–1.0 (weighted combination of
                    all signals). 0.0 = no hallucination (perfect).
                hall_length_score: float — length inflation signal
                hall_repetition_score: float — repetition signal
                hall_entity_score: float — entity mismatch signal
                hall_echo_score: float — source echo signal
        """
        source = entry.get("source", "")
        predicted = entry.get("predicted", "")

        if not predicted or not predicted.strip():
            # Empty prediction is not hallucination — it's a different error
            return {
                "hallucination_rate": 0.0,
                "hall_length_score": 0.0,
                "hall_repetition_score": 0.0,
                "hall_entity_score": 0.0,
                "hall_echo_score": 0.0,
            }

        length_score = _length_ratio(source, predicted)
        repetition_score = _repetition_score(predicted)
        entity_score = _entity_mismatch(source, predicted)
        echo_score = _echo_detection(source, predicted)

        # Weighted combination
        rate = (
            self.length_weight * length_score
            + self.repetition_weight * repetition_score
            + self.entity_weight * entity_score
            + self.echo_weight * echo_score
        )

        return {
            "hallucination_rate": round(min(rate, 1.0), 4),
            "hall_length_score": round(length_score, 4),
            "hall_repetition_score": round(repetition_score, 4),
            "hall_entity_score": round(entity_score, 4),
            "hall_echo_score": round(echo_score, 4),
        }

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Compute corpus-level hallucination aggregates.

        Returns:
            Dict with average rates and counts of flagged entries.
        """
        total = len(entry_results)
        if not total:
            return {}

        rates = [r.get("hallucination_rate", 0.0) for r in entry_results]
        flagged = sum(1 for r in rates if r > 0.1)  # Threshold for "flagged"

        return {
            "avg_hallucination_rate": round(sum(rates) / total, 4),
            "max_hallucination_rate": round(max(rates), 4),
            "entries_flagged_hallucination": flagged,
            "entries_flagged_hallucination_pct": round(flagged / total, 4),
            "avg_length_score": round(
                sum(r.get("hall_length_score", 0.0) for r in entry_results) / total, 4
            ),
            "avg_repetition_score": round(
                sum(r.get("hall_repetition_score", 0.0) for r in entry_results) / total, 4
            ),
            "avg_entity_score": round(
                sum(r.get("hall_entity_score", 0.0) for r in entry_results) / total, 4
            ),
        }
