"""Forge fixes found walking the rails end to end (dogfood, 2026-10-10).

- `prereg new --expect/--rationale`: a prediction in the person's own words,
  no hand-edited JSON (the rails' predict step); template text still refused.
- `leak-audit --clean-to data/clean/x.jsonl` makes the folder instead of a
  "No such file or directory" traceback.
- `status` names the training-extra install as THE step before training, with
  the command for how forge was installed (uv tool → uv; else pip on this
  interpreter) — not left for preflight to discover.
"""

from __future__ import annotations

import json

from nmt_forge import advisor
from nmt_forge.cli import main
from nmt_forge.training import backends
from tests.conftest import write_jsonl


def test_prereg_new_with_the_persons_words(ws, test_set, capsys):
    code = main(["--workspace", str(ws.root), "prereg", "new", "first-model",
                 "--eval-set", "toy-test", "--expect", "between 5 and 20",
                 "--rationale", "eighty pairs is very little", "--json"])
    assert code == 0, capsys.readouterr()
    doc = json.loads((ws.prereg_dir / "first-model.json").read_text())
    preds = doc.get("predictions") or doc.get("prediction") or []
    assert any(p.get("expect") == "between 5 and 20" for p in preds), doc


def test_prereg_expect_needs_a_rationale_and_refuses_template_text(ws, test_set, capsys):
    assert main(["--workspace", str(ws.root), "prereg", "new", "a", "--eval-set",
                 "toy-test", "--expect", "between 5 and 20", "--json"]) == 2
    assert "needs --rationale" in capsys.readouterr().out
    assert main(["--workspace", str(ws.root), "prereg", "new", "b", "--eval-set",
                 "toy-test", "--expect", "REPLACE: e.g.", "--rationale", "x", "--json"]) == 2
    assert main(["--workspace", str(ws.root), "prereg", "new", "c", "--eval-set",
                 "toy-test", "--json"]) == 2


def test_leak_audit_makes_the_clean_folder(ws, test_set, tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    corpus = write_jsonl(tmp_path / "pairs.jsonl", [
        {"source": f"a unique wug sentence {i}", "target": f"wugzo {i} pel"} for i in range(5)])
    code = main(["--workspace", str(ws.root), "leak-audit", str(corpus),
                 "--clean-to", "data/clean/pairs.clean.jsonl", "--json"])
    assert code == 0, capsys.readouterr()
    assert (tmp_path / "data" / "clean" / "pairs.clean.jsonl").is_file()


def test_install_command_matches_how_forge_was_installed(tmp_path, monkeypatch):
    import sys

    monkeypatch.setattr(sys, "prefix", str(tmp_path))
    assert backends.hf_install_command().endswith("-m pip install 'nmt-forge[hf]'")
    (tmp_path / "uv-receipt.toml").write_text("[tool]\n")
    assert backends.hf_install_command() == \
        "uv tool install --reinstall --python 3.12 'nmt-forge[hf]'"


def test_the_people_judge_their_prediction_before_the_model_is_used():
    exports = [{"prereg": {"id": "first-model", "pending": [
        {"number": 1, "predicted": "between 5 and 20", "observed": 7.68,
         "observed_ci": [4.58, 10.88]}]}}]
    a = advisor._judge_advice(exports, [])
    assert a.state == "judge-prediction"
    assert a.command == ('nmt-forge prereg verdict first-model --prediction 1 '
                         '--{verdict} --by "{by}"')
    assert '"between 5 and 20"' in a.why and "chrF++ 7.68 [4.58, 10.88]" in a.why
    assert a.answers["verdict"]["enum"] == ["held", "missed"]
    assert a.to_json()["answers"] == a.answers
    assert advisor._judge_advice([{"prereg": {"id": "x", "pending": []}}], []) is None


def test_the_try_page_is_self_contained_and_honest():
    from nmt_forge.serve import _try_page

    page = _try_page({"model": "m<x>", "pair": "eng→qaa"}, token_required=False)
    assert "m&lt;x&gt;" in page, "names are escaped"
    assert "fetch('/translate'" in page and "http" not in page.split("<script>")[1].split("fetch")[0]
    assert "checks nothing it returns" in page
    assert 'id="tok"' not in page
    assert 'id="tok"' in _try_page({}, token_required=True)


def test_status_names_the_training_extra_before_training(tmp_path, monkeypatch):
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({"run_name": "t", "model": {"backend": "hf-scratch"},
                               "data": {"gold": [], "dev": "d"}}))
    monkeypatch.setattr(backends, "hf_missing", lambda model=None: ["torch"])
    a = advisor._training_extra_advice({"project": {"config": str(cfg)}}, [])
    assert a is not None and a.state == "needs-training-extra"
    assert "install" in a.command and "torch missing" in a.why
    monkeypatch.setattr(backends, "hf_missing", lambda model=None: [])
    assert advisor._training_extra_advice({"project": {"config": str(cfg)}}, []) is None
