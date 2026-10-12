"""contest_rank — the ranking SSOT for sovereign contests (the competition half).

A contest's sovereignty half (sealed sets, qualifiers, custodian grants, the
organizer node) was built first; this module is the part that turns the
published run cards into a *ranking*: `mt-eval contest rank`, the frozen
snapshot `mt-eval contest close` writes into ``contests.metadata.final_ranking``,
and the JSON/CSV `mt-eval contest export` emits. Everything the website or a
Findings paper needs is in the ``build_ranking`` dict — nothing here is
CLI-private.

Founder rulings this module implements (2026-09-06)
---------------------------------------------------
* **R2 — a contest is SOVEREIGN HOSTING.** An entry is a METHOD the
  organizer's own node executed on the sealed set: Lane A (weights,
  `contest submit-model`) or Lane B (code, `contest submit-method`). The two
  retired upload paths (`contest submit`, `contest submit-hypotheses`) and the
  ``contest_intake`` table they wrote are NOT read here. The entry sources are
  ``contest_submissions`` (what the node published, with the 074 declarations)
  joined to ``authorization_requests`` (the queue item that produced it), so a
  request that is authorized but has no published card is visible as *pending*
  with its state and reason, never silently absent.
* **R1 — prizes exist only on sovereign (sealed-lane) contests**, and
  **R1-trinary (2026-09-07) — the prize term is ONE choice of three, not one
  doctrine and not a matrix.** What is fixed is the execution mode (the entry
  is handed to the host's air-gapped node to be scored). What happens to it
  afterwards is ``metadata.prize_terms.disposition``: ``pass_to_holders``
  (the method passes to the sovereign benchmark holders, who score it and keep
  it regardless), ``retain_ip`` (the participant keeps ownership; the host
  keeps at most a sealed audit copy) or ``release_open`` (the participant
  keeps ownership but must publish under an open licence). The four
  dimensions in ``contest_prize_terms`` are the DERIVED detail behind that
  choice. **No terms = no prize**, said out loud per entry.
  ``resolve_prize_terms`` parses and hashes them, ``ranking["prize_eligibility"]``
  answers each required verification per entry, and ``handover_gate_ok`` — the
  one function `close` calls before freezing — asks those verifications of the
  entries that would win. ``method_release_url`` is public information about an
  entry and is never itself a condition.

The rules, stated once
----------------------
* **Primary metric** — contest configuration: any metric the registry marks
  rankable (``rankable_metrics.RANKABLE_METRICS``: every
  ``shared/metric-registry.json`` entry with a ``ranking`` block — chrF++,
  plain chrF, BLEU, spBLEU, TER, COMET, exact match, and the legacy
  composite). Resolved from ``--metric`` → ``contests.metadata.primary_metric``
  → the harness default (chrF++, the scoring standard's headline), and the
  resolution *source* is reported, never hidden. An alias names exactly the
  metric it spells (``chrf`` is plain chrF).
* **Retired metrics** (scoring standard/1, 2026-10-04) — the weighted
  composite (registry ``ranking.retired``) is refused for a NEW contest
  (``contest.computation_promise``) and for a ``--metric`` view of a contest
  that did not promise it. A contest that already recorded
  ``primary_metric=composite`` still ranks on it, and every surface labels
  the column "legacy composite (retired)". Tables show the primary metric
  with its CI and the standard metrics (chrF++, BLEU, TER, COMET) beside it;
  no quality tier is ever shown.
* **Policies are promises.** Everything in ``contests.metadata`` that migration
  074 freezes once a contest has entries (``tie_test``, ``alpha``,
  ``n_resamples``, ``seed``, ``require_description``, ``allowed_tracks``,
  ``open_weight_only``, ``prize_terms``, ``anonymize_until_close``,
  ``results_visibility``) is read through ONE function — ``resolve_policies``
  — whose vocabulary checks mirror the SQL guard's. A CLI flag may only
  TIGHTEN a frozen policy (a smaller α, more resamples); loosening it is a
  refusal that names both values, because the frozen value is what entrants
  were promised.
* **The computation is a promise too (076).** ``metric_signature`` (the
  sacreBLEU signature, or neural model id + harness version) and
  ``harness_version`` are recorded at creation; a card scored any other way is
  EXCLUDED with both values named, never ranked against the promise.
  ``declared_power`` states the test's size and minimum detectable effect
  before it opens (power.declare_test_power) and is reported with the ranking.
* **Sealed sets get paired tests from the node.** ``--node-verdicts`` takes
  the signed verdicts ``mt-eval node verdicts`` computed over the sealed
  references (contest_verdicts): verified against the node's public key and
  bound to this contest's metric and frozen tie policy, they are rung 1 for
  every adjacent pair they cover.
* **Primary vs contrastive** — only ``is_primary`` entries compete for rank.
  Contrastive entries are ranked in their own section (``contrastive``); they
  never win, and never share a tie group with a primary entry.
* **Tracks** — entries are partitioned by ``track`` (``constrained`` /
  ``unconstrained``). Each track gets its OWN ordering, tie groups and rank
  ranges: a constrained system is never ranked against an unconstrained one.
* **Order** — primary, best first in its own direction (TER: lower) → the
  remaining surface metrics
  (chrF++ → BLEU → COMET, minus the primary) → earliest ``submitted_at`` →
  ``run_card_id``. A card with no value for the primary metric is *unscored*
  and listed, not ranked.
* **Ties are evidence, not decoration.** Each adjacent pair carries a labelled
  verdict from a three-rung ladder, and the rung actually used is named:
    1. per-segment paired test (approximate randomization by default —
       ``significance.py``; Koehn bootstrap on request) when BOTH cards carry
       a complete, aligned ``run_card_entries`` set (only redistribution-
       cleared corpora ever do — migration 033; the organizer node never
       writes entries);
    2. 95 % bootstrap-CI overlap on the run-card CI columns (chrF++ and the
       composite carry CIs; BLEU/COMET have no CI columns);
    3. point equality at the metric's display rounding.
  A non-significant adjacent pair shares a rank; ties chain through adjacent
  pairs (competition numbering 1, 1, 3) and every entry additionally carries
  the WMT-style range ``rank_min``/``rank_max`` of its tie group. Sealed
  contests therefore get CI-overlap or point-equality ties — said out loud in
  ``ranking_method``.
* **Trust** — verified-only by default, matching the public rules page.
  Hidden unverified cards are COUNTED in a loud banner (stderr) and the
  policy is recorded as ``trust_policy``; ``--include-unverified`` opts in.
  ``trust='disqualified'`` is always out.
* **Phases** — an entry carries the ``phase`` it was made in. ``by_phase``
  counts them; the ranked section is the ``evaluation`` phase by default when
  the contest uses phases at all. A ``practice`` ranking is never a final
  result and says so (``phase.freezable``).
* **Identity** — while ``metadata.anonymize_until_close`` holds and identities
  are not revealed, every artifact (table, JSON, CSV) shows a deterministic
  pseudonym instead of a label or team. An email-shaped value is masked on
  EVERY path, revealed or not: a ranking is world-readable the moment it is
  frozen into ``contests.metadata``, and a participant's login is not a byline.
* **Sets** — a contest ranks ONE dataset: ``contests.corpus_id``. Cards
  submitted over any other ``dataset_id`` (a stray dev-set card) are ranked
  separately under ``other_sets``, never mixed in.
* **The holdout split** — cards scored on the contest's
  ``metadata.sealed_holdout_set_id`` are REPORTED under ``holdout`` and never
  ranked: no rank, no tie test, no track partition, no prize eligibility, and
  no ranking-policy exclusion (they were never in the running). They are also
  always deferred to close, so an open contest reports them as a withheld
  count under ``deferred_results`` rather than as entries.
* **Deferred results** — ``contest_deferred_results`` rows (scored but
  withheld under ``results_visibility='hidden_until_close'``, plus every
  holdout result) are REPORTED here as a count; publishing them is
  `close_contest`'s job, not the ranker's.

Network: read-only PostgREST GETs through ``contest._api_request`` (the seam
tests stub). A cached session is used when present (private contests, the
organizer's own requests); nothing here ever prompts for a login.
"""

from __future__ import annotations

import hashlib
import re
import sys
from datetime import datetime, timezone
from typing import Callable, NamedTuple, Optional

from mt_eval_harness import __version__ as HARNESS_VERSION
from mt_eval_harness import contest as _contest
from mt_eval_harness import contest_policy
from mt_eval_harness import contest_verdicts
from mt_eval_harness import contest_prize_terms
from mt_eval_harness.confidence import (
    DEFAULT_ALPHA,
    DEFAULT_N_BOOTSTRAP,
    DEFAULT_SEED,
)
from mt_eval_harness.rankable_metrics import (
    RANKABLE_METRICS,
    recorded_signature,
    retired_reason,
    run_card_select_aliases,
)
from mt_eval_harness.significance import (
    paired_approximate_randomization,
    paired_bootstrap,
)


# ---------------------------------------------------------------------------
# The metric table — every metric the registry marks rankable
# (rankable_metrics.RANKABLE_METRICS, read from the metric registry bundled in
# the package so a wheel-installed node ranks exactly what the monorepo does).
# Which metric a contest ranks on is contest configuration
# (metadata.primary_metric); nothing here narrows that choice.
# ---------------------------------------------------------------------------

PRIMARY_METRICS: dict[str, dict] = RANKABLE_METRICS

METRIC_VOCABULARY: tuple[str, ...] = tuple(PRIMARY_METRICS)
DEFAULT_PRIMARY_METRIC = "chrf_plus_plus"

# Convenience spellings → canonical id. Each alias names exactly the metric it
# spells: `chrf` is plain chrF (word_order=0), the figure FLORES/WMT/AmericasNLP
# report, and never silently chrF++.
METRIC_ALIASES: dict[str, str] = {
    "chrf": "chrf_plain",
    "chrf++": "chrf_plus_plus",
    "chrfpp": "chrf_plus_plus",
    "corpus_bleu": "bleu",
    "comet": "comet_score",
    "composite_score": "composite",
}

# The secondary (surface) tiebreak chain, in order. The composite is never a
# tiebreaker — it is retired (scoring standard/1), never a measurement.
_SECONDARY_TIEBREAKS: tuple[str, ...] = ("chrf_plus_plus", "bleu", "comet_score")

# The standard metrics a ranking table shows beside the primary (minus the
# primary itself): run-card column/alias id -> column header. Never blended,
# never a tier.
_BESIDE_COLUMNS: tuple[tuple[str, str, int], ...] = (
    ("chrf_plus_plus", "chrF++", 2),
    ("bleu", "BLEU", 2),
    ("ter", "TER", 2),
    ("comet_score", "COMET", 4),
)


def metric_label(metric_id: str) -> str:
    """How a ranking surface names ``metric_id``: the registry's display
    name, except that the retired composite is always
    ``scoring.LEGACY_COMPOSITE_LABEL`` ("legacy composite (retired)")."""
    from mt_eval_harness.scoring import LEGACY_COMPOSITE_LABEL
    if metric_id == "composite":
        return LEGACY_COMPOSITE_LABEL
    spec = PRIMARY_METRICS.get(metric_id)
    return spec["label"] if spec else metric_id

# The tie tests, the tracks and the phase names all come from contest_policy —
# the SAME tuples migration 074 writes into the database as CHECK constraints.
TIE_TESTS: tuple[str, ...] = contest_policy.TIE_TESTS
TRACKS: tuple[str, ...] = contest_policy.TRACKS
DEFAULT_TRACK: str = contest_policy.DEFAULT_TRACK
PHASE_NAMES: tuple[str, ...] = contest_policy.PHASE_NAMES
DEFAULT_RANKED_PHASE = "evaluation"

TRUST_VERIFIED_ONLY = "verified-only"
TRUST_INCLUDE_UNVERIFIED = "include-unverified"

# PostgREST caps a single response at 1000 rows; page well under it.
_SEGMENT_PAGE = 500
_CARD_CHUNK = 50

_RUN_CARD_SELECT = ",".join([
    "id", "model_slug", "condition", "trust", "submitter", "dataset_id",
    "language_pair", "corpus_size", "method_class", "paradigm",
    "harness_version", "run_timestamp",
    "chrf_plus_plus", "corpus_bleu", "comet_score", "composite_score",
    "chrf_ci_lower", "chrf_ci_upper", "composite_ci_lower", "composite_ci_upper",
    # Contract C7 — REPORTED, never ranked. Both live inside the run_card
    # JSONB (there is no column for either), aliased out the way the website
    # aliases contamination. Absent on every card minted before the node
    # measured them, which is why every consumer must tolerate None.
    "execution:run_card->execution",
    "by_test_suite:run_card->by_test_suite",
    # Rankable metrics with no denormalized column, and the signature
    # material a frozen metadata.metric_signature is checked against.
    *run_card_select_aliases(),
])

_CONTEST_SELECT = ",".join([
    "id", "name", "description", "corpus_id", "language_pair", "visibility",
    "created_by", "status", "metadata", "created_at", "use_context", "lane",
    "authorization_model", "intake_daily_limit", "intake_open", "shared_task_id",
])

# contest_submissions: the columns every database has, and the declarations
# migration 074 added. Selected together; an endpoint without 074 answers
# "column … does not exist" (42703) and the reader falls back to the base set
# and SAYS SO (`declarations_available: false`), never pretending the entries
# declared nothing.
_SUBMISSION_BASE_SELECT = "id,run_card_id,submitted_by,submitted_at,team,notes"
_SUBMISSION_074_COLUMNS = (
    "is_primary,track,description,method_release_url,constraints,"
    "submitter_label,authorization_request_id,phase"
)

# authorization_requests (migration 038). NOTE: the table has created_at and
# decided_at — there is NO updated_at column; selecting one 400s.
_REQUEST_SELECT = ",".join([
    "request_id", "sealed_set_id", "state", "method_sha", "requested_by",
    "corpus_id", "corpus_version", "node_measurement", "created_at",
    "decided_at",
])

#: authorization_requests.state values that mean "this entry is still coming"
#: (038's vocabulary is pending | authorized | denied | expired, and 075 adds a
#: terminal 'completed' = the result is RECORDED. An authorized request whose
#: node diagnostics say outcome='failed' is not in flight either: the node ran
#: it, it produced no score, and its single-use grant is spent — see
#: _request_failed).
_REQUEST_IN_FLIGHT: tuple[str, ...] = ("pending", "authorized")
_REQUEST_COMPLETED = "completed"
_DIAGNOSTICS_COLUMN = "execution_diagnostics"
_REQUEST_TERMINAL_REFUSED: tuple[str, ...] = ("denied", "expired")

_REQUEST_STATE_REASONS = {
    "pending": ("waiting for custodian authorization — the organizer node runs "
                "an entry only once its request is authorized"),
    "authorized": ("authorized, no published card yet: the node has not "
                   "finished this entry, or its result is deferred until "
                   "close (results_visibility=hidden_until_close)"),
    "denied": "denied by the custodians (see the request's audit trail)",
    "expired": "expired without being executed",
    "completed": ("the node recorded this entry's result (migration 075) but no "
                  "contest submission links it: withheld until close, or "
                  "published outside this contest"),
}

_EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class RankingError(RuntimeError):
    """A ranking that cannot be produced — always with the operator-facing reason."""


# ---------------------------------------------------------------------------
# Metric resolution + tiebreak order
# ---------------------------------------------------------------------------

def canonical_metric(name: str) -> str:
    """Map an alias or canonical id to the canonical id; ValueError otherwise."""
    key = (name or "").strip().lower()
    key = METRIC_ALIASES.get(key, key)
    if key not in PRIMARY_METRICS:
        raise ValueError(
            f"Unknown primary metric {name!r}. Rankable metrics: "
            f"{', '.join(METRIC_VOCABULARY)} (aliases: "
            f"{', '.join(sorted(METRIC_ALIASES))}).")
    return key


def resolve_metric(requested: Optional[str], contest: Optional[dict]) -> tuple[str, str]:
    """Resolve the primary metric and say where it came from.

    Precedence: an explicit request → the contest's recorded
    ``metadata.primary_metric`` → the harness default. Returns
    ``(metric_id, source)`` where source is one of ``"--metric"``,
    ``"contest.metadata.primary_metric"``, ``"harness-default"``.
    A recorded value outside the vocabulary is an error, never silently
    replaced — the DB guard (migrations 072/074) refuses such a value at write
    time, so hitting this means a pre-072 row was hand-edited.

    A RETIRED metric (registry ``ranking.retired`` — the composite, scoring
    standard/1) is resolved only for a contest that recorded it: its own
    promise stands. Requesting it with ``--metric`` for any other contest is
    a ValueError naming the retirement.
    """
    metadata = (contest or {}).get("metadata") or {}
    recorded = metadata.get("primary_metric") if isinstance(metadata, dict) else None
    if requested:
        metric_id = canonical_metric(requested)
        reason = retired_reason(metric_id)
        if reason:
            try:
                recorded_id = canonical_metric(str(recorded)) if recorded else None
            except ValueError:
                recorded_id = None
            if recorded_id != metric_id:
                raise ValueError(
                    f"--metric {requested!r}: {metric_id} is retired as a "
                    f"ranking metric — {reason} Contest "
                    f"{(contest or {}).get('id', '?')!r} records "
                    f"primary_metric={recorded!r}, so it is not ranked on "
                    f"{metric_id}; a retired metric ranks only the legacy "
                    f"contests that promised it.")
        return metric_id, "--metric"
    if recorded:
        try:
            return canonical_metric(str(recorded)), "contest.metadata.primary_metric"
        except ValueError as exc:
            raise ValueError(
                f"Contest {(contest or {}).get('id', '?')!r} records "
                f"metadata.primary_metric={recorded!r}, which is not rankable: "
                f"{exc}") from exc
    return DEFAULT_PRIMARY_METRIC, "harness-default"


def tiebreak_order(metric_id: str) -> list[str]:
    """The full ordering chain for a primary metric, primary first."""
    metric_id = canonical_metric(metric_id)
    chain = [metric_id]
    chain.extend(m for m in _SECONDARY_TIEBREAKS if m != metric_id)
    chain.extend(["submitted_at", "run_card_id"])
    return chain


# ---------------------------------------------------------------------------
# Policies — contests.metadata, read ONCE, checked the way the SQL guard checks
# ---------------------------------------------------------------------------

#: The harness defaults for every policy key. A default is what a contest that
#: promised nothing gets; it is reported as such, never dressed up as a promise.
POLICY_DEFAULTS: dict = {
    "tie_test": "ar",
    "alpha": DEFAULT_ALPHA,
    "n_resamples": DEFAULT_N_BOOTSTRAP,
    "seed": DEFAULT_SEED,
    "require_description": False,
    "allowed_tracks": list(TRACKS),
    "open_weight_only": False,
    "anonymize_until_close": False,
    "results_visibility": "immediate",
    "prize_terms": None,
    # Unset on contests created before these promises existed: nothing was
    # promised, so nothing is checked (and the ranking says so).
    "metric_signature": None,
    "harness_version": None,
    "declared_power": None,
}

POLICY_KEYS: tuple[str, ...] = tuple(POLICY_DEFAULTS)


def _policy_error(contest: Optional[dict], key: str, value, expectation: str) -> RankingError:
    return RankingError(
        f"Contest {(contest or {}).get('id', '?')!r}: metadata.{key} = "
        f"{value!r} is not {expectation}. This is a PROMISE key — migration "
        f"074's contest_lifecycle_guard refuses such a value at write time, so "
        f"a row carrying it predates the guard or was edited by hand. Nothing "
        f"is ranked on an unreadable policy.")


def resolve_policies(contest: Optional[dict]) -> dict:
    """Every participant-facing policy in ``contests.metadata``, resolved.

    Returns the resolved values plus a ``sources`` map
    (``contest.metadata`` | ``harness-default``). Vocabulary checks MIRROR
    migration 074's ``contest_lifecycle_guard``: this module never quietly
    repairs a bad value, because the value is what entrants were told.
    """
    metadata = (contest or {}).get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    out: dict = dict(POLICY_DEFAULTS)
    out["allowed_tracks"] = list(POLICY_DEFAULTS["allowed_tracks"])
    sources = {k: "harness-default" for k in POLICY_KEYS}

    if "tie_test" in metadata:
        v = metadata["tie_test"]
        if not isinstance(v, str) or v not in TIE_TESTS:
            raise _policy_error(contest, "tie_test", v,
                                f"one of {' | '.join(TIE_TESTS)}")
        out["tie_test"], sources["tie_test"] = v, "contest.metadata"

    if "alpha" in metadata:
        v = metadata["alpha"]
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not (0.0 < float(v) < 1.0):
            raise _policy_error(contest, "alpha", v, "a number strictly between 0 and 1")
        out["alpha"], sources["alpha"] = float(v), "contest.metadata"

    if "n_resamples" in metadata:
        v = metadata["n_resamples"]
        if isinstance(v, bool) or not isinstance(v, (int, float)) or int(v) != v or int(v) < 1:
            raise _policy_error(contest, "n_resamples", v, "an integer >= 1")
        out["n_resamples"], sources["n_resamples"] = int(v), "contest.metadata"

    if "seed" in metadata:
        v = metadata["seed"]
        if isinstance(v, bool) or not isinstance(v, (int, float)) or int(v) != v:
            raise _policy_error(contest, "seed", v, "an integer")
        out["seed"], sources["seed"] = int(v), "contest.metadata"

    for key in ("require_description", "open_weight_only", "anonymize_until_close"):
        if key in metadata:
            v = metadata[key]
            if not isinstance(v, bool):
                raise _policy_error(contest, key, v, "a boolean")
            out[key], sources[key] = v, "contest.metadata"

    if "allowed_tracks" in metadata:
        v = metadata["allowed_tracks"]
        if not isinstance(v, list) or not v:
            raise _policy_error(contest, "allowed_tracks", v,
                                "a non-empty array of tracks "
                                f"({' | '.join(TRACKS)})")
        for t in v:
            if not isinstance(t, str) or t not in TRACKS:
                raise _policy_error(contest, "allowed_tracks", t,
                                    f"a track ({' | '.join(TRACKS)})")
        out["allowed_tracks"], sources["allowed_tracks"] = list(v), "contest.metadata"

    if "results_visibility" in metadata:
        v = metadata["results_visibility"]
        if not isinstance(v, str) or v not in contest_policy.RESULTS_VISIBILITY:
            raise _policy_error(contest, "results_visibility", v,
                                f"one of {' | '.join(contest_policy.RESULTS_VISIBILITY)}")
        out["results_visibility"], sources["results_visibility"] = v, "contest.metadata"

    for key in ("metric_signature", "harness_version"):
        if key in metadata and metadata[key] is not None:
            v = metadata[key]
            if not isinstance(v, str) or not v.strip():
                raise _policy_error(contest, key, v, "a non-empty string")
            out[key], sources[key] = v, "contest.metadata"

    if "declared_power" in metadata and metadata["declared_power"] is not None:
        v = metadata["declared_power"]
        mde = v.get("minimum_detectable_effect") if isinstance(v, dict) else None
        if (not isinstance(v, dict) or isinstance(v.get("n_segments"), bool)
                or not isinstance(v.get("n_segments"), int) or v["n_segments"] < 1
                or not isinstance(v.get("metric"), str)
                or not (mde is None or (isinstance(mde, (int, float))
                                        and not isinstance(mde, bool)))):
            raise _policy_error(contest, "declared_power", v,
                                "an object with n_segments (int >= 1), metric and "
                                "minimum_detectable_effect (a number or null)")
        out["declared_power"], sources["declared_power"] = v, "contest.metadata"

    if "prize_terms" in metadata and metadata["prize_terms"] is not None:
        v = metadata["prize_terms"]
        if not isinstance(v, dict):
            raise _policy_error(contest, "prize_terms", v,
                                "an object (the sponsor's published terms)")
        out["prize_terms"], sources["prize_terms"] = v, "contest.metadata"

    out["sources"] = sources
    return out


def resolve_prize_terms(contest: Optional[dict], policies: Optional[dict] = None) -> dict:
    """The contest's DECLARED prize terms (R1 + the 2026-09-07 trinary ruling).

    R1 (unchanged): prizes exist only on sovereign (sealed-lane) contests, and
    a contest's entries are handed to the organizer's air-gapped node to be
    scored. R1-trinary: what happens to the entry afterwards is the host's
    per-contest choice of ONE of ``pass_to_holders`` | ``retain_ip`` |
    ``release_open``, read here through
    ``contest_prize_terms.normalize_prize_terms`` (which fills in the derived
    detail every check below works on). There is no default and no silent
    switch:

    * no ``metadata.prize_terms`` → **no prize**, said plainly, and every
      entry's eligibility says so;
    * ``metadata.prize_terms`` on a non-sealed lane → refusal;
    * prize MONEY declared in metadata (``prize``, ``prize_pool``, …) without
      ``prize_terms`` → refusal, because an advertised prize with undeclared
      terms is the exact ambiguity the disposition removes;
    * unreadable terms → refusal naming the offending values.

    Returns ``{declared, terms, terms_sha256, describe, gate, source, note}``.
    ``gate`` is the list of verification steps a payout requires, derived from
    the terms by ``contest_prize_terms.prize_gate``.
    """
    policies = policies or resolve_policies(contest)
    contest_id = (contest or {}).get("id", "?")
    metadata = (contest or {}).get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    terms = policies.get("prize_terms")
    if not terms:
        advertised = contest_prize_terms.money_declared_without_terms(metadata)
        if advertised:
            raise RankingError(
                f"Contest {contest_id!r} advertises a prize "
                f"(metadata.{', metadata.'.join(advertised)}) but declares no "
                f"metadata.prize_terms. Since the 2026-09-07 ruling a prized "
                f"contest declares ONE term — "
                f"{' | '.join(contest_prize_terms.DISPOSITIONS)} — and a prize "
                f"whose term nobody wrote down cannot be ranked or paid. "
                f"Declare prize_terms.disposition, or remove the prize.")
        return {
            "declared": False,
            "terms": None,
            "terms_sha256": None,
            "describe": ("No prize terms are declared on this contest, so "
                         "there is no prize. Nothing here computes an "
                         "eligibility for one."),
            "gate": [],
            "source": policies["sources"]["prize_terms"],
            "note": ("no metadata.prize_terms on this contest — NO PRIZE. A "
                     "prized contest must declare its terms; there is no "
                     "default set of terms and none is assumed"),
        }
    lane = (contest or {}).get("lane")
    if lane != "sealed":
        raise RankingError(
            f"Contest {contest_id!r} declares metadata.prize_terms but its "
            f"lane is {lane!r}. Since 2026-09-06, PRIZES EXIST "
            f"ONLY ON SOVEREIGN (sealed-lane) CONTESTS — the entry is executed "
            f"by the host's air-gapped node on a sealed set. Remove the prize "
            f"terms, or prepare the contest on the sealed lane.")
    try:
        parsed = contest_prize_terms.normalize_prize_terms(terms)
        digest = contest_prize_terms.terms_sha256(parsed)
        gate = contest_prize_terms.prize_gate(parsed)
        text = contest_prize_terms.describe(parsed)
    except contest_prize_terms.PrizeTermsError as exc:
        raise RankingError(
            f"Contest {contest_id!r}: {exc} Migration 074's "
            f"contest_lifecycle_guard refuses such terms at write time, so a "
            f"row carrying them predates the guard or was edited by hand. "
            f"Nothing is ranked on unreadable prize terms.") from exc
    return {
        "declared": True,
        "terms": parsed,
        "terms_sha256": digest,
        "describe": text,
        "gate": gate,
        "source": policies["sources"]["prize_terms"],
        "note": (f"declared prize terms, sha256 {digest[:16]}… — the hash a "
                 f"participant accepts with --accept-terms and the node checks "
                 f"against the frozen contest row. Payout verifications "
                 f"required by these terms: {', '.join(gate)}."),
    }


def resolve_tie_policy(
    contest: Optional[dict],
    *,
    tie_test: Optional[str] = None,
    alpha: Optional[float] = None,
    n_resamples: Optional[int] = None,
    seed: Optional[int] = None,
    policies: Optional[dict] = None,
) -> dict:
    """The significance policy actually used, and where each field came from.

    Precedence: the contest's FROZEN promise (``contests.metadata``) wins over
    the harness default; a caller may only **tighten** a frozen promise —

    * ``alpha``   — smaller is tighter (a stricter bar for calling two systems
      different); a larger α is a refusal.
    * ``n_resamples`` — more is tighter; fewer is a refusal.
    * ``tie_test`` — neither test is a tightening of the other, so any change
      is a refusal.
    * ``seed`` — the seed IS the reproducibility promise; any change is a
      refusal.

    A request equal to the harness default is treated as "not asked for": the
    frozen promise governs and the source says so. Returns
    ``{tie_test, alpha, n_resamples, seed, source: {field: origin}}`` where
    origin is ``frozen-metadata`` | ``default`` | ``cli``.
    """
    policies = policies or resolve_policies(contest)
    cid = (contest or {}).get("id", "?")
    resolved: dict = {}
    source: dict = {}

    requested = {
        "tie_test": tie_test,
        "alpha": None if alpha is None else float(alpha),
        "n_resamples": None if n_resamples is None else int(n_resamples),
        "seed": None if seed is None else int(seed),
    }

    for field in ("tie_test", "alpha", "n_resamples", "seed"):
        frozen = policies["sources"][field] == "contest.metadata"
        promised = policies[field]
        want = requested[field]
        # A value identical to the harness default is not a request — the CLI
        # always has SOME value, and a default must never silently override a
        # promise.
        if want is not None and want == POLICY_DEFAULTS[field]:
            want = None
        if want is None or want == promised:
            resolved[field] = promised
            source[field] = "frozen-metadata" if frozen else "default"
            continue
        if not frozen:
            resolved[field] = want
            source[field] = "cli"
            continue
        # A frozen promise + a different request: tighten or refuse.
        if field == "alpha" and want < promised:
            resolved[field], source[field] = want, "cli (tightened)"
        elif field == "n_resamples" and want > promised:
            resolved[field], source[field] = want, "cli (tightened)"
        else:
            raise RankingError(
                f"Contest {cid!r} froze {field}={promised!r} in "
                f"contests.metadata — the significance rule entrants were "
                f"promised (migration 074 freezes it once the contest has "
                f"entries). The requested {field}={want!r} would "
                f"{'weaken' if field in ('alpha', 'n_resamples') else 'replace'} "
                f"it. A flag may only TIGHTEN a frozen policy "
                f"(a smaller alpha, more resamples); it may never change the "
                f"test or the seed.")

    if resolved["tie_test"] not in TIE_TESTS:
        raise ValueError(f"tie_test must be one of {TIE_TESTS}, got {resolved['tie_test']!r}")
    if not (0.0 < float(resolved["alpha"]) < 1.0):
        raise ValueError("alpha must be in (0, 1)")
    if int(resolved["n_resamples"]) < 1:
        raise ValueError("n_resamples must be >= 1")
    resolved["source"] = source
    return resolved


# ---------------------------------------------------------------------------
# Identity — pseudonyms, and the email that never rides along
# ---------------------------------------------------------------------------

def pseudonym_for(contest_id: str, key: str) -> str:
    """The deterministic display name for one entry under anonymisation.

    ``entry-<6 hex of sha256(contest_id + key)>`` where ``key`` is the entry's
    ``authorization_request_id`` (its stable public identity) or, for an entry
    with no request row, its ``run_card_id``. Deterministic so the same entry
    reads the same across a `rank`, the frozen snapshot and a CSV; scoped to
    the contest so the same team is not trivially linkable across contests.
    """
    digest = hashlib.sha256(f"{contest_id}{key}".encode("utf-8")).hexdigest()
    return f"entry-{digest[:6]}"


class _Identity:
    """Renders a display name for one entry, and never renders an email.

    Two independent reasons a value is replaced by the pseudonym:

    1. **anonymise-until-close** — the contest promised entrants that names
       stay hidden while it is open;
    2. **it looks like an email** — ``contest_submissions.submitted_by`` is the
       JWT email by RLS (migration 052), and a frozen ranking is written into
       world-readable ``contests.metadata``. A login is not a byline. This
       masking applies on EVERY path, revealed or not.
    """

    def __init__(self, contest_id: str, *, anonymized: bool):
        self.contest_id = contest_id
        self.anonymized = anonymized
        self.masked_emails = 0

    def name(self, entry: dict, *values: Optional[str]) -> str:
        pseudo = pseudonym_for(
            self.contest_id,
            entry.get("authorization_request_id") or entry.get("run_card_id") or "?")
        if self.anonymized:
            return pseudo
        for v in values:
            if not v:
                continue
            text = str(v).strip()
            if not text:
                continue
            if _EMAIL_RE.search(text):
                self.masked_emails += 1
                continue
            return text
        return pseudo

    def scrub(self, value: Optional[str], entry: dict) -> Optional[str]:
        """A free-text field (a team, a run-card submitter) rendered safely."""
        if value is None:
            return None
        text = str(value)
        if self.anonymized:
            return self.name(entry)
        if _EMAIL_RE.search(text):
            self.masked_emails += 1
            return self.name(entry)
        return text


def check_reveal_permitted(
    contest: dict,
    session: Optional[dict],
    *,
    i_am_the_organizer: bool = False,
) -> None:
    """Refuse ``--reveal-identities`` unless the caller has standing.

    Permitted when the signed-in identity OWNS the contest AND the contest is
    closed/archived (the anonymity promise expires at close), or when the
    caller asserts organizer standing explicitly with
    ``--i-am-the-organizer`` — an assertion that is recorded in
    ``identity_policy.source``, not a permission the harness can verify from
    outside the database. Everything else is a refusal that names the reason.
    """
    if i_am_the_organizer:
        return
    email = ((session or {}).get("user") or {}).get("email") or ""
    owner = contest.get("created_by")
    status = contest.get("status")
    if email and owner and email == owner and status in ("closed", "archived"):
        return
    raise RankingError(
        f"Refusing --reveal-identities on contest {contest.get('id')!r}: "
        f"identities are revealed only by the OWNER "
        f"({owner or 'unknown'}) and only once the contest is closed "
        f"(status is {status!r}; you are "
        f"{email or 'not signed in'}). The contest promised entrants "
        f"anonymity until close (metadata.anonymize_until_close); a ranking "
        f"that unmasks them early breaks that promise. `mt-eval contest close "
        f"--reveal-identities` does it as part of the close; pass "
        f"--i-am-the-organizer to assert organizer standing here, which is "
        f"recorded in identity_policy.source.")


# ---------------------------------------------------------------------------
# Fetching (read-only PostgREST through the contest.py seam)
# ---------------------------------------------------------------------------

def _api(method: str, path: str, *, params: Optional[dict] = None,
         session: Optional[dict] = None):
    # Module-attribute call so tests that stub ``contest._api_request`` see
    # every read this module performs.
    return _contest._api_request(method, path, params=params, session=session)


def _missing_relation(err: Exception) -> bool:
    """True when PostgREST says the column/table simply is not there.

    42703 undefined column, 42P01 undefined table, PGRST205 unknown relation —
    what an endpoint that predates a migration answers. A genuine server or
    network error does not look like this and is left to propagate.
    """
    msg = str(err).lower()
    return ("42703" in msg or "42p01" in msg or "pgrst205" in msg
            or "does not exist" in msg or "could not find the table" in msg)


def fetch_contest(contest_id: str, session: Optional[dict] = None) -> dict:
    """The contest row, or RankingError when it is not visible/existent."""
    rows = _api("GET", "contests",
                params={"id": f"eq.{contest_id}", "select": _CONTEST_SELECT},
                session=session)
    if not isinstance(rows, list) or not rows:
        raise RankingError(
            f"Contest '{contest_id}' not found (or not visible to this "
            f"session — team contests need the organizer's sign-in).")
    row = rows[0]
    if not isinstance(row.get("metadata"), dict):
        row["metadata"] = {}
    return row


def contest_sealed_set_ids(contest: dict) -> list[str]:
    """The sealed sets a contest evaluates against.

    The Python twin of migration 074's ``contest_sealed_set_ids(text)``:
    ``contests.corpus_id`` plus the optional
    ``metadata.sealed_holdout_set_id``. Computed from the contest row already
    in hand rather than through ``rpc/`` so a pre-074 endpoint answers the
    same, and so ranking costs one fewer round trip.
    """
    ids: list[str] = []
    for value in (contest.get("corpus_id"),
                  (contest.get("metadata") or {}).get("sealed_holdout_set_id")):
        if isinstance(value, str) and value and value not in ids:
            ids.append(value)
    return ids


def _in_list(ids: list[str]) -> str:
    quoted = []
    for i in ids:
        if all(ch.isalnum() or ch in "-_.:" for ch in i):
            quoted.append(i)
        else:
            quoted.append('"' + i.replace('"', '\\"') + '"')
    return "in.(" + ",".join(quoted) + ")"


def _fetch_submissions(contest_id: str, session: Optional[dict]) -> tuple[list[dict], bool, str]:
    """contest_submissions rows; ``(rows, declarations_available, note)``."""
    params = {
        "contest_id": f"eq.{contest_id}",
        "select": f"{_SUBMISSION_BASE_SELECT},{_SUBMISSION_074_COLUMNS}",
        "order": "submitted_at.asc,id.asc",
    }
    try:
        rows = _api("GET", "contest_submissions", params=params, session=session)
        return (rows if isinstance(rows, list) else []), True, ""
    except RuntimeError as exc:
        if not _missing_relation(exc):
            raise
    rows = _api("GET", "contest_submissions", params={
        "contest_id": f"eq.{contest_id}",
        "select": _SUBMISSION_BASE_SELECT,
        "order": "submitted_at.asc,id.asc",
    }, session=session)
    note = ("this endpoint has no contest_submissions declaration columns "
            "(migration 074 is not applied here): every entry is read as a "
            "PRIMARY entry in the default track with no description, because "
            "that is all the database can say — not because the entries "
            "declared it")
    return (rows if isinstance(rows, list) else []), False, note


def _fetch_requests(sealed_set_ids: list[str], session: Optional[dict]) -> tuple[list[dict], str]:
    """authorization_requests for a contest's sealed sets; ``(rows, note)``."""
    if not sealed_set_ids:
        return [], ("this contest names no sealed set (contests.corpus_id is "
                    "empty), so no authorization requests can be attributed to "
                    "it — in-flight entries cannot be listed")
    params = {
        "sealed_set_id": _in_list(sealed_set_ids),
        "select": f"{_REQUEST_SELECT},{_DIAGNOSTICS_COLUMN}",
        "order": "created_at.asc",
    }
    try:
        rows = _api("GET", "authorization_requests", params=params, session=session)
        return (rows if isinstance(rows, list) else []), ""
    except RuntimeError as exc:
        if not _missing_relation(exc):
            raise
    # Either the table is absent (no sovereign lane) or only the 074
    # diagnostics column is. Retry without it and say which.
    try:
        rows = _api("GET", "authorization_requests", params={
            **params, "select": _REQUEST_SELECT}, session=session)
    except RuntimeError as exc:
        if not _missing_relation(exc):
            raise
        return [], ("this endpoint has no authorization_requests table "
                    "(the sovereign lane, migrations 037-045, is not "
                    "provisioned here): entries in flight cannot be listed")
    return (rows if isinstance(rows, list) else []), (
        "this endpoint has no authorization_requests.execution_diagnostics "
        "column (migration 074 is not applied here): an entry the node ran and "
        "failed cannot be told apart from one still in flight, so both are "
        "listed as in flight")


def _request_failed(request: dict) -> Optional[dict]:
    """The node's counts-only failure record for a request, or None.

    execution_facts writes ``outcome='failed'`` + the pipeline ``stage`` (and
    whatever counts are known) when a run produced no score. Such a request
    stays ``authorized`` in the 038 state machine — a failed run is not a
    custodian refusal — but it is not in flight: the single-use grant is
    spent, and a re-run needs a fresh proposal.
    """
    diagnostics = request.get(_DIAGNOSTICS_COLUMN)
    if isinstance(diagnostics, dict) and diagnostics.get("outcome") == "failed":
        return diagnostics
    return None


def _failure_reason(diagnostics: dict) -> str:
    counts = ", ".join(
        f"{k}={diagnostics[k]}" for k in (
            "exit_code", "runtime_seconds", "n_sources", "n_output_lines",
            "stderr_bytes")
        if diagnostics.get(k) is not None)
    return (f"the node ran this entry and it produced no score (stage: "
            f"{diagnostics.get('stage') or 'unrecorded'}"
            f"{'; ' + counts if counts else ''}). Its single-use grant is spent; "
            f"a re-run needs a fresh proposal")


def fetch_deferred_results(contest_id: str, session: Optional[dict] = None) -> dict:
    """Counts of scored-but-withheld results — READ ONLY.

    ``contest_deferred_results`` (migration 074) holds run cards produced by a
    finished sealed run that are withheld until close: everything under
    ``results_visibility='hidden_until_close'``, plus every holdout result.
    Publishing them is ``close_contest``'s job (contract C5); this module only
    reports that they exist, so a provisional ranking never reads as complete
    when it is not.

    RLS gives SELECT to the contest OWNER only, so an anonymous read returns an
    empty list — indistinguishable from "none deferred". The note says so
    rather than letting a zero imply an all-clear.
    """
    try:
        rows = _api("GET", "contest_deferred_results", params={
            "contest_id": f"eq.{contest_id}",
            "select": "request_id,role,published_run_card_id",
        }, session=session)
    except RuntimeError as exc:
        if not _missing_relation(exc):
            raise
        return {
            "count": None,
            "note": ("contest_deferred_results is not present on this endpoint "
                     "(migration 074 not applied) — whether any result is being "
                     "withheld cannot be determined here"),
            "readable": False,
        }
    rows = rows if isinstance(rows, list) else []
    unpublished = [r for r in rows if not r.get("published_run_card_id")]
    by_role = {}
    for r in unpublished:
        role = r.get("role") or "?"
        by_role[role] = by_role.get(role, 0) + 1
    note = (f"{len(unpublished)} scored result(s) withheld until close "
            f"({', '.join(f'{k}: {v}' for k, v in sorted(by_role.items())) or 'none'}); "
            f"`mt-eval contest close` publishes them BEFORE the ranking is "
            f"frozen. Visible to the contest owner only (RLS): an anonymous or "
            f"non-owner read cannot tell 0 from hidden.")
    return {
        "count": len(unpublished),
        "note": note,
        "readable": True,
        "by_role": by_role,
        "total_rows": len(rows),
    }


def gather_entries(contest_id: str, session: Optional[dict] = None,
                   contest: Optional[dict] = None) -> dict:
    """The entries of a sovereign contest, and the work still in flight.

    Under founder ruling R2 there is ONE entry pathway: a method handed to the
    organizer's node. Its two halves are read here —

    * ``contest_submissions`` — what the node PUBLISHED, carrying the entry's
      own declarations (migration 074: ``is_primary``, ``track``,
      ``description``, ``method_release_url``, ``constraints``,
      ``submitter_label``, ``authorization_request_id``, ``phase``);
    * ``authorization_requests`` — the queue item for every sealed set of this
      contest (``contests.corpus_id`` + ``metadata.sealed_holdout_set_id``).

    A request with no published card is listed as **pending** with its state
    and the reason, and a denied/expired one as **rejected** — an entry in
    flight is never silently absent from a ranking. The retired
    ``contest_intake`` table is not read.

    An authorized request the node ran and FAILED (``execution_diagnostics.
    outcome='failed'``) is listed as **failed** with its stage and counts —
    never as pending forever — and a 075 ``completed`` request with no linked
    submission as **completed**.

    Returns ``{"entries", "pending", "failed", "completed", "rejected",
    "notes", "declarations_available", "requests_available"}``.
    """
    if contest is None:
        contest = fetch_contest(contest_id, session=session)
    notes: list[str] = []

    subs, declarations_available, sub_note = _fetch_submissions(contest_id, session)
    if sub_note:
        notes.append(sub_note)
    requests, req_note = _fetch_requests(contest_sealed_set_ids(contest), session)
    if req_note:
        notes.append(req_note)
    requests_by_id = {r.get("request_id"): r for r in requests if r.get("request_id")}

    by_card: dict[str, dict] = {}
    for s in subs:
        rid = s.get("run_card_id")
        if not rid:
            continue
        if rid in by_card:
            # A duplicate link (re-submission) never counts twice; the first
            # submission time is the one that ranks.
            continue
        request_id = s.get("authorization_request_id")
        request = requests_by_id.get(request_id) if request_id else None
        constraints = s.get("constraints")
        by_card[rid] = {
            "run_card_id": rid,
            "submission_id": s.get("id"),
            # RAW, never emitted: contest_submissions.submitted_by is the JWT
            # email (migration 052 binds it). The ranking shows a label or a
            # pseudonym — see _Identity.
            "submitted_by": s.get("submitted_by"),
            "submitted_at": s.get("submitted_at"),
            "team": s.get("team"),
            "notes": s.get("notes") or "",
            "is_primary": True if s.get("is_primary") is None else bool(s.get("is_primary")),
            "track": s.get("track") or DEFAULT_TRACK,
            "description": s.get("description") or "",
            "method_release_url": s.get("method_release_url"),
            "constraints": constraints if isinstance(constraints, dict) else {},
            "submitter_label": s.get("submitter_label"),
            "authorization_request_id": request_id,
            "phase": s.get("phase"),
            "pathway": ("contest_submissions+authorization_request" if request
                        else "contest_submissions"),
            "request": request,
        }

    linked = {e["authorization_request_id"] for e in by_card.values()
              if e.get("authorization_request_id")}
    pending: list[dict] = []
    failed: list[dict] = []
    completed: list[dict] = []
    rejected: list[dict] = []
    for r in requests:
        rid = r.get("request_id")
        if not rid or rid in linked:
            continue
        state = r.get("state")
        row = {
            "authorization_request_id": rid,
            "sealed_set_id": r.get("sealed_set_id"),
            "state": state,
            "method_sha": r.get("method_sha"),
            "created_at": r.get("created_at"),
            "decided_at": r.get("decided_at"),
            "reason": _REQUEST_STATE_REASONS.get(
                state, f"authorization request state {state!r}"),
        }
        failure = _request_failed(r)
        if state in _REQUEST_TERMINAL_REFUSED:
            rejected.append(row)
        elif state == "authorized" and failure is not None:
            row["reason"] = _failure_reason(failure)
            row["diagnostics"] = failure
            failed.append(row)
        elif state == _REQUEST_COMPLETED:
            completed.append(row)
        elif state in _REQUEST_IN_FLIGHT:
            pending.append(row)
        else:
            # An unknown state is work we cannot classify — surfaced as
            # pending with the state named, never dropped.
            pending.append(row)

    return {
        "entries": list(by_card.values()),
        "pending": pending,
        "failed": failed,
        "completed": completed,
        "rejected": rejected,
        "notes": notes,
        "declarations_available": declarations_available,
        "requests_available": not req_note,
    }


def fetch_run_cards(ids: list[str], session: Optional[dict] = None) -> dict[str, dict]:
    """Run-card rows by id, fetched in chunks of 50 (URL length + PostgREST)."""
    out: dict[str, dict] = {}
    ids = [i for i in ids if i]
    for start in range(0, len(ids), _CARD_CHUNK):
        chunk = ids[start:start + _CARD_CHUNK]
        rows = _api("GET", "run_cards", params={
            "id": _in_list(chunk),
            "select": _RUN_CARD_SELECT,
        }, session=session)
        for row in (rows if isinstance(rows, list) else []):
            if row.get("id"):
                out[row["id"]] = row
    return out


def fetch_segments(run_card_id: str, expected_n: Optional[int] = None,
                   session: Optional[dict] = None) -> tuple[Optional[list[dict]], str]:
    """Per-segment rows for a card, paginated; ``(entries, reason)``.

    ``entries`` is None when the set is absent or incomplete — an incomplete
    set must never feed a paired test (it would silently compare subsets).
    Entries come back in the ``significance.py`` shape (``id``, ``expected``,
    ``predicted``, ``error``) sorted by ``id``.
    """
    rows: list[dict] = []
    offset = 0
    while True:
        page = _api("GET", "run_card_entries", params={
            "run_card_id": f"eq.{run_card_id}",
            "select": "entry_id,expected,predicted,error",
            "order": "id.asc",
            "limit": _SEGMENT_PAGE,
            "offset": offset,
        }, session=session)
        page = page if isinstance(page, list) else []
        rows.extend(page)
        if len(page) < _SEGMENT_PAGE:
            break
        offset += _SEGMENT_PAGE
    if not rows:
        return None, ("no per-segment rows (aggregates-only publish — sealed "
                      "or non-redistributable corpus)")
    if expected_n and len(rows) != expected_n:
        return None, f"per-segment rows incomplete ({len(rows)}/{expected_n})"
    entries = [{
        "id": str(r.get("entry_id")),
        "expected": r.get("expected") or "",
        "predicted": r.get("predicted") or "",
        "error": r.get("error"),
    } for r in rows]
    entries.sort(key=lambda e: e["id"])
    return entries, f"{len(entries)} per-segment rows"


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------

def _metric_value(card: dict, metric_id: str) -> Optional[float]:
    v = card.get(PRIMARY_METRICS[metric_id]["column"])
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _sort_key(entry: dict, chain: list[str]):
    key = []
    card = entry["card"]
    for m in chain:
        if m == "submitted_at":
            ts = entry.get("submitted_at")
            key.append((1, "") if not ts else (0, str(ts)))
        elif m == "run_card_id":
            key.append(str(entry["run_card_id"]))
        else:
            v = _metric_value(card, m)
            # Best first in the metric's own direction; None sorts last.
            if v is None:
                key.append((1, 0.0))
            else:
                key.append((0, v if PRIMARY_METRICS[m]["direction"] == "lower" else -v))
    return tuple(key)


def order_entries(entries: list[dict], metric_id: str) -> list[dict]:
    """Sort entries (dicts carrying ``card``) by the full tiebreak chain.

    Entries without a value for the primary metric are NOT included — the
    caller lists them as ``unscored``.
    """
    chain = tiebreak_order(metric_id)
    scored = [e for e in entries if _metric_value(e["card"], metric_id) is not None]
    return sorted(scored, key=lambda e: _sort_key(e, chain))


# ---------------------------------------------------------------------------
# Pair evidence — the three-rung ladder
# ---------------------------------------------------------------------------

def pair_evidence(
    upper: dict,
    lower: dict,
    metric_id: str,
    *,
    segments_upper: Optional[list[dict]] = None,
    segments_lower: Optional[list[dict]] = None,
    segments_note: str = "",
    tie_test: str = "ar",
    n_resamples: int = DEFAULT_N_BOOTSTRAP,
    alpha: float = DEFAULT_ALPHA,
    seed: int = DEFAULT_SEED,
) -> dict:
    """Is the adjacent pair (upper ranked above lower) distinguishable?

    Returns ``{method, tied, reason, ...}`` with ``method`` naming the rung
    used: ``approximate_randomization`` | ``paired_bootstrap`` |
    ``ci_overlap`` | ``point_equality``.
    """
    if tie_test not in TIE_TESTS:
        raise ValueError(f"tie_test must be one of {TIE_TESTS}, got {tie_test!r}")
    spec = PRIMARY_METRICS[metric_id]
    label = spec["label"]
    card_u, card_l = upper["card"], lower["card"]
    v_u, v_l = _metric_value(card_u, metric_id), _metric_value(card_l, metric_id)

    # Rung 1 — a paired test over per-segment rows.
    seg_fn: Optional[Callable] = spec["segment_fn"]
    if seg_fn is not None and segments_upper and segments_lower:
        ids_u = [e["id"] for e in segments_upper]
        ids_l = [e["id"] for e in segments_lower]
        if ids_u == ids_l:
            if tie_test == "ar":
                res = paired_approximate_randomization(
                    segments_upper, segments_lower, seg_fn,
                    n_trials=n_resamples, alpha=alpha, seed=seed,
                    metric_name=metric_id)
                method = "approximate_randomization"
            else:
                res = paired_bootstrap(
                    segments_upper, segments_lower, seg_fn,
                    n_bootstrap=n_resamples, alpha=alpha, seed=seed,
                    metric_name=metric_id)
                method = "paired_bootstrap"
            tied = not res.significant
            verdict = "≥" if tied else "<"
            return {
                "method": method,
                "tied": tied,
                "reason": (f"{label}: p={res.p_value:.4f} {verdict} α={alpha} on "
                           f"{len(ids_u)} paired segments "
                           f"({'not ' if tied else ''}significant; "
                           f"delta={res.delta:+.4f})"),
                "p_value": round(res.p_value, 6),
                "delta": round(res.delta, 6),
                "ci_lower": round(res.ci_lower, 6),
                "ci_upper": round(res.ci_upper, 6),
                "n_segments": len(ids_u),
                "n_resamples": n_resamples,
                "alpha": alpha,
                "seed": seed,
            }
        segments_note = (segments_note + "; " if segments_note else "") + \
            "segment ids differ between the two cards"

    # Rung 2 — CI overlap on the card columns (a conservative proxy).
    ci_cols = spec["ci_columns"]
    if ci_cols:
        lo_u, hi_u = card_u.get(ci_cols[0]), card_u.get(ci_cols[1])
        lo_l, hi_l = card_l.get(ci_cols[0]), card_l.get(ci_cols[1])
        if None not in (lo_u, hi_u, lo_l, hi_l):
            lo_u, hi_u, lo_l, hi_l = map(float, (lo_u, hi_u, lo_l, hi_l))
            overlap = (lo_u <= hi_l) and (lo_l <= hi_u)
            why = f" ({segments_note})" if segments_note else ""
            return {
                "method": "ci_overlap",
                "tied": overlap,
                "reason": (f"{label}: 95% bootstrap CIs [{lo_u:.4g}, {hi_u:.4g}] "
                           f"and [{lo_l:.4g}, {hi_l:.4g}] "
                           f"{'overlap' if overlap else 'do not overlap'}"
                           f" — CI overlap is a conservative proxy, not a "
                           f"paired test{why}"),
                "ci_upper_entry": [lo_u, hi_u],
                "ci_lower_entry": [lo_l, hi_l],
            }
        ci_note = f"CI columns {ci_cols[0]}/{ci_cols[1]} not populated on both cards"
    else:
        ci_note = f"no CI columns exist for {label}"

    # Rung 3 — point equality at display rounding.
    nd = spec["rounding"]
    equal = (v_u is not None and v_l is not None and round(v_u, nd) == round(v_l, nd))
    notes = "; ".join(n for n in (segments_note, ci_note) if n)
    return {
        "method": "point_equality",
        "tied": equal,
        "reason": (f"{label}: {v_u if v_u is None else round(v_u, nd)} vs "
                   f"{v_l if v_l is None else round(v_l, nd)} "
                   f"{'equal' if equal else 'differ'} at {nd} decimals — "
                   f"no significance evidence available ({notes})"),
    }


def assign_tie_groups(ordered: list[dict], evidences: list[Optional[dict]]) -> list[tuple[int, int]]:
    """Competition ranks + tie-group ids for an ordered list.

    ``evidences[i]`` is the verdict between ``ordered[i-1]`` and
    ``ordered[i]`` (``evidences[0]`` is ignored/None). Non-significance
    chains: ``[A, B~A, C~B]`` → ranks 1, 1, 1; ``[A, B~A, C]`` → 1, 1, 3.
    """
    out: list[tuple[int, int]] = []
    rank = 0
    group = 0
    for i, _ in enumerate(ordered):
        tied = bool(i > 0 and evidences[i] and evidences[i].get("tied"))
        if i == 0 or not tied:
            rank = i + 1
            group += 1
        out.append((rank, group))
    return out


def rank_ranges(groups: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """WMT-style ``(rank_min, rank_max)`` per entry, from its tie group.

    A tie group of size *k* starting at competition rank *r* occupies ranks
    *r*…*r+k-1*: every member could be any of them, and the range says so
    instead of the table implying an order the evidence does not support.
    """
    sizes: dict[int, int] = {}
    for _, group in groups:
        sizes[group] = sizes.get(group, 0) + 1
    return [(rank, rank + sizes[group] - 1) for rank, group in groups]


# ---------------------------------------------------------------------------
# The ranking itself
# ---------------------------------------------------------------------------

#: The execution fields the ranking reports. A subset of what the card
#: carries: the cost of the run and the conditions it ran under, without the
#: build/run split or byte counts that only the operator needs.
_EXECUTION_REPORTED: tuple[str, ...] = (
    "runtime_seconds", "cpus", "ram_gb", "gpu", "runtime", "node_id",
    "image_digest",
)


def _execution_payload(card: dict) -> Optional[dict]:
    """The reported execution block, or None when the card carries none.

    None means "this card predates execution accounting, or was produced by a
    lane that measures nothing" — never a zero, which would read as "it ran
    instantly".
    """
    execution = card.get("execution")
    if not isinstance(execution, dict):
        return None
    return {key: execution.get(key) for key in _EXECUTION_REPORTED}


def _entry_payload(entry: dict, metric_id: str, rank: int, group: int,
                   rank_min: int, rank_max: int,
                   evidence: Optional[dict], identity: _Identity) -> dict:
    card = entry["card"]
    spec = PRIMARY_METRICS[metric_id]
    ci_cols = spec["ci_columns"]
    request = entry.get("request") or {}
    label = identity.name(entry, entry.get("submitter_label"), entry.get("team"))
    return {
        "rank": rank,
        "rank_min": rank_min,
        "rank_max": rank_max,
        "tie_group": group,
        "run_card_id": entry["run_card_id"],
        "model_slug": card.get("model_slug"),
        "condition": card.get("condition"),
        "trust": card.get("trust"),
        # Never an email on any path — see _Identity.
        "submitter_label": label,
        "pseudonym": pseudonym_for(
            identity.contest_id,
            entry.get("authorization_request_id") or entry["run_card_id"]),
        "submitter": identity.scrub(card.get("submitter"), entry),
        "team": identity.scrub(entry.get("team"), entry),
        "submitted_at": entry.get("submitted_at"),
        "notes": entry.get("notes") or "",
        "pathway": entry.get("pathway"),
        # The entry's own declarations (migration 074).
        "is_primary": bool(entry.get("is_primary", True)),
        "track": entry.get("track") or DEFAULT_TRACK,
        "phase": entry.get("phase"),
        "description": entry.get("description") or "",
        "has_description": bool((entry.get("description") or "").strip()),
        "method_release_url": entry.get("method_release_url"),
        "constraints": entry.get("constraints") or {},
        "authorization_request_id": entry.get("authorization_request_id"),
        "request_state": request.get("state"),
        "method_sha": request.get("method_sha"),
        "dataset_id": card.get("dataset_id"),
        "language_pair": card.get("language_pair"),
        "corpus_size": card.get("corpus_size"),
        "method_class": card.get("method_class"),
        "paradigm": card.get("paradigm"),
        "harness_version": card.get("harness_version"),
        "run_timestamp": card.get("run_timestamp"),
        "primary": {
            "metric": metric_id,
            "value": _metric_value(card, metric_id),
            "ci_lower": card.get(ci_cols[0]) if ci_cols else None,
            "ci_upper": card.get(ci_cols[1]) if ci_cols else None,
        },
        "scores": {m: _metric_value(card, m) for m in METRIC_VOCABULARY},
        # Contract C7 — reported, never ranked. `execution` is what it cost to
        # run (wall clock, the node's caps, the image digest); `by_test_suite`
        # is the third-party diagnostic suites' aggregates. Neither is a rank
        # key, neither breaks a tie, and there is no efficiency track.
        "execution": _execution_payload(card),
        "by_test_suite": card.get("by_test_suite"),
        "tie_evidence": evidence,
    }


def _rank_set(entries: list[dict], metric_id: str, *, use_segments: bool,
              tie_test: str, n_resamples: int, alpha: float, seed: int,
              session: Optional[dict], identity: _Identity,
              node_verdicts: Optional[dict] = None,
              ) -> tuple[list[dict], list[dict], set[str]]:
    """Rank one comparable set. Returns (ranked, unscored, methods_used).

    "Comparable" is the whole point: callers pass ONE dataset, ONE track and
    one side of the primary/contrastive split, because those are exactly the
    boundaries across which a rank would be a false comparison.
    """
    spec = PRIMARY_METRICS[metric_id]
    unscored = []
    for e in entries:
        if _metric_value(e["card"], metric_id) is None:
            unscored.append({
                "run_card_id": e["run_card_id"],
                "model_slug": e["card"].get("model_slug"),
                "trust": e["card"].get("trust"),
                "submitter_label": identity.name(
                    e, e.get("submitter_label"), e.get("team")),
                "track": e.get("track") or DEFAULT_TRACK,
                "is_primary": bool(e.get("is_primary", True)),
                "dataset_id": e["card"].get("dataset_id"),
                "reason": f"no {spec['label']} ({spec['column']}) on the run card",
            })
    ordered = order_entries(entries, metric_id)

    # Segments: fetched once per card, only when the metric can use them.
    segments: dict[str, tuple[Optional[list[dict]], str]] = {}
    if use_segments and spec["segment_fn"] is not None and len(ordered) > 1:
        for e in ordered:
            segments[e["run_card_id"]] = fetch_segments(
                e["run_card_id"], e["card"].get("corpus_size"), session=session)

    evidences: list[Optional[dict]] = [None]
    methods_used: set[str] = set()
    for i in range(1, len(ordered)):
        upper, lower = ordered[i - 1], ordered[i]
        seg_u, note_u = segments.get(upper["run_card_id"], (None, ""))
        seg_l, note_l = segments.get(lower["run_card_id"], (None, ""))
        if use_segments and spec["segment_fn"] is not None:
            notes = []
            if seg_u is None:
                notes.append(f"upper: {note_u}")
            if seg_l is None:
                notes.append(f"lower: {note_l}")
            seg_note = "; ".join(notes)
        elif spec["segment_fn"] is None:
            seg_note = f"{spec['label']} has no per-segment recomputation"
        else:
            seg_note = "per-segment rows not consulted (--no-segments)"
        # Rung 1 for a SEALED set: the paired test the node ran over the
        # sealed references (contest_verdicts), verified and bound to this
        # contest's metric and frozen tie policy before it got here.
        ev = (contest_verdicts.evidence_for(node_verdicts, upper, lower, spec["label"])
              if node_verdicts else None)
        if ev is None:
            ev = pair_evidence(
                upper, lower, metric_id,
                segments_upper=seg_u, segments_lower=seg_l, segments_note=seg_note,
                tie_test=tie_test, n_resamples=n_resamples, alpha=alpha, seed=seed)
        ev["vs"] = upper["run_card_id"]
        evidences.append(ev)
        methods_used.add(ev["method"])

    groups = assign_tie_groups(ordered, evidences)
    ranges = rank_ranges(groups)
    ranked = [
        _entry_payload(e, metric_id, rank, group, ranges[i][0], ranges[i][1],
                       evidences[i], identity)
        for i, (e, (rank, group)) in enumerate(zip(ordered, groups))
    ]
    return ranked, unscored, methods_used


def _session_identity(session: Optional[dict]) -> str:
    if not session:
        return "anonymous"
    email = ((session.get("user") or {}).get("email") or "").strip()
    return email or "authenticated"


def _resolve_phase(requested: Optional[str], entries: list[dict]) -> dict:
    """Which phase this ranking covers, and why.

    A contest that never used phases (no entry carries one) ranks everything —
    inventing a phase filter for it would silently empty the board. As soon as
    ANY entry declares a phase, the ranked section is the ``evaluation`` phase
    by default: practice entries are exactly the ones a participant expected
    not to be judged on.
    """
    declared = sorted({e.get("phase") for e in entries if e.get("phase")})
    if requested in ("all", "ALL"):
        return {"ranked": None, "source": "--phase all", "declared": declared,
                "freezable": True,
                "note": "every phase is ranked together (--phase all)"}
    if requested:
        if requested not in PHASE_NAMES:
            raise RankingError(
                f"Unknown phase {requested!r}. Contest phases: "
                f"{', '.join(PHASE_NAMES)} (or 'all').")
        return {
            "ranked": requested, "source": "--phase", "declared": declared,
            "freezable": requested != "practice",
            "note": (f"ranking the {requested!r} phase"
                     + ("; a PRACTICE ranking is a rehearsal, never a final "
                        "result — `close` freezes the evaluation phase"
                        if requested == "practice" else "")),
        }
    if not declared:
        return {"ranked": None, "source": "unphased-contest", "declared": [],
                "freezable": True,
                "note": ("no entry declares a phase (this contest does not use "
                         "contest_phases) — every entry is ranked")}
    return {
        "ranked": DEFAULT_RANKED_PHASE, "source": "default", "declared": declared,
        "freezable": True,
        "note": (f"entries declare phases {declared} — the ranked section is "
                 f"the {DEFAULT_RANKED_PHASE!r} phase (--phase to choose "
                 f"another, --phase all for every phase)"),
    }


def _attrib(entry: dict, identity: _Identity) -> dict:
    """The safe attribution block for an entry that is not ranked."""
    return {
        "run_card_id": entry.get("run_card_id"),
        "submitter_label": identity.name(
            entry, entry.get("submitter_label"), entry.get("team")),
        "submitted_at": entry.get("submitted_at"),
        "team": identity.scrub(entry.get("team"), entry),
        "pathway": entry.get("pathway"),
        "authorization_request_id": entry.get("authorization_request_id"),
        "track": entry.get("track") or DEFAULT_TRACK,
        "phase": entry.get("phase"),
        "is_primary": bool(entry.get("is_primary", True)),
    }


def build_ranking(
    contest_id: str,
    *,
    metric: Optional[str] = None,
    include_unverified: bool = False,
    tie_test: Optional[str] = None,
    n_resamples: Optional[int] = None,
    alpha: Optional[float] = None,
    seed: Optional[int] = None,
    use_segments: bool = True,
    phase: Optional[str] = None,
    track: Optional[str] = None,
    reveal_identities: bool = False,
    session: Optional[dict] = None,
    contest: Optional[dict] = None,
    banner_stream=None,
    node_verdicts: Optional[str] = None,
    verify_key: Optional[str] = None,
) -> dict:
    """Build the ranking dict — the contract every consumer reads.

    ``session`` is optional and never prompted for. ``contest`` may be
    passed by a caller that already fetched it (``close_contest``).
    Banners (hidden cards, policy exclusions, withheld results) go to
    ``banner_stream`` (stderr by default) so ``--json`` stdout stays pure JSON.

    ``reveal_identities`` unmasks the anonymise-until-close policy. It is NOT
    permission-checked here — ``close_contest`` has already proved ownership
    when it calls with True, and the CLI calls ``check_reveal_permitted``
    before it gets this far. Email-shaped values are masked regardless.
    """
    stream = banner_stream if banner_stream is not None else sys.stderr

    contest = contest or fetch_contest(contest_id, session=session)
    policies = resolve_policies(contest)
    tie_policy = resolve_tie_policy(
        contest, tie_test=tie_test, alpha=alpha, n_resamples=n_resamples,
        seed=seed, policies=policies)
    prize_terms = resolve_prize_terms(contest, policies)
    metric_id, metric_source = resolve_metric(metric, contest)
    spec = PRIMARY_METRICS[metric_id]

    if track is not None and track not in TRACKS:
        raise RankingError(
            f"Unknown track {track!r}. Entry tracks: {', '.join(TRACKS)}.")

    anonymized = bool(policies["anonymize_until_close"]) and not reveal_identities
    identity = _Identity(contest.get("id") or contest_id, anonymized=anonymized)

    gathered = gather_entries(contest_id, session=session, contest=contest)
    cards = fetch_run_cards([e["run_card_id"] for e in gathered["entries"]],
                            session=session)
    deferred = fetch_deferred_results(contest_id, session=session)

    phase_policy = _resolve_phase(phase, gathered["entries"])

    by_phase: dict[str, int] = {}
    for e in gathered["entries"]:
        key = e.get("phase") or "(unset)"
        by_phase[key] = by_phase.get(key, 0) + 1

    excluded: list[dict] = []
    exclusions: list[dict] = []
    hidden_unverified = 0
    policy_excluded = 0

    def _drop(entry: dict, rule: str, reason: str, **extra) -> None:
        row = {**_attrib(entry, identity), "reason": reason, "rule": rule, **extra}
        excluded.append(row)
        exclusions.append({
            "entry": entry.get("run_card_id"),
            "rule": rule,
            "reason": reason,
        })

    # The computation promises. A card scored by another harness version, or
    # whose recorded signature for the promised metric differs, measured
    # something other than what entrants were promised: it is excluded with
    # both values named, never ranked against the promise. The signature is
    # only checked when this view ranks on the contest's own recorded metric.
    promised_harness = policies["harness_version"]
    promised_signature = policies["metric_signature"]
    recorded_metric = (contest.get("metadata") or {}).get("primary_metric")
    check_signature = bool(promised_signature) and recorded_metric is not None \
        and canonical_metric(str(recorded_metric)) == metric_id

    main_entries: list[dict] = []
    other: dict[str, list[dict]] = {}
    holdout_entries: list[dict] = []
    contest_set = contest.get("corpus_id")
    # Practice 7 — the contest's SECOND sealed split. A card scored on it is
    # a second result of an entry, not a second entry: it is reported, never
    # ranked, and it never enters a track, a phase partition or a tie test.
    holdout_set = (contest.get("metadata") or {}).get("sealed_holdout_set_id")
    allowed_tracks = policies["allowed_tracks"]

    for e in gathered["entries"]:
        card = cards.get(e["run_card_id"])
        if card is None:
            _drop(e, "card-missing",
                  "run card not found (deleted, or not visible to this session)")
            continue
        entry = {**e, "card": card}
        trust = card.get("trust")
        if trust == "disqualified":
            _drop(entry, "trust", "trust=disqualified",
                  model_slug=card.get("model_slug"), trust=trust)
            continue
        if trust != "verified" and not include_unverified:
            hidden_unverified += 1
            _drop(entry, "trust",
                  f"trust={trust} hidden by the verified-only policy "
                  f"(pass --include-unverified to rank it)",
                  model_slug=card.get("model_slug"), trust=trust)
            continue
        if holdout_set and card.get("dataset_id") == holdout_set:
            # Routed out BEFORE the ranking policies: allowed_tracks,
            # require_description, open_weight_only and the phase window all
            # decide who is RANKED, and nothing here is ranked. Filtering a
            # holdout card by a ranking rule would record it as "excluded"
            # when it was never in the running.
            holdout_entries.append(entry)
            continue
        entry_phase = entry.get("phase")
        if phase_policy["ranked"] and entry_phase != phase_policy["ranked"]:
            policy_excluded += 1
            _drop(entry, "phase",
                  f"phase={entry_phase or '(unset)'}; this ranking covers the "
                  f"{phase_policy['ranked']!r} phase",
                  model_slug=card.get("model_slug"))
            continue
        entry_track = entry.get("track") or DEFAULT_TRACK
        if entry_track not in allowed_tracks:
            policy_excluded += 1
            _drop(entry, "allowed_tracks",
                  f"track={entry_track!r} is not in this contest's "
                  f"metadata.allowed_tracks ({', '.join(allowed_tracks)})",
                  model_slug=card.get("model_slug"))
            continue
        if policies["open_weight_only"]:
            entry_constraints = entry.get("constraints") or {}
            weights_public = entry_constraints.get("weightsPublic")
            if weights_public is not True:
                policy_excluded += 1
                # A weightless entry (parameterCount 0) declares no weights
                # at all; say that rather than "weightsPublic=None".
                declared = ("declares no trained weights (parameterCount 0)"
                            if entry_constraints.get("parameterCount") == 0
                            and weights_public is None else
                            f"declares constraints.weightsPublic="
                            f"{weights_public!r}")
                _drop(entry, "open_weight_only",
                      f"metadata.open_weight_only is set and this entry "
                      f"{declared} — an entry that does not declare "
                      f"public weights is not ranked (fail-closed)",
                      model_slug=card.get("model_slug"))
                continue
        if policies["require_description"] and not (entry.get("description") or "").strip():
            policy_excluded += 1
            _drop(entry, "require_description",
                  "metadata.require_description is set and this entry carries "
                  "no system description (contest_submissions.description) — "
                  "an undescribed system cannot be read, replicated or "
                  "written up, so it is excluded, not silently ranked",
                  model_slug=card.get("model_slug"))
            continue
        if track is not None and entry_track != track:
            _drop(entry, "track-filter",
                  f"track={entry_track!r} filtered out of this VIEW by "
                  f"--track {track} (a display filter, not a contest policy)",
                  model_slug=card.get("model_slug"))
            continue
        if card.get("dataset_id") == contest_set:
            if promised_harness and card.get("harness_version") != promised_harness:
                policy_excluded += 1
                _drop(entry, "harness_version",
                      f"scored by harness {card.get('harness_version') or '(unrecorded)'}; "
                      f"the contest promised harness {promised_harness} "
                      f"(metadata.harness_version)",
                      model_slug=card.get("model_slug"))
                continue
            if check_signature:
                recorded = recorded_signature(card, metric_id)
                if recorded != promised_signature:
                    policy_excluded += 1
                    _drop(entry, "metric_signature",
                          f"{spec['label']} computed as {recorded or '(unrecorded)'}; "
                          f"the contest promised {promised_signature} "
                          f"(metadata.metric_signature)",
                          model_slug=card.get("model_slug"))
                    continue
            main_entries.append(entry)
        else:
            other.setdefault(card.get("dataset_id") or "(no dataset_id)", []).append(entry)

    if hidden_unverified and not include_unverified:
        print(
            f"\n  ⚠ {hidden_unverified} unverified run card(s) hidden — the ranking "
            f"is VERIFIED-ONLY (the public rules promise verified ranking). "
            f"Pass --include-unverified to rank self-reported cards; the choice "
            f"is recorded as trust_policy.",
            file=stream)
    if policy_excluded:
        print(
            f"\n  ⚠ {policy_excluded} entr{'y' if policy_excluded == 1 else 'ies'} "
            f"excluded by a contest POLICY (phase / allowed_tracks / "
            f"open_weight_only / require_description) — each one is listed with "
            f"its rule and reason under `exclusions`.",
            file=stream)
    for note in gathered["notes"]:
        print(f"\n  ⚠ {note}", file=stream)
    if deferred.get("count"):
        print(f"\n  ⚠ {deferred['count']} scored result(s) are being WITHHELD "
              f"until close (contest_deferred_results) — this ranking does not "
              f"include them; `mt-eval contest close` publishes them first.",
              file=stream)

    # Node verdicts (sealed contests): verified against the node's public key
    # and bound to THIS contest, metric and frozen tie policy, or refused.
    verdicts = None
    if node_verdicts:
        if not verify_key:
            raise RankingError(
                "--node-verdicts needs --verify-key: the node's score-sign "
                "PUBLIC key (the .pub.json from `mt-eval node keygen`); "
                "unverified verdicts are not evidence")
        try:
            verdicts = contest_verdicts.load_verified(
                node_verdicts, verify_key, contest=contest, metric_id=metric_id,
                tie_policy=tie_policy, promised_harness=policies["harness_version"])
        except contest_verdicts.VerdictsError as exc:
            raise RankingError(str(exc)) from exc

    rank_kwargs = dict(use_segments=use_segments, tie_test=tie_policy["tie_test"],
                       n_resamples=tie_policy["n_resamples"],
                       alpha=tie_policy["alpha"], seed=tie_policy["seed"],
                       session=session, identity=identity,
                       node_verdicts=verdicts)

    # ---- the ranked sections: per track, primary and contrastive apart -----
    tracks_present = [t for t in TRACKS
                      if any((e.get("track") or DEFAULT_TRACK) == t for e in main_entries)]
    ranked: list[dict] = []
    unscored: list[dict] = []
    contrastive: list[dict] = []
    contrastive_unscored: list[dict] = []
    methods_used: set[str] = set()
    by_track: dict[str, dict] = {}

    for t in tracks_present:
        in_track = [e for e in main_entries if (e.get("track") or DEFAULT_TRACK) == t]
        prim = [e for e in in_track if bool(e.get("is_primary", True))]
        contr = [e for e in in_track if not bool(e.get("is_primary", True))]
        r, u, m = _rank_set(prim, metric_id, **rank_kwargs)
        methods_used |= m
        ranked.extend(r)
        unscored.extend(u)
        cr_, cu_, cm_ = _rank_set(contr, metric_id, **rank_kwargs)
        methods_used |= cm_
        contrastive.extend(cr_)
        contrastive_unscored.extend(cu_)
        by_track[t] = {
            "entries": len(in_track),
            "primary_ranked": len(r),
            "primary_unscored": len(u),
            "contrastive_ranked": len(cr_),
            "run_card_ids": [e["run_card_id"] for e in r],
            "note": (f"the {t} track is ranked on its own: a constrained "
                     f"system is never ranked against an unconstrained one, "
                     f"so ranks, tie groups and rank ranges are within-track"),
        }

    # ---- the holdout split: reported, never ranked (practice 7) ----------
    # The same payload shape as a ranked entry — a consumer reads one shape —
    # with every rank field explicitly None. Ordered by submission time, not
    # by score: an ordering by metric IS a ranking, whatever the key is
    # called. Holdout results are ALWAYS withheld until close (contract C5,
    # force_defer), so on an open contest this list is normally empty and the
    # withheld count under `deferred_results` is where they show.
    holdout_payloads = []
    for e in sorted(holdout_entries, key=lambda x: (x.get("submitted_at") or "",
                                                    x["run_card_id"])):
        payload = _entry_payload(e, metric_id, 0, 0, 0, 0, None, identity)
        payload.update({"rank": None, "rank_min": None, "rank_max": None,
                        "tie_group": None})
        holdout_payloads.append(payload)
    holdout_section = None
    if holdout_set:
        holdout_section = {
            "set_id": holdout_set,
            "entries": holdout_payloads,
            "count": len(holdout_payloads),
            "note": (f"the contest's second sealed split ({holdout_set}) is "
                     f"scored inside the same authorized run as "
                     f"{contest_set!r} and REPORTED, never ranked: no rank, "
                     f"no tie test, no track partition, no prize eligibility. "
                     f"Every holdout result is withheld until the contest "
                     f"closes, so an open contest shows none of them here — "
                     f"see `deferred_results`."),
        }

    other_sets = []
    for dataset_id, entries in sorted(other.items()):
        r, u, m = _rank_set(entries, metric_id, **rank_kwargs)
        methods_used |= m
        other_sets.append({
            "dataset_id": dataset_id,
            "note": (f"ranked separately: the contest ranks {contest_set!r}; these "
                     f"cards were scored on {dataset_id!r} and are not comparable "
                     f"with the main ranking"),
            "entries": r,
            "unscored": u,
        })

    # ---- prize eligibility, under the contest's DECLARED terms -------------
    # The out-of-platform record the organizer keeps for the steps this
    # platform cannot measure itself (a public release, an assignment).
    execution_table = (contest.get("metadata") or {}).get(
        contest_prize_terms.EXECUTION_KEY)
    execution_table = execution_table if isinstance(execution_table, dict) else {}
    prize_eligibility = {}
    for e in ranked:
        prize_eligibility[e["run_card_id"]] = _prize_eligibility(
            e, prize_terms, execution_table)
        e["prize_eligible"] = prize_eligibility[e["run_card_id"]]["eligible"]
    for e in contrastive:
        # A contrastive entry never wins, so it is never prize-eligible —
        # stated, not left to be inferred from its absence.
        e["prize_eligible"] = False

    tie_label = ("approximate randomization (Riezler & Maxwell 2005)"
                 if tie_policy["tie_test"] == "ar" else "paired bootstrap (Koehn 2004)")
    note = (
        f"Competition ranking (1, 1, 3) WITHIN each track: entries are ordered "
        f"by {metric_label(metric_id)} then "
        f"{', '.join(tiebreak_order(metric_id)[1:])}; "
        f"each ADJACENT pair is tested and a non-significant pair shares the "
        f"upper entry's rank (ties chain through adjacent pairs), and every "
        f"entry carries the rank_min/rank_max range of its tie group. "
        f"Only is_primary entries compete for rank; contrastive entries are "
        f"ranked in their own section and never win. Evidence ladder per pair: "
        f"(1) per-segment {tie_label} over run_card_entries when both cards "
        f"carry a complete, aligned set — only redistribution-cleared corpora "
        f"ever do; (2) "
        + (f"95% bootstrap-CI overlap on the run-card {metric_label(metric_id)} "
           f"CI columns (a conservative proxy, not a paired test); "
           if spec["ci_columns"] else
           f"not available — {metric_label(metric_id)} has no CI columns; ")
        + f"(3) point equality at {spec['rounding']} decimals. For a SEALED "
        f"set, rung (1) is the same paired test run on the organizer node "
        f"over the sealed references and exported as signed verdicts only "
        f"(contest_verdicts; no segment leaves the node) — "
        + (f"used here, from node {verdicts['node_id']}. "
           if verdicts else
           "not supplied here, so a sealed set ties on CI overlap or point "
           "equality. ")
        + "runtime_seconds is reported, never ranked; an efficiency track "
        "does not exist yet."
    )

    pending = gathered["pending"]
    rejected = gathered["rejected"]

    return {
        "contest": {
            "id": contest.get("id"),
            "name": contest.get("name"),
            "status": contest.get("status"),
            "corpus_id": contest_set,
            "sealed_set_ids": contest_sealed_set_ids(contest),
            "language_pair": contest.get("language_pair"),
            "lane": contest.get("lane"),
            "visibility": contest.get("visibility"),
            "intake_open": contest.get("intake_open"),
            "created_by": contest.get("created_by"),
            "shared_task_id": contest.get("shared_task_id"),
        },
        "metric": metric_id,
        "metric_label": metric_label(metric_id),
        # Why this metric is retired for new contests (the composite), or
        # None. A legacy contest that promised it still ranks on it.
        "metric_retired": spec.get("retired"),
        "metric_column": spec["column"],
        "metric_scale": spec["scale"],
        "metric_source": metric_source,
        "tiebreak_order": tiebreak_order(metric_id),
        "trust_policy": (TRUST_INCLUDE_UNVERIFIED if include_unverified
                         else TRUST_VERIFIED_ONLY),
        "hidden_unverified": hidden_unverified,
        "policies": policies,
        "tie_policy": tie_policy,
        "prize_terms": prize_terms,
        "prize_eligibility": prize_eligibility,
        "identity_policy": {
            "anonymized": anonymized,
            "source": ("contest.metadata.anonymize_until_close" if anonymized else
                       ("reveal-identities" if reveal_identities and
                        policies["anonymize_until_close"] else
                        policies["sources"]["anonymize_until_close"])),
            "masked_emails": identity.masked_emails,
            "note": ("every entry is shown as a deterministic pseudonym "
                     "(entry-<6 hex of sha256(contest_id + request id)) — the "
                     "contest promised anonymity until close"
                     if anonymized else
                     "identities are shown as the entry's declared "
                     "submitter_label; an email-shaped value is ALWAYS "
                     "replaced by the pseudonym (a login is not a byline)"),
        },
        "phase": phase_policy,
        "by_phase": by_phase,
        "by_track": by_track,
        "deferred_results": deferred,
        # Contract C7: the key exists and is None so a consumer can tell
        # "there is no efficiency track" from "this build is too old to
        # know". It stays None until a track is actually designed — runtime
        # measured on the organizer's node is not a fair comparison across
        # methods, and shipping a fast column that quietly sorts would be an
        # unearned claim.
        "efficiency_track": None,
        "ranking_method": {
            "tie_test": tie_policy["tie_test"],
            "n_resamples": tie_policy["n_resamples"],
            "alpha": tie_policy["alpha"],
            "seed": tie_policy["seed"],
            "policy_source": tie_policy["source"],
            "segments_consulted": bool(use_segments and spec["segment_fn"] is not None),
            "evidence_used": sorted(methods_used),
            "node_verdicts": ({"node_id": verdicts["node_id"],
                               "pairs": len(verdicts["pairs"])}
                              if verdicts else None),
            "note": note,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_by": _session_identity(session),
        "harness_version": HARNESS_VERSION,
        "provisional": contest.get("status") == "open",
        "frozen": False,
        "entries": ranked,
        "unscored": unscored,
        "contrastive": contrastive,
        "contrastive_unscored": contrastive_unscored,
        "excluded": excluded,
        "exclusions": exclusions,
        # Practice 7 — None when the contest declares no holdout split (it
        # promised nothing), a section when it does. Never merged into
        # `other_sets`: an unrelated stray card and the split the organizer
        # PROMISED to score are different facts.
        "holdout": holdout_section,
        "other_sets": other_sets,
        "pending": pending,
        # Entries the node ran and failed (no score; grant spent), and 075
        # 'completed' requests with no linked submission — never "in flight".
        "failed": gathered.get("failed") or [],
        "completed": gathered.get("completed") or [],
        "rejected": rejected,
        # Retained names: `close_contest` refuses while work is in flight by
        # reading `pending_intake`, and the frozen snapshots already published
        # carry both. Same lists, not copies of different things.
        "pending_intake": pending,
        "rejected_intake": rejected,
        "notes": gathered["notes"],
    }


def _handover_problem(entry: dict) -> Optional[str]:
    """Why the host cannot show it holds the artifact it scored, or None.

    The one step the platform MEASURES: the entry's authorization request
    carries a ``method_sha`` (the digest of the artifact handed to the node)
    and reached the authorized state that produced the published card.
    ``method_release_url`` is never consulted — a public link is not the host
    holding the artifact.
    """
    request_id = entry.get("authorization_request_id")
    if not request_id:
        return ("no authorization_request_id on the entry: the host cannot "
                "show it holds the artifact it scored for this card")
    if not entry.get("method_sha"):
        return (f"authorization request {request_id} carries no method_sha — "
                f"the host holds no artifact digest for this entry")
    # 'completed' (migration 075) is reachable ONLY from 'authorized', once the
    # node's result for that authorized run is recorded — so it is the
    # strongest evidence of handover there is, not a lesser state. Before 075
    # an executed request stayed 'authorized' forever; after it, a relayed one
    # moves on, and a gate that demanded 'authorized' refused every entry the
    # node had actually run (caught by the 2026-09-28 Lima rehearsal).
    if entry.get("request_state") not in ("authorized", _REQUEST_COMPLETED):
        return (f"authorization request {request_id} is in state "
                f"{entry.get('request_state')!r}, not 'authorized' or "
                f"'completed' — only a method the custodians authorized and "
                f"the node executed counts as handed over")
    return None


def _prize_eligibility(entry: dict, prize_terms: dict,
                       execution_table: Optional[dict] = None) -> dict:
    """Is this ranked entry eligible under the contest's DECLARED terms?

    Returns ``{eligible, reason, gate}`` where ``gate`` answers each step in
    ``contest_prize_terms.GATE_STEPS``: ``True`` / ``False`` when the declared
    terms require that step, and ``None`` when they do not (so "not required"
    is never mistaken for "failed", and vice versa).

    ``execution_table`` is ``contests.metadata.prize_terms_execution`` — the
    organizer's record of the facts that happen OUTSIDE this platform (a public
    release, an assignment instrument). Presence and shape are verified; the
    URLs are never fetched and no instrument is judged.
    """
    steps = list(prize_terms.get("gate") or [])
    gate: dict = {s: None for s in contest_prize_terms.GATE_STEPS}

    if not prize_terms.get("declared"):
        return {"eligible": False,
                "reason": ("no prize terms declared on this contest — there is "
                           "no prize, so there is no eligibility to compute"),
                "gate": gate}

    record = contest_prize_terms.execution_record(
        {contest_prize_terms.EXECUTION_KEY: execution_table or {}},
        [entry.get("run_card_id"), entry.get("authorization_request_id")])

    failures: list[str] = []
    passes: list[str] = []

    if "handover_verified" in steps:
        problem = _handover_problem(entry)
        gate["handover_verified"] = problem is None
        if problem:
            failures.append(f"handover_verified: {problem}")
        else:
            passes.append(
                f"handover_verified (request "
                f"{entry.get('authorization_request_id')} holds method_sha "
                f"{str(entry.get('method_sha'))[:16]}…)")

    if "release_verified" in steps:
        problem = contest_prize_terms.release_record_problem(record)
        gate["release_verified"] = problem is None
        if problem:
            failures.append(f"release_verified: {problem}")
        else:
            passes.append(f"release_verified ({record.get('release_url')})")

    if "assignment_recorded" in steps:
        problem = contest_prize_terms.assignment_record_problem(record)
        gate["assignment_recorded"] = problem is None
        if problem:
            failures.append(f"assignment_recorded: {problem}")
        else:
            passes.append(
                f"assignment_recorded "
                f"({record.get('assignment_instrument_url')}, recorded "
                f"{record.get('assignment_recorded_at')}) — presence only; the "
                f"platform never verifies law")

    if failures:
        return {"eligible": False,
                "reason": ("the declared prize terms are not satisfied for "
                           "this entry — " + "; ".join(failures)),
                "gate": gate}
    return {"eligible": True,
            "reason": ("every verification the declared prize terms require is "
                       "satisfied: " + "; ".join(passes)),
            "gate": gate}


class HandoverGate(NamedTuple):
    """The prize gate's verdict: a ``(ok, reasons)`` pair.

    It is a plain 2-tuple — ``ok, reasons = handover_gate_ok(ranking)`` — and
    it additionally answers ``.get("ok")`` / ``.get("reason")`` because
    ``contest.close_contest`` reads it that way. One verdict, two spellings, no
    second implementation.

    The name is kept from the single-switch era (``close_contest`` and its
    tests call it) but the verdict is now terms-driven: the steps checked are
    whichever ones the contest's declared ``prize_terms`` require.
    """

    ok: bool
    reasons: list[str]

    @property
    def reason(self) -> str:
        return " ".join(self.reasons) if self.reasons else ""

    def get(self, key: str, default=None):
        if key == "ok":
            return self.ok
        if key == "reasons":
            return self.reasons
        if key == "reason":
            return self.reason
        return default


def winning_entries(ranking: dict) -> list[dict]:
    """The entries that would WIN — the top rank of each track's primary set.

    A tie at the top means several winners, and every one of them is a winner:
    the gate is about entries a prize could actually be paid to. Contrastive
    entries never win and are never here.
    """
    best: dict[str, int] = {}
    for entry in ranking.get("entries") or []:
        rank = entry.get("rank")
        if not isinstance(rank, int):
            continue
        track = entry.get("track") or DEFAULT_TRACK
        if track not in best or rank < best[track]:
            best[track] = rank
    return [e for e in (ranking.get("entries") or [])
            if isinstance(e.get("rank"), int)
            and e["rank"] == best.get(e.get("track") or DEFAULT_TRACK)]


def handover_gate_ok(ranking: dict) -> HandoverGate:
    """May this ranking be FROZEN under the contest's DECLARED prize terms?

    ``close_contest`` calls this before it writes ``metadata.final_ranking``.
    Returns ``(ok, reasons)``; ``reasons`` is empty when ok.

    The gate bites only on a contest that DECLARED prize terms, and it asks
    exactly the verifications those terms require (``prize_gate``) of the
    entries that would win — the top rank of each track, whole tie group
    included. A non-winning entry that failed a step is reported in
    ``prize_eligibility`` but never blocks a close: a contest is not held open
    because a mid-table entrant did not publish.

    An undeclared-terms contest has no prize and therefore no gate — which is
    NOT the same as a gate that passed, and the reasons say which it was.
    """
    terms = ranking.get("prize_terms") or {}
    if not terms.get("declared"):
        return HandoverGate(True, [])
    steps = list(terms.get("gate") or [])
    if not steps:
        return HandoverGate(True, [])
    reasons: list[str] = []
    eligibility = ranking.get("prize_eligibility") or {}
    for entry in winning_entries(ranking):
        verdict = eligibility.get(entry.get("run_card_id")) or {}
        if not verdict.get("eligible"):
            reasons.append(
                f"{entry.get('submitter_label') or entry.get('run_card_id')} "
                f"(rank {entry.get('rank')}, track "
                f"{entry.get('track') or DEFAULT_TRACK}, card "
                f"{entry.get('run_card_id')}): "
                f"{verdict.get('reason') or 'no verification recorded'}")
    if reasons:
        reasons.insert(0, (
            f"This contest declared prize terms "
            f"(sha256 {str(terms.get('terms_sha256'))[:16]}…) requiring "
            f"{', '.join(steps)}. These entries would win their track but do "
            f"not satisfy them:"))
    return HandoverGate(not reasons, reasons)


# ---------------------------------------------------------------------------
# Rendering — table + CSV
# ---------------------------------------------------------------------------

def _fmt(v: Optional[float], nd: int) -> str:
    if v is None:
        return "—"
    return f"{v:.{nd}f}"


def _rank_cell(e: dict) -> str:
    lo, hi = e.get("rank_min"), e.get("rank_max")
    if lo is not None and hi is not None and hi != lo:
        return f"{lo}-{hi}"
    return str(e.get("rank"))


def _entry_rows(lines: list[str], entries: list[dict], nd: int, label: str,
                metric_id: str = DEFAULT_PRIMARY_METRIC) -> None:
    """One table row per entry: the primary metric with its CI, then the
    standard metrics beside it (chrF++, BLEU, TER, COMET — minus the
    primary). No composite column and no tier: a legacy composite contest
    shows its composite only as the primary, under its legacy label."""
    beside = [(m, h, d) for m, h, d in _BESIDE_COLUMNS if m != metric_id]
    width = max(14, len(label))
    hdr = (f"  {'#':>5s} {'grp':>3s} {'System':<28s} {'Track':<13s} "
           f"{'Trust':<11s} {label:>{width}s} {'CI':<22s} "
           + "".join(f"{h:>8s} " for _m, h, _d in beside)
           + f"{'Runtime':>9s} {'Prize':<6s} "
           f"{'Entry':<14s} Tie evidence")
    lines.append(hdr)
    lines.append("  " + "-" * (len(hdr) - 3))
    for e in entries:
        p = e.get("primary") or {}
        ci = ""
        if p.get("ci_lower") is not None and p.get("ci_upper") is not None:
            ci = f"[{float(p['ci_lower']):.{nd}f}, {float(p['ci_upper']):.{nd}f}]"
        s = e.get("scores") or {}
        ev = e.get("tie_evidence") or {}
        ev_txt = ""
        if ev:
            ev_txt = (f"{'TIE' if ev.get('tied') else 'sep'} · {ev.get('method')}"
                      f" · {ev.get('reason')}")
        runtime_s = (e.get("execution") or {}).get("runtime_seconds")
        prize = e.get("prize_eligible")
        prize_txt = "—" if prize is None else ("yes" if prize else "no")
        lines.append(
            f"  {_rank_cell(e):>5s} {e.get('tie_group'):>3} "
            f"{str(e.get('model_slug'))[:28]:<28s} "
            f"{str(e.get('track') or '')[:13]:<13s} "
            f"{str(e.get('trust'))[:11]:<11s} "
            f"{_fmt(p.get('value'), nd):>{width}s} {ci:<22s} "
            + "".join(f"{_fmt(s.get(m), d):>8s} " for m, _h, d in beside)
            + f"{(_fmt(runtime_s, 1) + 's' if runtime_s is not None else '—'):>9s} "
            f"{prize_txt:<6s} "
            f"{str(e.get('submitter_label') or '-')[:14]:<14s} {ev_txt}")


def format_ranking_table(ranking: dict) -> str:
    """Human-readable rendering of a ranking dict (never raises on shape)."""
    metric_id = ranking.get("metric") or ""
    if metric_id not in PRIMARY_METRICS:
        metric_id = DEFAULT_PRIMARY_METRIC
    spec = PRIMARY_METRICS[metric_id]
    nd = spec["rounding"]
    label = metric_label(metric_id)
    c = ranking.get("contest") or {}
    lines: list[str] = []
    state = "FROZEN" if ranking.get("frozen") else (
        "PROVISIONAL" if ranking.get("provisional") else "final")
    lines.append(f"\n  Contest {c.get('id')} — {c.get('name') or ''}")
    lines.append(f"  Set {c.get('corpus_id')} · {c.get('language_pair')} · "
                 f"lane {c.get('lane')} · status {c.get('status')} · "
                 f"intake {'open' if c.get('intake_open') else 'closed'}")
    lines.append(f"  Primary metric: {ranking.get('metric_label') or label} "
                 f"[{ranking.get('metric')}] (source: {ranking.get('metric_source')}) · "
                 f"tiebreaks: {' → '.join(ranking.get('tiebreak_order') or [])}")
    if ranking.get("metric_retired"):
        # A legacy contest ranked on what it promised — said, every time.
        from mt_eval_harness.scoring import RETIRED_NOTE
        lines.append(f"  ⚠ This contest promised a metric that is now "
                     f"retired: {ranking['metric_retired']} {RETIRED_NOTE}")
    rm = ranking.get("ranking_method") or {}
    tp = ranking.get("tie_policy") or {}
    lines.append(f"  Trust policy: {ranking.get('trust_policy')} · "
                 f"tie test: {rm.get('tie_test')} (n={rm.get('n_resamples')}, "
                 f"α={rm.get('alpha')}, seed={rm.get('seed')}) · "
                 f"policy source: "
                 f"{', '.join(f'{k}={v}' for k, v in sorted((tp.get('source') or {}).items())) or 'default'}")
    ident = ranking.get("identity_policy") or {}
    lines.append(f"  Identities: "
                 f"{'ANONYMISED (pseudonyms)' if ident.get('anonymized') else 'shown'} "
                 f"· source {ident.get('source')}"
                 + (f" · {ident.get('masked_emails')} email-shaped value(s) masked"
                    if ident.get("masked_emails") else ""))
    ph = ranking.get("phase") or {}
    if ph:
        lines.append(f"  Phase: {ph.get('ranked') or 'all'} ({ph.get('source')}) · "
                     f"counts {ranking.get('by_phase') or {}}"
                     + ("" if ph.get("freezable", True) else
                        " · NOT a final result (practice phase)"))
    pt = ranking.get("prize_terms") or {}
    if pt.get("declared"):
        terms = pt.get("terms") or {}
        disposition = terms.get("disposition")
        if disposition:
            lines.append(
                f"  Prize terms: {disposition} — "
                f"{contest_prize_terms.DISPOSITION_HEADLINES[disposition]}")
            lines.append("    in detail: " + " · ".join(
                f"{k}={terms[k]}" for k in contest_prize_terms.DIMENSIONS
                if k in terms and k != "disposition"))
        else:
            lines.append("  Prize terms: " + " · ".join(
                f"{k}={terms[k]}" for k in contest_prize_terms.DIMENSIONS
                if k in terms))
        lines.append(f"    sha256 {pt.get('terms_sha256')} · payout "
                     f"verifications: {', '.join(pt.get('gate') or []) or 'none'}")
        if pt.get("describe"):
            lines.append(f"    {pt['describe']}")
    else:
        lines.append(f"  Prize terms: none declared — NO PRIZE "
                     f"({pt.get('source', 'harness-default')})")
    dr = ranking.get("deferred_results") or {}
    if dr and (dr.get("count") or dr.get("count") is None):
        lines.append(f"  Withheld until close: {dr.get('count')} — {dr.get('note')}")
    lines.append(f"  Ranking state: {state} · generated {ranking.get('generated_at')} "
                 f"by {ranking.get('generated_by')} · harness {ranking.get('harness_version')}")

    entries = ranking.get("entries") or []
    if not entries:
        lines.append("\n  (no rankable entries)")
    else:
        by_track = {}
        for e in entries:
            by_track.setdefault(e.get("track") or DEFAULT_TRACK, []).append(e)
        for tname, rows in by_track.items():
            lines.append(f"\n  Track: {tname} ({len(rows)} primary entr"
                         f"{'y' if len(rows) == 1 else 'ies'}) — ranked within "
                         f"the track only")
            _entry_rows(lines, rows, nd, label, metric_id)

    contrastive = ranking.get("contrastive") or []
    if contrastive:
        lines.append(f"\n  Contrastive entries ({len(contrastive)}) — ranked in "
                     f"their own section; a contrastive entry never wins and "
                     f"never shares a tie group with a primary entry")
        _entry_rows(lines, contrastive, nd, label, metric_id)

    def _section(title: str, rows: list[dict], fmt) -> None:
        if not rows:
            return
        lines.append(f"\n  {title} ({len(rows)}):")
        for r in rows:
            lines.append("    • " + fmt(r))

    _section("Unscored (no primary metric on the card)", ranking.get("unscored") or [],
             lambda r: f"{r.get('model_slug') or r.get('run_card_id')} — {r.get('reason')}")
    _section("Excluded", ranking.get("excluded") or [],
             lambda r: f"[{r.get('rule')}] "
                       f"{r.get('model_slug') or r.get('run_card_id')} — {r.get('reason')}")
    holdout = ranking.get("holdout")
    if holdout:
        # Reported, never ranked — so the rank column is not printed at all
        # here. A blank where a rank would be is still a rank-shaped hole.
        lines.append(f"\n  Holdout split {holdout.get('set_id')} "
                     f"({holdout.get('count', 0)} result(s)) — "
                     f"{holdout.get('note')}")
        for e in holdout.get("entries") or []:
            p = e.get("primary") or {}
            lines.append(f"    • {str(e.get('model_slug'))[:34]:<34s} "
                         f"{_fmt(p.get('value'), nd):>10s}  "
                         f"trust={e.get('trust')}")
    for os_ in ranking.get("other_sets") or []:
        lines.append(f"\n  Other set {os_.get('dataset_id')} — {os_.get('note')}")
        for e in os_.get("entries") or []:
            p = e.get("primary") or {}
            lines.append(f"    {_rank_cell(e):>5s} {str(e.get('model_slug'))[:34]:<34s} "
                         f"{_fmt(p.get('value'), nd):>10s}  trust={e.get('trust')}")
        for u in os_.get("unscored") or []:
            lines.append(f"    unscored: {u.get('model_slug') or u.get('run_card_id')} — {u.get('reason')}")
    _section("In flight (authorized/pending, no published card — not ranked)",
             ranking.get("pending") or [],
             lambda r: f"{r.get('authorization_request_id')} [{r.get('state')}] — {r.get('reason')}")
    _section("Failed entries (the node ran them; no score — not ranked)",
             ranking.get("failed") or [],
             lambda r: f"{r.get('authorization_request_id')} [failed] — {r.get('reason')}")
    _section("Recorded, not linked to a submission (075 'completed')",
             ranking.get("completed") or [],
             lambda r: f"{r.get('authorization_request_id')} [completed] — {r.get('reason')}")
    _section("Refused entries (denied / expired requests)",
             ranking.get("rejected") or [],
             lambda r: f"{r.get('authorization_request_id')} [{r.get('state')}] — {r.get('reason')}")
    _section("Notes", [{"n": n} for n in (ranking.get("notes") or [])],
             lambda r: r["n"])
    power = (ranking.get("policies") or {}).get("declared_power")
    if power:
        mde = power.get("minimum_detectable_effect")
        lines.append(
            f"\n  Declared power: n={power.get('n_segments')} segments, minimum "
            f"detectable effect "
            + (f"{mde} {power.get('metric')} at {power.get('target_power', 0.8):.0%} power"
               if mde is not None else f"not stated — {power.get('note')}"))
    lines.append(f"\n  Method: {rm.get('note')}")
    return "\n".join(lines) + "\n"


CSV_COLUMNS: tuple[str, ...] = (
    "set", "dataset_id", "rank", "tie_group", "run_card_id", "model_slug",
    "rank_min", "rank_max", "is_primary", "track", "phase",
    "condition", "trust", "submitter_label_or_pseudonym", "submitter", "team",
    "submitted_at", "pathway", "authorization_request_id",
    "primary_metric", "primary_value", "primary_ci_lower", "primary_ci_upper",
    "chrf_plus_plus", "bleu", "ter", "comet_score",
    # The stored composite of a card published before scoring standard/1
    # (null on every standard card) — retired, never a score of record.
    "legacy_composite",
    # Reported, never ranked (contract C7) — after every score, so no reader
    # mistakes its position for precedence.
    "runtime_seconds",
    "prize_eligible",
    "tie_method", "tie_tied", "tie_reason", "tie_p_value", "tie_vs",
)


def ranking_to_csv_rows(ranking: dict) -> list[list]:
    """Flat rows (header first) — main set, contrastive section, other sets.

    There is no ``submitted_by`` column: that field is the participant's login
    email (migration 052 binds it), and a CSV of a frozen ranking is a
    published artifact. ``submitter_label_or_pseudonym`` is the byline.
    """
    rows: list[list] = [list(CSV_COLUMNS)]

    def _row(set_label: str, e: dict) -> list:
        p = e.get("primary") or {}
        s = e.get("scores") or {}
        ev = e.get("tie_evidence") or {}
        return [
            set_label, e.get("dataset_id"), e.get("rank"), e.get("tie_group"),
            e.get("run_card_id"), e.get("model_slug"),
            e.get("rank_min"), e.get("rank_max"), e.get("is_primary"),
            e.get("track"), e.get("phase"),
            e.get("condition"), e.get("trust"), e.get("submitter_label"),
            e.get("submitter"), e.get("team"), e.get("submitted_at"),
            e.get("pathway"), e.get("authorization_request_id"),
            p.get("metric"), p.get("value"), p.get("ci_lower"), p.get("ci_upper"),
            s.get("chrf_plus_plus"), s.get("bleu"), s.get("ter"),
            s.get("comet_score"), s.get("composite"),
            (e.get("execution") or {}).get("runtime_seconds"),
            e.get("prize_eligible"),
            ev.get("method"), ev.get("tied"), ev.get("reason"),
            ev.get("p_value"), ev.get("vs"),
        ]

    for e in ranking.get("entries") or []:
        rows.append(_row("main", e))
    for e in ranking.get("contrastive") or []:
        rows.append(_row("contrastive", e))
    for os_ in ranking.get("other_sets") or []:
        for e in os_.get("entries") or []:
            rows.append(_row("other", e))
    return rows


# ---------------------------------------------------------------------------
# Export — the frozen snapshot when closed, a labelled provisional otherwise
# ---------------------------------------------------------------------------

def export_contest(
    contest_id: str,
    *,
    session: Optional[dict] = None,
    contest: Optional[dict] = None,
    include_unverified: bool = False,
    metric: Optional[str] = None,
    use_segments: bool = True,
    phase: Optional[str] = None,
    track: Optional[str] = None,
    reveal_identities: bool = False,
) -> dict:
    """The ranking to publish for a contest.

    * closed / archived with ``metadata.final_ranking`` → that snapshot,
      verbatim, ``frozen=True`` (the result of record; never recomputed);
    * open → a live ``build_ranking`` labelled ``provisional=True``;
    * closed WITHOUT a snapshot → refused: migration 072/074 makes this
      impossible on a guarded database, so such a row predates the guard
      or was hand-edited — say so instead of inventing a result.
    """
    contest = contest or fetch_contest(contest_id, session=session)
    status = contest.get("status")
    metadata = contest.get("metadata") or {}
    exported_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if status in ("closed", "archived"):
        snapshot = metadata.get("final_ranking")
        if not isinstance(snapshot, dict) or not snapshot:
            raise RankingError(
                f"Contest '{contest_id}' is {status} but carries no frozen "
                f"metadata.final_ranking — on a database with migration 072 "
                f"a close cannot happen without one, so this row predates the "
                f"guard or was edited by hand. Nothing is exported: a result "
                f"of record must come from the close, not be recomputed now. "
                f"(Run `mt-eval contest rank {contest_id}` for a live, "
                f"provisional view.)")
        if include_unverified or metric or phase or track:
            raise RankingError(
                f"Contest '{contest_id}' is {status}: the frozen snapshot is "
                f"exported verbatim (metric "
                f"{snapshot.get('metric')!r}, trust policy "
                f"{snapshot.get('trust_policy')!r}); --metric / "
                f"--include-unverified / --phase / --track only apply to an "
                f"open contest.")
        out = dict(snapshot)
        out["frozen"] = True
        out["provisional"] = False
        out["export_source"] = "contests.metadata.final_ranking"
        out["closed_at"] = metadata.get("closed_at")
        out["closed_by"] = metadata.get("closed_by")
        out["exported_at"] = exported_at
        return out
    ranking = build_ranking(
        contest_id, metric=metric, include_unverified=include_unverified,
        use_segments=use_segments, phase=phase, track=track,
        reveal_identities=reveal_identities, session=session, contest=contest)
    ranking["frozen"] = False
    ranking["provisional"] = True
    ranking["export_source"] = "live (contest still open — provisional)"
    ranking["exported_at"] = exported_at
    return ranking
