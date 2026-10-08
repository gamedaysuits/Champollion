"""
MicrosoftTranslatorMethod — Azure Cognitive Services Translator v3 adapter.

Mirrors the Champollion CLI (cli/lib/methods/microsoft-translator.js) so a
user's existing key works for both:

    Endpoint:  POST <endpoint>?api-version=3.0&from=<src>&to=<tgt>
               default https://api.cognitive.microsofttranslator.com/translate
    Body:      [{"Text": "..."}, ...]
    Auth:      header  Ocp-Apim-Subscription-Key: <key>
               header  Ocp-Apim-Subscription-Region: <region>   (if set)
    Env:       MICROSOFT_TRANSLATOR_API_KEY  (subscription key;
                                              AZURE_TRANSLATOR_KEY accepted as
                                              an alias)
               MICROSOFT_TRANSLATOR_REGION   (required for a regional /
                                              multi-service resource)
               MICROSOFT_TRANSLATOR_ENDPOINT (override for a custom-domain /
                                              VNet / private-endpoint resource)
    Batch:     max 100 segments / request
    Response:  json[i]["translations"][0]["text"]
    Locale:    pass-through (Azure uses BCP-47; no special remap)
    Cost:      proprietary; free tier 2M chars/month

    Azure AI Translator resource/auth shapes, and what this adapter supports:
      1. GLOBAL resource     — global endpoint + key only.            SUPPORTED
      2. REGIONAL / multi-service — global endpoint + key + REGION.   SUPPORTED
         (set MICROSOFT_TRANSLATOR_REGION)
      3. CUSTOM-DOMAIN / VNet / private endpoint — must use the
         resource's own endpoint, not the global one.                SUPPORTED
         (set MICROSOFT_TRANSLATOR_ENDPOINT to the resource URL)
      4. Microsoft Entra ID / Managed-Identity bearer-token auth —    NOT yet
         supported; this adapter authenticates with a subscription   supported
         key. If you only have token auth, the adapter fails loud
         (no key) rather than guessing. (See learn.microsoft.com →
         Azure Translator → Authentication.)
    Champollion evals are CORPUS-TYPE NEUTRAL: a corpus entry is arbitrary-
    length text, so short sentences, long complex sentences, and document-level
    tests are all first-class. This adapter uses Azure's real-time Text
    Translation API (handles text up to Azure's per-request limits; for very
    long entries reduce MAX_BATCH). Azure's separate async Document Translation
    API (whole-file workflows) and Custom Translator (trained models) are
    candidate FUTURE adapters, not an "out of scope" exclusion.
"""

from __future__ import annotations

from urllib.parse import urlencode

import aiohttp

from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _env_first,
)

MICROSOFT_API_BASE = "https://api.cognitive.microsofttranslator.com/translate"
MICROSOFT_API_VERSION = "3.0"


class MicrosoftTranslatorMethod(HttpMTMethod):
    """Microsoft (Azure) Translator v3 system-under-test."""

    name = "microsoft-translator"
    MAX_BATCH = 100

    method_id = "microsoft-translator-v3"
    method_class = "api"
    paradigm = "neural-nmt"
    author = "Microsoft"
    description = "Azure Cognitive Services Translator v3 — neural MT, 100+ languages."
    homepage = "https://learn.microsoft.com/azure/ai-services/translator/"
    license = "Proprietary (Microsoft ToS)"
    commercial_ready = True
    cost_note = "Proprietary; free tier 2M chars/month"

    # --- Locale mapping ---------------------------------------------------

    @staticmethod
    def _map_locale(code: str) -> str:
        """Azure Translator uses BCP-47 codes directly — pass through."""
        return code

    # --- Endpoint / credentials -------------------------------------------

    def _resolve_endpoint(self) -> str:
        """Resolve the translate endpoint.

        Defaults to the global endpoint. A custom-domain / VNet / private-
        endpoint resource sets MICROSOFT_TRANSLATOR_ENDPOINT to its own URL
        (host base or full /translate path — both accepted).
        """
        ep = (
            self.options.get("microsoft_endpoint")
            or _env_first("MICROSOFT_TRANSLATOR_ENDPOINT")
        )
        if not ep:
            return MICROSOFT_API_BASE
        ep = ep.rstrip("/")
        if not ep.endswith("/translate"):
            ep = ep + "/translate"
        return ep

    def _resolve_credentials(self) -> dict:
        # AZURE_TRANSLATOR_KEY is accepted as an alias for the subscription key
        # so a user's existing Azure env var works without renaming — the CLI
        # adapter (cli/lib/methods/microsoft-translator.js) and the shared
        # method-registry manifest recognize the same pair.
        api_key = (
            self.options.get("microsoft_api_key")
            or _env_first("MICROSOFT_TRANSLATOR_API_KEY", "AZURE_TRANSLATOR_KEY")
        )
        if not api_key:
            raise MTConfigError(
                "Microsoft Translator: no API key found. Set "
                "MICROSOFT_TRANSLATOR_API_KEY (or AZURE_TRANSLATOR_KEY) in your "
                "environment. (Entra ID / Managed-Identity token auth is not "
                "supported — use a subscription key.)"
            )
        # Region is optional (global resources omit it); pass through if set.
        region = (
            self.options.get("microsoft_region")
            or _env_first("MICROSOFT_TRANSLATOR_REGION")
        )
        return {
            "api_key": api_key,
            "region": region,
            "endpoint": self._resolve_endpoint(),
        }

    # --- Request / response (factored out for direct testing) -------------

    def _build_request(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        api_key: str,
        region: str | None,
        endpoint: str | None = None,
    ) -> dict:
        """Build kwargs for the aiohttp POST (url/json/headers)."""
        query = urlencode({
            "api-version": MICROSOFT_API_VERSION,
            "from": self._map_locale(src),
            "to": self._map_locale(tgt),
        })
        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "Ocp-Apim-Subscription-Key": api_key,
        }
        if region:
            headers["Ocp-Apim-Subscription-Region"] = region
        return {
            "url": f"{endpoint or MICROSOFT_API_BASE}?{query}",
            "json": [{"Text": t} for t in texts],
            "headers": headers,
        }

    @staticmethod
    def _parse_response(payload: list, expected: int) -> list[str]:
        if not payload or len(payload) != expected:
            got = len(payload) if payload else 0
            raise ValueError(
                f"Microsoft Translator: response length mismatch "
                f"(expected {expected}, got {got})"
            )
        return [item["translations"][0]["text"] for item in payload]

    # --- Backend ----------------------------------------------------------

    async def _translate_texts(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        creds: dict,
    ) -> list[str]:
        req = self._build_request(
            texts, src, tgt, creds["api_key"], creds.get("region"),
            creds.get("endpoint"),
        )
        async with aiohttp.ClientSession() as session:
            async with session.post(**req) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    raise RuntimeError(
                        f"Microsoft Translator: HTTP {resp.status} — {body}"
                    )
                payload = await resp.json()
        return self._parse_response(payload, len(texts))
