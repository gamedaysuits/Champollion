"""
Tests for the consumer-reports MT system adapters
(mt_eval_harness.methods.*).

Fully offline: NO real network calls to any translation API. We exercise
each adapter three ways:

    1. translate() end-to-end with ``_translate_texts`` monkeypatched to a
       canned translator — asserts protocol-shaped results (one per entry,
       predicted set, error=None, tool fields, etc.).
    2. Request-building helpers directly (``_build_request`` /
       ``_parse_response`` / ``_map_locale``) — asserts each provider's exact
       endpoint, auth scheme, body shape, and locale mapping with zero HTTP.
    3. The real ``_translate_texts`` → aiohttp path for one provider
       (Google) using a fake aiohttp ClientSession, proving the HTTP wiring
       and error handling without a socket.

Also covers: simulated API errors → result.error set / predicted="" without
raising; the registry; and missing-credential errors.
"""

from __future__ import annotations

import asyncio
import math
from dataclasses import dataclass, field
from typing import Any

import pytest

from mt_eval_harness.methods import (
    GoogleTranslateMethod,
    DeepLMethod,
    MicrosoftTranslatorMethod,
    LibreTranslateMethod,
    ApertiumMethod,
    AmazonTranslateMethod,
    TildeMethod,
    TranslatedMethod,
    LocalModelMethod,
    MT_METHOD_REGISTRY,
    get_mt_method,
)
from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _resolve_lang_codes,
    _env_first,
)
from mt_eval_harness.methods import google_translate as gt_mod


# ---------------------------------------------------------------------------
# Stub config — carries explicit ISO codes (the documented run contract).
# ---------------------------------------------------------------------------

@dataclass
class StubConfig:
    """Minimal stand-in for RunConfig with the fields the adapters read.

    Defaults to a provider-supported pair (English→French) so the translate()
    loop tests exercise a real path. The Cree case — which these REST providers
    cannot target (no ISO 639-1 code) — is tested explicitly via _to_provider_base.
    """
    source_field: str = "source"
    source_lang: str = "English"
    target_lang: str = "French"
    source_code: str = "en"
    target_code: str = "fr"
    batch_size: int = 25


def _entries(n: int = 3) -> list[dict]:
    return [{"id": i, "source": f"sentence {i}"} for i in range(n)]


# Every concrete adapter + a canned "credentials" dict that lets
# _translate_texts run without env vars when we monkeypatch it.
ALL_METHODS = [
    GoogleTranslateMethod,
    DeepLMethod,
    MicrosoftTranslatorMethod,
    LibreTranslateMethod,
    ApertiumMethod,
    AmazonTranslateMethod,
    TildeMethod,
    TranslatedMethod,
    LocalModelMethod,
]

METHOD_NAMES = {
    GoogleTranslateMethod: "google-translate",
    DeepLMethod: "deepl",
    MicrosoftTranslatorMethod: "microsoft-translator",
    LibreTranslateMethod: "libretranslate",
    ApertiumMethod: "apertium",
    AmazonTranslateMethod: "amazon-translate",
    TildeMethod: "tilde",
    TranslatedMethod: "translated",
    LocalModelMethod: "local-model",
}


# ---------------------------------------------------------------------------
# Fake aiohttp layer (for the real-path Google test). No sockets.
# ---------------------------------------------------------------------------

class _FakeResponse:
    def __init__(self, status: int, json_payload: Any = None, text_body: str = ""):
        self.status = status
        self._json = json_payload
        self._text = text_body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def json(self):
        return self._json

    async def text(self):
        return self._text


class _FakeSession:
    """Captures the POST kwargs and returns a pre-baked response."""

    def __init__(self, response: _FakeResponse):
        self._response = response
        self.calls: list[dict] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def post(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


# ===========================================================================
# (1) translate() protocol shape — one result per entry, predicted set,
#     error None. _translate_texts is monkeypatched (no HTTP, no creds).
# ===========================================================================

@pytest.mark.parametrize("cls", ALL_METHODS)
def test_translate_returns_one_result_per_entry(cls, monkeypatch):
    method = cls()

    async def fake_backend(texts, src, tgt, creds):
        return [f"[{tgt}] {t}" for t in texts]

    monkeypatch.setattr(method, "_translate_texts", fake_backend)
    # Skip real credential resolution — those need env vars.
    monkeypatch.setattr(method, "_resolve_credentials", lambda: {"ok": True})

    entries = _entries(3)
    results = asyncio.run(method.translate(entries, StubConfig()))

    # Each method resolves the target to the code form ITS backend needs,
    # straight off the card SSOT: iso639_1 (fra→fr) for the cloud APIs, but the
    # canonical ISO 639-3 (fra→fra) for the OPUS-family local model, which is
    # pair-specific and passes the code through. Compute the expectation from
    # the method's own resolver rather than assuming one scheme.
    from mt_eval_harness.methods.base_http_mt import _resolve_lang_codes
    _, tgt_code = _resolve_lang_codes(StubConfig())
    expected_tgt = method._to_provider_base(tgt_code)

    assert len(results) == len(entries)
    for entry, res in zip(entries, results):
        assert res["id"] == entry["id"]
        assert res["predicted"] == f"[{expected_tgt}] {entry['source']}"
        assert res["error"] is None
        # Protocol-required fields, exact shape.
        assert res["tool_calls"] == []
        assert res["tool_call_count"] == 0
        assert isinstance(res["usage"], dict)
        assert isinstance(res["metadata"], dict)
        assert isinstance(res["latency_s"], float)


@pytest.mark.parametrize("cls", ALL_METHODS)
def test_translate_respects_source_field(cls, monkeypatch):
    """The source text is read from config.source_field, not a hardcoded key."""
    method = cls()
    seen: dict[str, list[str]] = {}

    async def fake_backend(texts, src, tgt, creds):
        seen["texts"] = texts
        return list(texts)

    monkeypatch.setattr(method, "_translate_texts", fake_backend)
    monkeypatch.setattr(method, "_resolve_credentials", lambda: {})

    entries = [{"id": 7, "english": "custom field value"}]
    cfg = StubConfig(source_field="english")
    results = asyncio.run(method.translate(entries, cfg))

    assert seen["texts"] == ["custom field value"]
    assert results[0]["predicted"] == "custom field value"


@pytest.mark.parametrize("cls", ALL_METHODS)
def test_translate_batches_at_provider_limit(cls, monkeypatch):
    """Entries beyond MAX_BATCH are split into multiple backend calls."""
    method = cls()
    batch_sizes: list[int] = []

    async def fake_backend(texts, src, tgt, creds):
        batch_sizes.append(len(texts))
        return list(texts)

    monkeypatch.setattr(method, "_translate_texts", fake_backend)
    monkeypatch.setattr(method, "_resolve_credentials", lambda: {})

    n = method.MAX_BATCH + 5
    entries = _entries(n)
    results = asyncio.run(method.translate(entries, StubConfig()))

    assert len(results) == n
    # First chunk is the full provider limit; chunk count = ceil(n / MAX_BATCH).
    # (MAX_BATCH-agnostic — Apertium's MAX_BATCH=1 yields n single-entry chunks.)
    assert batch_sizes[0] == method.MAX_BATCH
    assert sum(batch_sizes) == n
    assert len(batch_sizes) == math.ceil(n / method.MAX_BATCH)


# ===========================================================================
# (3) Simulated API error → result.error set, predicted="", no raise.
# ===========================================================================

@pytest.mark.parametrize("cls", ALL_METHODS)
def test_translate_api_error_sets_error_without_raising(cls, monkeypatch):
    method = cls()

    async def boom(texts, src, tgt, creds):
        raise RuntimeError("simulated 500 from upstream")

    monkeypatch.setattr(method, "_translate_texts", boom)
    monkeypatch.setattr(method, "_resolve_credentials", lambda: {})

    entries = _entries(2)
    # Must NOT raise — errors are captured per entry.
    results = asyncio.run(method.translate(entries, StubConfig()))

    assert len(results) == 2
    for res in results:
        assert res["predicted"] == ""
        assert res["error"] is not None
        assert "simulated 500" in res["error"]


@pytest.mark.parametrize("cls", ALL_METHODS)
def test_translate_length_mismatch_is_captured(cls, monkeypatch):
    """A backend returning the wrong count errors the batch, never raises."""
    method = cls()

    async def short(texts, src, tgt, creds):
        # Return one fewer than asked — always a length mismatch regardless of
        # MAX_BATCH (a single full chunk of size MAX_BATCH gets MAX_BATCH-1 back).
        return list(texts)[:-1]

    monkeypatch.setattr(method, "_translate_texts", short)
    monkeypatch.setattr(method, "_resolve_credentials", lambda: {})

    n = method.MAX_BATCH  # exactly one full chunk
    results = asyncio.run(method.translate(_entries(n), StubConfig()))
    assert len(results) == n
    assert all(r["predicted"] == "" for r in results)
    assert all(r["error"] and "mismatch" in r["error"] for r in results)


# ===========================================================================
# (2) Request-building / parsing helpers — exact endpoint, auth, locale.
# ===========================================================================

def test_google_request_endpoint_auth_and_body():
    m = GoogleTranslateMethod()
    req = m._build_request(["hello", "world"], "en", "fr", "KEY123")
    assert req["url"] == "https://translation.googleapis.com/language/translate/v2"
    assert req["headers"]["x-goog-api-key"] == "KEY123"
    assert req["json"]["q"] == ["hello", "world"]
    assert req["json"]["source"] == "en"
    assert req["json"]["target"] == "fr"
    assert req["json"]["format"] == "text"


def test_google_locale_map_he_to_iw():
    assert GoogleTranslateMethod._map_locale("he") == "iw"
    assert GoogleTranslateMethod._map_locale("jv") == "jw"
    assert GoogleTranslateMethod._map_locale("en") == "en"
    # And it flows through request building.
    req = GoogleTranslateMethod()._build_request(["x"], "he", "jv", "K")
    assert req["json"]["source"] == "iw"
    assert req["json"]["target"] == "jw"


def test_google_parse_response():
    payload = {"data": {"translations": [
        {"translatedText": "bonjour"},
        {"translatedText": "monde"},
    ]}}
    assert GoogleTranslateMethod._parse_response(payload, 2) == ["bonjour", "monde"]
    with pytest.raises(ValueError):
        GoogleTranslateMethod._parse_response(payload, 3)


def test_deepl_request_endpoint_auth_and_locale():
    m = DeepLMethod()
    # Pro key → pro host.
    req = m._build_request(["hi"], "en", "pt-br", "prokey", "https://api.deepl.com")
    assert req["url"] == "https://api.deepl.com/v2/translate"
    assert req["headers"]["Authorization"] == "DeepL-Auth-Key prokey"
    assert req["json"]["text"] == ["hi"]
    # DeepL wants UPPERCASE codes.
    assert req["json"]["source_lang"] == "EN"
    assert req["json"]["target_lang"] == "PT-BR"


def test_deepl_free_key_selects_free_host():
    assert DeepLMethod._resolve_base("abc:fx") == "https://api-free.deepl.com"
    assert DeepLMethod._resolve_base("abc") == "https://api.deepl.com"


def test_deepl_parse_response():
    payload = {"translations": [{"text": "hallo"}, {"text": "welt"}]}
    assert DeepLMethod._parse_response(payload, 2) == ["hallo", "welt"]
    with pytest.raises(ValueError):
        DeepLMethod._parse_response({"translations": []}, 2)


def test_microsoft_request_endpoint_auth_region_and_body():
    m = MicrosoftTranslatorMethod()
    req = m._build_request(["hi", "yo"], "en", "de", "MSKEY", "westus")
    assert req["url"].startswith(
        "https://api.cognitive.microsofttranslator.com/translate?"
    )
    assert "api-version=3.0" in req["url"]
    assert "from=en" in req["url"]
    assert "to=de" in req["url"]
    assert req["headers"]["Ocp-Apim-Subscription-Key"] == "MSKEY"
    assert req["headers"]["Ocp-Apim-Subscription-Region"] == "westus"
    assert req["json"] == [{"Text": "hi"}, {"Text": "yo"}]


def test_microsoft_region_omitted_when_absent():
    req = MicrosoftTranslatorMethod()._build_request(["x"], "en", "de", "K", None)
    assert "Ocp-Apim-Subscription-Region" not in req["headers"]


def test_microsoft_custom_endpoint_used_in_request():
    # A custom-domain / VNet resource: _build_request hits the resolved
    # endpoint verbatim, not the global one.
    m = MicrosoftTranslatorMethod()
    ep = "https://myres.cognitiveservices.azure.com/translate"
    req = m._build_request(["x"], "en", "de", "K", "westus", ep)
    assert req["url"].startswith(f"{ep}?")


def test_microsoft_endpoint_env_override_and_normalization(monkeypatch):
    # _resolve_endpoint normalizes a bare host base to a /translate path and is
    # idempotent when /translate is already present.
    monkeypatch.setenv(
        "MICROSOFT_TRANSLATOR_ENDPOINT",
        "https://myres.cognitiveservices.azure.com",
    )
    assert MicrosoftTranslatorMethod()._resolve_endpoint() == (
        "https://myres.cognitiveservices.azure.com/translate"
    )
    monkeypatch.setenv(
        "MICROSOFT_TRANSLATOR_ENDPOINT",
        "https://myres.cognitiveservices.azure.com/translate/",
    )
    assert MicrosoftTranslatorMethod()._resolve_endpoint() == (
        "https://myres.cognitiveservices.azure.com/translate"
    )


def test_microsoft_endpoint_defaults_to_global():
    req = MicrosoftTranslatorMethod()._build_request(["x"], "en", "de", "K", None)
    assert req["url"].startswith(
        "https://api.cognitive.microsofttranslator.com/translate?"
    )


def test_microsoft_parse_response():
    payload = [
        {"translations": [{"text": "hallo"}]},
        {"translations": [{"text": "welt"}]},
    ]
    assert MicrosoftTranslatorMethod._parse_response(payload, 2) == ["hallo", "welt"]
    with pytest.raises(ValueError):
        MicrosoftTranslatorMethod._parse_response(payload, 1)


def test_libretranslate_request_default_endpoint_and_body():
    m = LibreTranslateMethod()
    req = m._build_request(["hi"], "en", "es", "http://localhost:5000/translate", None)
    assert req["url"] == "http://localhost:5000/translate"
    assert req["json"]["q"] == ["hi"]
    assert req["json"]["source"] == "en"
    assert req["json"]["target"] == "es"
    assert req["json"]["format"] == "text"
    # No api_key in body when none provided.
    assert "api_key" not in req["json"]


def test_libretranslate_includes_api_key_when_present():
    req = LibreTranslateMethod()._build_request(
        ["hi"], "en", "es", "http://host/translate", "secret",
    )
    assert req["json"]["api_key"] == "secret"


def test_libretranslate_parse_response_array_and_single():
    # Batch → array.
    payload = {"translatedText": ["hola", "mundo"]}
    assert LibreTranslateMethod._parse_response(payload, 2) == ["hola", "mundo"]
    # Single-item batch → plain string is accepted.
    assert LibreTranslateMethod._parse_response({"translatedText": "hola"}, 1) == ["hola"]
    # Length mismatch on array → error.
    with pytest.raises(ValueError):
        LibreTranslateMethod._parse_response({"translatedText": ["a"]}, 2)


# ===========================================================================
# (3b) Real _translate_texts → aiohttp path for Google, via fake session.
# ===========================================================================

def test_google_translate_texts_real_path_with_fake_session(monkeypatch):
    method = GoogleTranslateMethod()
    fake = _FakeSession(_FakeResponse(
        status=200,
        json_payload={"data": {"translations": [
            {"translatedText": "bonjour"},
            {"translatedText": "monde"},
        ]}},
    ))
    # Patch aiohttp.ClientSession (as referenced inside the google module).
    monkeypatch.setattr(gt_mod.aiohttp, "ClientSession", lambda *a, **k: fake)

    out = asyncio.run(method._translate_texts(["hello", "world"], "en", "fr", {"api_key": "K"}))
    assert out == ["bonjour", "monde"]
    # The HTTP request carried the right endpoint + auth.
    assert len(fake.calls) == 1
    assert fake.calls[0]["url"] == gt_mod.GOOGLE_API_URL
    assert fake.calls[0]["headers"]["x-goog-api-key"] == "K"


def test_google_translate_texts_non_200_raises(monkeypatch):
    method = GoogleTranslateMethod()
    fake = _FakeSession(_FakeResponse(status=403, text_body="forbidden"))
    monkeypatch.setattr(gt_mod.aiohttp, "ClientSession", lambda *a, **k: fake)

    with pytest.raises(RuntimeError) as ctx:
        asyncio.run(method._translate_texts(["x"], "en", "fr", {"api_key": "K"}))
    assert "403" in str(ctx.value)


def test_google_full_translate_via_fake_session(monkeypatch):
    """End-to-end translate() through the real HTTP path (fake socket)."""
    method = GoogleTranslateMethod()
    fake = _FakeSession(_FakeResponse(
        status=200,
        json_payload={"data": {"translations": [
            {"translatedText": "T0"},
            {"translatedText": "T1"},
        ]}},
    ))
    monkeypatch.setattr(gt_mod.aiohttp, "ClientSession", lambda *a, **k: fake)
    monkeypatch.setenv("GOOGLE_TRANSLATE_API_KEY", "envkey")

    results = asyncio.run(method.translate(_entries(2), StubConfig()))
    assert [r["predicted"] for r in results] == ["T0", "T1"]
    assert all(r["error"] is None for r in results)
    assert fake.calls[0]["headers"]["x-goog-api-key"] == "envkey"


# ===========================================================================
# (5) method_card() has expected fields.
# ===========================================================================

@pytest.mark.parametrize("cls", ALL_METHODS)
def test_method_card_fields(cls):
    card = cls().method_card()
    assert card is not None
    for key in (
        "name", "method_id", "class", "author", "description",
        "supported_pairs", "tools_used", "license", "commercialReady",
    ):
        assert key in card, f"{cls.__name__} card missing {key}"
    assert card["name"] == METHOD_NAMES[cls]
    assert card["tools_used"] == []  # MT systems are black boxes, no tools


def test_method_card_license_and_commercial_flags():
    """GT/DeepL/MS proprietary + commercial-ready; LibreTranslate AGPL open."""
    g = GoogleTranslateMethod().method_card()
    d = DeepLMethod().method_card()
    ms = MicrosoftTranslatorMethod().method_card()
    lt = LibreTranslateMethod().method_card()

    assert "Proprietary" in g["license"] and g["commercialReady"] is True
    assert "Proprietary" in d["license"] and d["commercialReady"] is True
    assert "Proprietary" in ms["license"] and ms["commercialReady"] is True
    # LibreTranslate is open-source AGPL — carved out of "commercial ready".
    assert "AGPL" in lt["license"]
    assert lt["commercialReady"] is False


# ===========================================================================
# (6) Registry resolves each name; raises on unknown.
# ===========================================================================

def test_registry_has_all_names():
    assert set(MT_METHOD_REGISTRY.keys()) == {
        "google-translate", "deepl", "microsoft-translator", "libretranslate",
        "apertium", "amazon-translate", "tilde", "translated", "local-model",
    }


@pytest.mark.parametrize("name,cls", [
    ("google-translate", GoogleTranslateMethod),
    ("deepl", DeepLMethod),
    ("microsoft-translator", MicrosoftTranslatorMethod),
    ("libretranslate", LibreTranslateMethod),
    ("apertium", ApertiumMethod),
    ("amazon-translate", AmazonTranslateMethod),
    ("tilde", TildeMethod),
    ("translated", TranslatedMethod),
    ("local-model", LocalModelMethod),
])
def test_get_mt_method_resolves_each_name(name, cls):
    method = get_mt_method(name)
    assert isinstance(method, cls)
    assert method.name == name


def test_get_mt_method_is_case_insensitive_and_trims():
    assert isinstance(get_mt_method("  Google-Translate "), GoogleTranslateMethod)


def test_get_mt_method_unknown_raises_with_available_names():
    with pytest.raises(ValueError) as ctx:
        get_mt_method("yandex")
    msg = str(ctx.value)
    assert "yandex" in msg
    # Lists the available names to guide the caller.
    assert "google-translate" in msg and "deepl" in msg


def test_get_mt_method_forwards_options():
    """Constructor options flow through (override-before-env pattern)."""
    method = get_mt_method("google-translate", google_api_key="explicit")
    assert method.options.get("google_api_key") == "explicit"


# ===========================================================================
# (7) Missing credentials → clear MTConfigError (raised up front).
# ===========================================================================

def _clear_keys(monkeypatch):
    for k in (
        "GOOGLE_TRANSLATE_API_KEY", "GOOGLE_API_KEY",
        "DEEPL_API_KEY",
        "MICROSOFT_TRANSLATOR_API_KEY", "MICROSOFT_TRANSLATOR_REGION",
        "LIBRETRANSLATE_API_URL", "LIBRETRANSLATE_API_KEY",
    ):
        monkeypatch.delenv(k, raising=False)


def test_google_missing_key_raises_config_error(monkeypatch):
    _clear_keys(monkeypatch)
    with pytest.raises(MTConfigError) as ctx:
        GoogleTranslateMethod()._resolve_credentials()
    assert "GOOGLE_TRANSLATE_API_KEY" in str(ctx.value)


def test_deepl_missing_key_raises_config_error(monkeypatch):
    _clear_keys(monkeypatch)
    with pytest.raises(MTConfigError) as ctx:
        DeepLMethod()._resolve_credentials()
    assert "DEEPL_API_KEY" in str(ctx.value)


def test_microsoft_missing_key_raises_config_error(monkeypatch):
    _clear_keys(monkeypatch)
    with pytest.raises(MTConfigError) as ctx:
        MicrosoftTranslatorMethod()._resolve_credentials()
    assert "MICROSOFT_TRANSLATOR_API_KEY" in str(ctx.value)


def test_translate_missing_key_raises_before_http(monkeypatch):
    """A missing key aborts the whole run (raises), not per-entry errors."""
    _clear_keys(monkeypatch)
    method = GoogleTranslateMethod()
    with pytest.raises(MTConfigError):
        asyncio.run(method.translate(_entries(2), StubConfig()))


def test_libretranslate_needs_no_key(monkeypatch):
    """Self-hosted LibreTranslate works without any key; endpoint defaults."""
    _clear_keys(monkeypatch)
    creds = LibreTranslateMethod()._resolve_credentials()
    assert creds["endpoint"] == "http://localhost:5000/translate"
    assert creds["api_key"] is None


def test_libretranslate_endpoint_from_env(monkeypatch):
    _clear_keys(monkeypatch)
    monkeypatch.setenv("LIBRETRANSLATE_API_URL", "https://lt.example/translate")
    creds = LibreTranslateMethod()._resolve_credentials()
    assert creds["endpoint"] == "https://lt.example/translate"


# ===========================================================================
# Language-code resolution helper (the names → codes contract).
# ===========================================================================

def test_resolve_lang_codes_canonicalizes_to_iso3():
    # Explicit codes resolve through the card SSOT to canonical ISO 639-3
    # (the card key) — 'en' → 'eng'. No verbatim pass-through.
    assert _resolve_lang_codes(StubConfig(source_code="en", target_code="crk")) == (
        "eng", "crk",
    )


def test_resolve_lang_codes_from_names_via_ssot():
    # With no explicit codes, the human names resolve through the SSOT.
    cfg = StubConfig(source_code="", target_code="",
                     source_lang="English", target_lang="French")
    assert _resolve_lang_codes(cfg) == ("eng", "fra")


def test_resolve_lang_codes_missing_raises_clear_error():
    # Neither codes nor names on either side → cannot resolve → fail loud.
    cfg = StubConfig(source_code="", target_code="",
                     source_lang="", target_lang="")
    with pytest.raises(MTConfigError) as ctx:
        _resolve_lang_codes(cfg)
    msg = str(ctx.value)
    assert "source" in msg and "target" in msg


def test_resolve_lang_codes_partial_missing_target():
    cfg = StubConfig(source_code="en", target_code="",
                     source_lang="English", target_lang="")
    with pytest.raises(MTConfigError) as ctx:
        _resolve_lang_codes(cfg)
    msg = str(ctx.value)
    # Only the target side is named as unresolved.
    assert "could not resolve: target " in msg


def test_to_provider_base_reads_iso639_1_from_card():
    # The provider base code is read straight off the SSOT card field — no
    # ISO-639-3→639-1 mapping table. eng → en, fra → fr.
    assert GoogleTranslateMethod()._to_provider_base("eng") == "en"
    assert DeepLMethod()._to_provider_base("fra") == "fr"


def test_to_provider_base_fail_honest_when_no_iso639_1():
    # Plains Cree has no ISO 639-1 code → raise (never POST a guessed code).
    with pytest.raises(MTConfigError) as ctx:
        GoogleTranslateMethod()._to_provider_base("crk")
    assert "crk" in str(ctx.value)


def test_env_first_priority(monkeypatch):
    monkeypatch.delenv("AAA_KEY", raising=False)
    monkeypatch.delenv("BBB_KEY", raising=False)
    assert _env_first("AAA_KEY", "BBB_KEY") is None
    monkeypatch.setenv("BBB_KEY", "second")
    assert _env_first("AAA_KEY", "BBB_KEY") == "second"
    monkeypatch.setenv("AAA_KEY", "first")
    assert _env_first("AAA_KEY", "BBB_KEY") == "first"


# ===========================================================================
# Protocol conformance — adapters are structurally TranslationMethod.
# ===========================================================================

@pytest.mark.parametrize("cls", ALL_METHODS)
def test_adapters_match_translation_method_protocol(cls):
    from mt_eval_harness.config import TranslationMethod
    method = cls()
    # runtime_checkable Protocol — structural check.
    assert isinstance(method, TranslationMethod)
    assert isinstance(method, HttpMTMethod)
    assert isinstance(method.name, str) and method.name


# ===========================================================================
# Taxonomy conformance — every registered MT method must publish a card whose
# class/paradigm are in the canonical enums. Regression guard for the
# "machine-translation-api" bug (an invalid class silently drops a method off
# the leaderboard's method-axis filters).
# ===========================================================================

def test_every_registered_method_card_is_on_taxonomy():
    from mt_eval_harness.config import (
        VALID_METHOD_CLASSES,
        VALID_PARADIGMS,
        validate_method_card,
    )
    assert MT_METHOD_REGISTRY, "registry must not be empty"
    for name in MT_METHOD_REGISTRY:
        method = get_mt_method(name)
        card = method.method_card()
        assert card is not None, f"{name}: method_card() returned None"
        assert card.get("class") in VALID_METHOD_CLASSES, (
            f"{name}: invalid method_class {card.get('class')!r} "
            f"(must be one of {sorted(VALID_METHOD_CLASSES)})"
        )
        assert card.get("paradigm") in VALID_PARADIGMS, (
            f"{name}: invalid paradigm {card.get('paradigm')!r} "
            f"(must be one of {sorted(VALID_PARADIGMS)})"
        )
        # Full card validation must pass with zero errors.
        assert validate_method_card(card) == [], (
            f"{name}: method card failed validation: {validate_method_card(card)}"
        )


# ===========================================================================
# Apertium-specific — rule-based, keyless, GET + responseData shape.
# ===========================================================================

def test_apertium_locale_passthrough():
    assert ApertiumMethod._map_locale("es") == "es"
    assert ApertiumMethod._map_locale("spa") == "spa"


def test_apertium_paradigm_is_rule_based():
    card = ApertiumMethod().method_card()
    assert card["paradigm"] == "rule-based"
    assert card["class"] == "api"


def test_apertium_keyless_credentials_default_endpoint():
    creds = ApertiumMethod()._resolve_credentials()
    assert creds["endpoint"] == "https://apertium.org/apy"
    # Keyless public API — no MTConfigError, key resolves to None.
    assert creds["api_key"] is None


def test_apertium_endpoint_env_strips_translate(monkeypatch):
    monkeypatch.setenv("APERTIUM_API_URL", "https://my.apy.example/translate/")
    assert ApertiumMethod()._resolve_endpoint() == "https://my.apy.example"


def test_apertium_parse_response_ok():
    payload = {"responseData": {"translatedText": "Hola, mundo."}, "responseStatus": 200}
    assert ApertiumMethod._parse_response(payload) == "Hola, mundo."


def test_apertium_parse_response_missing_raises():
    with pytest.raises(ValueError):
        ApertiumMethod._parse_response({"status": "error", "code": 400})


# ===========================================================================
# Amazon Translate-specific — neural-nmt, boto3/SigV4, AWS credential chain.
# ===========================================================================

def test_amazon_paradigm_and_class():
    card = AmazonTranslateMethod().method_card()
    assert card["paradigm"] == "neural-nmt"
    assert card["class"] == "api"


def test_amazon_locale_passthrough():
    assert AmazonTranslateMethod._map_locale("en") == "en"
    assert AmazonTranslateMethod._map_locale("es") == "es"


def test_amazon_credentials_fail_loud_without_key(monkeypatch):
    monkeypatch.delenv("AWS_ACCESS_KEY_ID", raising=False)
    with pytest.raises(MTConfigError):
        AmazonTranslateMethod()._resolve_credentials()


def test_amazon_credentials_need_region(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "AKIAfake")
    monkeypatch.delenv("AWS_REGION", raising=False)
    monkeypatch.delenv("AWS_DEFAULT_REGION", raising=False)
    with pytest.raises(MTConfigError):
        AmazonTranslateMethod()._resolve_credentials()


def test_amazon_credentials_ok_with_key_and_region(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "AKIAfake")
    monkeypatch.setenv("AWS_REGION", "ap-southeast-2")
    creds = AmazonTranslateMethod()._resolve_credentials()
    assert creds["region"] == "ap-southeast-2"


# ===========================================================================
# Tilde-specific — neural-nmt, X-Api-Key header, batched text[] body.
# ===========================================================================

def test_tilde_paradigm_and_class():
    card = TildeMethod().method_card()
    assert card["paradigm"] == "neural-nmt"
    assert card["class"] == "api"


def test_tilde_credentials_fail_loud_without_key(monkeypatch):
    monkeypatch.delenv("TILDE_API_KEY", raising=False)
    with pytest.raises(MTConfigError):
        TildeMethod()._resolve_credentials()


def test_tilde_build_request_shape():
    req = TildeMethod()._build_request(["Hello", "Bye"], "en", "de", "KEY123")
    assert req["url"] == "https://translate.tilde.ai/api/translate/text"
    assert req["headers"]["X-Api-Key"] == "KEY123"
    assert req["json"]["srcLang"] == "en"
    assert req["json"]["trgLang"] == "de"
    assert req["json"]["text"] == ["Hello", "Bye"]


def test_tilde_parse_response_ok():
    payload = {"translations": [{"translation": "Hallo"}, {"translation": "Tschüss"}]}
    assert TildeMethod._parse_response(payload, 2) == ["Hallo", "Tschüss"]


def test_tilde_parse_response_length_mismatch_raises():
    with pytest.raises(ValueError):
        TildeMethod._parse_response({"translations": [{"translation": "x"}]}, 2)


# ===========================================================================
# Local self-hosted model-specific — family detection, card-SSOT code
# resolution, and backend detection (all pure — no torch / ctranslate2).
# ===========================================================================

def test_local_model_family_detection():
    assert LocalModelMethod._family("Helsinki-NLP/opus-mt-en-es") == "opus"
    assert LocalModelMethod._family("facebook/nllb-200-distilled-600M") == "nllb"
    assert LocalModelMethod._family("google/madlad400-3b-mt") == "madlad"


def test_local_model_class_and_paradigm():
    card = LocalModelMethod().method_card()
    assert card["paradigm"] == "neural-nmt"
    assert card["class"] == "pipeline"


def test_local_model_nllb_code_from_card():
    """NLLB codes come from the card SSOT (methodSupport.nllb.code), NOT a
    hardcoded table. A language NLLB doesn't serve (no code on its card, e.g.
    Plains Cree) is fail-honest out-of-scope — never a guessed code."""
    m = LocalModelMethod(model="facebook/nllb-200-distilled-600M")
    assert m._to_provider_base("eng") == "eng_Latn"
    assert m._to_provider_base("fra") == "fra_Latn"
    with pytest.raises(MTConfigError):
        m._to_provider_base("crk")  # crk is not in NLLB-200


def test_local_model_madlad_code_from_card():
    """MADLAD's <2xx> token uses the card's iso639_1; a language without one is
    out of scope (fail-honest), not a bogus <2None>."""
    m = LocalModelMethod(model="google/madlad400-3b-mt")
    assert m._to_provider_base("eng") == "en"
    with pytest.raises(MTConfigError):
        m._to_provider_base("crk")  # crk has no iso639_1 code


def test_local_model_opus_code_passthrough():
    """OPUS-MT is pair-specific — the pair IS the model — so the code passes
    through untouched (even for a language with no ISO 639-1 code)."""
    m = LocalModelMethod(model="Helsinki-NLP/opus-mt-en-crk")
    assert m._to_provider_base("crk") == "crk"


def test_local_model_backend_detection(tmp_path):
    """auto: a CT2 model dir (has model.bin) → ctranslate2; an HF id →
    transformers. Explicit override wins; an unknown backend fails loud."""
    # An HF hub id → transformers.
    assert LocalModelMethod._select_backend("facebook/nllb-200-distilled-600M") == "transformers"
    # A directory that looks like a CTranslate2 conversion → ctranslate2.
    ct2_dir = tmp_path / "nllb-ct2"
    ct2_dir.mkdir()
    (ct2_dir / "model.bin").write_bytes(b"\x00")
    assert LocalModelMethod._is_ct2_dir(str(ct2_dir)) is True
    assert LocalModelMethod._select_backend(str(ct2_dir)) == "ctranslate2"
    # Explicit override wins over auto-detection.
    assert LocalModelMethod._select_backend(str(ct2_dir), "transformers") == "transformers"
    assert LocalModelMethod._select_backend("facebook/nllb-x", "ctranslate2") == "ctranslate2"
    with pytest.raises(MTConfigError):
        LocalModelMethod._select_backend("facebook/nllb-x", "bogus")


def test_local_model_resolve_model_from_flag_and_env(monkeypatch):
    """`--model` (forwarded as the `model` option) and LOCAL_MODEL_ID both name
    the model; the option wins, and creds carry the resolved backend."""
    pytest.importorskip("torch")
    pytest.importorskip("transformers")
    monkeypatch.delenv("LOCAL_MODEL_ID", raising=False)
    monkeypatch.delenv("LOCAL_MODEL_BACKEND", raising=False)
    # Via the forwarded --model option.
    creds = LocalModelMethod(model="facebook/nllb-200-distilled-600M")._resolve_credentials()
    assert creds["model_id"] == "facebook/nllb-200-distilled-600M"
    assert creds["family"] == "nllb"
    assert creds["backend"] == "transformers"
    # Via LOCAL_MODEL_ID env (no option).
    monkeypatch.setenv("LOCAL_MODEL_ID", "google/madlad400-3b-mt")
    creds_env = LocalModelMethod()._resolve_credentials()
    assert creds_env["model_id"] == "google/madlad400-3b-mt"
    assert creds_env["family"] == "madlad"
