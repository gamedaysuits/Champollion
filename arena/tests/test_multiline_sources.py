"""Multi-line sources are translated whole (0.2), not truncated to one line.

Before 0.2 a document-level segment lost everything after its first line: the
batch prompt numbers items one line each, and clean_response kept one line.
About 250 registry datasets are document-level (smol-doc, bsd), so chrF on
them measured first lines only.
"""

from __future__ import annotations

import asyncio
import re

from mt_eval_harness.api import clean_response, source_line_count
from mt_eval_harness.cache import ResultCache
from mt_eval_harness.config import RunConfig
from mt_eval_harness.strategies import batch as batch_mod
from mt_eval_harness.strategies import single as single_mod
from mt_eval_harness.strategies.batch import BatchStrategy


def test_source_line_count_ignores_blank_lines():
    assert source_line_count("one line") == 1
    assert source_line_count("a\n\nb\nc\n") == 3
    assert source_line_count("") == 1


def test_single_line_behaviour_is_unchanged():
    assert clean_response("Bonjour.\nHello again") == "Bonjour."
    assert clean_response('"Bonjour."') == "Bonjour."


def test_multi_line_keeps_as_many_lines_as_the_source_and_no_more():
    reply = "Ligne un.\nLigne deux.\nLigne trois.\n(alt: Ligne 3 bis)"
    assert clean_response(reply, expected_lines=3) == "Ligne un.\nLigne deux.\nLigne trois."
    assert clean_response("Seule ligne.", expected_lines=3) == "Seule ligne."


def _config(tmp_path, **kw):
    return RunConfig(dataset="all", corpus_path="", model="google/gemini-3.5-flash",
                     prompt_version="naive", batch_size=kw.pop("batch_size", 3),
                     cache_enabled=False, cache_dir=str(tmp_path / "cache"), **kw)


def test_batch_routes_multi_line_sources_to_single_and_keeps_order(monkeypatch, tmp_path):
    seen_batch, seen_single = [], []

    async def fake_batch_call(**kw):
        seen_batch.append(kw["messages"][-1]["content"])
        n = int(re.search(r"each of these (\d+) phrases", kw["messages"][-1]["content"]).group(1))
        return {"error": None, "latency_s": 0.0,
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
                "content": "\n".join(f"{i + 1}. T{i}" for i in range(n))}

    async def fake_single_call(**kw):
        seen_single.append(kw["messages"][-1]["content"])
        return {"error": None, "latency_s": 0.0,
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
                "content": "Para un.\nPara deux.\nextra line"}

    monkeypatch.setattr(batch_mod, "call_openrouter", fake_batch_call)
    monkeypatch.setattr(single_mod, "call_openrouter", fake_single_call)
    config = _config(tmp_path)
    entries = [{"id": "0", "source": "s0"},
               {"id": "1", "source": "First paragraph.\nSecond paragraph."},
               {"id": "2", "source": "s2"},
               {"id": "3", "source": "s3"}]

    async def run():
        return await BatchStrategy().execute(
            entries=entries, config=config, session=None, api_key="k",
            semaphore=asyncio.Semaphore(1), system_prompt="p", hooks=[],
            cache=ResultCache(config))

    results, _ = asyncio.run(run())
    assert [r["id"] for r in results] == ["0", "1", "2", "3"]
    assert results[1]["predicted"] == "Para un.\nPara deux."
    assert seen_single == ["First paragraph.\nSecond paragraph."]
    assert all("Second paragraph" not in m for m in seen_batch)
