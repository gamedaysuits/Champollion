"""
Batch Strategy -- Translate multiple entries per API call.

Groups entries into batches of config.batch_size and sends them
as numbered lists in a single API call. The response is parsed
to extract individual translations.

Extracted from runner.py lines 567-605 (the batch_size > 1
branch of the original God Function).
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
    parse_numbered_response,
)
from mt_eval_harness.pipeline import apply_hooks, report_progress


def _chunk(items: list, size: int) -> list[list]:
    """Split a list into chunks of the given size."""
    return [items[i:i + size] for i in range(0, len(items), size)]


def _split_usage(usage: dict, n: int) -> dict:
    """Divide a batch-level usage dict across n entries.

    The API returns one usage dict per batch call (tokens, cost).
    We divide numeric fields by n so that summing across entries
    gives the correct total, not total × batch_size.
    """
    if not usage or n <= 1:
        return usage

    split = {}
    for key, val in usage.items():
        if isinstance(val, bool):
            # bool is a subclass of int — check first to avoid dividing
            split[key] = val
        elif isinstance(val, (int, float)):
            split[key] = val / n
        elif isinstance(val, dict):
            # Recurse into nested dicts (e.g. prompt_tokens_details,
            # completion_tokens_details, cost_details)
            split[key] = _split_usage(val, n)
        else:
            # Non-numeric fields (e.g. is_byok) pass through unchanged
            split[key] = val
    return split

class BatchStrategy:
    """Translate entries in batches using numbered-list format.

    Batches are processed sequentially (not concurrent) because each
    batch is already a multi-entry API call. Cache operates at the
    batch level — if all entries in a batch are cached, the API
    call is skipped entirely.
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
        """Execute batched translation for all entries.

        Returns:
            Tuple of (results list, cache_hits count).
        """
        total = len(entries)
        done_count = 0
        cache_hits = 0
        all_results = []

        batches = _chunk(entries, config.batch_size)

        for batch in batches:
            source_texts = [e.get(config.source_field, "") for e in batch]

            # Check batch-level cache
            cached = cache.get_batch(source_texts)
            if cached is not None:
                # Cached results carry the entry ids of the run that wrote
                # them; a corpus rebuilt with the same source texts but new
                # ids would resurrect the stale ones (eng-tuk 2026-06-12
                # came back with its pre-rebuild duplicate ids). Re-key the
                # cached model outputs onto the CURRENT batch entries, as
                # the single strategy already does.
                rekeyed = [
                    {**result, "id": entry["id"], "cached": True}
                    for result, entry in zip(cached, batch)
                ]
                cache_hits += len(batch)
                all_results.extend(rekeyed)
                done_count += len(batch)
                report_progress(done_count, total)
                continue

            # Build the numbered-list prompt
            n = len(batch)
            numbered = "\n".join(
                f"{i+1}. {s}" for i, s in enumerate(source_texts)
            )
            # Use the explicit target language name if configured, otherwise
            # fall back to generic wording (matches system prompt behavior)
            lang_label = config.target_lang or "the target language"
            user_msg = (
                f"Translate each of these {n} phrases to {lang_label}.\n\n"
                f"{numbered}\n\n"
                f"Reply with EXACTLY {n} numbered lines. Each line: just the number "
                f"and the translation. No explanations, no extra text."
            )

            messages = [
                build_system_message(system_prompt),
                {"role": "user", "content": user_msg},
            ]

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

            if result["error"]:
                # A config-shaped failure (bad model id, bad key, no credit)
                # on the very first batch will fail every later batch the
                # same way — abort now instead of grinding through the whole
                # corpus into a vacuous all-error run. Transient errors
                # (429/5xx/timeouts) keep the never-throw behavior.
                err_text = str(result["error"])
                fatal = any(f"HTTP {code}" in err_text
                            for code in (400, 401, 402, 403, 404))
                if fatal and not all_results and not cache_hits:
                    raise RuntimeError(
                        f"First batch failed for all {n} entries "
                        f"({err_text[:160]}); aborting before sending the "
                        f"remaining {total - n} entries. Check the model id, "
                        "API key, and account credit."
                    )
                # All entries in this batch get the same error.
                # Divide usage across entries so cost aggregation is correct.
                per_usage = _split_usage(result["usage"], n)
                results = [
                    {
                        "id": e["id"],
                        "predicted": f"[ERROR: {result['error']}]",
                        "latency_s": round(result["latency_s"] / n, 3),
                        "usage": per_usage,
                        "tool_calls": [],
                        "tool_call_count": 0,
                        "error": result["error"],
                        "metadata": {"batch_index": i, "batch_usage": result["usage"]},
                    }
                    for i, e in enumerate(batch)
                ]
            else:
                translations = parse_numbered_response(result["content"], n)
                per_latency = round(result["latency_s"] / n, 3)
                # Divide usage across entries so cost aggregation is correct.
                # The undivided batch_usage is preserved in metadata for auditing.
                per_usage = _split_usage(result["usage"], n)
                results = [
                    {
                        "id": batch[i]["id"],
                        "predicted": clean_response(translations[i]),
                        "latency_s": per_latency,
                        "usage": per_usage,
                        "tool_calls": [],
                        "tool_call_count": 0,
                        "error": None,
                        "metadata": {"batch_index": i, "batch_usage": result["usage"]},
                    }
                    for i in range(n)
                ]

            # Store raw predictions before any hooks are applied
            for res in results:
                res["raw_predicted"] = res.get("predicted", "")

            # Apply post-translation hooks to each result
            for hook in hooks:
                hooked = []
                for entry, res in zip(batch, results):
                    if not res.get("error"):
                        api_fn_hook = (
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
                        res = await hook.process(
                            entry, res, config,
                            api_fn=api_fn_hook,
                        )
                    hooked.append(res)
                results = hooked

            cache.put_batch(source_texts, results)
            all_results.extend(results)
            done_count += len(batch)
            report_progress(done_count, total)

        return all_results, cache_hits
