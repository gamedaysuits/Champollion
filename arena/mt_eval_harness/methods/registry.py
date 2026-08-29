"""
Registry for consumer-reports MT system adapters.

Maps stable method NAMES (the same vocabulary the Champollion CLI uses:
"google-translate", "deepl", "microsoft-translator", "libretranslate") to
their adapter classes, and resolves a name to a ready-to-use instance.

This is the seam the later ``mt-eval run`` wiring will call: given
``--method google-translate`` (a NAME, not a plugin-dir path), look the name
up here to get a TranslationMethod instance. See the "remaining wiring"
notes in the task report for the exact runner/cli touch points.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from mt_eval_harness.methods.google_translate import GoogleTranslateMethod
from mt_eval_harness.methods.deepl import DeepLMethod
from mt_eval_harness.methods.microsoft_translator import MicrosoftTranslatorMethod
from mt_eval_harness.methods.libretranslate import LibreTranslateMethod
from mt_eval_harness.methods.apertium import ApertiumMethod
from mt_eval_harness.methods.amazon_translate import AmazonTranslateMethod
from mt_eval_harness.methods.tilde import TildeMethod
from mt_eval_harness.methods.translated import TranslatedMethod
from mt_eval_harness.methods.local_model import LocalModelMethod

if TYPE_CHECKING:  # pragma: no cover - typing only
    from mt_eval_harness.config import TranslationMethod


# name → adapter class. Names match the CLI's method registry so a config /
# CLI flag is interchangeable between the CLI and the harness.
MT_METHOD_REGISTRY: dict[str, type] = {
    "google-translate": GoogleTranslateMethod,
    "deepl": DeepLMethod,
    "microsoft-translator": MicrosoftTranslatorMethod,
    "libretranslate": LibreTranslateMethod,
    "apertium": ApertiumMethod,
    "amazon-translate": AmazonTranslateMethod,
    "tilde": TildeMethod,
    "translated": TranslatedMethod,
    "local-model": LocalModelMethod,
}


def get_mt_method(name: str, **options) -> "TranslationMethod":
    """Resolve a method name to a ready-to-use adapter instance.

    Args:
        name: One of MT_METHOD_REGISTRY's keys (case-insensitive,
              surrounding whitespace ignored).
        **options: Forwarded to the adapter constructor (e.g. an explicit
                   ``google_api_key`` / ``libretranslate_url``), mirroring the
                   CLI's ``options.*`` override-before-env pattern.

    Returns:
        An instance implementing the TranslationMethod protocol.

    Raises:
        ValueError: if ``name`` is not a known MT method (message lists the
                    available names).
    """
    resolved = (name or "").strip().lower()
    cls = MT_METHOD_REGISTRY.get(resolved)
    if cls is None:
        available = ", ".join(sorted(MT_METHOD_REGISTRY.keys()))
        raise ValueError(
            f"Unknown MT method '{name}'. Available: {available}."
        )
    return cls(**options)
