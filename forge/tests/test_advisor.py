"""advisor — stateful next-action driver + preflight gates."""
import json

import pytest

from nmt_forge.advisor import next_action, preflight, render_status, snapshot
from nmt_forge.workspace import Workspace


def write_jsonl(path, rows):
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    return path


@pytest.fixture
def ws(tmp_path):
    return Workspace(tmp_path / ".forge")


def _rows(tag):
    return [{"source": f"{tag} sentence number {i} here",
             "reference": f"{tag} target line {i} words"} for i in range(4)]


def test_empty_workspace_advises_discover(ws):
    a = next_action(ws)
    assert a.state == "empty-workspace"
    assert "discover" in a.command


def test_a_registered_test_set_asks_for_the_prereg_before_the_dev_split(ws, tmp_path):
    # Round 9: the predictions come BEFORE any benchmark of the test set —
    # and a benchmark can follow registration at once — so the prereg is the
    # next step as soon as a test set exists, even before the dev split
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    a = next_action(ws)
    assert a.state == "missing-preregistration"
    assert "prereg new <id> --eval-set toy-test" in a.command
    assert "before any benchmark" in a.why
    assert "leak-audit" in a.why and "one preregistration per model" in a.why
    assert any("no dev set registered yet" in b and "split" in b
               for b in a.blockers)


def test_no_dev_advises_split(ws, tmp_path):
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set": "toy-test"}))
    a = next_action(ws)
    assert a.state == "no-dev-set"
    assert "split" in a.command and "--test 0" in a.command
    assert any("dev" in b for b in a.blockers)


def test_missing_prereg_advises_prereg(ws, tmp_path):
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", _rows("d")), "dev")
    a = next_action(ws)
    assert a.state == "missing-preregistration"
    # the EXACT, runnable command: template first, then the real flag names
    # (`--eval` only ever worked through argparse abbreviation)
    assert "prereg template --out predictions.json" in a.command
    assert "prereg new <id> --eval-set toy-test" in a.command
    assert "--predictions predictions.json" in a.command


def test_prereg_present_advises_run(ws, tmp_path):
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", _rows("d")), "dev")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set": "toy-test"}))
    a = next_action(ws)
    assert a.state == "ready-to-train"
    assert "nmt-forge preflight run" in a.command
    assert "nmt-forge run config.json" in a.command


def test_run_present_advises_score(ws, tmp_path):
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", _rows("d")), "dev")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set": "toy-test"}))
    run_dir = ws.runs_dir / "r1"
    run_dir.mkdir()
    (run_dir / "manifest.json").write_text(json.dumps(
        {"run_name": "r1", "config_hash": "abc",
         "selected_checkpoint": "ckpt-2"}))
    a = next_action(ws)
    assert a.state == "ready-to-score"
    # export = evaluate (decode + prereg-gated score + diagnosis) + package
    assert "nmt-forge export" in a.command and "--out" in a.command
    assert "evaluate" in a.why


def test_an_export_without_a_model_is_not_servable(ws, tmp_path):
    # `export --no-model` writes the evaluation + harness report only; status
    # used to say "exported — serve it" and the serve gate passed.
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", _rows("d")), "dev")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set": "toy-test"}))
    run_dir = ws.runs_dir / "r1"
    run_dir.mkdir()
    manifest = run_dir / "manifest.json"
    manifest.write_text(json.dumps({"run_name": "r1", "config_hash": "abc",
                                    "selected_checkpoint": "ckpt-2"}))
    rm = snapshot(ws)["runs"][-1]["manifest"]
    ws.ledger.append("export", run="r1", config_hash="abc", run_manifest=rm,
                     dir=str(tmp_path / "export"), evaluated=True,
                     model_included=False)
    assert next_action(ws).state == "ready-to-score"
    gates = {g.name: g for g in preflight(ws, "serve")}
    assert not gates["export-dir"].ok

    ws.ledger.append("export", run="r1", config_hash="abc", run_manifest=rm,
                     dir=str(tmp_path / "export2"), evaluated=True,
                     model_included=True)
    assert next_action(ws).state == "exported"


def test_preflight_run_gates(ws, tmp_path):
    gates = preflight(ws, "run")
    fence = next(g for g in gates if g.name == "dev-fence")
    assert not fence.ok and fence.fix
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", _rows("d")), "dev")
    gates = preflight(ws, "run")
    assert next(g for g in gates if g.name == "dev-fence").ok


def test_preflight_unknown_command(ws):
    gates = preflight(ws, "frobnicate")
    assert len(gates) == 1 and not gates[0].ok


def test_render_status_names_next(ws):
    out = render_status(ws)
    assert "NEXT:" in out


def test_snapshot_content_free(ws, tmp_path):
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    s = json.dumps(snapshot(ws))
    assert "sentence number" not in s  # never corpus text


def test_prereg_v1_dict_eval_set(ws, tmp_path):
    # real prereg files store eval_set as {"name":…, "sha256":…} — live-smoke
    # regression (2026-07-13)
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", _rows("d")), "dev")
    (ws.prereg_dir / "p1.json").write_text(json.dumps(
        {"prereg_version": 1, "eval_set": {"name": "toy-test", "sha256": "x"}}))
    a = next_action(ws)
    assert a.state == "ready-to-train"


def _export(tmp_path, name, *, score, strict=None, share=1.0, prereg="p1"):
    """An export directory with the forge-model.json `export` writes."""
    d = tmp_path / name
    (d / "model").mkdir(parents=True)
    tr = {"set": "toy-test", "n": 10,
          "groups": {"all": {"chrf++": {"score": score, "ci_lower": score - 2,
                                        "ci_upper": score + 2}}},
          "strict_overall": ({"chrf++": {"score": strict}} if strict is not None
                             else None),
          "near_twin": {"message": f"{int(share * 10)} of 10 test rows have a "
                                   "near-twin in training",
                        "recall_not_translation": share >= 0.5},
          "prereg": {"id": prereg, "verdicts": [{"verdict": "held"}]}}
    (d / "model" / "forge-model.json").write_text(json.dumps(
        {"format": "nmt-forge-model/1", "test_report": tr}))
    return d


def _two_exported_runs(ws, tmp_path):
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", _rows("d")), "dev")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set": "toy-test"}))
    manifests = {}
    for run in ("a-full", "b-twinfree"):
        run_dir = ws.runs_dir / run
        run_dir.mkdir()
        (run_dir / "manifest.json").write_text(json.dumps(
            {"run_name": run, "config_hash": run, "selected_checkpoint": "c"}))
        manifests[run] = str(run_dir / "manifest.json")
    full = _export(tmp_path, "export-full", score=67.08, share=1.0)
    free = _export(tmp_path, "export-twinfree", score=47.48, strict=47.48,
                   share=0.0, prereg="p2")
    for run, d in (("a-full", full), ("b-twinfree", free)):
        ws.ledger.append("export", run=run, config_hash=run,
                         run_manifest=manifests[run], dir=str(d),
                         model_dir=str(d / "model"), evaluated=True,
                         model_included=True)
    return full, free


def test_several_exports_ask_the_user_to_choose_never_the_newest(ws, tmp_path):
    """Round 5 school persona: status told the agent to serve the NEWEST
    export — the weaker, diagnostic twin-free model."""
    full, free = _two_exported_runs(ws, tmp_path)
    a = next_action(ws)
    assert a.state == "choose-export"
    assert str(full / "model") in a.command and str(free / "model") in a.command
    assert "never picks the newest" in a.why
    assert any("ask the user" in b for b in a.blockers)
    listed = {x["run"]: x for x in a.to_json()["exports"]}
    # scoring standard/1: the headline is chrF++ with its CI, written the
    # way every surface writes it
    assert listed["a-full"]["score"] == {
        "metric": "chrF++", "score": 67.08, "ci": [65.08, 69.08],
        "text": "chrF++ 67.1 [65.1, 69.1]", "scoring_standard": "standard/1"}
    assert listed["a-full"]["recall_not_translation"] is True
    assert listed["b-twinfree"]["strict_score"]["score"] == 47.48
    assert listed["b-twinfree"]["prereg"]["id"] == "p2"
    assert "chrF++ 67.1 [65.1, 69.1]" in a.why
    assert "chrF++ 47.5 [45.5, 49.5]" in a.why


def test_serving_an_export_is_not_the_choice(ws, tmp_path):
    """Round 10 (hospital): an agent served the all-data model provisionally
    (no human was there to choose) and status called it "the export you
    chose". A serve is a trial; the choice stays open."""
    full, free = _two_exported_runs(ws, tmp_path)
    ws.ledger.append("serve", model_dir=str((full / "model").resolve()),
                     model="m")
    a = next_action(ws)
    assert a.state == "choose-export"
    assert a.command.startswith("nmt-forge choose <the model directory")
    assert f"Currently served (a trial, NOT the choice): {full / 'model'}" \
        in a.why
    assert any(r.startswith("served (not chosen):") for r in a.ready)
    assert "the export you chose" not in a.why


def test_choosing_an_export_records_the_choice(ws, tmp_path):
    full, free = _two_exported_runs(ws, tmp_path)
    ws.ledger.append("serve", model_dir=str((free / "model").resolve()),
                     model="m")
    ws.ledger.append("choose", model_dir=str((full / "model").resolve()),
                     via="choose")
    a = next_action(ws)
    assert a.state == "exported"
    assert a.command == f"nmt-forge serve {full / 'model'}"
    assert "the export the user chose (recorded by `nmt-forge choose`)" in a.why
    assert "Other exports" in a.why and "chrF++ 47.5 [45.5, 49.5]" in a.why
    assert len(a.to_json()["exports"]) == 2
    assert snapshot(ws)["chosen"] == [str((full / "model").resolve())]
