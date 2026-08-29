"""Full referee-stack parity with the harness.

The founder question: why wouldn't forge speak COMET-type neural metrics and
everything else the harness/CLI speak? Answer: it does now, by delegation —
these tests pin the contract:

1. neural lanes (comet/comet-qe/metricx) are first-class scoring/selection
   lanes; inference runs ONCE, bootstrap re-averages cached per-entry scores;
2. unavailable extras report an install fix — no fabricated numbers, and
   SELECTION refuses rather than silently switching metrics;
3. MetricX-class direction (LOWER is better) rides the score everywhere:
   rendering, checkpoint selection, A/B winners;
4. the harness's OWN plugin discovery is one call away (card evalMetrics +
   FST validity + behavioral linters);
5. metric-trust (WMT meta-eval reliability) surfaces in discover, so
   amateurs learn which metric to believe BEFORE selecting on it.
"""

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pytest

from nmt_forge.guards import ci_scoring
from nmt_forge.guards.ci_scoring import compare, score

REFS = [f"zin bel korma ten {i} pol nar" for i in range(10)]


# -- 2: honest unavailability (this environment has no torch) -----------------

def test_comet_unavailable_reports_fix_never_fabricates():
    report = score(REFS, REFS, metrics=("chrf++", "comet"), n_bootstrap=50)
    assert "comet" not in report.scores
    assert "chrf++" in report.scores
    assert "mt-eval[comet]" in report.notes["comet"]
    out = report.format()
    assert "comet: UNAVAILABLE" in out and "mt-eval[comet]" in out


def test_selection_refuses_unavailable_neural_lane():
    from nmt_forge.errors import ScoringError
    from nmt_forge.training.backends import DummyBackend
    from nmt_forge.training.selection import select_checkpoint

    dev = [{"source": f"s{i} tok", "target": r} for i, r in enumerate(REFS)]
    backend = DummyBackend()
    result = backend.train([], dev, {}, "/tmp/x")
    with pytest.raises(ScoringError, match="hidden methodology change"):
        select_checkpoint(result, metric_spec="generation:comet",
                          backend=backend, dev_rows=dev,
                          decode_params={"max_new_tokens": 64}, n_bootstrap=50)


# -- 1 & 3: a scripted neural lane (harness-result-shaped) ---------------------

@dataclass
class FakeNeuralResult:
    per_entry_scores: list
    model_name: str = "fake/error-model-v1"
    low_resource_warning: bool = True


class FakeNeural:
    """Lower-is-better, like MetricX. Counts inference calls."""

    calls: int = 0
    per_hyp: dict = {}

    @classmethod
    def compute(cls, entries, target_lang):
        cls.calls += 1
        return FakeNeuralResult(
            [cls.per_hyp.get(e["predicted"], 5.0) for e in entries])


@pytest.fixture
def fake_lane(monkeypatch):
    FakeNeural.calls = 0
    FakeNeural.per_hyp = {}
    monkeypatch.setitem(ci_scoring.NEURAL_LANES, "fake-neural", {
        "cache_key": "fake_neural_score", "direction": "lower",
        "loader": lambda: FakeNeural.compute, "fix": "install fake-neural",
    })
    return FakeNeural


def test_neural_lane_scored_with_ci_direction_and_meta(fake_lane):
    report = score(REFS, REFS, metrics=("fake-neural",), n_bootstrap=200,
                   target_lang="qaa")
    lane = report.scores["fake-neural"]
    assert lane["score"] == pytest.approx(5.0, abs=1e-3)
    assert lane["direction"] == "lower"
    assert lane["model"] == "fake/error-model-v1"
    assert "low_resource_warning" in lane
    # inference ran ONCE; 200 bootstrap resamples re-averaged cached scores
    assert fake_lane.calls == 1
    out = report.format()
    assert "(lower = better)" in out and "⚠ low-resource" in out


def test_selection_picks_minimum_for_lower_is_better(fake_lane):
    from nmt_forge.training.backends import DummyBackend
    from nmt_forge.training.selection import select_checkpoint

    dev = [{"source": f"s{i} tok", "target": r} for i, r in enumerate(REFS)]
    backend = DummyBackend(dev_losses=[1.0, 2.0, 3.0])
    # ckpt-3 (WORST loss) produces the LOWEST error under the neural lane
    fake_lane.per_hyp = {f"«ckpt-3» {d['source']}": 0.5 for d in dev}
    result = backend.train([], dev, {}, "/tmp/x")
    report = select_checkpoint(
        result, metric_spec="generation:fake-neural", backend=backend,
        dev_rows=dev, decode_params={"max_new_tokens": 64},
        top_k=3, n_bootstrap=50,
    )
    assert report.selected.id == "ckpt-3"
    assert report.per_checkpoint[0]["fake-neural"] == pytest.approx(0.5, abs=1e-3)


def test_compare_winner_flips_for_lower_is_better(fake_lane):
    # system A has LOWER error everywhere → A must win, even though the
    # harness's raw convention is "A wins iff delta > 0"
    hyps_a = [f"good {i}" for i in range(len(REFS))]
    hyps_b = [f"bad {i}" for i in range(len(REFS))]
    fake_lane.per_hyp = {h: 1.0 for h in hyps_a} | {h: 9.0 for h in hyps_b}
    report = compare(hyps_a, hyps_b, REFS, metrics=("fake-neural",),
                     labels=("clean", "junk"), n_trials=200, n_bootstrap_ci=50)
    lane = report.results["fake-neural"]
    assert lane["score_a"] < lane["score_b"]
    assert lane["direction"] == "lower"
    assert lane["winner"] == "clean"
    assert fake_lane.calls == 2  # once per system


# -- 4: the harness's own plugin discovery ------------------------------------

_LYSS_DIR = Path(__file__).resolve().parents[2] / "lyss"


def _lyss_available() -> bool:
    if not (_LYSS_DIR / "champollion_lyss").is_dir():
        return False
    if str(_LYSS_DIR) not in sys.path:
        sys.path.insert(0, str(_LYSS_DIR))
    try:
        import champollion_lyss  # noqa: F401

        return True
    except Exception:
        return False


@pytest.mark.skipif(not _lyss_available(),
                    reason="champollion-lyss not importable (monorepo lyss/)")
def test_harness_plugin_discovery_for_crk():
    from nmt_forge.plugins import discover_plugins_for_language

    plugins = discover_plugins_for_language("crk", skip_fst=True)
    names = {p.name for p in plugins}
    assert "crk_linter" in names        # the card-declared LYSS referee
    for p in plugins:                   # everything is MetricPlugin-shaped
        assert hasattr(p, "compute") and hasattr(p, "aggregate")
    # and the discovered referee runs through forge scoring end to end
    linter = next(p for p in plugins if p.name == "crk_linter")
    report = score(["nikī-nipān"], ["nikî-nipân"], plugins=(linter,),
                   n_bootstrap=50)
    assert "crk_linter:equivalent_match_rate" in report.scores


# -- 5: metric trust in discover -----------------------------------------------

def test_metric_trust_fixture(tmp_path, monkeypatch):
    shared = tmp_path / "shared" / "catalogue"
    shared.mkdir(parents=True)
    (shared / "metric-reliability.json").write_text(json.dumps({
        "languages": {"qq": {"iso639_3": "qqq", "family": "Toylandic"}},
        "families": {"Toylandic": {"n_pairs": 3, "metrics": {
            "chrf_plus_plus": {"sys": {"pearson_r": 0.83}},
            "comet_score": {"sys": {"pearson_r": 0.41}},
        }}},
    }))
    monkeypatch.setenv("CHAMPOLLION_SHARED_DIR", str(tmp_path / "shared"))
    from nmt_forge.cards import metric_trust

    t = metric_trust("qqq")
    assert t["status"] == "measured" and t["family"] == "Toylandic"
    assert t["metrics"]["chrf_plus_plus"] == 0.83
    assert "never cite" in t["note"]
    u = metric_trust("zzz", family="Nowhereic")
    assert u["status"] == "unmeasured" and "chrF++" in u["note"]


def test_metric_trust_in_discover_report(tmp_path, monkeypatch):
    from tests.test_cards import _write_card

    shared = tmp_path / "shared" / "catalogue"
    shared.mkdir(parents=True)
    (shared / "metric-reliability.json").write_text(json.dumps({
        "languages": {}, "families": {}}))
    monkeypatch.setenv("CHAMPOLLION_SHARED_DIR", str(tmp_path / "shared"))
    cards = tmp_path / "cards"
    _write_card(cards, "qaa", {"name": "Toylang A", "family": "Toylandic"})
    from nmt_forge.cards import discover, format_report

    r = discover("qaa", cards_path=cards, check_registry=False)
    assert r.metric_trust["status"] == "unmeasured"
    assert "metric trust: UNMEASURED" in format_report(r)


# -- harness-registry datasets as eval sets -------------------------------------

def test_add_harness_dataset_registers_with_flags(ws, tmp_path, monkeypatch):
    from tests.conftest import write_jsonl

    corpus = write_jsonl(tmp_path / "materialized.jsonl", [
        {"source": f"line {i} tok", "reference": f"ref {i} tok"}
        for i in range(5)
    ])
    import mt_eval_harness.config as hcfg

    monkeypatch.setattr(hcfg, "load_registry", lambda: {"datasets": [
        {"id": "eval-toy-x", "do_not_train": True, "contamination": "HIGH"},
        {"id": "eval-toy-q", "quarantine": True,
         "quarantine_reason": "improper subset"},
    ]})
    monkeypatch.setattr(hcfg, "resolve_dataset",
                        lambda i, assume_yes=False, skip_eval_pack=False: corpus)
    from nmt_forge.errors import ForgeError, RegistryError
    from nmt_forge.harness_data import register_harness_dataset

    summary = register_harness_dataset(ws, "eval-toy-x", "test")
    assert summary["contamination"] == "HIGH" and summary["rows"] == 5
    entry = ws.registry.get("eval-toy-x")
    assert "relative-only" in entry["note"]

    with pytest.raises(RegistryError, match="QUARANTINED"):
        register_harness_dataset(ws, "eval-toy-q", "test")
    with pytest.raises(ForgeError, match="no dataset"):
        register_harness_dataset(ws, "eval-ghost", "test")