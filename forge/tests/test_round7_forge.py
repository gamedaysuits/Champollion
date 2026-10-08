"""Round 7 synthetic personas (hospital: a templated nurse phrasebook with a
fixed local-only test set; school: an all-data and a twin-free model on one
fixed local-only test set), 2026-10-04.

1. `split --near-dupe 0.6` on a templated corpus made a 714-row dev set when
   100 were asked for and REGISTERED it: the templates chain into one giant
   share-group. Split now refuses a carve whose sides deviate grossly from
   the request (a carved side over 1.5x its request, or training keeping
   under half of what the request leaves it) — numbers, the chaining, the
   routes — and writes nothing; `--max-group` caps near-dupe groups; and the
   near-twin advice everywhere names `--near-dupe 0.6` only where it can
   work on the corpus (forge measures the chaining).

All text is invented tokens (quarantine-gate discipline).
"""

from __future__ import annotations

import itertools
import json
import random

import pytest

from nmt_forge.cli import main
from nmt_forge.errors import SplitSizeRefused
from nmt_forge.guards import ci_scoring
from nmt_forge.guards.split_guard import (SIDE_TOLERANCE, group_split,
                                          near_dupe_chaining, near_dupe_links,
                                          size_deviations, suggested_max_group)
from nmt_forge.canonical import jaccard
from tests.conftest import write_jsonl

FILLERS = [f"fill{i}" for i in range(12)]


def _chained(frames: int = 8) -> list[dict]:
    """A templated corpus whose templates CHAIN: every row shares the frame
    words "vok sel dar", so rows with the same filler OR the same frame are
    near-twins (Jaccard ≥ 0.6) — and the frames link through the fillers
    into ONE share-group."""
    return [{"source": f"vok sel dar {w} frame{f}",
             "target": f"tek mur zon {w}x fr{f}"}
            for f in range(frames) for w in FILLERS]


def _separable(frames: int = 8) -> list[dict]:
    """Frames whose rows are near-twins of each other and of nothing else:
    the corpus --near-dupe was built for (whole templates on one side)."""
    return [{"source": f"frame{f} alpha{f} beta{f} {w} gamma{f}",
             "target": f"fr{f}a fr{f}b {w}x fr{f}c"}
            for f in range(frames) for w in FILLERS]


def _distinct(n: int, start: int = 0) -> list[dict]:
    return [{"source": f"qa{i} qb{i} qc{i} qd{i}",
             "target": f"za{i} zb{i} zc{i}"} for i in range(start, start + n)]


def _run(capsys, *argv):
    code = main(list(argv))
    out = capsys.readouterr()
    return code, out.out, out.err


def _refusing_seed(rows, **kw) -> int:
    for seed in range(50):
        try:
            group_split(rows, seed=seed, near_dupe_jaccard=0.6, **kw)
        except SplitSizeRefused:
            return seed
    raise AssertionError("no seed sent the giant group to a carved side")


# -- the size check ------------------------------------------------------------

def test_a_chained_near_dupe_carve_is_refused_with_numbers_and_routes():
    rows = _chained() + _distinct(60)            # 96 chained + 60 distinct
    seed = _refusing_seed(rows, test_size=0, dev_size=20)
    with pytest.raises(SplitSizeRefused) as e:
        group_split(rows, test_size=0, dev_size=20, seed=seed,
                    near_dupe_jaccard=0.6)
    err = e.value
    msg = str(err)
    assert "nothing was written" in msg
    dev = err.details["deviations"][0]
    assert dev["side"] == "dev" and dev["requested"] == 20
    assert dev["got"] >= 96 and dev["ratio"] > SIDE_TOLERANCE
    assert (f"dev: asked for 20 rows, the carve put {dev['got']} there"
            in msg)
    assert "chain" in err.why and "96 of the 156 rows" in err.why
    assert "up to 1.5× the rows asked for" in err.why        # the tolerance
    for route in ("--near-dupe 0.8", "--max-group 11", "--drop-test-twins",
                  "independently", "drop --near-dupe"):
        assert route in err.fix, route
    assert err.details["group_size_report"]["chained"] is True


def test_overshoot_within_tolerance_is_still_a_split():
    rows = _separable(8) + _distinct(40)       # frames of 12 rows
    split = group_split(rows, test_size=0, dev_size=20, seed=3,
                        near_dupe_jaccard=0.6)
    m = split.manifest
    assert m["sizes"]["dev"] <= SIDE_TOLERANCE * 20
    assert m["size_check"]["deviations"] == []
    assert "1.5×" in m["size_check"]["tolerance"]


def test_size_deviations_reads_every_side():
    assert size_deviations({"train": 70, "dev": 15, "test": 15},
                           {"test": 10, "dev": 10}, 100) == []
    devs = size_deviations({"train": 30, "dev": 10, "test": 60},
                           {"test": 20, "dev": 10}, 100)
    assert [d["side"] for d in devs] == ["test", "train"]
    assert suggested_max_group({"test": 0, "dev": 100}) == 51
    assert suggested_max_group({"test": 4, "dev": 100}) == 3


def test_size_tolerance_none_returns_the_raw_carve_with_the_deviation():
    rows = _chained() + _distinct(60)
    seed = _refusing_seed(rows, test_size=0, dev_size=20)
    split = group_split(rows, test_size=0, dev_size=20, seed=seed,
                        near_dupe_jaccard=0.6, size_tolerance=None)
    assert split.manifest["size_check"]["deviations"][0]["side"] == "dev"


def test_cli_refusal_writes_nothing_and_registers_nothing(tmp_path, capsys):
    rows = _chained() + _distinct(60)
    seed = _refusing_seed(rows, test_size=0, dev_size=20)
    corpus = write_jsonl(tmp_path / "corpus.jsonl", rows)
    ws = str(tmp_path / ".forge")
    code, out, err = _run(capsys, "--workspace", ws, "split", str(corpus),
                          "--test", "0", "--dev", "20", "--seed", str(seed),
                          "--out", str(tmp_path / "split"), "--near-dupe",
                          "0.6", "--register", "project")
    assert code == 2
    assert "split refused — nothing was written" in err
    assert "--max-group" in err and "--drop-test-twins" in err
    assert not (tmp_path / "split").exists()
    code, out, _ = _run(capsys, "--workspace", ws, "registry", "list",
                        "--json")
    assert json.loads(out) == {}                 # nothing was registered
    code, out, _ = _run(capsys, "--workspace", ws, "split", str(corpus),
                        "--test", "0", "--dev", "20", "--seed", str(seed),
                        "--out", str(tmp_path / "split"), "--near-dupe",
                        "0.6", "--json")
    payload = json.loads(out)["error"]
    assert payload["type"] == "SplitSizeRefused"
    assert payload["details"]["deviations"][0]["side"] == "dev"


# -- --max-group ----------------------------------------------------------------

def test_max_group_caps_near_dupe_groups_and_counts_uncut_links():
    rows = _chained() + _distinct(60)
    rows += [{"source": "same prompt here now", "target": f"ans{i} x y"}
             for i in range(14)]                  # an EXACT group of 14
    split = group_split(rows, test_size=0, dev_size=20, seed=1,
                        near_dupe_jaccard=0.6, max_group=11,
                        size_tolerance=None)
    m = split.manifest
    sizes = m["group_size_report"]["top_sizes"]
    assert sizes[0] == 14                 # exact groups are never capped
    assert all(s <= 11 for s in sizes[1:])
    assert m["max_group"] == 11
    assert m["near_dupe_links"] > m["near_dupe_links_left_uncut"] > 0


def test_cli_max_group_needs_near_dupe(tmp_path, capsys):
    corpus = write_jsonl(tmp_path / "c.jsonl", _distinct(40))
    code, _, err = _run(capsys, "split", str(corpus), "--test", "0", "--dev",
                        "8", "--seed", "1", "--out", str(tmp_path / "o"),
                        "--max-group", "5")
    assert code == 2 and "add --near-dupe" in err


def test_cli_max_group_carve_says_the_remaining_twins_are_uncut_links(
        tmp_path, capsys):
    corpus = write_jsonl(tmp_path / "c.jsonl", _chained() + _distinct(60))
    code, out, err = _run(capsys, "--workspace", str(tmp_path / ".forge"),
                          "split", str(corpus), "--test", "0", "--dev", "20",
                          "--seed", "1", "--out", str(tmp_path / "o"),
                          "--near-dupe", "0.6", "--max-group", "11")
    assert code == 0, err
    assert "groups capped at 11" in out
    assert "near-duplicate links left uncut by --max-group 11" in out
    if "⚠ dev:" in out:
        assert "links --max-group 11 left uncut" in out
        assert "add `--near-dupe 0.6`" not in out


# -- the exact prefix-filtered join ---------------------------------------------

def test_prefix_filtered_links_equal_the_brute_force_join():
    rnd = random.Random(7)
    vocab = [f"u{i}" for i in range(14)]
    sets = [frozenset(rnd.sample(vocab, rnd.randint(1, 7)))
            for _ in range(120)] + [frozenset()]
    for t in (0.4, 0.5, 0.6, 0.75, 1.0):
        got = {(i, j) for i, j, _ in near_dupe_links(sets, t)}
        want = {(i, j) for i, j in itertools.combinations(range(len(sets)), 2)
                if sets[i] and sets[j] and jaccard(sets[i], sets[j]) >= t}
        assert got == want, t


# -- the advice names --near-dupe only where it can work --------------------------

def test_the_chaining_check():
    chained = near_dupe_chaining(_chained(), threshold=0.6)
    assert chained["chained"] and chained["largest_group"] == 96
    assert "chain 96 of the 96 rows (100%) into ONE share-group" in \
        chained["message"]
    sep = near_dupe_chaining(_separable(), threshold=0.6)
    assert not sep["chained"] and sep["largest_group"] == 12


def test_split_advice_on_a_chained_corpus_drops_the_near_dupe_carve(
        tmp_path, capsys):
    corpus = write_jsonl(tmp_path / "c.jsonl", _chained())
    code, out, err = _run(capsys, "--workspace", str(tmp_path / ".forge"),
                          "split", str(corpus), "--test", "0", "--dev", "12",
                          "--seed", "1", "--out", str(tmp_path / "o"))
    assert code == 0, err
    assert "⚠ dev:" in out
    assert "is no fix on this corpus" in out
    assert "add `--near-dupe 0.6` to the split" not in out
    assert "independently" in out and "--max-group" in out
    code, out, _ = _run(capsys, "--workspace", str(tmp_path / ".forge"),
                        "split", str(corpus), "--test", "0", "--dev", "12",
                        "--seed", "1", "--out", str(tmp_path / "o2"),
                        "--json")
    payload = json.loads(out)
    assert payload["near_dupe_carve_check"]["chained"] is True
    assert "is no fix on this corpus" in payload["dev_near_twin"]["advice"]


def test_split_advice_on_a_separable_corpus_still_recommends_near_dupe(
        tmp_path, capsys):
    corpus = write_jsonl(tmp_path / "c.jsonl", _separable())
    code, out, err = _run(capsys, "--workspace", str(tmp_path / ".forge"),
                          "split", str(corpus), "--test", "0", "--dev", "12",
                          "--seed", "1", "--out", str(tmp_path / "o"))
    assert code == 0, err
    assert "add `--near-dupe 0.6` to the split" in out
    assert "is no fix on this corpus" not in out


def test_every_advice_reading_tailors_on_a_chained_check():
    check = near_dupe_chaining(_chained(), threshold=0.6)
    for fn in (ci_scoring.near_twin_advice, ci_scoring.near_twin_advice_after,
               ci_scoring.dev_twin_advice, ci_scoring.dev_saturation_advice):
        tailored, plain = fn(check), fn(None)
        assert "is no fix on this corpus" in tailored, fn.__name__
        assert "is no fix on this corpus" not in plain, fn.__name__
    after = ci_scoring.near_twin_summary({"n": 4, "near_dupe": {
        "flagged": 3, "params": {"jaccard_threshold": 0.6},
        "carve_check": check}})
    assert "is no fix on this corpus" in after["advice"]
    assert after["near_dupe_carve_check"]["chained"]
    sat = ci_scoring.dev_saturation(
        {"chrf++": {"score": 100.0, "ci_lower": 100.0, "ci_upper": 100.0}},
        n=8, carve_check=check)
    assert "is no fix on this corpus" in sat["advice"]
    assert "Write dev sentences independently" in sat["advice"]


def test_battery_near_dupe_lane_records_the_carve_check(ws, tmp_path):
    rows = _chained()
    test = write_jsonl(tmp_path / "t.jsonl",
                       [{"source": r["source"], "reference": r["target"]}
                        for r in rows[:4]])
    ws.registry.register("t", test, "dev")
    rep = ci_scoring.score_battery(
        ws, "t", [r["target"] for r in rows[:4]], near_dupe_corpus=rows[4:],
        n_bootstrap=20)
    nd = rep.to_manifest()["near_dupe"]
    assert nd["flagged"] == 4 and nd["carve_check"]["chained"] is True
    assert "is no fix on this corpus" in ci_scoring.near_twin_summary(
        rep.to_manifest())["advice"]


def test_leak_audit_fix_note_on_a_chained_corpus(tmp_path, capsys):
    ws = str(tmp_path / ".forge")
    # a fixed test set built on the corpus's frames with an unseen filler:
    # every test row is a near-twin of a frame in training
    test = write_jsonl(tmp_path / "t.jsonl",
                       [{"source": f"vok sel dar newfill frame{f}",
                         "reference": f"tek mur zon newfillx fr{f}"}
                        for f in range(6)])
    corpus = write_jsonl(tmp_path / "c.jsonl", _chained())
    assert main(["--workspace", ws, "registry", "add", "t", str(test),
                 "--role", "test"]) == 0
    capsys.readouterr()
    code, out, err = _run(capsys, "--workspace", ws, "leak-audit",
                          str(corpus), "--json")
    assert code == 0, err
    v = json.loads(out)["verdict"]
    assert v["severity"] == "severe"
    assert "is no fix on this corpus" in v["fix_note"]
    assert v["near_dupe_carve_check"]["chained"] is True


def test_preflight_dev_twin_advice_on_a_chained_corpus(tmp_path, capsys,
                                                       monkeypatch):
    from nmt_forge.advisor import preflight
    from nmt_forge.workspace import Workspace

    monkeypatch.chdir(tmp_path)
    write_jsonl(tmp_path / "corpus.jsonl", _chained())
    code, _, err = _run(capsys, "split", "corpus.jsonl", "--test", "0",
                        "--dev", "12", "--seed", "1", "--out", "data/split",
                        "--register", "project")
    assert code == 0, err
    (tmp_path / "config.json").write_text(json.dumps({
        "run_name": "r", "workspace": ".forge",
        "data": {"gold": ["data/split/train.jsonl"], "dev": "project-dev"},
        "model": {"backend": "dummy"}}))
    gates = {g.name: g for g in preflight(Workspace(".forge"), "run",
                                          "config.json")}
    g = gates["dev-near-twins"]
    assert g.warning and "is no fix on this corpus" in g.fix
    assert "add `--near-dupe 0.6` to the split" not in g.fix


# -- 5. reads the harness makes of a forge test set ------------------------------

def _harness_read(path, sha, *, purpose="benchmark", run_id="r1"):
    """One line exactly as mt-eval appends it (mt_eval_harness.read_log)."""
    from nmt_forge.registry import read_log_path

    with read_log_path(path).open("a", encoding="utf-8") as f:
        f.write(json.dumps({"event": "read", "tool": "mt-eval",
                            "tool_version": "0.2.0", "command": "run",
                            "purpose": purpose, "run_id": run_id,
                            "sha256": sha,
                            "ts": "2026-10-04T12:00:00+00:00"}) + "\n")


def _test_file(tmp_path, name="t.jsonl", n=6):
    return write_jsonl(tmp_path / name, [
        {"source": f"see the kel{i} now", "reference": f"kelka{i} miv"}
        for i in range(n)])


def test_registering_a_test_set_starts_its_read_log(ws, tmp_path):
    from nmt_forge.registry import read_log_path

    t = _test_file(tmp_path)
    entry = ws.registry.register("t", t, "test")
    log = read_log_path(t)
    lines = [json.loads(l) for l in log.read_text().splitlines()]
    assert len(lines) == 1 and lines[0]["event"] == "watch"
    assert lines[0]["set"] == "t" and lines[0]["sha256"] == entry["sha256"]
    assert set(lines[0]) >= {"tool", "role", "ts", "note"}
    ws.registry.register("t", t, "test")             # idempotent
    ws.registry.open_eval("t", "audit")               # lazily ensured
    assert len(log.read_text().splitlines()) == 1
    d = _test_file(tmp_path, "d.jsonl")
    ws.registry.register("d", d, "dev")               # dev is read freely
    assert not read_log_path(d).exists()


def test_harness_reads_count_only_the_current_content(ws, tmp_path):
    from nmt_forge.registry import read_log_path

    t = _test_file(tmp_path)
    sha = ws.registry.register("t", t, "test")["sha256"]
    _harness_read(t, sha, run_id="a")
    _harness_read(t, sha, purpose="compare", run_id="b")
    _harness_read(t, "0" * 64, run_id="old")
    with read_log_path(t).open("a") as f:
        f.write("{not json\n")
    hr = ws.registry.harness_reads("t")
    assert hr["reads"] == 2 and hr["run_ids"] == ["a", "b"]
    assert hr["by_purpose"] == {"benchmark": 1, "compare": 1}
    assert hr["other_content"] == 1 and hr["unparseable"] == 1


def test_the_harness_writes_what_forge_counts(ws, tmp_path):
    """The contract end to end: mt-eval's own recorder appends to the log
    forge started, and forge counts the read; an unregistered file gets
    nothing written beside it."""
    from nmt_forge import _harness
    from nmt_forge.registry import read_log_path

    _harness.load_harness()
    from mt_eval_harness.read_log import record_read
    from mt_eval_harness.read_log import read_log_path as harness_path

    t = _test_file(tmp_path)
    ws.registry.register("t", t, "test")
    assert harness_path(t) == read_log_path(t)
    rec = record_read(t, command="run", purpose="benchmark", run_id="run_x")
    assert rec and rec["sha256"] == ws.registry.get("t")["sha256"]
    hr = ws.registry.harness_reads("t")
    assert hr["reads"] == 1 and hr["run_ids"] == ["run_x"]
    other = _test_file(tmp_path, "other.jsonl")
    assert record_read(other, command="run", purpose="benchmark",
                       run_id="y") is None
    assert not read_log_path(other).exists()


def test_a_prereg_after_harness_reads_is_a_postdiction(ws, tmp_path):
    from nmt_forge.errors import PreregistrationInvalid
    from nmt_forge.guards import preregister

    t = _test_file(tmp_path)
    sha = ws.registry.register("t", t, "test")["sha256"]
    _harness_read(t, sha)
    pred = [{"metric": "chrf++", "expect": "low", "rationale": "x"}]
    with pytest.raises(PreregistrationInvalid) as e:
        preregister.new(ws, prereg_id="p", eval_set="t", predictions=pred)
    assert "1× by mt-eval (benchmark" in str(e.value)
    assert "--allow-after-reads" in str(e.value)
    preregister.new(ws, prereg_id="p", eval_set="t", predictions=pred,
                    allow_after_reads=True)
    override = ws.ledger.find("override", set="t")[-1]
    assert override["kind"] == "prereg-after-reads"
    assert override["harness_reads"] == 1


def test_a_sealed_set_scored_by_mt_eval_is_spent(ws, tmp_path):
    from nmt_forge.errors import SealedSetSpent

    t = _test_file(tmp_path)
    sha = ws.registry.register("s", t, "sealed")["sha256"]
    ws.registry.open_eval("s", "audit")            # audits never spend
    _harness_read(t, sha)
    with pytest.raises(SealedSetSpent) as e:
        ws.registry.open_eval("s", "score")
    assert "already scored by mt-eval 1 time(s)" in str(e.value)
    ws.registry.open_eval("s", "score", override_respend="steward said so")
    assert ws.ledger.find("override", set="s")[0]["harness_reads"] == 1


def test_ledger_show_and_status_count_harness_reads(tmp_path, capsys):
    from nmt_forge.advisor import render_status, snapshot
    from nmt_forge.workspace import Workspace

    ws_dir = str(tmp_path / ".forge")
    t = _test_file(tmp_path)
    assert main(["--workspace", ws_dir, "registry", "add", "t", str(t),
                 "--role", "test"]) == 0
    ws = Workspace(ws_dir)
    _harness_read(t, ws.registry.get("t")["sha256"])
    capsys.readouterr()
    code, out, _ = _run(capsys, "--workspace", ws_dir, "ledger", "show",
                        "--set", "t", "--json")
    assert json.loads(out)["harness_reads"]["reads"] == 1
    assert snapshot(ws)["harness_reads"]["t"]["reads"] == 1
    assert "t was scored 1× by mt-eval (benchmark ×1" in render_status(ws)


def test_export_says_the_score_is_not_a_first_look(tmp_path, capsys):
    from nmt_forge.export import _headline
    from nmt_forge.workspace import Workspace
    from tests.test_private_text import _dummy_run

    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    ws = Workspace(ws_dir)
    entry = ws.registry.get("project-test")
    _harness_read(entry["path"], entry["sha256"], run_id="peek")
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--out", str(tmp_path / "exp"), "--no-model",
                          "--json")
    assert code == 0, err
    payload = json.loads(out)
    assert payload["harness_reads"]["reads"] == 1
    fm = json.loads((tmp_path / "exp" / "evaluation" /
                     "forge-model.json").read_text())
    assert fm["test_report"]["harness_reads"]["run_ids"] == ["peek"]
    text = _headline({"eval_set": "t", "n": 4, "groups": {}}, None, None,
                     "out", "d", None, None,
                     harness_reads=payload["harness_reads"])
    assert "**Not a first look:**" in text and "1× (benchmark ×1" in text


# -- 14. two runs: run-named export folders, order does not matter ---------------

def _second_run(tmp_path, capsys, ws_dir, name="twin-free", *extra):
    cfg = json.loads((tmp_path / "config.json").read_text())
    cfg["run_name"] = name
    path = tmp_path / f"config-{name}.json"
    path.write_text(json.dumps(cfg))
    return _run(capsys, "--workspace", ws_dir, "run", str(path), *extra)


def test_with_two_runs_every_export_suggestion_is_run_named(tmp_path, capsys):
    from nmt_forge.advisor import next_action, render_status
    from nmt_forge.export import EXPORT_ORDER_NOTE, suggest_export_dir
    from nmt_forge.workspace import Workspace
    from tests.test_private_text import _dummy_run

    ws_dir, first = _dummy_run(tmp_path, capsys)
    ws = Workspace(ws_dir)
    # one run: export/ (free) is the suggestion
    assert suggest_export_dir("private-run", workspace=ws,
                              base=tmp_path) == "export/"
    code, out, err = _second_run(tmp_path, capsys, ws_dir)
    assert code == 0, err
    assert "--out export-twin-free/" in out
    assert "export order does not matter" in out
    exit_line = [ln for ln in out.splitlines() if ln.startswith("RUN EXIT")][-1]
    assert "--out export-twin-free/" in exit_line
    assert "export order does not matter" in exit_line
    code, out, err = _second_run(tmp_path, capsys, ws_dir, "twin-free",
                                 "--json")
    payload = json.loads(out)
    assert payload["export_out"] == "export-twin-free/"
    assert payload["export_order_note"] == EXPORT_ORDER_NOTE
    # status: the newest run's command, the other run's command, the note
    a = next_action(ws)
    assert a.state == "ready-to-score"
    assert "--out export-twin-free/" in a.command
    assert f"{first} --out export-private-run/" in a.why
    assert "export order does not matter" in a.why.lower()
    assert "export order does not matter" in render_status(ws).lower()


def test_next_steps_says_the_export_order_does_not_matter(tmp_path):
    from nmt_forge.scaffold import init_project

    init_project("qaa", tmp_path / "proj", no_card=True, name="Toylang")
    steps = (tmp_path / "proj" / "NEXT_STEPS.md").read_text()
    assert "The export order does not matter" in steps
    assert "`export-<run>/`" in steps


# -- 15. the LYSS rung is never ticked when it cannot run ------------------------

def _referee_report(installed: bool):
    from nmt_forge.cards import ResourceReport

    return ResourceReport(code="qaa", name="Toylang", card_path="x",
                          referee={"metrics": {"m": {"module": "toy.m",
                                                     "class": "M"}},
                                   "package": "toy-referee",
                                   "installed": installed})


def test_rung_five_is_unavailable_when_not_installed_or_withheld():
    from nmt_forge.scaffold import next_steps, starter_config

    r = _referee_report(False)
    rung = {n: (a, t) for n, a, t in r.ladder()}[5]
    assert rung[0] is False and "UNAVAILABLE here" in rung[1]
    assert "pip install 'toy-referee'" in rung[1]
    assert "local-only or sealed test set" in rung[1]
    steps = next_steps(r, starter_config(r))
    line = next(l for l in steps.splitlines() if l.startswith("- ")
                and "rung 5" in l)              # the brief's own ladder
    assert line.startswith("- — rung 5") and "UNAVAILABLE" in line
    assert "✓ rung 5" not in steps
    ok = _referee_report(True)
    assert {n: a for n, a, _ in ok.ladder()}[5] is True
    withheld = {n: (a, t) for n, a, t in ok.ladder(
        test_withheld="project-test: local-only corpus")}[5]
    assert withheld[0] is False
    assert "UNAVAILABLE for your test set (project-test: local-only" in \
        withheld[1]
    none = _referee_report(False)
    none.referee = None
    assert {n: a for n, a, _ in none.ladder()}[5] is None


# -- 16. which prereg applies to which run ----------------------------------------

def test_status_and_report_name_each_runs_prereg(tmp_path, capsys):
    from nmt_forge.advisor import render_status, snapshot
    from nmt_forge.guards import preregister
    from nmt_forge.reporting import render
    from nmt_forge.workspace import Workspace
    from tests.test_private_text import _dummy_run

    ws_dir, first = _dummy_run(tmp_path, capsys)        # prereg p1 exists
    code, out, err = _second_run(tmp_path, capsys, ws_dir, "twin-free",
                                 "--json")
    assert code == 0, err
    second = json.loads(out)
    ws = Workspace(ws_dir)
    # an unpinned second prereg: neither run can tell which applies
    preregister.new(ws, prereg_id="p2", eval_set="project-test",
                    predictions=[{"metric": "chrf++", "expect": "low",
                                  "rationale": "x"}])
    runs = {r["run"]: r for r in snapshot(ws)["runs"]}
    assert runs["twin-free"]["prereg"]["state"] == "ambiguous"
    assert "prereg AMBIGUOUS (p1, p2)" in render_status(ws)
    # pinned to the twin-free run: each run now has exactly one
    preregister.new(ws, prereg_id="p3", eval_set="project-test",
                    predictions=[{"metric": "chrf++", "expect": "low",
                                  "rationale": "x"}],
                    config_hash=second["config_hash"])
    (ws.prereg_dir / "p2.json").unlink()            # withdrawn (test only)
    snap = snapshot(ws)
    runs = {r["run"]: r for r in snap["runs"]}
    assert runs["private-run"]["prereg"]["id"] == "p1"
    assert runs["twin-free"]["prereg"]["id"] == "p3"
    assert "pinned to this run's config hash" in runs["twin-free"]["prereg"][
        "how"]
    preregs = {p["id"]: p for p in snap["preregs"]}
    assert preregs["p1"]["runs"] == ["private-run"]
    assert preregs["p3"]["runs"] == ["twin-free"]
    text = render_status(ws)
    assert "p1 → run private-run (project-test)" in text
    assert "p3 → run twin-free (project-test)" in text
    # once the first run's export is judged, it says so
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", first,
                          "--out", str(tmp_path / "exp"), "--no-model",
                          "--prereg", "p1")
    assert code == 0, err
    b = {r["run"]: r for r in snapshot(ws)["runs"]}["private-run"]["prereg"]
    assert b["state"] == "judged" and b["id"] == "p1"
    report = render(second["manifest"], workspace=ws_dir)
    assert "## Preregistration" in report
    assert "judged against `p3`" in report
