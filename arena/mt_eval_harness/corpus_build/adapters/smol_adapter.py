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
SMOL (Google "Set of Maximal Over-the-counter Languages") fetch-from-source
builder adapter.

Single home for everything needed to rebuild a SMOL eval corpus from
upstream:

  * the HuggingFace dataset repo + the per-direction ``{subset}/{a}_{b}.jsonl``
    files,
  * an immutable commit ``revision`` pin (the integrity anchor),
  * the JSONL parse for the two usable subsets, and
  * the directed-pair pairing SMOL ships.

SMOL has two subsets we use — SmolSent (sentence-level) and SmolDoc
(document-level) — and ONE we deliberately skip: GATITOS is a token/lexicon
table, not an MT evaluation set. Each file is ONE directed pair named
``{src}_{tgt}`` (e.g. ``en_af`` = English→Afrikaans, ``af_en`` =
Afrikaans→English; most languages ship both directions, plus a few non-English
pivots — ru, ar, zh, am, sw). A SmolSent row carries ``src``/``trg`` strings;
a SmolDoc row carries parallel ``srcs``/``trgs`` lists (a document) which we
align element-wise into sentence pairs.

Champollion-defined eval slice: SMOL is published as TRAINING data with NO
official train/test split. Champollion therefore uses the FULL pinned release
(at the commit ``revision`` below) as a deterministic, reproducible held-out
eval set, and labels it as Champollion-defined wherever it surfaces. Pinning
the commit makes "the full file" an exact, frozen artifact.

Loud-failure policy: this adapter never guesses and never silently
substitutes. A missing file, an empty pair, a row whose declared (sl, tl) does
not match the requested file codes, or a built pair whose size no longer
matches the card all raise.

SMOL is CC-BY-4.0 (Caswell et al., 2025;
https://huggingface.co/datasets/google/smol). Contamination is MED — it is a
public training resource, so frontier models may have seen it.
"""

from __future__ import annotations

import hashlib
import json
import logging
import urllib.error
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — the SSOT for the SMOL upstream
# ---------------------------------------------------------------------------

DEFAULT_REPO = "google/smol"
#: Immutable commit pin — the integrity anchor + the "held-out slice" anchor
#: (the full release at this commit IS the Champollion-defined eval set).
DEFAULT_REVISION = "59fd221f9151af49a2d3d5e9c5d3835a7d9eec5a"
#: SmolDoc + SmolSent only. GATITOS is a lexicon, never an MT eval set.
VALID_SUBSETS = ("smolsent", "smoldoc")
#: Per-direction file: {subset}/{src}_{tgt}.jsonl.
_MEMBER_PATTERN = "{subset}/{src}_{tgt}.jsonl"
DOMAIN = "mixed"

USER_AGENT = "champollion-corpus-builder (+https://champollion.dev)"


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _repo_id(repo_url: str | None) -> str:
    """Extract 'org/name' from a HF dataset URL, or pass through a bare id."""
    if not repo_url:
        return DEFAULT_REPO
    marker = "huggingface.co/datasets/"
    if marker in repo_url:
        return repo_url.split(marker, 1)[1].strip("/")
    return repo_url.strip("/")


def download_pair_file(
    cache_dir: Path,
    subset: str,
    src_code: str,
    tgt_code: str,
    *,
    revision: str | None = None,
    repo_url: str | None = None,
    file_sha256: str | None = None,
) -> Path:
    """Download (and cache) one ``{subset}/{src}_{tgt}.jsonl`` from the pin.

    The commit ``revision`` makes the bytes immutable; an optional
    ``file_sha256`` adds a per-file check. Cached files that still match are
    reused; a fresh download that fails verification raises.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    member = _MEMBER_PATTERN.format(subset=subset, src=src_code, tgt=tgt_code)
    rev = revision or DEFAULT_REVISION
    repo = _repo_id(repo_url)
    local = cache_dir / f"{rev}__{subset}__{src_code}_{tgt_code}.jsonl"

    if local.exists():
        if not file_sha256 or _sha256_file(local) == file_sha256:
            return local
        logger.warning("Cached SMOL %s failed sha verification — "
                       "re-downloading", member)

    url = f"https://huggingface.co/datasets/{repo}/resolve/{rev}/{member}"
    logger.info("Downloading %s", url)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise FileNotFoundError(
                f"SMOL has no member '{member}' at revision {rev} (repo {repo}). "
                f"SMOL files are directional: '{src_code}_{tgt_code}' may only "
                f"exist as '{tgt_code}_{src_code}'."
            )
        raise

    if file_sha256:
        actual = _sha256_bytes(data)
        if actual != file_sha256:
            raise ValueError(
                f"SMOL {member} sha mismatch:\n  Expected: {file_sha256}\n"
                f"  Got:      {actual}\n  Upstream {url} may have changed — "
                f"re-pin the card."
            )
    local.write_bytes(data)
    return local


# ---------------------------------------------------------------------------
# Parse
# ---------------------------------------------------------------------------

def _build_smolsent(rows: list[dict]) -> list[tuple[str, str]]:
    """SmolSent: each row is one sentence pair (src/trg)."""
    pairs = []
    for row in rows:
        src = (row.get("src") or "").strip()
        trg = (row.get("trg") or "").strip()
        if src and trg:
            pairs.append((src, trg))
    return pairs


def _build_smoldoc(rows: list[dict]) -> list[tuple[str, str]]:
    """SmolDoc: each row is a document — parallel ``srcs``/``trgs`` lists.

    Aligned element-wise into sentence pairs (the lists are line-parallel; a
    length mismatch within a document raises rather than misalign).
    """
    pairs = []
    for row in rows:
        srcs = row.get("srcs") or []
        trgs = row.get("trgs") or []
        if not isinstance(srcs, list) or not isinstance(trgs, list):
            raise ValueError(
                f"SmolDoc row {row.get('id')!r} has non-list srcs/trgs — "
                f"upstream format changed."
            )
        if len(srcs) != len(trgs):
            raise ValueError(
                f"SmolDoc row {row.get('id')!r}: {len(srcs)} source segments "
                f"vs {len(trgs)} target segments — documents must be parallel."
            )
        for s, t in zip(srcs, trgs):
            s, t = (s or "").strip(), (t or "").strip()
            if s and t:
                pairs.append((s, t))
    return pairs


def build_pair(
    path: Path, subset: str, *, src_code: str, tgt_code: str,
) -> list[tuple[str, str]]:
    """Return aligned ``[(source_text, target_text), ...]`` from one file.

    Verifies each row's declared (sl, tl) matches the requested file codes so
    a mislabelled or wrong file can't masquerade as the pair.
    """
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        sl, tl = row.get("sl"), row.get("tl")
        if sl is not None and tl is not None and (sl, tl) != (src_code, tgt_code):
            raise ValueError(
                f"SMOL file {src_code}_{tgt_code} carries a row labelled "
                f"({sl}, {tl}) — file/content mismatch, refusing to serve it."
            )
        rows.append(row)
    if subset == "smolsent":
        return _build_smolsent(rows)
    return _build_smoldoc(rows)


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
    subset: str,
    cache_dir: Path,
    revision: str | None = None,
    repo_url: str | None = None,
    file_sha256: str | None = None,
    expected_size: int | None = None,
    auto_yes: bool = False,
) -> Path:
    """Rebuild one SMOL eval corpus into ``dest`` (harness-json).

    ``source_lang``/``target_lang`` are project ISO codes (labels only).
    ``src_code``/``tgt_code`` are the SMOL upstream codes that name the file
    (``{src}_{tgt}.jsonl``) and orient src→trg. ``subset`` is 'smolsent' or
    'smoldoc'. ``expected_size``, when given, is enforced.
    """
    if subset not in VALID_SUBSETS:
        raise ValueError(
            f"SMOL subset must be one of {VALID_SUBSETS}; got '{subset}'. "
            f"(GATITOS is a lexicon, not an MT eval set, and is excluded.)"
        )

    path = download_pair_file(
        cache_dir, subset, src_code, tgt_code,
        revision=revision, repo_url=repo_url, file_sha256=file_sha256,
    )
    pairs = build_pair(path, subset, src_code=src_code, tgt_code=tgt_code)
    if not pairs:
        raise ValueError(
            f"SMOL {subset} {source_lang}→{target_lang} "
            f"({src_code}_{tgt_code}): empty pair — upstream data may have "
            f"changed."
        )

    if expected_size is not None and len(pairs) != expected_size:
        raise ValueError(
            f"SMOL {subset} {source_lang}→{target_lang} "
            f"({src_code}_{tgt_code}): rebuilt pair has {len(pairs)} sentences "
            f"but the card declares {expected_size}. Upstream SMOL data may "
            f"have changed since the card was pinned — re-pin the card "
            f"(size/revision) before serving it."
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
        "source_dataset": f"smol-{subset}-{src_code}_{tgt_code}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built SMOL %s corpus %s→%s (%s_%s, %d entries) at %s",
        subset, source_lang, target_lang, src_code, tgt_code, len(entries), dest,
    )
    return dest
