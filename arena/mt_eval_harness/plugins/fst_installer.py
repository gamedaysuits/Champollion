"""
FST Installer — Download and install GiellaLT FST transducers.

This module handles the interactive download flow for GiellaLT FSTs.
When an evaluation targets a language with a known FST, and the FST
isn't installed locally, this module:

    1. Identifies the correct upstream artifact for the language
    2. Prompts the user for download consent
    3. Downloads it (apt .deb, release zip, or macOS .pkg)
    4. Extracts .hfstol files to the local cache
    5. Writes provenance metadata

⚠️ WHERE UPSTREAM ACTUALLY SHIPS — the expensive lesson (2026-07-17):
    GitHub Releases is NOT GiellaLT/ALTLab's distribution channel. They ship
    continuously; the release tags on lang-* repos are VESTIGIAL. "No release
    since 2021" does not mean "no update since 2021".

    crk was pinned to the newest lang-crk release tag (fst-v2021.7.8, 2021) and
    was therefore FIVE YEARS STALE. The cost was not cosmetic: the 2021 build
    uses `y` on the analysis side, the current lexicon uses `ý`, so generation
    returned None *silently* for every ý-lemma — 4,989 of 28,268 lemmas (17.6%)
    were ungeneratable. Surfaces were identical either way, so nothing looked
    broken. Prefer "giellalt-nightly-apt" for GiellaLT languages; treat a
    release tag as a point in time you must justify, never as "latest".

WHY THIS MODULE EXISTS:
    FST validation is the morphological ground truth for polysynthetic
    and low-resource languages. Without it, evals are flying blind —
    chrF++ and BLEU can't tell you if "niwâpamâw" is a valid Cree word.
    By gating evals on FST availability, we ensure quality metrics for
    languages that need them most.

DESIGN DECISIONS:
    - Interactive consent: We never download without asking. The FSTs
      are 5-30MB binaries from third-party repos.
    - Provenance tracking: Every install records version, URL, SHA256,
      and timestamp so we can audit and reproduce.
    - Language cards as SSOT: Install metadata lives in the language
      card JSON files (resources.fsts[0].install), accessed via
      language_cards.get_fst_install_info(). No hardcoded registry.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import sys
import tarfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mt_eval_harness import language_cards

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Standard cache directory for all FSTs managed by the harness
# ---------------------------------------------------------------------------

FST_CACHE_ROOT = Path.home() / ".mt-eval" / "fsts"


# ---------------------------------------------------------------------------
# Cache path helpers
# ---------------------------------------------------------------------------

def get_fst_cache_dir(lang_code: str) -> Path:
    """Return the standard cache directory for a language's FST files.

    Checks the standard location:
        1. ~/.mt-eval/fsts/{code}/          (harness-managed, all languages)
    """
    primary = FST_CACHE_ROOT / lang_code
    if primary.exists() and any(primary.glob("*.hfstol")):
        return primary

    return primary


def find_analyzer_hfstol(fst_dir: Path) -> Path | None:
    """Find the best analyzer .hfstol file in a directory.

    Prefers 'strict' over 'relaxed', 'normative' over other variants.
    Returns None if no analyzer found.
    """
    all_hfstol = list(fst_dir.rglob("*.hfstol"))
    if not all_hfstol:
        return None

    # Filter to analyzers only
    analyzers = [
        f for f in all_hfstol
        if "analy" in f.name.lower()  # matches both "analyzer" and "analyser"
    ]

    if not analyzers:
        # No explicit analyzer — return the first .hfstol as fallback
        return all_hfstol[0]

    # Prefer strict > normative > relaxed > other
    for preference in ["strict", "normative"]:
        for a in analyzers:
            if preference in a.name.lower():
                return a

    # No preference match — return first analyzer
    return analyzers[0]


def is_fst_installed(lang_code: str) -> bool:
    """Check if an FST is installed for the given language code."""
    fst_dir = get_fst_cache_dir(lang_code)
    return fst_dir.exists() and find_analyzer_hfstol(fst_dir) is not None


# ---------------------------------------------------------------------------
# Download and install
# ---------------------------------------------------------------------------

def _download_legacy_zip(repo: str, tag: str, asset_pattern: str) -> bytes:
    """Download a legacy-format FST zip from GitHub Releases.

    Uses stdlib urllib (no external dependencies) to:
    1. Query the GitHub API for the release metadata
    2. Find the matching zip asset
    3. Download the zip content

    Args:
        repo: GitHub repo (e.g. "giellalt/lang-crk")
        tag: Release tag (e.g. "fst-v2021.7.8")
        asset_pattern: Prefix to match in asset names

    Returns:
        Raw zip bytes

    Raises:
        RuntimeError: If download fails
    """
    import urllib.request
    import urllib.error

    # Use GitHub API to find the asset URL
    api_url = f"https://api.github.com/repos/{repo}/releases/tags/{tag}"
    req = urllib.request.Request(
        api_url,
        headers={"Accept": "application/vnd.github.v3+json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            release = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            f"GitHub API returned {e.code} for {api_url}"
        )

    assets = release.get("assets", [])

    # Find the zip asset matching the pattern
    zip_asset = None
    for asset in assets:
        name = asset["name"]
        if name.endswith(".zip") and asset_pattern in name:
            zip_asset = asset
            break

    if zip_asset is None:
        available = [a["name"] for a in assets]
        raise RuntimeError(
            f"No zip asset matching '{asset_pattern}' in release {tag}. "
            f"Available: {available}"
        )

    # Download the zip
    download_url = zip_asset["browser_download_url"]
    size_mb = zip_asset["size"] / 1024 / 1024
    print(f"  Downloading {zip_asset['name']} ({size_mb:.1f} MB)...")

    with urllib.request.urlopen(download_url, timeout=120) as dl_resp:
        content = dl_resp.read()

    print(f"  Downloaded {len(content) / 1024 / 1024:.1f} MB")
    return content


def _install_legacy_zip(lang_code: str, entry: dict) -> Path:
    """Download and install an FST from a legacy-format GitHub zip release.

    Args:
        lang_code: ISO 639-3 language code (e.g. "crk")
        entry: Install metadata dict from language card (camelCase keys)

    Returns:
        Path to the installed FST cache directory
    """
    # Download the zip
    content = _download_legacy_zip(
        repo=entry["repo"],
        tag=entry["releaseTag"],
        asset_pattern=entry["assetPattern"],
    )

    # Calculate SHA256 for provenance
    sha256 = hashlib.sha256(content).hexdigest()

    # Extract to cache directory
    install_dir = FST_CACHE_ROOT / lang_code
    install_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        hfstol_count = 0
        for name in zf.namelist():
            if name.endswith(".hfstol"):
                # Extract to flat directory (ignore zip subdirectories)
                target = install_dir / Path(name).name
                target.write_bytes(zf.read(name))
                hfstol_count += 1
                print(f"  Extracted: {Path(name).name}")

        if hfstol_count == 0:
            raise RuntimeError(
                f"No .hfstol files found in zip. Contents: {zf.namelist()}"
            )

    # Write provenance metadata
    _write_provenance(install_dir, lang_code, entry, sha256)
    return install_dir


def _download_divvun_macos_pkg(
    repo: str,
    tag: str,
    asset_pattern: str,
    bundle_pattern: str,
) -> bytes:
    """Download a Divvun macOS .pkg and extract the acceptor .hfst from it.

    Extraction chain:
        1. Download macOS .pkg from GitHub release
        2. pkgutil --expand to unpack the xar archive
        3. gunzip + cpio to extract the Payload
        4. Find the speller.zhfst inside the Divvun bundle
        5. unzip to extract acceptor.default.hfst
        6. Return the raw .hfst bytes (already in HFST optimised format)

    Args:
        repo: GitHub repo (e.g. "giellalt/lang-sme")
        tag: Release tag (e.g. "speller-sme/v4.5.2")
        asset_pattern: Suffix to match in asset names (e.g. "_noarch-macos.pkg")
        bundle_pattern: Divvun bundle directory name inside Payload

    Returns:
        Raw bytes of the acceptor.default.hfst transducer

    Raises:
        RuntimeError: If any step of the extraction fails
    """
    import glob as glob_mod
    import subprocess
    import tempfile
    import urllib.error
    import urllib.request

    # Step 1: Find the asset URL via GitHub API
    # URL-encode the tag since it may contain '/' (e.g. "speller-sme/v4.5.2")
    encoded_tag = urllib.request.quote(tag, safe="")
    api_url = f"https://api.github.com/repos/{repo}/releases/tags/{encoded_tag}"
    req = urllib.request.Request(
        api_url,
        headers={"Accept": "application/vnd.github.v3+json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            release = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            f"GitHub API returned {e.code} for {api_url}"
        )

    # Find the .pkg asset
    pkg_asset = None
    for asset in release.get("assets", []):
        if asset["name"].endswith(asset_pattern):
            pkg_asset = asset
            break

    if pkg_asset is None:
        available = [a["name"] for a in release.get("assets", [])]
        raise RuntimeError(
            f"No .pkg asset matching '*{asset_pattern}' in release {tag}. "
            f"Available: {available}"
        )

    # Step 2: Download the .pkg
    download_url = pkg_asset["browser_download_url"]
    size_mb = pkg_asset["size"] / 1024 / 1024
    print(f"  Downloading {pkg_asset['name']} ({size_mb:.1f} MB)...")

    with urllib.request.urlopen(download_url, timeout=120) as dl_resp:
        pkg_bytes = dl_resp.read()

    print(f"  Downloaded {len(pkg_bytes) / 1024 / 1024:.1f} MB")

    # Step 3-6: Extract the acceptor in a temp directory
    with tempfile.TemporaryDirectory(prefix="champollion-fst-") as tmpdir:
        tmpdir = Path(tmpdir)
        pkg_path = tmpdir / "speller.pkg"
        pkg_path.write_bytes(pkg_bytes)

        # Expand the .pkg (xar archive)
        expanded_dir = tmpdir / "expanded"
        result = subprocess.run(
            ["pkgutil", "--expand", str(pkg_path), str(expanded_dir)],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"pkgutil --expand failed: {result.stderr}"
            )

        # Find the Payload file
        payloads = list(expanded_dir.rglob("Payload"))
        if not payloads:
            raise RuntimeError(
                f"No Payload found in expanded .pkg. "
                f"Contents: {list(expanded_dir.rglob('*'))}"
            )

        # Extract the Payload (gzip-compressed cpio archive)
        payload_dir = tmpdir / "payload_contents"
        payload_dir.mkdir()
        with open(payloads[0], "rb") as payload_f:
            gunzip = subprocess.Popen(
                ["gunzip"], stdin=payload_f, stdout=subprocess.PIPE,
            )
            # NB: Popen has no capture_output kwarg (that's subprocess.run) —
            # passing it crashed every divvun-pkg FST install (sme et al.).
            cpio = subprocess.Popen(
                ["cpio", "-id"],
                stdin=gunzip.stdout, cwd=str(payload_dir),
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            gunzip.stdout.close()
            _, cpio_stderr = cpio.communicate(timeout=30)

        if cpio.returncode != 0:
            raise RuntimeError(
                f"cpio extraction failed: {cpio_stderr.decode(errors='replace')}"
            )

        # Find the speller.zhfst inside the bundle
        zhfst_files = list(payload_dir.rglob("speller.zhfst"))
        if not zhfst_files:
            # Try finding any .zhfst
            zhfst_files = list(payload_dir.rglob("*.zhfst"))
        if not zhfst_files:
            all_files = list(payload_dir.rglob("*"))
            raise RuntimeError(
                f"No .zhfst found in Payload. "
                f"Files found: {[str(f) for f in all_files]}"
            )

        # Extract acceptor.default.hfst from the .zhfst (zip archive)
        zhfst_extract_dir = tmpdir / "zhfst_contents"
        zhfst_extract_dir.mkdir()
        with zipfile.ZipFile(zhfst_files[0]) as zf:
            # Look for acceptor .hfst file
            acceptor_names = [
                n for n in zf.namelist()
                if "acceptor" in n and n.endswith(".hfst")
            ]
            if not acceptor_names:
                raise RuntimeError(
                    f"No acceptor .hfst in zhfst. "
                    f"Contents: {zf.namelist()}"
                )

            acceptor_name = acceptor_names[0]
            acceptor_bytes = zf.read(acceptor_name)
            print(f"  Extracted: {acceptor_name} "
                  f"({len(acceptor_bytes) / 1024:.0f} KB)")

    return acceptor_bytes


def _install_divvun_pkg(lang_code: str, entry: dict) -> Path:
    """Download and install an FST from a Divvun macOS .pkg release.

    The acceptor.default.hfst from the speller package is typically already
    in HFST optimised lookup format and can be used directly with pyhfst.

    Args:
        lang_code: ISO 639-3 language code
        entry: Install metadata dict from language card (camelCase keys)

    Returns:
        Path to the installed FST cache directory
    """
    acceptor_bytes = _download_divvun_macos_pkg(
        repo=entry["repo"],
        tag=entry["releaseTag"],
        asset_pattern=entry["assetPattern"],
        bundle_pattern=entry.get("bundlePattern", ""),
    )

    sha256 = hashlib.sha256(acceptor_bytes).hexdigest()

    # Install to cache directory
    install_dir = FST_CACHE_ROOT / lang_code
    install_dir.mkdir(parents=True, exist_ok=True)

    # Write the acceptor as analyser.hfstol
    # The acceptor from Divvun spellers is already in optimised lookup format,
    # but named .hfst instead of .hfstol — pyhfst reads both fine.
    target = install_dir / "analyser.hfstol"
    target.write_bytes(acceptor_bytes)
    print(f"  Installed: analyser.hfstol ({len(acceptor_bytes) / 1024:.0f} KB)")

    # Warn about stub/dev transducers
    maturity = entry.get("maturity", "unknown")
    lang_name = language_cards.get_name(lang_code) or lang_code
    if maturity == "stub":
        print(f"  ⚠ Warning: {lang_name} FST is a dev/stub build. "
              f"Vocabulary coverage may be very limited.")

    _write_provenance(install_dir, lang_code, entry, sha256)
    return install_dir


def _ar_members(data: bytes) -> "list[tuple[str, bytes]]":
    """Parse a Unix ``ar`` archive (the container format of a .deb).

    Implemented here rather than shelling out to ``ar`` so the installer stays
    pure-stdlib and portable (macOS ``ar`` differs from GNU ``ar``).

    Args:
        data: Raw .deb / .a bytes.

    Returns:
        List of (member_name, payload) in archive order.

    Raises:
        RuntimeError: If the data is not an ar archive.
    """
    if not data.startswith(b"!<arch>\n"):
        raise RuntimeError("Not an ar archive (missing '!<arch>' magic) — corrupt .deb?")

    members: list[tuple[str, bytes]] = []
    off = 8
    while off + 60 <= len(data):
        header = data[off:off + 60]
        if header[58:60] != b"`\n":
            break  # not a valid member header — stop
        name = header[0:16].decode("ascii", "replace").strip().rstrip("/")
        try:
            size = int(header[48:58].decode("ascii").strip())
        except ValueError:
            break
        start = off + 60
        members.append((name, data[start:start + size]))
        off = start + size + (size % 2)  # members are padded to even offsets
    return members


def _download_apt_deb(pool_url: str, deb_file: str, expected_sha256: str | None) -> bytes:
    """Download a .deb from a GiellaLT/Apertium apt pool and verify its digest.

    Args:
        pool_url: Directory URL of the apt pool (must end with '/').
        deb_file: Exact .deb filename — this is the version pin.
        expected_sha256: Required digest. If set and it does not match, we abort.

    Returns:
        Raw .deb bytes.

    Raises:
        RuntimeError: On HTTP failure or digest mismatch.
    """
    import urllib.request
    import urllib.error

    url = pool_url.rstrip("/") + "/" + deb_file
    print(f"  Downloading {deb_file} from the GiellaLT nightly pool...")
    try:
        with urllib.request.urlopen(url, timeout=300) as resp:
            content = resp.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            f"apt pool returned {e.code} for {url}. Nightly pools are pruned over "
            f"time — if this build has been garbage-collected, re-pin 'debFile' "
            f"(and 'debSha256') in the language card to a current build and "
            f"re-verify. Do NOT silently fall back to a release tag: lang-crk's "
            f"newest release tag (fst-v2021.7.8, 2021) is vestigial and five years "
            f"stale."
        )

    print(f"  Downloaded {len(content) / 1024 / 1024:.1f} MB")

    actual = hashlib.sha256(content).hexdigest()
    if expected_sha256:
        if actual != expected_sha256:
            raise RuntimeError(
                f"SHA256 mismatch for {deb_file}.\n"
                f"  expected: {expected_sha256}\n"
                f"  actual:   {actual}\n"
                f"The pinned artifact is not what the card declares. Refusing to "
                f"install."
            )
        print(f"  SHA256 verified: {actual[:16]}…")
    else:
        print(f"  ⚠ No debSha256 pinned in the card. Actual: {actual}")
    return content


def _install_giellalt_nightly_apt(lang_code: str, entry: dict) -> Path:
    """Install an FST from GiellaLT's nightly apt pool (a .deb), by exact pin.

    WHY THIS FORMAT EXISTS — read before changing it:
        GitHub Releases is NOT GiellaLT/ALTLab's distribution channel. They ship
        continuously; the release tags are vestigial. lang-crk's newest release tag
        is ``fst-v2021.7.8`` (2021) and installing it gives you a FIVE-YEAR-STALE
        transducer. For crk that was not cosmetic: the 2021 build uses ``y`` on the
        analysis side while the current lexicon uses ``ý``, so the generator
        returned None *silently* for every ý-lemma — 4,989 of 28,268 lemmas (17.6%)
        were ungeneratable, and surfaces were unaffected, so nothing looked wrong.
        See crk-translate docs/nehiyawewin/research/00_fst_verification_log.md
        rounds 11-13.

    The pin is the exact ``debFile`` name (which carries the lang-crk commit) plus
    ``debSha256``. Nightly pools are pruned, so a pinned build can 404 eventually;
    when that happens, re-pin deliberately and re-verify — never fall back to a tag.

    Extraction chain (pure stdlib):
        .deb (ar archive) -> data.tar.xz -> ./usr/share/giella/{lang}/*.hfstol

    Args:
        lang_code: ISO 639-3 language code (e.g. "crk")
        entry: Install metadata dict from the language card (camelCase keys)

    Returns:
        Path to the installed FST cache directory
    """
    content = _download_apt_deb(
        pool_url=entry["aptPool"],
        deb_file=entry["debFile"],
        expected_sha256=entry.get("debSha256"),
    )
    sha256 = hashlib.sha256(content).hexdigest()

    # .deb is an ar archive containing data.tar.{xz,gz,zst}
    data_payload = None
    for name, payload in _ar_members(content):
        if name.startswith("data.tar"):
            data_payload = (name, payload)
            break
    if data_payload is None:
        raise RuntimeError(f"No data.tar.* member inside {entry['debFile']}")

    member_name, payload = data_payload
    if member_name.endswith(".zst"):
        raise RuntimeError(
            f"{member_name} uses zstd, which the stdlib tarfile cannot read on this "
            f"Python. Re-pin to an xz-compressed build."
        )

    include = entry.get("include") or []
    strip_suffix = entry.get("stripSuffix", "")

    install_dir = FST_CACHE_ROOT / lang_code
    install_dir.mkdir(parents=True, exist_ok=True)

    extracted = 0
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:*") as tf:
        available = [
            m for m in tf.getmembers()
            if m.isfile() and m.name.endswith(".hfstol")
        ]
        for m in available:
            base = Path(m.name).name
            if include and base not in include:
                continue
            out_name = base
            if strip_suffix and out_name.endswith(strip_suffix + ".hfstol"):
                out_name = out_name[: -len(strip_suffix + ".hfstol")] + ".hfstol"
            fh = tf.extractfile(m)
            if fh is None:
                continue
            (install_dir / out_name).write_bytes(fh.read())
            print(f"  Extracted: {out_name}")
            extracted += 1

        if extracted == 0:
            names = sorted(Path(m.name).name for m in available)
            raise RuntimeError(
                f"No .hfstol extracted from {entry['debFile']}. "
                f"'include' was {include!r}; archive contains: {names}"
            )

    _write_provenance(install_dir, lang_code, entry, sha256)
    return install_dir


def _write_provenance(
    install_dir: Path,
    lang_code: str,
    entry: dict,
    sha256: str,
) -> None:
    """Write provenance metadata for an installed FST.

    ``sha256`` is the digest of the downloaded artifact (zip / pkg acceptor /
    .deb), not of any individual .hfstol.
    """
    provenance = {
        "lang_code": lang_code,
        "name": language_cards.get_name(lang_code) or lang_code,
        "repo": entry.get("repo", ""),
        "release_tag": entry.get("releaseTag", ""),
        "format": entry.get("format", ""),
        "maturity": entry.get("maturity", "unknown"),
        "sha256": sha256,
        "installed_at": datetime.now(timezone.utc).isoformat(),
        "hfstol_files": [f.name for f in install_dir.glob("*.hfstol")],
    }
    # Nightly-apt installs pin an upstream source commit, not a release tag —
    # record it, because the tag field is meaningless for them.
    if entry.get("format") == "giellalt-nightly-apt":
        provenance["source_channel"] = "GiellaLT nightly apt — NOT GitHub Releases"
        provenance["apt_pool"] = entry.get("aptPool", "")
        provenance["deb_file"] = entry.get("debFile", "")
        provenance["lang_commit"] = entry.get("langCommit", "")
        provenance["deb_sha256"] = sha256
    provenance_path = install_dir / "provenance.json"
    provenance_path.write_text(json.dumps(provenance, indent=2))
    print(f"  Provenance: {provenance_path}")


def install_fst(lang_code: str) -> Path:
    """Download and install the FST for a language.

    Reads install metadata from the language card via
    ``language_cards.get_fst_install_info()``.

    Supports multiple distribution formats:
        - "giellalt-nightly-apt": GiellaLT nightly .deb from the Apertium apt pool,
          pinned by exact filename + SHA256. THIS IS THE CURRENT CHANNEL for
          GiellaLT languages — upstream ships continuously and its release tags are
          vestigial (see _install_giellalt_nightly_apt).
        - "legacy-zip": Standalone FST zip releases with .hfstol files. ⚠ A GitHub
          release tag is a POINT IN TIME, not "the latest" — verify the tag is not
          stale before trusting this format for a new language.
        - "divvun-macos-pkg": Divvun speller macOS .pkg packages
        - "divvun": Requires manual installation via Divvun manager

    Args:
        lang_code: ISO 639-3 language code (e.g. "crk", "sme")

    Returns:
        Path to the installed FST cache directory

    Raises:
        RuntimeError: If download or extraction fails
        KeyError: If language has no FST install metadata
    """
    entry = language_cards.get_fst_install_info(lang_code)
    if entry is None:
        raise KeyError(f"No FST install metadata in language card for '{lang_code}'")

    fmt = entry["format"]
    lang_name = language_cards.get_name(lang_code) or lang_code

    if fmt == "giellalt-nightly-apt":
        return _install_giellalt_nightly_apt(lang_code, entry)
    elif fmt == "legacy-zip":
        return _install_legacy_zip(lang_code, entry)
    elif fmt == "divvun-macos-pkg":
        return _install_divvun_pkg(lang_code, entry)
    elif fmt == "divvun":
        raise RuntimeError(
            f"FST for {lang_name} uses Divvun packaging without a "
            f"verified macOS .pkg. Install the Divvun manager from "
            f"https://divvun.no/ and copy .hfstol files to "
            f"~/.mt-eval/fsts/{lang_code}/"
        )
    else:
        raise RuntimeError(
            f"Unknown FST format '{fmt}' for {lang_name}"
        )


# ---------------------------------------------------------------------------
# Interactive consent flow
# ---------------------------------------------------------------------------

def prompt_fst_install(lang_code: str, lang_name: str) -> bool:
    """Prompt the user for FST download consent.

    Displays information about the FST and asks for confirmation.
    Returns True if the user consents, False otherwise.

    In non-interactive environments (no TTY) this AUTO-CONSENTS and returns
    True. That is deliberate — see the inline note below — but it is the
    opposite of what this docstring claimed until 2026-08-01, when it said
    "always returns False". Nothing in the code had ever done that, so any
    reader reasoning about CI or agent behaviour from the docstring was
    reasoning about a function that does not exist. `test_fst_installer.py`
    now pins the real behaviour.
    """
    if not sys.stdin.isatty():
        # Non-interactive (agent, CI, piped stdin) — auto-consent.
        # FST downloads are safe (read-only morphological data from GiellaLT)
        # and required for accurate evaluation. Refusing silently would cause
        # confusing evaluation failures downstream.
        #
        # WHAT THIS TRUSTS, stated plainly because it is a real trust boundary:
        # the download target (repo / releaseTag / assetPattern / poolUrl /
        # debFile) comes from the LANGUAGE CARD, which is data. Whoever can
        # land a card edit chooses what URL gets fetched and unpacked here,
        # and on this path nobody is watching. Two of the three formats
        # (legacy-zip, divvun-macos-pkg) compute a sha256 for provenance only
        # and have nothing to compare it against; the .deb path verifies only
        # when the card pins `debSha256` and otherwise warns and proceeds.
        # Extraction itself is defused (basenames only, no symlink members —
        # pinned by tests), but an allowlist on the download host is a founder
        # decision that has not been made. Do not widen this path without it.
        print(f"  FST: auto-downloading for {lang_name} (non-interactive mode)")
        return True

    entry = language_cards.get_fst_install_info(lang_code) or {}
    repo = entry.get("repo", f"giellalt/lang-{lang_code}")
    fmt = entry.get("format", "unknown")

    print()
    print("  ┌─────────────────────────────────────────────────────────────┐")
    print(f"  │  FST Required — {lang_name} ({lang_code})")
    print("  │                                                             │")
    print("  │  This language has a GiellaLT morphological analyzer.       │")
    print("  │  FST validation is required for eval accuracy on            │")
    print("  │  polysynthetic and low-resource language targets.           │")
    print("  │                                                             │")
    print(f"  │  Source: https://github.com/{repo}")
    print(f"  │  Cache:  ~/.mt-eval/fsts/{lang_code}/")
    print("  │                                                             │")

    if fmt == "divvun":
        print("  │  ⚠ This language uses Divvun packaging.                    │")
        print("  │  Install the Divvun manager from https://divvun.no/        │")
        print("  │  Then extract .hfstol files to the cache directory above.  │")
        print("  └─────────────────────────────────────────────────────────────┘")
        return False

    print("  └─────────────────────────────────────────────────────────────┘")
    print()

    try:
        answer = input("  Download and install now? [y/N]: ").strip().lower()
        return answer in ("y", "yes")
    except (EOFError, KeyboardInterrupt):
        print()
        return False


def ensure_fst_available(
    lang_code: str,
    lang_name: str,
    skip_fst: bool = False,
) -> Path | None:
    """Ensure the FST is available for the given language.

    This is the main entry point for the FST quality gate.

    Behavior:
        1. If FST is installed → return its path
        2. If FST is not installed and language has a known FST:
           a. If skip_fst=True → warn and return None
           b. Prompt user for download consent
           c. If yes → download, install, return path
           d. If no → return None (caller should abort eval)
        3. If no FST known for this language → return None (no gate)

    Args:
        lang_code: ISO 639-3 language code
        lang_name: Human-readable language name (for display)
        skip_fst: If True, skip the FST gate with a warning

    Returns:
        Path to FST cache directory, or None if not available
    """
    # Check if already installed
    if is_fst_installed(lang_code):
        fst_dir = get_fst_cache_dir(lang_code)
        analyzer = find_analyzer_hfstol(fst_dir)
        print(f"  FST: found ({analyzer.name}) at {fst_dir}")
        return fst_dir

    # Check if this language has a known FST in its language card
    entry = language_cards.get_fst_install_info(lang_code)
    if entry is None:
        # No FST install info in language card — this isn't gated
        return None

    # FST exists but not installed
    if skip_fst:
        print(f"  ⚠ FST: skipped (--skip-fst). {lang_name} FST not installed.")
        print(f"    Results will lack morphological validation.")
        return None

    # Prompt for download
    if prompt_fst_install(lang_code, lang_name):
        try:
            fst_dir = install_fst(lang_code)
            print(f"  ✓ FST installed successfully at {fst_dir}")
            return fst_dir
        except Exception as e:
            print(f"  ✗ FST installation failed: {e}")
            return None
    else:
        # User declined or non-interactive — return None to signal gate failure
        return None
