"""
HttpMTMethod — shared base class for REST-API machine-translation adapters.

This is the foundation for the "consumer-reports" MT systems-under-test
(Google Translate, DeepL, Microsoft Translator, LibreTranslate). It is shaped
to satisfy the ``mt_eval_harness.config.TranslationMethod`` protocol so the
harness can score these systems exactly like any LLM method.

WHAT THIS BASE PROVIDES (so subclasses stay tiny):
    - The async translate() loop: chunk entries into per-provider-limit
      batches, call the abstract ``_translate_texts()`` once per batch,
      capture per-entry latency + errors, and assemble protocol-shaped
      result dicts (id, predicted, latency_s, usage, error, tool_calls,
      tool_call_count, metadata).
    - Error isolation: a batch that raises (network error, bad status,
      length mismatch) marks each of its entries with ``error`` set and
      ``predicted=""`` — translate() never raises for an API failure, so a
      partial run still yields usable data (matching execute_run's "capture,
      never throw" contract).
    - A default ``method_card()`` built from class-level provenance fields.
    - Env-var key resolution helpers and the ``_resolve_lang_codes`` helper
      that maps human language NAMES → ISO codes via explicit code fields.

WHAT SUBCLASSES IMPLEMENT:
    - class attrs: ``name``, ``MAX_BATCH``, plus method-card provenance
      (``method_id``, ``description``, ``license``, ``commercial_ready``, …)
    - ``_resolve_credentials()`` → dict of resolved keys/urls (or raise
      MTConfigError if a required key is missing)
    - ``async _translate_texts(texts, src, tgt, creds)`` → list[str], one
      translation per input text, in order. Locale mapping happens here.

NO real network calls happen in tests — tests patch ``_translate_texts``
(or the aiohttp layer) so the suite is fully offline.
"""

from __future__ import annotations

import os
import time
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # pragma: no cover - typing only
    from mt_eval_harness.config import RunConfig


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class MTConfigError(RuntimeError):
    """Raised when an MT adapter cannot be configured to run.

    Two cases:
        - A required API key / endpoint is missing from the environment.
        - The run did not supply ISO language codes (source_code /
          target_code) and we only have human-readable language NAMES,
          which the MT REST APIs cannot consume.

    This is a configuration problem, not a per-entry translation failure —
    it is raised up front (before any HTTP) so the caller fails fast with an
    actionable message, rather than every entry silently erroring.
    """


# ---------------------------------------------------------------------------
# Env helpers — mirror the CLI's getEnvOrFileVar priority (env first).
# ---------------------------------------------------------------------------

def _env_first(*names: str) -> str | None:
    """Return the first non-empty environment variable among ``names``.

    Mirrors the CLI's resolution order: it checks each candidate env var in
    turn and returns the first that is set and non-empty. (The CLI also reads
    .env / .env.local files; the harness relies on the process environment,
    which is what runs/CI populate. Keeping it env-only also keeps tests
    hermetic.)
    """
    for name in names:
        val = os.environ.get(name)
        if val:
            return val
    return None


# ---------------------------------------------------------------------------
# Language code resolution
# ---------------------------------------------------------------------------

def _resolve_lang_codes(config: "RunConfig") -> tuple[str, str]:
    """Resolve (source, target) to canonical ISO 639-3 card codes via the SSOT.

    The run config carries either explicit codes (``config.source_code`` /
    ``config.target_code``, from corpus metadata — often ISO 639-3 like
    ``'eng'``/``'crk'``) or human NAMES (``config.source_lang`` /
    ``config.target_lang``, used for LLM prompts). Both are resolved through the
    language-card SSOT (``language_cards.resolve_code`` / ``resolve_name``) to
    the canonical ISO 639-3 code — the card key.

    There is deliberately NO ISO-639-3→639-1 mapping table here: the card is the
    single source of truth for every code form. Each MT adapter reads the form
    its provider needs (e.g. ``iso639_1`` for Google/DeepL/Microsoft/Libre)
    straight off the resolved card via ``HttpMTMethod._to_provider_base``.

    Returns:
        (source_code, target_code) — canonical ISO 639-3 codes.

    Raises:
        MTConfigError: if either side cannot be resolved to a card code. We
        never guess a code from free text — that would silently mistranslate.
    """
    from mt_eval_harness.language_cards import resolve_code, resolve_name

    def _canonical(code_attr: str, name_attr: str) -> str:
        raw = (getattr(config, code_attr, "") or "").strip()
        if raw:
            # resolve_code follows aliases/iso639_1/base-locale to the canonical
            # ISO 639-3 code (and returns the input unchanged if it's unknown —
            # caught downstream by _to_provider_base via get_card()).
            return resolve_code(raw)
        name = (getattr(config, name_attr, "") or "").strip()
        if name:
            return resolve_name(name) or ""
        return ""

    source_code = _canonical("source_code", "source_lang")
    target_code = _canonical("target_code", "target_lang")

    missing = []
    if not source_code:
        missing.append("source")
    if not target_code:
        missing.append("target")

    if missing:
        src = getattr(config, "source_code", "") or getattr(config, "source_lang", "") or "?"
        tgt = getattr(config, "target_code", "") or getattr(config, "target_lang", "") or "?"
        raise MTConfigError(
            "MT adapters need a resolvable language for each side, but could "
            f"not resolve: {', '.join(missing)} "
            f"(source={src!r}, target={tgt!r}). Set config.source_code / "
            "config.target_code (or *_lang names) to values the language-card "
            "SSOT recognizes."
        )

    return source_code, target_code


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------

class HttpMTMethod:
    """Shared base for REST-API machine-translation methods.

    Implements the TranslationMethod protocol's async ``translate()`` so each
    provider subclass only has to describe *its* endpoint, auth, request
    shape, response parsing, and locale mapping.

    Subclass contract (override these):
        name:               human-readable method name (e.g. "google-translate")
        MAX_BATCH:          max source segments per HTTP request
        _resolve_credentials() -> dict
        async _translate_texts(texts, src, tgt, creds) -> list[str]

    Optional method-card provenance class attrs (used by method_card()):
        method_id, method_class, author, description, homepage,
        license, commercial_ready, cost_note
    """

    # --- Identity ---------------------------------------------------------
    name: str = "http-mt"

    # --- Batching ---------------------------------------------------------
    # Max source segments per request. Subclasses override to each
    # provider's documented limit.
    MAX_BATCH: int = 64

    # --- Method-card provenance (subclasses override) ---------------------
    method_id: str = "http-mt"
    # method_class must be one of config.VALID_METHOD_CLASSES — a hosted REST MT
    # engine is an "api" method. (paradigm is the orthogonal algorithm axis;
    # base default is the safe DEFAULT_PARADIGM "unknown" — neural subclasses
    # set "neural-nmt", a rule-based one like Apertium sets "rule-based".)
    method_class: str = "api"
    paradigm: str = "unknown"
    author: str = "Champollion MT Eval"
    description: str = "Generic REST machine-translation adapter."
    homepage: str = ""
    license: str = "unknown"
    commercial_ready: bool = False
    cost_note: str = ""

    # --- Provider code scheme ---------------------------------------------
    # The card field this provider's API speaks. Google/DeepL/Microsoft/Libre
    # are ISO 639-1 ("en", "fr"); a 639-3-native provider would set "iso639_3".
    # The SSOT card carries every form — _to_provider_base() reads this field;
    # there is no ISO-639-3→639-1 mapping table.
    PROVIDER_CODE_FIELD: str = "iso639_1"

    def __init__(self, **options: Any) -> None:
        """Accept arbitrary keyword options (e.g. explicit api_key, endpoint).

        Options are stored on ``self.options`` and consulted by each
        subclass's ``_resolve_credentials()`` before falling back to env
        vars — mirroring the CLI's ``options.googleApiKey || env`` pattern.
        """
        self.options = options

    # --- Provenance -------------------------------------------------------

    def method_card(self) -> dict | None:
        """Return method metadata for provenance tracking.

        Embedded in the RunLog / published run card so a result can be
        attributed to a specific MT system. Subclasses normally just set the
        provenance class attrs and inherit this.
        """
        return {
            "name": self.name,
            "method_id": self.method_id,
            "class": self.method_class,
            "paradigm": self.paradigm,
            "author": self.author,
            "description": self.description,
            "homepage": self.homepage,
            # Consumer-reports MT systems are black boxes — no source text
            # leaves except the segment, no tools, no coaching data.
            "tools_used": [],
            # Provider-defined: cloud engines support hundreds of pairs, not
            # enumerated here. Empty list is the schema-valid form (the field
            # must be a list of "src>tgt" strings) and means "not pair-matched
            # by plugin_discovery" — correct, since these are registry methods,
            # not auto-discovered plugins.
            "supported_pairs": [],
            "license": self.license,
            "commercialReady": self.commercial_ready,
            "cost_note": self.cost_note,
        }

    # --- Credentials (subclass hook) -------------------------------------

    def _resolve_credentials(self) -> dict:
        """Resolve API keys / endpoints needed to translate.

        Subclasses return a dict (consumed by ``_translate_texts``). Raise
        MTConfigError if a required key is missing. The base implementation
        returns an empty dict (no credentials required).
        """
        return {}

    # --- Provider code resolution (card SSOT) ----------------------------

    def _to_provider_base(self, code: str) -> str:
        """Read the code form this provider needs straight off the card SSOT.

        ``code`` is a canonical ISO 639-3 card code (from _resolve_lang_codes).
        Returns ``card[self.PROVIDER_CODE_FIELD]`` (e.g. 'eng' → 'en'). The card
        is the single source of truth for every code form — no mapping table.
        Provider-API legacy quirks (e.g. Google he→iw) are layered on afterwards
        by the subclass's ``_map_locale`` inside ``_build_request``.

        FAIL-HONEST: raises MTConfigError when the language has no code in this
        provider's scheme (e.g. Plains Cree has no ISO 639-1 code), so we never
        POST a bogus/guessed code. The pair is simply out of scope for this
        provider — a different method (e.g. an LLM) must cover it.
        """
        from mt_eval_harness.language_cards import get_card

        card = get_card(code)
        if card is None:
            raise MTConfigError(
                f"No language card for {code!r}; cannot resolve the "
                f"{self.PROVIDER_CODE_FIELD} code that {self.name} requires."
            )
        provider_code = card.get(self.PROVIDER_CODE_FIELD)
        if not provider_code:
            raise MTConfigError(
                f"{card.get('name', code)} ({code}) has no "
                f"{self.PROVIDER_CODE_FIELD} code, so {self.name} cannot "
                f"translate it — this pair is out of scope for this provider. "
                f"Use a method that supports {code} (e.g. an LLM)."
            )
        return provider_code

    # --- Translation backend (subclass hook) -----------------------------

    async def _translate_texts(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        creds: dict,
    ) -> list[str]:
        """Translate a batch of source strings → list of translations.

        Must return exactly ``len(texts)`` strings, in the same order.
        Locale mapping (e.g. Google he→iw) happens inside the subclass, on
        the ISO codes passed in as ``src`` / ``tgt``.

        Raise on any failure (bad status, network error, length mismatch);
        the base ``translate()`` catches it and marks the batch's entries as
        errored.
        """
        raise NotImplementedError(
            f"{type(self).__name__} must implement _translate_texts()"
        )

    # --- Result shaping ---------------------------------------------------

    @staticmethod
    def _result(
        entry_id: Any,
        predicted: str,
        latency_s: float,
        error: str | None,
        usage: dict | None = None,
        metadata: dict | None = None,
    ) -> dict:
        """Assemble one protocol-shaped result dict.

        Matches the per-entry shape produced by the built-in strategies
        (see strategies/single.py): id, predicted, latency_s, usage,
        tool_calls, tool_call_count, error, metadata.
        """
        return {
            "id": entry_id,
            "predicted": predicted,
            "latency_s": float(latency_s),
            "usage": usage if usage is not None else {},
            "error": error,
            "tool_calls": [],
            "tool_call_count": 0,
            "metadata": metadata if metadata is not None else {},
        }

    # --- Main async loop --------------------------------------------------

    async def translate(
        self,
        entries: list[dict],
        config: "RunConfig",
    ) -> list[dict]:
        """Translate a batch of entries via the provider REST API.

        Returns one result dict per input entry, in input order. A failed
        batch (network error, bad status, length mismatch) does NOT raise:
        each entry in that batch gets ``error`` set and ``predicted=""``.

        A configuration problem (missing key, missing language codes) DOES
        raise MTConfigError — that is an up-front, run-wide failure, not a
        per-entry one, and should stop the run before any HTTP.
        """
        # Resolve up-front config — these raise (run cannot proceed at all).
        # 1. Canonical ISO 639-3 card codes via the SSOT.
        src_code, tgt_code = _resolve_lang_codes(config)
        # 2. The form THIS provider's API speaks, read off the card (fail-honest:
        #    a language with no code in the provider's scheme raises here, before
        #    any HTTP — we never POST a guessed code).
        src = self._to_provider_base(src_code)
        tgt = self._to_provider_base(tgt_code)
        creds = self._resolve_credentials()

        source_field = getattr(config, "source_field", "source") or "source"

        results: list[dict] = []

        # Process in provider-sized chunks. Each chunk is one HTTP request.
        for start in range(0, len(entries), self.MAX_BATCH):
            chunk = entries[start:start + self.MAX_BATCH]
            texts = [str(e.get(source_field, "")) for e in chunk]

            t0 = time.monotonic()
            try:
                translations = await self._translate_texts(
                    texts, src, tgt, creds,
                )
                elapsed = time.monotonic() - t0

                if len(translations) != len(chunk):
                    raise ValueError(
                        f"{self.name}: response length mismatch "
                        f"(expected {len(chunk)}, got {len(translations)})"
                    )

                # Amortize the batch latency across its entries so per-entry
                # latency_s sums back to wall-clock (matches batch strategy).
                per_latency = elapsed / len(chunk) if chunk else 0.0
                for entry, translated in zip(chunk, translations):
                    results.append(
                        self._result(
                            entry_id=entry.get("id"),
                            predicted=translated if translated is not None else "",
                            latency_s=per_latency,
                            error=None,
                        )
                    )
            except Exception as exc:  # noqa: BLE001 - capture, never throw
                elapsed = time.monotonic() - t0
                per_latency = elapsed / len(chunk) if chunk else 0.0
                err = f"{type(exc).__name__}: {exc}"
                for entry in chunk:
                    results.append(
                        self._result(
                            entry_id=entry.get("id"),
                            predicted="",
                            latency_s=per_latency,
                            error=err,
                        )
                    )

        return results
