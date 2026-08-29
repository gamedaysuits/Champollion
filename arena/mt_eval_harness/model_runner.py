"""model_runner — the DECLARATIVE-MODEL lane (Lane A), the organizer side.

The insight this lane implements: a standard neural-MT submission is DATA, not
code — model weights (tensors) + a tokenizer + a config. If we constrain the
submission to declarative, code-free components and run them in the ORGANIZER'S
OWN trusted inference engine, then **no participant code executes at all**. The
question stops being "is this untrusted code malicious?" (undecidable — the
whole reason sandbox_runner.py needs --network=none) and becomes "is this the
data format I accept?" — a DECIDABLE static check. There is nothing to jail, so
there is no container, no --network=none dependency, and no escape surface.

This is strictly stronger than containment for the case it covers, and it is
the DEFAULT lane. The sandbox lane (sandbox_runner.py, Lane B) remains the
honestly-weaker fallback for methods that genuinely ARE code — pipelines,
LLM-coached hybrids, custom plugins — which cannot be run declaratively.

WHAT THIS LANE ACCEPTS (validated, code-free):
  * weights: **.safetensors only** (pure tensor data). PyTorch .bin/.pt/.pth/
    .ckpt/.pkl are PICKLE — arbitrary code execution on torch.load — and are
    REFUSED. The safetensors header is parsed here directly (no torch needed),
    so "is this really safetensors, not a pickle in disguise?" is checkable.
  * tokenizer: a declarative HF tokenizer.json / sentencepiece .model / vocab
    files. NO custom tokenizer class.
  * config: config.json naming an ``architectures`` entry, with NO ``auto_map``
    and NO ``trust_remote_code: true`` (those are how HF configs smuggle custom
    code back in). The architecture is PERMISSIVE by default — see the
    architecture-policy note below: with ``trust_remote_code=False`` the
    security boundary is "native library code vs. participant code", NOT which
    native architecture, so any architecture the host's engine implements
    natively is safe. A "careful" host can pin an allowlist; that is an
    operational/curation choice, not the thing that keeps the corpus safe.
  * NOTHING ELSE that is code: no .py/.sh/.js/…, no shebang files, no pickle/
    zip/ELF/Mach-O magic. The bundle is data or it is refused.

WHAT RUNS: the organizer's trusted engine (transformers, trust_remote_code=
False, local_files_only, HF offline) loads the whitelisted architecture from
the safetensors weights and the declarative tokenizer, and translates. The real
engine fails LOUD if transformers/torch is absent (never a silent skip); it is
INJECTABLE (a translator callable) so the contract is testable without torch —
the same pattern sandbox_runner uses for the container runtime.

Honest residual: trust reduces to the inference library (transformers /
safetensors / sentencepiece parsers) instead of participant code. The weights
are numerically the participant's, which can only affect TRANSLATION QUALITY,
never exfiltrate (they are inert tensors fed to trusted code with no network).
"""

from __future__ import annotations

import json
import re
import struct
from pathlib import Path
from typing import Callable, Optional

from mt_eval_harness.sandbox_runner import SandboxError, write_source_file

# ---------------------------------------------------------------------------
# Architecture policy — PERMISSIVE by default (founder call 2026-07-19).
#
# The list below is NOT a security gate. With ``trust_remote_code=False`` the
# security boundary is "native library code vs. participant code" — an
# architecture either resolves to a class compiled into the host's transformers
# (trusted library code) or it does not resolve at all (a CLEAN load failure, no
# code executed). Which native architecture never changes the corpus-sovereignty
# guarantee, which holds for ANY architecture under this lane (no network, no
# participant code). So the default is: accept any architecture and let it
# succeed or fail at load time.
#
# KNOWN_SEQ2SEQ_ARCHITECTURES is a CURATED REFERENCE of common seq2seq MT
# architectures — used (a) to emit a helpful WARN under the permissive default
# when a submission names one we don't recognize, and (b) as the built-in set
# for the ``"known"`` policy. A HOST that wants to be careful can pin its own
# allowlist (node config `declarative.architecture_policy`); that is an
# operational/curation choice (robustness, library-surface trust), NOT what
# keeps the corpus safe. "Permissive" NEVER means trust_remote_code=True — that
# would be running code, i.e. Lane B.
# ---------------------------------------------------------------------------

KNOWN_SEQ2SEQ_ARCHITECTURES = frozenset({
    "MarianMTModel",                          # OPUS-MT / Marian
    "M2M100ForConditionalGeneration",         # M2M100 and NLLB
    "NllbMoeForConditionalGeneration",
    "MBartForConditionalGeneration",          # mBART / mBART-50
    "PLBartForConditionalGeneration",
    "T5ForConditionalGeneration",             # T5
    "MT5ForConditionalGeneration",            # mT5
    "UMT5ForConditionalGeneration",
    "LongT5ForConditionalGeneration",
    "SwitchTransformersForConditionalGeneration",
    "FSMTForConditionalGeneration",           # FairSeq WMT
    "BartForConditionalGeneration",
    "MvpForConditionalGeneration",
    "PegasusForConditionalGeneration",
    "PegasusXForConditionalGeneration",
    "BigBirdPegasusForConditionalGeneration",
    "BlenderbotForConditionalGeneration",
    "BlenderbotSmallForConditionalGeneration",
    "LEDForConditionalGeneration",
    "ProphetNetForConditionalGeneration",
    "XLMProphetNetForConditionalGeneration",
    "SeamlessM4TForTextToText",
    "SeamlessM4Tv2ForTextToText",
    "EncoderDecoderModel",                    # generic BERT2BERT-style seq2seq
})

# Back-compat reference alias (the old name meant "the recognized set").
ALLOWED_ARCHITECTURES = KNOWN_SEQ2SEQ_ARCHITECTURES


def resolve_architecture_policy(policy) -> tuple[str, frozenset | None]:
    """Normalize a host's architecture policy → (mode, allowed_set).

    Accepts:
      * ``None`` / ``"permissive"``               → ("permissive", None)   [default]
      * ``"known"``                                → ("allowlist", KNOWN_SEQ2SEQ_ARCHITECTURES)
      * a list/tuple/set of architecture names     → ("allowlist", frozenset(...))
      * ``{"mode": "permissive"|"known"|"allowlist", "architectures": [...]}``

    An unrecognized shape defaults to permissive (never unsafe here — the
    code-free gates are always enforced regardless of policy).
    """
    if policy is None or policy == "permissive":
        return "permissive", None
    if policy == "known":
        return "allowlist", KNOWN_SEQ2SEQ_ARCHITECTURES
    if isinstance(policy, (list, tuple, set, frozenset)):
        return "allowlist", frozenset(str(a) for a in policy)
    if isinstance(policy, dict):
        mode = policy.get("mode", "permissive")
        if mode == "known":
            return "allowlist", KNOWN_SEQ2SEQ_ARCHITECTURES
        if mode == "allowlist":
            arches = policy.get("architectures")
            if arches:
                return "allowlist", frozenset(str(a) for a in arches)
            return "allowlist", KNOWN_SEQ2SEQ_ARCHITECTURES  # empty → known set
        return "permissive", None
    return "permissive", None

# Declarative bundles are DATA ONLY. A positive whitelist of data suffixes is
# safer than a blacklist of code suffixes: anything not on this list is refused.
ALLOWED_FILE_SUFFIXES = frozenset({
    ".safetensors", ".json", ".model", ".txt", ".spm", ".vocab", ".merges",
})
# Files that may legitimately have no suffix (tokenizer/vocab conventions).
ALLOWED_NOSUFFIX_NAMES = frozenset({
    "vocab", "merges", "special_tokens_map", "added_tokens",
})

# Generation params that are pure data (whitelisted). Anything else in a
# generation_config.json is refused — no custom generation code, no callables.
ALLOWED_GENERATION_KEYS = frozenset({
    "num_beams", "do_sample", "temperature", "top_k", "top_p", "typical_p",
    "max_length", "max_new_tokens", "min_length", "min_new_tokens",
    "length_penalty", "repetition_penalty", "no_repeat_ngram_size",
    "encoder_no_repeat_ngram_size", "early_stopping", "num_return_sequences",
    "decoder_start_token_id", "forced_bos_token_id", "forced_eos_token_id",
    "bos_token_id", "eos_token_id", "pad_token_id", "unk_token_id",
    "diversity_penalty", "num_beam_groups", "renormalize_logits",
    "_from_model_config", "transformers_version", "max_time",
})

# Magic-byte signatures for formats that are code / executable / pickle. Any
# file whose head matches is refused regardless of extension (defense in depth).
_MAGIC_REFUSALS = [
    (b"\x80\x01", "pickle (protocol 1)"),
    (b"\x80\x02", "pickle (protocol 2)"),
    (b"\x80\x03", "pickle (protocol 3)"),
    (b"\x80\x04", "pickle (protocol 4)"),
    (b"\x80\x05", "pickle (protocol 5)"),
    (b"PK\x03\x04", "zip archive (a torch .bin is a zip of pickles)"),
    (b"\x7fELF", "ELF executable"),
    (b"\xca\xfe\xba\xbe", "Mach-O fat binary"),
    (b"\xcf\xfa\xed\xfe", "Mach-O 64-bit executable"),
    (b"\xce\xfa\xed\xfe", "Mach-O 32-bit executable"),
    (b"MZ", "PE/DOS executable"),
]

SAFETENSORS_MAX_HEADER = 200 * 2**20   # 200 MB header ceiling (sanity)


# ---------------------------------------------------------------------------
# §A.1 — safetensors validation WITHOUT torch (parse the header directly).
# ---------------------------------------------------------------------------

def validate_safetensors_file(path: str | Path) -> dict:
    """Parse + validate a .safetensors header. Raises ValueError if the file is
    not well-formed safetensors (which is exactly what a pickle-in-disguise
    would fail). Reads only the header, never the tensor payload."""
    path = Path(path)
    size = path.stat().st_size
    with open(path, "rb") as fh:
        prefix = fh.read(8)
        if len(prefix) < 8:
            raise ValueError("file is too short to be safetensors")
        n = struct.unpack("<Q", prefix)[0]
        if n == 0:
            raise ValueError("safetensors header length is zero")
        if n > SAFETENSORS_MAX_HEADER:
            raise ValueError(
                f"safetensors header length {n} exceeds the {SAFETENSORS_MAX_HEADER}"
                f"-byte sanity ceiling")
        if 8 + n > size:
            raise ValueError(
                f"safetensors header ({n} bytes) overruns the {size}-byte file")
        try:
            header = json.loads(fh.read(n).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError(f"safetensors header is not valid JSON: {exc}")
    if not isinstance(header, dict) or not header:
        raise ValueError("safetensors header is not a non-empty JSON object")
    payload = size - 8 - n
    n_tensors = 0
    for name, spec in header.items():
        if name == "__metadata__":
            if not isinstance(spec, dict):
                raise ValueError("__metadata__ must be an object")
            continue
        if not isinstance(spec, dict) or not {
                "dtype", "shape", "data_offsets"} <= set(spec):
            raise ValueError(f"tensor {name!r} is missing dtype/shape/data_offsets")
        offs = spec["data_offsets"]
        if (not isinstance(offs, list) or len(offs) != 2
                or not all(isinstance(o, int) for o in offs)
                or not 0 <= offs[0] <= offs[1] <= payload):
            raise ValueError(f"tensor {name!r} has data_offsets outside the payload")
        n_tensors += 1
    if n_tensors == 0:
        raise ValueError("safetensors file declares no tensors")
    return {"tensors": n_tensors, "header_bytes": n,
            "metadata": header.get("__metadata__", {})}


def _magic_refusal(path: Path) -> Optional[str]:
    try:
        head = path.open("rb").read(8)
    except OSError:
        return None
    for sig, label in _MAGIC_REFUSALS:
        if head.startswith(sig):
            return label
    return None


# ---------------------------------------------------------------------------
# §A.2 — the manifest + config/tokenizer consistency (the "malice check").
# ---------------------------------------------------------------------------

def _finding(detail: str, severity: str = "BLOCK", category: str = "declarative",
             file: str = "", line: int = 0) -> dict:
    return {"check": "declarative", "severity": severity, "category": category,
            "file": file, "line": line, "detail": detail}


def _scan_json_for_custom_code(obj, path_label: str, findings: list[dict]) -> None:
    """Recursively refuse the ways an HF config/tokenizer re-introduces code:
    ``auto_map`` (points at custom modeling/tokenization modules) and
    ``trust_remote_code: true``."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            kl = str(key).lower()
            if kl == "auto_map":
                findings.append(_finding(
                    f"{path_label}: contains 'auto_map' — this points at "
                    f"custom code modules (modeling_*.py / tokenization_*.py) "
                    f"that would execute on load. The declarative lane refuses "
                    f"it; submit a standard whitelisted architecture, or use "
                    f"the sandbox lane for a code method.", file=path_label))
            if kl == "trust_remote_code" and value is True:
                findings.append(_finding(
                    f"{path_label}: sets trust_remote_code=true — the "
                    f"declarative lane always loads with trust_remote_code="
                    f"False and refuses submissions that request otherwise.",
                    file=path_label))
            _scan_json_for_custom_code(value, path_label, findings)
    elif isinstance(obj, list):
        for item in obj:
            _scan_json_for_custom_code(item, path_label, findings)


def validate_declarative_bundle(
    bundle_dir: str | Path, *,
    tarball_path: str | Path | None = None,
    expected_corpus_id: str | None = None,
    architecture_policy=None,
) -> dict:
    """The Lane-A static check: is this bundle DATA ONLY, in the shapes the
    trusted engine can load? Returns {findings, blocked, blocks, warns,
    manifest} — the SAME shape as sandbox_runner.run_static_checks, so the node
    dispatch treats both lanes identically. Any BLOCK stops the run.

    ``architecture_policy`` (from the host's node config) controls ONLY how the
    declared architecture is treated (see resolve_architecture_policy):
    permissive by default (accept any; WARN if unrecognized), or an allowlist
    for a careful host. It never affects the non-negotiable code-free gates
    (safetensors-not-pickle, no trust_remote_code/auto_map, data-only files),
    which always apply.
    """
    arch_mode, arch_allowed = resolve_architecture_policy(architecture_policy)
    from mt_eval_harness.model_bundle import manifest_declarative_findings
    bundle_dir = Path(bundle_dir)
    findings: list[dict] = []
    manifest = None

    manifest_path = bundle_dir / "manifest.json"
    if not manifest_path.is_file():
        findings.append(_finding("bundle has no manifest.json.",
                                 file="manifest.json"))
    else:
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            findings.append(_finding(f"manifest.json is not valid JSON: {exc}",
                                     file="manifest.json"))
    if manifest is not None:
        findings.extend(manifest_declarative_findings(
            manifest, bundle_dir=bundle_dir,
            expected_corpus_id=expected_corpus_id))

    # 1. Every file must be a DATA suffix (positive whitelist), and must not
    #    carry code/pickle/executable magic.
    model = (manifest or {}).get("model") or {}
    for p in sorted(bundle_dir.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(bundle_dir).as_posix()
        if p.is_symlink():
            findings.append(_finding(f"{rel}: symlink — bundles are plain "
                                     f"files only.", file=rel))
            continue
        suffix = p.suffix.lower()
        allowed = (suffix in ALLOWED_FILE_SUFFIXES
                   or p.name in ALLOWED_NOSUFFIX_NAMES)
        if not allowed:
            findings.append(_finding(
                f"{rel}: '{suffix or p.name}' is not a declarative data file "
                f"(allowed: {sorted(ALLOWED_FILE_SUFFIXES)}). The declarative "
                f"lane runs NO code — a code/script/binary file is refused. "
                f"Use the sandbox lane for a code method.", file=rel))
        magic = _magic_refusal(p)
        if magic:
            findings.append(_finding(
                f"{rel}: file begins with {magic} magic — refused (the "
                f"declarative lane accepts data only; weights must be "
                f"safetensors, never pickle/zip).", file=rel))

    # 2. Weights must be present, .safetensors, and parse as safetensors.
    weights_name = str(model.get("weightsFile") or "").strip()
    if not weights_name:
        findings.append(_finding("manifest.model.weightsFile is required "
                                 "(the .safetensors weights)."))
    else:
        weights = bundle_dir / weights_name
        if not weights.is_file():
            findings.append(_finding(
                f"manifest names weightsFile {weights_name!r} but it is not in "
                f"the bundle.", file=weights_name))
        elif weights.suffix.lower() != ".safetensors":
            findings.append(_finding(
                f"{weights_name}: weights must be .safetensors (pure tensors). "
                f"PyTorch .bin/.pt/.pth/.ckpt are PICKLE — arbitrary code on "
                f"load — and are refused.", file=weights_name))
        else:
            try:
                validate_safetensors_file(weights)
            except ValueError as exc:
                findings.append(_finding(
                    f"{weights_name}: not valid safetensors ({exc}) — refused "
                    f"(a pickle renamed .safetensors fails exactly here).",
                    file=weights_name))

    # 3. config.json: whitelisted architecture, no custom-code hooks.
    config_name = str(model.get("configFile") or "config.json").strip()
    config_path = bundle_dir / config_name
    if not config_path.is_file():
        findings.append(_finding(
            f"config file {config_name!r} is required (declares the "
            f"architecture the trusted engine loads).", file=config_name))
    else:
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            findings.append(_finding(f"{config_name}: not valid JSON: {exc}",
                                     file=config_name))
            config = None
        if config is not None:
            _scan_json_for_custom_code(config, config_name, findings)
            archs = config.get("architectures")
            if not isinstance(archs, list) or not archs:
                findings.append(_finding(
                    f"{config_name}: 'architectures' must be a non-empty list "
                    f"naming the model architecture.", file=config_name))
            elif arch_mode == "allowlist":
                # A CAREFUL host pinned an allowlist. Off-list is a HOST POLICY
                # denial, not a security limit — the corpus is safe regardless.
                bad = [a for a in archs if a not in arch_allowed]
                if bad:
                    findings.append(_finding(
                        f"{config_name}: architecture(s) {bad} are not on this "
                        f"host's architecture allowlist "
                        f"({sorted(arch_allowed)}). This is a HOST POLICY "
                        f"('careful' mode), NOT a security limit — Lane A is "
                        f"code-free for any architecture (safetensors + "
                        f"trust_remote_code=False). Ask the organizer to widen "
                        f"the policy, or resubmit with an accepted architecture.",
                        category="architecture", file=config_name))
            else:
                # PERMISSIVE (default): accept any architecture. WARN — not
                # block — when it is not in the curated known-good set; it will
                # load only if this node's transformers implements it natively.
                unknown = [a for a in archs
                           if a not in KNOWN_SEQ2SEQ_ARCHITECTURES]
                if unknown:
                    findings.append(_finding(
                        f"{config_name}: architecture(s) {unknown} are not in "
                        f"the curated known-good list, but this host runs "
                        f"PERMISSIVE mode so they are ACCEPTED. They will load "
                        f"only if this node's transformers implements them "
                        f"natively (trust_remote_code=False); an unsupported "
                        f"architecture fails cleanly at load time with no code "
                        f"executed.", severity="WARN",
                        category="architecture", file=config_name))

    # 4. Scan every OTHER JSON (tokenizer_config, generation_config, tokenizer)
    #    for custom-code hooks; whitelist generation params.
    for p in sorted(bundle_dir.rglob("*.json")):
        rel = p.relative_to(bundle_dir).as_posix()
        if rel in ("manifest.json", config_name):
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue  # a broken aux json is caught elsewhere / not code
        _scan_json_for_custom_code(data, rel, findings)
        if p.name == "generation_config.json" and isinstance(data, dict):
            extra = sorted(set(data) - ALLOWED_GENERATION_KEYS)
            if extra:
                findings.append(_finding(
                    f"{rel}: unexpected generation key(s) {extra} — only "
                    f"whitelisted decoding parameters are allowed (no custom "
                    f"generation logic).", severity="WARN",
                    category="generation", file=rel))

    blocks = [f for f in findings if f["severity"] == "BLOCK"]
    warns = [f for f in findings if f["severity"] == "WARN"]
    return {"findings": findings, "blocked": bool(blocks),
            "blocks": blocks, "warns": warns, "manifest": manifest}


# ---------------------------------------------------------------------------
# §A.3 — the trusted inference engine (injectable; real path fails loud).
# ---------------------------------------------------------------------------

# A Translator takes (bundle_dir, list[str] sources, manifest) -> list[str].
Translator = Callable[..., "list[str]"]


def hf_translate(bundle_dir: str | Path, sources: list[str],
                 manifest: dict) -> list[str]:
    """The REAL trusted engine: load the whitelisted architecture from the
    bundle's safetensors + declarative tokenizer with transformers, ALWAYS
    trust_remote_code=False + local_files_only + HF offline, and translate.

    Fails LOUD if transformers/torch is absent — there is no silent skip and no
    fallback that would run anything untrusted."""
    import os
    bundle_dir = Path(bundle_dir)
    model_cfg = (manifest or {}).get("model") or {}
    gen = dict(model_cfg.get("generation") or {})
    # Belt-and-suspenders: the trusted process gets no network either.
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    try:
        from transformers import (  # noqa: F401
            AutoModelForSeq2SeqLM,
            AutoTokenizer,
        )
    except ImportError as exc:
        raise SandboxError(
            "the declarative-model lane needs `transformers` (+ torch) to run "
            f"the trusted inference engine, and it is not installed: {exc}. "
            "Install it on the organizer node (pip install transformers torch "
            "safetensors) — there is no no-engine fallback, because running "
            "the weights any other way would defeat the point of the lane.")
    try:
        tok = AutoTokenizer.from_pretrained(
            str(bundle_dir), trust_remote_code=False, local_files_only=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(
            str(bundle_dir), trust_remote_code=False, local_files_only=True)
        model.eval()
    except Exception as exc:  # noqa: BLE001 — surface ALL load failures cleanly
        raise SandboxError(
            f"the trusted engine could not load this model with "
            f"trust_remote_code=False: {type(exc).__name__}: {exc}. Under the "
            f"permissive architecture policy an architecture this node's "
            f"transformers does not implement natively fails HERE — cleanly, "
            f"with NO code executed and no score. (Ask the organizer which "
            f"architectures their engine supports, or use the sandbox lane.)")
    src_lang = model_cfg.get("srcLang")
    tgt_lang = model_cfg.get("tgtLang")
    if src_lang and hasattr(tok, "src_lang"):
        tok.src_lang = src_lang
    gen_kwargs = {k: v for k, v in gen.items() if k in ALLOWED_GENERATION_KEYS}
    if tgt_lang:
        # NLLB/M2M-style forced BOS for the target language.
        conv = getattr(tok, "convert_tokens_to_ids", None)
        lang_to_id = getattr(tok, "lang_code_to_id", None)
        if lang_to_id and tgt_lang in lang_to_id:
            gen_kwargs.setdefault("forced_bos_token_id", lang_to_id[tgt_lang])
        elif conv:
            tid = conv(tgt_lang)
            if isinstance(tid, int) and tid >= 0:
                gen_kwargs.setdefault("forced_bos_token_id", tid)
    out: list[str] = []
    for line in sources:
        enc = tok(line, return_tensors="pt", truncation=True)
        gen_ids = model.generate(**enc, **gen_kwargs)
        out.append(tok.batch_decode(gen_ids, skip_special_tokens=True)[0])
    return out


def run_declarative_model(*, bundle_dir: str | Path, corpus_path: str | Path,
                          work_dir: str | Path, manifest: dict,
                          translator: Translator = hf_translate) -> dict:
    """Write the SOURCE side to scratch, run the trusted translator, write
    /output/translations.txt. No container — the translator is trusted code.
    Returns execution facts (mirrors sandbox_runner.execute_method's shape)."""
    bundle_dir = Path(bundle_dir)
    work_dir = Path(work_dir)
    eval_dir = work_dir / "eval"
    n_sources = write_source_file(corpus_path, eval_dir)
    sources = (eval_dir / "source.txt").read_text(
        encoding="utf-8").splitlines()

    import time
    started = time.monotonic()
    translations = translator(bundle_dir, sources, manifest)
    elapsed = time.monotonic() - started

    if not isinstance(translations, list):
        raise SandboxError("the trusted translator did not return a list of "
                           "translations — no score produced.")
    if len(translations) != n_sources:
        raise SandboxError(
            f"the trusted engine produced {len(translations)} translations for "
            f"{n_sources} source lines — count mismatch, no score produced.")
    output_dir = work_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "translations.txt"
    out_path.write_text(
        "\n".join(str(t).replace("\n", " ") for t in translations) + "\n",
        encoding="utf-8")
    return {
        "translations_path": str(out_path),
        "runtime_seconds": round(elapsed, 3),
        "runtime": "declarative-engine",
        "source_count": n_sources,
        "output_bytes": out_path.stat().st_size,
    }


def execute_and_score_declarative(
    *, bundle_dir: str | Path, corpus_path: str | Path,
    work_dir: str | Path, sealed_set_id: str, language_pair: str,
    node_id: str, submission: dict | None = None,
    output_dir: str | Path,
    sandbox_cfg: dict | None = None,           # unused (no container); kept for
    runner=None,                                # a signature parallel to Lane B
    translator: Translator = hf_translate,
    architecture_policy=None,
    expected_corpus_id: str | None = None) -> dict:
    """Validate (code-free) → run in the trusted engine → single-scorer score.

    Same signature + return shape as sandbox_runner.execute_and_score, so the
    node dispatch is a one-line swap. Raises SandboxError with the blocking
    findings if validation fails (the caller turns that into a denial WITH
    reasons). Scratch is wiped in the finally.
    """
    from mt_eval_harness.external_scoring import (
        DECLARATIVE_MODEL_CONDITION,
        build_declarative_model_card,
        score_hypotheses,
        sha256_file,
    )
    from mt_eval_harness.sandbox_runner import wipe_tree
    bundle_dir = Path(bundle_dir)
    work_dir = Path(work_dir)

    checks = validate_declarative_bundle(
        bundle_dir, expected_corpus_id=expected_corpus_id,
        architecture_policy=architecture_policy)
    for w in checks["warns"]:
        print(f"    ⚠ {w['detail']}")
    if checks["blocked"]:
        raise SandboxError(
            "declarative validation BLOCKS this bundle (Lane A): "
            + "; ".join(b["detail"] for b in checks["blocks"][:8]))
    manifest = checks["manifest"]
    model_cfg = manifest.get("model") or {}
    method = manifest["method"]

    try:
        exec_facts = run_declarative_model(
            bundle_dir=bundle_dir, corpus_path=corpus_path,
            work_dir=work_dir, manifest=manifest, translator=translator)

        method_sha = None
        tarball = bundle_dir.with_suffix(".tar.gz")
        if tarball.is_file():
            method_sha = sha256_file(tarball)
        src, _, tgt = (language_pair or ">").partition(">")
        arch = (model_cfg.get("architecture")
                or (model_cfg.get("architectures") or [None])[0]
                or "unknown")
        card = build_declarative_model_card(
            system_label=method["name"],
            method_class=method["class"],
            paradigm=method.get("paradigm"),
            description=method.get("description", ""),
            method_sha=method_sha or (submission or {}).get("method_sha", ""),
            node_id=node_id,
            architecture=arch,
        )
        result = score_hypotheses(
            corpus_path=corpus_path,
            hypotheses_path=exec_facts["translations_path"],
            dataset_id=sealed_set_id,
            source_lang=src or "source",
            target_lang=tgt or "target",
            system_label=method["name"],
            method_class=method["class"],
            paradigm=method.get("paradigm"),
            description=method.get("description", ""),
            output_dir=output_dir,
            default_segment="gold_standard",
            submission=submission,
            compute_ci=True,
            condition=DECLARATIVE_MODEL_CONDITION,
            method_card=card,
        )
        result["execution"] = exec_facts
        result["static_checks"] = {"blocks": 0, "warns": len(checks["warns"])}
        result["method_card"] = card
        return result
    finally:
        wipe_tree(work_dir)
