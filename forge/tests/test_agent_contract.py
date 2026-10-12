"""The agent contract: --json everywhere, exact advice, honest preflight,
and the bridges (export → mt-eval report, serve → champollion CLI).

These are the synthetic-user findings of 2026-10 turned into tests: a weak
agent with only the wheels must be able to drive every step mechanically.
"""

import json
import threading
import urllib.error
import urllib.request

import pytest

from nmt_forge.cli import build_parser, main
from tests.conftest import write_jsonl


def _run(capsys, *argv):
    code = main(list(argv))
    out = capsys.readouterr()
    return code, out.out, out.err


def _leaf_parsers(parser, prefix=()):
    """Every runnable subcommand parser, with its command path."""
    import argparse

    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            for name, sub in action.choices.items():
                has_children = any(isinstance(a, argparse._SubParsersAction)
                                   for a in sub._actions)
                if has_children:
                    yield from _leaf_parsers(sub, prefix + (name,))
                else:
                    yield prefix + (name,), sub


def test_every_subcommand_has_json():
    leaves = list(_leaf_parsers(build_parser()))
    assert len(leaves) >= 25
    missing = [" ".join(path) for path, p in leaves
               if not any("--json" in a.option_strings for a in p._actions)]
    assert missing == [], f"subcommands without --json: {missing}"


def test_usage_errors_are_json_under_json(capsys):
    code, out, _ = _run(capsys, "split", "c.jsonl", "--json")  # missing flags
    assert code == 2
    err = json.loads(out)["error"]
    assert err["type"] == "UsageError" and "--test" in err["message"]


def test_abbreviated_flags_are_refused(capsys):
    # `--eval` used to silently mean `--eval-set` on some Pythons only
    code, _, err = _run(capsys, "prereg", "new", "p1", "--eval", "x",
                        "--predictions", "p.json")
    assert code == 2 and "--eval" in err


def test_json_mode_keeps_stdout_to_one_document(tmp_path, capsys):
    ws_dir = str(tmp_path / ".forge")
    code, out, _ = _run(capsys, "--workspace", ws_dir, "status", "--json")
    assert code == 0
    doc = json.loads(out)          # parses → exactly one document
    assert set(doc) == {"snapshot", "advice"}


# -- preflight: a green preflight is never followed by a predictable refusal --

def _workspace_with_dev(tmp_path):
    from nmt_forge.workspace import Workspace

    ws = Workspace(tmp_path / ".forge")
    dev = write_jsonl(tmp_path / "dev.jsonl",
                      [{"source": f"d {i} x y", "reference": f"r {i} z w"}
                       for i in range(4)])
    ws.registry.register("project-dev", dev, "dev")
    gold = write_jsonl(tmp_path / "train.jsonl",
                       [{"source": f"g {i} a b", "target": f"t {i} c d"}
                        for i in range(8)])
    return ws, gold


def _config(tmp_path, gold, model):
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({
        "run_name": "pf", "workspace": str(tmp_path / ".forge"),
        "data": {"gold": [str(gold)], "dev": "project-dev"},
        "model": model, "selection": {"metric": "loss"},
    }))
    return cfg


def test_preflight_run_reports_a_missing_training_extra(tmp_path, monkeypatch):
    from nmt_forge.advisor import preflight
    from nmt_forge.training import backends

    ws, gold = _workspace_with_dev(tmp_path)
    cfg = _config(tmp_path, gold, {"backend": "hf-scratch"})
    monkeypatch.setattr(backends, "hf_missing",
                        lambda model_cfg=None: ["accelerate"])
    gates = {g.name: g for g in preflight(ws, "run", cfg)}
    g = gates["backend-installed"]
    assert not g.ok
    assert "accelerate" in g.detail
    # python3 -m pip: a bare `pip` is not on PATH in every environment
    assert g.fix == "python3 -m pip install 'nmt-forge[hf]'"
    # …and the backend refuses with the SAME words (one check, two callers)
    with pytest.raises(Exception, match=r"nmt-forge\[hf\]"):
        backends.HFScratchBackend({"backend": "hf-scratch"})


def test_preflight_run_checks_the_configs_own_dev_set_and_files(tmp_path):
    from nmt_forge.advisor import preflight

    ws, gold = _workspace_with_dev(tmp_path)
    cfg = _config(tmp_path, gold, {"backend": "dummy"})
    gates = {g.name: g for g in preflight(ws, "run", cfg)}
    assert gates["config"].ok and gates["dev-fence"].ok
    assert gates["training-data"].ok and gates["backend-installed"].ok
    assert gates["workspace-match"].ok
    # a config naming an unregistered dev set → red, with the fix
    raw = json.loads(cfg.read_text())
    raw["data"]["dev"] = "nope-dev"
    raw["data"]["gold"] = [str(tmp_path / "missing.jsonl")]
    cfg.write_text(json.dumps(raw))
    gates = {g.name: g for g in preflight(ws, "run", cfg)}
    assert not gates["dev-fence"].ok and "NOT registered" in gates["dev-fence"].detail
    assert not gates["training-data"].ok


def test_preflight_without_a_config_says_so(tmp_path, monkeypatch):
    from nmt_forge.advisor import preflight
    from nmt_forge.workspace import Workspace

    monkeypatch.chdir(tmp_path)
    gates = preflight(Workspace(tmp_path / ".forge"), "run")
    assert gates[0].name == "config" and not gates[0].ok


# -- schedule: small corpora get evaluated --------------------------------------

def test_small_runs_get_a_derived_eval_cadence():
    from nmt_forge.training.schedule import plan_schedule

    small = plan_schedule(gold_rows=1600, synth_rows=0, dev_is_real=True,
                          batch_size=16, grad_accum=1, epochs=3)
    assert small.planned_steps == 300
    assert small.eval_steps == 30          # ≈10 dev evaluations, not 0
    big = plan_schedule(gold_rows=2_000_000, synth_rows=0, dev_is_real=True,
                        batch_size=4, grad_accum=4, epochs=3)
    assert big.eval_steps == 2000          # large runs keep the preset


def test_user_model_eval_steps_is_not_overridden(tmp_path, monkeypatch):
    import importlib

    from nmt_forge.training.backends import DummyBackend

    run_mod = importlib.import_module("nmt_forge.training.run")

    ws, gold = _workspace_with_dev(tmp_path)
    seen = {}

    class Spy(DummyBackend):
        def train(self, train_rows, dev_rows, params, run_dir):
            seen.update(params)
            return super().train(train_rows, dev_rows, params, run_dir)

    monkeypatch.setattr(run_mod, "make_backend", lambda cfg: Spy())
    cfg = _config(tmp_path, gold, {"backend": "dummy", "eval_steps": 7})
    run_mod.run(cfg)
    assert "eval_steps" not in seen      # the backend reads cfg.model's 7


# -- evaluate on an id-less battery (what `split` writes) ------------------------

def _dummy_project(tmp_path, capsys, *, battery_ids: bool):
    ws_dir = str(tmp_path / ".forge")
    dev = write_jsonl(tmp_path / "dev.jsonl",
                      [{"source": f"d {i}", "reference": f"dref {i}"}
                       for i in range(6)])
    _run(capsys, "--workspace", ws_dir, "registry", "add", "toy-dev",
         str(dev), "--role", "dev")
    rows = [{"source": f"s {i}", "reference": f"r {i} tok"} for i in range(8)]
    if battery_ids:
        rows = [{"id": f"b-{i}", **r} for i, r in enumerate(rows)]
    battery = write_jsonl(tmp_path / "battery.jsonl", rows)
    _run(capsys, "--workspace", ws_dir, "registry", "add", "battery",
         str(battery), "--role", "test")
    preds = tmp_path / "preds.json"
    preds.write_text(json.dumps(
        [{"metric": "chrf++", "expect": "low", "rationale": "dummy decode"}]))
    _run(capsys, "--workspace", ws_dir, "prereg", "new", "bp",
         "--eval-set", "battery", "--predictions", str(preds))
    gold = write_jsonl(tmp_path / "gold.jsonl",
                       [{"source": f"g {i}", "target": f"gt {i}"}
                        for i in range(6)])
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({
        "run_name": "dummy-run", "workspace": ws_dir,
        "language": {"source": "eng", "target": "qaa"},
        "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "model": {"backend": "dummy"}, "selection": {"metric": "loss"},
        "decode": {"max_new_tokens": 32},
        "eval": {"battery": "battery", "n_bootstrap": 40},
    }))
    code, out, _ = _run(capsys, "--workspace", ws_dir, "run", str(cfg),
                        "--json")
    assert code == 0
    return ws_dir, cfg, json.loads(out)["manifest"]


def test_evaluate_works_on_a_battery_without_ids(tmp_path, capsys):
    ws_dir, cfg, manifest = _dummy_project(tmp_path, capsys,
                                           battery_ids=False)
    code, out, err = _run(capsys, "--workspace", ws_dir, "evaluate", manifest,
                          "--json")
    assert code == 0, err
    battery = json.loads(out)["battery"]
    assert battery["n"] == 8
    assert list(battery["groups"]) == ["all"]    # no `register` field → one group


# -- export: the mt-eval bridge ------------------------------------------------------

def test_export_writes_a_harness_testreport_mt_eval_accepts(tmp_path, capsys):
    ws_dir, cfg, manifest = _dummy_project(tmp_path, capsys, battery_ids=True)
    # the dummy backend has no weights: packaging a model is refused …
    code, out, _ = _run(capsys, "--workspace", ws_dir, "export", manifest,
                        "--out", str(tmp_path / "exp"), "--json")
    assert code == 2 and "--no-model" in json.loads(out)["error"]["text"]
    assert not (tmp_path / "exp").exists()          # all-or-nothing
    # … the evaluation + harness report is not
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--out", str(tmp_path / "exp"), "--no-model",
                          "--json")
    assert code == 0, err
    summary = json.loads(out)
    report = json.loads(open(summary["harness_report"]).read())
    runlog = json.loads(open(summary["harness_runlog"]).read())
    # the harness's own TestReport shape, which `mt-eval export` validates
    from mt_eval_harness.exporter import _validate_report

    _validate_report(report)
    assert "corpus_chrf" in report["overall"]
    assert len(runlog["results"]) == 8
    assert runlog["provenance"]["nmt_forge"]["config_hash"]
    # --no-model: nothing to deploy, so the record sits with the evidence
    assert not (tmp_path / "exp" / "model").exists()
    fm = json.loads((tmp_path / "exp" / "evaluation" / "forge-model.json")
                    .read_text())
    assert fm["test_report"]["set"] == "battery" and fm["model_dir"] is None
    # the ledger knows: status now advises serving (well — there is no model
    # here, but the export event is recorded)
    code, out, _ = _run(capsys, "--workspace", ws_dir, "ledger", "show",
                        "--json")
    assert any(e["event"] == "export" for e in json.loads(out))


def test_export_closes_the_prereg_loop_and_carries_the_near_twin_caveat(
        tmp_path, capsys):
    """Synthetic users 2026-10: `prereg check` could not read what export
    wrote ('observed None → manual'), and an all-near-twinned test set's
    score travelled bare to DEPLOY.md and the TestReport. Now export prints
    the verdicts and the near-twin reading, `prereg check` reads the export,
    and the TestReport carries both as nmt_forge_* fields next to its own."""
    ws_dir, cfg, manifest = _dummy_project(tmp_path, capsys, battery_ids=True)
    raw = json.loads(cfg.read_text())
    # every battery row is a near-twin of a training row
    twins = write_jsonl(tmp_path / "twins.jsonl",
                        [{"source": f"s {i}", "target": f"r {i} tok"}
                         for i in range(8)])
    raw["eval"]["near_dupe_corpus"] = str(twins)
    cfg.write_text(json.dumps(raw))
    preds = tmp_path / "preds2.json"
    preds.write_text(json.dumps([
        {"metric": "chrf++", "direction": "increase", "baseline_score": 0.0,
         "rationale": "never below zero"}]))
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "new",
                          "bp2", "--eval-set", "battery", "--predictions",
                          str(preds), "--json")
    assert code == 0, out
    # two preregs now bind the set for this run (bp and bp2): forge refuses
    # to guess which one predicted it — the run names bp2
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--config", str(cfg), "--out",
                          str(tmp_path / "exp"), "--no-model",
                          "--prereg", "bp2")
    assert code == 0, err
    assert "judged against preregistration bp2 (named with --prereg)" in out
    assert "prereg bp2: 1 held, 0 failed, 0 for a human to judge" in out
    assert "all 8 test rows have a near-identical twin" in out
    assert "recall of training phrases, not translation" in out
    assert "--drop-test-twins" in out            # what to do about it
    fm = json.loads((tmp_path / "exp" / "evaluation" / "forge-model.json")
                    .read_text())
    assert fm["test_report"]["near_twin"]["near_twin_share"] == 1.0
    assert fm["test_report"]["prereg"]["id"] == "bp2"
    overall = json.loads((tmp_path / "exp" / "evaluation" /
                          "runlog_report.json").read_text())["overall"]
    assert overall["nmt_forge_near_twin_rows"] == 8
    assert overall["nmt_forge_recall_not_translation"] is True
    assert overall["nmt_forge_strict_corpus_chrf"] is None
    assert "corpus_chrf" in overall           # the harness's own, untouched
    # prereg check: the export dir, and — with no --results — the ledger's
    for extra in (["--results", str(tmp_path / "exp")], []):
        code, out, err = _run(capsys, "--workspace", ws_dir, "prereg",
                              "check", "bp2", *extra, "--json")
        assert code == 0, out
        rows = json.loads(out)
        assert [r["verdict"] for r in rows] == ["held"]
        assert rows[0]["observed"] is not None
    # results for another set are refused, not silently mis-verdicted
    code, out, _ = _run(capsys, "--workspace", ws_dir, "prereg", "check",
                        "bp2", "--results", str(tmp_path / "exp" / "evaluation"
                                                / "runlog_report.json"))
    assert code == 0
    other = json.loads((tmp_path / "exp" / "evaluation" /
                        "battery-hyps-battery.json").read_text())
    other["eval_set"] = "someone-else"
    (tmp_path / "other.json").write_text(json.dumps(other))
    code, out, _ = _run(capsys, "--workspace", ws_dir, "prereg", "check",
                        "bp2", "--results", str(tmp_path / "other.json"),
                        "--json")
    assert code == 2 and "someone-else" in json.loads(out)["error"]["text"]


def test_deploy_headline_without_a_test_set_says_so():
    from nmt_forge.export import _headline

    text = _headline(None, None, None, "export", "project-dev",
                     {"chrf++": {"score": 40.0, "ci_lower": 38.0,
                                 "ci_upper": 42.0}})
    assert "Not evaluated on a test set" in text
    assert "chrF++ 40.0 [38.0, 42.0] 95% CI" in text


def test_export_without_eval_block_explains(tmp_path, capsys):
    ws_dir, cfg, manifest = _dummy_project(tmp_path, capsys, battery_ids=True)
    raw = json.loads(cfg.read_text())
    raw.pop("eval")
    cfg.write_text(json.dumps(raw))
    code, out, _ = _run(capsys, "--workspace", ws_dir, "export", manifest,
                        "--config", str(cfg), "--out", str(tmp_path / "e2"),
                        "--no-model", "--json")
    assert code == 2 and "no eval block" in json.loads(out)["error"]["text"]


# -- serve: the HTTP contracts, with a stand-in model (no torch needed) -----------

class _FakeModel:
    name = "fake-model"
    hook_spec = None
    hook_active = False

    def translate(self, texts):
        return [f"T({t})" for t in texts]

    def check_locales(self, source, target):
        if target and target.split("-")[0] not in ("crk",):
            return f"this model translates into ['crk']; asked {target!r}"
        return None

    def health(self):
        return {"status": "ok", "model": self.name}


@pytest.fixture
def server():
    from http.server import ThreadingHTTPServer

    from nmt_forge.serve import make_handler

    def start(token=None):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0),
                                    make_handler(_FakeModel(), token))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        started.append(httpd)
        return f"http://127.0.0.1:{httpd.server_address[1]}"

    started = []
    yield start
    for h in started:
        h.shutdown()


def _post(url, body, headers=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read()), r.headers
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read()), e.headers


def test_serve_speaks_the_champollion_api_contract(server):
    base = server()
    status, body, _ = _post(f"{base}/translate", {
        "source_locale": "en", "target_locale": "crk", "method": "m",
        "keys": {"hero.title": "Welcome", "empty": ""}})
    # exactly what cli/lib/methods/api.js reads: translations + 207 errors
    assert status == 207
    assert body["translations"] == {"hero.title": "T(Welcome)"}
    assert "empty" in body["errors"]
    status, body, _ = _post(f"{base}/translate", {
        "target_locale": "fr", "keys": {"a": "x"}})
    assert status == 400 and "crk" in body["error"]["message"]


def test_serve_openai_chat_translates_the_cli_json_object(server):
    base = server()
    prompt = ('UI context for these keys:\n- "a": button\n\n'
              + json.dumps({"a": "Save", "nav.home": "Home"}, indent=2))
    status, body, headers = _post(f"{base}/v1/chat/completions", {
        "model": "x", "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": "Be formal."},
                     {"role": "user", "content": prompt}]})
    assert status == 200
    content = json.loads(body["choices"][0]["message"]["content"])
    assert content == {"a": "T(Save)", "nav.home": "T(Home)"}
    assert "not followed" in headers["X-NMT-Forge-Note"]
    # plain chat: translated as Markdown, blank lines kept
    status, body, _ = _post(f"{base}/v1/chat/completions", {
        "messages": [{"role": "user", "content": "one\n\ntwo"}]})
    assert body["choices"][0]["message"]["content"] == "T(one)\n\nT(two)"


def test_serve_token_and_size_limits(server):
    base = server(token="s3cret")
    status, body, _ = _post(f"{base}/translate", {"keys": {"a": "x"}})
    assert status == 401
    status, body, _ = _post(f"{base}/translate", {"keys": {"a": "x"}},
                            {"Authorization": "Bearer s3cret"})
    assert status == 200
    status, body, _ = _post(f"{base}/translate",
                            {"keys": {str(i): "x" for i in range(501)}},
                            {"Authorization": "Bearer s3cret"})
    assert status == 413
    # health is open (load balancers) and models needs the token
    with urllib.request.urlopen(f"{base}/health") as r:
        assert json.loads(r.read())["status"] == "ok"


def test_serve_refuses_a_public_bind_without_a_token(tmp_path, monkeypatch):
    from nmt_forge.errors import ForgeError
    from nmt_forge.serve import build_server

    monkeypatch.delenv("NMT_FORGE_SERVE_TOKEN", raising=False)
    with pytest.raises(ForgeError, match="without a token"):
        build_server(tmp_path, host="0.0.0.0", port=0)



def test_two_runs_one_test_set_each_judged_against_its_own_prereg(
        tmp_path, capsys):
    """Round 5 school persona: a full model and a twin-free model trained
    against one fixed test set, one prereg each. Export judged the FULL
    model's run against the NEWER prediction (the twin-free model's) and
    wrote that verdict into DEPLOY.md; nothing let the user choose. Now an
    ambiguous binding is refused, --prereg names it, a re-export keeps the
    binding its first read made, and `prereg check` reads the export that
    was judged against THAT prereg."""
    ws_dir, cfg, manifest = _dummy_project(tmp_path, capsys, battery_ids=True)
    preds = tmp_path / "preds-b.json"
    preds.write_text(json.dumps([
        {"metric": "chrf++", "direction": "decrease", "baseline_score": 100.0,
         "rationale": "the twin-free model scores lower"}]))
    code, out, _ = _run(capsys, "--workspace", ws_dir, "prereg", "new",
                        "twin-free", "--eval-set", "battery", "--predictions",
                        str(preds), "--json")
    assert code == 0, out

    # ambiguous: refused BEFORE the test set is read (no score read spent)
    code, out, _ = _run(capsys, "--workspace", ws_dir, "export", manifest,
                        "--config", str(cfg), "--out",
                        str(tmp_path / "full"), "--no-model", "--json")
    assert code == 2
    err = json.loads(out)["error"]
    assert err["type"] == "PreregistrationAmbiguous"
    assert "bp, twin-free" in err["message"]
    assert "--prereg" in err["fix"] and 'prereg: "bp"' in err["fix"]
    from nmt_forge.workspace import Workspace
    ws = Workspace(ws_dir)
    assert not ws.ledger.find("read", set="battery", purpose="score")
    assert not (tmp_path / "full").exists()

    # the full model, judged against ITS prereg; the read records it
    code, out, err_txt = _run(capsys, "--workspace", ws_dir, "export",
                              manifest, "--config", str(cfg), "--out",
                              str(tmp_path / "full"), "--no-model",
                              "--prereg", "bp", "--json")
    assert code == 0, out + err_txt
    summary = json.loads(out)
    assert summary["prereg"]["id"] == "bp"
    assert summary["prereg"]["bound_by"] == "named with --prereg"
    reads = ws.ledger.find("read", set="battery", purpose="score")
    assert [r.get("prereg_id") for r in reads] == ["bp"]
    battery_md = (tmp_path / "full" / "evaluation" /
                  "battery-hyps-battery.md").read_text()
    assert "Judged against preregistration `bp` (named with --prereg)" \
        in battery_md

    # a re-export of the same run keeps the binding its first read made
    code, out, _ = _run(capsys, "--workspace", ws_dir, "export", manifest,
                        "--config", str(cfg), "--out",
                        str(tmp_path / "full2"), "--no-model", "--json")
    assert code == 0, out
    again = json.loads(out)["prereg"]
    assert again["id"] == "bp"
    assert again["bound_by"] == ("the prereg this run's first test read was "
                                 "admitted under")

    # a prereg that does not bind this run is refused by name
    code, out, _ = _run(capsys, "--workspace", ws_dir, "export", manifest,
                        "--config", str(cfg), "--out",
                        str(tmp_path / "full3"), "--no-model", "--prereg",
                        "nope", "--json")
    assert code == 2

    # `prereg check twin-free` without --results does NOT read the full
    # model's export (it was judged against bp)
    code, out, _ = _run(capsys, "--workspace", ws_dir, "prereg", "check",
                        "twin-free", "--json")
    assert code == 2
    assert "judged against another preregistration" in \
        json.loads(out)["error"]["message"]
    code, out, _ = _run(capsys, "--workspace", ws_dir, "prereg", "check",
                        "bp", "--json")
    assert code == 0, out
