"""contest_validate — the participant-run pre-flight (practice 5).

The promise this module makes is narrow and has to stay narrow: it runs, on
the participant's machine and with no network, EXACTLY the checks the
organizer's node runs first, and it says out loud that the node re-executes.
So the tests pin three things: that a clean bundle passes with zero BLOCKs
(including the shipped Lane B example, packed the way `submit-method` would
pack it), that each thing the node would refuse is refused HERE with the same
finding shape, and that the report never claims more than it checked.

Synthetic qaa>qab fixtures + the shipped example only — no corpus content, no
network, no Docker (the validator never executes the method; that is the
node's job and the tests say so).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from mt_eval_harness import contest_validate as cv
from mt_eval_harness.external_scoring import sha256_file
from mt_eval_harness.method_bundle import build_manifest, build_method_bundle

from test_sandbox_runner import toy_translate

EXAMPLE = Path(__file__).resolve().parents[1] / "examples" / "lane-b-toy-method"
FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
DEV_CORPUS = FIXTURES / "corpus_dev.json"
SECRET_SET = "eval-qaa-qab-synth-secret-v1"
QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"


def _manifest(**over):
    qualifier = {"receiptVersion": "1", "qualifierId": QUALIFIER_ID,
                 "devCorpusSha256": sha256_file(DEV_CORPUS),
                 "hypothesesSha256": "1" * 64,
                 "score": 100.0, "threshold": 35.0, "passed": True,
                 "scoredAt": "2026-09-06T00:00:00+00:00",
                 "selfReported": True}
    qualifier.update(over.pop("qualifier", {}))
    kwargs = dict(
        method_name="lane-b-toy", method_version="1.0.0",
        entrypoint="method/translate.py", method_class="pipeline",
        paradigm="rule-based",
        description="Synthetic qaa>qab rule; proves the pipe, not quality.",
        developer_name="Champollion example",
        developer_email="example@example.test", agreement_signed=True,
        corpus_id=SECRET_SET, source_lang="qaa", target_lang="qab",
        constraints={"track": "constrained", "parameterCount": 1,
                     "weightsLicense": "LicenseRef-Champollion-Example",
                     "weightsPublic": True,
                     "trainingData": "None — a hand-written rule."},
        submission={"isPrimary": True,
                    "description": "Word-swap rule; a pipeline smoke test.",
                    "methodReleaseUrl": None},
        qualifier=qualifier,
    )
    kwargs.update(over)
    return build_manifest(**kwargs)


@pytest.fixture
def manifest_file(tmp_path):
    p = tmp_path / "manifest.json"
    p.write_text(json.dumps(_manifest(), indent=2), encoding="utf-8")
    return p


@pytest.fixture
def dev_hypotheses(tmp_path):
    """A perfect self-score on the public dev set: the toy rule applied."""
    entries = json.loads(DEV_CORPUS.read_text(encoding="utf-8"))["entries"]
    p = tmp_path / "dev-hyps.txt"
    p.write_text("\n".join(toy_translate(e["source"]) for e in entries) + "\n",
                 encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# The shipped example — the toy check the lane exists to make possible.
# ---------------------------------------------------------------------------

class TestShippedExample:
    def test_the_lane_b_example_validates_clean(self, manifest_file, tmp_path):
        result = cv.validate(EXAMPLE, manifest_path=manifest_file,
                             work_dir=tmp_path / "w")
        assert result["ok"] is True
        assert result["blocks"] == []
        assert result["lane"] == "method"
        assert result["staged"] is True, (
            "a source directory is PACKED first, so the README and any "
            "scratch file next to the method are not scanned as if they "
            "were part of the bundle")

    def test_cli_exits_zero_on_the_example(self, manifest_file):
        proc = subprocess.run(
            [sys.executable, "-m", "mt_eval_harness.cli", "contest",
             "validate", str(EXAMPLE), "--manifest", str(manifest_file)],
            capture_output=True, text=True, timeout=300, check=False)
        assert proc.returncode == 0, proc.stdout + proc.stderr
        assert "0 BLOCK" in proc.stdout
        assert "REHEARSAL" in proc.stdout, (
            "the validator must never claim more than it checked")


# ---------------------------------------------------------------------------
# Staging: three inputs, one set of checks.
# ---------------------------------------------------------------------------

class TestStaging:
    def test_a_packed_tarball_validates(self, tmp_path):
        built = build_method_bundle(
            method_dir=EXAMPLE / "method", dockerfile=EXAMPLE / "Dockerfile",
            manifest=_manifest(), out_path=tmp_path / "bundle.tar.gz")
        result = cv.validate(built["path"], work_dir=tmp_path / "w")
        assert result["ok"] is True
        assert result["staged"] is False

    def test_a_bundle_directory_validates_in_place(self, tmp_path,
                                                   manifest_file):
        cv.validate(EXAMPLE, manifest_path=manifest_file,
                    work_dir=tmp_path / "staged")
        result = cv.validate(tmp_path / "staged" / "bundle",
                             work_dir=tmp_path / "w")
        assert result["ok"] is True

    def test_a_source_directory_without_a_manifest_says_what_to_do(self,
                                                                   tmp_path):
        with pytest.raises(cv.ValidateError, match="no manifest.json"):
            cv.validate(EXAMPLE, work_dir=tmp_path / "w")

    def test_missing_path_refused(self, tmp_path):
        with pytest.raises(cv.ValidateError, match="no such path"):
            cv.validate(tmp_path / "nope", work_dir=tmp_path / "w")

    def test_manifest_may_not_override_a_packed_bundles_own(self, tmp_path,
                                                            manifest_file):
        built = build_method_bundle(
            method_dir=EXAMPLE / "method", dockerfile=EXAMPLE / "Dockerfile",
            manifest=_manifest(), out_path=tmp_path / "bundle.tar.gz")
        with pytest.raises(cv.ValidateError, match="carries its own"):
            cv.validate(built["path"], manifest_path=manifest_file,
                        work_dir=tmp_path / "w")

    def test_undecidable_lane_refuses_rather_than_guessing(self, tmp_path):
        d = tmp_path / "empty-bundle"
        d.mkdir()
        (d / "manifest.json").write_text("{}", encoding="utf-8")
        with pytest.raises(cv.ValidateError, match="Cannot tell which lane"):
            cv.validate(d, work_dir=tmp_path / "w")


# ---------------------------------------------------------------------------
# The node's own refusals, reproduced locally in the node's finding shape.
# ---------------------------------------------------------------------------

FINDING_KEYS = {"check", "category", "severity", "file", "line", "detail"}


class TestFindingsMatchTheNode:
    def _stage(self, tmp_path, manifest_file):
        cv.validate(EXAMPLE, manifest_path=manifest_file,
                    work_dir=tmp_path / "staged")
        return tmp_path / "staged" / "bundle"

    def test_network_import_blocks_here_too(self, tmp_path, manifest_file):
        bundle = self._stage(tmp_path, manifest_file)
        (bundle / "method" / "leak.py").write_text("import requests\n",
                                                   encoding="utf-8")
        result = cv.validate(bundle, work_dir=tmp_path / "w")
        assert result["ok"] is False
        assert any("requests" in b["detail"] for b in result["blocks"])
        for f in result["findings"]:
            assert FINDING_KEYS <= set(f), (
                "findings must be in the node's shape so the two reports read "
                "the same")

    def test_wrong_secret_set_is_caught_before_submission(self, tmp_path,
                                                          manifest_file):
        bundle = self._stage(tmp_path, manifest_file)
        result = cv.validate(bundle, expected_corpus_id="eval-some-other-v1",
                             work_dir=tmp_path / "w")
        assert result["ok"] is False

    def test_a_missing_declaration_blocks(self, tmp_path, manifest_file):
        """C2's constraints_findings run inside the node's static checks, so
        the validator inherits them without a second implementation. (A
        hand-edited bundle is the only way to produce one: the packer already
        refuses to build a manifest the node would block.)"""
        bundle = self._stage(tmp_path, manifest_file)
        m = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
        m["constraints"].pop("track")
        (bundle / "manifest.json").write_text(json.dumps(m), encoding="utf-8")
        result = cv.validate(bundle, work_dir=tmp_path / "w")
        assert result["ok"] is False
        assert any("track" in b["detail"] for b in result["blocks"])

    def test_the_packer_refuses_an_unsubmittable_manifest_loudly(self, tmp_path):
        from mt_eval_harness.method_bundle import MethodBundleError
        m = _manifest()
        m["constraints"].pop("track")
        p = tmp_path / "manifest.json"
        p.write_text(json.dumps(m), encoding="utf-8")
        with pytest.raises(MethodBundleError, match="track"):
            cv.validate(EXAMPLE, manifest_path=p, work_dir=tmp_path / "w")


# ---------------------------------------------------------------------------
# The qualifier rehearsal.
# ---------------------------------------------------------------------------

class TestQualifierRehearsal:
    def test_alignment_and_self_score_pass(self, tmp_path, manifest_file,
                                           dev_hypotheses):
        result = cv.validate(
            EXAMPLE, manifest_path=manifest_file,
            work_dir=tmp_path / "w",
            contest_id="synth", dev_hyp_path=dev_hypotheses,
            dev_corpus_path=DEV_CORPUS,
            qualifier_id=QUALIFIER_ID, threshold=35.0,
            receipt_dir=tmp_path / "receipts")
        assert result["ok"] is True
        assert result["qualifier_checked"] is True
        # A rehearsal writes NO receipt (Round 6: it minted a second one
        # under the bundle's name); with none to check, it warns.
        assert not (tmp_path / "receipts").exists()
        assert any(f["check"] == "qualifier" and f["severity"] == "INFO"
                   for f in result["findings"])
        assert any(f["check"] == "qualifier receipt"
                   and f["severity"] == "WARN" for f in result["findings"])

    def test_misaligned_hypotheses_block_before_any_scoring(self, tmp_path,
                                                            manifest_file):
        short = tmp_path / "short.txt"
        short.write_text("only one line\n", encoding="utf-8")
        result = cv.validate(
            EXAMPLE, manifest_path=manifest_file, work_dir=tmp_path / "w",
            contest_id="synth", dev_hyp_path=short,
            dev_corpus_path=DEV_CORPUS,
            qualifier_id=QUALIFIER_ID, threshold=35.0,
            receipt_dir=tmp_path / "receipts")
        assert result["ok"] is False
        assert any(f["check"] == "dev-alignment" and f["severity"] == "BLOCK"
                   for f in result["findings"])
        assert not (tmp_path / "receipts" / "synth.json").exists(), (
            "a misaligned file must never reach the scorer")

    def test_failing_the_threshold_blocks(self, tmp_path, manifest_file,
                                          dev_hypotheses):
        result = cv.validate(
            EXAMPLE, manifest_path=manifest_file, work_dir=tmp_path / "w",
            contest_id="synth", dev_hyp_path=dev_hypotheses,
            dev_corpus_path=DEV_CORPUS,
            qualifier_id=QUALIFIER_ID, threshold=101.0,
            receipt_dir=tmp_path / "receipts")
        assert result["ok"] is False
        assert any(f["check"] == "qualifier" and f["severity"] == "BLOCK"
                   for f in result["findings"])

    def test_a_different_dev_file_than_the_receipt_blocks(self, tmp_path,
                                                          dev_hypotheses):
        m = _manifest(qualifier={"devCorpusSha256": "0" * 64})
        p = tmp_path / "manifest.json"
        p.write_text(json.dumps(m), encoding="utf-8")
        result = cv.validate(
            EXAMPLE, manifest_path=p, work_dir=tmp_path / "w",
            contest_id="synth", dev_hyp_path=dev_hypotheses,
            dev_corpus_path=DEV_CORPUS,
            qualifier_id=QUALIFIER_ID, threshold=35.0,
            receipt_dir=tmp_path / "receipts")
        assert result["ok"] is False
        assert any("not the released dev set" in f["detail"]
                   for f in result["blocks"])

    def test_no_qualifier_facts_anywhere_refuses_to_guess(self, tmp_path,
                                                          dev_hypotheses):
        m = _manifest()
        m["qualifier"].pop("threshold")
        p = tmp_path / "manifest.json"
        p.write_text(json.dumps(m), encoding="utf-8")
        result = cv.validate(
            EXAMPLE, manifest_path=p, work_dir=tmp_path / "w",
            contest_id="synth", dev_hyp_path=dev_hypotheses,
            dev_corpus_path=DEV_CORPUS, receipt_dir=tmp_path / "receipts")
        assert result["ok"] is False
        assert any("never guessed" in f["detail"] for f in result["blocks"])

    def test_dev_without_the_rest_fails_loud(self, tmp_path, manifest_file,
                                             dev_hypotheses):
        with pytest.raises(cv.ValidateError, match="--dev-corpus"):
            cv.validate(EXAMPLE, manifest_path=manifest_file,
                        work_dir=tmp_path / "w", dev_hyp_path=dev_hypotheses)


# ---------------------------------------------------------------------------
# The report never over-claims.
# ---------------------------------------------------------------------------

class TestReport:
    def test_report_says_the_node_re_executes(self, tmp_path, manifest_file):
        result = cv.validate(EXAMPLE, manifest_path=manifest_file,
                             work_dir=tmp_path / "w")
        text = cv.format_report(result)
        assert "REHEARSAL" in text
        assert "re-executes" in text
        assert "qualifier not rehearsed" in text
        assert "Traceback" not in text

    def test_json_mode_is_pure_json(self, manifest_file, dev_hypotheses,
                                    tmp_path):
        proc = subprocess.run(
            [sys.executable, "-m", "mt_eval_harness.cli", "contest",
             "validate", str(EXAMPLE), "--manifest", str(manifest_file),
             "--json", "--contest", "synth", "--dev", str(dev_hypotheses),
             "--dev-corpus", str(DEV_CORPUS),
             "--offline-qualifier-id", QUALIFIER_ID,
             "--offline-threshold", "35",
             "--receipt-dir", str(tmp_path / "receipts")],
            capture_output=True, text=True, timeout=300, check=False)
        assert proc.returncode == 0, proc.stdout + proc.stderr
        payload = json.loads(proc.stdout)     # would raise if a banner leaked
        assert payload["ok"] is True
        assert payload["lane"] == "method"
        assert payload["qualifier_checked"] is True

    def test_cli_exits_one_on_a_block(self, tmp_path, manifest_file):
        cv.validate(EXAMPLE, manifest_path=manifest_file,
                    work_dir=tmp_path / "staged")
        bundle = tmp_path / "staged" / "bundle"
        (bundle / "method" / "leak.py").write_text("import socket\n",
                                                   encoding="utf-8")
        proc = subprocess.run(
            [sys.executable, "-m", "mt_eval_harness.cli", "contest",
             "validate", str(bundle)],
            capture_output=True, text=True, timeout=300, check=False)
        assert proc.returncode == 1
        assert "BLOCKED" in proc.stdout
