"""`nmt-forge export` writes the project's deployment/1 file for the model
it exported (deploy/<name>.json, local-model on the export) — in a rails
project only, never for a hook-selected model, never over another model's
deployment. mt-eval reads the file as written. Invented names only."""

from __future__ import annotations

import json
from pathlib import Path

from mt_eval_harness.deployment import check_deployment

from nmt_forge.deployment import write_for_export

ARGS = {"name": "nmt-forge-tiny", "source": "eng", "target": "qaa",
        "description": "hf-scratch model tiny (eng→qaa)", "hook": None}


def _rails(tmp_path: Path) -> Path:
    tmp_path.mkdir(parents=True, exist_ok=True)
    (tmp_path / "champollion.project.json").write_text(json.dumps({"kind": "language"}))
    model = tmp_path / "export" / "model"
    model.mkdir(parents=True)
    return model


def test_a_rails_project_gets_the_exported_models_deployment(tmp_path):
    model = _rails(tmp_path)
    out = write_for_export(model_dir=model, **ARGS)
    assert out["written"] == "deploy/nmt-forge-tiny.json"
    doc = json.loads((tmp_path / "deploy" / "nmt-forge-tiny.json").read_text())
    assert check_deployment(doc) == []
    assert doc["method"] == {"method": "local-model", "model": "export/model"}
    assert doc["pair"] == {"source": "eng", "target": "qaa"}
    # a re-export of the same model replaces its own file
    assert write_for_export(model_dir=model, **ARGS)["written"]


def test_what_it_does_not_write_and_why(tmp_path):
    lone = tmp_path / "lone" / "model"
    lone.mkdir(parents=True)
    assert "not in a rails project" in write_for_export(model_dir=lone, **ARGS)["skipped"]
    model = _rails(tmp_path / "p")
    hooked = write_for_export(model_dir=model, **dict(ARGS, hook="crk_fst:tie_break"))
    assert "decode hook 'crk_fst:tie_break'" in hooked["skipped"]
    assert not (tmp_path / "p" / "deploy").exists()
    # another model's deployment by that name is never replaced
    (tmp_path / "p" / "deploy").mkdir()
    (tmp_path / "p" / "deploy" / "nmt-forge-tiny.json").write_text(json.dumps(
        {"method": {"method": "lexicon", "model": "data/lexicon/words.tsv"}}))
    kept = write_for_export(model_dir=model, **ARGS)
    assert "already deploys data/lexicon/words.tsv" in kept["skipped"]
