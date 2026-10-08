"""Which way is better, for every metric name the comparison surfaces print.

ONE table drives the direction marks in ``mt-eval compare`` (the run table
and the significance table) and the ``winner`` of a plugin rate's paired
test: the ``direction`` field of the metric registry (``shared/metric-
registry.json``, bundled as ``mt_eval_harness/data/metric-registry.json``).
Nothing here restates a direction. What this module adds is the NAME
bridge: compare and the significance tests print report keys
(``corpus_ter``, ``code_switching.avg_code_switching_rate``), not registry
ids (``ter``, ``code_switching_rate``).

Before this, only ``corpus_ter`` was marked lower-is-better; a code-switching
or hallucination rate that went UP printed "Δ +0.52  Yes *" with nothing to
say that was a regression, and its paired test named the WORSE run the
winner (synthetic researcher, 2026-10-03).

A name that resolves to nothing has no declared direction (None) and is
shown as such — never guessed.
"""

from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources

HIGHER = "higher"
LOWER = "lower"
NEUTRAL = "neutral"

# Report / comparison names → registry id. Same metric, the name a report
# (tester.py) or the comparison table uses for it.
_NAME_TO_ID = {
    "corpus_chrf": "chrf_plus_plus",
    "corpus_bleu": "bleu",
    "corpus_ter": "ter",
    "corpus_spbleu": "spbleu",
    "corpus_chrf_plain": "chrf_plain",
    # LEGACY: the paired tests' reduced per-segment composite (higher is
    # better), retired with the weighted composite by scoring standard/1 —
    # kept so a comparison JSON written before the standard still reads.
    "segment_composite": "composite",
    "composite_score": "composite",  # its name before 2026-10-03
    "total_cost": "total_cost_usd",
    "avg_latency": "avg_latency_seconds",
    "avg_latency_s": "avg_latency_seconds",
}

# Plugin aggregate keys (``<plugin>.<key>``) that are another aggregation of
# a registry metric, or one of its components — the same direction. Keys of
# the form avg_<id> / <id> resolve without an entry here (_resolve).
_PLUGIN_KEY_TO_ID = {
    # Share of entries with any code switching; same failure, same direction.
    "code_switching.entries_with_code_switching_pct": "code_switching_rate",
    # Worst entry, share flagged, and the weighted signals the rate is
    # built from (each 0 = clean, 1 = worst; plugins/hallucination.py).
    "hallucination.max_hallucination_rate": "hallucination_rate",
    "hallucination.entries_flagged_hallucination_pct": "hallucination_rate",
    "hallucination.avg_length_score": "hallucination_rate",
    "hallucination.avg_repetition_score": "hallucination_rate",
    "hallucination.avg_entity_score": "hallucination_rate",
    # avg_fst_validity is THE published fst_acceptance_rate (mean of
    # per-entry rates); corpus_validity_rate pools all words.
    "giellalt_fst_validity.avg_fst_validity": "fst_acceptance_rate",
    "giellalt_fst_validity.corpus_validity_rate": "fst_acceptance_rate",
    "terminology.corpus_term_adherence": "terminology_adherence",
}


@lru_cache(maxsize=1)
def _registry_entries() -> dict:
    text = (resources.files("mt_eval_harness") / "data" / "metric-registry.json"
            ).read_text(encoding="utf-8")
    return json.loads(text).get("entries") or {}


def _resolve(name: str) -> str | None:
    """The registry id a printed metric name stands for, or None."""
    entries = _registry_entries()
    if name in entries:
        return name
    if name in _NAME_TO_ID:
        return _NAME_TO_ID[name]
    if name in _PLUGIN_KEY_TO_ID:
        return _PLUGIN_KEY_TO_ID[name]
    if "." in name:
        plugin, key = name.split(".", 1)
        for cand in (key, key[len("avg_"):] if key.startswith("avg_") else None):
            if cand and cand in entries and entries[cand].get("plugin_name") == plugin:
                return cand
    return None


def direction_of(name: str | None) -> str | None:
    """``"higher"`` | ``"lower"`` | ``"neutral"`` for a printed metric name,
    or None when the registry declares nothing for it."""
    if not name:
        return None
    metric_id = _resolve(name)
    if metric_id is None:
        return None
    direction = (_registry_entries().get(metric_id) or {}).get("direction")
    return direction if direction in (HIGHER, LOWER, NEUTRAL) else None


def arrow(direction: str | None) -> str:
    """↑ higher is better, ↓ lower is better, ' ' neutral/undeclared."""
    return {HIGHER: "↑", LOWER: "↓"}.get(direction, " ")


def better_side(direction: str | None, a: float, b: float) -> str | None:
    """Which run scored better on this metric: "A", "B", "tie", or None
    when the metric has no better direction (neutral / undeclared)."""
    if direction not in (HIGHER, LOWER):
        return None
    if a == b:
        return "tie"
    a_better = a > b if direction == HIGHER else a < b
    return "A" if a_better else "B"
