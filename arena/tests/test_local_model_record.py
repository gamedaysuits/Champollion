"""local-model reads a model folder's own record (2026-10-10): a forge
export's forge-model.json says which language tokens the model was trained
with, where it truncates sources and how long it decodes — so mt-eval
decodes it as forge measured it, and a deployment of it ships what was
measured. A folder's family comes from its own config.json before its name.
No torch here: a stand-in tokenizer and model record what the engine asks."""

from __future__ import annotations

import contextlib
import json
import sys
import types
from pathlib import Path

import pytest

from mt_eval_harness.methods.base_http_mt import MTConfigError
from mt_eval_harness.methods.local_model import (
    LocalModelMethod, folder_family, model_record)


def _model(tmp_path: Path, *, record: dict | None = None, model_type: str = "m2m_100",
           tokenizer_class: str = "NllbTokenizerFast", name: str = "model") -> Path:
    d = tmp_path / name
    d.mkdir()
    (d / "config.json").write_text(json.dumps({"model_type": model_type}))
    (d / "tokenizer_config.json").write_text(json.dumps({"tokenizer_class": tokenizer_class}))
    if record is not None:
        (d / "forge-model.json").write_text(json.dumps(dict({"model_dir": "."}, **record)))
    return d


FORGE = {"model_params": {"src_lang": "eng_Latn", "tgt_lang": "crk_Latn", "max_src": 96},
         "decode": {"max_new_tokens": 48, "num_beams": 4, "hook": None}}


def test_the_record_is_read_from_the_folder_it_names(tmp_path):
    d = _model(tmp_path, record=FORGE)
    rec = model_record(d)
    assert rec == {"file": str(d / "forge-model.json"), "src_lang": "eng_Latn",
                   "tgt_lang": "crk_Latn", "max_src": 96, "max_new_tokens": 48}
    # an export from before 2026-10-03: the record beside the folder
    old = tmp_path / "old"
    old.mkdir()
    (old / "model").mkdir()
    (old / "forge-model.json").write_text(json.dumps(dict(FORGE, model_dir="model")))
    assert model_record(old / "model")["tgt_lang"] == "crk_Latn"
    # a record of another folder is not this folder's
    (old / "other").mkdir()
    assert model_record(old / "other") == {}
    (d / "forge-model.json").write_text("{torn")
    with pytest.raises(MTConfigError, match="the model's record cannot be read"):
        model_record(d)


def test_a_folder_says_its_own_family(tmp_path):
    assert folder_family(_model(tmp_path, name="a")) == "nllb"
    assert folder_family(_model(tmp_path, model_type="marian", name="b")) == "opus"
    assert folder_family(_model(tmp_path, tokenizer_class="M2M100Tokenizer", name="c")) is None
    # an NLLB fine-tune saved as ./model is NLLB, whatever its name says
    m = LocalModelMethod(model=str(_model(tmp_path, name="model-d")))
    assert m._resolve_model()[1] == "nllb"


def test_a_model_selected_under_a_forge_hook_is_refused(tmp_path):
    d = _model(tmp_path, record=dict(FORGE, decode={"max_new_tokens": 48,
                                                   "hook": "crk_fst:tie_break"}))
    with pytest.raises(MTConfigError, match="decode hook 'crk_fst:tie_break'.*nmt-forge"):
        LocalModelMethod.resolve_identity({"model": str(d)}, source_code="eng", target_code="crk")


def test_the_tokens_it_was_trained_with_not_the_cards(tmp_path):
    with_record = LocalModelMethod(model=str(_model(tmp_path, record=FORGE, name="a")))
    assert with_record._provider_pair("eng", "crk") == ("eng_Latn", "crk_Latn")
    # the same NLLB folder with no record: the card decides, and NLLB never had crk
    bare = LocalModelMethod(model=str(_model(tmp_path, name="b")))
    with pytest.raises(MTConfigError, match="not in NLLB-200"):
        bare._provider_pair("eng", "crk")
    ident = LocalModelMethod.resolve_identity({"model": str(tmp_path / "a")},
                                              source_code="eng", target_code="crk")
    assert ident["record"] == {"file": "forge-model.json", "src_lang": "eng_Latn",
                               "tgt_lang": "crk_Latn", "max_src": 96, "max_new_tokens": 48}


class _Tok:
    def __init__(self):
        self.calls, self.src_lang = [], None

    def __call__(self, texts, **kw):
        self.calls.append(kw)
        if isinstance(texts, str):
            return {"input_ids": texts.split()}
        enc = {"input_ids": [t.split() for t in texts], "token_type_ids": [[0]] * len(texts)}
        return enc

    def convert_tokens_to_ids(self, token):
        return {"crk_Latn": 7}[token]

    def decode(self, ids, skip_special_tokens=True):
        return f"out-{ids}"


class _Model:
    config = types.SimpleNamespace(max_position_embeddings=512)
    generation_config = None

    def __init__(self):
        self.kwargs = None

    def generate(self, **kw):
        self.kwargs = kw
        return [1, 2]


def test_it_decodes_as_the_record_says(tmp_path, monkeypatch):
    fake_torch = types.SimpleNamespace(no_grad=contextlib.nullcontext)
    monkeypatch.setitem(sys.modules, "torch", fake_torch)
    m = LocalModelMethod(model=str(_model(tmp_path, record=FORGE)))
    tok, model = _Tok(), _Model()
    monkeypatch.setattr(m, "_load", lambda model_id: (tok, model))
    creds = {"model_id": m._resolve_model()[0], "family": "nllb", "backend": "transformers"}
    out = m._infer_transformers(["a b c", "d e"], "eng_Latn", "crk_Latn", creds)
    assert out == ["out-1", "out-2"]
    assert tok.src_lang == "eng_Latn"
    assert tok.calls[-1]["max_length"] == 96, "sources truncated where forge truncates them"
    assert model.kwargs["forced_bos_token_id"] == 7
    assert model.kwargs["max_new_tokens"] == 48, "the decode length forge measured with"
    assert "token_type_ids" not in model.kwargs
    assert m._decode_record["declared_in"] == "forge-model.json decode.max_new_tokens"
