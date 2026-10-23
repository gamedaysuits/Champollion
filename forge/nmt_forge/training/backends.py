"""Trainer backends — forge orchestrates; the backend trains.

Core forge never imports torch. The protocol is small on purpose: train on
rows, report checkpoints, decode from a checkpoint, measure token lengths
(for the generation-headroom guard, mistake #11).

``DummyBackend`` is the deterministic test double (and a dry-run tool): it
fabricates checkpoints with scripted dev losses and scripted decodes, so the
fence/selection/manifest machinery is testable without a GPU or a model.

``HFSeq2SeqBackend`` (``hf-seq2seq``) fine-tunes a PRETRAINED checkpoint with
``transformers.Seq2SeqTrainer`` (+ LoRA via peft when configured), mirroring
the working reference trainer (crk-translate ``train_moonshot.py``). Use it
for NLLB-600M on a GPU, or a small Marian/opus-mt model on a laptop CPU.

``HFScratchBackend`` (``hf-scratch``) builds a TINY transformer from a config
plus a tokenizer trained on the TRAIN rows only — no download, no GPU: the
honest CPU path for a community with ~1–2k pairs and a laptop. It trains in
minutes and it will be WEAK (on 1–2k pairs expect chrF++ roughly 5–30,
the top end only for highly templated data); its point is a correct,
measured, deployable loop that a better model can later replace under the
same fence.

Both HF backends import lazily and refuse with the exact install command when
the ``[hf]`` extra is absent (``hf_missing`` is the one check, shared with
``nmt-forge preflight``).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol, runtime_checkable

from ..errors import BackendError
from ..monitor import STOP_BASENAME
from . import heartbeat


@dataclass(frozen=True)
class Checkpoint:
    id: str
    step: int
    dev_loss: float | None = None
    path: str | None = None
    # the dev translations' score at this checkpoint (chrF++), measured during
    # training when the selection metric is a generation one — None otherwise
    dev_score: float | None = None


@dataclass
class TrainResult:
    backend_id: str
    checkpoints: list[Checkpoint]
    history: list[dict] = field(default_factory=list)
    # {"requested_at": step, "effective_at": step, "suppressed": bool} —
    # what early stopping DID, so the runner can explain it in plain language
    stop_event: dict | None = None
    # backend facts worth a manifest line (e.g. the scratch tokenizer's
    # vocabulary and what it was trained on) — content-free
    backend_info: dict = field(default_factory=dict)

    def best_by_loss(self) -> Checkpoint:
        # only checkpoints whose weights still exist can be selected
        with_loss = [c for c in self.checkpoints
                     if c.dev_loss is not None and c.path is not None]
        if not with_loss:
            raise BackendError(
                "no checkpoint reported a dev loss — the backend must "
                "evaluate on the fenced dev set during training"
            )
        return min(with_loss, key=lambda c: c.dev_loss)


@runtime_checkable
class TrainerBackend(Protocol):
    backend_id: str

    def train(self, train_rows: list[dict], dev_rows: list[dict],
              params: dict, run_dir: Path) -> TrainResult: ...

    def decode(self, checkpoint: Checkpoint, sources: list[str],
               params: dict) -> list[str]: ...

    def token_len(self, text: str) -> int: ...



def best_checkpoint_key_check(trainer) -> dict | None:
    """Explain the "missing keys" line the Trainer logs when it reloads the
    best checkpoint (``load_best_model_at_end``).

    A checkpoint stores a weight once: Marian's encoder/decoder token
    embeddings and ``lm_head`` are TIED to ``model.shared`` (one saved copy),
    and its sinusoidal position tables are recomputed from the config, never
    saved (``_keys_to_ignore_on_save``). transformers still lists them as
    missing. Every missing key is checked: tied to a saved weight (same
    storage) or declared never-saved / ignorable on load → a one-line note
    that nothing was lost; anything else → a loud warning naming the keys
    (those weights would be back at their initial values). None when the
    best checkpoint stores full weights or is an adapter-only checkpoint.
    """
    import re

    best = getattr(getattr(trainer, "state", None), "best_model_checkpoint",
                   None)
    if not best or not (Path(best) / "model.safetensors").exists():
        return None
    try:
        from safetensors import safe_open

        with safe_open(str(Path(best) / "model.safetensors"), "pt") as h:
            saved = set(h.keys())
    except Exception as e:                       # report, never hide
        return {"ok": None, "message": (
            f"[forge] could not read {best}/model.safetensors to check the "
            f"Trainer's missing-keys line ({type(e).__name__}: {e})")}
    model = trainer.model
    sd = model.state_dict()
    missing = sorted(set(sd) - saved)
    if not missing:
        return None
    saved_ptrs = {sd[k].data_ptr() for k in saved if k in sd}
    never = set(getattr(model, "_keys_to_ignore_on_save", None) or ())
    ignorable = [re.compile(p) for p in
                 (getattr(model, "_keys_to_ignore_on_load_missing", None)
                  or ())]
    tied = [k for k in missing if sd[k].data_ptr() in saved_ptrs]
    recomputed = [k for k in missing if k not in tied and (
        k in never or any(r.search(k) for r in ignorable))]
    unexplained = [k for k in missing if k not in tied and k not in recomputed]
    if unexplained:
        return {"ok": False, "missing": missing, "unexplained": unexplained,
                "message": (
                    "[forge] WARNING: the best checkpoint is missing "
                    f"{len(unexplained)} weight(s) that are neither tied to a "
                    "saved weight nor recomputed: "
                    + ", ".join(unexplained[:6])
                    + (" …" if len(unexplained) > 6 else "")
                    + " — those weights would load at their initial values; "
                    "check the dev score before trusting this model")}
    return {"ok": True, "missing": missing, "tied": tied,
            "recomputed": recomputed, "message": (
                "[forge] best checkpoint reloaded: "
                f"{len(tied)} weight(s) are tied to one saved copy (shared "
                f"embeddings / lm_head) and {len(recomputed)} are "
                "recomputed, never saved (sinusoidal positions) — checked, "
                "nothing was lost (transformers' \"missing keys\" notice for "
                "them is not shown)")}

#: The transformers Trainer's logger and the notice it logs when it reloads
#: the best checkpoint (``Trainer._issue_warnings_after_load``).
_TRAINER_LOGGER = "transformers.trainer"
_MISSING_KEYS_PREFIX = "There were missing keys in the checkpoint model loaded"


def target_token_id(tok, tgt_lang: str) -> int:
    """The token that tells a multilingual model which language to write:
    NLLB and mBART-50 name it as a token ("ayr_Latn", "xh_ZA"); M2M-100 maps a
    code ("ht") to "__ht__" (get_lang_id). Refuses a code the tokenizer does not
    know, rather than forcing the unknown-token id."""
    if hasattr(tok, "get_lang_id"):
        try:
            return int(tok.get_lang_id(tgt_lang))
        except (KeyError, ValueError):
            pass
    tid = tok.convert_tokens_to_ids(tgt_lang)
    if tid is None or tid == getattr(tok, "unk_token_id", None):
        raise BackendError(f"model.tgt_lang {tgt_lang!r} is not a language token this base knows\n"
                           "  fix: use one of the base's own language codes (NLLB: e.g. 'ayr_Latn'; mBART-50: "
                           "'xh_ZA'; M2M-100: 'ht'). For a language the base has never seen, borrow an unrelated "
                           "one's code, as forge's presets do, and say so")
    return int(tid)


class _OutOfMemory(Exception):
    """A training stage ran out of GPU memory at ``step`` (HFSeq2SeqBackend.train
    catches it, steps down and starts the stage again)."""

    def __init__(self, step: int, cap: dict | None):
        super().__init__(f"out of memory at step {step}")
        self.step, self.cap = step, cap


def _empty_gpu_cache() -> None:
    """Hand cached GPU memory back after a failed attempt (no torch: nothing to do)."""
    try:
        import torch
    except ImportError:
        return
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        torch.mps.empty_cache()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


class MissingKeysNotice:
    """Hold the Trainer's "missing keys" notice while training runs, then
    :meth:`settle` it against :func:`best_checkpoint_key_check`: every
    missing key explained (tied / recomputed — verified, 2026-10-04: after
    ``from_pretrained`` the tied embeddings and ``lm_head`` share the saved
    ``model.shared.weight`` storage and equal it, the sinusoidal position
    tables equal freshly computed ones) → the notice is dropped and forge's
    one line stands in for it; anything else (or no check possible) → the
    notice is released as transformers wrote it. Only that one notice is
    held — every other record passes untouched."""

    def __init__(self, logger_name: str = _TRAINER_LOGGER):
        import logging

        self._logger = logging.getLogger(logger_name)
        self.held: list = []

    def filter(self, record) -> bool:       # logging.Filter protocol
        try:
            msg = record.getMessage()
        except Exception:                    # never break logging
            return True
        if msg.startswith(_MISSING_KEYS_PREFIX):
            self.held.append(record)
            return False
        return True

    def __enter__(self) -> "MissingKeysNotice":
        self._logger.addFilter(self)
        return self

    def __exit__(self, *exc) -> None:
        self._logger.removeFilter(self)

    def settle(self, key_check: dict | None) -> list:
        """Release the held notice(s) unless forge explained every key;
        returns the records released."""
        if key_check and key_check.get("ok") is True:
            released: list = []
        else:
            released = list(self.held)
            for record in released:
                self._logger.handle(record)
        self.held = []
        return released


class DummyBackend:
    """Deterministic double. ``dev_losses`` scripts one checkpoint per entry;
    ``decode_tables`` (checkpoint id → {source: hypothesis}) scripts decode
    quality per checkpoint — which is how tests demonstrate that the
    best-loss checkpoint need not be the best-generation checkpoint.
    ``stop_request_at`` scripts an early-stopping request at that step, so
    tests can watch the schedule floor suppress it."""

    backend_id = "dummy"

    def __init__(self, *, dev_losses: list[float] | None = None,
                 decode_tables: dict[str, dict[str, str]] | None = None,
                 candidate_tables: dict[str, dict[str, list]] | None = None,
                 stop_request_at: int | None = None):
        self.dev_losses = dev_losses or [3.0, 2.0, 2.5]
        self.decode_tables = decode_tables or {}
        # checkpoint id → {source: [(candidate, score), ...]} — lets tests
        # exercise the decode-hook path without a GPU
        self.candidate_tables = candidate_tables or {}
        self.stop_request_at = stop_request_at
        self.calls: list[dict] = []

    def train(self, train_rows, dev_rows, params, run_dir) -> TrainResult:
        params = dict(params)
        monitor = params.pop("_monitor", None)
        params.pop("_facts", None)
        self.calls.append({
            "train_rows": len(train_rows),
            "dev_rows": len(dev_rows),
            "params": params,
            "run_dir": str(run_dir),
        })
        if monitor is not None:            # scripted feed for monitor tests
            for i, loss in enumerate(self.dev_losses):
                monitor.emit("dev_loss", step=(i + 1) * 100, loss=loss)
        ckpts = [
            Checkpoint(id=f"ckpt-{i + 1}", step=(i + 1) * 100, dev_loss=loss,
                       path=str(Path(run_dir) / f"ckpt-{i + 1}"))
            for i, loss in enumerate(self.dev_losses)
        ]
        for c in ckpts:      # the job supervisor sees a test run as alive too
            heartbeat.beat("train", c.step, ckpts[-1].step, force=True,
                           run_dir=str(run_dir))
        stop_event = None
        if self.stop_request_at is not None:
            floor = int(params.get("floor_steps", 0))
            stop_event = {
                "requested_at": self.stop_request_at,
                "effective_at": max(self.stop_request_at, floor),
                "suppressed": self.stop_request_at < floor,
            }
        return TrainResult(backend_id=self.backend_id, checkpoints=ckpts,
                           history=[{"step": c.step, "dev_loss": c.dev_loss}
                                    for c in ckpts],
                           stop_event=stop_event)

    def decode(self, checkpoint, sources, params) -> list[str]:
        self.last_decode = {"n": len(sources), "inputs_cut": [], "outputs_at_cap": []}
        hook = (params or {}).get("decode_hook")
        cands = self.candidate_tables.get(checkpoint.id, {})
        if hook is not None and cands:
            return [hook(s, cands[s]) if s in cands
                    else f"«{checkpoint.id}» {s}" for s in sources]
        table = self.decode_tables.get(checkpoint.id, {})
        return [table.get(s, f"«{checkpoint.id}» {s}") for s in sources]

    def token_len(self, text: str) -> int:
        return len(text.split())


# -- the HF backends ------------------------------------------------------------

HF_INSTALL = "python3 -m pip install 'nmt-forge[hf]'"


def hf_install_command() -> str:
    """The training-extra install for how THIS forge was installed: a `uv
    tool` environment has no pip of its own (uv writes uv-receipt.toml at its
    root), so pip's command would fail there; anything else gets pip on this
    very interpreter."""
    import sys

    if (Path(sys.prefix) / "uv-receipt.toml").exists():
        return "uv tool install --reinstall --python 3.12 'nmt-forge[hf]'"
    return f"{sys.executable} -m pip install 'nmt-forge[hf]'"

# files a checkpoint dir holds that a DEPLOYED model never needs (optimizer
# state, RNG, trainer bookkeeping) — export skips them
TRAINER_STATE_FILES = ("optimizer.pt", "scheduler.pt", "scaler.pt",
                       "trainer_state.json", "training_args.bin")
TRAINER_STATE_PREFIXES = ("rng_state",)

_TOKENIZER_FILES = ("tokenizer.json", "tokenizer_config.json",
                    "sentencepiece.bpe.model", "source.spm", "spiece.model",
                    "vocab.json")


def hf_missing(model_cfg: dict | None = None) -> list[str]:
    """Python modules an HF backend needs that are NOT importable, for this
    model config. Empty list = ready. The ONE check: the backend refuses on
    it and ``nmt-forge preflight run`` reports it — so a green preflight can
    never be followed by a missing-extra refusal."""
    import importlib.util

    cfg = model_cfg or {}
    needed = ["torch", "transformers", "accelerate"]
    if cfg.get("lora"):
        needed.append("peft")
    base = str(cfg.get("base") or "")
    if cfg.get("backend") == "hf-scratch":
        needed.append("tokenizers")
    elif "opus-mt" in base or base.startswith("Helsinki-NLP/") \
            or "marian" in base.lower():
        needed.append("sentencepiece")   # Marian tokenizers are slow-only
    return [m for m in needed if importlib.util.find_spec(m) is None]


def _require_hf(model_cfg: dict) -> None:
    missing = hf_missing(model_cfg)
    if missing:
        raise BackendError(
            f"the {model_cfg.get('backend', 'hf')} backend needs "
            f"{', '.join(missing)}, which {'is' if len(missing) == 1 else 'are'} "
            f"not installed\n"
            f"  fix: {HF_INSTALL}   (torch, transformers, accelerate, peft, "
            "sentencepiece — CPU wheels are fine for the hf-scratch and small "
            "Marian presets)"
        )


def _shadowed_datasets() -> str | None:
    """A directory called ``datasets`` on sys.path (no __init__.py) becomes a
    namespace package that transformers mistakes for Hugging Face
    `datasets` — and the Trainer then crashes deep in its dataloader with
    "module 'datasets' has no attribute 'Dataset'". Name the directory
    instead. (Seen with PYTHONPATH pointing at a checkout that has a
    datasets/ folder.)"""
    import importlib.util

    spec = importlib.util.find_spec("datasets")
    if spec is None or spec.origin not in (None, "namespace"):
        return None
    locations = list(spec.submodule_search_locations or [])
    return ", ".join(locations) or "a namespace package"


def _has_tokenizer(path: str | Path | None) -> bool:
    return bool(path) and any((Path(path) / f).is_file()
                              for f in _TOKENIZER_FILES)


#: Source / target token limits when a config names none (hf-seq2seq).
DEFAULT_MAX_SRC = 128
DEFAULT_MAX_TGT = 256


def length_report(tok, rows: list[dict], max_src: int, max_tgt: int, *, chunk: int = 1000) -> dict:
    """How many training rows the model's length limits cut — counts only.
    Training truncates a source past ``max_src`` tokens and a target past
    ``max_tgt`` (ByT5: 320 bytes; syllabics are three bytes a letter), and
    until 2026-10-13 said nothing (FORGE_MACHINE_CRITIQUE finding 5)."""
    src = tgt = 0
    for i in range(0, len(rows), chunk):
        part = rows[i:i + chunk]
        s_ids = tok([str(r.get("source", "")) for r in part])["input_ids"]
        t_ids = tok(text_target=[str(r.get("target", "")) for r in part])["input_ids"]
        src += sum(len(x) > max_src for x in s_ids)
        tgt += sum(len(x) > max_tgt for x in t_ids)
    return {"rows": len(rows), "source_cut": src, "target_cut": tgt, "max_src": max_src, "max_tgt": max_tgt}


def decode_params(model_cfg: dict) -> dict:
    """``config.model`` with every length default applied — the params a
    model of this config is trained, measured and decoded with. Pure (no
    torch): ``nmt-forge export`` records them in forge-model.json, so
    ``nmt-forge serve`` and any other engine (mt-eval's local-model)
    truncate where training and evaluation did. hf-scratch derives its
    limits from its positions (``max_len``)."""
    p = dict(model_cfg or {})
    if p.get("backend") == "hf-scratch":
        max_len = int(p.get("max_len", 512))
        p.setdefault("max_src", min(256, max_len))
        p.setdefault("max_tgt", min(256, max_len))
    p.setdefault("max_src", DEFAULT_MAX_SRC)
    p.setdefault("max_tgt", DEFAULT_MAX_TGT)
    return p


class HFSeq2SeqBackend:
    """transformers Seq2SeqTrainer (+ optional LoRA), reference-trainer shaped.

    params (config.model): base (HF id or local dir), lr, epochs, batch_size,
    grad_accum, eval_steps, lora {r, alpha, dropout, target_modules},
    src_lang/tgt_lang (NLLB-style tokens), max_src/max_tgt, device
    ("auto" — GPU/MPS when present — or "cpu"), time_budget_hours.
    """

    backend_id = "hf-seq2seq"

    def __init__(self, params: dict):
        _require_hf({**params, "backend": self.backend_id})
        self.params = params
        self._toks: dict[str, object] = {}
        self._models: dict[str, object] = {}

    # -- tokenizers -----------------------------------------------------------

    def _tokenizer(self, path: str | Path | None = None):
        """The tokenizer saved WITH a checkpoint when it has one (so an
        exported model is self-contained and offline), else the base's."""
        from transformers import AutoTokenizer

        p = self.params
        src = str(path) if _has_tokenizer(path) else p.get("base")
        if src is None:
            raise BackendError(
                f"{self.backend_id}: no tokenizer — the checkpoint dir has no "
                "tokenizer files and config.model.base is unset")
        if src not in self._toks:
            kwargs = {}
            if p.get("src_lang"):
                kwargs = {"src_lang": p["src_lang"], "tgt_lang": p.get("tgt_lang")}
            self._toks[src] = AutoTokenizer.from_pretrained(src, **kwargs)
        return self._toks[src]

    def token_len(self, text: str) -> int:
        return len(self._tokenizer()(text)["input_ids"])

    # -- model construction (overridden by hf-scratch) --------------------------

    def _init_model(self, p: dict, train_rows: list[dict], run_dir: Path):
        """(model, tokenizer, backend_info) for this stage."""
        from transformers import AutoModelForSeq2SeqLM

        tok = self._tokenizer()
        # curriculum chaining (the crk v8 stage-2 collapse, 2026-07-14):
        # a stage-1 LoRA checkpoint is an ADAPTER dir. Naively from_pretrained-
        # ing it and wrapping with a FRESH LoRA stacks a second adapter whose
        # saved checkpoints record base=<hub model> — stage-1's learning is
        # silently dropped at decode/selection (dev loss 3.37→6.26, chrF++
        # 24.5→3.0). When init_from is an adapter dir and LoRA is configured,
        # RESUME the same adapter (is_trainable=True): correct lineage, saved
        # checkpoints still compose base+adapter, "continue training this
        # model" means exactly that.
        init_from = p.get("init_from")
        if _has_tokenizer(init_from):
            tok = self._tokenizer(init_from)
        init_is_adapter = bool(
            init_from
            and (Path(init_from) / "adapter_config.json").is_file())
        if init_is_adapter and p.get("lora"):
            from peft import PeftModel

            model = PeftModel.from_pretrained(
                AutoModelForSeq2SeqLM.from_pretrained(p["base"]),
                init_from, is_trainable=True)
            print(f"[curriculum] resuming LoRA adapter from {init_from} "
                  "(same adapter continues training; lora config of this "
                  "stage is inherited, not re-applied)", flush=True)
        else:
            model = AutoModelForSeq2SeqLM.from_pretrained(
                init_from or p["base"])
            if p.get("lora"):
                from peft import LoraConfig, get_peft_model

                lc = p["lora"]
                model = get_peft_model(model, LoraConfig(
                    r=lc["r"], lora_alpha=lc.get("alpha", lc["r"] * 2),
                    lora_dropout=lc.get("dropout", 0.05),
                    target_modules=lc.get("target_modules"),
                    # e.g. ["shared"] to train (extended) embedding rows in a
                    # vocab-extension condition (tokenizer experiment T1)
                    modules_to_save=lc.get("modules_to_save"),
                    task_type="SEQ_2_SEQ_LM"))
        return model, tok, {"base": init_from or p.get("base")}

    # -- training -------------------------------------------------------------

    def train(self, train_rows, dev_rows, params, run_dir) -> TrainResult:
        """Train, fitting the run to the memory it has: when a stage runs out,
        forge steps down (memory_plan.next_step_down: recompute activations,
        then half the batch twice as often, then Adafactor), says so, starts
        the stage again and records every step; it stops only when nothing
        fits, with what to do (founder 2026-10-14: "if it's failing we need to
        fix forge")."""
        import gc

        from .gpu_memory import out_of_memory_text
        from .memory_plan import next_step_down

        q = dict(params)
        fallbacks: list = []
        while True:
            try:
                result = self._train_once(train_rows, dev_rows, q, run_dir)
            except _OutOfMemory as oom:
                step = next_step_down({**self.params, **q})
                gc.collect()
                _empty_gpu_cache()
                if step is None:
                    hint = ""
                    if fallbacks:
                        hint = "what forge already set for this run: " + ", ".join(
                            f"{k}={v}" for f in fallbacks for k, v in f["set"].items())
                    raise BackendError(out_of_memory_text(oom.cap, tried=fallbacks, config_hint=hint)) from None
                fallbacks.append({"at_step": oom.step, "change": step["change"], "set": step["set"]})
                say = (f"[memory] out of memory at step {oom.step:,} — forge changes: {step['change']}; "
                       "this stage starts again")
                print(say, flush=True)
                monitor = q.get("_monitor")
                if monitor is not None:
                    monitor.emit("event", text=say)
                q.update(step["set"])
                for old in Path(run_dir).glob("checkpoint-*"):      # the failed attempt's checkpoints
                    import shutil

                    shutil.rmtree(old, ignore_errors=True)
                continue
            if fallbacks:
                settings = {k: v for f in fallbacks for k, v in f["set"].items()}
                result.backend_info["memory_fallbacks"] = fallbacks
                print("[memory] this run fit after " + "; ".join(f["change"] for f in fallbacks)
                      + ". To start there next time, set in config.json's model block: "
                      + ", ".join(f'"{k}": {str(v).lower() if isinstance(v, bool) else repr(v)}'
                                  for k, v in settings.items()), flush=True)
            return result

    def _train_once(self, train_rows, dev_rows, params, run_dir) -> TrainResult:
        import inspect

        from transformers import (
            DataCollatorForSeq2Seq,
            EarlyStoppingCallback,
            Seq2SeqTrainer,
            Seq2SeqTrainingArguments,
            TrainerCallback,
        )

        shadow = _shadowed_datasets()
        if shadow:
            raise BackendError(
                f"`import datasets` resolves to a plain directory ({shadow}), "
                "not the Hugging Face datasets package — transformers would "
                "crash mid-training\n"
                "  fix: remove that directory's parent from PYTHONPATH (or "
                "`python3 -m pip install datasets`)")
        p = {**self.params, **params}
        monitor = p.pop("_monitor", None)
        note_facts = p.pop("_facts", None)        # run_facts: what the panel says the run is
        # score the dev TRANSLATIONS at every evaluation (chrF++), and let
        # early stopping and the best checkpoint follow that score. With little
        # data the dev LOSS rises from the first epochs while the translations
        # keep improving (a wave-1 run: dev loss 5.42 → 5.74 while dev chrF++
        # went 3.2 → 10.0), so stopping on loss stopped runs that were still
        # getting better.
        score_metric = p.pop("_dev_score_metric", None)
        run_dir = Path(run_dir)
        # the GPU's share of the computer's memory, capped before anything is
        # allocated: the computer stays usable while it trains (gpu_memory.py)
        from .gpu_memory import cap_gpu_memory
        from .memory_plan import plan_memory

        gpu_cap = cap_gpu_memory(p.pop("mps_memory_fraction", None))
        model, tok, backend_info = self._init_model(p, train_rows, run_dir)
        if gpu_cap:
            backend_info["gpu_memory"] = gpu_cap
        # the run fitted to its memory BEFORE the first step: what the weights,
        # gradients and optimizer hold against what training may use; forge
        # turns on what saves memory, or refuses with the recommendations
        mem_plan = plan_memory(model, p, gpu_cap)
        print(mem_plan["say"], flush=True)
        if mem_plan.get("refuse"):
            raise BackendError(mem_plan["refuse"])
        p.update(mem_plan["set"])
        backend_info["memory_plan"] = {k: v for k, v in mem_plan.items() if k != "say"}
        if note_facts is not None:
            note_facts(memory={"limit_gb": mem_plan["limit_gb"], "states_gb": mem_plan["states_gb"],
                               "changes": mem_plan["changes"]})
        max_src = p.get("max_src", DEFAULT_MAX_SRC)
        max_tgt = p.get("max_tgt", DEFAULT_MAX_TGT)
        # what the limits cut, counted before anything is cut (the manifest and
        # status say it; nothing is cut silently)
        backend_info["length_limits"] = length_report(tok, train_rows, max_src, max_tgt)
        if note_facts is not None:
            note_facts(length_limits=backend_info["length_limits"])

        # a tag some bases need before every source sentence (MADLAD-400:
        # "<2tlh> "): the same prefix at training, decoding and serving
        prefix = str(p.get("source_prefix") or "")

        def encode(row):
            enc = tok(prefix + row["source"], text_target=row["target"],
                      truncation=True, max_length=max_src)
            enc.pop("token_type_ids", None)
            enc["labels"] = enc["labels"][:max_tgt]
            return enc

        eval_steps = int(p.get("eval_steps", 2000))
        floor_steps = int(p.get("floor_steps", 0))
        targ_kwargs = dict(
            output_dir=str(run_dir),
            per_device_train_batch_size=p.get("batch_size", 4),
            # the dev checks decode several times the training batch at once:
            # decoding holds no gradients or optimizer, and at the training
            # batch a GPU sat mostly idle (2026-10-14: a 400-pair run on a rented
            # A5000 spent most of its 21 minutes decoding dev, 8 sentences at a
            # time). The memory step-down halves batch_size, and this with it
            per_device_eval_batch_size=int(p.get("eval_batch_size") or int(p.get("batch_size", 4)) * 4),
            gradient_accumulation_steps=p.get("grad_accum", 4),
            learning_rate=p.get("lr", 2e-4),
            num_train_epochs=p.get("epochs", 3),
            weight_decay=p.get("weight_decay", 0.01),
            # dense by default: the loss exists at every step and logging it
            # costs microseconds against a multi-second step — sparse logging
            # only starves the monitor/history (founder question, 2026-07-14).
            # Raise via model.logging_steps if the log volume ever matters.
            logging_steps=p.get("logging_steps", 10),
            eval_strategy="steps", eval_steps=eval_steps,
            save_strategy="steps", save_steps=eval_steps,
            # keep enough checkpoints for the generation-metric sweep
            save_total_limit=p.get("save_total_limit", 4),
            load_best_model_at_end=True, metric_for_best_model="eval_loss",
            seed=p.get("seed", 42), report_to=[],
        )
        # the in-training dev score reads at most this many dev rows (a fixed,
        # seeded sample) so a large dev set does not slow every evaluation;
        # the final selection decodes the WHOLE dev set
        eval_rows = list(dev_rows)
        if score_metric:
            import random as _random

            cap = int(p.get("eval_rows_max", 400))
            if len(eval_rows) > cap:
                eval_rows = _random.Random(int(p.get("seed", 42))).sample(eval_rows, cap)
            targ_kwargs.update(
                predict_with_generate=True,
                generation_max_length=int(p.get("max_tgt", DEFAULT_MAX_TGT)),
                generation_num_beams=int(p.get("eval_num_beams", 1)),
                metric_for_best_model="eval_chrf", greater_is_better=True)
            if p.get("tgt_lang"):
                model.generation_config.forced_bos_token_id = target_token_id(tok, p["tgt_lang"])
            backend_info["dev_score_during_training"] = {
                "metric": "chrf++", "rows": len(eval_rows), "of": len(dev_rows),
                "beams": targ_kwargs["generation_num_beams"], "every_steps": eval_steps}
        if p.get("label_smoothing"):
            targ_kwargs["label_smoothing_factor"] = float(p["label_smoothing"])
        accepted = inspect.signature(Seq2SeqTrainingArguments.__init__).parameters
        # less memory (the byt5-small-lowmem preset, for an 8–23 GB computer):
        # Adafactor keeps factored second moments instead of AdamW's two full
        # copies of the weights, and gradient checkpointing recomputes
        # activations instead of keeping them (FORGE_MACHINE_CRITIQUE finding 7)
        if p.get("optim") and "optim" in accepted:
            targ_kwargs["optim"] = str(p["optim"])
        if p.get("gradient_checkpointing") and "gradient_checkpointing" in accepted:
            targ_kwargs["gradient_checkpointing"] = True
            # non-reentrant: the recompute works when the inputs carry no
            # gradient — the case with LoRA, where the base weights are frozen
            # (reentrant checkpointing then trains nothing, or refuses)
            if "gradient_checkpointing_kwargs" in accepted:
                targ_kwargs["gradient_checkpointing_kwargs"] = {"use_reentrant": False}
        warmup = float(p.get("warmup_ratio", 0.02))
        import transformers

        if int(transformers.__version__.split(".")[0]) >= 5:
            # v5: warmup_steps takes a float in [0, 1) as a RATIO of the run;
            # warmup_ratio is deprecated (removed in 5.2)
            targ_kwargs["warmup_steps"] = warmup
        else:
            targ_kwargs["warmup_ratio"] = warmup
        # precision: bf16 mixed precision on an NVIDIA card that supports it
        # (2-3x faster for large bases; T5-family models overflow in fp16, so
        # never fp16), fp32 elsewhere — Apple's GPU trains bf16 unreliably.
        # model.precision: "auto" (default) | "fp32" | "bf16"
        precision = str(p.get("precision") or "auto").lower()
        import torch as _torch

        bf16_ok = bool(_torch.cuda.is_available() and _torch.cuda.is_bf16_supported())
        if precision not in ("auto", "fp32", "bf16"):
            raise BackendError(f"model.precision is {precision!r}: use \"auto\", \"fp32\" or \"bf16\"")
        if precision == "bf16" and not bf16_ok:
            raise BackendError("model.precision is \"bf16\", but this computer has no NVIDIA GPU that supports it\n"
                               "  fix: leave model.precision out (forge picks fp32 here), or train on a rented GPU "
                               "(nmt-forge remote plan config.json)")
        use_bf16 = bf16_ok and precision in ("auto", "bf16") and "bf16" in accepted
        if use_bf16:
            targ_kwargs["bf16"] = True
        backend_info["precision"] = "bf16 mixed" if use_bf16 else "fp32"
        if str(p.get("device", "auto")) == "cpu" and "use_cpu" in accepted:
            targ_kwargs["use_cpu"] = True
        if "save_only_model" in accepted:
            # forge never resumes a trainer state (a curriculum stage inits
            # from WEIGHTS) — optimizer snapshots only triple the disk use
            targ_kwargs["save_only_model"] = True
        targs = Seq2SeqTrainingArguments(**targ_kwargs)

        stop_record: dict = {}

        class FlooredEarlyStopping(EarlyStoppingCallback):
            """Early stopping held below the schedule floor (generalized from
            crk-translate train_moonshot.py's interim --min-steps fix): in a
            synthetic-dominated mix, real-dev loss bottoming early is the
            EXPECTED pattern, not convergence — see nmt_forge.training.
            schedule for the derivation of the floor."""

            def on_evaluate(self, args, state, control, **kwargs):
                super().on_evaluate(args, state, control, **kwargs)
                # only PATIENCE counts as early stopping — the trainer also
                # raises should_training_stop at its last step, and reporting
                # a run that simply finished as "early stopping fired" (it
                # did, before 2026-10) misleads whoever reads the manifest
                patience_hit = (getattr(self, "early_stopping_patience_counter",
                                        0) >= self.early_stopping_patience)
                if control.should_training_stop and patience_hit \
                        and state.global_step < state.max_steps:
                    stop_record.setdefault("requested_at", state.global_step)
                    if state.global_step < floor_steps:
                        control.should_training_stop = False
                        stop_record["suppressed"] = True
                        print(f"[schedule-sanity] early stopping asked to "
                              f"stop at step {state.global_step:,}; held "
                              f"until the floor ({floor_steps:,}) — see the "
                              "run manifest for why", flush=True)
                    else:
                        stop_record["effective_at"] = state.global_step
                        stop_record.setdefault("suppressed", False)

        # wall-clock reality check (the crk v8 mis-size): measure sec/it after
        # a short warm-up, project the whole run, refuse a run that cannot
        # finish inside model.time_budget_hours — minutes in, not days. The
        # warm-up is untimed: one-time costs in the first steps made a ~4-min
        # run project ≈0.7h (school persona, 2026-10); see WallClockProjector
        from .schedule import (DEFAULT_TIME_CEILING_HOURS,
                               WallClockProjector, planned_hours_str)

        # no budget in the config (init writes none — forge never invents
        # one): forge's documented ceiling applies, and every projection
        # says it is the ceiling, not a budget anyone chose
        budget_set = p.get("time_budget_hours") is not None
        budget_hours = (float(p["time_budget_hours"]) if budget_set
                        else DEFAULT_TIME_CEILING_HOURS)
        projector = WallClockProjector(
            budget_hours, user_set=budget_set,
            warmup_steps=int(p.get("budget_warmup_steps", 10)),
            calib_steps=int(p.get("budget_calibration_steps", 25)),
            confirm_steps=(int(p["budget_confirm_steps"])
                           if "budget_confirm_steps" in p else None))
        budget_verdict: dict = {}

        # curriculum-continuity: a stage that claims to CONTINUE a selected
        # checkpoint must start near its dev loss. A first eval far above it
        # means the init is broken (wrong path, dropped adapter, mangled
        # composition) — refuse minutes in, don't finish garbage.
        prev_dev = p.pop("_prev_dev_loss", None)
        continuity_factor = float(p.get("continuity_factor", 1.5))
        continuity_verdict: dict = {}

        class ContinuityGate(TrainerCallback):
            def on_evaluate(self, args, state, control, metrics=None, **kw):
                if (prev_dev is None or continuity_verdict
                        or not metrics or "eval_loss" not in metrics):
                    return
                first = float(metrics["eval_loss"])
                ok = first <= prev_dev * continuity_factor
                continuity_verdict.update(ok=ok, first_eval_loss=first,
                                          prev_dev_loss=prev_dev)
                if not ok:
                    continuity_verdict["message"] = (
                        "curriculum-continuity violated: this stage's first "
                        f"dev loss is {first:.2f}, but the checkpoint it "
                        f"claims to continue was selected at {prev_dev:.2f} "
                        f"(allowed factor {continuity_factor}×)\n"
                        "  why: a stage that inits from a selected checkpoint "
                        "must start near it — starting far worse means the "
                        "init is broken (wrong path, dropped LoRA adapter, "
                        "mangled composition; the crk v8 stage-2 collapse, "
                        "2026-07-14) and everything after is garbage\n"
                        "  fix: check init_from and the adapter lineage; for "
                        "LoRA curricula forge resumes the SAME adapter — if "
                        "you changed the lora config between stages, don't"
                    )
                    print(f"[curriculum] ⛔ {continuity_verdict['message']}",
                          flush=True)
                    if monitor is not None:
                        monitor.emit("event", text="⛔ curriculum-continuity "
                                     "violated — refusing (see log)")
                    control.should_training_stop = True
                else:
                    print(f"[curriculum] continuity ok: first dev loss "
                          f"{first:.2f} vs previous selected {prev_dev:.2f}",
                          flush=True)

        class WallClockGate(TrainerCallback):
            """Thin wrapper over WallClockProjector: prints each labelled
            projection, feeds the monitor, stops the trainer on a refusal."""

            def on_train_begin(self, args, state, control, **kw):
                projector.begin(state.global_step)

            def on_step_end(self, args, state, control, **kw):
                ev = projector.observe(state.global_step, state.max_steps)
                if ev is None:
                    return
                # refusal messages are what/why/fix text; the others carry
                # their own [schedule-sanity] tag already
                print(f"[schedule-sanity] {ev['message']}" if ev["refuse"]
                      else ev["message"], flush=True)
                if monitor is not None:
                    what = ("early wall-clock estimate" if ev["kind"] == "early"
                            else "wall-clock re-estimate")
                    monitor.emit("event", text=(
                        f"{what} ≈ {planned_hours_str(ev['projected_hours'])} "
                        + (f"(budget {budget_hours:g}h)" if budget_set
                           else f"(no budget set; {budget_hours:g}h ceiling)")
                        + (" — REFUSING" if ev["refuse"] else "")))
                if ev["refuse"]:
                    budget_verdict.update(ok=False, message=ev["message"])
                    control.should_training_stop = True

        class MonitorFeed(TrainerCallback):
            """Streams losses to the human panel and honors its stop button
            (the panel's ONE control) at the next step boundary."""

            def on_train_begin(self, args, state, control, **kw):
                self._t0, self._s0 = time.monotonic(), state.global_step

            def on_log(self, args, state, control, logs=None, **kw):
                if monitor is not None and logs and "loss" in logs:
                    monitor.emit("train_loss", step=state.global_step,
                                 loss=float(logs["loss"]))
                    done = state.global_step - getattr(self, "_s0", 0)
                    if done > 0:          # the panel's "next check in about N min"
                        monitor.emit("rate", step=state.global_step,
                                     sec_per_it=(time.monotonic() - self._t0) / done)

            def on_evaluate(self, args, state, control, metrics=None, **kw):
                if monitor is not None and metrics and "eval_loss" in metrics:
                    monitor.emit("dev_loss", step=state.global_step,
                                 loss=float(metrics["eval_loss"]))
                if monitor is not None and metrics and "eval_chrf" in metrics:
                    monitor.emit("dev_score", step=state.global_step,
                                 score=float(metrics["eval_chrf"]))

            def on_step_end(self, args, state, control, **kw):
                if monitor is not None and state.global_step % 50 == 0 \
                        and monitor.stop_requested():
                    print("[monitor] ⛔ HUMAN STOP — halting training now",
                          flush=True)
                    control.should_training_stop = True

        class HeartbeatFeed(TrainerCallback):
            """Tells a job supervisor this run is alive and how far along
            (nmt_forge.jobs; a no-op outside a job)."""

            def on_train_begin(self, args, state, control, **kw):
                heartbeat.beat("train", state.global_step, state.max_steps,
                               force=True, run_dir=str(run_dir))

            def on_step_end(self, args, state, control, **kw):
                heartbeat.beat("train", state.global_step, state.max_steps,
                               run_dir=str(run_dir))

            def on_evaluate(self, args, state, control, **kw):
                heartbeat.beat("evaluate", state.global_step, state.max_steps,
                               force=True, run_dir=str(run_dir))

        class StopFlag(TrainerCallback):
            """Honors <run_dir>/STOP_REQUESTED at the next step boundary
            whether or not the monitor panel is open — the job supervisor's
            first, gentle stop. (MonitorFeed only checked it when the panel
            was enabled.)"""

            def on_step_end(self, args, state, control, **kw):
                if (Path(run_dir) / STOP_BASENAME).exists():
                    print("[jobs] ⛔ STOP requested — halting training at "
                          f"step {state.global_step}", flush=True)
                    control.should_training_stop = True

        class TokenizerWithCheckpoint(TrainerCallback):
            """Every checkpoint dir carries its tokenizer, so any checkpoint
            (selected, exported, served) is self-contained and offline."""

            def on_save(self, args, state, control, **kw):
                ck = Path(args.output_dir) / f"checkpoint-{state.global_step}"
                if ck.is_dir():
                    tok.save_pretrained(str(ck))

        def compute_metrics(eval_pred):
            import numpy as np
            import sacrebleu

            preds, labels = eval_pred.predictions, eval_pred.label_ids
            if isinstance(preds, tuple):
                preds = preds[0]
            pad = tok.pad_token_id if tok.pad_token_id is not None else 0
            preds = np.where(preds < 0, pad, preds)
            labels = np.where(labels < 0, pad, labels)
            hyps = [h.strip() for h in tok.batch_decode(preds, skip_special_tokens=True)]
            refs = [r.strip() for r in tok.batch_decode(labels, skip_special_tokens=True)]
            return {"chrf": sacrebleu.corpus_chrf(hyps, [refs], word_order=2).score}

        trainer = Seq2SeqTrainer(
            model=model, args=targs,
            train_dataset=[encode(r) for r in train_rows],
            eval_dataset=[encode(r) for r in eval_rows],
            compute_metrics=compute_metrics if score_metric else None,
            data_collator=DataCollatorForSeq2Seq(tok, model=model),
            callbacks=[FlooredEarlyStopping(
                early_stopping_patience=p.get("patience", 6)),
                WallClockGate(), ContinuityGate(), MonitorFeed(),
                HeartbeatFeed(), StopFlag(), TokenizerWithCheckpoint()],
        )
        # load_best_model_at_end makes transformers log "There were missing
        # keys in the checkpoint model loaded: [...]" for a Marian model —
        # read in a log, it looks like lost weights (Round 5; Round 9: still
        # flagged, the explanation came a line later). The notice is HELD
        # while the best checkpoint reloads; forge checks every missing key
        # (tied to one saved copy, or recomputed) and prints its one line in
        # the notice's place. Anything it cannot explain releases the
        # transformers notice too, beside forge's loud warning.
        oom_at = None
        with MissingKeysNotice() as notice:
            try:
                trainer.train()
            except RuntimeError as e:
                # out of memory (Apple's GPU past forge's cap, or an NVIDIA card):
                # train() steps down and starts the stage again. The model and
                # trainer are dropped first, so their memory can be freed.
                if "out of memory" not in str(e).lower():
                    raise
                oom_at = int(getattr(trainer.state, "global_step", 0) or 0)
        if oom_at is not None:
            trainer = model = None
            raise _OutOfMemory(oom_at, gpu_cap)
        key_check = best_checkpoint_key_check(trainer)
        notice.settle(key_check)
        if key_check:
            print(key_check["message"], flush=True)
            backend_info["best_checkpoint_keys"] = key_check
        if budget_verdict.get("ok") is False:
            raise BackendError(budget_verdict["message"])
        if continuity_verdict.get("ok") is False:
            raise BackendError(continuity_verdict["message"])
        if stop_record and "effective_at" not in stop_record:
            stop_record["effective_at"] = int(trainer.state.global_step)
        # no extra copy of the model: every checkpoint already holds its
        # weights and tokenizer (TokenizerWithCheckpoint), selection decodes a
        # checkpoint, and a "selected/" copy (written here until 2026-10-15)
        # was read by nothing — a full-size duplicate in every run, which also
        # rode back from the rented machine at full precision
        ckpts, history = [], []
        for entry in trainer.state.log_history:
            if "eval_loss" in entry:
                step = int(entry.get("step", 0))
                score = entry.get("eval_chrf")
                history.append({"step": step, "dev_loss": entry["eval_loss"],
                                **({"dev_score": score} if score is not None else {})})
                ck_path = run_dir / f"checkpoint-{step}"
                # a checkpoint the trainer rotated out (save_total_limit) has
                # NO weights on disk: path=None, so selection can never decode
                # a different model under its name
                ckpts.append(Checkpoint(
                    id=f"checkpoint-{step}", step=step,
                    dev_loss=entry["eval_loss"],
                    path=str(ck_path) if ck_path.is_dir() else None,
                    dev_score=score))
        if not ckpts:
            raise BackendError(
                "the trainer produced no dev evaluations — eval_steps "
                f"({eval_steps}) is larger than the whole run "
                f"({int(trainer.state.max_steps)} steps)\n"
                "  fix: leave model.eval_steps unset (forge derives it from "
                "the run length) or lower it")
        # where the time went: the dev checks (generating every dev sentence)
        # vs the training steps — 2026-10-15, a GPU run's "seconds a step"
        # could not say which of the two was slow
        checks_s = [float(e["eval_runtime"]) for e in trainer.state.log_history if "eval_runtime" in e]
        whole = next((float(e["train_runtime"]) for e in reversed(trainer.state.log_history)
                      if "train_runtime" in e), None)
        steps_done = int(trainer.state.global_step) or None
        backend_info.update({
            "trainable_parameters": int(sum(
                prm.numel() for prm in model.parameters() if prm.requires_grad)),
            "device": str(targs.device),
            "timing": {
                "seconds_whole": round(whole, 1) if whole is not None else None,
                "dev_checks": len(checks_s),
                "seconds_dev_checks": round(sum(checks_s), 1),
                "seconds_per_dev_check": round(sum(checks_s) / len(checks_s), 1) if checks_s else None,
                "seconds_per_step_training": (round((whole - sum(checks_s)) / steps_done, 3)
                                              if whole is not None and steps_done else None),
                "steps": steps_done,
            },
        })
        return TrainResult(backend_id=self.backend_id, checkpoints=ckpts,
                           history=history,
                           stop_event=stop_record or None,
                           backend_info=backend_info)

    # -- decoding ---------------------------------------------------------------

    def load(self, path: str | Path):
        """(model, tokenizer) for a checkpoint dir, cached — serving decodes
        thousands of requests against one load."""
        from transformers import AutoModelForSeq2SeqLM

        key = str(path)
        if key not in self._models:
            import torch

            model = AutoModelForSeq2SeqLM.from_pretrained(key)
            device = str(self.params.get("device", "auto"))
            if device == "auto":
                device = ("cuda" if torch.cuda.is_available() else
                          "mps" if torch.backends.mps.is_available() else "cpu")
            model = model.to(device)
            model.eval()
            self._models[key] = model
        return self._models[key], self._tokenizer(path)

    def decode(self, checkpoint, sources, params) -> list[str]:
        import torch

        if not checkpoint.path:
            raise BackendError(
                f"checkpoint {checkpoint.id} has no weights on disk (rotated "
                "out by save_total_limit) — it cannot be decoded")
        p = {**self.params, **params}
        hook = p.pop("decode_hook", None)
        from .decode_cap import dynamic_cap

        model, tok = self.load(checkpoint.path)
        device = next(model.parameters()).device
        cap = int(p.get("max_new_tokens", 256))
        # a cap proportional to each input (decode.length_ratio; decode_cap.py), else the fixed cap
        ratio, margin = p.get("length_ratio"), int(p.get("length_margin", 32) or 0)
        gen_kwargs = {"max_new_tokens": cap}
        max_src = p.get("max_src", DEFAULT_MAX_SRC)
        if p.get("source_prefix"):                 # the base's tag, as at training (model.source_prefix)
            sources = [str(p["source_prefix"]) + s for s in sources]
        # which inputs the limit cut, and which outputs stopped at the cap
        # without ending (indexes; read by the run, evaluate and serve)
        self.last_decode = {"n": len(sources), "inputs_cut": [], "outputs_at_cap": [],
                            "cap": ({"length_ratio": ratio, "length_margin": margin, "max_new_tokens": cap}
                                    if ratio else {"max_new_tokens": cap})}
        eos = getattr(tok, "eos_token_id", None)

        def _note(idx, texts, ids):
            full = tok(list(texts))["input_ids"]
            self.last_decode["inputs_cut"] += [idx[j] for j, x in enumerate(full) if len(x) > max_src]
            if eos is not None:
                self.last_decode["outputs_at_cap"] += [idx[j] for j, row in enumerate(ids)
                                                       if eos not in [int(t) for t in row]]

        def _cap_for(texts):
            if not ratio:
                return cap
            longest = max(min(len(x), max_src) for x in tok(list(texts))["input_ids"])
            return dynamic_cap(cap, ratio, margin, longest)
        if p.get("tgt_lang"):
            gen_kwargs["forced_bos_token_id"] = target_token_id(tok, p["tgt_lang"])
        out = []
        batch = p.get("decode_batch", 16)

        def _enc(texts):
            enc = tok(texts, return_tensors="pt", padding=True,
                      truncation=True, max_length=p.get("max_src", DEFAULT_MAX_SRC))
            enc.pop("token_type_ids", None)
            return {k: v.to(device) for k, v in enc.items()}

        with torch.no_grad():
            if hook is not None:
                # decode-time feedback (e.g. crk FST validity TIE-BREAK):
                # surface the beam pool + scores, let the hook choose. One
                # source at a time — sequences_scores don't batch-reshape
                # safely across padded inputs.
                beams = int(p.get("num_beams", 4))
                for s in sources:
                    gen = model.generate(
                        **_enc([s]), **{**gen_kwargs, "max_new_tokens": _cap_for([s])}, num_beams=beams,
                        num_return_sequences=beams, output_scores=True,
                        return_dict_in_generate=True)
                    cands = tok.batch_decode(gen.sequences,
                                             skip_special_tokens=True)
                    scores = gen.sequences_scores.tolist()
                    _note([len(out)], [s], gen.sequences[:1])
                    out.append(hook(s, list(zip(cands, scores))))
                return out
            # beam search when asked (the final dev decode, the test, the
            # served model: config.decode.num_beams); greedy otherwise —
            # checkpoint selection ranks ~20 checkpoints and passes none.
            # Until 2026-10-13 this path was greedy whatever the config said
            # (FORGE_MACHINE_CRITIQUE finding 6). No n-gram repetition ban: on
            # a byte model it would forbid any repeated three letters.
            beams = int(p.get("num_beams") or 1)
            if beams > 1:
                gen_kwargs.update(num_beams=beams, early_stopping=True)
            # with a proportional cap, batches of similar length (each batch capped by its longest input);
            # the outputs go back in the callers' order
            order = list(range(len(sources)))
            if ratio:
                lens = [len(x) for x in tok(list(sources))["input_ids"]] if sources else []
                order.sort(key=lambda k: lens[k])
            out = [None] * len(sources)
            for i in range(0, len(sources), batch):
                idx = order[i:i + batch]
                texts = [sources[k] for k in idx]
                ids = model.generate(**_enc(texts), **{**gen_kwargs, "max_new_tokens": _cap_for(texts)})
                _note(idx, texts, ids)
                for k, text in zip(idx, tok.batch_decode(ids, skip_special_tokens=True)):
                    out[k] = text
        return out


class HFScratchBackend(HFSeq2SeqBackend):
    """A tiny transformer trained FROM SCRATCH on CPU — no download.

    params (config.model, beyond the HF ones): vocab_size (BPE merges cap,
    default 4000), d_model (256), layers (3), heads (4), ffn_dim (1024),
    dropout (0.1), max_len (512 positions; sinusoidal, so free). Architecture: Marian (the encoder-decoder
    the opus-mt family uses), shared source/target vocabulary.

    The tokenizer is trained on the TRAINING rows only — never dev, never
    test: a vocabulary fit on test text quietly encodes test statistics.
    """

    backend_id = "hf-scratch"

    def __init__(self, params: dict):
        _require_hf({**params, "backend": self.backend_id})
        # a COPY: cfg.model is part of the hashed config and is never mutated;
        # its limits from its positions (decode_params — what export records)
        self.params = decode_params({**params, "backend": self.backend_id})
        self._toks = {}
        self._models = {}
        self._trained_tok = None

    def _tokenizer(self, path: str | Path | None = None):
        if path is None and self._trained_tok is not None:
            return self._trained_tok
        if path is None or not _has_tokenizer(path):
            raise BackendError(
                "hf-scratch has no tokenizer until it trains one on the "
                "training rows — decode from a checkpoint dir written by "
                "`nmt-forge run` (it carries the tokenizer)")
        from transformers import PreTrainedTokenizerFast

        key = str(path)
        if key not in self._toks:
            self._toks[key] = PreTrainedTokenizerFast.from_pretrained(key)
        return self._toks[key]

    def token_len(self, text: str) -> int:
        if self._trained_tok is not None:
            return len(self._trained_tok(str(text))["input_ids"])
        # before training there is no tokenizer yet. A BPE token is at least
        # one character, so characters + the end marker is a strict UPPER
        # bound: the headroom guard can only err toward refusing a cap that
        # might truncate, never toward allowing one that will
        return len(str(text)) + 1

    def _train_tokenizer(self, train_rows: list[dict], vocab_size: int):
        from tokenizers import (
            Tokenizer,
            decoders,
            models,
            normalizers,
            pre_tokenizers,
            processors,
            trainers,
        )
        from transformers import PreTrainedTokenizerFast

        tok = Tokenizer(models.BPE(unk_token="<unk>"))
        tok.normalizer = normalizers.NFC()
        tok.pre_tokenizer = pre_tokenizers.Metaspace()
        tok.decoder = decoders.Metaspace()
        trainer = trainers.BpeTrainer(
            vocab_size=vocab_size, min_frequency=2,
            special_tokens=["<pad>", "</s>", "<unk>"])
        texts = ([str(r["source"]) for r in train_rows]
                 + [str(r["target"]) for r in train_rows])
        tok.train_from_iterator(texts, trainer)
        eos = tok.token_to_id("</s>")
        tok.post_processor = processors.TemplateProcessing(
            single="$A </s>", pair="$A </s> $B </s>",
            special_tokens=[("</s>", eos)])
        return PreTrainedTokenizerFast(
            tokenizer_object=tok, pad_token="<pad>", eos_token="</s>",
            unk_token="<unk>", model_input_names=["input_ids", "attention_mask"])

    def _init_model(self, p: dict, train_rows: list[dict], run_dir: Path):
        init_from = p.get("init_from")
        if init_from:
            # a later curriculum stage continues the stage-1 weights + vocab
            from transformers import AutoModelForSeq2SeqLM

            self._trained_tok = self._tokenizer(init_from)
            return (AutoModelForSeq2SeqLM.from_pretrained(init_from),
                    self._trained_tok,
                    {"init_from": init_from})
        import torch
        from transformers import MarianConfig, MarianMTModel

        tok = self._train_tokenizer(train_rows, int(p.get("vocab_size", 4000)))
        tok_dir = run_dir / "tokenizer"
        tok.save_pretrained(str(tok_dir))
        self._toks[str(tok_dir)] = tok
        self._trained_tok = tok
        max_len = int(p.get("max_len", 512))
        cfg = MarianConfig(
            vocab_size=len(tok),
            d_model=int(p.get("d_model", 256)),
            encoder_layers=int(p.get("layers", 3)),
            decoder_layers=int(p.get("layers", 3)),
            encoder_attention_heads=int(p.get("heads", 4)),
            decoder_attention_heads=int(p.get("heads", 4)),
            encoder_ffn_dim=int(p.get("ffn_dim", 1024)),
            decoder_ffn_dim=int(p.get("ffn_dim", 1024)),
            dropout=float(p.get("dropout", 0.1)),
            max_position_embeddings=max_len,
            pad_token_id=tok.pad_token_id,
            eos_token_id=tok.eos_token_id,
            decoder_start_token_id=tok.pad_token_id,
            forced_eos_token_id=tok.eos_token_id,
        )
        torch.manual_seed(int(p.get("seed", 42)))
        model = MarianMTModel(cfg)
        return model, tok, {
            "architecture": "marian (from scratch)",
            "tokenizer": {"kind": "BPE (shared source+target)",
                          "trained_on": "TRAIN rows only (never dev/test)",
                          "train_rows": len(train_rows),
                          "vocab_size": len(tok),
                          "vocab_cap": int(p.get("vocab_size", 4000))},
            "config": {k: getattr(cfg, k) for k in
                       ("d_model", "encoder_layers", "decoder_layers",
                        "encoder_attention_heads", "encoder_ffn_dim",
                        "max_position_embeddings")},
        }


_BACKENDS = {
    "dummy": lambda params: DummyBackend(**params.get("dummy", {})),
    "hf-seq2seq": lambda params: HFSeq2SeqBackend(params),
    "hf-scratch": lambda params: HFScratchBackend(params),
}

#: backends that need the [hf] extra (preflight + export consult this)
HF_BACKENDS = ("hf-seq2seq", "hf-scratch")


def make_backend(model_cfg: dict) -> TrainerBackend:
    name = model_cfg.get("backend")
    if name not in _BACKENDS:
        raise BackendError(
            f"unknown backend {name!r}; available: {sorted(_BACKENDS)}"
        )
    return _BACKENDS[name](model_cfg)
