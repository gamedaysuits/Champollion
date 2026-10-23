"""Growing the dev set from the speaker's practice sentences
(docs/FORGE_MACHINE_CRITIQUE_2026-10-12.md, finding 1): new rows join the dev
set under its own name, never a test sentence, never twice."""

import json
from pathlib import Path

import pytest

from nmt_forge.errors import ForgeError
from nmt_forge.improve.practice import DEV_GROWN, grow_dev, merged_files


def _practice(tmp_path, name, rows):
    p = tmp_path / "data" / "dev" / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("".join(f"{s}\t{t}\n" for s, t in rows), encoding="utf-8")
    return p


def test_practice_sentences_join_the_dev_set_under_its_name(ws, dev_set, test_set, tmp_path):
    before = ws.registry.get("toy-dev")["sha256"]
    f = _practice(tmp_path, "practice-round-1.tsv",
                  [(f"the dax {i} wakes up", f"daxko{i} wek") for i in range(5)])
    e = grow_dev(ws, "toy-dev", [f])
    assert (e["before"], e["added"], e["after"]) == (8, 5, 13)
    entry = ws.registry.get("toy-dev")
    assert entry["role"] == "dev" and entry["sha256"] != before
    rows = [json.loads(x) for x in Path(entry["path"]).read_text().splitlines() if x.strip()]
    assert len(rows) == 13 and rows[-1] == {"source": "the dax 4 wakes up", "reference": "daxko4 wek"}
    assert ws.ledger.find(DEV_GROWN)[-1]["added"] == 5


def test_a_sentence_already_in_dev_or_test_is_left_out(ws, dev_set, test_set, tmp_path):
    f = _practice(tmp_path, "practice-round-1.tsv", [
        ("the dax 0 sleeps now", "daxko0 pel sun"),        # already a dev sentence
        ("see the tozer 3 clearly", "tozka3 miv rel"),     # a test sentence: never into dev
        ("a brand new one", "brandko nu")])
    e = grow_dev(ws, "toy-dev", [f])
    assert e["added"] == 1 and e["skipped"]["in_dev"] == 1 and e["skipped"]["in_test"] == 1


def test_a_practice_file_is_merged_once(ws, dev_set, tmp_path):
    f = _practice(tmp_path, "practice-round-1.tsv", [("a brand new one", "brandko nu")])
    grow_dev(ws, "toy-dev", [f])
    again = grow_dev(ws, "toy-dev", [f])
    assert again["added"] == 0 and again["skipped"]["already_merged"] == 1
    assert len(merged_files(ws, "toy-dev")) == 1 and again["after"] == 9


def test_only_a_dev_set_grows(ws, test_set, tmp_path):
    f = _practice(tmp_path, "practice-round-1.tsv", [("a brand new one", "brandko nu")])
    with pytest.raises(ForgeError, match="not a dev set"):
        grow_dev(ws, "toy-test", [f])


def test_the_grown_dev_set_keeps_the_practice_files_protections(ws, dev_set, tmp_path):
    f = _practice(tmp_path, "practice-round-1.tsv", [("a brand new one", "brandko nu")])
    Path(str(f) + ".champollion.json").write_text(json.dumps(
        {"role": "dev", "transmission": "local-only", "terms": {"training": "not-allowed"}}))
    e = grow_dev(ws, "toy-dev", [f])
    side = json.loads(Path(e["path"] + ".champollion.json").read_text())
    assert side["transmission"] == "local-only" and side["terms"]["training"] == "not-allowed"
