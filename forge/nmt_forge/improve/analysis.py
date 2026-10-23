"""Where a model goes wrong on the dev set — by kind of sentence, never by sentence.

The improve loop's diagnosis (journey plan, Phase 2 step 2). It reads, on this
computer, the dev sentences, their references and the run's saved dev
translations (``dev-outputs.jsonl``), and the training files' words. What it
returns is counts, scores and FIXED names (``kinds.KIND_NAMES``): safe to tell
a hosted agent. The test set is never read here — a round is steered on dev,
and the test set is kept for milestones.

Scores are the harness's chrF++ on each subset (forge implements no metric).
A kind with fewer than ``MIN_KIND`` dev sentences is listed as too few to
say: a gap on four sentences is noise, and the rails never steer on noise.
"""

from __future__ import annotations

import math

import re
from pathlib import Path

from .. import _harness
from ..guards.dev_fence import DevFence
from ..registry import load_rows
from ..training.config import RunConfig
from ..training.run import read_dev_outputs
from ..workspace import Workspace
from .compare import RoundError, _manifest
from .kinds import KIND_NAMES, kinds_of, words

IMPROVE_ANALYZE = "improve-analyze"
MIN_KIND = 5
ENGLISH = {"eng", "en"}
_TOKEN = re.compile(r"\w+", re.UNICODE)


def tokens(text: str) -> list[str]:
    """Word tokens of any language: lowercased runs of letters and digits."""
    return _TOKEN.findall(str(text).lower())


def english_side(source: str, target: str) -> str | None:
    """Which side of the pair is English: "source", "target" or None."""
    base = lambda c: str(c or "").lower().split("-")[0]  # noqa: E731
    if base(source) in ENGLISH:
        return "source"
    if base(target) in ENGLISH:
        return "target"
    return None


def project_pair(ws: Workspace) -> tuple[str, str]:
    from ..floor import _project_pair
    return _project_pair(ws)


def _resolve(ws: Workspace, f: str) -> Path:
    q = Path(f)
    if q.is_absolute() or q.exists():
        return q
    return Path(ws.root).parent / q


def training_text(ws: Workspace, cfg: RunConfig, shas: dict | None = None
                  ) -> tuple[list[str], list[str], list[str]]:
    """(sources, targets, notes) of every file the run trained on, as the
    files are now — with a note for each file that changed since the run
    (``shas``: the run identity's {file: sha256})."""
    from ..advisor import config_training_files
    from ..registry import sha256_file

    shas = shas or {}
    srcs, tgts, notes = [], [], []
    for f in config_training_files(cfg):
        p = _resolve(ws, f)
        if not p.is_file():
            notes.append(f"{f}: no longer on this computer — its words are not counted")
            continue
        if shas.get(str(f)) and shas[str(f)] != sha256_file(p):
            notes.append(f"{f}: changed since the run — its words are read as the file is now")
        for r in load_rows(p):
            srcs.append(str(r.get("source", "")))
            tgts.append(str(r.get("target", "")))
    return srcs, tgts, notes


def _chrf(sig, hyps: list[str], refs: list[str]) -> float:
    return round(sig.corpus_chrf([{"predicted": h, "expected": r} for h, r in zip(hyps, refs)]), 1)


def _gap_interval(per: list[float], idx: list[int]) -> list[float] | None:
    """95% interval (Welch) on how far a kind's sentences score below the
    rest, from sentence-level chrF++ — the interval a "weakest kind" must
    clear: a positive gap on a handful of sentences is noise, and the wishlist
    never steers on noise (FORGE_MACHINE_CRITIQUE finding 10)."""
    inside = set(idx)
    a = [per[i] for i in idx]
    b = [per[i] for i in range(len(per)) if i not in inside]
    if len(a) < 2 or len(b) < 2:
        return None
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    va = sum((x - ma) ** 2 for x in a) / (len(a) - 1)
    vb = sum((x - mb) ** 2 for x in b) / (len(b) - 1)
    se = math.sqrt(va / len(a) + vb / len(b))
    d = mb - ma
    return [round(d - 1.96 * se, 1), round(d + 1.96 * se, 1)]


def analyze(ws: Workspace, run_manifest: str | Path, *, ledger: bool = True) -> dict:
    """The diagnosis of one run on its dev set. Content-free; see the module."""
    m = _manifest(run_manifest)
    cfg = RunConfig.from_dict(m["config"])
    dev = (m.get("dev_set") or {})
    head, hyps = read_dev_outputs(Path(m["manifest_path"]).parent)
    if not hyps:
        raise RoundError(
            f"{m['run_name']} kept no dev translations",
            why="the diagnosis compares what the model wrote on the dev set with the references; "
                "runs trained before 2026-10 did not keep it",
            fix="train the next round with this forge — every run now keeps its dev translations")
    rows = DevFence(ws).require_dev(dev["name"])
    entry = ws.registry.get(dev["name"])
    if head.get("dev_sha256") != entry.get("sha256") or len(rows) != len(hyps):
        raise RoundError("the run's dev translations do not line up with the dev set as it is now",
                         why="the dev set changed after the run (practice sentences grow it between rounds)",
                         fix="diagnose the newest run — it was tuned on the dev set as it is now")
    sources = [str(r.get(entry["source_field"], "")) for r in rows]
    refs = [str(r.get(entry["target_field"], "")) for r in rows]
    source, target = project_pair(ws)
    side = english_side(source, target)
    train_src, _train_tgt, notes = training_text(
        ws, cfg, (m.get("run_identity") or {}).get("training_files"))
    known = {t for s in train_src for t in tokens(s)}

    sig = _harness.significance()
    n = len(rows)
    overall = _chrf(sig, hyps, refs)
    from sacrebleu.metrics import CHRF

    sentence = CHRF(word_order=2)
    per = [sentence.sentence_score(h, [r]).score for h, r in zip(hyps, refs)]
    english = sources if side == "source" else refs if side == "target" else None
    tagged = [kinds_of(e) for e in english] if english else [set() for _ in rows]
    kinds = {}
    for k in (KIND_NAMES if english else ()):
        idx = [i for i, t in enumerate(tagged) if k in t]
        if len(idx) < MIN_KIND:
            kinds[k] = {"n": len(idx), "chrf": None, "gap": None, "too_few": True}
            continue
        s = _chrf(sig, [hyps[i] for i in idx], [refs[i] for i in idx])
        ci = _gap_interval(per, idx)
        kinds[k] = {"n": len(idx), "chrf": s, "gap": round(overall - s, 1), "gap_ci": ci,
                    "clear": bool(ci and ci[0] > 0)}
    unseen_rows = [i for i, s in enumerate(sources) if any(t not in known for t in tokens(s))]
    seen_rows = [i for i in range(n) if i not in set(unseen_rows)]
    unseen = {
        "rows": len(unseen_rows), "share": round(len(unseen_rows) / n, 3) if n else 0.0,
        "chrf_with": _chrf(sig, [hyps[i] for i in unseen_rows], [refs[i] for i in unseen_rows])
        if len(unseen_rows) >= MIN_KIND else None,
        "chrf_without": _chrf(sig, [hyps[i] for i in seen_rows], [refs[i] for i in seen_rows])
        if len(seen_rows) >= MIN_KIND else None,
    }
    ref_chars = sum(len(r) for r in refs) or 1
    outputs = {
        "distinct": round(len(set(hyps)) / n, 3) if n else 0.0,
        "copied": round(sum(h.strip() == s.strip() for h, s in zip(hyps, sources)) / n, 3) if n else 0.0,
        "empty": round(sum(not h.strip() for h in hyps) / n, 3) if n else 0.0,
        "length_ratio": round(sum(len(h) for h in hyps) / ref_chars, 2),
    }
    # only a kind CLEARLY below the rest (its interval above zero) steers the wishlist
    weakest = sorted((k for k, v in kinds.items() if v.get("clear") and v["gap"] > 0),
                     key=lambda k: -kinds[k]["gap"])[:3]
    unclear = sorted((k for k, v in kinds.items() if v.get("gap") and v["gap"] > 0 and not v.get("clear")),
                     key=lambda k: -kinds[k]["gap"])
    report = {
        "run": m["run_name"], "manifest": m["manifest_path"], "dev_set": dev["name"], "n": n,
        "chrf": overall, "english_side": side, "kinds": kinds, "weakest": weakest, "unclear": unclear,
        "unseen": unseen, "outputs": outputs, "training_rows": len(train_src),
        "notes": notes,
    }
    report["text"] = analysis_text(report)
    if ledger:
        ws.ledger.append(IMPROVE_ANALYZE, **{k: v for k, v in report.items() if k != "text"})
    return report


def analysis_text(r: dict) -> list[str]:
    """The diagnosis in plain lines — numbers and kind names only."""
    out = [f"On the {r['n']} dev sentences, {r['run']} scores chrF++ {r['chrf']:.1f}."]
    u = r["unseen"]
    if u["rows"]:
        line = (f"{u['rows']} of them ({u['share']:.0%}) have a word it never saw in training")
        if u["chrf_with"] is not None and u["chrf_without"] is not None:
            line += f": chrF++ {u['chrf_with']:.1f} on those, {u['chrf_without']:.1f} on the rest"
        out.append(line + ".")
    if r["weakest"]:
        parts = [f"{KIND_NAMES[k]} ({r['kinds'][k]['chrf']:.1f} on {r['kinds'][k]['n']})"
                 for k in r["weakest"]]
        out.append("It does worst on " + "; ".join(parts) + ".")
    elif r["english_side"] is None:
        out.append("Neither side is English, so kinds of sentence are not told apart.")
    elif r.get("unclear"):
        k = r["unclear"][0]
        v = r["kinds"][k]
        out.append(f"No kind of sentence scores clearly below the rest: {KIND_NAMES[k]} is {v['gap']:.1f} points "
                   f"lower, but on {v['n']} dev sentences that could be chance — the wishlist does not steer by it.")
    else:
        out.append("No kind of sentence (with at least 5 dev sentences) scores below the whole.")
    o = r["outputs"]
    if o["distinct"] < 0.9:
        out.append(f"Only {o['distinct']:.0%} of its dev translations differ from each other — "
                   "it repeats itself; more sentences, or a different model, are what that needs.")
    if o["copied"] >= 0.05:
        out.append(f"It copies the input unchanged {o['copied']:.0%} of the time.")
    out.extend(r.get("notes") or [])
    return out
