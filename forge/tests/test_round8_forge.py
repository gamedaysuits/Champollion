"""Round 8 synthetic personas (school: eng→crk, an all-data and a twin-free
model on one teacher-checked test set; hospital: a private-use code, qaa, and
a nurse-checked test set benchmarked before forge registered it), 2026-10-04.

1. Two preregistrations on one test set: status said "export needs --prereg"
   while its next_command (and the run's NEXT line) left the flag out — a
   mechanical follower hit the refusal. The command now carries the flag:
   the one candidate not already judged against another run, or the
   user's choice between the candidates.
2. The default run name was `<code>-baseline`, read as the guide's baseline
   (the existing model measured first). init now names the trained model
   for what it is: `<code>-nmt-<preset>`.
3. Once a twin-free model of the test set is exported, the all-data export's
   near-twin advice (summary, forge-model.json — whichever was exported
   first) cites it instead of "drop the twins and retrain".
4. `discover qaa` suggested a Glottolog "near code". A private-use code
   (qaa–qtz) is said plainly: no card, no facts, no FST, no prior results,
   how to train anyway, how to move to the real code later.
5. A benchmark run made before `registry add` is not in the file's read log
   (by design) — registration now says register-first, lists the earlier
   runs it finds in mt-eval's RunLogs as reads before registration (not
   counted), and status, prereg and DEPLOY.md say so too.

All text is invented tokens (quarantine-gate discipline).
"""

from __future__ import annotations

import hashlib
import json

import pytest

from nmt_forge.advisor import next_action, render_status, snapshot
from nmt_forge.errors import ResourceMissing
from nmt_forge.guards import preregister
from nmt_forge.workspace import Workspace
from tests.conftest import write_jsonl
from tests.test_private_text import TEST_ROWS, _dummy_run, _run
from tests.test_round7_forge import _harness_read, _second_run, _test_file

PRED = [{"metric": "chrf++", "expect": "low", "rationale": "dummy decode"}]


# -- 1. the --prereg export needs is in the command ---------------------------

def test_status_next_command_carries_the_prereg_export_needs(tmp_path, capsys):
    ws_dir, first = _dummy_run(tmp_path, capsys)          # prereg p1
    code, out, err = _second_run(tmp_path, capsys, ws_dir, "twin-free",
                                 "--json")
    assert code == 0, err
    second = json.loads(out)["manifest"]
    ws = Workspace(ws_dir)
    preregister.new(ws, prereg_id="p2", eval_set="project-test",
                    predictions=PRED)
    # neither run judged yet: the choice is the user's, and the command says
    # so instead of leaving the flag out
    a = next_action(ws)
    assert a.state == "ready-to-score"
    assert f"nmt-forge export {second} --prereg <p1|p2> --out" in a.command
    assert "export refuses without --prereg" in a.why
    assert "the user's answer" in a.why
    # the other unexported run's command carries it too
    assert f"nmt-forge export {first} --prereg <p1|p2> --out" in a.why
    code, out, err = _run(capsys, "--workspace", ws_dir, "status", "--json")
    assert code == 0, err
    assert "--prereg <p1|p2>" in json.loads(out)["advice"]["next_command"]

    # the first run is judged against p1: p2 is the only candidate left for
    # the second, so the command names it — and it runs as printed
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", first,
                          "--out", str(tmp_path / "exp-first"), "--no-model",
                          "--prereg", "p1")
    assert code == 0, err
    a = next_action(ws)
    assert f"nmt-forge export {second} --prereg p2 --out" in a.command
    assert "p2 is the only one not already judged against another run" in a.why
    assert "p1 → run private-run" in a.why
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", second,
                          "--prereg", "p2", "--out",
                          str(tmp_path / "exp-second"), "--no-model")
    assert code == 0, err


def test_one_prereg_needs_no_flag(tmp_path, capsys):
    ws_dir, first = _dummy_run(tmp_path, capsys)          # p1 only
    a = next_action(Workspace(ws_dir))
    assert a.state == "ready-to-score"
    assert "--prereg" not in a.command


def test_the_runs_next_line_carries_the_prereg_choice(tmp_path, capsys):
    ws_dir, first = _dummy_run(tmp_path, capsys)
    preregister.new(Workspace(ws_dir), prereg_id="p2",
                    eval_set="project-test", predictions=PRED)
    code, out, err = _second_run(tmp_path, capsys, ws_dir, "twin-free",
                                 "--json")
    assert code == 0, err
    payload = json.loads(out)
    assert "--prereg <p1|p2> --out export-twin-free/" in payload["next"]
    assert "export refuses without --prereg" in payload["prereg_note"]
    exit_line = [ln for ln in err.splitlines()
                 if ln.startswith("RUN EXIT")][-1]
    assert "--prereg <p1|p2>" in exit_line
    code, out, err = _second_run(tmp_path, capsys, ws_dir, "twin-free")
    assert "NEXT: nmt-forge export" in out and "--prereg <p1|p2>" in out


# -- 2. the trained model is not called "baseline" ----------------------------

def test_init_names_the_trained_model_for_what_it_is(tmp_path):
    from nmt_forge.cards import no_card_report
    from nmt_forge.scaffold import init_project, starter_config

    init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    cfg = json.loads((tmp_path / "proj" / "config.json").read_text())
    assert cfg["run_name"] == "qaa-nmt-cpu-tiny"
    assert "baseline" not in cfg["run_name"]
    assert starter_config(no_card_report("qab"), model_preset="nllb-600m"
                          )["run_name"] == "qab-nmt-nllb-600m"


def test_an_existing_projects_run_name_is_left_alone(tmp_path, capsys):
    """Status, run and export read run_name from the user's config — a
    project initialized with the old default keeps its name."""
    from nmt_forge.scaffold import init_project

    init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    path = tmp_path / "proj" / "config.json"
    cfg = json.loads(path.read_text())
    cfg["run_name"] = "qaa-baseline"
    path.write_text(json.dumps(cfg))
    from nmt_forge.training.config import RunConfig

    assert RunConfig.from_file(path).run_name == "qaa-baseline"


# -- 3. a twin-free sibling replaces the "retrain" advice ---------------------

def _all_data_run(tmp_path, capsys, ws_dir):
    """A second run whose training data has a near-twin (source side) of
    every test row: its test score is recall, not translation."""
    cfg = json.loads((tmp_path / "config.json").read_text())
    gold = write_jsonl(tmp_path / "gold-all.jsonl", [
        {"source": s + " today", "target": f"gorp{i} hum"}
        for i, (s, _t) in enumerate(TEST_ROWS)]
        + [{"source": f"the florp {i} sings", "target": f"florpa{i} zam"}
           for i in range(6)])
    cfg.update(run_name="all-data")
    cfg["data"]["gold"] = [str(gold)]
    cfg["eval"]["near_dupe_corpus"] = str(gold)
    path = tmp_path / "config-all.json"
    path.write_text(json.dumps(cfg))
    code, out, err = _run(capsys, "--workspace", ws_dir, "run", str(path),
                          "--json")
    assert code == 0, err
    return json.loads(out)["manifest"]


def test_the_all_data_export_cites_the_twin_free_model_exported_first(
        tmp_path, capsys):
    ws_dir, free_run = _dummy_run(tmp_path, capsys)      # twin-free
    all_run = _all_data_run(tmp_path, capsys, ws_dir)
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", free_run,
                          "--out", str(tmp_path / "exp-free"), "--no-model",
                          "--json")
    assert code == 0, err
    assert json.loads(out)["near_twin"]["near_twin_rows"] == 0
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", all_run,
                          "--out", str(tmp_path / "exp-all"), "--no-model",
                          "--prereg", "p1", "--json")
    assert code == 0, err
    nt = json.loads(out)["near_twin"]
    assert nt["recall_not_translation"]
    assert "retrain" not in nt["advice"]
    assert "drop" not in nt["advice"]
    assert nt["advice"].startswith("a twin-free model of this test set is "
                                   "already exported in this workspace")
    assert "nmt-forge-private-run (run private-run" in nt["advice"]
    assert nt["twin_free_cited"] == [str((tmp_path / "exp-free").resolve())]
    fm = json.loads((tmp_path / "exp-all" / "evaluation" /
                     "forge-model.json").read_text())
    assert fm["test_report"]["near_twin"]["advice"] == nt["advice"]
    # status pairs them and never advises a retrain
    ws = Workspace(ws_dir)
    exp = {x["run"]: x for x in snapshot(ws)["exports"]}
    assert exp["all-data"]["twin_free_siblings"][0]["run"] == "private-run"
    text = render_status(ws) + json.dumps(next_action(ws).to_json())
    assert "retrain" not in text


def _fm_export(tmp_path, name, *, score, twinned, deploy: bool):
    d = tmp_path / name
    sub = d / ("model" if deploy else "evaluation")
    sub.mkdir(parents=True)
    nt = {"checked": True, "n": 10, "near_twin_rows": twinned,
          "recall_not_translation": twinned >= 5,
          "message": f"{twinned} of 10 test rows have a near-twin",
          "advice": ("for a test score that measures translation: … drop "
                     "the training rows that are near-twins of it … and "
                     "retrain on the cleaned file") if twinned else None}
    (sub / "forge-model.json").write_text(json.dumps({
        "format": "nmt-forge-model/2", "name": f"nmt-forge-{name}",
        "model_dir": "." if deploy else None, "run": {"name": name},
        "test_report": {"set": "toy-test", "n": 10, "near_twin": nt,
                        "groups": {"all": {"chrf++": {
                            "score": score, "ci_lower": score - 2,
                            "ci_upper": score + 2}}}}}))
    if deploy:
        (sub / "DEPLOY.md").write_text(
            "# x\n\n## What was measured — read this first\n\nTest set.\n\n"
            "<!-- nmt-forge:twin-free -->\nretrain advice\n"
            "<!-- /nmt-forge:twin-free -->\n\n## 1. Serve it\n")
    return d


@pytest.mark.parametrize("deploy", [True, False])
def test_a_later_twin_free_export_rewrites_the_inflated_forge_model(
        ws, tmp_path, deploy):
    from nmt_forge.export import cite_in_inflated_siblings, find_forge_model

    full = _fm_export(tmp_path, "full", score=100.0, twinned=10,
                      deploy=deploy)
    ws.ledger.append("export", run="full", dir=str(full))
    free = _fm_export(tmp_path, "strict", score=40.9, twinned=0,
                      deploy=True)
    ws.ledger.append("export", run="strict", dir=str(free))
    updated = cite_in_inflated_siblings(ws, {"export_dir": str(free),
                                             "test_set": "toy-test"})
    fm_path = find_forge_model(full)
    assert updated == [str(full / "model" / "DEPLOY.md") if deploy
                       else str(fm_path)]
    nt = json.loads(fm_path.read_text())["test_report"]["near_twin"]
    assert "retrain" not in nt["advice"]
    assert "nmt-forge-strict (run strict" in nt["advice"]
    assert "chrF++ 40.9 [38.9, 42.9]" in nt["advice"]
    assert nt["twin_free_cited"] == [str(free.resolve())]
    assert nt["message"] == "10 of 10 test rows have a near-twin"  # kept
    note = ws.ledger.find("deploy-note", kind="twin-free-sibling")[-1]
    assert str(fm_path) in note["files"]
    # idempotent: nothing left to rewrite
    assert cite_in_inflated_siblings(ws, {"export_dir": str(free),
                                          "test_set": "toy-test"}) == []


# -- 4. a private-use code is said plainly -------------------------------------

def test_is_private_use():
    from nmt_forge.cards import is_private_use

    assert all(is_private_use(c) for c in ("qaa", "qtz", "QAB", " qmx "))
    assert not any(is_private_use(c) for c in
                   ("qua", "qza", "crk", "qa", "qaaa", "q1a", "", None))


def test_discover_a_private_use_code_names_no_near_code(tmp_path, capsys,
                                                         monkeypatch):
    from nmt_forge import _harness
    from nmt_forge.cards import discover

    monkeypatch.delenv("CHAMPOLLION_CARDS_DIR", raising=False)
    monkeypatch.delenv("MT_EVAL_CARDS_DIR", raising=False)
    lc = _harness.language_cards_mod()
    monkeypatch.setattr(lc, "get_card", lambda code: None)
    monkeypatch.setattr(lc, "get_cards_dir", lambda: None)

    def listing():
        raise AssertionError("no whole-index listing for a private-use code")

    monkeypatch.setattr(lc, "get_all_codes", listing)
    with pytest.raises(ResourceMissing) as e:
        discover("qaa", check_registry=False)
    msg = str(e.value)
    assert "'qaa' is an ISO 639-3 private-use code (qaa–qtz" in msg
    assert "Near codes" not in msg and "qahv" not in msg
    assert "no card facts" in msg and "no FST" in msg
    assert "no prior results" in msg
    assert "nmt-forge init qaa --no-card --name" in msg
    assert "nmt-forge discover <code>" in msg and "nmt-forge init <code>" in msg
    # the CLI (and so the MCP tool) says the same
    code, out, err = _run(capsys, "discover", "qaa")
    assert code != 0
    assert "private-use code" in err and "Near codes" not in err


def test_a_card_a_user_supplies_for_a_private_use_code_is_still_read(
        tmp_path):
    from nmt_forge.cards import discover

    d = tmp_path / "cards"
    d.mkdir()
    (d / "qaa.json").write_text(json.dumps({"name": "Toylang A"}))
    assert discover("qaa", cards_path=d, check_registry=False
                    ).name == "Toylang A"


def test_init_no_card_with_a_private_use_code_says_how_to_switch(tmp_path):
    from nmt_forge.scaffold import init_project

    init_project("qaa", tmp_path / "p", no_card=True, name="Toylang")
    steps = (tmp_path / "p" / "NEXT_STEPS.md").read_text()
    assert "## A private-use code" in steps
    assert "ISO 639-3 private-use code" in steps
    assert "card: none — ISO 639-3 private-use code (qaa–qtz)" in steps
    init_project("zxb", tmp_path / "z", no_card=True, name="Toylang Z")
    assert "## A private-use code" not in (
        tmp_path / "z" / "NEXT_STEPS.md").read_text()


# -- 5. reads before registration ----------------------------------------------

def _harness_runlog(directory, sha, run_id, ts):
    """A RunLog written by mt-eval's own builder and writer (the contract:
    provenance.corpus_sha256, run_id, timestamp_start)."""
    from nmt_forge import _harness

    _harness.load_harness()
    from mt_eval_harness.config import RunConfig
    from mt_eval_harness.pipeline import build_run_log, write_run_log

    log = build_run_log(config=RunConfig(model="stub-1"),
                        enriched_results=[], run_id=run_id,
                        timestamp_start=ts, elapsed_s=0.1, cache_hits=0,
                        total_cost=0.0, corpus_sha256=sha)
    return write_run_log(log, str(directory))


def test_registration_lists_runs_made_before_it_and_counts_none(
        tmp_path, capsys, monkeypatch):
    monkeypatch.chdir(tmp_path)
    proj = tmp_path / "work" / "forge-proj"
    proj.mkdir(parents=True)
    data = tmp_path / "work" / "data"
    t = _test_file(data)
    sha = hashlib.sha256(t.read_bytes()).hexdigest()
    # the MCP run_benchmark layout (results/ beside the corpus) and the
    # `mt-eval run` default (eval/logs/harness where it ran: work/)
    _harness_runlog(data / "results" / "mcp-run-1", sha, "run_baseline_a",
                    "2026-10-04T07:33:25+00:00")
    _harness_runlog(tmp_path / "work" / "eval" / "logs" / "harness", sha,
                    "run_baseline_b", "2026-10-04T07:20:00+00:00")
    _harness_runlog(data / "results" / "mcp-run-2", "0" * 64, "run_other",
                    "2026-10-04T07:00:00+00:00")         # other content
    ws_dir = str(proj / ".forge")
    code, out, err = _run(capsys, "--workspace", ws_dir, "registry", "add",
                          "project-test", str(t), "--role", "test")
    assert code == 0, err
    assert "BEFORE any benchmark run" in out
    assert ("reads before registration (not counted): 2 mt-eval run(s) "
            "scored this exact file before forge registered it") in out
    assert out.index("run_baseline_b") < out.index("run_baseline_a")
    assert "run_other" not in out
    ws = Workspace(ws_dir)
    entry = ws.registry.get("project-test")
    assert [r["run_id"] for r in entry["reads_before_registration"]["runs"]
            ] == ["run_baseline_b", "run_baseline_a"]
    ev = ws.ledger.find("reads-before-registration", set="project-test")
    assert ev and ev[0]["runs"] == ["run_baseline_b", "run_baseline_a"]
    assert ev[0]["counted"] is False
    # never counted: reads stays 0, so the first prereg is accepted (by
    # design) — and says what came before
    hr = ws.registry.harness_reads("project-test")
    assert hr["reads"] == 0 and len(hr["before_registration"]) == 2
    pred = tmp_path / "pred.json"
    pred.write_text(json.dumps(PRED))
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "new",
                          "p1", "--eval-set", "project-test",
                          "--predictions", str(pred))
    assert code == 0, err
    assert "note: reads before registration (not counted): 2" in out
    assert ws.ledger.find("prereg", prereg_id="p1")[0][
        "reads_before_registration"] == 2
    assert ("reads before registration (not counted): 2 mt-eval run(s)"
            in render_status(ws))
    # a run AFTER registration is in the read log, counted — and blocks a
    # second blind prereg, as before
    _harness_read(t, sha, run_id="run_coached")
    assert ws.registry.harness_reads("project-test")["reads"] == 1
    with pytest.raises(Exception, match="--allow-after-reads"):
        preregister.new(ws, prereg_id="p2", eval_set="project-test",
                        predictions=PRED)


def test_registration_with_no_earlier_run_says_register_first(
        tmp_path, capsys, monkeypatch):
    monkeypatch.chdir(tmp_path)
    t = _test_file(tmp_path)
    ws_dir = str(tmp_path / ".forge")
    code, out, err = _run(capsys, "--workspace", ws_dir, "registry", "add",
                          "t", str(t), "--role", "test", "--json")
    assert code == 0, err
    before = json.loads(out)["t"]["reads_before_registration"]
    assert before["runs"] == [] and not before["capped"]
    code, out, err = _run(capsys, "--workspace", ws_dir, "registry", "add",
                          "d", str(_test_file(tmp_path, "d.jsonl")),
                          "--role", "dev")
    assert "read log" not in out                      # dev: read freely
    t2 = _test_file(tmp_path, "t2.jsonl", n=7)
    code, out, err = _run(capsys, "--workspace", ws_dir, "registry", "add",
                          "t2", str(t2), "--role", "test")
    assert "Register a test set with forge BEFORE any benchmark run" in out
    assert "no earlier mt-eval run of this file found" in out
    assert "another --output-dir cannot be seen" in out


def test_deploy_headline_counts_runs_before_registration():
    from nmt_forge.export import _headline

    hr = {"reads": 0, "by_purpose": {},
          "before_registration": [{"run_id": "run_baseline_a",
                                   "ts": "2026-10-04T07:33:25+00:00"}]}
    text = _headline({"eval_set": "t", "n": 4, "groups": {}}, None, None,
                     "out", "d", None, None, harness_reads=hr)
    assert "**Not a first look:**" in text
    assert "1× before forge registered the file" in text
    assert "run_baseline_a" in text and "not counted" in text


def test_next_steps_says_register_the_test_set_first(tmp_path):
    from nmt_forge.scaffold import init_project

    init_project("qaa", tmp_path / "p", no_card=True, name="Toylang")
    steps = (tmp_path / "p" / "NEXT_STEPS.md").read_text()
    assert "**Register the test set with forge BEFORE any benchmark run on" \
        in steps
    assert "reads before" in steps and "registration (not counted)" in steps
    a = next_action(Workspace(tmp_path / "p" / ".forge"))
    assert "before any benchmark run on it, so every read is counted" in a.why
