"""A file a steward registered runs under its registered card.

Synthetic personas, Round 2 (2026-10-03):

  * hospital: after `champollion register-corpus --tier local-only --data
    data/nurse_checked_test.tsv` (card graded contamination NONE), `mt-eval
    run --corpus data/nurse_checked_test.tsv` warned "ungraded/unknown
    contamination" — the card was never read for a path-addressed corpus.
  * school: one test file was 'eval-eng-crk-our-school-dev-v1' on its card
    and 'teacher_reviewed_test' (the file stem) on run cards, so two runs on
    the same set were not visibly the same set.

The sidecar register-corpus writes names the card (``card``, relative to the
data file) and the file's sha256 at registration; the harness now reads the
card through it, verbatim, and only while the file is unchanged.
"""

from __future__ import annotations

import asyncio
import hashlib
import json

from mt_eval_harness.config import RunConfig
from mt_eval_harness.corpus_loader import load_corpus, registered_card
from mt_eval_harness.publish import _resolve_dataset_id

CARD_ID = "eval-eng-tgl-st-anne-nurses-v1"   # read from the card, never derived


def _register(tmp_path, *, risk="NONE", tamper=False, card_dir=None,
              transmission="local-only"):
    data = tmp_path / "data"
    data.mkdir()
    tsv = data / "nurse_checked_test.tsv"
    tsv.write_text("Where does it hurt?\tSaan masakit?\n"
                   "Take this twice a day.\tInumin ito dalawang beses.\n",
                   encoding="utf-8")
    sha = hashlib.sha256(tsv.read_bytes()).hexdigest()
    cards = card_dir or (tmp_path / "home" / ".champollion" / "corpora-cards")
    cards.mkdir(parents=True)
    card = cards / f"{CARD_ID}.json"
    card.write_text(json.dumps({
        "id": CARD_ID, "name": "St Anne nurses",
        "contamination": {"risk": risk, "reasoning": "Private at registration."},
    }), encoding="utf-8")
    import os
    side = {"id": CARD_ID, "license": "LicenseRef-Clinic-Internal",
            "tier": transmission, "sha256": sha, "rows": 2,
            "card": os.path.relpath(card, data)}
    if transmission == "local-only":
        side["transmission"] = "local-only"
    (data / "nurse_checked_test.tsv.champollion.json").write_text(
        json.dumps(side), encoding="utf-8")
    if tamper:
        tsv.write_text(tsv.read_text(encoding="utf-8") + "New line.\tBago.\n",
                       encoding="utf-8")
    return tsv


def _config(tsv, tmp_path, **kw):
    return RunConfig(dataset="all", corpus_path=str(tsv), model="llama3.1",
                     prompt_version="naive", batch_size=1, provider="local",
                     base_url="http://127.0.0.1:11434/v1",
                     target_lang="Tagalog", source_lang="English",
                     cache_dir=str(tmp_path / "cache"), **kw)


def test_the_card_is_found_through_the_sidecar(tmp_path):
    tsv = _register(tmp_path)
    card = registered_card(tsv)
    assert card["id"] == CARD_ID and card["contamination"] == "NONE"


def test_a_path_addressed_run_takes_the_cards_id_and_grade(tmp_path, capsys):
    tsv = _register(tmp_path)
    config = _config(tsv, tmp_path)
    _, meta = load_corpus(config)
    assert config.dataset_id == CARD_ID
    assert meta["contamination"] == "NONE"
    assert meta["corpus_card"]["id"] == CARD_ID
    # The published run card's dataset id is the card's, not the file stem.
    assert _resolve_dataset_id(config.to_dict()) == CARD_ID
    assert config.corpus_path.endswith("nurse_checked_test.tsv")


def test_the_run_reports_the_cards_grade_not_an_absence(tmp_path, capsys):
    from mt_eval_harness.runner import execute_run
    tsv = _register(tmp_path)
    result = asyncio.run(execute_run(_config(tsv, tmp_path, dry_run=True)))
    out = capsys.readouterr().out
    assert "ungraded/unknown" not in out
    assert f"NONE on corpus card {CARD_ID}" in out
    assert result["dry_run"] is True


def test_a_low_card_earns_the_absolute_lane(tmp_path):
    from mt_eval_harness.runner import execute_run
    tsv = _register(tmp_path, risk="LOW")
    result = asyncio.run(execute_run(_config(tsv, tmp_path, dry_run=True)))
    assert result["relative_only"] is False


def test_a_changed_file_does_not_borrow_the_cards_identity(tmp_path, capsys):
    tsv = _register(tmp_path, tamper=True)
    assert registered_card(tsv) is None
    assert "changed since it was registered" in capsys.readouterr().out
    config = _config(tsv, tmp_path)
    _, meta = load_corpus(config)
    assert "corpus_card" not in meta
    # The sidecar's restriction still applies whatever happened to the card.
    assert meta["transmission"] == "local-only"


def test_an_explicit_dataset_id_still_wins(tmp_path):
    tsv = _register(tmp_path)
    config = _config(tsv, tmp_path, dataset_id="my-own-label")
    load_corpus(config)
    assert config.dataset_id == "my-own-label"


def test_a_missing_card_is_named_and_the_run_goes_on(tmp_path, capsys):
    tsv = _register(tmp_path)
    for card in (tmp_path / "home").rglob("*.json"):
        card.unlink()
    config = _config(tsv, tmp_path)
    _, meta = load_corpus(config)
    assert "not applied" in capsys.readouterr().out
    # The sidecar's own id (written by register-corpus) still names the set.
    assert config.dataset_id == CARD_ID and "corpus_card" not in meta


def test_an_adopted_id_never_hides_the_files_own_registry_entry():
    """A sidecar's (or --dataset-id's) id that matches no registry entry must
    not take the transmission gate off a registered file: the EdTeKLA path
    still resolves its consent-required / quarantined entry."""
    from mt_eval_harness.publish import registry_entry_for_run
    dsid, entry = registry_entry_for_run(
        "eval-eng-crk-some-other-name-v1",
        corpus_path="arena/datasets/curated/eng-crk-dev-v1.json",
        corpus_meta={})
    assert entry is not None
    assert dsid == "eval-eng-crk-edtekla-dev-v1"
