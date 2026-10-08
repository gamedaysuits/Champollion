"""Round 13 synthetic personas (hospital: an Ayta phrasebook under the
private-use code qaa with a nurse-checked test set; school: a Cree phrasebook
with a teacher-reviewed test set), 2026-10-04.

11. The harness flagged the twin-free model's test output as near-constant
    (150 of 150 sources got one of 9 outputs; 196 of 200 one of 5) in the
    TestReport forge itself wrote — and the export summary, forge-model.json,
    both DEPLOY.md files, status, report, compare and lint left it out, while
    the all-data DEPLOY.md called that model's chrF++ "the number to quote
    for new sentences" and compare said it "measures translation of unseen
    sentences". forge now relays every harness ``score_caveats`` entry,
    verbatim, wherever it shows or recommends a score (``harness_caveats``).
14. The twin-free leak audit said "90 of the leaking rows are your
    registered dev set's own rows" for an 80-row dev set: 80 were, 10 were
    near-duplicates of their answers. The count is now split by kind.
15. forge discover's FST check is the harness's own (``config.fst_state``);
    it now names the Python it looked in.
17. ``get_training_guardrails`` is named once, before the split: in the
    step order (init, NEXT_STEPS.md, status "initialized") and in status's
    "no-dev-set" next command.
18. The export names the hypotheses file ``compare`` takes.

All text is invented tokens (quarantine-gate discipline); every corpus is
generated here. The HF weights copy and the decode are stood in for — the
subject is what forge says, not the weights.
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
import types
from pathlib import Path

import pytest

from nmt_forge.guards import preregister
from nmt_forge.workspace import Workspace
from tests.conftest import write_jsonl
from tests.test_private_text import _registered, _run

CONSTANT = "florpa zam quiv blee"        # one output for every input


def _project(tmp_path, capsys):
    """A workspace with the local-only 12-row test set, a dev set, two
    preregistrations and two dummy runs: ``all-data`` (every test row has a
    template twin in its training data) and ``notwins`` (none has)."""
    ws_dir, _, _ = _registered(tmp_path, capsys)
    ws = Workspace(ws_dir)
    dev = write_jsonl(tmp_path / "dev.jsonl", [
        {"source": f"the dax {i} sleeps now", "reference": f"daxko{i} pel sun"}
        for i in range(6)])
    ws.registry.register("toy-dev", dev, "dev")
    for pid in ("all-data", "notwins"):
        preregister.new(ws, prereg_id=pid, eval_set="project-test",
                        predictions=[{"metric": "chrf++", "expect": "low",
                                      "rationale": "dummy decode"}])
    plain = [{"source": f"the florp {i} sings", "target": f"florpa{i} zam"}
             for i in range(6)]
    # a template sibling of every test row (one word swapped each way)
    twins = [{"source": f"see the zorblat number {i} quickly",
              "target": f"zorbka{i} miv relquon tosp"} for i in range(12)]
    golds = {"all-data": write_jsonl(tmp_path / "all.jsonl", plain + twins),
             "notwins": write_jsonl(tmp_path / "notwins.jsonl", plain)}
    runs = {}
    for name, gold in golds.items():
        raw = {"run_name": name, "workspace": ws_dir,
               "language": {"source": "eng", "target": "qaa"},
               "data": {"gold": [str(gold)], "dev": "toy-dev"},
               "model": {"backend": "dummy"}, "selection": {"metric": "loss"},
               "decode": {"max_new_tokens": 32},
               "eval": {"battery": "project-test", "n_bootstrap": 40,
                        "near_dupe_corpus": str(gold)}}
        cfg = tmp_path / f"config-{name}.json"
        cfg.write_text(json.dumps(raw))
        code, out, err = _run(capsys, "--workspace", ws_dir, "run", str(cfg),
                              "--json")
        assert code == 0, err
        hf = tmp_path / f"config-{name}-hf.json"
        hf.write_text(json.dumps({**raw, "model": {
            "backend": "hf-seq2seq", "base": "fake/opus-mt-en-qaa"}}))
        runs[name] = {"manifest": json.loads(out)["manifest"], "cfg": hf}
    return ws_dir, runs


def _export(tmp_path, capsys, monkeypatch, ws_dir, run, name, *,
            constant: bool):
    """`nmt-forge export` of a dummy run with the model included (the HF
    copy stood in for); ``constant``: the decode gives ONE output for every
    test source — what the harness calls a near-constant output."""
    from nmt_forge import export as export_mod
    from nmt_forge.training import backends
    from nmt_forge.training import evaluate as evaluate_mod

    def fake_copy(src, dst, model_cfg):
        dst.mkdir(parents=True, exist_ok=True)
        for f in ("config.json", "generation_config.json", "tokenizer.json",
                  "tokenizer_config.json"):
            (dst / f).write_text(json.dumps({"fake": f}))
        (dst / "model.safetensors").write_bytes(b"\0" * 64)
        return {"lora_merged": False,
                "files": sorted(p.name for p in dst.iterdir())}

    class Constant(backends.DummyBackend):
        def decode(self, checkpoint, sources, params):
            return [CONSTANT] * len(sources)

    monkeypatch.setattr(export_mod, "_copy_model", fake_copy)
    monkeypatch.setattr(evaluate_mod, "make_backend",
                        lambda model_cfg: (Constant() if constant
                                           else backends.DummyBackend()))
    out = tmp_path / f"export-{name}"
    code, stdout, err = _run(capsys, "--workspace", ws_dir, "export",
                             run["manifest"], "--config", str(run["cfg"]),
                             "--prereg", name, "--out", str(out), "--json")
    assert code == 0, stdout + err
    return out, json.loads(stdout)


def _report_caveats(export_dir: Path) -> list:
    doc = json.loads((export_dir / "evaluation" / "runlog_report.json")
                     .read_text(encoding="utf-8"))
    return doc.get("score_caveats")


class _Cap:
    """capsys for a module-scoped build: main() prints into these buffers
    while the build runs inside ``redirect_stdout``/``redirect_stderr``."""

    def __init__(self):
        self.o, self.e = io.StringIO(), io.StringIO()

    def readouterr(self):
        out, err = self.o.getvalue(), self.e.getvalue()
        for b in (self.o, self.e):
            b.seek(0)
            b.truncate()
        return types.SimpleNamespace(out=out, err=err)


def _build(base: Path) -> dict:
    """The persona's order: the all-data model exported first, then the
    twin-free one — whose output is near-constant."""
    cap = _Cap()
    with pytest.MonkeyPatch.context() as mp, \
            contextlib.redirect_stdout(cap.o), \
            contextlib.redirect_stderr(cap.e):
        ws_dir, runs = _project(base, cap)
        all_dir, all_sum = _export(base, cap, mp, ws_dir, runs["all-data"],
                                   "all-data", constant=False)
        nt_dir, nt_sum = _export(base, cap, mp, ws_dir, runs["notwins"],
                                 "notwins", constant=True)
    return {"ws_dir": ws_dir, "runs": runs, "all": all_dir, "nt": nt_dir,
            "all_sum": all_sum, "nt_sum": nt_sum}


@pytest.fixture(scope="module")
def two_exports(tmp_path_factory):
    """Built once for the tests that only READ it."""
    return _build(tmp_path_factory.mktemp("round13"))


@pytest.fixture
def own_exports(tmp_path):
    """A build of its own, for a test that rewrites files in it."""
    return _build(tmp_path)


def _near_constant(caveats):
    return [c for c in caveats or [] if c.get("kind") == "near_constant_output"]


# -- 11. every forge surface relays the harness's caveats -----------------------

def test_the_harness_flags_the_constant_model_and_the_export_relays_it(
        two_exports):
    nt_dir, summary = two_exports["nt"], two_exports["nt_sum"]
    written = _report_caveats(nt_dir)
    flagged = _near_constant(written)
    assert flagged and flagged[0]["severity"] == "major"
    message = flagged[0]["message"]
    # the summary and forge-model.json carry the harness's list verbatim
    assert summary["score_caveats"] == written
    fm = json.loads((nt_dir / "model" / "forge-model.json").read_text())
    assert fm["test_report"]["score_caveats"] == written
    # DEPLOY.md: under the score, in the harness's words, and §5's test line
    # points at it
    deploy = (nt_dir / "model" / "DEPLOY.md").read_text()
    measured = deploy.split("## What was measured", 1)[1].split("## 1.", 1)[0]
    assert f"**⚠ SCORE CAVEAT (mt-eval-harness):** {message}" in measured
    test_line = next(l for l in deploy.splitlines()
                     if l.startswith("Test battery: "))
    assert test_line.endswith("before quoting it") and "SCORE CAVEAT" in \
        test_line
    # the battery report records the TestReport and its caveats
    battery = json.loads((nt_dir / "evaluation" /
                          "battery-hyps-battery.json").read_text())
    assert battery["harness_report"]["score_caveats"] == written
    assert battery["harness_report"]["path"] == "runlog_report.json"
    md = (nt_dir / "evaluation" / "battery-hyps-battery.md").read_text()
    assert "SCORE CAVEAT (mt-eval-harness)" in md
    assert "R9-harness-score-caveat" in md


def test_the_all_data_deploy_md_never_calls_the_flagged_score_the_number_to_quote_bare(
        two_exports):
    deploy = (two_exports["all"] / "model" / "DEPLOY.md").read_text()
    message = _near_constant(_report_caveats(two_exports["nt"]))[0]["message"]
    block = deploy.split("<!-- nmt-forge:twin-free -->", 1)[1].split(
        "<!-- /nmt-forge:twin-free -->", 1)[0]
    assert ("**The number to quote for new sentences — but read this caveat "
            "first:**") in block
    assert ("On that model's test output — **⚠ SCORE CAVEAT "
            f"(mt-eval-harness):** {message}") in block
    # the unqualified claim is gone where the caveat applies
    assert "measures how a model trained this way handles" not in block
    # the all-data forge-model.json advice cites the score WITH its caveat
    fm = json.loads((two_exports["all"] / "model" /
                     "forge-model.json").read_text())
    advice = fm["test_report"]["near_twin"]["advice"]
    assert "mt-eval qualifies its score" in advice and message in advice
    assert "WITH that caveat" in advice
    # and the twin-free export said where it was cited, with the caveat
    assert two_exports["nt_sum"]["cited_in"]


def test_cli_export_text_carries_the_caveat_and_the_hypotheses(
        two_exports, capsys):
    s = two_exports["nt_sum"]
    hyps = Path(s["hypotheses"])
    assert hyps.name == "battery-hyps.jsonl" and hyps.is_file()
    assert s["hypotheses"] in s["compare_hint"]
    assert "nmt-forge compare --eval-set project-test" in s["compare_hint"]


def test_status_lists_each_exports_caveats_and_qualifies_the_twin_free_advice(
        two_exports, capsys):
    code, out, _ = _run(capsys, "--workspace", two_exports["ws_dir"],
                        "status", "--json")
    assert code == 0
    advice = json.loads(out)["advice"]
    assert advice["state"] == "choose-export"
    by_run = {x["run"]: x for x in advice["exports"]}
    nt, alld = by_run["notwins"], by_run["all-data"]
    assert nt["score_caveats"] == _report_caveats(two_exports["nt"])
    assert nt["hypotheses"].endswith("battery-hyps.jsonl")
    # the sibling the all-data export pairs with carries its caveats
    sib = alld["twin_free_siblings"][0]
    assert _near_constant(sib["score_caveats"])
    assert "but mt-eval puts a SCORE CAVEAT on notwins's score" in \
        advice["why"]
    assert "⚠ SCORE CAVEAT (mt-eval-harness)" in advice["why"]


def test_report_relays_the_caveat_and_qualifies_the_number_to_quote(
        two_exports, capsys):
    msg = _near_constant(_report_caveats(two_exports["nt"]))[0]["message"]
    code, out, _ = _run(capsys, "--workspace", two_exports["ws_dir"],
                        "report", two_exports["runs"]["notwins"]["manifest"])
    assert code == 0
    assert f"- **⚠ SCORE CAVEAT (mt-eval-harness):** {msg}" in out
    code, out, _ = _run(capsys, "--workspace", two_exports["ws_dir"],
                        "report", two_exports["runs"]["all-data"]["manifest"])
    assert ("- the number to quote for new sentences — read this caveat "
            "first: twin-free model") in out
    assert f"  - on that model's test output: **⚠ SCORE CAVEAT " \
           f"(mt-eval-harness):** {msg}" in out


def test_lint_turns_a_major_harness_caveat_into_a_high_finding(
        two_exports, capsys):
    battery = two_exports["nt"] / "evaluation" / "battery-hyps-battery.json"
    code, out, _ = _run(capsys, "lint", str(battery), "--json")
    assert code == 0
    found = [f for f in json.loads(out)
             if f["rule"] == "R9-harness-score-caveat"]
    assert len(found) == 1 and found[0]["severity"] == "high"
    assert found[0]["evidence"]["kind"] == "near_constant_output"
    assert "message" not in found[0]["evidence"]
    # forge's own near-twin reading is R4's, never repeated as R9
    battery = two_exports["all"] / "evaluation" / "battery-hyps-battery.json"
    code, out, _ = _run(capsys, "lint", str(battery), "--json")
    rules = [f["rule"] for f in json.loads(out)]
    assert "R4-recall-not-translation" in rules
    assert "R9-harness-score-caveat" not in rules


def test_compare_never_says_unseen_translation_for_a_flagged_system(
        two_exports, capsys):
    ev = lambda d: str(d / "evaluation" / "battery-hyps.jsonl")  # noqa: E731
    code, out, err = _run(capsys, "--workspace", two_exports["ws_dir"],
                          "compare", "--eval-set", "project-test",
                          "--hyps-a", ev(two_exports["all"]),
                          "--hyps-b", ev(two_exports["nt"]),
                          "--label-a", "all-data", "--label-b", "notwins",
                          "--json")
    assert code == 0, err
    rep = json.loads(out)
    assert _near_constant(rep["score_caveats"]["notwins"])
    text = "\n".join(rep["caveats"])
    assert "notwins: no test row has a near-twin in notwins's training data" \
        " — its score is on unseen sentences, but mt-eval qualifies it" in text
    assert "measures translation of unseen sentences" not in text
    assert "notwins (mt-eval, on these outputs): ⚠ SCORE CAVEAT " \
           "(mt-eval-harness)" in text


def test_an_export_written_before_round_13_is_read_from_its_test_report(
        own_exports, capsys):
    """forge-model.json without score_caveats: status and report read the
    caveats the harness wrote into the TestReport all along; a TestReport
    without the key gets NO sentence — never "no caveats"."""
    fm_path = own_exports["nt"] / "model" / "forge-model.json"
    fm = json.loads(fm_path.read_text())
    del fm["test_report"]["score_caveats"]
    fm_path.write_text(json.dumps(fm))
    code, out, _ = _run(capsys, "--workspace", own_exports["ws_dir"],
                        "report", own_exports["runs"]["notwins"]["manifest"])
    assert "SCORE CAVEAT (mt-eval-harness)" in out
    # an older harness: no score_caveats key at all → nothing is said
    rp = own_exports["nt"] / "evaluation" / "runlog_report.json"
    doc = json.loads(rp.read_text())
    del doc["score_caveats"]
    rp.write_text(json.dumps(doc))
    code, out, _ = _run(capsys, "--workspace", own_exports["ws_dir"],
                        "report", own_exports["runs"]["notwins"]["manifest"])
    section = out.split("## Test results", 1)[1]
    assert "SCORE CAVEAT" not in section and "score note" not in section
    assert "caveats" not in section.lower().replace("caveat:", "")
    code, out, _ = _run(capsys, "--workspace", own_exports["ws_dir"],
                        "status", "--json")
    nt = next(x for x in json.loads(out)["advice"]["exports"]
              if x["run"] == "notwins")
    assert nt["score_caveats"] is None


def test_lint_reads_an_older_battery_manifests_test_report_beside_it(
        own_exports, capsys):
    ev = own_exports["nt"] / "evaluation"
    battery = json.loads((ev / "battery-hyps-battery.json").read_text())
    del battery["harness_report"]           # written before Round 13
    old = ev / "battery-hyps-battery.json"
    old.write_text(json.dumps(battery))
    code, out, _ = _run(capsys, "lint", str(old), "--json")
    assert any(f["rule"] == "R9-harness-score-caveat"
               for f in json.loads(out))
    # a TestReport of OTHER outputs beside it is never borrowed
    hyps = ev / "battery-hyps.jsonl"
    rows = [json.loads(l) for l in hyps.read_text().splitlines()]
    hyps.write_text("".join(json.dumps({**r, "predicted": f"x{i}"}) + "\n"
                            for i, r in enumerate(rows)))
    code, out, _ = _run(capsys, "lint", str(old), "--json")
    assert not any(f["rule"] == "R9-harness-score-caveat"
                   for f in json.loads(out))


def test_a_rewritten_older_deploy_md_gains_its_own_caveats():
    """A DEPLOY.md written before the score-caveats block: forge's next
    rewrite (a twin-free citation, a prereg verdict) inserts the export's
    own caveats under its score, and §5 points at a major one."""
    from nmt_forge.export import refresh_score_caveats

    doc = ("# Deploying `m`\n\n## What was measured — read this first\n\n"
           "Test set `t` (n=3): chrf++ 1.00 [0.00, 2.00] 95% CI.\n\n"
           "**All 3 test rows have a twin.**\n\n"
           "<!-- nmt-forge:twin-free -->\nquote x\n"
           "<!-- /nmt-forge:twin-free -->\n\n## 1. Serve it\n\n"
           "## 5. What this model is\n\n"
           "Test battery: `t` (n=3) — all: chrf++ 1.00\n")
    cav = [{"kind": "near_constant_output", "source": "mt-eval-harness",
            "severity": "major", "message": "3 of 3 sources share an output"}]
    new = refresh_score_caveats(doc, cav,
                                {"message": "all 3 test rows have a twin"})
    measured = new.split("## 1.", 1)[0]
    i_twin = measured.index("**All 3 test rows have a twin.**")
    i_cav = measured.index("<!-- nmt-forge:score-caveats -->")
    assert i_twin < i_cav < measured.index("<!-- nmt-forge:twin-free -->")
    assert ("**⚠ SCORE CAVEAT (mt-eval-harness):** 3 of 3 sources share an "
            "output.") in measured
    assert new.rstrip().endswith("before quoting it")
    # idempotent, and nothing to say → no block, no change
    assert refresh_score_caveats(new, cav, None) == new
    assert refresh_score_caveats(doc, None, None) == doc


# -- 14. the dev rows of a leak audit, exactly ----------------------------------

def _dev_audit_project(tmp_path):
    """6 registered dev rows; a corpus holding them, one repeat of dev row 0,
    two near-duplicates of dev answers (each contains one) and 30 ordinary
    rows; an unrelated registered test set."""
    ws = Workspace(tmp_path / ".forge")
    dev_rows = [{"source": f"the dax {i} sleeps now",
                 "target": f"daxko{i} pel sun rin"} for i in range(6)]
    ws.registry.register("p-dev", write_jsonl(tmp_path / "dev.jsonl",
                                              dev_rows), "dev")
    ws.registry.register("p-test", write_jsonl(tmp_path / "test.jsonl", [
        {"source": f"a wug {i} hops far", "target": f"wugka{i} tel mon"}
        for i in range(8)]), "test")
    corpus = (dev_rows + [dict(dev_rows[0])]
              + [{"source": "a near row one", "target": "daxko1 pel sun rin tom"},
                 {"source": "a near row two", "target": "daxko2 pel sun rin bek"}]
              + [{"source": f"the florp {i} sings loudly",
                  "target": f"florpa{i} zam quiv"} for i in range(30)])
    return ws, write_jsonl(tmp_path / "corpus.jsonl", corpus)


def test_the_audit_counts_dev_copies_and_near_duplicates_apart(tmp_path,
                                                               capsys):
    ws, corpus = _dev_audit_project(tmp_path)
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "leak-audit",
                        str(corpus), "--json")
    assert code == 0
    doc = json.loads(out)
    v = doc["verdict"]
    assert v["numbers"]["dev_set_leaking_rows"] == 9
    assert v["numbers"]["dev_set_rows_among_them"] == 7      # copies
    assert v["numbers"]["dev_set_near_duplicates_among_them"] == 2
    assert v["numbers"]["dev_set_rows_registered"] == 6
    st = doc["per_set"]["p-dev"]
    assert (st["dropped_rows"], st["copy_rows"], st["copied_eval_rows"],
            st["near_dupe_rows"]) == (9, 7, 6, 2)
    assert ("9 of them matching your registered dev set (6 rows): 7 copies "
            "of its own rows (6 the rows themselves, 1 duplicate) and 2 "
            "near-duplicates of its answers") in v["summary"]
    assert "9 of them your registered dev set's own rows" not in v["summary"]

    clean = tmp_path / "corpus.notwins.jsonl"
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "leak-audit",
                        str(corpus), "--clean-to", str(clean),
                        "--drop-test-twins", "--json")
    assert code == 0
    summary = json.loads(out)["verdict"]["summary"]
    assert ("9 of the leaking rows match your registered dev set (6 rows): "
            "7 are copies of its own rows (6 the rows themselves, 1 "
            "duplicate) and 2 are near-duplicates of its answers") in summary
    assert "The twin-free model keeps that dev set" in summary


def test_dev_copies_alone_keep_the_short_wording(tmp_path, capsys):
    ws, _ = _dev_audit_project(tmp_path)
    dev = [json.loads(l) for l in (tmp_path / "dev.jsonl").read_text()
           .splitlines()]
    corpus = write_jsonl(tmp_path / "only.jsonl", dev + [
        {"source": f"the florp {i} sings loudly", "target": f"florpa{i} zam"}
        for i in range(20)])
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "leak-audit",
                        str(corpus), "--json")
    v = json.loads(out)["verdict"]
    assert "6 of them your registered dev set's own rows" in v["summary"]
    assert v["numbers"]["dev_set_near_duplicates_among_them"] == 0


# -- 15. the FST check is the harness's, and says where it looked --------------

def test_discover_fst_check_is_the_harness_one_and_names_the_python(
        monkeypatch):
    from mt_eval_harness import config as hconfig

    from nmt_forge import cards

    calls = []
    monkeypatch.setattr(hconfig, "fst_state", lambda code: calls.append(code)
                        or {"ready": False, "missing": ["the FST runtime "
                                                        "(pyhfst)"],
                            "setup_command": "mt-eval setup --lang crk"})
    st = cards.fst_status("crk")
    assert calls == ["crk"]
    assert st["checked_in"] == sys.executable
    assert st["missing"] == ["the FST runtime (pyhfst)"]
    # forge has no pyhfst probe of its own
    src = Path(cards.__file__).parent
    for f in src.rglob("*.py"):
        text = f.read_text(encoding="utf-8")
        assert "import pyhfst" not in text and '"pyhfst")' not in text, f


# -- 17. the guardrails, once, before the split ---------------------------------

def test_init_order_and_status_name_the_guardrails_before_the_split(
        tmp_path, ws):
    from nmt_forge.advisor import next_action
    from nmt_forge.scaffold import GUARDRAILS_PAGE, init_project, step_order

    r = init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    steps = [s["step"] for s in r["order"]]
    assert steps.index("guardrails") == steps.index("split") - 1
    g = r["order"][steps.index("guardrails")]
    assert g["tool"] == "get_training_guardrails" and g["command"] is None
    assert GUARDRAILS_PAGE in g["read"]
    assert r["order"] == step_order()
    assert "get_training_guardrails" in r["note"]
    md = (tmp_path / "proj" / "NEXT_STEPS.md").read_text()
    assert "**guardrails** — read the training guardrails before splitting" \
        in md

    # status names it in the state whose next command IS the split …
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", [
        {"source": f"x {i} y z", "target": f"q {i} r s"} for i in range(4)]),
        "test")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set":
                                                       "toy-test"}))
    a = next_action(ws)
    assert a.state == "no-dev-set"
    assert a.command.startswith("nmt-forge split ")
    assert "get_training_guardrails (MCP) or " + GUARDRAILS_PAGE in a.command
    assert "get_training_guardrails" in a.why
    # … and not again once the dev set exists
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", [
        {"source": f"d {i} e f", "target": f"g {i} h k"} for i in range(4)]),
        "dev")
    a = next_action(ws)
    assert "get_training_guardrails" not in a.command + a.why
