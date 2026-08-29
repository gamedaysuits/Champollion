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
Tatoeba source adapter for the corpora builder.

Tatoeba (https://tatoeba.org) is a community-curated collection of sentences
and translations contributed by volunteers.  All content is licensed under
CC-BY 2.0 and every sentence has a known human author, making it an ideal
source for evaluation corpora.

Data format
-----------
Tatoeba distributes bilingual TSV files (often bz2-compressed) where each
line contains four tab-separated columns::

    source_id \\t source_text \\t target_id \\t target_text

This adapter can read from:
1. A **local TSV file** — pass ``file_path`` to ``fetch()``.
2. A **remote download URL** — pass ``download_url`` to ``fetch()``.
   The file will be downloaded (and decompressed if bz2) into
   ``download_dir`` before parsing.

Language codes
--------------
Tatoeba uses its own three-letter codes that *mostly* align with ISO 639-3
but diverge in a few places (e.g. Mandarin is ``cmn`` in ISO but Tatoeba
sometimes uses ``zho``).  ``TATOEBA_LANG_MAP`` normalises these.
"""

from __future__ import annotations

import bz2
import csv
import hashlib
import logging
import tempfile
from pathlib import Path
from typing import Any

import requests

from .base import RawEntry, SourceAdapter
from mt_eval_harness.corpus_build import USER_AGENT

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Language-code normalisation
# ---------------------------------------------------------------------------

# Maps Tatoeba's internal language codes to ISO 639-3.
# Only entries that *differ* between the two schemes need to appear here;
# codes that are already ISO 639-3 (like "eng", "fra", "deu") pass through
# unchanged via ``_normalise_lang()``.
TATOEBA_LANG_MAP: dict[str, str] = {
    # Only entries where Tatoeba's code DIFFERS from ISO 639-3.
    # Codes that are already valid ISO 639-3 (like "eng", "fra", "deu",
    # "jbo", "bre", "yue", etc.) pass through unchanged via
    # _normalise_lang()'s .get() fallback — no need to list them here.
    "zho": "cmn",    # Tatoeba "Chinese" → ISO Mandarin
    "zsm": "zlm",    # Standard Malay
    "toki": "tok",   # Toki Pona
}


def _normalise_lang(tatoeba_code: str) -> str:
    """Convert a Tatoeba language code to ISO 639-3.

    Falls through to the original code when no mapping exists, because the
    majority of Tatoeba codes *are* already valid ISO 639-3.
    """
    return TATOEBA_LANG_MAP.get(tatoeba_code, tatoeba_code)


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class TatoebaAdapter(SourceAdapter):
    """Fetch parallel text pairs from a Tatoeba bilingual TSV export.

    Class-level attributes ``name`` and ``license`` satisfy the
    ``SourceAdapter`` ABC contract.  All source-specific configuration
    is passed through ``fetch(**kwargs)``.
    """

    name: str = "tatoeba"
    license: str = "CC-BY-2.0"

    def fetch(
        self,
        source_lang: str,
        target_lang: str,
        **kwargs: Any,
    ) -> list[RawEntry]:
        """Download/read and parse Tatoeba sentence pairs.

        Keyword Args:
            file_path (str | Path | None):
                Path to a local TSV file.  Mutually exclusive with
                ``download_url``.
            download_url (str | None):
                URL to fetch the TSV (optionally bz2-compressed).
                Mutually exclusive with ``file_path``.
            download_dir (str | Path | None):
                Directory for storing downloaded files.  Only used when
                ``download_url`` is set.  Defaults to a temporary directory.
            min_words (int):
                Minimum number of whitespace-delimited tokens in the
                *source* text for an entry to be included.  Default 1.
            max_words (int):
                Maximum number of whitespace-delimited tokens in the
                *source* text.  Default 200.

        Returns:
            Deduplicated, filtered list of ``RawEntry`` objects.

        Raises:
            ValueError: If both or neither of ``file_path`` /
                ``download_url`` are provided.
            FileNotFoundError: If ``file_path`` does not exist on disk.
            requests.HTTPError: If the download fails.
        """
        file_path: str | Path | None = kwargs.get("file_path")
        download_url: str | None = kwargs.get("download_url")
        download_dir: str | Path | None = kwargs.get("download_dir")
        min_words: int = kwargs.get("min_words", 1)
        max_words: int = kwargs.get("max_words", 200)

        # --- Validate inputs ------------------------------------------------
        if file_path is not None and download_url is not None:
            raise ValueError(
                "Provide either file_path or download_url, not both."
            )
        if file_path is None and download_url is None:
            raise ValueError(
                "Provide at least one of file_path or download_url."
            )
        if min_words < 0:
            raise ValueError(f"min_words must be >= 0, got {min_words}")
        if max_words < min_words:
            raise ValueError(
                f"max_words ({max_words}) must be >= min_words ({min_words})"
            )

        # --- Resolve the file on disk ----------------------------------------
        tsv_path = self._resolve_tsv_path(file_path, download_url, download_dir)
        logger.info("Parsing Tatoeba TSV at %s", tsv_path)

        # Normalise the adapter-caller's language codes so provenance is
        # consistent regardless of what flavour of code the caller used.
        source_iso = _normalise_lang(source_lang)
        target_iso = _normalise_lang(target_lang)

        # --- Parse and filter ------------------------------------------------
        # Track yielded pairs to skip exact duplicates within this source.
        # Uses a set of (source, target) tuples — memory-cheap for text.
        seen_pairs: set[tuple[str, str]] = set()
        results: list[RawEntry] = []
        skipped_count = 0
        # Malformed rows are tracked SEPARATELY from normal filtering.
        # Legitimate skips (duplicates, word-count bounds, untranslated pairs)
        # are expected and routine — a high skip rate from those is normal.
        # Malformed rows (wrong column count) mean data corruption, wrong
        # delimiter, or wrong file — even ONE is a problem.
        malformed_count = 0

        for raw_row in self._iter_tsv_rows(tsv_path):
            source_text, target_text, source_id, is_malformed = (
                self._extract_fields(raw_row)
            )

            if is_malformed:
                malformed_count += 1
                continue

            # --- Filter pipeline (order matters for performance) -----------

            # 1. Empty texts — fastest check, do it first.
            if not source_text or not target_text:
                skipped_count += 1
                continue

            # 2. Untranslated pairs — source identical to target.
            if source_text == target_text:
                skipped_count += 1
                continue

            # 3. Word-count bounds on the SOURCE side.
            word_count = len(source_text.split())
            if word_count < min_words or word_count > max_words:
                skipped_count += 1
                continue

            # 4. Exact-duplicate suppression.
            pair_key = (source_text, target_text)
            if pair_key in seen_pairs:
                skipped_count += 1
                continue
            seen_pairs.add(pair_key)

            # --- Build the entry ------------------------------------------

            results.append(RawEntry(
                source_text=source_text,
                target_text=target_text,
                source_id=source_id,
                metadata={
                    "source_lang": source_iso,
                    "target_lang": target_iso,
                    "provenance": self.build_provenance(
                        source_id=source_id,
                        url=f"https://tatoeba.org/en/sentences/show/{source_id}",
                    ),
                },
            ))

        # --- Post-parse validation ----------------------------------------

        # Malformed rows are ALWAYS an error. Even one means the file
        # has structural problems (wrong delimiter, corrupted download,
        # wrong format). We crash loud so the user investigates.
        if malformed_count > 0:
            raise ValueError(
                f"Tatoeba TSV at {tsv_path} contained {malformed_count} "
                f"malformed row(s) (expected 2 or 4+ columns per row). "
                f"This usually means a corrupted download, wrong file "
                f"format, or incorrect delimiter. Yielded {len(results)} "
                f"entries before aborting."
            )

        logger.info(
            "Tatoeba: yielded %d entries, filtered %d "
            "(duplicates, word-count bounds, untranslated, empty)",
            len(results),
            skipped_count,
        )

        return results

    # -- Internal helpers ----------------------------------------------------

    @staticmethod
    def _resolve_tsv_path(
        file_path: str | Path | None,
        download_url: str | None,
        download_dir: str | Path | None,
    ) -> Path:
        """Return the path to the local TSV file, downloading if necessary."""
        if file_path is not None:
            resolved = Path(file_path)
            if not resolved.exists():
                raise FileNotFoundError(
                    f"Tatoeba TSV not found at {resolved}"
                )
            return resolved

        # Download from URL.
        assert download_url is not None  # enforced by caller validation
        dest_dir = Path(download_dir) if download_dir else Path(tempfile.gettempdir())
        return _download_file(download_url, dest_dir)

    @staticmethod
    def _iter_tsv_rows(tsv_path: Path) -> list[list[str]]:
        """Read all rows from a tab-separated file, skipping comments.

        Tatoeba TSVs sometimes contain lines starting with ``#`` as
        comments — we skip those.  Blank lines are also skipped.

        Returns a list (not a generator) because the ABC contract
        requires ``fetch()`` to return a list, so we're already
        materialising the full dataset in memory.
        """
        rows: list[list[str]] = []
        with open(tsv_path, "r", encoding="utf-8") as fh:
            reader = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
            for row in reader:
                # Skip blank lines (csv.reader can produce empty rows).
                if not row:
                    continue
                # Skip comment lines.
                if row[0].startswith("#"):
                    continue
                rows.append(row)
        return rows

    @staticmethod
    def _extract_fields(row: list[str]) -> tuple[str, str, str, bool]:
        """Pull source text, target text, and source ID from a Tatoeba row.

        Expected column layouts (Tatoeba is not 100% consistent):
        * **4 columns**: id_source, source_text, id_target, target_text
        * **2 columns**: source_text, target_text  (simplified exports)

        Returns:
            (source_text, target_text, source_id, is_malformed) — all
            text values stripped.  ``is_malformed`` is True when the row
            has an unexpected column count (not 2 or 4+), signaling
            data corruption rather than a legitimate empty entry.
        """
        if len(row) >= 4:
            # Standard bilingual export: id  text  id  text
            return row[1].strip(), row[3].strip(), row[0].strip(), False
        if len(row) == 2:
            # Simplified two-column export — no numeric ID available.
            # Generate a deterministic hash-based ID from the texts to
            # ensure uniqueness (empty IDs would create collisions).
            content_hash = hashlib.sha256(
                f"{row[0]}|{row[1]}".encode("utf-8")
            ).hexdigest()[:12]
            return row[0].strip(), row[1].strip(), f"hash_{content_hash}", False

        # Malformed — flag it so the caller can track and crash.
        logger.warning(
            "Malformed TSV row with %d columns (expected 2 or 4+): %r",
            len(row),
            row[:5],  # show first 5 fields for diagnostics, truncate long rows
        )
        return "", "", "", True


# ---------------------------------------------------------------------------
# File download helpers
# ---------------------------------------------------------------------------

def _download_file(url: str, dest_dir: Path) -> Path:
    """Download ``url`` into ``dest_dir``, handling tar/bz2/plain formats.

    For OPUS Tatoeba Challenge `.tar` archives:
      - Streams the tar into memory (never saves the full archive to disk)
      - Extracts only the test split (test.src, test.trg, test.id)
      - Falls back to train split if no test exists
      - Synthesizes a 4-column TSV cached to disk for reuse

    For `.bz2` files: downloads and decompresses.
    For plain files: downloads directly.

    Returns the path to the resulting TSV on disk.
    """
    filename = url.rsplit("/", maxsplit=1)[-1]

    # For tar archives, we stream — the tar itself never touches disk.
    # Only the synthesized TSV is saved.
    if filename.endswith(".tar"):
        tsv_path = dest_dir / filename.replace(".tar", ".tsv")
        if tsv_path.exists():
            logger.info("Using cached synthesized TSV at %s", tsv_path)
            return tsv_path
        dest_dir.mkdir(parents=True, exist_ok=True)
        return _stream_tar_to_tsv(url, tsv_path)

    # Non-tar files: download to disk as before
    raw_path = dest_dir / filename

    if raw_path.exists():
        logger.info("Using cached download at %s", raw_path)
    else:
        logger.info("Downloading %s → %s", url, raw_path)
        dest_dir.mkdir(parents=True, exist_ok=True)

        response = requests.get(
            url, stream=True, timeout=120,
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()

        with open(raw_path, "wb") as fh:
            for chunk in response.iter_content(chunk_size=8192):
                fh.write(chunk)

        logger.info("Download complete: %s", raw_path)

    # Decompress bz2 archives so downstream code can read plain TSV.
    if raw_path.suffix == ".bz2":
        return _decompress_bz2(raw_path)

    return raw_path


def _stream_tar_to_tsv(url: str, tsv_path: Path) -> Path:
    """Stream-download a tar archive and extract only the test split.

    The full tar archive is NEVER saved to disk. We stream it into a
    BytesIO buffer, open it as a tarfile, extract only the test split
    members (test.src, test.trg, test.id — typically a few KB each),
    and write a synthesized 4-column TSV.

    For archives over MAX_STREAM_BYTES, we first do a HEAD request
    to check the size and skip if too large. The OPUS test splits are
    stored near the beginning of the tar (before the gzipped train
    data), so even large archives work — we just need enough memory
    to buffer the download.

    Falls back to gzipped train data if no test split exists, but
    only for small archives (under 50 MB).
    """
    import gzip
    import io
    import tarfile

    # Safety cap: don't stream archives larger than 500 MB into memory.
    # The test split is always near the start of the tar, but Python's
    # tarfile needs to read the entire stream to enumerate members.
    MAX_STREAM_BYTES = 500 * 1024 * 1024  # 500 MB
    TRAIN_FALLBACK_MAX = 50 * 1024 * 1024  # 50 MB — only try train for small tars

    # Check size first with HEAD
    try:
        head = requests.head(url, timeout=10, allow_redirects=True,
                             headers={"User-Agent": USER_AGENT})
        content_length = int(head.headers.get("Content-Length", 0))
    except (requests.RequestException, ValueError):
        content_length = 0

    if content_length > MAX_STREAM_BYTES:
        raise ValueError(
            f"OPUS tar at {url} is {content_length / (1024*1024):.0f} MB — "
            f"exceeds streaming cap of {MAX_STREAM_BYTES // (1024*1024)} MB. "
            f"For large archives, use a local download + _extract_tar_to_tsv."
        )

    logger.info(
        "Streaming tar %s (%s) → %s",
        url,
        f"{content_length / (1024*1024):.1f} MB" if content_length else "unknown size",
        tsv_path,
    )

    # Stream the tar into memory
    response = requests.get(
        url, stream=True, timeout=300,
        headers={"User-Agent": USER_AGENT},
    )
    response.raise_for_status()

    buf = io.BytesIO()
    for chunk in response.iter_content(chunk_size=65536):
        buf.write(chunk)
    buf.seek(0)

    # Open as tarfile from memory buffer
    with tarfile.open(fileobj=buf) as tf:
        members = {m.name: m for m in tf.getmembers()}

        # Find the data directory prefix
        prefix = None
        for name in members:
            if name.endswith("/test.src") or name.endswith("/train.src.gz"):
                prefix = name.rsplit("/", 1)[0]
                break

        if prefix is None:
            raise ValueError(
                f"OPUS tar from {url} has no recognisable structure — "
                f"expected test.src or train.src.gz inside."
            )

        # Try test split first
        test_src = f"{prefix}/test.src"
        test_trg = f"{prefix}/test.trg"
        test_id = f"{prefix}/test.id"

        src_lines = None
        trg_lines = None
        id_lines = None

        if test_src in members and test_trg in members:
            logger.info("Using test split from streamed tar")
            src_lines = _read_tar_member(tf, test_src)
            trg_lines = _read_tar_member(tf, test_trg)
            if test_id in members:
                id_lines = _read_tar_member(tf, test_id)
        elif content_length <= TRAIN_FALLBACK_MAX:
            # Only try train fallback for small archives
            train_src = f"{prefix}/train.src.gz"
            train_trg = f"{prefix}/train.trg.gz"
            train_id = f"{prefix}/train.id.gz"

            if train_src not in members or train_trg not in members:
                raise ValueError(
                    f"OPUS tar from {url} has neither test nor train split."
                )

            logger.info("No test split; using train split from streamed tar")
            src_lines = _read_tar_member_gz(tf, train_src)
            trg_lines = _read_tar_member_gz(tf, train_trg)
            if train_id in members:
                id_lines = _read_tar_member_gz(tf, train_id)
        else:
            raise ValueError(
                f"OPUS tar from {url} has no test split and is too large "
                f"({content_length / (1024*1024):.0f} MB) for train fallback."
            )

    # Free the buffer immediately
    buf.close()

    # Validate parallel alignment
    if len(src_lines) != len(trg_lines):
        raise ValueError(
            f"OPUS tar from {url}: src ({len(src_lines)} lines) and "
            f"trg ({len(trg_lines)} lines) are not aligned."
        )

    # Parse IDs
    src_ids, trg_ids = _parse_id_lines(id_lines, len(src_lines))

    # Write synthesized TSV (only thing that touches disk)
    with open(tsv_path, "w", encoding="utf-8") as fh:
        for src_id, src_text, trg_id, trg_text in zip(
            src_ids, src_lines, trg_ids, trg_lines
        ):
            fh.write(f"{src_id}\t{src_text}\t{trg_id}\t{trg_text}\n")

    logger.info(
        "Synthesized TSV: %d entries from streamed %s",
        len(src_lines),
        url.rsplit("/", 1)[-1],
    )
    return tsv_path


def _parse_id_lines(id_lines: list[str] | None, n: int) -> tuple[list[str], list[str]]:
    """Parse OPUS ``test.id``/``train.id`` lines into per-entry ids.

    The id file format varies BY PACK across Tatoeba Challenge releases:
    some carry sentence ids ("12345\\t67890"), others carry language
    labels on every line ("eng\\ttuk"). Language labels are useless as
    entry ids — every entry collapses onto one duplicated id (the
    eng-tuk corpus shipped 118 entries all named ``tatoeba_eng``), and
    duplicated ids silently overwrite each other on leaderboard entry
    upserts. Ids are only trusted when they are unique across the file;
    otherwise positional ids are generated (stable across rebuilds of
    the same release).
    """
    if id_lines and len(id_lines) == n:
        src_ids, trg_ids = [], []
        for line in id_lines:
            parts = line.split("\t")
            src_ids.append(parts[0].strip())
            trg_ids.append(parts[1].strip() if len(parts) > 1 else parts[0].strip())
        if len(set(src_ids)) == n:
            return src_ids, trg_ids
        logger.warning(
            "id file carries non-unique values (%d distinct over %d lines — "
            "language labels?); falling back to positional ids",
            len(set(src_ids)), n,
        )
    positional = [str(i + 1) for i in range(n)]
    return positional, list(positional)


def _extract_tar_to_tsv(tar_path: Path, tsv_path: Path) -> Path:
    """Extract parallel line files from an OPUS Tatoeba Challenge tar.

    The tar structure is:
        data/release/v2023-09-26/{lang1}-{lang2}/
            test.src        — source sentences (one per line)
            test.trg        — target sentences (one per line)
            test.id         — sentence IDs (one per line, tab-separated pairs)
            train.src.gz    — gzipped training source (fallback if no test)
            train.trg.gz    — gzipped training target
            train.id.gz     — gzipped training IDs

    We prefer the test split because it's smaller and curated.
    Falls back to train if test doesn't exist.

    Synthesizes a 4-column TSV: source_id \\t source_text \\t target_id \\t target_text
    """
    import gzip
    import tarfile

    logger.info("Extracting OPUS tar %s → %s", tar_path, tsv_path)

    with tarfile.open(tar_path) as tf:
        members = {m.name: m for m in tf.getmembers()}

        # Find the data directory prefix (e.g., "data/release/v2023-09-26/eng-fra")
        prefix = None
        for name in members:
            if name.endswith("/test.src") or name.endswith("/train.src.gz"):
                prefix = name.rsplit("/", 1)[0]
                break

        if prefix is None:
            raise ValueError(
                f"OPUS tar {tar_path} has no recognisable structure — "
                f"expected test.src or train.src.gz inside."
            )

        # Try test split first, fall back to train
        src_lines = None
        trg_lines = None
        id_lines = None

        test_src = f"{prefix}/test.src"
        test_trg = f"{prefix}/test.trg"
        test_id = f"{prefix}/test.id"

        if test_src in members and test_trg in members:
            logger.info("Using test split from tar")
            src_lines = _read_tar_member(tf, test_src)
            trg_lines = _read_tar_member(tf, test_trg)
            if test_id in members:
                id_lines = _read_tar_member(tf, test_id)
        else:
            # Fall back to gzipped train split
            train_src = f"{prefix}/train.src.gz"
            train_trg = f"{prefix}/train.trg.gz"
            train_id = f"{prefix}/train.id.gz"

            if train_src not in members or train_trg not in members:
                raise ValueError(
                    f"OPUS tar {tar_path} has neither test nor train split "
                    f"at prefix {prefix}."
                )

            logger.info("No test split; falling back to train split from tar")
            src_lines = _read_tar_member_gz(tf, train_src)
            trg_lines = _read_tar_member_gz(tf, train_trg)
            if train_id in members:
                id_lines = _read_tar_member_gz(tf, train_id)

    # Validate parallel alignment
    if len(src_lines) != len(trg_lines):
        raise ValueError(
            f"OPUS tar {tar_path}: src ({len(src_lines)} lines) and "
            f"trg ({len(trg_lines)} lines) are not aligned."
        )

    # Parse IDs — format is either "src_id\ttrg_id" or just "src_id" per line
    src_ids, trg_ids = _parse_id_lines(id_lines, len(src_lines))

    # Write synthesized TSV
    with open(tsv_path, "w", encoding="utf-8") as fh:
        for src_id, src_text, trg_id, trg_text in zip(
            src_ids, src_lines, trg_ids, trg_lines
        ):
            fh.write(f"{src_id}\t{src_text}\t{trg_id}\t{trg_text}\n")

    logger.info(
        "Synthesized TSV: %d entries from %s",
        len(src_lines),
        tar_path.name,
    )
    return tsv_path


def _read_tar_member(tf, member_name: str) -> list[str]:
    """Read a plain text member from an open tarfile."""
    import tarfile
    f = tf.extractfile(member_name)
    if f is None:
        raise ValueError(f"Cannot read tar member {member_name}")
    return f.read().decode("utf-8").strip().split("\n")


def _read_tar_member_gz(tf, member_name: str) -> list[str]:
    """Read a gzipped text member from an open tarfile."""
    import gzip
    import tarfile
    f = tf.extractfile(member_name)
    if f is None:
        raise ValueError(f"Cannot read tar member {member_name}")
    return gzip.decompress(f.read()).decode("utf-8").strip().split("\n")


def _decompress_bz2(bz2_path: Path) -> Path:
    """Decompress a ``.bz2`` file next to the archive.

    Returns the path to the decompressed file.  Skips decompression if
    the output already exists.
    """
    out_path = bz2_path.with_suffix("")  # strip .bz2
    if out_path.exists():
        logger.info("Using cached decompressed file at %s", out_path)
        return out_path

    logger.info("Decompressing %s → %s", bz2_path, out_path)
    with bz2.open(bz2_path, "rb") as fin, open(out_path, "wb") as fout:
        # Read in 1 MiB chunks to keep memory bounded even for large
        # Tatoeba exports.
        while True:
            chunk = fin.read(1_048_576)
            if not chunk:
                break
            fout.write(chunk)

    return out_path
