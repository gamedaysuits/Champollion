"""The sufficient-statistics fast path gives the string path's exact results.

significance.corpus_chrf / corpus_chrf_plain / corpus_bleu carry a
``segment_stats`` companion; paired AR and the paired bootstrap then sum
per-segment sacreBLEU statistics instead of re-tokenising every sentence on
every trial. The draws are identical, so every p-value, delta and CI must be
IDENTICAL to the string path — not close. These tests run both.
"""

from __future__ import annotations

import random

import pytest

from mt_eval_harness import significance as sig


def _plain(fn):
    """The same corpus function with the fast path hidden."""
    def f(entries):
        return fn(entries)
    return f


def _systems(n: int, seed: int):
    rng = random.Random(seed)
    words = ["kâ", "nipiy", "wâpam", "atim", "maskwa", "sîpiy", "iskwêw", "nâpêw"]

    def sent():
        return " ".join(rng.choice(words) for _ in range(rng.randint(3, 9)))
    refs = [sent() for _ in range(n)]
    refs[3] = ""                      # a segment with no reference: excluded
    a = [{"id": i, "expected": r, "predicted": sent() if rng.random() < .5 else r}
         for i, r in enumerate(refs)]
    b = [{"id": i, "expected": r, "predicted": sent() if rng.random() < .6 else r}
         for i, r in enumerate(refs)]
    a[5]["predicted"] = ""            # an empty prediction: scored as "EMPTY"
    return a, b


@pytest.mark.parametrize("fn", [sig.corpus_chrf, sig.corpus_chrf_plain, sig.corpus_bleu],
                         ids=["chrf++", "chrf", "bleu"])
def test_ar_fast_path_equals_string_path(fn):
    a, b = _systems(40, seed=7)
    fast = sig.paired_approximate_randomization(a, b, fn, n_trials=200,
                                                n_bootstrap_ci=200, seed=11)
    slow = sig.paired_approximate_randomization(a, b, _plain(fn), n_trials=200,
                                                n_bootstrap_ci=200, seed=11)
    assert fast == slow


@pytest.mark.parametrize("fn", [sig.corpus_chrf, sig.corpus_chrf_plain, sig.corpus_bleu],
                         ids=["chrf++", "chrf", "bleu"])
def test_bootstrap_fast_path_equals_string_path(fn):
    a, b = _systems(40, seed=8)
    fast = sig.paired_bootstrap(a, b, fn, n_bootstrap=200, seed=3)
    slow = sig.paired_bootstrap(a, b, _plain(fn), n_bootstrap=200, seed=3)
    assert fast == slow


def test_stats_score_equals_corpus_function():
    a, _ = _systems(30, seed=9)
    for fn in (sig.corpus_chrf, sig.corpus_chrf_plain, sig.corpus_bleu):
        stats, included, scorer = fn.segment_stats(a)
        assert scorer([int(x) for x in stats.sum(axis=0)]) == fn(a)
        assert not included[3] and included.sum() == 29


def test_no_references_at_all_scores_zero_on_both_paths():
    a = [{"id": i, "expected": "", "predicted": "x"} for i in range(4)]
    b = [{"id": i, "expected": "", "predicted": "y"} for i in range(4)]
    fast = sig.paired_approximate_randomization(a, b, sig.corpus_chrf, n_trials=20,
                                                n_bootstrap_ci=20)
    slow = sig.paired_approximate_randomization(a, b, _plain(sig.corpus_chrf),
                                                n_trials=20, n_bootstrap_ci=20)
    assert fast == slow and fast.delta == 0
