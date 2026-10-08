#!/usr/bin/env python3
"""False-positive measurement for the ``near_constant_output`` score caveat.

The caveat (score_caveats.near_constant_outputs / near_constant_caveat) says
when a run gave one output to many DIFFERENT inputs. Its bounds — 3 distinct
sources for an output of 3+ words, 5 for a 1–2-word one, a quarter of the
distinct sources and at least 5 of them — were set from this measurement:
the SHIPPED rule run over every real system output (and reference) in
Google's mt-metrics-eval (WMT 2019–2025), which this script never copies,
prints or stores — it reports counts and shares only.

    python3 arena/scripts/verify_near_constant_caveat.py            # full sets + short subsets
    python3 arena/scripts/verify_near_constant_caveat.py --draws 100 # + random small test sets (slow)

Data: ``~/.mt-eval/mt-metrics-eval/mt-metrics-eval-v2`` (``--root``), the
public WMT metrics data `mt-eval` already uses for metric reliability.

Three readings:

1. FULL TEST SETS — every system output file of every pair, scored against
   the pair's first reference; a reference file is scored as a system with
   no reference (a perfect system's own repetition).
2. PHRASEBOOK-LIKE SUBSETS — the same, restricted to sources of <= 2, 4 and
   6 words (short answers recur legitimately: the false-positive risk).
3. SMALL TEST SETS (``--draws N``) — N random draws of 10/20/30/62 rows from
   each pair's <= 4-word sources, per system: how often the caveat would
   fire on a small, short test set by chance.

Each flagged system is listed with the share and the size of its most
repeated output, so a reader can see whether it is broken output ("####",
"failed", leftover markup) or a real system that repeats.
"""

from __future__ import annotations

import argparse
import glob
import os
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mt_eval_harness.score_caveats import near_constant_outputs  # noqa: E402

DEFAULT_ROOT = Path.home() / ".mt-eval" / "mt-metrics-eval" / "mt-metrics-eval-v2"


def _lines(path: str) -> list[str]:
    return Path(path).read_text(encoding="utf-8").split("\n")


def _systems(root: Path):
    """(testset, pair, system, sources, references or None, outputs)."""
    for ts in sorted(os.listdir(root)):
        so = root / ts / "system-outputs"
        if not so.is_dir():
            continue
        for pair in sorted(os.listdir(so)):
            srcf = root / ts / "sources" / f"{pair}.txt"
            if not srcf.exists():
                continue
            srcs = _lines(str(srcf))
            refs_f = sorted(glob.glob(str(root / ts / "references" / f"{pair}.ref*.txt")))
            refs = _lines(refs_f[0]) if refs_f else None
            for f in sorted(os.listdir(so / pair)):
                if not f.endswith(".txt"):
                    continue
                hyps = _lines(str(so / pair / f))
                if len(hyps) < len(srcs) - 1:
                    continue
                is_ref = "ref" in f.lower()
                yield ts, pair, f[:-4], srcs, (None if is_ref else refs), hyps


def _entries(srcs, refs, hyps, idx=None):
    idx = range(len(srcs)) if idx is None else idx
    return [{"source": srcs[i],
             "expected": (refs[i] if refs is not None and i < len(refs) else ""),
             "predicted": hyps[i] if i < len(hyps) else ""} for i in idx]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    ap.add_argument("--draws", type=int, default=0,
                    help="random small test sets per system and size (0: skip)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    if not args.root.is_dir():
        print(f"mt-metrics-eval data not found at {args.root} (--root)")
        return 2

    full: list[tuple] = []
    short: dict[int, list[tuple]] = {2: [], 4: [], 6: []}
    small_flags: dict[int, list[str]] = {10: [], 20: [], 30: [], 62: []}
    small_draws = {n: 0 for n in small_flags}
    rng = random.Random(args.seed)
    for ts, pair, system, srcs, refs, hyps in _systems(args.root):
        name = f"{ts}/{pair}/{system}"
        st = near_constant_outputs(_entries(srcs, refs, hyps))
        if st:
            full.append((name, st))
        for w in short:
            idx = [i for i, s in enumerate(srcs) if s.strip() and len(s.split()) <= w]
            if len(idx) < 20:
                continue
            st = near_constant_outputs(_entries(srcs, refs, hyps, idx))
            if st:
                short[w].append((name, st))
        if args.draws:
            idx4 = [i for i, s in enumerate(srcs) if s.strip() and len(s.split()) <= 4]
            if len(idx4) >= 40:
                for n in small_flags:
                    if n > len(idx4):
                        continue
                    for _ in range(args.draws):
                        small_draws[n] += 1
                        st = near_constant_outputs(
                            _entries(srcs, refs, hyps, rng.sample(idx4, n)))
                        if st and st["flagged"]:
                            small_flags[n].append(name)

    def report(title, rows):
        flagged = [(n, s) for n, s in rows if s["flagged"]]
        top = sorted(rows, key=lambda r: -r[1]["repeat_share"])[:8]
        print(f"\n{title}: {len(rows)} system outputs, {len(flagged)} flagged")
        for n, s in top:
            print(f"  {'FLAGGED ' if s['flagged'] else '        '}{n}: "
                  f"{s['repeated_sources']}/{s['considered_sources']} sources "
                  f"({s['repeat_share']:.1%}) repeat; most repeated output "
                  f"{s['top_output_words']} words × {s['top_output_sources']} sources")

    report("FULL TEST SETS", full)
    for w, rows in short.items():
        report(f"SOURCES OF <= {w} WORDS", rows)
    if args.draws:
        print("\nSMALL TEST SETS (random draws of <= 4-word sources):")
        for n, names in small_flags.items():
            print(f"  n={n}: {len(names)} of {small_draws[n]} draws flagged"
                  + (f" — from {', '.join(sorted(set(names)))}" if names else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
