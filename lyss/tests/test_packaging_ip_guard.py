"""IP / packaging guard — proves the package ships ZERO restricted data and is
correctly licensed. Runnable as a CI gate.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

_PKG_ROOT = Path(__file__).resolve().parent.parent       # lyss/
_PKG = _PKG_ROOT / "champollion_lyss"


def test_no_restricted_data_files_in_package():
    bad = []
    for pat in ("*.hfstol", "*.fomabin", "lemmas.json", "*.tsv", "*.csv"):
        bad += [str(p) for p in _PKG.rglob(pat)]
    assert not bad, f"restricted/bundled data found in package: {bad}"


def test_no_in_package_data_dir():
    assert not (_PKG / "crk" / "data").exists(), (
        "in-package crk/data dir must not exist — gloss data is fetched at runtime"
    )


def test_license_is_interim_permission_only_not_agpl():
    txt = (_PKG_ROOT / "LICENSE").read_text(encoding="utf-8")
    assert "Use by Permission Only" in txt[:200]
    # ASCII-safe, single-line substring (ê may be NFC/NFD; phrases may wrap)
    assert "reserved pending consent" in txt
    assert "GNU AFFERO" not in txt
    assert "Apache License" not in txt


def test_notice_present_and_declares_sovereignty():
    txt = (_PKG_ROOT / "NOTICE").read_text(encoding="utf-8").lower()
    assert "non-commercial" in txt
    assert "community" in txt
    assert ("itwêwina" in txt) or ("itwewina" in txt)


def test_pyproject_metadata():
    tomllib = pytest.importorskip("tomllib")
    d = tomllib.loads((_PKG_ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    assert d["project"]["license"] == {
        "text": "LicenseRef-Champollion-Interim-Permission-Required"
    }
    # Ship code only — no package data.
    assert d["tool"]["setuptools"]["package-data"]["champollion_lyss"] == []
    # NOTICE travels with redistribution.
    assert "NOTICE" in d["tool"]["setuptools"]["license-files"]
    deps = d["project"]["dependencies"]
    # The harness dist on PyPI is `mt-eval` (import package stays mt_eval_harness).
    assert any(dep.replace(" ", "").startswith("mt-eval>=0.1") for dep in deps)
    assert not any("requests" in dep for dep in deps), "unused requests dep should be gone"


def test_crk_card_pip_points_at_pypi():
    # evalStandard moved off the card at the 2026-08 atlas cutover: eval
    # config now lives in the catalogue's card-config (evalConfig.crk),
    # which sits in the monorepo, not the standalone package mirror.
    cfg = _PKG_ROOT.parent / "cli" / "shared" / "catalogue" / "card-config.json"
    if not cfg.exists():
        pytest.skip("card-config.json not present (standalone package checkout)")
    es = json.loads(cfg.read_text(encoding="utf-8"))["evalConfig"]["crk"]["evalStandard"]
    assert "git+" not in es["pip"], "card pip must be a PyPI spec, not a git URL"
    assert es["pip"].startswith("champollion-lyss>="), es["pip"]
    assert es.get("ipNotice"), "card must declare an IP notice for install-time display"
