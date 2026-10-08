"""decode_length — how many tokens a seq2seq model the harness runs may generate.

ONE rule for every model the harness decodes itself: the ``local-model`` MT
method (``mt-eval run --method local-model -m <model>``) and the contest
node's declarative engine (Lane A, ``model_runner.hf_translate``). An
entrant's qualifier receipt and the node's re-execution of the same weights
therefore decode the same way, so a gap between the two numbers means a
different model, not a different length setting.

The rule, in order:

1. **Declared by the model.** A ``max_new_tokens`` or ``max_length`` the model
   declares (its ``generation_config.json``, or for a contest bundle the
   manifest's ``model.generation``) is used as declared. It is the model
   author's choice and the model was presumably tuned with it.
2. **Otherwise the harness bound**, relative to the source:
   ``max(DECODE_MIN_NEW_TOKENS, DECODE_TOKENS_PER_SOURCE_TOKEN x source
   tokens)`` new tokens, where "source tokens" is the longest source in the
   batch as the model's own tokenizer counts it.
3. **Never past the decoder's positions.** A model with a fixed position table
   (``max_position_embeddings`` in its config) cannot generate past it, so the
   bound is capped at that size minus one (the decoder start token takes a
   position).

Why this exists: transformers falls back to ``max_length=20`` when a model
declares no length and the caller passes none, and says so only in a warning
("Using the model-agnostic default `max_length` (=21)"). The node's engine
passed none, so every Lane A entry was scored on output cut at about twenty
tokens (synthetic researcher, Round 10).

The two numbers are named constants, not tuning: a translation four times as
long (in tokens) as its source is already far outside normal length ratios, so
the bound only stops a degenerate repetition loop. Changing them changes what
the node decodes; it is recorded on every run that uses the rule.
"""

from __future__ import annotations

import json
from pathlib import Path

#: New tokens allowed per source token when the model declares no length.
DECODE_TOKENS_PER_SOURCE_TOKEN = 4

#: Never fewer new tokens than this, however short the source.
DECODE_MIN_NEW_TOKENS = 64

#: The generation keys that set a length (transformers' names).
LENGTH_KEYS = ("max_new_tokens", "max_length")


def rule_text() -> str:
    """The rule in one line, for headers, manifests and run cards."""
    return (f"declared length if the model declares one, else "
            f"max({DECODE_MIN_NEW_TOKENS}, {DECODE_TOKENS_PER_SOURCE_TOKEN} x "
            f"source tokens) new tokens, capped at the decoder's positions")


def declared_length(*generation_blocks) -> dict | None:
    """The first length any of ``generation_blocks`` declares, as
    ``{key: value, "from": <label>}`` — or None.

    Each block is ``(label, dict)``; the first block that sets
    ``max_new_tokens`` or ``max_length`` (a positive int) wins, and within a
    block ``max_new_tokens`` wins over ``max_length`` (transformers' own
    precedence)."""
    for label, block in generation_blocks:
        if not isinstance(block, dict):
            continue
        for key in LENGTH_KEYS:
            value = block.get(key)
            if isinstance(value, int) and not isinstance(value, bool) \
                    and value > 0:
                return {key: value, "from": label}
    return None


def read_generation_config(model_dir: str | Path) -> dict:
    """``<model_dir>/generation_config.json`` as a dict ({} when absent or
    unreadable — an unreadable file declares nothing)."""
    path = Path(model_dir) / "generation_config.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def max_positions(model_dir: str | Path) -> int | None:
    """The decoder's position-table size from ``config.json``
    (``max_position_embeddings``), or None when the model has no fixed table
    (relative positions, e.g. T5) or the file is absent."""
    try:
        cfg = json.loads((Path(model_dir) / "config.json").read_text(
            encoding="utf-8"))
    except (OSError, ValueError):
        return None
    value = cfg.get("max_position_embeddings") if isinstance(cfg, dict) else None
    if isinstance(value, int) and not isinstance(value, bool) and value > 1:
        return value
    return None


def harness_bound(source_tokens: int, *, positions: int | None = None) -> int:
    """The harness's own bound for a source of ``source_tokens`` tokens."""
    bound = max(DECODE_MIN_NEW_TOKENS,
                DECODE_TOKENS_PER_SOURCE_TOKEN * max(0, int(source_tokens)))
    if positions:
        bound = min(bound, positions - 1)
    return bound


def generation_kwargs(declared: dict | None, source_tokens: int, *,
                      positions: int | None = None) -> dict:
    """The length kwargs to pass to ``model.generate`` for one call.

    ``declared`` is :func:`declared_length`'s result. A declared value is
    passed as declared (capped at the positions); otherwise
    ``max_new_tokens`` = :func:`harness_bound`."""
    if declared:
        for key in LENGTH_KEYS:
            if key in declared:
                value = declared[key]
                if positions:
                    value = min(value, positions - 1 if key == "max_new_tokens"
                                else positions)
                return {key: value}
    return {"max_new_tokens": harness_bound(source_tokens, positions=positions)}


def describe(declared: dict | None, *, positions: int | None = None) -> dict:
    """What a run records about its decode length (run log, execution facts,
    bundle manifest): the declared value and where it came from, or the
    harness rule and its two constants."""
    if declared:
        key = next(k for k in LENGTH_KEYS if k in declared)
        return {"source": "declared", "declared_in": declared.get("from"),
                key: declared[key], "positions_cap": positions}
    return {"source": "harness-rule", "rule": rule_text(),
            "tokens_per_source_token": DECODE_TOKENS_PER_SOURCE_TOKEN,
            "min_new_tokens": DECODE_MIN_NEW_TOKENS,
            "positions_cap": positions}


def summary(record: dict | None) -> str:
    """One readable line for a :func:`describe` record."""
    if not record:
        return "not recorded"
    if record.get("source") == "declared":
        key = next((k for k in LENGTH_KEYS if k in record), None)
        line = (f"{key}={record.get(key)} as declared in "
                f"{record.get('declared_in') or 'the model'}")
    else:
        line = (f"max({record.get('min_new_tokens')}, "
                f"{record.get('tokens_per_source_token')} x source tokens) "
                f"new tokens (the model declares no length; harness rule)")
    if record.get("positions_cap"):
        line += f", capped by {record['positions_cap']} decoder positions"
    return line
