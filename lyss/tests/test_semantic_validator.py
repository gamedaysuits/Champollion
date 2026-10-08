"""Semantic validator — gloss source (itwêwina API) + validate_entry verdicts.

The FST and the itwêwina API are mocked; glosses are passed in. Proves the
fail-honest behaviour of the gloss source (IP gate, API failure) and the core
verdict logic, including the FST_NO_ANALYSIS guard against fabricated VALIDs.
"""

from __future__ import annotations

import json

from champollion_lyss.crk import semantic_validator as sv
from champollion_lyss.crk.semantic_validator import GlossSource, validate_entry
from champollion_lyss.crk.fst_adapter import AnalysisResult


# --------------------------------------------------------------------------
# A fake FST: surface word -> list of analysis strings.
# --------------------------------------------------------------------------
class FakeFST:
    def __init__(self, mapping):
        self.mapping = mapping

    def analyze(self, word):
        a = self.mapping.get(word, [])
        return AnalysisResult(word=word, success=bool(a), analyses=list(a))

    def is_available(self):
        return True


def _entry(english, predicted, expected):
    return {"english": english, "predicted": predicted, "expected": expected}


# --------------------------------------------------------------------------
# validate_entry verdicts
# --------------------------------------------------------------------------
def test_exact_match(fake_nlp):
    r = validate_entry(_entry("a dog", "atim", "atim"), FakeFST({}), {}, fake_nlp)
    assert r.verdict == "EXACT_MATCH"


def test_no_output(fake_nlp):
    r = validate_entry(_entry("a dog", "", "atim"), FakeFST({}), {}, fake_nlp)
    assert r.verdict == "NO_OUTPUT"


def test_fst_no_analysis_does_not_fabricate_valid(fake_nlp):
    # FST recognises nothing on either side and it isn't an exact match — the
    # validator must refuse to judge rather than emit VALID.
    r = validate_entry(_entry("they arrive", "xxxx", "yyyy"), FakeFST({}), {}, fake_nlp)
    assert r.verdict == "FST_NO_ANALYSIS"


def test_valid_identical_lemmas_differ_in_inflection(fake_nlp):
    fst = FakeFST({
        "niwâpahtên": ["wâpaht+V+TI+Ind+1Sg"],
        "kiwâpahtên": ["wâpaht+V+TI+Ind+2Sg"],
    })
    r = validate_entry(_entry("see it", "niwâpahtên", "kiwâpahtên"), fst, {}, fake_nlp)
    assert r.verdict == "VALID"


def test_equivalent_synonyms_via_gloss_overlap(fake_nlp):
    fst = FakeFST({
        "takosin": ["takosin+V+AI+Ind+3Sg"],
        "takohtêw": ["takohtêw+V+AI+Ind+3Sg"],
    })
    gloss = {"takosin": "arrive", "takohtêw": "arrive"}
    r = validate_entry(_entry("arrives", "takosin", "takohtêw"), fst, gloss, fake_nlp)
    assert any(pv.verdict == "EQUIVALENT" for pv in r.pair_verdicts)
    assert r.verdict == "VALID"


def test_wrong_when_no_gloss_overlap(fake_nlp):
    fst = FakeFST({
        "mîcisow": ["mîcisow+V+AI+Ind+3Sg"],
        "nipâw": ["nipâw+V+AI+Ind+3Sg"],
    })
    gloss = {"mîcisow": "eat", "nipâw": "sleep"}
    r = validate_entry(_entry("nothing", "mîcisow", "nipâw"), fst, gloss, fake_nlp)
    assert r.verdict == "WRONG"


# --------------------------------------------------------------------------
# GlossSource — itwêwina API fetch / cache / fail-honest
# --------------------------------------------------------------------------
class _FakeResp:
    def __init__(self, payload):
        self._data = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._data

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _payload(lemma, gloss):
    return {
        "search_results": [
            {
                "lemma_wordform": {"text": lemma},
                "definitions": [{"text": gloss, "is_auto_translation": False}],
            }
        ]
    }


def test_gloss_fetch_writes_cache_and_readme_then_reuses(monkeypatch, tmp_path):
    monkeypatch.setenv("CHAMPOLLION_LYSS_ACCEPT_IP", "1")
    monkeypatch.setattr(sv, "ITWEWINA_CACHE_DIR", tmp_path / "itwewina-cache")

    calls = {"n": 0}

    def fake_urlopen(req, timeout=None):
        calls["n"] += 1
        return _FakeResp(_payload("takosin", "s/he arrives"))

    monkeypatch.setattr(sv.urllib.request, "urlopen", fake_urlopen)

    g = GlossSource()
    assert g.get("takosin") == "s/he arrives"
    assert calls["n"] == 1
    assert (tmp_path / "itwewina-cache" / "README.txt").exists()

    # A fresh instance reads the on-disk cache — no second network call.
    def boom(*a, **k):
        raise AssertionError("should hit the disk cache, not the network")

    monkeypatch.setattr(sv.urllib.request, "urlopen", boom)
    assert GlossSource().get("takosin") == "s/he arrives"


def test_gloss_api_failure_is_honest(monkeypatch, tmp_path):
    monkeypatch.setenv("CHAMPOLLION_LYSS_ACCEPT_IP", "1")
    monkeypatch.setattr(sv, "ITWEWINA_CACHE_DIR", tmp_path / "c")

    def fail(*a, **k):
        raise OSError("network down")

    monkeypatch.setattr(sv.urllib.request, "urlopen", fail)

    g = GlossSource()
    assert g.get("takosin") == ""           # default, never fabricated
    assert g.api_failed is True
    assert g.unavailable_reason and "itwêwina" in g.unavailable_reason


def test_gloss_ip_declined_never_touches_api(monkeypatch, tmp_path):
    monkeypatch.setattr(sv, "ITWEWINA_CACHE_DIR", tmp_path / "c")
    monkeypatch.setattr(sv, "acknowledge_ip", lambda *a, **k: False)

    def boom(*a, **k):
        raise AssertionError("API must not be touched when IP terms are declined")

    monkeypatch.setattr(sv.urllib.request, "urlopen", boom)

    g = GlossSource()
    assert g.get("takosin") == ""
    assert g.ip_acknowledged is False
    assert g.unavailable_reason and "acknowledg" in g.unavailable_reason.lower()
