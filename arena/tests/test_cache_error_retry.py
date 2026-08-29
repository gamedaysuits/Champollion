"""Regression tests: errored results are NEVER cached (token-economy fix H1).

Before this fix a failed entry was cached and served forever — the only
retry path was --no-cache, i.e. re-spending the ENTIRE corpus. Now:

  - ResultCache.put refuses errored results (single + tool-call strategies).
  - ResultCache.put_batch refuses a batch containing ANY errored entry
    (the batch cache format demands the full ordered batch, so per-entry
    filtering is impossible — the tradeoff is documented in cache.py).
  - Effect: a run with a transient failure, re-run with cache ON, retries
    exactly the failed entries via the API while successful entries are
    served from cache.
"""

from __future__ import annotations

import asyncio

from mt_eval_harness.cache import ResultCache
from mt_eval_harness.config import RunConfig


def _config(**overrides) -> RunConfig:
    defaults = dict(
        dataset="all",
        corpus_path="",
        model="google/gemini-3.5-flash",
        prompt_version="naive",
        batch_size=1,
    )
    defaults.update(overrides)
    return RunConfig(**defaults)


def _result(entry_id="1", predicted="ok", error=None) -> dict:
    return {
        "id": entry_id, "predicted": predicted, "latency_s": 0.1,
        "usage": {}, "tool_calls": [], "tool_call_count": 0,
        "error": error, "metadata": {},
    }


# ---------------------------------------------------------------------------
# Cache-level admission: the single choke point for every strategy
# ---------------------------------------------------------------------------

class TestCacheRefusesErrors:

    def test_put_refuses_error_keyed_result(self, tmp_path):
        cache = ResultCache(_config(cache_dir=str(tmp_path / "cache")))
        cache.put("hello", _result(error="HTTP 503: overloaded"))
        assert cache.get("hello") is None, "a failure must stay retryable"

    def test_put_refuses_error_marked_translation(self, tmp_path):
        # Belt and braces: the "[ERROR: ...]" translation marker alone
        # (error key cleared, e.g. by a hook) still blocks caching.
        cache = ResultCache(_config(cache_dir=str(tmp_path / "cache")))
        cache.put("hello", _result(predicted="[ERROR: HTTP 503]", error=None))
        assert cache.get("hello") is None

    def test_put_still_caches_clean_result(self, tmp_path):
        cache = ResultCache(_config(cache_dir=str(tmp_path / "cache")))
        cache.put("hello", _result(predicted="bonjour"))
        assert cache.get("hello")["predicted"] == "bonjour"

    def test_put_batch_refuses_when_any_entry_errored(self, tmp_path):
        cache = ResultCache(
            _config(batch_size=2, cache_dir=str(tmp_path / "cache")))
        sources = ["hello", "world"]
        cache.put_batch(sources, [
            _result("1", "bonjour"),
            _result("2", "[ERROR: HTTP 503: overloaded]",
                    error="HTTP 503: overloaded"),
        ])
        assert cache.get_batch(sources) is None, (
            "a batch with one failure must be re-runnable, not frozen")

    def test_put_batch_still_caches_clean_batch(self, tmp_path):
        cache = ResultCache(
            _config(batch_size=2, cache_dir=str(tmp_path / "cache")))
        sources = ["hello", "world"]
        cache.put_batch(sources, [_result("1", "bonjour"),
                                  _result("2", "monde")])
        cached = cache.get_batch(sources)
        assert cached is not None
        assert [r["predicted"] for r in cached] == ["bonjour", "monde"]


# ---------------------------------------------------------------------------
# Single strategy: failed entries retried, successes served from cache
# ---------------------------------------------------------------------------

def _run_single(entries, config, cache):
    from mt_eval_harness.strategies.single import SingleStrategy

    async def run():
        return await SingleStrategy().execute(
            entries=entries, config=config, session=None, api_key="k",
            semaphore=asyncio.Semaphore(1), system_prompt="p", hooks=[],
            cache=cache,
        )

    return asyncio.run(run())


def test_single_strategy_transient_failure_is_retried(monkeypatch, tmp_path):
    from mt_eval_harness.strategies import single as single_mod

    config = _config(cache_enabled=True, cache_dir=str(tmp_path / "cache"))
    entries = [{"id": "1", "source": "good text", "reference": "r1"},
               {"id": "2", "source": "flaky text", "reference": "r2"}]

    # Pass 1: "flaky text" fails with a transient error.
    async def flaky_call(**kwargs):
        text = kwargs["messages"][1]["content"]
        if text == "flaky text":
            return {"error": "HTTP 503: upstream overloaded", "content": "",
                    "latency_s": 0.01, "usage": {}}
        return {"error": None, "content": f"T:{text}", "latency_s": 0.01,
                "usage": {}}

    monkeypatch.setattr(single_mod, "call_openrouter", flaky_call)
    results, hits = _run_single(entries, config, ResultCache(config))
    assert hits == 0
    by_id = {r["id"]: r for r in results}
    assert by_id["1"]["error"] is None
    assert by_id["2"]["error"]

    # The failure must NOT be in the cache; the success must be.
    cache = ResultCache(config)
    assert cache.get("good text") is not None
    assert cache.get("flaky text") is None

    # Pass 2: API healthy again. ONLY the failed entry hits the API;
    # the successful one is served from cache.
    api_calls = []

    async def healthy_call(**kwargs):
        api_calls.append(kwargs["messages"][1]["content"])
        return {"error": None, "content": "T:recovered", "latency_s": 0.01,
                "usage": {}}

    monkeypatch.setattr(single_mod, "call_openrouter", healthy_call)
    results, hits = _run_single(entries, config, ResultCache(config))
    assert api_calls == ["flaky text"], (
        "only the previously-failed entry may be re-bought")
    assert hits == 1
    by_id = {r["id"]: r for r in results}
    assert by_id["1"]["cached"] is True
    assert by_id["2"]["error"] is None
    assert by_id["2"]["predicted"] == "T:recovered"


# ---------------------------------------------------------------------------
# Batch strategy: an errored batch is not cached, and is retried on re-run
# ---------------------------------------------------------------------------

def _run_batch(entries, config, cache):
    from mt_eval_harness.strategies.batch import BatchStrategy

    async def run():
        return await BatchStrategy().execute(
            entries=entries, config=config, session=None, api_key="k",
            semaphore=asyncio.Semaphore(1), system_prompt="p", hooks=[],
            cache=cache,
        )

    return asyncio.run(run())


def test_batch_strategy_errored_batch_is_retried(monkeypatch, tmp_path):
    from mt_eval_harness.strategies import batch as batch_mod

    config = _config(batch_size=2, cache_enabled=True,
                     cache_dir=str(tmp_path / "cache"))
    entries = [{"id": str(i), "source": f"s{i}", "reference": f"r{i}"}
               for i in range(4)]

    # Pass 1: batch 1 (s0, s1) succeeds; batch 2 (s2, s3) gets a transient
    # 503 — every entry in it carries the error.
    calls = {"n": 0}

    async def flaky_call(**kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            return {"error": "HTTP 503: upstream overloaded", "content": "",
                    "latency_s": 0.01,
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0}}
        return {"error": None, "content": "1. ok-a\n2. ok-b",
                "latency_s": 0.01,
                "usage": {"prompt_tokens": 1, "completion_tokens": 1}}

    monkeypatch.setattr(batch_mod, "call_openrouter", flaky_call)
    results, hits = _run_batch(entries, config, ResultCache(config))
    assert hits == 0
    assert not results[0]["error"] and not results[1]["error"]
    assert results[2]["error"] and results[3]["error"]

    # Only the CLEAN batch was cached; the errored one stays retryable.
    cache = ResultCache(config)
    assert cache.get_batch(["s0", "s1"]) is not None
    assert cache.get_batch(["s2", "s3"]) is None

    # Pass 2: API healthy. Batch 1 comes from cache, batch 2 is re-bought.
    api_calls = {"n": 0}

    async def healthy_call(**kwargs):
        api_calls["n"] += 1
        return {"error": None, "content": "1. fixed-a\n2. fixed-b",
                "latency_s": 0.01,
                "usage": {"prompt_tokens": 1, "completion_tokens": 1}}

    monkeypatch.setattr(batch_mod, "call_openrouter", healthy_call)
    results, hits = _run_batch(entries, config, ResultCache(config))
    assert api_calls["n"] == 1, "only the errored batch may be re-bought"
    assert hits == 2
    assert [r["error"] for r in results] == [None, None, None, None]
    assert results[2]["predicted"] == "fixed-a"
    assert results[3]["predicted"] == "fixed-b"
