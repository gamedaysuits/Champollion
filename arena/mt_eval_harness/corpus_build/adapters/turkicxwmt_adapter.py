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
Turkic X-WMT (turkic_xwmt) fetch-from-source builder.

Single home for everything needed to rebuild a Turkic X-WMT eval corpus from
upstream:

  * the public Turkic X-WMT test-set archive URL (MIT, no auth), pinned to an
    immutable git commit so the archive is stable,
  * the project ISO 639-3 ↔ Turkic file-code map,
  * the download / archive-sha verification of the test-set zip, and
  * the per-direction alignment that reads the two line-aligned ``.txt`` files
    of a ``{s}-{t}`` pair directory and zips them into ordered (source, target)
    pairs.

Both the registry fetch-on-miss path (``mt_eval_harness.corpus_fetch``) and
this package's tests import from here, so the download/alignment logic has
exactly one definition.

Loud-failure policy: this adapter never guesses and never silently
substitutes. An unknown language code, a missing pair directory, a line-count
mismatch between the two files of a pair, an empty pair, an archive whose sha
no longer matches the pin, or a built pair whose size no longer matches the
card all raise — a wrong corpus must never masquerade as the pinned one.

Turkic X-WMT is a human-translated multi-way news evaluation set for the
Turkic languages (Mirzakhalov et al., 2021;
https://github.com/turkic-interlingua/til-mt), MIT, "news" domain. Its
non-English source directions are notably less contaminated than English-pivot
benchmarks, which is the point of carrying it.
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
# Constants — the SSOT for the Turkic X-WMT upstream
# ---------------------------------------------------------------------------

#: Single test-set zip, pinned to an immutable git commit (stable).
DATA_URL = (
    "https://github.com/turkic-interlingua/til-mt/blob/"
    "6ac179350448895a63cc06fcfd1135882c8cc49b/xwmt/test.zip?raw=true"
)
ARCHIVE_NAME = "turkic-xwmt-test.zip"
#: Pair files live at test/{s}-{t}/{s}-{t}.{s}.txt and
#: test/{s}-{t}/{s}-{t}.{t}.txt — one sentence per line, line-aligned.
_DIR_PATTERN = "test/{s}-{t}"
_MEMBER_PATTERN = "test/{s}-{t}/{s}-{t}.{lang}.txt"
DOMAIN = "news"

#: Identifying agent so the upstream maintainers can attribute the traffic
#: (founder directive: always make Champollion's corpus pulls attributable).
USER_AGENT = "champollion-corpus-builder (+https://champollion.dev)"

# Project ISO 639-3 (the codes the cards/registry use) → Turkic X-WMT file
# code (the ``{s}``/``{t}`` in the pair directory and member names). Karakalpak
# (kaa) and Sakha/Yakut (sah) already share their ISO 639-3 with the file code.
# Kept self-contained so the builder works when distributed without the
# monorepo's code bridge.
TURKIC_CODE_MAP = {
    "aze": "az",
    "bak": "ba",
    "eng": "en",
    "kaa": "kaa",
    "kaz": "kk",
    "kir": "ky",
    "rus": "ru",
    "sah": "sah",
    "tur": "tr",
    "uzb": "uz",
}


def iso3_to_turkic(code: str) -> str:
    """Map a project ISO 639-3 code to its Turkic X-WMT file code.

    Accepts an already-Turkic file code too (idempotent). Raises — never
    guesses — when the code isn't in the bridge, so a typo can't fetch the
    wrong file.
    """
    if code in TURKIC_CODE_MAP:
        return TURKIC_CODE_MAP[code]
    if code in TURKIC_CODE_MAP.values():
        return code
    raise ValueError(
        f"No Turkic X-WMT file code for language '{code}'. Known project "
        f"codes: {sorted(TURKIC_CODE_MAP)}. If Turkic X-WMT carries this "
        f"language, add it to TURKIC_CODE_MAP."
    )


# ---------------------------------------------------------------------------
# Download + parse
# ---------------------------------------------------------------------------

def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download_archive(cache_dir: Path, archive_sha256: str | None = None) -> Path:
    """Download (and cache) the Turkic X-WMT test-set zip, verifying its sha.

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
        logger.warning("Cached Turkic X-WMT archive failed sha verification — "
                       "re-downloading")

    logger.info("Downloading %s", DATA_URL)
    req = urllib.request.Request(DATA_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = resp.read()

    if archive_sha256:
        actual = hashlib.sha256(data).hexdigest()
        if actual != archive_sha256:
            raise ValueError(
                f"Turkic X-WMT archive sha mismatch:\n  Expected: "
                f"{archive_sha256}\n  Got:      {actual}\n  Upstream {DATA_URL} "
                f"may have changed since the card was pinned — re-verify the "
                f"card's download.sha256."
            )
    archive.write_bytes(data)
    return archive


def _read_lines(zf: zipfile.ZipFile, member: str) -> list[str]:
    """Read one Turkic X-WMT ``.txt`` member → a list of raw lines.

    Raises ``FileNotFoundError`` naming the missing member when it is absent,
    so a missing pair direction fails loudly instead of yielding an empty set.
    """
    try:
        raw = zf.read(member).decode("utf-8")
    except KeyError:
        raise FileNotFoundError(
            f"Turkic X-WMT archive has no member '{member}'. The requested "
            f"pair direction may not exist in the set, or the archive layout "
            f"changed upstream; re-pin the card."
        )
    # Splitlines drops the trailing newline; keep every line (incl. blanks)
    # so the source/target line counts can be compared before stripping.
    return raw.splitlines()


def build_pair(
    archive: Path,
    *,
    source_lang: str,
    target_lang: str,
) -> list[tuple[str, str]]:
    """Return aligned ``[(source_text, target_text), ...]`` for a pair.

    Maps both codes to Turkic file codes, locates ``test/{s}-{t}/``, reads the
    two line-aligned ``.txt`` files, asserts equal line counts (raises
    ``ValueError`` on mismatch), zips them, strips, and drops empty rows.
    Raises ``FileNotFoundError`` naming the missing member when the pair
    directory / files are absent.
    """
    s = iso3_to_turkic(source_lang)
    t = iso3_to_turkic(target_lang)

    src_member = _MEMBER_PATTERN.format(s=s, t=t, lang=s)
    tgt_member = _MEMBER_PATTERN.format(s=s, t=t, lang=t)

    with zipfile.ZipFile(archive) as zf:
        src_lines = _read_lines(zf, src_member)
        tgt_lines = _read_lines(zf, tgt_member)

    if len(src_lines) != len(tgt_lines):
        raise ValueError(
            f"Turkic X-WMT {source_lang}→{target_lang} ({s}-{t}): the two "
            f"sides are not line-aligned — {len(src_lines)} source lines vs "
            f"{len(tgt_lines)} target lines. Upstream data may have changed."
        )

    pairs: list[tuple[str, str]] = []
    for src_line, tgt_line in zip(src_lines, tgt_lines):
        src_text, tgt_text = src_line.strip(), tgt_line.strip()
        if not src_text or not tgt_text:
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
    archive_sha256: str | None = None,
    expected_size: int | None = None,
    auto_yes: bool = False,
) -> Path:
    """Rebuild one Turkic X-WMT eval corpus into ``dest`` (harness-json).

    ``source_lang``/``target_lang`` are project ISO 639-3 codes (from the
    registry entry's ``language_pair``). ``expected_size``, when given (the
    card's declared size), is enforced: a built pair of a different size
    raises rather than serving data that no longer matches the pinned card.
    """
    archive = download_archive(cache_dir, archive_sha256)
    pairs = build_pair(
        archive,
        source_lang=source_lang,
        target_lang=target_lang,
    )
    if not pairs:
        raise ValueError(
            f"Turkic X-WMT {source_lang}→{target_lang}: no non-empty aligned "
            f"sentences. Upstream data may have changed."
        )

    if expected_size is not None and len(pairs) != expected_size:
        raise ValueError(
            f"Turkic X-WMT {source_lang}→{target_lang}: rebuilt pair has "
            f"{len(pairs)} sentences but the card declares {expected_size}. "
            f"Upstream Turkic X-WMT data may have changed since the card was "
            f"pinned — re-pin the card (and any sha256) before serving it."
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
        "source_dataset": "turkic-xwmt-test",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built Turkic X-WMT corpus %s→%s (%d entries) at %s",
        source_lang, target_lang, len(entries), dest,
    )
    return dest
