"""`nmt-forge init --model auto` (what the rails ask for, founder 2026-10-12:
"working models by default"): ByT5-small where there is a GPU forge can train
on, else the tiny model — and it says which, and why."""

import pytest

from nmt_forge.errors import ConfigError
from nmt_forge.training import presets


def test_apple_silicon_or_an_nvidia_gpu_starts_with_byt5(monkeypatch):
    import platform
    import shutil

    monkeypatch.delenv("NMT_FORGE_AUTO_PRESET", raising=False)
    monkeypatch.setattr(platform, "system", lambda: "Darwin")
    monkeypatch.setattr(platform, "machine", lambda: "arm64")
    preset, why = presets.auto_preset()
    assert preset == "byt5-small" and "Apple silicon" in why
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(platform, "machine", lambda: "x86_64")
    monkeypatch.setattr(shutil, "which", lambda name: "/usr/bin/nvidia-smi" if name == "nvidia-smi" else None)
    preset, why = presets.auto_preset()
    assert preset == "byt5-small" and "NVIDIA" in why


def test_the_choice_fits_the_computers_memory(monkeypatch):
    """FORGE_MACHINE_CRITIQUE finding 7: full-precision ByT5 with AdamW is ~4.8
    GB before activations — an 8 GB Mac gets the low-memory setting, a smaller
    one the tiny model, each said with its memory; the stronger-model offer
    follows the same rule."""
    import platform

    monkeypatch.delenv("NMT_FORGE_AUTO_PRESET", raising=False)
    monkeypatch.setattr(platform, "system", lambda: "Darwin")
    monkeypatch.setattr(platform, "machine", lambda: "arm64")
    # 16 GB gets the low-memory setting since 2026-10-13: ByT5-small as set
    # needs more than 12 GB of GPU memory; a 16 GB Mac's GPU is meant to use ~10.7
    for gb, want in ((32, "byt5-small"), (24, "byt5-small"), (16, "byt5-small-lowmem"), (8, "byt5-small-lowmem"),
                     (4, "cpu-tiny")):
        monkeypatch.setattr(presets, "_mem_gb", lambda gb=gb: float(gb))
        preset, why = presets.auto_preset()
        assert preset == want and f"{gb} GB" in why, (gb, preset, why)
        assert presets.stronger_preset("hf-scratch") == (want if want != "cpu-tiny" else None), "never an offer it cannot train"
    low = presets.MODEL_PRESETS["byt5-small-lowmem"]["model"]
    assert low["optim"] == "adafactor" and low["gradient_checkpointing"] is True
    assert low["batch_size"] * low["grad_accum"] == 16, "the same pairs per step as byt5-small"


def test_no_gpu_means_the_tiny_model_said_plainly(monkeypatch):
    import platform
    import shutil

    monkeypatch.delenv("NMT_FORGE_AUTO_PRESET", raising=False)
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(platform, "machine", lambda: "x86_64")
    monkeypatch.setattr(shutil, "which", lambda name: None)
    preset, why = presets.auto_preset()
    assert preset == "cpu-tiny"
    assert "far from working" in why and "nmt-forge use-model byt5-small" in why


def test_the_override_pins_a_preset_and_refuses_a_name_that_is_not_one(monkeypatch):
    monkeypatch.setenv("NMT_FORGE_AUTO_PRESET", "cpu-tiny")
    assert presets.auto_preset()[0] == "cpu-tiny"
    monkeypatch.setenv("NMT_FORGE_AUTO_PRESET", "huge")
    with pytest.raises(ConfigError):
        presets.auto_preset()


def test_init_auto_writes_the_chosen_preset_in_full(monkeypatch, tmp_path):
    import argparse
    import json

    from nmt_forge.cli import cmd_init

    monkeypatch.setenv("NMT_FORGE_AUTO_PRESET", "byt5-small")
    out = cmd_init(argparse.Namespace(code="qaa", dir=str(tmp_path / "p"), pair="eng-qaa", cards_dir=None,
                                      model="auto", base=None, no_card=True, name="Our language"))
    cfg = json.loads((tmp_path / "p" / "config.json").read_text())
    assert cfg["model"]["base"] == "google/byt5-small" and cfg["model"]["epochs"] == 20
    assert out.payload["model_preset"] == "byt5-small"
    assert out.payload["model_choice"] == "NMT_FORGE_AUTO_PRESET chose byt5-small"
    assert "chosen: NMT_FORGE_AUTO_PRESET chose byt5-small" in out.text
