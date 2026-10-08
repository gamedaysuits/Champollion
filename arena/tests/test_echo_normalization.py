"""
Source-copy detection sees through disguised copies — and only through them.

Finding (Round 3 synthetic researcher, eng→sme Northern Sami): an English
source handed back with diacritics added ('Thank you very much!' →
'Thánk yóú véry múch!') passed the hallucination echo check, the
code-switching untranslated-run check, and hallucination overall. A Latin-script
target means the script check cannot fire either, so nothing caught the copy.

The fix is ONE shared normalizer (``mt_eval_harness.text_compare``) used by
every "output == source" decision. These tests pin:

    1. the normalizer itself (NFKD, combining marks, casefold, format
       characters, whitespace, punctuation; letter-free text stays literal);
    2. the accented copy is now caught by echo, by untranslated runs and by
       the hallucination composite;
    3. genuine translations that share a name or a number with the source are
       flagged no more than before (compared against the pre-fix literal
       comparison, re-implemented here as the reference);
    4. plain copies score exactly as before, including spaced punctuation;
    5. no weight, threshold or min_run moved.
"""

from __future__ import annotations

import inspect

import pytest

from mt_eval_harness import text_compare
from mt_eval_harness.plugins import code_switching, hallucination
from mt_eval_harness.plugins.code_switching import (
    CodeSwitchingPlugin,
    _find_untranslated_runs,
)
from mt_eval_harness.plugins.hallucination import (
    HallucinationPlugin,
    _echo_detection,
)
from mt_eval_harness.text_compare import (
    echo_compare_forms,
    has_letter,
    normalize_for_compare,
    token_compare_key,
    token_compare_keys,
)

SOURCE = "Thank you very much!"
ACCENTED_COPY = "Thánk yóú véry múch!"
SAMI_REFERENCE = "Giitu ollu!"


# ---------------------------------------------------------------------------
# Pre-fix reference: the literal comparison the plugins used before the fix.
# Used to prove "no more flagging than before" for genuine translations.
# ---------------------------------------------------------------------------

def _runs_literal(source_tokens, predicted_tokens, min_run=3):
    """The pre-fix untranslated-run count: lowercase token equality."""
    if len(source_tokens) < min_run or len(predicted_tokens) < min_run:
        return 0
    src = {t.lower() for t in source_tokens}
    pred = [t.lower() for t in predicted_tokens]
    count, i = 0, 0
    while i < len(pred):
        if pred[i] in src:
            start = i
            while i < len(pred) and pred[i] in src:
                i += 1
            if i - start >= min_run:
                count += i - start
        else:
            i += 1
    return count


def _sme_plugin():
    """Code-switching plugin configured as for eng→sme (both Latin script)."""
    return CodeSwitchingPlugin(target_scripts=["Latin"], source_script="Latin")


# ---------------------------------------------------------------------------
# 1. The normalizer
# ---------------------------------------------------------------------------

class TestNormalizer:

    def test_strips_combining_marks(self):
        assert normalize_for_compare("Thánk yóú véry múch") == "thank you very much"

    def test_decomposed_and_precomposed_input_agree(self):
        precomposed = "café"                 # U+00E9
        decomposed = "café"            # e + COMBINING ACUTE
        assert normalize_for_compare(precomposed) == normalize_for_compare(decomposed) == "cafe"

    def test_casefold_not_just_lower(self):
        assert normalize_for_compare("Straße") == normalize_for_compare("STRASSE") == "strasse"

    def test_compatibility_forms_fold(self):
        assert normalize_for_compare("Ｔｈａｎｋ") == "thank"   # fullwidth
        assert normalize_for_compare("ﬁne") == "fine"          # ligature
        assert normalize_for_compare("𝐓𝐡𝐚𝐧𝐤") == "thank"       # math bold (casefold after NFKD)

    def test_whitespace_collapses(self):
        assert normalize_for_compare("  thank \t you\n\nvery much ") == "thank you very much"

    def test_punctuation_becomes_space_then_collapses(self):
        assert normalize_for_compare("Thank you, very much!!!") == "thank you very much"
        assert normalize_for_compare("«Thank you» — very much…") == "thank you very much"
        assert normalize_for_compare("don't") == "don t"

    def test_format_characters_dropped(self):
        assert normalize_for_compare("Tha​nk‎ you") == "thank you"

    def test_letters_that_are_not_base_plus_mark_survive(self):
        # Northern Sami letters with no canonical decomposition stay distinct.
        assert normalize_for_compare("Ŋ Đ Ŧ Ø") == "ŋ đ ŧ ø"
        # ...while decomposable ones fold to their base letter.
        assert normalize_for_compare("Á Č Š Ž") == "a c s z"

    def test_empty_and_punctuation_only(self):
        assert normalize_for_compare("") == ""
        assert normalize_for_compare(" !?… ") == ""

    def test_has_letter(self):
        assert has_letter("abc")
        assert has_letter("ŋ")
        assert has_letter("ᐊᐱ")          # syllabics are letters too
        assert not has_letter("25, 1.000 — $!")
        assert not has_letter("")

    def test_token_key_letter_bearing_tokens_normalize(self):
        # case and diacritics fold; attached punctuation is kept, so the
        # per-token decisions on real translations are what they were
        assert token_compare_key("Múch!") == "much!"
        assert token_compare_key("Múch!") == token_compare_key("much!")
        assert token_compare_key("Múch!") != token_compare_key("much")
        assert token_compare_key("«Thánk") == "«thank"

    def test_token_key_letter_free_tokens_stay_literal(self):
        # Pre-fix behaviour for punctuation / numbers / symbols: literal, lowercased.
        assert token_compare_key("!") == "!"
        assert token_compare_key("—") == "—"
        assert token_compare_key("25") == "25"
        assert token_compare_key("25.") == "25."
        assert token_compare_key("1,000") != token_compare_key("1.000")

    def test_token_keys_preserve_length_and_order(self):
        toks = ["Thánk", "!", "yóú", "25"]
        assert token_compare_keys(toks) == ["thank", "!", "you", "25"]

    def test_echo_forms_normalize_when_both_sides_have_letters(self):
        assert echo_compare_forms(SOURCE, ACCENTED_COPY) == (
            "thank you very much", "thank you very much")

    def test_echo_forms_letter_free_text_stays_literal(self):
        # Localizing a decimal separator is translation, not echo.
        assert echo_compare_forms("3.14", "3,14") == ("3.14", "3,14")
        assert echo_compare_forms(" 2024 ", "2024") == ("2024", "2024")


# ---------------------------------------------------------------------------
# 2. The accented copy is caught
# ---------------------------------------------------------------------------

class TestAccentedCopyDetected:

    def test_echo_detection_identity(self):
        assert _echo_detection(SOURCE, ACCENTED_COPY) == 1.0

    @pytest.mark.parametrize("disguise", [
        "Thánk yóú véry múch!",
        "Thánk yóú véry múch",          # punctuation dropped too
        "THÁNK YÓÚ VÉRY MÚCH!!",        # case + punctuation
        "Thánk you​ very much!",  # decomposed accent + zero-width space
        "Ｔｈａｎｋ ｙｏｕ ｖｅｒｙ ｍｕｃｈ！",  # fullwidth
    ])
    def test_echo_detection_sees_through_disguises(self, disguise):
        assert _echo_detection(SOURCE, disguise) == 1.0

    def test_near_echo_overlap_computed_on_normalized_strings(self):
        # One letter changed AND accents added: a near-echo, not identity.
        src = "Thank you very much for the help"
        pred = "Thánk yóú véry múch för thé hëlps"
        assert _echo_detection(src, pred) == 0.5

    def test_hallucination_echo_component_fires(self):
        result = HallucinationPlugin().compute({"source": SOURCE, "predicted": ACCENTED_COPY})
        assert result["hall_echo_score"] == 1.0
        # Only the echo signal fires here; its weight is 0.1, unchanged.
        assert result["hall_length_score"] == 0.0
        assert result["hall_repetition_score"] == 0.0
        assert result["hall_entity_score"] == 0.0
        assert result["hallucination_rate"] == pytest.approx(0.1)

    def test_untranslated_runs_catch_accented_copy(self):
        result = _sme_plugin().compute({
            "source": SOURCE, "predicted": ACCENTED_COPY, "expected": SAMI_REFERENCE,
        })
        assert result["cs_untranslated_run_tokens"] == 4
        assert result["code_switching_rate"] > 0.0
        assert result["code_switching_rate"] == 1.0

    def test_untranslated_runs_catch_accented_copy_with_auto_detected_script(self):
        # No configured scripts: the target script is auto-detected from the
        # Sami reference (Latin) — the script check still cannot fire, so the
        # untranslated-run check is what must catch the copy.
        result = CodeSwitchingPlugin().compute({
            "source": SOURCE, "predicted": ACCENTED_COPY, "expected": SAMI_REFERENCE,
        })
        assert result["cs_wrong_script_tokens"] == 0
        assert result["code_switching_rate"] > 0.0

    def test_accented_copy_inside_a_longer_output(self):
        src = "The meeting starts at nine tomorrow morning"
        pred = "Čoahkkin álgá thé méeting stárts át ovccis"
        assert _find_untranslated_runs(src.split(), pred.split()) == 4
        assert _runs_literal(src.split(), pred.split()) == 0   # missed before


# ---------------------------------------------------------------------------
# 3. Genuine translations sharing names / numbers: no more flagging than before
# ---------------------------------------------------------------------------

GENUINE = [
    ("John paid 25 dollars.", "John máksii 25 dollára."),                    # sme
    ("John paid 25 dollars.", "John a payé 25 dollars."),                    # fra
    ("John and Mary paid 25 dollars to Peter.",
     "John ja Mary máksiiga Peterii 25 dollára."),                          # sme
    ("Anna lives in Tromsø with 3 cats.", "Anna orru Romssas 3 bussážiin."),  # sme
    ("Thank you very much!", SAMI_REFERENCE),                                # sme
    ("Pay 1,000 2,000 3,000 now", "Máksse 1.000 2.000 3.000 dál"),           # localized numbers
]


class TestGenuineTranslationsNotNewlyFlagged:

    @pytest.mark.parametrize("src,pred", GENUINE)
    def test_untranslated_runs_no_more_than_before(self, src, pred):
        before = _runs_literal(src.split(), pred.split())
        after = _find_untranslated_runs(src.split(), pred.split())
        assert after <= before
        assert after == 0

    @pytest.mark.parametrize("src,pred", GENUINE)
    def test_code_switching_rate_zero(self, src, pred):
        result = _sme_plugin().compute({"source": src, "predicted": pred, "expected": pred})
        assert result["code_switching_rate"] == 0.0

    @pytest.mark.parametrize("src,pred", GENUINE)
    def test_not_an_echo(self, src, pred):
        assert _echo_detection(src, pred) == 0.0

    def test_letter_free_tokens_match_and_break_runs_as_before(self):
        # A phone number copied with its spaced dash: digit/punctuation tokens
        # keep their literal keys, so the result equals the pre-fix result.
        src = "Call 555 - 1234 now".split()
        pred = "Riŋge 555 - 1234 dál".split()
        assert _find_untranslated_runs(src, pred) == _runs_literal(src, pred) == 3

    def test_min_run_unchanged_for_short_accented_copy(self):
        # Two copied words stay below min_run=3, as before.
        assert _find_untranslated_runs("Thank you".split(), "Thánk yóú".split()) == 0


# ---------------------------------------------------------------------------
# 4. Plain copies score exactly as before
# ---------------------------------------------------------------------------

PLAIN_COPIES = [
    "Thank you very much!",
    "Hello world, how are you?",
    "Merci beaucoup !",                 # spaced punctuation (French typography)
    "Thank you very much .",            # pre-tokenized corpus style
    "The quick brown fox jumps over the lazy dog",
]


class TestPlainCopyUnchanged:

    @pytest.mark.parametrize("text", PLAIN_COPIES)
    def test_echo_still_one(self, text):
        assert _echo_detection(text, text) == 1.0

    @pytest.mark.parametrize("text", PLAIN_COPIES)
    def test_untranslated_runs_equal_pre_fix(self, text):
        toks = text.split()
        assert _find_untranslated_runs(toks, toks) == _runs_literal(toks, toks) == len(toks)

    @pytest.mark.parametrize("text", PLAIN_COPIES)
    def test_code_switching_rate_still_one(self, text):
        result = _sme_plugin().compute({"source": text, "predicted": text, "expected": text})
        assert result["code_switching_rate"] == 1.0

    def test_plain_copy_hallucination_rate_unchanged(self):
        result = HallucinationPlugin().compute({"source": SOURCE, "predicted": SOURCE})
        assert result["hall_echo_score"] == 1.0
        assert result["hallucination_rate"] == pytest.approx(0.1)

    def test_letter_free_echo_unchanged(self):
        assert _echo_detection("2024", "2024") == 1.0      # identical, as before
        assert _echo_detection("3.14", "3,14") == 0.0      # localized, as before

    def test_empty_prediction_still_zero(self):
        assert _echo_detection(SOURCE, "") == 0.0
        assert _echo_detection(SOURCE, "   ") == 0.0


# ---------------------------------------------------------------------------
# 5. One normalizer, and nothing else moved
# ---------------------------------------------------------------------------

class TestSingleSourceOfTruth:

    def test_both_plugins_use_the_shared_normalizer(self):
        assert hallucination.echo_compare_forms is text_compare.echo_compare_forms
        assert code_switching.token_compare_keys is text_compare.token_compare_keys

    def test_weights_unchanged(self):
        p = HallucinationPlugin()
        assert (p.length_weight, p.repetition_weight, p.entity_weight, p.echo_weight) == (
            0.4, 0.3, 0.2, 0.1)

    def test_min_run_unchanged(self):
        assert inspect.signature(_find_untranslated_runs).parameters["min_run"].default == 3

    def test_near_echo_threshold_unchanged(self):
        # 6 of 7 characters shared (0.857 > 0.85) → near-echo; 5 of 6 (0.833) → not.
        assert _echo_detection("abcdefg", "abcdefx") == 0.5
        assert _echo_detection("abcdef", "abcdex") == 0.0
