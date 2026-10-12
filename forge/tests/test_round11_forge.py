"""Round 11 synthetic personas (school: a templated Cree phrasebook with a
fixed teacher-checked test set, an all-data and a twin-free model; hospital:
an Ayta phrasebook with a nurse-checked test set), 2026-10-04.

10. The dev-split advice never resolved: on a corpus whose templates chain,
    no split gives a twin-free dev set that is a sample of the data, yet
    split kept saying "follow the advice before training" after it was
    followed. ONE verdict (``ci_scoring.dev_twin_verdict``) now says so once
    — what a twinned dev set means and the options forge really has — and
    split, ``preflight run`` and ``status`` say it in the same words.
11. ``status`` kept asking for the twin-free model's preregistration after
    "notwins" was written. The clause now reads the preregistrations that
    bind the test set (``advisor.twin_free_prereg_clause``).
12. The export examples left out ``--prereg`` (export refuses without it
    when two preregistrations bind the test set); pinning with
    ``--config-hash`` needs the FULL hash, which preflight now prints.
17. init's note, its next step and the guide gave different orders. ONE
    order (``scaffold.STEP_ORDER``) feeds them all; the guide is checked.

All text is invented tokens (quarantine-gate discipline); every corpus is
generated here.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from nmt_forge.cli import main
from nmt_forge.guards import ci_scoring
from nmt_forge.guards.split_guard import near_dupe_chaining
from tests.conftest import write_jsonl

REPO = Path(__file__).resolve().parents[2]
FILLERS = [f"fill{i}" for i in range(12)]


def _chained(frames: int = 12) -> list[dict]:
    """Templates that CHAIN: every row shares the frame words, so rows with
    the same filler or the same frame are near-twins, and the frames link
    through the fillers into ONE share-group — no split can hold a template
    out whole."""
    return [{"source": f"vok sel dar {w} frame{f}",
             "target": f"tek mur zon {w}x fr{f}"}
            for f in range(frames) for w in FILLERS]


def _distinct(n: int) -> list[dict]:
    return [{"source": f"qa{i} qb{i} qc{i} qd{i}",
             "target": f"za{i} zb{i} zc{i}"} for i in range(n)]


def _run(capsys, *argv):
    code = main(list(argv))
    out = capsys.readouterr()
    return code, out.out, out.err


@pytest.fixture
def school(tmp_path, monkeypatch, capsys):
    """An initialized project with a templated corpus whose templates chain
    and a fixed, separately written test set on the same frames (unseen
    fillers), registered as the test set — run from the project directory."""
    from nmt_forge.scaffold import init_project

    init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    monkeypatch.chdir(tmp_path / "proj")
    write_jsonl(Path("corpus.jsonl"), _chained() + _distinct(60))
    write_jsonl(Path("test.jsonl"),
                [{"source": f"vok sel dar newfill frame{f}",
                  "reference": f"tek mur zon newfillx fr{f}"}
                 for f in range(6)])
    code, _, err = _run(capsys, "registry", "add", "project-test",
                        "test.jsonl", "--role", "test")
    assert code == 0, err
    return tmp_path / "proj"


def _split(capsys, *extra):
    code, out, err = _run(capsys, "split", "corpus.jsonl", "--test", "0",
                          "--dev", "20", "--seed", "3", "--out", "data/split",
                          "--register", "project", "--json", *extra)
    assert code == 0, err
    return json.loads(out)


def _gate(name):
    from nmt_forge.advisor import preflight
    from nmt_forge.workspace import Workspace

    gates = {g.name: g for g in preflight(Workspace(".forge"), "run",
                                          "config.json")}
    return gates[name]


def _status():
    from nmt_forge.advisor import next_action
    from nmt_forge.workspace import Workspace

    return next_action(Workspace(".forge"))


# -- 10. one dev twin verdict ------------------------------------------------------

def test_the_verdict_states():
    chained = near_dupe_chaining(_chained(), threshold=0.6)
    v = ci_scoring.dev_twin_verdict(chained, dev_name="project-dev")
    assert v["state"] == "no-split-fixes" and v["final"] is True
    assert v["advice"].startswith("no split fixes this dev set")
    assert "recall of training phrases, not translation" in v["advice"]
    assert len(v["options"]) == 3
    assert "Accept it and train" in v["options"][0]
    assert "nmt-forge registry add project-dev <file> --role dev " \
           "--allow-rotate" in v["options"][1]
    assert "no cap reaches zero" in v["options"][2]
    assert "not a step to repeat" in v["advice"]
    # a re-split CAN work: the old advice, not final
    plain = ci_scoring.dev_twin_verdict(None)
    assert plain["state"] == "re-split" and plain["final"] is False
    assert plain["advice"] == ci_scoring.DEV_TWIN_ADVICE
    capped = {"max_group": 10, "links": 40, "uncut": 12}
    c = ci_scoring.dev_twin_verdict(None, capped=capped)
    assert c["state"] == "capped" and c["final"] is False
    cc = ci_scoring.dev_twin_verdict(chained, capped=capped)
    assert cc["final"] and "you ran one" in cc["advice"]
    assert "--max-group 10 left uncut (12 of 40 links)" in cc["advice"]
    # the run's saturation note says the same verdict
    assert ci_scoring.dev_saturation_advice(chained) == \
        ci_scoring.dev_twin_verdict(chained)["advice"]


def test_split_preflight_and_status_say_one_verdict(school, capsys):
    payload = _split(capsys)
    dev = payload["dev_near_twin"]
    assert dev["near_twin_rows"] and dev["verdict"]["final"] is True
    assert dev["advice"] == dev["verdict"]["advice"]
    assert "registry add project-dev" in dev["advice"]
    g = _gate("dev-near-twins")
    assert g.ok and g.warning
    assert g.fix == dev["advice"]                       # preflight: same words
    lines = [w for w in _status().warnings if w.startswith("dev set ")]
    assert len(lines) == 1
    assert lines[0].startswith("dev set project-dev: ")
    assert lines[0].endswith(dev["advice"])             # status: same words
    assert "data/split/train.jsonl" in lines[0]
    # preflight measured the same files: no second record, no second line
    assert len([w for w in _status().warnings
                if w.startswith("dev set ")]) == 1


def test_a_capped_resplit_is_told_the_same_verdict_not_to_re_split(
        school, capsys):
    _split(capsys)
    payload = _split(capsys, "--near-dupe", "0.6", "--max-group", "10",
                     "--allow-rotate")
    dev = payload["dev_near_twin"]
    v = dev["verdict"]
    assert v["final"] is True and v["state"] == "no-split-fixes"
    assert "you ran one" in v["advice"]
    assert "--max-group 10 left uncut" in v["advice"]
    # the cap is no evidence the corpus separates: the carve check is
    # measured, and the fixed test set's advice no longer promises the
    # --near-dupe carve that cannot work
    assert payload["near_dupe_carve_check"]["chained"] is True
    test_advice = payload["near_twin"]["project-test"]["advice"]
    assert "does exactly that" not in test_advice
    assert "is no fix on this corpus" in test_advice
    # preflight (the split's own train side) and status repeat it, capped
    assert _gate("dev-near-twins").fix == dev["advice"]
    lines = [w for w in _status().warnings if w.startswith("dev set ")]
    assert len(lines) == 1 and lines[0].endswith(dev["advice"])


def test_status_drops_the_dev_verdict_once_a_run_trained_on_it(school,
                                                                 capsys):
    _split(capsys)
    assert any(w.startswith("dev set ") for w in _status().warnings)
    run = Path(".forge/runs/r1-x")
    run.mkdir(parents=True)
    (run / "run-manifest.json").write_text(json.dumps({
        "run_name": "r1", "config_hash": "x", "selected_checkpoint": "c",
        "dev_set": {"name": "project-dev"},
        "config": {"data": {"gold": ["data/split/train.jsonl"],
                            "dev": "project-dev"}}}))
    assert not any(w.startswith("dev set ") for w in _status().warnings)


def test_split_names_the_two_model_route_instead_of_fix_it_again(school,
                                                                  capsys):
    code, _, err = _run(capsys, "leak-audit", "corpus.jsonl", "--clean-to",
                        "corpus.notwins.jsonl", "--drop-test-twins", "--json")
    assert code == 0, err
    payload = _split(capsys)
    t = payload["near_twin"]["project-test"]
    assert t["near_twin_rows"] and t["two_model"]["clean_to"]
    assert "two-model route" in t["advice"]
    assert "fix it before training" not in t["advice"]
    assert "corpus.notwins.jsonl" in t["advice"]


# -- 11. the twin-free prereg, once written, is not asked for again --------------

def test_status_and_leak_audit_see_the_written_twin_free_prereg(school,
                                                               capsys):
    code, _, err = _run(capsys, "leak-audit", "corpus.jsonl", "--clean-to",
                        "corpus.notwins.jsonl", "--drop-test-twins", "--json")
    assert code == 0, err
    Path("p.json").write_text(json.dumps(
        [{"metric": "chrf++", "expect": "low", "rationale": "x"}]))

    def twin_free_warning():
        w = [w for w in _status().warnings if w.startswith("twin-free")]
        assert len(w) == 1
        return w[0]

    assert "write it before any benchmark run" in twin_free_warning()
    assert _run(capsys, "prereg", "new", "all-data", "--eval-set",
                "project-test", "--predictions", "p.json")[0] == 0
    one = twin_free_warning()
    assert "1 preregistration binds project-test (all-data): one model's" \
        in one and "write it before any benchmark run" in one
    assert _run(capsys, "prereg", "new", "notwins", "--eval-set",
                "project-test", "--predictions", "p.json")[0] == 0
    two = twin_free_warning()
    assert "2 preregistrations bind project-test (all-data, notwins)" in two
    assert "write it" not in two and "`--prereg <id>`" in two
    # the re-run twin-free audit says the same (Round 11 hospital persona)
    code, out, err = _run(capsys, "leak-audit", "corpus.jsonl", "--clean-to",
                          "corpus.notwins.jsonl", "--drop-test-twins",
                          "--overwrite", "--json")
    assert code == 0, err
    note = json.loads(out)["companion_config"]["note"]
    assert "2 preregistrations bind project-test" in note
    assert "write it before any benchmark" not in note


def test_a_prereg_pinned_to_the_twin_free_config_is_recognised(school,
                                                               capsys):
    from nmt_forge.training.config import RunConfig

    code, _, err = _run(capsys, "leak-audit", "corpus.jsonl", "--clean-to",
                        "corpus.notwins.jsonl", "--drop-test-twins", "--json")
    assert code == 0, err
    Path("p.json").write_text(json.dumps(
        [{"metric": "chrf++", "expect": "low", "rationale": "x"}]))
    full = RunConfig.from_file("config-notwins.json").hash()
    assert len(full) == 16
    # the hash preflight prints is the full one — what --config-hash pins
    g = _gate("config")
    assert f"config hash {RunConfig.from_file('config.json').hash()})" \
        in g.detail
    # a prefix would pin to no run: refused, with where the full hash is
    code, _, err = _run(capsys, "prereg", "new", "notwins", "--eval-set",
                        "project-test", "--predictions", "p.json",
                        "--config-hash", full[:12])
    assert code == 2 and "16 hex characters" in err
    assert "nmt-forge preflight run --config" in err
    assert not Path(".forge/preregistrations/notwins.json").exists()
    assert _run(capsys, "prereg", "new", "notwins", "--eval-set",
                "project-test", "--predictions", "p.json", "--config-hash",
                full)[0] == 0
    w = [w for w in _status().warnings if w.startswith("twin-free")][0]
    assert "Its preregistration is written: notwins, pinned to " \
           "config-notwins.json (export binds it without --prereg)" in w


# -- 17. one step order --------------------------------------------------------------

def _markers_in_order(text: str, where: str) -> None:
    from nmt_forge.scaffold import STEP_ORDER

    at, pos = [], 0
    for s in STEP_ORDER:
        if not s.get("marker"):
            continue        # a step to read (the guardrails), no command
        i = text.find(s["marker"], pos)
        assert i >= 0, f"{where}: {s['marker']!r} missing after the " \
                       f"previous step"
        at.append(i)
        pos = i
    assert at == sorted(at)


def test_init_note_next_steps_and_status_give_one_order(tmp_path):
    from nmt_forge.advisor import next_action
    from nmt_forge.scaffold import (init_project, step_order,
                                    step_order_text)
    from nmt_forge.workspace import Workspace

    r = init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    assert r["order"] == step_order()
    assert [s["step"] for s in r["order"]] == [
        "register", "leak-audit", "prereg", "baseline", "guardrails",
        "split", "train"]
    assert step_order_text() in r["note"]
    assert "carve and register a split first" not in r["note"]
    steps = (tmp_path / "proj" / "NEXT_STEPS.md").read_text()
    section = steps.split("## The command order", 1)[1]
    _markers_in_order(section, "NEXT_STEPS.md")
    a = next_action(Workspace(tmp_path / "proj" / ".forge"))
    assert a.state == "initialized" and a.order == r["order"]
    assert a.to_json()["order"] == r["order"]
    assert a.command.startswith("nmt-forge registry add project-test")
    assert step_order_text() in a.why


def test_the_guide_and_the_readme_follow_the_order():
    guide = REPO / "cli" / "website" / "docs" / "build-mt-for-your-language.md"
    readme = REPO / "forge" / "README.md"
    if not guide.is_file():
        pytest.skip("the public guide is not in this tree")
    text = guide.read_text(encoding="utf-8")
    start = text.index("### If you may train a model later")
    _markers_in_order(text[start:], "build-mt-for-your-language.md")
    body = readme.read_text(encoding="utf-8")
    quick = body.split("## From `pip install` to a served model", 1)[1]
    _markers_in_order(quick, "forge/README.md")


# -- 12. every export example names the prereg --------------------------------------

EXPORT_DOCS = [
    "forge/README.md",
    "cli/website/docs/build-mt-for-your-language.md",
    "cli/website/docs/network/getting-started/train-your-first-model.md",
    "cli/website/docs/network/getting-started/training-honestly.md",
    "cli/website/docs/network/tutorials/train-your-own-model.md",
]


def test_every_export_example_names_its_prereg(tmp_path):
    from nmt_forge.scaffold import init_project

    init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    docs = {"NEXT_STEPS.md": (tmp_path / "proj" / "NEXT_STEPS.md").read_text()}
    for rel in EXPORT_DOCS:
        p = REPO / rel
        if p.is_file():
            docs[rel] = p.read_text(encoding="utf-8")
    assert "forge/README.md" in docs
    for name, text in docs.items():
        # a command line (or its continuation) — never forge's printed
        # NEXT: output, which names --prereg only when export needs it
        joined = re.sub(r"\\\n\s*", " ", text)
        cmds = [ln for ln in joined.splitlines()
                if re.search(r"nmt-forge export \.forge/runs/", ln)
                and not ln.lstrip().startswith("NEXT:")]
        assert cmds, f"{name}: no export example"
        for ln in cmds:
            assert "--prereg" in ln, f"{name}: {ln.strip()}"
