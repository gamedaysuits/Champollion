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
WMT24++ (Google/Unbabel) fetch-from-source builder adapter.

Single home for everything needed to rebuild a WMT24++ eval corpus from
upstream:

  * the HuggingFace dataset repo + the per-target ``en-{code}.jsonl`` files,
  * an immutable commit ``revision`` pin (the integrity anchor — every file
    fetched from ``resolve/{revision}/`` is byte-frozen),
  * the JSONL parse that drops machine-translation artifacts, and
  * the English-source → regional-target pairing WMT24++ ships.

WMT24++ is English-source only: each ``en-{code}.jsonl`` file holds the
English ``source`` plus a human ``target`` POST-EDIT and the raw
``original_target`` MT output. We score against ``target`` (the post-edit,
the dataset's reference translation) and DROP every ``is_bad_source`` row
(the canary row and flagged-bad sources). Direction is unidirectional
eng→xx — the post-edit lives on the target side, so eng→xx is the only
honest direction.

The 55 language pairs / 47 languages include regional variants
(fr-CA, pt-PT, es-MX, ar-EG, sw-KE, zh-TW) which is the dataset's whole
point — so the file code (e.g. ``fr_CA``) is passed through explicitly and
the project label code (e.g. ``fra``) only names the built corpus.

Loud-failure policy: this adapter never guesses and never silently
substitutes. A missing file, an empty pair, or a built pair whose size no
longer matches the card all raise — a wrong corpus must never masquerade as
the pinned one. Immutability comes from the commit ``revision`` pin.

WMT24++ is Apache-2.0 (Deutsch et al., 2025;
https://huggingface.co/datasets/google/wmt24pp).
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
# Constants — the SSOT for the WMT24++ upstream
# ---------------------------------------------------------------------------

DEFAULT_REPO = "google/wmt24pp"
#: Immutable commit pin — the integrity anchor (HF content-addresses a repo
#: by commit, so resolve/{revision}/<file> is byte-frozen). A card may
#: override it with download.revision if a newer release is pinned.
DEFAULT_REVISION = "e65f5856b1de3319c748c15e5aec0bc2336ec3b0"
#: Per-target file: en-{code}.jsonl (English source → regional target code).
_MEMBER_PATTERN = "en-{code}.jsonl"
DOMAIN = "mixed"

USER_AGENT = "champollion-corpus-builder (+https://champollion.dev)"

#: Source side is always English in WMT24++.
SOURCE_LANG = "eng"

# The 55 WMT24++ target file codes ({lang}_{REGION}). Kept self-contained so
# the builder works distributed without the monorepo's code-bridge.json. The
# project label code (the language_pair the card declares) is resolved by the
# card/registry, NOT here — this adapter is given the file code directly,
# because regional variants (fr_CA + fr_FR both → project fra) collide on the
# label and only the file code disambiguates which file to fetch.
WMT24PP_TARGET_CODES = (
    "ar_EG", "ar_SA", "bg_BG", "bn_IN", "ca_ES", "cs_CZ", "da_DK", "de_DE",
    "el_GR", "es_MX", "et_EE", "fa_IR", "fi_FI", "fil_PH", "fr_CA", "fr_FR",
    "gu_IN", "he_IL", "hi_IN", "hr_HR", "hu_HU", "id_ID", "is_IS", "it_IT",
    "ja_JP", "kn_IN", "ko_KR", "lt_LT", "lv_LV", "ml_IN", "mr_IN", "nl_NL",
    "no_NO", "pa_IN", "pl_PL", "pt_BR", "pt_PT", "ro_RO", "ru_RU", "sk_SK",
    "sl_SI", "sr_RS", "sv_SE", "sw_KE", "sw_TZ", "ta_IN", "te_IN", "th_TH",
    "tr_TR", "uk_UA", "ur_PK", "vi_VN", "zh_CN", "zh_TW", "zu_ZA",
)


# ---------------------------------------------------------------------------
# Download + parse
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


def download_target_file(
    cache_dir: Path,
    target_code: str,
    *,
    revision: str | None = None,
    repo_url: str | None = None,
    file_sha256: str | None = None,
) -> Path:
    """Download (and cache) one ``en-{code}.jsonl`` from the pinned revision.

    The commit ``revision`` makes the fetched bytes immutable; an optional
    ``file_sha256`` adds a second, per-file integrity check. A cached file
    that still matches its sha is reused; a fresh download that fails sha
    verification raises rather than serving drifted bytes.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    member = _MEMBER_PATTERN.format(code=target_code)
    rev = revision or DEFAULT_REVISION
    repo = _repo_id(repo_url)
    local = cache_dir / f"{rev}__{member}"

    if local.exists():
        if not file_sha256 or _sha256_file(local) == file_sha256:
            return local
        logger.warning("Cached WMT24++ %s failed sha verification — "
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
                f"WMT24++ has no target file '{member}' at revision {rev} "
                f"(repo {repo}). Known target codes: {list(WMT24PP_TARGET_CODES)}."
            )
        raise

    if file_sha256:
        actual = _sha256_bytes(data)
        if actual != file_sha256:
            raise ValueError(
                f"WMT24++ {member} sha mismatch:\n  Expected: {file_sha256}\n"
                f"  Got:      {actual}\n  Upstream {url} may have changed — "
                f"re-pin the card."
            )
    local.write_bytes(data)
    return local


def _is_bad(row: dict) -> bool:
    """True when a row is flagged unusable (canary or bad source).

    The field is a JSON boolean, but a defensive str() check also catches a
    stringified "true"/"True" if a future release changes the encoding.
    """
    val = row.get("is_bad_source")
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ("true", "1", "yes")


def build_pair(path: Path) -> list[tuple[str, str]]:
    """Return aligned ``[(english_source, post_edited_target), ...]``.

    Drops ``is_bad_source`` rows (canary + flagged), uses the ``target``
    post-edit (NOT ``original_target``, the raw MT), and skips rows with an
    empty source or target.
    """
    pairs: list[tuple[str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        if _is_bad(row):
            continue
        src = (row.get("source") or "").strip()
        tgt = (row.get("target") or "").strip()
        if not src or not tgt:
            continue
        pairs.append((src, tgt))
    return pairs


# ---------------------------------------------------------------------------
# Harness fetch-on-miss entry point
# ---------------------------------------------------------------------------

def build_corpus_file(
    dest: Path,
    *,
    source_lang: str,
    target_lang: str,
    target_code: str,
    cache_dir: Path,
    revision: str | None = None,
    repo_url: str | None = None,
    file_sha256: str | None = None,
    expected_size: int | None = None,
    auto_yes: bool = False,
) -> Path:
    """Rebuild one WMT24++ eval corpus into ``dest`` (harness-json).

    ``source_lang`` must be 'eng' (WMT24++ is English-source only).
    ``target_lang`` is the project label code (e.g. 'fra'); ``target_code``
    is the WMT24++ file code (e.g. 'fr_CA') that disambiguates which file to
    fetch — regional variants collide on the project label, so the file code
    is authoritative. ``expected_size``, when given, is enforced.
    """
    if source_lang != SOURCE_LANG:
        raise ValueError(
            f"WMT24++ is English-source only; got source_lang='{source_lang}'. "
            f"Only eng→xx pairs exist."
        )
    if target_code not in WMT24PP_TARGET_CODES:
        # Idempotent: accept a bare code that is already a valid file code.
        raise ValueError(
            f"No WMT24++ target file code '{target_code}'. Known codes: "
            f"{list(WMT24PP_TARGET_CODES)}."
        )

    path = download_target_file(
        cache_dir, target_code,
        revision=revision, repo_url=repo_url, file_sha256=file_sha256,
    )
    pairs = build_pair(path)
    if not pairs:
        raise ValueError(
            f"WMT24++ {source_lang}→{target_lang} ({target_code}): no usable "
            f"rows after dropping is_bad_source — upstream data may have changed."
        )

    if expected_size is not None and len(pairs) != expected_size:
        raise ValueError(
            f"WMT24++ {source_lang}→{target_lang} ({target_code}): rebuilt pair "
            f"has {len(pairs)} sentences but the card declares {expected_size}. "
            f"Upstream WMT24++ data may have changed since the card was pinned — "
            f"re-pin the card (size/revision) before serving it."
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
        "source_dataset": f"wmt24pp-{target_code}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built WMT24++ corpus %s→%s (%s, %d entries) at %s",
        source_lang, target_lang, target_code, len(entries), dest,
    )
    return dest
