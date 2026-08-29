"""
Anthropic direct provider — calls the Anthropic Messages API.

The Anthropic API uses a different request shape from OpenAI/OpenRouter:
    - System prompt is a top-level field, not a message
    - Content blocks have a different format
    - Response shape differs (content[0].text vs choices[0].message.content)

This provider translates between the harness's OpenAI-style messages and
Anthropic's native format, returning the standard result dict.

Requires: ANTHROPIC_API_KEY environment variable or .env entry.
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


ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_API_VERSION = "2023-06-01"

# Approximate pricing (USD per 1M tokens) — updated 2026-06.
_ANTHROPIC_FALLBACK_PRICING: dict[str, dict[str, float]] = {
    "claude-opus-4":       {"input": 15.0,  "output": 75.0,  "cached": 1.88},
    "claude-sonnet-4":     {"input": 3.0,   "output": 15.0,  "cached": 0.38},
    "claude-haiku-3.5":    {"input": 0.80,  "output": 4.0,   "cached": 0.10},
}


class AnthropicProvider(LLMProvider):
    """Direct Anthropic Messages API provider."""

    name = "anthropic"
    supports_restricted_transmission = True
    transmission_basis = (
        "first-party Anthropic API terms (no training on API inputs)"
    )

    def load_api_key(self) -> str:
        key = os.environ.get("ANTHROPIC_API_KEY")
        if key:
            return key

        try:
            from dotenv import dotenv_values, find_dotenv
            for filename in (".env.local", ".env"):
                env_path = find_dotenv(filename=filename, usecwd=True)
                if env_path:
                    values = dotenv_values(env_path)
                    key = values.get("ANTHROPIC_API_KEY")
                    if key:
                        return key
        except ImportError:
            pass

        raise RuntimeError(
            "ANTHROPIC_API_KEY not found. "
            "Set it as an environment variable or in .env / .env.local"
        )

    def strip_provider_prefix(self, model_id: str) -> str:
        """Strip 'anthropic/' prefix — Anthropic API uses bare model names."""
        if model_id.startswith("anthropic/"):
            return model_id[len("anthropic/"):]
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
            "x-api-key": api_key,
            "anthropic-version": ANTHROPIC_API_VERSION,
            "Content-Type": "application/json",
        }

        # Convert OpenAI-style messages to Anthropic format:
        # - Extract system message to top-level field
        # - Convert remaining messages to Anthropic content blocks
        system_text, anthropic_messages = _convert_messages(messages)

        payload: dict[str, Any] = {
            "model": bare_model,
            "max_tokens": max_tokens,
            "messages": anthropic_messages,
        }
        if system_text:
            payload["system"] = system_text
        if temperature > 0:
            payload["temperature"] = temperature
        if tools:
            # Anthropic tool format differs slightly — convert
            payload["tools"] = _convert_tools(tools)

        for attempt in range(MAX_RETRIES):
            async with semaphore:
                start = time.monotonic()
                try:
                    async with session.post(
                        ANTHROPIC_API_URL,
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

            # Parse Anthropic response → standard result dict
            usage = _normalize_usage(data.get("usage", {}))
            content_blocks = data.get("content", [])

            # Extract text from content blocks
            text_parts = []
            tool_calls = []
            for block in content_blocks:
                if block.get("type") == "text":
                    text_parts.append(block["text"])
                elif block.get("type") == "tool_use":
                    tool_calls.append({
                        "id": block.get("id"),
                        "type": "function",
                        "function": {
                            "name": block.get("name"),
                            "arguments": json.dumps(block.get("input", {})),
                        },
                    })

            stop_reason = data.get("stop_reason", "end_turn")
            # Map Anthropic stop reasons to OpenAI finish reasons
            finish_map = {
                "end_turn": "stop",
                "max_tokens": "length",
                "stop_sequence": "stop",
                "tool_use": "tool_calls",
            }

            return {
                "content": "\n".join(text_parts),
                "tool_calls": tool_calls,
                "usage": usage,
                "latency_s": round(elapsed, 3),
                "error": None,
                "finish_reason": finish_map.get(stop_reason, stop_reason),
                "raw_message": {"content": "\n".join(text_parts), "tool_calls": tool_calls},
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
        return {
            f"anthropic/{k}": v
            for k, v in _ANTHROPIC_FALLBACK_PRICING.items()
        }


def _convert_messages(
    messages: list[dict],
) -> tuple[str, list[dict]]:
    """Convert OpenAI-style messages to Anthropic format.

    Returns (system_text, anthropic_messages).
    System messages are extracted as a top-level string.
    """
    system_parts = []
    anthropic_msgs = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "system":
            # Extract text from structured or plain content
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        system_parts.append(block["text"])
            else:
                system_parts.append(str(content))
        else:
            # Non-system messages: convert content to plain string
            if isinstance(content, list):
                text = "\n".join(
                    b["text"] for b in content
                    if isinstance(b, dict) and b.get("type") == "text"
                )
            else:
                text = str(content) if content else ""

            anthropic_msgs.append({"role": role, "content": text})

    return "\n".join(system_parts), anthropic_msgs


def _convert_tools(openai_tools: list[dict]) -> list[dict]:
    """Convert OpenAI tool schemas to Anthropic format."""
    anthropic_tools = []
    for tool in openai_tools:
        if tool.get("type") == "function":
            func = tool["function"]
            anthropic_tools.append({
                "name": func["name"],
                "description": func.get("description", ""),
                "input_schema": func.get("parameters", {"type": "object", "properties": {}}),
            })
    return anthropic_tools


def _normalize_usage(anthropic_usage: dict) -> dict:
    """Convert Anthropic usage format to OpenAI format."""
    return {
        "prompt_tokens": anthropic_usage.get("input_tokens", 0),
        "completion_tokens": anthropic_usage.get("output_tokens", 0),
        "total_tokens": (
            anthropic_usage.get("input_tokens", 0)
            + anthropic_usage.get("output_tokens", 0)
        ),
    }
