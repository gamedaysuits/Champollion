"""
DeepLMethod — DeepL API adapter.

Mirrors the Champollion CLI (cli/lib/methods/deepl.js) so a user's existing
key works for both:

    Endpoint:  POST {base}/v2/translate
               base = https://api-free.deepl.com  (free keys, end in ":fx")
                      https://api.deepl.com        (pro keys)
    Body:      {"text": [...texts...], "target_lang": "<UP>",
                "source_lang": "<UP>"}
    Auth:      header  Authorization: DeepL-Auth-Key <key>
    Env:       DEEPL_API_KEY
    Batch:     128 segments / request (CLI default)
    Response:  json["translations"][i]["text"]
    Locale:    DeepL wants UPPERCASE language codes (en → EN, pt-br → PT-BR)
    Cost:      proprietary; free tier 500K chars/month

NOTE: the CLI also builds a glossary from coaching dictionaries and applies a
``formality`` parameter from language-card metadata. Those are CLI-side
enrichments (they require coaching data / language cards); the harness
system-under-test is the plain DeepL engine, so this adapter sends neither.
"""

from __future__ import annotations

import aiohttp

from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _env_first,
)

DEEPL_FREE_BASE = "https://api-free.deepl.com"
DEEPL_PRO_BASE = "https://api.deepl.com"


class DeepLMethod(HttpMTMethod):
    """DeepL translation API system-under-test."""

    name = "deepl"
    MAX_BATCH = 128

    method_id = "deepl-v2"
    method_class = "api"
    paradigm = "neural-nmt"
    author = "DeepL"
    description = "DeepL API — neural MT, high-quality European + select languages."
    homepage = "https://www.deepl.com/pro-api"
    license = "Proprietary (DeepL ToS)"
    commercial_ready = True
    cost_note = "Proprietary; free tier 500K chars/month (':fx' keys)"

    # --- Locale mapping ---------------------------------------------------

    @staticmethod
    def _map_locale(code: str) -> str:
        """DeepL expects uppercase codes (en→EN, pt-br→PT-BR)."""
        return code.upper()

    # --- Endpoint selection ----------------------------------------------

    @staticmethod
    def _resolve_base(api_key: str) -> str:
        """Free keys end in ':fx' and use the free-tier host."""
        return DEEPL_FREE_BASE if api_key.endswith(":fx") else DEEPL_PRO_BASE

    # --- Credentials ------------------------------------------------------

    def _resolve_credentials(self) -> dict:
        api_key = self.options.get("deepl_api_key") or _env_first("DEEPL_API_KEY")
        if not api_key:
            raise MTConfigError(
                "DeepL: no API key found. Set DEEPL_API_KEY in your environment. "
                "(Free keys end with ':fx' and are detected automatically.)"
            )
        return {"api_key": api_key, "base": self._resolve_base(api_key)}

    # --- Request / response (factored out for direct testing) -------------

    def _build_request(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        api_key: str,
        base: str,
    ) -> dict:
        """Build kwargs for the aiohttp POST (url/json/headers)."""
        return {
            "url": f"{base}/v2/translate",
            "json": {
                "text": list(texts),
                "target_lang": self._map_locale(tgt),
                "source_lang": self._map_locale(src),
            },
            "headers": {
                "Content-Type": "application/json",
                "Authorization": f"DeepL-Auth-Key {api_key}",
            },
        }

    @staticmethod
    def _parse_response(payload: dict, expected: int) -> list[str]:
        translations = (payload or {}).get("translations")
        if not translations or len(translations) != expected:
            got = len(translations) if translations else 0
            raise ValueError(
                f"DeepL: response length mismatch "
                f"(expected {expected}, got {got})"
            )
        return [t["text"] for t in translations]

    # --- Backend ----------------------------------------------------------

    async def _translate_texts(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        creds: dict,
    ) -> list[str]:
        req = self._build_request(
            texts, src, tgt, creds["api_key"], creds["base"],
        )
        async with aiohttp.ClientSession() as session:
            async with session.post(**req) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    raise RuntimeError(f"DeepL: HTTP {resp.status} — {body}")
                payload = await resp.json()
        return self._parse_response(payload, len(texts))
