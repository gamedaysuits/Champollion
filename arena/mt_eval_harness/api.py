"""
Async OpenRouter API Client — Unified HTTP layer for LLM calls.

Consolidates the duplicated API patterns from raw_llm_baseline.py,
v6_fst_gate.py, and v7_agent.py into a single, well-tested client.

Features:
    - Request construction with prompt caching (cache_control: ephemeral)
    - Automatic rate limit retry with exponential backoff
    - Timeout handling (configurable per call type)
    - Response parsing and error normalization
    - Dynamic pricing via OpenRouter /api/v1/models endpoint
    - Cost estimation from token counts + pricing data

Design decisions:
    - aiohttp session is managed externally (passed in, not owned)
    - Pricing table is fetched once per session, cached in memory
    - All errors are caught and returned as structured dicts (never throws)
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import aiohttp


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

# Timeout for standard (non-tool) calls
DEFAULT_TIMEOUT_S = 600
# Timeout for tool-calling calls (shorter, they're iterative)
TOOL_TIMEOUT_S = 120

# Maximum retry attempts for transient errors (429, 5xx)
MAX_RETRIES = 5
# Base delay for exponential backoff (seconds)
RETRY_BASE_DELAY = 2.0
# Hard cap on any single backoff sleep. A server can return a large
# Retry-After (or a long exponential at high attempt counts); never strand a
# donate worker longer than this on one transient error.
RETRY_MAX_WAIT = 60.0


def retry_wait_seconds(attempt: int, headers=None) -> float:
    """Seconds to wait before retrying a transient error (429 / 5xx).

    Graceful rate-limiting: honor the server's ``Retry-After`` header when
    present (integer/float seconds or an HTTP-date) so we wait exactly as long
    as the provider asks — instead of the blind exponential that either
    re-hammers a 429 (too short, causing a 429-storm) or stalls the run (too
    long). Falls back to exponential backoff (``RETRY_BASE_DELAY * 2**attempt``)
    when there's no usable header. Always clamped to ``RETRY_MAX_WAIT``.

    This is the single source of truth for backoff timing across every provider
    (api.call_openrouter + providers/{openai,anthropic,gemini}); they all import
    it so rate-limit behavior can never diverge between providers.
    """
    ra = None
    try:
        if headers is not None:
            ra = headers.get("Retry-After")
    except Exception:
        ra = None
    if ra:
        # Integer / float seconds form (the common case).
        try:
            return max(0.0, min(float(ra), RETRY_MAX_WAIT))
        except (TypeError, ValueError):
            pass
        # HTTP-date form ("Wed, 21 Oct 2026 07:28:00 GMT").
        try:
            from email.utils import parsedate_to_datetime
            from datetime import datetime, timezone

            when = parsedate_to_datetime(ra)
            if when is not None:
                delta = (when - datetime.now(timezone.utc)).total_seconds()
                if delta > 0:
                    return min(delta, RETRY_MAX_WAIT)
        except Exception:
            pass
    return min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_WAIT)


# ---------------------------------------------------------------------------
# API key loader
# ---------------------------------------------------------------------------

def load_api_key() -> str:
    """Load OpenRouter API key from environment or .env / .env.local file.

    Search order:
        1. OPENROUTER_API_KEY environment variable
        2. .env.local in current directory or any parent
        3. .env in current directory or any parent
    """
    key = os.environ.get("OPENROUTER_API_KEY")
    if key:
        return key

    # Use python-dotenv to search from CWD upward
    try:
        from dotenv import dotenv_values
        for filename in (".env.local", ".env"):
            from dotenv import find_dotenv
            env_path = find_dotenv(filename=filename, usecwd=True)
            if env_path:
                values = dotenv_values(env_path)
                key = values.get("OPENROUTER_API_KEY")
                if key:
                    return key
    except ImportError:
        pass

    raise RuntimeError(
        "OPENROUTER_API_KEY not found. "
        "Set it as an environment variable or in .env / .env.local"
    )


# ---------------------------------------------------------------------------
# Response cleaning — language-agnostic output extraction
# ---------------------------------------------------------------------------

# English reasoning prefixes that models may emit before translation output.
# NOT used by default — callers must opt in by passing these to clean_response().
#
# WARNING: These patterns will silently strip legitimate translations in
# any Latin-script target language where translations commonly start with
# "the", "for", "this", etc. Only use for non-Latin target languages
# (e.g., Plains Cree syllabics, Arabic, CJK) where English prefixes are
# unambiguously model reasoning, not translation output.
ENGLISH_REASONING_PATTERNS = [
    "let me", "now ", "perfect", "based on", "i need", "i'll ",
    "the ", "for ", "here ", "so ", "first", "next", "this ",
    "using ", "since ", "checking", "looking", "translat",
    "sure", "of course", "certainly", "okay", "alright",
]

# Default: no reasoning filtering. Markdown cleanup only.
# This prevents silent data corruption for Latin-script target languages.
_DEFAULT_REASONING_PATTERNS: list[str] = []


def clean_response(content: str, reasoning_patterns: list[str] | None = None) -> str:
    """Extract the translation from a model response.

    Language-agnostic strategy:
        1. Strip markdown formatting (bold, backticks, quotes)
        2. If single line, return it
        3. If multi-line and reasoning_patterns provided, skip lines
           matching those patterns and return the first non-reasoning line
        4. If no reasoning patterns (default), return the first line
        5. Fall back to the last line

    Args:
        content: Raw model response text.
        reasoning_patterns: Optional list of lowercase prefixes to filter
            as reasoning lines. Defaults to empty (no filtering).
            Pass ENGLISH_REASONING_PATTERNS for non-Latin targets.
            Pass a custom list for your specific source language.

    Note: Reasoning filtering is the caller's responsibility. The default
    behavior is safe for all script systems. If your target language uses
    a non-Latin script, you can safely pass ENGLISH_REASONING_PATTERNS.
    For Latin-script targets, implement filtering as a PostTranslationHook
    with language-specific logic.
    """
    if not content:
        return ""
    content = content.strip().strip('"').strip("'").strip("`")
    # Strip markdown bold wrapping
    if content.startswith("**") and content.endswith("**"):
        content = content[2:-2].strip()
    lines = [l.strip() for l in content.split("\n") if l.strip()]
    if not lines:
        return content
    if len(lines) == 1:
        return lines[0]

    # Multi-line: skip reasoning, return first non-reasoning line
    patterns = reasoning_patterns if reasoning_patterns is not None else _DEFAULT_REASONING_PATTERNS
    for line in lines:
        low = line.lower().strip()
        if not low:
            continue
        # Skip lines that look like source-language meta-commentary
        if not any(low.startswith(p) for p in patterns):
            return line

    # All lines look like reasoning — fall back to last line
    return lines[-1]


# Pattern for extracting numbered lines from batch responses
_NUMBERED_LINE_RE = re.compile(
    r"^\s*(\d+)\s*[.):\-]\s*(.+)$", re.MULTILINE
)


def parse_numbered_response(content: str, expected: int) -> list[str]:
    """Extract translations from a numbered response (batch mode)."""
    matches = _NUMBERED_LINE_RE.findall(content)
    if len(matches) >= expected:
        return [m[1].strip() for m in matches[:expected]]

    # Fallback: split by newlines and strip leading numbers
    lines = [l.strip() for l in content.strip().split("\n") if l.strip()]
    cleaned = []
    for line in lines:
        m = re.match(r"^\s*\d+\s*[.):\-]\s*(.+)$", line)
        cleaned.append(m.group(1).strip() if m else line)

    while len(cleaned) < expected:
        cleaned.append("[PARSE_ERROR]")
    return cleaned[:expected]


# ---------------------------------------------------------------------------
# Pricing — dynamic from OpenRouter, with embedded fallback
# ---------------------------------------------------------------------------

# Embedded fallback pricing (USD per 1M tokens) for when API is unavailable.
# Updated: 2026-05-09. These are approximate and may drift.
_FALLBACK_PRICING: dict[str, dict[str, float]] = {
    "google/gemini-3.1-pro-preview":  {"input": 1.25,  "output": 10.0,  "cached": 0.31},
    "anthropic/claude-opus-4.7":      {"input": 15.0,  "output": 75.0,  "cached": 1.88},
    "anthropic/claude-opus-4.6":      {"input": 15.0,  "output": 75.0,  "cached": 1.88},
    "anthropic/claude-sonnet-4":      {"input": 3.0,   "output": 15.0,  "cached": 0.38},
    "openai/gpt-5.5":                {"input": 2.0,   "output": 8.0,   "cached": 0.50},
    "google/gemini-2.5-flash":        {"input": 0.15,  "output": 0.60,  "cached": 0.04},
    "google/gemini-3-flash-preview":  {"input": 0.15,  "output": 0.60,  "cached": 0.04},
    "deepseek/deepseek-v4-pro":       {"input": 0.90,  "output": 2.18,  "cached": 0.14},
    "deepseek/deepseek-r1-0528":      {"input": 0.55,  "output": 2.19,  "cached": 0.14},
}

# In-memory pricing cache (populated on first cost calculation)
_pricing_cache: dict[str, dict[str, float]] | None = None


async def fetch_pricing(
    session: aiohttp.ClientSession,
    api_key: str,
) -> dict[str, dict[str, float]]:
    """Fetch current model pricing from OpenRouter.

    Returns a dict mapping model_id to pricing info:
        {"input": float, "output": float, "cached": float}
    All values in USD per 1M tokens.

    Falls back to embedded table on network errors.
    """
    global _pricing_cache
    if _pricing_cache is not None:
        return _pricing_cache

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with session.get(
            OPENROUTER_MODELS_URL,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                pricing = {}
                for model in data.get("data", []):
                    model_id = model.get("id", "")
                    model_pricing = model.get("pricing", {})
                    if model_pricing:
                        # OpenRouter returns pricing as strings in $/token
                        # Convert to $/1M tokens for readability
                        try:
                            prompt_price = float(model_pricing.get("prompt", "0"))
                            completion_price = float(model_pricing.get("completion", "0"))
                            # Use the provider's REAL cache-read price when it
                            # gives one; never invent a discount. If absent,
                            # cost cached tokens at the full input price
                            # (conservative — overestimates at worst, never
                            # fabricates a favorable number).
                            cache_read = model_pricing.get("input_cache_read")
                            cached_price = (
                                float(cache_read)
                                if cache_read not in (None, "")
                                else prompt_price
                            )
                            pricing[model_id] = {
                                "input": prompt_price * 1_000_000,
                                "output": completion_price * 1_000_000,
                                "cached": cached_price * 1_000_000,
                            }
                        except (ValueError, TypeError):
                            continue
                if pricing:
                    _pricing_cache = pricing
                    return pricing
    except Exception as exc:  # noqa: BLE001
        # LOUD, not silent: the embedded table is stale/approximate, so a
        # silent swap would let approximate numbers be published as measured
        # spend. Announce the degradation so it is never mistaken for real.
        print(
            f"  ⚠ OpenRouter pricing fetch failed ({exc}); falling back to the "
            f"embedded pricing table (approximate, updated 2026-05-09) — "
            f"published costs for this run may be imprecise.",
            file=sys.stderr,
        )

    _pricing_cache = _FALLBACK_PRICING
    return _FALLBACK_PRICING


def estimate_cost(
    usage: dict,
    model_id: str,
    pricing: dict[str, dict[str, float]] | None = None,
) -> float | None:
    """Estimate API cost in USD from token usage and pricing data.

    Args:
        usage: Token usage dict from OpenRouter response.
        model_id: The full OpenRouter model ID.
        pricing: Pricing table from fetch_pricing(). Can be None.

    Returns:
        Estimated cost in USD, or None when the model cannot be priced
        (absent from both the live table and the embedded fallback). None
        means cost UNKNOWN — callers must not treat it as $0.
    """
    if pricing is None:
        pricing = _FALLBACK_PRICING
    model_price = pricing.get(model_id, _FALLBACK_PRICING.get(model_id, {}))
    if not model_price:
        # Un-priceable: the model is in neither the live table nor the embedded
        # fallback. Return None (cost UNKNOWN) — never $0. A genuinely-free run
        # and an un-priceable run must stay distinguishable; a fabricated $0
        # would also win the cost-adjusted ranking unfairly.
        return None

    prompt_tok = usage.get("prompt_tokens", 0)
    completion_tok = usage.get("completion_tokens", 0)
    # Some providers report cached tokens inside prompt_tokens_details
    cached_tok = usage.get("prompt_tokens_details", {}).get("cached_tokens", 0)

    uncached_prompt = max(0, prompt_tok - cached_tok)
    cost = (
        uncached_prompt * model_price.get("input", 0)
        + cached_tok * model_price.get("cached", 0)
        + completion_tok * model_price.get("output", 0)
    ) / 1_000_000  # Pricing is per 1M tokens

    return round(cost, 6)


# ---------------------------------------------------------------------------
# Pre-spend run cost estimate (--max-cost gate + dry-run preview)
# ---------------------------------------------------------------------------

# Heuristic constants for the PRE-SPEND estimate. No tokenizer dependency —
# this is a pre-flight sanity number, not billing. All three err on the
# generous side: an over-reserve wastes nothing, an under-estimate lets a
# --max-cost cap wave through a run it should have stopped (same discipline
# as the queue's LLM_COST_SAFETY_MULTIPLIER in generate_sweep_queue.py).
#
#: chars→tokens divisor (~4 chars/token, the common BPE rule of thumb for
#: Latin-script text; low-resource orthographies often tokenize worse, i.e.
#: MORE tokens/char, which the completion multiplier below absorbs).
EST_CHARS_PER_TOKEN = 4.0
#: completion tokens per source token. Translations are roughly
#: source-length; 2.0 leaves headroom for verbose / morphologically rich
#: targets and numbered-list scaffolding in batch mode.
EST_COMPLETION_PER_SOURCE_TOKEN = 2.0
#: fixed per-API-call prompt overhead (message/role scaffolding plus the
#: batch-mode numbered-list instruction block).
EST_CALL_OVERHEAD_TOKENS = 60


def estimate_run_cost(
    entries: list[dict],
    config,
    system_prompt: str = "",
    pricing: dict[str, dict[str, float]] | None = None,
    cache=None,
) -> tuple[float | None, str]:
    """Estimate a run's API cost in USD BEFORE any translation happens.

    entries × (heuristic prompt + completion tokens per entry) × model
    price, using the same pricing tables (and the same None-means-UNKNOWN
    contract) as estimate_cost(). Entries already present in ``cache``
    (a ResultCache, optional) are subtracted via cheap existence checks —
    cache.has()/has_batch() stat files, never load the whole cache.

    Args:
        entries: Corpus entries (dicts carrying config.source_field).
        config: RunConfig (duck-typed: model_id, batch_size, source_field,
                mt_method, method_path).
        system_prompt: The system prompt text (counted once per API call).
        pricing: Pricing table from fetch_pricing(); None → embedded
                 fallback table.
        cache: Optional ResultCache — already-cached entries are excluded.

    Returns:
        (est_cost_usd, est_basis). est_cost_usd is None when the cost is
        UNKNOWN (un-priceable model, self-contained MT engine, or a method
        plugin whose cost is its own) — never a fabricated $0; est_basis
        says how the number was produced (or why there isn't one).
    """
    if getattr(config, "mt_method", ""):
        return None, (
            f"self-contained MT engine '{config.mt_method}' — no LLM token "
            "pricing; cost estimate unavailable (unknown, never assumed $0)"
        )
    if getattr(config, "method_path", None) or getattr(config, "process_name", None):
        return None, (
            "method plugin — translation cost is the plugin's own; no LLM "
            "token estimate (unknown, never assumed $0)"
        )

    source_field = getattr(config, "source_field", "source")
    batch_size = max(1, getattr(config, "batch_size", 1))
    texts = [str(e.get(source_field, "") or "") for e in entries]

    # Subtract already-cached work (cheap stat-only checks). Batch caching
    # is all-or-nothing per batch, so mirror the strategy's chunking.
    cached_count = 0
    if cache is not None:
        if batch_size > 1:
            uncached: list[str] = []
            for i in range(0, len(texts), batch_size):
                chunk = texts[i:i + batch_size]
                if cache.has_batch(chunk):
                    cached_count += len(chunk)
                else:
                    uncached.extend(chunk)
            texts = uncached
        else:
            uncached = [t for t in texts if not cache.has(t)]
            cached_count = len(texts) - len(uncached)
            texts = uncached

    n = len(texts)
    n_calls = -(-n // batch_size) if n else 0  # ceil division
    source_tokens = sum(len(t) for t in texts) / EST_CHARS_PER_TOKEN
    prompt_tokens = source_tokens + n_calls * (
        len(system_prompt) / EST_CHARS_PER_TOKEN + EST_CALL_OVERHEAD_TOKENS
    )
    completion_tokens = source_tokens * EST_COMPLETION_PER_SOURCE_TOKEN

    est = estimate_cost(
        {
            "prompt_tokens": int(prompt_tokens) + 1,
            "completion_tokens": int(completion_tokens) + 1,
        },
        config.model_id,
        pricing,
    )
    if est is None:
        return None, (
            f"UNKNOWN — no price data for '{config.model_id}' in the live or "
            "embedded pricing tables (unknown ≠ free; never assumed $0)"
        )
    cached_note = (
        f"; {cached_count} already-cached entries excluded" if cached_count else ""
    )
    return est, (
        f"heuristic: {n} uncached entries × (~{EST_CHARS_PER_TOKEN:g} chars/token, "
        f"completion ≈ {EST_COMPLETION_PER_SOURCE_TOKEN:g}× source tokens, "
        f"+{EST_CALL_OVERHEAD_TOKENS} tokens/call overhead) × "
        f"{config.model_id} price{cached_note}"
    )


# ---------------------------------------------------------------------------
# Core API call
# ---------------------------------------------------------------------------

async def call_openrouter(
    session: aiohttp.ClientSession,
    messages: list[dict],
    model_id: str,
    api_key: str,
    semaphore: asyncio.Semaphore,
    max_tokens: int = 13680,
    temperature: float = 0.0,
    tools: list[dict] | None = None,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    provider_prefs: dict | None = None,
) -> dict:
    """Make a single OpenRouter API call with retry logic.

    Args:
        session: Active aiohttp session.
        messages: Chat messages (system, user, assistant, tool).
        model_id: Full OpenRouter model ID.
        api_key: OpenRouter API key.
        semaphore: Concurrency limiter.
        max_tokens: Maximum response tokens.
        temperature: Sampling temperature.
        tools: Tool schemas for tool-calling mode (None to disable).
        timeout_s: Request timeout in seconds.
        provider_prefs: OpenRouter provider-routing preferences attached as
            the request's ``provider`` object. The transmission policy
            (transmission_policy.py) passes ``{"data_collection": "deny"}``
            for restricted corpora so routing never reaches a provider that
            retains prompts for training.

    Returns:
        Dict with keys:
            - content: str — text response (empty if tool_calls present)
            - tool_calls: list[dict] — tool call requests from model
            - usage: dict — token usage stats
            - latency_s: float — time taken
            - error: str | None — error message if failed
            - finish_reason: str — why the model stopped
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/gamedaysuits/Champollion",
    }

    payload: dict[str, Any] = {
        "model": model_id,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if tools:
        payload["tools"] = tools
    if provider_prefs:
        payload["provider"] = provider_prefs

    for attempt in range(MAX_RETRIES):
        async with semaphore:
            start = time.monotonic()
            try:
                async with session.post(
                    OPENROUTER_URL,
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout_s),
                ) as resp:
                    elapsed = time.monotonic() - start

                    if resp.status == 429:
                        # Rate limited — wait as long as the server asks
                        # (Retry-After) then retry, else exponential backoff.
                        await asyncio.sleep(retry_wait_seconds(attempt, resp.headers))
                        continue

                    if resp.status != 200:
                        body = await resp.text()
                        if resp.status >= 500 and attempt < MAX_RETRIES - 1:
                            # Server error — retry with backoff (honor Retry-After
                            # on a 503 if present).
                            await asyncio.sleep(retry_wait_seconds(attempt, resp.headers))
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

        # Parse successful response
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
        content = msg.get("content") or msg.get("text") or ""
        tool_calls = msg.get("tool_calls", [])

        return {
            "content": content,
            "tool_calls": tool_calls,
            "usage": usage,
            "latency_s": round(elapsed, 3),
            "error": None,
            "finish_reason": finish_reason,
            # Which UPSTREAM endpoint OpenRouter actually routed to. We send
            # provider preferences but never pin a single provider, so default
            # routing (price-weighted load balancing) may select endpoints that
            # differ in quantization (int4/fp8/bf16) between runs. Recording it
            # is what makes a score attributable after the fact — without it a
            # benchmark result carries an unrecorded confound. Rides through
            # ExampleMetrics into the run record's `entries`.
            "served_by": data.get("provider"),
            "raw_message": msg,  # Keep for tool-calling conversation continuation
        }

    # Exhausted all retries
    return {
        "content": "",
        "tool_calls": [],
        "usage": {},
        "latency_s": 0,
        "error": f"Exhausted {MAX_RETRIES} retries",
        "finish_reason": "error",
    }


def build_system_message(prompt_text: str) -> dict:
    """Build a system message with OpenRouter prompt caching enabled.

    Uses cache_control: ephemeral to cache the system prompt across
    calls. This is critical for coached prompts (~8k tokens) — without
    caching, each call re-tokenizes the full prompt.
    """
    return {
        "role": "system",
        "content": [
            {
                "type": "text",
                "text": prompt_text,
                "cache_control": {"type": "ephemeral"},
            }
        ],
    }
