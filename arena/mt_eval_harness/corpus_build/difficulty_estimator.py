# Ported from the internal corpora-builder (founder decision 2026-08-27):
# the fetch-on-miss corpus REBUILD path must work in the open-source harness
# — 5,595 of 5,602 registry corpora are fetch-from-source and corpus content
# is never tracked, so without these primitives a public clone could browse
# the queue and rebuild nothing (docs/PRE_REVIEW_HARDENING_2026-08-27.md).
# The intake/probe/recipe-authoring tooling remains in the private builder;
# this subpackage ships with the harness under the harness's license.
# Byte-parity with the private builder's copy is protected by the per-pair
# sha guards: a divergent rebuild fails loudly at publish, never silently.
"""
Difficulty tier estimation for parallel text entries.

Assigns a difficulty tier (1–5) to each source sentence based on
surface-level linguistic features. This is deliberately a heuristic
estimator rather than a learned model, because:

    1. The features that drive translation difficulty (sentence length,
       clause count, vocabulary complexity) are well-approximated by
       simple surface heuristics for the kind of text in our corpora.
    2. Reproducibility: the same input always produces the same tier,
       with no model weights or random initialization involved.
    3. Zero dependencies: runs on the standard library alone.

The three features used:
    - **Word count**: The most reliable single predictor of translation
      difficulty. Longer sentences have more opportunities for reordering,
      agreement errors, and ambiguity.
    - **Clause count** (estimated): Approximated by counting commas,
      semicolons, and coordinating/subordinating conjunctions. This is
      a rough proxy — it overcounts in lists and undercounts in long
      clauses without punctuation — but it's good enough for binning
      into 5 tiers.
    - **Average word length**: A proxy for vocabulary complexity.
      Longer words tend to be more specialized (e.g. "contraindication"
      vs "pill"). This is language-dependent and works best for English;
      for agglutinative languages it's less meaningful, but since we
      classify based on the English source text, it's adequate.

Tier boundaries:
    ┌──────┬─────────────┬─────────────────────┬──────────────────────────┐
    │ Tier │ Word count  │ Clause heuristic    │ Description              │
    ├──────┼─────────────┼─────────────────────┼──────────────────────────┤
    │  1   │ 1–5         │ 1 clause            │ Basic vocabulary, labels │
    │  2   │ 6–10        │ 1 clause            │ Simple sentences         │
    │  3   │ 11–18       │ 1–2 clauses         │ Moderate complexity      │
    │  4   │ 19–30       │ 2–3 clauses         │ Complex sentences        │
    │  5   │ 31+         │ 3+ clauses          │ Advanced, multi-clause   │
    └──────┴─────────────┴─────────────────────┴──────────────────────────┘
"""

from __future__ import annotations

from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Clause boundary markers
# ---------------------------------------------------------------------------
# These tokens are used as heuristic clause boundary indicators.
# Punctuation-based markers (commas, semicolons) are checked separately
# from conjunction-based markers because punctuation is already removed
# during word splitting, so we need to scan the raw text for them.
#
# This list intentionally excludes "that" because it appears too
# frequently as a determiner/pronoun (not just a subordinator) and
# would massively overcount clauses.

_CLAUSE_CONJUNCTIONS: frozenset[str] = frozenset({
    "and", "but", "or", "nor",           # coordinating
    "because", "although", "though",     # subordinating
    "while", "whereas", "unless",        # subordinating
    "if", "when", "where",               # subordinating
    "which", "who", "whom",              # relative
})

# Punctuation characters that typically indicate clause boundaries
_CLAUSE_PUNCTUATION: str = ",;:"


@dataclass(frozen=True)
class DifficultyResult:
    """Result of difficulty estimation for a single text.

    Attributes:
        tier: Integer difficulty tier from 1 (basic) to 5 (advanced).
        word_count: Number of whitespace-delimited tokens.
        estimated_clauses: Heuristic clause count based on punctuation
            and conjunction markers.
        avg_word_length: Mean character length of words, as a proxy
            for vocabulary complexity.
    """

    tier: int
    word_count: int
    estimated_clauses: int
    avg_word_length: float


def _count_clauses(text: str, words: list[str]) -> int:
    """Estimate the number of clauses in a sentence.

    Counts clause boundary markers in two passes:
        1. Punctuation markers (comma, semicolon, colon) in the raw text.
        2. Conjunction words in the tokenized word list.

    The base clause count is 1 (every sentence has at least one clause),
    and each boundary marker adds one additional clause.

    Args:
        text: The raw source text (needed for punctuation scanning).
        words: Pre-tokenized list of lowercase words.

    Returns:
        Estimated clause count (minimum 1).
    """
    # Start with 1 — every sentence has at least one clause
    clause_count = 1

    # Count punctuation-based boundaries in the raw text
    for char in text:
        if char in _CLAUSE_PUNCTUATION:
            clause_count += 1

    # Count conjunction-based boundaries in the word list
    for word in words:
        if word in _CLAUSE_CONJUNCTIONS:
            clause_count += 1

    return clause_count


def _compute_avg_word_length(words: list[str]) -> float:
    """Compute the mean character length of words.

    Args:
        words: List of words (any casing). Must not be empty — an
            empty list means the filtering pipeline failed to exclude
            empty text upstream, which is a bug.

    Returns:
        Mean word length as a float, rounded to 2 decimal places.

    Raises:
        ValueError: If the word list is empty.
    """
    if not words:
        raise ValueError(
            "Cannot compute average word length for empty word list. "
            "This indicates empty text reached the difficulty estimator — "
            "check upstream filtering."
        )

    total_chars = sum(len(word) for word in words)
    avg = total_chars / len(words)
    return round(avg, 2)


def _assign_tier(word_count: int, clause_count: int) -> int:
    """Map word count and clause count to a difficulty tier.

    The primary driver is word count — it determines the base tier.
    Clause count acts as a secondary signal that can push a sentence
    up one tier if the clause density is high relative to the word
    count range.

    We use word count as the primary axis because it's the most
    stable and language-independent feature. Clause count is noisier
    (comma usage varies by author and language) so it only nudges
    the tier, never drives it.

    Args:
        word_count: Number of words in the sentence.
        clause_count: Estimated number of clauses.

    Returns:
        Integer tier from 1 to 5 (inclusive).
    """
    # Base tier from word count
    if word_count <= 5:
        base_tier = 1
    elif word_count <= 10:
        base_tier = 2
    elif word_count <= 18:
        base_tier = 3
    elif word_count <= 30:
        base_tier = 4
    else:
        base_tier = 5

    # Clause-based nudge: if the clause count is high relative to
    # what's typical for this word count range, bump up one tier.
    # This catches sentences that are short but syntactically dense
    # (e.g. "If you go, call me, and I'll come" — 10 words, 3 clauses).
    clause_nudge = 0
    if base_tier <= 2 and clause_count >= 2:
        clause_nudge = 1
    elif base_tier == 3 and clause_count >= 3:
        clause_nudge = 1
    elif base_tier == 4 and clause_count >= 4:
        clause_nudge = 1
    # Tier 5 can't be nudged higher

    final_tier = min(base_tier + clause_nudge, 5)
    return final_tier


def estimate_difficulty(text: str) -> DifficultyResult:
    """Estimate the difficulty tier of a source text.

    Analyzes surface-level features (word count, clause count,
    average word length) and maps them to a 1–5 difficulty tier.

    Args:
        text: The source text to analyze. Should be the English side
            of a parallel entry, since the heuristics (especially
            average word length) are calibrated for English.

    Returns:
        A DifficultyResult containing the tier and all raw features
        used to compute it.
    """
    # Tokenize by whitespace — simple but sufficient for English.
    # We lowercase for conjunction matching but preserve the original
    # word boundaries.
    words_raw = text.split()
    words_lower = [word.lower().strip(".,;:!?\"'()[]{}") for word in words_raw]
    # Filter out empty strings that can result from stripping punctuation-only tokens
    words_lower = [w for w in words_lower if w]

    word_count = len(words_lower)
    clause_count = _count_clauses(text, words_lower)
    avg_word_length = _compute_avg_word_length(words_lower)
    tier = _assign_tier(word_count, clause_count)

    return DifficultyResult(
        tier=tier,
        word_count=word_count,
        estimated_clauses=clause_count,
        avg_word_length=avg_word_length,
    )
