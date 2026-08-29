# Ported from the internal corpora-builder's cli.py (founder decision
# 2026-08-27) — the three sampling/enrichment helpers the deterministic
# corpus REBUILD path needs (see corpus_build/__init__.py header for the
# full rationale). The private builder retains its own copies; per-pair
# sha guards surface any divergence loudly at publish time.
"""Deterministic filtering, enrichment, and stratified sampling.

These are the exact helpers the tatoeba adapters' build paths use — the
rebuild of a sha-pinned corpus must apply the identical word-count filter,
domain/difficulty enrichment, and stratified sample as the original build,
or the resulting file hashes differently and the publish guard refuses it.
"""
from __future__ import annotations

import random
from collections import Counter

from mt_eval_harness.corpus_build.adapters.base import RawEntry
from mt_eval_harness.corpus_build.difficulty_estimator import estimate_difficulty
from mt_eval_harness.corpus_build.domain_classifier import classify_domain


def _filter_by_word_count(
    entries: list[RawEntry],
    min_words: int,
    max_words: int,
) -> list[RawEntry]:
    """Filter entries to those within the word count bounds.

    Word count is based on the source text (typically English),
    since that's the language our difficulty estimator is calibrated
    for. We don't filter on target text word count because
    agglutinative languages can have very different token counts
    for semantically equivalent text.

    Args:
        entries: Raw entries from the source adapter.
        min_words: Minimum word count (inclusive).
        max_words: Maximum word count (inclusive).

    Returns:
        Filtered list of entries.
    """
    filtered: list[RawEntry] = []
    for entry in entries:
        word_count = len(entry.source_text.split())
        if min_words <= word_count <= max_words:
            filtered.append(entry)
    return filtered


def _enrich_entry(
    raw: RawEntry,
    adapter_name: str,
) -> CorpusEntry:
    """Transform a raw entry into a fully enriched corpus entry.

    Applies domain classification, difficulty estimation, and
    register inference. Each transformation is a pure function
    call — no side effects, no network requests.

    Args:
        raw: The raw parallel text entry from a source adapter.
        adapter_name: Name of the source adapter, used to construct
            the entry ID and provenance.

    Returns:
        A fully populated CorpusEntry.
    """
    # Classify domain from the source text (English-centric keywords)
    classification = classify_domain(raw.source_text)
    domain = classification.domain

    # Estimate difficulty from the source text
    difficulty_result = estimate_difficulty(raw.source_text)

    # Infer register from domain — crash if the domain isn't in the map,
    # because that means VALID_DOMAINS and _DOMAIN_TO_REGISTER are out of sync
    if domain not in _DOMAIN_TO_REGISTER:
        raise ValueError(
            f"Domain '{domain}' has no register mapping in _DOMAIN_TO_REGISTER. "
            f"This is a bug — every domain in VALID_DOMAINS must have a register mapping."
        )
    register = _DOMAIN_TO_REGISTER[domain]

    # Build the unique entry ID: adapter name + source-specific ID
    entry_id = f"{adapter_name}_{raw.source_id}"

    # Build provenance from the raw entry's metadata
    provenance: dict[str, Any] = {
        "source_name": adapter_name,
        "source_id": raw.source_id,
        "license": raw.metadata.get("license", "unknown"),
        "url": raw.metadata.get("url", ""),
    }

    # Store classification and difficulty details in metadata
    # so downstream consumers can audit how entries were tagged
    enrichment_metadata: dict[str, Any] = {
        **raw.metadata,
        "classification_confidence": classification.confidence,
        "difficulty_word_count": difficulty_result.word_count,
        "difficulty_estimated_clauses": difficulty_result.estimated_clauses,
        "difficulty_avg_word_length": difficulty_result.avg_word_length,
    }

    return CorpusEntry(
        id=entry_id,
        source=raw.source_text,
        reference=raw.target_text,
        domain=domain,
        difficulty=difficulty_result.tier,
        register=register,
        provenance=provenance,
        metadata=enrichment_metadata,
    )


def _stratified_sample(
    entries: list[CorpusEntry],
    max_entries: int,
    rng: random.Random,
) -> list[CorpusEntry]:
    """Sample entries with stratification across domains and difficulty tiers.

    The goal is a balanced corpus that covers as many domains and
    difficulty levels as possible, rather than being dominated by
    whatever domain the source happens to have the most data for.

    Strategy:
        1. Group entries by (domain, difficulty) pair.
        2. Compute a per-group quota: max_entries / number_of_groups,
           rounded up.
        3. Sample up to the quota from each group.
        4. If the total exceeds max_entries, trim by randomly removing
           entries from the largest groups first.

    This produces a more uniform distribution than simple random
    sampling, which would over-represent the dominant domain.

    Args:
        entries: All enriched entries (post-filtering, pre-sampling).
        max_entries: Target corpus size.
        rng: Seeded Random instance for reproducibility.

    Returns:
        A list of at most ``max_entries`` entries, stratified across
        domains and difficulty tiers.
    """
    if len(entries) <= max_entries:
        # Not enough entries to require sampling — return all of them
        return list(entries)

    # Group entries by (domain, difficulty) for stratification
    groups: dict[tuple[str, int], list[CorpusEntry]] = {}
    for entry in entries:
        key = (entry.domain, entry.difficulty)
        if key not in groups:
            groups[key] = []
        groups[key].append(entry)

    # Compute per-group quota — how many entries each group should
    # contribute to a balanced corpus
    num_groups = len(groups)
    base_quota = max_entries // num_groups
    # Distribute the remainder across the first N groups
    remainder = max_entries % num_groups

    sampled: list[CorpusEntry] = []
    group_keys = sorted(groups.keys())

    for i, key in enumerate(group_keys):
        group = groups[key]
        # Give one extra entry to the first `remainder` groups
        quota = base_quota + (1 if i < remainder else 0)
        # Sample up to the quota from this group
        if len(group) <= quota:
            sampled.extend(group)
        else:
            sampled.extend(rng.sample(group, quota))

    # Final trim: if rounding caused us to exceed max_entries
    if len(sampled) > max_entries:
        sampled = rng.sample(sampled, max_entries)

    return sampled
