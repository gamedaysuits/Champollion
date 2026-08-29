"""Security-relevant behaviour of the FST installer.

`mt_eval_harness/plugins/fst_installer.py` is 807 lines that download
third-party archives over the network and unpack them onto the user's disk.
Until 2026-08-01 it had ZERO tests. That is the wrong amount for code whose
job is "fetch a remote archive and write files".

These tests are entirely OFFLINE — every archive is built in `tmp_path` and
the cache root is monkeypatched — so they assert what the extractor does with
a hostile archive without ever touching the network.

The point of most of them is REGRESSION PINNING, not bug-finding: the
extraction paths are already written safely, and the safety is easy to
destroy by "simplifying" them. `zf.extractall()` and `tf.extractall()` are the
one-line changes that would reintroduce zip-slip and tar-slip, and nothing
before this file would have noticed.

What is deliberately NOT asserted here, because it is unresolved and belongs
to the founder rather than to a test:
  * two of three formats (legacy-zip, divvun-macos-pkg) have no checksum to
    compare against — they hash for provenance only;
  * the .deb path verifies only when the card pins `debSha256`, and otherwise
    warns and installs anyway;
  * download targets are card-driven with no host allowlist;
  * archives are read fully into memory with no size bound.
See the trust-boundary note in `prompt_fst_install`.
"""

from __future__ import annotations

import io
import tarfile
import zipfile

import pytest

from mt_eval_harness.plugins import fst_installer


@pytest.fixture()
def cache_root(tmp_path, monkeypatch):
    """Point the installer's cache at a temp dir, never the real ~/.mt-eval."""
    root = tmp_path / "fsts"
    monkeypatch.setattr(fst_installer, "FST_CACHE_ROOT", root)
    return root


def _zip_bytes(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in members.items():
            zf.writestr(name, data)
    return buf.getvalue()


# ── zip extraction ──────────────────────────────────────────────────────


def test_zip_traversal_member_cannot_escape_the_install_dir(
    cache_root, monkeypatch, capsys
):
    """A `../../../` member must land as a basename inside the cache dir.

    This is zip-slip. The installer defuses it by reducing every member to
    `Path(name).name` before joining. If someone replaces that loop with
    `zf.extractall()`, this test fails.
    """
    payload = _zip_bytes(
        {
            "../../../../../../tmp/pwned.hfstol": b"evil",
            "analyser.hfstol": b"good",
        }
    )
    monkeypatch.setattr(
        fst_installer, "_download_legacy_zip", lambda *a, **k: payload
    )

    entry = {"repo": "giellalt/lang-crk", "releaseTag": "v1", "assetPattern": "*.zip"}
    install_dir = fst_installer._install_legacy_zip("crk", entry)

    written = sorted(p.name for p in install_dir.glob("*.hfstol"))
    assert written == ["analyser.hfstol", "pwned.hfstol"]

    # The traversing member landed INSIDE the install dir, flattened.
    assert (install_dir / "pwned.hfstol").read_bytes() == b"evil"
    # And nothing escaped upward.
    assert not (cache_root.parent / "pwned.hfstol").exists()
    for p in install_dir.glob("**/*"):
        assert install_dir in p.parents or p.parent == install_dir


def test_zip_with_no_hfstol_members_fails_loudly(cache_root, monkeypatch):
    """An archive that yields nothing must raise, not silently install zero files.

    A silent success here would leave the caller believing an analyzer is
    present and fail confusingly much later.
    """
    monkeypatch.setattr(
        fst_installer,
        "_download_legacy_zip",
        lambda *a, **k: _zip_bytes({"README.md": b"nothing useful"}),
    )
    entry = {"repo": "giellalt/lang-crk", "releaseTag": "v1", "assetPattern": "*.zip"}

    with pytest.raises(RuntimeError, match="No .hfstol files found"):
        fst_installer._install_legacy_zip("crk", entry)


def test_zip_subdirectories_are_flattened(cache_root, monkeypatch):
    """Nested members collapse to basenames — the documented behaviour."""
    monkeypatch.setattr(
        fst_installer,
        "_download_legacy_zip",
        lambda *a, **k: _zip_bytes({"deep/nested/path/analyser.hfstol": b"x"}),
    )
    entry = {"repo": "giellalt/lang-crk", "releaseTag": "v1", "assetPattern": "*.zip"}

    install_dir = fst_installer._install_legacy_zip("crk", entry)
    assert (install_dir / "analyser.hfstol").read_bytes() == b"x"
    assert not (install_dir / "deep").exists()


def test_zip_install_writes_provenance(cache_root, monkeypatch):
    """Every install records where the bytes came from and their digest."""
    payload = _zip_bytes({"analyser.hfstol": b"x"})
    monkeypatch.setattr(
        fst_installer, "_download_legacy_zip", lambda *a, **k: payload
    )
    entry = {"repo": "giellalt/lang-crk", "releaseTag": "v1", "assetPattern": "*.zip"}

    install_dir = fst_installer._install_legacy_zip("crk", entry)
    provenance = list(install_dir.glob("*.json"))
    assert provenance, "an install with no provenance record is unattributable"


# ── tar extraction (the .deb / apt path) ────────────────────────────────


def _tar_with_symlink(tmp_path) -> bytes:
    """A tar carrying a symlink member pointing outside the extract dir."""
    real = tmp_path / "real.hfstol"
    real.write_bytes(b"good")

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tf:
        tf.add(real, arcname="analyser.hfstol")

        link = tarfile.TarInfo("escape.hfstol")
        link.type = tarfile.SYMTYPE
        link.linkname = "../../../../../../etc/passwd"
        tf.addfile(link)

        hard = tarfile.TarInfo("hardlink.hfstol")
        hard.type = tarfile.LNKTYPE
        hard.linkname = "analyser.hfstol"
        tf.addfile(hard)
    return buf.getvalue()


def test_tar_symlink_and_hardlink_members_are_not_extracted(
    cache_root, tmp_path, monkeypatch
):
    """Tar-slip via link members must be excluded by the `isfile()` filter.

    A symlink member named `escape.hfstol` pointing at `../../etc/passwd`
    would, under `tf.extractall()`, create a dangling symlink that a later
    write could follow out of the cache directory. The installer filters
    members with `m.isfile()`, which is true for neither symlinks nor hard
    links. This test fails the moment that filter is dropped.
    """
    payload = _tar_with_symlink(tmp_path)
    monkeypatch.setattr(
        fst_installer, "_download_apt_deb", lambda *a, **k: payload
    )
    monkeypatch.setattr(
        fst_installer, "_ar_members", lambda data: [("data.tar", payload)]
    )

    entry = {
        "aptPool": "https://apertium.projectjj.com/apt/nightly/pool/main",
        "debFile": "giella-crk_0.0-1_all.deb",
    }
    install_dir = fst_installer._install_giellalt_nightly_apt("crk", entry)

    names = sorted(p.name for p in install_dir.iterdir())
    assert "escape.hfstol" not in names, "symlink member must not be extracted"
    assert "hardlink.hfstol" not in names, "hard-link member must not be extracted"
    assert "analyser.hfstol" in names, "the real regular file should still install"
    assert not (install_dir / "escape.hfstol").is_symlink()


# ── the consent gate ────────────────────────────────────────────────────


def test_non_interactive_auto_consents(monkeypatch, capsys):
    """Pin the REAL behaviour: no TTY means auto-consent, returning True.

    The docstring claimed "always returns False" until 2026-08-01 while the
    code had always returned True. This is the path agents and CI take, and it
    is precisely where nobody is watching — so it gets a test rather than a
    comment.
    """
    monkeypatch.setattr(fst_installer.sys.stdin, "isatty", lambda: False)

    assert fst_installer.prompt_fst_install("crk", "Plains Cree") is True

    out = capsys.readouterr().out
    assert "non-interactive" in out.lower(), (
        "auto-consent must at least announce itself on stdout — a silent "
        "network download is the thing we are guarding against"
    )


def test_non_interactive_consent_is_announced_with_the_language(monkeypatch, capsys):
    """The auto-consent line names what it is downloading for."""
    monkeypatch.setattr(fst_installer.sys.stdin, "isatty", lambda: False)
    fst_installer.prompt_fst_install("crk", "Plains Cree")
    assert "Plains Cree" in capsys.readouterr().out


# ── cache paths ─────────────────────────────────────────────────────────


def test_cache_dir_is_scoped_per_language(cache_root):
    assert fst_installer.get_fst_cache_dir("crk") == cache_root / "crk"


def test_is_fst_installed_is_false_for_an_empty_cache(cache_root):
    assert fst_installer.is_fst_installed("crk") is False


def test_find_analyzer_returns_none_rather_than_raising(cache_root):
    """A missing analyzer is a None, not an exception — callers branch on it."""
    empty = cache_root / "crk"
    empty.mkdir(parents=True)
    assert fst_installer.find_analyzer_hfstol(empty) is None
