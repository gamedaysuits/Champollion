#!/usr/bin/env python3
"""Tests for the corpus-content gate (scripts/corpus_content_scan.py +
scripts/quarantine_gate.sh).

The load-bearing proof: a tracked corpus-content file of
ANY license — including CC-BY — trips the gate and exits non-zero. The old gate
only blocked NC/named-restricted content in a four-directory subset, which is
how 44 CC-BY Tatoeba files slipped in. These tests pin the new license-agnostic,
whole-tree behaviour so it cannot silently regress.

Run standalone:        python3 scripts/tests/test_corpus_content_scan.py
Run under pytest:       python3 -m pytest scripts/tests/
"""
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # scripts/tests/ -> repo root
SCAN = ROOT / "scripts" / "corpus_content_scan.py"
GATE = ROOT / "scripts" / "quarantine_gate.sh"
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "corpus_content"
CC_BY_FIXTURE = FIXTURES / "cc_by_pairs.json"
# Planted fixtures, one per format the OLD gate missed because the corpus was
# split across files (monolingual sources + translations-only results) or used a
# non-source/target key shape. Each MUST be detected as content.
NESTED_TRANSLATION = FIXTURES / "nested_translation.json"
PARALLEL_ARRAYS = FIXTURES / "parallel_arrays.json"
MONOLINGUAL_RECORDS = FIXTURES / "monolingual_records.json"
TRANSLATIONS_DUMP = FIXTURES / "translations_dump.json"
PARALLEL_TSV = FIXTURES / "parallel.tsv"
PARALLEL_CSV = FIXTURES / "parallel_columns.csv"

_spec = importlib.util.spec_from_file_location("ccscan", SCAN)
ccscan = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ccscan)


def _write(path: Path, obj) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


class TestDetector(unittest.TestCase):
    """Unit-level: the detector is license-agnostic and avoids false positives."""

    def test_cc_by_content_is_detected(self):
        # The crux: a CC-BY-licensed parallel-pair file IS corpus content.
        self.assertIn("CC-BY", CC_BY_FIXTURE.read_text(encoding="utf-8"))
        reason = ccscan.classify(CC_BY_FIXTURE)
        self.assertTrue(reason, "CC-BY parallel pairs must be detected as content")

    def test_cc0_and_proprietary_content_also_detected(self):
        with tempfile.TemporaryDirectory() as d:
            for lic in ("CC0-1.0", "Proprietary", "Public-Domain"):
                f = _write(Path(d) / f"corpus_{lic}.json", {
                    "license": lic,
                    "entries": [{"source": f"sentence number {i} here",
                                 "target": f"oración número {i} aquí"} for i in range(8)],
                })
                self.assertTrue(ccscan.classify(f), f"{lic} content must be detected")

    def test_langcode_manifest_not_flagged(self):
        # pairGeneration.explicitPairs: source/target are language CODES + sha —
        # a pinning manifest, not translation text. Must NOT be flagged.
        with tempfile.TemporaryDirectory() as d:
            f = _write(Path(d) / "eval-smol-sent-v1.json", {
                "id": "eval-smol-sent-v1", "type": "eval",
                "languages": ["aar", "eng", "spa"],
                "pairGeneration": {"mode": "explicit", "explicitPairs": [
                    {"source": "aar", "target": "eng", "srcCode": "aa",
                     "tgtCode": "en", "size": 863, "sha256": "deadbeef" * 8},
                    {"source": "abq", "target": "rus", "srcCode": "abq",
                     "tgtCode": "ru", "size": 863, "sha256": "deadbeef" * 8},
                    {"source": "ach", "target": "eng", "srcCode": "ach",
                     "tgtCode": "en", "size": 500, "sha256": "deadbeef" * 8},
                    {"source": "afr", "target": "eng", "srcCode": "afr",
                     "tgtCode": "en", "size": 700, "sha256": "deadbeef" * 8},
                ]},
            })
            self.assertIsNone(ccscan.classify(f),
                              "language-code pinning manifest must not be flagged")

    def test_pure_metadata_card_not_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            f = _write(Path(d) / "card.json", {
                "id": "eval-spa-que-tatoeba-dev-v1", "type": "eval",
                "pair": {"source": "spa", "target": "que"},
                "source": {"publisher": "Tatoeba", "url": "https://tatoeba.org"},
                "license": {"spdx": "CC-BY-2.0"},
                "segments": [{"id": "dev", "name": "Dev", "size": 95}],
            })
            self.assertIsNone(ccscan.classify(f),
                              "metadata card with no pairs must not be flagged")

    def test_scores_only_summary_not_flagged(self):
        # leaderboard_data.json shape: model + metrics, no source/target text.
        with tempfile.TemporaryDirectory() as d:
            f = _write(Path(d) / "leaderboard.json", [
                {"model_slug": "m", "exact_match_rate": 41.9, "chrf_plus_plus": 57.7}
                for _ in range(20)
            ])
            self.assertIsNone(ccscan.classify(f),
                              "scores-only leaderboard summary must not be flagged")


class TestWidenedShapes(unittest.TestCase):
    """The formats the OLD gate missed — split corpora and non-source/target
    key shapes. Each is the concrete shape that let 21.9MB of FLORES content
    sit tracked under cli/test/benchmark/ undetected. These pin the fix."""

    def test_nested_translation_object_detected(self):
        # {"translation": {"en": ..., "fr": ...}} — HuggingFace/OPUS/WMT shape,
        # ANY language codes (no declared source/target field).
        self.assertTrue(ccscan.classify(NESTED_TRANSLATION),
                        "nested {'translation': {iso: text}} must be detected")

    def test_parallel_language_arrays_detected(self):
        # {"en": [...], "fr": [...]} — two language-code-named prose lists.
        self.assertTrue(ccscan.classify(PARALLEL_ARRAYS),
                        "parallel language arrays must be detected")

    def test_monolingual_record_list_detected(self):
        # [{"id": "0", "text": "<sentence>"}] — the FLORES per-language fixture
        # half of a split corpus (only one side present).
        self.assertTrue(ccscan.classify(MONOLINGUAL_RECORDS),
                        "monolingual split-corpus record list must be detected")

    def test_indexed_translations_dump_detected(self):
        # {"translations": {"0": "<sentence>"}} — the per-model result half.
        self.assertTrue(ccscan.classify(TRANSLATIONS_DUMP),
                        "indexed translations dump must be detected")

    def test_headerless_tsv_detected(self):
        # Two tab-separated prose columns, no header (OPUS/Moses/Tatoeba TSV).
        self.assertTrue(ccscan.classify(PARALLEL_TSV),
                        "headerless parallel TSV must be detected")

    def test_csv_source_target_header_detected(self):
        self.assertTrue(ccscan.classify(PARALLEL_CSV),
                        "CSV with source/target headers must be detected")

    def test_langcode_delimited_columns_detected(self):
        # Header naming two-or-more language columns (en\tfr\tde).
        with tempfile.TemporaryDirectory() as d:
            rows = ["en\tfr\tde"] + [
                f"The number is {i} today.\tLe nombre est {i} aujourd'hui."
                f"\tDie Zahl ist heute {i}." for i in range(6)
            ]
            f = Path(d) / "triple.tsv"
            f.write_text("\n".join(rows) + "\n", encoding="utf-8")
            self.assertTrue(ccscan.classify(f),
                            "language-code-named columns must be detected")

    def test_real_flores_fixture_shape_detected(self):
        # Reproduce the exact leaked shape end to end: a monolingual {id,text}
        # list AND a {"translations": {idx: text}} dump both trip.
        with tempfile.TemporaryDirectory() as d:
            src = _write(Path(d) / "flores-devtest.en.json", [
                {"id": str(i), "text": f"This is sentence number {i} in the set."}
                for i in range(8)
            ])
            res = _write(Path(d) / "register" / "fr.json", {
                "model": "x", "language": "fr",
                "translations": {str(i): f"Ceci est la phrase numéro {i}."
                                 for i in range(8)},
            })
            self.assertTrue(ccscan.classify(src), "FLORES source half must trip")
            self.assertTrue(ccscan.classify(res), "FLORES result half must trip")

    # --- false-positive regressions: metadata that LOOKS textual but isn't ---

    def test_provenance_source_field_not_flagged(self):
        # registry datasets[].source / card experts[].source carry a PROVENANCE
        # string ("Meta AI (NLLB Team)", "resources.fsts[…]"), not a corpus
        # segment. A bare `source` on a metadata record must not trip the
        # monolingual detector.
        with tempfile.TemporaryDirectory() as d:
            f = _write(Path(d) / "registry.json", {"datasets": [
                {"id": f"eval-x-{i}", "name": f"Some Dataset Number {i} Here",
                 "language_pair": {"source": "ben", "target": "eng"},
                 "source": "NICT (National Institute of Information and "
                           "Communications Technology)"}
                for i in range(12)
            ]})
            self.assertIsNone(ccscan.classify(f),
                              "provenance `source` field must not be flagged")

    def test_locale_pathmap_not_flagged(self):
        # sites.json shape: {"locales": {"en": "/iphone/", "fr": "/fr/iphone/"}}
        # — language-keyed URL PATHS, not sentences.
        with tempfile.TemporaryDirectory() as d:
            f = _write(Path(d) / "sites.json", [
                {"id": f"site-{i}", "domain": "example.com",
                 "locales": {"en": f"/product-{i}/", "fr": f"/fr/product-{i}/",
                             "de": f"/de/product-{i}/", "ja": f"/jp/product-{i}/"}}
                for i in range(10)
            ])
            self.assertIsNone(ccscan.classify(f),
                              "language-keyed URL paths must not be flagged")

    def test_i18n_message_catalogue_not_flagged(self):
        # Docusaurus/i18n code.json: dotted message ids -> translated strings.
        # Keys are NOT indices/langcodes, so the indexed-map detector skips it.
        with tempfile.TemporaryDirectory() as d:
            f = _write(Path(d) / "code.json", {
                f"theme.component.Action{i}": f"Please confirm your action now {i}."
                for i in range(20)
            })
            self.assertIsNone(ccscan.classify(f),
                              "i18n message catalogue must not be flagged")

    def test_cjk_monolingual_still_detected(self):
        # Space-less scripts (Chinese/Japanese/Thai) carry real sentences with no
        # ASCII spaces — must still trip (the slug/path guard must not exclude
        # them). Mirrors the zh/ja/th FLORES fixtures.
        with tempfile.TemporaryDirectory() as d:
            f = _write(Path(d) / "flores-devtest.zh.json", [
                {"id": str(i), "text": "我们现在有不再是糖尿病的四个月大的老鼠了。"}
                for i in range(8)
            ])
            self.assertTrue(ccscan.classify(f),
                            "space-less CJK monolingual corpus must be detected")


# Realistic sentence-level parallel content (eng->crk, the flagship pair). Reused
# by the meta-audit regressions below; each must be DETECTED however it is dressed.
_PAIRS = [
    ("The dog is running fast across the open field.", "atim mistahi-pimipahtâw."),
    ("She gave the small child fresh water to drink.", "miyêw awâsisa nipiy ka-minihkwêt."),
    ("We will go hunting when the deep snow melts.", "nika-nôcihcikânân ispî kôna tihkitêki."),
    ("The old man told a very long story last night.", "kisêyiniw kinwês âcimow tipiskohk."),
    ("My grandmother is cooking warm soup for us.", "nôhkom kîsisam napwêwin kahkiyaw."),
    ("The wide river is frozen solid this morning.", "sîpiy âhkwatin kîkisêpâ nôhtâwiy."),
    ("They are singing a beautiful old song now.", "nikamowak miywâsin nikamowin mâmawi."),
    ("The children played outside all afternoon long.", "awâsisak mêtawêwak wayawîtimihk kapê."),
    ("He carved a small canoe from the white birch.", "môsawâcihêw apisci-cîmân waskwayâhtik ohci."),
    ("The ripe berries grow near the cold lake now.", "mînisa tipwêwak sâkahikanihk cîki êkwa."),
]


class TestMetaAuditRegressions(unittest.TestCase):
    """Pins the 2026-07-18 gate meta-audit fixes. Each `*_detected` was a smuggling
    hole that evaded the pre-audit detector; each `*_not_flagged` is a real-tree
    false positive the fix had to avoid (documented in
    docs/GATE_TEST_META_AUDIT_2026-07-18.md)."""

    def _w(self, d, name, text):
        p = Path(d) / name
        p.write_text(text, encoding="utf-8")
        return p

    # --- A: file types the old detector never opened -----------------------
    def test_tmx_translation_memory_detected(self):
        with tempfile.TemporaryDirectory() as d:
            body = "\n".join(
                f'<tu><tuv xml:lang="en"><seg>{s}</seg></tuv>'
                f'<tuv xml:lang="crk"><seg>{t}</seg></tuv></tu>' for s, t in _PAIRS)
            for ext in ("tmx", "xml"):
                f = self._w(d, f"corpus.{ext}", f"<tmx><body>{body}</body></tmx>")
                self.assertTrue(ccscan.classify(f), f".{ext} TMX must be detected")

    def test_xliff_source_target_detected(self):
        with tempfile.TemporaryDirectory() as d:
            body = "\n".join(f"<trans-unit><source>{s}</source>"
                             f"<target>{t}</target></trans-unit>" for s, t in _PAIRS)
            f = self._w(d, "corpus.xml", f"<xliff>{body}</xliff>")
            self.assertTrue(ccscan.classify(f), "XLIFF source/target must be detected")

    def test_gettext_po_sentence_pairs_detected(self):
        with tempfile.TemporaryDirectory() as d:
            po = "".join(f'msgid "{s}"\nmsgstr "{t}"\n\n' for s, t in _PAIRS)
            f = self._w(d, "corpus.po", po)
            self.assertTrue(ccscan.classify(f), "PO bilingual sentence pairs must be detected")

    def test_moses_langcode_extension_detected(self):
        # A bilingual TSV mis-extensioned as corpus.en (Moses/OPUS on-disk shape).
        with tempfile.TemporaryDirectory() as d:
            f = self._w(d, "train.en", "\n".join(f"{s}\t{t}" for s, t in _PAIRS))
            self.assertTrue(ccscan.classify(f), "langcode-extension parallel must be detected")

    def test_yaml_pairs_detected(self):
        with tempfile.TemporaryDirectory() as d:
            y = "pairs:\n" + "".join(f'  - en: "{s}"\n    crk: "{t}"\n' for s, t in _PAIRS)
            f = self._w(d, "corpus.yaml", y)
            self.assertTrue(ccscan.classify(f), "YAML pairs list must be detected")

    # --- B: encoded / compressed ------------------------------------------
    def test_base64_corpus_in_json_detected(self):
        # base64 fires ONLY because the decoded payload really is a corpus.
        import base64
        with tempfile.TemporaryDirectory() as d:
            blob = base64.b64encode(
                json.dumps([{"source": s, "target": t} for s, t in _PAIRS]).encode()
            ).decode()
            f = self._w(d, "b64.json", json.dumps({"payload": blob}))
            self.assertTrue(ccscan.classify(f), "base64-encoded corpus must be detected")

    def test_base64_noncorpus_not_flagged(self):
        # A long base64 blob whose payload is NOT a corpus must not trip.
        import base64
        with tempfile.TemporaryDirectory() as d:
            blob = base64.b64encode(b"\x00\x01\x02" * 4000).decode()
            f = self._w(d, "asset.json", json.dumps({"icon": blob}))
            self.assertIsNone(ccscan.classify(f), "non-corpus base64 must not be flagged")

    def test_compressed_data_blob_flagged_by_extension(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "corpus.json.gz"
            f.write_bytes(b"\x1f\x8b\x08\x00nonsense-but-a-data-blob")
            self.assertTrue(ccscan.classify(f), "compressed data blob must be flagged")

    # --- C: content hidden inside a scanned JSON --------------------------
    def test_embedded_tab_blob_detected(self):
        with tempfile.TemporaryDirectory() as d:
            f = self._w(d, "blob.json",
                        json.dumps({"data": "\n".join(f"{s}\t{t}" for s, t in _PAIRS)}))
            self.assertTrue(ccscan.classify(f), "embedded TSV blob string must be detected")

    def test_doc_arrow_list_string_not_flagged(self):
        # The tm.json regression: a translated documentation block using "X → Y"
        # for "provides" is NOT a parallel corpus (arrow dropped for embedded strings).
        with tempfile.TemporaryDirectory() as d:
            block = "\n".join(f"{i}. **ISO 639-3-Register** → `code`, `name`, `isoScope`"
                              for i in range(12))
            f = self._w(d, "tm.json", json.dumps({"h": {"t": block}}))
            self.assertIsNone(ccscan.classify(f), "doc arrow-list must not be flagged")

    def test_json_array_of_delimited_strings_detected(self):
        with tempfile.TemporaryDirectory() as d:
            f = self._w(d, "arr.json",
                        json.dumps([f"{s} ||| {t}" for s, t in _PAIRS]))
            self.assertTrue(ccscan.classify(f), "array of 'src ||| tgt' must be detected")

    def test_filename_list_not_flagged(self):
        # migration-report.json regression: a list of filenames / identifier
        # mappings is not sentence-prose parallel content.
        with tempfile.TemporaryDirectory() as d:
            f = self._w(d, "report.json", json.dumps(
                {"deleted": [f"{c}.json" for c in "abcdefghij"],
                 "renamed": [f"oldKey{i} → newKey{i}" for i in range(10)]}))
            self.assertIsNone(ccscan.classify(f), "filename/identifier list must not be flagged")

    # --- E: unusual pair shapes / dilution --------------------------------
    def test_flat_langcode_row_with_junk_key_detected(self):
        with tempfile.TemporaryDirectory() as d:
            f = self._w(d, "e1.json", json.dumps(
                [{"idx": i, "split": "train", "en": s, "crk": t}
                 for i, (s, t) in enumerate(_PAIRS)]))
            self.assertTrue(ccscan.classify(f), "{idx,split,en,crk} rows must be detected")

    def test_nested_translation_obj_with_junk_key_detected(self):
        with tempfile.TemporaryDirectory() as d:
            f = self._w(d, "e2.json", json.dumps(
                [{"translation": {"en": s, "crk": t, "domain": "news"}} for s, t in _PAIRS]))
            self.assertTrue(ccscan.classify(f), "polluted translation object must be detected")

    def test_decoy_prefix_dilution_detected(self):
        # 300 filler dicts BEFORE the pairs — stride sampling must still find them.
        with tempfile.TemporaryDirectory() as d:
            decoys = [{"note": f"filler {i}"} for i in range(300)]
            real = [{"source": s, "target": t} for s, t in _PAIRS] * 30
            f = self._w(d, "e3.json", json.dumps(decoys + real))
            self.assertTrue(ccscan.classify(f), "decoy-prefixed corpus must be detected")

    def test_minority_pairs_dilution_detected(self):
        # 4 real pairs kept a MINORITY (below the old 50% majority) — abs trigger.
        with tempfile.TemporaryDirectory() as d:
            f = self._w(d, "e4.json", json.dumps(
                [{"source": s, "target": t} for s, t in _PAIRS[:4]]
                + [{"k": i} for i in range(5)]))
            self.assertTrue(ccscan.classify(f), "minority-ratio pairs must be detected")

    def test_langcode_named_code_table_not_flagged(self):
        # A .tab metadata table whose column NAMES look like langcodes ("id",
        # "ref_name") but whose DATA is codes/short names — not prose. (iso-639-3.tab.)
        with tempfile.TemporaryDirectory() as d:
            rows = ["id\tref_name\tscope"] + [f"a{i:02d}\tGhotuo\tI" for i in range(20)]
            f = self._w(d, "iso.tab", "\n".join(rows))
            self.assertIsNone(ccscan.classify(f), "langcode-named code table must not be flagged")

    # --- allowlist: size cap + directory anchoring ------------------------
    def test_allowlist_size_cap_and_anchoring(self):
        big = 128 * 1024
        # A real (large) corpus dropped DIRECTLY in a synthetic-fixture dir → not exempt.
        self.assertFalse(ccscan._is_allowlisted(
            "arena/tests/fixtures/contest_synthetic/edtekla_full.json", big),
            "oversize file in a fixture dir must not be allowlisted")
        # A corpus NESTED under the fixture dir → not exempt (fnmatch '*'-crosses-'/' fix).
        self.assertFalse(ccscan._is_allowlisted(
            "arena/tests/fixtures/contest_synthetic/deep/nested/flores.json", 500),
            "nested file under a fixture dir must not be allowlisted")
        # A tiny genuine fixture directly in the dir → still exempt.
        self.assertTrue(ccscan._is_allowlisted(
            "arena/tests/fixtures/contest_synthetic/corpus_dev.json", 1000),
            "small direct-child fixture must stay allowlisted")


def _git(args, cwd):
    env = dict(os.environ, GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_SYSTEM=os.devnull)
    return subprocess.run(["git", *args], cwd=cwd, env=env,
                          capture_output=True, text=True)


class TestGateEndToEnd(unittest.TestCase):
    """Integration: run the real quarantine_gate.sh against a throwaway repo."""

    def _new_repo(self, tmp: Path):
        _git(["init", "-q"], tmp)
        (tmp / "scripts").mkdir(parents=True, exist_ok=True)
        shutil.copy2(SCAN, tmp / "scripts" / "corpus_content_scan.py")
        shutil.copy2(GATE, tmp / "scripts" / "quarantine_gate.sh")

    def _run_gate(self, tmp: Path):
        env = dict(os.environ, GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_SYSTEM=os.devnull)
        return subprocess.run(["bash", "scripts/quarantine_gate.sh"], cwd=tmp,
                              env=env, capture_output=True, text=True)

    def test_tracked_cc_by_content_trips_the_gate(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            self._new_repo(tmp)
            # CC-BY content at a NON-allowlisted path -> must be blocked.
            shutil.copy2(CC_BY_FIXTURE, tmp / "data_corpus.json")
            _git(["add", "-A"], tmp)
            res = self._run_gate(tmp)
            self.assertNotEqual(res.returncode, 0,
                                "gate must exit non-zero on tracked CC-BY content\n"
                                f"STDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            out = (res.stdout + res.stderr).lower()
            self.assertIn("data_corpus.json", out)
            self.assertIn("corpus content", out)

    def test_clean_tree_passes(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            self._new_repo(tmp)
            # Only a pure metadata card — no pairs.
            _write(tmp / "cards" / "card.json", {
                "id": "eval-x-y-dev-v1", "type": "eval",
                "pair": {"source": "eng", "target": "spa"},
                "license": {"spdx": "CC-BY-4.0"},
            })
            _git(["add", "-A"], tmp)
            res = self._run_gate(tmp)
            self.assertEqual(res.returncode, 0,
                             "clean tree (metadata only) must pass\n"
                             f"STDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")

    def test_oversize_corpus_in_fixture_dir_is_blocked(self):
        # Meta-audit: a real corpus dropped inside a synthetic-fixture dir must NOT
        # ride the allowlist (size cap + direct-child anchoring), through the gate.
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            self._new_repo(tmp)
            big = [{"source": f"This is english sentence number {i} here.",
                    "target": f"Ceci est la phrase francaise numero {i}."}
                   for i in range(600)]
            _write(tmp / "arena/tests/fixtures/contest_synthetic/flores_full.json", big)
            _git(["add", "-A"], tmp)
            res = self._run_gate(tmp)
            self.assertNotEqual(res.returncode, 0,
                                "oversize corpus in a fixture dir must be blocked\n"
                                f"STDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            self.assertIn("flores_full.json", (res.stdout + res.stderr))

    def test_restricted_name_under_fake_lane_is_blocked(self):
        # Meta-audit: the NAMED check's lane exemptions are ANCHORED — a restricted
        # filename cannot hide under a fabricated "evil/language-cards/…" path.
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            self._new_repo(tmp)
            # Non-pair-shaped (so ONLY the NAMED check can catch it), restricted name,
            # under a fake language-cards/ dir that the old substring exemption cleared.
            _write(tmp / "evil/language-cards/wolvengrey_lemmas.json",
                   {"meta": "not pair shaped", "count": 5})
            _git(["add", "-A"], tmp)
            res = self._run_gate(tmp)
            self.assertNotEqual(res.returncode, 0,
                                "restricted name under a fake lane must be blocked\n"
                                f"STDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
            self.assertIn("wolvengrey", (res.stdout + res.stderr).lower())


class TestDerivedNamePattern(unittest.TestCase):
    """The NAMED backstop must track the registry, not a hand-written list.

    It was crk-family only (edtekla|wolvengrey|itwewina|…) while the registry
    carried 32 corpus families. A dump named for any of the other 31 — flores,
    wmt22, nusatranslation, gamayun, mafand, tico19 — was invisible to it. The
    pattern is now generated by scripts/gen_restricted_name_pattern.py, and
    these tests are what turn "the list fell behind the data" from a silent
    hole into a failure.
    """

    PATTERN_FILE = ROOT / "scripts" / "restricted_name_pattern.txt"
    GENERATOR = ROOT / "scripts" / "gen_restricted_name_pattern.py"
    GATE_SH = ROOT / "scripts" / "quarantine_gate.sh"

    @classmethod
    def setUpClass(cls):
        # Import NAME_EXTS / NAME_EXEMPT from the generator rather than
        # restating them. A third hand-copy is how these drift: the generator
        # certifies a pattern against one exemption set while the gate enforces
        # against another, and the "no tracked file is flagged" proof becomes
        # a proof about a surface nobody uses.
        spec = importlib.util.spec_from_file_location("genpat", cls.GENERATOR)
        cls.gen = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.gen)
        cls.NAME_EXTS = cls.gen.NAME_EXTS
        cls.NAME_EXEMPT = cls.gen.NAME_EXEMPT

    def test_generator_constants_match_the_gate(self):
        """The Python and shell copies of the two literals must be identical.

        They live in different languages and cannot share a file, so this is
        the seam that keeps them honest.
        """
        sh = self.GATE_SH.read_text(encoding="utf-8")
        for name, value in (("NAME_EXTS", self.gen.NAME_EXTS),
                            ("NAME_EXEMPT", self.gen.NAME_EXEMPT)):
            with self.subTest(constant=name):
                self.assertIn(f"{name}='{value}'", sh,
                              f"{name} has drifted between "
                              "gen_restricted_name_pattern.py and quarantine_gate.sh")

    def _pattern(self):
        for line in self.PATTERN_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.startswith("#"):
                return line.strip()
        self.fail("no pattern line in restricted_name_pattern.txt")

    def _matches(self, path):
        """Mirrors the gate: extension pass, then name pass (see quarantine_gate.sh)."""
        ext = re.compile(f"\\.({self.NAME_EXTS})$", re.IGNORECASE)
        name = re.compile(self._pattern(), re.IGNORECASE)
        return bool(ext.search(path) and name.search(path))

    def test_pattern_file_is_current(self):
        """Regenerating must be a no-op — otherwise the gate enforces stale terms."""
        r = subprocess.run([sys.executable, str(self.GENERATOR), "--check"],
                           cwd=ROOT, capture_output=True, text=True, timeout=300)
        self.assertEqual(r.returncode, 0,
                         "restricted_name_pattern.txt is stale; regenerate with "
                         "python3 scripts/gen_restricted_name_pattern.py\n" + r.stderr)

    def test_every_registry_family_is_covered_or_documented(self):
        """No family may fall outside BOTH the pattern and the exclusion note."""
        gen = self.gen
        text = self.PATTERN_FILE.read_text(encoding="utf-8")
        pattern = self._pattern()
        uncovered = []
        for fam in gen.registry_families():
            in_pattern = gen.bounded(fam) in pattern
            documented = f"#   {fam}:" in text
            if not (in_pattern or documented):
                uncovered.append(fam)
        self.assertEqual(uncovered, [],
                         "registry corpus families are neither matched by the "
                         "NAMED pattern nor recorded as excluded: "
                         f"{uncovered}. Regenerate the pattern.")

    def test_non_crk_restricted_dumps_are_caught(self):
        """The regression this whole change exists for."""
        for path in ("data/nusatranslation_dump.tsv",
                     "corpora/wmt22_test.tsv",
                     "x/gamayun-pairs.json",
                     "evil/mafand_dev.csv",
                     "somewhere/americasnlp2021.jsonl"):
            with self.subTest(path=path):
                self.assertTrue(self._matches(path),
                                f"a dump named for a registry family slipped past: {path}")

    def test_curated_crk_terms_survive_regeneration(self):
        """The originals guard assets that are not registry ids and never will be."""
        for path in ("x/edtekla_dev.tsv", "y/wolvengrey_lemmas.json",
                     "z/raw_harvest.json", "q/eng-crk-dev.txt",
                     "s/held-out.tsv", "t/crk-master.csv"):
            with self.subTest(path=path):
                self.assertTrue(self._matches(path))

    def test_no_false_positives_on_lookalikes(self):
        """Word boundaries: 'alt' must not match inside "default", etc.

        A gate that flags ordinary files gets bypassed, and a bypassed gate
        protects nothing — so false positives are a sovereignty risk, not just
        an annoyance.
        """
        for path in ("cli/website/src/data/default.json",
                     "cli/data/altnames.json",
                     "cli/shared/smollm-config.json",
                     "arena/datasets/prizewinners_readme.txt",
                     "cli/shared/explainers/glossary.json"):
            with self.subTest(path=path):
                self.assertFalse(self._matches(path),
                                 f"false positive on a legitimate path: {path}")

    def test_pattern_matches_no_currently_tracked_file(self):
        """Ground truth: the derived pattern must be clean against the real tree."""
        r = subprocess.run(["git", "ls-files"], cwd=ROOT,
                           capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0)
        exempt = re.compile(self.NAME_EXEMPT)
        hits = [p for p in r.stdout.splitlines()
                if p and not exempt.search(p) and self._matches(p)]
        self.assertEqual(hits, [],
                         "the NAMED pattern flags tracked files — either they are "
                         "restricted content that must be untracked, or the "
                         "generator must exclude the colliding term: " + str(hits[:5]))


class TestOversizedFilesAreFlagged(unittest.TestCase):
    """Being too large to inspect must not buy immunity.

    classify() used to `return None` for anything over MAX_PARSE_BYTES — an
    unconditional silent pass that contradicted the constant's own docstring.
    Combined with the NAMED check being a narrow, crk-family filename list, an
    oversized corpus dump under an innocuous name cleared every layer of the
    gate: content (too big to parse), name (not on the list), harvest (not a
    harvest file). The one property that should raise suspicion granted a pass.

    The rule is size-alone, not name-based: the repo hosts no corpus content by
    doctrine, so a tracked data-extension file of this size is a smuggling
    vector whatever it is called. Genuine large reference files are allowlisted
    by name with their size pinned.
    """

    def _oversized(self, tmp: Path, name: str) -> Path:
        p = tmp / name
        p.parent.mkdir(parents=True, exist_ok=True)
        # Just over the ceiling, and deliberately NOT pair-shaped: the content
        # classifier must have nothing to find, so only the size rule can fire.
        filler = json.dumps({"note": "x" * 96})
        chunk = ",".join([filler] * 8192)
        with p.open("w", encoding="utf-8") as fh:
            fh.write("[")
            written = 0
            while written < ccscan.MAX_PARSE_BYTES + (1 << 20):
                fh.write(chunk)
                fh.write(",")
                written += len(chunk) + 1
            fh.write(filler)
            fh.write("]")
        self.assertGreater(p.stat().st_size, ccscan.MAX_PARSE_BYTES)
        return p

    def test_innocuously_named_oversized_json_is_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            p = self._oversized(Path(d), "release_notes_bundle.json")
            reason = ccscan.classify(p)
            self.assertTrue(
                reason,
                "an oversized tracked data file must be flagged, not skipped")
            self.assertIn("too large to parse", reason)

    def test_oversized_tsv_is_flagged_too(self):
        """The rule keys on the data extension, not on .json specifically."""
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "big.tsv"
            with p.open("w", encoding="utf-8") as fh:
                row = "col_a\tcol_b\n"
                written = 0
                while written < ccscan.MAX_PARSE_BYTES + (1 << 20):
                    fh.write(row * 4096)
                    written += len(row) * 4096
            self.assertTrue(ccscan.classify(p))

    def test_size_rule_does_not_touch_non_data_extensions(self):
        """A large .md or .js is not a corpus claim — no false positive."""
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "huge.md"
            p.write_text("# heading\n\nprose paragraph.\n" * 8, encoding="utf-8")
            self.assertIsNone(ccscan.classify(p))

    def test_allowlist_still_overrides(self):
        """The escape hatch survives: allowlisting is by path, and classify()'s
        reason is what the allowlist is consulted against."""
        self.assertTrue(callable(ccscan._is_allowlisted))
        for rel in ccscan.ALLOWLIST_EXACT:
            with self.subTest(rel=rel):
                self.assertTrue(ccscan._is_allowlisted(rel))


if __name__ == "__main__":
    unittest.main(verbosity=2)
