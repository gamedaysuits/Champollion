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
ALT (Asian Language Treebank) parallel-corpus fetch-from-source builder.

Single home for everything needed to rebuild an ALT eval corpus from
upstream:

  * the public ALT parallel-corpus archive URL (CC-BY-4.0, no auth),
  * the per-segment URL-split definition files (URL-{segment}.txt),
  * the project ISO 639-3 ↔ ALT file-code map,
  * the download / archive-sha verification of the corpus zip and the
    split-definition file, and
  * the news-sentence alignment that turns the line-aligned multi-way set
    into any ordered (source, target) pair, aligned on the shared SNT id and
    filtered to one URL split (the ALT-Standard test/dev split).

Both the registry fetch-on-miss path (``mt_eval_harness.corpus_fetch``) and
this package's tests import from here, so the download/alignment logic has
exactly one definition.

Loud-failure policy: this adapter never guesses and never silently
substitutes. An unknown language code, a missing file, an empty pair, an
archive (or split file) whose sha no longer matches the pin, or a built pair
whose size no longer matches the card all raise — a wrong corpus must never
masquerade as the pinned one.

ALT is a multi-way parallel news-text evaluation corpus built by NICT from
English Wikinews articles, then human-translated into a set of Asian
languages (Riza et al., 2016; http://www2.nict.go.jp/astrec-att/member/
mutiyama/ALT/). The bare parallel corpus is CC-BY-4.0, "news" domain.

ALT legacy-code caution: ALT files use the legacy code ``bg`` for **Bengali**
(not Bulgarian) and ship a tokenized-English ``en_tok`` that this adapter
never uses (only the natural-text ``en`` is mapped).
"""

from __future__ import annotations

import hashlib
import json
import logging
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — the SSOT for the ALT upstream
# ---------------------------------------------------------------------------

ALT_BASE_URL = "https://www2.nict.go.jp/astrec-att/member/mutiyama/ALT/"
ARCHIVE_URL = ALT_BASE_URL + "ALT-Parallel-Corpus-20191206.zip"
ARCHIVE_NAME = "ALT-Parallel-Corpus-20191206.zip"
#: Inside the zip every language file lives at this path. ``{code}`` is the
#: ALT file code (see ALT_CODE_MAP), e.g. data_en.txt, data_my.txt.
_MEMBER_PATTERN = "ALT-Parallel-Corpus-20191206/data_{code}.txt"
#: The split-definition files live next to the archive on the same host.
_SPLIT_PATTERN = "URL-{segment}.txt"
DOMAIN = "news"

#: Identifying agent so the upstream maintainers can attribute the traffic
#: (founder directive: always make Champollion's corpus pulls attributable).
USER_AGENT = "champollion-corpus-builder (+https://champollion.dev)"

# Project ISO 639-3 (the codes the cards/registry use) → ALT file code (the
# ``{code}`` in data_{code}.txt). This is the SSOT for this adapter and is
# kept self-contained so the builder works when distributed without the
# monorepo's code bridge.
#
# NOTE the two ALT-specific gotchas baked into this map:
#   * 'ben' (Bengali) → 'bg'  — ALT's legacy code 'bg' is Bengali, not
#     Bulgarian. There is no Bulgarian in ALT.
#   * 'eng' → 'en'            — the natural-text English. The tokenized
#     'en_tok' member is deliberately NOT mapped and never used.
ALT_CODE_MAP = {
    "eng": "en",
    "fil": "fil",
    "ind": "id",
    "khm": "khm",
    "lao": "lo",
    "zsm": "ms",
    "mya": "my",
    "tha": "th",
    "vie": "vi",
    "ben": "bg",
    "cmn": "zh",
    "jpn": "ja",
    "hin": "hi",
}


def iso3_to_alt(code: str) -> str:
    """Map a project ISO 639-3 code to its ALT file code.

    Accepts an already-ALT file code too (idempotent). Raises — never
    guesses — when the code isn't in the map, so a typo can't fetch the
    wrong file.
    """
    if code in ALT_CODE_MAP:
        return ALT_CODE_MAP[code]
    if code in ALT_CODE_MAP.values():
        return code
    raise ValueError(
        f"No ALT file code for language '{code}'. Known project codes: "
        f"{sorted(ALT_CODE_MAP)}. If ALT carries this language, add it to "
        f"ALT_CODE_MAP. (Reminder: ALT's 'bg' is Bengali, not Bulgarian.)"
    )


# ---------------------------------------------------------------------------
# Download + parse
# ---------------------------------------------------------------------------

def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _fetch(url: str) -> bytes:
    """Download ``url`` with the attributable User-Agent header."""
    logger.info("Downloading %s", url)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read()


def download_archive(cache_dir: Path, archive_sha256: str | None = None) -> Path:
    """Download (and cache) the ALT parallel-corpus zip, verifying its sha.

    A cached archive that still matches ``archive_sha256`` is reused. A
    cached archive that fails verification is re-downloaded once. A fresh
    download that fails verification raises rather than serving an archive
    that no longer matches the pin.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    archive = cache_dir / ARCHIVE_NAME

    if archive.exists():
        if not archive_sha256 or _sha256_file(archive) == archive_sha256:
            return archive
        logger.warning("Cached ALT archive failed sha verification — "
                       "re-downloading")

    data = _fetch(ARCHIVE_URL)

    if archive_sha256:
        actual = hashlib.sha256(data).hexdigest()
        if actual != archive_sha256:
            raise ValueError(
                f"ALT archive sha mismatch:\n  Expected: {archive_sha256}\n"
                f"  Got:      {actual}\n  Upstream {ARCHIVE_URL} may have "
                f"changed since the card was pinned — re-verify the card's "
                f"download.sha256."
            )
    archive.write_bytes(data)
    return archive


def download_split_file(
    cache_dir: Path,
    segment: str,
    url_split_sha256: str | None = None,
) -> Path:
    """Download (and cache) the URL-{segment}.txt split-definition file.

    Same cache/verify/re-download-once policy as ``download_archive``:
    a cached file matching the pin is reused, a stale cached file is
    re-downloaded once, and a fresh download that fails verification raises.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    name = _SPLIT_PATTERN.format(segment=segment)
    split = cache_dir / name

    if split.exists():
        if not url_split_sha256 or _sha256_file(split) == url_split_sha256:
            return split
        logger.warning("Cached ALT split file %s failed sha verification — "
                       "re-downloading", name)

    data = _fetch(ALT_BASE_URL + name)

    if url_split_sha256:
        actual = hashlib.sha256(data).hexdigest()
        if actual != url_split_sha256:
            raise ValueError(
                f"ALT split file {name} sha mismatch:\n"
                f"  Expected: {url_split_sha256}\n  Got:      {actual}\n"
                f"  Upstream {ALT_BASE_URL + name} may have changed since the "
                f"card was pinned — re-verify the card's split sha256."
            )
    split.write_bytes(data)
    return split


def parse_split_urlids(split: Path) -> set[str]:
    """Read URL-{segment}.txt → the set of urlids in that split.

    Each line is ``URL.{urlid}\\t{url}``; we keep the ``{urlid}`` component.
    Blank lines and malformed lines (no tab / no ``URL.`` prefix) are skipped.
    """
    urlids: set[str] = set()
    for line in split.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        key = line.split("\t", 1)[0]
        if not key.startswith("URL."):
            continue
        urlids.add(key[len("URL."):])
    return urlids


def _read_data(zf: zipfile.ZipFile, file_code: str) -> dict[str, str]:
    """Read one ALT data_{code}.txt → ``{sntid: text}``.

    Each line is ``SNT.{urlid}.{sentid}\\t{text}`` with a trailing ``\\r``
    (the archive uses CRLF-ish line endings). The SNT id is the full
    ``SNT.{urlid}.{sentid}``. Lines with an empty id or empty text, and lines
    without a tab, are dropped. Insertion order follows the file (all language
    files share the same SNT order, so this is stable across languages).
    """
    member = _MEMBER_PATTERN.format(code=file_code)
    try:
        raw = zf.read(member).decode("utf-8")
    except KeyError:
        raise FileNotFoundError(
            f"ALT archive has no member '{member}'. Available members may "
            f"have changed upstream; re-pin the card."
        )
    out: dict[str, str] = {}
    for line in raw.splitlines():
        if "\t" not in line:
            continue
        sntid, text = line.split("\t", 1)
        sntid = sntid.strip()
        text = text.strip()  # strips the trailing \r and surrounding space
        if not sntid or not text:
            continue
        # Keep the first occurrence of any SNT id (defensive against dups).
        out.setdefault(sntid, text)
    return out


def _urlid_of(sntid: str) -> str | None:
    """Extract the urlid (middle component) from ``SNT.{urlid}.{sentid}``.

    Returns ``None`` for ids that don't have that three-part shape.
    """
    parts = sntid.split(".")
    if len(parts) != 3 or parts[0] != "SNT":
        return None
    return parts[1]


def build_pair(
    archive: Path,
    split: Path,
    *,
    source_lang: str,
    target_lang: str,
) -> list[tuple[str, str]]:
    """Return aligned ``[(source_text, target_text), ...]`` for a pair.

    The corpus is line-aligned and shares SNT ids across every language file,
    so alignment is a straight join on the shared SNT id (no English pivot
    needed). Only sentences whose urlid is in the split (the test/dev set)
    are kept, in source-file order. Pairs where either side is empty (or
    where the target lacks the id) are dropped.
    """
    src_code = iso3_to_alt(source_lang)
    tgt_code = iso3_to_alt(target_lang)
    split_urlids = parse_split_urlids(split)

    with zipfile.ZipFile(archive) as zf:
        src = _read_data(zf, src_code)
        tgt = _read_data(zf, tgt_code)

    pairs: list[tuple[str, str]] = []
    for sntid, src_text in src.items():
        urlid = _urlid_of(sntid)
        if urlid is None or urlid not in split_urlids:
            continue
        tgt_text = tgt.get(sntid)
        if not tgt_text or not src_text:
            continue
        pairs.append((src_text, tgt_text))
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
    segment: str = "test",
    archive_sha256: str | None = None,
    url_split_sha256: str | None = None,
    expected_size: int | None = None,
    auto_yes: bool = False,
) -> Path:
    """Rebuild one ALT eval corpus into ``dest`` (harness-json).

    ``source_lang``/``target_lang`` are project ISO 639-3 codes (from the
    registry entry's ``language_pair``). ``segment`` selects the ALT-Standard
    split (``test`` or ``dev``). ``expected_size``, when given (the card's
    declared size), is enforced: a built pair of a different size raises
    rather than serving data that no longer matches the pinned card.
    """
    archive = download_archive(cache_dir, archive_sha256)
    split = download_split_file(cache_dir, segment, url_split_sha256)
    pairs = build_pair(
        archive,
        split,
        source_lang=source_lang,
        target_lang=target_lang,
    )
    if not pairs:
        raise ValueError(
            f"ALT {source_lang}→{target_lang} ({segment}): no aligned "
            f"sentences. The pair shares no in-split SNT ids across its data "
            f"files — upstream data or the split file may have changed."
        )

    if expected_size is not None and len(pairs) != expected_size:
        raise ValueError(
            f"ALT {source_lang}→{target_lang}: rebuilt pair has "
            f"{len(pairs)} sentences but the card declares {expected_size}. "
            f"Upstream ALT data may have changed since the card was pinned — "
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
        "domain": DOMAIN,
        "source_dataset": f"alt-{segment}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built ALT corpus %s→%s (%d entries) at %s",
        source_lang, target_lang, len(entries), dest,
    )
    return dest
