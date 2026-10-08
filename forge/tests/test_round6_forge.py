"""Round 6 synthetic personas (hospital: a local-only nurse-checked test set,
a full model and a strict twin-free model in one workspace; school: two runs,
two exports), 2026-10-04.

1. A saturated dev score (100.00 [100, 100]) is said loudly — run output,
   manifest, report, status, export, DEPLOY.md — with what it means and what
   to do.
2. Dev rows with a near-twin in training are reported by split and
   preflight (the test forecast's measure and threshold).
3. Status right after init points at the split, not at discover/init; every
   run is listed with its checkpoint, dev score and whether it was exported.
4. `nmt-forge report` on a run includes what its export measured on the
   test set.
5. An inflated export's DEPLOY.md names the twin-free model of the same test
   set (whichever was exported first) as the number to quote.
6. `nmt-forge prereg verdict` records a person's verdict (ledgered, who,
   when, note), shown as human everywhere, never as computed.
9. Once export/ holds an export, every printed export command names a fresh,
   run-named folder; export refuses a non-empty --out with that suggestion.

All text is invented tokens (quarantine-gate discipline).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from nmt_forge.advisor import next_action, preflight, render_status, snapshot
from nmt_forge.guards import ci_scoring, preregister
from nmt_forge.workspace import Workspace
from tests.conftest import write_jsonl
from tests.test_export_layout import hf_export  # noqa: F401  (fixture reuse)
from tests.test_private_text import _dummy_run, _run


# -- 1. dev saturation --------------------------------------------------------

def _scores(score, lo, hi, *, em=None):
    out = {"chrf++": {"score": score, "ci_lower": lo, "ci_upper": hi}}
    if em is not None:
        out["exact_match"] = {"score": em, "ci_lower": em, "ci_upper": em}
    return out


def test_a_perfect_dev_score_with_a_point_ci_is_saturated():
    sel = {"metric": "generation:chrf++", "per_checkpoint": [
        {"id": "c3", "chrf++": 100.0}, {"id": "c2", "chrf++": 100.0},
        {"id": "c1", "chrf++": 96.7}]}
    sat = ci_scoring.dev_saturation(_scores(100.0, 100.0, 100.0, em=1.0),
                                    n=100, selection=sel)
    assert sat["saturated"] is True
    assert set(sat["metrics"]) == {"chrf++", "exact_match"}
    assert sat["metrics"]["chrf++"]["degenerate_ci"] is True
    assert sat["tied_candidates"] == 2 and sat["candidates"] == 3
    assert "SATURATED: chrf++ 100.00 [100.00, 100.00] on n=100" in sat["message"]
    assert "2 of 3 candidates tied" in sat["message"]
    assert "does not mean the model is perfect" in sat["message"]
    assert "--near-dupe 0.6" in sat["advice"]
    assert "99%" in sat["bound"]


def test_all_candidates_tied_says_nothing_to_choose_between():
    sel = {"metric": "generation:chrf++", "per_checkpoint": [
        {"id": c, "chrf++": 99.5} for c in ("a", "b", "c")]}
    sat = ci_scoring.dev_saturation(_scores(99.5, 99.1, 99.9), selection=sel)
    assert "all 3 candidates scored the same" in sat["message"]


def test_a_high_but_discriminating_dev_score_is_not_saturated():
    # lower bound 98.6 < 99: a checkpoint could still be shown better
    assert ci_scoring.dev_saturation(_scores(99.4, 98.6, 99.9)) is None
    assert ci_scoring.dev_saturation(_scores(43.6, 41.2, 46.4)) is None
    # lanes without a fixed ceiling are never called saturated
    assert ci_scoring.dev_saturation(
        {"metricx": {"score": 0.0, "ci_lower": 0.0, "ci_upper": 0.0,
                     "direction": "lower"},
         "comet": {"score": 0.99, "ci_lower": 0.99, "ci_upper": 0.99}}) is None


def test_a_manifest_written_before_the_check_is_measured_on_read():
    m = {"dev_report": {"n": 8, "scores": _scores(100.0, 100.0, 100.0)},
         "stages": [{"selection": {"metric": "loss"}}]}
    assert ci_scoring.run_dev_saturation(m)["saturated"] is True
    assert ci_scoring.run_dev_saturation({**m, "dev_saturation": None}) is None


# -- 2. dev near-twins in split + preflight -----------------------------------

def _templated(n, start=0):
    return [{"source": f"the patient {i} has a fever today",
             "target": f"marbo{i} kelu vasti dorem"} for i in range(start,
                                                                   start + n)]


def test_dev_rows_twinned_in_training_are_counted():
    f = ci_scoring.dev_near_twin_forecast(_templated(4), _templated(20, 10),
                                          dev_target_field="target",
                                          target_field="target")
    assert f["checked"] and f["near_twin_rows"] == 4 and f["severe"]
    assert "4 of 4 dev rows" in f["message"]
    assert "--near-dupe 0.6" in f["advice"]
    clean = ci_scoring.dev_near_twin_forecast(
        [{"source": "a wholly different quib zent", "target": "xo yu pa ki"}],
        _templated(20), dev_target_field="target", target_field="target")
    assert clean["near_twin_rows"] == 0 and clean["advice"] is None


def test_split_reports_dev_near_twins_beside_the_exact_key_check(
        tmp_path, capsys):
    corpus = write_jsonl(tmp_path / "corpus.jsonl", _templated(40))
    code, out, err = _run(capsys, "--workspace", str(tmp_path / ".forge"),
                          "split", str(corpus), "--test", "0", "--dev", "8",
                          "--seed", "1", "--out", str(tmp_path / "split"),
                          "--register", "project")
    assert code == 0, err
    assert "0 shared canonical source/target keys" in out
    assert "⚠ dev: 8 of 8 dev rows (100%) have a near-twin" in out
    assert "--near-dupe 0.6" in out
    code, out, err = _run(capsys, "--workspace", str(tmp_path / ".forge"),
                          "split", str(corpus), "--test", "0", "--dev", "8",
                          "--seed", "1", "--out", str(tmp_path / "split2"),
                          "--json")
    payload = json.loads(out)
    assert payload["dev_near_twin"]["near_twin_rows"] == 8


def test_preflight_run_warns_about_dev_near_twins(tmp_path, capsys,
                                                  monkeypatch):
    monkeypatch.chdir(tmp_path)
    write_jsonl(tmp_path / "corpus.jsonl", _templated(40))
    code, _, err = _run(capsys, "split", "corpus.jsonl", "--test", "0",
                        "--dev", "8", "--seed", "1", "--out", "data/split",
                        "--register", "project")
    assert code == 0, err
    (tmp_path / "config.json").write_text(json.dumps({
        "run_name": "r", "workspace": ".forge",
        "data": {"gold": ["data/split/train.jsonl"], "dev": "project-dev"},
        "model": {"backend": "dummy"}}))
    gates = {g.name: g for g in preflight(Workspace(".forge"), "run",
                                          "config.json")}
    g = gates["dev-near-twins"]
    assert g.ok and g.warning, g.detail
    assert "8 of 8 dev rows" in g.detail and "--near-dupe" in g.fix


# -- 3. status after init; every run listed -----------------------------------

def test_status_right_after_init_points_at_the_split(tmp_path):
    from nmt_forge.scaffold import init_project

    init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    ws = Workspace(tmp_path / "proj" / ".forge")
    a = next_action(ws)
    assert a.state == "initialized"
    assert "nmt-forge split" in a.command and "--register project" in a.command
    assert "registry add project-test" in a.command      # own-test-set path
    assert "--test 0" in a.command
    assert "discover" not in a.command and "nmt-forge init" not in a.command
    steps = (tmp_path / "proj" / "NEXT_STEPS.md").read_text()
    assert "nmt-forge init qaa — scaffold" not in steps
    assert "this project is initialized" in steps


def _fake_run(ws, name, *, dev, mtime):
    import os

    d = ws.runs_dir / name
    d.mkdir()
    m = d / "run-manifest.json"
    m.write_text(json.dumps({
        "run_name": name, "config_hash": name, "selected_checkpoint": f"{name}-ck",
        "dev_set": {"name": "toy-dev"},
        "dev_report": {"n": 8, "scores": dev},
        "stages": [{"selection": {"metric": "generation:chrf++",
                                  "per_checkpoint": [{"id": "x", "chrf++":
                                                      dev["chrf++"]["score"]}]}}]}))
    os.utime(m, (mtime, mtime))
    return str(m)


def test_status_lists_every_run_with_dev_score_and_export(ws, tmp_path):
    t = write_jsonl(tmp_path / "t.jsonl", _templated(4, 100))
    ws.registry.register("toy-test", t, "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl",
                                                _templated(4, 200)), "dev")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set": "toy-test"}))
    # alphabetical order is NOT age: "b-old" was trained first
    old = _fake_run(ws, "b-old", dev=_scores(100.0, 100.0, 100.0), mtime=1000)
    _fake_run(ws, "a-new", dev=_scores(43.6, 41.2, 46.4), mtime=2000)
    ws.ledger.append("export", run="b-old", run_manifest=old,
                     dir=str(tmp_path / "export"),
                     model_dir=str(tmp_path / "export" / "model"),
                     evaluated=True, model_included=True)
    (tmp_path / "export" / "model").mkdir(parents=True)
    runs = snapshot(ws)["runs"]
    assert [r["run"] for r in runs] == ["b-old", "a-new"]
    assert runs[0]["exported"] and not runs[1]["exported"]
    assert runs[0]["dev_saturated"] and not runs[1]["dev_saturated"]
    a = next_action(ws)
    assert a.state == "ready-to-score" and "a-new" in a.command
    assert [r["run"] for r in a.to_json()["runs"]] == ["b-old", "a-new"]
    assert any("SATURATED" in w and "b-old" in w for w in a.warnings)
    text = render_status(ws)
    assert "run b-old: checkpoint b-old-ck · dev chrF++ 100.00" in text
    assert "⚠ SATURATED · exported →" in text
    assert "run a-new: checkpoint a-new-ck · dev chrF++ 43.60" in text
    assert "not exported" in text


# -- 9. a fresh, run-named export folder --------------------------------------

def test_suggest_export_dir(ws, tmp_path):
    from nmt_forge.export import suggest_export_dir

    assert suggest_export_dir("r1", workspace=ws, base=tmp_path) == "export/"
    (tmp_path / "export").mkdir()
    # an empty folder is still free
    assert suggest_export_dir("r1", workspace=ws, base=tmp_path) == "export/"
    (tmp_path / "export" / "README.md").write_text("x")
    assert suggest_export_dir("Run B", workspace=ws,
                              base=tmp_path) == "export-run-b/"
    ws.ledger.append("export", dir=str(tmp_path / "export-run-b"))
    assert suggest_export_dir("Run B", workspace=ws,
                              base=tmp_path) == "export-run-b-2/"


def test_ready_to_score_names_a_fresh_folder_once_export_is_taken(
        ws, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl",
                                                 _templated(4, 100)), "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl",
                                                _templated(4, 200)), "dev")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set": "toy-test"}))
    _fake_run(ws, "twin-free", dev=_scores(43.6, 41.2, 46.4), mtime=1000)
    assert "--out export/" in next_action(ws).command
    (tmp_path / "export").mkdir()
    (tmp_path / "export" / "README.md").write_text("model A")
    cmd = next_action(ws).command
    assert "--out export-twin-free/" in cmd and "--out export/" not in cmd


def test_run_and_export_refusal_name_the_fresh_folder(hf_export, capsys):  # noqa: F811
    ws_dir, manifest = hf_export["ws_dir"], hf_export["manifest"]
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--config", str(hf_export["cfg"]), "--out",
                          str(hf_export["out"]))
    assert code == 2
    assert "holds the export of run 'private-run'" in err
    assert "--out export-private-run/" in err
    assert "--force to REPLACE" in err


# -- 4/6. report with the export; human verdicts ------------------------------

def test_report_includes_the_exports_test_result(hf_export, capsys):  # noqa: F811
    code, out, err = _run(capsys, "--workspace", hf_export["ws_dir"],
                          "report", hf_export["manifest"])
    assert code == 0, err
    assert "## Test results (from `nmt-forge export`)" in out
    assert str(hf_export["out"]) in out
    # scoring standard/1: the headline is chrF++ with its 95% CI
    assert "- **headline: chrF++ " in out and "95% bootstrap CI" in out
    assert "preregistration `p1`" in out
    assert "for a human to judge (`nmt-forge prereg verdict`)" in out


def test_a_human_verdict_is_ledgered_and_shown_as_human(hf_export, capsys):  # noqa: F811
    ws_dir = hf_export["ws_dir"]
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "verdict",
                          "p1", "--prediction", "1", "--missed", "--by",
                          "Teacher A", "--note", "expected low, it was not",
                          "--json")
    assert code == 0, err
    rec = json.loads(out)
    assert rec["verdict"] == "missed" and rec["by"] == "Teacher A"
    assert rec["by_source"] == "--by" and rec["ledger_entry"]
    ws = Workspace(ws_dir)
    ev = ws.ledger.find("prereg-verdict", prereg_id="p1")
    assert len(ev) == 1 and ev[0]["note"] == "expected low, it was not"
    ws.ledger.verify_chain()
    # check: the computed verdict stays MANUAL; the human one is labelled
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "check",
                          "p1")
    assert code == 0, err
    assert "→ MISSED — human verdict by Teacher A" in out
    assert "1 judged by a human (recorded verdicts, not computed)" in out
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "check",
                          "p1", "--json")
    row = json.loads(out)[0]
    assert row["verdict"] == "manual"
    assert row["human_verdict"]["verdict"] == "missed"
    # DEPLOY.md was rewritten: the person's verdict, as a person's
    deploy = (hf_export["out"] / "model" / "DEPLOY.md").read_text()
    assert "**MISSED** — a human verdict by Teacher A" in deploy
    assert "not computed by forge" in deploy
    assert deploy.count("Judged against preregistration `p1`") == 1
    # the report says it too
    code, out, err = _run(capsys, "--workspace", ws_dir, "report",
                          hf_export["manifest"])
    assert "MISSED — human verdict by Teacher A" in out
    assert "(recorded, not computed)" in out
    # a second verdict needs --revise; both stay in the ledger
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "verdict",
                          "p1", "--prediction", "1", "--held", "--by", "B")
    assert code == 2 and "--revise" in err
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "verdict",
                          "p1", "--prediction", "1", "--held", "--by", "B",
                          "--revise")
    assert code == 0, err
    assert len(ws.ledger.find("prereg-verdict", prereg_id="p1")) == 2
    assert preregister.human_verdicts(ws, "p1")[0]["verdict"] == "held"


def test_a_verdict_is_refused_for_computed_predictions_and_before_results(
        tmp_path, capsys):
    ws_dir, _ = _dummy_run(tmp_path, capsys)
    ws = Workspace(ws_dir)
    preregister.new(ws, prereg_id="p2", eval_set="project-test",
                    allow_after_reads=True, predictions=[
                        {"metric": "chrf++", "direction": "increase",
                         "baseline_score": 1.0, "rationale": "r"},
                        {"metric": "chrf++", "expect": "about 5",
                         "rationale": "r"}])
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "verdict",
                          "p2", "--prediction", "1", "--held", "--by", "T")
    assert code == 2 and "forge verdicts it from the scores" in err
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "verdict",
                          "p2", "--prediction", "2", "--held", "--by", "T")
    assert code == 2 and "no result has been judged against prereg" in err
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "verdict",
                          "p2", "--prediction", "9", "--held", "--by", "T")
    assert code == 2 and "there is no #9" in err
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "verdict",
                          "p2", "--prediction", "2")
    assert code == 2 and ("--held" in err or "--held" in out)


# -- 5. the twin-free sibling in DEPLOY.md ------------------------------------

LEGACY_DEPLOY = """# Deploying `full`

## What was measured — read this first

Test set `toy-test` (n=10): chrf++ 100.00 [100.00, 100.00] 95% CI.

**All 10 test rows have a near-identical twin in the training data.**

For a test score that measures translation: go train a twin-free model.

Choosing between the two models: never quote the inflated score alone.

Judged against preregistration `p1` (x): 1 held, 0 failed, 1 for a human to judge — `nmt-forge prereg check p1`.

## 1. Serve it
"""


def _fm_export(tmp_path, name, *, score, twinned, deploy=None):
    d = tmp_path / name
    (d / "model").mkdir(parents=True)
    nt = {"checked": True, "n": 10, "near_twin_rows": twinned,
          "recall_not_translation": twinned >= 5,
          "message": f"{twinned} of 10 test rows have a near-twin"}
    (d / "model" / "forge-model.json").write_text(json.dumps({
        "format": "nmt-forge-model/2", "name": f"nmt-forge-{name}",
        "model_dir": ".", "run": {"name": name},
        "test_report": {"set": "toy-test", "n": 10, "near_twin": nt,
                        "groups": {"all": {"chrf++": {
                            "score": score, "ci_lower": score - 2,
                            "ci_upper": score + 2}}}}}))
    if deploy:
        (d / "model" / "DEPLOY.md").write_text(deploy)
    return d


def test_a_twin_free_export_is_cited_in_the_earlier_inflated_deploy_md(
        ws, tmp_path):
    from nmt_forge.export import cite_in_inflated_siblings, twin_free_siblings

    full = _fm_export(tmp_path, "full", score=100.0, twinned=10,
                      deploy=LEGACY_DEPLOY)
    ws.ledger.append("export", run="full", dir=str(full))
    free = _fm_export(tmp_path, "strict", score=40.9, twinned=0)
    ws.ledger.append("export", run="strict", dir=str(free))
    sibs = twin_free_siblings(ws, "toy-test", exclude_dir=full)
    assert [s["run"] for s in sibs] == ["strict"]
    assert sibs[0]["score"]["score"] == 40.9
    updated = cite_in_inflated_siblings(ws, {"export_dir": str(free),
                                             "test_set": "toy-test"})
    assert updated == [str(full / "model" / "DEPLOY.md")]
    text = (full / "model" / "DEPLOY.md").read_text()
    assert "**The number to quote for new sentences:**" in text
    assert "`nmt-forge-strict` (run `strict`" in text
    assert "chrF++ 40.9 [38.9, 42.9]" in text
    # the "go train one" advice and the generic decision note gave way
    assert "go train a twin-free model" not in text
    assert "Choosing between the two models" not in text
    assert text.count("<!-- nmt-forge:twin-free -->") == 1
    assert ws.ledger.find("deploy-note", kind="twin-free-sibling")
    # idempotent: a second pass replaces the block, never duplicates it
    cite_in_inflated_siblings(ws, {"export_dir": str(free),
                                   "test_set": "toy-test"})
    assert (full / "model" / "DEPLOY.md").read_text().count(
        "The number to quote") == 1
    # status pairs them too
    exp = {x["run"]: x for x in snapshot(ws)["exports"]}
    assert exp["full"]["twin_free_siblings"][0]["run"] == "strict"


def test_deploy_headline_cites_an_existing_twin_free_sibling_and_saturation():
    from nmt_forge.export import _headline

    tr = {"eval_set": "toy-test", "n": 10,
          "groups": {"all": {"scores": {"chrf++": {
              "score": 100.0, "ci_lower": 100.0, "ci_upper": 100.0}}}}}
    nt = {"message": "all 10 test rows have a near-identical twin",
          "recall_not_translation": True, "advice": "go train one",
          "strict": None}
    sib = [{"name": "nmt-forge-strict", "run": "strict", "export_dir": "e",
            "model_dir": "e/model",
            "score": {"metric": "chrf++", "score": 40.9, "ci": [38.8, 43.0]}}]
    sat = ci_scoring.dev_saturation(_scores(100.0, 100.0, 100.0), n=8)
    text = _headline(tr, nt, None, "out", "toy-dev", None, None,
                     siblings=sib, dev_saturation=sat)
    assert "The number to quote for new sentences" in text
    assert "go train one" not in text
    assert "**Dev set saturated:**" in text and "--near-dupe 0.6" in text
    plain = _headline(tr, nt, None, "out", "toy-dev", None, None)
    assert "Go train one" in plain and "Never quote the inflated" in plain


def test_the_run_exit_line_names_a_fresh_folder_after_a_first_export(
        tmp_path, capsys):
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--out", str(tmp_path / "export"), "--no-model")
    assert code == 0, err
    cfg = str(tmp_path / "config.json")
    code, out, err = _run(capsys, "--workspace", ws_dir, "run", cfg)
    assert code == 0, err
    assert "NEXT: nmt-forge export" in out and "--out export-private-run/" in out
    exit_line = [ln for ln in out.splitlines() if ln.startswith("RUN EXIT")][-1]
    assert "--out export-private-run/" in exit_line
    code, out, err = _run(capsys, "--workspace", ws_dir, "run", cfg, "--json")
    payload = json.loads(out)
    assert payload["export_out"] == "export-private-run/"
    assert payload["next"].endswith("--out export-private-run/")
    assert "dev_saturation" in payload
