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
import re
import shutil
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

from mt_eval_harness.method_bundle import (
    TARBALL_LIMIT_BYTES,
    manifest_consistency_findings,
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


class SandboxError(RuntimeError):
    """A sandbox run that cannot proceed / produced no score — with the reason."""


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
                      expected_corpus_id: str | None = None) -> dict:
    """§3 in spec order: manifest → network scan → fs audit → size limits.

    Returns {findings, blocked, blocks, warns}. The caller decides what a
    BLOCK means (node: deny the request WITH the reasons; CLI: refuse upload).
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

def find_container_runtime(preferred: str | None = None) -> str:
    """docker → podman, or the configured runtime. Fails loud (§6.1)."""
    candidates = [preferred] if preferred else ["docker", "podman"]
    for c in candidates:
        if c and shutil.which(c):
            return c
    raise SandboxError(
        "No container runtime found (looked for "
        f"{', '.join(c for c in candidates if c)}). The sandbox REQUIRES "
        "container isolation with --network=none (spec §6) — install docker "
        "or podman, or set sandbox.runtime in the node config. There is no "
        "no-container fallback; running untrusted method code bare would "
        "void every guarantee this lane makes.")


def enforce_resource_caps(requirements: dict, sandbox_cfg: dict) -> dict:
    """Clamp manifest §2.1 requirements against the node's §6.2 caps.

    A request EXCEEDING a cap fails loud (the organizer's machine is the
    limit; silently clamping would run the method under conditions its
    developer said are insufficient)."""
    cfg = {**DEFAULT_SANDBOX_CFG, **(sandbox_cfg or {})}
    ram = float(requirements.get("ramGB", 8) or 8)
    tmp = float(requirements.get("diskGB", 10) or 10)
    minutes = float(requirements.get("maxRuntimeMinutes", 120) or 120)
    gpu = bool(requirements.get("gpu"))
    if ram > cfg["max_ram_gb"]:
        raise SandboxError(
            f"method requires {ram} GB RAM but this node caps at "
            f"{cfg['max_ram_gb']} GB (sandbox.max_ram_gb).")
    if tmp > cfg["max_tmp_gb"]:
        raise SandboxError(
            f"method requires {tmp} GB scratch but this node caps at "
            f"{cfg['max_tmp_gb']} GB (§3.4 ceiling {TMP_LIMIT_GB} GB).")
    if minutes > cfg["max_runtime_minutes"]:
        raise SandboxError(
            f"method requires {minutes} min runtime but this node caps at "
            f"{cfg['max_runtime_minutes']} min.")
    if gpu and not cfg.get("gpus"):
        raise SandboxError(
            "method requires a GPU but this node has none configured "
            "(sandbox.gpus) — refusing rather than running a config the "
            "developer declared insufficient.")
    return {"ram_gb": ram, "tmp_gb": tmp, "minutes": minutes, "gpu": gpu,
            "cpus": cfg["cpus"], "pids_limit": cfg["pids_limit"],
            "build_timeout": cfg["build_timeout_seconds"]}


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
    or oversized output — every §8 failure mode, loudly.
    """
    bundle_dir = Path(bundle_dir)
    work_dir = Path(work_dir)
    sandbox_cfg = {**DEFAULT_SANDBOX_CFG, **(sandbox_cfg or {})}
    caps = enforce_resource_caps(manifest.get("requirements") or {},
                                 sandbox_cfg)
    runtime = (sandbox_cfg.get("runtime")
               or find_container_runtime())
    entrypoint = manifest["method"]["entrypoint"]

    n_sources = write_source_file(corpus_path, work_dir / "eval")
    output_dir = work_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    method_sha12 = hashlib.sha256(
        json.dumps(manifest, sort_keys=True).encode()).hexdigest()[:12]
    tag = f"mteval-method-{method_sha12}"
    container_name = f"mteval-run-{uuid.uuid4().hex[:12]}"

    started = time.monotonic()
    build = runner(build_image_argv(runtime, tag, bundle_dir),
                   capture_output=True, text=True,
                   timeout=caps["build_timeout"])
    if build.returncode != 0:
        raise SandboxError(
            f"--network=none image build failed (§3.3 — dependencies must be "
            f"vendored):\n{(build.stderr or build.stdout or '')[-2000:]}")

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
                    f"{IMAGE_LIMIT_BYTES}-byte limit (§3.4).")
        except ValueError:
            pass  # runtime formats differ; the limit check is best-available

    argv = run_container_argv(
        runtime, tag, container_name=container_name,
        eval_dir=work_dir / "eval", method_dir=bundle_dir / "method",
        output_dir=output_dir, entrypoint=entrypoint, caps=caps)
    try:
        proc = runner(argv, capture_output=True, text=True,
                      timeout=caps["minutes"] * 60 + 60)
    except subprocess.TimeoutExpired:
        runner([runtime, "rm", "-f", container_name],
               capture_output=True, text=True, timeout=60)
        raise SandboxError(
            f"method exceeded its {caps['minutes']}-minute wall clock — "
            f"container killed, no score produced (§8 failure modes).")
    elapsed = time.monotonic() - started

    if proc.returncode != 0:
        raise SandboxError(
            f"method exited {proc.returncode} — no score produced (§2.2). "
            f"stderr tail:\n{(proc.stderr or '')[-2000:]}")

    translations = output_dir / "translations.txt"
    if not translations.is_file():
        raise SandboxError(
            "method produced no /output/translations.txt — no score "
            "produced (§8 failure modes).")
    out_bytes = sum(p.stat().st_size for p in output_dir.rglob("*")
                    if p.is_file())
    if out_bytes > OUTPUT_LIMIT_BYTES:
        raise SandboxError(
            f"/output holds {out_bytes} bytes — over the "
            f"{OUTPUT_LIMIT_BYTES}-byte limit (§3.4).")

    return {
        "translations_path": str(translations),
        "runtime_seconds": round(elapsed, 3),
        "runtime": runtime,
        "image_tag": tag,
        "container_name": container_name,
        "source_count": n_sources,
        "output_bytes": out_bytes,
    }


# ---------------------------------------------------------------------------
# §8 — teardown.
# ---------------------------------------------------------------------------

def wipe_tree(path: str | Path) -> None:
    """Overwrite-then-delete every file under ``path``, then remove it.

    Best-effort zeros pass (§8 step 3 defense-in-depth; a failure is
    REPORTED, never swallowed silently into a claim of success)."""
    root = Path(path)
    if not root.exists():
        return
    for p in sorted(root.rglob("*"), reverse=True):
        try:
            if p.is_file() and not p.is_symlink():
                size = p.stat().st_size
                with open(p, "r+b") as fh:
                    fh.write(b"\0" * size)
                p.unlink()
            elif p.is_dir():
                p.rmdir()
            else:
                p.unlink()
        except OSError as exc:
            print(f"    ⚠ wipe: could not remove {p}: {exc}")
    try:
        root.rmdir()
    except OSError:
        pass


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
                      expected_corpus_id: str | None = None) -> dict:
    """Static checks → §7 execution → single-scorer scoring. Returns the
    score_hypotheses result dict + execution facts (+ static check summary).

    Raises SandboxError with the blocking findings if §3 fails — the caller
    turns that into a denial WITH reasons. Teardown always runs.
    """
    from mt_eval_harness.external_scoring import (
        METHOD_EXECUTION_CONDITION,
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
        src, _, tgt = (language_pair or ">").partition(">")
        card = build_executed_method_card(
            system_label=method["name"],
            method_class=method["class"],
            paradigm=method.get("paradigm"),
            description=method.get("description", ""),
            method_sha=method_sha or (submission or {}).get("method_sha", ""),
            node_id=node_id,
        )
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
        )
        result["execution"] = exec_facts
        result["static_checks"] = {
            "blocks": 0, "warns": len(checks["warns"]),
        }
        result["method_card"] = card
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
# `mt-eval node run-method` — the CONNECTED-mode orchestrator (§5→§9).
# The true-airgap variant lives in airgap_transport.py and shares everything
# above; only intake (files vs bucket) and egress (signed bundle vs publish)
# differ.
# ---------------------------------------------------------------------------

def verify_t1_standing(contest_id: str, submitter: str) -> Optional[dict]:
    """The NODE'S OWN check (service role) that the submitter holds a
    published T1 record — the participant CLI check was a preview; this
    verdict gates (same doctrine as the qualifier re-score)."""
    from mt_eval_harness.contest_node import _fetch_rows
    rows = _fetch_rows("contest_intake", {
        "contest_id": f"eq.{contest_id}",
        "submitted_by": f"eq.{submitter}",
        "status": "eq.published",
        "select": "intake_id,run_card_id"})
    return rows[0] if rows else None


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

    Everything else is SHARED and unchanged: fingerprint/node binding, T1
    standing, bundle-digest verification, authorization per the contest's
    model, single-use grant claim, decrypt-secret-corpus-to-scratch,
    single-scorer scoring, aggregates-only scores-only publish, and the wipe.

    Returns {status: 'published'|'pending'|'denied'|'failed', ...}. Denials
    carry the exact reason into the request row's audit trail.
    """
    from mt_eval_harness.contest_node import (
        _fetch_rows,
        _storage_download,
        authorize_request,
        deny_request,
        extract_bundle,
        load_node_config,
        mint_and_claim_grant,
        publish_scored_run,
        resolve_secret_corpus,
        wipe_scratch_file,
    )
    from mt_eval_harness.external_scoring import HypothesesFormatError
    from mt_eval_harness.queue_runner import compute_request_fingerprint
    from mt_eval_harness.sovereign_service import service_key, service_request

    cfg = load_node_config(config_path)
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
        "select": "id,name,status,language_pair,authorization_model"})
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

    # 2. T1 standing — the node's own records; its verdict gates.
    standing = verify_t1_standing(contest_id, request.get("requested_by", ""))
    if not standing:
        return _deny(
            f"{request.get('requested_by')!r} has no PUBLISHED T1 "
            f"(hypotheses-lane) record for contest {contest_id!r} — the "
            f"method lane is gated on T1 standing.")

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
    if lane == "declarative-model":
        from mt_eval_harness.model_runner import (
            execute_and_score_declarative,
            validate_declarative_bundle,
        )
        checks = validate_declarative_bundle(
            bundle_dir, tarball_path=tarball_path,
            expected_corpus_id=sealed_set_id,
            architecture_policy=arch_policy)
        block_label = "declarative validation BLOCKS this bundle (Lane A): "
        lane_execute = execute_and_score_declarative
    else:
        checks = run_static_checks(bundle_dir, tarball_path=tarball_path,
                                   expected_corpus_id=sealed_set_id)
        block_label = "static checks BLOCK this bundle (spec §3): "
        lane_execute = execute_and_score
    if checks["blocked"]:
        return _deny(block_label
                     + "; ".join(b["detail"] for b in checks["blocks"][:8]))

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
    mint_and_claim_grant(request_id, request["fingerprint"], sealed_set_id,
                         node_id=node_id,
                         ttl_seconds=cfg["grant_ttl_seconds"])

    # 6.–8. Decrypt → run (sandbox OR trusted engine) → score → wipe. The
    #    corpus decrypt/wipe and the single scorer are lane-agnostic; only the
    #    executor differs (chosen at step 4).
    corpus_path = None
    work_dir = scratch / "run"
    try:
        corpus_path = resolve_secret_corpus(
            contest_cfg, Path(cfg["scratch_dir"]).expanduser())
        exec_kwargs = dict(
            bundle_dir=bundle_dir, corpus_path=corpus_path,
            work_dir=work_dir, sealed_set_id=sealed_set_id,
            language_pair=contest.get("language_pair", ">"),
            node_id=node_id,
            submission={"contest_id": contest_id, "request_id": request_id,
                        "submitted_by": request["requested_by"],
                        "method_sha": request["method_sha"]},
            output_dir=Path(cfg["output_dir"]).expanduser() / request_id,
            expected_corpus_id=sealed_set_id)
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
        return {"status": "failed", "reason": str(e)}
    finally:
        if corpus_path is not None:
            wipe_scratch_file(Path(corpus_path))

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
    card_id = publish_scored_run(
        result["report_path"], submitter=request["requested_by"],
        node_id=node_id, affirmation=affirmation)
    service_request(
        "POST", "contest_submissions", data={
            "contest_id": contest_id,
            "run_card_id": card_id,
            "submitted_by": request["requested_by"],
            "notes": f"organizer-node executed ({request_id})",
        }, prefer="return=representation,resolution=ignore-duplicates")
    print(f"    ✅ {request_id}: published {card_id} "
          f"(composite {result['qualifier_score']}, {lane} lane, "
          f"aggregates-only, trust=verified)")
    return {"status": "published", "run_card_id": card_id,
            "qualifier_score": result["qualifier_score"],
            "execution": result.get("execution")}
