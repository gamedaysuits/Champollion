"""
Consumer-reports MT system adapters for the MT Eval Harness.

This package provides ``TranslationMethod``-shaped adapters for traditional
commercial / open machine-translation systems (Google Translate, DeepL,
Microsoft Translator, LibreTranslate) so they can be evaluated as
systems-under-test alongside LLM methods.

These are standalone, self-contained adapters: each implements the
``mt_eval_harness.config.TranslationMethod`` protocol (``name``,
``method_card()``, ``async translate()``) and talks to its provider's REST
API over ``aiohttp``. They deliberately do NOT touch the existing runner,
config, CLI, or LLM provider plumbing — wiring ``--method google-translate``
into ``mt-eval run`` is a separate, later step.

Public surface:
    HttpMTMethod        — shared async base class (batch loop, result shaping)
    GoogleTranslateMethod, DeepLMethod, MicrosoftTranslatorMethod,
    LibreTranslateMethod — provider subclasses
    MT_METHOD_REGISTRY  — name → class map
    get_mt_method(name) — resolve a name to an instance

Env var names mirror the Champollion CLI (cli/lib/methods/*.js) so a user's
existing keys work for both the CLI and the harness:
    Google      GOOGLE_TRANSLATE_API_KEY, then GOOGLE_API_KEY
    DeepL       DEEPL_API_KEY (":fx" suffix → free endpoint)
    Microsoft   MICROSOFT_TRANSLATOR_API_KEY (+ MICROSOFT_TRANSLATOR_REGION)
    Libre       LIBRETRANSLATE_API_URL (default localhost:5000),
                LIBRETRANSLATE_API_KEY (optional)
"""

from __future__ import annotations

from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _resolve_lang_codes,
)
from mt_eval_harness.methods.google_translate import GoogleTranslateMethod
from mt_eval_harness.methods.deepl import DeepLMethod
from mt_eval_harness.methods.microsoft_translator import MicrosoftTranslatorMethod
from mt_eval_harness.methods.libretranslate import LibreTranslateMethod
from mt_eval_harness.methods.apertium import ApertiumMethod
from mt_eval_harness.methods.amazon_translate import AmazonTranslateMethod
from mt_eval_harness.methods.tilde import TildeMethod
from mt_eval_harness.methods.translated import TranslatedMethod
from mt_eval_harness.methods.local_model import LocalModelMethod
from mt_eval_harness.methods.registry import (
    MT_METHOD_REGISTRY,
    get_mt_method,
)

__all__ = [
    "HttpMTMethod",
    "MTConfigError",
    "_resolve_lang_codes",
    "GoogleTranslateMethod",
    "DeepLMethod",
    "MicrosoftTranslatorMethod",
    "LibreTranslateMethod",
    "ApertiumMethod",
    "AmazonTranslateMethod",
    "TildeMethod",
    "TranslatedMethod",
    "LocalModelMethod",
    "MT_METHOD_REGISTRY",
    "get_mt_method",
]
