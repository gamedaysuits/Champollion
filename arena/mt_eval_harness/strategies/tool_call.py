"""
Tool-Call Strategy -- Translate with tool-calling enabled.

Handles multi-round tool-calling loops where the model can invoke
registered tools (e.g., FST validation, dictionary lookup) during
translation. Each entry is processed individually because tool
conversations are inherently sequential per-entry.

Extracted from runner.py lines 525-565 + _translate_with_tools
(lines 285-406) of the original God Function.
"""
from __future__ import annotations

import asyncio
import json
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


class ToolCallStrategy:
    """Translate entries with tool-calling enabled.

    Each entry goes through a multi-round conversation where the model
    can invoke tools provided by the registered ToolProvider. The loop
    continues until the model produces a final answer or the maximum
    number of tool rounds is exhausted.
    """

    def __init__(self, tool_provider):
        self._tool_provider = tool_provider

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
        """Execute tool-calling translation for all entries.

        Returns:
            Tuple of (results list, cache_hits count).
        """
        total = len(entries)
        done_count = 0
        cache_hits = 0

        async def _process(entry: dict) -> dict:
            nonlocal done_count, cache_hits
            source_text = entry.get(config.source_field, "")

            # Check cache first
            cached = cache.get(source_text)
            if cached is not None:
                cache_hits += 1
                done_count += 1
                report_progress(done_count, total)
                cached["id"] = entry["id"]
                return cached

            # Execute the multi-round tool-calling loop
            result = await self._translate_with_tools(
                session, entry, config, system_prompt,
                api_key, semaphore, provider=provider,
            )

            result["raw_predicted"] = result.get("predicted", "")

            # Apply post-translation hooks
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
            result = await apply_hooks(
                entry, result, hooks, config,
                api_fn=api_fn,
            )

            cache.put(source_text, result)
            done_count += 1
            report_progress(done_count, total)
            return result

        tasks = [_process(e) for e in entries]
        results = await asyncio.gather(*tasks)
        return list(results), cache_hits

    async def _translate_with_tools(
        self,
        session: aiohttp.ClientSession,
        entry: dict,
        config: RunConfig,
        system_prompt: str,
        api_key: str,
        semaphore: asyncio.Semaphore,
        provider=None,
    ) -> dict:
        """Execute the multi-round tool-calling loop for a single entry.

        The model receives tool schemas on the first call and can invoke
        them across multiple rounds. Each tool call is executed via the
        registered ToolProvider and the result is fed back to the model.
        """
        tool_schemas = self._tool_provider.get_schemas(config)
        source_text = entry.get(config.source_field, "")

        # Use the explicit target language name if configured
        lang_label = config.target_lang or "the target language"
        user_msg = (
            f"Translate this text to {lang_label}:\n\n"
            f"{source_text}\n\n"
            f"Use your tools to verify your work. Output ONLY the translation."
        )

        messages = [
            build_system_message(system_prompt),
            {"role": "user", "content": user_msg},
        ]

        total_latency = 0.0
        total_usage: dict[str, int] = {}
        all_tool_calls = []
        tool_call_count = 0

        for round_num in range(config.max_tool_rounds):
            api_call = provider.call if provider else call_openrouter
            result = await api_call(
                session=session,
                messages=messages,
                model_id=config.model_id,
                api_key=api_key,
                semaphore=semaphore,
                max_tokens=config.max_tokens,
                temperature=config.effective_temperature,
                tools=tool_schemas if round_num == 0 or tool_call_count > 0 else None,
                provider_prefs=config.transmission_provider_prefs,
            )

            total_latency += result.get("latency_s", 0)
            if result.get("usage"):
                for k, v in result["usage"].items():
                    if isinstance(v, bool):
                        total_usage[k] = v  # Pass through flags
                    elif isinstance(v, (int, float)):
                        total_usage[k] = total_usage.get(k, 0) + v
                    # Skip nested dicts (e.g., prompt_tokens_details) —
                    # the top-level token counts are what we need for cost

            if result.get("error"):
                return {
                    "id": entry["id"],
                    "predicted": "",
                    "latency_s": total_latency,
                    "usage": total_usage,
                    "tool_calls": all_tool_calls,
                    "tool_call_count": tool_call_count,
                    "error": result["error"],
                    "metadata": {},
                }

            # Check if model produced a final answer (no tool calls)
            tool_calls_in_response = result.get("tool_calls", [])
            if not tool_calls_in_response:
                return {
                    "id": entry["id"],
                    "predicted": clean_response(result["content"]) if result["content"] else "",
                    "latency_s": total_latency,
                    "usage": total_usage,
                    "tool_calls": all_tool_calls,
                    "tool_call_count": tool_call_count,
                    "error": None,
                    "metadata": {},
                }

            # Model wants to use tools — execute each call
            messages.append({
                "role": "assistant",
                "content": result.get("content", ""),
                "tool_calls": tool_calls_in_response,
            })

            for tc in tool_calls_in_response:
                fn_name = tc["function"]["name"]
                try:
                    fn_args = json.loads(tc["function"]["arguments"])
                except (json.JSONDecodeError, KeyError):
                    fn_args = {}

                tool_result = await self._tool_provider.execute(fn_name, fn_args)
                tool_call_count += 1
                all_tool_calls.append({
                    "round": round_num,
                    "name": fn_name,
                    "arguments": fn_args,
                    "result": str(tool_result)[:500],  # Truncate for log size
                })

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "content": json.dumps(tool_result, default=str),
                })

        # Exhausted max rounds — return whatever the model last produced
        return {
            "id": entry["id"],
            "predicted": clean_response(result.get("content", "")) if result.get("content") else "",
            "latency_s": total_latency,
            "usage": total_usage,
            "tool_calls": all_tool_calls,
            "tool_call_count": tool_call_count,
            "error": None,
            "metadata": {"max_tool_rounds_reached": True},
        }
