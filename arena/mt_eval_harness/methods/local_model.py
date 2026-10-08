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

THERE IS NO DEFAULT MODEL. Until Round 10 a run with no model id fell back to
``Helsinki-NLP/opus-mt-en-es``, and the runner never handed ``-m`` to this
adapter, so ``mt-eval run --method local-model -m ./my-model`` downloaded
that English->Spanish model, translated an eng->sme corpus into Spanish, and
recorded neither model (synthetic researcher, Round 10). Now a run without a
model refuses and names the flag, the model that actually loads is recorded
(``model_identity()``: the hub id and its revision, or the directory with a
sha256 over its files), and an OPUS-MT pair model whose id names another pair
than the run's is refused unless the run says it means it.

Decode length: the shared rule in ``mt_eval_harness.decode_length`` (the
model's declared length, else a bound relative to the source) — the same
rule the contest node's declarative engine uses.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
from pathlib import Path

from mt_eval_harness import decode_length
from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _env_first,
)

_VALID_BACKENDS = ("auto", "transformers", "ctranslate2")

#: The exact way to name the model — said by every refusal that lacks one.
MODEL_FLAG_HINT = (
    "pass it with -m/--model: a Hugging Face id (-m "
    "facebook/nllb-200-distilled-600M) or a model directory (-m ./my-model), "
    "or set LOCAL_MODEL_ID")

#: The run flag that runs an OPUS-MT pair model on another pair deliberately
#: (e.g. a related-language baseline). Without it such a run is refused.
PAIR_MISMATCH_FLAG = "--allow-model-pair-mismatch"

# Helsinki-NLP's pair-model naming: opus-mt-<src>-<tgt>, with optional
# "tc-big-" / "tc-base-" style infixes. Codes are ISO 639-1/3 or group names.
_OPUS_ID_RE = re.compile(
    r"opus-mt-(?:tc-[a-z0-9]+-)?([A-Za-z_]+)-([A-Za-z_]+)$")


def looks_like_path(model: str) -> bool:
    """True when ``model`` can only be a local path (never a hub id):
    it starts with ``.``, ``/`` or ``~``, or has more than one ``/``. A hub
    id is ``name`` or ``org/name``; ``org/name`` that is ALSO a local
    directory is the directory."""
    m = str(model or "").strip()
    return (m.startswith((".", "/", "~")) or m.count("/") > 1
            or "\\" in m)


def directory_manifest(model_dir: str | Path) -> tuple[str, list[dict]]:
    """sha256 over a sha256sum-style manifest of every file under
    ``model_dir`` (dot-directories, dot-files and ``__pycache__`` excluded),
    one ``<sha256>  <relative path>`` line each, sorted by path — anyone can
    re-derive it with ``sha256sum``. Returns ``(sha256, files)``, files being
    ``[{path, sha256, bytes}]``: the per-file hashes let `contest submit-model`
    check that the weights it packs are the weights a receipt was earned with.
    """
    root = Path(model_dir).expanduser().resolve()
    files: list[dict] = []
    for p in sorted(root.rglob("*"), key=lambda q: q.relative_to(root).as_posix()):
        rel = p.relative_to(root)
        if any(part.startswith(".") or part == "__pycache__"
               for part in rel.parts) or not p.is_file():
            continue
        h = hashlib.sha256()
        with open(p, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        files.append({"path": rel.as_posix(), "sha256": h.hexdigest(),
                      "bytes": p.stat().st_size})
    lines = "".join(f"{f['sha256']}  {f['path']}\n" for f in files)
    return hashlib.sha256(lines.encode("utf-8")).hexdigest(), files


def opus_pair(model: str) -> tuple[str, str] | None:
    """``(src, tgt)`` named by an OPUS-MT pair-model id
    (``Helsinki-NLP/opus-mt-en-es`` → ``("en", "es")``), else None."""
    name = str(model or "").rstrip("/").split("/")[-1]
    m = _OPUS_ID_RE.search(name)
    return (m.group(1), m.group(2)) if m else None


def _language_of(code: str) -> tuple[str | None, dict | None]:
    """The canonical ISO 639-3 code a code names and its card — or
    ``(None, None)`` when the code is not ONE language (a group such as
    ``gem`` or ``ROMANCE``, ``mul``, or unknown): such a model's pair cannot
    be checked against a run's."""
    from mt_eval_harness.language_cards import get_card, resolve_code
    try:
        resolved = resolve_code(code).split("-")[0]
        card = get_card(resolved)
    except Exception:  # noqa: BLE001 — no cards here: the pair is not checked
        return None, None
    if not card or card.get("isoScope") not in ("Individual", "Macrolanguage"):
        return None, None
    return resolved, card


def _same_language(a: str, card_a: dict, b: str, card_b: dict) -> bool:
    """Same code, or one is the other's macrolanguage, or both belong to
    one macrolanguage (opus-mt-en-zh on a cmn corpus is not a mismatch)."""
    if a == b:
        return True
    ma, mb = card_a.get("macrolanguage"), card_b.get("macrolanguage")
    return ma == b or mb == a or (ma is not None and ma == mb)


def pair_mismatch(model: str, source_code: str, target_code: str) -> dict | None:
    """The visible pair mismatch between an OPUS-MT pair model's id and the
    run's pair, or None (no mismatch, or nothing checkable). Returns
    ``{model_pair, run_pair, sides}`` naming the side(s) that differ."""
    pair = opus_pair(model)
    if not pair or not (source_code and target_code):
        return None
    sides = []
    for side, model_code, run_code in (("source", pair[0], source_code),
                                       ("target", pair[1], target_code)):
        m_code, m_card = _language_of(model_code)
        r_code, r_card = _language_of(run_code)
        if m_code and r_code and not _same_language(m_code, m_card,
                                                    r_code, r_card):
            sides.append({"side": side, "model": model_code,
                          "model_language": m_card.get("name") or m_code,
                          "run": run_code,
                          "run_language": r_card.get("name") or r_code})
    if not sides:
        return None
    return {"model_pair": f"{pair[0]}>{pair[1]}",
            "run_pair": f"{source_code}>{target_code}", "sides": sides}


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
    # The model runs in THIS process (transformers / CTranslate2): no request
    # carries a sentence anywhere. Downloading the weights from the hub moves
    # model files, never corpus text. So a local-only corpus needs no
    # --attest-local-transport here (it used to — the harness's own adapter
    # was judged like a third-party plugin; synthetic researcher, Round 5).
    in_process_transport = True
    commercial_ready = False  # depends on the model's license — review per model
    cost_note = "Free to run; local compute cost only (UNKNOWN to the harness, never $0)"

    # This engine runs the model it is GIVEN (-m): the runner hands it the
    # model, and a run without one is refused before anything loads.
    takes_model = True

    def __init__(self, **options) -> None:
        super().__init__(**options)
        self._loaded = None       # transformers cache: (model_id, tokenizer, model)
        self._ct2 = None          # ct2 cache: (model_dir, translator, tokenizer)
        self._model_cache = None  # resolved (model_id, family, backend)
        # What actually loaded (model_identity()); the runner may hand in the
        # identity it computed up front so a large directory is hashed once.
        self._identity = options.get("model_identity") or None
        self._decode_record = None  # decode_length.describe() of the last call

    # --- Model / family / backend resolution (PURE — no heavy imports) ----

    @classmethod
    def model_source(cls, options: dict) -> tuple[str, str]:
        """``(model, where it came from)``: the ``local_model_id`` option,
        then ``model`` (``-m/--model``, handed over by the runner), then the
        LOCAL_MODEL_ID environment variable. No default: refuses with the
        flag to pass."""
        for key, label in (("local_model_id", "the local_model_id option"),
                           ("model", "-m/--model")):
            value = str((options or {}).get(key) or "").strip()
            if value:
                return value, label
        env = (_env_first("LOCAL_MODEL_ID") or "").strip()
        if env:
            return env, "the LOCAL_MODEL_ID environment variable"
        raise MTConfigError(
            f"--method local-model needs the model to run, and none was "
            f"given — {MODEL_FLAG_HINT}. There is no default model: it used "
            f"to be Helsinki-NLP/opus-mt-en-es, run in place of the model "
            f"the user meant.")

    def _resolve_model(self) -> tuple[str, str, str]:
        """Return ``(model_id, family, backend)`` from options/env.

        Pure string/path logic — safe to call before any torch/ct2 import.
        ``_to_provider_base`` (called before ``_resolve_credentials`` in the
        base ``translate()``) and ``_resolve_credentials`` both rely on it, so
        the result is cached to keep them consistent within a run.
        """
        if self._model_cache:
            return self._model_cache
        model_id, _from = self.model_source(self.options)
        if self._identity and self._identity.get("path"):
            model_id = self._identity["path"]   # the directory, resolved
        elif looks_like_path(model_id):
            path = Path(model_id).expanduser()
            if not path.is_dir():
                raise MTConfigError(
                    f"-m {model_id!r} names a local path, and no directory "
                    f"is there — {MODEL_FLAG_HINT}.")
            model_id = str(path.resolve())
        elif Path(model_id).expanduser().is_dir():
            model_id = str(Path(model_id).expanduser().resolve())
        family = self._family(model_id)
        forced = self.options.get("local_model_backend") or _env_first("LOCAL_MODEL_BACKEND")
        backend = self._select_backend(model_id, forced)
        self._model_cache = (model_id, family, backend)
        return self._model_cache

    @classmethod
    def resolve_identity(cls, options: dict, *, source_code: str = "",
                         target_code: str = "",
                         allow_pair_mismatch: bool = False) -> dict:
        """What this run will load, decided BEFORE anything loads — the
        runner calls it for the header, the dry run and the run log.

        Returns ``{given, from, kind, id, path?, sha256?, files?, family,
        backend, revision, pair_mismatch?}``: a directory carries the
        sha256 of its files (:func:`directory_manifest`); a hub id carries
        the revision once the weights load (None until then). Refuses (no
        model, a path that is not a directory, an OPUS-MT pair model whose
        id names another pair — unless ``allow_pair_mismatch``)."""
        given, origin = cls.model_source(options)
        method = cls(**{**(options or {}), "model": given})
        model_id, family, backend = method._resolve_model()
        identity: dict = {"given": given, "from": origin,
                          "family": family, "backend": backend,
                          "revision": None}
        if Path(model_id).is_dir():
            sha, files = directory_manifest(model_id)
            identity.update(kind="directory", id=Path(model_id).name,
                            path=model_id, sha256=sha, files=files)
        else:
            identity.update(kind="hub", id=model_id, sha256=None)
        mismatch = pair_mismatch(identity["id"] if identity["kind"] == "hub"
                                 else given, source_code, target_code)
        if mismatch:
            if not allow_pair_mismatch:
                differs = "; ".join(
                    f"{s['side']}: the model says {s['model']} "
                    f"({s['model_language']}), the run is {s['run']} "
                    f"({s['run_language']})" for s in mismatch["sides"])
                raise MTConfigError(
                    f"-m {given!r} is an OPUS-MT pair model for "
                    f"{mismatch['model_pair']}, and this run is "
                    f"{mismatch['run_pair']} ({differs}). A pair model "
                    f"translates only its own pair: its outputs here would "
                    f"be in another language. Name a model for "
                    f"{mismatch['run_pair']}; or, to measure this model on "
                    f"this pair on purpose (a related-language baseline), "
                    f"add {PAIR_MISMATCH_FLAG} — the run records it.")
            identity["pair_mismatch"] = {**mismatch, "acknowledged": True}
        return identity

    def model_identity(self) -> dict:
        """The model this method loads (or loaded), as recorded on the run:
        :meth:`resolve_identity` plus, after loading, the hub revision and
        the decode length that applied."""
        if self._identity is None:
            self._identity = self.resolve_identity(self.options)
        identity = dict(self._identity)
        if self._decode_record is not None:
            identity["decode"] = dict(self._decode_record)
        return identity

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
                    "extra: python3 -m pip install 'mt-eval-harness[ctranslate2]'."
                ) from exc
            try:
                import transformers  # noqa: F401, PLC0415 - tokenizer
            except ImportError as exc:  # pragma: no cover - exercised via message
                raise MTConfigError(
                    "The CTranslate2 backend needs `transformers` for the "
                    "tokenizer. Install: python3 -m pip install 'mt-eval-harness[ctranslate2]'."
                ) from exc
        else:
            try:
                import transformers  # noqa: F401, PLC0415 - presence check (lazy)
                import torch  # noqa: F401, PLC0415
            except ImportError as exc:  # pragma: no cover - exercised via message
                raise MTConfigError(
                    "Local models need torch + transformers. Install the optional "
                    "extra: python3 -m pip install 'mt-eval-harness[local-models]'."
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
        self._record_revision(model)
        return tokenizer, model

    def _record_revision(self, model) -> None:
        """A hub model's commit, read off what loaded — the hub id alone
        names a moving target."""
        if self._identity is None:
            self._identity = self.resolve_identity(self.options)
        if self._identity.get("kind") == "hub":
            rev = getattr(getattr(model, "config", None), "_commit_hash", None)
            if isinstance(rev, str) and rev:
                self._identity = {**self._identity, "revision": rev}

    def _declared_length(self, model) -> dict | None:
        """The length the loaded model declares (its generation config), or
        None. transformers' class default (max_length 20) is not a
        declaration: it is exactly what the shared rule replaces."""
        gen = getattr(model, "generation_config", None)
        if gen is None:
            return None
        try:
            declared = gen.to_diff_dict()
        except Exception:  # noqa: BLE001 — unreadable config declares nothing
            return None
        return decode_length.declared_length(
            ("the model's generation_config", declared))

    def _infer_transformers(self, texts: list[str], src: str, tgt: str, creds: dict) -> list[str]:
        import torch
        tokenizer, model = self._load(creds["model_id"])
        family = creds["family"]

        inputs_text = list(texts)
        # The shared decode rule (decode_length): the model's declared length,
        # else max(64, 4 x the longest source in this batch), capped at the
        # decoder's positions — the same rule the contest node's engine uses.
        positions = getattr(getattr(model, "config", None),
                            "max_position_embeddings", None)
        positions = positions if isinstance(positions, int) and positions > 1 else None
        declared = self._declared_length(model)
        longest = max((len(tokenizer(t)["input_ids"]) for t in texts), default=0)
        gen_kwargs: dict = decode_length.generation_kwargs(
            declared, longest, positions=positions)
        self._decode_record = decode_length.describe(declared,
                                                     positions=positions)

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
        # The shared decode rule (decode_length), read off the CT2 directory's
        # generation_config.json when the conversion copied it in.
        declared = decode_length.declared_length(
            ("generation_config.json",
             decode_length.read_generation_config(creds["model_id"])))
        length = decode_length.generation_kwargs(
            declared, max((len(t) for t in source_tokens), default=0))
        self._decode_record = decode_length.describe(declared)
        batch_kwargs: dict = {"max_decoding_length": next(iter(length.values()))}
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
