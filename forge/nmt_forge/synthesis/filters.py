"""Plausibility filters are first-class, named, and counted — never ad hoc.

The reference implementation earned three of these the hard way
("anti-gobbledygook", founder directive 2026-07-12):

- locatives only make sense with PLACE nouns ("she sleeps in the house",
  not "she sleeps in the kindness");
- possessed objects only with verbs that plausibly take a thing/being
  ("I see your boat", not "I resemble your boat");
- two-clause partners should share gloss content ("If she cooks, we will
  eat", not "If she eats, I will swim").

A Filter carries a NAME and a RATIONALE because its drops are counted in the
synthesis funnel: "what did this filter remove and why" is a reported number,
not a code comment.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Collection
from dataclasses import dataclass

_WORD_RE = re.compile(r"[a-z']+")

# function words excluded from gloss-content comparison (from the reference
# partner-assignment implementation)
DEFAULT_STOPWORDS = frozenset(
    "the his her their own something someone objpron things thing with for".split()
)


@dataclass(frozen=True)
class Filter:
    name: str
    rationale: str
    fn: Callable[[object], bool]  # Candidate -> keep?

    def __post_init__(self):
        if not self.rationale.strip():
            raise ValueError(
                f"filter {self.name!r} needs a rationale — its drop count is "
                "reported, and the report must be explainable"
            )

    def __call__(self, candidate) -> bool:
        return self.fn(candidate)


def content_tokens(text: str, stopwords: Collection[str] = DEFAULT_STOPWORDS) -> set[str]:
    """Lowercase content words of a gloss (≥3 chars, minus function words)."""
    return {
        t for t in _WORD_RE.findall(text.lower())
        if len(t) > 2 and t not in stopwords
    }


def meta_token_whitelist(
    name: str, meta_field: str, allowed: Collection[str], rationale: str
) -> Filter:
    """Keep a candidate iff meta[field]'s content tokens intersect ``allowed``.

    The place-noun pattern: ``meta_token_whitelist("locative_place_nouns",
    "noun_gloss", PLACE_WORDS, "locatives only make sense with place nouns")``.
    """
    allowed_set = {a.lower() for a in allowed}

    def fn(c) -> bool:
        return bool(content_tokens(str(c.meta.get(meta_field, ""))) & allowed_set)

    return Filter(name, rationale, fn)


def meta_value_whitelist(
    name: str, meta_field: str, allowed: Collection[str], rationale: str
) -> Filter:
    """Keep iff meta[field] is exactly one of ``allowed`` (the object-verb
    whitelist pattern: only verbs that plausibly take an object)."""
    allowed_set = {a.lower() for a in allowed}

    def fn(c) -> bool:
        return str(c.meta.get(meta_field, "")).lower() in allowed_set

    return Filter(name, rationale, fn)


def meta_overlap(
    name: str,
    field_a: str,
    field_b: str,
    rationale: str,
    *,
    min_shared: int = 1,
    stopwords: Collection[str] = DEFAULT_STOPWORDS,
) -> Filter:
    """Keep iff two meta fields share ≥ ``min_shared`` content tokens (the
    semantic partner-relatedness pattern for multi-clause templates)."""

    def fn(c) -> bool:
        a = content_tokens(str(c.meta.get(field_a, "")), stopwords)
        b = content_tokens(str(c.meta.get(field_b, "")), stopwords)
        return len(a & b) >= min_shared

    return Filter(name, rationale, fn)


# -- source-language well-formedness (mistake: broken EN teaches broken maps) --

# The crk reference run emitted "The poor man bes poor." and "The woman
# thinks of as heavy the bullet." — grammatical Cree paired with broken
# English (2026-07-13 ledger). A model trained on such pairs learns a
# template-English register that real inputs never match. This filter is the
# generic hook; the English default catches the measured failure classes.

_EN_BAD = (
    re.compile(r"\bbes\b"),                                # unconjugated copula 3sg
    re.compile(r"^(?:i|you|we|they|the\s+\S+)\s+be\s", re.I),  # bare 'be' finite slot
    re.compile(r"\b(?:at|to|for|on|in|with|of)\s+(?:at|to|for|on|in|with|of)\b"),
    re.compile(r"\{obj\}|\bobjpron\b|\bs\.\s?[ot]\b"),     # placeholder residue
    re.compile(r"\bof\s+as\b"),                            # 'thinks of as heavy X'
    re.compile(r"\s{2,}|\(\s*\)"),                         # collapse artifacts
)


def source_wellformedness(
    field: str = "source",
    patterns: tuple[re.Pattern, ...] = _EN_BAD,
    name: str = "source_wellformedness_en",
) -> Filter:
    """Reject candidates whose rendered SOURCE text matches a known breakage
    pattern. Language-configurable: pass your own patterns for non-English
    source languages; the default encodes the English failure classes the
    crk reference measured (unconjugated copula, doubled prepositions,
    placeholder residue, dislocated 'of as' complements)."""
    def _ok(candidate) -> bool:
        text = str(getattr(candidate, field, None)
                   or (candidate.get(field, "") if isinstance(candidate, dict) else ""))
        low = text.lower()
        return not any(p.search(low) for p in patterns)
    return Filter(
        name=name,
        rationale="broken source text teaches a register real inputs never "
                  "match (crk 2026-07-13: 'bes', 'thinks of as heavy the "
                  "bullet'); rendered sources must be well-formed",
        fn=_ok,
    )
