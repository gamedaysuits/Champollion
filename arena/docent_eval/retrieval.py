"""Python mirror of the docent's lexical retrieval (docent-chat/retrieval.ts).

Kept in lockstep with the TS implementation ON PURPOSE: the eval must assemble
the SAME grounded prompt production serves, or it isn't evaluating production.
Same tokenizer, stopwords, BM25 params (k1=1.5, b=0.75), and conservative FAQ
threshold. If you change one side, change both (there is a parity note in the
docent-chat README).
"""

from __future__ import annotations

import math
import re
from typing import Any

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "is",
    "are", "was", "were", "be", "been", "it", "this", "that", "these", "those",
    "with", "as", "at", "by", "from", "how", "what", "why", "when", "where",
    "who", "do", "does", "did", "can", "i", "you", "we", "they", "my", "your",
    "me", "us", "if", "so", "not", "no", "yes", "please", "about", "into",
}
_TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)  # unicode letters/digits runs

_K1 = 1.5
_B = 0.75


def tokenize(text: str) -> list[str]:
    out = []
    for raw in _TOKEN_RE.findall((text or "").lower()):
        if len(raw) < 2 or raw in _STOPWORDS:
            continue
        out.append(raw)
    return out


class Bm25Index:
    def __init__(self, chunks: list[dict[str, Any]]):
        self.chunks = chunks
        self.tokens: list[list[str]] = []
        self.df: dict[str, int] = {}
        self.doc_len: list[int] = []
        for c in chunks:
            toks = tokenize(f"{c.get('sectionTitle','')} {c.get('docTitle','')} {c.get('text','')}")
            self.tokens.append(toks)
            self.doc_len.append(len(toks))
            for t in set(toks):
                self.df[t] = self.df.get(t, 0) + 1
        self.n = len(chunks)
        self.avgdl = (sum(self.doc_len) / self.n) if self.n else 0.0

    def search(self, query: str, k: int = 6) -> list[dict[str, Any]]:
        q = set(tokenize(query))
        if not q or self.n == 0:
            return []
        scored = []
        for i, toks in enumerate(self.tokens):
            if not toks:
                continue
            tf: dict[str, int] = {}
            for t in toks:
                if t in q:
                    tf[t] = tf.get(t, 0) + 1
            if not tf:
                continue
            s = 0.0
            for t, f in tf.items():
                df = self.df.get(t, 0)
                idf = math.log(1 + (self.n - df + 0.5) / (df + 0.5))
                denom = f + _K1 * (1 - _B + _B * (self.doc_len[i] / (self.avgdl or 1)))
                s += idf * ((f * (_K1 + 1)) / denom)
            if s > 0:
                scored.append((s, self.chunks[i]))
        scored.sort(key=lambda x: (-x[0], x[1].get("id", "")))
        return [dict(c, score=s) for s, c in scored[:k]]


def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / (len(a) + len(b) - inter)


def faq_match(query: str, faq: list[dict[str, Any]], threshold: float = 0.55):
    q = set(tokenize(query))
    if not q:
        return None
    best = None
    best_score = 0.0
    for entry in faq:
        qset = set(tokenize(entry.get("question", "")))
        jac = _jaccard(q, qset)
        kw = [k.lower() for k in (entry.get("keywords") or [])]
        hits = 0
        for k in kw:
            kt = tokenize(k)
            if kt and all(t in q for t in kt):
                hits += 1
        kw_cov = (hits / len(kw)) if kw else 0.0
        score = 0.7 * jac + 0.3 * kw_cov
        if score > best_score:
            best, best_score = entry, score
    if best and best_score >= threshold:
        return {"entry": best, "score": best_score}
    return None


def render_context(hits: list[dict[str, Any]]) -> str:
    if not hits:
        return "(no matching documentation found)"
    parts = []
    for i, c in enumerate(hits, 1):
        parts.append(
            f"[{i}] {c.get('docTitle','')} — {c.get('sectionTitle','')}\n"
            f"SOURCE: {c.get('url','')}\n{c.get('text','')}"
        )
    return "\n\n".join(parts)
