"""SSOT card discovery — the general-tool contract.

The fixture cards span the diversity the tool must serve without special
cases: an analyzer+referee language (crk-shaped), a corpus-rich
no-analyzer language (fra-shaped), a nearly-bare card (nav-shaped), and an
RTL language. Real-card smoke tests at the bottom run against the actual
monorepo SSOT with low-churn structural assertions.
"""

import json

import pytest

from nmt_forge.cards import cards_dir, discover, format_report, load_card
from nmt_forge.errors import ResourceMissing


def _write_card(directory, code, card):
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"{code}.json").write_text(json.dumps(card), encoding="utf-8")


@pytest.fixture
def fixture_cards(tmp_path):
    d = tmp_path / "cards"
    _write_card(d, "qaa", {  # analyzer + referee + eval sets (crk-shaped)
        "name": "Toylang A", "family": "Toylandic", "dir": "ltr",
        "scripts": [{"code": "Latn", "name": "Latin (TRO)", "primary": True}],
        "orthographicStatus": "developing",
        "resources": {"fsts": [
            {"name": "Toy FST", "type": "morphological-analyzer",
             "install": {"repo": "toy/lang-qaa", "releaseTag": "v1"}},
        ], "corpora": [{"name": "toy-mono", "type": "monolingual",
                        "exposure": "open-web"}]},
        "encyclopedic": {"resources": {"dictionaries": [
            {"name": "Toy Dictionary", "url": "https://example.invalid/dict"}]}},
        "corpusAvailability": {"opus": {"corpora": 2, "totalAlignmentPairs": 900}},
        "evalDatasets": ["eval-toy-1"],
        "evalMetrics": {"toy-eq": {"module": "toy.metrics", "class": "ToyLinter"}},
        "evalStandard": {"pip": "toy-lyss>=0.1"},
        "evalPack": {"requiresFst": True},
        "typologicalProfile": {"inflectionalStrategy": "Mostly suffixing"},
    })
    _write_card(d, "qae", {  # F5-schematized fields (post-2026-07-12 card shape)
        "name": "Toylang E", "dir": "ltr",
        "scripts": [{"code": "Cans", "primary": True}, {"code": "Latn"}],
        "orthographicStatus": "developing",
        "orthographies": [
            {"script": "Cans", "canonicalForMt": False, "source": "manual-curation"},
            {"script": "Latn", "scheme": "TRO", "longVowelMarking": "circumflex",
             "canonicalForMt": True, "source": "manual-curation"},
        ],
        "resources": {
            "dictionaries": [
                {"name": "Sealed Toy Dictionary", "url": "https://example.invalid/d",
                 "machineReadable": True, "redistributable": False,
                 "source": "manual-curation"}],
            "grammars": [
                {"author": "Doe, Jane", "year": 1980, "title": "A toy grammar",
                 "url": "https://example.invalid/ref/1", "type": "grammar"}],
        },
        "encyclopedic": {"resources": {"dictionaries": [
            {"name": "Stale Legacy Dictionary"}]}},
        "typologicalProfile": {"morphologicalSynthesis": "polysynthetic"},
    })
    _write_card(d, "qaf", {  # stale tree: legacy flat-array resources
        "name": "Toylang F",
        "resources": [{"type": "grammatical-description", "name": "WALS profile"}],
    })
    _write_card(d, "qab", {  # corpus-rich, tokenizer-only (fra-shaped)
        "name": "Toylang B", "dir": "ltr",
        "scripts": [{"code": "Latn", "name": "Latin", "primary": True}],
        "resources": {"fsts": [
            {"name": "Toy tokenizer", "type": "tokenizer"}]},
        "corpusAvailability": {"opus": {"corpora": 150,
                                        "totalAlignmentPairs": 5_000_000}},
        "evalDatasets": [],
    })
    _write_card(d, "qac", {"name": "Toylang C"})  # nearly bare (nav-shaped)
    _write_card(d, "qad", {  # RTL
        "name": "Toylang D", "dir": "rtl",
        "scripts": [{"code": "Arab", "name": "Arabic", "primary": True}],
    })
    return d


def test_analyzer_referee_language(fixture_cards):
    r = discover("qaa", cards_path=fixture_cards, check_registry=False)
    assert [a["name"] for a in r.analyzers] == ["Toy FST"]
    assert r.dictionaries[0]["name"] == "Toy Dictionary"
    assert r.plugin_specs() == ["toy.metrics:ToyLinter"]
    ladder = {rung: attained for rung, attained, _ in r.ladder()}
    assert ladder == {1: True, 2: True, 3: True, 4: True, 5: True}
    out = format_report(r)
    assert "--plugin toy.metrics:ToyLinter" in out
    assert "rung 5" in out


def test_corpus_rich_no_analyzer_language(fixture_cards):
    r = discover("qab", cards_path=fixture_cards, check_registry=False)
    assert r.analyzers == []
    assert r.other_fsts[0]["type"] == "tokenizer"
    ladder = {rung: attained for rung, attained, _ in r.ladder()}
    assert ladder[1] is True   # parallel text: yes
    assert ladder[4] is None   # no analyzer RECORDED — unknown, not "no"
    out = format_report(r)
    assert "not a morphological analyzer" in out
    assert "synthesis is off the menu" in out
    assert "every guard" in out       # the tool still fully applies


def test_bare_card_absence_is_unknown_not_zero(fixture_cards):
    r = discover("qac", cards_path=fixture_cards, check_registry=False)
    assert set(r.unknowns) >= {"scripts", "analyzers", "dictionaries",
                               "corpora", "eval datasets"}
    ladder = {rung: attained for rung, attained, _ in r.ladder()}
    assert all(v is None for v in ladder.values())  # unknown, never "no"
    out = format_report(r)
    assert "absence = unknown, not zero" in out
    assert "unknown (card is silent)" in out


def test_rtl_direction_surfaces(fixture_cards):
    r = discover("qad", cards_path=fixture_cards, check_registry=False)
    assert r.direction == "rtl"
    assert "rtl" in format_report(r)


def test_f5_schematized_fields_read_and_rendered(fixture_cards):
    r = discover("qae", cards_path=fixture_cards, check_registry=False)
    # schematized resources.dictionaries wins over the stale encyclopedic copy
    assert [d["name"] for d in r.dictionaries] == ["Sealed Toy Dictionary"]
    assert r.dictionaries[0]["_field"] == "resources.dictionaries"
    assert r.grammars[0]["title"] == "A toy grammar"
    # canonicalForMt picks the WORKING form, not the primary display script
    canon = r.canonical_orthography()
    assert canon and canon["script"] == "Latn" and canon["scheme"] == "TRO"
    assert r.typology_hints["morphological_synthesis"]["value"] == "polysynthetic"
    # grammars alone satisfy ladder rung 3 alongside the dictionary
    ladder = {rung: attained for rung, attained, _ in r.ladder()}
    assert ladder[3] is True
    out = format_report(r)
    assert "POINTER-ONLY" in out                      # redistributable: false is loud
    assert "Doe, Jane (1980). A toy grammar" in out   # citation rendering
    assert "CANONICAL working form" in out
    assert "long vowels: circumflex" in out


def test_legacy_dictionaries_fallback_still_works(fixture_cards):
    r = discover("qaa", cards_path=fixture_cards, check_registry=False)
    assert r.dictionaries[0]["_field"] == "encyclopedic.resources.dictionaries"


def test_stale_flat_array_resources_is_silent_not_a_crash(fixture_cards):
    r = discover("qaf", cards_path=fixture_cards, check_registry=False)
    assert r.analyzers == [] and r.grammars == []
    assert "analyzers" in r.unknowns


def test_missing_card_suggests_near_codes(fixture_cards):
    with pytest.raises(ResourceMissing) as e:
        load_card("qaz", cards_path=fixture_cards)
    msg = str(e.value)
    assert "ISO 639-3" in msg and "qaa" in msg  # near-code suggestions


def test_missing_cards_dir_is_actionable(tmp_path, monkeypatch):
    monkeypatch.delenv("CHAMPOLLION_CARDS_DIR", raising=False)
    with pytest.raises(ResourceMissing, match="CHAMPOLLION_CARDS_DIR"):
        cards_dir(tmp_path / "nowhere")


def test_env_var_override(fixture_cards, monkeypatch):
    monkeypatch.setenv("CHAMPOLLION_CARDS_DIR", str(fixture_cards))
    assert cards_dir() == fixture_cards


# -- the real SSOT (monorepo walk-up) — low-churn structural assertions -------

def _real_cards_available() -> bool:
    try:
        cards_dir()
        return True
    except ResourceMissing:
        return False


@pytest.mark.skipif(not _real_cards_available(),
                    reason="monorepo language-cards not found")
def test_real_ssot_smoke_diversity():
    crk = discover("crk", check_registry=False)
    assert any("lang-crk" in str(a.get("install", {}).get("repo", ""))
               for a in crk.analyzers)
    assert crk.plugin_specs()  # the LYSS referee comes FROM the card
    assert any("champollion_lyss" in s for s in crk.plugin_specs())

    fra = discover("fra", check_registry=False)
    assert fra.analyzers == []          # its FST entry is a tokenizer
    assert (fra.opus or {}).get("corpora", 0) > 50

    nav = discover("nav", check_registry=False)
    assert "analyzers" in nav.unknowns

    arb = discover("arb", check_registry=False)
    assert arb.direction == "rtl"


@pytest.mark.skipif(not _real_cards_available(),
                    reason="monorepo language-cards not found")
def test_real_registry_flags_do_not_train():
    crk = discover("crk", check_registry=True)
    if crk.registry_note:  # registry unreachable → honest note, not silence
        assert "NOT verified" in crk.registry_note
        return
    flagged = [e for e in crk.eval_datasets if e.get("do_not_train")]
    assert flagged, "crk eval datasets must carry do_not_train from the registry"