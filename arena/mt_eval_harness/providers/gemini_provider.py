"""
Google Gemini direct provider — calls the Gemini API.

Uses the Gemini REST API (generativelanguage.googleapis.com) to call
Gemini models directly without going through OpenRouter.

Requires: GEMINI_API_KEY environment variable or .env entry.
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


GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Approximate pricing (USD per 1M tokens) — updated 2026-06.
_GEMINI_FALLBACK_PRICING: dict[str, dict[str, float]] = {
    "gemini-2.5-flash":         {"input": 0.15,  "output": 0.60,  "cached": 0.04},
    "gemini-2.5-pro":           {"input": 1.25,  "output": 5.0,   "cached": 0.31},
    "gemini-3-flash-preview":   {"input": 0.15,  "output": 0.60,  "cached": 0.04},
    "gemini-3.1-pro-preview":   {"input": 1.25,  "output": 10.0,  "cached": 0.31},
}


class GeminiProvider(LLMProvider):
    """Direct Google Gemini API provider."""

    name = "gemini"
    supports_restricted_transmission = True
    transmission_basis = (
        "first-party Google Gemini API paid-tier terms (no training on API "
        "inputs; free-tier terms differ — the caller's key selects the tier)"
    )

    def load_api_key(self) -> str:
        key = os.environ.get("GEMINI_API_KEY")
        if key:
            return key
        # Also check GOOGLE_API_KEY (common alternative)
        key = os.environ.get("GOOGLE_API_KEY")
        if key:
            return key

        try:
            from dotenv import dotenv_values, find_dotenv
            for filename in (".env.local", ".env"):
                env_path = find_dotenv(filename=filename, usecwd=True)
                if env_path:
                    values = dotenv_values(env_path)
                    key = values.get("GEMINI_API_KEY") or values.get("GOOGLE_API_KEY")
                    if key:
                        return key
        except ImportError:
            pass

        raise RuntimeError(
            "GEMINI_API_KEY (or GOOGLE_API_KEY) not found. "
            "Set it as an environment variable or in .env / .env.local"
        )

    def strip_provider_prefix(self, model_id: str) -> str:
        """Strip 'google/' prefix — Gemini API uses bare model names."""
        if model_id.startswith("google/"):
            return model_id[len("google/"):]
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

        # Gemini API endpoint: /models/{model}:generateContent?key={key}
        url = f"{GEMINI_API_BASE}/{bare_model}:generateContent?key={api_key}"

        # Convert OpenAI messages to Gemini format
        system_text, gemini_contents = _convert_messages(messages)

        payload: dict[str, Any] = {
            "contents": gemini_contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            },
        }
        if system_text:
            payload["systemInstruction"] = {
                "parts": [{"text": system_text}]
            }
        # Tool calling support (Gemini format)
        if tools:
            payload["tools"] = [{"functionDeclarations": _convert_tools(tools)}]

        for attempt in range(MAX_RETRIES):
            async with semaphore:
                start = time.monotonic()
                try:
                    async with session.post(
                        url,
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

            # Parse Gemini response → standard result dict
            candidates = data.get("candidates", [])
            if not candidates:
                error_info = data.get("error", {})
                return {
                    "content": "",
                    "tool_calls": [],
                    "usage": _normalize_usage(data.get("usageMetadata", {})),
                    "latency_s": round(elapsed, 3),
                    "error": error_info.get("message", "No candidates in response"),
                    "finish_reason": "error",
                }

            candidate = candidates[0]
            content_parts = candidate.get("content", {}).get("parts", [])

            text_parts = []
            tool_calls = []
            for part in content_parts:
                if "text" in part:
                    text_parts.append(part["text"])
                elif "functionCall" in part:
                    fc = part["functionCall"]
                    tool_calls.append({
                        "id": f"call_{fc['name']}",
                        "type": "function",
                        "function": {
                            "name": fc["name"],
                            "arguments": json.dumps(fc.get("args", {})),
                        },
                    })

            # Map Gemini finish reasons to OpenAI format
            finish_reason_raw = candidate.get("finishReason", "STOP")
            finish_map = {
                "STOP": "stop",
                "MAX_TOKENS": "length",
                "SAFETY": "content_filter",
                "RECITATION": "content_filter",
            }

            return {
                "content": "\n".join(text_parts),
                "tool_calls": tool_calls,
                "usage": _normalize_usage(data.get("usageMetadata", {})),
                "latency_s": round(elapsed, 3),
                "error": None,
                "finish_reason": finish_map.get(finish_reason_raw, finish_reason_raw),
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
            f"google/{k}": v
            for k, v in _GEMINI_FALLBACK_PRICING.items()
        }


def _convert_messages(
    messages: list[dict],
) -> tuple[str, list[dict]]:
    """Convert OpenAI-style messages to Gemini format.

    Returns (system_text, gemini_contents).
    """
    system_parts = []
    contents = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "system":
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        system_parts.append(block["text"])
            else:
                system_parts.append(str(content))
        else:
            # Gemini uses "user" and "model" (not "assistant")
            gemini_role = "model" if role == "assistant" else "user"

            if isinstance(content, list):
                text = "\n".join(
                    b["text"] for b in content
                    if isinstance(b, dict) and b.get("type") == "text"
                )
            else:
                text = str(content) if content else ""

            contents.append({
                "role": gemini_role,
                "parts": [{"text": text}],
            })

    return "\n".join(system_parts), contents


def _convert_tools(openai_tools: list[dict]) -> list[dict]:
    """Convert OpenAI tool schemas to Gemini functionDeclaration format."""
    declarations = []
    for tool in openai_tools:
        if tool.get("type") == "function":
            func = tool["function"]
            declarations.append({
                "name": func["name"],
                "description": func.get("description", ""),
                "parameters": func.get("parameters", {"type": "object", "properties": {}}),
            })
    return declarations


def _normalize_usage(gemini_usage: dict) -> dict:
    """Convert Gemini usageMetadata to OpenAI usage format."""
    return {
        "prompt_tokens": gemini_usage.get("promptTokenCount", 0),
        "completion_tokens": gemini_usage.get("candidatesTokenCount", 0),
        "total_tokens": gemini_usage.get("totalTokenCount", 0),
    }
