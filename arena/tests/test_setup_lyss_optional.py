"""`mt-eval setup --lang <code>` installs only what an installed metric uses.

Synthetic Cree-school persona, round 3 (2026-10-03): `mt-eval setup --lang
crk` installed spaCy and the 33.5 MB `en_core_web_md` English model although
the optional LYSS add-on (`champollion_lyss`), the only thing that uses them
(LYSS-sem), was not installed. The card already says which metric needs what
(`evalMetrics.<m>.module` / `dependencies` / `spacy_models`); setup now reads
that and defers an absent add-on's needs, printing one line that names the
add-on and how to add it.

Nothing here pip-installs or downloads: the installer, subprocess and FST
fetch are replaced with recorders.
"""

from __future__ import annotations

import importlib.machinery
import importlib.util
import sys

import pytest

from mt_eval_harness import language_cards, setup_wizard as sw
from mt_eval_harness.plugins import fst_installer

_REAL_FIND_SPEC = importlib.util.find_spec
_MODEL = "en_core_web_md"


def _lyss_installed(monkeypatch, installed: bool):
    """Make the add-on package (named on the crk card) present or absent."""
    addon = (language_cards.get_eval_standard("crk") or {}).get("import")
    assert addon, "the crk card must name its eval-standard package"
    sentinel = importlib.machinery.ModuleSpec(addon, None)

    def fake_find_spec(name, *args, **kwargs):
        if name == addon:
            return sentinel if installed else None
        return _REAL_FIND_SPEC(name, *args, **kwargs)

    monkeypatch.setattr(importlib.util, "find_spec", fake_find_spec)


@pytest.fixture
def recorded(monkeypatch):
    """Replace every install side effect with a recorder; nothing is present."""
    calls = {"pip": [], "run": [], "fst": []}

    def fake_pip(spec, description):
        calls["pip"].append(spec)
        return True

    class _Done:
        returncode = 0

    def fake_run(cmd, *args, **kwargs):
        calls["run"].append(list(cmd))
        return _Done()

    monkeypatch.setattr(sw, "_pip_install", fake_pip)
    monkeypatch.setattr(sw.subprocess, "run", fake_run)
    monkeypatch.setattr(sw, "_pip_subprocess_env", lambda: None)
    monkeypatch.setattr(sw, "_importable", lambda name: False)
    monkeypatch.setattr(fst_installer, "is_fst_installed", lambda code: False)
    monkeypatch.setattr(fst_installer, "install_fst",
                        lambda code: calls["fst"].append(code))
    return calls


def _addon_lines(out: str) -> list[str]:
    return [line for line in out.splitlines() if "Optional add-on" in line]


def test_crk_without_lyss_skips_the_english_model_and_names_the_addon(
        monkeypatch, recorded, capsys):
    _lyss_installed(monkeypatch, False)

    plan = sw.split_eval_pack("crk")
    assert not any(_MODEL in str(s.get("command")) for s in plan["postInstall"])
    assert "spacy" not in plan["pythonDeps"]
    assert "pyhfst" in plan["pythonDeps"], "the FST lane's runtime still installs"

    sw.run_setup(lang_code="crk")  # what `mt-eval setup --lang crk` calls

    assert not any(_MODEL in " ".join(cmd) for cmd in recorded["run"])
    assert not any("spacy" in str(spec) for spec in recorded["pip"])
    assert any("pyhfst" in str(spec) for spec in recorded["pip"])
    assert recorded["fst"] == ["crk"], "the analyzer FST still installs"

    lines = _addon_lines(capsys.readouterr().out)
    assert len(lines) == 1, lines
    line = lines[0]
    standard = language_cards.get_eval_standard("crk")
    assert standard["package"] in line
    assert f"pip install '{standard['pip']}'" in line
    assert "mt-eval setup --lang crk" in line


def test_crk_with_lyss_installs_the_english_model(monkeypatch, recorded, capsys):
    _lyss_installed(monkeypatch, True)

    plan = sw.split_eval_pack("crk")
    assert plan["deferred"] == []
    assert any(_MODEL in str(s.get("command")) for s in plan["postInstall"])
    assert "spacy" in plan["pythonDeps"]

    sw.run_setup(lang_code="crk")

    assert [sys.executable, "-m", "spacy", "download", _MODEL] in recorded["run"]
    assert any("spacy" in str(spec) for spec in recorded["pip"])
    assert _addon_lines(capsys.readouterr().out) == []


def test_need_shared_with_an_installed_metric_is_kept(monkeypatch):
    """Deferral follows the card's per-metric declarations, nothing else."""
    monkeypatch.setattr(language_cards, "get_eval_pack", lambda code: None)
    monkeypatch.setattr(language_cards, "get_eval_metrics", lambda code: {
        "gone": {"module": "absent_pkg_for_test_xyz.m", "class": "C",
                 "dependencies": ["shared-dep>=1", "only_absent>=2"],
                 "spacy_models": ["model-a"]},
        "here": {"module": "json.decoder", "class": "C",
                 "dependencies": ["Shared_Dep"]},
    })
    monkeypatch.setattr(language_cards, "get_eval_standard",
                        lambda code: {"import": "some_other_pkg", "pip": "x"})
    pack = {
        "pythonDeps": {"shared_dep": "shared-dep>=1",
                       "only_absent": "only-absent>=2",
                       "core_dep": "core-dep>=1"},
        "postInstall": [{"command": "only_absent fetch thing"},
                        {"command": "other-tool get model-a"},
                        {"command": "core_dep warmup"}],
    }

    plan = sw.split_eval_pack("tst", pack)

    assert plan["pythonDeps"] == {"shared_dep": "shared-dep>=1",
                                  "core_dep": "core-dep>=1"}
    assert plan["postInstall"] == [{"command": "core_dep warmup"}]
    [addon] = plan["deferred"]
    assert addon["import"] == "absent_pkg_for_test_xyz"
    assert addon["pythonDeps"] == {"only_absent": "only-absent>=2"}
    assert len(addon["postInstall"]) == 2
    # The card's evalStandard provides a different package: no pip spec to quote.
    assert addon["pip"] is None
    assert "install the package that provides 'absent_pkg_for_test_xyz'" in \
        sw.addon_skip_line("tst", addon)


def test_pack_without_eval_metrics_defers_nothing(recorded, capsys):
    plan = sw.split_eval_pack("sme")
    assert plan["deferred"] == []
    assert plan["pythonDeps"] == language_cards.get_eval_pack("sme")["pythonDeps"]

    sw.install_lang("sme", interactive=False)
    assert _addon_lines(capsys.readouterr().out) == []


def test_run_gate_does_not_demand_an_absent_addons_deps(monkeypatch):
    """The pre-run eval-pack gate (config._check_eval_pack) used to list
    spaCy and tell the user to run `mt-eval setup --lang crk` — which, with
    the add-on absent, now (rightly) skips spaCy: a loop. The gate demands
    the same split setup installs by."""
    from mt_eval_harness import config as cfg

    _lyss_installed(monkeypatch, False)
    monkeypatch.setitem(sys.modules, "spacy", None)   # import spacy → ImportError
    monkeypatch.setattr(fst_installer, "is_fst_installed", lambda code: False)
    for var in ("CI", "MT_EVAL_AUTO_SETUP"):
        monkeypatch.delenv(var, raising=False)
    entry = {"id": "crk-test", "language_pair": {"source": "eng", "target": "crk"}}
    import contextlib
    import io
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        # Round 8: the FST lane is an advisory — the run proceeds
        cfg._check_eval_pack(entry, assume_yes=False)
    text = buf.getvalue()
    assert "FST" in text            # the core lane's need is still named
    assert "spacy" not in text.lower()
