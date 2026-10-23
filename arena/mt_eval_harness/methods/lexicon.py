"""
LexiconMethod — word-for-word lookup in a dictionary the user gives: the floor.

``mt-eval run --method lexicon -m data/lexicon/words.tsv`` translates each
sentence by looking its words up in the people's own word list: every run of
source words found in it (longest first — a listed phrase beats its words)
becomes that entry's FIRST listed translation, in source order; punctuation
and every word not in the list are kept as they are. Nothing else: no
reordering, no inflection, no guessing.

It is a floor, not a translator. Its score says what a dictionary alone gets
on these sentences — a trained model is worth something only where it beats
it — and its coverage (how many source words the list had) says how much of
the test the dictionary even reaches. The lookup runs in this process: no
sentence and no dictionary entry goes anywhere (``in_process_transport``).

The dictionary is the "model" this engine is GIVEN (``takes_model``): the run
records it by file name and sha256, never its entries. Its holders' terms
travel with what the run writes — the outputs are made of its words — so a
local-only dictionary makes the run's outputs local-only too
(``corpus_loader.derived_mark``, ``transmission_policy.withheld_text_reason``).

Formats (by suffix): ``.tsv`` / ``.txt`` — ``source<TAB>target`` per line
(what ``champollion data add --into lexicon`` writes; a repeated source keeps
every target, the first is used); ``.json`` — a glossary object ``{"source":
"target" | ["first", "other"]}``, or the same under ``"dictionary"``;
``.jsonl`` — rows with ``source`` and ``target``. The columns run the way the
run does (source language → target language); a file whose sidecar names
another pair is refused.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
import unicodedata
from pathlib import Path
from typing import Any

from mt_eval_harness.methods.base_http_mt import HttpMTMethod, MTConfigError

#: a word: letters/digits/marks, joined by an apostrophe or hyphen inside it
_WORD = re.compile(r"[\ẁ-ͯ]+(?:['’\-][\ẁ-ͯ]+)*")
#: the longest listed phrase considered, in words
MAX_PHRASE_WORDS = 6
SUFFIXES = (".tsv", ".txt", ".json", ".jsonl")


def _key(text: str) -> str:
    return unicodedata.normalize("NFC", text).casefold()


def _words(text: str) -> list[str]:
    return [_key(m.group(0)) for m in _WORD.finditer(text)]


def load_lexicon(path: str | Path) -> dict[tuple[str, ...], list[str]]:
    """``{source words: [targets]}`` from a dictionary file. Refuses (with a
    line number, never an entry's text) what it cannot read as one."""
    p = Path(path).expanduser()
    if p.suffix.lower() not in SUFFIXES:
        raise MTConfigError(
            f"-m {p.name}: a dictionary is a .tsv/.txt (source<TAB>target per "
            f"line), a .json glossary or a .jsonl of source/target rows")
    try:
        text = p.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError as exc:
        raise MTConfigError(f"-m {p.name}: not UTF-8 text ({exc.reason} at "
                            f"byte {exc.start})") from exc
    pairs: list[tuple[str, str]] = []
    suffix = p.suffix.lower()
    if suffix in (".tsv", ".txt"):
        for n, line in enumerate(text.splitlines(), 1):
            if not line.strip():
                continue
            cells = line.split("\t")
            if len(cells) != 2 or not cells[0].strip() or not cells[1].strip():
                raise MTConfigError(
                    f"-m {p.name}: line {n} is not 'source<TAB>target' — fix it "
                    f"or bring the list in with `champollion data add --into lexicon`")
            pairs.append((cells[0].strip(), cells[1].strip()))
    elif suffix == ".json":
        try:
            doc = json.loads(text)
        except ValueError as exc:
            raise MTConfigError(f"-m {p.name}: not valid JSON (line {exc.lineno})") from exc
        if isinstance(doc, dict) and isinstance(doc.get("dictionary"), dict):
            doc = doc["dictionary"]
        if not isinstance(doc, dict):
            raise MTConfigError(f"-m {p.name}: a .json dictionary is an object "
                                f"of source → target (or a list of targets)")
        for src, tgt in doc.items():
            for t in (tgt if isinstance(tgt, list) else [tgt]):
                if isinstance(t, str) and t.strip() and str(src).strip():
                    pairs.append((str(src).strip(), t.strip()))
    else:
        for n, line in enumerate(text.splitlines(), 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except ValueError as exc:
                raise MTConfigError(f"-m {p.name}: line {n} is not JSON") from exc
            src, tgt = (row or {}).get("source"), (row or {}).get("target")
            if not (isinstance(src, str) and isinstance(tgt, str)
                    and src.strip() and tgt.strip()):
                raise MTConfigError(f"-m {p.name}: line {n} has no source and "
                                    f"target strings")
            pairs.append((src.strip(), tgt.strip()))
    table: dict[tuple[str, ...], list[str]] = {}
    for src, tgt in pairs:
        words = tuple(_words(src))
        if not words or len(words) > MAX_PHRASE_WORDS:
            continue
        targets = table.setdefault(words, [])
        if tgt not in targets:
            targets.append(unicodedata.normalize("NFC", tgt))
    if not table:
        raise MTConfigError(f"-m {p.name}: no entries to look words up in")
    return table


def lookup(sentence: str, table: dict[tuple[str, ...], list[str]],
           longest: int) -> tuple[str, int, int]:
    """``(output, source words, words found)`` for one sentence."""
    text = unicodedata.normalize("NFC", sentence)
    spans = list(_WORD.finditer(text))
    keys = [_key(m.group(0)) for m in spans]
    out: list[str] = []
    pos = 0          # next character of `text` not yet written
    i = found = 0
    while i < len(spans):
        hit = None
        for n in range(min(longest, len(spans) - i), 0, -1):
            targets = table.get(tuple(keys[i:i + n]))
            if targets:
                hit = (n, targets[0])
                break
        if hit is None:
            i += 1
            continue
        n, target = hit
        out.append(text[pos:spans[i].start()])
        out.append(target)
        pos = spans[i + n - 1].end()
        found += n
        i += n
    out.append(text[pos:])
    return "".join(out), len(spans), found


def _file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class LexiconMethod(HttpMTMethod):
    """Word-for-word lookup in the dictionary given with -m."""

    name = "lexicon"
    MAX_BATCH = 100_000            # no service: one pass over the batch
    method_id = "lexicon"
    method_class = "pipeline"
    paradigm = "rule-based"
    author = "Champollion MT Eval"
    description = (
        "Word-for-word lookup in a dictionary the user gives (-m): each run of "
        "source words found in it (longest first) becomes its first listed "
        "translation, in source order; every other word is kept as it is. A "
        "floor to beat, not a translator.")
    homepage = ""
    license = "The dictionary's own terms (its sidecar)"
    in_process_transport = True
    takes_model = True
    commercial_ready = False
    cost_note = "Free; runs in this process"

    def __init__(self, **options: Any) -> None:
        super().__init__(**options)
        self._identity = options.get("model_identity") or None
        self._table = None
        self._longest = 1

    @classmethod
    def resolve_identity(cls, options: dict, *, source_code: str = "",
                         target_code: str = "",
                         allow_pair_mismatch: bool = False) -> dict:
        """The dictionary this run looks words up in, decided before the run:
        ``{given, from, kind: "file", id, path, sha256, entries, family,
        backend, revision, pair_mismatch?}``. Refuses no file, a folder, an
        unreadable list, and a list whose sidecar names another pair (unless
        ``allow_pair_mismatch``)."""
        given = str((options or {}).get("model") or "").strip()
        if not given:
            raise MTConfigError(
                "--method lexicon needs the dictionary to look words up in: "
                "-m data/lexicon/<file>.tsv (source<TAB>target per line)")
        path = Path(given).expanduser()
        if not path.is_file():
            raise MTConfigError(f"-m {given}: no such file — the dictionary is "
                                f"one file (a folder is not read)")
        table = load_lexicon(path)
        identity: dict = {"given": given, "from": "-m/--model", "kind": "file",
                          "id": path.name, "path": str(path.resolve()),
                          "sha256": _file_sha256(path), "entries": len(table),
                          "family": "lexicon", "backend": "word-for-word lookup",
                          "revision": None}
        from mt_eval_harness.corpus_loader import read_steward_sidecar

        try:
            pair = (read_steward_sidecar(path) or {}).get("pair") or {}
        except ValueError as exc:
            raise MTConfigError(f"-m {path.name}: its sidecar cannot be read "
                                f"({exc})") from exc
        base = lambda c: str(c or "").replace("_", "-").split("-")[0].lower()  # noqa: E731
        if pair and source_code and target_code and (
                base(pair.get("source")) != base(source_code)
                or base(pair.get("target")) != base(target_code)):
            mismatch = {"model_pair": f"{pair.get('source')}>{pair.get('target')}",
                        "run_pair": f"{source_code}>{target_code}"}
            if not allow_pair_mismatch:
                raise MTConfigError(
                    f"-m {path.name} runs {mismatch['model_pair']} (its sidecar), "
                    f"and this run is {mismatch['run_pair']} — a dictionary looks "
                    f"up one direction. Bring it in for this pair, or pass "
                    f"--allow-model-pair-mismatch if you mean it")
            identity["pair_mismatch"] = mismatch
        return identity

    def model_identity(self) -> dict:
        if self._identity is None:
            self._identity = self.resolve_identity(self.options)
        return dict(self._identity)

    def _load(self) -> None:
        if self._table is None:
            ident = self.model_identity()
            path = Path(ident["path"])
            if _file_sha256(path) != ident["sha256"]:
                raise MTConfigError(f"-m {path.name} changed after the run "
                                    f"recorded it — run again")
            self._table = load_lexicon(path)
            self._longest = max(len(k) for k in self._table)

    async def translate(self, entries: list[dict], config) -> list[dict]:
        """One result per entry: the looked-up sentence, with counts in its
        metadata (``lexicon_words``, ``lexicon_found`` — never words)."""
        self._load()
        source_field = getattr(config, "source_field", "source") or "source"
        results = []
        for entry in entries:
            t0 = time.monotonic()
            out, words, found = lookup(str(entry.get(source_field, "")),
                                       self._table, self._longest)
            results.append(self._result(
                entry_id=entry.get("id"), predicted=out,
                latency_s=time.monotonic() - t0, error=None,
                metadata={"lexicon_words": words, "lexicon_found": found}))
        return results
