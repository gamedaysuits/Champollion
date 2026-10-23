"""Tests for mt_eval_harness.contest_rank — the contest ranking SSOT.

All offline: the PostgREST seam (``contest._api_request``) is replaced by an
in-memory table router, so every read the ranker performs is visible and
deterministic. Per-segment evidence uses synthetic entries in the
``tests/test_significance.py`` ``_make_entry`` shape.

The entry model under founder ruling R2 (2026-09-06): a contest is entered by
handing a METHOD to the organizer's sovereign node, so the entries come from
``contest_submissions`` (what the node published, with the migration-074
declarations) joined to ``authorization_requests`` (the queue item). The
retired ``contest_intake`` table is not read at all — a test asserts that.
"""

from __future__ import annotations

import csv
import io
import json
import re

import pytest

import mt_eval_harness.contest as contest_mod
import mt_eval_harness.contest_prize_terms as cpt
import mt_eval_harness.contest_rank as cr
from mt_eval_harness.contest_rank import (
    DEFAULT_PRIMARY_METRIC,
    METRIC_VOCABULARY,
    PRIMARY_METRICS,
    RankingError,
    assign_tie_groups,
    build_ranking,
    canonical_metric,
    check_reveal_permitted,
    export_contest,
    format_ranking_table,
    gather_entries,
    handover_gate_ok,
    order_entries,
    pair_evidence,
    pseudonym_for,
    rank_ranges,
    ranking_to_csv_rows,
    resolve_metric,
    resolve_policies,
    resolve_prize_terms,
    resolve_tie_policy,
    tiebreak_order,
)


# ---------------------------------------------------------------------------
# Synthetic fixtures
# ---------------------------------------------------------------------------

def _seg(i: int, expected: str, predicted: str, error=None) -> dict:
    """The significance.py entry shape."""
    return {"id": str(i), "source": f"src_{i}", "expected": expected,
            "predicted": predicted, "exact_match": expected == predicted,
            "chrf_score": 0.0, "bleu_score": 0.0, "error": error,
            "plugin_metrics": {}}


def _refs(n: int) -> list[str]:
    return [f"the quick brown fox number {i} jumps over the lazy dog" for i in range(n)]


def _perfect(n: int) -> list[dict]:
    return [_seg(i, r, r) for i, r in enumerate(_refs(n))]


def _half_wrong(n: int) -> list[dict]:
    out = []
    for i, r in enumerate(_refs(n)):
        pred = r if i % 2 == 0 else "completely unrelated output text here"
        out.append(_seg(i, r, pred))
    return out


def _execution(runtime_seconds: float, **over) -> dict:
    """A run_card["execution"] block as the sovereign node writes it."""
    block = {
        "runtime_seconds": runtime_seconds, "build_seconds": 1.0,
        "run_seconds": runtime_seconds - 1.0, "runtime": "docker",
        "image_digest": "sha256:" + "cd" * 32, "cpus": 4, "ram_gb": 8.0,
        "tmp_gb": 10.0, "gpu": False, "pids_limit": 512,
        "node_id": "lima-airgap-1", "source_count": 6, "output_bytes": 128,
    }
    block.update(over)
    return block


def _card(cid: str, *, chrf=None, bleu=None, comet=None, composite=None,
          trust="verified", dataset_id="set-main", corpus_size=None,
          chrf_ci=None, comp_ci=None, slug=None, execution=None,
          by_test_suite=None, submitter="node") -> dict:
    row = {
        "id": cid, "model_slug": slug or f"sys/{cid}", "condition": "method-execution",
        "trust": trust, "submitter": submitter, "dataset_id": dataset_id,
        "language_pair": "qaa>qab", "corpus_size": corpus_size,
        "method_class": "pipeline", "paradigm": "rule-based",
        "harness_version": "0.1.1", "run_timestamp": "2026-09-06T00:00:00Z",
        "chrf_plus_plus": chrf, "corpus_bleu": bleu, "comet_score": comet,
        "composite_score": composite,
        "chrf_ci_lower": None, "chrf_ci_upper": None,
        "composite_ci_lower": None, "composite_ci_upper": None,
        # Contract C7 aliases (`execution:run_card->execution`) — absent on
        # every card minted before the node measured them, hence None here.
        "execution": execution, "by_test_suite": by_test_suite,
    }
    if chrf_ci:
        row["chrf_ci_lower"], row["chrf_ci_upper"] = chrf_ci
    if comp_ci:
        row["composite_ci_lower"], row["composite_ci_upper"] = comp_ci
    return row


def _entry(cid: str, card: dict, submitted_at="2026-09-06T10:00:00Z", **kw) -> dict:
    return {"run_card_id": cid, "card": card, "submitted_at": submitted_at,
            "submitter_label": f"team-{cid}", "team": None, "notes": "",
            "pathway": "contest_submissions", "authorization_request_id": None,
            "is_primary": True, "track": "unconstrained", "phase": None,
            "description": "a system", "constraints": {}, **kw}


def _sub(rid, *, by="p@example.org", at="2026-09-06T10:00:00Z", team=None, i=1,
         is_primary=True, track="unconstrained", description="a described system",
         label=None, request_id=None, phase=None, constraints=None,
         release_url=None):
    """A contest_submissions row as the node writes it (migration 074)."""
    return {
        "id": i, "run_card_id": rid, "submitted_by": by, "submitted_at": at,
        "team": team, "notes": "",
        "is_primary": is_primary, "track": track, "description": description,
        "method_release_url": release_url,
        "constraints": {"track": track, "weightsPublic": True}
        if constraints is None else constraints,
        "submitter_label": f"lab-{rid}" if label is None else label,
        "authorization_request_id": request_id, "phase": phase,
    }


def _req(request_id, *, state="authorized", method_sha=None, sealed="set-main",
         by="p@example.org"):
    """An authorization_requests row (migration 038 columns only)."""
    return {
        "request_id": request_id, "sealed_set_id": sealed, "state": state,
        "method_sha": ("ab" * 32) if method_sha is None else method_sha,
        "requested_by": by, "corpus_id": sealed, "corpus_version": "v1",
        "node_measurement": "lima-airgap-1",
        "created_at": "2026-09-06T09:00:00Z",
        "decided_at": "2026-09-06T09:30:00Z",
    }


class FakeDB:
    """Routes contest._api_request GETs to in-memory tables.

    ``missing`` names relations this endpoint does not have, so a test can
    stand in for a database that predates a migration: the router raises the
    PostgREST error PostgREST actually raises (42P01 / 42703).
    """

    def __init__(self, contest: dict, submissions=(), requests=(), cards=(),
                 entries=None, deferred=(), missing=()):
        self.contest = contest
        self.submissions = list(submissions)
        self.requests = list(requests)
        self.cards = {c["id"]: c for c in cards}
        self.entries = entries or {}      # run_card_id -> list[dict]
        self.deferred = list(deferred)
        self.missing = set(missing)
        self.calls: list[tuple] = []
        self.patches: list[dict] = []

    def __call__(self, method, path, data=None, params=None, session=None,
                 prefer=None):
        self.calls.append((method, path, params, session))
        params = params or {}
        if method == "PATCH" and path == "contests":
            self.patches.append(data)
            self.contest.update(data)
            return [dict(self.contest)]
        assert method == "GET", f"unexpected {method} {path}"
        if path in self.missing:
            raise RuntimeError(
                f'Supabase API error (404): {{"code":"42P01","message":'
                f'"relation \\"public.{path}\\" does not exist"}}')
        if path == "contests":
            cid = params["id"].removeprefix("eq.")
            return [dict(self.contest)] if cid == self.contest["id"] else []
        if path == "contest_submissions":
            if "is_primary" in params.get("select", ""):
                if "contest_submissions.declarations" in self.missing:
                    raise RuntimeError(
                        'Supabase API error (400): {"code":"42703","message":'
                        '"column contest_submissions.is_primary does not exist"}')
                return [dict(s) for s in self.submissions]
            return [{k: v for k, v in s.items()
                     if k in ("id", "run_card_id", "submitted_by",
                              "submitted_at", "team", "notes")}
                    for s in self.submissions]
        if path == "authorization_requests":
            if ("execution_diagnostics" in params.get("select", "")
                    and "authorization_requests.diagnostics" in self.missing):
                raise RuntimeError(
                    'Supabase API error (400): {"code":"42703","message":'
                    '"column authorization_requests.execution_diagnostics does not exist"}')
            m = re.fullmatch(r"in\.\((.*)\)", params.get("sealed_set_id", ""))
            ids = [i.strip('"') for i in m.group(1).split(",")] if m else []
            return [dict(r) for r in self.requests if r["sealed_set_id"] in ids]
        if path == "contest_deferred_results":
            return [dict(d) for d in self.deferred]
        if path == "run_cards":
            m = re.fullmatch(r"in\.\((.*)\)", params["id"])
            ids = [i.strip('"') for i in m.group(1).split(",")] if m else []
            return [dict(self.cards[i]) for i in ids if i in self.cards]
        if path == "run_card_entries":
            rid = params["run_card_id"].removeprefix("eq.")
            rows = self.entries.get(rid, [])
            off, lim = int(params.get("offset", 0)), int(params.get("limit", 500))
            return [{"entry_id": e["id"], "expected": e["expected"],
                     "predicted": e["predicted"], "error": e.get("error")}
                    for e in rows[off:off + lim]]
        raise AssertionError(f"unrouted path {path}")


def _contest(**kw) -> dict:
    base = {"id": "beta-2026", "name": "Beta 2026", "description": "",
            "corpus_id": "set-main", "language_pair": "qaa>qab",
            "visibility": "public", "created_by": "org@example.org",
            "status": "open", "metadata": {}, "created_at": "2026-09-01T00:00:00Z",
            "use_context": "non-commercial", "lane": "sealed",
            "authorization_model": "per-submission", "intake_daily_limit": 5,
            "intake_open": True, "shared_task_id": None}
    base.update(kw)
    return base


@pytest.fixture
def db(monkeypatch):
    """A FakeDB installed on the seam; tests mutate it before ranking."""
    fake = FakeDB(_contest())
    monkeypatch.setattr(contest_mod, "_api_request", fake)
    return fake


# ---------------------------------------------------------------------------
# Metric resolution + tiebreak order
# ---------------------------------------------------------------------------

class TestResolveMetric:
    def test_default_when_nothing_recorded(self):
        assert resolve_metric(None, {"metadata": {}}) == (DEFAULT_PRIMARY_METRIC, "harness-default")
        assert resolve_metric(None, None) == (DEFAULT_PRIMARY_METRIC, "harness-default")

    def test_recorded_metric_wins_over_default(self):
        assert resolve_metric(None, {"metadata": {"primary_metric": "bleu"}}) == \
            ("bleu", "contest.metadata.primary_metric")

    def test_explicit_request_wins_over_recorded(self):
        assert resolve_metric("ter", {"metadata": {"primary_metric": "bleu"}}) == \
            ("ter", "--metric")

    def test_retired_composite_is_refused_for_a_contest_that_did_not_promise_it(self):
        # Scoring standard/1 retired the composite: a --metric view of a
        # contest that recorded another metric is refused, with the reason.
        with pytest.raises(ValueError, match="retired as a ranking metric"):
            resolve_metric("composite", {"metadata": {"primary_metric": "bleu"}})
        with pytest.raises(ValueError, match="retired"):
            resolve_metric("composite_score", {"metadata": {}})

    def test_legacy_composite_contest_still_ranks_on_its_promise(self):
        legacy = {"metadata": {"primary_metric": "composite"}}
        assert resolve_metric(None, legacy) == \
            ("composite", "contest.metadata.primary_metric")
        assert resolve_metric("composite", legacy) == ("composite", "--metric")
        assert cr.metric_label("composite") == "legacy composite (retired)"

    def test_aliases_map_to_canonical_ids(self):
        assert canonical_metric("chrF++") == "chrf_plus_plus"
        assert canonical_metric("corpus_bleu") == "bleu"
        assert canonical_metric("COMET") == "comet_score"
        assert canonical_metric("composite_score") == "composite"

    def test_chrf_alias_is_plain_chrf_never_chrf_plus_plus(self):
        # An alias names exactly the metric it spells. `chrf` used to resolve
        # silently to chrF++; it is plain chrF (word_order=0).
        assert canonical_metric("chrf") == "chrf_plain"
        assert canonical_metric("chrF") == "chrf_plain"
        assert canonical_metric("chrf++") == "chrf_plus_plus"

    def test_any_rankable_registry_metric_is_accepted(self):
        for mid in ("ter", "spbleu", "chrf_plain", "exact_match_rate"):
            assert canonical_metric(mid) == mid

    def test_unknown_metric_refused_with_vocabulary(self):
        with pytest.raises(ValueError, match="chrf_plus_plus.*chrf_plain|chrf_plain.*chrf_plus_plus"):
            canonical_metric("wer")

    def test_bad_recorded_metric_is_loud_not_replaced(self):
        with pytest.raises(ValueError, match="not rankable"):
            resolve_metric(None, {"id": "x", "metadata": {"primary_metric": "wer"}})


class TestTiebreakOrder:
    def test_default_chain(self):
        assert tiebreak_order("chrf_plus_plus") == [
            "chrf_plus_plus", "bleu", "comet_score", "submitted_at", "run_card_id"]

    def test_primary_moves_to_front_and_is_not_repeated(self):
        assert tiebreak_order("bleu") == [
            "bleu", "chrf_plus_plus", "comet_score", "submitted_at", "run_card_id"]

    def test_composite_is_never_a_secondary_tiebreak(self):
        assert "composite" not in tiebreak_order("chrf_plus_plus")
        assert tiebreak_order("composite")[0] == "composite"


class TestVocabulary:
    def test_vocabulary_is_every_registry_metric_with_a_ranking_block(self):
        from mt_eval_harness.metric_manifest import metric_entries
        entries = metric_entries()
        if not entries:
            pytest.skip("shared/metric-registry.json not found (standalone install)")
        assert set(METRIC_VOCABULARY) == {m for m, e in entries.items() if e.get("ranking")}
        assert {"chrf_plus_plus", "chrf_plain", "bleu", "comet_score",
                "composite", "ter"} <= set(METRIC_VOCABULARY)

    def test_manifest_parity(self):
        """The table IS the registry's ranking entries; skip standalone."""
        from mt_eval_harness.metric_manifest import metric_entries
        entries = metric_entries()
        if not entries:
            pytest.skip("shared/metric-registry.json not found (standalone install)")
        for mid, spec in PRIMARY_METRICS.items():
            assert mid in entries, f"{mid} is not a canonical metric id"
            assert spec["column"] == (entries[mid]["db_column"] or mid)
            assert spec["jsonb"] is (entries[mid]["db_column"] is None)
            assert entries[mid]["display_name"] == spec["label"]
            assert entries[mid]["direction"] == spec["direction"]
            assert entries[mid]["scale"] == spec["scale"]

    def test_policy_vocabularies_come_from_contest_policy(self):
        """One vocabulary, written twice (SQL + Python) — never three times."""
        from mt_eval_harness import contest_policy
        assert cr.TIE_TESTS is contest_policy.TIE_TESTS
        assert cr.TRACKS is contest_policy.TRACKS
        assert cr.PHASE_NAMES is contest_policy.PHASE_NAMES
        assert cr.DEFAULT_TRACK == contest_policy.DEFAULT_TRACK


# ---------------------------------------------------------------------------
# Policies — contests.metadata read once, checked the way the SQL guard checks
# ---------------------------------------------------------------------------

class TestResolvePolicies:
    def test_defaults_when_metadata_is_empty(self):
        p = resolve_policies({"id": "c", "metadata": {}})
        assert p["tie_test"] == "ar" and p["alpha"] == 0.05
        assert p["n_resamples"] == 1000 and p["seed"] == 12345
        assert p["require_description"] is False
        assert p["allowed_tracks"] == list(cr.TRACKS)
        assert p["open_weight_only"] is False
        assert p["anonymize_until_close"] is False
        assert p["results_visibility"] == "immediate"
        assert p["prize_terms"] is None
        assert set(p["sources"].values()) == {"harness-default"}

    def test_recorded_values_win_and_are_sourced(self):
        p = resolve_policies({"id": "c", "metadata": {
            "tie_test": "bootstrap", "alpha": 0.01, "n_resamples": 5000,
            "seed": 7, "require_description": True,
            "allowed_tracks": ["constrained"], "open_weight_only": True,
            "anonymize_until_close": True,
            "results_visibility": "hidden_until_close"}})
        assert p["tie_test"] == "bootstrap" and p["alpha"] == 0.01
        assert p["n_resamples"] == 5000 and p["seed"] == 7
        assert p["allowed_tracks"] == ["constrained"]
        assert p["sources"]["alpha"] == "contest.metadata"
        assert p["sources"]["prize_terms"] == "harness-default"

    @pytest.mark.parametrize("bad", [
        {"tie_test": "t-test"},
        {"alpha": 1.5},
        {"alpha": "0.05"},
        {"n_resamples": 0},
        {"n_resamples": 12.5},
        {"seed": "abc"},
        {"require_description": "yes"},
        {"allowed_tracks": []},
        {"allowed_tracks": ["open"]},
        {"allowed_tracks": "constrained"},
        {"open_weight_only": 1},
        {"anonymize_until_close": "true"},
        {"results_visibility": "later"},
        {"prize_terms": "cash"},
    ])
    def test_bad_policy_is_a_refusal_never_a_repair(self, bad):
        with pytest.raises(RankingError, match="PROMISE key|is not"):
            resolve_policies({"id": "c", "metadata": bad})


class TestResolveTiePolicy:
    def test_frozen_metadata_beats_the_harness_default(self):
        c = {"id": "c", "metadata": {"tie_test": "bootstrap", "alpha": 0.01,
                                     "n_resamples": 5000, "seed": 7}}
        tp = resolve_tie_policy(c)
        assert (tp["tie_test"], tp["alpha"], tp["n_resamples"], tp["seed"]) == \
            ("bootstrap", 0.01, 5000, 7)
        assert set(tp["source"].values()) == {"frozen-metadata"}

    def test_a_default_valued_request_never_overrides_a_promise(self):
        """`close` always passes the harness defaults; they must not win."""
        c = {"id": "c", "metadata": {"tie_test": "bootstrap", "alpha": 0.01,
                                     "n_resamples": 5000, "seed": 7}}
        tp = resolve_tie_policy(c, tie_test="ar", alpha=0.05, n_resamples=1000,
                                seed=12345)
        assert tp["tie_test"] == "bootstrap" and tp["alpha"] == 0.01
        assert tp["n_resamples"] == 5000 and tp["seed"] == 7

    def test_tightening_is_allowed_and_labelled(self):
        c = {"id": "c", "metadata": {"alpha": 0.05, "n_resamples": 1000}}
        # metadata alpha equals the harness default, so ask for something the
        # default is not: a stricter alpha and more resamples.
        tp = resolve_tie_policy(c, alpha=0.01, n_resamples=4000)
        assert tp["alpha"] == 0.01 and tp["n_resamples"] == 4000
        assert tp["source"]["alpha"] == "cli (tightened)"
        assert tp["source"]["n_resamples"] == "cli (tightened)"

    def test_loosening_alpha_is_refused_naming_both_values(self):
        c = {"id": "c", "metadata": {"alpha": 0.01}}
        with pytest.raises(RankingError) as ei:
            resolve_tie_policy(c, alpha=0.2)
        assert "0.01" in str(ei.value) and "0.2" in str(ei.value)
        assert "TIGHTEN" in str(ei.value)

    def test_fewer_resamples_is_refused(self):
        c = {"id": "c", "metadata": {"n_resamples": 5000}}
        with pytest.raises(RankingError, match="5000"):
            resolve_tie_policy(c, n_resamples=100)

    def test_changing_a_frozen_test_or_seed_is_refused(self):
        c = {"id": "c", "metadata": {"tie_test": "ar", "seed": 7}}
        with pytest.raises(RankingError, match="tie_test"):
            resolve_tie_policy(c, tie_test="bootstrap")
        with pytest.raises(RankingError, match="seed"):
            resolve_tie_policy(c, seed=999)

    def test_cli_wins_when_nothing_was_frozen(self):
        tp = resolve_tie_policy({"id": "c", "metadata": {}}, alpha=0.2,
                                tie_test="bootstrap")
        assert tp["alpha"] == 0.2 and tp["tie_test"] == "bootstrap"
        assert tp["source"]["alpha"] == "cli"


class TestResolvePrizeTerms:
    """R1-trinary (2026-09-07): the term is ONE declared choice of three."""

    def test_no_prize_terms_means_no_prize(self):
        pt = resolve_prize_terms(_contest())
        assert pt["declared"] is False
        assert pt["terms"] is None and pt["terms_sha256"] is None
        assert pt["gate"] == []
        assert "NO PRIZE" in pt["note"]

    def test_r1_prizes_only_on_the_sealed_lane(self):
        c = _contest(lane="standard",
                     metadata={"prize_terms": {"disposition": "retain_ip"}})
        with pytest.raises(RankingError, match="SOVEREIGN"):
            resolve_prize_terms(c)

    @pytest.mark.parametrize("disposition", sorted(cpt.DISPOSITIONS))
    def test_every_disposition_resolves_with_a_hash_and_a_gate(self, disposition):
        declared = {"disposition": disposition}
        pt = resolve_prize_terms(_contest(metadata={"prize_terms": declared}))
        assert pt["declared"] is True
        assert pt["terms"] == cpt.normalize_prize_terms(declared)
        assert pt["terms"]["disposition"] == disposition
        assert pt["terms_sha256"] == cpt.terms_sha256(declared)
        assert pt["gate"] == cpt.prize_gate(declared)
        assert "handover_verified" in pt["gate"]
        assert pt["describe"] and "{" not in pt["describe"]
        assert cpt.DISPOSITION_HEADLINES[disposition] in pt["describe"]

    def test_the_retired_switch_names_its_replacement(self):
        c = _contest(metadata={"prize_terms": {
            "release_required_before_scores": True}})
        with pytest.raises(RankingError) as ei:
            resolve_prize_terms(c)
        assert "RETIRED" in str(ei.value) and "release" in str(ei.value)

    def test_unreadable_terms_are_a_refusal_never_a_repair(self):
        c = _contest(metadata={"prize_terms": {
            "disposition": "retain_ip", "retention": "shred"}})
        with pytest.raises(RankingError, match="retention"):
            resolve_prize_terms(c)

    def test_an_unoffered_override_names_the_option_and_the_key(self):
        c = _contest(metadata={"prize_terms": {
            "disposition": "pass_to_holders",
            "retention": "delete_after_scoring"}})
        with pytest.raises(RankingError) as ei:
            resolve_prize_terms(c)
        assert "pass_to_holders" in str(ei.value)
        assert "delete_after_scoring" in str(ei.value)

    def test_hand_written_derived_detail_that_disagrees_is_refused(self):
        c = _contest(metadata={"prize_terms": {
            "disposition": "retain_ip", "rights": "assignment_to_host"}})
        with pytest.raises(RankingError) as ei:
            resolve_prize_terms(c)
        assert "contradicts" in str(ei.value)

    def test_advertised_money_without_terms_is_refused(self):
        c = _contest(metadata={"prize": {"amount": 5000, "currency": "CAD"}})
        with pytest.raises(RankingError) as ei:
            resolve_prize_terms(c)
        assert "declares no metadata.prize_terms" in str(ei.value)
        assert "metadata.prize" in str(ei.value)

    def test_money_inside_the_terms_is_refused(self):
        terms = {"disposition": "pass_to_holders", "amount": "CAD 5000"}
        with pytest.raises(RankingError, match="MONEY"):
            resolve_prize_terms(_contest(metadata={"prize_terms": terms}))


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------

class TestOrderEntries:
    def test_primary_desc_then_secondary_then_time_then_id(self):
        a = _entry("a", _card("a", chrf=50.0, bleu=20.0), submitted_at="2026-09-06T12:00:00Z")
        b = _entry("b", _card("b", chrf=50.0, bleu=25.0), submitted_at="2026-09-06T13:00:00Z")
        c = _entry("c", _card("c", chrf=50.0, bleu=25.0), submitted_at="2026-09-06T11:00:00Z")
        d = _entry("d", _card("d", chrf=60.0, bleu=1.0))
        e = _entry("e", _card("e", chrf=50.0, bleu=25.0), submitted_at="2026-09-06T11:00:00Z")
        ordered = [x["run_card_id"] for x in order_entries([a, b, c, d, e], "chrf_plus_plus")]
        # d (60) first; then the 50s by BLEU desc (25 before 20); among the
        # 25s the earliest submission wins, then the id.
        assert ordered == ["d", "c", "e", "b", "a"]

    def test_unscored_excluded_and_none_secondary_sorts_last(self):
        a = _entry("a", _card("a", chrf=50.0, bleu=None))
        b = _entry("b", _card("b", chrf=50.0, bleu=10.0))
        z = _entry("z", _card("z", chrf=None, bleu=99.0))
        ordered = [x["run_card_id"] for x in order_entries([a, b, z], "chrf_plus_plus")]
        assert ordered == ["b", "a"]

    def test_primary_metric_switch_changes_order(self):
        a = _entry("a", _card("a", chrf=50.0, bleu=10.0))
        b = _entry("b", _card("b", chrf=40.0, bleu=30.0))
        assert [x["run_card_id"] for x in order_entries([a, b], "chrf_plus_plus")] == ["a", "b"]
        assert [x["run_card_id"] for x in order_entries([a, b], "bleu")] == ["b", "a"]


# ---------------------------------------------------------------------------
# Pair evidence — the three rungs
# ---------------------------------------------------------------------------

class TestPairEvidence:
    def test_rung1_ar_separates_perfect_from_half_wrong(self):
        n = 40
        up = _entry("p", _card("p", chrf=100.0, corpus_size=n))
        lo = _entry("h", _card("h", chrf=55.0, corpus_size=n))
        ev = pair_evidence(up, lo, "chrf_plus_plus", segments_upper=_perfect(n),
                           segments_lower=_half_wrong(n), n_resamples=200, seed=7)
        assert ev["method"] == "approximate_randomization"
        assert ev["tied"] is False
        assert ev["p_value"] < 0.05
        assert ev["n_segments"] == n
        assert "paired segments" in ev["reason"]

    def test_rung1_identical_outputs_tie_with_p_one(self):
        n = 30
        a = _entry("a", _card("a", chrf=55.0, corpus_size=n))
        b = _entry("b", _card("b", chrf=55.0, corpus_size=n))
        ev = pair_evidence(a, b, "chrf_plus_plus", segments_upper=_half_wrong(n),
                           segments_lower=_half_wrong(n), n_resamples=100)
        assert ev["method"] == "approximate_randomization"
        assert ev["tied"] is True
        assert ev["p_value"] == pytest.approx(1.0)

    def test_rung1_bootstrap_is_selectable_and_labelled(self):
        n = 30
        a = _entry("a", _card("a", chrf=100.0, corpus_size=n))
        b = _entry("b", _card("b", chrf=55.0, corpus_size=n))
        ev = pair_evidence(a, b, "chrf_plus_plus", segments_upper=_perfect(n),
                           segments_lower=_half_wrong(n), tie_test="bootstrap",
                           n_resamples=100)
        assert ev["method"] == "paired_bootstrap"
        assert ev["tied"] is False

    def test_rung1_mismatched_ids_falls_to_rung2_and_says_so(self):
        n = 20
        a = _entry("a", _card("a", chrf=60.0, chrf_ci=(58.0, 62.0)))
        b = _entry("b", _card("b", chrf=59.0, chrf_ci=(57.0, 61.0)))
        segs_b = _perfect(n)
        segs_b[0]["id"] = "zzz"
        ev = pair_evidence(a, b, "chrf_plus_plus", segments_upper=_perfect(n),
                           segments_lower=segs_b)
        assert ev["method"] == "ci_overlap"
        assert ev["tied"] is True
        assert "segment ids differ" in ev["reason"]

    def test_rung2_ci_overlap_and_non_overlap(self):
        a = _entry("a", _card("a", chrf=60.0, chrf_ci=(58.0, 62.0)))
        b = _entry("b", _card("b", chrf=59.0, chrf_ci=(57.0, 61.0)))
        c = _entry("c", _card("c", chrf=40.0, chrf_ci=(38.0, 42.0)))
        tie = pair_evidence(a, b, "chrf_plus_plus", segments_note="no per-segment rows")
        sep = pair_evidence(a, c, "chrf_plus_plus")
        assert tie["method"] == "ci_overlap" and tie["tied"] is True
        assert sep["method"] == "ci_overlap" and sep["tied"] is False
        assert "conservative proxy" in tie["reason"]
        assert "no per-segment rows" in tie["reason"]

    def test_rung2_composite_uses_its_own_ci_columns(self):
        a = _entry("a", _card("a", composite=0.61, comp_ci=(0.58, 0.64)))
        b = _entry("b", _card("b", composite=0.60, comp_ci=(0.57, 0.63)))
        ev = pair_evidence(a, b, "composite")
        assert ev["method"] == "ci_overlap" and ev["tied"] is True

    def test_rung3_point_equality_when_no_ci_columns(self):
        """BLEU has no CI columns and no segments here → point equality."""
        a = _entry("a", _card("a", bleu=20.004))
        b = _entry("b", _card("b", bleu=20.001))
        c = _entry("c", _card("c", bleu=19.5))
        tie = pair_evidence(a, b, "bleu")
        sep = pair_evidence(a, c, "bleu")
        assert tie["method"] == "point_equality" and tie["tied"] is True
        assert sep["method"] == "point_equality" and sep["tied"] is False
        assert "no CI columns exist for BLEU" in tie["reason"]

    def test_rung3_when_ci_columns_exist_but_are_null(self):
        a = _entry("a", _card("a", chrf=50.0))
        b = _entry("b", _card("b", chrf=50.0))
        ev = pair_evidence(a, b, "chrf_plus_plus")
        assert ev["method"] == "point_equality" and ev["tied"] is True
        assert "not populated" in ev["reason"]

    def test_every_rung_labels_method_and_reason(self):
        a = _entry("a", _card("a", comet=0.8))
        b = _entry("b", _card("b", comet=0.7))
        ev = pair_evidence(a, b, "comet_score")
        assert set(ev) >= {"method", "tied", "reason"}

    def test_bad_tie_test_refused(self):
        a = _entry("a", _card("a", chrf=1.0))
        with pytest.raises(ValueError, match="tie_test"):
            pair_evidence(a, a, "chrf_plus_plus", tie_test="t-test")


class TestAssignTieGroups:
    def test_competition_numbering(self):
        ordered = [{}, {}, {}, {}, {}]
        ev = [None, {"tied": True}, {"tied": False}, {"tied": True}, {"tied": True}]
        assert assign_tie_groups(ordered, ev) == [(1, 1), (1, 1), (3, 2), (3, 2), (3, 2)]

    def test_no_ties(self):
        assert assign_tie_groups([{}, {}, {}], [None, {"tied": False}, {"tied": False}]) == \
            [(1, 1), (2, 2), (3, 3)]

    def test_single_entry(self):
        assert assign_tie_groups([{}], [None]) == [(1, 1)]

    def test_empty(self):
        assert assign_tie_groups([], []) == []


class TestRankRanges:
    def test_range_covers_the_whole_tie_group(self):
        groups = [(1, 1), (1, 1), (3, 2), (3, 2), (3, 2)]
        assert rank_ranges(groups) == [(1, 2), (1, 2), (3, 5), (3, 5), (3, 5)]

    def test_singleton_group_is_a_point_range(self):
        assert rank_ranges([(1, 1), (2, 2)]) == [(1, 1), (2, 2)]

    def test_empty(self):
        assert rank_ranges([]) == []


# ---------------------------------------------------------------------------
# gather_entries — the R2 entry model
# ---------------------------------------------------------------------------

class TestGatherEntries:
    def test_never_reads_the_retired_intake_table(self, db):
        db.submissions = [_sub("a")]
        gather_entries("beta-2026")
        assert not any(c[1] == "contest_intake" for c in db.calls)

    def test_submission_declarations_ride_along(self, db):
        db.submissions = [_sub("a", is_primary=False, track="constrained",
                               description="an LSTM", phase="evaluation",
                               request_id="authreq-1", label="Team Nine")]
        db.requests = [_req("authreq-1")]
        g = gather_entries("beta-2026")
        e = g["entries"][0]
        assert e["is_primary"] is False and e["track"] == "constrained"
        assert e["description"] == "an LSTM" and e["phase"] == "evaluation"
        assert e["submitter_label"] == "Team Nine"
        assert e["request"]["state"] == "authorized"
        assert e["pathway"] == "contest_submissions+authorization_request"

    def test_request_without_a_card_is_pending_with_its_reason(self, db):
        db.submissions = [_sub("a", request_id="authreq-1")]
        db.requests = [_req("authreq-1"),
                       _req("authreq-2", state="authorized"),
                       _req("authreq-3", state="pending"),
                       _req("authreq-4", state="denied"),
                       _req("authreq-5", state="expired")]
        g = gather_entries("beta-2026")
        pending = {p["authorization_request_id"]: p for p in g["pending"]}
        assert set(pending) == {"authreq-2", "authreq-3"}
        assert "no published card yet" in pending["authreq-2"]["reason"]
        assert "custodian" in pending["authreq-3"]["reason"]
        assert {r["authorization_request_id"] for r in g["rejected"]} == \
            {"authreq-4", "authreq-5"}

    def test_holdout_set_requests_are_attributed_too(self, db):
        db.contest["metadata"] = {"sealed_holdout_set_id": "set-holdout"}
        db.requests = [_req("authreq-h", sealed="set-holdout"),
                       _req("authreq-elsewhere", sealed="set-other-contest")]
        g = gather_entries("beta-2026")
        assert [p["authorization_request_id"] for p in g["pending"]] == ["authreq-h"]

    def test_pre_074_endpoint_degrades_loudly_not_silently(self, db):
        db.missing = {"contest_submissions.declarations"}
        db.submissions = [_sub("a", is_primary=False, track="constrained")]
        g = gather_entries("beta-2026")
        assert g["declarations_available"] is False
        assert g["entries"][0]["is_primary"] is True     # the DB cannot say otherwise
        assert g["entries"][0]["track"] == "unconstrained"
        assert any("migration 074 is not applied" in n for n in g["notes"])

    def test_missing_request_table_is_a_note_not_a_crash(self, db):
        db.missing = {"authorization_requests"}
        db.submissions = [_sub("a")]
        g = gather_entries("beta-2026")
        assert g["requests_available"] is False
        assert any("sovereign lane" in n for n in g["notes"])
        assert len(g["entries"]) == 1

    def test_duplicate_link_counts_once_and_keeps_the_first_time(self, db):
        db.submissions = [_sub("a", i=1),
                          _sub("a", i=2, at="2026-09-07T00:00:00Z")]
        g = gather_entries("beta-2026")
        assert len(g["entries"]) == 1
        assert g["entries"][0]["submitted_at"] == "2026-09-06T10:00:00Z"


# ---------------------------------------------------------------------------
# build_ranking — through the stubbed seam
# ---------------------------------------------------------------------------

class TestBuildRanking:
    def test_shape_and_defaults(self, db):
        db.cards = {c["id"]: c for c in [
            _card("a", chrf=70.0, bleu=30.0, chrf_ci=(68, 72)),
            _card("b", chrf=60.0, bleu=25.0, chrf_ci=(58, 62)),
        ]}
        db.submissions = [_sub("a", i=1), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        for key in ("contest", "metric", "metric_label", "metric_source",
                    "tiebreak_order", "trust_policy", "ranking_method",
                    "generated_at", "generated_by", "harness_version",
                    "provisional", "entries", "unscored", "excluded",
                    "other_sets", "pending", "rejected", "pending_intake",
                    "rejected_intake", "tie_policy", "identity_policy",
                    "prize_eligibility", "contrastive", "by_phase", "by_track",
                    "deferred_results", "exclusions"):
            assert key in r, key
        assert r["metric"] == "chrf_plus_plus"
        assert r["metric_source"] == "harness-default"
        assert r["trust_policy"] == "verified-only"
        assert r["provisional"] is True
        assert r["generated_by"] == "anonymous"
        for k in ("tie_test", "n_resamples", "alpha", "seed", "evidence_used", "note"):
            assert k in r["ranking_method"]
        assert r["ranking_method"]["evidence_used"] == ["ci_overlap"]
        assert [e["rank"] for e in r["entries"]] == [1, 2]
        assert [e["rank_min"] for e in r["entries"]] == [1, 2]
        assert [e["rank_max"] for e in r["entries"]] == [1, 2]
        assert r["entries"][0]["tie_evidence"] is None
        assert r["entries"][1]["tie_evidence"]["vs"] == "a"
        json.dumps(r)  # serialisable

    def test_metric_source_from_contest_metadata_and_override(self, db):
        db.contest["metadata"] = {"primary_metric": "bleu"}
        db.cards = {c["id"]: c for c in [_card("a", chrf=70.0, bleu=10.0),
                                         _card("b", chrf=60.0, bleu=20.0)]}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["metric"] == "bleu" and r["metric_source"] == "contest.metadata.primary_metric"
        assert [e["run_card_id"] for e in r["entries"]] == ["b", "a"]
        r2 = build_ranking("beta-2026", metric="chrf++", use_segments=False)
        assert r2["metric_source"] == "--metric"
        assert [e["run_card_id"] for e in r2["entries"]] == ["a", "b"]

    SIG_PP = "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.6.0"

    def _promised(self, db, **extra):
        db.contest["metadata"] = {"primary_metric": "chrf_plus_plus",
                                  "metric_signature": self.SIG_PP,
                                  "harness_version": "0.1.1", **extra}

    def test_card_from_another_harness_version_is_excluded_not_ranked(self, db):
        self._promised(db)
        a, b = _card("a", chrf=70.0), _card("b", chrf=60.0)
        b["harness_version"] = "0.2.0"
        for c in (a, b):
            c["sacrebleu_signatures"] = {"chrf": self.SIG_PP}
        db.cards = {"a": a, "b": b}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["a"]
        dropped = [x for x in r["excluded"] if x.get("rule") == "harness_version"]
        assert len(dropped) == 1 and "0.2.0" in dropped[0]["reason"] \
            and "0.1.1" in dropped[0]["reason"]

    def test_card_with_another_metric_signature_is_excluded(self, db):
        self._promised(db)
        a, b = _card("a", chrf=70.0), _card("b", chrf=60.0)
        a["sacrebleu_signatures"] = {"chrf": self.SIG_PP}
        b["sacrebleu_signatures"] = {"chrf": self.SIG_PP.replace("2.6.0", "2.4.0")}
        db.cards = {"a": a, "b": b}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["a"]
        dropped = [x for x in r["excluded"] if x.get("rule") == "metric_signature"]
        assert len(dropped) == 1 and "2.4.0" in dropped[0]["reason"]

    def test_unrecorded_signature_is_excluded_when_one_was_promised(self, db):
        self._promised(db)
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["entries"] == []
        assert any("(unrecorded)" in x["reason"] for x in r["excluded"])

    def test_a_view_on_another_metric_does_not_check_the_signature(self, db):
        # The signature promise is about the contest's own metric; a --metric
        # view on BLEU is a view, and says nothing about chrF++'s computation.
        self._promised(db)
        db.cards = {"a": _card("a", chrf=70.0, bleu=20.0)}
        db.submissions = [_sub("a")]
        r = build_ranking("beta-2026", metric="bleu", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["a"]

    def test_contest_without_promises_checks_nothing(self, db):
        db.contest["metadata"] = {"primary_metric": "chrf_plus_plus"}
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["a"]
        assert r["policies"]["metric_signature"] is None
        assert r["policies"]["sources"]["harness_version"] == "harness-default"

    def test_declared_power_is_read_and_checked(self, db):
        power = {"n_segments": 500, "metric": "chrf_plus_plus",
                 "minimum_detectable_effect": 1.8, "target_power": 0.8}
        db.contest["metadata"] = {"primary_metric": "chrf_plus_plus",
                                  "declared_power": power}
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["policies"]["declared_power"] == power
        db.contest["metadata"]["declared_power"] = {"n_segments": "500", "metric": "x"}
        with pytest.raises(cr.RankingError, match="declared_power"):
            build_ranking("beta-2026", use_segments=False)

    def test_unreadable_promise_is_a_refusal(self, db):
        db.contest["metadata"] = {"primary_metric": "chrf_plus_plus", "harness_version": ""}
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        with pytest.raises(cr.RankingError, match="harness_version"):
            build_ranking("beta-2026", use_segments=False)

    def test_lower_is_better_metric_ranks_ascending(self, db):
        a, b = _card("a", chrf=70.0), _card("b", chrf=60.0)
        a["ter"], b["ter"] = 55.0, 40.0
        db.contest["metadata"] = {"primary_metric": "ter"}
        db.cards = {"a": a, "b": b}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["metric"] == "ter"
        assert [e["run_card_id"] for e in r["entries"]] == ["b", "a"]

    def test_jsonb_only_metric_ranks_through_its_alias(self, db):
        # chrf_plain has no run_cards column; the select aliases
        # run_card->scores->chrf_plain under the metric id.
        a, b = _card("a", chrf=70.0), _card("b", chrf=60.0)
        a["chrf_plain"], b["chrf_plain"] = 50.0, 58.0
        db.contest["metadata"] = {"primary_metric": "chrf_plain"}
        db.cards = {"a": a, "b": b}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["metric"] == "chrf_plain"
        assert [e["run_card_id"] for e in r["entries"]] == ["b", "a"]
        assert "chrf_plain:run_card->scores->chrf_plain" in cr._RUN_CARD_SELECT

    def test_entries_carry_their_request_and_pathway(self, db):
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a", request_id="authreq-1")]
        db.requests = [_req("authreq-1")]
        r = build_ranking("beta-2026", use_segments=False)
        e = r["entries"][0]
        assert e["authorization_request_id"] == "authreq-1"
        assert e["request_state"] == "authorized"
        assert e["method_sha"] == "ab" * 32

    def test_pending_and_rejected_requests_surfaced(self, db):
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a", request_id="authreq-1")]
        db.requests = [_req("authreq-1"),
                       _req("authreq-2", state="pending"),
                       _req("authreq-3", state="denied")]
        r = build_ranking("beta-2026", use_segments=False)
        assert [p["authorization_request_id"] for p in r["pending"]] == ["authreq-2"]
        assert [p["authorization_request_id"] for p in r["rejected"]] == ["authreq-3"]
        # The names close_contest reads are the same lists.
        assert r["pending_intake"] == r["pending"]
        assert r["rejected_intake"] == r["rejected"]
        assert len(r["entries"]) == 1

    def test_a_failed_run_is_failed_not_pending_forever(self, db):
        crashed = _req("authreq-2")
        crashed["execution_diagnostics"] = {
            "outcome": "failed", "stage": "timeout", "exit_code": None,
            "runtime_seconds": 3600.0, "n_sources": 50, "n_output_lines": 12,
            "stderr_bytes": 0}
        still_running = _req("authreq-3")
        db.requests = [crashed, still_running]
        r = build_ranking("beta-2026", use_segments=False)
        assert [p["authorization_request_id"] for p in r["pending"]] == ["authreq-3"]
        assert [f["authorization_request_id"] for f in r["failed"]] == ["authreq-2"]
        reason = r["failed"][0]["reason"]
        assert "stage: timeout" in reason and "n_output_lines=12" in reason
        assert "fresh proposal" in reason
        # close_contest reads pending_intake: a crash no longer blocks close.
        assert r["pending_intake"] == r["pending"]
        assert "Failed entries" in cr.format_ranking_table(r)

    def test_a_scored_diagnostics_record_is_not_a_failure(self, db):
        running = _req("authreq-2")
        running["execution_diagnostics"] = {"outcome": "scored", "n_scored": 50, "n_empty": 0}
        db.requests = [running]
        r = build_ranking("beta-2026", use_segments=False)
        assert [p["authorization_request_id"] for p in r["pending"]] == ["authreq-2"]
        assert r["failed"] == []

    def test_completed_request_is_not_in_flight(self, db):
        db.requests = [_req("authreq-9", state="completed")]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["pending"] == []
        assert [c["authorization_request_id"] for c in r["completed"]] == ["authreq-9"]
        assert "075" in r["completed"][0]["reason"]

    def test_pre_074_endpoint_says_it_cannot_tell_failed_from_pending(self, db):
        db.missing.add("authorization_requests.diagnostics")
        db.requests = [_req("authreq-2")]
        r = build_ranking("beta-2026", use_segments=False)
        assert [p["authorization_request_id"] for p in r["pending"]] == ["authreq-2"]
        assert any("execution_diagnostics" in n for n in r["notes"])

    def test_disqualified_always_out(self, db):
        db.cards = {c["id"]: c for c in [_card("a", chrf=70.0),
                                         _card("d", chrf=99.0, trust="disqualified")]}
        db.submissions = [_sub("a"), _sub("d", i=2)]
        r = build_ranking("beta-2026", include_unverified=True, use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["a"]
        assert any("disqualified" in x["reason"] for x in r["excluded"])
        assert any(x["rule"] == "trust" and x["entry"] == "d" for x in r["exclusions"])

    def test_unverified_hidden_by_default_with_banner(self, db, capsys):
        db.cards = {c["id"]: c for c in [_card("a", chrf=70.0),
                                         _card("u", chrf=80.0, trust="unverified")]}
        db.submissions = [_sub("a"), _sub("u", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["a"]
        assert r["hidden_unverified"] == 1
        assert r["trust_policy"] == "verified-only"
        err = capsys.readouterr().err
        assert "1 unverified run card(s) hidden" in err
        assert "--include-unverified" in err
        assert any("verified-only" in x["reason"] for x in r["excluded"])

    def test_include_unverified_records_policy_and_ranks_them(self, db, capsys):
        db.cards = {c["id"]: c for c in [_card("a", chrf=70.0),
                                         _card("u", chrf=80.0, trust="unverified")]}
        db.submissions = [_sub("a"), _sub("u", i=2)]
        r = build_ranking("beta-2026", include_unverified=True, use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["u", "a"]
        assert r["trust_policy"] == "include-unverified"
        assert r["hidden_unverified"] == 0
        assert "hidden" not in capsys.readouterr().err

    def test_other_sets_segregated_by_dataset_id(self, db):
        db.cards = {c["id"]: c for c in [
            _card("a", chrf=70.0),
            _card("s1", chrf=90.0, dataset_id="set-secret"),
            _card("s2", chrf=85.0, dataset_id="set-secret"),
            _card("dev", chrf=95.0, dataset_id="set-dev"),
        ]}
        db.submissions = [_sub("a"), _sub("s1", i=2), _sub("s2", i=3), _sub("dev", i=4)]
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["a"]
        sets = {s["dataset_id"]: s for s in r["other_sets"]}
        assert set(sets) == {"set-secret", "set-dev"}
        assert [e["run_card_id"] for e in sets["set-secret"]["entries"]] == ["s1", "s2"]
        assert [e["rank"] for e in sets["set-secret"]["entries"]] == [1, 2]
        assert "not comparable" in sets["set-secret"]["note"]

    def test_unscored_and_missing_cards_surfaced(self, db):
        db.cards = {c["id"]: c for c in [_card("a", chrf=70.0), _card("n", chrf=None, bleu=5.0)]}
        db.submissions = [_sub("a"), _sub("n", i=2), _sub("ghost", i=3)]
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["a"]
        assert r["unscored"][0]["run_card_id"] == "n"
        assert "chrF++" in r["unscored"][0]["reason"]
        assert any(x["run_card_id"] == "ghost" and "not found" in x["reason"]
                   for x in r["excluded"])

    def test_segments_drive_rung1_and_ties_chain(self, db):
        """alpha ≫ bravo ≫ charlie ≈ delta (byte-identical) → 1, 2, 3, 3."""
        n = 40
        alpha, bravo = _perfect(n), _half_wrong(n)
        charlie = [_seg(i, r, "nothing like it at all") for i, r in enumerate(_refs(n))]
        delta = [dict(e) for e in charlie]
        db.cards = {c["id"]: c for c in [
            _card("alpha", chrf=100.0, corpus_size=n),
            _card("bravo", chrf=60.0, corpus_size=n),
            _card("charlie", chrf=10.0, corpus_size=n),
            _card("delta", chrf=10.0, corpus_size=n),
        ]}
        db.entries = {"alpha": alpha, "bravo": bravo, "charlie": charlie, "delta": delta}
        db.submissions = [_sub("alpha", i=1), _sub("bravo", i=2), _sub("charlie", i=3),
                          _sub("delta", i=4, at="2026-09-06T11:00:00Z")]
        r = build_ranking("beta-2026", n_resamples=150, seed=3)
        assert [e["run_card_id"] for e in r["entries"]] == ["alpha", "bravo", "charlie", "delta"]
        assert [e["rank"] for e in r["entries"]] == [1, 2, 3, 3]
        assert [e["tie_group"] for e in r["entries"]] == [1, 2, 3, 3]
        # The tied pair occupies ranks 3-4 and says so.
        assert [(e["rank_min"], e["rank_max"]) for e in r["entries"]] == \
            [(1, 1), (2, 2), (3, 4), (3, 4)]
        ev = r["entries"][3]["tie_evidence"]
        assert ev["method"] == "approximate_randomization" and ev["tied"] is True
        assert r["ranking_method"]["evidence_used"] == ["approximate_randomization"]
        assert r["ranking_method"]["segments_consulted"] is True

    def test_segments_paginate_and_incomplete_set_falls_back(self, db):
        n = 40
        db.cards = {c["id"]: c for c in [
            _card("a", chrf=100.0, corpus_size=n, chrf_ci=(99, 100)),
            _card("b", chrf=60.0, corpus_size=n, chrf_ci=(55, 65)),
        ]}
        db.entries = {"a": _perfect(n), "b": _half_wrong(n)[:n - 1]}   # b incomplete
        db.submissions = [_sub("a"), _sub("b", i=2)]
        monkeypatch_page = 16
        cr._SEGMENT_PAGE, saved = monkeypatch_page, cr._SEGMENT_PAGE
        try:
            r = build_ranking("beta-2026", n_resamples=50)
        finally:
            cr._SEGMENT_PAGE = saved
        ev = r["entries"][1]["tie_evidence"]
        assert ev["method"] == "ci_overlap"
        assert "incomplete (39/40)" in ev["reason"]
        # pagination: 40 rows at 16/page = 3 pages for card a
        pages_a = [c for c in db.calls if c[1] == "run_card_entries" and c[2]["run_card_id"] == "eq.a"]
        assert len(pages_a) == 3

    def test_no_segments_flag_skips_entries_fetch(self, db):
        db.cards = {c["id"]: c for c in [_card("a", chrf=70.0), _card("b", chrf=60.0)]}
        db.entries = {"a": _perfect(10), "b": _perfect(10)}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert not any(c[1] == "run_card_entries" for c in db.calls)
        assert r["entries"][1]["tie_evidence"]["method"] == "point_equality"
        assert r["ranking_method"]["segments_consulted"] is False

    def test_missing_contest_is_a_ranking_error(self, db):
        with pytest.raises(RankingError, match="not found"):
            build_ranking("no-such-contest")

    def test_session_identity_recorded_and_passed(self, db):
        db.cards = {"a": _card("a", chrf=1.0)}
        db.submissions = [_sub("a")]
        sess = {"access_token": "t", "user": {"email": "org@example.org"}}
        r = build_ranking("beta-2026", session=sess, use_segments=False)
        assert r["generated_by"] == "org@example.org"
        assert all(c[3] is sess for c in db.calls)

    def test_parameter_validation(self, db):
        with pytest.raises(ValueError):
            build_ranking("beta-2026", tie_test="welch")
        with pytest.raises(ValueError):
            build_ranking("beta-2026", alpha=1.5)
        with pytest.raises(ValueError):
            build_ranking("beta-2026", n_resamples=0)
        with pytest.raises(RankingError, match="Unknown track"):
            build_ranking("beta-2026", track="open")


# ---------------------------------------------------------------------------
# Practice 3 — primary vs contrastive
# ---------------------------------------------------------------------------

class TestPrimaryAndContrastive:
    def _db(self, db):
        db.cards = {c["id"]: c for c in [
            _card("p1", chrf=70.0), _card("p2", chrf=60.0),
            _card("c1", chrf=90.0), _card("c2", chrf=50.0),
        ]}
        db.submissions = [
            _sub("p1", i=1), _sub("p2", i=2),
            _sub("c1", i=3, is_primary=False), _sub("c2", i=4, is_primary=False),
        ]
        return build_ranking("beta-2026", use_segments=False)

    def test_only_primary_entries_compete_for_rank(self, db):
        r = self._db(db)
        assert [e["run_card_id"] for e in r["entries"]] == ["p1", "p2"]
        # The best score in the contest belongs to a contrastive entry; it does
        # not win, and it is not hidden either.
        assert [e["run_card_id"] for e in r["contrastive"]] == ["c1", "c2"]
        assert r["entries"][0]["rank"] == 1 and r["contrastive"][0]["rank"] == 1

    def test_contrastive_never_shares_a_tie_group_with_a_primary(self, db):
        r = self._db(db)
        for e in r["contrastive"]:
            assert e["is_primary"] is False
            assert e["tie_evidence"] is None or e["tie_evidence"]["vs"] in ("c1", "c2")

    def test_a_contrastive_entry_is_never_prize_eligible(self, db):
        db.contest["metadata"] = {"prize_terms": {"disposition": "retain_ip"}}
        r = self._db(db)
        assert all(e["prize_eligible"] is False for e in r["contrastive"])

    def test_csv_labels_the_contrastive_section(self, db):
        rows = ranking_to_csv_rows(self._db(db))
        assert [row[0] for row in rows[1:]] == ["main", "main", "contrastive", "contrastive"]


# ---------------------------------------------------------------------------
# Practice 4 — constrained / unconstrained tracks
# ---------------------------------------------------------------------------

class TestTracks:
    def _db(self, db, **contest_metadata):
        db.contest["metadata"] = contest_metadata
        db.cards = {c["id"]: c for c in [
            _card("u1", chrf=90.0), _card("u2", chrf=80.0),
            _card("k1", chrf=70.0), _card("k2", chrf=60.0),
        ]}
        db.submissions = [
            _sub("u1", i=1), _sub("u2", i=2),
            _sub("k1", i=3, track="constrained"),
            _sub("k2", i=4, track="constrained"),
        ]
        return db

    def test_each_track_is_ranked_on_its_own(self, db):
        self._db(db)
        r = build_ranking("beta-2026", use_segments=False)
        by_id = {e["run_card_id"]: e for e in r["entries"]}
        # The best constrained system ranks 1 in its own track even though two
        # unconstrained systems scored higher overall.
        assert by_id["k1"]["rank"] == 1 and by_id["k1"]["track"] == "constrained"
        assert by_id["u1"]["rank"] == 1 and by_id["u1"]["track"] == "unconstrained"
        assert by_id["k2"]["rank"] == 2 and by_id["u2"]["rank"] == 2
        assert set(r["by_track"]) == {"constrained", "unconstrained"}
        assert r["by_track"]["constrained"]["run_card_ids"] == ["k1", "k2"]
        assert "within-track" in r["by_track"]["constrained"]["note"]

    def test_allowed_tracks_excludes_with_a_listed_reason(self, db):
        self._db(db, allowed_tracks=["constrained"])
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["k1", "k2"]
        rules = {x["entry"]: x for x in r["exclusions"]}
        assert rules["u1"]["rule"] == "allowed_tracks"
        assert "allowed_tracks" in rules["u1"]["reason"]

    def test_open_weight_only_excludes_undeclared_and_private_weights(self, db):
        db.contest["metadata"] = {"open_weight_only": True}
        db.cards = {c["id"]: c for c in [_card("open", chrf=70.0),
                                         _card("closed", chrf=90.0),
                                         _card("silent", chrf=80.0)]}
        db.submissions = [
            _sub("open", i=1),
            _sub("closed", i=2, constraints={"weightsPublic": False}),
            _sub("silent", i=3, constraints={}),
        ]
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["open"]
        rules = {x["entry"]: x["rule"] for x in r["exclusions"]}
        assert rules == {"closed": "open_weight_only", "silent": "open_weight_only"}

    def test_track_view_filter_is_labelled_as_a_view_not_a_policy(self, db):
        self._db(db)
        r = build_ranking("beta-2026", use_segments=False, track="constrained")
        assert [e["run_card_id"] for e in r["entries"]] == ["k1", "k2"]
        filtered = [x for x in r["exclusions"] if x["rule"] == "track-filter"]
        assert {x["entry"] for x in filtered} == {"u1", "u2"}
        assert "display filter" in filtered[0]["reason"]

    def test_policy_exclusions_are_banner_counted(self, db, capsys):
        self._db(db, allowed_tracks=["constrained"])
        build_ranking("beta-2026", use_segments=False)
        err = capsys.readouterr().err
        assert "2 entries excluded by a contest POLICY" in err


# ---------------------------------------------------------------------------
# Practice 9 — the system-description requirement
# ---------------------------------------------------------------------------

class TestDescriptionRequirement:
    def test_missing_description_excluded_with_a_banner(self, db, capsys):
        db.contest["metadata"] = {"require_description": True}
        db.cards = {c["id"]: c for c in [_card("described", chrf=70.0),
                                         _card("silent", chrf=90.0),
                                         _card("blank", chrf=80.0)]}
        db.submissions = [_sub("described", i=1),
                          _sub("silent", i=2, description=None),
                          _sub("blank", i=3, description="   ")]
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["described"]
        rules = {x["entry"]: x for x in r["exclusions"]}
        assert rules["silent"]["rule"] == "require_description"
        assert "no system description" in rules["blank"]["reason"]
        assert "2 entries excluded by a contest POLICY" in capsys.readouterr().err

    def test_without_the_policy_an_undescribed_entry_still_ranks(self, db):
        db.cards = {"silent": _card("silent", chrf=90.0)}
        db.submissions = [_sub("silent", description=None)]
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["silent"]
        assert r["entries"][0]["has_description"] is False


# ---------------------------------------------------------------------------
# Practice 10 — the significance policy is the rule, and it is recorded
# ---------------------------------------------------------------------------

class TestTiePolicyInRanking:
    def test_frozen_policy_is_used_and_its_source_recorded(self, db):
        db.contest["metadata"] = {"tie_test": "bootstrap", "alpha": 0.01,
                                  "n_resamples": 60, "seed": 7}
        n = 30
        db.cards = {c["id"]: c for c in [_card("a", chrf=100.0, corpus_size=n),
                                         _card("b", chrf=55.0, corpus_size=n)]}
        db.entries = {"a": _perfect(n), "b": _half_wrong(n)}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026")
        tp = r["tie_policy"]
        assert tp["tie_test"] == "bootstrap" and tp["alpha"] == 0.01
        assert tp["n_resamples"] == 60 and tp["seed"] == 7
        assert set(tp["source"].values()) == {"frozen-metadata"}
        assert r["ranking_method"]["tie_test"] == "bootstrap"
        assert r["entries"][1]["tie_evidence"]["method"] == "paired_bootstrap"

    def test_a_loosening_flag_refuses_the_whole_ranking(self, db):
        db.contest["metadata"] = {"alpha": 0.01}
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        with pytest.raises(RankingError, match="TIGHTEN"):
            build_ranking("beta-2026", alpha=0.5, use_segments=False)

    def test_default_source_when_nothing_was_promised(self, db):
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        r = build_ranking("beta-2026", use_segments=False)
        assert set(r["tie_policy"]["source"].values()) == {"default"}


# ---------------------------------------------------------------------------
# Practice 15 / ruling R1 — handover before scores
# ---------------------------------------------------------------------------

class TestPrizeGate:
    """The gate is whatever the DECLARED terms require — nothing more."""

    _REL = {"release_url": "https://example.org/held/method.tar.gz",
            "release_sha256": "cd" * 32}
    _ASSIGN = {"assignment_instrument_url": "https://example.org/assign.pdf",
               "assignment_recorded_at": "2026-09-07T00:00:00Z"}

    def _prize_db(self, db, *, disposition="retain_ip", execution=None):
        db.contest["metadata"] = {"prize_terms": {"disposition": disposition}}
        if execution is not None:
            db.contest["metadata"][cpt.EXECUTION_KEY] = execution
        db.cards = {c["id"]: c for c in [_card("held", chrf=90.0),
                                         _card("unheld", chrf=70.0)]}
        db.submissions = [
            _sub("held", i=1, request_id="authreq-held"),
            # No authorization request: nothing was handed over for this card.
            _sub("unheld", i=2, request_id=None,
                 release_url="https://example.org/method"),
        ]
        db.requests = [_req("authreq-held")]
        return db

    # -- handover: required by EVERY set of terms ---------------------------

    def test_handover_is_required_by_every_disposition(self, db):
        for disposition in sorted(cpt.DISPOSITIONS):
            assert "handover_verified" in cpt.prize_gate(
                {"disposition": disposition})

    def test_eligible_only_when_the_host_holds_the_method(self, db):
        self._prize_db(db)
        r = build_ranking("beta-2026", use_segments=False)
        elig = r["prize_eligibility"]
        assert elig["held"]["eligible"] is True
        assert elig["held"]["gate"]["handover_verified"] is True
        assert elig["unheld"]["eligible"] is False
        assert "no authorization_request_id" in elig["unheld"]["reason"]
        assert elig["unheld"]["gate"]["handover_verified"] is False
        # A public release URL is NOT a substitute for handover.
        by_id = {e["run_card_id"]: e for e in r["entries"]}
        assert by_id["unheld"]["method_release_url"] == "https://example.org/method"
        assert by_id["unheld"]["prize_eligible"] is False

    def test_a_completed_request_counts_as_handed_over(self, db):
        # Migration 075: a relayed request moves authorized -> completed once
        # its result is recorded. That is stronger evidence of handover, not a
        # lesser state; the gate that demanded 'authorized' refused every
        # entry the node had actually run (2026-09-28 Lima rehearsal).
        self._prize_db(db)
        db.requests = [dict(_req("authreq-held"), state="completed")]
        elig = build_ranking("beta-2026", use_segments=False)["prize_eligibility"]
        assert elig["held"]["gate"]["handover_verified"] is True
        assert elig["held"]["eligible"] is True

    def test_steps_a_contest_does_not_require_read_as_None(self, db):
        self._prize_db(db)
        gate = build_ranking("beta-2026",
                             use_segments=False)["prize_eligibility"]["held"]["gate"]
        assert gate["handover_verified"] is True
        assert gate["release_verified"] is None
        assert gate["assignment_recorded"] is None

    def test_missing_method_sha_or_unauthorized_state_blocks(self, db):
        db.contest["metadata"] = {"prize_terms": {"disposition": "retain_ip"}}
        db.cards = {c["id"]: c for c in [_card("nosha", chrf=70.0),
                                         _card("pending", chrf=60.0)]}
        db.submissions = [_sub("nosha", i=1, request_id="authreq-nosha"),
                          _sub("pending", i=2, request_id="authreq-pending")]
        db.requests = [_req("authreq-nosha", method_sha=""),
                       _req("authreq-pending", state="pending")]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["prize_eligibility"]["nosha"]["eligible"] is False
        assert "method_sha" in r["prize_eligibility"]["nosha"]["reason"]
        assert r["prize_eligibility"]["pending"]["eligible"] is False
        assert "'pending'" in r["prize_eligibility"]["pending"]["reason"]

    # -- release: only when the terms require publication -------------------

    def test_release_is_checked_only_when_the_terms_require_it(self, db):
        self._prize_db(db, disposition="release_open")
        r = build_ranking("beta-2026", use_segments=False)
        verdict = r["prize_eligibility"]["held"]
        assert verdict["eligible"] is False
        assert verdict["gate"]["handover_verified"] is True
        assert verdict["gate"]["release_verified"] is False
        assert "release_verified" in verdict["reason"]

    def test_a_recorded_release_satisfies_it(self, db):
        self._prize_db(db, disposition="release_open", execution={"held": self._REL})
        verdict = build_ranking(
            "beta-2026", use_segments=False)["prize_eligibility"]["held"]
        assert verdict["eligible"] is True
        assert verdict["gate"]["release_verified"] is True

    def test_a_release_record_without_a_digest_does_not_count(self, db):
        self._prize_db(db, disposition="release_open",
                       execution={"held": {"release_url": self._REL["release_url"]}})
        verdict = build_ranking(
            "beta-2026", use_segments=False)["prize_eligibility"]["held"]
        assert verdict["eligible"] is False
        assert "release_sha256" in verdict["reason"]

    def test_release_after_prize_is_never_a_payout_check(self):
        terms = {"disposition": "release_open",
                 "release": "required_after_prize"}
        assert "release_verified" not in cpt.prize_gate(terms)
        assert "AFTER payout" in cpt.describe(terms)

    # -- assignment: presence, never law ------------------------------------

    def test_assignment_is_checked_only_under_assignment_terms(self, db):
        self._prize_db(db, disposition="pass_to_holders")
        verdict = build_ranking(
            "beta-2026", use_segments=False)["prize_eligibility"]["held"]
        assert verdict["eligible"] is False
        assert verdict["gate"]["assignment_recorded"] is False
        assert "assignment_instrument_url" in verdict["reason"]

    def test_a_recorded_assignment_satisfies_it_and_says_it_is_presence_only(
            self, db):
        self._prize_db(db, disposition="pass_to_holders", execution={"held": self._ASSIGN})
        verdict = build_ranking(
            "beta-2026", use_segments=False)["prize_eligibility"]["held"]
        assert verdict["eligible"] is True
        assert verdict["gate"]["assignment_recorded"] is True
        assert "never verifies law" in verdict["reason"]

    def test_the_record_may_be_filed_under_the_request_id(self, db):
        self._prize_db(db, disposition="pass_to_holders",
                       execution={"authreq-held": self._ASSIGN})
        verdict = build_ranking(
            "beta-2026", use_segments=False)["prize_eligibility"]["held"]
        assert verdict["eligible"] is True

    # -- the close gate -----------------------------------------------------

    def test_gate_blocks_a_close_when_the_WINNER_fails(self, db):
        # `held` is the top entry (chrF 90) and holds nothing published.
        self._prize_db(db, disposition="release_open")
        r = build_ranking("beta-2026", use_segments=False)
        ok, reasons = handover_gate_ok(r)
        assert ok is False
        assert any("held" in x for x in reasons)
        assert "release_verified" in reasons[0]
        # close_contest reads the same verdict as a mapping (both spellings).
        gate = handover_gate_ok(r)
        assert gate.get("ok") is False and "held" in gate.get("reason")
        assert gate.get("reasons") == reasons

    def test_a_losing_entry_never_blocks_the_close(self, db):
        # `unheld` (rank 2, no handover) must not hold the contest open.
        self._prize_db(db)
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["held", "unheld"]
        assert r["prize_eligibility"]["unheld"]["eligible"] is False
        ok, reasons = handover_gate_ok(r)
        assert ok is True and reasons == []

    def test_each_track_has_its_own_winner(self, db):
        db.contest["metadata"] = {"prize_terms": {"disposition": "retain_ip"}}
        db.cards = {c["id"]: c for c in [_card("c-win", chrf=90.0),
                                         _card("u-win", chrf=80.0)]}
        db.submissions = [_sub("c-win", i=1, track="constrained",
                               request_id=None),
                          _sub("u-win", i=2, track="unconstrained",
                               request_id="authreq-u")]
        db.requests = [_req("authreq-u")]
        r = build_ranking("beta-2026", use_segments=False)
        ok, reasons = handover_gate_ok(r)
        assert ok is False
        # The constrained winner blocks; the unconstrained one passed.
        assert any("c-win" in x for x in reasons)
        assert not any("u-win" in x for x in reasons)

    def test_gate_is_open_when_every_winner_satisfies_the_terms(self, db):
        db.contest["metadata"] = {"prize_terms": {"disposition": "retain_ip"}}
        db.cards = {"held": _card("held", chrf=70.0)}
        db.submissions = [_sub("held", request_id="authreq-held")]
        db.requests = [_req("authreq-held")]
        ok, reasons = handover_gate_ok(build_ranking("beta-2026", use_segments=False))
        assert ok is True and reasons == []

    def test_no_prize_terms_means_no_gate_and_no_eligibility(self, db):
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["prize_eligibility"]["a"]["eligible"] is False
        assert "no prize terms declared" in r["prize_eligibility"]["a"]["reason"]
        assert r["prize_eligibility"]["a"]["gate"] == {
            s: None for s in cpt.GATE_STEPS}
        assert handover_gate_ok(r) == (True, [])

    def test_r1_refuses_prize_terms_on_a_standard_lane_contest(self, db):
        db.contest["lane"] = "standard"
        db.contest["metadata"] = {"prize_terms": {"disposition": "retain_ip"}}
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        with pytest.raises(RankingError, match="SOVEREIGN"):
            build_ranking("beta-2026", use_segments=False)

    def test_a_standard_table_headlines_chrf_with_ci_and_no_composite(self, db):
        # Scoring standard/1: chrF++ [CI] first, BLEU / TER / COMET beside
        # it, no composite column and no tier — even when a card still
        # carries a stored composite.
        db.cards = {c["id"]: c for c in [
            _card("a", chrf=47.5, bleu=21.3, chrf_ci=(45.9, 49.0),
                  composite=0.6244),
            _card("b", chrf=30.0, bleu=10.0, chrf_ci=(28.0, 32.0))]}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["metric"] == "chrf_plus_plus" and r["metric_retired"] is None
        text = format_ranking_table(r)
        header = next(l for l in text.splitlines() if "System" in l)
        assert "chrF++" in header and "BLEU" in header and "TER" in header
        assert "COMET" in header
        assert "Comp" not in header and "composite" not in text.lower()
        assert "tier" not in header.lower()
        assert "[45.90, 49.00]" in text
        rows = ranking_to_csv_rows(r)
        assert "composite" not in rows[0] and "legacy_composite" in rows[0]

    def test_a_legacy_composite_contest_still_ranks_and_says_so(self, db):
        # A contest that recorded primary_metric=composite before the
        # standard keeps its promise: it ranks on the stored composite,
        # labelled "legacy composite (retired)", with the retirement said.
        db.contest["metadata"] = {"primary_metric": "composite"}
        db.cards = {c["id"]: c for c in [
            _card("a", chrf=5.5, composite=0.6244),
            _card("b", chrf=47.5, composite=0.4100)]}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["metric"] == "composite"
        assert r["metric_label"] == "legacy composite (retired)"
        assert r["metric_retired"]
        assert [e["run_card_id"] for e in r["entries"]] == ["a", "b"]
        text = format_ranking_table(r)
        header = next(l for l in text.splitlines() if "System" in l)
        assert "legacy composite (retired)" in header
        assert "retired" in text and "chrF++" in header
        # The same contest viewed on the standard headline ranks the real
        # translation first.
        r2 = build_ranking("beta-2026", metric="chrf_plus_plus",
                           use_segments=False)
        assert [e["run_card_id"] for e in r2["entries"]] == ["b", "a"]

    # -- what the artifacts say --------------------------------------------

    def test_the_table_leads_with_the_option_then_the_derived_detail(self, db):
        self._prize_db(db, disposition="release_open", execution={"held": self._REL})
        r = build_ranking("beta-2026", use_segments=False)
        text = format_ranking_table(r)
        terms = r["prize_terms"]["terms"]
        # The OPTION is the headline, printed in words before any dimension.
        assert "Prize terms: release_open" in text
        assert cpt.DISPOSITION_HEADLINES["release_open"] in text
        assert text.index("Prize terms: release_open") < text.index("in detail:")
        for name, value in terms.items():
            if name == "disposition":
                continue
            assert f"{name}={value}" in text
        assert r["prize_terms"]["terms_sha256"] in text
        assert "Traceback" not in text

    def test_the_table_says_plainly_when_there_is_no_prize(self, db):
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        text = format_ranking_table(build_ranking("beta-2026", use_segments=False))
        assert "NO PRIZE" in text

    def test_no_email_reaches_the_ranking_even_with_terms(self, db):
        self._prize_db(db, disposition="pass_to_holders", execution={"held": self._ASSIGN})
        r = build_ranking("beta-2026", use_segments=False)
        assert "@" not in json.dumps(r["prize_terms"])
        assert "@" not in json.dumps(r["prize_eligibility"])



# ---------------------------------------------------------------------------
# Phases
# ---------------------------------------------------------------------------

class TestPhases:
    def _phased(self, db):
        db.cards = {c["id"]: c for c in [_card("prac", chrf=99.0),
                                         _card("eval1", chrf=70.0),
                                         _card("eval2", chrf=60.0),
                                         _card("post", chrf=95.0)]}
        db.submissions = [_sub("prac", i=1, phase="practice"),
                          _sub("eval1", i=2, phase="evaluation"),
                          _sub("eval2", i=3, phase="evaluation"),
                          _sub("post", i=4, phase="post-evaluation")]
        return db

    def test_evaluation_is_the_default_ranked_phase(self, db):
        self._phased(db)
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["entries"]] == ["eval1", "eval2"]
        assert r["phase"]["ranked"] == "evaluation"
        assert r["phase"]["source"] == "default"
        assert r["by_phase"] == {"practice": 1, "evaluation": 2, "post-evaluation": 1}
        rules = {x["entry"]: x["rule"] for x in r["exclusions"]}
        assert rules == {"prac": "phase", "post": "phase"}

    def test_practice_ranking_is_never_a_final_result(self, db):
        self._phased(db)
        r = build_ranking("beta-2026", use_segments=False, phase="practice")
        assert [e["run_card_id"] for e in r["entries"]] == ["prac"]
        assert r["phase"]["freezable"] is False
        assert "never a final result" in r["phase"]["note"]

    def test_phase_all_ranks_everything(self, db):
        self._phased(db)
        r = build_ranking("beta-2026", use_segments=False, phase="all")
        assert len(r["entries"]) == 4
        assert r["phase"]["ranked"] is None and r["phase"]["freezable"] is True

    def test_an_unphased_contest_ranks_every_entry(self, db):
        db.cards = {c["id"]: c for c in [_card("a", chrf=70.0), _card("b", chrf=60.0)]}
        db.submissions = [_sub("a"), _sub("b", i=2)]
        r = build_ranking("beta-2026", use_segments=False)
        assert len(r["entries"]) == 2
        assert r["phase"]["ranked"] is None
        assert r["phase"]["source"] == "unphased-contest"
        assert r["by_phase"] == {"(unset)": 2}

    def test_unknown_phase_is_refused(self, db):
        self._phased(db)
        with pytest.raises(RankingError, match="Unknown phase"):
            build_ranking("beta-2026", use_segments=False, phase="warmup")


# ---------------------------------------------------------------------------
# Identity — pseudonyms, and the email that never rides along
# ---------------------------------------------------------------------------

class TestIdentity:
    def _anon(self, db, **contest_kw):
        db.contest.update(contest_kw)
        db.contest.setdefault("metadata", {})
        db.contest["metadata"] = {**db.contest["metadata"],
                                  "anonymize_until_close": True}
        db.cards = {c["id"]: c for c in [
            _card("a", chrf=70.0, submitter="alice@example.org"),
            _card("b", chrf=60.0)]}
        db.submissions = [_sub("a", i=1, label="Kestrel Lab", team="kestrel"),
                          _sub("b", i=2, label="Marten Lab", team="marten")]
        return db

    def test_pseudonyms_are_deterministic_and_scoped_to_the_contest(self):
        p1 = pseudonym_for("beta-2026", "authreq-1")
        assert p1 == pseudonym_for("beta-2026", "authreq-1")
        assert p1 != pseudonym_for("other-2026", "authreq-1")
        assert re.fullmatch(r"entry-[0-9a-f]{6}", p1)

    def test_anonymised_ranking_shows_no_declared_name(self, db):
        self._anon(db)
        r = build_ranking("beta-2026", use_segments=False)
        assert r["identity_policy"]["anonymized"] is True
        assert r["identity_policy"]["source"] == "contest.metadata.anonymize_until_close"
        blob = json.dumps(r)
        for secret in ("Kestrel Lab", "Marten Lab", "kestrel", "marten", "alice"):
            assert secret not in blob, secret
        for e in r["entries"]:
            assert e["submitter_label"].startswith("entry-")
            assert e["team"].startswith("entry-")

    def test_reveal_identities_shows_the_declared_labels(self, db):
        self._anon(db)
        r = build_ranking("beta-2026", use_segments=False, reveal_identities=True)
        assert r["identity_policy"]["anonymized"] is False
        assert [e["submitter_label"] for e in r["entries"]] == ["Kestrel Lab", "Marten Lab"]

    def test_no_email_on_any_path(self, db):
        """The byline is never a login — revealed or not, ranked or excluded.

        The ONE email a ranking may carry is ``contest.created_by``: the
        organizer's own identity, already a world-readable column of the
        ``contests`` table, and the person who publishes the result. Every
        PARTICIPANT-side field must be a label or a pseudonym.
        """
        db.contest["created_by"] = "organizer.example.org"     # no @ to assert on
        db.cards = {c["id"]: c for c in [
            _card("a", chrf=70.0, submitter="alice@example.org"),
            _card("u", chrf=80.0, trust="unverified", submitter="mallory@example.org")]}
        db.submissions = [
            # An entry whose declared label is itself an email (the exact leak
            # the node's display-identity check exists to stop).
            _sub("a", i=1, label="alice@example.org", team="alice@example.org"),
            _sub("u", i=2, label="Team U"),
        ]
        for kwargs in ({}, {"include_unverified": True},
                       {"reveal_identities": True},
                       {"include_unverified": True, "reveal_identities": True}):
            r = build_ranking("beta-2026", use_segments=False, **kwargs)
            assert "@" not in json.dumps(r), kwargs
            assert "@" not in format_ranking_table(r)
            assert "@" not in "".join(str(c) for row in ranking_to_csv_rows(r) for c in row)
            assert r["identity_policy"]["masked_emails"] >= 1

    def test_check_reveal_permitted_owner_and_closed(self):
        contest = _contest(status="closed")
        sess = {"user": {"email": "org@example.org"}}
        check_reveal_permitted(contest, sess)                      # owner + closed
        check_reveal_permitted(_contest(), None, i_am_the_organizer=True)

    @pytest.mark.parametrize("contest_kw,session", [
        ({}, {"user": {"email": "org@example.org"}}),              # still open
        ({"status": "closed"}, {"user": {"email": "someone@else.org"}}),
        ({"status": "closed"}, None),                              # anonymous
    ])
    def test_check_reveal_permitted_refuses_everyone_else(self, contest_kw, session):
        with pytest.raises(RankingError, match="Refusing --reveal-identities"):
            check_reveal_permitted(_contest(**contest_kw), session)


# ---------------------------------------------------------------------------
# Deferred results (read-only here; close_contest publishes them)
# ---------------------------------------------------------------------------

class TestDeferredResults:
    def test_unpublished_rows_are_counted_and_bannered(self, db, capsys):
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        db.deferred = [
            {"request_id": "authreq-1", "role": "main", "published_run_card_id": None},
            {"request_id": "authreq-2", "role": "holdout", "published_run_card_id": None},
            {"request_id": "authreq-0", "role": "main", "published_run_card_id": "rc-0"},
        ]
        r = build_ranking("beta-2026", use_segments=False)
        d = r["deferred_results"]
        assert d["count"] == 2 and d["readable"] is True
        assert d["by_role"] == {"main": 1, "holdout": 1}
        assert "close" in d["note"] and "RLS" in d["note"]
        assert "WITHHELD" in capsys.readouterr().err

    def test_a_pre_074_endpoint_reports_the_reason_not_a_zero(self, db):
        db.missing = {"contest_deferred_results"}
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["deferred_results"]["count"] is None
        assert r["deferred_results"]["readable"] is False
        assert "074" in r["deferred_results"]["note"]


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

class TestRendering:
    def _ranking(self, db):
        db.cards = {c["id"]: c for c in [
            _card("a", chrf=70.0, bleu=30.0, comet=0.8, composite=0.7, chrf_ci=(68, 72)),
            _card("b", chrf=70.0, bleu=25.0, chrf_ci=(66, 74)),
            _card("s", chrf=50.0, dataset_id="set-secret"),
            _card("n", chrf=None),
            _card("u", chrf=1.0, trust="unverified"),
            _card("k", chrf=44.0),
        ]}
        db.submissions = [_sub("a", i=1, team="alpha"), _sub("b", i=2), _sub("s", i=3),
                          _sub("n", i=4), _sub("u", i=5),
                          _sub("k", i=6, is_primary=False, track="constrained")]
        db.requests = [_req("authreq-live", state="pending"),
                       _req("authreq-dead", state="denied")]
        return build_ranking("beta-2026", use_segments=False)

    def test_table_renders_every_section_without_traceback(self, db):
        text = format_ranking_table(self._ranking(db))
        assert "Traceback" not in text
        for needle in ("Contest beta-2026", "chrF++", "verified-only", "TIE",
                       "ci_overlap", "Unscored", "Excluded", "Other set set-secret",
                       "In flight", "Refused entries", "Competition ranking",
                       "Track: unconstrained", "Contrastive entries",
                       "Identities:", "Phase:"):
            assert needle in text, needle

    def test_table_tolerates_minimal_dict(self):
        text = format_ranking_table({"contest": {}, "entries": []})
        assert "no rankable entries" in text and "Traceback" not in text

    def test_table_shows_a_rank_range_for_a_tie(self, db):
        text = format_ranking_table(self._ranking(db))
        assert "1-2" in text     # a and b tie on overlapping CIs

    def test_csv_columns_and_rows(self, db):
        rows = ranking_to_csv_rows(self._ranking(db))
        assert rows[0] == list(cr.CSV_COLUMNS)
        assert rows[0][:6] == ["set", "dataset_id", "rank", "tie_group", "run_card_id", "model_slug"]
        body = rows[1:]
        assert [r[4] for r in body] == ["a", "b", "k", "s"]
        assert [r[0] for r in body] == ["main", "main", "contrastive", "other"]
        assert all(len(r) == len(cr.CSV_COLUMNS) for r in rows)
        buf = io.StringIO()
        csv.writer(buf).writerows(rows)
        assert "ci_overlap" in buf.getvalue()

    def test_csv_carries_the_declaration_columns_and_no_login(self, db):
        rows = ranking_to_csv_rows(self._ranking(db))
        cols = list(cr.CSV_COLUMNS)
        for name in ("is_primary", "track", "phase", "rank_min", "rank_max",
                     "prize_eligible", "submitter_label_or_pseudonym"):
            assert name in cols, name
        assert "submitted_by" not in cols, "a CSV of a frozen ranking is published"
        first = rows[1]
        assert first[cols.index("rank_min")] == 1 and first[cols.index("rank_max")] == 2
        assert first[cols.index("is_primary")] is True
        assert first[cols.index("track")] == "unconstrained"
        assert first[cols.index("submitter_label_or_pseudonym")] == "lab-a"


# ---------------------------------------------------------------------------
# Contract C7 — runtime is REPORTED, never ranked.
#
# The temptation this guards against: a fast method looks better, so a
# runtime column quietly becomes a sort key or a tiebreak. It must not. The
# organizer's node is the only machine that ever runs these methods, so its
# wall clock says as much about the node's load as about the method — an
# efficiency track would need a design nobody has written yet, and until then
# the honest answer is the explicit None.
# ---------------------------------------------------------------------------

class TestExecutionReportedNeverRanked:
    def _two_cards(self, db):
        """A SLOWER card with the better score, and a fast card below it."""
        db.cards = {c["id"]: c for c in [
            _card("slow", chrf=70.0, bleu=30.0,
                  execution=_execution(412.5),
                  by_test_suite={"suite-x": {"chrf_plus_plus": 33.1,
                                             "evaluated": 6}}),
            _card("fast", chrf=60.0, bleu=25.0, execution=_execution(3.25)),
        ]}
        db.submissions = [_sub("slow", i=1), _sub("fast", i=2)]
        return build_ranking("beta-2026", use_segments=False)

    def test_execution_reported_never_ranked(self, db):
        r = self._two_cards(db)
        # The slower system ranks FIRST because it scores higher. Runtime
        # changed nothing about the order.
        assert [e["run_card_id"] for e in r["entries"]] == ["slow", "fast"]
        assert r["entries"][0]["execution"]["runtime_seconds"] == 412.5
        assert r["entries"][1]["execution"]["runtime_seconds"] == 3.25
        # It is not a tiebreak either.
        assert "runtime_seconds" not in r["tiebreak_order"]
        assert "execution" not in r["tiebreak_order"]
        # And the absence of an efficiency track is stated, not implied.
        assert "efficiency_track" in r
        assert r["efficiency_track"] is None
        note = r["ranking_method"]["note"]
        assert "runtime_seconds is reported, never ranked" in note
        assert "efficiency track does not exist yet" in note
        json.dumps(r)

    def test_reported_execution_fields_are_the_run_conditions(self, db):
        r = self._two_cards(db)
        execution = r["entries"][0]["execution"]
        assert set(execution) == set(cr._EXECUTION_REPORTED)
        assert execution["cpus"] == 4 and execution["ram_gb"] == 8.0
        assert execution["gpu"] is False
        assert execution["node_id"] == "lima-airgap-1"
        assert execution["image_digest"].startswith("sha256:")
        # Third-party test suites ride through untouched, and are equally
        # never a rank key.
        assert r["entries"][0]["by_test_suite"]["suite-x"]["chrf_plus_plus"] \
            == 33.1
        assert r["entries"][1]["by_test_suite"] is None

    def test_cards_without_execution_report_none_not_zero(self, db):
        """A pre-C4 card measured nothing. None says so; 0 would lie."""
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["entries"][0]["execution"] is None
        assert r["entries"][0]["by_test_suite"] is None
        rows = ranking_to_csv_rows(r)
        runtime_col = list(cr.CSV_COLUMNS).index("runtime_seconds")
        assert rows[1][runtime_col] is None
        assert "—" in format_ranking_table(r)

    def test_select_aliases_the_json_paths(self):
        """Neither field has a column — both are aliased out of run_card."""
        assert "execution:run_card->execution" in cr._RUN_CARD_SELECT
        assert "by_test_suite:run_card->by_test_suite" in cr._RUN_CARD_SELECT

    def test_csv_and_table_report_runtime(self, db):
        r = self._two_cards(db)
        rows = ranking_to_csv_rows(r)
        assert "runtime_seconds" in cr.CSV_COLUMNS
        runtime_col = list(cr.CSV_COLUMNS).index("runtime_seconds")
        # Reported AFTER every score column, so no reader reads its position
        # as precedence.
        assert runtime_col > list(cr.CSV_COLUMNS).index("legacy_composite")
        assert [row[runtime_col] for row in rows[1:]] == [412.5, 3.25]
        buf = io.StringIO()
        csv.writer(buf).writerows(rows)
        assert "412.5" in buf.getvalue()

        text = format_ranking_table(r)
        assert "Runtime" in text
        assert "412.5s" in text and "3.2s" in text
        assert "runtime_seconds is reported, never ranked" in text


# ---------------------------------------------------------------------------
# export_contest — frozen vs provisional vs refusal
# ---------------------------------------------------------------------------

class TestExportContest:
    def test_open_contest_exports_live_provisional(self, db):
        db.cards = {"a": _card("a", chrf=70.0)}
        db.submissions = [_sub("a")]
        out = export_contest("beta-2026", use_segments=False)
        assert out["frozen"] is False and out["provisional"] is True
        assert out["export_source"].startswith("live")
        assert out["entries"][0]["run_card_id"] == "a"

    def test_closed_contest_exports_frozen_snapshot_verbatim(self, db):
        snapshot = {"metric": "bleu", "trust_policy": "include-unverified",
                    "entries": [{"rank": 1, "run_card_id": "frozen-card"}]}
        db.contest.update({"status": "closed",
                           "metadata": {"primary_metric": "bleu",
                                        "final_ranking": snapshot,
                                        "closed_at": "2026-09-06T12:00:00Z",
                                        "closed_by": "org@example.org"}})
        db.cards = {"live": _card("live", chrf=99.0)}
        db.submissions = [_sub("live")]
        out = export_contest("beta-2026")
        assert out["frozen"] is True and out["provisional"] is False
        assert out["entries"][0]["run_card_id"] == "frozen-card"   # never recomputed
        assert out["closed_at"] == "2026-09-06T12:00:00Z"
        assert out["export_source"] == "contests.metadata.final_ranking"
        assert not any(c[1] == "run_cards" for c in db.calls)

    def test_closed_without_snapshot_is_refused(self, db):
        db.contest.update({"status": "closed", "metadata": {}})
        with pytest.raises(RankingError, match="no frozen metadata.final_ranking"):
            export_contest("beta-2026")

    def test_closed_refuses_view_overrides(self, db):
        db.contest.update({"status": "closed",
                           "metadata": {"final_ranking": {"metric": "chrf_plus_plus"}}})
        with pytest.raises(RankingError, match="exported verbatim"):
            export_contest("beta-2026", include_unverified=True)
        with pytest.raises(RankingError, match="exported verbatim"):
            export_contest("beta-2026", phase="practice")
        with pytest.raises(RankingError, match="exported verbatim"):
            export_contest("beta-2026", track="constrained")


# ---------------------------------------------------------------------------
# The holdout split (practice 7, M3-wire 2026-09-07): reported, never ranked.
# ---------------------------------------------------------------------------

class TestHoldoutSection:
    def _world(self, db, **contest_kw):
        db.contest.update(contest_kw)
        db.cards = {c["id"]: c for c in [
            _card("a", chrf=70.0),
            _card("b", chrf=60.0),
            _card("h_a", chrf=68.0, dataset_id="set-holdout"),
            _card("h_b", chrf=55.0, dataset_id="set-holdout"),
        ]}
        db.submissions = [
            _sub("a"), _sub("b", i=2),
            _sub("h_a", i=3, at="2026-09-06T11:00:00Z"),
            _sub("h_b", i=4, at="2026-09-06T12:00:00Z", is_primary=False),
        ]

    def test_no_holdout_declared_is_an_explicit_none(self, db):
        db.cards = {c["id"]: c for c in [_card("a", chrf=70.0)]}
        db.submissions = [_sub("a")]
        r = build_ranking("beta-2026", use_segments=False)
        assert r["holdout"] is None

    def test_holdout_cards_are_reported_and_never_ranked(self, db):
        self._world(db, metadata={"sealed_holdout_set_id": "set-holdout"})
        r = build_ranking("beta-2026", use_segments=False)
        # The MAIN ranking is untouched by them.
        assert [e["run_card_id"] for e in r["entries"]] == ["a", "b"]
        assert r["other_sets"] == [], "the holdout is not a stray other set"

        section = r["holdout"]
        assert section["set_id"] == "set-holdout"
        assert section["count"] == 2
        # Ordered by submission time — an order by SCORE would be a ranking.
        assert [e["run_card_id"] for e in section["entries"]] == ["h_a", "h_b"]
        for e in section["entries"]:
            assert e["rank"] is None and e["tie_group"] is None
            assert e["rank_min"] is None and e["rank_max"] is None
            # Same payload SHAPE as a ranked entry — one shape to read.
            for key in ("run_card_id", "primary", "scores", "track",
                        "submitter_label", "dataset_id", "execution"):
                assert key in e, key
        assert section["entries"][0]["primary"]["value"] == 68.0
        assert "never ranked" in section["note"]
        assert "withheld until the contest closes" in section["note"]

    def test_a_holdout_card_is_never_excluded_by_a_ranking_policy(self, db):
        """Track / description / phase policies decide who is RANKED. A
        holdout result is not in the running, so a policy must not record it
        as excluded — that would read as a participant losing something."""
        self._world(db, metadata={"sealed_holdout_set_id": "set-holdout",
                                  "require_description": True,
                                  "allowed_tracks": ["constrained"]})
        db.submissions[2]["description"] = ""
        db.submissions[3]["description"] = ""
        r = build_ranking("beta-2026", use_segments=False)
        assert r["holdout"]["count"] == 2
        excluded_ids = {x["entry"] for x in r["exclusions"]}
        assert excluded_ids == {"a", "b"}, excluded_ids

    def test_a_disqualified_holdout_card_is_not_reported(self, db):
        self._world(db, metadata={"sealed_holdout_set_id": "set-holdout"})
        db.cards["h_b"]["trust"] = "disqualified"
        r = build_ranking("beta-2026", use_segments=False)
        assert [e["run_card_id"] for e in r["holdout"]["entries"]] == ["h_a"]

    def test_a_holdout_entry_never_wins_a_prize(self, db):
        self._world(db, metadata={
            "sealed_holdout_set_id": "set-holdout",
            "prize_terms": {"disposition": "retain_ip"}})
        r = build_ranking("beta-2026", use_segments=False)
        assert set(r["prize_eligibility"]) == {"a", "b"}
        for e in r["holdout"]["entries"]:
            assert "prize_eligible" not in e or e["prize_eligible"] is False

    def test_the_table_says_the_holdout_exists(self, db):
        self._world(db, metadata={"sealed_holdout_set_id": "set-holdout"})
        r = build_ranking("beta-2026", use_segments=False)
        table = format_ranking_table(r)
        assert "Holdout split set-holdout (2 result(s))" in table
        assert "never ranked" in table
        # No rank column for them: a blank where a rank would be still reads
        # as a rank.
        holdout_lines = [ln for ln in table.splitlines()
                         if "sys/h_a" in ln or "sys/h_b" in ln]
        assert len(holdout_lines) == 2
        assert all(ln.lstrip().startswith("•") for ln in holdout_lines)
