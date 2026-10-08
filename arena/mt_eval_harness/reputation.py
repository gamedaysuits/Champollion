"""Reputation-weighted auditing — the pure core (L1 ladder + L2 sampler + L3
corroboration).

WHY THIS EXISTS. The board must be *valid by construction* while keeping
distributed contribution worthwhile: contributors do the expensive work (running
translations), so the project must NOT re-run everything. Provenance ("this run
came through the harness") is not server-verifiable for self-hosted compute — the
open harness's key is in the user's hands — so validity is *earned and
self-correcting* instead of attested. See docs/TRUST_MODEL_REPUTATION.md.

THE FOUR LAYERS (this module is L1/L2-sampling/L3; L0 lives in verifier.py):
  L0  re-score submitted outputs vs the sha-pinned reference. 100%, ~free.
      (verifier.verify_against_corpus — already built.)
  L1  a contributor REPUTATION ladder. Reputation is earned only by surviving
      hard-to-fake checks (a clean L2 re-run, or L3 corroboration); it gates how
      often the expensive L2 check fires.
  L2  actually re-run a SAMPLE of translations to confirm the outputs are real
      (catches reference-copying on public dev sets that L0 cannot). The SAMPLING
      POLICY here decides which runs get L2: p = f(reputation ↓, stakes ↑,
      anomaly ↑). New/anonymous and high-stakes/anomalous runs are always
      audited; trusted contributors are spot-audited at a floor rate.
  L3  corroboration: two INDEPENDENT contributors running the same
      (corpus, model, condition) whose re-scored outputs agree = free
      verification that raises both reputations; disagreement flags both for L2.

BURN. One caught fraud (a proven L0 MISMATCH/TAMPERED, or an L2 re-run the
outputs fail) zeroes the contributor's reputation, re-audits their whole verified
history, and is public — so cheating is expensive *in expectation*, which is what
makes light sampling of trusted contributors safe.

This module is PURE (no network, no DB, no torch): constants, a sampling policy,
reputation-state transitions, and corroboration detection — all unit-tested in
arena/tests/test_reputation.py. The service-role DB driver that reads/writes the
`contributors` + `contributor_audit_log` tables lives in verifier.py.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field, replace

# ---------------------------------------------------------------------------
# Founder-tunable constants (one place; docs/TRUST_MODEL_REPUTATION.md mirrors
# the defaults). Changing a number here changes the policy everywhere.
# ---------------------------------------------------------------------------

#: Reputation at which a contributor stops being "always sampled" and enters the
#: decaying-rate regime (~3 clean L2 audits at REP_PER_CLEAN_AUDIT each).
ESTABLISHED_AT = 30
#: Reputation at which the L2 sampling rate hits its floor (MIN_RATE).
FULL_TRUST = 100

#: L2 audit rate for a just-established contributor (reputation == ESTABLISHED_AT).
BASE_RATE = 0.25
#: Floor: even a fully-trusted contributor is spot-audited this often (never 0 —
#: a trusted identity that later turns must still be catchable).
MIN_RATE = 0.05

#: Anomaly = chrF++ points a run scores ABOVE the pair's prior verified best.
#: At/over ANOMALY_HARD → always audit, regardless of reputation (too-good-to-be-
#: true). Between SOFT and HARD → pull the rate up to SOFT_ANOMALY_RATE.
ANOMALY_HARD = 8.0
ANOMALY_SOFT = 4.0
SOFT_ANOMALY_RATE = 0.50

#: Reputation earned per event. L0 pass earns NOTHING — it is necessary for
#: 'verified' but free to fake in the reference-copy case, so it must not build
#: trust on its own. Trust comes only from hard-to-fake signals. (Sybil-
#: resistance: every reputation point costs a real audited run, so minting fresh
#: identities buys nothing.)
REP_PER_L0_PASS = 0
REP_PER_CLEAN_AUDIT = 10
REP_PER_CORROBORATION = 5

#: Two independent re-scored headline chrF++ values CORROBORATE when they agree
#: within this band (matches verifier.CHRF_TOLERANCE — deterministic re-score /
#: same 'naive' condition). LLM non-determinism means a small gap is expected, so
#: only a gap BEYOND CHRF_DISAGREEMENT_THRESHOLD is treated as a disagreement
#: worth flagging both runs for an L2 audit; the band in between is inconclusive
#: (no reputation move either way).
CHRF_CORROBORATION_TOLERANCE = 1.0
CHRF_DISAGREEMENT_THRESHOLD = 5.0

VALID_STATUSES = ("provisional", "established", "burned")


# ---------------------------------------------------------------------------
# Stakes + anomaly signals (pure).
# ---------------------------------------------------------------------------

def anomaly_score(chrf: float | None, prior_verified_best: float | None) -> float:
    """chrF++ points a run scores above the pair's prior verified best.

    A run with no prior verified result on its pair is FIRST-LIGHT — inherently
    high-stakes (nothing to corroborate it against yet) — so it returns
    ANOMALY_HARD to force an audit. A run at/below the prior best is unremarkable
    (0.0). Otherwise the surprise is the positive delta.
    """
    if chrf is None:
        return 0.0
    if prior_verified_best is None:
        return ANOMALY_HARD  # first verified result for this pair → always audit
    return max(0.0, float(chrf) - float(prior_verified_best))


def audit_probability(
    reputation: int,
    is_new_bridge: bool,
    anomaly: float,
    *,
    established_at: int = ESTABLISHED_AT,
    full_trust: int = FULL_TRUST,
    base_rate: float = BASE_RATE,
    min_rate: float = MIN_RATE,
    anomaly_hard: float = ANOMALY_HARD,
    anomaly_soft: float = ANOMALY_SOFT,
    soft_anomaly_rate: float = SOFT_ANOMALY_RATE,
) -> float:
    """Probability a run should get an expensive L2 re-run.

    p = f(reputation ↓, stakes ↑, anomaly ↑):
      · A run that lights a NEW BRIDGE for a language family, or scores far above
        the pair's prior best, is audited REGARDLESS of reputation (returns 1.0).
      · An unproven contributor (reputation < established_at) is audited on every
        run until they have earned trust.
      · An established contributor's rate decays from base_rate toward min_rate as
        reputation climbs to full_trust — but never below min_rate, and a softer
        anomaly still pulls the rate up.
    """
    # Stakes / strong-anomaly override — the runs that matter most are always
    # checked (tax-audit / BOINC-validator model).
    if is_new_bridge or anomaly >= anomaly_hard:
        return 1.0
    # Unproven → sample everything until reputation is earned.
    if reputation < established_at:
        return 1.0
    span = max(1, full_trust - established_at)
    rep_frac = min(1.0, (reputation - established_at) / span)
    p = base_rate * (1.0 - rep_frac) + min_rate * rep_frac
    if anomaly >= anomaly_soft:
        p = max(p, soft_anomaly_rate)
    return max(min_rate, min(1.0, p))


def _hash_unit(key: str) -> float:
    """Stable, uniform [0, 1) from a string — deterministic across processes and
    replays (no RNG state to persist), so the audit decision for a given run is
    reproducible and test-pinnable."""
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / float(1 << 64)


def should_audit(
    run_card_id: str,
    reputation: int,
    is_new_bridge: bool,
    anomaly: float,
    **kwargs,
) -> bool:
    """Deterministic L2 sampling decision for one run.

    Draws a stable uniform from the run id and compares to audit_probability, so
    the same run always yields the same decision (no persisted RNG). kwargs pass
    through to audit_probability (constant overrides for tests / founder tuning).
    """
    p = audit_probability(reputation, is_new_bridge, anomaly, **kwargs)
    if p >= 1.0:
        return True
    if p <= 0.0:
        return False
    return _hash_unit(run_card_id) < p


# ---------------------------------------------------------------------------
# Reputation state + transitions (pure — return a NEW state + an audit record;
# the DB driver persists both).
# ---------------------------------------------------------------------------

def status_for(reputation: int, caught_fraud_count: int) -> str:
    """Derive display status from reputation + fraud history.

    A contributor with fraud on record whose reputation has not climbed back to
    the established threshold reads as 'burned' (the public scar). Re-earning
    reputation up to ESTABLISHED_AT restores 'established' — but caught_fraud_count
    (and the public burn row in the audit log) remain a permanent record.
    """
    if caught_fraud_count > 0 and reputation < ESTABLISHED_AT:
        return "burned"
    return "established" if reputation >= ESTABLISHED_AT else "provisional"


@dataclass(frozen=True)
class ReputationState:
    """One contributor's reputation ledger row (numeric, DB-free)."""
    contributor_id: str | None
    reputation: int = 0
    status: str = "provisional"
    clean_audits: int = 0
    total_audits: int = 0
    corroborations: int = 0
    caught_fraud_count: int = 0
    verified_runs: int = 0

    @classmethod
    def new(cls, contributor_id: str | None) -> "ReputationState":
        return cls(contributor_id=contributor_id)


@dataclass(frozen=True)
class AuditRecord:
    """One append-only row for contributor_audit_log."""
    contributor_id: str | None
    run_card_id: str
    layer: str                       # 'L0' | 'L2' | 'L3'
    outcome: str                     # pass|fail|corroborated|disagreement|burn|reaudit
    reputation_delta: int
    reputation_after: int | None
    detail: dict = field(default_factory=dict)

    def as_row(self) -> dict:
        return {
            "contributor_id": self.contributor_id,
            "run_card_id": self.run_card_id,
            "layer": self.layer,
            "outcome": self.outcome,
            "reputation_delta": self.reputation_delta,
            "reputation_after": self.reputation_after,
            "detail": self.detail,
        }


def _retally(state: ReputationState, **changes) -> ReputationState:
    ns = replace(state, **changes)
    return replace(ns, status=status_for(ns.reputation, ns.caught_fraud_count))


def record_l0_pass(state: ReputationState, run_card_id: str,
                   detail: dict | None = None) -> tuple[ReputationState, AuditRecord]:
    """L0 re-score matched — the free floor. Earns REP_PER_L0_PASS (0 by default:
    reproducibility is necessary for 'verified' but earns no trust by itself)."""
    ns = _retally(state, reputation=state.reputation + REP_PER_L0_PASS,
                  verified_runs=state.verified_runs + 1)
    rec = AuditRecord(state.contributor_id, run_card_id, "L0", "pass",
                      REP_PER_L0_PASS, ns.reputation, detail or {})
    return ns, rec


def record_clean_audit(state: ReputationState, run_card_id: str,
                       detail: dict | None = None) -> tuple[ReputationState, AuditRecord]:
    """L2 re-run confirmed the outputs are real. The primary reputation earner."""
    ns = _retally(state, reputation=state.reputation + REP_PER_CLEAN_AUDIT,
                  clean_audits=state.clean_audits + 1,
                  total_audits=state.total_audits + 1)
    rec = AuditRecord(state.contributor_id, run_card_id, "L2", "pass",
                      REP_PER_CLEAN_AUDIT, ns.reputation, detail or {})
    return ns, rec


def record_corroboration(state: ReputationState, run_card_id: str,
                         detail: dict | None = None) -> tuple[ReputationState, AuditRecord]:
    """L3 independent agreement — free verification; raises reputation."""
    ns = _retally(state, reputation=state.reputation + REP_PER_CORROBORATION,
                  corroborations=state.corroborations + 1)
    rec = AuditRecord(state.contributor_id, run_card_id, "L3", "corroborated",
                      REP_PER_CORROBORATION, ns.reputation, detail or {})
    return ns, rec


def record_burn(state: ReputationState, run_card_id: str, *, layer: str = "L0",
                detail: dict | None = None) -> tuple[ReputationState, AuditRecord]:
    """Caught fraud — zero the reputation, mark burned, count the strike.

    `layer` is where the fraud surfaced ('L0' for a MISMATCH/TAMPERED re-score,
    'L2' for a failed re-run). The reputation_delta is the full loss (down to 0).
    The caller separately demotes the contributor's verified history (record_reaudit
    per demoted run) and disqualifies THIS run.
    """
    delta = -state.reputation
    ns = _retally(state, reputation=0,
                  caught_fraud_count=state.caught_fraud_count + 1,
                  total_audits=state.total_audits + (1 if layer == "L2" else 0))
    rec = AuditRecord(state.contributor_id, run_card_id, layer, "burn",
                      delta, 0, detail or {})
    return ns, rec


def record_reaudit(contributor_id: str | None, run_card_id: str, *,
                   layer: str = "L2", detail: dict | None = None) -> AuditRecord:
    """One history-demotion record: a previously-verified run of a burned
    contributor sent back to 'unverified' to be re-checked. No reputation move
    (reputation is already 0 from the burn)."""
    return AuditRecord(contributor_id, run_card_id, layer, "reaudit", 0, 0,
                       detail or {})


# ---------------------------------------------------------------------------
# Run-outcome planner (pure). Takes L0 primitives (not the verifier's Verdict
# object, to avoid a circular import) and returns a RunPlan the DB driver
# executes: what trust to write, the new reputation state, the audit records,
# whether L2 was sampled, and whether a burn must re-audit the contributor's
# history.
# ---------------------------------------------------------------------------

def is_proven_fraud(reason: str | None) -> bool:
    """The verifier's own disqualification boundary: a MISMATCH (score not
    reproducible from the outputs) or a TAMPERED reference. Reusing the exact
    substrings the verifier already disqualifies on means the burn adds no new
    false-positive surface — an unscoreable/unanchorable run is NOT fraud."""
    r = reason or ""
    return "MISMATCH" in r or "TAMPERED" in r


@dataclass(frozen=True)
class RunPlan:
    run_card_id: str
    new_trust: str | None        # 'verified' | 'disqualified' | None (leave as-is)
    state: ReputationState       # contributor state AFTER this plan's L0/burn step
    records: tuple               # AuditRecords to append (order matters)
    l2_selected: bool            # sampling said this run needs an L2 re-run
    l2_pending: bool             # selected but no re-executor available (audit later)
    burn: bool                   # caller must demote this contributor's verified history


def plan_l0_outcome(
    state: ReputationState,
    run_card_id: str,
    *,
    ok: bool,
    reason: str,
    is_new_bridge: bool,
    anomaly: float,
    reexecutor_available: bool,
    recomputed_chrf: float | None = None,
    **sampling_kwargs,
) -> RunPlan:
    """Plan the reputation/trust consequences of an L0 verdict.

    · L0 pass  → run promoted to 'verified' (unchanged from today's verifier), a
                 free-floor L0 record logged, and the L2 sampling decision recorded
                 in that record's detail. Reputation does NOT move on L0 pass.
    · Proven fraud (MISMATCH/TAMPERED) → run 'disqualified' (unchanged), reputation
                 BURNED to 0, and burn=True so the driver re-audits the whole
                 verified history.
    · Anything else (unscoreable / not corpus-anchorable) → no trust change, no
                 reputation move (we could not confirm OR refute).
    """
    if ok:
        p = audit_probability(state.reputation, is_new_bridge, anomaly,
                              **sampling_kwargs)
        selected = should_audit(run_card_id, state.reputation, is_new_bridge,
                                anomaly, **sampling_kwargs)
        pending = selected and not reexecutor_available
        detail = {
            "recomputed_chrf": recomputed_chrf,
            "is_new_bridge": is_new_bridge,
            "anomaly": round(float(anomaly), 4),
            "audit_probability": round(float(p), 4),
            "l2_selected": selected,
            "l2_pending": pending,
        }
        state2, rec = record_l0_pass(state, run_card_id, detail)
        return RunPlan(run_card_id, "verified", state2, (rec,),
                       l2_selected=selected, l2_pending=pending, burn=False)

    if is_proven_fraud(reason):
        state2, rec = record_burn(state, run_card_id, layer="L0",
                                  detail={"reason": reason,
                                          "recomputed_chrf": recomputed_chrf})
        return RunPlan(run_card_id, "disqualified", state2, (rec,),
                       l2_selected=False, l2_pending=False, burn=True)

    # Unscoreable / not anchorable → leave the run and the reputation untouched.
    return RunPlan(run_card_id, None, state, tuple(),
                   l2_selected=False, l2_pending=False, burn=False)


def apply_l2_result(
    state: ReputationState,
    run_card_id: str,
    *,
    l2_pass: bool,
    detail: dict | None = None,
) -> tuple[ReputationState, AuditRecord, bool]:
    """Fold an actual L2 re-run outcome into a contributor's reputation.

    Returns (new_state, record, burn) — burn=True means the re-run FAILED (the
    outputs are not real), so the caller disqualifies the run and re-audits the
    contributor's verified history, exactly like an L0-caught fraud.
    """
    if l2_pass:
        state2, rec = record_clean_audit(state, run_card_id, detail)
        return state2, rec, False
    state2, rec = record_burn(state, run_card_id, layer="L2", detail=detail)
    return state2, rec, True


# ---------------------------------------------------------------------------
# L3 corroboration detection (pure).
# ---------------------------------------------------------------------------

def corroborates(chrf_a: float | None, chrf_b: float | None, *,
                 tol: float = CHRF_CORROBORATION_TOLERANCE) -> bool:
    """Whether two independently re-scored headline chrF++ values agree."""
    if chrf_a is None or chrf_b is None:
        return False
    return abs(float(chrf_a) - float(chrf_b)) <= tol


def corroboration_verdict(spread: float, *,
                          tol: float = CHRF_CORROBORATION_TOLERANCE,
                          disagree: float = CHRF_DISAGREEMENT_THRESHOLD) -> str:
    """Classify a cell's chrF++ spread across independent owners.

    'agree'        → within tol: free verification (raise both reputations).
    'disagree'     → beyond the disagreement threshold: someone's outputs are
                     suspect — flag both runs for an L2 audit.
    'inconclusive' → in between: expected LLM non-determinism, no reputation move.
    """
    if spread <= tol:
        return "agree"
    if spread > disagree:
        return "disagree"
    return "inconclusive"


@dataclass(frozen=True)
class CorroborationResult:
    """One (corpus, model, condition) cell replicated by ≥2 independent owners."""
    key: tuple                     # (dataset_id, model_slug, condition)
    run_card_ids: tuple            # one representative run per owner (stable order)
    owner_uids: tuple              # the distinct independent owners
    verdict: str                   # 'agree' | 'disagree' | 'inconclusive'
    chrf_spread: float             # max - min of the re-scored headline chrF++
    detail: dict = field(default_factory=dict)


def find_corroborations(
    runs: list[dict],
    *,
    tol: float = CHRF_CORROBORATION_TOLERANCE,
    disagree: float = CHRF_DISAGREEMENT_THRESHOLD,
) -> list[CorroborationResult]:
    """Find independent replications and cross-check their re-scored outputs.

    `runs` is a list of dicts with keys: run_card_id, dataset_id, model_slug,
    condition, owner_uid, chrf (the server-confirmed headline — a verified run's
    chrF++ has already reproduced against the sha-pinned corpus at L0). A cell is
    corroborated when ≥2 runs share (dataset_id, model_slug, condition) but come
    from ≥2 DISTINCT non-null owner_uids (genuinely independent).

    Returns one CorroborationResult per multi-owner cell, classified 'agree' /
    'disagree' / 'inconclusive' (see corroboration_verdict). Cells with a single
    owner (self-replication) are NOT corroboration and are skipped.
    """
    cells: dict[tuple, list[dict]] = {}
    for r in runs:
        key = (r.get("dataset_id"), r.get("model_slug"), r.get("condition"))
        if None in key:
            continue
        cells.setdefault(key, []).append(r)

    results: list[CorroborationResult] = []
    for key, group in cells.items():
        # Independence: ≥2 DISTINCT non-null owners. Anonymous (owner_uid None)
        # runs cannot corroborate (no persistent independent identity).
        owners = sorted({r.get("owner_uid") for r in group
                         if r.get("owner_uid") is not None})
        if len(owners) < 2:
            continue
        # One representative run per owner (the first seen) so a single owner's
        # many runs don't masquerade as independent corroboration.
        rep_by_owner: dict = {}
        for r in group:
            o = r.get("owner_uid")
            if o is not None and o not in rep_by_owner:
                rep_by_owner[o] = r
        reps = [rep_by_owner[o] for o in owners]
        chrfs = [r.get("chrf") for r in reps if r.get("chrf") is not None]
        if len(chrfs) < 2:
            continue
        spread = max(chrfs) - min(chrfs)
        results.append(CorroborationResult(
            key=key,
            run_card_ids=tuple(rep_by_owner[o].get("run_card_id") for o in owners),
            owner_uids=tuple(owners),
            verdict=corroboration_verdict(spread, tol=tol, disagree=disagree),
            chrf_spread=round(float(spread), 4),
            detail={"n_independent": len(owners),
                    "chrf_by_owner": {str(o): rep_by_owner[o].get("chrf")
                                      for o in owners}},
        ))
    return results
