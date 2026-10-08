"""
Tests for mt_eval_harness.cli — CLI argument parsing and command dispatch.

Covers:
    - Parser construction and subcommand registration
    - Argument parsing for every subcommand
    - args_to_config() conversion
    - cmd_list() output
    - cmd_export() dispatch
    - Default (no subcommand) behavior
    - Branding verification
"""

import re
import sys
from io import StringIO
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from mt_eval_harness.cli import (
    build_parser,
    args_to_config,
    cmd_list,
    _run_json_summary,
)
from mt_eval_harness.config import (
    RunConfig,
    DEFAULT_MODEL,
    RETIRED_MODEL_ALIASES,
)


# ---------------------------------------------------------------------------
# Parser construction
# ---------------------------------------------------------------------------

class TestParserConstruction:
    """Verify the argument parser registers all subcommands."""

    def test_parser_builds(self):
        parser = build_parser()
        assert parser.prog == "mt-eval"

    def test_has_run_subcommand(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "test.json"])
        assert args.command == "run"

    def test_has_test_subcommand(self):
        parser = build_parser()
        args = parser.parse_args(["test", "log.json"])
        assert args.command == "test"

    def test_has_compare_subcommand(self):
        parser = build_parser()
        args = parser.parse_args(["compare", "a.json", "b.json"])
        assert args.command == "compare"

    def test_has_dashboard_subcommand(self):
        parser = build_parser()
        args = parser.parse_args(["dashboard", "logs/"])
        assert args.command == "dashboard"

    def test_has_list_subcommand(self):
        parser = build_parser()
        args = parser.parse_args(["list", "models"])
        assert args.command == "list"
        assert args.what == "models"

    def test_has_export_subcommand(self):
        parser = build_parser()
        args = parser.parse_args([
            "export",
            "--report", "report.json",
            "--name", "test-plugin",
            "--type", "llm",
            "--locales", "fr",
        ])
        assert args.command == "export"


# ---------------------------------------------------------------------------
# Publish argument parsing
# ---------------------------------------------------------------------------

class TestPublishArgParsing:
    """Verify publish arguments parse correctly (incl. non-interactive --yes)."""

    def test_basic_publish(self):
        parser = build_parser()
        args = parser.parse_args(["publish", "report.json"])
        assert args.command == "publish"
        assert args.report_path == "report.json"

    def test_yes_defaults_false(self):
        """Prompts (wizard offer + confirm) remain the default behavior."""
        parser = build_parser()
        args = parser.parse_args(["publish", "report.json"])
        assert args.yes is False

    def test_yes_long_flag(self):
        parser = build_parser()
        args = parser.parse_args(["publish", "report.json", "--yes"])
        assert args.yes is True

    def test_yes_short_flag(self):
        parser = build_parser()
        args = parser.parse_args(["publish", "report.json", "-y"])
        assert args.yes is True

    def test_method_card_option(self):
        parser = build_parser()
        args = parser.parse_args(
            ["publish", "report.json", "--method-card", "mc.json"]
        )
        assert args.method_card == "mc.json"


# ---------------------------------------------------------------------------
# Run argument parsing
# ---------------------------------------------------------------------------

class TestRunArgParsing:
    """Verify run arguments parse correctly."""

    def test_defaults(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "test.json"])
        assert args.model == DEFAULT_MODEL
        assert args.dataset == "all"
        assert args.batch_size == 25
        assert args.temperature == 0.0

    def test_model_override(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "-m", "anthropic/claude-opus-4.6"])
        assert args.model == "anthropic/claude-opus-4.6"

    def test_batch_size(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "-b", "5"])
        assert args.batch_size == 5

    def test_tools_flag(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--tools"])
        assert args.tools is True

    def test_ids_parsing(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--ids", "0,1,5,10"])
        assert args.ids == "0,1,5,10"

    def test_custom_fields(self):
        parser = build_parser()
        args = parser.parse_args([
            "run", "--corpus", "x.json",
            "--source-field", "english",
            "--target-field", "cree_sro",
        ])
        assert args.source_field == "english"
        assert args.target_field == "cree_sro"

    def test_dry_run_flag(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--dry-run"])
        assert args.dry_run is True

    def test_no_cache_flag(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--no-cache"])
        assert args.no_cache is True

    def test_hooks_string(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--hooks", "fst_gate,normalize"])
        assert args.hooks == "fst_gate,normalize"

    def test_publish_flag_defaults_false(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json"])
        assert args.publish is False

    def test_publish_flag_parses(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--publish"])
        assert args.publish is True


# ---------------------------------------------------------------------------
# Dashboard argument parsing
# ---------------------------------------------------------------------------

class TestDashboardArgParsing:
    """Verify dashboard arguments parse correctly."""

    def test_basic_dashboard(self):
        parser = build_parser()
        args = parser.parse_args(["dashboard", "logs/"])
        assert args.command == "dashboard"
        assert args.log_paths == ["logs/"]

    def test_dashboard_output(self):
        parser = build_parser()
        args = parser.parse_args(["dashboard", "logs/", "-o", "out.html"])
        assert args.output == "out.html"

    def test_dashboard_watch(self):
        parser = build_parser()
        args = parser.parse_args(["dashboard", "logs/", "--watch"])
        assert args.watch is True

    def test_dashboard_interval(self):
        parser = build_parser()
        args = parser.parse_args(["dashboard", "logs/", "--interval", "10"])
        assert args.interval == 10.0

    def test_multiple_log_paths(self):
        parser = build_parser()
        args = parser.parse_args(["dashboard", "logs/dir1", "logs/dir2", "extra.json"])
        assert len(args.log_paths) == 3


# ---------------------------------------------------------------------------
# Export argument parsing
# ---------------------------------------------------------------------------

class TestExportArgParsing:
    """Verify export subcommand parsing."""

    def test_required_args(self):
        parser = build_parser()
        args = parser.parse_args([
            "export",
            "--report", "report.json",
            "--name", "crk-coached-v1",
            "--type", "llm-coached",
            "--locales", "crk",
        ])
        assert args.report == "report.json"
        assert args.name == "crk-coached-v1"
        assert args.type == "llm-coached"
        assert args.locales == "crk"

    def test_optional_args(self):
        parser = build_parser()
        args = parser.parse_args([
            "export",
            "--report", "r.json",
            "--name", "test",
            "--type", "llm",
            "--locales", "fr",
            "--author", "Test Author",
            "--description", "A test plugin",
            "--version", "2.0.0",
        ])
        assert args.author == "Test Author"
        assert args.description == "A test plugin"
        assert args.plugin_version == "2.0.0"

    def test_commercial_ready_flag(self):
        parser = build_parser()
        args = parser.parse_args([
            "export",
            "--report", "r.json",
            "--name", "test",
            "--type", "llm",
            "--locales", "fr",
            "--commercial-ready",
        ])
        assert args.commercial_ready is True

    def test_commercial_ready_default(self):
        parser = build_parser()
        args = parser.parse_args([
            "export",
            "--report", "r.json",
            "--name", "test",
            "--type", "llm",
            "--locales", "fr",
        ])
        assert args.commercial_ready is False

    def test_author_default_neutral(self):
        """Default author should be empty (not GDS-branded)."""
        parser = build_parser()
        args = parser.parse_args([
            "export",
            "--report", "r.json",
            "--name", "test",
            "--type", "llm",
            "--locales", "fr",
        ])
        assert args.author == ""
        assert "gds" not in args.author.lower()


# ---------------------------------------------------------------------------
# args_to_config() conversion
# ---------------------------------------------------------------------------

class TestArgsToConfig:
    """Verify CLI args correctly map to RunConfig fields."""

    def test_basic_conversion(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "test.json"])
        config = args_to_config(args)

        assert isinstance(config, RunConfig)
        assert config.corpus_path == "test.json"
        assert config.model == DEFAULT_MODEL
        assert config.dataset == "all"

    def test_entry_ids_parsed(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--ids", "0,5,10"])
        config = args_to_config(args)

        assert config.entry_ids == [0, 5, 10]

    def test_tools_list_parsed(self):
        parser = build_parser()
        args = parser.parse_args([
            "run", "--corpus", "x.json",
            "--tools", "--tools-list", "fst_validate,fst_generate",
        ])
        config = args_to_config(args)

        assert config.tools_enabled is True
        assert config.tools_list == ["fst_validate", "fst_generate"]

    def test_post_hooks_parsed(self):
        parser = build_parser()
        args = parser.parse_args([
            "run", "--corpus", "x.json",
            "--hooks", "fst_gate,normalize",
        ])
        config = args_to_config(args)

        assert config.post_hooks == ["fst_gate", "normalize"]

    def test_no_cache_maps(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--no-cache"])
        config = args_to_config(args)

        assert config.cache_enabled is False

    def test_publish_flag_maps_to_auto_publish(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--publish"])
        config = args_to_config(args)
        assert config.auto_publish is True

    def test_publish_prod_and_anonymous_map(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--publish", "--prod", "--anonymous"])
        config = args_to_config(args)
        assert (config.auto_publish, config.publish_prod, config.publish_anonymous) == (True, True, True)

    def test_auto_publish_defaults_false(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json"])
        config = args_to_config(args)
        assert config.auto_publish is False

    def test_temperature_maps(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--temperature", "0.5"])
        config = args_to_config(args)

        assert config.temperature == 0.5

    def test_run_name_maps(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "-n", "Baseline FST"])
        config = args_to_config(args)

        assert config.run_name == "Baseline FST"

    def test_prompt_version_maps(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "-p", "custom", "--custom-prompt", "p.txt"])
        config = args_to_config(args)

        assert config.prompt_version == "custom"
        assert config.custom_prompt_path == "p.txt"

    def test_coaching_file_derives_coached_condition(self):
        # --coaching-file with the default -p relabels the condition so
        # publish doesn't record a coached run as "naive".
        parser = build_parser()
        args = parser.parse_args(
            ["run", "--corpus", "x.json", "--coaching-file", "c.txt"]
        )
        config = args_to_config(args)

        assert config.prompt_version == "coached"
        assert config.coaching_file == "c.txt"

    def test_inline_coaching_derives_coached_condition(self):
        parser = build_parser()
        args = parser.parse_args(
            ["run", "--corpus", "x.json", "--coaching", "Be formal."]
        )
        config = args_to_config(args)

        try:
            assert config.prompt_version == "coached"
            assert config.coaching_file is not None
        finally:
            Path(config.coaching_file).unlink(missing_ok=True)

    def test_custom_prompt_alias_derives_coached_condition(self):
        # Deprecated --custom-prompt without -p flows through coaching_file
        # and gets the same coached label.
        parser = build_parser()
        args = parser.parse_args(
            ["run", "--corpus", "x.json", "--custom-prompt", "p.txt"]
        )
        config = args_to_config(args)

        assert config.prompt_version == "coached"
        assert config.coaching_file == "p.txt"

    def test_explicit_prompt_wins_over_coached_derivation(self):
        parser = build_parser()
        args = parser.parse_args(
            ["run", "--corpus", "x.json", "-p", "custom",
             "--coaching-file", "c.txt"]
        )
        config = args_to_config(args)

        assert config.prompt_version == "custom"
        assert config.coaching_file == "c.txt"

    def test_no_coaching_keeps_naive_default(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json"])
        config = args_to_config(args)

        assert config.prompt_version == "naive"
        assert config.coaching_file is None


# ---------------------------------------------------------------------------
# cmd_list() output
# ---------------------------------------------------------------------------

class TestCmdList:
    """Verify the list subcommand output."""

    def test_list_models_names_each_retired_alias_with_its_slug(self, capsys):
        # No aliasing (founder ruling 2026-10-05): the list says each retired
        # short name is refused and which exact slug to write instead.
        cmd_list("models")
        out = capsys.readouterr().out

        assert "refused" in out
        for short_name, slug in RETIRED_MODEL_ALIASES.items():
            assert f"{short_name}" in out and f"write {slug}" in out, short_name

    def test_list_models_marks_default(self, capsys):
        cmd_list("models")
        out = capsys.readouterr().out

        assert f"Default model: {DEFAULT_MODEL}" in out
        assert "/" in DEFAULT_MODEL

    def test_list_models_mentions_openrouter(self, capsys):
        cmd_list("models")
        out = capsys.readouterr().out

        assert "OpenRouter" in out

    def test_list_prompts(self, capsys):
        cmd_list("prompts")
        out = capsys.readouterr().out

        assert "naive" in out
        assert "custom" in out

    def test_list_no_gds_branding(self, capsys):
        """list output should be free of GDS branding."""
        cmd_list("models")
        out_models = capsys.readouterr().out.lower()

        cmd_list("prompts")
        out_prompts = capsys.readouterr().out.lower()

        combined = out_models + out_prompts
        assert "gds" not in combined
        assert "game day" not in combined


# ---------------------------------------------------------------------------
# Branding — whole module
# ---------------------------------------------------------------------------

class TestCLIBranding:
    """Verify the CLI module is free of legacy branding."""

    def test_description_neutral(self):
        parser = build_parser()
        assert "gds" not in parser.description.lower()

    def test_epilog_neutral(self):
        parser = build_parser()
        assert "gds" not in parser.epilog.lower()

    def test_prog_name(self):
        parser = build_parser()
        assert parser.prog == "mt-eval"


# ---------------------------------------------------------------------------
# run --json success summary
# ---------------------------------------------------------------------------

class TestRunJsonSummary:
    """`mt-eval run --json` used to emit a JSON object only on the error path;
    on success an agent had to scrape the human run card. _run_json_summary
    builds the success object (run id, corpus, scores) from the run_log(s)
    execute_run / execute_multi_run return."""

    def _run_log(self, run_id="run_abc_xyz"):
        # Mirrors what runner.execute_run attaches under "_summary".
        return {
            "run_id": run_id,
            "config": {"model": "google/gemini-3.5-flash"},
            "_summary": {
                "run_id": run_id,
                "model": "google/gemini-3.5-flash",
                "corpus": "data/corpus.json",
                "entry_count": 61,
                "scores": {"corpus_chrf": 42.1, "corpus_bleu": 19.4,
                           "exact_match_rate": 0.0},
                "report_path": "logs/run_report.json",
                "run_log_path": "logs/run.json",
            },
        }

    def test_single_run_flattened_with_run_id_corpus_scores(self):
        summary = _run_json_summary([self._run_log()], multi=False)
        assert summary["command"] == "run"
        assert summary["status"] == "ok"
        # Single runs flatten to the top level for one-shot parsing.
        assert summary["run_id"] == "run_abc_xyz"
        assert summary["corpus"] == "data/corpus.json"
        assert summary["entry_count"] == 61
        assert summary["scores"]["corpus_chrf"] == 42.1
        assert summary["report_path"] == "logs/run_report.json"
        # Must be JSON-serializable (it is printed via json.dumps).
        import json
        json.loads(json.dumps(summary))

    def test_multi_run_nests_runs(self):
        logs = [self._run_log("run_a"), self._run_log("run_b")]
        summary = _run_json_summary(logs, multi=True)
        assert summary["status"] == "ok"
        assert "runs" in summary and len(summary["runs"]) == 2
        assert {r["run_id"] for r in summary["runs"]} == {"run_a", "run_b"}

    def test_dry_run_reported_not_dropped(self):
        summary = _run_json_summary([{"dry_run": True, "entry_count": 5}], multi=False)
        assert summary["status"] == "ok"
        assert summary["dry_run"] is True
        assert summary["entry_count"] == 5

    def test_error_entry_marks_partial(self):
        logs = [self._run_log("run_ok"),
                {"error": "401 Unauthorized", "model_id": "x/y"}]
        summary = _run_json_summary(logs, multi=True)
        assert summary["status"] == "partial"
        errs = [r for r in summary["runs"] if r["status"] == "error"]
        assert len(errs) == 1
        assert "401" in errs[0]["error"]

    def test_none_run_log_is_handled(self):
        # execute_multi_run yields None for a model that died on a terminal error.
        summary = _run_json_summary([None], multi=True)
        assert summary["status"] == "partial"


# ---------------------------------------------------------------------------
# Compare argument parsing
# ---------------------------------------------------------------------------

class TestCompareArgParsing:
    """Verify compare subcommand parsing."""

    def test_two_paths_required(self):
        parser = build_parser()
        args = parser.parse_args(["compare", "a.json", "b.json"])
        assert args.log_paths == ["a.json", "b.json"]

    def test_compare_output(self):
        parser = build_parser()
        args = parser.parse_args(["compare", "a.json", "b.json", "-o", "cmp.json"])
        assert args.output == "cmp.json"

    def test_many_paths(self):
        parser = build_parser()
        args = parser.parse_args(["compare", "a.json", "b.json", "c.json", "d.json"])
        assert len(args.log_paths) == 4


# ---------------------------------------------------------------------------
# Test subcommand parsing
# ---------------------------------------------------------------------------

class TestTestArgParsing:
    """Verify test subcommand parsing."""

    def test_log_path_positional(self):
        parser = build_parser()
        args = parser.parse_args(["test", "run_log.json"])
        assert args.log_path == "run_log.json"

    def test_test_output(self):
        parser = build_parser()
        args = parser.parse_args(["test", "run.json", "-o", "report.json"])
        assert args.output == "report.json"


# ---------------------------------------------------------------------------
# generate-plugin alias (Phase 4)
# ---------------------------------------------------------------------------

class TestGeneratePluginAlias:
    """Verify the 'generate-plugin' subcommand maps to export."""

    def test_generate_plugin_parses(self):
        parser = build_parser()
        args = parser.parse_args([
            "generate-plugin",
            "--report", "report.json",
            "--name", "crk-v1",
            "--type", "llm",
            "--locales", "crk",
        ])
        assert args.command == "generate-plugin"
        assert args.report == "report.json"
        assert args.name == "crk-v1"

    def test_generate_plugin_has_all_export_args(self):
        """generate-plugin should support all the same args as export."""
        parser = build_parser()
        args = parser.parse_args([
            "generate-plugin",
            "--report", "r.json",
            "--name", "test",
            "--type", "llm-coached",
            "--locales", "crk,fr",
            "--author", "Test Author",
            "--description", "Test plugin",
            "--version", "2.0.0",
            "--coaching-dir", "/some/dir",
            "--commercial-ready",
        ])
        assert args.type == "llm-coached"
        assert args.locales == "crk,fr"
        assert args.author == "Test Author"
        assert args.plugin_version == "2.0.0"
        assert args.commercial_ready is True


# ---------------------------------------------------------------------------
# --live flag for model discovery (Phase 4)
# ---------------------------------------------------------------------------

class TestListLiveFlag:
    """Verify the --live flag on 'list models'."""

    def test_live_flag_parses(self):
        parser = build_parser()
        args = parser.parse_args(["list", "models", "--live"])
        assert args.live is True

    def test_live_flag_default_false(self):
        parser = build_parser()
        args = parser.parse_args(["list", "models"])
        assert args.live is False

    def test_live_not_available_on_prompts(self):
        """--live is on the list parser, but only useful for models."""
        parser = build_parser()
        args = parser.parse_args(["list", "prompts", "--live"])
        # Parses without error, but live is only used for models
        assert args.live is True

    def test_cmd_list_without_live(self, capsys):
        """Non-live list should work normally."""
        cmd_list("models", live=False)
        out = capsys.readouterr().out
        # Should show the default + retired names but NOT attempt an OpenRouter fetch
        assert "default model:" in out.lower()

    def test_cmd_list_with_live_no_key(self, capsys, monkeypatch):
        """Live mode gracefully handles missing API key — real error path."""
        # Remove the env var to simulate no key
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        # Also remove any .env fallback by patching dotenv at the import site
        from unittest.mock import patch
        with patch("dotenv.find_dotenv", return_value=""):
            cmd_list("models", live=True)

        out = capsys.readouterr().out
        assert "cannot fetch" in out.lower() or "api" in out.lower()

    def test_cmd_list_live_formats_table(self, capsys, monkeypatch):
        """Live listing formats model data into a readable table.

        Mocks only the HTTP transport (aiohttp session) — all filtering,
        sorting, and formatting logic runs for real.
        """
        import asyncio
        from unittest.mock import patch, AsyncMock, MagicMock

        # Set a fake API key so load_api_key doesn't fail
        monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test-123")

        # Build a fake API response with realistic model structure
        fake_models = {
            "data": [
                {
                    "id": "anthropic/claude-sonnet-4",
                    "architecture": {"modality": "text->text"},
                    "pricing": {"prompt": "0.000003", "completion": "0.000015"},
                },
                {
                    "id": "google/gemini-2.5-flash",
                    "architecture": {"modality": "text->text"},
                    "pricing": {"prompt": "0.0000001", "completion": "0.0000004"},
                },
                {
                    "id": "stability/stable-diffusion",
                    "architecture": {"modality": "text->image"},
                    "pricing": {"prompt": "0.000001", "completion": "0"},
                },
            ]
        }

        # Create a mock response that behaves like aiohttp's response
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=fake_models)
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        # Create a mock session
        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_resp)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("aiohttp.ClientSession", return_value=mock_session):
            from mt_eval_harness.cli import cmd_list_live
            cmd_list_live()

        out = capsys.readouterr().out
        # Should contain the text-capable models (claude, gemini)
        assert "anthropic/claude-sonnet-4" in out
        assert "google/gemini-2.5-flash" in out
        # Should show pricing columns
        assert "Input $/1M" in out
        assert "Output $/1M" in out

    def test_cmd_list_live_handles_non_200(self, capsys, monkeypatch):
        """Non-200 API responses are reported, not crashed on."""
        import asyncio
        from unittest.mock import patch, AsyncMock, MagicMock

        monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test-123")

        mock_resp = AsyncMock()
        mock_resp.status = 403
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_resp)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("aiohttp.ClientSession", return_value=mock_session):
            from mt_eval_harness.cli import cmd_list_live
            cmd_list_live()

        out = capsys.readouterr().out
        assert "403" in out

    def test_cmd_list_live_handles_bad_pricing(self, capsys, monkeypatch):
        """Models with unparseable pricing show '?' instead of crashing."""
        import asyncio
        from unittest.mock import patch, AsyncMock, MagicMock

        monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test-123")

        fake_models = {
            "data": [
                {
                    "id": "test/bad-pricing-model",
                    "architecture": {"modality": "text->text"},
                    "pricing": {"prompt": "not-a-number", "completion": "nope"},
                },
            ]
        }

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=fake_models)
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_resp)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("aiohttp.ClientSession", return_value=mock_session):
            from mt_eval_harness.cli import cmd_list_live
            cmd_list_live()

        out = capsys.readouterr().out
        assert "test/bad-pricing-model" in out
        assert "?" in out


# ---------------------------------------------------------------------------
# generate_plugin() standalone entry point (Phase 4)
# ---------------------------------------------------------------------------

class TestGeneratePluginEntryPoint:
    """Test the standalone generate_plugin() entry point."""

    def test_injects_subcommand(self, monkeypatch):
        """generate_plugin() rewrites sys.argv to inject 'generate-plugin' subcommand.

        We verify the sys.argv transformation by checking what the parser sees.
        Mock only the final cmd_export to avoid needing a real report file.
        """
        import sys
        from unittest.mock import patch

        # Simulate: `generate-plugin --report r.json --name test --type llm --locales crk`
        monkeypatch.setattr(
            sys, "argv",
            ["generate-plugin", "--report", "r.json", "--name", "test", "--type", "llm", "--locales", "crk"],
        )

        from mt_eval_harness.cli import generate_plugin
        with patch("mt_eval_harness.cli.cmd_export") as mock_export:
            generate_plugin()

        # cmd_export should have been called with the parsed args
        mock_export.assert_called_once()
        call_args = mock_export.call_args[0][0]  # First positional arg
        assert call_args.command == "generate-plugin"
        assert call_args.report == "r.json"
        assert call_args.name == "test"


# ---------------------------------------------------------------------------
# E2E audit regressions — M4 / M5 / L1 / L2 / L16
# ---------------------------------------------------------------------------

class TestUnknownMethodCleanError:
    """M4: a fat-fingered --method name must fail with a CAUGHT, one-line
    error listing the available systems — not a raw MethodLoadError traceback,
    and not broken JSON under --json."""

    def test_unknown_method_name_raises_caught_valueerror(self):
        from mt_eval_harness.cli import build_parser, args_to_config

        parser = build_parser()
        args = parser.parse_args(
            ["run", "--corpus", "x.json", "--method", "google_translate"]
        )
        # google_translate (underscore) is neither a registered system nor a
        # dir → must raise ValueError (caught by main()'s handlers), listing
        # the real systems.
        with pytest.raises(ValueError) as exc:
            args_to_config(args)
        msg = str(exc.value)
        assert "google_translate" in msg
        assert "google-translate" in msg  # the correct, available system

    def test_registered_method_name_still_resolves(self):
        from mt_eval_harness.cli import build_parser, args_to_config

        parser = build_parser()
        args = parser.parse_args(
            ["run", "--corpus", "x.json", "--method", "google-translate"]
        )
        config = args_to_config(args)
        assert config.mt_method == "google-translate"
        assert config.method_path is None

    def test_plugin_directory_path_still_accepted(self, tmp_path):
        from mt_eval_harness.cli import build_parser, args_to_config

        plugin_dir = tmp_path / "my-plugin"
        plugin_dir.mkdir()
        parser = build_parser()
        args = parser.parse_args(
            ["run", "--corpus", "x.json", "--method", str(plugin_dir)]
        )
        config = args_to_config(args)
        # An existing dir is treated as a plugin path, not a typo.
        assert config.mt_method == ""
        assert config.method_path == str(plugin_dir)


class TestLoadRunlogCleanFailure:
    """M5: a malformed/partial/truncated/missing run log must fail with a
    one-line error + exit 1 (mirroring `export`), not a raw JSONDecodeError /
    FileNotFoundError traceback."""

    def test_truncated_json_exits_1(self, tmp_path, capsys):
        from mt_eval_harness.cli import load_runlog

        bad = tmp_path / "trunc.json"
        bad.write_text('{"config": {}, "results": [', encoding="utf-8")
        with pytest.raises(SystemExit) as exc:
            load_runlog(bad)
        assert exc.value.code == 1
        err = capsys.readouterr().err
        assert "valid JSON" in err
        # No traceback noise — just a clean one-liner.
        assert "Traceback" not in err

    def test_missing_file_exits_1(self, tmp_path, capsys):
        from mt_eval_harness.cli import load_runlog

        with pytest.raises(SystemExit) as exc:
            load_runlog(tmp_path / "nope.json")
        assert exc.value.code == 1
        assert "File not found" in capsys.readouterr().err

    def test_valid_json_returns_dict(self, tmp_path):
        from mt_eval_harness.cli import load_runlog

        good = tmp_path / "ok.json"
        good.write_text('{"config": {"model": "x"}, "results": []}', encoding="utf-8")
        data = load_runlog(good)
        assert data["config"]["model"] == "x"

    def test_dashboard_command_fails_cleanly_on_bad_report(self, tmp_path, capsys):
        # One-shot `dashboard <truncated.json>` must exit 1 with a one-line
        # error, not a raw JSONDecodeError traceback.
        from mt_eval_harness.cli import main
        import sys
        from unittest.mock import patch

        bad = tmp_path / "trunc_report.json"
        bad.write_text("{not json", encoding="utf-8")
        out_html = tmp_path / "dash.html"
        argv = ["mt-eval", "dashboard", str(bad), "-o", str(out_html)]
        with patch.object(sys, "argv", argv):
            with pytest.raises(SystemExit) as exc:
                main()
        assert exc.value.code == 1
        err = capsys.readouterr().err
        assert "valid JSON" in err
        assert "Traceback" not in err


class TestGlobalFlagPosition:
    """L1: --json / --non-interactive must work in ANY position (before or
    after the subcommand) for every command that consumes them, instead of
    argparse exit 2 + a usage wall."""

    @pytest.mark.parametrize("argv", [
        ["--json", "run", "--corpus", "x.json"],
        ["run", "--corpus", "x.json", "--json"],
        ["--json", "test", "log.json"],
        ["test", "log.json", "--json"],
        ["--json", "card", "c.json"],
        ["card", "c.json", "--json"],
        ["--json", "dashboard", "d/"],
        ["dashboard", "d/", "--json"],
        ["compare", "a.json", "b.json", "--json"],
    ])
    def test_json_flag_any_position(self, argv):
        parser = build_parser()
        args = parser.parse_args(argv)
        assert getattr(args, "json", False) is True

    @pytest.mark.parametrize("argv", [
        ["--non-interactive", "run", "--corpus", "x.json"],
        ["run", "--corpus", "x.json", "--non-interactive"],
    ])
    def test_non_interactive_any_position(self, argv):
        parser = build_parser()
        args = parser.parse_args(argv)
        assert getattr(args, "non_interactive", False) is True

    def test_corpora_keeps_its_own_json(self):
        # corpora has its own --json (not the shared parent) — must still parse.
        parser = build_parser()
        args = parser.parse_args(
            ["corpora", "--source", "eng", "--target", "crk", "--json"]
        )
        assert args.json is True


class TestCardReportFileHint:
    """L2: passing the *_report.json file to `card` used to exit 0 with no
    output. Now it auto-resolves the sibling run log, or prints a clear hint."""

    def test_report_file_with_sibling_renders_card(self, tmp_path, capsys):
        from mt_eval_harness.cli import main
        import sys
        from unittest.mock import patch

        run_log = tmp_path / "run_x.json"
        run_log.write_text('{"config": {"model": "m"}, "results": []}', encoding="utf-8")
        report = tmp_path / "run_x_report.json"
        report.write_text('{"overall": {}}', encoding="utf-8")

        with patch.object(sys, "argv", ["mt-eval", "card", str(report)]):
            main()
        out = capsys.readouterr().out
        # Auto-resolved the sibling run log and rendered SOMETHING.
        assert "RUN CARD" in out

    def test_report_file_without_sibling_prints_hint(self, tmp_path, capsys):
        from mt_eval_harness.cli import main
        import sys
        from unittest.mock import patch

        report = tmp_path / "orphan_report.json"
        report.write_text('{"overall": {}}', encoding="utf-8")

        with patch.object(sys, "argv", ["mt-eval", "card", str(report)]):
            with pytest.raises(SystemExit) as exc:
                main()
        # Nothing rendered is a failure (exit 1), said in one line.
        assert exc.value.code == 1
        err = capsys.readouterr().err
        # Clear hint, not a silent empty exit.
        assert "report file" in err
        assert "orphan.json" in err


class TestMissingCorpusMessage:
    """L16: path-shaped input that doesn't exist must surface a plain
    'file not found', not a wall of 10 dataset IDs + '(and N more)'.
    Bare id-shaped input still gets registry guidance."""

    def test_path_shaped_input_says_file_not_found(self):
        from mt_eval_harness.config import resolve_dataset

        with pytest.raises(FileNotFoundError) as exc:
            resolve_dataset("data/corpus.json")
        msg = str(exc.value)
        assert "Corpus file not found" in msg
        # The dataset-ID wall must NOT be dumped for an obvious path.
        assert "and " not in msg or "more)" not in msg

    def test_extension_only_input_says_file_not_found(self):
        from mt_eval_harness.config import resolve_dataset

        with pytest.raises(FileNotFoundError) as exc:
            resolve_dataset("missing.jsonl")
        assert "Corpus file not found" in str(exc.value)

    def test_id_shaped_input_still_gets_registry_guidance(self):
        from mt_eval_harness.config import resolve_dataset

        with pytest.raises(FileNotFoundError) as exc:
            resolve_dataset("totally-unknown-dataset-xyz")
        msg = str(exc.value)
        assert "not found in registry" in msg
        # id-shaped input keeps the suggestion / available-list behavior.
        assert "Corpus file not found" not in msg


class TestContestRegisterPathRegression:
    """`contest register --manifest` used to die with UnboundLocalError:
    function-local `from pathlib import Path` imports later in main()
    shadowed the module-level Path before this branch used it
    (organizer-simulation finding, 2026-07-12)."""

    def test_no_function_local_pathlib_imports(self):
        import inspect
        import mt_eval_harness.cli as cli_mod
        src = inspect.getsource(cli_mod)
        # Exactly one import at module level — any indented duplicate
        # re-creates the UnboundLocalError shadow.
        assert src.count("from pathlib import Path") == 1

    def test_register_missing_manifest_fails_clean(self):
        import subprocess
        proc = subprocess.run(
            [sys.executable, "-m", "mt_eval_harness.cli", "contest",
             "register", "--manifest", "/nonexistent-manifest.json"],
            capture_output=True, text=True, timeout=120,
        )
        out = proc.stdout + proc.stderr
        assert "UnboundLocalError" not in out
        assert "does not exist" in out
        assert proc.returncode != 0


# ---------------------------------------------------------------------------
# `mt-eval node stage-request` — the DB-less organizer-side request stager.
# ---------------------------------------------------------------------------

class TestNodeStageRequestParser:
    def test_parses_required_and_defaults(self):
        parser = build_parser()
        args = parser.parse_args([
            "node", "stage-request", "m.tar.gz", "--contest", "synth",
            "--out", "/media/usb", "--requested-by", "a@b.test"])
        assert args.command == "node"
        assert args.node_command == "stage-request"
        assert args.bundle == "m.tar.gz"
        assert args.contest == "synth"
        assert args.out == "/media/usb"
        assert args.requested_by == "a@b.test"
        assert args.corpus_version == "v1"
        assert args.secret_set is None
        assert args.request_id is None
        assert args.config is None

    def test_optional_flags(self):
        parser = build_parser()
        args = parser.parse_args([
            "node", "stage-request", "m.tar.gz", "--contest", "synth",
            "--out", "x", "--requested-by", "a@b.test",
            "--corpus-version", "v2", "--secret-set", "eval-s-v1",
            "--request-id", "authreq-fixed", "--config", "node.json"])
        assert args.corpus_version == "v2"
        assert args.secret_set == "eval-s-v1"
        assert args.request_id == "authreq-fixed"
        assert args.config == "node.json"

    @pytest.mark.parametrize("missing", ["--contest", "--out",
                                         "--requested-by"])
    def test_required_flags_are_required(self, missing):
        parser = build_parser()
        full = ["node", "stage-request", "m.tar.gz", "--contest", "synth",
                "--out", "x", "--requested-by", "a@b.test"]
        i = full.index(missing)
        argv = full[:i] + full[i + 2:]
        with pytest.raises(SystemExit):
            with patch("sys.stderr", new_callable=StringIO):
                parser.parse_args(argv)

    def test_help_text_states_the_limit(self):
        parser = build_parser()
        with patch("sys.stdout", new_callable=StringIO) as out:
            with pytest.raises(SystemExit):
                parser.parse_args(["node", "stage-request", "--help"])
        text = " ".join(out.getvalue().split())   # argparse wraps lines
        assert "never relay-publishable" in text
        assert "node_id" in text


class TestContestCompetitionVerbs:
    """`mt-eval contest --help` lists the competition-half verbs shipped
    2026-09-06 (contest_rank.py + migration 072): open-intake, close-intake,
    rank, close, export — and `create`/`prepare`/`register` accept
    --primary-metric."""

    VERBS = ("open-intake", "close-intake", "rank", "close", "export")

    # Retired as contest ENTRY paths by founder ruling R2 (2026-09-06): a
    # contest is entered by handing a METHOD to the sovereign node. `qualify`
    # is the public admission gate that replaced the hypotheses self-score.
    RETIRED_VERBS = ("submit", "submit-hypotheses")

    def _help(self, argv):
        parser = build_parser()
        with patch("sys.argv", ["mt-eval"] + argv), \
                patch("sys.stdout", new_callable=StringIO) as out:
            with pytest.raises(SystemExit) as ei:
                parser.parse_args(argv)
            assert ei.value.code == 0
            return out.getvalue()

    def test_contest_help_lists_five_verbs(self):
        text = self._help(["contest", "--help"])
        for verb in self.VERBS:
            assert re.search(rf"^\s+{re.escape(verb)}\s", text, re.M), verb

    def test_contest_help(self):
        """R2: `qualify` is listed; the retired entry verbs are gone — from
        the subcommand list AND from argparse itself."""
        parser = build_parser()
        text = self._help(["contest", "--help"])
        assert re.search(r"^\s+qualify\s", text, re.M)
        for verb in self.RETIRED_VERBS:
            assert not re.search(rf"^\s+{re.escape(verb)}\s", text, re.M), verb
            with pytest.raises(SystemExit):
                parser.parse_args(["contest", verb, "x"])

    def test_qualify_flags(self):
        text = self._help(["contest", "qualify", "--help"])
        for flag in ("--dev", "--dev-corpus", "--system", "--method-class",
                     "--paradigm", "--receipt-dir", "--offline-threshold",
                     "--offline-qualifier-id"):
            assert flag in text, flag
        args = build_parser().parse_args(
            ["contest", "qualify", "c1", "--dev", "h.txt",
             "--dev-corpus", "dev.json", "--system", "s",
             "--method-class", "pipeline"])
        assert args.contest_command == "qualify"
        assert args.offline_threshold is None
        assert args.receipt_dir is None

    def test_primary_metric_on_create_prepare_register(self):
        for verb in ("create", "prepare", "register"):
            assert "--primary-metric" in self._help(["contest", verb, "--help"]), verb

    def test_prize_disposition_on_every_contest_creating_verb(self):
        """R1-trinary: the prize term is ONE choice of three, offered on every
        door that creates a contest, with each option said in plain words."""
        from mt_eval_harness.contest_policy import PRIZE_DISPOSITIONS
        for verb in ("create", "prepare", "register"):
            text = " ".join(self._help(["contest", verb, "--help"]).split())
            assert "--prize-disposition" in text, verb
            assert "--prize-terms" in text, verb
            for disposition in PRIZE_DISPOSITIONS:
                assert disposition in text, f"{verb}: {disposition} not named"
            # The two narrow overrides, and nothing that reads as a matrix.
            assert "--prize-retention" in text, verb
            assert "--prize-release-timing" in text, verb
            assert "--prize-release-license" in text, verb
            assert "--prize-terms-url" in text, verb
            # No public wording may imply ONE mandatory condition.
            assert "NO declared term has no prize" in text, verb

    def test_the_retired_presets_are_named_nowhere(self):
        for verb in ("create", "prepare", "register"):
            text = " ".join(self._help(["contest", verb, "--help"]).split())
            assert "--prize-preset" not in text, verb
            assert "open | audit | community | strict" not in text, verb

    def test_prize_disposition_and_prize_terms_are_mutually_exclusive(self):
        parser = build_parser()
        args = parser.parse_args([
            "contest", "create", "--name", "N", "--corpus", "c",
            "--language-pair", "qaa>qab", "--prize-disposition", "retain_ip"])
        assert args.prize_disposition == "retain_ip" and args.prize_terms is None
        with pytest.raises(SystemExit):
            parser.parse_args([
                "contest", "create", "--name", "N", "--corpus", "c",
                "--language-pair", "qaa>qab",
                "--prize-disposition", "retain_ip",
                "--prize-terms", "terms.json"])

    def test_no_prize_terms_is_the_default_everywhere(self):
        parser = build_parser()
        for argv in (["contest", "create", "--name", "N", "--corpus", "c",
                      "--language-pair", "qaa>qab"],
                     ["contest", "register", "--manifest", "m.json"]):
            args = parser.parse_args(argv)
            assert args.prize_disposition is None
            assert args.prize_terms is None
            assert args.prize_retention is None
            assert args.prize_release_timing is None
            assert args.prize_release_license is None
            assert args.prize_terms_url is None

    def test_publication_promises_reach_prepare_and_register(self):
        """The two C5 promises `create` already carried are on the two doors
        that also create a contest, with the same vocabulary."""
        parser = build_parser()
        for verb, argv in (
            ("prepare", ["contest", "prepare", "--corpus", "m.json",
                         "--slug", "s", "--name", "N", "--pair", "qaa>qab",
                         "--dev-size", "4", "--seed", "7",
                         "--qualifier-threshold", "35", "--out", "o"]),
            ("register", ["contest", "register", "--manifest", "m.json"]),
        ):
            args = parser.parse_args(argv)
            if verb == "register":
                # Unset on register = "not given": it applies what `contest
                # prepare --no-register` recorded in the manifest, else the
                # same default (contest_prep.resolve_registration_choices).
                from mt_eval_harness.contest_prep import (
                    resolve_registration_choices)
                assert args.results_visibility is None
                assert args.anonymize_until_close is None
                reg, _ = resolve_registration_choices(
                    {}, {"results_visibility": None,
                         "anonymize_until_close": None})
                assert reg["results_visibility"] == "hidden_until_close"
                assert reg["anonymize_until_close"] is False
            else:
                # Unset on prepare too (Round 12): prepare prints each term
                # as given or default; the default it records is
                # REGISTRATION_DEFAULTS' (contest_prep.registration_term_lines).
                from mt_eval_harness.contest_prep import REGISTRATION_DEFAULTS
                assert args.results_visibility is None, verb
                assert args.anonymize_until_close is False, verb
                assert REGISTRATION_DEFAULTS["results_visibility"] == \
                    "hidden_until_close"
            text = " ".join(self._help(["contest", verb, "--help"]).split())
            assert "hidden_until_close" in text, verb
            assert "--anonymize-until-close" in text, verb

    @staticmethod
    def _prize_args(**kw):
        import argparse as _argparse
        base = {"prize_disposition": None, "prize_terms": None,
                "prize_retention": None, "prize_release_timing": None,
                "prize_release_license": None, "prize_terms_url": None}
        base.update(kw)
        return _argparse.Namespace(**base)

    def test_prize_terms_helper_prints_the_option_and_the_hash_first(self, capsys):
        """The organizer sees the option in plain language and the hash
        entrants will accept BEFORE anything is written."""
        from mt_eval_harness.contest_prize_terms import (
            DISPOSITION_HEADLINES, terms_sha256,
        )
        from mt_eval_harness.cli import _prize_terms_from_args
        terms = _prize_terms_from_args(
            self._prize_args(prize_disposition="release_open"))
        # What is RECORDED is the declared spelling, never the derived detail.
        assert terms == {"disposition": "release_open",
                         "release": "required_before_prize",
                         "release_license": "any_osi"}
        out = capsys.readouterr().out
        assert DISPOSITION_HEADLINES["release_open"] in out
        assert terms_sha256(terms) in out
        assert "--accept-terms" in out

    def test_prize_terms_helper_returns_none_when_nothing_is_declared(self):
        from mt_eval_harness.cli import _prize_terms_from_args
        assert _prize_terms_from_args(self._prize_args()) is None

    def test_an_override_without_an_option_is_refused(self):
        from mt_eval_harness.cli import _prize_terms_from_args
        with pytest.raises(ValueError) as exc:
            _prize_terms_from_args(
                self._prize_args(prize_retention="delete_after_scoring"))
        assert "--prize-disposition" in str(exc.value)

    def test_an_override_the_option_does_not_offer_is_refused(self):
        from mt_eval_harness.cli import _prize_terms_from_args
        with pytest.raises(ValueError) as exc:
            _prize_terms_from_args(self._prize_args(
                prize_disposition="pass_to_holders",
                prize_retention="delete_after_scoring"))
        assert "pass_to_holders" in str(exc.value)
        assert "retention" in str(exc.value)

    def test_the_allowed_overrides_are_applied(self, capsys):
        from mt_eval_harness.cli import _prize_terms_from_args
        assert _prize_terms_from_args(self._prize_args(
            prize_disposition="retain_ip",
            prize_retention="delete_after_scoring")) == {
                "disposition": "retain_ip",
                "retention": "delete_after_scoring"}
        assert _prize_terms_from_args(self._prize_args(
            prize_disposition="release_open",
            prize_release_timing="required_before_scores",
            prize_release_license="Apache-2.0",
            prize_terms_url="https://example.org/terms")) == {
                "disposition": "release_open",
                "release": "required_before_scores",
                "release_license": "Apache-2.0",
                "community_terms_url": "https://example.org/terms"}
        capsys.readouterr()

    def test_prize_terms_file_must_exist(self, tmp_path):
        from mt_eval_harness.cli import _prize_terms_from_args
        missing = tmp_path / "nope.json"
        with pytest.raises(ValueError) as exc:
            _prize_terms_from_args(self._prize_args(prize_terms=str(missing)))
        assert "does not exist" in str(exc.value)

    def test_prize_terms_file_is_parsed_and_hashed(self, tmp_path, capsys):
        import json as _json
        from mt_eval_harness.contest_prize_terms import terms_sha256
        from mt_eval_harness.cli import _prize_terms_from_args
        path = tmp_path / "terms.json"
        path.write_text(_json.dumps({"disposition": "pass_to_holders"}),
                        encoding="utf-8")
        terms = _prize_terms_from_args(self._prize_args(prize_terms=str(path)))
        assert terms == {"disposition": "pass_to_holders"}
        assert terms_sha256(terms) in capsys.readouterr().out

    def test_a_terms_file_naming_a_derived_key_is_refused(self, tmp_path):
        import json as _json
        from mt_eval_harness.cli import _prize_terms_from_args
        from mt_eval_harness.contest_prize_terms import PrizeTermsError
        path = tmp_path / "terms.json"
        path.write_text(_json.dumps({"disposition": "retain_ip",
                                     "rights": "assignment_to_host"}),
                        encoding="utf-8")
        with pytest.raises(PrizeTermsError) as exc:
            _prize_terms_from_args(self._prize_args(prize_terms=str(path)))
        assert "rights" in str(exc.value)

    def test_a_terms_file_and_a_flag_override_cannot_be_mixed(self, tmp_path):
        from mt_eval_harness.cli import _prize_terms_from_args
        path = tmp_path / "terms.json"
        path.write_text('{"disposition": "retain_ip"}', encoding="utf-8")
        with pytest.raises(ValueError) as exc:
            _prize_terms_from_args(self._prize_args(
                prize_terms=str(path), prize_retention="retain_sealed_audit"))
        assert "--prize-retention" in str(exc.value)


class TestOptionAbbreviation:
    """The main parser must not resolve subcommand flags as its own abbreviations.

    FINDING (measured 2026-09-07 on Python 3.12.3 in the air-gap guest — the
    version Ubuntu 24.04, the sovereign node's own OS, ships). argparse
    classifies every ``--token`` in argv against the MAIN parser before it
    hands the tail to a subcommand. With abbreviation on, the main parser's
    ~60 global options swallowed subcommand flags that were merely a PREFIX of
    one of them, and three SHIPPED commands died as "ambiguous option" on that
    Python while working on a newer one:

        mt-eval list datasets --source eng    (--source-file/-field/-code)
        mt-eval corpora --source … --target … (same)
        mt-eval contest rank <id> --metric …  (--metricx, --metricx-model)
        mt-eval node ceremony init --m 3      (--model, --max-tokens, …)

    These parse-only assertions pass on any Python once ``allow_abbrev`` is
    off; the attribute assertion is what actually holds the line, because on a
    newer interpreter the behavioural ones would pass either way.
    """

    def test_main_parser_does_not_abbreviate(self):
        assert build_parser().allow_abbrev is False

    @pytest.mark.parametrize("argv", [
        ["list", "datasets", "--source", "eng"],
        ["corpora", "--source", "eng", "--target", "crk"],
        ["contest", "rank", "c1", "--metric", "chrf_plus_plus"],
        ["node", "ceremony", "init", "--dir", "/tmp/x", "--set", "s",
         "--group", "g", "--m", "3", "--n", "5"],
    ])
    def test_shipped_flags_parse(self, argv):
        build_parser().parse_args(argv)

    def test_subcommand_abbreviation_still_works(self):
        # Turning it off on the MAIN parser does not disable it inside a
        # subcommand, where the option set is small and unambiguous.
        args = build_parser().parse_args(["run", "--mod", "gpt-4"])
        assert args.model == "gpt-4"


class TestContestRetiredWordingIsGone:
    """R2 retired `contest submit` and `contest submit-hypotheses`. The verbs
    were deleted in wave 1; this pins the HELP TEXT, which outlived them."""

    def _help(self, argv):
        import subprocess
        proc = subprocess.run(
            [sys.executable, "-m", "mt_eval_harness.cli", *argv, "--help"],
            capture_output=True, text=True, timeout=120)
        assert proc.returncode == 0, proc.stderr
        return " ".join(proc.stdout.split())

    def test_no_retired_path_survives_in_cli_source_undated(self):
        import inspect
        import mt_eval_harness.cli as cli_mod
        for line in inspect.getsource(cli_mod).splitlines():
            for retired in ("submit-hypotheses", "T1 record", "T1 standing",
                            "submit_to_contest"):
                if retired in line:
                    assert "RETIRED 2026-09-06" in line, (
                        f"undated mention of a retired entry path: {line!r}")

    def test_intake_verbs_describe_entries_not_uploads(self):
        """argparse shows a subcommand's help= on the PARENT listing, which is
        exactly where the retired wording lived."""
        text = self._help(["contest"])
        assert "submit-hypotheses uploads" not in text
        for phrase in ("Open ENTRY intake",
                       "Stop accepting NEW entries",
                       "further submit-model / submit-method proposals are "
                       "refused"):
            assert phrase in text, phrase

    def test_submit_method_is_gated_on_the_qualifier_receipt(self):
        text = self._help(["contest"])
        assert "gated on a published T1 record" not in text
        assert "Admission is your PASSING `contest qualify` receipt" in text
        assert "which the node re-executes on its own copy" in text

    def test_contest_usage_states_the_r2_flow(self):
        text = self._help(["contest"])
        assert "A CONTEST IS SOVEREIGN HOSTING" in text
        for step in ("contest qualify", "submit-model", "submit-method",
                     "node serve", "contest rank", "contest close"):
            assert step in text, step
        # The open board is named as the DIFFERENT thing it is.
        assert "open leaderboard" in text
        assert "corpus × pair direction" in text
        # And the retirement is stated with its date, not silently dropped.
        assert "RETIRED 2026-09-06" in text

    def test_rank_flags(self):
        text = " ".join(self._help(["contest", "rank", "--help"]).split())
        for flag in ("--metric", "--include-unverified", "--tie-test", "--n-resamples",
                     "--alpha", "--seed", "--no-segments", "--json",
                     "--phase", "--track", "--include-contrastive",
                     "--reveal-identities", "--i-am-the-organizer"):
            assert flag in text, flag
        assert "VERIFIED-ONLY" in text
        # The tie flags say whose rule wins: the contest's frozen promise.
        assert "frozen metadata.tie_test" in text
        assert "only a SMALLER alpha" in text
        assert "reproducibility promise" in text
        # --reveal-identities states the standing it needs.
        assert "you OWN the contest AND it is already closed" in text

    def test_close_and_export_flags(self):
        close = " ".join(self._help(["contest", "close", "--help"]).split())
        assert "--force" in close and "--yes" in close and "--include-unverified" in close
        assert "--reveal-identities" in close and "--no-reveal-identities" in close
        export = " ".join(self._help(["contest", "export", "--help"]).split())
        assert "--format" in export and "--out" in export
        assert "--phase" in export and "--track" in export
        for column in ("rank_min/rank_max", "is_primary", "prize_eligible",
                       "submitter_label_or_pseudonym"):
            assert column in export, column

    def test_parse_defaults(self):
        parser = build_parser()
        args = parser.parse_args(["contest", "rank", "c1"])
        assert args.contest_command == "rank"
        # None, not a value: the contest's own frozen policy governs, and a
        # CLI default must never silently overwrite a promise to entrants.
        assert args.tie_test is None and args.n_resamples is None
        assert args.alpha is None and args.seed is None
        assert args.include_unverified is False and args.json is False
        assert args.phase is None and args.track is None
        assert args.include_contrastive is False
        assert args.reveal_identities is False
        args = parser.parse_args(["contest", "create", "--name", "n", "--corpus", "c",
                                  "--language-pair", "a>b"])
        assert args.primary_metric == "chrf_plus_plus"
        args = parser.parse_args(["contest", "export", "c1", "--format", "csv"])
        assert args.format == "csv"

    def test_close_reveal_flags_are_tri_state(self):
        """Neither flag → None, so close_contest's own default governs."""
        parser = build_parser()
        assert parser.parse_args(["contest", "close", "c1"]).reveal_identities is None
        assert parser.parse_args(
            ["contest", "close", "c1", "--reveal-identities"]).reveal_identities is True
        assert parser.parse_args(
            ["contest", "close", "c1", "--no-reveal-identities"]).reveal_identities is False

    def test_view_flag_vocabularies_come_from_contest_policy(self):
        from mt_eval_harness.contest_policy import PHASE_NAMES, TRACKS
        parser = build_parser()
        for phase in PHASE_NAMES:
            assert parser.parse_args(["contest", "rank", "c1", "--phase", phase]).phase == phase
        assert parser.parse_args(["contest", "rank", "c1", "--phase", "all"]).phase == "all"
        for track in TRACKS:
            assert parser.parse_args(["contest", "rank", "c1", "--track", track]).track == track
        with pytest.raises(SystemExit):
            with patch("sys.stderr", new_callable=StringIO):
                parser.parse_args(["contest", "rank", "c1", "--phase", "warmup"])


class TestSubmissionDeclarationFlags:
    """`submit-method` and `submit-model` carry the entry declarations
    (contract C2, 2026-09-06): track, parameter count, weights licence,
    weights visibility, training data, primary/contrastive, system
    description, method release URL, and the qualifier-receipt options."""

    VERBS = ("submit-method", "submit-model")
    FLAGS = ("--track", "--parameter-count", "--weights-license",
             "--weights-public", "--weights-private", "--training-data-file",
             "--primary", "--contrastive", "--description-file",
             "--method-release-url", "--accept-terms", "--receipt-dir",
             "--offline-threshold", "--offline-qualifier-id")

    def _help(self, argv):
        parser = build_parser()
        with patch("sys.argv", ["mt-eval"] + argv), \
                patch("sys.stdout", new_callable=StringIO) as out:
            with pytest.raises(SystemExit) as ei:
                parser.parse_args(argv)
            assert ei.value.code == 0
            return out.getvalue()

    def test_both_verbs_list_every_declaration_flag(self):
        for verb in self.VERBS:
            text = self._help(["contest", verb, "--help"])
            for flag in self.FLAGS:
                assert flag in text, f"{verb} is missing {flag}"

    def test_help_says_what_is_checked_and_what_is_only_declared(self):
        for verb in self.VERBS:
            text = self._help(["contest", verb, "--help"])
            assert "constrained" in text and "unconstrained" in text
            assert "Recorded as your claim" in text
            assert "safetensors header" in text

    def test_model_help_says_the_parameter_count_is_cross_checked(self):
        # argparse re-wraps help text, so match on words, not on a phrase.
        text = " ".join(self._help(["contest", "submit-model", "--help"]).split())
        assert "safetensors header" in text
        assert "off by more than 1% is refused" in text
        # ...and WHICH count that is (Round 6: torch's count differs)
        assert "COUNTED THE WAY THE WEIGHTS FILE STORES THEM" in text

    def test_track_choices_are_the_closed_vocabulary(self):
        from mt_eval_harness.contest_declarations import TRACKS
        parser = build_parser()
        for verb, extra in (
                ("submit-method", ["--method-dir", "m", "--dockerfile", "d",
                                   "--entrypoint", "method/t.py"]),
                ("submit-model", ["--model-dir", "m",
                                  "--architecture", "MarianMTModel"])):
            for track in TRACKS:
                args = parser.parse_args(
                    ["contest", verb, "c1", "--name", "n", "--version", "1",
                     "--method-class", "pipeline", "--developer", "d",
                     "--node-id", "node-1", "--track", track,
                     "--parameter-count", "615000000",
                     "--weights-license", "Apache-2.0", "--weights-public"]
                    + extra)
                assert args.track == track
                assert args.parameter_count == 615000000
                assert args.weights_public is True
                assert args.is_primary is True
            with pytest.raises(SystemExit):
                parser.parse_args(
                    ["contest", verb, "c1", "--name", "n", "--version", "1",
                     "--method-class", "pipeline", "--developer", "d",
                     "--node-id", "node-1", "--track", "semi-constrained",
                     "--parameter-count", "1", "--weights-license", "MIT",
                     "--weights-public"] + extra)

    def test_weights_visibility_must_be_stated_and_cannot_be_both(self):
        parser = build_parser()
        base = ["contest", "submit-model", "c1", "--model-dir", "m",
                "--name", "n", "--version", "1", "--architecture", "Marian",
                "--method-class", "pipeline", "--developer", "d",
                "--node-id", "node-1", "--track", "unconstrained",
                "--parameter-count", "1", "--weights-license", "MIT"]
        with pytest.raises(SystemExit):        # neither
            parser.parse_args(base)
        with pytest.raises(SystemExit):        # both
            parser.parse_args(base + ["--weights-public", "--weights-private"])
        assert parser.parse_args(
            base + ["--weights-private"]).weights_public is False

    def test_contrastive_flips_is_primary(self):
        parser = build_parser()
        args = parser.parse_args(
            ["contest", "submit-model", "c1", "--model-dir", "m", "--name",
             "n", "--version", "1", "--architecture", "Marian",
             "--method-class", "pipeline", "--developer", "d", "--node-id",
             "node-1", "--track", "unconstrained", "--parameter-count", "1",
             "--weights-license", "MIT", "--weights-public", "--contrastive"])
        assert args.is_primary is False

    # -- prize terms are a dial (R1-amended, 2026-09-07) --------------------

    def test_accept_terms_takes_a_hash_and_is_optional(self):
        parser = build_parser()
        digest = "ab" * 32
        args = parser.parse_args(
            ["contest", "submit-model", "c1", "--model-dir", "m", "--name",
             "n", "--version", "1", "--architecture", "Marian",
             "--method-class", "pipeline", "--developer", "d", "--node-id",
             "node-1", "--track", "unconstrained", "--parameter-count", "1",
             "--weights-license", "MIT", "--weights-public",
             "--accept-terms", digest])
        assert args.accept_terms == digest
        bare = parser.parse_args(
            ["contest", "submit-model", "c1", "--model-dir", "m", "--name",
             "n", "--version", "1", "--architecture", "Marian",
             "--method-class", "pipeline", "--developer", "d", "--node-id",
             "node-1", "--track", "unconstrained", "--parameter-count", "1",
             "--weights-license", "MIT", "--weights-public"])
        assert bare.accept_terms is None

    def test_accept_terms_help_says_terms_are_per_contest(self):
        for verb in self.VERBS:
            text = " ".join(self._help(["contest", verb, "--help"]).split())
            assert "SHA256" in text
            assert "ONE of three options" in text
            assert "nothing is assumed on your behalf" in text
            assert "covered by method_sha" in text

    def test_no_help_text_claims_one_mandatory_prize_condition(self):
        """R1-amended: no surface may imply every contest transfers rights."""
        for verb in self.VERBS:
            text = " ".join(self._help(["contest", verb, "--help"]).split())
            assert "release_required_before_scores" not in text


class TestHumanEvalAndEditionReportVerbs:
    """The two verbs practices 9/11 added (2026-09-06):
    `contest select-for-human-eval` (allocate a human-evaluation budget over a
    frozen ranking, keeping tie groups whole, recording NO judgment) and
    `shared-task report` (the edition's Findings-style report from frozen
    snapshots only)."""

    def _help(self, argv):
        parser = build_parser()
        with patch("sys.argv", ["mt-eval"] + argv), \
                patch("sys.stdout", new_callable=StringIO) as out:
            with pytest.raises(SystemExit) as ei:
                parser.parse_args(argv)
            assert ei.value.code == 0
            return out.getvalue()

    def test_contest_help_lists_select_for_human_eval(self):
        text = self._help(["contest", "--help"])
        assert re.search(r"^\s+select-for-human-eval\s", text, re.M)
        # The honest headline rides the verb listing: a selection is not a
        # judgment, and the budget may legitimately be exceeded. (argparse
        # hard-wraps the listing, so compare on collapsed whitespace.)
        flat = " ".join(text.split())
        assert "Speaker Validation lane, which does not exist yet" in flat
        assert "keeping a tie group whole" in flat
        assert "so the selection may exceed the budget" in flat

    def test_select_for_human_eval_flags(self):
        text = self._help(["contest", "select-for-human-eval", "--help"])
        for flag in ("--budget", "--no-keep-tie-groups", "--json", "--write"):
            assert flag in text, flag
        flat = " ".join(text.split())
        assert "splits a tie group" in flat
        assert "contests.metadata.human_eval_selection" in flat
        assert "only after close" in flat

    def test_select_for_human_eval_parses(self):
        args = build_parser().parse_args(
            ["contest", "select-for-human-eval", "c1", "--budget", "8"])
        assert args.contest_command == "select-for-human-eval"
        assert args.budget == 8
        assert args.no_keep_tie_groups is False
        assert args.json is False and args.write is False

    def test_budget_is_required(self):
        with pytest.raises(SystemExit):
            build_parser().parse_args(
                ["contest", "select-for-human-eval", "c1"])

    def test_shared_task_help_lists_report(self):
        text = self._help(["shared-task", "--help"])
        assert re.search(r"^\s+report\s", text, re.M)
        flat = " ".join(text.split())
        assert "FROZEN ranking snapshots only" in flat
        assert "system descriptions verbatim" in flat

    def test_shared_task_report_flags(self):
        text = self._help(["shared-task", "report", "--help"])
        assert "--out" in text and "--set-url" in text
        flat = " ".join(text.split())
        assert "shared_tasks.report_url" in flat
        assert "<edition>-findings.md" in flat

    def test_shared_task_report_parses(self):
        args = build_parser().parse_args(
            ["shared-task", "report", "americasnlp-2026", "--out", "/tmp/x"])
        assert args.shared_task_command == "report"
        assert args.edition == "americasnlp-2026"
        assert args.out == "/tmp/x" and args.set_url is None

    def test_out_is_required(self):
        with pytest.raises(SystemExit):
            build_parser().parse_args(
                ["shared-task", "report", "americasnlp-2026"])

    def test_usage_lines_name_both_new_verbs(self):
        import inspect
        import mt_eval_harness.cli as cli_mod
        src = inspect.getsource(cli_mod)
        # A verb that exists but is missing from the no-subcommand usage line
        # is a verb nobody finds.
        assert "close,export,select-for-human-eval}" in src
        assert "shared-task {create,list,report}" in src


class TestContestPublicationFlags:
    """`contest create` carries the two publication PROMISES (contract C5,
    practices 2 and 6). They are flags on `create` because they are contest
    data frozen by migration 074 the moment the contest has entries."""

    def _help(self, argv):
        parser = build_parser()
        with patch("sys.argv", ["mt-eval"] + argv), \
                patch("sys.stdout", new_callable=StringIO) as out:
            with pytest.raises(SystemExit) as ei:
                parser.parse_args(argv)
            assert ei.value.code == 0
            return out.getvalue()

    def test_create_lists_both_flags(self):
        text = " ".join(self._help(["contest", "create", "--help"]).split())
        assert "--results-visibility {immediate,hidden_until_close}" in text
        assert "--anonymize-until-close" in text
        # The honest limit is IN the help, not only in the docs.
        assert "does NOT anonymise the public board" in text

    def test_create_defaults_hide_results_until_close(self):
        # A new contest withholds sealed-set scores unless the organizer asks
        # for a live board: an entrant who reads a score mid-contest can tune
        # against the sealed set, and that cannot be undone.
        args = build_parser().parse_args(
            ["contest", "create", "--name", "n", "--corpus", "c",
             "--language-pair", "a>b"])
        assert args.results_visibility == "hidden_until_close"
        assert args.anonymize_until_close is False

    def test_create_accepts_the_promises(self):
        args = build_parser().parse_args(
            ["contest", "create", "--name", "n", "--corpus", "c",
             "--language-pair", "a>b", "--results-visibility",
             "hidden_until_close", "--anonymize-until-close"])
        assert args.results_visibility == "hidden_until_close"
        assert args.anonymize_until_close is True

    def test_an_unknown_visibility_is_refused_by_the_parser(self):
        with pytest.raises(SystemExit):
            build_parser().parse_args(
                ["contest", "create", "--name", "n", "--corpus", "c",
                 "--language-pair", "a>b", "--results-visibility", "never"])


class TestContestValidateAndPrepareFlags:
    """The participant-run validator (practice 5) and the two prepare flags
    that declare the sealed holdout (7) and the third-party suites (14)."""

    def _help(self, argv):
        parser = build_parser()
        with patch("sys.argv", ["mt-eval"] + argv), \
                patch("sys.stdout", new_callable=StringIO) as out:
            with pytest.raises(SystemExit) as ei:
                parser.parse_args(argv)
            assert ei.value.code == 0
            return out.getvalue()

    def test_validate_is_listed(self):
        assert re.search(r"^\s+validate\s", self._help(["contest", "--help"]),
                         re.M)

    def test_validate_flags(self):
        text = self._help(["contest", "validate", "--help"])
        for flag in ("--lane", "--manifest", "--method-dir", "--dockerfile",
                     "--secret-set", "--contest", "--dev", "--dev-corpus",
                     "--system", "--method-class", "--paradigm",
                     "--offline-qualifier-id", "--offline-threshold",
                     "--receipt-dir", "--json"):
            assert flag in text, flag

    def test_validate_help_never_overclaims(self):
        text = " ".join(self._help(["contest", "validate", "--help"]).split())
        assert "rehearsal" in text.lower()
        assert "the node re-executes" in text.lower()

    def test_validate_parses_a_bare_path(self):
        args = build_parser().parse_args(["contest", "validate", "./bundle"])
        assert args.contest_command == "validate"
        assert args.path == "./bundle"
        assert args.method_dir == "method" and args.dockerfile == "Dockerfile"
        assert args.json is False

    def test_prepare_declares_holdout_and_suites(self):
        text = self._help(["contest", "prepare", "--help"])
        assert "--sealed-holdout-size" in text
        assert "--test-suite" in text
        args = build_parser().parse_args([
            "contest", "prepare", "--corpus", "m.json", "--slug", "s",
            "--name", "N", "--pair", "qaa>qab", "--dev-size", "4",
            "--secret-size", "6", "--sealed-holdout-size", "2",
            "--test-suite", "eval-a-v1", "--test-suite", "eval-b-v1",
            "--seed", "7", "--qualifier-threshold", "35", "--out", "o"])
        assert args.sealed_holdout_size == 2
        assert args.test_suite == ["eval-a-v1", "eval-b-v1"]

    def test_blind_size_is_optional_and_defaults_to_zero(self):
        """R2 retired the blind tier as a contest tier — a sovereign contest
        prepares a qualifier + a secret set and nothing source-public."""
        args = build_parser().parse_args([
            "contest", "prepare", "--corpus", "m.json", "--slug", "s",
            "--name", "N", "--pair", "qaa>qab", "--dev-size", "4",
            "--secret-size", "6", "--seed", "7",
            "--qualifier-threshold", "35", "--out", "o"])
        assert args.blind_size == 0
        assert "organizer diagnostic" in " ".join(
            self._help(["contest", "prepare", "--help"]).split())


class TestFlagsThatOnlyBreakOnTheNodesOwnPython:
    """Two rehearsal findings, pinned as CLI contracts (2026-09-07).

    `--m` / `--n` on `ceremony init` are one-letter option strings on a parser
    whose TOP level carries the `run` verb's --model/--max-tokens/--metricx…
    and --name/--no-cache…. On Python ≤ 3.12 — Ubuntu 24.04, which is the
    sovereign node's own OS — argparse resolves abbreviations against the main
    parser before dispatching, so `--m 3` is rejected as ambiguous ON THE NODE
    while working on a newer developer Python. `--quorum` / `--shares` collide
    with nothing.

    And every method bundle used to declare 8 GB of RAM because there was no
    flag to say otherwise, so a node with a smaller sandbox.max_ram_gb refused
    honest entries for a number nobody chose.
    """

    def _parse(self, argv):
        return build_parser().parse_args(argv)

    def test_ceremony_init_takes_unambiguous_names(self):
        args = self._parse(["node", "ceremony", "init", "--dir", "d",
                            "--set", "s", "--group", "g",
                            "--quorum", "3", "--shares", "5"])
        assert (args.m, args.n) == (3, 5)

    def test_the_unambiguous_names_are_not_prefixes_of_a_top_level_option(self):
        top = {a for act in build_parser()._actions for a in act.option_strings}
        for name in ("--quorum", "--shares"):
            assert not [o for o in top
                        if o != name and o.startswith(name)], name

    def test_ceremony_defaults_are_3_of_5(self):
        args = self._parse(["node", "ceremony", "init", "--dir", "d",
                            "--set", "s", "--group", "g"])
        assert (args.m, args.n) == (3, 5)

    def test_submit_method_declares_its_own_requirements(self):
        args = self._parse([
            "contest", "submit-method", "c1", "--method-dir", "m",
            "--dockerfile", "D", "--name", "n", "--version", "1",
            "--entrypoint", "e.py", "--method-class", "pipeline",
            "--developer", "dev", "--node-id", "node-1",
            "--track", "constrained", "--parameter-count", "1",
            "--weights-license", "CC0-1.0", "--weights-public",
            "--ram-gb", "1", "--disk-gb", "1", "--max-runtime-minutes", "10"])
        assert (args.ram_gb, args.disk_gb, args.max_runtime_minutes) == (1, 1, 10)
        assert args.gpu is False and args.gpu_memory_gb == 0

    def test_the_defaults_fit_the_shipped_node_template(self):
        """Round 3 (2026-10-03): the defaults used to be 8 GB / 10 GB / 120
        min while `node init` writes caps of 4 / 4 / 30, so a node configured
        from its own template refused every default-packaged entry. The
        defaults are now READ from that template's sandbox block."""
        import json as _json

        from mt_eval_harness import contest_node
        from mt_eval_harness.sandbox_runner import enforce_resource_caps
        args = self._parse([
            "contest", "submit-method", "c1", "--method-dir", "m",
            "--dockerfile", "D", "--name", "n", "--version", "1",
            "--entrypoint", "e.py", "--method-class", "pipeline",
            "--developer", "dev", "--node-id", "node-1",
            "--track", "constrained", "--parameter-count", "1",
            "--weights-license", "CC0-1.0", "--weights-public"])
        (entry,) = _json.loads(
            contest_node.node_template_text())["contests"].values()
        sandbox = entry["sandbox"]
        assert (args.ram_gb, args.disk_gb, args.max_runtime_minutes) == (
            sandbox["max_ram_gb"], sandbox["max_tmp_gb"],
            sandbox["max_runtime_minutes"])
        # …and the node accepts them (cpus is the node's own share).
        enforce_resource_caps(
            {"ramGB": args.ram_gb, "diskGB": args.disk_gb,
             "maxRuntimeMinutes": args.max_runtime_minutes},
            {**sandbox, "cpus": 1})


class TestRunPublishReachesTheBoard:
    """`run --publish` used to be unable to publish to the live board: it never
    passed the --prod opt-in, and the guard's SystemExit escaped the run."""

    def test_prod_and_anonymous_reach_publish(self, monkeypatch):
        from types import SimpleNamespace
        from mt_eval_harness import publish, runner
        seen = {}
        monkeypatch.setattr(publish, "publish_to_supabase",
                            lambda path, **kw: seen.update(kw) or {})
        cfg = SimpleNamespace(publish_prod=True, publish_anonymous=True)
        assert runner._auto_publish_report(cfg, "r_report.json") is True
        assert seen["yes_prod"] is True and seen["anonymous"] is True

    def test_prod_refusal_does_not_kill_the_run(self, monkeypatch, capsys):
        from types import SimpleNamespace
        from mt_eval_harness import publish, runner

        def refuse(path, **kw):
            raise SystemExit(2)
        monkeypatch.setattr(publish, "publish_to_supabase", refuse)
        cfg = SimpleNamespace(publish_prod=False, publish_anonymous=False)
        assert runner._auto_publish_report(cfg, "r_report.json") is False
        assert "mt-eval publish r_report.json --prod" in capsys.readouterr().out


class TestMainNeverShadowsModuleImports:
    """2026-10-03: every `mt-eval run` in the 0.2.0 release candidate crashed
    with UnboundLocalError: a branch of main() re-imported `contextlib`, which
    makes the name LOCAL to the whole 1,200-line function, so any path that
    skipped that branch and then used contextlib blew up. The suite never
    noticed because it calls the runner directly, not through main()."""

    def test_no_function_reimports_a_module_level_name(self):
        import ast
        from pathlib import Path
        import mt_eval_harness.cli as cli_mod
        tree = ast.parse(Path(cli_mod.__file__).read_text(encoding="utf-8"))
        top = set()
        for n in tree.body:
            if isinstance(n, ast.Import):
                top |= {a.asname or a.name.split(".")[0] for a in n.names}
            elif isinstance(n, ast.ImportFrom):
                top |= {a.asname or a.name for a in n.names}
        offenders = []
        for fn in (n for n in tree.body if isinstance(n, ast.FunctionDef)):
            for node in ast.walk(fn):
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    for a in node.names:
                        name = a.asname or (a.name.split(".")[0] if isinstance(node, ast.Import) else a.name)
                        if name in top:
                            offenders.append(f"{fn.name}:{node.lineno} re-imports {name}")
        assert offenders == [], offenders

    def test_run_through_main_fails_cleanly_not_with_a_crash(self, tmp_path, monkeypatch, capsys):
        import sys
        from mt_eval_harness import cli as cli_mod
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(sys, "argv", ["mt-eval", "run", "--corpus", str(tmp_path / "missing.json"),
                                          "--model", "stub", "--provider", "local", "--non-interactive"])
        try:
            cli_mod.main()
        except SystemExit:
            pass  # a clean, explained refusal is fine
        except UnboundLocalError as e:  # the 0.2.0-rc crash
            raise AssertionError(f"mt-eval run crashed through main(): {e}")


class TestDirectProvidersTakeTheirOwnModelNames:
    """A `--provider local` run with an Ollama-style model name was refused as
    'Unknown model' — the OpenRouter shortcut check ran for every provider."""

    def test_local_model_name_is_accepted(self):
        parser = build_parser()
        for model in ("llama3.1", "qwen2.5:7b", "stub-1"):
            args = parser.parse_args(["run", "--corpus", "x.json", "--provider", "local", "--model", model])
            config = args_to_config(args)
            assert not [e for e in config.validate() if "model id" in e], model

    def test_openrouter_still_checks_names(self):
        parser = build_parser()
        args = parser.parse_args(["run", "--corpus", "x.json", "--model", "definitely-not-a-model-xyz"])
        config = args_to_config(args)
        assert any("is not an OpenRouter model id" in e for e in config.validate())

    def test_no_provider_takes_an_alias_or_a_floating_id(self):
        # Founder ruling 2026-10-05: exact slugs only, on every provider.
        parser = build_parser()
        for provider, model, says in [
            ("openrouter", "gemini-pro", "Did you mean google/gemini-3.1-pro-preview"),
            ("local", "gpt", "Did you mean openai/gpt-5.5"),
            ("local", "llama3.1:latest", "is a floating model id"),
            ("openrouter", "~google/gemini-pro-latest", "is a floating model id"),
            ("openrouter", "google/gemini-3.1-pro-preview,claude-sonnet", "Did you mean anthropic/claude-sonnet-4"),
        ]:
            args = parser.parse_args(["run", "--corpus", "x.json", "--provider", provider, "--model", model])
            config = args_to_config(args)
            assert any(says in e for e in config.validate()), (provider, model)
