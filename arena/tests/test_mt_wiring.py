"""MT systems-under-test wiring (red-team R1 follow-up / consumer-reports).

These pin the run-path integration that connects the built MT adapters to
`mt-eval run`: --method resolves a registered MT NAME to config.mt_method (vs a
plugin PATH), and the corpus loader auto-populates the ISO codes the adapters
need. No network — the adapter HTTP calls themselves are covered by
test_mt_methods.py.
"""

from __future__ import annotations

import json

from mt_eval_harness.cli import build_parser, args_to_config
from mt_eval_harness.config import RunConfig
from mt_eval_harness.corpus_loader import load_corpus


def _cfg(*method_args):
    parser = build_parser()
    return args_to_config(parser.parse_args(["run", "--corpus", "x", *method_args]))


class TestMethodResolution:
    def test_registered_name_becomes_mt_method(self):
        cfg = _cfg("--method", "google-translate")
        assert cfg.mt_method == "google-translate"
        assert cfg.method_path is None

    def test_name_is_case_and_space_insensitive(self):
        cfg = _cfg("--method", "  DeepL ")
        assert cfg.mt_method == "deepl"
        assert cfg.method_path is None

    def test_plugin_path_is_not_treated_as_mt(self):
        cfg = _cfg("--method", "./plugins/my-method")
        assert cfg.mt_method == ""
        assert cfg.method_path == "./plugins/my-method"

    def test_no_method_leaves_both_empty(self):
        cfg = _cfg()
        assert cfg.mt_method == ""
        assert cfg.method_path is None


class TestCorpusCodePopulation:
    def _corpus(self, tmp_path):
        p = tmp_path / "c.json"
        p.write_text(json.dumps({
            "language_pair": {"source": "eng", "target": "fra"},
            "entries": [{"id": "1", "source": "hello", "reference": "bonjour"}],
        }), encoding="utf-8")
        return str(p)

    def test_iso_codes_populated_from_language_pair(self, tmp_path):
        cfg = RunConfig(corpus_path=self._corpus(tmp_path))
        load_corpus(cfg)
        assert cfg.source_code == "eng"
        assert cfg.target_code == "fra"

    def test_explicit_codes_are_not_overridden(self, tmp_path):
        # --source-code/--target-code (or any pre-set codes) win over the corpus.
        cfg = RunConfig(corpus_path=self._corpus(tmp_path), source_code="en", target_code="fr")
        load_corpus(cfg)
        assert cfg.source_code == "en"
        assert cfg.target_code == "fr"


class TestLangPairStringForm:
    """The public registering-corpora docs show language_pair as a compact
    string ("eng-crk"). The loader used to crash on it with a bare dict()
    constructor traceback (organizer-simulation finding, 2026-07-12)."""

    def _corpus(self, tmp_path, lang_pair):
        p = tmp_path / "c.json"
        p.write_text(json.dumps({
            "dataset": {"language_pair": lang_pair},
            "entries": [{"id": "1", "source": "hello", "reference": "bonjour"}],
        }), encoding="utf-8")
        return str(p)

    def test_compact_string_pair_is_parsed(self, tmp_path):
        cfg = RunConfig(corpus_path=self._corpus(tmp_path, "eng-fra"))
        load_corpus(cfg)
        assert cfg.source_code == "eng"
        assert cfg.target_code == "fra"

    def test_colon_and_arrow_separators_accepted(self, tmp_path):
        for pair in ("eng:fra", "eng>fra"):
            cfg = RunConfig(corpus_path=self._corpus(tmp_path, pair))
            load_corpus(cfg)
            assert (cfg.source_code, cfg.target_code) == ("eng", "fra")

    def test_top_level_string_pair_is_parsed(self, tmp_path):
        p = tmp_path / "t.json"
        p.write_text(json.dumps({
            "language_pair": "dan-fao",
            "entries": [{"id": "1", "source": "hej", "reference": "hey"}],
        }), encoding="utf-8")
        cfg = RunConfig(corpus_path=str(p))
        load_corpus(cfg)
        assert cfg.source_code == "dan"
        assert cfg.target_code == "fao"

    def test_garbage_pair_fails_with_named_error(self, tmp_path):
        import pytest
        cfg = RunConfig(corpus_path=self._corpus(tmp_path, "not a pair at all"))
        with pytest.raises(ValueError, match="language_pair"):
            load_corpus(cfg)
