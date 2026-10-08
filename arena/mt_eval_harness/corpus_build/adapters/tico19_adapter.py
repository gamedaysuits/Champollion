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
TICO-19 (Translation Initiative for COVID-19) fetch-from-source builder.

Single home for everything needed to rebuild a TICO-19 eval corpus from
upstream:

  * the public TICO-19 test-set archive URL (CC0, no auth),
  * the project ISO 639-3 ↔ TICO-19 file-code map,
  * the download / archive-sha verification of the test-set zip, and
  * the English-pivot alignment that turns the 36-way parallel set into any
    ordered (source, target) pair, aligned on the shared ``stringID``.

Both the registry fetch-on-miss path (``mt_eval_harness.corpus_fetch``) and
this package's tests import from here, so the download/alignment logic has
exactly one definition.

Loud-failure policy: this adapter never guesses and never silently
substitutes. An unknown language code, a missing file, an empty pair, an
archive whose sha no longer matches the pin, or a built pair whose size no
longer matches the card all raise — a wrong corpus must never masquerade as
the pinned one.

TICO-19 is a multi-way parallel COVID-19 / medical-crisis evaluation corpus
(Anastasopoulos et al., 2020; https://tico-19.github.io/), CC0-1.0, "medical"
domain.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — the SSOT for the TICO-19 upstream
# ---------------------------------------------------------------------------

TICO19_URL = "https://tico-19.github.io/data/tico19-testset.zip"
ARCHIVE_NAME = "tico19-testset.zip"
#: TSV files live at tico19-testset/{segment}/{segment}.en-{code}.tsv with
#: English as the pivot side. The 8 columns are: sourceLang, targetLang,
#: sourceString (English), targetString (the language), stringID, url,
#: license, translator_ID.
_MEMBER_PATTERN = "tico19-testset/{segment}/{segment}.en-{code}.tsv"
DOMAIN = "medical"

#: Identifying agent so the upstream maintainers can attribute the traffic
#: (founder directive: always make Champollion's corpus pulls attributable).
USER_AGENT = "champollion-corpus-builder (+https://champollion.dev)"

# Project ISO 639-3 (the codes the cards/registry use) → TICO-19 file code
# (the ``{code}`` in test.en-{code}.tsv). English is always the "en" pivot
# side and is not a target file, so it is mapped explicitly. This mirrors the
# ``tico19`` section of cli/shared/code-bridge.json but is kept self-contained
# so the builder works when distributed without the monorepo's code bridge.
TICO19_CODE_MAP = {
    "eng": "en",
    "amh": "am", "arb": "ar", "ben": "bn", "ckb": "ckb", "cmn-Hans": "zh",
    "dip": "din", "fra": "fr", "fuv": "fuv", "gaz": "om", "hau": "ha",
    "hin": "hi", "ind": "id", "khm": "km", "kin": "rw", "kmr": "ku",
    "knc": "kr", "lin": "ln", "lug": "lg", "mar": "mr", "mya": "my",
    "npi": "ne", "nus": "nus", "pbt": "ps", "pes": "fa", "por": "pt-BR",
    "prs": "prs", "rus": "ru", "som": "so", "spa": "es-LA", "swh": "sw",
    "tam": "ta", "tgl": "tl", "tir": "ti", "urd": "ur", "zul": "zu",
}


def iso3_to_tico(code: str) -> str:
    """Map a project ISO 639-3 code to its TICO-19 file code.

    Accepts an already-TICO file code too (idempotent). Raises — never
    guesses — when the code isn't in the bridge, so a typo can't fetch the
    wrong file.
    """
    if code in TICO19_CODE_MAP:
        return TICO19_CODE_MAP[code]
    if code in TICO19_CODE_MAP.values():
        return code
    raise ValueError(
        f"No TICO-19 file code for language '{code}'. Known project codes: "
        f"{sorted(TICO19_CODE_MAP)}. If TICO-19 carries this language, add it "
        f"to TICO19_CODE_MAP."
    )


# ---------------------------------------------------------------------------
# Download + parse
# ---------------------------------------------------------------------------

def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download_archive(cache_dir: Path, archive_sha256: str | None = None) -> Path:
    """Download (and cache) the TICO-19 test-set zip, verifying its sha.

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
        logger.warning("Cached TICO-19 archive failed sha verification — "
                       "re-downloading")

    logger.info("Downloading %s", TICO19_URL)
    req = urllib.request.Request(TICO19_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = resp.read()

    if archive_sha256:
        actual = hashlib.sha256(data).hexdigest()
        if actual != archive_sha256:
            raise ValueError(
                f"TICO-19 archive sha mismatch:\n  Expected: {archive_sha256}\n"
                f"  Got:      {actual}\n  Upstream {TICO19_URL} may have changed "
                f"since the card was pinned — re-verify the card's "
                f"download.sha256."
            )
    archive.write_bytes(data)
    return archive


def _read_tsv(zf: zipfile.ZipFile, segment: str, file_code: str) -> dict[str, tuple[str, str]]:
    """Read one TICO-19 TSV → ``{stringID: (english, local)}``.

    Rows with an empty source or target, or fewer than 5 columns, are
    dropped. Insertion order follows the file (the multi-way set is built
    from one English source order, so this is stable across languages).
    """
    member = _MEMBER_PATTERN.format(segment=segment, code=file_code)
    try:
        raw = zf.read(member).decode("utf-8")
    except KeyError:
        raise FileNotFoundError(
            f"TICO-19 archive has no member '{member}'. Available test members "
            f"may have changed upstream; re-pin the card."
        )
    out: dict[str, tuple[str, str]] = {}
    reader = csv.reader(io.StringIO(raw), delimiter="\t")
    rows = list(reader)
    # First row is the header (sourceLang/targetLang/...).
    for row in rows[1:]:
        if len(row) < 5:
            continue
        english, local, string_id = row[2].strip(), row[3].strip(), row[4].strip()
        if not english or not local or not string_id:
            continue
        # Keep the first occurrence of any stringID (defensive against dups).
        out.setdefault(string_id, (english, local))
    return out


def build_pair(
    archive: Path,
    *,
    source_lang: str,
    target_lang: str,
    segment: str,
) -> list[tuple[str, str]]:
    """Return aligned ``[(source_text, target_text), ...]`` for a pair.

    English-pivot logic, aligned on the shared ``stringID``:
      * eng → X : English is the source, X the target (read test.en-X.tsv).
      * X → eng : X is the source, English the target.
      * X → Y   : pivot through English — intersect the two files on stringID
                  and pair X's text with Y's text, in test.en-X.tsv order.
    """
    src_code = iso3_to_tico(source_lang)
    tgt_code = iso3_to_tico(target_lang)

    with zipfile.ZipFile(archive) as zf:
        if source_lang == "eng":
            tgt = _read_tsv(zf, segment, tgt_code)
            return [(en, local) for en, local in tgt.values()]
        if target_lang == "eng":
            src = _read_tsv(zf, segment, src_code)
            return [(local, en) for en, local in src.values()]
        # Both non-English: pivot on stringID.
        src = _read_tsv(zf, segment, src_code)
        tgt = _read_tsv(zf, segment, tgt_code)
        pairs = []
        for string_id, (_en_s, src_text) in src.items():
            tgt_row = tgt.get(string_id)
            if tgt_row is None:
                continue
            pairs.append((src_text, tgt_row[1]))
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
    expected_size: int | None = None,
    auto_yes: bool = False,
) -> Path:
    """Rebuild one TICO-19 eval corpus into ``dest`` (harness-json).

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
        segment=segment,
    )
    if not pairs:
        raise ValueError(
            f"TICO-19 {source_lang}→{target_lang} ({segment}): no aligned "
            f"sentences. The pair shares no stringIDs across its TSV files — "
            f"upstream data may have changed."
        )

    if expected_size is not None and len(pairs) != expected_size:
        raise ValueError(
            f"TICO-19 {source_lang}→{target_lang}: rebuilt pair has "
            f"{len(pairs)} sentences but the card declares {expected_size}. "
            f"Upstream TICO-19 data may have changed since the card was "
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
        "source_dataset": f"tico19-{segment}",
        "entries": entries,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "Built TICO-19 corpus %s→%s (%d entries) at %s",
        source_lang, target_lang, len(entries), dest,
    )
    return dest
