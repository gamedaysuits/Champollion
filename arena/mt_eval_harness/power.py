"""Statistical power for MT evaluation — how small a difference a corpus can resolve.

WHY THIS EXISTS
    1,417 corpus cards, median size 137 entries, 376 of them under 100. A score
    computed on 35 sentences and a score computed on 3,000 look identical on a
    leaderboard, and they are not remotely the same evidence.

    The temptation is a size floor: "corpora under N do not rank". That answer is
    a number somebody chose. This module computes the honest version instead —
    the MINIMUM DETECTABLE EFFECT: the smallest quality difference this corpus
    can distinguish at a stated power. Nothing is excluded for being small; a
    35-entry corpus simply ships with a large MDE stated plainly beside it.

    That is also what routing needs. "Which corpus should decide this
    comparison?" is answered by MDE, not by row count.

THE METHOD, AND WHOSE IT IS
    Card, Henderson, Khandelwal, Jia, Mahowald & Jurafsky, "With Little Power
    Comes Great Responsibility", EMNLP 2020 (arXiv:2010.06595) — the standard
    reference for power analysis in NLP, and §4 is specifically about MT.

    Significance is by paired approximate randomization (Riezler & Maxwell 2005;
    recommended for NLP by Dror et al. 2018), which this repo already implements
    in ``significance.py`` for real system pairs.

    Power cannot be read off real pairs, because it asks what WOULD happen under
    a hypothesised effect. So Card et al. simulate per-segment effects from a
    Delta-Laplace mixture with two parameters:

        with probability P0      the systems do not differ on this segment
        otherwise                the effect is Laplace(mu, b)

        mu = 2B / (n * (1 - P0))     b = b0 / n

    where B is the corpus-level difference being tested. The factor of two is
    theirs: swapping ALL n examples reverses the comparison, a net effect of 2B,
    so the per-segment effects must sum to 2B.

WHAT WE MUST NOT DO WITH THEIR NUMBERS
    Their published estimates are BLEU on WMT English-German: P0 between 0.09
    and 0.19, b0 between 22.5 and 29.4, on test sets of 2,000-3,000 segments,
    giving roughly 75% power to detect 1 BLEU at n=2,000.

    Champollion scores chrF++ and cchrF++ on low-resource pairs. Character
    n-gram metrics have different variance from BLEU, and a 300-sentence
    Indigenous-language corpus behaves nothing like WMT news. Borrowing those
    constants and presenting the result as our measurement would be exactly the
    manufacturing this rebuild exists to end.

    So parameters are ESTIMATED from our own paired outputs wherever two systems
    have run on a corpus, and where they have not, the published prior is used
    and the value says so. ``parameter_source`` is not decoration: it is the
    difference between a measurement and a borrowed guess, and it travels with
    every MDE.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, asdict
from typing import Callable, Sequence

__all__ = [
    "EffectParameters",
    "PowerResult",
    "PUBLISHED_PRIOR",
    "DERIVATION_VERSION",
    "estimate_effect_parameters",
    "simulate_power",
    "minimum_detectable_effect",
]

#: Bumped when the ARITHMETIC changes, not when a corpus does. An MDE claiming
#: this version must always mean the same computation.
DERIVATION_VERSION = "v1"

#: Card et al. 2020, Table 3 — BLEU on WMT English-German, n = 2,000-3,000.
#: Used ONLY as a labelled fallback. The midpoint of their four fitted pairs.
PUBLISHED_PRIOR = {
    "p0": 0.125,
    "b0": 25.8,
    "citation": (
        "Card et al. 2020 (arXiv:2010.06595) Table 3, midpoint of four WMT "
        "English-German BLEU fits: P0 0.09-0.19, b0 22.5-29.4"
    ),
    "metric": "BLEU",
    "language_pair": "eng-deu",
}


@dataclass(frozen=True)
class EffectParameters:
    """The two parameters of the Delta-Laplace effect model."""

    p0: float
    b0: float
    #: ``measured`` (fitted from our own paired outputs) or ``prior`` (borrowed).
    source: str
    #: What it was fitted on, or what the prior describes. Never omitted — an
    #: unlabelled parameter is indistinguishable from a measured one.
    basis: str
    n_segments: int | None = None


@dataclass(frozen=True)
class PowerResult:
    """An MDE, with everything needed to judge how much to trust it."""

    n: int
    minimum_detectable_effect: float | None
    target_power: float
    alpha: float
    metric: str
    parameters: EffectParameters
    derivation_version: str = DERIVATION_VERSION
    #: Set when no effect within the search range reaches the target power —
    #: which is the honest answer for a very small corpus, not an error.
    note: str | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["parameters"] = asdict(self.parameters)
        return d


def _laplace(rng: random.Random, mu: float, b: float) -> float:
    """Inverse-CDF Laplace sample. `random` has no Laplace, and numpy is not a
    harness dependency for a handful of draws."""
    u = rng.random() - 0.5
    return mu - b * math.copysign(1.0, u) * math.log1p(-2.0 * abs(u))


def estimate_effect_parameters(
    entries_a: Sequence[dict],
    entries_b: Sequence[dict],
    metric_fn: Callable[[list[dict]], float],
    *,
    basis: str,
) -> EffectParameters:
    """Fit P0 and b0 from a real pair of systems on a real corpus.

    Card et al. fit "the effects of swapping individual output pairs": for each
    segment, swap just that one and see how far the corpus metric moves. Those n
    deltas are the empirical effect distribution.

    P0 is the share that do not move at all — segments where the two systems are
    identical, or differ in a way the metric cannot see. b0 is the Laplace scale
    of the rest, expressed on the paper's ``b = b0 / n`` footing so it does not
    depend on corpus size.

    This costs n corpus-metric evaluations, so it is worth doing once per
    (metric, language pair) and reusing — which is exactly why the result
    records what it was fitted on.
    """
    if len(entries_a) != len(entries_b):
        raise ValueError(
            f"paired systems must have the same number of entries: "
            f"{len(entries_a)} vs {len(entries_b)}"
        )
    n = len(entries_a)
    if n < 2:
        raise ValueError("cannot fit an effect distribution to fewer than 2 segments")

    baseline = metric_fn(list(entries_a))
    deltas: list[float] = []
    for i in range(n):
        swapped = list(entries_a)
        swapped[i] = entries_b[i]
        deltas.append(metric_fn(swapped) - baseline)

    # Exact zero, not a tolerance: a segment the metric scores identically has
    # no effect, and choosing an epsilon here would quietly set P0 by hand.
    zero = sum(1 for d in deltas if d == 0.0)
    nonzero = [d for d in deltas if d != 0.0]
    p0 = zero / n

    if not nonzero:
        raise ValueError(
            "every segment swap left the corpus metric unchanged, so there is no "
            "effect distribution to fit — the two systems are identical under "
            "this metric"
        )

    # Laplace MLE: the scale is the mean absolute deviation from the median.
    ordered = sorted(nonzero)
    mid = len(ordered) // 2
    median = (
        ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2.0
    )
    b = sum(abs(d - median) for d in nonzero) / len(nonzero)

    return EffectParameters(
        p0=p0, b0=b * n, source="measured", basis=basis, n_segments=n
    )


def simulate_power(
    n: int,
    effect: float,
    params: EffectParameters,
    *,
    alpha: float = 0.05,
    n_simulations: int = 200,
    n_trials: int = 200,
    seed: int = 12345,
) -> float:
    """Estimated power to detect a corpus-level difference of ``effect``.

    One simulation draws a corpus of per-segment effects, then runs the same
    sign-flip randomization test the harness uses on real systems — under the
    paper's simplification that swapping a subset moves the corpus metric by the
    sum of that subset's effects. The two-sided ASL uses the +1 correction, so
    it matches ``significance.paired_approximate_randomization`` rather than
    quietly using a different convention.
    """
    if n < 2:
        return 0.0
    rng = random.Random(seed)
    live = 1.0 - params.p0
    if live <= 0:
        return 0.0
    mu = (2.0 * effect) / (n * live)
    b = params.b0 / n

    rejected = 0
    for _ in range(n_simulations):
        deltas = [
            0.0 if rng.random() < params.p0 else _laplace(rng, mu, b) for _ in range(n)
        ]
        observed = abs(sum(deltas) / 2.0)
        atleast = 0
        for _ in range(n_trials):
            shuffled = abs(
                sum(d if rng.random() < 0.5 else -d for d in deltas) / 2.0
            )
            if shuffled >= observed:
                atleast += 1
        if (atleast + 1) / (n_trials + 1) < alpha:
            rejected += 1
    return rejected / n_simulations


def minimum_detectable_effect(
    n: int,
    params: EffectParameters,
    *,
    metric: str,
    target_power: float = 0.8,
    alpha: float = 0.05,
    search_max: float = 50.0,
    tolerance: float = 0.05,
    n_simulations: int = 200,
    n_trials: int = 200,
    seed: int = 12345,
) -> PowerResult:
    """The smallest effect this corpus can detect at ``target_power``.

    Bisection on effect size. Power is monotone in the effect, so bisection is
    sound; the simulation is noisy, so the answer is reported to a stated
    tolerance rather than to spurious precision.

    A corpus too small to reach the target power at ANY effect inside the search
    range returns ``None`` with a note. That is the honest answer for a 30-entry
    slice and it must not be rendered as a number.
    """
    if n < 2:
        return PowerResult(
            n=n,
            minimum_detectable_effect=None,
            target_power=target_power,
            alpha=alpha,
            metric=metric,
            parameters=params,
            note="fewer than 2 segments — no comparison is possible",
        )

    power_of = lambda e: simulate_power(  # noqa: E731 - a local alias, not an API
        n,
        e,
        params,
        alpha=alpha,
        n_simulations=n_simulations,
        n_trials=n_trials,
        seed=seed,
    )

    if power_of(search_max) < target_power:
        return PowerResult(
            n=n,
            minimum_detectable_effect=None,
            target_power=target_power,
            alpha=alpha,
            metric=metric,
            parameters=params,
            note=(
                f"no effect up to {search_max:g} {metric} reaches "
                f"{target_power:.0%} power at n={n}; this corpus cannot settle a "
                "comparison on its own"
            ),
        )

    lo, hi = 0.0, search_max
    while hi - lo > tolerance:
        mid = (lo + hi) / 2.0
        if power_of(mid) >= target_power:
            hi = mid
        else:
            lo = mid

    return PowerResult(
        n=n,
        minimum_detectable_effect=round(hi, 3),
        target_power=target_power,
        alpha=alpha,
        metric=metric,
        parameters=params,
    )
