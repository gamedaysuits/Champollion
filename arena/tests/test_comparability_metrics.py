"""P4 — spBLEU + plain chrF comparability metrics.

These are REPORTED sidecar metrics (apples-to-apples vs FLORES/NLLB/WMT tables),
never part of the composite. The tests pin both: they compute, and they are NOT
in any composite profile.
"""

from __future__ import annotations

import pytest

pytest.importorskip("sacrebleu")

from sacrebleu.metrics import BLEU, CHRF

from mt_eval_harness.scoring import PROFILE_REGISTRY

# Long enough for BLEU's 4-grams (short sentences give spBLEU ~0 even when identical).
PREDS = [
    "the quick brown fox jumps over the lazy dog every morning",
    "a small dog ran quickly across the green park this afternoon",
]
REFS = list(PREDS)


def test_plain_chrf_computes():
    # word_order=0 = plain chrF (vs the composite's chrF++ = word_order=2).
    score = CHRF(word_order=0).corpus_score(PREDS, [REFS]).score
    assert score > 99.0  # identical text → ~100 (allow tiny float overshoot)


def test_spbleu_flores200_tokenizer():
    # BLEU(tokenize="flores200") constructs eagerly + needs sentencepiece; the
    # SPM model downloads on first use. Skip cleanly if unavailable (offline CI).
    try:
        score = BLEU(tokenize="flores200").corpus_score(PREDS, [REFS]).score
    except Exception as e:
        pytest.skip(f"spBLEU (FLORES-200 SentencePiece) unavailable: {e}")
    assert score > 99.0  # identical text → ~100 (allow tiny float overshoot)


def test_comparability_metrics_are_sidecar_not_in_any_profile():
    # spBLEU / plain chrF must never enter a composite profile's weight table.
    for name, weights in PROFILE_REGISTRY.items():
        for forbidden in ("corpus_spbleu", "spbleu", "corpus_chrf_plain", "chrf_plain"):
            assert forbidden not in weights, f"{forbidden} leaked into profile {name}"
