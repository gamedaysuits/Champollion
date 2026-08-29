"""
TranslatedMethod — Translated (Lara) professional MT adapter.

Lara is Translated's production MT platform (the ModernMT lineage; ModernMT
sunsets into Lara at the end of 2026). Requests are HMAC-signed, so this
adapter goes through the official ``lara-sdk`` package rather than
hand-rolling the signature — the SDK owns auth, endpoint, and retries.

    SDK:       pip install lara-sdk   (lazy-imported; clear error if absent)
    Auth:      LARA_ACCESS_KEY_ID + LARA_ACCESS_KEY_SECRET
               (laratranslate.com → Settings → API Keys)
    Batch:     the SDK translate() accepts a list of strings
    Locale:    BCP-47; base ISO 639-1 codes auto-resolve to the default
               regional locale (en → en-US), so card codes pass through
    Cost:      proprietary, plan-based; never invent pricing
"""

from __future__ import annotations

import asyncio

from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _env_first,
)


class TranslatedMethod(HttpMTMethod):
    """Translated (Lara) MT API system-under-test."""

    name = "translated"
    MAX_BATCH = 50

    method_id = "translated-lara"
    paradigm = "neural-nmt"  # method_class="api" inherited
    PROVIDER_CODE_FIELD = "iso639_1"
    author = "Translated"
    description = (
        "Translated (Lara) — professional MT platform (200+ languages; "
        "ModernMT lineage), adaptive translation with the official SDK."
    )
    homepage = "https://laratranslate.com"
    license = "Proprietary (Translated ToS)"
    commercial_ready = True
    cost_note = "Proprietary; plan-based pricing (per-character cost not published)"

    # --- Locale mapping ---------------------------------------------------

    @staticmethod
    def _map_locale(code: str) -> str:
        """Lara accepts base ISO 639-1 codes (defaults the regional locale)."""
        return code

    # --- Credentials ------------------------------------------------------

    def _resolve_credentials(self) -> dict:
        key_id = self.options.get("lara_access_key_id") or _env_first(
            "LARA_ACCESS_KEY_ID"
        )
        key_secret = self.options.get("lara_access_key_secret") or _env_first(
            "LARA_ACCESS_KEY_SECRET"
        )
        if not key_id or not key_secret:
            raise MTConfigError(
                "Translated (Lara): missing credentials. Set LARA_ACCESS_KEY_ID "
                "and LARA_ACCESS_KEY_SECRET (laratranslate.com → Settings → "
                "API Keys)."
            )
        return {"key_id": key_id, "key_secret": key_secret}

    # --- SDK client (factored out so tests can inject a fake) --------------

    _translator = None  # cached SDK Translator instance

    def _get_translator(self, creds: dict):
        if self._translator is not None:
            return self._translator
        try:
            from lara import Credentials, Translator  # lazy: optional dep
        except ImportError as e:
            raise MTConfigError(
                "Translated (Lara): the 'lara-sdk' package is not installed — "
                "run `pip install lara-sdk`."
            ) from e
        self._translator = Translator(
            Credentials(creds["key_id"], creds["key_secret"])
        )
        return self._translator

    @staticmethod
    def _parse_result(result, expected: int) -> list[str]:
        """Normalize the SDK's TextResult into an ordered list of strings."""
        translation = getattr(result, "translation", None)
        if translation is None and isinstance(result, dict):
            translation = result.get("translation")
        if isinstance(translation, str):
            translation = [translation]
        if not translation or len(translation) != expected:
            got = len(translation) if translation else 0
            raise ValueError(
                f"Translated: response length mismatch (expected {expected}, got {got})"
            )
        return [str(t) for t in translation]

    # --- Backend ----------------------------------------------------------

    async def _translate_texts(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        creds: dict,
    ) -> list[str]:
        translator = self._get_translator(creds)
        # The SDK is synchronous; run it off the event loop.
        result = await asyncio.to_thread(
            translator.translate,
            list(texts),
            self._map_locale(src),
            self._map_locale(tgt),
        )
        return self._parse_result(result, len(texts))
