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


# -- warm-up is not the rate (school persona, 2026-10) -------------------------
#
# A ~4-minute CPU run printed ≈0.7h: the projection timed the first steps,
# which carry one-time costs. The clock now starts after a warm-up, the first
# projection is LABELLED early, and a steady-state re-estimate follows.

class _Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


def _drive(projector, durations, planned):
    clock = projector.clock
    events = []
    projector.begin(0)
    for step, dt in enumerate(durations, start=1):
        clock.t += dt
        ev = projector.observe(step, planned)
        if ev:
            events.append((step, ev))
    return events


def test_warmup_steps_are_not_timed():
    from nmt_forge.training.schedule import WallClockProjector

    # 10 slow warm-up steps (kernel compile), then 24 it/s
    durations = [8.0] * 10 + [1 / 24] * 6000
    p = WallClockProjector(1.0, warmup_steps=10, calib_steps=25,
                           clock=_Clock())
    events = _drive(p, durations, planned=6000)
    early_step, early = events[0]
    assert early["kind"] == "early" and early_step == 35
    assert early["ok"] and not early["refuse"]
    # ~4 minutes, not ~0.7h: the warm-up never entered the rate
    assert early["projected_hours"] < 0.1
    assert "EARLY" in early["message"] and "warm-up" in early["message"]
    assert "24.0 it/s" in early["message"]           # fast steps stay legible
    assert "~4 min" in early["message"]
    final_step, final = events[1]
    assert final["kind"] == "reestimate" and final_step == 35 + 75
    assert "RE-ESTIMATE" in final["message"] and final["ok"]


def test_moderate_early_overrun_waits_for_the_steady_state():
    from nmt_forge.training.schedule import WallClockProjector

    # still warming up during the early window (2s/it), steady at 0.5s/it;
    # 4,000 steps: early says ~2.2h (over a 1h budget, under 3×), steady ~0.6h
    durations = [5.0] * 10 + [2.0] * 25 + [0.5] * 4000
    p = WallClockProjector(1.0, clock=_Clock())
    events = _drive(p, durations, planned=4000)
    (_, early), (_, final) = events
    assert not early["ok"] and not early["refuse"]
    assert "re-measuring" in early["message"]
    assert final["ok"] and not final["refuse"]


def test_confirmed_overrun_refuses_and_gross_overrun_refuses_early():
    from nmt_forge.training.schedule import WallClockProjector

    # steady 2s/it over 4,000 steps ≈ 2.2h against a 1h budget: refused on
    # the re-estimate
    p = WallClockProjector(1.0, clock=_Clock())
    events = _drive(p, [2.0] * 200, planned=4000)
    assert [ev["kind"] for _, ev in events] == ["early", "reestimate"]
    assert events[-1][1]["refuse"]
    assert "wall-clock budget exceeded" in events[-1][1]["message"]
    # the v8 shape (27.2s/it × 12,774 steps ≈ 96h vs 14h) refuses at once
    p = WallClockProjector(14.0, clock=_Clock())
    events = _drive(p, [27.2] * 200, planned=12774)
    assert len(events) == 1 and events[0][1]["kind"] == "early"
    assert events[0][1]["refuse"] and p.done


def test_no_budget_set_is_named_as_forges_ceiling_not_a_budget():
    from nmt_forge.training.schedule import (DEFAULT_TIME_CEILING_HOURS,
                                             check_time_budget)

    ok, _, msg = check_time_budget(1.0, 25, 600, DEFAULT_TIME_CEILING_HOURS,
                                   user_set=False)
    assert ok and "safety ceiling — no model.time_budget_hours is set" in msg
    ok, _, msg = check_time_budget(200.0, 25, 600, DEFAULT_TIME_CEILING_HOURS,
                                   user_set=False)
    assert not ok and "set model.time_budget_hours to what your user" in msg
    ok, _, msg = check_time_budget(1.0, 25, 600, 2)
    assert "the 2h budget (model.time_budget_hours)" in msg
