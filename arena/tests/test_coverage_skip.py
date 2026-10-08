"""Coverage-skip (queue): drop combos already on the leaderboard so donated
compute proceeds through the lineup instead of re-running covered work.

Pins the match key — exact (corpus_id, model, condition) — and the safety
property: a different model / corpus / condition is NOT dropped, and items
missing keys are kept rather than wrongly skipped.
"""

from __future__ import annotations

from mt_eval_harness.queue_runner import _drop_covered


def _item(corpus, model, cond):
    return {"id": f"{corpus}__{model}__{cond}", "corpus_id": corpus, "model": model, "condition": cond}


ITEMS = [
    _item("eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive"),
    _item("eval-eng-ilo", "google/gemini-3.5-flash", "naive"),       # same corpus, diff model
    _item("eval-eng-zul", "anthropic/claude-haiku-4.5", "naive"),    # diff corpus, same model
    _item("eval-eng-ilo", "anthropic/claude-haiku-4.5", "coached"),  # same corpus+model, diff condition
]


def test_drops_only_the_exact_covered_combo():
    covered = {("eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive")}
    kept = _drop_covered(ITEMS, covered)
    ids = {it["id"] for it in kept}
    assert len(kept) == 3
    assert "eval-eng-ilo__anthropic/claude-haiku-4.5__naive" not in ids
    # A different model / corpus / condition sharing two of three dims is KEPT —
    # the queue must not over-drop uncovered work.
    assert "eval-eng-ilo__google/gemini-3.5-flash__naive" in ids
    assert "eval-eng-zul__anthropic/claude-haiku-4.5__naive" in ids
    assert "eval-eng-ilo__anthropic/claude-haiku-4.5__coached" in ids


def test_empty_covered_keeps_everything():
    assert _drop_covered(ITEMS, set()) == ITEMS


def test_items_missing_keys_are_kept():
    weird = [{"id": "no-dims"}]  # no corpus_id/model/condition → can't match → kept
    assert _drop_covered(weird, {("a", "b", "c")}) == weird


def test_all_covered_drops_all():
    covered = {(it["corpus_id"], it["model"], it["condition"]) for it in ITEMS}
    assert _drop_covered(ITEMS, covered) == []
