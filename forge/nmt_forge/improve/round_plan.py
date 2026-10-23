"""How a round trains: on from the model in use, or again from the start.

Every round used to retrain from the base model: hours of ByT5 for a round
that added fifty sentences (FORGE_MACHINE_CRITIQUE finding 4). A round now
CONTINUES from the model in use — a few passes over all the data so far (the
old sentences are the replay that keeps it from forgetting), at half the
learning rate — and trains from the start only when that is the honest move:

  - no model is in use yet, or the model was just changed (use-model);
  - the model learns its vocabulary from the training sentences (the tiny
    scratch model: new words need a new vocabulary; it trains in minutes);
  - adapter models (LoRA), whose lineage the continue path does not keep;
  - every FULL_EVERY rounds, so drift from many short continuations is reset.

The full settings are kept in config.json (``model_full``) while a round
continues, and put back when one trains from the start. Either way the new
run is judged against the model in use on the same dev sentences, and put to
use only if measurably better (improve.compare). Writes a ``round-plan``
ledger event; content-free.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..errors import ForgeError
from ..workspace import Workspace

ROUND_PLAN = "round-plan"
CONTINUE_EPOCHS = 4
CONTINUE_LR_FACTOR = 0.5
FULL_EVERY = 4
CONTINUABLE = ("hf-seq2seq",)


def _in_use(ws: Workspace) -> dict | None:
    from ..advisor import _in_use_export, snapshot

    s = snapshot(ws)
    servable = [e for e in s.get("exports", []) if e.get("dir") and e.get("model_included", True)]
    return _in_use_export(s, servable)


def plan_round(ws: Workspace, config_path: str | Path, *, in_use: dict | None = None) -> dict:
    """Point config.json's model at the model in use (continue) or at its full
    settings (from the start); returns the plan (and ledgers it)."""
    cfg_path = Path(config_path)
    try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise ForgeError(f"{cfg_path}: not a readable config ({e})") from e
    model = dict(cfg.get("model") or {})
    full = dict(cfg.get("model_full") or {k: v for k, v in model.items() if k != "init_from"})
    in_use = in_use if in_use is not None else _in_use(ws)
    plans = ws.ledger.find(ROUND_PLAN)
    since_full = 0
    for e in reversed(plans):
        if e.get("mode") != "continue":
            break
        since_full += 1
    use_dir = (in_use or {}).get("model_dir") or (in_use or {}).get("dir")
    use_model = {}
    if in_use and in_use.get("manifest"):
        try:
            use_model = (json.loads(Path(in_use["manifest"]).read_text(encoding="utf-8")).get("config") or {}).get(
                "model") or {}
        except (OSError, ValueError):
            use_model = {}
    why = None
    if not use_dir:
        why = "no model is in use yet"
    elif full.get("backend") not in CONTINUABLE:
        why = (f"the {full.get('backend')} model learns its vocabulary from the training sentences; it "
               "trains again from the start (minutes)" if full.get("backend") == "hf-scratch"
               else f"a {full.get('backend')} model trains from the start each round")
    elif full.get("lora"):
        why = "an adapter (LoRA) model trains from the start each round"
    elif use_model and (use_model.get("base") != full.get("base") or use_model.get("backend") != full.get("backend")):
        why = "the model was changed: the new one trains from the start"
    elif since_full >= FULL_EVERY - 1:
        why = f"every {FULL_EVERY}th round trains from the start, so many short continuations do not drift"
    if why:
        cfg["model"] = full
        cfg.pop("model_full", None)
        plan = {"mode": "full", "epochs": full.get("epochs"), "why": why}
    else:
        cont = {**full, "init_from": str(Path(use_dir).resolve()), "epochs": CONTINUE_EPOCHS}
        if full.get("lr"):
            cont["lr"] = float(full["lr"]) * CONTINUE_LR_FACTOR
        cfg["model"] = cont
        cfg["model_full"] = full
        plan = {"mode": "continue", "epochs": CONTINUE_EPOCHS, "from": in_use.get("run") or Path(use_dir).name,
                "why": (f"continues from the model in use: {CONTINUE_EPOCHS} passes over all the sentences so far "
                        f"(the old ones keep it from forgetting) at half the learning rate — much shorter than "
                        f"training from the start; every {FULL_EVERY}th round trains from the start")}
    tmp = cfg_path.with_name(cfg_path.name + ".tmp")
    tmp.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
    tmp.replace(cfg_path)
    ws.ledger.append(ROUND_PLAN, round=len(plans) + 1, **plan)
    plan["text"] = (f"this round {'continues from the model in use' if plan['mode'] == 'continue' else 'trains from the start'}"
                    f" ({plan['epochs']} passes): {plan['why']}")
    return plan
