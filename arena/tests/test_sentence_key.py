"""The sentence identity key (text_compare.sentence_key): one answer to "are
these two sentences the same?" for every place a leak could hide — forge's
split guard, leak audit and dev fence, and the contest split. Held to the
shared vectors forge's suite reads too."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness.text_compare import sentence_key

VECTORS = Path(__file__).resolve().parents[2] / "shared" / "test-fixtures" / "sentence-key-vectors.json"


@pytest.mark.skipif(not VECTORS.is_file(), reason="monorepo shared/ absent")
def test_every_vector():
    v = json.loads(VECTORS.read_text(encoding="utf-8"))
    for case in v["cases"]:
        assert sentence_key(case["text"]) == case["key"], case
    for group in v["same"]:
        assert len({sentence_key(t) for t in group}) == 1, group
    for group in v["different"]:
        assert len({sentence_key(t) for t in group}) == len(group), group


def test_the_contest_split_uses_it():
    from mt_eval_harness import contest_prep

    assert contest_prep._norm_text("ﬁne, ok") == sentence_key("fine ok")
    assert contest_prep.SPLIT_METHOD == "group-disjoint/2"
