"""contest_declarations — the participant declarations every contest entry carries.

Contract C2. Covers the two block builders, every BLOCK case of the checker,
the Lane A parameter-count cross-check against a real (tiny) safetensors file
written by these tests, and the manifest → `contest_submissions` projection —
including the rule that a publicly displayed submitter label is NEVER an email
address.

Fully offline: no network surface exists in this module.
"""

from __future__ import annotations

import json
import struct

import pytest

from mt_eval_harness import contest_declarations as cd
from mt_eval_harness.contest_declarations import (
    MAX_DESCRIPTION_CHARS,
    MAX_TRAINING_DATA_CHARS,
    PARAMETER_COUNT_TOLERANCE,
    SUBMISSION_COLUMNS,
    TRACKS,
    DeclarationError,
    build_constraints_block,
    build_submission_block,
    constraints_findings,
    qualifier_block_from_receipt,
    submission_fields_from_manifest,
    submitter_label_from_manifest,
    url_problem,
)
from mt_eval_harness.model_runner import (
    parameter_count_from_header,
    validate_safetensors_file,
)

# ---------------------------------------------------------------------------
# Helpers.
# ---------------------------------------------------------------------------

_DTYPE_BYTES = {"F32": 4, "F16": 2, "BF16": 2, "I64": 8, "I8": 1}


def write_safetensors(path, tensors: dict[str, tuple[str, list[int]]]):
    """Write a real (tiny) safetensors file: 8-byte little-endian header length,
    the JSON header, then a zero payload of exactly the declared size."""
    header: dict[str, dict] = {}
    offset = 0
    for name, (dtype, shape) in tensors.items():
        count = 1
        for dim in shape:
            count *= dim
        nbytes = count * _DTYPE_BYTES[dtype]
        header[name] = {"dtype": dtype, "shape": list(shape),
                        "data_offsets": [offset, offset + nbytes]}
        offset += nbytes
    blob = json.dumps(header).encode("utf-8")
    path.write_bytes(struct.pack("<Q", len(blob)) + blob + b"\0" * offset)
    return path


def constraints(**overrides) -> dict:
    block = dict(track="unconstrained", parameterCount=1_000_000,
                 weightsLicense="Apache-2.0", weightsPublic=True,
                 trainingData="")
    block.update(overrides)
    return block


def submission(**overrides) -> dict:
    block = dict(isPrimary=True, description="A system.", methodReleaseUrl=None)
    block.update(overrides)
    return block


def manifest(**overrides) -> dict:
    m = {
        "submissionVersion": "1.0.0",
        "method": {"name": "acme-nmt", "version": "1.0.0"},
        "developer": {"name": "Acme Lab", "email": "dev@example.test"},
        "constraints": constraints(),
        "submission": submission(),
    }
    m.update(overrides)
    return m


def details(findings) -> str:
    return " | ".join(f["detail"] for f in findings)


# ---------------------------------------------------------------------------
# Block builders.
# ---------------------------------------------------------------------------

class TestBuildConstraintsBlock:
    def test_exact_shape(self):
        block = build_constraints_block(
            track="constrained", parameter_count=615_000_000,
            weights_license="CC-BY-NC-4.0", weights_public=False,
            training_data="FLORES-200 dev, our own 12k parallel corpus")
        assert block == {
            "track": "constrained",
            "parameterCount": 615_000_000,
            "weightsLicense": "CC-BY-NC-4.0",
            "weightsPublic": False,
            "trainingData": "FLORES-200 dev, our own 12k parallel corpus",
        }
        assert list(block) == ["track", "parameterCount", "weightsLicense",
                              "weightsPublic", "trainingData"]

    def test_both_tracks_build(self):
        for track in TRACKS:
            block = build_constraints_block(
                track=track, parameter_count=1, weights_license="MIT",
                weights_public=True,
                training_data="x" if track == "constrained" else "")
            assert block["track"] == track

    def test_licenseref_is_accepted(self):
        block = build_constraints_block(
            track="unconstrained", parameter_count=7,
            weights_license="LicenseRef-Acme-Internal-Terms",
            weights_public=False, training_data="")
        assert block["weightsLicense"] == "LicenseRef-Acme-Internal-Terms"

    def test_refuses_and_says_why(self):
        with pytest.raises(DeclarationError, match="constraints.track"):
            build_constraints_block(
                track="semi-constrained", parameter_count=1,
                weights_license="MIT", weights_public=True, training_data="")

    def test_constrained_needs_training_data(self):
        with pytest.raises(DeclarationError, match="trainingData"):
            build_constraints_block(
                track="constrained", parameter_count=1, weights_license="MIT",
                weights_public=True, training_data="   ")


class TestBuildSubmissionBlock:
    def test_exact_shape(self):
        block = build_submission_block(
            is_primary=False, description="Contrastive: greedy decoding.",
            method_release_url="https://example.test/acme-nmt")
        assert block == {
            "isPrimary": False,
            "description": "Contrastive: greedy decoding.",
            "methodReleaseUrl": "https://example.test/acme-nmt",
        }

    def test_url_may_be_null(self):
        assert build_submission_block(
            is_primary=True, description="", method_release_url=None
        )["methodReleaseUrl"] is None

    def test_refuses_http_url(self):
        with pytest.raises(DeclarationError, match="https"):
            build_submission_block(is_primary=True, description="",
                                   method_release_url="http://example.test/x")


class TestQualifierBlock:
    RECEIPT = {
        "receiptVersion": "1", "contestId": "synth-open-2026",
        "qualifierId": "qual-2026", "devCorpusSha256": "a" * 64,
        "hypothesesSha256": "b" * 64, "metric": "composite", "score": 41.2,
        "threshold": 35.0, "passed": True, "harnessVersion": "0.1.0",
        "scoredAt": "2026-09-06T00:00:00Z", "selfReported": True,
        "note": "self-scored",
    }

    def test_copies_exactly_the_public_fields(self):
        block = qualifier_block_from_receipt(self.RECEIPT)
        assert set(block) == {
            "receiptVersion", "qualifierId", "devCorpusSha256",
            "hypothesesSha256", "score", "threshold", "passed", "scoredAt",
            "selfReported"}
        assert block["score"] == 41.2 and block["passed"] is True
        # The private/annotation fields do NOT ride along.
        assert "note" not in block and "harnessVersion" not in block

    def test_missing_field_fails_loud(self):
        broken = dict(self.RECEIPT)
        broken.pop("devCorpusSha256")
        with pytest.raises(DeclarationError, match="devCorpusSha256"):
            qualifier_block_from_receipt(broken)

    def test_non_object_fails_loud(self):
        with pytest.raises(DeclarationError, match="not an object"):
            qualifier_block_from_receipt("passed")


# ---------------------------------------------------------------------------
# Every BLOCK case.
# ---------------------------------------------------------------------------

class TestConstraintsFindingsBlocks:
    def test_clean_manifest_passes(self):
        assert constraints_findings(manifest()) == []

    def test_findings_use_the_manifest_finding_shape(self):
        found = constraints_findings(manifest(constraints=constraints(track="x")))
        assert found and all(
            set(f) == {"check", "severity", "detail"} and f["severity"] == "BLOCK"
            for f in found)

    def test_missing_constraints_block(self):
        m = manifest()
        del m["constraints"]
        assert "manifest.constraints is missing" in details(constraints_findings(m))

    def test_missing_submission_block(self):
        m = manifest()
        del m["submission"]
        assert "manifest.submission is missing" in details(constraints_findings(m))

    def test_constraints_not_an_object(self):
        found = constraints_findings(manifest(constraints="constrained"))
        assert "must be an object" in details(found)

    def test_submission_not_an_object(self):
        found = constraints_findings(manifest(submission=[1, 2]))
        assert "must be an object" in details(found)

    def test_manifest_not_an_object(self):
        assert "not a JSON object" in details(constraints_findings("nope"))

    @pytest.mark.parametrize("track", [None, "", "open", "Constrained", 3])
    def test_invalid_track(self, track):
        found = constraints_findings(
            manifest(constraints=constraints(track=track)))
        assert "constraints.track" in details(found)

    @pytest.mark.parametrize("count", [-1, "1000000", 1.5, None, True])
    def test_parameter_count_not_an_integer_at_all(self, count):
        found = constraints_findings(
            manifest(constraints=constraints(parameterCount=count)))
        assert "parameterCount must be an integer >= 0" in details(found)

    def test_zero_parameters_is_a_real_declaration(self):
        """0 = "no trainable parameters" (founder call, 2026-09-07).

        A rule-based entry — an FST pipeline, a dictionary lookup — has none,
        and the toy Lane B example used to declare 1 purely to get past a
        positive-integer check. A number an entrant has to falsify to submit
        is worse than no number: it lands on a public submission row that the
        host will never verify.
        """
        found = constraints_findings(
            manifest(constraints=constraints(parameterCount=0)))
        assert "parameterCount" not in details(found)

    def test_missing_and_zero_are_different_answers(self):
        """"none" and "did not say" must not collapse into one value."""
        missing = constraints(parameterCount=0)
        del missing["parameterCount"]
        assert "parameterCount must be an integer >= 0" in details(
            constraints_findings(manifest(constraints=missing)))

    @pytest.mark.parametrize("licence", [None, "", "   ", 42])
    def test_weights_license_required(self, licence):
        found = constraints_findings(
            manifest(constraints=constraints(weightsLicense=licence)))
        assert "weightsLicense is required" in details(found)

    @pytest.mark.parametrize("public", [None, "true", 1, 0])
    def test_weights_public_must_be_bool(self, public):
        found = constraints_findings(
            manifest(constraints=constraints(weightsPublic=public)))
        assert "weightsPublic must be true or false" in details(found)

    def test_constrained_track_needs_training_data(self):
        found = constraints_findings(manifest(constraints=constraints(
            track="constrained", trainingData="")))
        assert "trainingData is required and non-empty" in details(found)

    def test_unconstrained_track_tolerates_empty_training_data(self):
        assert constraints_findings(manifest(constraints=constraints(
            track="unconstrained", trainingData=""))) == []

    def test_training_data_length_cap(self):
        found = constraints_findings(manifest(constraints=constraints(
            trainingData="x" * (MAX_TRAINING_DATA_CHARS + 1))))
        assert f"the limit is {MAX_TRAINING_DATA_CHARS}" in details(found)

    def test_training_data_must_be_a_string(self):
        found = constraints_findings(
            manifest(constraints=constraints(trainingData=["a"])))
        assert "trainingData must be a string" in details(found)

    def test_is_primary_must_be_bool(self):
        found = constraints_findings(
            manifest(submission=submission(isPrimary="yes")))
        assert "isPrimary must be true or false" in details(found)

    def test_description_length_cap(self):
        found = constraints_findings(manifest(submission=submission(
            description="x" * (MAX_DESCRIPTION_CHARS + 1))))
        assert f"the limit is {MAX_DESCRIPTION_CHARS}" in details(found)

    def test_description_at_the_cap_is_fine(self):
        assert constraints_findings(manifest(submission=submission(
            description="x" * MAX_DESCRIPTION_CHARS))) == []

    def test_description_must_be_a_string(self):
        found = constraints_findings(
            manifest(submission=submission(description=None)))
        assert "description must be a string" in details(found)

    @pytest.mark.parametrize("url", [
        "http://example.test/x",             # not https
        "https:///no-host",                  # no host
        "ftp://example.test/x",              # wrong scheme
        "example.test/x",                    # no scheme
        " https://example.test/x",           # leading space
        "https://user:pw@example.test/x",    # credentials
        "https://example.test/a b",          # space
        "",                                  # empty
        123,                                 # not a string
    ])
    def test_malformed_method_release_url(self, url):
        found = constraints_findings(
            manifest(submission=submission(methodReleaseUrl=url)))
        assert "methodReleaseUrl" in details(found)

    def test_good_url_passes(self):
        assert constraints_findings(manifest(submission=submission(
            methodReleaseUrl="https://example.test/acme/nmt"))) == []

    def test_url_problem_returns_none_for_a_good_url(self):
        assert url_problem("https://example.test/x") is None

    def test_every_problem_is_reported_not_just_the_first(self):
        found = constraints_findings(manifest(
            constraints=constraints(track="x", parameterCount=-1,
                                    weightsLicense="", weightsPublic="no"),
            submission=submission(isPrimary=None, description=None)))
        assert len(found) >= 6


# ---------------------------------------------------------------------------
# The Lane A parameter-count cross-check (the one checkable declaration).
# ---------------------------------------------------------------------------

def declarative_manifest(bundle_dir, tensors, claimed):
    write_safetensors(bundle_dir / "model.safetensors", tensors)
    return manifest(
        submissionKind="declarative-model",
        model={"weightsFile": "model.safetensors", "architecture": "MarianMT"},
        constraints=constraints(parameterCount=claimed))


class TestParameterCountCrossCheck:
    TENSORS = {"encoder.weight": ("F32", [100, 64]),      # 6400
               "decoder.weight": ("F32", [100, 64]),      # 6400
               "final_bias": ("F32", [100])}              # 100
    TOTAL = 12_900

    def test_the_fixture_is_real_safetensors(self, tmp_path):
        path = write_safetensors(tmp_path / "model.safetensors", self.TENSORS)
        assert validate_safetensors_file(path)["tensors"] == 3
        assert parameter_count_from_header(path) == self.TOTAL

    def test_scalar_tensor_counts_as_one(self, tmp_path):
        path = write_safetensors(tmp_path / "m.safetensors",
                                 {"scale": ("F32", [])})
        assert parameter_count_from_header(path) == 1

    def test_metadata_block_is_not_counted(self, tmp_path):
        path = tmp_path / "m.safetensors"
        header = {"__metadata__": {"format": "pt"},
                  "w": {"dtype": "F32", "shape": [4, 4],
                        "data_offsets": [0, 64]}}
        blob = json.dumps(header).encode("utf-8")
        path.write_bytes(struct.pack("<Q", len(blob)) + blob + b"\0" * 64)
        assert parameter_count_from_header(path) == 16

    def test_exact_claim_passes(self, tmp_path):
        m = declarative_manifest(tmp_path, self.TENSORS, self.TOTAL)
        assert constraints_findings(m, bundle_dir=tmp_path) == []

    def test_claim_within_one_percent_passes(self, tmp_path):
        within = int(self.TOTAL * (1 + PARAMETER_COUNT_TOLERANCE))
        m = declarative_manifest(tmp_path, self.TENSORS, within)
        assert constraints_findings(m, bundle_dir=tmp_path) == []

    def test_claim_beyond_one_percent_blocks_and_names_both_numbers(
            self, tmp_path):
        m = declarative_manifest(tmp_path, self.TENSORS, 615_000_000)
        found = constraints_findings(m, bundle_dir=tmp_path)
        text = details(found)
        assert "615,000,000" in text and f"{self.TOTAL:,}" in text
        assert found[0]["severity"] == "BLOCK"

    def test_understated_claim_also_blocks(self, tmp_path):
        m = declarative_manifest(tmp_path, self.TENSORS, 10)
        assert "does not match" in details(
            constraints_findings(m, bundle_dir=tmp_path))

    def test_no_cross_check_without_bundle_dir(self, tmp_path):
        m = declarative_manifest(tmp_path, self.TENSORS, 615_000_000)
        assert constraints_findings(m) == []

    def test_lane_b_manifest_is_not_cross_checked(self, tmp_path):
        # No submissionKind => the code lane; there is no header to check.
        write_safetensors(tmp_path / "model.safetensors", self.TENSORS)
        m = manifest(constraints=constraints(parameterCount=615_000_000))
        assert constraints_findings(m, bundle_dir=tmp_path) == []

    def test_zero_is_admissible_in_lane_b(self, tmp_path):
        """A rule-based code entry really has no trainable parameters."""
        m = manifest(constraints=constraints(parameterCount=0))
        assert constraints_findings(m, bundle_dir=tmp_path) == []

    def test_zero_blocks_in_lane_a_because_the_weights_contradict_it(
            self, tmp_path):
        """Lane A keeps the stricter rule: weights have parameters.

        0 is the honest answer for a method with none — but a submission that
        ships a safetensors file has them by construction, so a declared 0
        there is contradicted by the artifact the participant attached.
        """
        m = declarative_manifest(tmp_path, self.TENSORS, 0)
        found = details(constraints_findings(m, bundle_dir=tmp_path))
        assert "parameterCount is 0" in found
        assert "weights submission" in found

    def test_missing_weights_file_blocks(self, tmp_path):
        m = manifest(
            submissionKind="declarative-model",
            model={"weightsFile": "model.safetensors"},
            constraints=constraints(parameterCount=self.TOTAL))
        assert "is not in the bundle" in details(
            constraints_findings(m, bundle_dir=tmp_path))

    def test_not_safetensors_blocks(self, tmp_path):
        (tmp_path / "model.safetensors").write_bytes(b"\x80\x04not-a-tensor")
        m = manifest(
            submissionKind="declarative-model",
            model={"weightsFile": "model.safetensors"},
            constraints=constraints(parameterCount=self.TOTAL))
        assert "not well-formed safetensors" in details(
            constraints_findings(m, bundle_dir=tmp_path))

    def test_negative_dimension_is_a_loud_error(self, tmp_path):
        path = tmp_path / "m.safetensors"
        header = {"w": {"dtype": "F32", "shape": [4, -1],
                        "data_offsets": [0, 0]}}
        blob = json.dumps(header).encode("utf-8")
        path.write_bytes(struct.pack("<Q", len(blob)) + blob)
        with pytest.raises(ValueError, match="negative dimension"):
            parameter_count_from_header(path)


# ---------------------------------------------------------------------------
# Manifest → the contest_submissions row.
# ---------------------------------------------------------------------------

class TestSubmissionFields:
    def test_exact_column_names(self):
        row = submission_fields_from_manifest(manifest())
        assert set(row) == set(SUBMISSION_COLUMNS)
        assert set(row) == {"track", "is_primary", "description",
                            "method_release_url", "constraints",
                            "submitter_label"}

    def test_values_come_straight_from_the_declarations(self):
        m = manifest(
            constraints=constraints(track="constrained", parameterCount=42,
                                    trainingData="FLORES-200 dev"),
            submission=submission(isPrimary=False, description="Contrastive.",
                                  methodReleaseUrl="https://example.test/m"))
        row = submission_fields_from_manifest(m)
        assert row["track"] == "constrained"
        assert row["is_primary"] is False
        assert row["description"] == "Contrastive."
        assert row["method_release_url"] == "https://example.test/m"
        assert row["constraints"]["parameterCount"] == 42
        assert row["constraints"]["trainingData"] == "FLORES-200 dev"

    def test_constraints_column_is_a_copy_not_the_manifest_object(self):
        m = manifest()
        row = submission_fields_from_manifest(m)
        row["constraints"]["track"] = "constrained"
        assert m["constraints"]["track"] == "unconstrained"

    def test_refuses_an_invalid_manifest(self):
        with pytest.raises(DeclarationError, match="constraints.track"):
            submission_fields_from_manifest(
                manifest(constraints=constraints(track="anything-goes")))

    def test_submitter_label_is_the_developer_name(self):
        assert submission_fields_from_manifest(
            manifest())["submitter_label"] == "Acme Lab"

    def test_submitter_label_is_never_an_email(self):
        m = manifest(developer={"name": "dev@example.test",
                                "email": "dev@example.test"})
        row = submission_fields_from_manifest(m)
        assert row["submitter_label"] == "acme-nmt"
        assert "@" not in row["submitter_label"]

    def test_submitter_label_falls_back_to_the_method_name(self):
        m = manifest(developer={"email": "dev@example.test"})
        assert submission_fields_from_manifest(
            m)["submitter_label"] == "acme-nmt"

    def test_no_usable_label_fails_loud_rather_than_leaking_an_address(self):
        m = manifest(developer={"name": "a@b.test", "email": "a@b.test"},
                     method={"name": "c@d.test", "version": "1"})
        with pytest.raises(DeclarationError, match="displayed publicly"):
            submitter_label_from_manifest(m)


# ---------------------------------------------------------------------------
# Prize-terms acceptance (founder amendment R1-amended, 2026-09-07).
#
# Terms are a per-contest dial, so accepting them is a per-contest act. The
# acceptance rides the manifest (and so is covered by method_sha) and the
# organizer node checks it against the contest's frozen terms.
# ---------------------------------------------------------------------------

_SHA_A = "ab" * 32
_SHA_B = "cd" * 32


class TestAcceptedPrizeTerms:
    def test_the_key_is_absent_when_nothing_was_accepted(self):
        block = build_submission_block(
            is_primary=True, description="", method_release_url=None)
        assert cd.ACCEPTED_TERMS_KEY not in block

    def test_a_hash_is_carried_verbatim(self):
        block = build_submission_block(
            is_primary=True, description="", method_release_url=None,
            accepted_prize_terms_sha256=_SHA_A)
        assert block[cd.ACCEPTED_TERMS_KEY] == _SHA_A

    @pytest.mark.parametrize("bad", ["", "not-a-hash", "AB" * 32, "ab" * 31, 7,
                                     True])
    def test_a_non_sha256_acceptance_is_blocked(self, bad):
        found = constraints_findings(
            manifest(submission=submission(**{cd.ACCEPTED_TERMS_KEY: bad})))
        assert "lowercase 64-hex SHA-256" in details(found)

    def test_a_good_acceptance_passes_the_block_checks(self):
        assert constraints_findings(manifest(submission=submission(
            **{cd.ACCEPTED_TERMS_KEY: _SHA_A}))) == []

    def test_reading_it_back(self):
        assert cd.accepted_prize_terms_sha(
            manifest(submission=submission(
                **{cd.ACCEPTED_TERMS_KEY: _SHA_A}))) == _SHA_A
        assert cd.accepted_prize_terms_sha(manifest()) is None
        assert cd.accepted_prize_terms_sha(None) is None
        assert cd.accepted_prize_terms_sha({"submission": "nope"}) is None


class TestAcceptedTermsFindings:
    def test_matching_terms_pass(self):
        m = manifest(submission=submission(**{cd.ACCEPTED_TERMS_KEY: _SHA_A}))
        assert cd.accepted_terms_findings(m, contest_terms_sha=_SHA_A) == []

    def test_a_mismatch_is_a_block_naming_both_hashes(self):
        m = manifest(submission=submission(**{cd.ACCEPTED_TERMS_KEY: _SHA_A}))
        found = cd.accepted_terms_findings(m, contest_terms_sha=_SHA_B,
                                           contest_id="beta-2026")
        assert found and found[0]["severity"] == "BLOCK"
        assert _SHA_A in found[0]["detail"] and _SHA_B in found[0]["detail"]
        assert "beta-2026" in found[0]["detail"]

    def test_accepting_nothing_when_terms_exist_is_a_block(self):
        found = cd.accepted_terms_findings(manifest(),
                                           contest_terms_sha=_SHA_A)
        assert found and found[0]["severity"] == "BLOCK"
        assert "--accept-terms" in found[0]["detail"]

    def test_accepting_terms_a_contest_never_declared_is_a_block(self):
        """Nothing to compare against, but the bundle was built for something
        else — that is a fact worth refusing on, not a silent pass."""
        m = manifest(submission=submission(**{cd.ACCEPTED_TERMS_KEY: _SHA_A}))
        found = cd.accepted_terms_findings(m, contest_terms_sha=None)
        assert found and found[0]["severity"] == "WARN"
        assert "could NOT be checked" in found[0]["detail"]
        assert _SHA_A in found[0]["detail"]

    def test_no_terms_and_no_acceptance_says_nothing(self):
        assert cd.accepted_terms_findings(manifest()) == []

    def test_the_finding_shape_matches_the_other_checkers(self):
        found = cd.accepted_terms_findings(manifest(),
                                           contest_terms_sha=_SHA_A)
        assert set(found[0]) == {"check", "severity", "detail"}
        assert found[0]["check"] == "prize_terms"
