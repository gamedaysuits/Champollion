"""airgap_ops — offline bundle, IN/OUT drive manifests, egress self-check.

The tooling half of the node spec's operating discipline
(cli/website/docs/network/sovereignty/sovereign-eval-node.md §2/§3):

  * `mt-eval node bundle`   — build the offline install bundle ON AN ONLINE
    machine (wheels for mt-eval[node] + any pinned artifacts + a sha256
    manifest); verify mode re-hashes everything on the node before install.
  * `mt-eval node manifest` — write/verify a drive manifest for the IN and
    OUT drives, so every crossing of the air gap is evidence, not memory.
  * `mt-eval node egress-check` / :func:`assert_airgapped` — the executor's
    self-check that this machine has no route out, run before a sealed run.

EGRESS CHECK, HONESTLY: it proves the absence of a default route and that
TCP probes + DNS fail RIGHT NOW. It cannot prove a radio will not come up
later, or that a second interface is not sleeping — the §1 hardware
discipline (no radios, cable unplugged) is the operator's half of the
guarantee. The check refuses on ANY sign of connectivity (fail-closed).
"""

from __future__ import annotations

import hashlib
import json
import platform
import socket
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

__all__ = [
    "EgressError", "egress_check", "assert_airgapped",
    "build_offline_bundle", "verify_bundle",
    "write_drive_manifest", "verify_drive_manifest",
]

# Well-known, operator-recognizable probe targets (no DNS needed).
_DEFAULT_PROBES = (("1.1.1.1", 443), ("8.8.8.8", 53))
_PROBE_TIMEOUT = 1.5


class EgressError(RuntimeError):
    """The machine can (or might) reach the internet — with the evidence."""


# ---------------------------------------------------------------------------
# Egress self-check.
# ---------------------------------------------------------------------------

def _default_route_present(run_cmd=subprocess.run):
    """True/False when determinable; None when the platform tool is absent
    (counted as NOT-proven-airgapped by the caller — fail closed)."""
    try:
        if sys.platform == "darwin":
            proc = run_cmd(["route", "-n", "get", "default"],
                           capture_output=True, text=True, timeout=10)
            return proc.returncode == 0 and "gateway" in (proc.stdout or "")
        if sys.platform.startswith("linux"):
            proc = run_cmd(["ip", "route", "show", "default"],
                           capture_output=True, text=True, timeout=10)
            return proc.returncode == 0 and bool((proc.stdout or "").strip())
    except (OSError, subprocess.TimeoutExpired):
        return None
    return None


def egress_check(*, probes=_DEFAULT_PROBES, timeout=_PROBE_TIMEOUT,
                 run_cmd=subprocess.run,
                 connector=socket.create_connection,
                 resolver=socket.getaddrinfo) -> dict:
    """Point-in-time egress report. ``airgapped`` is True ONLY when the
    default route is absent AND every probe fails AND DNS fails."""
    route = _default_route_present(run_cmd)
    probe_results = []
    for host, port in probes:
        connected = False
        try:
            conn = connector((host, port), timeout)
            conn.close()
            connected = True
        except OSError:
            connected = False
        probe_results.append({"target": f"{host}:{port}",
                              "connected": connected})
    dns_resolved = False
    try:
        resolver("example.com", 443)
        dns_resolved = True
    except OSError:
        dns_resolved = False

    airgapped = (route is False
                 and not any(p["connected"] for p in probe_results)
                 and not dns_resolved)
    return {
        "airgapped": airgapped,
        "default_route": route,          # True/False/None(undeterminable)
        "probes": probe_results,
        "dns_resolved": dns_resolved,
        "platform": sys.platform,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "honest_note": (
            "Point-in-time check: proves no current route/connectivity, "
            "not that a radio cannot come up later. The hardware "
            "discipline (no radios, cable unplugged) is the operator's "
            "half — node spec §1."),
    }


def assert_airgapped(report: dict | None = None, **kw) -> dict:
    """Raise EgressError (with the evidence) unless the machine shows NO
    sign of connectivity. Undeterminable route counts as failure — a
    machine that cannot prove its isolation does not run a sealed set."""
    report = report or egress_check(**kw)
    if report["airgapped"]:
        return report
    evidence = []
    if report["default_route"] is True:
        evidence.append("a default route exists")
    elif report["default_route"] is None:
        evidence.append("the default route could not be determined "
                        "(fail-closed)")
    evidence += [f"TCP connect to {p['target']} SUCCEEDED"
                 for p in report["probes"] if p["connected"]]
    if report["dns_resolved"]:
        evidence.append("DNS resolution SUCCEEDED")
    raise EgressError(
        "This machine is NOT provably air-gapped: " + "; ".join(evidence)
        + ". A sealed run refuses to start here (fail-closed). Unplug the "
          "cable / disable radios and re-run `mt-eval node egress-check`.")


# ---------------------------------------------------------------------------
# Hashing helpers (shared by bundle + drive manifests).
# ---------------------------------------------------------------------------

def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _hash_tree(root: Path, exclude: set[str]) -> dict:
    files = {}
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.name in exclude:
            continue
        rel = p.relative_to(root).as_posix()
        files[rel] = {"sha256": _sha256_file(p), "bytes": p.stat().st_size}
    return files


def _compare_tree(root: Path, recorded: dict, exclude: set[str]) -> dict:
    actual = _hash_tree(root, exclude)
    missing = sorted(set(recorded) - set(actual))
    added = sorted(set(actual) - set(recorded))
    changed = sorted(r for r in set(recorded) & set(actual)
                     if recorded[r]["sha256"] != actual[r]["sha256"])
    return {"ok": not (missing or added or changed), "missing": missing,
            "added": added, "changed": changed, "counted": len(actual)}


# ---------------------------------------------------------------------------
# Offline install bundle.
# ---------------------------------------------------------------------------

BUNDLE_MANIFEST = "bundle-manifest.json"

_INSTALL_MD = """\
# Offline install (on the air-gapped node)

1. Verify this bundle FIRST, on the node:
       mt-eval node bundle --verify .        # if mt-eval is already present
   or, before mt-eval exists on the node, re-hash by hand:
       shasum -a 256 -c   # against bundle-manifest.json entries
2. Install from the bundled wheels only (no index, no network):
       python3 -m pip install --no-index --find-links wheels 'mt-eval[node]'
3. Any extra artifacts travel under artifacts/ — verify their sha256
   against the manifest before use.

Built {created_at} on {platform} / Python {python}. The bundle carries
exactly what the manifest lists; anything else on this drive is not part
of the verified set.
"""


DEFAULT_NODE_CONSTRAINTS = "constraints-node.txt"


def build_offline_bundle(dest: str | Path, *,
                         project_dir: str | Path | None = None,
                         extras: tuple[str, ...] = (),
                         include: tuple[str, ...] = (),
                         constraints: str | Path | None = None,
                         runner=subprocess.run,
                         skip_pip: bool = False) -> dict:
    """Build the offline bundle: wheel mt-eval (+base deps) AND the
    hash-pinned cryptography closure into ``dest/wheels``, copy ``include``
    artifacts into ``dest/artifacts``, then hash EVERYTHING into
    bundle-manifest.json.

    Supply chain (red-team F4): the cryptography closure — the security-
    critical dependency of the sovereign lane — is fetched in a SEPARATE
    ``pip wheel --require-hashes --only-binary=:all: -r <constraints>`` call,
    so a compromised mirror or a dependency-confusion swap fails the hash
    check before anything is bundled. ``constraints`` defaults to
    ``<arena>/constraints-node.txt`` (regenerate per platform with
    ``arena/scripts/gen-node-constraints.sh``); pass ``constraints=""`` only
    for an explicitly-unpinned build. ``extras`` still selects project extras
    for the base wheel call, but 'node' is intentionally NOT the default —
    cryptography comes from the pinned call, not the unpinned one.

    Run this on an ONLINE machine; the result crosses on the IN drive.
    ``skip_pip`` builds a manifest over an existing tree (tests / re-stamp).
    """
    dest = Path(dest).expanduser()
    wheels = dest / "wheels"
    wheels.mkdir(parents=True, exist_ok=True)

    if not skip_pip:
        if project_dir is None:
            # arena/ — the directory that holds pyproject.toml for mt-eval.
            project_dir = Path(__file__).resolve().parents[2]
        # 1. mt-eval + its base deps (version-range, our own source tree).
        req = str(project_dir)
        if extras:
            req += f"[{','.join(extras)}]"
        cmd = [sys.executable, "-m", "pip", "wheel", "--wheel-dir",
               str(wheels), req]
        print(f"  $ {' '.join(cmd)}")
        proc = runner(cmd, capture_output=True, text=True, timeout=1800)
        if proc.returncode != 0:
            raise RuntimeError(
                f"pip wheel failed — no bundle written:\n"
                f"{(proc.stderr or proc.stdout or '')[-2000:]}")

        # 2. The cryptography closure, HASH-PINNED. `""` opts out explicitly;
        # None uses the committed constraints file and fails loud if absent.
        if constraints is None:
            constraints = Path(project_dir) / DEFAULT_NODE_CONSTRAINTS
        if constraints == "":
            print("  ⚠ building the cryptography closure UNPINNED "
                  "(constraints=''): the bundle attests transfer, not "
                  "provenance. Prefer arena/constraints-node.txt.")
            ccmd = [sys.executable, "-m", "pip", "wheel", "--wheel-dir",
                    str(wheels), "cryptography>=42,<50"]
        else:
            cpath = Path(constraints).expanduser()
            if not cpath.is_file():
                raise RuntimeError(
                    f"node constraints file not found: {cpath}. Regenerate it "
                    f"with arena/scripts/gen-node-constraints.sh, or pass "
                    f"constraints='' to build the cryptography closure "
                    f"UNPINNED (not recommended).")
            ccmd = [sys.executable, "-m", "pip", "wheel", "--wheel-dir",
                    str(wheels), "--require-hashes", "--only-binary=:all:",
                    "-r", str(cpath)]
        print(f"  $ {' '.join(ccmd)}")
        cproc = runner(ccmd, capture_output=True, text=True, timeout=1800)
        if cproc.returncode != 0:
            raise RuntimeError(
                f"pip wheel (cryptography closure, hash-pinned) failed — no "
                f"bundle written. A hash mismatch here is fail-closed: the "
                f"wheel did not match arena/constraints-node.txt (wrong "
                f"platform/python → regenerate; otherwise investigate).\n"
                f"{(cproc.stderr or cproc.stdout or '')[-2000:]}")

    if include:
        import shutil
        artifacts = dest / "artifacts"
        artifacts.mkdir(parents=True, exist_ok=True)
        for item in include:
            src = Path(item).expanduser()
            if not src.exists():
                raise RuntimeError(f"--include {src}: not found — refusing "
                                   f"to write a bundle with missing pieces.")
            target = artifacts / src.name
            if src.is_dir():
                shutil.copytree(src, target, dirs_exist_ok=True)
            else:
                shutil.copy2(src, target)

    manifest = {
        "champollionBundle": "1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "builtOn": {"platform": platform.platform(),
                    "python": platform.python_version()},
        "files": _hash_tree(dest, exclude={BUNDLE_MANIFEST}),
        "_note": ("Offline install bundle for a sovereign eval node. "
                  "Verify every sha256 ON THE NODE before installing "
                  "(node spec §2 step 3)."),
    }
    (dest / BUNDLE_MANIFEST).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True)
        + "\n", encoding="utf-8")
    (dest / "INSTALL.md").write_text(_INSTALL_MD.format(
        created_at=manifest["createdAt"],
        platform=manifest["builtOn"]["platform"],
        python=manifest["builtOn"]["python"]), encoding="utf-8")
    # INSTALL.md is written after hashing → re-stamp it into the manifest.
    manifest["files"]["INSTALL.md"] = {
        "sha256": _sha256_file(dest / "INSTALL.md"),
        "bytes": (dest / "INSTALL.md").stat().st_size}
    (dest / BUNDLE_MANIFEST).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True)
        + "\n", encoding="utf-8")
    n = len(manifest["files"])
    print(f"  Bundle at {dest}: {n} file(s) hashed into {BUNDLE_MANIFEST}.")
    print(f"  Carry on the IN drive; verify ON THE NODE with "
          f"`mt-eval node bundle --verify {dest.name or '.'}`.")
    return manifest


def verify_bundle(dest: str | Path) -> dict:
    dest = Path(dest).expanduser()
    mpath = dest / BUNDLE_MANIFEST
    if not mpath.is_file():
        raise RuntimeError(f"{dest} has no {BUNDLE_MANIFEST} — not a bundle "
                           f"(or the manifest was stripped in transit).")
    manifest = json.loads(mpath.read_text(encoding="utf-8"))
    report = _compare_tree(dest, manifest.get("files", {}),
                           exclude={BUNDLE_MANIFEST})
    if report["ok"]:
        print(f"  ✅ bundle verified: {report['counted']} file(s) match "
              f"{BUNDLE_MANIFEST}.")
    else:
        for r in report["missing"]:
            print(f"  ✗ MISSING: {r}")
        for r in report["changed"]:
            print(f"  ✗ CHANGED: {r}")
        for r in report["added"]:
            print(f"  ⚠ not in manifest: {r}")
        print(f"  ✗ bundle verification FAILED — do not install from this "
              f"drive.")
    return report


# ---------------------------------------------------------------------------
# IN/OUT drive manifests (transfer discipline, node spec §3).
# ---------------------------------------------------------------------------

DRIVE_MANIFEST = "drive-manifest.json"


def write_drive_manifest(drive_dir: str | Path, *, direction: str,
                         node_id: str, note: str | None = None) -> dict:
    direction = str(direction).upper()
    if direction not in ("IN", "OUT"):
        raise ValueError("direction must be IN or OUT — one direction per "
                         "drive, ever (node spec §3).")
    root = Path(drive_dir).expanduser()
    if not root.is_dir():
        raise RuntimeError(f"{root} is not a directory.")
    files = _hash_tree(root, exclude={DRIVE_MANIFEST})
    manifest = {
        "champollionDriveManifest": "1",
        "direction": direction,
        "nodeId": node_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "files": files,
        "totalFiles": len(files),
        "totalBytes": sum(f["bytes"] for f in files.values()),
        "note": note,
        "_note": ("Drive-crossing manifest. Log this file's sha256 in the "
                  "node's crossing log; verify on the receiving side with "
                  "`mt-eval node manifest verify`. One direction per "
                  "drive, ever."),
    }
    (root / DRIVE_MANIFEST).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True)
        + "\n", encoding="utf-8")
    msha = _sha256_file(root / DRIVE_MANIFEST)
    print(f"  {direction} drive manifest: {manifest['totalFiles']} file(s), "
          f"{manifest['totalBytes']} bytes.")
    print(f"  Log this crossing: manifest sha256 {msha}")
    return manifest


def verify_drive_manifest(drive_dir: str | Path) -> dict:
    root = Path(drive_dir).expanduser()
    mpath = root / DRIVE_MANIFEST
    if not mpath.is_file():
        raise RuntimeError(f"{root} has no {DRIVE_MANIFEST} — refuse the "
                           f"drive (nothing on it is verifiable).")
    manifest = json.loads(mpath.read_text(encoding="utf-8"))
    report = _compare_tree(root, manifest.get("files", {}),
                           exclude={DRIVE_MANIFEST})
    report["direction"] = manifest.get("direction")
    report["nodeId"] = manifest.get("nodeId")
    if report["ok"]:
        print(f"  ✅ {manifest.get('direction')} drive verified: "
              f"{report['counted']} file(s) match the manifest "
              f"(written by {manifest.get('nodeId')}).")
    else:
        for r in report["missing"]:
            print(f"  ✗ MISSING: {r}")
        for r in report["changed"]:
            print(f"  ✗ CHANGED: {r}")
        for r in report["added"]:
            print(f"  ⚠ NOT IN MANIFEST (added in transit?): {r}")
        print("  ✗ drive verification FAILED — treat the drive as "
              "untrusted; nothing on it should run or publish.")
    return report
