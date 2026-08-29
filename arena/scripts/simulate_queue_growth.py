#!/usr/bin/env python3
"""Simulate mesh growth under the production queue formula (ecv-v3).

Answers three founder questions with numbers instead of vibes:
  1. How does the network grow if contributors follow the queue —
     plausible and desirable?
  2. Would a different incentive design grow it better?
  3. What do prizes (attention pinned to specific pairs) do to growth?

Fidelity rules:
  - The ranking is THE PRODUCTION CODE, imported from
    generate_sweep_queue.py (reliability_factors, build_evidence,
    build_chain_matrix, single_edge_gain, predict_strength, bridge
    tiers, λ/κ/thresholds). The simulator re-implements only main()'s
    item loop, using those same atoms — no formula re-derivation.
  - The corpus universe is the REAL registry (eligible corpora, their
    sizes and richness blocks) and the real model lineup.
  - Ground truth is calibrated to the pre-wipe board: pair base
    quality ~ Beta matched to the observed mean 0.54 / spread of the
    430-run era (range 0.09–0.87); per-run observation noise
    sd = 0.25/√n in strength units, so a 100-entry corpus reports
    ±~5 chrF 95% CIs — the policy noise floor, by construction.

Contributor policies:
  follower   — picks uniformly from the queue's top 10 open items
  random     — uniform over all open items (walk-ins)
  cheapest   — minimizes est cost
  oracle     — knows true scores; greedily maximizes ACTUAL ΔΦ/$
               (efficiency ceiling, not a real policy)
  prize      — ignores the queue; repeatedly runs the best model,
               coached, on a designated prize pair (replications
               allowed — method-development grinding)

Queue variants (the "better incentive?" question):
  v3        — production ECV (ΔΦ_eff per dollar)
  v2        — quality-only (reliability ignored in the chain matrix
              and in run valuation)
  v1ish     — uncovered pairs first, then cheapest (the old heuristic)
  estbonus  — v3, with ΔΦ doubled for runs that would newly cross an
              edge into the ESTABLISHED tier (goal-gradient variant)

Usage:
  python3 scripts/simulate_queue_growth.py --runs 1200 --seeds 2 \
      --out /tmp/sim_results.json
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import random
import sys
from pathlib import Path

ARENA = Path(__file__).resolve().parent.parent
SCRIPT = ARENA / "scripts" / "generate_sweep_queue.py"

spec = importlib.util.spec_from_file_location("gsq", SCRIPT)
gsq = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gsq)

# ---------------------------------------------------------------------------
# Universe: real registry + real lineup
# ---------------------------------------------------------------------------

MODEL_OFFSETS = {
    # strength-space skill offsets, shaped like the pre-wipe two-way
    # decomposition (haiku trailed ~-0.11; flagships led)
    "anthropic/claude-haiku-4.5": -0.11,
    "anthropic/claude-sonnet-4.6": -0.02,
    "anthropic/claude-opus-4.8": +0.05,
    "google/gemini-3.5-flash": -0.05,
    "google/gemini-3.1-pro-preview": +0.03,
    "openai/gpt-5.5": +0.04,
    "anthropic/claude-fable-5": +0.06,
}
COACHED_UPLIFT_MEAN = 0.05
COST_PER_ENTRY = {  # USD, shaped like the sweep manifest medians
    "anthropic/claude-haiku-4.5": 0.00009,
    "anthropic/claude-sonnet-4.6": 0.00033,
    "anthropic/claude-opus-4.8": 0.0011,
    "google/gemini-3.5-flash": 0.00007,
    "google/gemini-3.1-pro-preview": 0.00045,
    "openai/gpt-5.5": 0.00060,
    "anthropic/claude-fable-5": 0.00085,
}


def load_universe():
    registry = gsq.load_json(gsq.REGISTRY)
    corpora = gsq.queue_corpora(registry)
    nodes = sorted({
        l for ds in corpora
        for l in (ds["language_pair"]["source"], ds["language_pair"]["target"])
    })
    return registry, corpora, nodes


def ground_truth(corpora, rng):
    """True (pair, model, condition) strengths the queue cannot see."""
    pair_base = {}
    for ds in corpora:
        e = frozenset(ds["language_pair"].values())
        if e not in pair_base:
            # Beta(4.4, 3.7): mean .543, sd .15 — the pre-wipe board shape
            pair_base[e] = min(0.92, max(0.06, rng.betavariate(4.4, 3.7)))
    truth = {}
    for e in pair_base:
        for m, off in MODEL_OFFSETS.items():
            base = pair_base[e] + off + rng.gauss(0, 0.02)
            truth[(e, m, "naive")] = min(0.95, max(0.02, base))
            truth[(e, m, "coached")] = min(
                0.95, max(0.02, base + rng.gauss(COACHED_UPLIFT_MEAN, 0.02)))
    return truth


# ---------------------------------------------------------------------------
# The queue, rebuilt from production atoms each re-rank
# ---------------------------------------------------------------------------

def rank_items(corpora, registry, results, *, variant="v3"):
    """Mirror of main()'s valuation loop using the imported atoms."""
    evidence = gsq.build_evidence(registry.get("datasets", []), results)
    nodes = sorted({
        l for ds in corpora
        for l in (ds["language_pair"]["source"], ds["language_pair"]["target"])
    } | {l for e in evidence["edge_bridge"] for l in e})

    if variant == "v2":
        strengths = {e: b["q"] for e, b in evidence["edge_bridge"].items()}
    else:
        strengths = {e: b["s_eff"] for e, b in evidence["edge_bridge"].items()}
    Q = gsq.build_chain_matrix(nodes, strengths, lam=gsq.LAMBDA)

    covered = {(r["token"], r["model"], r["condition"]) for r in results}
    items, gain_cache = [], {}
    for ds in corpora:
        src, tgt = ds["language_pair"]["source"], ds["language_pair"]["target"]
        edge = frozenset((src, tgt))
        stem = Path(ds["path"]).stem.lower()
        bridge = evidence["edge_bridge"].get(edge)
        n_run = ds.get("size") or 0
        rich = (ds.get("richness") or {}).get("mean_effective_words")
        for cond in ("naive", "coached"):
            for slug in MODEL_OFFSETS:
                ms = gsq.model_short(slug)
                if (stem, ms, cond) in covered:
                    continue
                cost = max(COST_PER_ENTRY[slug] * n_run, gsq.COST_FLOOR)
                pred = gsq.predict_strength(
                    (src, tgt), ms, cond, evidence, kappa=gsq.KAPPA)
                runs_cur = bridge["runs"] if bridge else 0
                if variant == "v2":
                    q_cur = bridge["q"] if bridge else 0.0
                    s_new = max(q_cur, pred["predicted_strength"])
                else:
                    fac_a = gsq.reliability_factors(
                        n_run, rich, None, runs_cur + 1)
                    s_a = pred["predicted_strength"] * fac_a["r"]
                    s_b = 0.0
                    if bridge:
                        fac_b = gsq.reliability_factors(
                            bridge["n_eval"], bridge["eff_words"],
                            bridge["ci_half"], runs_cur + 1)
                        s_b = bridge["q"] * fac_b["r"]
                    s_new = max(bridge["s_eff"] if bridge else 0.0, s_a, s_b)
                key = (edge, round(s_new, 6))
                if key not in gain_cache:
                    gain_cache[key] = gsq.single_edge_gain(
                        nodes, Q, src, tgt, s_new, lam=gsq.LAMBDA)
                gain = gain_cache[key]
                if variant == "estbonus" and bridge:
                    before = bridge["tier"]
                    after = gsq.bridge_tier(
                        max(n_run, bridge["n_eval"]),
                        rich or bridge["eff_words"],
                        bridge["ci_half"], runs_cur + 1)
                    if before != "established" and after == "established":
                        gain *= 2.0
                elif variant == "estbonus" and not bridge:
                    pass
                if variant == "v1ish":
                    score = (0 if bridge else 1, -cost)  # uncovered, cheap
                else:
                    score = gain / cost
                items.append({
                    "token": stem, "model": ms, "slug": slug, "cond": cond,
                    "edge": edge, "n": n_run, "cost": cost, "score": score,
                })
    if variant == "v1ish":
        items.sort(key=lambda i: (-i["score"][0], -i["score"][1]))
    else:
        items.sort(key=lambda i: -i["score"])
    return items, evidence, nodes


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def measure(evidence, nodes, watch=()):
    strengths = {e: b["s_eff"] for e, b in evidence["edge_bridge"].items()}
    Q = gsq.build_chain_matrix(nodes, strengths, lam=gsq.LAMBDA)
    n = len(nodes)
    phi = (sum(Q[u][v] for u in nodes for v in nodes if u != v)
           / (n * (n - 1))) if n > 1 else 0.0
    tiers = [b["tier"] for b in evidence["edge_bridge"].values()]
    # per-language service = mean chain strength to every other language
    svc = {u: sum(Q[u][v] for v in nodes if v != u) / (n - 1) for u in nodes}
    out = {
        "phi": round(phi, 5),
        "measured": len(tiers),
        "established": sum(1 for t in tiers if t == "established"),
        "min_service": round(min(svc.values()), 5) if svc else 0.0,
        "mean_service": round(sum(svc.values()) / len(svc), 5) if svc else 0.0,
    }
    # watch-node service (e.g. the prize language) — how well it reaches
    # the rest of the mesh, the thing a prize is actually trying to buy.
    for w in watch:
        out[f"service[{w}]"] = round(svc.get(w, 0.0), 5)
    return out


# ---------------------------------------------------------------------------
# Simulation loop
# ---------------------------------------------------------------------------

def observe(truth, key, n, rng):
    sd = 0.25 / math.sqrt(max(1, n))
    obs = min(0.99, max(0.01, rng.gauss(truth[key], sd)))
    ci_half = 49.0 / math.sqrt(max(1, n))   # chrF points; ±~5 at n=100
    return obs, ci_half


def prize_run(by_edge, truth, e, attempts, rng):
    """One method-development attempt on a prize edge.

    Prizes target low-resource, mission-critical pairs (spa→que,
    eng→crk) — not solved-market pairs. A prize draws skilled effort
    that ITERATES: coached runs whose achievable quality climbs with
    sustained method development (better prompts, FST gating, retrieval)
    toward a ceiling, with diminishing returns. We model that as a
    method bonus on top of the pair's coached truth:

        bonus(k) = 0.14 · (1 − exp(−k / 8))     # asymptotes ~+0.14

    so a prize pair, under tens of attempts, climbs from provisional to
    a high-quality, well-replicated (established) bridge — the depth a
    breadth-first queue never buys on a leaf pair.
    """
    ds = max(by_edge[e], key=lambda d: d.get("size") or 0)
    slug = max(MODEL_OFFSETS, key=MODEL_OFFSETS.get)
    n = ds.get("size") or 0
    bonus = 0.14 * (1.0 - math.exp(-attempts / 8.0))
    base = truth[(e, slug, "coached")]
    sd = 0.25 / math.sqrt(max(1, n))
    obs = min(0.98, max(0.02, rng.gauss(min(0.97, base + bonus), sd)))
    ci = 49.0 / math.sqrt(max(1, n))
    cost = max(COST_PER_ENTRY[slug] * n, gsq.COST_FLOOR)
    return {
        "token": Path(ds["path"]).stem.lower(),
        "model": gsq.model_short(slug), "condition": "coached",
        "strength": obs, "n_eval": n, "ci_half": ci,
    }, cost


def simulate(*, runs, seed, mix, variant="v3", rerank_every=10,
             prize_edges=(), prize_share=0.0, prize_mode="divert",
             watch=()):
    rng = random.Random(seed)
    registry, corpora, nodes = load_universe()
    truth = ground_truth(corpora, rng)
    by_edge = {}
    for ds in corpora:
        e = frozenset(ds["language_pair"].values())
        by_edge.setdefault(e, []).append(ds)

    results, spend, history = [], 0.0, []
    prize_attempts = {e: 0 for e in prize_edges}
    items, evidence, gnodes = rank_items(corpora, registry, results,
                                         variant=variant)

    def true_gain_per_dollar(item):
        # oracle helper: actual post-run s_eff using TRUE quality
        key = (item["edge"], item["slug"], item["cond"])
        tq = truth[(item["edge"], item["slug"], item["cond"])]
        bridge = evidence["edge_bridge"].get(item["edge"])
        runs_cur = bridge["runs"] if bridge else 0
        ds = next(d for d in by_edge[item["edge"]]
                  if Path(d["path"]).stem.lower() == item["token"])
        rich = (ds.get("richness") or {}).get("mean_effective_words")
        fac = gsq.reliability_factors(item["n"], rich, None, runs_cur + 1)
        s_new = max(bridge["s_eff"] if bridge else 0.0, tq * fac["r"])
        strengths = {e: b["s_eff"] for e, b in evidence["edge_bridge"].items()}
        Q = gsq.build_chain_matrix(gnodes, strengths, lam=gsq.LAMBDA)
        a, b = tuple(item["edge"])
        return gsq.single_edge_gain(gnodes, Q, a, b, s_new,
                                    lam=gsq.LAMBDA) / item["cost"]

    def fire_prize(t):
        e = prize_edges[rng.randrange(len(prize_edges))]
        prize_attempts[e] += 1
        rec, cost = prize_run(by_edge, truth, e, prize_attempts[e], rng)
        rec["submitted_at"] = f"2026-06-{13 + t // 200:02d}"
        results.append(rec)
        return cost

    for t in range(runs):
        if t % rerank_every == 0:
            items, evidence, gnodes = rank_items(
                corpora, registry, results, variant=variant)
            history.append({"run": t, "spend": round(spend, 2),
                            **measure(evidence, gnodes, watch)})

        # ADDITIVE prize: a funded prize draws NEW effort (the eng→crk
        # sandbox lane), so prize runs happen ON TOP of normal queue
        # contribution — the pie grows. Fires before the queue pick.
        if prize_edges and prize_mode == "additive" and rng.random() < prize_share:
            spend += fire_prize(t)

        open_items = [i for i in items if (
            i["token"], i["model"], i["cond"]) not in {
            (r["token"], r["model"], r["condition"]) for r in results}]

        # DIVERSION prize: prize-hunters are drawn from the existing
        # pool — this tick's contributor grinds the prize pair instead
        # of following the queue (opportunity cost on breadth).
        if prize_edges and prize_mode == "divert" and rng.random() < prize_share:
            spend += fire_prize(t)
            continue
        if not open_items:
            if prize_edges:
                continue  # queue exhausted; prize lane may still run
            break

        persona = rng.choices(list(mix), weights=list(mix.values()))[0]
        if persona == "follower":
            pick = open_items[rng.randrange(min(10, len(open_items)))]
        elif persona == "random":
            pick = open_items[rng.randrange(len(open_items))]
        elif persona == "cheapest":
            pick = min(open_items, key=lambda i: i["cost"])
        elif persona == "oracle":
            pool = open_items[:60]  # oracle evaluates a wide slate
            pick = max(pool, key=true_gain_per_dollar)
        else:
            raise ValueError(persona)

        obs, ci = observe(
            truth, (pick["edge"], pick["slug"], pick["cond"]),
            pick["n"], rng)
        results.append({
            "token": pick["token"], "model": pick["model"],
            "condition": pick["cond"], "strength": obs,
            "n_eval": pick["n"], "ci_half": ci,
            "submitted_at": f"2026-06-{13 + t // 200:02d}",
        })
        spend += pick["cost"]

    items, evidence, gnodes = rank_items(corpora, registry, results,
                                         variant=variant)
    history.append({"run": runs, "spend": round(spend, 2),
                    **measure(evidence, gnodes, watch)})
    return history


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--runs", type=int, default=1200)
    ap.add_argument("--seeds", type=int, default=2)
    ap.add_argument("--out", default="/tmp/sim_results.json")
    args = ap.parse_args()

    MIX = {"follower": .6, "random": .25, "cheapest": .15}
    scenarios = {
        # 1. growth under the production formula
        "v3-follower": dict(mix={"follower": 1.0}, variant="v3"),
        "v3-mixed": dict(mix=MIX, variant="v3"),
        # 2. alternative incentive designs
        "v2-follower": dict(mix={"follower": 1.0}, variant="v2"),
        "v1ish-follower": dict(mix={"follower": 1.0}, variant="v1ish"),
        "estbonus-follower": dict(mix={"follower": 1.0}, variant="estbonus"),
        "oracle": dict(mix={"oracle": 1.0}, variant="v3"),
    }

    # 3. prizes — pinned to LOW-RESOURCE, mission-critical pairs (the
    #    real prize lane: spa→que / eng→que, i.e. Quechua), never to
    #    solved-market majors. `que` is the watched node: a prize is
    #    really trying to raise that language's service to the mesh.
    prize_edges = [frozenset(("spa", "que")), frozenset(("eng", "que"))]
    watch = ("que",)
    scenarios["v3-noprize"] = dict(mix=MIX, variant="v3", watch=watch)
    for share in (0.15, 0.30):
        # diversion: prize pulls effort FROM the queue (opportunity cost)
        scenarios[f"prize-divert{int(share*100)}"] = dict(
            mix=MIX, variant="v3", prize_edges=prize_edges,
            prize_share=share, prize_mode="divert", watch=watch)
        # additive: a funded prize draws NEW effort (the realistic case)
        scenarios[f"prize-additive{int(share*100)}"] = dict(
            mix=MIX, variant="v3", prize_edges=prize_edges,
            prize_share=share, prize_mode="additive", watch=watch)
    out = {}

    for name, cfg in scenarios.items():
        seeds_hist = []
        for s in range(args.seeds):
            h = simulate(runs=args.runs, seed=1000 + s, **cfg)
            seeds_hist.append(h)
            print(f"{name} seed{s}: final {h[-1]}")
        out[name] = seeds_hist
    Path(args.out).write_text(json.dumps(out, indent=1))
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
