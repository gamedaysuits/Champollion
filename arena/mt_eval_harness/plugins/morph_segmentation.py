"""
Morpheme Segmentation Metric — multiset morpheme F1.

Scores predicted morphological segmentations against gold segmentations in
the style of the SIGMORPHON morpheme segmentation shared tasks: precision,
recall, and F1 over the multiset of predicted vs gold morphemes.

Alignment model:
    - Lines are split into words on whitespace; words are compared
      positionally (word i of the prediction vs word i of the gold).
    - Within an aligned word pair, morphemes (split on "-" and "=") are
      matched as multisets: shared morphemes are true positives, surplus
      predicted morphemes are false positives, unmatched gold morphemes are
      false negatives.
    - Words present on only one side contribute all their morphemes as
      false positives (prediction side) or false negatives (gold side).

Aggregates report micro P/R/F1 (corpus-level tallies) and the macro mean of
per-entry F1. Entry fields consumed: "predicted", "expected".

Declared on a language card via evalMetrics
(module: mt_eval_harness.plugins.morph_segmentation,
class: MorphSegmentationMetric) or attached by a task configuration.
"""

from __future__ import annotations

import re
from collections import Counter

_MORPHEME_SPLIT = re.compile(r"[-=]")


def _word_morphemes(word: str) -> Counter:
    return Counter(p for p in _MORPHEME_SPLIT.split(word) if p)


def _tally(predicted: str, expected: str) -> tuple[int, int, int]:
    """Return (tp, fp, fn) for one entry under positional word alignment."""
    pred_words = predicted.split()
    gold_words = expected.split()
    tp = fp = fn = 0
    for i in range(max(len(pred_words), len(gold_words))):
        pred_m = _word_morphemes(pred_words[i]) if i < len(pred_words) else Counter()
        gold_m = _word_morphemes(gold_words[i]) if i < len(gold_words) else Counter()
        shared = pred_m & gold_m
        n_shared = sum(shared.values())
        tp += n_shared
        fp += sum(pred_m.values()) - n_shared
        fn += sum(gold_m.values()) - n_shared
    return tp, fp, fn


def _prf(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


class MorphSegmentationMetric:
    """Multiset morpheme P/R/F1 for segmentation tasks."""

    name = "morph_segmentation"

    def compute(self, entry: dict) -> dict:
        predicted = (entry.get("predicted") or "").strip()
        expected = (entry.get("expected") or "").strip()

        tp, fp, fn = _tally(predicted, expected)
        precision, recall, f1 = _prf(tp, fp, fn)
        return {
            "seg_tp": tp,
            "seg_fp": fp,
            "seg_fn": fn,
            "seg_precision": precision,
            "seg_recall": recall,
            "seg_f1": f1,
        }

    def aggregate(self, entry_results: list[dict]) -> dict:
        scored = [
            r for r in entry_results
            if (r.get("seg_tp", 0) + r.get("seg_fn", 0)) > 0
        ]
        if not scored:
            return {"seg_available": False}

        tp = sum(r["seg_tp"] for r in scored)
        fp = sum(r["seg_fp"] for r in scored)
        fn = sum(r["seg_fn"] for r in scored)
        precision, recall, f1 = _prf(tp, fp, fn)

        return {
            "seg_available": True,
            "seg_micro_precision": precision,
            "seg_micro_recall": recall,
            "seg_micro_f1": f1,
            "seg_macro_f1": sum(r["seg_f1"] for r in scored) / len(scored),
            "seg_entries_scored": len(scored),
        }
