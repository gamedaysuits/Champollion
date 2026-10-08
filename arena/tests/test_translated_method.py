"""TranslatedMethod (Lara) — adapter unit tests (SDK faked, no network)."""

from __future__ import annotations

import asyncio

import pytest

from mt_eval_harness.methods.base_http_mt import MTConfigError
from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
from mt_eval_harness.methods.translated import TranslatedMethod


class _FakeResult:
    def __init__(self, translation):
        self.translation = translation


class _FakeTranslator:
    def __init__(self):
        self.calls = []

    def translate(self, texts, src, tgt):
        self.calls.append((list(texts), src, tgt))
        return _FakeResult([f"[{tgt}] {t}" for t in texts])


def test_registered_in_mt_method_registry():
    assert MT_METHOD_REGISTRY["translated"] is TranslatedMethod


def test_missing_credentials_raise_config_error(monkeypatch):
    monkeypatch.delenv("LARA_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("LARA_ACCESS_KEY_SECRET", raising=False)
    with pytest.raises(MTConfigError, match="LARA_ACCESS_KEY_ID"):
        TranslatedMethod()._resolve_credentials()


def test_credentials_resolve_from_env(monkeypatch):
    monkeypatch.setenv("LARA_ACCESS_KEY_ID", "id-1")
    monkeypatch.setenv("LARA_ACCESS_KEY_SECRET", "sec-1")
    creds = TranslatedMethod()._resolve_credentials()
    assert creds == {"key_id": "id-1", "key_secret": "sec-1"}


def test_translate_texts_via_fake_translator():
    method = TranslatedMethod()
    fake = _FakeTranslator()
    method._translator = fake  # inject; _get_translator returns the cache

    out = asyncio.run(
        method._translate_texts(
            ["Hello", "World"], "en", "lv", {"key_id": "x", "key_secret": "y"}
        )
    )
    assert out == ["[lv] Hello", "[lv] World"]
    assert fake.calls == [(["Hello", "World"], "en", "lv")]


def test_parse_result_rejects_length_mismatch():
    with pytest.raises(ValueError, match="length mismatch"):
        TranslatedMethod._parse_result(_FakeResult(["one"]), expected=2)


def test_parse_result_accepts_single_string():
    assert TranslatedMethod._parse_result(_FakeResult("Sveiki"), expected=1) == [
        "Sveiki"
    ]


def test_locale_passthrough():
    assert TranslatedMethod._map_locale("en") == "en"
    assert TranslatedMethod._map_locale("pt") == "pt"
