"""
Exact model slugs only — no aliasing (founder ruling 2026-10-05).

shared/retired-model-aliases.json lists the short names the harness and the
CLI USED to resolve ("gemini-pro" → "google/gemini-3.1-pro-preview"). Today
each is REFUSED; the table only lets the refusal name the exact slug the old
name stood for. The CLI reads it in cli/lib/models.js; the harness in
config._load_retired_model_aliases, from the package's own copy
(mt_eval_harness/data/retired-model-aliases.json). This file pins that copy to
the SSOT (a drifted copy would make the two runtimes name different slugs in
the same refusal) and pins the refusals themselves.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness import config


def _shared_retired() -> dict[str, str] | None:
    """Read shared/retired-model-aliases.json's `retired` table (the SSOT).

    Returns None when the file isn't present (a standalone checkout without the
    monorepo `shared/` dir) — the drift test is meaningless there and skips.
    """
    here = Path(config.__file__).resolve()
    for ancestor in [here, *here.parents]:
        candidate = ancestor / "shared" / "retired-model-aliases.json"
        if candidate.is_file():
            return json.loads(candidate.read_text(encoding="utf-8"))["retired"]
    return None


def test_package_copy_mirrors_shared_ssot():
    """The harness reads its own package copy — installed or in the monorepo —
    and that copy is the shared file (no hand-kept mirror any more)."""
    src = _shared_retired()
    if src is None:
        pytest.skip("shared/retired-model-aliases.json not present (standalone checkout)")
    assert config._load_retired_model_aliases() == src


def test_monorepo_loads_from_shared_file():
    src = _shared_retired()
    if src is None:
        pytest.skip("shared/retired-model-aliases.json not present")
    assert config._load_retired_model_aliases() == src


def test_no_alias_map_survives():
    assert not hasattr(config, "MODEL_REGISTRY")
    assert not hasattr(config, "fuzzy_resolve_model")


@pytest.mark.parametrize("name", sorted(config.RETIRED_MODEL_ALIASES))
def test_every_retired_name_is_refused_naming_its_slug(name):
    slug = config.RETIRED_MODEL_ALIASES[name]
    for openrouter in (True, False):
        msg = config.exact_model_refusal(name, openrouter=openrouter)
        assert msg and msg.startswith(
            f"'{name}' is not a model id — the harness takes exact model slugs "
            f"only, no aliases. Did you mean {slug} ")


@pytest.mark.parametrize("name", [
    "~google/gemini-flash-latest", "~anthropic/claude-sonnet-latest",
    "openai/gpt-chat-latest", "gemini-flash-latest", "llama3.1:latest",
])
def test_floating_ids_are_refused(name):
    assert config.is_floating_model_id(name)
    msg = config.exact_model_refusal(name)
    assert msg and "is a floating model id" in msg


def test_openrouter_needs_a_vendor_and_the_harness_guesses_none():
    msg = config.exact_model_refusal("gpt-5.5", openrouter=True)
    assert msg and "is not an OpenRouter model id" in msg
    # A direct provider's own exact name is fine there.
    assert config.exact_model_refusal("gpt-5.5", openrouter=False) is None
    assert config.exact_model_refusal("llama3.1") is None


def test_the_default_is_an_exact_slug():
    assert "/" in config.DEFAULT_MODEL
    assert config.exact_model_refusal(config.DEFAULT_MODEL, openrouter=True) is None
    assert config.RunConfig().model == config.DEFAULT_MODEL
