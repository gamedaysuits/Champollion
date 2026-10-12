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
OPUS-Tatoeba adapter — deterministic dev-corpus builds from the per-pair
moses archives of a pinned OPUS-Tatoeba release.

Why this exists (vs. ``tatoeba_challenge_adapter``)
---------------------------------------------------
The Tatoeba *Challenge* devtest tar (``tatoeba_challenge_adapter``) only
carries the pairs the Challenge selected — overwhelmingly ``*-eng`` and a
handful of high-resource non-English combos. Many clean, low-contamination
bilingual bridges that exist in Tatoeba are simply absent from that tar
(e.g. ``spa→que``, ``eng→zsm``). OPUS publishes the *full* Tatoeba sentence
database as one **versioned, immutable, per-pair** moses archive::

    https://object.pouta.csc.fi/OPUS-Tatoeba/v2023-04-12/moses/{l1}-{l2}.txt.zip

One small zip per pair (CC-BY 2.0), each independently sha-pinnable. This is
the same fetch-from-source doctrine the rest of the registry uses: Champollion
never rehosts the data — the card pins the URL, the archive sha256, and the
extraction recipe, and the harness rebuilds the corpus locally on demand.

Determinism contract
--------------------
``build_corpus_file()`` must be byte-reproducible from (archive, recipe). The
upstream OPUS release is frozen and versioned; the build pipeline is the
standard corpora-builder one (rows → length filter → domain/difficulty/register
enrichment → seeded stratified sampling) with every free parameter pinned in
the recipe. The card pins both the upstream zip's sha256 (``archive_sha256``,
verified on download) and the built corpus's sha256 (verified by the harness
after every rebuild). If enrichment heuristics change in a future builder
release, rebuilds hash differently: bump the corpus version and re-pin.

Loud-failure policy: an unknown language code, a missing pair (404), an empty
split, or an archive sha mismatch all raise — a wrong corpus must never
masquerade as the pinned one.
"""

from __future__ import annotations

import hashlib
import io
import logging
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

from mt_eval_harness.corpus_build import USER_AGENT, __version__
from mt_eval_harness.corpus_build.adapters.base import RawEntry
from mt_eval_harness.corpus_build.adapters.tatoeba_adapter import _normalise_lang
from mt_eval_harness.corpus_build.schema import Corpus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pinned release constants
# ---------------------------------------------------------------------------

#: OPUS-Tatoeba release used for all OPUS-sourced Tatoeba bridges.
OPUS_VERSION = "v2023-04-12"

#: Per-pair moses archive base. The file name is the alphabetically-ordered
#: OPUS code pair (``da-fo``, ``es-qu`` …); each side lives in
#: ``Tatoeba.{l1}-{l2}.{code}`` members inside the zip.
OPUS_BASE_URL = (
    f"https://object.pouta.csc.fi/OPUS-Tatoeba/{OPUS_VERSION}/moses"
)

#: ISO 639-3 (project convention) → OPUS-Tatoeba file code. EVERY entry here
#: was verified by an actual download probe against ``OPUS_VERSION`` on
#: 2026-06-22 — OPUS uses ISO 639-1 where one exists and the ISO 639-3 code
#: otherwise, and the convention is NOT uniform across OPUS corpora (Tatoeba
#: uses ``zsm`` for Standard Malay where GlobalVoices uses ``ms``), so the map
#: is empirical, not derived. ``iso3_to_opus`` raises on anything unlisted —
#: it never guesses, so a typo can't silently fetch the wrong file. Add a
#: language only after confirming its moses archive exists upstream.
TATOEBA_OPUS_CODE_MAP: dict[str, str] = {
    "eng": "en", "spa": "es", "fra": "fr", "ita": "it", "rus": "ru",
    "amh": "am", "arb": "ar", "guj": "gu", "haw": "haw", "kan": "kn",
    "lao": "lo", "pag": "pag", "pan": "pa", "sin": "si", "sme": "se",
    "sna": "sn", "tir": "ti", "xho": "xh", "yor": "yo", "zsm": "zsm",
    "zul": "zu", "eus": "eu", "ltz": "lb", "uzb": "uz", "que": "qu",
    # Verified codes for languages whose *requested* pair OPUS can't serve at
    # the floor — present so the restorer can probe and report accurately
    # rather than guess (dan-fao/lug/hil/ibo/mlt: pair too small; hau: en-ha
    # exists but the requested fra-hau pair does not).
    "dan": "da", "fao": "fo", "hau": "ha", "lug": "lg", "hil": "hil",
    "ibo": "ig", "mlt": "mt",
}

#: Reverse map (OPUS → ISO 639-3), asserted 1:1 so a duplicate can't silently
#: shadow another at import time.
_OPUS_TO_ISO3: dict[str, str] = {}
for _iso3, _opus in TATOEBA_OPUS_CODE_MAP.items():
    if _opus in _OPUS_TO_ISO3:
        raise RuntimeError(
            f"TATOEBA_OPUS_CODE_MAP is not 1:1 — OPUS code '{_opus}' maps from "
            f"both '{_OPUS_TO_ISO3[_opus]}' and '{_iso3}'. Fix the map."
        )
    _OPUS_TO_ISO3[_opus] = _iso3


#: Default extraction recipe. A card ``source.recipe`` may override any field;
#: ``created`` is part of the recipe because the corpus header embeds it and
#: builds must be byte-reproducible. ``length_unit`` selects the entry-length
#: filter ("words" vs "chars"); the build falls back to "chars" automatically
#: when the word window rejects everything (CJK/space-less source languages).
DEFAULT_RECIPE: dict[str, Any] = {
    "release": OPUS_VERSION,
    "split": "all",
    "seed": 42,
    "max_entries": 200,
    "length_unit": "words",
    "min_words": 3,
    "max_words": 50,
    "min_chars": 8,
    "max_chars": 250,
    "variety_filter": None,
    "created": "2026-06-22T00:00:00+00:00",
    "builder_version": __version__,
}


def iso3_to_opus(code: str) -> str:
    """Map a project ISO 639-3 code to its OPUS-Tatoeba file code.

    Accepts an already-OPUS code too (idempotent). Raises — never guesses —
    when the code isn't in the verified bridge.
    """
    if code in TATOEBA_OPUS_CODE_MAP:
        return TATOEBA_OPUS_CODE_MAP[code]
    if code in _OPUS_TO_ISO3:
        return code
    raise ValueError(
        f"No verified OPUS-Tatoeba code for language '{code}'. Known project "
        f"codes: {sorted(TATOEBA_OPUS_CODE_MAP)}. If OPUS-Tatoeba "
        f"{OPUS_VERSION} carries this language, probe the archive and add it "
        f"to TATOEBA_OPUS_CODE_MAP."
    )


def pair_url(source_lang: str, target_lang: str) -> str:
    """The OPUS moses archive URL for a pair (alphabetical, OPUS codes)."""
    a, b = iso3_to_opus(source_lang), iso3_to_opus(target_lang)
    return f"{OPUS_BASE_URL}/{min(a, b)}-{max(a, b)}.txt.zip"


# ---------------------------------------------------------------------------
# Download + parse
# ---------------------------------------------------------------------------

def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _fetch_pair_zip(
    source_lang: str,
    target_lang: str,
    cache_dir: Path,
    *,
    archive_sha256: str | None = None,
) -> bytes:
    """Return the raw bytes of the pair's moses zip, caching under ``cache_dir``.

    Verifies ``archive_sha256`` (when given) both on cache hit and after
    download, so a corrupted or upstream-changed archive can never feed a
    build silently. Raises ``FileNotFoundError`` on a 404 (pair absent); other
    HTTP/network errors propagate loudly rather than being treated as "absent".
    """
    a, b = iso3_to_opus(source_lang), iso3_to_opus(target_lang)
    fname = f"{min(a, b)}-{max(a, b)}.txt.zip"
    cache_dir = Path(cache_dir)
    cached = cache_dir / fname

    if cached.exists():
        data = cached.read_bytes()
        if archive_sha256 and _sha256_bytes(data) != archive_sha256:
            logger.warning(
                "Cached %s fails sha256 verification — re-downloading", fname,
            )
            cached.unlink()
        else:
            return data

    url = f"{OPUS_BASE_URL}/{fname}"
    logger.info("Downloading %s", url)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise FileNotFoundError(
                f"OPUS-Tatoeba {OPUS_VERSION} has no pair "
                f"{source_lang}-{target_lang} ({a}-{b}). Checked {url}."
            ) from exc
        raise  # 5xx / auth / etc. — loud, not "absent"

    if archive_sha256:
        actual = _sha256_bytes(data)
        if actual != archive_sha256:
            raise ValueError(
                f"OPUS-Tatoeba archive sha256 mismatch for "
                f"{source_lang}-{target_lang}:\n  Expected: {archive_sha256}\n"
                f"  Got:      {actual}\n  The upstream object may have changed "
                f"— re-audit the release pin before rebuilding."
            )

    cache_dir.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(data)
    return data


def read_moses_pair(
    zip_data: bytes,
    source_lang: str,
    target_lang: str,
) -> tuple[list[str], list[str]]:
    """Extract one pair's parallel lines, oriented source→target.

    The zip stores each side as ``Tatoeba.{l1}-{l2}.{code}`` in OPUS codes.
    Lines are stripped, blanks dropped, and the two sides aligned to the
    shorter length (a ragged tail would misalign every pair). Returns
    ``(source_lines, target_lines)`` in the requested project direction.
    """
    src_opus = iso3_to_opus(source_lang)
    tgt_opus = iso3_to_opus(target_lang)
    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        names = [n for n in zf.namelist()
                 if n.startswith("Tatoeba.") and not n.endswith(".xml")]
        src_match = [n for n in names if n.endswith(f".{src_opus}")]
        tgt_match = [n for n in names if n.endswith(f".{tgt_opus}")]
        if not src_match or not tgt_match:
            raise ValueError(
                f"OPUS-Tatoeba zip for {source_lang}-{target_lang} is missing "
                f"a side: members={names}. Expected files ending "
                f"'.{src_opus}' and '.{tgt_opus}'."
            )
        src_text = zf.read(src_match[0]).decode("utf-8")
        tgt_text = zf.read(tgt_match[0]).decode("utf-8")

    src_lines = [l.strip() for l in src_text.strip().split("\n") if l.strip()]
    tgt_lines = [l.strip() for l in tgt_text.strip().split("\n") if l.strip()]
    n = min(len(src_lines), len(tgt_lines))
    return src_lines[:n], tgt_lines[:n]


def pairs_to_raw_entries(
    src_lines: list[str],
    tgt_lines: list[str],
    source_lang: str,
    target_lang: str,
) -> list[RawEntry]:
    """Build deterministic RawEntries from aligned moses lines.

    Drops empty/identical pairs and exact duplicates (first-seen order
    preserved). Entry IDs are content hashes (``hash_<sha256[:12]>``) so they
    are stable across rebuilds — OPUS moses files carry no sentence IDs.
    """
    want_src = _normalise_lang(source_lang)
    want_trg = _normalise_lang(target_lang)

    entries: list[RawEntry] = []
    seen: set[tuple[str, str]] = set()
    for src_text, trg_text in zip(src_lines, tgt_lines):
        if not src_text or not trg_text or src_text == trg_text:
            continue
        key = (src_text, trg_text)
        if key in seen:
            continue
        seen.add(key)
        content_hash = hashlib.sha256(
            f"{src_text}|{trg_text}".encode("utf-8")
        ).hexdigest()[:12]
        entries.append(RawEntry(
            source_text=src_text,
            target_text=trg_text,
            source_id=f"hash_{content_hash}",
            metadata={
                "source_lang": want_src,
                "target_lang": want_trg,
                "license": "CC-BY-2.0",
                "url": f"{OPUS_BASE_URL}/"
                       f"{min(iso3_to_opus(source_lang), iso3_to_opus(target_lang))}-"
                       f"{max(iso3_to_opus(source_lang), iso3_to_opus(target_lang))}.txt.zip",
            },
        ))

    if not entries:
        raise ValueError(
            f"No usable parallel rows for {want_src}→{want_trg} after "
            f"dropping empty/identical/duplicate pairs."
        )
    return entries


# ---------------------------------------------------------------------------
# One-call deterministic build (harness fetch-on-miss entry point)
# ---------------------------------------------------------------------------

def build_corpus_file(
    dest: Path,
    *,
    source_lang: str,
    target_lang: str,
    cache_dir: Path,
    recipe: dict[str, Any] | None = None,
    archive_sha256: str | None = None,
    expected_size: int | None = None,
    auto_yes: bool = False,  # accepted for interface parity; download is gated
                             # by the harness fetch wrapper before we run.
) -> Path:
    """Build one direction's dev corpus from the pinned OPUS-Tatoeba release.

    Mirrors ``tatoeba_challenge_adapter.build_corpus_file``: the build pipeline
    is the standard corpora-builder one (rows → length filter → enrichment →
    seeded stratified sampling) with every free parameter taken from
    ``recipe`` so rebuilds are byte-identical. The only difference is the row
    SOURCE — a per-pair OPUS moses zip rather than the consolidated Challenge
    tar member.
    """
    from mt_eval_harness.corpus_build.sampling import (
        _enrich_entry,
        _filter_by_word_count,
        _stratified_sample,
    )
    import random

    full_recipe = {**DEFAULT_RECIPE, **(recipe or {})}

    zip_data = _fetch_pair_zip(
        source_lang, target_lang, Path(cache_dir),
        archive_sha256=archive_sha256,
    )
    src_lines, tgt_lines = read_moses_pair(zip_data, source_lang, target_lang)
    raw_entries = pairs_to_raw_entries(
        src_lines, tgt_lines, source_lang, target_lang,
    )

    length_unit = full_recipe.get("length_unit", "words")
    if length_unit == "words":
        filtered = _filter_by_word_count(
            raw_entries,
            int(full_recipe["min_words"]),
            int(full_recipe["max_words"]),
        )
        window = (f"{full_recipe['min_words']}–{full_recipe['max_words']} "
                  f"source word-count window")
    elif length_unit == "chars":
        lo, hi = int(full_recipe["min_chars"]), int(full_recipe["max_chars"])
        filtered = [e for e in raw_entries
                    if lo <= len(e.source_text) <= hi]
        window = f"{lo}–{hi} source character window"
    else:
        raise ValueError(
            f"Unknown recipe length_unit '{length_unit}' "
            f"(expected 'words' or 'chars')."
        )
    if not filtered:
        raise ValueError(
            f"All {len(raw_entries)} entries for {source_lang}→{target_lang} "
            f"fell outside the {window}."
        )

    enriched = [_enrich_entry(raw, "tatoeba_opus") for raw in filtered]

    rng = random.Random(int(full_recipe["seed"]))
    sampled = _stratified_sample(
        enriched, int(full_recipe["max_entries"]), rng,
    )

    if expected_size is not None and len(sampled) != expected_size:
        raise ValueError(
            f"OPUS-Tatoeba {source_lang}-{target_lang}: rebuilt corpus has "
            f"{len(sampled)} entries but the card declares {expected_size}. "
            f"Upstream OPUS data or the recipe may have changed — re-pin the "
            f"card (size + sha256) before serving this corpus."
        )

    corpus = Corpus(
        corpus_id=f"tatoeba-{_normalise_lang(source_lang)}-"
                  f"{_normalise_lang(target_lang)}-dev",
        version=str(full_recipe["builder_version"]),
        language_pair={
            "source": _normalise_lang(source_lang),
            "target": _normalise_lang(target_lang),
        },
        segment="development",
        created=str(full_recipe["created"]),
        entry_count=len(sampled),
        domains=sorted({e.domain for e in sampled}),
        entries=sampled,
        provenance={
            "builder": "champollion-corpora-builder",
            "builder_version": str(full_recipe["builder_version"]),
            "source_adapter": "tatoeba_opus",
            "release": str(full_recipe["release"]),
            "split": str(full_recipe["split"]),
            "source_export_url": pair_url(source_lang, target_lang),
            "seed": int(full_recipe["seed"]),
            "length_unit": length_unit,
            "min_words": int(full_recipe["min_words"]),
            "max_words": int(full_recipe["max_words"]),
            "min_chars": int(full_recipe["min_chars"]),
            "max_chars": int(full_recipe["max_chars"]),
            "variety_filter": full_recipe.get("variety_filter"),
            "max_entries": int(full_recipe["max_entries"]),
            "license": "CC-BY-2.0",
            "source_url": "https://tatoeba.org",
        },
    )

    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    corpus.to_json(dest)
    logger.info(
        "Built OPUS-Tatoeba %s→%s dev corpus: %d entries → %s",
        source_lang, target_lang, len(sampled), dest,
    )
    return dest
