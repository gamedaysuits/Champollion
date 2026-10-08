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
    - TSV is split on TAB with no quote processing (the MT convention);
      '# ' lines are comments. Header detection: if row 0 has a "source"
      column (case-insensitive), it is the header.
    - Parallel text: Both files must have identical line counts. Empty
      lines are preserved (they may be intentional paragraph breaks in
      some corpora like FLORES+).
"""

from __future__ import annotations

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
        # The envelope's licence is `dataset.license`. A dev set released by
        # `contest prepare` before it wrote that field carries the licence as
        # `dataset.provenance.license`; read it, or a LicenseRef-* set would
        # run as unlicensed (no-train) instead of consent-required.
        if isinstance(dataset_meta, dict) and not dataset_meta.get("license"):
            prov = dataset_meta.get("provenance")
            if isinstance(prov, dict) and str(prov.get("license") or "").strip():
                dataset_meta = {**dataset_meta, "license": prov["license"]}
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


_TSV_COMMENT = re.compile(r"^#(\s|$)")


def _load_tsv(path: Path) -> list[dict]:
    """Load a TSV (tab-separated values) file.

    One row per line, split on TAB with NO quote processing — the MT
    convention (sacreBLEU, OPUS, Tatoeba, and this harness's own corpus
    adapters). csv's default quoting let a sentence that opens with a double
    quote swallow the tabs and lines after it.

    - Lines starting with ``# `` (or a bare ``#``) are comments. A hashtag
      (``#topic``) is text.
    - A UTF-8 byte-order mark (spreadsheet exports) is stripped.
    - Header detection: if the first row has a column named "source"
      (case-insensitive), it is a header and its names are the keys.
      Otherwise column 0 = source, column 1 = reference, extra columns are
      "col_2", "col_3", …
    - Every row must have a reference, or none may (a reference-free file).
      Some-but-not-all is refused with the line numbers: a row scored against
      an empty reference is a silent miss in every metric.
    """
    text = Path(path).read_text(encoding="utf-8-sig")
    numbered = []
    for lineno, line in enumerate(text.split("\n"), start=1):
        line = line.rstrip("\r")
        if not line.strip() or _TSV_COMMENT.match(line):
            continue
        numbered.append((lineno, line.split("\t")))

    if not numbered:
        return []

    first_row_lower = [cell.strip().lower() for cell in numbered[0][1]]
    has_header = "source" in first_row_lower
    if has_header:
        headers = [cell.strip() for cell in numbered[0][1]]
        data_rows = numbered[1:]
    else:
        headers = ["source", "reference"] + [
            f"col_{i}" for i in range(2, len(numbered[0][1]))
        ]
        data_rows = numbered

    ref_key = "reference" if "reference" in headers else (
        headers[1] if len(headers) > 1 else "reference")
    entries, missing_ref = [], []
    for lineno, row in data_rows:
        entry = {}
        for i, cell in enumerate(row):
            entry[headers[i] if i < len(headers) else f"col_{i}"] = cell
        if not str(entry.get(ref_key, "")).strip():
            missing_ref.append(lineno)
        entries.append(entry)

    if missing_ref and len(missing_ref) < len(entries):
        shown = ", ".join(str(n) for n in missing_ref[:8])
        more = f" (and {len(missing_ref) - 8} more)" if len(missing_ref) > 8 else ""
        raise ValueError(
            f"{path}: {len(missing_ref)} of {len(entries)} rows have no "
            f"reference ({ref_key!r} column) — line(s) {shown}{more}. A row "
            "without a reference would be scored as a miss. Fix or remove "
            "those rows; comment lines must start with '# '."
        )
    return entries


# Public: nmt-forge reads a user's TSV through this same function, so a test
# file means the same rows to the harness and to forge.
load_tsv = _load_tsv


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


# ---------------------------------------------------------------------------
# Steward sidecar: <corpus>.champollion.json
# ---------------------------------------------------------------------------

#: Suffix of the metadata file a data steward puts next to ANY corpus file
#: (TSV, JSONL, IGT, parallel text, JSON) to state its terms.
SIDECAR_SUFFIX = ".champollion.json"
#: The one transmission value a steward can set: only a model on this machine
#: may ever see the text. (Registry tiers use the same word.)
LOCAL_ONLY = "local-only"


def read_steward_sidecar(corpus_path) -> dict:
    """Metadata a data steward declared next to a corpus file, or {}.

    WHY: a community's own test set is usually a TSV or a pair of text files —
    formats with no envelope — so until now it had no way to say "this must
    never leave our machine", and protection rested on whoever ran the tool
    remembering to pick a local model (synthetic hospital persona,
    2026-10-03). The sidecar ``<file>.champollion.json`` carries:

        {"transmission": "local-only"}   only a model on this machine may see it
        {"license": "...", "segment": "held_out", "id": "..."}   as in a JSON envelope

    It can only make a corpus STRICTER: a sidecar never loosens what a JSON
    envelope or a registry entry says (see merge_steward_sidecar).
    """
    path = Path(str(corpus_path) + SIDECAR_SUFFIX)
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        # Fail loud: a steward wrote this to restrict the data; a typo must
        # not silently make it unrestricted.
        raise ValueError(f"Could not read {path.name}: {e}. Fix the file — it "
                         "states how this corpus may be used, and it is not "
                         "skipped when unreadable.") from e
    if not isinstance(data, dict):
        raise ValueError(f"{path.name} must be a JSON object, e.g. "
                         '{"transmission": "local-only"}.')
    t = data.get("transmission")
    if t is not None and t != LOCAL_ONLY:
        raise ValueError(f"{path.name}: transmission must be "
                         f'"{LOCAL_ONLY}" (the only restriction a sidecar '
                         f"sets); got {t!r}.")
    return data


def registered_card(corpus_path, side: dict | None = None) -> dict | None:
    """The corpora card a steward registered for THIS file, or None.

    ``champollion register-corpus --data <file>`` writes the card wherever
    the steward chose (next to the data, ``--out``, …) and records it in the
    sidecar: ``card`` (a path, relative to the data file's folder) and
    ``sha256`` (of the data file at registration). The card is honoured only
    while the file is the one it describes: a changed file (sha256 differs)
    no longer gets the card's id or grade — its metadata would be a claim
    about other text. Fails soft (None + a printed reason) because the card
    is descriptive; the sidecar's restrictions apply either way.

    Returns ``{"id", "path", "contamination", "contamination_reasoning"}``
    read verbatim from the card — ids are never re-derived here.
    """
    side = read_steward_sidecar(corpus_path) if side is None else side
    pointer = side.get("card") if side else None
    if not pointer:
        return None
    data = Path(str(corpus_path))
    card_path = Path(str(pointer)).expanduser()
    if not card_path.is_absolute():
        card_path = data.parent / card_path
    if not card_path.is_file():
        print(f"  Steward:     the sidecar names card {pointer} but it is not "
              f"at {card_path} — the card's id and grade are not applied")
        return None
    try:
        card = json.loads(card_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"  Steward:     card {card_path} is unreadable ({exc}) — its "
              f"id and grade are not applied")
        return None
    if not isinstance(card, dict) or not str(card.get("id") or "").strip():
        print(f"  Steward:     card {card_path} has no id — not applied")
        return None
    recorded = str(side.get("sha256") or card.get("sha256") or "").strip().lower()
    if recorded and data.is_file():
        import hashlib
        now = hashlib.sha256(data.read_bytes()).hexdigest()
        if now != recorded:
            print(f"  Steward:     {data.name} changed since it was registered "
                  f"as {card['id']} (sha256 {recorded[:12]}… then, "
                  f"{now[:12]}… now) — the card's id and grade are not "
                  f"applied. Re-register the file to describe this version.")
            return None
    contam = card.get("contamination") or {}
    return {
        "id": str(card["id"]).strip(),
        "path": str(card_path),
        "contamination": (contam.get("risk") if isinstance(contam, dict)
                          else contam),
        "contamination_reasoning": (contam.get("reasoning")
                                    if isinstance(contam, dict) else None),
    }


def merge_steward_sidecar(corpus_path, dataset_meta: dict) -> dict:
    """Fold a steward sidecar into a corpus's metadata — strictness only.

    ``transmission: local-only`` and a sealed ``segment`` always apply; a
    ``license`` / ``id`` only fills a gap (the envelope's own statement wins).
    The registered card the sidecar points at (``registered_card``) fills the
    same gaps with its ``id`` and ``contamination`` grade, so a run on the
    file is a run on the registered set — not on an anonymous file stem
    (synthetic school + hospital personas, Round 2, 2026-10-03).
    """
    side = read_steward_sidecar(corpus_path)
    if not side:
        return dataset_meta
    meta = dict(dataset_meta or {})
    if side.get("transmission") == LOCAL_ONLY:
        meta["transmission"] = LOCAL_ONLY
        print(f"  Steward:     marked local-only ({Path(str(corpus_path)).name}"
              f"{SIDECAR_SUFFIX}) — only a model on this machine may see it")
    if str(side.get("segment") or "").strip().lower() in ("held_out", "gold_standard"):
        meta["segment"] = side["segment"]
    card = registered_card(corpus_path, side)
    if card is not None:
        meta.setdefault("corpus_card", {"id": card["id"], "path": card["path"]})
        if not meta.get("id"):
            meta["id"] = card["id"]
        if card.get("contamination") and not meta.get("contamination"):
            meta["contamination"] = card["contamination"]
            meta["contamination_source"] = f"corpus card {card['id']}"
        print(f"  Registered:  {card['id']} (card {card['path']})")
    for k in ("license", "id"):
        if side.get(k) and not meta.get(k):
            meta[k] = side[k]
    return meta


def marked_local_only(*paths) -> bool:
    """True when a steward marked this corpus local-only, read WITHOUT loading
    its entries: a ``<file>.champollion.json`` sidecar next to any of its
    files, or a JSON corpus's own envelope (``dataset.transmission``).

    The eval-pack gate runs before the corpus is loaded, and metric discovery
    may run on a log long after; both must see the mark the provider gate
    sees (transmission_policy.resolve_transmission_policy). An unreadable
    sidecar still fails loud (read_steward_sidecar).
    """
    for p in paths:
        if not p:
            continue
        if read_steward_sidecar(p).get("transmission") == LOCAL_ONLY:
            return True
        path = Path(str(p))
        if path.suffix.lower() == ".json" and path.is_file():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue  # not a harness JSON envelope; the loader will say so
            block = raw.get("dataset") if isinstance(raw, dict) else None
            if (isinstance(block, dict) and str(block.get("transmission") or "")
                    .strip().lower() == LOCAL_ONLY):
                return True
    return False


# ---------------------------------------------------------------------------
# Marks follow the text: sidecars on files DERIVED from a protected corpus
# ---------------------------------------------------------------------------

#: Where a derived file's sidecar says its mark came from — the same key and
#: body shape nmt-forge writes on the pieces it carves (forge privacy.py
#: ``carry_mark``): the source's own terms + ``derived_from`` + ``written_by``.
DERIVED_KEY = "derived_from"
_SEALED_SEGMENTS = ("held_out", "gold_standard")


def derived_mark(*run_docs) -> dict:
    """The terms a file derived from these runs must carry, or ``{}``.

    ``run_docs`` are RunLogs / TestReports (anything with the run's
    ``config``; a RunLog also has ``provenance``). A file is derived from a
    protected corpus when the harness withholds that corpus's sentences from
    the terminal (``transmission_policy.withheld_text_reason``: local-only,
    sealed or consent-required); then the mark is the corpus's own terms, in
    the sidecar vocabulary ``read_steward_sidecar`` reads:

    * ``transmission: local-only`` — the steward's mark; also written for a
      sealed corpus with no sealed segment to state (e.g. a quarantined set)
      and for a consent-required corpus with no license string to carry,
      because the sidecar has no other word for "never remote" and local-only
      enforces exactly that (it resolves to the same sealed mode);
    * ``segment`` — a sealed ``held_out`` / ``gold_standard`` segment;
    * ``license`` — the declared license (a LicenseRef-* keeps the derived
      file consent-required wherever it goes).

    Several runs (``compare``) merge strictly: any protection on any input
    applies to the output. A TestReport is read together with the RunLog it
    names (``source_log``), which carries the corpus metadata a report omits.
    """
    from mt_eval_harness.transmission_policy import (
        MODE_CONSENT_REQUIRED, MODE_SEALED, withheld_text_reason)

    docs: list = []
    for doc in run_docs:
        docs.append(doc)
        if (isinstance(doc, dict) and doc.get("provenance") is None
                and doc.get("source_log")):
            try:
                docs.append(json.loads(Path(str(doc["source_log"]))
                                       .read_text(encoding="utf-8")))
            except (OSError, ValueError):
                pass   # the report's own config still decides
    mark: dict = {}
    for doc in docs:
        if not isinstance(doc, dict) or not withheld_text_reason(doc):
            continue
        config = doc.get("config") or {}
        pol = config.get("transmission_policy") or {}
        pol = pol if isinstance(pol, dict) else {}
        meta = (doc.get("provenance") or {}).get("dataset_meta") or {}
        seg = str(meta.get("segment") or "").strip()
        lic = str(meta.get("license") or "").strip()
        paths = [config.get(k) for k in ("corpus_path", "source_file",
                                          "reference_file") if config.get(k)]
        try:
            marked = marked_local_only(*paths)
        except ValueError:
            marked = True   # an unreadable mark is a mark
        local = (str(meta.get("transmission") or "").strip().lower() == LOCAL_ONLY
                 or str(pol.get("tier") or "").strip().lower() == LOCAL_ONLY
                 or marked)
        if seg.lower() in _SEALED_SEGMENTS:
            mark["segment"] = seg
        if lic:
            mark.setdefault("license", lic)
        mode = pol.get("mode")
        if (local
                or (mode == MODE_SEALED and seg.lower() not in _SEALED_SEGMENTS)
                or (mode == MODE_CONSENT_REQUIRED and not lic)):
            mark["transmission"] = LOCAL_ONLY
        if not mark:
            # Withheld for a reason the fields above cannot restate: never
            # write an unmarked derived file of a protected corpus.
            mark["transmission"] = LOCAL_ONLY
    return mark


def write_derived_sidecar(out_path, mark: dict, *, derived_from: str,
                          written_by: str) -> Path | None:
    """Write ``<out_path>.champollion.json`` carrying ``mark`` (from
    :func:`derived_mark`) plus where it came from; None when ``mark`` is
    empty. Same shape as nmt-forge's carried sidecars, so the next tool —
    ``mt-eval``, forge, or an agent going through either — reads the derived
    file as protected as its corpus. A sidecar can only make a file stricter
    (``merge_steward_sidecar``)."""
    if not mark:
        return None
    side = Path(str(out_path) + SIDECAR_SUFFIX)
    body = dict(mark, **{DERIVED_KEY: derived_from, "written_by": written_by})
    side.write_text(json.dumps(body, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8")
    return side


def derived_file_note(out_path, mark: dict) -> str:
    """The one line a command prints after writing a marked derived file."""
    terms = ", ".join(f"{k} {v}" for k, v in mark.items())
    return (f"  {Path(str(out_path)).name} holds the corpus sentences and is "
            f"marked like its corpus ({terms}): {Path(str(out_path)).name}"
            f"{SIDECAR_SUFFIX}")


def load_corpus(config: RunConfig) -> tuple[list[dict], dict]:
    """Load entries from a corpus in any supported format.

    Format resolution:
        1. If config.source_file and config.reference_file are set,
           load as parallel text (ignores config.corpus_path).
        2. Otherwise, detect format from config.corpus_path extension:
           - .jsonl → JSONL
           - .tsv / .tab → TSV
           - .igt (or .txt with \\t / \\g tier markers) → IGT (SIGMORPHON layout)
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
        # The steward's sidecar may sit next to either file.
        meta = merge_steward_sidecar(ref, merge_steward_sidecar(src, {}))
        _adopt_registered_id(config, meta)
        return _apply_filters(entries, config), meta

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
    dataset_meta = merge_steward_sidecar(corpus_path, dataset_meta)
    _adopt_registered_id(config, dataset_meta)
    return _apply_filters(entries, config), dataset_meta


def _adopt_registered_id(config: RunConfig, meta: dict) -> None:
    """A file a steward registered runs under its registered id.

    The same nurse-checked TSV was 'eval-eng-crk-our-school-dev-v1' on its
    card, 'teacher_reviewed_test' on run cards (the file stem) and
    'project-test' in a forge report — three names for one set, so two runs
    on it were not visibly the same set (synthetic school persona, Round 2).
    The id comes from the card / sidecar verbatim; an explicit --dataset-id
    or a JSON envelope's own id still wins, and the file name stays on the
    run as ``corpus_path``.
    """
    if config.dataset_id or not meta:
        return
    card = meta.get("corpus_card") or {}
    rid = card.get("id") or meta.get("id") or ""
    if rid:
        config.dataset_id = rid
        print(f"  Dataset ID:  {rid} (registered card"
              + ("" if card else " — from the steward sidecar") + ")")


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
