"""
LLMProvider — abstract base class for all LLM API providers.

Every provider must implement:
    - load_api_key() → str: Load the provider's API key from env/.env
    - call() → dict: Make a single API call, return standard result dict
    - fetch_pricing() → dict: Fetch/return model pricing table

The result dict from call() MUST have this shape (matching api.py's
call_openrouter return type exactly, so strategies need zero changes):

    {
        "content": str,           # text response
        "tool_calls": list[dict], # tool call requests
        "usage": dict,            # {prompt_tokens, completion_tokens, ...}
        "latency_s": float,       # request duration in seconds
        "error": str | None,      # error message or None
        "finish_reason": str,     # "stop", "error", "timeout", etc.
    }
"""

from __future__ import annotations

import abc
import asyncio
from typing import Any

import aiohttp


class LLMProvider(abc.ABC):
    """Abstract base class for LLM API providers.

    Each provider wraps a specific API (OpenRouter, OpenAI, Anthropic,
    Google Gemini) behind a uniform interface. The harness strategies
    call provider.call() instead of call_openrouter() directly.
    """

    # Human-readable name for logs and run cards
    name: str = "unknown"

    # --- Transmission policy (transmission_policy.py) ---
    # Whether this channel may carry a RESTRICTED corpus (NC / no-deriv /
    # sealed / quarantined / unknown-license — content we may not let a
    # provider retain or train on). False by default so a future provider
    # must state its basis explicitly before restricted text can flow
    # through it; the runner refuses restricted runs on unsupported
    # providers. `transmission_basis` is the one-line justification recorded
    # in the RunLog.
    supports_restricted_transmission: bool = False
    transmission_basis: str = "unverified channel"

    @abc.abstractmethod
    def load_api_key(self) -> str:
        """Load and return the API key for this provider.

        Should check environment variables first, then .env/.env.local
        files. Raises RuntimeError if no key is found.
        """

    @abc.abstractmethod
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
        """Make a single LLM API call with retry logic.

        ``provider_prefs`` carries transmission-policy routing preferences.
        Only proxy channels act on it (OpenRouter attaches it as the
        request's ``provider`` object); first-party vendor APIs accept and
        ignore it — their channel basis is the vendor's own API terms
        (see ``transmission_basis``).

        Returns the standard result dict (see module docstring).
        """

    @abc.abstractmethod
    async def fetch_pricing(
        self,
        session: aiohttp.ClientSession,
        api_key: str,
    ) -> dict[str, dict[str, float]]:
        """Fetch or return model pricing table.

        Returns dict mapping model_id to pricing info:
            {"input": float, "output": float, "cached": float}
        All values in USD per 1M tokens.
        """

    def strip_provider_prefix(self, model_id: str) -> str:
        """Strip provider prefix from a model ID if present.

        OpenRouter uses 'vendor/model' format. Direct providers may
        need to strip the vendor prefix (e.g., 'openai/gpt-5.5' → 'gpt-5.5').
        Default implementation returns model_id unchanged.
        """
        return model_id
