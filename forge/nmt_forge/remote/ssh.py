"""Reaching the rented machine: a fresh SSH key for every run (made here,
handed to the pod as its public half, deleted when the run ends), and
ssh / scp with every call bounded. The pod's host key is learned on first
contact into a known-hosts file that lives and dies with the run.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from ..errors import BackendError


def _plain(remote: str) -> str:
    """A remote path forge chose itself: letters, digits and /._- only (scp's
    SFTP mode takes paths literally, so nothing may need quoting)."""
    import re

    if not re.fullmatch(r"[A-Za-z0-9/._-]+", remote):
        raise BackendError(f"internal: remote path {remote!r} would need quoting")
    return remote


class EphemeralKey:
    """An ed25519 key pair in a private temporary folder; ``close`` deletes it."""

    def __init__(self):
        if not shutil.which("ssh-keygen") or not shutil.which("ssh") or not shutil.which("scp"):
            raise BackendError("remote training needs ssh, scp and ssh-keygen on this computer (OpenSSH); "
                               "macOS and Linux have them, Windows 10+ has them as an optional feature")
        self.dir = Path(tempfile.mkdtemp(prefix="nmt-forge-ssh-"))
        self.dir.chmod(0o700)
        self.private = self.dir / "id_ed25519"
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "nmt-forge-run", "-f",
                        str(self.private)], check=True, timeout=30, capture_output=True)
        self.public = (self.dir / "id_ed25519.pub").read_text(encoding="utf-8").strip()
        self.known_hosts = self.dir / "known_hosts"

    def close(self) -> None:
        shutil.rmtree(self.dir, ignore_errors=True)


class Transport:
    """ssh/scp to one pod. Every call has a timeout; failures raise
    BackendError with the command's own error text (never a key)."""

    def __init__(self, key: EphemeralKey, host: str, port: int, user: str = "root"):
        self.key, self.host, self.port, self.user = key, host, int(port), user

    def _opts(self) -> list[str]:
        return ["-i", str(self.key.private), "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
                "-o", "StrictHostKeyChecking=accept-new", "-o", f"UserKnownHostsFile={self.key.known_hosts}",
                "-o", "ConnectTimeout=20", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=4"]

    def run(self, command: str, *, timeout: float = 120, check: bool = True) -> subprocess.CompletedProcess:
        cmd = ["ssh", *self._opts(), "-p", str(self.port), f"{self.user}@{self.host}", command]
        try:
            # errors="replace": a log cut mid-character (cut -c on UTF-8) must
            # not turn a failure report into a crash that hides it (2026-10-15)
            r = subprocess.run(cmd, capture_output=True, text=True, errors="replace", timeout=timeout)
        except subprocess.TimeoutExpired as e:
            raise BackendError(f"the rented machine did not answer within {timeout:.0f} s") from e
        if check and r.returncode != 0:
            raise BackendError(f"on the rented machine, a step failed ({r.returncode}): "
                               f"{(r.stderr or r.stdout).strip()[-400:]}")
        return r

    def _scp(self, args: list[str], timeout: float) -> None:
        cmd = ["scp", *self._opts(), "-q", "-r", "-P", str(self.port), *args]
        try:
            # errors="replace": a log cut mid-character (cut -c on UTF-8) must
            # not turn a failure report into a crash that hides it (2026-10-15)
            r = subprocess.run(cmd, capture_output=True, text=True, errors="replace", timeout=timeout)
        except subprocess.TimeoutExpired as e:
            raise BackendError(f"copying to or from the rented machine took over {timeout:.0f} s") from e
        if r.returncode != 0:
            raise BackendError(f"copying to or from the rented machine failed: {r.stderr.strip()[-400:]}")

    def put(self, local: Path, remote: str, *, timeout: float = 1800) -> None:
        self._scp([str(local), f"{self.user}@{self.host}:{_plain(remote)}"], timeout)

    def get(self, remote: str, local: Path, *, timeout: float = 3600) -> None:
        self._scp([f"{self.user}@{self.host}:{_plain(remote)}", str(local)], timeout)
