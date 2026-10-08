import json

from nmt_forge.scaffold import init_project
from nmt_forge.training.config import RunConfig
from tests.test_cards import fixture_cards  # noqa: F401  (fixture reuse)


def test_init_scaffolds_project(fixture_cards, tmp_path):  # noqa: F811
    summary = init_project("qaa", tmp_path / "proj", pair="eng-qaa",
                           cards_path=fixture_cards)
    proj = tmp_path / "proj"
    assert (proj / ".forge" / "eval-registry.json").parent.is_dir()
    cfg_raw = json.loads((proj / "config.json").read_text())
    # the starter config PARSES under the strict validator
    cfg = RunConfig.from_dict(cfg_raw)
    assert cfg.language["target"] == "qaa"
    assert cfg.dev == "project-dev"
    # the card names a referee, but its package is NOT installed: it is an
    # optional add-on, so the config leaves it out (a school persona's
    # `init crk` wrote three champollion_lyss lanes and its own preflight
    # refused them) — and says how to add it
    assert cfg.selection.plugins == ()
    assert summary["referee_plugins"] == ["toy.metrics:ToyLinter"]
    assert summary["referee"]["wired"] == []
    assert summary["referee"]["installed"] is False
    assert "pip install 'toy-lyss>=0.1'" in summary["referee"]["note"]

    steps = (proj / "NEXT_STEPS.md").read_text()
    assert "nmt-forge split" in steps and "--register project" in steps
    assert "prereg new" in steps
    assert "do_not_train" in steps
    assert "**Optional:**" in steps and "NOT installed" in steps
    assert "toy.metrics:ToyLinter" in steps
    assert "rung 4" in steps            # the asset ladder is in the brief


def test_init_config_passes_its_own_plugin_gate(fixture_cards, tmp_path):  # noqa: F811
    from nmt_forge.advisor import _plugins_gate

    init_project("qaa", tmp_path / "proj", cards_path=fixture_cards)
    cfg = RunConfig.from_file(tmp_path / "proj" / "config.json")
    assert _plugins_gate(cfg).ok


def test_init_wires_an_installed_referee(tmp_path):
    from tests.test_cards import _write_card

    cards = tmp_path / "cards"
    _write_card(cards, "qaa", {
        "name": "Toylang A", "dir": "ltr",
        "evalMetrics": {"fake": {"module": "tests.fake_plugin",
                                 "class": "FakeLint"}},
        "evalStandard": {"pip": "fake-lyss"},
    })
    summary = init_project("qaa", tmp_path / "proj", cards_path=cards)
    cfg = RunConfig.from_file(tmp_path / "proj" / "config.json")
    assert cfg.selection.plugins == ("tests.fake_plugin:FakeLint",)
    assert summary["referee"]["installed"] is True
    assert "note" not in summary["referee"]
    steps = (tmp_path / "proj" / "NEXT_STEPS.md").read_text()
    assert "--plugin tests.fake_plugin:FakeLint" in steps


def test_init_no_referee_language(fixture_cards, tmp_path):  # noqa: F811
    init_project("qab", tmp_path / "p2", cards_path=fixture_cards)
    cfg = RunConfig.from_dict(json.loads((tmp_path / "p2" / "config.json")
                                         .read_text()))
    assert cfg.selection.plugins == ()
    assert cfg.language["target"] == "qab"


def test_default_pair_is_eng_to_code(fixture_cards, tmp_path):  # noqa: F811
    init_project("qac", tmp_path / "p3", cards_path=fixture_cards)
    cfg_raw = json.loads((tmp_path / "p3" / "config.json").read_text())
    assert cfg_raw["language"]["source"] == "eng"
    assert cfg_raw["language"]["target"] == "qac"

def test_init_without_a_card_is_honest(tmp_path):
    # "an Atya model for the hospital": a language the index doesn't have
    summary = init_project("qzx", tmp_path / "hosp", no_card=True,
                           name="Toylang Without A Card")
    cfg = RunConfig.from_dict(json.loads((tmp_path / "hosp" / "config.json")
                                         .read_text()))
    assert cfg.language["target"] == "qzx"
    assert cfg.model["backend"] == "hf-scratch"        # the CPU default
    assert "no language card" in summary["language"]["card"]
    steps = (tmp_path / "hosp" / "NEXT_STEPS.md").read_text()
    assert "Toylang Without A Card" in steps
    assert "unknown (card is silent)" in steps          # nothing invented


def test_missing_card_points_at_no_card(fixture_cards, tmp_path):  # noqa: F811
    import pytest

    from nmt_forge.errors import ResourceMissing

    with pytest.raises(ResourceMissing, match="--no-card"):
        init_project("qzz", tmp_path / "x", cards_path=fixture_cards)
    assert not (tmp_path / "x").exists()     # refused before touching disk


def test_presets_expand_into_explicit_config(fixture_cards, tmp_path):  # noqa: F811
    import pytest

    from nmt_forge.errors import ConfigError

    init_project("qaa", tmp_path / "n", cards_path=fixture_cards,
                 model_preset="nllb-600m")
    cfg = json.loads((tmp_path / "n" / "config.json").read_text())
    assert cfg["model"]["base"] == "facebook/nllb-200-distilled-600M"
    assert cfg["model"]["src_lang"] == "eng_Latn" and cfg["model"]["lora"]
    # cpu-finetune never guesses a base model
    with pytest.raises(ConfigError, match="--base"):
        init_project("qaa", tmp_path / "f", cards_path=fixture_cards,
                     model_preset="cpu-finetune")
    init_project("qaa", tmp_path / "f2", cards_path=fixture_cards,
                 model_preset="cpu-finetune", base="Helsinki-NLP/opus-mt-en-mul")
    cfg = json.loads((tmp_path / "f2" / "config.json").read_text())
    assert cfg["model"]["backend"] == "hf-seq2seq"
    assert cfg["model"]["base"] == "Helsinki-NLP/opus-mt-en-mul"
    assert cfg["model"]["device"] == "cpu"


def test_init_writes_no_time_budget_and_says_how_to_set_one(tmp_path):
    """Round 5: init wrote a 2-hour budget into config.json unasked, though
    forge's own guidance says never to invent one."""
    from nmt_forge.training.presets import MODEL_PRESETS

    for preset in MODEL_PRESETS:
        kw = {"base": "Helsinki-NLP/opus-mt-en-fi"} if preset == "cpu-finetune" else {}
        summary = init_project("qzx", tmp_path / preset, no_card=True,
                               name="Test", model_preset=preset, **kw)
        cfg = json.loads((tmp_path / preset / "config.json").read_text())
        assert "time_budget_hours" not in cfg["model"], preset
        assert summary["model"]["time_budget_hours"] is None
        assert "never invents one" in summary["model"]["time_budget_note"]
    steps = (tmp_path / "cpu-tiny" / "NEXT_STEPS.md").read_text()
    assert "sets none — forge never invents" in steps
    assert "RUN EXIT <code>" in steps
