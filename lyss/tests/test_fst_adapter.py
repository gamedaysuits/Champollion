"""FSTAnalyzer — FST located via the harness installer, never bundled. All FST
I/O is mocked (no .hfstol on disk, no pyhfst needed)."""

from __future__ import annotations

import sys
import types
from pathlib import Path

from champollion_lyss.crk.fst_adapter import FSTAnalyzer


def _install_fake_pyhfst(monkeypatch, lookup_result):
    fake = types.ModuleType("pyhfst")

    class _Analyzer:
        def lookup(self, word):
            return lookup_result

    class _Stream:
        def __init__(self, path):
            self.path = path

        def read(self):
            return _Analyzer()

    fake.HfstInputStream = _Stream
    monkeypatch.setitem(sys.modules, "pyhfst", fake)


def test_analyze_success(monkeypatch):
    monkeypatch.setattr(
        "mt_eval_harness.plugins.fst_installer.get_fst_cache_dir",
        lambda code: Path("/fake/fsts/crk"),
    )
    monkeypatch.setattr(
        "mt_eval_harness.plugins.fst_installer.find_analyzer_hfstol",
        lambda d: Path("/fake/fsts/crk/analyser.hfstol"),
    )
    _install_fake_pyhfst(monkeypatch, [("nipâw+V+AI+Ind+3Sg", 0.0)])

    res = FSTAnalyzer("crk").analyze("nipâw")
    assert res.success is True
    assert res.analyses == ["nipâw+V+AI+Ind+3Sg"]


def test_analyze_no_fst_returns_empty_not_error(monkeypatch):
    monkeypatch.setattr(
        "mt_eval_harness.plugins.fst_installer.get_fst_cache_dir",
        lambda code: Path("/fake/fsts/crk"),
    )
    monkeypatch.setattr(
        "mt_eval_harness.plugins.fst_installer.find_analyzer_hfstol",
        lambda d: None,
    )
    res = FSTAnalyzer("crk").analyze("nipâw")
    assert res.success is False
    assert res.analyses == []


def test_is_available_delegates_to_harness(monkeypatch):
    monkeypatch.setattr(
        "mt_eval_harness.plugins.fst_installer.is_fst_installed", lambda code: True
    )
    assert FSTAnalyzer("crk").is_available() is True

    monkeypatch.setattr(
        "mt_eval_harness.plugins.fst_installer.is_fst_installed", lambda code: False
    )
    assert FSTAnalyzer("crk").is_available() is False
