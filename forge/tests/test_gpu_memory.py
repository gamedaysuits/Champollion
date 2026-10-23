"""How much memory training may use, and fitting the run to it.

2026-10-13: uncapped, a ByT5-small run held 19 GB of a 24 GB Mac (PyTorch's GPU
pool may grow to 1.7x the recommended working set) and the computer slowed.
2026-10-14, founder: "forge does not need to have a 16gb limit, we have 24gb
locally, if it's failing we need to fix forge" — training gets the computer's
memory less a reserve, and a run that runs out steps down instead of failing."""

import sys
import types

import pytest

from nmt_forge.errors import BackendError
from nmt_forge.training import gpu_memory, memory_plan
from nmt_forge.training.gpu_memory import auto_fraction, cap_gpu_memory, out_of_memory_text

GB = 2 ** 30


def _fake_torch(monkeypatch, *, mps=True, recommended=16 * GB, computer_gb=24.0):
    set_to = []
    torch = types.SimpleNamespace(
        backends=types.SimpleNamespace(mps=types.SimpleNamespace(is_available=lambda: mps)),
        mps=types.SimpleNamespace(recommended_max_memory=lambda: recommended,
                                  set_per_process_memory_fraction=set_to.append, empty_cache=lambda: None),
        cuda=types.SimpleNamespace(is_available=lambda: False))
    monkeypatch.setitem(sys.modules, "torch", torch)
    monkeypatch.setattr(gpu_memory, "_total_gb", lambda: computer_gb)
    # set, then removed: the test's teardown restores the variables as they
    # were, whatever cap_gpu_memory writes to os.environ meanwhile
    for name in (gpu_memory.ENV, gpu_memory.LOW_ENV):
        monkeypatch.setenv(name, "x")
        monkeypatch.delenv(name)
    return set_to


def test_training_gets_the_computer_less_a_reserve():
    rec24, rec16, rec8 = 16 * GB, 10.7 * GB, 5.3 * GB
    assert auto_fraction(rec24, 24) == 1.25                      # 20 GB of a 24 GB Mac
    assert round(auto_fraction(rec16, 16) * 10.7, 1) == 12.0      # 12 GB of a 16 GB one
    assert auto_fraction(rec8, 8) == 1.0                          # never below the recommended share
    assert auto_fraction(48 * GB, 128) <= gpu_memory.MAX_FRACTION
    assert auto_fraction(rec24, None) == 1.0                      # memory unknown: the recommended share


def test_an_apple_gpu_gets_20_of_24_gb_and_says_why(monkeypatch):
    set_to = _fake_torch(monkeypatch)
    cap = cap_gpu_memory()
    assert set_to == [1.25] and cap["cap_gb"] == 20.0 and cap["computer_gb"] == 24.0
    assert "less 4 GB for everything else" in cap["chosen_by"]


def test_the_cleanup_threshold_sits_under_the_cap(monkeypatch):
    """2026-10-13: the cap alone in the environment was refused ("invalid low
    watermark ratio 1.4") — PyTorch's own cleanup threshold sat above it."""
    import os

    _fake_torch(monkeypatch)
    cap_gpu_memory()
    assert os.environ[gpu_memory.LOW_ENV] == "1.000"
    monkeypatch.delenv(gpu_memory.LOW_ENV)
    monkeypatch.setenv(gpu_memory.ENV, "0.5")
    cap_gpu_memory()
    assert os.environ[gpu_memory.LOW_ENV] == "0.400"
    monkeypatch.setenv(gpu_memory.LOW_ENV, "0.3")
    cap_gpu_memory()
    assert os.environ[gpu_memory.LOW_ENV] == "0.3", "the environment's own threshold is kept"


def test_the_config_can_set_the_share_within_bounds(monkeypatch):
    set_to = _fake_torch(monkeypatch)
    cap = cap_gpu_memory(0.9)
    assert cap["cap_gb"] == 14.4 and set_to == [0.9] and "config.json" in cap["chosen_by"]
    for bad in (0, -1, 2.5):
        with pytest.raises(BackendError, match="mps_memory_fraction"):
            cap_gpu_memory(bad)


def test_an_explicit_environment_setting_is_respected(monkeypatch):
    set_to = _fake_torch(monkeypatch)
    monkeypatch.setenv(gpu_memory.ENV, "0.6")
    cap = cap_gpu_memory()
    assert set_to == [], "PyTorch reads the environment itself"
    assert cap["set_by"] == gpu_memory.ENV and cap["cap_gb"] == 9.6


def test_no_apple_gpu_nothing_capped(monkeypatch):
    set_to = _fake_torch(monkeypatch, mps=False)
    assert cap_gpu_memory() is None and set_to == []


def test_when_nothing_fits_the_text_says_what_was_tried_and_what_to_do():
    text = out_of_memory_text({"cap_gb": 20.0}, tried=[{"change": "recompute activations"}])
    assert "20.0 GB" in text and "recompute activations" in text
    assert "LoRA" in text and "byt5-small-lowmem" in text and "mps_memory_fraction" in text
    assert "--remote runpod" in text and "people's yes" in text


# -- fitting the run before training ---------------------------------------------------
class _P:
    def __init__(self, n, grad=True):
        self.n, self.requires_grad = n, grad

    def numel(self):
        return self.n


class _Model:
    def __init__(self, total, trainable):
        self._ps = [_P(trainable, True), _P(total - trainable, False)]

    def parameters(self):
        return iter(self._ps)


def test_a_small_model_trains_as_set():
    plan = memory_plan.plan_memory(_Model(300_000_000, 300_000_000), {}, {"cap_gb": 20.0})
    assert plan["set"] == {} and plan["states_gb"] == 4.5 and "of the 20.0 GB" in plan["say"]


def test_a_tight_model_recomputes_activations_from_the_start():
    # NLLB-600M fully trained with AdamW: ≈ 9.2 GB of 16 → more than 45%: checkpointing on
    plan = memory_plan.plan_memory(_Model(615_000_000, 615_000_000), {}, {"cap_gb": 16.0})
    assert plan["set"] == {"gradient_checkpointing": True} and plan["changes"]


def test_adamw_that_cannot_fit_becomes_adafactor_and_what_never_fits_is_refused():
    plan = memory_plan.plan_memory(_Model(1_300_000_000, 1_300_000_000), {}, {"cap_gb": 20.0})
    assert plan["set"].get("optim") == "adafactor" and not plan.get("refuse")
    big = memory_plan.plan_memory(_Model(3_300_000_000, 3_300_000_000), {}, {"cap_gb": 16.0})
    assert "cannot train here" in big["refuse"] and "LoRA" in big["refuse"] and "remote plan" in big["refuse"]


def test_lora_trains_few_weights_and_fits():
    plan = memory_plan.plan_memory(_Model(1_300_000_000, 4_000_000), {"lora": {"r": 16}}, {"cap_gb": 20.0})
    assert plan["set"] == {} and plan["states_gb"] < 5.0


def test_the_step_down_order_keeps_the_pairs_a_step():
    p = {"batch_size": 8, "grad_accum": 2}
    s1 = memory_plan.next_step_down(p)
    assert s1["set"] == {"gradient_checkpointing": True}
    p.update(s1["set"])
    s2 = memory_plan.next_step_down(p)
    assert s2["set"] == {"batch_size": 4, "grad_accum": 4} and "the same 16 pairs a step" in s2["change"]
    p.update(batch_size=1, grad_accum=16)
    assert memory_plan.next_step_down(p)["set"] == {"optim": "adafactor"}
    p["optim"] = "adafactor"
    assert memory_plan.next_step_down(p) is None


# -- the trainer steps down instead of failing ------------------------------------------
def test_out_of_memory_steps_down_and_records_it(tmp_path, monkeypatch, capsys):
    from nmt_forge.training import backends

    seen = []

    def fake_once(self, train_rows, dev_rows, params, run_dir):
        seen.append(dict(params))
        if len(seen) < 3:
            (tmp_path / f"checkpoint-{len(seen)}").mkdir()
            raise backends._OutOfMemory(100 * len(seen), {"cap_gb": 20.0})
        return backends.TrainResult(backend_id="hf", checkpoints=[], history=[], stop_event=None,
                                    backend_info={})

    monkeypatch.setattr(backends.HFSeq2SeqBackend, "_train_once", fake_once)
    b = backends.HFSeq2SeqBackend.__new__(backends.HFSeq2SeqBackend)
    b.params = {"batch_size": 8, "grad_accum": 2}
    result = b.train([], [], {}, tmp_path)
    assert seen[1]["gradient_checkpointing"] is True and seen[2]["batch_size"] == 4
    fb = result.backend_info["memory_fallbacks"]
    assert [f["at_step"] for f in fb] == [100, 200] and not list(tmp_path.glob("checkpoint-*"))
    out = capsys.readouterr().out
    assert "out of memory at step 100" in out and '"batch_size": 4' in out


def test_when_nothing_is_left_it_stops_with_what_to_do(tmp_path, monkeypatch):
    from nmt_forge.training import backends

    def always_oom(self, *a):
        raise backends._OutOfMemory(5, {"cap_gb": 20.0})

    monkeypatch.setattr(backends.HFSeq2SeqBackend, "_train_once", always_oom)
    b = backends.HFSeq2SeqBackend.__new__(backends.HFSeq2SeqBackend)
    b.params = {"batch_size": 1, "grad_accum": 16, "gradient_checkpointing": True, "optim": "adafactor"}
    with pytest.raises(BackendError, match="LoRA"):
        b.train([], [], {}, tmp_path)


def test_the_target_language_token_for_each_family():
    """NLLB/mBART-50 name the language as a token; M2M-100 maps a code via
    get_lang_id; an unknown code is refused, never forced as the unknown token."""
    from nmt_forge.training.backends import target_token_id

    class Nllb:
        unk_token_id = 3

        def convert_tokens_to_ids(self, t):
            return {"ayr_Latn": 256010}.get(t, 3)

    class M2M(Nllb):
        def get_lang_id(self, code):
            return {"ht": 128039}[code]

    assert target_token_id(Nllb(), "ayr_Latn") == 256010
    assert target_token_id(M2M(), "ht") == 128039
    with pytest.raises(BackendError, match="not a language token"):
        target_token_id(Nllb(), "tlh_Latn")
