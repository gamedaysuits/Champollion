"""How much of the computer's memory training may use (2026-10-13; revised
2026-10-14 by the founder's ruling: "forge does not need to have a 16gb
limit, we have 24gb locally, if it's failing we need to fix forge").

On Apple silicon the GPU shares the computer's memory. PyTorch lets its GPU
pool grow to 1.7 times Apple's "recommended" working set (about 2/3 of the
memory) — more than the computer has: uncapped, a ByT5-small run on a 24 GB
Mac held 19 GB and pushed everything else into swap. Capped at the
recommended 16 GB, NLLB-600M (full) and NLLB-1.3B (LoRA) ran out.

So training gets **the computer's memory less a reserve for everything else**
(``RESERVE_GB_MIN`` or ``RESERVE_SHARE`` of it, whichever is larger), never
less than the recommended working set and never more than PyTorch's own 1.7x:
about 20 GB on a 24 GB Mac, 12 GB on a 16 GB one, the recommended 5.3 GB on an
8 GB one. ``model.mps_memory_fraction`` in config.json sets the share of the
recommended working set itself (0 < f ≤ 2); an explicit
``PYTORCH_MPS_HIGH_WATERMARK_RATIO`` in the environment is respected as it is.
The cap is recorded with the run. A run that needs more than the cap is not
left to fail: the trainer steps down (``memory_plan.next_step_down``) and
says so; only when nothing fits does it stop, with what to do
(``out_of_memory_text``). An NVIDIA card has its own memory: nothing is capped
there.
"""

from __future__ import annotations

import os

#: what training leaves for the operating system and everything else open
RESERVE_GB_MIN = 4.0
RESERVE_SHARE = 0.15
#: PyTorch's own default ceiling (as a share of the recommended working set)
MAX_FRACTION = 1.7
ENV = "PYTORCH_MPS_HIGH_WATERMARK_RATIO"
#: Where PyTorch starts handing cached GPU memory back: its default (1.4) sits
#: above a cap below 1.4, so the pool would never be tidied before the cap —
#: and an environment that sets the cap alone is refused outright ("invalid
#: low watermark ratio 1.4": the Klingon ladder's first capped restart,
#: 2026-10-13). Set to this share of the cap unless the environment says.
LOW_ENV = "PYTORCH_MPS_LOW_WATERMARK_RATIO"
LOW_SHARE = 0.8
GB = 2 ** 30


def _low_for(cap_ratio: float) -> None:
    """The cleanup threshold under the cap (read when the GPU pool is first made)."""
    if cap_ratio > 0 and not os.environ.get(LOW_ENV):
        os.environ[LOW_ENV] = f"{min(1.4, cap_ratio * LOW_SHARE):.3f}"


def auto_fraction(recommended_bytes: float, total_gb: float | None) -> float:
    """The share of the recommended working set training may hold: the
    computer's memory less the reserve, within [1.0, MAX_FRACTION]."""
    if not total_gb or recommended_bytes <= 0:
        return 1.0
    reserve = max(RESERVE_GB_MIN, RESERVE_SHARE * total_gb)
    want = (total_gb - reserve) * GB
    return round(min(MAX_FRACTION, max(1.0, want / recommended_bytes)), 3)


def _total_gb() -> float | None:
    from .presets import _mem_gb

    return _mem_gb()


def cap_gpu_memory(fraction=None) -> dict | None:
    """Cap the Apple-silicon GPU pool before training allocates anything:
    {device, fraction, cap_gb, recommended_gb, computer_gb, chosen_by}, or
    None where there is no such GPU (or no torch)."""
    try:
        import torch
    except ImportError:
        return None
    mps = getattr(torch.backends, "mps", None)
    if mps is None or not mps.is_available():
        return None
    rec = torch.mps.recommended_max_memory()
    if os.environ.get(ENV):
        ratio = float(os.environ[ENV])
        _low_for(ratio)
        return {"device": "mps", "set_by": ENV, "fraction": ratio,
                "cap_gb": round(ratio * rec / GB, 1) if ratio > 0 else None,
                "recommended_gb": round(rec / GB, 1)}
    total = _total_gb()
    if fraction is None:
        f = auto_fraction(rec, total)
        chosen = (f"this computer's memory ({total:.0f} GB) less "
                  f"{max(RESERVE_GB_MIN, RESERVE_SHARE * total):.0f} GB for everything else" if total
                  else "the GPU's recommended working set (the computer's memory is unknown)")
    else:
        f = float(fraction)
        chosen = "model.mps_memory_fraction in config.json"
    if not 0 < f <= 2:
        from ..errors import BackendError

        raise BackendError(
            f"model.mps_memory_fraction is {f}: it is a share of the GPU's recommended memory, above 0 and at most 2\n"
            "  fix: leave it out (forge then uses the computer's memory less a reserve), or set e.g. 1.2 for more "
            "room, 0.8 for less, in config.json")
    _low_for(f)
    torch.mps.set_per_process_memory_fraction(f)
    return {"device": "mps", "fraction": f, "cap_gb": round(f * rec / GB, 1), "recommended_gb": round(rec / GB, 1),
            "computer_gb": round(total, 1) if total else None, "chosen_by": chosen}


def out_of_memory_text(cap: dict | None, *, tried: list | None = None, config_hint: str = "") -> str:
    """What to say when nothing forge tried fits in the memory training may use."""
    where = (f"the {cap.get('cap_gb')} GB training may use on this computer" if cap and cap.get("cap_gb")
             else "this GPU's memory")
    steps = "; ".join(t["change"] for t in tried or []) or "nothing"
    return (f"training needs more memory than {where}, after forge tried: {steps}\n"
            "  why: the model's weights, its optimizer and the activations of one batch must all fit at once\n"
            "  fix, in the order forge recommends:\n"
            "    - train fewer weights: LoRA (\"lora\": {\"r\": 16} in config.json's model block), or the "
            "low-memory preset (nmt-forge use-model byt5-small-lowmem --config config.json)\n"
            "    - a smaller base model, or shorter limits (model.max_src / model.max_tgt)\n"
            "    - more room when nothing else is open: \"mps_memory_fraction\": up to 1.7 in the model block\n"
            "    - a bigger GPU, semi-sovereign: nmt-forge remote plan config.json, then "
            "nmt-forge run config.json --remote runpod --max-cost <USD> (each file needs the people's yes; "
            "the test sets never leave)" + (f"\n  {config_hint}" if config_hint else ""))
