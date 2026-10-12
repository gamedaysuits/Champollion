"""The small-sample bootstrap-CI warning names its sample, once per sample.

A run's CIs are computed over several samples — the whole run, then each
difficulty tier. The warning used to read "Only 12 entries — bootstrap CIs may
have poor coverage…" with no word on WHICH sample was small, and it printed
once per metric, so one small tier read like four problems. It now names the
subset ("the whole run" / "difficulty tier 2") and the metrics resting on it,
one line per small sample. The threshold, the warning itself and every CI
number are unchanged.
"""

from __future__ import annotations

from mt_eval_harness.confidence import (
    MIN_RELIABLE_ENTRIES,
    bootstrap_ci,
    compute_all_cis,
    compute_per_tier_cis,
)
from mt_eval_harness.significance import corpus_chrf, exact_match_rate

N_BOOT = 50  # small: these tests check wording, not interval quality


def _entries(n: int, difficulty_of=lambda i: 1) -> list[dict]:
    words = ["alpha beta gamma", "delta epsilon", "zeta eta theta iota",
             "kappa lambda", "mu nu xi omicron pi"]
    out = []
    for i in range(n):
        exp = f"{words[i % 5]} w{i}"
        pred = exp if i % 3 == 0 else f"{words[(i + 1) % 5]} w{i}"
        out.append({"source": f"s{i}", "expected": exp, "predicted": pred,
                    "error": None, "exact_match": exp == pred,
                    "difficulty": difficulty_of(i)})
    return out


def _warnings(text: str) -> list[str]:
    return [line for line in text.splitlines() if "poor coverage" in line]


def test_whole_run_warning_names_the_run_once(capsys):
    cis = compute_all_cis(_entries(12), n_bootstrap=N_BOOT)
    lines = _warnings(capsys.readouterr().out)
    # Once for the sample, not once per metric (it was 4 lines here).
    assert len(lines) == 1, lines
    line = lines[0]
    assert "Only 12 entries in the whole run" in line
    # Every metric computed on that sample is named on the one line.
    for metric in cis:
        assert metric in line
    assert f"below {MIN_RELIABLE_ENTRIES} entries" in line


def test_per_tier_warning_names_each_tier_once(capsys):
    # tier 1: 12 entries, tier 2: 6 entries — both small, both get CIs.
    entries = _entries(18, difficulty_of=lambda i: 1 if i < 12 else 2)
    tiers = compute_per_tier_cis(entries, n_bootstrap=N_BOOT)
    assert set(tiers) == {1, 2}
    lines = _warnings(capsys.readouterr().out)
    assert len(lines) == 2, lines
    assert "Only 12 entries in difficulty tier 1" in lines[0]
    assert "Only 6 entries in difficulty tier 2" in lines[1]
    for line in lines:
        assert "corpus_chrf" in line and "exact_match_rate" in line
        assert "whole run" not in line


def test_no_warning_at_or_above_threshold(capsys):
    compute_all_cis(_entries(MIN_RELIABLE_ENTRIES), n_bootstrap=N_BOOT)
    assert _warnings(capsys.readouterr().out) == []


def test_standalone_bootstrap_ci_still_warns_with_its_label(capsys):
    bootstrap_ci(_entries(7), corpus_chrf, n_bootstrap=N_BOOT,
                 metric_name="corpus_chrf")
    lines = _warnings(capsys.readouterr().out)
    assert len(lines) == 1 and "Only 7 entries in this sample" in lines[0]
    assert "corpus_chrf" in lines[0]

    bootstrap_ci(_entries(7), corpus_chrf, n_bootstrap=N_BOOT,
                 metric_name="corpus_chrf", subset="difficulty tier 3")
    lines = _warnings(capsys.readouterr().out)
    assert len(lines) == 1 and "Only 7 entries in difficulty tier 3" in lines[0]


def test_the_warning_change_moves_no_number():
    """compute_all_cis / compute_per_tier_cis report exactly what a bare
    bootstrap_ci with the same seed reports — the label is wording only."""
    entries = _entries(18, difficulty_of=lambda i: 1 if i < 12 else 2)
    whole = compute_all_cis(entries, n_bootstrap=N_BOOT)
    bare = bootstrap_ci(entries, corpus_chrf, n_bootstrap=N_BOOT,
                        metric_name="corpus_chrf", warn_small_sample=False)
    assert whole["corpus_chrf"] == bare.__dict__

    tiers = compute_per_tier_cis(entries, n_bootstrap=N_BOOT, seed=7)
    tier1 = [e for e in entries if e["difficulty"] == 1]
    bare_t1 = bootstrap_ci(tier1, exact_match_rate, n_bootstrap=N_BOOT, seed=7 + 1,
                           metric_name="exact_match_rate_tier1",
                           warn_small_sample=False)
    assert tiers[1]["exact_match_rate"] == bare_t1.__dict__
