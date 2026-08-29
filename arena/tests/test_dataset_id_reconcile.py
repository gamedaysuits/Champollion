"""
Tests for dataset-id reconciliation.

Regression guard (dress rehearsal): the queue/MCP path runs `--corpus
eval-*-v1` (a registered datasets.id), but the BUILT corpus file is
self-described as e.g. `tatoeba-eng-ilo-dev`. At publish time the run card's
dataset_id was taken from the corpus file's self-id, so run_cards.dataset_id
did NOT equal the queue's corpus_id or any datasets.id — it joined nothing.

The fix: when `--corpus` resolves through the registry, RunConfig.validate()
stamps the CANONICAL registry id as dataset_id, which then wins at publish.
"""

from pathlib import Path

import pytest

from mt_eval_harness import config as config_mod
from mt_eval_harness.config import RunConfig, canonical_registry_id


class TestCanonicalRegistryId:
    def test_registered_id_returns_itself(self):
        assert (
            canonical_registry_id("eval-eng-ilo-tatoeba-dev-v1")
            == "eval-eng-ilo-tatoeba-dev-v1"
        )

    def test_alias_returns_canonical(self):
        # 'edtekla-dev' is a declared alias of the canonical id.
        assert canonical_registry_id("edtekla-dev") == "eval-eng-crk-edtekla-dev-v1"

    def test_file_path_returns_none(self):
        assert canonical_registry_id("/some/local/corpus.json") is None

    def test_unknown_id_returns_none(self):
        assert canonical_registry_id("not-a-real-dataset-xyz") is None


class TestValidateStampsDatasetId:
    def test_registry_id_corpus_stamps_canonical_dataset_id(
        self, tmp_path, monkeypatch
    ):
        # A bare registry id that resolves (here: stubbed to a built file, no
        # network) must leave dataset_id == the canonical registered id, so the
        # published run card joins the datasets table.
        built = tmp_path / "built-corpus.json"
        built.write_text('{"corpus_id": "tatoeba-eng-ilo-dev", "entries": []}',
                         encoding="utf-8")
        monkeypatch.setattr(
            config_mod, "resolve_dataset",
            lambda *a, **k: built,
        )

        cfg = RunConfig(corpus_path="eval-eng-ilo-tatoeba-dev-v1")
        errors = cfg.validate()

        assert not errors, errors
        assert cfg.dataset_id == "eval-eng-ilo-tatoeba-dev-v1"
        # And corpus_path was redirected to the built file.
        assert cfg.corpus_path == str(built)

    def test_explicit_dataset_id_is_not_overridden(self, tmp_path, monkeypatch):
        built = tmp_path / "built-corpus.json"
        built.write_text('{"entries": []}', encoding="utf-8")
        monkeypatch.setattr(
            config_mod, "resolve_dataset",
            lambda *a, **k: built,
        )

        cfg = RunConfig(
            corpus_path="eval-eng-ilo-tatoeba-dev-v1",
            dataset_id="caller-supplied-id",
        )
        cfg.validate()
        assert cfg.dataset_id == "caller-supplied-id"

    def test_real_file_path_is_not_stamped(self, tmp_path):
        # A real corpus file (already exists) skips registry resolution
        # entirely; dataset_id is left for corpus_loader to fill from the
        # file's own metadata.
        corpus = tmp_path / "mine.json"
        corpus.write_text('{"entries": []}', encoding="utf-8")
        cfg = RunConfig(corpus_path=str(corpus))
        cfg.validate()
        assert cfg.dataset_id == ""
