"""
Atlas-envelope contract for the RUNTIME card seam (language_cards.py).

test_language_cards.py pins the low-level primitives (display /
attributions / is_disputed in language_cards.py) and
test_language_cards_failhonest.py pins the loader's fail-loud behaviour, but
nothing exercised the loader against ATLAS-SHAPED cards — attribution
envelopes, the isoLanguageType/isoScope words, locale blocks. Every private
reader written since the cutover shipped a broken surface (the MCP server
served "[object Object]" for weeks), so the adapter's guarantees are pinned
here at the ONE public seam — get_card()/get_name()/resolve_name() — over a
tmp directory of synthetic atlas-shape cards.

Runs fully offline: MT_EVAL_CARDS_DIR points at the tmp corpus, so the loader
takes the local-dir path and never reaches the network. The reset pattern
copies test_language_cards_failhonest.py exactly, plus a snapshot/restore of
the catalogue caches so a tmp-dir cache miss never leaks into other tests.
"""

from __future__ import annotations

import json

import pytest

from mt_eval_harness import language_cards as lc


# ---------------------------------------------------------------------------
# The synthetic atlas-shape corpus
# ---------------------------------------------------------------------------

CARDS = {
    # A language card wearing every envelope the adapter must resolve.
    "tst": {
        "code": "tst",
        "name": {
            "agreement": "unanimous",
            "values": [{"value": "Testish", "source": "glottolog-v5.0"}],
        },
        "endonym": {
            "agreement": "unanimous",
            "values": [{"value": "testli", "source": "linguameta-v1"}],
        },
        "isoLanguageType": "Living",
        "isoScope": "Individual",
        "speakerEstimates": {
            "agreement": "disputed",
            "values": [
                {"value": "1234", "source": "s1"},
                {"value": "5000", "source": "s2"},
            ],
        },
        "_fieldSources": {
            "name": ["glottolog-v5.0"],
            "isoLanguageType": ["iso639-3-v2026"],
            "speakerEstimates": ["s1", "s2"],
        },
        "_atlas": {"version": "test-atlas-v1"},
    },
    # A macrolanguage hub: consumers test isoScopeInitial == "M".
    "mac": {
        "code": "mac",
        "name": "Macroish",
        "isoLanguageType": "Living",
        "isoScope": "Macrolanguage",
        "_atlas": {"version": "test-atlas-v1"},
    },
    # A locale card: a PROJECTION of its language, identified by its locale
    # block. It carries the language's bare name, which it must not claim.
    "tst-CA": {
        "code": "tst-CA",
        "name": "Testish",
        "locale": {"language": "tst", "region": "CA"},
        "_atlas": {"version": "test-atlas-v1"},
    },
    # Registries disagree about the name: the FIRST recorded value labels the
    # card (identity opt-in), deterministically.
    "dsp": {
        "code": "dsp",
        "name": {
            "agreement": "conflicting",
            "values": [
                {"value": "Firstish", "source": "wals-2020"},
                {"value": "Secondish", "source": "glottolog-v5.0"},
            ],
        },
        "_atlas": {"version": "test-atlas-v1"},
    },
}


@pytest.fixture(autouse=True)
def _atlas_cards_dir(monkeypatch, tmp_path):
    """Fresh loader state pointed at a tmp corpus of atlas-shape cards."""
    # Reset pattern copied from test_language_cards_failhonest.py.
    lc._cards.clear()
    lc._parent_cards.clear()
    lc._aliases.clear()
    lc._name_index.clear()
    lc._resolved_cache.clear()
    lc._loaded = False
    lc._cards_dir = None
    lc._mode = "none"
    # Never read or write the real on-disk index cache during tests.
    monkeypatch.setattr(lc, "_read_remote_index_cache", lambda **kw: None)
    monkeypatch.setattr(lc, "_write_remote_index_cache", lambda rows: None)
    for var in ("MT_EVAL_NO_REMOTE_REGISTRY", "CHAMPOLLION_OFFLINE",
                "CHAMPOLLION_CARDS_DIR"):
        monkeypatch.delenv(var, raising=False)
    # The catalogue caches (_eval_config_for and friends) walk up from
    # _cards_dir. Left alone, this test would either reuse catalogues another
    # test resolved from the real repo, or — worse — cache an EMPTY miss
    # resolved from the tmp dir for every test after us. monkeypatch.setattr
    # snapshots each one and restores it at teardown.
    for cache in ("_SCRIPT_RTL", "_VITALITY_SCALES", "_METRIC_QE",
                  "_METRIC_PIVOTS", "_EVAL_CONFIG", "_REGISTER_PRESETS",
                  "_SUPERSEDED_FAMILIES"):
        monkeypatch.setattr(lc, cache, None)

    cards_dir = tmp_path / "language-cards"
    cards_dir.mkdir()
    for code, card in CARDS.items():
        (cards_dir / f"{code}.json").write_text(
            json.dumps(card, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setenv("MT_EVAL_CARDS_DIR", str(cards_dir))
    yield
    # Clear the indexes too, not just the flags: with _loaded=False a later
    # test triggers a fresh real-corpus load, but _ensure_loaded does not
    # clear first — a lingering "tst" would survive into that index.
    lc._cards.clear()
    lc._parent_cards.clear()
    lc._aliases.clear()
    lc._name_index.clear()
    lc._resolved_cache.clear()
    lc._loaded = False
    lc._cards_dir = None
    lc._mode = "none"


# ---------------------------------------------------------------------------
# Name envelopes
# ---------------------------------------------------------------------------

class TestNameEnvelope:
    def test_envelope_name_resolves_to_the_labelling_string(self):
        card = lc.get_card("tst")
        assert card is not None
        # name is IDENTITY: the runtime must get a string, never the envelope
        # dict ("[object Object]" was served for weeks this way).
        assert card["name"] == "Testish"
        assert isinstance(card["name"], str)

    def test_disagreeing_name_takes_the_first_recorded_value(self):
        # The documented identity opt-in: on the languages where registries
        # disagree, the first recorded value labels the card.
        assert lc.get_card("dsp")["name"] == "Firstish"

    def test_name_resolution_finds_the_resolved_name(self):
        assert lc.resolve_name("Testish") == "tst"
        assert lc.get_name("tst") == "Testish"
        # The labelling value of a disputed name resolves too.
        assert lc.resolve_name("Firstish") == "dsp"

    def test_endonym_envelope_bridges_to_native_name(self):
        assert lc.get_card("tst")["nativeName"] == "testli"


# ---------------------------------------------------------------------------
# ISO word → initial bridges
# ---------------------------------------------------------------------------

class TestIsoBridges:
    def test_iso_language_type_word_bridges_to_the_initial(self):
        # ISO 639-3 publishes "Living"; consumers count with isoType == "L".
        assert lc.get_card("tst")["isoType"] == "L"

    def test_iso_scope_initial_offered_alongside_the_word(self):
        assert lc.get_card("tst")["isoScopeInitial"] == "I"
        card = lc.get_card("mac")
        assert card["isoScopeInitial"] == "M"
        # The atlas's legible word stays; the initial is offered ALONGSIDE.
        assert card["isoScope"] == "Macrolanguage"

    def test_iso_type_field_source_travels_with_the_bridge(self):
        fs = lc.get_card("tst")["_fieldSources"]
        assert fs["isoType"] == fs["isoLanguageType"]


# ---------------------------------------------------------------------------
# Speaker estimates: the envelope IS the list
# ---------------------------------------------------------------------------

class TestSpeakerEstimates:
    def test_envelope_becomes_the_list_the_display_layers_iterate(self):
        est = lc.get_card("tst")["speakerEstimates"]
        assert isinstance(est, list)
        assert all(isinstance(e, dict) and "count" in e for e in est)
        # One entry per source, numeric strings converted, NEVER flattened
        # to a single number — the disagreement is the point.
        assert [e["count"] for e in est] == [1234, 5000]
        assert [e["source"] for e in est] == ["s1", "s2"]


# ---------------------------------------------------------------------------
# Locale cards are projections, not languages
# ---------------------------------------------------------------------------

class TestLocaleProjection:
    def test_locale_card_carries_its_languages_iso639_3(self):
        # fra-CA is French; tst-CA is Testish. The locale block names the
        # parent explicitly — a lookup, not a parse of the id.
        card = lc.get_card("tst-CA")
        assert card is not None
        assert card["iso639_3"] == "tst"

    def test_bare_name_belongs_to_the_language_not_the_locale(self):
        # Both tst and tst-CA carry "Testish"; the LANGUAGE must win the name
        # index regardless of load order.
        assert lc.resolve_name("Testish") == "tst"
