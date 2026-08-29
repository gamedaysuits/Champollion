"""
Connection Quality (cq-v1) — code mirror of docs/CONNECTION_QUALITY_SPEC.md.

This module is the single Python code authority for the canonical
connection-quality algorithm: the composite strength score of a language
pair consumed by the network map, the route finder, and cross-pair
leaderboard ordering.

Design contract:
    - docs/CONNECTION_QUALITY_SPEC.md (internal wiki) is the SSOT. This
      module mirrors it section by section; the spec's worked examples are
      pinned to the digit in arena/tests/test_connection_quality.py.
    - TS/JS twin: cli/website/src/utils/connectionQuality.mjs (same
      SSOT-twins discipline as generate_sweep_queue.py <->
      regenerate-queue/lib.ts). If a rule changes here, mirror it there;
      the two test suites re-encode the same pinned cases.
    - The numeric constants (S8) are the cross-runtime SSOT
      shared/connection-quality.json — the SAME file the JS twin reads — so
      the two twins can never silently disagree on a value. The functions
      are pure + stdlib-only (no per-call I/O, no clock reads, no network);
      the only I/O is a one-time constants load at import. Callers pass
      already-resolved inputs (age in days, effective length, resolved
      metric trust). Everything returned carries champollion-derived
      provenance.

Two channels, one composite (spec S2):
    q  — quality: the best supported, chance-corrected score, [0, 1]
    r  — reliability: the product of evidence discounts, [0, 1]
    cq = q * r — the ordering/routing currency. NEVER displayed as a
         standalone "score": surfaces show q's band plus r's breakdown.

Fail-honest: a missing input can only lower a component or mark the pair
unknown — never inflate (spec S6.9 table). UNMEASURED stays UNMEASURED.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

# ---------------------------------------------------------------------------
# S8 Constants — loaded from the cross-runtime SSOT
# shared/connection-quality.json (the JS twin connectionQuality.mjs reads the
# SAME file). Every value is justified in the spec's constants table; the
# numbers live in ONE place so the two twins can never silently drift. The
# first four are the ECV v3 bridge-reliability anchors, reused VERBATIM from
# the queue-construction spec S1.5 (one reliability currency, not two).
#
# The loader mirrors config._load_model_aliases: walk up from this package to
# the monorepo shared/ dir, and fall back to an embedded copy for standalone
# pip installs (no shared/ to walk up to). The embedded copy is kept honest by
# test_connection_quality_ssot.py, which asserts it equals the shared JSON.
# ---------------------------------------------------------------------------

_PACKAGE_DIR = Path(__file__).resolve().parent

# Standalone fallback: EXACTLY mirror shared/connection-quality.json (the
# SSOT). Only used outside the monorepo. The SSOT-parity test asserts this
# dict equals the shared JSON, so drift here is a CI failure, not a silent bug.
_CQ_FALLBACK = {
    "N_FULL": 100,
    "L_HEALTHY": 5.0,
    "H_NOISE": 5.0,
    "RUNS_FULL": 2,
    "SIGNIFICANCE_N": 100,
    "LAMBDA_JUNCTION": 0.9,
    "BIN_EDGES": [0.15, 0.35, 0.55, 0.75],
    "BIN_LABELS": ["near floor", "weak", "developing", "usable", "strong"],
    "W_CONTAM": {"LOW": 1.0, "MEDIUM": 0.4, "HIGH": 0.1},
    "W_TRUST": {"verified": 1.0, "unverified": 0.6},
    "W_METRIC_UNMEASURED": 0.5,
    "COVER_BASE": 0.5,
    "COVER_STEP": 0.25,
    "COVER_DOMAIN_CAP": 3,
    "COVER_REGISTER_CAP": 2,
    "COVER_MIN": 0.25,
    "DOMAIN_NO_CREDIT": ["religious"],
    "RECENCY_FRESH_DAYS": 365,
    "RECENCY_AGING_DAYS": 730,
    "W_RECENCY_FRESH": 1.0,
    "W_RECENCY_AGING": 0.8,
    "W_RECENCY_STALE": 0.6,
    "DRIFT_EXEMPT_PARADIGMS": ["rule-based", "human"],
    "HUMAN_N_FULL": 30,
    "HUMAN_REVIEWERS_FULL": 2,
    "FORMULA_VERSION": "cq-v1",
    "PROVENANCE": "champollion-derived",
}


def _load_cq_constants() -> dict:
    """Load cq-v1 constants from shared/connection-quality.json (the SSOT).

    Search order (mirrors config._load_model_aliases):
      1. shared/connection-quality.json, found by walking up from this file
         to the monorepo root.
      2. The embedded _CQ_FALLBACK, for standalone pip installs where the
         monorepo shared/ dir is absent.

    '_'-prefixed keys (e.g. _comment) are metadata, never constants.
    """
    check = _PACKAGE_DIR
    for _ in range(6):
        candidate = check / "shared" / "connection-quality.json"
        if candidate.exists():
            try:
                data = json.loads(candidate.read_text(encoding="utf-8"))
                return {k: v for k, v in data.items() if not k.startswith("_")}
            except Exception:  # malformed SSOT → fall back to the mirror
                break
        check = check.parent
    return _CQ_FALLBACK


_CQ = _load_cq_constants()

# The ECV v3 bridge-reliability anchors (queue-construction spec S1.5).
N_FULL = _CQ["N_FULL"]              # entries for full size credit (sig. floor)
L_HEALTHY = _CQ["L_HEALTHY"]        # effective words for full richness credit
H_NOISE = _CQ["H_NOISE"]            # chrF 95% CI half-width for full confidence
RUNS_FULL = _CQ["RUNS_FULL"]        # published runs for full replication credit

SIGNIFICANCE_N = _CQ["SIGNIFICANCE_N"]  # display provisionality threshold (map dash)

LAMBDA_JUNCTION = _CQ["LAMBDA_JUNCTION"]  # per-junction fidelity discount for
                                          # ESTIMATED chains (spec S4)

# cchrF++ band edges on q, [0,1] — mirrors arcStrength.mjs BIN_EDGES.
BIN_EDGES = tuple(_CQ["BIN_EDGES"])
BIN_LABELS = tuple(_CQ["BIN_LABELS"])

# Contamination multipliers (spec S2.1). Unknown/missing grade is MEDIUM:
# never assume clean. W_CONTAM_UNKNOWN is DERIVED, not a second source.
W_CONTAM = dict(_CQ["W_CONTAM"])
W_CONTAM_UNKNOWN = W_CONTAM["MEDIUM"]

# Verification-tier weights over the DB trust vocabulary (migration 021).
# 'disqualified' rows are ineligible and never reach the weight table.
# unverified = self-benchmarked: fingerprinted + sha-pinned, but self-reported
# (spec S6.6). W_TRUST_UNKNOWN is DERIVED, not a second source.
W_TRUST = dict(_CQ["W_TRUST"])
W_TRUST_UNKNOWN = W_TRUST["unverified"]

# Instrument trust: chance-corrected system-level pairwise accuracy,
# w = clamp01(2*PA - 1). PA 0.5 (coin flip) -> 0, PA 1.0 -> 1 (spec S6.5).
W_METRIC_UNMEASURED = _CQ["W_METRIC_UNMEASURED"]  # no cross-family borrowing

# Coverage credit (spec S6.4): breadth of the pair's evidence portfolio.
COVER_BASE = _CQ["COVER_BASE"]                  # single (domain, register) cell
COVER_STEP = _CQ["COVER_STEP"]                  # per extra distinct domain/register
COVER_DOMAIN_CAP = _CQ["COVER_DOMAIN_CAP"]      # full domain credit at 3 domains
COVER_REGISTER_CAP = _CQ["COVER_REGISTER_CAP"]  # full register credit at 2
COVER_MIN = _CQ["COVER_MIN"]                    # floor (e.g. religious-only)
DOMAIN_NO_CREDIT = frozenset(_CQ["DOMAIN_NO_CREDIT"])  # label only, never credit
                       # (shared/domain-taxonomy.json doctrine)

# Recency / model drift (spec S6.7). Deterministic, locally re-runnable
# paradigms do not drift; API-served model output can change silently.
RECENCY_FRESH_DAYS = _CQ["RECENCY_FRESH_DAYS"]
RECENCY_AGING_DAYS = _CQ["RECENCY_AGING_DAYS"]
W_RECENCY_FRESH = _CQ["W_RECENCY_FRESH"]
W_RECENCY_AGING = _CQ["W_RECENCY_AGING"]
W_RECENCY_STALE = _CQ["W_RECENCY_STALE"]
DRIFT_EXEMPT_PARADIGMS = frozenset(_CQ["DRIFT_EXEMPT_PARADIGMS"])

# Human (speaker/expert) evidence anchors — the T3 calibration-set shape
# (metrics research program S6/S7: >=30 stratified entries, >=2 qualified
# bilingual speakers, >=70% community bar).
HUMAN_N_FULL = _CQ["HUMAN_N_FULL"]
HUMAN_REVIEWERS_FULL = _CQ["HUMAN_REVIEWERS_FULL"]

FORMULA_VERSION = _CQ["FORMULA_VERSION"]
PROVENANCE = _CQ["PROVENANCE"]


# ---------------------------------------------------------------------------
# S6.1-S6.3 Per-run test-quality factors (ECV v3 S1.5, verbatim semantics)
# ---------------------------------------------------------------------------

def f_size(n):
    """Size credit: min(1, n/N_FULL). Missing n earns nothing."""
    if n is None or n <= 0:
        return 0.0
    return min(1.0, n / N_FULL)


def f_rich(l_eff):
    """Richness credit from effective source length (content units).

    Unknown effective length falls back to 0.5 — the same conservative
    midpoint the checked-in bridge-health verifier uses for a missing CI.
    """
    if l_eff is None:
        return 0.5
    if l_eff <= 0:
        return 0.0
    return min(1.0, l_eff / L_HEALTHY)


def f_conf(h, n=None):
    """Confidence credit: min(1, H_NOISE/h); missing CI proxies 50/sqrt(n)."""
    if h is None:
        if n is None or n <= 0:
            return 0.0
        h = 50.0 / math.sqrt(n)
    if h <= 0:
        return 0.5
    return min(1.0, H_NOISE / h)


def f_repl(k):
    """Replication credit: min(1, runs/RUNS_FULL)."""
    if k is None or k <= 0:
        return 0.0
    return min(1.0, k / RUNS_FULL)


# ---------------------------------------------------------------------------
# S5 Quality channel — chance correction (floors on the 0-100 chrF++ scale)
# ---------------------------------------------------------------------------

def cchrf(raw_chrf, floor):
    """Chance-corrected chrF++ on [0, 1]; None when inputs are unusable.

    (raw - floor) / (100 - floor), clamped to [0, 1]. The clamp at 0 is the
    noise rail: at-or-below-floor output is indistinguishable from chance.
    """
    if raw_chrf is None or floor is None or floor >= 100:
        return None
    return min(1.0, max(0.0, (raw_chrf - floor) / (100.0 - floor)))


def floor_for_pair(floors, a, b, direction=None):
    """Resolve the chance floor for a pair.

    Directed (direction == 'a->b' or 'b->a'): the TARGET language's floor —
    chrF++ compares hypothesis to reference, and the reference is written in
    the target language (the cchrf research-repo rule).

    Undirected (direction None): the HIGHER of the two floors, and only when
    BOTH are known. Larger floor => smaller corrected score, so max-of-pair
    can understate but never inflate whichever direction the run really was.
    """
    fa = floors.get(a) if floors else None
    fb = floors.get(b) if floors else None
    fa = fa if isinstance(fa, (int, float)) else None
    fb = fb if isinstance(fb, (int, float)) else None
    if direction == "a->b":
        return fb
    if direction == "b->a":
        return fa
    if fa is None or fb is None:
        return None
    return max(fa, fb)


def strength_bin(q):
    """Band index 0-4 for a corrected quality value."""
    b = 0
    for edge in BIN_EDGES:
        if q >= edge:
            b += 1
    return b


# ---------------------------------------------------------------------------
# S6.4-S6.7 Portfolio factors
# ---------------------------------------------------------------------------

def f_cover(domains, registers):
    """Breadth credit for the pair's evidence portfolio.

    clamp(COVER_BASE + COVER_STEP*(min(D,3)-1) + COVER_STEP*(min(G,2)-1),
          COVER_MIN, 1.0)

    D counts distinct credit-bearing domains ('religious' is label-only and
    never counts); G counts distinct declared registers. Unlabeled evidence
    shares one bucket per axis.
    """
    dset = {d for d in (domains or set()) if d and d not in DOMAIN_NO_CREDIT}
    gset = {g for g in (registers or set()) if g}
    d = min(len(dset), COVER_DOMAIN_CAP)
    g = max(1, min(len(gset), COVER_REGISTER_CAP))
    raw = COVER_BASE + COVER_STEP * (d - 1) + COVER_STEP * (g - 1)
    return min(1.0, max(COVER_MIN, raw))


def metric_trust_weight(pairwise_accuracy):
    """Chance-corrected instrument trust: clamp01(2*PA - 1)."""
    if pairwise_accuracy is None:
        return W_METRIC_UNMEASURED
    return min(1.0, max(0.0, 2.0 * pairwise_accuracy - 1.0))


def resolve_metric_trust(artifact, metric, tgt):
    """Resolve (metric, target) -> {'w', 'basis', 'pa'} from the
    metric-reliability artifact (shared/catalogue/metric-reliability.json).

    Ladder mirrors the recommend tier-4 consumers: exact preferred sys cells
    for the target ('pair' basis) -> family roll-up ('family' basis, transfer
    caveat) -> UNMEASURED (no borrowing; W_METRIC_UNMEASURED).
    """
    unmeasured = {"w": W_METRIC_UNMEASURED, "basis": "unmeasured", "pa": None}
    if not artifact or not metric or not tgt:
        return unmeasured
    langs = artifact.get("languages") or {}
    info = langs.get(tgt)
    if info is None:
        for code, entry in langs.items():
            if entry and entry.get("iso639_3") == tgt:
                info, tgt = entry, code
                break
    if info is None:
        return unmeasured
    cells = [
        c for c in (artifact.get("cells") or [])
        if c.get("preferred") and c.get("level") == "sys"
        and c.get("metric") == metric and c.get("tgt") == tgt
        and c.get("pairwise_accuracy") is not None
    ]
    if cells:
        wsum = sum(c.get("n_sys") or 0 for c in cells)
        if wsum > 0:
            pa = sum((c.get("n_sys") or 0) * c["pairwise_accuracy"]
                     for c in cells) / wsum
            return {"w": metric_trust_weight(pa), "basis": "pair", "pa": pa}
    fam = (artifact.get("families") or {}).get(info.get("family") or "", {})
    sys_roll = ((fam.get("metrics") or {}).get(metric) or {}).get("sys") or {}
    pa = sys_roll.get("pairwise_accuracy_weighted_mean")
    if pa is not None:
        return {"w": metric_trust_weight(pa), "basis": "family", "pa": pa}
    return unmeasured


def w_recency(age_days, paradigm):
    """Model-drift discount. Deterministic paradigms are exempt."""
    if paradigm in DRIFT_EXEMPT_PARADIGMS:
        return W_RECENCY_FRESH
    if age_days is None:
        return W_RECENCY_STALE
    if age_days <= RECENCY_FRESH_DAYS:
        return W_RECENCY_FRESH
    if age_days <= RECENCY_AGING_DAYS:
        return W_RECENCY_AGING
    return W_RECENCY_STALE


def w_trust(trust):
    return W_TRUST.get(trust, W_TRUST_UNKNOWN)


def w_contam(grade):
    if grade is None:
        return W_CONTAM_UNKNOWN
    return W_CONTAM.get(grade, W_CONTAM_UNKNOWN)


def run_reliability(run):
    """r_run = f_size * f_rich * f_conf * f_repl for one supporting run.

    `runs_on_pair` (the in-lane published-run count) rides on the run dict
    because replication is a property of the pair's evidence, resolved by
    connection_quality() before this is called.
    """
    return (f_size(run.get("n"))
            * f_rich(run.get("l_eff"))
            * f_conf(run.get("ci_halfwidth"), run.get("n"))
            * f_repl(run.get("runs_on_pair")))


# ---------------------------------------------------------------------------
# S7 The pair composite
# ---------------------------------------------------------------------------

def _grade(run):
    g = run.get("contamination")
    return g if g in W_CONTAM else None


def _eligible(runs):
    return [r for r in (runs or []) if r.get("trust") != "disqualified"]


def _select_supporting(evidence, floor):
    """Best run by corrected value (raw argmax is identical for a shared
    floor — affine monotone); ties break to larger n, then younger age,
    then run id. Runs without the canonical metric never set q."""
    scored = [r for r in evidence
              if isinstance(r.get("chrf_plus_plus"), (int, float))]
    if not scored:
        return None

    def key(r):
        n = r.get("n") or 0
        age = r.get("age_days")
        age = age if age is not None else float("inf")
        return (-r["chrf_plus_plus"], -n, age, str(r.get("run_id") or ""))

    return sorted(scored, key=key)[0]


def _unmeasured():
    return {
        "formula_version": FORMULA_VERSION,
        "source": PROVENANCE,
        "lane": "unmeasured",
        "evidence_class": None,
        "rung": None,
        "q": None,
        "q_raw": None,
        "r": None,
        "cq": None,
        "band": None,
        "band_label": None,
        "provisional": None,
        "components": {},
        "flags": [],
        "provenance": {"runs_considered": 0},
    }


def connection_quality(runs, floors, a, b, *, direction=None,
                       metric_trust=None, human_evidence=None):
    """The canonical pair tuple (spec S7).

    Args:
        runs: published run evidence for the pair. Each run dict may carry:
            chrf_plus_plus (0-100), n, ci_halfwidth, l_eff, contamination
            ('LOW'|'MEDIUM'|'HIGH'|None), trust (migration-021 vocabulary),
            paradigm, age_days, domain, register, never_chain (bool),
            run_id. Missing fields take the fail-honest defaults (S6.9).
        floors: iso639-3 -> chance floor (0-100), the shipped floors table.
        a, b: the pair's language codes (floor lookup keys).
        direction: None (undirected, max-of-pair floor), 'a->b' or 'b->a'
            (target-side floor).
        metric_trust: resolved {'w', 'basis', 'pa'} for (chrF++, target) —
            see resolve_metric_trust(). None => UNMEASURED prior.
        human_evidence: reserved speaker/expert slot:
            {'class': 'speaker'|'expert', 'share': 0-1, 'n': int,
             'reviewers': int}. Takes precedence over automatic evidence.

    Returns the cq-v1 tuple dict; every component is published so any value
    can be re-derived by hand (the queue.json discipline).
    """
    eligible = _eligible(runs)
    if not eligible and not human_evidence:
        return _unmeasured()

    # --- S3 lane: clean if any LOW evidence; non-LOW can never strengthen.
    clean = [r for r in eligible if _grade(r) == "LOW"]
    if clean:
        lane, evidence = "clean", clean
    elif eligible:
        lane, evidence = "relative", eligible
    else:
        lane, evidence = "clean", []  # human-evidence-only pair

    flags = []

    # --- S4 evidence class precedence: speaker/expert human > automatic.
    if human_evidence and human_evidence.get("share") is not None:
        share = min(1.0, max(0.0, human_evidence["share"]))
        hf_size = min(1.0, (human_evidence.get("n") or 0) / HUMAN_N_FULL)
        hf_rev = min(1.0, (human_evidence.get("reviewers") or 0)
                     / HUMAN_REVIEWERS_FULL)
        r = hf_size * hf_rev
        return {
            "formula_version": FORMULA_VERSION,
            "source": PROVENANCE,
            "lane": lane,
            "evidence_class": human_evidence.get("class") or "speaker",
            "rung": "human",
            "q": share,
            "q_raw": None,
            "r": r,
            "cq": share * r,
            "band": strength_bin(share),
            "band_label": BIN_LABELS[strength_bin(share)],
            "provisional": (human_evidence.get("n") or 0) < HUMAN_N_FULL,
            "components": {"f_size_human": hf_size, "f_reviewers": hf_rev},
            "flags": flags,
            "provenance": {"runs_considered": len(eligible),
                           "evidence": "human"},
        }

    floor = floor_for_pair(floors, a, b, direction=direction)
    supporting = _select_supporting(evidence, floor)
    if supporting is None:
        out = _unmeasured()
        out["lane"] = lane
        out["rung"] = "raw"
        out["flags"] = ["no_canonical_metric"]
        out["provenance"] = {"runs_considered": len(eligible)}
        return out

    raw = supporting["chrf_plus_plus"]
    q = cchrf(raw, floor)
    rung = "L0" if q is not None else "raw"
    if q == 0.0 and raw is not None and floor is not None and raw <= floor:
        flags.append("at_or_below_floor")

    # --- S6 reliability channel.
    n_runs = len(evidence)
    sup = dict(supporting)
    sup["runs_on_pair"] = n_runs
    r_run = run_reliability(sup)

    domains = {r.get("domain") or "_unlabeled" for r in evidence}
    registers = {r.get("register") or "_unlabeled" for r in evidence}
    cover = f_cover(domains, registers)

    mt = metric_trust or {"w": W_METRIC_UNMEASURED, "basis": "unmeasured",
                          "pa": None}
    trust_w = w_trust(supporting.get("trust"))
    rec_w = w_recency(supporting.get("age_days"), supporting.get("paradigm"))
    contam_w = 1.0 if lane == "clean" else w_contam(_grade(supporting))

    r = r_run * cover * mt["w"] * trust_w * rec_w * contam_w

    band = strength_bin(q) if q is not None else None
    provisional = not ((supporting.get("n") or 0) >= SIGNIFICANCE_N)

    return {
        "formula_version": FORMULA_VERSION,
        "source": PROVENANCE,
        "lane": lane,
        "evidence_class": "automatic",
        "rung": rung,
        "q": q,
        "q_raw": min(1.0, max(0.0, raw / 100.0)),
        "r": r,
        "cq": (q * r) if q is not None else None,
        "band": band,
        "band_label": BIN_LABELS[band] if band is not None else None,
        "provisional": provisional,
        "components": {
            "raw_chrf": raw,
            "floor": floor,
            "f_size": f_size(supporting.get("n")),
            "f_rich": f_rich(supporting.get("l_eff")),
            "f_conf": f_conf(supporting.get("ci_halfwidth"),
                             supporting.get("n")),
            "f_repl": f_repl(n_runs),
            "f_cover": cover,
            "w_metric": mt["w"],
            "metric_basis": mt["basis"],
            "w_trust": trust_w,
            "w_recency": rec_w,
            "w_contam": contam_w,
            "n_runs": n_runs,
        },
        "flags": flags,
        "provenance": {
            "runs_considered": len(eligible),
            "supporting_run": supporting.get("run_id"),
            "floor_rule": ("target-side" if direction else "max-of-pair"),
        },
    }


# ---------------------------------------------------------------------------
# S7.4 Chains — ESTIMATED reachability, never a measurement
# ---------------------------------------------------------------------------

def chain_quality(hops):
    """Compose hop tuples into an ESTIMATED chain claim.

    Eligibility per hop: clean lane, comparable rung (L0 or human), a
    positive q, and a chain-eligible corpus (never_chain False — FLORES/
    NTREX are never chain bridges). Any ineligible hop voids the chain.

    Q_chain = LAMBDA^(k-1) * product(q_i)   (quality composes per hop)
    R_chain = min(r_i)                      (a chain claim is only as
                                             strong as its weakest hop)
    """
    if not hops:
        return None
    for h in hops:
        if (h.get("lane") != "clean" or h.get("rung") not in ("L0", "human")
                or not h.get("q") or h["q"] <= 0 or h.get("never_chain")
                or h.get("r") is None):
            return None
    q = LAMBDA_JUNCTION ** (len(hops) - 1)
    for h in hops:
        q *= h["q"]
    r = min(h["r"] for h in hops)
    return {
        "formula_version": FORMULA_VERSION,
        "source": PROVENANCE,
        "estimated": True,
        "hops": len(hops),
        "q": q,
        "r": r,
        "cq": q * r,
    }
