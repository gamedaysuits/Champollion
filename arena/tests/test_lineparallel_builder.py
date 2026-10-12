"""Tests for the generic line-parallel recipe transport (master-plan A1).

Covers the four seams of "recipes, not adapters":
  1. the generic adapter (pairing, placeholder resolution, loud failures),
  2. corpus_fetch's ``lineparallel-parallel`` registration (+ the legacy
     ``americasnlp2021-parallel`` alias pointing at the same builder),
  3. build_registry's ``download.builder`` TRANSPORT override, which must
     dispatch to the generic builder WITHOUT collapsing the FAMILY token
     (promotion / held-out-contamination / source_dataset keying), and
  4. the single-file pairing modes (2026-07-07 extension): tsv-columns
     (MENYO-20k), csv-columns (NusaX / NusaTranslation), json-fields (BSD)
     — plus the ``download.pairing`` → ``source_export.pairing`` ride-along.

No network: adapter I/O is exercised on temp files.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
CORPORA_BUILDER = ARENA_ROOT / "scripts" / "corpora-builder"
BUILD_REGISTRY = ARENA_ROOT / "scripts" / "build_registry.py"

# Standalone harness checkouts (e.g. a standalone copy of the arena/ tree) ship
# without the corpora-builder tooling. Same skip posture as the
# corpora-builder parity guard — absence is a valid deployment, not a
# failure. Checked at FILE level so a partial tree skips instead of
# ImportError-ing at collection.
_ADAPTER = (CORPORA_BUILDER / "corpora_builder" / "adapters"
            / "lineparallel_adapter.py")
if not _ADAPTER.is_file() or not BUILD_REGISTRY.is_file():
    pytest.skip(
        "corpora-builder recipe-transport tooling not present in this "
        "checkout — these tests only run where it ships",
        allow_module_level=True)

sys.path.insert(0, str(CORPORA_BUILDER))

from corpora_builder.adapters import lineparallel_adapter  # noqa: E402

from mt_eval_harness import corpus_fetch  # noqa: E402


@pytest.fixture(scope="module")
def registry_mod():
    spec = importlib.util.spec_from_file_location(
        "build_registry", BUILD_REGISTRY,
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# 1. Generic adapter
# ---------------------------------------------------------------------------

class TestResolveMember:
    def test_lang_code_placeholder(self):
        m = lineparallel_adapter._resolve_member(
            "test_data/test.{lang_code}",
            lang_code="quy", src_code="es", tgt_code="quy",
        )
        assert m == "test_data/test.quy"

    def test_pair_directory_layout(self):
        m = lineparallel_adapter._resolve_member(
            "data/{src_code}-{tgt_code}/test.{lang_code}",
            lang_code="yor", src_code="en", tgt_code="yor",
        )
        assert m == "data/en-yor/test.yor"

    def test_unknown_placeholder_raises(self):
        with pytest.raises(ValueError, match="unknown placeholder"):
            lineparallel_adapter._resolve_member(
                "test.{nope}", lang_code="a", src_code="a", tgt_code="b",
            )


class TestBuildPair:
    def _write(self, tmp_path, name, lines):
        p = tmp_path / name
        p.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return p

    def test_pairs_line_for_line(self, tmp_path):
        src = self._write(tmp_path, "test.es", ["Hola.", "Adiós."])
        tgt = self._write(tmp_path, "test.xx", ["A.", "B."])
        pairs = lineparallel_adapter.build_pair(
            src, tgt, src_code="es", tgt_code="xx",
        )
        assert pairs == [("Hola.", "A."), ("Adiós.", "B.")]

    def test_length_mismatch_raises(self, tmp_path):
        src = self._write(tmp_path, "test.es", ["Hola.", "Adiós.", "Tres."])
        tgt = self._write(tmp_path, "test.xx", ["A.", "B."])
        with pytest.raises(ValueError, match="line count mismatch"):
            lineparallel_adapter.build_pair(
                src, tgt, src_code="es", tgt_code="xx",
            )

    def test_empty_sides_dropped_not_misaligned(self, tmp_path):
        src = self._write(tmp_path, "test.es", ["Hola.", "", "Tres."])
        tgt = self._write(tmp_path, "test.xx", ["A.", "B.", "C."])
        pairs = lineparallel_adapter.build_pair(
            src, tgt, src_code="es", tgt_code="xx",
        )
        # Row 2 has an empty source → dropped; rows keep their own partners.
        assert pairs == [("Hola.", "A."), ("Tres.", "C.")]


class TestBuildCorpusFile:
    def _fake_downloads(self, monkeypatch, tmp_path, src_lines, tgt_lines):
        files = {
            "test.src": tmp_path / "up_src.txt",
            "test.tgt": tmp_path / "up_tgt.txt",
        }
        files["test.src"].write_text("\n".join(src_lines) + "\n", "utf-8")
        files["test.tgt"].write_text("\n".join(tgt_lines) + "\n", "utf-8")

        def fake_download(cache_dir, member, *, repo_url, revision):
            return files[member]

        monkeypatch.setattr(
            lineparallel_adapter, "download_split_file", fake_download,
        )

    def test_layout_and_tag_frozen(self, tmp_path, monkeypatch):
        """The built-corpus layout is sha-pinned — this test freezes it."""
        self._fake_downloads(
            monkeypatch, tmp_path, ["Hola.", "Adiós."], ["A.", "B."],
        )
        dest = tmp_path / "out.json"
        lineparallel_adapter.build_corpus_file(
            dest,
            source_lang="spa", target_lang="xxx",
            src_code="src", tgt_code="tgt",
            cache_dir=tmp_path / "cache",
            repo_url="https://github.com/org/repo",
            revision="deadbeef",
            dataset_tag="fam2021",
            file_pattern="test.{lang_code}",
            domain="conv",
        )
        built = json.loads(dest.read_text("utf-8"))
        assert list(built.keys()) == [
            "source_lang", "target_lang", "entry_count", "domain",
            "source_dataset", "entries",
        ]
        assert built["source_dataset"] == "fam2021-test-src_tgt"
        assert built["entry_count"] == 2
        assert built["entries"][0] == {
            "source": "Hola.", "target": "A.", "id": "1",
        }

    def test_expected_size_enforced(self, tmp_path, monkeypatch):
        self._fake_downloads(monkeypatch, tmp_path, ["Hola."], ["A."])
        with pytest.raises(ValueError, match="declares 5"):
            lineparallel_adapter.build_corpus_file(
                tmp_path / "out.json",
                source_lang="spa", target_lang="xxx",
                src_code="src", tgt_code="tgt",
                cache_dir=tmp_path / "cache",
                repo_url="https://github.com/org/repo",
                revision="deadbeef",
                dataset_tag="fam2021",
                file_pattern="test.{lang_code}",
                expected_size=5,
            )

    def test_unpinned_revision_refused(self, tmp_path):
        with pytest.raises(ValueError, match="pinned commit revision"):
            lineparallel_adapter.download_split_file(
                tmp_path / "cache", "test.es",
                repo_url="https://github.com/org/repo", revision="",
            )


# ---------------------------------------------------------------------------
# 1b. Single-file pairing modes (tsv-columns / csv-columns / json-fields)
# ---------------------------------------------------------------------------

class TestSingleMemberResolution:
    def test_src_tgt_placeholders(self):
        m = lineparallel_adapter._resolve_single_member(
            "data/mt-{tgt_code}-test.csv", src_code="ind", tgt_code="abs",
        )
        assert m == "data/mt-abs-test.csv"

    def test_lang_code_refused(self):
        """{lang_code} is ambiguous when both sides live in one file."""
        with pytest.raises(ValueError, match="single-file"):
            lineparallel_adapter._resolve_single_member(
                "test.{lang_code}", src_code="en", tgt_code="yo",
            )


class TestTsvColumns:
    PAIRING = {
        "mode": "tsv-columns",
        "columns": {"en": "English", "yo": "Yoruba"},
    }

    def _write(self, tmp_path, text):
        p = tmp_path / "test.tsv"
        p.write_text(text, encoding="utf-8")
        return p

    def test_pairs_by_header_name(self, tmp_path):
        p = self._write(
            tmp_path, "English\tYoruba\nHello.\tPẹlẹ o.\nGo.\tLọ.\n",
        )
        pairs = lineparallel_adapter.build_pairs_from_columns(
            p, pairing=self.PAIRING, src_code="en", tgt_code="yo",
        )
        assert pairs == [("Hello.", "Pẹlẹ o."), ("Go.", "Lọ.")]

    def test_reverse_direction_same_file(self, tmp_path):
        p = self._write(tmp_path, "English\tYoruba\nHello.\tPẹlẹ o.\n")
        pairs = lineparallel_adapter.build_pairs_from_columns(
            p, pairing=self.PAIRING, src_code="yo", tgt_code="en",
        )
        assert pairs == [("Pẹlẹ o.", "Hello.")]

    def test_missing_header_name_raises(self, tmp_path):
        p = self._write(tmp_path, "english\tyoruba\nHello.\tPẹlẹ o.\n")
        with pytest.raises(ValueError, match="not found in header"):
            lineparallel_adapter.build_pairs_from_columns(
                p, pairing=self.PAIRING, src_code="en", tgt_code="yo",
            )

    def test_short_row_raises(self, tmp_path):
        p = self._write(tmp_path, "English\tYoruba\nHello.\tPẹlẹ o.\nLone.\n")
        with pytest.raises(ValueError, match="not column-parallel"):
            lineparallel_adapter.build_pairs_from_columns(
                p, pairing=self.PAIRING, src_code="en", tgt_code="yo",
            )

    def test_undeclared_code_raises(self, tmp_path):
        p = self._write(tmp_path, "English\tYoruba\nHello.\tPẹlẹ o.\n")
        with pytest.raises(ValueError, match="no entry for upstream code"):
            lineparallel_adapter.build_pairs_from_columns(
                p, pairing=self.PAIRING, src_code="fr", tgt_code="yo",
            )

    def test_integer_index_headerless(self, tmp_path):
        p = self._write(tmp_path, "Hello.\tPẹlẹ o.\n")
        pairing = {
            "mode": "tsv-columns", "hasHeader": False,
            "columns": {"en": 0, "yo": 1},
        }
        pairs = lineparallel_adapter.build_pairs_from_columns(
            p, pairing=pairing, src_code="en", tgt_code="yo",
        )
        assert pairs == [("Hello.", "Pẹlẹ o.")]

    def test_header_name_without_header_raises(self, tmp_path):
        p = self._write(tmp_path, "Hello.\tPẹlẹ o.\n")
        pairing = {**self.PAIRING, "hasHeader": False}
        with pytest.raises(ValueError, match="hasHeader is false"):
            lineparallel_adapter.build_pairs_from_columns(
                p, pairing=pairing, src_code="en", tgt_code="yo",
            )


class TestCsvColumns:
    """csv-columns must honour RFC-4180 quoting — the NusaX/NusaTranslation
    CSVs carry quoted cells with embedded commas and newlines."""

    def test_multiparallel_by_header(self, tmp_path):
        p = tmp_path / "test.csv"
        p.write_text(
            ',indonesian,acehnese,english\n'
            '0,"Dekat, sekali","Toe that","Near, very"\n'
            '1,Baik,Got,Good\n',
            encoding="utf-8",
        )
        pairing = {
            "mode": "csv-columns",
            "columns": {"ind": "indonesian", "ace": "acehnese",
                        "eng": "english"},
        }
        pairs = lineparallel_adapter.build_pairs_from_columns(
            p, pairing=pairing, src_code="ind", tgt_code="ace",
        )
        assert pairs == [("Dekat, sekali", "Toe that"), ("Baik", "Got")]

    def test_embedded_newline_cell(self, tmp_path):
        p = tmp_path / "test.csv"
        p.write_text(
            'id,ind_text,tgt_text\n'
            'a,"Mencoba\nlagi",Coba ulang\n',
            encoding="utf-8",
        )
        pairing = {
            "mode": "csv-columns",
            "columns": {"ind": "ind_text", "abs": "tgt_text"},
        }
        pairs = lineparallel_adapter.build_pairs_from_columns(
            p, pairing=pairing, src_code="ind", tgt_code="abs",
        )
        assert pairs == [("Mencoba\nlagi", "Coba ulang")]

    def test_empty_cell_dropped(self, tmp_path):
        p = tmp_path / "test.csv"
        p.write_text(
            "id,ind_text,tgt_text\na,Halo,\nb,Baik,Got\n", encoding="utf-8",
        )
        pairing = {
            "mode": "csv-columns",
            "columns": {"ind": "ind_text", "abs": "tgt_text"},
        }
        pairs = lineparallel_adapter.build_pairs_from_columns(
            p, pairing=pairing, src_code="ind", tgt_code="abs",
        )
        assert pairs == [("Baik", "Got")]


class TestJsonFields:
    PAIRING = {
        "mode": "json-fields",
        "recordPath": ["[]", "conversation", "[]"],
        "fields": {"en": "en_sentence", "ja": "ja_sentence"},
    }

    def _write(self, tmp_path, obj):
        p = tmp_path / "test.json"
        p.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
        return p

    def test_doc_level_flatten_in_order(self, tmp_path):
        p = self._write(tmp_path, [
            {"id": "d1", "conversation": [
                {"no": 1, "en_sentence": "Hi.", "ja_sentence": "やあ。"},
                {"no": 2, "en_sentence": "Bye.", "ja_sentence": "またね。"},
            ]},
            {"id": "d2", "conversation": [
                {"no": 1, "en_sentence": "Thanks.", "ja_sentence": "どうも。"},
            ]},
        ])
        pairs = lineparallel_adapter.build_pairs_from_json(
            p, pairing=self.PAIRING, src_code="en", tgt_code="ja",
        )
        assert pairs == [("Hi.", "やあ。"), ("Bye.", "またね。"),
                         ("Thanks.", "どうも。")]

    def test_reverse_direction(self, tmp_path):
        p = self._write(tmp_path, [
            {"conversation": [
                {"en_sentence": "Hi.", "ja_sentence": "やあ。"},
            ]},
        ])
        pairs = lineparallel_adapter.build_pairs_from_json(
            p, pairing=self.PAIRING, src_code="ja", tgt_code="en",
        )
        assert pairs == [("やあ。", "Hi.")]

    def test_missing_field_raises(self, tmp_path):
        p = self._write(tmp_path, [
            {"conversation": [{"en_sentence": "Hi."}]},
        ])
        with pytest.raises(ValueError, match="missing declared field"):
            lineparallel_adapter.build_pairs_from_json(
                p, pairing=self.PAIRING, src_code="en", tgt_code="ja",
            )

    def test_record_path_shape_mismatch_raises(self, tmp_path):
        p = self._write(tmp_path, {"conversation": []})
        with pytest.raises(ValueError, match="recordPath"):
            lineparallel_adapter.build_pairs_from_json(
                p, pairing=self.PAIRING, src_code="en", tgt_code="ja",
            )

    def test_missing_record_path_raises(self, tmp_path):
        p = self._write(tmp_path, [])
        with pytest.raises(ValueError, match="recordPath"):
            lineparallel_adapter.build_pairs_from_json(
                p, pairing={"mode": "json-fields",
                            "fields": self.PAIRING["fields"]},
                src_code="en", tgt_code="ja",
            )


class TestBuildCorpusFilePairingModes:
    def test_single_file_mode_end_to_end(self, tmp_path, monkeypatch):
        """The frozen corpus layout + family tag hold for single-file modes."""
        up = tmp_path / "up.tsv"
        up.write_text("English\tYoruba\nHello.\tPẹlẹ o.\n", encoding="utf-8")
        monkeypatch.setattr(
            lineparallel_adapter, "download_split_file",
            lambda cache_dir, member, *, repo_url, revision: up,
        )
        dest = tmp_path / "out.json"
        lineparallel_adapter.build_corpus_file(
            dest,
            source_lang="eng", target_lang="yor",
            src_code="en", tgt_code="yo",
            cache_dir=tmp_path / "cache",
            repo_url="https://github.com/org/repo",
            revision="deadbeef",
            dataset_tag="menyo20k",
            file_pattern="data/test.tsv",
            pairing={"mode": "tsv-columns",
                     "columns": {"en": "English", "yo": "Yoruba"}},
        )
        built = json.loads(dest.read_text("utf-8"))
        assert list(built.keys()) == [
            "source_lang", "target_lang", "entry_count", "domain",
            "source_dataset", "entries",
        ]
        assert built["source_dataset"] == "menyo20k-test-en_yo"
        assert built["entries"] == [
            {"source": "Hello.", "target": "Pẹlẹ o.", "id": "1"},
        ]

    def test_unknown_mode_raises(self, tmp_path):
        with pytest.raises(ValueError, match="Unknown pairing mode"):
            lineparallel_adapter.build_corpus_file(
                tmp_path / "out.json",
                source_lang="eng", target_lang="yor",
                src_code="en", tgt_code="yo",
                cache_dir=tmp_path / "cache",
                repo_url="https://github.com/org/repo",
                revision="deadbeef",
                dataset_tag="fam",
                file_pattern="data/test.tsv",
                pairing={"mode": "xml-chunks"},
            )

    def test_member_escape_hatches_refused_in_single_file_mode(self, tmp_path):
        with pytest.raises(ValueError, match="line-zip"):
            lineparallel_adapter.build_corpus_file(
                tmp_path / "out.json",
                source_lang="eng", target_lang="yor",
                src_code="en", tgt_code="yo",
                cache_dir=tmp_path / "cache",
                repo_url="https://github.com/org/repo",
                revision="deadbeef",
                dataset_tag="fam",
                file_pattern="data/test.tsv",
                pairing={"mode": "tsv-columns",
                         "columns": {"en": 0, "yo": 1}},
                src_member="explicit/path.tsv",
            )


# ---------------------------------------------------------------------------
# 2. corpus_fetch registration
# ---------------------------------------------------------------------------

class TestBuilderRegistration:
    def test_generic_builder_registered(self):
        assert "lineparallel-parallel" in corpus_fetch.REGISTRY_BUILDERS

    def test_legacy_americasnlp_alias(self):
        """Pre-refactor registries pinned americasnlp2021-parallel — the alias
        must keep resolving, and to the SAME implementation."""
        builders = corpus_fetch.REGISTRY_BUILDERS
        assert "americasnlp2021-parallel" in builders
        assert builders["americasnlp2021-parallel"] is builders[
            "lineparallel-parallel"
        ]


# ---------------------------------------------------------------------------
# 3. build_registry transport override
# ---------------------------------------------------------------------------

def _recipe_card(with_builder: bool) -> dict:
    card = {
        "id": "eval-fam2021-test-v1",
        "type": "multiway",
        "name": "Fam 2021 test",
        "version": "1.0",
        "languages": ["spa", "xxx"],
        "description": "synthetic",
        "pairGeneration": {
            "mode": "explicit",
            "segment": "test",
            "direction": "unidirectional",
            "doNotTrain": True,
            "domain": "conv",
            "explicitPairs": [{
                "source": "spa", "target": "xxx",
                "srcCode": "es", "tgtCode": "xx",
                "size": 2, "sha256": "ab" * 32,
            }],
        },
        "download": {
            "method": "github",
            "url": "https://github.com/org/repo",
            "revision": "deadbeef",
            "filePattern": "test.{lang_code}",
            "format": "parallel-text",
        },
        "source": {"publisher": "Org"},
        "license": {"spdx": "CC-BY-4.0"},
    }
    if with_builder:
        card["download"]["builder"] = "lineparallel"
    return card


class TestTransportOverride:
    def test_override_dispatches_generic_and_keeps_family(self, registry_mod):
        entries = registry_mod.expand_multiway_card(_recipe_card(True), {})
        assert len(entries) == 1
        se = entries[0]["source_export"]
        # Transport: the generic builder id.
        assert se["builder"] == "lineparallel-parallel"
        # Family token preserved separately (source_dataset / promotion key).
        assert se["family"] == "fam2021"

    def test_no_override_keeps_legacy_derivation(self, registry_mod):
        entries = registry_mod.expand_multiway_card(_recipe_card(False), {})
        se = entries[0]["source_export"]
        assert se["builder"] == "fam2021-parallel"
        assert "family" not in se

    def test_family_still_keys_held_out_forcing(self, registry_mod):
        """The override must NOT collapse the family token that held-out
        contamination forcing keys off (test split → HIGH)."""
        entries = registry_mod.expand_multiway_card(_recipe_card(True), {})
        # segment 'test' + not freshBlindTestSet → forced HIGH regardless of
        # the card's (absent) contamination block.
        assert entries[0]["contamination"] == "HIGH"

    def test_pairing_rides_source_export(self, registry_mod):
        """download.pairing must reach every expanded pair's source_export
        verbatim — the harness rebuild needs it to pair what the pin build
        paired (part of the sha-pin contract)."""
        card = _recipe_card(True)
        pairing = {
            "mode": "tsv-columns",
            "columns": {"es": "Spanish", "xx": "Xx"},
        }
        card["download"]["pairing"] = pairing
        entries = registry_mod.expand_multiway_card(card, {})
        assert entries[0]["source_export"]["pairing"] == pairing

    def test_no_pairing_keeps_export_shape(self, registry_mod):
        """Cards without download.pairing must expand byte-identically to
        before the extension (no 'pairing' key at all)."""
        entries = registry_mod.expand_multiway_card(_recipe_card(True), {})
        assert "pairing" not in entries[0]["source_export"]
