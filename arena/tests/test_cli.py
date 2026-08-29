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
    MODEL_REGISTRY,
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
        args = parser.parse_args(["run", "--corpus", "x.json", "-m", "claude-opus-4.6"])
        assert args.model == "claude-opus-4.6"

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
            ["run", "--corpus", "x.json", "-p", "champollion",
             "--coaching-file", "c.txt"]
        )
        config = args_to_config(args)

        assert config.prompt_version == "champollion"
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

    def test_list_models_shows_all_registry_entries(self, capsys):
        cmd_list("models")
        out = capsys.readouterr().out

        for short_name in MODEL_REGISTRY:
            assert short_name in out, f"Model '{short_name}' not in list output"

    def test_list_models_marks_default(self, capsys):
        cmd_list("models")
        out = capsys.readouterr().out

        assert "(default)" in out
        assert DEFAULT_MODEL in out

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
        # Should show registry but NOT attempt OpenRouter fetch
        assert "registry shortcuts" in out.lower()

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
            main()
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
