"""
Multi-provider LLM abstraction for the mt-eval harness.

Instead of being locked to a single provider (OpenRouter), the harness
can now call LLM APIs directly. Every provider implements the same
interface (LLMProvider) and returns the same result dict shape, so
strategies are completely provider-agnostic.

Available providers:
    - openrouter  (default — proxies any model through OpenRouter)
    - openai      (direct OpenAI API)
    - anthropic   (direct Anthropic API)
    - gemini      (direct Google Gemini API)

Usage:
    from mt_eval_harness.providers import get_provider

    provider = get_provider("openai")
    api_key = provider.load_api_key()
    result = await provider.call(session, messages, model_id, api_key, ...)
"""

from __future__ import annotations

from mt_eval_harness.providers.base import LLMProvider
from mt_eval_harness.providers.registry import get_provider, PROVIDER_REGISTRY

__all__ = ["LLMProvider", "get_provider", "PROVIDER_REGISTRY"]
