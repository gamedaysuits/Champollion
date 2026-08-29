"""Reputation-weighted auditing (B3) — the pure core.

These tests pin the properties the trust model rests on:
  · sampling probability = f(reputation ↓, stakes ↑, anomaly ↑), with the
    stakes/anomaly override that always audits the runs that matter most;
  · reputation is earned ONLY by hard-to-fake signals (clean L2 audit, L3
    corroboration) — never by an L0 pass alone (Sybil resistance);
  · one caught fraud burns reputation to zero and marks the record, and the
    run-outcome planner signals the history re-audit;
  · corroboration detects only GENUINELY independent replications and classifies
    agreement / disagreement / inconclusive honestly.

All pure — no DB, no network. See docs/TRUST_MODEL_REPUTATION.md.
"""

from __future__ import annotations

from mt_eval_harness import reputation as r


# ---------------------------------------------------------------------------
# Sampling policy: audit_probability
# ---------------------------------------------------------------------------

class TestAuditProbability:
    def test_new_contributor_always_audited(self):
        # reputation below ESTABLISHED_AT → every run sampled until trust earned.
        assert r.audit_probability(0, False, 0.0) == 1.0
        assert r.audit_probability(r.ESTABLISHED_AT - 1, False, 0.0) == 1.0

    def test_just_established_uses_base_rate(self):
        assert r.audit_probability(r.ESTABLISHED_AT, False, 0.0) == r.BASE_RATE

    def test_fully_trusted_hits_the_floor(self):
        assert r.audit_probability(r.FULL_TRUST, False, 0.0) == r.MIN_RATE
        # Never below the floor even far past FULL_TRUST — a trusted identity that
        # later turns must still be catchable.
        assert r.audit_probability(10_000, False, 0.0) == r.MIN_RATE

    def test_rate_decays_monotonically_with_reputation(self):
        pts = [r.audit_probability(rep, False, 0.0)
               for rep in range(r.ESTABLISHED_AT, r.FULL_TRUST + 1, 5)]
        assert pts == sorted(pts, reverse=True)
        assert all(r.MIN_RATE <= p <= 1.0 for p in pts)

    def test_new_bridge_overrides_any_reputation(self):
        # A run that lights a new bridge for a family is always audited.
        assert r.audit_probability(r.FULL_TRUST, True, 0.0) == 1.0
        assert r.audit_probability(10_000, True, 0.0) == 1.0

    def test_hard_anomaly_overrides_any_reputation(self):
        assert r.audit_probability(r.FULL_TRUST, False, r.ANOMALY_HARD) == 1.0
        assert r.audit_probability(r.FULL_TRUST, False, r.ANOMALY_HARD + 5) == 1.0

    def test_soft_anomaly_boosts_but_does_not_force(self):
        p = r.audit_probability(r.FULL_TRUST, False, r.ANOMALY_SOFT)
        assert p == r.SOFT_ANOMALY_RATE           # pulled up to the soft rate
        assert r.MIN_RATE < p < 1.0

    def test_below_soft_anomaly_no_boost(self):
        p = r.audit_probability(r.FULL_TRUST, False, r.ANOMALY_SOFT - 0.1)
        assert p == r.MIN_RATE


class TestAnomalyScore:
    def test_first_light_is_high_stakes(self):
        # No prior verified result for the pair → force an audit.
        assert r.anomaly_score(80.0, None) == r.ANOMALY_HARD

    def test_below_prior_best_is_unremarkable(self):
        assert r.anomaly_score(70.0, 80.0) == 0.0

    def test_jump_above_prior_best_is_the_surprise(self):
        assert r.anomaly_score(90.0, 80.0) == 10.0

    def test_missing_score_is_zero(self):
        assert r.anomaly_score(None, 80.0) == 0.0


class TestShouldAudit:
    def test_deterministic_across_calls(self):
        # Same run id → same decision (no persisted RNG), so replays are stable.
        a = r.should_audit("run-xyz", r.FULL_TRUST, False, 0.0)
        b = r.should_audit("run-xyz", r.FULL_TRUST, False, 0.0)
        assert a is b

    def test_probability_one_always_audits(self):
        assert r.should_audit("anything", 0, False, 0.0) is True
        assert r.should_audit("anything", r.FULL_TRUST, True, 0.0) is True

    def test_floor_rate_samples_a_minority_but_not_none(self):
        # Over many ids at the floor rate, some are audited and most are not.
        ids = [f"run-{i}" for i in range(2000)]
        audited = sum(r.should_audit(i, r.FULL_TRUST, False, 0.0) for i in ids)
        frac = audited / len(ids)
        assert 0 < audited < len(ids)
        assert abs(frac - r.MIN_RATE) < 0.03    # empirical rate ≈ MIN_RATE


# ---------------------------------------------------------------------------
# Reputation accrual + burn
# ---------------------------------------------------------------------------

class TestAccrual:
    def test_l0_pass_earns_no_reputation(self):
        # L0 reproducibility is necessary for 'verified' but free to fake in the
        # reference-copy case, so it must not build trust by itself.
        s = r.ReputationState.new("uid:a")
        s2, rec = r.record_l0_pass(s, "c1")
        assert s2.reputation == 0
        assert s2.verified_runs == 1           # track record, not trust
        assert rec.layer == "L0" and rec.outcome == "pass"
        assert rec.reputation_delta == 0

    def test_clean_audit_is_the_primary_earner(self):
        s = r.ReputationState.new("uid:a")
        s2, rec = r.record_clean_audit(s, "c1")
        assert s2.reputation == r.REP_PER_CLEAN_AUDIT
        assert s2.clean_audits == 1 and s2.total_audits == 1
        assert rec.layer == "L2" and rec.outcome == "pass"

    def test_three_clean_audits_reach_established(self):
        s = r.ReputationState.new("uid:a")
        for i in range(3):
            s, _ = r.record_clean_audit(s, f"c{i}")
        assert s.reputation == 30 == r.ESTABLISHED_AT
        assert s.status == "established"

    def test_corroboration_earns_reputation(self):
        s = r.ReputationState.new("uid:a")
        s2, rec = r.record_corroboration(s, "c1")
        assert s2.reputation == r.REP_PER_CORROBORATION
        assert s2.corroborations == 1
        assert rec.layer == "L3" and rec.outcome == "corroborated"

    def test_status_provisional_until_threshold(self):
        assert r.status_for(0, 0) == "provisional"
        assert r.status_for(r.ESTABLISHED_AT - 1, 0) == "provisional"
        assert r.status_for(r.ESTABLISHED_AT, 0) == "established"


class TestBurn:
    def test_burn_zeroes_reputation_and_marks_record(self):
        s = r.ReputationState.new("uid:a")
        for i in range(4):                       # climb to reputation 40
            s, _ = r.record_clean_audit(s, f"c{i}")
        assert s.reputation == 40 and s.status == "established"
        burned, rec = r.record_burn(s, "bad", layer="L0")
        assert burned.reputation == 0
        assert burned.status == "burned"
        assert burned.caught_fraud_count == 1
        assert rec.outcome == "burn"
        assert rec.reputation_delta == -40      # the full loss
        assert rec.reputation_after == 0

    def test_burned_status_is_sticky_until_re_earned(self):
        # A contributor with fraud on record reads 'burned' until reputation
        # climbs back to the established threshold; the scar (fraud count) stays.
        assert r.status_for(0, 1) == "burned"
        assert r.status_for(r.ESTABLISHED_AT - 5, 1) == "burned"
        assert r.status_for(r.ESTABLISHED_AT, 1) == "established"

    def test_reaudit_record_moves_no_reputation(self):
        rec = r.record_reaudit("uid:a", "old-run")
        assert rec.outcome == "reaudit"
        assert rec.reputation_delta == 0
        assert rec.layer == "L2"


# ---------------------------------------------------------------------------
# Run-outcome planner
# ---------------------------------------------------------------------------

class TestPlanL0Outcome:
    def test_pass_promotes_and_records_l0(self):
        s = r.ReputationState.new("uid:a")
        plan = r.plan_l0_outcome(
            s, "c1", ok=True, reason="matches", is_new_bridge=False,
            anomaly=0.0, reexecutor_available=False, recomputed_chrf=42.0)
        assert plan.new_trust == "verified"
        assert plan.burn is False
        assert plan.records[0].layer == "L0"
        assert plan.state.verified_runs == 1

    def test_new_contributor_pass_is_selected_for_l2(self):
        s = r.ReputationState.new("uid:a")     # reputation 0 → always sampled
        plan = r.plan_l0_outcome(
            s, "c1", ok=True, reason="ok", is_new_bridge=False, anomaly=0.0,
            reexecutor_available=False, recomputed_chrf=42.0)
        assert plan.l2_selected is True
        assert plan.l2_pending is True          # selected but no re-executor

    def test_trusted_low_stakes_pass_usually_not_sampled(self):
        s = r.ReputationState(contributor_id="uid:a", reputation=r.FULL_TRUST,
                              status="established")
        # A specific low-stakes run id at the floor rate: decision is stable.
        plan = r.plan_l0_outcome(
            s, "quiet-densification-run", ok=True, reason="ok",
            is_new_bridge=False, anomaly=0.0, reexecutor_available=True,
            recomputed_chrf=42.0)
        # It may or may not be sampled, but it is NOT force-selected.
        assert plan.l2_selected == r.should_audit(
            "quiet-densification-run", r.FULL_TRUST, False, 0.0)

    def test_bridge_run_from_trusted_contributor_still_audited(self):
        s = r.ReputationState(contributor_id="uid:a", reputation=r.FULL_TRUST,
                              status="established")
        plan = r.plan_l0_outcome(
            s, "c1", ok=True, reason="ok", is_new_bridge=True, anomaly=0.0,
            reexecutor_available=True, recomputed_chrf=42.0)
        assert plan.l2_selected is True         # stakes override

    def test_proven_fraud_disqualifies_and_burns(self):
        s = r.ReputationState(contributor_id="uid:a", reputation=50,
                              status="established")
        plan = r.plan_l0_outcome(
            s, "bad", ok=False,
            reason="MISMATCH: re-scored chrF++ 20 vs reported 95",
            is_new_bridge=False, anomaly=0.0, reexecutor_available=False,
            recomputed_chrf=20.0)
        assert plan.new_trust == "disqualified"
        assert plan.burn is True                # driver must re-audit history
        assert plan.state.reputation == 0
        assert plan.state.status == "burned"

    def test_tampered_is_fraud(self):
        s = r.ReputationState.new("uid:a")
        plan = r.plan_l0_outcome(
            s, "bad", ok=False, reason="TAMPERED: 3 stored reference(s) differ",
            is_new_bridge=False, anomaly=0.0, reexecutor_available=False)
        assert plan.new_trust == "disqualified" and plan.burn is True

    def test_unscoreable_leaves_everything_untouched(self):
        # Not-anchorable / unscoreable is NOT fraud — no trust change, no burn,
        # no reputation move (we could neither confirm nor refute).
        s = r.ReputationState(contributor_id="uid:a", reputation=50,
                              status="established")
        plan = r.plan_l0_outcome(
            s, "x", ok=False,
            reason="self-consistent but NOT corpus-anchored — left unverified",
            is_new_bridge=False, anomaly=0.0, reexecutor_available=False)
        assert plan.new_trust is None
        assert plan.burn is False
        assert plan.state.reputation == 50
        assert plan.records == tuple()

    def test_is_proven_fraud_boundary(self):
        assert r.is_proven_fraud("MISMATCH: ...") is True
        assert r.is_proven_fraud("TAMPERED: ...") is True
        assert r.is_proven_fraud("no scoreable entries (cannot verify)") is False
        assert r.is_proven_fraud("insufficient anchoring") is False
        assert r.is_proven_fraud(None) is False


class TestApplyL2Result:
    def test_l2_pass_earns_clean_audit(self):
        s = r.ReputationState.new("uid:a")
        s2, rec, burn = r.apply_l2_result(s, "c1", l2_pass=True)
        assert burn is False
        assert s2.reputation == r.REP_PER_CLEAN_AUDIT
        assert rec.outcome == "pass" and rec.layer == "L2"

    def test_l2_fail_burns_like_fraud(self):
        s = r.ReputationState(contributor_id="uid:a", reputation=40,
                              status="established")
        s2, rec, burn = r.apply_l2_result(s, "c1", l2_pass=False)
        assert burn is True                     # driver disqualifies + re-audits
        assert s2.reputation == 0 and s2.status == "burned"
        assert rec.outcome == "burn" and rec.layer == "L2"


# ---------------------------------------------------------------------------
# L3 corroboration detection
# ---------------------------------------------------------------------------

def _run(rid, ds, model, cond, owner, chrf):
    return {"run_card_id": rid, "dataset_id": ds, "model_slug": model,
            "condition": cond, "owner_uid": owner, "chrf": chrf}


class TestCorroboration:
    def test_two_independent_agreeing_runs_corroborate(self):
        runs = [_run("a", "d", "m", "naive", "u1", 80.0),
                _run("b", "d", "m", "naive", "u2", 80.4)]
        res = r.find_corroborations(runs)
        assert len(res) == 1
        assert res[0].verdict == "agree"
        assert set(res[0].owner_uids) == {"u1", "u2"}

    def test_disagreement_beyond_threshold_flags(self):
        runs = [_run("a", "d", "m", "naive", "u1", 80.0),
                _run("b", "d", "m", "naive", "u2", 70.0)]   # 10 > threshold
        res = r.find_corroborations(runs)
        assert res[0].verdict == "disagree"

    def test_moderate_gap_is_inconclusive(self):
        # Between tol and disagreement threshold = expected LLM non-determinism.
        gap = (r.CHRF_CORROBORATION_TOLERANCE + r.CHRF_DISAGREEMENT_THRESHOLD) / 2
        runs = [_run("a", "d", "m", "naive", "u1", 80.0),
                _run("b", "d", "m", "naive", "u2", 80.0 - gap)]
        res = r.find_corroborations(runs)
        assert res[0].verdict == "inconclusive"

    def test_single_owner_is_not_corroboration(self):
        # Same contributor running twice is NOT independent replication.
        runs = [_run("a", "d", "m", "naive", "u1", 80.0),
                _run("b", "d", "m", "naive", "u1", 80.0)]
        assert r.find_corroborations(runs) == []

    def test_anonymous_runs_cannot_corroborate(self):
        runs = [_run("a", "d", "m", "naive", None, 80.0),
                _run("b", "d", "m", "naive", None, 80.0),
                _run("c", "d", "m", "naive", "u1", 80.0)]
        # Only one non-null owner among them → not corroboration.
        assert r.find_corroborations(runs) == []

    def test_different_cells_do_not_cross_corroborate(self):
        runs = [_run("a", "d1", "m", "naive", "u1", 80.0),
                _run("b", "d2", "m", "naive", "u2", 80.0)]
        assert r.find_corroborations(runs) == []

    def test_one_representative_per_owner(self):
        # u1 submits twice, u2 once — still counts as 2 independent owners, and
        # only one representative run per owner is compared.
        runs = [_run("a", "d", "m", "naive", "u1", 80.0),
                _run("a2", "d", "m", "naive", "u1", 99.0),
                _run("b", "d", "m", "naive", "u2", 80.2)]
        res = r.find_corroborations(runs)
        assert len(res) == 1
        assert len(res[0].owner_uids) == 2
        assert res[0].verdict == "agree"        # u1's first rep (80.0) vs u2 (80.2)

    def test_corroborates_helper(self):
        assert r.corroborates(80.0, 80.5) is True
        assert r.corroborates(80.0, 90.0) is False
        assert r.corroborates(None, 80.0) is False
