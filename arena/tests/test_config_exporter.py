"""
Tests for config_exporter — mt-eval export-config.

The regression these tests guard: TestReport JSONs store the composite
score at overall.confidence_intervals.composite_score.score, never at
overall.composite_score, and store no quality_tier at all. The exporter
used to read the top-level keys and so always emitted null for both.
"""

import json

import pytest

from mt_eval_harness.config_exporter import (
    _CLI_METHODS,
    _MT_METHOD_TO_CLI_FALLBACK,
    _mt_method_to_cli_map,
    _resolve_default_method,
    _extract_composite_score,
    export_champollion_config,
)
from mt_eval_harness.method_manifest import manifest_entries
from mt_eval_harness.scoring import classify_quality_tier


def make_report(overall: dict, config_extra: dict | None = None) -> dict:
    """A minimal TestReport with the given `overall` block."""
    config = {
        "model": "claude-sonnet-4-6",
        "temperature": 0.3,
        "batch_size": 25,
        "target_lang": "Plains Cree",
    }
    if config_extra:
        config.update(config_extra)
    return {
        "config": config,
        "overall": overall,
        "timestamp": "2026-06-11T00:00:00Z",
    }


def export(tmp_path, overall: dict, config_extra: dict | None = None) -> dict:
    report_path = tmp_path / "report.json"
    report_path.write_text(
        json.dumps(make_report(overall, config_extra)), encoding="utf-8"
    )
    return export_champollion_config(
        report_path=report_path,
        target_lang_code="crk",
        output_path=tmp_path / "snippet.json",
    )


# ---------------------------------------------------------------------------
# _extract_composite_score
# ---------------------------------------------------------------------------

class TestExtractCompositeScore:
    def test_reads_from_confidence_intervals_block(self):
        # The shape TestReports actually write
        overall = {
            "confidence_intervals": {
                "composite_score": {
                    "metric_name": "composite_score",
                    "score": 0.4546,
                    "ci_lower": 0.4236,
                    "ci_upper": 0.4859,
                },
            },
        }
        assert _extract_composite_score(overall) == 0.4546

    def test_falls_back_to_top_level_key(self):
        # Forward compat: a future format may store it at the top level
        assert _extract_composite_score({"composite_score": 0.71}) == 0.71

    def test_ci_block_wins_over_top_level(self):
        overall = {
            "composite_score": 0.10,
            "confidence_intervals": {"composite_score": {"score": 0.45}},
        }
        assert _extract_composite_score(overall) == 0.45

    def test_missing_everywhere_is_none(self):
        assert _extract_composite_score({}) is None
        assert _extract_composite_score({"confidence_intervals": {}}) is None
        assert _extract_composite_score(
            {"confidence_intervals": {"composite_score": {}}}
        ) is None

    def test_null_ci_block_is_tolerated(self):
        assert _extract_composite_score({"confidence_intervals": None}) is None


# ---------------------------------------------------------------------------
# export_champollion_config — _benchmark_summary
# ---------------------------------------------------------------------------

class TestBenchmarkSummary:
    def test_composite_and_tier_from_real_report_shape(self, tmp_path):
        snippet = export(tmp_path, {
            "total_entries": 200,
            "exact_match_rate": 0.12,
            "corpus_chrf": 38.5,
            "confidence_intervals": {
                "composite_score": {"score": 0.4546},
            },
        })
        summary = snippet["_benchmark_summary"]
        assert summary["composite_score"] == 0.4546
        assert summary["quality_tier"] == classify_quality_tier(0.4546)
        assert summary["quality_tier"] != "unscored"
        assert summary["corpus_size"] == 200
        assert summary["exact_match_rate"] == 0.12
        assert summary["chrf_plus_plus"] == 38.5

    def test_no_composite_emits_null_not_unscored(self, tmp_path):
        snippet = export(tmp_path, {"total_entries": 200})
        summary = snippet["_benchmark_summary"]
        assert summary["composite_score"] is None
        assert summary["quality_tier"] is None

    def test_explicit_report_tier_is_preferred(self, tmp_path):
        # Forward compat: an explicit overall.quality_tier wins over derivation
        snippet = export(tmp_path, {
            "quality_tier": "deployable",
            "confidence_intervals": {"composite_score": {"score": 0.31}},
        })
        assert snippet["_benchmark_summary"]["quality_tier"] == "deployable"

    def test_written_snippet_matches_return_value(self, tmp_path):
        snippet = export(tmp_path, {
            "confidence_intervals": {"composite_score": {"score": 0.4546}},
        })
        on_disk = json.loads((tmp_path / "snippet.json").read_text(encoding="utf-8"))
        assert on_disk["_benchmark_summary"] == snippet["_benchmark_summary"]


# ---------------------------------------------------------------------------
# defaultMethod mapping — pre-launch audit blocking #1
#
# The harness prompt_version vocabulary (naive | coached | custom |
# champollion) is NOT the CLI method vocabulary. A raw passthrough wrote a
# config the CLI rejects with "Unknown translation method". Every exported
# defaultMethod must be a valid CLI method.
# ---------------------------------------------------------------------------

class TestDefaultMethodMapping:
    @pytest.mark.parametrize("prompt_version,expected", [
        ("naive", "llm"),
        ("coached", "llm-coached"),
        ("custom", "llm-coached"),
        ("champollion", "llm-coached"),
    ])
    def test_resolver_maps_to_valid_cli_method(self, prompt_version, expected):
        method, _note = _resolve_default_method(prompt_version)
        assert method == expected
        assert method in _CLI_METHODS

    def test_resolver_defaults_none_to_llm(self):
        method, note = _resolve_default_method(None)
        assert method == "llm"
        assert note is None

    def test_non_portable_versions_carry_a_note(self):
        for pv in ("custom", "champollion"):
            _method, note = _resolve_default_method(pv)
            assert note and pv in note

    def test_unknown_prompt_version_raises(self):
        with pytest.raises(ValueError):
            _resolve_default_method("totally-made-up")

    @pytest.mark.parametrize("prompt_version", [
        "naive", "coached", "custom", "champollion",
    ])
    def test_exported_default_method_is_cli_valid(self, tmp_path, prompt_version):
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={"prompt_version": prompt_version},
        )
        # The crash this guards: defaultMethod must be a CLI method, never
        # a raw harness prompt_version (none of which are CLI methods).
        assert snippet["defaultMethod"] in _CLI_METHODS
        assert snippet["defaultMethod"] != prompt_version

    def test_champollion_export_annotates_method_note(self, tmp_path):
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={"prompt_version": "champollion"},
        )
        assert snippet["defaultMethod"] == "llm-coached"
        assert "_method_note" in snippet

    def test_non_english_source_emits_input_locale(self, tmp_path):
        # The harness writes the source ISO code under `source_code` (the
        # RunConfig field name), NOT `source_lang_code`. The old fixture used
        # the wrong key, so the exporter's "en" fallback masked the dead-branch
        # bug that dropped every non-English source. Guard the real key.
        #
        # The harness records ISO 639-3 ("fra"); the exported inputLocale must
        # be the two-letter ISO 639-1 ("fr") a conventional i18n project uses,
        # never the raw 639-3 code (which matches no normal project).
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={"prompt_version": "naive", "source_code": "fra"},
        )
        assert snippet["inputLocale"] == "fr"
        assert "fr:crk" in snippet["pairs"]
        # The 639-3 form must never leak into the deployed config.
        assert "fra" not in snippet["pairs"]

    def test_legacy_source_lang_code_key_still_works(self, tmp_path):
        # Back-compat: an externally-authored report using the old
        # `source_lang_code` key must still resolve the source (and normalize
        # to ISO 639-1).
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={"prompt_version": "naive", "source_lang_code": "fra"},
        )
        assert snippet["inputLocale"] == "fr"
        assert "fr:crk" in snippet["pairs"]

    def test_english_source_as_iso639_3_omits_input_locale(self, tmp_path):
        # An English source recorded as ISO 639-3 "eng" must normalize to "en"
        # and so be treated as the default English source — no inputLocale and
        # no per-pair override. The pre-fix code emitted inputLocale="eng".
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={"prompt_version": "naive", "source_code": "eng"},
        )
        assert "inputLocale" not in snippet
        assert "pairs" not in snippet

    def test_target_code_normalized_to_iso639_1(self, tmp_path):
        # A 639-3 target_lang_code resolves to its 639-1 form everywhere it is
        # keyed — the `languages` map and the pair key — so the deployed config
        # matches an en.json/de.json project.
        report_path = tmp_path / "report.json"
        report_path.write_text(json.dumps({
            "config": {"prompt_version": "naive", "source_code": "fra",
                       "target_lang": "German"},
            "overall": {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            "timestamp": "2026-06-20T00:00:00Z",
        }), encoding="utf-8")
        snippet = export_champollion_config(
            report_path=report_path,
            target_lang_code="deu",          # 639-3 in, 639-1 out
            output_path=tmp_path / "snippet.json",
        )
        assert "de" in snippet["languages"]
        assert "deu" not in snippet["languages"]
        assert "fr:de" in snippet["pairs"]

    def test_target_without_iso639_1_passes_through(self, tmp_path):
        # Plains Cree has no ISO 639-1 code — the target must pass through
        # unchanged rather than crash or blank out.
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={"prompt_version": "naive", "source_code": "fra"},
        )
        # export() uses target_lang_code="crk"
        assert "crk" in snippet["languages"]
        assert "fr:crk" in snippet["pairs"]

    def test_fr_to_de_round_trips_with_correct_source(self, tmp_path):
        # End-to-end: a real fr→de run must export inputLocale=fr and a fr:de
        # pair — never silently default the source to English (en→de). This is
        # the headline interop regression: config_exporter read 'source_lang_code'
        # while the harness writes 'source_code', so the source branch was dead.
        report_path = tmp_path / "report.json"
        report_path.write_text(json.dumps({
            "config": {
                "model": "claude-sonnet-4-6",
                "temperature": 0.3,
                "batch_size": 25,
                "prompt_version": "naive",
                "source_code": "fr",      # what the runner serializes
                "target_lang": "German",
            },
            "overall": {"confidence_intervals": {"composite_score": {"score": 0.5}}},
            "timestamp": "2026-06-20T00:00:00Z",
        }), encoding="utf-8")
        out_path = tmp_path / "snippet.json"
        snippet = export_champollion_config(
            report_path=report_path,
            target_lang_code="de",
            output_path=out_path,
        )
        assert snippet["inputLocale"] == "fr"
        assert "fr:de" in snippet["pairs"]
        # The dead-branch bug deployed every non-English run as en→de.
        assert snippet["inputLocale"] != "en"
        # Round-trips identically to disk.
        on_disk = json.loads(out_path.read_text(encoding="utf-8"))
        assert on_disk["inputLocale"] == "fr"
        assert "fr:de" in on_disk["pairs"]

    def test_english_source_omits_input_locale(self, tmp_path):
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={"prompt_version": "naive"},
        )
        assert "inputLocale" not in snippet


# ---------------------------------------------------------------------------
# MT-API engine mapping — the headline interop bug
#
# MT-API runs (--method deepl / google-translate / ...) set config.mt_method
# and leave prompt_version at its meaningless default ('naive'). The exporter
# read ONLY prompt_version, so it exported EVERY MT engine as defaultMethod
# 'llm' with model = the engine name — a config that invokes the LLM path
# against a nonexistent OpenRouter model. The fix branches on mt_method first
# and maps each engine to its matching CLI defaultMethod via the shared
# method-registry SSOT, failing loud for engines with no CLI adapter.
# ---------------------------------------------------------------------------

class TestMtApiMethodMapping:
    # CLI-runnable MT engines and harness-only ones, derived from the shared
    # SSOT so a newly added engine is covered without editing this list. Falls
    # back to the embedded mirror in a standalone install (no SSOT on disk).
    CLI_RUNNABLE = sorted(_mt_method_to_cli_map()) or sorted(_MT_METHOD_TO_CLI_FALLBACK)
    HARNESS_ONLY = sorted(
        name for name in manifest_entries("mt-api")
        if name not in _mt_method_to_cli_map()
    )

    def test_ssot_partitions_seven_mt_api_engines(self):
        """The SSOT advertises the 7 MT-API engines: 6 CLI-runnable + amazon
        (harness-only). Skipped in a standalone install (no SSOT on disk)."""
        names = set(manifest_entries("mt-api"))
        if not names:
            pytest.skip("method-registry SSOT not present (standalone install)")
        expected_cli = {
            "google-translate", "deepl", "microsoft-translator",
            "libretranslate", "apertium", "tilde",
        }
        assert expected_cli <= set(self.CLI_RUNNABLE)
        # amazon-translate exists in the harness but has no CLI adapter.
        assert "amazon-translate" in names
        assert "amazon-translate" in self.HARNESS_ONLY
        assert "amazon-translate" not in self.CLI_RUNNABLE

    @pytest.mark.parametrize("engine", CLI_RUNNABLE)
    def test_resolver_maps_engine_to_its_cli_method(self, engine):
        # 'naive' is the prompt_version MT-API runs actually carry; the engine
        # must win regardless, and the result must be a real CLI method != llm.
        method, note = _resolve_default_method("naive", engine)
        assert method == engine            # identity round-trip via the SSOT
        assert method in _CLI_METHODS
        assert method != "llm"
        assert note is None

    def test_mt_method_overrides_prompt_version(self):
        # No prompt_version (even coached/champollion/None) may override the engine.
        for pv in ("naive", "coached", "champollion", None):
            method, _note = _resolve_default_method(pv, "deepl")
            assert method == "deepl"

    def test_harness_only_engine_fails_loud(self):
        # amazon-translate (runtimes=['harness']) has no CLI adapter — the
        # export MUST raise, never silently emit 'llm'.
        with pytest.raises(ValueError) as exc:
            _resolve_default_method("naive", "amazon-translate")
        assert "amazon-translate" in str(exc.value)

    def test_unknown_mt_method_fails_loud(self):
        with pytest.raises(ValueError):
            _resolve_default_method("naive", "totally-made-up-engine")

    def test_deepl_run_exports_deepl_invoking_config(self, tmp_path):
        # The exact live regression: a scored DeepL run exported defaultMethod
        # 'llm' / model 'deepl'. It must now export a DeepL-invoking config.
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={
                "mt_method": "deepl",
                "model": "deepl",           # the engine name the runner stores
                "prompt_version": "naive",  # meaningless for MT — must be ignored
            },
        )
        assert snippet["defaultMethod"] == "deepl"
        assert snippet["defaultMethod"] != "llm"
        # The engine name must not leak into `model` (would look like an
        # OpenRouter model and route back through the LLM path).
        assert snippet["model"] is None

    @pytest.mark.parametrize("engine", CLI_RUNNABLE)
    def test_all_cli_runnable_engines_round_trip_via_export(self, tmp_path, engine):
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={
                "mt_method": engine, "model": engine, "prompt_version": "naive",
            },
        )
        assert snippet["defaultMethod"] == engine
        assert snippet["defaultMethod"] in _CLI_METHODS
        assert snippet["defaultMethod"] != "llm"
        assert snippet["model"] is None

    def test_amazon_export_fails_loud_not_llm(self, tmp_path):
        # The 7th MT-API engine: exporting it must raise, not emit 'llm'.
        with pytest.raises(ValueError):
            export(
                tmp_path,
                {"confidence_intervals": {"composite_score": {"score": 0.4}}},
                config_extra={
                    "mt_method": "amazon-translate", "model": "amazon-translate",
                },
            )


# ---------------------------------------------------------------------------
# cmd_export_config — the CLI wrapper must NOT dump a raw traceback
#
# An unmappable engine raises ValueError from _resolve_default_method. The
# export-config dispatch returns before main()'s try/except, so the library
# raise has to be converted to a clean error + exit 1 by cmd_export_config.
# ---------------------------------------------------------------------------

class TestExportConfigCliExit:
    def _args(self, report_path, target="crk", output=None):
        import argparse
        return argparse.Namespace(
            report=str(report_path), target_lang_code=target, output=output,
        )

    def test_unmappable_engine_exits_cleanly_not_traceback(self, tmp_path, capsys):
        from mt_eval_harness.config_exporter import cmd_export_config

        report_path = tmp_path / "report.json"
        report_path.write_text(json.dumps(make_report(
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            {"mt_method": "amazon-translate", "model": "amazon-translate"},
        )), encoding="utf-8")

        with pytest.raises(SystemExit) as exc:
            cmd_export_config(self._args(report_path))
        assert exc.value.code == 1
        # Clean, human-readable error on stderr — not a Python traceback.
        err = capsys.readouterr().err
        assert "ERROR:" in err
        assert "amazon-translate" in err
        assert "Traceback" not in err

    def test_valid_run_does_not_exit(self, tmp_path):
        from mt_eval_harness.config_exporter import cmd_export_config

        report_path = tmp_path / "report.json"
        report_path.write_text(json.dumps(make_report(
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            {"mt_method": "deepl", "model": "deepl"},
        )), encoding="utf-8")
        # A mappable run must complete without raising SystemExit.
        cmd_export_config(self._args(report_path, output=tmp_path / "out.json"))
        assert (tmp_path / "out.json").exists()


# ---------------------------------------------------------------------------
# Provider emission — multi-provider backend
# ---------------------------------------------------------------------------

class TestProviderExport:
    def test_default_openrouter_omits_provider(self, tmp_path):
        """OpenRouter is the default — keep exports clean by omitting it."""
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={"provider": "openrouter"},
        )
        assert "provider" not in snippet

    def test_direct_provider_emits_provider(self, tmp_path):
        """Non-default providers MUST be explicitly recorded."""
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
            config_extra={"provider": "openai"},
        )
        assert snippet["provider"] == "openai"

    def test_missing_provider_omits_field(self, tmp_path):
        """Old configs without a provider field should export cleanly."""
        snippet = export(
            tmp_path,
            {"confidence_intervals": {"composite_score": {"score": 0.4}}},
        )
        assert "provider" not in snippet

