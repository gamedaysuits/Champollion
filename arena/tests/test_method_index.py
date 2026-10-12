"""Tests for method_index — the public index record of a contest method."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness import method_index as mi
from mt_eval_harness.method_bundle import build_manifest
from mt_eval_harness.model_bundle import build_declarative_manifest

from test_model_runner import PARTICIPANT, SECRET_SET, declarations

SHA = "cd" * 32
SCHEMA = (Path(__file__).resolve().parents[2] / "shared" / "schemas"
          / "method-index-record.schema.json")


def _lane_a(**gen):
    return build_declarative_manifest(
        method_name="acme-nmt", method_version="1.2.0", method_class="pipeline",
        paradigm="neural-nmt", developer_name="Acme Lab", developer_email=PARTICIPANT,
        affiliation="Acme University", agreement_signed=True, corpus_id=SECRET_SET,
        source_lang="spa", target_lang="quy", architecture="MarianMTModel",
        generation=gen or {"num_beams": 5, "max_new_tokens": 256},
        **declarations(constraints={"trainingData": "OPUS spa-quy + Bible"}))


def _lane_b():
    decl = declarations()
    return build_manifest(
        method_name="rule-mt", method_version="0.3", entrypoint="method/run.py",
        method_class="pipeline", developer_name="Rule Team", developer_email=PARTICIPANT,
        agreement_signed=True, corpus_id=SECRET_SET, source_lang="spa",
        target_lang="quy", **decl)


def test_lane_a_record_keeps_identity_and_decoding_drops_binding_and_email():
    record = mi.index_record(_lane_a(), method_sha=SHA)
    assert record["lane"] == "declarative-model"
    assert record["method"]["name"] == "acme-nmt" and record["methodSha256"] == SHA
    assert record["owner"] == {"name": "Acme Lab", "affiliation": "Acme University"}
    assert record["licence"] == "Apache-2.0"
    assert record["model"]["generation"] == {"num_beams": 5, "max_new_tokens": 256}
    assert record["languagePair"] == {"source": "spa", "target": "quy"}
    assert record["trainingData"] == "OPUS spa-quy + Bible"
    text = mi.canonical_bytes(record).decode("utf-8")
    assert PARTICIPANT not in text and "@" not in text
    assert SECRET_SET not in text and "qualifier" not in text


def test_lane_b_record_carries_requirements_and_image_digest():
    record = mi.index_record(_lane_b(), method_sha=SHA, image_digest="sha256:" + "1a" * 32)
    assert record["lane"] == "method-execution"
    assert record["imageDigest"] == "sha256:" + "1a" * 32
    # The manifest's declared requirements, carried as declared (the
    # defaults are the shipped node template's caps since Round 3).
    from mt_eval_harness.contest_declarations import DEFAULT_REQUIREMENTS
    assert "model" not in record
    assert record["requirements"]["ramGB"] == DEFAULT_REQUIREMENTS["ramGB"]


def test_the_same_method_in_two_contests_has_one_record():
    a = _lane_a()
    b = json.loads(json.dumps(a))
    b["target"]["corpusId"] = "another-contest-set"
    b["qualifier"] = {"something": "else"}
    b["developer"]["email"] = "someone@else.org"
    assert mi.index_record_sha256(mi.index_record(a, method_sha=SHA)) == \
        mi.index_record_sha256(mi.index_record(b, method_sha=SHA))


def test_decoding_changes_change_the_record():
    one = mi.index_record(_lane_a(num_beams=5), method_sha=SHA)
    two = mi.index_record(_lane_a(num_beams=4), method_sha=SHA)
    assert mi.index_record_sha256(one) != mi.index_record_sha256(two)


def test_canonical_bytes_are_stable_and_sorted():
    record = mi.index_record(_lane_a(), method_sha=SHA)
    raw = mi.canonical_bytes(record)
    assert raw == mi.canonical_bytes(json.loads(raw))
    assert raw == json.dumps(record, sort_keys=True, ensure_ascii=False,
                             separators=(",", ":")).encode("utf-8")
    assert b'": ' not in raw and b', "' not in raw        # no separator whitespace


def test_bad_sha_and_missing_licence_are_refused():
    with pytest.raises(mi.MethodIndexError, match="64-hex"):
        mi.index_record(_lane_a(), method_sha="short")
    m = _lane_a()
    m["constraints"]["weightsLicense"] = ""
    with pytest.raises(mi.MethodIndexError, match="weightsLicense"):
        mi.index_record(m, method_sha=SHA)


@pytest.mark.parametrize("manifest", [_lane_a, _lane_b])
def test_records_validate_against_the_published_schema(manifest):
    jsonschema = pytest.importorskip("jsonschema")
    if not SCHEMA.exists():
        pytest.skip("shared/ not present (standalone install)")
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    record = mi.index_record(manifest(), method_sha=SHA,
                             image_digest="sha256:" + "1a" * 32)
    jsonschema.validate(record, schema)


def test_engine_versions_name_what_computed_the_score():
    v = mi.engine_versions()
    assert v["python"] and v["sacrebleu"]
    assert set(v) >= {"transformers", "torch", "ctranslate2"}
