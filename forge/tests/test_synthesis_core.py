import pytest

from nmt_forge.errors import CitationError
from nmt_forge.synthesis.analyzer import TableAnalyzer, accepts, generate_verified
from nmt_forge.synthesis.filters import (
    content_tokens,
    meta_overlap,
    meta_token_whitelist,
    meta_value_whitelist,
)
from nmt_forge.synthesis.probe import (
    load_probe_artifact,
    probe_combos,
    write_probe_artifact,
)
from nmt_forge.synthesis.templates import Candidate, Template, template


# -- analyzer + the round-trip law ------------------------------------------------

def test_generate_verified_round_trip_law():
    ana = TableAnalyzer({"zon+V+3Sg": "zonâw"})
    assert generate_verified(ana, "zon+V+3Sg") == "zonâw"
    assert generate_verified(ana, "zon+V+1Sg") is None  # can't generate


def test_generate_verified_rejects_ambiguous_landing():
    # generation lands on a surface whose analyses DON'T include the input
    # analysis → round trip fails → never emitted
    ana = TableAnalyzer(
        {"zon+V+3Sg": "zonâw"},
        ambiguous={"zonâw": ["completely+Different+Analysis"]},
    )
    # the true analysis is still among the surface's analyses → verified
    assert generate_verified(ana, "zon+V+3Sg") == "zonâw"

    class LyingAnalyzer:
        def analyses(self, surface):
            return ["some+Other+Reading"]

        def generate(self, analysis):
            return "zonâw"

    assert generate_verified(LyingAnalyzer(), "zon+V+3Sg") is None


def test_accepts_and_closed_class_surfaces():
    ana = TableAnalyzer({}, accepted=["namôya"])
    assert accepts(ana, "namôya")
    assert not accepts(ana, "blartok")


# -- templates: citations or nothing ------------------------------------------------

def _realize(_ctx):
    yield Candidate(source="x", target=())


def test_template_requires_citation():
    with pytest.raises(CitationError, match="citation"):
        Template(kind="imperative", citation="  ", phenomena=("imperative",),
                 realize=_realize)


def test_template_requires_phenomena():
    with pytest.raises(CitationError, match="phenomena"):
        Template(kind="imperative", citation="Toygrammar 2020",
                 phenomena=(), realize=_realize)


def test_template_kind_must_be_slug():
    with pytest.raises(CitationError, match="slug"):
        Template(kind="Bad Kind!", citation="Toygrammar 2020",
                 phenomena=("x",), realize=_realize)


def test_template_decorator_validates_at_import_shape():
    t = template("imperative", citation="Toygrammar 2020 §7",
                 phenomena=["imperative"])(_realize)
    assert isinstance(t, Template) and t.kind == "imperative"
    with pytest.raises(CitationError):
        template("bad", citation="", phenomena=["x"])(_realize)


# -- filters -------------------------------------------------------------------------

def test_content_tokens_drops_function_words():
    toks = content_tokens("looks at the something for his own house")
    assert "house" in toks and "looks" in toks
    assert "the" not in toks and "something" not in toks and "his" not in toks


def test_meta_token_whitelist_place_nouns():
    f = meta_token_whitelist("place", "noun_gloss", ("house", "river"),
                             "locatives need places")
    keep = Candidate(source="", target=(), meta={"noun_gloss": "big house"})
    drop = Candidate(source="", target=(), meta={"noun_gloss": "kindness"})
    assert f(keep) and not f(drop)


def test_meta_value_whitelist_object_verbs():
    f = meta_value_whitelist("objv", "verb_base", ("see", "hold"),
                             "possessed objects need object-verbs")
    assert f(Candidate(source="", target=(), meta={"verb_base": "see"}))
    assert not f(Candidate(source="", target=(), meta={"verb_base": "resemble"}))


def test_meta_overlap_partner_relatedness():
    f = meta_overlap("related", "gloss_a", "gloss_b",
                     "two-clause partners share content")
    related = Candidate(source="", target=(), meta={
        "gloss_a": "cooks the meat", "gloss_b": "eats the meat"})
    surreal = Candidate(source="", target=(), meta={
        "gloss_a": "eats quickly", "gloss_b": "swims away"})
    assert f(related) and not f(surreal)


def test_filter_requires_rationale():
    with pytest.raises(ValueError, match="rationale"):
        meta_value_whitelist("x", "f", ("a",), "  ")


# -- probe -----------------------------------------------------------------------------

def test_probe_keeps_only_verified_combos(tmp_path):
    ana = TableAnalyzer({
        "zon+V+AI+Ind+1Sg": "nizon",
        "zon+V+AI+Ind+3Sg": "zonâw",
        # 2Sg missing: the tag grammar doesn't support it
    })
    combos = probe_combos(
        ana,
        exemplars={"VAI": "zon"},
        tag_templates={"VAI": ["{lemma}+V+AI+Ind+1Sg", "{lemma}+V+AI+Ind+2Sg",
                               "{lemma}+V+AI+Ind+3Sg"]},
    )
    assert combos["VAI"] == ["{lemma}+V+AI+Ind+1Sg", "{lemma}+V+AI+Ind+3Sg"]

    path = write_probe_artifact(tmp_path / "probe.json", combos,
                                analyzer_id="table-v1")
    assert load_probe_artifact(path, analyzer_id="table-v1") == combos
    # a different analyzer version invalidates the cache — no stale probes
    assert load_probe_artifact(path, analyzer_id="table-v2") is None


def test_probe_missing_exemplar_yields_empty():
    combos = probe_combos(TableAnalyzer({}), exemplars={},
                          tag_templates={"VAI": ["{lemma}+X"]})
    assert combos["VAI"] == []


def test_source_wellformedness_filter():
    from nmt_forge.synthesis.filters import source_wellformedness
    f = source_wellformedness()
    ok = {"source": "The woman thinks of the bullet as heavy."}
    bad1 = {"source": "The poor man bes poor."}
    bad2 = {"source": "The woman thinks of as heavy the bullet."}
    bad3 = {"source": "I look at to the lake."}
    bad4 = {"source": "You mix together {OBJ} quickly."}
    assert f(ok)
    assert not f(bad1) and not f(bad2) and not f(bad3) and not f(bad4)
