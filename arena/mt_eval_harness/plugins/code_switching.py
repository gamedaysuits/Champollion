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

from mt_eval_harness.text_compare import token_compare_keys


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


#: ISO 15924 codes (``--target-script``, a card's ``scripts``) → the script
#: labels this plugin reads characters into. A code not here has no label.
ISO15924_LABELS = {
    "Latn": "Latin", "Cyrl": "Cyrillic", "Arab": "Arabic", "Hani": "CJK",
    "Hans": "CJK", "Hant": "CJK", "Deva": "Devanagari", "Cans": "Canadian_Aboriginal",
    "Hang": "Hangul", "Kore": "Hangul", "Hira": "Hiragana", "Kana": "Katakana",
    "Thai": "Thai", "Hebr": "Hebrew", "Grek": "Greek", "Ethi": "Ethiopic",
}


def card_script(code: str | None) -> tuple[str | None, str]:
    """The ONE script a language's card lists (ISO 15924), and why.

    Read through the card adapter (``language_cards.get_card`` and
    ``script_codes``, which knows every shape a card's ``scripts`` comes
    in), never the card file. A card that lists exactly one script gives it;
    a card that lists several gives None — never a guess among them
    (Russian's card lists Cyrl and Latn, Plains Cree's Cans and Latn).
    ``why`` says which, in words a run can print. A card index that cannot
    be read raises, as every card read does (a missing index is never an
    empty one).
    """
    code = str(code or "").strip()
    if not code:
        return None, "no language code was given"
    from mt_eval_harness.language_cards import get_card, script_codes
    card = get_card(code)
    if not card:
        return None, f"no language card for {code!r}"
    scripts = script_codes(card)
    if len(scripts) == 1:
        return scripts[0], f"the {code} card lists one script, {scripts[0]}"
    if not scripts:
        return None, f"the {code} card lists no script"
    return None, (f"the {code} card lists {', '.join(scripts)}, and none is "
                  f"picked from several")


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

    Tokens are compared through the shared source-copy normalizer
    (``mt_eval_harness.text_compare.token_compare_key``): case, diacritics,
    format characters and attached punctuation do not disguise a copied word
    ('Thánk yóú véry múch!' still matches 'Thank you very much!'). Tokens with
    no letter (punctuation, digits, symbols) keep their literal form, so they
    match and break runs exactly as before. One key per token: the count is
    still a count of predicted whitespace tokens.

    Returns the total number of predicted tokens involved in untranslated runs.
    """
    if len(source_tokens) < min_run or len(predicted_tokens) < min_run:
        return 0

    # One comparison key per token (same length and order as the input lists)
    source_keys = token_compare_keys(source_tokens)
    pred_keys = token_compare_keys(predicted_tokens)
    source_set = set(source_keys)

    untranslated_count = 0
    i = 0
    while i < len(pred_keys):
        if pred_keys[i] in source_set:
            # Start counting a potential run
            run_start = i
            while i < len(pred_keys) and pred_keys[i] in source_set:
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
        source_script: Script label of the source language ('Latin',
            'Cyrillic', … — a value of ISO15924_LABELS). When given, it
            decides. If None, resolved from source_lang's language card.
        source_lang: ISO 639-3 code (or alias) for the source language.
            When provided and source_script is None, the source script is
            the ONE script the card lists (:func:`card_script`, through the
            card adapter). A card listing several (Russian: Cyrl, Latn) or
            none, a script this plugin has no label for, or no source_lang
            leaves 'Latin' — the long-standing default, right for English —
            and ``source_script_basis`` says it was assumed, with
            ``source_script_note`` saying why.

    Before 2026-10-10 the card lookup read ``scriptUnicodeName``, a field the
    atlas cards do not carry, and discovery never passed source_lang: the
    source script was Latin for every run, so a Cyrillic source word left in
    an English output was never counted.
    """

    name = "code_switching"

    def __init__(
        self,
        target_scripts: list[str] | None = None,
        source_script: str | None = None,
        source_lang: str | None = None,
        target_script_hint: str | None = None,
    ):
        self.target_scripts = target_scripts
        self._auto_detected = False
        # The target's script when no reference shows it (translate / serve):
        # from --target-script, or a card listing one script
        # (plugin_discovery). A reference, when there is one, still decides.
        self.target_script_hint = target_script_hint

        # The source's script: named, else the one script its card lists,
        # else Latin — assumed, and recorded as assumed (aggregate()).
        if source_script:
            self.source_script = source_script
            self.source_script_basis = "named"
            self.source_script_note = "source_script was given"
        else:
            iso, why = (card_script(source_lang) if source_lang
                        else (None, "the run names no source language code"))
            label = ISO15924_LABELS.get(iso) if iso else None
            if label:
                self.source_script = label
                self.source_script_basis = "card"
                self.source_script_note = why
            else:
                if iso:
                    why = f"{why}, which this check has no label for"
                self.source_script = "Latin"
                self.source_script_basis = "assumed"
                self.source_script_note = (
                    f"{why}; Latin is assumed, so a source word in another "
                    f"script is not counted")

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
        target_scripts = self.target_scripts or (
            [self.target_script_hint] if self.target_script_hint else None)
        if target_scripts is None and not str(entry.get("expected") or "").strip():
            # No reference to read the target's script from, and none named:
            # the script half cannot be judged, so no rate is given (a rate
            # of 0.0 here would let a gate pass what it never checked).
            return {
                "code_switching_rate": None,
                "cs_wrong_script_tokens": None,
                "cs_total_tokens": len(predicted.split()),
                "cs_untranslated_run_tokens": None,
                "cs_unjudged": "no_target_script",
            }

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

            if target_scripts:
                # Token is "wrong" if it matches the source script but NOT
                # any of the target scripts
                if ts == self.source_script and ts not in target_scripts:
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
                entries_unjudged / entries_errored: int — present when nonzero
                source_script / source_script_basis / source_script_note —
                    the source script counted, and "named" | "card" |
                    "assumed" with why
        """
        # an entry the plugin could not judge (no target script), or that it
        # raised on (tester stores {"error": ...}), is left out of the averages
        # and counted on its own — scored as 0.0 it made the run look cleaner
        errored = sum(1 for r in entry_results if "error" in r)
        unjudged = sum(1 for r in entry_results
                       if "error" not in r and r.get("cs_unjudged"))
        judged = [r for r in entry_results
                  if "error" not in r and not r.get("cs_unjudged")]
        not_scored = {
            **({"entries_unjudged": unjudged} if unjudged else {}),
            **({"entries_errored": errored} if errored else {}),
        }
        total = len(judged)
        if not total:
            return not_scored

        rates = [r.get("code_switching_rate", 0.0) for r in judged]
        wrong_tokens = sum(r.get("cs_wrong_script_tokens", 0) for r in judged)
        entries_with_cs = sum(1 for r in rates if r > 0)

        return {
            "avg_code_switching_rate": round(sum(rates) / total, 4),
            "entries_with_code_switching": entries_with_cs,
            "entries_with_code_switching_pct": round(entries_with_cs / total, 4),
            "total_wrong_script_tokens": wrong_tokens,
            # which source script the wrong-script count looked for, and
            # whether it was named, read from the card, or assumed
            "source_script": self.source_script,
            "source_script_basis": self.source_script_basis,
            "source_script_note": self.source_script_note,
            **not_scored,
        }

    def unjudged_without_references(self) -> str | None:
        """Why this plugin cannot judge a segment that has no reference
        (translate / serve), or None when it can (``gates`` asks before a
        gate is trusted with it)."""
        if self.target_scripts or self.target_script_hint:
            return None
        return ("it reads the target's script from the references, there are none, "
                "and the target's card lists more than one script — name it with "
                "--target-script (e.g. Cyrl)")
