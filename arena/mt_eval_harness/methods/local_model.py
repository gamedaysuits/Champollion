"""
LocalModelMethod — self-hosted neural MT via Hugging Face transformers OR CTranslate2.

Runs an open translation model on local hardware (no API, no key). This is
where low-resource coverage lives — the models cloud engines don't serve:
NLLB-200, OPUS-MT (Helsinki-NLP), MADLAD-400.

TWO "usual ways" to load a model, auto-selected — no config to learn:
    - transformers (default): point ``--model`` / ``LOCAL_MODEL_ID`` at a
      Hugging Face hub id (``facebook/nllb-200-distilled-600M``) or a local
      ``from_pretrained()`` directory. Needs the ``[local-models]`` extra
      (torch + transformers).
    - CTranslate2: point ``--model`` at a CT2-converted model directory (one
      that contains a ``model.bin``). Fast CPU/GPU inference. Needs the
      ``[ctranslate2]`` extra. The tokenizer is read from the CT2 directory if
      the conversion copied it in, else from ``--model``-style
      ``LOCAL_TOKENIZER_ID`` / ``local_tokenizer_id``.

The backend is DETECTED from the model path (a CT2 dir has ``model.bin``) and
can be forced with ``LOCAL_MODEL_BACKEND`` / ``local_model_backend``
(``auto`` | ``transformers`` | ``ctranslate2``).

Family is auto-detected from the model id (``LOCAL_MODEL_ID`` / ``--model`` /
``local_model_id``):
    - "opus"   (Helsinki-NLP/opus-mt-<src>-<tgt>): Marian, pair-specific — the
      model IS the pair, so language codes are not needed at call time.
    - "nllb"   (facebook/nllb-200-*): multilingual; tokenizer.src_lang + a
      forced BOS for the target, using FLORES-200 codes (eng_Latn, spa_Latn…).
    - "madlad" (google/madlad400-*): T5-style; prepend "<2{tgt}>" to the input.

LANGUAGE CODES ARE NOT HARDCODED HERE. Per the repo's data-over-code (SSOT)
rule, the code each family needs is read straight off the language-card SSOT —
exactly like every HTTP adapter's ``_to_provider_base``:
    - nllb   → ``methodSupport.nllb.code`` (the FLORES-200 code the card
      already carries). A language NLLB does not serve has no such code on its
      card (e.g. Plains Cree, ``crk``) → FAIL-HONEST out-of-scope, never a
      guessed code.
    - madlad → the card's ``iso639_1`` (MADLAD's ``<2xx>`` target token); a
      language without one is out of scope for this adapter.
    - opus   → the pair is baked into the model; no per-call code needed.

Heavy deps (torch/transformers, ctranslate2) are OPTIONAL and lazy-imported so
the core wheel stays slim; a missing dep fails LOUD with an actionable install
message rather than silently skipping. Harness-only for now
(``runtimes: ["harness"]``); the CLI reaches it later via the external
subprocess bridge so Node never needs torch.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _env_first,
)

DEFAULT_LOCAL_MODEL = "Helsinki-NLP/opus-mt-en-es"  # small; for the smoke default

_VALID_BACKENDS = ("auto", "transformers", "ctranslate2")


class LocalModelMethod(HttpMTMethod):
    """Self-hosted transformers / CTranslate2 translation model (NLLB / OPUS-MT / MADLAD)."""

    name = "local-model"
    MAX_BATCH = 8  # modest — local inference, keep memory bounded

    method_id = "local-model"
    method_class = "pipeline"   # local model-execution pipeline, not a remote api
    paradigm = "neural-nmt"
    author = "Self-hosted (Hugging Face transformers / CTranslate2)"
    description = (
        "Self-hosted open neural MT (NLLB-200 / OPUS-MT / MADLAD-400) run locally "
        "via transformers or CTranslate2 — no API, no key."
    )
    homepage = "https://huggingface.co/models?pipeline_tag=translation"
    license = "Per-model (open weights; see the chosen model's card)"
    commercial_ready = False  # depends on the model's license — review per model
    cost_note = "Free to run; local compute cost only (UNKNOWN to the harness, never $0)"

    def __init__(self, **options) -> None:
        super().__init__(**options)
        self._loaded = None       # transformers cache: (model_id, tokenizer, model)
        self._ct2 = None          # ct2 cache: (model_dir, translator, tokenizer)
        self._model_cache = None  # resolved (model_id, family, backend)

    # --- Model / family / backend resolution (PURE — no heavy imports) ----

    def _resolve_model(self) -> tuple[str, str, str]:
        """Return ``(model_id, family, backend)`` from options/env/default.

        Pure string/path logic — safe to call before any torch/ct2 import.
        ``_to_provider_base`` (called before ``_resolve_credentials`` in the
        base ``translate()``) and ``_resolve_credentials`` both rely on it, so
        the result is cached to keep them consistent within a run.
        """
        if self._model_cache:
            return self._model_cache
        model_id = (
            self.options.get("local_model_id")
            or self.options.get("model")            # `--model <hf-id | ct2-dir>`
            or _env_first("LOCAL_MODEL_ID")
            or DEFAULT_LOCAL_MODEL
        )
        family = self._family(model_id)
        forced = self.options.get("local_model_backend") or _env_first("LOCAL_MODEL_BACKEND")
        backend = self._select_backend(model_id, forced)
        self._model_cache = (model_id, family, backend)
        return self._model_cache

    @staticmethod
    def _family(model_id: str) -> str:
        m = model_id.lower()
        if "nllb" in m:
            return "nllb"
        if "madlad" in m:
            return "madlad"
        return "opus"  # Marian / generic seq2seq pair model (default)

    @staticmethod
    def _is_ct2_dir(model_id: str) -> bool:
        """A CTranslate2 model directory holds a binary ``model.bin`` + config.

        This is the file the converter always writes and the transformers /
        HF-hub layout never has, so it cleanly distinguishes "a converted CT2
        bundle" from "an HF id or a from_pretrained() dir".
        """
        try:
            p = Path(model_id)
            return p.is_dir() and (p / "model.bin").is_file()
        except OSError:
            return False

    @classmethod
    def _select_backend(cls, model_id: str, forced: str | None = None) -> str:
        """Resolve the inference backend: ``transformers`` or ``ctranslate2``.

        An explicit ``forced`` value (``local_model_backend`` / env) wins;
        ``auto`` (the default) picks ``ctranslate2`` iff the model path looks
        like a CT2 conversion, else ``transformers``.
        """
        f = (forced or "auto").strip().lower()
        if f not in _VALID_BACKENDS:
            raise MTConfigError(
                f"Unknown local_model_backend {forced!r}; use one of "
                f"{', '.join(_VALID_BACKENDS)}."
            )
        if f == "transformers":
            return "transformers"
        if f == "ctranslate2":
            return "ctranslate2"
        # auto
        return "ctranslate2" if cls._is_ct2_dir(model_id) else "transformers"

    # --- Language-code resolution off the card SSOT (no hardcoded table) ---

    def _to_provider_base(self, code: str) -> str:
        """Resolve a canonical ISO 639-3 card code to the form THIS family needs.

        Reads the code straight off the language-card SSOT (no mapping table),
        mirroring the HTTP adapters. FAIL-HONEST: a language the chosen model
        does not serve raises here (before any inference) rather than emitting a
        guessed code.
        """
        _model_id, family, _backend = self._resolve_model()

        # OPUS-MT is pair-specific: the language pair is the model. No per-call
        # code is needed, so pass the canonical code through untouched.
        if family == "opus":
            return code

        from mt_eval_harness.language_cards import get_card

        card = get_card(code)
        if card is None:
            raise MTConfigError(
                f"No language card for {code!r}; cannot resolve the local "
                f"{family} model's language code."
            )

        if family == "nllb":
            nllb = (card.get("methodSupport") or {}).get("nllb") or {}
            flores = nllb.get("code")
            if not flores:
                raise MTConfigError(
                    f"{card.get('name', code)} ({code}) is not in NLLB-200 "
                    f"(no methodSupport.nllb.code on its card), so a local NLLB "
                    f"model cannot translate it — out of scope for this model. "
                    f"Use an OPUS-MT pair model, a MADLAD model, or an LLM."
                )
            return flores

        # madlad — the <2xx> target token. MADLAD's scheme is closest to the
        # card's iso639_1; a language without one is out of scope for this
        # adapter (a fuller MADLAD code map is future work).
        madlad_code = card.get("iso639_1")
        if not madlad_code:
            raise MTConfigError(
                f"{card.get('name', code)} ({code}) has no iso639_1 code for the "
                f"MADLAD <2xx> target token, so this local MADLAD adapter cannot "
                f"translate it — out of scope. Use an OPUS-MT pair model or an LLM."
            )
        return madlad_code

    # --- Credentials (here: which model + backend, and its deps present) --

    def _resolve_credentials(self) -> dict:
        model_id, family, backend = self._resolve_model()
        if backend == "ctranslate2":
            try:
                import ctranslate2  # noqa: F401, PLC0415 - presence check (lazy)
            except ImportError as exc:  # pragma: no cover - exercised via message
                raise MTConfigError(
                    "The CTranslate2 backend needs `ctranslate2` (plus "
                    "transformers for the tokenizer). Install the optional "
                    "extra: pip install 'mt-eval[ctranslate2]'."
                ) from exc
            try:
                import transformers  # noqa: F401, PLC0415 - tokenizer
            except ImportError as exc:  # pragma: no cover - exercised via message
                raise MTConfigError(
                    "The CTranslate2 backend needs `transformers` for the "
                    "tokenizer. Install: pip install 'mt-eval[ctranslate2]'."
                ) from exc
        else:
            try:
                import transformers  # noqa: F401, PLC0415 - presence check (lazy)
                import torch  # noqa: F401, PLC0415
            except ImportError as exc:  # pragma: no cover - exercised via message
                raise MTConfigError(
                    "Local models need torch + transformers. Install the optional "
                    "extra: pip install 'mt-eval[local-models]'."
                ) from exc
        return {"model_id": model_id, "family": family, "backend": backend}

    # --- transformers backend ---------------------------------------------

    def _load(self, model_id: str):
        """Load + cache a transformers tokenizer/model pair (from_pretrained)."""
        if self._loaded and self._loaded[0] == model_id:
            return self._loaded[1], self._loaded[2]
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
        model.eval()
        self._loaded = (model_id, tokenizer, model)
        return tokenizer, model

    def _infer_transformers(self, texts: list[str], src: str, tgt: str, creds: dict) -> list[str]:
        import torch
        tokenizer, model = self._load(creds["model_id"])
        family = creds["family"]

        inputs_text = list(texts)
        gen_kwargs: dict = {"max_new_tokens": 512}

        if family == "nllb":
            tokenizer.src_lang = src  # already a FLORES-200 code (card SSOT)
            # transformers 4.x: convert_tokens_to_ids; works across recent versions.
            gen_kwargs["forced_bos_token_id"] = tokenizer.convert_tokens_to_ids(tgt)
        elif family == "madlad":
            inputs_text = [f"<2{tgt}> {t}" for t in texts]
        # opus/Marian: pair-specific model — no code setup needed.

        enc = tokenizer(inputs_text, return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            out = model.generate(**enc, **gen_kwargs)
        return [tokenizer.decode(o, skip_special_tokens=True) for o in out]

    # --- CTranslate2 backend ----------------------------------------------

    def _ct2_tokenizer(self, model_dir: str):
        """Resolve the tokenizer for a CT2 model: the converted dir if it copied
        the tokenizer in, else an explicit ``local_tokenizer_id`` / env / the
        source HF id passed via ``--model``-style options."""
        from transformers import AutoTokenizer
        tok_src = (
            self.options.get("local_tokenizer_id")
            or _env_first("LOCAL_TOKENIZER_ID")
            or model_dir  # `ct2-transformers-converter --copy_files tokenizer.*`
        )
        try:
            return AutoTokenizer.from_pretrained(tok_src)
        except Exception as exc:  # noqa: BLE001 - re-raise as actionable config error
            raise MTConfigError(
                f"The CTranslate2 backend could not load a tokenizer from "
                f"{tok_src!r}. Re-convert copying the tokenizer in "
                f"(`ct2-transformers-converter --copy_files tokenizer.json "
                f"tokenizer_config.json ...`), or name the source model via "
                f"--model / LOCAL_TOKENIZER_ID."
            ) from exc

    def _load_ct2(self, model_dir: str):
        """Load + cache a CTranslate2 translator + its tokenizer."""
        if self._ct2 and self._ct2[0] == model_dir:
            return self._ct2[1], self._ct2[2]
        import ctranslate2
        device = (self.options.get("device") or _env_first("LOCAL_MODEL_DEVICE") or "cpu").strip()
        translator = ctranslate2.Translator(model_dir, device=device)
        tokenizer = self._ct2_tokenizer(model_dir)
        self._ct2 = (model_dir, translator, tokenizer)
        return translator, tokenizer

    def _infer_ct2(self, texts: list[str], src: str, tgt: str, creds: dict) -> list[str]:
        translator, tokenizer = self._load_ct2(creds["model_id"])
        family = creds["family"]

        prepared = list(texts)
        if family == "madlad":
            prepared = [f"<2{tgt}> {t}" for t in texts]
        if family == "nllb":
            tokenizer.src_lang = src  # already a FLORES-200 code (card SSOT)

        source_tokens = [
            tokenizer.convert_ids_to_tokens(tokenizer.encode(t)) for t in prepared
        ]
        batch_kwargs: dict = {"max_decoding_length": 512}
        if family == "nllb":
            # NLLB decodes with the target-language token as a forced prefix.
            batch_kwargs["target_prefix"] = [[tgt]] * len(source_tokens)

        results = translator.translate_batch(source_tokens, **batch_kwargs)

        outs: list[str] = []
        for res in results:
            hyp = list(res.hypotheses[0])
            if family == "nllb" and hyp and hyp[0] == tgt:
                hyp = hyp[1:]  # drop the forced target-language prefix token
            ids = tokenizer.convert_tokens_to_ids(hyp)
            outs.append(tokenizer.decode(ids, skip_special_tokens=True))
        return outs

    # --- Synchronous inference (dispatch on backend) ----------------------

    def _infer(self, texts: list[str], src: str, tgt: str, creds: dict) -> list[str]:
        if creds["backend"] == "ctranslate2":
            return self._infer_ct2(texts, src, tgt, creds)
        return self._infer_transformers(texts, src, tgt, creds)

    # --- Async backend ----------------------------------------------------

    async def _translate_texts(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        creds: dict,
    ) -> list[str]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._infer, texts, src, tgt, creds)
