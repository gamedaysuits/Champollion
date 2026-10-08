"""Model presets — the three honest starting points ``nmt-forge init --model``
writes into a config.

A preset is NOT hidden behaviour: ``init`` expands it into an explicit
``model`` + ``decode`` block in config.json (every number visible, every
number hashed into the run identity). Changing a preset in a later forge
release never changes an existing project's runs.

The presets, and what to honestly expect from each:

``cpu-tiny`` (default)
    A ~6M-parameter Marian transformer trained FROM SCRATCH on your pairs,
    with a BPE vocabulary learned from your TRAINING rows only. No download,
    no GPU: on a laptop CPU, 1–2k pairs train in minutes (1,600 pairs, 60
    epochs: about 2–3 minutes on an Apple-silicon laptop; measured 93 s for
    40 epochs, 2026-10). It will be WEAK — on ~1–2k pairs expect chrF++
    roughly in the 5–30 range, the top end only for highly templated data:
    memorized phrases and the template patterns of your data, not general
    translation. Its job is to make the WHOLE loop real (fenced dev, leak-audited
    data, CIs, preregistered test, an exportable model the CLI can call) so
    that a better model later drops into the same project and is measured
    the same way.

``cpu-finetune``
    Fine-tunes a small pretrained Marian/opus-mt checkpoint (~300 MB
    download, ~75M parameters) on CPU — tens of minutes to a couple of hours
    for 1–2k pairs. Usually stronger than ``cpu-tiny`` when an opus-mt model
    exists for a RELATED language pair (the English encoder is already good;
    the decoder starts from a related language). Which base helps is an
    empirical question: you must name it (``--base``), and you should
    measure it against ``cpu-tiny`` on your dev set rather than assume.

``nllb-600m``
    NLLB-200 distilled 600M with LoRA — the strongest of the three, and the
    one that needs a GPU (~2.5 GB download; on a CPU it would take days, and
    forge's wall-clock gate will say so in the first minutes rather than let
    it run).
"""

from __future__ import annotations

import copy

from ..errors import ConfigError

#: No preset carries ``time_budget_hours``: a budget is the USER's number,
#: never one forge writes for them (Round 5 hospital persona — init used to
#: write 2h/4h/24h into config.json unasked). Without one, the wall-clock
#: gate applies forge's labelled safety ceiling
#: (``schedule.DEFAULT_TIME_CEILING_HOURS``) and prints the measured
#: projection minutes in, so the user can set a real budget from it.
MODEL_PRESETS: dict[str, dict] = {
    "cpu-tiny": {
        "summary": "tiny transformer trained from scratch on your pairs — "
                   "CPU, no download, minutes; weak by design, honest loop",
        "needs": "CPU only · no download · `python3 -m pip install 'nmt-forge[hf]'`",
        "expect": "on ~1–2k pairs: chrF++ roughly 5–30 (the top end only "
                  "for highly templated data) — memorized phrases and your "
                  "data's templates, not general translation",
        "model": {
            "backend": "hf-scratch",
            "device": "cpu",
            "vocab_size": 4000,
            "d_model": 256,
            "layers": 3,
            "heads": 4,
            "ffn_dim": 1024,
            "dropout": 0.1,
            "max_len": 512,
            "lr": 5e-4,
            "warmup_ratio": 0.05,
            "epochs": 60,
            "batch_size": 16,
            "grad_accum": 1,
            "seed": 42,
        },
        "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
    },
    "cpu-finetune": {
        "summary": "fine-tune a small pretrained Marian/opus-mt model on "
                   "CPU — ~300 MB download; usually stronger than cpu-tiny "
                   "when a RELATED pair exists (you name the base)",
        "needs": "CPU only · ~300 MB download · `python3 -m pip install 'nmt-forge[hf]'`",
        "expect": "depends on how related the base's target language is — "
                  "measure it against cpu-tiny on your dev set",
        "requires_base": True,
        "model": {
            "backend": "hf-seq2seq",
            "base": None,               # filled from --base; never guessed
            "device": "cpu",
            "lr": 5e-5,
            "warmup_ratio": 0.05,
            "epochs": 10,
            "batch_size": 8,
            "grad_accum": 2,
            "max_src": 128,
            "max_tgt": 128,
            "seed": 42,
        },
        "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
    },
    "nllb-600m": {
        "summary": "NLLB-200 distilled 600M with LoRA — strongest start, "
                   "needs a GPU (~2.5 GB download)",
        "needs": "a CUDA GPU (8 GB+) · ~2.5 GB download · "
                 "`python3 -m pip install 'nmt-forge[hf]'`",
        "expect": "the strongest of the three when NLLB covers a related "
                  "language; still measure it — never assume",
        "model": {
            "backend": "hf-seq2seq",
            "base": "facebook/nllb-200-distilled-600M",
            "device": "auto",
            "lora": {"r": 16, "alpha": 32, "dropout": 0.05,
                     "target_modules": ["q_proj", "v_proj", "k_proj",
                                        "out_proj", "fc1", "fc2"]},
            "lr": 2e-4,
            "epochs": 3,
            "batch_size": 4,
            "grad_accum": 4,
            "seed": 42,
        },
        "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
    },
}

DEFAULT_PRESET = "cpu-tiny"


def expand_preset(name: str, *, base: str | None = None,
                  nllb_src: str | None = None,
                  nllb_tgt: str | None = None) -> tuple[dict, dict]:
    """``(model_block, decode_block)`` for a preset — explicit and complete."""
    if name not in MODEL_PRESETS:
        raise ConfigError(
            f"unknown model preset {name!r}; pick one of "
            f"{', '.join(MODEL_PRESETS)} (see `nmt-forge init --help`)")
    preset = MODEL_PRESETS[name]
    model = copy.deepcopy(preset["model"])
    decode = copy.deepcopy(preset["decode"])
    if preset.get("requires_base"):
        if not base:
            raise ConfigError(
                f"the {name} preset fine-tunes a pretrained model you choose: "
                "pass --base <huggingface id or local dir>, e.g. an "
                "opus-mt model for a RELATED pair "
                "(https://huggingface.co/Helsinki-NLP)",
            )
        model["base"] = base
    elif base:
        model["base"] = base
    if name == "nllb-600m":
        if nllb_src:
            model["src_lang"] = nllb_src
        if nllb_tgt:
            model["tgt_lang"] = nllb_tgt
    return model, decode
