"""Rank-mode edv (spec §2.3) — judge evidence, statics, and assembly.

Pins the binding-science constraints in code:
  - the per-pair method fit is STRICTLY per pair (W2: cross-language
    transfer is not licensed — a cross-pair pollution test enforces it);
  - scores enter only as orderings/separations, never probabilities;
  - the empty-board seed never borrows a neighbor's number.
"""
from __future__ import annotations

import importlib.util
import math
import random
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ARENA_ROOT / "scripts" / "generate_sweep_queue.py"


@pytest.fixture(scope="module")
def q():
    spec = importlib.util.spec_from_file_location(
        "generate_sweep_queue_edv", SCRIPT,
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _run(token, model, cond, s, n=100, ci=None):
    return {"token": token, "model": model, "condition": cond,
            "strength": s, "n_eval": n, "ci_half": ci,
            "submitted_at": "2026-08-27T00:00:00Z"}


# ---------------------------------------------------------------------------
# als_additive_rank — the licensed within-language adjustment
# ---------------------------------------------------------------------------

class TestAlsAdditiveRank:
    def test_recovers_additive_structure_with_missing_cell(self, q):
        # Truth: ability A=0.6, B=0.4; difficulty c1=+0.1, c2=-0.1.
        # B is missing on c2 (the unbalanced-mask case W2 proved).
        cells = {
            ("A", "c1"): 0.7, ("A", "c2"): 0.5,
            ("B", "c1"): 0.5,
        }
        a = q.als_additive_rank(cells)
        assert a["A"] > a["B"]

    def test_difficulty_confound_corrected(self, q):
        # B only ran on the EASY corpus and got a higher raw mean than A's
        # mixed diet — the raw mean misranks; the additive fit does not.
        cells = {
            ("A", "hard"): 0.40, ("A", "easy"): 0.80,   # ability 0.60
            ("B", "easy"): 0.70,                          # ability 0.50
            ("C", "hard"): 0.30, ("C", "easy"): 0.70,   # anchors both
        }
        a = q.als_additive_rank(cells)
        assert a["A"] > a["B"], "difficulty adjustment must correct the easy-diet confound"

    def test_order_invariant_to_intercept_trade(self, q):
        cells = {("A", "c1"): 0.9, ("B", "c1"): 0.3,
                 ("A", "c2"): 0.8, ("B", "c2"): 0.2}
        a = q.als_additive_rank(cells)
        assert sorted(a, key=lambda m: -a[m]) == ["A", "B"]


# ---------------------------------------------------------------------------
# judge lanes + evidence
# ---------------------------------------------------------------------------

class TestJudgeEvidence:
    def test_lane_mapping(self, q):
        assert q._judge_lane("coached") == "coached"
        assert q._judge_lane("naive") == "base"
        assert q._judge_lane("engine") == "base"
        assert q._judge_lane(None) == "base"

    def test_contrast_states(self, q):
        tp = {"c1": ("eng", "deu"), "c2": ("eng", "deu")}
        # A vs B on c1: tight CIs, big gap -> decided.
        # A vs C on c2: tiny gap -> contested.  A vs D: never share -> unmet.
        results = [
            _run("c1", "A", "naive", 0.80, n=400),
            _run("c1", "B", "naive", 0.40, n=400),
            _run("c2", "A", "naive", 0.60, n=400),
            _run("c2", "C", "naive", 0.61, n=400),
        ]
        j = q.build_judge_evidence(results, tp)
        e = frozenset(("eng", "deu"))
        ab = j["contrast_state"][(e, "base", frozenset(("A", "B")))]
        ac = j["contrast_state"][(e, "base", frozenset(("A", "C")))]
        assert ab["state"] == "decided" and ab["n_dec"] == 1
        assert ac["state"] == "contested"
        assert (e, "base", frozenset(("A", "D"))) not in j["contrast_state"]

    def test_rank_basis_selection(self, q):
        tp = {"c1": ("eng", "deu"), "c2": ("eng", "deu"),
              "x1": ("eng", "fra")}
        results = [
            # eng>deu: 2 methods x 2 corpora -> ALS
            _run("c1", "A", "naive", 0.7), _run("c1", "B", "naive", 0.5),
            _run("c2", "A", "naive", 0.6), _run("c2", "B", "naive", 0.4),
            # eng>fra: 2 methods x 1 corpus -> raw-mean
            _run("x1", "A", "naive", 0.6), _run("x1", "B", "naive", 0.5),
        ]
        j = q.build_judge_evidence(results, tp)
        assert j["rank_basis"][(frozenset(("eng", "deu")), "base")] == "als-adjusted"
        assert j["rank_basis"][(frozenset(("eng", "fra")), "base")] == "raw-mean"
        assert j["method_rank"][(frozenset(("eng", "deu")), "base")]["A"] == 1

    def test_cross_pair_pollution_forbidden(self, q):
        """W2 pin: evidence on one pair must not move another pair's
        ranking or contrast states."""
        tp = {"c1": ("eng", "deu"), "y1": ("eng", "yor"), "y2": ("eng", "yor")}
        base_results = [
            _run("y1", "A", "naive", 0.5), _run("y1", "B", "naive", 0.45),
            _run("y2", "A", "naive", 0.4), _run("y2", "B", "naive", 0.35),
        ]
        j_before = q.build_judge_evidence(base_results, tp)
        flood = base_results + [
            _run("c1", "B", "naive", 0.99, n=10_000),  # B dominates eng>deu
        ]
        j_after = q.build_judge_evidence(flood, tp)
        e_yor = (frozenset(("eng", "yor")), "base")
        assert j_before["method_rank"][e_yor] == j_after["method_rank"][e_yor]
        yor_states_b = {k: v for k, v in j_before["contrast_state"].items()
                        if k[0] == frozenset(("eng", "yor"))}
        yor_states_a = {k: v for k, v in j_after["contrast_state"].items()
                        if k[0] == frozenset(("eng", "yor"))}
        assert yor_states_b == yor_states_a

    def test_cond_counts(self, q):
        tp = {"c1": ("eng", "deu")}
        results = [
            _run("c1", "A", "naive", 0.5),
            _run("c1", "A", "coached", 0.6),
        ]
        j = q.build_judge_evidence(results, tp)
        assert j["cond_counts"][(frozenset(("eng", "deu")), "A")] == 1


# ---------------------------------------------------------------------------
# judge_static_value
# ---------------------------------------------------------------------------

def _judge_of(q, results, tp):
    return q.build_judge_evidence(results, tp)


class TestJudgeStaticValue:
    def _value(self, q, judge, *, token="c1", pair=("eng", "deu"),
               lane="base", model="M", s_hat=0.5, n=100, quality=1.0, m_c=3):
        return q.judge_static_value(
            token=token, pair=frozenset(pair), lane=lane, model=model,
            s_hat=s_hat, n_entries=n, corpus_quality=quality,
            m_corpus=m_c, judge=judge)

    def test_empty_board_seed_only(self, q):
        judge = _judge_of(q, [], {})
        j, contrasts, basis = self._value(q, judge, m_c=3, quality=0.8)
        assert j == pytest.approx(q.JUDGE_SEED * 1.0 * 0.8)
        assert contrasts == [] and basis == "none"

    def test_seed_scales_with_venue_size(self, q):
        judge = _judge_of(q, [], {})
        j1, _, _ = self._value(q, judge, m_c=1)
        j3, _, _ = self._value(q, judge, m_c=3)
        j9, _, _ = self._value(q, judge, m_c=9)
        assert j1 < j3 == j9  # min(1, m/3) saturates

    def test_first_contrast_beats_decided(self, q):
        tp = {"c1": ("eng", "deu"), "c9": ("eng", "deu")}
        # A vs B decided on c9; C has never met A anywhere.
        results = [
            _run("c1", "A", "naive", 0.50, n=400),
            _run("c9", "A", "naive", 0.90, n=400),
            _run("c9", "B", "naive", 0.30, n=400),
        ]
        judge = _judge_of(q, results, tp)
        # Candidate M=B on c1 -> {A,B} already decided -> small credit.
        j_dec, cons_dec, _ = self._value(q, judge, model="B", m_c=0)
        # Candidate M=C on c1 -> {A,C} unmet -> first-contrast credit.
        j_first, cons_first, _ = self._value(q, judge, model="C", m_c=0)
        assert j_first > j_dec
        assert cons_first[0]["kind"] == "first"
        assert cons_dec[0]["kind"] == "decided"

    def test_contested_credit_clipped_by_predicted_separation(self, q):
        tp = {"c1": ("eng", "deu"), "c2": ("eng", "deu")}
        results = [
            _run("c1", "A", "naive", 0.50, n=400),
            _run("c1", "B", "naive", 0.51, n=400),   # contested on c1
            _run("c2", "A", "naive", 0.50, n=400),
        ]
        judge = _judge_of(q, results, tp)
        # B on c2 against A: contested; predicted far apart -> near-full 0.8
        j_far, cons_far, _ = self._value(
            q, judge, token="c2", model="B", s_hat=0.95, n=400, m_c=0)
        # predicted identical -> zero contested credit
        j_near, _, _ = self._value(
            q, judge, token="c2", model="B", s_hat=0.50, n=400, m_c=0)
        assert j_far > j_near
        assert cons_far[0]["kind"] == "contested"

    def test_condition_contrast_credit(self, q):
        tp = {"c1": ("eng", "deu")}
        results = [_run("c1", "A", "naive", 0.5)]
        judge = _judge_of(q, results, tp)
        # Coached candidate for the same (corpus, method): base run exists.
        j, contrasts, _ = self._value(
            q, judge, lane="coached", model="A", m_c=0)
        kinds = [c["kind"] for c in contrasts]
        assert "condition" in kinds
        assert j == pytest.approx(q.JUDGE_COND / 1.0)

    def test_gamma_diminishing_returns(self, q):
        tp = {"c1": ("eng", "deu")}
        results = [
            _run("c1", "A", "naive", 0.9, n=400),
            _run("c1", "B", "naive", 0.5, n=400),
            _run("c1", "C", "naive", 0.1, n=400),
        ]
        judge = _judge_of(q, results, tp)
        j, contrasts, _ = self._value(q, judge, model="M", s_hat=0.5, m_c=0)
        gs = sorted((c["g"] for c in contrasts if c["kind"] != "condition"),
                    reverse=True)
        expected = sum(g * q.JUDGE_GAMMA ** k for k, g in enumerate(gs))
        assert j == pytest.approx(expected)


# ---------------------------------------------------------------------------
# edv_value_order — assembly
# ---------------------------------------------------------------------------

def _edv_item(i, *, pair="eng>deu", model="m/a", cond="naive", cost=0.1,
              judge=0.0, mesh=0.0, ps=0.5, basis="global", runs=0,
              contamination="LOW", domain="conv"):
    return {
        "id": f"it-{i:03d}",
        "language_pair": pair,
        "corpus_id": f"corpus-{i:03d}",
        "model": model,
        "condition": cond,
        "est_cost_usd": cost,
        "contamination": contamination,
        "domain": domain,
        "entry_count": 100,
        "judge_static": judge,
        "expected_mesh_gain": mesh,
        "predicted_strength": ps,
        "prior_basis": basis,
        "edge_runs": runs,
    }


def _brute_force_edv(q, items, weights=None):
    """Reference: full greedy recompute at every step."""
    w = dict(q.EDV_DEFAULT_WEIGHTS)
    if weights:
        w.update(weights)
    j_st = [it.get("judge_static") or 0.0 for it in items]
    m_st = [it.get("expected_mesh_gain") or 0.0 for it in items]

    def survey(it):
        unc = q.map_uncertainty(it.get("prior_basis"), it.get("edge_runs") or 0)
        promise = max(it.get("predicted_strength") or q.S0_FALLBACK,
                      q.MAP_PROMISE_FLOOR)
        n = it.get("entry_count") or 0
        quality = min(1.0, n / q.RELIABILITY_N_FULL) if n else 1.0
        return unc * promise * 1.0 * quality

    s_st = [survey(it) for it in items]
    n_j, n_m, n_s = q._p95(j_st), q._p95(m_st), q._p95(s_st)
    jh = [min(v / n_j, q.EDV_NORM_CAP) for v in j_st]
    mh = [min(v / n_m, q.EDV_NORM_CAP) for v in m_st]
    sh = [min(v / n_s, q.EDV_NORM_CAP) for v in s_st]

    counters = {"pair": {}, "tgt": {}, "fam": {}, "cell": {}, "dom": {},
                "judge": {}}

    def value(i, it):
        tgt = it["language_pair"].split(">")[1]
        fam = q.language_family(tgt)
        nov = (1.0 / (1.0 + counters["pair"].get(it["language_pair"], 0))
               * (1.0 + counters["tgt"].get(tgt, 0)) ** -0.5
               * (1.0 + counters["fam"].get(fam, 0)) ** -0.5
               * (1.0 + counters["cell"].get((it["model"], fam), 0)) ** -0.5
               * (1.0 + counters["dom"].get((tgt, it.get("domain") or "unknown"), 0)) ** -0.5)
        jd = 1.0 / (1.0 + counters["judge"].get(
            (it["language_pair"], q._judge_lane(it.get("condition"))), 0))
        contam = q.contamination_ecv_factor(it.get("contamination"))
        cost = max(it["est_cost_usd"], q.COST_FLOOR)
        return (w["judge"] * jh[i] * jd + w["mesh"] * mh[i]
                + w["survey"] * sh[i] * nov) * contam / cost

    remaining = list(range(len(items)))
    order = []
    while remaining:
        best = min(remaining, key=lambda i: (
            -value(i, items[i]), q._map_tiebreak(items[i]), i))
        it = items[best]
        tgt = it["language_pair"].split(">")[1]
        fam = q.language_family(tgt)
        counters["pair"][it["language_pair"]] = counters["pair"].get(it["language_pair"], 0) + 1
        counters["tgt"][tgt] = counters["tgt"].get(tgt, 0) + 1
        counters["fam"][fam] = counters["fam"].get(fam, 0) + 1
        counters["cell"][(it["model"], fam)] = counters["cell"].get((it["model"], fam), 0) + 1
        counters["dom"][(tgt, it.get("domain") or "unknown")] = counters["dom"].get((tgt, it.get("domain") or "unknown"), 0) + 1
        jk = (it["language_pair"], q._judge_lane(it.get("condition")))
        counters["judge"][jk] = counters["judge"].get(jk, 0) + 1
        order.append(it["id"])
        remaining.remove(best)
    return order


class TestEdvValueOrder:
    def test_empty(self, q):
        out, params = q.edv_value_order([])
        assert out == [] and params["normalizers"] is None

    def test_lazy_matches_brute_force(self, q):
        rng = random.Random(20260827)
        pairs = ["eng>deu", "eng>yor", "fra>bam", "jpn>ain", "eng>deu"]
        items = [
            _edv_item(
                i,
                pair=rng.choice(pairs),
                model=rng.choice(["m/a", "m/b", "m/c"]),
                cond=rng.choice(["naive", "coached"]),
                cost=rng.choice([0.01, 0.1, 1.0]),
                judge=rng.random(),
                mesh=rng.random() * 1e-5,
                ps=rng.random(),
                basis=rng.choice(["pair", "target-language", "global"]),
                runs=rng.randint(0, 3),
                contamination=rng.choice(["LOW", "MEDIUM", "HIGH"]),
                domain=rng.choice(["conv", "news"]),
            )
            for i in range(40)
        ]
        expected = _brute_force_edv(q, [dict(it) for it in items])
        ordered, _ = q.edv_value_order([dict(it) for it in items])
        assert [it["id"] for it in ordered] == expected

    def test_rank_rederivable_from_diagnostics(self, q):
        items = [
            _edv_item(i, judge=0.5 * i, mesh=1e-6 * i, cost=0.05 + 0.01 * i)
            for i in range(12)
        ]
        ordered, params = q.edv_value_order(items)
        w = params["weights"]
        for it in ordered:
            contam = q.contamination_ecv_factor(it["contamination"])
            cost = max(it["est_cost_usd"], q.COST_FLOOR)
            v = (
                w["judge"] * it["edv_judge_norm"]
                / (1.0 + it["edv_judge_decay_n"])
                + w["mesh"] * it["edv_mesh_norm"]
                + w["survey"] * it["edv_survey_norm"] * it["edv_novelty"]
            ) * contam / cost
            assert v == pytest.approx(it["edv_value"], rel=1e-6, abs=1e-12)

    def test_weights_echoed_and_dialable(self, q):
        items = [_edv_item(i, judge=1.0) for i in range(3)]
        _, params = q.edv_value_order(items, {"judge": 0.9, "mesh": 0.05,
                                              "survey": 0.05})
        assert params["weights"]["judge"] == 0.9
        assert params["version"] == "edv-v1"

    def test_judge_decay_spreads_pairs(self, q):
        # 3 high-judge items on one pair vs 1 modest item on another:
        # after two placements on the hot pair, the cold pair must appear.
        items = [
            _edv_item(0, pair="eng>deu", judge=1.0),
            _edv_item(1, pair="eng>deu", judge=1.0),
            _edv_item(2, pair="eng>deu", judge=1.0),
            _edv_item(3, pair="eng>yor", judge=0.55),
        ]
        ordered, _ = q.edv_value_order(items)
        assert "it-003" in [it["id"] for it in ordered[:3]]

    def test_contamination_gates_rank_once(self, q):
        # Identical items except contamination: LOW must outrank HIGH.
        items = [
            _edv_item(0, judge=1.0, contamination="HIGH"),
            _edv_item(1, pair="fra>bam", judge=1.0, contamination="LOW"),
        ]
        ordered, _ = q.edv_value_order(items)
        assert ordered[0]["id"] == "it-001"


class TestFirstReadingBoost:
    def test_map_static_multiplies_first_reading(self, q):
        base = _edv_item(0)
        boosted = dict(_edv_item(1))
        boosted["map_first_reading"] = q.MAP_FIRST_READING_BOOST
        v0 = q._map_static_part(base)
        v1 = q._map_static_part(boosted)
        assert v1 == pytest.approx(v0 * q.MAP_FIRST_READING_BOOST)

    def test_edv_survey_multiplies_first_reading(self, q):
        plain = _edv_item(0, judge=0.0, mesh=0.0)
        first = _edv_item(1, pair="fra>bam", judge=0.0, mesh=0.0)
        first["map_first_reading"] = q.MAP_FIRST_READING_BOOST
        ordered, _ = q.edv_value_order([dict(plain), dict(first)])
        assert ordered[0]["id"] == "it-001"
