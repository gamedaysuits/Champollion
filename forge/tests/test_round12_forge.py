"""Round 12 synthetic personas (hospital: an Ayta phrasebook under the
private-use code qaa with a nurse-checked test set; school: a Cree
phrasebook with a teacher-reviewed test set), 2026-10-04.

8.  The twin-free corpus (``leak-audit --drop-test-twins``) was written
    BEFORE the dev split and still held rows the split then put in dev;
    ``nmt-forge run`` trained on them without a word (the leak audit counts
    dev hits as non-fatal), and neither ``status`` nor ``preflight`` said
    so. ``DevFence.require_disjoint_training`` now refuses training rows that
    ARE dev rows — in ``run`` and in ``preflight run``'s dev-fence gate, the
    same function on the same files — with the exact fix (re-run the
    twin-free audit), and ``status`` names the re-audit from the ledger's
    order (the twin-free audit predates the dev set's registration).
9/15. The all-data export's near-twin advice said "retrain and preregister
    with --allow-after-reads" while the twin-free model was planned and
    preregistered before any read (and trained, in one project). The export
    now names that model and its actual next step.
10. ``status`` stayed at "serve <chosen>/model" while that model was being
    served. ``serve`` records its address and pid (and its clean stop);
    status probes ``/health`` and says ``serving`` — or, when the server is
    gone, the serve command again on the same port.
13. ``registry add`` of a path that is not there was a bare
    FileNotFoundError (why/fix null). It now names the resolved path, why
    relative paths resolve from forge's working directory, and the fix.
14. ``nmt-forge run`` printed ``--prereg <all-data|notwins>`` for both runs;
    the NEXT line now names the preregistration named after each run.

All text is invented tokens (quarantine-gate discipline); every corpus is
generated here.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

from nmt_forge.cli import main
from nmt_forge.errors import DevFenceError
from nmt_forge.guards import preregister
from nmt_forge.workspace import Workspace
from tests.conftest import write_jsonl
from tests.test_export_layout import hf_export  # noqa: F401  (fixture)

FRAMES, FILLERS = 6, 8


def _corpus() -> list[dict]:
    """Templated phrasebook rows (twins of the test set's frames) and
    distinct sentences (no twin) — the twin-free corpus keeps only the
    latter, and a dev carve of the whole corpus takes some of them."""
    rows = [{"source": f"please take dose{w} of med{f} now",
             "target": f"kalo dos{w} medo{f} tama"}
            for f in range(FRAMES) for w in range(FILLERS)]
    rows += [{"source": f"qa{i} qb{i} qc{i} qd{i} qe{i}",
              "target": f"za{i} zb{i} zc{i} zd{i}"} for i in range(60)]
    return rows


def _test_rows() -> list[dict]:
    return ([{"source": f"please take dosenew of med{f} now",
              "reference": f"kalo dosnew medo{f} tama"} for f in range(FRAMES)]
            + [{"source": f"unseen{i} words here{i}",
                "reference": f"unz{i} wor{i}"} for i in range(4)])


def _run(capsys, *argv):
    code = main(list(argv))
    out = capsys.readouterr()
    return code, out.out, out.err


def _prereg(ws: Workspace, pid: str) -> None:
    preregister.new(ws, prereg_id=pid, eval_set="project-test",
                    predictions=[{"metric": "chrf++", "expect": "low",
                                  "rationale": "a toy model"}])


@pytest.fixture
def hospital(tmp_path, monkeypatch, capsys):
    """The Round 12 hospital order: register the test set, the plain audit,
    the twin-free audit, one preregistration per model — THEN the split,
    which registers the dev set after the twin-free file was written."""
    from nmt_forge.scaffold import init_project

    monkeypatch.setenv("NMT_FORGE_NO_MONITOR", "1")    # no live panel
    init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    monkeypatch.chdir(tmp_path / "proj")
    write_jsonl(Path("corpus.jsonl"), _corpus())
    write_jsonl(Path("test.jsonl"), _test_rows())
    for argv in (("registry", "add", "project-test", "test.jsonl", "--role",
                  "test"),
                 ("leak-audit", "corpus.jsonl", "--clean-to",
                  "corpus.clean.jsonl"),
                 ("leak-audit", "corpus.jsonl", "--clean-to",
                  "corpus.notwins.jsonl", "--drop-test-twins")):
        code, _, err = _run(capsys, *argv)
        assert code == 0, err
    ws = Workspace(".forge")
    _prereg(ws, "all-data")
    _prereg(ws, "notwins")
    code, out, err = _run(capsys, "split", "corpus.clean.jsonl", "--test",
                          "0", "--dev", "20", "--seed", "42", "--out",
                          "data/split", "--register", "project", "--json")
    assert code == 0, err
    return {"dir": tmp_path / "proj", "ws": ws, "split": json.loads(out)}


def _dev_rows_in(path: str) -> int:
    """Rows of ``path`` that ARE dev rows (same source or target) — counted
    here independently of forge."""
    dev = [json.loads(line) for line in
           Path("data/split/dev.jsonl").read_text().splitlines() if line]
    src = {r["source"] for r in dev}
    tgt = {r.get("target", r.get("reference")) for r in dev}
    rows = [json.loads(line) for line in Path(path).read_text().splitlines()
            if line]
    return sum(r["source"] in src or r["target"] in tgt for r in rows)


def _gates(config: str) -> dict:
    from nmt_forge.advisor import preflight

    return {g.name: g for g in preflight(Workspace(".forge"), "run", config)}


REAUDIT = ("nmt-forge leak-audit corpus.jsonl --clean-to "
           "corpus.notwins.jsonl --drop-test-twins")


# -- 8. training rows that ARE dev rows ------------------------------------------

def test_the_twin_free_corpus_written_before_the_split_holds_dev_rows(
        hospital):
    """The premise, measured independently: the split carved its dev set
    from the corpus the twin-free file was cut from, so some dev rows are
    in the twin-free file."""
    assert _dev_rows_in("corpus.notwins.jsonl") > 0
    assert _dev_rows_in("data/split/train.jsonl") == 0


def test_run_refuses_dev_rows_in_training_with_the_reaudit_fix(hospital):
    from nmt_forge.training.run import run

    n = _dev_rows_in("corpus.notwins.jsonl")
    with pytest.raises(DevFenceError) as ei:
        run("config-notwins.json")
    e = ei.value
    assert f"{n} training row(s) ARE rows of the registered dev set " \
           "'project-dev'" in str(e)
    assert e.details["training_dev_overlap"] == {"corpus.notwins.jsonl": n}
    assert REAUDIT in e.fix
    assert "--allow" not in e.fix
    # refused before any training compute: no run manifest
    assert not list(Path(".forge/runs").glob("*/run-manifest.json"))


def test_run_refusal_is_a_json_error_with_the_counts(hospital, capsys):
    code, out, _ = _run(capsys, "run", "config-notwins.json", "--json")
    assert code == 2
    err = json.loads(out)["error"]
    assert err["type"] == "DevFenceError" and err["guard"] == "dev-fence"
    assert err["fix"] and REAUDIT in err["fix"]
    assert err["details"]["dev_set"] == "project-dev"
    assert err["details"]["training_dev_overlap"]["corpus.notwins.jsonl"] > 0


def test_preflight_dev_fence_fails_on_the_same_files(hospital):
    g = _gates("config-notwins.json")
    n = _dev_rows_in("corpus.notwins.jsonl")
    assert not g["dev-fence"].ok
    assert f"{n} training row(s) ARE rows of the registered dev set" in \
        g["dev-fence"].detail
    assert REAUDIT in g["dev-fence"].fix
    # the dev twin reading is not taken on a file that holds dev rows
    assert g["dev-near-twins"].detail.startswith("not checked: ")
    assert "ARE rows of project-dev (see dev-fence)" in \
        g["dev-near-twins"].detail
    # headroom still measured: the dev set itself is fine
    assert "not checked" not in g["generation-headroom"].detail or \
        "backend" in g["generation-headroom"].detail
    # the all-data config (the split's own train side) is unaffected
    a = _gates("config.json")["dev-fence"]
    assert a.ok, a.detail
    assert "no row of the 1 training file(s) is a dev row" in a.detail


def test_status_names_the_reaudit_from_the_ledger_order(hospital):
    from nmt_forge.advisor import next_action, render_status, snapshot

    ws = Workspace(".forge")
    tf = snapshot(ws)["leak_audits"]["project-test"]["twin_free"]
    assert tf["predates_dev"] == ["project-dev"]
    a = next_action(ws)
    assert a.state == "ready-to-train"
    assert a.command.startswith(REAUDIT)
    assert "then train: nmt-forge preflight run --config config.json" in \
        a.command
    assert "was written BEFORE the dev set project-dev was registered" in a.why
    assert any("predates the dev set" in b for b in a.blockers)
    w = next(x for x in a.warnings if x.startswith("twin-free corpus for"))
    assert f"`{REAUDIT} && nmt-forge preflight run --config " \
           "config-notwins.json && nmt-forge run config-notwins.json`" in w
    assert "hence the re-audit first" in w
    assert REAUDIT in render_status(ws)


def test_split_says_the_reaudit_before_training_the_twin_free_model(hospital):
    advice = hospital["split"]["near_twin"]["project-test"]["advice"]
    assert "was written BEFORE the dev set project-dev was registered" in advice
    assert advice.index(REAUDIT) < advice.index(
        "train the twin-free model too: nmt-forge preflight run --config "
        "config-notwins.json")


def test_the_reaudit_after_the_split_clears_every_signal(hospital, capsys):
    from nmt_forge.advisor import next_action, snapshot

    code, out, err = _run(capsys, *REAUDIT.split()[1:], "--json")
    assert code == 0, err
    assert json.loads(out)["verdict"]["numbers"]["dev_set_rows_among_them"]
    assert _dev_rows_in("corpus.notwins.jsonl") == 0
    ws = Workspace(".forge")
    assert snapshot(ws)["leak_audits"]["project-test"]["twin_free"][
        "predates_dev"] == []
    a = next_action(ws)
    assert a.command.startswith("nmt-forge preflight run --config config.json")
    assert not any("predates" in x for x in a.warnings + a.blockers)
    g = _gates("config-notwins.json")
    assert g["dev-fence"].ok, g["dev-fence"].detail
    assert not g["dev-near-twins"].detail.startswith("not checked")


def _fake_run(name: str, gold: str, *, checked: bool) -> None:
    """A run manifest as `nmt-forge run` writes it (no training): trained on
    ``gold``; ``checked`` = written by a run that made the training-side
    dev check (since Round 12)."""
    d = Path(".forge/runs") / f"{name}-0000"
    d.mkdir(parents=True)
    dev_set = {"name": "project-dev"}
    if checked:
        dev_set["training_overlap"] = {gold: 0}
    (d / "run-manifest.json").write_text(json.dumps({
        "run_name": name, "config_hash": "0" * 16,
        "config": {"data": {"gold": [gold], "dev": "project-dev"},
                   "eval": {"battery": "project-test"}},
        "selected_checkpoint": "ckpt-1", "dev_set": dev_set,
        "dev_report": {"n": 20, "scores": {}}, "stages": []}))


def test_a_run_trained_on_the_stale_file_before_the_check_is_named(hospital):
    """A run from before Round 12 trained on the twin-free file written
    before the split: status says so (its dev score may be recall of rows
    it trained on); a run since then made the check, so it is not named."""
    from nmt_forge.advisor import next_action

    _fake_run("old-notwins", "corpus.notwins.jsonl", checked=False)
    w = [x for x in next_action(Workspace(".forge")).warnings
         if "trained on it, and the twin-free corpus" in x]
    assert len(w) == 1 and "run(s) old-notwins" in w[0]
    assert REAUDIT in w[0] and "then retrain" in w[0]
    import shutil

    shutil.rmtree(".forge/runs/old-notwins-0000")
    _fake_run("new-notwins", "corpus.notwins.jsonl", checked=True)
    assert not [x for x in next_action(Workspace(".forge")).warnings
                if "trained on it, and the twin-free corpus" in x]


def test_the_fix_for_the_corpus_the_split_was_carved_from(hospital):
    """A config that trains on the corpus the dev set was carved from: the
    fix is the split's train side, not an audit."""
    from nmt_forge.advisor import dev_overlap_fix

    cfg = json.loads(Path("config.json").read_text())
    cfg["data"]["gold"] = ["corpus.clean.jsonl"]
    cfg["run_name"] = "wrong-file"
    Path("config-wrong.json").write_text(json.dumps(cfg))
    g = _gates("config-wrong.json")["dev-fence"]
    assert not g.ok
    assert 'set data.gold to ["data/split/train.jsonl"]' in g.fix
    other = write_jsonl(Path("harvest.jsonl"), _corpus()[-10:])
    assert dev_overlap_fix(Workspace(".forge"), str(other), "project-dev") \
        .startswith("`nmt-forge leak-audit harvest.jsonl --clean-to "
                    "harvest.nodev.jsonl`")


def test_training_overlap_counts_source_or_target(ws, tmp_path):
    from nmt_forge.guards.dev_fence import DevFence

    dev = [{"source": "Alpha one.", "target": "aa"},
           {"source": "beta two", "target": "bb"}]
    f = write_jsonl(tmp_path / "t.jsonl", [
        {"source": "alpha  one", "target": "zz"},        # canonical source
        {"source": "other", "target": "BB"},             # canonical target
        {"source": "free", "target": "row"}])
    fence = DevFence(ws)
    assert fence.training_overlap(dev, [str(f), str(tmp_path / "gone")]) \
        == {str(f): 2}
    with pytest.raises(DevFenceError) as ei:
        fence.require_disjoint_training("d", dev, [str(f)],
                                        fix_for=lambda p: f"FIX {p}")
    assert ei.value.fix == f"FIX {f}"
    clean = write_jsonl(tmp_path / "c.jsonl", [{"source": "x", "target": "y"}])
    assert fence.require_disjoint_training("d", dev, [str(clean)]) == \
        {str(clean): 0}


# -- 14 + 9/15: dummy runs of both models -----------------------------------------

def _dummy(config: str) -> None:
    """The project's config, trained by the dummy backend (no torch)."""
    raw = json.loads(Path(config).read_text())
    raw["model"] = {"backend": "dummy"}
    raw["selection"] = {"metric": "loss"}
    raw["decode"] = {"max_new_tokens": 32}
    raw["eval"]["n_bootstrap"] = 40
    Path(config).write_text(json.dumps(raw))


@pytest.fixture
def two_runs(hospital, capsys):
    """Both models trained (the twin-free one after the re-audit), neither
    exported — the run's own NEXT lines are the subject."""
    code, _, err = _run(capsys, *REAUDIT.split()[1:])
    assert code == 0, err
    _dummy("config.json")
    _dummy("config-notwins.json")
    code, out, err = _run(capsys, "run", "config.json", "--json")
    assert code == 0, err
    all_data = json.loads(out)
    code, out, err = _run(capsys, "run", "config-notwins.json", "--json")
    assert code == 0, err
    return {**hospital, "all": all_data, "free": json.loads(out)}


def test_each_run_names_its_own_preregistration(two_runs):
    """Round 12 school persona: both runs printed `--prereg
    <all-data|notwins>`. Each preregistration is named after its model, as
    forge asks — the NEXT line names the matching one."""
    a, f = two_runs["all"], two_runs["free"]
    assert " --prereg all-data " in a["next"], a["next"]
    assert "all-data is the one not named after another run (notwins → " \
           "qaa-nmt-cpu-tiny-notwins)" in a["prereg_note"]
    assert " --prereg notwins " in f["next"], f["next"]
    assert "notwins is the one named after run 'qaa-nmt-cpu-tiny-notwins'" \
        in f["prereg_note"]
    assert "<" not in a["next"] + f["next"]


def test_names_that_do_not_decide_leave_the_choice_with_the_reason():
    from nmt_forge.advisor import export_prereg_arg

    run = {"run": "m1", "prereg": {"state": "ambiguous", "set": "t",
                                   "candidates": ["p1", "p2"]}}
    flag, note = export_prereg_arg(run, [{"id": "p1"}, {"id": "p2"}],
                                   ["m1", "m2"])
    assert flag == " --prereg <p1|p2>"
    assert "their names do not say (none is named after this run, and p1, " \
           "p2 name no other run either)" in note
    run = {"run": "model-notwins-v2", "prereg": {
        "state": "ambiguous", "set": "t",
        "candidates": ["notwins", "notwins-v2"]}}
    flag, note = export_prereg_arg(run, [{"id": "notwins"},
                                         {"id": "notwins-v2"}])
    assert flag == " --prereg <notwins|notwins-v2>", "two match: ask"
    assert "2 of them (notwins, notwins-v2) are named after run" in note


def test_the_all_data_export_names_the_planned_twin_free_model(two_runs,
                                                               capsys):
    """Round 12 (both personas): the twin-free model was preregistered
    before any read and trained, only not exported — the advice is its
    export, never a new --allow-after-reads preregistration."""
    a, f = two_runs["all"], two_runs["free"]
    code, out, err = _run(capsys, "export", a["manifest"], "--out",
                          "export-all", "--no-model", "--prereg", "all-data",
                          "--json")
    assert code == 0, err
    nt = json.loads(out)["near_twin"]
    assert nt["near_twin_rows"]
    assert "--allow-after-reads" not in nt["advice"]
    assert "retrain" not in nt["advice"]
    assert nt["advice"].startswith("the twin-free model of this test set is "
                                   "already planned in this workspace")
    assert "judged by preregistration notwins, written before any scoring " \
           "read — no new preregistration is needed" in nt["advice"]
    planned = nt["twin_free_planned"]
    assert planned["prereg"] == "notwins" and planned["trained"] is True
    assert planned["prereg_before_reads"] is True
    assert planned["next"] == (f"nmt-forge export {f['manifest']} --prereg "
                               f"notwins --out {f['export_out']}")
    fm = json.loads(Path("export-all/evaluation/forge-model.json")
                    .read_text())
    assert fm["test_report"]["near_twin"]["advice"] == nt["advice"]
    # following it: the twin-free export cites itself in the all-data one,
    # and the planned note goes
    code, out, err = _run(capsys, *planned["next"].split()[1:], "--no-model",
                          "--json")
    assert code == 0, err
    fm = json.loads(Path("export-all/evaluation/forge-model.json")
                    .read_text())
    nt = fm["test_report"]["near_twin"]
    assert nt["advice"].startswith("a twin-free model of this test set is "
                                   "already exported")
    assert "twin_free_planned" not in nt


def test_the_planned_model_not_trained_yet(hospital):
    """Only the twin-free corpus, config and prereg exist: the step is its
    training — after the re-audit when the file predates the dev set."""
    from nmt_forge.export import twin_free_planned, twin_free_planned_advice

    ws = Workspace(".forge")
    p = twin_free_planned(ws, "project-test", this_manifest="none",
                          judged_by="all-data")
    assert p["prereg"] == "notwins" and p["trained"] is False
    assert p["next"] == (f"{REAUDIT} && nmt-forge preflight run --config "
                         "config-notwins.json && nmt-forge run "
                         "config-notwins.json")
    text = twin_free_planned_advice(p, "project-test")
    assert "it is not trained yet: `" + p["next"] + "`, then export it " \
           "with --prereg notwins" in text
    # no prereg left for it (only this export's): write one, after reads
    (ws.prereg_dir / "notwins.json").unlink()
    p = twin_free_planned(ws, "project-test", this_manifest="none",
                          judged_by="all-data")
    assert p["prereg"] is None
    assert "--allow-after-reads" in twin_free_planned_advice(p,
                                                             "project-test")


# -- 10. status after serve ------------------------------------------------------

class _Health(BaseHTTPRequestHandler):
    model = "nmt-forge-private-run"

    def do_GET(self):          # noqa: N802
        body = json.dumps({"status": "ok", "model": self.model}).encode()
        self.send_response(200 if self.path == "/health" else 404)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


@pytest.fixture
def health_server():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), _Health)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    yield httpd
    httpd.shutdown()
    httpd.server_close()


def _serve_rec(port: int, **kw) -> dict:
    return {"model_dir": "/x/model", "model": _Health.model,
            "url": f"http://127.0.0.1:{port}", "host": "127.0.0.1",
            "port": port, "pid": os.getpid(),
            "hostname": socket.gethostname(), "started": time.time() - 5,
            "ts": "2026-10-04T13:53:32+00:00", "stopped": None, **kw}


def test_serve_liveness_states(health_server):
    from nmt_forge.advisor import serve_liveness

    port = health_server.server_address[1]
    assert serve_liveness(_serve_rec(port))["state"] == "up"
    other = serve_liveness(_serve_rec(port, model="another"))
    assert other["state"] == "down" and "not 'another'" in other["why"]
    assert serve_liveness(_serve_rec(port, stopped="2026-10-04T14:00:00"))[
        "state"] == "down"
    # an older record: no address, no pid
    old = serve_liveness({"model_dir": "/x/model", "model": "m"})
    assert old["state"] == "unknown" and "older" in old["why"]
    # a process that is gone: no probe needed
    p = subprocess.Popen([sys.executable, "-c", "pass"])
    p.wait()
    gone = serve_liveness(_serve_rec(port, pid=p.pid))
    assert gone["state"] == "down" and str(p.pid) in gone["why"]
    assert serve_liveness(_serve_rec(port, hostname="elsewhere"))["state"] \
        == "unknown"


def test_serve_records_its_address_pid_and_clean_stop(hf_export, capsys,  # noqa: F811
                                                     monkeypatch):
    from types import SimpleNamespace

    from nmt_forge import serve as serve_mod

    class _Httpd:
        server_address = ("127.0.0.1", 8391)

        def serve_forever(self):
            raise KeyboardInterrupt

        def server_close(self):
            pass

    model = SimpleNamespace(name="m", health=lambda: {"pair": "eng-qaa"})
    monkeypatch.setattr(serve_mod, "build_server",
                        lambda *a, **k: (_Httpd(), model))
    code, _, _ = _run(capsys, "--workspace", hf_export["ws_dir"], "serve",
                      str(hf_export["out"] / "model"), "--port", "8391")
    assert code == 0
    ws = Workspace(hf_export["ws_dir"])
    ev = ws.ledger.find("serve")[-1]
    assert ev["url"] == "http://127.0.0.1:8391" and ev["port"] == 8391
    assert ev["pid"] == os.getpid() and ev["hostname"] == socket.gethostname()
    stop = ws.ledger.find("serve-stop")[-1]
    assert stop["pid"] == ev["pid"] and stop["url"] == ev["url"]
    from nmt_forge.advisor import serve_liveness, snapshot

    rec = snapshot(ws)["serve_records"][-1]
    assert rec["stopped"] == stop["ts"]
    assert serve_liveness(rec)["state"] == "down"


def test_status_moves_to_serving_and_back(hf_export, health_server):  # noqa: F811
    from nmt_forge.advisor import next_action, render_status

    ws = Workspace(hf_export["ws_dir"])
    model_dir = str((hf_export["out"] / "model").resolve())
    a = next_action(ws)
    assert a.state == "exported" and a.command == f"nmt-forge serve {model_dir}"
    port = health_server.server_address[1]
    rec = _serve_rec(port, model_dir=model_dir)
    for k in ("ts", "stopped"):
        rec.pop(k)
    ws.ledger.append("serve", **rec)
    a = next_action(ws)
    assert a.state == "serving", a.why
    assert a.command.startswith("npx champollion sync")
    assert f"http://127.0.0.1:{port}/translate" in a.command
    assert "forge has nothing left to run" in a.why
    assert any(r.startswith(f"served: http://127.0.0.1:{port}")
               for r in a.ready)
    assert "NEXT: npx champollion sync" in render_status(ws)
    # the server stops (killed: no serve-stop record) — the probe finds it
    health_server.shutdown()
    health_server.server_close()
    a = next_action(ws)
    assert a.state == "exported"
    assert a.command == f"nmt-forge serve {model_dir} --port {port}"
    assert a.why.startswith(f"it was served at http://127.0.0.1:{port}")
    assert "nothing answers" in a.why


# -- 13. registry add of a path that is not there ----------------------------------

def test_registry_add_names_the_path_it_looked_for_and_the_fix(
        tmp_path, monkeypatch, capsys):
    """Round 12 school persona: `school-crk/data/…` — a path written from
    the directory above the project, read inside it — came back as a bare
    FileNotFoundError, why/fix null."""
    (tmp_path / "proj").mkdir()
    write_jsonl(tmp_path / "data" / "test.jsonl", _test_rows())
    monkeypatch.chdir(tmp_path / "proj")
    code, out, _ = _run(capsys, "registry", "add", "project-test",
                        "data/test.jsonl", "--role", "test", "--json")
    assert code == 2
    err = json.loads(out)["error"]
    assert err["type"] == "EvalFileMissing" and err["guard"] == "registry"
    looked = Path.cwd() / "data" / "test.jsonl"
    assert f"no eval file at {looked}" in err["message"]
    assert err["why"] and "from the directory it runs in" in err["why"]
    assert "pass ../data/test.jsonl" in err["fix"]
    # nothing found anywhere: still the resolved path and a fix
    code, out, _ = _run(capsys, "registry", "add", "x", "/nowhere/t.tsv",
                        "--role", "test", "--json")
    err = json.loads(out)["error"]
    assert "no eval file at /nowhere/t.tsv" in err["message"]
    assert err["fix"].startswith("pass the file's absolute path")
    # the right path registers
    code, _, err = _run(capsys, "registry", "add", "project-test",
                        "../data/test.jsonl", "--role", "test")
    assert code == 0, err
