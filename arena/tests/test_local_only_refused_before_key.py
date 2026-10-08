"""A local-only corpus is refused for being local-only, not for a missing key.

Regression (synthetic Cree-school persona, 2026-10-03): `mt-eval run --corpus
<file with a local-only sidecar> --provider openrouter` without
OPENROUTER_API_KEY said only that the key was missing. A user who then added
a key learned the more fundamental answer second: the sentences may never
leave the machine. The transmission refusal now comes before the credential.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from mt_eval_harness.config import RunConfig
from mt_eval_harness.providers import openrouter as openrouter_provider
from mt_eval_harness.runner import execute_run

KEY_MISSING = "OPENROUTER_API_KEY not found (test)"


@pytest.fixture
def no_key(monkeypatch, tmp_path):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.chdir(tmp_path)

    def missing():
        raise RuntimeError(KEY_MISSING)
    monkeypatch.setattr(openrouter_provider, "_load_api_key", missing)


def _corpus(tmp_path, *, local_only: bool, license_id: str | None = None):
    path = tmp_path / "c.json"
    dataset = {"language_pair": {"source": "eng", "target": "fra"}}
    if license_id:
        dataset["license"] = license_id
    path.write_text(json.dumps({"dataset": dataset, "entries": [
        {"id": str(i), "source": f"hello {i}", "reference": f"bonjour {i}"}
        for i in range(3)]}))
    if local_only:
        (tmp_path / "c.json.champollion.json").write_text(
            json.dumps({"transmission": "local-only"}))
    return path


def _config(tmp_path, corpus):
    return RunConfig(provider="openrouter", corpus_path=str(corpus),
                     target_lang="French", output_dir=str(tmp_path / "out"),
                     cache_dir=str(tmp_path / "cache"), dataset="all")


def test_local_only_corpus_is_refused_before_the_key_is_asked_for(tmp_path, no_key):
    corpus = _corpus(tmp_path, local_only=True)
    with pytest.raises(RuntimeError) as ei:
        asyncio.run(execute_run(_config(tmp_path, corpus)))
    msg = str(ei.value)
    assert "local-only" in msg and "--provider local" in msg
    assert KEY_MISSING not in msg


def test_a_corpus_that_may_travel_still_needs_the_key(tmp_path, no_key):
    corpus = _corpus(tmp_path, local_only=False, license_id="CC-BY-4.0")
    with pytest.raises(RuntimeError, match="not found"):
        asyncio.run(execute_run(_config(tmp_path, corpus)))
