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
