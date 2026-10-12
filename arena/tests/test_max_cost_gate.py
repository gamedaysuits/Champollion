"""Tests: pre-spend cost estimate + the --max-cost gate (token-economy fix H2).

Covers:
  - api.estimate_run_cost: entries × heuristic tokens × model price;
    un-priceable model / MT engine / method plugin → (None, basis) —
    UNKNOWN, never a fabricated $0; already-cached entries subtracted
    via cheap existence checks.
  - runner._enforce_max_cost: no cap → no-op; estimate over cap → abort;
    estimate UNKNOWN while a cap is set → abort too (unknown ≠ free, the
    queue_runner.select_items budget discipline).
  - Dry-run output carries est_cost_usd + est_basis (runner return dict
    and the --json summary shape).
  - The --max-cost CLI flag reaches RunConfig.max_cost.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from mt_eval_harness.api import _FALLBACK_PRICING, estimate_run_cost
from mt_eval_harness.cache import ResultCache
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import _enforce_max_cost

# A model that is guaranteed priceable offline (embedded fallback table).
PRICED_MODEL = "anthropic/claude-sonnet-4"
UNPRICED_MODEL = "totally/unpriced-model-xyz"

assert PRICED_MODEL in _FALLBACK_PRICING


def _config(**overrides) -> RunConfig:
    defaults = dict(
        dataset="all",
        corpus_path="",
        model=PRICED_MODEL,
        prompt_version="naive",
        batch_size=1,
    )
    defaults.update(overrides)
    return RunConfig(**defaults)


def _entries(n=4, text="hello world, this is a sentence."):
    return [{"id": str(i), "source": text, "reference": "ref"}
            for i in range(n)]


# ---------------------------------------------------------------------------
# estimate_run_cost
# ---------------------------------------------------------------------------

class TestEstimateRunCost:

    def test_priced_model_yields_positive_estimate(self):
        est, basis = estimate_run_cost(
            _entries(), _config(), system_prompt="Translate to French.")
        assert est is not None and est > 0
        assert "heuristic" in basis
        assert PRICED_MODEL in basis

    def test_unpriced_model_is_unknown_never_zero(self):
        est, basis = estimate_run_cost(
            _entries(), _config(model=UNPRICED_MODEL), system_prompt="p")
        assert est is None, "un-priceable must be UNKNOWN (None), never $0"
        assert "no price data" in basis

    def test_mt_engine_is_unknown(self):
        est, basis = estimate_run_cost(
            _entries(), _config(mt_method="google-translate"))
        assert est is None
        assert "google-translate" in basis

    def test_method_plugin_is_unknown(self):
        est, basis = estimate_run_cost(
            _entries(), _config(method_path="/some/plugin"))
        assert est is None
        assert "plugin" in basis

    def test_more_entries_cost_more(self):
        small, _ = estimate_run_cost(_entries(2), _config(), system_prompt="p")
        large, _ = estimate_run_cost(_entries(20), _config(), system_prompt="p")
        assert large > small

    def test_cached_entries_are_subtracted_single(self, tmp_path):
        config = _config(cache_dir=str(tmp_path / "cache"))
        entries = [{"id": str(i), "source": f"sentence number {i}",
                    "reference": "r"} for i in range(4)]
        cache = ResultCache(config)
        full, _ = estimate_run_cost(
            entries, config, system_prompt="p", cache=cache)
        cache.put(entries[0]["source"], {"predicted": "x"})
        reduced, basis = estimate_run_cost(
            entries, config, system_prompt="p", cache=cache)
        assert reduced < full
        assert "1 already-cached" in basis

    def test_cached_batches_are_subtracted(self, tmp_path):
        config = _config(batch_size=2, cache_dir=str(tmp_path / "cache"))
        entries = [{"id": str(i), "source": f"sentence number {i}",
                    "reference": "r"} for i in range(4)]
        cache = ResultCache(config)
        full, _ = estimate_run_cost(
            entries, config, system_prompt="p", cache=cache)
        cache.put_batch(
            [entries[0]["source"], entries[1]["source"]],
            [{"id": "0", "predicted": "a", "error": None},
             {"id": "1", "predicted": "b", "error": None}],
        )
        reduced, basis = estimate_run_cost(
            entries, config, system_prompt="p", cache=cache)
        assert reduced < full
        assert "2 already-cached" in basis


# ---------------------------------------------------------------------------
# _enforce_max_cost
# ---------------------------------------------------------------------------

class TestEnforceMaxCost:

    def test_no_cap_is_a_noop(self):
        _enforce_max_cost(_config(), 999.0, "basis")       # no raise
        _enforce_max_cost(_config(), None, "unknown")      # no raise either

    def test_estimate_over_cap_aborts(self):
        config = _config(max_cost=0.5)
        with pytest.raises(RuntimeError, match=r"exceeds --max-cost") as exc:
            _enforce_max_cost(config, 1.25, "basis text")
        assert exc.value.kind == "max-cost-exceeded"
        # The message shows estimate vs cap.
        assert "$1.2500" in str(exc.value)
        assert "$0.5" in str(exc.value)

    def test_estimate_under_cap_passes(self):
        _enforce_max_cost(_config(max_cost=0.5), 0.4999, "basis")  # no raise

    def test_unknown_estimate_with_cap_aborts(self):
        # Unknown ≠ free — same discipline as queue budget mode.
        config = _config(max_cost=1.0)
        with pytest.raises(RuntimeError, match="UNKNOWN") as exc:
            _enforce_max_cost(config, None, "no price data for model X")
        assert exc.value.kind == "max-cost-unknown"
        assert "without --max-cost" in str(exc.value)


# ---------------------------------------------------------------------------
# Dry-run integration: estimate surfaces + the gate fires pre-flight
# ---------------------------------------------------------------------------

def _dry_run(tmp_path, **config_overrides):
    from mt_eval_harness.runner import execute_run

    corpus = tmp_path / "corpus.json"
    corpus.write_text(json.dumps(
        [{"id": "1", "source": "hello there, friend of mine",
          "reference": "hei"}]))
    config = _config(
        corpus_path=str(corpus), target_lang="Norwegian", dry_run=True,
        cache_dir=str(tmp_path / "cache"), **config_overrides)
    return asyncio.run(execute_run(config))


def test_dry_run_reports_cost_estimate(tmp_path):
    result = _dry_run(tmp_path)
    assert result["dry_run"] is True
    assert isinstance(result["est_cost_usd"], float)
    assert result["est_cost_usd"] > 0
    assert "heuristic" in result["est_basis"]


def test_dry_run_unpriced_model_reports_unknown_not_zero(tmp_path):
    result = _dry_run(tmp_path, model=UNPRICED_MODEL)
    assert result["est_cost_usd"] is None, "unknown must be null, never 0"
    assert "no price data" in result["est_basis"]


def test_dry_run_without_cap_is_unchanged_for_unpriced_model(tmp_path):
    # No --max-cost → an un-priceable model still dry-runs fine.
    result = _dry_run(tmp_path, model=UNPRICED_MODEL)
    assert result["dry_run"] is True


def test_max_cost_gate_aborts_before_any_spend(tmp_path):
    with pytest.raises(RuntimeError, match=r"exceeds --max-cost") as exc:
        _dry_run(tmp_path, max_cost=0.0000001)
    assert exc.value.kind == "max-cost-exceeded"


def test_max_cost_gate_aborts_on_unknown_estimate(tmp_path):
    with pytest.raises(RuntimeError, match="UNKNOWN") as exc:
        _dry_run(tmp_path, model=UNPRICED_MODEL, max_cost=5.0)
    assert exc.value.kind == "max-cost-unknown"


# ---------------------------------------------------------------------------
# CLI wiring: flag → config; --json dry-run summary carries the estimate
# ---------------------------------------------------------------------------

class TestCliWiring:

    def test_max_cost_flag_reaches_config(self):
        from mt_eval_harness.cli import build_parser, args_to_config
        args = build_parser().parse_args(
            ["run", "--corpus", "c.json", "--max-cost", "0.75"])
        config = args_to_config(args)
        assert config.max_cost == 0.75

    def test_no_flag_means_no_cap(self):
        from mt_eval_harness.cli import build_parser, args_to_config
        args = build_parser().parse_args(["run", "--corpus", "c.json"])
        config = args_to_config(args)
        assert config.max_cost is None

    def test_json_summary_carries_estimate_for_dry_run(self):
        from mt_eval_harness.cli import _run_json_summary
        payload = _run_json_summary([{
            "dry_run": True, "entry_count": 3,
            "est_cost_usd": 0.12, "est_basis": "heuristic: ...",
            "contamination": None, "relative_only": False, "lane": None,
        }], multi=False)
        assert payload["est_cost_usd"] == 0.12
        assert payload["est_basis"] == "heuristic: ..."

    def test_json_summary_unknown_estimate_is_null(self):
        from mt_eval_harness.cli import _run_json_summary
        payload = _run_json_summary([{
            "dry_run": True, "entry_count": 3,
            "est_cost_usd": None, "est_basis": "UNKNOWN — no price data",
            "contamination": None, "relative_only": False, "lane": None,
        }], multi=False)
        assert payload["est_cost_usd"] is None


def test_validate_rejects_non_positive_max_cost():
    errors = _config(max_cost=-1.0).validate()
    assert any("max_cost" in e for e in errors)
    errors = _config(max_cost=0.0).validate()
    assert any("max_cost" in e for e in errors)
