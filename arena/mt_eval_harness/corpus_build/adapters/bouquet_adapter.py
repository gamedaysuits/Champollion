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
BOUQuET (Meta FAIR multicentric benchmark) fetch-from-source builder adapter.

Single home for everything needed to rebuild a BOUQuET eval corpus from
upstream:

  * the HuggingFace dataset repo + the curated ``benchmark_data`` pairwise
    parquet files,
  * an immutable commit ``revision`` pin (the integrity anchor),
  * a gated-download (HF token) path that fails loud when access is missing,
  * a lazy ``pyarrow`` import that fails loud when the optional parquet
    dependency is missing, and
  * a flexible-but-loud column resolver that pairs the two text columns.

BOUQuET is a newly hand-crafted, multicentric (multi-way) translation
benchmark — NOT FLORES-derived — so contamination is LOW; this is the
project's top-pick low-contamination set. The ``benchmark_data/sentence_level``
directory holds the curated official pairs as ``{src}-{tgt}.parquet`` files
(dev = 504 sentences, test = 854).

⚠ TWO upstream gates this adapter surfaces honestly (it never substitutes or
fabricates):
  1. ACCESS: ``facebook/bouquet`` is GATED on HuggingFace — a logged-in user
     must accept the dataset terms once, then a token is required. Without it
     this adapter raises with accept-terms instructions (mirrors in22).
  2. FORMAT: BOUQuET ships parquet only. ``pyarrow`` is an OPTIONAL dependency
     of the corpora builder; this adapter imports it lazily and raises a clear
     "pip install pyarrow" message if it is absent (the harness core and the
     other five adapters stay stdlib-only).

BOUQuET is CC-BY-4.0 (Meta FAIR, 2025;
https://huggingface.co/datasets/facebook/bouquet).
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import urllib.error
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — the SSOT for the BOUQuET upstream
# ---------------------------------------------------------------------------

DEFAULT_REPO = "facebook/bouquet"
#: Immutable commit pin — the integrity anchor.
DEFAULT_REVISION = "9a6070a9652e350dda1d353c4fd198533199a911"
#: Curated official pairwise parquet files (NOT the 259² all-pairs raw set).
_MEMBER_PATTERN = "benchmark_data/sentence_level/{split}/{a}-{b}.parquet"
VALID_SPLITS = ("dev", "test")
DOMAIN = "mixed"

USER_AGENT = "champollion-corpus-builder (+https://champollion.dev)"

_TOKEN_ENV_VARS = (
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "HUGGINGFACE_TOKEN", "HF_API_TOKEN",
)
_TOKEN_FILES = (
    Path.home() / ".cache" / "huggingface" / "token",
    Path.home() / ".huggingface" / "token",
)


def _hf_token() -> str | None:
    for var in _TOKEN_ENV_VARS:
        val = os.environ.get(var)
        if val and val.strip():
            return val.strip()
    for path in _TOKEN_FILES:
        if path.is_file():
            tok = path.read_text(encoding="utf-8").strip()
            if tok:
                return tok
    return None


def _gated_error(repo: str, status: int) -> RuntimeError:
    return RuntimeError(
        f"BOUQuET download from '{repo}' returned HTTP {status}. The Meta FAIR "
        f"BOUQuET dataset is GATED on HuggingFace. To fetch this corpus:\n"
        f"  1. Sign in at https://huggingface.co and open "
        f"https://huggingface.co/datasets/{repo}\n"
        f"  2. Click 'Agree and access repository' to accept the CC-BY-4.0 "
        f"terms.\n"
        f"  3. Set an access token: export HF_TOKEN=hf_... (or log in with "
        f"`huggingface-cli login`).\n"
        f"Then re-run the fetch. This builder never substitutes a different "
        f"corpus when the gated source is unavailable."
    )


def _require_pyarrow():
    """Lazy import of the optional parquet dependency, with a loud message."""
    try:
        import pyarrow.parquet as pq  # noqa: F401
        return pq
    except ImportError as exc:
        raise RuntimeError(
            "BOUQuET ships parquet files, which require the optional 'pyarrow' "
            "dependency. Install it with `pip install pyarrow` and re-run the "
            "fetch. (pyarrow is intentionally NOT a hard dependency of the "
            "corpora builder — only the BOUQuET adapter needs it.)"
        ) from exc


def _repo_id(repo_url: str | None) -> str:
    if not repo_url:
        return DEFAULT_REPO
    marker = "huggingface.co/datasets/"
    if marker in repo_url:
        return repo_url.split(marker, 1)[1].strip("/")
    return repo_url.strip("/")


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ---------------------------------------------------------------------------
# Download (gated) + parse (parquet)
# ---------------------------------------------------------------------------

def download_pair_file(
    cache_dir: Path,
    split: str,
    src_code: str,
    tgt_code: str,
    *,
    revision: str | None = None,
    repo_url: str | None = None,
    file_sha256: str | None = None,
) -> tuple[Path, str, str]:
    """Download (and cache) one curated pairwise parquet from the pin.

    The benchmark file may be stored in either order (``a-b`` or ``b-a``);
    both are tried. Returns ``(local_path, file_src_code, file_tgt_code)`` —
    the file codes in the order the FILE stores them, so the caller can map
    columns to the requested direction.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    rev = revision or DEFAULT_REVISION
    repo = _repo_id(repo_url)
    orders = ((src_code, tgt_code), (tgt_code, src_code))

    # Cache-first pass over BOTH stored orders — a previously fetched reverse
    # file must not trigger a needless (and, offline, failing) download.
    for a, b in orders:
        local = cache_dir / f"{rev}__{split}__{a}-{b}.parquet"
        if local.exists() and (not file_sha256
                               or _sha256_file(local) == file_sha256):
            return local, a, b

    token = _hf_token()
    if not token:
        raise _gated_error(repo, 401)
    headers = {"User-Agent": USER_AGENT, "Authorization": f"Bearer {token}"}

    last_404: Exception | None = None
    for a, b in orders:
        member = _MEMBER_PATTERN.format(split=split, a=a, b=b)
        local = cache_dir / f"{rev}__{split}__{a}-{b}.parquet"
        url = f"https://huggingface.co/datasets/{repo}/resolve/{rev}/{member}"
        logger.info("Downloading %s", url)
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = resp.read()
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise _gated_error(repo, e.code)
            if e.code == 404:
                last_404 = FileNotFoundError(
                    f"BOUQuET has no curated pair member '{member}' at "
                    f"revision {rev}."
                )
                continue
            raise
        if file_sha256 and _sha256_bytes(data) != file_sha256:
            raise ValueError(
                f"BOUQuET {member} sha mismatch — re-pin the card."
            )
        local.write_bytes(data)
        return local, a, b

    raise last_404 or FileNotFoundError(
        f"BOUQuET has no curated pair {src_code}-{tgt_code} (either order) at "
        f"revision {rev}."
    )


def _resolve_columns(
    column_names: list[str], src_code: str, tgt_code: str,
) -> tuple[str, str]:
    """Find the (source_column, target_column) names in a BOUQuET parquet.

    Loud-flexible: try the BOUQuET file codes as column names, then common
    generic names, then "exactly two string-ish columns". Raises with the
    actual column list if none match — never guesses silently.
    """
    cols = list(column_names)
    cset = set(cols)
    # 1. Columns named by the language file codes.
    if src_code in cset and tgt_code in cset:
        return src_code, tgt_code
    # 2. Common generic source/target column names.
    for s_name, t_name in (
        ("source", "target"), ("src", "tgt"), ("src", "trg"),
        ("source_text", "target_text"), ("sentence_src", "sentence_tgt"),
    ):
        if s_name in cset and t_name in cset:
            return s_name, t_name
    # 3. Exactly two non-metadata columns → assume (src, tgt) in column order.
    meta = {"id", "idx", "index", "domain", "register", "lang", "split"}
    text_cols = [c for c in cols if c.lower() not in meta]
    if len(text_cols) == 2:
        return text_cols[0], text_cols[1]
    raise ValueError(
        f"Could not resolve BOUQuET source/target text columns for "
        f"{src_code}->{tgt_code}. Parquet columns are: {cols}. Update "
        f"_resolve_columns() once the schema is confirmed."
    )


def build_pair(
    local: Path,
    *,
    file_src_code: str,
    file_tgt_code: str,
    want_src_code: str,
    want_tgt_code: str,
) -> list[tuple[str, str]]:
    """Read a BOUQuET pairwise parquet into oriented ``[(src, tgt), ...]``.

    The file stores two columns (one per language); we map them to the
    requested direction, flipping if the file's stored order is reversed.
    """
    pq = _require_pyarrow()
    table = pq.read_table(str(local))
    src_col, tgt_col = _resolve_columns(
        table.column_names, file_src_code, file_tgt_code,
    )
    rows_src = [str(x) for x in table.column(src_col).to_pylist()]
    rows_tgt = [str(x) for x in table.column(tgt_col).to_pylist()]
    if len(rows_src) != len(rows_tgt):
        raise ValueError(
            f"BOUQuET parquet {local.name}: column length mismatch "
            f"({len(rows_src)} vs {len(rows_tgt)})."
        )
    # If the file stores (tgt, src) relative to what we want, flip.
    flip = (file_src_code == want_tgt_code and file_tgt_code == want_src_code)
    pairs = []
    for a, b in zip(rows_src, rows_tgt):
        s, t = (b, a) if flip else (a, b)
        s, t = s.strip(), t.strip()
        if s and t and s != "None" and t != "None":
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
    src_code: str,
    tgt_code: str,
    cache_dir: Path,
    split: str = "dev",
    revision: str | None = None,
    repo_url: str | None = None,
    file_sha256: str | None = None,
    expected_size: int | None = None,
    auto_yes: bool = False,
) -> Path:
    """Rebuild one BOUQuET eval corpus into ``dest`` (harness-json).

    ``source_lang``/``target_lang`` are project ISO codes (labels). ``src_code``
    /``tgt_code`` are BOUQuET file codes (e.g. 'afr_Latn', 'eng_Latn') used to
    locate the curated parquet and orient the columns. Requires an HF token
    (gated) and pyarrow (parquet) — both fail loud when missing.
    """
    if split not in VALID_SPLITS:
        raise ValueError(f"BOUQuET split must be one of {VALID_SPLITS}; "
                         f"got '{split}'.")

    local, file_a, file_b = download_pair_file(
        cache_dir, split, src_code, tgt_code,
        revision=revision, repo_url=repo_url, file_sha256=file_sha256,
    )
    pairs = build_pair(
        local,
        file_src_code=file_a, file_tgt_code=file_b,
        want_src_code=src_code, want_tgt_code=tgt_code,
    )
    if not pairs:
        raise ValueError(
            f"BOUQuET {source_lang}→{target_lang} ({src_code}-{tgt_code}, "
            f"{split}): empty pair — upstream data may have changed."
        )

    if expected_size is not None and len(pairs) != expected_size:
        raise ValueError(
            f"BOUQuET {source_lang}→{target_lang} ({src_code}-{tgt_code}): "
            f"rebuilt pair has {len(pairs)} sentences but the card declares "
            f"{expected_size}. Re-pin the card (size/revision) before serving."
        )

    entries = [
        {"source": s, "target": t, "id": str(i)}
        for i, (s, t) in enumerate(pairs, 1)
    ]
    corpus = {
        "source_lang": source_lang,
        "target_lang": target_lang,
        "entry_count": len(entries),
        "domain": DOMAIN,
        "source_dataset": f"bouquet-{split}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built BOUQuET corpus %s→%s (%s-%s, %s, %d entries) at %s",
        source_lang, target_lang, src_code, tgt_code, split, len(entries), dest,
    )
    return dest
