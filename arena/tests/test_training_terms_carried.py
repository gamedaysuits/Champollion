"""A run's derived files carry "no model may train on this" (set/1 terms).

A RunLog or TestReport holds the corpus's sentences. When the corpus's
sidecar says ``terms.training: not-allowed``, the sidecar mt-eval writes beside
those files says so too — otherwise a run log could carry the text into a
training mix. A training term never replaces a transmission mark: a withheld
corpus's derived file is still marked local-only.
"""

from __future__ import annotations

import json

from mt_eval_harness.corpus_loader import derived_file_note, derived_mark

NOT_ALLOWED = {"training": "not-allowed"}


def _corpus(tmp_path, sidecar):
    p = tmp_path / "pairs.tsv"
    p.write_text("a\tb\n", encoding="utf-8")
    (tmp_path / "pairs.tsv.champollion.json").write_text(json.dumps(sidecar))
    return str(p)


def test_a_shareable_corpus_with_no_training_carries_only_the_term(tmp_path):
    path = _corpus(tmp_path, {"terms": NOT_ALLOWED})
    mark = derived_mark({"config": {"corpus_path": path}})
    assert mark == {"terms": NOT_ALLOWED}


def test_a_local_only_corpus_keeps_its_transmission_mark_too(tmp_path):
    path = _corpus(tmp_path, {"transmission": "local-only", "terms": NOT_ALLOWED})
    mark = derived_mark({"config": {"corpus_path": path}})
    assert mark.get("transmission") == "local-only"
    assert mark.get("terms") == NOT_ALLOWED


def test_training_allowed_adds_nothing(tmp_path):
    path = _corpus(tmp_path, {"terms": {"training": "allowed"}})
    assert derived_mark({"config": {"corpus_path": path}}) == {}


def test_the_note_reads_in_words(tmp_path):
    note = derived_file_note(tmp_path / "run.json",
                             {"transmission": "local-only", "terms": NOT_ALLOWED})
    assert "transmission local-only, training not-allowed" in note
