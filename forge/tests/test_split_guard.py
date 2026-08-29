import pytest

from nmt_forge.errors import SplitLeakageError
from nmt_forge.guards.split_guard import group_split, verify_disjoint, write_split
from tests.conftest import toy_pairs


def test_shared_target_rows_stay_together():
    # the ledger #1 case: two English drills → ONE target ("Feed him"/"Feed
    # her" → asam). They must land on the same side, every seed.
    pairs = toy_pairs(40)
    pairs.append({"source": "feed him now", "target": "asamtoy"})
    pairs.append({"source": "feed her now", "target": "asamtoy"})
    for seed in range(10):
        split = group_split(pairs, test_size=10, dev_size=5, seed=seed)
        sides_with_twin = [
            name for name, rows in split.sides().items()
            if any(r["target"] == "asamtoy" for r in rows)
        ]
        assert len(sides_with_twin) == 1, f"seed {seed}: twins split across sides"


def test_transitive_groups_via_source_and_target():
    # A,B share a target; B,C share a source → {A,B,C} is one group
    pairs = toy_pairs(30)
    pairs += [
        {"source": "srcA unique", "target": "tgtShared"},
        {"source": "srcB unique", "target": "tgtShared"},
        {"source": "srcB unique", "target": "tgtC other"},
    ]
    split = group_split(pairs, test_size=8, seed=3)
    marks = {"tgtShared", "tgtC other"}
    holders = [
        name for name, rows in split.sides().items()
        if any(r["target"] in marks for r in rows)
    ]
    assert len(set(holders)) == 1


def test_verification_is_belt_and_braces():
    leaky = {
        "train": [{"source": "feed him", "target": "asamtoy"}],
        "test": [{"source": "feed her", "target": "asamtoy"}],
    }
    with pytest.raises(SplitLeakageError) as e:
        verify_disjoint(leaky)
    msg = str(e.value)
    assert "why:" in msg and "fix:" in msg and "group_split" in msg


def test_deterministic_under_seed():
    pairs = toy_pairs(60)
    a = group_split(pairs, test_size=15, dev_size=6, seed=42)
    b = group_split(pairs, test_size=15, dev_size=6, seed=42)
    assert [r["source"] for r in a.test] == [r["source"] for r in b.test]
    assert [r["source"] for r in a.dev] == [r["source"] for r in b.dev]


def test_test_side_stable_as_dev_grows():
    # allocation order test→dev→train: adding a dev carve must not move test
    pairs = toy_pairs(60)
    no_dev = group_split(pairs, test_size=15, dev_size=0, seed=7)
    with_dev = group_split(pairs, test_size=15, dev_size=10, seed=7)
    assert [r["source"] for r in no_dev.test] == [r["source"] for r in with_dev.test]


def test_manifest_accounts_for_everything():
    pairs = toy_pairs(50)
    split = group_split(pairs, test_size=12, dev_size=6, seed=1)
    m = split.manifest
    assert m["sizes"]["train"] + m["sizes"]["dev"] + m["sizes"]["test"] == 50
    assert m["sizes"]["test"] >= 12 and m["sizes"]["dev"] >= 6
    assert m["overshoot"]["test"] == m["sizes"]["test"] - 12
    assert m["seed"] == 1 and m["groups"] > 0


def test_canonicalizer_merges_orthographic_variants():
    pairs = toy_pairs(30)
    pairs.append({"source": "x one", "target": "wâpamew"})
    pairs.append({"source": "x two", "target": "wāpamew"})  # macron variant
    canon = lambda t: t.replace("ā", "â")
    split = group_split(pairs, test_size=8, seed=5, canonicalizer=canon)
    holders = [
        name for name, rows in split.sides().items()
        if any(r["source"].startswith("x ") for r in rows)
    ]
    assert len(set(holders)) == 1


def test_size_errors_are_actionable():
    pairs = toy_pairs(10)
    with pytest.raises(SplitLeakageError):
        group_split(pairs, test_size=0, seed=1)
    with pytest.raises(SplitLeakageError) as e:
        group_split(pairs, test_size=8, dev_size=4, seed=1)
    assert "fix:" in str(e.value)


def test_write_split_roundtrip(tmp_path):
    import json

    pairs = toy_pairs(30)
    split = group_split(pairs, test_size=8, dev_size=4, seed=2)
    paths = write_split(split, tmp_path / "out")
    test_rows = [json.loads(l) for l in paths["test"].read_text().splitlines()]
    assert test_rows == split.test
    manifest = json.loads(paths["manifest"].read_text())
    assert manifest["guard"] == "split-guard"


def test_near_dupe_grouping_keeps_reworded_siblings_together():
    # the crk 2026-07-12 finding: exact-key grouping leaves reworded drills
    # ("this dress is black" / "this coat is black") on opposite sides
    pairs = toy_pairs(40)
    pairs.append({"source": "this dress is black today",
                  "target": "kaskitew unique alpha"})
    pairs.append({"source": "this coat is black today",
                  "target": "kaskitew unique beta"})
    for seed in range(10):
        split = group_split(pairs, test_size=10, dev_size=5, seed=seed,
                            near_dupe_jaccard=0.6)
        holders = [name for name, rows in split.sides().items()
                   if any("kaskitew" in r["target"] for r in rows)]
        assert len(set(holders)) == 1, f"seed {seed}: siblings split"
    # without the lane, some seed eventually separates them (exact keys differ)
    split = group_split(pairs, test_size=10, dev_size=5, seed=0)
    assert split.manifest["near_dupe_jaccard"] is None


def test_group_size_report_makes_collapse_visible():
    # chaining drills: row i shares 4/5 tokens with row i+1 → one giant group
    pairs = toy_pairs(20)
    pairs += [{"source": f"the black dog runs fast{i} here",
               "target": f"atim{i} kaskitew unique"} for i in range(8)]
    split = group_split(pairs, test_size=6, seed=1, near_dupe_jaccard=0.5)
    rep = split.manifest["group_size_report"]
    assert rep["top_sizes"][0] >= 8  # the chained drills collapsed into one
    assert rep["largest_group_fraction"] >= 8 / len(pairs) - 1e-9
    assert rep["singletons"] <= 20
    # verification still holds — near-dupe grouping never weakens exact disjointness
