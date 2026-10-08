"""Round 10 synthetic researcher (eng>sme, Northern Sami): the harness fixes.

1. `mt-eval run --method local-model -m <dir>` ran a DIFFERENT model: the
   runner relabelled config.model to the engine id before it read -m, so the
   adapter never saw the directory and fell back to its silent default
   (Helsinki-NLP/opus-mt-en-es), translated eng>sme into Spanish, and recorded
   neither model. `contest qualify` then minted a receipt (8.54) from that
   run; only the node's re-execution of the real weights (3.37) exposed it,
   and the node passed without a word about the gap.
2. The node's declarative engine passed no generation length, so
   transformers decoded with its default max_length (=21).
3. A plugin declaring dependency class A1 was called "self-contained" on the
   cost line.
4. The publish preview omitted the method-card fields the board shows.
6. submit-model packed every file in a forge export's model/ folder and then
   refused its own package (DEPLOY.md).
7. Pair notation: eng-crk and 'eng>crk' both accepted; printed quoted.

No torch needed: the transformers loaders are faked where a test needs the
decode path, and the local-model inference is monkeypatched.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import io
import json
import sys
import types
from pathlib import Path

import pytest

from mt_eval_harness.config import RunConfig


def _quiet(fn, *a, **kw):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*a, **kw)


def _corpus(tmp_path: Path, target: str = "sme", name="dev.json") -> Path:
    c = tmp_path / name
    c.write_text(json.dumps({
        "dataset": {"corpus_id": "eval-eng-sme-rehearsal-qualifier-v2026",
                    "language_pair": {"source": "eng", "target": target},
                    "license": "CC-BY-2.0"},
        "entries": [{"id": str(i), "source": f"there is an old house {i}",
                     "reference": f"dan gujis lea boares viessu {i}"}
                    for i in range(4)]}), encoding="utf-8")
    return c


def _model_dir(root: Path, *, weights: bytes = b"W" * 64,
               extras: dict | None = None) -> Path:
    """A transformers-shaped model dir (contents are never loaded here)."""
    root.mkdir(parents=True, exist_ok=True)
    (root / "config.json").write_text(json.dumps(
        {"architectures": ["MarianMTModel"], "max_position_embeddings": 512}))
    (root / "model.safetensors").write_bytes(weights)
    (root / "tokenizer.json").write_text("{}")
    for name, content in (extras or {}).items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    return root


@pytest.fixture
def fake_local_model(monkeypatch):
    """Run local-model without torch: credentials and inference patched.
    Records the model id each inference call was handed."""
    from mt_eval_harness.methods.local_model import LocalModelMethod
    seen: list[str] = []

    def creds(self):
        model_id, family, backend = self._resolve_model()
        return {"model_id": model_id, "family": family, "backend": backend}

    def infer(self, texts, src, tgt, c):
        seen.append(c["model_id"])
        return [f"sami {t}" for t in texts]

    monkeypatch.setattr(LocalModelMethod, "_resolve_credentials", creds)
    monkeypatch.setattr(LocalModelMethod, "_infer", infer)
    monkeypatch.delenv("LOCAL_MODEL_ID", raising=False)
    return seen


def _run(tmp_path: Path, name: str, **cfg):
    from mt_eval_harness.runner import execute_run
    out = tmp_path / name
    config = RunConfig(mt_method="local-model",
                       corpus_path=str(cfg.pop("corpus", _corpus(tmp_path))),
                       output_dir=str(out),
                       cache_dir=str(tmp_path / f"cache-{name}"),
                       dataset="all", **cfg)
    log = _quiet(lambda: asyncio.run(execute_run(config)))
    report = next(out.glob("*_report.json"))
    return log, report


# ===========================================================================
# 1. local-model runs the model it is given, and says which
# ===========================================================================

class TestLocalModelHasNoDefault:
    def test_no_model_is_refused_with_the_flag(self, monkeypatch):
        from mt_eval_harness.methods.base_http_mt import MTConfigError
        from mt_eval_harness.methods.local_model import LocalModelMethod
        monkeypatch.delenv("LOCAL_MODEL_ID", raising=False)
        with pytest.raises(MTConfigError, match="-m/--model"):
            LocalModelMethod()._resolve_model()

    def test_the_old_default_is_gone(self):
        import mt_eval_harness.methods.local_model as lm
        assert not hasattr(lm, "DEFAULT_LOCAL_MODEL")

    def test_env_names_the_model_and_says_so(self, monkeypatch):
        from mt_eval_harness.methods.local_model import LocalModelMethod
        monkeypatch.setenv("LOCAL_MODEL_ID", "facebook/nllb-200-distilled-600M")
        model, origin = LocalModelMethod.model_source({})
        assert model == "facebook/nllb-200-distilled-600M"
        assert "LOCAL_MODEL_ID" in origin

    def test_a_missing_directory_is_never_read_as_a_hub_id(self, tmp_path,
                                                           monkeypatch):
        from mt_eval_harness.methods.base_http_mt import MTConfigError
        from mt_eval_harness.methods.local_model import LocalModelMethod
        monkeypatch.chdir(tmp_path)
        with pytest.raises(MTConfigError, match="no directory"):
            LocalModelMethod(model="./forge-sme/export/model")._resolve_model()

    def test_every_other_engine_takes_no_model(self):
        from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
        takes = sorted(n for n, c in MT_METHOD_REGISTRY.items()
                       if getattr(c, "takes_model", False))
        assert takes == ["local-model"]


class TestModelIdentity:
    def test_directory_identity_carries_a_content_hash(self, tmp_path):
        from mt_eval_harness.methods.local_model import (
            LocalModelMethod, directory_manifest,
        )
        d = _model_dir(tmp_path / "model",
                       extras={"DEPLOY.md": "# deploy", ".git/HEAD": "x"})
        ident = LocalModelMethod.resolve_identity({"model": str(d)})
        assert ident["kind"] == "directory" and ident["id"] == "model"
        sha, files = directory_manifest(d)
        assert ident["sha256"] == sha
        # dot-directories are not part of the model
        assert ".git/HEAD" not in [f["path"] for f in files]
        assert "model.safetensors" in [f["path"] for f in files]

    def test_other_weights_are_another_hash(self, tmp_path):
        from mt_eval_harness.methods.local_model import LocalModelMethod
        a = LocalModelMethod.resolve_identity(
            {"model": str(_model_dir(tmp_path / "a"))})
        b = LocalModelMethod.resolve_identity(
            {"model": str(_model_dir(tmp_path / "b", weights=b"V" * 64))})
        assert a["sha256"] != b["sha256"]

    def test_hub_id(self):
        from mt_eval_harness.methods.local_model import LocalModelMethod
        ident = LocalModelMethod.resolve_identity(
            {"model": "facebook/nllb-200-distilled-600M"})
        assert ident["kind"] == "hub"
        assert ident["id"] == "facebook/nllb-200-distilled-600M"
        assert ident["sha256"] is None


class TestPairMismatch:
    def test_opus_en_es_on_eng_sme_is_refused(self):
        from mt_eval_harness.methods.base_http_mt import MTConfigError
        from mt_eval_harness.methods.local_model import LocalModelMethod
        with pytest.raises(MTConfigError) as e:
            LocalModelMethod.resolve_identity(
                {"model": "Helsinki-NLP/opus-mt-en-es"},
                source_code="eng", target_code="sme")
        msg = str(e.value)
        assert "en>es" in msg and "eng>sme" in msg
        assert "--allow-model-pair-mismatch" in msg

    def test_on_purpose_it_runs_and_is_recorded(self):
        from mt_eval_harness.methods.local_model import LocalModelMethod
        ident = LocalModelMethod.resolve_identity(
            {"model": "Helsinki-NLP/opus-mt-en-fi"}, source_code="eng",
            target_code="sme", allow_pair_mismatch=True)
        assert ident["pair_mismatch"]["acknowledged"] is True
        assert ident["pair_mismatch"]["model_pair"] == "en>fi"

    @pytest.mark.parametrize("model,src,tgt", [
        ("Helsinki-NLP/opus-mt-en-se", "eng", "sme"),     # 639-1 == 639-3
        ("Helsinki-NLP/opus-mt-en-zh", "eng", "cmn"),     # macrolanguage
        ("Helsinki-NLP/opus-mt-en-gem", "eng", "sme"),    # a group: unchecked
        ("Helsinki-NLP/opus-mt-en-ROMANCE", "eng", "fra"),
        ("facebook/nllb-200-distilled-600M", "eng", "sme"),  # not a pair model
    ])
    def test_no_visible_mismatch(self, model, src, tgt):
        from mt_eval_harness.methods.local_model import pair_mismatch
        assert pair_mismatch(model, src, tgt) is None


class TestTheRunRecordsTheModel:
    def test_cli_hands_m_to_the_engine(self):
        """`-m` given with an engine reaches config.method_model (it used to
        be kept only for a plugin directory)."""
        from mt_eval_harness.cli import args_to_config, build_parser
        args = build_parser().parse_args(
            ["run", "--corpus", "c.json", "--method", "local-model",
             "-m", "./forge-sme/export/model"])
        cfg = args_to_config(args)
        assert cfg.mt_method == "local-model"
        assert cfg.method_model == "./forge-sme/export/model"

    def test_the_directory_given_is_the_directory_loaded(
            self, tmp_path, fake_local_model):
        d = _model_dir(tmp_path / "forge-sme" / "export" / "model")
        log, report = _run(tmp_path, "r1", method_model=str(d))
        assert fake_local_model and set(fake_local_model) == {str(d.resolve())}
        em = log["provenance"]["engine_model"]
        assert em["kind"] == "directory" and em["id"] == "model"
        assert em["sha256"] and em["files"]
        # the TestReport carries it too (it copies the config)
        rep = json.loads(report.read_text())
        assert rep["config"]["engine_model"]["sha256"] == em["sha256"]
        assert log["results"][0]["predicted"].startswith("sami ")

    def test_an_api_caller_s_model_is_read_as_given(self, tmp_path,
                                                    fake_local_model):
        d = _model_dir(tmp_path / "m")
        log, _ = _run(tmp_path, "r2", model=str(d))
        assert log["provenance"]["engine_model"]["path"] == str(d.resolve())

    def test_no_model_refuses_before_anything_runs(self, tmp_path,
                                                   fake_local_model):
        from mt_eval_harness.runner import execute_run
        cfg = RunConfig(mt_method="local-model",
                        corpus_path=str(_corpus(tmp_path)),
                        output_dir=str(tmp_path / "o"),
                        cache_dir=str(tmp_path / "c"), dataset="all",
                        dry_run=True)
        with pytest.raises(ValueError, match="-m/--model"):
            _quiet(lambda: asyncio.run(execute_run(cfg)))
        assert not fake_local_model

    def test_the_dry_run_refuses_the_pair_mismatch(self, tmp_path,
                                                   fake_local_model):
        from mt_eval_harness.runner import execute_run
        cfg = RunConfig(mt_method="local-model",
                        method_model="Helsinki-NLP/opus-mt-en-es",
                        corpus_path=str(_corpus(tmp_path)),
                        output_dir=str(tmp_path / "o"),
                        cache_dir=str(tmp_path / "c"), dataset="all",
                        dry_run=True)
        with pytest.raises(ValueError, match="en>es"):
            _quiet(lambda: asyncio.run(execute_run(cfg)))

    def test_header_names_the_model(self, tmp_path, fake_local_model):
        from mt_eval_harness.runner import execute_run
        d = _model_dir(tmp_path / "mymodel")
        cfg = RunConfig(mt_method="local-model", method_model=str(d),
                        corpus_path=str(_corpus(tmp_path)),
                        output_dir=str(tmp_path / "o"),
                        cache_dir=str(tmp_path / "c"), dataset="all",
                        dry_run=True)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            asyncio.run(execute_run(cfg))
        out = buf.getvalue()
        assert "mymodel (local directory, sha256" in out
        assert "Model given:" in out

    def test_m_given_to_a_cloud_engine_is_said_unused(self, tmp_path):
        from mt_eval_harness.runner import execute_run
        cfg = RunConfig(mt_method="google-translate", method_model="nmt",
                        corpus_path=str(_corpus(tmp_path)),
                        output_dir=str(tmp_path / "o"),
                        cache_dir=str(tmp_path / "c"), dataset="all",
                        dry_run=True)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            asyncio.run(execute_run(cfg))
        assert "-m nmt is not used" in buf.getvalue()
        assert cfg.method_model == ""

    def test_two_models_never_share_cached_outputs(self, tmp_path):
        a = RunConfig(mt_method="local-model", method_model="./a",
                      engine_model={"id": "a", "sha256": "1" * 64})
        b = RunConfig(mt_method="local-model", method_model="./a",
                      engine_model={"id": "a", "sha256": "2" * 64})
        c = RunConfig(mt_method="local-model", method_model="./b")
        assert len({a.config_hash(), b.config_hash(), c.config_hash()}) == 3
        # an ordinary run's namespace is unchanged by the new keys
        assert RunConfig().config_hash() == RunConfig(method_model="").config_hash()


class TestTheCardAndFingerprint:
    def test_card_names_the_model_never_the_local_path(self, tmp_path,
                                                       fake_local_model):
        from mt_eval_harness.publish import assemble_run_card
        d = _model_dir(tmp_path / "secret-home" / "model")
        log, report = _run(tmp_path, "c1", method_model=str(d))
        card, _id, fp = _quiet(assemble_run_card, report)
        em = card["engine_model"]
        assert em["id"] == "model" and em["sha256"]
        assert "path" not in em and "files" not in em
        assert "secret-home" not in json.dumps(card["method_config"])
        assert card["method_config"]["model"] == f"model@sha256:{em['sha256']}"
        comps = card["fingerprint"]["components"]
        assert comps["method_model"] == "model"
        assert comps["method_model_sha256"] == em["sha256"]

    def test_two_models_are_two_fingerprints(self, tmp_path, fake_local_model):
        from mt_eval_harness.publish import assemble_run_card
        a = _model_dir(tmp_path / "x" / "model")
        b = _model_dir(tmp_path / "y" / "model", weights=b"V" * 64)
        _, ra = _run(tmp_path, "fa", method_model=str(a))
        _, rb = _run(tmp_path, "fb", method_model=str(b))
        fa = _quiet(assemble_run_card, ra)[2]
        fb = _quiet(assemble_run_card, rb)[2]
        assert fa != fb

    def test_terminal_card_shows_the_engine_model(self, tmp_path,
                                                  fake_local_model):
        from mt_eval_harness.run_card import render_run_card
        d = _model_dir(tmp_path / "model")
        log, report = _run(tmp_path, "t1", method_model=str(d))
        run_log = next((tmp_path / "t1").glob("run_*[!t].json"))
        text = render_run_card(run_log, report)
        assert "Engine model" in text and "local directory" in text

    def _old_style(self, tmp_path, fake_local_model):
        """A run log as a pre-Round-10 harness wrote it: no engine_model."""
        d = _model_dir(tmp_path / "model")
        _run(tmp_path, "old", method_model=str(d))
        log_path = next((tmp_path / "old").glob("run_*[!t].json"))
        log = json.loads(log_path.read_text())
        log["provenance"].pop("engine_model")
        log["config"].pop("engine_model")
        log["config"]["method_model"] = ""
        log_path.write_text(json.dumps(log))
        report_path = next((tmp_path / "old").glob("*_report.json"))
        rep = json.loads(report_path.read_text())
        rep["config"].pop("engine_model", None)
        report_path.write_text(json.dumps(rep))
        return log_path, report_path

    def test_an_old_run_log_is_marked_and_never_published(
            self, tmp_path, fake_local_model, monkeypatch):
        from mt_eval_harness import publish
        _, report = self._old_style(tmp_path, fake_local_model)
        card, _, _ = _quiet(publish.assemble_run_card, report)
        assert "recorded no model" in card["engine_model_unrecorded"]
        monkeypatch.setattr(publish, "_is_prod_target", lambda: False)
        monkeypatch.setattr(publish, "get_session",
                            lambda: {"access_token": "t"})
        monkeypatch.setattr(publish, "get_submitter_name", lambda s: "me")
        with pytest.raises(SystemExit):
            _quiet(publish.publish_to_supabase, str(report),
                   auto_confirm=True)


# ===========================================================================
# 1e. qualify names the model; submit-model checks the weights; the node
#     flags the receipt gap
# ===========================================================================

OFFLINE_Q = {"qualifier_id": "eval-eng-sme-rehearsal-qualifier-v2026",
             "threshold": 0.0,
             "corpus_card_id": "eval-eng-sme-rehearsal-qualifier-v2026",
             "language_pair": "eng>sme"}


class TestQualifyNamesTheModel:
    def test_a_run_that_names_no_model_is_refused(self, tmp_path,
                                                  fake_local_model):
        from mt_eval_harness.contest_qualify import QualifierError, qualify
        log_path, _ = TestTheCardAndFingerprint()._old_style(
            tmp_path, fake_local_model)
        with pytest.raises(QualifierError, match="does not name the model"):
            _quiet(qualify, "eng-sme-rehearsal", dev_hyp_path=log_path,
                   dev_corpus_path=_corpus(tmp_path), system_label="tiny",
                   method_class="pipeline", receipt_dir=tmp_path / "rc",
                   offline_qualifier=OFFLINE_Q)
        assert not list((tmp_path / "rc").rglob("tiny-*.json"))

    def test_the_receipt_names_the_directory_and_its_files(
            self, tmp_path, fake_local_model):
        from mt_eval_harness.contest_qualify import qualify
        d = _model_dir(tmp_path / "model")
        _run(tmp_path, "q1", method_model=str(d))
        log_path = next((tmp_path / "q1").glob("run_*[!t].json"))
        receipt = _quiet(qualify, "eng-sme-rehearsal", dev_hyp_path=log_path,
                         dev_corpus_path=_corpus(tmp_path), system_label="tiny",
                         method_class="pipeline", receipt_dir=tmp_path / "rc",
                         offline_qualifier=OFFLINE_Q)
        run = receipt["run"]
        assert run["system"] == "local-model"
        assert run["model"].startswith("model@sha256:")
        assert "model.safetensors" in [f["path"] for f in
                                       run["engineModel"]["files"]]

    def test_a_hypotheses_file_names_no_run(self, tmp_path):
        from mt_eval_harness.contest_qualify import qualify
        hyps = tmp_path / "h.txt"
        hyps.write_text("\n".join(f"dan gujis {i}" for i in range(4)) + "\n")
        receipt = _quiet(qualify, "eng-sme-rehearsal", dev_hyp_path=hyps,
                         dev_corpus_path=_corpus(tmp_path), system_label="t2",
                         method_class="pipeline", receipt_dir=tmp_path / "rc",
                         offline_qualifier=OFFLINE_Q)
        assert receipt["run"] is None


class TestSubmitChecksTheWeights:
    def _receipt(self, d):
        from mt_eval_harness.methods.local_model import directory_manifest
        sha, files = directory_manifest(d)
        return {"run": {"kind": "run log", "system": "local-model",
                        "engineModel": {"kind": "directory", "id": d.name,
                                        "sha256": sha, "files": files}}}

    def test_the_same_weights_pass(self, tmp_path):
        from mt_eval_harness.model_bundle import receipt_model_check
        d = _model_dir(tmp_path / "model", extras={"DEPLOY.md": "x"})
        assert receipt_model_check(self._receipt(d), d,
                                   "model.safetensors") == (None, None)

    def test_other_weights_are_refused_naming_both(self, tmp_path):
        from mt_eval_harness.model_bundle import receipt_model_check
        a = _model_dir(tmp_path / "a")
        b = _model_dir(tmp_path / "b", weights=b"V" * 64)
        refusal, _ = receipt_model_check(self._receipt(a), b,
                                         "model.safetensors")
        assert refusal and "not among its files" in refusal
        assert "--method local-model -m" in refusal

    @pytest.mark.parametrize("receipt", [
        {}, {"run": None},
        {"run": {"system": "harness LLM", "model": "x/y"}},
        {"run": {"system": "local-model",
                 "engineModel": {"kind": "hub", "id": "org/m"}}}])
    def test_what_cannot_be_told_here_is_a_note(self, tmp_path, receipt):
        from mt_eval_harness.model_bundle import receipt_model_check
        d = _model_dir(tmp_path / "m")
        refusal, note = receipt_model_check(receipt, d, "model.safetensors")
        assert refusal is None and note


class TestReceiptGap:
    def test_the_round_10_gap_is_flagged(self):
        from mt_eval_harness.qualifier_gate import (
            QUALIFIER_RECEIPT_GAP_POINTS, receipt_gap,
        )
        assert QUALIFIER_RECEIPT_GAP_POINTS == 2.0
        gap = receipt_gap(8.54, 3.37)
        assert gap["gap"] == 5.17 and gap["direction"] == "below"
        assert "8.54" in gap["message"] and "3.37" in gap["message"]

    @pytest.mark.parametrize("claimed,measured", [
        (8.54, 8.0), (3.37, 3.37), (None, 3.0), (5.0, None), ("x", 1)])
    def test_within_bound_or_unknown_is_not_flagged(self, claimed, measured):
        from mt_eval_harness.qualifier_gate import receipt_gap
        assert receipt_gap(claimed, measured) is None

    def test_a_node_above_the_receipt_is_flagged_too(self):
        from mt_eval_harness.qualifier_gate import receipt_gap
        assert receipt_gap(3.0, 9.0)["direction"] == "above"


# ===========================================================================
# 2. An explicit decode length, on the node and in local-model
# ===========================================================================

class TestDecodeLength:
    def test_declared_wins_and_new_tokens_beats_length(self):
        from mt_eval_harness import decode_length as dl
        assert dl.declared_length(("a", {}), ("b", {"max_length": 200})) == \
            {"max_length": 200, "from": "b"}
        assert dl.declared_length(
            ("a", {"max_length": 9, "max_new_tokens": 7}))["max_new_tokens"] == 7

    def test_harness_bound_is_relative_and_capped(self):
        from mt_eval_harness import decode_length as dl
        assert dl.harness_bound(3) == dl.DECODE_MIN_NEW_TOKENS
        assert dl.harness_bound(100) == 100 * dl.DECODE_TOKENS_PER_SOURCE_TOKEN
        assert dl.harness_bound(1000, positions=512) == 511
        assert dl.generation_kwargs(None, 30) == {"max_new_tokens": 120}
        assert dl.generation_kwargs({"max_length": 900}, 30,
                                    positions=512) == {"max_length": 512}

    def test_the_forge_generation_config_declares_none(self, tmp_path):
        from mt_eval_harness.model_runner import declarative_decode_record
        d = _model_dir(tmp_path / "b", extras={
            "generation_config.json": json.dumps(
                {"_from_model_config": True, "decoder_start_token_id": 0,
                 "eos_token_id": 1, "use_cache": True,
                 "output_attentions": False, "output_hidden_states": False})})
        rec = declarative_decode_record(d, {"model": {"generation": {}}})
        assert rec["source"] == "harness-rule" and rec["positions_cap"] == 512

    def test_forge_generation_keys_draw_no_warning(self, tmp_path):
        from mt_eval_harness.model_runner import ALLOWED_GENERATION_KEYS
        assert {"use_cache", "output_attentions",
                "output_hidden_states"} <= ALLOWED_GENERATION_KEYS
        assert "return_dict_in_generate" not in ALLOWED_GENERATION_KEYS

    def _fake_transformers(self, monkeypatch, calls, *, declared=None):
        """A transformers + torch stand-in that records generate() kwargs."""
        class Enc(dict):
            pass

        class Ids:
            def __init__(self, n):
                self.shape = (1, n)

        class Tok:
            def __call__(self, text, **kw):
                n = len(str(text).split())
                if kw.get("return_tensors"):
                    return Enc(input_ids=Ids(n))
                return {"input_ids": list(range(n))}

            def batch_decode(self, ids, **kw):
                return ["out"] * len(ids)

            def decode(self, ids, **kw):
                return "out"

        class GenCfg:
            def to_diff_dict(self):
                return dict(declared or {})

        class Model:
            config = types.SimpleNamespace(max_position_embeddings=512,
                                           _commit_hash="abc123")
            generation_config = GenCfg()

            def eval(self):
                return self

            def generate(self, **kw):
                calls.append({k: v for k, v in kw.items()
                              if k in ("max_new_tokens", "max_length")})
                n = len(kw.get("input_ids", [1])) if isinstance(
                    kw.get("input_ids"), list) else 1
                return [[0]] * n

        fake = types.ModuleType("transformers")
        fake.AutoTokenizer = types.SimpleNamespace(
            from_pretrained=lambda *a, **k: Tok())
        fake.AutoModelForSeq2SeqLM = types.SimpleNamespace(
            from_pretrained=lambda *a, **k: Model())
        torch = types.ModuleType("torch")
        torch.no_grad = contextlib.nullcontext
        monkeypatch.setitem(sys.modules, "transformers", fake)
        monkeypatch.setitem(sys.modules, "torch", torch)

    def test_the_node_engine_always_passes_a_length(self, tmp_path,
                                                    monkeypatch):
        from mt_eval_harness.model_runner import hf_translate
        calls: list = []
        self._fake_transformers(monkeypatch, calls)
        d = _model_dir(tmp_path / "b")
        hf_translate(d, ["one two three", " ".join(["w"] * 40)],
                     {"model": {"generation": {}}})
        assert calls == [{"max_new_tokens": 64}, {"max_new_tokens": 160}]

    def test_the_node_engine_honours_a_declared_length(self, tmp_path,
                                                       monkeypatch):
        from mt_eval_harness.model_runner import hf_translate
        calls: list = []
        self._fake_transformers(monkeypatch, calls)
        d = _model_dir(tmp_path / "b", extras={
            "generation_config.json": json.dumps({"max_length": 300})})
        hf_translate(d, ["a b"], {"model": {"generation": {}}})
        assert calls == [{"max_length": 300}]

    def test_local_model_uses_the_same_rule(self, tmp_path, monkeypatch):
        from mt_eval_harness.methods.local_model import LocalModelMethod
        calls: list = []
        self._fake_transformers(monkeypatch, calls)
        d = _model_dir(tmp_path / "m")
        m = LocalModelMethod(model=str(d))
        creds = {"model_id": str(d.resolve()), "family": "opus",
                 "backend": "transformers"}
        m._infer_transformers(["a b c", " ".join(["w"] * 50)], "eng", "sme",
                              creds)
        assert calls == [{"max_new_tokens": 200}]   # 4 x the longest (50)
        ident = m.model_identity()
        assert ident["decode"]["source"] == "harness-rule"

    def test_local_model_records_a_hub_revision(self, monkeypatch):
        from mt_eval_harness.methods.local_model import LocalModelMethod
        calls: list = []
        self._fake_transformers(monkeypatch, calls, declared={"max_length": 512})
        m = LocalModelMethod(model="Helsinki-NLP/opus-mt-en-se")
        m._infer_transformers(["a"], "eng", "sme",
                              {"model_id": "Helsinki-NLP/opus-mt-en-se",
                               "family": "opus", "backend": "transformers"})
        assert calls == [{"max_length": 512}]
        ident = m.model_identity()
        assert ident["revision"] == "abc123"
        assert ident["decode"]["source"] == "declared"

    def test_execution_facts_record_the_length_the_engine_applied(
            self, tmp_path, monkeypatch):
        from mt_eval_harness import model_runner as mr
        calls: list = []
        self._fake_transformers(monkeypatch, calls)
        d = _model_dir(tmp_path / "b")
        corpus = _corpus(tmp_path)
        facts = mr.run_declarative_model(
            bundle_dir=d, corpus_path=corpus, work_dir=tmp_path / "w",
            manifest={"model": {"generation": {}}})
        assert facts["generation"]["source"] == "harness-rule"
        assert mr.declarative_execution_facts(
            facts, node_id="n")["generation"]["source"] == "harness-rule"
        injected = mr.run_declarative_model(
            bundle_dir=d, corpus_path=corpus, work_dir=tmp_path / "w2",
            manifest={}, translator=lambda b, s, m: ["x"] * len(s))
        assert "generation" not in injected


# ===========================================================================
# 3. The cost line follows the declared dependency class
# ===========================================================================

class TestCostLine:
    def _plugin(self, tmp_path, dep_class):
        d = tmp_path / f"plug-{dep_class}"
        d.mkdir()
        manifest = {"name": "p", "method_id": "p", "entry_point": "x:Y"}
        if dep_class:
            manifest["dependency_class"] = dep_class
        (d / "method.json").write_text(json.dumps(manifest))
        return d

    @pytest.mark.parametrize("dep,words", [
        ("A1", "calls an LLM itself"), ("S", "self-contained"),
        ("A2", "external service"), (None, "no dependency class declared")])
    def test_basis_follows_the_class(self, tmp_path, dep, words):
        from mt_eval_harness.api import estimate_run_cost
        cfg = RunConfig(method_path=str(self._plugin(tmp_path, dep)))
        cost, basis = estimate_run_cost([], cfg)
        assert cost is None and words in basis
        if dep == "A1":
            assert "self-contained" not in basis

    def test_the_real_run_says_a1_not_self_contained(self, tmp_path):
        """The persona's cost line, from a real plugin run."""
        from mt_eval_harness.runner import execute_run
        from test_round5_researcher_fixes import _plugin
        cfg = RunConfig(method_path=str(_plugin(tmp_path)),
                        corpus_path=str(_corpus(tmp_path, target="fra")),
                        target_lang="French", dataset="all",
                        output_dir=str(tmp_path / "o"),
                        cache_dir=str(tmp_path / "c"))
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            asyncio.run(execute_run(cfg))
        line = next(l for l in buf.getvalue().splitlines()
                    if "Est. cost:" in l)
        assert "dependency class A1" in line
        assert "self-contained" not in line


# ===========================================================================
# 4. The publish preview shows what the board shows
# ===========================================================================

class TestPublishPreview:
    def test_plugin_fields(self):
        from mt_eval_harness.publish import method_preview_lines
        card = {"method_card": {"method_id": "fewshot-local-v1",
                                "name": "Few-shot", "class": "coached-llm",
                                "paradigm": "llm", "dependency_class": "A1",
                                "tools_used": [], "open_source": True},
                "method_plugin": {"code_sha256": "ab" * 32, "version": "0.1.0",
                                  "model_given": "stub-1",
                                  "dependency_class": "A1"}}
        text = "\n".join(method_preview_lines(
            card, {"method_class": "coached-llm", "paradigm": "llm"}))
        for want in ("fewshot-local-v1", "class coached-llm", "paradigm llm",
                     "A1 (API-dependent, substitutable)", "Open source:   yes",
                     "sha256 abababab", "version 0.1.0", "stub-1",
                     "Tools:         none"):
            assert want in text, want

    def test_engine_model_and_harness_llm(self):
        from mt_eval_harness.publish import method_preview_lines
        text = "\n".join(method_preview_lines(
            {"method_card": {"method_id": "local-model", "class": "pipeline",
                             "paradigm": "neural-nmt"},
             "engine_model": {"kind": "directory", "id": "model",
                              "sha256": "f" * 64}}))
        assert "Engine model:  model (local directory" in text
        llm = "\n".join(method_preview_lines(
            {}, {"method_class": "raw-llm", "paradigm": "llm"}))
        assert "harness's own LLM call" in llm and "raw-llm" in llm

    def test_the_dry_run_prints_them(self, tmp_path, capsys):
        from mt_eval_harness.publish import publish_to_supabase
        from test_round5_researcher_fixes import _run as plugin_run
        _log, _card, _fp, report = plugin_run(tmp_path, "pp",
                                              method_model="stub-1")
        _quiet(lambda: None)
        publish_to_supabase(str(report), dry_run=True, auto_confirm=True)
        out = capsys.readouterr().out
        assert "Dependency:    A1" in out and "Code:          sha256" in out
        assert "Model given:   stub-1" in out


# ===========================================================================
# 6. A forge export's model/ folder submits as written
# ===========================================================================

class TestDeclarativePacking:
    def _forge_export(self, tmp_path):
        return _model_dir(tmp_path / "export" / "model", extras={
            "DEPLOY.md": "# How to deploy",
            "forge-model.json": "{}",
            "generation_config.json": "{}",
            "tokenizer_config.json": "{}",
            "champollion-plugin/method.json": "{}",
            "manifest.json": "{}",
            "notes.txt": "private notes"})

    def test_selection(self, tmp_path):
        """forge-model.json (scores on the entrant's private test set, local
        paths) is a .json at the root but not a file transformers reads: it
        stays out, as does any other .json/.txt under a non-model name."""
        from mt_eval_harness.model_bundle import declarative_model_files
        packed, left_out = declarative_model_files(self._forge_export(tmp_path))
        assert [a for a, _ in packed] == [
            "config.json", "generation_config.json",
            "model.safetensors", "tokenizer.json", "tokenizer_config.json"]
        assert left_out == ["DEPLOY.md", "champollion-plugin/ (1 file)",
                            "forge-model.json", "manifest.json", "notes.txt"]

    def test_the_packed_bundle_passes_the_node_s_file_check(self, tmp_path):
        import tarfile
        from mt_eval_harness.model_bundle import build_model_bundle
        from mt_eval_harness.model_runner import validate_declarative_bundle
        from test_model_runner import make_declarative_dir
        src = tmp_path / "src"
        manifest = make_declarative_dir(src)
        (src / "DEPLOY.md").write_text("# deploy")
        (src / "champollion-plugin").mkdir()
        (src / "champollion-plugin" / "method.json").write_text("{}")
        built = build_model_bundle(model_dir=src, manifest=manifest,
                                   out_path=tmp_path / "b.tar.gz",
                                   select_declarative=True)
        assert "DEPLOY.md" in built["left_out"]
        out = tmp_path / "x"
        with tarfile.open(built["path"]) as t:
            t.extractall(out, filter="data")
        report = validate_declarative_bundle(out)
        assert not report["blocked"], report["blocks"]

    def test_unselected_packing_is_unchanged(self, tmp_path):
        """Without selection the packer packs what it is given — the node's
        refusal of a non-data file is still exercised by its own tests."""
        from mt_eval_harness.model_bundle import build_model_bundle
        from test_model_runner import make_declarative_dir
        src = tmp_path / "src"
        manifest = make_declarative_dir(src, extra={"sneaky.py": "x"})
        built = build_model_bundle(model_dir=src, manifest=manifest,
                                   out_path=tmp_path / "b.tar.gz")
        assert built["left_out"] == []


# ===========================================================================
# 7. Pair notation
# ===========================================================================

class TestPairNotation:
    @pytest.mark.parametrize("text", ["eng>crk", "eng-crk", "eng→crk",
                                      "eng->crk", " eng > crk "])
    def test_every_form_reads_the_same(self, text):
        from mt_eval_harness.pair_notation import normalize_pair
        assert normalize_pair(text) == "eng>crk"

    def test_subtags_need_the_arrow(self):
        from mt_eval_harness.pair_notation import (
            PairNotationError, normalize_pair,
        )
        assert normalize_pair("eng>crk-Cans") == "eng>crk-Cans"
        with pytest.raises(PairNotationError):
            normalize_pair("eng-crk-Cans")
        with pytest.raises(PairNotationError, match="shell redirect"):
            normalize_pair("eng crk")

    def test_read_sites_tolerate_a_placeholder(self):
        from mt_eval_harness.pair_notation import split_pair
        assert split_pair(">") == ("", "")
        assert split_pair(None) == ("", "")
        assert split_pair("eng-sme") == ("eng", "sme")

    def test_printed_commands_quote_the_pair(self):
        from mt_eval_harness.pair_notation import quoted
        assert quoted("eng>crk") == "'eng>crk'"

    @pytest.mark.parametrize("argv", [
        ["contest", "prepare", "x", "--name", "X", "--pair", "eng-crk",
         "--dev-size", "1"],
        ["contest", "submit-model", "c", "--pair", "eng-crk"],
        ["contest", "submit-method", "c", "--pair", "eng→crk"],
        ["contest", "list", "--language-pair", "eng-crk"],
    ])
    def test_cli_arguments_store_the_arrow_form(self, argv):
        from mt_eval_harness.cli import build_parser
        parser = build_parser()
        # Only the pair is asserted: parse what the parser can, ignoring
        # the other required flags of each subcommand.
        sub = parser._subparsers._group_actions[0].choices["contest"]
        action = next(a for a in sub._subparsers._group_actions[0]
                      .choices[argv[1]]._actions
                      if "--pair" in a.option_strings
                      or "--language-pair" in a.option_strings)
        assert action.type("eng-crk") == "eng>crk"
        with pytest.raises(argparse.ArgumentTypeError):
            action.type("eng crk")


# ===========================================================================
# 1e (node side). The re-execution flags a receipt gap — recorded in the
# node's state and ledger, and put in front of the custodian.
# ===========================================================================

from test_node_airgap import world  # noqa: E402,F401  (fixture)


class TestNodeFlagsTheReceiptGap:
    def _checked(self, world, tmp_path, monkeypatch):
        from mt_eval_harness import airgap_transport as at
        from test_round4_researcher_fixes import TestOfflineApproval
        helper = TestOfflineApproval()
        rid, state_dir = helper._setup(world, tmp_path, monkeypatch)
        assert at.import_bundle(tmp_path / "usb", config_path="airgap") == [rid]
        return rid, helper._node_checks_pass(world, rid)

    def test_the_flag_follows_the_bound(self, world, tmp_path, monkeypatch):
        from mt_eval_harness.qualifier_gate import receipt_gap
        _rid, state = self._checked(world, tmp_path, monkeypatch)
        gate = state["qualifier_gate"]
        assert gate.get("receipt_gap") == receipt_gap(gate["claimed"],
                                                      gate["measured"])

    def test_a_gap_is_recorded_and_shown_to_the_custodian(
            self, world, tmp_path, monkeypatch, capsys):
        from mt_eval_harness import airgap_transport as at
        from mt_eval_harness import sandbox_runner as sr
        from mt_eval_harness.qualifier_gate import receipt_gap as real
        # Any difference is a gap here, so the fixture's claimed-vs-measured
        # pair exercises the flag whatever the toy method scores.
        monkeypatch.setattr(sr, "receipt_gap",
                            lambda c, m: real(c, m, bound=0.0))
        rid, state = self._checked(world, tmp_path, monkeypatch)
        gap = state["qualifier_gate"]["receipt_gap"]
        assert gap["claimed"] != gap["measured"]
        # still a pass: the flag never refuses
        assert state["qualifier_gate"]["eligible"] is True
        assert state["node_verification"]["qualifier"]["receipt_gap"] == gap
        out = capsys.readouterr().out
        assert "For the custodian:" in out and "flag bound" in out
        at.decide_offline(rid, decision="approve", actor="custodian-a",
                          config_path="airgap")
        assert "Approved with a flagged qualifier gap" in \
            capsys.readouterr().out
