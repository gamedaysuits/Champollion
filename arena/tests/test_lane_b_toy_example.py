"""The Lane B toy example (arena/examples/lane-b-toy-method) as a test subject.

The example is the smallest bundle the organizer node accepts, and its whole
purpose is to prove the pipe — so the tests pin exactly that: it passes the
§3 static checks with ZERO warnings, imports only `sys`, reproduces the
synthetic fixture references line for line as a subprocess, and packs to a
deterministic method_sha (the hash that enters the request fingerprint). A
real-Docker `execute_and_score` leg is gated on MT_EVAL_DOCKER_TESTS=1 plus a
docker binary and skips with a printed reason otherwise — never silently.

Synthetic qaa>qab fixtures only (invented toy language; no corpus content).
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from mt_eval_harness.method_bundle import build_manifest, build_method_bundle
from mt_eval_harness.sandbox_runner import (
    audit_filesystem_access,
    execute_and_score,
    run_static_checks,
    scan_network_calls,
)

from test_sandbox_runner import toy_translate

EXAMPLE = Path(__file__).resolve().parents[1] / "examples" / "lane-b-toy-method"
METHOD_DIR = EXAMPLE / "method"
SCRIPT = METHOD_DIR / "translate.py"
DOCKERFILE = EXAMPLE / "Dockerfile"

FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
BLIND_REFS = FIXTURES / "corpus_blind_refs.json"
DEV_CORPUS = FIXTURES / "corpus_dev.json"
SECRET_SET = "eval-qaa-qab-synth-secret-v1"


def _entries(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["entries"]


def _manifest():
    return build_manifest(
        method_name="lane-b-toy", method_version="1.0.0",
        entrypoint="method/translate.py", method_class="pipeline",
        paradigm="rule-based",
        description="Synthetic qaa>qab rule; proves the pipe, not quality.",
        developer_name="Champollion example",
        developer_email="example@example.test", agreement_signed=True,
        corpus_id=SECRET_SET, source_lang="qaa", target_lang="qab",
        # The entry declarations every contest submission carries (C2). The
        # toy method has no weights at all, so it declares the honest minimum:
        # one "parameter" (the swap rule), no licence beyond the repo's, and
        # nothing public to point at.
        constraints={"track": "constrained", "parameterCount": 1,
                     "weightsLicense": "LicenseRef-Champollion-Example",
                     "weightsPublic": True,
                     "trainingData": "None — a hand-written rule."},
        submission={"isPrimary": True,
                    "description": "Word-swap rule; a pipeline smoke test.",
                    "methodReleaseUrl": None},
        qualifier={"receiptVersion": "1",
                   "qualifierId": "eval-qaa-qab-synth-qualifier-v2026",
                   "devCorpusSha256": "0" * 64, "hypothesesSha256": "1" * 64,
                   "score": 100.0, "threshold": 35.0, "passed": True,
                   "scoredAt": "2026-09-06T00:00:00+00:00",
                   "selfReported": True})


def _run_script(sources: list[str]) -> list[str]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT)],
        input="\n".join(sources) + "\n",
        capture_output=True, text=True, timeout=60, check=False)
    assert proc.returncode == 0, proc.stderr
    assert proc.stderr == "", "the toy method must write nothing to stderr"
    return proc.stdout.splitlines()


@pytest.fixture
def packed(tmp_path):
    """The example packed + extracted into the node's run-time layout
    (bundle/ next to bundle.tar.gz, as import_bundle stages it)."""
    from mt_eval_harness.contest_node import extract_bundle
    built = build_method_bundle(
        method_dir=METHOD_DIR, dockerfile=DOCKERFILE, manifest=_manifest(),
        out_path=tmp_path / "work" / "bundle.tar.gz")
    bundle_dir = tmp_path / "work" / "bundle"
    manifest = extract_bundle(Path(built["path"]).read_bytes(), bundle_dir)
    return {"dir": bundle_dir, "tarball": Path(built["path"]),
            "manifest": manifest, "method_sha": built["method_sha"]}


class TestExampleLayout:
    def test_files_exist(self):
        assert DOCKERFILE.is_file()
        assert SCRIPT.is_file()
        assert (EXAMPLE / "README.md").is_file()
        # Nothing but the script lives in method/ — no data, no table.
        assert sorted(p.name for p in METHOD_DIR.iterdir()) == ["translate.py"]

    def test_script_imports_only_sys(self):
        tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(a.name.split(".")[0] for a in node.names)
            elif isinstance(node, ast.ImportFrom):
                imported.add((node.module or "").split(".")[0])
        assert imported == {"sys"}

    def test_dockerfile_is_base_image_plus_copy_only(self):
        lines = [ln.strip() for ln in DOCKERFILE.read_text(
            encoding="utf-8").splitlines()]
        instructions = [ln for ln in lines if ln and not ln.startswith("#")]
        assert instructions == ["FROM python:3.12-slim", "COPY method /method"]


class TestStaticChecks:
    def test_static_checks_pass_with_zero_warnings(self, packed):
        checks = run_static_checks(
            packed["dir"], tarball_path=packed["tarball"],
            expected_corpus_id=SECRET_SET)
        assert not checks["blocked"], checks["blocks"]
        assert checks["warns"] == [], checks["warns"]
        # Stronger than "not blocked": the scan has NOTHING to say.
        assert checks["findings"] == []
        assert checks["manifest"]["method"]["entrypoint"] == \
            "method/translate.py"

    def test_scans_read_comments_too_and_still_find_nothing(self):
        # The Dockerfile scan reads comment lines — the example's comment
        # must not mention a package manager or transfer tool either.
        assert scan_network_calls(EXAMPLE) == []
        assert audit_filesystem_access(EXAMPLE) == []


class TestRule:
    def test_blind_refs_reproduced_line_for_line(self):
        entries = _entries(BLIND_REFS)
        out = _run_script([e["source"] for e in entries])
        assert out == [e["reference"] for e in entries]

    def test_agrees_with_harness_reference_rule_on_both_fixtures(self):
        for corpus in (BLIND_REFS, DEV_CORPUS):
            sources = [e["source"] for e in _entries(corpus)]
            assert _run_script(sources) == [toy_translate(s) for s in sources], \
                corpus.name

    def test_dev_fixture_has_exactly_one_irregular_reference(self):
        # corpus_dev.json carries one reference that does NOT follow the
        # rule ("pira venuvo" for "veno pira selu" — it is one of the
        # SENTINEL_REFS test_contest_prep greps for). Pin that so a fixture
        # edit that changes the rule's coverage is noticed, not absorbed.
        entries = _entries(DEV_CORPUS)
        out = _run_script([e["source"] for e in entries])
        mismatches = [e["id"] for e, o in zip(entries, out)
                      if o != e["reference"]]
        assert mismatches == [2]

    def test_short_lines_echo_and_extra_words_drop(self):
        assert _run_script(["solo", "alpha beta gamma delta", ""]) == \
            ["solo", "beta alphavo", ""]


class TestDeterminism:
    def test_method_sha_identical_across_two_builds(self, tmp_path):
        a = build_method_bundle(
            method_dir=METHOD_DIR, dockerfile=DOCKERFILE, manifest=_manifest(),
            out_path=tmp_path / "a" / "bundle.tar.gz")
        b = build_method_bundle(
            method_dir=METHOD_DIR, dockerfile=DOCKERFILE, manifest=_manifest(),
            out_path=tmp_path / "b" / "bundle.tar.gz")
        assert a["method_sha"] == b["method_sha"]
        assert Path(a["path"]).read_bytes() == Path(b["path"]).read_bytes()
        assert hashlib.sha256(Path(a["path"]).read_bytes()).hexdigest() == \
            a["method_sha"]


def _docker_gate() -> list[str]:
    reasons = []
    if os.environ.get("MT_EVAL_DOCKER_TESTS") != "1":
        reasons.append("MT_EVAL_DOCKER_TESTS=1 is not set")
    if shutil.which("docker") is None:
        reasons.append("no `docker` binary on PATH")
    return reasons


class TestRealDocker:
    def test_execute_and_score_in_a_real_sandbox(self, packed, tmp_path):
        reasons = _docker_gate()
        if reasons:
            msg = ("real-Docker leg skipped (" + "; ".join(reasons)
                   + ") — set MT_EVAL_DOCKER_TESTS=1 with a Docker daemon "
                   "to run the toy method in the actual --network=none "
                   "sandbox")
            print(msg)
            pytest.skip(msg)
        host_cpus = os.cpu_count() or 1
        result = execute_and_score(
            bundle_dir=packed["dir"], corpus_path=BLIND_REFS,
            work_dir=tmp_path / "run", sealed_set_id=SECRET_SET,
            language_pair="qaa>qab", node_id="example-node",
            submission={"request_id": "authreq-example",
                        "method_sha": packed["method_sha"]},
            output_dir=tmp_path / "out",
            sandbox_cfg={"runtime": "docker",
                         "cpus": min(2, host_cpus)})
        assert result["qualifier_score"] > 90, "exact rule → near-perfect"
        assert result["method_card"]["method_sha"] == packed["method_sha"]
        assert result["execution"]["runtime"] == "docker"
        assert result["static_checks"] == {"blocks": 0, "warns": 0}
        # §8 teardown: the work dir (decrypted source + outputs) is gone.
        assert not (tmp_path / "run").exists()
