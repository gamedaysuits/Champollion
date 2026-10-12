"""A private test set's sentences stay out of forge's output.

The steward of a teacher-checked test set marks it local-only (a
``<file>.champollion.json`` sidecar, usually written by ``champollion
register-corpus --tier local-only``, which also records the corpora card and
the file's sha256). An AI agent driving forge sends whatever it reads in the
terminal to its model provider — so forge prints line numbers, ids, counts
and scores for such a corpus, says once why, and prints the text only with
``--show-text`` (a person at the terminal). Files written into the user's
folders keep the text; files carved from a marked corpus carry the mark.

And the same file goes by ONE name: the registered card's id, read verbatim,
is the dataset id in forge's registry, reports and export — forge's own set
name rides beside it.

All text here is invented tokens (quarantine-gate discipline).
"""

from __future__ import annotations

import hashlib
import json

import pytest

from nmt_forge.cli import main
from nmt_forge.guards import preregister
from nmt_forge.workspace import Workspace
from tests.conftest import write_jsonl

CARD_ID = "eval-eng-qaa-our-school-dev-v1"
TEST_ROWS = [(f"see the zorblat number {i} clearly",
              f"zorbka{i} miv relquon tasp") for i in range(12)]
PRIVATE_MARKERS = ("zorbka", "zorblat")       # every private sentence has one


def _run(capsys, *argv):
    code = main(list(argv))
    out = capsys.readouterr()
    return code, out.out, out.err


def _no_private_text(*texts):
    for t in texts:
        for marker in PRIVATE_MARKERS:
            assert marker not in t, f"private sentence text printed: {t!r}"


def _local_only_test_set(tmp_path, *, card: bool = True):
    """The school's TSV test set, marked local-only, with a registered card
    whose recorded sha256 matches the file (what register-corpus writes)."""
    tsv = tmp_path / "teacher_test.tsv"
    tsv.write_text("".join(f"{s}\t{t}\n" for s, t in TEST_ROWS),
                   encoding="utf-8")
    side = {"transmission": "local-only"}
    if card:
        (tmp_path / "card.json").write_text(json.dumps(
            {"id": CARD_ID,
             "contamination": {"risk": "NONE", "reasoning": "unpublished"}}))
        side.update(card="card.json",
                    sha256=hashlib.sha256(tsv.read_bytes()).hexdigest())
    (tmp_path / "teacher_test.tsv.champollion.json").write_text(
        json.dumps(side))
    return tsv


def _leaky_corpus(tmp_path, name="corpus.jsonl"):
    """40 ordinary rows, then: an exact copy of test answer 1 (line 41), a
    fragment of answer 2 (line 42), a template sibling of answer 3 (43)."""
    rows = [{"source": f"the florp {i} sings loudly",
             "target": f"florpa{i} zam quiv"} for i in range(40)]
    rows += [{"source": "a leak row one", "target": "zorbka1 miv relquon tasp"},
             {"source": "a leak row two", "target": "zorbka2 miv relquon"},
             {"source": "a leak row three",
              "target": "zorbka3 miv relquon blee"}]
    return write_jsonl(tmp_path / name, rows)


def _registered(tmp_path, capsys, **kw):
    ws_dir = str(tmp_path / ".forge")
    tsv = _local_only_test_set(tmp_path, **kw)
    code, out, err = _run(capsys, "--workspace", ws_dir, "registry", "add",
                          "project-test", str(tsv), "--role", "test",
                          "--json")
    assert code == 0, err
    return ws_dir, tsv, json.loads(out)["project-test"]


# -- 1. leak-audit -------------------------------------------------------------

def test_leak_audit_never_quotes_a_row_that_matched_a_local_only_test_set(
        tmp_path, capsys):
    ws_dir, _, _ = _registered(tmp_path, capsys)
    corpus = _leaky_corpus(tmp_path)
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus))
    assert code == 0, err
    _no_private_text(out, err)
    # ids instead of text: the rows are still named, by line number
    assert "e.g. line 41 → project-test row 2" in out
    assert "e.g. line 42 → project-test row 3" in out
    assert "e.g. line 43 → project-test row 4" in out
    # said ONCE, with why and the opt-in
    assert out.count("Sentence text withheld") == 1
    assert "project-test: local-only corpus" in out
    assert "--show-text" in out


def test_leak_audit_json_carries_no_sentence_and_says_why(tmp_path, capsys):
    ws_dir, _, _ = _registered(tmp_path, capsys)
    corpus = _leaky_corpus(tmp_path)
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), "--json")
    assert code == 0, err
    _no_private_text(out)
    payload = json.loads(out)
    tw = payload["text_withheld"]
    assert "local-only" in tw["sets"]["project-test"]
    assert tw["corpus"] is None
    assert "--show-text" in tw["note"]
    # the examples are row numbers either way (content-free contract)
    ex = payload["examples"]["near_dupe"][0]
    assert ex["row"] == 41 and ex["set"] == "project-test"
    # --show-text is for a person: it never puts sentences into --json
    code, out, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                        str(corpus), "--json", "--show-text")
    assert code == 0
    _no_private_text(out)


def test_leak_audit_show_text_prints_the_rows_for_a_person(tmp_path, capsys):
    ws_dir, _, _ = _registered(tmp_path, capsys)
    corpus = _leaky_corpus(tmp_path)
    code, out, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                        str(corpus), "--show-text")
    assert code == 0
    assert 'e.g. line 42 "zorbka2 miv relquon" → project-test row 3' in out
    assert "Sentence text withheld" not in out


def test_leak_audit_withholds_a_local_only_training_corpus(tmp_path, capsys):
    """Training data too: a corpus marked local-only is never quoted, even
    where it matched an ordinary (unmarked) dev set."""
    ws = Workspace(tmp_path / ".forge")
    dev = write_jsonl(tmp_path / "dev.jsonl", [
        {"source": f"the florp {i} sings loudly",
         "reference": f"florpa{i} zam quiv"} for i in range(3)])
    ws.registry.register("open-dev", dev, "dev")
    corpus = _leaky_corpus(tmp_path)
    (tmp_path / "corpus.jsonl.champollion.json").write_text(
        json.dumps({"transmission": "local-only"}))
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "leak-audit",
                        str(corpus))
    assert code == 0
    assert "florpa" not in out and "the florp" not in out
    assert "e.g. line 1 → open-dev row 1" in out
    assert out.count("Sentence text withheld") == 1
    assert "corpus.jsonl: local-only corpus" in out
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "leak-audit",
                        str(corpus), "--json")
    assert json.loads(out)["text_withheld"]["corpus"].startswith("local-only")


def test_an_unmarked_corpus_is_still_quoted(tmp_path, capsys, ws):
    """No mark, no change: the user's own open data is quoted as before."""
    ev = write_jsonl(tmp_path / "ev.jsonl", [
        {"source": "the dax sleeps here now", "reference": "daxko pel sun rin"}])
    ws.registry.register("open-test", ev, "test")
    corpus = write_jsonl(tmp_path / "c.jsonl", [
        {"source": "x y z w", "target": "daxko pel sun rin"}])
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "leak-audit",
                        str(corpus), "--json")
    assert json.loads(out)["text_withheld"] is None
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "leak-audit",
                        str(corpus))
    assert '"daxko pel sun rin"' in out and "withheld" not in out


def test_a_consent_required_license_withholds_text_too(tmp_path, capsys, ws):
    """Not only local-only: a corpus whose envelope declares a bespoke
    (LicenseRef) licence is consent-required — the harness refuses remote
    models for it, so forge does not print it either."""
    path = tmp_path / "bespoke.json"
    path.write_text(json.dumps({
        "dataset": {"license": "LicenseRef-Community-Bespoke-1.0"},
        "entries": [{"source": f"see the zorblat number {i} clearly",
                     "reference": f"zorbka{i} miv relquon tasp"}
                    for i in range(5)]}))
    ws.registry.register("bespoke-test", path, "test")
    assert "consent-required" in ws.registry.text_withheld("bespoke-test")
    corpus = write_jsonl(tmp_path / "c.jsonl", [
        {"source": "a b c d", "target": "zorbka1 miv relquon tasp"}])
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "leak-audit",
                        str(corpus))
    assert code == 0
    _no_private_text(out)
    assert "bespoke-test: consent-required corpus" in out


# -- 2. near-twin forecasts (split / leak-audit / preflight) ---------------------

def test_near_twin_forecasts_carry_no_sentence(tmp_path, capsys):
    ws_dir, _, _ = _registered(tmp_path, capsys)
    corpus = _leaky_corpus(tmp_path)
    for argv in (("split", str(corpus), "--test", "0", "--dev", "5",
                  "--seed", "1", "--out", str(tmp_path / "split")),
                 ("split", str(corpus), "--test", "0", "--dev", "5",
                  "--seed", "1", "--out", str(tmp_path / "split2"), "--json")):
        code, out, err = _run(capsys, "--workspace", ws_dir, *argv)
        assert code == 0, err
        _no_private_text(out, err)
    payload = json.loads(out)
    twin = payload["near_twin"]["project-test"]
    assert twin["near_twin_rows"] >= 1      # the count is there, the text not


# -- 3. export / evaluate ------------------------------------------------------------

def _dummy_run(tmp_path, capsys):
    ws_dir, tsv, _ = _registered(tmp_path, capsys)
    ws = Workspace(ws_dir)
    dev = write_jsonl(tmp_path / "dev.jsonl", [
        {"source": f"the dax {i} sleeps now", "reference": f"daxko{i} pel sun"}
        for i in range(6)])
    ws.registry.register("toy-dev", dev, "dev")
    preregister.new(ws, prereg_id="p1", eval_set="project-test",
                    predictions=[{"metric": "chrf++", "expect": "low",
                                  "rationale": "dummy decode"}])
    gold = write_jsonl(tmp_path / "gold.jsonl", [
        {"source": f"the florp {i} sings", "target": f"florpa{i} zam"}
        for i in range(6)])
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({
        "run_name": "private-run", "workspace": ws_dir,
        "language": {"source": "eng", "target": "qaa"},
        "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "model": {"backend": "dummy"}, "selection": {"metric": "loss"},
        "decode": {"max_new_tokens": 32},
        "eval": {"battery": "project-test", "n_bootstrap": 40,
                 "near_dupe_corpus": str(gold)},
    }))
    code, out, err = _run(capsys, "--workspace", ws_dir, "run", str(cfg),
                          "--json")
    assert code == 0, err
    return ws_dir, json.loads(out)["manifest"]


def test_export_prints_no_sentence_and_names_the_set_by_its_card(
        tmp_path, capsys):
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    exp = tmp_path / "exp"
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--out", str(exp), "--no-model")
    assert code == 0, err
    _no_private_text(out, err)
    assert f"test set project-test = dataset {CARD_ID}" in out
    # --show-text has nothing to add here: export prints no sentence at all
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--out", str(tmp_path / "exp2"), "--no-model",
                          "--json", "--show-text")
    assert code == 0, err
    _no_private_text(out, err)
    summary = json.loads(out)
    assert summary["battery"] == "project-test"
    assert summary["dataset_id"] == CARD_ID
    assert summary["dataset_id_source"].startswith("corpus card ")

    # forge's own files: the card id is the dataset id, the set name beside it
    fm = json.loads((exp / "evaluation" / "forge-model.json").read_text())
    assert fm["test_report"]["set"] == "project-test"
    assert fm["test_report"]["dataset_id"] == CARD_ID
    battery = json.loads((exp / "evaluation" / "battery-hyps-battery.json")
                         .read_text())
    assert battery["eval_set"] == "project-test"
    assert battery["dataset_id"] == CARD_ID
    md = (exp / "evaluation" / "battery-hyps-battery.md").read_text()
    assert f"# Battery report — {CARD_ID} (forge set `project-test`)" in md

    # the mt-eval files: what an `mt-eval run` on the file would call it
    runlog = json.loads((exp / "evaluation" / "runlog.json").read_text())
    report = json.loads((exp / "evaluation" / "runlog_report.json").read_text())
    assert runlog["config"]["dataset_id"] == CARD_ID
    assert report["config"]["dataset_id"] == CARD_ID
    meta = runlog["provenance"]["dataset_meta"]
    assert meta["corpus_card"]["id"] == CARD_ID
    assert meta["transmission"] == "local-only"
    assert meta["nmt_forge_set"] == "project-test"
    assert report["overall"]["nmt_forge_set"] == "project-test"
    pol = runlog["config"]["transmission_policy"]
    assert pol["tier"] == "local-only" and pol["enforced"] is True
    # … they KEEP the text (files in the user's own folder) …
    assert "zorbka1 miv relquon tasp" in json.dumps(runlog, ensure_ascii=False)
    # … and carry the corpus class, so mt-eval withholds it on ITS terminal
    from mt_eval_harness.transmission_policy import withheld_text_reason

    assert withheld_text_reason(report).startswith("local-only")

    # prereg check reads the mt-eval TestReport by forge's set name
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "check",
                          "p1", "--results",
                          str(exp / "evaluation" / "runlog_report.json"))
    assert code == 0, err


def test_evaluate_prints_no_sentence(tmp_path, capsys):
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    for extra in ((), ("--json",)):
        code, out, err = _run(capsys, "--workspace", ws_dir, "evaluate",
                              manifest, "--harness-out",
                              str(tmp_path / "h"), *extra)
        assert code == 0, err
        _no_private_text(out, err)
    battery = json.loads(out)["battery"]
    assert battery["dataset_id"] == CARD_ID
    assert battery["eval_set"] == "project-test"


# -- 4. the registry: one name for one file -----------------------------------------

def test_registry_lists_the_card_id_next_to_forges_name(tmp_path, capsys):
    ws_dir, tsv, entry = _registered(tmp_path, capsys)
    assert entry["dataset_id"] == CARD_ID
    assert entry["dataset_id_source"].startswith("corpus card ")
    assert entry["corpus_card"]["id"] == CARD_ID
    assert "local-only" in entry["text_withheld"]
    code, out, _ = _run(capsys, "--workspace", ws_dir, "registry", "list")
    assert code == 0
    assert f"dataset {CARD_ID} (from corpus card" in out
    assert "sentences withheld from output: local-only" in out
    # the stored registry stays content-free and keyed by forge's name
    stored = json.loads((tmp_path / ".forge" / "eval-registry.json")
                        .read_text())["sets"]
    assert list(stored) == ["project-test"]
    assert "dataset_id" not in stored["project-test"]   # resolved live


def test_a_card_for_another_version_of_the_file_is_not_applied(
        tmp_path, capsys):
    """The card's id is honoured only while the file is the one it
    describes (the sidecar's sha256) — otherwise forge's name, and why."""
    ws_dir, tsv, _ = _registered(tmp_path, capsys)
    side_path = tmp_path / "teacher_test.tsv.champollion.json"
    side = json.loads(side_path.read_text())
    side["sha256"] = "0" * 64
    side_path.write_text(json.dumps(side))
    code, out, _ = _run(capsys, "--workspace", ws_dir, "registry", "list",
                        "--json")
    entry = json.loads(out)["project-test"]
    assert entry["dataset_id"] == "project-test"
    assert entry["dataset_id_source"] == "forge set name"
    assert "changed since it was registered" in entry["dataset_id_note"]
    assert "local-only" in entry["text_withheld"]    # the mark still holds


def test_a_card_registered_after_forge_registration_still_names_the_set(
        tmp_path, capsys):
    ws_dir, tsv, entry = _registered(tmp_path, capsys, card=False)
    assert entry["dataset_id"] == "project-test"
    (tmp_path / "card.json").write_text(json.dumps({"id": CARD_ID}))
    (tmp_path / "teacher_test.tsv.champollion.json").write_text(json.dumps({
        "transmission": "local-only", "card": "card.json",
        "sha256": hashlib.sha256(tsv.read_bytes()).hexdigest()}))
    assert Workspace(ws_dir).registry.identity("project-test")[
        "dataset_id"] == CARD_ID


# -- 5. carved files carry the mark ----------------------------------------------------

def test_split_of_a_local_only_corpus_keeps_its_pieces_local_only(
        tmp_path, capsys):
    from mt_eval_harness.corpus_loader import marked_local_only

    ws_dir = str(tmp_path / ".forge")
    rows = [{"source": f"see the zorblat number {i} clearly",
             "target": f"zorbka{i} miv relquon tasp"} for i in range(30)]
    corpus = write_jsonl(tmp_path / "private.jsonl", rows)
    (tmp_path / "private.jsonl.champollion.json").write_text(json.dumps({
        "transmission": "local-only", "card": "card.json", "sha256": "x"}))
    code, out, err = _run(capsys, "--workspace", ws_dir, "split",
                          str(corpus), "--test", "6", "--dev", "4",
                          "--seed", "1", "--out", str(tmp_path / "split"),
                          "--register", "school", "--json")
    assert code == 0, err
    carried = json.loads(out)["carried_mark"]
    assert carried["mark"] == {"transmission": "local-only"}
    for side in ("train", "dev", "test"):
        f = tmp_path / "split" / f"{side}.jsonl"
        assert marked_local_only(f), side
        doc = json.loads((tmp_path / "split" /
                          f"{side}.jsonl.champollion.json").read_text())
        assert doc["derived_from"] == "private.jsonl"
        assert "card" not in doc and "sha256" not in doc  # not the source's
    # … so the carved test set is withheld like its source
    assert "local-only" in Workspace(ws_dir).registry.text_withheld(
        "school-test")
    leaky = write_jsonl(tmp_path / "more.jsonl", [
        {"source": "q r s t", "target": rows[0]["target"]}] + [
        {"source": f"u {i} v w", "target": f"plain {i} words here"}
        for i in range(20)])
    code, out, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                        str(leaky))
    _no_private_text(out)


def test_leak_audit_clean_to_and_sample_carry_the_mark(tmp_path, capsys, ws):
    from mt_eval_harness.corpus_loader import marked_local_only

    corpus = _leaky_corpus(tmp_path)
    (tmp_path / "corpus.jsonl.champollion.json").write_text(
        json.dumps({"transmission": "local-only"}))
    clean = tmp_path / "clean.jsonl"
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "leak-audit",
                        str(corpus), "--clean-to", str(clean))
    assert code == 0 and marked_local_only(clean)
    assert "keep corpus.jsonl's terms" in out
    sample = tmp_path / "sample.jsonl"
    code, out, _ = _run(capsys, "--workspace", str(ws.root), "sample",
                        str(corpus), "--n", "5", "--seed", "1",
                        "--cap", "1.0", "--out", str(sample), "--json")
    assert code == 0 and marked_local_only(sample)
    assert json.loads(out)["carried_mark"]["sidecars"]


# -- 6. errors that quote a row ------------------------------------------------------

def _score_with_quoting_plugin(tmp_path, capsys, *extra):
    ws_dir, _, _ = _registered(tmp_path, capsys)
    preregister.new(Workspace(ws_dir), prereg_id="p1", eval_set="project-test",
                    predictions=[{"metric": "chrf++", "expect": "low",
                                  "rationale": "test"}])
    hyps = tmp_path / "hyps.txt"
    hyps.write_text("\n".join("h" for _ in TEST_ROWS))
    return main(["--workspace", ws_dir, "score", "--eval-set", "project-test",
                 "--hyps", str(hyps),
                 "--plugin", "tests.fake_plugin:QuotesTheRow", *extra])


def test_an_error_quoting_a_private_row_is_scrubbed(tmp_path, capsys):
    code = _score_with_quoting_plugin(tmp_path, capsys)
    out = capsys.readouterr()
    assert code == 1
    _no_private_text(out.out, out.err)
    assert "[sentence withheld]" in out.err
    assert "cannot analyse reference" in out.err      # the error stays readable
    assert "Sentence text withheld" in out.err and "--show-text" in out.err


def test_an_error_quoting_a_private_row_is_scrubbed_in_json(tmp_path, capsys):
    code = _score_with_quoting_plugin(tmp_path, capsys, "--json")
    out = capsys.readouterr()
    assert code == 1
    _no_private_text(out.out, out.err)
    err = json.loads(out.out)["error"]
    assert "[sentence withheld]" in err["message"]
    assert "local-only" in err["text_withheld"]


def test_show_text_lets_a_person_see_the_error_as_raised(tmp_path, capsys):
    with pytest.raises(ValueError, match="zorbka0 miv relquon tasp"):
        _score_with_quoting_plugin(tmp_path, capsys, "--show-text")


def test_deploy_md_headline_names_the_dataset_id_first():
    """DEPLOY.md (written with a model export) leads with the dataset id and
    keeps forge's set name beside it."""
    from nmt_forge.export import _headline

    report = {"eval_set": "project-test", "dataset_id": CARD_ID, "n": 12,
              "groups": {"all": {"scores": {"chrf++": {
                  "score": 12.4, "ci_lower": 12.3, "ci_upper": 12.5}}}}}
    text = _headline(report, None, None, "exp", "toy-dev", {})
    assert text.startswith(f"Test set `{CARD_ID}` (forge set `project-test`)")
    same = dict(report, dataset_id="project-test")
    assert _headline(same, None, None, "exp", "toy-dev", {}).startswith(
        "Test set `project-test` (n=12)")


def test_an_unreadable_sidecar_refuses_before_anything_is_carved(
        tmp_path, capsys):
    """A steward wrote the sidecar to restrict the data: a typo must not
    produce unmarked pieces of it."""
    corpus = _leaky_corpus(tmp_path)
    (tmp_path / "corpus.jsonl.champollion.json").write_text("{local-only")
    out_dir = tmp_path / "split"
    code, out, err = _run(capsys, "--workspace", str(tmp_path / ".forge"),
                          "split", str(corpus), "--test", "0", "--dev", "5",
                          "--seed", "1", "--out", str(out_dir))
    assert code == 2
    assert "its terms could not be read" in err
    assert not out_dir.exists()
    # and leak-audit treats it as withheld, never as unmarked
    code, out, _ = _run(capsys, "--workspace", str(tmp_path / ".forge"),
                        "leak-audit", str(corpus), "--json")
    assert code == 0
    assert "could not be read" in json.loads(out)["text_withheld"]["corpus"]
