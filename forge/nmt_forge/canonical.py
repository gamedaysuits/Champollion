"""Canonical text keys — the ONE identity function for leakage machinery.

Everything that asks "are these two sentences the same?" (split-guard grouping,
leak-audit exact matching, dev-fence content checks) goes through
:func:`canonical_key`. One function, applied everywhere, is itself a guard:
the catalogued ý/y disaster (mistake #4 in the crk ledger — a one-character
orthography mismatch silently deleted 1,375 dictionary verbs) happened because
different code paths normalized differently.

The key is deliberately AGGRESSIVE (casefold, strip all punctuation, collapse
whitespace): over-grouping can never cause leakage, under-grouping can. The
optional ``canonicalizer`` slot is where a language pack's orthography
normalization composes in (e.g. Plains Cree macron→circumflex, ý→y) so that
convention variants of the same sentence share one key.

Manifests never contain sentence text — use :func:`key_hash` when a manifest
needs to reference a key (matches the harness contamination checker's
never-print-sentence-text discipline).
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
import zlib
from collections.abc import Callable
from pathlib import Path

_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_WS_RE = re.compile(r"\s+")

Canonicalizer = Callable[[str], str]


def canonical_key(text: str, canonicalizer: Canonicalizer | None = None) -> str:
    """Aggressive canonical identity key for a sentence.

    Pipeline: optional pack canonicalizer → NFC → casefold → strip
    punctuation → collapse whitespace.
    """
    if canonicalizer is not None:
        text = canonicalizer(text)
    t = unicodedata.normalize("NFC", text).casefold()
    t = _PUNCT_RE.sub(" ", t)
    return _WS_RE.sub(" ", t).strip()


def token_set(key: str) -> frozenset[str]:
    """Token set of a canonical key, for Jaccard near-duplicate screening."""
    return frozenset(key.split())


def similarity_units(key: str, *, min_tokens: int = 3, ngram: int = 3) -> frozenset[str]:
    """Units for Jaccard near-duplicate comparison, script-diverse.

    Whitespace tokens when the key has ≥ ``min_tokens`` of them; character
    ``ngram``-grams when it doesn't but still carries enough signal (≥ 4×
    the n-gram size once spaces are removed) — which is what makes the
    near-dupe screen work for languages written WITHOUT word spaces
    (Chinese/Japanese/Thai-class scripts), where every sentence is one
    whitespace "token" and a token-only screen silently goes inert.
    Returns an empty set for keys too short to compare (the exact-match
    lane still covers those).
    """
    toks = key.split()
    if len(toks) >= min_tokens:
        return frozenset(toks)
    compact = key.replace(" ", "")
    if len(compact) >= ngram * 4:
        return frozenset(compact[i:i + ngram] for i in range(len(compact) - ngram + 1))
    return frozenset()


def jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def key_hash(key: str) -> str:
    """Content-free reference to a canonical key (sha256 hex, first 16)."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def stable_hash(text: str) -> int:
    """Deterministic 32-bit hash for rotation/assignment choices.

    Builtin ``hash()`` is per-process salted and MUST NOT be used for anything
    that touches data selection — it produced irreproducible corpora in the
    reference implementation. crc32 is stable across processes and runs.
    """
    return zlib.crc32(text.encode("utf-8"))


def sha256_file(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def config_hash(obj) -> str:
    """Hash of a JSON-serializable config: canonical JSON, sorted keys."""
    return hashlib.sha256(
        json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()[:16]


def detect_target_field(rows: list[dict]) -> str:
    """Pin the reference/target field name of a row set, or fail loud.

    Eval files in the wild use ``reference``; training files use ``target``.
    The field is detected ONCE (at registration / audit start) and pinned, so
    a mixed or missing field is an error, not a silent zero-match.
    """
    for candidate in ("target", "reference"):
        if rows and all(candidate in r for r in rows):
            return candidate
    raise KeyError(
        "rows carry neither a uniform 'target' nor 'reference' field; "
        "pass target_field= explicitly"
    )
