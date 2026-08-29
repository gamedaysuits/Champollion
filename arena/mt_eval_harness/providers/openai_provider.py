"""
OpenAI direct provider — calls the OpenAI API without a proxy.

Uses the same retry/backoff logic and result dict shape as the
OpenRouter provider, but hits api.openai.com directly.

Requires: OPENAI_API_KEY environment variable or .env entry.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any

import aiohttp

from mt_eval_harness.providers.base import LLMProvider
from mt_eval_harness.api import MAX_RETRIES, RETRY_BASE_DELAY, retry_wait_seconds


OPENAI_DEFAULT_BASE = "https://api.openai.com/v1"

# Approximate pricing (USD per 1M tokens) — updated 2026-06.
# Used as fallback when the /models endpoint doesn't return pricing.
_OPENAI_FALLBACK_PRICING: dict[str, dict[str, float]] = {
    "gpt-5.5":                {"input": 2.0,   "output": 8.0,   "cached": 0.50},
    "gpt-5.5-mini":           {"input": 0.30,  "output": 1.25,  "cached": 0.075},
    "gpt-5":                  {"input": 10.0,  "output": 30.0,  "cached": 2.50},
    "o4-mini":                {"input": 1.10,  "output": 4.40,  "cached": 0.28},
    "o3":                     {"input": 10.0,  "output": 40.0,  "cached": 2.50},
}


def _load_env_key(env_var: str) -> str:
    """Load an API key from environment or .env files."""
    key = os.environ.get(env_var)
    if key:
        return key

    try:
        from dotenv import dotenv_values, find_dotenv
        for filename in (".env.local", ".env"):
            env_path = find_dotenv(filename=filename, usecwd=True)
            if env_path:
                values = dotenv_values(env_path)
                key = values.get(env_var)
                if key:
                    return key
    except ImportError:
        pass

    raise RuntimeError(
        f"{env_var} not found. "
        f"Set it as an environment variable or in .env / .env.local"
    )


class OpenAIProvider(LLMProvider):
    """Direct OpenAI provider — also the base for any OpenAI-compatible endpoint.

    Endpoint resolution (most specific wins): constructor ``base_url`` →
    ``OPENAI_API_BASE`` env → ``OPENAI_DEFAULT_BASE``. A user may pass either
    the ``/v1`` root or a full ``.../chat/completions`` URL; both normalize.
    """

    name = "openai"
    base_url_env = "OPENAI_API_BASE"
    api_key_env = "OPENAI_API_KEY"
    supports_restricted_transmission = True

    def __init__(
        self, base_url: str | None = None, api_key_required: bool = True
    ) -> None:
        resolved = base_url or os.environ.get(self.base_url_env) or OPENAI_DEFAULT_BASE
        resolved = resolved.rstrip("/")
        if resolved.endswith("/chat/completions"):
            resolved = resolved[: -len("/chat/completions")]
        self.base_url = resolved
        self.api_key_required = api_key_required
        # Restricted-transmission basis depends on where this instance
        # actually points: the vendor default endpoint is covered by the
        # vendor's API terms (no training on API customer content); an
        # overridden endpoint is a channel the caller explicitly chose.
        if self.base_url == OPENAI_DEFAULT_BASE.rstrip("/"):
            self.transmission_basis = (
                "first-party OpenAI API terms (no training on API inputs)"
            )
        else:
            self.transmission_basis = (
                f"caller-directed OpenAI-compatible endpoint ({self.base_url}) — "
                "the caller chose where this text goes"
            )

    def _endpoint(self) -> str:
        return f"{self.base_url}/chat/completions"

    def load_api_key(self) -> str:
        if not self.api_key_required:
            # Local / no-auth OpenAI-compatible servers (Ollama, vLLM, LM Studio)
            # ignore the key. Use a real one if set (some gateways require it),
            # else a harmless placeholder. Never raise in local mode.
            try:
                return _load_env_key(self.api_key_env)
            except RuntimeError:
                return "not-needed"
        return _load_env_key(self.api_key_env)

    def strip_provider_prefix(self, model_id: str) -> str:
        """Strip 'openai/' prefix — OpenAI API uses bare model names."""
        if model_id.startswith("openai/"):
            return model_id[len("openai/"):]
        return model_id

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
        provider_prefs: dict | None = None,  # accepted, unused: first-party channel (see base)
    ) -> dict[str, Any]:
        bare_model = self.strip_provider_prefix(model_id)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # OpenAI uses structured content blocks differently from OpenRouter.
        # Convert cache_control content blocks to plain text for OpenAI,
        # since OpenAI doesn't support OpenRouter's cache_control format.
        sanitized_messages = _sanitize_messages(messages)

        payload: dict[str, Any] = {
            "model": bare_model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": sanitized_messages,
        }
        if tools:
            payload["tools"] = tools

        for attempt in range(MAX_RETRIES):
            async with semaphore:
                start = time.monotonic()
                try:
                    async with session.post(
                        self._endpoint(),
                        headers=headers,
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=timeout_s),
                    ) as resp:
                        elapsed = time.monotonic() - start

                        if resp.status == 429:
                            # Honor Retry-After (direct providers have tight
                            # limits) then retry, else exponential backoff.
                            await asyncio.sleep(retry_wait_seconds(attempt, resp.headers))
                            continue

                        if resp.status != 200:
                            body = await resp.text()
                            if resp.status >= 500 and attempt < MAX_RETRIES - 1:
                                await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))
                                continue
                            return {
                                "content": "",
                                "tool_calls": [],
                                "usage": {},
                                "latency_s": round(elapsed, 3),
                                "error": f"HTTP {resp.status}: {body[:300]}",
                                "finish_reason": "error",
                            }

                        data = await resp.json()

                except asyncio.TimeoutError:
                    elapsed = time.monotonic() - start
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))
                        continue
                    return {
                        "content": "",
                        "tool_calls": [],
                        "usage": {},
                        "latency_s": round(elapsed, 3),
                        "error": f"Timeout after {timeout_s}s",
                        "finish_reason": "timeout",
                    }
                except Exception as e:
                    elapsed = time.monotonic() - start
                    return {
                        "content": "",
                        "tool_calls": [],
                        "usage": {},
                        "latency_s": round(elapsed, 3),
                        "error": str(e),
                        "finish_reason": "error",
                    }

            # Parse response — OpenAI uses the same shape as OpenRouter
            usage = data.get("usage", {})
            choices = data.get("choices", [])
            if not choices:
                return {
                    "content": "",
                    "tool_calls": [],
                    "usage": usage,
                    "latency_s": round(elapsed, 3),
                    "error": "No choices in response",
                    "finish_reason": "error",
                }

            msg = choices[0].get("message", {})
            finish_reason = choices[0].get("finish_reason", "stop")
            content = msg.get("content") or ""
            tool_calls = msg.get("tool_calls", [])

            return {
                "content": content,
                "tool_calls": tool_calls,
                "usage": usage,
                "latency_s": round(elapsed, 3),
                "error": None,
                "finish_reason": finish_reason,
                "raw_message": msg,
            }

        return {
            "content": "",
            "tool_calls": [],
            "usage": {},
            "latency_s": 0,
            "error": f"Exhausted {MAX_RETRIES} retries",
            "finish_reason": "error",
        }

    async def fetch_pricing(
        self,
        session: aiohttp.ClientSession,
        api_key: str,
    ) -> dict[str, dict[str, float]]:
        # OpenAI doesn't expose a pricing API — use fallback table.
        # Prefix with openai/ to match MODEL_REGISTRY format.
        return {
            f"openai/{k}": v for k, v in _OPENAI_FALLBACK_PRICING.items()
        }


def _sanitize_messages(messages: list[dict]) -> list[dict]:
    """Convert OpenRouter-style cache_control messages to OpenAI format.

    OpenRouter accepts system messages with content as a list of blocks
    including cache_control. OpenAI expects content as a plain string.
    """
    sanitized = []
    for msg in messages:
        content = msg.get("content")
        if isinstance(content, list):
            # Extract text from structured content blocks
            text_parts = []
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    text_parts.append(block["text"])
            sanitized.append({**msg, "content": "\n".join(text_parts)})
        else:
            sanitized.append(msg)
    return sanitized
