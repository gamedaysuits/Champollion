"""Regression tests for the 2026-06-12 harness integrity fixes.

Covers the failure modes surfaced by the baseline audit of 470 run reports
(scripts/lint_run_reports.py):

  1. Log-filename collisions: second-granular run ids let two concurrent
     runs overwrite each other's run/report halves (4 corrupted pairs).
  2. Vacuous runs: an all-error run (e.g. invalid model id) burned through
     the whole corpus and produced a publishable-looking report of 0.0s.
  3. Model slug fragmentation: alias spellings leaked into run logs and
     became distinct published model_slugs for one model.
  4. Eval-pack gate bypass: direct corpus file paths (the queue-contributor
     flow) skipped the FST/eval-pack gate entirely.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from mt_eval_harness.config import RunConfig, _check_eval_pack
from mt_eval_harness.pipeline import write_run_log
from mt_eval_harness.runner import _build_run_id


# ---------------------------------------------------------------------------
# 1. Collision-proof run ids and log writes
# ---------------------------------------------------------------------------

def _config(**overrides) -> RunConfig:
    defaults = dict(
        dataset="all",
        corpus_path="",
        model="google/gemini-3.5-flash",
        prompt_version="naive",
        batch_size=25,
    )
    defaults.update(overrides)
    return RunConfig(**defaults)


def test_run_ids_are_unique_within_one_second():
    config = _config()
    ids = {_build_run_id(config) for _ in range(50)}
    assert len(ids) == 50, "same-second run ids must not collide"


def test_run_id_keeps_human_readable_prefix():
    run_id = _build_run_id(_config())
    assert run_id.startswith("run_")
    assert "google_gemini35flash" in run_id
    assert "naive" in run_id


def test_write_run_log_never_overwrites(tmp_path):
    log_a = {"run_id": "run_x", "marker": "A"}
    log_b = {"run_id": "run_x", "marker": "B"}
    path_a = write_run_log(log_a, str(tmp_path))
    path_b = write_run_log(log_b, str(tmp_path))

    assert path_a != path_b
    assert json.loads(path_a.read_text())["marker"] == "A"
    assert json.loads(path_b.read_text())["marker"] == "B"
    # The bumped run_id is reflected inside the log so the
    # filename-stem == run_id invariant (linter `pair` check) holds.
    assert json.loads(path_b.read_text())["run_id"] == path_b.stem


# ---------------------------------------------------------------------------
# 2. Vacuous-run guards
# ---------------------------------------------------------------------------

def test_assemble_refuses_vacuous_report(tmp_path):
    from mt_eval_harness.publish import assemble_run_card

    stem = "run_20260612_000000_test_naive_all_b25"
    run_log = {
        "run_id": stem, "harness_version": "test", "config": {},
        "provenance": {}, "results": [],
    }
    report = {
        "run_id": stem, "config": {},
        "overall": {"total_entries": 4, "error_count": 4, "evaluated": 0,
                    "exact_match_rate": 0.0},
        "entries": [],
    }
    (tmp_path / f"{stem}.json").write_text(json.dumps(run_log))
    report_path = tmp_path / f"{stem}_report.json"
    report_path.write_text(json.dumps(report))

    with pytest.raises(ValueError, match="vacuous|evaluated=0"):
        assemble_run_card(report_path)


def test_batch_strategy_aborts_on_first_batch_fatal_error(monkeypatch, tmp_path):
    from mt_eval_harness.strategies.batch import BatchStrategy
    from mt_eval_harness.cache import ResultCache
    from mt_eval_harness.strategies import batch as batch_mod

    async def fake_call_openrouter(**kwargs):
        return {
            "error": 'HTTP 400: {"error":{"message":"not a valid model ID"}}',
            "content": "", "latency_s": 0.01,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "cost": 0},
        }

    monkeypatch.setattr(batch_mod, "call_openrouter", fake_call_openrouter)

    config = _config(batch_size=2, cache_enabled=False,
                     cache_dir=str(tmp_path / "cache"))
    entries = [{"id": str(i), "source": f"s{i}", "reference": f"r{i}"}
               for i in range(6)]

    async def run():
        return await BatchStrategy().execute(
            entries=entries, config=config, session=None, api_key="k",
            semaphore=asyncio.Semaphore(1), system_prompt="p", hooks=[],
            cache=ResultCache(config),
        )

    with pytest.raises(RuntimeError, match="First batch failed"):
        asyncio.run(run())


def test_batch_strategy_tolerates_transient_first_batch_error(monkeypatch, tmp_path):
    """5xx/429 errors keep the historical never-throw behavior."""
    from mt_eval_harness.strategies.batch import BatchStrategy
    from mt_eval_harness.cache import ResultCache
    from mt_eval_harness.strategies import batch as batch_mod

    calls = {"n": 0}

    async def flaky_call_openrouter(**kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"error": "HTTP 503: upstream overloaded", "content": "",
                    "latency_s": 0.01,
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "cost": 0}}
        return {"error": None, "content": "1. ok\n2. ok", "latency_s": 0.01,
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "cost": 0}}

    monkeypatch.setattr(batch_mod, "call_openrouter", flaky_call_openrouter)

    config = _config(batch_size=2, cache_enabled=False,
                     cache_dir=str(tmp_path / "cache"))
    entries = [{"id": str(i), "source": f"s{i}", "reference": f"r{i}"}
               for i in range(4)]

    async def run():
        return await BatchStrategy().execute(
            entries=entries, config=config, session=None, api_key="k",
            semaphore=asyncio.Semaphore(1), system_prompt="p", hooks=[],
            cache=ResultCache(config),
        )

    results, _hits = asyncio.run(run())
    assert len(results) == 4
    assert results[0]["error"]          # first batch carried the 503
    assert not results[2]["error"]      # second batch succeeded


# ---------------------------------------------------------------------------
# 3. Model slug canonicalization
# ---------------------------------------------------------------------------

def test_dry_run_canonicalizes_model_alias(tmp_path):
    from mt_eval_harness.runner import execute_run

    corpus = tmp_path / "corpus.json"
    corpus.write_text(json.dumps(
        [{"id": "1", "source": "hi", "reference": "hei"}]))

    # target_lang is supplied so the (now honest) dry-run pre-flight passes —
    # this test is about model-alias canonicalization, not the target_lang
    # gate. A bare corpus with no language metadata correctly fails dry-run.
    config = _config(model="gemini-flash", corpus_path=str(corpus),
                     target_lang="Norwegian",
                     dry_run=True, cache_dir=str(tmp_path / "cache"))
    result = asyncio.run(execute_run(config))
    assert result.get("dry_run") is True
    # The alias was rewritten to the canonical OpenRouter id before any
    # run id / log / fingerprint material was derived from it.
    assert config.model == "google/gemini-3.5-flash"


def test_mt_method_relabels_model_field(tmp_path):
    # Dress-rehearsal regression: a --method google-translate run left
    # config.model at the default LLM slug, which then published as the
    # run_cards.model_slug — so the engine showed on the leaderboard as a
    # Gemini LLM run. The runner must relabel config.model to the engine id.
    from mt_eval_harness.runner import execute_run

    corpus = tmp_path / "corpus.json"
    corpus.write_text(json.dumps(
        [{"id": "1", "source": "hi", "reference": "hei"}]))

    config = _config(model="gemini-flash", mt_method="google-translate",
                     corpus_path=str(corpus), target_lang="Norwegian",
                     dry_run=True, cache_dir=str(tmp_path / "cache"))
    result = asyncio.run(execute_run(config))
    assert result.get("dry_run") is True
    # model is the engine id, NOT the leftover LLM default — and display_model
    # / model_id agree, so the run id and the published card name the engine.
    assert config.model == "google-translate"
    assert config.display_model == "google-translate"
    assert config.model_id == "google-translate"


# ---------------------------------------------------------------------------
# 4. Eval-pack gate: consented auto-install
# ---------------------------------------------------------------------------

def _fake_pack_card(monkeypatch, installed: dict):
    from mt_eval_harness import language_cards, setup_wizard

    monkeypatch.setattr(
        language_cards, "get_eval_pack",
        lambda code: {"pythonDeps": {"definitely_not_installed_xyz": "xyz>=1"},
                      "requiresFst": False},
    )
    monkeypatch.setattr(language_cards, "get_name", lambda code: "Testish")

    def fake_install(code, interactive=True):
        installed["code"] = code
        installed["interactive"] = interactive
        return True

    monkeypatch.setattr(setup_wizard, "install_lang", fake_install)


def test_eval_pack_gate_raises_without_consent(monkeypatch):
    installed = {}
    _fake_pack_card(monkeypatch, installed)
    monkeypatch.delenv("CI", raising=False)
    monkeypatch.delenv("MT_EVAL_AUTO_SETUP", raising=False)

    entry = {"id": "fixture", "language_pair": {"target": "tst"}}
    with pytest.raises(RuntimeError, match="mt-eval setup --lang tst"):
        _check_eval_pack(entry, assume_yes=False)
    assert installed == {}, "must not install anything without consent"


def test_eval_pack_gate_auto_installs_with_consent(monkeypatch):
    installed = {}
    _fake_pack_card(monkeypatch, installed)
    monkeypatch.delenv("CI", raising=False)
    monkeypatch.delenv("MT_EVAL_AUTO_SETUP", raising=False)

    entry = {"id": "fixture", "language_pair": {"target": "tst"}}
    _check_eval_pack(entry, assume_yes=True)   # must not raise
    assert installed == {"code": "tst", "interactive": False}


def test_eval_pack_gate_honors_env_consent(monkeypatch):
    installed = {}
    _fake_pack_card(monkeypatch, installed)
    monkeypatch.setenv("MT_EVAL_AUTO_SETUP", "1")

    entry = {"id": "fixture", "language_pair": {"target": "tst"}}
    _check_eval_pack(entry, assume_yes=False)  # env consent suffices
    assert installed.get("code") == "tst"


# ---------------------------------------------------------------------------
# 5. Cache hits re-key onto the current corpus
# ---------------------------------------------------------------------------

def test_batch_cache_hits_rekey_entry_ids(tmp_path):
    """Cached batches carry the writing run's entry ids; a rebuilt corpus
    with identical source texts must get CURRENT ids, not resurrected
    stale ones (eng-tuk 2026-06-12 came back with pre-rebuild duplicate
    ids through the cache)."""
    from mt_eval_harness.cache import ResultCache
    from mt_eval_harness.strategies.batch import BatchStrategy

    config = _config(batch_size=2, cache_enabled=True,
                     cache_dir=str(tmp_path / "cache"))
    cache = ResultCache(config)
    sources = ["hello", "world"]
    cache.put_batch(sources, [
        {"id": "stale_dup", "predicted": "moi", "latency_s": 0.1,
         "usage": {}, "tool_calls": [], "tool_call_count": 0, "error": None,
         "metadata": {}},
        {"id": "stale_dup", "predicted": "maailma", "latency_s": 0.1,
         "usage": {}, "tool_calls": [], "tool_call_count": 0, "error": None,
         "metadata": {}},
    ])

    entries = [{"id": "fresh_1", "source": "hello", "reference": "moi"},
               {"id": "fresh_2", "source": "world", "reference": "maailma"}]

    async def run():
        return await BatchStrategy().execute(
            entries=entries, config=config, session=None, api_key="k",
            semaphore=asyncio.Semaphore(1), system_prompt="p", hooks=[],
            cache=ResultCache(config),
        )

    results, hits = asyncio.run(run())
    assert hits == 2
    assert [r["id"] for r in results] == ["fresh_1", "fresh_2"]
    assert [r["predicted"] for r in results] == ["moi", "maailma"]
    # Cache hits are flagged so cost accounting reports actual spend
    # accurately with the original price alongside.
    assert all(r["cached"] is True for r in results)
