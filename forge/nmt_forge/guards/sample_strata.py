"""sample-strata — per-kind capped reservoir sampling (guard #7).

The catalogued failure: two template kinds (conditionals ``cond``+``while``)
were 54% of the corpus, and a uniform sample kept that ratio — half the
training signal spent on two shapes while fifteen new structural kinds shared
~4%. The fix, extracted from the reference trainer: cap any single kind at a
fraction of the sample (default 15%), fill spare capacity uniformly from the
over-cap overflow.

Single streaming pass, deterministic under seed, O(sample) memory.
"""

from __future__ import annotations

import random
from collections.abc import Iterable

from ..errors import StrataError


def stratified_sample(
    rows: Iterable[dict],
    n: int,
    *,
    cap_fraction: float = 0.15,
    key: str = "kind",
    seed: int,
    strict_cap: bool = True,
) -> tuple[list[dict], dict]:
    """Sample ``n`` rows with no ``key`` value exceeding ``cap_fraction``.

    Returns ``(sample, manifest)``. The manifest records per-kind seen/kept —
    the distribution is a recorded fact, not an assumption.

    When the caps cannot supply ``n`` rows (few kinds × small cap), the
    default refuses with the arithmetic rather than quietly refilling past
    the cap. ``strict_cap=False`` refills uniformly from the over-cap
    overflow instead — the violation is deliberate and recorded per kind in
    the manifest (``kept`` > ``cap_rows`` shows exactly where).
    """
    if not 0 < cap_fraction <= 1:
        raise StrataError(
            f"cap_fraction must be in (0, 1], got {cap_fraction}",
            why="a zero/negative cap keeps nothing; >1 caps nothing",
            fix="use e.g. cap_fraction=0.15 (the reference default)",
        )
    if n <= 0:
        raise StrataError(f"sample size must be positive, got {n}")

    rng = random.Random(seed)
    cap = max(1, int(cap_fraction * n))
    pools: dict[str, list[dict]] = {}
    seen_k: dict[str, int] = {}
    overflow: list[dict] = []
    seen_overflow = 0
    total_seen = 0

    for row in rows:
        total_seen += 1
        kind = str(row.get(key, "?"))
        pool = pools.setdefault(kind, [])
        seen_k[kind] = seen_k.get(kind, 0) + 1
        if len(pool) < cap:
            pool.append(row)
        else:
            j = rng.randrange(seen_k[kind])
            if j < cap:
                # the displaced row becomes an overflow candidate (uniform
                # reservoir over everything the caps rejected)
                displaced = pool[j]
                pool[j] = row
            else:
                displaced = row
            seen_overflow += 1
            if len(overflow) < n:
                overflow.append(displaced)
            elif rng.randrange(seen_overflow) < n:
                overflow[rng.randrange(n)] = displaced

    sample = [r for p in pools.values() for r in p]
    cap_refill = 0
    if len(sample) < n and overflow:
        # the caps bind: sum(min(seen_kind, cap)) < n. Filling from overflow
        # would put some kind back over its cap — the exact dominance the
        # guard exists to stop — so by default this is a refusal, not a fill.
        if strict_cap:
            supply = len(sample)
            min_workable_cap = 1.0 / max(1, len(pools))
            raise StrataError(
                f"cap {cap_fraction:.0%} over {len(pools)} kinds supplies only "
                f"{supply} of the requested {n} rows",
                why="refilling past the cap would let dominant kinds re-inflate "
                    "— two kinds were 54% of the reference corpus this way",
                fix=f"raise cap_fraction to ≥ {min_workable_cap:.2f} (≈ 1/kinds), "
                    f"lower n to ≤ {supply}, or pass strict_cap=False to refill "
                    "deliberately (the manifest records kinds pushed past cap)",
            )
        rng.shuffle(overflow)
        refill = overflow[: n - len(sample)]
        cap_refill = len(refill)
        sample.extend(refill)
    elif len(sample) > n:
        rng.shuffle(sample)
        sample = sample[:n]

    from collections import Counter

    kept = Counter(str(r.get(key, "?")) for r in sample)
    manifest = {
        "guard": "sample-strata",
        "requested": n,
        "kept": len(sample),
        "total_seen": total_seen,
        "cap_fraction": cap_fraction,
        "cap_rows": cap,
        "cap_refill_rows": cap_refill,
        "seed": seed,
        "key": key,
        "per_kind": {
            k: {"seen": seen_k[k], "kept": kept.get(k, 0)}
            for k in sorted(seen_k, key=lambda k: -seen_k[k])
        },
    }
    return sample, manifest


def top_kind_share(rows: list[dict], key: str = "kind") -> tuple[str, float]:
    """The largest kind's share — the number that was 54% in the ledger."""
    from collections import Counter

    if not rows:
        return ("?", 0.0)
    counts = Counter(str(r.get(key, "?")) for r in rows)
    kind, n = counts.most_common(1)[0]
    return kind, n / len(rows)
