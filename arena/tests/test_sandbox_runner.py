"""sandbox_runner — spec §3/§6/§7/§8/§9, offline.

The container runtime is INJECTED (a FakeRuntime that honors the argv
contract), so the execution contract, teardown, and scores-only publish are
exercised without docker; the argv builders themselves are asserted flag by
flag (--network=none, read-only root, cap drop, tmpfs, env sanitization).
The connected `node run-method` tests reuse the shared FakeSupabase; the
per-submission path that needs real sealing skips cleanly when the
champollion CLI is absent (the Phase-A pattern).

Synthetic qaa>qab fixtures only. The toy language's rule (source "w1 w2 w3"
→ reference "w2 w1vo") lets the fake container be a PERFECT method, so a
green run must publish a high composite — asserting the whole pipe, not just
that code ran.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import pytest

import mt_eval_harness.sandbox_runner as sr
from mt_eval_harness.execution_facts import no_text_guard
from mt_eval_harness.method_bundle import build_method_bundle
from mt_eval_harness.queue_runner import compute_request_fingerprint
from mt_eval_harness.sandbox_runner import (
    SANDBOX_ENV,
    SandboxError,
    audit_filesystem_access,
    build_image_argv,
    enforce_resource_caps,
    entrypoint_command,
    execute_and_score,
    execute_method,
    run_container_argv,
    run_static_checks,
    scan_network_calls,
    wipe_tree,
    write_source_file,
)

from mt_eval_harness.external_scoring import sha256_file

from fake_supabase import FakeSupabase, patch_service_layer
from test_method_bundle import (
    CLEAN_DOCKERFILE,
    CLEAN_METHOD,
    _manifest,
)

FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
DEV_CORPUS = FIXTURES / "corpus_dev.json"
SECRET_CORPUS = FIXTURES / "corpus_blind_refs.json"

CONTEST_ID = "synth-open-2026"
BLIND_SET = "eval-qaa-qab-synth-blindtest-v1"
SECRET_SET = "eval-qaa-qab-synth-secret-v1"
QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"
PARTICIPANT = "participant@example.test"
NODE_ID = "test-node-1"


def toy_translate(source: str) -> str:
    words = source.split()
    return f"{words[1]} {words[0]}vo" if len(words) >= 2 else source


# ---------------------------------------------------------------------------
# The injected runtime — honors the docker argv contract without docker.
# ---------------------------------------------------------------------------

#: What a real `docker image inspect --format '{{.Id}}'` answers with.
FAKE_IMAGE_DIGEST = "sha256:" + "9f" * 32


class FakeRuntime:
    def __init__(self, behavior: str = "perfect", *,
                 image_digest: str | None = FAKE_IMAGE_DIGEST,
                 healthy_runs: int = 0):
        self.behavior = behavior
        #: How many `run`s behave PERFECTLY before ``behavior`` kicks in. The
        #: node now executes a method twice — once on the public dev set (the
        #: qualifier gate) and once on the sealed set — so a test about
        #: failing the SEALED run needs the dev run to succeed first.
        self.healthy_runs = healthy_runs
        self.runs = 0
        #: None reproduces a runtime that cannot report an image id (podman
        #: variants, restricted daemons) — the facts must then say so rather
        #: than invent a digest.
        self.image_digest = image_digest
        self.calls: list[list[str]] = []

    @staticmethod
    def _mount_source(argv, destination):
        for a in argv:
            if a.startswith("type=bind") and f"destination={destination}" in a:
                return Path(a.split("source=")[1].split(",")[0])
        raise AssertionError(f"no bind mount for {destination} in {argv}")

    def __call__(self, argv, capture_output=True, text=True, timeout=None,
                 **kw):
        self.calls.append(list(argv))
        cp = lambda code, out="", err="": subprocess.CompletedProcess(  # noqa: E731
            argv, code, out, err)
        verb = argv[1]
        if verb == "build":
            assert "--network=none" in argv, "§3.3: build must be airgapped"
            return cp(0, "built")
        if verb == "image":
            # `image inspect` serves two probes: the §3.4 size limit and the
            # image DIGEST that identifies what actually ran.
            fmt = argv[argv.index("--format") + 1]
            if fmt == "{{.Id}}":
                if self.image_digest is None:
                    return cp(1, "", "unknown format specifier")
                return cp(0, self.image_digest + "\n")
            return cp(0, "12345\n")
        if verb in ("rm", "rmi"):
            return cp(0)
        if verb == "run":
            self.runs += 1
            misbehaving = self.runs > self.healthy_runs
            if self.behavior == "timeout" and misbehaving:
                raise subprocess.TimeoutExpired(argv, timeout or 0)
            if self.behavior == "exit1" and misbehaving:
                return cp(1, "", "the method crashed spectacularly")
            eval_dir = self._mount_source(argv, "/eval")
            out_dir = self._mount_source(argv, "/output")
            sources = (eval_dir / "source.txt").read_text(
                encoding="utf-8").splitlines()
            if self.behavior == "no-output" and misbehaving:
                return cp(0)
            lines = [toy_translate(s) for s in sources]
            if self.behavior == "garbage" and misbehaving:
                lines = ["zzz"] * (len(sources) - 1)  # count mismatch too
            (out_dir / "translations.txt").write_text(
                "\n".join(lines) + "\n", encoding="utf-8")
            return cp(0)
        raise AssertionError(f"unexpected runtime verb {argv}")


@pytest.fixture
def bundle(tmp_path):
    """A clean, packed method bundle dir + tarball (the run-time layout)."""
    src = tmp_path / "method-src"
    src.mkdir()
    (src / "translate.py").write_text(CLEAN_METHOD, encoding="utf-8")
    dockerfile = tmp_path / "Dockerfile"
    dockerfile.write_text(CLEAN_DOCKERFILE, encoding="utf-8")
    manifest = _manifest()
    built = build_method_bundle(
        method_dir=src, dockerfile=dockerfile, manifest=manifest,
        out_path=tmp_path / "work" / "bundle.tar.gz")
    bundle_dir = tmp_path / "work" / "bundle"
    (bundle_dir / "method").mkdir(parents=True)
    (bundle_dir / "method" / "translate.py").write_text(
        CLEAN_METHOD, encoding="utf-8")
    (bundle_dir / "Dockerfile").write_text(CLEAN_DOCKERFILE, encoding="utf-8")
    (bundle_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8")
    return {"dir": bundle_dir, "tarball": Path(built["path"]),
            "manifest": manifest, "method_sha": built["method_sha"]}


# ---------------------------------------------------------------------------
# §3.1 network scan.
# ---------------------------------------------------------------------------

class TestNetworkScan:
    def _scan(self, tmp_path, name, content):
        d = tmp_path / "m"
        d.mkdir(exist_ok=True)
        (d / name).write_text(content, encoding="utf-8")
        return scan_network_calls(d)

    @pytest.mark.parametrize("content", [
        "import socket\n",
        "import requests\n",
        "from urllib import request\n",
        "import aiohttp\n",
        "subprocess.run(['curl', url])\n",
        "socket.gethostbyname('x')\n",
        "ctypes.CDLL(None); SOCK_STREAM = 1  # ctypes SOCK_\n",
        # A banned module hiding LATER in a comma-separated import list — the
        # first-name-only regex used to wave these through (E2E audit 2026-07-11).
        "import sys, requests\n",
        "import os, socket\n",
        "import a, b, aiohttp as h\n",
        # `from <banned> import ...` (module on the from-side).
        "from socket import socket\n",
        # Dynamic imports — __import__ / importlib.import_module.
        "__import__('socket')\n",
        "importlib.import_module('socket')\n",
        "__import__('urllib.request')\n",
    ])
    def test_python_network_patterns_block(self, tmp_path, content):
        findings = self._scan(tmp_path, "x.py", content)
        assert any(f["severity"] == "BLOCK" for f in findings), content

    @pytest.mark.parametrize("content", [
        "import sys, json\n",           # no banned module anywhere in the list
        "import os, sys\n",
        "x = mysocket()  # 'socket' is a substring, not an import\n",
        "import json  # uses socket internally\n",  # banned name only in comment
    ])
    def test_benign_comma_imports_stay_clean(self, tmp_path, content):
        # The relaxed comma-list match must not fire on unrelated modules,
        # substrings, or comment text (no false positives).
        assert self._scan(tmp_path, "x.py", content) == [], content

    def test_shell_curl_blocks(self, tmp_path):
        findings = self._scan(tmp_path, "run.sh", "#!/bin/sh\ncurl http://x\n")
        assert any(f["severity"] == "BLOCK" for f in findings)

    def test_os_environ_warns_not_blocks(self, tmp_path):
        findings = self._scan(tmp_path, "x.py", "import os\nv = os.environ\n")
        assert findings and all(f["severity"] == "WARN" for f in findings)

    def test_dockerfile_curl_blocks_pip_warns(self, tmp_path):
        findings = self._scan(
            tmp_path, "Dockerfile",
            "FROM python:3.11\nRUN pip install ./wheels/x.whl\n"
            "RUN curl http://evil\n")
        sev = {f["severity"] for f in findings}
        assert "BLOCK" in sev and "WARN" in sev

    def test_binary_files_skipped(self, tmp_path):
        d = tmp_path / "m"
        d.mkdir()
        (d / "weights.py").write_bytes(b"\0\0import socket\0\0")
        assert scan_network_calls(d) == []

    def test_clean_method_passes(self, tmp_path):
        assert self._scan(tmp_path, "translate.py", CLEAN_METHOD) == []


# ---------------------------------------------------------------------------
# §3.2 filesystem audit.
# ---------------------------------------------------------------------------

class TestFsAudit:
    def _audit(self, tmp_path, content):
        d = tmp_path / "m"
        d.mkdir(exist_ok=True)
        (d / "x.py").write_text(content, encoding="utf-8")
        return audit_filesystem_access(d)

    @pytest.mark.parametrize("content", [
        "open('/etc/passwd')\n",
        "open('/proc/self/environ')\n",
        "open('/sys/class/net')\n",
        "open('/dev/tcp')\n",
    ])
    def test_blocked_paths(self, tmp_path, content):
        findings = self._audit(tmp_path, content)
        assert findings and all(f["severity"] == "BLOCK" for f in findings)

    @pytest.mark.parametrize("content", [
        "open('/dev/null')\nopen('/dev/urandom')\n",
        "x = 1  # no paths at all\n",
    ])
    def test_allowed_paths_pass(self, tmp_path, content):
        assert self._audit(tmp_path, content) == []


# ---------------------------------------------------------------------------
# §3.4 size limits + §3 orchestration.
# ---------------------------------------------------------------------------

class TestStaticChecks:
    def test_clean_bundle_passes(self, bundle):
        report = run_static_checks(bundle["dir"],
                                   tarball_path=bundle["tarball"],
                                   expected_corpus_id=SECRET_SET)
        assert not report["blocked"], report["blocks"]

    def test_tarball_over_limit_blocks(self, bundle, monkeypatch):
        monkeypatch.setattr(sr, "TARBALL_LIMIT_BYTES", 8)
        report = run_static_checks(bundle["dir"],
                                   tarball_path=bundle["tarball"])
        assert report["blocked"]
        assert any(f["category"] == "tarball" for f in report["blocks"])

    def test_missing_manifest_blocks(self, tmp_path):
        d = tmp_path / "empty"
        d.mkdir()
        report = run_static_checks(d)
        assert report["blocked"]

    @pytest.mark.parametrize("leak", [
        "import requests\n",
        "import sys, requests\n",   # the evasion the §3 gate used to miss
        "__import__('socket')\n",
    ])
    def test_network_import_blocks_whole_bundle(self, bundle, leak):
        (bundle["dir"] / "method" / "leak.py").write_text(
            leak, encoding="utf-8")
        report = run_static_checks(bundle["dir"])
        assert report["blocked"], leak


class TestAcceptedPrizeTermsGate:
    """A bundle is scored under the terms its author accepted, or not at all.

    (Founder amendment R1-amended, 2026-09-07: prize terms are a per-contest
    dial, so "which terms" is a real question with a checkable answer.)
    """

    _SHA_A = "ab" * 32
    _SHA_B = "cd" * 32

    def _with_acceptance(self, bundle, sha):
        manifest = json.loads(
            (bundle["dir"] / "manifest.json").read_text(encoding="utf-8"))
        manifest["submission"]["acceptedPrizeTermsSha256"] = sha
        (bundle["dir"] / "manifest.json").write_text(
            json.dumps(manifest, indent=2), encoding="utf-8")
        return bundle

    def test_matching_acceptance_passes(self, bundle):
        self._with_acceptance(bundle, self._SHA_A)
        report = run_static_checks(bundle["dir"],
                                   contest_terms_sha=self._SHA_A)
        assert not report["blocked"], report["blocks"]

    def test_a_different_acceptance_blocks(self, bundle):
        self._with_acceptance(bundle, self._SHA_A)
        report = run_static_checks(bundle["dir"],
                                   contest_terms_sha=self._SHA_B,
                                   contest_id="synth-open-2026")
        assert report["blocked"]
        detail = " ".join(b["detail"] for b in report["blocks"])
        assert self._SHA_A in detail and self._SHA_B in detail

    def test_no_acceptance_against_a_contest_with_terms_blocks(self, bundle):
        report = run_static_checks(bundle["dir"],
                                   contest_terms_sha=self._SHA_A)
        assert report["blocked"]
        assert any("--accept-terms" in b["detail"] for b in report["blocks"])

    def test_an_unverifiable_acceptance_warns_and_never_passes_silently(
            self, bundle):
        self._with_acceptance(bundle, self._SHA_A)
        report = run_static_checks(bundle["dir"])
        assert not report["blocked"]
        assert any("could NOT be checked" in w["detail"]
                   for w in report["warns"])

    def test_a_contest_with_no_terms_and_a_plain_bundle_is_silent(self, bundle):
        report = run_static_checks(bundle["dir"])
        assert not report["blocked"]
        assert not any(w["check"] == "prize_terms" for w in report["warns"])

    def test_the_terms_hash_comes_from_the_contest_row(self):
        from mt_eval_harness import contest_prize_terms as cpt

        terms = {"disposition": "release_open"}
        row = {"id": "c", "metadata": {"prize_terms": terms}}
        assert sr.contest_prize_terms_sha_from_row(row) == cpt.terms_sha256(terms)
        assert sr.contest_prize_terms_sha_from_row({"id": "c"}) is None
        assert sr.contest_prize_terms_sha_from_row(
            {"id": "c", "metadata": {}}) is None

    def test_unreadable_contest_terms_are_a_refusal_not_a_skip(self):
        bad = {"id": "c", "metadata": {
            "prize_terms": {"release_required_before_scores": True}}}
        with pytest.raises(sr.SandboxError, match="unreadable"):
            sr.contest_prize_terms_sha_from_row(bad)


# ---------------------------------------------------------------------------
# §6 argv builders — every isolation flag, explicitly.
# ---------------------------------------------------------------------------

class TestContainerArgv:
    def test_build_is_airgapped(self):
        argv = build_image_argv("docker", "tag", "/b")
        assert "--network=none" in argv

    def test_run_isolation_flags(self, tmp_path):
        caps = enforce_resource_caps({"ramGB": 8, "diskGB": 4,
                                      "maxRuntimeMinutes": 30}, {})
        argv = run_container_argv(
            "docker", "tag", container_name="c1",
            eval_dir=tmp_path / "eval", method_dir=tmp_path / "method",
            output_dir=tmp_path / "out",
            entrypoint="method/translate.py", caps=caps)
        joined = " ".join(argv)
        assert "--network=none" in argv                       # §1/§6.1
        assert "--read-only" in argv                          # §6.1
        assert "--cap-drop ALL" in joined                     # §6.1
        assert "no-new-privileges" in joined
        assert "type=tmpfs,destination=/tmp,tmpfs-size=4g" in joined  # §3.4
        assert "destination=/method,readonly" in joined       # §2.2 ro
        assert "destination=/eval,readonly" in joined
        assert "--memory 8g" in joined
        # §6.3 — the entire environment, nothing else.
        env_flags = [argv[i + 1] for i, a in enumerate(argv) if a == "-e"]
        assert sorted(env_flags) == sorted(
            f"{k}={v}" for k, v in SANDBOX_ENV.items())
        assert "--gpus" not in joined
        # §2.2/§7 — stdin from the source file, stdout into /output.
        assert argv[-1] == ("cat /eval/source.txt | python3 "
                            "/method/translate.py > /output/translations.txt")

    def test_gpu_only_when_configured(self, tmp_path):
        with pytest.raises(SandboxError, match="GPU"):
            enforce_resource_caps({"gpu": True}, {"gpus": False})
        caps = enforce_resource_caps({"gpu": True}, {"gpus": True})
        argv = run_container_argv(
            "docker", "tag", container_name="c1",
            eval_dir=tmp_path, method_dir=tmp_path, output_dir=tmp_path,
            entrypoint="method/run", caps=caps)
        assert "--gpus" in argv

    @pytest.mark.parametrize("req,needle", [
        ({"ramGB": 10_000}, "RAM"),
        ({"diskGB": 10_000}, "scratch"),
        ({"maxRuntimeMinutes": 10_000}, "runtime"),
    ])
    def test_over_cap_fails_loud(self, req, needle):
        with pytest.raises(SandboxError, match=needle):
            enforce_resource_caps(req, {})

    def test_cpus_above_host_count_fails_loud_never_clamps(self, monkeypatch,
                                                           tmp_path):
        """B4: docker refuses `--cpus N` above the host's core count, so a
        node.json asking for more than the machine has (the §6.2 default
        of 8 on a 4-vCPU guest) fails HERE, naming sandbox.cpus and the
        host count — never a silent clamp."""
        monkeypatch.setattr(sr.os, "cpu_count", lambda: 4)
        with pytest.raises(SandboxError) as ei:
            enforce_resource_caps({}, {})            # default cpus=8
        msg = str(ei.value)
        assert "sandbox.cpus" in msg and "node.json" in msg
        assert " is 8 " in msg and "4 CPU" in msg
        with pytest.raises(SandboxError, match=r"sandbox\.cpus.*is 6 "):
            enforce_resource_caps({}, {"cpus": 6})
        # At or below the host count it passes through unchanged …
        caps = enforce_resource_caps({}, {"cpus": 4})
        assert caps["cpus"] == 4
        argv = run_container_argv(
            "docker", "tag", container_name="c1",
            eval_dir=tmp_path, method_dir=tmp_path, output_dir=tmp_path,
            entrypoint="method/translate.py", caps=caps)
        assert "--cpus 4" in " ".join(argv)
        # … and a fractional share (docker allows it) is fine too.
        assert enforce_resource_caps({}, {"cpus": 1.5})["cpus"] == 1.5

    def test_cpus_unknown_host_count_passes_through(self, monkeypatch):
        # os.cpu_count() may return None; that is not evidence either way,
        # so the configured share stands (docker will judge it).
        monkeypatch.setattr(sr.os, "cpu_count", lambda: None)
        assert enforce_resource_caps({}, {"cpus": 64})["cpus"] == 64

    def test_cpus_must_be_a_positive_number(self):
        with pytest.raises(SandboxError, match="positive"):
            enforce_resource_caps({}, {"cpus": 0})
        with pytest.raises(SandboxError, match="must be a number"):
            enforce_resource_caps({}, {"cpus": "eight"})

    def test_entrypoint_command_shapes(self):
        assert entrypoint_command("method/t.py") == "python3 /method/t.py"
        assert entrypoint_command("method/t.sh") == "sh /method/t.sh"
        assert entrypoint_command("method/bin/t") == "/method/bin/t"


# ---------------------------------------------------------------------------
# §7 execution + §8 teardown with the injected runtime.
# ---------------------------------------------------------------------------

class TestExecution:
    def test_perfect_method_round_trip(self, bundle, tmp_path):
        rt = FakeRuntime()
        facts = execute_method(
            bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
            work_dir=tmp_path / "run", manifest=bundle["manifest"],
            sandbox_cfg={"runtime": "docker"}, runner=rt)
        lines = Path(facts["translations_path"]).read_text(
            encoding="utf-8").splitlines()
        refs = [e["reference"] for e in json.loads(
            SECRET_CORPUS.read_text(encoding="utf-8"))["entries"]]
        assert lines == refs, "the toy method is exact — output must match"
        assert facts["source_count"] == len(refs)

    @pytest.mark.parametrize("behavior,needle", [
        ("exit1", "exited 1"),
        ("no-output", "no /output/translations.txt"),
        ("timeout", "wall clock"),
    ])
    def test_failure_modes_produce_no_score(self, bundle, tmp_path,
                                            behavior, needle):
        with pytest.raises(SandboxError, match=needle):
            execute_method(
                bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
                work_dir=tmp_path / "run", manifest=bundle["manifest"],
                sandbox_cfg={"runtime": "docker"},
                runner=FakeRuntime(behavior))

    def test_output_over_limit_refused(self, bundle, tmp_path, monkeypatch):
        monkeypatch.setattr(sr, "OUTPUT_LIMIT_BYTES", 4)
        with pytest.raises(SandboxError, match="over the"):
            execute_method(
                bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
                work_dir=tmp_path / "run", manifest=bundle["manifest"],
                sandbox_cfg={"runtime": "docker"}, runner=FakeRuntime())

    def test_wipe_tree_removes_everything(self, tmp_path):
        d = tmp_path / "scratch"
        (d / "sub").mkdir(parents=True)
        (d / "sub" / "secret.txt").write_text("nolu sera", encoding="utf-8")
        wipe_tree(d)
        assert not d.exists()


class TestExecuteAndScore:
    def test_scores_through_the_single_scorer(self, bundle, tmp_path):
        rt = FakeRuntime()
        work = tmp_path / "run"
        result = execute_and_score(
            bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
            work_dir=work, sealed_set_id=SECRET_SET,
            language_pair="qaa>qab", node_id=NODE_ID,
            submission={"request_id": "authreq-x",
                        "method_sha": bundle["method_sha"]},
            output_dir=tmp_path / "out", sandbox_cfg={"runtime": "docker"},
            runner=rt)
        assert result["qualifier_score"] > 90, "perfect method, toy corpus"
        card = result["method_card"]
        assert card["submission_lane"] == "method-execution"
        assert "EXECUTION-VERIFIED" in card["provenance_note"]
        assert card["method_sha"] == bundle["method_sha"]
        # §8: the work dir (decrypted source + outputs) is GONE.
        assert not work.exists()
        # teardown asked the runtime to remove container + image
        verbs = [c[1] for c in rt.calls]
        assert "rm" in verbs and "rmi" in verbs
        # The report the publish path will read exists and carries the lane.
        report = json.loads(Path(result["report_path"]).read_text(
            encoding="utf-8"))
        assert report["config"]["prompt_version"] == "method-execution"

    def test_blocked_bundle_never_executes(self, bundle, tmp_path):
        (bundle["dir"] / "method" / "leak.py").write_text(
            "import requests\n", encoding="utf-8")
        rt = FakeRuntime()
        with pytest.raises(SandboxError, match="BLOCK"):
            execute_and_score(
                bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
                work_dir=tmp_path / "run", sealed_set_id=SECRET_SET,
                language_pair="qaa>qab", node_id=NODE_ID,
                output_dir=tmp_path / "out",
                sandbox_cfg={"runtime": "docker"}, runner=rt)
        assert rt.calls == [], "a blocked bundle must never reach the runtime"


# ---------------------------------------------------------------------------
# Runtime accounting (contract C4) + the counts-only diagnostics channel.
#
# Two separate promises. The EXECUTION facts say what the run cost and under
# what conditions — reported on the card, never ranked. The DIAGNOSTICS say
# what happened when it did not score — counts only, because a sealed node
# must never hand back a line of the participant's output or the corpus.
# ---------------------------------------------------------------------------

class TestExecutionFacts:
    def test_execution_facts_carry_caps_and_digest(self, bundle, tmp_path):
        rt = FakeRuntime()
        cfg = {"runtime": "docker", "cpus": 2, "pids_limit": 128}
        facts = execute_method(
            bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
            work_dir=tmp_path / "run", manifest=bundle["manifest"],
            sandbox_cfg=cfg, runner=rt)
        caps = enforce_resource_caps(
            bundle["manifest"].get("requirements") or {},
            {**sr.DEFAULT_SANDBOX_CFG, **cfg})

        # The node's OWN caps, verbatim — the conditions the method ran under.
        for key in ("cpus", "ram_gb", "tmp_gb", "gpu", "pids_limit"):
            assert facts[key] == caps[key], key
        assert facts["cpus"] == 2 and facts["pids_limit"] == 128

        # The digest identifies the image; the tag does not (it is derived
        # from the manifest and reused across rebuilds).
        assert facts["image_digest"] == FAKE_IMAGE_DIGEST
        assert "image_digest_note" not in facts
        assert [c for c in rt.calls
                if c[1:4] == ["image", "inspect", facts["image_tag"]]
                and "{{.Id}}" in c]

        # The wall total covers the build AND the run, not just one of them.
        assert facts["build_seconds"] >= 0
        assert facts["run_seconds"] >= 0
        assert facts["runtime_seconds"] >= facts["run_seconds"]

    def test_unreportable_digest_is_none_with_a_reason(self, bundle, tmp_path):
        """A runtime that cannot report an id gets a None + a note.

        Never a synthesised digest: an invented identity would make an
        unreproducible run look reproducible.
        """
        facts = execute_method(
            bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
            work_dir=tmp_path / "run", manifest=bundle["manifest"],
            sandbox_cfg={"runtime": "docker"},
            runner=FakeRuntime(image_digest=None))
        assert facts["image_digest"] is None
        assert "image inspect exited" in facts["image_digest_note"]

    def test_execution_lands_in_run_card(self, bundle, tmp_path):
        """C4 end to end: measured on the node → published on the card."""
        from mt_eval_harness.execution_facts import EXECUTION_KEYS
        from mt_eval_harness.publish import assemble_run_card

        result = execute_and_score(
            bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
            work_dir=tmp_path / "run", sealed_set_id=SECRET_SET,
            language_pair="qaa>qab", node_id=NODE_ID,
            output_dir=tmp_path / "out", sandbox_cfg={"runtime": "docker"},
            runner=FakeRuntime())
        run_card, _, _ = assemble_run_card(result["report_path"])
        execution = run_card["execution"]
        assert set(EXECUTION_KEYS) <= set(execution)
        assert execution["runtime_seconds"] is not None
        assert execution["runtime_seconds"] >= 0
        assert execution["node_id"] == NODE_ID
        assert execution["runtime"] == "docker"
        assert execution["image_digest"] == FAKE_IMAGE_DIGEST
        assert execution["source_count"] == 6

        # Node-local facts NEVER publish: a scratch path or a container name
        # describes the organizer's disk, not the run.
        for leaked in ("translations_path", "container_name", "image_tag"):
            assert leaked not in execution, leaked
        assert leaked not in json.dumps(run_card)
        assert str(tmp_path) not in json.dumps(run_card)

    def test_scored_diagnostics_count_empty_outputs(self, bundle, tmp_path):
        result = execute_and_score(
            bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
            work_dir=tmp_path / "run", sealed_set_id=SECRET_SET,
            language_pair="qaa>qab", node_id=NODE_ID,
            output_dir=tmp_path / "out", sandbox_cfg={"runtime": "docker"},
            runner=FakeRuntime())
        diagnostics = result["diagnostics"]
        assert diagnostics["outcome"] == "scored"
        assert diagnostics["n_scored"] == 6
        assert diagnostics["n_empty"] == 0
        no_text_guard(diagnostics)


class TestFailureDiagnostics:
    @pytest.mark.parametrize("behavior,stage,needle", [
        ("timeout", "timeout", "wall clock"),
        ("exit1", "exit", "exited 1"),
        ("no-output", "no-output", "no /output/translations.txt"),
        # The container ran fine and produced the WRONG NUMBER of lines —
        # a distinct, actionable stage. Without it a participant cannot tell
        # "it crashed" from "it emitted 5 lines for 6 sources".
        ("garbage", "align", "does not align"),
    ])
    def test_failure_diagnostics_per_stage(self, bundle, tmp_path,
                                           behavior, stage, needle):
        with pytest.raises(SandboxError, match=needle) as ei:
            execute_and_score(
                bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
                work_dir=tmp_path / "run", sealed_set_id=SECRET_SET,
                language_pair="qaa>qab", node_id=NODE_ID,
                output_dir=tmp_path / "out",
                sandbox_cfg={"runtime": "docker"},
                runner=FakeRuntime(behavior))
        diagnostics = ei.value.diagnostics
        assert diagnostics is not None, "every failure carries its stage"
        assert diagnostics["outcome"] == "failed"
        assert diagnostics["stage"] == stage
        assert diagnostics["n_sources"] == 6
        # Aggregates-only: nothing on this channel is long enough to be text.
        no_text_guard(diagnostics)

    def test_build_failure_reports_stage_and_stderr_size_only(self, bundle,
                                                              tmp_path):
        class BuildFails(FakeRuntime):
            def __call__(self, argv, **kw):
                if argv[1] == "build":
                    self.calls.append(list(argv))
                    return subprocess.CompletedProcess(
                        argv, 1, "", "no matching manifest for linux/arm64")
                return super().__call__(argv, **kw)

        with pytest.raises(SandboxError) as ei:
            execute_method(
                bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
                work_dir=tmp_path / "run", manifest=bundle["manifest"],
                sandbox_cfg={"runtime": "docker"}, runner=BuildFails())
        d = ei.value.diagnostics
        assert d["stage"] == "build" and d["exit_code"] == 1
        # The SIZE of stderr crosses; the stderr itself never does.
        assert d["stderr_bytes"] == len(
            b"no matching manifest for linux/arm64")
        assert "arm64" not in json.dumps(d)
        no_text_guard(d)

    def test_guard_refuses_content_on_the_channel(self):
        from mt_eval_harness.execution_facts import DiagnosticsError
        with pytest.raises(DiagnosticsError, match="counts-only"):
            no_text_guard({"outcome": "failed", "stage": "exit",
                           "stderr": "Traceback (most recent call last): "
                                     "File \"/method/translate.py\", line 3"})


# ---------------------------------------------------------------------------
# `node run-method` — connected mode against the shared fake.
# ---------------------------------------------------------------------------

def _seal_fixture(tmp_path, corpus_path, set_id):
    """Seal a fixture corpus via the champollion CLI; skip when unavailable."""
    import shutil
    from mt_eval_harness.contest_prep import (
        ContestPrepError,
        find_champollion_cli,
    )
    if shutil.which("node") is None:
        pytest.skip("node needed to seal fixture corpora")
    try:
        cli = find_champollion_cli()
    except ContestPrepError:
        pytest.skip("champollion CLI not found")
    keys = tmp_path / "keys"
    proc = subprocess.run(cli + ["seal-corpus", "keygen", "--out", str(keys)],
                          capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    pub = next(keys.glob("*.pub.json"))
    priv = next(keys.glob("*.key.json"))
    artifact = tmp_path / f"{set_id}.sealed.json"
    proc = subprocess.run(cli + [
        "seal-corpus", "seal",
        "--seal-input", str(corpus_path),
        "--id", set_id,
        "--custodian-group", "org-test",
        "--threshold-pubkey", str(pub),
        "--seal-out", str(artifact),
    ], capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    return artifact, priv


@pytest.fixture
def world(monkeypatch, tmp_path, bundle):
    import mt_eval_harness.contest_node as cn
    import mt_eval_harness.sovereign_service as svc

    fake = FakeSupabase()
    fake.tables["contests"].append({
        "id": CONTEST_ID, "name": "Synthetic Open 2026", "status": "open",
        "corpus_id": BLIND_SET, "language_pair": "qaa>qab",
        "authorization_model": "per-submission", "intake_open": True,
    })
    # The PUBLIC gate rows (042): the qualifier, and the secret set naming it
    # as its current gate — how the node resolves which qualifier to
    # re-execute a submitted method on.
    fake.tables["qualifiers"].append({
        "qualifier_id": QUALIFIER_ID,
        "corpus_card_id": "eval-qaa-qab-synth-dev-v1",
        "sealed_set_id": BLIND_SET, "threshold": 50.0,
        "metric": "composite", "year": 2026, "status": "active",
    })
    fake.tables["sealed_sets"].append({
        "sealed_set_id": SECRET_SET, "current_qualifier_id": QUALIFIER_ID,
        "status": "active",
    })
    storage: dict[str, bytes] = {}
    patch_service_layer(monkeypatch, fake, svc, cn)
    monkeypatch.setattr(cn, "_storage_download", lambda path: storage[path])

    cfg = {
        "node_id": NODE_ID,
        "poll_seconds": 1,
        "grant_ttl_seconds": 3600,
        "scratch_dir": str(tmp_path / "scratch"),
        "output_dir": str(tmp_path / "runs"),
        "contests": {
            CONTEST_ID: {
                "dev_corpus": str(DEV_CORPUS),
                "refs_plaintext": "unused-in-these-tests.json",
                "corpus_version": "v1",
                "secret_set_id": SECRET_SET,
                "secret_artifact": str(tmp_path / "not-sealed-yet"),
                "secret_privkey": str(tmp_path / "not-sealed-yet.key"),
                "sandbox": {"runtime": "docker"},
            }
        },
    }
    monkeypatch.setattr(cn, "load_node_config", lambda p=None, **kw: cfg)

    def propose(method_sha: str, *, node_id: str = NODE_ID,
                upload: bytes | None = None) -> str:
        request_id = f"authreq-{method_sha[:12]}"
        fingerprint = compute_request_fingerprint(
            {"method_sha": method_sha, "corpus_id": SECRET_SET,
             "corpus_version": "v1"}, node_measurement=node_id)
        fake("POST", "authorization_requests", data={
            "request_id": request_id, "sealed_set_id": SECRET_SET,
            "state": "pending", "fingerprint": fingerprint,
            "method_sha": method_sha, "corpus_id": SECRET_SET,
            "corpus_version": "v1", "node_measurement": node_id,
            "requested_by": PARTICIPANT,
        })
        if upload is not None:
            storage[f"{CONTEST_ID}/{PARTICIPANT}/{request_id}.tar.gz"] = upload
        return request_id

    return {"fake": fake, "cfg": cfg, "storage": storage,
            "tmp_path": tmp_path, "bundle": bundle, "propose": propose,
            "cn": cn}


class TestRunMethodRequest:
    def test_fingerprint_bound_to_other_node_denied(self, world):
        rid = world["propose"](world["bundle"]["method_sha"],
                               node_id="somebody-elses-node",
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "denied"
        assert world["fake"].request(rid)["state"] == "denied"
        assert "bound to node" in out["reason"]

    def test_ungated_sealed_set_refuses_every_run(self, world):
        """Fail-safe: no registered qualifier, no execution at all."""
        world["fake"].tables["qualifiers"].clear()
        world["fake"].tables["sealed_sets"].clear()
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        with pytest.raises(SandboxError, match="no registered qualifier"):
            sr.run_method_request(rid, runner=FakeRuntime())

    def test_method_sha_mismatch_denied(self, world):
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=b"not the proposed bytes")
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "denied"
        assert "not the proposed method" in out["reason"]

    def test_static_block_denied_with_findings(self, world, tmp_path):
        # Re-pack the bundle with a network import inside.
        import io
        import tarfile
        src = world["bundle"]["tarball"].read_bytes()
        buf = io.BytesIO()
        with tarfile.open(fileobj=io.BytesIO(src), mode="r:gz") as tin, \
                tarfile.open(fileobj=buf, mode="w:gz") as tout:
            for m in tin.getmembers():
                tout.addfile(m, tin.extractfile(m))
            leak = b"import requests\n"
            info = tarfile.TarInfo("method/leak.py")
            info.size = len(leak)
            tout.addfile(info, io.BytesIO(leak))
        evil = buf.getvalue()
        rid = world["propose"](hashlib.sha256(evil).hexdigest(), upload=evil)
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "denied"
        assert "spec §3" in out["reason"]

    def test_per_submission_parks_then_publishes(self, world, tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = world["cfg"]["contests"][CONTEST_ID]
        ccfg["secret_artifact"] = str(artifact)
        ccfg["secret_privkey"] = str(priv)

        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "pending"
        assert world["fake"].request(rid)["state"] == "pending"
        assert world["fake"].audit_types() == ["request_created"]

        world["cn"].approve(rid, actor="custodian@example.test")
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "published", out.get("reason")

        cards = world["fake"].tables["run_cards"]
        assert len(cards) == 1
        card = cards[0]
        assert card["trust"] == "verified"
        assert card["condition"] == "method-execution"
        assert card["dataset_id"] == SECRET_SET
        assert "execution-verified" in card["affirmation"]
        assert world["bundle"]["method_sha"] in card["affirmation"]
        subs = world["fake"].tables["contest_submissions"]
        assert subs and subs[0]["run_card_id"] == card["id"]
        assert world["fake"].audit_types() == [
            "request_created", "vote_cast", "request_authorized",
            "grant_minted", "grant_used"]
        grants = world["fake"].tables["auth_grants"]
        assert len(grants) == 1 and grants[0]["used"] is True
        # request_created is appended exactly once across both passes.
        assert world["fake"].audit_types().count("request_created") == 1

    def test_execution_failure_is_not_a_denial(self, world, tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = world["cfg"]["contests"][CONTEST_ID]
        ccfg["secret_artifact"] = str(artifact)
        ccfg["secret_privkey"] = str(priv)
        world["fake"].tables["contests"][0]["authorization_model"] = "blanket"

        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(
            rid, runner=FakeRuntime("exit1", healthy_runs=1))
        assert out["status"] == "failed"
        assert world["fake"].request(rid)["state"] == "authorized", \
            "an executed-and-crashed method is not a custodian denial"
        assert not world["fake"].tables["run_cards"]

    def _blanket_world(self, world, tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = world["cfg"]["contests"][CONTEST_ID]
        ccfg["secret_artifact"] = str(artifact)
        ccfg["secret_privkey"] = str(priv)
        world["fake"].tables["contests"][0]["authorization_model"] = "blanket"
        return world["propose"](world["bundle"]["method_sha"],
                                upload=world["bundle"]["tarball"].read_bytes())

    def test_diagnostics_patched_on_failure(self, world, tmp_path):
        """Practice 12: the participant learns the STAGE, and nothing else.

        A sealed node returns no outputs, so this counts-only row is the only
        feedback a failed submission ever gets.
        """
        rid = self._blanket_world(world, tmp_path / "a")
        out = sr.run_method_request(
            rid, runner=FakeRuntime("exit1", healthy_runs=1))
        assert out["status"] == "failed"
        recorded = world["fake"].request(rid)["execution_diagnostics"]
        assert recorded == out["diagnostics"]
        assert recorded["outcome"] == "failed"
        assert recorded["stage"] == "exit"
        assert recorded["exit_code"] == 1
        no_text_guard(recorded)

    def test_diagnostics_patched_on_success_with_execution_on_the_row(
            self, world, tmp_path):
        """A scored run records counts too — and its facts reach the card."""
        rid = self._blanket_world(world, tmp_path / "a")
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "published", out.get("reason")
        recorded = world["fake"].request(rid)["execution_diagnostics"]
        assert recorded == out["diagnostics"]
        assert recorded["outcome"] == "scored"
        assert recorded["n_scored"] == 6 and recorded["n_empty"] == 0
        no_text_guard(recorded)

        # …and the execution facts reached the published row (contract C4).
        card = world["fake"].tables["run_cards"][0]
        execution = card["run_card"]["execution"]
        assert execution["node_id"] == NODE_ID
        assert execution["image_digest"] == FAKE_IMAGE_DIGEST
        assert execution["runtime_seconds"] is not None
        assert "translations_path" not in json.dumps(card)

    def test_missing_074_column_never_fails_a_scored_run(self, world, tmp_path,
                                                         monkeypatch, capsys):
        """A pre-074 database has nowhere to put diagnostics.

        That is a schema gap to report, not a reason to throw away a real
        score — the optional channel must never cost the actual result.
        """
        import mt_eval_harness.sovereign_service as svc

        rid = self._blanket_world(world, tmp_path / "a")
        fake = world["fake"]

        def refuse_diagnostics(method, path, *, data=None, params=None, **kw):
            if (method == "PATCH" and path == "authorization_requests"
                    and "execution_diagnostics" in (data or {})):
                raise RuntimeError(
                    "Supabase service API error (400): {\"code\":\"PGRST204\","
                    "\"message\":\"Could not find the 'execution_diagnostics' "
                    "column of 'authorization_requests' in the schema cache\"}")
            return fake(method, path, data=data, params=params, **kw)

        monkeypatch.setattr(svc, "service_request", refuse_diagnostics)

        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "published", out.get("reason")
        assert out["diagnostics"]["outcome"] == "scored"
        printed = capsys.readouterr().out
        assert "diagnostics not recorded" in printed
        assert "execution_diagnostics does not exist" in printed
        assert "migration 074" in printed

    def test_open_model_refused_for_sealed_t2(self, world):
        world["fake"].tables["contests"][0]["authorization_model"] = "open"
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        with pytest.raises(SandboxError, match="open"):
            sr.run_method_request(rid, runner=FakeRuntime())

    def test_aggregates_only_and_secret_corpus_wiped(self, world, tmp_path):
        """Properties #1 + #4 (E2E verification 2026-07-18): a published T2
        run carries NO per-segment rows and NO secret source/reference TEXT,
        and the decrypted secret corpus is wiped from scratch after scoring.

        The Phase-A hypotheses lane asserts the aggregates-only posture
        (test_contest_node.py); this pins it for the Phase-B method-execution
        lane too, plus the corpus wipe that keeps the decrypted plaintext off
        disk once the seconds of scoring are over."""
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = world["cfg"]["contests"][CONTEST_ID]
        ccfg["secret_artifact"] = str(artifact)
        ccfg["secret_privkey"] = str(priv)
        # blanket → single pass straight to publish (no custodian round-trip).
        world["fake"].tables["contests"][0]["authorization_model"] = "blanket"

        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "published", out.get("reason")

        fake = world["fake"]
        secret = json.loads(
            SECRET_CORPUS.read_text(encoding="utf-8"))["entries"]

        # Aggregates-only BY CONSTRUCTION: the per-entry table is NEVER touched
        # (a POST to it would blow up on the fake's unknown-table guard first).
        assert "run_card_entries" not in fake.tables

        # What publishes (the run_cards row) holds NO secret source/reference.
        card = fake.tables["run_cards"][0]
        blob = json.dumps(card, ensure_ascii=False)
        for e in secret:
            assert e["reference"] not in blob, e["reference"]
            assert e["source"] not in blob, e["source"]

        # The decrypted secret corpus scratch is gone (wipe_scratch_file ran).
        scratch = Path(world["cfg"]["scratch_dir"]).expanduser()
        leftover = [
            str(p) for p in scratch.rglob("*.json")
            if any(e["reference"] in p.read_text(encoding="utf-8",
                                                 errors="replace")
                   for e in secret)]
        assert leftover == [], f"secret plaintext left in scratch: {leftover}"

        # The per-request sandbox work dir (decrypted source + outputs) is wiped.
        assert not (scratch / rid / "run").exists()


# ---------------------------------------------------------------------------
# Additional §3.1 evasion forms — the scan's alternation must cover the
# ORDINARY ways to name a network capability, not just the handful the first
# tests hit. (E2E verification 2026-07-18: node require() and several Python
# net libs in the alternation had no test.)
# ---------------------------------------------------------------------------

class TestNetworkScanBypassForms:
    def _scan(self, tmp_path, name, content):
        d = tmp_path / f"m-{name}"
        d.mkdir()
        (d / name).write_text(content, encoding="utf-8")
        return scan_network_calls(d)

    @pytest.mark.parametrize("name,content", [
        # Node.js network modules via require() — the pattern shipped but was
        # never exercised by a test.
        ("net.js", "const net = require('net')\n"),
        ("dns.js", "const d = require('dns')\n"),
        ("tls.cjs", "const tls = require('tls')\n"),
        ("dgram.js", "const s = require('dgram')\n"),
        ("http.mjs", "const http = require('http')\n"),
        ("https.js", "const h = require('https')\n"),
        # Python net libs in the banned alternation that no test reached.
        ("httpx_m.py", "import httpx\n"),
        ("paramiko_m.py", "import paramiko\n"),
        ("ws_m.py", "import websockets\n"),
        ("smtp_m.py", "import smtplib\n"),
        ("ftp_m.py", "import ftplib\n"),
        ("telnet_m.py", "import telnetlib\n"),
    ])
    def test_more_network_forms_block(self, tmp_path, name, content):
        findings = self._scan(tmp_path, name, content)
        assert any(f["severity"] == "BLOCK" for f in findings), content

    def test_subprocess_popen_env_warns(self, tmp_path):
        findings = self._scan(
            tmp_path, "x.py",
            "import subprocess\nsubprocess.Popen(['x'], env={'A': 'B'})\n")
        assert any(f["severity"] == "WARN"
                   and f["category"] == "environment-leaks"
                   for f in findings), findings

    def test_benign_node_require_stays_clean(self, tmp_path):
        # A non-network require must not trip the node pattern.
        assert self._scan(tmp_path, "ok.js",
                          "const fs = require('fs')\n") == []


# ---------------------------------------------------------------------------
# §7 — references NEVER enter the container. write_source_file writes the
# SOURCE side only into the mounted /eval dir; the harness holds references
# outside the container for scoring. (E2E verification 2026-07-18.)
# ---------------------------------------------------------------------------

class TestReferencesNeverEnterContainer:
    def test_only_source_written_no_reference_text(self, tmp_path):
        eval_dir = tmp_path / "eval"
        n = write_source_file(SECRET_CORPUS, eval_dir)
        # The mounted dir contains exactly one file: source.txt.
        assert sorted(p.name for p in eval_dir.iterdir()) == ["source.txt"]
        text = (eval_dir / "source.txt").read_text(encoding="utf-8")
        corpus = json.loads(
            SECRET_CORPUS.read_text(encoding="utf-8"))["entries"]
        assert n == len(corpus)
        for e in corpus:
            assert e["source"] in text, f"source missing: {e['source']}"
            # The reference translation must NOT be written into /eval.
            assert e["reference"] not in text, \
                f"reference leaked into /eval: {e['reference']}"


# ---------------------------------------------------------------------------
# §6 — egress is architecturally closed. Both the build and the run remove the
# network namespace, and NO egress-enabling flag is ever added. This is a
# regression guard: a future 'helpful' edit that opens a port, a DNS server,
# or host networking must fail this test. (E2E verification 2026-07-18.)
# ---------------------------------------------------------------------------

class TestEgressIsArchitecturallyClosed:
    _EGRESS_FLAGS = {
        "-p", "-P", "--publish", "--publish-all", "--add-host", "--dns",
        "--net", "--network=host", "--network=bridge", "--network=container",
        "--net=host",
    }

    def test_build_and_run_both_airgapped_no_egress_flags(self, tmp_path):
        caps = enforce_resource_caps({"ramGB": 8, "diskGB": 4,
                                      "maxRuntimeMinutes": 30}, {})
        build = build_image_argv("docker", "t", tmp_path)
        run = run_container_argv(
            "docker", "t", container_name="c",
            eval_dir=tmp_path / "eval", method_dir=tmp_path / "method",
            output_dir=tmp_path / "out", entrypoint="method/translate.py",
            caps=caps)
        assert "--network=none" in build, "build must be air-gapped (§3.3)"
        assert "--network=none" in run, "run must remove the net namespace"
        # No egress-enabling flag may appear anywhere in the run argv.
        assert not (set(run) & self._EGRESS_FLAGS), \
            f"egress-enabling flag present: {set(run) & self._EGRESS_FLAGS}"
        # The ONLY network directive is `--network=none`; no other --network=*.
        net_directives = [a for a in run if a.startswith("--network")
                          or a.startswith("--net=")]
        assert net_directives == ["--network=none"], net_directives


# ---------------------------------------------------------------------------
# The publish TAIL under a hidden-until-close contest (contract C5).
#
# Everything up to the publish is identical — the method still executes, the
# grant is still claimed and consumed, the card is still assembled and
# validated. Only the destination changes: contest_deferred_results instead of
# run_cards. "No feedback at submission time" costs the participant a wait,
# never a run.
# ---------------------------------------------------------------------------

class TestPublishTailPublicationPolicy:
    def _run_under(self, world, tmp_path, metadata):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = world["cfg"]["contests"][CONTEST_ID]
        ccfg["secret_artifact"] = str(artifact)
        ccfg["secret_privkey"] = str(priv)
        world["fake"].tables["contests"][0]["authorization_model"] = "blanket"
        world["fake"].tables["contests"][0]["metadata"] = metadata
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        return rid, sr.run_method_request(rid, runner=FakeRuntime())

    def test_hidden_until_close_withholds_the_card(self, world, tmp_path):
        rid, out = self._run_under(
            world, tmp_path, {"results_visibility": "hidden_until_close"})
        assert out["status"] == "deferred", out.get("reason")
        assert out["run_card_id"] is None
        assert out["results_visibility"] == "hidden_until_close"
        assert out["qualifier_score"] is not None, \
            "the run was scored — only its publication was withheld"
        fake = world["fake"]
        assert fake.tables["run_cards"] == [], \
            "nothing reaches the board while the contest is open"
        assert fake.tables["contest_submissions"] == []
        held = fake.tables["contest_deferred_results"]
        assert len(held) == 1
        assert held[0]["request_id"] == rid
        assert held[0]["contest_id"] == CONTEST_ID
        assert held[0]["sealed_set_id"] == SECRET_SET
        assert held[0]["role"] == "main"
        # The grant WAS claimed and consumed: the run really happened.
        assert fake.tables["auth_grants"][0]["used"] is True
        assert "grant_used" in fake.audit_types()
        # The held row is a complete, publishable card carrying the entry's
        # declarations.
        from mt_eval_harness import contest_node as cn
        card = cn._strip_sidecar(held[0]["run_card_row"])
        assert card["trust"] == "verified"
        assert card["condition"] == "method-execution"
        assert card["dataset_id"] == SECRET_SET
        side = held[0]["run_card_row"][cn.DEFERRED_SIDECAR_KEY]
        assert side["fields"]["submitter_label"] == card["submitter"]
        assert side["authorization_request_id"] == rid

    def test_close_publishes_exactly_what_was_withheld(self, world, tmp_path):
        rid, out = self._run_under(
            world, tmp_path, {"results_visibility": "hidden_until_close"})
        from mt_eval_harness import contest_node as cn
        held = dict(world["fake"].tables["contest_deferred_results"][0])
        expected = cn._strip_sidecar(held["run_card_row"])
        ids = cn.publish_deferred(CONTEST_ID)
        assert ids == [expected["id"]]
        assert world["fake"].tables["run_cards"] == [expected]
        subs = world["fake"].tables["contest_submissions"]
        assert len(subs) == 1 and subs[0]["run_card_id"] == expected["id"]
        assert subs[0]["authorization_request_id"] == rid

    def test_immediate_is_the_unchanged_path(self, world, tmp_path):
        _, out = self._run_under(world, tmp_path,
                                 {"results_visibility": "immediate"})
        assert out["status"] == "published"
        assert len(world["fake"].tables["run_cards"]) == 1
        assert world["fake"].tables["contest_deferred_results"] == []

    def test_a_contest_with_no_metadata_publishes(self, world, tmp_path):
        _, out = self._run_under(world, tmp_path, None)
        assert out["status"] == "published"
        assert len(world["fake"].tables["run_cards"]) == 1


# ---------------------------------------------------------------------------
# The PUBLIC GATE, measured by the node (R2, 2026-09-06). Replaces the retired
# "published T1 record" lookup: the node re-EXECUTES the submitted artifact on
# the public dev corpus and gates on its own number, before any grant.
# ---------------------------------------------------------------------------

class TestQualifierReExecution:
    def _bundle_with(self, world, tmp_path, manifest_patch):
        """Repack the toy bundle with a patched manifest; return its bytes."""
        import io
        import tarfile
        src = world["bundle"]["tarball"].read_bytes()
        buf = io.BytesIO()
        with tarfile.open(fileobj=io.BytesIO(src), mode="r:gz") as tin, \
                tarfile.open(fileobj=buf, mode="w:gz") as tout:
            for m in tin.getmembers():
                if m.name == "manifest.json":
                    manifest = json.loads(tin.extractfile(m).read())
                    manifest_patch(manifest)
                    blob = json.dumps(manifest, indent=2).encode("utf-8")
                    info = tarfile.TarInfo("manifest.json")
                    info.size = len(blob)
                    tout.addfile(info, io.BytesIO(blob))
                else:
                    tout.addfile(m, tin.extractfile(m))
        return buf.getvalue()

    def test_perfect_method_clears_the_gate_and_publishes(self, world,
                                                          tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = world["cfg"]["contests"][CONTEST_ID]
        ccfg["secret_artifact"] = str(artifact)
        ccfg["secret_privkey"] = str(priv)
        world["fake"].tables["contests"][0]["authorization_model"] = "blanket"

        rt = FakeRuntime()
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(rid, runner=rt)
        assert out["status"] == "published", out.get("reason")
        # TWO executions: the public dev set, then the sealed set.
        assert len([c for c in rt.calls if c[1] == "run"]) == 2

    def test_method_that_fails_the_public_set_is_denied_before_any_grant(
            self, world):
        """A garbage method never reaches the sealed set, and no custodian is
        asked about it — the qualifier exists precisely to stop that."""
        world["fake"].tables["contests"][0]["authorization_model"] = "blanket"
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(rid, runner=FakeRuntime("garbage"))
        assert out["status"] == "denied"
        assert "qualifier not met on node re-execution" in out["reason"]
        assert "claimed 61.5" in out["reason"]
        assert world["fake"].request(rid)["state"] == "denied"
        assert not world["fake"].tables["auth_grants"], \
            "no grant may be minted for a method that failed the public gate"
        assert not world["fake"].tables["run_cards"]

    def test_method_that_crashes_on_the_public_set_is_denied(self, world):
        world["fake"].tables["contests"][0]["authorization_model"] = "blanket"
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(rid, runner=FakeRuntime("exit1"))
        assert out["status"] == "denied"
        assert "could not be executed on the public dev set" in out["reason"]
        assert not world["fake"].tables["auth_grants"]

    def test_bundle_without_a_receipt_is_denied(self, world, tmp_path):
        evil = self._bundle_with(world, tmp_path,
                                 lambda m: m.pop("qualifier", None))
        rid = world["propose"](hashlib.sha256(evil).hexdigest(), upload=evil)
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "denied"
        assert "no qualifier receipt" in out["reason"]

    def test_receipt_for_another_qualifier_is_denied(self, world, tmp_path):
        def patch(m):
            m["qualifier"] = dict(m["qualifier"],
                                  qualifierId="eval-x-qualifier-v2025")
        evil = self._bundle_with(world, tmp_path, patch)
        rid = world["propose"](hashlib.sha256(evil).hexdigest(), upload=evil)
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "denied"
        assert "eval-x-qualifier-v2025" in out["reason"]

    def test_node_without_a_dev_corpus_fails_loud(self, world, tmp_path):
        """A node misconfiguration is the NODE's problem — it must not be
        dressed up as a participant refusal."""
        world["cfg"]["contests"][CONTEST_ID].pop("dev_corpus")
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        with pytest.raises(SandboxError, match="no dev_corpus"):
            sr.run_method_request(rid, runner=FakeRuntime())


class TestNodeFitBeforeTheGate:
    """Round 3 researcher persona (2026-10-03): a bundle packaged with
    submit-method's defaults asked for 8 GB on a node whose `node init`
    template allowed 4; the refusal read "qualifier not met on node
    re-execution", was recorded as a denial, and the entrant repackaged
    twice. A machine with no container runtime printed a raw `[Errno 2] …
    'docker'`. Both are now named for what they are, and RAISED — the request
    is left as it was."""

    def test_every_exceeded_cap_is_named_in_one_refusal(self):
        with pytest.raises(sr.ResourceRequestRefused) as ei:
            enforce_resource_caps(
                {"ramGB": 8, "diskGB": 10, "maxRuntimeMinutes": 120,
                 "gpu": True},
                {"max_ram_gb": 4, "max_tmp_gb": 4, "max_runtime_minutes": 30,
                 "gpus": False, "cpus": 1})
        exc = ei.value
        msg = str(exc)
        assert "8 GB RAM requested, this node allows 4 GB (sandbox.max_ram_gb)" in msg
        assert "10 GB scratch disk requested, this node allows 4 GB" in msg
        assert "120 min wall-clock runtime requested" in msg
        assert "GPU" in msg and "not a qualifier result" in msg
        assert exc.flags == "--ram-gb 4 --disk-gb 4 --max-runtime-minutes 30"
        assert "sandbox.max_ram_gb (to at least 8)" in exc.node_keys
        assert isinstance(exc, SandboxError)   # every old except still catches

    def test_the_default_bundle_fits_the_shipped_template(self, bundle):
        import json as _json
        from mt_eval_harness import contest_node
        (entry,) = _json.loads(
            contest_node.node_template_text())["contests"].values()
        sr.preflight_node_fit(bundle["manifest"],
                              {**entry["sandbox"], "runtime": "docker",
                               "cpus": 1},
                              runner=FakeRuntime())

    def test_no_runtime_on_path_is_one_line_naming_docker_or_podman(
            self, monkeypatch):
        monkeypatch.setattr(sr.shutil, "which", lambda name: None)
        with pytest.raises(sr.NodeSetupError) as ei:
            sr.resolve_container_runtime({}, runner=subprocess.run)
        msg = str(ei.value)
        assert "\n" not in msg
        assert "neither docker nor podman is on PATH" in msg
        assert "install docker or podman" in msg
        with pytest.raises(sr.NodeSetupError) as ei:
            sr.resolve_container_runtime({"runtime": "docker"},
                                         runner=subprocess.run)
        assert "sets sandbox.runtime to 'docker'" in str(ei.value)
        assert "docker or podman" in str(ei.value)

    def test_null_runtime_autodetects_podman(self, monkeypatch):
        monkeypatch.setattr(sr.shutil, "which",
                            lambda name: "/usr/bin/podman"
                            if name == "podman" else None)
        assert sr.resolve_container_runtime({"runtime": None},
                                            runner=subprocess.run) == "podman"

    def test_a_runtime_that_cannot_be_executed_is_a_node_setup_error(
            self, bundle, tmp_path):
        def no_docker(argv, **kw):
            raise FileNotFoundError(2, "No such file or directory", argv[0])
        with pytest.raises(sr.NodeSetupError, match="docker or podman"):
            execute_method(
                bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
                work_dir=tmp_path / "run", manifest=bundle["manifest"],
                sandbox_cfg={"runtime": "docker"}, runner=no_docker)

    def test_the_gate_raises_node_problems_instead_of_denying(self, world):
        def no_docker(argv, **kw):
            raise FileNotFoundError(2, "No such file or directory", argv[0])
        qualifier = {"qualifier_id": QUALIFIER_ID,
                     "corpus_card_id": "eval-qaa-qab-synth-dev-v1",
                     "threshold": 50.0, "year": 2026}
        with pytest.raises(sr.NodeSetupError):
            sr.verify_qualifier_by_execution(
                world["bundle"]["dir"], "runnable-bundle",
                {"dev_corpus": str(DEV_CORPUS)}, qualifier,
                manifest=world["bundle"]["manifest"],
                work_dir=world["tmp_path"] / "q", output_dir=world["tmp_path"]
                / "qo", node_id=NODE_ID, sandbox_cfg={"runtime": "docker"},
                runner=no_docker)

    def test_a_resource_mismatch_leaves_the_request_pending(self, world):
        world["cfg"]["contests"][CONTEST_ID]["sandbox"] = {
            "runtime": "docker", "max_ram_gb": 2, "cpus": 1}
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        rt = FakeRuntime()
        with pytest.raises(sr.ResourceRequestRefused) as ei:
            sr.run_method_request(rid, runner=rt)
        msg = str(ei.value)
        assert "this node allows 2 GB (sandbox.max_ram_gb)" in msg
        assert "--ram-gb 2" in msg and "stays pending" in msg
        assert f"mt-eval node run-method {rid}" in msg
        assert "qualifier not met" not in msg
        # Nothing ran, nothing was denied: the request can still run.
        assert not [c for c in rt.calls if c[1] in ("build", "run")]
        assert world["fake"].request(rid)["state"] == "pending"
        assert "request_denied" not in world["fake"].audit_types()

    def test_the_qualifier_denial_names_what_the_score_is(self, world):
        world["fake"].tables["contests"][0]["authorization_model"] = "blanket"
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(rid, runner=FakeRuntime("garbage"))
        assert out["status"] == "denied"
        assert "chrF++ 0-100 qualifier scale" in out["reason"]
        assert "corpus chrF++ of the dev outputs" in out["reason"]
        assert "composite" not in out["reason"]


class TestSubmissionRowDeclarations:
    """The contest_submissions row the node writes (C2 + migration 074)."""

    def test_row_carries_the_participants_declarations_and_no_email(
            self, world, tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = world["cfg"]["contests"][CONTEST_ID]
        ccfg["secret_artifact"] = str(artifact)
        ccfg["secret_privkey"] = str(priv)
        world["fake"].tables["contests"][0]["authorization_model"] = "blanket"

        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "published", out.get("reason")

        sub = world["fake"].tables["contest_submissions"][0]
        manifest = world["bundle"]["manifest"]
        assert sub["authorization_request_id"] == rid
        assert sub["track"] == manifest["constraints"]["track"]
        assert sub["is_primary"] == manifest["submission"]["isPrimary"]
        assert sub["description"] == manifest["submission"]["description"]
        assert sub["method_release_url"] == \
            manifest["submission"]["methodReleaseUrl"]
        assert sub["constraints"] == manifest["constraints"]
        assert sub["submitter_label"] == manifest["developer"]["name"]
        # submitted_by stays the RLS identity; the byline is separate.
        assert sub["submitted_by"] == PARTICIPANT

        # The world-readable board byline is NEVER the email.
        card = world["fake"].tables["run_cards"][0]
        assert card["submitter"] == manifest["developer"]["name"]
        assert "@" not in card["submitter"]


# ---------------------------------------------------------------------------
# Contract C6 — the other sets one authorized run covers: third-party
# diagnostic suites (practice 14) and the sealed holdout split (practice 7).
#
# The two roles have deliberately OPPOSITE failure semantics, and that is the
# point of most of these tests: a broken third-party file is the organizer's
# problem and must not cost the participant their main score; a broken holdout
# breaks a promise the organizer made to everyone and must fail the request.
# ---------------------------------------------------------------------------

HOLDOUT_SET = "eval-qaa-qab-synth-holdout-v1"
SUITE_ID = "eval-thirdparty-diag-v1"


def _extra_corpus(tmp_path, name, entries):
    """A second synthetic corpus, in the harness corpus-file shape."""
    p = tmp_path / f"{name}.json"
    p.write_text(json.dumps({
        "dataset": {"corpus_id": name, "version": "1.0",
                    "language_pair": {"source": "qaa", "target": "qab"},
                    "description": "SYNTHETIC extra set (invented qaa>qab).",
                    "provenance": {"license": "CC0-1.0"}},
        "entries": entries,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return p


@pytest.fixture
def suite_corpus(tmp_path):
    return _extra_corpus(tmp_path, "suite", [
        {"id": 0, "source": "mira sol volu", "reference": "sol miravo"},
        {"id": 1, "source": "kani luna telo", "reference": "luna kanivo"},
    ])


@pytest.fixture
def holdout_corpus(tmp_path):
    return _extra_corpus(tmp_path, "holdout", [
        {"id": 0, "source": "venu pira kelo", "reference": "pira venuvo"},
        {"id": 1, "source": "tolu keno mira", "reference": "keno toluvo"},
    ])


def _run(bundle, tmp_path, rt, extra_sets, **kw):
    return execute_and_score(
        bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
        work_dir=tmp_path / "run", sealed_set_id=SECRET_SET,
        language_pair="qaa>qab", node_id=NODE_ID,
        submission={"method_sha": bundle["method_sha"]},
        output_dir=tmp_path / "out", sandbox_cfg={"runtime": "docker"},
        runner=rt, extra_sets=extra_sets, **kw)


class TestExtraSets:
    def test_image_is_built_once_and_each_set_is_its_own_airgapped_run(
            self, bundle, tmp_path, suite_corpus, holdout_corpus):
        rt = FakeRuntime()
        result = _run(bundle, tmp_path, rt, [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(suite_corpus)},
            {"role": "holdout", "set_id": HOLDOUT_SET,
             "corpus_path": str(holdout_corpus)},
        ])
        builds = [c for c in rt.calls if c[1] == "build"]
        runs = [c for c in rt.calls if c[1] == "run"]
        assert len(builds) == 1, "the image is built ONCE for the whole run"
        assert len(runs) == 3, "main + suite + holdout, one container each"
        for argv in runs:
            assert "--network=none" in argv
            assert "--read-only" in argv
        tags = {argv[argv.index("/bin/sh") - 1] for argv in runs}
        assert len(tags) == 1 and tags == {builds[0][builds[0].index("-t") + 1]}, (
            "every set ran the image the single build produced")
        names = {argv[argv.index("--name") + 1] for argv in runs}
        assert len(names) == 3, "each set is its own container"
        assert result["holdout"] is not None and result["by_test_suite"]

    def test_by_test_suite_is_aggregates_only(self, bundle, tmp_path,
                                              suite_corpus):
        result = _run(bundle, tmp_path, FakeRuntime(), [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(suite_corpus),
             "corpus_sha256": sha256_file(suite_corpus)},
        ])
        entry = result["by_test_suite"][SUITE_ID]
        # Scoring standard/1: no composite in the suite aggregates.
        assert set(entry) == {"corpus_card_id", "sha256", "n",
                              "chrf_plus_plus", "corpus_bleu",
                              "runtime_seconds"}
        assert entry["n"] == 2
        assert entry["chrf_plus_plus"] > 90      # the toy rule is perfect
        assert entry["runtime_seconds"] is not None
        blob = json.dumps(entry)
        for text in ("sol miravo", "luna kanivo", "mira sol volu"):
            assert text not in blob, "a per-segment output never leaves a node"

    def test_suite_aggregates_ride_the_main_run_card(self, bundle, tmp_path,
                                                     suite_corpus):
        """C4/C6 join here: the suites feed the single scorer for the MAIN
        run, so they land on the card publish assembles."""
        result = _run(bundle, tmp_path, FakeRuntime(), [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(suite_corpus)},
        ])
        run_log = json.loads(Path(result["run_log_path"]).read_text(
            encoding="utf-8"))
        assert SUITE_ID in run_log["provenance"]["by_test_suite"]
        from mt_eval_harness.publish import assemble_run_card
        card, _uuid, _fp = assemble_run_card(result["report_path"])
        assert card["by_test_suite"][SUITE_ID]["n"] == 2

    def test_a_failing_suite_never_fails_the_main_run(self, bundle, tmp_path):
        result = _run(bundle, tmp_path, FakeRuntime(), [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(tmp_path / "not-here.json")},
        ])
        assert result["qualifier_score"] > 90, "the main score stands"
        entry = result["by_test_suite"][SUITE_ID]
        assert entry["stage"] == "run"
        assert "does not hold this corpus" in entry["error"]
        assert str(tmp_path) not in entry["error"], (
            "a recorded reason is published — it must never carry a path on "
            "the organizer's disk")

    def test_a_suite_whose_bytes_moved_is_refused_not_reported(
            self, bundle, tmp_path, suite_corpus):
        result = _run(bundle, tmp_path, FakeRuntime(), [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(suite_corpus), "corpus_sha256": "b" * 64},
        ])
        entry = result["by_test_suite"][SUITE_ID]
        assert "pinned at sha256" in entry["error"]
        assert "chrf_plus_plus" not in entry

    def test_holdout_is_a_second_full_result(self, bundle, tmp_path,
                                             holdout_corpus):
        result = _run(bundle, tmp_path, FakeRuntime(), [
            {"role": "holdout", "set_id": HOLDOUT_SET,
             "corpus_path": str(holdout_corpus),
             "corpus_sha256": sha256_file(holdout_corpus)},
        ])
        holdout = result["holdout"]
        assert holdout["role"] == "holdout"
        # Same shape as the main result — it is published on its own.
        for key in ("run_log_path", "report_path", "run_id", "evaluated",
                    "chrf_plus_plus", "chrf_ci_lower", "qualifier_score",
                    "execution", "diagnostics", "method_card"):
            assert key in holdout, key
        report = json.loads(Path(holdout["report_path"]).read_text(
            encoding="utf-8"))
        assert report["config"]["dataset_id"] == HOLDOUT_SET
        assert result["report_path"] != holdout["report_path"]
        # Its runtime is its OWN, and it did not re-build the image.
        assert holdout["execution"]["build_seconds"] == 0.0
        assert "reused it" in holdout["execution"]["build_note"]

    def test_a_failing_holdout_fails_the_whole_request(self, bundle, tmp_path):
        with pytest.raises(SandboxError, match="does not hold this corpus"):
            _run(bundle, tmp_path, FakeRuntime(), [
                {"role": "holdout", "set_id": HOLDOUT_SET,
                 "corpus_path": str(tmp_path / "gone.json")},
            ])

    def test_two_holdouts_refused(self, bundle, tmp_path, holdout_corpus):
        with pytest.raises(SandboxError, match="two holdout sets"):
            _run(bundle, tmp_path, FakeRuntime(), [
                {"role": "holdout", "set_id": HOLDOUT_SET,
                 "corpus_path": str(holdout_corpus)},
                {"role": "holdout", "set_id": "other",
                 "corpus_path": str(holdout_corpus)},
            ])

    def test_unknown_role_refused(self, bundle, tmp_path, suite_corpus):
        with pytest.raises(SandboxError, match="role must be"):
            _run(bundle, tmp_path, FakeRuntime(), [
                {"role": "bonus", "set_id": "x",
                 "corpus_path": str(suite_corpus)},
            ])

    def test_no_extra_sets_reports_none_not_an_empty_promise(self, bundle,
                                                             tmp_path):
        result = _run(bundle, tmp_path, FakeRuntime(), None)
        assert result["by_test_suite"] == {}
        assert result["holdout"] is None
        run_log = json.loads(Path(result["run_log_path"]).read_text(
            encoding="utf-8"))
        assert "by_test_suite" not in run_log["provenance"], (
            "an empty map must not be recorded as if suites had been run")

    def test_extra_set_containers_see_source_only(self, bundle, tmp_path,
                                                  suite_corpus):
        """References never enter a container — the same guarantee the main
        run makes, on every extra set. Recorded DURING the run: teardown wipes
        the scratch tree afterwards, which is itself the point."""
        seen = []

        class Recording(FakeRuntime):
            def __call__(self, argv, **kw):
                if argv[1] == "run":
                    d = self._mount_source(argv, "/eval")
                    seen.append(sorted(p.name for p in d.iterdir()))
                return super().__call__(argv, **kw)

        rt = Recording()
        _run(bundle, tmp_path, rt, [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(suite_corpus)},
        ])
        assert seen == [["source.txt"], ["source.txt"]]


class TestSuiteFailureIsNeverSilent:
    def test_an_unexpected_suite_failure_is_recorded_and_printed(
            self, bundle, tmp_path, suite_corpus, monkeypatch, capsys):
        """A third-party file can fail in ways nobody enumerated. That must
        cost the participant nothing and must still be SAID."""
        import mt_eval_harness.sandbox_runner as sr
        real = sr.write_source_file
        calls = {"n": 0}

        def flaky(corpus_path, eval_dir):
            calls["n"] += 1
            if calls["n"] > 1:                     # the suite's staging
                raise ZeroDivisionError("something nobody predicted")
            return real(corpus_path, eval_dir)

        monkeypatch.setattr(sr, "write_source_file", flaky)
        result = _run(bundle, tmp_path, FakeRuntime(), [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(suite_corpus)},
        ])
        assert result["qualifier_score"] > 90
        entry = result["by_test_suite"][SUITE_ID]
        assert "unexpected failure (ZeroDivisionError)" in entry["error"]
        assert "ZeroDivisionError" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# The wire (M3-wire, 2026-09-07): what node.json DECLARES becomes what one
# authorized run actually covers — the holdout split and the diagnostic
# suites — and what the audit trail says that grant covered.
# ---------------------------------------------------------------------------

class TestDeclaredSetsBecomeExtraSets:
    def test_suites_and_holdout_are_shaped_from_the_config(self, tmp_path):
        cfg = {
            "holdout_set_id": HOLDOUT_SET,
            "holdout_corpus": str(tmp_path / "h.json"),
            "test_suites": [{"suite_id": SUITE_ID,
                             "corpus_path": "/s/one.json",
                             "corpus_sha256": "a" * 64}],
        }
        sets = sr.build_extra_sets(cfg, holdout_corpus=tmp_path / "open.json")
        assert sets == [
            {"role": "suite", "suite_id": SUITE_ID, "set_id": SUITE_ID,
             "corpus_path": "/s/one.json", "corpus_sha256": "a" * 64},
            {"role": "holdout", "set_id": HOLDOUT_SET,
             "corpus_path": str(tmp_path / "open.json")},
        ]

    def test_nothing_declared_is_no_extra_sets(self):
        assert sr.build_extra_sets({}, holdout_corpus=None) == []

    def test_a_declared_holdout_the_node_does_not_hold_refuses_the_run(
            self, tmp_path):
        """The organizer PROMISED this split would be scored in this run —
        skipping it quietly would publish a main score against a broken
        promise."""
        with pytest.raises(SandboxError, match="not on this node"):
            sr.resolve_holdout_corpus(
                {"holdout_set_id": HOLDOUT_SET,
                 "holdout_corpus": str(tmp_path / "gone.json")}, tmp_path)

    def test_a_plaintext_holdout_is_used_as_is_and_never_wiped(
            self, tmp_path, holdout_corpus):
        path, is_scratch = sr.resolve_holdout_corpus(
            {"holdout_set_id": HOLDOUT_SET,
             "holdout_corpus": str(holdout_corpus)}, tmp_path)
        assert path == holdout_corpus and is_scratch is False

    def test_a_threshold_custody_holdout_only_opens_in_the_ceremony(
            self, tmp_path):
        sealed = tmp_path / "holdout.sealed.json"
        sealed.write_text(json.dumps({
            "champollionSealed": True, "cardId": HOLDOUT_SET,
            "envelope": {"ciphertextB64": "x"}}), encoding="utf-8")
        assert sr.is_sealed_artifact_file(sealed) is True
        with pytest.raises(SandboxError, match="one quorum, both splits"):
            sr.resolve_holdout_corpus(
                {"holdout_set_id": HOLDOUT_SET, "custody": "threshold-quorum",
                 "holdout_corpus": str(sealed)}, tmp_path)

    def test_grant_detail_names_the_splits_and_the_suites(self):
        assert sr.grant_sets_detail({}) == {"sets": ["main"],
                                            "test_suites": []}
        assert sr.grant_sets_detail({
            "holdout_set_id": HOLDOUT_SET,
            "test_suites": [{"suite_id": SUITE_ID}],
        }) == {"sets": ["main", "holdout"], "test_suites": [SUITE_ID]}


class TestRunMethodRequestCoversEveryDeclaredSet:
    def _serve(self, world, tmp_path, holdout_corpus, suite_corpus):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = world["cfg"]["contests"][CONTEST_ID]
        ccfg.update(
            secret_artifact=str(artifact), secret_privkey=str(priv),
            holdout_set_id=HOLDOUT_SET,
            holdout_corpus=str(holdout_corpus),
            test_suites=[{"suite_id": SUITE_ID,
                          "corpus_path": str(suite_corpus),
                          "corpus_sha256": sha256_file(suite_corpus)}])
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        world["cn"].approve(rid, actor="custodian@example.test")
        return rid

    def test_one_authorized_run_scores_main_suite_and_holdout(
            self, world, tmp_path, holdout_corpus, suite_corpus):
        rid = self._serve(world, tmp_path, holdout_corpus, suite_corpus)
        rt = FakeRuntime()
        out = sr.run_method_request(rid, runner=rt)
        assert out["status"] == "published", out.get("reason")

        # ONE image per lane execution, and one container per set: the public
        # qualifier re-execution builds its own, the sealed run builds ONE and
        # every extra set reuses it.
        builds = [c for c in rt.calls if c[1] == "build"]
        runs = [c for c in rt.calls if c[1] == "run"]
        assert len(builds) == 2, "the dev-set gate + the sealed run"
        assert len(runs) == 4, "dev + main + suite + holdout"
        for argv in runs:
            assert "--network=none" in argv

        # The suite AGGREGATES ride the main card (contract C4/C6).
        card = world["fake"].tables["run_cards"][0]
        assert card["dataset_id"] == SECRET_SET
        assert card["run_card"]["by_test_suite"][SUITE_ID]["n"] == 2
        assert out["by_test_suite"][SUITE_ID]["chrf_plus_plus"] > 90

        # ONE grant, and the audit says which splits it covered (D1).
        used = [e for e in world["fake"].tables["authorization_audit_log"]
                if e["event_type"] == "grant_used"]
        assert len(used) == 1
        assert used[0]["detail"] == {
            "node": NODE_ID,
            "sets": ["main", "holdout"],
            "test_suites": [SUITE_ID],
        }

    def test_the_holdout_is_a_second_card_always_withheld_until_close(
            self, world, tmp_path, holdout_corpus, suite_corpus):
        rid = self._serve(world, tmp_path, holdout_corpus, suite_corpus)
        out = sr.run_method_request(rid, runner=FakeRuntime())
        # The contest is results_visibility=immediate, and the MAIN card
        # published — the holdout is withheld anyway.
        assert out["status"] == "published"
        assert out["holdout"]["outcome"] == "deferred"
        assert len(world["fake"].tables["run_cards"]) == 1

        held = world["fake"].tables["contest_deferred_results"]
        assert len(held) == 1
        row = held[0]
        assert row["role"] == "holdout"
        assert row["sealed_set_id"] == HOLDOUT_SET
        assert row["published_run_card_id"] is None
        # Parked under a DERIVED key so a withheld main result for the same
        # request could never be overwritten by the holdout…
        assert row["request_id"] == sr.holdout_defer_key(rid)
        # URL-safe by contract: the key travels as a PostgREST filter value.
        assert "#" not in row["request_id"]
        # …while the REAL request id is what contest_submissions will record
        # (that column has a foreign key; the derived string must not reach it).
        sidecar = row["run_card_row"]["_contest_submission"]
        assert sidecar["fields"]["authorization_request_id"] == rid
        # A second RESULT of one entry, never a second primary ENTRY (074's
        # idx_cs_one_primary allows one primary per team per contest).
        assert sidecar["fields"]["is_primary"] is False
        assert row["run_card_row"]["dataset_id"] == HOLDOUT_SET
        assert "HOLDOUT SPLIT" in row["run_card_row"]["affirmation"]

    def test_a_broken_holdout_fails_the_request_and_publishes_nothing(
            self, world, tmp_path, suite_corpus):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = world["cfg"]["contests"][CONTEST_ID]
        ccfg.update(secret_artifact=str(artifact), secret_privkey=str(priv),
                    holdout_set_id=HOLDOUT_SET,
                    holdout_corpus=str(tmp_path / "never-written.json"))
        rid = world["propose"](world["bundle"]["method_sha"],
                              upload=world["bundle"]["tarball"].read_bytes())
        world["cn"].approve(rid, actor="custodian@example.test")
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "failed"
        assert "not on this node" in out["reason"]
        assert world["fake"].tables["run_cards"] == []
        assert world["fake"].tables["contest_deferred_results"] == []
