"""The code-switching check's SOURCE script (2026-10-10).

Before: the plugin read ``scriptUnicodeName`` (no atlas card carries it) and
discovery never passed the source language, so the source script was Latin on
every run — a Cyrillic source word left in an English output was never
counted. Now: a named ``source_script``, else the ONE script the source card
lists (through the card adapter), else Latin, recorded as assumed.

Invented language codes (private use, qaa–qtz), invented cards and invented
words only; the card adapter's ``get_card`` is replaced so nothing here
depends on the atlas build.
"""

from __future__ import annotations

import pytest

from mt_eval_harness import language_cards
from mt_eval_harness.plugin_discovery import _generic_plugins, _load_code_switching
from mt_eval_harness.plugins.code_switching import CodeSwitchingPlugin, card_script

# Invented cards: a one-script Cyrillic language, a two-script one, a
# one-script language whose script this check has no label for, a card in
# the published projection's shape ({"name", "source"} entries), and a
# one-script syllabics TARGET in that same shape.
CARDS = {
    "qca": {"scripts": ["Cyrl"]},
    "qcb": {"scripts": ["Cyrl", "Latn"]},
    "qcc": {"scripts": ["Qabc"]},
    "qcd": {"scripts": [{"name": "Cyrl", "source": "invented-registry"}]},
    "qce": {"scripts": [{"name": "Cans", "source": "invented-registry"}]},
    "qcf": {"scripts": ["Latn"]},
}

# An invented Cyrillic-script source word and invented Latin-script words.
SRC_WORD = "зорвик"
ENTRY = {"source": f"{SRC_WORD} блентар", "predicted": f"vasp {SRC_WORD}",
         "expected": "vasp tremlo"}


@pytest.fixture
def invented_cards(monkeypatch):
    monkeypatch.setattr(language_cards, "get_card", lambda code: CARDS.get(code))


def test_a_one_script_source_card_names_the_source_script(invented_cards):
    p = _load_code_switching({"source_code": "qca", "target_code": "qcf"})
    assert (p.source_script, p.source_script_basis) == ("Cyrillic", "card")
    assert p.source_script_note == "the qca card lists one script, Cyrl"
    r = p.compute(ENTRY)
    assert r["cs_wrong_script_tokens"] == 1 and r["code_switching_rate"] == 0.5


def test_before_the_fix_the_same_entry_scored_zero():
    """What every non-Latin-source run got: Latin as the source script, so
    the leaked Cyrillic word was not counted."""
    r = CodeSwitchingPlugin(source_script="Latin").compute(ENTRY)
    assert r["cs_wrong_script_tokens"] == 0 and r["code_switching_rate"] == 0.0


def test_several_scripts_are_never_guessed_among(invented_cards):
    p = _load_code_switching({"source_code": "qcb", "target_code": "qcf"})
    assert (p.source_script, p.source_script_basis) == ("Latin", "assumed")
    assert "the qcb card lists Cyrl, Latn" in p.source_script_note
    assert "none is picked from several" in p.source_script_note
    assert "not counted" in p.source_script_note
    # the honest limit: the leaked word is not counted, and the report says why
    assert p.compute(ENTRY)["cs_wrong_script_tokens"] == 0


def test_a_named_source_script_decides(invented_cards):
    p = _load_code_switching({"source_code": "qcb", "source_script": "cyrl",
                              "target_code": "qcf"})
    assert (p.source_script, p.source_script_basis) == ("Cyrillic", "named")
    assert p.compute(ENTRY)["cs_wrong_script_tokens"] == 1


def test_a_named_source_script_with_no_label_is_refused():
    with pytest.raises(SystemExit, match="source_script 'Qabc'.*name one of those"):
        _load_code_switching({"source_script": "Qabc"})


def test_a_card_script_with_no_label_leaves_latin_assumed(invented_cards):
    p = _load_code_switching({"source_code": "qcc"})
    assert (p.source_script, p.source_script_basis) == ("Latin", "assumed")
    assert "lists one script, Qabc, which this check has no label for" in p.source_script_note


def test_no_source_code_reads_no_card(monkeypatch):
    def refuse(code):
        raise AssertionError(f"no card should be read, got {code!r}")
    monkeypatch.setattr(language_cards, "get_card", refuse)
    p = _load_code_switching({})
    assert (p.source_script, p.source_script_basis) == ("Latin", "assumed")
    assert p.source_script_note.startswith("the run names no source language code")


def test_no_card_for_the_source_code_is_said(invented_cards):
    p = _load_code_switching({"source_code": "qzz"})
    assert p.source_script_basis == "assumed"
    assert p.source_script_note.startswith("no language card for 'qzz'")


def test_the_legacy_source_lang_code_key_is_read(invented_cards):
    p = _load_code_switching({"source_lang_code": "qca"})
    assert (p.source_script, p.source_script_basis) == ("Cyrillic", "card")


def test_the_published_projection_shape_is_read_through_the_adapter(invented_cards):
    """{"name", "source"} entries (the shape a pip install reads in remote
    mode): read by script_codes, for the source and for the target."""
    assert card_script("qcd") == ("Cyrl", "the qcd card lists one script, Cyrl")
    p = _load_code_switching({"source_code": "qcd", "target_code": "qce"})
    assert p.source_script == "Cyrillic"
    assert p.target_script_hint == "Canadian_Aboriginal"


def test_the_aggregate_records_which_source_script_was_counted(invented_cards):
    p = _load_code_switching({"source_code": "qca", "target_code": "qcf"})
    agg = p.aggregate([p.compute(ENTRY)])
    assert agg["avg_code_switching_rate"] == 0.5
    assert agg["source_script"] == "Cyrillic"
    assert agg["source_script_basis"] == "card"
    assert agg["source_script_note"] == "the qca card lists one script, Cyrl"


def test_discovery_says_which_source_script_it_counts(invented_cards, capsys):
    plugins = _generic_plugins({"source_code": "qcb", "target_code": "qcf"})
    assert any(p.name == "code_switching" for p in plugins)
    out = capsys.readouterr().out
    assert "source script: Latin (assumed: the qcb card lists Cyrl, Latn" in out


def test_publish_reads_the_moved_rate(invented_cards):
    """publish.derive_scores carries the aggregate's avg_code_switching_rate
    as the run card's code_switching_rate; the per-entry rate sets
    run_card_entries.code_switching_detected. Both move for a non-Latin
    source; the new string fields do not disturb either."""
    from mt_eval_harness.publish import _extract_lyss_verdicts, derive_scores

    p = _load_code_switching({"source_code": "qca", "target_code": "qcf"})
    per_entry = p.compute(ENTRY)
    report = {"overall": {"plugin_metrics": {"code_switching": p.aggregate([per_entry])}}}
    assert derive_scores(report, {})["code_switching_rate"] == 0.5
    assert _extract_lyss_verdicts({"code_switching": per_entry}) == {
        "code_switching_detected": True}
