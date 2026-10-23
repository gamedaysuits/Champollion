"""
OpenRouter provider — wraps the existing api.py functions.

This is the default provider. It proxies requests through OpenRouter,
which supports any model from any vendor with a single API key.

No new code here — just delegates to the battle-tested api.py functions.
"""

from __future__ import annotations

import asyncio
from typing import Any

import aiohttp

from mt_eval_harness.providers.base import LLMProvider
from mt_eval_harness.api import (
    call_openrouter,
    fetch_pricing as _fetch_pricing,
    load_api_key as _load_api_key,
)


class OpenRouterProvider(LLMProvider):
    """OpenRouter proxy — the harness's original (and default) provider."""

    name = "openrouter"
    # Proxy channel: restricted corpora are carried ONLY because every such
    # request pins provider_prefs {"data_collection": "deny"}, which routes
    # exclusively to providers that do not TRAIN on prompts. This is not a
    # no-retention guarantee — see transmission_policy.py for the exact scope.
    supports_restricted_transmission = True
    transmission_basis = (
        "OpenRouter routing pinned to data_collection=deny providers (no-training, not no-retention)"
    )

    def load_api_key(self) -> str:
        return _load_api_key()

    async def call(
        self,
        session: aiohttp.ClientSession,
        messages: list[dict],
        model_id: str,
        api_key: str,
        semaphore: asyncio.Semaphore,
        max_tokens: int = 13680,
        temperature: float = 0.0,
        tools: list[dict] | None = None,
        timeout_s: float = 600,
        provider_prefs: dict | None = None,
    ) -> dict[str, Any]:
        # Delegate directly to the existing, well-tested call_openrouter.
        return await call_openrouter(
            session=session,
            messages=messages,
            model_id=model_id,
            api_key=api_key,
            semaphore=semaphore,
            max_tokens=max_tokens,
            temperature=temperature,
            tools=tools,
            timeout_s=timeout_s,
            provider_prefs=provider_prefs,
        )

    async def fetch_pricing(
        self,
        session: aiohttp.ClientSession,
        api_key: str,
    ) -> dict[str, dict[str, float]]:
        return await _fetch_pricing(session, api_key)
