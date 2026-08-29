"""
Corpus Loader — Multi-format dataset loading for the eval harness.

Supports four corpus formats, auto-detected by file extension and content:

    Format            Extension      Detection
    ─────────────     ─────────      ──────────────────────────────────
    Harness JSON      .json          Has "entries" key or list of dicts
    JSONL             .jsonl         One JSON object per line
    TSV               .tsv / .tab    Tab-separated columns
    Parallel text     (two files)    --source-file + --reference-file

All formats are normalized to the harness's internal shape:
    [{"id": int, "source": str, "reference": str, ...}]

Design decisions:
    - Auto-ID: All formats get sequential 0-indexed IDs if not present.
    - Metadata pass-through: Extra fields in JSON/JSONL are preserved.
    - Header detection for TSV: If row 0 contains "source"/"reference"
      (case-insensitive), treat as header row and use column names.
    - Parallel text: Both files must have identical line counts. Empty
      lines are preserved (they may be intentional paragraph breaks in
      some corpora like FLORES+).
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mt_eval_harness.config import RunConfig


# ---------------------------------------------------------------------------
# Format-specific loaders
# ---------------------------------------------------------------------------

def _load_harness_json(path: Path, config: RunConfig) -> tuple[list[dict], dict]:
    """Load the harness's native JSON format.

    Supports two shapes:
        - Wrapped:  {"dataset": {...}, "entries": [...]}
        - Flat:     [{"source": ..., "reference": ...}, ...]

    Returns:
        (entries, dataset_metadata) — metadata dict may be empty for flat format.
    """
    try:
        corpus = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        # A truncated download or hand-edited corpus must abort with a
        # human-readable message, not a raw decoder traceback.
        raise SystemExit(
            f"\n  ❌ ERROR: corpus file is not valid JSON: {path}\n"
            f"  {exc}\n"
            f"  Re-download or fix the file, then re-run."
        )

    if isinstance(corpus, dict) and "entries" in corpus:
        dataset_meta = corpus.get("dataset", {})
        entries = corpus["entries"]
        return entries, dataset_meta

    if isinstance(corpus, list):
        return corpus, {}

    raise ValueError(
        f"Unrecognized JSON structure in {path}. "
        f"Expected a list of entries or an object with an 'entries' key."
    )


def _load_jsonl(path: Path) -> list[dict]:
    """Load a JSONL file (one JSON object per line).

    Common in HuggingFace datasets and many NLP tools.
    Lines that are empty or whitespace-only are skipped.
    """
    entries = []
    with open(path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(
                    f"Invalid JSON on line {line_num + 1} of {path}: {e}"
                ) from e
            entries.append(entry)
    return entries


def _sniff_igt(path: Path) -> bool:
    r"""True if the first non-blank line carries a \-tier marker (\t, \g, …)."""
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                return line.startswith("\\")
    return False


IGT_TIER_FIELDS = {
    "t": "source",              # transcription line — the system's input
    "m": "igt_segmentation",    # gold morphological segmentation (track 2)
    "g": "reference",           # gold gloss line — the eval target
    "l": "igt_translation",     # free translation
    "p": "igt_pos",             # POS tier (subset of languages)
}


def _load_igt(path: Path) -> list[dict]:
    r"""Load an interlinear-glossed-text file in SIGMORPHON shared-task format.

    Blocks are separated by blank lines; each line starts with a backslash
    tier marker (\t transcription, \m segmentation, \g gloss, \l translation,
    \p POS — the SIGMORPHON 2023 glossing-task layout). The transcription
    becomes the entry's source and the gold gloss its reference; the other
    tiers are preserved under igt_* fields so metrics and methods can use
    them (e.g. track-2 systems receive igt_segmentation as an input).
    """
    entries: list[dict] = []
    block: dict = {}

    def _flush() -> None:
        nonlocal block
        if block.get("source") is not None and block.get("reference") is not None:
            entries.append(block)
        elif block:
            raise ValueError(
                f"IGT block missing \\t or \\g tier in {path} "
                f"(near entry {len(entries) + 1}): {block!r}"
            )
        block = {}

    with open(path, "r", encoding="utf-8") as f:
        for line_num, raw in enumerate(f):
            line = raw.rstrip("\n")
            if not line.strip():
                _flush()
                continue
            if not line.startswith("\\"):
                raise ValueError(
                    f"Line {line_num + 1} of {path} is not blank and has no "
                    f"\\-tier marker: {line!r}"
                )
            marker, _, text = line[1:].partition(" ")
            field = IGT_TIER_FIELDS.get(marker)
            if field is None:
                # Unknown tier — preserve it rather than dropping data.
                field = f"igt_{marker}"
            block[field] = text.strip()
    _flush()

    return entries


def _load_tsv(path: Path) -> list[dict]:
    """Load a TSV (tab-separated values) file.

    Header detection: If the first row contains "source" and "reference"
    (case-insensitive), it's treated as a header and column names are used.
    Otherwise, column 0 = source, column 1 = reference.

    Extra columns beyond the first two are preserved as "col_2", "col_3", etc.
    unless headers are present, in which case the header names are used.
    """
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        rows = list(reader)

    if not rows:
        return []

    # Check for header row
    first_row_lower = [cell.strip().lower() for cell in rows[0]]
    has_header = "source" in first_row_lower

    if has_header:
        headers = [cell.strip() for cell in rows[0]]
        data_rows = rows[1:]
    else:
        # Default column mapping: col 0 = source, col 1 = reference
        headers = ["source", "reference"] + [
            f"col_{i}" for i in range(2, len(rows[0]))
        ]
        data_rows = rows

    entries = []
    for row in data_rows:
        if not row or all(cell.strip() == "" for cell in row):
            continue
        entry = {}
        for i, cell in enumerate(row):
            if i < len(headers):
                entry[headers[i]] = cell
            else:
                entry[f"col_{i}"] = cell
        entries.append(entry)

    return entries


def _load_parallel_text(
    source_path: Path,
    reference_path: Path,
) -> list[dict]:
    """Load parallel text files (one sentence per line, aligned by line number).

    This is the standard format for MT evaluation corpora:
    FLORES+, WMT, NTREX, Tatoeba, OPUS all ship this way.

    Both files must have the same number of lines. Empty lines are
    preserved since they may represent intentional segment boundaries.
    """
    source_lines = source_path.read_text(encoding="utf-8").splitlines()
    reference_lines = reference_path.read_text(encoding="utf-8").splitlines()

    if len(source_lines) != len(reference_lines):
        raise ValueError(
            f"Line count mismatch: {source_path} has {len(source_lines)} lines, "
            f"{reference_path} has {len(reference_lines)} lines. "
            f"Parallel text files must have identical line counts."
        )

    entries = []
    for i, (src, ref) in enumerate(zip(source_lines, reference_lines)):
        entries.append({
            "id": i,
            "source": src,
            "reference": ref,
        })

    return entries


# ---------------------------------------------------------------------------
# Unified entry point
# ---------------------------------------------------------------------------

def _ensure_ids(entries: list[dict]) -> list[dict]:
    """Ensure every entry has an 'id' field.

    If entries already have IDs, they're preserved. If not, sequential
    0-indexed IDs are assigned. Mixed (some have IDs, some don't) is
    treated as "no IDs" to avoid conflicts.
    """
    has_ids = all("id" in e for e in entries)
    if has_ids:
        return entries

    for i, entry in enumerate(entries):
        if "id" not in entry:
            entry["id"] = i
    return entries


def load_corpus(config: RunConfig) -> tuple[list[dict], dict]:
    """Load entries from a corpus in any supported format.

    Format resolution:
        1. If config.source_file and config.reference_file are set,
           load as parallel text (ignores config.corpus_path).
        2. Otherwise, detect format from config.corpus_path extension:
           - .jsonl → JSONL
           - .tsv / .tab → TSV
           - .igt (or .txt with \-tier markers) → IGT (SIGMORPHON layout)
           - .json (default) → Harness JSON

    After loading, applies dataset filtering (segments, ID ranges, etc.)
    and auto-populates config metadata from corpus when available.

    Args:
        config: RunConfig with corpus_path or source_file + reference_file set.

    Returns:
        Tuple of (entries, dataset_metadata).
        - entries: List of entry dicts, each with at least {id, source, reference}.
        - dataset_metadata: Dict from the corpus envelope (id, version,
          language_pair, etc.). Empty dict for formats without envelopes
          (JSONL, TSV, parallel text).
    """
    # --- Parallel text mode ---
    if config.source_file and config.reference_file:
        src = Path(config.source_file)
        ref = Path(config.reference_file)
        if not src.exists():
            raise FileNotFoundError(f"Source file not found: {src}")
        if not ref.exists():
            raise FileNotFoundError(f"Reference file not found: {ref}")

        print(f"  Format:      parallel text")
        print(f"  Source:      {src}")
        print(f"  Reference:   {ref}")

        entries = _load_parallel_text(src, ref)
        entries = _ensure_ids(entries)
        return _apply_filters(entries, config), {}

    # --- Single file mode ---
    if not config.corpus_path:
        raise FileNotFoundError(
            "No corpus specified. Use --corpus <path> or "
            "--source-file <src> --reference-file <ref>."
        )

    corpus_path = Path(config.corpus_path)
    if not corpus_path.exists():
        # Fetch-from-source: a missing corpus may be described by a
        # corpora card (cli/shared/corpora-cards/) with a `source`
        # block — Champollion doesn't host third-party corpora, it
        # rebuilds them from the upstream repo into a gitignored cache
        # (arena/datasets/.cache/).
        from mt_eval_harness.corpus_fetch import try_fetch_missing_corpus

        fetched = try_fetch_missing_corpus(
            corpus_path,
            assume_yes=getattr(config, "assume_yes", False),
        )
        if fetched is None:
            raise FileNotFoundError(f"Corpus not found: {corpus_path}")
        print(f"  Corpus:      fetched from source → {fetched}")
        corpus_path = fetched
        config.corpus_path = str(fetched)

    suffix = corpus_path.suffix.lower()

    if suffix == ".jsonl":
        print(f"  Format:      JSONL")
        entries = _load_jsonl(corpus_path)
        dataset_meta = {}

    elif suffix in (".tsv", ".tab"):
        print(f"  Format:      TSV")
        entries = _load_tsv(corpus_path)
        dataset_meta = {}

    elif suffix == ".igt" or (
        suffix == ".txt" and _sniff_igt(corpus_path)
    ):
        print(f"  Format:      IGT (SIGMORPHON tier markers)")
        entries = _load_igt(corpus_path)
        dataset_meta = {}

    else:
        # Default: harness JSON (.json or anything else)
        entries, dataset_meta = _load_harness_json(corpus_path, config)

        def _coerce_lang_pair(value):
            """Normalize a corpus ``language_pair`` into a plain dict.

            Corpora carry two shapes: a dict ({"source": "eng",
            "target": "crk", ...}) or the compact string the public
            registering-corpora docs show ("eng-crk"; ":" and ">" also
            accepted). Anything else fails with a named, actionable
            error instead of the bare ``dict()`` constructor traceback
            a string used to produce.
            """
            if not value:
                return {}
            if isinstance(value, dict):
                return dict(value)
            if isinstance(value, str):
                m = re.match(
                    r"^\s*([A-Za-z]{2,3})\s*[-:>]\s*([A-Za-z]{2,3})\s*$", value
                )
                if m:
                    return {
                        "source": m.group(1).lower(),
                        "target": m.group(2).lower(),
                    }
            raise ValueError(
                f"Unrecognized language_pair {value!r} in {corpus_path.name}: "
                'expected {"source": "eng", "target": "crk"} or a compact '
                'pair string like "eng-crk".'
            )

        # Auto-populate config from corpus metadata when not set explicitly.
        # This means users can just --corpus <file> without extra flags.
        #
        # Language info lives in one of three shapes depending on who built
        # the corpus — all store ISO codes, none store names:
        #   - dataset_meta["language_pair"]   {"source","target"[,"*_name"]}
        #   - top-level "language_pair"        (Tatoeba, the eng-fra example)
        #   - flat top-level "source_lang"/"target_lang"
        #       (GlobalVoices, IN22, TICO-19 fetch-from-source builders)
        # We normalize all of them into one lang_pair dict. Historically this
        # block read only language_pair["target_name"] — which NO built corpus
        # writes — so GlobalVoices et al. silently left target_lang unset and
        # the run aborted with "target_lang is required". (corpus_loader.py:300)
        lang_pair = _coerce_lang_pair(dataset_meta.get("language_pair"))
        if not (lang_pair.get("source") and lang_pair.get("target")):
            # Re-read the raw corpus object to pick up a top-level language_pair
            # or the flat source_lang/target_lang keys.
            raw = json.loads(corpus_path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                if not lang_pair:
                    lang_pair = _coerce_lang_pair(raw.get("language_pair"))
                # Flat keys are ISO codes; promote them when language_pair
                # didn't already carry source/target.
                if not lang_pair.get("source") and raw.get("source_lang"):
                    lang_pair["source"] = raw["source_lang"]
                if not lang_pair.get("target") and raw.get("target_lang"):
                    lang_pair["target"] = raw["target_lang"]

        if dataset_meta:
            if not config.dataset_id and dataset_meta.get("id"):
                config.dataset_id = dataset_meta["id"]
                print(f"  Dataset ID:  {config.dataset_id} (from corpus metadata)")

        # Resolve human-readable names from ISO codes. The LLM prompt needs a
        # NAME ("French"); self-contained MT adapters need the code ("fra").
        # We populate both. An explicit *_name in the corpus wins; otherwise
        # get_name() resolves the code offline against the bundled language
        # cards, falling back to the code itself when it can't.
        from mt_eval_harness.language_cards import get_name

        src_code = lang_pair.get("source") or ""
        tgt_code = lang_pair.get("target") or ""
        src_name = (lang_pair.get("source_name")
                    or (get_name(src_code) if src_code else None) or src_code)
        tgt_name = (lang_pair.get("target_name")
                    or (get_name(tgt_code) if tgt_code else None) or tgt_code)

        if not config.target_lang.strip() and tgt_name:
            config.target_lang = tgt_name
            print(f"  Target lang: {config.target_lang} (from corpus metadata)")

        if not config.source_lang.strip() and src_name:
            config.source_lang = src_name
            print(f"  Source lang: {config.source_lang} (from corpus metadata)")

        # ISO codes for self-contained MT adapters (read by
        # methods/base_http_mt._resolve_lang_codes). Only set when not supplied
        # explicitly (e.g. via --source-code/--target-code).
        if not getattr(config, "source_code", "") and src_code:
            config.source_code = src_code
        if not getattr(config, "target_code", "") and tgt_code:
            config.target_code = tgt_code

    entries = _ensure_ids(entries)
    _autodetect_fields(entries, config)
    return _apply_filters(entries, config), dataset_meta


# Ordered field-name aliases. The harness default target field is "reference",
# but several fetch-from-source builders (IN22, TICO-19, GlobalVoices) write
# "target". Auto-detecting the actual key means those corpora run with NO extra
# flags — the low-friction promise — for humans and agents alike. Detection is
# data-driven (it inspects what the corpus actually contains), never a
# per-corpus or per-language hardcode.
_SOURCE_FIELD_ALIASES = ("source", "src", "original", "source_text")
_TARGET_FIELD_ALIASES = ("reference", "target", "translation", "ref", "tgt",
                         "target_text")


def _autodetect_fields(entries: list[dict], config: RunConfig) -> None:
    """Switch config.source_field/target_field to the corpus's actual keys.

    Only acts when the CURRENTLY configured field is ABSENT from the corpus and
    a known alias IS present — so it can only turn a guaranteed field-mismatch
    error into a working run, never override a field that already resolves.
    """
    if not entries:
        return
    sample = entries[: min(len(entries), 25)]

    def _present(name: str) -> bool:
        return any(e.get(name) not in (None, "") for e in sample)

    def _resolve(current: str, aliases: tuple[str, ...], label: str) -> None:
        if _present(current):
            return  # the configured field already works — leave it alone
        for alias in aliases:
            if alias != current and _present(alias):
                print(f"  Resolved {label} field: '{alias}' "
                      f"(configured '{current}' not present)")
                setattr(config, f"{label}_field", alias)
                return

    _resolve(config.source_field, _SOURCE_FIELD_ALIASES, "source")
    _resolve(config.target_field, _TARGET_FIELD_ALIASES, "target")


def _apply_filters(entries: list[dict], config: RunConfig) -> list[dict]:
    """Apply dataset filtering: segment names, ID ranges, explicit IDs.

    This is the filtering logic that was previously inline in runner.py's
    load_corpus(). Extracted here so all formats share the same filtering.
    """
    # Auto-detect segment names from corpus if not explicitly configured.
    segment_names = config.segment_names
    if not segment_names:
        segment_names = sorted({
            e.get("segment", "") for e in entries if e.get("segment")
        })
        if segment_names:
            print(f"  Auto-detected segments: {', '.join(segment_names)}")

    # Explicit entry IDs take precedence
    if config.entry_ids is not None:
        # String-normalize both sides: corpora store ids as ints (EdTeKLA)
        # or strings (Tatoeba 'tatoeba_2289'), and CLI input arrives as
        # text. Exact-type matching silently selected nothing.
        id_set = {str(i) for i in config.entry_ids}
        filtered = [e for e in entries if str(e["id"]) in id_set]
        if len(filtered) != len(id_set):
            found = {str(e["id"]) for e in filtered}
            missing = id_set - found
            print(f"  WARNING: {len(missing)} entry IDs not found: {sorted(missing)[:10]}")
        return filtered

    dataset = config.dataset.strip().lower()

    if dataset == "all":
        return entries

    # Check for segment name (case-insensitive — corpus segments may be
    # mixed case like "Development" while CLI input is lowercased)
    segment_names_lower = {s.lower(): s for s in segment_names}
    if dataset in segment_names_lower:
        actual_name = segment_names_lower[dataset]
        return [e for e in entries if e.get("segment") == actual_name]

    # Coerce a possibly-string entry id to int for numeric comparison.
    # Corpus ids are ints in some corpora (EdTeKLA) and strings in others
    # (Tatoeba: 'tatoeba_2289'). A numeric range/id only matches numeric ids,
    # so non-numeric ids are skipped rather than crashing an int<=str compare.
    def _as_int(eid) -> int | None:
        try:
            return int(eid)
        except (TypeError, ValueError):
            return None

    # Check for ID range (e.g., "0-61")
    if "-" in dataset:
        try:
            start_s, end_s = dataset.split("-")
            start, end = int(start_s), int(end_s)
        except (ValueError, IndexError):
            pass
        else:
            return [
                e for e in entries
                if (n := _as_int(e["id"])) is not None and start <= n <= end
            ]

    # Check for single ID
    try:
        single_id = int(dataset)
    except ValueError:
        pass
    else:
        return [e for e in entries if _as_int(e["id"]) == single_id]

    available = ', '.join(segment_names) if segment_names else 'none detected'
    raise ValueError(
        f"Unknown dataset filter: '{config.dataset}'. "
        f"Use 'all', a segment name ({available}), "
        f"an ID range ('0-61'), or a single ID."
    )
