import json

import pytest

from nmt_forge.errors import ConventionError, RegistryError, SynthesisError
from nmt_forge.guards.convention_lint import ConventionSpec
from nmt_forge.guards.coverage_map import ChecklistItem
from nmt_forge.synthesis.analyzer import TableAnalyzer
from nmt_forge.synthesis.engine import SynthesisEngine
from nmt_forge.synthesis.packs import LanguagePack
from nmt_forge.synthesis.templates import Candidate, Lit, Punct, Template, Unit

FORMS = {
    "zon+V+3Sg": "zonâw",
    "zon+V+1Sg": "nizon",
    "por+V+3Sg": "porâw",
    "broken+V+3Sg": None,  # placeholder; removed below
}
del FORMS["broken+V+3Sg"]


class ToyPack(LanguagePack):
    code = "toy"
    name = "Toy"
    version = "0.0.1"

    def __init__(self, templates, *, forms=None, closed=None, canonicalizer=None,
                 conventions=None):
        self._templates = templates
        self._forms = dict(FORMS if forms is None else forms)
        self._closed = closed or {}
        self._canon = canonicalizer
        self._conventions = conventions or []

    def analyzer(self):
        return TableAnalyzer(self._forms, accepted=["êkwa"])

    def dictionary(self):
        return []

    def canonicalize(self, text):
        return self._canon(text) if self._canon else text

    def conventions(self):
        return self._conventions

    def templates(self):
        return self._templates

    def checklist(self):
        return [ChecklistItem("verbing", "verbs verb", "Toygrammar 2020",
                              required=True)]

    def closed_class(self):
        return self._closed

    def context(self, *, seed=42):
        return None


def _tmpl(cands, kind="verbs", filters=()):
    return Template(kind=kind, citation="Toygrammar 2020",
                    phenomena=("verbing",), realize=lambda ctx: iter(cands),
                    filters=filters)


def test_emit_law_round_trip_failures_dropped_and_counted(tmp_path):
    cands = [
        Candidate(source="She zons.", target=(Unit("zon+V+3Sg"), Punct("."))),
        Candidate(source="It fails.", target=(Unit("nope+V+3Sg"), Punct("."))),
    ]
    engine = SynthesisEngine(ToyPack([_tmpl(cands)]))
    manifest = engine.run(tmp_path / "out.jsonl")
    rows = [json.loads(l) for l in (tmp_path / "out.jsonl").read_text().splitlines()]
    assert len(rows) == 1
    assert rows[0]["target"] == "zonâw."
    funnel_stages = {s["stage"]: s for s in manifest["funnel"]["stages"]}
    assert funnel_stages["verified"]["drop_reasons"] == {"round_trip_fail": 1}


def test_rows_carry_provenance_and_synthetic_flag(tmp_path):
    cands = [Candidate(source="She zons.", target=(Unit("zon+V+3Sg"),),
                       lemma="zon")]
    engine = SynthesisEngine(ToyPack([_tmpl(cands)]))
    engine.run(tmp_path / "out.jsonl")
    row = json.loads((tmp_path / "out.jsonl").read_text().splitlines()[0])
    assert row["synthetic"] is True
    assert row["provenance"].startswith("champollion-derived")
    assert row["kind"] == "verbs" and row["lemma"] == "zon"
    assert row["origin"] == "forge:toy"


def test_synthetic_output_cannot_become_a_test_set(tmp_path, ws):
    # the loop closes: engine output → registry refuses it as test role
    cands = [Candidate(source=f"S{i}.", target=(Unit("zon+V+3Sg"),))
             for i in range(3)]
    engine = SynthesisEngine(ToyPack([_tmpl(cands)]))
    engine.run(tmp_path / "synth.jsonl")
    with pytest.raises(RegistryError, match="REAL DATA ONLY"):
        ws.registry.register("synth-as-test", tmp_path / "synth.jsonl", "test")
    ws.registry.register("synth-as-dev", tmp_path / "synth.jsonl", "dev")


def test_bad_literal_is_a_template_bug_not_attrition(tmp_path):
    cands = [Candidate(source="x", target=(Lit("mispeledword"),))]
    engine = SynthesisEngine(ToyPack([_tmpl(cands)]))
    with pytest.raises(SynthesisError) as e:
        engine.run(tmp_path / "out.jsonl")
    msg = str(e.value)
    assert "closed_class" in msg and "why:" in msg


def test_cited_closed_class_literal_passes(tmp_path):
    cands = [Candidate(source="and then",
                       target=(Lit("namôya"), Unit("zon+V+3Sg"), Punct(".")))]
    pack = ToyPack([_tmpl(cands)],
                   closed={"namôya": "Toygrammar 2020 (negation)"})
    manifest = SynthesisEngine(pack).run(tmp_path / "out.jsonl")
    assert manifest["rows"] == 1
    row = json.loads((tmp_path / "out.jsonl").read_text().splitlines()[0])
    assert row["target"] == "namôya zonâw."


def test_analyzer_accepted_literal_passes(tmp_path):
    cands = [Candidate(source="x", target=(Lit("êkwa"), Unit("zon+V+3Sg")))]
    manifest = SynthesisEngine(ToyPack([_tmpl(cands)])).run(tmp_path / "o.jsonl")
    assert manifest["rows"] == 1


def test_filters_counted_per_name(tmp_path):
    from nmt_forge.synthesis.filters import meta_value_whitelist

    f = meta_value_whitelist("objverbs", "v", ("see",), "plausibility")
    cands = [
        Candidate(source="keep", target=(Unit("zon+V+3Sg"),), meta={"v": "see"}),
        Candidate(source="drop", target=(Unit("zon+V+3Sg"),), meta={"v": "resemble"}),
    ]
    manifest = SynthesisEngine(ToyPack([_tmpl(cands, filters=(f,))])).run(
        tmp_path / "out.jsonl")
    stages = {s["stage"]: s for s in manifest["funnel"]["stages"]}
    assert stages["filtered"]["drop_reasons"] == {"filter:objverbs": 1}
    assert manifest["rows"] == 1


def test_coverage_and_citations_in_manifest(tmp_path):
    cands = [Candidate(source="x", target=(Unit("zon+V+3Sg"),))]
    manifest = SynthesisEngine(ToyPack([_tmpl(cands)])).run(tmp_path / "o.jsonl")
    assert manifest["template_citations"] == {"verbs": "Toygrammar 2020"}
    assert manifest["coverage"]["missing_required"] == []
    assert manifest["kind_counts"] == {"verbs": 1}
    # manifest file written next to the corpus
    assert (tmp_path / "o-manifest.json").exists()


def test_broken_canonicalizer_fails_its_own_build(tmp_path):
    # pack declares macron+circumflex conventions but canonicalizes neither:
    # rows come out mixed across the corpus → the build refuses itself
    specs = [ConventionSpec("circ", chars="â"), ConventionSpec("macr", chars="ā")]
    forms = {"zon+V+3Sg": "zonâw", "kam+V+3Sg": "kamāw"}
    cands = [Candidate(source="a", target=(Unit("zon+V+3Sg"),)),
             Candidate(source="b", target=(Unit("kam+V+3Sg"),))]
    pack = ToyPack([_tmpl(cands)], forms=forms, conventions=specs)
    with pytest.raises(ConventionError, match="canonicalize"):
        SynthesisEngine(pack).run(tmp_path / "out.jsonl")
    # with a real canonicalizer the same pack builds clean
    fixed = ToyPack([_tmpl(cands)], forms=forms, conventions=specs,
                    canonicalizer=lambda t: t.replace("ā", "â"))
    manifest = SynthesisEngine(fixed).run(tmp_path / "out2.jsonl")
    assert manifest["conventions"] == {"circ": 2, "macr": 0}


def test_duplicate_kinds_refused(tmp_path):
    t1 = _tmpl([], kind="verbs")
    t2 = _tmpl([], kind="verbs")
    with pytest.raises(SynthesisError, match="duplicate"):
        SynthesisEngine(ToyPack([t1, t2])).run(tmp_path / "o.jsonl")


def test_limit_per_kind(tmp_path):
    cands = [Candidate(source=f"s{i}", target=(Unit("zon+V+3Sg"),))
             for i in range(50)]
    manifest = SynthesisEngine(ToyPack([_tmpl(cands)])).run(
        tmp_path / "o.jsonl", limit_per_kind=7)
    assert manifest["rows"] == 7
