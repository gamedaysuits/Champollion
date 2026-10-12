#!/usr/bin/env python3
"""Empirical verification of the bridge-health model (mesh v3 proposal).

Companion to docs/PLAN_BRIDGE_HEALTH_AND_FUNNELS.md §1 — run BEFORE
implementing ecv-v3, so the formula's behavior is checked against the
project's real corpora and run reports rather than asserted. Read-only;
prints a report and exits non-zero if any property check fails.

What it verifies:

1. **Character economy c(L)** — the language-aware unit behind
   "effective length". For every language X with an eng-paired corpus,
   c(X) = median over entries of chars(X side) / words(eng side):
   how many characters of X carry one English word's worth of content.
   This is measured from our own parallel data (no typology lookup
   tables, no hardcoding): CJK lands ~2-4 chars/word-equivalent,
   Latin-script European languages ~5-7, morphologically rich /
   polysynthetic languages spend MORE chars per English word — long
   words, same content — which is exactly what naive whitespace word
   counts get wrong in both directions.

2. **Effective length L̄_eff = chars / c(L)** fixes the two known
   failure modes: jpn/cmn "1-word" sentences (script artifact) and
   polysynthetic single-word sentences score by content, not spaces.

3. **Reliability r(e) = f_size·f_rich·f_conf·f_repl** on real cases:
   the local (unpublished) e2e reports provide genuine n and bootstrap
   CIs; the founder's "62 single-word pairs" hypothetical and a
   replicated-established hypothetical bracket the range.

4. **Properties**: every factor and r in [0,1]; r monotone in each
   input; a vocabulary-list corpus can never reach the established
   tier on any quality score.
"""
from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path

ARENA = Path(__file__).resolve().parent.parent
DATASET_DIRS = [ARENA / "datasets" / "curated",
                ARENA / "datasets" / ".cache" / "curated"]
HARNESS_LOGS = ARENA / "eval" / "logs" / "harness"

# Proposed thresholds (plan §1.2) — literature anchors in the plan doc.
N_FULL = 100          # significance floor (corpus-design §6.3; Koehn 2004
                      # treats even 300 as "small")
L_HEALTHY = 5.0       # effective words for a real-sentence corpus
H_NOISE = 5.0         # chrF noise floor (policy §5; Kocmi et al. 2021 on
                      # untrustworthy small deltas)
RUNS_FULL = 2         # replication target (Marie et al. 2021)


def f_size(n):  return min(1.0, n / N_FULL)
def f_rich(L):  return min(1.0, L / L_HEALTHY)
def f_conf(h):  return min(1.0, H_NOISE / h) if h and h > 0 else 0.5
def f_repl(k):  return min(1.0, k / RUNS_FULL)


def reliability(n, L, h, k):
    return f_size(n) * f_rich(L) * f_conf(h) * f_repl(k)


def load_corpora():
    out = {}
    for d in DATASET_DIRS:
        if not d.is_dir():
            continue
        for p in sorted(d.glob("*-dev-v1.json")):
            if p.name not in out:
                try:
                    out[p.name] = json.loads(p.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    pass
    return out


def main() -> int:
    failures = []
    corpora = load_corpora()
    print(f"corpora loaded: {len(corpora)}")

    # ---- 1. character economy from eng-paired corpora -------------------
    econ_samples: dict[str, list[float]] = {}
    for name, c in corpora.items():
        lp = c.get("language_pair") or {}
        src, tgt = lp.get("source"), lp.get("target")
        if "eng" not in (src, tgt):
            continue
        other = tgt if src == "eng" else src
        for e in c.get("entries", []):
            eng_text = e["source"] if src == "eng" else e["reference"]
            oth_text = e["reference"] if src == "eng" else e["source"]
            ew = len(eng_text.split())
            if ew == 0:
                continue
            econ_samples.setdefault(other, []).append(len(oth_text) / ew)
    econ = {l: statistics.median(v) for l, v in econ_samples.items()
            if len(v) >= 30}
    print(f"\ncharacter economy c(L) — measured chars per English-word-equivalent")
    print(f"  (from {sum(len(v) for v in econ_samples.values())} aligned entries; ≥30 required)")
    eng_chars = []
    for c in corpora.values():
        lp = c.get("language_pair") or {}
        if lp.get("source") == "eng":
            for e in c.get("entries", []):
                w = len(e["source"].split())
                if w:
                    eng_chars.append(len(e["source"]) / w)
    c_eng = statistics.median(eng_chars) if eng_chars else 6.0
    print(f"  eng (baseline): {c_eng:.1f}")
    for lang in sorted(econ):
        print(f"  {lang}: {econ[lang]:.1f}")

    # ---- 2. effective length on the known failure modes ------------------
    print("\neffective length L̄_eff = mean chars / c(L)  vs naive word count")
    cases = []
    for probe in ("jpn-kor-dev-v1.json", "eng-fao-dev-v1.json",
                  "eng-yor-dev-v1.json", "cmn-kor-dev-v1.json"):
        c = corpora.get(probe)
        if not c:
            continue
        lp = c["language_pair"]
        src = lp["source"]
        c_src = econ.get(src, c_eng if src == "eng" else None)
        entries = c["entries"]
        words = statistics.mean(len(e["source"].split()) for e in entries)
        chars = statistics.mean(len(e["source"]) for e in entries)
        eff = chars / c_src if c_src else float("nan")
        cases.append((probe, src, words, eff))
        flag = ""
        if words <= 1.5 and eff >= 4.0:
            flag = "  ← script artifact corrected (real sentences)"
        print(f"  {probe:<24} src={src} naive_words={words:>5.1f} "
              f"chars={chars:>5.0f} eff_words={eff:>5.1f}{flag}")
    # property: the jpn/cmn "1-word" corpora must rehabilitate to ≥ 4 eff words
    for probe, src, words, eff in cases:
        if src in ("jpn", "cmn") and words < 1.5 and not eff >= 4.0:
            failures.append(f"{probe}: effective length did not correct "
                            f"the script artifact (eff={eff:.1f})")

    # ---- 3. r(e) on real and bracket cases -------------------------------
    print("\nreliability worked examples")
    rows = []
    # real local e2e reports (unpublished): n + bootstrap CI from report
    if HARNESS_LOGS.is_dir():
        for rp in sorted(HARNESS_LOGS.glob("*_report.json")):
            try:
                rep = json.loads(rp.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            ov = rep.get("overall", {})
            n = ov.get("evaluated", 0)
            cis = ov.get("confidence_intervals", {}) or {}
            chrf_ci = cis.get("corpus_chrf") or cis.get("chrf") or {}
            lo, hi = chrf_ci.get("lower"), chrf_ci.get("upper")
            h = (hi - lo) / 2 if lo is not None and hi is not None else None
            corp = rep.get("config", {}).get("corpus_path", "")
            cname = Path(corp).name
            cobj = corpora.get(cname)
            if cobj and n:
                lp = cobj["language_pair"]
                c_src = econ.get(lp["source"],
                                 c_eng if lp["source"] == "eng" else None)
                if not c_src:
                    continue
                chars = statistics.mean(
                    len(e["source"]) for e in cobj["entries"])
                L = chars / c_src
                rows.append((f"REAL {cname} ({lp['source']}>{lp['target']})",
                             n, L, h if h else 8.0, 1))
    rows += [
        ("HYPO 62 single-word vocab items, 1 run", 62, 1.0, 8.0, 1),
        ("HYPO 200 sentences, ±3 CI, 3 runs", 200, 8.0, 3.0, 3),
        ("HYPO 101 'one-word' jpn (eff 5.6), 1 run", 101, 5.6, 7.0, 1),
    ]
    print(f"  {'case':<46}{'n':>5}{'L̄eff':>6}{'±CI':>5}{'runs':>5}"
          f"{'f_n':>6}{'f_L':>6}{'f_h':>6}{'f_k':>6}{'r':>6}")
    for label, n, L, h, k in rows:
        r = reliability(n, L, h, k)
        print(f"  {label:<46}{n:>5}{L:>6.1f}{h:>5.1f}{k:>5}"
              f"{f_size(n):>6.2f}{f_rich(L):>6.2f}{f_conf(h):>6.2f}"
              f"{f_repl(k):>6.2f}{r:>6.2f}")
        if not (0.0 <= r <= 1.0):
            failures.append(f"r out of bounds for {label}: {r}")
    vocab_r = reliability(62, 1.0, 8.0, 1)
    if vocab_r > 0.2:
        failures.append(f"vocabulary-list corpus reaches r={vocab_r:.2f} > 0.2")

    # ---- 4. monotonicity --------------------------------------------------
    base = (80, 4.0, 6.0, 1)
    r0 = reliability(*base)
    for i, bumped in enumerate([(120, 4.0, 6.0, 1), (80, 8.0, 6.0, 1),
                                (80, 4.0, 3.0, 1), (80, 4.0, 6.0, 2)]):
        if reliability(*bumped) < r0 - 1e-12:
            failures.append(f"non-monotone in factor {i}")
    print("\nmonotonicity: improving any factor never lowers r — "
          + ("OK" if not any('non-monotone' in f for f in failures) else "FAIL"))

    if failures:
        print("\nPROPERTY FAILURES:")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print("\nall property checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
