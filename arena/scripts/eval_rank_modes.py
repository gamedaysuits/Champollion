#!/usr/bin/env python3
"""Compare queue rank modes before flipping the published default.

Read-only. Consumes FULL-item dumps produced by
``generate_sweep_queue.py --rank-mode <mode> --dump-full-items <path>``
(one per mode, on the same board snapshot) and reports:

  SURVEY metrics (definitions from docs/QUEUE_ALGORITHM_REVIEW_2026-07-18):
    - language first-light depth (median / p90) over runnable items
    - distinct pairs / target languages / target families at top-100/1k/5k
    - marginal-new-pair rate per depth window

  JUDGE metrics (spec §2.3.6, seeded simulator):
    - contested method contrasts resolved per simulated $1k
    - per-pair method-ranking recovery (Spearman vs synthetic truth) at
      fixed budgets, via the licensed within-pair additive fit

  MESH proxy:
    - cumulative expected_mesh_gain of the affordable prefix per budget
      (the generator's own per-item ΔΦ estimate — a declared proxy for
      realized Φ growth, not a re-run of the chain matrix)

The §2.3.6 flip criterion: edv within 10% of map on every survey metric,
strictly better on both judge metrics, mesh-per-$ not worse than map.

Usage:
  python3 scripts/eval_rank_modes.py full-map.json full-edv.json \
      [full-ecv.json] [--budgets 100,1000,10000] [--sims 20] [--out DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import random
import statistics
from pathlib import Path

ARENA = Path(__file__).resolve().parent.parent
_SPEC = importlib.util.spec_from_file_location(
    "generate_sweep_queue_eval", ARENA / "scripts" / "generate_sweep_queue.py")
Q = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(Q)

Z_DEC = Q.Z_DEC


# ---------------------------------------------------------------------------
# Survey metrics
# ---------------------------------------------------------------------------

def runnable(items: list[dict]) -> list[dict]:
    """The order a contributor actually experiences: coached items are
    skipped by the runner without a coaching file (review §finding 6)."""
    return [it for it in items if it.get("condition") != "coached"]


def survey_metrics(items: list[dict]) -> dict:
    run = runnable(items)
    first_light: dict[str, int] = {}
    pairs_at: dict[int, set] = {100: set(), 1000: set(), 5000: set()}
    langs_at: dict[int, set] = {100: set(), 1000: set(), 5000: set()}
    fams_at: dict[int, set] = {100: set(), 1000: set(), 5000: set()}
    new_pair_flags: list[bool] = []
    seen_pairs: set[str] = set()
    for depth, it in enumerate(run, start=1):
        lp = it["language_pair"]
        src, _, tgt = lp.partition(">")
        fam = Q.language_family(tgt)
        for lang in (src, tgt):
            first_light.setdefault(lang, depth)
        new_pair_flags.append(lp not in seen_pairs)
        seen_pairs.add(lp)
        for cut in (100, 1000, 5000):
            if depth <= cut:
                pairs_at[cut].add(lp)
                langs_at[cut].add(tgt)
                fams_at[cut].add(fam)
    depths = sorted(first_light.values())

    def pct(p: float) -> int:
        if not depths:
            return 0
        return depths[min(len(depths) - 1, math.ceil(p * len(depths)) - 1)]

    def rate(a: int, b: int) -> float:
        window = new_pair_flags[a:b]
        return round(sum(window) / len(window), 3) if window else 0.0

    return {
        "runnable_items": len(run),
        "first_light_median": pct(0.50),
        "first_light_p90": pct(0.90),
        "pairs@100": len(pairs_at[100]), "pairs@1k": len(pairs_at[1000]),
        "pairs@5k": len(pairs_at[5000]),
        "langs@100": len(langs_at[100]), "langs@1k": len(langs_at[1000]),
        "langs@5k": len(langs_at[5000]),
        "fams@100": len(fams_at[100]), "fams@1k": len(fams_at[1000]),
        "fams@5k": len(fams_at[5000]),
        "new_pair_rate@0-1k": rate(0, 1000),
        "new_pair_rate@1k-5k": rate(1000, 5000),
    }


# ---------------------------------------------------------------------------
# Judge simulator
# ---------------------------------------------------------------------------

def _spearman(xs: list[float], ys: list[float]) -> float:
    """Spearman with AVERAGE ranks for ties — ALS fits tie routinely on
    single-corpus pairs, and index-order tie-breaking would manufacture
    correlation out of list position."""
    def ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2.0
            for k in range(i, j + 1):
                r[order[k]] = avg
            i = j + 1
        return r
    rx, ry = ranks(xs), ranks(ys)
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx)
                    * sum((b - my) ** 2 for b in ry))
    return num / den if den else 0.0


def _keyed_gauss(seed: int, tag: str, key: str, mu: float, sigma: float) -> float:
    """Deterministic draw addressed by KEY, not by RNG stream position.

    The first simulator version drew from one sequential stream in ranking
    order — so two orderings of the same items were scored against
    DIFFERENT synthetic truths, and each budget walk pre-consumed the
    stream for the next. Key-addressed draws make the truth a pure
    function of (sim seed, entity), identical across rank modes, budgets,
    and walk order.
    """
    h = hashlib.blake2b(f"{seed}|{tag}|{key}".encode("utf-8"),
                        digest_size=8).digest()
    return random.Random(int.from_bytes(h, "big")).gauss(mu, sigma)


def judge_sim(items: list[dict], budgets: list[float], sims: int,
              seed: int = 20260827) -> dict:
    """Seeded synthetic-truth walk (spec §2.3.6).

    Truth: score(M, C) = ability_pair(M) + difficulty(C) + ε, with noise
    scaled by the corpus's CI proxy. Each ordering is walked greedily
    (affordable-prefix-with-skip, the budget-tier rule); we then measure
    what the purchased evidence DECIDES and RECOVERS.
    """
    run = runnable(items)
    out = {f"${int(b)}": {"contrasts_per_1k": [], "recovery": []}
           for b in budgets}
    for s in range(sims):
        sim_seed = seed + s
        ability: dict[tuple, float] = {}
        difficulty: dict[str, float] = {}

        def truth(it):
            # Every draw is key-addressed (_keyed_gauss): the same item gets
            # the same truth and the same noise regardless of which rank
            # mode's ordering, or which budget walk, reaches it — the whole
            # point of a controlled comparison.
            pair, m, c = it["language_pair"], it["model"], it["corpus_id"]
            a = ability.setdefault(
                (pair, m),
                _keyed_gauss(sim_seed, "ability", f"{pair}|{m}", 0.5, 0.15))
            d = difficulty.setdefault(
                c, _keyed_gauss(sim_seed, "difficulty", c, 0.0, 0.05))
            n = it.get("entry_count") or 100
            noise = _keyed_gauss(
                sim_seed, "noise", f"{pair}|{m}|{c}",
                0.0, 0.5 / math.sqrt(max(n, 1)))
            return a + d + noise

        for b in budgets:
            spent, cells = 0.0, {}
            for it in run:
                cost = it.get("est_cost_usd")
                if not isinstance(cost, (int, float)) or cost < 0:
                    continue
                if spent + cost > b:
                    continue
                spent += cost
                key = (it["language_pair"],)
                cells.setdefault(key[0], {})[
                    (it["model"], it["corpus_id"])] = (
                    truth(it), it.get("entry_count") or 100)
            # contrasts decided
            decided = 0
            recov = []
            for pair, pc in cells.items():
                by_c: dict[str, dict] = {}
                for (m, c), (score, n) in pc.items():
                    by_c.setdefault(c, {})[m] = (score, n)
                pairs_done = set()
                for c, per_m in by_c.items():
                    ms = sorted(per_m)
                    for i in range(len(ms)):
                        for j in range(i + 1, len(ms)):
                            if (ms[i], ms[j]) in pairs_done:
                                continue
                            (sa, na), (sb, nb) = per_m[ms[i]], per_m[ms[j]]
                            h = math.sqrt((50 / math.sqrt(max(na, 1))) ** 2
                                          + (50 / math.sqrt(max(nb, 1))) ** 2)
                            if abs(sa - sb) * 100 / h >= Z_DEC:
                                decided += 1
                                pairs_done.add((ms[i], ms[j]))
                # Ranking recovery on pairs with >=3 measured methods.
                # n=2 pairs yield Spearman = ±1 by construction — a coin
                # flip that would dominate the mean; they are excluded.
                methods = {m for (m, _c) in pc}
                if len(methods) >= 3:
                    fitted = Q.als_additive_rank(
                        {(m, c): sc for (m, c), (sc, _n) in pc.items()})
                    true_a = [ability[(pair, m)] for m in sorted(methods)]
                    fit_a = [fitted[m] for m in sorted(methods)]
                    recov.append(_spearman(true_a, fit_a))
            out[f"${int(b)}"]["contrasts_per_1k"].append(
                decided / max(spent, 0.001) * 1000)
            out[f"${int(b)}"]["recovery"].append(
                statistics.mean(recov) if recov else 0.0)
    return {
        k: {"contrasts_per_1k": round(statistics.mean(v["contrasts_per_1k"]), 2),
            "recovery": round(statistics.mean(v["recovery"]), 4)}
        for k, v in out.items()
    }


def mesh_proxy(items: list[dict], budgets: list[float]) -> dict:
    run = runnable(items)
    out = {}
    for b in budgets:
        spent, gain = 0.0, 0.0
        for it in run:
            cost = it.get("est_cost_usd")
            if not isinstance(cost, (int, float)) or cost < 0:
                continue
            if spent + cost > b:
                continue
            spent += cost
            gain += it.get("expected_mesh_gain") or 0.0
        out[f"${int(b)}"] = round(gain, 8)
    return out


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("dumps", nargs="+",
                    help="full-item dumps (generate_sweep_queue "
                         "--dump-full-items), one per rank mode")
    ap.add_argument("--budgets", default="100,1000,10000")
    ap.add_argument("--sims", type=int, default=20)
    ap.add_argument("--out", default=None,
                    help="directory for report.json + report.md")
    args = ap.parse_args()
    budgets = [float(x) for x in args.budgets.split(",")]

    report: dict = {"modes": {}}
    for path in args.dumps:
        doc = json.loads(Path(path).read_text(encoding="utf-8"))
        mode = (doc.get("metadata") or {}).get("rank_mode") or "ecv"
        items = doc["items"]
        report["modes"][mode] = {
            "source": str(path),
            "items": len(items),
            "survey": survey_metrics(items),
            "judge": judge_sim(items, budgets, args.sims),
            "mesh_proxy": mesh_proxy(items, budgets),
        }

    # §2.3.6 flip criterion, when map + edv are both present.
    if {"map", "edv"} <= set(report["modes"]):
        m, e = report["modes"]["map"], report["modes"]["edv"]
        checks = {}
        for k, mv in m["survey"].items():
            ev = e["survey"][k]
            if k.startswith("first_light"):
                ok = ev <= mv * 1.10  # depth: lower is better
            elif k == "runnable_items":
                ok = True
            else:
                ok = ev >= mv * 0.90
            checks[f"survey:{k}"] = {"map": mv, "edv": ev, "pass": ok}
        for b in m["judge"]:
            for jk in ("contrasts_per_1k", "recovery"):
                mv, ev = m["judge"][b][jk], e["judge"][b][jk]
                checks[f"judge:{jk}@{b}"] = {
                    "map": mv, "edv": ev, "pass": ev > mv}
        for b in m["mesh_proxy"]:
            mv, ev = m["mesh_proxy"][b], e["mesh_proxy"][b]
            checks[f"mesh:{b}"] = {"map": mv, "edv": ev, "pass": ev >= mv}
        report["flip_criterion"] = {
            "checks": checks,
            "verdict": ("FLIP" if all(c["pass"] for c in checks.values())
                        else "HOLD"),
        }

    text = json.dumps(report, indent=1)
    if args.out:
        outdir = Path(args.out)
        outdir.mkdir(parents=True, exist_ok=True)
        (outdir / "report.json").write_text(text + "\n", encoding="utf-8")
        lines = ["# Rank-mode comparison\n"]
        for mode, r in report["modes"].items():
            lines.append(f"## {mode} ({r['items']} items)\n")
            for section in ("survey", "judge", "mesh_proxy"):
                lines.append(f"- **{section}**: "
                             f"`{json.dumps(r[section])}`")
            lines.append("")
        if "flip_criterion" in report:
            fc = report["flip_criterion"]
            lines.append(f"## Flip criterion: **{fc['verdict']}**\n")
            lines.append("| check | map | edv | pass |")
            lines.append("|---|---|---|---|")
            for k, c in fc["checks"].items():
                lines.append(
                    f"| {k} | {c['map']} | {c['edv']} | "
                    f"{'✓' if c['pass'] else '✗'} |")
        (outdir / "report.md").write_text(
            "\n".join(lines) + "\n", encoding="utf-8")
        print(f"report -> {outdir}/report.json, report.md")
    else:
        print(text)
    if "flip_criterion" in report:
        print(f"flip criterion verdict: {report['flip_criterion']['verdict']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
