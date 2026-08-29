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
EdTeKLA source adapter for the corpora builder.

EdTeKLA (the Educational Technology, Knowledge, Language, and Learning
Analytics research group, University of Alberta) publishes parallel
Indigenous-language corpora at
https://github.com/EdTeKLA/IndigenousLanguages_Corpora under a
MODIFIED CC BY-NC-SA (sovereignty-scoped: community/academic/educational
uses; the original speaker retains rights — see the repo README; the root
textbook is CC BY-NC-ND 4.0, Okimāsis / U of R Press).

Champollion does NOT host this data. This adapter downloads the two
line-aligned Cree Language Textbook files (English + Plains Cree SRO)
directly from the EdTeKLA repository at a pinned ref, caches them
locally, and deterministically rebuilds the evaluation corpora that the
harness expects:

    raw repo files (589 aligned lines)
      → parse/normalize/filter/dedup        (486 valid pairs)
      → seed-42 stratified holdout split    (436 dev + 50 held-out)
      → harness JSON                        (id / source / reference)

The parsing, normalization, difficulty classification, and split logic
are deterministic ports of the original build scripts:

    crk-translate/data/import_textbook_corpus.py   (parse + normalize)
    crk-translate/eval/split_holdout.py            (seed-42 split)
    crk-translate/eval/scripts/prepare_textbook_dev_corpus.py
                                                   (harness format)

so the rebuilt dev corpus is entry-for-entry identical to the corpus
those scripts produced (verified against
arena/datasets/crk/textbook_dev_436.json).

License: the user must accept EdTeKLA's modified CC BY-NC-SA terms
before any download
(``licensing.confirm_download``; ``auto_yes`` for CI). We never
redistribute the data — only this build script.
"""

from __future__ import annotations

import json
import logging
import random
import re
import unicodedata
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

from mt_eval_harness.corpus_build.licensing import LicenseInfo, confirm_download

from .base import RawEntry, SourceAdapter

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Source location
# ---------------------------------------------------------------------------

EDTEKLA_REPO_URL = "https://github.com/EdTeKLA/IndigenousLanguages_Corpora"

#: Default ref to fetch — PINNED to an immutable commit SHA, NOT a branch.
#: The registry pins a corpus sha256 (the verifier's integrity anchor); that
#: only holds if the fetched bytes are deterministic. A moving ref like
#: "master" would silently shift the corpus — and the held-out test split —
#: the day EdTeKLA pushes any commit, breaking sha verification. This SHA is
#: the master HEAD as of 2026-06-16 (textbook files unchanged upstream since
#: 2020-08-23); rebuilding the dev corpus from it reproduces the registry's
#: pinned sha256 a46394d0…. To intentionally adopt new upstream data, bump
#: this SHA and re-pin the corpus sha256 together (never one without the other).
DEFAULT_REF = "f85a31abc52e1610251e21e6bdd1b5ce9c96c10b"

#: Path of the Cree Language Textbook files inside the repository.
TEXTBOOK_DIR = "PlainsCree/Educational/CreeLanguageTextbook"
EN_FILENAME = "CreeLanguageTextbook_en.txt"
CR_FILENAME = "CreeLanguageTextbook_cr.txt"

EDTEKLA_LICENSE = LicenseInfo(
    source_name="EdTeKLA IndigenousLanguages_Corpora (University of Alberta)",
    license_id="LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    license_url="https://github.com/EdTeKLA/IndigenousLanguages_Corpora#readme",
    source_url=EDTEKLA_REPO_URL,
    download_url="",  # filled per file at download time
)

#: Seed and holdout size used by the original split (split_holdout.py).
SPLIT_SEED = 42
HOLDOUT_SIZE = 50


def raw_file_url(filename: str, ref: str = DEFAULT_REF) -> str:
    """Build the raw.githubusercontent.com URL for a textbook file at a ref."""
    return (
        f"https://raw.githubusercontent.com/EdTeKLA/"
        f"IndigenousLanguages_Corpora/{ref}/{TEXTBOOK_DIR}/{filename}"
    )


# ---------------------------------------------------------------------------
# Text normalization (port of import_textbook_corpus.py)
# ---------------------------------------------------------------------------

def normalize_sro(text: str) -> str:
    """Normalize Cree SRO text to a consistent Unicode form.

    NFC-normalize, collapse whitespace, strip sentence punctuation
    (. ! ? , ; :) — the downstream pipeline compares bare forms.
    Does NOT attempt to add missing diacritics.
    """
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    text = re.sub(r"[.!?,;:]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_english(text: str) -> str:
    """Normalize English text from the corpus.

    The EdTeKLA files use tokenized spacing around punctuation
    ("hello , how are you ?"); this restores conventional spacing and
    capitalizes the first letter.
    """
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\s+([.!?,;:])", r"\1", text)
    text = re.sub(r"\s+'", "'", text)
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    if text:
        text = text[0].upper() + text[1:]
    return text


# ---------------------------------------------------------------------------
# Difficulty classification (port of import_textbook_corpus.py)
# ---------------------------------------------------------------------------

def classify_difficulty(english: str, cree: str) -> int:
    """Classify the difficulty of a translation pair (1-5).

    Heuristic, conservative (defaults to higher difficulty when
    uncertain). Must remain byte-for-byte compatible with the original
    importer so rebuilt corpora match the published ones.
    """
    en_words = english.split()
    cr_words = cree.split()
    en_lower = english.lower().rstrip(".!?")

    multi_clause_markers = [
        "if ", "when ", "while ", "because ", "as it was",
        "before ", "after ", "so that ", "in order to",
        " , we ", " , i ", " , she ", " , he ",
    ]
    if any(marker in en_lower for marker in multi_clause_markers):
        return 5
    if len(en_words) >= 10 and len(cr_words) >= 5:
        return 5

    l4_markers = [
        "this one", "that one", "these ", "those ",
        "his ", "her ", "their ", "its ",
        "who ", "what ", "which ", "how many ", "how much ",
        "apparently ", "used to ",
    ]
    if any(marker in en_lower for marker in l4_markers):
        return 4
    if " ê " in f" {cree} " or cree.startswith("ê "):
        return 4

    l3_markers = [
        "yesterday", "tomorrow", "already", "will ",
        "did ", "was ", "were ", " my ", "your ", "our ",
        "going to ", "intend", "want to ",
    ]
    if en_lower.startswith(("my ", "your ", "our ")):
        return 3
    if any(marker in en_lower for marker in l3_markers):
        return 3
    if en_lower.endswith("?") and len(en_words) >= 4:
        return 3

    if len(en_words) >= 2:
        return 2

    return 1


# ---------------------------------------------------------------------------
# Pair filtering and deduplication (port of import_textbook_corpus.py)
# ---------------------------------------------------------------------------

def is_valid_pair(english: str, cree: str) -> tuple[bool, str]:
    """Check whether a parallel pair is valid. Returns (valid, reason)."""
    if not english or not cree:
        return False, "empty"
    if english.lower() == cree.lower():
        return False, "identical"
    sro_chars = set("âêîô")
    if any(c in sro_chars for c in english.lower()):
        return False, "english_contains_sro"
    if len(english) < 1 or len(cree) < 1:
        return False, "too_short"
    return True, ""


def deduplicate_pairs(pairs: list[dict]) -> list[dict]:
    """Remove exact duplicates, keeping the first occurrence.

    Later duplicates are dropped; their source lines are recorded in the
    surviving entry's ``duplicate_lines`` field (matches the original
    importer's behavior, which downstream split metadata depends on).
    """
    seen: dict[tuple[str, str], int] = {}
    deduped: list[dict] = []
    for pair in pairs:
        key = (pair["english"].lower(), pair["cree_sro"].lower())
        if key in seen:
            orig_idx = seen[key]
            deduped[orig_idx].setdefault("duplicate_lines", []).append(
                pair["source_line"]
            )
        else:
            seen[key] = len(deduped)
            deduped.append(pair)
    return deduped


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_textbook(en_lines: list[str], cr_lines: list[str]) -> list[dict]:
    """Convert raw line-aligned textbook files into validated pair dicts.

    Line N of the English file corresponds to line N of the Cree file.
    On a line-count mismatch both lists are truncated to the shorter one
    (with a warning), matching the original importer.

    Returns the deduplicated list of pair dicts in file order, each:
        {english, cree_sro, source, source_line, difficulty,
         lemma, fst_tags, notes [, duplicate_lines]}
    """
    if len(en_lines) != len(cr_lines):
        logger.warning(
            "Line count mismatch: EN=%d, CR=%d — truncating to shorter",
            len(en_lines), len(cr_lines),
        )
        min_len = min(len(en_lines), len(cr_lines))
        en_lines = en_lines[:min_len]
        cr_lines = cr_lines[:min_len]

    pairs: list[dict] = []
    skipped: dict[str, int] = {}
    for i, (en_raw, cr_raw) in enumerate(zip(en_lines, cr_lines), start=1):
        english = normalize_english(en_raw)
        cree = normalize_sro(cr_raw)
        valid, reason = is_valid_pair(english, cree)
        if not valid:
            skipped[reason] = skipped.get(reason, 0) + 1
            continue
        difficulty = classify_difficulty(english, cree)
        pairs.append({
            "english": english,
            "cree_sro": cree,
            "source": f"EdTeKLA/CreeLanguageTextbook:L{i}",
            "source_line": i,
            "difficulty": difficulty,
            "lemma": "",
            "fst_tags": "",
            "notes": f"Textbook L{difficulty}",
        })

    if skipped:
        logger.info("Skipped entries: %s", skipped)
    return deduplicate_pairs(pairs)


# ---------------------------------------------------------------------------
# Deterministic holdout split (port of split_holdout.py)
# ---------------------------------------------------------------------------

def split_dev_holdout(
    pairs: list[dict],
    *,
    seed: int = SPLIT_SEED,
    holdout_size: int = HOLDOUT_SIZE,
) -> tuple[list[dict], list[dict]]:
    """Stratified (by difficulty) deterministic split into (dev, holdout).

    Reproduces split_holdout.py exactly: proportional allocation per
    difficulty tier (min 1, rounding adjusted on the largest tier), a
    single ``random.Random(seed)`` instance shuffling each tier in
    ascending difficulty order, first N of each shuffled tier to the
    holdout, the rest to development.
    """
    total = len(pairs)
    by_difficulty: dict[int, list[dict]] = {}
    for entry in pairs:
        by_difficulty.setdefault(entry["difficulty"], []).append(entry)

    allocations: dict[int, int] = {}
    for d, entries in sorted(by_difficulty.items()):
        proportion = len(entries) / total
        allocations[d] = max(1, round(holdout_size * proportion))

    total_allocated = sum(allocations.values())
    if total_allocated != holdout_size:
        largest_d = max(allocations, key=lambda d: len(by_difficulty[d]))
        allocations[largest_d] += holdout_size - total_allocated

    rng = random.Random(seed)
    holdout: list[dict] = []
    development: list[dict] = []
    for d in sorted(by_difficulty):
        entries = by_difficulty[d][:]
        rng.shuffle(entries)
        n = allocations[d]
        holdout.extend(entries[:n])
        development.extend(entries[n:])

    if len(holdout) != holdout_size:
        raise ValueError(
            f"Holdout split produced {len(holdout)} entries, "
            f"expected {holdout_size}"
        )
    return development, holdout


# ---------------------------------------------------------------------------
# Harness output format (port of prepare_textbook_dev_corpus.py)
# ---------------------------------------------------------------------------

def to_harness_entries(pairs: list[dict]) -> list[dict]:
    """Convert pair dicts to harness entries with sequential IDs."""
    entries = []
    for i, entry in enumerate(pairs):
        entries.append({
            "id": i,
            "source": entry["english"],
            "reference": entry["cree_sro"],
            "difficulty": entry.get("difficulty"),
            "provenance": entry.get("source", ""),
            "metadata": {
                "lemma": entry.get("lemma", ""),
                "fst_tags": entry.get("fst_tags", ""),
                "notes": entry.get("notes", ""),
                "source_line": entry.get("source_line"),
            },
        })
    return entries


def build_dev_corpus(
    en_lines: list[str],
    cr_lines: list[str],
) -> dict:
    """Build the 436-entry dev corpus (harness JSON, wrapped).

    This is the deterministic rebuild of
    ``arena/datasets/curated/eng-crk-dev-v1.json`` (identical entries to
    ``arena/datasets/crk/textbook_dev_436.json``).
    """
    pairs = parse_textbook(en_lines, cr_lines)
    development, _holdout = split_dev_holdout(pairs)
    return {
        "dataset": {
            "name": "edtekla-dev-v1",
            "version": "1.0",
            "description": "EDTeKLA Plains Cree textbook corpus (436 dev entries)",
            "source_attribution": "EDTeKLA Project",
            "access": "private",
        },
        "entries": to_harness_entries(development),
        "language_pair": {
            "source": "eng",
            "target": "crk",
            "source_name": "English",
            "target_name": "Plains Cree",
        },
    }


def write_corpus_json(corpus: dict, dest: Path) -> Path:
    """Serialize a built corpus exactly as the published files were.

    ``json.dumps(..., indent=2, ensure_ascii=False)`` with no trailing
    newline — required so SHA-256 verification against corpora-card
    hashes succeeds.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(corpus, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return dest


# ---------------------------------------------------------------------------
# Download / cache
# ---------------------------------------------------------------------------

def _download_text(url: str, dest: Path, *, timeout: int = 60) -> Path:
    """Download a text file to ``dest``, using the cache when present."""
    if dest.exists():
        logger.info("Using cached download at %s", dest)
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading %s → %s", url, dest)
    try:
        with urlopen(url, timeout=timeout) as resp:
            data = resp.read()
    except URLError as exc:
        raise ConnectionError(
            f"Could not download {url}: {exc}. "
            f"Check your network connection — the EdTeKLA corpus is "
            f"fetched from GitHub at build time and is not bundled."
        ) from exc
    dest.write_bytes(data)
    return dest


def fetch_textbook_files(
    cache_dir: Path,
    *,
    ref: str = DEFAULT_REF,
    auto_yes: bool = False,
) -> tuple[Path, Path]:
    """Download (or reuse cached) EdTeKLA textbook files for a ref.

    Prompts for acceptance of EdTeKLA's modified CC BY-NC-SA terms
    before downloading (skipped
    when both files are already cached, or with ``auto_yes``).

    Returns:
        (en_path, cr_path) inside ``cache_dir/<ref>/``.

    Raises:
        PermissionError: If the user declines the license terms.
        ConnectionError: If the download fails (offline, repo moved).
    """
    ref_dir = Path(cache_dir) / ref
    en_dest = ref_dir / EN_FILENAME
    cr_dest = ref_dir / CR_FILENAME

    if not (en_dest.exists() and cr_dest.exists()):
        license_info = LicenseInfo(
            source_name=EDTEKLA_LICENSE.source_name,
            license_id=EDTEKLA_LICENSE.license_id,
            license_url=EDTEKLA_LICENSE.license_url,
            source_url=EDTEKLA_LICENSE.source_url,
            download_url=raw_file_url(EN_FILENAME, ref),
        )
        if not confirm_download(license_info, auto_yes=auto_yes):
            raise PermissionError(
                "EdTeKLA download declined — cannot build corpus without "
                "accepting EdTeKLA's modified CC BY-NC-SA license terms."
            )
        _download_text(raw_file_url(EN_FILENAME, ref), en_dest)
        _download_text(raw_file_url(CR_FILENAME, ref), cr_dest)

    return en_dest, cr_dest


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class EdTeKLAAdapter(SourceAdapter):
    """Fetch parallel eng→crk pairs from the EdTeKLA textbook corpus.

    Unlike the Tatoeba adapter (per-pair TSV exports), this adapter
    knows exactly one language pair: English → Plains Cree (crk), from
    the line-aligned Cree Language Textbook files.
    """

    name: str = "edtekla"
    license: str = "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0"

    def fetch(
        self,
        source_lang: str = "eng",
        target_lang: str = "crk",
        **kwargs: Any,
    ) -> list[RawEntry]:
        """Download/read and parse the EdTeKLA textbook corpus.

        Keyword Args:
            en_path (str | Path | None): Local English file (offline mode).
            cr_path (str | Path | None): Local Cree file (offline mode).
                Both or neither of en_path/cr_path must be given.
            cache_dir (str | Path | None): Download cache directory.
                Required when en_path/cr_path are not provided.
            ref (str): Git ref (commit SHA, tag, or branch) to fetch.
                Defaults to ``"master"``.
            auto_yes (bool): Skip the interactive license prompt (CI).

        Returns:
            List of RawEntry (486 validated, deduplicated pairs in
            file order — before the dev/holdout split).

        Raises:
            ValueError: For unsupported language pairs or bad arguments.
            PermissionError: If the license prompt is declined.
            ConnectionError: If the download fails.
        """
        if (source_lang, target_lang) != ("eng", "crk"):
            raise ValueError(
                f"EdTeKLA textbook adapter only supports eng→crk, "
                f"got {source_lang}→{target_lang}"
            )

        en_path = kwargs.get("en_path")
        cr_path = kwargs.get("cr_path")
        if (en_path is None) != (cr_path is None):
            raise ValueError("Provide both en_path and cr_path, or neither.")

        if en_path is None:
            cache_dir = kwargs.get("cache_dir")
            if cache_dir is None:
                raise ValueError(
                    "Provide cache_dir for downloads, or en_path/cr_path "
                    "for local files."
                )
            en_path, cr_path = fetch_textbook_files(
                Path(cache_dir),
                ref=kwargs.get("ref", DEFAULT_REF),
                auto_yes=kwargs.get("auto_yes", False),
            )

        en_file = Path(en_path)
        cr_file = Path(cr_path)
        if not en_file.exists():
            raise FileNotFoundError(f"EdTeKLA English file not found: {en_file}")
        if not cr_file.exists():
            raise FileNotFoundError(f"EdTeKLA Cree file not found: {cr_file}")

        en_lines = en_file.read_text(encoding="utf-8").splitlines()
        cr_lines = cr_file.read_text(encoding="utf-8").splitlines()
        pairs = parse_textbook(en_lines, cr_lines)

        results: list[RawEntry] = []
        for pair in pairs:
            source_id = f"L{pair['source_line']}"
            metadata: dict[str, Any] = {
                "source_lang": "eng",
                "target_lang": "crk",
                "difficulty": pair["difficulty"],
                "source_line": pair["source_line"],
                "notes": pair["notes"],
                "provenance": self.build_provenance(
                    source_id=source_id,
                    url=EDTEKLA_REPO_URL,
                ),
            }
            if "duplicate_lines" in pair:
                metadata["duplicate_lines"] = pair["duplicate_lines"]
            results.append(RawEntry(
                source_text=pair["english"],
                target_text=pair["cree_sro"],
                source_id=source_id,
                metadata=metadata,
            ))

        logger.info("EdTeKLA: yielded %d entries", len(results))
        return results


# ---------------------------------------------------------------------------
# One-call build entry point (used by the harness fetch-on-miss path)
# ---------------------------------------------------------------------------

def build_corpus_file(
    dest: Path,
    *,
    cache_dir: Path,
    ref: str = DEFAULT_REF,
    auto_yes: bool = False,
) -> Path:
    """Fetch the EdTeKLA source files and build the 436-entry dev corpus.

    Downloads (with license confirmation) into ``cache_dir``, rebuilds
    deterministically, and writes the harness-format JSON to ``dest``.
    """
    en_path, cr_path = fetch_textbook_files(
        cache_dir, ref=ref, auto_yes=auto_yes,
    )
    en_lines = en_path.read_text(encoding="utf-8").splitlines()
    cr_lines = cr_path.read_text(encoding="utf-8").splitlines()
    corpus = build_dev_corpus(en_lines, cr_lines)
    return write_corpus_json(corpus, dest)
