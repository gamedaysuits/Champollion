"""The model ladder, 2026-10-11: models from Haiku down to 3B ones drove the
rails (the six MCP tools, no shell) for a scripted family. What forge said
that stopped them:

1. "Fix it before training, while the test set is still unspent" when 4 of
   30 test rows had a near-twin in training. No rails step runs that fix;
   two Haiku runs would not train and one would not score, though the
   strict score on the other 26 rows was already the measure (export
   reports it beside the full score). Below RECALL_SHARE the advice now says
   there is nothing to fix first and names the twin-free model as an
   option; preflight says it with a ✓. Most rows twinned: unchanged.
2. Whether a run beats the dictionary floor was said only in status's run
   lines, which the rails never show; Haiku told the family it could not
   say yet. The scoring step says it.

All text is invented tokens (quarantine-gate discipline).
"""

from __future__ import annotations

import json

from nmt_forge.advisor import _ladder, preflight, render_preflight, snapshot
from nmt_forge.guards.ci_scoring import (NEAR_TWIN_ADVICE, NEAR_TWIN_OPTION,
                                         near_twin_forecast)
from nmt_forge.workspace import Workspace
from tests.conftest import write_jsonl
from tests.test_near_twin_forecast import _phrasebook
from tests.test_private_text import _dummy_run

UNRELATED = [{"source": f"zorp quib {w} vandle", "target": f"kesh {w}y morlo"}
             for w in ("ona", "dua", "tri")]


# -- 1. a few near-twins: nothing to fix first --------------------------------

def test_a_few_twins_are_nothing_to_fix_before_training():
    rows = _phrasebook(2)
    f = near_twin_forecast(rows[:1] + UNRELATED, rows[1:])
    assert (f["n"], f["near_twin_rows"], f["strict_n"]) == (4, 1, 3)
    assert not f["recall_not_translation"]
    assert f["advice"] == NEAR_TWIN_OPTION
    assert "fix it before training" not in f["advice"]
    assert f["advice"].startswith("nothing to fix before training")
    assert "An option, not a step" in f["advice"]
    assert "--drop-test-twins" in f["advice"]       # the option is named
    # most rows twinned: the fix comes first, as before
    severe = near_twin_forecast(rows[:1] + UNRELATED[:1], rows[1:])
    assert severe["recall_not_translation"]
    assert severe["advice"] == NEAR_TWIN_ADVICE


def test_preflight_says_a_few_twins_with_a_tick(tmp_path):
    rows = _phrasebook()
    ws = Workspace(tmp_path / ".forge")
    test = write_jsonl(tmp_path / "test.jsonl", rows[:1] + UNRELATED)
    train = write_jsonl(tmp_path / "train.jsonl", rows[1:])
    ws.registry.register("project-test", test, "test")
    cfg = {"run_name": "r", "workspace": str(ws.root),
           "data": {"gold": [str(train)], "dev": "project-dev"},
           "model": {"backend": "dummy"},
           "eval": {"battery": "project-test",
                    "near_dupe_corpus": str(train)}}
    (tmp_path / "config.json").write_text(json.dumps(cfg))
    gates = preflight(ws, "run", tmp_path / "config.json")
    g = next(g for g in gates if g.name == "test-near-twins")
    assert g.ok and not g.warning
    assert "1 of 4 test rows (25%) have a near-twin" in g.detail
    assert "the strict score on the other 3 rows is the generalization number" in g.detail
    out = render_preflight(ws, "run", tmp_path / "config.json", gates=gates)
    assert "✓ test-near-twins" in out
    assert "fix it before training" not in out


# -- 2. the dictionary floor, said at the scoring step -------------------------

def test_the_scoring_step_says_the_run_beats_the_dictionary(tmp_path, capsys):
    ws_dir, _ = _dummy_run(tmp_path, capsys)
    ws = Workspace(ws_dir)
    s = snapshot(ws)
    last = s["runs"][-1]
    last["dev_score"] = {"metric": "chrf++", "score": 25.1, "ci": [22.0, 28.0]}
    last["floor"] = {"score": 11.46, "ci": [11.08, 11.85], "beats": True}
    a = _ladder(ws, s)
    assert a.state == "ready-to-score"
    assert ("dev chrF++ 25.10 [22.00, 28.00] is above the dictionary floor on "
            "the same dev sentences, chrF++ 11.46 [11.08, 11.85] — the "
            "intervals do not overlap") in a.why
    # a run that does not beat it is a warning in every state, said there
    last["floor"]["beats"] = False
    assert "above the dictionary floor" not in _ladder(ws, s).why
