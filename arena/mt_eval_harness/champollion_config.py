"""
The RETIRED champollion-config lane.

Until harness 0.2.0 this module read a CLI ``champollion.config.json`` and
rebuilt the CLI's system prompt in Python, so ``mt-eval run
--champollion-config`` could claim to evaluate "production-identical" prompts.
It was retired (founder-approved architecture review, 2026-09-27): the Python
copy had drifted from the CLI's prompt builder (it asked for JSON and sent
plain text; register, quoting and source-language lines differed), no test
compared the two, and it served only the API lanes the v2 plan freezes. What
it measured was therefore not what the CLI ships.

The module also held a private language-card reader (``load_language_card``,
``deep_merge_cards``, ``_find_cards_dir``) whose last caller was tester.py's
compliance-plugin auto-load. That load keyed on a card ``rules`` field the
atlas cutover dropped from every card, so it could never fire; both were
removed in 0.2.0. Card lookups go through ``mt_eval_harness.language_cards``.

The public names of the lane stay importable for one minor release and raise
``RetiredLaneError`` with the replacement named.
"""

from __future__ import annotations


# ---------------------------------------------------------------------------
# The retired lane — importable, never usable (removal after 0.2.x)
# ---------------------------------------------------------------------------

RETIRED_MESSAGE = (
    "--champollion-config / --prompt champollion was retired in harness 0.2.0: "
    "it rebuilt the CLI's prompt by hand, had drifted from it (it asked for "
    "JSON and sent plain text) and was never parity-tested, so it did not "
    "measure what the CLI ships. Evaluate a CLI method through the "
    "method-plugin lane (--method), and turn a scored run into CLI settings "
    "with `mt-eval export-config`."
)


CARDS_DIR_RETIRED_MESSAGE = (
    "--champollion-cards-dir was retired in harness 0.2.0: its only use was "
    "pointing the compliance-plugin auto-load at a cards directory, and no "
    "language card carries the `rules` field that load keyed on. The harness "
    "finds cards itself; set MT_EVAL_CARDS_DIR to point it at another "
    "directory."
)


class RetiredLaneError(RuntimeError):
    """Raised by every entry point of the retired champollion-config lane."""

    def __init__(self, what: str = ""):
        super().__init__(f"{what}: {RETIRED_MESSAGE}" if what else RETIRED_MESSAGE)


class ChampollionRunConfig:
    """Retired in 0.2.0 — constructing it raises RetiredLaneError."""

    def __init__(self, *args, **kwargs):
        raise RetiredLaneError("ChampollionRunConfig")


ChampollionPromptConfig = ChampollionRunConfig


def load_champollion_config(*args, **kwargs):
    """Retired in 0.2.0 — raises RetiredLaneError."""
    raise RetiredLaneError("load_champollion_config")


def build_champollion_system_prompt(*args, **kwargs):
    """Retired in 0.2.0 — raises RetiredLaneError."""
    raise RetiredLaneError("build_champollion_system_prompt")
