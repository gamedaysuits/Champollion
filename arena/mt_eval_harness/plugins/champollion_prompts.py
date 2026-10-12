"""The retired champollion-config prompt provider (harness 0.2.0).

It served ``--prompt champollion``, a hand-built Python copy of the CLI's
system prompt that had drifted from the CLI. Importable for one minor
release; constructing it raises RetiredLaneError with the replacement named.
"""

from __future__ import annotations

from mt_eval_harness.champollion_config import RetiredLaneError


class ChampollionPromptProvider:
    """Retired in 0.2.0 — constructing it raises RetiredLaneError."""

    def __init__(self, *args, **kwargs):
        raise RetiredLaneError("ChampollionPromptProvider")
