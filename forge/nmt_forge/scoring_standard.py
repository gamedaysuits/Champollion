"""The scoring standard ("standard/1"), as forge shows it — never recomputed.

Founder, 2026-10-04: "we want scoring to be industry standard". The harness
(``mt_eval_harness.scoring``) owns the standard; forge implements zero metric
math, so it owns none of it either. This module only RENDERS what the
harness defines:

- the headline and ranking metric is corpus-level chrF++ (sacreBLEU chrF,
  word_order=2), 0–100, with its 95% bootstrap CI — written the way every
  surface writes it, ``chrF++ 47.5 [45.9, 49.0]``
  (``scoring.format_primary``), and, wherever a full record is written
  (forge-model.json, the export summary, DEPLOY.md), with its sacreBLEU
  signature;
- the other standard metrics (BLEU, spBLEU, TER, COMET) are shown BESIDE it,
  never blended into it;
- everything else forge's battery can score (exact match, COMET-QE,
  MetricX, referee plugin lanes) is a DIAGNOSTIC: shown separately and
  labelled as one, never a headline;
- the weighted composite and the quality-tier labels are retired: no forge
  surface prints either (``scoring.RETIRED_NOTE``).

Where the export's mt-eval TestReport exists, ITS corpus chrF++ (overall
``corpus_chrf``, CI ``confidence_intervals.corpus_chrf``, signature
``sacrebleu_signatures.chrf``) is the headline — the number a run card would
publish. Without one (an export written before this standard, or a battery
read with no TestReport), the headline is forge's battery chrF++ of a
single-group read, which the harness computed on the same rows.
"""

from __future__ import annotations

import importlib
import json
from pathlib import Path

from . import _harness

#: forge's battery key for chrF++ (``guards.ci_scoring.DEFAULT_METRICS``).
BATTERY_PRIMARY = "chrf++"

#: forge battery lanes that are the standard's SECONDARY metrics → the key
#: ``scoring.format_secondary`` takes.
BATTERY_SECONDARY = {"bleu": "corpus_bleu", "spbleu": "spbleu",
                     "ter": "ter", "comet": "comet_score"}

#: How forge names its battery lanes in prose (the key stays in JSON).
LABELS = {"chrf++": "chrF++", "bleu": "BLEU", "spbleu": "spBLEU",
          "ter": "TER", "comet": "COMET", "exact_match": "exact match",
          "comet-qe": "COMET-QE (reference-free)", "metricx": "MetricX"}

#: Said beside a headline to name what it is.
HEADLINE_NOTE = ("corpus chrF++, 95% bootstrap CI — the headline and "
                 "ranking metric (scoring standard/1)")


def scoring():
    """The harness's scoring module (the standard's single code authority)."""
    _harness.load_harness()
    return importlib.import_module("mt_eval_harness.scoring")


def label(metric: str) -> str:
    """A battery lane's display name: ``chrf++`` → ``chrF++``."""
    return LABELS.get(str(metric), str(metric))


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) \
        else None


def _record(score, lo, hi, signature, secondary: dict, source: str) -> dict:
    sc = scoring()
    secondary = {k: v for k, v in secondary.items() if _num(v) is not None}
    return {"scoring_standard": sc.SCORING_STANDARD,
            "metric": sc.PRIMARY_METRIC,
            "label": sc.PRIMARY_METRIC_LABEL,
            "score": _num(score), "ci_lower": _num(lo), "ci_upper": _num(hi),
            "ci_level": 0.95 if _num(lo) is not None else None,
            "signature": signature,
            "text": sc.format_primary(_num(score), _num(lo), _num(hi)),
            "secondary": secondary,
            "secondary_text": sc.format_secondary(secondary),
            "from": source}


def from_test_report(report: dict | None) -> dict | None:
    """The headline of an mt-eval TestReport: its corpus chrF++ with the
    CI and signature the harness computed, the secondary standard metrics
    beside it. None when the report has no ``overall`` block."""
    overall = (report or {}).get("overall") if isinstance(report, dict) \
        else None
    if not isinstance(overall, dict):
        return None
    sc = scoring()
    ci = (overall.get("confidence_intervals") or {}).get(
        sc.PRIMARY_CI_KEY) or {}
    return _record(
        overall.get("corpus_chrf"), ci.get("ci_lower"), ci.get("ci_upper"),
        sc.primary_signature(overall.get("sacrebleu_signatures")),
        {"corpus_bleu": overall.get("corpus_bleu"),
         "spbleu": overall.get("corpus_spbleu"),
         "ter": overall.get("corpus_ter"),
         "comet_score": overall.get("comet_score")},
        "mt-eval TestReport (overall.corpus_chrf)")


def read_test_report(path) -> dict | None:
    """:func:`from_test_report` of a TestReport file (only the overall
    numbers are kept — the file also holds the test set's sentences), or
    None when it cannot be read."""
    try:
        doc = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return None
    return from_test_report(doc)


def from_scores(scores: dict | None, *, source: str = "nmt-forge battery "
                "(chrF++ computed by mt-eval-harness)") -> dict:
    """The headline of a forge battery group's ``scores`` (``chrf++`` with
    its CI; BLEU/COMET beside it). ``score`` is None when the battery did
    not score chrF++ — said as ``chrF++ —``, never replaced by another
    metric."""
    scores = scores or {}

    def lane(key):
        s = scores.get(key)
        return s if isinstance(s, dict) else {}

    p = lane(BATTERY_PRIMARY)
    return _record(p.get("score"), p.get("ci_lower"), p.get("ci_upper"),
                   None,
                   {target: lane(key).get("score")
                    for key, target in BATTERY_SECONDARY.items()},
                   source)


def for_export(fm_path, doc: dict | None) -> dict | None:
    """An export's headline: the one its forge-model.json records
    (``test_report.headline``, exports from scoring standard/1 on), else
    read from the TestReport its ``harness.test_report`` points at (older
    exports), else its single-group battery chrF++. None when the export
    was not scored on a test set."""
    doc = doc or {}
    tr = doc.get("test_report") or {}
    if not tr:
        return None
    if isinstance(tr.get("headline"), dict):
        return dict(tr["headline"])
    rel = (doc.get("harness") or {}).get("test_report")
    if rel and fm_path is not None:
        got = read_test_report(Path(fm_path).parent / rel)
        if got is not None:
            return got
    groups = tr.get("groups") or {}
    if len(groups) == 1:
        return from_scores(next(iter(groups.values())))
    return from_scores({}, source="no mt-eval TestReport and several "
                                  "groups: no corpus chrF++ recorded")


def for_battery_manifest(manifest: dict, manifest_path=None) -> dict | None:
    """A battery manifest's headline: the one it records
    (``harness_report.headline``), else the matching mt-eval TestReport's
    (``harness_caveats.matching_test_report``), else its single-group
    chrF++. None for a multi-group read with no TestReport."""
    rec = manifest.get("harness_report")
    if isinstance(rec, dict) and isinstance(rec.get("headline"), dict):
        return dict(rec["headline"])
    from .harness_caveats import matching_test_report

    path = matching_test_report(manifest, manifest_path)
    if path is not None:
        got = read_test_report(path)
        if got is not None:
            return got
    groups = manifest.get("groups") or {}
    if len(groups) == 1:
        return from_scores((next(iter(groups.values())) or {}).get("scores"))
    return None


def cite(short_score: dict | None) -> str:
    """A compact ``{metric, score, ci}`` (:func:`short`, or an older
    ``{metric, score, ci}`` from a sibling summary) as the standard writes
    it: ``chrF++ 40.9 [38.9, 42.9]``."""
    s = short_score or {}
    if s.get("text"):
        return str(s["text"])
    ci = s.get("ci") or [None, None]
    score = _num(s.get("score"))
    if str(s.get("metric") or "chrf++").lower() in ("chrf++", "chrf_plus_plus"):
        return scoring().format_primary(score, ci[0], ci[1])
    # an older record naming another metric: said as that metric, never
    # relabelled chrF++
    text = f"{label(s.get('metric'))} " + ("—" if score is None
                                             else f"{score:.2f}")
    if score is not None and ci[0] is not None and ci[1] is not None:
        text += f" [{ci[0]:.2f}, {ci[1]:.2f}]"
    return text


def short(headline: dict | None) -> dict | None:
    """``{metric, score, ci}`` — the compact shape status/advice JSON uses
    (``metric`` is ``chrF++``)."""
    if not headline or headline.get("score") is None:
        return None
    lo, hi = headline.get("ci_lower"), headline.get("ci_upper")
    return {"metric": headline.get("label") or "chrF++",
            "score": headline["score"],
            "ci": [lo, hi] if lo is not None and hi is not None else None,
            "text": headline.get("text"),
            "scoring_standard": headline.get("scoring_standard")}


def headline_text(headline: dict | None, *, signature: bool = False) -> str:
    """``chrF++ 47.5 [45.9, 49.0]`` (+ ``· BLEU 21.3 · TER 61.2`` beside it,
    + the signature when asked)."""
    if not headline:
        return scoring().format_primary(None)
    text = headline.get("text") or scoring().format_primary(
        headline.get("score"), headline.get("ci_lower"),
        headline.get("ci_upper"))
    if headline.get("secondary_text"):
        text += f" (beside it: {headline['secondary_text']})"
    if signature and headline.get("signature"):
        text += f"; sacreBLEU signature `{headline['signature']}`"
    return text


def _ci_cell(s: dict, digits: int) -> str:
    lo, hi = _num(s.get("ci_lower")), _num(s.get("ci_upper"))
    out = f"{s['score']:.{digits}f}"
    if lo is not None and hi is not None:
        out += f" [{lo:.{digits}f}, {hi:.{digits}f}]"
    return out


def score_line(scores: dict | None, *, primary: bool = True) -> str:
    """A forge battery ``scores`` dict as the standard says it: chrF++ with
    its 95% CI first (the headline), the secondary standard metrics beside
    it, everything else labelled a diagnostic. Every number keeps its CI.

    ``primary=False``: the rest only — for a line printed under a headline
    that already gives this read's chrF++ ("" when nothing else was
    scored), so one number is never shown twice at two roundings."""
    scores = {m: s for m, s in (scores or {}).items()
              if isinstance(s, dict) and _num(s.get("score")) is not None}
    if not scores:
        return "no scores recorded" if primary else ""
    p = scores.get(BATTERY_PRIMARY)
    head = (scoring().format_primary(p["score"], _num(p.get("ci_lower")),
                                     _num(p.get("ci_upper")))
            + " 95% CI" if p else "chrF++ not computed on this read")
    if not primary:
        head = ""
    beside, diag = [], []
    for m, s in scores.items():
        if m == BATTERY_PRIMARY:
            continue
        lower = " (lower = better)" if s.get("direction") == "lower" else ""
        if m in BATTERY_SECONDARY:
            beside.append(f"{label(m)} "
                          f"{_ci_cell(s, 3 if m == 'comet' else 1)}{lower}")
        else:
            diag.append(f"{label(m)} {_ci_cell(s, 2)}{lower}")
    parts = [head] if head else []
    if beside:
        parts.append(("beside it: " if head else "")
                     + ", ".join(beside))
    if diag:
        parts.append("diagnostics (never a headline): " + ", ".join(diag))
    return "; ".join(parts)
