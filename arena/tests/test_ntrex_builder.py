"""Tests for the pinned-revision NTREX builder (corpus_fetch).

The NTREX transport fetches per-language reference files from
raw.githubusercontent.com at the immutable commit pinned on the corpora
card's download.revision — no clone, no moving HEAD. These tests cover the
fail-honest no-revision path, the ISO→filename code mapping (verified
against the pinned commit's file listing), the revision-keyed cache
short-circuit, and the line-pairing build itself.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness import corpus_fetch
from mt_eval_harness.corpus_fetch import (
    _build_ntrex_parallel,
    _fetch_ntrex_ref_file,
    _iso_to_ntrex_file_code,
)

NTREX_URL = "https://github.com/MicrosoftTranslator/NTREX.git"
PIN = "468c6b69c7f6a75d31d4743d9daba2af566cc18d"


def _entry(**overrides):
    entry = {
        "id": "eval-ntrex-test-v1-afr-amh",
        "language_pair": {"source": "afr", "target": "amh"},
        "source_export": {
            "builder": "ntrex-parallel",
            "url": NTREX_URL,
            "file_pattern": "NTREX-128/newstest2019-ref.{lang_code}.txt",
            "segment": "test",
            "revision": PIN,
        },
    }
    entry.update(overrides)
    return entry


class TestIsoToNtrexFileCode:
    def test_english_maps_to_regional_variant(self):
        # Upstream ships eng-US/eng-GB/eng-IN only — bare eng does not exist.
        assert _iso_to_ntrex_file_code("eng") == "eng-US"

    def test_chinese_maps_to_regional_variants(self):
        assert _iso_to_ntrex_file_code("cmn") == "zho-CN"
        assert _iso_to_ntrex_file_code("cmn-Hans") == "zho-CN"
        assert _iso_to_ntrex_file_code("cmn-Hant") == "zho-TW"

    def test_bridge_macrolanguage_mapping(self):
        # code-bridge ntrex_reverse: swh → swa
        assert _iso_to_ntrex_file_code("swh") == "swa"

    def test_passthrough(self):
        assert _iso_to_ntrex_file_code("afr") == "afr"


class TestFetchNtrexRefFile:
    def test_cache_hit_skips_network(self, tmp_path, monkeypatch):
        rel = "NTREX-128/newstest2019-ref.afr.txt"
        cached = tmp_path / PIN / rel
        cached.parent.mkdir(parents=True)
        cached.write_text("hallo wêreld\n", encoding="utf-8")

        def boom(*a, **k):  # any network touch is a failure
            raise AssertionError("network fetch attempted on cache hit")

        monkeypatch.setattr("urllib.request.urlopen", boom)
        got = _fetch_ntrex_ref_file(NTREX_URL, PIN, rel, tmp_path)
        assert got == cached

    def test_fetch_url_is_raw_at_pin(self, tmp_path, monkeypatch):
        rel = "NTREX-128/newstest2019-ref.afr.txt"
        seen = {}

        class FakeResp:
            def read(self):
                return b"hallo\n"

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        def fake_urlopen(url, timeout=None):
            seen["url"] = url
            return FakeResp()

        monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
        got = _fetch_ntrex_ref_file(NTREX_URL, PIN, rel, tmp_path)
        assert seen["url"] == (
            f"https://raw.githubusercontent.com/MicrosoftTranslator/NTREX/{PIN}/{rel}"
        )
        assert got.read_text(encoding="utf-8") == "hallo\n"
        # Cached under the revision → a re-fetch is a cache hit
        assert got == tmp_path / PIN / rel


class TestBuildNtrexParallel:
    def test_missing_revision_fails_honest(self, tmp_path):
        entry = _entry()
        del entry["source_export"]["revision"]
        with pytest.raises(RuntimeError, match="source_export.revision"):
            _build_ntrex_parallel(entry, tmp_path / "out.json", assume_yes=True)

    def test_pairs_lines_and_skips_empties(self, tmp_path, monkeypatch):
        files = {
            "NTREX-128/newstest2019-ref.afr.txt": "a1\na2\n\na4\n",
            "NTREX-128/newstest2019-ref.amh.txt": "b1\nb2\nb3\nb4\n",
        }

        def fake_fetch(repo_url, revision, rel_path, cache_dir):
            assert revision == PIN
            p = tmp_path / "cache" / revision / rel_path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(files[rel_path], encoding="utf-8")
            return p

        monkeypatch.setattr(corpus_fetch, "_fetch_ntrex_ref_file", fake_fetch)
        dest = tmp_path / "out" / "afr-amh.json"
        _build_ntrex_parallel(_entry(), dest, assume_yes=True)

        corpus = json.loads(dest.read_text(encoding="utf-8"))
        assert corpus["source_lang"] == "afr"
        assert corpus["target_lang"] == "amh"
        assert corpus["source_dataset"] == "ntrex-test"
        # Line 3 is empty on the afr side → the pair is dropped
        assert corpus["entry_count"] == 3
        assert [e["id"] for e in corpus["entries"]] == ["1", "2", "4"]
        assert corpus["entries"][0] == {"source": "a1", "target": "b1", "id": "1"}

    def test_line_count_mismatch_raises(self, tmp_path, monkeypatch):
        files = {
            "NTREX-128/newstest2019-ref.afr.txt": "a1\na2\n",
            "NTREX-128/newstest2019-ref.amh.txt": "b1\n",
        }

        def fake_fetch(repo_url, revision, rel_path, cache_dir):
            p = tmp_path / "cache" / revision / rel_path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(files[rel_path], encoding="utf-8")
            return p

        monkeypatch.setattr(corpus_fetch, "_fetch_ntrex_ref_file", fake_fetch)
        with pytest.raises(ValueError, match="Line count mismatch"):
            _build_ntrex_parallel(
                _entry(), tmp_path / "out.json", assume_yes=True)
