"""Tests for scripts/generate_sweep_queue.py — mesh-chaining queue priority.

The script is stdlib-only and not a package; it is imported here via
importlib so its eligibility and graph functions can be tested directly.
Includes the parity test pinning its graph_efficiency against the
corpora-builder implementation (the two are deliberately duplicated so
the script stays dependency-free — this test is what keeps them honest).
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ARENA_ROOT / "scripts" / "generate_sweep_queue.py"
CORPORA_BUILDER = ARENA_ROOT / "scripts" / "corpora-builder"


@pytest.fixture(scope="module")
def queue_mod():
    spec = importlib.util.spec_from_file_location(
        "generate_sweep_queue", SCRIPT,
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# Eligibility
# ---------------------------------------------------------------------------

def _ds(**over):
    base = {
        "id": "tatoeba-aaa-bbb-dev",
        "access": "local",
        "segment": "development",
        "license": "CC-BY-2.0",
        "path": "curated/aaa-bbb-dev-v1.json",
        "size": 100,
        "language_pair": {"source": "aaa", "target": "bbb"},
    }
    base.update(over)
    # build_registry stamps every real entry (Position 4 v2); the doctrine
    # gate fails LOUD on a missing stamp, so fixtures synthesize a
    # benchmark-eligible identity stamp from the (possibly overridden)
    # language_pair unless a test provides its own.
    if "language_resolution" not in base:
        lp = base.get("language_pair") or {}
        base["language_resolution"] = {
            "source": {"resolved": lp.get("source"), "scope": "individual",
                       "script": None, "via": None},
            "target": {"resolved": lp.get("target"), "scope": "individual",
                       "script": None, "via": None},
            "benchmark_eligible": True,
            "exclusion_reasons": [],
        }
    return base


class TestQueueCorpora:
    def test_local_dev_corpus_eligible(self, queue_mod):
        assert queue_mod.queue_corpora({"datasets": [_ds()]}) != []

    def test_fetch_from_source_with_export_eligible(self, queue_mod):
        ds = _ds(access="fetch-from-source",
                 source_export={"builder": "tatoeba-challenge"})
        assert queue_mod.queue_corpora({"datasets": [ds]}) != []

    def test_fetch_from_source_without_export_excluded(self, queue_mod):
        ds = _ds(access="fetch-from-source")
        assert queue_mod.queue_corpora({"datasets": [ds]}) == []

    def test_nc_license_excluded_even_with_export(self, queue_mod):
        ds = _ds(access="fetch-from-source",
                 license="CC BY-NC-SA 4.0",
                 source_export={"builder": "edtekla"})
        assert queue_mod.queue_corpora({"datasets": [ds]}) == []

    def test_quarantined_excluded(self, queue_mod):
        assert queue_mod.queue_corpora(
            {"datasets": [_ds(quarantine=True)]}
        ) == []

    def test_non_development_excluded(self, queue_mod):
        assert queue_mod.queue_corpora(
            {"datasets": [_ds(segment=None)]}
        ) == []

    def test_local_only_excluded(self, queue_mod):
        assert queue_mod.queue_corpora(
            {"datasets": [_ds(access="local-only")]}
        ) == []

    def test_consent_required_license_excluded(self, queue_mod):
        # LicenseRef-* without a founder data-side pin resolves
        # consent-required (transmission_policy SSOT) — remote evaluation
        # refuses, so the corpus never enters the public queue (founder
        # ruling 2026-07-19).
        ds = _ds(license="LicenseRef-TWB-Gamayun")
        assert queue_mod.queue_corpora({"datasets": [ds]}) == []

    def test_explicit_consent_required_pin_excluded(self, queue_mod):
        # A data-side transmission_policy="consent-required" pin excludes
        # even an otherwise-eligible license string.
        ds = _ds(transmission_policy="consent-required",
                 license="LicenseRef-Somewhere-Custom")
        assert queue_mod.queue_corpora({"datasets": [ds]}) == []

    def test_no_train_pinned_licenseref_stays_eligible(self, queue_mod):
        # The WMT shape: LicenseRef + founder-pinned no-train — queueable
        # (the item then carries the transmission stamp).
        ds = _ds(license="LicenseRef-WMT-Research-Use",
                 transmission_policy="no-train")
        assert queue_mod.queue_corpora({"datasets": [ds]}) != []


# ---------------------------------------------------------------------------
# Transmission stamp (per-item no-train disclosure, 2026-07-19)
# ---------------------------------------------------------------------------

class TestTransmissionStamp:
    def test_cleared_corpus_unstamped(self, queue_mod):
        # The common case stays field-free — no per-item bloat.
        assert queue_mod.transmission_stamp(_ds()) is None

    def test_no_train_pinned_corpus_stamp_shape(self, queue_mod):
        ds = _ds(license="LicenseRef-WMT-Research-Use",
                 transmission_policy="no-train")
        stamp = queue_mod.transmission_stamp(ds)
        assert stamp is not None
        assert stamp["policy"] == "no-train"
        # The wire contract donors/custom clients copy verbatim — the
        # OpenRouter request-body preference (transmission_policy SSOT).
        assert stamp["openrouter_provider_prefs"] == {
            "data_collection": "deny"
        }
        assert "no-train" in stamp["reason"]
        assert "retain or train" in stamp["notice"]

    def test_stamp_not_in_published_drop_fields(self, queue_mod):
        # The stamp must SURVIVE into the published work-list and the
        # preview — dropping it would defeat the disclosure.
        assert "transmission" not in queue_mod._PUBLISHED_DROP_FIELDS
        item = {"id": "x", "transmission": {"policy": "no-train"}}
        assert "transmission" in queue_mod.slim_published_item(item)


# ---------------------------------------------------------------------------
# Chaining priority
# ---------------------------------------------------------------------------

class TestChainingGains:
    def _corpora(self):
        """Hub eng-{aaa,bbb} plus isolated pair ccc-ddd.

        With eng-aaa and eng-bbb covered, the corpus closing aaa-bbb is
        a shortcut inside the main component, while ccc-ddd joins a
        disconnected component — the join must outrank the shortcut.
        """
        return [
            _ds(id="cov-a", path="curated/cov-a.json",
                language_pair={"source": "eng", "target": "aaa"}),
            _ds(id="cov-b", path="curated/cov-b.json",
                language_pair={"source": "eng", "target": "bbb"}),
            _ds(id="shortcut", path="curated/shortcut.json",
                language_pair={"source": "aaa", "target": "bbb"}),
            _ds(id="join", path="curated/join.json",
                language_pair={"source": "ccc", "target": "ddd"}),
        ]

    def test_covered_edges_gain_zero(self, queue_mod):
        gains = queue_mod.chaining_gains(self._corpora(), {"cov-a", "cov-b"})
        assert gains["cov-a"] == 0.0
        assert gains["cov-b"] == 0.0

    def test_component_join_outranks_shortcut(self, queue_mod):
        gains = queue_mod.chaining_gains(self._corpora(), {"cov-a", "cov-b"})
        assert gains["join"] > gains["shortcut"] > 0.0

    def test_offline_empty_coverage_degrades_uniformly(self, queue_mod):
        gains = queue_mod.chaining_gains(self._corpora(), set())
        # every edge is the first edge of an empty graph → equal value,
        # ordering falls through to the size/cost tiebreakers
        assert len({round(g, 12) for g in gains.values()}) == 1

    def test_exact_efficiency_value(self, queue_mod):
        nodes = ["a", "b", "c"]
        edges = {frozenset(("a", "b")), frozenset(("b", "c"))}
        assert queue_mod.graph_efficiency(nodes, edges) == pytest.approx(5 / 6)


# ---------------------------------------------------------------------------
# Expected-chain-value v2 (spec: specifications/queue-construction.md)
# ---------------------------------------------------------------------------

class TestChainMatrix:
    def test_known_path_graph(self, queue_mod):
        strengths = {frozenset(("a", "b")): 0.8, frozenset(("b", "c")): 0.5}
        Q = queue_mod.build_chain_matrix(["a", "b", "c"], strengths, lam=0.9)
        assert Q["a"]["a"] == 1.0
        assert Q["a"]["b"] == pytest.approx(0.8)
        # two hops: one junction discount — 0.9 · 0.8 · 0.5
        assert Q["a"]["c"] == pytest.approx(0.9 * 0.8 * 0.5)

    def test_disconnected_is_zero(self, queue_mod):
        Q = queue_mod.build_chain_matrix(
            ["a", "b", "c"], {frozenset(("a", "b")): 0.8}, lam=0.9,
        )
        assert Q["a"]["c"] == 0.0

    def test_best_path_wins_over_more_hops(self, queue_mod):
        # a-b-c chain (0.9·0.9·0.9 = 0.729) vs direct a-c at 0.7
        strengths = {
            frozenset(("a", "b")): 0.9,
            frozenset(("b", "c")): 0.9,
            frozenset(("a", "c")): 0.7,
        }
        Q = queue_mod.build_chain_matrix(["a", "b", "c"], strengths, lam=0.9)
        assert Q["a"]["c"] == pytest.approx(0.9 * 0.9 * 0.9)


class TestSingleEdgeGain:
    def _phi(self, queue_mod, nodes, strengths, lam):
        Q = queue_mod.build_chain_matrix(nodes, strengths, lam=lam)
        n = len(nodes)
        return sum(Q[u][v] for u in nodes for v in nodes if u != v) / (n * (n - 1))

    @pytest.mark.parametrize("upgrade,s_new", [
        (("a", "c"), 0.6),    # new edge inside a component
        (("c", "d"), 0.5),    # component join
        (("a", "b"), 0.95),   # upgrade of an existing edge
    ])
    def test_closed_form_matches_rebuild(self, queue_mod, upgrade, s_new):
        nodes = ["a", "b", "c", "d", "e"]
        strengths = {
            frozenset(("a", "b")): 0.8,
            frozenset(("b", "c")): 0.6,
            frozenset(("d", "e")): 0.7,
        }
        lam = 0.9
        Q = queue_mod.build_chain_matrix(nodes, strengths, lam=lam)
        gain = queue_mod.single_edge_gain(
            nodes, Q, upgrade[0], upgrade[1], s_new, lam=lam,
        )
        upgraded = dict(strengths)
        key = frozenset(upgrade)
        upgraded[key] = max(upgraded.get(key, 0.0), s_new)
        rebuilt = (
            self._phi(queue_mod, nodes, upgraded, lam)
            - self._phi(queue_mod, nodes, strengths, lam)
        )
        assert gain == pytest.approx(rebuilt, abs=1e-12)

    def test_junction_discount_rewards_direct_measurement(self, queue_mod):
        # Chain a-b-c composes to 0.8·0.8 = 0.64; with λ = 0.9 the
        # estimated chain is 0.576, so a measured direct 0.6 adds value.
        # With λ = 1 the chain (0.64) already beats 0.6 — no value.
        nodes = ["a", "b", "c"]
        strengths = {frozenset(("a", "b")): 0.8, frozenset(("b", "c")): 0.8}
        Q9 = queue_mod.build_chain_matrix(nodes, strengths, lam=0.9)
        Q1 = queue_mod.build_chain_matrix(nodes, strengths, lam=1.0)
        assert queue_mod.single_edge_gain(nodes, Q9, "a", "c", 0.6, lam=0.9) > 0
        assert queue_mod.single_edge_gain(nodes, Q1, "a", "c", 0.6, lam=1.0) == 0

    def test_weaker_prediction_adds_nothing(self, queue_mod):
        nodes = ["a", "b"]
        strengths = {frozenset(("a", "b")): 0.7}
        Q = queue_mod.build_chain_matrix(nodes, strengths, lam=0.9)
        assert queue_mod.single_edge_gain(nodes, Q, "a", "b", 0.5, lam=0.9) == 0.0


def _results(*rows):
    return [
        {"token": t, "model": m, "condition": c, "strength": s}
        for t, m, c, s in rows
    ]


def _datasets():
    return [
        _ds(id="ds-ab", path="curated/ab.json",
            language_pair={"source": "aaa", "target": "bbb"}),
        _ds(id="ds-ac", path="curated/ac.json",
            language_pair={"source": "aaa", "target": "ccc"}),
        # NC corpus: not queueable, but its results are still evidence.
        _ds(id="ds-nc", path="curated/nc.json",
            license="CC BY-NC-SA 4.0",
            language_pair={"source": "aaa", "target": "ddd"}),
    ]


class TestEvidence:
    def test_edge_strength_is_max_and_nc_counts(self, queue_mod):
        ev = queue_mod.build_evidence(_datasets(), _results(
            ("ds-ab", "m1", "naive", 0.5),
            ("ds-ab", "m2", "naive", 0.7),
            ("ds-nc", "m1", "naive", 0.9),
        ))
        assert ev["edge_strength"][frozenset(("aaa", "bbb"))] == 0.7
        assert ev["edge_strength"][frozenset(("aaa", "ddd"))] == 0.9
        assert ev["n_results"] == 3

    def test_model_offsets_two_way(self, queue_mod):
        # m2 beats m1 by 0.2 on the only shared pair.
        ev = queue_mod.build_evidence(_datasets(), _results(
            ("ds-ab", "m1", "naive", 0.5),
            ("ds-ab", "m2", "naive", 0.7),
        ))
        assert sum(ev["model_deltas"]["m2"]) == pytest.approx(0.2)
        assert sum(ev["model_deltas"]["m1"]) == pytest.approx(-0.2)

    def test_condition_deltas_stay_local(self, queue_mod):
        ev = queue_mod.build_evidence(_datasets(), _results(
            ("ds-ab", "m1", "naive", 0.5),
            ("ds-ab", "m1", "coached", 0.6),
        ))
        e = frozenset(("aaa", "bbb"))
        assert ev["cond_deltas_pair"][e] == [pytest.approx(0.1)]
        assert ev["cond_deltas_target"]["bbb"] == [pytest.approx(0.1)]
        assert "ccc" not in ev["cond_deltas_target"]


class TestPredictStrength:
    def _ev(self, queue_mod, rows):
        return queue_mod.build_evidence(_datasets(), _results(*rows))

    def test_backoff_chain(self, queue_mod):
        ev = self._ev(queue_mod, [("ds-ab", "m1", "naive", 0.6)])
        # pair evidence exists for aaa>bbb
        p = queue_mod.predict_strength(("aaa", "bbb"), "mX", "naive", ev)
        assert p["prior_basis"] == "pair" and p["pair_prior"] == 0.6
        # aaa>ccc: no pair or target evidence → source-language mean
        p = queue_mod.predict_strength(("aaa", "ccc"), "mX", "naive", ev)
        assert p["prior_basis"] == "source-language"
        # zzz>yyy: nothing matches → global mean of all results
        p = queue_mod.predict_strength(("zzz", "yyy"), "mX", "naive", ev)
        assert p["prior_basis"] == "global"
        # no results at all → documented default
        empty = queue_mod.build_evidence(_datasets(), [])
        p = queue_mod.predict_strength(("zzz", "yyy"), "mX", "naive", empty)
        assert p["prior_basis"] == "default"
        assert p["pair_prior"] == queue_mod.S0_FALLBACK

    def test_bonus_decays_with_observations(self, queue_mod):
        rows = [("ds-ab", "m1", "naive", 0.6)] * 9
        ev = self._ev(queue_mod, rows)
        seen = queue_mod.predict_strength(("aaa", "bbb"), "m1", "naive", ev)
        unseen = queue_mod.predict_strength(("aaa", "bbb"), "mX", "naive", ev)
        assert unseen["exploration_bonus"] > seen["exploration_bonus"] > 0

    def test_prediction_capped(self, queue_mod):
        ev = self._ev(queue_mod, [("ds-ab", "m1", "naive", 0.94)])
        p = queue_mod.predict_strength(("aaa", "bbb"), "mX", "naive", ev)
        assert p["predicted_strength"] <= queue_mod.S_CAP


# ---------------------------------------------------------------------------
# Reliability layer (ecv-v3): bridges are (quality, reliability)
# ---------------------------------------------------------------------------

class TestReliability:
    def test_founders_case_is_not_a_path(self, queue_mod):
        # 62 single-word vocabulary items, one run, wide CI
        f = queue_mod.reliability_factors(62, 1.0, 8.0, 1)
        assert f["r"] == pytest.approx(0.62 * 0.2 * 0.625 * 0.5, abs=1e-3)
        assert f["r"] < 0.05

    def test_established_bridge_reaches_full_reliability(self, queue_mod):
        f = queue_mod.reliability_factors(200, 8.0, 3.0, 3)
        assert f["r"] == 1.0

    def test_vocab_list_can_never_be_established(self, queue_mod):
        # f_rich caps r at 0.2·(everything else) for one-word entries
        f = queue_mod.reliability_factors(10_000, 1.0, 1.0, 50)
        assert f["r"] <= 0.2
        assert queue_mod.bridge_tier(10_000, 1.0, 1.0, 50) == "provisional"

    def test_missing_richness_is_neutral(self, queue_mod):
        with_rich = queue_mod.reliability_factors(100, 8.0, 4.0, 2)["r"]
        without = queue_mod.reliability_factors(100, None, 4.0, 2)["r"]
        assert without == pytest.approx(with_rich)

    def test_ci_proxy_matches_policy_anchor(self, queue_mod):
        # ±5 at n=100, 1/sqrt(n) scaling
        assert queue_mod._ci_half_proxy(100) == pytest.approx(5.0)
        assert queue_mod._ci_half_proxy(25) == pytest.approx(10.0)

    def test_tiers(self, queue_mod):
        assert queue_mod.bridge_tier(0, None, None, 0) == "registered"
        assert queue_mod.bridge_tier(120, 8.0, 4.0, 2) == "established"
        assert queue_mod.bridge_tier(120, 8.0, 4.0, 1) == "provisional"
        assert queue_mod.bridge_tier(60, 8.0, 4.0, 2) == "provisional"

    def test_evidence_builds_edge_bridge(self, queue_mod):
        datasets = _datasets()
        datasets[0]["richness"] = {"mean_effective_words": 8.0}
        datasets[0]["size"] = 100
        rows = [
            {"token": "ds-ab", "model": "m1", "condition": "naive",
             "strength": 0.5, "n_eval": 100, "ci_half": 4.0},
            {"token": "ds-ab", "model": "m2", "condition": "naive",
             "strength": 0.6, "n_eval": 100, "ci_half": 3.0},
        ]
        ev = queue_mod.build_evidence(datasets, rows)
        b = ev["edge_bridge"][frozenset(("aaa", "bbb"))]
        assert b["q"] == 0.6                  # best run sets quality
        assert b["runs"] == 2
        assert b["ci_half"] == 3.0            # best run's CI
        assert b["r"] == pytest.approx(1.0)   # 100/8.0/±3/2 runs → full
        assert b["s_eff"] == pytest.approx(0.6)
        assert b["tier"] == "established"

    def test_replication_raises_effective_strength(self, queue_mod):
        """A second run on a single-run edge must increase s_eff even
        with no quality improvement — replications carry priced value."""
        f1 = queue_mod.reliability_factors(120, 8.0, 4.0, 1)
        f2 = queue_mod.reliability_factors(120, 8.0, 4.0, 2)
        q = 0.6
        assert q * f2["r"] > q * f1["r"]


# ---------------------------------------------------------------------------
# Full-board pagination
# ---------------------------------------------------------------------------

class TestFetchPagination:
    def test_reads_every_page_of_a_large_board(self, queue_mod, monkeypatch):
        """A board larger than one page must be read completely.

        Supabase caps single responses; the fetch must keep paging until
        a short page arrives, not trust one capped GET.
        """
        import io

        board = [
            {"dataset_id": f"ds-{i}", "model_slug": "m", "condition": "naive",
             "chrf_plus_plus": 50.0}
            for i in range(2501)
        ]
        requested_offsets = []

        def fake_urlopen(req, timeout=None):
            from urllib.parse import parse_qs, urlparse
            qs = parse_qs(urlparse(req.full_url).query)
            offset = int(qs["offset"][0])
            limit = int(qs["limit"][0])
            requested_offsets.append(offset)
            page = board[offset:offset + limit]

            class FakeResp(io.BytesIO):
                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    return False

            import json as _json
            return FakeResp(_json.dumps(page).encode())

        monkeypatch.setattr(
            queue_mod.urllib.request, "urlopen", fake_urlopen,
        )
        rows = queue_mod._fetch_run_rows(page_size=1000)
        assert len(rows) == 2501
        assert requested_offsets == [0, 1000, 2000]

    def test_single_short_page_stops_immediately(self, queue_mod, monkeypatch):
        import io
        import json as _json

        def fake_urlopen(req, timeout=None):
            class FakeResp(io.BytesIO):
                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    return False

            return FakeResp(_json.dumps([{"dataset_id": "x"}]).encode())

        monkeypatch.setattr(
            queue_mod.urllib.request, "urlopen", fake_urlopen,
        )
        assert len(queue_mod._fetch_run_rows(page_size=1000)) == 1


# ---------------------------------------------------------------------------
# MT-engine lane — coverage gating + never-invent-pricing
# ---------------------------------------------------------------------------

_SHARED = ARENA_ROOT.parent / "shared"


class TestLlmCostEstimate:
    """LLM-lane cost estimates carry the calibrated safety margin.

    Prelaunch-audit datapoint: a real claude-haiku-4.5 queue run cost
    $0.0124 against a $0.0036 raw estimate (3.4x under). Budget mode
    selects items on estimates, so an underestimate is overspend of a
    contributor's donated budget — estimates must land AT OR ABOVE actual.
    """

    def test_multiplier_covers_calibration_datapoint(self, queue_mod):
        """The audit's real run must now be covered with headroom, and
        the margin must stay conservative (~1.5x over, not 2x+)."""
        raw_est, actual = 0.0036, 0.0124
        scaled = raw_est * queue_mod.LLM_COST_SAFETY_MULTIPLIER
        assert scaled >= actual, (
            "safety multiplier no longer covers the 2026-07 calibration run"
        )
        assert scaled <= actual * 2.0, (
            "safety multiplier drifted past the documented ~1.5x headroom"
        )

    def test_observed_estimate_is_scaled_and_says_so(self, queue_mod):
        est, basis = queue_mod.llm_cost_estimate(
            stem="aaa-bbb-dev-v1",
            slug="anthropic/claude-haiku-4.5",
            ds=_ds(),
            observed={("aaa-bbb-dev-v1", "anthropic/claude-haiku-4.5"): 0.0036},
            avg_per_entry={},
            condition="naive",
        )
        assert est == pytest.approx(
            round(0.0036 * queue_mod.LLM_COST_SAFETY_MULTIPLIER, 4)
        )
        assert basis.startswith("observed")
        assert "safety margin" in basis  # the scaling is declared, not silent

    def test_extrapolated_estimate_is_scaled_and_says_so(self, queue_mod):
        est, basis = queue_mod.llm_cost_estimate(
            stem="aaa-bbb-dev-v1",
            slug="anthropic/claude-haiku-4.5",
            ds=_ds(size=200),
            observed={},
            avg_per_entry={"anthropic/claude-haiku-4.5": 0.00002},
            condition="coached",
        )
        assert est == pytest.approx(
            round(0.00002 * 200 * queue_mod.LLM_COST_SAFETY_MULTIPLIER, 4)
        )
        assert basis.startswith("extrapolated")
        assert "safety margin" in basis

    def test_no_sweep_data_stays_null(self, queue_mod):
        """Unknown cost stays None (never $0, never invented)."""
        est, basis = queue_mod.llm_cost_estimate(
            stem="aaa-bbb-dev-v1",
            slug="new-model/no-sweep",
            ds=_ds(),
            observed={},
            avg_per_entry={},
            condition="naive",
        )
        assert est is None
        assert "no sweep data" in basis

    def test_observed_only_applies_to_naive(self, queue_mod):
        """A coached item never reuses the naive observed cost directly —
        it falls through to the per-entry extrapolation."""
        est, basis = queue_mod.llm_cost_estimate(
            stem="aaa-bbb-dev-v1",
            slug="m",
            ds=_ds(size=100),
            observed={("aaa-bbb-dev-v1", "m"): 0.01},
            avg_per_entry={"m": 0.0001},
            condition="coached",
        )
        assert basis.startswith("extrapolated")
        assert est == pytest.approx(
            round(0.0001 * 100 * queue_mod.LLM_COST_SAFETY_MULTIPLIER, 4)
        )


class TestEngineLane:
    def test_lane_loads_and_gates_fail_safe(self, queue_mod):
        """Real shared/ files: engines with a published, non-empty coverage
        list enqueue; everything else is skipped WITH a note (never
        silently absent)."""
        if not (_SHARED / "method-registry.json").is_file():
            pytest.skip("shared/ not present (standalone checkout)")
        lane, notes = queue_mod.load_engine_lane()
        joined = " ".join(notes)
        # translated: empty iso6393 pending the provider list import.
        assert "translated" not in lane
        assert "'translated' skipped" in joined
        registry_entries = json.loads(
            (_SHARED / "method-registry.json").read_text()
        )["entries"]
        # apertium / amazon-translate: no coverage entry → cannot pair-gate.
        assert "apertium" not in lane
        assert "'apertium' skipped" in joined
        assert "amazon-translate" not in lane
        # Engines in the lane have real, non-empty ISO 639-3 sets.
        for eng, langs in lane.items():
            assert langs, f"{eng} entered the lane with an empty set"
            # The lane key IS the method-registry id. There is no longer an
            # ENGINE_COVERAGE_KEYS table translating between two vocabularies —
            # a hand-maintained mapping was how apertium ended up with a runtime
            # adapter and no coverage anywhere.
            assert eng in registry_entries, (
                f"{eng} is in the lane but is not a method-registry id"
            )

    def test_missing_shared_files_degrade_to_empty_lane(
        self, queue_mod, monkeypatch, tmp_path,
    ):
        monkeypatch.setattr(
            queue_mod, "METHOD_REGISTRY_JSON", tmp_path / "absent.json",
        )
        lane, notes = queue_mod.load_engine_lane()
        assert lane == {}
        assert any("engine lane disabled" in n for n in notes)

    def test_unpublished_pricing_is_never_invented(self, queue_mod):
        ds = {"size": 100, "language_pair": {"source": "eng", "target": "lav"}}
        est, basis = queue_mod.engine_cost_estimate(
            "tilde", ds, ({}, None),
        )
        assert est is None
        assert basis == "unpublished"

    def test_self_hosted_is_null_not_zero(self, queue_mod):
        """$0-API self-hosted engines carry null (unknown ≠ free): a 0.0
        would make every such item fit any budget in budget mode."""
        ds = {"size": 100, "language_pair": {"source": "eng", "target": "epo"}}
        est, basis = queue_mod.engine_cost_estimate(
            "libretranslate", ds, ({}, None),
        )
        assert est is None
        assert "self-hosted" in basis

    def test_published_pricing_uses_measured_chars(self, queue_mod):
        ds = {
            "size": 200,
            "language_pair": {"source": "eng", "target": "deu"},
            "richness": {"mean_source_chars": 40.0},
        }
        est, basis = queue_mod.engine_cost_estimate(
            "google-translate", ds, ({}, None),
        )
        # 200 entries × 40 chars = 8,000 chars @ $20/1M = $0.16
        assert est == pytest.approx(0.16)
        assert "measured" in basis

    def test_published_pricing_extrapolates_with_stated_basis(self, queue_mod):
        medians = ({"eng": 40.0}, 30.0)
        ds = {"size": 100, "language_pair": {"source": "eng", "target": "deu"}}
        est, basis = queue_mod.engine_cost_estimate(
            "deepl", ds, medians,
        )
        # 100 × 40 (eng median) = 4,000 chars @ $25/1M = $0.10
        assert est == pytest.approx(0.10)
        assert basis.startswith("extrapolated")
        # No volume estimate anywhere → null, still no invented number.
        est_none, basis_none = queue_mod.engine_cost_estimate(
            "deepl", ds, ({}, None),
        )
        assert est_none is None
        assert "no source-character volume" in basis_none

    def test_rates_match_provider_pricing_js(self, queue_mod):
        """Parity guard: ENGINE_USD_PER_MCHAR mirrors the CLI reference SSOT
        (cli/lib/methods/provider-pricing.js). Skips in a standalone
        harness checkout where cli/ is absent."""
        pricing_js = (
            ARENA_ROOT.parent / "cli" / "lib" / "methods"
            / "provider-pricing.js"
        )
        if not pricing_js.is_file():
            pytest.skip("cli/ not present (standalone checkout)")
        import re
        text = pricing_js.read_text(encoding="utf-8")
        js_rates = {
            m.group(1): float(m.group(2))
            for m in re.finditer(
                r"'([\w-]+)':\s*\{\s*costPerMillionChars:\s*([\d.]+)", text,
            )
        }
        assert js_rates, "failed to parse PROVIDER_RATES from provider-pricing.js"
        assert queue_mod.ENGINE_USD_PER_MCHAR == js_rates

    def test_engine_char_medians(self, queue_mod):
        datasets = [
            {"richness": {"mean_source_chars": 10.0},
             "language_pair": {"source": "cmn", "target": "jpn"}},
            {"richness": {"mean_source_chars": 40.0},
             "language_pair": {"source": "eng", "target": "deu"}},
            {"richness": {"mean_source_chars": 44.0},
             "language_pair": {"source": "eng", "target": "fra"}},
            {"language_pair": {"source": "eng", "target": "zul"}},  # unmeasured
        ]
        by_src, global_median = queue_mod.engine_char_medians(datasets)
        assert by_src["cmn"] == 10.0
        assert by_src["eng"] == 44.0  # median of [40, 44] → upper-middle
        assert global_median == 40.0

    def test_estimate_source_chars_prefers_measured(self, queue_mod):
        medians = ({"eng": 40.0}, 30.0)
        measured = {"size": 10, "language_pair": {"source": "eng"},
                    "richness": {"mean_source_chars": 55.0}}
        chars, how = queue_mod.estimate_source_chars(measured, medians)
        assert (chars, how) == (550.0, "measured")
        by_lang = {"size": 10, "language_pair": {"source": "eng"}}
        assert queue_mod.estimate_source_chars(by_lang, medians) == (
            400.0, "source-language median",
        )
        other = {"size": 10, "language_pair": {"source": "xxx"}}
        assert queue_mod.estimate_source_chars(other, medians) == (
            300.0, "global median",
        )
        no_size = {"language_pair": {"source": "eng"}}
        assert queue_mod.estimate_source_chars(no_size, medians) == (None, None)


# ---------------------------------------------------------------------------
# Parity with the corpora-builder implementation
# ---------------------------------------------------------------------------

class TestEfficiencyParity:
    def test_matches_corpora_builder_on_fixture_graphs(self, queue_mod):
        if not CORPORA_BUILDER.exists():
            pytest.skip("corpora-builder not present (standalone checkout)")
        if str(CORPORA_BUILDER) not in sys.path:
            sys.path.insert(0, str(CORPORA_BUILDER))
        from corpora_builder.probe_tatoeba import (
            graph_efficiency as builder_eff,
        )

        graphs = [
            (["a", "b"], set()),
            (["a", "b", "c"],
             {frozenset(("a", "b")), frozenset(("b", "c"))}),
            (["a", "b", "c", "d", "e"],
             {frozenset(("a", "b")), frozenset(("a", "c")),
              frozenset(("d", "e"))}),
            (list("abcdef"),
             {frozenset(p) for p in
              [("a", "b"), ("b", "c"), ("c", "d"), ("d", "e"),
               ("e", "f"), ("f", "a")]}),
        ]
        for nodes, edges in graphs:
            assert queue_mod.graph_efficiency(nodes, edges) == pytest.approx(
                builder_eff(nodes, edges)
            ), f"implementations diverged on {nodes} / {edges}"


class TestLanePolicy:
    """Founder directive 2026-07-19: the public queue is the LLM lane only,
    restricted to pairs touching at least one language outside every MT
    service's published coverage; engines run as separate campaigns."""

    def test_fully_covered_pair_is_excluded(self, queue_mod):
        covered = frozenset({"eng", "fra", "deu"})
        assert queue_mod.pair_is_fully_service_covered("eng", "fra", covered)

    def test_pair_touching_uncovered_language_survives(self, queue_mod):
        covered = frozenset({"eng", "fra", "deu"})
        assert not queue_mod.pair_is_fully_service_covered("eng", "dtp", covered)
        assert not queue_mod.pair_is_fully_service_covered("dtp", "eng", covered)
        assert not queue_mod.pair_is_fully_service_covered("dtp", "xal", covered)

    def test_empty_coverage_excludes_nothing(self, queue_mod):
        """No coverage data must FAIL OPEN (the whole queue survives),
        never empty the queue."""
        assert not queue_mod.pair_is_fully_service_covered("eng", "fra", frozenset())

    def test_macrolanguage_aliasing_counts_as_covered(self, queue_mod):
        """Coverage lists name macro codes (zho, swa); corpora use the
        individual codes (cmn, swh). Both sides resolve through the
        injected macro map."""
        covered = frozenset({"zho", "nld"})
        macro = {"cmn": "zho"}.get
        assert queue_mod.pair_is_fully_service_covered(
            "nld", "cmn", covered, macro_of=macro)
        assert not queue_mod.pair_is_fully_service_covered(
            "nld", "dtp", covered, macro_of=macro)

    def test_macrolanguage_read_from_real_card(self, queue_mod):
        """The default resolver reads the language card SSOT (cmn → zho)."""
        macro = queue_mod.language_macrolanguage("cmn")
        if macro is None:
            pytest.skip("cmn card lacks macrolanguage locally")
        assert macro == "zho"
        assert queue_mod.pair_is_fully_service_covered(
            "nld", "cmn", frozenset({"zho", "nld"}))


# ---------------------------------------------------------------------------
# Target-language name resolution (script-suffixed + macrolanguage codes)
# ---------------------------------------------------------------------------

class TestTargetLangName:
    """The card → base-code card → ISO 639-3 → Glottolog chain that stopped
    ~100 registry corpora (cmn-Hans WMT/TICO-19/smol sets, sqi/ara
    macrolanguages, retired kzj) from dropping out of the queue as
    'skipped (no language card name)'. The name assertions pin values in
    git-tracked SSOT data files (cards + SIL/Glottolog exports) — they only
    move when that data is deliberately updated."""

    def test_strip_script_suffix_shapes(self, queue_mod):
        assert queue_mod.strip_script_suffix("cmn-Hans") == "cmn"
        assert queue_mod.strip_script_suffix("hoc-Wara") == "hoc"
        assert queue_mod.strip_script_suffix("sat-Latn") == "sat"
        # Not script subtags: bare codes, region subtags, junk.
        assert queue_mod.strip_script_suffix("cmn") is None
        assert queue_mod.strip_script_suffix("ar-EG") is None
        assert queue_mod.strip_script_suffix("") is None

    def _require_repo_data(self, queue_mod):
        if not (queue_mod.CARDS_DIR.is_dir()
                and queue_mod.ISO_639_3_TAB.is_file()
                and queue_mod.GLOTTOLOG_LANGUOID_CSV.is_file()):
            pytest.skip("monorepo data files not present "
                        "(standalone checkout)")

    def test_exact_card_still_wins(self, queue_mod):
        self._require_repo_data(queue_mod)
        assert queue_mod.target_lang_name("cmn") == "Mandarin Chinese"

    def test_script_suffix_resolves_via_base_card(self, queue_mod):
        self._require_repo_data(queue_mod)
        assert queue_mod.target_lang_name("cmn-Hans") == "Mandarin Chinese"
        assert queue_mod.target_lang_name("sat-Latn") == "Santali"

    def test_exact_variant_card_beats_base_card(self, queue_mod):
        # cmn-Hant has its OWN card, so the exact match must be consulted
        # rather than falling back to the cmn base card. That precedence is
        # what this test guards, and it still holds.
        #
        # What CHANGED is the name it returns. This asserted "Chinese
        # (Traditional)", which came from a hand-written variant card in the
        # old corpus. Locale cards are now PROJECTIONS of their language and
        # carry its cited name, because we hold no cited source for a locale
        # display name: CLDR publishes localeDisplayNames in
        # cldr-localenames-full, and we pin cldr-core, whose per-locale files
        # carry only identity and layout. Inventing "Chinese (Traditional)"
        # here would be the curation this rebuild exists to retire.
        #
        # The gap is recorded, not forgotten — shared/cldf/resource-landscape.json,
        # class `localeNames`, verdict known-not-indexed. When that upstream is
        # indexed this assertion should tighten to the CLDR display name.
        self._require_repo_data(queue_mod)
        import json
        from pathlib import Path
        card = Path(queue_mod.CARDS_DIR) / "cmn-Hant.json"
        assert card.is_file(), "cmn-Hant must have its own card for this test to mean anything"
        data = json.loads(card.read_text(encoding="utf-8"))
        assert data.get("locale", {}).get("script") == "Hant", \
            "the exact card is the Traditional-script locale, not the base language"
        # Consulted the exact card: its name is what comes back.
        assert queue_mod.target_lang_name("cmn-Hant") == queue_mod.display(
            data.get("name"), on_disagreement="first")

    def test_macrolanguage_resolves_via_iso_ref_name(self, queue_mod):
        self._require_repo_data(queue_mod)
        # No sqi/ara card exists — the name is the macrolanguage's own
        # ISO 639-3 Ref_Name, never a member language's card name.
        assert queue_mod.target_lang_name("sqi") == "Albanian"
        assert queue_mod.target_lang_name("ara") == "Arabic"

    def test_retired_code_resolves_via_glottolog(self, queue_mod):
        self._require_repo_data(queue_mod)
        assert queue_mod.target_lang_name("kzj") == "Coastal Kadazan"

    def test_unresolvable_codes_stay_none(self, queue_mod):
        self._require_repo_data(queue_mod)
        # ber is an ISO 639-2 collective code: no card, not in ISO 639-3,
        # no Glottolog languoid carries it — fail-safe skip, never a guess.
        assert queue_mod.target_lang_name("ber") is None
        assert queue_mod.target_lang_name("ber-Latn") is None
        assert queue_mod.target_lang_name("zzz-Qaaa") is None


# ---------------------------------------------------------------------------
# DB-as-queue (B1): queue_items_rows parity with the served queue.json items
# ---------------------------------------------------------------------------
# The Python ranker stays the authority but ALSO writes queue_items to the DB.
# This pins the parity contract: a DB row's served scalar fields are byte-equal
# to the queue.json item, and the DB row is a complete SUPERSET (map_value +
# diagnostics carry everything slim_published_item drops or keeps as extras).

def _full_ranked_item(i, **over):
    it = {
        "priority": i,
        "id": f"eval-xxx-yyy-tatoeba-dev-v1__anthropic_claude-m{i}__naive",
        "language_pair": "xxx>yyy",
        "source_language": "Xish",
        "target_language": "Yish",
        "corpus_id": "eval-xxx-yyy-tatoeba-dev-v1",
        "corpus_license": "CC-BY-2.0",
        "entry_count": 100 + i,
        "contamination": "LOW",
        "domain": "conv",
        "source_length": 100 + i,
        "model": f"anthropic/claude-m{i}",
        "condition": "naive",
        "est_cost_usd": round(0.11 * i, 4),
        "est_basis": "extrapolated",
        "run_command": "mt-eval run --corpus eval-xxx-yyy-tatoeba-dev-v1 --yes",
        # map ordering currency + diagnostics (dropped from the served file)
        "map_value": round(0.5 / i, 6),
        "map_novelty": 0.9,
        "map_connectivity": 1.0,
        "map_connectivity_class": "bridge",
        "predicted_strength": 0.6,
        "ecv_per_usd": 1.23,
    }
    it.update(over)
    return it


def test_queue_items_rows_parity_with_served(queue_mod):
    items = [_full_ranked_item(i) for i in range(1, 6)]
    rows = queue_mod.queue_items_rows(items, "map", "gen-2026-07-20")
    assert len(rows) == len(items)
    for it, row in zip(items, rows):
        served = queue_mod.slim_published_item(it)
        # (1) every served scalar column is byte-equal to the served queue.json item
        for col in queue_mod._QUEUE_ITEM_COLUMNS:
            assert row[col] == served.get(col) == it.get(col), col
        # (2) map_value lifted to its own column
        assert row["map_value"] == it["map_value"]
        # (3) diagnostics carries the dropped fields; none leak as phantom columns
        for dropped in ("map_novelty", "map_connectivity", "predicted_strength",
                        "ecv_per_usd"):
            assert row["diagnostics"][dropped] == it[dropped]
        # (4) the DB row is a complete SUPERSET of the served item (no loss)
        reconstructed = {**{c: row[c] for c in queue_mod._QUEUE_ITEM_COLUMNS
                            if row[c] is not None},
                         "map_value": row["map_value"], **row["diagnostics"]}
        assert set(it) <= set(reconstructed)
        # (5) stamps
        assert row["rank_mode"] == "map"
        assert row["generation_id"] == "gen-2026-07-20"
    # order preserved 1:1
    assert [r["priority"] for r in rows] == [it["priority"] for it in items]


def test_queue_items_rows_preserves_restricted_transmission_block(queue_mod):
    # License-restricted items carry a `transmission` block slim keeps; it must
    # survive into the DB row (in diagnostics), never be silently dropped.
    it = _full_ranked_item(1, transmission={"policy": "no-train",
                                            "channel": "data_collection=deny"})
    (row,) = queue_mod.queue_items_rows([it], "map", "g")
    assert row["diagnostics"]["transmission"] == it["transmission"]
