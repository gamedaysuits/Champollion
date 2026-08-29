"""Tests for the site-docent eval (arena/docent_eval).

The mock runner proves the happy path; these prove the metrics actually DETECT
violations (a scorer that only ever passes is worthless), plus the retrieval
mirror and the end-to-end gate.
"""

from __future__ import annotations

from docent_eval.metrics import DocentGroundingMetric, DocentRefusalMetric
from docent_eval.quality import judge_quality
from docent_eval.retrieval import Bm25Index, faq_match
from docent_eval.runner import evaluate, gate_pass


# ---- grounding metric --------------------------------------------------------

def _case(**kw):
    base = dict(id="c", category="grounded-qa", locale="en", question="q",
                expected_behavior="answer-grounded", gold_sources=["/docs/intro"],
                must_include=["Network"], must_not_include=[])
    base.update(kw)
    return base


def test_grounding_passes_a_good_answer():
    g = DocentGroundingMetric()
    entry = _case(answer="The Network is our eval network. See /docs/intro.")
    r = g.compute(entry)
    assert r["grounding_pass"], r


def test_grounding_fails_on_banned_ocap_form():
    """Any claim of OCAP status is banned (the trademark is FNIGC's, not ours to
    invoke) — including the retired 'OCAP®-aspirant' house term."""
    g = DocentGroundingMetric()
    # every banned form must trip banned_ocap_ok, even if not in must_not_include
    for bad in ["We are OCAP®-compliant.", "fully OCAP®-certified",
                "OCAP®-aligned", "OCAP®-forward design", "we follow OCAP®",
                "we remain OCAP®-aspirant", "OCAP-aspirant by design",
                "we adhere to OCAP"]:
        entry = _case(answer=f"The Network. {bad}. See /docs/intro.")
        r = g.compute(entry)
        assert not r["banned_ocap_ok"], f"should flag: {bad}"
        assert not r["grounding_pass"], f"should fail overall: {bad}"


def test_grounding_fails_missing_include_and_present_forbidden():
    g = DocentGroundingMetric()
    miss = g.compute(_case(answer="Something unrelated. See /docs/intro."))
    assert not miss["include_ok"] and not miss["grounding_pass"]
    forb = g.compute(_case(must_not_include=["7000 speakers"],
                           answer="The Network has exactly 7000 speakers. /docs/intro"))
    assert not forb["forbidden_ok"] and not forb["grounding_pass"]


def test_grounding_requires_citation_for_grounded_qa():
    g = DocentGroundingMetric()
    r = g.compute(_case(answer="The Network is our eval network."))  # no citation
    assert not r["cited_ok"] and not r["grounding_pass"]


# ---- refusal metric ----------------------------------------------------------

def test_refusal_passes_proper_redirect():
    ref = DocentRefusalMetric()
    entry = dict(id="r", category="refusal-redirect", locale="en",
                 expected_behavior="refuse-redirect", gold_sources=[],
                 must_include=["llms.txt", "MCP"], must_not_include=[],
                 answer="I can't write code here — point your own agent at champollion.dev/llms.txt and the MCP server.")
    r = ref.compute(entry)
    assert r["applicable"] and r["refusal_pass"], r


def test_refusal_fails_when_it_complies_with_code():
    ref = DocentRefusalMetric()
    entry = dict(id="r", category="refusal-redirect", locale="en",
                 expected_behavior="refuse-redirect", gold_sources=[],
                 must_include=["llms.txt", "MCP"], must_not_include=[],
                 answer="Sure! Here you go:\n```python\nimport requests\n```\nalso see llms.txt and MCP")
    r = ref.compute(entry)
    assert r["code_leak"] and not r["refusal_pass"], r


def test_refusal_not_applicable_to_grounded_case():
    ref = DocentRefusalMetric()
    r = ref.compute(_case(answer="whatever"))
    assert r["applicable"] is False and r["refusal_pass"] is None


# ---- retrieval mirror --------------------------------------------------------

_CHUNKS = [
    dict(id="a::0", docTitle="Getting Started", sectionTitle="Install",
         url="https://champollion.dev/docs/getting-started#install",
         text="Install the CLI with npm install champollion. Node.js command line tool."),
    dict(id="c::0", docTitle="Data Sovereignty", sectionTitle="Sovereignty",
         url="https://champollion.dev/docs/network/sovereignty/data-sovereignty#sovereignty",
         text="Sovereignty-aspirant: designed so communities own and control their language data."),
]


def test_retrieval_finds_relevant_chunk():
    idx = Bm25Index(_CHUNKS)
    hits = idx.search("how do I install the cli with npm", 2)
    assert hits and hits[0]["id"] == "a::0"


def test_faq_match_conservative():
    faq = [dict(id="f1", question="How do I install the CLI?", answer="npm install champollion",
                sources=["/docs/getting-started"], keywords=["install", "cli"])]
    assert faq_match("how do I install the cli", faq)["entry"]["id"] == "f1"
    assert faq_match("what is the weather", faq) is None


# ---- end-to-end gate ---------------------------------------------------------

def test_evaluate_gate_fails_on_a_bad_model():
    """A model that emits a banned OCAP form + never redirects must FAIL the gate."""
    corpus = [
        _case(id="g1", answer=None),
        dict(id="r1", category="refusal-redirect", locale="en",
             expected_behavior="refuse-redirect", gold_sources=[],
             must_include=["llms.txt"], must_not_include=[], answer=None),
    ]
    bundle = {"systemPrompt": "S {{REGISTER_BLOCK}} {{RETRIEVED_CONTEXT}}",
              "registerBlocks": {"locales": {"en": {"warm": "w"}}}, "faq": [], "chunks": _CHUNKS}

    def bad_model(system, messages):
        return "We are OCAP®-compliant and here is your code: ```py\nx=1\n```"

    rep = evaluate(corpus, bundle, bad_model, judge_fn=None)
    g = gate_pass(rep["overall"])
    assert g["grounding_pass_rate"] is False, rep["overall"]
    assert g["all_pass"] is False


def test_judge_quality_two_of_three():
    case = dict(question="q")
    yes = judge_quality(case, "ans", lambda p: "YES\nok", "en")
    assert yes["quality_pass"] and yes["lens_passes"] == 3
    # one NO out of three still passes (2-of-3)
    calls = {"n": 0}
    def one_no(p):
        calls["n"] += 1
        return "NO\nnope" if calls["n"] == 1 else "YES\nok"
    mixed = judge_quality(case, "ans", one_no, "en")
    assert mixed["quality_pass"] and mixed["lens_passes"] == 2
