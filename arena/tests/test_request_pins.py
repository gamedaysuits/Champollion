"""Golden pins of what the harness puts on the wire — CURRENT BEHAVIOUR, NOT BLESSED.

These tests record, per LLM provider and per HTTP MT adapter, the exact request
the harness sends today, plus two fixtures that reproduce known scoring defects
(the fingerprint collision and the COMET per-entry shift). They exist so that
every later scoring fix shows up as a reviewable diff of
``fixtures/request_pins.json`` instead of an unexamined behaviour change.

A pin that changes is not a failure to "fix" by regenerating: it is a scoring
change and needs a CHANGELOG line. Regenerate deliberately with

    CHAMPOLLION_UPDATE_PINS=1 python -m pytest tests/test_request_pins.py

and commit the fixture diff together with the change that caused it.

Secrets never enter the fixture: auth header values and URL query keys are
replaced with ``<redacted>`` before recording.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import pytest

from mt_eval_harness import publish
from mt_eval_harness.api import build_system_message, call_openrouter
from mt_eval_harness.config import RunConfig
from mt_eval_harness.providers.anthropic_provider import AnthropicProvider
from mt_eval_harness.providers.gemini_provider import GeminiProvider
from mt_eval_harness.providers.local_provider import LocalProvider
from mt_eval_harness.providers.openai_provider import OpenAIProvider
from mt_eval_harness.methods import (
    apertium as apertium_mod,
    deepl as deepl_mod,
    google_translate as google_mod,
    libretranslate as libre_mod,
    microsoft_translator as microsoft_mod,
    tilde as tilde_mod,
)

from test_publish import _make_report, _make_run_log

PINS_PATH = Path(__file__).parent / "fixtures" / "request_pins.json"
UPDATE = os.environ.get("CHAMPOLLION_UPDATE_PINS") == "1"

_SECRET_HEADERS = {
    "authorization", "x-api-key", "x-goog-api-key",
    "ocp-apim-subscription-key",
}
_SECRET_QUERY = {"key"}

_recorded: dict[str, Any] = {}


def _load_pins() -> dict:
    if PINS_PATH.exists():
        return json.loads(PINS_PATH.read_text(encoding="utf-8"))
    return {}


def _redact_url(url: str) -> str:
    parts = urlsplit(url)
    if not parts.query:
        return url
    query = [(k, "<redacted>" if k in _SECRET_QUERY else v)
             for k, v in parse_qsl(parts.query, keep_blank_values=True)]
    return urlunsplit(parts._replace(query=urlencode(query)))


def _redact_headers(headers: dict | None) -> dict:
    return {k: ("<redacted>" if k.lower() in _SECRET_HEADERS else v)
            for k, v in sorted((headers or {}).items())}


def _check(case: str, observed: Any) -> None:
    """Compare ``observed`` to the pinned value (or record it in update mode)."""
    observed = json.loads(json.dumps(observed, ensure_ascii=False))
    if UPDATE:
        _recorded[case] = observed
        pins = _load_pins()
        pins.update(_recorded)
        PINS_PATH.parent.mkdir(parents=True, exist_ok=True)
        PINS_PATH.write_text(
            json.dumps(pins, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        return
    pins = _load_pins()
    assert case in pins, (
        f"no pin for {case!r} — regenerate with CHAMPOLLION_UPDATE_PINS=1")
    assert observed == pins[case], (
        f"wire request for {case!r} changed. That is a scoring change: "
        f"regenerate the pin deliberately and add a CHANGELOG line.")


# ---------------------------------------------------------------------------
# Fake aiohttp layer. Captures every request; answers in each vendor's shape.
# ---------------------------------------------------------------------------

class _FakeResponse:
    def __init__(self, payload: Any, status: int = 200):
        self.status = status
        self.headers: dict = {}
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def json(self, content_type=None):
        return self._payload

    async def text(self):
        return json.dumps(self._payload)


class _FakeSession:
    def __init__(self, reply):
        self._reply = reply
        self.calls: list[dict] = []
        self.session_headers: dict = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def _record(self, method: str, url: str, kwargs: dict) -> _FakeResponse:
        call = {
            "method": method,
            "url": _redact_url(url),
            "headers": _redact_headers(
                {**self.session_headers, **(kwargs.get("headers") or {})}),
        }
        if "json" in kwargs:
            call["json"] = kwargs["json"]
        if "params" in kwargs:
            call["params"] = {k: ("<redacted>" if k in _SECRET_QUERY else v)
                              for k, v in kwargs["params"].items()}
        self.calls.append(call)
        return _FakeResponse(self._reply(call))

    def post(self, url=None, **kwargs):
        return self._record("POST", url if url is not None else kwargs.pop("url"), kwargs)

    def get(self, url=None, **kwargs):
        return self._record("GET", url if url is not None else kwargs.pop("url"), kwargs)


_MESSAGES = [
    {"role": "system", "content": "SYSTEM PROMPT"},
    {"role": "user", "content": "Hello, world."},
]
_CACHED_MESSAGES = [
    build_system_message("SYSTEM PROMPT"),
    {"role": "user", "content": "Hello, world."},
]


def _chat_reply(_call):
    return {"choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1}}


def _anthropic_reply(_call):
    return {"content": [{"type": "text", "text": "ok"}],
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 1, "output_tokens": 1}}


def _gemini_reply(_call):
    return {"candidates": [{"content": {"parts": [{"text": "ok"}]},
                            "finishReason": "STOP"}],
            "usageMetadata": {"promptTokenCount": 1, "candidatesTokenCount": 1}}


def _run_llm(call_fn, reply, **kwargs) -> dict:
    session = _FakeSession(reply)
    result = asyncio.run(call_fn(
        session=session,
        api_key="SECRET",
        semaphore=asyncio.Semaphore(1),
        **kwargs,
    ))
    assert result.get("error") is None, result
    assert len(session.calls) == 1
    return session.calls[0]


# ---------------------------------------------------------------------------
# LLM providers
# ---------------------------------------------------------------------------

LLM_CASES = {
    "llm/openrouter/temp0": (
        call_openrouter, _chat_reply,
        dict(messages=_CACHED_MESSAGES, model_id="google/gemini-3.1-pro-preview")),
    "llm/openrouter/temp0/restricted-corpus": (
        call_openrouter, _chat_reply,
        dict(messages=_CACHED_MESSAGES, model_id="google/gemini-3.1-pro-preview",
             provider_prefs={"data_collection": "deny"})),
    # A1: temperature 0 is OMITTED for Anthropic, so the API default (1.0) applies.
    "llm/anthropic/temp0": (
        AnthropicProvider().call, _anthropic_reply,
        dict(messages=_CACHED_MESSAGES, model_id="anthropic/claude-haiku-4.5",
             temperature=0.0)),
    "llm/anthropic/temp0.01": (
        AnthropicProvider().call, _anthropic_reply,
        dict(messages=_CACHED_MESSAGES, model_id="anthropic/claude-sonnet-4",
             temperature=0.01)),
    "llm/openai/temp0": (
        OpenAIProvider().call, _chat_reply,
        dict(messages=_CACHED_MESSAGES, model_id="openai/gpt-4o")),
    "llm/gemini/temp0": (
        GeminiProvider().call, _gemini_reply,
        dict(messages=_CACHED_MESSAGES, model_id="google/gemini-2.5-flash")),
    "llm/local/temp0": (
        LocalProvider(base_url="http://localhost:11434/v1").call, _chat_reply,
        dict(messages=_MESSAGES, model_id="local/llama3.1")),
}


@pytest.mark.parametrize("case", sorted(LLM_CASES))
def test_llm_provider_wire_request(case):
    call_fn, reply, kwargs = LLM_CASES[case]
    _check(case, _run_llm(call_fn, reply, **kwargs))


@pytest.mark.parametrize("model_id, expected", [
    ("anthropic/claude-sonnet-4", 0.01),     # listed → 0.01 reaches the wire
    ("anthropic/claude-haiku-4.5", 0.0),     # not listed → 0 → omitted (A1)
    ("google/gemini-3.1-pro-preview", 0.0),
])
def test_effective_temperature_resolution(model_id, expected):
    cfg = RunConfig(model=model_id, temperature=0.0)
    assert cfg.effective_temperature == expected


# ---------------------------------------------------------------------------
# HTTP MT adapters — full translate() path, so language-code resolution and
# batching are pinned too, not just the request builder.
# ---------------------------------------------------------------------------

class _Cfg:
    source_field = "source"
    source_lang = "English"
    target_lang = "French"
    source_code = "en"
    target_code = "fr"
    batch_size = 25


def _entries(n: int) -> list[dict]:
    return [{"id": i, "source": f"sentence {i}"} for i in range(n)]


def _n_texts(call) -> int:
    body = call.get("json")
    if isinstance(body, dict):
        for key in ("text", "q"):
            if isinstance(body.get(key), list):
                return len(body[key])
    if isinstance(body, list):
        return len(body)
    return 1


MT_CASES = {
    "mt/deepl": (
        deepl_mod, deepl_mod.DeepLMethod, {"DEEPL_API_KEY": "SECRET:fx"},
        lambda c: {"translations": [{"text": "T"}] * _n_texts(c)}),
    "mt/google-translate": (
        google_mod, google_mod.GoogleTranslateMethod,
        {"GOOGLE_TRANSLATE_API_KEY": "SECRET"},
        lambda c: {"data": {"translations": [{"translatedText": "T"}] * _n_texts(c)}}),
    "mt/microsoft-translator": (
        microsoft_mod, microsoft_mod.MicrosoftTranslatorMethod,
        {"MICROSOFT_TRANSLATOR_API_KEY": "SECRET"},
        lambda c: [{"translations": [{"text": "T"}]}] * _n_texts(c)),
    "mt/libretranslate": (
        libre_mod, libre_mod.LibreTranslateMethod,
        {"LIBRETRANSLATE_API_URL": "https://lt.example/translate"},
        lambda c: {"translatedText": ["T"] * _n_texts(c)}),
    "mt/tilde": (
        tilde_mod, tilde_mod.TildeMethod, {"TILDE_API_KEY": "SECRET"},
        lambda c: {"translations": [{"translation": "T"}] * _n_texts(c)}),
    "mt/apertium": (
        apertium_mod, apertium_mod.ApertiumMethod,
        {"APERTIUM_API_URL": "https://apy.example"},
        lambda c: {"responseData": {"translatedText": "T"}}),
}

_MT_ENV_TO_CLEAR = (
    "DEEPL_API_KEY", "GOOGLE_TRANSLATE_API_KEY", "GOOGLE_API_KEY",
    "MICROSOFT_TRANSLATOR_API_KEY", "AZURE_TRANSLATOR_KEY",
    "MICROSOFT_TRANSLATOR_REGION", "MICROSOFT_TRANSLATOR_ENDPOINT",
    "LIBRETRANSLATE_API_URL", "LIBRETRANSLATE_API_KEY", "TILDE_API_KEY",
    "APERTIUM_API_URL", "APERTIUM_API_KEY",
)


@pytest.mark.parametrize("case", sorted(MT_CASES))
def test_mt_adapter_wire_requests(case, monkeypatch):
    module, cls, env, reply = MT_CASES[case]
    for name in _MT_ENV_TO_CLEAR:
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)

    session = _FakeSession(reply)

    def _session_factory(*args, headers=None, **kwargs):
        session.session_headers = dict(headers or {})
        return session

    monkeypatch.setattr(module.aiohttp, "ClientSession", _session_factory)

    # 30 entries: more than the harness batch (25) so chunking is pinned.
    results = asyncio.run(cls().translate(_entries(30), _Cfg()))
    assert all(r["error"] is None for r in results), results[:2]
    _check(case, session.calls)


# ---------------------------------------------------------------------------
# A4 — fingerprint collision (current behaviour: two different setups share one
# card id, and the second is refused as "already published").
# ---------------------------------------------------------------------------

@pytest.fixture
def _no_git(monkeypatch):
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)


def _assemble(tmp_path: Path, name: str, **config_overrides) -> tuple[str, str]:
    tmp_path.mkdir(parents=True, exist_ok=True)
    run_log = _make_run_log()
    run_log["config"].update(config_overrides)
    log_path = tmp_path / f"{name}.json"
    log_path.write_text(json.dumps(run_log), encoding="utf-8")
    report_path = tmp_path / f"{name}_report.json"
    report_path.write_text(json.dumps(_make_report(str(log_path))), encoding="utf-8")
    _, card_id, fingerprint = publish.assemble_run_card(report_path)
    return card_id, fingerprint


def test_fingerprint_collision_across_providers(tmp_path, _no_git):
    via_openrouter = _assemble(tmp_path / "a", "run", provider="openrouter",
                               max_tokens=32768)
    via_anthropic = _assemble(tmp_path / "b", "run", provider="anthropic",
                              max_tokens=16384)
    _check("fingerprint/collision-across-providers", {
        "same_card_id": via_openrouter[0] == via_anthropic[0],
        "same_fingerprint": via_openrouter[1] == via_anthropic[1],
    })


# ---------------------------------------------------------------------------
# COMET — an EMPTY prediction is scored as an empty hypothesis (the chrF++/BLEU
# population), and per-entry scores come back aligned to the entries. Until
# 0.2 empties were dropped from the corpus mean and every later per-entry score
# shifted onto the wrong entry (the first version of this pin recorded that).
# ---------------------------------------------------------------------------

def test_comet_empty_prediction_handling(monkeypatch):
    from mt_eval_harness import metrics_comet

    class _Out:
        def __init__(self, data):
            # A score that identifies which hypothesis produced it.
            self.scores = [0.1 * (i + 1) for i, _ in enumerate(data)]
            self.system_score = sum(self.scores) / len(self.scores)

    class _Model:
        def predict(self, data, gpus=0, **kwargs):
            self.seen = [d["mt"] for d in data]
            return _Out(data)

    model = _Model()
    monkeypatch.setattr(metrics_comet, "HAS_COMET", True)
    monkeypatch.setattr(metrics_comet, "_load_model", lambda name: model)

    entries = [
        {"source": "a", "expected": "A", "predicted": "A", "error": None},
        {"source": "b", "expected": "B", "predicted": "", "error": None},
        {"source": "c", "expected": "C", "predicted": "C", "error": None},
    ]
    result = metrics_comet.compute_comet(entries, target_lang="fr")

    # per_entry_scores is aligned to `entries` (tester.py indexes by position).
    attached = list(result.per_entry_scores)

    _check("comet/empty-prediction", {
        "scored_hypotheses": model.seen,
        "n_entries": result.n_entries,
        "corpus_score": result.corpus_score,
        "attached_per_entry": attached,
    })


def test_a_pre_0_2_run_log_keeps_its_v1_fingerprint(tmp_path, _no_git, monkeypatch):
    """Republishing an old run log must reproduce its original card id."""
    import hashlib
    run_log = _make_run_log()
    run_log["harness_version"] = "0.1.1"
    log_path = tmp_path / "old.json"
    log_path.write_text(json.dumps(run_log), encoding="utf-8")
    report_path = tmp_path / "old_report.json"
    report_path.write_text(json.dumps(_make_report(str(log_path))), encoding="utf-8")
    card, _cid, fp = publish.assemble_run_card(report_path)
    v1 = {k: card["fingerprint"]["components"][k] for k in (
        "dataset_sha256", "model_slug", "condition", "system_prompt_sha256",
        "temperature", "batch_size", "tools_enabled", "harness_version")}
    assert card["fingerprint"]["version"] == 1
    assert set(card["fingerprint"]["components"]) == set(v1)
    assert fp == hashlib.sha256(json.dumps(v1, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def test_v2_never_stores_the_raw_endpoint(tmp_path, _no_git):
    card_id, _ = _assemble(tmp_path / "a", "run", provider="openai",
                           base_url="https://user:secret@internal.corp.example:8443/v1")
    report = next((tmp_path / "a").glob("*_report.json"))
    card, _, _ = publish.assemble_run_card(report)
    comps = card["fingerprint"]["components"]
    assert card["fingerprint"]["version"] == 2
    assert "internal.corp" not in json.dumps(comps) and "secret" not in json.dumps(comps)
    assert len(comps["endpoint_host_sha256"]) == 64
