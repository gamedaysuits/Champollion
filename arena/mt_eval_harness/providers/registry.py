"""
Provider registry — maps provider name strings to LLMProvider instances.

The registry uses the same vocabulary as the CLI's METHOD_REGISTRY
(cli/lib/translate.js) for direct provider names. This eliminates the
brittle mapping layer between harness and CLI terminology.

Provider names:
    "openrouter"  → OpenRouterProvider (default, proxies any model)
    "openai"      → OpenAIProvider     (direct OpenAI API; base_url override)
    "anthropic"   → AnthropicProvider  (direct Anthropic API)
    "gemini"      → GeminiProvider     (direct Google Gemini API)
    "local"       → LocalProvider      (OpenAI-compatible local/self-hosted:
                                        Ollama default, vLLM/LM Studio/Groq/…)

Aliases (resolved in get_provider, not registry keys, so the registry stays
in 1:1 parity with shared/method-registry.json):
    "openai-compatible" → "local"

Usage:
    provider = get_provider("local", base_url="http://localhost:11434/v1")
    api_key = provider.load_api_key()
"""

from __future__ import annotations

from mt_eval_harness.providers.base import LLMProvider


# Lazy imports to avoid loading provider modules until actually needed.
# This keeps startup fast and avoids import errors for unused providers.
# Each factory accepts base_url (only the OpenAI-compatible ones use it).
def _openrouter(base_url: str | None = None) -> LLMProvider:
    from mt_eval_harness.providers.openrouter import OpenRouterProvider
    return OpenRouterProvider()


def _openai(base_url: str | None = None) -> LLMProvider:
    from mt_eval_harness.providers.openai_provider import OpenAIProvider
    return OpenAIProvider(base_url=base_url)


def _anthropic(base_url: str | None = None) -> LLMProvider:
    from mt_eval_harness.providers.anthropic_provider import AnthropicProvider
    return AnthropicProvider()


def _gemini(base_url: str | None = None) -> LLMProvider:
    from mt_eval_harness.providers.gemini_provider import GeminiProvider
    return GeminiProvider()


def _local(base_url: str | None = None) -> LLMProvider:
    from mt_eval_harness.providers.local_provider import LocalProvider
    return LocalProvider(base_url=base_url)


# Maps provider name → lazy constructor. Keys must match the llm-provider
# entries in shared/method-registry.json (the SSOT parity test enforces this).
PROVIDER_REGISTRY: dict[str, callable] = {
    "openrouter": _openrouter,
    "openai": _openai,
    "anthropic": _anthropic,
    "gemini": _gemini,
    "local": _local,
}

# User-facing aliases → canonical registry key. Resolved before lookup so the
# registry itself stays 1:1 with the manifest.
_PROVIDER_ALIASES: dict[str, str] = {
    "openai-compatible": "local",
}


def get_provider(name: str | None = None, *, base_url: str | None = None) -> LLMProvider:
    """Get an LLMProvider instance by name.

    Args:
        name: Provider name (a PROVIDER_REGISTRY key or an alias).
              None or empty string defaults to "openrouter".
        base_url: Optional OpenAI-compatible endpoint override. Only the
                  OpenAI/local providers honor it; others ignore it.

    Returns:
        An LLMProvider instance ready to use.

    Raises:
        ValueError: If the provider name is not recognized.
    """
    resolved = (name or "openrouter").strip().lower()
    resolved = _PROVIDER_ALIASES.get(resolved, resolved)

    factory = PROVIDER_REGISTRY.get(resolved)
    if factory is None:
        available = ", ".join(sorted(PROVIDER_REGISTRY.keys()))
        raise ValueError(
            f"Unknown provider '{resolved}'. "
            f"Available: {available}. "
            f"Set --provider or config.provider to one of these."
        )

    return factory(base_url=base_url)
