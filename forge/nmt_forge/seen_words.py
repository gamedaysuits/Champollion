"""The words a model saw in training — so the words it never saw are named.

Stress test 4 (2026-10-13), on G1's ByT5-small outputs for the invented test
language: a held-out sentence holding a content word the model never saw in
training was translated right 0 times in 358 (at 1,600, 6,400 and 25,600
training pairs), and came out *confidently* wrong — fluent, every word a real
form, the meaning wrong — 32%, 55% and 83% of the time: the better the model,
the more convincing its guess. Nothing on the output says so.

So an export records the words of its training sources (``input-words.json``
at the export's root), and the server names, for each request sentence, the
words it holds that the model never saw. Words are lowercased letter runs in
any script; when the input side is English, a plain English ending of a seen
word (walk → walked) counts as seen.

The file holds words of the people's own training sentences, one of each,
sorted — never a sentence — so it stays OUT of the deployable ``model/``
folder (weights, tokenizer, settings and the card only: the folder people copy
to a server). A server of a ``model/`` folder copied away from its export says
it cannot check, on /health and every reply.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

SEEN_WORDS = "input-words.json"

#: Letter runs in any script, apostrophe-joined (don't, nêhiyaw'êwin).
_WORD = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*")

_SUFFIXES = ("", "s", "es", "ed", "d", "ing", "'s", "er", "ers")

#: What a reply says beside the words it names.
UNSEEN_NOTE = ("words the model never saw in training: a sentence that holds one is very likely "
               "mistranslated, however fluent it reads — have a speaker check it, or teach the model "
               "those words")


def tokens(text: str) -> list[str]:
    """Lowercased words of ``text`` (NFC, as training text is)."""
    return [w.lower().replace("’", "'") for w in _WORD.findall(unicodedata.normalize("NFC", str(text)))]


def covered(word: str, known: set[str]) -> bool:
    """An English word counts as seen when it, or a plain English ending of
    it, is known."""
    w = word.lower()
    stems = {w}
    if w.endswith("y") and len(w) > 2:
        stems.add(w[:-1] + "ie")
    if w.endswith("e"):
        stems.add(w[:-1])
    return any(s + suf in known for s in stems for suf in _SUFFIXES)


def _bases(word: str) -> set[str]:
    """What an English word could be an ending of: walked → walk, foxes → fox,
    berries → berry, dog's → dog."""
    out: set[str] = set()
    for suf in _SUFFIXES[1:]:
        if word.endswith(suf) and len(word) > len(suf) + 1:
            b = word[: -len(suf)]
            out |= {b, b + "e"}
            if b.endswith("i"):
                out.add(b[:-1] + "y")
    return out


def seen_english(word: str, known: set[str]) -> bool:
    """Seen, either way round: the word or a plain English ending of it was in
    training (walk ← walked), or it is an ending of a word that was (walked ←
    walk)."""
    w = word.lower()
    return covered(w, known) or any(covered(b, known) for b in _bases(w))


def write_seen_words(export_dir: str | Path, sources: list[str], *, english: bool,
                     notes: list[str] = ()) -> dict:
    """Write ``input-words.json`` for the training sources given; returns
    {words, sentences, file}. ``notes``: files that could not be read as
    the run read them (missing, changed) — said in the file, never hidden."""
    words = sorted({w for s in sources for w in tokens(s)})
    doc = {"words": words, "english": bool(english), "sentences": len(sources),
           "from": "the input side of every training file",
           **({"notes": list(notes)} if notes else {})}
    path = Path(export_dir) / SEEN_WORDS
    path.write_text(json.dumps(doc, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"words": len(words), "sentences": len(sources), "file": SEEN_WORDS}


class SeenWords:
    """The words one model saw in training, read from its export."""

    def __init__(self, doc: dict):
        self.words = set(doc.get("words") or [])
        self.english = bool(doc.get("english"))
        self.notes = list(doc.get("notes") or [])

    @classmethod
    def load(cls, export_dir: str | Path) -> "SeenWords | None":
        """The export's record, or None when it has none (an export made before
        2026-10-13, or a model folder copied away from its export). An
        unreadable record is an error: it is what the check stands on, and is
        never skipped quietly."""
        path = Path(export_dir) / SEEN_WORDS
        if not path.is_file():
            return None
        return cls(json.loads(path.read_text(encoding="utf-8")))

    def unseen(self, text: str) -> list[str]:
        """The words of ``text`` the model never saw, once each, in order."""
        out: list[str] = []
        for w in tokens(text):
            if w in self.words or (self.english and seen_english(w, self.words)) or w in out:
                continue
            out.append(w)
        return out
