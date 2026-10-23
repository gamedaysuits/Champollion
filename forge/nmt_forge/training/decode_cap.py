"""The decode cap, fixed or proportional to the input (founder 2026-10-17: "Decode cap should be dynamic,
if it's a long sentence input longer decode cap no?").

A fixed ``decode.max_new_tokens`` gives a one-word input and a forty-word input the same room. With
``decode.length_ratio`` set, each input may generate at most ``ceil(length_ratio × its length + length_margin)``
tokens (the fairseq ``max_len_a × src + max_len_b`` rule), never more than ``max_new_tokens``, which stays
the hard ceiling. Long inputs get room; a short input that starts looping is stopped early.

Lengths are counted with the model's own tokenizer (bytes for ByT5). The generation-headroom guard
(selection.check_generation_headroom) applies the same rule to every dev pair, so a ratio too small for the
data is refused before any training, as a fixed cap too small already is.
"""

from __future__ import annotations

import math


def dynamic_cap(max_new_tokens: int, length_ratio: float | None, length_margin: int, src_len: int) -> int:
    """How many tokens an input of ``src_len`` tokens may generate."""
    if not length_ratio:
        return int(max_new_tokens)
    return max(1, min(int(max_new_tokens), math.ceil(length_ratio * src_len + length_margin)))


def cap_params(decode) -> dict:
    """The decode-cap keys every caller passes to ``backend.decode`` (from a DecodeParams or a dict)."""
    get = decode.get if isinstance(decode, dict) else (lambda k, d=None: getattr(decode, k, d))
    out = {"max_new_tokens": int(get("max_new_tokens", 256))}
    if get("length_ratio"):
        out["length_ratio"] = float(get("length_ratio"))
        out["length_margin"] = int(get("length_margin", 32) or 0)
    return out
