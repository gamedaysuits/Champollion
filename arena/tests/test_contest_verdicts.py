"""Tests for contest_verdicts — node-side paired significance for sealed contests.

The node runs the contest's paired test over every pair of scored entries,
from the TestReports it already keeps, and exports signed verdicts only. These
tests use REAL TestReports (tester.analyze_run_log) and REAL Ed25519 keys, and
check the three things that make the verdicts trustworthy: no text leaves the
node, a verdicts file that does not verify is refused, and one computed for a
different contest / metric / policy / harness is refused.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

pytest.importorskip("cryptography")

from mt_eval_harness import __version__ as HARNESS_VERSION  # noqa: E402
from mt_eval_harness import contest_verdicts as cv  # noqa: E402
from mt_eval_harness.sovereign.threshold_seal import generate_signing_keypair  # noqa: E402
from mt_eval_harness.tester import analyze_run_log  # noqa: E402

CONTEST = "synth-open-2026"
SET = "eval-qaa-qab-secret-v1"
POLICY = {"tie_test": "ar", "alpha": 0.05, "n_resamples": 200, "seed": 12345}

REFS = [f"nâpêw wâpamêw atim {i}" for i in range(30)]


def _write_run(root: Path, request_id: str, predictions: list[str], *,
               contest=CONTEST, dataset=SET, sub_dir="") -> Path:
    """A node run directory the way external_scoring leaves it."""
    d = root / request_id / sub_dir if sub_dir else root / request_id
    d.mkdir(parents=True, exist_ok=True)
    run_log = {
        "run_id": f"hypsub_{request_id}",
        "config": {"dataset_id": dataset, "target_lang": "Qab"},
        "provenance": {"submission": {"contest_id": contest, "request_id": request_id,
                                      "method_sha": "ab" * 32}},
        "results": [{"id": i, "source": f"src {i}", "expected": r, "predicted": p,
                     "error": None} for i, (r, p) in enumerate(zip(REFS, predictions))],
    }
    log_path = d / f"hypsub_{request_id}.json"
    log_path.write_text(json.dumps(run_log), encoding="utf-8")
    report_path = d / f"hypsub_{request_id}_report.json"
    analyze_run_log(run_log, output_path=report_path, compute_ci=False,
                    source_log_path=str(log_path))
    return report_path


def _systems(root: Path) -> dict:
    good = list(REFS)
    worse = [r if i % 3 else "atim" for i, r in enumerate(REFS)]
    same_as_good = list(REFS)
    return {
        "req-good": _write_run(root, "req-good", good),
        "req-worse": _write_run(root, "req-worse", worse),
        "req-twin": _write_run(root, "req-twin", same_as_good),
    }


@pytest.fixture
def keys(tmp_path):
    pair = generate_signing_keypair()
    key = tmp_path / "score-sign-node.key.json"
    pub = tmp_path / "score-sign-node.pub.json"
    key.write_text(json.dumps(pair), encoding="utf-8")
    pub.write_text(json.dumps({"publicKeyDerB64": pair["publicKeyDerB64"],
                               "keyId": pair["keyId"]}), encoding="utf-8")
    return key, pub


def _doc(tmp_path, **overrides):
    reports = _systems(tmp_path / "runs")
    kw = dict(contest_id=CONTEST, sealed_set_id=SET, node_id="lima-airgap-1",
              metric_id="chrf_plain", **POLICY)
    kw.update(overrides)
    return cv.compute_node_verdicts(reports, **kw)


# ---------------------------------------------------------------------------
# Node side
# ---------------------------------------------------------------------------

def test_finds_only_this_contests_main_set_reports(tmp_path):
    root = tmp_path / "runs"
    _systems(root)
    _write_run(root, "req-good", list(REFS), dataset="eval-holdout", sub_dir="holdout")
    _write_run(root, "req-other", list(REFS), contest="another-contest")
    found = cv.find_entry_reports([root], contest_id=CONTEST, sealed_set_id=SET)
    assert sorted(found) == ["req-good", "req-twin", "req-worse"]
    assert all(p.parent.name == rid for rid, p in found.items())


def test_airgap_layout_is_found(tmp_path):
    state = tmp_path / "airgap"
    _write_run(state, "req-a", list(REFS), sub_dir="runs")
    found = cv.find_entry_reports([state], contest_id=CONTEST, sealed_set_id=SET)
    assert list(found) == ["req-a"]


def test_two_main_set_reports_for_one_request_are_refused(tmp_path):
    root = tmp_path / "runs"
    _write_run(root, "req-a", list(REFS))
    dup = root / "req-a" / "hypsub_req-a_report.json"
    (root / "req-a" / "rerun_report.json").write_text(dup.read_text(), encoding="utf-8")
    with pytest.raises(cv.VerdictsError, match="two main-set reports"):
        cv.find_entry_reports([root], contest_id=CONTEST, sealed_set_id=SET)


def test_all_pairs_with_real_statistics(tmp_path):
    doc = _doc(tmp_path)
    assert doc["kind"] == cv.VERDICTS_KIND and doc["harness_version"] == HARNESS_VERSION
    assert [e["request_id"] for e in doc["entries"]] == ["req-good", "req-twin", "req-worse"]
    pairs = {frozenset((p["a"], p["b"])): p for p in doc["pairs"]}
    assert len(pairs) == 3
    twin = pairs[frozenset(("req-good", "req-twin"))]
    assert twin["comparable"] and twin["delta"] == 0 and not twin["significant"]
    vs_worse = pairs[frozenset(("req-good", "req-worse"))]
    assert vs_worse["n_segments"] == 30 and vs_worse["method"] == "approximate_randomization"
    assert (vs_worse["delta"] > 0) == (vs_worse["a"] == "req-good")


def test_metric_without_segment_function_is_refused(tmp_path):
    with pytest.raises(cv.VerdictsError, match="no per-segment recomputation"):
        _doc(tmp_path, metric_id="comet_score")


def test_no_text_can_leave_the_node(tmp_path):
    doc = _doc(tmp_path)
    json_text = json.dumps(doc)
    for ref in REFS:
        assert ref not in json_text
    leaky = json.loads(json_text)
    leaky["pairs"][0]["reason"] = REFS[0]
    with pytest.raises(cv.VerdictsError, match="not a known reason"):
        cv.assert_verdicts_only(leaky)
    leaky = json.loads(json_text)
    leaky["segments"] = [{"expected": REFS[0]}]
    with pytest.raises(cv.VerdictsError, match="keys must be exactly"):
        cv.assert_verdicts_only(leaky)
    leaky = json.loads(json_text)
    leaky["pairs"][0]["a"] = REFS[0] + "\n" + REFS[1]
    with pytest.raises(cv.VerdictsError, match="malformed"):
        cv.assert_verdicts_only(leaky)


# ---------------------------------------------------------------------------
# Online side
# ---------------------------------------------------------------------------

CONTEST_ROW = {"id": CONTEST, "corpus_id": SET}


def _signed(tmp_path, keys, **overrides):
    key, pub = keys
    out = tmp_path / "verdicts.json"
    cv.write_signed_verdicts(_doc(tmp_path, **overrides), out, key)
    return out, pub


def _load(out, pub, **overrides):
    kw = dict(contest=CONTEST_ROW, metric_id="chrf_plain", tie_policy=POLICY,
              promised_harness=HARNESS_VERSION)
    kw.update(overrides)
    return cv.load_verified(out, pub, **kw)


def test_signed_verdicts_verify_and_index(tmp_path, keys):
    out, pub = _signed(tmp_path, keys)
    v = _load(out, pub)
    assert v["node_id"] == "lima-airgap-1" and len(v["pairs"]) == 3


def test_tampered_verdicts_are_refused(tmp_path, keys):
    out, pub = _signed(tmp_path, keys)
    doc = json.loads(out.read_text())
    doc["pairs"][0]["significant"] = not doc["pairs"][0]["significant"]
    out.write_text(json.dumps(doc, sort_keys=True, indent=2) + "\n")
    with pytest.raises(cv.VerdictsError, match="does not verify"):
        _load(out, pub)


def test_wrong_key_and_unsigned_are_refused(tmp_path, keys):
    out, _ = _signed(tmp_path, keys)
    other = generate_signing_keypair()
    other_pub = tmp_path / "other.pub.json"
    other_pub.write_text(json.dumps({"publicKeyDerB64": other["publicKeyDerB64"]}))
    with pytest.raises(cv.VerdictsError, match="does not verify"):
        _load(out, other_pub)
    Path(str(out) + ".sig.json").unlink()
    with pytest.raises(cv.VerdictsError, match="no signature"):
        _load(out, keys[1])


@pytest.mark.parametrize("override, match", [
    ({"contest": {"id": "another", "corpus_id": SET}}, "contest"),
    ({"contest": {"id": CONTEST, "corpus_id": "other-set"}}, "sealed set"),
    ({"metric_id": "chrf_plus_plus"}, "metric"),
    ({"tie_policy": {**POLICY, "alpha": 0.01}}, "tie policy alpha"),
    ({"tie_policy": {**POLICY, "seed": 1}}, "tie policy seed"),
    ({"promised_harness": "0.0.1"}, "harness"),
])
def test_verdicts_for_anything_else_are_refused(tmp_path, keys, override, match):
    out, pub = _signed(tmp_path, keys)
    with pytest.raises(cv.VerdictsError, match=match):
        _load(out, pub, **override)


def test_evidence_is_oriented_upper_minus_lower(tmp_path, keys):
    out, pub = _signed(tmp_path, keys)
    v = _load(out, pub)
    good = {"authorization_request_id": "req-good"}
    worse = {"authorization_request_id": "req-worse"}
    down = cv.evidence_for(v, good, worse, "Plain chrF")
    up = cv.evidence_for(v, worse, good, "Plain chrF")
    assert down["delta"] == -up["delta"] and down["delta"] > 0
    assert down["ci_lower"] == -up["ci_upper"]
    assert down["source"] == "node-verdicts" and "no segment left the node" in down["reason"]
    assert cv.evidence_for(v, good, {"authorization_request_id": None}, "x") is None
    assert cv.evidence_for(v, good, {"authorization_request_id": "req-unknown"}, "x") is None


# ---------------------------------------------------------------------------
# End to end through the ranking
# ---------------------------------------------------------------------------

def test_build_ranking_uses_node_verdicts_as_rung_one(tmp_path, keys, monkeypatch):
    import mt_eval_harness.contest as contest_mod
    from mt_eval_harness import contest_rank as cr
    from test_contest_rank import FakeDB, _card, _contest, _sub

    out, pub = _signed(tmp_path, keys)
    contest = _contest()
    contest.update({"id": CONTEST, "corpus_id": SET})
    contest["metadata"] = {"primary_metric": "chrf_plain", "harness_version": HARNESS_VERSION,
                           "n_resamples": POLICY["n_resamples"]}
    db = FakeDB(contest)
    monkeypatch.setattr(contest_mod, "_api_request", db)
    cards = {}
    for cid, value in (("good", 90.0), ("twin", 90.0), ("worse", 70.0)):
        c = _card(cid, chrf=value, dataset_id=SET)
        c["chrf_plain"] = value
        c["harness_version"] = HARNESS_VERSION
        cards[cid] = c
    db.cards = cards
    db.submissions = [_sub("good", request_id="req-good"),
                      _sub("twin", i=2, request_id="req-twin"),
                      _sub("worse", i=3, request_id="req-worse")]
    r = cr.build_ranking(CONTEST, use_segments=False, node_verdicts=str(out),
                         verify_key=str(pub))
    ev = [e["tie_evidence"] for e in r["entries"] if e.get("tie_evidence")]
    assert all(e["source"] == "node-verdicts" for e in ev)
    assert r["ranking_method"]["node_verdicts"]["node_id"] == "lima-airgap-1"
    assert "approximate_randomization" in r["ranking_method"]["evidence_used"]
    # the twins tie; the worse system does not tie with them
    ranks = {e["run_card_id"]: e["rank"] for e in r["entries"]}
    assert ranks["good"] == ranks["twin"] == 1 and ranks["worse"] == 3


def test_build_ranking_refuses_verdicts_without_a_key(tmp_path, keys, monkeypatch):
    from mt_eval_harness import contest_rank as cr
    import mt_eval_harness.contest as contest_mod
    from test_contest_rank import FakeDB, _contest
    out, _ = _signed(tmp_path, keys)
    contest = _contest()
    contest.update({"id": CONTEST, "corpus_id": SET})
    monkeypatch.setattr(contest_mod, "_api_request", FakeDB(contest))
    with pytest.raises(cr.RankingError, match="needs --verify-key"):
        cr.build_ranking(CONTEST, use_segments=False, node_verdicts=str(out))


def test_run_node_verdicts_on_an_airgapped_node(tmp_path, keys):
    key, pub = keys
    runs = tmp_path / "runs"
    _systems(runs)
    cfg = {"node_id": "lima-airgap-1", "output_dir": str(runs), "signing_key": str(key),
           "contests": {CONTEST: {"secret_set_id": SET, "secret_artifact": "x",
                                  "secret_privkey": "y"}}}
    cfg_path = tmp_path / "node.json"
    cfg_path.write_text(json.dumps(cfg))
    out = tmp_path / "exchange" / "verdicts.json"
    cv.run_node_verdicts(CONTEST, config_path=str(cfg_path), out=str(out),
                         metric="chrf_plain", **POLICY)
    v = _load(out, pub)
    assert len(v["pairs"]) == 3
