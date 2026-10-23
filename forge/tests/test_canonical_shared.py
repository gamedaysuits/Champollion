"""forge's canonical_key IS the harness's sentence key (plus a language pack's
canonicalizer first): the split guard, leak audit and dev fence answer "are
these two sentences the same?" exactly as the contest split does. Forge's own
NFC version once disagreed (a ligature, a zero-width joiner, a symbol), so a
twin one splitter missed could straddle a split. Held to the shared vectors."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from nmt_forge.canonical import canonical_key

VECTORS = Path(__file__).resolve().parents[2] / "shared" / "test-fixtures" / "sentence-key-vectors.json"


@pytest.mark.skipif(not VECTORS.is_file(), reason="monorepo shared/ absent")
def test_the_shared_vectors():
    v = json.loads(VECTORS.read_text(encoding="utf-8"))
    for case in v["cases"]:
        assert canonical_key(case["text"]) == case["key"], case
    for group in v["same"]:
        assert len({canonical_key(t) for t in group}) == 1, group
    for group in v["different"]:
        assert len({canonical_key(t) for t in group}) == len(group), group


def test_a_pack_canonicalizer_runs_first():
    # an orthography convention (macron ↔ circumflex) is the pack's to merge
    pack = lambda s: s.replace("ī", "î").replace("ē", "ê")  # noqa: E731
    assert canonical_key("kīwē!", pack) == canonical_key("kîwê") == "kîwê"
    assert canonical_key("kīwē") != canonical_key("kîwê")
