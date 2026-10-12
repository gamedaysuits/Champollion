"""FST pins: which FST build the harness installs and evaluates with.

Regression (2026-10-03): the pins lived on the language cards as
resources.fsts[0].install. The 2026-08-12 atlas cutover projected cards
without them, get_fst_install_info() returned None for every language, and
plugin discovery silently skipped the FST metric — Plains Cree's morphological
check was off for seven weeks and no run said so. The pins now ship in the
wheel (mt_eval_harness/data/fst-pins.json); these tests hold that in place.
"""

from __future__ import annotations

import json
import re

import pytest

from mt_eval_harness import language_cards as lc
from mt_eval_harness import language_cards_remote as lcr

AUTO_FORMATS = {"giellalt-nightly-apt", "legacy-zip", "divvun-macos-pkg"}
KNOWN_FORMATS = AUTO_FORMATS | {"divvun", "manual"}


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    monkeypatch.delenv("MT_EVAL_FST_PINS", raising=False)
    lc.reset_state()
    yield
    lc.reset_state()


def _no_cards_at_all(monkeypatch):
    """No local cards, and the remote index is down."""
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)

    def down(**kw):
        raise lcr.LanguageCardsUnavailable("index unreachable (test)")
    monkeypatch.setattr(lcr, "fetch_index_rows", down)
    monkeypatch.setattr(lc, "_read_remote_index_cache", lambda **kw: None)


def test_every_pin_is_well_formed():
    codes = lc.fst_pinned_codes()
    assert "crk" in codes and len(codes) >= 12
    for code in codes:
        pin = lc.get_fst_pin(code)
        assert pin["name"] and pin["url"].startswith("https://"), code
        assert pin["install"]["format"] in KNOWN_FORMATS, code
        assert pin["install"]["repo"], code


def test_crk_pin_is_the_verified_nightly_build():
    info = lc.get_fst_install_info("crk")
    assert info["format"] == "giellalt-nightly-apt"
    assert re.fullmatch(r"[0-9a-f]{64}", info["debSha256"])
    assert info["langCommit"].startswith("bec054ef")


def test_pin_found_with_no_card_index_at_all(monkeypatch):
    # An air-gapped node or an offline pip install still knows which FST to
    # use: the pin must not depend on reaching a card.
    _no_cards_at_all(monkeypatch)
    assert lc.get_fst_install_info("crk")["format"] == "giellalt-nightly-apt"


def test_a_card_install_block_is_not_a_second_source(monkeypatch):
    monkeypatch.setattr(lc, "get_card", lambda code: {
        "resources": {"fsts": [{"install": {"repo": "someone/else",
                                            "format": "legacy-zip"}}]}})
    assert lc.get_fst_install_info("crk")["repo"] == "giellalt/lang-crk"


def test_override_file_replaces_the_packaged_pins(monkeypatch, tmp_path):
    f = tmp_path / "pins.json"
    f.write_text(json.dumps({"pins": {"xyz": {
        "name": "Test FST", "url": "https://example.org/fst",
        "install": {"repo": "x/y", "format": "manual"}}}}))
    monkeypatch.setenv("MT_EVAL_FST_PINS", str(f))
    lc.reset_state()
    assert lc.fst_pinned_codes() == ["xyz"]
    assert lc.get_fst_install_info("crk") is None


def test_unreadable_pins_fail_loud(monkeypatch, tmp_path):
    f = tmp_path / "pins.json"
    f.write_text("{not json")
    monkeypatch.setenv("MT_EVAL_FST_PINS", str(f))
    lc.reset_state()
    with pytest.raises(RuntimeError, match="MT_EVAL_FST_PINS"):
        lc.get_fst_install_info("crk")


def test_setup_status_never_walks_the_card_index(monkeypatch, tmp_path):
    # From a pip install every card is a network fetch; walking ~8,700 of
    # them made `mt-eval setup --status` hang for many minutes.
    from mt_eval_harness import setup_wizard
    from mt_eval_harness.plugins import fst_installer

    def no_card(code):
        raise AssertionError(f"setup --status fetched the card for {code}")
    monkeypatch.setattr(lc, "get_card", no_card)
    monkeypatch.setattr(lc, "get_all_codes", lambda: (_ for _ in ()).throw(
        AssertionError("setup --status walked the whole card index")))
    monkeypatch.setattr(fst_installer, "FST_CACHE_ROOT", tmp_path)
    (tmp_path / "crk").mkdir()
    (tmp_path / "crk" / "crk-strict-analyzer.hfstol").write_bytes(b"x")
    _no_cards_at_all(monkeypatch)
    installed = setup_wizard.get_installed_fsts()
    assert [f["code"] for f in installed] == ["crk"]
    assert "Plains Cree" in installed[0]["name"]


def test_plugin_discovery_attempts_the_fst_metric_for_crk(monkeypatch):
    # The silent half of the regression: no pin → no FST gate → no metric,
    # and nothing printed. The card here is shaped like the live one: it
    # lists Cree's FSTs but carries no install block.
    from mt_eval_harness import plugin_discovery
    from mt_eval_harness.plugins import fst_installer
    seen = []
    monkeypatch.setattr(fst_installer, "ensure_fst_available",
                        lambda code, name, skip_fst=False: seen.append(code))
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    monkeypatch.setattr(lc, "_read_remote_index_cache", lambda **kw: None)
    monkeypatch.setattr(lc, "_write_remote_index_cache", lambda rows: None)
    monkeypatch.setattr(lcr, "fetch_index_rows", lambda **kw: [
        {"code": "crk", "name": "Plains Cree", "iso639_1": None, "aliases": []}])
    monkeypatch.setattr(lcr, "fetch_detail_card", lambda code, **kw: {
        "code": "crk", "name": "Plains Cree",
        "resources": {"fsts": [{"name": "lang-crk",
                                "url": "https://github.com/giellalt/lang-crk"}]}})
    plugin_discovery.discover_metric_plugins(
        {"target_lang": "crk", "target_lang_code": "crk"}, skip_fst=True)
    assert seen == ["crk"]


def test_a_cache_older_than_the_pin_is_named(monkeypatch, tmp_path):
    # This Mac carried the 2021 legacy-zip crk build long after the pin moved
    # to the nightly channel; nothing said so.
    from mt_eval_harness.plugins import fst_installer
    monkeypatch.setattr(fst_installer, "FST_CACHE_ROOT", tmp_path)
    d = tmp_path / "crk"
    d.mkdir()
    (d / "provenance.json").write_text(json.dumps({
        "format": "legacy-zip", "release_tag": "fst-v2021.7.8",
        "installed_at": "2026-06-12T12:36:26+00:00"}))
    msg = fst_installer.installed_pin_mismatch("crk")
    assert "fst-v2021.7.8" in msg and "giellalt-nightly-apt" in msg
    assert str(d) in msg

    pin = lc.get_fst_install_info("crk")
    (d / "provenance.json").write_text(json.dumps({
        "format": "giellalt-nightly-apt", "deb_file": pin["debFile"]}))
    assert fst_installer.installed_pin_mismatch("crk") is None


def test_installs_work_in_a_venv_without_pip(monkeypatch):
    # `uv venv` makes environments with no pip; every auto-install died with
    # "No module named pip" from a clean uv install (2026-10-03).
    import importlib.util
    import subprocess
    import sys as _sys
    from mt_eval_harness import setup_wizard

    ran = []
    monkeypatch.setattr(importlib.util, "find_spec",
                        lambda name, *a, **k: None if name == "pip" else object())
    monkeypatch.setattr(subprocess, "run",
                        lambda cmd, **kw: ran.append(cmd) or
                        subprocess.CompletedProcess(cmd, 1))
    monkeypatch.setattr("shutil.which", lambda name: "/opt/uv" if name == "uv" else None)
    cmd = setup_wizard.pip_install_command(["pyhfst>=1.4"])
    assert ran and ran[0][1:3] == ["-m", "ensurepip"], "bootstrap pip first"
    assert cmd == ["/opt/uv", "pip", "install", "--python", _sys.executable,
                   "pyhfst>=1.4"]

    monkeypatch.setattr("shutil.which", lambda name: None)
    assert setup_wizard.pip_install_command(["x"]) is None
