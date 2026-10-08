"""score_battery — the per-register battery table through forge.

Pins the acceptance-relevant contracts: id-aligned hypothesis joins,
boundary canonicalization (similarity metrics on canonical text, convention
lane on RAW output), one prereg gate + one ledgered read for the whole
battery, plugin inference once across all groups, and the weighted ALL row
that never replaces per-group claims.
"""

import pytest

from nmt_forge.errors import PreregistrationMissing, ScoringError
from nmt_forge.guards import preregister
from nmt_forge.guards.ci_scoring import score_battery
from nmt_forge.guards.convention_lint import ConventionSpec
from tests.conftest import write_jsonl
from tests.fake_plugin import FakeLint

MACRON = str.maketrans("âêîôû", "āēīōū")


def _battery_rows():
    rows = []
    for i in range(6):
        rows.append({"id": f"tb-{i}", "register": "textbook",
                     "source": f"src tb {i}", "reference": f"nikî-ref {i} tok"})
    for i in range(4):
        rows.append({"id": f"gov-{i}", "register": "government",
                     "source": f"src gov {i}", "reference": f"kîkway {i} pol"})
    return rows


@pytest.fixture
def battery_set(ws, tmp_path):
    rows = _battery_rows()
    p = write_jsonl(tmp_path / "battery.jsonl", rows)
    ws.registry.register("battery", p, "test")
    preregister.new(ws, prereg_id="bat-p1", eval_set="battery",
                    predictions=[{"metric": "chrf++", "expect": "table",
                                  "rationale": "acceptance"}])
    return rows


def test_grouped_scores_with_weighted_row(ws, battery_set):
    hyps = [{"id": r["id"], "hypothesis": r["reference"]}
            for r in battery_set]  # identity decode
    report = score_battery(ws, "battery", hyps, n_bootstrap=50)
    assert set(report.groups) == {"textbook", "government"}
    assert report.groups["textbook"].n == 6
    assert report.groups["textbook"].scores["chrf++"]["score"] == pytest.approx(
        100.0, abs=0.1)
    assert report.weighted["chrf++"] == pytest.approx(100.0, abs=0.1)
    assert "headline claims stay per-group" in report.weighted["note"]
    out = report.format()
    assert "textbook" in out and "ALL (weighted)" in out


def test_id_alignment_is_loud(ws, battery_set):
    hyps = [{"id": r["id"], "hypothesis": "x"} for r in battery_set][:-1]
    with pytest.raises(ScoringError, match="no hypothesis"):
        score_battery(ws, "battery", hyps, n_bootstrap=50)
    hyps = ([{"id": r["id"], "hypothesis": "x"} for r in battery_set]
            + [{"id": "ghost-1", "hypothesis": "x"}])
    with pytest.raises(ScoringError, match="not in"):
        score_battery(ws, "battery", hyps, n_bootstrap=50)


def test_prereg_gate_and_single_ledger_read(ws, tmp_path):
    rows = _battery_rows()
    p = write_jsonl(tmp_path / "b2.jsonl", rows)
    ws.registry.register("b2", p, "test")
    hyps = [{"id": r["id"], "hypothesis": r["reference"]} for r in rows]
    with pytest.raises(PreregistrationMissing):
        score_battery(ws, "b2", hyps, n_bootstrap=50)
    assert ws.ledger.find("read", set="b2", purpose="score") == []
    preregister.new(ws, prereg_id="b2-p", eval_set="b2",
                    predictions=[{"metric": "chrf++", "expect": "x",
                                  "rationale": "r"}])
    score_battery(ws, "b2", hyps, n_bootstrap=50)
    # the whole battery = ONE score-purpose read, one score event
    assert len(ws.ledger.find("read", set="b2", purpose="score")) == 1
    assert len(ws.ledger.find("score", set="b2")) == 1


def test_boundary_canonicalization_and_raw_convention_lane(ws, battery_set):
    # hypotheses are macron variants of the references: with the pack
    # canonicalizer, chrF++ saturates (both sides canonicalized) — while the
    # convention lane sees the RAW output and reports the macron presence
    canon = lambda t: t.translate(str.maketrans("āēīōū", "âêîôû"))
    specs = [ConventionSpec("circumflex", chars="âêîôû"),
             ConventionSpec("macron", chars="āēīōū")]
    hyps = [{"id": r["id"], "hypothesis": r["reference"].translate(MACRON)}
            for r in battery_set]
    report = score_battery(ws, "battery", hyps, canonicalizer=canon,
                           conventions=specs, n_bootstrap=50)
    tb = report.groups["textbook"].scores
    assert tb["chrf++"]["score"] == pytest.approx(100.0, abs=0.1)
    # no single hypothesis MIXES conventions (pure macron), so the mixed
    # rate is honestly 0 — the lane exists and is CI'd
    assert tb["mixed_convention_rate"]["score"] == 0.0
    # without the canonicalizer the same hyps do NOT saturate
    report_raw = score_battery(ws, "battery", hyps, n_bootstrap=50)
    assert report_raw.groups["textbook"].scores["chrf++"]["score"] < 100.0


def test_plugin_lane_computed_once_across_groups(ws, battery_set):
    FakeLint.compute_calls = 0
    hyps = [{"id": r["id"], "hypothesis": r["reference"]} for r in battery_set]
    report = score_battery(ws, "battery", hyps, plugins=(FakeLint(),),
                           n_bootstrap=50)
    assert FakeLint.compute_calls == len(battery_set)  # once per entry, total
    for g in report.groups.values():
        assert g.plugin_aggregates["fake_lint"]["equivalent_match_rate"] == 1.0


def test_positional_hyps_still_work(ws, battery_set):
    hyps = [r["reference"] for r in battery_set]
    report = score_battery(ws, "battery", hyps, n_bootstrap=50)
    assert report.n == len(battery_set)


def test_battery_manifest_renders_plain_language(ws, battery_set):
    from nmt_forge.reporting import render_battery_report

    hyps = [{"id": r["id"], "hypothesis": r["reference"]} for r in battery_set]
    report = score_battery(ws, "battery", hyps, plugins=(FakeLint(),),
                           n_bootstrap=50)
    md = render_battery_report(report.to_manifest())
    assert "| group |" in md and "textbook" in md
    assert "ALL (weighted)" in md
    assert "that width IS the honest claim" in md
    assert "fake_lint" in md  # referee lanes section

def test_near_dupe_lane_emits_strict_subset(ws, battery_set):
    # train corpus: a reworded near-twin of tb-0's source (Jaccard 3/4 = 0.75)
    # and an exact twin of gov-0's reference — both must flag; nothing else
    train = [
        {"source": "src tb 0 reworded", "target": "unrelated tok blar"},
        {"source": "different drill here", "target": "kîkway 0 pol"},
        {"source": "totally unrelated sentence", "target": "nem wug blar"},
    ]
    hyps = [{"id": r["id"], "hypothesis": r["reference"]}
            for r in battery_set]
    report = score_battery(ws, "battery", hyps, n_bootstrap=50,
                           near_dupe_corpus=train)
    assert report.near_dupe["flagged"] == 2
    assert set(report.near_dupe["flagged_ids"]) == {"tb-0", "gov-0"}
    assert report.strict_groups["textbook"].n == 5
    assert report.strict_groups["government"].n == 3
    # frozen set scored UNCHANGED — full groups keep every row
    assert report.groups["textbook"].n == 6
    out = report.format()
    assert "(strict)" in out and "optimism bound" in out
    # manifest + plain-language report carry the strict rows
    manifest = report.to_manifest()
    assert manifest["strict_groups"]["textbook"]["n"] == 5
    assert manifest["near_dupe"]["flagged"] == 2
    from nmt_forge.reporting import render_battery_report

    md = render_battery_report(manifest)
    assert "textbook (strict)" in md and "optimism bound" in md
    # ledger records the lane ran
    ev = ws.ledger.find("score", set="battery")[-1]
    assert ev["near_dupe_flagged"] == 2


def test_near_dupe_lane_off_by_default(ws, battery_set):
    hyps = [{"id": r["id"], "hypothesis": r["reference"]}
            for r in battery_set]
    report = score_battery(ws, "battery", hyps, n_bootstrap=50)
    assert report.strict_groups == {} and report.near_dupe == {}
    assert "(strict)" not in report.format()


def test_near_dupe_fully_flagged_group_is_honest(ws, tmp_path):
    rows = [{"id": f"g-{i}", "register": "drill",
             "source": f"feed the dog {i} now", "reference": f"asam ref {i} tok"}
            for i in range(3)]
    p = write_jsonl(tmp_path / "b3.jsonl", rows)
    ws.registry.register("b3", p, "test")
    preregister.new(ws, prereg_id="b3-p", eval_set="b3",
                    predictions=[{"metric": "chrf++", "expect": "x",
                                  "rationale": "r"}])
    train = [{"source": r["source"] + " twin", "target": "other tok blar"}
             for r in rows]  # every eval source has a near-twin
    hyps = [{"id": r["id"], "hypothesis": r["reference"]} for r in rows]
    report = score_battery(ws, "b3", hyps, n_bootstrap=50,
                           near_dupe_corpus=train)
    assert report.near_dupe["flagged"] == 3
    assert "drill" in report.groups and "drill" not in report.strict_groups
    assert "no clean subset" in report.notes["drill (strict)"]
