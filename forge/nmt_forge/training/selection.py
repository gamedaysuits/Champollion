"""Checkpoint selection + the generation-headroom guard.

Selection metric options (config ``selection.metric``):

- ``loss`` — the backend's dev loss (dev is FENCED; the loss is legal).
- ``generation:<metric>`` (default ``generation:chrf++``) — decode the dev
  set with the top-K checkpoints by loss and pick the best GENERATION score
  (via the harness, CIs included). This exists because "eval-loss tracks
  generation quality" is an OPEN QUESTION in the requirements ledger — the
  run that suggested otherwise was contaminated — so forge makes the choice
  measurable instead of assumed.

Headroom (mistake #11): decoders capped at 160 tokens with a 107-token max
reference sat close enough to the edge to invite truncation artifacts. The
guard measures max reference length with the backend's OWN tokenizer and
refuses a cap under ``headroom_factor ×`` that.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from ..errors import GenerationHeadroomError, ScoringError
from ..guards import ci_scoring
from .backends import Checkpoint, TrainerBackend, TrainResult


def check_generation_headroom(
    refs: list[str],
    max_new_tokens: int,
    token_len_fn,
    *,
    headroom_factor: float = 1.5,
    sources: list[str] | None = None,
    length_ratio: float | None = None,
    length_margin: int = 32,
) -> dict:
    """Refuse a generation cap that sits near the reference ceiling. With a cap proportional to the input
    (length_ratio), every dev pair must get room: its cap ≥ headroom × its reference."""
    if not refs:
        raise ScoringError("headroom check needs references")
    if length_ratio:
        from .decode_cap import dynamic_cap
        if sources is None or len(sources) != len(refs):
            raise ScoringError("a proportional decode cap is checked pair by pair: pass the dev sources")
        short = []
        for s, r in zip(sources, refs):
            sl, rl = token_len_fn(s), token_len_fn(r)
            if dynamic_cap(max_new_tokens, length_ratio, length_margin, sl) < math.ceil(rl * headroom_factor):
                short.append((sl, rl))
        if short:
            # the smallest ratio (at this margin and ceiling) that gives every dev pair its room
            need_ratio = max((math.ceil(rl * headroom_factor) - length_margin) / max(sl, 1) for sl, rl in
                             ((token_len_fn(s), token_len_fn(r)) for s, r in zip(sources, refs)))
            raise GenerationHeadroomError(
                f"{len(short)} dev pair(s) would be cut: ceil({length_ratio} × input + {length_margin}) "
                f"(at most {max_new_tokens}) is under {headroom_factor} × their reference",
                why="a cap that does not fit the input's own reference truncates exactly the long outputs "
                    "that matter (measured trap: cap 160 vs max ref 107)",
                fix=f"raise decode.length_ratio to ≥ {need_ratio:.2f} (or length_margin), and keep "
                    f"max_new_tokens ≥ {math.ceil(max(token_len_fn(r) for r in refs) * headroom_factor)}")
        return {"guard": "generation-headroom", "mode": "proportional", "length_ratio": length_ratio,
                "length_margin": length_margin, "max_new_tokens": max_new_tokens,
                "headroom_factor": headroom_factor, "pairs_checked": len(refs)}
    max_ref = max(token_len_fn(r) for r in refs)
    required = math.ceil(max_ref * headroom_factor)
    if max_new_tokens < required:
        raise GenerationHeadroomError(
            f"max_new_tokens={max_new_tokens} but the longest reference is "
            f"{max_ref} tokens (× headroom {headroom_factor} → need ≥ {required})",
            why="a cap near the reference ceiling truncates exactly the long "
                "outputs that matter (measured trap: cap 160 vs max ref 107)",
            fix=f"raise decode.max_new_tokens to ≥ {required}, or lower "
                "headroom_factor deliberately in the config",
        )
    return {
        "guard": "generation-headroom",
        "max_ref_tokens": max_ref,
        "max_new_tokens": max_new_tokens,
        "headroom_factor": headroom_factor,
        "required_min": required,
    }


@dataclass
class SelectionReport:
    metric: str
    selected: Checkpoint
    per_checkpoint: list[dict] = field(default_factory=list)
    headroom: dict | None = None

    def to_manifest(self) -> dict:
        return {
            "guard": "checkpoint-selection",
            "metric": self.metric,
            "selected": self.selected.id,
            "selected_step": self.selected.step,
            "per_checkpoint": self.per_checkpoint,
            "headroom": self.headroom,
        }


def select_checkpoint(
    result: TrainResult,
    *,
    metric_spec: str,
    backend: TrainerBackend,
    dev_rows: list[dict],
    decode_params: dict,
    plugins: tuple = (),
    target_lang: str = "",
    top_k: int = 3,
    n_bootstrap: int = 1000,
    headroom_factor: float = 1.5,
) -> SelectionReport:
    """Pick the checkpoint the DEV set says is best (never the test set —
    dev_rows come from the fence).

    ``metric_spec`` may name a LYSS plugin lane —
    ``"generation:crk_linter:equivalent_match_rate"`` — when the matching
    plugin instance is passed in ``plugins``. Selecting on the language's own
    referee instead of chrF++ is exactly the "help in the right ways" hookup.
    """
    if metric_spec == "loss":
        best = result.best_by_loss()
        return SelectionReport(
            metric="loss", selected=best,
            per_checkpoint=[{"id": c.id, "dev_loss": c.dev_loss}
                            for c in result.checkpoints],
        )

    metric = metric_spec.split(":", 1)[1]
    sources = [str(r["source"]) for r in dev_rows]
    refs = [str(r["target"]) for r in dev_rows]
    headroom = check_generation_headroom(
        refs, decode_params.get("max_new_tokens", 256), backend.token_len,
        headroom_factor=headroom_factor,
    )
    # a checkpoint whose weights are gone (rotated out by the trainer's
    # save_total_limit → path None) can't be decoded; considering it would
    # decode some OTHER model under its name
    on_disk = [c for c in result.checkpoints if c.path is not None]
    # rank by the dev translations' score when training measured it (the
    # better guide with little data — see backends.train), else by dev loss
    if any(c.dev_score is not None for c in on_disk):
        with_loss = sorted((c for c in on_disk if c.dev_score is not None),
                           key=lambda c: -c.dev_score)
    else:
        with_loss = sorted((c for c in on_disk if c.dev_loss is not None),
                           key=lambda c: c.dev_loss)
    candidates = (with_loss[:top_k] if with_loss else on_disk[:top_k])
    if not candidates:
        raise ScoringError(
            "no checkpoints with weights on disk to select from",
            why="every evaluated checkpoint was rotated out before selection",
            fix="raise model.save_total_limit (forge keeps 4 by default)",
        )
    scored: list[tuple[float, Checkpoint, dict]] = []
    direction = "higher"
    for ckpt in candidates:
        hyps = backend.decode(ckpt, sources, decode_params)
        base_metrics = () if ":" in metric else (metric,)
        report = ci_scoring.score(hyps, refs, sources, metrics=base_metrics,
                                  plugins=plugins, target_lang=target_lang,
                                  n_bootstrap=n_bootstrap)
        if metric in report.notes:
            raise ScoringError(
                f"selection metric {metric!r} is unavailable: "
                f"{report.notes[metric]}",
                why="silently selecting on a DIFFERENT metric than the config "
                    "names would be a hidden methodology change",
                fix="install the metric's extra, or change selection.metric "
                    "(chrf++ needs nothing beyond the harness)",
            )
        if metric not in report.scores:
            raise ScoringError(
                f"selection metric {metric!r} not among scored lanes "
                f"{sorted(report.scores)}",
                why="a plugin lane needs its plugin instance to run",
                fix="add the plugin to selection.plugins (config: "
                    "'module.path:ClassName') so the lane exists, or pick a "
                    "built-in metric (chrf++/bleu/exact_match) or neural lane "
                    "(comet/comet-qe/metricx)",
            )
        s = report.scores[metric]
        direction = s.get("direction", "higher")
        row = {
            "id": ckpt.id, "dev_loss": ckpt.dev_loss,
            **({"dev_score_in_training": ckpt.dev_score} if ckpt.dev_score is not None else {}),
            metric: s["score"], "ci": [s["ci_lower"], s["ci_upper"]],
        }
        if s.get("low_resource_warning"):
            row["low_resource_warning"] = s["low_resource_warning"]
        scored.append((s["score"], ckpt, row))
    # MetricX-class lanes are LOWER-is-better; the direction rides with the
    # score so selection can never invert it silently
    scored.sort(key=lambda t: t[0], reverse=(direction != "lower"))
    return SelectionReport(
        metric=metric_spec,
        selected=scored[0][1],
        per_checkpoint=[row for _, _, row in scored],
        headroom=headroom,
    )
