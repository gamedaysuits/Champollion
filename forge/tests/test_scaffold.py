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
    # the card's referee is wired as plugin lanes
    assert cfg.selection.plugins == ("toy.metrics:ToyLinter",)
    assert summary["referee_plugins"] == ["toy.metrics:ToyLinter"]

    steps = (proj / "NEXT_STEPS.md").read_text()
    assert "nmt-forge split" in steps and "--register project" in steps
    assert "prereg new" in steps
    assert "do_not_train" in steps
    assert "--plugin toy.metrics:ToyLinter" in steps
    assert "rung 4" in steps            # the asset ladder is in the brief


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