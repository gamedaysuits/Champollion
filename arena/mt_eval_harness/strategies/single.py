"""
Single-Entry Strategy -- Translate one entry per API call.

This is the default execution mode (batch_size=1, no tools).
Each entry is translated independently with bounded concurrency
via asyncio.gather + semaphore.

Extracted from runner.py lines 607-641 (the else branch of the
original God Function).
"""
from __future__ import annotations

import asyncio
from typing import Any

import aiohttp

from mt_eval_harness.config import RunConfig
from mt_eval_harness.cache import ResultCache
from mt_eval_harness.api import (
    call_openrouter,
    build_system_message,
    clean_response,
)
from mt_eval_harness.pipeline import apply_hooks, report_progress


class SingleStrategy:
    """Translate entries one at a time with concurrent API calls.

    Concurrency is bounded by config.concurrency via a semaphore.
    Each entry checks the cache first and skips the API call on hit.
    """

    async def execute(
        self,
        entries: list[dict],
        config: RunConfig,
        *,
        session: aiohttp.ClientSession,
        api_key: str,
        semaphore: asyncio.Semaphore,
        system_prompt: str,
        hooks: list,
        cache: ResultCache,
        provider=None,
        **kwargs,
    ) -> tuple[list[dict], int]:
        """Execute single-entry translation for all entries.

        Returns:
            Tuple of (results list, cache_hits count).
        """
        total = len(entries)
        done_count = 0
        cache_hits = 0

        async def _process(entry: dict) -> dict:
            nonlocal done_count, cache_hits
            source_text = entry.get(config.source_field, "")

            # Check cache first — avoids redundant API calls
            cached = cache.get(source_text)
            if cached is not None:
                cache_hits += 1
                done_count += 1
                report_progress(done_count, total)
                cached["id"] = entry["id"]
                cached["cached"] = True
                return cached

            # Build messages for the LLM
            messages = [
                build_system_message(system_prompt),
                {"role": "user", "content": source_text},
            ]

            # Use provider.call() if available, else fall back to
            # call_openrouter for backward compatibility.
            api_call = provider.call if provider else call_openrouter
            result = await api_call(
                session=session,
                messages=messages,
                model_id=config.model_id,
                api_key=api_key,
                semaphore=semaphore,
                max_tokens=config.max_tokens,
                temperature=config.effective_temperature,
                provider_prefs=config.transmission_provider_prefs,
            )

            translated = {
                "id": entry["id"],
                "predicted": clean_response(result["content"]) if result["content"] else "",
                "latency_s": result["latency_s"],
                "usage": result["usage"],
                "tool_calls": [],
                "tool_call_count": 0,
                "error": result["error"],
                "metadata": {},
            }

            translated["raw_predicted"] = translated.get("predicted", "")

            # Apply post-translation hooks (e.g., grammar verification)
            api_fn = (
                (lambda **kw: provider.call(
                    session=session,
                    provider_prefs=config.transmission_provider_prefs,
                    **kw))
                if provider else
                (lambda **kw: call_openrouter(
                    session=session,
                    provider_prefs=config.transmission_provider_prefs,
                    **kw))
            )
            translated = await apply_hooks(
                entry, translated, hooks, config,
                api_fn=api_fn,
            )

            cache.put(source_text, translated)
            done_count += 1
            report_progress(done_count, total)
            return translated

        tasks = [_process(e) for e in entries]
        results = await asyncio.gather(*tasks)
        return list(results), cache_hits
