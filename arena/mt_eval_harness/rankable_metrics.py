"""rankable_metrics — which metrics a contest may rank on, and how each is identified.

A contest's ranking metric is contest CONFIGURATION (``contests.metadata.
primary_metric``), chosen from every metric the registry marks rankable. The
registry is ``shared/metric-registry.json``: an entry with a ``ranking`` block
is rankable; one without it is not. Adding a metric to the rankable set is a
data change there (plus a ``rankable_metrics`` row in the database, migration
076), never a code change here — the one exception is a per-segment corpus
function for the paired tie test, which is code and lives in
``SEGMENT_FUNCTIONS`` below (tests assert the two agree).

Why a bundled copy: a node installs the harness from a tagged wheel, where the
monorepo ``shared/`` directory does not exist (``metric_manifest`` returns
None there). The wheel therefore ships ``mt_eval_harness/data/
metric-registry.json``, and ``tests/test_rankable_metrics.py`` fails if it
drifts from ``shared/metric-registry.json``. A missing or malformed bundled
copy is a hard error: a node that cannot say which metrics are rankable must
not rank.

Signatures. A contest promises not just "chrF" but the exact computation, so
it freezes ``metadata.metric_signature`` at creation. Each rankable metric
declares how its signature is read:

* ``sacrebleu`` — the sacreBLEU signature string (``nrefs|case|eff|nc|nw|
  space|version`` for chrF); the run card records it under
  ``scores.sacrebleu_signatures[key]``.
* ``model`` — the neural model id the run card records under ``scores[key]``,
  joined to the harness version (the model id alone does not pin the code
  that ran it).
* ``harness`` — the harness version alone (exact match, the legacy composite).

Retired metrics. A ``ranking`` block may carry ``retired`` (a reason): the
metric stays in this table — migration 076 seeded a ``rankable_metrics`` row
for it, and a contest that already recorded it as ``metadata.primary_metric``
must keep ranking (and keep passing ``contest_lifecycle_guard()``) — but a NEW
contest may not choose it (:func:`refuse_retired_for_new`). Scoring standard/1
(2026-10-04) retired the weighted composite this way.
"""

from __future__ import annotations

import json
from importlib import resources
from typing import Callable, Optional

from sacrebleu.metrics import BLEU, CHRF, TER

from mt_eval_harness import __version__ as HARNESS_VERSION
from mt_eval_harness.significance import corpus_bleu, corpus_chrf, corpus_chrf_plain

REGISTRY_RESOURCE = "data/metric-registry.json"


class RankableMetricsError(RuntimeError):
    """The bundled metric registry is missing, malformed or inconsistent."""


def load_bundled_registry() -> dict:
    """Parse the metric registry bundled inside the package. Fail loud."""
    try:
        text = (resources.files("mt_eval_harness") / REGISTRY_RESOURCE).read_text(
            encoding="utf-8")
    except (FileNotFoundError, OSError) as exc:
        raise RankableMetricsError(
            f"mt_eval_harness/{REGISTRY_RESOURCE} is missing from this install "
            f"({exc}). It is package data; reinstall the harness from a tagged "
            f"release.") from exc
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RankableMetricsError(
            f"mt_eval_harness/{REGISTRY_RESOURCE} is not valid JSON: {exc}") from exc


# The per-segment corpus functions the paired tie tests call. A metric whose
# registry entry says segment_level=true must appear here, and nothing else may.
SEGMENT_FUNCTIONS: dict[str, Callable[[list[dict]], float]] = {
    "chrf_plus_plus": corpus_chrf,
    "chrf_plain": corpus_chrf_plain,
    "bleu": corpus_bleu,
}


def _build_table(registry: dict) -> dict[str, dict]:
    table: dict[str, dict] = {}
    for metric_id, entry in (registry.get("entries") or {}).items():
        ranking = entry.get("ranking")
        if not ranking:
            continue
        direction = entry.get("direction")
        if direction not in ("higher", "lower"):
            raise RankableMetricsError(
                f"{metric_id}: a rankable metric needs direction higher|lower, "
                f"the registry says {direction!r}")
        segment_level = bool(ranking.get("segment_level"))
        if segment_level != (metric_id in SEGMENT_FUNCTIONS):
            raise RankableMetricsError(
                f"{metric_id}: registry segment_level={segment_level} but a "
                f"segment function is {'missing' if segment_level else 'defined'} "
                f"in rankable_metrics.SEGMENT_FUNCTIONS")
        ci = ranking.get("ci_columns")
        table[metric_id] = {
            # A denormalized column when the database has one; otherwise the
            # card is read through a JSONB alias named after the metric id
            # (run_card->scores-><id>, see run_card_select_aliases()).
            "column": entry.get("db_column") or metric_id,
            "jsonb": entry.get("db_column") is None,
            "label": entry["display_name"],
            "ci_columns": tuple(ci) if ci else None,
            "direction": direction,
            "scale": entry["scale"],
            "rounding": int(ranking["rounding"]),
            "segment_fn": SEGMENT_FUNCTIONS.get(metric_id),
            "signature": dict(ranking["signature"]),
            "verifier_reproducible": bool(entry.get("verifier_reproducible")),
            # Why a NEW contest may not choose this metric, or None. A
            # contest that already recorded it still ranks on it (legacy).
            "retired": ranking.get("retired") or None,
        }
    if not table:
        raise RankableMetricsError("the metric registry marks no metric rankable")
    return table


RANKABLE_METRICS: dict[str, dict] = _build_table(load_bundled_registry())


def retired_reason(metric_id: str) -> Optional[str]:
    """Why ``metric_id`` is retired as a ranking choice for NEW contests,
    or None when a new contest may choose it."""
    spec = RANKABLE_METRICS.get(metric_id)
    return spec.get("retired") if spec else None


def refuse_retired_for_new(metric_id: str) -> None:
    """Raise ValueError when a NEW contest names a retired ranking metric.

    The refusal says why (the registry's ``ranking.retired``) and what to
    choose instead. Existing contests never pass through here: ranking reads
    their recorded ``metadata.primary_metric`` as it was promised."""
    reason = retired_reason(metric_id)
    if not reason:
        return
    from mt_eval_harness.scoring import PRIMARY_METRIC, RETIRED_NOTE
    open_choices = ", ".join(m for m, s in RANKABLE_METRICS.items()
                             if not s.get("retired"))
    raise ValueError(
        f"{metric_id!r} is retired as a contest ranking metric: {reason} "
        f"{RETIRED_NOTE} Choose {PRIMARY_METRIC} (the default) or another "
        f"rankable metric: {open_choices}.")


def run_card_select_aliases() -> list[str]:
    """PostgREST select items for the rankable metrics that have no column.

    Each reads ``run_card->scores-><id>`` under the metric id, so a card dict
    carries every rankable value under ``spec["column"]`` either way. The
    signature material (sacreBLEU signatures, neural model ids) rides along.
    """
    items = [f"{mid}:run_card->scores->{mid}"
             for mid, spec in RANKABLE_METRICS.items() if spec["jsonb"]]
    items.append("sacrebleu_signatures:run_card->scores->sacrebleu_signatures")
    model_keys = sorted({spec["signature"]["key"] for spec in RANKABLE_METRICS.values()
                         if spec["signature"]["kind"] == "model"})
    items.extend(f"{key}:run_card->scores->{key}" for key in model_keys)
    return items


# ---------------------------------------------------------------------------
# sacreBLEU metric objects — ONE definition, shared by tester.py (which scores)
# and expected_signature() (which states the promise), so the two cannot drift.
# ---------------------------------------------------------------------------

def sacrebleu_metric(key: str):
    """A fresh sacreBLEU metric object for a signature key.

    Raises whatever the constructor raises (spBLEU's FLORES-200 tokenizer may
    be unavailable); callers decide whether that is fatal.
    """
    if key == "chrf":
        return CHRF(word_order=2)
    if key == "chrf_plain":
        return CHRF(word_order=0)
    if key == "bleu":
        return BLEU()
    if key == "spbleu":
        return BLEU(tokenize="flores200")
    if key == "ter":
        return TER()
    raise KeyError(f"no sacreBLEU metric for signature key {key!r}")


def expected_signature(metric_id: str, *, model_id: Optional[str] = None) -> str:
    """The signature this harness produces for ``metric_id`` — what a contest freezes.

    sacreBLEU signatures carry ``nrefs``, which sacreBLEU only knows after
    scoring; contests are single-reference, so a one-segment, one-reference
    corpus fixes it without touching any data. ``model`` metrics need the
    neural model id the contest will use.
    """
    spec = RANKABLE_METRICS[metric_id]
    sig = spec["signature"]
    if sig["kind"] == "sacrebleu":
        metric = sacrebleu_metric(sig["key"])
        metric.corpus_score(["a"], [["a"]])
        return str(metric.get_signature())
    if sig["kind"] == "model":
        if not model_id:
            raise ValueError(
                f"{metric_id} is identified by its neural model: name the model "
                f"the contest will use (e.g. --comet-model)")
        return f"{model_id}|harness:{HARNESS_VERSION}"
    return f"harness:{HARNESS_VERSION}"


def recorded_signature(card: dict, metric_id: str) -> Optional[str]:
    """The signature a run card records for ``metric_id``, or None if it records none."""
    sig = RANKABLE_METRICS[metric_id]["signature"]
    if sig["kind"] == "sacrebleu":
        sigs = card.get("sacrebleu_signatures") or {}
        value = sigs.get(sig["key"]) if isinstance(sigs, dict) else None
        return str(value) if value else None
    harness = card.get("harness_version")
    if sig["kind"] == "model":
        model = card.get(sig["key"])
        if not model or not harness:
            return None
        return f"{model}|harness:{harness}"
    return f"harness:{harness}" if harness else None
