import pytest

from nmt_forge.errors import ConfigError
from nmt_forge.training.config import RunConfig, SynthLane

BASE = {
    "run_name": "demo",
    "data": {"gold": ["g.jsonl"], "dev": "toy-dev",
             "synthetic": [{"path": "s.jsonl", "tag": "<synth>"}]},
}


def test_minimal_config_parses_with_defaults():
    cfg = RunConfig.from_dict(BASE)
    assert cfg.mix.gold_upweight == 20 and cfg.mix.kind_cap == 0.15
    assert cfg.selection.metric == "generation:chrf++"
    assert cfg.decode.max_new_tokens == 256
    assert cfg.synthetic[0].tag == "<synth>"


def test_hash_is_stable_and_sensitive():
    a = RunConfig.from_dict(BASE).hash()
    assert a == RunConfig.from_dict(dict(BASE)).hash()
    changed = {**BASE, "mix": {"gold_upweight": 21}}
    assert a != RunConfig.from_dict(changed).hash()


def test_unknown_keys_refused_not_guessed():
    with pytest.raises(ConfigError, match="gold_upwieght"):
        RunConfig.from_dict({**BASE, "mix": {"gold_upwieght": 20}})
    with pytest.raises(ConfigError, match="unknown key"):
        RunConfig.from_dict({**BASE, "surprise": 1})


def test_missing_dev_refused_with_the_story():
    raw = {"run_name": "demo", "data": {"gold": ["g.jsonl"]}}
    with pytest.raises(ConfigError, match="mistake #2"):
        RunConfig.from_dict(raw)


def test_bad_tag_refused():
    with pytest.raises(ConfigError, match="tag"):
        SynthLane(path="x.jsonl", tag="synth")   # no angle brackets
    with pytest.raises(ConfigError, match="tag"):
        SynthLane(path="x.jsonl", tag="<UPPER>")


def test_bad_selection_metric_refused():
    raw = {**BASE, "selection": {"metric": "vibes"}}
    with pytest.raises(ConfigError, match="OPEN QUESTION"):
        RunConfig.from_dict(raw)
