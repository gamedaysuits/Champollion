"""Tests for fetch-from-source corpus resolution (corpus_fetch.py).

Covers:
    - corpora-card matching for missing corpus paths
    - registry source_export matching (the Tatoeba mesh corpora)
    - fetch orchestration with a mocked builder (no network)
    - sha256 verification of built corpora
    - non-interactive behavior (--yes / CI env / declined prompt)
    - corpus_loader integration (fetch-on-miss)
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from unittest import mock

import pytest

from mt_eval_harness import corpus_fetch
from mt_eval_harness.corpus_fetch import (
    fetch_corpus_from_card,
    fetch_corpus_from_registry_entry,
    find_card_for_corpus,
    find_corpora_cards_dir,
    find_registry_export_for_corpus,
    try_fetch_missing_corpus,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

BUILT_CORPUS = {
    "dataset": {"name": "test-fetch-v1"},
    "entries": [
        {"id": 0, "source": "Come", "reference": "âstam"},
    ],
    "language_pair": {"source": "eng", "target": "crk"},
}

BUILT_BYTES = json.dumps(BUILT_CORPUS, indent=2, ensure_ascii=False).encode()
BUILT_SHA256 = hashlib.sha256(BUILT_BYTES).hexdigest()


def _make_card(sha256: str | None = BUILT_SHA256) -> dict:
    return {
        "id": "eval-test-fetch-v1",
        "type": "eval",
        "dev": {
            "size": 1,
            "sizeUnit": "entries",
            "dataFile": "curated/test-fetch-v1.json",
            "format": "harness-json",
        },
        "source": {
            "publisher": "Test",
            "url": "https://example.com/repo",
            "repo_url": "https://example.com/repo",
            "ref": "abc123",
            "builder": "testbuilder",
            "sha256": sha256,
            "license": "CC-BY-NC-SA-4.0",
            "license_url": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
        },
    }


@pytest.fixture
def cards_dir(tmp_path):
    d = tmp_path / "corpora-cards"
    d.mkdir()
    (d / "eval-test-fetch-v1.json").write_text(
        json.dumps(_make_card()), encoding="utf-8"
    )
    # A non-fetchable card (no source.repo_url/builder) — must be ignored.
    (d / "eval-no-source.json").write_text(json.dumps({
        "id": "eval-no-source",
        "dev": {"dataFile": "curated/no-source.json"},
        "source": {"publisher": "X", "url": None},
    }), encoding="utf-8")
    return d


@pytest.fixture
def fake_builder(tmp_path, monkeypatch):
    """Install a mock builder that writes BUILT_CORPUS to dest."""
    calls = []

    def build(card, dest, *, assume_yes):
        calls.append({"card": card["id"], "dest": dest, "assume_yes": assume_yes})
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(BUILT_BYTES)
        return dest

    monkeypatch.setitem(corpus_fetch.BUILDERS, "testbuilder", build)
    return calls


@pytest.fixture
def cache_dir(tmp_path, monkeypatch):
    cache = tmp_path / ".cache"
    monkeypatch.setattr(corpus_fetch, "CACHE_DIR", cache)
    return cache


# ---------------------------------------------------------------------------
# Cards directory resolution
# ---------------------------------------------------------------------------

class TestFindCorporaCardsDir:
    def test_finds_monorepo_cards_dir(self):
        # In the monorepo checkout, cli/shared/corpora-cards exists.
        found = find_corpora_cards_dir()
        assert found is not None
        assert found.name == "corpora-cards"
        assert (found / "eval-eng-crk-edtekla-dev-v1.json").exists()


# ---------------------------------------------------------------------------
# Card matching
# ---------------------------------------------------------------------------

class TestFindCardForCorpus:
    def test_suffix_match(self, cards_dir):
        match = find_card_for_corpus(
            "/abs/path/arena/datasets/curated/test-fetch-v1.json",
            cards_dir=cards_dir,
        )
        assert match is not None
        card, data_file = match
        assert card["id"] == "eval-test-fetch-v1"
        assert data_file == "curated/test-fetch-v1.json"

    def test_filename_fallback_match(self, cards_dir):
        match = find_card_for_corpus(
            "somewhere/else/test-fetch-v1.json", cards_dir=cards_dir,
        )
        assert match is not None
        assert match[0]["id"] == "eval-test-fetch-v1"

    def test_no_match_returns_none(self, cards_dir):
        assert find_card_for_corpus(
            "curated/unknown.json", cards_dir=cards_dir,
        ) is None

    def test_card_without_source_block_not_fetchable(self, cards_dir):
        assert find_card_for_corpus(
            "curated/no-source.json", cards_dir=cards_dir,
        ) is None

    def test_missing_cards_dir_returns_none(self, tmp_path):
        assert find_card_for_corpus(
            "curated/test-fetch-v1.json",
            cards_dir=None if False else tmp_path / "nope",
        ) is None


# ---------------------------------------------------------------------------
# Fetch orchestration (mocked builder)
# ---------------------------------------------------------------------------

class TestFetchCorpusFromCard:
    def test_builds_into_cache_and_verifies(self, fake_builder, cache_dir):
        card = _make_card()
        built = fetch_corpus_from_card(
            card, "curated/test-fetch-v1.json", assume_yes=True,
        )
        assert built == cache_dir / "curated/test-fetch-v1.json"
        assert json.loads(built.read_text(encoding="utf-8")) == BUILT_CORPUS
        assert fake_builder[0]["card"] == "eval-test-fetch-v1"

    def test_sha256_mismatch_deletes_and_raises(self, cache_dir, monkeypatch):
        def bad_build(card, dest, *, assume_yes):
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(b"corrupted output")
            return dest

        monkeypatch.setitem(corpus_fetch.BUILDERS, "testbuilder", bad_build)
        card = _make_card()
        with pytest.raises(ValueError, match="SHA-256 mismatch"):
            fetch_corpus_from_card(
                card, "curated/test-fetch-v1.json", assume_yes=True,
            )
        assert not (cache_dir / "curated/test-fetch-v1.json").exists()

    def test_no_sha256_skips_verification(self, fake_builder, cache_dir):
        card = _make_card(sha256=None)
        built = fetch_corpus_from_card(
            card, "curated/test-fetch-v1.json", assume_yes=True,
        )
        assert built.exists()

    def test_cached_verified_build_skips_rebuild(self, fake_builder, cache_dir):
        card = _make_card()
        dest = cache_dir / "curated/test-fetch-v1.json"
        dest.parent.mkdir(parents=True)
        dest.write_bytes(BUILT_BYTES)
        built = fetch_corpus_from_card(
            card, "curated/test-fetch-v1.json", assume_yes=True,
        )
        assert built == dest
        assert fake_builder == []  # builder never invoked

    def test_unknown_builder_raises(self, cache_dir):
        card = _make_card()
        card["source"]["builder"] = "does-not-exist"
        with pytest.raises(RuntimeError, match="unknown builder"):
            fetch_corpus_from_card(
                card, "curated/test-fetch-v1.json", assume_yes=True,
            )

    def test_non_interactive_without_yes_raises(
        self, fake_builder, cache_dir, monkeypatch,
    ):
        monkeypatch.delenv("CI", raising=False)
        monkeypatch.setattr(
            corpus_fetch, "_non_interactive", lambda: True,
        )
        with pytest.raises(RuntimeError, match="--yes"):
            fetch_corpus_from_card(
                _make_card(), "curated/test-fetch-v1.json", assume_yes=False,
            )

    def test_ci_env_proceeds_without_prompt(
        self, fake_builder, cache_dir, monkeypatch,
    ):
        monkeypatch.setenv("CI", "true")
        built = fetch_corpus_from_card(
            _make_card(), "curated/test-fetch-v1.json", assume_yes=False,
        )
        assert built.exists()

    def test_declined_prompt_raises(self, fake_builder, cache_dir, monkeypatch):
        monkeypatch.delenv("CI", raising=False)
        monkeypatch.setattr(corpus_fetch, "_non_interactive", lambda: False)
        with mock.patch("builtins.input", return_value="n"):
            with pytest.raises(RuntimeError, match="declined"):
                fetch_corpus_from_card(
                    _make_card(), "curated/test-fetch-v1.json",
                    assume_yes=False,
                )

    def test_accepted_prompt_builds(self, fake_builder, cache_dir, monkeypatch):
        monkeypatch.delenv("CI", raising=False)
        monkeypatch.setattr(corpus_fetch, "_non_interactive", lambda: False)
        with mock.patch("builtins.input", return_value="y"):
            built = fetch_corpus_from_card(
                _make_card(), "curated/test-fetch-v1.json", assume_yes=False,
            )
        assert built.exists()


# ---------------------------------------------------------------------------
# try_fetch_missing_corpus
# ---------------------------------------------------------------------------

class TestTryFetchMissingCorpus:
    def test_returns_none_without_matching_card(self, cards_dir):
        assert try_fetch_missing_corpus(
            "curated/never-heard-of-it.json",
            assume_yes=True, cards_dir=cards_dir,
        ) is None

    def test_fetches_for_matching_card(
        self, cards_dir, fake_builder, cache_dir,
    ):
        built = try_fetch_missing_corpus(
            "arena/datasets/curated/test-fetch-v1.json",
            assume_yes=True, cards_dir=cards_dir,
        )
        assert built is not None
        assert built.exists()


# ---------------------------------------------------------------------------
# Registry source_export resolution (Tatoeba mesh corpora)
# ---------------------------------------------------------------------------

def _make_registry_entry(sha256: str | None = BUILT_SHA256) -> dict:
    return {
        "id": "tatoeba-test-mesh-dev",
        "language_pair": {"source": "spa", "target": "fra"},
        "size": 1,
        "access": "fetch-from-source",
        "license": "CC-BY-2.0",
        "sha256": sha256,
        "path": "curated/test-mesh-dev-v1.json",
        "segment": "development",
        "source_export": {
            "builder": "test-registry-builder",
            "url": "https://example.com/export.tar",
            "sha256": "feed" * 16,
            "license": "CC-BY-2.0",
            "license_url": "https://creativecommons.org/licenses/by/2.0/",
            "recipe": {"split": "test", "seed": 42},
        },
    }


@pytest.fixture
def registry_path(tmp_path):
    p = tmp_path / "registry.json"
    p.write_text(json.dumps({
        "registry_version": "1.0.0",
        "datasets": [
            _make_registry_entry(),
            {   # fetch-from-source WITHOUT source_export (EdTeKLA style:
                # resolved via corpora cards, not the registry) — skipped.
                "id": "no-export", "access": "fetch-from-source",
                "path": "curated/no-export.json",
                "language_pair": {"source": "eng", "target": "crk"},
            },
            {   # local corpus — never registry-fetched.
                "id": "local-ds", "access": "local",
                "path": "curated/local-ds.json",
                "language_pair": {"source": "eng", "target": "fra"},
            },
        ],
    }), encoding="utf-8")
    return p


@pytest.fixture
def fake_registry_builder(monkeypatch):
    """Install a mock registry builder that writes BUILT_CORPUS to dest."""
    calls = []

    def build(entry, dest, *, assume_yes):
        calls.append({"id": entry["id"], "dest": dest,
                      "assume_yes": assume_yes})
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(BUILT_BYTES)
        return dest

    monkeypatch.setitem(
        corpus_fetch.REGISTRY_BUILDERS, "test-registry-builder", build,
    )
    return calls


class TestFindRegistryExportForCorpus:
    def test_suffix_match(self, registry_path):
        entry = find_registry_export_for_corpus(
            "/abs/arena/datasets/curated/test-mesh-dev-v1.json",
            registry_path=registry_path,
        )
        assert entry is not None
        assert entry["id"] == "tatoeba-test-mesh-dev"

    def test_filename_fallback(self, registry_path):
        entry = find_registry_export_for_corpus(
            "elsewhere/test-mesh-dev-v1.json", registry_path=registry_path,
        )
        assert entry is not None
        assert entry["id"] == "tatoeba-test-mesh-dev"

    def test_entry_without_source_export_not_fetchable(self, registry_path):
        assert find_registry_export_for_corpus(
            "curated/no-export.json", registry_path=registry_path,
        ) is None

    def test_local_entry_not_fetchable(self, registry_path):
        assert find_registry_export_for_corpus(
            "curated/local-ds.json", registry_path=registry_path,
        ) is None

    def test_missing_registry_returns_none(self, tmp_path):
        assert find_registry_export_for_corpus(
            "curated/test-mesh-dev-v1.json",
            registry_path=tmp_path / "absent.json",
        ) is None

    def test_no_path_uses_layered_load_registry(self, monkeypatch):
        """With no explicit registry_path, resolution goes through
        config.load_registry (local→bundled→remote) so a standalone install —
        where no registry file sits at the in-repo path — can still fetch."""
        fake = {"registry_version": "3.0.0", "datasets": [{
            "id": "gv-x", "access": "fetch-from-source",
            "path": "eval-amh-arb-globalvoices-test-v1.json",
            "source_export": {"builder": "globalvoices-parallel"},
        }]}
        monkeypatch.setattr(
            "mt_eval_harness.config.load_registry", lambda *a, **k: fake
        )
        entry = find_registry_export_for_corpus(
            "eval-amh-arb-globalvoices-test-v1.json"  # no registry_path
        )
        assert entry is not None and entry["id"] == "gv-x"

    def test_real_registry_resolves_mesh_corpus(self):
        # The checked-in registry must resolve its own mesh entries.
        entry = find_registry_export_for_corpus(
            "datasets/curated/spa-fra-dev-v1.json",
        )
        assert entry is not None
        assert entry["source_export"]["builder"] == "tatoeba-challenge"
        assert entry["sha256"]


class TestFetchCorpusFromRegistryEntry:
    def test_builds_into_cache_and_verifies(
        self, fake_registry_builder, cache_dir,
    ):
        built = fetch_corpus_from_registry_entry(
            _make_registry_entry(), assume_yes=True,
        )
        assert built == cache_dir / "curated/test-mesh-dev-v1.json"
        assert json.loads(built.read_text(encoding="utf-8")) == BUILT_CORPUS
        assert fake_registry_builder[0]["id"] == "tatoeba-test-mesh-dev"

    def test_sha256_mismatch_deletes_and_raises(
        self, cache_dir, monkeypatch,
    ):
        def bad_build(entry, dest, *, assume_yes):
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(b"corrupted output")
            return dest

        monkeypatch.setitem(
            corpus_fetch.REGISTRY_BUILDERS, "test-registry-builder",
            bad_build,
        )
        with pytest.raises(ValueError, match="SHA-256 mismatch"):
            fetch_corpus_from_registry_entry(
                _make_registry_entry(), assume_yes=True,
            )
        assert not (cache_dir / "curated/test-mesh-dev-v1.json").exists()

    def test_unknown_builder_raises(self, cache_dir):
        entry = _make_registry_entry()
        entry["source_export"]["builder"] = "does-not-exist"
        with pytest.raises(RuntimeError, match="unknown source_export builder"):
            fetch_corpus_from_registry_entry(entry, assume_yes=True)

    def test_non_interactive_without_yes_raises(
        self, fake_registry_builder, cache_dir, monkeypatch,
    ):
        monkeypatch.delenv("CI", raising=False)
        monkeypatch.setattr(corpus_fetch, "_non_interactive", lambda: True)
        with pytest.raises(RuntimeError, match="--yes"):
            fetch_corpus_from_registry_entry(
                _make_registry_entry(), assume_yes=False,
            )

    def test_cached_verified_build_skips_rebuild(
        self, fake_registry_builder, cache_dir,
    ):
        dest = cache_dir / "curated/test-mesh-dev-v1.json"
        dest.parent.mkdir(parents=True)
        dest.write_bytes(BUILT_BYTES)
        built = fetch_corpus_from_registry_entry(
            _make_registry_entry(), assume_yes=True,
        )
        assert built == dest
        assert fake_registry_builder == []  # builder never invoked


class TestTryFetchResolutionOrder:
    def test_registry_used_when_no_card_matches(
        self, cards_dir, registry_path, fake_registry_builder, cache_dir,
    ):
        built = try_fetch_missing_corpus(
            "arena/datasets/curated/test-mesh-dev-v1.json",
            assume_yes=True, cards_dir=cards_dir,
            registry_path=registry_path,
        )
        assert built is not None
        assert fake_registry_builder, "registry builder should have run"

    def test_cards_take_precedence_over_registry(
        self, cards_dir, registry_path, fake_builder,
        fake_registry_builder, cache_dir,
    ):
        # test-fetch-v1 matches a corpora card; the registry must not
        # be consulted for it even when a registry_path is supplied.
        built = try_fetch_missing_corpus(
            "arena/datasets/curated/test-fetch-v1.json",
            assume_yes=True, cards_dir=cards_dir,
            registry_path=registry_path,
        )
        assert built is not None
        assert fake_builder, "card builder should have run"
        assert fake_registry_builder == []

    def test_nothing_matches_returns_none(
        self, cards_dir, registry_path, cache_dir,
    ):
        assert try_fetch_missing_corpus(
            "curated/never-heard-of-it.json",
            assume_yes=True, cards_dir=cards_dir,
            registry_path=registry_path,
        ) is None


# ---------------------------------------------------------------------------
# corpus_loader integration
# ---------------------------------------------------------------------------

class TestLoaderFetchOnMiss:
    def test_load_corpus_fetches_missing_file(
        self, cards_dir, fake_builder, cache_dir, monkeypatch, tmp_path,
    ):
        from mt_eval_harness.config import RunConfig
        from mt_eval_harness.corpus_loader import load_corpus

        # Point the default cards-dir resolution at the fixture dir.
        monkeypatch.setattr(
            corpus_fetch, "find_corpora_cards_dir", lambda: cards_dir,
        )

        missing = tmp_path / "datasets" / "curated" / "test-fetch-v1.json"
        config = RunConfig(corpus_path=str(missing), assume_yes=True)
        entries, meta = load_corpus(config)
        assert len(entries) == 1
        assert entries[0]["source"] == "Come"
        assert config.corpus_path.endswith("curated/test-fetch-v1.json")
        assert Path(config.corpus_path).is_relative_to(cache_dir)

    def test_load_corpus_still_errors_without_card(
        self, cards_dir, cache_dir, monkeypatch, tmp_path,
    ):
        from mt_eval_harness.config import RunConfig
        from mt_eval_harness.corpus_loader import load_corpus

        monkeypatch.setattr(
            corpus_fetch, "find_corpora_cards_dir", lambda: cards_dir,
        )
        config = RunConfig(corpus_path=str(tmp_path / "nope.json"))
        with pytest.raises(FileNotFoundError, match="Corpus not found"):
            load_corpus(config)


class TestTatoebaChallengeCardArchiveSha:
    """Regression: a card's source.sha256 is the BUILT-CORPUS hash, never the
    archive hash. The builder must verify the downloaded export against the
    pinned ARCHIVE sha (TEST_TAR_SHA256), not the per-corpus card sha.

    The original bug passed source.sha256 as tar_sha256, so ensure_test_tar
    verified the 169 MB archive against a per-corpus hash — it always failed,
    deleted the archive, and re-downloaded the full export for EVERY corpus,
    so no card-based fetch-from-source could ever succeed.
    """

    def _adapter(self):
        from mt_eval_harness.corpus_build.adapters import tatoeba_challenge_adapter
        return tatoeba_challenge_adapter

    def _capture_tar_sha(self, card, monkeypatch, tmp_path):
        tca = self._adapter()
        captured = {}

        def fake_build(dest, **kwargs):
            captured.update(kwargs)
            Path(dest).parent.mkdir(parents=True, exist_ok=True)
            Path(dest).write_text("{}", encoding="utf-8")
            return Path(dest)

        monkeypatch.setattr(tca, "build_corpus_file", fake_build)
        monkeypatch.setattr(corpus_fetch, "CACHE_DIR", tmp_path / ".cache")
        corpus_fetch._build_tatoeba_challenge_from_card(
            card, tmp_path / "out.json", assume_yes=True,
        )
        return captured, tca

    def test_uses_archive_sha_not_corpus_sha(self, monkeypatch, tmp_path):
        per_corpus_sha = "deadbeef" * 8  # the card's BUILT-CORPUS hash
        card = {
            "id": "eval-eng-zul-tatoeba-dev-v1",
            "pair": {"source": "eng", "target": "zul"},
            "source": {
                "builder": "tatoeba-challenge",
                "repo_url": (
                    "https://object.pouta.csc.fi/"
                    "Tatoeba-Challenge-devtest/test-v2023-09-26.tar"
                ),
                "sha256": per_corpus_sha,
                "recipe": {"split": "test"},
            },
        }
        captured, tca = self._capture_tar_sha(card, monkeypatch, tmp_path)
        # The archive must be verified against the pinned archive hash...
        assert captured["tar_sha256"] == tca.TEST_TAR_SHA256
        # ...never the per-corpus card hash (that's the bug).
        assert captured["tar_sha256"] != per_corpus_sha

    def test_explicit_archive_sha_override_is_honored(self, monkeypatch, tmp_path):
        card = {
            "id": "eval-eng-zul-tatoeba-dev-v1",
            "pair": {"source": "eng", "target": "zul"},
            "source": {
                "builder": "tatoeba-challenge",
                "repo_url": "https://example.org/some-other-release.tar",
                "sha256": "cafe" * 16,            # corpus hash
                "archive_sha256": "abcd" * 16,    # explicit archive hash
                "recipe": {"split": "test"},
            },
        }
        captured, _ = self._capture_tar_sha(card, monkeypatch, tmp_path)
        assert captured["tar_sha256"] == "abcd" * 16


class TestUpstreamDownloadsAreAttributable:
    """Every upstream corpus download must identify Champollion via a named
    User-Agent, so data creators (Tatoeba, OPUS, etc.) can see and attribute
    the traffic their work drives. Anonymous fetches are a regression.
    """

    def test_tatoeba_challenge_download_sets_user_agent(self, monkeypatch, tmp_path):
        from mt_eval_harness.corpus_build.adapters import tatoeba_challenge_adapter as tca
        from corpora_builder import USER_AGENT

        captured = {}

        class _Stop(Exception):
            pass

        def fake_get(url, **kwargs):
            captured.update(kwargs)
            raise _Stop()  # abort before download/sha logic — we only want headers

        monkeypatch.setattr(tca.requests, "get", fake_get)
        with pytest.raises(_Stop):
            tca.ensure_test_tar(tmp_path, auto_yes=True)

        assert captured.get("headers", {}).get("User-Agent") == USER_AGENT
        assert "champollion" in USER_AGENT.lower()
        assert "champollion.dev" in USER_AGENT
