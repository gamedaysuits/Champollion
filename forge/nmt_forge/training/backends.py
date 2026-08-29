"""Trainer backends — forge orchestrates; the backend trains.

Core forge never imports torch. The protocol is small on purpose: train on
rows, report checkpoints, decode from a checkpoint, measure token lengths
(for the generation-headroom guard, mistake #11).

``DummyBackend`` is the deterministic test double (and a dry-run tool): it
fabricates checkpoints with scripted dev losses and scripted decodes, so the
fence/selection/manifest machinery is testable without a GPU or a model.

``HFSeq2SeqBackend`` wraps ``transformers.Seq2SeqTrainer`` (+ LoRA via peft
when configured), mirroring the working reference trainer
(crk-translate ``train_moonshot.py``/``train_v6.py``). It imports lazily and
refuses with install instructions when the extras are absent; its tests run
only where torch/transformers are installed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol, runtime_checkable

from ..errors import BackendError


@dataclass(frozen=True)
class Checkpoint:
    id: str
    step: int
    dev_loss: float | None = None
    path: str | None = None


@dataclass
class TrainResult:
    backend_id: str
    checkpoints: list[Checkpoint]
    history: list[dict] = field(default_factory=list)
    # {"requested_at": step, "effective_at": step, "suppressed": bool} —
    # what early stopping DID, so the runner can explain it in plain language
    stop_event: dict | None = None

    def best_by_loss(self) -> Checkpoint:
        with_loss = [c for c in self.checkpoints if c.dev_loss is not None]
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
        hook = (params or {}).get("decode_hook")
        cands = self.candidate_tables.get(checkpoint.id, {})
        if hook is not None and cands:
            return [hook(s, cands[s]) if s in cands
                    else f"«{checkpoint.id}» {s}" for s in sources]
        table = self.decode_tables.get(checkpoint.id, {})
        return [table.get(s, f"«{checkpoint.id}» {s}") for s in sources]

    def token_len(self, text: str) -> int:
        return len(text.split())


class HFSeq2SeqBackend:
    """transformers Seq2SeqTrainer (+ optional LoRA), reference-trainer shaped.

    params (config.model): base (HF id), lr, epochs, batch_size, grad_accum,
    eval_steps, lora {r, alpha, dropout, target_modules}, src_lang/tgt_lang
    (NLLB-style tokens), max_src/max_tgt.
    """

    backend_id = "hf-seq2seq"

    def __init__(self, params: dict):
        try:
            import torch  # noqa: F401
            import transformers  # noqa: F401
        except ImportError as e:
            raise BackendError(
                "the HF backend needs torch+transformers: "
                "pip install 'nmt-forge[hf]'"
            ) from e
        self.params = params
        self._tok = None

    def _tokenizer(self):
        if self._tok is None:
            from transformers import AutoTokenizer

            p = self.params
            kwargs = {}
            if p.get("src_lang"):
                kwargs = {"src_lang": p["src_lang"], "tgt_lang": p.get("tgt_lang")}
            self._tok = AutoTokenizer.from_pretrained(p["base"], **kwargs)
        return self._tok

    def token_len(self, text: str) -> int:
        return len(self._tokenizer()(text)["input_ids"])

    def train(self, train_rows, dev_rows, params, run_dir) -> TrainResult:
        from transformers import (
            AutoModelForSeq2SeqLM,
            DataCollatorForSeq2Seq,
            EarlyStoppingCallback,
            Seq2SeqTrainer,
            Seq2SeqTrainingArguments,
        )

        p = {**self.params, **params}
        monitor = p.pop("_monitor", None)
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
        max_src = p.get("max_src", 128)
        max_tgt = p.get("max_tgt", 256)

        def encode(row):
            enc = tok(row["source"], text_target=row["target"],
                      truncation=True, max_length=max_src)
            enc["labels"] = enc["labels"][:max_tgt]
            return enc

        eval_steps = p.get("eval_steps", 2000)
        floor_steps = int(p.get("floor_steps", 0))
        targs = Seq2SeqTrainingArguments(
            output_dir=str(run_dir),
            per_device_train_batch_size=p.get("batch_size", 4),
            per_device_eval_batch_size=p.get("batch_size", 4),
            gradient_accumulation_steps=p.get("grad_accum", 4),
            learning_rate=p.get("lr", 2e-4),
            num_train_epochs=p.get("epochs", 3),
            warmup_ratio=p.get("warmup_ratio", 0.02),
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

        stop_record: dict = {}

        class FlooredEarlyStopping(EarlyStoppingCallback):
            """Early stopping held below the schedule floor (generalized from
            crk-translate train_moonshot.py's interim --min-steps fix): in a
            synthetic-dominated mix, real-dev loss bottoming early is the
            EXPECTED pattern, not convergence — see nmt_forge.training.
            schedule for the derivation of the floor."""

            def on_evaluate(self, args, state, control, **kwargs):
                super().on_evaluate(args, state, control, **kwargs)
                if control.should_training_stop:
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

        from transformers import TrainerCallback

        # wall-clock reality check (the crk v8 mis-size): measure sec/it over
        # a short calibration window, project the whole run, refuse a run that
        # cannot finish inside model.time_budget_hours — minutes in, not days
        import time as _time

        from .schedule import check_time_budget

        budget_hours = float(p.get("time_budget_hours", 24))
        calib_steps = int(p.get("budget_calibration_steps", 25))
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
            def on_train_begin(self, args, state, control, **kw):
                budget_verdict["t0"] = _time.monotonic()
                budget_verdict["step0"] = int(state.global_step)

            def on_step_end(self, args, state, control, **kw):
                if budget_verdict.get("checked") or "t0" not in budget_verdict:
                    return
                done = int(state.global_step) - budget_verdict["step0"]
                if done < calib_steps:
                    return
                budget_verdict["checked"] = True
                sec_per_it = (_time.monotonic() - budget_verdict["t0"]) / done
                ok, projected, msg = check_time_budget(
                    sec_per_it, done, int(state.max_steps), budget_hours)
                budget_verdict.update(ok=ok, projected_hours=projected,
                                      sec_per_it=sec_per_it, message=msg)
                print(msg if ok else f"[schedule-sanity] {msg}", flush=True)
                if monitor is not None:
                    monitor.emit("event", text=(
                        f"wall-clock projection: {sec_per_it:.1f}s/it ≈ "
                        f"{projected:.1f}h total (budget {budget_hours:.0f}h)"
                        + ("" if ok else " — REFUSING")))
                if not ok:
                    control.should_training_stop = True

        class MonitorFeed(TrainerCallback):
            """Streams losses to the human panel and honors its stop button
            (the panel's ONE control) at the next step boundary."""

            def on_log(self, args, state, control, logs=None, **kw):
                if monitor is not None and logs and "loss" in logs:
                    monitor.emit("train_loss", step=state.global_step,
                                 loss=float(logs["loss"]))

            def on_evaluate(self, args, state, control, metrics=None, **kw):
                if monitor is not None and metrics and "eval_loss" in metrics:
                    monitor.emit("dev_loss", step=state.global_step,
                                 loss=float(metrics["eval_loss"]))

            def on_step_end(self, args, state, control, **kw):
                if monitor is not None and state.global_step % 50 == 0 \
                        and monitor.stop_requested():
                    print("[monitor] ⛔ HUMAN STOP — halting training now",
                          flush=True)
                    control.should_training_stop = True

        trainer = Seq2SeqTrainer(
            model=model, args=targs,
            train_dataset=[encode(r) for r in train_rows],
            eval_dataset=[encode(r) for r in dev_rows],
            data_collator=DataCollatorForSeq2Seq(tok, model=model),
            callbacks=[FlooredEarlyStopping(
                early_stopping_patience=p.get("patience", 6)),
                WallClockGate(), ContinuityGate(), MonitorFeed()],
        )
        trainer.train()
        if budget_verdict.get("ok") is False:
            raise BackendError(budget_verdict["message"])
        if continuity_verdict.get("ok") is False:
            raise BackendError(continuity_verdict["message"])
        if stop_record and "effective_at" not in stop_record:
            stop_record["effective_at"] = int(trainer.state.global_step)
        trainer.save_model(str(Path(run_dir) / "selected"))
        tok.save_pretrained(str(Path(run_dir) / "selected"))
        ckpts, history = [], []
        for entry in trainer.state.log_history:
            if "eval_loss" in entry:
                step = int(entry.get("step", 0))
                history.append({"step": step, "dev_loss": entry["eval_loss"]})
                ck_path = Path(run_dir) / f"checkpoint-{step}"
                ckpts.append(Checkpoint(
                    id=f"checkpoint-{step}", step=step,
                    dev_loss=entry["eval_loss"],
                    path=str(ck_path) if ck_path.exists() else
                    str(Path(run_dir) / "selected")))
        if not ckpts:
            raise BackendError("HF trainer produced no eval checkpoints — "
                               "check eval_steps vs dataset size")
        return TrainResult(backend_id=self.backend_id, checkpoints=ckpts,
                           history=history,
                           stop_event=stop_record or None)

    def decode(self, checkpoint, sources, params) -> list[str]:
        import torch
        from transformers import AutoModelForSeq2SeqLM

        p = {**self.params, **params}
        hook = p.pop("decode_hook", None)
        tok = self._tokenizer()
        model = AutoModelForSeq2SeqLM.from_pretrained(checkpoint.path)
        model.eval()
        gen_kwargs = {"max_new_tokens": p.get("max_new_tokens", 256)}
        if p.get("tgt_lang"):
            gen_kwargs["forced_bos_token_id"] = tok.convert_tokens_to_ids(
                p["tgt_lang"])
        out = []
        batch = p.get("decode_batch", 16)
        with torch.no_grad():
            if hook is not None:
                # decode-time feedback (e.g. crk FST validity TIE-BREAK):
                # surface the beam pool + scores, let the hook choose. One
                # source at a time — sequences_scores don't batch-reshape
                # safely across padded inputs.
                beams = int(p.get("num_beams", 4))
                for s in sources:
                    enc = tok([s], return_tensors="pt", truncation=True,
                              max_length=p.get("max_src", 128))
                    gen = model.generate(
                        **enc, **gen_kwargs, num_beams=beams,
                        num_return_sequences=beams, output_scores=True,
                        return_dict_in_generate=True)
                    cands = tok.batch_decode(gen.sequences,
                                             skip_special_tokens=True)
                    scores = gen.sequences_scores.tolist()
                    out.append(hook(s, list(zip(cands, scores))))
                return out
            for i in range(0, len(sources), batch):
                enc = tok(sources[i:i + batch], return_tensors="pt",
                          padding=True, truncation=True,
                          max_length=p.get("max_src", 128))
                ids = model.generate(**enc, **gen_kwargs)
                out.extend(tok.batch_decode(ids, skip_special_tokens=True))
        return out


_BACKENDS = {
    "dummy": lambda params: DummyBackend(**params.get("dummy", {})),
    "hf-seq2seq": lambda params: HFSeq2SeqBackend(params),
}


def make_backend(model_cfg: dict) -> TrainerBackend:
    name = model_cfg.get("backend")
    if name not in _BACKENDS:
        raise BackendError(
            f"unknown backend {name!r}; available: {sorted(_BACKENDS)}"
        )
    return _BACKENDS[name](model_cfg)
