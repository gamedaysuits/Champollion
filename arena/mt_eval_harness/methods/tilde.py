"""
TildeMethod — Tilde MT REST API adapter.

Tilde MT is a European-developed neural MT engine (34 languages), notably
strong on Baltic and other lower-resource European languages — a useful
complement to the US-centric engines.

    Endpoint:  POST https://translate.tilde.ai/api/translate/text
    Auth:      header  X-Api-Key: <key>
    Env:       TILDE_API_KEY  (free trial key at translate.tilde.ai/access-keys)
    Batch:     array `text` field — batches natively
    Body:      {"srcLang": "en", "trgLang": "de", "domain": "general",
                "text": [...], "termCollections": []}
    Response:  json["translations"][i]["translation"]
    Locale:    ISO 639-1 (read off the card via PROVIDER_CODE_FIELD)
    Cost:      proprietary; free trial 250K chars (no card)
"""

from __future__ import annotations

import aiohttp

from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _env_first,
)

TILDE_API_URL = "https://translate.tilde.ai/api/translate/text"


class TildeMethod(HttpMTMethod):
    """Tilde MT API system-under-test."""

    name = "tilde"
    MAX_BATCH = 25

    method_id = "tilde-mt"
    paradigm = "neural-nmt"  # method_class="api" inherited
    PROVIDER_CODE_FIELD = "iso639_1"
    author = "Tilde"
    description = (
        "Tilde MT — European-developed neural MT (34 languages); strong on "
        "Baltic and lower-resource European languages."
    )
    homepage = "https://tilde.ai/machine-translation/"
    license = "Proprietary (Tilde ToS)"
    commercial_ready = True
    cost_note = "Proprietary; free trial 250K chars (no card)"

    # Translation domain: "general" or "general ai" (Tilde-specific).
    domain = "general"

    # --- Locale mapping ---------------------------------------------------

    @staticmethod
    def _map_locale(code: str) -> str:
        """Tilde uses plain ISO 639-1 codes — pass through."""
        return code

    # --- Credentials ------------------------------------------------------

    def _resolve_credentials(self) -> dict:
        api_key = self.options.get("tilde_api_key") or _env_first("TILDE_API_KEY")
        if not api_key:
            raise MTConfigError(
                "Tilde: no API key found. Set TILDE_API_KEY in your environment "
                "(free trial key at https://translate.tilde.ai/access-keys)."
            )
        return {"api_key": api_key}

    # --- Request / response (factored out for direct testing) -------------

    def _build_request(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        api_key: str,
    ) -> dict:
        return {
            "url": TILDE_API_URL,
            "json": {
                "srcLang": self._map_locale(src),
                "trgLang": self._map_locale(tgt),
                "domain": self.domain,
                "text": list(texts),
                "termCollections": [],
            },
            "headers": {
                "Content-Type": "application/json",
                "X-Api-Key": api_key,
            },
        }

    @staticmethod
    def _parse_response(payload: dict, expected: int) -> list[str]:
        translations = (payload or {}).get("translations")
        if not translations or len(translations) != expected:
            got = len(translations) if translations else 0
            raise ValueError(
                f"Tilde: response length mismatch (expected {expected}, got {got})"
            )
        return [t["translation"] for t in translations]

    # --- Backend ----------------------------------------------------------

    async def _translate_texts(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        creds: dict,
    ) -> list[str]:
        req = self._build_request(texts, src, tgt, creds["api_key"])
        async with aiohttp.ClientSession() as session:
            async with session.post(**req) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    raise RuntimeError(f"Tilde: HTTP {resp.status} — {body[:300]}")
                payload = await resp.json()
        return self._parse_response(payload, len(texts))
