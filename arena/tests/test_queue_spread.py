"""Anti-collision spread for the community compute queue.

The public queue is a static, ranked JSON file with no claim-locking. When
many contributors run the donate flow (`mt-eval queue --budget`) at the same
moment, strict top-order selection hands every worker the identical items —
wasting donated compute on redundant runs of one (model, corpus) pair. The
spread layer (`_spread_order`) gives each worker a priority-weighted random
permutation so simultaneous workers fan out across the queue.

These tests pin three properties:
  1. Default (spread=False) behavior is byte-for-byte the old top-order
     selection — the shared selection vectors and the JS port depend on it.
  2. Spread still favors high-priority items (they run most often).
  3. Under mass concurrency, no single item is dogpiled ~100×.
"""

from __future__ import annotations

import random
from collections import Counter

from mt_eval_harness.queue_runner import SPREAD_DECAY, _spread_order, select_items


def _queue(n: int, cost: float | None = 0.10):
    return {
        "items": [
            {
                "id": f"i{k:04d}",
                "condition": "naive",
                "est_cost_usd": cost,
                "language_pair": "eng>fao",
                "model": "m",
                "run_command": "true",
            }
            for k in range(n)
        ]
    }


def _queue_variable(n: int, seed: int = 7):
    """Realistic queue: variable per-item cost like the LIVE queue
    (~$0.003–$0.51, median ~$0.10), log-uniform. The uniform-cost _queue above
    hides the cheap-item dogpile that bit the project — every worker takes the
    same ~20 items — whereas real cost lets the cheapest top-ranked items pack
    into nearly everyone's budget. Use this to guard the real concurrency case."""
    rng = random.Random(seed)
    return {
        "items": [
            {
                "id": f"i{k:04d}",
                "condition": "naive",
                "est_cost_usd": round(10 ** rng.uniform(-2.5, -0.29), 4),
                "language_pair": "eng>fao",
                "model": "m",
                "run_command": "true",
            }
            for k in range(n)
        ]
    }


class TestSpreadDefaultUnchanged:
    """spread=False must reproduce the existing top-order selection exactly."""

    def test_top_default_is_strict_order(self):
        q = _queue(20)
        sel, _ = select_items(q, top=5)
        assert [i["id"] for i in sel] == [f"i{k:04d}" for k in range(5)]

    def test_explicit_no_spread_matches_default(self):
        q = _queue(20)
        a, _ = select_items(q, top=5)
        b, _ = select_items(q, top=5, spread=False)
        assert [i["id"] for i in a] == [i["id"] for i in b]

    def test_budget_default_is_strict_order(self):
        # cost 0.10 each, budget 0.35 -> first 3 items, in order.
        q = _queue(20)
        sel, _ = select_items(q, budget=0.35)
        assert [i["id"] for i in sel] == ["i0000", "i0001", "i0002"]


class TestSpreadReproducible:
    def test_same_seed_same_order(self):
        q = _queue(200)
        o1 = _spread_order(list(q["items"]), random.Random(42))
        o2 = _spread_order(list(q["items"]), random.Random(42))
        assert [i["id"] for i in o1] == [i["id"] for i in o2]

    def test_different_seeds_differ(self):
        q = _queue(200)
        o1 = _spread_order(list(q["items"]), random.Random(1))
        o2 = _spread_order(list(q["items"]), random.Random(2))
        assert [i["id"] for i in o1] != [i["id"] for i in o2]

    def test_permutation_preserves_membership(self):
        q = _queue(200)
        out = _spread_order(list(q["items"]), random.Random(7))
        assert sorted(i["id"] for i in out) == sorted(i["id"] for i in q["items"])
        assert len(out) == 200


class TestSpreadBudgetInvariant:
    def test_never_exceeds_budget_under_spread(self):
        # Mixed costs; spread on. Cumulative est must never exceed budget.
        items = []
        for k in range(300):
            items.append(
                {
                    "id": f"i{k:04d}",
                    "condition": "naive",
                    "est_cost_usd": 0.05 + (k % 5) * 0.05,  # 0.05..0.25
                    "language_pair": "eng>fao",
                    "model": "m",
                    "run_command": "true",
                }
            )
        q = {"items": items}
        for seed in range(20):
            sel, _ = select_items(
                q, budget=1.00, spread=True, rng=random.Random(seed)
            )
            total = sum(i["est_cost_usd"] for i in sel)
            assert total <= 1.00 + 1e-9, f"seed {seed}: spent {total}"


class TestSpreadFavorsPriority:
    def test_top_items_run_more_often(self):
        # Priority is preserved: across many single-item picks the top of the
        # ranking is chosen far more than the deep tail. Measured over DECILES
        # (large counts) rather than two individual items so it is robust to the
        # gentler — but real — tilt at the tuned SPREAD_DECAY (rank-0 is ~3.3x a
        # rank-900 item, not 20x), instead of flaking on small per-item counts.
        q = _queue(1000)
        picks = Counter()
        for w in range(8000):
            sel, _ = select_items(q, top=1, spread=True, rng=random.Random(w))
            picks[sel[0]["id"]] += 1
        top_decile = sum(picks[f"i{k:04d}"] for k in range(100))
        bottom_decile = sum(picks[f"i{k:04d}"] for k in range(900, 1000))
        assert top_decile > bottom_decile, (top_decile, bottom_decile)
        # A real (not merely nominal) priority tilt — the top decile runs at
        # least ~2x the bottom decile.
        assert top_decile > 2 * bottom_decile, (top_decile, bottom_decile)


class TestSpreadNoDogpile:
    def test_mass_concurrency_stays_under_100x(self):
        """UNIFORM-cost floor: 1,000 workers each taking ~20 equal-cost items.

        Kept as a floor, but uniform cost is unrealistic and HID the real
        dogpile — with equal cost every worker takes the identical ~20 items no
        matter how sharp the spread is, so a tame number here proved little. The
        realistic guard is test_mass_concurrency_variable_cost_no_dogpile below.
        """
        q = _queue(2002, cost=0.10)  # ~ real open_items count
        counts = Counter()
        workers = 1000
        for w in range(workers):
            # budget 2.00 / 0.10 = ~20 items per worker (19-20 with float
            # accumulation in the running-total comparison).
            sel, _ = select_items(
                q, budget=2.00, spread=True, rng=random.Random(10_000 + w)
            )
            assert len(sel) >= 18
            for it in sel:
                counts[it["id"]] += 1
        busiest = counts.most_common(1)[0]
        # ~19-20 items each across 1000 workers.
        assert sum(counts.values()) >= workers * 18
        # The busiest item must be well under 100 (vs. 1000 with no spread).
        assert busiest[1] < 100, f"busiest item {busiest} >= 100"

    def test_mass_concurrency_variable_cost_no_dogpile(self):
        """REAL guard: variable per-item cost (like the live queue) + 1,000
        simultaneous --budget workers must not dogpile one item.

        With the old SPREAD_DECAY=300 the cheapest top-ranked items packed into
        nearly every worker's budget and the busiest item landed on ~40% of
        1,000 workers (measured on the live queue). The tuned decay keeps the
        busiest comfortably under a fifth, while runs that DO collide dedupe
        harmlessly on publish. No-spread would pile ~100% on the same prefix.
        """
        q = _queue_variable(2002)
        counts = Counter()
        workers = 1000
        for w in range(workers):
            sel, _ = select_items(
                q, budget=2.00, spread=True, rng=random.Random(20_000 + w)
            )
            for it in sel:
                counts[it["id"]] += 1
        busiest = counts.most_common(1)[0][1]
        assert busiest < 0.20 * workers, (
            f"busiest {busiest}/{workers} ≥ 20% of workers — dogpile not tamed"
        )
        # Still a broad fan-out, not a degenerate few buckets.
        assert len(counts) > 200, f"only {len(counts)} distinct items — fan-out too narrow"

    def test_without_spread_everyone_collides(self):
        # Contrast: strict order -> all workers take the identical prefix.
        q = _queue(2002, cost=0.10)
        counts = Counter()
        for w in range(50):
            sel, _ = select_items(q, budget=2.00)  # spread defaults off here
            for it in sel:
                counts[it["id"]] += 1
        # Every worker took i0000..i0019 -> 50 collisions on each.
        assert counts["i0000"] == 50


def test_spread_decay_is_sane():
    assert SPREAD_DECAY > 0
