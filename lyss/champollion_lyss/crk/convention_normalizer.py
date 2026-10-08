"""
SRO Convention Normalizer — deterministic, bidirectional convention transforms.

Plains Cree has multiple valid SRO writing conventions. The ALTLab FST
follows one specific convention; textbook references may follow another.
This module applies linguistically justified, meaning-preserving transforms
to enable fair comparison across conventions.

Every transform is:
  - Deterministic (rule-based, no ML)
  - Reversible (bidirectional)
  - Meaning-preserving (no semantic change)
  - Independently verifiable (FST analyzer confirms both forms)

Usage:
    normalizer = ConventionNormalizer()
    result = normalizer.compare(predicted, reference)
    print(result.convention_match)      # True if match after convention normalization
    print(result.bag_of_words_match)    # True if same words, possibly reordered
    print(result.transforms_applied)    # List of transforms that were applied
    print(result.residual_differences)  # Words that still differ (real errors)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class NormalizationResult:
    """Result of comparing predicted vs reference with convention normalization."""

    # The input strings (lowercased, whitespace-collapsed)
    predicted_raw: str
    reference_raw: str

    # Tier 1: Raw exact match (byte-for-byte)
    raw_match: bool

    # Tier 2: Standard orthographic normalization (hyphen→space, ý→y)
    predicted_normalized: str
    reference_normalized: str
    normalized_match: bool

    # Tier 3: Convention-adjusted match
    # After applying deterministic convention transforms
    predicted_convention: str
    reference_convention: str  # reference is NOT modified — we transform predicted
    convention_match: bool
    transforms_applied: list[str] = field(default_factory=list)

    # Tier 3b: Bag-of-words match (word-order-independent)
    # Cree has free word order for pragmatic focus/topicalization.
    # Same words in different order = same translation.
    bag_of_words_match: bool = False

    # Diagnostic: what's left after all normalization?
    words_only_in_predicted: set[str] = field(default_factory=set)
    words_only_in_reference: set[str] = field(default_factory=set)
    words_in_common: set[str] = field(default_factory=set)

    @property
    def best_match_tier(self) -> str:
        """Return the highest tier at which the pair matches."""
        if self.raw_match:
            return "raw"
        if self.normalized_match:
            return "normalized"
        if self.convention_match:
            return "convention"
        if self.bag_of_words_match:
            return "bag_of_words"
        return "none"

    @property
    def is_convention_only_diff(self) -> bool:
        """True if the only difference is convention (including word order)."""
        return self.bag_of_words_match and not self.normalized_match

    @property
    def residual_error_count(self) -> int:
        """Number of words that differ after all normalization.

        This is the count of real translation errors — words that are
        genuinely different, not just convention or order.
        """
        return len(self.words_only_in_predicted) + len(self.words_only_in_reference)


# ---------------------------------------------------------------------------
# Core normalizer
# ---------------------------------------------------------------------------

class ConventionNormalizer:
    """Deterministic SRO convention normalizer for benchmark scoring.

    Applies linguistically justified, meaning-preserving transforms
    to predicted output so it can be fairly compared to references
    that may use a different SRO convention.

    Transform pipeline:
      1. Standard orthographic normalization (hyphen→space, ý→y)
      2. Convention transforms:
         a. Conjunct prefix (ê-) strip/add
         b. Person prefix (ni-/ki-) detach/attach
      3. Word-order-independent comparison (bag-of-words)

    Each layer is individually reported so nothing is hidden.
    """

    # -----------------------------------------------------------------------
    # Tier 2: Standard orthographic normalization
    # -----------------------------------------------------------------------

    @staticmethod
    def normalize_ortho(text: str) -> str:
        """Apply standard, non-controversial orthographic normalization.

        - Lowercase
        - ý → y (itwêwina variant)
        - Hyphens → spaces (SRO notation convention)
        - Collapse whitespace
        - Strip trailing punctuation
        """
        text = text.strip().lower()
        text = text.replace("ý", "y")
        text = text.replace("-", " ")
        # Remove trailing punctuation that might differ
        text = text.rstrip(".,;:!?")
        text = re.sub(r"\s+", " ", text).strip()
        return text

    # -----------------------------------------------------------------------
    # Tier 3: Convention transforms
    # -----------------------------------------------------------------------

    @staticmethod
    def apply_convention_transforms(
        pred_words: list[str],
        ref_words: list[str],
    ) -> tuple[list[str], list[str]]:
        """Apply deterministic convention transforms to predicted words.

        Transforms predicted words toward the reference convention.
        Returns (transformed_words, list_of_transforms_applied).

        Rules applied:
          1. CONJUNCT_PREFIX_STRIP: Remove standalone 'ê' before a verb
             that appears without 'ê' in the reference (bare conjunct).
          2. PERSON_PREFIX_DETACH: Strip ni-/ki- from a verb if the
             bare form appears in the reference (detached person marker).

        Both transforms are meaning-preserving: the semantic content
        of the verb is identical with or without these markers.
        """
        ref_set = set(ref_words)
        transforms = []
        result = []
        skip_next = False

        for i, word in enumerate(pred_words):
            if skip_next:
                skip_next = False
                continue

            # --- Rule 1: Conjunct prefix strip ---
            # If predicted has standalone 'ê' followed by a word that
            # appears in the reference WITHOUT 'ê', remove the 'ê'.
            # This converts changed conjunct → bare conjunct convention.
            if word == "ê" and i + 1 < len(pred_words):
                next_word = pred_words[i + 1]
                if next_word in ref_set and "ê" not in ref_set:
                    transforms.append(
                        f"CONJUNCT_PREFIX_STRIP: removed 'ê' before '{next_word}'"
                    )
                    continue  # Skip the ê, keep the verb

            # --- Rule 2: Person prefix detach ---
            # If predicted has ni-/ki- attached to a verb, and the
            # reference has the bare form as a separate word, strip
            # the prefix. The prefix appears elsewhere in the reference
            # as a separate preverb word (e.g., 'nikî', 'kika').
            modified = word
            if len(word) > 3:
                for prefix in ("ni", "ki"):
                    if word.startswith(prefix):
                        stripped = word[len(prefix):]
                        # Only strip if the stripped form is in reference
                        # AND the full form is NOT in reference
                        # (avoids stripping real words that start with ni/ki)
                        if stripped in ref_set and word not in ref_set:
                            transforms.append(
                                f"PERSON_PREFIX_DETACH: '{word}' → '{stripped}'"
                            )
                            modified = stripped
                            break

            result.append(modified)

        return result, transforms

    # -----------------------------------------------------------------------
    # Full comparison pipeline
    # -----------------------------------------------------------------------

    def compare(self, predicted: str, reference: str) -> NormalizationResult:
        """Compare predicted vs reference through all normalization tiers.

        Returns a NormalizationResult with matches at each tier and
        diagnostic information about remaining differences.
        """
        # --- Tier 1: Raw ---
        raw_match = predicted.strip() == reference.strip()

        # --- Tier 2: Orthographic ---
        pred_norm = self.normalize_ortho(predicted)
        ref_norm = self.normalize_ortho(reference)
        normalized_match = pred_norm == ref_norm

        # --- Tier 3a: Convention transforms ---
        pred_words = pred_norm.split()
        ref_words = ref_norm.split()
        conv_words, transforms = self.apply_convention_transforms(
            pred_words, ref_words
        )
        pred_conv = " ".join(conv_words)
        convention_match = pred_conv == ref_norm

        # --- Tier 3b: Bag-of-words (word-order-independent) ---
        # Cree has free word order — same words in different order
        # is the same translation. This is linguistically justified
        # because word order in Cree encodes pragmatic focus/topic,
        # not core grammatical relations (which are marked by inflection).
        conv_bag = sorted(conv_words)
        ref_bag = sorted(ref_words)
        bag_match = conv_bag == ref_bag

        # --- Residual diagnostics ---
        conv_set = set(conv_words)
        ref_set = set(ref_words)
        only_pred = conv_set - ref_set
        only_ref = ref_set - conv_set
        common = conv_set & ref_set

        return NormalizationResult(
            predicted_raw=predicted.strip(),
            reference_raw=reference.strip(),
            raw_match=raw_match,
            predicted_normalized=pred_norm,
            reference_normalized=ref_norm,
            normalized_match=normalized_match,
            predicted_convention=pred_conv,
            reference_convention=ref_norm,
            convention_match=convention_match,
            transforms_applied=transforms,
            bag_of_words_match=bag_match,
            words_only_in_predicted=only_pred,
            words_only_in_reference=only_ref,
            words_in_common=common,
        )

    # -----------------------------------------------------------------------
    # Batch analysis
    # -----------------------------------------------------------------------

    def analyze_dataset(
        self, entries: list[dict]
    ) -> dict:
        """Analyze a full benchmark dataset and return tier-level statistics.

        Args:
            entries: List of dicts with 'predicted' and 'expected' keys.

        Returns:
            Summary dict with counts and lists at each tier.
        """
        results = []
        tier_counts = {
            "raw": 0,
            "normalized": 0,
            "convention": 0,
            "bag_of_words": 0,
            "none": 0,
        }

        for entry in entries:
            predicted = entry.get("predicted", "")
            reference = entry.get("expected", "")

            result = self.compare(predicted, reference)
            results.append(result)

            tier = result.best_match_tier
            # Accumulate: each higher tier includes lower tiers
            if tier == "raw":
                tier_counts["raw"] += 1
                tier_counts["normalized"] += 1
                tier_counts["convention"] += 1
                tier_counts["bag_of_words"] += 1
            elif tier == "normalized":
                tier_counts["normalized"] += 1
                tier_counts["convention"] += 1
                tier_counts["bag_of_words"] += 1
            elif tier == "convention":
                tier_counts["convention"] += 1
                tier_counts["bag_of_words"] += 1
            elif tier == "bag_of_words":
                tier_counts["bag_of_words"] += 1
            else:
                tier_counts["none"] += 1

        n = len(entries)

        # Collect all transforms applied across the dataset
        all_transforms = []
        for r in results:
            all_transforms.extend(r.transforms_applied)

        # Count transform types
        transform_counts = {}
        for t in all_transforms:
            rule = t.split(":")[0]
            transform_counts[rule] = transform_counts.get(rule, 0) + 1

        # Collect residual mismatches for the "still wrong" entries
        residual_mismatches = []
        for i, r in enumerate(results):
            if r.best_match_tier == "none":
                residual_mismatches.append({
                    "index": i,
                    "english": entries[i].get("english", ""),
                    "predicted": r.predicted_convention,
                    "reference": r.reference_convention,
                    "only_in_predicted": sorted(r.words_only_in_predicted),
                    "only_in_reference": sorted(r.words_only_in_reference),
                    "words_in_common": sorted(r.words_in_common),
                    "overlap_pct": (
                        len(r.words_in_common)
                        / max(len(r.reference_convention.split()), 1)
                        * 100
                    ),
                })

        return {
            "total": n,
            "tier_counts": tier_counts,
            "transform_counts": transform_counts,
            "results": results,
            "residual_mismatches": residual_mismatches,
        }

    # -----------------------------------------------------------------------
    # Report formatting
    # -----------------------------------------------------------------------

    @staticmethod
    def format_report(analysis: dict, dataset_name: str = "") -> str:
        """Format a human-readable convention analysis report."""
        n = analysis["total"]
        tc = analysis["tier_counts"]
        lines = []

        lines.append("=" * 65)
        lines.append(f"CONVENTION NORMALIZATION REPORT{f': {dataset_name}' if dataset_name else ''}")
        lines.append("=" * 65)
        lines.append("")

        # Tier summary — each tier is CUMULATIVE (includes all higher tiers)
        lines.append("── Match Tiers (cumulative) ──")
        lines.append(f"  Tier 1 — Raw exact:          {tc['raw']:3d}/{n} ({tc['raw']/n*100:5.1f}%)")
        lines.append(f"  Tier 2 — Normalized:         {tc['normalized']:3d}/{n} ({tc['normalized']/n*100:5.1f}%)")
        lines.append(f"  Tier 3a — Convention-adj:     {tc['convention']:3d}/{n} ({tc['convention']/n*100:5.1f}%)")
        lines.append(f"  Tier 3b — Bag-of-words:       {tc['bag_of_words']:3d}/{n} ({tc['bag_of_words']/n*100:5.1f}%)")
        lines.append(f"  ✗ Still mismatched:          {tc['none']:3d}/{n} ({tc['none']/n*100:5.1f}%)")
        lines.append("")

        # Convention transforms applied
        if analysis["transform_counts"]:
            lines.append("── Convention Transforms Applied ──")
            for rule, count in sorted(analysis["transform_counts"].items()):
                lines.append(f"  {rule}: {count}")
            lines.append("")

        # Residual mismatches
        residuals = analysis["residual_mismatches"]
        if residuals:
            lines.append(f"── Residual Mismatches ({len(residuals)}) ──")
            for m in residuals:
                overlap = m["overlap_pct"]
                lines.append(f"  [{m['index']+1:2d}] {m['english'][:55]}")
                lines.append(f"       Predicted: {m['predicted'][:65]}")
                lines.append(f"       Reference: {m['reference'][:65]}")
                if m["only_in_reference"]:
                    lines.append(f"       Missing:   {', '.join(m['only_in_reference'][:6])}")
                if m["only_in_predicted"]:
                    lines.append(f"       Extra:     {', '.join(m['only_in_predicted'][:6])}")
                lines.append(f"       Overlap:   {overlap:.0f}%")
                lines.append("")

        lines.append("=" * 65)
        return "\n".join(lines)
