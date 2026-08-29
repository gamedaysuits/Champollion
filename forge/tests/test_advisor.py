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


def test_no_dev_advises_split(ws, tmp_path):
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    a = next_action(ws)
    assert a.state == "no-dev-set"
    assert "split" in a.command
    assert any("dev" in b for b in a.blockers)


def test_missing_prereg_advises_prereg(ws, tmp_path):
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", _rows("d")), "dev")
    a = next_action(ws)
    assert a.state == "missing-preregistration"
    assert "prereg new --eval toy-test" in a.command


def test_prereg_present_advises_run(ws, tmp_path):
    ws.registry.register("toy-test", write_jsonl(tmp_path / "t.jsonl", _rows("t")), "test")
    ws.registry.register("toy-dev", write_jsonl(tmp_path / "d.jsonl", _rows("d")), "dev")
    (ws.prereg_dir / "p1.json").write_text(json.dumps({"eval_set": "toy-test"}))
    a = next_action(ws)
    assert a.state == "ready-to-train"
    assert a.command.startswith("nmt-forge run")


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
    assert "evaluate" in a.command  # closes the decode→battery loop in one step


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
