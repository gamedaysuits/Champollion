# Ported from the internal corpora-builder (founder decision 2026-08-27):
# the fetch-on-miss corpus REBUILD path must work in the open-source harness
# — 5,595 of 5,602 registry corpora are fetch-from-source and corpus content
# is never tracked, so without these primitives a public clone could browse
# the queue and rebuild nothing (docs/PRE_REVIEW_HARDENING_2026-08-27.md).
# The intake/probe/recipe-authoring tooling remains in the private builder;
# this subpackage ships with the harness under the harness's license.
# Byte-parity with the private builder's copy is protected by the per-pair
# sha guards: a divergent rebuild fails loudly at publish, never silently.
"""
AmericasNLP shared-task adapter — compatibility shim.

Generalized 2026-07-07 into :mod:`lineparallel_adapter` (master-plan
workstream A1: "recipes, not adapters"). The AmericasNLP transport was the
generic case: two line-parallel files at a pinned GitHub commit, resolved by
a ``file_pattern``. All logic lives there now; this module keeps the original
import path and ``build_corpus_file(edition=...)`` signature working for
existing callers (``corpus_fetch`` legacy builder id, older scripts).

Benchmark-specific knowledge (language map, label-honesty exclusions,
license posture) lives in ``corpora_builder/recipes/americasnlp2021.json``,
consumed by ``build_recipe_cards.py``.
"""

from __future__ import annotations

from pathlib import Path

from .lineparallel_adapter import (  # noqa: F401  (re-exported for callers)
    _repo_id,
    build_pair,
    download_split_file as _download_member,
)
from . import lineparallel_adapter as _generic

#: Default file pattern — the flat public test split the task ships.
DEFAULT_FILE_PATTERN = "test_data/test.{lang_code}"


def download_split_file(
    cache_dir: Path,
    lang_code: str,
    *,
    repo_url: str,
    revision: str,
    file_pattern: str | None = None,
) -> Path:
    """Legacy signature: resolve ``file_pattern`` by ``lang_code`` only."""
    member = (file_pattern or DEFAULT_FILE_PATTERN).format(lang_code=lang_code)
    return _download_member(
        cache_dir, member, repo_url=repo_url, revision=revision,
    )


def build_corpus_file(
    dest: Path,
    *,
    source_lang: str,
    target_lang: str,
    src_code: str,
    tgt_code: str,
    cache_dir: Path,
    repo_url: str,
    revision: str,
    edition: str,
    file_pattern: str | None = None,
    domain: str = "conv",
    expected_size: int | None = None,
    auto_yes: bool = False,
) -> Path:
    """Legacy signature: ``edition`` maps to the generic ``dataset_tag``."""
    return _generic.build_corpus_file(
        dest,
        source_lang=source_lang,
        target_lang=target_lang,
        src_code=src_code,
        tgt_code=tgt_code,
        cache_dir=cache_dir,
        repo_url=repo_url,
        revision=revision,
        dataset_tag=edition,
        file_pattern=file_pattern or DEFAULT_FILE_PATTERN,
        domain=domain,
        expected_size=expected_size,
        auto_yes=auto_yes,
    )
