"""Model presets — the honest starting points ``nmt-forge init --model``
writes into a config (and ``nmt-forge use-model`` switches a project to).

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

``byt5-small``
    Google's ByT5-small (300M parameters) fine-tuned on your pairs. It reads
    bytes, so there is no vocabulary to fit to a small collection — word
    forms it has never seen are still spelled out letter by letter. ~1.2 GB
    download; Apple silicon or a GPU makes it an hour or two for a few
    thousand pairs. In forge's own trials (an invented language, 2026-10-12)
    it learned far more from the same 1,600 pairs than ``cpu-tiny``, which
    stayed a phrasebook — the model the improve loop offers when rounds stop
    moving ``cpu-tiny``. Still measure it on your dev set.
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
    "byt5-small": {
        "summary": "Google's ByT5-small (300M parameters, reads bytes — no "
                   "vocabulary to fit) fine-tuned on your pairs — ~1.2 GB "
                   "download; Apple silicon or a GPU makes it hours, not days",
        "needs": "~1.2 GB download · Apple silicon or a CUDA GPU recommended · "
                 "`python3 -m pip install 'nmt-forge[hf]'`",
        "expect": "in forge's own trials it learned far more from the same "
                  "pairs than cpu-tiny — still measure it against your model "
                  "in use on your dev set",
        "model": {
            "backend": "hf-seq2seq",
            "base": "google/byt5-small",
            "device": "auto",
            "lr": 3e-4,
            "warmup_ratio": 0.05,
            "epochs": 20,
            "batch_size": 8,
            "grad_accum": 2,
            "max_src": 320,
            "max_tgt": 320,
            "seed": 42,
        },
        "decode": {"max_new_tokens": 320, "headroom_factor": 1.5},
    },
}
# ByT5-small set up for a computer with less memory (8–23 GB): the same model,
# rate and length limits, with Adafactor, gradient checkpointing and half the
# batch twice as often (the same 16 pairs per step). Slower per step; not yet
# measured on an 8 GB computer (the forge critique's stress test 10).
MODEL_PRESETS["byt5-small-lowmem"] = {
    **MODEL_PRESETS["byt5-small"],
    "summary": MODEL_PRESETS["byt5-small"]["summary"] + " — set up for a computer with 8–23 GB of memory "
               "(less memory per step, more time)",
    "model": {**MODEL_PRESETS["byt5-small"]["model"], "batch_size": 4, "grad_accum": 4,
              "optim": "adafactor", "gradient_checkpointing": True},
}

DEFAULT_PRESET = "cpu-tiny"

#: The stronger model the improve loop offers when rounds stop moving the
#: model in use, by the backend in use (forge's G1 trials, 2026-10-12: the
#: tiny scratch model stayed a phrasebook as its data grew; ByT5-small
#: learned far more from the same sentences). A backend with no entry is
#: never offered a change.
STRONGER_PRESET: dict[str, str] = {"hf-scratch": "byt5-small"}


#: ``nmt-forge init --model auto`` (what the rails ask for): the strongest
#: start this computer can train in hours — the founder's "working models by
#: default" (2026-10-12) — or the tiny model, said plainly, when it cannot.
AUTO_PRESET = "auto"


#: memory (GB) for ByT5-small as set, and for its low-memory setting —
#: fp32 weights + AdamW state are ~4.8 GB before activations (critique finding
#: 7). Measured 2026-10-13 on a 24 GB Mac: as set it needs MORE than 12 GB of
#: GPU memory (out of memory at a 12 GB cap, step 1,037 of 8,000; uncapped it
#: grew to 19 GB). A 16 GB Mac's GPU is meant to use about 10.7 GB, so the
#: full setting starts at 24 GB and 8–23 GB gets the low-memory one.
FULL_GB, LOWMEM_GB = 24, 8


def _mem_gb() -> float | None:
    """This computer's memory in GB (macOS, Linux), or None."""
    import subprocess
    import sys

    try:
        if sys.platform == "darwin":
            out = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=5)
            return int(out.stdout.strip()) / 2 ** 30
        with open("/proc/meminfo", encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("MemTotal:"):
                    return int(line.split()[1]) / 2 ** 20
    except (OSError, ValueError, subprocess.SubprocessError):
        return None
    return None


def _nvidia_gb() -> float | None:
    """The largest NVIDIA card's memory in GB, or None."""
    import subprocess

    try:
        out = subprocess.run(["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
                             capture_output=True, text=True, timeout=10)
        vals = [float(x) for x in out.stdout.split() if x.strip()]
        return max(vals) / 1024 if vals else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def stronger_preset(backend: str | None) -> str | None:
    """The stronger model the improve loop offers after a backend, set up for
    this computer's memory (the low-memory ByT5 on an 8–23 GB computer)."""
    p = STRONGER_PRESET.get(backend)
    if p == "byt5-small":
        # only what this computer can train: no offer where --model auto would
        # pick the tiny model (no GPU, or under 8 GB) — docs review 2026-10-12
        chosen, _ = auto_preset()
        return chosen if chosen in ("byt5-small", "byt5-small-lowmem") else None
    return p


def auto_preset() -> tuple[str, str]:
    """``(preset, why)`` for ``--model auto``. ByT5-small where there is a GPU
    forge can train on (Apple silicon, or an NVIDIA card); otherwise cpu-tiny.
    ``NMT_FORGE_AUTO_PRESET`` overrides it (test walks pin the fast model)."""
    import os
    import platform
    import shutil

    pinned = os.environ.get("NMT_FORGE_AUTO_PRESET")
    if pinned:
        if pinned not in MODEL_PRESETS:
            raise ConfigError(f"NMT_FORGE_AUTO_PRESET={pinned!r} is not a preset "
                              f"({', '.join(MODEL_PRESETS)})")
        return pinned, f"NMT_FORGE_AUTO_PRESET chose {pinned}"
    gpu = None
    if platform.system() == "Darwin" and platform.machine() == "arm64":
        gpu = ("this Mac has Apple silicon", _mem_gb())        # memory shared with the GPU
    elif shutil.which("nvidia-smi"):
        gpu = ("this computer has an NVIDIA GPU", _nvidia_gb())
    if gpu:
        what, gb = gpu
        said = f" with {gb:.0f} GB of memory" if gb else ""
        if gb is None or gb >= FULL_GB:
            return "byt5-small", (f"{what}{said}, whose GPU trains ByT5-small in hours — "
                                  "the model forge's own trials took all the way to working")
        if gb >= LOWMEM_GB:
            return "byt5-small-lowmem", (f"{what}{said}: ByT5-small set up for less memory (a smaller "
                                         "batch, more often; slower) — the model forge's own trials took "
                                         "all the way to working")
        return "cpu-tiny", (f"{what}{said} — too little for ByT5-small to train, so the tiny model: it "
                            "shows the whole loop, but in forge's own trials it stayed far from working")
    return "cpu-tiny", ("no GPU forge can train on was found, so the tiny model: it runs on any "
                        "computer and shows the whole loop, but in forge's own trials it stayed far "
                        "from working. On a computer with Apple silicon or an NVIDIA GPU, switch with "
                        "`nmt-forge use-model byt5-small`")


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
