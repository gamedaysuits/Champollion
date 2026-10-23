""""No model may train on this" is enforced, not advice (set/1 terms).

`champollion data mark <file> --training not-allowed` writes
``terms.training: not-allowed`` into the file's sidecar. forge carries it onto
every file cut from that one (a split's train side would otherwise launder
it), and the training mix refuses any file that carries it — before reading
anything. Only the data's holders can lift it, by hand.
"""

from __future__ import annotations

import json

import pytest

from nmt_forge.errors import ConfigError
from nmt_forge.privacy import (
    carried_mark, carry_mark, describe_mark, merge_marks, training_not_allowed)
from nmt_forge.training.config import RunConfig
from nmt_forge.training.mix import build_mix
from tests.conftest import write_jsonl

NOT_ALLOWED = {"terms": {"training": "not-allowed"}}


def _mark(path, body):
    (path.parent / (path.name + ".champollion.json")).write_text(
        json.dumps(body), encoding="utf-8")


def _gold(tmp_path, name="gold.jsonl"):
    return write_jsonl(tmp_path / name, [
        {"source": "the wug runs fast", "target": "wugto blar"},
        {"source": "a dax sleeps here", "target": "daxko pel"}])


def _cfg(*gold):
    return RunConfig.from_dict({
        "run_name": "t", "model": {"backend": "dummy"},
        "data": {"gold": [str(g) for g in gold], "dev": "toy-dev"},
        "mix": {"kind_cap": None},
    })


def test_training_not_allowed_reads_the_sidecar(tmp_path):
    g = _gold(tmp_path)
    assert training_not_allowed(g) is False
    _mark(g, {"$schema": "https://champollion.dev/schemas/set/1.json",
              "transmission": "local-only", **NOT_ALLOWED})
    assert training_not_allowed(g) is True


def test_the_mix_refuses_a_file_its_holders_did_not_agree_to(ws, tmp_path):
    ok = _gold(tmp_path, "ok.jsonl")
    refused = _gold(tmp_path, "refused.jsonl")
    _mark(refused, {"transmission": "local-only", **NOT_ALLOWED})
    with pytest.raises(ConfigError) as ei:
        build_mix(_cfg(ok, refused), ws)
    msg = str(ei.value)
    assert "training refused" in msg and "refused.jsonl" in msg
    assert "ok.jsonl" not in msg.split("why:")[0]
    assert "no command lifts the restriction" in msg


def test_allowed_and_unmarked_files_still_train(ws, tmp_path):
    g = _gold(tmp_path)
    _mark(g, {"transmission": "local-only", "terms": {"training": "allowed"}})
    assert build_mix(_cfg(g), ws).manifest["gold"]["rows"] == 2


def test_the_term_travels_to_every_piece_cut_from_the_file(tmp_path):
    src = _gold(tmp_path, "corpus.jsonl")
    _mark(src, {"transmission": "local-only", **NOT_ALLOWED})
    mark = carried_mark(src)
    assert mark["terms"] == {"training": "not-allowed"}
    piece = write_jsonl(tmp_path / "train.jsonl", [{"source": "a", "target": "b"}])
    carry_mark(src, [piece], command="split", mark=mark)
    assert training_not_allowed(piece) is True


def test_merge_is_strict_and_the_mark_reads_in_words():
    merged = merge_marks({"transmission": "local-only"}, NOT_ALLOWED,
                         {"terms": {"training": "allowed"}})
    assert merged == {"transmission": "local-only", **NOT_ALLOWED}
    assert describe_mark(merged) == "transmission local-only, training not-allowed"
