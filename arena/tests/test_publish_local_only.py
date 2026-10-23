"""A steward's local-only mark stops sentence text at publish, not just at
the model call (synthetic hospital persona, Round 1, 2026-10-03: a publish
dry-run with --publish-entries offered to upload all 150 nurse-checked rows).
"""

from __future__ import annotations

import json

import pytest

from mt_eval_harness import publish
from mt_eval_harness.publish import _entry_content_publishable, assemble_run_card
from test_publish import _write_pair_with_provenance  # noqa: F401


@pytest.fixture(autouse=True)
def no_git(monkeypatch):
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)


def test_gate_refuses_local_only_even_with_the_override():
    allow, why = _entry_content_publishable(
        None, scores_only=False, override=True, local_only=True)
    assert allow is False
    assert "local-only" in why and "cannot override" in why


def test_the_run_card_carries_the_mark_and_the_licence(tmp_path):
    report = _write_pair_with_provenance(tmp_path, "lo", {
        "dataset_meta": {"transmission": "local-only",
                         "license": "LicenseRef-Proprietary"}})
    run_card, _, _ = assemble_run_card(report)
    assert run_card["dataset"]["transmission"] == "local-only"
    assert run_card["corpus_license"] == "LicenseRef-Proprietary"


def test_publish_dry_run_withholds_the_text(tmp_path, monkeypatch, capsys):
    report = _write_pair_with_provenance(tmp_path, "lo2", {
        "dataset_meta": {"transmission": "local-only"}})
    data = json.loads(report.read_text())
    data["entries"] = [{"id": 0, "source": "Where does it hurt?",
                        "expected": "zub kef", "predicted": "zub kef"}]
    report.write_text(json.dumps(data))
    monkeypatch.setattr(publish, "_is_prod_target", lambda: False)
    publish.publish_to_supabase(str(report), dry_run=True, auto_confirm=True,
                                publish_entries_override=True)
    out = capsys.readouterr().out
    assert "sentence text WITHHELD" in out and "local-only" in out
    assert "WITH their source + reference text" not in out


def _seal_verifies(card: dict) -> bool:
    import hashlib
    clone = json.loads(json.dumps(card))
    declared = clone.get("run_card_hash")
    clone["run_card_hash"] = ""
    return declared == hashlib.sha256(
        json.dumps(clone, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def test_the_stored_card_seal_verifies_after_the_prompt_is_redacted(
        tmp_path, monkeypatch):
    """The seal was computed at assembly, BEFORE publish redacted the
    prompt, so every redacted card failed lint_run_reports' seal check."""
    report = _write_pair_with_provenance(tmp_path, "lo3", {
        "dataset_meta": {"transmission": "local-only"},
        "condition": "coached",
        "system_prompt_used": "Translate with these examples: tânisi = hello",
        "system_prompt_sha256": "ab" * 32})
    monkeypatch.setattr(publish, "_is_prod_target", lambda: False)
    rows = []
    real = publish.build_run_card_row
    monkeypatch.setattr(publish, "build_run_card_row",
                        lambda card, *a, **k: rows.append(card) or real(card, *a, **k))
    publish.publish_to_supabase(str(report), dry_run=True, auto_confirm=True)
    card = rows[0]
    assert card["system_prompt_used"].startswith("[REDACTED")
    assert _seal_verifies(card)


# ---------------------------------------------------------------------------
# a model trained on local-only sentences: its translations stay here too
#
# Each run_card_entries row carries the model's output. On an open corpus the
# entry gate allowed the upload (with --publish-entries), so a local-only
# model's translations — which can repeat what it learned from — would have
# gone to the public table, though the terminal and every file withhold them.
# ---------------------------------------------------------------------------

def _local_only_model_report(tmp_path, record):
    """A report whose run log ran a model folder holding only ``record`` as
    its forge-model.json (no weights; the report names no config, so the
    run log's — what the card is built from — is the one read)."""
    folder = tmp_path / "family-model"
    folder.mkdir(parents=True)
    (folder / "forge-model.json").write_text(json.dumps(record))
    report = _write_pair_with_provenance(tmp_path, "lm", {})
    log_path = tmp_path / "lm.json"
    log = json.loads(log_path.read_text())
    log["config"].update(mt_method="local-model", engine_model={
        "kind": "directory", "id": "family-model", "path": str(folder),
        "sha256": "c" * 64})
    log_path.write_text(json.dumps(log))
    data = json.loads(report.read_text())
    data["entries"] = [{"id": 0, "source": "Where does it hurt?",
                        "expected": "zub kef", "predicted": "zub kef dor"}]
    report.write_text(json.dumps(data))
    return report


def test_gate_refuses_a_local_only_models_outputs_even_with_the_override():
    allow, why = _entry_content_publishable(
        None, scores_only=False, override=True,
        outputs_local_only="its outputs come from a local-only model, m (x)")
    assert allow is False
    assert why.startswith("its outputs come from a local-only model")
    assert "cannot override" in why


def test_publish_dry_run_withholds_a_local_only_models_outputs(
        tmp_path, monkeypatch, capsys):
    report = _local_only_model_report(
        tmp_path, {"trained_on": {"terms": {"transmission": "local-only"}}})
    monkeypatch.setattr(publish, "_is_prod_target", lambda: False)
    publish.publish_to_supabase(str(report), dry_run=True, auto_confirm=True,
                                publish_entries_override=True)
    out = capsys.readouterr().out
    assert "sentence text WITHHELD" in out
    assert "local-only model, family-model" in out
    assert "WITH their source + reference text" not in out
    assert "zub kef" not in out and "Where does it hurt?" not in out


def test_a_model_that_learned_from_no_local_only_sentences_publishes_entries(
        tmp_path):
    report = _local_only_model_report(tmp_path, {"trained_on": {"terms": {}}})
    assert publish._outputs_local_only(json.loads(report.read_text())) == ""


def test_the_publish_hint_says_only_scores_go(tmp_path):
    from mt_eval_harness.cli import _publish_scope
    report = _local_only_model_report(tmp_path, {"export_format": "x"})
    publishable, note = _publish_scope(report)
    assert publishable is True
    assert note.startswith("publishing uploads scores only — its outputs come "
                           "from a local-only model, family-model")
