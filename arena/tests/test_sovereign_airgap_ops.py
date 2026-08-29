"""airgap_ops — egress self-check (fail-closed), bundle + drive manifests."""

from __future__ import annotations

import json
import socket
import subprocess

import pytest

from mt_eval_harness.sovereign.airgap_ops import (
    BUNDLE_MANIFEST,
    DRIVE_MANIFEST,
    EgressError,
    assert_airgapped,
    build_offline_bundle,
    egress_check,
    verify_bundle,
    verify_drive_manifest,
    write_drive_manifest,
)


# ---------------------------------------------------------------------------
# Egress check with injected probes — no real network in tests.
# ---------------------------------------------------------------------------

def _run_cmd_route(present: bool):
    def fake_run(argv, **kw):
        out = ("default via 10.0.0.1 dev eth0\n" if present else "")
        rc = 0 if present else 1
        if argv[0] == "route":  # darwin form
            out = "gateway: 10.0.0.1\n" if present else ""
        return subprocess.CompletedProcess(argv, rc, out, "")
    return fake_run


def _connector(success: bool):
    class _Sock:
        def close(self):
            pass
    def fake_connect(addr, timeout):
        if success:
            return _Sock()
        raise OSError("unreachable")
    return fake_connect


def _resolver(success: bool):
    def fake_resolve(host, port):
        if success:
            return [(socket.AF_INET, None, None, "", ("93.184.216.34", port))]
        raise OSError("no DNS")
    return fake_resolve


class TestEgressCheck:
    def test_dark_machine_is_airgapped(self):
        report = egress_check(run_cmd=_run_cmd_route(False),
                              connector=_connector(False),
                              resolver=_resolver(False))
        assert report["airgapped"] is True
        assert_airgapped(report)          # does not raise

    def test_any_connected_probe_fails_closed(self):
        report = egress_check(run_cmd=_run_cmd_route(False),
                              connector=_connector(True),
                              resolver=_resolver(False))
        assert report["airgapped"] is False
        with pytest.raises(EgressError, match="SUCCEEDED"):
            assert_airgapped(report)

    def test_default_route_fails_closed(self):
        report = egress_check(run_cmd=_run_cmd_route(True),
                              connector=_connector(False),
                              resolver=_resolver(False))
        assert report["airgapped"] is False
        with pytest.raises(EgressError, match="default route"):
            assert_airgapped(report)

    def test_dns_resolution_fails_closed(self):
        report = egress_check(run_cmd=_run_cmd_route(False),
                              connector=_connector(False),
                              resolver=_resolver(True))
        with pytest.raises(EgressError, match="DNS"):
            assert_airgapped(report)

    def test_undeterminable_route_fails_closed(self):
        def broken_run(argv, **kw):
            raise OSError("no such tool")
        report = egress_check(run_cmd=broken_run,
                              connector=_connector(False),
                              resolver=_resolver(False))
        assert report["default_route"] is None
        assert report["airgapped"] is False
        with pytest.raises(EgressError, match="fail-closed"):
            assert_airgapped(report)

    def test_report_carries_the_honest_note(self):
        report = egress_check(run_cmd=_run_cmd_route(False),
                              connector=_connector(False),
                              resolver=_resolver(False))
        assert "Point-in-time" in report["honest_note"]


# ---------------------------------------------------------------------------
# Offline bundle (manifest layer; pip is exercised via skip_pip=False only
# in real ops — the hash/verify contract is what tests pin down).
# ---------------------------------------------------------------------------

@pytest.fixture
def bundle_dir(tmp_path):
    d = tmp_path / "bundle"
    (d / "wheels").mkdir(parents=True)
    (d / "wheels" / "mt_eval-0.1.0-py3-none-any.whl").write_bytes(
        b"PK-synthetic-wheel-bytes")
    (d / "wheels" / "cryptography-49.0.0-cp314.whl").write_bytes(
        b"PK-synthetic-wheel-2")
    return d


class TestBundle:
    def test_build_and_verify(self, bundle_dir):
        manifest = build_offline_bundle(bundle_dir, skip_pip=True)
        assert (bundle_dir / BUNDLE_MANIFEST).is_file()
        assert (bundle_dir / "INSTALL.md").is_file()
        assert "wheels/mt_eval-0.1.0-py3-none-any.whl" in manifest["files"]
        assert "INSTALL.md" in manifest["files"]
        report = verify_bundle(bundle_dir)
        assert report["ok"] is True and report["counted"] == 3

    def test_include_artifacts(self, bundle_dir, tmp_path):
        extra = tmp_path / "model.bin"
        extra.write_bytes(b"synthetic-model-weights")
        build_offline_bundle(bundle_dir, skip_pip=True,
                             include=(str(extra),))
        report = verify_bundle(bundle_dir)
        assert report["ok"]
        manifest = json.loads((bundle_dir / BUNDLE_MANIFEST).read_text())
        assert "artifacts/model.bin" in manifest["files"]

    def test_missing_include_refused(self, bundle_dir, tmp_path):
        with pytest.raises(RuntimeError, match="not found"):
            build_offline_bundle(bundle_dir, skip_pip=True,
                                 include=(str(tmp_path / "ghost.bin"),))

    def test_tampered_wheel_fails_verification(self, bundle_dir):
        build_offline_bundle(bundle_dir, skip_pip=True)
        target = bundle_dir / "wheels" / "mt_eval-0.1.0-py3-none-any.whl"
        target.write_bytes(b"PK-DIFFERENT-bytes")
        report = verify_bundle(bundle_dir)
        assert report["ok"] is False
        assert "wheels/mt_eval-0.1.0-py3-none-any.whl" in report["changed"]

    def test_smuggled_file_is_flagged(self, bundle_dir):
        build_offline_bundle(bundle_dir, skip_pip=True)
        (bundle_dir / "wheels" / "extra-surprise.whl").write_bytes(b"??")
        report = verify_bundle(bundle_dir)
        assert report["ok"] is False
        assert "wheels/extra-surprise.whl" in report["added"]

    def test_no_manifest_refused(self, tmp_path):
        with pytest.raises(RuntimeError, match="not a bundle"):
            verify_bundle(tmp_path)

    def test_pip_failure_is_loud(self, bundle_dir):
        def failing_pip(cmd, **kw):
            return subprocess.CompletedProcess(cmd, 1, "", "resolution hell")
        with pytest.raises(RuntimeError, match="pip wheel failed"):
            build_offline_bundle(bundle_dir, runner=failing_pip)

    def test_crypto_closure_is_hash_pinned(self, bundle_dir):
        """F4: the cryptography closure is fetched in a SEPARATE pip call with
        --require-hashes against the committed constraints file."""
        calls = []

        def capturing_pip(cmd, **kw):
            calls.append(cmd)
            return subprocess.CompletedProcess(cmd, 0, "", "")

        build_offline_bundle(bundle_dir, runner=capturing_pip)
        # Two pip calls: base wheel, then the hash-pinned crypto closure.
        assert len(calls) == 2
        base, crypto = calls
        assert "--require-hashes" not in base
        assert "--require-hashes" in crypto
        assert "--only-binary=:all:" in crypto
        i = crypto.index("-r")
        assert crypto[i + 1].endswith("constraints-node.txt")

    def test_missing_constraints_refused(self, bundle_dir, tmp_path):
        """A named-but-absent constraints file fails loud (never a silent
        unpinned build)."""
        def ok_pip(cmd, **kw):
            return subprocess.CompletedProcess(cmd, 0, "", "")
        with pytest.raises(RuntimeError, match="constraints file not found"):
            build_offline_bundle(bundle_dir, runner=ok_pip,
                                  constraints=str(tmp_path / "nope.txt"))

    def test_explicit_unpinned_optout(self, bundle_dir):
        """constraints='' is the explicit unpinned escape hatch — no
        --require-hashes, but it is the caller's stated choice."""
        calls = []

        def capturing_pip(cmd, **kw):
            calls.append(cmd)
            return subprocess.CompletedProcess(cmd, 0, "", "")

        build_offline_bundle(bundle_dir, runner=capturing_pip, constraints="")
        assert all("--require-hashes" not in c for c in calls)

    def test_crypto_hash_mismatch_is_loud(self, bundle_dir):
        """A hash mismatch in the crypto closure call is fail-closed."""
        def pip(cmd, **kw):
            rc = 1 if "--require-hashes" in cmd else 0
            err = "THESE PACKAGES DO NOT MATCH THE HASHES" if rc else ""
            return subprocess.CompletedProcess(cmd, rc, "", err)
        with pytest.raises(RuntimeError, match="hash-pinned"):
            build_offline_bundle(bundle_dir, runner=pip)


# ---------------------------------------------------------------------------
# Drive manifests (transfer discipline).
# ---------------------------------------------------------------------------

@pytest.fixture
def drive(tmp_path):
    d = tmp_path / "usb-in"
    (d / "requests" / "authreq-1").mkdir(parents=True)
    (d / "requests" / "authreq-1" / "method.tar.gz").write_bytes(b"tar-bytes")
    (d / "requests" / "authreq-1" / "request.json").write_text("{}")
    return d


class TestDriveManifests:
    def test_write_and_verify(self, drive):
        manifest = write_drive_manifest(drive, direction="in",
                                        node_id="org-node-1",
                                        note="contest week 1")
        assert manifest["direction"] == "IN"
        assert manifest["totalFiles"] == 2
        report = verify_drive_manifest(drive)
        assert report["ok"] is True
        assert report["direction"] == "IN"

    def test_bad_direction_refused(self, drive):
        with pytest.raises(ValueError, match="IN or OUT"):
            write_drive_manifest(drive, direction="sideways",
                                 node_id="org-node-1")

    def test_changed_and_added_files_detected(self, drive):
        write_drive_manifest(drive, direction="in", node_id="org-node-1")
        (drive / "requests" / "authreq-1" / "method.tar.gz").write_bytes(
            b"DIFFERENT-tar-bytes")
        (drive / "autorun.inf").write_text("malware :)")
        report = verify_drive_manifest(drive)
        assert report["ok"] is False
        assert "requests/authreq-1/method.tar.gz" in report["changed"]
        assert "autorun.inf" in report["added"]

    def test_missing_file_detected(self, drive):
        write_drive_manifest(drive, direction="in", node_id="org-node-1")
        (drive / "requests" / "authreq-1" / "request.json").unlink()
        report = verify_drive_manifest(drive)
        assert report["ok"] is False
        assert "requests/authreq-1/request.json" in report["missing"]

    def test_manifestless_drive_refused(self, tmp_path):
        (tmp_path / "d").mkdir()
        with pytest.raises(RuntimeError, match="refuse the drive"):
            verify_drive_manifest(tmp_path / "d")

    def test_manifest_exists(self, drive):
        write_drive_manifest(drive, direction="out", node_id="org-node-1")
        assert (drive / DRIVE_MANIFEST).is_file()
