"""IGT lane — SIGMORPHON-style glossing accuracy, segmentation F1, IGT loader."""

from __future__ import annotations

import textwrap

import pytest

from mt_eval_harness.corpus_loader import _load_igt, _sniff_igt
from mt_eval_harness.plugins.igt_gloss import IGTGlossMetric, _morphemes
from mt_eval_harness.plugins.morph_segmentation import MorphSegmentationMetric


# ---------------------------------------------------------------------------
# IGTGlossMetric
# ---------------------------------------------------------------------------

def test_gloss_word_and_morpheme_accuracy():
    m = IGTGlossMetric()
    r = m.compute({"expected": "dog-PL run-3SG", "predicted": "dog-PL walk-3SG"})
    assert r["gloss_word_correct"] == 1 and r["gloss_word_total"] == 2
    assert r["gloss_word_accuracy"] == 0.5
    # flattened morphemes: [dog, PL, run, 3SG] vs [dog, PL, walk, 3SG]
    assert r["gloss_morpheme_correct"] == 3 and r["gloss_morpheme_total"] == 4


def test_gloss_stem_gram_prf():
    m = IGTGlossMetric()
    r = m.compute({"expected": "dog-PL run-3SG", "predicted": "dog-PL walk-3SG"})
    agg = m.aggregate([r])
    # stems: gold {dog, run}; TP=dog, FN=run, FP=walk → P=R=F1=0.5
    assert agg["gloss_classes"]["stem"]["precision"] == 0.5
    assert agg["gloss_classes"]["stem"]["recall"] == 0.5
    assert agg["gloss_classes"]["stem"]["f1"] == 0.5
    # grams: PL and 3SG both match → perfect
    assert agg["gloss_classes"]["gram"]["f1"] == 1.0


def test_gloss_gram_rule_ignores_digits():
    # isupper() is True for '3SG' (digits don't count as lowercase)
    assert "3SG".isupper()
    m = IGTGlossMetric()
    r = m.compute({"expected": "3SG", "predicted": "3SG"})
    agg = m.aggregate([r])
    assert agg["gloss_classes"]["gram"]["f1"] == 1.0
    assert agg["gloss_classes"]["stem"]["f1"] == 0.0


def test_gloss_unk_never_counts():
    m = IGTGlossMetric()
    r = m.compute({"expected": "[UNK]", "predicted": "[UNK]"})
    assert r["gloss_word_correct"] == 0
    assert r["gloss_morpheme_correct"] == 0


def test_gloss_case_sensitive_and_positional():
    m = IGTGlossMetric()
    # case-sensitive: 'pl' != 'PL'
    r = m.compute({"expected": "dog-PL", "predicted": "dog-pl"})
    assert r["gloss_morpheme_correct"] == 1  # only 'dog'
    # positional: same tokens in the wrong order don't count
    r2 = m.compute({"expected": "dog cat", "predicted": "cat dog"})
    assert r2["gloss_word_correct"] == 0


def test_gloss_shorter_prediction():
    m = IGTGlossMetric()
    r = m.compute({"expected": "dog-PL run-3SG", "predicted": "dog-PL"})
    assert r["gloss_word_correct"] == 1
    assert r["gloss_word_total"] == 2
    assert r["gloss_morpheme_correct"] == 2  # dog, PL


def test_gloss_macro_vs_micro():
    m = IGTGlossMetric()
    # entry A: 1/1 correct; entry B: 1/3 correct
    a = m.compute({"expected": "dog", "predicted": "dog"})
    b = m.compute({"expected": "one two three", "predicted": "one x y"})
    agg = m.aggregate([a, b])
    assert agg["gloss_word_average_accuracy"] == pytest.approx((1.0 + 1 / 3) / 2)
    assert agg["gloss_word_overall_accuracy"] == pytest.approx(2 / 4)


def test_gloss_empty_entries_excluded():
    m = IGTGlossMetric()
    agg = m.aggregate([m.compute({"expected": "", "predicted": ""})])
    assert agg == {"gloss_available": False}


def test_morpheme_split_handles_clitics():
    assert _morphemes("dog-PL chien=DET") == ["dog", "PL", "chien", "DET"]


# ---------------------------------------------------------------------------
# MorphSegmentationMetric
# ---------------------------------------------------------------------------

def test_segmentation_multiset_f1():
    m = MorphSegmentationMetric()
    r = m.compute({"expected": "ni-kî-wâpam-âw", "predicted": "ni-kî-wâpamâw"})
    assert (r["seg_tp"], r["seg_fp"], r["seg_fn"]) == (2, 1, 2)
    assert r["seg_precision"] == pytest.approx(2 / 3)
    assert r["seg_recall"] == pytest.approx(0.5)
    assert r["seg_f1"] == pytest.approx(4 / 7)


def test_segmentation_order_within_word_is_multiset():
    m = MorphSegmentationMetric()
    r = m.compute({"expected": "a-b", "predicted": "b-a"})
    assert r["seg_f1"] == 1.0


def test_segmentation_extra_and_missing_words():
    m = MorphSegmentationMetric()
    r = m.compute({"expected": "a-b c", "predicted": "a-b"})
    assert (r["seg_tp"], r["seg_fp"], r["seg_fn"]) == (2, 0, 1)
    r2 = m.compute({"expected": "a-b", "predicted": "a-b c-d"})
    assert (r2["seg_tp"], r2["seg_fp"], r2["seg_fn"]) == (2, 2, 0)


def test_segmentation_aggregate_micro_and_macro():
    m = MorphSegmentationMetric()
    perfect = m.compute({"expected": "a-b", "predicted": "a-b"})
    half = m.compute({"expected": "a-b", "predicted": "a-x"})
    agg = m.aggregate([perfect, half])
    assert agg["seg_micro_precision"] == pytest.approx(3 / 4)
    assert agg["seg_micro_recall"] == pytest.approx(3 / 4)
    assert agg["seg_macro_f1"] == pytest.approx((1.0 + 0.5) / 2)


# ---------------------------------------------------------------------------
# IGT corpus loader
# ---------------------------------------------------------------------------

IGT_SAMPLE = textwrap.dedent(r"""
    \t nikî-wâpamâw atim
    \m ni-kî-wâpam-âw atim
    \g 1SG-PST-see-3SG.OBJ dog
    \l I saw a dog

    \t âstam
    \g come.IMP
    \l Come here
""").strip() + "\n"


def test_load_igt_blocks(tmp_path):
    p = tmp_path / "sample.igt"
    p.write_text(IGT_SAMPLE, encoding="utf-8")
    entries = _load_igt(p)
    assert len(entries) == 2
    assert entries[0]["source"] == "nikî-wâpamâw atim"
    assert entries[0]["reference"] == "1SG-PST-see-3SG.OBJ dog"
    assert entries[0]["igt_segmentation"] == "ni-kî-wâpam-âw atim"
    assert entries[0]["igt_translation"] == "I saw a dog"
    # second block has no \m tier
    assert "igt_segmentation" not in entries[1]
    assert entries[1]["reference"] == "come.IMP"


def test_load_igt_unknown_tier_preserved(tmp_path):
    p = tmp_path / "sample.igt"
    p.write_text("\\t abc\n\\g X\n\\p NOUN\n\\q custom\n", encoding="utf-8")
    e = _load_igt(p)[0]
    assert e["igt_pos"] == "NOUN"
    assert e["igt_q"] == "custom"


def test_load_igt_missing_gloss_raises(tmp_path):
    p = tmp_path / "bad.igt"
    p.write_text("\\t abc\n\\l only translation\n", encoding="utf-8")
    with pytest.raises(ValueError, match="missing"):
        _load_igt(p)


def test_load_igt_rejects_untagged_lines(tmp_path):
    p = tmp_path / "bad.igt"
    p.write_text("\\t abc\nno marker here\n", encoding="utf-8")
    with pytest.raises(ValueError, match="tier marker"):
        _load_igt(p)


def test_sniff_igt(tmp_path):
    igt = tmp_path / "a.txt"
    igt.write_text("\n\\t abc\n\\g X\n", encoding="utf-8")
    plain = tmp_path / "b.txt"
    plain.write_text("just some text\n", encoding="utf-8")
    assert _sniff_igt(igt) is True
    assert _sniff_igt(plain) is False
