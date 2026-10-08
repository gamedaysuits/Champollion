"""
LibreTranslateMethod — LibreTranslate (self-hosted / hosted) adapter.

Mirrors the Champollion CLI (cli/lib/methods/libretranslate.js) so a user's
existing config works for both:

    Endpoint:  POST <LIBRETRANSLATE_API_URL>
               default http://localhost:5000/translate
    Body:      {"q": [...texts...], "source", "target", "format": "text",
                "api_key": <key>}   (api_key only if provided)
    Auth:      none for self-hosted; optional api_key in the JSON body
    Env:       LIBRETRANSLATE_API_URL  (endpoint, default localhost:5000)
               LIBRETRANSLATE_API_KEY  (optional)
    Batch:     64 segments / request (CLI default)
    Response:  json["translatedText"] — an array for a batch ``q``; a plain
               string for a single-item batch (LibreTranslate quirk).
    Locale:    pass-through (LibreTranslate uses ISO-639-1 codes)
    License:   AGPL-3.0 (open source) — the only non-proprietary system here.

Unlike the cloud APIs, LibreTranslate is open-source and self-hostable, so a
missing API key is NOT a configuration error — only a missing endpoint would
be (and that defaults to localhost). The system is reachable-or-not at HTTP
time, which surfaces as a per-entry error like any other batch failure.
"""

from __future__ import annotations

import aiohttp

from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    _env_first,
)

DEFAULT_LIBRETRANSLATE_URL = "http://localhost:5000/translate"


class LibreTranslateMethod(HttpMTMethod):
    """LibreTranslate (AGPL, self-hostable) system-under-test."""

    name = "libretranslate"
    MAX_BATCH = 64

    method_id = "libretranslate"
    method_class = "api"
    paradigm = "neural-nmt"
    author = "LibreTranslate (open source)"
    description = (
        "LibreTranslate — open-source neural MT (Argos Translate), self-hostable."
    )
    homepage = "https://libretranslate.com"
    license = "AGPL-3.0"
    # The engine is open-source/self-hosted; a deployment may be used
    # commercially, but AGPL obligations apply — flag for license review
    # rather than asserting commercial clearance.
    commercial_ready = False
    cost_note = "Free / self-hosted (AGPL-3.0 obligations apply)"

    # --- Locale mapping ---------------------------------------------------

    @staticmethod
    def _map_locale(code: str) -> str:
        """LibreTranslate uses ISO-639-1 codes directly — pass through."""
        return code

    # --- Endpoint / credentials -------------------------------------------

    def _resolve_endpoint(self) -> str:
        return (
            self.options.get("libretranslate_url")
            or _env_first("LIBRETRANSLATE_API_URL")
            or DEFAULT_LIBRETRANSLATE_URL
        )

    def _resolve_credentials(self) -> dict:
        # No key required for self-hosted; include it only if present.
        api_key = (
            self.options.get("libretranslate_api_key")
            or _env_first("LIBRETRANSLATE_API_KEY")
        )
        return {"endpoint": self._resolve_endpoint(), "api_key": api_key}

    # --- Request / response (factored out for direct testing) -------------

    def _build_request(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        endpoint: str,
        api_key: str | None,
    ) -> dict:
        """Build kwargs for the aiohttp POST (url/json/headers)."""
        body = {
            "q": list(texts),
            "source": self._map_locale(src),
            "target": self._map_locale(tgt),
            "format": "text",
        }
        if api_key:
            body["api_key"] = api_key
        return {
            "url": endpoint,
            "json": body,
            "headers": {"Content-Type": "application/json"},
        }

    @staticmethod
    def _parse_response(payload: dict, expected: int) -> list[str]:
        """Parse LibreTranslate's translatedText.

        For an array ``q`` request, ``translatedText`` is normally an array.
        For a single-item batch, some LibreTranslate versions return a plain
        string — handle that so a batch_size=1 run still works.
        """
        translated = (payload or {}).get("translatedText")
        if isinstance(translated, list):
            if len(translated) != expected:
                raise ValueError(
                    f"LibreTranslate: response length mismatch "
                    f"(expected {expected}, got {len(translated)})"
                )
            return list(translated)
        if isinstance(translated, str) and expected == 1:
            return [translated]
        raise ValueError(
            "LibreTranslate: unexpected translatedText format "
            f"(expected list of {expected} or a single string)."
        )

    # --- Backend ----------------------------------------------------------

    async def _translate_texts(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        creds: dict,
    ) -> list[str]:
        req = self._build_request(
            texts, src, tgt, creds["endpoint"], creds.get("api_key"),
        )
        async with aiohttp.ClientSession() as session:
            async with session.post(**req) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    raise RuntimeError(
                        f"LibreTranslate: HTTP {resp.status} — {body}"
                    )
                payload = await resp.json()
        return self._parse_response(payload, len(texts))
