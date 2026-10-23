"""The two-letter → three-letter code table the harness ships (offline
language comparison in mt-eval serve) is the shared one, built from the cards."""
import json
from pathlib import Path

import pytest

from mt_eval_harness import serve

BUNDLED = Path(serve.__file__).parent / "data" / "catalogue" / "iso639-1.json"
SHARED = Path(__file__).resolve().parents[2] / "shared" / "catalogue" / "iso639-1.json"


def test_the_bundled_table_is_the_shared_one():
    if not SHARED.exists():
        pytest.skip("shared/ not here (standalone install)")
    assert BUNDLED.read_text(encoding="utf-8") == SHARED.read_text(encoding="utf-8"), (
        "regenerate: node cli/scripts/build-iso639-1-map.mjs")


def test_en_and_eng_are_one_language_with_no_card(monkeypatch):
    import mt_eval_harness.language_cards as lc
    monkeypatch.setattr(lc, "get_card", lambda code: None)       # offline, nothing cached
    assert serve._base("en") == "eng"
    assert serve._base("en-US") == "eng"
    assert serve._base("eng") == "eng"
    assert serve._base("qaa") == "qaa"
    doc = json.loads(BUNDLED.read_text(encoding="utf-8"))
    assert doc["source"].startswith("derived:"), "a derived table names its upstream"
