"""SSOT card discovery — the general-tool contract.

The fixture cards span the diversity the tool must serve without special
cases: an analyzer+referee language (crk-shaped), a corpus-rich
no-analyzer language (fra-shaped), a nearly-bare card (nav-shaped), and an
RTL language. Real-card smoke tests at the bottom run against the actual
monorepo SSOT with low-churn structural assertions.
"""

import json
from pathlib import Path

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
    _write_card(d, "qag", {  # atlas-shaped (2026-08 cutover): scripts are codes
        "name": "Toylang G", "dir": "ltr", "scripts": ["Cans", "Latn"],
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
    # rung 5: the card declares a referee, but toy.metrics is not installed
    # here — unavailable, never ticked (Round 7). Rung 4: the card lists an
    # analyzer, but nothing confirms it is usable HERE (the harness pins no
    # install for a toy code) — exists, never ticked (Round 9)
    assert ladder == {1: True, 2: True, 3: True, 4: False, 5: False}
    rung4 = {n: t for n, _, t in r.ladder()}[4]
    assert "EXISTS (the card lists Toy FST)" in rung4
    out = format_report(r)
    assert "--plugin toy.metrics:ToyLinter" in out
    assert "rung 5" in out and "UNAVAILABLE here" in out


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


def test_atlas_script_codes_render(fixture_cards):
    # `nmt-forge init crk` crashed on the live corpus: atlas cards list
    # scripts as ISO 15924 codes, the fixtures only had the older objects.
    r = discover("qag", cards_path=fixture_cards)
    out = format_report(r)
    assert "scripts: Cans, Latn" in out
    assert "[primary]" not in out  # never invent a primary the card did not state


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
    # near codes come from the same two-letter prefix; a private-use code
    # (qaa–qtz) never gets them (Round 8: see test_round8_forge)
    _write_card(fixture_cards, "zxa", {"name": "Toylang ZXA"})
    with pytest.raises(ResourceMissing) as e:
        load_card("zxb", cards_path=fixture_cards)
    msg = str(e.value)
    assert "ISO 639-3" in msg and "Near codes: zxa" in msg
    with pytest.raises(ResourceMissing) as e:
        load_card("qaz", cards_path=fixture_cards)
    assert "private-use code" in str(e.value)
    assert "Near codes" not in str(e.value)


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

# -- the pip-install path: the harness's resolver, never a monorepo walk -----
#
# Synthetic users with ONLY the wheels (no checkout) found `discover`/`init`
# dead: forge looked for cards in a monorepo it wasn't in. forge now asks the
# harness's resolver (env → checkout/node_modules walk-up → public index +
# cache). These tests fake the harness's PUBLIC API to stand in for "no
# local cards anywhere" — the remote index itself is the harness's to test.

@pytest.fixture
def no_local_cards(monkeypatch):
    monkeypatch.delenv("CHAMPOLLION_CARDS_DIR", raising=False)
    monkeypatch.delenv("MT_EVAL_CARDS_DIR", raising=False)
    from nmt_forge import _harness

    return _harness.language_cards_mod()


def test_remote_index_card_resolves_through_harness(no_local_cards, monkeypatch):
    lc = no_local_cards
    calls = []

    def fake_get_card(code):
        calls.append(code)
        # an atlas-shaped detail blob as the public index serves it: the
        # name is an attribution ENVELOPE, which only the adapter resolves
        return {"code": "qaa", "name": {"agreement": "unanimous",
                                        "consensus": "Toylang A",
                                        "values": [{"value": "Toylang A",
                                                    "source": "x"}]},
                "resources": {"fsts": [{"name": "Toy FST",
                                        "type": "morphological-analyzer"}]}}

    monkeypatch.setattr(lc, "get_card", fake_get_card)
    monkeypatch.setattr(lc, "get_cards_dir", lambda: None)   # remote mode
    monkeypatch.setattr(lc, "get_all_codes", lambda: ["qaa"])
    from nmt_forge import cards as cards_mod

    monkeypatch.setattr(cards_mod, "_fetch_index_row", lambda code: None)
    r = discover("qaa", check_registry=False)
    assert calls == ["qaa"]
    assert r.name == "Toylang A"                 # envelope → adapter display
    assert "public card index" in r.card_path
    assert [a["name"] for a in r.analyzers] == ["Toy FST"]


def test_unreachable_index_says_exactly_what_to_do(no_local_cards, monkeypatch):
    lc = no_local_cards
    from nmt_forge import _harness

    remote = _harness.language_cards_remote_mod()

    def down(code):
        raise remote.LanguageCardsUnavailable("index unreachable (offline)")

    monkeypatch.setattr(lc, "get_card", down)
    with pytest.raises(ResourceMissing) as e:
        discover("qaa", check_registry=False)
    msg = str(e.value)
    # the documented workaround is now THE documented fallback
    assert "champollion network card <code> --json" in msg and "--cards-dir" in msg


def test_unknown_code_from_index_suggests_near_codes(no_local_cards, monkeypatch):
    lc = no_local_cards
    monkeypatch.setattr(lc, "get_card", lambda code: None)
    monkeypatch.setattr(lc, "get_cards_dir", lambda: None)
    monkeypatch.setattr(lc, "get_all_codes", lambda: ["zxa", "zxc", "fra"])
    with pytest.raises(ResourceMissing) as e:
        load_card("zxb")
    assert "Near codes: zxa, zxc" in str(e.value)
    assert "fra" not in str(e.value)


def test_harness_env_var_name_is_honored(fixture_cards, no_local_cards,
                                         monkeypatch):
    monkeypatch.setenv("MT_EVAL_CARDS_DIR", str(fixture_cards))
    assert cards_dir() == fixture_cards
    assert discover("qab", check_registry=False).name == "Toylang B"


def test_env_dir_without_cards_is_an_error_not_a_fallback(tmp_path,
                                                          no_local_cards,
                                                          monkeypatch):
    empty = tmp_path / "empty"
    empty.mkdir()
    monkeypatch.setenv("MT_EVAL_CARDS_DIR", str(empty))
    with pytest.raises(ResourceMissing, match="holds no language cards"):
        discover("qaa", check_registry=False)


def test_cards_exported_by_the_champollion_cli_work(tmp_path, no_local_cards):
    # what `champollion network card qaa --json > cards/qaa.json` writes: the JS
    # reader's already-normalized card (idempotent through the adapter)
    d = tmp_path / "cards"
    _write_card(d, "qaa", {"code": "qaa", "name": "Toylang A",
                           "iso639_3": "qaa", "dir": "ltr",
                           "scripts": [{"code": "Latn", "primary": True}]})
    from nmt_forge.scaffold import init_project

    summary = init_project("qaa", tmp_path / "proj", cards_path=d)
    assert summary["language"]["card"].endswith("qaa.json")
    assert (tmp_path / "proj" / "config.json").is_file()


# -- the public index is TWO tables: detail blob + identity row --------------
#
# `nmt-forge discover abc` said "unknown (card is silent): scripts" while
# `champollion network card abc` and the MCP server showed Latn: the harness's remote
# get_card returns the detail blob, and the script lives on the index ROW the
# CLI merges in (cli/lib/cards/remote.js buildCardFromRemote).

def _remote(monkeypatch, lc, detail, row):
    from nmt_forge import cards as cards_mod

    monkeypatch.setattr(lc, "get_card", lambda code: detail)
    monkeypatch.setattr(lc, "get_cards_dir", lambda: None)
    monkeypatch.setattr(lc, "get_all_codes", lambda: ["qaa"])
    fetched = []

    def fake_row(code):
        fetched.append(code)
        return row

    monkeypatch.setattr(cards_mod, "_fetch_index_row", fake_row)
    return fetched


def test_remote_card_takes_scripts_from_the_index_row(no_local_cards,
                                                      monkeypatch):
    fetched = _remote(monkeypatch, no_local_cards,
                      {"code": "qaa", "name": "Toylang A"},
                      {"code": "qaa", "script": "Latn", "dir": "ltr",
                       "scripts": [{"name": "Latn", "source": "linguameta-x"}]})
    r = discover("qaa", check_registry=False)
    assert fetched == ["qaa"]
    assert "scripts" not in r.unknowns
    assert r.scripts == [{"name": "Latn", "source": "linguameta-x",
                          "code": "Latn", "primary": True}]
    assert r.direction == "ltr"
    assert "scripts: Latn [primary]" in format_report(r)


def test_index_row_fills_but_never_overwrites_the_detail(no_local_cards,
                                                         monkeypatch):
    _remote(monkeypatch, no_local_cards,
            {"code": "qaa", "name": "Toylang A", "dir": "rtl",
             "script": "Arab", "scripts": ["Arab"]},
            {"code": "qaa", "script": "Latn", "dir": "ltr",
             "scripts": [{"name": "Latn"}], "is_isolate": None,
             "macroarea": "Eurasia"})
    from nmt_forge.cards import resolve_card

    card, _ = resolve_card("qaa")
    assert card["dir"] == "rtl" and card["script"] == "Arab"
    assert card["macroarea"] == "Eurasia"       # absent in detail → filled
    assert "isIsolate" not in card               # None is never a value
    r = discover("qaa", check_registry=False)
    assert r.direction == "rtl"
    assert r.scripts == [{"code": "Arab", "primary": True}]


def test_unreadable_index_row_is_loud_not_a_silent_unknown(no_local_cards,
                                                           monkeypatch):
    from nmt_forge import _harness
    from nmt_forge import cards as cards_mod

    remote = _harness.language_cards_remote_mod()
    _remote(monkeypatch, no_local_cards, {"code": "qaa", "name": "A"}, None)

    def down(code):
        raise remote.LanguageCardsUnavailable("index row: offline")

    monkeypatch.setattr(cards_mod, "_fetch_index_row", down)
    with pytest.raises(ResourceMissing, match="identity row"):
        discover("qaa", check_registry=False)


def test_primary_script_comes_from_the_adapter(tmp_path, no_local_cards):
    d = tmp_path / "cards"
    # atlas shape: no scripts[] at all, only the cited full tag — the
    # adapter's bridge (normalize_card) derives the script, as the CLI does
    _write_card(d, "qaa", {"code": "qaa", "name": "Toylang A",
                           "bcp47FullTag": {"agreement": "unanimous",
                                            "consensus": "qaa-Latn-ZZ",
                                            "values": [{"value": "qaa-Latn-ZZ",
                                                        "source": "cldr"}]}})
    # multi-script + full tag: the cited one is marked, the other kept
    _write_card(d, "qab", {"code": "qab", "name": "Toylang B",
                           "scripts": ["Cans", "Latn"],
                           "bcp47FullTag": "qab-Cans-ZZ"})
    a = discover("qaa", cards_path=d, check_registry=False)
    assert a.scripts == [{"code": "Latn", "primary": True}]
    assert "scripts" not in a.unknowns
    b = discover("qab", cards_path=d, check_registry=False)
    assert b.scripts == [{"code": "Cans", "primary": True}, {"code": "Latn"}]


# -- eval-dataset ids, said plainly ---------------------------------------

def test_eval_dataset_lines_say_what_the_user_can_do():
    from nmt_forge.cards import eval_dataset_line

    unregistered = eval_dataset_line(
        {"id": "eval-x", "in_registry": False, "runnable": False,
         "note": "not in the mt-eval dataset registry", "fixture": True,
         "reason": "its corpus card marks it a synthetic schema fixture — "
                   "not a real corpus"})
    assert "NOT RUNNABLE" in unregistered
    assert "synthetic schema fixture" in unregistered
    assert "registry add <name> <file> --role test" in unregistered
    quarantined = eval_dataset_line(
        {"id": "eval-q", "do_not_train": True, "quarantine": True,
         "contamination": "HIGH"})
    assert "NEVER TRAIN ON THIS" in quarantined
    assert "quarantined" in quarantined and "not usable as your test set" \
        in quarantined
    usable = eval_dataset_line({"id": "eval-u", "do_not_train": True,
                                "quarantine": False})
    assert "registry add-harness eval-u --role test" in usable


def test_unregistered_id_reads_its_corpus_card(tmp_path, monkeypatch):
    from nmt_forge import _harness
    from nmt_forge.cards import _unregistered

    _harness.load_harness()
    import mt_eval_harness.corpus_fetch as cf

    d = tmp_path / "corpora-cards"
    d.mkdir()
    (d / "eval-fix.json").write_text(json.dumps(
        {"id": "eval-fix", "fixture": True, "quarantine": True}))
    monkeypatch.setattr(cf, "find_corpora_cards_dir", lambda: d)
    out = _unregistered("eval-fix")
    assert out["in_registry"] is False and out["fixture"] is True
    assert "fixture" in out["reason"]
    assert _unregistered("eval-none") == {
        "in_registry": False, "runnable": False,
        "note": "not in the mt-eval dataset registry"}


def test_referee_is_reported_optional(fixture_cards):
    r = discover("qaa", cards_path=fixture_cards, check_registry=False)
    assert r.referee["installed"] is False      # toy.metrics is not a module
    out = format_report(r)
    assert "OPTIONAL" in out and "NOT installed" in out
    assert "pip install 'toy-lyss>=0.1'" in out


# -- dictionaries, grammars and typology: the fields the CLI's `card` reads -----
#
# Synthetic school persona, Round 3 (2026-10-03): `nmt-forge discover crk`
# said the card was silent on dictionaries, grammars and typology while
# `champollion network card crk` listed all three. The CLI reads
# lexicalResources.dictionaries, documentation.medLevel ("Documentation
# level") and every typologicalProfile feature (cli/lib/commands/card.js);
# forge read resources.dictionaries, resources.grammars and four fixed
# typology names the atlas never emits.

def _atlas_card():
    return {
        "code": "qah", "name": "Toylang H", "dir": "ltr",
        "lexicalResources": {"dictionaries": [
            {"name": "dict-qah-eng", "url": "https://example.invalid/dict",
             "publisher": "toylab", "license": "CC-BY-4.0",
             "licenceEstablished": True, "pairedWith": "eng"}]},
        "documentation": {"medLevel": "grammar sketch", "medSourceId": "42"},
        "typologicalProfile": {
            "wordOrder": "SOV", "hasCoreCase": False,
            "inclusiveExclusive": {
                "agreement": "incommensurable",
                "values": [{"value": "0", "source": "grambank-v1.0.3"},
                           {"value": "Inclusive/exclusive",
                            "source": "wals-v2020.5"}]},
            "verbalAlignment": {
                "agreement": "unanimous", "consensus": "Accusative",
                "values": [{"value": "Accusative", "source": "wals-v2020.5"}]},
        },
        "_fieldSources": {
            "lexicalResources.dictionaries": ["toylab-resources-2026"],
            "documentation.medLevel": ["glottolog-cldf-v5.3"],
            "typologicalProfile.wordOrder": ["wals-v2020.5"],
            "typologicalProfile.hasCoreCase": ["grambank-v1.0.3"],
            "typologicalProfile.inclusiveExclusive": ["grambank-v1.0.3",
                                                      "wals-v2020.5"],
        },
    }


def test_atlas_card_dictionaries_documentation_and_typology(tmp_path):
    d = tmp_path / "cards"
    _write_card(d, "qah", _atlas_card())
    r = discover("qah", cards_path=d, check_registry=False)
    assert [x["name"] for x in r.dictionaries] == ["dict-qah-eng"]
    assert r.dictionaries[0]["_field"] == "lexicalResources.dictionaries"
    assert r.dictionaries[0]["_sources"] == ["toylab-resources-2026"]
    assert r.documentation == {
        "med_level": "grammar sketch", "glottolog_reference": "42",
        "sources": ["glottolog-cldf-v5.3"],
        "_field": "documentation.medLevel"}
    assert r.grammar_documented()
    t = r.typology_hints
    assert t["word_order"] == {"value": "SOV",
                               "source": "typologicalProfile.wordOrder; "
                                         "wals-v2020.5"}
    assert t["has_core_case"]["value"] is False
    # agreeing sources: the consensus; disagreeing: EVERY claim, no winner
    assert t["verbal_alignment"]["value"] == "Accusative"
    assert t["inclusive_exclusive"]["value"] is None
    assert t["inclusive_exclusive"]["disputed"] is True
    assert t["inclusive_exclusive"]["claims"] == [
        {"value": "0", "source": "grambank-v1.0.3"},
        {"value": "Inclusive/exclusive", "source": "wals-v2020.5"}]
    assert not {"dictionaries", "grammars", "typology"} & set(r.unknowns)
    ladder = {rung: attained for rung, attained, _ in r.ladder()}
    assert ladder[3] is True
    out = format_report(r)
    assert ("dictionary: dict-qah-eng — toylab, CC-BY-4.0 (paired with eng) "
            "— https://example.invalid/dict") in out
    assert "documentation: grammar sketch" in out
    assert "Glottolog reference 42" in out
    assert "typology: has_core_case = no" in out
    assert ("typology: inclusive_exclusive — sources differ, every value "
            "shown: 0 [grambank-v1.0.3]; Inclusive/exclusive [wals-v2020.5]"
            ) in out
    silent = next(ln for ln in out.splitlines()
                  if "unknown (card is silent)" in ln)
    assert not {"dictionaries", "grammars", "typology"} & set(
        silent.split(": ", 1)[1].split(", "))


def test_a_non_grammar_documentation_level_leaves_grammars_unknown(tmp_path):
    card = _atlas_card()
    card["documentation"] = {"medLevel": "wordlist"}
    d = tmp_path / "cards"
    _write_card(d, "qah", card)
    r = discover("qah", cards_path=d, check_registry=False)
    assert r.documentation["med_level"] == "wordlist"
    assert not r.grammar_documented()
    # a wordlist as the most extensive description is not a grammar claim:
    # grammars stay UNKNOWN (absence is never "none")
    assert "grammars" in r.unknowns


REAL_CRK = (Path(__file__).resolve().parents[2] / "cli" / "shared"
            / "language-cards")


@pytest.mark.skipif(not (REAL_CRK / "crk.json").is_file(),
                    reason="monorepo language-cards not found")
def test_real_crk_card_lists_what_the_cli_lists():
    """The real crk card, read through the harness adapter (resolve_card →
    language_cards.normalize_card — never a bare json read), says what
    `champollion network card crk` says: a dictionary, a documented grammar
    and a typological profile."""
    from nmt_forge import _harness
    from nmt_forge.cards import resolve_card

    r = discover("crk", cards_path=REAL_CRK, check_registry=False)
    assert not {"dictionaries", "grammars", "typology"} & set(r.unknowns)
    card, source = resolve_card("crk", REAL_CRK)
    assert source == str(REAL_CRK / "crk.json")
    # the dictionaries the CLI's "Language Resources" lists
    cli_dicts = (card.get("lexicalResources") or {}).get("dictionaries") or []
    assert cli_dicts, "the crk card lists a dictionary (lexicalResources)"
    assert {x["name"] for x in r.dictionaries} >= {d["name"]
                                                    for d in cli_dicts}
    # the CLI's "Documentation level"
    assert r.documentation["med_level"] == \
        _harness.language_cards_mod().display(card["documentation"]["medLevel"])
    assert r.grammar_documented()
    # every typology feature the CLI prints, each cited; a disagreement
    # carries every claim
    profile = {k: v for k, v in card["typologicalProfile"].items()
               if k != "source" and not k.startswith("_")
               and v not in (None, "")}
    assert len(r.typology_hints) >= len(profile)
    for v in r.typology_hints.values():
        assert v["source"].startswith(("typologicalProfile.",
                                       "encyclopedic.typology."))
        if v.get("disputed"):
            assert v["value"] is None and len(v["claims"]) >= 2
