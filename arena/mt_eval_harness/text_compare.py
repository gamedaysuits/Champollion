"""
Source-copy comparison — the ONE normalizer behind "is this output the source?"

Every place the harness decides that an output copies its source (the
hallucination plugin's echo signal, the code-switching plugin's
untranslated-run signal) compares text through this module, so a copy cannot
slip past one check by wearing a disguise the other check sees through.

Why it exists: a Latin-script target (Northern Sami, French, Vietnamese, …)
lets a model hand the English source back with diacritics sprinkled on —
'Thank you very much!' → 'Thánk yóú véry múch!'. A ``.strip().lower()``
comparison calls that a different string, and the script check cannot fire
because source and output are both Latin. The output is still a copy.

The normalization (applied identically to both sides of every comparison):

    1. Unicode NFKD — compatibility decomposition, so precomposed letters
       split into base + combining mark and compatibility forms (fullwidth
       letters, ligatures, mathematical alphanumerics) fold to plain letters.
    2. casefold (then NFKD again, because a case mapping can itself produce a
       decomposable character).
    3. Drop combining marks (category Mn) — 'á' → 'a', 'ŋ' stays 'ŋ' (it is a
       letter, not a base + mark).
    4. Drop invisible format characters (category Cf: zero-width space,
       zero-width joiners, bidi marks, soft hyphen) — they change the bytes,
       not the text a reader sees.
    5. Punctuation (category P*) becomes a space, then whitespace collapses.
       (Whole-string comparisons only; per-token keys keep punctuation — see
       :func:`token_compare_key`.)

Text that carries NO letter after normalization (numbers, punctuation,
symbols only) is compared literally, exactly as before this module existed.
There is nothing to disguise in such text, and folding it would erase real
translation work — localizing '3.14' to '3,14' or '1,000' to '1 000' is a
correct translation, not an echo. This keeps every pre-existing decision on
letter-free text unchanged.

The normalizer only changes WHAT counts as equal. It defines no threshold,
weight or score; the callers keep theirs exactly as they were.

A second, separate question — "did the system give DIFFERENT inputs the
same output?" (the near-constant-output caveat, score_caveats) — compares
outputs with :func:`repeat_compare_key`, which keeps diacritics: between two
outputs they tell words apart, while the source-copy check folds them to see
through a disguised copy.

Dependencies: Python stdlib only (unicodedata).
"""

from __future__ import annotations

import unicodedata

__all__ = [
    "normalize_for_compare",
    "has_letter",
    "echo_compare_forms",
    "token_compare_key",
    "token_compare_keys",
    "repeat_compare_key",
]


def normalize_for_compare(text: str) -> str:
    """Normalize ``text`` for source-copy comparison.

    NFKD, casefold, drop combining marks (Mn) and format characters (Cf),
    turn punctuation (P*) into spaces, collapse whitespace, strip.

    >>> normalize_for_compare("Thánk  yóú, véry múch!")
    'thank you very much'
    >>> normalize_for_compare("!!!")
    ''
    """
    if not text:
        return ""
    folded = unicodedata.normalize(
        "NFKD", unicodedata.normalize("NFKD", text).casefold()
    )
    out: list[str] = []
    for ch in folded:
        cat = unicodedata.category(ch)
        if cat == "Mn" or cat == "Cf":
            continue
        out.append(" " if cat.startswith("P") else ch)
    return " ".join("".join(out).split())


def has_letter(text: str) -> bool:
    """True when ``text`` contains at least one letter (Unicode category L*)."""
    return any(unicodedata.category(ch).startswith("L") for ch in text)


def _literal_form(text: str) -> str:
    """The pre-normalizer comparison form: stripped and lowercased.

    Used for letter-free text so its comparisons behave exactly as they did
    before this module existed.
    """
    return text.strip().lower()


def echo_compare_forms(source: str, predicted: str) -> tuple[str, str]:
    """Return the (source, predicted) strings a whole-string echo check compares.

    Both sides are normalized with :func:`normalize_for_compare` when BOTH
    carry a letter afterwards. Otherwise both fall back to the literal
    stripped/lowercased form, so letter-free text (and a letter-free side
    against a lettered one) is decided exactly as it was before.
    """
    src_norm = normalize_for_compare(source)
    pred_norm = normalize_for_compare(predicted)
    if has_letter(src_norm) and has_letter(pred_norm):
        return src_norm, pred_norm
    return _literal_form(source), _literal_form(predicted)


def _fold(text: str) -> str:
    """Steps 1–4 only (no punctuation step): case, diacritics and invisible
    format characters fold away; punctuation stays as written."""
    folded = unicodedata.normalize(
        "NFKD", unicodedata.normalize("NFKD", text).casefold()
    )
    return "".join(ch for ch in folded
                   if unicodedata.category(ch) not in ("Mn", "Cf")).strip()


def token_compare_key(token: str) -> str:
    """The comparison key for one whitespace-delimited token.

    A token with a letter is keyed by its folded form — case, diacritics and
    format characters removed, punctuation KEPT ('Múch!' → 'much!', which
    matches 'much!' but not 'much'). Keeping attached punctuation preserves
    the per-token decisions the code-switching metric made before this
    module on real translations: stripping it as well raised the WMT24++
    reference code-switching rate (0.0370 → 0.0380, mostly names with
    attached punctuation), a change to a published metric beyond the
    accented-copy fix. A token with no letter keeps its literal lowercased
    form, exactly as before.
    """
    folded = _fold(token)
    if has_letter(folded):
        return folded
    return _literal_form(token)


def token_compare_keys(tokens: list[str]) -> list[str]:
    """:func:`token_compare_key` over a token list, preserving length and order."""
    return [token_compare_key(t) for t in tokens]


def repeat_compare_key(text: str) -> str:
    """The form two OUTPUTS (or two sources) are compared in when asking
    "did the system give these different inputs the same output?"
    (score_caveats.near_constant_outputs).

    NFKC, casefold, invisible format characters (Cf) dropped, punctuation
    (P*) turned into spaces, whitespace collapsed — so 'Mun in dieđe.' and
    'mun in dieđe' are one output. Unlike :func:`normalize_for_compare`,
    diacritics are KEPT: between two outputs they distinguish words
    (Vietnamese 'ma' / 'mà' / 'mả'), so folding them would merge different
    translations and raise the false-positive rate of a repeat check; the
    source-copy check folds them because there a model can disguise a copy
    with them. Letter-free text (numbers, symbols) is compared literally,
    stripped and lowercased, as everywhere in this module.

    >>> repeat_compare_key("Mun  in dieđe!")
    'mun in dieđe'
    >>> repeat_compare_key("mà") == repeat_compare_key("ma")
    False
    """
    if not text:
        return ""
    folded = unicodedata.normalize("NFKC", text).casefold()
    out: list[str] = []
    for ch in folded:
        cat = unicodedata.category(ch)
        if cat == "Cf":
            continue
        out.append(" " if cat.startswith("P") else ch)
    key = " ".join("".join(out).split())
    if not has_letter(key):
        return _literal_form(text)
    return key
