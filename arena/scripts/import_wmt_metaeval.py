#!/usr/bin/env python3
"""Import WMT Metrics-task human judgments → metric-reliability index (plan B3).

Meta-evaluation: which automatic metric agrees with human judgment, for which
language (family)? This importer reads the WMT Metrics shared-task archive
(mt-metrics-eval v2 data: human DA/MQM/ESA judgments + submitted metric scores
+ system outputs, wmt19–wmt25) and writes ONLY derived correlation statistics:

    shared/catalogue/metric-reliability.json

per (test set, language pair, human-score lane, level, metric):
system-level and segment-level Pearson / Spearman / Kendall tau-b (+ Kocmi-style
pairwise accuracy at system level), rolled up per TARGET-language family. This
is the evidence layer behind "for this kind of language, believe chrF++ this
much and COMET that much" — the metric-reliability cards and (eventually)
`mt-eval recommend` consume it.

Sources (probe-verified 2026-07-07, docs/BENCHMARK_INTAKE.md):
  * google-research/mt-metrics-eval (toolkit code Apache-2.0). The DATA tarball
    lives at https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz (912 MB) —
    the README's storage.googleapis.com URL is STALE (403). The tarball is NOT
    immutable: pin ETag + Last-Modified + sha256 at download time and record
    them here (--pins are read from curl's -D header dump + a sha256 sidecar).
  * google/wmt-mqm-human-evaluation (Apache-2.0) — the upstream origin of the
    MQM ratings redistributed inside mt-metrics-eval; pinned as provenance for
    the mqm lanes (high-resource pairs only).

Honesty rules baked in (FACT_PROVENANCE_AUDIT + DATA_BOUNDARIES doctrine):
  * Corpus/judgment CONTENT is never tracked: sources, references, system
    outputs and raw scores stay in the local cache (--data-dir, outside the
    repo). The artifact carries derived correlation numbers + provenance only.
  * Every derived value is champollion-derived, crediting the upstreams —
    never written under an upstream's name.
  * License caution: the bundled human-judgment / test-set text carries NO
    explicit upstream license statement → the artifact is flagged
    non-commercial-hold pending founder review. The MQM lanes additionally
    trace to google/wmt-mqm-human-evaluation (Apache-2.0).
  * Fail-honest: unresolvable language codes, testsets without human
    judgments (wmt24pp), and degenerate cells (too few points, zero variance,
    ragged segment counts) are EXCLUDED and listed with reasons — never
    silently dropped, never coerced.
  * Score orientation: mt-metrics-eval distributes ALL scores (human and
    metric, including MQM and MetricX) as higher-is-better; correlations are
    computed on the values as distributed, no sign flipping (verified
    empirically: MetricX-23 vs COMET sys-level Pearson +0.97 on wmt23 en-de).

Metric identity: cells use the canonical ids of shared/metric-registry.json
(bleu, spbleu, chrf_plain, chrf_plus_plus, comet_score, metricx_score); the
verbatim upstream metric name + reference used are recorded per cell (COMET-22
≠ COMET-DA_2021 — the version-pin doctrine, registry workstream B1). chrF++ is
only bundled upstream for wmt20, so a clearly-flagged COMPUTED lane scores it
with sacrebleu (word_order=2) from the cached system outputs + references for
every other test set (`"computed": true` on the cell; disable with
--no-computed-chrfpp).

Usage:
    mkdir -p ~/.mt-eval/mt-metrics-eval && cd ~/.mt-eval/mt-metrics-eval
    curl -sSL -D mt-metrics-eval-v2.headers -o mt-metrics-eval-v2.tgz \\
         https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz
    shasum -a 256 mt-metrics-eval-v2.tgz > mt-metrics-eval-v2.sha256
    tar xzf mt-metrics-eval-v2.tgz
    python3 arena/scripts/import_wmt_metaeval.py

Stdlib-only except the optional computed-chrF++ lane (sacrebleu, already a
harness core dependency).
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import math
import re
import sqlite3
import sys
from collections import OrderedDict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

DATA_URL = "https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz"
CODE_REPO = "https://github.com/google-research/mt-metrics-eval"
CODE_COMMIT = "68a481aea1a787392d55af8f76ac8ef40c5f4664"
MQM_REPO = "https://github.com/google/wmt-mqm-human-evaluation"
MQM_COMMIT = "7fadea281aff8db61cc72fc3d469a4dca78b82a6"

# Human-score lanes we meta-evaluate against, best first. Everything else in
# human-scores/ (per-rater mqm-rater*/esa-human*, mqm-col*, psqm, *.rating span
# files, domain/doc levels) is deliberately out of scope for the correlations.
HUMAN_PREFERENCE = [
    "mqm",            # expert error annotations (Freitag et al.) — gold lane
    "esa-merged",     # WMT25 merged Error Span Annotation
    "esa",            # WMT24 Error Span Annotation
    "da-sqm",         # WMT23 DA+SQM
    "wmt-z",          # z-normalized Direct Assessment
    "wmt-appraise-z", # z-normalized DA collected with Appraise
    "wmt-appraise",   # raw DA (Appraise)
    "wmt",            # raw DA/DA+SQM
    "wmt-raw",        # raw DA (legacy naming)
]

# canonical registry id -> ordered upstream score-name candidates. First name
# with a score file wins for that (testset, pair); the verbatim upstream name
# is recorded on the cell. Names verified against the wmt19–wmt25 archive.
METRIC_CANDIDATES: dict[str, list[str]] = {
    # sentBLEU is the organizers' sentence-BLEU baseline — the only BLEU-family
    # stream at seg level in wmt19-21 (and the only one at all in wmt21.flores);
    # the verbatim name on the cell keeps the two distinguishable.
    "bleu": ["BLEU", "sentBLEU"],
    "spbleu": ["f200spBLEU", "spBLEU"],
    "chrf_plain": ["chrF"],
    # Bundled upstream for wmt20 only; other testsets get the computed lane.
    "chrf_plus_plus": ["chrF++"],
    "comet_score": ["COMET-22", "COMET22", "COMET-DA_2021", "COMET-DA_2020", "COMET"],
    "metricx_score": [
        "MetricX-24-Hybrid", "MetricX-24", "MetricX-23",
        "MetricX-25-Ref", "MetricX-25", "metricx_xxl_MQM_2020",
    ],
}

# Reference stream preference when a metric was scored against several.
REF_PREFERENCE = ["refA", "ref", "refB", "refb", "refC", "refc", "all"]

# WMT pair codes that need an explicit iso639-3 pick (macro-languages / codes
# absent from the bcp47 primary-subtag index of the language-card corpus).
LANG_OVERRIDES = {"zh": "cmn", "ar": "arb"}

LEVELS = ("sys", "seg")

ROUND = 4


# ---------------------------------------------------------------------------
# Correlation statistics (pure stdlib; tau-b is the scipy-equivalent
# merge-sort formulation, cross-checked against a brute-force reference in
# arena/tests/test_wmt_metaeval.py)
# ---------------------------------------------------------------------------

def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    den = math.sqrt(sum((a - mx) ** 2 for a in xs) * sum((b - my) ** 2 for b in ys))
    if den == 0:
        return None
    return num / den


def _average_ranks(vals: list[float]) -> list[float]:
    order = sorted(range(len(vals)), key=lambda i: vals[i])
    ranks = [0.0] * len(vals)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and vals[order[j + 1]] == vals[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def spearman(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 3:
        return None
    return pearson(_average_ranks(xs), _average_ranks(ys))


def _count_inversions(seq: list[float]) -> int:
    """Strict inversions (i<j with seq[i] > seq[j]) via merge sort."""
    if len(seq) < 2:
        return 0
    mid = len(seq) // 2
    left, right = seq[:mid], seq[mid:]
    inv = _count_inversions(left) + _count_inversions(right)
    merged = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            inv += len(left) - i
            j += 1
    merged.extend(left[i:])
    merged.extend(right[j:])
    seq[:] = merged
    return inv


def _tie_pair_count(sorted_vals: list) -> int:
    total = 0
    i = 0
    while i < len(sorted_vals):
        j = i
        while j + 1 < len(sorted_vals) and sorted_vals[j + 1] == sorted_vals[i]:
            j += 1
        t = j - i + 1
        total += t * (t - 1) // 2
        i = j + 1
    return total


def kendall_tau_b(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    order = sorted(range(n), key=lambda i: (xs[i], ys[i]))
    x = [xs[i] for i in order]
    y = [ys[i] for i in order]
    tot = n * (n - 1) // 2
    xtie = _tie_pair_count(x)
    ytie = _tie_pair_count(sorted(y))
    xytie = _tie_pair_count(list(zip(x, y)))
    dis = _count_inversions(list(y))
    denom = math.sqrt((tot - xtie) * (tot - ytie))
    if denom == 0:
        return None
    con_minus_dis = tot - xtie - ytie + xytie - 2 * dis
    return con_minus_dis / denom


def pairwise_accuracy(humans: list[float], metrics: list[float]) -> float | None:
    """Kocmi-style system-ranking accuracy: over system pairs the humans order
    STRICTLY, the share where the metric agrees (a metric tie counts as a
    disagreement — it fails to reproduce the human ordering)."""
    correct = total = 0
    for i in range(len(humans)):
        for j in range(i + 1, len(humans)):
            hd = humans[i] - humans[j]
            if hd == 0:
                continue
            total += 1
            md = metrics[i] - metrics[j]
            if md != 0 and (md > 0) == (hd > 0):
                correct += 1
    if total == 0:
        return None
    return correct / total


# ---------------------------------------------------------------------------
# Archive parsing (mt-metrics-eval v2 on-disk format)
# ---------------------------------------------------------------------------

def _parse_score_line(line: str, path: Path) -> tuple[str, float | None]:
    """SYSNAME<sep>SCORE. The separator is a tab in most files but a plain
    space in the wmt20 mqm exports; 'None' or an empty field = missing."""
    stripped = line.rstrip("\n")
    name, sep, val = stripped.partition("\t")
    if not sep:
        parts = stripped.rsplit(None, 1)
        if len(parts) != 2:
            raise ValueError(f"{path}: malformed score line {stripped!r}")
        name, val = parts
    val = val.strip()
    if val in ("", "None"):
        return name, None
    try:
        return name, float(val)
    except ValueError:
        raise ValueError(f"{path}: non-numeric score line {stripped!r}") from None


def load_sys_scores(path: Path) -> dict[str, float | None]:
    """One line per system; 'None'/empty = missing."""
    out: dict[str, float | None] = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            name, score = _parse_score_line(line, path)
            out[name] = score
    return out


def load_seg_scores(path: Path) -> dict[str, list[float | None]]:
    """One line per (system, segment), blocks in segment order; 'None'/empty =
    unscored segment."""
    out: dict[str, list[float | None]] = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            name, score = _parse_score_line(line, path)
            out.setdefault(name, []).append(score)
    return out


def normalize_pair(pair: str) -> tuple[str, str, str]:
    """'en-sr_Cyrl_RS' -> ('en', 'sr', 'en-sr'); wmt25 locale suffixes drop."""
    src_raw, _, tgt_raw = pair.partition("-")
    src = src_raw.replace("_", "-").split("-")[0]
    tgt = tgt_raw.replace("_", "-").split("-")[0]
    return src, tgt, f"{src}-{tgt}"


def _card_display(value, prefer_source: str | None = None):
    """Resolve a card field that may carry an attribution envelope to a scalar.

    Uses the ONE Python card adapter's display() (arena/mt_eval_harness/
    language_cards.py): consensus when the sources agree; on genuine
    disagreement the named source's own claim (Glottolog for family, WALS for
    genus — the same authorities the card cites for those fields); None when
    even that source asserts nothing.
    """
    sys.path.insert(0, str(REPO_ROOT / "arena"))
    from mt_eval_harness.language_cards import display  # local import: keeps the
    # stdlib-only paths importable without the harness on sys.path
    v = display(value)
    if v is None and prefer_source:
        v = display(value, prefer_source=prefer_source)
    return v


def load_language_index(cards_dir: Path) -> dict[str, dict]:
    """iso639-3 code AND bcp47 primary subtag -> {code, family, genus},
    from the language-card corpus (the language-fact SSOT).

    Locale cards (identified by their `locale` block, never by code shape) are
    projections of their base language and are excluded; a non-locale card
    whose code carries a suffix only fills gaps its base did not claim.
    LANG_OVERRIDES settles macro-language codes.
    """
    if not cards_dir.is_dir():
        raise FileNotFoundError(
            f"language-cards dir not found: {cards_dir} — the card corpus is "
            "the language-fact SSOT; there is no fallback store.")
    index: dict[str, dict] = {}
    base_rows: list[tuple[str, str | None, dict]] = []
    variant_rows: list[tuple[str, str | None, dict]] = []

    for f in sorted(cards_dir.glob("*.json")):
        if f.name == "language-tree.json":
            continue
        try:
            card = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(card, dict) or isinstance(card.get("locale"), dict):
            continue  # locale card: a projection, not a language
        code = card.get("code") or f.stem
        cls = card.get("classification") or {}
        family = _card_display(cls.get("family"), prefer_source="glottolog")
        genus = _card_display(cls.get("genus"), prefer_source="wals")
        bcp47 = _card_display(card.get("bcp47")) \
            or _card_display(card.get("bcp47Tag"))
        entry = {"iso639_3": code.split("-")[0] if "-" in code else code,
                 "family": family if isinstance(family, str) else None,
                 "genus": genus if isinstance(genus, str) else None}
        (variant_rows if "-" in code else base_rows).append((code, bcp47, entry))

    # Pass 1: base cards keyed by code and bcp47 primary subtag.
    for code, bcp47, entry in base_rows:
        index.setdefault(code, entry)
        prim = (bcp47 or "").replace("_", "-").split("-")[0]
        if prim:
            index.setdefault(prim, entry)
    # Pass 2: suffixed non-locale cards fill remaining gaps only.
    for code, bcp47, entry in variant_rows:
        prim = (bcp47 or "").replace("_", "-").split("-")[0]
        for key in (code.split("-")[0], prim):
            if key:
                index.setdefault(key, entry)
    for wmt_code, iso3 in LANG_OVERRIDES.items():
        if iso3 in index:
            index[wmt_code] = index[iso3]
    return index


def diff_against_legacy_index(index: dict[str, dict], legacy_db: Path) -> None:
    """Absence-set comparison against an old languages-table DB (diagnostic).

    Prints which keys the legacy `languages` table could resolve that the card
    corpus cannot, and vice versa. Never affects the artifact.
    """
    con = sqlite3.connect(legacy_db)
    rows = con.execute("SELECT code, bcp47 FROM languages").fetchall()
    con.close()
    legacy_keys: set[str] = set()
    for code, bcp47 in rows:
        legacy_keys.add(code.split("-")[0] if "-" in code else code)
        prim = (bcp47 or "").replace("_", "-").split("-")[0]
        if prim:
            legacy_keys.add(prim)
    card_keys = set(index)
    only_legacy = sorted(legacy_keys - card_keys)
    only_cards = sorted(card_keys - legacy_keys)
    print(f"  legacy-vs-cards resolution diff: {len(only_legacy)} keys only in "
          f"the legacy table, {len(only_cards)} only in the card corpus")
    if only_legacy:
        print(f"    only-legacy: {', '.join(only_legacy[:40])}"
              + (" …" if len(only_legacy) > 40 else ""))
    if only_cards:
        print(f"    only-cards: {', '.join(only_cards[:40])}"
              + (" …" if len(only_cards) > 40 else ""))


def reference_names(testset_dir: Path, pair: str) -> list[str]:
    refs = []
    for f in sorted((testset_dir / "references").glob(f"{pair}.*.txt")):
        refs.append(f.name[len(pair) + 1:-len(".txt")])
    return refs


def is_human_system(name: str, ref_names: set[str]) -> bool:
    """References / human translations score as 'systems' upstream; correlating
    a metric with its own reference is meaningless, so they are excluded."""
    return name in ref_names or name.lower().startswith(("ref", "human", "synthetic"))


def discover_human_files(testset_dir: Path) -> dict[tuple[str, str, str], Path]:
    """(pair, human_name, level) -> path, allowlisted names + levels only."""
    out: dict[tuple[str, str, str], Path] = {}
    hdir = testset_dir / "human-scores"
    if not hdir.is_dir():
        return out
    for f in sorted(hdir.glob("*.score")):
        m = re.fullmatch(r"([^.]+)\.(.+)\.(sys|seg)\.score", f.name)
        if not m:
            continue
        pair, name, level = m.groups()
        if name in HUMAN_PREFERENCE and "-" in pair:
            out[(pair, name, level)] = f
    return out


def find_metric_file(testset_dir: Path, pair: str, upstream_name: str,
                     level: str) -> tuple[Path, str] | None:
    base = testset_dir / "metric-scores" / pair
    for ref in REF_PREFERENCE:
        cand = base / f"{upstream_name}-{ref}.{level}.score"
        if cand.exists():
            return cand, ref
    return None


# ---------------------------------------------------------------------------
# Computed chrF++ lane (sacrebleu, word_order=2) — clearly flagged per cell
# ---------------------------------------------------------------------------

class ChrfPPComputer:
    """Computes chrF++ from cached system outputs + the preferred reference.

    Lazy per (testset, pair): loads the reference once, scores only the
    systems the correlation actually needs. sacrebleu is imported on first
    use so the stdlib-only paths never require it.
    """

    def __init__(self):
        self._chrf = None
        self._cache: dict[tuple[str, str], dict] = {}

    def _metric(self):
        if self._chrf is None:
            from sacrebleu.metrics import CHRF
            self._chrf = CHRF(word_order=2)
        return self._chrf

    def scores(self, testset_dir: Path, pair: str, systems: list[str],
               level: str) -> tuple[dict, str] | None:
        key = (str(testset_dir), pair)
        state = self._cache.get(key)
        if state is None:
            ref_name = next(
                (r for r in REF_PREFERENCE if r in reference_names(testset_dir, pair)),
                None,
            )
            if ref_name is None:
                self._cache[key] = state = {"ref": None}
            else:
                ref_lines = (testset_dir / "references" / f"{pair}.{ref_name}.txt") \
                    .read_text(encoding="utf-8").splitlines()
                self._cache[key] = state = {
                    "ref": ref_name, "ref_lines": ref_lines, "sys": {}, "seg": {},
                }
        if state["ref"] is None:
            return None
        chrf = self._metric()
        ref_lines = state["ref_lines"]
        out: dict[str, object] = {}
        for system in systems:
            if system not in state[level]:
                hyp_path = testset_dir / "system-outputs" / pair / f"{system}.txt"
                if not hyp_path.exists():
                    state["sys"][system] = state["seg"][system] = None
                else:
                    hyp_lines = hyp_path.read_text(encoding="utf-8").splitlines()
                    if len(hyp_lines) != len(ref_lines):
                        state["sys"][system] = state["seg"][system] = None
                    else:
                        state["sys"].setdefault(
                            system, chrf.corpus_score(hyp_lines, [ref_lines]).score)
                        if level == "seg":
                            state["seg"][system] = [
                                chrf.sentence_score(h, [r]).score
                                for h, r in zip(hyp_lines, ref_lines)
                            ]
            val = state[level].get(system)
            if val is not None:
                out[system] = val
        return (out, state["ref"]) if out else None


# ---------------------------------------------------------------------------
# Cell construction
# ---------------------------------------------------------------------------

def _sys_cell_stats(human: dict, metric: dict, exclude) -> dict | None:
    systems = sorted(
        s for s, v in human.items()
        if v is not None and metric.get(s) is not None and not exclude(s)
    )
    if len(systems) < 3:
        return None
    hs = [human[s] for s in systems]
    ms = [metric[s] for s in systems]
    p, sp, kt = pearson(hs, ms), spearman(hs, ms), kendall_tau_b(hs, ms)
    if p is None and sp is None and kt is None:
        return None
    acc = pairwise_accuracy(hs, ms)
    return {
        "n_sys": len(systems),
        "pearson": None if p is None else round(p, ROUND),
        "spearman": None if sp is None else round(sp, ROUND),
        "kendall_tau_b": None if kt is None else round(kt, ROUND),
        "pairwise_accuracy": None if acc is None else round(acc, ROUND),
    }


def _seg_cell_stats(human: dict, metric: dict, exclude) -> dict | None:
    hs: list[float] = []
    ms: list[float] = []
    n_sys = 0
    for system in sorted(human):
        if exclude(system) or system not in metric:
            continue
        hvals, mvals = human[system], metric[system]
        if len(hvals) != len(mvals):
            return None  # ragged segment counts — fail honest at cell level
        pairs = [(h, m) for h, m in zip(hvals, mvals) if h is not None and m is not None]
        if not pairs:
            continue
        n_sys += 1
        hs.extend(h for h, _ in pairs)
        ms.extend(m for _, m in pairs)
    if len(hs) < 10 or n_sys < 2:
        return None
    p, sp, kt = pearson(hs, ms), spearman(hs, ms), kendall_tau_b(hs, ms)
    if p is None and sp is None and kt is None:
        return None
    return {
        "n_sys": n_sys,
        "n_points": len(hs),
        "pearson": None if p is None else round(p, ROUND),
        "spearman": None if sp is None else round(sp, ROUND),
        "kendall_tau_b": None if kt is None else round(kt, ROUND),
    }


def build_cells(data_dir: Path, lang_index: dict, testsets: list[str] | None,
                computed_chrfpp: bool, progress=lambda msg: None):
    cells: list[dict] = []
    excluded: list[dict] = []
    languages_used: dict[str, dict] = {}
    chrfpp = ChrfPPComputer() if computed_chrfpp else None

    all_testsets = sorted(d.name for d in data_dir.iterdir() if d.is_dir())
    for testset in all_testsets:
        if testsets and testset not in testsets:
            continue
        testset_dir = data_dir / testset
        human_files = discover_human_files(testset_dir)
        if not human_files:
            excluded.append({
                "testset": testset,
                "reason": "no allowlisted human judgments (e.g. wmt24pp ships "
                          "references/system outputs but no human scores)",
            })
            continue
        pairs = sorted({pair for pair, _n, _l in human_files})
        progress(f"{testset}: {len(pairs)} pairs with human judgments")
        for pair in pairs:
            src, tgt, pair_norm = normalize_pair(pair)
            src_info, tgt_info = lang_index.get(src), lang_index.get(tgt)
            if src_info is None or tgt_info is None:
                excluded.append({
                    "testset": testset, "pair": pair,
                    "reason": f"unresolvable language code "
                              f"({src if src_info is None else tgt}) in the "
                              f"language-card corpus",
                })
                continue
            languages_used.setdefault(src, src_info)
            languages_used.setdefault(tgt, tgt_info)
            refs = set(reference_names(testset_dir, pair))
            exclude = lambda s, _refs=refs: is_human_system(s, _refs)  # noqa: E731

            for level in LEVELS:
                names = [n for n in HUMAN_PREFERENCE if (pair, n, level) in human_files]
                for rank, hname in enumerate(names):
                    hpath = human_files[(pair, hname, level)]
                    human = (load_sys_scores(hpath) if level == "sys"
                             else load_seg_scores(hpath))
                    for metric_id, candidates in METRIC_CANDIDATES.items():
                        found = None
                        for upstream in candidates:
                            hit = find_metric_file(testset_dir, pair, upstream, level)
                            if hit:
                                found = (upstream, hit[0], hit[1], False)
                                break
                        if found is None and metric_id == "chrf_plus_plus" and chrfpp:
                            wanted = sorted(s for s in human if not exclude(s))
                            comp = chrfpp.scores(testset_dir, pair, wanted, level)
                            if comp:
                                mscores, ref_used = comp
                                stats = (_sys_cell_stats(human, mscores, exclude)
                                         if level == "sys"
                                         else _seg_cell_stats(human, mscores, exclude))
                                if stats:
                                    cells.append({
                                        "testset": testset, "pair": pair_norm,
                                        "pair_verbatim": pair, "src": src, "tgt": tgt,
                                        "human": hname, "level": level,
                                        "preferred": rank == 0,
                                        "metric": metric_id,
                                        "upstream_metric": "chrF++ (computed, sacrebleu word_order=2)",
                                        "upstream_ref": ref_used,
                                        "computed": True, **stats,
                                    })
                            continue
                        if found is None:
                            continue
                        upstream, mpath, ref_used, _ = found
                        metric = (load_sys_scores(mpath) if level == "sys"
                                  else load_seg_scores(mpath))
                        stats = (_sys_cell_stats(human, metric, exclude)
                                 if level == "sys"
                                 else _seg_cell_stats(human, metric, exclude))
                        if stats is None:
                            excluded.append({
                                "testset": testset, "pair": pair_norm,
                                "human": hname, "level": level, "metric": metric_id,
                                "reason": "degenerate cell (fewer than 3 aligned "
                                          "systems / 10 aligned segments, zero "
                                          "variance, or ragged segment counts)",
                            })
                            continue
                        cells.append({
                            "testset": testset, "pair": pair_norm,
                            "pair_verbatim": pair, "src": src, "tgt": tgt,
                            "human": hname, "level": level,
                            "preferred": rank == 0,
                            "metric": metric_id, "upstream_metric": upstream,
                            "upstream_ref": ref_used, "computed": False, **stats,
                        })
    return cells, excluded, languages_used


# ---------------------------------------------------------------------------
# Family roll-up (preferred human lane only — no double counting)
# ---------------------------------------------------------------------------

STAT_KEYS = ("pearson", "spearman", "kendall_tau_b", "pairwise_accuracy")


def rollup_families(cells: list[dict], languages: dict[str, dict]) -> dict:
    fam: dict[str, dict] = {}
    for cell in cells:
        if not cell["preferred"]:
            continue
        family = languages[cell["tgt"]]["family"] or "Unclassified"
        level = cell["level"]
        weight = cell.get("n_points", cell["n_sys"])
        bucket = (fam.setdefault(family, {"pairs": set(), "metrics": {}})
                  ["metrics"].setdefault(cell["metric"], {})
                  .setdefault(level, {
                      "n_cells": 0, "weight": 0, "pairs": set(),
                      **{f"_sum_{k}": 0.0 for k in STAT_KEYS},
                      **{f"_w_{k}": 0 for k in STAT_KEYS},
                  }))
        fam[family]["pairs"].add(cell["pair"])
        bucket["n_cells"] += 1
        bucket["weight"] += weight
        bucket["pairs"].add(f"{cell['testset']}:{cell['pair']}")
        for k in STAT_KEYS:
            v = cell.get(k)
            if v is not None:
                bucket[f"_sum_{k}"] += v * weight
                bucket[f"_w_{k}"] += weight

    out: dict[str, dict] = {}
    for family in sorted(fam):
        metrics_out = {}
        for metric_id in sorted(fam[family]["metrics"]):
            levels_out = {}
            for level, b in sorted(fam[family]["metrics"][metric_id].items()):
                entry = {
                    "n_cells": b["n_cells"],
                    "n_pairs": len(b["pairs"]),
                    "weight": b["weight"],
                    "pairs": sorted(b["pairs"]),
                }
                for k in STAT_KEYS:
                    if b[f"_w_{k}"]:
                        entry[f"{k}_weighted_mean"] = round(
                            b[f"_sum_{k}"] / b[f"_w_{k}"], ROUND)
                levels_out[level] = entry
            metrics_out[metric_id] = levels_out
        out[family] = {
            "n_pairs": len(fam[family]["pairs"]),
            "metrics": metrics_out,
        }
    return out


# ---------------------------------------------------------------------------
# Artifact assembly
# ---------------------------------------------------------------------------

def build_artifact(data_dir: Path, cards_dir: Path, pins: dict,
                   computed_chrfpp: bool = True,
                   testsets: list[str] | None = None,
                   retrieved: str | None = None,
                   progress=lambda msg: None) -> dict:
    lang_index = load_language_index(cards_dir)
    cells, excluded, languages = build_cells(
        data_dir, lang_index, testsets, computed_chrfpp, progress)
    families = rollup_families(cells, languages)
    retrieved = retrieved or _dt.date.today().isoformat()

    upstream_names_used: dict[str, list] = {}
    for cell in cells:
        names = upstream_names_used.setdefault(cell["metric"], [])
        if cell["upstream_metric"] not in names:
            names.append(cell["upstream_metric"])

    return OrderedDict([
        ("_comment", (
            "MACHINE-DERIVED metric meta-evaluation index (master plan B3): "
            "correlations between automatic MT metrics and WMT human judgments "
            "(DA/MQM/ESA, wmt19-wmt25), per (test set, language pair, human "
            "lane, level, metric), rolled up per TARGET-language family. All "
            "correlation values are champollion-derived; the underlying human "
            "judgments, metric scores and system outputs belong to the WMT "
            "Metrics shared tasks and are NEVER tracked here — fetch-from-"
            "source per the usage block in arena/scripts/import_wmt_metaeval.py "
            "(which regenerates this file). RELIABILITY evidence, not quality "
            "scores: a cell says how well a metric tracked humans on that "
            "pair, never how good any system is. NOT bundled into the npm "
            "package or the PyPI wheel."
        )),
        ("version", 1),
        ("provider", "wmt-metrics-metaeval"),
        ("sources", [
            OrderedDict([
                ("name", "mt-metrics-eval v2 data (WMT Metrics shared-task archive)"),
                ("repo", CODE_REPO),
                ("commit", CODE_COMMIT),
                ("data_url", DATA_URL),
                ("data_sha256", pins.get("sha256")),
                ("data_etag", pins.get("etag")),
                ("data_last_modified", pins.get("last_modified")),
                ("data_bytes", pins.get("bytes")),
                ("retrieved", retrieved),
                ("license", (
                    "Apache-2.0 (mt-metrics-eval toolkit code). The bundled "
                    "human-judgment + test-set DATA carries no explicit "
                    "upstream license statement — founder review pending; "
                    "non-commercial hold (see license_lane)."
                )),
                ("credit", (
                    "WMT Metrics shared-task organizers and annotators "
                    "(Markus Freitag, Nitika Mathur, Tom Kocmi et al.) and "
                    "the google-research/mt-metrics-eval maintainers. Human "
                    "judgments were produced by the WMT campaigns; all we add "
                    "is correlation arithmetic."
                )),
                ("note", (
                    "The tarball is NOT immutable (no versioned releases): "
                    "data_sha256/data_etag/data_last_modified pin the copy "
                    "these numbers were computed from. The upstream README's "
                    "storage.googleapis.com URL is stale (403); data.statmt.org "
                    "is the live host."
                )),
            ]),
            OrderedDict([
                ("name", "google/wmt-mqm-human-evaluation"),
                ("repo", MQM_REPO),
                ("commit", MQM_COMMIT),
                ("retrieved", retrieved),
                ("license", "Apache-2.0"),
                ("credit", (
                    "Google MQM annotation releases — Freitag et al., "
                    "\"Experts, Errors, and Context\" (TACL 2021) and the "
                    "successive WMT MQM releases."
                )),
                ("note", (
                    "Upstream origin of the MQM expert ratings redistributed "
                    "inside mt-metrics-eval; every cell with human='mqm' "
                    "traces to this project (high-resource pairs only). "
                    "Pinned for provenance + license lineage of the mqm lanes."
                )),
            ]),
        ]),
        ("provenance", (
            "champollion-derived [derived from google-research/mt-metrics-eval "
            "+ google/wmt-mqm-human-evaluation] — every correlation, roll-up "
            "and selection here is computed by Champollion from the pinned "
            "upstream data; no upstream text, judgment or score is redistributed"
        )),
        ("license_lane", OrderedDict([
            ("commercial_ok", False),
            ("note", (
                "The mt-metrics-eval DATA license is not explicitly stated "
                "upstream (the Apache-2.0 grant covers the toolkit code). "
                "Until the founder license review clears it, this artifact "
                "stays out of commercial/prize lanes; the mqm lanes' "
                "underlying annotations are Apache-2.0 via "
                "google/wmt-mqm-human-evaluation."
            )),
        ])),
        ("score_orientation", (
            "All scores are used exactly as distributed by mt-metrics-eval, "
            "which stores every human and metric score as higher-is-better "
            "(MQM and MetricX are stored negated upstream). No sign flipping "
            "is applied; verified empirically (MetricX-23 vs COMET sys-level "
            "Pearson +0.97 on wmt23 en-de)."
        )),
        ("correlation_definitions", OrderedDict([
            ("sys", (
                "Per-system scores, aligned on systems that have both a human "
                "and a metric score, references/human translations excluded "
                "(names matching the pair's reference set or prefixed "
                "ref/human/synthetic). pearson/spearman/kendall_tau_b are the "
                "standard coefficients; pairwise_accuracy is Kocmi-style "
                "system-ranking accuracy (share of strictly-human-ordered "
                "system pairs the metric orders identically; metric ties "
                "count as disagreement). Cells need >= 3 aligned systems."
            )),
            ("seg", (
                "Flattened (system, segment) vector: every segment with both "
                "a human and a metric segment score, all systems pooled, no "
                "grouping (mt-metrics-eval 'none' averaging). Cells need >= "
                "10 aligned points across >= 2 systems. kendall_tau_b is the "
                "tie-adjusted tau-b on the flattened vector."
            )),
        ])),
        ("human_lanes", OrderedDict([
            ("preference", HUMAN_PREFERENCE),
            ("note", (
                "Per (testset, pair, level) every available allowlisted human "
                "lane gets cells; exactly the best-available lane is flagged "
                "preferred=true, and ONLY preferred cells enter the family "
                "roll-up (no double counting). Per-rater files, span-level "
                "*.rating files and doc/domain levels are out of scope."
            )),
        ])),
        ("metrics", OrderedDict(
            (metric_id, OrderedDict([
                ("registry_id", metric_id),
                ("upstream_candidates", METRIC_CANDIDATES[metric_id]),
                ("upstream_names_used", upstream_names_used.get(metric_id, [])),
                ("note", (
                    "Computed lane: chrF++ is only bundled upstream for wmt20; "
                    "cells with computed=true were scored by Champollion with "
                    "sacrebleu CHRF(word_order=2) against the recorded "
                    "reference stream."
                ) if metric_id == "chrf_plus_plus" else (
                    "Scores verbatim from the WMT metric submissions/baselines "
                    "named in upstream_names_used (version-pin doctrine: the "
                    "exact upstream name is on every cell)."
                )),
            ]))
            for metric_id in METRIC_CANDIDATES
        )),
        ("languages", OrderedDict(
            (code, languages[code]) for code in sorted(languages)
        )),
        ("family_rollup_note", (
            "families is keyed by the TARGET language's family "
            "(language-card `classification.family`, Glottolog's claim on "
            "disagreement) — metric reliability "
            "is about scoring output in the target language. Means are "
            "weighted by n_sys (sys level) / n_points (seg level). Beware: "
            "all xx->en pairs land in Indo-European; per-pair cells carry "
            "src/tgt for finer slicing (genus is in languages)."
        )),
        ("families", families),
        ("cells", cells),
        ("excluded", excluded),
        ("counts", OrderedDict([
            ("cells", len(cells)),
            ("preferred_cells", sum(1 for c in cells if c["preferred"])),
            ("testsets", len({c["testset"] for c in cells})),
            ("pairs", len({c["pair"] for c in cells})),
            ("families", len(families)),
            ("excluded", len(excluded)),
        ])),
    ])


# ---------------------------------------------------------------------------
# Pin discovery (ETag/Last-Modified from curl -D dump; sha256 from sidecar)
# ---------------------------------------------------------------------------

def read_pins(tgz_path: Path) -> dict:
    pins: dict = {"sha256": None, "etag": None, "last_modified": None, "bytes": None}
    headers = tgz_path.with_suffix(".headers")
    if headers.exists():
        for line in headers.read_text(encoding="utf-8").splitlines():
            key, _, val = line.partition(":")
            key, val = key.strip().lower(), val.strip()
            if key == "etag":
                pins["etag"] = val.strip('"')
            elif key == "last-modified":
                pins["last_modified"] = val
            elif key == "content-length":
                pins["bytes"] = int(val)
    sidecar = tgz_path.with_suffix(".sha256")
    if sidecar.exists():
        pins["sha256"] = sidecar.read_text(encoding="utf-8").split()[0]
    if pins["bytes"] is None and tgz_path.exists():
        pins["bytes"] = tgz_path.stat().st_size
    return pins


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    cache_default = Path.home() / ".mt-eval" / "mt-metrics-eval"
    ap.add_argument("--data-dir", default=str(cache_default / "mt-metrics-eval-v2"),
                    help="extracted mt-metrics-eval-v2 directory (never the repo)")
    ap.add_argument("--tgz", default=str(cache_default / "mt-metrics-eval-v2.tgz"),
                    help="downloaded tarball; .headers/.sha256 sidecars supply pins")
    ap.add_argument("--cards-dir",
                    default=str(REPO_ROOT / "cli" / "shared" / "language-cards"),
                    help="language-card corpus for language->family resolution")
    ap.add_argument("--legacy-db", default=None,
                    help="optional legacy languages-table sqlite DB: print a "
                         "resolution diff against the card corpus (diagnostic "
                         "only; never affects the artifact)")
    ap.add_argument("--out", default=str(REPO_ROOT / "shared" / "catalogue" /
                                         "metric-reliability.json"))
    ap.add_argument("--testsets", nargs="*", default=None,
                    help="restrict to these testset dirs (dev runs)")
    ap.add_argument("--no-computed-chrfpp", action="store_true",
                    help="skip the sacrebleu-computed chrF++ lane")
    ap.add_argument("--sha256", default=None, help="override the sha256 pin")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.is_dir():
        print(f"✗ data dir not found: {data_dir}\n  Fetch per the usage block in "
              f"this script's docstring (content is never tracked in git).",
              file=sys.stderr)
        return 1
    pins = read_pins(Path(args.tgz))
    if args.sha256:
        pins["sha256"] = args.sha256
    if not pins["sha256"]:
        print("✗ no sha256 pin (sidecar .sha256 missing and --sha256 not given). "
              "The tarball is not immutable — refusing to emit an unpinned "
              "artifact.", file=sys.stderr)
        return 1

    if args.legacy_db:
        diff_against_legacy_index(
            load_language_index(Path(args.cards_dir)), Path(args.legacy_db))

    artifact = build_artifact(
        data_dir, Path(args.cards_dir), pins,
        computed_chrfpp=not args.no_computed_chrfpp,
        testsets=args.testsets,
        progress=lambda msg: print(f"  {msg}"),
    )
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(artifact, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8")
    c = artifact["counts"]
    print(f"✅ {out_path} — {c['cells']} cells ({c['preferred_cells']} preferred), "
          f"{c['pairs']} pairs, {c['families']} target families, "
          f"{c['excluded']} exclusions, "
          f"{out_path.stat().st_size / 1e6:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
