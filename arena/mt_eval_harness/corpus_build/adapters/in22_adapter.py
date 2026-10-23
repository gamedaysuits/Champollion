# Ported from the internal corpora-builder (founder decision 2026-08-27):
# the fetch-on-miss corpus REBUILD path must work in the open-source harness
# — 5,595 of 5,602 registry corpora are fetch-from-source and corpus content
# is never tracked, so without these primitives a public clone could browse
# the queue and rebuild nothing (docs/PRE_REVIEW_HARDENING_2026-08-27.md).
# The intake/probe/recipe-authoring tooling remains in the private builder;
# this subpackage ships with the harness under the harness's license.
# Byte-parity with the private builder's copy is protected by the per-pair
# sha guards: a divergent rebuild fails loudly at publish, never silently.
"""
IN22 (AI4Bharat IndicTrans2 benchmark) fetch-from-source builder.

Single home for everything needed to rebuild an IN22 eval corpus from
upstream:

  * the HuggingFace dataset repo + tar artifact (``IN22_benchmark.tar.gz``),
  * the project ISO 639-3 ↔ IN22 FLORES-style file-code map,
  * the gated-download (HF token) of the tarball with sha verification, and
  * the line-index alignment that turns the N-way parallel set into any
    ordered (source, target) pair.

The IN22 benchmark has two subsets: ``conv`` (IN22-Conv, conversational,
1503 sentences) and ``gen`` (IN22-Gen, general, 1024 sentences). Both ship
inside the same ``IN22_benchmark.tar.gz`` (``IN22_benchmark/{conv,gen}/
test.<flores_code>``), N-way parallel and line-aligned.

Gating: the AI4Bharat datasets are gated on HuggingFace (``gated: auto``).
A logged-in user must accept the dataset terms once on the dataset page;
fetching then requires an HF token. This adapter reads the standard HF token
locations and FAILS LOUD with instructions when the token is missing or the
terms have not been accepted — it never silently substitutes or fabricates.

IN22 is CC-BY-4.0 (Gala et al., 2023; https://github.com/AI4Bharat/IndicTrans2).
"""

from __future__ import annotations

import hashlib
import json
import logging
import tarfile
from pathlib import Path

from mt_eval_harness.corpus_build import hf_download

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — the SSOT for the IN22 upstream
# ---------------------------------------------------------------------------

DEFAULT_REPO = "ai4bharat/IN22-Conv"
ARCHIVE_NAME = "IN22_benchmark.tar.gz"
#: Files live at IN22_benchmark/{subset}/test.{flores_code}, one per language.
_MEMBER_PATTERN = "IN22_benchmark/{subset}/test.{code}"
VALID_SUBSETS = ("conv", "gen")

USER_AGENT = "champollion-corpus-builder (+https://champollion.dev)"

# Project ISO 639-3 (the codes the cards/registry use) → IN22 FLORES-style
# file code (the suffix of test.<code> inside the tarball). Most codes share
# their ISO 639-3 stem; the two that differ are spelled out:
#   * kok (Konkani macro) → gom_Deva  (IN22 ships Goan Konkani)
#   * ori (Odia)          → ory_Orya  (IN22 uses the ISO 639-3 'ory' spelling)
# Kept self-contained so the builder works when distributed without the
# monorepo's code-bridge.json.
IN22_CODE_MAP = {
    "eng": "eng_Latn", "asm": "asm_Beng", "ben": "ben_Beng", "brx": "brx_Deva",
    "doi": "doi_Deva", "guj": "guj_Gujr", "hin": "hin_Deva", "kan": "kan_Knda",
    "kas": "kas_Arab", "kok": "gom_Deva", "mai": "mai_Deva", "mal": "mal_Mlym",
    "mni": "mni_Mtei", "mar": "mar_Deva", "npi": "npi_Deva", "ori": "ory_Orya",
    "pan": "pan_Guru", "san": "san_Deva", "sat": "sat_Olck", "snd": "snd_Deva",
    "tam": "tam_Taml", "tel": "tel_Telu", "urd": "urd_Arab",
}


def iso3_to_in22(code: str) -> str:
    """Map a project ISO 639-3 code to its IN22 file code.

    Accepts an already-IN22 file code too (idempotent). Raises — never
    guesses — when the code isn't in the bridge.
    """
    if code in IN22_CODE_MAP:
        return IN22_CODE_MAP[code]
    if code in IN22_CODE_MAP.values():
        return code
    raise ValueError(
        f"No IN22 file code for language '{code}'. Known project codes: "
        f"{sorted(IN22_CODE_MAP)}. If IN22 carries this language, add it to "
        f"IN22_CODE_MAP."
    )


# ---------------------------------------------------------------------------
# HF token + gated download
#
# Gated downloads are standardized on the official huggingface_hub client via
# corpora_builder.hf_download. The token-resolution helpers below are thin
# aliases kept for backward compatibility with callers/tests that referenced
# them on this module.
# ---------------------------------------------------------------------------

_TOKEN_ENV_VARS = hf_download.TOKEN_ENV_VARS
_TOKEN_FILES = hf_download.TOKEN_FILES


def _hf_token() -> str | None:
    """Resolve an HF token via the standard env vars / token files / login."""
    return hf_download.resolve_hf_token()


def download_archive(
    cache_dir: Path,
    *,
    repo_url: str | None = None,
    archive_sha256: str | None = None,
    terms_url: str | None = None,
    token_env: str = "HF_TOKEN",
) -> Path:
    """Download (and cache) IN22_benchmark.tar.gz, verifying its sha.

    ``repo_url`` is the HF dataset page (e.g.
    ``https://huggingface.co/datasets/ai4bharat/IN22-Conv``). The IN22
    datasets are GATED, so the fetch goes through the official huggingface_hub
    client (see :mod:`corpora_builder.hf_download`), which fails honestly with
    a message that DISTINGUISHES no-token, terms-not-accepted, and network
    failures.
    """
    repo = _repo_id(repo_url)
    return hf_download.download_gated_file(
        repo_id=repo,
        filename=ARCHIVE_NAME,
        dest_dir=cache_dir,
        dest_name=ARCHIVE_NAME,
        repo_type="dataset",
        terms_url=terms_url or repo_url
        or f"https://huggingface.co/datasets/{repo}",
        token_env=token_env or "HF_TOKEN",
        expected_sha256=archive_sha256,
    )


def _repo_id(repo_url: str | None) -> str:
    """Extract 'org/name' from a HF dataset URL, or pass through a bare id."""
    if not repo_url:
        return DEFAULT_REPO
    marker = "huggingface.co/datasets/"
    if marker in repo_url:
        return repo_url.split(marker, 1)[1].strip("/")
    return repo_url.strip("/")


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ---------------------------------------------------------------------------
# Parse + align
# ---------------------------------------------------------------------------

def _read_lines(archive: Path, subset: str, file_code: str) -> list[str]:
    member = _MEMBER_PATTERN.format(subset=subset, code=file_code)
    with tarfile.open(archive) as tf:
        try:
            fh = tf.extractfile(member)
        except KeyError:
            fh = None
        if fh is None:
            raise FileNotFoundError(
                f"IN22 archive has no member '{member}'. The tarball layout "
                f"may have changed upstream; re-pin the card."
            )
        text = fh.read().decode("utf-8")
    return text.rstrip("\n").split("\n")


def build_pair(
    archive: Path,
    *,
    source_lang: str,
    target_lang: str,
    subset: str,
) -> list[tuple[str, str]]:
    """Return aligned ``[(source_text, target_text), ...]`` for a pair.

    IN22 is N-way parallel and line-aligned, so the pairing is a direct
    zip of the two language files by line index.
    """
    src_lines = _read_lines(archive, subset, iso3_to_in22(source_lang))
    tgt_lines = _read_lines(archive, subset, iso3_to_in22(target_lang))
    if len(src_lines) != len(tgt_lines):
        raise ValueError(
            f"IN22 {subset} line-count mismatch: {source_lang} has "
            f"{len(src_lines)} lines, {target_lang} has {len(tgt_lines)}. The "
            f"subset is supposed to be line-aligned — upstream data changed."
        )
    pairs = []
    for s, t in zip(src_lines, tgt_lines):
        s, t = s.strip(), t.strip()
        if not s or not t:
            continue
        pairs.append((s, t))
    return pairs


# ---------------------------------------------------------------------------
# Harness fetch-on-miss entry point
# ---------------------------------------------------------------------------

def build_corpus_file(
    dest: Path,
    *,
    source_lang: str,
    target_lang: str,
    cache_dir: Path,
    subset: str,
    repo_url: str | None = None,
    archive_sha256: str | None = None,
    expected_size: int | None = None,
    domain: str | None = None,
    terms_url: str | None = None,
    token_env: str = "HF_TOKEN",
    auto_yes: bool = False,
) -> Path:
    """Rebuild one IN22 eval corpus into ``dest`` (harness-json).

    ``source_lang``/``target_lang`` are project ISO 639-3 codes. ``subset``
    is 'conv' or 'gen'. ``expected_size``, when given, is enforced: a built
    pair of a different size raises rather than serving data that no longer
    matches the pinned card. ``terms_url``/``token_env`` come from the card's
    gated-download metadata and drive the fail-honest gated-download messages.
    """
    if subset not in VALID_SUBSETS:
        raise ValueError(
            f"IN22 subset must be one of {VALID_SUBSETS}; got '{subset}'."
        )

    archive = download_archive(
        cache_dir, repo_url=repo_url, archive_sha256=archive_sha256,
        terms_url=terms_url, token_env=token_env,
    )
    pairs = build_pair(
        archive,
        source_lang=source_lang,
        target_lang=target_lang,
        subset=subset,
    )
    if not pairs:
        raise ValueError(
            f"IN22 {subset} {source_lang}→{target_lang}: empty pair after "
            f"alignment (upstream data may have changed)."
        )

    if expected_size is not None and len(pairs) != expected_size:
        raise ValueError(
            f"IN22 {subset} {source_lang}→{target_lang}: rebuilt pair has "
            f"{len(pairs)} sentences but the card declares {expected_size}. "
            f"Upstream IN22 data may have changed since the card was pinned — "
            f"re-pin the card (and any sha256) before serving it."
        )

    entries = [
        {"source": s, "target": t, "id": str(i)}
        for i, (s, t) in enumerate(pairs, 1)
    ]
    corpus = {
        "source_lang": source_lang,
        "target_lang": target_lang,
        "entry_count": len(entries),
        "domain": domain or ("conversational" if subset == "conv" else "mixed"),
        "source_dataset": f"in22-{subset}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built IN22 %s corpus %s→%s (%d entries) at %s",
        subset, source_lang, target_lang, len(entries), dest,
    )
    return dest
