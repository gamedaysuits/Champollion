"""sandbox_runner — the airgap method-execution sandbox (Phase B, spec Wave 1).

Implements arena/docs/sandbox-evaluation-spec.md in the spec's own order:

  §3  STATIC CHECKS (pure Python, fully offline-testable):
        §3.5 manifest consistency (rule SSOT: method_bundle.py — the
             participant CLI runs the identical check pre-upload),
        §3.1 network-call scan, §3.2 filesystem-access audit,
        §3.4 size limits. Any BLOCK finding stops everything downstream.
  §6  CONTAINER ISOLATION: the container is built AND run with
        --network=none (the §3.3 air-gap build test is the build itself),
        read-only root, all capabilities dropped, no-new-privileges,
        pids/memory/cpu limits, /tmp as size-capped tmpfs, environment
        reduced to PATH/HOME/TMPDIR (§6.3). Argv construction is pure and
        unit-tested; execution shells out to docker/podman.
  §7  EXECUTION CONTRACT: source sentences (the input side ONLY) are written
        to /eval/source.txt (read-only mount); the method reads them on stdin
        (`cat /eval/source.txt | <entrypoint> > /output/translations.txt`);
        references NEVER enter the container — they stay with the harness
        process for scoring (external_scoring.score_hypotheses, the same
        single scorer as every other lane). Non-zero exit = no score.
  §8  TEARDOWN: container force-removed, image removed, the decrypted corpus
        and every scratch file overwritten-then-deleted (wipe_tree).
  §9  SCORES-ONLY EGRESS: publishing goes through the EXISTING Phase-A path —
        contest_node.publish_scored_run (aggregates-only by construction,
        trust='verified') after the EXISTING auth_grants claim
        (contest_node.mint_and_claim_grant). Nothing is forked.

Honest deferrals (labeled, not faked — plan Phase B):
  * TSS/FROST threshold custody + key ceremonies: Wave 2. Sealing stays the
    single-keypair-wave1 scheme; approval stays `mt-eval node approve`.
  * Hardware attestation: none. node_measurement is the organizer-advertised,
    self-reported node id; the fingerprint binds to it and mismatches fail
    closed, but nothing PROVES the machine (spec §6.1 "measurement" is
    aspirational until Wave 2).
  * Custom seccomp profile / Firecracker / syscall audit logging (§6.1):
    deferred. The load-bearing guarantee is --network=none (the spec's own
    minimum: no network namespace exists). Do not claim seccomp depth.
  * Host-level interface-down and swapoff (§10.2, §11): operator steps —
    documented in docs/ORGANIZER_NODE_RUNBOOK.md, not automated here. The
    true-airgap posture is the B3 file transport (airgap_transport.py) where
    the scoring machine simply has no network at all.
  * Hosted serverEndpoint + the dispute process (§9.4): not built.

Everything that can run without a container runtime does; anything that
needs docker/podman fails LOUD when none is present (never a silent skip).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

from mt_eval_harness import contest_declarations
from mt_eval_harness.execution_facts import (
    DiagnosticsColumnMissing,
    SandboxError,
    execution_from_facts,
    failure_diagnostics,
    output_line_counts,
    record_execution_diagnostics,
    scored_diagnostics,
)
from mt_eval_harness.method_bundle import (
    TARBALL_LIMIT_BYTES,
    manifest_consistency_findings,
)
from mt_eval_harness.qualifier_gate import (
    is_eligible_for_sealed_run,
    receipt_gap,
)

# ---------------------------------------------------------------------------
# Spec §3.4 / §6.2 limits and defaults — data at the top, not scattered.
# ---------------------------------------------------------------------------

IMAGE_LIMIT_BYTES = 150 * 2**30       # §3.4 built image
OUTPUT_LIMIT_BYTES = 1 * 2**30        # §3.4 /output writes
TMP_LIMIT_GB = 50                     # §3.4 /tmp scratch ceiling

DEFAULT_SANDBOX_CFG = {
    "runtime": None,          # autodetect docker → podman
    "gpus": False,            # organizer opts in; manifest gpu:true without it fails loud
    "cpus": 8,                # §6.2 default
    "max_ram_gb": 64,         # §6.2 default ceiling
    "max_tmp_gb": TMP_LIMIT_GB,
    "max_runtime_minutes": 120,
    "pids_limit": 512,
    "build_timeout_seconds": 3600,
}

# §6.3 — the ONLY environment the method container sees.
SANDBOX_ENV = {
    "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "HOME": "/tmp",
    "TMPDIR": "/tmp",
}


# SandboxError lives in execution_facts.py (imported above) so the diagnostics
# it carries and the class that carries them are declared together, and so
# model_runner/airgap_transport can share it without importing this module.
# `from mt_eval_harness.sandbox_runner import SandboxError` still works — it is
# the same class object, re-exported here.
__all_reexports__ = ("SandboxError",)


# ---------------------------------------------------------------------------
# §3.1 + §3.2 — static source scans.
# ---------------------------------------------------------------------------

_TEXT_EXTENSIONS = {
    ".py", ".pyw", ".sh", ".bash", ".zsh", ".js", ".mjs", ".cjs", ".ts",
    ".rb", ".pl", ".pm", ".lua", ".r", ".jl", ".go", ".rs", ".c", ".h",
    ".cc", ".cpp", ".hpp", ".java", ".scala", ".txt", ".cfg", ".ini",
    ".toml", ".yaml", ".yml",
}
_SCAN_BASENAMES = {"dockerfile", "makefile"}

# The banned-module alternation, shared by every Python-import form below so
# a module can't slip past by moving off the first position of the line.
# HEURISTIC, not a guarantee: static analysis can always be obfuscated
# (getattr chains, byte-assembled names, exec of decoded strings). The
# load-bearing runtime guarantee is --network=none (§6.1) — no network
# namespace exists at all. This scan is the early, cheap, human-legible gate
# the spec §3.1 table advertises, kept honest by covering every ORDINARY way
# to name a network module: first-or-later in a comma list, `from X import`,
# and the common dynamic forms (__import__ / importlib.import_module).
_NET_MODULES = (r"socket|http|urllib|urllib2|urllib3|requests|aiohttp|httpx|"
                r"ftplib|smtplib|telnetlib|xmlrpc|websockets?|paramiko")

# (compiled regex, category, severity, message) — spec §3.1 table.
_NETWORK_PATTERNS = [
    # `from <banned> import ...` (the module is on the `from` side).
    (re.compile(rf"^\s*from\s+({_NET_MODULES})\b", re.M),
     "socket-libraries", "BLOCK",
     "network library import ({match})"),
    # `import a, <banned>, b` — a banned module ANYWHERE in a comma list,
    # including the first position. `[^\n#]*?` stops at a comment so a
    # trailing `# socket` note is not a false positive; `\b…\b` keeps
    # `mysocket`/`socket_helper` from matching.
    (re.compile(rf"^\s*import\s+[^\n#]*?\b({_NET_MODULES})\b", re.M),
     "socket-libraries", "BLOCK",
     "network library import ({match})"),
    # Dynamic imports: __import__("socket") / importlib.import_module("socket")
    # (with an optional dotted submodule, e.g. "urllib.request").
    (re.compile(rf"(?:__import__|import_module)\s*\(\s*['\"]"
                rf"({_NET_MODULES})(?:\.[\w.]+)?['\"]"),
     "socket-libraries", "BLOCK",
     "dynamic network library import ({match})"),
    (re.compile(r"require\(\s*['\"](https?|net|dgram|tls|dns)['\"]\s*\)"),
     "socket-libraries", "BLOCK",
     "node network module require ({match})"),
    (re.compile(r"subprocess[^\n]{0,120}\b(curl|wget|ncat|nc)\b"),
     "subprocess-network", "BLOCK",
     "subprocess network tool ({match})"),
    (re.compile(r"socket\.(getaddrinfo|gethostbyname|create_connection)"),
     "dns-resolution", "BLOCK",
     "DNS/socket resolution call ({match})"),
    (re.compile(r"ctypes[^\n]{0,120}SOCK_"),
     "low-level-network", "BLOCK",
     "ctypes raw-socket constant ({match})"),
    (re.compile(r"\bos\.environ\b"),
     "environment-leaks", "WARN",
     "reads os.environ (env is sanitized to PATH/HOME/TMPDIR — manual review)"),
    (re.compile(r"subprocess\.Popen\([^\n]{0,200}\benv\s*="),
     "environment-leaks", "WARN",
     "subprocess.Popen(env=…) (manual review)"),
]

# Shell files: a bare curl/wget IS a network call.
_SHELL_NETWORK = re.compile(r"(?:^|[;&|`$(\s])(curl|wget|ncat|nc)\s", re.M)
_SHELL_SUFFIXES = {".sh", ".bash", ".zsh"}

# Dockerfile: network at build time fails the --network=none build anyway;
# flag it early. Package managers may legitimately install from VENDORED
# archives, so they warn; transfer tools block.
_DOCKERFILE_BLOCK = re.compile(r"\b(curl|wget|git\s+clone|ncat)\b")
_DOCKERFILE_WARN = re.compile(
    r"\b(pip3?\s+install|apt-get|apt\s+install|conda\s+install|npm\s+install|"
    r"yum\s+install|apk\s+add)\b")

# §3.2 — blocked path prefixes ( /dev/ except null + urandom).
_FS_BLOCK = re.compile(r"/(?:proc|sys|etc)/[\w.-]*"
                       r"|/dev/(?!null\b|urandom\b)[\w.-]+")


def _iter_scannable(root: Path):
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        name = p.name.lower()
        if p.suffix.lower() in _TEXT_EXTENSIONS or name in _SCAN_BASENAMES:
            yield p
            continue
        try:
            head = p.open("rb").read(2)
        except OSError:
            continue
        if head == b"#!":          # extensionless script
            yield p


def _read_text(p: Path) -> Optional[str]:
    try:
        raw = p.open("rb").read()
    except OSError:
        return None
    if b"\0" in raw[:8192]:        # binary (weights, models) — no content scan
        return None
    return raw.decode("utf-8", errors="replace")


def scan_network_calls(bundle_root: str | Path) -> list[dict]:
    """Spec §3.1 — scan every source file for network-access patterns."""
    root = Path(bundle_root)
    findings: list[dict] = []
    for p in _iter_scannable(root):
        text = _read_text(p)
        if text is None:
            continue
        rel = p.relative_to(root).as_posix()
        is_dockerfile = p.name.lower() == "dockerfile"
        for pattern, category, severity, msg in _NETWORK_PATTERNS:
            for m in pattern.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                findings.append({
                    "check": "network-scan", "category": category,
                    "severity": severity, "file": rel, "line": line,
                    "detail": f"{rel}:{line}: "
                              + msg.format(match=m.group(0).strip()[:80]),
                })
        if p.suffix.lower() in _SHELL_SUFFIXES:
            for m in _SHELL_NETWORK.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                findings.append({
                    "check": "network-scan", "category": "subprocess-network",
                    "severity": "BLOCK", "file": rel, "line": line,
                    "detail": f"{rel}:{line}: shell network tool "
                              f"'{m.group(1)}'",
                })
        if is_dockerfile:
            for m in _DOCKERFILE_BLOCK.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                findings.append({
                    "check": "network-scan", "category": "dockerfile-network",
                    "severity": "BLOCK", "file": rel, "line": line,
                    "detail": f"{rel}:{line}: Dockerfile network transfer "
                              f"'{m.group(1)}' — the --network=none build "
                              f"cannot download; vendor everything (§3.3).",
                })
            for m in _DOCKERFILE_WARN.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                findings.append({
                    "check": "network-scan", "category": "dockerfile-network",
                    "severity": "WARN", "file": rel, "line": line,
                    "detail": f"{rel}:{line}: Dockerfile package manager "
                              f"'{m.group(1).strip()}' — must install from "
                              f"VENDORED files; a network fetch will fail the "
                              f"--network=none build (§3.3).",
                })
    return findings


def audit_filesystem_access(bundle_root: str | Path) -> list[dict]:
    """Spec §3.2 — flag access to paths outside the allowed set.

    BLOCK: /proc/, /sys/, /etc/, and /dev/ other than /dev/null +
    /dev/urandom (the spec's exact allowlist). Interpreter shebangs are
    directives, not filesystem access, and are skipped. Other absolute paths
    (outside /method, /eval, /output, /tmp and standard image prefixes like
    /usr, /bin, /lib) would be false-positive-heavy to block on — the
    container's read-only root + mount set enforces them at RUN time, which
    is the stronger guarantee.
    """
    root = Path(bundle_root)
    findings: list[dict] = []
    for p in _iter_scannable(root):
        text = _read_text(p)
        if text is None:
            continue
        rel = p.relative_to(root).as_posix()
        for m in _FS_BLOCK.finditer(text):
            line_start = text.rfind("\n", 0, m.start()) + 1
            if text[line_start:line_start + 2] == "#!":
                continue
            line = text.count("\n", 0, m.start()) + 1
            findings.append({
                "check": "fs-audit", "category": "blocked-path",
                "severity": "BLOCK", "file": rel, "line": line,
                "detail": f"{rel}:{line}: references blocked path "
                          f"'{m.group(0)}' (allowed: /method, "
                          f"/eval/source.txt, /output, /tmp, /dev/null, "
                          f"/dev/urandom — spec §3.2).",
            })
    return findings


def check_size_limits(*, tarball_path: str | Path | None = None,
                      bundle_dir: str | Path | None = None) -> list[dict]:
    """Spec §3.4 — pre-execution size limits (tarball / extracted tree)."""
    findings: list[dict] = []
    if tarball_path is not None:
        size = Path(tarball_path).stat().st_size
        if size > TARBALL_LIMIT_BYTES:
            findings.append({
                "check": "size-limits", "category": "tarball",
                "severity": "BLOCK", "file": str(tarball_path), "line": 0,
                "detail": f"tarball is {size} bytes — over the "
                          f"{TARBALL_LIMIT_BYTES}-byte limit (§3.4).",
            })
    if bundle_dir is not None:
        total = sum(p.stat().st_size for p in Path(bundle_dir).rglob("*")
                    if p.is_file())
        if total > TARBALL_LIMIT_BYTES:
            findings.append({
                "check": "size-limits", "category": "extracted",
                "severity": "BLOCK", "file": str(bundle_dir), "line": 0,
                "detail": f"extracted bundle is {total} bytes — over the "
                          f"{TARBALL_LIMIT_BYTES}-byte limit (§3.4).",
            })
    return findings


def run_static_checks(bundle_dir: str | Path, *,
                      tarball_path: str | Path | None = None,
                      expected_corpus_id: str | None = None,
                      contest_terms_sha: str | None = None,
                      contest_id: str | None = None) -> dict:
    """§3 in spec order: manifest → declarations → network scan → fs audit →
    size limits.

    Returns {findings, blocked, blocks, warns}. The caller decides what a
    BLOCK means (node: deny the request WITH the reasons; CLI: refuse upload).

    ``contest_terms_sha`` is the SHA-256 of the contest's declared
    ``metadata.prize_terms`` (``contest_prize_terms.terms_sha256``). Pass it
    wherever the contest row is in hand — the node does — and a bundle that
    accepted different terms, or none, is BLOCKED. Omitted (air-gapped import,
    local validation) the acceptance is reported as an unchecked WARN, never
    treated as verified.
    """
    bundle_dir = Path(bundle_dir)
    manifest_path = bundle_dir / "manifest.json"
    findings: list[dict] = []
    manifest = None
    if not manifest_path.is_file():
        findings.append({"check": "manifest", "severity": "BLOCK",
                         "category": "manifest", "file": "manifest.json",
                         "line": 0,
                         "detail": "bundle has no manifest.json (§2)."})
    else:
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            findings.append({"check": "manifest", "severity": "BLOCK",
                             "category": "manifest", "file": "manifest.json",
                             "line": 0,
                             "detail": f"manifest.json is not valid JSON: {exc}"})
    if manifest is not None:
        findings.extend(manifest_consistency_findings(
            manifest, bundle_dir=bundle_dir,
            expected_corpus_id=expected_corpus_id))
        findings.extend(contest_declarations.constraints_findings(
            manifest, bundle_dir=bundle_dir))
        findings.extend(contest_declarations.accepted_terms_findings(
            manifest, contest_terms_sha=contest_terms_sha,
            contest_id=contest_id))
    if not (bundle_dir / "Dockerfile").is_file():
        findings.append({"check": "manifest", "severity": "BLOCK",
                         "category": "manifest", "file": "Dockerfile",
                         "line": 0,
                         "detail": "bundle has no Dockerfile (§2/§3.3)."})
    findings.extend(scan_network_calls(bundle_dir))
    findings.extend(audit_filesystem_access(bundle_dir))
    findings.extend(check_size_limits(tarball_path=tarball_path,
                                      bundle_dir=bundle_dir))
    blocks = [f for f in findings if f["severity"] == "BLOCK"]
    warns = [f for f in findings if f["severity"] == "WARN"]
    return {"findings": findings, "blocked": bool(blocks),
            "blocks": blocks, "warns": warns, "manifest": manifest}


# ---------------------------------------------------------------------------
# §6 — container isolation (argv builders are pure; execution shells out).
# ---------------------------------------------------------------------------

def contest_prize_terms_sha_from_row(contest: dict) -> str | None:
    """The SHA-256 of a contest row's declared ``metadata.prize_terms``.

    ``None`` when the contest declares no prize terms (no prize — nothing for
    an entry to accept). Raises ``SandboxError`` when the terms are present but
    unreadable: the node must not execute an entry against terms it cannot
    state, and migration 074 refuses such terms at write time, so a row that
    carries them was written before the guard or edited by hand.
    """
    from mt_eval_harness import contest_prize_terms

    metadata = (contest or {}).get("metadata")
    terms = metadata.get("prize_terms") if isinstance(metadata, dict) else None
    if not terms:
        return None
    try:
        return contest_prize_terms.terms_sha256(terms)
    except contest_prize_terms.PrizeTermsError as exc:
        raise SandboxError(
            f"contest {(contest or {}).get('id')!r} carries unreadable "
            f"metadata.prize_terms: {exc} Nothing is executed against prize "
            f"terms the node cannot state back to the entrant.") from exc


class NodeSetupError(SandboxError):
    """THIS NODE cannot run any method as configured — no container runtime,
    a CPU share the host does not have. The node's problem, so it is RAISED
    to the operator and never recorded against a submission (the request
    stays exactly as it was, runnable once the node is fixed)."""


class ResourceRequestRefused(SandboxError):
    """A bundle declares more resources than this node's sandbox allows.

    Not a qualifier verdict and not a defect in the method: two pieces of
    policy disagree (the entrant's declared requirements, the organizer's
    caps). Raised, never recorded as a rejection, so the request can still run
    if the organizer raises the caps; ``over`` names every mismatch at once
    (an entrant used to learn them one resubmission at a time — synthetic
    researcher persona, Round 3, 2026-10-03)."""

    def __init__(self, *args, over: list[dict] | None = None, **kw) -> None:
        super().__init__(*args, **kw)
        self.over: list[dict] = list(over or [])

    @property
    def flags(self) -> str:
        """The submit-method flags that would fit this node, e.g.
        ``--ram-gb 4 --disk-gb 4``."""
        return " ".join(o["fix_flag"] for o in self.over if o.get("fix_flag"))

    @property
    def node_keys(self) -> str:
        return ", ".join(f"{o['node_key']} (to at least {o['needed']})"
                         for o in self.over)


def _num(value) -> str:
    """8.0 -> '8', 0.5 -> '0.5' — numbers as a person writes them."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return str(value)
    return str(int(f)) if f.is_integer() else str(f)


def find_container_runtime(preferred: str | None = None) -> str:
    """docker → podman, or the configured runtime. Fails loud (§6.1) with
    one line naming what is needed."""
    if preferred:
        if shutil.which(preferred):
            return preferred
        raise NodeSetupError(
            f"No container runtime: node.json sets sandbox.runtime to "
            f"{preferred!r}, but `{preferred}` is not on PATH. The method "
            f"lane needs docker or podman (every entry runs in a "
            f"--network=none container; there is no fallback) — install one, "
            f"or set sandbox.runtime to the one this machine has (null tries "
            f"docker, then podman).")
    for c in ("docker", "podman"):
        if shutil.which(c):
            return c
    raise NodeSetupError(
        "No container runtime: neither docker nor podman is on PATH. The "
        "method lane needs one of them (every entry runs in a --network=none "
        "container; there is no fallback) — install docker or podman.")


def resolve_container_runtime(sandbox_cfg: dict | None = None, *,
                              runner: "Runner" = subprocess.run) -> str:
    """The runtime this node will invoke — the configured one if it is on
    PATH, else docker, then podman — or a :class:`NodeSetupError`.

    An injected ``runner`` (tests, an operator's wrapper) owns the name it is
    given: there is no executable to look up on PATH, so a configured runtime
    passes through unchecked."""
    configured = (sandbox_cfg or {}).get("runtime")
    if configured and runner is not subprocess.run:
        return configured
    return find_container_runtime(configured)


def enforce_resource_caps(requirements: dict, sandbox_cfg: dict) -> dict:
    """Check manifest §2.1 requirements against the node's §6.2 caps.

    A request EXCEEDING a cap is refused — never clamped (the organizer's
    machine is the limit; silently clamping would run the method under
    conditions its developer said are insufficient). Every exceeded cap is
    named in ONE :class:`ResourceRequestRefused`, with the node.json key that
    sets it and the submit-method flag that would fit it."""
    from mt_eval_harness.contest_declarations import DEFAULT_REQUIREMENTS

    cfg = {**DEFAULT_SANDBOX_CFG, **(sandbox_cfg or {})}
    ram = float(requirements.get("ramGB") or DEFAULT_REQUIREMENTS["ramGB"])
    tmp = float(requirements.get("diskGB") or DEFAULT_REQUIREMENTS["diskGB"])
    minutes = float(requirements.get("maxRuntimeMinutes")
                    or DEFAULT_REQUIREMENTS["maxRuntimeMinutes"])
    gpu = bool(requirements.get("gpu"))
    over: list[dict] = []
    for what, unit, requested, key, flag in (
            ("RAM", "GB", ram, "max_ram_gb", "--ram-gb"),
            ("scratch disk", "GB", tmp, "max_tmp_gb", "--disk-gb"),
            ("wall-clock runtime", "min", minutes, "max_runtime_minutes",
             "--max-runtime-minutes")):
        allowed = cfg[key]
        if requested > float(allowed):
            over.append({
                "what": what, "requested": requested, "allowed": allowed,
                "node_key": f"sandbox.{key}", "needed": _num(requested),
                "fix_flag": f"{flag} {_num(allowed)}",
                "text": (f"{_num(requested)} {unit} {what} requested, this "
                         f"node allows {_num(allowed)} {unit} "
                         f"(sandbox.{key})")})
    if gpu and not cfg.get("gpus"):
        over.append({
            "what": "GPU", "requested": True, "allowed": False,
            "node_key": "sandbox.gpus", "needed": "true",
            "fix_flag": None,
            "text": ("a GPU requested, this node has none configured "
                     "(sandbox.gpus) — a CPU-only method repackages without "
                     "--gpu")})
    if over:
        raise ResourceRequestRefused(
            "This entry asks for more than this node allows: "
            + "; ".join(o["text"] for o in over)
            + ". That is a resource mismatch, not a qualifier result — "
              "nothing was run.", over=over)
    # The CPU share is a NODE fact, not a manifest request: docker refuses
    # `--cpus N` above the host's core count, so a node.json that asks for
    # more than the machine has (the §6.2 default is 8 — a 4-vCPU guest has
    # 4) must fail HERE, loudly, before any image is built. Never clamp
    # silently — the organizer decides the share, not this code.
    host_cpus = os.cpu_count()
    try:
        cpus = float(cfg["cpus"])
    except (TypeError, ValueError):
        raise NodeSetupError(
            f"sandbox.cpus in node.json must be a number (got "
            f"{cfg['cpus']!r}).") from None
    if cpus <= 0:
        raise NodeSetupError(
            f"sandbox.cpus in node.json must be positive (got {cpus}).")
    if host_cpus is not None and cpus > host_cpus:
        raise NodeSetupError(
            f"sandbox.cpus in node.json is {cfg['cpus']} but this host has "
            f"{host_cpus} CPU(s) — the container runtime refuses "
            f"`--cpus {cfg['cpus']}` on this machine. Set sandbox.cpus to "
            f"at most {host_cpus} (the §6.2 default of "
            f"{DEFAULT_SANDBOX_CFG['cpus']} assumes a larger node); "
            f"refusing rather than silently clamping the share.")
    return {"ram_gb": ram, "tmp_gb": tmp, "minutes": minutes, "gpu": gpu,
            "cpus": cfg["cpus"], "pids_limit": cfg["pids_limit"],
            "build_timeout": cfg["build_timeout_seconds"]}


def preflight_node_fit(manifest: dict | None, sandbox_cfg: dict | None, *,
                       runner: "Runner" = subprocess.run) -> dict:
    """Can THIS node run THIS runnable bundle at all? (Lane B.)

    Checked before the public gate re-executes anything, so a node with no
    container runtime, or a bundle that asks for more than the node allows,
    is never mistaken for a method that failed the qualifier — and never
    turns into a rejection the entrant has to resubmit around. Raises
    :class:`NodeSetupError` (the node's problem) or
    :class:`ResourceRequestRefused` (a policy mismatch); returns
    ``{"runtime", "caps"}`` when the node can run it."""
    cfg = {**DEFAULT_SANDBOX_CFG, **(sandbox_cfg or {})}
    runtime = resolve_container_runtime(cfg, runner=runner)
    caps = enforce_resource_caps((manifest or {}).get("requirements") or {},
                                 cfg)
    return {"runtime": runtime, "caps": caps}


def resource_refusal_next_steps(exc: ResourceRequestRefused, *,
                                request_id: str, offline: bool,
                                request_state: str | None = None) -> str:
    """What each side can do about a :class:`ResourceRequestRefused` — the
    exact commands, and the fact that the request was left as it was."""
    rerun = (f"mt-eval node run-method {request_id}"
             + (" --offline" if offline else ""))
    flags = exc.flags
    repack = (f"repackages with {flags}" if flags
              else "repackages without --gpu")
    if offline:
        resubmit = (f"`mt-eval contest submit-method … {flags} --offline "
                    f"--bundle-out <dir>`, then `mt-eval node import-bundle "
                    f"<dir>` on this node").replace("  ", " ")
        state = f"{request_id} stays imported"
    else:
        resubmit = f"`mt-eval contest submit-method … {flags}`".replace(
            "  ", " ")
        if (request_state or "pending") == "pending":
            # Only a pending request can be denied; the denial reason is what
            # the entrant reads in `contest method-status`.
            resubmit += (f"; record why on this request with `mt-eval node "
                         f"deny {request_id} --actor <you> --reason \"…\"` so "
                         f"the entrant is told")
        state = f"{request_id} stays {request_state or 'pending'}"
    return (f"Nothing was rejected: {state}. Either (1) the organizer raises "
            f"{exc.node_keys} in node.json and re-runs `{rerun}` — no "
            f"resubmission needed; or (2) the entrant {repack} (only if the "
            f"method really fits) and resubmits — the declared requirements "
            f"are inside the bundle's hash, so that is a new request: "
            f"{resubmit}.")


def entrypoint_command(entrypoint: str) -> str:
    """The in-container command for a §2.2 entrypoint (bundle 'method/…' is
    mounted at /method)."""
    inside = "/" + entrypoint  # method/translate.py -> /method/translate.py
    if entrypoint.endswith(".py"):
        return f"python3 {inside}"
    if entrypoint.endswith(".sh"):
        return f"sh {inside}"
    return inside


def build_image_argv(runtime: str, tag: str, bundle_dir: str | Path) -> list[str]:
    """§3.3 — the air-gap build test IS the build."""
    return [runtime, "build", "--network=none", "-t", tag, str(bundle_dir)]


def make_output_mount(path: str | Path) -> Path:
    """Create the per-run directory bound at ``/output``, writable by the
    container.

    The container runs with ``--cap-drop ALL``, so even a root process inside
    it has no CAP_DAC_OVERRIDE: it can only write where the DIRECTORY's own
    mode lets it. A node whose scratch tree is the ordinary 0755 of a normal
    user account therefore made every Lane B run fail at
    ``cannot create /output/translations.txt: Permission denied`` — an
    isolation flag silently defeating the one write the contract requires.
    (Found running `arena/scripts/contest_beta.py` on the Lima organizer guest,
    2026-09-07; it does not show up on a node that happens to run as root.)

    This is a throwaway per-run directory the node just created for exactly
    this write, so it is made world-writable. Widening it is not a weakening of
    the sandbox: the container has no network, no capabilities, and a
    read-only root, and this directory is the only thing it is supposed to be
    able to write. The alternative — running the container as the host uid —
    would change the isolation posture and break images that expect root.
    """
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    os.chmod(path, 0o777)
    return path


def run_container_argv(runtime: str, tag: str, *, container_name: str,
                       eval_dir: str | Path, method_dir: str | Path,
                       output_dir: str | Path, entrypoint: str,
                       caps: dict) -> list[str]:
    """§6.1/§6.3/§7 — the isolation flags, fully explicit and unit-testable."""
    argv = [
        runtime, "run", "--rm",
        "--name", container_name,
        "--network=none",                      # §1/§6.1 — THE guarantee
        "--read-only",                          # §6.1 read-only root
        "--cap-drop", "ALL",                    # §6.1 capabilities dropped
        "--security-opt", "no-new-privileges",
        "--pids-limit", str(int(caps["pids_limit"])),
        "--memory", f"{int(caps['ram_gb'])}g",
        "--cpus", str(caps["cpus"]),
        "--mount",
        f"type=bind,source={method_dir},destination=/method,readonly",
        "--mount",
        f"type=bind,source={eval_dir},destination=/eval,readonly",
        "--mount",
        f"type=bind,source={output_dir},destination=/output",
        "--mount",
        f"type=tmpfs,destination=/tmp,tmpfs-size={int(caps['tmp_gb'])}g",
    ]
    if caps.get("gpu"):
        argv += ["--gpus", "all"]
    for key, value in SANDBOX_ENV.items():      # §6.3 — the whole environment
        argv += ["-e", f"{key}={value}"]
    argv += [
        tag, "/bin/sh", "-c",
        # §2.2/§7: stdin from the source file, stdout to the output mount.
        f"cat /eval/source.txt | {entrypoint_command(entrypoint)} "
        f"> /output/translations.txt",
    ]
    return argv


# ---------------------------------------------------------------------------
# §7 — execution.
# ---------------------------------------------------------------------------

Runner = Callable[..., "subprocess.CompletedProcess"]


def write_source_file(corpus_path: str | Path, eval_dir: Path) -> int:
    """Extract the SOURCE side (only) into /eval/source.txt, in the exact
    corpus order external_scoring will align translations against (§7 step 3).
    References never touch this directory."""
    from mt_eval_harness.config import RunConfig
    from mt_eval_harness.corpus_loader import load_corpus
    cfg = RunConfig(corpus_path=str(corpus_path))
    entries, _meta = load_corpus(cfg)
    if not entries:
        raise SandboxError(f"secret corpus has no entries: {corpus_path}")
    sources = [str(e.get(cfg.source_field, "")).replace("\n", " ")
               for e in entries]
    eval_dir.mkdir(parents=True, exist_ok=True)
    (eval_dir / "source.txt").write_text("\n".join(sources) + "\n",
                                         encoding="utf-8")
    return len(sources)


def execute_method(*, bundle_dir: str | Path, corpus_path: str | Path,
                   work_dir: str | Path, manifest: dict,
                   sandbox_cfg: dict | None = None,
                   runner: Runner = subprocess.run) -> dict:
    """Build + run the method container per §7; return execution facts.

    ``runner`` is injectable so the contract is testable without docker; the
    real path uses subprocess.run against the detected runtime. Raises
    SandboxError (no score) on build failure, timeout, non-zero exit, missing
    or oversized output — every §8 failure mode, loudly, each carrying its
    counts-only ``diagnostics`` (execution_facts.STAGES).

    The returned facts are what the run card will report (contract C4):
    the wall total plus the build/run split, the runtime and the IMAGE DIGEST
    that identifies the built image, and the node's OWN resource caps — the
    conditions the method actually ran under. ``runtime_seconds`` is the wall
    total (build + probes + run), never just the run.
    """
    bundle_dir = Path(bundle_dir)
    work_dir = Path(work_dir)
    sandbox_cfg = {**DEFAULT_SANDBOX_CFG, **(sandbox_cfg or {})}
    # The runtime first: a node with no container runtime can run nothing, and
    # says so in one line before anything is staged or printed.
    runtime = resolve_container_runtime(sandbox_cfg, runner=runner)
    caps = enforce_resource_caps(manifest.get("requirements") or {},
                                 sandbox_cfg)
    entrypoint = manifest["method"]["entrypoint"]

    # Stage 'run': the run could not be STARTED. A corpus that will not stage
    # is not a method failure, but it is still a run that produced no score,
    # and the participant is owed the stage.
    try:
        n_sources = write_source_file(corpus_path, work_dir / "eval")
    except SandboxError as e:
        if getattr(e, "diagnostics", None) is None:
            e.diagnostics = failure_diagnostics("run")
        raise
    output_dir = make_output_mount(work_dir / "output")

    method_sha12 = hashlib.sha256(
        json.dumps(manifest, sort_keys=True).encode()).hexdigest()[:12]
    tag = f"mteval-method-{method_sha12}"
    container_name = f"mteval-run-{uuid.uuid4().hex[:12]}"

    started = time.monotonic()
    try:
        build = runner(build_image_argv(runtime, tag, bundle_dir),
                       capture_output=True, text=True,
                       timeout=caps["build_timeout"])
    except FileNotFoundError as exc:
        # The runtime was on PATH a moment ago (or an operator's runner could
        # not exec it) — still the node's problem, still one line.
        raise NodeSetupError(
            f"No container runtime: `{runtime}` could not be executed "
            f"({exc.strerror or exc}). The method lane needs docker or "
            f"podman — install one, or set sandbox.runtime in node.json to "
            f"the one this machine has.") from exc
    build_seconds = round(time.monotonic() - started, 3)
    if build.returncode != 0:
        raise SandboxError(
            f"--network=none image build failed (§3.3 — dependencies must be "
            f"vendored):\n{(build.stderr or build.stdout or '')[-2000:]}",
            diagnostics=failure_diagnostics(
                "build", exit_code=build.returncode,
                runtime_seconds=build_seconds, n_sources=n_sources,
                stderr_bytes=len((build.stderr or "").encode("utf-8"))))

    # §3.4 built-image size (when the runtime can report it).
    size_probe = runner([runtime, "image", "inspect", tag,
                         "--format", "{{.Size}}"],
                        capture_output=True, text=True, timeout=60)
    if size_probe.returncode == 0:
        try:
            image_bytes = int(size_probe.stdout.strip())
            if image_bytes > IMAGE_LIMIT_BYTES:
                raise SandboxError(
                    f"built image is {image_bytes} bytes — over the "
                    f"{IMAGE_LIMIT_BYTES}-byte limit (§3.4).",
                    diagnostics=failure_diagnostics(
                        "image-size",
                        runtime_seconds=round(time.monotonic() - started, 3),
                        n_sources=n_sources))
        except ValueError:
            pass  # runtime formats differ; the limit check is best-available

    # The image DIGEST is the only stable identity of what actually ran (the
    # tag is derived from the manifest and is reused across rebuilds). When
    # the runtime cannot report one we say so — never a synthesised digest.
    image_digest, image_digest_note = _probe_image_digest(runtime, tag, runner)

    argv = run_container_argv(
        runtime, tag, container_name=container_name,
        eval_dir=work_dir / "eval", method_dir=bundle_dir / "method",
        output_dir=output_dir, entrypoint=entrypoint, caps=caps)
    run_started = time.monotonic()
    try:
        proc = runner(argv, capture_output=True, text=True,
                      timeout=caps["minutes"] * 60 + 60)
    except subprocess.TimeoutExpired:
        runner([runtime, "rm", "-f", container_name],
               capture_output=True, text=True, timeout=60)
        raise SandboxError(
            f"method exceeded its {caps['minutes']}-minute wall clock — "
            f"container killed, no score produced (§8 failure modes).",
            diagnostics=failure_diagnostics(
                "timeout", runtime_seconds=round(time.monotonic() - started, 3),
                n_sources=n_sources))
    run_seconds = round(time.monotonic() - run_started, 3)
    elapsed = time.monotonic() - started

    if proc.returncode != 0:
        raise SandboxError(
            f"method exited {proc.returncode} — no score produced (§2.2). "
            f"stderr tail:\n{(proc.stderr or '')[-2000:]}",
            diagnostics=failure_diagnostics(
                "exit", exit_code=proc.returncode,
                runtime_seconds=round(elapsed, 3), n_sources=n_sources,
                stderr_bytes=len((proc.stderr or "").encode("utf-8"))))

    translations = output_dir / "translations.txt"
    if not translations.is_file():
        raise SandboxError(
            "method produced no /output/translations.txt — no score "
            "produced (§8 failure modes).",
            diagnostics=failure_diagnostics(
                "no-output", exit_code=proc.returncode,
                runtime_seconds=round(elapsed, 3), n_sources=n_sources,
                n_output_lines=0,
                stderr_bytes=len((proc.stderr or "").encode("utf-8"))))
    out_bytes = sum(p.stat().st_size for p in output_dir.rglob("*")
                    if p.is_file())
    if out_bytes > OUTPUT_LIMIT_BYTES:
        raise SandboxError(
            f"/output holds {out_bytes} bytes — over the "
            f"{OUTPUT_LIMIT_BYTES}-byte limit (§3.4).",
            diagnostics=failure_diagnostics(
                "output-size", exit_code=proc.returncode,
                runtime_seconds=round(elapsed, 3), n_sources=n_sources))

    facts = {
        "translations_path": str(translations),
        "runtime_seconds": round(elapsed, 3),   # wall total, not just the run
        "build_seconds": build_seconds,
        "run_seconds": run_seconds,
        "runtime": runtime,
        "image_tag": tag,
        "image_digest": image_digest,
        "container_name": container_name,
        "source_count": n_sources,
        "output_bytes": out_bytes,
        # The node's OWN caps — the conditions the method ran under.
        "cpus": caps["cpus"],
        "ram_gb": caps["ram_gb"],
        "tmp_gb": caps["tmp_gb"],
        "gpu": caps["gpu"],
        "pids_limit": caps["pids_limit"],
    }
    if image_digest_note:
        facts["image_digest_note"] = image_digest_note
    return facts


def _probe_image_digest(runtime: str, tag: str,
                        runner: Runner) -> tuple[Optional[str], Optional[str]]:
    """``<runtime> image inspect --format '{{.Id}}'`` → (digest, note).

    Returns ``(None, why)`` when the runtime cannot report one. A digest is
    an identity claim; an invented one would make an unreproducible run look
    reproducible, so there is no fallback value.
    """
    try:
        probe = runner([runtime, "image", "inspect", tag,
                        "--format", "{{.Id}}"],
                       capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError) as exc:
        return None, f"{runtime} image inspect failed: {exc}"
    if probe.returncode != 0:
        return None, (f"{runtime} image inspect exited {probe.returncode} — "
                      f"no image digest recorded")
    digest = (probe.stdout or "").strip()
    if not digest:
        return None, f"{runtime} reported an empty image id"
    if ":" not in digest:
        return None, (f"{runtime} reported an image id in an unrecognised "
                      f"form — recording no digest rather than a guess")
    return digest, None


# ---------------------------------------------------------------------------
# §8 — teardown.
# ---------------------------------------------------------------------------

def wipe_tree(path: str | Path) -> None:
    """Overwrite-then-delete every file under ``path``, then remove it.

    Best-effort zeros pass (§8 step 3 defense-in-depth; a failure is
    REPORTED, never swallowed silently into a claim of success).

    The container writes as uid 0, so ITS files are root-owned and the zeros
    pass fails EACCES on them — but the node owns the directory and may
    unlink them perfectly well. Without the fallback the whole run scratch
    survived teardown, method output and all (measured 2026-09-07 in the
    air-gap guest). The weaker outcome is printed; it is never silently
    treated as a clean wipe. A directory that will not go is reported too —
    the previous `except OSError: pass` on the root hid exactly this.
    """
    root = Path(path)
    if not root.exists():
        return
    unlinked_only = 0
    for p in sorted(root.rglob("*"), reverse=True):
        try:
            if p.is_dir() and not p.is_symlink():
                p.rmdir()
                continue
            try:
                size = p.stat().st_size
                with open(p, "r+b") as fh:
                    fh.write(b"\0" * size)
            except OSError:
                unlinked_only += 1
            p.unlink()
        except OSError as exc:
            print(f"    ⚠ wipe: could not remove {p}: {exc}")
    if unlinked_only:
        print(f"    · wipe: {unlinked_only} sandbox-written file(s) under "
              f"{root} were deleted without the overwrite pass (root-owned "
              f"by the container).")
    try:
        root.rmdir()
    except OSError as exc:
        print(f"    ⚠ wipe: {root} could not be removed: {exc}")


def teardown(*, runtime: str | None, container_name: str | None,
             image_tag: str | None, work_dir: str | Path | None,
             runner: Runner = subprocess.run) -> None:
    """§8: container destroyed, image removed, scratch wiped."""
    if runtime and container_name:
        runner([runtime, "rm", "-f", container_name],
               capture_output=True, text=True, timeout=60)
    if runtime and image_tag:
        runner([runtime, "rmi", "-f", image_tag],
               capture_output=True, text=True, timeout=60)
    if work_dir:
        wipe_tree(work_dir)


# ---------------------------------------------------------------------------
# The full offline pipeline: checks → execute → score. No DB, no publish —
# shared verbatim by the connected node (run-method) and the airgap node
# (airgap_transport), which differ only in where the corpus comes from and
# where the scores go.
# ---------------------------------------------------------------------------

def execute_and_score(*, bundle_dir: str | Path, corpus_path: str | Path,
                      work_dir: str | Path, sealed_set_id: str,
                      language_pair: str, node_id: str,
                      submission: dict | None = None,
                      output_dir: str | Path,
                      sandbox_cfg: dict | None = None,
                      runner: Runner = subprocess.run,
                      expected_corpus_id: str | None = None,
                      extra_sets: list[dict] | None = None) -> dict:
    """Static checks → §7 execution → single-scorer scoring. Returns the
    score_hypotheses result dict + execution facts (+ static check summary).

    Raises SandboxError with the blocking findings if §3 fails — the caller
    turns that into a denial WITH reasons. Teardown always runs.

    ``extra_sets`` (contract C6) are the OTHER corpora this one authorized run
    covers, each ``{role, set_id, corpus_path, suite_id?, corpus_sha256?}``
    with ``role`` in ``{"suite", "holdout"}``:

    * the image is built ONCE (by the main run) and every extra set is one
      more ``--network=none`` container under the SAME caps, with its own
      source-only mount — the method never sees a reference and never sees two
      corpora at once;
    * ``role="suite"`` — a third-party diagnostic set (practice 14). Its
      AGGREGATES land in the returned ``by_test_suite`` map, which is passed
      to the single scorer for the main run so they ride the main run card.
      Per-segment output never leaves the node. A suite that fails does NOT
      fail the request: it is recorded as ``{error, stage}`` for that suite
      and the main run carries on, because a broken third-party file is the
      organizer's problem, not the participant's;
    * ``role="holdout"`` — the contest's second sealed split (practice 7).
      It returns a SECOND full result of the same shape as the main one, under
      ``holdout``, with ``dataset_id`` = the holdout set id. A holdout failure
      FAILS the whole request: the organizer promised the holdout would be
      scored in this run, and a request that quietly skipped it would publish
      a main score while breaking that promise.
    """
    from mt_eval_harness.external_scoring import (
        METHOD_EXECUTION_CONDITION,
        HypothesesFormatError,
        build_executed_method_card,
        score_hypotheses,
        sha256_file,
    )
    bundle_dir = Path(bundle_dir)
    work_dir = Path(work_dir)

    checks = run_static_checks(bundle_dir,
                               expected_corpus_id=expected_corpus_id)
    for w in checks["warns"]:
        print(f"    ⚠ {w['detail']}")
    if checks["blocked"]:
        raise SandboxError(
            "static checks BLOCK this bundle (spec §3): "
            + "; ".join(b["detail"] for b in checks["blocks"][:8]))
    manifest = checks["manifest"]

    exec_facts = None
    try:
        exec_facts = execute_method(
            bundle_dir=bundle_dir, corpus_path=corpus_path,
            work_dir=work_dir, manifest=manifest,
            sandbox_cfg=sandbox_cfg, runner=runner)

        # Recompute the bundle identity the scores will be labeled with.
        method_sha = None
        tarball = bundle_dir.with_suffix(".tar.gz")
        if tarball.is_file():
            method_sha = sha256_file(tarball)
        method = manifest["method"]
        from mt_eval_harness.pair_notation import split_pair
        src, tgt = split_pair(language_pair)
        card = build_executed_method_card(
            system_label=method["name"],
            method_class=method["class"],
            paradigm=method.get("paradigm"),
            description=method.get("description", ""),
            method_sha=method_sha or (submission or {}).get("method_sha", ""),
            node_id=node_id,
        )
        # Contract C4: the execution facts that ride the run card. Paths and
        # container names are DROPPED — a scratch path is a fact about the
        # organizer's disk, never a published one.
        execution = execution_from_facts(exec_facts, node_id=node_id)
        out_lines, n_empty = output_line_counts(
            exec_facts["translations_path"])

        # ------------------------------------------------------------------
        # Contract C6 — the other sets this one authorized run covers. The
        # image is already built; each set is one more --network=none run
        # under the same caps, with its own source-only mount.
        # ------------------------------------------------------------------
        caps = enforce_resource_caps(
            manifest.get("requirements") or {},
            {**DEFAULT_SANDBOX_CFG, **(sandbox_cfg or {})})
        extra_runtime = exec_facts["runtime"]
        extra_tag = exec_facts["image_tag"]
        extra_entrypoint = manifest["method"]["entrypoint"]

        def _run_one_set(spec: dict) -> dict:
            """Run the already-built image on one more corpus. Returns run
            facts; raises SandboxError (with the stage) on any failure."""
            set_id = str(spec.get("set_id") or spec.get("suite_id") or "")
            # Messages here are RECORDED on a published run card, so they name
            # the set and the hashes and never a path on the node's disk.
            corpus = Path(spec["corpus_path"])
            if not corpus.is_file():
                raise SandboxError(
                    f"{set_id}: the node does not hold this corpus — the run "
                    f"cannot cover a set that is not on the machine.",
                    diagnostics=failure_diagnostics("run"))
            pinned = str(spec.get("corpus_sha256") or "").strip().lower()
            if pinned:
                actual = sha256_file(corpus)
                if actual != pinned:
                    raise SandboxError(
                        f"{set_id}: corpus is pinned at sha256 {pinned} but "
                        f"the node's copy hashes to {actual} — refusing to "
                        f"report a number about different bytes.",
                        diagnostics=failure_diagnostics("run"))
            safe = re.sub(r"[^A-Za-z0-9._-]", "_", set_id) or "set"
            set_root = work_dir / "sets" / safe
            eval_dir = set_root / "eval"
            out_dir = make_output_mount(set_root / "output")
            n_src = write_source_file(corpus, eval_dir)
            name = f"mteval-run-{uuid.uuid4().hex[:12]}"
            started = time.monotonic()
            try:
                proc = runner(
                    run_container_argv(
                        extra_runtime, extra_tag, container_name=name,
                        eval_dir=eval_dir, method_dir=bundle_dir / "method",
                        output_dir=out_dir, entrypoint=extra_entrypoint,
                        caps=caps),
                    capture_output=True, text=True,
                    timeout=caps["minutes"] * 60 + 60)
            except subprocess.TimeoutExpired as exc:
                runner([extra_runtime, "rm", "-f", name],
                       capture_output=True, text=True, timeout=60)
                raise SandboxError(
                    f"{set_id}: exceeded its {caps['minutes']}-minute wall "
                    f"clock — container killed, no score.",
                    diagnostics=failure_diagnostics(
                        "timeout",
                        runtime_seconds=round(time.monotonic() - started, 3),
                        n_sources=n_src)) from exc
            elapsed = round(time.monotonic() - started, 3)
            if proc.returncode != 0:
                raise SandboxError(
                    f"{set_id}: method exited {proc.returncode} — no score.",
                    diagnostics=failure_diagnostics(
                        "exit", exit_code=proc.returncode,
                        runtime_seconds=elapsed, n_sources=n_src,
                        stderr_bytes=len((proc.stderr or "").encode("utf-8"))))
            translations = out_dir / "translations.txt"
            if not translations.is_file():
                raise SandboxError(
                    f"{set_id}: no /output/translations.txt — no score.",
                    diagnostics=failure_diagnostics(
                        "no-output", exit_code=proc.returncode,
                        runtime_seconds=elapsed, n_sources=n_src,
                        n_output_lines=0))
            produced = sum(p.stat().st_size for p in out_dir.rglob("*")
                           if p.is_file())
            if produced > OUTPUT_LIMIT_BYTES:
                raise SandboxError(
                    f"{set_id}: /output holds {produced} bytes — over the "
                    f"{OUTPUT_LIMIT_BYTES}-byte limit (§3.4).",
                    diagnostics=failure_diagnostics(
                        "output-size", exit_code=proc.returncode,
                        runtime_seconds=elapsed, n_sources=n_src))
            return {"translations_path": str(translations),
                    "runtime_seconds": elapsed, "source_count": n_src,
                    "output_bytes": produced, "corpus_path": str(corpus),
                    "corpus_sha256": pinned or sha256_file(corpus)}

        def _score_set(spec: dict, facts: dict, *, full: bool) -> dict:
            """Score one extra set through the SAME single scorer."""
            set_id = str(spec.get("set_id") or spec.get("suite_id") or "")
            safe = re.sub(r"[^A-Za-z0-9._-]", "_", set_id) or "set"
            sub_out = (Path(output_dir) / "holdout" if full
                       else Path(output_dir) / "test-suites" / safe)
            set_execution = dict(execution)
            set_execution["runtime_seconds"] = facts["runtime_seconds"]
            set_execution["source_count"] = facts["source_count"]
            set_execution["output_bytes"] = facts["output_bytes"]
            set_execution["build_seconds"] = 0.0
            set_execution["build_note"] = (
                "image built once for this authorized run; this set reused it")
            return score_hypotheses(
                corpus_path=facts["corpus_path"],
                hypotheses_path=facts["translations_path"],
                dataset_id=set_id,
                source_lang=src or "source",
                target_lang=tgt or "target",
                system_label=method["name"],
                method_class=method["class"],
                paradigm=method.get("paradigm"),
                description=method.get("description", ""),
                output_dir=sub_out,
                default_segment="gold_standard",
                submission=submission,
                compute_ci=full,
                condition=METHOD_EXECUTION_CONDITION,
                method_card=card,
                execution=set_execution,
            )

        by_test_suite: dict = {}
        holdout_spec = None
        for spec in (extra_sets or []):
            role = str(spec.get("role") or "").strip()
            if role == "holdout":
                if holdout_spec is not None:
                    raise SandboxError(
                        "two holdout sets were passed for one run — a "
                        "contest declares exactly one "
                        "metadata.sealed_holdout_set_id.")
                holdout_spec = spec
                continue
            if role != "suite":
                raise SandboxError(
                    f"extra_sets role must be 'suite' or 'holdout' (got "
                    f"{role!r} for {spec.get('set_id')!r}).")
            suite_id = str(spec.get("suite_id") or spec.get("set_id") or "")
            if not suite_id:
                raise SandboxError(
                    "a test suite entry needs a suite_id — an unnamed number "
                    "is not reportable.")
            try:
                facts = _run_one_set(spec)
                scored = _score_set(spec, facts, full=False)
            except SandboxError as exc:
                # A failing diagnostic suite never fails the participant's
                # run: it is the organizer's file, and the main score stands.
                # The RECORDED reason is this module's own wording (path-free
                # by construction); the node console gets the full exception.
                stage = ((getattr(exc, "diagnostics", None) or {})
                         .get("stage") or "run")
                by_test_suite[suite_id] = {
                    "corpus_card_id": spec.get("set_id") or suite_id,
                    "error": str(exc)[:300], "stage": stage,
                }
                print(f"    ⚠ test suite {suite_id}: {exc}")
                continue
            except HypothesesFormatError as exc:
                by_test_suite[suite_id] = {
                    "corpus_card_id": spec.get("set_id") or suite_id,
                    "error": (f"{suite_id}: the method's output does not "
                              f"align with this suite's corpus one-for-one."),
                    "stage": "align",
                }
                print(f"    ⚠ test suite {suite_id}: {exc}")
                continue
            except RuntimeError as exc:
                by_test_suite[suite_id] = {
                    "corpus_card_id": spec.get("set_id") or suite_id,
                    "error": f"{suite_id}: scoring this suite failed.",
                    "stage": "score",
                }
                print(f"    ⚠ test suite {suite_id}: {exc}")
                continue
            except Exception as exc:  # noqa: BLE001
                # Anything else a third-party file can do to us — recorded
                # and PRINTED in full on the node, never swallowed, and still
                # never a reason to lose the participant's main score.
                by_test_suite[suite_id] = {
                    "corpus_card_id": spec.get("set_id") or suite_id,
                    "error": (f"{suite_id}: unexpected failure "
                              f"({type(exc).__name__})."),
                    "stage": "run",
                }
                print(f"    ⚠ test suite {suite_id}: "
                      f"{type(exc).__name__}: {exc}")
                continue
            by_test_suite[suite_id] = {
                # AGGREGATES ONLY — a per-segment output never leaves a node.
                "corpus_card_id": spec.get("set_id") or suite_id,
                "sha256": facts["corpus_sha256"],
                "n": int(scored.get("evaluated") or 0),
                "chrf_plus_plus": scored.get("chrf_plus_plus"),
                "corpus_bleu": scored.get("corpus_bleu"),
                "runtime_seconds": facts["runtime_seconds"],
            }

        try:
            result = score_hypotheses(
                corpus_path=corpus_path,
                hypotheses_path=exec_facts["translations_path"],
                dataset_id=sealed_set_id,
                source_lang=src or "source",
                target_lang=tgt or "target",
                system_label=method["name"],
                method_class=method["class"],
                paradigm=method.get("paradigm"),
                description=method.get("description", ""),
                output_dir=output_dir,
                default_segment="gold_standard",
                submission=submission,
                compute_ci=True,
                condition=METHOD_EXECUTION_CONDITION,
                method_card=card,
                execution=execution,
                by_test_suite=by_test_suite or None,
            )
        except HypothesesFormatError as e:
            # The method ran and produced output that does not cover the
            # corpus one-for-one. That is a distinct, actionable stage — the
            # participant should not have to guess between "it crashed" and
            # "it emitted the wrong number of lines".
            raise SandboxError(
                f"method output does not align with the corpus — no score "
                f"produced: {e}",
                diagnostics=failure_diagnostics(
                    "align",
                    runtime_seconds=exec_facts.get("runtime_seconds"),
                    n_sources=exec_facts.get("source_count"),
                    n_output_lines=out_lines)) from e
        except RuntimeError as e:
            raise SandboxError(
                f"scoring failed after a successful run — no score produced: "
                f"{e}",
                diagnostics=failure_diagnostics(
                    "score",
                    runtime_seconds=exec_facts.get("runtime_seconds"),
                    n_sources=exec_facts.get("source_count"),
                    n_output_lines=out_lines)) from e
        result["execution"] = execution
        result["diagnostics"] = scored_diagnostics(
            n_scored=int(result.get("evaluated") or 0),
            n_empty=n_empty,
            runtime_seconds=exec_facts.get("runtime_seconds"))
        result["static_checks"] = {
            "blocks": 0, "warns": len(checks["warns"]),
        }
        result["method_card"] = card
        result["by_test_suite"] = by_test_suite

        # The holdout is scored LAST and separately: it is a full result of
        # the main result's shape, published on its own (deferred to close by
        # contract C5). Its failure fails the request — the organizer promised
        # this run would cover it.
        holdout_result = None
        if holdout_spec is not None:
            holdout_id = str(holdout_spec.get("set_id") or "")
            if not holdout_id:
                raise SandboxError(
                    "the holdout set was passed without a set_id — its scores "
                    "would have nothing to be labeled with.")
            facts = _run_one_set(holdout_spec)
            try:
                holdout_result = _score_set(holdout_spec, facts, full=True)
            except HypothesesFormatError as e:
                raise SandboxError(
                    f"holdout {holdout_id}: method output does not align with "
                    f"the corpus — no score produced: {e}",
                    diagnostics=failure_diagnostics(
                        "align", runtime_seconds=facts["runtime_seconds"],
                        n_sources=facts["source_count"])) from e
            except RuntimeError as e:
                raise SandboxError(
                    f"holdout {holdout_id}: scoring failed after a successful "
                    f"run — no score produced: {e}",
                    diagnostics=failure_diagnostics(
                        "score", runtime_seconds=facts["runtime_seconds"],
                        n_sources=facts["source_count"])) from e
            _h_lines, h_empty = output_line_counts(facts["translations_path"])
            # The holdout's OWN wall time and counts, on the image the main
            # run built: build_seconds is 0 here because this run did not
            # build anything, and saying otherwise would double-count it.
            holdout_result["execution"] = execution_from_facts(
                {**exec_facts, **facts,
                 "build_seconds": 0.0,
                 "run_seconds": facts["runtime_seconds"]},
                node_id=node_id)
            holdout_result["execution"]["build_note"] = (
                "image built once for this authorized run; the holdout "
                "reused it")
            holdout_result["diagnostics"] = scored_diagnostics(
                n_scored=int(holdout_result.get("evaluated") or 0),
                n_empty=h_empty,
                runtime_seconds=facts["runtime_seconds"])
            holdout_result["static_checks"] = dict(result["static_checks"])
            holdout_result["method_card"] = card
            holdout_result["role"] = "holdout"
        result["holdout"] = holdout_result
        return result
    finally:
        teardown(
            runtime=(exec_facts or {}).get("runtime"),
            container_name=(exec_facts or {}).get("container_name"),
            image_tag=(exec_facts or {}).get("image_tag"),
            work_dir=work_dir,
            runner=runner,
        )


# ---------------------------------------------------------------------------
# Contract C6, node side — turning what node.json DECLARES into the extra_sets
# one authorized run covers. Shared by the connected orchestrator below and by
# airgap_transport.run_imported, so a sneakernet contest reports exactly what a
# connected one does.
# ---------------------------------------------------------------------------

#: The holdout result of a request is a SECOND deferred row for the SAME
#: authorization request, and ``contest_deferred_results.request_id`` is the
#: primary key (migration 074). It is parked under this derived key so the
#: main result's row is never overwritten; the sidecar still carries the REAL
#: ``authorization_request_id``, which is what ``contest_submissions`` records
#: (that column has a foreign key; this derived string must never reach it).
# NOT "#holdout": the key is used as a PostgREST filter VALUE
# (request_id=eq.<key>) and '#' opens a URL fragment, so the server never saw
# the suffix at all — every read keyed on it silently addressed the MAIN
# result instead, and the holdout insert then failed as an "already withheld"
# conflict against the main card (measured 2026-09-07 in the air-gap
# rehearsal). '~' is unreserved in RFC 3986 and survives every hop.
HOLDOUT_DEFER_SUFFIX = "~holdout"


def holdout_defer_key(request_id: str) -> str:
    """The ``contest_deferred_results`` key a holdout result is parked under.

    Must stay URL-safe: it travels as a PostgREST filter value.
    """
    return f"{request_id}{HOLDOUT_DEFER_SUFFIX}"


def is_sealed_artifact_file(path: str | Path) -> bool:
    """True when ``path`` is a champollion sealed artifact (not a corpus).

    ``contests[<id>].holdout_corpus`` names either the sealed artifact (the
    normal deployment) or a plaintext corpus file (a local rehearsal). The
    file itself says which — a sealed artifact is JSON carrying
    ``champollionSealed`` + ``envelope`` — so the node never has to be told
    twice, and never guesses.

    The cheap prefix probe first: BOTH writers of this format
    (``sovereign.threshold_seal.build_sealed_artifact`` and
    ``cli/lib/seal.mjs`` ``buildSealedArtifact``) emit ``champollionSealed``
    as the FIRST key, and a sealed artifact's ciphertext can be gigabytes —
    so a whole-file parse is only attempted when the marker is actually
    there.
    """
    p = Path(path).expanduser()
    if not p.is_file():
        return False
    try:
        with open(p, "rb") as fh:
            head = fh.read(65536)
    except OSError:
        return False
    if b"champollionSealed" not in head:
        return False
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, UnicodeDecodeError):
        return False
    return bool(isinstance(doc, dict) and doc.get("champollionSealed")
                and doc.get("envelope"))


def resolve_holdout_corpus(contest_cfg: dict, scratch: Path, *,
                           already_open: str | Path | None = None
                           ) -> tuple[Optional[Path], bool]:
    """``(corpus_path, is_scratch_copy)`` for a contest's holdout split.

    ``(None, False)`` when the contest declares no holdout. ``already_open``
    is the path a custodian ceremony ALREADY decrypted (the threshold lane
    opens both sealed sets under one quorum — contract D1), and is returned
    as-is.

    A sealed holdout artifact under single-key custody is decrypted here, the
    same way the secret set is. Under threshold custody there is no key file
    by construction, so a sealed holdout that did not come out of the ceremony
    is a refusal, never a silent skip: the contest promised participants their
    method would be scored on the holdout in this run.
    """
    declared = (contest_cfg or {}).get("holdout_corpus")
    if not declared:
        return None, False
    if already_open is not None:
        return Path(already_open), True
    path = Path(declared).expanduser()
    if not path.is_file():
        raise SandboxError(
            f"holdout_corpus {declared!r} is not on this node — the contest "
            f"declares a sealed holdout split ({contest_cfg.get('holdout_set_id')!r}) "
            f"that this run is supposed to cover, so the run is refused "
            f"rather than published as if the holdout had been skipped.")
    if not is_sealed_artifact_file(path):
        return path, False
    if (contest_cfg or {}).get("custody") == "threshold-quorum":
        raise SandboxError(
            f"the holdout artifact for {contest_cfg.get('holdout_set_id')!r} "
            f"is sealed under threshold custody: it opens only inside the "
            f"custodian ceremony that opens the secret set (one quorum, both "
            f"splits — contract D1). Re-run with `--share` so the ceremony "
            f"covers both artifacts.")
    privkey = (contest_cfg or {}).get("secret_privkey")
    if not privkey:
        raise SandboxError(
            f"holdout_corpus {declared!r} is a sealed artifact but "
            f"contests[…] configures no secret_privkey to open it.")
    from mt_eval_harness.contest_node import _open_sealed_to_scratch
    opened = _open_sealed_to_scratch(path, Path(privkey).expanduser(),
                                     Path(scratch))
    return Path(opened), True


def build_extra_sets(contest_cfg: dict, *,
                     holdout_corpus: str | Path | None = None
                     ) -> list[dict]:
    """The contract-C6 ``extra_sets`` a contest entry's run covers.

    Built from what ``contest_node.load_node_config`` already validated (every
    declared file exists on this node and hashes to its pin), so nothing here
    re-decides policy — it only shapes it:

    * one ``{"role": "suite", …}`` per ``contests[<id>].test_suites`` entry.
      ``set_id`` is the ``suite_id`` the contest froze; the two coincide by
      construction today (``contest_prep.resolve_test_suites`` writes
      ``suite_id == corpus_card_id``), and the node holds no other name for
      the suite;
    * one ``{"role": "holdout", …}`` when the contest declares
      ``holdout_set_id`` AND the corpus has been resolved for this run.
    """
    sets: list[dict] = []
    for suite in ((contest_cfg or {}).get("test_suites") or []):
        sets.append({
            "role": "suite",
            "suite_id": suite["suite_id"],
            "set_id": suite["suite_id"],
            "corpus_path": suite["corpus_path"],
            "corpus_sha256": suite.get("corpus_sha256"),
        })
    holdout_set_id = (contest_cfg or {}).get("holdout_set_id")
    if holdout_corpus is not None:
        if not holdout_set_id:
            raise SandboxError(
                "a holdout corpus was resolved for this run but the contest "
                "entry names no holdout_set_id — the scores would have "
                "nothing to be labeled with.")
        sets.append({
            "role": "holdout",
            "set_id": holdout_set_id,
            "corpus_path": str(holdout_corpus),
            # NOT pinned here: holdout_corpus_sha256 pins the ARTIFACT (which
            # load_node_config already verified at startup), while this path
            # is the decrypted plaintext, whose digest the organizer never
            # published. Passing the artifact's pin would compare two
            # different things.
        })
    return sets


def grant_sets_detail(contest_cfg: dict) -> dict:
    """The ``grant_used`` audit detail for a run covering several sets (D1).

    ONE authorized run, ONE grant, and the audit trail says which splits that
    grant covers — ``sets`` names the scored splits (``main``, plus
    ``holdout`` when the contest declares one) and ``test_suites`` the
    diagnostic suites. Read from the node's DECLARATIONS, so the detail is
    known before the grant is minted; content-free (ids only).
    """
    return {
        "sets": (["main", "holdout"] if (contest_cfg or {}).get("holdout_set_id")
                 else ["main"]),
        "test_suites": [str(s.get("suite_id") or "")
                        for s in ((contest_cfg or {}).get("test_suites") or [])],
    }


# ---------------------------------------------------------------------------
# `mt-eval node run-method` — the CONNECTED-mode orchestrator (§5→§9).
# The true-airgap variant lives in airgap_transport.py and shares everything
# above; only intake (files vs bucket) and egress (signed bundle vs publish)
# differ.
# ---------------------------------------------------------------------------

def resolve_contest_qualifier(sealed_set_id: str,
                              contest_corpus_id: str | None = None) -> Optional[dict]:
    """The ACTIVE qualifier row that gates this sealed set.

    Registration (contest_prep.register_prepared) stamps every sealed set it
    prepares — blind AND fully-secret — with ``current_qualifier_id``, so the
    secret set names its own gate. The contest's registered corpus is the
    fallback for sets registered before that column was filled."""
    from mt_eval_harness.contest_node import _fetch_rows
    sets = _fetch_rows("sealed_sets", {
        "sealed_set_id": f"eq.{sealed_set_id}",
        "select": "sealed_set_id,current_qualifier_id,status"})
    qualifier_id = (sets[0].get("current_qualifier_id") if sets else None)
    if qualifier_id:
        rows = _fetch_rows("qualifiers", {
            "qualifier_id": f"eq.{qualifier_id}",
            "select": "qualifier_id,corpus_card_id,threshold,metric,year,"
                      "status"})
        if rows:
            return rows[0]
    if contest_corpus_id:
        rows = _fetch_rows("qualifiers", {
            "sealed_set_id": f"eq.{contest_corpus_id}",
            "status": "eq.active",
            "select": "qualifier_id,corpus_card_id,threshold,metric,year,"
                      "status"})
        if rows:
            return rows[0]
    return None


def _sealed_headline(result: dict) -> str:
    """``chrF++ 47.5 [45.9, 49.0] on the sealed set`` — a sealed scoring's
    standard headline (scoring.format_primary), the one wording the summary
    lines print. ``chrF++ —`` when none was computed."""
    from mt_eval_harness.scoring import format_primary
    return format_primary(result.get("chrf_plus_plus"),
                          result.get("chrf_ci_lower"),
                          result.get("chrf_ci_upper")) + " on the sealed set"


def verify_qualifier_by_execution(bundle_dir: str | Path, lane: str,
                                  contest_cfg: dict, qualifier: dict, *,
                                  manifest: dict | None,
                                  work_dir: str | Path,
                                  output_dir: str | Path,
                                  node_id: str,
                                  language_pair: str = ">",
                                  sandbox_cfg: dict | None = None,
                                  runner: Runner = subprocess.run,
                                  translator=None,
                                  architecture_policy=None) -> dict:
    """Re-EXECUTE the submitted method on the PUBLIC dev set and gate on the
    node's own measurement. Replaces the old "T1 standing" check.

    Why execution and not a lookup: the qualifier receipt the participant
    embeds (``manifest["qualifier"]``, contest_qualify.py) is unsigned and
    self-reported — it says what a participant measured on their own machine
    with their own runner. This node re-runs the SAME artifact it is about to
    let near the sealed set, on the SAME public dev corpus, through the SAME
    lane executor, and gates on what it measures itself. A receipt that
    overstates the method is caught here, with claimed-vs-measured named in
    the refusal.

    Runs BEFORE any grant is claimed and before the sealed corpus is opened —
    a method that cannot clear the public gate never touches the secret set.

    Returns ``{eligible, reason, claimed, measured, threshold, qualifier_id}``.
    Anything RAISED is the node's own problem (no dev corpus configured);
    anything RETURNED not-eligible is the submission's — including a method
    that crashes on the public set.
    """
    dev_corpus = (contest_cfg or {}).get("dev_corpus")
    if not dev_corpus:
        raise SandboxError(
            "this node has no dev_corpus configured for the contest serving "
            f"sealed set {qualifier.get('corpus_card_id')!r} — every method "
            "is re-executed on the PUBLIC qualifier corpus before the sealed "
            "run, so the node cannot proceed without it (node.json "
            "contests[<id>].dev_corpus).")
    dev_corpus_path = Path(dev_corpus).expanduser()
    if not dev_corpus_path.is_file():
        raise SandboxError(
            f"configured dev_corpus does not exist: {dev_corpus_path}")
    # The gate is corpus chrF++ (scoring standard/1). A qualifier naming the
    # retired composite is gated on chrF++ with a note; one naming any other
    # metric is the organizer's misconfiguration — raised, not the method's.
    from mt_eval_harness.qualifier_gate import resolve_qualifier_metric
    try:
        q_metric = resolve_qualifier_metric(qualifier.get("metric"),
                                            qualifier.get("threshold"))
    except ValueError as exc:
        raise SandboxError(
            f"qualifier {qualifier.get('qualifier_id')!r}: {exc}") from exc

    claimed_block = (manifest or {}).get("qualifier")
    if not isinstance(claimed_block, dict) or not claimed_block:
        return {
            "eligible": False,
            "reason": ("the bundle carries no qualifier receipt "
                       "(manifest.qualifier) — run `mt-eval contest qualify "
                       "<contest> …` on the PUBLIC dev set and re-submit; "
                       "the sealed lane admits nothing that has not cleared "
                       "the public gate."),
            "claimed": None, "measured": None,
            "threshold": qualifier.get("threshold"),
            "qualifier_id": qualifier.get("qualifier_id"),
        }
    claimed_id = claimed_block.get("qualifierId") or claimed_block.get(
        "qualifier_id")
    if claimed_id and claimed_id != qualifier.get("qualifier_id"):
        return {
            "eligible": False,
            "reason": (f"the bundle's qualifier receipt cleared "
                       f"{claimed_id!r}, but this set's active qualifier is "
                       f"{qualifier.get('qualifier_id')!r} — re-qualify "
                       f"against the current release."),
            "claimed": claimed_block.get("score"), "measured": None,
            "threshold": qualifier.get("threshold"),
            "qualifier_id": qualifier.get("qualifier_id"),
        }

    if lane == "declarative-model":
        from mt_eval_harness.model_runner import (
            execute_and_score_declarative as lane_execute,
        )
    else:
        lane_execute = execute_and_score
    exec_kwargs = dict(
        bundle_dir=bundle_dir, corpus_path=dev_corpus_path,
        work_dir=work_dir,
        # The dev run is labeled with the QUALIFIER corpus, never the sealed
        # set — these scores are the gate's evidence, not a sealed result.
        sealed_set_id=qualifier["corpus_card_id"],
        language_pair=language_pair, node_id=node_id,
        output_dir=output_dir,
        # The manifest declares the SEALED corpus id; this run is against the
        # public dev corpus, so the manifest/corpus cross-check is not applied
        # here (it already ran, and runs again, against the sealed set).
        expected_corpus_id=None,
        submission={"lane": "qualifier-reexecution",
                    "qualifier_id": qualifier.get("qualifier_id")})
    try:
        if lane == "declarative-model":
            exec_kwargs["architecture_policy"] = architecture_policy
            if translator is not None:
                exec_kwargs["translator"] = translator
            result = lane_execute(**exec_kwargs)
        else:
            result = lane_execute(sandbox_cfg=sandbox_cfg, runner=runner,
                                  **exec_kwargs)
    except (NodeSetupError, ResourceRequestRefused):
        # Not a verdict on the method: the node cannot run anything as
        # configured, or the bundle asks for more than the node allows. Both
        # are RAISED (this function's contract: raised = not the submission's
        # failure), so neither is ever recorded as "qualifier not met".
        raise
    except SandboxError as exc:
        # A method that cannot even RUN on the public dev set is a
        # participant-side verdict, not a node fault: it is refused here,
        # before a custodian is asked for anything and before the sealed set
        # is opened. (Node-side misconfiguration raised above, before any
        # execution — anything RAISED by this function is the node's problem,
        # anything RETURNED is the submission's.)
        return {
            "eligible": False,
            "reason": (f"the method could not be executed on the public dev "
                       f"set: {exc}"),
            "claimed": claimed_block.get("score"), "measured": None,
            "threshold": qualifier.get("threshold"),
            "qualifier_id": qualifier.get("qualifier_id"),
        }

    measured = result.get("qualifier_score")
    verdict = is_eligible_for_sealed_run(
        qualifier_id=qualifier.get("qualifier_id"),
        score=measured,
        threshold=qualifier.get("threshold"),
        qualifier_year=qualifier.get("year"),
        current_year=datetime.now(timezone.utc).year,
    )
    out = {
        "eligible": bool(verdict["eligible"]),
        "reason": verdict["reason"],
        "claimed": claimed_block.get("score"),
        "measured": measured,
        "threshold": verdict["threshold"],
        "qualifier_id": qualifier.get("qualifier_id"),
        "badge": verdict.get("badge"),
        "metric": q_metric["metric"],
    }
    if q_metric["note"]:
        out["metric_note"] = q_metric["note"]
    # The receipt-vs-node gap (qualifier_gate.receipt_gap): a FLAG beside the
    # verdict — never part of it. The node used to pass 3.37 against a claimed
    # 8.54 without a word (synthetic researcher, Round 10).
    gap = receipt_gap(out["claimed"], measured)
    if gap is not None:
        out["receipt_gap"] = gap
    # A method whose dev outputs are mostly copies of their source is not
    # translating, whatever it scores — the same refusal `contest qualify`
    # records on the entrant's receipt (score_caveats.source_copy_refusal:
    # the harness's one source-copy rule), measured here on what THIS node's
    # execution produced.
    if result.get("report_path"):
        from mt_eval_harness.score_caveats import source_copy_refusal
        report = json.loads(Path(result["report_path"]).read_text(
            encoding="utf-8"))
        refusal = source_copy_refusal(report.get("entries") or [])
        if refusal is not None:
            out.update({"eligible": False, "reason": refusal["reason"],
                        "refusal": {k: refusal[k] for k in (
                            "rule", "copies", "considered", "copy_share",
                            "share_bound", "correct_copies_excluded")},
                        "badge": None})
    return out


def _audit_request_created_once(request: dict, contest_id: str,
                                node_id: str) -> None:
    """Append request_created when the node first acknowledges a
    participant-created T2 request (participants cannot write the audit log;
    the chain still gets the full canonical sequence)."""
    from mt_eval_harness.contest_node import _fetch_rows
    from mt_eval_harness.sovereign_service import append_audit_event
    existing = _fetch_rows("authorization_audit_log", {
        "request_id": f"eq.{request['request_id']}",
        "event_type": "eq.request_created",
        "select": "id"})
    if existing:
        return
    append_audit_event(
        "request_created",
        sealed_set_id=request["sealed_set_id"],
        request_id=request["request_id"],
        actor=request.get("requested_by"),
        fingerprint=request["fingerprint"],
        detail={"lane": "method-execution", "contest_id": contest_id,
                "acknowledged_by": f"node:{node_id}"})


def run_method_request(request_id: str, *,
                       config_path: str | Path | None = None,
                       runner: Runner = subprocess.run,
                       translator=None) -> dict:
    """Execute one authorized T2 request end-to-end (connected mode), for EITHER
    lane — the bundle's ``submissionKind`` selects it:

      * ``declarative-model`` (Lane A, model_runner.py) — the bundle is DATA
        (safetensors + declarative tokenizer + config). It is validated
        code-free and run in the organizer's OWN trusted engine; no container,
        no untrusted code. ``translator`` injects the engine for tests.
      * ``runnable-bundle`` (Lane B, default; this module) — the bundle is code
        (Dockerfile + entrypoint). §3 static checks then the --network=none
        sandbox. ``runner`` injects the container runtime for tests.

    Everything else is SHARED and unchanged: fingerprint/node binding, the
    public qualifier gate re-executed on this node, bundle-digest
    verification, authorization per the contest's model, single-use grant
    claim, decrypt-secret-corpus-to-scratch, single-scorer scoring,
    aggregates-only scores-only publish, and the wipe.

    ONE authorized run covers every split the contest declared (contract
    C6/D1): the secret set, the optional sealed HOLDOUT split
    (``contests[<id>].holdout_set_id`` / ``holdout_corpus``), and every
    third-party diagnostic suite in ``contests[<id>].test_suites``. The suite
    aggregates ride the main run card (``by_test_suite``, contract C4); the
    holdout is a second card, always withheld until close (contract C5,
    ``role="holdout"``). The grant's ``grant_used`` audit detail names the
    splits it covered.

    Returns {status: 'published'|'pending'|'denied'|'failed', ...}. Denials
    carry the exact reason into the request row's audit trail.
    """
    from mt_eval_harness.contest_node import (
        _fetch_rows,
        _storage_download,
        authorize_request,
        build_scored_run_row,
        deny_request,
        extract_bundle,
        load_node_config,
        mint_and_claim_grant,
        publish_or_defer,
        resolve_secret_corpus,
        wipe_scratch_file,
    )
    from mt_eval_harness.external_scoring import HypothesesFormatError
    from mt_eval_harness.queue_runner import compute_request_fingerprint
    from mt_eval_harness.sovereign_service import service_key

    cfg = load_node_config(config_path, database=True)
    service_key()
    node_id = cfg["node_id"]

    reqs = _fetch_rows("authorization_requests", {
        "request_id": f"eq.{request_id}",
        "select": "request_id,sealed_set_id,state,fingerprint,method_sha,"
                  "corpus_id,corpus_version,node_measurement,requested_by"})
    if not reqs:
        raise SandboxError(f"No authorization request {request_id!r}.")
    request = reqs[0]
    sealed_set_id = request["sealed_set_id"]

    # Which served contest carries this secret set?
    contest_id = next(
        (cid for cid, c in cfg["contests"].items()
         if c.get("secret_set_id") == sealed_set_id), None)
    if not contest_id:
        raise SandboxError(
            f"This node serves no contest with secret_set_id "
            f"{sealed_set_id!r} — add secret_set_id/secret_artifact/"
            f"secret_privkey to the contest entry in node.json (see the "
            f"runbook's Phase B section).")
    contest_cfg = cfg["contests"][contest_id]
    for needed in ("secret_artifact", "secret_privkey"):
        if not contest_cfg.get(needed):
            raise SandboxError(
                f"contests[{contest_id}] is missing {needed} — the node "
                f"cannot decrypt the T2 corpus at scoring time.")
    contests = _fetch_rows("contests", {
        "id": f"eq.{contest_id}",
        # `metadata` carries the publication policy the publish tail obeys
        # (results_visibility — contract C5). Selected HERE so the policy is
        # read from the database once, with the contest, and never inferred.
        "select": "id,name,status,corpus_id,language_pair,"
                  "authorization_model,metadata"})
    if not contests:
        raise SandboxError(f"Contest {contest_id!r} not found on the DB.")
    contest = contests[0]
    model = contest.get("authorization_model", "per-submission")
    if model == "open":
        raise SandboxError(
            "authorization_model 'open' is for public-refs contests only — "
            "a sealed T2 execution always goes through the request/grant "
            "ceremony (blanket or per-submission).")

    def _deny(reason: str) -> dict:
        if request["state"] == "pending":
            deny_request(request_id, actor=f"node:{node_id}", reason=reason,
                         sealed_set_id=sealed_set_id)
        print(f"    ✗ {request_id}: {reason}")
        return {"status": "denied", "reason": reason}

    _audit_request_created_once(request, contest_id, node_id)

    # 1. Node-binding preflight: the fingerprint must recompute under THIS
    #    node's identity (fail closed — a grant could never bind otherwise).
    expected = compute_request_fingerprint(
        {"method_sha": request["method_sha"], "corpus_id": request["corpus_id"],
         "corpus_version": request["corpus_version"]},
        node_measurement=node_id)
    if expected != request["fingerprint"]:
        return _deny(
            f"request fingerprint is bound to node "
            f"'{request['node_measurement']}' / corpus "
            f"'{request['corpus_id']}' {request['corpus_version']}, but this "
            f"node is '{node_id}' — re-submit bound to the advertised node "
            f"id and corpus version.")

    # 2. The public gate. Resolved here (before the bundle is fetched) so a
    #    set with no active qualifier holds everything, fail-safe — the
    #    execution half runs at step 4b, once the lane is known.
    qualifier = resolve_contest_qualifier(sealed_set_id,
                                          contest.get("corpus_id"))
    if not qualifier:
        raise SandboxError(
            f"sealed set {sealed_set_id!r} has no registered qualifier — "
            f"without the public gate no sealed run may be proposed, so this "
            f"node refuses to execute any (fail-safe). Register the qualifier "
            f"(migration 042) or fix current_qualifier_id on the set.")

    # 3. Bundle: download, digest-verify against the FROZEN method_sha, extract.
    scratch = Path(cfg["scratch_dir"]).expanduser() / request_id
    object_path = f"{contest_id}/{request['requested_by']}/{request_id}.tar.gz"
    try:
        bundle_bytes = _storage_download(object_path)
    except RuntimeError as e:
        return _deny(f"method bundle could not be downloaded "
                     f"({object_path}): {e}")
    actual_sha = hashlib.sha256(bundle_bytes).hexdigest()
    if actual_sha != request["method_sha"]:
        return _deny(
            f"bundle bytes hash {actual_sha} but the request froze "
            f"method_sha {request['method_sha']} — the uploaded artifact is "
            f"not the proposed method.")
    bundle_dir = scratch / "bundle"
    tarball_path = scratch / "bundle.tar.gz"
    scratch.mkdir(parents=True, exist_ok=True)
    tarball_path.write_bytes(bundle_bytes)
    try:
        manifest = extract_bundle(bundle_bytes, bundle_dir)
    except (HypothesesFormatError, json.JSONDecodeError) as e:
        return _deny(f"bundle unreadable: {e}")

    # 4. Lane dispatch (the ONLY lane-specific step besides execution). A
    #    declarative-model bundle is validated code-free (Lane A); a runnable
    #    bundle is §3 static-checked (Lane B). A BLOCK is a denial WITH reasons.
    lane = (manifest or {}).get("submissionKind", "runnable-bundle")
    # Lane-A architecture policy is a HOST choice (permissive default, or a
    # careful allowlist): contest entry wins, else node-level, else permissive.
    arch_policy = (
        (contest_cfg.get("declarative") or {}).get("architecture_policy")
        or (cfg.get("declarative") or {}).get("architecture_policy"))
    # The prize terms this contest is CURRENTLY promising. 074 freezes them the
    # moment the contest has entries, so this is the same hash the participant
    # was shown; a bundle that accepted a different one is refused below, in
    # either lane. Unreadable terms are a refusal, not a skipped check.
    try:
        contest_terms_sha = contest_prize_terms_sha_from_row(contest)
    except SandboxError as exc:
        return _deny(str(exc))
    if lane == "declarative-model":
        from mt_eval_harness.model_runner import (
            execute_and_score_declarative,
            validate_declarative_bundle,
        )
        checks = validate_declarative_bundle(
            bundle_dir, tarball_path=tarball_path,
            expected_corpus_id=sealed_set_id,
            architecture_policy=arch_policy,
            contest_terms_sha=contest_terms_sha, contest_id=contest_id)
        block_label = "declarative validation BLOCKS this bundle (Lane A): "
        lane_execute = execute_and_score_declarative
    else:
        checks = run_static_checks(bundle_dir, tarball_path=tarball_path,
                                   expected_corpus_id=sealed_set_id,
                                   contest_terms_sha=contest_terms_sha,
                                   contest_id=contest_id)
        block_label = "static checks BLOCK this bundle (spec §3): "
        lane_execute = execute_and_score
    if checks["blocked"]:
        return _deny(block_label
                     + "; ".join(b["detail"] for b in checks["blocks"][:8]))

    # 4b. THE PUBLIC GATE, measured by this node. The submitted artifact is
    #     executed on the PUBLIC dev corpus through the same lane executor and
    #     scored by the same scorer; the participant's receipt is a claim, this
    #     is the measurement. It runs before authorization on purpose — the
    #     qualifier exists so custodians are never asked to approve a method
    #     that cannot clear the public bar, and before any grant is claimed or
    #     the sealed set is opened.
    #
    #     First, can this node run the bundle at all (Lane B)? A missing
    #     container runtime or a bundle asking for more than the node allows
    #     is RAISED, not denied — the request stays pending, so it can still
    #     run once the node is fixed or its caps are raised, and it is never
    #     recorded as a qualifier miss.
    if lane != "declarative-model":
        try:
            preflight_node_fit(
                manifest, contest_cfg.get("sandbox") or cfg.get("sandbox"),
                runner=runner)
        except ResourceRequestRefused as exc:
            raise ResourceRequestRefused(
                f"{request_id}: {exc} " + resource_refusal_next_steps(
                    exc, request_id=request_id, offline=False,
                    request_state=request["state"]),
                over=exc.over) from exc
        except NodeSetupError as exc:
            raise NodeSetupError(
                f"{request_id}: {exc} The request is unchanged (still "
                f"{request['state']}); re-run `mt-eval node run-method "
                f"{request_id}` once the node is fixed.") from exc
    gate = verify_qualifier_by_execution(
        bundle_dir, lane, contest_cfg, qualifier,
        manifest=manifest,
        work_dir=scratch / "qualifier-run",
        output_dir=Path(cfg["output_dir"]).expanduser() / request_id
        / "qualifier",
        node_id=node_id,
        language_pair=contest.get("language_pair", ">"),
        sandbox_cfg=contest_cfg.get("sandbox") or cfg.get("sandbox"),
        runner=runner, translator=translator,
        architecture_policy=arch_policy)
    if not gate["eligible"]:
        return _deny(
            f"qualifier not met on node re-execution (claimed "
            f"{gate['claimed']}, measured {gate['measured']}, threshold "
            f"{gate['threshold']}, all on the chrF++ 0-100 qualifier scale — "
            f"corpus chrF++ of the dev outputs): "
            f"{gate['reason']}")
    print(f"    ✓ {request_id}: qualifier {gate['qualifier_id']} re-executed "
          f"on this node at chrF++ {gate['measured']} ≥ {gate['threshold']} "
          f"on the chrF++ 0-100 qualifier scale (participant claimed "
          f"{gate['claimed']})")
    if gate.get("metric_note"):
        print(f"      Note: {gate['metric_note']}")
    if gate.get("receipt_gap"):
        print(f"    ⚠ {request_id}: {gate['receipt_gap']['message']}")

    # 5. Authorization per model (same D3 path as Phase A).
    if request["state"] == "pending":
        if model == "blanket":
            authorize_request(request_id, actor=f"node:{node_id}",
                              policy="blanket", sealed_set_id=sealed_set_id)
            request["state"] = "authorized"
        else:
            print(f"    ⏸ {request_id}: static checks pass; waiting for "
                  f"custodian approval — `mt-eval node approve {request_id}`")
            return {"status": "pending",
                    "reason": "awaiting custodian authorization"}
    if request["state"] != "authorized":
        raise SandboxError(
            f"request {request_id} is {request['state']!r} — only an "
            f"authorized request can execute.")
    # Contract C6/D1: ONE grant covers every split this run scores. The sets
    # are DECLARED in node.json (load_node_config already proved this machine
    # holds each file and that its bytes match the organizer's pin), so what
    # the grant covers is known before it is minted — and recorded on
    # grant_used, ids only.
    mint_and_claim_grant(request_id, request["fingerprint"], sealed_set_id,
                         node_id=node_id,
                         ttl_seconds=cfg["grant_ttl_seconds"],
                         used_detail=grant_sets_detail(contest_cfg))

    # 6.–8. Decrypt → run (sandbox OR trusted engine) → score → wipe. The
    #    corpus decrypt/wipe and the single scorer are lane-agnostic; only the
    #    executor differs (chosen at step 4).
    corpus_path = None
    holdout_path = None
    holdout_is_scratch = False
    work_dir = scratch / "run"
    try:
        corpus_path = resolve_secret_corpus(
            contest_cfg, Path(cfg["scratch_dir"]).expanduser())
        # Contract C6/C7: the OTHER sets this one authorized run covers — the
        # contest's second sealed split (practice 7) and its third-party
        # diagnostic suites (practice 14). The image/model is built or loaded
        # for the main run and every extra set is one more isolated run on it.
        holdout_path, holdout_is_scratch = resolve_holdout_corpus(
            contest_cfg, Path(cfg["scratch_dir"]).expanduser())
        extra_sets = build_extra_sets(contest_cfg,
                                      holdout_corpus=holdout_path)
        exec_kwargs = dict(
            bundle_dir=bundle_dir, corpus_path=corpus_path,
            work_dir=work_dir, sealed_set_id=sealed_set_id,
            language_pair=contest.get("language_pair", ">"),
            node_id=node_id,
            submission={"contest_id": contest_id, "request_id": request_id,
                        "submitted_by": request["requested_by"],
                        "method_sha": request["method_sha"]},
            output_dir=Path(cfg["output_dir"]).expanduser() / request_id,
            expected_corpus_id=sealed_set_id,
            extra_sets=extra_sets or None)
        if lane == "declarative-model":
            exec_kwargs["architecture_policy"] = arch_policy
            if translator is not None:
                exec_kwargs["translator"] = translator
            result = lane_execute(**exec_kwargs)
        else:
            result = lane_execute(
                sandbox_cfg=contest_cfg.get("sandbox") or cfg.get("sandbox"),
                runner=runner, **exec_kwargs)
    except SandboxError as e:
        # Executed-and-failed is NOT a custodian denial; the request stays
        # authorized (single-use grant consumed — a re-run needs a fresh
        # proposal, which is exactly the §9.4 re-run posture).
        print(f"    ✗ {request_id}: {e}")
        # Counts-only diagnostics (practice 12): the participant cannot see
        # inside a sealed node, so the STAGE and the counts are the only
        # feedback that exists. A deployment without the 074 column must not
        # turn a reported failure into an unreported one.
        diagnostics = getattr(e, "diagnostics", None) or failure_diagnostics(
            "run")
        try:
            record_execution_diagnostics(request_id, diagnostics)
        except DiagnosticsColumnMissing as de:
            print(f"    ⚠ diagnostics not recorded: {de}")
        return {"status": "failed", "reason": str(e),
                "diagnostics": diagnostics}
    finally:
        if corpus_path is not None:
            wipe_scratch_file(Path(corpus_path))
        # The holdout plaintext is transient exactly like the secret set's.
        # A holdout the node holds in the clear (a rehearsal deployment) is
        # NOT wiped — it was already there and is not this run's copy.
        if holdout_path is not None and holdout_is_scratch:
            wipe_scratch_file(Path(holdout_path))

    # 9. Scores-only egress through the EXISTING publish path (lane-aware
    #    affirmation — Lane A ran no code; Lane B ran a --network=none container).
    if lane == "declarative-model":
        affirmation = (
            f"Declarative model bundle (sha256 {request['method_sha']}) run by "
            f"organizer node '{node_id}' in its trusted inference engine "
            f"(transformers, trust_remote_code=False; NO participant code "
            f"executed) against organizer-held sealed corpus {sealed_set_id} "
            f"({request['corpus_version']}); scored by the reference holder. "
            f"Method identity is code-free by construction; node identity is "
            f"self-reported (Wave-1). Published aggregates-only.")
    else:
        affirmation = (
            f"Method bundle (sha256 {request['method_sha']}) executed by "
            f"organizer node '{node_id}' inside a network-isolated container "
            f"(--network=none) against organizer-held sealed corpus "
            f"{sealed_set_id} ({request['corpus_version']}); scored by the "
            f"reference holder. Method identity is execution-verified; node "
            f"identity is self-reported (Wave-1). Published aggregates-only.")
    # The BYLINE is the manifest's declared developer/method name, never
    # request.requested_by — that is the JWT email the request row binds for
    # RLS, and run_cards.submitter is world-readable (the board's byline).
    submitter_label = contest_declarations.submitter_label_from_manifest(
        manifest)
    submission_fields = contest_declarations.submission_fields_from_manifest(
        manifest)
    row, card_id = build_scored_run_row(
        result["report_path"], submitter=submitter_label,
        node_id=node_id, affirmation=affirmation)
    # Contract C5: the contest's OWN publication policy decides whether this
    # card reaches the board now or is withheld until close. Under
    # results_visibility='hidden_until_close' nothing is inserted into
    # run_cards here — the assembled row is parked in contest_deferred_results
    # and `mt-eval contest close` publishes it before freezing the ranking.
    outcome = publish_or_defer(
        row,
        contest=contest,
        request_id=request_id,
        requested_by=request["requested_by"],
        notes=f"organizer-node executed ({request_id})",
        sealed_set_id=sealed_set_id,
        submission_fields=submission_fields,
    )
    # The standard headline (scoring.format_primary): corpus chrF++ with its
    # 95% bootstrap CI on the sealed set — no composite, no tier.
    _scored = _sealed_headline(result)
    if outcome["outcome"] == "published":
        print(f"    ✅ {request_id}: published {card_id} "
              f"({_scored}; {lane} lane, aggregates-only, trust=verified)")
    else:
        print(f"    ⏳ {request_id}: scored ({_scored}; {lane} lane) — "
              f"withheld until contest {contest_id} closes.")
    # Practice 7 — the second sealed split. It was scored inside the SAME
    # authorized run (contract C6/D1) and is published on its OWN card, always
    # WITHHELD until the contest closes (``force_defer=True``): a holdout
    # number visible while the contest runs is just a second leaderboard.
    holdout_outcome = None
    holdout_result = result.get("holdout")
    if holdout_result:
        holdout_set_id = contest_cfg.get("holdout_set_id")
        h_row, h_card_id = build_scored_run_row(
            holdout_result["report_path"], submitter=submitter_label,
            node_id=node_id,
            affirmation=(
                f"{affirmation} HOLDOUT SPLIT: this card scores sealed set "
                f"{holdout_set_id}, the contest's second sealed split, "
                f"executed in the same authorized run as {sealed_set_id} "
                f"(one grant, both splits) and withheld until the contest "
                f"closes."))
        holdout_outcome = publish_or_defer(
            h_row,
            contest=contest,
            # Derived key: contest_deferred_results is keyed by request_id and
            # this request may already have parked its MAIN result there. The
            # real request id travels in submission_fields below, which is
            # what the contest_submissions foreign key sees.
            request_id=holdout_defer_key(request_id),
            requested_by=request["requested_by"],
            notes=f"organizer-node executed ({request_id})",
            role="holdout",
            force_defer=True,
            sealed_set_id=holdout_set_id,
            submission_fields={
                **submission_fields,
                # A holdout card is a SECOND RESULT of one entry, not a second
                # entry: migration 074 allows one primary per team per contest
                # (idx_cs_one_primary), and claiming this row as the team's
                # primary would take that slot from their actual entry.
                "is_primary": False,
                "authorization_request_id": request_id,
            },
        )
        _h_scored = _sealed_headline(holdout_result)
        print(f"    ⏳ {request_id}: holdout {holdout_set_id} scored "
              f"({_h_scored}; run card {h_card_id}) — withheld until contest "
              f"{contest_id} closes.")

    diagnostics = result.get("diagnostics")
    if diagnostics is not None:
        try:
            record_execution_diagnostics(request_id, diagnostics)
        except DiagnosticsColumnMissing as de:
            print(f"    ⚠ diagnostics not recorded: {de}")
    return {"status": outcome["outcome"],
            "run_card_id": outcome["run_card_id"],
            "results_visibility": outcome["results_visibility"],
            # corpus chrF++ (0-100) on the sealed set — the standard
            # headline; the key name predates the standard.
            "qualifier_score": result["qualifier_score"],
            "chrf_plus_plus": result.get("chrf_plus_plus"),
            "execution": result.get("execution"),
            "by_test_suite": result.get("by_test_suite") or {},
            "holdout": holdout_outcome,
            "diagnostics": diagnostics}
