"""
Writing Style Consistency — MetricPlugin for the test harness.

Measures whether translations match a target writing style in terms of
register, sentence structure, and vocabulary. This is an INFORMATIONAL
metric — it is NOT part of the composite score. A translation can be
correct but in the wrong register (e.g., using informal language for a
legal document).

Design:
    Per-entry metrics:
      - style_register_match: boolean — does the predicted text match the
        expected register level (if the corpus specifies one)?
      - style_sentence_length_ratio: float — ratio of predicted avg sentence
        length to reference avg (1.0 = perfect match, divergence = style drift)
      - style_formality_score: float 0.0–1.0 — presence of formal/informal
        markers in the output (T-V pronouns, contractions, etc.)

    Aggregate metrics:
      - style_consistency_rate: float 0.0–1.0 — fraction of entries with
        matching style (no register mismatch detected)

    Per-entry verdict:
      - FORMAL_MATCH: output matches the formal register target
      - INFORMAL_MATCH: output matches the informal register target
      - REGISTER_MISMATCH: output register doesn't match target
      - UNDETERMINED: no register target specified or insufficient data

Dependencies: Python stdlib only (re).

Source: README comparison table, "Custom style metrics + brand voice prompt tuning."
This metric is NOT in the composite score (SCORING_SPEC §2.5 informational only).
"""

from __future__ import annotations

import json
import logging
import math
import re
from pathlib import Path
from typing import Optional

from mt_eval_harness.language_cards import get_card

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Per-language formality marker loading
# ---------------------------------------------------------------------------

_RESOURCES_DIR = Path(__file__).parent / "resources" / "formality"


def _load_formality_markers(lang_code: str) -> dict | None:
    """Load per-language formality markers from resource files.

    Returns dict with 'formalMarkers', 'informalMarkers', and optional
    'contractionPattern', or None if no resource file exists for this language.

    Marker resource files live in plugins/resources/formality/{code}.json.
    To add formality analysis for a new language, create a resource file
    and set metricPlugins.formalityMarkers: true on the language card.
    """
    resource_path = _RESOURCES_DIR / f"{lang_code}.json"
    if not resource_path.exists():
        return None
    try:
        with open(resource_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Failed to load formality markers for %s: %s", lang_code, e)
        return None


# ---------------------------------------------------------------------------
# Style profile (optional external config)
# ---------------------------------------------------------------------------

class StyleProfile:
    """Configuration for target writing style expectations.

    Loaded from a JSON file via --style-profile CLI flag, or inferred
    from corpus metadata (register field).

    Fields:
        target_register: Expected register level ("formal", "informal",
                         "neutral", or None for auto-detect)
        max_sentence_length: Max words per sentence (style guideline)
        prohibited_terms: Words that violate brand voice
        required_terms: Words expected in brand-appropriate output
        formality_level: For T-V languages — expected pronoun form
    """

    def __init__(
        self,
        target_register: Optional[str] = None,
        max_sentence_length: Optional[int] = None,
        prohibited_terms: Optional[list[str]] = None,
        required_terms: Optional[list[str]] = None,
        formality_level: Optional[str] = None,
    ):
        self.target_register = target_register
        self.max_sentence_length = max_sentence_length
        self.prohibited_terms = set(prohibited_terms or [])
        self.required_terms = set(required_terms or [])
        self.formality_level = formality_level

    @classmethod
    def from_dict(cls, data: dict) -> "StyleProfile":
        return cls(
            target_register=data.get("target_register"),
            max_sentence_length=data.get("max_sentence_length"),
            prohibited_terms=data.get("prohibited_terms"),
            required_terms=data.get("required_terms"),
            formality_level=data.get("formality_level"),
        )


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _sentence_count(text: str) -> int:
    """Count sentences using simple punctuation splitting.

    Not linguistically perfect — but consistent across entries,
    which is what matters for relative comparison.
    """
    if not text.strip():
        return 0
    # Split on sentence-ending punctuation followed by whitespace or end
    sentences = re.split(r'[.!?]+(?:\s|$)', text.strip())
    # Filter out empty strings from split
    return max(len([s for s in sentences if s.strip()]), 1)


def _avg_sentence_length(text: str) -> float:
    """Average words per sentence."""
    words = text.split()
    sentences = _sentence_count(text)
    if sentences == 0:
        return 0.0
    return len(words) / sentences


# NOTE: _formality_score and _detect_register used to be module-level
# functions using hardcoded marker sets. They are now methods on
# WritingStyleMetric since they depend on per-instance loaded markers.


# ---------------------------------------------------------------------------
# MetricPlugin implementation
# ---------------------------------------------------------------------------

class WritingStyleMetric:
    """Writing style consistency metric plugin.

    Measures register consistency, sentence length similarity, and
    formality alignment between predicted translations and references.

    This metric is INFORMATIONAL — it does NOT enter the composite score.
    It enables enterprise users to filter the leaderboard by methods
    that match their brand voice or required register.

    Usage:
        # Auto-detect style from corpus register field
        metric = WritingStyleMetric()

        # Or provide explicit style expectations
        profile = StyleProfile(target_register="formal")
        metric = WritingStyleMetric(style_profile=profile)
    """

    name = "writing_style"

    def __init__(
        self,
        style_profile: Optional[StyleProfile] = None,
        target_lang: Optional[str] = None,
    ):
        self.style_profile = style_profile
        self.target_lang = target_lang

        # Formality analysis is available when:
        # 1. The language card declares a formality system, AND
        # 2. A marker resource file exists for this language
        self._markers = None
        self._contraction_re = None

        if target_lang:
            card = get_card(target_lang)
            has_formality_system = card is not None and card.get("formality") is not None
            if has_formality_system:
                self._markers = _load_formality_markers(target_lang)

        if self._markers and self._markers.get("contractionPattern"):
            self._contraction_re = re.compile(
                self._markers["contractionPattern"], re.IGNORECASE
            )

        self.formality_applicable = self._markers is not None

    def compute(self, entry: dict) -> dict:
        """Compute per-entry style metrics.

        Args:
            entry: Dict with at minimum 'predicted' and 'expected'.
                   May also contain 'register' from the corpus.

        Returns:
            Dict with style metric values and a verdict string.
        """
        predicted = entry.get("predicted", "") or ""
        expected = entry.get("expected", "") or ""

        # Guard: if both fields are empty after coalescing None → "",
        # return safe defaults so downstream splitting never crashes.
        if not predicted.strip() and not expected.strip():
            return {
                "style_register_match": True,
                "style_sentence_length_ratio": 1.0,
                "style_formality_score": None,
                "style_predicted_register": "undetermined",
                "style_target_register": "none",
                "style_verdict": "UNDETERMINED",
                "style_prohibited_terms_found": [],
                "style_required_terms_missing": [],
            }

        # --- Sentence length ratio ---
        # How similar is the predicted sentence structure to the reference?
        pred_avg_len = _avg_sentence_length(predicted)
        ref_avg_len = _avg_sentence_length(expected)

        if ref_avg_len > 0:
            # Ratio of 1.0 = matching length. Capped at 2.0 to avoid
            # infinite divergence on very short references.
            length_ratio = min(pred_avg_len / ref_avg_len, 2.0)
        else:
            length_ratio = 1.0 if pred_avg_len == 0 else 2.0

        # --- Formality score ---
        # Only computed for languages with lexical markers.
        # For unsupported languages, we set formality to None (not 0.5)
        # so downstream code can distinguish "no signal" from "neutral".
        if self.formality_applicable:
            pred_formality = self._formality_score(predicted)
            pred_register = self._detect_register(predicted)
        else:
            pred_formality = None
            pred_register = "undetermined"

        # --- Register match ---
        # Determine the target register from:
        # 1. Style profile (explicit configuration)
        # 2. Corpus entry metadata (register field)
        # 3. Reference text auto-detection (fallback)
        target_register = None
        if self.style_profile and self.style_profile.target_register:
            target_register = self.style_profile.target_register
        elif entry.get("register"):
            # Map corpus register values to formal/informal/neutral
            reg = entry["register"].lower()
            if reg in ("formal", "official", "ceremonial", "legal"):
                target_register = "formal"
            elif reg in ("informal", "casual", "conversational", "colloquial"):
                target_register = "informal"
            else:
                target_register = "neutral"

        # Determine verdict
        if target_register is None:
            verdict = "UNDETERMINED"
            register_match = True  # No target = no mismatch
        elif target_register == "neutral":
            # Neutral accepts both formal and informal
            verdict = "FORMAL_MATCH" if pred_register == "formal" else "INFORMAL_MATCH"
            register_match = True
        elif pred_register == target_register:
            verdict = f"{target_register.upper()}_MATCH"
            register_match = True
        else:
            verdict = "REGISTER_MISMATCH"
            register_match = False

        # --- Prohibited/required terms check ---
        prohibited_found = []
        required_missing = []
        if self.style_profile:
            pred_words = set(predicted.lower().split())
            if self.style_profile.prohibited_terms:
                prohibited_found = sorted(
                    pred_words & self.style_profile.prohibited_terms
                )
            if self.style_profile.required_terms:
                required_missing = sorted(
                    self.style_profile.required_terms - pred_words
                )

        return {
            "style_register_match": register_match,
            "style_sentence_length_ratio": round(length_ratio, 3),
            "style_formality_score": round(pred_formality, 3) if pred_formality is not None else None,
            "style_predicted_register": pred_register,
            "style_target_register": target_register or "none",
            "style_verdict": verdict,
            "style_prohibited_terms_found": prohibited_found,
            "style_required_terms_missing": required_missing,
        }

    def _formality_score(self, text: str) -> float:
        """Compute a formality score based on loaded lexical markers.

        Returns 0.0–1.0 where:
          1.0 = very formal (many formal markers, no informal markers)
          0.5 = neutral (mixed or no markers)
          0.0 = very informal (many informal markers, no formal markers)

        Uses a simple ratio of formal vs informal signals.
        """
        if not self._markers:
            return 0.5

        words = set(text.lower().split())
        formal_set = set(self._markers.get("formalMarkers", []))
        informal_set = set(self._markers.get("informalMarkers", []))

        formal_count = len(words & formal_set)
        informal_count = len(words & informal_set)

        if self._contraction_re:
            informal_count += len(self._contraction_re.findall(text))

        total_signals = formal_count + informal_count
        if total_signals == 0:
            return 0.5  # No signal → neutral

        # Ratio of formal signals to total signals
        return formal_count / total_signals

    def _detect_register(self, text: str) -> str:
        """Detect the likely register of a text.

        Returns: "formal", "informal", or "neutral"
        """
        score = self._formality_score(text)
        if score >= 0.65:
            return "formal"
        elif score <= 0.35:
            return "informal"
        return "neutral"

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Compute corpus-level style consistency metrics.

        Returns:
            style_consistency_rate: fraction of entries with matching style
            avg_sentence_length_ratio: corpus-wide avg of per-entry ratios
            avg_formality_score: corpus-wide avg formality
            register_distribution: count of each detected register
        """
        if not entry_results:
            return {
                "style_consistency_rate": 0.0,
                "avg_sentence_length_ratio": 0.0,
                "avg_formality_score": 0.0,
            }

        match_count = sum(
            1 for r in entry_results if r.get("style_register_match", False)
        )

        length_ratios = [
            r.get("style_sentence_length_ratio", 1.0) for r in entry_results
        ]
        # Filter out None values — .get() returns None when the key exists
        # with value None (e.g., languages without formality markers).
        # The 0.5 default only applies when the key is truly missing.
        formality_scores = [
            score for r in entry_results
            if (score := r.get("style_formality_score")) is not None
        ]

        # Register distribution — how many entries are formal/informal/neutral
        register_counts: dict[str, int] = {}
        for r in entry_results:
            reg = r.get("style_predicted_register", "neutral")
            register_counts[reg] = register_counts.get(reg, 0) + 1

        n = len(entry_results)
        return {
            "style_consistency_rate": round(match_count / n, 4),
            "avg_sentence_length_ratio": round(sum(length_ratios) / n, 3),
            "avg_formality_score": round(
                sum(formality_scores) / len(formality_scores), 3
            ) if formality_scores else 0.0,
            "style_register_distribution": register_counts,
        }
