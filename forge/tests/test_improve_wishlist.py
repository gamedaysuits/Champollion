"""The improve loop's diagnosis and wishlist (journey plan, Phase 2 steps 2–3):
where the model goes wrong on dev, by kind of sentence; and a printable sheet
of what to write next. Neither tells the screen a sentence or a word, and
neither reads the test set or takes words from dev."""

import json
from pathlib import Path

import pytest

from nmt_forge.improve.analysis import IMPROVE_ANALYZE, analyze
from nmt_forge.improve.everyday import everyday_words
from nmt_forge.improve.kinds import kinds_of
from nmt_forge.improve.wishlist import IMPROVE_WISHLIST, OPEN_SHARE, covered, make_wishlist
from nmt_forge.training.run import DEV_OUTPUTS, read_dev_outputs, run
from tests.conftest import write_jsonl

QUESTIONS = [f"where did the {w} go?" for w in ("dax", "blick", "tup", "wug", "fep", "zorp")]
NEGATIONS = [f"the {w} did not sleep" for w in ("mib", "gorp", "lun", "vex", "kib", "nop")]
PLAIN = [f"the {w} sleeps now" for w in ("sib", "jat", "pell", "rook", "taz", "quib", "wem", "yop")]


def _project(ws, tmp_path, *, source="eng", target="qaa", gold_extra=(), dev_extra=()):
    dev_rows = [{"source": s, "reference": f"ref {i} {s.split()[-2]}"} for i, s in
                enumerate(QUESTIONS + NEGATIONS + PLAIN + list(dev_extra))]
    path = write_jsonl(tmp_path / "eval" / "toy-dev.jsonl", dev_rows)
    ws.registry.register("toy-dev", path, "dev")
    test_rows = [{"source": f"the tozer {i} sees the river", "reference": f"tozka{i}"} for i in range(6)]
    ws.registry.register("toy-test", write_jsonl(tmp_path / "eval" / "toy-test.jsonl", test_rows), "test")
    gold = [{"source": f"the florp {i} runs to the rivers", "target": f"florpa{i} zam"} for i in range(6)]
    gold += list(gold_extra)
    write_jsonl(tmp_path / "gold.jsonl", gold)
    raw = {"run_name": "w", "workspace": str(ws.root),
           "language": {"source": source, "target": target},
           "data": {"gold": [str(tmp_path / "gold.jsonl")], "dev": "toy-dev"},
           "model": {"backend": "dummy"}, "selection": {"metric": "loss"},
           "decode": {"max_new_tokens": 64}}
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps(raw))
    m = run(cfg)
    # the model's dev translations: right on all but the questions
    run_dir = Path(m["manifest_path"]).parent
    head, _ = read_dev_outputs(run_dir)
    hyps = ["zzz qqq" if r["source"] in QUESTIONS else r["reference"] for r in dev_rows]
    (run_dir / DEV_OUTPUTS).write_text(json.dumps(head) + "\n" + "".join(json.dumps({"hyp": h}) + "\n" for h in hyps))
    return m, dev_rows


def test_kinds_of_english_sentences():
    assert "question" in kinds_of("Where is the dog?")
    assert "negation" in kinds_of("I don't know") and "negation" in kinds_of("nobody came")
    assert "past" in kinds_of("we walked home yesterday") and "past" in kinds_of("she went")
    assert "past" not in kinds_of("I need a red bed")
    assert "future" in kinds_of("we'll go tomorrow") and "future" in kinds_of("I am going to eat")
    assert "command" in kinds_of("Come here!") and "command" in kinds_of("please sit down")
    assert "command" not in kinds_of("we sit down")
    assert "possession" in kinds_of("Grandpa's truck is old") and "possession" in kinds_of("my dog")
    assert "possession" not in kinds_of("it's cold")
    assert "joined" in kinds_of("we ate and then we slept")
    assert "number" in kinds_of("three horses") and "number" in kinds_of("7 days")
    assert "short" in kinds_of("good morning") and "long" in kinds_of(" ".join(["word"] * 11))


def test_the_diagnosis_names_kinds_and_counts_never_a_sentence(ws, tmp_path):
    m, dev_rows = _project(ws, tmp_path)
    reads = len(ws.ledger.find("read", set="toy-test", purpose="score"))
    r = analyze(ws, m["manifest_path"])
    assert r["n"] == len(dev_rows)
    assert r["kinds"]["question"]["n"] == 6 and r["kinds"]["question"]["chrf"] < r["chrf"]
    assert r["weakest"][0] == "question"
    assert r["kinds"]["negation"]["gap"] < 0, "the right ones score above the whole"
    assert r["kinds"]["number"].get("too_few") or r["kinds"]["number"]["n"] < 5
    # every dev sentence has a word training never saw (dax, mib, …)
    assert r["unseen"]["rows"] == len(dev_rows)
    doc = json.dumps(r)
    assert not any(row["source"] in doc or row["reference"] in doc for row in dev_rows)
    assert ws.ledger.find(IMPROVE_ANALYZE)[-1]["weakest"][0] == "question"
    assert len(ws.ledger.find("read", set="toy-test", purpose="score")) == reads, "the test set is not read"
    assert any("questions" in line for line in r["text"])


def test_a_gap_that_could_be_chance_never_steers_the_wishlist(ws, tmp_path):
    """FORGE_MACHINE_CRITIQUE finding 10: one wrong question in six is a gap,
    but not one the wishlist may steer by — its interval spans zero."""
    m, dev_rows = _project(ws, tmp_path)
    run_dir = Path(m["manifest_path"]).parent
    head, _ = read_dev_outputs(run_dir)
    wrong_once = {QUESTIONS[0]}
    hyps = ["zzz qqq" if r["source"] in wrong_once else r["reference"] for r in dev_rows]
    (run_dir / DEV_OUTPUTS).write_text(json.dumps(head) + "\n" + "".join(json.dumps({"hyp": h}) + "\n" for h in hyps))
    r = analyze(ws, m["manifest_path"])
    q = r["kinds"]["question"]
    assert q["gap"] > 0 and q["gap_ci"][0] <= 0 and q["clear"] is False
    assert "question" not in r["weakest"] and r["unclear"][0] == "question"
    assert any("could be chance" in line for line in r["text"])


def test_the_wishlist_sheet_and_its_content_free_summary(ws, tmp_path):
    m, dev_rows = _project(ws, tmp_path)
    out = tmp_path / "improve" / "round-1" / "wishlist.md"
    s = make_wishlist(ws, out=out, run_manifest=m["manifest_path"], n=40, round_no=1)
    sheet = out.read_text()
    data = json.loads((out.parent / "wishlist.json").read_text())
    assert s["prompts"] == len(data["words"]) + len(data["kinds"]) + len(data["open"]) <= 40
    assert s["open"] >= OPEN_SHARE * 40 - 1
    assert s["kinds_chosen_from"] == "dev errors" and "question" in s["kinds"]
    assert s["new_words"] == len(data["words"]) > 0
    # words come from the everyday list (no lexicon, no wanted sentences here) and
    # never from dev or test
    every = {w for _, w in everyday_words()}
    dev_words = {w for row in dev_rows for w in row["source"].replace("?", "").split()}
    for item in data["words"]:
        assert item["word"] in every
        assert f"“{item['word']}”" in sheet
    assert not ({i["word"] for i in data["words"]} & (dev_words - every))
    # "river" is covered by "rivers" in training — not asked for
    assert "river" not in {i["word"] for i in data["words"]}
    # the summary never carries a word from the sheet
    doc = json.dumps(s)
    assert not any(f'"{i["word"]}"' in doc for i in data["words"])
    assert ws.ledger.find(IMPROVE_WISHLIST)[-1]["prompts"] == s["prompts"]
    assert s["text"][0].startswith(f"{s['prompts']} prompts:")
    assert "Round 1" in sheet and "## Anything at all" in sheet and "## Do you have any of these?" in sheet
    # a few sentences a word, not one (stress test 4 + G1-cross, 2026-10-13: a word
    # seen once is rarely learned; chasing new words taught less than everyday sentences)
    assert "Two or three sentences with each word you need" in sheet


def test_words_the_people_asked_for_and_never_taught_come_first(ws, tmp_path):
    m, _ = _project(ws, tmp_path)
    wanted = tmp_path / "improve" / "round-1" / "to-translate.txt"
    wanted.parent.mkdir(parents=True)
    wanted.write_text("the moose crossed the lake\nthe moose ate grass\n")
    lex = tmp_path / "words.tsv"
    lex.write_text("kettle\tkettlu\nsnowshoe\tasam\n")
    s = make_wishlist(ws, out=tmp_path / "w.md", run_manifest=m["manifest_path"],
                      wanted=[wanted], lexicons=[lex], n=40)
    words = [i["word"] for i in json.loads((tmp_path / "wishlist.json").read_text())["words"]]
    assert words[0] == "moose", words[:5]
    assert words.index("kettle") < words.index("snowshoe") if "snowshoe" in words else "kettle" in words
    assert "word list" not in s["ask_for"], "they gave one"


def test_no_prompt_shares_four_words_with_dev_or_test(ws, tmp_path):
    from nmt_forge.improve.wishlist import KIND_PROMPTS
    # a dev sentence that happens to be one of the question prompts
    m, _ = _project(ws, tmp_path, dev_extra=[KIND_PROMPTS["question"][0]])
    s = make_wishlist(ws, out=tmp_path / "w.md", run_manifest=m["manifest_path"], n=40)
    data = json.loads((tmp_path / "wishlist.json").read_text())
    # both question prompts share "question you'd really ask" with it: neither is
    # asked, and open prompts take their places
    assert not any("question you'd really ask" in k["prompt"] for k in data["kinds"])
    assert s["prompts"] == 40


def test_without_dev_translations_the_kinds_are_a_starting_set_and_it_says_so(ws, tmp_path):
    m, _ = _project(ws, tmp_path)
    (Path(m["manifest_path"]).parent / DEV_OUTPUTS).unlink()
    s = make_wishlist(ws, out=tmp_path / "w.md", run_manifest=m["manifest_path"], n=20)
    assert s["kinds_chosen_from"] == "a starting set" and s["diagnosis"] is None
    assert "not chosen from its errors" in " ".join(s["text"])


def test_when_neither_side_is_english_there_are_no_kinds(ws, tmp_path):
    m, _ = _project(ws, tmp_path, source="fra", target="qaa")
    s = make_wishlist(ws, out=tmp_path / "w.md", run_manifest=m["manifest_path"], n=20)
    assert s["kinds"] == {} and s["new_words"] == 0 and s["open"] == s["prompts"] == 20


def test_covered_counts_plain_endings():
    known = {"rivers", "walked", "berries", "making"}
    assert covered("river", known) and covered("walk", known) and covered("berry", known)
    assert covered("make", known) and not covered("lake", known)


def test_too_short_a_wishlist_is_refused(ws, tmp_path):
    from nmt_forge.improve.compare import RoundError
    m, _ = _project(ws, tmp_path)
    with pytest.raises(RoundError, match="too short"):
        make_wishlist(ws, out=tmp_path / "w.md", run_manifest=m["manifest_path"], n=4)


def test_a_word_list_it_cannot_read_is_said_not_skipped(ws, tmp_path):
    m, _ = _project(ws, tmp_path)
    bad = tmp_path / "broken.tsv"
    bad.write_text("one column only\n")
    s = make_wishlist(ws, out=tmp_path / "w.md", run_manifest=m["manifest_path"], lexicons=[bad], n=20)
    assert s["word_lists_unread"] == ["broken.tsv"]
    assert any("could not be read" in line for line in s["text"])
