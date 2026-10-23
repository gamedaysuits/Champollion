"""P3 — external eval-standard loading (the harness ships no language scorer code).

The harness core no longer bundles language-specific scorer code (e.g. the Cree
LYSS linter/semantic validator). It loads those from an EXTERNAL package
(champollion-lyss) declared on the language card and fetched on demand. These
tests pin the properties that matter:
  - a card-declared referee metric that cannot be loaded FAILS LOUD (no silent
    skip that would score the language without it);
  - the bundled eval_standards package is gone from the wheel.
"""

from __future__ import annotations

import importlib.util

import pytest

from mt_eval_harness.plugin_discovery import (
    _ensure_eval_standard_installed,
    _load_language_card_metrics,
)


def test_bundled_eval_standards_is_gone_from_the_wheel():
    # The whole point of P3: no language-specific scorer code in the core.
    assert importlib.util.find_spec("mt_eval_harness.eval_standards") is None


class TestEnsureEvalStandard:
    def test_noop_when_package_importable(self):
        # Verify the pip spec is NOT used when the package is already present.
        # Requires champollion_lyss installed; skips cleanly in a standalone
        # harness checkout that doesn't have it. CI installs it (ci-arena.yml)
        # so this integration is actually exercised rather than always skipped.
        pytest.importorskip("champollion_lyss")
        em = {"lyss-eq": {"module": "champollion_lyss.crk.metrics", "class": "CrkLinterMetric"}}
        _ensure_eval_standard_installed(em, {"pip": "MUST-NOT-BE-USED"}, "crk")

    def test_missing_package_without_pip_spec_fails_loud(self):
        # A declared metric whose package isn't installed AND no evalStandard.pip
        # to fetch it → hard error, never a silent skip.
        em = {"x": {"module": "definitely_not_installed_pkg_xyz.metrics", "class": "X"}}
        with pytest.raises(RuntimeError):
            _ensure_eval_standard_installed(em, None, "zz")
        with pytest.raises(RuntimeError):
            _ensure_eval_standard_installed(em, {}, "zz")


class TestLoadLanguageCardMetrics:
    def test_malformed_entry_fails_loud(self, monkeypatch):
        # evalMetrics entry missing 'class' must raise — no silent skip.
        # Needs champollion_lyss present so _ensure_eval_standard_installed
        # passes its presence check and the malformed-entry ValueError path is
        # reached (otherwise a RuntimeError fires first). Skips when absent;
        # CI installs champollion_lyss so this runs there.
        pytest.importorskip("champollion_lyss")
        import mt_eval_harness.language_cards as lc
        monkeypatch.setattr(
            lc, "get_eval_metrics",
            lambda code: {"bad": {"module": "champollion_lyss.crk.metrics"}},
        )
        monkeypatch.setattr(lc, "get_eval_standard", lambda code: None)
        with pytest.raises(ValueError):
            _load_language_card_metrics("crk")

    def test_no_eval_metrics_returns_empty(self, monkeypatch):
        import mt_eval_harness.language_cards as lc
        monkeypatch.setattr(lc, "get_eval_metrics", lambda code: None)
        assert _load_language_card_metrics("xyz") == []

    def test_crk_loads_all_lyss_plugins_from_external_package(self):
        # Integration: the real crk card resolves all three LYSS metrics from
        # the external champollion_lyss package (not the deleted bundled copy).
        # lyss-chrf (CrkLintedChrF) activated 2026-07-07.
        pytest.importorskip("champollion_lyss")
        pytest.importorskip("spacy")
        try:
            import spacy
            spacy.load("en_core_web_md")
        except Exception:
            pytest.skip("en_core_web_md model not installed")
        plugins = _load_language_card_metrics("crk")
        assert sorted(type(p).__name__ for p in plugins) == [
            "CrkLintedChrF", "CrkLinterMetric", "CrkSemanticMetric",
        ]
