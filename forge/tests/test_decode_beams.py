"""Beam search where the config asks for it (FORGE_MACHINE_CRITIQUE finding 6):
config.decode.num_beams reaches the batched decode — the final dev decode, the
test, the served model — and checkpoint selection, which passes none, stays
greedy. Until 2026-10-13 every batched decode was greedy whatever it said."""

import pytest

pytest.importorskip("torch")

from nmt_forge.training.backends import Checkpoint, HFSeq2SeqBackend  # noqa: E402


class _Tok:
    eos_token_id = 1

    def __call__(self, texts, **kw):
        import torch

        if kw.get("return_tensors"):
            return {"input_ids": torch.zeros((len(texts), 3), dtype=torch.long)}
        return {"input_ids": [[0] * len(t) for t in texts]}         # a byte per letter

    def batch_decode(self, ids, skip_special_tokens=True):
        return [f"out{i}" for i in range(len(ids))]


class _Model:
    def __init__(self):
        self.calls = []

    def parameters(self):
        import torch

        yield torch.zeros(1)

    def generate(self, **kw):
        import torch

        self.calls.append({k: v for k, v in kw.items() if k != "input_ids"})
        n = kw["input_ids"].shape[0]
        out = torch.zeros((n, 4), dtype=torch.long)
        out[0, 2] = 1                       # the first ends; the others ran to the cap
        return out


@pytest.fixture
def backend(monkeypatch):
    b = HFSeq2SeqBackend.__new__(HFSeq2SeqBackend)
    b.params = {"backend": "hf-seq2seq", "base": "x"}
    model = _Model()
    monkeypatch.setattr(b, "load", lambda path: (model, _Tok()))
    return b, model


def test_beams_reach_the_batched_decode(backend):
    b, model = backend
    out = b.decode(Checkpoint(id="c", step=0, path="/x"), ["a", "b"], {"num_beams": 4, "max_new_tokens": 9})
    assert out == ["out0", "out1"]
    assert model.calls[-1]["num_beams"] == 4 and model.calls[-1]["early_stopping"] is True


def test_without_beams_it_is_greedy(backend):
    b, model = backend
    b.decode(Checkpoint(id="c", step=0, path="/x"), ["a"], {"max_new_tokens": 9})
    assert "num_beams" not in model.calls[-1]


def test_cuts_are_noted_going_in_and_coming_out(backend):
    b, model = backend
    b.params["max_src"] = 5
    b.decode(Checkpoint(id="c", step=0, path="/x"), ["short", "much too long", "ok"], {"max_new_tokens": 9})
    # The record also says which cap the decode ran under (fixed here; the
    # proportional cap adds its ratio and margin, 2026-10-17).
    assert b.last_decode == {"n": 3, "inputs_cut": [1], "outputs_at_cap": [1, 2],
                             "cap": {"max_new_tokens": 9}}
