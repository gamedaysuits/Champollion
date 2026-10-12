"""resolve_dataset must work under `pip install`, not just in-repo (B4).

In a git checkout, a dataset's `local_path` resolves relative to the monorepo
root. Under `pip install` there is no monorepo (the package sits in
site-packages), so the old single monorepo-root guess silently missed and —
for a local-path-only dataset with no fetch fallback — hard-failed the run.
The fix tries several bases plus an MT_EVAL_DATA_ROOT override, and gives a
pip-friendly error when nothing resolves.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness.config import resolve_dataset


def _registry(tmp_path, dataset):
    reg = tmp_path / "registry.json"
    reg.write_text(json.dumps({"registry_version": "3.0.0", "datasets": [dataset]}))
    return reg


def test_resolves_local_path_via_env_data_root(tmp_path, monkeypatch):
    data_root = tmp_path / "dataroot"
    rel = "arena/datasets/curated/rt-corpus.json"
    corpus = data_root / rel
    corpus.parent.mkdir(parents=True)
    corpus.write_text('{"entries": []}')

    reg = _registry(tmp_path, {"id": "rt-ds", "local_path": rel})
    monkeypatch.setenv("MT_EVAL_DATA_ROOT", str(data_root))

    resolved = resolve_dataset("rt-ds", registry_path=reg, assume_yes=True)
    assert Path(resolved) == corpus


def test_missing_local_path_no_url_raises_pip_friendly_error(tmp_path, monkeypatch):
    monkeypatch.delenv("MT_EVAL_DATA_ROOT", raising=False)
    # No fetch fallback: stub the corpora-card fetch to "nothing found".
    monkeypatch.setattr(
        "mt_eval_harness.corpus_fetch.try_fetch_missing_corpus",
        lambda *a, **k: None,
        raising=False,
    )
    reg = _registry(tmp_path, {
        "id": "rt-missing",
        "local_path": "nowhere/xyz-unlikely-9281.json",
        "access": "private",
    })

    with pytest.raises((ValueError, FileNotFoundError)) as exc:
        resolve_dataset("rt-missing", registry_path=reg, assume_yes=True)

    msg = str(exc.value)
    assert "MT_EVAL_DATA_ROOT" in msg or "--corpus" in msg


def test_direct_existing_path_still_wins(tmp_path):
    # A real file path passed directly must resolve regardless of registry.
    f = tmp_path / "local.json"
    f.write_text('{"entries": []}')
    assert Path(resolve_dataset(str(f))) == f
