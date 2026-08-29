#!/usr/bin/env python3
"""corpus_content_scan.py — the one corpus-content detector (SSOT).

Champollion NEVER hosts corpus CONTENT in git. Corpora are fetch-from-source
from their third-party hosts; only metadata cards + builder scripts live in the
repo. This module is the single, blunt, license-agnostic test for "is this file
parallel/eval corpus content?" — used by both the launch report and the
sovereignty gate (scripts/quarantine_gate.sh).

CONTENT (flagged) = a file that carries many translation pairs / parallel
source-target text / reference answers / eval gold:
  - JSON list of objects each pairing a source-like and a target-like field
  - JSON nested translation objects: {"translation": {"<iso>": ..., "<iso>": ...}}
    (or a bare {"<iso>": ..., "<iso>": ...}) for ANY language codes — the
    dominant HuggingFace/OPUS/FLORES/WMT shape
  - JSON "parallel arrays": a source-named list[str] AND a target-named list[str],
    or two-or-more language-code-named lists of real text
  - JSON "split corpus" sides: a monolingual record list ([{id, text}, ...]) or a
    translations-only dump ({"translations": {"0": "...", "1": "..."}}) — each
    half of a corpus split across files, so no single file holds both sides
  - JSONL/NDJSON where most lines are such pair objects
  - CSV/TSV whose header pairs a source-like and a target-like column, or names
    two-or-more language columns; headerless TSV of 2+ parallel text columns
  - TXT parallel text: most lines split source/target on a tab / " ||| " / " → "
  - "*.blocks.json" web-scrape block dumps (list of {text, ...} blocks)

NOT content (kept):
  - metadata cards (corpora-cards/, language-cards/), schemas, registry/queue
    catalogues — these describe corpora, they do not carry the pairs
  - reference language DBs (Glottolog/CLDF languoid tables, monolingual lexica)
  - code, docs, prompts, config, scores-only leaderboard summaries

Anything genuinely needed as a small synthetic test fixture is named in
ALLOWLIST below. The license of a file is irrelevant to this gate: CC-BY,
CC0, public-domain and proprietary corpus content are ALL blocked. The
license boundary is enforced elsewhere; this is the no-hosting boundary.

Usage:
  corpus_content_scan.py                 # gate mode: scan tracked files,
                                         #   print non-allowlisted violations,
                                         #   exit 1 if any, else 0
  corpus_content_scan.py --report        # print every flagged tracked file
                                         #   (allowlisted ones marked), exit 0
  corpus_content_scan.py PATH [PATH...]  # classify the given files, exit 1 if
                                         #   any is non-allowlisted content
"""
from __future__ import annotations

import csv
import io
import json
import re
import subprocess
import sys
from pathlib import Path

# --- tuning ----------------------------------------------------------------

# A file needs at least this many parallel pairs to count as content. Set low
# on purpose: even small "easy slices" (62-sample, 90-phase1) are corpus content.
PAIR_THRESHOLD = 4

# An absolute count of real prose-prose pairs in the (strided) sample marks a file
# as content even when pairs are a MINORITY of records — this defeats decoy-dilution
# (bury the corpus under >50% filler dicts, or keep it just under a majority). Set
# to PAIR_THRESHOLD: because _dict_is_pair is strict (real prose on BOTH sides, code
# manifests + provenance fields excluded), the old >50% majority heuristic was
# redundant for false-positive avoidance — verified against the whole real tree.
ABS_PAIR_TRIGGER = PAIR_THRESHOLD

# Don't try to parse files larger than this (bytes); a multi-hundred-MB JSON is
# never a hand-checked fixture, and the recursive walk would be wasteful. Such a
# file is FLAGGED on size alone — not skipped — because the repo hosts no corpus
# content and a tracked data file too big to inspect is a smuggling vector by
# construction. Allowlist genuine large reference files by name. See classify().
MAX_PARSE_BYTES = 80 * 1024 * 1024

# Text data formats we parse for content. Beyond the original json/jsonl/tsv/csv/
# txt: .tab (TSV variant), and the translation-interchange / structured formats a
# corpus is commonly shipped as — TMX/XML, gettext PO, YAML.
# (Markdown is deliberately NOT here: in a 1,400+ .md doc tree, table headers of
# ordinary short words — "day"/"why"/"ed"/"mqm" — spuriously parse as language
# codes, and a table column of prose is indistinguishable from illustrative
# example translations. Markdown-table smuggling is a documented low-severity
# residual — see the meta-audit report — mitigated by human doc review + the
# NAMED filename check, and implausible at real-corpus scale.)
DATA_EXTS = {
    ".json", ".jsonl", ".ndjson", ".tsv", ".csv", ".txt", ".tab",
    ".tmx", ".xml", ".po", ".pot", ".yaml", ".yml",
}

# Binary / compressed / columnar data blobs we CANNOT parse. The repo hosts NO
# corpus content (fetch-from-source doctrine), so a tracked file with one of
# these extensions is a smuggling vector by construction — flagged by extension
# alone. Legitimate reference archives (e.g. the Glottolog languoid zip) are
# named in ALLOWLIST_EXACT.
BINARY_DATA_EXTS = {
    ".parquet", ".arrow", ".feather", ".gz", ".bz2", ".zst", ".xz", ".7z",
    ".tgz", ".xlsx", ".ods", ".zip", ".npy", ".npz", ".pkl", ".pickle",
}

# Extensions that LOOK like a language code — Moses/OPUS ship parallel corpora as
# corpus.en / corpus.crk / corpus.zh-Hans. We run the delimited + plain-text
# classifiers on these so a bilingual file mis-extensioned as .en still trips.
# (A truly monolingual side — one sentence per line, no delimiter — is a
# documented residual: flagging any prose-per-line file would false-positive on
# prose docs.)
_LANGCODE_EXT_RE = re.compile(r"^\.[a-z]{2,3}([_-][A-Za-z]{2,4})?$")

# Field names that name the SOURCE side of a translation pair.
SOURCE_KEYS = {
    "english", "eng", "en", "source", "src", "source_text", "src_text",
    "source_sentence", "sourcetext", "source_string", "input_text",
}
# Field names that name the TARGET / reference side of a translation pair.
TARGET_KEYS = {
    "target", "tgt", "reference", "ref", "expected", "expected_cree",
    "expected_translation", "cree", "cree_sro", "gold", "gold_standard",
    "translation", "translated", "raw_output", "pipeline_cree", "hypothesis",
    "target_text", "target_sentence", "targettext", "target_string",
}

# Field names that, ON THEIR OWN, mark a value as a CORPUS SEGMENT — used by the
# monolingual split-corpus detector, where only one side of a pair is present so
# we can't lean on SOURCE+TARGET co-occurrence to disambiguate. Deliberately
# EXCLUDES the bare "source"/"src"/"target"/"tgt"/"reference"/"ref": on metadata
# cards those name a provenance or citation field (registry datasets[].source =
# "Meta AI (NLLB Team)", card experts[].source = "resources.fsts[…]") just as
# often as a corpus side, so counting them here would mislabel metadata as
# content. The pair detectors keep the full SOURCE_KEYS/TARGET_KEYS sets, where
# the source+target co-occurrence makes the corpus reading unambiguous.
SEGMENT_FIELD_KEYS = {
    "text", "content", "sentence", "sent", "segment", "line", "utterance",
    "source_text", "src_text", "source_sentence", "sourcetext", "source_string",
    "input_text", "target_text", "tgt_text", "target_sentence", "targettext",
    "target_string", "english", "eng", "cree", "cree_sro", "expected_cree",
    "expected_translation", "pipeline_cree", "translation", "translated",
    "raw_output", "hypothesis", "expected", "gold", "gold_standard",
}

# Declared synthetic / tiny test fixtures + specific legitimate reference files
# that are allowed to carry pair-shaped (or, for the reference archive, binary)
# content. KEEP THIS NARROW — never list a real third-party corpus dump here.
#
# Two kinds, deliberately separated so the fixture DIRECTORIES cannot be abused
# as a blanket to smuggle a real corpus dump:
#   • ALLOWLIST_EXACT       — specific files, matched literally, no size cap.
#   • ALLOWLIST_FIXTURE_DIRS — synthetic-fixture directories; ONLY files DIRECTLY
#     inside (no deeper nesting) AND under ALLOWLIST_FIXTURE_MAX_BYTES are exempt.
#     (fnmatch's "*" matches "/", so the old "dir/*" globs exempted a real corpus
#     dropped at ANY depth under the dir, of ANY size — this closes that.)
ALLOWLIST_EXACT = {
    # Tiny hand-authored synthetic demo corpus (5 trivial eng->spa lines) used by
    # arena/examples/basic_run/run.py to show how to run the harness. Not a
    # third-party corpus; safe to ship.
    "arena/examples/basic_run/sample_corpus.json",
    # Glottolog languoid table (zipped) — a monolingual language-metadata
    # REFERENCE DB, explicitly not-corpus under the doctrine; loaded by the card
    # factory. Named here so the binary-extension check does not flag it.
    "cli/data/glottolog/glottolog_languoid.csv.zip",
    # ISO 639-5 language-COLLECTION code table (Library of Congress controlled
    # vocabulary: URI, code, English label, French label). A language-metadata
    # REFERENCE STANDARD used by arena/scripts/iso_resolution.py for the
    # macrolanguage doctrine — NOT corpus content. The English/French *label*
    # columns (e.g. "Algonquian languages" / "algonquines, langues") name
    # language GROUPS, not translation pairs; the pair-shape heuristic flags the
    # two-language-label layout, so it is named here like the Glottolog table.
    "cli/data/iso639-5/iso639-5.tsv",
}
ALLOWLIST_FIXTURE_DIRS = (
    # Detector's own self-test fixtures (planted content that MUST trip the gate
    # in the isolated unit test, but are allowlisted in normal repo scans).
    "scripts/tests/fixtures/corpus_content",
    # Organizer-node contest test fixtures: an INVENTED toy language pair
    # (qaa/qab — ISO 639-2 reserved-for-local-use codes; "mira sol volu" is
    # made-up text, CC0, authored in-repo). No real corpus content; exists so
    # contest-node tests run offline (the sovereign multisig plan synthetic-first rule).
    "arena/tests/fixtures/contest_synthetic",
)
# A synthetic fixture is tiny; a real corpus dump is not. 64 KiB is far above any
# hand-authored fixture (the largest today is ~1 KB) and far below any real slice.
ALLOWLIST_FIXTURE_MAX_BYTES = 64 * 1024


def _is_allowlisted(rel_path: str, size: int | None = None) -> bool:
    if rel_path in ALLOWLIST_EXACT:
        return True
    for d in ALLOWLIST_FIXTURE_DIRS:
        prefix = d + "/"
        if rel_path.startswith(prefix) and "/" not in rel_path[len(prefix):]:
            # Direct child of a synthetic-fixture dir: exempt only if small enough
            # to be a real fixture (size unknown → be permissive, as in unit tests
            # that classify by path without a file on disk).
            return size is None or size <= ALLOWLIST_FIXTURE_MAX_BYTES
    return False


# --- text/value heuristics -------------------------------------------------

# A bare ISO-ish language code: "en", "eng", "ber-Latn", "ar_EG", "cmn-Hans".
# Used to tell a pair-GENERATION manifest ({"source":"aar","target":"eng",...})
# apart from a real translation pair ({"source":"the dog","target":"atim"}).
_LANGCODE_RE = re.compile(r"^[a-z]{2,3}([_-][A-Za-z]{2,4})?$")

# Keys whose presence in an object marks it as a pair-GENERATION / pinning
# manifest entry (which pairs exist + their pinned sha), not parallel content.
_MANIFEST_KEYS = {"sha256", "srccode", "tgtcode", "sizeunit", "sizeperpair"}


def _looks_like_text(value) -> bool:
    """A pair side should be a non-trivial string, not a code/flag/number."""
    return isinstance(value, str) and len(value.strip()) >= 2


# A URL / URI — never a translation segment; guards metadata `url` fields.
_URI_RE = re.compile(r"^[a-z][a-z0-9+.-]*://", re.IGNORECASE)


def _is_sentence_text(value) -> bool:
    """Real natural-language prose, not a code / label / id / URL / number.

    Stricter than _looks_like_text: used by the split-corpus detectors, where a
    SINGLE side is present, so the strong SOURCE+TARGET co-occurrence signal is
    gone and we must judge "is this a sentence?" on the string alone. A segment
    is prose if it is reasonably long AND either multi-word or quite long, holds
    letters, and is not a URI. This keeps langcodes ("eng"), model slugs
    ("gpt-4o-mini"), enum labels ("medium") and ids out.
    """
    if not isinstance(value, str):
        return False
    s = value.strip()
    if len(s) < 12 or _URI_RE.match(s):
        return False
    if not any(ch.isalpha() for ch in s):
        return False
    if " " in s:
        return True  # multi-word -> prose (covers all space-using scripts)
    # No spaces: accept only space-less SCRIPTS (CJK, Thai, Khmer, …) — these
    # carry a non-ASCII letter. Reject ASCII single tokens: slugs, URL paths,
    # identifiers, hashes (e.g. "/fr/apple-watch-series-10/", "com.foo.bar").
    if "/" in s:
        return False
    return any(ord(ch) > 127 and ch.isalpha() for ch in s)


def _is_langcode(value) -> bool:
    return isinstance(value, str) and bool(_LANGCODE_RE.match(value.strip()))


def _translation_value_obj(value) -> bool:
    """A nested HuggingFace/OPUS "translation" feature object:
    {"<iso>": "<text>", "<iso>": "<text>", ...} — keys are >=2 language codes,
    values carry real prose. This is the dominant parallel-corpus JSON shape and
    matches ANY language codes, not just named source/target fields."""
    if not isinstance(value, dict) or len(value) < 2:
        return False
    keys = [str(k).strip() for k in value.keys()]
    if not all(_is_langcode(k) for k in keys):
        return False
    str_vals = [v for v in value.values() if isinstance(v, str)]
    return len(str_vals) >= 2 and any(_is_sentence_text(v) for v in str_vals)


def _stride(seq, cap: int) -> list:
    """Up to `cap` elements spread EVENLY across `seq` (not just the head), so a
    decoy prefix/suffix can't hide the corpus from a windowed sample."""
    n = len(seq)
    if n <= cap:
        return list(seq)
    step = n / cap
    return [seq[int(i * step)] for i in range(cap)]


def _sibling_langcode_pair(node: dict) -> bool:
    """>=2 SIBLING keys that are language codes whose values are sentence prose,
    tolerating extra non-langcode keys (id, idx, domain, split, notes …). This
    generalizes the nested-translation-object shape so that adding a junk key to
    a {"en": .., "fr": ..} row — or a flat {"id", "en", "crk"} record whose two
    langcodes are not both in the named SOURCE/TARGET sets — no longer evades."""
    if not isinstance(node, dict):
        return False
    lang_vals = [v for k, v in node.items()
                 if _is_langcode(str(k)) and _is_sentence_text(v)]
    return len(lang_vals) >= 2


def _dict_is_pair(node: dict) -> bool:
    if not isinstance(node, dict):
        return False
    # Nested translation feature: {"translation": {"de": .., "en": ..}} or a
    # bare {"de": .., "en": ..} object — match before the named-field test so
    # ANY language codes are caught, not only declared source/target fields.
    if _translation_value_obj(node):
        return True
    if any(_translation_value_obj(v) for v in node.values()):
        return True
    # >=2 sibling language-code fields with prose values, ignoring junk keys —
    # at this level ({id, en, crk}) or nested one deep ({translation:{en,crk,domain}}).
    if _sibling_langcode_pair(node):
        return True
    if any(_sibling_langcode_pair(v) for v in node.values() if isinstance(v, dict)):
        return True
    keys = {str(k).lower() for k in node.keys()}
    src = keys & SOURCE_KEYS
    tgt = keys & TARGET_KEYS
    if not (src and tgt):
        return False
    # A pinning manifest entry (source/target are language CODES, plus
    # srcCode/sha256/size siblings) is metadata, not content — skip it.
    if keys & _MANIFEST_KEYS:
        return False

    def _val(kset):
        for k in node:
            if str(k).lower() in kset:
                return node[k]
        return None
    src_val, tgt_val = _val(src), _val(tgt)
    # Both sides being bare language codes => a "which pairs exist" manifest,
    # not translation text (e.g. {"source":"aar","target":"eng"}).
    if _is_langcode(src_val) and _is_langcode(tgt_val):
        return False
    # At least one matched side must hold real text — guards against metadata
    # objects that merely happen to have a "source" code and a "reference" URL.
    return _looks_like_text(src_val) or _looks_like_text(tgt_val)


def _list_of_pairs(node: list) -> bool:
    dicts = [e for e in node if isinstance(e, dict)]
    if len(dicts) < PAIR_THRESHOLD:
        return False
    sample = _stride(dicts, 400)
    pairs = sum(_dict_is_pair(e) for e in sample)
    if pairs < PAIR_THRESHOLD:
        return False
    # Majority-of-sample OR an unambiguous absolute count. The absolute trigger
    # defeats decoy-dilution: a real corpus buried under >50% filler dicts is
    # still corpus content.
    return pairs >= 0.5 * len(sample) or pairs >= ABS_PAIR_TRIGGER


def _parallel_arrays(node: dict) -> bool:
    """A source-named list[str] AND a target-named list[str], both long — or two
    or more language-code-named lists of real prose (e.g. {"en": [...], "fr": [...]})."""
    def _strlist(v):
        return (isinstance(v, list) and len(v) >= PAIR_THRESHOLD
                and sum(_looks_like_text(x) for x in v[:50]) >= min(PAIR_THRESHOLD, len(v[:50])))
    lower = {str(k).lower(): v for k, v in node.items()}
    has_src = any(_strlist(lower[k]) for k in lower if k in SOURCE_KEYS)
    has_tgt = any(_strlist(lower[k]) for k in lower if k in TARGET_KEYS)
    if has_src and has_tgt:
        return True
    # Two or more language-code-named columns, each a long list of real prose.
    def _sentlist(v):
        return (isinstance(v, list) and len(v) >= PAIR_THRESHOLD
                and sum(_is_sentence_text(x) for x in v[:50]) >= 0.6 * len(v[:50]))
    langcols = [k for k in lower if _is_langcode(k) and _sentlist(lower[k])]
    return len(langcols) >= 2


def _record_text_list(node: list) -> bool:
    """One side of a SPLIT corpus: a list of >=THRESHOLD records each carrying a
    natural-language segment in a known text-bearing field — e.g. a per-language
    FLORES fixture [{"id": "0", "text": "<sentence>"}, ...]. No target side is
    present, so _list_of_pairs misses it; this catches the monolingual half."""
    if not isinstance(node, list):
        return False
    dicts = [e for e in node if isinstance(e, dict)]
    if len(dicts) < PAIR_THRESHOLD:
        return False
    sample = _stride(dicts, 400)

    def _has_segment(e):
        return any(str(k).lower() in SEGMENT_FIELD_KEYS and _is_sentence_text(e[k])
                   for k in e)
    hits = sum(_has_segment(e) for e in sample)
    if hits < PAIR_THRESHOLD:
        return False
    return hits >= 0.6 * len(sample) or hits >= ABS_PAIR_TRIGGER


def _indexed_text_map(node: dict) -> bool:
    """The other half of a SPLIT corpus: a dict mapping >=THRESHOLD index-like
    keys (0,1,2,... or language codes) to natural-language sentences — a
    translations-only result dump, e.g. {"translations": {"0": "...", "1": "..."}}.
    The index/langcode key requirement keeps i18n message catalogues (dotted
    string ids) and glossaries (term keys) from tripping."""
    if not isinstance(node, dict) or len(node) < PAIR_THRESHOLD:
        return False
    str_vals = [(k, v) for k, v in list(node.items())[:500] if isinstance(v, str)]
    if len(str_vals) < PAIR_THRESHOLD:
        return False
    texty = sum(_is_sentence_text(v) for _, v in str_vals)
    if texty < PAIR_THRESHOLD or texty < 0.6 * len(str_vals):
        return False
    keys_ok = sum(1 for k, _ in str_vals
                  if str(k).strip().isdigit() or _is_langcode(str(k)))
    return keys_ok >= 0.6 * len(str_vals)


def _blocks_dump(node) -> bool:
    """Web-scrape block dump: a list of >=THRESHOLD {text:...} blocks."""
    if not isinstance(node, list) or len(node) < PAIR_THRESHOLD:
        return False
    texty = [e for e in node[:200] if isinstance(e, dict)
             and any(str(k).lower() in ("text", "content") and _looks_like_text(e[k]) for k in e)]
    return len(texty) >= PAIR_THRESHOLD and len(texty) >= 0.5 * len(node[:200])


# Delimiters a "source<delim>target" line is packed with.
_LINE_PAIR_DELIMS = ("\t", " ||| ", "|||", " → ", "→")


def _delimited_pair_lines(lines, need_ratio=0.6, delims=_LINE_PAIR_DELIMS) -> bool:
    """Do most of `lines` split, on a single consistent delimiter, into two
    SENTENCE-PROSE halves? Sentence-prose on BOTH sides (not merely 'looks like
    text') is the load-bearing guard: it excludes identifier/path/code mappings
    ('cometScore → comet_score'), filename lists, and doc arrow-lists of short
    code labels ('`llm` → OpenRouter'), while a real sentence corpus still trips.
    `delims` is narrowable: the embedded-in-one-string caller drops the arrow,
    which is heavily overloaded in prose docs ('ISO 639-3-Register → `code`…')
    that the dogfood translation memory stores verbatim."""
    sample = _stride([ln for ln in lines if ln.strip()], 300)
    if len(sample) < PAIR_THRESHOLD:
        return False
    for delim in delims:
        hits = 0
        for s in sample:
            parts = s.split(delim)
            if len(parts) == 2 and _is_sentence_text(parts[0]) and _is_sentence_text(parts[1]):
                hits += 1
        if hits >= PAIR_THRESHOLD and hits >= need_ratio * len(sample):
            return True
    return False


# Unambiguous parallel-corpus delimiters (Moses "|||", tab) — the arrow is dropped
# because "X → Y" pervades prose documentation as "provides/maps-to".
_UNAMBIGUOUS_PAIR_DELIMS = ("\t", " ||| ", "|||")


def _list_of_delimited_strings(node) -> bool:
    """A JSON array of "source<delim>target" STRINGS — the exact content the .txt
    classifier catches, merely wrapped in a JSON list to dodge the pair-of-dicts
    and parallel-array detectors (e.g. ["The dog runs. ||| atim pimipahtâw.", ...])."""
    if not isinstance(node, list):
        return False
    strs = [e for e in node if isinstance(e, str)]
    if len(strs) < PAIR_THRESHOLD:
        return False
    return _delimited_pair_lines(strs)


# A long, punctuation-free base64 token (whitespace tolerated). A natural-language
# string carries spaces AND punctuation (./,/?) which are NOT in the base64
# alphabet, so real prose never matches — only an actual encoded blob does.
_B64_BLOB_RE = re.compile(r"^[A-Za-z0-9+/\s]{512,}={0,2}$")


def _reclassify_bytes(payload: bytes, depth: int = 0) -> bool:
    """Does a decoded byte payload itself classify as corpus content? Tries UTF-8
    text (txt + JSON shapes) and one layer of gzip. Bounded recursion — this only
    runs on a leaf that already looked like an encoded blob, so cost is trivial."""
    if depth > 2 or not payload:
        return False
    # gzip magic → decompress one layer and re-test.
    if payload[:2] == b"\x1f\x8b":
        try:
            import gzip as _gzip
            return _reclassify_bytes(_gzip.decompress(payload), depth + 1)
        except Exception:
            return False
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError:
        return False
    if _classify_txt(text):
        return True
    try:
        return bool(_json_reason(json.loads(text)))
    except Exception:
        return False


def _embedded_text_reason(s: str):
    """A single string leaf that itself HIDES a corpus: either delimited parallel
    text pasted into one JSON string, or a base64 blob that decodes to content.
    Uses the SENTENCE-PROSE-both-sides check so the dogfood translation memory
    (tm.json — markdown blocks with '`llm` → OpenRouter' code-label arrow lists)
    and other legit multiline strings do not false-positive."""
    if not isinstance(s, str):
        return None
    st = s.strip()
    if "\n" in st and len(st) >= 40:
        lines = st.splitlines()
        if (len(lines) >= ABS_PAIR_TRIGGER
                and _delimited_pair_lines(lines, need_ratio=0.7,
                                          delims=_UNAMBIGUOUS_PAIR_DELIMS)):
            return "embedded parallel text inside a JSON/data string"
    if _B64_BLOB_RE.match(st):
        try:
            import base64 as _b64
            payload = _b64.b64decode(st, validate=False)
        except Exception:
            payload = None
        if payload and _reclassify_bytes(payload):
            return "base64-encoded corpus inside a JSON/data string"
    return None


# --- per-format classifiers ------------------------------------------------

def _json_reason(node, depth=0) -> str | None:
    """Walk JSON, returning the most specific corpus-content label found."""
    if depth > 12:
        return None
    if isinstance(node, list):
        if _list_of_pairs(node):
            return "parallel/eval pairs in JSON"
        if _record_text_list(node):
            return "monolingual text records (split-corpus side) in JSON"
        if _list_of_delimited_strings(node):
            return "delimited parallel strings in a JSON array"
        for v in node:
            r = _json_reason(v, depth + 1)
            if r:
                return r
        return None
    if isinstance(node, dict):
        if _parallel_arrays(node):
            return "parallel language arrays in JSON"
        if _indexed_text_map(node):
            return "indexed translations dump (split-corpus side) in JSON"
        for v in node.values():
            r = _json_reason(v, depth + 1)
            if r:
                return r
        return None
    if isinstance(node, str):
        # A corpus hidden inside one string value (delimited blob / base64).
        return _embedded_text_reason(node)
    return None


def _classify_json(path: Path, raw: str) -> str | None:
    try:
        data = json.loads(raw)
    except Exception:
        return None  # unparseable -> filename/format rules elsewhere handle it
    if path.name.endswith(".blocks.json") and _blocks_dump(data):
        return "web-scrape block dump (.blocks.json)"
    return _json_reason(data)


def _classify_jsonl(raw: str) -> str | None:
    lines = [ln for ln in raw.splitlines() if ln.strip()]
    if len(lines) < PAIR_THRESHOLD:
        return None
    pairs = 0
    parsed = 0
    for ln in lines[:300]:
        try:
            obj = json.loads(ln)
        except Exception:
            continue
        parsed += 1
        if isinstance(obj, dict) and _dict_is_pair(obj):
            pairs += 1
    if parsed and pairs >= PAIR_THRESHOLD and pairs >= 0.5 * parsed:
        return "parallel/eval pairs in JSONL"
    return None


def _headerless_parallel(rows: list, delim_label: str) -> str | None:
    """No usable header, but a stable >=2-column shape where two-or-more columns
    are mostly natural-language prose — headerless parallel text (OPUS/Moses,
    Tatoeba-style TSV). Requiring sentence-prose columns keeps numeric/code
    lookup tables out."""
    sample = rows[:300]
    widths = [len(r) for r in sample]
    width = max(set(widths), key=widths.count)  # modal column count
    if width < 2:
        return None
    wide = [r for r in sample if len(r) == width]
    if len(wide) < PAIR_THRESHOLD or len(wide) < 0.7 * len(sample):
        return None
    texty_cols = sum(
        1 for ci in range(width)
        if sum(_is_sentence_text(r[ci]) for r in wide) >= 0.6 * len(wide)
    )
    if texty_cols >= 2:
        return f"headerless parallel text columns ({delim_label}-delimited)"
    return None


def _classify_delimited(raw: str, delim: str) -> str | None:
    try:
        rows = list(csv.reader(io.StringIO(raw), delimiter=delim))
    except Exception:
        return None
    rows = [r for r in rows if any(c.strip() for c in r)]
    if len(rows) < PAIR_THRESHOLD + 1:  # header + >=THRESHOLD data rows
        return None
    header = [c.strip().lower() for c in rows[0]]
    hset = set(header)
    data = rows[1:]

    def _col_is_prose(name):
        """Do the DATA cells under column `name` mostly carry sentence prose?
        Guards against short-word column NAMES that only LOOK like langcodes
        (iso-639-3.tab's 'id'/'ref_name' → codes + one-word names, not prose)."""
        idxs = [i for i, h in enumerate(header) if h == name]
        if not idxs:
            return False
        ci = idxs[0]
        cells = [r[ci] for r in data[:300] if ci < len(r)]
        return bool(cells) and sum(_is_sentence_text(c) for c in cells) >= 0.6 * len(cells)

    src = hset & SOURCE_KEYS
    tgt = hset & TARGET_KEYS
    if src and tgt and _col_is_prose(sorted(src)[0]) and _col_is_prose(sorted(tgt)[0]):
        return f"parallel columns ({'/'.join(sorted(src))} + {'/'.join(sorted(tgt))})"
    # Two-or-more language-code-named columns (e.g. eng,fra or en\tfr\tde) whose
    # DATA is actually prose — not a code/metadata table with langcode-ish headers.
    langcols = [c for c in header if _is_langcode(c) and _col_is_prose(c)]
    if len(langcols) >= 2:
        return f"parallel language columns ({', '.join(langcols[:4])})"
    # Headerless parallel text — TSV only (bare commas are too common in prose to
    # assume an unheadered CSV is parallel content).
    if delim == "\t":
        return _headerless_parallel(rows, "tab")
    return None


def _classify_txt(raw: str) -> str | None:
    lines = [ln for ln in raw.splitlines() if ln.strip()]
    if len(lines) < PAIR_THRESHOLD:
        return None
    sample = lines[:300]
    for delim in ("\t", " ||| ", " → ", "→"):
        hits = 0
        for ln in sample:
            parts = ln.split(delim)
            if len(parts) == 2 and _looks_like_text(parts[0]) and _looks_like_text(parts[1]):
                hits += 1
        if hits >= PAIR_THRESHOLD and hits >= 0.6 * len(sample):
            label = {"\t": "tab", " ||| ": "|||", " → ": "arrow", "→": "arrow"}[delim]
            return f"parallel text lines ({label}-delimited)"
    return None


_SEG_RE = re.compile(r"<seg\b[^>]*>(.*?)</seg>", re.IGNORECASE | re.DOTALL)
_XLIFF_SRC_RE = re.compile(r"<source\b[^>]*>(.*?)</source>", re.IGNORECASE | re.DOTALL)
_XLIFF_TGT_RE = re.compile(r"<target\b[^>]*>(.*?)</target>", re.IGNORECASE | re.DOTALL)
_XML_TAG_RE = re.compile(r"<[^>]+>")


def _classify_xml(raw: str) -> str | None:
    """TMX / XLIFF / generic segment XML — the translation-memory interchange
    formats. TMX packs pairs as <tu><tuv><seg>text</seg>…; XLIFF as
    <source>/<target>. Detected by counting prose segments, no XML parser needed."""
    segs = [_XML_TAG_RE.sub("", m).strip() for m in _SEG_RE.findall(raw)]
    prose_segs = [s for s in segs if _is_sentence_text(s)]
    if len(prose_segs) >= PAIR_THRESHOLD:
        return "TMX/segment translation-memory content (.tmx/.xml)"
    srcs = [_XML_TAG_RE.sub("", m).strip() for m in _XLIFF_SRC_RE.findall(raw)]
    tgts = [_XML_TAG_RE.sub("", m).strip() for m in _XLIFF_TGT_RE.findall(raw)]
    if (sum(_is_sentence_text(s) for s in srcs) >= PAIR_THRESHOLD
            and sum(_is_sentence_text(t) for t in tgts) >= PAIR_THRESHOLD):
        return "XLIFF source/target translation pairs (.xml)"
    return None


_PO_MSGID_RE = re.compile(r'^\s*msgid\s+"(.*)"\s*$')
_PO_MSGSTR_RE = re.compile(r'^\s*msgstr\s+"(.*)"\s*$')


def _classify_po(raw: str) -> str | None:
    """gettext PO/POT — msgid/msgstr pairs. A UI message catalogue is NOT corpus
    (short labels); we require BOTH sides to be sentence prose for >=ABS_PAIR_TRIGGER
    entries, so only a bilingual SENTENCE corpus smuggled as .po trips."""
    lines = raw.splitlines()
    pairs = 0
    cur_id = None
    for ln in lines:
        m = _PO_MSGID_RE.match(ln)
        if m:
            cur_id = m.group(1)
            continue
        m = _PO_MSGSTR_RE.match(ln)
        if m and cur_id is not None:
            if _is_sentence_text(cur_id) and _is_sentence_text(m.group(1)):
                pairs += 1
            cur_id = None
    if pairs >= ABS_PAIR_TRIGGER:
        return "gettext PO bilingual sentence pairs (.po/.pot)"
    return None


def _classify_yaml(raw: str) -> str | None:
    """YAML corpus. When PyYAML is present we parse and reuse the JSON detectors
    (so a YAML pairs list / parallel arrays trip exactly as their JSON twins do,
    and nested i18n catalogues stay clean). Fallback (no PyYAML): a regex for the
    unambiguous list-of-pairs shape only."""
    try:
        import yaml  # PyYAML
        try:
            data = yaml.safe_load(raw)
        except Exception:
            return None
        r = _json_reason(data)
        return (r + " (YAML)") if r else None
    except ImportError:
        # Conservative fallback: "- src:/source:/en: …" list items each paired
        # with a sibling target/langcode value.
        blocks = re.split(r"^\s*-\s", raw, flags=re.MULTILINE)[1:]
        hits = 0
        for b in blocks:
            keys = re.findall(r"^\s*([A-Za-z][\w-]*)\s*:", b, flags=re.MULTILINE)
            kl = {k.lower() for k in keys}
            if (kl & SOURCE_KEYS and kl & TARGET_KEYS) or len([k for k in kl if _is_langcode(k)]) >= 2:
                hits += 1
        return "YAML translation pairs list" if hits >= PAIR_THRESHOLD else None


def classify(path: Path) -> str | None:
    """Return a reason string if `path` is corpus content, else None."""
    suffix = path.suffix.lower()
    # Binary / compressed / columnar data blobs — unparseable, flagged by
    # extension (the repo hosts no corpus; a tracked data blob is smuggling).
    if suffix in BINARY_DATA_EXTS:
        return f"binary/compressed data blob ({suffix}); corpora are fetch-from-source"
    is_langcode_ext = bool(_LANGCODE_EXT_RE.match(suffix))
    if suffix not in DATA_EXTS and not is_langcode_ext:
        return None
    try:
        size = path.stat().st_size
    except OSError:
        return None
    if size > MAX_PARSE_BYTES:
        # A tracked data file too big to parse is FLAGGED, not skipped.
        #
        # This used to `return None` — an unconditional silent pass that
        # contradicted MAX_PARSE_BYTES' own docstring. Combined with the
        # filename check in quarantine_gate.sh being narrow, an oversized
        # corpus dump could clear every layer of the gate by being too large to
        # inspect: the one property that should raise suspicion instead bought
        # immunity.
        #
        # The rule is deliberately size-alone rather than name-based (which is
        # what the old docstring promised), and it is the SAME reasoning
        # already applied to BINARY_DATA_EXTS above: the repo hosts no corpus
        # content by doctrine, so a tracked data-extension file of this size is
        # a smuggling vector by construction, whatever it is called. A
        # legitimate large reference file earns an ALLOWLIST_EXACT entry with
        # its size pinned — an explicit, reviewable act.
        return (f"too large to parse ({size:,} bytes > {MAX_PARSE_BYTES:,}); "
                "corpora are fetch-from-source")
    try:
        raw = path.read_text(encoding="utf-8", errors="strict")
    except (UnicodeDecodeError, OSError):
        return None
    if suffix == ".json":
        return _classify_json(path, raw)
    if suffix in (".jsonl", ".ndjson"):
        return _classify_jsonl(raw)
    if suffix in (".tsv", ".tab"):
        return _classify_delimited(raw, "\t")
    if suffix == ".csv":
        return _classify_delimited(raw, ",")
    if suffix in (".tmx", ".xml"):
        return _classify_xml(raw)
    if suffix in (".po", ".pot"):
        return _classify_po(raw)
    if suffix in (".yaml", ".yml"):
        return _classify_yaml(raw)
    if suffix == ".txt":
        return _classify_txt(raw)
    # A language-code-looking extension (Moses corpus.en / corpus.crk): try the
    # delimited then plain-text parallel classifiers.
    if is_langcode_ext:
        return _classify_delimited(raw, "\t") or _classify_txt(raw)
    return None


# --- driver ----------------------------------------------------------------

def _tracked_files(root: Path) -> list[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=root, capture_output=True, text=True, check=True
    )
    return [ln for ln in out.stdout.splitlines() if ln.strip()]


def main(argv: list[str]) -> int:
    root = Path(
        subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    )

    report = "--report" in argv
    explicit = [a for a in argv if not a.startswith("--")]

    if explicit:
        rels = []
        for a in explicit:
            p = Path(a)
            try:
                rels.append(p.resolve().relative_to(root).as_posix())
            except ValueError:
                rels.append(a)
        candidates = rels
    else:
        candidates = _tracked_files(root)

    violations: list[tuple[str, str, bool]] = []  # (path, reason, allowlisted)
    for rel in candidates:
        p = (root / rel)
        if not p.is_file():
            continue
        reason = classify(p)
        if reason:
            try:
                sz = p.stat().st_size
            except OSError:
                sz = None
            violations.append((rel, reason, _is_allowlisted(rel, sz)))

    if report:
        if not violations:
            print("corpus-content scan: no corpus-shaped files found.")
            return 0
        print(f"corpus-content scan — {len(violations)} corpus-shaped file(s):\n")
        for rel, reason, allowed in sorted(violations):
            tag = "  [allowlisted]" if allowed else ""
            print(f"  {rel}\n      → {reason}{tag}")
        blocked = [v for v in violations if not v[2]]
        print(f"\n{len(blocked)} would be BLOCKED, {len(violations) - len(blocked)} allowlisted.")
        return 0

    blocking = [(r, why) for r, why, allowed in violations if not allowed]
    if blocking:
        print("CORPUS-CONTENT VIOLATION — tracked corpus content (any license is "
              "blocked; corpora are fetch-from-source):")
        for rel, why in sorted(blocking):
            print(f"  ✗ {rel}  — {why}")
        print(f"\n{len(blocking)} file(s). Remove with `git rm --cached <file>` "
              "(keep on disk); corpora load fetch-from-source. See "
              "the data-boundaries doctrine.")
        return 1
    print(f"corpus-content scan: clean ({len(candidates)} tracked paths checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
