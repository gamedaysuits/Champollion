"""
Server-side score verifier — the un-fakeable floor for the leaderboard.

THE PROBLEM. Every leaderboard row is submitted by a contributor who runs the
open-source harness on their own machine and self-reports the scores. The DB
range-checks them (migration 023) and binds them to a sha-pinned corpus
(verify_corpus_integrity + the sha-parity trigger), but nothing re-derives the
numbers. A determined, authenticated contributor can hand-craft an internally
consistent report with inflated metrics and publish it at trust='unverified'.

THE FIX (this module). Re-score the run SERVER-SIDE against the CANONICAL,
sha-pinned corpus — not the submitter's own stored references. verify_against_corpus
loads the registered corpus by dataset_id (datasets.sha256 is curator-owned and
trigger-enforced — migration 026), maps each entry to its REAL reference by source
text, then (a) flags any stored `expected` altered from the gold (tampering) and
(b) re-scores `predicted` against the real reference with the same metric the
harness uses (sacrebleu chrF++). A run is promoted to trust='verified' — the only
tier the leaderboard ranks / awards — ONLY when it reproduces against the
registered corpus with zero tampered references. A run that cannot be anchored
(corpus unfetchable) stays unverified rather than trusting submitter data.

WHAT THIS CATCHES: editing the reported scores (recompute won't match) AND
fabricating the reference side (stored `expected` won't match the registered
corpus). For a sealed / held-out test set whose references aren't public, it also
stops fabricated outputs outright — there is nothing to copy.

WHAT THIS DOES NOT CATCH (documented honestly): for a PUBLIC corpus, a
contributor who copies the real reference verbatim as their "translation" scores
high. Catching that needs re-RUNNING the model server-side (sandboxed execution)
— the "gold/reproduced" tier, reserved for top/prize entries because it costs
real API spend. See `docs/VERIFICATION.md` (to author) for the verification ladder.

(recompute_corpus_chrf / build_verdict remain as the weaker self-rescore — a
diagnostic that still flags hand-edited scores when the corpus can't be loaded.)

USAGE (maintainer / CI, needs the service_role key — never shipped to clients):
    MT_EVAL_SUPABASE_SERVICE_KEY=... python -m mt_eval_harness.verifier --all-unverified
    MT_EVAL_SUPABASE_SERVICE_KEY=... python -m mt_eval_harness.verifier --card-id <uuid>

The pure core (recompute_corpus_chrf / build_verdict) has no network or DB
dependency and is unit-tested in arena/tests/test_verifier.py.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# Tolerances. chrF++ is a 0–100 score; sacrebleu is deterministic, so a faithful
# re-score should match to within rounding. We allow a small band for harness
# version differences in tokenization/normalization.
CHRF_TOLERANCE = 1.0          # absolute chrF++ points
COMET_TOLERANCE = 0.02        # COMET is 0–1; deterministic given model+inputs,
                              # small band for unbabel-comet version drift
MORPH_TOLERANCE = 0.02        # morphological_accuracy is 0–1; deterministic given
                              # the card-pinned FST + canonical refs, small band
                              # for FST release / pyhfst version drift
MIN_ENTRIES_TO_VERIFY = 1     # never "verify" a vacuous run

# Corpus-anchored verification with PARTIAL matching (2026-07-19): when some
# of a run's entries can't be matched to the sha-pinned corpus by source, the
# full-corpus headline is not directly comparable to a subset re-score (the
# 2026-07-19 dry-run showed exactly this: 20 honest runs flagged MISMATCH
# because their reported score included errored/unmatched entries the subset
# re-score excluded). The comparison then goes subset-vs-subset — but only
# while the anchorable subset is most of the run. Beyond this unmatched
# fraction the run simply cannot be verified (a cherry-picked matchable
# subset must never buy promotion).
VERIFY_MAX_UNMATCHED_FRACTION = 0.2


@dataclass
class Verdict:
    card_id: str
    ok: bool                       # True => promote to 'verified'
    reason: str
    reported_chrf: float | None = None
    recomputed_chrf: float | None = None
    n_entries: int = 0
    details: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "card_id": self.card_id,
            "ok": self.ok,
            "reason": self.reason,
            "reported_chrf": self.reported_chrf,
            "recomputed_chrf": self.recomputed_chrf,
            "n_entries": self.n_entries,
            **({"details": self.details} if self.details else {}),
        }


# ---------------------------------------------------------------------------
# Pure core — no network, no DB. Unit-tested.
# ---------------------------------------------------------------------------

def recompute_corpus_chrf(entries: list[dict]) -> tuple[float | None, int]:
    """Recompute corpus chrF++ from stored per-entry outputs.

    Mirrors the harness scorer (tester.py: ``CHRF(word_order=2)`` == chrF++).
    Each entry must carry the model output (``predicted``) and the reference
    (``expected``). Entries with no reference are skipped (can't be scored);
    a missing/empty prediction scores as an empty hypothesis (correctly bad),
    which is exactly how the original run treated an errored entry.

    Returns (corpus_chrf_or_None, n_scored). None when there is nothing to
    score (so the caller can refuse to "verify" a vacuous run).
    """
    from sacrebleu.metrics import CHRF

    hyps: list[str] = []
    refs: list[str] = []
    for e in entries:
        expected = e.get("expected")
        if expected is None or str(expected).strip() == "":
            continue  # no reference -> not scoreable
        predicted = e.get("predicted")
        if predicted is None:
            predicted = e.get("raw_predicted") or ""
        hyps.append(str(predicted))
        refs.append(str(expected))

    if not hyps:
        return None, 0

    chrf = CHRF(word_order=2)  # chrF++
    score = chrf.corpus_score(hyps, [refs]).score  # 0..100
    return float(score), len(hyps)


def build_verdict(
    card_id: str,
    reported_chrf: float | None,
    entries: list[dict],
    *,
    chrf_tolerance: float = CHRF_TOLERANCE,
) -> Verdict:
    """Compare the contributor's claimed chrF++ to a server-side re-score.

    The decision is intentionally conservative: anything we cannot confirm
    stays UNverified (ok=False). We only return ok=True when we recomputed a
    real score from real outputs and it matches the claim within tolerance.
    """
    recomputed, n = recompute_corpus_chrf(entries)

    if n < MIN_ENTRIES_TO_VERIFY or recomputed is None:
        return Verdict(card_id, False, "no scoreable entries (cannot verify)",
                       reported_chrf, recomputed, n)

    if reported_chrf is None:
        return Verdict(card_id, False, "run reports no chrF++ to verify against",
                       reported_chrf, recomputed, n)

    delta = abs(recomputed - reported_chrf)
    if delta <= chrf_tolerance:
        return Verdict(card_id, True,
                       f"re-scored chrF++ {recomputed:.2f} matches reported "
                       f"{reported_chrf:.2f} (Δ{delta:.2f} ≤ {chrf_tolerance})",
                       reported_chrf, recomputed, n)
    return Verdict(card_id, False,
                   f"MISMATCH: re-scored chrF++ {recomputed:.2f} vs reported "
                   f"{reported_chrf:.2f} (Δ{delta:.2f} > {chrf_tolerance}) — "
                   f"the claimed score is not reproducible from the submitted "
                   f"outputs",
                   reported_chrf, recomputed, n, {"delta": delta})


# ---------------------------------------------------------------------------
# COMET re-derivation. comet_score is a NEURAL metric reported SEPARATELY — it is
# NOT in the (deterministic) composite. We still re-derive any reported comet_score
# server-side so the neural lane is trust-checked too (we never trust a
# self-reported neural-adequacy metric), but it does NOT gate the deterministic
# composite's verified status. The scorer is INJECTED so this pure core stays free
# of torch / the 2.3GB model and is unit-testable.
# ---------------------------------------------------------------------------

def recompute_corpus_comet(
    entries: list[dict],
    reference_index: dict[str, str],
    *,
    comet_scorer,
) -> tuple[float | None, int]:
    """Re-derive corpus COMET against the CANONICAL sha-pinned references.

    Builds (source, predicted, canonical-reference) triples from the anchored
    entries and scores them with ``comet_scorer`` — an injected callable
    ``(list[{source,expected,predicted}]) -> float | None``. Injection keeps this
    core free of the COMET model so it is unit-testable; the DB driver passes a
    metrics_comet-backed scorer, or None when unbabel-comet is not installed in
    the verifier environment.

    Returns (corpus_comet_or_None, n_anchored). None when nothing anchors or the
    scorer is absent / itself returned None.
    """
    data: list[dict] = []
    for e in entries:
        canonical = reference_index.get(_norm(e.get("source")))
        if canonical is None:
            continue
        predicted = e.get("predicted")
        if predicted is None:
            predicted = e.get("raw_predicted") or ""
        data.append({
            "source": str(e.get("source") or ""),
            "predicted": str(predicted),
            "expected": str(canonical),
        })
    if not data or comet_scorer is None:
        return None, len(data)
    return comet_scorer(data), len(data)


def comet_reproduces(
    reported_comet: float | None,
    recomputed_comet: float | None,
    *,
    tol: float = COMET_TOLERANCE,
) -> tuple[bool, str]:
    """Whether a server-re-derived COMET matches the contributor's claim.

    Conservative: anything we cannot reproduce is a FAIL — we never grant
    'verified' to a COMET score we could not reproduce server-side.
    """
    if recomputed_comet is None:
        return False, (
            "comet_score reported but could NOT be re-derived server-side "
            "(unbabel-comet unavailable in the verifier env, or no anchored "
            "entries) — refusing to verify a COMET score we cannot reproduce"
        )
    if reported_comet is None:
        return False, "run reports no comet_score to verify against"
    delta = abs(recomputed_comet - reported_comet)
    if delta <= tol:
        return True, (
            f"re-scored COMET {recomputed_comet:.4f} matches reported "
            f"{reported_comet:.4f} (Δ{delta:.4f} ≤ {tol})"
        )
    return False, (
        f"MISMATCH: re-scored COMET {recomputed_comet:.4f} vs reported "
        f"{reported_comet:.4f} (Δ{delta:.4f} > {tol}) — not reproducible"
    )


# ---------------------------------------------------------------------------
# Reference-free QE re-derivation. qe_score is a NEURAL metric reported SEPARATELY —
# NOT in the (deterministic) composite. We still re-derive a reported qe_score
# server-side so the neural lane is trust-checked too; it does NOT gate the
# deterministic composite's verified status. QE needs only SOURCE + MT — no
# reference — so this is even simpler than COMET. Scorer is INJECTED.
# ---------------------------------------------------------------------------

def recompute_corpus_qe(entries: list[dict], *, qe_scorer) -> tuple[float | None, int]:
    """Re-derive reference-free corpus QE (SOURCE + MT only — no reference).

    ``qe_scorer`` is an injected callable ``(list[{source,predicted}]) -> float|None``
    so this pure core stays free of the model/torch and is unit-testable; the DB
    driver passes a metrics_comet-backed scorer, or None when unavailable.

    Returns (corpus_qe_or_None, n_scored).
    """
    data: list[dict] = []
    for e in entries:
        src = e.get("source")
        if src is None or str(src).strip() == "":
            continue
        predicted = e.get("predicted")
        if predicted is None:
            predicted = e.get("raw_predicted") or ""
        data.append({"source": str(src), "predicted": str(predicted)})
    if not data or qe_scorer is None:
        return None, len(data)
    return qe_scorer(data), len(data)


def qe_reproduces(
    reported_qe: float | None,
    recomputed_qe: float | None,
    *,
    tol: float = COMET_TOLERANCE,
) -> tuple[bool, str]:
    """Whether a server-re-derived QE matches the contributor's claim.

    Conservative: anything we cannot reproduce is a FAIL — we never grant
    'verified' to a QE score we could not reproduce server-side.
    """
    if recomputed_qe is None:
        return False, (
            "qe_score reported but could NOT be re-derived server-side (unbabel-comet "
            "or the QE model is unavailable, or no scoreable entries) — refusing to "
            "verify a QE score we cannot reproduce"
        )
    if reported_qe is None:
        return False, "run reports no qe_score to verify against"
    delta = abs(recomputed_qe - reported_qe)
    if delta <= tol:
        return True, (
            f"re-scored QE {recomputed_qe:.4f} matches reported {reported_qe:.4f} "
            f"(Δ{delta:.4f} ≤ {tol})"
        )
    return False, (
        f"MISMATCH: re-scored QE {recomputed_qe:.4f} vs reported {reported_qe:.4f} "
        f"(Δ{delta:.4f} > {tol}) — not reproducible"
    )


# ---------------------------------------------------------------------------
# FST morphological_accuracy re-derivation (P5). When morphological_accuracy is
# active in the composite (a card-driven FST language, coverage ≥ floor), a run
# that reports it must reproduce it server-side — the SAME deterministic, card-
# pinned FST, re-run against the CANONICAL references. We never trust a self-
# reported morphology score. The scorer is INJECTED (a callable that runs the FST
# metric) so this pure core stays free of pyhfst and is unit-testable.
# ---------------------------------------------------------------------------

def recompute_corpus_morph(
    entries: list[dict],
    reference_index: dict[str, str],
    *,
    morph_scorer,
) -> tuple[float | None, float | None, int]:
    """Re-derive corpus morphological_accuracy against the CANONICAL references.

    Builds (predicted, canonical-reference) pairs from the anchored entries and
    scores them with ``morph_scorer`` — an injected callable
    ``(list[{predicted,expected}]) -> (morph_accuracy|None, morph_coverage|None)``.
    Injection keeps this core free of the FST / pyhfst so it is unit-testable; the
    DB driver passes a GiellaLTFSTMetric-backed scorer, or None when the FST is
    unavailable in the verifier environment.

    Returns (morph_accuracy_or_None, morph_coverage_or_None, n_anchored). The
    accuracy is None when nothing anchors, the scorer is absent, or no predicted
    word lemma-matched the reference (out of coverage).
    """
    data: list[dict] = []
    for e in entries:
        canonical = reference_index.get(_norm(e.get("source")))
        if canonical is None:
            continue
        predicted = e.get("predicted")
        if predicted is None:
            predicted = e.get("raw_predicted") or ""
        data.append({"predicted": str(predicted), "expected": str(canonical)})
    if not data or morph_scorer is None:
        return None, None, len(data)
    acc, cov = morph_scorer(data)
    return acc, cov, len(data)


def morph_reproduces(
    reported_morph: float | None,
    recomputed_morph: float | None,
    recomputed_cov: float | None,
    *,
    floor: float,
    tol: float = MORPH_TOLERANCE,
) -> tuple[bool, str]:
    """Whether a server-re-derived morphological_accuracy matches the claim.

    Conservative: anything we cannot reproduce is a FAIL. We also re-confirm that
    the re-derived COVERAGE is at/above the floor — morphological_accuracy is only
    allowed in the composite when coverage ≥ floor, so a run whose coverage does
    NOT reproduce above the floor should not have scored it (we refuse to verify a
    composite that leaned on a sub-floor morph value).
    """
    if recomputed_morph is None:
        return False, (
            "morphological_accuracy reported but could NOT be re-derived server-side "
            "(the card-pinned FST is unavailable in the verifier env, or no anchored "
            "entries / no lemma-matched words) — refusing to verify a morph score we "
            "cannot reproduce"
        )
    if recomputed_cov is None or recomputed_cov < floor:
        return False, (
            f"re-derived morph coverage "
            f"{('%.2f' % recomputed_cov) if recomputed_cov is not None else 'None'} "
            f"is below the floor {floor} — morphological_accuracy should not have "
            f"entered the composite for this run"
        )
    if reported_morph is None:
        return False, "run reports no morphological_accuracy to verify against"
    delta = abs(recomputed_morph - reported_morph)
    if delta <= tol:
        return True, (
            f"re-scored morphological_accuracy {recomputed_morph:.4f} matches "
            f"reported {reported_morph:.4f} (Δ{delta:.4f} ≤ {tol}; coverage "
            f"{recomputed_cov:.2f})"
        )
    return False, (
        f"MISMATCH: re-scored morphological_accuracy {recomputed_morph:.4f} vs "
        f"reported {reported_morph:.4f} (Δ{delta:.4f} > {tol}) — not reproducible"
    )


# ---------------------------------------------------------------------------
# Corpus-anchored verification — the STRONGER check (red-team R1, fix A).
#
# recompute_corpus_chrf above re-scores predicted vs the submitter's STORED
# expected — but both are submitter-controlled, so a contributor who stores
# predicted==expected gets chrF++ 100. The functions below instead score
# predicted against the CANONICAL reference loaded from the sha-pinned corpus
# (datasets.sha256 is curator-owned and trigger-enforced, migration 026), and
# flag any entry whose stored `expected` differs from the canonical gold
# (tampering). A run is only "verified" when it reproduces against the REAL
# registered corpus. (The residual hole — copying a PUBLIC reference verbatim
# as the "translation" — still needs sandboxed model re-execution, the
# "gold/reproduced" tier; documented, not claimed closed here.)
# ---------------------------------------------------------------------------

def _norm(s: object) -> str:
    """Whitespace-normalize for source matching / reference tamper comparison."""
    return " ".join(str(s).split()) if s is not None else ""


def build_reference_index(canonical_entries: list[dict]) -> dict[str, str]:
    """Map normalized source text -> canonical reference from a loaded corpus.

    Sources that appear with conflicting references are dropped (can't be
    disambiguated by source text alone, so they're not anchorable).
    """
    idx: dict[str, str] = {}
    ambiguous: set[str] = set()
    for e in canonical_entries:
        src = _norm(e.get("source"))
        ref = e.get("reference")
        if not src or ref is None:
            continue
        ref = str(ref)
        if src in idx and idx[src] != ref:
            ambiguous.add(src)
        else:
            idx[src] = ref
    for s in ambiguous:
        idx.pop(s, None)
    return idx


def verify_against_corpus(
    card_id: str,
    reported_chrf: float | None,
    entries: list[dict],
    reference_index: dict[str, str],
    *,
    chrf_tolerance: float = CHRF_TOLERANCE,
) -> Verdict:
    """Score `predicted` against the CANONICAL sha-pinned reference and tamper-
    check the stored `expected`. Promotes only a run that reproduces against the
    real corpus with zero tampered references.

    Comparison basis (2026-07-19 subset fix): with every entry matched, the
    re-score is compared to the run's reported headline chrF++ directly. When
    some entries cannot be matched by source, the headline covers a different
    entry set than the re-score and the two are NOT comparable — the check
    then goes subset-vs-subset: the SAME matched hypotheses scored against the
    canonical references vs against the run's own stored references. The
    tamper gate has already required stored ≡ canonical up to whitespace, so a
    delta beyond tolerance means the scores genuinely don't reproduce —
    never a set-difference artifact. Runs with more than
    ``VERIFY_MAX_UNMATCHED_FRACTION`` unmatched cannot be verified at all
    (a cherry-picked matchable subset must never buy promotion), and the
    verdict always reports the unmatched count and which basis was compared.
    """
    from sacrebleu.metrics import CHRF

    hyps: list[str] = []
    refs: list[str] = []
    stored_refs: list[str | None] = []
    n_tampered = 0
    n_unmatched = 0
    for e in entries:
        canonical = reference_index.get(_norm(e.get("source")))
        if canonical is None:
            n_unmatched += 1
            continue
        stored = e.get("expected")
        has_stored = stored is not None and str(stored).strip() != ""
        if has_stored and _norm(stored) != _norm(canonical):
            n_tampered += 1
        predicted = e.get("predicted")
        if predicted is None:
            predicted = e.get("raw_predicted") or ""
        hyps.append(str(predicted))
        refs.append(canonical)
        stored_refs.append(str(stored) if has_stored else None)

    details = {"n_tampered": n_tampered, "n_unmatched": n_unmatched, "anchored": True}

    if not hyps:
        return Verdict(card_id, False,
                       "no entries matched the sha-pinned corpus by source "
                       "(cannot anchor to the registered corpus)",
                       reported_chrf, None, 0, details)

    recomputed = float(CHRF(word_order=2).corpus_score(hyps, [refs]).score)

    if n_tampered > 0:
        return Verdict(card_id, False,
                       f"TAMPERED: {n_tampered} stored reference(s) differ from the "
                       f"registered corpus — the submitted gold answers were altered",
                       reported_chrf, recomputed, len(hyps), details)

    if reported_chrf is None:
        return Verdict(card_id, False, "run reports no chrF++ to verify against",
                       reported_chrf, recomputed, len(hyps), details)

    if n_unmatched == 0:
        # Every entry anchored: the headline claim is directly checkable.
        details["comparison_basis"] = "reported-headline"
        delta = abs(recomputed - reported_chrf)
        if delta <= chrf_tolerance:
            return Verdict(card_id, True,
                           f"re-scored chrF++ {recomputed:.2f} against the registered "
                           f"corpus matches reported {reported_chrf:.2f} "
                           f"(Δ{delta:.2f} ≤ {chrf_tolerance}; 0 unmatched)",
                           reported_chrf, recomputed, len(hyps), details)
        return Verdict(card_id, False,
                       f"MISMATCH vs canonical corpus: re-scored chrF++ {recomputed:.2f} "
                       f"vs reported {reported_chrf:.2f} (Δ{delta:.2f} > {chrf_tolerance}) — "
                       f"not reproducible against the real references",
                       reported_chrf, recomputed, len(hyps), {**details, "delta": delta})

    # Partial anchoring: the headline covers entries the re-score excludes, so
    # the two numbers are not comparable. Verify subset-vs-subset instead.
    unmatched_fraction = n_unmatched / (n_unmatched + len(hyps))
    details["comparison_basis"] = "matched-subset"
    details["unmatched_fraction"] = round(unmatched_fraction, 4)
    if unmatched_fraction > VERIFY_MAX_UNMATCHED_FRACTION:
        return Verdict(card_id, False,
                       f"insufficient anchoring: {n_unmatched} of "
                       f"{n_unmatched + len(hyps)} entries did not match the "
                       f"sha-pinned corpus "
                       f"({unmatched_fraction:.0%} > {VERIFY_MAX_UNMATCHED_FRACTION:.0%}) "
                       f"— cannot verify",
                       reported_chrf, recomputed, len(hyps), details)

    # Baseline: the SAME hypotheses scored against the run's own stored
    # references, over the pairs that have one (empty stored refs carry no
    # baseline and are excluded from BOTH sides of this comparison).
    common = [(h, r, s) for h, r, s in zip(hyps, refs, stored_refs) if s is not None]
    details["n_subset_compared"] = len(common)
    if len(common) < MIN_ENTRIES_TO_VERIFY:
        return Verdict(card_id, False,
                       f"no subset baseline: matched entries carry no stored "
                       f"references to compare against ({n_unmatched} unmatched)",
                       reported_chrf, recomputed, len(hyps), details)
    sub_canonical = float(CHRF(word_order=2).corpus_score(
        [h for h, _r, _s in common], [[r for _h, r, _s in common]]).score)
    sub_baseline = float(CHRF(word_order=2).corpus_score(
        [h for h, _r, _s in common], [[s for _h, _r, s in common]]).score)
    details["subset_baseline"] = round(sub_baseline, 4)
    delta = abs(sub_canonical - sub_baseline)
    if delta <= chrf_tolerance:
        return Verdict(card_id, True,
                       f"re-scored chrF++ {sub_canonical:.2f} on the "
                       f"{len(common)}-entry anchored subset reproduces the run's "
                       f"own subset baseline {sub_baseline:.2f} "
                       f"(Δ{delta:.2f} ≤ {chrf_tolerance}; {n_unmatched} unmatched "
                       f"excluded from both sides; headline "
                       f"{reported_chrf:.2f} covers a different entry set)",
                       reported_chrf, recomputed, len(hyps), details)
    return Verdict(card_id, False,
                   f"MISMATCH on the anchored subset: re-scored chrF++ "
                   f"{sub_canonical:.2f} vs the run's own subset baseline "
                   f"{sub_baseline:.2f} (Δ{delta:.2f} > {chrf_tolerance}) — "
                   f"not reproducible even on identical entries",
                   reported_chrf, recomputed, len(hyps), {**details, "delta": delta})


def load_canonical_references(dataset_id: str | None, *, assume_yes: bool = True) -> dict[str, str] | None:
    """Fetch the sha-pinned corpus for ``dataset_id`` and return source->reference.

    Resolves the dataset in the registry, builds/fetches it (sha-verified by
    corpus_fetch), and loads it through the same loader the harness scores with.
    Returns None when the dataset is unregistered or the corpus cannot be built
    or fetched — in which case the caller leaves the run unverified (it cannot be
    anchored to the registered corpus, so it must not rank).
    """
    if not dataset_id:
        return None
    try:
        from mt_eval_harness import config as _cfg
        from mt_eval_harness.config import RunConfig
        from mt_eval_harness.corpus_loader import load_corpus
        from mt_eval_harness import corpus_fetch

        registry = _cfg.load_registry()
        entry = next(
            (d for d in registry.get("datasets", []) if d.get("id") == dataset_id),
            None,
        )
        if entry is None or "source_export" not in entry:
            return None
        built = corpus_fetch.fetch_corpus_from_registry_entry(entry, assume_yes=assume_yes)
        canonical_entries, _ = load_corpus(RunConfig(corpus_path=str(built)))
        return build_reference_index(canonical_entries)
    except Exception as exc:  # network / build / parse failure → not anchorable
        logger.warning("Could not load canonical refs for %s: %s", dataset_id, exc)
        return None


# ---------------------------------------------------------------------------
# DB driver — service_role only. Not unit-tested (needs the secret + network).
# ---------------------------------------------------------------------------

def _supabase_cfg() -> tuple[str, str]:
    url = os.environ.get("MT_EVAL_SUPABASE_URL",
                         "https://sjdomynysdljkbemupqa.supabase.co")
    key = os.environ.get("MT_EVAL_SUPABASE_SERVICE_KEY")
    if not key:
        print("error: MT_EVAL_SUPABASE_SERVICE_KEY is required (service_role "
              "key — maintainer only; never commit or ship it).",
              file=sys.stderr)
        raise SystemExit(2)
    return url.rstrip("/"), key


def _get(url: str, key: str, path: str) -> list[dict]:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def _patch_trust(url: str, key: str, card_id: str, trust: str) -> None:
    body = json.dumps({"trust": trust}).encode()
    req = urllib.request.Request(
        f"{url}/rest/v1/run_cards?id=eq.{card_id}",
        data=body,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()


def _post(url: str, key: str, path: str, rows: list[dict], *,
          prefer: str = "return=minimal") -> None:
    """POST one or more rows to a PostgREST table (insert or upsert).

    `prefer` carries the upsert directive when needed
    (``resolution=merge-duplicates,return=minimal``). No-op on an empty list.
    """
    if not rows:
        return
    body = json.dumps(rows).encode()
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        data=body,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()


def _make_comet_scorer(target_lang: str):
    """Build a COMET scorer for the verifier using the CARD-resolved model.

    Returns None when unbabel-comet is unavailable in this environment — in which
    case a COMET-reporting run cannot be granted 'verified' (we refuse to pass a
    neural-adequacy score we cannot reproduce, rather than silently verifying on
    chrF++ alone).
    """
    from mt_eval_harness import metrics_comet as _mc
    if not _mc.HAS_COMET:
        return None
    model_name = _mc.resolve_comet_model(target_lang=target_lang)

    def _score(data: list[dict]) -> float | None:
        result = _mc.compute_comet(data, target_lang=target_lang, model_name=model_name)
        return result.corpus_score if result is not None else None

    return _score


def _make_qe_scorer(target_lang: str):
    """Build a reference-free QE scorer using the CARD-resolved QE model.

    Returns None when unbabel-comet / a QE model is unavailable — in which case a
    QE-reporting run cannot be granted 'verified' (we refuse to pass a score we
    cannot reproduce).
    """
    from mt_eval_harness import metrics_comet as _mc
    if not _mc.HAS_COMET:
        return None
    model_name = _mc.resolve_qe_model(target_lang=target_lang)
    if not model_name:
        return None

    def _score(data: list[dict]) -> float | None:
        result = _mc.compute_qe(data, target_lang=target_lang, model_name=model_name)
        return result.corpus_score if result is not None else None

    return _score


def _make_morph_scorer(target_code: str):
    """Build an FST morphological_accuracy scorer for the verifier.

    Resolves + auto-downloads the CARD-pinned GiellaLT FST for ``target_code``
    (fst_installer.ensure_fst_available — non-interactive consent in CI) and wraps
    GiellaLTFSTMetric. Returns None when the FST is unavailable in this environment
    (no card FST info, download declined/failed, or pyhfst missing) — in which case
    a morph-reporting run cannot be granted 'verified' (we refuse to pass a score we
    cannot reproduce), exactly like the COMET/QE fail-closed rule.

    The returned callable maps ``list[{predicted,expected}]`` →
    ``(morph_accuracy|None, morph_coverage|None)`` by running the same compute()/
    aggregate() the harness used.
    """
    from mt_eval_harness import language_cards
    from mt_eval_harness.plugins import fst_installer
    from mt_eval_harness.plugins.giellalt_fst import GiellaLTFSTMetric

    lang_name = language_cards.get_name(target_code) or target_code
    try:
        fst_dir = fst_installer.ensure_fst_available(target_code, lang_name)
    except Exception as exc:  # download / extraction failure → not reproducible
        logger.warning("Could not ensure FST for %s in verifier: %s", target_code, exc)
        return None
    if fst_dir is None:
        return None

    metric = GiellaLTFSTMetric(lang_code=target_code, fst_dir=fst_dir)

    def _score(data: list[dict]) -> tuple[float | None, float | None]:
        results = [metric.compute(d) for d in data]
        agg = metric.aggregate(results)
        return agg.get("morphological_accuracy"), agg.get("morph_coverage")

    return _score


def verify_card(url: str, key: str, card: dict, *, apply: bool) -> Verdict:
    """Re-score a card against the sha-pinned corpus and (optionally) set trust.

    Promotion to 'verified' requires anchoring to the REAL registered corpus
    (verify_against_corpus scores predicted vs the canonical references and
    rejects any tampered stored `expected`). If the corpus can't be loaded the
    run stays unverified — but a self-inconsistent score (the easy forgery:
    predicted vs the submitter's OWN stored expected) is still flagged.
    """
    card_id = card["id"]
    entries = _get(url, key,
                   f"run_card_entries?run_card_id=eq.{card_id}"
                   f"&select=source,expected,predicted,raw_predicted&limit=100000")
    reported = card.get("chrf_plus_plus")

    refs = load_canonical_references(card.get("dataset_id"))
    if refs:
        verdict = verify_against_corpus(card_id, reported, entries, refs)
    else:
        # Not anchorable to the registered corpus → cannot grant 'verified'.
        # Still run the weaker self-rescore to catch a hand-edited score.
        self_v = build_verdict(card_id, reported, entries)
        if self_v.ok:
            verdict = Verdict(card_id, False,
                              "self-consistent but NOT corpus-anchored "
                              "(registered corpus unavailable) — left unverified",
                              reported, self_v.recomputed_chrf, self_v.n_entries,
                              {"anchored": False})
        else:
            verdict = self_v  # MISMATCH / unscoreable carry through

    # COMET re-derivation: comet_score is a NEURAL metric reported SEPARATELY (not
    # in the deterministic composite). We still re-derive a reported comet_score
    # server-side — the neural lane is trust-checked too — but it does NOT gate the
    # deterministic composite's verified status. We never trust a self-reported
    # neural metric. If we cannot re-derive it (no COMET in the verifier env), the
    # run is left unverified with a loud reason — NOT downgraded to a fabrication
    # (we simply could not reproduce it).
    reported_comet = card.get("comet_score")
    if reported_comet is not None and verdict.ok:
        target_lang = (card.get("language_pair") or ">").split(">")[-1].strip()
        scorer = _make_comet_scorer(target_lang)
        recomputed_comet, _n_c = recompute_corpus_comet(
            entries, refs or {}, comet_scorer=scorer
        )
        ok_c, reason_c = comet_reproduces(reported_comet, recomputed_comet)
        if not ok_c:
            verdict = Verdict(
                card_id, False, f"chrF++ ok but COMET check failed: {reason_c}",
                verdict.reported_chrf, verdict.recomputed_chrf, verdict.n_entries,
                {**(verdict.details or {}), "reported_comet": reported_comet,
                 "recomputed_comet": recomputed_comet, "comet_reason": reason_c},
            )

    # Reference-free QE re-derivation: a reported qe_score is a NEURAL metric
    # reported SEPARATELY (not in the deterministic composite); we still re-derive
    # it server-side (the neural lane is trust-checked too — from source + MT, no
    # reference). It does NOT gate the deterministic composite's verified status.
    # Same fail-closed rule as COMET.
    reported_qe = card.get("qe_score")
    if reported_qe is not None and verdict.ok:
        target_lang = (card.get("language_pair") or ">").split(">")[-1].strip()
        qe_scorer = _make_qe_scorer(target_lang)
        recomputed_qe, _n_q = recompute_corpus_qe(entries, qe_scorer=qe_scorer)
        ok_q, reason_q = qe_reproduces(reported_qe, recomputed_qe)
        if not ok_q:
            verdict = Verdict(
                card_id, False, f"chrF++ ok but QE check failed: {reason_q}",
                verdict.reported_chrf, verdict.recomputed_chrf, verdict.n_entries,
                {**(verdict.details or {}), "reported_qe": reported_qe,
                 "recomputed_qe": recomputed_qe, "qe_reason": reason_q},
            )

    # FST morphological_accuracy re-derivation (P5): enforce ONLY when morph
    # actually entered the composite — i.e. it is ACTIVE in scoring (not in
    # INACTIVE_METRICS) AND the reported coverage was at/above the floor. While
    # morph is advisory (still in INACTIVE_METRICS, or coverage < floor), faking it
    # cannot move the score, so we do NOT fail-close a run just because the FST is
    # absent from the verifier env. Once activated, a morph score that fed the
    # composite must reproduce against the same card-pinned FST + canonical refs.
    from mt_eval_harness.scoring import morph_counts
    from mt_eval_harness.plugins.giellalt_fst import MORPH_COVERAGE_FLOOR as _FLOOR
    reported_morph = card.get("morphological_accuracy")
    reported_cov = card.get("morph_coverage")
    morph_in_composite = morph_counts(reported_morph, reported_cov, floor=_FLOOR)
    if morph_in_composite and verdict.ok:
        target_code = (card.get("language_pair") or ">").split(">")[-1].strip()
        morph_scorer = _make_morph_scorer(target_code)
        recomputed_morph, recomputed_cov, _n_m = recompute_corpus_morph(
            entries, refs or {}, morph_scorer=morph_scorer
        )
        ok_m, reason_m = morph_reproduces(
            reported_morph, recomputed_morph, recomputed_cov, floor=_FLOOR
        )
        if not ok_m:
            verdict = Verdict(
                card_id, False, f"chrF++ ok but morphology check failed: {reason_m}",
                verdict.reported_chrf, verdict.recomputed_chrf, verdict.n_entries,
                {**(verdict.details or {}), "reported_morph": reported_morph,
                 "recomputed_morph": recomputed_morph, "morph_reason": reason_m},
            )

    if apply:
        # Promote only a corpus-anchored pass. Flag a proven fabrication
        # (self-rescore MISMATCH) or a TAMPERED reference as disqualified.
        if verdict.ok:
            _patch_trust(url, key, card_id, "verified")
        elif "MISMATCH" in verdict.reason or "TAMPERED" in verdict.reason:
            _patch_trust(url, key, card_id, "disqualified")
    return verdict


# ===========================================================================
# Reputation-weighted auditing DB driver (B3) — service_role only.
#
# The pure math (sampling policy, reputation transitions, corroboration) lives in
# reputation.py and is unit-tested. This driver reads/writes the contributors +
# contributor_audit_log tables (migration 061) and the board, executing the pure
# planner's RunPlan. It is OPT-IN (the --reputation flag): with the flag off, the
# verifier behaves exactly as before (L0-only), so the Part-2 board seed is
# unaffected. Every write path is best-effort/non-fatal — reputation bookkeeping
# must never break the L0 verification the served board depends on.
# ===========================================================================

from mt_eval_harness import reputation as _rep  # noqa: E402


def _contributor_id_for(card: dict) -> str | None:
    """Stable identity for a run's contributor: 'uid:<owner_uid>' when the run
    is owner-bound, else None (anonymous — no persistent reputation, migration
    050). The TEXT prefix leaves room for a future 'key:<fp>' pseudonym scheme."""
    owner = card.get("owner_uid")
    if owner is None or str(owner).strip() == "":
        return None
    return f"uid:{owner}"


def _get_contributor(url: str, key: str, contributor_id: str) -> "_rep.ReputationState":
    """Fetch a contributor's reputation ledger row, or a fresh provisional state
    when they have none yet."""
    rows = _get(url, key,
                f"contributors?contributor_id=eq."
                f"{urllib.parse.quote(contributor_id, safe='')}"
                f"&select=contributor_id,reputation,status,clean_audits,"
                f"total_audits,corroborations,caught_fraud_count,verified_runs")
    if not rows:
        return _rep.ReputationState.new(contributor_id)
    r = rows[0]
    return _rep.ReputationState(
        contributor_id=r["contributor_id"],
        reputation=int(r.get("reputation") or 0),
        status=r.get("status") or "provisional",
        clean_audits=int(r.get("clean_audits") or 0),
        total_audits=int(r.get("total_audits") or 0),
        corroborations=int(r.get("corroborations") or 0),
        caught_fraud_count=int(r.get("caught_fraud_count") or 0),
        verified_runs=int(r.get("verified_runs") or 0),
    )


def _upsert_contributor(url: str, key: str, state: "_rep.ReputationState") -> None:
    """Write a contributor's new reputation state (insert or update). first_seen_at
    is omitted so an update preserves it; updated_at is stamped now."""
    if state.contributor_id is None:
        return  # anonymous — no persistent identity to store
    row = {
        "contributor_id": state.contributor_id,
        "reputation": state.reputation,
        "status": state.status,
        "clean_audits": state.clean_audits,
        "total_audits": state.total_audits,
        "corroborations": state.corroborations,
        "caught_fraud_count": state.caught_fraud_count,
        "verified_runs": state.verified_runs,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _post(url, key, "contributors?on_conflict=contributor_id", [row],
          prefer="resolution=merge-duplicates,return=minimal")


def _log_audit(url: str, key: str, records: list) -> None:
    """Append audit records to contributor_audit_log (best-effort)."""
    rows = [r.as_row() if hasattr(r, "as_row") else r for r in records]
    _post(url, key, "contributor_audit_log", rows)


def _prior_verified_best(url: str, key: str, language_pair: str | None,
                         exclude_card_id: str) -> float | None:
    """The pair's highest VERIFIED chrF++ so far (excluding this run) — the
    baseline the anomaly signal measures a too-good jump against."""
    if not language_pair:
        return None
    pair = urllib.parse.quote(language_pair, safe="")
    rows = _get(url, key,
                f"run_cards?trust=eq.verified&language_pair=eq.{pair}"
                f"&id=neq.{urllib.parse.quote(exclude_card_id, safe='')}"
                f"&chrf_plus_plus=not.is.null"
                f"&select=chrf_plus_plus&order=chrf_plus_plus.desc&limit=1")
    if not rows:
        return None
    val = rows[0].get("chrf_plus_plus")
    return float(val) if val is not None else None


def _stakes_new_bridge(url: str, key: str, card: dict) -> bool:
    """Best-effort STAKES signal: does this run light a NEW BRIDGE for a language
    family? Read the ranker's own connectivity classification for the run's
    (corpus, model, condition) from queue_items.diagnostics (map-mode row). A
    'bridge' class → high stakes → always audited. Absent classification → False
    (the anomaly/first-light signal independently covers new pairs)."""
    corpus = card.get("dataset_id")
    model = card.get("model_slug")
    condition = card.get("condition")
    if not (corpus and model and condition):
        return False
    try:
        rows = _get(url, key,
                    f"queue_items?rank_mode=eq.map"
                    f"&corpus_id=eq.{urllib.parse.quote(str(corpus), safe='')}"
                    f"&model=eq.{urllib.parse.quote(str(model), safe='')}"
                    f"&condition=eq.{urllib.parse.quote(str(condition), safe='')}"
                    f"&select=diagnostics&limit=1")
    except Exception as exc:  # queue_items not populated / transient → no stakes
        logger.warning("stakes lookup failed for %s: %s", card.get("id"), exc)
        return False
    if not rows:
        return False
    diag = rows[0].get("diagnostics") or {}
    return diag.get("map_connectivity_class") == "bridge"


def _demote_history(url: str, key: str, contributor_id: str | None,
                    owner_uid, *, exclude_card_id: str) -> list:
    """Re-audit a burned contributor's history: demote every OTHER currently-
    verified run of theirs to 'unverified' (re-enters the verifier queue) and
    return one reaudit record per demoted run. Non-fatal per row (a quarantined
    row that refuses the UPDATE — DB5 — is logged and skipped, not fatal)."""
    if owner_uid is None:
        return []  # anonymous: no persistent identity to sweep
    try:
        rows = _get(url, key,
                    f"run_cards?owner_uid=eq.{urllib.parse.quote(str(owner_uid), safe='')}"
                    f"&trust=eq.verified&id=neq."
                    f"{urllib.parse.quote(exclude_card_id, safe='')}&select=id")
    except Exception as exc:
        logger.warning("history sweep query failed for %s: %s", contributor_id, exc)
        return []
    records = []
    for r in rows:
        rid = r.get("id")
        if not rid:
            continue
        try:
            _patch_trust(url, key, rid, "unverified")
        except Exception as exc:  # e.g. DB5 quarantine-guard refuses the update
            logger.warning("could not demote verified run %s: %s", rid, exc)
            continue
        records.append(_rep.record_reaudit(
            contributor_id, rid, layer="L2",
            detail={"cause": "history re-audit after contributor burn"}))
    return records


def process_run_reputation(url: str, key: str, card: dict, verdict: Verdict, *,
                           apply: bool, reexecutor=None) -> dict:
    """Apply the reputation-weighted auditing layers to one L0 verdict.

    Executes reputation.plan_l0_outcome (L1 sampling decision + L0-caught burn),
    then runs the injected L2 `reexecutor(card) -> bool` on runs the sampler
    selected (when available) and folds its outcome in. On any burn, re-audits the
    contributor's verified history. All writes gated by `apply`; all best-effort.

    Returns a summary dict (also used by the CLI printer and the tests via the
    pure planner it delegates to).
    """
    card_id = card["id"]
    owner_uid = card.get("owner_uid")
    contributor_id = _contributor_id_for(card)

    state = (_get_contributor(url, key, contributor_id)
             if contributor_id else _rep.ReputationState.new(None))

    is_new_bridge = _stakes_new_bridge(url, key, card)
    prior_best = _prior_verified_best(url, key, card.get("language_pair"), card_id)
    anomaly = _rep.anomaly_score(verdict.recomputed_chrf, prior_best)
    reexec_available = reexecutor is not None

    plan = _rep.plan_l0_outcome(
        state, card_id,
        ok=verdict.ok, reason=verdict.reason,
        is_new_bridge=is_new_bridge, anomaly=anomaly,
        reexecutor_available=reexec_available,
        recomputed_chrf=verdict.recomputed_chrf,
    )
    records = list(plan.records)
    final_state = plan.state
    final_trust = plan.new_trust
    burn = plan.burn

    # L2: actually re-run the SAMPLED run when an executor is available.
    l2_ran = False
    if plan.l2_selected and reexec_available:
        l2_ran = True
        try:
            l2_pass = bool(reexecutor(card))
        except Exception as exc:
            logger.warning("L2 re-executor errored for %s: %s — treating as "
                           "pending (no reputation move)", card_id, exc)
            l2_pass = None
        if l2_pass is not None:
            final_state, l2_rec, l2_burn = _rep.apply_l2_result(
                final_state, card_id, l2_pass=l2_pass,
                detail={"prior_verified_best": prior_best, "anomaly": anomaly})
            records.append(l2_rec)
            if l2_burn:
                burn = True
                final_trust = "disqualified"

    if apply:
        if final_trust is not None:
            try:
                _patch_trust(url, key, card_id, final_trust)
            except Exception as exc:
                logger.warning("trust patch failed for %s: %s", card_id, exc)
        try:
            _upsert_contributor(url, key, final_state)
        except Exception as exc:
            logger.warning("contributor upsert failed for %s: %s",
                           contributor_id, exc)
        if burn:
            records.extend(_demote_history(
                url, key, contributor_id, owner_uid, exclude_card_id=card_id))
        try:
            _log_audit(url, key, records)
        except Exception as exc:
            logger.warning("audit-log append failed for %s: %s", card_id, exc)

    return {
        "card_id": card_id,
        "contributor_id": contributor_id,
        "trust": final_trust,
        "reputation": final_state.reputation,
        "status": final_state.status,
        "is_new_bridge": is_new_bridge,
        "anomaly": round(float(anomaly), 4),
        "l2_selected": plan.l2_selected,
        "l2_ran": l2_ran,
        "l2_pending": plan.l2_pending and not l2_ran,
        "burn": burn,
        "n_records": len(records),
    }


def run_corroboration_pass(url: str, key: str, *, apply: bool,
                           limit: int = 20000) -> dict:
    """L3 — detect independent replications on the VERIFIED board and cross-check.

    A verified run's chrF++ has already reproduced against the sha-pinned corpus
    at L0, so the confirmed headline is compared directly. Two verified runs of
    the same (dataset_id, model_slug, condition) from DISTINCT owner_uids that
    AGREE corroborate (both +REP_PER_CORROBORATION); a DISAGREEMENT flags both
    for L2 (logged; reputations unmoved until L2 resolves). Anonymous runs
    (owner_uid NULL) can't corroborate (no independent identity).
    """
    cards = _get(url, key,
                 "run_cards?trust=eq.verified&owner_uid=not.is.null"
                 "&select=id,dataset_id,model_slug,condition,owner_uid,"
                 f"chrf_plus_plus&limit={limit}")
    runs = [{
        "run_card_id": c.get("id"),
        "dataset_id": c.get("dataset_id"),
        "model_slug": c.get("model_slug"),
        "condition": c.get("condition"),
        "owner_uid": c.get("owner_uid"),
        "chrf": c.get("chrf_plus_plus"),
    } for c in cards]

    results = _rep.find_corroborations(runs)
    agreed = disagreed = inconclusive = 0
    # Cache contributor states within the pass so both sides of a cell accrue.
    state_cache: dict[str, "_rep.ReputationState"] = {}

    def _state(cid: str) -> "_rep.ReputationState":
        if cid not in state_cache:
            state_cache[cid] = _get_contributor(url, key, cid)
        return state_cache[cid]

    pending_records = []
    for res in results:
        if res.verdict == "agree":
            agreed += 1
            for owner, run_id in zip(res.owner_uids, res.run_card_ids):
                cid = f"uid:{owner}"
                st, rec = _rep.record_corroboration(
                    _state(cid), run_id,
                    detail={"key": list(res.key), "spread": res.chrf_spread,
                            "co_owners": [str(o) for o in res.owner_uids]})
                state_cache[cid] = st
                pending_records.append(rec)
        elif res.verdict == "disagree":
            disagreed += 1
            for owner, run_id in zip(res.owner_uids, res.run_card_ids):
                pending_records.append(_rep.AuditRecord(
                    f"uid:{owner}", run_id, "L3", "disagreement", 0, None,
                    {"key": list(res.key), "spread": res.chrf_spread,
                     "action": "flag for L2 audit"}))
        else:
            inconclusive += 1

    if apply:
        for st in state_cache.values():
            try:
                _upsert_contributor(url, key, st)
            except Exception as exc:
                logger.warning("corroboration upsert failed for %s: %s",
                               st.contributor_id, exc)
        try:
            _log_audit(url, key, pending_records)
        except Exception as exc:
            logger.warning("corroboration audit-log failed: %s", exc)

    return {
        "cells": len(results),
        "agreed": agreed,
        "disagreed": disagreed,
        "inconclusive": inconclusive,
        "contributors_touched": len(state_cache),
        "records": len(pending_records),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="mt-eval-verifier",
        description="Re-score leaderboard runs from their stored outputs and "
                    "promote reproducible ones to trust='verified'.",
    )
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--card-id", help="Verify a single run_card by id.")
    g.add_argument("--all-unverified", action="store_true",
                   help="Verify every run currently at trust='unverified'.")
    g.add_argument("--corroborate", action="store_true",
                   help="L3 corroboration pass: cross-check independent "
                        "replications on the verified board (no L0 re-score).")
    parser.add_argument("--apply", action="store_true",
                        help="Write the trust tier back to the DB (default: "
                             "dry-run, report only).")
    parser.add_argument("--reputation", action="store_true",
                        help="Reputation-weighted auditing (B3): after the L0 "
                             "re-score, record the contributor reputation ledger, "
                             "sample runs for an L2 audit by (reputation, stakes, "
                             "anomaly), and burn + re-audit history on caught "
                             "fraud. Reads/writes the contributors + "
                             "contributor_audit_log tables (migration 061).")
    parser.add_argument("--limit", type=int, default=5000,
                        help="Max cards to process in --all-unverified mode.")
    args = parser.parse_args(argv)

    url, key = _supabase_cfg()

    # L3 corroboration is a standalone board pass — no per-card L0 re-score.
    if args.corroborate:
        summary = run_corroboration_pass(url, key, apply=args.apply)
        mode = "applied" if args.apply else "dry-run (use --apply to write)"
        print(f"corroboration: {summary['cells']} independent cells — "
              f"{summary['agreed']} agree (+rep both), "
              f"{summary['disagreed']} disagree (flagged for L2), "
              f"{summary['inconclusive']} inconclusive; "
              f"{summary['contributors_touched']} contributors, "
              f"{summary['records']} records — {mode}")
        return 0

    _sel = ("id,dataset_id,chrf_plus_plus,comet_score,qe_score,"
            "morphological_accuracy,morph_coverage,language_pair,trust,"
            "owner_uid,model_slug,condition")
    if args.card_id:
        cards = _get(url, key,
                     f"run_cards?id=eq.{args.card_id}&select={_sel}")
    else:
        cards = _get(url, key,
                     f"run_cards?trust=eq.unverified&select={_sel}"
                     f"&limit={args.limit}")

    if not cards:
        print("No matching run cards.")
        return 0

    passed = mism = skipped = burned = 0
    for card in cards:
        # L0 re-score. In reputation mode, defer the trust write to the driver
        # (which also records reputation, samples L2, and burns on fraud); the
        # L0-only path writes trust itself, unchanged from before.
        v = verify_card(url, key, card, apply=(args.apply and not args.reputation))
        extra = ""
        if args.reputation:
            summary = process_run_reputation(url, key, card, v, apply=args.apply)
            if summary["burn"]:
                burned += 1
            flags = []
            if summary["is_new_bridge"]:
                flags.append("bridge")
            if summary["l2_selected"]:
                flags.append("L2-ran" if summary["l2_ran"]
                             else ("L2-pending" if summary["l2_pending"] else "L2"))
            if summary["burn"]:
                flags.append("BURN")
            extra = (f"  [rep {summary['reputation']} {summary['status']}"
                     + (f"; {','.join(flags)}" if flags else "") + "]")
        tag = "✓ VERIFIED" if v.ok else ("✗ MISMATCH" if "MISMATCH" in v.reason
                                         else "· skipped")
        if v.ok:
            passed += 1
        elif "MISMATCH" in v.reason:
            mism += 1
        else:
            skipped += 1
        print(f"  {tag}  {v.card_id}  {v.reason}{extra}")

    mode = "applied" if args.apply else "dry-run (use --apply to write)"
    tail = f", {burned} burned" if args.reputation else ""
    print(f"\n{len(cards)} cards: {passed} verified, {mism} mismatched, "
          f"{skipped} unscoreable{tail} — {mode}"
          + ("  [reputation-weighted]" if args.reputation else ""))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
