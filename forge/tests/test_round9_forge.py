"""Round 9 synthetic personas (school: eng→crk, a teacher-checked test set,
an all-data and a twin-free model; hospital: a nurse-checked local-only test
set), 2026-10-04.

1. The guide put baselines before the preregistration, so forge refused the
   predictions ("already read for scoring … before this preregistration").
   status now names the prereg as soon as a test set is registered — before
   the dev split — and an audit read (leak-audit) never blocks it.
2. A prereg written after scoring reads (--allow-after-reads) showed in
   `ledger show` only. The report, DEPLOY.md, the export summary, `prereg
   check` and status now say "written AFTER N scoring read(s)".
3. `compare` said "winner=all-data" with every test row twinned in
   all-data's training data. It now carries each system's near-twin reading
   (export's own, or the run's training files) and says a recall win is one.
4. After `leak-audit --drop-test-twins` both personas hand-wrote the second
   config: forge writes config-notwins.json (never overwriting) and names
   the command that trains it.
5. status said `warnings: []` right after a SEVERE audit: the verdict is
   ledgered and status carries it, with the two-model decision.
6. NEXT_STEPS / discover ticked rung 4 (analyzer → verified synthesis) with
   the crk FST not installed: exists ≠ usable here.
9. The Trainer's "missing keys" notice for tied/recomputed weights is held
   and replaced by forge's checked one-liner; anything unexplained is
   released.

All text is invented tokens (quarantine-gate discipline).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from nmt_forge.advisor import next_action, render_status, snapshot
from nmt_forge.guards import preregister
from nmt_forge.workspace import Workspace
from tests.conftest import write_jsonl
from tests.test_cards import fixture_cards  # noqa: F401 — a fixture
from tests.test_cli import _twinned_project
from tests.test_private_text import _dummy_run, _registered, _run
from tests.test_round7_forge import _harness_read

PRED = [{"metric": "chrf++", "expect": "low", "rationale": "dummy decode"}]


def _preds(tmp_path, name="predictions.json"):
    p = tmp_path / name
    p.write_text(json.dumps(PRED))
    return p


# -- 1. the prereg comes before any benchmark --------------------------------

def test_registering_a_test_set_makes_the_prereg_the_next_step(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    a = next_action(Workspace(ws_dir))
    assert a.state == "missing-preregistration"
    assert "nmt-forge prereg new <id> --eval-set hosp-test" in a.command
    assert "before any benchmark" in a.why


def test_a_leak_audit_is_not_a_scoring_read(tmp_path, capsys):
    """register → leak-audit → prereg: the audit reads the test set (purpose
    audit), and the preregistration after it is accepted with no override."""
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), "--json")
    assert code == 0, err
    assert json.loads(out)["preregistration_needed"] == ["hosp-test"]
    ws = Workspace(ws_dir)
    assert ws.ledger.find("read", set="hosp-test", purpose="audit")
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "new",
                          "all-data", "--eval-set", "hosp-test",
                          "--predictions", str(_preds(tmp_path)), "--json")
    assert code == 0, err
    payload = json.loads(out)
    assert payload["after_reads"] is None
    assert preregister.after_reads_info(ws, "all-data") is None


def test_the_audit_names_the_prereg_before_its_own_next_line(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    code, text, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                         str(corpus), "--no-examples")
    lines = text.splitlines()
    assert lines[-1].startswith("Next: nmt-forge leak-audit")  # its own fix
    note = next(l for l in lines if l.startswith("next: write the "
                                                 "preregistration"))
    assert "hosp-test BEFORE any benchmark" in note
    assert "never block a preregistration" in note


# -- 2. an override is said wherever the verdict is ---------------------------

def test_a_prereg_after_reads_is_disclosed_everywhere(tmp_path, capsys):
    ws_dir, tsv, entry = _registered(tmp_path, capsys)
    ws = Workspace(ws_dir)
    _harness_read(tsv, entry["sha256"], run_id="baseline-1")
    _harness_read(tsv, entry["sha256"], run_id="baseline-2")
    # without the override: refused (the founder's rule stands)
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "new", "p0",
                          "--eval-set", "project-test", "--predictions",
                          str(_preds(tmp_path)), "--json")
    assert code == 2 and "already read for scoring" in out
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "new",
                          "late", "--eval-set", "project-test",
                          "--predictions", str(_preds(tmp_path)),
                          "--allow-after-reads", "--json")
    assert code == 0, err
    after = json.loads(out)["after_reads"]
    assert after["reads"] == 2 and after["mt_eval_reads"] == 2
    assert "written AFTER 2 scoring read(s)" in after["text"]
    assert "--allow-after-reads" in after["text"]

    # status: the prereg line and a standing warning
    s = snapshot(ws)
    assert next(p for p in s["preregs"] if p["id"] == "late")["after_reads"]
    a = next_action(ws)
    assert any("written AFTER 2 scoring read(s)" in w for w in a.warnings)
    assert "⚠ written after 2 scoring read(s)" in render_status(ws)

    # a run judged against it, exported: summary, DEPLOY.md, report, check
    dev = write_jsonl(tmp_path / "dev.jsonl", [
        {"source": f"the dax {i} sleeps now", "reference": f"daxko{i} pel sun"}
        for i in range(6)])
    ws.registry.register("toy-dev", dev, "dev")
    gold = write_jsonl(tmp_path / "gold.jsonl", [
        {"source": f"the florp {i} sings", "target": f"florpa{i} zam"}
        for i in range(6)])
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({
        "run_name": "late-run", "workspace": ws_dir,
        "language": {"source": "eng", "target": "qaa"},
        "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "model": {"backend": "dummy"}, "selection": {"metric": "loss"},
        "decode": {"max_new_tokens": 32},
        "eval": {"battery": "project-test", "n_bootstrap": 40,
                 "near_dupe_corpus": str(gold)}}))
    code, out, err = _run(capsys, "--workspace", ws_dir, "run", str(cfg),
                          "--json")
    assert code == 0, err
    manifest = json.loads(out)["manifest"]
    exp = tmp_path / "exp"
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--out", str(exp), "--no-model", "--json")
    assert code == 0, err
    summary = json.loads(out)
    assert summary["prereg"]["after_reads"]["reads"] == 2
    code, text, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                           "--out", str(tmp_path / "exp2"), "--no-model")
    assert "⚠ preregistration late was written AFTER 2 scoring read(s)" in text
    code, out, err = _run(capsys, "--workspace", ws_dir, "report", manifest)
    assert "**not blind:**" in out and "written AFTER 2" in out
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "check",
                          "late")
    assert code == 0, err
    assert "⚠ preregistration late was written AFTER 2 scoring read(s)" in out


def test_deploy_md_prereg_block_says_not_blind(tmp_path):
    from nmt_forge.export import _prereg_paragraph

    text = _prereg_paragraph(
        {"id": "late", "bound_by": "the only one", "verdicts": [],
         "after_reads": {"reads": 3, "text": "preregistration late was "
                         "written AFTER 3 scoring read(s) of 'x' (3× by "
                         "mt-eval), under the --allow-after-reads override — "
                         "its predictions are not blind: whoever wrote them "
                         "may have seen those scores"}}, tmp_path)
    assert "**Not blind predictions:** Preregistration late was written AFTER" in text
    assert "not as predictions that came first" in text
    assert "Not blind" not in _prereg_paragraph(
        {"id": "p", "bound_by": "x", "verdicts": []}, tmp_path)


def test_ledger_rows_from_before_the_count_still_report_it(ws, test_set):
    """An older ledger has `after_reads_override` without the count: the
    forge reads before the prereg event are counted from the chain."""
    ws.ledger.append("read", set="toy-test", role="test", purpose="score",
                     config_hash=None, sha256="x")
    ws.ledger.append("prereg", prereg_id="old", set="toy-test", sha256="x",
                     config_hash=None, after_reads_override=True)
    info = preregister.after_reads_info(ws, "old")
    assert info["reads"] == 1 and info["forge_reads"] == 1
    assert "1× by nmt-forge" in info["text"]


# -- 3. compare says a recall win is one ---------------------------------------

def _compare_project(tmp_path, capsys):
    """A fixed test set; an all-data run whose training file twins every
    test row, and a twin-free run whose training file twins none."""
    ws_dir, corpus = _twinned_project(tmp_path, capsys, leaks=0)
    ws = Workspace(ws_dir)
    preregister.new(ws, prereg_id="p1", eval_set="hosp-test",
                    predictions=PRED)
    all_data = corpus
    free = write_jsonl(tmp_path / "free.jsonl", [
        {"source": f"take pill number {i} with water",
         "target": f"pil{i} wa ta"} for i in range(60)])

    def manifest(name, train):
        d = ws.runs_dir / name
        d.mkdir(parents=True)
        (d / "run-manifest.json").write_text(json.dumps({
            "run_name": name, "config_hash": name, "selected_checkpoint": "c",
            "config": {"data": {"gold": [str(train)], "dev": "d"},
                       "eval": {"battery": "hosp-test",
                                "near_dupe_corpus": str(train)}}}))
        return d / "run-manifest.json"

    rows = [json.loads(l) for l in (tmp_path / "test.jsonl").read_text()
            .splitlines()]
    good = tmp_path / "hyps-all.txt"
    good.write_text("\n".join(r["target"] for r in rows) + "\n")
    bad = tmp_path / "hyps-free.txt"
    bad.write_text("\n".join("zzz" for _ in rows) + "\n")
    return ws_dir, manifest("all-data", all_data), manifest("twin-free", free), \
        good, bad


def test_compare_says_a_win_on_recall_is_one(tmp_path, capsys):
    ws_dir, run_all, run_free, good, bad = _compare_project(tmp_path, capsys)
    code, out, err = _run(capsys, "--workspace", ws_dir, "compare",
                          "--eval-set", "hosp-test",
                          "--hyps-a", str(bad), "--hyps-b", str(good),
                          "--label-a", "twin-free", "--label-b", "all-data",
                          "--run-a", str(run_free), "--run-b", str(run_all),
                          "--json")
    assert code == 0, err
    r = json.loads(out)
    assert r["results"]["chrf++"]["winner"] == "all-data"
    assert r["near_twin"]["all-data"]["recall_not_translation"] is True
    assert r["near_twin"]["all-data"]["near_twin_rows"] == 20
    assert r["near_twin"]["twin-free"]["near_twin_rows"] == 0
    caveats = "\n".join(r["caveats"])
    assert "all-data: 20 of 20 test rows (100%) have a near-twin" in caveats
    assert "measures recall of training phrases, not translation" in caveats
    assert "winner=all-data on chrf++ is NOT evidence" in caveats
    assert "twin-free: no test row has a near-twin" in caveats
    # the human rendering carries them under the result
    code, text, err = _run(capsys, "--workspace", ws_dir, "compare",
                           "--eval-set", "hosp-test",
                           "--hyps-a", str(bad), "--hyps-b", str(good),
                           "--label-a", "twin-free", "--label-b", "all-data",
                           "--run-a", str(run_free), "--run-b", str(run_all))
    lines = text.splitlines()
    assert any("winner=all-data" in l for l in lines[:3])
    assert any(l.strip().startswith("⚠ winner=all-data on chrf++ is NOT")
               for l in lines)


def test_compare_without_a_run_or_export_says_it_did_not_check(tmp_path, capsys):
    ws_dir, run_all, run_free, good, bad = _compare_project(tmp_path, capsys)
    code, out, err = _run(capsys, "--workspace", ws_dir, "compare",
                          "--eval-set", "hosp-test",
                          "--hyps-a", str(bad), "--hyps-b", str(good),
                          "--json")
    assert code == 0, err
    r = json.loads(out)
    assert r["near_twin"]["A"] == {"checked": False, "known": False}
    assert any("near-twins not checked" in c and "--run-b" in c
               for c in r["caveats"])


def test_compare_reads_an_exports_own_reading_for_its_hypotheses(tmp_path,
                                                                 capsys):
    """Hypotheses an export wrote are matched to that export: its
    forge-model.json near-twin reading (the one DEPLOY.md prints) is used."""
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    exp = tmp_path / "exp"
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--out", str(exp), "--no-model", "--json")
    assert code == 0, err
    hyps = exp / "evaluation" / "battery-hyps.jsonl"
    code, out, err = _run(capsys, "--workspace", ws_dir, "compare",
                          "--eval-set", "project-test",
                          "--hyps-a", str(hyps), "--hyps-b", str(hyps),
                          "--json")
    assert code == 0, err
    r = json.loads(out)
    assert r["near_twin"]["A"]["checked"] is True
    assert r["near_twin"]["A"]["source"].startswith("export ")


# -- 4 + 5. the twin-free model's config, and status carries the verdict --------

def _project_config(tmp_path, ws_dir, *, dev="project-dev"):
    cfg = {"run_name": "crk-nmt-cpu-tiny", "workspace": ".forge",
           "language": {"source": "eng", "target": "crk"},
           "data": {"gold": ["data/split/train.jsonl"], "dev": dev,
                    "synthetic": []},
           "model": {"backend": "dummy"}, "selection": {"metric": "loss"},
           "decode": {"max_new_tokens": 32},
           "eval": {"battery": "hosp-test",
                    "near_dupe_corpus": "data/split/train.jsonl"}}
    (tmp_path / "config.json").write_text(json.dumps(cfg))
    return cfg


def test_status_carries_a_severe_audit_verdict_and_the_decision(tmp_path,
                                                                capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), "--json")
    assert json.loads(out)["verdict"]["severity"] == "severe"
    code, out, err = _run(capsys, "--workspace", ws_dir, "status", "--json")
    warnings = json.loads(out)["advice"]["warnings"]
    severe = [w for w in warnings if "SEVERE for hosp-test" in w]
    assert severe, warnings
    assert "20 of 20 test rows have a near-twin" in severe[0]
    assert "Choosing between the two models" in severe[0]
    assert "--drop-test-twins" in severe[0]
    assert "before any benchmark" in severe[0]
    s = json.loads(out)["snapshot"]["leak_audits"]["hosp-test"]
    assert s["severe"] and s["twin_free"] is None


def test_drop_test_twins_writes_the_twin_free_models_config(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    ws = Workspace(ws_dir)
    dev = write_jsonl(tmp_path / "dev.jsonl", [
        {"source": f"the dax {i} sleeps now", "target": f"daxko{i} pel sun"}
        for i in range(6)])
    ws.registry.register("project-dev", dev, "dev")
    base = _project_config(tmp_path, ws_dir)
    clean = tmp_path / "corpus.notwins.jsonl"
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), "--clean-to", str(clean),
                          "--drop-test-twins", "--json")
    assert code == 0, err
    c = json.loads(out)["companion_config"]
    target = tmp_path / "config-notwins.json"
    assert c["written"] is True
    assert Path(c["path"]).resolve() == target.resolve()
    assert c["run_name"] == "crk-nmt-cpu-tiny-notwins"
    assert c["gold"] == "corpus.notwins.jsonl" and c["dev_registered"] is True
    assert c["next"] == ("nmt-forge preflight run --config "
                         "config-notwins.json && nmt-forge run "
                         "config-notwins.json")
    written = json.loads(target.read_text())
    assert written["run_name"] == "crk-nmt-cpu-tiny-notwins"
    assert written["data"]["gold"] == ["corpus.notwins.jsonl"]
    assert written["data"]["dev"] == "project-dev"
    assert written["eval"]["near_dupe_corpus"] == "corpus.notwins.jsonl"
    assert written["model"] == base["model"]          # the same model
    from nmt_forge.training.config import RunConfig

    RunConfig.from_file(target)                        # a valid config

    # status: the twin-free corpus is there, its model is not trained yet
    a = next_action(ws)
    tw = [w for w in a.warnings if w.startswith("twin-free corpus for "
                                                "hosp-test")]
    assert tw and "nmt-forge run config-notwins.json" in tw[0]
    assert not any("SEVERE" in w for w in a.warnings)

    # never overwritten: a second run says it exists and leaves it alone
    target.write_text(json.dumps({**written, "run_name": "mine"}))
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), "--clean-to", str(clean),
                          "--drop-test-twins", "--json")
    c = json.loads(out)["companion_config"]
    assert c["written"] is False and "left as it is" in c["note"]
    assert json.loads(target.read_text())["run_name"] == "mine"
    # the human rendering prints what to run next
    target.unlink()
    code, text, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                           str(corpus), "--clean-to", str(clean),
                           "--drop-test-twins", "--no-examples")
    assert "companion config: wrote" in text
    assert ("NEXT (the twin-free model): nmt-forge preflight run --config "
            "config-notwins.json && nmt-forge run config-notwins.json") in text


def test_companion_config_before_the_dev_set_says_to_carve_it_first(tmp_path,
                                                                     capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    _project_config(tmp_path, ws_dir)
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), "--clean-to",
                          str(tmp_path / "free.jsonl"), "--drop-test-twins",
                          "--companion-config",
                          str(tmp_path / "cfg-free.json"), "--json")
    assert code == 0, err
    c = json.loads(out)["companion_config"]
    assert c["written"] is True and c["path"].endswith("cfg-free.json")
    assert c["dev_registered"] is False and c["next"] is None
    assert "carve the dev set first" in c["note"]


def test_companion_config_needs_drop_test_twins(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), "--companion-config", "x.json",
                          "--json")
    assert code == 2
    assert "only --drop-test-twins writes" in json.loads(out)["error"]["text"]


def test_without_a_project_config_it_says_what_to_write(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), "--clean-to",
                          str(tmp_path / "free.jsonl"), "--drop-test-twins",
                          "--json")
    c = json.loads(out)["companion_config"]
    assert c["path"] is None and c["written"] is False
    assert "no config.json beside the workspace" in c["note"]
    assert not (tmp_path / "config-notwins.json").exists()


# -- 6. exists is not usable here ------------------------------------------------

def _report_with_analyzer(fst):
    from nmt_forge.cards import ResourceReport

    r = ResourceReport(code="crk", name="Plains Cree", card_path="x")
    r.analyzers = [{"name": "GiellaLT crk", "type": "morphological-analyzer"}]
    r.fst = fst
    return r


def test_rung_4_is_ticked_only_when_the_fst_is_usable_here():
    missing = _report_with_analyzer({
        "ready": False, "setup_command": "mt-eval setup --lang crk",
        "missing": ["the FST runtime (pyhfst)",
                    "the Plains Cree FST analyzer"]})
    attained, text = {n: (a, t) for n, a, t in missing.ladder()}[4]
    assert attained is False
    assert "EXISTS (the card lists GiellaLT crk) but is NOT usable here" in text
    assert "`mt-eval setup --lang crk` installs them" in text

    ready = _report_with_analyzer({"ready": True, "missing": []})
    attained, text = {n: (a, t) for n, a, t in ready.ladder()}[4]
    assert attained is True and "installed here" in text

    unknown = _report_with_analyzer(None)
    attained, text = {n: (a, t) for n, a, t in unknown.ladder()}[4]
    assert attained is False and "usable here is NOT confirmed" in text


def test_next_steps_marks_an_uninstalled_fst_as_not_attained():
    from nmt_forge.scaffold import next_steps, starter_config

    r = _report_with_analyzer({
        "ready": False, "setup_command": "mt-eval setup --lang crk",
        "missing": ["the Plains Cree FST analyzer"]})
    md = next_steps(r, starter_config(r))
    # the brief's own ladder (the discover report it quotes says ✗ too)
    line = next(l for l in md.splitlines() if l.startswith("- ")
                and "rung 4" in l)
    assert line.startswith("- — rung 4") and "mt-eval setup --lang crk" in line
    assert "  ✗ rung 4" in md and "✓ rung 4" not in md


def test_discover_reads_fst_usability_from_the_harness(monkeypatch,
                                                      fixture_cards):
    from nmt_forge import cards

    seen = []
    monkeypatch.setattr(cards, "fst_status",
                        lambda code: seen.append(code) or {"ready": True,
                                                           "missing": []})
    r = cards.discover("qaa", cards_path=fixture_cards, check_registry=False)
    assert seen == ["qaa"] and r.fst == {"ready": True, "missing": []}
    assert {n: a for n, a, _ in r.ladder()}[4] is True
    assert "installed here: yes" in cards.format_report(r)
    # a card with no analyzer: nothing to check, rung 4 stays unknown
    seen.clear()
    r = cards.discover("qab", cards_path=fixture_cards, check_registry=False)
    assert seen == [] and {n: a for n, a, _ in r.ladder()}[4] is None


# -- 9. the transformers "missing keys" notice ----------------------------------

def _record(msg):
    return logging.LogRecord("transformers.trainer", logging.WARNING, __file__,
                             1, msg, None, None)


def test_the_missing_keys_notice_is_held_and_replaced_when_explained():
    from nmt_forge.training.backends import MissingKeysNotice

    logger = logging.getLogger("transformers.trainer")
    seen: list[str] = []

    class Catch(logging.Handler):
        def emit(self, record):
            seen.append(record.getMessage())

    h = Catch()
    logger.addHandler(h)
    try:
        with MissingKeysNotice() as notice:
            logger.warning("There were missing keys in the checkpoint model "
                           "loaded: ['lm_head.weight'].")
            logger.warning("some other trainer warning")
        assert seen == ["some other trainer warning"]     # only that one held
        assert notice.settle({"ok": True}) == []           # explained: dropped
        assert seen == ["some other trainer warning"]

        with MissingKeysNotice() as notice:
            logger.warning("There were missing keys in the checkpoint model "
                           "loaded: ['model.other.weight'].")
        released = notice.settle({"ok": False})            # unexplained
        assert len(released) == 1
        assert seen[-1].startswith("There were missing keys")
        with MissingKeysNotice() as notice:
            logger.warning("There were missing keys in the checkpoint model "
                           "loaded: ['x'].")
        notice.settle(None)                                # nothing checked
        assert seen[-1].startswith("There were missing keys")
    finally:
        logger.removeHandler(h)
    assert not logger.filters                              # filter removed


def test_after_the_prereg_the_split_carves_the_file_leak_audit_cleaned(
        tmp_path, capsys):
    """register → leak-audit --clean-to → prereg: status then names the
    split of the cleaned file — never the raw corpus."""
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    clean = tmp_path / "corpus.clean.jsonl"
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), "--clean-to", str(clean), "--json")
    assert code == 0, err
    ws = Workspace(ws_dir)
    assert next_action(ws).state == "missing-preregistration"
    preregister.new(ws, prereg_id="all-data", eval_set="hosp-test",
                    predictions=PRED)
    a = next_action(ws)
    assert a.state == "no-dev-set"
    assert "nmt-forge split corpus.clean.jsonl --test 0" in a.command


def test_initialized_own_test_chain_stops_at_the_audit(tmp_path):
    from nmt_forge.scaffold import init_project

    init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    a = next_action(Workspace(tmp_path / "proj" / ".forge"))
    own = a.command.split("   # OR, with no test set of your own: ")[0]
    run_part, comment = own.split("   # ", 1)
    assert run_part.endswith("--clean-to corpus.clean.jsonl")
    assert "split" not in run_part                # the prereg comes first
    assert comment.startswith("then the predictions")
    assert "BEFORE any benchmark" in comment
