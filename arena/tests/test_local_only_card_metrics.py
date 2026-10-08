"""A local-only corpus reaches no outside service through a language's metrics.

Regression (synthetic Cree-school persona, 2026-10-03): during `mt-eval run`
on a test set marked local-only (sidecar {"transmission": "local-only"} →
transmission mode sealed), the Cree card's eval standard (the external
champollion-lyss package, loaded from the card's evalMetrics) looked words
from the test sentences up on a public online dictionary. Local-only means
no outside service may see them. Now a sealed/local-only run loads none of
the card's eval-standard metrics (nothing on a card can declare one offline),
records each as unavailable with the reason, and the eval-pack gate no
longer demands the packages those metrics would have needed.
"""

from __future__ import annotations

import json

import pytest

from mt_eval_harness import config as config_mod
from mt_eval_harness import language_cards as lc
from mt_eval_harness import plugin_discovery
from mt_eval_harness.plugins import fst_installer
from mt_eval_harness.publish import _build_metric_availability

CARD_METRICS = {
    "lyss-eq": {"module": "champollion_lyss.crk.metrics", "class": "CrkLinterMetric"},
    "lyss-sem": {"module": "champollion_lyss.crk.metrics", "class": "CrkSemanticMetric",
                 "dependencies": ["spacy>=3.7"]},
}
LOCAL_ONLY_POLICY = {"mode": "sealed", "restricted": True,
                     "reason": "the data's steward marked it local-only "
                               "(corpus metadata) — only a model on this "
                               "machine may see it"}


@pytest.fixture
def card(monkeypatch):
    """A card declaring eval-standard metrics; loading them is a test failure."""
    monkeypatch.setattr(fst_installer, "ensure_fst_available",
                        lambda code, name, skip_fst=False: None)
    monkeypatch.setattr(lc, "get_fst_install_info", lambda code: None)
    monkeypatch.setattr(lc, "get_eval_metrics", lambda code: dict(CARD_METRICS))
    loaded = []

    def load(code):
        loaded.append(code)
        return []
    monkeypatch.setattr(plugin_discovery, "_load_language_card_metrics", load)

    def no_install(*a, **kw):
        raise AssertionError("the eval-standard package was fetched")
    monkeypatch.setattr(plugin_discovery, "_ensure_eval_standard_installed",
                        no_install)
    return loaded


def _withheld(plugins):
    return {p.name: p for p in plugins
            if isinstance(p, plugin_discovery._WithheldCardMetric)}


def test_local_only_run_loads_no_card_metric_and_says_why(card, capsys):
    plugins = plugin_discovery.discover_metric_plugins(
        {"target_lang": "crk", "transmission_policy": LOCAL_ONLY_POLICY},
        skip_fst=True)
    assert card == []                                   # nothing imported
    withheld = _withheld(plugins)
    assert set(withheld) == set(CARD_METRICS)
    reason = withheld["lyss-eq"].aggregate([])["unavailable"]
    assert reason.startswith("local-only corpus:") and "outside service" in reason
    assert capsys.readouterr().out.count("NOT loaded for crk") == 1   # said once


def test_a_steward_sidecar_alone_is_enough(card, tmp_path):
    # A log scored before the mark existed carries no sealed policy; the mark
    # on the file itself still withholds (strictness only).
    corpus = tmp_path / "school.tsv"
    corpus.write_text("tânisi\thello\n")
    (tmp_path / "school.tsv.champollion.json").write_text(
        json.dumps({"transmission": "local-only"}))
    plugins = plugin_discovery.discover_metric_plugins(
        {"target_lang": "crk", "corpus_path": str(corpus)}, skip_fst=True)
    assert card == [] and set(_withheld(plugins)) == set(CARD_METRICS)


def test_other_sealed_sets_withhold_too(card):
    plugins = plugin_discovery.discover_metric_plugins(
        {"target_lang": "crk", "transmission_policy": {
            "mode": "sealed", "reason": "segment 'held_out' is sealed"}},
        skip_fst=True)
    reason = _withheld(plugins)["lyss-sem"].aggregate([])["unavailable"]
    assert reason.startswith("sealed corpus (segment 'held_out' is sealed)")


def test_a_corpus_that_may_travel_still_loads_its_card_metrics(card):
    plugins = plugin_discovery.discover_metric_plugins(
        {"target_lang": "crk", "transmission_policy": {"mode": "cleared"}},
        skip_fst=True)
    assert card == ["crk"] and not _withheld(plugins)


def test_run_card_says_the_card_metrics_were_withheld():
    reason = "local-only corpus: this metric comes from …"
    avail = _build_metric_availability(
        scores={}, plugin_metrics={"lyss-eq": {"unavailable": reason},
                                   "lyss-sem": {"unavailable": reason}},
        has_fst=True, morph_accuracy=0.5, morph_coverage=0.5, morph_floor=0.25,
        has_glossary=False, has_references=True, metricx_requested=False)
    for key in ("equivalent_match_rate", "semantic_score"):
        assert avail[key].startswith("unavailable: local-only corpus")
        assert "lyss-eq, lyss-sem" in avail[key]
        assert "not declared" not in avail[key]


# ---------------------------------------------------------------------------
# the eval-pack gate demands nothing a local-only run will not load
# ---------------------------------------------------------------------------

PACK = {"pythonDeps": {"zz_eval_standard_only_dep": "zz-eval-standard-only>=1"},
        "requiresFst": True}


def _entry():
    return {"id": "school", "language_pair": {"target": "crk"}}


def test_gate_still_demands_the_card_packages_for_a_corpus_that_may_travel(monkeypatch):
    for var in ("CI", "MT_EVAL_AUTO_SETUP"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setattr(lc, "get_eval_pack", lambda code: dict(PACK))
    monkeypatch.setattr(fst_installer, "is_fst_installed", lambda code: True)
    with pytest.raises(RuntimeError, match="zz-eval-standard-only"):
        config_mod._check_eval_pack(_entry())


def test_gate_skips_the_card_packages_for_a_local_only_corpus(monkeypatch):
    for var in ("CI", "MT_EVAL_AUTO_SETUP"):
        monkeypatch.delenv(var, raising=False)
    # The FST lane's own dependency is importable here (stdlib stand-in), the
    # eval-standard-only one is not — only the latter may be skipped.
    monkeypatch.setattr(lc, "get_eval_pack", lambda code: {
        "pythonDeps": {"zz_eval_standard_only_dep": "zz>=1", "pyhfst": "json"},
        "requiresFst": True})
    monkeypatch.setattr(fst_installer, "is_fst_installed", lambda code: True)
    import sys
    monkeypatch.setitem(sys.modules, "pyhfst", sys.modules["json"])
    config_mod._check_eval_pack(_entry(), card_metrics_withheld=True)


def test_the_local_fst_lane_is_still_checked(monkeypatch, capsys):
    """The FST lane runs locally, so a local-only corpus still checks it —
    and since Round 8 a missing one is an advisory (the run proceeds, FST
    marked not computed), named with its install command."""
    for var in ("CI", "MT_EVAL_AUTO_SETUP"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setattr(lc, "get_eval_pack", lambda code: dict(PACK))
    monkeypatch.setattr(fst_installer, "is_fst_installed", lambda code: False)
    config_mod._check_eval_pack(_entry(), card_metrics_withheld=True)
    out = capsys.readouterr().out
    assert "FST morphological analyzer" in out
    assert "mt-eval setup --lang crk" in out


def test_validate_does_not_block_a_local_only_file_on_card_packages(monkeypatch, tmp_path):
    for var in ("CI", "MT_EVAL_AUTO_SETUP"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setattr(lc, "get_eval_pack", lambda code: {
        "pythonDeps": {"zz_eval_standard_only_dep": "zz>=1"}, "requiresFst": False})
    corpus = tmp_path / "school.json"
    corpus.write_text(json.dumps([{"id": 1, "source": "hello", "reference": "tânisi"}]))
    cfg = config_mod.RunConfig(corpus_path=str(corpus), target_lang="Plains Cree",
                               target_lang_code="crk", provider="local")
    assert any("zz>=1" in e for e in cfg.validate())          # not marked: blocked
    (tmp_path / "school.json.champollion.json").write_text(
        json.dumps({"transmission": "local-only"}))
    assert not any("EVAL PACK" in e for e in cfg.validate())  # marked: not blocked
