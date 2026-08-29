"""
Code-Switching Rate Detector — MetricPlugin for the test harness.

Detects unwanted source-language tokens that leaked into translation output.
Code-switching (mixing two languages in one sentence) is acceptable in some
contexts (e.g., Filipino/Taglish) but is penalized in strict evaluation
because it suggests the model failed to translate.

Design:
    - Uses Unicode script detection (unicodedata.category / name) to identify
      tokens written in the wrong script for the target language.
    - Detects untranslated source phrases (3+ consecutive source words appearing
      verbatim in the output).
    - Returns code_switching_rate on 0.0–1.0 scale (lower = better).
    - scoring.py inverts this: 0% code-switching → 1.0 (perfect).

Dependencies: Python stdlib only (re, unicodedata).

Source: SCORING_SPEC.md §4.3 — weighted 0.05 (Profile A) / 0.10 (Profile B).
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter


# ---------------------------------------------------------------------------
# Unicode script detection
# ---------------------------------------------------------------------------

# Common Unicode script groupings for MT evaluation.
# Maps a script label → set of Unicode General Category prefixes or
# unicodedata.name() substrings that identify that script.
#
# This is intentionally coarse — we only need to distinguish Latin from
# non-Latin scripts (Cyrillic, CJK, Arabic, Devanagari, Canadian Aboriginal
# Syllabics, etc.) with reasonable accuracy.

def _dominant_script(text: str) -> str:
    """Determine the dominant Unicode script in a text string.

    Returns one of: 'Latin', 'Cyrillic', 'Arabic', 'CJK', 'Devanagari',
    'Canadian_Aboriginal', 'Hangul', 'Hiragana', 'Katakana', 'Thai',
    'Hebrew', or 'Other'.

    Ignores whitespace, digits, and punctuation.
    """
    script_counts: Counter[str] = Counter()

    for ch in text:
        cat = unicodedata.category(ch)
        # Skip non-letter characters (numbers, punctuation, spaces, symbols)
        if not cat.startswith("L"):
            continue
        try:
            name = unicodedata.name(ch, "")
        except ValueError:
            continue

        # Match by character name prefix (Unicode standard naming convention)
        if "LATIN" in name:
            script_counts["Latin"] += 1
        elif "CYRILLIC" in name:
            script_counts["Cyrillic"] += 1
        elif "ARABIC" in name:
            script_counts["Arabic"] += 1
        elif "CJK" in name or "IDEOGRAPH" in name:
            script_counts["CJK"] += 1
        elif "DEVANAGARI" in name:
            script_counts["Devanagari"] += 1
        elif "CANADIAN" in name or "SYLLABICS" in name:
            script_counts["Canadian_Aboriginal"] += 1
        elif "HANGUL" in name:
            script_counts["Hangul"] += 1
        elif "HIRAGANA" in name:
            script_counts["Hiragana"] += 1
        elif "KATAKANA" in name:
            script_counts["Katakana"] += 1
        elif "THAI" in name:
            script_counts["Thai"] += 1
        elif "HEBREW" in name:
            script_counts["Hebrew"] += 1
        elif "GREEK" in name:
            script_counts["Greek"] += 1
        elif "ETHIOPIC" in name:
            script_counts["Ethiopic"] += 1
        else:
            script_counts["Other"] += 1

    if not script_counts:
        return "Other"
    return script_counts.most_common(1)[0][0]


def _script_of_char(ch: str) -> str:
    """Return the script label for a single character."""
    cat = unicodedata.category(ch)
    if not cat.startswith("L"):
        return "Non_Letter"
    try:
        name = unicodedata.name(ch, "")
    except ValueError:
        return "Other"

    if "LATIN" in name:
        return "Latin"
    elif "CYRILLIC" in name:
        return "Cyrillic"
    elif "ARABIC" in name:
        return "Arabic"
    elif "CJK" in name or "IDEOGRAPH" in name:
        return "CJK"
    elif "DEVANAGARI" in name:
        return "Devanagari"
    elif "CANADIAN" in name or "SYLLABICS" in name:
        return "Canadian_Aboriginal"
    elif "HANGUL" in name:
        return "Hangul"
    elif "HIRAGANA" in name:
        return "Hiragana"
    elif "KATAKANA" in name:
        return "Katakana"
    elif "THAI" in name:
        return "Thai"
    elif "HEBREW" in name:
        return "Hebrew"
    elif "GREEK" in name:
        return "Greek"
    elif "ETHIOPIC" in name:
        return "Ethiopic"
    return "Other"


def _token_script(token: str) -> str:
    """Determine the dominant script of a whitespace-delimited token."""
    scripts: Counter[str] = Counter()
    for ch in token:
        s = _script_of_char(ch)
        if s != "Non_Letter":
            scripts[s] += 1
    if not scripts:
        return "Non_Letter"
    return scripts.most_common(1)[0][0]


# ---------------------------------------------------------------------------
# Untranslated phrase detection
# ---------------------------------------------------------------------------

def _find_untranslated_runs(
    source_tokens: list[str],
    predicted_tokens: list[str],
    min_run: int = 3,
) -> int:
    """Count predicted tokens that appear as consecutive runs from the source.

    A "run" of min_run or more consecutive source tokens appearing verbatim
    in the prediction strongly suggests untranslated content.

    Returns the total number of predicted tokens involved in untranslated runs.
    """
    if len(source_tokens) < min_run or len(predicted_tokens) < min_run:
        return 0

    # Normalize for case-insensitive matching
    source_lower = [t.lower() for t in source_tokens]
    pred_lower = [t.lower() for t in predicted_tokens]
    source_set = set(source_lower)

    untranslated_count = 0
    i = 0
    while i < len(pred_lower):
        if pred_lower[i] in source_set:
            # Start counting a potential run
            run_start = i
            while i < len(pred_lower) and pred_lower[i] in source_set:
                i += 1
            run_len = i - run_start
            if run_len >= min_run:
                untranslated_count += run_len
        else:
            i += 1

    return untranslated_count


# ---------------------------------------------------------------------------
# Plugin class
# ---------------------------------------------------------------------------

class CodeSwitchingPlugin:
    """MetricPlugin that detects code-switching in translation output.

    Code-switching occurs when a translation contains tokens from the source
    language script instead of the target language script. This typically
    indicates untranslated content or model confusion.

    Constructor args:
        target_scripts: Expected Unicode script names for the target language
            (e.g., ['Canadian_Aboriginal'] for Plains Cree syllabics,
            ['Cyrillic'] for Russian). If None, auto-detected from the first
            batch of entries.
        source_script: Expected script of the source language. Defaults to
            'Latin' (English is the most common source). If None, resolved
            from source_lang's language card.
        source_lang: ISO 639-3 code (or alias) for the source language.
            When provided and source_script is None, the plugin reads the
            language card's ``scriptUnicodeName`` field (e.g., 'Latin',
            'Arabic', 'Cyrillic') to auto-detect the source script.
            This avoids hardcoding Latin for non-English source languages.
    """

    name = "code_switching"

    def __init__(
        self,
        target_scripts: list[str] | None = None,
        source_script: str | None = None,
        source_lang: str | None = None,
    ):
        self.target_scripts = target_scripts
        self._auto_detected = False

        # Resolve source script from language card if not explicitly provided.
        # Cards store scriptUnicodeName (e.g., 'Latin', 'Arabic', 'Cyrillic')
        # which matches the Unicode script names used by _dominant_script().
        if source_script is None and source_lang:
            from mt_eval_harness.language_cards import get_card
            card = get_card(source_lang)
            if card and card.get("scriptUnicodeName"):
                source_script = card["scriptUnicodeName"]

        self.source_script = source_script or "Latin"

    def compute(self, entry: dict) -> dict:
        """Compute code-switching metrics for a single entry.

        Returns:
            Dict with:
                code_switching_rate: float 0.0–1.0 (fraction of tokens in
                    wrong script). 0.0 = no code-switching (perfect).
                cs_wrong_script_tokens: int — count of tokens in wrong script
                cs_total_tokens: int — total tokens analyzed
                cs_untranslated_run_tokens: int — tokens in untranslated runs
        """
        source = entry.get("source", "")
        predicted = entry.get("predicted", "")

        if not predicted or not predicted.strip():
            return {
                "code_switching_rate": 0.0,
                "cs_wrong_script_tokens": 0,
                "cs_total_tokens": 0,
                "cs_untranslated_run_tokens": 0,
            }

        # Auto-detect target script from expected output if not configured
        if self.target_scripts is None and not self._auto_detected:
            expected = entry.get("expected", "")
            if expected:
                detected = _dominant_script(expected)
                if detected != "Other":
                    self.target_scripts = [detected]
                    self._auto_detected = True

        # Tokenize
        pred_tokens = predicted.split()
        source_tokens = source.split()

        if not pred_tokens:
            return {
                "code_switching_rate": 0.0,
                "cs_wrong_script_tokens": 0,
                "cs_total_tokens": 0,
                "cs_untranslated_run_tokens": 0,
            }

        # Count tokens in wrong script
        wrong_script = 0
        total_letter_tokens = 0

        for token in pred_tokens:
            ts = _token_script(token)
            if ts == "Non_Letter":
                continue  # Skip pure-punctuation / numeric tokens
            total_letter_tokens += 1

            if self.target_scripts:
                # Token is "wrong" if it matches the source script but NOT
                # any of the target scripts
                if ts == self.source_script and ts not in self.target_scripts:
                    wrong_script += 1
            else:
                # No target script info — can't detect code-switching
                pass

        # Untranslated phrase detection
        untranslated = _find_untranslated_runs(source_tokens, pred_tokens)

        # Compute rate
        if total_letter_tokens == 0:
            rate = 0.0
        else:
            # Blend script mismatch and untranslated runs
            script_rate = wrong_script / total_letter_tokens
            untranslated_rate = untranslated / len(pred_tokens) if pred_tokens else 0.0
            # Take the max of the two signals — they're correlated but
            # either alone is sufficient evidence of code-switching
            rate = max(script_rate, untranslated_rate)

        return {
            "code_switching_rate": round(min(rate, 1.0), 4),
            "cs_wrong_script_tokens": wrong_script,
            "cs_total_tokens": total_letter_tokens,
            "cs_untranslated_run_tokens": untranslated,
        }

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Compute corpus-level code-switching aggregates.

        Returns:
            Dict with:
                avg_code_switching_rate: float — mean rate across entries
                entries_with_code_switching: int — count of entries with rate > 0
                total_wrong_script_tokens: int — total wrong-script tokens
        """
        total = len(entry_results)
        if not total:
            return {}

        rates = [r.get("code_switching_rate", 0.0) for r in entry_results]
        wrong_tokens = sum(r.get("cs_wrong_script_tokens", 0) for r in entry_results)
        entries_with_cs = sum(1 for r in rates if r > 0)

        return {
            "avg_code_switching_rate": round(sum(rates) / total, 4),
            "entries_with_code_switching": entries_with_cs,
            "entries_with_code_switching_pct": round(entries_with_cs / total, 4),
            "total_wrong_script_tokens": wrong_tokens,
        }
