"""
Tests for the multi-provider LLM abstraction layer.

Validates:
    - Provider registry (get_provider, PROVIDER_REGISTRY)
    - LLMProvider ABC compliance for all providers
    - Message format conversion (OpenAI → Anthropic, OpenAI → Gemini)
    - API key loading (env var fallback)
    - Provider prefix stripping (model_id normalization)
    - RunConfig.provider field and CLI --provider argument
"""

from __future__ import annotations

import asyncio
import json
import os
import unittest
from unittest.mock import patch, MagicMock

from mt_eval_harness.providers import get_provider, PROVIDER_REGISTRY
from mt_eval_harness.providers.base import LLMProvider
from mt_eval_harness.providers.openrouter import OpenRouterProvider
from mt_eval_harness.providers.openai_provider import (
    OpenAIProvider, _sanitize_messages, OPENAI_DEFAULT_BASE,
)
from mt_eval_harness.providers.local_provider import (
    LocalProvider, LOCAL_DEFAULT_BASE,
)
from mt_eval_harness.providers.anthropic_provider import (
    AnthropicProvider, _convert_messages as anthropic_convert,
    _convert_tools as anthropic_convert_tools,
    _normalize_usage as anthropic_normalize_usage,
)
from mt_eval_harness.providers.gemini_provider import (
    GeminiProvider,
    _convert_messages as gemini_convert,
    _convert_tools as gemini_convert_tools,
    _normalize_usage as gemini_normalize_usage,
)
from mt_eval_harness.config import RunConfig


# ---------------------------------------------------------------------------
# Provider Registry Tests
# ---------------------------------------------------------------------------

class TestProviderRegistry(unittest.TestCase):
    """Test the provider registry and factory function."""

    def test_all_providers_registered(self):
        """All canonical providers should be in the registry."""
        expected = {"openrouter", "openai", "anthropic", "gemini", "local"}
        self.assertEqual(set(PROVIDER_REGISTRY.keys()), expected)

    def test_get_provider_default_is_openrouter(self):
        """get_provider() with None defaults to OpenRouter."""
        provider = get_provider(None)
        self.assertEqual(provider.name, "openrouter")

    def test_get_provider_empty_string_is_openrouter(self):
        provider = get_provider("")
        self.assertEqual(provider.name, "openrouter")

    def test_get_provider_openrouter(self):
        provider = get_provider("openrouter")
        self.assertIsInstance(provider, OpenRouterProvider)

    def test_get_provider_openai(self):
        provider = get_provider("openai")
        self.assertIsInstance(provider, OpenAIProvider)

    def test_get_provider_anthropic(self):
        provider = get_provider("anthropic")
        self.assertIsInstance(provider, AnthropicProvider)

    def test_get_provider_gemini(self):
        provider = get_provider("gemini")
        self.assertIsInstance(provider, GeminiProvider)

    def test_get_provider_unknown_raises(self):
        """Unknown provider names should raise ValueError."""
        with self.assertRaises(ValueError) as ctx:
            get_provider("deepseek")
        self.assertIn("Unknown provider", str(ctx.exception))
        self.assertIn("deepseek", str(ctx.exception))

    def test_get_provider_case_insensitive(self):
        """Provider lookup should be case-insensitive."""
        provider = get_provider("OpenAI")
        self.assertEqual(provider.name, "openai")

    def test_get_provider_strips_whitespace(self):
        provider = get_provider("  gemini  ")
        self.assertEqual(provider.name, "gemini")


# ---------------------------------------------------------------------------
# LLMProvider ABC Compliance
# ---------------------------------------------------------------------------

class TestProviderABCCompliance(unittest.TestCase):
    """All providers must implement the LLMProvider interface."""

    def test_all_providers_are_llm_provider(self):
        for name in PROVIDER_REGISTRY:
            provider = get_provider(name)
            self.assertIsInstance(provider, LLMProvider,
                                 f"{name} is not an LLMProvider")

    def test_all_providers_have_name(self):
        for name in PROVIDER_REGISTRY:
            provider = get_provider(name)
            self.assertTrue(provider.name,
                            f"{name} has empty name")

    def test_all_providers_have_required_methods(self):
        required = ["load_api_key", "call", "fetch_pricing"]
        for name in PROVIDER_REGISTRY:
            provider = get_provider(name)
            for method in required:
                self.assertTrue(
                    callable(getattr(provider, method, None)),
                    f"{name} missing method {method}",
                )


# ---------------------------------------------------------------------------
# Provider Prefix Stripping
# ---------------------------------------------------------------------------

class TestProviderPrefixStripping(unittest.TestCase):
    """Test that providers strip vendor prefixes correctly."""

    def test_openrouter_no_strip(self):
        """OpenRouter keeps the full model ID (it's already the right format)."""
        p = OpenRouterProvider()
        self.assertEqual(p.strip_provider_prefix("anthropic/claude-sonnet-4"),
                         "anthropic/claude-sonnet-4")

    def test_openai_strips_prefix(self):
        p = OpenAIProvider()
        self.assertEqual(p.strip_provider_prefix("openai/gpt-5.5"), "gpt-5.5")

    def test_openai_no_prefix_passthrough(self):
        p = OpenAIProvider()
        self.assertEqual(p.strip_provider_prefix("gpt-5.5"), "gpt-5.5")

    def test_anthropic_strips_prefix(self):
        p = AnthropicProvider()
        self.assertEqual(p.strip_provider_prefix("anthropic/claude-sonnet-4"),
                         "claude-sonnet-4")

    def test_anthropic_no_prefix_passthrough(self):
        p = AnthropicProvider()
        self.assertEqual(p.strip_provider_prefix("claude-sonnet-4"),
                         "claude-sonnet-4")

    def test_gemini_strips_prefix(self):
        p = GeminiProvider()
        self.assertEqual(p.strip_provider_prefix("google/gemini-2.5-flash"),
                         "gemini-2.5-flash")

    def test_gemini_no_prefix_passthrough(self):
        p = GeminiProvider()
        self.assertEqual(p.strip_provider_prefix("gemini-2.5-flash"),
                         "gemini-2.5-flash")


# ---------------------------------------------------------------------------
# Message Format Conversion — OpenAI Provider
# ---------------------------------------------------------------------------

class TestOpenAIMessageSanitization(unittest.TestCase):
    """Test OpenAI message format conversion from OpenRouter cache_control."""

    def test_plain_messages_unchanged(self):
        msgs = [
            {"role": "system", "content": "You are a translator."},
            {"role": "user", "content": "Hello"},
        ]
        result = _sanitize_messages(msgs)
        self.assertEqual(result, msgs)

    def test_cache_control_blocks_flattened(self):
        """OpenRouter-style cache_control content blocks → plain text."""
        msgs = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "You are a translator.",
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            },
            {"role": "user", "content": "Hello"},
        ]
        result = _sanitize_messages(msgs)
        self.assertEqual(result[0]["content"], "You are a translator.")
        self.assertEqual(result[0]["role"], "system")
        # User message unchanged
        self.assertEqual(result[1]["content"], "Hello")


# ---------------------------------------------------------------------------
# Message Format Conversion — Anthropic Provider
# ---------------------------------------------------------------------------

class TestAnthropicMessageConversion(unittest.TestCase):
    """Test OpenAI → Anthropic message format conversion."""

    def test_system_extracted_to_top_level(self):
        msgs = [
            {"role": "system", "content": "You are a translator."},
            {"role": "user", "content": "Hello"},
        ]
        system, anthro_msgs = anthropic_convert(msgs)
        self.assertEqual(system, "You are a translator.")
        self.assertEqual(len(anthro_msgs), 1)
        self.assertEqual(anthro_msgs[0]["role"], "user")

    def test_structured_system_content_extracted(self):
        msgs = [
            {
                "role": "system",
                "content": [
                    {"type": "text", "text": "Part 1."},
                    {"type": "text", "text": "Part 2."},
                ],
            },
        ]
        system, _ = anthropic_convert(msgs)
        self.assertEqual(system, "Part 1.\nPart 2.")

    def test_assistant_role_preserved(self):
        msgs = [
            {"role": "assistant", "content": "Response"},
        ]
        _, anthro_msgs = anthropic_convert(msgs)
        self.assertEqual(anthro_msgs[0]["role"], "assistant")

    def test_tool_schema_conversion(self):
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "fst_validate",
                    "description": "Validate morphology",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]
        result = anthropic_convert_tools(tools)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "fst_validate")
        self.assertIn("input_schema", result[0])

    def test_usage_normalization(self):
        anthro_usage = {"input_tokens": 100, "output_tokens": 50}
        normalized = anthropic_normalize_usage(anthro_usage)
        self.assertEqual(normalized["prompt_tokens"], 100)
        self.assertEqual(normalized["completion_tokens"], 50)
        self.assertEqual(normalized["total_tokens"], 150)


# ---------------------------------------------------------------------------
# Message Format Conversion — Gemini Provider
# ---------------------------------------------------------------------------

class TestGeminiMessageConversion(unittest.TestCase):
    """Test OpenAI → Gemini message format conversion."""

    def test_system_extracted(self):
        msgs = [
            {"role": "system", "content": "You are a translator."},
            {"role": "user", "content": "Hello"},
        ]
        system, contents = gemini_convert(msgs)
        self.assertEqual(system, "You are a translator.")

    def test_assistant_role_mapped_to_model(self):
        """Gemini uses 'model' instead of 'assistant'."""
        msgs = [
            {"role": "assistant", "content": "Response"},
        ]
        _, contents = gemini_convert(msgs)
        self.assertEqual(contents[0]["role"], "model")

    def test_user_role_preserved(self):
        msgs = [{"role": "user", "content": "Hi"}]
        _, contents = gemini_convert(msgs)
        self.assertEqual(contents[0]["role"], "user")

    def test_content_wrapped_in_parts(self):
        """Gemini wraps content in {parts: [{text: ...}]}."""
        msgs = [{"role": "user", "content": "Hello"}]
        _, contents = gemini_convert(msgs)
        self.assertEqual(contents[0]["parts"], [{"text": "Hello"}])

    def test_tool_schema_conversion(self):
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "fst_validate",
                    "description": "Validate",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]
        result = gemini_convert_tools(tools)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "fst_validate")
        self.assertIn("parameters", result[0])

    def test_usage_normalization(self):
        gemini_usage = {
            "promptTokenCount": 200,
            "candidatesTokenCount": 80,
            "totalTokenCount": 280,
        }
        normalized = gemini_normalize_usage(gemini_usage)
        self.assertEqual(normalized["prompt_tokens"], 200)
        self.assertEqual(normalized["completion_tokens"], 80)
        self.assertEqual(normalized["total_tokens"], 280)


# ---------------------------------------------------------------------------
# API Key Loading
# ---------------------------------------------------------------------------

class TestAPIKeyLoading(unittest.TestCase):
    """Test that each provider looks for the correct env var."""

    def test_openai_key_var(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
            key = OpenAIProvider().load_api_key()
            self.assertEqual(key, "sk-test")

    def test_anthropic_key_var(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-ant-test"}):
            key = AnthropicProvider().load_api_key()
            self.assertEqual(key, "sk-ant-test")

    def test_gemini_key_var(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "AIza-test"}):
            key = GeminiProvider().load_api_key()
            self.assertEqual(key, "AIza-test")

    def test_gemini_fallback_to_google_api_key(self):
        """Gemini should also accept GOOGLE_API_KEY."""
        env = {"GOOGLE_API_KEY": "AIza-google"}
        with patch.dict(os.environ, env, clear=False):
            # Clear GEMINI_API_KEY if set
            os.environ.pop("GEMINI_API_KEY", None)
            key = GeminiProvider().load_api_key()
            self.assertEqual(key, "AIza-google")

    def test_openai_missing_key_raises(self):
        with patch.dict(os.environ, {}, clear=True):
            # Mock dotenv_values to return empty so .env files don't leak in
            with patch("dotenv.dotenv_values", return_value={}):
                with self.assertRaises(RuntimeError) as ctx:
                    OpenAIProvider().load_api_key()
                self.assertIn("OPENAI_API_KEY", str(ctx.exception))

    def test_anthropic_missing_key_raises(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch("dotenv.dotenv_values", return_value={}):
                with self.assertRaises(RuntimeError) as ctx:
                    AnthropicProvider().load_api_key()
                self.assertIn("ANTHROPIC_API_KEY", str(ctx.exception))


# ---------------------------------------------------------------------------
# RunConfig Integration
# ---------------------------------------------------------------------------

class TestRunConfigProvider(unittest.TestCase):
    """Test that RunConfig.provider field works correctly."""

    def test_default_provider_is_openrouter(self):
        config = RunConfig()
        self.assertEqual(config.provider, "openrouter")

    def test_provider_field_roundtrip(self):
        config = RunConfig(provider="anthropic")
        self.assertEqual(config.provider, "anthropic")

    def test_provider_in_all_four(self):
        for name in ("openrouter", "openai", "anthropic", "gemini"):
            config = RunConfig(provider=name)
            provider = get_provider(config.provider)
            self.assertEqual(provider.name, name)


# ---------------------------------------------------------------------------
# Pricing
# ---------------------------------------------------------------------------

class TestProviderPricing(unittest.TestCase):
    """Test that each provider returns a pricing dict."""

    def test_openai_pricing_keys(self):
        p = OpenAIProvider()
        pricing = asyncio.run(p.fetch_pricing(MagicMock(), "fake-key"))
        # Should have openai/ prefixed keys
        for key in pricing:
            self.assertTrue(key.startswith("openai/"), f"Bad key: {key}")
            info = pricing[key]
            self.assertIn("input", info)
            self.assertIn("output", info)

    def test_anthropic_pricing_keys(self):
        p = AnthropicProvider()
        pricing = asyncio.run(p.fetch_pricing(MagicMock(), "fake-key"))
        for key in pricing:
            self.assertTrue(key.startswith("anthropic/"), f"Bad key: {key}")

    def test_gemini_pricing_keys(self):
        p = GeminiProvider()
        pricing = asyncio.run(p.fetch_pricing(MagicMock(), "fake-key"))
        for key in pricing:
            self.assertTrue(key.startswith("google/"), f"Bad key: {key}")


# ---------------------------------------------------------------------------
# base_url override + local / OpenAI-compatible provider (Phase 2)
# ---------------------------------------------------------------------------

class TestBaseUrlAndLocalProvider(unittest.TestCase):
    def test_openai_default_endpoint(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPENAI_API_BASE", None)
            p = OpenAIProvider()
            self.assertEqual(p._endpoint(), f"{OPENAI_DEFAULT_BASE}/chat/completions")

    def test_openai_base_url_arg(self):
        p = OpenAIProvider(base_url="http://host:1234/v1")
        self.assertEqual(p._endpoint(), "http://host:1234/v1/chat/completions")

    def test_openai_base_url_env(self):
        with patch.dict(os.environ, {"OPENAI_API_BASE": "http://envhost/v1"}, clear=False):
            self.assertEqual(OpenAIProvider().base_url, "http://envhost/v1")

    def test_base_url_arg_beats_env(self):
        with patch.dict(os.environ, {"OPENAI_API_BASE": "http://envhost/v1"}, clear=False):
            self.assertEqual(OpenAIProvider(base_url="http://arghost/v1").base_url, "http://arghost/v1")

    def test_endpoint_normalization_strips_full_path(self):
        # Passing a full .../chat/completions URL normalizes to the /v1 root.
        p = OpenAIProvider(base_url="http://host/v1/chat/completions/")
        self.assertEqual(p.base_url, "http://host/v1")
        self.assertEqual(p._endpoint(), "http://host/v1/chat/completions")

    def test_local_default_is_ollama(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPENAI_API_BASE", None)
            os.environ.pop("LOCAL_API_BASE", None)
            p = get_provider("local")
            self.assertIsInstance(p, LocalProvider)
            self.assertEqual(p.base_url, LOCAL_DEFAULT_BASE)

    def test_openai_compatible_alias_resolves_to_local(self):
        self.assertIsInstance(get_provider("openai-compatible"), LocalProvider)

    def test_get_provider_passes_base_url(self):
        p = get_provider("local", base_url="https://api.groq.com/openai/v1")
        self.assertEqual(p._endpoint(), "https://api.groq.com/openai/v1/chat/completions")

    def test_local_load_api_key_never_raises(self):
        # api_key_required=False → returns a non-empty string (real key or
        # placeholder), never raises, so a no-auth local server works.
        key = get_provider("local").load_api_key()
        self.assertIsInstance(key, str)
        self.assertTrue(key)

    def test_local_pricing_is_empty_fail_honest(self):
        # Must be {} so unknown cost surfaces as UNKNOWN, never fabricated $0.
        pricing = asyncio.run(get_provider("local").fetch_pricing(MagicMock(), "x"))
        self.assertEqual(pricing, {})

    def test_local_strip_prefix_preserves_model_names(self):
        p = LocalProvider()
        self.assertEqual(p.strip_provider_prefix("local/llama3.1:8b"), "llama3.1:8b")
        self.assertEqual(p.strip_provider_prefix("llama3.1:8b"), "llama3.1:8b")
        self.assertEqual(p.strip_provider_prefix("Qwen/Qwen2.5-7B"), "Qwen/Qwen2.5-7B")

    def test_local_loopback_endpoints_verify(self):
        for url in (
            "http://localhost:11434/v1",
            "http://127.0.0.1:8000/v1",
            "http://127.9.8.7/v1",          # anywhere in 127.0.0.0/8
            "http://[::1]:8080/v1",
            "http://0.0.0.0:8000/v1",
            "http://app.localhost:3000/v1",
            "unix:///tmp/llm.sock",
        ):
            self.assertTrue(
                LocalProvider(base_url=url).is_loopback_endpoint(), url)

    def test_local_remote_endpoints_do_not_verify(self):
        # Public hosts AND LAN/private-range IPs: another machine is not
        # local, whatever the provider is named.
        for url in (
            "https://api.groq.com/openai/v1",
            "https://api.together.xyz/v1",
            "http://192.168.1.50:11434/v1",
            "http://10.0.0.7:8000/v1",
            "http://my-gpu-box:11434/v1",
            "http://127.0.0.1.evil.example.com/v1",
        ):
            self.assertFalse(
                LocalProvider(base_url=url).is_loopback_endpoint(), url)

    def test_local_env_base_does_not_verify_when_remote(self):
        # LOCAL_API_BASE is an endpoint override like any other — the env
        # route must not launder a remote host into "local".
        with patch.dict(os.environ,
                        {"LOCAL_API_BASE": "https://api.groq.com/openai/v1"},
                        clear=False):
            self.assertFalse(LocalProvider().is_loopback_endpoint())


class TestRunConfigBaseUrl(unittest.TestCase):
    def test_base_url_defaults_none(self):
        self.assertIsNone(RunConfig().base_url)

    def test_base_url_affects_config_hash(self):
        a = RunConfig(base_url=None)
        b = RunConfig(base_url="http://localhost:11434/v1")
        self.assertNotEqual(a.config_hash(), b.config_hash())

    def test_base_url_round_trips(self):
        cfg = RunConfig(base_url="http://h/v1")
        self.assertEqual(RunConfig.from_dict(cfg.to_dict()).base_url, "http://h/v1")


if __name__ == "__main__":
    unittest.main()
