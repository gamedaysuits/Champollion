"""The cache key follows the prompt as SENT and the harness version (0.2).

Before 0.2 the key covered the coaching file but not the rendered prompt, and
nothing that marked a scoring-path change — so a fixed harness could be served
outputs cached by the broken one.
"""

from __future__ import annotations

from mt_eval_harness import config as config_mod
from mt_eval_harness.config import RunConfig


def _cfg(**kw) -> RunConfig:
    return RunConfig(dataset="all", corpus_path="", model="google/gemini-3.5-flash",
                     prompt_version="naive", **kw)


def test_a_different_rendered_prompt_is_a_different_cache():
    a, b = _cfg(), _cfg()
    a.rendered_prompt_sha256 = "a" * 64
    b.rendered_prompt_sha256 = "b" * 64
    assert a.config_hash() != b.config_hash()


def test_the_harness_version_is_a_cache_epoch(monkeypatch):
    before = _cfg().config_hash()
    monkeypatch.setattr(config_mod, "_harness_version", lambda: "9.9.9")
    assert _cfg().config_hash() != before
