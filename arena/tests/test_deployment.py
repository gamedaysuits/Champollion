"""deployment/1: one file says what is deployed — the method, its gates, the
pair — and run, translate and serve all read it, so what is measured is
what ships (founder, 2026-10-09: deployment is the eval pipeline on
source-only input). Invented vocabulary only."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import urllib.request
from pathlib import Path

import pytest

from mt_eval_harness.deployment import (
    DeploymentError, check_deployment, pair_mismatch, read_deployment)

ARENA = Path(__file__).resolve().parents[1]
SCHEMA = "https://champollion.dev/schemas/deployment/1.json"


def _mteval(cwd: Path, *args: str) -> subprocess.CompletedProcess:
    env = dict(os.environ, PYTHONPATH=str(ARENA))
    return subprocess.run([sys.executable, "-m", "mt_eval_harness", *args],
                          cwd=cwd, env=env, capture_output=True, text=True, timeout=300)


def _project(tmp_path: Path, *, gates: bool = True) -> Path:
    """A project root: a dictionary, a bigger one for the fallback, a gate
    chain, a test set with references, an input file, and the deployment."""
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "words.tsv").write_text("old\tстарый\nhouse\tдом\n", encoding="utf-8")
    (tmp_path / "data" / "bigger.tsv").write_text("old\tстарый\nhouse\tдом\ncar\tмашина\n",
                                                  encoding="utf-8")
    (tmp_path / "gates").mkdir()
    (tmp_path / "gates" / "no-english.json").write_text(json.dumps({
        "$schema": "https://champollion.dev/schemas/gate-chain/1.json", "id": "no-english-left",
        "gates": [{"id": "script", "kind": "metric-threshold", "metric": "code_switching",
                   "field": "code_switching_rate", "max": 0, "on_refuse": "fallback"}],
        "fallback": {"method": "lexicon", "model": "data/bigger.tsv"}}))
    pair = {"dataset": {"corpus_id": "dep", "language_pair": {"source": "eng", "target": "rus"},
                        "license": "CC-BY-4.0"}}
    (tmp_path / "data" / "test.json").write_text(json.dumps(dict(pair, entries=[
        {"id": "1", "source": "old house", "reference": "старый дом"},
        {"id": "2", "source": "old car", "reference": "старая машина"}])), encoding="utf-8")
    (tmp_path / "data" / "input.json").write_text(json.dumps(dict(pair, entries=[
        {"id": "1", "source": "old house"}, {"id": "2", "source": "old car"}])), encoding="utf-8")
    (tmp_path / "deploy").mkdir()
    dep = {"$schema": SCHEMA, "id": "eng-rus-words",
           "pair": {"source": "eng", "target": "rus", "target_script": "Cyrl"},
           "method": {"method": "lexicon", "model": "data/words.tsv"},
           **({"gates": "gates/no-english.json"} if gates else {})}
    (tmp_path / "deploy" / "words.json").write_text(json.dumps(dep))
    return tmp_path / "deploy" / "words.json"


def test_the_document_is_checked(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    ok = {"$schema": SCHEMA, "id": "x", "pair": {"source": "eng", "target": "rus"},
          "method": {"method": "lexicon", "model": "w.tsv"}}
    assert check_deployment(ok) == []
    assert check_deployment(dict(ok, score=31.2)), "a deployment names no score"
    assert check_deployment(dict(ok, pair={"source": "eng"}))
    assert check_deployment(dict(ok, pair={"source": "eng", "target": "rus", "target_script": "cyrillic"}))
    assert check_deployment(dict(ok, serve={"port": 70000}))
    assert check_deployment(dict(ok, **{"x-note": "kept"})) == []
    (tmp_path / "d.json").write_text(json.dumps(dict(ok, gates="missing.json")))
    with pytest.raises(DeploymentError, match="its gates — .*no such gate-chain file"):
        read_deployment(tmp_path / "d.json")
    assert pair_mismatch(ok, "eng", "rus-Cyrl") is None
    assert "translates into rus" in pair_mismatch(ok, "eng", "sme")


def test_a_projects_gates_and_deployments_are_checked_as_the_cli_checks_them(tmp_path):
    from mt_eval_harness.framework import check_project

    (tmp_path / "gates").mkdir()
    (tmp_path / "deploy").mkdir()
    (tmp_path / "gates" / "loose.json").write_text(json.dumps({
        "$schema": "https://champollion.dev/schemas/gate-chain/1.json", "id": "loose",
        "gates": [{"id": "g", "kind": "metric-threshold", "metric": "m", "field": "v",
                   "on_refuse": "fallback"}]}))
    (tmp_path / "deploy" / "words.json").write_text(json.dumps({
        "$schema": SCHEMA, "id": "words", "pair": {"source": "eng", "target": "xyz"},
        "method": {"method": "lexicon", "model": "data/lexicon/words.tsv"}, "gates": "gates/loose.json"}))
    (tmp_path / "deploy" / "torn.json").write_text("{not json")
    r = check_project(tmp_path)
    assert r["ok"] is False
    assert [(d["file"], d["type"], d["version"]) for d in r["documents"]] == [
        ("deploy/torn.json", "deployment", None), ("deploy/words.json", "deployment", 1),
        ("gates/loose.json", "gate-chain", 1)]
    assert r["documents"][0]["errors"] == ["$: not readable as JSON (JSONDecodeError)"]
    assert r["documents"][1]["errors"] == []
    assert r["documents"][2]["errors"] == [
        "$.gates[0]: a metric-threshold gate needs min and/or max",
        "$.gates[0]: on_refuse fallback needs the chain's fallback "
        "(\"fallback\": {\"method\": \"lexicon\", \"model\": \"<dictionary>\"})"]


def test_one_file_is_tested_run_over_input_and_served(tmp_path, monkeypatch):
    dep = _project(tmp_path)
    monkeypatch.chdir(tmp_path)              # paths in the file are the project root's
    _, record = read_deployment(dep)
    # measured: a deployment whose gates fall back is refused by run — a
    # score never blends the method's and the fallback's translations
    # (founder, 2026-10-11) — before anything is translated
    r = _mteval(tmp_path, "run", "--deployment", "deploy/words.json", "--corpus", "data/test.json",
                "-o", "out")
    assert r.returncode != 0
    assert "never for a measurement" in r.stdout + r.stderr
    assert not list((tmp_path / "out").glob("run_*.json"))
    # the same deployment's method, measured on its own, with the gates that
    # do not fall back: its run records the deployment it measured
    dep_doc = json.loads(dep.read_text())
    plain = tmp_path / "deploy" / "words-measured.json"
    gates_file = tmp_path / dep_doc["gates"]
    chain_doc = json.loads(gates_file.read_text())
    measured_gates = tmp_path / "gates" / "measured.json"
    measured_gates.parent.mkdir(exist_ok=True)
    measured_gates.write_text(json.dumps({**{k: v for k, v in chain_doc.items() if k != "fallback"},
                                          "id": "measured", "gates": [dict(g, on_refuse="drop")
                                                                      for g in chain_doc["gates"]]}))
    plain.write_text(json.dumps(dict(dep_doc, id="eng-rus-words-measured",
                                     gates=str(measured_gates.relative_to(tmp_path)))))
    r = _mteval(tmp_path, "run", "--deployment", "deploy/words-measured.json", "--corpus",
                "data/test.json", "-o", "out")
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
    (log,) = [p for p in (tmp_path / "out").glob("run_*.json") if not p.name.endswith("_report.json")]
    cfg = json.loads(log.read_text())["config"]
    assert cfg["deployment"]["id"] == "eng-rus-words-measured"
    report = json.loads(next((tmp_path / "out").glob("*_report.json")).read_text())
    assert "fallback" not in report["overall"]["gates"]
    # run over a file: the same deployment, no references, nothing scored
    t = _mteval(tmp_path, "translate", "--json", "--deployment", "deploy/words.json",
                "--corpus", "data/input.json", "-o", "out2", "--out", "out2/t.jsonl")
    assert t.returncode == 0, t.stdout[-2000:] + t.stderr[-2000:]
    rows = [json.loads(x) for x in (tmp_path / "out2" / "t.jsonl").read_text().splitlines()]
    assert [x["output"] for x in rows] == ["старый дом", "старый машина"]
    # served: the same file, behind the /translate contract (paths in it are
    # the project root's, where the rails run commands)
    from mt_eval_harness.serve import serve_deployment

    served, httpd = serve_deployment("deploy/words.json", port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        base = f"http://127.0.0.1:{httpd.server_address[1]}"
        req = urllib.request.Request(f"{base}/translate", data=json.dumps(
            {"keys": {"a": "old car"}}).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
        assert body["translations"] == {"a": "старый машина"}
        with urllib.request.urlopen(f"{base}/health") as resp:
            health = json.loads(resp.read())
        assert health["deployment"] == {"id": "eng-rus-words", "sha256": record["sha256"]}
    finally:
        httpd.shutdown()
        httpd.server_close()


def test_the_file_is_the_one_place_it_is_said(tmp_path):
    _project(tmp_path)
    both = _mteval(tmp_path, "run", "--deployment", "deploy/words.json", "--corpus", "data/test.json",
                   "--method", "lexicon", "-o", "out")
    assert both.returncode != 0 and "drop --method" in both.stdout + both.stderr
    # a test set in another pair is not a test of this deployment
    data = json.loads((tmp_path / "data" / "test.json").read_text())
    data["dataset"]["language_pair"]["target"] = "ukr"
    (tmp_path / "data" / "other.json").write_text(json.dumps(data), encoding="utf-8")
    other = _mteval(tmp_path, "run", "--deployment", "deploy/words.json", "--corpus", "data/other.json",
                    "-o", "out")
    assert other.returncode != 0 and "translates into rus" in other.stdout + other.stderr
    assert not list((tmp_path / "out").glob("run_*.json")), "nothing was translated"
    # serve: the file, or the flags — never both, never neither
    s = _mteval(tmp_path, "serve", "--deployment", "deploy/words.json", "--pair", "eng-rus")
    assert s.returncode == 2 and "drop --pair" in s.stderr
    s = _mteval(tmp_path, "serve")
    assert s.returncode == 2 and "--deployment deploy/<name>.json" in s.stderr
