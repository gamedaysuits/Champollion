"""funnel-audit — yield decomposition; silent attrition becomes a number.

The catalogued failure (mistake #4): the dictionary spells some lemmas with
``ý`` (itwêwina's convention); the FST expects ``y``. Every such verb was
"unknown" and silently skipped — 1,375 verbs, for weeks, invisible because
nobody was counting the pipeline's stages. When the count finally happened,
the funnel read: 7,908 missing verbs = 1,375 canonicalization bug + 2,330
known-but-filtered + 4,203 genuinely absent. The bug was one line; FINDING it
took a funnel.

Usage: declare stages in order, tick items through, record drops with
reasons. The report is per-stage counts + ranked drop reasons.
``assert_max_drop`` turns an attrition budget into a gate;
``canon_recoverable`` is the ý-bug detector generalized — it counts dropped
items that would have survived if canonicalized, and
``assert_none_recoverable`` refuses when that number is nonzero.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable, Iterable

from ..canonical import Canonicalizer
from ..errors import FunnelRegression

_DROP_SAMPLE_CAP = 10_000  # dropped items retained in memory per stage


class Funnel:
    def __init__(self, name: str, stages: list[str]):
        if len(stages) < 2:
            raise ValueError("a funnel needs at least two stages")
        self.name = name
        self.stages = list(stages)
        self.counts: Counter[str] = Counter()
        self.drop_reasons: dict[str, Counter[str]] = {s: Counter() for s in stages}
        self.dropped_items: dict[str, list[str]] = {s: [] for s in stages}

    def tick(self, stage: str, n: int = 1) -> None:
        if stage not in self.stages:
            raise ValueError(f"unknown stage {stage!r}; declared: {self.stages}")
        self.counts[stage] += n

    def drop(self, stage: str, reason: str, item: str | None = None, n: int = 1) -> None:
        """Record ``n`` items lost AT ``stage`` (they entered it, didn't leave)."""
        if stage not in self.stages:
            raise ValueError(f"unknown stage {stage!r}; declared: {self.stages}")
        self.drop_reasons[stage][reason] += n
        if item is not None and len(self.dropped_items[stage]) < _DROP_SAMPLE_CAP:
            self.dropped_items[stage].append(item)

    # -- reporting -------------------------------------------------------------
    def report(self) -> dict:
        rows = []
        prev: int | None = None
        for s in self.stages:
            n = self.counts.get(s, 0)
            rows.append({
                "stage": s,
                "count": n,
                "lost_from_previous": (prev - n) if prev is not None else 0,
                "drop_reasons": dict(self.drop_reasons[s].most_common()),
            })
            prev = n
        return {"guard": "funnel-audit", "funnel": self.name, "stages": rows}

    def assert_max_drop(self, from_stage: str, to_stage: str, max_fraction: float) -> None:
        """Refuse attrition beyond a declared budget between two stages."""
        n_from = self.counts.get(from_stage, 0)
        n_to = self.counts.get(to_stage, 0)
        if n_from == 0:
            raise FunnelRegression(
                f"{self.name}: stage {from_stage!r} saw 0 items",
                why="an empty upstream stage usually means a path or format "
                    "bug, not a genuinely empty source",
                fix="check the adapter feeding this funnel before trusting "
                    "downstream counts",
            )
        lost = (n_from - n_to) / n_from
        if lost > max_fraction:
            reasons = dict(self.drop_reasons.get(to_stage, Counter()).most_common(5))
            raise FunnelRegression(
                f"{self.name}: {from_stage}→{to_stage} lost {lost:.1%} "
                f"(> budget {max_fraction:.1%}); top reasons: {reasons}",
                why="silent attrition is how 1,375 dictionary verbs vanished "
                    "for weeks in the reference pipeline",
                fix="inspect report()['stages'] drop reasons; if drops are "
                    "legitimate, raise the declared budget deliberately",
            )

    # -- the ý-bug detector ------------------------------------------------------
    def canon_recoverable(
        self,
        accept_fn: Callable[[str], bool],
        canonicalizer: Canonicalizer,
        stage: str | None = None,
    ) -> list[str]:
        """Dropped items that ``accept_fn`` accepts once canonicalized.

        A nonzero result means a canonicalization boundary is missing: the
        item was rejected raw but is perfectly valid in canonical form —
        exactly the ý/y class of loss.
        """
        stages = [stage] if stage else self.stages
        recoverable = []
        for s in stages:
            for item in self.dropped_items[s]:
                canon = canonicalizer(item)
                if canon != item and accept_fn(canon):
                    recoverable.append(item)
        return recoverable

    def assert_none_recoverable(
        self,
        accept_fn: Callable[[str], bool],
        canonicalizer: Canonicalizer,
        stage: str | None = None,
    ) -> None:
        rec = self.canon_recoverable(accept_fn, canonicalizer, stage)
        if rec:
            raise FunnelRegression(
                f"{self.name}: {len(rec)} dropped items become acceptable "
                f"after canonicalization (e.g. {rec[0]!r})",
                why="the consumer rejected raw spellings its canonical form "
                    "accepts — the exact bug that silently deleted 1,375 verbs "
                    "(ý vs y) in the reference pipeline",
                fix="apply the pack canonicalizer AT THE ADAPTER BOUNDARY "
                    "(where dictionary/corpus items enter), then re-run; every "
                    "place raw text meets an analyzer must canonicalize first",
            )


def canon_recoverable(
    items: Iterable[str],
    accept_fn: Callable[[str], bool],
    canonicalizer: Canonicalizer,
) -> list[str]:
    """Standalone form of the detector, for pipelines without a Funnel."""
    return [i for i in items if canonicalizer(i) != i and accept_fn(canonicalizer(i))]
