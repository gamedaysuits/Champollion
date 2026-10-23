"""Novice-agent simulation — the F6 acceptance.

A weak agent must be able to go from an EMPTY workspace to a scored, diagnosed
battery using ONLY what forge's own tools hand back. This test is that agent:
it never uses knowledge outside three sources —

  1. the advice from `nmt-forge status` (the state + THE next command),
  2. the snapshot from `status --json` (the registered set NAMES + run paths),
  3. the user's own declared inputs (a parallel corpus, a target language, and
     the falsifiable predictions) — the genuine `<angle-bracket>` values.

Every mutation goes through `nmt_forge.cli.main([...])`, the real CLI. The
state dispatch keys only off `advice.state`; the arguments come only off the
snapshot + the user inputs. If any step needed out-of-band knowledge, this test
could not be written without smuggling it in — so it doubles as the proof.
"""

import json

import pytest

from nmt_forge.advisor import next_action, snapshot
from nmt_forge.cli import main
from nmt_forge.workspace import Workspace


# -- the user's declared inputs (everything else is a tool output) ------------
TARGET_LANG = "crk"
CORPUS = [
    {"id": f"r{i}", "register": ("textbook" if i % 2 else "government"),
     "source": f"the wug {i} runs across the field today",
     "target": f"wugto{i} blar nem pel sun{i}"}
    for i in range(20)
]
PREDICTIONS = [{"metric": "chrf++", "expect": "a per-register table",
                "rationale": "identity-ish dummy decode should not saturate"}]


def _run(argv):
    code = main(argv)
    assert code in (0, 2), f"unexpected exit {code} for {argv}"
    return code


def test_empty_workspace_to_scored_battery(tmp_path, capsys):
    ws_dir = str(tmp_path / ".forge")
    ws = Workspace(ws_dir)

    corpus = tmp_path / "corpus.jsonl"
    corpus.write_text("\n".join(json.dumps(r) for r in CORPUS) + "\n")
    preds = tmp_path / "predictions.json"
    preds.write_text(json.dumps(PREDICTIONS))
    split_dir = tmp_path / "splits"
    config_path = tmp_path / "config.json"

    seen_states = []
    for _ in range(10):
        advice = next_action(ws)
        snap = snapshot(ws)
        seen_states.append(advice.state)

        if advice.state == "ready-to-score":
            break

        if advice.state in ("empty-workspace", "no-dev-set"):
            # the advice says: group-disjoint split that registers dev AND test
            _run(["--workspace", ws_dir, "split", str(corpus),
                  "--test", "6", "--dev", "6", "--seed", "7",
                  "--out", str(split_dir), "--register", "mypair"])

        elif advice.state == "missing-preregistration":
            # the test set NAME comes from the snapshot; predictions are the
            # user's. The prereg id is arbitrary (agent's choice).
            test_name = snap["roles"]["test"][0]
            _run(["--workspace", ws_dir, "prereg", "new", "p1",
                  "--eval-set", test_name, "--predictions", str(preds)])

        elif advice.state == "ready-to-train":
            # assemble the config from snapshot names + user inputs — exactly
            # what `init` scaffolds; the train file is the split's train side
            dev_name = snap["roles"]["dev"][0]
            test_name = snap["roles"]["test"][0]
            config = {
                "run_name": "sim", "workspace": ws_dir,
                "language": {"target": TARGET_LANG},
                "data": {"gold": [str(split_dir / "train.jsonl")], "dev": dev_name},
                "model": {"backend": "dummy"},
                "selection": {"metric": "loss"},
                "decode": {"max_new_tokens": 32},
                "eval": {"battery": test_name, "by": "register", "n_bootstrap": 30},
            }
            config_path.write_text(json.dumps(config))
            _run(["--workspace", ws_dir, "run", str(config_path)])
        else:
            pytest.fail(f"loop reached an unhandled state: {advice.state}")
    else:
        pytest.fail(f"loop did not converge; states seen: {seen_states}")

    # ready-to-score: close the loop with evaluate (decode+score+diagnose)
    snap = snapshot(ws)
    run_manifest = snap["runs"][-1]["manifest"]
    capsys.readouterr()  # clear
    _run(["--workspace", ws_dir, "evaluate", run_manifest,
          "--config", str(config_path)])
    out = capsys.readouterr().out

    # the agent reached a scored battery grouped by register, with a diagnosis
    assert "textbook" in out and "government" in out
    assert "wrote" in out

    # and a battery manifest + report exist on disk with per-register groups —
    # evaluate prints "wrote <hyps>, <manifest> and <report_md>"
    wrote = next(l for l in out.splitlines() if l.startswith("wrote "))
    battery_json = wrote.split(", ")[1].split(" and ")[0].strip()
    assert battery_json.endswith("-battery.json")
    manifest = json.loads(open(battery_json).read())
    assert set(manifest["groups"]) == {"textbook", "government"}
    md = open(battery_json.replace(".json", ".md")).read()
    assert "Diagnosis" in md or "no lint findings" in md

    # the state ladder was followed mechanically, in order, and converged
    assert seen_states[0] == "empty-workspace"
    assert "missing-preregistration" in seen_states
    assert "ready-to-train" in seen_states
    assert seen_states[-1] == "ready-to-score"
