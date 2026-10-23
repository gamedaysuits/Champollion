"""Fit the run to the memory it has, before training and when it runs out
(founder 2026-10-14: "if it's failing we need to fix forge … make sure these
constraints and recommendations are coming in").

Two parts:

- ``plan_memory`` — before the first step, from the model forge just loaded:
  how many weights, how many it trains, what the weights + gradients +
  optimizer hold (bytes per weight: 4 for the weight, 4 for its gradient,
  8 for AdamW's two moments, about 0.4 for Adafactor's factored ones), against
  the memory training may use. When those alone leave little room for one
  batch's activations, forge recomputes activations (gradient checkpointing);
  when AdamW cannot fit, Adafactor; when nothing fits, it refuses before any
  compute is spent, with the recommendations. Activations are not estimated:
  they depend on sentence lengths; the step-down below handles them.
- ``next_step_down`` — after an out-of-memory error: the next, least costly
  change that keeps what the run learns from (the same pairs a step):
  recompute activations; then half the batch twice as often; then Adafactor.
  The trainer starts the stage again with it and records every step.

These are estimates, said as such. The record (``memory_plan`` and
``memory_fallbacks`` in the run's backend info) is what happened.
"""

from __future__ import annotations

GB = 2 ** 30
#: bytes per weight held during training (fp32 training, forge's default)
WEIGHT_B, GRAD_B = 4, 4
OPTIM_B = {"adamw": 8.0, "adafactor": 0.4}
#: weights + gradients + optimizer may use at most this share of the cap;
#: above SHARE_CHECKPOINT forge recomputes activations from the start
SHARE_REFUSE, SHARE_CHECKPOINT = 0.85, 0.45


def _optim_kind(p: dict) -> str:
    return "adafactor" if "adafactor" in str(p.get("optim") or "").lower() else "adamw"


def states_gb(total: int, trainable: int, optim: str) -> float:
    return (total * WEIGHT_B + trainable * (GRAD_B + OPTIM_B[optim])) / GB


def memory_limit_gb(gpu_cap: dict | None) -> float | None:
    """What training may use: the Apple-silicon cap, an NVIDIA card's memory, or None (CPU)."""
    if gpu_cap and gpu_cap.get("cap_gb"):
        return float(gpu_cap["cap_gb"])
    try:
        import torch

        if torch.cuda.is_available():
            return round(torch.cuda.get_device_properties(0).total_memory / GB, 1)
    except Exception:            # noqa: BLE001 — no torch, no card: no limit known
        return None
    return None


def plan_memory(model, p: dict, gpu_cap: dict | None) -> dict:
    """{parameters, trainable, optimizer, states_gb, limit_gb, set: {…}, changes: […],
    say, refuse?} — ``set`` holds what forge changes before training."""
    total = sum(x.numel() for x in model.parameters())
    trainable = sum(x.numel() for x in model.parameters() if x.requires_grad)
    limit = memory_limit_gb(gpu_cap)
    optim = _optim_kind(p)
    need = states_gb(total, trainable, optim)
    plan = {"parameters": total, "trainable": trainable, "optimizer": optim, "states_gb": round(need, 1),
            "limit_gb": limit, "set": {}, "changes": [], "estimate": "weights + gradients + optimizer only; "
            "one batch's activations come on top and depend on sentence length"}
    if limit is None:
        plan["say"] = (f"[memory] {total / 1e6:,.0f}M weights ({trainable / 1e6:,.0f}M trained); weights, gradients "
                       f"and optimizer ≈ {need:.1f} GB; no GPU memory limit known (CPU)")
        return plan
    if need > SHARE_REFUSE * limit and optim == "adamw" and trainable > 0:
        alt = states_gb(total, trainable, "adafactor")
        if alt <= SHARE_REFUSE * limit:
            plan["set"]["optim"] = "adafactor"
            plan["changes"].append(f"Adafactor instead of AdamW: AdamW's two copies of every trained weight need "
                                   f"≈ {need:.1f} GB of the {limit:.1f} GB; Adafactor ≈ {alt:.1f} GB")
            need, optim = alt, "adafactor"
    if need > SHARE_REFUSE * limit:
        plan["refuse"] = (
            f"this model cannot train here: its weights, gradients and optimizer alone need ≈ {need:.1f} GB of the "
            f"{limit:.1f} GB training may use ({total / 1e6:,.0f}M weights, {trainable / 1e6:,.0f}M trained)\n"
            "  fix: train fewer weights (LoRA: \"lora\": {\"r\": 16} in the model block), a smaller base model, or a "
            "bigger GPU — semi-sovereign: nmt-forge remote plan config.json")
    elif need > SHARE_CHECKPOINT * limit and not p.get("gradient_checkpointing"):
        plan["set"]["gradient_checkpointing"] = True
        plan["changes"].append(f"recompute activations (gradient checkpointing): the weights, gradients and "
                               f"optimizer take ≈ {need:.1f} of {limit:.1f} GB, leaving little for a batch")
    plan["states_gb"] = round(need, 1)
    plan["optimizer"] = optim
    plan["say"] = (f"[memory] {total / 1e6:,.0f}M weights ({trainable / 1e6:,.0f}M trained, {optim}); weights, "
                   f"gradients and optimizer ≈ {need:.1f} GB of the {limit:.1f} GB training may use"
                   + ("".join(f"\n[memory] forge changes: {c}" for c in plan["changes"])))
    return plan


def next_step_down(p: dict) -> dict | None:
    """The next change after running out of memory, or None when none is left.
    {"set": {…}, "change": plain words}."""
    if not p.get("gradient_checkpointing"):
        return {"set": {"gradient_checkpointing": True},
                "change": "recompute activations instead of keeping them (gradient checkpointing: slower, much "
                          "less memory)"}
    b, acc = int(p.get("batch_size", 4)), int(p.get("grad_accum", 4))
    if b > 1:
        nb = max(1, b // 2)
        na = max(1, (acc * b) // nb)
        return {"set": {"batch_size": nb, "grad_accum": na},
                "change": f"half the batch twice as often ({b}×{acc} → {nb}×{na}: the same {b * acc} pairs a step)"}
    if _optim_kind(p) == "adamw" and not p.get("lora"):
        return {"set": {"optim": "adafactor"},
                "change": "Adafactor instead of AdamW (factored second moments, no first moment: far less memory "
                          "for the optimizer)"}
    return None
