"""
GoogleTranslateMethod — Google Cloud Translation API v2 adapter.

The universal neural-MT baseline. Mirrors the Champollion CLI
(cli/lib/methods/google-translate.js) exactly so a user's existing key works
for both:

    Endpoint:  POST https://translation.googleapis.com/language/translate/v2
    Body:      {"q": [...texts...], "source", "target", "format": "text"}
    Auth:      header  x-goog-api-key: <key>
    Env:       GOOGLE_TRANSLATE_API_KEY, then GOOGLE_API_KEY
    Batch:     max 128 segments / request
    Response:  json["data"]["translations"][i]["translatedText"]
    Locale:    {he → iw, jv → jw}
    Cost:      ~$20 / 1M characters
"""

from __future__ import annotations

import aiohttp

from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _env_first,
)

GOOGLE_API_URL = "https://translation.googleapis.com/language/translate/v2"

# Google uses BCP-47 with a couple of legacy quirks (see CLI's
# normalizeLocaleForGoogle). Map the ISO/BCP-47 code → Google's code.
GOOGLE_LOCALE_MAP = {
    "he": "iw",   # Hebrew: BCP-47 'he', Google uses 'iw'
    "jv": "jw",   # Javanese: BCP-47 'jv', Google uses 'jw'
}


class GoogleTranslateMethod(HttpMTMethod):
    """Google Cloud Translation API v2 system-under-test."""

    name = "google-translate"
    MAX_BATCH = 128

    method_id = "google-translate-v2"
    method_class = "api"
    paradigm = "neural-nmt"
    author = "Google"
    description = (
        "Google Cloud Translation API v2 — neural MT baseline, 130+ languages."
    )
    homepage = "https://cloud.google.com/translate"
    license = "Proprietary (Google ToS)"
    commercial_ready = True
    cost_note = "~$20 / 1M characters"

    # --- Locale mapping ---------------------------------------------------

    @staticmethod
    def _map_locale(code: str) -> str:
        """Map an ISO/BCP-47 code to Google's locale code (he→iw, jv→jw)."""
        return GOOGLE_LOCALE_MAP.get(code, code)

    # --- Credentials ------------------------------------------------------

    def _resolve_credentials(self) -> dict:
        """Resolve the Google API key.

        Priority: explicit option → GOOGLE_TRANSLATE_API_KEY → GOOGLE_API_KEY.
        """
        api_key = (
            self.options.get("google_api_key")
            or _env_first("GOOGLE_TRANSLATE_API_KEY", "GOOGLE_API_KEY")
        )
        if not api_key:
            raise MTConfigError(
                "Google Translate: no API key found. Set GOOGLE_TRANSLATE_API_KEY "
                "(or GOOGLE_API_KEY) in your environment."
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
        """Build the kwargs for the aiohttp POST (url/json/headers).

        Returns a dict suitable for ``session.post(**req)`` — exposed so
        tests can assert endpoint, auth header, and locale mapping without
        any network call.
        """
        return {
            "url": GOOGLE_API_URL,
            "json": {
                "q": list(texts),
                "source": self._map_locale(src),
                "target": self._map_locale(tgt),
                "format": "text",
            },
            # API key via header (not query string) so it can't leak in logs.
            "headers": {
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
        }

    @staticmethod
    def _parse_response(payload: dict, expected: int) -> list[str]:
        """Extract the ordered translations from a Google response payload."""
        translations = (payload or {}).get("data", {}).get("translations")
        if not translations or len(translations) != expected:
            got = len(translations) if translations else 0
            raise ValueError(
                f"Google Translate: response length mismatch "
                f"(expected {expected}, got {got})"
            )
        return [t["translatedText"] for t in translations]

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
                    raise RuntimeError(
                        f"Google Translate: HTTP {resp.status} — {body}"
                    )
                payload = await resp.json()
        return self._parse_response(payload, len(texts))
