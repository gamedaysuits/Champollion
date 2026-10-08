import json

import pytest

from nmt_forge.errors import LeakageError
from nmt_forge.guards.leak_audit import assert_clean, clean, leak_audit
from tests.conftest import write_jsonl


def _corpus(n=20):
    return [
        {"source": f"train sentence {i} florp", "target": f"florpa{i} dun"}
        for i in range(n)
    ]


def test_exact_source_and_target_lanes(ws, test_set):
    corpus = _corpus()
    corpus.append({"source": test_set[0]["source"], "target": "novel target"})
    corpus.append({"source": "novel source words", "target": test_set[1]["reference"]})
    report = leak_audit(corpus, ws)
    s = report.per_set["toy-test"]
    assert s["exact_source"] == 1
    assert s["exact_target"] == 1  # the target-side lane — how mistake #1 leaked
    assert report.total_hits == 2


def test_near_dupe_jaccard_catches_reworded_lines(ws, tmp_path):
    eval_rows = [{"source": "the big brown wug jumps high today",
                  "reference": "zin bel korma ten"}]
    p = write_jsonl(tmp_path / "nd.jsonl", eval_rows)
    ws.registry.register("nd", p, "test")
    corpus = _corpus()
    # reworded, not identical: 6/8 shared tokens = 0.75 ≥ 0.6
    corpus.append({"source": "the big brown wug jumps high right now",
                   "target": "unrelated zam"})
    report = leak_audit(corpus, ws)
    # 2026-07-13 pair_mode change: a SOURCE-side reword with a different
    # target is informational (minimal contrast), not fatal
    assert report.per_set["nd"]["near_dupe_source_only"] == 1
    assert report.per_set["nd"]["near_dupe"] == 0
    # either-side mode restores the old fatal behavior
    report_old = leak_audit(corpus, ws, pair_mode="either-side")
    assert report_old.per_set["nd"]["near_dupe"] == 1
    # tighter threshold ignores it entirely
    report2 = leak_audit(corpus, ws, jaccard_threshold=0.9)
    assert report2.per_set["nd"]["near_dupe_source_only"] == 0


def test_exact_hit_not_double_counted_as_near_dupe(ws, test_set):
    corpus = [{"source": test_set[0]["source"], "target": "x y z"}]
    report = leak_audit(corpus, ws)
    s = report.per_set["toy-test"]
    assert s["exact_source"] == 1 and s["near_dupe"] == 0


def test_whole_file_lane(ws, test_set):
    path = ws.registry.get("toy-test")["path"]
    with pytest.raises(LeakageError, match="IS the registered eval set"):
        assert_clean(path, ws)


def test_assert_clean_dev_hits_not_fatal(ws, dev_set):
    corpus = _corpus()
    corpus.append({"source": dev_set[0]["source"], "target": "whatever zam"})
    report = assert_clean(corpus, ws)  # dev overlap: reported, not fatal
    assert report.per_set["toy-dev"]["exact_source"] == 1


def test_assert_clean_test_hits_fatal_with_story(ws, test_set):
    corpus = _corpus()
    corpus.append({"source": test_set[2]["source"], "target": "zam"})
    with pytest.raises(LeakageError) as e:
        assert_clean(corpus, ws)
    msg = str(e.value)
    assert "why:" in msg and "fix:" in msg and "clean(" in msg


def test_clean_removes_rows_and_writes_content_free_manifest(ws, test_set, tmp_path):
    corpus = _corpus(10)
    corpus.append({"source": test_set[0]["source"], "target": "zam"})
    manifest_path = tmp_path / "audit.json"
    survivors, report = clean(corpus, ws, manifest_path=manifest_path)
    assert len(survivors) == 10
    manifest = json.loads(manifest_path.read_text())
    assert manifest["rows_removed"] == 1
    # content-free: no eval or corpus sentence text in the manifest
    text = manifest_path.read_text()
    assert test_set[0]["source"] not in text
    assert "florp" not in text


def test_near_dupe_works_for_spaceless_scripts(ws, tmp_path):
    # a language written WITHOUT word spaces: the whole sentence is one
    # whitespace "token", so a token-only screen would silently go inert —
    # the character n-gram fallback keeps the guard live (invented sentences)
    eval_rows = [{"source": "irrelevant english here",
                  "reference": "这是一个非常重要的测试句子朋友"}]
    p = write_jsonl(tmp_path / "cjk.jsonl", eval_rows)
    ws.registry.register("cjk", p, "test")
    corpus = [
        # reworded: shares most character trigrams with the eval line
        {"source": "x", "target": "这是一个非常重要的测试句子"},
        # unrelated CJK text: must NOT hit
        {"source": "y", "target": "完全不同的另外一些文字内容啊"},
    ]
    report = leak_audit(corpus, ws)
    s = report.per_set["cjk"]
    assert s["near_dupe"] == 1 and s["exact_target"] == 0
    assert 0 in report.leaking_row_indices and 1 not in report.leaking_row_indices


def test_short_lines_skip_near_dupe(ws, tmp_path):
    p = write_jsonl(tmp_path / "short.jsonl",
                    [{"source": "go now", "reference": "zin"}])
    ws.registry.register("short", p, "test")
    corpus = [{"source": "go now please", "target": "unrelated"}]
    report = leak_audit(corpus, ws)  # min_tokens=3 → "go now" has 2 tokens
    assert report.per_set["short"]["near_dupe"] == 0


def test_canonicalizer_composes(ws, tmp_path):
    p = write_jsonl(tmp_path / "c.jsonl",
                    [{"source": "irrelevant", "reference": "nikī nipān kwa"}])
    ws.registry.register("c", p, "test")
    corpus = [{"source": "x", "target": "nikî nipân kwa"}]  # circumflex variant
    canon = lambda t: t.translate(str.maketrans("āēīōū", "âêîôû"))
    report = leak_audit(corpus, ws, canonicalizer=canon)
    assert report.per_set["c"]["exact_target"] == 1
    report_raw = leak_audit(corpus, ws)
    assert report_raw.per_set["c"]["exact_target"] == 0


# -- translation-aware pair_mode (2026-07-13, crk dogfood regression) ---------

def _pair_sets():
    # one registered test set with a known source and target
    return {
        "battery": {
            "role": "test",
            "source": {"why are you going home"},
            "target": {"teneki ka wikiweyan"},
        }
    }


def test_source_only_near_dupe_is_informational_not_fatal():
    # crk false positive: source J≈0.8, target J=0.0 (different answer)
    from nmt_forge.guards.leak_audit import assert_clean, leak_audit
    rows = [{"source": "are you going home", "target": "kiwî kîwân cî kiya"}]
    report = leak_audit(rows, _pair_sets())
    s = report.per_set["battery"]
    assert s["near_dupe"] == 0
    assert s["near_dupe_source_only"] == 1
    assert report.leaking_row_indices == set()
    assert report.informational_row_indices == {0}
    assert_clean(rows, _pair_sets())  # must NOT raise


def test_target_near_dupe_is_fatal():
    # crk true positive: answer near-copied
    import pytest
    from nmt_forge.errors import LeakageError
    from nmt_forge.guards.leak_audit import assert_clean
    sets = {
        "battery": {
            "role": "test",
            "source": {"john s daughters see the woman"},
            "target": {"john otânisa wâpamêyiwa iskwêwa"},
        }
    }
    rows = [{"source": "his daughter sees the woman",
             "target": "otânisa wâpamêyiwa iskwêwa"}]
    with pytest.raises(LeakageError):
        assert_clean(rows, sets)


def test_either_side_mode_restores_old_behavior():
    import pytest
    from nmt_forge.errors import LeakageError
    from nmt_forge.guards.leak_audit import assert_clean
    rows = [{"source": "are you going home", "target": "kiwî kîwân cî kiya"}]
    with pytest.raises(LeakageError):
        assert_clean(rows, _pair_sets(), pair_mode="either-side")


def test_clean_keeps_source_only_rows():
    from nmt_forge.guards.leak_audit import clean
    rows = [
        {"source": "are you going home", "target": "kiwî kîwân cî kiya"},
        {"source": "completely unrelated sentence", "target": "unrelated target words here"},
    ]
    survivors, report = clean(rows, _pair_sets())
    assert len(survivors) == 2          # informational row NOT removed
    assert report.informational_row_indices == {0}


# -- templated-but-distinct data, determinism, human output (2026-10) ---------
#
# A synthetic user's 1,600 school pairs lost 1,258 rows to `--clean-to`:
# every templated sentence ("I see the dog" / "I see the cat") read as a
# near-duplicate ANSWER. And the per-set counts changed between runs (string
# hash order). These pin the fixed behavior.

_NOUNS = ["zub", "kef", "mol", "tav", "rin", "gesh", "pom", "lud"]


def _templated(prefix="nisee"):
    # 4-token targets that differ ONLY in the noun slot (Jaccard 3/5 = 0.6,
    # right at the near-dupe threshold) — template siblings
    return [{"source": f"I see the big {n}",
             "target": f"{prefix} misi {n} anohc"} for n in _NOUNS]


def _sets_from(rows, role="test", name="school-test"):
    from nmt_forge.canonical import canonical_key
    return {name: {
        "role": role,
        "source": {canonical_key(r["source"]) for r in rows},
        "target": {canonical_key(r["target"]) for r in rows},
        "source_rows": {canonical_key(r["source"]): i for i, r in enumerate(rows)},
        "target_rows": {canonical_key(r["target"]): i for i, r in enumerate(rows)},
        "rows": len(rows),
    }}


def test_template_siblings_are_kept_and_counted():
    rows = _templated()
    test, train = rows[:2], rows[2:]
    survivors, report = clean(train, _sets_from(test))
    assert len(survivors) == len(train)              # nothing dropped
    s = report.per_set["school-test"]
    assert s["near_dupe"] == 0
    assert s["near_dupe_template"] == len(train)
    # the eval rows that HAVE a sibling are named, so scoring can report the
    # strict subset instead of hiding template optimism
    assert s["eval_rows_with_template_sibling"] == [0, 1]


def test_fragment_contains_and_spelling_variant_of_an_answer_are_fatal():
    test = [{"source": "john s daughters see the woman",
             "target": "john otânisa wâpamêyiwa iskwêwa"}]
    sets = _sets_from(test)
    fragment = {"source": "x y z", "target": "otânisa wâpamêyiwa iskwêwa"}
    contains = {"source": "p q r",
                "target": "john otânisa wâpamêyiwa iskwêwa mêkwâc"}
    variant = {"source": "u v w",            # diacritics stripped: same answer
               "target": "john otanisa wapameyiwa iskwewa"}
    rep = leak_audit([fragment, contains, variant], sets)
    assert rep.leaking_row_indices == {0, 1, 2}
    rels = {e["row"]: e["relation"]
            for e in rep.examples["near_dupe"]}
    assert rels == {0: "fragment", 1: "contains", 2: "contains"}


def test_near_identical_long_line_is_fatal_even_with_a_substitution():
    words = [f"w{i}" for i in range(20)]
    test = [{"source": "s", "target": " ".join(words)}]
    swapped = words[:-1] + ["other"]
    rep = leak_audit([{"source": "t", "target": " ".join(swapped)}],
                     _sets_from(test))
    # 19/21 ≈ 0.90 shared: the model would be shown 95% of the answer
    assert rep.per_set["school-test"]["near_dupe"] == 1
    assert rep.examples["near_dupe"][0]["relation"] == "near-identical"


def test_row_hitting_two_sets_counts_in_both():
    test = [{"source": "a b c", "target": "zan tor pel kim"}]
    dev = [{"source": "d e f", "target": "zan tor pel kim vos"}]
    sets = {**_sets_from(test), **_sets_from(dev, "dev", "school-dev")}
    rep = leak_audit([{"source": "q r s", "target": "zan tor pel kim"}], sets)
    assert rep.per_set["school-test"]["exact_target"] == 1
    assert rep.per_set["school-dev"]["near_dupe"] == 1   # fragment of dev


def test_audit_is_deterministic_across_hash_seeds(tmp_path):
    import subprocess
    import sys

    corpus = []
    for n in _NOUNS:
        for adj in ("misi", "apisci", "kise"):
            corpus.append({"source": f"I see the {adj} {n} now",
                           "target": f"nisee {adj} {n} anohc"})
    test = corpus[::5]
    train = [r for i, r in enumerate(corpus) if i % 5]
    write_jsonl(tmp_path / "test.jsonl", test)
    write_jsonl(tmp_path / "dev.jsonl", test[:3])
    write_jsonl(tmp_path / "train.jsonl", train)
    script = f"""
import json, sys
sys.path.insert(0, {str(__import__('pathlib').Path(__file__).resolve().parents[1])!r})
from nmt_forge.workspace import Workspace
from nmt_forge.guards.leak_audit import leak_audit
ws = Workspace({str(tmp_path / '.forge')!r})
ws.registry.register('t', {str(tmp_path / 'test.jsonl')!r}, 'test')
ws.registry.register('d', {str(tmp_path / 'dev.jsonl')!r}, 'dev')
m = leak_audit({str(tmp_path / 'train.jsonl')!r}, ws).to_manifest()
print(json.dumps(m, sort_keys=True))
"""
    outs = set()
    for seed in ("0", "1", "12345"):
        env = {**__import__("os").environ, "PYTHONHASHSEED": seed}
        res = subprocess.run([sys.executable, "-c", script], env=env,
                             capture_output=True, text=True, check=True)
        outs.add(res.stdout)
    assert len(outs) == 1, "leak-audit output depends on PYTHONHASHSEED"


def test_render_explains_and_never_prints_eval_text(tmp_path):
    from nmt_forge.guards.leak_audit import render_audit

    test = [{"source": "the secret test prompt", "target": "zan tor pel kim"}]
    train = [{"source": "q r s", "target": "zan tor pel kim vos"},
             {"source": "x y z", "target": "zan tor pel lub"},
             {"source": "the secret test prompt again", "target": "unrelated a b"}]
    rep = leak_audit(train, _sets_from(test))
    text = render_audit(rep, train, corpus_name="train.jsonl")
    assert "DROPPED by --clean-to: 1 row" in text
    assert "near-duplicate ANSWER" in text and "template sibling" in text
    assert "similar prompt, different answer" in text
    assert "line 1" in text                       # 1-based corpus lines
    assert "secret test prompt\"" not in text     # eval text never shown
    # sealed: matched corpus rows are not quoted either
    sealed = _sets_from(test, role="sealed", name="final")
    rep2 = leak_audit(train, sealed)
    text2 = render_audit(rep2, train)
    assert "zan tor pel kim vos" not in text2
    assert "SEALED" in text2


def test_cli_clean_to_keeps_source_only_and_template_rows(tmp_path, capsys):
    from nmt_forge.cli import main

    ws_dir = str(tmp_path / ".forge")
    test = [{"source": "why are you going home", "reference": "teneki ka wikiweyan"},
            {"source": "I see the big zub", "reference": "nisee misi zub"}]
    ev = write_jsonl(tmp_path / "test.jsonl", test)
    main(["--workspace", ws_dir, "registry", "add", "t", str(ev),
          "--role", "test"])
    corpus = write_jsonl(tmp_path / "corpus.jsonl", [
        # same prompt, different answer → KEPT (the docs' claim)
        {"source": "are you going home", "target": "kiwî kîwân cî kiya"},
        # template sibling → KEPT
        {"source": "I see the big kef", "target": "nisee misi kef"},
        # exact answer → DROPPED
        {"source": "anything", "target": "teneki ka wikiweyan"},
    ])
    capsys.readouterr()
    out_path = tmp_path / "clean.jsonl"
    code = main(["--workspace", ws_dir, "leak-audit", str(corpus),
                 "--clean-to", str(out_path), "--json"])
    payload = json.loads(capsys.readouterr().out)
    assert code == 0
    kept = [json.loads(l) for l in out_path.read_text().splitlines()]
    assert [r["target"] for r in kept] == ["kiwî kîwân cî kiya",
                                           "nisee misi kef"]
    assert payload["rows_removed"] == 1 and payload["removed_row_indices"] == [2]
    assert payload["kept_rows_reported"] == 2
    # the audit manifest landed next to the cleaned file, content-free
    manifest_text = (tmp_path / "clean.audit.json").read_text()
    assert "teneki" not in manifest_text and "kiwî" not in manifest_text
