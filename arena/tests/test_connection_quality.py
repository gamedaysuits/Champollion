"""
Tests for connection_quality.py — the cq-v1 code mirror of
docs/CONNECTION_QUALITY_SPEC.md.

The worked examples (spec §9) are pinned to the digit here and re-encoded
in the JS twin's suite (cli/website/src/utils/connectionQuality.test.mjs),
per the repo's SSOT-twins convention: mirrored suites, no shared fixture
files. If a rule changes in one twin, mirror it in the other.
"""

import pytest

from mt_eval_harness import connection_quality as cq


# Floors pinned from the shipped table (cli/website/src/data/cchrf-floors.json)
# for the spec's worked examples — values restated, not loaded, so this suite
# stays a pure unit test. If the floors table regenerates, the spec's §9
# numbers regenerate with it and these pins update together.
FLOORS = {"eng": 11.964, "fao": 11.384, "yor": 8.628, "deu": 12.214}


def _run(**kw):
    base = {
        "run_id": "r1",
        "chrf_plus_plus": 55.0,
        "n": 200,
        "ci_halfwidth": 3.0,
        "l_eff": 6.0,
        "contamination": "LOW",
        "trust": "verified",
        "paradigm": "llm",
        "age_days": 100,
        "domain": "news",
        "register": None,
    }
    base.update(kw)
    return base


# ---------------------------------------------------------------------------
# Factors: bounds, monotonicity, fail-honest defaults (spec §6.1, §6.9)
# ---------------------------------------------------------------------------

class TestFactors:
    def test_bounds(self):
        for f, args in [
            (cq.f_size, [(0,), (50,), (100,), (10_000,)]),
            (cq.f_rich, [(0.0,), (2.5,), (5.0,), (50.0,)]),
            (cq.f_conf, [(1.0,), (5.0,), (25.0,)]),
            (cq.f_repl, [(0,), (1,), (2,), (9,)]),
        ]:
            for a in args:
                assert 0.0 <= f(*a) <= 1.0

    def test_full_credit_anchors(self):
        assert cq.f_size(100) == 1.0
        assert cq.f_rich(5.0) == 1.0
        assert cq.f_conf(5.0) == 1.0
        assert cq.f_repl(2) == 1.0

    def test_monotone(self):
        assert cq.f_size(120) >= cq.f_size(80)
        assert cq.f_rich(8.0) >= cq.f_rich(4.0)
        assert cq.f_conf(3.0) >= cq.f_conf(6.0)
        assert cq.f_repl(2) >= cq.f_repl(1)

    def test_fail_honest_defaults(self):
        assert cq.f_size(None) == 0.0
        assert cq.f_rich(None) == 0.5
        # missing CI proxies 50/sqrt(n): n=100 -> h=5 -> exactly full credit
        assert cq.f_conf(None, 100) == pytest.approx(1.0)
        assert cq.f_conf(None, 62) == pytest.approx(0.7874007874011811)
        assert cq.f_conf(None, None) == 0.0
        assert cq.f_repl(None) == 0.0

    def test_queue_worked_check_vocab_list(self):
        # The queue spec's own worked check: 62 single-word items, one run,
        # h=8 -> r ~= 0.04 (not a path).
        r = (cq.f_size(62) * cq.f_rich(1.0) * cq.f_conf(8.0) * cq.f_repl(1))
        assert r == pytest.approx(0.03875, abs=1e-4)


# ---------------------------------------------------------------------------
# Chance correction + floors (spec §5.1, §5.2)
# ---------------------------------------------------------------------------

class TestCchrf:
    def test_formula(self):
        assert cq.cchrf(55.0, 11.384) == pytest.approx(0.4921910264512052)

    def test_noise_rail_clamp_at_zero(self):
        assert cq.cchrf(8.0, 11.384) == 0.0

    def test_clamp_at_one(self):
        assert cq.cchrf(100.0, 10.0) == 1.0

    def test_unusable_inputs(self):
        assert cq.cchrf(None, 10.0) is None
        assert cq.cchrf(55.0, None) is None
        assert cq.cchrf(55.0, 100.0) is None


class TestFloorForPair:
    def test_directed_uses_target_side(self):
        assert cq.floor_for_pair(FLOORS, "eng", "fao", direction="a->b") == 11.384
        assert cq.floor_for_pair(FLOORS, "eng", "fao", direction="b->a") == 11.964

    def test_undirected_max_both_required(self):
        assert cq.floor_for_pair(FLOORS, "eng", "fao") == 11.964
        assert cq.floor_for_pair(FLOORS, "eng", "iku") is None
        assert cq.floor_for_pair({}, "eng", "fao") is None

    def test_conservativeness_property(self):
        # Undirected (max floor) correction never exceeds either directed
        # correction: q_undirected == min(q_a->b, q_b->a) (spec §5.2).
        raw = 55.0
        qu = cq.cchrf(raw, cq.floor_for_pair(FLOORS, "eng", "fao"))
        qa = cq.cchrf(raw, cq.floor_for_pair(FLOORS, "eng", "fao", direction="a->b"))
        qb = cq.cchrf(raw, cq.floor_for_pair(FLOORS, "eng", "fao", direction="b->a"))
        assert qu == pytest.approx(min(qa, qb))


class TestStrengthBin:
    def test_band_edges(self):
        assert cq.strength_bin(0.0) == 0
        assert cq.strength_bin(0.15) == 1
        assert cq.strength_bin(0.35) == 2
        assert cq.strength_bin(0.55) == 3
        assert cq.strength_bin(0.75) == 4


# ---------------------------------------------------------------------------
# Portfolio factors (spec §6.4–§6.7)
# ---------------------------------------------------------------------------

class TestCover:
    def test_single_cell_base(self):
        assert cq.f_cover({"news"}, {"_unlabeled"}) == 0.5

    def test_full_credit_shapes(self):
        assert cq.f_cover({"news", "legal", "conv"}, {"x"}) == 1.0
        assert cq.f_cover({"news", "legal"}, {"textbook", "government"}) == 1.0

    def test_religious_never_credits(self):
        # religious-only portfolio: D=0 -> floored at COVER_MIN
        assert cq.f_cover({"religious"}, {"x"}) == 0.25
        # and it never adds a step either
        assert cq.f_cover({"news", "religious"}, {"x"}) == 0.5

    def test_caps(self):
        assert cq.f_cover({"a", "b", "c", "d", "e"}, {"g1", "g2", "g3"}) == 1.0


class TestMetricTrust:
    def test_chance_anchored_mapping(self):
        assert cq.metric_trust_weight(0.5) == 0.0
        assert cq.metric_trust_weight(1.0) == 1.0
        assert cq.metric_trust_weight(0.6545) == pytest.approx(0.309)
        assert cq.metric_trust_weight(0.44) == 0.0  # worse than chance
        assert cq.metric_trust_weight(None) == cq.W_METRIC_UNMEASURED

    def _artifact(self):
        return {
            "languages": {
                "iu": {"iso639_3": "iku", "family": "Eskimo-Aleut"},
                "cs": {"iso639_3": "ces", "family": "Indo-European"},
            },
            "cells": [
                {"preferred": True, "level": "sys", "metric": "chrf_plus_plus",
                 "tgt": "iu", "pairwise_accuracy": 0.6545, "n_sys": 11},
            ],
            "families": {
                "Indo-European": {"metrics": {"chrf_plus_plus": {"sys": {
                    "pairwise_accuracy_weighted_mean": 0.7946}}}},
                "Eskimo-Aleut": {"metrics": {}},
            },
        }

    def test_resolve_pair_basis(self):
        got = cq.resolve_metric_trust(self._artifact(), "chrf_plus_plus", "iu")
        assert got["basis"] == "pair"
        assert got["w"] == pytest.approx(0.309)

    def test_resolve_iso639_3_alias(self):
        got = cq.resolve_metric_trust(self._artifact(), "chrf_plus_plus", "iku")
        assert got["basis"] == "pair"

    def test_resolve_family_basis(self):
        got = cq.resolve_metric_trust(self._artifact(), "chrf_plus_plus", "cs")
        assert got["basis"] == "family"
        assert got["w"] == pytest.approx(2 * 0.7946 - 1)

    def test_resolve_unmeasured_no_borrowing(self):
        got = cq.resolve_metric_trust(self._artifact(), "chrf_plus_plus", "fao")
        assert got == {"w": 0.5, "basis": "unmeasured", "pa": None}


class TestRecencyTrustContam:
    def test_recency_steps(self):
        assert cq.w_recency(100, "llm") == 1.0
        assert cq.w_recency(365, "llm") == 1.0
        assert cq.w_recency(400, "llm") == 0.8
        assert cq.w_recency(1000, "llm") == 0.6
        assert cq.w_recency(None, "llm") == 0.6

    def test_drift_exempt_paradigms(self):
        assert cq.w_recency(10_000, "rule-based") == 1.0
        assert cq.w_recency(None, "human") == 1.0

    def test_unknown_paradigm_drifts(self):
        assert cq.w_recency(1000, None) == 0.6

    def test_trust_map(self):
        assert cq.w_trust("verified") == 1.0
        assert cq.w_trust("unverified") == 0.6
        assert cq.w_trust(None) == 0.6

    def test_contam_map(self):
        assert cq.w_contam("LOW") == 1.0
        assert cq.w_contam("MEDIUM") == 0.4
        assert cq.w_contam("HIGH") == 0.1
        assert cq.w_contam(None) == 0.4  # never assume clean


# ---------------------------------------------------------------------------
# The pair composite — spec §9 worked examples, pinned to the digit
# ---------------------------------------------------------------------------

E1_RUNS = [
    _run(run_id="r1"),
    _run(run_id="r2", chrf_plus_plus=52.1, ci_halfwidth=3.2, age_days=40),
]
MT_UNMEASURED = {"w": 0.5, "basis": "unmeasured", "pa": None}


class TestWorkedExamples:
    def test_e1_directed(self):
        t = cq.connection_quality(E1_RUNS, FLOORS, "eng", "fao",
                                  direction="a->b", metric_trust=MT_UNMEASURED)
        assert t["lane"] == "clean"
        assert t["rung"] == "L0"
        assert t["q"] == pytest.approx(0.4921910264512052)
        assert t["r"] == pytest.approx(0.25)
        assert t["cq"] == pytest.approx(0.1230477566128013)
        assert t["band_label"] == "developing"
        assert t["provisional"] is False
        assert t["source"] == "champollion-derived"
        assert t["provenance"]["supporting_run"] == "r1"
        assert t["components"]["f_repl"] == 1.0  # two LOW runs replicate

    def test_e1_undirected_is_conservative(self):
        t = cq.connection_quality(E1_RUNS, FLOORS, "eng", "fao",
                                  metric_trust=MT_UNMEASURED)
        assert t["components"]["floor"] == 11.964
        assert t["q"] == pytest.approx(0.4888454723067836)
        assert t["q"] <= 0.4921910264512052

    def test_e2_vocab_list(self):
        runs = [_run(run_id="v1", chrf_plus_plus=41.0, n=62, ci_halfwidth=None,
                     l_eff=1.0, trust="unverified", age_days=10, domain=None)]
        t = cq.connection_quality(runs, FLOORS, "eng", "yor",
                                  direction="a->b", metric_trust=MT_UNMEASURED)
        assert t["q"] == pytest.approx(0.35428796567876375)
        assert t["r"] == pytest.approx(0.007322827322830985)
        assert t["cq"] == pytest.approx(0.0025943895952226575)
        assert t["provisional"] is True

    def test_e3_floor_unknown_is_raw_rung(self):
        runs = [_run(run_id="i1", n=300, ci_halfwidth=2.5, l_eff=7.0,
                     age_days=60)]
        t = cq.connection_quality(runs, FLOORS, "eng", "iku", direction="a->b",
                                  metric_trust={"w": 0.309, "basis": "pair",
                                                "pa": 0.6545})
        assert t["rung"] == "raw"
        assert t["q"] is None
        assert t["q_raw"] == pytest.approx(0.55)
        assert t["cq"] is None
        assert t["band"] is None
        assert t["r"] == pytest.approx(0.07725)

    def test_e4_unknown_contamination_relative_lane(self):
        runs = [_run(run_id="f1", chrf_plus_plus=60.0, n=1012,
                     ci_halfwidth=1.5, l_eff=6.5, contamination=None,
                     age_days=30, never_chain=True)]
        t = cq.connection_quality(runs, FLOORS, "eng", "deu", direction="a->b")
        assert t["lane"] == "relative"
        assert t["components"]["w_contam"] == 0.4
        assert t["q"] == pytest.approx(0.544346478937416)
        assert t["r"] == pytest.approx(0.05)
        assert t["cq"] == pytest.approx(0.0272173239468708)

    def test_non_low_never_strengthens(self):
        # A MEDIUM run with a much higher score changes NOTHING on the
        # clean tuple: not q, not replication credit, not cq.
        clean = cq.connection_quality(E1_RUNS, FLOORS, "eng", "fao",
                                      direction="a->b",
                                      metric_trust=MT_UNMEASURED)
        withmed = cq.connection_quality(
            E1_RUNS + [_run(run_id="m1", chrf_plus_plus=70.0, n=1000,
                            ci_halfwidth=1.0, contamination="MEDIUM",
                            age_days=5)],
            FLOORS, "eng", "fao", direction="a->b",
            metric_trust=MT_UNMEASURED)
        assert withmed["q"] == clean["q"]
        assert withmed["cq"] == clean["cq"]
        assert withmed["components"]["n_runs"] == clean["components"]["n_runs"]

    def test_disqualified_runs_are_invisible(self):
        runs = [_run(run_id="d1", trust="disqualified")]
        t = cq.connection_quality(runs, FLOORS, "eng", "fao")
        assert t["lane"] == "unmeasured"

    def test_unmeasured_stays_unmeasured(self):
        t = cq.connection_quality([], FLOORS, "eng", "fao")
        assert t["lane"] == "unmeasured"
        assert t["q"] is None and t["r"] is None and t["cq"] is None

    def test_noise_rail_flag(self):
        runs = [_run(run_id="n1", chrf_plus_plus=10.0)]
        t = cq.connection_quality(runs, FLOORS, "eng", "fao", direction="a->b")
        assert t["q"] == 0.0
        assert "at_or_below_floor" in t["flags"]

    def test_no_canonical_metric(self):
        runs = [_run(run_id="b1", chrf_plus_plus=None)]
        t = cq.connection_quality(runs, FLOORS, "eng", "fao")
        assert t["rung"] == "raw"
        assert "no_canonical_metric" in t["flags"]


class TestHumanEvidence:
    def test_speaker_precedence_over_automatic(self):
        t = cq.connection_quality(
            E1_RUNS, FLOORS, "eng", "fao", direction="a->b",
            human_evidence={"class": "speaker", "share": 0.8, "n": 30,
                            "reviewers": 2})
        assert t["evidence_class"] == "speaker"
        assert t["rung"] == "human"
        assert t["q"] == 0.8
        assert t["r"] == 1.0
        assert t["cq"] == pytest.approx(0.8)
        assert t["provisional"] is False

    def test_thin_review_discounts(self):
        t = cq.connection_quality(
            [], FLOORS, "eng", "fao",
            human_evidence={"class": "speaker", "share": 0.9, "n": 15,
                            "reviewers": 1})
        assert t["r"] == pytest.approx((15 / 30) * (1 / 2))
        assert t["provisional"] is True


class TestChain:
    HOP1 = {"lane": "clean", "rung": "L0", "q": 0.62, "r": 0.9,
            "never_chain": False}
    HOP2 = {"lane": "clean", "rung": "L0", "q": 0.4921910264512052,
            "r": 0.25, "never_chain": False}

    def test_e5_chain(self):
        c = cq.chain_quality([self.HOP1, self.HOP2])
        assert c["estimated"] is True
        assert c["q"] == pytest.approx(0.27464259275977254)
        assert c["r"] == 0.25  # weakest hop owns the claim
        assert c["cq"] == pytest.approx(0.06866064818994314)

    def test_flores_hop_voids_chain(self):
        assert cq.chain_quality(
            [self.HOP1, dict(self.HOP2, never_chain=True)]) is None

    def test_relative_or_raw_hop_voids_chain(self):
        assert cq.chain_quality([dict(self.HOP1, lane="relative")]) is None
        assert cq.chain_quality([dict(self.HOP1, rung="raw")]) is None

    def test_single_hop_no_junction_discount(self):
        c = cq.chain_quality([self.HOP1])
        assert c["q"] == pytest.approx(0.62)

    def test_human_rung_hop_is_chainable(self):
        assert cq.chain_quality([dict(self.HOP1, rung="human")]) is not None


class TestHonestyProperties:
    def test_no_default_is_most_favorable(self):
        # Every §6.9 default sits strictly below its factor's full credit.
        assert cq.f_size(None) < 1.0
        assert cq.f_rich(None) < 1.0
        assert cq.f_repl(None) < 1.0
        assert cq.W_CONTAM_UNKNOWN < cq.W_CONTAM["LOW"]
        assert cq.W_TRUST_UNKNOWN < cq.W_TRUST["verified"]
        assert cq.W_METRIC_UNMEASURED < 1.0
        assert cq.w_recency(None, "llm") < 1.0
        assert cq.f_cover(set(), set()) < 1.0

    def test_all_channels_bounded(self):
        t = cq.connection_quality(E1_RUNS, FLOORS, "eng", "fao",
                                  direction="a->b")
        assert 0.0 <= t["q"] <= 1.0
        assert 0.0 <= t["r"] <= 1.0
        assert 0.0 <= t["cq"] <= 1.0

    def test_bin_constants_match_display_layer(self):
        # Pins parity with arcStrength.mjs BIN_EDGES/BIN_LABELS (the JS
        # twin's suite pins the same values from the other side).
        assert cq.BIN_EDGES == (0.15, 0.35, 0.55, 0.75)
        assert len(cq.BIN_LABELS) == 5
