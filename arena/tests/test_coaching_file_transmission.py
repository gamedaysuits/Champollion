"""A coaching file its steward marked is held to its terms, like the corpus.

Found 2026-10-09 (rails journey design): the transmission gate judged only the
corpus, while --coaching-file is sent to the model word for word as the
prompt. A dictionary or notes marked local-only could reach a hosted model.
Now a coaching file with a restricting sidecar is enforced on the same
channel; one without a sidecar is the user's own prompt and passes.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from mt_eval_harness.config import RunConfig
from mt_eval_harness.providers import openrouter as openrouter_provider
from mt_eval_harness.runner import execute_run
from mt_eval_harness.transmission_policy import MODE_SEALED, coaching_file_policy

KEY_MISSING = "OPENROUTER_API_KEY not found (test)"


@pytest.fixture
def no_key(monkeypatch, tmp_path):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.chdir(tmp_path)

    def missing():
        raise RuntimeError(KEY_MISSING)
    monkeypatch.setattr(openrouter_provider, "_load_api_key", missing)


def _corpus(tmp_path):
    path = tmp_path / "c.json"
    path.write_text(json.dumps({
        "dataset": {"language_pair": {"source": "eng", "target": "fra"},
                    "license": "CC-BY-4.0"},
        "entries": [{"id": str(i), "source": f"hello {i}",
                     "reference": f"bonjour {i}"} for i in range(3)]}))
    return path


def _coaching(tmp_path, sidecar=None):
    path = tmp_path / "coaching.txt"
    path.write_text("Translate into French. zub means hello.\n", encoding="utf-8")
    if sidecar is not None:
        (tmp_path / "coaching.txt.champollion.json").write_text(json.dumps(sidecar))
    return path


def _config(tmp_path, coaching):
    return RunConfig(provider="openrouter", corpus_path=str(_corpus(tmp_path)),
                     target_lang="French", output_dir=str(tmp_path / "out"),
                     cache_dir=str(tmp_path / "cache"), dataset="all",
                     coaching_file=str(coaching))


def test_a_local_only_coaching_file_is_refused_for_a_hosted_model(tmp_path, no_key):
    coaching = _coaching(tmp_path, {"transmission": "local-only"})
    with pytest.raises(RuntimeError) as ei:
        asyncio.run(execute_run(_config(tmp_path, coaching)))
    msg = str(ei.value)
    assert "coaching file coaching.txt" in msg and "local-only" in msg
    assert KEY_MISSING not in msg


def test_a_coaching_file_without_terms_is_the_users_own_prompt(tmp_path, no_key):
    coaching = _coaching(tmp_path)
    with pytest.raises(RuntimeError, match="not found"):   # reaches the key check
        asyncio.run(execute_run(_config(tmp_path, coaching)))


def test_policy_of_a_coaching_file():
    assert coaching_file_policy(None) is None


def test_policy_reads_the_sidecar(tmp_path):
    assert coaching_file_policy(_coaching(tmp_path)) is None
    sealed = tmp_path / "s.txt"
    sealed.write_text("x")
    (tmp_path / "s.txt.champollion.json").write_text(json.dumps({"segment": "held_out"}))
    assert coaching_file_policy(sealed).mode == MODE_SEALED
    marked = tmp_path / "m.txt"
    marked.write_text("x")
    (tmp_path / "m.txt.champollion.json").write_text(json.dumps({"transmission": "local-only"}))
    assert coaching_file_policy(marked).mode == MODE_SEALED
    only_terms = tmp_path / "t.txt"
    only_terms.write_text("x")
    (tmp_path / "t.txt.champollion.json").write_text(json.dumps({"terms": {"training": "allowed"}}))
    assert coaching_file_policy(only_terms) is None


def test_an_unreadable_sidecar_is_not_no_terms(tmp_path):
    bad = tmp_path / "b.txt"
    bad.write_text("x")
    (tmp_path / "b.txt.champollion.json").write_text("{nope")
    with pytest.raises(ValueError):
        coaching_file_policy(bad)
