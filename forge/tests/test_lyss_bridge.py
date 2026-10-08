"""LYSS-format linters as forge scoring/selection lanes.

The founder question this answers: do the LYSS metric plugins (harness
MetricPlugin protocol — crk today, more languages later) plug into forge and
help in the RIGHT ways? The right ways, pinned by these tests:

1. every numeric plugin aggregate gets a bootstrap CI like any other metric;
2. per-entry computation runs ONCE — 1,000 resamples never re-run an FST;
3. fail-honest survives the bridge: available=False is reported, never
   fabricated into a number;
4. A/B comparison runs paired significance over plugin lanes;
5. checkpoint selection can use the language's own referee
   ("generation:crk_linter:equivalent_match_rate") instead of chrF++;
6. the real champollion-lyss package loads through the same door
   (integration test at the bottom — in-monorepo, no FST required for the
   linter's convention classes).
"""

import sys
from pathlib import Path

import pytest

from nmt_forge.errors import ConfigError, ForgeError, ScoringError
from nmt_forge.guards.ci_scoring import compare, score
from nmt_forge.plugins import PluginLane, load_plugin
from tests.fake_plugin import AlwaysUnavailable, FakeLint

REFS = ["nikî-nipân kwa sem", "ê-wâpamât nel tor", "kîkway pol nar mun"]
MACRON_HYPS = ["nikī-nipān kwa sem", "ê-wâpamât nel tor", "wrong words here now"]


def test_plugin_lane_scores_with_ci():
    report = score(MACRON_HYPS, REFS, plugins=(FakeLint(),), n_bootstrap=100)
    lane = report.scores["fake_lint:equivalent_match_rate"]
    # the harness rounds CI point scores to 4 decimals
    assert lane["score"] == pytest.approx(2 / 3, abs=1e-3)
    assert lane["ci_lower"] <= lane["score"] <= lane["ci_upper"]
    agg = report.plugin_aggregates["fake_lint"]
    assert agg["display_name"] == "Fake LYSS Linter"
    assert agg["variant_class_counts"] == {"LONG_VOWEL_MACRON": 1}
    out = report.format()
    assert "fake_lint:equivalent_match_rate" in out
    assert "LONG_VOWEL_MACRON=1" in out


def test_compute_runs_once_per_entry_despite_bootstrap():
    FakeLint.compute_calls = 0
    score(MACRON_HYPS, REFS, plugins=(FakeLint(),), n_bootstrap=500)
    # 3 entries → exactly 3 compute() calls; the 500 resamples re-aggregate
    # cached results (an FST-backed linter must never run 1500×)
    assert FakeLint.compute_calls == 3


def test_bookkeeping_keys_are_not_scored():
    report = score(MACRON_HYPS, REFS, plugins=(FakeLint(),), n_bootstrap=50)
    assert "fake_lint:scored_count" not in report.scores


def test_unavailable_plugin_is_reported_never_fabricated():
    report = score(MACRON_HYPS, REFS, plugins=(AlwaysUnavailable(),),
                   n_bootstrap=50)
    assert not any(k.startswith("unavailable_metric:") for k in report.scores)
    agg = report.plugin_aggregates["unavailable_metric"]
    assert agg["available"] is False
    assert "UNAVAILABLE" in report.format() and "mt-eval setup" in report.format()


def test_compare_runs_significance_over_plugin_lane():
    # enough rows for a paired AR test to reach significance (with n=3 the
    # permutation space caps p at 0.25 — a small-n honesty of the test itself)
    refs = [f"nikî-wâpam {i} tok sem" for i in range(12)]
    perfect = list(refs)
    garbage = ["zzz aaa bbb ccc"] * len(refs)
    report = compare(perfect, garbage, refs, plugins=(FakeLint(),),
                     labels=("clean", "junk"),
                     n_trials=200, n_bootstrap_ci=50)
    lane = report.results["fake_lint:equivalent_match_rate"]
    assert lane["score_a"] == 1.0 and lane["score_b"] == 0.0
    assert lane["winner"] == "clean"
    assert report.plugin_aggregates["fake_lint"]["junk"]["equivalent_match_rate"] == 0.0


def test_selection_on_lyss_lane_beats_loss(ws):
    # ckpt-2 has the best LOSS; ckpt-3 emits macron VARIANTS of the refs —
    # chrF++ would punish the diacritics, the LYSS lane rules them equivalent
    from nmt_forge.training.backends import DummyBackend
    from nmt_forge.training.selection import select_checkpoint

    dev = [{"source": f"s{i} alpha beta", "target": r}
           for i, r in enumerate(REFS)]
    macron = {d["source"]: d["target"].translate(
        str.maketrans("âêîôû", "āēīōū")) for d in dev}
    backend = DummyBackend(dev_losses=[3.0, 1.0, 2.0],
                           decode_tables={"ckpt-3": macron})
    result = backend.train([], dev, {}, "/tmp/x")
    report = select_checkpoint(
        result, metric_spec="generation:fake_lint:equivalent_match_rate",
        backend=backend, dev_rows=dev,
        decode_params={"max_new_tokens": 64},
        plugins=(FakeLint(),), n_bootstrap=50,
    )
    assert report.selected.id == "ckpt-3"
    assert report.per_checkpoint[0]["fake_lint:equivalent_match_rate"] == 1.0


def test_selection_plugin_lane_without_plugin_is_actionable():
    from nmt_forge.training.backends import DummyBackend
    from nmt_forge.training.selection import select_checkpoint

    dev = [{"source": "s alpha", "target": "t beta"}]
    backend = DummyBackend()
    result = backend.train([], dev, {}, "/tmp/x")
    with pytest.raises(ScoringError, match="selection.plugins"):
        select_checkpoint(
            result, metric_spec="generation:fake_lint:equivalent_match_rate",
            backend=backend, dev_rows=dev,
            decode_params={"max_new_tokens": 64}, n_bootstrap=50,
        )


def test_load_plugin_spec_forms():
    plugin = load_plugin("tests.fake_plugin:FakeLint")
    assert plugin.name == "fake_lint"
    with pytest.raises(ConfigError, match="module:ClassName"):
        load_plugin("no-colon-here")
    with pytest.raises(ForgeError, match="cannot import"):
        load_plugin("no.such.module:Thing")
    with pytest.raises(ForgeError, match="no attribute"):
        load_plugin("tests.fake_plugin:Ghost")
    with pytest.raises(ForgeError, match="MetricPlugin-shaped"):
        load_plugin("pathlib:Path")


def test_run_config_carries_plugin_specs(ws, dev_set, tmp_path):
    import json

    from nmt_forge.training.run import run
    from tests.conftest import write_jsonl

    gold = write_jsonl(tmp_path / "gold.jsonl", [
        {"source": f"the florp {i} sings", "target": f"florpa{i} zam"}
        for i in range(5)
    ])
    cfg = {
        "run_name": "lyss-run",
        "workspace": str(ws.root),
        "data": {"gold": [str(gold)], "dev": "toy-dev", "synthetic": []},
        "mix": {"gold_upweight": 1},
        "model": {"backend": "dummy"},
        "selection": {"metric": "generation:fake_lint:equivalent_match_rate",
                      "plugins": ["tests.fake_plugin:FakeLint"]},
        "decode": {"max_new_tokens": 64},
    }
    cfg_path = tmp_path / "config.json"
    cfg_path.write_text(json.dumps(cfg))
    manifest = run(cfg_path)
    sel = manifest["stages"][0]["selection"]
    assert sel["metric"] == "generation:fake_lint:equivalent_match_rate"
    assert "fake_lint" in manifest["dev_report"]["plugin_aggregates"]


# -- the real thing -----------------------------------------------------------

_LYSS_DIR = Path(__file__).resolve().parents[2] / "lyss"


def _real_lyss_available() -> bool:
    if not (_LYSS_DIR / "champollion_lyss").is_dir():
        return False
    if str(_LYSS_DIR) not in sys.path:
        sys.path.insert(0, str(_LYSS_DIR))
    try:
        import champollion_lyss.crk.metrics  # noqa: F401

        return True
    except Exception:
        return False


@pytest.mark.skipif(not _real_lyss_available(),
                    reason="champollion-lyss not importable (monorepo lyss/)")
def test_real_champollion_lyss_linter_through_the_bridge():
    """The actual crk referee, unmodified, through the same door future
    languages will use. No FST needed: the linter's convention classes are
    pure; only LEMMA_SYNONYM detection degrades (honestly flagged)."""
    from champollion_lyss.crk.metrics import CrkLinterMetric

    refs = ["nikî-nipân", "ê-wâpamât", "kîkway nipiy"]
    hyps = ["nikī-nipān", "ê-wâpamât", "totally wrong"]  # macron variant / exact / miss
    report = score(hyps, refs, plugins=(CrkLinterMetric(),), n_bootstrap=100)
    lane = report.scores["crk_linter:equivalent_match_rate"]
    assert lane["score"] == pytest.approx(2 / 3, abs=1e-3)
    agg = report.plugin_aggregates["crk_linter"]
    assert agg["variant_class_counts"].get("LONG_VOWEL_MACRON") == 1
    assert agg["display_name"] == "LYSS Equivalence Linter"
    # the LYSS role envelope survives into the manifest untouched
    assert agg.get("lyss_role") or agg.get("is_equivalence_linter")


@pytest.mark.skipif(not _real_lyss_available(),
                    reason="champollion-lyss not importable (monorepo lyss/)")
def test_real_lyss_linted_chrf_lane():
    from champollion_lyss.crk.metrics import CrkLintedChrF

    refs = ["nikî-nipân", "kîkway nipiy"]
    hyps = ["nikī-nipān", "kîkway nipiy"]  # variant + exact → both saturate
    report = score(hyps, refs, plugins=(CrkLintedChrF(),), n_bootstrap=50)
    lane = report.scores["crk_linted_chrf:linted_chrf_mean"]
    assert lane["score"] == pytest.approx(100.0, abs=1e-6)
    # raw chrF is reported alongside so the correction stays visible
    assert "crk_linted_chrf:raw_chrf_mean" in report.scores
    assert report.scores["crk_linted_chrf:raw_chrf_mean"]["score"] < 100.0