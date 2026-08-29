"""schedule-sanity — the half-epoch-death guard.

The live failure this pins (crk-translate, 2026-07-12, first clean-protocol
run): 97.5% tagged synthetic + 2.5% real mix, honest 42-row real dev →
dev loss bottomed at step ~8k of 115k and drifted up → patience-6 killed the
run at epoch 0.52. The founder's DX ruling: the floor is DERIVED (never a
--min-steps footgun), the runner explains itself, and regimes are named
presets.
"""

import json

import pytest

from nmt_forge.errors import ConfigError
from nmt_forge.training.schedule import REGIMES, explain_stop, plan_schedule


def test_the_crk_failure_is_covered():
    # the real run's shape: ~611k mix rows (2.5% real), eff. batch 16,
    # 3 epochs → ~38.2k steps/epoch, ~115k planned. The interim manual fix
    # was --min-steps 40000; the DERIVED floor must land in that region and
    # must comfortably exceed step 8k (where dev loss bottomed).
    plan = plan_schedule(gold_rows=15_275, synth_rows=595_725,
                         dev_is_real=True, batch_size=4, grad_accum=4,
                         epochs=3)
    assert plan.regime == "synthetic-heavy"
    assert plan.regime_source == "auto-detected"
    assert plan.floor_steps > 8_000 * 2          # far past the false bottom
    assert 30_000 <= plan.floor_steps <= 45_000  # the ~40k region, derived
    assert not plan.dev_informative_early
    # requirement 3: plain language, with the numbers in it
    assert "EXPECTED" in plan.reason and "half an epoch" in plan.reason
    assert f"{plan.floor_steps:,}" in plan.reason


def test_balanced_regime_has_no_floor():
    plan = plan_schedule(gold_rows=8_000, synth_rows=2_000,
                         dev_is_real=True, epochs=3)
    assert plan.regime == "balanced"
    assert plan.floor_steps == 0
    assert plan.dev_informative_early
    assert "no floor" in plan.reason


def test_floor_is_capped_never_most_of_the_run():
    # one epoch of a huge mix with epochs=1: raw floor (1 epoch) == planned;
    # the cap must hold it to 60%
    plan = plan_schedule(gold_rows=1_000, synth_rows=99_000,
                         dev_is_real=True, epochs=1)
    assert plan.floor_steps <= 0.6 * plan.planned_steps + 1


def test_explicit_regime_overrides_detection():
    plan = plan_schedule(gold_rows=9_000, synth_rows=1_000,
                         dev_is_real=True, regime="synthetic-heavy")
    assert plan.regime == "synthetic-heavy"
    assert plan.regime_source == "config"
    assert plan.floor_steps > 0


def test_unknown_regime_refused_with_choices():
    with pytest.raises(ConfigError, match="named schedule preset"):
        plan_schedule(gold_rows=1, synth_rows=1, dev_is_real=True,
                      regime="yolo")


def test_synthetic_dev_in_heavy_regime_gets_a_warning_note():
    plan = plan_schedule(gold_rows=100, synth_rows=900, dev_is_real=False)
    assert any("synthetic dev" in n for n in plan.notes)


def test_generation_metric_recommended_when_dev_loss_uninformative():
    plan = plan_schedule(gold_rows=100, synth_rows=900, dev_is_real=True)
    assert any("GENERATION metric" in n for n in plan.notes)


def test_explain_stop_suppressed_and_fired():
    plan = plan_schedule(gold_rows=100, synth_rows=900, dev_is_real=True,
                         epochs=3)
    history = [{"step": s, "dev_loss": l} for s, l in
               [(20, 3.0), (40, 2.1), (60, 2.4), (80, 2.6)]]
    suppressed = explain_stop(plan, {"requested_at": 60,
                                     "effective_at": plan.floor_steps,
                                     "suppressed": True}, history)
    assert "ASKED to stop" in suppressed and "held" in suppressed
    assert "trajectory" in suppressed and "2.1" in suppressed
    fired = explain_stop(plan, {"requested_at": 60, "effective_at": 60,
                                "suppressed": False}, history)
    assert "fired at step 60" in fired
    assert explain_stop(plan, None, history) is None


def test_run_wires_schedule_and_explains(ws, dev_set, tmp_path, monkeypatch):
    # end to end: a synthetic-heavy config → floor derived and handed to the
    # backend; a scripted premature stop request is suppressed and EXPLAINED
    import sys

    from nmt_forge.training import backends as B
    from nmt_forge.training.run import run
    from tests.conftest import write_jsonl

    run_mod = sys.modules["nmt_forge.training.run"]

    gold = write_jsonl(tmp_path / "gold.jsonl", [
        {"source": f"real {i} tok", "target": f"tgt{i} zam"} for i in range(4)])
    synth = write_jsonl(tmp_path / "synth.jsonl", [
        {"source": f"made {i}", "target": f"mk{i}", "kind": f"k{i % 4}",
         "synthetic": True} for i in range(96)])
    cfg_path = tmp_path / "config.json"
    cfg_path.write_text(json.dumps({
        "run_name": "sched", "workspace": str(ws.root),
        "data": {"gold": [str(gold)], "dev": "toy-dev",
                 "synthetic": [{"path": str(synth), "tag": "<synth>"}]},
        "mix": {"gold_upweight": 1, "kind_cap": 0.3},
        "model": {"backend": "dummy", "batch_size": 2, "grad_accum": 1,
                  "epochs": 3},
        "selection": {"metric": "loss"},
        "decode": {"max_new_tokens": 64},
    }))

    captured = {}

    def spy_make(model_cfg):
        backend = B.DummyBackend(stop_request_at=5)  # absurdly early
        captured["backend"] = backend
        return backend

    monkeypatch.setattr(run_mod, "make_backend", spy_make)
    manifest = run(cfg_path)

    stage = manifest["stages"][0]
    sched = stage["schedule"]
    assert sched["regime"] == "synthetic-heavy"
    assert sched["floor_steps"] > 0
    # the backend received the derived floor — no user flag anywhere
    assert captured["backend"].calls[0]["params"]["floor_steps"] \
        == sched["floor_steps"]
    # the premature stop was suppressed and explained in plain language
    assert stage["stop_event"]["suppressed"] is True
    assert "ASKED to stop" in stage["stop_explanation"]
    assert "EXPECTED" in sched["reason"]

# -- wall-clock reality check (the crk v8 mis-size, 2026-07-14) ----------------

def test_time_budget_refuses_the_v8_shape():
    from nmt_forge.training.schedule import check_time_budget

    # the actual numbers that burned 90 minutes: 27.2s/it, 12,774 steps
    ok, projected, msg = check_time_budget(27.2, 25, 12774, 14)
    assert not ok and projected > 90
    assert "wall-clock budget exceeded" in msg
    assert "mix.synthetic_sample" in msg          # the fix is actionable


def test_time_budget_passes_a_right_sized_run():
    from nmt_forge.training.schedule import check_time_budget

    ok, projected, msg = check_time_budget(7.0, 25, 3400, 14)
    assert ok and projected < 14
    assert "inside" in msg
