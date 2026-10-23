"""`--method lexicon -m <dictionary>`: the floor a trained model must beat.

Word-for-word lookup in the people's own word list, longest listed phrase
first, every other word kept; in-process, so a local-only corpus needs no
attestation. The dictionary is the "model" the run records (file name +
sha256, never an entry), and its terms travel with what the run writes —
the outputs are made of its words. Invented vocabulary only.
"""

from __future__ import annotations

import asyncio
import contextlib
import io
import json
from pathlib import Path

import pytest

from mt_eval_harness.config import RunConfig
from mt_eval_harness.methods.base_http_mt import MTConfigError
from mt_eval_harness.methods.lexicon import (
    LexiconMethod, load_lexicon, lookup)
from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY


def _quiet(fn):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn()


def _lexicon(tmp_path: Path, side: dict | None = None, name="words.tsv") -> Path:
    p = tmp_path / name
    p.write_text("old\tvuoras\nhouse\tviessu\nold house\tboaresviessu\n"
                 "there is\tlea\nHouse\tSHOULD-NOT-WIN\n", encoding="utf-8")
    if side is not None:
        (tmp_path / f"{name}.champollion.json").write_text(json.dumps(side))
    return p


def _corpus(tmp_path: Path, side: dict | None = None) -> Path:
    c = tmp_path / "dev.json"
    c.write_text(json.dumps({
        "dataset": {"corpus_id": "lexicon-floor-test",
                    "language_pair": {"source": "eng", "target": "sme"},
                    "license": "CC-BY-2.0"},
        "entries": [{"id": str(i), "source": f"There is an old house, {i}!",
                     "reference": f"dan lea boaresviessu {i}"}
                    for i in range(4)]}), encoding="utf-8")
    if side is not None:
        (tmp_path / "dev.json.champollion.json").write_text(json.dumps(side))
    return c


def _run(tmp_path: Path, lexicon: Path, corpus: Path):
    from mt_eval_harness.runner import execute_run
    out = tmp_path / "out"
    config = RunConfig(mt_method="lexicon", method_model=str(lexicon),
                       corpus_path=str(corpus), output_dir=str(out),
                       cache_dir=str(tmp_path / "cache"), dataset="all")
    log = _quiet(lambda: asyncio.run(execute_run(config)))
    return log, out


def test_it_is_a_registered_in_process_engine_that_takes_its_dictionary():
    cls = MT_METHOD_REGISTRY["lexicon"]
    assert cls is LexiconMethod
    assert cls.in_process_transport and cls.takes_model


def test_lookup_longest_first_case_blind_and_keeps_the_rest(tmp_path):
    table = load_lexicon(_lexicon(tmp_path))
    out, words, found = lookup("There is an old house, 3!", table,
                               max(len(k) for k in table))
    # "old house" is listed as a phrase: it beats "old" + "house"; "an" and
    # "3" are not in the list and stay; punctuation stays where it was
    assert out == "lea an boaresviessu, 3!"
    assert (words, found) == (6, 4)
    # the first listed translation is used ("House" repeats "house")
    assert lookup("house", table, 2)[0] == "viessu"


def test_formats_and_refusals_never_quote_an_entry(tmp_path):
    j = tmp_path / "g.json"
    j.write_text(json.dumps({"dictionary": {"old": ["vuoras", "boaris"]}}))
    assert load_lexicon(j)[("old",)] == ["vuoras", "boaris"]
    jl = tmp_path / "g.jsonl"
    jl.write_text('{"source": "house", "target": "viessu"}\n')
    assert load_lexicon(jl)[("house",)] == ["viessu"]
    bad = tmp_path / "bad.tsv"
    bad.write_text("old\tvuoras\nsecretword without a tab\n")
    with pytest.raises(MTConfigError) as ei:
        load_lexicon(bad)
    assert "line 2" in str(ei.value) and "secretword" not in str(ei.value)
    with pytest.raises(MTConfigError):
        load_lexicon(tmp_path / "x.csv")


def test_identity_is_the_file_by_hash_and_the_pair_must_match(tmp_path):
    with pytest.raises(MTConfigError, match="needs the dictionary"):
        LexiconMethod.resolve_identity({})
    with pytest.raises(MTConfigError, match="no such file"):
        LexiconMethod.resolve_identity({"model": str(tmp_path)})
    lex = _lexicon(tmp_path, {"pair": {"source": "eng", "target": "sme"},
                              "kind": "lexicon"})
    ident = LexiconMethod.resolve_identity({"model": str(lex)},
                                           source_code="eng", target_code="sme")
    assert ident["kind"] == "file" and ident["entries"] == 4
    assert len(ident["sha256"]) == 64 and ident["id"] == "words.tsv"
    with pytest.raises(MTConfigError, match="looks up one direction"):
        LexiconMethod.resolve_identity({"model": str(lex)},
                                       source_code="sme", target_code="eng")
    flipped = LexiconMethod.resolve_identity(
        {"model": str(lex)}, source_code="sme", target_code="eng",
        allow_pair_mismatch=True)
    assert flipped["pair_mismatch"]["model_pair"] == "eng>sme"


def test_a_run_on_a_local_only_corpus_needs_no_attestation(tmp_path):
    corpus = _corpus(tmp_path, {"transmission": "local-only"})
    log, out = _run(tmp_path, _lexicon(tmp_path), corpus)
    em = log["config"]["engine_model"]
    assert em["kind"] == "file" and em["id"] == "words.tsv"
    preds = [r["predicted"] for r in log["results"]]
    assert preds[0] == "lea an boaresviessu, 0!"
    meta = log["results"][0]["metadata"]
    assert meta == {"lexicon_words": 6, "lexicon_found": 4}


def test_a_local_only_dictionary_makes_the_outputs_local_only(tmp_path):
    from mt_eval_harness.corpus_loader import derived_mark
    from mt_eval_harness.transmission_policy import withheld_text_reason

    lex = _lexicon(tmp_path, {"transmission": "local-only",
                              "terms": {"training": "not-allowed"}})
    log, out = _run(tmp_path, lex, _corpus(tmp_path))
    assert "dictionary" in withheld_text_reason(log)
    mark = derived_mark(log)
    assert mark["transmission"] == "local-only"
    assert mark["terms"] == {"training": "not-allowed"}
    sides = list(out.glob("*.champollion.json"))
    assert sides, "the run's files carry the dictionary's terms"
    assert all(json.loads(s.read_text())["transmission"] == "local-only"
               for s in sides)


def test_an_open_dictionary_on_an_open_corpus_adds_no_mark(tmp_path):
    from mt_eval_harness.transmission_policy import withheld_text_reason

    log, _ = _run(tmp_path, _lexicon(tmp_path), _corpus(tmp_path))
    assert withheld_text_reason(log) == ""
