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

class FakeRuntime:
    def __init__(self, behavior: str = "perfect"):
        self.behavior = behavior
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
            return cp(0, "12345\n")
        if verb in ("rm", "rmi"):
            return cp(0)
        if verb == "run":
            if self.behavior == "timeout":
                raise subprocess.TimeoutExpired(argv, timeout or 0)
            if self.behavior == "exit1":
                return cp(1, "", "the method crashed spectacularly")
            eval_dir = self._mount_source(argv, "/eval")
            out_dir = self._mount_source(argv, "/output")
            sources = (eval_dir / "source.txt").read_text(
                encoding="utf-8").splitlines()
            if self.behavior == "no-output":
                return cp(0)
            lines = [toy_translate(s) for s in sources]
            if self.behavior == "garbage":
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
    fake.tables["contest_intake"].append({
        "intake_id": "intake-t1", "contest_id": CONTEST_ID,
        "submitted_by": PARTICIPANT, "status": "published",
        "run_card_id": "card-t1",
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
    monkeypatch.setattr(cn, "load_node_config", lambda p=None: cfg)

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

    def test_no_t1_standing_denied(self, world):
        world["fake"].tables["contest_intake"].clear()
        rid = world["propose"](world["bundle"]["method_sha"],
                               upload=world["bundle"]["tarball"].read_bytes())
        out = sr.run_method_request(rid, runner=FakeRuntime())
        assert out["status"] == "denied"
        assert "T1" in out["reason"]

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
        out = sr.run_method_request(rid, runner=FakeRuntime("exit1"))
        assert out["status"] == "failed"
        assert world["fake"].request(rid)["state"] == "authorized", \
            "an executed-and-crashed method is not a custodian denial"
        assert not world["fake"].tables["run_cards"]

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
