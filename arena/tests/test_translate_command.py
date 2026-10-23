"""`mt-eval translate`: deployment = the run pipeline on source-only input,
with no metrics (founder, 2026-10-09).

Same method resolution, transmission gate, cache and run log as `run`; no
references needed, nothing scored, no report; the translations land in
--out with the input's terms beside them. `run` still refuses a corpus with
no references. Invented vocabulary only.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ARENA = Path(__file__).resolve().parents[1]


def _mteval(cwd: Path, *args: str) -> subprocess.CompletedProcess:
    env = dict(os.environ, PYTHONPATH=str(ARENA))
    return subprocess.run([sys.executable, "-m", "mt_eval_harness", *args],
                          cwd=cwd, env=env, capture_output=True, text=True,
                          timeout=300)


def _setup(tmp_path: Path, *, local_only: bool = False) -> None:
    (tmp_path / "words.tsv").write_text("old\tvuoras\nhouse\tviessu\n", encoding="utf-8")
    (tmp_path / "input.json").write_text(json.dumps({
        "dataset": {"corpus_id": "translate-input",
                    "language_pair": {"source": "eng", "target": "sme"},
                    "license": "CC-BY-2.0"},
        "entries": [{"id": "1", "source": "an old house"},
                    {"id": "2", "source": "the house"}]}), encoding="utf-8")
    if local_only:
        (tmp_path / "input.json.champollion.json").write_text(
            json.dumps({"transmission": "local-only"}), encoding="utf-8")


def test_translate_writes_outputs_and_scores_nothing(tmp_path):
    _setup(tmp_path)
    r = _mteval(tmp_path, "translate", "--corpus", "input.json", "--method",
                "lexicon", "-m", "words.tsv", "-o", "out", "--out", "out/t.jsonl")
    assert r.returncode == 0, r.stderr + r.stdout
    rows = [json.loads(l) for l in (tmp_path / "out" / "t.jsonl").read_text().splitlines()]
    assert [(x["id"], x["output"]) for x in rows] == [("1", "an vuoras viessu"),
                                                      ("2", "the viessu")]
    assert "Nothing was scored" in r.stdout
    assert not list((tmp_path / "out").glob("*_report.json")), "no report: nothing to score"
    (log,) = [p for p in (tmp_path / "out").glob("run_*.json") if "champollion" not in p.name]
    assert json.loads(log.read_text())["config"]["translate_only"] is True
    # an unmarked input and an unmarked dictionary: no sidecar is needed
    assert not (tmp_path / "out" / "t.jsonl.champollion.json").exists()


def test_tsv_out_json_summary_and_the_inputs_terms_travel(tmp_path):
    _setup(tmp_path, local_only=True)
    r = _mteval(tmp_path, "translate", "--json", "--corpus", "input.json",
                "--method", "lexicon", "-m", "words.tsv", "-o", "out",
                "--out", "out/t.tsv")
    assert r.returncode == 0, r.stderr + r.stdout
    summary = json.loads(r.stdout.strip().splitlines()[-1])
    assert summary["translated"] == 2 and summary["errors"] == 0
    assert summary["output_gates"].startswith("none")
    assert (tmp_path / "out" / "t.tsv").read_text() == \
        "an old house\tan vuoras viessu\nthe house\tthe viessu\n"
    side = json.loads((tmp_path / "out" / "t.tsv.champollion.json").read_text())
    assert side["transmission"] == "local-only"
    assert side["$schema"] == "https://champollion.dev/schemas/set/1.json"


def test_translate_gates_what_it_writes(tmp_path):
    """--gates: what is written is what the gates let through, each line
    with its verdicts (codes, no text), and the summary names the chain."""
    _setup(tmp_path)
    (tmp_path / "gates.json").write_text(json.dumps({
        "$schema": "https://champollion.dev/schemas/gate-chain/1.json", "id": "script-check",
        "gates": [{"id": "script", "kind": "metric-threshold", "metric": "code_switching",
                   "field": "code_switching_rate", "max": 1, "on_refuse": "keep-source"}]}))
    r = _mteval(tmp_path, "translate", "--json", "--corpus", "input.json", "--method", "lexicon",
                "-m", "words.tsv", "-o", "out", "--out", "out/t.jsonl", "--gates", "gates.json")
    assert r.returncode == 0, r.stderr + r.stdout
    summary = json.loads(r.stdout.strip().splitlines()[-1])
    assert summary["output_gates"]["chain"] == "script-check"
    rows = [json.loads(line) for line in (tmp_path / "out" / "t.jsonl").read_text().splitlines()]
    assert all(x["gates"][0]["gate"] == "script" for x in rows)
    assert summary["output_gates"]["refused"] == sum(x["gates"][0]["verdict"] == "refuse" for x in rows)
    # a gate whose plugin is not loaded stops it before anything is translated
    (tmp_path / "bad.json").write_text(json.dumps({
        "$schema": "https://champollion.dev/schemas/gate-chain/1.json", "id": "bad",
        "gates": [{"id": "x", "kind": "metric-threshold", "metric": "nope", "field": "v",
                   "min": 1, "on_refuse": "drop"}]}))
    bad = _mteval(tmp_path, "translate", "--corpus", "input.json", "--method", "lexicon",
                  "-m", "words.tsv", "-o", "out2", "--out", "out2/t.jsonl", "--gates", "bad.json")
    assert bad.returncode != 0 and "not loaded here" in (bad.stdout + bad.stderr)
    assert not (tmp_path / "out2" / "t.jsonl").exists()


def test_translate_falls_back_and_the_fallbacks_terms_travel(tmp_path):
    """A gate with on_refuse fallback: the chain's dictionary translates
    what the method left in English; its words land in the file, so its
    terms go in the file's sidecar too."""
    (tmp_path / "words.tsv").write_text("old\tстарый\nhouse\tдом\n", encoding="utf-8")
    (tmp_path / "bigger.tsv").write_text("old\tстарый\nhouse\tдом\ncar\tмашина\n", encoding="utf-8")
    (tmp_path / "bigger.tsv.champollion.json").write_text(
        json.dumps({"terms": {"training": "not-allowed"}}), encoding="utf-8")
    (tmp_path / "input.json").write_text(json.dumps({
        "dataset": {"corpus_id": "translate-input", "language_pair": {"source": "eng", "target": "rus"},
                    "license": "CC-BY-2.0"},
        "entries": [{"id": "1", "source": "old house"}, {"id": "2", "source": "old car"},
                    {"id": "3", "source": "house boat"}]}), encoding="utf-8")
    (tmp_path / "gates.json").write_text(json.dumps({
        "$schema": "https://champollion.dev/schemas/gate-chain/1.json", "id": "no-english-left",
        "gates": [{"id": "script", "kind": "metric-threshold", "metric": "code_switching",
                   "field": "code_switching_rate", "max": 0, "on_refuse": "fallback"}],
        "fallback": {"method": "lexicon", "model": "bigger.tsv"}}))
    # Russian is written in more than one script (its card says so): with no
    # references, the script check cannot know which — it stops, untranslated
    blind = _mteval(tmp_path, "translate", "--corpus", "input.json", "--method", "lexicon",
                    "-m", "words.tsv", "-o", "out0", "--out", "out0/t.jsonl", "--gates", "gates.json")
    assert blind.returncode != 0
    assert "cannot judge a translation without a reference" in blind.stdout + blind.stderr
    assert not (tmp_path / "out0" / "t.jsonl").exists()
    r = _mteval(tmp_path, "translate", "--json", "--corpus", "input.json", "--method", "lexicon",
                "-m", "words.tsv", "-o", "out", "--out", "out/t.jsonl", "--gates", "gates.json",
                "--target-script", "Cyrl")
    assert r.returncode == 0, r.stderr + r.stdout
    summary = json.loads(r.stdout.strip().splitlines()[-1])
    assert summary["output_gates"]["shipped_from"] == {"method": 1, "source": 0, "fallback": 1, "nothing": 1}
    rows = {x["id"]: x for x in map(json.loads, (tmp_path / "out" / "t.jsonl").read_text().splitlines())}
    assert (rows["2"]["output"], rows["2"]["shipped_from"]) == ("старый машина", "fallback")
    assert rows["3"]["output"] == "" and rows["3"]["fallback"]["verdicts"][0]["verdict"] == "refuse"
    side = json.loads((tmp_path / "out" / "t.jsonl.champollion.json").read_text())
    assert side["terms"] == {"training": "not-allowed"}
    # human output says what checked the lines and where each came from
    human = _mteval(tmp_path, "translate", "--corpus", "input.json", "--method", "lexicon",
                    "-m", "words.tsv", "-o", "out", "--out", "out/t2.jsonl", "--gates", "gates.json",
                    "--target-script", "Cyrl")
    assert "Gates (no-english-left) checked every line: 2 refused, 0 flagged. Written: 1 from " \
           "the method, 1 from the fallback, 1 left empty." in human.stdout, human.stdout


def test_run_still_needs_references(tmp_path):
    _setup(tmp_path)
    r = _mteval(tmp_path, "run", "--corpus", "input.json", "--method",
                "lexicon", "-m", "words.tsv", "-o", "out")
    assert r.returncode != 0
    assert "No entries have a 'reference' field" in r.stdout


# -- local-only output: the rule `mt-eval serve` keeps, for a file --------------
#
# A method whose output is local-only (a dictionary marked local-only, a model
# nmt-forge trained here on local-only sentences or whose training terms were
# never recorded — serve.output_local_only) writes a file marked local-only,
# and only inside the project unless the data's holders agreed
# (--holders-agreed-by, recorded in the sidecar). Found 2026-10-11 by a
# data-flow review: translate asked nothing and marked nothing for a model.

SET1 = "https://champollion.dev/schemas/set/1.json"


def _forge_model(folder: Path, record: dict | None) -> Path:
    """A model folder as nmt-forge exports it, as far as the marks go: its
    forge-model.json (no weights — nothing here loads it)."""
    folder.mkdir(parents=True)
    (folder / "config.json").write_text(json.dumps({"model_type": "marian"}))
    if record is not None:
        (folder / "forge-model.json").write_text(json.dumps(record))
    return folder


def _forge_export_v1(export: Path, record: dict) -> Path:
    """An nmt-forge export written before 2026-10-03 (nmt-forge-model/1),
    as far as the marks go: ``record`` as the forge-model.json at the export
    root, the weights' folder ``model/`` beside it (no weights). Returns
    ``model/`` — what ``-m`` names."""
    model = export / "model"
    model.mkdir(parents=True)
    (model / "config.json").write_text(json.dumps({"model_type": "marian"}))
    (export / "forge-model.json").write_text(json.dumps(record))
    return model


def _local_only_project(tmp_path: Path) -> Path:
    """A rails project (champollion.project.json) whose dictionary its
    holders marked local-only, and an unmarked input."""
    proj = tmp_path / "proj"
    (proj / "data").mkdir(parents=True)
    (proj / "champollion.project.json").write_text(json.dumps({
        "$schema": "https://champollion.dev/schemas/project/1.json", "kind": "language",
        "name": "test", "pair": {"source": "eng", "target": "sme"}}))
    (proj / "data" / "words.tsv").write_text("old\tvuoras\nhouse\tviessu\n", encoding="utf-8")
    (proj / "data" / "words.tsv.champollion.json").write_text(
        json.dumps({"transmission": "local-only"}), encoding="utf-8")
    (proj / "data" / "input.json").write_text(json.dumps({
        "dataset": {"corpus_id": "translate-input",
                    "language_pair": {"source": "eng", "target": "sme"},
                    "license": "CC-BY-2.0"},
        "entries": [{"id": "1", "source": "an old house"}]}), encoding="utf-8")
    return proj


def test_a_models_output_is_marked_as_serve_judges_it(tmp_path):
    """derived_mark (what every file holding a run's outputs carries) and
    serve.output_local_only give the same answer for the same model folder
    — before the fix derived_mark returned {} for all of these."""
    from mt_eval_harness.corpus_loader import derived_mark
    from mt_eval_harness.serve import output_local_only

    cases = {
        "learned-local-only": ({"trained_on": {"terms": {
            "transmission": "local-only", "terms": {"training": "not-allowed"}}}},
            {"transmission": "local-only", "terms": {"training": "not-allowed"}}),
        "never-recorded": ({"base": "x"}, {"transmission": "local-only"}),
        "learned-nothing-marked": ({"trained_on": {"terms": {}}}, {}),
        "not-forges": (None, {}),
    }
    for name, (record, want) in cases.items():
        folder = _forge_model(tmp_path / name, record)
        em = {"kind": "directory", "id": name, "path": str(folder)}
        got = derived_mark({"config": {"engine_model": em}})
        assert got == want, name
        assert ("transmission" in got) == (output_local_only(em)[0] is True), name
    hub = {"kind": "hub", "id": "Helsinki-NLP/opus-mt-en-es"}
    assert derived_mark({"config": {"engine_model": hub}}) == {}


def test_a_local_only_dictionarys_output_stays_in_the_project(tmp_path):
    proj = _local_only_project(tmp_path)
    base = ("translate", "--corpus", "data/input.json", "--method", "lexicon",
            "-m", "data/words.tsv", "-o", "out")
    inside = _mteval(proj, *base, "--out", "translations/t.jsonl")
    assert inside.returncode == 0, inside.stderr + inside.stdout
    side = json.loads((proj / "translations" / "t.jsonl.champollion.json").read_text())
    assert side["transmission"] == "local-only" and "holders_agreed" not in side
    assert "kept inside the project" in inside.stdout
    # outside the project: refused before anything is translated, nothing written
    far = _mteval(proj, *base, "--out", "../shared/t.jsonl")
    assert far.returncode == 1
    assert "outside the project" in far.stderr and "--holders-agreed-by" in far.stderr
    assert not (tmp_path / "shared").exists()
    # the run log holds the outputs too: its folder is held to the same line
    far_log = _mteval(proj, "translate", "--corpus", "data/input.json", "--method", "lexicon",
                      "-m", "data/words.tsv", "-o", "../logs", "--out", "translations/t2.jsonl")
    assert far_log.returncode == 1 and not (tmp_path / "logs").exists()
    # from a folder inside the project, the project is still the line
    (proj / "work").mkdir()
    sub = _mteval(proj / "work", "translate", "--corpus", "../data/input.json", "--method",
                  "lexicon", "-m", "../data/words.tsv", "-o", "out", "--out", "../translations/t3.jsonl")
    assert sub.returncode == 0, sub.stderr + sub.stdout
    # the holders agreed: written there, still local-only, and who agreed is recorded
    ok = _mteval(proj, *base, "--json", "--out", "../shared/t.jsonl",
                 "--holders-agreed-by", "the family, 2026-10-11 meeting")
    assert ok.returncode == 0, ok.stderr + ok.stdout
    summary = json.loads(ok.stdout.strip().splitlines()[-1])
    assert summary["holders_agreed"]["by"] == "the family, 2026-10-11 meeting"
    side = json.loads((tmp_path / "shared" / "t.jsonl.champollion.json").read_text())
    assert side["transmission"] == "local-only"
    assert side["holders_agreed"]["by"] == "the family, 2026-10-11 meeting"
    from mt_eval_harness.framework import check_document
    assert check_document(side, "set")["errors"] == []
    # an agreement nobody needed is said so, not recorded
    extra = _mteval(proj, *base, "--out", "translations/t4.jsonl",
                    "--holders-agreed-by", "the family")
    assert "--holders-agreed-by not recorded" in extra.stdout
    assert "holders_agreed" not in json.loads(
        (proj / "translations" / "t4.jsonl.champollion.json").read_text())


def test_outside_a_rails_project_the_folder_it_runs_in_is_the_line(tmp_path):
    _setup(tmp_path)
    (tmp_path / "words.tsv.champollion.json").write_text(json.dumps({"transmission": "local-only"}))
    work = tmp_path / "work"
    work.mkdir()
    r = _mteval(work, "translate", "--corpus", "../input.json", "--method", "lexicon",
                "-m", "../words.tsv", "-o", "out", "--out", "../t.jsonl")
    assert r.returncode == 1
    assert "no champollion.project.json" in r.stderr
    assert not (tmp_path / "t.jsonl").exists()


def test_a_local_only_model_reached_by_its_deployment_is_refused_outside(tmp_path):
    """The reported case: `mt-eval translate --deployment deploy/<name>.json
    --source-file <file> --out <file>` on a model trained on local-only
    sentences. Refused before the model is loaded (this folder has no
    weights: had it been loaded, the run would have failed differently)."""
    proj = _local_only_project(tmp_path)
    _forge_model(proj / "models" / "m", {"trained_on": {"terms": {"transmission": "local-only"}}})
    (proj / "deploy").mkdir()
    (proj / "deploy" / "m.json").write_text(json.dumps({
        "$schema": "https://champollion.dev/schemas/deployment/1.json", "id": "m",
        "pair": {"source": "eng", "target": "sme"},
        "method": {"method": "local-model", "model": "models/m"}}))
    (proj / "in.txt").write_text("an old house\n", encoding="utf-8")
    for how in (("--deployment", "deploy/m.json"),
                ("--method", "local-model", "-m", "models/m", "--source-code", "eng",
                 "--target-code", "sme")):
        r = _mteval(proj, "translate", *how, "--source-file", "in.txt",
                    "-o", "out", "--out", str(tmp_path / "elsewhere" / "t.jsonl"))
        assert r.returncode == 1, r.stdout + r.stderr
        assert "it learned from sentences marked local-only" in r.stderr
        assert not (tmp_path / "elsewhere").exists()


# An older export's model folder (nmt-forge-model/1: forge-model.json at the
# export root, -m export/model) was "not known": its translations were not
# marked, not withheld from the terminal, and written anywhere. Every /1
# export predates recorded training terms, so they are local-only.

V1_RECORD = {"export_format": "nmt-forge-model/1", "model_dir": "model"}


def test_an_older_exports_translations_are_marked_and_withheld_as_serve_judges_them(tmp_path):
    from mt_eval_harness.corpus_loader import derived_mark
    from mt_eval_harness.serve import output_local_only
    from mt_eval_harness.transmission_policy import model_withheld_reason

    model = _forge_export_v1(tmp_path / "export", V1_RECORD)
    em = {"kind": "directory", "id": "model", "path": str(model)}
    doc = {"config": {"engine_model": em}}
    assert output_local_only(em)[0] is True
    assert derived_mark(doc) == {"transmission": "local-only"}
    why = model_withheld_reason(doc["config"])
    assert why.startswith("its outputs come from a local-only model, model (")
    assert "whose training terms were never recorded" in why and "one folder up" in why


def test_an_older_exports_model_is_refused_outside_the_project(tmp_path):
    """Refused before the model is loaded (no weights here: had it been
    loaded, the run would have failed differently)."""
    proj = _local_only_project(tmp_path)
    _forge_export_v1(proj / "export", V1_RECORD)
    (proj / "in.txt").write_text("an old house\n", encoding="utf-8")
    r = _mteval(proj, "translate", "--method", "local-model", "-m", "export/model",
                "--source-code", "eng", "--target-code", "sme", "--source-file", "in.txt",
                "-o", "out", "--out", str(tmp_path / "elsewhere" / "t.jsonl"))
    assert r.returncode == 1, r.stdout + r.stderr
    assert ("what this method writes is local-only (a model trained here whose training "
            "terms were never recorded — its record is the export's forge-model.json, "
            "one folder up)") in r.stderr
    assert "--holders-agreed-by" in r.stderr
    assert not (tmp_path / "elsewhere").exists()


def test_a_local_only_models_translations_carry_its_terms(tmp_path, monkeypatch):
    """What `translate` writes from a model folder: marked local-only (and
    "no model may train on this" when the model's record carries it), the
    agreement recorded when it is written outside the project. The run is
    stood in for (no weights here); everything after it is translate's own."""
    import mt_eval_harness.runner as runner_mod
    from mt_eval_harness.cli import _cmd_translate, build_parser

    proj = _local_only_project(tmp_path)
    model = _forge_model(proj / "models" / "m", {"trained_on": {"terms": {
        "transmission": "local-only", "terms": {"training": "not-allowed"}}}})

    async def fake_run(config):
        return {"run_id": "run_fake", "config": {
                    "engine_model": {"kind": "directory", "id": "m", "path": str(model)}},
                "results": [{"id": "1", "source": "an old house", "predicted": "vuoras viessu"}]}

    monkeypatch.setattr(runner_mod, "execute_run", fake_run)
    monkeypatch.chdir(proj)
    argv = ["translate", "--corpus", "data/input.json", "--method", "local-model",
            "-m", "models/m", "-o", "out"]
    assert _cmd_translate(build_parser().parse_args(argv + ["--out", "t.jsonl"])) == 0
    side = json.loads((proj / "t.jsonl.champollion.json").read_text())
    assert (side["$schema"], side["transmission"], side["terms"]) == (
        SET1, "local-only", {"training": "not-allowed"})
    assert side["written_by"] == "mt-eval translate"
    # outside the project without the holders' agreement: nothing written
    assert _cmd_translate(build_parser().parse_args(
        argv + ["--out", str(tmp_path / "far" / "t.jsonl")])) == 1
    assert not (tmp_path / "far").exists()
    assert _cmd_translate(build_parser().parse_args(
        argv + ["--out", str(tmp_path / "far" / "t.jsonl"),
                "--holders-agreed-by", "the family"])) == 0
    side = json.loads((tmp_path / "far" / "t.jsonl.champollion.json").read_text())
    assert side["transmission"] == "local-only"
    assert side["holders_agreed"]["by"] == "the family"
