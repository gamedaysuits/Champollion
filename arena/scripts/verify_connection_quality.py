#!/usr/bin/env python3
"""Empirical verification of Connection Quality cq-v1.

Companion to docs/CONNECTION_QUALITY_SPEC.md and the paper in
docs/papers/connection-quality/ — run on the tracked tree only, so every
number in the paper is reproducible by anyone with the public repo
(the verifiability doctrine). Read-only; prints a report and exits
non-zero if any property check fails. Style follows
verify_bridge_health_model.py (the ecv-v3 verifier).

What it verifies / measures:

1. **Properties, fuzzed** (seeded, deterministic): all channels bounded
   in [0,1]; non-LOW evidence can never strengthen a clean pair (the
   contamination gate, fuzzed over random run sets); no fail-honest
   default equals the most favorable value of its factor; targeted
   monotonicity where it must hold (n, CI, replication, age, trust).

2. **Floor conservativeness, exhaustively**: over every unordered pair
   of the 196 shipped floors (19,110 pairs), the undirected max-of-pair
   correction never exceeds either directed (target-side) correction.
   Also the instrument-recalibration spread: one raw score corrected
   across all 196 languages.

3. **Instrument trust on the real reliability artifact**: w_metric
   resolved for every judged language x {chrF++, BLEU, COMET};
   distribution + UNMEASURED honesty count for mission languages.

4. **Rank-shift study on the external results index**: the L0
   correction applied to every flores200-devtest best chrF++ cell in
   shared/catalogue/external-mt-index.json (relative-lane evidence —
   posture HIGH; used here to measure the *instrument*, never to make
   absolute quality claims). Quantifies how much cross-pair ordering
   raw chrF++ gets wrong: discordant-comparison share, Spearman, and
   the systematic direction of shifts by target-floor quartile.

Usage:
    python3 arena/scripts/verify_connection_quality.py [--tex OUT.tex]

--tex writes the paper's numbers.tex macros so the paper regenerates
from the tree.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

ARENA = Path(__file__).resolve().parent.parent
REPO = ARENA.parent
sys.path.insert(0, str(ARENA))

from mt_eval_harness import connection_quality as cq  # noqa: E402

FLOORS_PATH = REPO / "cli/website/src/data/cchrf-floors.json"
RELIABILITY_PATH = REPO / "shared/catalogue/metric-reliability.json"
EXTERNAL_PATH = REPO / "shared/catalogue/external-mt-index.json"

PROBE_RAW = 40.0  # fixed raw score for the recalibration spread

#: How many unmeasured languages to NAME in the printed line + the paper macro.
#: The count is always reported in full; the naming is trimmed so the macro
#: stays prose-sized. Selection is sorted, so it is deterministic.
UNMEASURED_SAMPLE = 6


def _rand_run(rng, contamination):
    return {
        "run_id": f"r{rng.randrange(10**6)}",
        "chrf_plus_plus": rng.uniform(0, 90),
        "n": rng.choice([None, 10, 62, 100, 500]),
        "ci_halfwidth": rng.choice([None, 1.5, 4.0, 9.0]),
        "l_eff": rng.choice([None, 0.8, 3.0, 7.0]),
        "contamination": contamination,
        "trust": rng.choice(["verified", "unverified"]),
        "paradigm": rng.choice(["llm", "rule-based", None]),
        "age_days": rng.choice([None, 30, 500, 2000]),
        "domain": rng.choice([None, "news", "legal", "religious"]),
        "register": rng.choice([None, "textbook", "government"]),
    }


def section_properties(floors, failures):
    rng = random.Random(20260712)
    checked = 0
    for _ in range(400):
        a, b = rng.sample(sorted(floors), 2)
        clean_runs = [_rand_run(rng, "LOW") for _ in range(rng.randrange(1, 4))]
        direction = rng.choice([None, "a->b", "b->a"])
        t = cq.connection_quality(clean_runs, floors, a, b, direction=direction)
        for ch in ("q", "r", "cq"):
            v = t[ch]
            if v is not None and not (0.0 <= v <= 1.0):
                failures.append(f"fuzz: {ch}={v} out of bounds ({a},{b})")
        dirty = clean_runs + [
            _rand_run(rng, rng.choice(["MEDIUM", "HIGH", None]))
            for _ in range(rng.randrange(1, 3))
        ]
        t2 = cq.connection_quality(dirty, floors, a, b, direction=direction)
        if (t2["q"], t2["r"], t2["cq"]) != (t["q"], t["r"], t["cq"]):
            failures.append(f"fuzz: non-LOW evidence changed a clean pair ({a},{b})")
        checked += 1
    print(f"1. property fuzz: {checked} random boards — bounds + "
          f"non-LOW-never-strengthens "
          + ("OK" if not failures else "FAIL"))

    # fail-honest defaults never the most favorable value
    defaults_ok = (
        cq.f_size(None) < 1.0 and cq.f_rich(None) < 1.0
        and cq.f_repl(None) < 1.0
        and cq.W_CONTAM_UNKNOWN < cq.W_CONTAM["LOW"]
        and cq.W_TRUST_UNKNOWN < cq.W_TRUST["verified"]
        and cq.W_METRIC_UNMEASURED < 1.0
        and cq.w_recency(None, "llm") < 1.0
    )
    if not defaults_ok:
        failures.append("a fail-honest default equals full credit")
    # targeted monotonicity
    mono_ok = (
        cq.f_size(120) >= cq.f_size(80)
        and cq.f_conf(3.0) >= cq.f_conf(6.0)
        and cq.f_repl(2) >= cq.f_repl(1)
        and cq.w_recency(100, "llm") >= cq.w_recency(1000, "llm")
        and cq.w_trust("verified") >= cq.w_trust("unverified")
    )
    if not mono_ok:
        failures.append("monotonicity violated")
    print("   defaults-below-full-credit + monotonicity "
          + ("OK" if defaults_ok and mono_ok else "FAIL"))


def section_floors(floors, failures, tex):
    langs = sorted(floors)
    n = len(langs)
    worst = 0.0
    pairs = 0
    for i in range(n):
        for j in range(i + 1, n):
            a, b = langs[i], langs[j]
            qu = cq.cchrf(PROBE_RAW, max(floors[a], floors[b]))
            qa = cq.cchrf(PROBE_RAW, floors[b])
            qb = cq.cchrf(PROBE_RAW, floors[a])
            excess = qu - min(qa, qb)
            worst = max(worst, abs(excess))
            if qu > min(qa, qb) + 1e-12:
                failures.append(f"conservativeness violated on ({a},{b})")
            pairs += 1
    qs = {l: cq.cchrf(PROBE_RAW, floors[l]) for l in langs}
    lo = min(qs, key=qs.get)
    hi = max(qs, key=qs.get)
    spread = qs[hi] - qs[lo]
    print(f"\n2. floors: {n} languages, {pairs} unordered pairs — undirected "
          f"correction ≤ both directed corrections everywhere "
          f"(max |excess| {worst:.2e}) "
          + ("OK" if not any('conservativeness' in f for f in failures) else "FAIL"))
    print(f"   recalibration spread at raw {PROBE_RAW:.0f}: "
          f"q ranges {qs[lo]:.4f} ({lo}, floor {floors[lo]:.1f}) → "
          f"{qs[hi]:.4f} ({hi}, floor {floors[hi]:.1f}); spread {spread:.4f}")
    tex["FloorLangs"] = str(n)
    tex["FloorPairs"] = f"{pairs:,}"
    tex["SpreadLo"] = f"{qs[lo]:.3f}"
    tex["SpreadLoLang"] = lo
    tex["SpreadHi"] = f"{qs[hi]:.3f}"
    tex["SpreadHiLang"] = hi
    tex["SpreadPct"] = f"{100*spread/qs[lo]:.0f}"


def section_metric_trust(failures, tex, floor_langs=()):
    art = json.loads(RELIABILITY_PATH.read_text())
    langs = sorted(art.get("languages") or {})
    rows = {}
    for metric in ("chrf_plus_plus", "bleu", "comet_score"):
        ws = []
        for lang in langs:
            got = cq.resolve_metric_trust(art, metric, lang)
            if got["basis"] != "unmeasured":
                ws.append(got["w"])
        ws.sort()
        if ws:
            rows[metric] = (len(ws), ws[0], ws[len(ws)//2], ws[-1])
    print(f"\n3. instrument trust over the reliability artifact "
          f"({len(langs)} judged languages):")
    for m, (k, lo, med, hi) in rows.items():
        print(f"   {m:<16} resolved {k:>3}  w min {lo:.3f}  med {med:.3f}  max {hi:.3f}")
    # UNMEASURED honesty. The probe population is DERIVED: every language the
    # floor atlas covers, minus those the reliability artifact actually judged.
    # It used to be a hand-written tuple of six codes (crk, iku, kal, yor, que,
    # grn) — a language set living in code, which is the thing this repo forbids
    # everywhere else, and which could only ever report on the six languages
    # someone thought to name. Deriving it reports the real number.
    probes = sorted(set(floor_langs) - set(langs))
    unmeasured = [p for p in probes
                  if cq.resolve_metric_trust(art, "chrf_plus_plus", p)["basis"]
                  == "unmeasured"]
    shown = ", ".join(unmeasured[:UNMEASURED_SAMPLE]) or "none"
    more = len(unmeasured) - min(len(unmeasured), UNMEASURED_SAMPLE)
    print(f"   UNMEASURED honesty ({len(unmeasured)} of {len(probes)} probed "
          f"languages): {shown}"
          + (f", +{more} more" if more else "")
          + f" → w = {cq.W_METRIC_UNMEASURED}, labeled")
    if "chrf_plus_plus" in rows:
        k, lo, med, hi = rows["chrf_plus_plus"]
        tex["MtChrfN"] = str(k)
        tex["MtChrfMin"] = f"{lo:.2f}"
        tex["MtChrfMed"] = f"{med:.2f}"
        tex["MtChrfMax"] = f"{hi:.2f}"
    if "bleu" in rows:
        tex["MtBleuMin"] = f"{rows['bleu'][1]:.2f}"
        tex["MtBleuMed"] = f"{rows['bleu'][2]:.2f}"
    tex["MtUnmeasuredProbes"] = shown + (f", +{more} more" if more else "")
    tex["MtUnmeasuredCount"] = str(len(unmeasured))
    tex["MtProbedCount"] = str(len(probes))


def _spearman(xs, ys):
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
    mx = sum(rx) / n
    my = sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    dx = sum((a - mx) ** 2 for a in rx) ** 0.5
    dy = sum((b - my) ** 2 for b in ry) ** 0.5
    return num / (dx * dy) if dx and dy else float("nan")


def section_external(floors, tex):
    d = json.loads(EXTERNAL_PATH.read_text())
    pairs = d["pairs"]
    testset = "flores200-devtest"
    rows = []  # (pairkey, tgt_iso3, floor, raw, corrected)
    uncorrectable = 0
    total = 0
    for key, cells in pairs.items():
        cell = cells.get(testset)
        if not cell or "chrf_pp" not in cell:
            continue
        total += 1
        raw = cell["chrf_pp"][1]
        tgt = key.split("-")[-1].split("_")[0]
        floor = floors.get(tgt)
        q = cq.cchrf(raw, floor) if floor is not None else None
        if q is None:
            uncorrectable += 1
            continue
        rows.append((key, tgt, floor, raw, q))
    raws = [r[3] for r in rows]
    qs = [r[4] for r in rows]
    rho = _spearman(raws, qs)

    # discordant-comparison share, estimated on a seeded sample of pairs
    rng = random.Random(20260712)
    m = len(rows)
    trials = 200_000
    discordant = 0
    comparable = 0
    for _ in range(trials):
        i, j = rng.randrange(m), rng.randrange(m)
        if i == j:
            continue
        dr = rows[i][3] - rows[j][3]
        dq = rows[i][4] - rows[j][4]
        if dr == 0 or dq == 0:
            continue
        comparable += 1
        if (dr > 0) != (dq > 0):
            discordant += 1
    disc_share = discordant / comparable if comparable else float("nan")

    # systematic direction: mean rank shift by target-floor quartile
    by_raw = sorted(range(m), key=lambda i: -rows[i][3])
    by_q = sorted(range(m), key=lambda i: -rows[i][4])
    rank_raw = {i: p for p, i in enumerate(by_raw)}
    rank_q = {i: p for p, i in enumerate(by_q)}
    floors_sorted = sorted(range(m), key=lambda i: rows[i][2])
    qsize = m // 4
    quart_shift = []
    for qi in range(4):
        idxs = floors_sorted[qi * qsize: (qi + 1) * qsize if qi < 3 else m]
        shift = sum(rank_raw[i] - rank_q[i] for i in idxs) / len(idxs)
        lo, hi = rows[idxs[0]][2], rows[idxs[-1]][2]
        quart_shift.append((lo, hi, shift))

    print(f"\n4. external index ({testset}): {total:,} pairs with best chrF++, "
          f"{len(rows):,} corrected, {uncorrectable:,} floor-unknown "
          f"(honest neutral-slate population)")
    print(f"   raw vs corrected ordering: Spearman ρ {rho:.4f}; "
          f"discordant cross-pair comparisons {100*disc_share:.1f}% "
          f"(seeded sample n={comparable:,})")
    print("   mean rank shift (positive = rises under correction), by target-floor quartile:")
    for (lo, hi, shift) in quart_shift:
        print(f"     floors {lo:5.2f}–{hi:5.2f}: {shift:+8.1f} positions")
    tex["ExtTotal"] = f"{total:,}"
    tex["ExtCorrected"] = f"{len(rows):,}"
    tex["ExtUnknown"] = f"{uncorrectable:,}"
    tex["ExtSpearman"] = f"{rho:.3f}"
    tex["ExtDiscordant"] = f"{100*disc_share:.1f}"
    for name, (lo, hi, shift) in zip(("QOne", "QTwo", "QThree", "QFour"), quart_shift):
        tex[f"Ext{name}Lo"] = f"{lo:.1f}"
        tex[f"Ext{name}Hi"] = f"{hi:.1f}"
        tex[f"Ext{name}Shift"] = f"{shift:+.0f}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tex", type=Path, default=None,
                    help="write paper numbers.tex macros here")
    args = ap.parse_args()

    floors = json.loads(FLOORS_PATH.read_text())["floors"]
    failures: list[str] = []
    tex: dict[str, str] = {}

    section_properties(floors, failures)
    section_floors(floors, failures, tex)
    section_metric_trust(failures, tex, floor_langs=sorted(floors))
    section_external(floors, tex)

    if args.tex:
        lines = ["% AUTO-GENERATED by arena/scripts/verify_connection_quality.py",
                 "% — do not edit; re-run the script to refresh."]
        for k, v in sorted(tex.items()):
            lines.append(f"\\newcommand{{\\{k}}}{{{v}}}")
        args.tex.write_text("\n".join(lines) + "\n")
        print(f"\nnumbers.tex written: {args.tex}")

    if failures:
        print("\nPROPERTY FAILURES:")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print("\nall property checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
