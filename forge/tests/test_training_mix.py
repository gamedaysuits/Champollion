import pytest

from nmt_forge.errors import ConfigError, LeakageError
from nmt_forge.guards.convention_lint import ConventionSpec
from nmt_forge.training.config import RunConfig
from nmt_forge.training.mix import build_mix
from tests.conftest import write_jsonl


def _gold(tmp_path, rows=None):
    rows = rows or [
        {"source": "the wug runs fast", "target": "wugto blar"},
        {"source": "the wug runs fast", "target": "wugto blâr"},  # aug variant
        {"source": "a dax sleeps here", "target": "daxko pel"},
    ]
    return write_jsonl(tmp_path / "gold.jsonl", rows)


def _synth(tmp_path, n=40, kind="cond"):
    rows = [{"source": f"synthetic {kind} {i}", "target": f"syn{kind}{i}",
             "kind": kind, "synthetic": True} for i in range(n)]
    return write_jsonl(tmp_path / f"synth-{kind}.jsonl", rows)


def _cfg(tmp_path, **mix):
    synth_a = _synth(tmp_path, 30, "cond")
    return RunConfig.from_dict({
        "run_name": "t",
        "data": {"gold": [str(_gold(tmp_path))], "dev": "toy-dev",
                 "synthetic": [{"path": str(synth_a), "tag": "<synth>"}]},
        "mix": mix or {"kind_cap": None},
    })


def test_exposure_math_is_written_down(ws, tmp_path):
    cfg = _cfg(tmp_path, gold_upweight=20, kind_cap=None)
    result = build_mix(cfg, ws)
    g = result.manifest["gold"]
    # 3 rows / 2 unique sources = 1.5 augmentation multiplier;
    # ×20 upweight → 30 exposures per unique sentence — VISIBLE, not implied
    assert g["rows"] == 3 and g["unique_sources"] == 2
    assert g["detected_augment_multiplier"] == 1.5
    assert g["effective_exposure_per_unique_sentence"] == 30.0


def test_synthetic_tagged_gold_untagged(ws, tmp_path):
    cfg = _cfg(tmp_path, kind_cap=None, gold_upweight=1)
    result = build_mix(cfg, ws)
    tagged = [r for r in result.rows if r["source"].startswith("<synth> ")]
    untagged = [r for r in result.rows if not r["source"].startswith("<synth> ")]
    assert len(tagged) == 30 and len(untagged) == 3
    # idempotent: already-tagged rows are not double-tagged
    again = build_mix(cfg, ws)
    assert not any(r["source"].startswith("<synth> <synth>") for r in again.rows)


def test_tag_collision_with_gold_refused(ws, tmp_path):
    gold = _gold(tmp_path, [{"source": "text mentioning <synth> literally",
                             "target": "x y"}])
    synth = _synth(tmp_path, 5)
    cfg = RunConfig.from_dict({
        "run_name": "t",
        "data": {"gold": [str(gold)], "dev": "toy-dev",
                 "synthetic": [{"path": str(synth), "tag": "<synth>"}]},
        "mix": {"kind_cap": None},
    })
    with pytest.raises(ConfigError, match="lane marker"):
        build_mix(cfg, ws)


def test_uncapped_skewed_lane_refused(ws, tmp_path):
    # multi-kind lane, one kind dominates, no sample size → refuse with fix
    rows = ([{"source": f"c{i}", "target": f"tc{i}", "kind": "cond",
              "synthetic": True} for i in range(30)]
            + [{"source": f"o{i}", "target": f"to{i}", "kind": "other",
                "synthetic": True} for i in range(5)])
    skewed = write_jsonl(tmp_path / "skewed.jsonl", rows)
    cfg = RunConfig.from_dict({
        "run_name": "t",
        "data": {"gold": [str(_gold(tmp_path))], "dev": "toy-dev",
                 "synthetic": [{"path": str(skewed), "tag": "<synth>"}]},
        "mix": {"kind_cap": 0.15},
    })
    with pytest.raises(ConfigError, match="mistake #7"):
        build_mix(cfg, ws)


def test_single_kind_lane_exempt_from_cap(ws, tmp_path):
    # a backtranslation lane is legitimately ONE kind — the cap balances
    # between kinds and must not refuse it
    rows = [{"source": f"bt {i}", "target": f"tb{i}", "kind": "backtranslation",
             "synthetic": True} for i in range(30)]
    bt = write_jsonl(tmp_path / "bt.jsonl", rows)
    cfg = RunConfig.from_dict({
        "run_name": "t",
        "data": {"gold": [str(_gold(tmp_path))], "dev": "toy-dev",
                 "synthetic": [{"path": str(bt), "tag": "<bt>"}]},
        "mix": {"kind_cap": 0.15},
    })
    result = build_mix(cfg, ws)
    assert result.manifest["synthetic"][0]["rows"] == 30


def test_strata_sampling_applies_with_sample_size(ws, tmp_path):
    gold = _gold(tmp_path)
    a = _synth(tmp_path, 60, "cond")
    rows_b = [{"source": f"other {i}", "target": f"oth{i}", "kind": f"k{i % 6}",
               "synthetic": True} for i in range(60)]
    b = write_jsonl(tmp_path / "synth-mixed.jsonl", rows_b)
    cfg = RunConfig.from_dict({
        "run_name": "t",
        "data": {"gold": [str(gold)], "dev": "toy-dev", "synthetic": [
            {"path": str(a), "tag": "<synth>"},
            {"path": str(b), "tag": "<bt>"},
        ]},
        "mix": {"kind_cap": 0.5, "synthetic_sample": 20, "gold_upweight": 1},
    })
    result = build_mix(cfg, ws)
    for lane in result.manifest["synthetic"]:
        assert lane["strata"] is not None
        assert lane["rows"] <= 20


def test_leaking_gold_refused(ws, test_set, tmp_path):
    leaky = _gold(tmp_path, [
        {"source": test_set[0]["source"], "target": "anything zam"}])
    cfg = RunConfig.from_dict({
        "run_name": "t",
        "data": {"gold": [str(leaky)], "dev": "toy-dev"},
    })
    with pytest.raises(LeakageError):
        build_mix(cfg, ws)


def test_do_not_train_dataset_id_refused(ws, tmp_path):
    # a real id from the mt-eval registry (all registry sets are do_not_train)
    from nmt_forge import _harness

    _harness.load_harness()
    from mt_eval_harness.config import load_registry

    real_id = load_registry()["datasets"][0]["id"]
    synth = _synth(tmp_path, 5)
    cfg = RunConfig.from_dict({
        "run_name": "t",
        "data": {"gold": [], "dev": "toy-dev", "synthetic": [
            {"path": str(synth), "tag": "<synth>", "dataset_id": real_id}]},
        "mix": {"kind_cap": None},
    })
    with pytest.raises(ConfigError, match="never enter training"):
        build_mix(cfg, ws)


def test_unknown_dataset_id_recorded_not_refused(ws, tmp_path):
    synth = _synth(tmp_path, 5)
    cfg = RunConfig.from_dict({
        "run_name": "t",
        "data": {"gold": [], "dev": "toy-dev", "synthetic": [
            {"path": str(synth), "tag": "<synth>",
             "dataset_id": "no-such-dataset-xyz"}]},
        "mix": {"kind_cap": None},
    })
    result = build_mix(cfg, ws)
    assert result.manifest["dataset_id_flags"]["verdicts"] == {
        "no-such-dataset-xyz": "unknown-id"}


def test_mixed_convention_targets_refused_when_pack_declares(ws, tmp_path):
    gold = _gold(tmp_path, [
        {"source": "a", "target": "nikî-nipân"},
        {"source": "b", "target": "nikī-nipān"},   # macron row
    ])
    cfg = RunConfig.from_dict({
        "run_name": "t", "data": {"gold": [str(gold)], "dev": "toy-dev"},
    })
    specs = [ConventionSpec("circ", chars="âêîôû"),
             ConventionSpec("macr", chars="āēīōū")]
    from nmt_forge.errors import ConventionError

    with pytest.raises(ConventionError):
        build_mix(cfg, ws, conventions=specs)


# -- target-validity gate (2026-07-14: forge stops trusting the emit law) -----

def _validator(target: str) -> bool:
    """Test double for an FST validator: rejects targets containing 'BROKEN'."""
    return "BROKEN" not in target


def test_synthetic_lane_below_validity_floor_is_refused(ws, tmp_path):
    rows = ([{"source": f"s {i}", "target": f"ok {i}", "kind": "k",
              "synthetic": True} for i in range(8)]
            + [{"id": "bad-1", "source": "s x", "target": "BROKEN tok",
                "kind": "k", "synthetic": True}])
    synth = write_jsonl(tmp_path / "synth-v.jsonl", rows)
    cfg = RunConfig.from_dict({
        "run_name": "t",
        "data": {"gold": [], "dev": "toy-dev",
                 "synthetic": [{"path": str(synth), "tag": "<synth>"}]},
        "mix": {"kind_cap": None, "validity_floor": 0.95},
    })
    with pytest.raises(ConfigError, match="target-validity"):
        build_mix(cfg, ws, validator=_validator)


def test_valid_synthetic_lane_passes_with_validity_recorded(ws, tmp_path):
    cfg = _cfg(tmp_path, kind_cap=None)
    result = build_mix(cfg, ws, validator=_validator)
    lane = result.manifest["synthetic"][0]
    assert lane["target_validity"]["valid_rate"] == 1.0
    assert result.manifest["validity_gate"]["floor"] == 0.98


def test_gold_validity_is_measured_never_gated(ws, tmp_path):
    # every gold target fails the validator — recorded, NOT refused
    gold = _gold(tmp_path, [
        {"source": "a", "target": "BROKEN one"},
        {"source": "b", "target": "BROKEN two"},
    ])
    cfg = RunConfig.from_dict({
        "run_name": "t", "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "mix": {"kind_cap": None},
    })
    result = build_mix(cfg, ws, validator=_validator)
    v = result.manifest["gold"]["target_validity"]
    assert list(v.values())[0]["valid_rate"] == 0.0   # measured
    assert result.rows                                 # and still trained on


def test_no_validator_means_no_gate_no_manifest_noise(ws, tmp_path):
    cfg = _cfg(tmp_path, kind_cap=None)
    result = build_mix(cfg, ws)
    assert result.manifest["validity_gate"] is None
    assert result.manifest["synthetic"][0]["target_validity"] is None


def test_validator_resolved_from_config_spec(ws, tmp_path):
    cfg = _cfg(tmp_path, kind_cap=None,
               validator="tests.test_training_mix:_validator")
    result = build_mix(cfg, ws)
    assert result.manifest["validity_gate"]["validator"] == \
        "tests.test_training_mix:_validator"
    assert result.manifest["synthetic"][0]["target_validity"]["valid_rate"] == 1.0
