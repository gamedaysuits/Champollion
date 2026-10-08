"""The predictions file: ONE format, documented once, refused clearly.

Synthetic users followed `nmt-forge status` (which printed
`--predictions <predictions.md>`) and the tutorial (`predictions.md`) and got
a raw JSONDecodeError traceback; the docs described the format three
different ways. Now: a .json ARRAY of prediction objects, a `prereg
template` command that writes a valid file, and what/why/fix refusals.
"""

import json

import pytest

from nmt_forge.cli import main
from nmt_forge.errors import PreregistrationInvalid
from nmt_forge.guards import preregister
from tests.conftest import write_jsonl


def _run(capsys, *argv):
    code = main(list(argv))
    out = capsys.readouterr()
    return code, out.out, out.err


@pytest.fixture
def ws_dir(tmp_path, capsys):
    ws_dir = str(tmp_path / ".forge")
    ev = write_jsonl(tmp_path / "test.jsonl",
                     [{"source": f"s {i} a b", "reference": f"r {i} c d"}
                      for i in range(5)])
    _run(capsys, "--workspace", ws_dir, "registry", "add", "school-test",
         str(ev), "--role", "test")
    return ws_dir


def test_markdown_predictions_refused_with_the_format_not_a_traceback(
        tmp_path, ws_dir, capsys):
    md = tmp_path / "predictions.md"
    md.write_text("# Predictions\n\n- chrF++ will go up\n")
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "new",
                          "p1", "--eval-set", "school-test",
                          "--predictions", str(md))
    assert code == 2
    assert "Traceback" not in err and "JSONDecodeError" not in err
    assert "Markdown/prose" in err
    assert "prereg template --out predictions.json" in err   # the fix
    assert "JSON ARRAY" in err                               # the format


def test_wrapper_object_refused_with_a_pointed_hint(tmp_path):
    p = tmp_path / "preds.json"
    p.write_text(json.dumps({"predictions": [
        {"metric": "chrf++", "expect": "up", "rationale": "x"}]}))
    with pytest.raises(PreregistrationInvalid, match="save just that array"):
        preregister.load_predictions(p)


def test_template_round_trip(tmp_path, ws_dir, capsys):
    out_file = tmp_path / "predictions.json"
    code, out, _ = _run(capsys, "prereg", "template", "--out", str(out_file))
    assert code == 0 and out_file.is_file()
    assert "REPLACE" in out_file.read_text()
    # the unedited template is refused — a rubber stamp predicts nothing
    code, _, err = _run(capsys, "--workspace", ws_dir, "prereg", "new", "p1",
                        "--eval-set", "school-test",
                        "--predictions", str(out_file))
    assert code == 2 and "REPLACE" in err
    # edited, it binds
    preds = json.loads(out_file.read_text())
    for p in preds:
        for k, v in list(p.items()):
            if isinstance(v, str) and v.startswith("REPLACE"):
                p[k] = "a model trained on our pairs beats nothing"
    out_file.write_text(json.dumps(preds))
    code, out, _ = _run(capsys, "--workspace", ws_dir, "prereg", "new", "p1",
                        "--eval-set", "school-test",
                        "--predictions", str(out_file), "--json")
    assert code == 0
    payload = json.loads(out)
    assert payload["id"] == "p1" and payload["predictions"] == 2


def test_template_json_payload_carries_the_format(capsys):
    code, out, _ = _run(capsys, "prereg", "template", "--json")
    assert code == 0
    payload = json.loads(out)
    assert payload["format"] == preregister.PREDICTIONS_FORMAT
    # the template validates except for its REPLACE placeholders
    with pytest.raises(PreregistrationInvalid, match="REPLACE"):
        preregister._validate_predictions(payload["template"])


def test_json_error_object_for_agents(tmp_path, ws_dir, capsys):
    md = tmp_path / "p.md"
    md.write_text("not json")
    code, out, _ = _run(capsys, "--workspace", ws_dir, "prereg", "new", "p1",
                        "--eval-set", "school-test", "--predictions", str(md),
                        "--json")
    assert code == 2
    err = json.loads(out)["error"]
    assert err["type"] == "PreregistrationInvalid"
    assert err["guard"] == "preregister"
    assert "prereg template" in err["fix"]


def test_status_command_for_prereg_is_runnable(tmp_path, ws_dir, capsys):
    # the advice is copy-pasteable: no --eval abbreviation, no .md
    code, out, _ = _run(capsys, "--workspace", ws_dir, "status", "--json")
    assert code == 0
    # no dev set yet → the advice is the split; register a dev and re-ask
    dev = write_jsonl(tmp_path / "dev.jsonl",
                      [{"source": f"x {i} y z", "reference": f"q {i} w e"}
                       for i in range(3)])
    _run(capsys, "--workspace", ws_dir, "registry", "add", "school-dev",
         str(dev), "--role", "dev")
    code, out, _ = _run(capsys, "--workspace", ws_dir, "status", "--json")
    cmd = json.loads(out)["advice"]["next_command"]
    assert "--eval-set school-test" in cmd and ".md" not in cmd
    # every flag in the advice parses (abbreviations are disabled)
    first, second = cmd.split(" && ")
    assert first.startswith("nmt-forge prereg template")
    from nmt_forge.cli import build_parser

    argv = second.replace("<id>", "p9").split()[1:]
    args = build_parser().parse_args(["--workspace", ws_dir] + argv)
    assert args.eval_set == "school-test"
