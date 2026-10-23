"""The improve loop in forge's advisor (journey plan, Phase 2): with a model
in use and a newer run beside it on the same dev set, status asks for the
round's verdict on dev — never an export (a test read) — then promotes a
measurably better model or keeps the one in use."""

import json
from pathlib import Path

import pytest

from nmt_forge.advisor import next_action
from nmt_forge.improve.compare import IMPROVE_COMPARE, compare_runs
from nmt_forge.training.run import run
from tests.test_training_run import _setup


@pytest.fixture(autouse=True)
def _a_computer_that_can_train_byt5(monkeypatch):
    """The stronger-model offer is made only where this computer can train it
    (presets.stronger_preset): these tests pin one that can."""
    monkeypatch.setenv("NMT_FORGE_AUTO_PRESET", "byt5-small")


def _model_in_use(ws, tmp_path, manifest):
    out = tmp_path / "export"
    (out / "model").mkdir(parents=True)
    ws.ledger.append("export", run="e2e-round1", run_manifest=manifest, dir=str(out),
                     model_dir=str((out / "model").resolve()), evaluated=True, model_included=True)
    ws.ledger.append("choose", model_dir=str((out / "model").resolve()))
    return out


def _round_two(ws, tmp_path):
    cfg = _setup(ws, tmp_path)
    first = run(cfg)
    _model_in_use(ws, tmp_path, first["manifest_path"])
    gold = tmp_path / "gold.jsonl"
    gold.write_text(gold.read_text() + json.dumps({"source": "the florp 55 sings", "target": "florpa55 zam"}) + "\n")
    second = run(cfg)
    return first, second


def test_a_new_round_is_judged_on_dev_not_exported(ws, dev_set, tmp_path):
    first, second = _round_two(ws, tmp_path)
    a = next_action(ws)
    assert a.state == "improve-compare", a.why
    assert a.command == f"nmt-forge compare-runs {first['manifest_path']} {second['manifest_path']}"
    assert "round 1" in a.why and "test set is not read" in a.why
    assert "export" not in a.command


def test_too_few_dev_sentences_keeps_the_model_in_use_and_says_so(ws, dev_set, tmp_path):
    # the toy dev set has 8 sentences: below 50 no verdict rule decides
    # (stress test 6), so the model in use stays and the speaker's marks decide
    first, second = _round_two(ws, tmp_path)
    v = compare_runs(ws, first["manifest_path"], second["manifest_path"], n_trials=200, n_bootstrap=200)
    assert v["verdict"] == "too-few"
    a = next_action(ws)
    assert a.state in ("serving", "exported"), a.state      # the model in use, not the new run
    assert "too few dev sentences to tell" in a.why and "the speaker's marks decide" in a.why
    assert "stays in use" in a.why
    assert second["manifest_path"] not in (a.command or "")


def test_a_measurably_better_round_is_put_to_use_without_a_test_read(ws, dev_set, tmp_path):
    first, second = _round_two(ws, tmp_path)
    ws.ledger.append(IMPROVE_COMPARE, round=1, in_use="e2e", in_use_manifest=first["manifest_path"],
                     new="e2e", new_manifest=second["manifest_path"], dev_set="toy-dev", n=8,
                     score_in_use=10.0, score_new=20.0, delta=10.0, ci=[4.0, 16.0], p_value=0.001,
                     verdict="better")
    a = next_action(ws)
    assert a.state == "improve-promote", a.why
    assert a.command.startswith(f"nmt-forge export {second['manifest_path']} --no-eval --out ")
    assert "nmt-forge choose " in a.command and "nmt-forge serve " in a.command
    assert "measurably better" in a.why and "ask them first" in a.why
    assert Path(first["manifest_path"]).is_file()           # round 1 is kept


def _flat(ws, first, second, rounds):
    for k in range(rounds):
        ws.ledger.append(IMPROVE_COMPARE, round=k + 1, in_use="e2e", in_use_manifest=first["manifest_path"],
                         new="e2e", new_manifest=second["manifest_path"], dev_set="toy-dev", n=8,
                         score_in_use=10.0, score_new=10.4, delta=0.4, ci=[-1.2, 2.0], p_value=0.6,
                         verdict="no-change")


def test_two_flat_rounds_offer_a_stronger_model_asked_of_the_people(ws, dev_set, tmp_path, monkeypatch):
    from nmt_forge.training import presets

    monkeypatch.setitem(presets.STRONGER_PRESET, "dummy", "byt5-small")
    first, second = _round_two(ws, tmp_path)
    _flat(ws, first, second, 1)
    assert next_action(ws).state in ("serving", "exported")         # one flat round: the rounds go on
    _flat(ws, first, second, 1)
    a = next_action(ws)
    assert a.state == "improve-stronger-model", a.why
    assert a.command == "nmt-forge use-model byt5-small --config config.json --answer {try_it}"
    assert a.answers == {"try_it": {"enum": ["yes", "not-now"]}}
    assert "no change the dev sentences can see" in a.why and "Ask them first" in a.why and "1.2 GB" in a.why
    # it cannot tell a slow gain from none, and says so (stress test 11, 2026-10-13)
    assert "the rounds may be adding less than that, or nothing" in a.why
    assert "not moving this model" not in a.why


def test_a_dev_set_too_small_to_see_a_gain_never_says_more_sentences_do_not_help(ws, dev_set, tmp_path,
                                                                                monkeypatch):
    """FORGE_MACHINE_CRITIQUE finding 2: at 8 dev sentences only a ~10-point
    difference shows; two flat rounds there say nothing about more sentences."""
    from nmt_forge.training import presets

    monkeypatch.setitem(presets.STRONGER_PRESET, "dummy", "byt5-small")
    first, second = _round_two(ws, tmp_path)
    _flat(ws, first, second, 1)
    ws.ledger.append(IMPROVE_COMPARE, round=2, in_use="e2e", in_use_manifest=first["manifest_path"],
                     new="e2e", new_manifest=second["manifest_path"], dev_set="toy-dev", n=8,
                     score_in_use=10.0, score_new=10.4, delta=0.4, ci=[-6.6, 7.4], p_value=0.6,
                     verdict="no-change", detectable=10.0)
    a = next_action(ws)
    assert a.state == "improve-stronger-model", a.why
    assert "only a difference of about 10.0 chrF++ points shows, so small gains may be hiding" in a.why
    assert "not moving this model" not in a.why


def test_rounds_too_small_to_tell_are_not_flat_rounds(ws, dev_set, tmp_path, monkeypatch):
    """Docs review 2026-10-13: "too-few" says nothing about whether more
    sentences help, so it never counts toward the stronger-model offer."""
    from nmt_forge.training import presets

    monkeypatch.setitem(presets.STRONGER_PRESET, "dummy", "byt5-small")
    first, second = _round_two(ws, tmp_path)
    for k in (1, 2):
        ws.ledger.append(IMPROVE_COMPARE, round=k, in_use="e2e", in_use_manifest=first["manifest_path"],
                         new="e2e", new_manifest=second["manifest_path"], dev_set="toy-dev", n=8,
                         score_in_use=10.0, score_new=10.4, delta=0.4, ci=[-6.6, 7.4], p_value=0.6,
                         verdict="too-few", detectable=10.0)
    assert next_action(ws).state in ("serving", "exported")
    _flat(ws, first, second, 1)                                      # one too-few, one flat: still not two flat
    assert next_action(ws).state in ("serving", "exported")


def test_flat_rounds_count_again_from_a_model_the_people_put_to_use(ws, dev_set, tmp_path, monkeypatch):
    """Docs review 2026-10-13: a promotion (on the speaker's blind marks here)
    changes the model in use; the rounds before it say nothing about the new one."""
    from nmt_forge.training import presets

    monkeypatch.setitem(presets.STRONGER_PRESET, "dummy", "byt5-small")
    first, second = _round_two(ws, tmp_path)
    _flat(ws, first, second, 1)
    ws.ledger.append("choose", model_dir=str((tmp_path / "export-round2" / "model").resolve()))
    _flat(ws, first, second, 1)
    assert next_action(ws).state != "improve-stronger-model"
    _flat(ws, first, second, 1)
    assert next_action(ws).state == "improve-stronger-model"


def test_yes_switches_config_json_and_the_next_step_trains_it(ws, dev_set, tmp_path, monkeypatch):
    import argparse

    from nmt_forge.cli import cmd_use_model
    from nmt_forge.training import presets

    monkeypatch.setitem(presets.STRONGER_PRESET, "dummy", "byt5-small")
    first, second = _round_two(ws, tmp_path)
    _flat(ws, first, second, 2)
    cfg = tmp_path / "config.json"
    raw = json.loads(cfg.read_text())
    raw["decode"]["hook"] = "my_fst:gate"                             # the people's decode hook is kept
    raw["run_name"] = "qaa-nmt-cpu-tiny"                              # as the rails name it
    cfg.write_text(json.dumps(raw))
    out = cmd_use_model(argparse.Namespace(config=str(cfg), preset="byt5-small", answer="yes", base=None,
                                           workspace=str(ws.root)))
    assert out.payload["model"] == {"backend": "hf-seq2seq", "base": "google/byt5-small"}
    now = json.loads(cfg.read_text())
    assert now["model"]["base"] == "google/byt5-small" and now["model"]["epochs"] == 20
    assert now["decode"] == {"max_new_tokens": 320, "headroom_factor": 1.5, "hook": "my_fst:gate"}
    assert now["run_name"] == "qaa-nmt-byt5-small", "its runs, exports and server are named for the model"
    a = next_action(ws)
    assert a.state == "ready-to-train", a.why
    assert a.command == "nmt-forge preflight run --config config.json && nmt-forge run config.json --detach"
    assert "now trains byt5-small" in a.why and "measurably better" in a.why
    assert [e["answer"] for e in ws.ledger.find("model-change")] == ["yes"]


def test_not_now_keeps_the_model_and_the_offer_waits_for_more_flat_rounds(ws, dev_set, tmp_path, monkeypatch):
    import argparse

    from nmt_forge.cli import cmd_use_model
    from nmt_forge.training import presets

    monkeypatch.setitem(presets.STRONGER_PRESET, "dummy", "byt5-small")
    first, second = _round_two(ws, tmp_path)
    _flat(ws, first, second, 2)
    cfg = tmp_path / "config.json"
    before = cfg.read_text()
    cmd_use_model(argparse.Namespace(config=str(cfg), preset="byt5-small", answer="not-now", base=None,
                                     workspace=str(ws.root)))
    assert cfg.read_text() == before
    assert next_action(ws).state in ("serving", "exported")
    _flat(ws, first, second, 2)
    assert next_action(ws).state == "improve-stronger-model"
