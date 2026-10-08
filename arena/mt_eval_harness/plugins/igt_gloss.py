"""
IGT Glossing Metrics — SIGMORPHON-style token accuracy for interlinear gloss.

Implements the scoring definitions of the SIGMORPHON 2023 Glossing Shared Task
(sigmorphon/2023glossingST, baseline/src/eval.py):

    - Word-level accuracy: positional, case-sensitive comparison of predicted
      vs gold gloss tokens. A predicted token counts as correct iff it exists
      at the same index, equals the gold token exactly, and is not "[UNK]".
    - Morpheme-level accuracy: the same positional rule applied to the
      flattened morpheme sequence (gloss words split on "-" and "=").
    - Stem vs gram classes: a morpheme gloss is a GRAM iff str.isupper() is
      True (e.g. "PL", "3SG"), otherwise a STEM (e.g. "dog"). Precision,
      recall, and F1 are reported per class at the morpheme level.
    - Aggregates report both the macro average over entries
      ("average_accuracy") and the micro corpus ratio ("overall_accuracy"),
      matching the shared-task script's two figures.

Entry fields consumed:
    - "predicted": the system's gloss line for the sentence
    - "expected":  the gold gloss line

The metric is language-neutral: it is declared on a language card via
evalMetrics (module: mt_eval_harness.plugins.igt_gloss, class: IGTGlossMetric)
or attached explicitly by a task configuration.

Parity note: definitions follow the shared task's published description and
evaluation script structure; exact-output parity against baseline/src/eval.py
on their released data is tracked as a pending verification step.
"""

from __future__ import annotations

import re

UNK_TOKEN = "[UNK]"

_MORPHEME_SPLIT = re.compile(r"[-=]")


def _words(line: str) -> list[str]:
    return line.split()


def _morphemes(line: str) -> list[str]:
    """Flatten a gloss line into its morpheme sequence.

    Words are split on the IGT morpheme separators "-" (affix) and "="
    (clitic); empty pieces from doubled/leading separators are dropped.
    """
    out: list[str] = []
    for word in line.split():
        out.extend(p for p in _MORPHEME_SPLIT.split(word) if p)
    return out


def _positional_correct(pred: list[str], gold: list[str]) -> int:
    """Count gold positions where the prediction matches exactly.

    SIGMORPHON rule: index must exist in the prediction, tokens must be
    equal (case-sensitive), and the predicted token must not be [UNK].
    """
    correct = 0
    for i, g in enumerate(gold):
        if i < len(pred) and pred[i] == g and pred[i] != UNK_TOKEN:
            correct += 1
    return correct


def _is_gram(morpheme: str) -> bool:
    """GRAM iff the gloss is uppercase (isupper ignores digits: '3SG' → True)."""
    return morpheme.isupper()


class IGTGlossMetric:
    """SIGMORPHON-style glossing accuracy (word + morpheme level, stem/gram)."""

    name = "igt_gloss"

    def compute(self, entry: dict) -> dict:
        predicted = (entry.get("predicted") or "").strip()
        expected = (entry.get("expected") or "").strip()

        gold_words = _words(expected)
        pred_words = _words(predicted)
        gold_morphs = _morphemes(expected)
        pred_morphs = _morphemes(predicted)

        word_correct = _positional_correct(pred_words, gold_words)
        morph_correct = _positional_correct(pred_morphs, gold_morphs)

        # Stem/gram tallies at the morpheme level. Gold positions define
        # recall denominators; predicted positions define precision
        # denominators; a positional exact match is a TP for its class.
        tallies = {
            "stem": {"tp": 0, "fp": 0, "fn": 0},
            "gram": {"tp": 0, "fp": 0, "fn": 0},
        }
        for i, g in enumerate(gold_morphs):
            cls = "gram" if _is_gram(g) else "stem"
            if i < len(pred_morphs) and pred_morphs[i] == g and g != UNK_TOKEN:
                tallies[cls]["tp"] += 1
            else:
                tallies[cls]["fn"] += 1
        for i, p in enumerate(pred_morphs):
            if p == UNK_TOKEN:
                continue
            matched = i < len(gold_morphs) and gold_morphs[i] == p
            if not matched:
                cls = "gram" if _is_gram(p) else "stem"
                tallies[cls]["fp"] += 1

        return {
            "gloss_word_correct": word_correct,
            "gloss_word_total": len(gold_words),
            "gloss_word_accuracy": word_correct / len(gold_words) if gold_words else 0.0,
            "gloss_morpheme_correct": morph_correct,
            "gloss_morpheme_total": len(gold_morphs),
            "gloss_morpheme_accuracy": (
                morph_correct / len(gold_morphs) if gold_morphs else 0.0
            ),
            "gloss_class_tallies": tallies,
        }

    @staticmethod
    def _prf(tp: int, fp: int, fn: int) -> dict:
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = (
            2 * precision * recall / (precision + recall)
            if precision + recall
            else 0.0
        )
        return {"precision": precision, "recall": recall, "f1": f1}

    def aggregate(self, entry_results: list[dict]) -> dict:
        scored = [r for r in entry_results if r.get("gloss_word_total", 0) > 0]
        if not scored:
            return {"gloss_available": False}

        word_correct = sum(r["gloss_word_correct"] for r in scored)
        word_total = sum(r["gloss_word_total"] for r in scored)
        morph_scored = [r for r in scored if r.get("gloss_morpheme_total", 0) > 0]
        morph_correct = sum(r["gloss_morpheme_correct"] for r in morph_scored)
        morph_total = sum(r["gloss_morpheme_total"] for r in morph_scored)

        classes = {}
        for cls in ("stem", "gram"):
            tp = sum(r["gloss_class_tallies"][cls]["tp"] for r in scored)
            fp = sum(r["gloss_class_tallies"][cls]["fp"] for r in scored)
            fn = sum(r["gloss_class_tallies"][cls]["fn"] for r in scored)
            classes[cls] = self._prf(tp, fp, fn)

        return {
            "gloss_available": True,
            # Macro: mean of per-entry accuracies (SIGMORPHON average_accuracy)
            "gloss_word_average_accuracy": (
                sum(r["gloss_word_accuracy"] for r in scored) / len(scored)
            ),
            # Micro: corpus-level ratio (SIGMORPHON overall_accuracy)
            "gloss_word_overall_accuracy": word_correct / word_total,
            "gloss_morpheme_average_accuracy": (
                sum(r["gloss_morpheme_accuracy"] for r in morph_scored)
                / len(morph_scored)
                if morph_scored
                else 0.0
            ),
            "gloss_morpheme_overall_accuracy": (
                morph_correct / morph_total if morph_total else 0.0
            ),
            "gloss_classes": classes,
            "gloss_entries_scored": len(scored),
        }
