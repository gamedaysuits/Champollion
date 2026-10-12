"""schedule-sanity — the early-stop floor is DERIVED, never a magic flag.

The failure this mechanizes (crk-translate, 2026-07-12 — the first
clean-protocol run): training mix 97.5% tagged synthetic + 2.5% real; dev =
42 real, untagged, group-disjoint (honest). Early in training the model fits
the synthetic mass, so dev loss on REAL sentences bottoms fast (step ~8k of
115k) and drifts upward; patience-6 declared convergence at HALF AN EPOCH.
The bug was invisible in every prior run because their dev was
(illegitimately) the test set — the honest protocol is what surfaced it.

Founder ruling on DX: "user must know to pass --min-steps 40000" is a
footgun, not a tool. So:

1. the floor is AUTO — derived from the data mix and the plan
   (max(one full pass over the mix, 30% of planned steps), capped at 60%),
   and it activates only in the regime that needs it;
2. the runner KNOWS when dev loss is uninformative early (synthetic-
   dominated mix + real dev) and says so;
3. every intervention — a floor suppressing a stop, or a stop firing —
   explains itself in plain language with the trajectory, not raw logs;
4. regimes are NAMED presets ("synthetic-heavy", "balanced"), picked (or
   auto-detected), not ten flags.

Interim fix upstream: crk-translate ``train_moonshot.py`` FlooredEarlyStopping
(--min-steps). This module is that fix generalized, made automatic, and made
talkative.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from ..errors import ConfigError

REGIMES = {
    # synthetic mass dominates; real dev loss is uninformative early —
    # hold early stopping until the floor, evaluate at a coarse cadence
    "synthetic-heavy": {
        "floor_epochs": 1.0,        # ≥ one full pass over the mix…
        "floor_fraction": 0.30,     # …and ≥ 30% of planned steps
        "floor_cap_fraction": 0.60,  # never floor away most of the run
        "patience": 6,
        "eval_steps": 2000,
    },
    # mostly real data; standard early stopping is trustworthy from the start
    "balanced": {
        "floor_epochs": 0.0,
        "floor_fraction": 0.0,
        "floor_cap_fraction": 0.0,
        "patience": 6,
        "eval_steps": 2000,
    },
}

# a mix is synthetic-dominated when synthetic rows are at least this fraction
SYNTHETIC_DOMINANCE = 0.5

# small runs evaluate on a cadence derived from their length (≈ this many dev
# evaluations per run); large runs keep the preset's eval_steps
EVALS_PER_RUN = 10


@dataclass
class SchedulePlan:
    regime: str
    regime_source: str              # "auto-detected" | "config"
    synthetic_fraction: float
    dev_is_real: bool
    steps_per_epoch: int
    planned_steps: int
    floor_steps: int
    patience: int
    eval_steps: int
    dev_informative_early: bool
    reason: str                     # plain language — requirement 3
    notes: list[str] = field(default_factory=list)

    def to_manifest(self) -> dict:
        return {
            "guard": "schedule-sanity",
            "regime": self.regime,
            "regime_source": self.regime_source,
            "synthetic_fraction": round(self.synthetic_fraction, 4),
            "dev_is_real": self.dev_is_real,
            "steps_per_epoch": self.steps_per_epoch,
            "planned_steps": self.planned_steps,
            "floor_steps": self.floor_steps,
            "patience": self.patience,
            "eval_steps": self.eval_steps,
            "dev_informative_early": self.dev_informative_early,
            "reason": self.reason,
            "notes": self.notes,
        }


def plan_schedule(
    *,
    gold_rows: int,
    synth_rows: int,
    dev_is_real: bool,
    batch_size: int = 4,
    grad_accum: int = 4,
    epochs: float = 3,
    regime: str = "auto",
) -> SchedulePlan:
    """Derive the training schedule from the mix — the user supplies nothing.

    ``regime="auto"`` detects synthetic dominance from the mix itself;
    explicit regimes are honored (and recorded as config-chosen).
    """
    total = gold_rows + synth_rows
    if total <= 0:
        raise ConfigError("schedule planning needs a non-empty training mix")
    if regime not in ("auto",) + tuple(REGIMES):
        raise ConfigError(
            f"unknown regime {regime!r}; pick one of "
            f"{('auto',) + tuple(REGIMES)} — a regime is a named schedule "
            "preset, not a collection of flags"
        )
    synthetic_fraction = synth_rows / total
    if regime == "auto":
        chosen = ("synthetic-heavy"
                  if synthetic_fraction >= SYNTHETIC_DOMINANCE else "balanced")
        source = "auto-detected"
    else:
        chosen = regime
        source = "config"
    preset = REGIMES[chosen]

    eff_batch = max(1, batch_size) * max(1, grad_accum)
    steps_per_epoch = max(1, math.ceil(total / eff_batch))
    planned_steps = max(1, math.ceil(steps_per_epoch * epochs))

    floor = max(
        math.ceil(preset["floor_epochs"] * steps_per_epoch),
        math.ceil(preset["floor_fraction"] * planned_steps),
    )
    cap = math.ceil(preset["floor_cap_fraction"] * planned_steps)
    floor = min(floor, cap) if cap else 0

    dev_informative_early = not (
        chosen == "synthetic-heavy" and dev_is_real
    )

    if chosen == "synthetic-heavy":
        reason = (
            f"the mix is {synthetic_fraction:.1%} synthetic and the dev set "
            f"is {'REAL' if dev_is_real else 'not flagged real'}: early in "
            "training the model fits the synthetic mass, so dev loss on real "
            "sentences bottoms fast and drifts up — that pattern is EXPECTED, "
            "not convergence (a clean-protocol crk run died at half an epoch "
            "this way). Early stopping is therefore held until step "
            f"{floor:,} = max(1 full pass over the mix = {steps_per_epoch:,} "
            f"steps, 30% of the {planned_steps:,} planned steps), then "
            f"patience {preset['patience']} applies as usual."
        )
    else:
        reason = (
            f"the mix is {synthetic_fraction:.1%} synthetic (below the "
            f"{SYNTHETIC_DOMINANCE:.0%} dominance threshold): dev loss is "
            "informative from the start; standard early stopping applies "
            "with no floor."
        )
    notes = []
    if chosen == "synthetic-heavy" and dev_is_real:
        notes.append(
            "dev loss is UNINFORMATIVE early in this regime; checkpoint "
            "selection should use a dev GENERATION metric "
            "(selection.metric 'generation:…' — the forge default) rather "
            "than loss alone"
        )
    if chosen == "synthetic-heavy" and not dev_is_real:
        notes.append(
            "dev rows carry synthetic markers — a synthetic dev tracks the "
            "synthetic mass, which hides exactly the failure this guard "
            "exists for; prefer a real dev carve"
        )
    return SchedulePlan(
        regime=chosen,
        regime_source=source,
        synthetic_fraction=synthetic_fraction,
        dev_is_real=dev_is_real,
        steps_per_epoch=steps_per_epoch,
        planned_steps=planned_steps,
        floor_steps=floor,
        patience=preset["patience"],
        # evaluate ~10× per run, never sparser than the preset cadence: a
        # fixed 2,000-step cadence meant a 1,600-pair run (≈300 steps) was
        # NEVER evaluated and the trainer refused with "no eval checkpoints"
        eval_steps=min(preset["eval_steps"],
                       max(1, math.ceil(planned_steps / EVALS_PER_RUN))),
        dev_informative_early=dev_informative_early,
        reason=reason,
        notes=notes,
    )


def explain_stop(plan: SchedulePlan, stop_event: dict | None,
                 history: list[dict]) -> str | None:
    """Plain-language account of what early stopping did (requirement 3).

    ``stop_event``: {"requested_at": step, "effective_at": step,
    "suppressed": bool} as reported by the backend; None = ran to plan.
    """
    if not stop_event:
        return None
    losses = [(h["step"], h["dev_loss"]) for h in history
              if h.get("dev_loss") is not None]
    trajectory = ", ".join(f"{s:,}→{l:.3g}" for s, l in losses[:12])
    if len(losses) > 12:
        trajectory += f", … ({len(losses)} evals total)"
    if stop_event.get("suppressed"):
        return (
            f"early stopping ASKED to stop at step "
            f"{stop_event['requested_at']:,} but the schedule floor "
            f"({plan.floor_steps:,}) held training, because: {plan.reason}\n"
            f"dev-loss trajectory: {trajectory}\n"
            f"training continued to step {stop_event['effective_at']:,}."
        )
    return (
        f"early stopping fired at step {stop_event['requested_at']:,} "
        f"(floor {plan.floor_steps:,} already passed; patience "
        f"{plan.patience}).\ndev-loss trajectory: {trajectory}"
    )


# -- wall-clock reality check (2026-07-14, the v8 mis-size) ---------------------
#
# forge derived STEPS from the mix but never projected TIME: a corpus whose
# rows were ~5x longer than the reference made 12,774 "overnight" steps into
# a ~90-hour job, discovered 90 minutes in by a human watching the monitor.
# The fix mirrors generation-headroom's philosophy — measure BEFORE the
# compute is spent: after a short calibration window the observed sec/it is
# projected over the planned steps and checked against a budget; a run that
# cannot finish inside it is refused minutes in, not days.
#
# Warm-up (2026-10, a school persona): the first steps carry one-time costs —
# kernel compilation, allocator and data-loader warm-up — so a rate measured
# over them projected a ~4-minute run as ≈0.7h. The WallClockGate starts its
# clock AFTER a short warm-up, labels its first projection an EARLY estimate,
# and re-measures over a longer steady-state window before it refuses (a
# gross overrun still refuses at once).

#: The ceiling the wall-clock gate applies when the config sets no
#: ``model.time_budget_hours`` (FAILURE_TAXONOMY §8.6): forge's guard against
#: a days-long run, NOT a budget anyone chose — the projection says which.
#: ``nmt-forge init`` writes no budget (forge never invents one, Round 5):
#: the user's number goes in once the early estimate has measured the speed.
DEFAULT_TIME_CEILING_HOURS = 24.0


def budget_phrase(budget_hours: float, user_set: bool = True) -> str:
    """How a projection names its limit: the user's budget, or forge's
    ceiling when none was set."""
    if user_set:
        return f"the {budget_hours:g}h budget (model.time_budget_hours)"
    return (f"forge's {budget_hours:g}h safety ceiling — no "
            "model.time_budget_hours is set; set it from what your user says")


def check_time_budget(sec_per_it: float, done_steps: int, planned_steps: int,
                      budget_hours: float, *,
                      label: str = "wall-clock projection",
                      user_set: bool = True,
                      ) -> tuple[bool, float, str]:
    """Project total wall-clock from a calibration window.

    Returns (ok, projected_hours, message). ``ok`` is False when the
    projection exceeds the budget — the caller refuses with the message.
    ``label`` names WHICH projection this is (the WallClockGate prints an
    early estimate after the warm-up, then a steady-state re-estimate).
    ``user_set`` False: ``budget_hours`` is :data:`DEFAULT_TIME_CEILING_HOURS`
    (the config set no budget), and the message says so.
    """
    projected_hours = planned_steps * sec_per_it / 3600.0
    limit = budget_phrase(budget_hours, user_set)
    if projected_hours <= budget_hours:
        return True, projected_hours, (
            f"[schedule-sanity] {label}: {format_rate(sec_per_it)} over "
            f"{planned_steps:,} steps ≈ {planned_hours_str(projected_hours)} "
            f"— inside {limit}")
    return False, projected_hours, (
        f"wall-clock budget exceeded: measured {format_rate(sec_per_it)} over "
        f"{done_steps} timed steps projects "
        f"{planned_hours_str(projected_hours)} for {planned_steps:,} planned "
        f"steps — over {limit}\n"
        "  why: a mix whose rows are longer than the reference multiplies "
        "per-step cost; discovering that hours in wastes the compute the "
        "guards exist to protect (the crk v8 mis-size, 2026-07-14)\n"
        "  fix: shrink the mix (mix.synthetic_sample), "
        + ("raise model.time_budget_hours if you truly accept the wall-clock"
           if user_set else
           "set model.time_budget_hours to what your user accepts")
        + ", or reduce sequence length via model.max_src/max_tgt"
    )


def format_rate(sec_per_it: float) -> str:
    """12.3s/it for slow steps, 24.1 it/s for fast ones (a 0.04 s/it step
    must not print as "0.0s/it")."""
    if 0 < sec_per_it < 1:
        return f"{1 / sec_per_it:.1f} it/s"
    return f"{sec_per_it:.1f}s/it"


def planned_hours_str(hours: float) -> str:
    if hours >= 48:
        return f"~{hours / 24:.1f} days"
    if hours >= 1:
        return f"~{hours:.1f}h"
    minutes = hours * 60
    return "under a minute" if minutes < 1 else f"~{minutes:.0f} min"


class WallClockProjector:
    """The WallClockGate's arithmetic, framework-free (a fake clock tests
    it; the HF backend's TrainerCallback is a thin wrapper).

    Feed it every finished step with :meth:`observe`; it answers at most
    twice:

    - ``kind="early"`` after ``warmup_steps`` untimed steps plus
      ``calib_steps`` timed ones — an estimate, labelled as one;
    - ``kind="reestimate"`` after ``confirm_steps`` more — the steady-state
      projection the budget decision rests on.

    ``refuse`` is True on the re-estimate when it is over budget, or on the
    early estimate when that is already more than ``gross_factor`` × the
    budget (waiting would only spend the compute the gate protects).
    """

    def __init__(self, budget_hours: float, *, warmup_steps: int = 10,
                 calib_steps: int = 25, confirm_steps: int | None = None,
                 gross_factor: float = 3.0, clock=None,
                 user_set: bool = True):
        import time as _time

        self.budget_hours = budget_hours
        self.user_set = user_set
        self.warmup_steps = warmup_steps
        self.calib_steps = calib_steps
        self.confirm_steps = (3 * calib_steps if confirm_steps is None
                              else confirm_steps)
        self.gross_factor = gross_factor
        self.clock = clock or _time.monotonic
        self.step0: int | None = None
        self._t0 = self._s0 = self._t1 = self._s1 = None
        self.early: dict | None = None
        self.final: dict | None = None

    @property
    def done(self) -> bool:
        return self.final is not None

    def begin(self, step: int) -> None:
        self.step0 = int(step)

    def observe(self, step: int, planned_steps: int) -> dict | None:
        if self.done or self.step0 is None:
            return None
        step = int(step)
        if self._t0 is None:
            if step - self.step0 >= self.warmup_steps:
                self._t0, self._s0 = self.clock(), step
            return None
        if self.early is None:
            timed = step - self._s0
            if timed < self.calib_steps:
                return None
            spi = (self.clock() - self._t0) / timed
            confirm_at = step + self.confirm_steps
            ok, projected, msg = check_time_budget(
                spi, timed, planned_steps, self.budget_hours,
                label=(f"EARLY wall-clock estimate (steps {self._s0 + 1}–"
                       f"{step}, after a {self.warmup_steps}-step warm-up; "
                       f"re-measured at step {confirm_at:,})"),
                user_set=self.user_set)
            refuse = not ok and projected > self.gross_factor * self.budget_hours
            if not ok and not refuse:
                msg = (f"[schedule-sanity] EARLY wall-clock estimate "
                       f"{format_rate(spi)} ≈ {planned_hours_str(projected)} "
                       f"is over {budget_phrase(self.budget_hours, self.user_set)}"
                       f" — re-measuring until step {confirm_at:,} before "
                       "deciding (warm-up can still be fading)")
            self.early = {"kind": "early", "ok": ok, "refuse": refuse,
                          "sec_per_it": spi, "projected_hours": projected,
                          "confirm_at": confirm_at, "message": msg}
            self._t1, self._s1 = self.clock(), step
            if refuse:
                self.final = self.early
            return self.early
        timed = step - self._s1
        if timed < self.confirm_steps:
            return None
        spi = (self.clock() - self._t1) / timed
        ok, projected, msg = check_time_budget(
            spi, timed, planned_steps, self.budget_hours,
            label=(f"wall-clock RE-ESTIMATE (steady state, steps "
                   f"{self._s1 + 1}–{step})"),
            user_set=self.user_set)
        self.final = {"kind": "reestimate", "ok": ok, "refuse": not ok,
                      "sec_per_it": spi, "projected_hours": projected,
                      "message": msg}
        return self.final
