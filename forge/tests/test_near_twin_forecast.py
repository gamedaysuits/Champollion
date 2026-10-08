"""The near-twin share, said BEFORE training (synthetic hospital user,
2026-10): all 150 test rows were near-twins of phrasebook templates in
training. export said so — after training, with the test set spent;
leak-audit had called the same rows "template siblings … practice, not the
answer", and split never said the strict subset would be empty.

Same measure as export (leak_audit.near_twin_flags at the battery's
threshold), same reading (ci_scoring.near_twin_summary), now in split,
leak-audit and preflight run — text and --json alike. Invented tokens only.
"""

import json

from nmt_forge.cli import main
from nmt_forge.guards.ci_scoring import (NEAR_TWIN_ADVICE, near_twin_forecast,
                                         near_twin_summary)
from tests.conftest import write_jsonl

FILLERS = [f"fill{i}" for i in range(12)]


def _phrasebook(frames: int = 8) -> list[dict]:
    """frames × fillers rows; rows sharing a frame are near-twins (Jaccard
    ≥ 0.6 on both sides), rows of different frames share nothing."""
    return [{"source": f"frame{f} alpha{f} beta{f} {w} gamma{f}",
             "target": f"fr{f}a fr{f}b {w}x fr{f}c"}
            for f in range(frames) for w in FILLERS]


def _run(capsys, *argv):
    code = main(list(argv))
    out = capsys.readouterr()
    return code, out.out, out.err


def test_forecast_reads_like_export_but_before_training():
    rows = _phrasebook(2)
    train, test = rows[1:], rows[:1] + [{"source": "unrelated words here now",
                                         "target": "nothing alike at all"}]
    f = near_twin_forecast(test, train)
    assert f["when"] == "before-training" and f["checked"]
    assert (f["n"], f["near_twin_rows"], f["strict_n"]) == (2, 1, 1)
    assert f["recall_not_translation"]               # 50% is the line
    assert "will mostly measure recall of training phrases" in f["message"]
    assert f["advice"] == NEAR_TWIN_ADVICE
    # the SAME counts export's reading produces from a scored manifest
    after = near_twin_summary({"n": 2, "near_dupe": {
        "flagged": 1, "params": {"jaccard_threshold": 0.6}}})
    assert after["near_twin_rows"] == f["near_twin_rows"]
    assert after["recall_not_translation"] == f["recall_not_translation"]

    all_twins = near_twin_forecast(rows[:3], rows[3:])
    assert "strict subset (test rows with no twin) will be EMPTY" in \
        all_twins["message"]
    clean = near_twin_forecast(
        [{"source": "unrelated words here now", "target": "nothing alike"}],
        rows)
    assert clean["near_twin_rows"] == 0 and clean["advice"] is None


def test_split_says_the_strict_subset_will_be_empty(tmp_path, capsys):
    corpus = write_jsonl(tmp_path / "phrasebook.jsonl", _phrasebook())
    ws = tmp_path / ".forge"
    code, out, _ = _run(capsys, "--workspace", str(ws), "split", str(corpus),
                        "--test", "20", "--dev", "10", "--seed", "3",
                        "--out", str(tmp_path / "split"),
                        "--register", "project")
    assert code == 0
    assert "TEST ROWS WITH A NEAR-TWIN" in out
    assert "will be EMPTY" in out
    assert "--near-dupe 0.6" in out                  # the concrete fix

    code, out, _ = _run(capsys, "--workspace", str(tmp_path / "ws2"), "split",
                        str(corpus), "--test", "20", "--dev", "10", "--seed",
                        "3", "--out", str(tmp_path / "split2"), "--json")
    payload = json.loads(out)
    nt = payload["near_twin"]["test side"]
    assert nt["near_twin_rows"] == nt["n"] and nt["strict_n"] == 0
    assert nt["advice"]


def test_near_dupe_carve_holds_out_whole_templates(tmp_path, capsys):
    corpus = write_jsonl(tmp_path / "phrasebook.jsonl", _phrasebook())
    code, out, _ = _run(capsys, "--workspace", str(tmp_path / "ws"), "split",
                        str(corpus), "--test", "20", "--dev", "10", "--seed",
                        "3", "--out", str(tmp_path / "split"), "--near-dupe",
                        "0.6", "--json")
    assert code == 0
    payload = json.loads(out)
    assert payload["near_dupe_jaccard"] == 0.6
    nt = payload["near_twin"]["test side"]
    assert nt["near_twin_rows"] == 0 and nt["advice"] is None
    assert payload["sizes"]["test"] % len(FILLERS) == 0   # whole frames

    code, _, err = _run(capsys, "split", str(corpus), "--test", "5",
                        "--seed", "1", "--out", str(tmp_path / "x"),
                        "--near-dupe", "1.5")
    assert code == 2 and "(0, 1]" in err


def test_leak_audit_says_what_kept_siblings_do_to_the_test_score(tmp_path,
                                                                 capsys):
    rows = _phrasebook()
    ws = tmp_path / ".forge"
    test = write_jsonl(tmp_path / "test.jsonl",
                       [r for i, r in enumerate(rows) if i % len(FILLERS) == 0])
    corpus = write_jsonl(tmp_path / "corpus.jsonl",
                         [r for i, r in enumerate(rows)
                          if i % len(FILLERS) != 0])
    assert main(["--workspace", str(ws), "registry", "add", "toy-test",
                 str(test), "--role", "test"]) == 0
    capsys.readouterr()
    code, out, _ = _run(capsys, "--workspace", str(ws), "leak-audit",
                        str(corpus))
    assert code == 0
    assert "template sibling" in out                 # still kept, still named
    assert "TEST ROWS WITH A NEAR-TWIN" in out
    assert "toy-test: all 8 test rows have a near-identical twin" in out
    assert "hold out whole templates" in out

    code, out, _ = _run(capsys, "--workspace", str(ws), "leak-audit",
                        str(corpus), "--json")
    nt = json.loads(out)["near_twin"]["toy-test"]
    assert nt["role"] == "test" and nt["near_twin_rows"] == 8
    assert nt["recall_not_translation"] and nt["advice"]

    code, out, _ = _run(capsys, "--workspace", str(ws), "leak-audit",
                        str(corpus), "--clean-to",
                        str(tmp_path / "clean.jsonl"), "--json")
    assert json.loads(out)["near_twin"]["toy-test"]["near_twin_rows"] == 8


def test_preflight_run_warns_without_blocking(tmp_path, capsys):
    from nmt_forge.advisor import preflight
    from nmt_forge.workspace import Workspace

    rows = _phrasebook()
    ws = Workspace(tmp_path / ".forge")
    test = write_jsonl(tmp_path / "test.jsonl", rows[::len(FILLERS)])
    train = write_jsonl(tmp_path / "train.jsonl",
                        [r for i, r in enumerate(rows)
                         if i % len(FILLERS) != 0])
    ws.registry.register("project-test", test, "test")
    cfg = {"run_name": "r", "workspace": str(ws.root),
           "data": {"gold": [str(train)], "dev": "project-dev"},
           "model": {"backend": "dummy"},
           "eval": {"battery": "project-test",
                    "near_dupe_corpus": str(train)}}
    (tmp_path / "config.json").write_text(json.dumps(cfg))
    gates = preflight(ws, "run", tmp_path / "config.json")
    g = next(g for g in gates if g.name == "test-near-twins")
    assert g.ok and g.warning                       # a warning, never a block
    assert "recall of training phrases" in g.detail
    assert "hold out whole templates" in g.fix
    assert "--drop-test-twins" in g.fix          # the fixed-test-set lever
    assert g.to_json()["warning"] is True

    code, out, _ = _run(capsys, "--workspace", str(ws.root), "preflight",
                        "run", "--config", str(tmp_path / "config.json"))
    assert "⚠ test-near-twins" in out and "warning(s)" in out


# -- the lever for a FIXED test set: leak-audit --drop-test-twins ---------------
#
# School user, Round 4 (2026-10): all 200 rows of a teacher-written test set
# had a template twin in training; every output after leak-audit said the
# 67.08 chrF++ measured recall of training phrases — and nothing could fix
# it: split --near-dupe only helps when forge carves the test set, and
# leak-audit keeps template siblings on purpose.

def _fixed_test_project(tmp_path, capsys, test_frames=range(4)):
    """A templated corpus (8 frames × 12 fillers) and a FIXED, separately
    written test set that reuses some of its frames (filler 0 of each
    frame in ``test_frames``); the corpus is everything else, marked
    local-only by its steward."""
    rows = _phrasebook()
    test_idx = {f * len(FILLERS) for f in test_frames}
    test = write_jsonl(tmp_path / "teacher-test.jsonl",
                       [rows[i] for i in sorted(test_idx)])
    corpus = write_jsonl(tmp_path / "corpus.jsonl",
                         [r for i, r in enumerate(rows) if i not in test_idx])
    (tmp_path / "corpus.jsonl.champollion.json").write_text(
        json.dumps({"transmission": "local-only"}))
    ws = str(tmp_path / ".forge")
    assert main(["--workspace", ws, "registry", "add", "school-test",
                 str(test), "--role", "test"]) == 0
    capsys.readouterr()
    return ws, corpus, test


def test_drop_test_twins_gives_a_fixed_test_set_a_lever(tmp_path, capsys):
    from mt_eval_harness.corpus_loader import marked_local_only

    from nmt_forge.guards.leak_audit import near_twin_flags
    from nmt_forge.registry import load_rows

    ws, corpus, test = _fixed_test_project(tmp_path, capsys)
    # the forecast without the option: every test row twinned, and the fix
    # for a FIXED test set is named next to "write independent sentences"
    code, out, _ = _run(capsys, "--workspace", ws, "leak-audit", str(corpus))
    assert code == 0
    assert "school-test: all 4 test rows have a near-identical twin" in out
    assert "--drop-test-twins" in out
    assert "written independently of the training material" in out
    code, out, _ = _run(capsys, "--workspace", ws, "leak-audit", str(corpus),
                        "--clean-to", str(tmp_path / "kept.jsonl"), "--json")
    payload = json.loads(out)
    assert payload["near_twin"]["school-test"]["near_twin_rows"] == 4
    assert payload["test_twins"] is None and payload["rows_kept"] == 92
    assert "--drop-test-twins" in payload["near_twin"]["school-test"]["advice"]

    # with the option: the 44 siblings of the 4 test frames go, the strict
    # subset goes from 0 to all 4, and the cleaned file keeps the mark
    clean = tmp_path / "clean.jsonl"
    code, out, err = _run(capsys, "--workspace", ws, "leak-audit",
                          str(corpus), "--clean-to", str(clean),
                          "--drop-test-twins", "--json")
    assert code == 0, err
    payload = json.loads(out)
    tw = payload["test_twins"]
    assert tw["dropped"] == 44 and tw["rows_left"] == 48
    assert tw["jaccard_threshold"] == 0.6
    assert tw["per_set"]["school-test"] == {
        "role": "test", "n": 4, "twin_rows": 44,
        "near_twin_rows_before": 4, "near_twin_rows_after": 0,
        "strict_n_before": 0, "strict_n_after": 4}
    assert tw["near_twin_before"]["school-test"]["near_twin_rows"] == 4
    after = payload["near_twin"]["school-test"]
    assert after["near_twin_rows"] == 0 and after["advice"] is None
    assert payload["leaking_rows"] == 0          # none of these were leaks
    assert payload["rows_removed"] == 44 and payload["rows_kept"] == 48
    # --json summarizes long index lists (Round 10); the audit file keeps them
    assert payload["removed_row_indices"]["count"] == 44
    assert len(payload["removed_row_indices"]["first"]) == 5
    assert payload["indices"]["summarized"] is True
    kept = load_rows(clean)
    assert len(kept) == 48
    assert not any(r["source"].startswith(("frame0 ", "frame1 ", "frame2 ",
                                           "frame3 ")) for r in kept)
    # measured again from scratch: the cleaned file has no twin of a test row
    assert near_twin_flags(load_rows(test), kept)["indices"] == set()
    assert marked_local_only(clean)
    assert payload["carried_mark"]["sidecars"]
    audit = json.loads((tmp_path / "clean.audit.json").read_text())
    assert audit["test_twins"]["dropped"] == 44
    assert audit["rows_kept"] == 48 and len(audit["removed_row_indices"]) == 44

    # the human rendering says the same, in words
    code, out, _ = _run(capsys, "--workspace", ws, "leak-audit", str(corpus),
                        "--clean-to", str(tmp_path / "clean2.jsonl"),
                        "--drop-test-twins")
    assert code == 0
    assert "ALSO DROPPED by --drop-test-twins: 44 row(s)" in out
    assert ("school-test (test): 44 training row(s) dropped · strict "
            "subset: 0 → 4 of 4 test rows") in out
    assert "training keeps 48 of 92 row(s)" in out
    assert "no test row has a near-twin in the training data" in out
    assert "Cleaned: 48 row(s) kept" in out

    # split knows the option was taken (a fixed test set, --test 0): the
    # all-data split's twins are the two-model route's, and the twin-free
    # file is named — never "fix it before training" again (Round 11)
    code, out, _ = _run(capsys, "--workspace", ws, "split", str(corpus),
                        "--test", "0", "--dev", "8", "--seed", "1", "--out",
                        str(tmp_path / "split"))
    assert code == 0 and "two-model route" in out and "clean2.jsonl" in out
    assert "fix it before training" not in out
    code, out, _ = _run(capsys, "--workspace", ws, "split", str(clean),
                        "--test", "0", "--dev", "8", "--seed", "1", "--out",
                        str(tmp_path / "split-clean"), "--json")
    assert json.loads(out)["near_twin"]["school-test"]["near_twin_rows"] == 0


def test_drop_test_twins_refuses_to_leave_nothing_to_train_on(tmp_path,
                                                              capsys):
    # the teacher's test set reuses EVERY frame of the corpus
    ws, corpus, _ = _fixed_test_project(tmp_path, capsys,
                                        test_frames=range(8))
    clean = tmp_path / "clean.jsonl"
    code, out, _ = _run(capsys, "--workspace", ws, "leak-audit", str(corpus),
                        "--clean-to", str(clean), "--drop-test-twins",
                        "--json")
    assert code == 2
    err = json.loads(out)["error"]
    assert err["type"] == "TrainingWouldBeEmpty"
    assert err["guard"] == "leak-audit"
    assert "NOTHING to train on" in err["message"]
    assert "written independently" in err["fix"]
    assert not clean.exists()
    assert not (tmp_path / "clean.audit.json").exists()
    code, _, err = _run(capsys, "--workspace", ws, "leak-audit", str(corpus),
                        "--clean-to", str(clean), "--drop-test-twins")
    assert code == 2 and "Nothing was written" in err and not clean.exists()


def test_drop_test_twins_needs_clean_to_and_a_test_set(tmp_path, capsys):
    ws, corpus, _ = _fixed_test_project(tmp_path, capsys)
    code, _, err = _run(capsys, "--workspace", ws, "leak-audit", str(corpus),
                        "--drop-test-twins")
    assert code == 2 and "--clean-to" in err
    code, _, err = _run(capsys, "--workspace", str(tmp_path / "empty-ws"),
                        "leak-audit", str(corpus), "--clean-to",
                        str(tmp_path / "c.jsonl"), "--drop-test-twins")
    assert code == 2 and "no test/sealed set is registered" in err
    assert not (tmp_path / "c.jsonl").exists()


def test_the_after_training_reading_names_the_lever_too():
    from nmt_forge.guards.ci_scoring import NEAR_TWIN_ADVICE_AFTER

    flagged = near_twin_summary({"n": 4, "near_dupe": {
        "flagged": 4, "params": {"jaccard_threshold": 0.6}}})
    assert flagged["advice"] == NEAR_TWIN_ADVICE_AFTER
    assert "--drop-test-twins" in flagged["advice"]
    assert "--allow-after-reads" in flagged["advice"]  # 2nd read is ledgered
    clean = near_twin_summary({"n": 4, "near_dupe": {
        "flagged": 0, "params": {"jaccard_threshold": 0.6}}})
    assert clean["advice"] is None
    assert near_twin_summary({"n": 4})["advice"] is None   # not checked
