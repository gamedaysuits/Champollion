"""
ApertiumMethod — Apertium public REST API (APy) adapter.

Apertium is free/open-source RULE-BASED (shallow-transfer) MT — it populates
the ``rule-based`` cell of the leaderboard's paradigm axis (everything else so
far is neural-nmt or llm). It is strongest on closely-related language pairs
(es↔ca, es↔pt, eng↔cat, …). Hosted as a separate GPL service; we only call its
public API — no Apertium code is bundled (license boundary preserved).

    Endpoint:  GET <base>/translate?langpair=<src>|<tgt>&q=<text>&markUnknown=no
               default https://apertium.org/apy
    Auth:      none (public API). Keyed APy deployments accept ?key=<key>.
    Env:       APERTIUM_API_URL (optional endpoint override),
               APERTIUM_API_KEY (optional — only for keyed deployments)
    Batch:     1 segment / request (the translate endpoint takes one q)
    Response:  json["responseData"]["translatedText"]
    Locale:    pass-through — Apertium accepts ISO 639-1 ("es") or 639-3 ("spa")
    License:   GPL (Apertium) — invoked as a separate service, never bundled
    Cost:      free public API; rate-limited — be polite, self-host for volume

NOTE: not every pair is installed on the public instance (e.g. eng→fra returns
HTTP 400 "That pair is not installed"). That surfaces as a normal per-entry
error via the base translate() loop — honest, never faked.
"""

from __future__ import annotations

import aiohttp

from mt_eval_harness.methods.base_http_mt import HttpMTMethod, _env_first

APERTIUM_DEFAULT_BASE = "https://apertium.org/apy"

# Identifying User-Agent so Apertium sees attributable, creditable traffic
# (design directive: always attribute corpus/tool providers).
APERTIUM_USER_AGENT = (
    "Champollion-MT-Eval/0.1 (+https://champollion.dev; MT eval harness)"
)


class ApertiumMethod(HttpMTMethod):
    """Apertium rule-based MT system-under-test (public APy)."""

    name = "apertium"
    MAX_BATCH = 1  # the APy translate endpoint takes a single q text

    method_id = "apertium"
    # method_class = "api" (inherited). The headline: this is the rule-based
    # paradigm — the empty cell the method axis was built to fill.
    paradigm = "rule-based"
    author = "Apertium (open source)"
    description = (
        "Apertium — free/open-source rule-based (shallow-transfer) MT; "
        "strongest on closely-related language pairs."
    )
    homepage = "https://www.apertium.org"
    license = "GPL-3.0+ (Apertium)"
    # GPL service invoked over HTTP (never bundled). Flag for license review
    # rather than asserting commercial clearance — mirrors LibreTranslate.
    commercial_ready = False
    cost_note = "Free public API (rate-limited — be polite; self-host for volume)"

    # --- Locale mapping ---------------------------------------------------

    @staticmethod
    def _map_locale(code: str) -> str:
        """Apertium accepts both ISO 639-1 ('es') and 639-3 ('spa') — pass through."""
        return code

    # --- Endpoint / credentials -------------------------------------------

    def _resolve_endpoint(self) -> str:
        ep = (
            self.options.get("apertium_url")
            or _env_first("APERTIUM_API_URL")
            or APERTIUM_DEFAULT_BASE
        )
        ep = ep.rstrip("/")
        if ep.endswith("/translate"):
            ep = ep[: -len("/translate")]
        return ep

    def _resolve_credentials(self) -> dict:
        # Keyless public API (like LibreTranslate) — a missing key is NOT a
        # configuration error. Include a key only if the deployment needs one.
        return {
            "endpoint": self._resolve_endpoint(),
            "api_key": (
                self.options.get("apertium_api_key")
                or _env_first("APERTIUM_API_KEY")
            ),
        }

    # --- Response parsing (factored out for direct testing) ---------------

    @staticmethod
    def _parse_response(payload: dict) -> str:
        data = (payload or {}).get("responseData") or {}
        translated = data.get("translatedText")
        if translated is None:
            raise ValueError(
                f"Apertium: no translatedText in response: {str(payload)[:200]}"
            )
        return translated

    # --- Backend ----------------------------------------------------------

    async def _translate_texts(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        creds: dict,
    ) -> list[str]:
        # One GET per text. MAX_BATCH=1 means the base loop already hands us a
        # single-element list, but loop defensively so any batch size works.
        langpair = f"{self._map_locale(src)}|{self._map_locale(tgt)}"
        base = creds["endpoint"]
        headers = {"User-Agent": APERTIUM_USER_AGENT}
        out: list[str] = []
        async with aiohttp.ClientSession(headers=headers) as session:
            for text in texts:
                params = {"langpair": langpair, "q": text, "markUnknown": "no"}
                if creds.get("api_key"):
                    params["key"] = creds["api_key"]
                async with session.get(f"{base}/translate", params=params) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        raise RuntimeError(
                            f"Apertium: HTTP {resp.status} — {body[:200]}"
                        )
                    # content_type=None: APy may send text/json; don't reject it.
                    payload = await resp.json(content_type=None)
                out.append(self._parse_response(payload))
        return out
